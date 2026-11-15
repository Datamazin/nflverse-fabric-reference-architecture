import type { InteractionConfiguration, InteractionRule } from "@microsoft/fabric-interaction-manager";
import { TEAM_FIELDS } from "@/queries/team-stats";

/** Item id of the "NFL Play by Play Model" semantic model behind the `nflmodel` connector. */
const SEMANTIC_MODEL_ID = "a920a06d-b1a1-4391-98d7-f41556b0df05";

export const TEAM_INTERACTION_IDS = {
    ranking: "teamRanking",
    quadrant: "teamQuadrant",
    grid: "teamGrid",
    conferenceSlicer: "conferenceSlicer",
    divisionSlicer: "divisionSlicer",
    viewData: "teamViewData",
    quadrantData: "teamQuadrantData",
} as const;

/** Team-selection sources, in the order their selections are checked. */
export const TEAM_SOURCE_IDS = [
    TEAM_INTERACTION_IDS.ranking,
    TEAM_INTERACTION_IDS.quadrant,
    TEAM_INTERACTION_IDS.grid,
] as const;

const DATA_TARGET_IDS = [TEAM_INTERACTION_IDS.viewData, TEAM_INTERACTION_IDS.quadrantData] as const;

/**
 * Team selections never re-query the data: the KPI cards read the selected team's row from the
 * loaded result, and the page mirrors the selection across the ranking, quadrant, and grid.
 */
const noRequeryOnTeamSelection: InteractionRule[] = TEAM_SOURCE_IDS.flatMap((sourceId) =>
    DATA_TARGET_IDS.map((targetId) => ({ sourceId, targetId, targetEffect: "none" as const })),
);

/**
 * Two kinds of interaction on the Teams page:
 * - Conference and division slicers filter the two data loads (view and quadrant), which
 *   re-evaluate every measure and the league-total row for the chosen teams.
 * - Clicking a team in the ranking, quadrant, or grid selects it without re-querying.
 */
export const teamInteractionConfiguration: InteractionConfiguration = {
    semanticModelId: SEMANTIC_MODEL_ID,
    fields: {
        [TEAM_FIELDS.teamKey]: { table: "Team", column: "team_key", dataType: "string" },
        [TEAM_FIELDS.conference]: { table: "Team", column: "Team Conference", dataType: "string" },
        [TEAM_FIELDS.division]: { table: "Team", column: "Team Division", dataType: "string" },
    },
    components: {
        [TEAM_INTERACTION_IDS.ranking]: {
            kind: "visual",
            selectableFields: [TEAM_FIELDS.teamKey],
            canHighlight: false,
            receivesInteractionsByDefault: false,
        },
        [TEAM_INTERACTION_IDS.quadrant]: {
            kind: "visual",
            selectableFields: [TEAM_FIELDS.teamKey],
            canHighlight: false,
            receivesInteractionsByDefault: false,
        },
        [TEAM_INTERACTION_IDS.grid]: {
            kind: "grid",
            selectableFields: [TEAM_FIELDS.teamKey],
            receivesInteractionsByDefault: false,
        },
        [TEAM_INTERACTION_IDS.conferenceSlicer]: { kind: "slicer", selectableFields: [TEAM_FIELDS.conference] },
        [TEAM_INTERACTION_IDS.divisionSlicer]: { kind: "slicer", selectableFields: [TEAM_FIELDS.division] },
        [TEAM_INTERACTION_IDS.viewData]: { kind: "visual", selectableFields: [], canHighlight: false },
        [TEAM_INTERACTION_IDS.quadrantData]: { kind: "visual", selectableFields: [], canHighlight: false },
    },
    rules: noRequeryOnTeamSelection,
};
