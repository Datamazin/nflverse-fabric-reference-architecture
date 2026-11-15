import { useMemo, type ReactElement } from "react";
import { VegaVisual } from "@microsoft/fabric-visuals";
import { DataGrid, type GridColumnDef } from "@microsoft/fabric-datagrid";
import type { DataTable, SemanticSelection } from "@microsoft/fabric-visuals-core";
import type { ManagedInteractionSource } from "@microsoft/fabric-interaction-manager";
import { useThemeContext } from "@/hooks/theme.context";
import {
    LEADERBOARD_FIELDS,
    efficiencyScatter,
    leaderboard,
    type LeaderboardParams,
} from "@/queries/player-stats";

interface SharedVisualProps {
    params: LeaderboardParams;
    data: DataTable;
    /** This component's managed interaction source (bound by the page). */
    source: ManagedInteractionSource;
    /** The active player selection, mirrored across the chart, scatter, and grid. */
    selections: readonly SemanticSelection[];
    title: string;
    subtitle: string;
}

/** Keep labels in the model's format string ("2,627", not "2.6K") so charts match the grid and tooltips. */
const CHART_CAPABILITIES = { disableCompactNumberFormatting: true } as const;
/**
 * The leaders chart always shows exactly ten bars, so it needs no categorical scrollbar. Its spec
 * reserves right padding for the longest value label, so labels are drawn in full, not truncated.
 */
const LEADERS_CAPABILITIES = { ...CHART_CAPABILITIES, disableCategoricalScroll: true, disableTextTruncation: true } as const;

function SourceError({ error }: { error: Error | undefined }): ReactElement | null {
    if (!error) return null;
    return <p role="alert" className="text-200 text-destructive">{error.message}</p>;
}

export function LeadersChart({ params, data, source, selections, title, subtitle }: SharedVisualProps): ReactElement {
    const { theme } = useThemeContext();
    const { vegaLiteSpec } = leaderboard(params);
    return (
        <div className="flex min-w-0 flex-col gap-1">
            <VegaVisual
                spec={vegaLiteSpec}
                data={data}
                theme={theme}
                header={{ title, subtitle }}
                selections={selections}
                selectableFields={source.selectableFields}
                onInteraction={source.onInteraction}
                capabilities={LEADERS_CAPABILITIES}
                containerRootClassName="h-96"
            />
            <SourceError error={source.error} />
        </div>
    );
}

export function EfficiencyScatter({ params, data, source, selections, title, subtitle }: SharedVisualProps): ReactElement {
    const { theme } = useThemeContext();
    const { vegaLiteSpec } = efficiencyScatter(params);
    return (
        <div className="flex min-w-0 flex-col gap-1">
            <VegaVisual
                spec={vegaLiteSpec}
                data={data}
                theme={theme}
                header={{ title, subtitle }}
                selections={selections}
                selectableFields={source.selectableFields}
                onInteraction={source.onInteraction}
                capabilities={CHART_CAPABILITIES}
                containerRootClassName="h-96"
            />
            <SourceError error={source.error} />
        </div>
    );
}

/** Identity columns folded into the Player cell rather than shown as their own columns. */
const PLAYER_DETAIL_FIELDS: ReadonlySet<string> = new Set([
    LEADERBOARD_FIELDS.playerKey,
    LEADERBOARD_FIELDS.player,
    LEADERBOARD_FIELDS.position,
    LEADERBOARD_FIELDS.headshot,
    LEADERBOARD_FIELDS.team,
]);

function PlayerCell({ name, position, team, headshot }: { name: string; position: string; team: string; headshot: string }): ReactElement {
    return (
        <div className="flex items-center gap-2 py-1">
            {headshot ? (
                <img
                    src={headshot}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="icon-size-600 shrink-0 rounded-full bg-muted object-cover"
                />
            ) : (
                <span aria-hidden className="icon-size-600 shrink-0 rounded-full bg-muted" />
            )}
            <div className="flex min-w-0 flex-col leading-tight">
                <span className="truncate font-semibold text-emphasis-foreground">{name}</span>
                <span className="text-200 text-muted-foreground">{[position, team].filter(Boolean).join(" · ")}</span>
            </div>
        </div>
    );
}

/** Grid columns: a composite Player cell, then every stat column with its model format. */
export function buildLeaderboardColumns(data: DataTable): GridColumnDef[] {
    const playerColumn: GridColumnDef = {
        id: LEADERBOARD_FIELDS.player,
        header: "Player",
        width: 230,
        minWidth: 200,
        cellRenderer: (value, row) => (
            <PlayerCell
                name={String(value ?? "")}
                position={String(row[LEADERBOARD_FIELDS.position] ?? "")}
                team={String(row[LEADERBOARD_FIELDS.team] ?? "")}
                headshot={String(row[LEADERBOARD_FIELDS.headshot] ?? "")}
            />
        ),
    };
    const statColumns: GridColumnDef[] = data.columns
        .filter((column) => !PLAYER_DETAIL_FIELDS.has(column.name))
        .map((column) => ({
            id: column.name,
            header: column.displayName ?? column.name,
            numericStyling: true,
            filterable: false,
        }));
    // Lead with the ranked stat, as the leaderboard is sorted by it.
    const isPrimary = (column: GridColumnDef): boolean => column.id === LEADERBOARD_FIELDS.primary;
    return [playerColumn, ...statColumns.filter(isPrimary), ...statColumns.filter((column) => !isPrimary(column))];
}

export function LeaderboardGrid({ data, source, selections, title, subtitle }: Omit<SharedVisualProps, "params">): ReactElement {
    const { theme } = useThemeContext();
    const columns = useMemo(() => buildLeaderboardColumns(data), [data]);
    return (
        // On narrow screens the grid keeps readable stat columns and scrolls sideways
        // instead of squeezing every column into the viewport.
        <div className="flex min-w-0 flex-col gap-1 overflow-x-auto">
            <DataGrid
                containerRootClassName="min-w-4xl"
                data={data}
                columns={columns}
                theme={theme}
                header={{ title, subtitle }}
                defaultSort={[{ columnId: LEADERBOARD_FIELDS.primary, direction: "desc" }]}
                pageSize={25}
                selections={selections}
                selectableFields={source.selectableFields}
                onInteraction={source.onInteraction}
            />
            <SourceError error={source.error} />
        </div>
    );
}
