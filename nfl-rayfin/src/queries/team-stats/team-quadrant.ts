import type { VisualizationSpec } from "@microsoft/fabric-visuals";
import type { ManagedQueryFactoryParams } from "@microsoft/fabric-interaction-manager";
import { insertInteractionFilters } from "@/lib/query-factory";
import type { ColumnMetadataMap } from "@/lib/to-data-table";
import { applySeasonFilter, connection, type SeasonParams } from "@/queries/player-stats/season-filter";
import { TEAM_FIELDS } from "./team-views";
import { TEAM_FILTER_MARKER } from "./team-view";
import baseQuery from "./team-quadrant.dax?raw";
import teamQuadrantSpec from "./team-quadrant.json";

export type TeamQuadrantParams = SeasonParams & ManagedQueryFactoryParams;

export const teamQuadrantVegaLiteSpec = teamQuadrantSpec as VisualizationSpec;

export const teamQuadrantColumns: ColumnMetadataMap = {
    "Team[team_key]": { name: TEAM_FIELDS.teamKey, displayName: "Team ID" },
    "Team[Team Name]": { name: TEAM_FIELDS.team, displayName: "Team" },
    "Team[Team Code]": { name: TEAM_FIELDS.teamCode, displayName: "Team" },
    "Team[Team Conference]": { name: TEAM_FIELDS.conference, displayName: "Conference" },
    "Team[Team Division]": { name: TEAM_FIELDS.division, displayName: "Division" },
    // Model format strings for Season Offensive / Defensive EPA per Play, Wins, Losses, Ties.
    // Def EPA is negated in the DAX (EPA allowed x -1), so higher is better on both axes.
    "[Off EPA per Play]": { name: "OffEpa", displayName: "Offensive EPA/play", format: "0.00" },
    "[Def EPA Saved per Play]": { name: "DefEpaSaved", displayName: "Defensive EPA/play (inverted)", format: "0.00" },
    "[W]": { name: "W", displayName: "W", format: "0" },
    "[L]": { name: "L", displayName: "L", format: "0" },
    "[T]": { name: "T", displayName: "T", format: "0" },
};

/** Offense-vs-defense EPA per play, one point per team, for the season. Slicer filters apply. */
export function teamQuadrant({ season, seasonType, interactionFilters = [] }: TeamQuadrantParams) {
    return {
        connection,
        query: insertInteractionFilters(
            applySeasonFilter(baseQuery, { season, seasonType }),
            interactionFilters,
            TEAM_FILTER_MARKER,
            "beforeMeasures",
        ),
        columnMetadata: teamQuadrantColumns,
        vegaLiteSpec: teamQuadrantVegaLiteSpec,
    };
}
