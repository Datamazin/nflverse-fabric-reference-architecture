"""Quality checks for locally staged nflverse parquet files."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import polars as pl

from nfl_fabric_acquisition.io import utc_now_iso

PBP_REQUIRED_COLUMNS = [
    "season",
    "season_type",
    "week",
    "game_id",
    "play_id",
    "home_team",
    "away_team",
    "posteam",
    "defteam",
    "play_type",
    "epa",
    "wpa",
]


def check_manifest_completeness(outputs: list[dict[str, Any]]) -> dict[str, Any]:
    required = ["dataset", "path", "rows", "columns", "column_names", "status"]
    incomplete = [
        {"dataset": item.get("dataset"), "path": item.get("path"), "missing": missing}
        for item in outputs
        if (missing := [key for key in required if key not in item])
    ]
    return {
        "name": "manifest_completeness",
        "passed": len(incomplete) == 0,
        "required_fields": required,
        "incomplete_outputs": incomplete,
    }


def validate_pbp_file(root: Path, season: int, team_focus: str) -> dict[str, Any]:
    path = root / "raw" / "nflverse" / "pbp" / f"season={season}" / f"play_by_play_{season}.parquet"
    check: dict[str, Any] = {
        "name": f"pbp_exists_and_valid_{season}",
        "path": str(path),
        "passed": path.exists(),
    }

    if not path.exists():
        return check

    df = pl.read_parquet(path)
    missing = [column for column in PBP_REQUIRED_COLUMNS if column not in df.columns]
    check.update(
        {
            "rows": df.height,
            "columns": df.width,
            "missing_required_columns": missing,
            "passed": df.height > 0 and not missing,
        }
    )

    if "season" in df.columns:
        out_of_range = df.filter(pl.col("season") != season).height
        check["rows_with_unexpected_season"] = out_of_range
        check["passed"] = check["passed"] and out_of_range == 0

    if {"posteam", "defteam"}.issubset(df.columns):
        team_rows = df.filter(
            (pl.col("posteam") == team_focus) | (pl.col("defteam") == team_focus)
        ).height
        check["team_focus_rows"] = team_rows
        check["team_focus_present"] = team_rows > 0
        check["passed"] = check["passed"] and team_rows > 0

    if {"game_id", "play_id"}.issubset(df.columns):
        duplicate_keys = (
            df.group_by(["game_id", "play_id"])
            .len()
            .filter(pl.col("len") > 1)
            .height
        )
        check["duplicate_game_id_play_id_count"] = duplicate_keys

    if "season_type" in df.columns:
        check["season_type_values"] = df.select(pl.col("season_type").unique()).to_series().to_list()

    return check


def validate_game_join(root: Path, seasons: list[int]) -> dict[str, Any]:
    schedule_path = (
        root
        / "raw"
        / "nflverse"
        / "schedules"
        / f"schedules_{seasons[0]}_{seasons[-1]}.parquet"
    )
    check: dict[str, Any] = {
        "name": "pbp_game_ids_join_to_schedules",
        "path": str(schedule_path),
        "passed": schedule_path.exists(),
    }
    if not schedule_path.exists():
        return check

    schedules = pl.read_parquet(schedule_path)
    if "game_id" not in schedules.columns:
        check["passed"] = False
        check["missing_required_columns"] = ["game_id"]
        return check

    schedule_game_ids = schedules.select("game_id").unique()
    unmatched_by_season: dict[str, int] = {}
    for season in seasons:
        pbp_path = root / "raw" / "nflverse" / "pbp" / f"season={season}" / f"play_by_play_{season}.parquet"
        if not pbp_path.exists():
            unmatched_by_season[str(season)] = -1
            continue
        pbp = pl.read_parquet(pbp_path, columns=["game_id"])
        unmatched = pbp.select("game_id").unique().join(
            schedule_game_ids, on="game_id", how="anti"
        )
        unmatched_by_season[str(season)] = unmatched.height

    check["unmatched_game_ids_by_season"] = unmatched_by_season
    check["passed"] = all(count == 0 for count in unmatched_by_season.values())
    return check


def build_seahawks_smoke_checks(root: Path, seasons: list[int], team_focus: str) -> dict[str, Any]:
    rows = []
    top_plays = []
    for season in seasons:
        pbp_path = root / "raw" / "nflverse" / "pbp" / f"season={season}" / f"play_by_play_{season}.parquet"
        if not pbp_path.exists():
            continue
        df = pl.read_parquet(pbp_path)
        offense = df.filter(pl.col("posteam") == team_focus) if "posteam" in df.columns else pl.DataFrame()
        defense = df.filter(pl.col("defteam") == team_focus) if "defteam" in df.columns else pl.DataFrame()
        games = df.filter(
            (pl.col("home_team") == team_focus) | (pl.col("away_team") == team_focus)
        ) if {"home_team", "away_team"}.issubset(df.columns) else pl.DataFrame()
        postseason_games = games.filter(pl.col("season_type") == "POST") if "season_type" in games.columns else pl.DataFrame()

        rows.append(
            {
                "season": season,
                "offensive_plays": offense.height,
                "defensive_plays": defense.height,
                "games": games.select("game_id").n_unique() if "game_id" in games.columns else 0,
                "postseason_games": postseason_games.select("game_id").n_unique()
                if "game_id" in postseason_games.columns
                else 0,
                "offensive_epa_total": offense.select(pl.col("epa").sum()).item()
                if "epa" in offense.columns and offense.height > 0
                else None,
                "defensive_epa_allowed_total": defense.select(pl.col("epa").sum()).item()
                if "epa" in defense.columns and defense.height > 0
                else None,
            }
        )

        if {"posteam", "defteam", "wpa"}.issubset(df.columns):
            selected_columns = [
                column
                for column in ["season", "week", "game_id", "play_id", "posteam", "defteam", "wpa", "desc"]
                if column in df.columns
            ]
            top_plays.extend(
                df.filter((pl.col("posteam") == team_focus) | (pl.col("defteam") == team_focus))
                .sort("wpa", descending=True, nulls_last=True)
                .head(10)
                .select(selected_columns)
                .to_dicts()
            )

    top_plays = sorted(top_plays, key=lambda row: row.get("wpa") or float("-inf"), reverse=True)[:10]
    return {
        "name": "seahawks_smoke_checks",
        "passed": len(rows) == len(seasons) and all(row["offensive_plays"] > 0 and row["defensive_plays"] > 0 for row in rows),
        "team_focus": team_focus,
        "by_season": rows,
        "top_10_plays_by_wpa": top_plays,
    }


def validate_outputs(
    root: Path,
    seasons: list[int],
    team_focus: str,
    manifest_outputs: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    checks = [validate_pbp_file(root, season, team_focus) for season in seasons]
    checks.append(validate_game_join(root, seasons))
    checks.append(build_seahawks_smoke_checks(root, seasons, team_focus))
    checks.append(check_manifest_completeness(manifest_outputs or []))

    return {
        "validated_at_utc": utc_now_iso(),
        "seasons_expected": seasons,
        "team_focus": team_focus,
        "passed": all(check.get("passed", False) for check in checks),
        "checks": checks,
    }

