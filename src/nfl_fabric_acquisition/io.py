"""Filesystem and manifest helpers."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import polars as pl


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def write_json(path: Path, payload: dict[str, Any]) -> None:
    ensure_dir(path.parent)
    with path.open("w", encoding="utf-8") as file:
        json.dump(payload, file, indent=2, default=str)
        file.write("\n")


def dataframe_profile(df: pl.DataFrame) -> dict[str, Any]:
    return {
        "rows": df.height,
        "columns": df.width,
        "column_names": df.columns,
    }


def write_parquet(
    df: pl.DataFrame,
    path: Path,
    *,
    dataset: str,
    season: int | None = None,
    compression: str = "zstd",
    force: bool = False,
) -> dict[str, Any]:
    ensure_dir(path.parent)

    if path.exists() and not force:
        existing = pl.read_parquet(path)
        return {
            "dataset": dataset,
            "season": season,
            "path": str(path),
            "status": "skipped_existing",
            **dataframe_profile(existing),
        }

    df.write_parquet(path, compression=compression, statistics=True)
    return {
        "dataset": dataset,
        "season": season,
        "path": str(path),
        "status": "written",
        **dataframe_profile(df),
    }


def build_schema_manifest(outputs: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "generated_at_utc": utc_now_iso(),
        "datasets": [
            {
                "dataset": item.get("dataset"),
                "season": item.get("season"),
                "path": item.get("path"),
                "rows": item.get("rows"),
                "columns": item.get("columns"),
                "column_names": item.get("column_names", []),
            }
            for item in outputs
        ],
    }

