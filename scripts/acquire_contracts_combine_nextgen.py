"""Download Contracts, Combine, and Next Gen Stats from nflverse via nflreadpy.

This script fetches three additional datasets and writes them as Parquet files
in the same layout as the existing acquisition pipeline (under nflverse_local/raw/nflverse/).

Usage:
    python scripts/acquire_contracts_combine_nextgen.py [--output-dir ./nflverse_local] [--force]

Prerequisites:
    pip install nflreadpy polars pyarrow
"""

from __future__ import annotations

import argparse
import json
import logging
import platform
import time
from datetime import datetime, timezone
from pathlib import Path

import polars as pl

LOGGER = logging.getLogger(__name__)

DEFAULT_OUTPUT_ROOT = Path("./nflverse_local")
COMPRESSION = "zstd"
RETRIES = 3


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def load_with_retries(name: str, loader, *, retries: int = RETRIES) -> pl.DataFrame:
    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            LOGGER.info("Fetching %s (attempt %s/%s)", name, attempt, retries)
            return loader()
        except Exception as exc:
            last_error = exc
            if attempt == retries:
                break
            sleep_seconds = min(2**attempt, 30)
            LOGGER.warning("%s failed: %s. Retrying in %ss.", name, exc, sleep_seconds)
            time.sleep(sleep_seconds)
    raise RuntimeError(f"Failed to fetch {name} after {retries} attempts") from last_error


def write_parquet(df: pl.DataFrame, path: Path, *, compression: str = COMPRESSION) -> dict:
    ensure_dir(path.parent)
    df.write_parquet(path, compression=compression)
    return {
        "path": str(path),
        "rows": len(df),
        "columns": len(df.columns),
        "size_bytes": path.stat().st_size,
    }


def configure_nflreadpy(cache_dir: Path) -> None:
    from nflreadpy.config import update_config

    update_config(
        cache_mode="filesystem",
        cache_dir=cache_dir,
        verbose=True,
        timeout=120,
        user_agent="fabric-nfl-analytics-local-acquisition",
    )


def run(output_root: Path, force: bool = False) -> dict:
    import nflreadpy as nfl

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    raw_root = output_root / "raw" / "nflverse"
    cache_dir = output_root / "cache" / "nflreadpy"
    manifest_dir = output_root / "manifest"

    ensure_dir(raw_root)
    ensure_dir(cache_dir)
    ensure_dir(manifest_dir)
    configure_nflreadpy(cache_dir)

    manifest = {
        "fetched_at_utc": utc_now_iso(),
        "python_version": platform.python_version(),
        "platform": platform.platform(),
        "datasets": ["contracts", "combine", "nextgen_stats"],
        "outputs": [],
    }

    # --- Contracts (from OverTheCap) ---
    contracts_path = raw_root / "contracts" / "contracts.parquet"
    if contracts_path.exists() and not force:
        LOGGER.info("Skipping existing contracts at %s", contracts_path)
        df = pl.read_parquet(contracts_path)
        manifest["outputs"].append({"dataset": "contracts", **write_parquet(df, contracts_path)})
    else:
        df = load_with_retries("contracts", nfl.load_contracts)
        result = write_parquet(df, contracts_path)
        manifest["outputs"].append({"dataset": "contracts", **result})
        LOGGER.info("contracts: %s rows, %s columns", result["rows"], result["columns"])

    # --- Combine ---
    combine_path = raw_root / "combine" / "combine.parquet"
    if combine_path.exists() and not force:
        LOGGER.info("Skipping existing combine at %s", combine_path)
        df = pl.read_parquet(combine_path)
        manifest["outputs"].append({"dataset": "combine", **write_parquet(df, combine_path)})
    else:
        df = load_with_retries("combine", nfl.load_combine)
        result = write_parquet(df, combine_path)
        manifest["outputs"].append({"dataset": "combine", **result})
        LOGGER.info("combine: %s rows, %s columns", result["rows"], result["columns"])

    # --- Next Gen Stats (passing, rushing, receiving) ---
    for stat_type in ["passing", "rushing", "receiving"]:
        ngs_path = raw_root / "nextgen_stats" / f"nextgen_stats_{stat_type}.parquet"
        dataset_name = f"nextgen_stats_{stat_type}"

        if ngs_path.exists() and not force:
            LOGGER.info("Skipping existing %s at %s", dataset_name, ngs_path)
            df = pl.read_parquet(ngs_path)
            manifest["outputs"].append({"dataset": dataset_name, **write_parquet(df, ngs_path)})
        else:
            df = load_with_retries(
                dataset_name,
                lambda st=stat_type: nfl.load_nextgen_stats(stat_type=st),
            )
            result = write_parquet(df, ngs_path)
            manifest["outputs"].append({"dataset": dataset_name, **result})
            LOGGER.info("%s: %s rows, %s columns", dataset_name, result["rows"], result["columns"])

    # Write supplemental manifest
    manifest_path = manifest_dir / "acquisition_manifest_supplemental.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    LOGGER.info("Manifest written to %s", manifest_path)

    return manifest


def main():
    parser = argparse.ArgumentParser(
        description="Download Contracts, Combine, and Next Gen Stats from nflverse."
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_ROOT,
        help="Root output directory (default: ./nflverse_local)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-download even if files already exist.",
    )
    args = parser.parse_args()
    run(args.output_dir, force=args.force)


if __name__ == "__main__":
    main()
