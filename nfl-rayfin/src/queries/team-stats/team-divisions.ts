import type { ColumnMetadataMap } from "@/lib/to-data-table";
import { applySeasonFilter, connection, type SeasonParams } from "@/queries/player-stats/season-filter";
import { TEAM_FIELDS } from "./team-views";
import baseQuery from "./team-divisions.dax?raw";

/** Conferences and divisions with games in the season: the conference and division slicers' values. */
export function teamDivisions(params: SeasonParams) {
    return {
        connection,
        query: applySeasonFilter(baseQuery, params),
        columnMetadata: {
            // Slicers report selections under their column name, so these names are the interaction field ids.
            "Team[Team Conference]": { name: TEAM_FIELDS.conference, displayName: "Conference" },
            "Team[Team Division]": { name: TEAM_FIELDS.division, displayName: "Division" },
            "[Games]": { name: "Games", displayName: "Games", format: "0" },
        } satisfies ColumnMetadataMap,
    };
}
