"""
Deploy and refresh the NFL Play by Play semantic model in Microsoft Fabric.

Expected local model folder:
    semantic_model_project/NFL Play by Play Model.SemanticModel/

The semantic model folder should be exported from Power BI Desktop as PBIP/TMDL,
or downloaded from the Fabric semantic model definition API. This script stages
the files in a temporary folder, optionally patches Fabric connection references,
publishes with fabric-cicd, then triggers a Power BI semantic model refresh.

Usage:
    python scripts/create_nfl_play_by_play_sm.py --workspace-id <WORKSPACE_GUID>

Optional connection patching for import models built over the Fabric SQL endpoint:
    python scripts/create_nfl_play_by_play_sm.py `
        --workspace-id <WORKSPACE_GUID> `
        --sql-endpoint-server <server.datawarehouse.fabric.microsoft.com> `
        --sql-database lh_nfl

Environment variables:
    FABRIC_WORKSPACE_ID
    FABRIC_SM_DIR
    FABRIC_AUTH_MODE                 interactive, azure-cli, or default
    FABRIC_SQL_ENDPOINT_SERVER
    FABRIC_SOURCE_SQL_ENDPOINT_SERVER
    FABRIC_SQL_DATABASE
    FABRIC_SOURCE_SQL_DATABASE
    FABRIC_LAKEHOUSE_ID              only needed if the model has OneLake URLs
"""

from __future__ import annotations

import argparse
import importlib
import importlib.metadata
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


SM_MODEL_NAME = "NFL Play by Play Model"
DEFAULT_SM_DIR = Path("semantic_model_project") / f"{SM_MODEL_NAME}.SemanticModel"

FABRIC_API_SCOPE = "https://api.fabric.microsoft.com/.default"
POWER_BI_API_SCOPE = "https://analysis.windows.net/powerbi/api/.default"
FABRIC_API_BASE = "https://api.fabric.microsoft.com/v1"
POWER_BI_API_BASE = "https://api.powerbi.com/v1.0/myorg"

TEXT_SUFFIXES = {
    ".bim",
    ".json",
    ".m",
    ".pbism",
    ".tmdl",
    ".toml",
    ".txt",
    ".xml",
    ".yml",
    ".yaml",
}


def ensure_package(distribution: str, import_name: str | None = None) -> None:
    import_name = import_name or distribution.replace("-", "_")
    try:
        importlib.import_module(import_name)
        version = importlib.metadata.version(distribution)
        print(f"  {distribution} {version} already installed.")
        return
    except (ImportError, importlib.metadata.PackageNotFoundError):
        pass

    print(f"  Installing {distribution}...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", distribution, "-q"])
    importlib.invalidate_caches()
    importlib.import_module(import_name)
    version = importlib.metadata.version(distribution)
    print(f"  {distribution} {version} installed.")


def get_credential(auth_mode: str):
    from azure.identity import (
        AzureCliCredential,
        DefaultAzureCredential,
        InteractiveBrowserCredential,
    )

    if auth_mode == "azure-cli":
        return AzureCliCredential()
    if auth_mode == "default":
        return DefaultAzureCredential(exclude_interactive_browser_credential=False)
    return InteractiveBrowserCredential()


