import { describe, expect, it } from "vitest";
import type { DataTable, SemanticSelection } from "@microsoft/fabric-visuals-core";
import type { QueryTable } from "@microsoft/rayfin-connector-fabric-semanticmodel";
import { LEADERBOARD_FIELDS, leaderboard, seasons } from "@/queries/player-stats";
import { toDataTable } from "@/lib/to-data-table";
import { selectedPlayerNames, toSeasonOptions } from "./player-stats-page";
import { toKpiMetrics } from "./kpi-strip";
import { buildLeaderboardColumns } from "./player-visuals";
import { errorCategoryOf } from "./query-states";

// Column names match the live `run-dax-query` output for each query.
function queryTable(columns: string[], rows: unknown[][]): QueryTable {
    return { columns: columns.map((name) => ({ name, dataType: "unknown" })), rows } as unknown as QueryTable;
}

const seasonsTable: DataTable = toDataTable(
    queryTable(
        ["Player Season Summary[season]", "Player Season Summary[season_type]"],
        [["2026", "REG"], ["2025", "REG"], ["2025", "POST"], ["2024", "REG"]],
    ),
    seasons.columnMetadata,
);

const passing = leaderboard({ category: "passing", season: "2025", seasonType: "REG" });
const leaderboardTable: DataTable = toDataTable(
    queryTable(
        [
            "Player[player_key]", "Player[Full Name]", "Player[Position]", "Player[headshot_url]", "[Team]",
            "[Yds]", "[Att]", "[Cmp]", "[Cmp Pct]", "[Yds per Att]", "[TD]", "[INT]", "[TD INT Ratio]", "[Sck]", "[EPA per DB]", "[CPOE]",
        ],
        [
            ["00-0026498", "Matthew Stafford", "QB", "https://static.www.nfl.com/a", "LA", 4707, 617, 388, 0.6288, 7.63, 46, 8, 5.75, 23, 0.229, 1.496],
            ["00-0033106", "Jared Goff", "QB", "https://static.www.nfl.com/b", "DET", 4564, 614, 393, 0.6401, 7.43, 34, 8, 4.25, 38, 0.174, 1.58],
        ],
    ),
    passing.columnMetadata,
);

describe("toSeasonOptions", () => {
    it("groups season types per season, newest first, REG before POST", () => {
        expect(toSeasonOptions(seasonsTable)).toEqual([
            { season: "2026", seasonTypes: ["REG"] },
            { season: "2025", seasonTypes: ["REG", "POST"] },
            { season: "2024", seasonTypes: ["REG"] },
        ]);
    });
});

describe("selectedPlayerNames", () => {
    it("resolves PlayerKey set predicates to player names", () => {
        const selections: SemanticSelection[] = [{
            predicates: [{ type: "set", fieldId: LEADERBOARD_FIELDS.playerKey, values: [{ kind: "value", value: "00-0033106" }] }],
        }];
        expect(selectedPlayerNames(selections, leaderboardTable)).toEqual(["Jared Goff"]);
    });

    it("returns nothing without a selection or table", () => {
        expect(selectedPlayerNames([], leaderboardTable)).toEqual([]);
        expect(selectedPlayerNames([{ predicates: [] }], null)).toEqual([]);
    });
});

describe("toKpiMetrics", () => {
    it("keeps model formats, real zeros, and nulls", () => {
        const table: DataTable = {
            columns: [
                { name: "Sck", displayName: "Defensive Sacks", format: "#,0.0" },
                { name: "QbHits", displayName: "Defensive QB Hits", format: "#,0" },
            ],
            rows: [[0, null]],
        };
        expect(toKpiMetrics(table)).toEqual([
            { name: "Sck", title: "Defensive Sacks", value: 0, format: "#,0.0" },
            { name: "QbHits", title: "Defensive QB Hits", value: null, format: "#,0" },
        ]);
    });

    it("returns no metrics for an empty result", () => {
        expect(toKpiMetrics({ columns: [{ name: "Sck" }], rows: [] })).toEqual([]);
    });
});

describe("buildLeaderboardColumns", () => {
    it("leads with the player cell and the ranked stat, hiding identity columns", () => {
        const ids = buildLeaderboardColumns(leaderboardTable).map((c) => c.id);
        expect(ids.slice(0, 2)).toEqual([LEADERBOARD_FIELDS.player, LEADERBOARD_FIELDS.primary]);
        expect(ids).not.toContain(LEADERBOARD_FIELDS.playerKey);
        expect(ids).not.toContain(LEADERBOARD_FIELDS.headshot);
        expect(ids).toContain(LEADERBOARD_FIELDS.efficiency);
    });
});

describe("errorCategoryOf", () => {
    it("reads the category from a query error or an Error cause", () => {
        expect(errorCategoryOf({ category: "network", message: "offline" })).toBe("network");
        expect(errorCategoryOf(new Error("x", { cause: { category: "query" } }))).toBe("query");
        expect(errorCategoryOf(new Error("x"))).toBe("unknown");
        expect(errorCategoryOf({ category: "bogus" })).toBe("unknown");
    });
});
