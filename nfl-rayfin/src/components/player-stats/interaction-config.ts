import type { InteractionConfiguration } from "@microsoft/fabric-interaction-manager";
import { LEADERBOARD_FIELDS } from "@/queries/player-stats";

/** Item id of the "NFL Play by Play Model" semantic model behind the `nflmodel` connector. */
const SEMANTIC_MODEL_ID = "a920a06d-b1a1-4391-98d7-f41556b0df05";

export const INTERACTION_IDS = {
    leadersChart: "leadersChart",
    efficiencyScatter: "efficiencyScatter",
    leaderboardGrid: "leaderboardGrid",
    kpis: "kpis",
} as const;

/** The player-selection sources, in the order their selections are checked. */
export const PLAYER_SOURCE_IDS = [
    INTERACTION_IDS.leadersChart,
    INTERACTION_IDS.efficiencyScatter,
    INTERACTION_IDS.leaderboardGrid,
] as const;

/**
 * The chart, scatter, and grid render one shared leaderboard result, so they publish
 * player selections but do not re-query on each other's clicks (`receivesInteractionsByDefault:
 * false`); the page mirrors the active selection across them instead. The KPI strip is a
 * target only: a selected player re-evaluates its measures under that player's filter.
 */
export const interactionConfiguration: InteractionConfiguration = {
    semanticModelId: SEMANTIC_MODEL_ID,
    fields: {
        [LEADERBOARD_FIELDS.playerKey]: { table: "Player", column: "player_key", dataType: "string" },
    },
    components: {
        [INTERACTION_IDS.leadersChart]: {
            kind: "visual",
            selectableFields: [LEADERBOARD_FIELDS.playerKey],
            canHighlight: false,
            receivesInteractionsByDefault: false,
        },
        [INTERACTION_IDS.efficiencyScatter]: {
            kind: "visual",
            selectableFields: [LEADERBOARD_FIELDS.playerKey],
            canHighlight: false,
            receivesInteractionsByDefault: false,
        },
        [INTERACTION_IDS.leaderboardGrid]: {
            kind: "grid",
            selectableFields: [LEADERBOARD_FIELDS.playerKey],
            receivesInteractionsByDefault: false,
        },
        [INTERACTION_IDS.kpis]: {
            kind: "visual",
            selectableFields: [],
            canHighlight: false,
        },
    },
};
