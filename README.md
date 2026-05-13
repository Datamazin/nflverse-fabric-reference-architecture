# NFL Fabric Analytics

This repo is an end-to-end NFL analytics reference implementation for Microsoft
Fabric. It starts with full-league `nflreadpy` acquisition, preserves the source
data as raw Parquet, imports that data into a Fabric Lakehouse Bronze layer,
transforms it into Silver and Gold Delta tables, builds a Power BI semantic
model over Gold, configures a Fabric Data Agent, and evaluates the agent against
ground-truth answers.

The analytics focus is the Seattle Seahawks (`SEA`) from the 1999 through 2025
NFL seasons, but the acquired and modeled data remains full-league. That is
intentional: rankings, league averages, opponent comparisons, and best/worst
questions need league context.

## Why This Exists

Natural-language football analytics are fragile when a report or agent points
directly at a raw play-by-play table with hundreds of source columns. This
project demonstrates a governed Fabric architecture:

```text
nflreadpy / nflverse-data
  -> local raw Parquet export
  -> Fabric Lakehouse Files
  -> Bronze Delta tables
  -> Silver cleaned/conformed tables
  -> Gold star schema and aggregate tables
  -> Power BI semantic model
  -> Fabric Data Agent
  -> ground-truth evaluation notebook
```

The core design choice is to preserve source data in Bronze, then expose curated
Gold tables and explicit measures to Power BI and the Data Agent.

## Current State

Implemented in this repo:

- Local `nflreadpy` acquisition package and CLI for 1999-2025 full-league data.
- Local raw Parquet layout plus `acquisition_manifest.json`,
  `schema_manifest.json`, and `quality_report.json`.
- Fabric notebook to import uploaded raw files into managed Bronze Delta tables.
- Fabric notebook to build Silver conformed tables and Gold facts, dimensions,
  and aggregates.
- Gold metric validation notebook with representative SQL checks.
- Power BI semantic model build guide and DAX measure catalog.
- Fabric Data Agent evaluation notebook that recomputes expected answers from
  Gold SQL and evaluates the published agent.

Known intentional gaps until more source data is added or approved proxies are
documented:

- True play-action tagging.
- True tight-window tracking.
- Rushing yards over expected.

## Repository Map

| Path | Purpose |
|---|---|
| `acquire_nflverse.py` | Root wrapper for the local acquisition CLI. |
| `src/nfl_fabric_acquisition/` | Python package for acquisition, output paths, manifests, retries, and quality checks. |
| `tests/` | Pytest coverage for config, pathing, manifests, validation, and dataset availability behavior. |
| `notebooks/import_raw_nflverse_to_bronze.ipynb` | Fabric notebook that reads uploaded raw Parquet files and creates Bronze Delta tables. |
| `notebooks/build_silver_gold_nfl_model.ipynb` | Fabric notebook that creates Silver and Gold tables from Bronze. |
| `notebooks/validate_gold_metrics.ipynb` | Read-only Fabric notebook that validates Gold tables against representative analytics questions. |
| `notebooks/evaluate_nfl_data_agent.ipynb` | Fabric notebook that builds ground truth and evaluates the Fabric Data Agent. |
| `semantic_model/nfl_gold_semantic_model_guide.md` | Power BI semantic model build guide, relationships, hide rules, and Prep for AI instructions. |
| `semantic_model/nfl_gold_measures.dax` | DAX measure catalog for the Gold semantic model. |

The `.py` files beside several notebooks are exported notebook sources for easier
review and version control.

## Build The Solution

### 1. Set Up Local Python

Use Python 3.11 or newer.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
```

### 2. Acquire nflverse Data Locally

Run the local acquisition CLI from the repo root:

```powershell
python acquire_nflverse.py `
  --start-season 1999 `
  --end-season 2025 `
  --out .\nflverse_local `
  --force
