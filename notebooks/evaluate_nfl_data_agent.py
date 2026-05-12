# NFL Data Agent evaluation notebook source
# METADATA ********************
# META {
# META   "kernel_info": {
# META     "name": "synapse_pyspark"
# META   },
# META   "dependencies": {}
# META }
# CELL ********************
# METADATA ********************
# META {
# META   "language": "python",
# META   "language_group": "synapse_pyspark"
# META }

# %% [markdown]
# # Evaluate NFL Data Agent
#
# Run this notebook in Microsoft Fabric with the `lh_nfl` Lakehouse attached
# after the Gold tables and the `NFL Play by Play Model` semantic model are
# refreshed.
#
# The notebook:
#
# - recomputes expected answers from Gold SQL tables
# - evaluates the `SM Data Agent` Fabric Data Agent against those answers
# - writes the evaluation results to Fabric tables through the Data Agent SDK
# - displays summary and row-level details for follow-up tuning
#
# This notebook intentionally excludes unsupported question families such as
# true play-action, true tight-window tracking, and rushing yards over expected.

# %%
%pip install -U fabric-data-agent-sdk

# %% [markdown]
# ## Configuration

# %%
from datetime import datetime, timezone
import json
import math
import re
import textwrap

import pandas as pd

GOLD_SCHEMA = "gold"
DATA_AGENT_NAME = "SM Data Agent"
DATA_AGENT_STAGE = "production"  # Use "sandbox" if evaluating unpublished sandbox changes.
WORKSPACE_NAME = None  # Same workspace as this notebook.

EVALUATION_OUTPUT_TABLE = "nfl_data_agent_evaluation"
GROUND_TRUTH_TABLE = "nfl_data_agent_ground_truth"
WRITE_GROUND_TRUTH_TABLE = True
USE_CUSTOM_CRITIC_PROMPT = False

# Set to a small integer such as 3 for a quick smoke test. Use None for all cases.
MAX_EVALUATION_CASES = None

RUN_UTC = datetime.now(timezone.utc).isoformat()
print(f"Notebook run UTC: {RUN_UTC}")
print(f"Data Agent: {DATA_AGENT_NAME} ({DATA_AGENT_STAGE})")


def q(table_name: str) -> str:
    return f"`{GOLD_SCHEMA}`.`{table_name}`"


def normalize_sql(sql: str) -> str:
    return textwrap.dedent(sql).strip()


def clean_cell_value(value):
    if value is None:
        return None
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    return value


def spark_df_to_expected_answer(spark_df, max_rows: int = 20) -> str:
    """Convert a small verifier query result into deterministic text for the evaluator."""
    pdf = spark_df.toPandas()
    if pdf.empty:
        return "No rows returned by the verifier query."

    pdf = pdf.head(max_rows).copy()
    for col in pdf.columns:
        pdf[col] = pdf[col].map(clean_cell_value)

    return pdf.to_string(index=False)


def build_expected_answer(case: dict) -> str:
    result = spark.sql(case["sql"])
    table_text = spark_df_to_expected_answer(result, max_rows=case.get("max_rows", 20))
    note = case.get("note")
    if note:
        return f"{note}\n\nExpected result table:\n{table_text}"
    return f"Expected result table:\n{table_text}"


def case(case_id: str, category: str, question: str, sql: str, note: str | None = None, max_rows: int = 20):
    return {
        "case_id": case_id,
        "category": category,
        "question": question,
        "sql": normalize_sql(sql),
        "note": note,
        "max_rows": max_rows,
    }


available_tables = {
    row.tableName
    for row in spark.sql(f"SHOW TABLES IN `{GOLD_SCHEMA}`").collect()
    if not row.isTemporary
}

required_tables = {
    "agg_player_season",
    "agg_team_game",
    "agg_team_season",
    "agg_team_situation",
    "dim_game",
    "dim_player",
    "dim_team",
    "fact_pass_play",
    "fact_play_core",
    "fact_rush_play",
    "fact_special_teams_play",
    "fact_team_play",
}

missing = sorted(required_tables - available_tables)
if missing:
    raise ValueError(f"Missing required Gold tables: {missing}")

print(f"Gold tables available: {', '.join(sorted(available_tables))}")

# %% [markdown]
# ## Evaluation Cases

