import polars as pl

from nfl_fabric_acquisition.pipeline import (
    availability_notes,
    seasons_for_dataset,
    seasons_with_played_postseason,
)


def test_weekly_rosters_start_at_2002() -> None:
    seasons = [1999, 2000, 2001, 2002, 2003]

    assert seasons_for_dataset(seasons, "rosters_weekly") == [2002, 2003]


def test_availability_notes_explain_skipped_weekly_roster_years() -> None:
    notes = availability_notes([1999, 2000, 2001, 2002])

    assert notes["rosters_weekly"]["available_start_season"] == 2002
    assert notes["rosters_weekly"]["skipped_seasons"] == [1999, 2000, 2001]


def test_in_progress_season_has_no_postseason() -> None:
    schedules = pl.DataFrame(
        {
            "season": [2025, 2025, 2026, 2026],
            "game_type": ["REG", "SB", "REG", "WC"],
            "home_score": [24, 31, 17, None],
        }
    )

    assert seasons_with_played_postseason(schedules, [2025, 2026]) == [2025]