class ApiClient:
    def __init__(self, credential: Any, scope: str):
        self.credential = credential
        self.scope = scope

    def request(
        self,
        method: str,
        url: str,
        body: dict[str, Any] | None = None,
        expected_statuses: tuple[int, ...] = (200,),
    ) -> tuple[int, dict[str, Any] | None]:
        token = self.credential.get_token(self.scope).token
        data = None
        headers = {"Authorization": f"Bearer {token}"}
        if body is not None:
            data = json.dumps(body).encode("utf-8")
            headers["Content-Type"] = "application/json"

        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req) as resp:
                payload = resp.read()
                status = resp.status
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="replace")
            raise RuntimeError(
                f"{method} {url} failed with HTTP {exc.code}.\n{detail}"
            ) from exc

        if status not in expected_statuses:
            raise RuntimeError(f"{method} {url} returned HTTP {status}.")

        if not payload:
            return status, None
        return status, json.loads(payload.decode("utf-8"))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=f"Deploy and refresh the {SM_MODEL_NAME} semantic model."
    )
    parser.add_argument(
        "--workspace-id",
        default=os.environ.get("FABRIC_WORKSPACE_ID"),
        help="Target Fabric workspace GUID, or set FABRIC_WORKSPACE_ID.",
    )
    parser.add_argument(
        "--sm-dir",
        default=os.environ.get("FABRIC_SM_DIR", str(DEFAULT_SM_DIR)),
        help=f"Path to the .SemanticModel folder. Default: {DEFAULT_SM_DIR}",
    )
    parser.add_argument(
        "--environment",
        default=os.environ.get("FABRIC_ENVIRONMENT"),
        help="Optional fabric-cicd environment name for parameter.yml substitutions.",
    )
    parser.add_argument(
        "--auth-mode",
        choices=["interactive", "azure-cli", "default"],
        default=os.environ.get("FABRIC_AUTH_MODE", "interactive"),
        help="Authentication mode. Default: interactive.",
    )
    parser.add_argument(
        "--sql-endpoint-server",
        default=os.environ.get("FABRIC_SQL_ENDPOINT_SERVER"),
        help="Target Fabric SQL endpoint server to patch into model expressions.",
    )
    parser.add_argument(
        "--source-sql-endpoint-server",
        default=os.environ.get("FABRIC_SOURCE_SQL_ENDPOINT_SERVER"),
        help="Source SQL endpoint server to replace. If omitted, any Fabric SQL endpoint host is replaced.",
    )
    parser.add_argument(
        "--sql-database",
        default=os.environ.get("FABRIC_SQL_DATABASE"),
        help="Target SQL database/lakehouse name to patch into Sql.Database calls.",
    )
    parser.add_argument(
        "--source-sql-database",
        default=os.environ.get("FABRIC_SOURCE_SQL_DATABASE"),
        help="Source SQL database/lakehouse name to replace exactly.",
    )
    parser.add_argument(
        "--lakehouse-id",
        default=os.environ.get("FABRIC_LAKEHOUSE_ID"),
        help="Target Lakehouse GUID to patch into OneLake URLs when present.",
    )
    parser.add_argument(
        "--skip-refresh",
        action="store_true",
        help="Publish only; do not trigger the post-deploy refresh.",
    )
    parser.add_argument(
        "--skip-publish-if-exists",
        action="store_true",
        help="Use the older create-only behavior and skip publish when the model already exists.",
    )
    parser.add_argument(
        "--no-install",
        action="store_true",
        help="Do not auto-install Python dependencies; fail if they are missing.",
    )
    parser.add_argument(
        "--allow-unpatched-connections",
        action="store_true",
        help="Warn instead of failing when a requested connection patch finds no matching text.",
    )
    return parser.parse_args()


def validate_args(args: argparse.Namespace) -> None:
    if not args.workspace_id:
        raise SystemExit("ERROR: --workspace-id is required, or set FABRIC_WORKSPACE_ID.")

    sm_dir = Path(args.sm_dir)
    if not sm_dir.exists():
        raise SystemExit(
            f"ERROR: semantic model directory not found: {sm_dir}\n"
            "Export the PBIP/TMDL semantic model files into "
            f"{DEFAULT_SM_DIR} first."
        )
    if not sm_dir.is_dir():
        raise SystemExit(f"ERROR: --sm-dir is not a directory: {sm_dir}")

    definition_pbism = sm_dir / "definition.pbism"
    tmdl_definition = sm_dir / "definition"
    tmsl_model = sm_dir / "model.bim"
    if not definition_pbism.exists():
        raise SystemExit(f"ERROR: missing required file: {definition_pbism}")
    if not tmdl_definition.exists() and not tmsl_model.exists():
        raise SystemExit(
            f"ERROR: {sm_dir} must contain either a TMDL definition/ folder "
            "or a TMSL model.bim file."
        )


def iter_text_files(root: Path):
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix.lower() in TEXT_SUFFIXES:
            yield path


def replace_sql_database_calls(text: str, target_database: str) -> tuple[str, int]:
    replacements = 0

    def replace_plain(match: re.Match[str]) -> str:
        nonlocal replacements
        replacements += 1
        return f'{match.group(1)}"{target_database}"'

    def replace_escaped(match: re.Match[str]) -> str:
        nonlocal replacements
        replacements += 1
        return f'{match.group(1)}\\"{target_database}\\"'

    fabric_host = r"[A-Za-z0-9-]+\.datawarehouse\.fabric\.microsoft\.com"
    text = re.sub(
        rf'(Sql\.Database\(\s*"{fabric_host}"\s*,\s*)"[^"]+"',
        replace_plain,
        text,
    )
    text = re.sub(
        rf'(Sql\.Database\(\s*\\"{fabric_host}\\"\s*,\s*)\\"[^\\"]+\\"',
        replace_escaped,
        text,
    )
    return text, replacements


