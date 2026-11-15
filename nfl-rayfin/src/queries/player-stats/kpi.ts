import type { ManagedQueryFactoryParams } from "@microsoft/fabric-interaction-manager";
import { insertInteractionFilters } from "@/lib/query-factory";
import type { ColumnMetadataMap } from "@/lib/to-data-table";
import { applySeasonFilter, connection, type SeasonParams } from "./season-filter";
import { getStatCategory, type StatCategory } from "./stat-categories";

export const KPI_FILTER_MARKER = "/*__FILTER_ARGUMENTS__*/";

export interface KpiParams extends SeasonParams, ManagedQueryFactoryParams {
    category: StatCategory;
}

export interface KpiQuery {
    connection: string;
    query: string;
    columnMetadata: ColumnMetadataMap;
}

/**
 * League totals for a category and season, as one measures-only row. Interaction filters
 * (the player selected in the chart, scatter, or grid) narrow the totals to that player.
 */
export function kpiSummary({ category, season, seasonType, interactionFilters = [] }: KpiParams): KpiQuery {
    const definition = getStatCategory(category);
    const seasonQuery = applySeasonFilter(definition.kpiQuery, { season, seasonType });
    return {
        connection,
        query: insertInteractionFilters(seasonQuery, interactionFilters, KPI_FILTER_MARKER, "afterTable"),
        columnMetadata: definition.kpiColumns,
    };
}
