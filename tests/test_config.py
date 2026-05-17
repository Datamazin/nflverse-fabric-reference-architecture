from pathlib import Path

import pytest

from nfl_fabric_acquisition._polars_startup import should_skip_polars_cpu_check
from nfl_fabric_acquisition.config import AcquisitionConfig, DEFAULT_END_SEASON, DEFAULT_START_SEASON


def test_default_start_season_matches_available_pbp_history() -> None:
    assert DEFAULT_START_SEASON == 1999


def test_default_end_season_includes_recent_completed_data() -> None:
    assert DEFAULT_END_SEASON == 2025


def test_seasons_are_inclusive() -> None:
    config = AcquisitionConfig(start_season=2008, end_season=2010)

    assert config.seasons == [2008, 2009, 2010]


def test_invalid_season_range_raises() -> None:
    config = AcquisitionConfig(start_season=2018, end_season=2008)

    with pytest.raises(ValueError):
        _ = config.seasons


def test_pbp_path_uses_expected_layout() -> None:
    config = AcquisitionConfig(out=Path("nflverse_local"))

    assert config.pbp_path(2008) == Path(
        "nflverse_local/raw/nflverse/pbp/season=2008/play_by_play_2008.parquet"
    )


def test_polars_cpu_check_is_skipped_for_windows_arm64_x64_emulation() -> None:
    assert should_skip_polars_cpu_check(
        os_name="nt",
        machine="ARM64",
        processor_architecture="AMD64",
    )


def test_polars_cpu_check_is_not_skipped_for_native_amd64_windows() -> None:
    assert not should_skip_polars_cpu_check(
        os_name="nt",
        machine="AMD64",
        processor_architecture="AMD64",
    )
