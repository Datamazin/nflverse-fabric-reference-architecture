from nfl_fabric_acquisition.pipeline import availability_notes, seasons_for_dataset


def test_weekly_rosters_start_at_2002() -> None:
    seasons = [1999, 2000, 2001, 2002, 2003]

    assert seasons_for_dataset(seasons, "rosters_weekly") == [2002, 2003]


def test_availability_notes_explain_skipped_weekly_roster_years() -> None:
    notes = availability_notes([1999, 2000, 2001, 2002])

    assert notes["rosters_weekly"]["available_start_season"] == 2002
    assert notes["rosters_weekly"]["skipped_seasons"] == [1999, 2000, 2001]

