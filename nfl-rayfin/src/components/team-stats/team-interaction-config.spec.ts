import { describe, expect, it } from "vitest";
import { TEAM_INTERACTION_IDS, TEAM_SOURCE_IDS, teamInteractionConfiguration } from "./team-interaction-config";

describe("teamInteractionConfiguration", () => {
    it("never re-queries the data loads on team clicks", () => {
        const rules = teamInteractionConfiguration.rules ?? [];
        for (const sourceId of TEAM_SOURCE_IDS) {
            for (const targetId of [TEAM_INTERACTION_IDS.viewData, TEAM_INTERACTION_IDS.quadrantData]) {
                expect(rules).toContainEqual({ sourceId, targetId, targetEffect: "none" });
            }
        }
    });

    it("lets the slicers filter the data loads (no overriding rule)", () => {
        const rules = teamInteractionConfiguration.rules ?? [];
        expect(rules.some((r) => r.sourceId === TEAM_INTERACTION_IDS.conferenceSlicer || r.sourceId === TEAM_INTERACTION_IDS.divisionSlicer)).toBe(false);
        expect(teamInteractionConfiguration.components[TEAM_INTERACTION_IDS.conferenceSlicer]).toMatchObject({ kind: "slicer", selectableFields: ["Conference"] });
    });

    it("maps every field to a Team column", () => {
        expect(teamInteractionConfiguration.fields).toEqual({
            TeamKey: { table: "Team", column: "team_key", dataType: "string" },
            Conference: { table: "Team", column: "Team Conference", dataType: "string" },
            Division: { table: "Team", column: "Team Division", dataType: "string" },
        });
    });
});
