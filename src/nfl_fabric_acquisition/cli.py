"""Command-line entry point for nflverse local acquisition."""

from __future__ import annotations

import argparse
import json
import os
import platform
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


def should_skip_polars_cpu_check(
    *,
    os_name: str | None = None,
    machine: str | None = None,
    processor_architecture: str | None = None,
) -> bool:
    current_os = os.name if os_name is None else os_name
    current_machine = platform.machine() if machine is None else machine
    current_arch = (
        os.environ.get("PROCESSOR_ARCHITECTURE")
        if processor_architecture is None
        else processor_architecture
    )

    return (
        current_os == "nt"
        and current_machine.lower() == "arm64"
        and (current_arch or "").upper() == "AMD64"
    )


def configure_polars_startup() -> None:
    if should_skip_polars_cpu_check():
        # Windows ARM64 can run x64 Python under emulation. In that case Polars
        # sees ARM64 from platform.machine(), cannot run the x86 CPUID probe,
        # and raises "unknown feature flag: 'sse3'" before our CLI starts.
        os.environ.setdefault("POLARS_SKIP_CPU_CHECK", "1")


def main() -> None:
    configure_polars_startup()

    from nfl_fabric_acquisition.pipeline import run_acquisition

    quality_report = run_acquisition(config_from_args(parse_args()))
    print(json.dumps(quality_report, indent=2, default=str))
