import { describe, expect, it } from "vitest";
import { applySeasonFilter, isSeasonType } from "./season-filter";

const template = `TREATAS ( { ( "__SEASON__", "__SEASON_TYPE__" ) }, 'Player Season Summary'[season], 'Player Season Summary'[season_type] )`;

describe("applySeasonFilter", () => {
    it("substitutes a validated season and season type", () => {
        expect(applySeasonFilter(template, { season: "2025", seasonType: "POST" })).toBe(
            `TREATAS ( { ( "2025", "POST" ) }, 'Player Season Summary'[season], 'Player Season Summary'[season_type] )`,
        );
    });

    it("rejects a season that is not a four-digit year", () => {
        expect(() => applySeasonFilter(template, { season: `2025" ) }`, seasonType: "REG" })).toThrow(/Invalid season/);
    });

    it("rejects an unknown season type", () => {
        expect(() => applySeasonFilter(template, { season: "2025", seasonType: "PRE" as never })).toThrow(/Invalid season type/);
    });

    it("replaces every placeholder pair, one per filtered fact table", () => {
        const twoTables = `${template}\n${template.replaceAll("Player Season Summary", "Team Play")}`;
        const result = applySeasonFilter(twoTables, { season: "2024", seasonType: "REG" });
        expect(result).not.toContain("__SEASON");
        expect(result.match(/\{ \( "2024", "REG" \) \}/g)).toHaveLength(2);
    });

    it("requires at least one placeholder pair, with matching counts", () => {
        expect(() => applySeasonFilter("EVALUATE {1}", { season: "2025", seasonType: "REG" })).toThrow(/placeholder/);
        expect(() => applySeasonFilter(`${template} "__SEASON__"`, { season: "2025", seasonType: "REG" })).toThrow(/placeholder/);
    });
});

describe("isSeasonType", () => {
    it("accepts only REG and POST", () => {
        expect(isSeasonType("REG")).toBe(true);
        expect(isSeasonType("POST")).toBe(true);
        expect(isSeasonType("PRE")).toBe(false);
        expect(isSeasonType(undefined)).toBe(false);
    });
});
