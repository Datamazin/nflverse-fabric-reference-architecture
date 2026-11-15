import { useMemo, useState, type ReactElement } from "react";
import { Moon, Sun, X } from "lucide-react";
import type { DataTable, SemanticSelection } from "@microsoft/fabric-visuals-core";
import { InteractionManager } from "@microsoft/fabric-interaction-manager";
import {
    InteractionManagerProvider,
    useInteractionManager,
    useManagedInteractionSource,
} from "@microsoft/fabric-interaction-manager/react";
import { useThemeContext } from "@/hooks/theme.context";
import { useSemanticModelQuery } from "@/hooks/use-semantic-model-query";
import { toDataTable } from "@/lib/to-data-table";
import {
    LEADERBOARD_FIELDS,
    isSeasonType,
    leaderboard,
    seasons as seasonsQuery,
    statCategories,
    type LeaderboardParams,
    type SeasonType,
    type StatCategory,
} from "@/queries/player-stats";
import { INTERACTION_IDS, interactionConfiguration } from "./interaction-config";
import { KpiStrip } from "./kpi-strip";
import { EfficiencyScatter, LeaderboardGrid, LeadersChart } from "./player-visuals";
import { EmptyState, ErrorBanner, Skeleton, errorCategoryOf } from "./query-states";
import { CategoryTabs, SeasonControls, seasonTypeLabel } from "./stat-controls";

export function PlayerStatsPage(): ReactElement {
    const [manager] = useState(() => new InteractionManager(interactionConfiguration));
    return (
        <InteractionManagerProvider manager={manager}>
            <PlayerStatsContent />
        </InteractionManagerProvider>
    );
}

export interface SeasonOption {
    season: string;
    seasonTypes: SeasonType[];
}

/** Groups the seasons query's (season, season_type) rows, preserving its newest-first order. */
export function toSeasonOptions(table: DataTable): SeasonOption[] {
    const seasonIndex = table.columns.findIndex((c) => c.name === "Season");
    const typeIndex = table.columns.findIndex((c) => c.name === "SeasonType");
    const bySeason = new Map<string, SeasonType[]>();
    for (const row of table.rows) {
        const season = row[seasonIndex];
        const seasonType = row[typeIndex];
        if (typeof season !== "string" || !isSeasonType(seasonType)) continue;
        const types = bySeason.get(season) ?? [];
        if (!types.includes(seasonType)) types.push(seasonType);
        bySeason.set(season, types);
    }
    return [...bySeason].map(([season, seasonTypes]) => ({
        season,
        seasonTypes: (["REG", "POST"] as const).filter((t) => seasonTypes.includes(t)),
    }));
}

/** The player names behind the active selection's PlayerKey set predicates. */
export function selectedPlayerNames(selections: readonly SemanticSelection[], table: DataTable | null): string[] {
    if (!table) return [];
    const keyIndex = table.columns.findIndex((c) => c.name === LEADERBOARD_FIELDS.playerKey);
    const nameIndex = table.columns.findIndex((c) => c.name === LEADERBOARD_FIELDS.player);
    const keys = new Set<unknown>();
    for (const selection of selections) {
        for (const predicate of selection.predicates) {
            if (predicate.type === "set" && predicate.fieldId === LEADERBOARD_FIELDS.playerKey && !predicate.excluded) {
                for (const value of predicate.values) {
                    if (value.kind === "value") keys.add(value.value);
                }
            }
        }
    }
    return table.rows.filter((row) => keys.has(row[keyIndex])).map((row) => String(row[nameIndex] ?? ""));
}

