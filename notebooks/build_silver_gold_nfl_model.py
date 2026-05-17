# Fabric notebook source
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

# Build Silver and Gold NFL analytics tables

# %% [markdown]
# # Build Silver and Gold NFL Analytics Tables
#
# Run this notebook in Microsoft Fabric with the `lh_nfl` Lakehouse attached.
#
# This notebook assumes the Bronze tables already exist in a schema-enabled Lakehouse:
#
# - `bronze.nflverse_pbp`
# - `bronze.nflverse_schedules`
# - `bronze.nflverse_teams`
# - `bronze.nflverse_players`
# - `bronze.nflverse_rosters`
# - `bronze.nflverse_player_stats_reg`
# - `bronze.nflverse_player_stats_post`
#
# The goal is a first curated model for supported natural-language analytics:
# team/game performance, EPA/WPA, passing, rushing, penalties, special teams,
# situational football, and player leaderboards.
#
# Known unsupported gaps are intentionally not modeled here:
# true play-action tagging, true tight-window tracking, and rushing yards over
# expected.

# %%
from datetime import datetime, timezone

SILVER_SCHEMA = "silver"
GOLD_SCHEMA = "gold"
BRONZE_SCHEMA = "bronze"
WRITE_MODE = "overwrite"
RUN_UTC = datetime.now(timezone.utc).isoformat()

print(f"Notebook run UTC: {RUN_UTC}")


def run_sql(statement: str) -> None:
    print(statement.strip().splitlines()[0])
    spark.sql(statement)


def display_table_counts(schema_name: str) -> None:
    rows = []
    for table in spark.sql(f"SHOW TABLES IN `{schema_name}`").collect():
        if not table.isTemporary:
            full_name = f"`{schema_name}`.`{table.tableName}`"
            rows.append(
                {
                    "schema": schema_name,
                    "table": table.tableName,
                    "rows": spark.table(full_name).count(),
                    "columns": len(spark.table(full_name).columns),
                }
            )
    display(spark.createDataFrame(rows).orderBy("schema", "table"))


run_sql(f"CREATE SCHEMA IF NOT EXISTS `{SILVER_SCHEMA}`")
run_sql(f"CREATE SCHEMA IF NOT EXISTS `{GOLD_SCHEMA}`")

# %% [markdown]
# ## Silver Tables
#
# Silver tables clean and conform the source fields. The wide PBP table remains
# in Bronze; Silver keeps a curated play table with derived football flags and
# buckets used by the Gold facts.

# %%
run_sql(
    f"""
    CREATE OR REPLACE TABLE {SILVER_SCHEMA}.teams
    USING DELTA
    AS
    SELECT DISTINCT
        team_abbr AS team_key,
        team_abbr AS team_code,
        team_name,
        team_nick,
        team_conf,
        team_division,
        team_color,
        team_color2,
        team_logo_espn,
        team_wordmark
    FROM {BRONZE_SCHEMA}.nflverse_teams
    WHERE team_abbr IS NOT NULL
    """
)

run_sql(
    f"""
    CREATE OR REPLACE TABLE {SILVER_SCHEMA}.games
    USING DELTA
    AS
    SELECT DISTINCT
        game_id AS game_key,
        game_id,
        old_game_id,
        CAST(season AS INT) AS season,
        CAST(week AS INT) AS week,
        game_type,
        CASE WHEN game_type = 'REG' THEN 'REG' ELSE 'POST' END AS season_type,
        CAST(gameday AS DATE) AS game_date,
        weekday,
        gametime,
        away_team,
        home_team,
        CAST(away_score AS INT) AS away_score,
        CAST(home_score AS INT) AS home_score,
        CAST(home_score AS INT) + CAST(away_score AS INT) AS total_points,
        CASE
            WHEN home_score > away_score THEN home_team
            WHEN away_score > home_score THEN away_team
            ELSE NULL
        END AS winning_team,
        CASE
            WHEN home_score > away_score THEN away_team
            WHEN away_score > home_score THEN home_team
            ELSE NULL
        END AS losing_team,
        CASE WHEN home_score = away_score THEN true ELSE false END AS is_tie,
        CASE WHEN overtime = 1 THEN true ELSE false END AS is_overtime,
        location,
        stadium,
        stadium_id,
        roof,
        surface,
        CAST(temp AS INT) AS temp,
        CAST(wind AS INT) AS wind,
        home_coach,
        away_coach,
        home_qb_id,
        home_qb_name,
        away_qb_id,
        away_qb_name,
        spread_line,
        total_line,
        div_game
    FROM {BRONZE_SCHEMA}.nflverse_schedules
    WHERE game_id IS NOT NULL
    """
)

run_sql(
    f"""
    CREATE OR REPLACE TABLE {SILVER_SCHEMA}.players
    USING DELTA
    AS
    WITH roster_names AS (
        SELECT
            gsis_id AS player_key,
            MAX(full_name) AS roster_full_name,
            MAX(football_name) AS roster_football_name,
            MAX(position) AS roster_position,
            MAX(headshot_url) AS roster_headshot_url,
            MIN(CAST(season AS INT)) AS first_roster_season,
            MAX(CAST(season AS INT)) AS last_roster_season
        FROM {BRONZE_SCHEMA}.nflverse_rosters
        WHERE gsis_id IS NOT NULL
        GROUP BY gsis_id
    )
    SELECT
        COALESCE(p.gsis_id, r.player_key) AS player_key,
        COALESCE(p.display_name, r.roster_full_name, r.roster_football_name) AS display_name,
        p.first_name,
        p.last_name,
        p.short_name,
        p.football_name,
        COALESCE(p.position, r.roster_position) AS position,
        p.position_group,
        p.birth_date,
        p.height,
        p.weight,
        COALESCE(p.headshot, r.roster_headshot_url) AS headshot_url,
        p.college_name,
        p.rookie_season,
        p.last_season,
        p.latest_team,
        p.status,
        r.first_roster_season,
        r.last_roster_season
    FROM {BRONZE_SCHEMA}.nflverse_players p
    FULL OUTER JOIN roster_names r
        ON p.gsis_id = r.player_key
    WHERE COALESCE(p.gsis_id, r.player_key) IS NOT NULL
    """
)

run_sql(
    f"""
    CREATE OR REPLACE TABLE {SILVER_SCHEMA}.player_team_season
    USING DELTA
    AS
    SELECT
        CAST(season AS INT) AS season,
        team AS team_key,
        gsis_id AS player_key,
        MAX(full_name) AS player_name,
        MAX(position) AS position,
        MAX(depth_chart_position) AS depth_chart_position,
        MAX(status) AS status,
        MAX(jersey_number) AS jersey_number
    FROM {BRONZE_SCHEMA}.nflverse_rosters
    WHERE gsis_id IS NOT NULL
      AND team IS NOT NULL
      AND season IS NOT NULL
    GROUP BY CAST(season AS INT), team, gsis_id
    """
)

