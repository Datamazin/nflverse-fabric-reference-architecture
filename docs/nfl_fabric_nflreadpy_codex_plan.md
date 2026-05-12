# NFL Analytics in Microsoft Fabric Using `nflreadpy`

**Purpose:** Codex implementation handoff for building a modern NFL analytics solution in Microsoft Fabric, Power BI, and Fabric Data Agent.

**Primary goal:** Acquire modern nflverse data with Python, land it in a Fabric Lakehouse, transform it into an efficient Bronze/Silver/Gold model, build a fast Power BI semantic model, and configure a Fabric Data Agent that can answer realistic Seattle Seahawks natural-language questions for the 1999–2025 seasons.

**Recommended source path:** Use `nflreadpy`, the modern Python package for downloading nflverse data.

**Team focus:** Seattle Seahawks (`SEA`), while retaining full-league data for rankings, league averages, opponent analysis, and comparison questions.

**Season range:** 1999 through 2025 inclusive.

**Current implementation status:** Full-league `nflreadpy` data for 1999 through 2025 has been acquired locally and imported into the Bronze schema of the Fabric Lakehouse.

---

## 1. Executive Recommendation

Use `nflreadpy` to acquire full-league nflverse data locally, write raw Parquet files to local storage, upload those files to a Microsoft Fabric Lakehouse, then transform them into curated Delta tables.

Do **not** build the Power BI semantic model or Fabric Data Agent directly on the raw play-by-play table. The raw play-by-play data is wide, contains multiple analytical concepts in one table, and includes many high-cardinality text and player-role fields. Instead, preserve the raw data in Bronze, create a cleaned Silver layer, and expose narrow Gold fact/dimension tables and aggregate tables to Power BI and the Data Agent.

Recommended end-state architecture:

```text
nflreadpy / nflverse-data
        ↓
Local raw Parquet export
        ↓
Fabric Lakehouse Files
        ↓
Bronze Delta tables
        ↓
Silver cleaned/conformed tables
        ↓
Gold star schema + aggregate tables
        ↓
Power BI semantic model
        ↓
Dashboards + Fabric Data Agent
```

High-level guidance:

1. Use `nflreadpy` for acquisition.
2. Fetch full-league data, not only Seattle rows.
3. Preserve raw files in Parquet.
4. Upload raw files into Fabric Lakehouse Files.
5. Convert files to Bronze Delta tables.
6. Build Silver cleaned tables with derived football flags.
7. Build Gold star-schema tables and aggregate facts.
8. Build a Power BI semantic model over Gold only.
9. Configure Prep for AI, AI Data Schema, AI Instructions, and Verified Answers.
10. Evaluate the Data Agent against a realistic Seahawks question suite.

---

## 2. Source and Tooling Rationale

### 2.1 Why `nflreadpy`

`nflreadpy` is the Python package for downloading NFL data from nflverse repositories. It is a Python port of `nflreadr`, uses Polars DataFrames, and supports caching and progress tracking.

Official docs describe it as:

> A Python package for downloading NFL data from nflverse repositories.

Relevant capabilities:

- Compatible API with the R `nflreadr` package.
- Fast data loading with Polars DataFrames.
- Filesystem or memory caching.
- Access to play-by-play, schedules, teams, players, rosters, weekly stats, and other nflverse datasets.

### 2.2 Why not `nfl_data_py`

The `nfl_data_py` repository now states that it has been deprecated in favor of `nflreadpy`, with future development occurring in `nflreadpy`. Therefore, use `nflreadpy` for new work.

### 2.3 Why full-league data

Even though the initial analytics focus is Seattle, many user questions require league context:

- Team rankings.
- League averages.
- Top-five/bottom-half comparisons.
- Opponent performance against Seattle.
- “Best/worst season” comparisons across teams.
- Defensive ranking where lower EPA allowed is better.

Therefore, fetch and retain the full league for 1999–2025.

---

## 3. Target Data Scope

### 3.1 Seasons

```text
Start season: 1999
End season:   2025
Inclusive:    yes
```

### 3.2 Game types

Retain both:

```text
Regular season
Postseason
```

Do not filter out postseason during acquisition. Handle regular/post filters in Silver, Gold, and the semantic model.

### 3.3 Team focus

```text
Team name: Seattle Seahawks
Team code: SEA
```

Use `SEA` only for validation summaries and default report/agent behavior. Do not filter acquisition to `SEA` only.

---

## 4. Datasets to Acquire

### 4.1 Required datasets

| Dataset | `nflreadpy` function | Required? | Purpose |
|---|---:|---:|---|
| Play-by-play | `load_pbp(seasons)` | Yes | EPA, WPA, success rate, down/distance, red zone, passing, rushing, defense, penalties, special teams, top plays |
| Schedules/games | `load_schedules(seasons)` | Yes | Game metadata, final score, home/away teams, week, game type, opponent context |
| Teams | `load_teams()` | Yes | Team dimension and team metadata |
| Players | `load_players()` | Yes | Player dimension and player IDs |
| Rosters | `load_rosters(seasons)` | Yes | Player-team-season mapping |
| Weekly rosters | `load_rosters_weekly(seasons)` | Recommended | Week-level player-team-position mapping |
| Weekly player stats | `load_player_stats(seasons, summary_level="week")` | Recommended | Player dashboards, validation, player-game/weekly aggregates |
| Weekly team stats | `load_team_stats(seasons, summary_level="week")` | Recommended | Team dashboards, validation, weekly aggregates |
| Season player stats, regular season | `load_player_stats(seasons, summary_level="reg")` | Optional useful | Fast player season leaderboards |
| Season player stats, postseason | `load_player_stats(seasons, summary_level="post")` | Optional useful | Fast postseason player summaries |
| Season team stats, regular season | `load_team_stats(seasons, summary_level="reg")` | Optional useful | Fast team season summaries |
| Season team stats, postseason | `load_team_stats(seasons, summary_level="post")` | Optional useful | Fast postseason team summaries |

### 4.2 Datasets intentionally excluded from MVP

Do not fetch these in the first implementation unless a later requirement calls for them:

- Next Gen Stats.
- FTN charting.
- Participation data.
- Injuries.
- Officials.
- Draft data.
- Contracts.
- Fantasy-specific opportunity models.

The Section 8 question suite can be answered with play-by-play, schedules, teams, players, rosters, and team/player stats.

---

## 5. Local Output Layout

Create this local directory structure:

```text
nflverse_local/
  README.md

  manifest/
    acquisition_manifest.json
    schema_manifest.json
    quality_report.json

  cache/
    nflreadpy/

  raw/
    nflverse/
      pbp/
        season=1999/
          play_by_play_1999.parquet
        season=2000/
          play_by_play_2000.parquet
        ...
        season=2025/
          play_by_play_2025.parquet

      schedules/
        schedules_1999_2025.parquet

      teams/
        teams.parquet

      players/
        players.parquet

      rosters/
        season=1999/
          rosters_1999.parquet
        ...
        season=2025/
          rosters_2025.parquet

      rosters_weekly/
        season=2002/
          rosters_weekly_2002.parquet
        ...
        season=2025/
          rosters_weekly_2025.parquet

      player_stats_weekly/
        season=1999/
          player_stats_weekly_1999.parquet
        ...
        season=2025/
          player_stats_weekly_2025.parquet

      team_stats_weekly/
        season=1999/
          team_stats_weekly_1999.parquet
        ...
        season=2025/
          team_stats_weekly_2025.parquet

      player_stats_season/
        summary_level=reg/
          player_stats_reg_1999_2025.parquet
        summary_level=post/
          player_stats_post_1999_2025.parquet

      team_stats_season/
        summary_level=reg/
          team_stats_reg_1999_2025.parquet
        summary_level=post/
          team_stats_post_1999_2025.parquet
```

