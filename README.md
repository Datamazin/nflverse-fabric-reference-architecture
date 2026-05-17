# NFL Fabric Analytics

This repo is an end-to-end NFL analytics reference implementation for Microsoft
Fabric. It starts with full-league NFLVerse data acquisition using `nflreadpy`.

> **Naming note:** NFLVerse is the upstream NFL data source used by this
> reference implementation. The upstream project, repo names, paths, and table
> identifiers use lowercase `nflverse`; this documentation uses NFLVerse when
> referring to the data set in prose. `nflreadpy` is the Python acquisition
> library used to download NFLVerse data.
>
> **Data quality note:** This repo focuses on the process of building efficient
> data models for use with Fabric Data Agents and providing a framework for
> Evaluations for Quality Assurance. The NFLVerse data is imported into the
> solution but hasn't been thoroughly audited. Data accuracy shouldn't be
> assumed, and the data is not validated to a level that should be integrated
> into production analytical solutions.

When deployed, the assets in this repo will provide the following:

* Python scripts to download the NFLVerse data set for 1999-2025 as Parquet files.
* Downloaded NFLVerse Parquet files ready to upload into a Lakehouse Files section--to use as a source for the Lakehouse Bronze (raw) layer.
* Fabric notebook to process the raw NFLVerse data files into conformed tables (silver layer).
* Fabric notebook to create Gold dimension and fact tables in the Lakehouse.
* A Semantic model build over the Gold fact/dimension tables, including a comprehensive set of calculated measures (semantic_model folder).
* A notebook that implements SQL to calculate a set of example analysis queries against the Lakehouse tables. 
* Two Data Agents: One using the Gold schema in the lakehouse as a data source for Natural Language queries; a second using the Semantic Model build over the Gold lakehouse as a source for Natural Language queries. 
* A performance comparison of the same natural language queries processed by each of the Data Agents.
* Example evaluation notebooks for each data agent, using the fabric-data-agent-sdk's evaluate_data_agent framework.

The analytics focus is play-by-play analysis for 1999 through 2025 NFL seasons

## Why This Exists

This project demonstrates a governed Fabric architecture that serves as a high performance basis for Report, Dashboard and Natural Language query consumption. While each solution brings a unique and organization-specific data set, this example repo is intended to provide a model to follow when preparing raw data for analysis, and to compare alternate approaches (for example using star schemas in a lakehouse directly compared with using a semantic model built over the same lakehouse star schema).

The core design choice is to preserve source data in Bronze, then expose curated
Gold tables and explicit measures to Power BI and the Data Agent.

## Current State

Implemented in this repo:

- Local `nflreadpy` acquisition package and CLI for 1999-2025 full-league NFLVerse data.
- Local raw Parquet layout plus `acquisition_manifest.json`,
  `schema_manifest.json`, and `quality_report.json`.
- Fabric notebook to import uploaded raw files into managed Bronze Delta tables.
- Fabric notebook to build Silver conformed tables and Gold facts, dimensions,
  and aggregates.
- Gold metric validation notebook with representative SQL checks.
- Power BI semantic model build guide and DAX measure catalog.
- Fabric Data Agent evaluation notebook that recomputes expected answers from
  Gold SQL and evaluates the published agent.

Known gaps until more source data is added or approved proxies are
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
| `semantic_model_project/` | Deployable Power BI Project semantic model files for `NFL Play by Play Model`. |
| `scripts/create_nfl_play_by_play_sm.py` | Command-line deployment and refresh script for the semantic model. |

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

### 2. Acquire NFLVerse Data Locally

Run the local acquisition CLI from the repo root:

```powershell
python acquire_nflverse.py `
  --start-season 1999 `
  --end-season 2025 `
  --out .\nflverse_local `
  --force
```

Optional paramters:

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

Upload the following notebook to the Fabric workspace and run all cells to import the raw data into the lakehouse Bronze schema: `notebooks/import_raw_nflverse_to_bronze.ipynb`.

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

