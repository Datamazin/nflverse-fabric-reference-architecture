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

    it("requires exactly one placeholder of each kind", () => {
        expect(() => applySeasonFilter("EVALUATE {1}", { season: "2025", seasonType: "REG" })).toThrow(/placeholder/);
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