Design principle: keep the local raw layer as close to source as possible. Do not drop columns from raw Parquet files. Weekly rosters begin in 2002 because that is the first season available from `nflreadpy`.

---

## 6. Local Acquisition Script Requirements

Create a Python script named:

```text
acquire_nflverse.py
```

### 6.1 CLI example

```bash
python acquire_nflverse.py \
  --start-season 1999 \
  --end-season 2025 \
  --out ./nflverse_local \
  --cache ./nflverse_local/cache/nflreadpy \
  --force
```

### 6.2 CLI arguments

| Argument | Default | Purpose |
|---|---:|---|
| `--start-season` | `1999` | First season to fetch |
| `--end-season` | `2025` | Last season to fetch |
| `--out` | `./nflverse_local` | Output root |
| `--cache` | `./nflverse_local/cache/nflreadpy` | `nflreadpy` cache directory |
| `--force` | `False` | Re-fetch and overwrite existing files |
| `--skip-optional` | `False` | Skip weekly/season stats if needed |
| `--compression` | `zstd` | Parquet compression |
| `--team-focus` | `SEA` | Used only for validation summaries |

### 6.3 Python environment

Recommended setup with `uv`:

```bash
uv init nfl-fabric-acquisition
uv add nflreadpy polars pyarrow
```

Alternative with `pip`:

```bash
python -m venv .venv
source .venv/bin/activate      # macOS/Linux
# .venv\Scripts\activate       # Windows
pip install nflreadpy polars pyarrow
```

### 6.4 Script responsibilities

The script must:

1. Configure `nflreadpy` filesystem caching.
2. Fetch all required datasets.
3. Write Parquet outputs using a stable folder convention.
4. Write an `acquisition_manifest.json`.
5. Write a `schema_manifest.json`.
6. Write a `quality_report.json`.
7. Log row counts and column counts.
8. Validate required columns.
9. Validate Seattle rows exist in each play-by-play season.
10. Validate play-by-play game IDs join to schedules.
11. Validate no out-of-range seasons are present.
12. Validate duplicate play keys are logged.
13. Use retries and useful error handling.
14. Avoid filtering raw acquisition to Seattle.

---

## 7. Codex Implementation Skeleton: `acquire_nflverse.py`

Codex should refine this skeleton into production-quality code.

```python
"""
acquire_nflverse.py

Fetch nflverse data with nflreadpy for local staging before Fabric upload.

Target:
- Seasons 1999 through 2025 inclusive
- Full league data, not only Seahawks
- Output raw Parquet files suitable for upload to Fabric Lakehouse
"""

from __future__ import annotations

import argparse
import json
import platform
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Iterable

import polars as pl
import nflreadpy as nfl
from nflreadpy.config import update_config


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Acquire nflverse data with nflreadpy.")
    parser.add_argument("--start-season", type=int, default=1999)
    parser.add_argument("--end-season", type=int, default=2025)
    parser.add_argument("--out", type=Path, default=Path("./nflverse_local"))
    parser.add_argument("--cache", type=Path, default=Path("./nflverse_local/cache/nflreadpy"))
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--skip-optional", action="store_true")
    parser.add_argument("--compression", type=str, default="zstd")
    parser.add_argument("--team-focus", type=str, default="SEA")
    return parser.parse_args()


def ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def write_parquet(
    df: pl.DataFrame,
    path: Path,
    *,
    compression: str = "zstd",
    force: bool = False,
) -> dict:
    ensure_dir(path.parent)

    if path.exists() and not force:
        existing = pl.read_parquet(path)
        return {
            "path": str(path),
            "status": "skipped_existing",
            "rows": existing.height,
            "columns": existing.width,
            "column_names": existing.columns,
        }

    df.write_parquet(path, compression=compression, statistics=True)

    return {
        "path": str(path),
        "status": "written",
        "rows": df.height,
        "columns": df.width,
        "column_names": df.columns,
    }


def fetch_pbp_by_season(
    seasons: Iterable[int],
    root: Path,
    compression: str,
    force: bool,
) -> list[dict]:
    results = []

    for season in seasons:
        df = nfl.load_pbp(season)
        path = root / "raw/nflverse/pbp" / f"season={season}" / f"play_by_play_{season}.parquet"
        result = write_parquet(df, path, compression=compression, force=force)
        result["dataset"] = "pbp"
        result["season"] = season
        results.append(result)

    return results


def fetch_partitioned_by_season(
    dataset_name: str,
    loader: Callable[[int], pl.DataFrame],
    seasons: Iterable[int],
    root: Path,
    compression: str,
    force: bool,
) -> list[dict]:
    results = []

    for season in seasons:
        df = loader(season)
        path = (
            root
            / "raw/nflverse"
            / dataset_name
            / f"season={season}"
            / f"{dataset_name}_{season}.parquet"
        )
        result = write_parquet(df, path, compression=compression, force=force)
        result["dataset"] = dataset_name
        result["season"] = season
        results.append(result)

    return results


def fetch_single_table(
    dataset_name: str,
    df: pl.DataFrame,
    root: Path,
    relative_path: str,
    compression: str,
    force: bool,
) -> dict:
    path = root / relative_path
    result = write_parquet(df, path, compression=compression, force=force)
    result["dataset"] = dataset_name
    return result


def build_schema_manifest(outputs: list[dict]) -> dict:
    return {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
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


def validate_outputs(root: Path, seasons: list[int], team_focus: str) -> dict:
    quality = {
        "validated_at_utc": datetime.now(timezone.utc).isoformat(),
        "seasons_expected": seasons,
        "team_focus": team_focus,
        "checks": [],
    }

    pbp_required_cols = [
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

    for season in seasons:
        path = root / "raw/nflverse/pbp" / f"season={season}" / f"play_by_play_{season}.parquet"
        check = {
            "name": f"pbp_exists_and_valid_{season}",
            "path": str(path),
            "passed": path.exists(),
        }

        if path.exists():
            df = pl.read_parquet(path)
            missing = [c for c in pbp_required_cols if c not in df.columns]

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
                if out_of_range > 0:
                    check["passed"] = False

            if "posteam" in df.columns and "defteam" in df.columns:
                team_rows = df.filter(
                    (pl.col("posteam") == team_focus) | (pl.col("defteam") == team_focus)
                ).height
                check["team_focus_rows"] = team_rows
                check["team_focus_present"] = team_rows > 0
                if team_rows == 0:
                    check["passed"] = False

            if "game_id" in df.columns and "play_id" in df.columns:
                duplicate_keys = (
                    df.group_by(["game_id", "play_id"])
                    .len()
                    .filter(pl.col("len") > 1)
                    .height
                )
                check["duplicate_game_id_play_id_count"] = duplicate_keys

        quality["checks"].append(check)

    return quality


def main() -> None:
    args = parse_args()
    seasons = list(range(args.start_season, args.end_season + 1))

    ensure_dir(args.out)
    ensure_dir(args.cache)
    ensure_dir(args.out / "manifest")

    update_config(
        cache_mode="filesystem",
        cache_dir=str(args.cache),
        verbose=True,
        timeout=120,
        user_agent="fabric-nfl-analytics-local-acquisition",
    )

    manifest = {
        "fetched_at_utc": datetime.now(timezone.utc).isoformat(),
        "python_version": platform.python_version(),
        "platform": platform.platform(),
        "seasons": seasons,
        "team_focus": args.team_focus,
        "outputs": [],
    }

    # Required: play-by-play by season
    manifest["outputs"].extend(
        fetch_pbp_by_season(seasons, args.out, args.compression, args.force)
    )

    # Required: schedules, teams, players
    schedules = nfl.load_schedules(seasons)
    manifest["outputs"].append(
        fetch_single_table(
            "schedules",
            schedules,
            args.out,
            f"raw/nflverse/schedules/schedules_{args.start_season}_{args.end_season}.parquet",
            args.compression,
            args.force,
        )
    )

    teams = nfl.load_teams()
    manifest["outputs"].append(
        fetch_single_table(
            "teams",
            teams,
            args.out,
            "raw/nflverse/teams/teams.parquet",
            args.compression,
            args.force,
        )
    )

    players = nfl.load_players()
    manifest["outputs"].append(
        fetch_single_table(
            "players",
            players,
            args.out,
            "raw/nflverse/players/players.parquet",
            args.compression,
            args.force,
        )
    )

    # Required/recommended: rosters
    manifest["outputs"].extend(
        fetch_partitioned_by_season(
            "rosters",
            nfl.load_rosters,
            seasons,
            args.out,
            args.compression,
            args.force,
        )
    )

    manifest["outputs"].extend(
        fetch_partitioned_by_season(
            "rosters_weekly",
            nfl.load_rosters_weekly,
            seasons,
            args.out,
            args.compression,
            args.force,
        )
    )

    # Optional validation/convenience stats
    if not args.skip_optional:
        manifest["outputs"].extend(
            fetch_partitioned_by_season(
                "player_stats_weekly",
                lambda season: nfl.load_player_stats(season, summary_level="week"),
                seasons,
                args.out,
                args.compression,
                args.force,
            )
        )

        manifest["outputs"].extend(
            fetch_partitioned_by_season(
                "team_stats_weekly",
                lambda season: nfl.load_team_stats(season, summary_level="week"),
                seasons,
                args.out,
                args.compression,
                args.force,
            )
        )

        for level in ["reg", "post"]:
            player_stats = nfl.load_player_stats(seasons, summary_level=level)
            manifest["outputs"].append(
                fetch_single_table(
                    f"player_stats_{level}",
                    player_stats,
                    args.out,
                    f"raw/nflverse/player_stats_season/summary_level={level}/player_stats_{level}_{args.start_season}_{args.end_season}.parquet",
                    args.compression,
                    args.force,
                )
            )

            team_stats = nfl.load_team_stats(seasons, summary_level=level)
            manifest["outputs"].append(
                fetch_single_table(
                    f"team_stats_{level}",
                    team_stats,
                    args.out,
                    f"raw/nflverse/team_stats_season/summary_level={level}/team_stats_{level}_{args.start_season}_{args.end_season}.parquet",
                    args.compression,
                    args.force,
                )
            )

    schema_manifest = build_schema_manifest(manifest["outputs"])
    quality_report = validate_outputs(args.out, seasons, args.team_focus)

    with open(args.out / "manifest/acquisition_manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    with open(args.out / "manifest/schema_manifest.json", "w", encoding="utf-8") as f:
        json.dump(schema_manifest, f, indent=2)

    with open(args.out / "manifest/quality_report.json", "w", encoding="utf-8") as f:
        json.dump(quality_report, f, indent=2)

    print(json.dumps(quality_report, indent=2))


if __name__ == "__main__":
    main()
```