def stage_model(sm_dir: Path) -> tuple[tempfile.TemporaryDirectory[str], Path, Path]:
    temp_dir = tempfile.TemporaryDirectory(prefix="nfl-sm-deploy-")
    src_parent = sm_dir.parent.resolve()
    staged_parent = Path(temp_dir.name) / src_parent.name

    def ignore(_dir: str, names: list[str]) -> set[str]:
        return {
            name
            for name in names
            if name in {"cache.abf", "localSettings.json"} or name.endswith(".tmp")
        }

    shutil.copytree(src_parent, staged_parent, ignore=ignore)
    staged_sm_dir = staged_parent / sm_dir.name
    return temp_dir, staged_parent, staged_sm_dir


def patch_connection_references(
    sm_dir: Path,
    workspace_id: str,
    lakehouse_id: str | None,
    sql_endpoint_server: str | None,
    source_sql_endpoint_server: str | None,
    sql_database: str | None,
    source_sql_database: str | None,
    allow_unpatched: bool,
) -> None:
    one_lake_target = None
    if lakehouse_id:
        one_lake_target = (
            f"https://onelake.dfs.fabric.microsoft.com/{workspace_id}/{lakehouse_id}"
        )

    counts = {
        "onelake": 0,
        "sql_endpoint_server": 0,
        "sql_database_exact": 0,
        "sql_database_call": 0,
    }

    fabric_host_pattern = re.compile(
        r"[A-Za-z0-9-]+\.datawarehouse\.fabric\.microsoft\.com"
    )
    one_lake_pattern = re.compile(
        r"https://onelake\.dfs\.fabric\.microsoft\.com/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}"
    )

    for path in iter_text_files(sm_dir):
        try:
            original = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue

        patched = original

        if one_lake_target:
            patched, n = one_lake_pattern.subn(one_lake_target, patched)
            counts["onelake"] += n

        if sql_endpoint_server:
            if source_sql_endpoint_server:
                n = patched.count(source_sql_endpoint_server)
                patched = patched.replace(source_sql_endpoint_server, sql_endpoint_server)
                counts["sql_endpoint_server"] += n
            else:
                patched, n = fabric_host_pattern.subn(sql_endpoint_server, patched)
                counts["sql_endpoint_server"] += n

        if sql_database:
            if source_sql_database:
                n = patched.count(source_sql_database)
                patched = patched.replace(source_sql_database, sql_database)
                counts["sql_database_exact"] += n
            else:
                patched, n = replace_sql_database_calls(patched, sql_database)
                counts["sql_database_call"] += n

        if patched != original:
            path.write_text(patched, encoding="utf-8")

    requested = {
        "OneLake URL": (one_lake_target is not None, counts["onelake"]),
        "SQL endpoint server": (
            sql_endpoint_server is not None,
            counts["sql_endpoint_server"],
        ),
        "SQL database": (
            sql_database is not None,
            counts["sql_database_exact"] + counts["sql_database_call"],
        ),
    }
    missing = [name for name, (was_requested, count) in requested.items() if was_requested and count == 0]
    if missing:
        message = (
            "Requested connection patch found no matching text for: "
            + ", ".join(missing)
        )
        if allow_unpatched:
            print(f"  WARNING: {message}")
        else:
            raise RuntimeError(
                f"{message}.\n"
                "Check the source values in the exported model files, or pass "
                "--allow-unpatched-connections if this is expected."
            )

    if any(counts.values()):
        print("  Connection references patched in staged files:")
        for key, count in counts.items():
            if count:
                print(f"    {key}: {count}")
    else:
        print("  No connection patch requested.")


def find_semantic_model_id(
    fabric_client: ApiClient, workspace_id: str, model_name: str
) -> str | None:
    _, payload = fabric_client.request(
        "GET", f"{FABRIC_API_BASE}/workspaces/{workspace_id}/semanticModels"
    )
    models = (payload or {}).get("value", [])
    match = next((m for m in models if m.get("displayName") == model_name), None)
    return match.get("id") if match else None