# %%
EVALUATION_CASES = [
    case(
        "fan_regular_season_games_2025",
        "fan",
        "How many regular-season NFL games were played in 2025?",
        f"""
        SELECT
            season,
            season_type,
            COUNT(*) AS regular_season_games
        FROM {q("dim_game")}
        WHERE season = 2025
          AND season_type = 'REG'
        GROUP BY season, season_type
        """,
    ),
    case(
        "fan_top_5_qbs_passing_yards_2025",
        "fan",
        "List the top 5 quarterbacks by passing yards in the 2025 regular season.",
        f"""
        SELECT
            player_name,
            team_key,
            attempts,
            completions,
            passing_yards,
            passing_tds,
            interceptions,
            ROUND(completion_percentage, 3) AS completion_percentage
        FROM {q("agg_player_season")}
        WHERE season = 2025
          AND season_type = 'REG'
          AND position = 'QB'
          AND passing_yards > 0
        ORDER BY passing_yards DESC
        LIMIT 5
        """,
    ),
    case(
        "fan_best_offense_epa_per_play_2025",
        "fan",
        "Which team had the best offensive EPA per play in the 2025 regular season?",
        f"""
        SELECT
            team_key,
            offensive_plays,
            ROUND(offensive_epa, 3) AS offensive_epa,
            ROUND(offensive_epa_per_play, 4) AS offensive_epa_per_play,
            offensive_epa_per_play_rank
        FROM {q("agg_team_season")}
        WHERE season = 2025
          AND season_type = 'REG'
        ORDER BY offensive_epa_per_play DESC NULLS LAST
        LIMIT 1
        """,
    ),
    case(
        "fan_best_red_zone_td_rate_2025",
        "fan",
        "Which team had the best red zone touchdown rate in the 2025 regular season?",
        f"""
        SELECT
            team_key,
            red_zone_drives,
            red_zone_touchdown_drives,
            ROUND(red_zone_drive_td_rate, 3) AS red_zone_drive_td_rate
        FROM {q("agg_team_season")}
        WHERE season = 2025
          AND season_type = 'REG'
          AND red_zone_drives >= 10
        ORDER BY red_zone_drive_td_rate DESC NULLS LAST
        LIMIT 1
        """,
    ),
    case(
        "fan_chiefs_third_down_rate_2025",
        "fan",
        "What was the Chiefs third-down conversion rate in the 2025 regular season?",
        f"""
        SELECT
            team_key,
            third_down_attempts,
            third_down_conversions,
            ROUND(third_down_conversion_rate, 3) AS third_down_conversion_rate
        FROM {q("agg_team_season")}
        WHERE season = 2025
          AND season_type = 'REG'
          AND team_key = 'KC'
        """,
    ),
    case(
        "fan_top_10_rushers_epa_per_rush_2025",
        "fan",
        "List the top 10 running backs by EPA per rush in the 2025 regular season, minimum 50 carries.",
        f"""
        SELECT
            player_name,
            team_key,
            position,
            rushing_attempts,
            rushing_yards,
            ROUND(rushing_epa, 3) AS rushing_epa,
            ROUND(rushing_epa_per_play, 4) AS rushing_epa_per_play
        FROM {q("agg_player_season")}
        WHERE season = 2025
          AND season_type = 'REG'
          AND rushing_attempts >= 50
          AND position IN ('RB', 'FB')
        ORDER BY rushing_epa_per_play DESC NULLS LAST
        LIMIT 10
        """,
    ),
    case(
        "fantasy_highest_deep_cpoe_2025",
        "fantasy",
        "Which quarterback had the highest CPOE on throws of 20 or more air yards in the 2025 regular season, minimum 30 such attempts?",
        f"""
        SELECT
            player_name,
            team_key,
            deep_attempts,
            deep_completions,
            ROUND(deep_completion_percentage, 3) AS deep_completion_percentage,
            ROUND(deep_avg_cpoe, 3) AS deep_avg_cpoe
        FROM {q("agg_player_season")}
        WHERE season = 2025
          AND season_type = 'REG'
          AND position = 'QB'
          AND deep_attempts >= 30
        ORDER BY deep_avg_cpoe DESC NULLS LAST
        LIMIT 1
        """,
    ),
    case(
        "fan_biggest_single_play_wpa_2025",
        "fan",
        "What was the biggest single-play WPA swing in the 2025 regular season?",
        f"""
        SELECT
            season,
            week,
            game_key,
            offense_team_key,
            defense_team_key,
            ROUND(wpa, 4) AS wpa,
            play_description
        FROM {q("fact_play_core")}
        WHERE season = 2025
          AND season_type = 'REG'
        ORDER BY ABS(wpa) DESC NULLS LAST
        LIMIT 1
        """,
    ),
    case(
        "fantasy_top_10_receivers_yards_2025",
        "fantasy",
        "List the top 10 receivers by receiving yards in the 2025 regular season.",
        f"""
        SELECT
            player_name,
            team_key,
            position,
            targets,
            receptions,
            receiving_yards,
            ROUND(yac_per_reception, 2) AS yac_per_reception
        FROM {q("agg_player_season")}
        WHERE season = 2025
          AND season_type = 'REG'
          AND receiving_yards > 0
        ORDER BY receiving_yards DESC
        LIMIT 10
        """,
    ),
    case(
        "fan_most_rushing_tds_team_2025",
        "fan",
        "Which team had the most rushing touchdowns in the 2025 regular season?",
        f"""
        SELECT
            team_key,
            SUM(rushing_tds) AS rushing_touchdowns,
            SUM(rushing_attempts) AS rushing_attempts,
            SUM(rushing_yards) AS rushing_yards
        FROM {q("agg_player_season")}
        WHERE season = 2025
          AND season_type = 'REG'
        GROUP BY team_key
        ORDER BY rushing_touchdowns DESC NULLS LAST
        LIMIT 1
        """,
    ),
    case(
        "fantasy_top_5_rbs_rushing_yards_tds_2025",
        "fantasy",
        "List the top 5 running backs by rushing yards in the 2025 regular season and include their rushing touchdowns.",
        f"""
        SELECT
            player_name,
            team_key,
            position,
            rushing_attempts,
            rushing_yards,
            rushing_tds
        FROM {q("agg_player_season")}
        WHERE season = 2025
          AND season_type = 'REG'
          AND position IN ('RB', 'FB')
          AND rushing_attempts > 0
        ORDER BY rushing_yards DESC NULLS LAST
        LIMIT 5
        """,
    ),
    case(
        "fan_mahomes_completion_td_int_2025",
        "fan",
        "What were Patrick Mahomes' completion percentage and TD-to-INT ratio in the 2025 regular season?",
        f"""
        SELECT
            player_name,
            team_key,
            attempts,
            completions,
            passing_tds,
            interceptions,
            ROUND(completion_percentage, 3) AS completion_percentage,
            ROUND(td_to_int_ratio, 3) AS td_to_int_ratio
        FROM {q("agg_player_season")}
        WHERE season = 2025
          AND season_type = 'REG'
          AND LOWER(player_name) LIKE '%mahomes%'
        ORDER BY passing_yards DESC
        LIMIT 1
        """,
    ),
    case(
        "beat_49ers_sacks_leaders_2025",
        "beat_reporter",
        "How many sacks did the 49ers defense record in the 2025 regular season, and who were their top 3 sack leaders?",
        f"""
        WITH team_total AS (
            SELECT
                team_key,
                SUM(sacks) AS team_sacks
            FROM {q("agg_team_game")}
            WHERE season = 2025
              AND season_type = 'REG'
              AND team_key = 'SF'
            GROUP BY team_key
        ),
        leaders AS (
            SELECT
                player_name,
                team_key,
                sacks_defense
            FROM {q("agg_player_season")}
            WHERE season = 2025
              AND season_type = 'REG'
              AND team_key = 'SF'
              AND sacks_defense > 0
            ORDER BY sacks_defense DESC
            LIMIT 3
        )
        SELECT
            l.player_name,
            l.team_key,
            t.team_sacks,
            l.sacks_defense
        FROM leaders l
        CROSS JOIN team_total t
        ORDER BY l.sacks_defense DESC
        """,
    ),
    case(
        "fan_highest_total_points_game_2025",
        "fan",
        "Which 2025 game had the most total points scored? Show the teams, final score, and week.",
        f"""
        SELECT
            season,
            week,
            game_key,
            away_team,
            away_score,
            home_team,
            home_score,
            total_points
        FROM {q("dim_game")}
        WHERE season = 2025
        ORDER BY total_points DESC NULLS LAST
        LIMIT 1
        """,
    ),
    case(
        "fantasy_top_10_qbs_passing_tds_2025",
        "fantasy",
        "List the top 10 QBs by passing touchdowns in the 2025 regular season, with their interception count shown alongside.",
        f"""
        SELECT
            player_name,
            team_key,
            attempts,
            passing_tds,
            interceptions
        FROM {q("agg_player_season")}
        WHERE season = 2025
          AND season_type = 'REG'
          AND position = 'QB'
          AND attempts > 0
        ORDER BY passing_tds DESC NULLS LAST, player_name ASC
        LIMIT 10
        """,
    ),
    case(
        "fantasy_kicker_most_fg_attempts_2025",
        "fantasy",
        "Which kicker attempted the most field goals in the 2025 regular season, and what was their make rate?",
        f"""
        SELECT
            player_name,
            team_key,
            field_goal_attempts,
            field_goals_made,
            ROUND(field_goal_make_rate, 3) AS field_goal_make_rate
        FROM {q("agg_player_season")}
        WHERE season = 2025
          AND season_type = 'REG'
          AND field_goal_attempts > 0
        ORDER BY field_goal_attempts DESC
        LIMIT 1
        """,
    ),
    case(
        "beat_lions_home_road_record_2025",
        "beat_reporter",
        "What was the Detroit Lions' record at home versus on the road in the 2025 regular season?",
        f"""
        SELECT
            team_key,
            home_away,
            COUNT(*) AS games,
            SUM(CASE WHEN game_result = 'Win' THEN 1 ELSE 0 END) AS wins,
            SUM(CASE WHEN game_result = 'Loss' THEN 1 ELSE 0 END) AS losses,
            SUM(CASE WHEN game_result = 'Tie' THEN 1 ELSE 0 END) AS ties
        FROM {q("agg_team_game")}
        WHERE season = 2025
          AND season_type = 'REG'
          AND team_key = 'DET'
        GROUP BY team_key, home_away
        ORDER BY home_away
        """,
    ),
    case(
        "fantasy_top_5_red_zone_targets_2025",
        "fantasy",
        "Which 5 receivers had the most red-zone targets in the 2025 regular season?",
        f"""
        SELECT
            receiver_player_name,
            offense_team_key,
            COUNT(*) AS red_zone_targets,
            SUM(CASE WHEN is_complete_pass THEN 1 ELSE 0 END) AS red_zone_receptions,
            SUM(CASE WHEN is_pass_touchdown THEN 1 ELSE 0 END) AS red_zone_touchdowns
        FROM {q("fact_pass_play")}
        WHERE season = 2025
          AND season_type = 'REG'
          AND is_red_zone
          AND receiver_player_key IS NOT NULL
          AND is_official_pass_attempt
        GROUP BY receiver_player_name, offense_team_key
        ORDER BY red_zone_targets DESC
        LIMIT 5
        """,
    ),
    case(
        "coach_third_and_long_pass_rush_split_2025",
        "coach",
        "On third down with 7 or more yards to go in the 2025 regular season, what were the league-wide pass and rush attempts, success rates, and EPA per play?",
        f"""
        SELECT
            CASE
                WHEN play_type_group = 'Dropback' THEN 'Pass/dropback'
                WHEN play_type_group IN ('Designed rush', 'QB scramble') THEN 'Rush/scramble'
                ELSE play_type_group
            END AS play_choice,
            SUM(play_count) AS attempts,
            ROUND(SUM(successful_play_count) / SUM(play_count), 3) AS success_rate,
            ROUND(SUM(epa) / SUM(play_count), 4) AS epa_per_play
        FROM {q("fact_team_play")}
        WHERE season = 2025
          AND season_type = 'REG'
          AND unit = 'Offense'
          AND down = 3
          AND ydstogo >= 7
          AND play_type_group IN ('Dropback', 'Designed rush', 'QB scramble')
        GROUP BY
            CASE
                WHEN play_type_group = 'Dropback' THEN 'Pass/dropback'
                WHEN play_type_group IN ('Designed rush', 'QB scramble') THEN 'Rush/scramble'
                ELSE play_type_group
            END
        ORDER BY attempts DESC
        """,
    ),
    case(
        "coach_defenses_fewest_explosives_2025",
        "coach",
        "Which 5 defenses allowed the fewest explosive plays per game in the 2025 regular season?",
        f"""
        SELECT
            team_key,
            games,
            explosive_plays_allowed,
            ROUND(explosive_plays_allowed_per_game, 3) AS explosive_plays_allowed_per_game
        FROM {q("agg_team_season")}
        WHERE season = 2025
          AND season_type = 'REG'
          AND games >= 5
        ORDER BY explosive_plays_allowed_per_game ASC NULLS LAST
        LIMIT 5
        """,
    ),
    case(
        "coach_fourth_trailing_qb_epa_2025",
        "coach",
        "In the 4th quarter when trailing by 1 to 8 points in the 2025 regular season, which 5 QBs had the highest EPA per dropback, minimum 20 dropbacks?",
        f"""
        SELECT
            passer_player_name,
            offense_team_key,
            COUNT(*) AS dropbacks,
            ROUND(SUM(epa), 3) AS epa,
            ROUND(SUM(epa) / COUNT(*), 4) AS epa_per_dropback
        FROM {q("fact_pass_play")}
        WHERE season = 2025
          AND season_type = 'REG'
          AND qtr = 4
          AND score_differential BETWEEN -8 AND -1
          AND passer_player_key IS NOT NULL
        GROUP BY passer_player_name, offense_team_key
        HAVING COUNT(*) >= 20
        ORDER BY epa_per_dropback DESC NULLS LAST
        LIMIT 5
        """,
    ),
    case(
        "scout_receivers_yac_per_reception_2025",
        "scout",
        "Which 10 receivers had the most yards after catch per reception in the 2025 regular season, minimum 30 receptions?",
        f"""
        SELECT
            player_name,
            team_key,
            receptions,
            yards_after_catch,
            ROUND(yac_per_reception, 2) AS yac_per_reception
        FROM {q("agg_player_season")}
        WHERE season = 2025
          AND season_type = 'REG'
          AND receptions >= 30
        ORDER BY yac_per_reception DESC NULLS LAST
        LIMIT 10
        """,
    ),
    case(
        "scout_rb_stuff_rate_2025",
        "scout",
        "Which 10 running backs had the highest stuff rate in the 2025 regular season, minimum 50 carries?",
        f"""
        SELECT
            player_name,
            team_key,
            position,
            rushing_attempts,
            stuffed_rushes,
            ROUND(stuff_rate, 3) AS stuff_rate
        FROM {q("agg_player_season")}
        WHERE season = 2025
          AND season_type = 'REG'
          AND position IN ('RB', 'FB')
          AND rushing_attempts >= 50
        ORDER BY stuff_rate DESC NULLS LAST
        LIMIT 10
        """,
    ),
    case(
        "scout_qb_hit_vs_clean_epa_2025",
        "scout",
        "For QBs in 2025 with at least 100 clean dropbacks and at least 15 QB-hit dropbacks, who had the largest EPA per dropback differential between clean and QB-hit plays?",
        f"""
        WITH by_state AS (
            SELECT
                passer_player_name,
                offense_team_key,
                is_qb_hit,
                COUNT(*) AS dropbacks,
                SUM(epa) AS epa
            FROM {q("fact_pass_play")}
            WHERE season = 2025
              AND season_type = 'REG'
              AND passer_player_key IS NOT NULL
            GROUP BY passer_player_name, offense_team_key, is_qb_hit
        ),
        pivoted AS (
            SELECT
                passer_player_name,
                offense_team_key,
                SUM(CASE WHEN is_qb_hit THEN dropbacks ELSE 0 END) AS hit_dropbacks,
                SUM(CASE WHEN is_qb_hit THEN epa ELSE 0 END) AS hit_epa,
                SUM(CASE WHEN NOT is_qb_hit THEN dropbacks ELSE 0 END) AS clean_dropbacks,
                SUM(CASE WHEN NOT is_qb_hit THEN epa ELSE 0 END) AS clean_epa
            FROM by_state
            GROUP BY passer_player_name, offense_team_key
        )
        SELECT
            passer_player_name,
            offense_team_key,
            hit_dropbacks,
            clean_dropbacks,
            ROUND(hit_epa / hit_dropbacks, 4) AS hit_epa_per_dropback,
            ROUND(clean_epa / clean_dropbacks, 4) AS clean_epa_per_dropback,
            ROUND((clean_epa / clean_dropbacks) - (hit_epa / hit_dropbacks), 4) AS clean_minus_hit_epa_per_dropback
        FROM pivoted
        WHERE hit_dropbacks >= 15
          AND clean_dropbacks >= 100
        ORDER BY clean_minus_hit_epa_per_dropback DESC NULLS LAST
        LIMIT 5
        """,
        note="Uses the nflverse qb_hit flag, not full charted pressure.",
    ),
    case(
        "analyst_neutral_pass_rates_2025",
        "analyst",
        "In neutral game situations in the 2025 regular season, which 5 teams passed most often? Use 1st or 2nd down, quarters 1-3, and score differential within 7 points.",
        f"""
        SELECT
            offense_team_key AS team_key,
            COUNT(*) AS neutral_plays,
            SUM(CASE WHEN play_type_group = 'Dropback' THEN 1 ELSE 0 END) AS dropbacks,
            SUM(CASE WHEN play_type_group = 'Designed rush' THEN 1 ELSE 0 END) AS designed_rushes,
            ROUND(SUM(CASE WHEN play_type_group = 'Dropback' THEN 1 ELSE 0 END) / COUNT(*), 3) AS neutral_pass_rate
        FROM {q("fact_play_core")}
        WHERE season = 2025
          AND season_type = 'REG'
          AND down IN (1, 2)
          AND qtr BETWEEN 1 AND 3
          AND score_differential BETWEEN -7 AND 7
          AND play_type_group IN ('Dropback', 'Designed rush')
          AND offense_team_key IS NOT NULL
        GROUP BY offense_team_key
        HAVING COUNT(*) >= 100
        ORDER BY neutral_pass_rate DESC NULLS LAST
        LIMIT 5
        """,
    ),
    case(
        "analyst_home_field_advantage_2025",
        "analyst",
        "Quantify 2025 regular-season home-field advantage: home win rate, average home point differential, average home points, and average away points.",
        f"""
        SELECT
            season,
            COUNT(*) AS games,
            ROUND(SUM(CASE WHEN home_score > away_score THEN 1 ELSE 0 END) / COUNT(*), 3) AS home_win_rate,
            ROUND(AVG(home_score - away_score), 2) AS avg_home_point_differential,
            ROUND(AVG(home_score), 2) AS avg_home_points,
            ROUND(AVG(away_score), 2) AS avg_away_points
        FROM {q("dim_game")}
        WHERE season = 2025
          AND season_type = 'REG'
        GROUP BY season
        """,
    ),
    case(
        "analyst_third_down_conversion_grid_2025",
        "analyst",
        "Build a 2025 third-down conversion grid by distance bucket short 1-3, medium 4-6, long 7+ and play type pass versus rush. Show attempts, conversion rate, and EPA per play.",
        f"""
        SELECT
            CASE
                WHEN ydstogo BETWEEN 1 AND 3 THEN 'Short 1-3'
                WHEN ydstogo BETWEEN 4 AND 6 THEN 'Medium 4-6'
                WHEN ydstogo >= 7 THEN 'Long 7+'
                ELSE 'Other'
            END AS distance_bucket,
            CASE
                WHEN play_type_group = 'Dropback' THEN 'Pass/dropback'
                WHEN play_type_group IN ('Designed rush', 'QB scramble') THEN 'Rush/scramble'
                ELSE play_type_group
            END AS play_choice,
            SUM(third_down_attempt_count) AS attempts,
            SUM(third_down_conversion_count) AS conversions,
            ROUND(SUM(third_down_conversion_count) / SUM(third_down_attempt_count), 3) AS conversion_rate,
            ROUND(SUM(epa) / SUM(play_count), 4) AS epa_per_play
        FROM {q("fact_team_play")}
        WHERE season = 2025
          AND season_type = 'REG'
          AND unit = 'Offense'
          AND down = 3
          AND play_type_group IN ('Dropback', 'Designed rush', 'QB scramble')
          AND ydstogo >= 1
        GROUP BY
            CASE
                WHEN ydstogo BETWEEN 1 AND 3 THEN 'Short 1-3'
                WHEN ydstogo BETWEEN 4 AND 6 THEN 'Medium 4-6'
                WHEN ydstogo >= 7 THEN 'Long 7+'
                ELSE 'Other'
            END,
            CASE
                WHEN play_type_group = 'Dropback' THEN 'Pass/dropback'
                WHEN play_type_group IN ('Designed rush', 'QB scramble') THEN 'Rush/scramble'
                ELSE play_type_group
            END
        ORDER BY distance_bucket, play_choice
        """,
    ),
    case(
        "scout_deep_completion_rate_2025",
        "scout",
        "Which 10 QBs had the highest completion percentage on throws of 20 or more air yards in 2025, minimum 15 deep attempts, and what was their average air yards per attempt overall?",
        f"""
        SELECT
            passer_player_name,
            offense_team_key,
            SUM(deep_attempt_count) AS deep_attempts,
            SUM(CASE WHEN is_deep_pass AND is_complete_pass THEN 1 ELSE 0 END) AS deep_completions,
            ROUND(SUM(CASE WHEN is_deep_pass AND is_complete_pass THEN 1 ELSE 0 END) / SUM(deep_attempt_count), 3) AS deep_completion_percentage,
            ROUND(AVG(air_yards), 2) AS avg_air_yards_per_attempt
        FROM {q("fact_pass_play")}
        WHERE season = 2025
          AND season_type = 'REG'
          AND passer_position = 'QB'
          AND is_official_pass_attempt
        GROUP BY passer_player_name, offense_team_key
        HAVING SUM(deep_attempt_count) >= 15
        ORDER BY deep_completion_percentage DESC NULLS LAST, deep_attempts DESC
        LIMIT 10
        """,
    ),
    case(
        "scout_rb_explosive_run_rate_2025",
        "scout",
        "Which 10 running backs had the highest explosive run rate in the 2025 regular season, minimum 50 carries?",
        f"""
        SELECT
            rusher_player_name,
            offense_team_key,
            rusher_position,
            SUM(rush_attempt_count) AS carries,
            SUM(explosive_rush_count) AS explosive_runs,
            ROUND(SUM(explosive_rush_count) / SUM(rush_attempt_count), 3) AS explosive_run_rate
        FROM {q("fact_rush_play")}
        WHERE season = 2025
          AND season_type = 'REG'
          AND is_rb_or_fb_carry
        GROUP BY rusher_player_name, offense_team_key, rusher_position
        HAVING SUM(rush_attempt_count) >= 50
        ORDER BY explosive_run_rate DESC NULLS LAST, carries DESC
        LIMIT 10
        """,
    ),
    case(
        "scout_qb_hit_completion_epa_2025",
        "scout",
        "When QBs were hit during the play in 2025, which 5 had the highest completion percentage and EPA per dropback, minimum 15 QB-hit dropbacks?",
        f"""
        SELECT
            passer_player_name,
            offense_team_key,
            COUNT(*) AS hit_dropbacks,
            SUM(pass_attempt_count) AS pass_attempts,
            SUM(completion_count) AS completions,
            ROUND(SUM(completion_count) / SUM(pass_attempt_count), 3) AS completion_percentage,
            ROUND(SUM(epa) / COUNT(*), 4) AS epa_per_dropback
        FROM {q("fact_pass_play")}
        WHERE season = 2025
          AND season_type = 'REG'
          AND passer_position = 'QB'
          AND is_qb_hit
        GROUP BY passer_player_name, offense_team_key
        HAVING COUNT(*) >= 15
           AND SUM(pass_attempt_count) > 0
        ORDER BY completion_percentage DESC NULLS LAST, epa_per_dropback DESC NULLS LAST
        LIMIT 5
        """,
        note="Uses the nflverse qb_hit flag, not full charted pressure.",
    ),
    case(
        "scout_low_cpoe_target_catch_rate_2025",
        "scout",
        "Which 10 receivers had the highest catch rate on low expected completion targets in 2025, using cpoe below zero as the proxy and minimum 20 targets?",
        f"""
        SELECT
            receiver_player_name,
            offense_team_key,
            COUNT(*) AS low_expected_completion_targets,
            SUM(CASE WHEN is_complete_pass THEN 1 ELSE 0 END) AS catches,
            ROUND(SUM(CASE WHEN is_complete_pass THEN 1 ELSE 0 END) / COUNT(*), 3) AS catch_rate
        FROM {q("fact_pass_play")}
        WHERE season = 2025
          AND season_type = 'REG'
          AND receiver_player_key IS NOT NULL
          AND is_official_pass_attempt
          AND cpoe < 0
        GROUP BY receiver_player_name, offense_team_key
        HAVING COUNT(*) >= 20
        ORDER BY catch_rate DESC NULLS LAST
        LIMIT 10
        """,
        note="This uses cpoe < 0 as a low expected completion proxy, not true tight-window tracking.",
    ),
    case(
        "scout_third_and_5_qb_conversion_2025",
        "scout",
        "On 3rd down with 5 or more yards to go in 2025, which 10 QBs had the highest conversion rate via the pass, minimum 20 attempts?",
        f"""
        SELECT
            passer_player_name,
            offense_team_key,
            SUM(pass_attempt_count) AS attempts,
            SUM(third_down_conversion_count) AS conversions,
            ROUND(SUM(third_down_conversion_count) / SUM(pass_attempt_count), 3) AS conversion_rate,
            ROUND(SUM(epa) / COUNT(*), 4) AS epa_per_dropback
        FROM {q("fact_pass_play")}
        WHERE season = 2025
          AND season_type = 'REG'
          AND passer_position = 'QB'
          AND down = 3
          AND ydstogo >= 5
          AND is_official_pass_attempt
        GROUP BY passer_player_name, offense_team_key
        HAVING SUM(pass_attempt_count) >= 20
        ORDER BY conversion_rate DESC NULLS LAST, epa_per_dropback DESC NULLS LAST
        LIMIT 10
        """,
    ),
    case(
        "scout_short_yardage_rb_conversion_2025",
        "scout",
        "On runs with 1 or 2 yards to go for a first down or touchdown in 2025, which 10 RBs had the highest conversion rate, minimum 10 carries?",
        f"""
        SELECT
            rusher_player_name,
            offense_team_key,
            rusher_position,
            SUM(rush_attempt_count) AS carries,
            SUM(conversion_count) AS conversions,
            ROUND(SUM(conversion_count) / SUM(rush_attempt_count), 3) AS conversion_rate
        FROM {q("fact_rush_play")}
        WHERE season = 2025
          AND season_type = 'REG'
          AND is_rb_or_fb_carry
          AND ydstogo BETWEEN 1 AND 2
        GROUP BY rusher_player_name, offense_team_key, rusher_position
        HAVING SUM(rush_attempt_count) >= 10
        ORDER BY conversion_rate DESC NULLS LAST, carries DESC
        LIMIT 10
        """,
    ),
    case(
        "scout_defense_qb_hit_sack_rate_2025",
        "scout",
        "Which 10 defenses generated the highest QB hit plus sack rate per opponent dropback in the 2025 regular season?",
        f"""
        SELECT
            team_key AS defense_team,
            SUM(defensive_play_count) AS defensive_plays,
            SUM(dropback_count) AS opponent_dropbacks,
            SUM(qb_hit_count) AS qb_hits,
            SUM(sack_count) AS sacks,
            ROUND((SUM(qb_hit_count) + SUM(sack_count)) / SUM(dropback_count), 4) AS qb_hit_plus_sack_rate
        FROM {q("fact_team_play")}
        WHERE season = 2025
          AND season_type = 'REG'
          AND unit = 'Defense'
        GROUP BY team_key
        HAVING SUM(dropback_count) >= 100
        ORDER BY qb_hit_plus_sack_rate DESC NULLS LAST
        LIMIT 10
        """,
    ),
    case(
        "scout_qb_no_huddle_huddle_epa_2025",
        "scout",
        "Compare each QB's EPA per dropback in no-huddle versus huddle situations in 2025. Show the top 10 QBs by no-huddle EPA per dropback, minimum 10 no-huddle dropbacks.",
        f"""
        SELECT
            player_name,
            team_key,
            no_huddle_dropbacks,
            ROUND(no_huddle_epa_per_dropback, 4) AS no_huddle_epa_per_dropback,
            huddle_dropbacks,
            ROUND(huddle_epa_per_dropback, 4) AS huddle_epa_per_dropback
        FROM {q("agg_player_season")}
        WHERE season = 2025
          AND season_type = 'REG'
          AND position = 'QB'
          AND no_huddle_dropbacks >= 10
          AND passing_dropbacks >= 100
        ORDER BY no_huddle_epa_per_dropback DESC NULLS LAST
        LIMIT 10
        """,
    ),
]