function PlayerStatsContent(): ReactElement {
    const { isDark, toggleTheme } = useThemeContext();
    const manager = useInteractionManager();

    const [category, setCategory] = useState<StatCategory>("passing");
    const [pickedSeason, setPickedSeason] = useState<string | null>(null);
    const [pickedSeasonType, setPickedSeasonType] = useState<SeasonType>("REG");

    // Season options (small, cached for the session).
    const seasonsResult = useSemanticModelQuery({ connection: seasonsQuery.connection, query: seasonsQuery.query });
    const seasonOptions = useMemo(
        () => seasonsResult.data?.status === "success"
            ? toSeasonOptions(toDataTable(seasonsResult.data.table, seasonsQuery.columnMetadata))
            : [],
        [seasonsResult.data],
    );
    const seasonOption = seasonOptions.find((o) => o.season === pickedSeason) ?? seasonOptions[0];
    const season = seasonOption?.season ?? null;
    const seasonType: SeasonType = seasonOption?.seasonTypes.includes(pickedSeasonType)
        ? pickedSeasonType
        : seasonOption?.seasonTypes[0] ?? "REG";
    const params: LeaderboardParams | null = season ? { category, season, seasonType } : null;

    // One leaderboard query feeds the bar chart, the scatter, and the grid.
    const leaderboardFactory = params ? leaderboard(params) : null;
    const leaderboardResult = useSemanticModelQuery({
        connection: leaderboardFactory?.connection ?? "",
        query: leaderboardFactory?.query ?? "",
    });
    const leaderboardTable = useMemo(
        () => leaderboardFactory && !leaderboardResult.isLoading && leaderboardResult.data?.status === "success"
            ? toDataTable(leaderboardResult.data.table, leaderboardFactory.columnMetadata)
            : null,
        // The factory is derived from `params`; its query string identifies it.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [leaderboardFactory?.query, leaderboardResult.data, leaderboardResult.isLoading],
    );

    // Player-selection sources; one is active at a time, and its selection is mirrored to all three.
    const chartSource = useManagedInteractionSource(INTERACTION_IDS.leadersChart);
    const scatterSource = useManagedInteractionSource(INTERACTION_IDS.efficiencyScatter);
    const gridSource = useManagedInteractionSource(INTERACTION_IDS.leaderboardGrid);
    const activeSelections: readonly SemanticSelection[] =
        [chartSource, scatterSource, gridSource].find((s) => s.selections.length > 0)?.selections ?? [];
    const selectedNames = selectedPlayerNames(activeSelections, leaderboardTable);
    const scopeLabel = activeSelections.length > 0
        ? (selectedNames.length > 0 ? selectedNames.join(", ") : "Selected player")
        : null;

    // A selected player may not exist in the next category or season, so reset selections first.
    const changeParams = (update: () => void): void => {
        manager.clearAll();
        update();
    };

    const definition = statCategories[category];
    const seasonLabel = season ? `${season} ${seasonTypeLabel(seasonType)}` : "";

    return (
        <div className="min-h-full bg-background">
            <header className="yard-lines text-on-brand">
                <div className="mx-auto flex max-w-screen-2xl flex-col gap-4 px-4 pt-6 md:px-8">
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <p className="font-heading text-300 font-bold uppercase tracking-[0.2em] text-on-brand/80">
                                Gridiron · Player Stats
                            </p>
                            <h1 className="font-page-title text-page-title uppercase leading-none tracking-wide text-on-brand">
                                {definition.label} Leaders
                            </h1>
                            <p className="font-page-subtitle text-page-subtitle mt-1 text-on-brand/80">
                                {seasonLabel ? `${seasonLabel} · ` : ""}Top 50 by {definition.primaryLabel.toLowerCase()}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={toggleTheme}
                            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-on-brand/30 text-on-brand hover:bg-on-brand/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-brand"
                        >
                            {isDark ? <Sun aria-hidden className="icon-size-200" /> : <Moon aria-hidden className="icon-size-200" />}
                        </button>
                    </div>
                    <CategoryTabs value={category} onChange={(next) => changeParams(() => setCategory(next))} />
                </div>
            </header>

            <main className="mx-auto flex max-w-screen-2xl flex-col gap-(--grid-gap) px-4 py-6 md:px-8">
                {seasonsResult.data?.status === "error" ? (
                    <ErrorBanner
                        title="Seasons unavailable"
                        message={seasonsResult.data.error.message}
                        category={errorCategoryOf(seasonsResult.data.error)}
                        onRetry={() => void seasonsResult.refetch()}
                    />
                ) : !seasonsResult.data || seasonsResult.isLoading ? (
                    <Skeleton className="h-16 max-w-md" label="Loading seasons" />
                ) : seasonOptions.length === 0 || !params ? (
                    <EmptyState title="No seasons">The semantic model has no player season stats yet.</EmptyState>
                ) : (
                    <>
                        <div className="flex flex-wrap items-end justify-between gap-3">
                            <SeasonControls
                                seasons={seasonOptions.map((o) => o.season)}
                                season={params.season}
                                onSeasonChange={(next) => changeParams(() => setPickedSeason(next))}
                                seasonTypes={seasonOption?.seasonTypes ?? []}
                                seasonType={params.seasonType}
                                onSeasonTypeChange={(next) => changeParams(() => setPickedSeasonType(next))}
                            />
                            {scopeLabel && (
                                <button
                                    type="button"
                                    onClick={() => manager.clearAll()}
                                    className="inline-flex h-9 items-center gap-2 rounded-full border border-signal/50 bg-card px-3 text-300 font-semibold text-foreground hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                                >
                                    <span className="max-w-60 truncate">{scopeLabel}</span>
                                    <X aria-hidden className="icon-size-200 text-signal" />
                                    <span className="sr-only">Clear player selection</span>
                                </button>
                            )}
                        </div>

                        <KpiStrip
                            category={params.category}
                            season={params.season}
                            seasonType={params.seasonType}
                            scopeLabel={scopeLabel}
                        />

                        <LeaderboardSection
                            params={params}
                            table={leaderboardTable}
                            isLoading={leaderboardResult.isLoading || (!leaderboardResult.data && !!leaderboardFactory)}
                            error={leaderboardResult.data?.status === "error" ? leaderboardResult.data.error : undefined}
                            onRetry={() => void leaderboardResult.refetch()}
                            selections={activeSelections}
                            sources={{ chart: chartSource, scatter: scatterSource, grid: gridSource }}
                            seasonLabel={seasonLabel}
                        />
                    </>
                )}
                <p className="text-200 text-muted-foreground">
                    Source: NFL Play by Play semantic model (nflverse). Click a bar, point, or row to scope the totals to a player.
                </p>
            </main>
        </div>
    );
}

