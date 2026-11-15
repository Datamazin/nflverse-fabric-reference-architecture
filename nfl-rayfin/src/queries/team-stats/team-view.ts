import type { VisualizationSpec } from "@microsoft/fabric-visuals";
import type { ManagedQueryFactoryParams } from "@microsoft/fabric-interaction-manager";
import { insertInteractionFilters } from "@/lib/query-factory";
import type { ColumnMetadataMap } from "@/lib/to-data-table";
import { applySeasonFilter, connection, type SeasonParams } from "@/queries/player-stats/season-filter";
import { TEAM_IDENTITY_COLUMNS, getTeamView, type TeamView } from "./team-views";
import teamViewSpec from "./team-view.json";

export const TEAM_FILTER_MARKER = "/*__FILTER_ARGUMENTS__*/";

export interface TeamViewParams extends SeasonParams, ManagedQueryFactoryParams {
    view: TeamView;
}

export interface TeamViewQuery {
    connection: string;
    query: string;
    columnMetadata: ColumnMetadataMap;
    vegaLiteSpec: VisualizationSpec;
}

/**
 * One row per team plus a league-total row (`IsGrandTotal`) for a view and season. The
 * ranking chart, KPI cards, and grid all read this result. Conference and division slicer
 * filters arrive as interaction filters and narrow both the teams and the total.
 * `vegaLiteSpec` is the ranking bar chart, ordered best-first for the view.
 */
export function teamView({ view, season, seasonType, interactionFilters = [] }: TeamViewParams): TeamViewQuery {
    const definition = getTeamView(view);
    const seasonQuery = applySeasonFilter(definition.query, { season, seasonType });
    return {
        connection,
        query: insertInteractionFilters(seasonQuery, interactionFilters, TEAM_FILTER_MARKER, "beforeMeasures"),
        columnMetadata: { ...TEAM_IDENTITY_COLUMNS, ...definition.stats },
        vegaLiteSpec: rankingSpec(definition.higherIsBetter),
    };
}

/** The ranking spec with its bar order set so the best team is always on top. */
export function rankingSpec(higherIsBetter: boolean): VisualizationSpec {
    const spec = structuredClone(teamViewSpec) as typeof teamViewSpec;
    spec.encoding.y.sort = higherIsBetter ? "-x" : "x";
    return spec as VisualizationSpec;
}