---

## 8. Required Local Data Quality Checks

Before uploading to Fabric, validate these checks.

| Check | Rule |
|---|---|
| Season coverage | Every season from 1999 through 2025 has a PBP Parquet file |
| Row count | Every PBP season has more than zero rows |
| Core columns | PBP contains `season`, `season_type`, `week`, `game_id`, `play_id`, `home_team`, `away_team`, `posteam`, `defteam`, `play_type`, `epa`, `wpa` |
| Valid seasons | No PBP rows outside the expected season partition |
| Team presence | Seattle rows exist where `posteam = "SEA"` or `defteam = "SEA"` |
| Duplicate play key | `(game_id, play_id)` duplicates are logged and investigated |
| Game join | Every PBP `game_id` should join to schedules |
| Valid game types | Review `season_type` values; retain regular season and postseason |
| Player ID coverage | Passer/rusher/receiver IDs should join to players or rosters where available |
| Manifest completeness | Every written file has path, dataset, row count, column count, and columns |

### 8.1 Seahawks smoke checks

Add these to `quality_report.json`:

```text
Number of Seahawks offensive plays by season
Number of Seahawks defensive plays by season
Number of Seahawks games by season
Number of Seahawks postseason games by season
Seattle offensive EPA total by season
Seattle defensive EPA allowed total by season
Seattle top 10 plays by WPA, all seasons
```

These are sanity checks, not final governed business metrics.

---

## 9. Upload to Fabric Lakehouse

Upload the full local folder below into Fabric Lakehouse Files:

```text
nflverse_local/raw/nflverse/
```

Recommended Fabric file layout:

```text
Lakehouse
  Files/
    raw/
      nflverse/
        pbp/
        schedules/
        teams/
        players/
        rosters/
        rosters_weekly/
        player_stats_weekly/
        team_stats_weekly/
        player_stats_season/
        team_stats_season/
    manifest/
      acquisition_manifest.json
      schema_manifest.json
      quality_report.json
```

Important: Lakehouse files alone are not the right Data Agent target. Convert uploaded Parquet files into Delta tables and expose curated tables to the semantic model and Data Agent.

---

## 10. Fabric Lakehouse Transformation Plan

Use a Bronze/Silver/Gold pattern.

### 10.1 Bronze layer

Bronze should be source-preserving.

Create these tables:

```text
bronze_nflverse_pbp
bronze_nflverse_schedules
bronze_nflverse_teams
bronze_nflverse_players
bronze_nflverse_rosters
bronze_nflverse_rosters_weekly
bronze_nflverse_player_stats_weekly
bronze_nflverse_team_stats_weekly
bronze_nflverse_player_stats_reg
bronze_nflverse_player_stats_post
bronze_nflverse_team_stats_reg
bronze_nflverse_team_stats_post
```

Bronze transformations should be minimal:

- Read Parquet files from Lakehouse Files.
- Write Delta tables.
- Preserve source columns.
- Add ingestion timestamp.
- Add source file path if available.
- Add acquisition batch ID.
- Validate row counts against the local manifest.

### 10.2 Silver layer

Silver should be cleaned, typed, standardized, and conformed.

Create these tables:

```text
silver_play_by_play
silver_games
silver_teams
silver_players
silver_rosters_season
silver_rosters_weekly
silver_player_stats_weekly
silver_team_stats_weekly
```

Silver goals:

- Standardize team codes.
- Standardize season and week fields.
- Standardize player IDs and player names.
- Convert 0/1 flags into booleans where appropriate.
- Normalize null values.
- Create stable keys.
- Add football-specific derived flags.
- Keep raw play description (`desc`) in Silver for play-finder use, but do not expose it widely in the main semantic model.

### 10.3 Silver play-by-play derived columns

Create at least these columns in `silver_play_by_play`:

| Column | Definition |
|---|---|
| `play_key` | Stable key derived from `game_id` and `play_id` |
| `game_key` | `game_id` |
| `season_week_key` | Stable key from `season` and `week` |
| `offense_team_key` | `posteam` |
| `defense_team_key` | `defteam` |
| `is_seahawks_play` | `posteam = "SEA"` or `defteam = "SEA"` |
| `is_seahawks_offense` | `posteam = "SEA"` |
| `is_seahawks_defense` | `defteam = "SEA"` |
| `is_regular_season` | `season_type = "REG"` |
| `is_postseason` | `season_type = "POST"` |
| `is_offensive_play` | dropback or rush attempt, excluding kneels/spikes where possible |
| `is_dropback` | `qb_dropback = 1` when available |
| `is_pass_attempt_play` | pass attempt or sack/dropback depending on final metric definition |
| `is_rush_play` | rush attempt, excluding kneels |
| `is_designed_rush` | rush attempt excluding QB scrambles and kneels |
| `is_qb_scramble` | `qb_scramble = 1` if present |
| `is_red_zone` | `yardline_100 <= 20` |
| `is_goal_to_go` | source `goal_to_go = 1` or derived from context |
| `is_goal_line` | `yardline_100 <= 5` |
| `is_third_down` | `down = 3` |
| `is_fourth_down` | `down = 4` |
| `is_early_down` | `down in (1, 2)` |
| `is_late_half` | `quarter_seconds_remaining <= 120` |
| `is_one_score_state` | absolute pre-play score differential <= 8 |
| `is_successful_play` | source `success` if present; otherwise `epa > 0` |
| `is_explosive_pass` | dropback/pass and `yards_gained >= 20` |
| `is_explosive_rush` | rush and `yards_gained >= 10` |
| `field_zone` | own territory, midfield, opponent territory, red zone, goal line |
| `score_state` | tied, leading, trailing, one-score leading, one-score trailing |
| `time_context` | quarter/half/late-half/two-minute style grouping |
| `down_distance_bucket` | short/medium/long grouping based on down and yards to go |

### 10.4 Recommended field zone definitions

Use these defaults unless the business chooses alternatives:

| Field zone | Definition using `yardline_100` |
|---|---|
| Own territory | `yardline_100 >= 60` |
| Midfield | `yardline_100 between 41 and 59` |
| Opponent territory | `yardline_100 between 21 and 40` |
| Red zone | `yardline_100 between 6 and 20` |
| Goal line | `yardline_100 <= 5` |

### 10.5 Recommended down-distance bucket definitions

| Bucket | Definition |
|---|---|
| 1st down | `down = 1` |
| 2nd short | `down = 2 and ydstogo <= 3` |
| 2nd medium | `down = 2 and ydstogo between 4 and 6` |
| 2nd long | `down = 2 and ydstogo >= 7` |
| 3rd/4th short | `down in (3,4) and ydstogo <= 3` |
| 3rd/4th medium | `down in (3,4) and ydstogo between 4 and 6` |
| 3rd/4th long | `down in (3,4) and ydstogo >= 7` |

---

## 11. Gold Semantic Model Design

Build Gold tables specifically for Power BI semantic modeling and Fabric Data Agent use.

Microsoft recommends star-schema design for Power BI semantic models because dimensions support filtering/grouping and facts support summarization. Avoid mixing facts and dimensions into a single table.

### 11.1 Gold dimensions

Create:

```text
gold_dim_team
gold_dim_game
gold_dim_season_week
gold_dim_player
gold_dim_play_type
gold_dim_down_distance
gold_dim_field_zone
gold_dim_score_state
gold_dim_time_context
```

### 11.2 Gold fact tables

Create:

```text
gold_fact_play_core
gold_fact_team_play
gold_fact_pass_play
gold_fact_rush_play
gold_fact_player_play_role
gold_fact_drive
gold_fact_penalty
gold_fact_special_teams_play
```

### 11.3 Gold aggregate tables

Create:

```text
gold_agg_team_game
gold_agg_team_season
gold_agg_player_game
gold_agg_player_season
gold_agg_team_situation
gold_agg_player_situation
gold_agg_seahawks_game_summary
gold_agg_seahawks_season_summary
```

Aggregate tables are critical for dashboard speed and Data Agent reliability. Most common questions should not need to scan play-level data.

---

## 12. Key Gold Table: `gold_fact_team_play`

This is the most important table for avoiding offense/defense ambiguity.

Raw play-by-play has one play row with `posteam` and `defteam`. Natural language questions often ask from a team perspective:

- How good was Seattle’s offense?
- How good was Seattle’s defense?
- How much EPA did Seattle allow?
- Which opposing QBs generated the most EPA against Seattle?

Create a team-perspective fact that makes this explicit.

### 12.1 Recommended grain

One row per play per team perspective.

For each qualifying offensive play:

- Offense perspective row.
- Defense perspective row.

Example:

| play_key | team_key | opponent_team_key | unit | epa | epa_allowed | wpa | yards | is_offense | is_defense |
|---|---|---|---|---:|---:|---:|---:|---:|---:|
| game1_50 | SEA | SF | Offense | 0.42 | null | 0.01 | 7 | 1 | 0 |
| game1_50 | SF | SEA | Defense | -0.42 | 0.42 | -0.01 | -7 | 0 | 1 |

### 12.2 Metric semantics

Use these definitions:

```text
Offensive EPA = source epa where team_key = posteam
Defensive EPA Allowed = source epa where team_key = defteam
Defensive EPA Generated = -source epa where team_key = defteam
EPA Differential = Offensive EPA - Defensive EPA Allowed
EPA Differential = Offensive EPA + Defensive EPA Generated
```

Interpretation:

```text
Higher Offensive EPA is better.
Lower Defensive EPA Allowed is better.
Higher Defensive EPA Generated is better.
Higher EPA Differential is better.
```

This table will make DAX measures simpler and Data Agent answers much more reliable.

---

## 13. Other Gold Fact Tables

### 13.1 `gold_fact_play_core`

Grain: one row per play.

Purpose:

- Top plays by WPA.
- Win probability timeline.
- Play finder.
- Game-flow analysis.
- Detailed drill-through.

Suggested columns:

```text
play_key
game_key
season
week
season_type
play_id
qtr
down
ydstogo
yardline_100
game_seconds_remaining
quarter_seconds_remaining
posteam
defteam
play_type
yards_gained
epa
wpa
wp
home_wp
away_wp
score_differential
total_home_score
total_away_score
is_red_zone
is_goal_line
is_third_down
is_fourth_down
is_explosive_pass
is_explosive_rush
desc
```

Keep `desc` in this detail fact but hide it from the main semantic model unless used in a play-finder page.

### 13.2 `gold_fact_pass_play`

Grain: one row per dropback/pass play.

Purpose:

- QB EPA/dropback.
- Receiver targets.
- Deep passing.
- Air yards and YAC.
- Sacks and interceptions.
- Passing offense/defense.

Suggested columns:

```text
play_key
game_key
season
week
offense_team_key
defense_team_key
passer_player_key
receiver_player_key
pass_length
pass_location
air_yards
yards_after_catch
yards_gained
epa
wpa
is_complete
is_interception
is_sack
is_qb_scramble
is_deep_pass
is_shotgun
is_no_huddle
```

### 13.3 `gold_fact_rush_play`

Grain: one row per rushing play.

Purpose:

- Rushing EPA/play.
- Designed runs vs QB scrambles.
- Run direction/gap analysis.
- Running back usage.

Suggested columns:

```text
play_key
game_key
season
week
offense_team_key
defense_team_key
rusher_player_key
run_location
run_gap
yards_gained
epa
wpa
is_designed_rush
is_qb_scramble
is_kneel
is_explosive_rush
```

### 13.4 `gold_fact_player_play_role`

Grain: one row per player-role-play.

Purpose:

Normalize wide player-role columns into a narrow structure.

Example roles:

```text
passer
receiver
rusher
kicker
punter
punt_returner
kickoff_returner
interceptor
solo_tackler
assist_tackler
qb_hit_player
forced_fumble_player
fumble_recovery_player
penalty_player
```