# %%
run_sql(
    f"""
    CREATE OR REPLACE TABLE {SILVER_SCHEMA}.play_by_play
    USING DELTA
    AS
    WITH base AS (
        SELECT
            *,
            CONCAT(game_id, '_', CAST(CAST(play_id AS BIGINT) AS STRING)) AS play_key,
            game_id AS game_key,
            CONCAT(CAST(season AS STRING), '_', LPAD(CAST(week AS STRING), 2, '0')) AS season_week_key,
            posteam AS offense_team_key,
            defteam AS defense_team_key,
            CASE WHEN COALESCE(CAST(play_deleted AS INT), 0) = 1 THEN true ELSE false END AS is_deleted_play,
            CASE WHEN season_type = 'REG' THEN true ELSE false END AS is_regular_season,
            CASE WHEN season_type <> 'REG' THEN true ELSE false END AS is_postseason,
            CASE WHEN COALESCE(CAST(qb_dropback AS INT), 0) = 1 AND COALESCE(CAST(qb_spike AS INT), 0) = 0 THEN true ELSE false END AS is_dropback,
            CASE WHEN COALESCE(CAST(pass_attempt AS INT), 0) = 1 THEN true ELSE false END AS is_official_pass_attempt,
            CASE WHEN COALESCE(CAST(rush_attempt AS INT), 0) = 1 AND COALESCE(CAST(qb_kneel AS INT), 0) = 0 THEN true ELSE false END AS is_rush_attempt,
            CASE WHEN COALESCE(CAST(rush_attempt AS INT), 0) = 1 AND COALESCE(CAST(qb_kneel AS INT), 0) = 0 AND COALESCE(CAST(qb_scramble AS INT), 0) = 0 THEN true ELSE false END AS is_designed_rush,
            CASE WHEN COALESCE(CAST(qb_scramble AS INT), 0) = 1 THEN true ELSE false END AS is_qb_scramble,
            CASE WHEN COALESCE(CAST(qb_kneel AS INT), 0) = 1 THEN true ELSE false END AS is_qb_kneel,
            CASE WHEN COALESCE(CAST(qb_spike AS INT), 0) = 1 THEN true ELSE false END AS is_qb_spike,
            CASE WHEN COALESCE(CAST(sack AS INT), 0) = 1 THEN true ELSE false END AS is_sack,
            CASE WHEN COALESCE(CAST(qb_hit AS INT), 0) = 1 THEN true ELSE false END AS is_qb_hit,
            CASE WHEN COALESCE(CAST(complete_pass AS INT), 0) = 1 THEN true ELSE false END AS is_complete_pass,
            CASE WHEN COALESCE(CAST(interception AS INT), 0) = 1 THEN true ELSE false END AS is_interception,
            CASE WHEN COALESCE(CAST(fumble_lost AS INT), 0) = 1 THEN true ELSE false END AS is_fumble_lost,
            CASE WHEN COALESCE(CAST(touchdown AS INT), 0) = 1 THEN true ELSE false END AS is_touchdown,
            CASE WHEN COALESCE(CAST(pass_touchdown AS INT), 0) = 1 THEN true ELSE false END AS is_pass_touchdown,
            CASE WHEN COALESCE(CAST(rush_touchdown AS INT), 0) = 1 THEN true ELSE false END AS is_rush_touchdown,
            CASE WHEN COALESCE(CAST(td_team AS STRING), '') = COALESCE(CAST(posteam AS STRING), '') THEN true ELSE false END AS is_touchdown_by_offense,
            CASE WHEN COALESCE(CAST(penalty AS INT), 0) = 1 THEN true ELSE false END AS is_penalty,
            CASE WHEN penalty_type IS NOT NULL OR COALESCE(CAST(penalty AS INT), 0) = 1 THEN true ELSE false END AS is_accepted_penalty,
            CASE WHEN COALESCE(CAST(special_teams_play AS INT), 0) = 1 OR COALESCE(CAST(field_goal_attempt AS INT), 0) = 1 OR COALESCE(CAST(punt_attempt AS INT), 0) = 1 OR COALESCE(CAST(kickoff_attempt AS INT), 0) = 1 THEN true ELSE false END AS is_special_teams_play,
            CASE WHEN COALESCE(CAST(field_goal_attempt AS INT), 0) = 1 THEN true ELSE false END AS is_field_goal_attempt,
            CASE WHEN field_goal_result = 'made' THEN true ELSE false END AS is_field_goal_made,
            CASE WHEN yardline_100 <= 20 THEN true ELSE false END AS is_red_zone,
            CASE WHEN COALESCE(CAST(goal_to_go AS INT), 0) = 1 THEN true ELSE false END AS is_goal_to_go,
            CASE WHEN yardline_100 <= 5 THEN true ELSE false END AS is_goal_line,
            CASE WHEN CAST(down AS INT) = 3 THEN true ELSE false END AS is_third_down,
            CASE WHEN CAST(down AS INT) = 4 THEN true ELSE false END AS is_fourth_down,
            CASE WHEN CAST(down AS INT) IN (1, 2) THEN true ELSE false END AS is_early_down,
            CASE WHEN quarter_seconds_remaining <= 120 THEN true ELSE false END AS is_late_quarter,
            CASE WHEN half_seconds_remaining <= 120 THEN true ELSE false END AS is_late_half,
            CASE WHEN ABS(score_differential) <= 8 THEN true ELSE false END AS is_one_score_state,
            CASE WHEN COALESCE(CAST(success AS INT), CASE WHEN epa > 0 THEN 1 ELSE 0 END) = 1 THEN true ELSE false END AS is_successful_play,
            CASE WHEN COALESCE(CAST(third_down_converted AS INT), 0) = 1 THEN true ELSE false END AS is_third_down_converted,
            CASE WHEN COALESCE(CAST(third_down_failed AS INT), 0) = 1 THEN true ELSE false END AS is_third_down_failed,
            CASE WHEN COALESCE(CAST(fourth_down_converted AS INT), 0) = 1 THEN true ELSE false END AS is_fourth_down_converted,
            CASE WHEN COALESCE(CAST(fourth_down_failed AS INT), 0) = 1 THEN true ELSE false END AS is_fourth_down_failed,
            CASE WHEN COALESCE(CAST(first_down AS INT), 0) = 1 OR COALESCE(CAST(touchdown AS INT), 0) = 1 THEN true ELSE false END AS is_first_down_or_touchdown,
            CASE WHEN COALESCE(CAST(pass_attempt AS INT), 0) = 1 AND air_yards >= 20 THEN true ELSE false END AS is_deep_pass,
            CASE WHEN COALESCE(CAST(qb_dropback AS INT), 0) = 1 AND yards_gained >= 20 THEN true ELSE false END AS is_explosive_pass,
            CASE WHEN COALESCE(CAST(rush_attempt AS INT), 0) = 1 AND COALESCE(CAST(qb_kneel AS INT), 0) = 0 AND yards_gained >= 10 THEN true ELSE false END AS is_explosive_rush,
            CASE WHEN COALESCE(CAST(interception AS INT), 0) = 1 OR COALESCE(CAST(fumble_lost AS INT), 0) = 1 THEN true ELSE false END AS is_turnover,
            CASE WHEN COALESCE(CAST(no_huddle AS INT), 0) = 1 THEN true ELSE false END AS is_no_huddle,
            CASE WHEN COALESCE(CAST(shotgun AS INT), 0) = 1 THEN true ELSE false END AS is_shotgun
        FROM {BRONZE_SCHEMA}.nflverse_pbp
        WHERE game_id IS NOT NULL
          AND play_id IS NOT NULL
          AND season IS NOT NULL
    )
    SELECT
        play_key,
        game_key,
        season_week_key,
        CAST(season AS INT) AS season,
        CAST(week AS INT) AS week,
        season_type,
        CAST(play_id AS BIGINT) AS play_id,
        old_game_id,
        CAST(game_date AS DATE) AS game_date,
        home_team,
        away_team,
        offense_team_key,
        defense_team_key,
        posteam_type,
        side_of_field,
        CAST(yardline_100 AS DOUBLE) AS yardline_100,
        CAST(qtr AS INT) AS qtr,
        game_half,
        CAST(down AS INT) AS down,
        CAST(ydstogo AS DOUBLE) AS ydstogo,
        CAST(ydsnet AS DOUBLE) AS ydsnet,
        CAST(drive AS INT) AS drive,
        CONCAT(game_id, '_', CAST(CAST(COALESCE(fixed_drive, drive) AS BIGINT) AS STRING)) AS drive_key,
        time,
        yrdln,
        CAST(quarter_seconds_remaining AS DOUBLE) AS quarter_seconds_remaining,
        CAST(half_seconds_remaining AS DOUBLE) AS half_seconds_remaining,
        CAST(game_seconds_remaining AS DOUBLE) AS game_seconds_remaining,
        play_type,
        play_type_nfl,
        CASE
            WHEN is_dropback THEN 'Dropback'
            WHEN is_designed_rush THEN 'Designed rush'
            WHEN is_qb_scramble THEN 'QB scramble'
            WHEN is_special_teams_play THEN 'Special teams'
            WHEN play_type = 'no_play' THEN 'No play'
            ELSE COALESCE(play_type, 'Unknown')
        END AS play_type_group,
        desc AS play_description,
        CAST(yards_gained AS DOUBLE) AS yards_gained,
        CAST(passing_yards AS DOUBLE) AS passing_yards,
        CAST(receiving_yards AS DOUBLE) AS receiving_yards,
        CAST(rushing_yards AS DOUBLE) AS rushing_yards,
        pass_length,
        pass_location,
        CAST(air_yards AS DOUBLE) AS air_yards,
        CAST(yards_after_catch AS DOUBLE) AS yards_after_catch,
        run_location,
        run_gap,
        CAST(kick_distance AS DOUBLE) AS kick_distance,
        field_goal_result,
        extra_point_result,
        two_point_conv_result,
        st_play_type,
        CAST(home_timeouts_remaining AS INT) AS home_timeouts_remaining,
        CAST(away_timeouts_remaining AS INT) AS away_timeouts_remaining,
        CAST(posteam_timeouts_remaining AS INT) AS offense_timeouts_remaining,
        CAST(defteam_timeouts_remaining AS INT) AS defense_timeouts_remaining,
        CAST(total_home_score AS INT) AS total_home_score,
        CAST(total_away_score AS INT) AS total_away_score,
        CAST(posteam_score AS INT) AS offense_score,
        CAST(defteam_score AS INT) AS defense_score,
        CAST(score_differential AS INT) AS score_differential,
        CAST(posteam_score_post AS INT) AS offense_score_post,
        CAST(defteam_score_post AS INT) AS defense_score_post,
        CAST(score_differential_post AS INT) AS score_differential_post,
        CAST(ep AS DOUBLE) AS ep,
        CAST(epa AS DOUBLE) AS epa,
        CAST(qb_epa AS DOUBLE) AS qb_epa,
        CAST(air_epa AS DOUBLE) AS air_epa,
        CAST(yac_epa AS DOUBLE) AS yac_epa,
        CAST(cp AS DOUBLE) AS cp,
        CAST(cpoe AS DOUBLE) AS cpoe,
        CAST(wp AS DOUBLE) AS wp,
        CAST(def_wp AS DOUBLE) AS def_wp,
        CAST(home_wp AS DOUBLE) AS home_wp,
        CAST(away_wp AS DOUBLE) AS away_wp,
        CAST(wpa AS DOUBLE) AS wpa,
        CAST(vegas_wpa AS DOUBLE) AS vegas_wpa,
        passer_player_id,
        passer_player_name,
        receiver_player_id,
        receiver_player_name,
        rusher_player_id,
        rusher_player_name,
        kicker_player_id,
        kicker_player_name,
        punter_player_id,
        punter_player_name,
        sack_player_id,
        sack_player_name,
        half_sack_1_player_id,
        half_sack_1_player_name,
        half_sack_2_player_id,
        half_sack_2_player_name,
        qb_hit_1_player_id,
        qb_hit_1_player_name,
        qb_hit_2_player_id,
        qb_hit_2_player_name,
        penalty_team,
        penalty_player_id,
        penalty_player_name,
        penalty_type,
        CAST(penalty_yards AS DOUBLE) AS penalty_yards,
        return_team,
        CAST(return_yards AS DOUBLE) AS return_yards,
        td_team,
        td_player_id,
        td_player_name,
        CASE WHEN offense_team_key = 'SEA' OR defense_team_key = 'SEA' THEN true ELSE false END AS is_seahawks_play,
        CASE WHEN offense_team_key = 'SEA' THEN true ELSE false END AS is_seahawks_offense,
        CASE WHEN defense_team_key = 'SEA' THEN true ELSE false END AS is_seahawks_defense,
        is_regular_season,
        is_postseason,
        is_deleted_play,
        is_dropback,
        is_official_pass_attempt,
        is_rush_attempt,
        is_designed_rush,
        is_qb_scramble,
        is_qb_kneel,
        is_qb_spike,
        CASE WHEN (is_dropback OR is_designed_rush) AND NOT is_deleted_play THEN true ELSE false END AS is_offensive_play,
        is_sack,
        is_qb_hit,
        is_complete_pass,
        is_interception,
        is_fumble_lost,
        is_touchdown,
        is_pass_touchdown,
        is_rush_touchdown,
        is_touchdown_by_offense,
        is_penalty,
        is_accepted_penalty,
        is_special_teams_play,
        is_field_goal_attempt,
        is_field_goal_made,
        is_red_zone,
        is_goal_to_go,
        is_goal_line,
        is_third_down,
        is_fourth_down,
        is_early_down,
        is_late_quarter,
        is_late_half,
        is_one_score_state,
        is_successful_play,
        is_third_down_converted,
        is_third_down_failed,
        is_fourth_down_converted,
        is_fourth_down_failed,
        is_first_down_or_touchdown,
        is_deep_pass,
        is_explosive_pass,
        is_explosive_rush,
        CASE WHEN is_explosive_pass OR is_explosive_rush THEN true ELSE false END AS is_explosive_play,
        is_turnover,
        is_no_huddle,
        is_shotgun,
        CASE
            WHEN yardline_100 IS NULL THEN 'Unknown'
            WHEN yardline_100 <= 5 THEN 'Goal line'
            WHEN yardline_100 <= 20 THEN 'Red zone'
            WHEN yardline_100 <= 40 THEN 'Opponent territory'
            WHEN yardline_100 <= 59 THEN 'Midfield'
            ELSE 'Own territory'
        END AS field_zone,
        CASE
            WHEN score_differential IS NULL THEN 'Unknown'
            WHEN score_differential = 0 THEN 'Tied'
            WHEN score_differential BETWEEN 1 AND 8 THEN 'Leading one score'
            WHEN score_differential > 8 THEN 'Leading multiple scores'
            WHEN score_differential BETWEEN -8 AND -1 THEN 'Trailing one score'
            ELSE 'Trailing multiple scores'
        END AS score_state,
        CASE
            WHEN qtr IS NULL THEN 'Unknown'
            WHEN qtr <= 2 AND half_seconds_remaining <= 120 THEN 'First half final two minutes'
            WHEN qtr >= 3 AND half_seconds_remaining <= 120 THEN 'Second half final two minutes'
            WHEN qtr = 4 THEN 'Fourth quarter'
            WHEN qtr <= 2 THEN 'First half'
            WHEN qtr <= 4 THEN 'Second half'
            ELSE 'Overtime'
        END AS time_context,
        CASE
            WHEN down IS NULL THEN 'Unknown'
            WHEN down = 1 THEN '1st down'
            WHEN down = 2 AND ydstogo <= 3 THEN '2nd short'
            WHEN down = 2 AND ydstogo BETWEEN 4 AND 6 THEN '2nd medium'
            WHEN down = 2 AND ydstogo >= 7 THEN '2nd long'
            WHEN down IN (3, 4) AND ydstogo <= 3 THEN '3rd/4th short'
            WHEN down IN (3, 4) AND ydstogo BETWEEN 4 AND 6 THEN '3rd/4th medium'
            WHEN down IN (3, 4) AND ydstogo >= 7 THEN '3rd/4th long'
            ELSE 'Other'
        END AS down_distance_bucket,
        _source_file_path,
        _bronze_ingested_at_utc,
        _source_system,
        _source_dataset,
        _acquisition_batch_id
    FROM base
    WHERE NOT is_deleted_play
    """
)

