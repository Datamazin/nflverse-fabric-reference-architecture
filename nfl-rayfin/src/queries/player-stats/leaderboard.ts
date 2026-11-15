import type { VisualizationSpec } from "@microsoft/fabric-visuals";
import type { ColumnMetadataMap } from "@/lib/to-data-table";
import { applySeasonFilter, connection, type SeasonParams } from "./season-filter";
import { getStatCategory, leaderboardColumnMetadata, type StatCategory } from "./stat-categories";
import leaderboardSpec from "./leaderboard.json";

export interface LeaderboardParams extends SeasonParams {
    category: StatCategory;
}

export interface LeaderboardQuery {
    connection: string;
    query: string;
    columnMetadata: ColumnMetadataMap;
    vegaLiteSpec: VisualizationSpec;
}

/**
 * Top 50 players for a category and season, ranked by the category's primary stat.
 * The leaders bar chart, the efficiency scatter, and the leaderboard grid all read this
 * one result, so a page view costs a single round trip (the query cache dedupes it).
 * `vegaLiteSpec` is the top-10 leaders bar chart.
 */
export function leaderboard({ category, season, seasonType }: LeaderboardParams): LeaderboardQuery {
    const definition = getStatCategory(category);
    return {
        connection,
        query: applySeasonFilter(definition.leaderboardQuery, { season, seasonType }),
        columnMetadata: leaderboardColumnMetadata(category),
        vegaLiteSpec: leaderboardSpec as VisualizationSpec,
    };
}