Suggested columns:

```text
play_key
game_key
season
week
team_key
opponent_team_key
player_key
player_role
role_sequence
player_name_snapshot
```

### 13.5 `gold_fact_penalty`

Grain: one row per penalty.

Purpose:

- Penalty count.
- Penalty yards.
- Penalty type impact.
- Seattle discipline questions.

Suggested columns:

```text
play_key
game_key
season
week
penalty_team_key
opponent_team_key
penalty_player_key
penalty_type
penalty_yards
epa
wpa
is_accepted_penalty
```

### 13.6 `gold_fact_special_teams_play`

Grain: one row per special teams play.

Purpose:

- Field goals.
- Punts.
- Kickoffs.
- Returns.
- Special teams WPA.

Suggested columns:

```text
play_key
game_key
season
week
team_key
opponent_team_key
special_teams_type
kicker_player_key
punter_player_key
returner_player_key
kick_distance
return_yards
field_goal_result
extra_point_result
touchback
punt_inside_twenty
epa
wpa
```

---

## 14. Gold Aggregate Tables

### 14.1 `gold_agg_team_season`

Grain: one row per team-season-season_type.

Metrics:

```text
team_key
season
season_type
games
wins
losses
ties
points_for
points_against
point_differential
offensive_plays
defensive_plays
offensive_epa
offensive_epa_per_play
defensive_epa_allowed
defensive_epa_allowed_per_play
defensive_epa_generated
defensive_epa_generated_per_play
epa_differential
epa_differential_per_play
success_rate
defensive_success_rate_allowed
pass_rate
dropbacks
rushes
dropback_epa_per_play
rush_epa_per_play
explosive_play_rate
turnovers
takeaways
penalty_count
penalty_yards
third_down_conversion_rate
fourth_down_conversion_rate
red_zone_epa_per_play
```

### 14.2 `gold_agg_team_game`

Grain: one row per team-game.

Metrics:

```text
team_key
game_key
season
week
season_type
opponent_team_key
home_away
team_score
opponent_score
game_result
offensive_plays
defensive_plays
offensive_epa
defensive_epa_allowed
defensive_epa_generated
epa_differential
success_rate
pass_rate
dropback_epa_per_play
rush_epa_per_play
wpa_total
turnovers
takeaways
penalty_count
penalty_yards
```

### 14.3 `gold_agg_player_season`

Grain: one row per player-team-season-season_type.

Metrics depend on player role:

```text
player_key
team_key
season
season_type
position
games
passing_dropbacks
passing_epa
passing_epa_per_dropback
attempts
completions
passing_yards
passing_tds
interceptions
sacks
rushing_attempts
rushing_yards
rushing_epa
rushing_epa_per_play
targets
receptions
receiving_yards
receiving_epa
receiving_epa_per_target
tackles
qb_hits
sacks_defense
forced_fumbles
interceptions_defense
```

### 14.4 `gold_agg_team_situation`

Grain: team-season-situation.

Useful situation dimensions:

```text
season
season_type
team_key
unit
field_zone
down_distance_bucket
score_state
time_context
play_type_group
```

Metrics:

```text
plays
epa
epa_per_play
success_rate
pass_rate
conversion_rate
explosive_play_rate
```

This table will support many Data Agent questions without scanning play-level facts.

---

## 15. Power BI Semantic Model Plan

Use the Gold tables only.

### 15.1 Storage mode recommendation

For 1999–2025 NFL data, the model should be small enough for Import mode or Direct Lake over materialized Gold Delta tables.

Recommendation:

1. Start with Import mode for simplest high performance, or
2. Use Direct Lake over Gold Delta tables if the project requires a Fabric-native Direct Lake model.

Avoid Direct Lake over non-materialized SQL views. In Direct Lake on SQL scenarios, SQL views can trigger DirectQuery fallback, which can reduce performance.

### 15.2 Relationship design

Recommended relationships:

```text
gold_dim_team[team_key] 1-* gold_fact_team_play[team_key]
gold_dim_team[team_key] 1-* gold_fact_team_play[opponent_team_key]

gold_dim_game[game_key] 1-* gold_fact_play_core[game_key]
gold_dim_game[game_key] 1-* gold_fact_team_play[game_key]

gold_dim_player[player_key] 1-* gold_fact_player_play_role[player_key]

gold_dim_season_week[season_week_key] 1-* gold_fact_team_play[season_week_key]
gold_dim_play_type[play_type_key] 1-* gold_fact_play_core[play_type_key]
gold_dim_field_zone[field_zone_key] 1-* gold_fact_play_core[field_zone_key]
gold_dim_score_state[score_state_key] 1-* gold_fact_play_core[score_state_key]
gold_dim_time_context[time_context_key] 1-* gold_fact_play_core[time_context_key]
```

Use single-direction filtering unless there is a strong reason to do otherwise.

### 15.3 Semantic-model naming

Use business-friendly names:

| Raw/source term | Semantic model name |
|---|---|
| `posteam` | Possession Team / Offensive Team |
| `defteam` | Defensive Team |
| `yardline_100` | Yards From Opponent End Zone |
| `ydstogo` | Yards To Go |
| `qtr` | Quarter |
| `epa` | Expected Points Added |
| `wpa` | Win Probability Added |
| `wp` | Win Probability |
| `desc` | Play Description |

Hide technical keys unless needed by developers.

### 15.4 Core DAX measure families

Create explicit measures only. Avoid relying on implicit measures.

Recommended measures:

```text
Play Count
Offensive Plays
Defensive Plays
EPA
EPA per Play
Offensive EPA
Offensive EPA per Play
Defensive EPA Allowed
Defensive EPA Allowed per Play
Defensive EPA Generated
Defensive EPA Generated per Play
EPA Differential
EPA Differential per Play
WPA
WPA per Play
Success Rate
Pass Rate
Dropback EPA per Play
Rush EPA per Play
Explosive Plays
Explosive Play Rate
Third Down Attempts
Third Down Conversions
Third Down Conversion Rate
Fourth Down Attempts
Fourth Down Conversions
Fourth Down Conversion Rate
Red Zone Plays
Red Zone EPA per Play
Goal-to-Go EPA per Play
Turnovers
Takeaways
Sacks
QB Hits
Penalty Count
Penalty Yards
Field Goal Attempts
Field Goal Made Rate
```

### 15.5 Example DAX patterns

These are conceptual examples. Codex should adjust table/column names to the final model.

```DAX
Play Count :=
COUNTROWS ( 'Fact Team Play' )
```

```DAX
Offensive Plays :=
CALCULATE (
    [Play Count],
    'Fact Team Play'[Unit] = "Offense"
)
```

```DAX
Offensive EPA :=
CALCULATE (
    SUM ( 'Fact Team Play'[EPA] ),
    'Fact Team Play'[Unit] = "Offense"
)
```

```DAX
Offensive EPA per Play :=
DIVIDE ( [Offensive EPA], [Offensive Plays] )
```

```DAX
Defensive EPA Allowed :=
CALCULATE (
    SUM ( 'Fact Team Play'[EPA Allowed] ),
    'Fact Team Play'[Unit] = "Defense"
)
```

```DAX
Defensive EPA Allowed per Play :=
DIVIDE ( [Defensive EPA Allowed], [Defensive Plays] )
```

```DAX
Defensive EPA Generated :=
- [Defensive EPA Allowed]
```

```DAX
EPA Differential :=
[Offensive EPA] - [Defensive EPA Allowed]
```

```DAX
EPA Differential per Play :=
DIVIDE ( [EPA Differential], [Offensive Plays] )
```

