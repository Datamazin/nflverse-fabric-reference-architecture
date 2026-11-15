import { useMemo, useState, type ReactElement } from "react";
import { X } from "lucide-react";
import type { DataTable, SemanticSelection } from "@microsoft/fabric-visuals-core";
import { InteractionManager, type ManagedInteractionSource } from "@microsoft/fabric-interaction-manager";
import { InteractionManagerProvider, useManagedInteractionSource } from "@microsoft/fabric-interaction-manager/react";
import { DropdownSlicer } from "@microsoft/fabric-slicers";
import { AppHeader } from "@/components/app-shell/app-header";
import { TabStrip } from "@/components/app-shell/header-tabs";
import { toSeasonOptions } from "@/components/player-stats/player-stats-page";
import { EmptyState, ErrorBanner, Skeleton, errorCategoryOf } from "@/components/player-stats/query-states";
import { SeasonControls, seasonTypeLabel } from "@/components/player-stats/stat-controls";
import { useThemeContext } from "@/hooks/theme.context";
import { useQueryFactoryTarget, type QueryFactoryTargetState } from "@/hooks/use-query-factory-target";
import { useSemanticModelQuery } from "@/hooks/use-semantic-model-query";
import { splitRollupDataTable, toDataTable } from "@/lib/to-data-table";
import { seasons as seasonsQuery, type SeasonType } from "@/queries/player-stats";
import {
    TEAM_FIELDS,
    TEAM_GROUPS,
    TEAM_GROUP_DEFINITIONS,
    getTeamView,
    rankingSpec,
    teamDivisions,
    teamQuadrant,
    teamQuadrantVegaLiteSpec,
    teamView,
    type TeamGroup,
    type TeamView,
} from "@/queries/team-stats";
import { TEAM_INTERACTION_IDS, teamInteractionConfiguration } from "./team-interaction-config";
import { cellValue, findTeamRow, labelTotalRow, selectedValues, toTeamKpis } from "./team-stats-helpers";
import { TeamGrid, TeamKpiCards, TeamQuadrant, TeamRanking } from "./team-visuals";

const GROUP_OPTIONS = TEAM_GROUPS.map((group) => ({ value: group, label: TEAM_GROUP_DEFINITIONS[group].label }));

export function TeamStatsPage(): ReactElement {
    const [manager] = useState(() => new InteractionManager(teamInteractionConfiguration));
    return (
        <InteractionManagerProvider manager={manager}>
            <TeamStatsContent />
        </InteractionManagerProvider>
    );
}

function TeamStatsContent(): ReactElement {
    const [group, setGroup] = useState<TeamGroup>("offense");
    // Remember the chosen sub-view per group, so switching groups and back keeps it.
    const [viewByGroup, setViewByGroup] = useState<Record<TeamGroup, TeamView>>(() => ({
        offense: "passing", defense: "defenseOverview", specialTeams: "fieldGoals", penalties: "penalties",
    }));
    const [pickedSeason, setPickedSeason] = useState<string | null>(null);
    const [pickedSeasonType, setPickedSeasonType] = useState<SeasonType>("REG");

    // Shares the Players page's cached seasons result.
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

    const view = viewByGroup[group];
    const definition = getTeamView(view);
    const groupViews = TEAM_GROUP_DEFINITIONS[group].views;
    const seasonLabel = season ? `${season} ${seasonTypeLabel(seasonType)}` : "";

    return (
        <div className="min-h-full bg-background">
            <AppHeader
                route="teams"
                title={`${TEAM_GROUP_DEFINITIONS[group].label} · ${definition.label}`}
                subtitle={`${seasonLabel ? `${seasonLabel} · ` : ""}Teams ranked by ${definition.primaryLabel.toLowerCase()}`}
                tabs={<TabStrip options={GROUP_OPTIONS} value={group} onChange={setGroup} ariaLabel="Team stat group" />}
            />

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
                ) : !season || !seasonOption ? (
                    <EmptyState title="No seasons">The semantic model has no team season stats yet.</EmptyState>
                ) : (
                    <>
                        {groupViews.length > 1 && (
                            <TabStrip
                                variant="chips"
                                ariaLabel={`${TEAM_GROUP_DEFINITIONS[group].label} views`}
                                options={groupViews.map((v) => ({ value: v, label: getTeamView(v).label }))}
                                value={view}
                                onChange={(next) => setViewByGroup((current) => ({ ...current, [group]: next }))}
                            />
                        )}
                        <TeamStatsBody
                            view={view}
                            season={season}
                            seasonType={seasonType}
                            seasons={seasonOptions.map((o) => o.season)}
                            seasonTypes={seasonOption.seasonTypes}
                            onSeasonChange={setPickedSeason}
                            onSeasonTypeChange={setPickedSeasonType}
                            seasonLabel={seasonLabel}
                        />
                    </>
                )}
                <p className="text-200 text-muted-foreground">
                    Source: NFL Play by Play semantic model (nflverse). Click a bar, point, or row to see that team&apos;s numbers; use Conference and Division to compare a group.
                </p>
            </main>
        </div>
    );
}

