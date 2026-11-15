import { describe, expect, it } from "vitest";
import { TEAM_FIELDS, TEAM_GROUP_DEFINITIONS, TEAM_VIEWS, TEAM_VIEW_DEFINITIONS } from "./team-views";
import { TEAM_FILTER_MARKER, rankingSpec, teamView } from "./team-view";

const season = { season: "2025", seasonType: "REG" } as const;

describe("teamView", () => {
    it.each(TEAM_VIEWS)("binds the %s query's season filter on every fact table", (view) => {
        const { query, connection } = teamView({ view, ...season });
        expect(connection).toBe("nflmodel");
        expect(query).not.toContain("__SEASON");
        expect(query).not.toContain(TEAM_FILTER_MARKER);
        expect((query.match(/\{ \( "2025", "REG" \) \}/g) ?? []).length).toBeGreaterThanOrEqual(1);
        expect(query).toContain("ROLLUPADDISSUBTOTAL");
    });

    it.each(TEAM_VIEWS)("maps %s columns to Vega-safe names with a Primary stat and every KPI", (view) => {
        const { columnMetadata } = teamView({ view, ...season });
        const names = Object.values(columnMetadata).map((c) => c.name);
        for (const name of names) expect(name).not.toMatch(/[[\].]/);
        expect(names).toEqual(expect.arrayContaining(Object.values(TEAM_FIELDS)));
        expect(names).toEqual(expect.arrayContaining([...TEAM_VIEW_DEFINITIONS[view].kpis]));
        expect(columnMetadata["[IsGrandTotal]"]?.name).toBe(TEAM_FIELDS.isGrandTotal);
    });

    it("inserts slicer filters before the measures, after the season filters", () => {
        const filter = `TREATAS({"AFC North"}, 'Team'[Team Division])`;
        const { query } = teamView({ view: "penalties", ...season, interactionFilters: [filter] });
        expect(query).toContain(`_TSS,\n    ${filter},\n    "Penalties"`);
    });

    it("applies model format strings and documented fallbacks", () => {
        const passing = teamView({ view: "passing", ...season }).columnMetadata;
        expect(passing["[Pass Yds]"]?.format).toBe("#,0");
        expect(passing["[Cmp Pct]"]?.format).toBe("0.0%");
        const scoring = teamView({ view: "scoring", ...season }).columnMetadata;
        expect(scoring["[Off EPA per Play]"]?.format).toBe("0.00");
        expect(scoring["[Third Down Pct]"]?.format).toBe("0.0%");
    });

    it("derives yards allowed and team penalties as documented local measures", () => {
        expect(teamView({ view: "yardsAllowed", ...season }).query).toContain(`'Team Play'[unit] = "Defense"`);
        expect(teamView({ view: "penalties", ...season }).query).toContain(`TREATAS ( VALUES ( 'Team'[team_key] ), 'Penalty'[penalty_team_key] )`);
    });

    it("orders the ranking best-first: descending when higher is better, ascending otherwise", () => {
        expect((teamView({ view: "passing", ...season }).vegaLiteSpec as { encoding: { y: { sort: string } } }).encoding.y.sort).toBe("-x");
        expect((teamView({ view: "penalties", ...season }).vegaLiteSpec as { encoding: { y: { sort: string } } }).encoding.y.sort).toBe("x");
        // The shared spec is cloned, not mutated.
        expect((rankingSpec(true) as { encoding: { y: { sort: string } } }).encoding.y.sort).toBe("-x");
    });

    it("rejects an unknown view", () => {
        expect(() => teamView({ view: "punting" as never, ...season })).toThrow(/Unknown team view/);
    });

    it("assigns every view to exactly one group", () => {
        const grouped = Object.values(TEAM_GROUP_DEFINITIONS).flatMap((g) => g.views);
        expect([...grouped].sort()).toEqual([...TEAM_VIEWS].sort());
    });
});