```

Useful options:

| Option | Default | Purpose |
|---|---:|---|
| `--start-season` | `1999` | First NFL season to fetch. |
| `--end-season` | `2025` | Last NFL season to fetch. |
| `--out` | `./nflverse_local` | Local output root. |
| `--cache` | `./nflverse_local/cache/nflreadpy` | `nflreadpy` filesystem cache. |
| `--skip-optional` | `False` | Skip weekly and season stats if needed. |
| `--team-focus` | `SEA` | Team used only for validation smoke checks. |
| `--retries` | `3` | Retry count for source fetches. |

Expected local output:

```text
nflverse_local/
  README.md
  manifest/
    acquisition_manifest.json
    schema_manifest.json
    quality_report.json
  cache/nflreadpy/
  raw/nflverse/
    pbp/season=1999/play_by_play_1999.parquet
    ...
    pbp/season=2025/play_by_play_2025.parquet
    schedules/schedules_1999_2025.parquet
    teams/teams.parquet
    players/players.parquet
    rosters/season=.../
    rosters_weekly/season=.../
    player_stats_weekly/season=.../
    team_stats_weekly/season=.../
    player_stats_season/summary_level=reg/
    player_stats_season/summary_level=post/
    team_stats_season/summary_level=reg/
    team_stats_season/summary_level=post/
