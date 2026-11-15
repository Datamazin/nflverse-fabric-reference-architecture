import type { ReactElement } from "react";
import { KpiCard } from "@microsoft/fabric-visuals";
import type { DataTable } from "@microsoft/fabric-visuals-core";
import { useThemeContext } from "@/hooks/theme.context";
import { useQueryFactoryTarget } from "@/hooks/use-query-factory-target";
import { kpiSummary, type SeasonType, type StatCategory } from "@/queries/player-stats";
import { INTERACTION_IDS } from "./interaction-config";
import { EmptyState, ErrorBanner, Skeleton, errorCategoryOf } from "./query-states";

interface KpiStripProps {
    category: StatCategory;
    season: string;
    seasonType: SeasonType;
    /** Name(s) of the selected player(s), or null when showing league totals. */
    scopeLabel: string | null;
}

export interface KpiMetric {
    name: string;
    title: string;
    value: number | string | null;
    format: string | undefined;
}

/** Maps the single measures-only KPI row to one metric per column, preserving nulls. */
export function toKpiMetrics(table: DataTable): KpiMetric[] {
    const row = table.rows[0];
    if (!row) return [];
    return table.columns.map((column, index) => {
        const raw = row[index];
        const value = typeof raw === "number" || typeof raw === "string" ? raw : null;
        return { name: column.name, title: column.displayName ?? column.name, value, format: column.format };
    });
}

const GRID_COLUMNS: Record<number, string> = {
    2: "grid-cols-2",
    3: "grid-cols-2 md:grid-cols-3",
    4: "grid-cols-2 lg:grid-cols-4",
};

export function KpiStrip({ category, season, seasonType, scopeLabel }: KpiStripProps): ReactElement {
    const { theme } = useThemeContext();
    const result = useQueryFactoryTarget(INTERACTION_IDS.kpis, kpiSummary, { category, season, seasonType });

    if (result.status === "loading") {
        return (
            <div className="grid grid-cols-2 gap-(--grid-gap) lg:grid-cols-4" aria-busy="true">
                {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" label="Loading totals" />)}
            </div>
        );
    }
    if (result.status === "error") {
        return <ErrorBanner title="Totals unavailable" message={result.error.message} category={errorCategoryOf(result.error)} />;
    }

    const metrics = toKpiMetrics(result.data);
    if (metrics.length === 0) {
        return <EmptyState title="No totals">No player stats were recorded for {season} {seasonType}.</EmptyState>;
    }

    const subtitle = scopeLabel ?? `All players · ${season} ${seasonType === "REG" ? "Regular season" : "Postseason"}`;
    return (
        <div className="flex flex-col gap-2">
            {result.status === "refresh-error" && (
                <ErrorBanner title="Totals did not refresh" message={result.error.message} category={errorCategoryOf(result.error)} />
            )}
            <div
                className={`grid gap-(--grid-gap) ${GRID_COLUMNS[metrics.length] ?? GRID_COLUMNS[4]} ${result.status === "refreshing" ? "opacity-60 transition-opacity" : ""}`}
                aria-busy={result.status === "refreshing"}
            >
                {metrics.map((metric) => (
                    <KpiCard
                        key={metric.name}
                        theme={theme}
                        header={{ title: metric.title, subtitle }}
                        callout={{ metric: { value: metric.value, format: metric.format } }}
                        containerClassName="border-t-4 border-t-signal"
                    />
                ))}
            </div>
        </div>
    );
}