def publish_model(
    credential: Any,
    workspace_id: str,
    repository_dir: Path,
    environment: str | None,
) -> None:
    from fabric_cicd import FabricWorkspace, publish_all_items

    print(f"  Publishing {SM_MODEL_NAME} from {repository_dir}...")
    workspace_params: dict[str, Any] = {
        "workspace_id": workspace_id,
        "repository_directory": str(repository_dir),
        "item_type_in_scope": ["SemanticModel"],
        "token_credential": credential,
    }
    if environment:
        workspace_params["environment"] = environment

    workspace = FabricWorkspace(**workspace_params)
    publish_all_items(workspace)
    print("  Publish complete.")


def trigger_refresh(
    power_bi_client: ApiClient, workspace_id: str, semantic_model_id: str
) -> None:
    refreshes_url = (
        f"{POWER_BI_API_BASE}/groups/{workspace_id}/datasets/"
        f"{semantic_model_id}/refreshes"
    )
    print("  Triggering semantic model refresh...")
    power_bi_client.request(
        "POST",
        refreshes_url,
        body={"notifyOption": "NoNotification"},
        expected_statuses=(200, 202),
    )

    print("  Refresh triggered. Polling every 15 seconds...")
    for attempt in range(40):
        time.sleep(15)
        _, payload = power_bi_client.request("GET", f"{refreshes_url}?$top=1")
        refreshes = (payload or {}).get("value", [])
        if not refreshes:
            print("    Waiting for refresh history...")
            continue

        latest = refreshes[0]
        status = latest.get("status", "Unknown")
        end_time = latest.get("endTime", "in progress")
        print(f"    [{attempt + 1:02d}] status={status:<12} endTime={end_time}")
        if status == "Completed":
            print("  Semantic model refreshed successfully.")
            return
        if status == "Failed":
            detail = latest.get("serviceExceptionJson", "(no details)")
            raise RuntimeError(f"Refresh failed.\nDetails: {detail}")

    print("  WARNING: refresh still running after 10 minutes. Check Fabric manually.")


def main() -> None:
    args = parse_args()
    validate_args(args)

    if not args.no_install:
        print("[1/6] Checking Python dependencies...")
        ensure_package("azure-identity", "azure.identity")
        ensure_package("fabric-cicd", "fabric_cicd")

    sm_dir = Path(args.sm_dir).resolve()

    print("=" * 72)
    print(f"  Deploying {SM_MODEL_NAME}")
    print(f"  Workspace : {args.workspace_id}")
    print(f"  SM dir    : {sm_dir}")
    print(f"  Auth mode : {args.auth_mode}")
    print("=" * 72)

    print("\n[2/6] Authenticating...")
    credential = get_credential(args.auth_mode)
    fabric_client = ApiClient(credential, FABRIC_API_SCOPE)
    power_bi_client = ApiClient(credential, POWER_BI_API_SCOPE)

    print("\n[3/6] Checking existing semantic model...")
    existing_id = find_semantic_model_id(fabric_client, args.workspace_id, SM_MODEL_NAME)
    if existing_id:
        print(f"  Found existing model: {SM_MODEL_NAME} ({existing_id})")
        if args.skip_publish_if_exists:
            print("  --skip-publish-if-exists set; publish will be skipped.")
    else:
        print("  No existing model with that display name was found.")

    if not existing_id or not args.skip_publish_if_exists:
        print("\n[4/6] Staging and patching model files...")
        temp_dir, staged_parent, staged_sm_dir = stage_model(sm_dir)
        try:
            patch_connection_references(
                staged_sm_dir,
                args.workspace_id,
                args.lakehouse_id,
                args.sql_endpoint_server,
                args.source_sql_endpoint_server,
                args.sql_database,
                args.source_sql_database,
                args.allow_unpatched_connections,
            )

            print("\n[5/6] Publishing to Fabric...")
            publish_model(credential, args.workspace_id, staged_parent, args.environment)
        finally:
            temp_dir.cleanup()

    print("\n[6/6] Resolving semantic model ID...")
    semantic_model_id = find_semantic_model_id(
        fabric_client, args.workspace_id, SM_MODEL_NAME
    )
    if not semantic_model_id:
        raise RuntimeError(
            f"{SM_MODEL_NAME} was not found after publish. Check fabric-cicd output."
        )
    print(f"  Semantic model ID: {semantic_model_id}")

    if args.skip_refresh:
        print("  --skip-refresh set; refresh skipped.")
    else:
        trigger_refresh(power_bi_client, args.workspace_id, semantic_model_id)

    print("\nDone.")


if __name__ == "__main__":
    main()