interface LeaderboardSectionProps {
    params: LeaderboardParams;
    table: DataTable | null;
    isLoading: boolean;
    error: { message: string; category?: string } | undefined;
    onRetry: () => void;
    selections: readonly SemanticSelection[];
    sources: {
        chart: ReturnType<typeof useManagedInteractionSource>;
        scatter: ReturnType<typeof useManagedInteractionSource>;
        grid: ReturnType<typeof useManagedInteractionSource>;
    };
    seasonLabel: string;
}

function LeaderboardSection({ params, table, isLoading, error, onRetry, selections, sources, seasonLabel }: LeaderboardSectionProps): ReactElement {
    const definition = statCategories[params.category];

    if (error) {
        return <ErrorBanner title="Leaderboard unavailable" message={error.message} category={errorCategoryOf(error)} onRetry={onRetry} />;
    }
    if (isLoading || !table) {
        return (
            <div className="grid grid-cols-1 gap-(--grid-gap) lg:grid-cols-12" aria-busy="true">
                <Skeleton className="h-96 lg:col-span-7" label="Loading leaders chart" />
                <Skeleton className="h-96 lg:col-span-5" label="Loading efficiency chart" />
                <Skeleton className="h-96 lg:col-span-12" label="Loading leaderboard" />
            </div>
        );
    }
    if (table.rows.length === 0) {
        return (
            <EmptyState title={`No ${definition.label.toLowerCase()} stats`}>
                No players recorded {definition.label.toLowerCase()} stats in the {seasonLabel}. Try another season or season type.
            </EmptyState>
        );
    }

    return (
        <div className="grid grid-cols-1 gap-(--grid-gap) lg:grid-cols-12">
            <div className="min-w-0 lg:col-span-7">
                <LeadersChart
                    params={params}
                    data={table}
                    source={sources.chart}
                    selections={selections}
                    title={`Top 10 · ${definition.primaryLabel}`}
                    subtitle={seasonLabel}
                />
            </div>
            <div className="min-w-0 lg:col-span-5">
                <EfficiencyScatter
                    params={params}
                    data={table}
                    source={sources.scatter}
                    selections={selections}
                    title={`${definition.primaryLabel} vs ${definition.efficiencyLabel}`}
                    subtitle={`Top ${table.rows.length} players · volume against efficiency`}
                />
            </div>
            <div className="min-w-0 lg:col-span-12">
                <LeaderboardGrid
                    data={table}
                    source={sources.grid}
                    selections={selections}
                    title={`${definition.label} Leaderboard`}
                    subtitle={`${seasonLabel} · top ${table.rows.length} by ${definition.primaryLabel.toLowerCase()} · click a header to re-sort`}
                />
            </div>
        </div>
    );
}