if MAX_EVALUATION_CASES is not None:
    EVALUATION_CASES = EVALUATION_CASES[:MAX_EVALUATION_CASES]

print(f"Evaluation cases configured: {len(EVALUATION_CASES)}")
display(pd.DataFrame([{k: c[k] for k in ["case_id", "category", "question"]} for c in EVALUATION_CASES]))

# %% [markdown]
# ## Generate Ground Truth

# %%
ground_truth_records = []

for idx, eval_case in enumerate(EVALUATION_CASES, start=1):
    print(f"[{idx}/{len(EVALUATION_CASES)}] Building expected answer: {eval_case['case_id']}")
    expected_answer = build_expected_answer(eval_case)
    ground_truth_records.append(
        {
            "run_utc": RUN_UTC,
            "case_id": eval_case["case_id"],
            "category": eval_case["category"],
            "question": eval_case["question"],
            "expected_answer": expected_answer,
            "verifier_sql": eval_case["sql"],
            "note": eval_case.get("note"),
        }
    )

ground_truth_df = pd.DataFrame(ground_truth_records)
display(ground_truth_df[["case_id", "category", "question", "expected_answer"]])

if WRITE_GROUND_TRUTH_TABLE:
    spark_ground_truth_df = spark.createDataFrame(ground_truth_df)
    spark_ground_truth_df.write.mode("overwrite").option("overwriteSchema", "true").saveAsTable(GROUND_TRUTH_TABLE)
    print(f"Wrote ground truth table: {GROUND_TRUTH_TABLE}")

