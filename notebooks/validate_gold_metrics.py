# Gold metric validation notebook source
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
# # Validate Gold NFL Metrics
#
# Run this notebook in Microsoft Fabric with the `lh_nfl` Lakehouse attached
# after `build_silver_gold_nfl_model` has completed.
#
# The notebook is read-only. It does not create, overwrite, or delete tables.
# It validates the Gold model against representative supported customer
# questions and intentionally skips known gaps:
#
# - true play-action tagging
# - true tight-window tracking beyond the `cpoe < 0` proxy
# - rushing yards over expected

# %%
from datetime import datetime, timezone

GOLD_SCHEMA = "gold"
RUN_UTC = datetime.now(timezone.utc).isoformat()

print(f"Notebook run UTC: {RUN_UTC}")


def q(table_name: str) -> str:
    return f"`{GOLD_SCHEMA}`.`{table_name}`"


def run_check(title: str, sql: str, note=None):
    print("\n" + "=" * 100)
    print(title)
    if note:
        print(f"Note: {note}")
    df = spark.sql(sql)
    display(df)
    return df


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
# ## Easy and Medium Fan/Fantasy Checks

# %%
run_check(
    "Fan: regular-season games played in 2025",
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
)

run_check(
    "Fan/Fantasy: top QBs by passing yards in 2025",
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
      AND passing_yards > 0
    ORDER BY passing_yards DESC
    LIMIT 10
    """,
)

run_check(
    "Fan: best offense by EPA per play in 2025",
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
    LIMIT 10
    """,
)

run_check(
    "Fan: best red zone touchdown rate by team in 2025",
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
    LIMIT 10
    """,
)

run_check(
    "Fan: Chiefs third-down conversion rate in 2025",
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
)

run_check(
    "Fan: teams with the most rushing touchdowns in 2025",
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
    LIMIT 10
    """,
)

run_check(
    "Fan: Patrick Mahomes completion percentage and TD-to-INT ratio in 2025",
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
    """,
)

run_check(
    "Fan/Fantasy: top rushers by EPA per rush in 2025, minimum 50 carries",
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
)

run_check(
    "Fantasy: highest CPOE on deep throws in 2025, minimum 30 deep attempts",
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
      AND deep_attempts >= 30
    ORDER BY deep_avg_cpoe DESC NULLS LAST
    LIMIT 10
    """,
)

run_check(
    "Fan: biggest single-play WPA swings in 2025",
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
    LIMIT 10
    """,
)

run_check(
    "Fan/Fantasy: top receivers by receiving yards in 2025",
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
)

run_check(
    "Beat reporter: 49ers defensive sacks and top sack leaders in 2025",
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
)

run_check(
    "Fan: game with the most total points scored in 2025",
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
    LIMIT 10
    """,
)

run_check(
    "Fantasy: kicker field goal attempts and make rate in 2025",
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
    LIMIT 10
    """,
)

run_check(
    "Beat reporter: Detroit Lions home vs road record in 2025",
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
)

run_check(
    "Fantasy: receivers with most red-zone targets in 2025",
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
    LIMIT 10
    """,
)

# %% [markdown]
# ## Coach, Scout, and Analyst Situational Checks

# %%
run_check(
    "Coach: 3rd-and-long league pass/rush split and success rates",
    f"""
    SELECT
        CASE
            WHEN play_type_group = 'Dropback' THEN 'Pass/dropback'
            WHEN play_type_group IN ('Designed rush', 'QB scramble') THEN 'Rush/scramble'
            ELSE play_type_group
        END AS play_choice,
        SUM(plays) AS attempts,
        ROUND(SUM(successful_plays) / SUM(plays), 3) AS success_rate,
        ROUND(SUM(epa) / SUM(plays), 4) AS epa_per_play
    FROM {q("agg_team_situation")}
    WHERE season = 2025
      AND season_type = 'REG'
      AND unit = 'Offense'
      AND down_distance_bucket = '3rd/4th long'
      AND play_type_group IN ('Dropback', 'Designed rush', 'QB scramble')
    GROUP BY
        CASE
            WHEN play_type_group = 'Dropback' THEN 'Pass/dropback'
            WHEN play_type_group IN ('Designed rush', 'QB scramble') THEN 'Rush/scramble'
            ELSE play_type_group
        END
    ORDER BY attempts DESC
    """,
)

run_check(
    "Coach: defenses allowing fewest explosive plays per game in 2025",
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
    LIMIT 10
    """,
)

run_check(
    "Coach: 4th quarter, trailing 1-8, QB EPA/dropback in 2025",
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
    LIMIT 10
    """,
)

run_check(
    "Scout: receivers by YAC per reception in 2025, minimum 30 receptions",
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
)

