import { describe, expect, it } from "vitest";
import type { DataTable, SemanticSelection } from "@microsoft/fabric-visuals-core";
import type { QueryTable } from "@microsoft/rayfin-connector-fabric-semanticmodel";
import { splitRollupDataTable, toDataTable } from "@/lib/to-data-table";
import { TEAM_FIELDS, teamView } from "@/queries/team-stats";
import { cellValue, findTeamRow, labelTotalRow, selectedValues, toTeamKpis } from "./team-stats-helpers";

// Column names and values follow the live `run-dax-query` output for the field goals view.
const factory = teamView({ view: "fieldGoals", season: "2025", seasonType: "REG" });
const table: DataTable = toDataTable(
    {
        columns: [
            "Team[team_key]", "Team[Team Name]", "Team[Team Code]", "Team[team_logo_espn]",
            "Team[Team Conference]", "Team[Team Division]", "[IsGrandTotal]", "[FGM]", "[FGA]", "[FG Pct]",
        ].map((name) => ({ name, dataType: "unknown" })),
        rows: [
            [null, null, null, null, null, null, true, 931, 1088, 0.8557],
            ["HOU", "Houston Texans", "HOU", "https://a.espncdn.com/i/teamlogos/nfl/500/hou.png", "AFC", "AFC South", false, 48, 52, 0.9231],
            ["SEA", "Seattle Seahawks", "SEA", "https://a.espncdn.com/i/teamlogos/nfl/500/sea.png", "NFC", "NFC West", false, 41, 48, 0.8542],
        ],
    } as unknown as QueryTable,
    factory.columnMetadata,
);
const { bodyTable, grandTotalTable } = splitRollupDataTable(table, { rollupFlagColumns: [TEAM_FIELDS.isGrandTotal] });

describe("selectedValues", () => {
    it("returns selected raw values for a field, ignoring blanks and excluded predicates", () => {
        const selections: SemanticSelection[] = [{
            predicates: [
                { type: "set", fieldId: TEAM_FIELDS.teamKey, values: [{ kind: "value", value: "SEA" }, { kind: "blank" }] },
                { type: "set", fieldId: TEAM_FIELDS.teamKey, values: [{ kind: "value", value: "HOU" }], excluded: true },
                { type: "set", fieldId: TEAM_FIELDS.division, values: [{ kind: "value", value: "NFC West" }] },
            ],
        }];
        expect(selectedValues(selections, TEAM_FIELDS.teamKey)).toEqual(["SEA"]);
        expect(selectedValues([], TEAM_FIELDS.teamKey)).toEqual([]);
    });
});

describe("findTeamRow and cellValue", () => {
    it("finds the selected team's row in the body", () => {
        const row = findTeamRow(bodyTable, "SEA");
        expect(cellValue(bodyTable, row, TEAM_FIELDS.team)).toBe("Seattle Seahawks");
        expect(findTeamRow(bodyTable, "KC")).toBeUndefined();
        expect(findTeamRow(bodyTable, undefined)).toBeUndefined();
    });
});

describe("toTeamKpis", () => {
    it("reads the view's KPI columns with their model formats from the total row", () => {
        expect(toTeamKpis(grandTotalTable, grandTotalTable.rows[0], ["Primary", "Fga", "FgPct"])).toEqual([
            { name: "Primary", title: "FGM", value: 931, format: "0" },
            { name: "Fga", title: "FGA", value: 1088, format: "0" },
            { name: "FgPct", title: "FG %", value: 0.8557, format: "0.0%" },
        ]);
    });

    it("keeps null as null (an em dash) and skips unknown columns", () => {
        const kpis = toTeamKpis(bodyTable, undefined, ["Primary", "Missing"]);
        expect(kpis).toEqual([{ name: "Primary", title: "FGM", value: null, format: "0" }]);
    });
});

describe("labelTotalRow", () => {
    it("puts the label in the Team cell of the total row only", () => {
        const labelled = labelTotalRow(grandTotalTable, "All teams");
        expect(cellValue(labelled, labelled.rows[0], TEAM_FIELDS.team)).toBe("All teams");
        expect(cellValue(labelled, labelled.rows[0], "Primary")).toBe(931);
        expect(grandTotalTable.rows[0]).not.toContain("All teams");
    });
});
