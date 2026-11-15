import type { VisualizationSpec } from "@microsoft/fabric-visuals";
import { leaderboard, type LeaderboardParams, type LeaderboardQuery } from "./leaderboard";
import efficiencyScatterSpec from "./efficiency-scatter.json";

/**
 * Volume-vs-efficiency scatter. It plots the leaderboard result, so it shares that
 * factory's query and column metadata and only swaps the spec.
 */
export function efficiencyScatter(params: LeaderboardParams): LeaderboardQuery {
    return {
        ...leaderboard(params),
        vegaLiteSpec: efficiencyScatterSpec as VisualizationSpec,
    };
}
