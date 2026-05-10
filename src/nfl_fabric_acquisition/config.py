"""Configuration and path helpers for nflverse acquisition."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


DEFAULT_START_SEASON = 1999
DEFAULT_END_SEASON = 2025
DEFAULT_OUTPUT_ROOT = Path("./nflverse_local")
DEFAULT_TEAM_FOCUS = "SEA"


@dataclass(frozen=True)
class AcquisitionConfig:
    start_season: int = DEFAULT_START_SEASON
    end_season: int = DEFAULT_END_SEASON
    out: Path = DEFAULT_OUTPUT_ROOT
    cache: Path = DEFAULT_OUTPUT_ROOT / "cache" / "nflreadpy"
    force: bool = False
    skip_optional: bool = False
    compression: str = "zstd"
    team_focus: str = DEFAULT_TEAM_FOCUS
    retries: int = 3

    @property
    def seasons(self) -> list[int]:
        if self.start_season > self.end_season:
            raise ValueError("--start-season must be less than or equal to --end-season")
        return list(range(self.start_season, self.end_season + 1))

    @property
    def manifest_dir(self) -> Path:
        return self.out / "manifest"

    @property
    def raw_root(self) -> Path:
        return self.out / "raw" / "nflverse"

    def pbp_path(self, season: int) -> Path:
        return self.raw_root / "pbp" / f"season={season}" / f"play_by_play_{season}.parquet"

    def partitioned_path(self, dataset_name: str, season: int) -> Path:
        return (
            self.raw_root
            / dataset_name
            / f"season={season}"
            / f"{dataset_name}_{season}.parquet"
        )

    def range_file_path(self, dataset_dir: str, filename: str) -> Path:
        return self.raw_root / dataset_dir / filename