```DAX
Success Rate :=
DIVIDE (
    SUM ( 'Fact Team Play'[Successful Play Count] ),
    [Offensive Plays]
)
```

```DAX
Pass Rate :=
DIVIDE (
    SUM ( 'Fact Team Play'[Pass Play Count] ),
    SUM ( 'Fact Team Play'[Pass Play Count] ) + SUM ( 'Fact Team Play'[Rush Play Count] )
)
```

---

## 16. Data Agent Design

Use the Power BI semantic model as the primary Data Agent source.

Optional second source:

```text
A curated Lakehouse/Warehouse detail table for play-finder queries.
```

Do not expose the raw 300+ column PBP table as the primary Data Agent source.

### 16.1 Semantic model preparation

Configure the semantic model using Prep for AI:

1. AI Data Schema.
2. AI Instructions.
3. Verified Answers.
4. Synonyms.
5. Business-friendly names.
6. Measure and column descriptions.

For semantic-model-backed Data Agent answers, Prep for AI matters more than Data Agent-level prose instructions.

### 16.2 AI Data Schema

Expose only curated tables, columns, and measures relevant to the supported question set.

Include:

```text
gold_dim_team
gold_dim_game
gold_dim_season_week
gold_dim_player
gold_dim_play_type
gold_dim_field_zone
gold_dim_score_state
gold_agg_team_season
gold_agg_team_game
gold_agg_player_season
gold_agg_team_situation
gold_fact_team_play
gold_fact_play_core, limited columns only
gold_fact_pass_play
gold_fact_rush_play
gold_fact_penalty
gold_fact_special_teams_play
```

Hide or exclude:

```text
Raw IDs not needed by users
Intermediate technical fields
High-cardinality free text except in play-finder context
Duplicate raw columns that conflict with governed measures
Unneeded Bronze/Silver tables
```

### 16.3 Synonyms

Add synonyms:

| User phrase | Model term |
|---|---|
| Seahawks | SEA |
| Seattle | SEA |
| Hawks | SEA, if desired |
| EPA | Expected Points Added |
| expected points | Expected Points Added |
| WPA | Win Probability Added |
| win probability swing | Win Probability Added |
| dropback | Passing dropback |
| passing play | Dropback |
| red zone | Inside opponent 20 |
| goal line | Inside opponent 5 |
| one-score game | Score differential <= 8 |
| defense | Defensive unit |
| offense | Offensive unit |

### 16.4 AI Instructions

Add instructions like these in Prep for AI:

```text
When a user asks about Seattle, Seahawks, or SEA, filter Team Code to SEA.

When a user asks for team offense, use Offensive EPA per Play unless the user specifies yards, points, success rate, or another metric.

When a user asks for team defense, use Defensive EPA Allowed per Play ascending or Defensive EPA Generated per Play descending.

When a user asks for passing offense, use dropbacks, not only official pass attempts. Dropbacks include pass attempts, sacks, and QB scrambles when qb_dropback is available.

When a user asks for rushing offense, exclude kneels unless the user explicitly asks for all rushing attempts.

When a user asks for red zone, filter plays where Yards From Opponent End Zone is less than or equal to 20.

When a user asks for one-score situations, use pre-play absolute score differential less than or equal to 8.

When a user asks for best defense, lower Defensive EPA Allowed per Play is better.

When a user asks for EPA differential, use Offensive EPA minus Defensive EPA Allowed, or equivalently Offensive EPA plus Defensive EPA Generated.

When a user asks for seasons, use NFL season values, not calendar year values.

When a user asks for rankings, rank all qualifying NFL teams for the requested season or season range unless the user explicitly asks only for Seattle.
```

### 16.5 Verified Answers to build first

Create Verified Answers for these questions:

```text
1. How did the Seahawks rank in offensive EPA per play each season from 1999 through 2025?
2. How did the Seahawks rank in defensive EPA allowed per play each season from 1999 through 2025?
3. Show Seattle’s EPA differential per play by season from 1999 to 2025.
4. Which Seahawks season had the best offense by EPA per play?
5. Which Seahawks season had the best defense by EPA allowed per play?
6. Compare Seattle’s offensive EPA per play to league average by season.
7. What was Russell Wilson’s EPA per dropback by season from 2012 to 2021 while with Seattle?
8. Which Seahawks receivers had the most targets by season?
9. How did Seattle’s rushing EPA per play rank by season?
10. What was Seattle’s third-down conversion rate by season?
11. How did Seattle perform in the red zone by season?
12. Which opposing quarterbacks generated the most EPA against Seattle?
13. Which Seahawks games had the largest positive WPA swing?
14. What were Seattle’s top 10 plays by WPA from 1999 to 2025?
15. How many accepted penalties did Seattle commit by season?
```

For each Verified Answer, include multiple trigger phrasings.

---

## 17. Realistic Seahawks Natural-Language Question Suite

Use this as the initial Data Agent and semantic model evaluation suite.

### 17.1 Team performance and trends

1. How did the Seahawks rank in offensive EPA per play each season from 1999 through 2025?
2. How did the Seahawks rank in defensive EPA allowed per play each season from 1999 through 2025?
3. Show Seattle’s EPA differential per play by season from 1999 to 2025.
4. Which Seahawks season from 1999 to 2025 had the best offense by EPA per play?
5. Which Seahawks season from 1999 to 2025 had the best defense by EPA allowed per play?
6. Compare Seattle’s offensive EPA per play to the league average for each season from 1999 to 2025.
7. Compare Seattle’s defensive EPA allowed per play to the league average for each season from 1999 to 2025.
8. In which seasons did Seattle finish top 5 in defensive EPA allowed per play?
9. In which seasons did Seattle finish bottom half of the league in offensive success rate?
10. Show Seattle’s win-loss record, point differential, EPA differential, and success-rate differential by season.

### 17.2 Passing offense

11. Who led the Seahawks in passing EPA in each season from 1999 to 2025?
12. What was Russell Wilson’s EPA per dropback by season from 2012 to 2021 while with Seattle?
13. How did Seattle’s pass rate change from 2012 through 2021?
14. How did Seattle perform on early-down passes compared with early-down runs from 2012 to 2021?
15. Which Seahawks receivers had the most targets by season?
16. Which Seahawks receivers had the highest receiving EPA per target, minimum 50 targets?
17. Show Seattle’s deep passing EPA by season, where deep pass means air yards of 20 or more.
18. How often did Seattle use shotgun on pass plays by season?
19. What was Seattle’s EPA per play on no-huddle plays from 1999 to 2025?
20. Which games had Russell Wilson’s highest WPA added from 2012 to 2021 while with Seattle?

### 17.3 Rushing offense

21. How did Seattle’s rushing EPA per play rank by season from 1999 to 2025?
22. Which Seahawks running backs had the most rushing attempts by season?
23. Which Seahawks running backs had the highest rushing success rate, minimum 100 carries?
24. Compare Seattle’s designed runs versus QB scrambles by EPA per play from 2012 to 2021.
25. How did Seattle perform on runs up the middle versus outside runs?
26. What was Seattle’s rushing EPA per play in the red zone by season?
27. How often did Seattle run on 2nd-and-short, and how successful was it?
28. Which Seahawks games had the most rushing EPA?

### 17.4 Situational football

