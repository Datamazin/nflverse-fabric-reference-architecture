import { describe, expect, it } from "vitest";
import { efficiencyScatter } from "./efficiency-scatter";
import { kpiSummary } from "./kpi";
import { leaderboard } from "./leaderboard";
import { seasons } from "./seasons";
import { LEADERBOARD_FIELDS, STAT_CATEGORIES, statCategories } from "./stat-categories";

const season = { season: "2025", seasonType: "REG" } as const;

describe("leaderboard", () => {
    it.each(STAT_CATEGORIES)("binds the %s query to the season and the shared connector", (category) => {
        const factory = leaderboard({ category, ...season });
        expect(factory.connection).toBe("nflmodel");
        expect(factory.query).toContain(`{ ( "2025", "REG" ) }`);
        expect(factory.query).not.toContain("__SEASON");
        expect(factory.query).toMatch(/TOPN \( 50,/);
    });

    it.each(STAT_CATEGORIES)("maps %s identity, Primary, and Efficiency columns to Vega-safe names", (category) => {
        const { columnMetadata } = leaderboard({ category, ...season });
        const names = Object.values(columnMetadata).map((c) => c.name);
        expect(names).toEqual(expect.arrayContaining(Object.values(LEADERBOARD_FIELDS)));
        for (const name of names) expect(name).not.toMatch(/[[\].]/);
        expect(columnMetadata["Player[Position]"]?.name).toBe(LEADERBOARD_FIELDS.position);
    });

    it("applies the semantic model's format strings", () => {
        const { columnMetadata } = leaderboard({ category: "passing", ...season });
        expect(columnMetadata["[Yds]"]?.format).toBe("#,0");
        expect(columnMetadata["[Cmp Pct]"]?.format).toBe("0.0%");
        expect(columnMetadata["[EPA per DB]"]?.format).toBe("0.00");
        expect(leaderboard({ category: "defense", ...season }).columnMetadata["[Sck]"]?.format).toBe("#,0.0");
    });

    it("selects the category's structural query variant", () => {
        expect(leaderboard({ category: "kicking", ...season }).query).toContain("[Field Goals Made]");
        expect(leaderboard({ category: "receiving", ...season }).query).toContain("[Receiving Yards]");
    });

    it("rejects an unknown category", () => {
        expect(() => leaderboard({ category: "special" as never, ...season })).toThrow(/Unknown stat category/);
    });
});

describe("efficiencyScatter", () => {
    it("reuses the leaderboard query and metadata with its own spec", () => {
        const bar = leaderboard({ category: "rushing", ...season });
        const scatter = efficiencyScatter({ category: "rushing", ...season });
        expect(scatter.query).toBe(bar.query);
        expect(scatter.columnMetadata).toEqual(bar.columnMetadata);
        expect(scatter.vegaLiteSpec).not.toBe(bar.vegaLiteSpec);
        expect(JSON.stringify(scatter.vegaLiteSpec)).toContain(`"mark":"circle"`);
    });
});

describe("kpiSummary", () => {
    it("removes the filter marker when there are no interaction filters", () => {
        const { query } = kpiSummary({ category: "passing", ...season });
        expect(query).not.toContain("__FILTER_ARGUMENTS__");
        expect(query).toMatch(/_Season\s*\)\s*$/);
    });

    it("inserts interaction filters after the season filter", () => {
        const filter = `TREATAS({"00-0026498"}, 'Player'[player_key])`;
        const { query } = kpiSummary({ category: "passing", ...season, interactionFilters: [filter] });
        expect(query).toContain(`_Season,\n    ${filter}`);
    });

    it("uses each category's KPI columns and formats", () => {
        expect(Object.keys(kpiSummary({ category: "defense", ...season }).columnMetadata)).toEqual(["[Sck]", "[QB Hits]"]);
        expect(kpiSummary({ category: "kicking", ...season }).columnMetadata["[FG Pct]"]?.format).toBe("0.0%");
    });

    it("keeps one definition per category", () => {
        expect(Object.keys(statCategories)).toEqual([...STAT_CATEGORIES]);
    });
});

describe("seasons", () => {
    it("lists season and season type pairs", () => {
        expect(seasons.query).toContain("SUMMARIZE");
        expect(Object.values(seasons.columnMetadata).map((c) => c.name)).toEqual(["Season", "SeasonType"]);
    });
});
