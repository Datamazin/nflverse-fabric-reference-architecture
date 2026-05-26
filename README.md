# NFL Fabric Analytics

A video walk-through of this implementation is [available on YouTube]([url](https://youtu.be/CUAf4BonB-s)).

This repo is an end-to-end NFL analytics reference implementation for Microsoft
Fabric. It starts with full-league NFLVerse data acquisition using `nflreadpy`.

> **Naming note:** NFLVerse is the upstream NFL data source used by this
> reference implementation. The upstream project, repo names, paths, and table
> identifiers use lowercase `nflverse`; this documentation uses NFLVerse when
> referring to the data set in prose. `nflreadpy` is the Python acquisition
> library used to download NFLVerse data.
>
> **Data quality note:** This repo is for educational and reference purposes, focusing
> on the process of building efficient
> data models for use with Fabric Data Agents and providing a framework for
> Agent Evaluation, Testing and how to create a Quality Assurance framework. 
> The NFLVerse data is imported into the solution but hasn't been thoroughly audited. Data 
> accuracy shouldn't be assumed, and the data is not validated to a level needed to integrate
> into production analytical solutions.

When deployed, the assets in this repo will provide the following:

* Python scripts to download the NFLVerse data set for 1999-2025 as Parquet files.
* Downloaded NFLVerse Parquet files ready to upload into a Lakehouse Files section--to use as a source for the Lakehouse Bronze (raw) layer.
* Fabric notebook to process the raw NFLVerse data files into conformed tables (silver layer).
* Fabric notebook to create Gold dimension and fact tables in the Lakehouse.
* A Semantic model built over the Gold fact/dimension tables, including a comprehensive set of calculated measures.
* A notebook that implements SQL to calculate a set of example analysis queries against the Lakehouse tables. 
* A Fabric Data Agent using the Gold schema in the lakehouse as a data source for Natural Language queries via the Fabric Data Agent NL2SQL reasoning layer.
* A Fabric Data Agent using the Semantic Model build over the Gold lakehouse as a source for Natural Language queries via the Fabric Data Agent NL2DAX reasoning layer. 
* A performance comparison of the same natural language queries processed by each of the Data Agents.
* Example evaluation notebooks for each data agent, using the fabric-data-agent-sdk's evaluate_data_agent framework.

## Why This Exists

This project demonstrates a governed Fabric architecture that serves as a high performance data model for Report, Dashboard and Natural Language query consumption. 

This repo does not attempt to replace scenario-specific data sets or modeling decisions. This example repo is intended to provide a roadmap to follow when preparing raw sports data for analysis, and to contrast alternate data modeling approaches (e.g. using star schemas in a lakehouse directly compared with using a curated semantic model built over the same lakehouse star schema).

## Core Design Pattern
The core design pattern in this repo is to preserve source NFLVerse data in Bronze, then refine data into curated
Gold star schemas to support efficient and performant data queries.

The final Gold solution is formatted as mutliple star schemas in a Data Lake, plus a Power BI Semantic Model with explicit measures to provide a source for apples-to-apples comparision of Data Lake vs. Semantic Model analytical use cases.

## Current State

Implemented in this repo:

- Local `nflreadpy` acquisition package and CLI for 1999-2025 full-league NFLVerse data.
- Local raw Parquet data files, plus `acquisition_manifest.json`,
  `schema_manifest.json`, and `quality_report.json`.
- Fabric notebook to import uploaded raw files into managed Bronze Delta tables.
- Fabric notebook to build Silver conformed tables and Gold facts, dimensions,
  and aggregates.
- Gold metric validation notebook with representative SQL checks.
- Power BI semantic model build guide and .tmdl project--deployable via Power BI desktop or Python script.
- Fabric Data Agent evaluation notebook that computes expected answers from
  Gold SQL 
- Evaluation notebooks to serve as QA scaffolding to test the accuracy and performance of Data Agents in both Lakehouse and Semantic Model scenarios.

## Known Gaps

Known gaps until more source data is added or approved proxies are
documented:

- True play-action tagging.
- True tight-window tracking.
- Rushing yards over expected.

## Repository Map

| Path | Purpose |
|---|---|
| `.gitignore` | Excludes local caches, virtual environments, generated data, and Fabric local settings from version control. |
| `.vscode/settings.json` | Workspace editor settings for this repository. |
| `README.md` | Primary end-to-end guide for rebuilding the Fabric reference architecture and reviewing validation results. |
| `pyproject.toml` | Python package metadata, dependencies, dev dependencies, and the `acquire-nflverse` CLI entry point. |
| `acquire_nflverse.py` | Root wrapper for the local acquisition CLI. |
| `src/nfl_fabric_acquisition/` | Python package for acquisition, output paths, manifests, retries, and quality checks. |
| `tests/` | Pytest coverage for config, pathing, manifests, validation, and dataset availability behavior. |
| `docs/Evaluation Question Manual Testing.xlsx` | Manual Data Agent testing workbook with response-time and query-runtime observations. |
| `docs/nfl_fabric_nflreadpy_codex_plan.md` | Historical implementation-plan note that points readers back to the current README. |
| `notebooks/import_raw_nflverse_to_bronze.ipynb` | Fabric notebook that reads uploaded raw Parquet files and creates Bronze Delta tables. |
| `notebooks/build_silver_gold_nfl_model.ipynb` | Fabric notebook that creates Silver and Gold tables from Bronze. |
| `notebooks/validate_gold_metrics.ipynb` | Read-only Fabric notebook that validates Gold tables against representative analytics questions. |
| `notebooks/Semantic Model Data Agent Evaluations.ipynb` | Fabric notebook that builds ground truth and evaluates the Semantic Model Data Agent. |
| `notebooks/Lakehouse Data Agent Evaluations.ipynb` | Fabric notebook that builds ground truth and evaluates the Lakehouse Data Agent. |
| `semantic_model/nfl_gold_semantic_model_guide.md` | Power BI semantic model build guide, relationships, hide rules, and Prep for AI instructions. |
| `semantic_model/nfl_gold_measures.dax` | DAX measure catalog for the Gold semantic model. |
| `semantic_model_project/` | Deployable Power BI Project semantic model files for `NFL Play by Play Model`. |
| `semantic_model_project/README.md` | Instructions for exporting, storing, and deploying the PBIP/TMDL semantic model project. |
| `scripts/create_nfl_play_by_play_sm.py` | Command-line deployment and refresh script for the semantic model. |

Generated/local working folders such as `.venv/`, `.pytest_cache/`,
`nflverse_local/`, and `data/` are intentionally omitted from the map because
they are ignored by Git.

## Build The Solution

To recreate the Fabric workspace and all artifacts, follow these roadmap steps.

A YouTube video series is available to serve as an on-demand workshop that demonstrates each of the required build steps documented below.

> TODO: when YouTube walk through is complete, add link here.

### 1. Set Up Local Python

Python is used to download NFLVerse data sources to your local workstation, and later is used to run other deployment steps using a code-first approach.

> Deploying Fabric Artifacts such as the Semantic Model can be done manually or via Power BI Desktop, so if your preference is to use UI tools, the deployment steps can be done in GUI tools rather than via Python scripts.

Use Python 3.11 or newer.

Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -e ".[dev]"
```

macOS/Linux shell:

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[dev]"
```

If you previously installed dependencies and see a Polars startup error such as
`RuntimeError: unknown feature flag: 'sse3'`, refresh the venv dependencies:

Windows PowerShell:

```powershell
python -m pip install --upgrade -e ".[dev]"
```

macOS/Linux shell:

```bash
python -m pip install --upgrade -e ".[dev]"
```

### 2. Acquire NFLVerse Data Locally

Run the local acquisition CLI from the repo root:

Windows PowerShell:

```powershell
python acquire_nflverse.py `
  --start-season 1999 `
  --end-season 2025 `
  --out .\nflverse_local `
  --force
```

macOS/Linux shell:

```bash
python acquire_nflverse.py \
  --start-season 1999 \
  --end-season 2025 \
  --out ./nflverse_local \
  --force
```

The script supports optional parameters, which can be used to create custom data sets:

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

Local unit tests are implemented to test whether the data expected from NFLVerse was received and stored as expected in the local workstation file system.

Windows PowerShell:

```powershell
pytest
```

macOS/Linux shell:

```bash
pytest
```

### 4. Create a new Workspace

Create a new Workspace in your Fabric tenant. Ensure that the Workspace is connected to a Fabric Capacity that provides Data Agent features.

Name the workspace anything you would like; the scripts and notebooks have no workspace name dependencies.

### 5. Create a new Lakehouse

In the new workspace, create a Lakehouse to use as a landing zone for the NFLVerse data.

The scripts in this solution assume the lakehouse name is `lh_nfl`.  We suggest you use this lakehouse name to avoid needing to update scripts with a different lakehouse name.

> Enable Lakehouse Schemas, as we'll use schemas to organize the Bronze/Silver/Gold lakehouse tables in this solution.

### 6. Upload Raw NFLVerse Files To Fabric

Use the Fabric Web UI to upload local NFLVerse files to the Lakehouse `Files` section.

| Local path | Lakehouse path |
|---|---|
| `nflverse_local/raw/nflverse/` | `Files/raw/nflverse/` |
| `nflverse_local/manifest/` | `Files/manifest/` |

### 7. Upload notebooks

Upload the contents of the `notebooks` folder to the root of the workspace.

| Local path | Lakehouse path |
|---|---|
| `notebooks/` | `/` |


### 8. Build Bronze

Run all cells of the following notebook to import the raw data into the lakehouse Bronze schema: `notebooks/import_raw_nflverse_to_bronze.ipynb`.

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

### 9. Build Silver And Gold

Run all cells in the `build_silver_gold_nfl_model.ipynb` in Fabric after the Bronze table load is complete.

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

The key modeling pattern for the examples and Natural Language quries in this project is `gold.fact_team_play`, which represents each play
from both the offense and defense team perspective. This makes offense versus
defense EPA, success rate, turnovers, sacks, red zone, and situational questions
much easier for both DAX and the Data Agent to interpret.

### 10. Validate Gold Metrics

Run the `validate_gold_metrics.ipynb` in Fabric to test whether the gold tables are created and can be used to query play-by-play statistics.

This read-only notebook validates representative fan, fantasy, coach, scout, and
analyst questions directly against the Gold SQL tables. Use it before refreshing
or tuning the semantic model to check that the gold tables contain usable data.

> Note: the data and processing scripts are meant for demonstration/educational purposes and to illustrate a data curation roadmap, and are not validated and curated to generate data for a specific production-ready purpose.

### 11a. Deploying the Semantic Model with Python

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

Authentication: the script uses interactive browser sign-in by default, so the
examples below do not require a prior Azure CLI login. If you prefer Azure CLI
authentication, run `az login` first, then pass `--auth-mode azure-cli` or set
`FABRIC_AUTH_MODE=azure-cli`. Use an account with permission to publish items
and refresh semantic models in the target Fabric workspace.

Deploy and refresh from the repo root:

Windows PowerShell:

```powershell
python scripts/create_nfl_play_by_play_sm.py `
  --workspace-id <WORKSPACE_GUID> `
  --sql-endpoint-server <server.datawarehouse.fabric.microsoft.com> `
  --sql-database lh_nfl
```

macOS/Linux shell:

```bash
python scripts/create_nfl_play_by_play_sm.py \
  --workspace-id <WORKSPACE_GUID> \
  --sql-endpoint-server <server.datawarehouse.fabric.microsoft.com> \
  --sql-database lh_nfl
```

If you are deploying back to the same workspace and SQL endpoint that the
exported `.SemanticModel` files already reference, the endpoint patch arguments
are optional:

Windows PowerShell:

```powershell
python scripts/create_nfl_play_by_play_sm.py `
  --workspace-id <WORKSPACE_GUID>
```

macOS/Linux shell:

```bash
python scripts/create_nfl_play_by_play_sm.py \
  --workspace-id <WORKSPACE_GUID>
```

The script stages a temporary copy of the semantic model, patches connection
references only in that staged copy, publishes `NFL Play by Play Model` with
`fabric-cicd`, and triggers a semantic model refresh. The checked-in TMDL files
are not modified by deployment-time patching.

## IMPORTANT - Updating Semantic Model Connection String after Script Deployment

On the first deployment to a workspace, Fabric may require an explicit data
connection before refresh succeeds. If refresh fails with a message like
`default data connection without explicit connection credentials`, the model was
published but refresh could not access the Lakehouse SQL endpoint yet. In the
Fabric or Power BI workspace, open `NFL Play by Play Model` > More options
`...` > Settings > Gateway and cloud connections. For the SQL endpoint data
source, use Maps to > Create a connection, or select an existing shareable cloud
connection, then apply the mapping. After the connection is mapped, rerun the
script or refresh the semantic model manually. See Microsoft's guidance for
[connecting to cloud data sources](https://learn.microsoft.com/en-us/power-bi/connect-data/service-connect-cloud-data-sources)
and
[creating shareable cloud connections](https://learn.microsoft.com/en-us/power-bi/connect-data/service-create-share-cloud-data-sources).

### 11b. Build The Power BI Semantic Model Manually

If you'd like to build the semantic model manually, refere to the following semantic model guide.

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


### 12. Configure The Semantic Model Fabric Data Agent

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

### 13. Evaluate the Semantic Model Data Agent

Run `notebooks/Semantic Model Data Agent Evaluations.ipynb` in Fabric after Gold tables, the semantic model, and the Data Agent are ready.

The notebook:

- Recomputes expected answers from Gold SQL tables at runtime.
- Evaluates the `NFL Semantic Model Data Agent` against those expected answers.
- Writes `semantic_model_data_agent_ground_truth`, `semantic_model_data_agent_evaluation`, and
  `semantic_model_data_agent_evaluation_steps`.
- Displays summary and row-level details for tuning.

Use failures to refine semantic model metadata, DAX measure descriptions, AI Data
Schema fields, AI instructions, and Verified Answers.

### 14. Configure The Data Lake Fabric Data Agent

Configure the Data Lake Data Agent after the Gold Lakehouse tables are built and
validated.

Recommended configuration:

- Use the Lakehouse Gold schema as the source for metric questions.
- Add all tables from the Lakehouse `gold` schema to the Data Agent.
- Use this agent for natural language questions over the curated Gold tables,
  parallel to the Semantic Model Data Agent's role over the Power BI semantic
  model.
- Add Data Agent instructions and example queries that match the questions and
  answer patterns you want this agent to support.

The evaluation notebook currently targets:

| Item | Name |
|---|---|
| Data Agent | `NFL Lakehouse Data Agent` |

If you publish with a different item name, update the configuration cell in
`notebooks/Lakehouse Data Agent Evaluations.ipynb`.

### 15. Evaluate the Data Lake Data Agent

Run `notebooks/Lakehouse Data Agent Evaluations.ipynb` in Fabric after Gold
tables and the Data Agent are ready.

The notebook:

- Recomputes expected answers from Gold SQL tables at runtime.
- Evaluates the `NFL Lakehouse Data Agent` against those expected answers.
- Writes Lakehouse Data Agent ground truth, evaluation, and evaluation-step
  outputs.
- Displays summary and row-level details for tuning.

Use failures to refine Data Agent table selection, Data Agent instructions,
example queries, and any Lakehouse Gold table metadata available to the agent.

## Manual Data Agent Testing Results

The table below summarizes manual response-time testing captured in
[Evaluation Question Manual Testing.xlsx](docs/Evaluation%20Question%20Manual%20Testing.xlsx).
Times are measured in seconds. DAX and SQL query runtime values are the
execution timings reported by the data agent output.

| # | Question | Semantic Model Data Agent (seconds) | Lakehouse Data Agent (seconds) | DAX Query Runtime (seconds) | SQL Query Runtime (seconds) |
|---:|---|---:|---:|---:|---:|
| 1 | For QBs in 2025 with at least 100 clean dropbacks and at least 15 QB-hit dropbacks, who had the largest EPA per dropback differential between clean and QB-hit plays? | 22 | 12 | 0.74 | 0.78 |
| 2 | How many regular-season NFL games were played in 2025? | 7 | 9 | 1.75 | 1.41 |
| 3 | How many sacks did the 49ers defense record in the 2025 regular season, and who were their top 3 sack leaders? | 23 | 11 | 0.54 | 1.17 |
| 4 | List the top 10 QBs by passing touchdowns in the 2025 regular season, with their interception count shown alongside. | 17 | 10 | 0.60 | 1.15 |
| 5 | List the top 10 receivers by receiving yards in the 2025 regular season. | 14 | 9 | 1.40 | 0.75 |
| 6 | List the top 10 running backs by EPA per rush in the 2025 regular season, minimum 50 carries. | 26 | 11 | 1.10 | 1.06 |
| 7 | List the top 5 quarterbacks by passing yards in the 2025 regular season. | 21 | 8 | 1.40 | 1.07 |
| 8 | List the top 5 running backs by rushing yards in the 2025 regular season and include their rushing touchdowns. | 16 | 10 | 1.30 | 1.20 |
| 9 | Quantify 2025 regular-season home-field advantage: home win rate, average home point differential, average home points, and average away points. | 11 | 10 | 0.60 | 1.00 |
| 10 | What was the Chiefs third-down conversion rate in the 2025 regular season? | 12 | 10 | 1.40 | 1.10 |
| 11 | What was the Detroit Lions' record at home versus on the road in the 2025 regular season? | 16 | 8 | 1.20 | 1.10 |
| 12 | What was the biggest single-play WPA swing in the 2025 regular season? | 21 | 12 | 0.70 | 1.1 |
| 13 | What were Patrick Mahomes' completion percentage and TD-to-INT ratio in the 2025 regular season? | 23 | 8 | 0.60 | 1.20 |
| 14 | Which 10 running backs had the highest explosive run rate in the 2025 regular season, minimum 50 carries? | 21 | 10 | 1.00 | 1.20 |
| 15 | Which 10 running backs had the highest stuff rate in the 2025 regular season, minimum 50 carries? | 21 | 12 | 0.70 | 1.20 |
| 16 | Which 2025 game had the most total points scored? Show the teams, final score, and week. | 17 | 8 | 0.70 | 1.20 |
| 17 | Which 5 defenses allowed the fewest explosive plays per game in the 2025 regular season? | 14 | 8 | 0.60 | 1.00 |
| 18 | Which kicker attempted the most field goals in the 2025 regular season, and what was their make rate? | 16 | 8 | 1.60 | 1.20 |
| 19 | Which quarterback had the highest CPOE on throws of 20 or more air yards in the 2025 regular season, minimum 30 such attempts? | 19 | 9 | 0.70 | 1.00 |
| 20 | Which team had the best red zone touchdown rate in the 2025 regular season? | 14 | 8 | 0.70 | 1.10 |
| 21 | Which team had the most rushing touchdowns in the 2025 regular season? | 23 | 10 | 0.90 | 1.20 |
|  | **Median** | **17.00** | **10.00** | **0.74** | **1.10** |
|  | **Average** | **17.81** | **9.57** | **0.96** | **1.10** |

Methodology:

1. Each question was pasted into the data agent after pressing **Clear Chat**,
   so each question is the first in its conversation.
2. Data agent time is the **Response time** taken from the Data Agent output
   step.
3. For DAX query time, the DAX query was copied and pasted into the Power BI
   Explore/DAX Query window.
4. For SQL query time, the SQL query was copied and pasted into the SQL
   Analytics Endpoint query window.

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
- [Semantic Model Data Agent evaluation notebook](notebooks/Semantic%20Model%20Data%20Agent%20Evaluations.ipynb)
- [Lakehouse Data Agent evaluation notebook](notebooks/Lakehouse%20Data%20Agent%20Evaluations.ipynb)

## Recommended Build Order

For a clean rebuild, run the artifacts in this order:

1. Run the Step 2 NFLVerse acquisition command for your platform.
2. Upload `nflverse_local/raw/nflverse/` and `nflverse_local/manifest/` to the Fabric Lakehouse.
3. Run `notebooks/import_raw_nflverse_to_bronze.ipynb`.
4. Run `notebooks/build_silver_gold_nfl_model.ipynb`.
5. Run `notebooks/validate_gold_metrics.ipynb`.
6. Build or update the exported files in `semantic_model_project/NFL Play by Play Model.SemanticModel/`.
7. Deploy and refresh the semantic model with `scripts/create_nfl_play_by_play_sm.py`.
8. Configure or refresh the NFL Semantic Model Fabric Data Agent.
9. Run `notebooks/Semantic Model Data Agent Evaluations.ipynb`.
10. Configure or refresh the NFL Lakehouse Fabric Data Agent.
11. Run `notebooks/Lakehouse Data Agent Evaluations.ipynb`.