run_check(
    "Scout: RB stuff rate in 2025, minimum 50 carries",
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
    ORDER BY stuff_rate ASC NULLS LAST
    LIMIT 10
    """,
)

run_check(
    "Scout: QB EPA/dropback with QB hit flag versus no QB hit",
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
    LIMIT 10
    """,
    note="Uses the nflverse qb_hit flag, not full charted pressure.",
)

run_check(
    "Analyst: neutral situation team pass rates in 2025",
    f"""
    SELECT
        team_key,
        SUM(plays) AS neutral_plays,
        SUM(dropbacks) AS dropbacks,
        SUM(designed_rushes) AS designed_rushes,
        ROUND(SUM(dropbacks) / (SUM(dropbacks) + SUM(designed_rushes)), 3) AS neutral_pass_rate
    FROM {q("agg_team_situation")}
    WHERE season = 2025
      AND season_type = 'REG'
      AND unit = 'Offense'
      AND time_context IN ('First half', 'Second half')
      AND score_state IN ('Tied', 'Leading one score', 'Trailing one score')
      AND down_distance_bucket IN ('1st down', '2nd short', '2nd medium', '2nd long')
    GROUP BY team_key
    HAVING SUM(plays) >= 100
    ORDER BY neutral_pass_rate DESC NULLS LAST
    LIMIT 10
    """,
)

run_check(
    "Analyst: 2025 home-field advantage",
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
)

run_check(
    "Analyst: third-down conversion grid by distance bucket and play type",
    f"""
    SELECT
        CASE
            WHEN down_distance_bucket = '3rd/4th short' THEN 'Short 1-3'
            WHEN down_distance_bucket = '3rd/4th medium' THEN 'Medium 4-6'
            WHEN down_distance_bucket = '3rd/4th long' THEN 'Long 7+'
            ELSE down_distance_bucket
        END AS distance_bucket,
        CASE
            WHEN play_type_group = 'Dropback' THEN 'Pass/dropback'
            WHEN play_type_group IN ('Designed rush', 'QB scramble') THEN 'Rush/scramble'
            ELSE play_type_group
        END AS play_choice,
        SUM(third_down_attempts) AS attempts,
        SUM(third_down_conversions) AS conversions,
        ROUND(SUM(third_down_conversions) / SUM(third_down_attempts), 3) AS conversion_rate,
        ROUND(SUM(epa) / SUM(plays), 4) AS epa_per_play
    FROM {q("agg_team_situation")}
    WHERE season = 2025
      AND season_type = 'REG'
      AND unit = 'Offense'
      AND down_distance_bucket IN ('3rd/4th short', '3rd/4th medium', '3rd/4th long')
      AND play_type_group IN ('Dropback', 'Designed rush', 'QB scramble')
    GROUP BY
        CASE
            WHEN down_distance_bucket = '3rd/4th short' THEN 'Short 1-3'
            WHEN down_distance_bucket = '3rd/4th medium' THEN 'Medium 4-6'
            WHEN down_distance_bucket = '3rd/4th long' THEN 'Long 7+'
            ELSE down_distance_bucket
        END,
        CASE
            WHEN play_type_group = 'Dropback' THEN 'Pass/dropback'
            WHEN play_type_group IN ('Designed rush', 'QB scramble') THEN 'Rush/scramble'
            ELSE play_type_group
        END
    ORDER BY distance_bucket, play_choice
    """,
)

run_check(
    "Scout: cpoe-negative target catch rate proxy in 2025",
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
    note="This is a low expected completion proxy using cpoe < 0, not true tight-window tracking.",
)

run_check(
    "Scout: defenses by QB hit plus sack rate per opponent dropback",
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
)

run_check(
    "Scout: QB no-huddle versus huddle EPA/dropback in 2025",
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
      AND no_huddle_dropbacks >= 10
      AND passing_dropbacks >= 100
    ORDER BY no_huddle_epa_per_dropback DESC NULLS LAST
    LIMIT 10
    """,
)

# %% [markdown]
# ## Unsupported Question Families
#
# These question types should remain out of scope until additional data is
# added or a business-approved proxy is documented:
#
# - play-action versus non-play-action splits
# - true tight-window throws
# - rushing yards over expected

# %%
unsupported = spark.createDataFrame(
    [
        {
            "question_family": "Play-action passes",
            "status": "Not implemented",
            "reason": "bronze.nflverse_pbp does not include a play_action field.",
        },
        {
            "question_family": "True tight-window throws",
            "status": "Not implemented",
            "reason": "No tracking/charting tight-window field is present; cpoe < 0 is only a proxy.",
        },
        {
            "question_family": "Rushing yards over expected",
            "status": "Not implemented",
            "reason": "No expected_yards/rushing-yards-over-expected field is present.",
        },
    ]
)
display(unsupported)

print("Gold metric validation completed.")