Upload and run `notebooks/build_silver_gold_nfl_model.ipynb` in Fabric after Bronze is
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
or tuning the semantic model to check that the gold tables contain usable data.

> Note: the data and processing scripts are meant for demonstration/educational purposes, and are not validated and curated to generate data for a specific production-ready purpose.

### 8. Build The Power BI Semantic Model

Use the semantic model docs:

- [Gold semantic model guide](semantic_model/nfl_gold_semantic_model_guide.md)
- [Gold DAX measure catalog](semantic_model/nfl_gold_measures.dax)

Recommended Proof-of-Concept solution shape:

- Import Gold tables only.
- Use Import mode for best performance, as it will leverage in-memory data analysis. Use direct lake mode as an alternative.
- Use single-direction relationships from dimensions to facts and aggregates.
- Hide technical keys and ambiguous raw detail fields.
- Disable implicit summarization for identifiers, names, codes, descriptions,
  and categorical labels.
- Use explicit DAX measures from `semantic_model/nfl_gold_measures.dax`.
- Add table, column, and measure descriptions.
- Add synonyms and Prep for AI instructions for football terminology.

The semantic model guide includes the relationship list, suggested display names,
hide rules, and Prep for AI instructions.

### 9. Deploying the Semantic Model

The deployable semantic model project lives in:

```text
semantic_model_project/NFL Play by Play Model.SemanticModel/
```

The target Fabric workspace can have any display name. The deployment script uses
the workspace ID, so get the ID from the Fabric workspace URL or workspace
settings before running the script.

The Lakehouse created earlier in the build process should keep the same name:

```text
lh_nfl
```

Because the Lakehouse name remains `lh_nfl`, the semantic model's SQL database
name can stay the same. If deploying to a different workspace, the Fabric SQL
endpoint server may change, so pass the target Lakehouse SQL endpoint server to
the script. In Fabric, open the `lh_nfl` Lakehouse, switch to the SQL analytics
endpoint, and copy the SQL connection string/server name.

Deploy and refresh from the repo root:

```powershell
python scripts/create_nfl_play_by_play_sm.py `
  --workspace-id <WORKSPACE_GUID> `
  --sql-endpoint-server <server.datawarehouse.fabric.microsoft.com> `
  --sql-database lh_nfl
```

If you are deploying back to the same workspace and SQL endpoint that the
exported `.SemanticModel` files already reference, the endpoint patch arguments
are optional:

```powershell
python scripts/create_nfl_play_by_play_sm.py `
  --workspace-id <WORKSPACE_GUID>
```

The script stages a temporary copy of the semantic model, patches connection
references only in that staged copy, publishes `NFL Play by Play Model` with
`fabric-cicd`, and triggers a semantic model refresh. The checked-in TMDL files
are not modified by deployment-time patching.

On the first deployment to a workspace, Fabric may require data source
credentials before refresh succeeds. If refresh fails for credentials, open the
semantic model in the Fabric workspace, go to semantic model settings, configure
the SQL endpoint credentials, then rerun the script or refresh manually.

### 10. Configure The Semantic Model Fabric Data Agent

Configure the Data Agent after the semantic model is published and refreshed.

Recommended configuration:

- Use the Gold semantic model as the governed source for metric questions.
- Expose only curated Gold tables, fields, and measures in the AI Data Schema.
- Prefer explicit measures for EPA, success rate, pass rate, red zone, third
  down, penalties, and rankings.
- Add AI instructions that define offense, defense, EPA allowed, EPA generated,
  dropbacks, red zone, one-score situations, and ranking direction.
- Add Verified Answers for the highest-priority questions.

The evaluation notebook currently targets:

| Item | Name |
|---|---|
| Semantic model | `NFL Play by Play Model` |
| Data Agent | `NFL Semantic Model Data Agent` |

If you publish with different item names, update the configuration cell in
`notebooks/Semantic Model Data Agent Evaluations.ipynb`.

### 11. Evaluate The Data Agent

Run `notebooks/Semantic Model Data Agent Evaluations.ipynb` in Fabric after Gold tables, the
semantic model, and the Data Agent are ready.