# %% [markdown]
# ## Gold Dimensions

# %%
run_sql(
    f"""
    CREATE OR REPLACE TABLE {GOLD_SCHEMA}.dim_team
    USING DELTA
    AS
    SELECT * FROM {SILVER_SCHEMA}.teams
    """
)

run_sql(
    f"""
    CREATE OR REPLACE TABLE {GOLD_SCHEMA}.dim_game
    USING DELTA
    AS
    SELECT * FROM {SILVER_SCHEMA}.games
    """
)

run_sql(
    f"""
    CREATE OR REPLACE TABLE {GOLD_SCHEMA}.dim_player
    USING DELTA
    AS
    SELECT * FROM {SILVER_SCHEMA}.players
    """
)

run_sql(
    f"""
    CREATE OR REPLACE TABLE {GOLD_SCHEMA}.dim_season_week
    USING DELTA
    AS
    SELECT DISTINCT
        season_week_key,
        season,
        week,
        season_type,
        CASE WHEN season_type = 'REG' THEN week ELSE 100 + week END AS season_week_sort
    FROM {SILVER_SCHEMA}.play_by_play
    WHERE season_week_key IS NOT NULL
    """
)

# %% [markdown]
# ## Gold Play Facts

# %%
run_sql(
    f"""
    CREATE OR REPLACE TABLE {GOLD_SCHEMA}.fact_play_core
    USING DELTA
    AS
    SELECT
        play_key,
        game_key,
        season_week_key,
        season,
        week,
        season_type,
        play_id,
        qtr,
        down,
        ydstogo,
        yardline_100,
        game_seconds_remaining,
        quarter_seconds_remaining,
        offense_team_key,
        defense_team_key,
        play_type,
        play_type_group,
        yards_gained,
        epa,
        wpa,
        wp,
        home_wp,
        away_wp,
        score_differential,
        total_home_score,
        total_away_score,
        is_red_zone,
        is_goal_line,
        is_third_down,
        is_fourth_down,
        is_explosive_pass,
        is_explosive_rush,
        is_explosive_play,
        is_turnover,
        play_description
    FROM {SILVER_SCHEMA}.play_by_play
    """
)

