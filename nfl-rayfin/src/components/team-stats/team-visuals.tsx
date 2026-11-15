import { useMemo, type ReactElement } from "react";
import { KpiCard, VegaVisual, type VisualizationSpec } from "@microsoft/fabric-visuals";
import { DataGrid, type GridColumnDef } from "@microsoft/fabric-datagrid";
import type { DataTable, SemanticSelection } from "@microsoft/fabric-visuals-core";
import type { ManagedInteractionSource } from "@microsoft/fabric-interaction-manager";
import { useThemeContext } from "@/hooks/theme.context";
import { TEAM_FIELDS } from "@/queries/team-stats";
import type { TeamKpi } from "./team-stats-helpers";

/** Labels keep the model's format ("4,735", not "4.7K"), matching the grid and tooltips. */
const CHART_CAPABILITIES = { disableCompactNumberFormatting: true } as const;
/** The ranking spec reserves right padding for the longest value label, so labels are not truncated. */
const RANKING_CAPABILITIES = { ...CHART_CAPABILITIES, disableTextTruncation: true } as const;

const KPI_GRID_COLUMNS: Record<number, string> = {
    3: "grid-cols-2 md:grid-cols-3",
    4: "grid-cols-2 lg:grid-cols-4",
};

export function TeamKpiCards({ kpis, subtitle }: { kpis: readonly TeamKpi[]; subtitle: string }): ReactElement {
    const { theme } = useThemeContext();
    return (
        <div className={`grid gap-(--grid-gap) ${KPI_GRID_COLUMNS[kpis.length] ?? KPI_GRID_COLUMNS[4]}`}>
            {kpis.map((kpi) => (
                <KpiCard
                    key={kpi.name}
                    theme={theme}
                    header={{ title: kpi.title, subtitle }}
                    callout={{ metric: { value: kpi.value, format: kpi.format } }}
                    containerClassName="border-t-4 border-t-signal"
                />
            ))}
        </div>
    );
}

interface TeamChartProps {
    spec: VisualizationSpec;
    data: DataTable;
    source: ManagedInteractionSource;
    selections: readonly SemanticSelection[];
    title: string;
    subtitle: string;
}

function SourceError({ error }: { error: Error | undefined }): ReactElement | null {
    return error ? <p role="alert" className="text-200 text-destructive">{error.message}</p> : null;
}

function TeamChart({ spec, data, source, selections, title, subtitle, capabilities }: TeamChartProps & { capabilities: object }): ReactElement {
    const { theme } = useThemeContext();
    return (
        <div className="flex h-full min-w-0 flex-col gap-1">
            <VegaVisual
                spec={spec}
                data={data}
                theme={theme}
                header={{ title, subtitle }}
                selections={selections}
                selectableFields={source.selectableFields}
                onInteraction={source.onInteraction}
                capabilities={capabilities}
                containerRootClassName="h-160"
            />
            <SourceError error={source.error} />
        </div>
    );
}

export function TeamRanking(props: TeamChartProps): ReactElement {
    return <TeamChart {...props} capabilities={RANKING_CAPABILITIES} />;
}

export function TeamQuadrant(props: TeamChartProps): ReactElement {
    return <TeamChart {...props} capabilities={CHART_CAPABILITIES} />;
}

/** Identity columns folded into the Team cell rather than shown as their own columns. */
const TEAM_DETAIL_FIELDS: ReadonlySet<string> = new Set([
    TEAM_FIELDS.teamKey,
    TEAM_FIELDS.team,
    TEAM_FIELDS.teamCode,
    TEAM_FIELDS.logo,
    TEAM_FIELDS.conference,
    TEAM_FIELDS.division,
]);

function TeamCell({ name, division, logo }: { name: string; division: string; logo: string }): ReactElement {
    return (
        <div className="flex items-center gap-2 py-1">
            {logo ? (
                <img src={logo} alt="" loading="lazy" referrerPolicy="no-referrer" className="icon-size-600 shrink-0 object-contain" />
            ) : (
                <span aria-hidden className="icon-size-600 shrink-0" />
            )}
            <div className="flex min-w-0 flex-col leading-tight">
                <span className="truncate font-semibold text-emphasis-foreground">{name}</span>
                {division && <span className="text-200 text-muted-foreground">{division}</span>}
            </div>
        </div>
    );
}

/** Grid columns: a composite Team cell, the ranked stat, then every other stat with its model format. */
export function buildTeamGridColumns(data: DataTable): GridColumnDef[] {
    const teamColumn: GridColumnDef = {
        id: TEAM_FIELDS.team,
        header: "Team",
        width: 230,
        minWidth: 200,
        cellRenderer: (value, row) => (
            <TeamCell
                name={String(value ?? "")}
                division={String(row[TEAM_FIELDS.division] ?? "")}
                logo={String(row[TEAM_FIELDS.logo] ?? "")}
            />
        ),
    };
    const statColumns: GridColumnDef[] = data.columns
        .filter((column) => !TEAM_DETAIL_FIELDS.has(column.name))
        .map((column) => ({ id: column.name, header: column.displayName ?? column.name, numericStyling: true, filterable: false }));
    const isPrimary = (column: GridColumnDef): boolean => column.id === TEAM_FIELDS.primary;
    return [teamColumn, ...statColumns.filter(isPrimary), ...statColumns.filter((column) => !isPrimary(column))];
}

interface TeamGridProps {
    body: DataTable;
    total: DataTable;
    higherIsBetter: boolean;
    source: ManagedInteractionSource;
    selections: readonly SemanticSelection[];
    title: string;
    subtitle: string;
}

export function TeamGrid({ body, total, higherIsBetter, source, selections, title, subtitle }: TeamGridProps): ReactElement {
    const { theme } = useThemeContext();
    const columns = useMemo(() => buildTeamGridColumns(body), [body]);
    return (
        // On narrow screens the grid keeps readable stat columns and scrolls sideways.
        <div className="flex min-w-0 flex-col gap-1 overflow-x-auto">
            <DataGrid
                containerRootClassName="min-w-4xl"
                data={body}
                columns={columns}
                grandTotals={{ position: "bottom", data: total }}
                theme={theme}
                header={{ title, subtitle }}
                defaultSort={[{ columnId: TEAM_FIELDS.primary, direction: higherIsBetter ? "desc" : "asc" }]}
                selections={selections}
                selectableFields={source.selectableFields}
                onInteraction={source.onInteraction}
            />
            <SourceError error={source.error} />
        </div>
    );
}