29. What was Seattle’s EPA per play on third down by season?
30. What was Seattle’s third-down conversion rate by season?
31. What was Seattle’s EPA per play on fourth down by season?
32. How often did Seattle go for it on fourth down from 1999 to 2025?
33. What was Seattle’s fourth-down conversion rate when going for it?
34. How did Seattle perform in the red zone by season?
35. How did Seattle perform in goal-to-go situations by season?
36. What was Seattle’s offensive EPA per play in one-score games?
37. What was Seattle’s defensive EPA allowed per play in one-score games?
38. How did Seattle perform in the final two minutes of each half?
39. What was Seattle’s EPA per play when trailing by 8 or fewer points?
40. What was Seattle’s EPA per play when leading by 8 or fewer points?

### 17.5 Defensive analysis

41. Which opposing quarterbacks generated the most EPA against Seattle from 1999 to 2025?
42. Which seasons did Seattle allow the lowest passing EPA per dropback?
43. Which seasons did Seattle allow the lowest rushing EPA per play?
44. How many sacks and QB hits did Seattle generate by season?
45. What was Seattle’s defensive success rate by season?
46. Which games had Seattle’s best defensive EPA performance?
47. Which games had Seattle’s worst defensive EPA performance?
48. How did Seattle perform defensively in the red zone?
49. How often did Seattle force turnovers by season?
50. Which opponents had the most turnovers against Seattle?

### 17.6 Game flow and win probability

51. Show the win probability timeline for the Seahawks’ biggest comeback win from 1999 to 2025.
52. Which Seahawks games had the largest positive WPA swing?
53. Which Seahawks games had the largest negative WPA swing?
54. What were Seattle’s top 10 plays by WPA from 1999 to 2025?
55. What were Seattle’s bottom 10 plays by WPA from 1999 to 2025?
56. For each playoff game involving Seattle, show final score, EPA differential, and top WPA play.
57. Which Seahawks games had the highest total combined EPA volatility?
58. Which games did Seattle win despite losing the EPA differential?
59. Which games did Seattle lose despite winning the EPA differential?
60. Show the most important fourth-quarter plays by WPA for Seattle from 1999 to 2025.

### 17.7 Special teams, penalties, and discipline

61. How many accepted penalties did Seattle commit by season?
62. How many penalty yards did Seattle commit by season?
63. Which penalty types hurt Seattle the most by EPA or WPA?
64. How did Seattle’s field goal success rate vary by season?
65. What was Seattle’s punt EPA or net punt impact by season?
66. How often did Seattle start drives with favorable field position?
67. Which Seahawks games had the worst penalty impact?
68. Which Seahawks games had the best special teams WPA?

### 17.8 Agent stress-test questions

69. Was Seattle better on offense or defense in 2013?
70. What changed more from 2013 to 2014 for Seattle: offensive EPA/play or defensive EPA allowed/play?
71. Did Seattle rely more on rushing or passing in 2013 compared with league average?
72. Which Seahawks season looks most similar to 2013 based on EPA differential and pass rate?
73. Show me the top Seahawks players by total EPA in 2015.
74. Why did Seattle lose games in 2017: offense, defense, turnovers, or penalties?
75. Which Seattle playoff game had the biggest single-play WPA swing?

---

## 18. Question Coverage Map

| Question group | Required source | Gold tables |
|---|---|---|
| Team performance and trends | PBP, schedules, teams | `gold_agg_team_season`, `gold_agg_team_game`, `gold_fact_team_play` |
| Passing offense | PBP, players, rosters | `gold_fact_pass_play`, `gold_fact_player_play_role`, `gold_agg_player_season` |
| Rushing offense | PBP, players, rosters | `gold_fact_rush_play`, `gold_agg_player_season`, `gold_agg_team_situation` |
| Situational football | PBP | `gold_fact_team_play`, `gold_agg_team_situation`, dimensions for down/distance/field zone |
| Defensive analysis | PBP, schedules, players | `gold_fact_team_play`, `gold_fact_pass_play`, `gold_agg_team_game` |
| Game flow and win probability | PBP, schedules | `gold_fact_play_core`, `gold_fact_team_play`, `gold_agg_seahawks_game_summary` |
| Special teams | PBP | `gold_fact_special_teams_play`, `gold_agg_team_game` |
| Penalties | PBP | `gold_fact_penalty`, `gold_agg_team_game`, `gold_agg_team_season` |
| Agent stress tests | Curated Gold tables | Semantic model measures plus Verified Answers |

---

## 19. Ground-Truth Evaluation Suite

Current implemented evaluation artifact:

```text
notebooks/evaluate_nfl_data_agent.ipynb
notebooks/evaluate_nfl_data_agent.py
```

This notebook evaluates the published Fabric Data Agent named `SM Data Agent`
against expected answers recomputed from the Gold SQL tables at runtime. It uses
the Fabric Data Agent SDK functions `evaluate_data_agent`,
`get_evaluation_summary`, and `get_evaluation_details`.

Current published Fabric items:

| Item | Name | ID |
|---|---|---|
| Semantic model | `NFL Play by Play Model` | `8915f632-ad16-40d1-8422-a075f37c7d5f` |
| Data Agent | `SM Data Agent` | `dce6b887-cd41-44e5-9cf1-dd2cf8c1d7c2` |
| Notebook | `evaluate_nfl_data_agent` | `c414551a-eec1-4700-9341-7929dd87ae6a` |

The evaluation notebook writes:

```text
nfl_data_agent_ground_truth
nfl_data_agent_evaluation
nfl_data_agent_evaluation_steps
```

Create a table or CSV named:

```text
agent_eval_questions
```

Suggested columns:

```text
question_id
question
expected_answer_type
expected_sql_or_dax_reference
expected_primary_metric
expected_filters
tolerance
notes
```

Example rows:

| question_id | question | expected_primary_metric | expected_filters |
|---|---|---|---|
| Q001 | How did the Seahawks rank in offensive EPA per play each season from 1999 through 2025? | Offensive EPA per Play Rank | team = SEA, seasons 1999–2025 |
| Q002 | Which Seahawks season had the best defense by EPA allowed per play? | Defensive EPA Allowed per Play | team = SEA |
| Q003 | What were Seattle’s top 10 plays by WPA from 1999 to 2025? | WPA | team = SEA, top 10 |
| Q004 | Which opposing quarterbacks generated the most EPA against Seattle? | Opponent Passing EPA | defense team = SEA |
| Q005 | How many penalties did Seattle commit by season? | Penalty Count | penalty team = SEA |

For every Data Agent answer, evaluate:

```text
Correct metric?
Correct team filter?
Correct offense/defense interpretation?
Correct season range?
Correct game type?
Correct ranking direction?
Correct row count?
Reasonable runtime?
Generated DAX valid?
```

---

## 20. Implementation Backlog for Codex

### Workstream 1: Local acquisition

```text
1. Create acquire_nflverse.py.
2. Create Python project structure.
3. Add dependency management using uv or requirements.txt.
4. Fetch full-league 1999–2025 data.
5. Save raw Parquet files.
6. Write acquisition_manifest.json.
7. Write schema_manifest.json.
8. Write quality_report.json.
9. Add retries and logging.
10. Add pytest tests for path creation, manifest generation, and validation logic.
```

### Workstream 2: Fabric ingestion

```text
1. Upload raw/nflverse files to Lakehouse Files.
2. Create Bronze Delta tables from Parquet.
3. Preserve raw schemas.
4. Add ingestion metadata.
5. Validate row counts against local manifest.
6. Create ingestion notebook or pipeline.
```

### Workstream 3: Silver transformations

```text
1. Create silver_play_by_play.
2. Create silver_games from schedules.
3. Create silver_teams.
4. Create silver_players.
5. Create silver_rosters_season.
6. Create silver_rosters_weekly.
7. Add football-specific derived flags.
8. Add field zone, score state, time context, down-distance buckets.
9. Validate Seahawks rows and game coverage.
10. Validate game joins and player joins.
```

