import { describe, expect, it } from "vitest";
import { teamQuadrant } from "./team-quadrant";
import { teamDivisions } from "./team-divisions";

describe("teamQuadrant", () => {
    it("binds the season and inserts slicer filters", () => {
        const filter = `TREATAS({"NFC"}, 'Team'[Team Conference])`;
        const { query, columnMetadata } = teamQuadrant({ season: "2024", seasonType: "POST", interactionFilters: [filter] });
        expect(query).toContain(`{ ( "2024", "POST" ) }`);
        expect(query).toContain(`_TSS,\n    ${filter},\n    "Off EPA per Play"`);
        expect(columnMetadata["[Off EPA per Play]"]).toMatchObject({ name: "OffEpa", format: "0.00" });
        expect(columnMetadata["[Def EPA Saved per Play]"]).toMatchObject({ name: "DefEpaSaved", format: "0.00" });
    });

    it("negates defensive EPA in the query so better defenses plot higher without reversing the axis", () => {
        const { query, vegaLiteSpec } = teamQuadrant({ season: "2025", seasonType: "REG" });
        expect(query).toContain(`"Def EPA Saved per Play", - [Season Defensive EPA Allowed per Play]`);
        expect(JSON.stringify(vegaLiteSpec)).not.toContain(`"reverse"`);
    });
});

describe("teamDivisions", () => {
    it("names its columns after the slicer field ids", () => {
        const { query, columnMetadata } = teamDivisions({ season: "2025", seasonType: "REG" });
        expect(query).toContain(`{ ( "2025", "REG" ) }`);
        expect(columnMetadata["Team[Team Conference]"].name).toBe("Conference");
        expect(columnMetadata["Team[Team Division]"].name).toBe("Division");
    });
});