interface TeamStatsBodyProps {
    view: TeamView;
    season: string;
    seasonType: SeasonType;
    seasons: readonly string[];
    seasonTypes: readonly SeasonType[];
    onSeasonChange: (season: string) => void;
    onSeasonTypeChange: (seasonType: SeasonType) => void;
    seasonLabel: string;
}

const SLICER_LABEL = "font-heading text-200 font-bold uppercase tracking-wider text-muted-foreground";

function TeamStatsBody({ view, season, seasonType, seasons, seasonTypes, onSeasonChange, onSeasonTypeChange, seasonLabel }: TeamStatsBodyProps): ReactElement {
    const { theme } = useThemeContext();
    const definition = getTeamView(view);

    // Data loads: re-evaluated by the conference and division slicers, not by team clicks.
    const viewResult = useQueryFactoryTarget(TEAM_INTERACTION_IDS.viewData, teamView, { view, season, seasonType });
    const quadrantResult = useQueryFactoryTarget(TEAM_INTERACTION_IDS.quadrantData, teamQuadrant, { season, seasonType });
    const divisionsFactory = teamDivisions({ season, seasonType });
    const divisionsResult = useSemanticModelQuery({ connection: divisionsFactory.connection, query: divisionsFactory.query });
    const divisionsTable = useMemo(
        () => divisionsResult.data?.status === "success" ? toDataTable(divisionsResult.data.table, divisionsFactory.columnMetadata) : null,
        // The factory is derived from the season; its query string identifies it.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [divisionsResult.data, divisionsFactory.query],
    );

    // Sources.
    const rankingSource = useManagedInteractionSource(TEAM_INTERACTION_IDS.ranking);
    const quadrantSource = useManagedInteractionSource(TEAM_INTERACTION_IDS.quadrant);
    const gridSource = useManagedInteractionSource(TEAM_INTERACTION_IDS.grid);
    const conferenceSource = useManagedInteractionSource(TEAM_INTERACTION_IDS.conferenceSlicer);
    const divisionSource = useManagedInteractionSource(TEAM_INTERACTION_IDS.divisionSlicer);
    const teamSources = [rankingSource, quadrantSource, gridSource];
    const activeSelections: readonly SemanticSelection[] = teamSources.find((s) => s.selections.length > 0)?.selections ?? [];
    const selectedTeamKey = selectedValues(activeSelections, TEAM_FIELDS.teamKey)[0];
    const slicersActive = conferenceSource.selections.length > 0 || divisionSource.selections.length > 0;
    const clearTeam = (): void => {
        for (const source of teamSources) {
            if (source.selections.length > 0) source.onInteraction([{ action: "clear" }]);
        }
    };

    const split = useMemo(() => {
        if (viewResult.status === "loading" || viewResult.status === "error") return null;
        return splitRollupDataTable(viewResult.data, { rollupFlagColumns: [TEAM_FIELDS.isGrandTotal] });
    }, [viewResult]);

    const totalLabel = slicersActive ? "Selected teams" : "All teams";
    const selectedRow = split ? findTeamRow(split.bodyTable, selectedTeamKey) : undefined;
    const selectedName = split && selectedRow ? String(cellValue(split.bodyTable, selectedRow, TEAM_FIELDS.team) ?? "") : null;

    const controls = (
        <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-end gap-3">
                <SeasonControls
                    seasons={seasons}
                    season={season}
                    onSeasonChange={onSeasonChange}
                    seasonTypes={seasonTypes}
                    seasonType={seasonType}
                    onSeasonTypeChange={onSeasonTypeChange}
                />
                {divisionsTable ? (
                    <>
                        <div className="flex w-40 flex-col gap-1">
                            <span className={SLICER_LABEL}>Conference</span>
                            <DropdownSlicer
                                data={divisionsTable}
                                column={TEAM_FIELDS.conference}
                                title="Conference"
                                theme={theme}
                                displayOptions={{ hideHeader: true, showSearch: false }}
                                onInteraction={conferenceSource.onInteraction}
                            />
                        </div>
                        <div className="flex w-48 flex-col gap-1">
                            <span className={SLICER_LABEL}>Division</span>
                            <DropdownSlicer
                                data={divisionsTable}
                                column={TEAM_FIELDS.division}
                                title="Division"
                                theme={theme}
                                displayOptions={{ hideHeader: true, showSearch: false }}
                                onInteraction={divisionSource.onInteraction}
                            />
                        </div>
                    </>
                ) : divisionsResult.data?.status === "error" ? (
                    <p role="alert" className="text-200 text-destructive">Conference and division filters are unavailable: {divisionsResult.data.error.message}</p>
                ) : (
                    <Skeleton className="h-16 w-88" label="Loading conference and division filters" />
                )}
            </div>
            {selectedName && (
                <button
                    type="button"
                    onClick={clearTeam}
                    className="inline-flex h-9 items-center gap-2 rounded-full border border-signal/50 bg-card px-3 text-300 font-semibold text-foreground hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                    <span className="max-w-60 truncate">{selectedName}</span>
                    <X aria-hidden className="icon-size-200 text-signal" />
                    <span className="sr-only">Clear team selection</span>
                </button>
            )}
            {(conferenceSource.error || divisionSource.error) && (
                <p role="alert" className="w-full text-200 text-destructive">{(conferenceSource.error ?? divisionSource.error)?.message}</p>
            )}
        </div>
    );

    if (viewResult.status === "loading") {
        return (
            <>
                {controls}
                <div className="grid grid-cols-2 gap-(--grid-gap) lg:grid-cols-4" aria-busy="true">
                    {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" label="Loading totals" />)}
                </div>
                <div className="grid grid-cols-1 gap-(--grid-gap) lg:grid-cols-12" aria-busy="true">
                    <Skeleton className="h-160 lg:col-span-5" label="Loading team ranking" />
                    <Skeleton className="h-160 lg:col-span-7" label="Loading offense vs defense chart" />
                    <Skeleton className="h-96 lg:col-span-12" label="Loading team table" />
                </div>
            </>
        );
    }
    if (viewResult.status === "error") {
        return (
            <>
                {controls}
                <ErrorBanner title="Team stats unavailable" message={viewResult.error.message} category={errorCategoryOf(viewResult.error)} />
            </>
        );
    }
    if (!split || split.bodyTable.rows.length === 0) {
        return (
            <>
                {controls}
                <EmptyState title={`No ${definition.label.toLowerCase()} stats`}>
                    No teams have {definition.label.toLowerCase()} stats for the {seasonLabel}{slicersActive ? " with the selected conference or division" : ""}.
                </EmptyState>
            </>
        );
    }

    const { bodyTable, grandTotalTable } = split;
    const kpiRow = selectedRow ?? grandTotalTable.rows[0];
    const kpis = toTeamKpis(selectedRow ? bodyTable : grandTotalTable, kpiRow, definition.kpis);
    const kpiSubtitle = selectedName ?? `${totalLabel} · ${seasonLabel}`;
    const teamCount = bodyTable.rows.length;

    return (
        <>
            {controls}
            {viewResult.status === "refresh-error" && (
                <ErrorBanner title="Team stats did not refresh" message={viewResult.error.message} category={errorCategoryOf(viewResult.error)} />
            )}
            <div className={viewResult.status === "refreshing" ? "opacity-60 transition-opacity" : undefined} aria-busy={viewResult.status === "refreshing"}>
                <TeamKpiCards kpis={kpis} subtitle={kpiSubtitle} />
            </div>
            <div className="grid grid-cols-1 gap-(--grid-gap) lg:grid-cols-12">
                <div className="min-w-0 lg:col-span-5">
                    <TeamRanking
                        spec={rankingSpec(definition.higherIsBetter)}
                        data={bodyTable}
                        source={rankingSource}
                        selections={activeSelections}
                        title={`${definition.primaryLabel}${definition.higherIsBetter ? "" : " (lower is better)"}`}
                        subtitle={`${teamCount} teams · ${seasonLabel}`}
                    />
                </div>
                <div className="min-w-0 lg:col-span-7">
                    <QuadrantPanel
                        result={quadrantResult}
                        source={quadrantSource}
                        selections={activeSelections}
                        seasonLabel={seasonLabel}
                    />
                </div>
                <div className="min-w-0 lg:col-span-12">
                    <TeamGrid
                        body={bodyTable}
                        total={labelTotalRow(grandTotalTable, totalLabel)}
                        higherIsBetter={definition.higherIsBetter}
                        source={gridSource}
                        selections={activeSelections}
                        title={`${definition.label} · Team Stats`}
                        subtitle={`${seasonLabel} · ${teamCount} teams · click a header to re-sort`}
                    />
                </div>
            </div>
            {definition.note && <p className="text-200 text-muted-foreground">{definition.note}</p>}
        </>
    );
}

interface QuadrantPanelProps {
    result: QueryFactoryTargetState<DataTable>;
    source: ManagedInteractionSource;
    selections: readonly SemanticSelection[];
    seasonLabel: string;
}

function QuadrantPanel({ result, source, selections, seasonLabel }: QuadrantPanelProps): ReactElement {
    if (result.status === "loading") return <Skeleton className="h-160" label="Loading offense vs defense chart" />;
    if (result.status === "error") {
        return <ErrorBanner title="Offense vs defense chart unavailable" message={result.error.message} category={errorCategoryOf(result.error)} />;
    }
    const data: DataTable = result.data;
    if (data.rows.length === 0) {
        return <EmptyState title="No teams" className="h-160">No team EPA for the {seasonLabel}.</EmptyState>;
    }
    return (
        <div className="flex flex-col gap-1">
            {result.status === "refresh-error" && (
                <ErrorBanner title="Chart did not refresh" message={result.error.message} category={errorCategoryOf(result.error)} />
            )}
            <TeamQuadrant
                spec={teamQuadrantVegaLiteSpec}
                data={data}
                source={source}
                selections={selections}
                title="Offense vs Defense · EPA per play"
                subtitle="Up and to the right is better on both sides of the ball"
            />
        </div>
    );
}