run_sql(
    f"""
    CREATE OR REPLACE TABLE {GOLD_SCHEMA}.fact_team_play
    USING DELTA
    AS
    SELECT
        play_key,
        game_key,
        season_week_key,
        season,
        week,
        season_type,
        offense_team_key AS team_key,
        defense_team_key AS opponent_team_key,
        'Offense' AS unit,
        true AS is_offense,
        false AS is_defense,
        play_type,
        play_type_group,
        field_zone,
        score_state,
        time_context,
        down_distance_bucket,
        down,
        ydstogo,
        yardline_100,
        yards_gained AS yards,
        epa,
        CAST(NULL AS DOUBLE) AS epa_allowed,
        CAST(NULL AS DOUBLE) AS defensive_epa_generated,
        wpa,
        CAST(CASE WHEN is_offensive_play THEN 1 ELSE 0 END AS INT) AS play_count,
        CAST(CASE WHEN is_offensive_play THEN 1 ELSE 0 END AS INT) AS offensive_play_count,
        CAST(0 AS INT) AS defensive_play_count,
        CAST(CASE WHEN is_dropback THEN 1 ELSE 0 END AS INT) AS dropback_count,
        CAST(CASE WHEN is_designed_rush THEN 1 ELSE 0 END AS INT) AS designed_rush_count,
        CAST(CASE WHEN is_rush_attempt THEN 1 ELSE 0 END AS INT) AS rush_attempt_count,
        CAST(CASE WHEN is_successful_play THEN 1 ELSE 0 END AS INT) AS successful_play_count,
        CAST(0 AS INT) AS defensive_success_count,
        CAST(CASE WHEN is_third_down THEN 1 ELSE 0 END AS INT) AS third_down_attempt_count,
        CAST(CASE WHEN is_third_down_converted THEN 1 ELSE 0 END AS INT) AS third_down_conversion_count,
        CAST(CASE WHEN is_fourth_down THEN 1 ELSE 0 END AS INT) AS fourth_down_attempt_count,
        CAST(CASE WHEN is_fourth_down_converted THEN 1 ELSE 0 END AS INT) AS fourth_down_conversion_count,
        CAST(CASE WHEN is_red_zone THEN 1 ELSE 0 END AS INT) AS red_zone_play_count,
        CAST(CASE WHEN is_goal_to_go THEN 1 ELSE 0 END AS INT) AS goal_to_go_play_count,
        CAST(CASE WHEN is_touchdown_by_offense THEN 1 ELSE 0 END AS INT) AS touchdown_count,
        CAST(CASE WHEN is_turnover THEN 1 ELSE 0 END AS INT) AS turnover_count,
        CAST(0 AS INT) AS takeaway_count,
        CAST(CASE WHEN is_explosive_play THEN 1 ELSE 0 END AS INT) AS explosive_play_count,
        CAST(CASE WHEN is_sack THEN 1 ELSE 0 END AS INT) AS sack_count,
        CAST(CASE WHEN is_qb_hit THEN 1 ELSE 0 END AS INT) AS qb_hit_count,
        is_regular_season,
        is_postseason
    FROM {SILVER_SCHEMA}.play_by_play
    WHERE offense_team_key IS NOT NULL
      AND defense_team_key IS NOT NULL
      AND is_offensive_play

    UNION ALL

    SELECT
        play_key,
        game_key,
        season_week_key,
        season,
        week,
        season_type,
        defense_team_key AS team_key,
        offense_team_key AS opponent_team_key,
        'Defense' AS unit,
        false AS is_offense,
        true AS is_defense,
        play_type,
        play_type_group,
        field_zone,
        score_state,
        time_context,
        down_distance_bucket,
        down,
        ydstogo,
        yardline_100,
        yards_gained AS yards,
        CAST(NULL AS DOUBLE) AS epa,
        epa AS epa_allowed,
        -epa AS defensive_epa_generated,
        -wpa AS wpa,
        CAST(CASE WHEN is_offensive_play THEN 1 ELSE 0 END AS INT) AS play_count,
        CAST(0 AS INT) AS offensive_play_count,
        CAST(CASE WHEN is_offensive_play THEN 1 ELSE 0 END AS INT) AS defensive_play_count,
        CAST(CASE WHEN is_dropback THEN 1 ELSE 0 END AS INT) AS dropback_count,
        CAST(CASE WHEN is_designed_rush THEN 1 ELSE 0 END AS INT) AS designed_rush_count,
        CAST(CASE WHEN is_rush_attempt THEN 1 ELSE 0 END AS INT) AS rush_attempt_count,
        CAST(0 AS INT) AS successful_play_count,
        CAST(CASE WHEN NOT is_successful_play THEN 1 ELSE 0 END AS INT) AS defensive_success_count,
        CAST(CASE WHEN is_third_down THEN 1 ELSE 0 END AS INT) AS third_down_attempt_count,
        CAST(CASE WHEN is_third_down_converted THEN 1 ELSE 0 END AS INT) AS third_down_conversion_count,
        CAST(CASE WHEN is_fourth_down THEN 1 ELSE 0 END AS INT) AS fourth_down_attempt_count,
        CAST(CASE WHEN is_fourth_down_converted THEN 1 ELSE 0 END AS INT) AS fourth_down_conversion_count,
        CAST(CASE WHEN is_red_zone THEN 1 ELSE 0 END AS INT) AS red_zone_play_count,
        CAST(CASE WHEN is_goal_to_go THEN 1 ELSE 0 END AS INT) AS goal_to_go_play_count,
        CAST(CASE WHEN is_touchdown_by_offense THEN 1 ELSE 0 END AS INT) AS touchdown_count,
        CAST(0 AS INT) AS turnover_count,
        CAST(CASE WHEN is_turnover THEN 1 ELSE 0 END AS INT) AS takeaway_count,
        CAST(CASE WHEN is_explosive_play THEN 1 ELSE 0 END AS INT) AS explosive_play_count,
        CAST(CASE WHEN is_sack THEN 1 ELSE 0 END AS INT) AS sack_count,
        CAST(CASE WHEN is_qb_hit THEN 1 ELSE 0 END AS INT) AS qb_hit_count,
        is_regular_season,
        is_postseason
    FROM {SILVER_SCHEMA}.play_by_play
    WHERE offense_team_key IS NOT NULL
      AND defense_team_key IS NOT NULL
      AND is_offensive_play
    """
)

run_sql(
    f"""
    CREATE OR REPLACE TABLE {GOLD_SCHEMA}.fact_pass_play
    USING DELTA
    AS
    SELECT
        p.play_key,
        p.game_key,
        p.season_week_key,
        p.season,
        p.week,
        p.season_type,
        p.offense_team_key,
        p.defense_team_key,
        p.passer_player_id AS passer_player_key,
        p.passer_player_name,
        COALESCE(pass_pos.position, dp.position) AS passer_position,
        p.receiver_player_id AS receiver_player_key,
        p.receiver_player_name,
        COALESCE(recv_pos.position, dr.position) AS receiver_position,
        p.pass_length,
        p.pass_location,
        p.air_yards,
        p.yards_after_catch,
        p.yards_gained,
        p.passing_yards,
        p.receiving_yards,
        p.epa,
        p.qb_epa,
        p.air_epa,
        p.yac_epa,
        p.wpa,
        p.cp,
        p.cpoe,
        p.down,
        p.ydstogo,
        p.qtr,
        p.score_differential,
        p.field_zone,
        p.score_state,
        p.time_context,
        p.down_distance_bucket,
        p.is_dropback,
        p.is_official_pass_attempt,
        p.is_complete_pass,
        p.is_interception,
        p.is_sack,
        p.is_qb_scramble,
        p.is_qb_hit,
        p.is_deep_pass,
        p.is_shotgun,
        p.is_no_huddle,
        p.is_third_down,
        p.is_first_down_or_touchdown,
        p.is_successful_play,
        p.is_pass_touchdown,
        p.is_red_zone,
        CAST(1 AS INT) AS dropback_count,
        CAST(CASE WHEN p.is_official_pass_attempt THEN 1 ELSE 0 END AS INT) AS pass_attempt_count,
        CAST(CASE WHEN p.is_complete_pass THEN 1 ELSE 0 END AS INT) AS completion_count,
        CAST(CASE WHEN p.is_interception THEN 1 ELSE 0 END AS INT) AS interception_count,
        CAST(CASE WHEN p.is_sack THEN 1 ELSE 0 END AS INT) AS sack_count,
        CAST(CASE WHEN p.is_qb_hit THEN 1 ELSE 0 END AS INT) AS qb_hit_count,
        CAST(CASE WHEN p.is_pass_touchdown THEN 1 ELSE 0 END AS INT) AS passing_touchdown_count,
        CAST(CASE WHEN p.is_deep_pass THEN 1 ELSE 0 END AS INT) AS deep_attempt_count,
        CAST(CASE WHEN p.is_third_down AND p.is_first_down_or_touchdown THEN 1 ELSE 0 END AS INT) AS third_down_conversion_count
    FROM {SILVER_SCHEMA}.play_by_play p
    LEFT JOIN {SILVER_SCHEMA}.player_team_season pass_pos
        ON p.passer_player_id = pass_pos.player_key
       AND p.offense_team_key = pass_pos.team_key
       AND p.season = pass_pos.season
    LEFT JOIN {GOLD_SCHEMA}.dim_player dp
        ON p.passer_player_id = dp.player_key
    LEFT JOIN {SILVER_SCHEMA}.player_team_season recv_pos
        ON p.receiver_player_id = recv_pos.player_key
       AND p.offense_team_key = recv_pos.team_key
       AND p.season = recv_pos.season
    LEFT JOIN {GOLD_SCHEMA}.dim_player dr
        ON p.receiver_player_id = dr.player_key
    WHERE p.is_dropback
    """
)

run_sql(
    f"""
    CREATE OR REPLACE TABLE {GOLD_SCHEMA}.fact_rush_play
    USING DELTA
    AS
    SELECT
        p.play_key,
        p.game_key,
        p.season_week_key,
        p.season,
        p.week,
        p.season_type,
        p.offense_team_key,
        p.defense_team_key,
        p.rusher_player_id AS rusher_player_key,
        p.rusher_player_name,
        COALESCE(rush_pos.position, dp.position) AS rusher_position,
        p.run_location,
        p.run_gap,
        p.yards_gained,
        p.rushing_yards,
        p.epa,
        p.wpa,
        p.down,
        p.ydstogo,
        p.qtr,
        p.score_differential,
        p.field_zone,
        p.score_state,
        p.time_context,
        p.down_distance_bucket,
        p.is_rush_attempt,
        p.is_designed_rush,
        p.is_qb_scramble,
        p.is_qb_kneel,
        p.is_explosive_rush,
        p.is_rush_touchdown,
        p.is_successful_play,
        p.is_first_down_or_touchdown,
        p.is_red_zone,
        CASE WHEN p.yards_gained <= 0 THEN true ELSE false END AS is_stuffed,
        CASE WHEN COALESCE(rush_pos.position, dp.position) IN ('RB', 'FB') THEN true ELSE false END AS is_rb_or_fb_carry,
        CAST(1 AS INT) AS rush_attempt_count,
        CAST(CASE WHEN p.is_designed_rush THEN 1 ELSE 0 END AS INT) AS designed_rush_count,
        CAST(CASE WHEN p.is_qb_scramble THEN 1 ELSE 0 END AS INT) AS qb_scramble_count,
        CAST(CASE WHEN p.is_successful_play THEN 1 ELSE 0 END AS INT) AS successful_rush_count,
        CAST(CASE WHEN p.yards_gained <= 0 THEN 1 ELSE 0 END AS INT) AS stuffed_rush_count,
        CAST(CASE WHEN p.is_explosive_rush THEN 1 ELSE 0 END AS INT) AS explosive_rush_count,
        CAST(CASE WHEN p.is_rush_touchdown THEN 1 ELSE 0 END AS INT) AS rushing_touchdown_count,
        CAST(CASE WHEN p.is_first_down_or_touchdown THEN 1 ELSE 0 END AS INT) AS conversion_count
    FROM {SILVER_SCHEMA}.play_by_play p
    LEFT JOIN {SILVER_SCHEMA}.player_team_season rush_pos
        ON p.rusher_player_id = rush_pos.player_key
       AND p.offense_team_key = rush_pos.team_key
       AND p.season = rush_pos.season
    LEFT JOIN {GOLD_SCHEMA}.dim_player dp
        ON p.rusher_player_id = dp.player_key
    WHERE p.is_rush_attempt
    """
)

