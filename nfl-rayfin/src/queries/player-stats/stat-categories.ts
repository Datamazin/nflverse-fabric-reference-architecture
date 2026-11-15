import type { ColumnMetadataMap } from "@/lib/to-data-table";

import leaderboardPassing from "./leaderboard-passing.dax?raw";
import leaderboardRushing from "./leaderboard-rushing.dax?raw";
import leaderboardReceiving from "./leaderboard-receiving.dax?raw";
import leaderboardDefense from "./leaderboard-defense.dax?raw";
import leaderboardKicking from "./leaderboard-kicking.dax?raw";
import kpiPassing from "./kpi-passing.dax?raw";
import kpiRushing from "./kpi-rushing.dax?raw";
import kpiReceiving from "./kpi-receiving.dax?raw";
import kpiDefense from "./kpi-defense.dax?raw";
import kpiKicking from "./kpi-kicking.dax?raw";

export const STAT_CATEGORIES = ["passing", "rushing", "receiving", "defense", "kicking"] as const;
export type StatCategory = (typeof STAT_CATEGORIES)[number];

export function isStatCategory(value: unknown): value is StatCategory {
    return typeof value === "string" && (STAT_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Bracket-free aliases shared by every leaderboard variant. `Primary` is the stat the
 * leaderboard ranks by and `Efficiency` is the per-play rate the scatter plots against it,
 * so the bar and scatter specs work unchanged for every category.
 */
export const LEADERBOARD_FIELDS = {
    playerKey: "PlayerKey",
    player: "Player",
    position: "Position",
    headshot: "Headshot",
    team: "Team",
    primary: "Primary",
    efficiency: "Efficiency",
} as const;

/** Identity columns returned by every leaderboard query, keyed by exact output name. */
const playerColumns: ColumnMetadataMap = {
    "Player[player_key]": { name: LEADERBOARD_FIELDS.playerKey, displayName: "Player ID" },
    "Player[Full Name]": { name: LEADERBOARD_FIELDS.player, displayName: "Player", semanticType: "Name" },
    "Player[Position]": { name: LEADERBOARD_FIELDS.position, displayName: "Pos" },
    "Player[headshot_url]": { name: LEADERBOARD_FIELDS.headshot, displayName: "Headshot" },
    "[Team]": { name: LEADERBOARD_FIELDS.team, displayName: "Team" },
};

export interface StatCategoryDefinition {
    label: string;
    /** Display name of the ranked stat, for chart titles. */
    primaryLabel: string;
    /** Display name of the efficiency stat, for chart titles. */
    efficiencyLabel: string;
    leaderboardQuery: string;
    /** Stat columns of the leaderboard query (identity columns are added automatically). */
    leaderboardStats: ColumnMetadataMap;
    kpiQuery: string;
    kpiColumns: ColumnMetadataMap;
}

/*
 * Formats are the semantic model's `FormatStringDefinition` for each measure. The only
 * exceptions are the per-attempt / per-reception yard averages, which the model does not
 * ship as measures; they are DIVIDE()s of shipped measures and use "0.0".
 */
export const statCategories: Record<StatCategory, StatCategoryDefinition> = {
    passing: {
        label: "Passing",
        primaryLabel: "Passing Yards",
        efficiencyLabel: "EPA per Dropback",
        leaderboardQuery: leaderboardPassing,
        leaderboardStats: {
            "[Yds]": { name: LEADERBOARD_FIELDS.primary, displayName: "Pass Yds", format: "#,0" },
            "[Att]": { name: "Att", displayName: "Att", format: "0" },
            "[Cmp]": { name: "Cmp", displayName: "Cmp", format: "0" },
            "[Cmp Pct]": { name: "CmpPct", displayName: "Cmp %", format: "0.0%" },
            "[Yds per Att]": { name: "YdsPerAtt", displayName: "Yds/Att", format: "0.0" },
            "[TD]": { name: "TD", displayName: "TD", format: "0" },
            "[INT]": { name: "Int", displayName: "INT", format: "0" },
            "[TD INT Ratio]": { name: "TdIntRatio", displayName: "TD:INT", format: "0.00" },
            "[Sck]": { name: "Sck", displayName: "Sck", format: "0" },
            "[EPA per DB]": { name: LEADERBOARD_FIELDS.efficiency, displayName: "EPA/DB", format: "0.00" },
            "[CPOE]": { name: "Cpoe", displayName: "CPOE", format: "0.00" },
        },
        kpiQuery: kpiPassing,
        kpiColumns: {
            "[Yds]": { name: "Yds", displayName: "Passing Yards", format: "#,0" },
            "[TD]": { name: "TD", displayName: "Passing TDs", format: "0" },
            "[Cmp Pct]": { name: "CmpPct", displayName: "Completion %", format: "0.0%" },
            "[EPA per DB]": { name: "EpaPerDb", displayName: "EPA per Dropback", format: "0.00" },
        },
    },
    rushing: {
        label: "Rushing",
        primaryLabel: "Rushing Yards",
        efficiencyLabel: "EPA per Rush",
        leaderboardQuery: leaderboardRushing,
        leaderboardStats: {
            "[Yds]": { name: LEADERBOARD_FIELDS.primary, displayName: "Rush Yds", format: "#,0" },
            "[Att]": { name: "Att", displayName: "Att", format: "0" },
            "[Yds per Att]": { name: "YdsPerAtt", displayName: "Yds/Att", format: "0.0" },
            "[TD]": { name: "TD", displayName: "TD", format: "0" },
            "[Explosive]": { name: "Explosive", displayName: "Explosive", format: "0" },
            "[Explosive Pct]": { name: "ExplosivePct", displayName: "Explosive %", format: "0.0%" },
            "[Stuff Pct]": { name: "StuffPct", displayName: "Stuff %", format: "0.0%" },
            "[Conv Pct]": { name: "ConvPct", displayName: "Conv %", format: "0.0%" },
            "[EPA per Rush]": { name: LEADERBOARD_FIELDS.efficiency, displayName: "EPA/Rush", format: "0.00" },
        },
        kpiQuery: kpiRushing,
        kpiColumns: {
            "[Yds]": { name: "Yds", displayName: "Rushing Yards", format: "#,0" },
            "[TD]": { name: "TD", displayName: "Rushing TDs", format: "0" },
            "[Explosive Pct]": { name: "ExplosivePct", displayName: "Explosive Rush %", format: "0.0%" },
            "[EPA per Rush]": { name: "EpaPerRush", displayName: "EPA per Rush", format: "0.00" },
        },
    },
    receiving: {
        label: "Receiving",
        primaryLabel: "Receiving Yards",
        efficiencyLabel: "EPA per Target",
        leaderboardQuery: leaderboardReceiving,
        leaderboardStats: {
            "[Yds]": { name: LEADERBOARD_FIELDS.primary, displayName: "Rec Yds", format: "#,0" },
            "[Tgt]": { name: "Tgt", displayName: "Tgt", format: "0" },
            "[Rec]": { name: "Rec", displayName: "Rec", format: "0" },
            "[Catch Pct]": { name: "CatchPct", displayName: "Catch %", format: "0.0%" },
            "[Yds per Rec]": { name: "YdsPerRec", displayName: "Yds/Rec", format: "0.0" },
            "[YAC]": { name: "Yac", displayName: "YAC", format: "#,0" },
            "[YAC per Rec]": { name: "YacPerRec", displayName: "YAC/Rec", format: "0.00" },
            "[EPA per Tgt]": { name: LEADERBOARD_FIELDS.efficiency, displayName: "EPA/Tgt", format: "0.00" },
        },
        kpiQuery: kpiReceiving,
        kpiColumns: {
            "[Yds]": { name: "Yds", displayName: "Receiving Yards", format: "#,0" },
            "[Rec]": { name: "Rec", displayName: "Receptions", format: "0" },
            "[Catch Pct]": { name: "CatchPct", displayName: "Catch Rate", format: "0.0%" },
            "[EPA per Tgt]": { name: "EpaPerTgt", displayName: "EPA per Target", format: "0.00" },
        },
    },
    defense: {
        label: "Defense",
        primaryLabel: "Sacks",
        efficiencyLabel: "QB Hits",
        leaderboardQuery: leaderboardDefense,
        leaderboardStats: {
            "[Sck]": { name: LEADERBOARD_FIELDS.primary, displayName: "Sacks", format: "#,0.0" },
            "[QB Hits]": { name: LEADERBOARD_FIELDS.efficiency, displayName: "QB Hits", format: "#,0" },
        },
        kpiQuery: kpiDefense,
        kpiColumns: {
            "[Sck]": { name: "Sck", displayName: "Defensive Sacks", format: "#,0.0" },
            "[QB Hits]": { name: "QbHits", displayName: "Defensive QB Hits", format: "#,0" },
        },
    },
    kicking: {
        label: "Kicking",
        primaryLabel: "Field Goals Made",
        efficiencyLabel: "FG %",
        leaderboardQuery: leaderboardKicking,
        leaderboardStats: {
            "[FGM]": { name: LEADERBOARD_FIELDS.primary, displayName: "FGM", format: "0" },
            "[FGA]": { name: "Fga", displayName: "FGA", format: "0" },
            "[FG Pct]": { name: LEADERBOARD_FIELDS.efficiency, displayName: "FG %", format: "0.0%" },
        },
        kpiQuery: kpiKicking,
        kpiColumns: {
            "[FGM]": { name: "Fgm", displayName: "Field Goals Made", format: "0" },
            "[FGA]": { name: "Fga", displayName: "Field Goal Attempts", format: "0" },
            "[FG Pct]": { name: "FgPct", displayName: "Field Goal %", format: "0.0%" },
        },
    },
};

export function getStatCategory(category: StatCategory): StatCategoryDefinition {
    if (!isStatCategory(category)) {
        throw new Error(`Unknown stat category "${String(category)}".`);
    }
    return statCategories[category];
}

export function leaderboardColumnMetadata(category: StatCategory): ColumnMetadataMap {
    return { ...playerColumns, ...getStatCategory(category).leaderboardStats };
}