The notebook:

- Recomputes expected answers from Gold SQL tables at runtime.
- Evaluates the `NFL Semantic Model Data Agent` against those expected answers.
- Writes `semantic_model_data_agent_ground_truth`, `semantic_model_data_agent_evaluation`, and
  `semantic_model_data_agent_evaluation_steps`.
- Displays summary and row-level details for tuning.

Use failures to refine semantic model metadata, DAX measure descriptions, AI Data
Schema fields, AI instructions, and Verified Answers.

## Manual Data Agent Testing Results

The table below summarizes manual response-time testing captured in
[Evaluation Question Manual Testing.xlsx](docs/Evaluation%20Question%20Manual%20Testing.xlsx).
Times are measured in seconds.

| # | Question | Semantic Model Data Agent (seconds) | Lakehouse Data Agent (seconds) |
|---:|---|---:|---:|
| 1 | For QBs in 2025 with at least 100 clean dropbacks and at least 15 QB-hit dropbacks, who had the largest EPA per dropback differential between clean and QB-hit plays? | 22 | 12 |
| 2 | How many regular-season NFL games were played in 2025? | 7 | 9 |
| 3 | How many sacks did the 49ers defense record in the 2025 regular season, and who were their top 3 sack leaders? | 23 | 11 |
| 4 | List the top 10 QBs by passing touchdowns in the 2025 regular season, with their interception count shown alongside. | 17 | 10 |
| 5 | List the top 10 receivers by receiving yards in the 2025 regular season. | 14 | 9 |
| 6 | List the top 10 running backs by EPA per rush in the 2025 regular season, minimum 50 carries. | 26 | 11 |
| 7 | List the top 5 quarterbacks by passing yards in the 2025 regular season. | 21 | 8 |
| 8 | List the top 5 running backs by rushing yards in the 2025 regular season and include their rushing touchdowns. | 16 | 10 |
| 9 | Quantify 2025 regular-season home-field advantage: home win rate, average home point differential, average home points, and average away points. | 11 | 10 |
| 10 | What was the Chiefs third-down conversion rate in the 2025 regular season? | 12 | 10 |
| 11 | What was the Detroit Lions' record at home versus on the road in the 2025 regular season? | 16 | 8 |
| 12 | What was the biggest single-play WPA swing in the 2025 regular season? | 21 | 12 |
| 13 | What were Patrick Mahomes' completion percentage and TD-to-INT ratio in the 2025 regular season? | 23 | 8 |
| 14 | Which 10 running backs had the highest explosive run rate in the 2025 regular season, minimum 50 carries? | 21 | 10 |
| 15 | Which 10 running backs had the highest stuff rate in the 2025 regular season, minimum 50 carries? | 21 | 12 |
| 16 | Which 2025 game had the most total points scored? Show the teams, final score, and week. | 17 | 8 |
| 17 | Which 5 defenses allowed the fewest explosive plays per game in the 2025 regular season? | 14 | 8 |
| 18 | Which kicker attempted the most field goals in the 2025 regular season, and what was their make rate? | 16 | 8 |
| 19 | Which quarterback had the highest CPOE on throws of 20 or more air yards in the 2025 regular season, minimum 30 such attempts? | 19 | 9 |
| 20 | Which team had the best red zone touchdown rate in the 2025 regular season? | 14 | 8 |
| 21 | Which team had the most rushing touchdowns in the 2025 regular season? | 23 | 10 |
|  | **Average** | **17.8** | **9.6** |

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
6. Build or update the exported files in `semantic_model_project/NFL Play by Play Model.SemanticModel/`.
7. Deploy and refresh the semantic model with `scripts/create_nfl_play_by_play_sm.py`.
8. Configure or refresh the NFL Semantic Model Fabric Data Agent.
9. Run `notebooks/Semantic Model Data Agent Evaluation.ipynb`.
10. Configure or refresh the NFL Lakehouse Fabric Data Agent.
11. Run `notebooks/Lakehouse Data Agent Evaluation.ipynb`.