run_sql(
    f"""
    CREATE OR REPLACE TABLE {GOLD_SCHEMA}.fact_penalty
    USING DELTA
    AS
    SELECT
        play_key,
        game_key,
        season_week_key,
        season,
        week,
        season_type,
        penalty_team AS penalty_team_key,
        CASE
            WHEN penalty_team = offense_team_key THEN defense_team_key
            WHEN penalty_team = defense_team_key THEN offense_team_key
            ELSE NULL
        END AS opponent_team_key,
        penalty_player_id AS penalty_player_key,
        penalty_player_name,
        penalty_type,
        penalty_yards,
        epa,
        wpa,
        is_accepted_penalty,
        CAST(CASE WHEN is_accepted_penalty THEN 1 ELSE 0 END AS INT) AS penalty_count
    FROM {SILVER_SCHEMA}.play_by_play
    WHERE is_accepted_penalty
       OR penalty_type IS NOT NULL
    """
)

run_sql(
    f"""
    CREATE OR REPLACE TABLE {GOLD_SCHEMA}.fact_special_teams_play
    USING DELTA
    AS
    SELECT
        play_key,
        game_key,
        season_week_key,
        season,
        week,
        season_type,
        offense_team_key AS team_key,
        defense_team_key AS opponent_team_key,
        CASE
            WHEN st_play_type IS NOT NULL THEN st_play_type
            WHEN is_field_goal_attempt THEN 'field_goal'
            WHEN play_type = 'extra_point' THEN 'extra_point'
            WHEN play_type = 'punt' THEN 'punt'
            WHEN play_type = 'kickoff' THEN 'kickoff'
            ELSE COALESCE(play_type, 'special_teams')
        END AS special_teams_type,
        kicker_player_id AS kicker_player_key,
        kicker_player_name,
        punter_player_id AS punter_player_key,
        punter_player_name,
        kick_distance,
        return_team,
        return_yards,
        field_goal_result,
        extra_point_result,
        is_field_goal_attempt,
        is_field_goal_made,
        CAST(CASE WHEN is_field_goal_attempt THEN 1 ELSE 0 END AS INT) AS field_goal_attempt_count,
        CAST(CASE WHEN is_field_goal_made THEN 1 ELSE 0 END AS INT) AS field_goal_made_count,
        CAST(CASE WHEN play_type = 'punt' THEN 1 ELSE 0 END AS INT) AS punt_count,
        CAST(CASE WHEN play_type = 'kickoff' THEN 1 ELSE 0 END AS INT) AS kickoff_count,
        epa,
        wpa
    FROM {SILVER_SCHEMA}.play_by_play
    WHERE is_special_teams_play
       OR is_field_goal_attempt
       OR play_type IN ('punt', 'kickoff', 'extra_point')
    """
)

# %%
run_sql(
    f"""
    CREATE OR REPLACE TABLE {GOLD_SCHEMA}.fact_player_play_role
    USING DELTA
    AS
    SELECT play_key, game_key, season_week_key, season, week, season_type, offense_team_key AS team_key, defense_team_key AS opponent_team_key, passer_player_id AS player_key, passer_player_name AS player_name_snapshot, 'passer' AS player_role, 1 AS role_sequence, CAST(1.0 AS DOUBLE) AS role_value
    FROM {SILVER_SCHEMA}.play_by_play WHERE passer_player_id IS NOT NULL
    UNION ALL
    SELECT play_key, game_key, season_week_key, season, week, season_type, offense_team_key, defense_team_key, receiver_player_id, receiver_player_name, 'receiver', 1, CAST(1.0 AS DOUBLE)
    FROM {SILVER_SCHEMA}.play_by_play WHERE receiver_player_id IS NOT NULL
    UNION ALL
    SELECT play_key, game_key, season_week_key, season, week, season_type, offense_team_key, defense_team_key, rusher_player_id, rusher_player_name, 'rusher', 1, CAST(1.0 AS DOUBLE)
    FROM {SILVER_SCHEMA}.play_by_play WHERE rusher_player_id IS NOT NULL
    UNION ALL
    SELECT play_key, game_key, season_week_key, season, week, season_type, defense_team_key, offense_team_key, sack_player_id, sack_player_name, 'sack', 1, CAST(1.0 AS DOUBLE)
    FROM {SILVER_SCHEMA}.play_by_play WHERE sack_player_id IS NOT NULL
    UNION ALL
    SELECT play_key, game_key, season_week_key, season, week, season_type, defense_team_key, offense_team_key, half_sack_1_player_id, half_sack_1_player_name, 'sack', 1, CAST(0.5 AS DOUBLE)
    FROM {SILVER_SCHEMA}.play_by_play WHERE half_sack_1_player_id IS NOT NULL
    UNION ALL
    SELECT play_key, game_key, season_week_key, season, week, season_type, defense_team_key, offense_team_key, half_sack_2_player_id, half_sack_2_player_name, 'sack', 2, CAST(0.5 AS DOUBLE)
    FROM {SILVER_SCHEMA}.play_by_play WHERE half_sack_2_player_id IS NOT NULL
    UNION ALL
    SELECT play_key, game_key, season_week_key, season, week, season_type, defense_team_key, offense_team_key, qb_hit_1_player_id, qb_hit_1_player_name, 'qb_hit', 1, CAST(1.0 AS DOUBLE)
    FROM {SILVER_SCHEMA}.play_by_play WHERE qb_hit_1_player_id IS NOT NULL
    UNION ALL
    SELECT play_key, game_key, season_week_key, season, week, season_type, defense_team_key, offense_team_key, qb_hit_2_player_id, qb_hit_2_player_name, 'qb_hit', 2, CAST(1.0 AS DOUBLE)
    FROM {SILVER_SCHEMA}.play_by_play WHERE qb_hit_2_player_id IS NOT NULL
    UNION ALL
    SELECT play_key, game_key, season_week_key, season, week, season_type, penalty_team, CASE WHEN penalty_team = offense_team_key THEN defense_team_key ELSE offense_team_key END, penalty_player_id, penalty_player_name, 'penalty', 1, CAST(1.0 AS DOUBLE)
    FROM {SILVER_SCHEMA}.play_by_play WHERE penalty_player_id IS NOT NULL
    UNION ALL
    SELECT play_key, game_key, season_week_key, season, week, season_type, offense_team_key, defense_team_key, kicker_player_id, kicker_player_name, 'kicker', 1, CAST(1.0 AS DOUBLE)
    FROM {SILVER_SCHEMA}.play_by_play WHERE kicker_player_id IS NOT NULL
    UNION ALL
    SELECT play_key, game_key, season_week_key, season, week, season_type, offense_team_key, defense_team_key, punter_player_id, punter_player_name, 'punter', 1, CAST(1.0 AS DOUBLE)
    FROM {SILVER_SCHEMA}.play_by_play WHERE punter_player_id IS NOT NULL
    """
)

# %% [markdown]
# ## Gold Aggregates