```

The acquisition run writes three useful control files:

- `acquisition_manifest.json`: what was fetched, where it was written, and row
  and column counts.
- `schema_manifest.json`: column lists and table profiles for the acquired
  datasets.
- `quality_report.json`: required-column checks, Seahawks smoke checks,
  season-range checks, and play-by-play to schedules join validation.

### 3. Run Local Tests

```powershell
pytest
```

### 4. Upload Raw Files To Fabric

Upload local files into the Lakehouse attached to the Fabric notebooks:

| Local path | Lakehouse path |
|---|---|
| `nflverse_local/raw/nflverse/` | `Files/raw/nflverse/` |
| `nflverse_local/manifest/` | `Files/manifest/` |

Use a schema-enabled Lakehouse. The notebooks assume the Lakehouse is attached
and use schemas named `bronze`, `silver`, and `gold`.

### 5. Build Bronze

Run `notebooks/import_raw_nflverse_to_bronze.ipynb` in Fabric.

This notebook:

- Creates the `bronze` schema if needed.
- Reads the uploaded raw Parquet files from `Files/raw/nflverse`.
- Writes managed Delta tables under `bronze`.
- Preserves source columns.
- Adds ingestion metadata such as `_bronze_ingested_at_utc`,
  `_source_file_path`, `_source_system`, `_source_dataset`, and
  `_acquisition_batch_id`.
- Compares source row counts with written table row counts.

Bronze table names:

```text
bronze.nflverse_pbp
bronze.nflverse_schedules
bronze.nflverse_teams
bronze.nflverse_players
bronze.nflverse_rosters
bronze.nflverse_rosters_weekly
bronze.nflverse_player_stats_weekly
bronze.nflverse_team_stats_weekly
bronze.nflverse_player_stats_reg
bronze.nflverse_player_stats_post
bronze.nflverse_team_stats_reg
bronze.nflverse_team_stats_post
```

### 6. Build Silver And Gold

Run `notebooks/build_silver_gold_nfl_model.ipynb` in Fabric after Bronze is
complete.

Silver tables clean and conform source data:

```text
silver.teams
silver.games
silver.players
silver.player_team_season
silver.play_by_play
```

Gold tables expose modeled analytics grains for reports, the semantic model, and
the Data Agent:

| Category | Gold tables |
|---|---|
| Dimensions | `gold.dim_team`, `gold.dim_game`, `gold.dim_player`, `gold.dim_season_week` |
| Facts | `gold.fact_play_core`, `gold.fact_team_play`, `gold.fact_pass_play`, `gold.fact_rush_play`, `gold.fact_penalty`, `gold.fact_special_teams_play`, `gold.fact_player_play_role` |
| Aggregates | `gold.agg_team_game`, `gold.agg_team_season`, `gold.agg_team_situation`, `gold.agg_player_season` |

The key modeling pattern is `gold.fact_team_play`, which represents each play
from both the offense and defense team perspective. This makes offense versus
defense EPA, success rate, turnovers, sacks, red zone, and situational questions
much easier for both DAX and the Data Agent to interpret.

### 7. Validate Gold Metrics

Run `notebooks/validate_gold_metrics.ipynb` in Fabric.

This read-only notebook validates representative fan, fantasy, coach, scout, and
analyst questions directly against the Gold SQL tables. Use it before refreshing
or tuning the semantic model.

### 8. Build The Power BI Semantic Model

Use the semantic model docs:

- [Gold semantic model guide](semantic_model/nfl_gold_semantic_model_guide.md)
- [Gold DAX measure catalog](semantic_model/nfl_gold_measures.dax)

Recommended MVP shape:

- Import Gold tables only.
- Use single-direction relationships from dimensions to facts and aggregates.
- Hide technical keys and ambiguous raw detail fields.
- Disable implicit summarization for identifiers, names, codes, descriptions,
  and categorical labels.
- Use explicit DAX measures from `semantic_model/nfl_gold_measures.dax`.
- Add table, column, and measure descriptions.
- Add synonyms and Prep for AI instructions for football terminology.

The semantic model guide includes the relationship list, suggested display names,
hide rules, and Prep for AI instructions.

### 9. Configure The Fabric Data Agent

Configure the Data Agent after the semantic model is published and refreshed.

Recommended configuration:

- Use the Gold semantic model as the governed source for metric questions.
- Expose only curated Gold tables, fields, and measures in the AI Data Schema.
- Prefer explicit measures for EPA, success rate, pass rate, red zone, third
  down, penalties, and rankings.
- Add AI instructions that define offense, defense, EPA allowed, EPA generated,
  dropbacks, red zone, one-score situations, and ranking direction.
- Add Verified Answers for the highest-priority Seahawks questions.

The evaluation notebook currently targets:

| Item | Name |
|---|---|
| Semantic model | `NFL Play by Play Model` |
| Data Agent | `SM Data Agent` |

If you publish with different item names, update the configuration cell in
`notebooks/evaluate_nfl_data_agent.ipynb`.

### 10. Evaluate The Data Agent

Run `notebooks/evaluate_nfl_data_agent.ipynb` in Fabric after Gold tables, the
semantic model, and the Data Agent are ready.

The notebook:

- Recomputes expected answers from Gold SQL tables at runtime.
- Evaluates the `SM Data Agent` against those expected answers.
- Writes `nfl_data_agent_ground_truth`, `nfl_data_agent_evaluation`, and
  `nfl_data_agent_evaluation_steps`.
- Displays summary and row-level details for tuning.

Use failures to refine semantic model metadata, DAX measure descriptions, AI Data
Schema fields, AI instructions, and Verified Answers.

## Data Agent Question Coverage

The current modeled solution is designed for questions in these families:

- Team performance trends, rankings, league averages, and Seahawks comparisons.
- Passing offense, passing EPA, dropbacks, targets, receivers, and quarterback
  leaderboards.
- Rushing offense, designed runs, rushing EPA, running back leaderboards, and
  situational rushing.
- Third down, fourth down, red zone, goal-to-go, one-score, score-state, and
  time-context questions.
- Defensive EPA allowed, defensive success rate, sacks, QB hits, turnovers, and
  opponent performance.
- Game flow, WPA swings, top plays, playoff game summaries, and EPA volatility.
- Penalties, field goals, punts, and special teams WPA.

Unsupported question families should be answered as unavailable until additional
data sources are added:

- True play-action versus non-play-action.
- True tight-window throws.
- Rushing yards over expected.

## Documentation Links

- [Gold semantic model guide](semantic_model/nfl_gold_semantic_model_guide.md)
- [Gold DAX measure catalog](semantic_model/nfl_gold_measures.dax)
- [Bronze import notebook](notebooks/import_raw_nflverse_to_bronze.ipynb)
- [Silver/Gold build notebook](notebooks/build_silver_gold_nfl_model.ipynb)
- [Gold metric validation notebook](notebooks/validate_gold_metrics.ipynb)
- [Data Agent evaluation notebook](notebooks/evaluate_nfl_data_agent.ipynb)

## Recommended Build Order

For a clean rebuild, run the artifacts in this order:

1. `python acquire_nflverse.py --start-season 1999 --end-season 2025 --out .\nflverse_local --force`
2. Upload `nflverse_local/raw/nflverse/` and `nflverse_local/manifest/` to the Fabric Lakehouse.
3. Run `notebooks/import_raw_nflverse_to_bronze.ipynb`.
4. Run `notebooks/build_silver_gold_nfl_model.ipynb`.
5. Run `notebooks/validate_gold_metrics.ipynb`.
6. Build or refresh the Power BI semantic model using the Gold guide and DAX catalog.
7. Configure or refresh the Fabric Data Agent.
8. Run `notebooks/evaluate_nfl_data_agent.ipynb`.
