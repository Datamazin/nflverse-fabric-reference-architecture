import type { DataTable, SemanticSelection } from "@microsoft/fabric-visuals-core";
import { TEAM_FIELDS } from "@/queries/team-stats";

type Row = DataTable["rows"][number];

/** Raw values selected for a field across a source's selections (excluded and blank values ignored). */
export function selectedValues(selections: readonly SemanticSelection[], fieldId: string): unknown[] {
    const values: unknown[] = [];
    for (const selection of selections) {
        for (const predicate of selection.predicates) {
            if (predicate.type !== "set" || predicate.fieldId !== fieldId || predicate.excluded) continue;
            for (const value of predicate.values) {
                if (value.kind === "value") values.push(value.value);
            }
        }
    }
    return values;
}

function columnIndex(table: DataTable, name: string): number {
    return table.columns.findIndex((column) => column.name === name);
}

/** The body row for the selected team, if it is in the loaded (possibly slicer-filtered) result. */
export function findTeamRow(body: DataTable, teamKey: unknown): Row | undefined {
    if (teamKey === undefined) return undefined;
    const keyIndex = columnIndex(body, TEAM_FIELDS.teamKey);
    return body.rows.find((row) => row[keyIndex] === teamKey);
}

export function cellValue(table: DataTable, row: Row | undefined, name: string): unknown {
    const index = columnIndex(table, name);
    return row && index >= 0 ? row[index] : undefined;
}

export interface TeamKpi {
    name: string;
    title: string;
    value: number | string | null;
    format: string | undefined;
}

/** KPI values for the view's KPI columns from one row (a team or the total), keeping nulls as nulls. */
export function toTeamKpis(table: DataTable, row: Row | undefined, kpiNames: readonly string[]): TeamKpi[] {
    return kpiNames.flatMap((name) => {
        const index = columnIndex(table, name);
        if (index < 0) return [];
        const column = table.columns[index];
        const raw = row?.[index];
        const value = typeof raw === "number" || typeof raw === "string" ? raw : null;
        return [{ name, title: column.displayName ?? name, value, format: column.format }];
    });
}

/** The grand-total table with its Team cell set to a label, which DataGrid shows in place of "Total". */
export function labelTotalRow(total: DataTable, label: string): DataTable {
    const teamIndex = columnIndex(total, TEAM_FIELDS.team);
    if (teamIndex < 0) return total;
    return {
        columns: total.columns,
        rows: total.rows.map((row) => row.map((cell, index) => (index === teamIndex ? label : cell))),
    };
}