# %% [markdown]
# ## Run Fabric Data Agent Evaluation

# %%
from fabric.dataagent.evaluation import evaluate_data_agent

evaluation_input_df = ground_truth_df[["question", "expected_answer"]].copy()

critic_prompt = """
You are evaluating a Fabric Data Agent answer for an NFL analytics semantic model.

Compare the actual answer to the expected answer. The expected answer is a verifier
SQL result table generated from the Gold layer. Mark the answer as correct only if
the teams, players, rankings, counts, and numeric metrics materially match the
expected result for the user's question.

Rules:
- Formatting differences are acceptable.
- Team abbreviations and full team names are equivalent when unambiguous.
- Numeric rates may differ by small rounding only; counts and rankings should match.
- If the expected answer says a proxy is used, the actual answer should not claim it
  is a richer tracking metric.
- If the actual answer omits a specifically requested column or metric, mark it false
  unless the missing value is clearly inferable from the text.
- If the actual answer gives a different season, season type, player, team, ranking,
  or unsupported metric, mark it false.

Query:
{query}

Expected answer:
{expected_answer}

Actual answer:
{actual_answer}

Is the actual answer equivalent to the expected answer? Answer yes or no, with a
brief reason.
"""

evaluation_kwargs = {
    "workspace_name": WORKSPACE_NAME,
    "table_name": EVALUATION_OUTPUT_TABLE,
    "data_agent_stage": DATA_AGENT_STAGE,
}

