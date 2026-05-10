"""Command-line entry point for nflverse local acquisition."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from nfl_fabric_acquisition.config import AcquisitionConfig


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Acquire nflverse data with nflreadpy.")
    parser.add_argument("--start-season", type=int, default=1999)
    parser.add_argument("--end-season", type=int, default=2025)
    parser.add_argument("--out", type=Path, default=Path("./nflverse_local"))
    parser.add_argument("--cache", type=Path, default=None)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--skip-optional", action="store_true")
    parser.add_argument("--compression", type=str, default="zstd")
    parser.add_argument("--team-focus", type=str, default="SEA")
    parser.add_argument("--retries", type=int, default=3)
    return parser.parse_args()


def config_from_args(args: argparse.Namespace) -> AcquisitionConfig:
    cache = args.cache if args.cache is not None else args.out / "cache" / "nflreadpy"
    return AcquisitionConfig(
        start_season=args.start_season,
        end_season=args.end_season,
        out=args.out,
        cache=cache,
        force=args.force,
        skip_optional=args.skip_optional,
        compression=args.compression,
        team_focus=args.team_focus,
        retries=args.retries,
    )


def main() -> None:
    from nfl_fabric_acquisition.pipeline import run_acquisition

    quality_report = run_acquisition(config_from_args(parse_args()))
    print(json.dumps(quality_report, indent=2, default=str))
