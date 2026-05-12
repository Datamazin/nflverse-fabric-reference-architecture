# NFL Gold Semantic Model Build Guide

## Recommendation

Build the first customer-facing semantic model in **Power BI Import mode** over
Gold tables only.

Why this path:

- The largest fact table is comfortably below the scale where Import mode becomes
  painful.
- VertiPaq import gives the fastest and most predictable interactive performance.
- Explicit measures and curated table names give Fabric Data Agent much better
  semantic grounding than raw SQL over the wide PBP table.
- The Gold tables already separate team, pass, rush, penalty, special teams,
  play-detail, and aggregate grains.

Use Direct Lake later if Fabric-native refresh/serving becomes more important
than the simplest high-performance MVP path.

## Source

Use the Fabric Lakehouse SQL analytics endpoint for `lh_nfl` and import only the
`gold` schema tables.

Workspace ID:

```text
e22b6dab-2918-468a-98f6-b8435e2c199e
```

Lakehouse ID:

```text
b4ecd397-133e-405f-9ee2-67723e2d0dae
```

SQL endpoint item ID:

```text
bf18c8a5-8fc8-47cd-b13f-4207546fd0a5
```

SQL endpoint server:

```text
7rk6p6eropzejk7ixdt5o37uva-vnwsxyqyfgfenghwxbbv4lazty.datawarehouse.fabric.microsoft.com
```

## Tables To Import

Dimensions:

- `gold.dim_team`
- `gold.dim_game`
- `gold.dim_player`
- `gold.dim_season_week`

Facts:

- `gold.fact_team_play`
- `gold.fact_play_core`
- `gold.fact_pass_play`
- `gold.fact_rush_play`
- `gold.fact_penalty`
- `gold.fact_special_teams_play`
- `gold.fact_player_play_role`

Aggregates:

- `gold.agg_team_game`
- `gold.agg_team_season`
- `gold.agg_team_situation`
- `gold.agg_player_season`

## Suggested Display Names

| Source table | Display name |
|---|---|
| `dim_team` | Team |
| `dim_game` | Game |
| `dim_player` | Player |
| `dim_season_week` | Season Week |
| `fact_team_play` | Team Play |
| `fact_play_core` | Play Detail |
| `fact_pass_play` | Passing Play |
| `fact_rush_play` | Rushing Play |
| `fact_penalty` | Penalty |
| `fact_special_teams_play` | Special Teams Play |
| `fact_player_play_role` | Player Play Role |
| `agg_team_game` | Team Game Summary |
| `agg_team_season` | Team Season Summary |
| `agg_team_situation` | Team Situation Summary |
| `agg_player_season` | Player Season Summary |

## Relationships

Use single-direction filtering from dimensions to facts/aggregates.

Create these active relationships:

| From | To | Cardinality |
|---|---|---|
| `Team[team_key]` | `Team Season Summary[team_key]` | 1:* |
| `Team[team_key]` | `Team Game Summary[team_key]` | 1:* |
| `Team[team_key]` | `Team Situation Summary[team_key]` | 1:* |
| `Team[team_key]` | `Team Play[team_key]` | 1:* |
| `Team[team_key]` | `Player Season Summary[team_key]` | 1:* |
| `Team[team_key]` | `Special Teams Play[team_key]` | 1:* |
| `Team[team_key]` | `Player Play Role[team_key]` | 1:* |
| `Game[game_key]` | `Team Game Summary[game_key]` | 1:* |
| `Game[game_key]` | `Team Play[game_key]` | 1:* |
| `Game[game_key]` | `Play Detail[game_key]` | 1:* |
| `Game[game_key]` | `Passing Play[game_key]` | 1:* |
| `Game[game_key]` | `Rushing Play[game_key]` | 1:* |
| `Game[game_key]` | `Penalty[game_key]` | 1:* |
| `Game[game_key]` | `Special Teams Play[game_key]` | 1:* |
| `Game[game_key]` | `Player Play Role[game_key]` | 1:* |
| `Player[player_key]` | `Player Season Summary[player_key]` | 1:* |
| `Player[player_key]` | `Player Play Role[player_key]` | 1:* |
| `Season Week[season_week_key]` | `Team Play[season_week_key]` | 1:* |
| `Season Week[season_week_key]` | `Play Detail[season_week_key]` | 1:* |
| `Season Week[season_week_key]` | `Passing Play[season_week_key]` | 1:* |
| `Season Week[season_week_key]` | `Rushing Play[season_week_key]` | 1:* |
| `Season Week[season_week_key]` | `Penalty[season_week_key]` | 1:* |
| `Season Week[season_week_key]` | `Special Teams Play[season_week_key]` | 1:* |
| `Season Week[season_week_key]` | `Player Play Role[season_week_key]` | 1:* |

Do **not** create active relationships from `Team` to every opponent/offense/
defense key in every fact during the MVP. Keep those key columns visible with
friendly names where needed, or add role-playing dimensions later if users need
heavy opponent filtering.

## Hide Or De-Emphasize

Hide technical keys unless needed for drill-through:

- `play_key`
- `game_key`
- `season_week_key`
- `player_key`
- `team_key`
- `opponent_team_key`
- `*_player_key`
- `role_sequence`

Keep `Play Detail[play_description]` available only for a play-finder or
drill-through page. Do not expose it broadly to Data Agent for metric questions.

Disable implicit summarization for identifiers, names, codes, descriptions, and
categorical labels.

## Measure Strategy

Use explicit measures from `nfl_gold_measures.dax`.

Primary metric sources:

- Team performance and rankings: `Team Play`, `Team Season Summary`
- Game records and home/away splits: `Team Game Summary`
- Player season leaderboards: `Player Season Summary`
- Pass/rush situational queries: `Passing Play`, `Rushing Play`
- Play finder and WPA swings: `Play Detail`
- Penalties: `Penalty`
- Field goals and special teams: `Special Teams Play`

## Prep For AI Instructions

Add these instructions to Prep for AI / Data Agent:

```text
Use Gold tables only. Do not use Bronze or Silver tables for governed answers.

When the user asks for team offense, use Offensive EPA per Play unless the user
specifies yards, points, success rate, pass rate, or another metric.

When the user asks for team defense, use Defensive EPA Allowed per Play ascending
or Defensive EPA Generated per Play descending.

When the user asks for best defense, lower Defensive EPA Allowed per Play is
better.

When the user asks for EPA differential, use Offensive EPA minus Defensive EPA
Allowed, or equivalently Offensive EPA plus Defensive EPA Generated.

When the user asks for passing offense, use dropbacks. Dropbacks include pass
attempts, sacks, and QB scrambles where available.

When the user asks for rushing offense or running backs, use rush attempts and
exclude kneels. For RB-specific questions, filter Player Position to RB or FB.

When the user asks for red zone, use plays or drives where Yards From Opponent
End Zone is less than or equal to 20.

When the user asks for one-score situations, use pre-play absolute score
differential less than or equal to 8.

When the user asks for rankings, rank all qualifying NFL teams or players for the
requested season/range unless the user explicitly asks only for one team.

Do not answer true play-action, true tight-window, or rushing yards over
expected questions unless a future data source is added. If asked, explain that
the current model does not contain those fields.
```

## First Semantic Model Acceptance Criteria

- Imports Gold tables only.
- Has the active relationships listed above.
- Hides technical columns and raw detail text except for play finder use.
- Uses explicit measures only.
- Answers the validation notebook question patterns without needing SQL edits.
- Data Agent is configured with the AI instructions above and a narrow AI Data
  Schema.