# %%
run_sql(
    f"""
    CREATE OR REPLACE TABLE {GOLD_SCHEMA}.agg_team_game
    USING DELTA
    AS
    WITH team_games AS (
        SELECT
            game_key,
            season,
            week,
            season_type,
            home_team AS team_key,
            away_team AS opponent_team_key,
            'Home' AS home_away,
            home_score AS team_score,
            away_score AS opponent_score,
            CASE WHEN home_score > away_score THEN 'Win' WHEN home_score < away_score THEN 'Loss' ELSE 'Tie' END AS game_result
        FROM {GOLD_SCHEMA}.dim_game
        UNION ALL
        SELECT
            game_key,
            season,
            week,
            season_type,
            away_team AS team_key,
            home_team AS opponent_team_key,
            'Away' AS home_away,
            away_score AS team_score,
            home_score AS opponent_score,
            CASE WHEN away_score > home_score THEN 'Win' WHEN away_score < home_score THEN 'Loss' ELSE 'Tie' END AS game_result
        FROM {GOLD_SCHEMA}.dim_game
    ),
    play_metrics AS (
        SELECT
            team_key,
            game_key,
            SUM(offensive_play_count) AS offensive_plays,
            SUM(defensive_play_count) AS defensive_plays,
            SUM(CASE WHEN unit = 'Offense' THEN epa ELSE 0 END) AS offensive_epa,
            SUM(CASE WHEN unit = 'Defense' THEN epa_allowed ELSE 0 END) AS defensive_epa_allowed,
            SUM(CASE WHEN unit = 'Defense' THEN defensive_epa_generated ELSE 0 END) AS defensive_epa_generated,
            SUM(CASE WHEN unit = 'Offense' THEN wpa ELSE 0 END) AS wpa_total,
            SUM(CASE WHEN unit = 'Offense' THEN successful_play_count ELSE 0 END) AS successful_plays,
            SUM(CASE WHEN unit = 'Defense' THEN defensive_success_count ELSE 0 END) AS defensive_successes,
            SUM(CASE WHEN unit = 'Offense' THEN dropback_count ELSE 0 END) AS dropbacks,
            SUM(CASE WHEN unit = 'Offense' THEN designed_rush_count ELSE 0 END) AS designed_rushes,
            SUM(CASE WHEN unit = 'Offense' THEN rush_attempt_count ELSE 0 END) AS rush_attempts,
            SUM(CASE WHEN unit = 'Offense' AND play_type_group = 'Dropback' THEN epa ELSE 0 END) AS dropback_epa,
            SUM(CASE WHEN unit = 'Offense' AND play_type_group IN ('Designed rush', 'QB scramble') THEN epa ELSE 0 END) AS rush_epa,
            SUM(CASE WHEN unit = 'Offense' THEN turnover_count ELSE 0 END) AS turnovers,
            SUM(CASE WHEN unit = 'Defense' THEN takeaway_count ELSE 0 END) AS takeaways,
            SUM(CASE WHEN unit = 'Offense' THEN third_down_attempt_count ELSE 0 END) AS third_down_attempts,
            SUM(CASE WHEN unit = 'Offense' THEN third_down_conversion_count ELSE 0 END) AS third_down_conversions,
            SUM(CASE WHEN unit = 'Offense' THEN fourth_down_attempt_count ELSE 0 END) AS fourth_down_attempts,
            SUM(CASE WHEN unit = 'Offense' THEN fourth_down_conversion_count ELSE 0 END) AS fourth_down_conversions,
            SUM(CASE WHEN unit = 'Offense' THEN red_zone_play_count ELSE 0 END) AS red_zone_plays,
            SUM(CASE WHEN unit = 'Offense' THEN touchdown_count ELSE 0 END) AS offensive_touchdowns,
            SUM(CASE WHEN unit = 'Defense' THEN explosive_play_count ELSE 0 END) AS explosive_plays_allowed,
            SUM(CASE WHEN unit = 'Defense' THEN sack_count ELSE 0 END) AS sacks,
            SUM(CASE WHEN unit = 'Defense' THEN qb_hit_count ELSE 0 END) AS qb_hits
        FROM {GOLD_SCHEMA}.fact_team_play
        GROUP BY team_key, game_key
    ),
    penalty_metrics AS (
        SELECT
            penalty_team_key AS team_key,
            game_key,
            SUM(penalty_count) AS penalty_count,
            SUM(penalty_yards) AS penalty_yards
        FROM {GOLD_SCHEMA}.fact_penalty
        GROUP BY penalty_team_key, game_key
    ),
    red_zone_drives AS (
        SELECT
            offense_team_key AS team_key,
            game_key,
            COUNT(DISTINCT drive_key) AS red_zone_drives,
            COUNT(DISTINCT CASE WHEN is_touchdown_by_offense THEN drive_key END) AS red_zone_touchdown_drives
        FROM {SILVER_SCHEMA}.play_by_play
        WHERE is_red_zone
          AND is_offensive_play
          AND drive_key IS NOT NULL
        GROUP BY offense_team_key, game_key
    )
    SELECT
        tg.team_key,
        tg.game_key,
        tg.season,
        tg.week,
        tg.season_type,
        tg.opponent_team_key,
        tg.home_away,
        tg.team_score,
        tg.opponent_score,
        tg.game_result,
        COALESCE(pm.offensive_plays, 0) AS offensive_plays,
        COALESCE(pm.defensive_plays, 0) AS defensive_plays,
        COALESCE(pm.offensive_epa, 0.0) AS offensive_epa,
        COALESCE(pm.defensive_epa_allowed, 0.0) AS defensive_epa_allowed,
        COALESCE(pm.defensive_epa_generated, 0.0) AS defensive_epa_generated,
        COALESCE(pm.offensive_epa, 0.0) - COALESCE(pm.defensive_epa_allowed, 0.0) AS epa_differential,
        COALESCE(pm.wpa_total, 0.0) AS wpa_total,
        COALESCE(pm.successful_plays, 0) AS successful_plays,
        COALESCE(pm.defensive_successes, 0) AS defensive_successes,
        COALESCE(pm.dropbacks, 0) AS dropbacks,
        COALESCE(pm.designed_rushes, 0) AS designed_rushes,
        COALESCE(pm.rush_attempts, 0) AS rush_attempts,
        COALESCE(pm.dropback_epa, 0.0) AS dropback_epa,
        COALESCE(pm.rush_epa, 0.0) AS rush_epa,
        COALESCE(pm.turnovers, 0) AS turnovers,
        COALESCE(pm.takeaways, 0) AS takeaways,
        COALESCE(pm.third_down_attempts, 0) AS third_down_attempts,
        COALESCE(pm.third_down_conversions, 0) AS third_down_conversions,
        COALESCE(pm.fourth_down_attempts, 0) AS fourth_down_attempts,
        COALESCE(pm.fourth_down_conversions, 0) AS fourth_down_conversions,
        COALESCE(pm.red_zone_plays, 0) AS red_zone_plays,
        COALESCE(rz.red_zone_drives, 0) AS red_zone_drives,
        COALESCE(rz.red_zone_touchdown_drives, 0) AS red_zone_touchdown_drives,
        COALESCE(pm.offensive_touchdowns, 0) AS offensive_touchdowns,
        COALESCE(pm.explosive_plays_allowed, 0) AS explosive_plays_allowed,
        COALESCE(pm.sacks, 0) AS sacks,
        COALESCE(pm.qb_hits, 0) AS qb_hits,
        COALESCE(pen.penalty_count, 0) AS penalty_count,
        COALESCE(pen.penalty_yards, 0.0) AS penalty_yards,
        CASE WHEN pm.offensive_plays > 0 THEN pm.offensive_epa / pm.offensive_plays END AS offensive_epa_per_play,
        CASE WHEN pm.defensive_plays > 0 THEN pm.defensive_epa_allowed / pm.defensive_plays END AS defensive_epa_allowed_per_play,
        CASE WHEN pm.defensive_plays > 0 THEN pm.defensive_epa_generated / pm.defensive_plays END AS defensive_epa_generated_per_play,
        CASE WHEN pm.offensive_plays > 0 THEN pm.successful_plays / pm.offensive_plays END AS success_rate,
        CASE WHEN pm.defensive_plays > 0 THEN pm.defensive_successes / pm.defensive_plays END AS defensive_success_rate,
        CASE WHEN (pm.dropbacks + pm.designed_rushes) > 0 THEN pm.dropbacks / (pm.dropbacks + pm.designed_rushes) END AS pass_rate,
        CASE WHEN pm.dropbacks > 0 THEN pm.dropback_epa / pm.dropbacks END AS dropback_epa_per_play,
        CASE WHEN pm.rush_attempts > 0 THEN pm.rush_epa / pm.rush_attempts END AS rush_epa_per_play,
        CASE WHEN pm.third_down_attempts > 0 THEN pm.third_down_conversions / pm.third_down_attempts END AS third_down_conversion_rate,
        CASE WHEN pm.fourth_down_attempts > 0 THEN pm.fourth_down_conversions / pm.fourth_down_attempts END AS fourth_down_conversion_rate,
        CASE WHEN rz.red_zone_drives > 0 THEN rz.red_zone_touchdown_drives / rz.red_zone_drives END AS red_zone_drive_td_rate
    FROM team_games tg
    LEFT JOIN play_metrics pm
        ON tg.team_key = pm.team_key
       AND tg.game_key = pm.game_key
    LEFT JOIN penalty_metrics pen
        ON tg.team_key = pen.team_key
       AND tg.game_key = pen.game_key
    LEFT JOIN red_zone_drives rz
        ON tg.team_key = rz.team_key
       AND tg.game_key = rz.game_key
    """
)

