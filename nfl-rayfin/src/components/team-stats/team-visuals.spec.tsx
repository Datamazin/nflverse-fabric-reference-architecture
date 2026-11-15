import { describe, expect, it } from "vitest";
import type { DataTable } from "@microsoft/fabric-visuals-core";
import { TEAM_FIELDS } from "@/queries/team-stats";
import { buildTeamGridColumns } from "./team-visuals";

const body: DataTable = {
    columns: [
        { name: TEAM_FIELDS.teamKey }, { name: TEAM_FIELDS.team, displayName: "Team" }, { name: TEAM_FIELDS.teamCode },
        { name: TEAM_FIELDS.logo }, { name: TEAM_FIELDS.conference }, { name: TEAM_FIELDS.division },
        { name: "Penalties", displayName: "Penalties", format: "0" },
        { name: TEAM_FIELDS.primary, displayName: "Penalties/G", format: "0.0" },
    ],
    rows: [["LA", "Los Angeles Rams", "LA", "https://a.espncdn.com/i/teamlogos/nfl/500/lar.png", "NFC", "NFC West", 75, 4.41]],
};

describe("buildTeamGridColumns", () => {
    it("leads with the Team cell and the ranked stat, hiding identity columns", () => {
        const columns = buildTeamGridColumns(body);
        expect(columns.map((c) => c.id)).toEqual([TEAM_FIELDS.team, TEAM_FIELDS.primary, "Penalties"]);
        expect(columns[1]).toMatchObject({ header: "Penalties/G", numericStyling: true });
    });
});