### Workstream 4: Gold semantic tables

```text
1. Create Gold dimensions.
2. Create gold_fact_play_core.
3. Create gold_fact_team_play with offense/defense team perspective.
4. Create gold_fact_pass_play.
5. Create gold_fact_rush_play.
6. Create gold_fact_player_play_role.
7. Create gold_fact_penalty.
8. Create gold_fact_special_teams_play.
9. Create aggregate team/player/game/season tables.
10. Optimize table widths and cardinality.
```

### Workstream 5: Power BI semantic model

```text
1. Build star schema relationships.
2. Hide technical columns.
3. Hide raw fields not intended for users.
4. Create explicit DAX measures.
5. Add table, column, and measure descriptions.
6. Add synonyms.
7. Create measure folders.
8. Validate measures against Gold SQL outputs.
9. Use Import or Direct Lake over materialized Gold Delta tables.
10. Avoid Direct Lake fallback via non-materialized SQL views.
```

### Workstream 6: Data Agent

```text
1. Configure Prep for AI.
2. Create AI Data Schema with only curated dimensions, facts, aggregates, and measures.
3. Add AI Instructions with football definitions.
4. Add Verified Answers for the top 15 questions.
5. Add optional Lakehouse/Warehouse source for play-detail retrieval.
6. Run evaluation question suite.
7. Review generated DAX.
8. Fix model metadata, measures, and Verified Answers iteratively.
```

---

## 21. Recommended First Milestone

Build this first:

```text
Local:
  acquire_nflverse.py
  raw Parquet files
  acquisition manifest
  schema manifest
  quality report

Fabric Bronze:
  bronze_nflverse_pbp
  bronze_nflverse_schedules
  bronze_nflverse_teams
  bronze_nflverse_players
  bronze_nflverse_rosters

Fabric Silver:
  silver_play_by_play
  silver_games
  silver_teams
  silver_players

Fabric Gold MVP:
  gold_dim_team
  gold_dim_game
  gold_dim_player
  gold_fact_team_play
  gold_fact_play_core
  gold_agg_team_season
  gold_agg_team_game

Power BI MVP Measures:
  Offensive EPA per Play
  Defensive EPA Allowed per Play
  Defensive EPA Generated per Play
  EPA Differential per Play
  Success Rate
  Pass Rate
  Rush EPA per Play
  Dropback EPA per Play
  WPA
  Top Plays by WPA
```

This MVP should answer most Seahawks trend, offense/defense, game-flow, and ranking questions.

After the MVP, expand into:

```text
Player-role facts
Passing-specific facts
Rushing-specific facts
Penalty facts
Special teams facts
Situational aggregates
Verified Answers
Full Data Agent evaluation suite
```

---

## 22. Acceptance Criteria

### 22.1 Acquisition acceptance criteria

- [ ] Script runs locally without manual intervention.
- [ ] All 1999–2025 PBP seasons are written to Parquet.
- [ ] Schedules, teams, players, rosters, and weekly stats are written.
- [ ] Manifest files are created.
- [ ] Quality report passes all required checks or logs clear exceptions.
- [ ] Seattle rows exist in every expected season.
- [ ] Full-league data is retained.

### 22.2 Fabric ingestion acceptance criteria

- [ ] Raw Parquet files are uploaded to Lakehouse Files.
- [ ] Bronze Delta tables are created.
- [ ] Bronze row counts match local manifest.
- [ ] Silver tables are created with derived flags.
- [ ] Gold dimensions/facts/aggregates are created.
- [ ] Gold tables have stable keys and consistent grain.

### 22.3 Power BI acceptance criteria

- [ ] Semantic model uses Gold tables only.
- [ ] Relationships follow a star schema.
- [ ] Technical columns are hidden.
- [ ] Measures are explicit.
- [ ] Core measures validate against SQL/Spark outputs.
- [ ] Dashboards load interactively.
- [ ] No accidental DirectQuery fallback for Direct Lake model tables.

### 22.4 Data Agent acceptance criteria

- [ ] Prep for AI is configured.
- [ ] AI Data Schema exposes only curated fields.
- [ ] AI Instructions define football terms.
- [ ] Verified Answers exist for the first 15 questions.
- [ ] Evaluation suite results are recorded.
- [ ] Generated DAX is reviewed for representative questions.
- [ ] Agent correctly handles offense vs defense questions.
- [ ] Agent correctly handles ranking direction for defensive EPA allowed.

---

## 23. Key Risks and Mitigations

| Risk | Why it matters | Mitigation |
|---|---|---|
| Raw PBP table exposed directly | Too wide, ambiguous, slow, poor NL behavior | Use Bronze only for raw; expose Gold to Power BI/Data Agent |
| Filtering to Seattle during acquisition | Loses rankings and league-average context | Acquire full league; filter in semantic model/report |
| Ambiguous offense/defense semantics | Agent may reverse EPA allowed/generated | Create `gold_fact_team_play`; define measures explicitly |
| Direct Lake fallback | Can slow report interactions | Use materialized Delta Gold tables; avoid non-materialized SQL views |
| Too many visible columns | Confuses users and AI | Hide technical/raw fields; configure AI Data Schema |
| Implicit measures | Unpredictable Data Agent output | Use explicit DAX measures only |
| Player-name joins only | Names change and are non-unique | Use player IDs and roster mappings |
| Schema changes upstream | Acquisition breaks or metrics drift | Pin package versions; write schema manifest; validate required columns |
| Unclear metric definitions | Different analysts compute success/dropbacks differently | Document definitions in Silver, semantic model, and Prep for AI |

---

## 24. Source Links

Use these references during implementation:

1. `nflreadpy` documentation: https://nflreadpy.nflverse.com/
2. `nflreadpy` load functions: https://nflreadpy.nflverse.com/api/load_functions/
3. `nflreadpy` configuration: https://nflreadpy.nflverse.com/api/configuration/
4. `nfl_data_py` deprecation notice: https://github.com/nflverse/nfl_data_py
5. Power BI star schema guidance: https://learn.microsoft.com/en-us/power-bi/guidance/star-schema
6. Fabric semantic model best practices for Data Agent: https://learn.microsoft.com/en-us/fabric/data-science/semantic-model-best-practices
7. Fabric Data Agent concepts: https://learn.microsoft.com/en-us/fabric/data-science/concept-data-agent
8. Fabric Data Agent data sources: https://learn.microsoft.com/en-us/fabric/data-science/data-agent-add-datasources
9. Power BI Verified Answers / Prep for AI: https://learn.microsoft.com/en-us/power-bi/create-reports/copilot-prepare-data-ai-verified-answers
10. Direct Lake overview and fallback behavior: https://learn.microsoft.com/en-us/fabric/fundamentals/direct-lake-overview

---

## 25. Final Recommendation

Build this as a curated analytics product, not as a raw-table demo.

The best path is:

1. Use `nflreadpy` for local Python acquisition.
2. Store full-league 1999–2025 data as raw Parquet.
3. Upload the raw files to a Fabric Lakehouse.
4. Convert raw files into Bronze Delta tables.
5. Build cleaned Silver tables with football-specific derived fields.
6. Build Gold star-schema facts, dimensions, and aggregates.
7. Build the Power BI semantic model over Gold only.
8. Configure Prep for AI and Verified Answers.
9. Evaluate the Fabric Data Agent using the Seahawks question suite.

This design should produce fast dashboards, reliable DAX measures, and a Data Agent that can answer realistic football analytics questions instead of trying to infer meaning from hundreds of raw play-by-play columns.