run_sql(
    f"""
    CREATE OR REPLACE TABLE {GOLD_SCHEMA}.agg_team_season
    USING DELTA
    AS
    SELECT
        team_key,
        season,
        season_type,
        COUNT(*) AS games,
        SUM(CASE WHEN game_result = 'Win' THEN 1 ELSE 0 END) AS wins,
        SUM(CASE WHEN game_result = 'Loss' THEN 1 ELSE 0 END) AS losses,
        SUM(CASE WHEN game_result = 'Tie' THEN 1 ELSE 0 END) AS ties,
        SUM(team_score) AS points_for,
        SUM(opponent_score) AS points_against,
        SUM(team_score) - SUM(opponent_score) AS point_differential,
        SUM(offensive_plays) AS offensive_plays,
        SUM(defensive_plays) AS defensive_plays,
        SUM(offensive_epa) AS offensive_epa,
        SUM(defensive_epa_allowed) AS defensive_epa_allowed,
        SUM(defensive_epa_generated) AS defensive_epa_generated,
        SUM(epa_differential) AS epa_differential,
        SUM(successful_plays) AS successful_plays,
        SUM(defensive_successes) AS defensive_successes,
        SUM(dropbacks) AS dropbacks,
        SUM(designed_rushes) AS designed_rushes,
        SUM(rush_attempts) AS rush_attempts,
        SUM(dropback_epa) AS dropback_epa,
        SUM(rush_epa) AS rush_epa,
        SUM(turnovers) AS turnovers,
        SUM(takeaways) AS takeaways,
        SUM(third_down_attempts) AS third_down_attempts,
        SUM(third_down_conversions) AS third_down_conversions,
        SUM(fourth_down_attempts) AS fourth_down_attempts,
        SUM(fourth_down_conversions) AS fourth_down_conversions,
        SUM(red_zone_plays) AS red_zone_plays,
        SUM(red_zone_drives) AS red_zone_drives,
        SUM(red_zone_touchdown_drives) AS red_zone_touchdown_drives,
        SUM(offensive_touchdowns) AS offensive_touchdowns,
        SUM(explosive_plays_allowed) AS explosive_plays_allowed,
        SUM(sacks) AS sacks,
        SUM(qb_hits) AS qb_hits,
        SUM(penalty_count) AS penalty_count,
        SUM(penalty_yards) AS penalty_yards,
        CASE WHEN SUM(offensive_plays) > 0 THEN SUM(offensive_epa) / SUM(offensive_plays) END AS offensive_epa_per_play,
        CASE WHEN SUM(defensive_plays) > 0 THEN SUM(defensive_epa_allowed) / SUM(defensive_plays) END AS defensive_epa_allowed_per_play,
        CASE WHEN SUM(defensive_plays) > 0 THEN SUM(defensive_epa_generated) / SUM(defensive_plays) END AS defensive_epa_generated_per_play,
        CASE WHEN SUM(offensive_plays) > 0 THEN SUM(epa_differential) / SUM(offensive_plays) END AS epa_differential_per_play,
        CASE WHEN SUM(offensive_plays) > 0 THEN SUM(successful_plays) / SUM(offensive_plays) END AS success_rate,
        CASE WHEN SUM(defensive_plays) > 0 THEN SUM(defensive_successes) / SUM(defensive_plays) END AS defensive_success_rate,
        CASE WHEN (SUM(dropbacks) + SUM(designed_rushes)) > 0 THEN SUM(dropbacks) / (SUM(dropbacks) + SUM(designed_rushes)) END AS pass_rate,
        CASE WHEN SUM(dropbacks) > 0 THEN SUM(dropback_epa) / SUM(dropbacks) END AS dropback_epa_per_play,
        CASE WHEN SUM(rush_attempts) > 0 THEN SUM(rush_epa) / SUM(rush_attempts) END AS rush_epa_per_play,
        CASE WHEN SUM(third_down_attempts) > 0 THEN SUM(third_down_conversions) / SUM(third_down_attempts) END AS third_down_conversion_rate,
        CASE WHEN SUM(fourth_down_attempts) > 0 THEN SUM(fourth_down_conversions) / SUM(fourth_down_attempts) END AS fourth_down_conversion_rate,
        CASE WHEN SUM(red_zone_drives) > 0 THEN SUM(red_zone_touchdown_drives) / SUM(red_zone_drives) END AS red_zone_drive_td_rate,
        CASE WHEN COUNT(*) > 0 THEN SUM(explosive_plays_allowed) / COUNT(*) END AS explosive_plays_allowed_per_game,
        RANK() OVER (PARTITION BY season, season_type ORDER BY CASE WHEN SUM(offensive_plays) > 0 THEN SUM(offensive_epa) / SUM(offensive_plays) END DESC NULLS LAST) AS offensive_epa_per_play_rank,
        RANK() OVER (PARTITION BY season, season_type ORDER BY CASE WHEN SUM(defensive_plays) > 0 THEN SUM(defensive_epa_allowed) / SUM(defensive_plays) END ASC NULLS LAST) AS defensive_epa_allowed_per_play_rank
    FROM {GOLD_SCHEMA}.agg_team_game
    GROUP BY team_key, season, season_type
    """
)

run_sql(
    f"""
    CREATE OR REPLACE TABLE {GOLD_SCHEMA}.agg_team_situation
    USING DELTA
    AS
    SELECT
        season,
        season_type,
        team_key,
        unit,
        field_zone,
        down_distance_bucket,
        score_state,
        time_context,
        play_type_group,
        SUM(play_count) AS plays,
        SUM(CASE WHEN unit = 'Offense' THEN epa ELSE defensive_epa_generated END) AS epa,
        SUM(successful_play_count) AS successful_plays,
        SUM(defensive_success_count) AS defensive_successes,
        SUM(dropback_count) AS dropbacks,
        SUM(designed_rush_count) AS designed_rushes,
        SUM(third_down_attempt_count) AS third_down_attempts,
        SUM(third_down_conversion_count) AS third_down_conversions,
        SUM(explosive_play_count) AS explosive_plays,
        CASE WHEN SUM(play_count) > 0 THEN SUM(CASE WHEN unit = 'Offense' THEN epa ELSE defensive_epa_generated END) / SUM(play_count) END AS epa_per_play,
        CASE WHEN SUM(play_count) > 0 THEN SUM(successful_play_count) / SUM(play_count) END AS success_rate,
        CASE WHEN (SUM(dropback_count) + SUM(designed_rush_count)) > 0 THEN SUM(dropback_count) / (SUM(dropback_count) + SUM(designed_rush_count)) END AS pass_rate,
        CASE WHEN SUM(third_down_attempt_count) > 0 THEN SUM(third_down_conversion_count) / SUM(third_down_attempt_count) END AS third_down_conversion_rate,
        CASE WHEN SUM(play_count) > 0 THEN SUM(explosive_play_count) / SUM(play_count) END AS explosive_play_rate
    FROM {GOLD_SCHEMA}.fact_team_play
    GROUP BY season, season_type, team_key, unit, field_zone, down_distance_bucket, score_state, time_context, play_type_group
    """
)