if USE_CUSTOM_CRITIC_PROMPT:
    evaluation_kwargs["critic_prompt"] = critic_prompt

evaluation_id = evaluate_data_agent(
    evaluation_input_df,
    DATA_AGENT_NAME,
    **evaluation_kwargs,
)

print(f"Evaluation ID: {evaluation_id}")
print(f"Evaluation output table: {EVALUATION_OUTPUT_TABLE}")
print(f"Evaluation step table: {EVALUATION_OUTPUT_TABLE}_steps")

# %% [markdown]
# ## Review Results

# %%
from fabric.dataagent.evaluation import get_evaluation_details, get_evaluation_summary

summary_df = get_evaluation_summary(EVALUATION_OUTPUT_TABLE, verbose=True)
display(summary_df)

details_df = get_evaluation_details(
    evaluation_id,
    EVALUATION_OUTPUT_TABLE,
    get_all_rows=True,
    verbose=True,
)

display(details_df)

if "evaluation_result" in details_df.columns:
    failures_df = details_df[details_df["evaluation_result"].astype(str).str.lower() != "true"]
    print(f"Non-passing rows: {len(failures_df)}")
    display(failures_df)

# %% [markdown]
# ## Tuning Notes
#
# Common follow-ups after a failed row:
#
# - verify whether the Data Agent selected the semantic model data source
# - inspect the generated DAX or SQL in the evaluation step table
# - add or refine measure descriptions and synonyms in Prep for AI
# - hide ambiguous raw columns that invite the agent to bypass curated measures
# - add narrowly scoped detail tables only for questions that truly require play-level rows