run_sql(
    f"""
    CREATE OR REPLACE TABLE {GOLD_SCHEMA}.agg_player_season
    USING DELTA
    AS
    WITH metric_rows AS (
        SELECT
            season,
            season_type,
            offense_team_key AS team_key,
            passer_player_key AS player_key,
            passer_player_name AS player_name,
            passer_position AS position,
            dropback_count AS passing_dropbacks,
            pass_attempt_count AS attempts,
            completion_count AS completions,
            COALESCE(passing_yards, 0.0) AS passing_yards,
            passing_touchdown_count AS passing_tds,
            interception_count AS interceptions,
            sack_count AS sacks_taken,
            epa AS passing_epa,
            cpoe AS cpoe_sum,
            pass_attempt_count AS cpoe_attempts,
            CASE WHEN is_deep_pass THEN pass_attempt_count ELSE 0 END AS deep_attempts,
            CASE WHEN is_deep_pass THEN completion_count ELSE 0 END AS deep_completions,
            CASE WHEN is_deep_pass THEN cpoe ELSE NULL END AS deep_cpoe_sum,
            CASE WHEN is_no_huddle THEN dropback_count ELSE 0 END AS no_huddle_dropbacks,
            CASE WHEN is_no_huddle THEN epa ELSE 0.0 END AS no_huddle_epa,
            CASE WHEN NOT is_no_huddle THEN dropback_count ELSE 0 END AS huddle_dropbacks,
            CASE WHEN NOT is_no_huddle THEN epa ELSE 0.0 END AS huddle_epa,
            CAST(0 AS INT) AS rushing_attempts,
            CAST(0.0 AS DOUBLE) AS rushing_yards,
            CAST(0 AS INT) AS rushing_tds,
            CAST(0.0 AS DOUBLE) AS rushing_epa,
            CAST(0 AS INT) AS stuffed_rushes,
            CAST(0 AS INT) AS explosive_rushes,
            CAST(0 AS INT) AS rush_conversions,
            CAST(0 AS INT) AS targets,
            CAST(0 AS INT) AS receptions,
            CAST(0.0 AS DOUBLE) AS receiving_yards,
            CAST(0.0 AS DOUBLE) AS receiving_epa,
            CAST(0.0 AS DOUBLE) AS yards_after_catch,
            CAST(0.0 AS DOUBLE) AS yac_epa,
            CAST(0.0 AS DOUBLE) AS sacks_defense,
            CAST(0.0 AS DOUBLE) AS qb_hits_defense,
            CAST(0 AS INT) AS field_goal_attempts,
            CAST(0 AS INT) AS field_goals_made
        FROM {GOLD_SCHEMA}.fact_pass_play
        WHERE passer_player_key IS NOT NULL

        UNION ALL

        SELECT
            season,
            season_type,
            offense_team_key AS team_key,
            rusher_player_key AS player_key,
            rusher_player_name AS player_name,
            rusher_position AS position,
            0, 0, 0, 0.0, 0, 0, 0, 0.0, NULL, 0, 0, 0, NULL, 0, 0.0, 0, 0.0,
            rush_attempt_count,
            COALESCE(rushing_yards, yards_gained, 0.0) AS rushing_yards,
            rushing_touchdown_count,
            epa AS rushing_epa,
            stuffed_rush_count,
            explosive_rush_count,
            conversion_count,
            0, 0, 0.0, 0.0, 0.0, 0.0, 0, 0, 0, 0
        FROM {GOLD_SCHEMA}.fact_rush_play
        WHERE rusher_player_key IS NOT NULL

        UNION ALL

        SELECT
            season,
            season_type,
            offense_team_key AS team_key,
            receiver_player_key AS player_key,
            receiver_player_name AS player_name,
            receiver_position AS position,
            0, 0, 0, 0.0, 0, 0, 0, 0.0, NULL, 0, 0, 0, NULL, 0, 0.0, 0, 0.0,
            0, 0.0, 0, 0.0, 0, 0, 0,
            pass_attempt_count AS targets,
            completion_count AS receptions,
            COALESCE(receiving_yards, 0.0) AS receiving_yards,
            epa AS receiving_epa,
            COALESCE(yards_after_catch, 0.0) AS yards_after_catch,
            COALESCE(yac_epa, 0.0) AS yac_epa,
            0, 0, 0, 0
        FROM {GOLD_SCHEMA}.fact_pass_play
        WHERE receiver_player_key IS NOT NULL

        UNION ALL

        SELECT
            r.season,
            r.season_type,
            r.team_key,
            r.player_key,
            r.player_name_snapshot,
            dp.position,
            0, 0, 0, 0.0, 0, 0, 0, 0.0, NULL, 0, 0, 0, NULL, 0, 0.0, 0, 0.0,
            0, 0.0, 0, 0.0, 0, 0, 0,
            0, 0, 0.0, 0.0, 0.0, 0.0,
            CASE WHEN r.player_role = 'sack' THEN r.role_value ELSE 0.0 END AS sacks_defense,
            CASE WHEN r.player_role = 'qb_hit' THEN r.role_value ELSE 0.0 END AS qb_hits_defense,
            0, 0
        FROM {GOLD_SCHEMA}.fact_player_play_role r
        LEFT JOIN {GOLD_SCHEMA}.dim_player dp ON r.player_key = dp.player_key
        WHERE r.player_role IN ('sack', 'qb_hit')

        UNION ALL

        SELECT
            season,
            season_type,
            team_key,
            kicker_player_key AS player_key,
            kicker_player_name AS player_name,
            'K' AS position,
            0, 0, 0, 0.0, 0, 0, 0, 0.0, NULL, 0, 0, 0, NULL, 0, 0.0, 0, 0.0,
            0, 0.0, 0, 0.0, 0, 0, 0,
            0, 0, 0.0, 0.0, 0.0, 0.0, 0, 0,
            field_goal_attempt_count,
            field_goal_made_count
        FROM {GOLD_SCHEMA}.fact_special_teams_play
        WHERE kicker_player_key IS NOT NULL
          AND is_field_goal_attempt
    )
    SELECT
        season,
        season_type,
        team_key,
        player_key,
        MAX(player_name) AS player_name,
        MAX(position) AS position,
        SUM(passing_dropbacks) AS passing_dropbacks,
        SUM(attempts) AS attempts,
        SUM(completions) AS completions,
        SUM(passing_yards) AS passing_yards,
        SUM(passing_tds) AS passing_tds,
        SUM(interceptions) AS interceptions,
        SUM(sacks_taken) AS sacks_taken,
        SUM(passing_epa) AS passing_epa,
        CASE WHEN SUM(passing_dropbacks) > 0 THEN SUM(passing_epa) / SUM(passing_dropbacks) END AS passing_epa_per_dropback,
        CASE WHEN SUM(attempts) > 0 THEN SUM(completions) / SUM(attempts) END AS completion_percentage,
        CASE WHEN SUM(interceptions) > 0 THEN SUM(passing_tds) / SUM(interceptions) END AS td_to_int_ratio,
        CASE WHEN SUM(cpoe_attempts) > 0 THEN SUM(cpoe_sum) / SUM(cpoe_attempts) END AS avg_cpoe,
        SUM(deep_attempts) AS deep_attempts,
        SUM(deep_completions) AS deep_completions,
        CASE WHEN SUM(deep_attempts) > 0 THEN SUM(deep_completions) / SUM(deep_attempts) END AS deep_completion_percentage,
        CASE WHEN SUM(deep_attempts) > 0 THEN SUM(deep_cpoe_sum) / SUM(deep_attempts) END AS deep_avg_cpoe,
        SUM(no_huddle_dropbacks) AS no_huddle_dropbacks,
        CASE WHEN SUM(no_huddle_dropbacks) > 0 THEN SUM(no_huddle_epa) / SUM(no_huddle_dropbacks) END AS no_huddle_epa_per_dropback,
        SUM(huddle_dropbacks) AS huddle_dropbacks,
        CASE WHEN SUM(huddle_dropbacks) > 0 THEN SUM(huddle_epa) / SUM(huddle_dropbacks) END AS huddle_epa_per_dropback,
        SUM(rushing_attempts) AS rushing_attempts,
        SUM(rushing_yards) AS rushing_yards,
        SUM(rushing_tds) AS rushing_tds,
        SUM(rushing_epa) AS rushing_epa,
        CASE WHEN SUM(rushing_attempts) > 0 THEN SUM(rushing_epa) / SUM(rushing_attempts) END AS rushing_epa_per_play,
        SUM(stuffed_rushes) AS stuffed_rushes,
        CASE WHEN SUM(rushing_attempts) > 0 THEN SUM(stuffed_rushes) / SUM(rushing_attempts) END AS stuff_rate,
        SUM(explosive_rushes) AS explosive_rushes,
        CASE WHEN SUM(rushing_attempts) > 0 THEN SUM(explosive_rushes) / SUM(rushing_attempts) END AS explosive_rush_rate,
        SUM(rush_conversions) AS rush_conversions,
        CASE WHEN SUM(rushing_attempts) > 0 THEN SUM(rush_conversions) / SUM(rushing_attempts) END AS rush_conversion_rate,
        SUM(targets) AS targets,
        SUM(receptions) AS receptions,
        SUM(receiving_yards) AS receiving_yards,
        SUM(receiving_epa) AS receiving_epa,
        CASE WHEN SUM(targets) > 0 THEN SUM(receiving_epa) / SUM(targets) END AS receiving_epa_per_target,
        SUM(yards_after_catch) AS yards_after_catch,
        CASE WHEN SUM(receptions) > 0 THEN SUM(yards_after_catch) / SUM(receptions) END AS yac_per_reception,
        SUM(yac_epa) AS yac_epa,
        CASE WHEN SUM(receptions) > 0 THEN SUM(yac_epa) / SUM(receptions) END AS yac_epa_per_reception,
        SUM(sacks_defense) AS sacks_defense,
        SUM(qb_hits_defense) AS qb_hits_defense,
        SUM(field_goal_attempts) AS field_goal_attempts,
        SUM(field_goals_made) AS field_goals_made,
        CASE WHEN SUM(field_goal_attempts) > 0 THEN SUM(field_goals_made) / SUM(field_goal_attempts) END AS field_goal_make_rate
    FROM metric_rows
    WHERE player_key IS NOT NULL
    GROUP BY season, season_type, team_key, player_key
    """
)

# %% [markdown]
# ## Validation and Smoke Checks

# %%
display_table_counts(SILVER_SCHEMA)
display_table_counts(GOLD_SCHEMA)

display(
    spark.sql(
        f"""
        SELECT season, season_type, COUNT(*) AS teams
        FROM {GOLD_SCHEMA}.agg_team_season
        WHERE season >= 2024
        GROUP BY season, season_type
        ORDER BY season, season_type
        """
    )
)

display(
    spark.sql(
        f"""
        SELECT
            season,
            team_key,
            offensive_epa_per_play,
            offensive_epa_per_play_rank,
            defensive_epa_allowed_per_play,
            defensive_epa_allowed_per_play_rank
        FROM {GOLD_SCHEMA}.agg_team_season
        WHERE season = 2025
          AND season_type = 'REG'
        ORDER BY offensive_epa_per_play_rank
        LIMIT 10
        """
    )
)

display(
    spark.sql(
        f"""
        SELECT
            season,
            player_name,
            team_key,
            passing_yards,
            passing_tds,
            interceptions,
            completion_percentage
        FROM {GOLD_SCHEMA}.agg_player_season
        WHERE season = 2025
          AND season_type = 'REG'
          AND passing_yards > 0
        ORDER BY passing_yards DESC
        LIMIT 10
        """
    )
)

display(
    spark.sql(
        f"""
        SELECT
            season,
            player_name,
            team_key,
            rushing_attempts,
            rushing_yards,
            rushing_epa_per_play,
            explosive_rush_rate
        FROM {GOLD_SCHEMA}.agg_player_season
        WHERE season = 2025
          AND season_type = 'REG'
          AND position IN ('RB', 'FB')
          AND rushing_attempts >= 50
        ORDER BY rushing_epa_per_play DESC
        LIMIT 10
        """
    )
)

display(
    spark.sql(
        f"""
        SELECT
            season,
            week,
            game_key,
            offense_team_key,
            defense_team_key,
            wpa,
            play_description
        FROM {GOLD_SCHEMA}.fact_play_core
        WHERE season = 2025
        ORDER BY ABS(wpa) DESC NULLS LAST
        LIMIT 10
        """
    )
)

print("Silver/Gold notebook completed.")
