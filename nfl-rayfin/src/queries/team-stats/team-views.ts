import type { ColumnMetadataMap } from "@/lib/to-data-table";

import passing from "./team-view-passing.dax?raw";
import rushing from "./team-view-rushing.dax?raw";
import receiving from "./team-view-receiving.dax?raw";
import scoring from "./team-view-scoring.dax?raw";
import defenseOverview from "./team-view-defense-overview.dax?raw";
import yardsAllowed from "./team-view-yards-allowed.dax?raw";
import passRush from "./team-view-pass-rush.dax?raw";
import fieldGoals from "./team-view-field-goals.dax?raw";
import penalties from "./team-view-penalties.dax?raw";

export const TEAM_GROUPS = ["offense", "defense", "specialTeams", "penalties"] as const;
export type TeamGroup = (typeof TEAM_GROUPS)[number];

export const TEAM_VIEWS = [
    "passing", "rushing", "receiving", "scoring",
    "defenseOverview", "yardsAllowed", "passRush",
    "fieldGoals",
    "penalties",
] as const;
export type TeamView = (typeof TEAM_VIEWS)[number];

export function isTeamView(value: unknown): value is TeamView {
    return typeof value === "string" && (TEAM_VIEWS as readonly string[]).includes(value);
}

export const TEAM_GROUP_DEFINITIONS: Record<TeamGroup, { label: string; views: readonly TeamView[] }> = {
    offense: { label: "Offense", views: ["passing", "rushing", "receiving", "scoring"] },
    defense: { label: "Defense", views: ["defenseOverview", "yardsAllowed", "passRush"] },
    specialTeams: { label: "Special Teams", views: ["fieldGoals"] },
    penalties: { label: "Penalties", views: ["penalties"] },
};

/** Bracket-free aliases shared by every team view, so one ranking spec and grid layout serve all views. */
export const TEAM_FIELDS = {
    teamKey: "TeamKey",
    team: "Team",
    teamCode: "TeamCode",
    logo: "Logo",
    conference: "Conference",
    division: "Division",
    isGrandTotal: "IsGrandTotal",
    primary: "Primary",
} as const;

/** Identity and rollup-flag columns returned by every team view, keyed by exact output name. */
export const TEAM_IDENTITY_COLUMNS: ColumnMetadataMap = {
    "Team[team_key]": { name: TEAM_FIELDS.teamKey, displayName: "Team ID" },
    "Team[Team Name]": { name: TEAM_FIELDS.team, displayName: "Team", semanticType: "Name" },
    "Team[Team Code]": { name: TEAM_FIELDS.teamCode, displayName: "Team" },
    "Team[team_logo_espn]": { name: TEAM_FIELDS.logo, displayName: "Logo" },
    "Team[Team Conference]": { name: TEAM_FIELDS.conference, displayName: "Conference" },
    "Team[Team Division]": { name: TEAM_FIELDS.division, displayName: "Division" },
    "[IsGrandTotal]": { name: TEAM_FIELDS.isGrandTotal, displayName: "Grand total" },
};

export interface TeamViewDefinition {
    group: TeamGroup;
    label: string;
    /** Display name of the ranked stat, for titles. */
    primaryLabel: string;
    /** Whether a higher ranked stat is better; decides the ranking chart's order. */
    higherIsBetter: boolean;
    query: string;
    /** Stat columns, keyed by exact output name. The ranked stat's `name` is `Primary`. */
    stats: ColumnMetadataMap;
    /** Column `name`s shown as KPI cards, in order. */
    kpis: readonly string[];
    /** Optional note shown under the view, for derived or approximate stats. */
    note?: string;
}

/*
 * Formats come from each measure's `FormatStringDefinition` in the semantic model. Several team
 * measures ship without one (rates such as Pass Rate and Third Down Conversion Rate, EPA totals,
 * Penalty Yards); those use the format of the model's nearest sibling measure (for example
 * Season Success Rate's "0.0%"). Per-game and per-play values are DIVIDE()s of shipped measures
 * and use "0.0".
 */
export const TEAM_VIEW_DEFINITIONS: Record<TeamView, TeamViewDefinition> = {
    passing: {
        group: "offense",
        label: "Passing",
        primaryLabel: "Passing Yards",
        higherIsBetter: true,
        query: passing,
        stats: {
            "[Pass Yds]": { name: TEAM_FIELDS.primary, displayName: "Pass Yds", format: "#,0" },
            "[Yds per G]": { name: "YdsPerG", displayName: "Yds/G", format: "0.0" },
            "[Att]": { name: "Att", displayName: "Att", format: "0" },
            "[Cmp]": { name: "Cmp", displayName: "Cmp", format: "0" },
            "[Cmp Pct]": { name: "CmpPct", displayName: "Cmp %", format: "0.0%" },
            "[TD]": { name: "TD", displayName: "TD", format: "0" },
            "[INT]": { name: "Int", displayName: "INT", format: "0" },
            "[Sck]": { name: "Sck", displayName: "Sck", format: "0" },
            "[EPA per DB]": { name: "EpaPerDb", displayName: "EPA/DB", format: "0.00" },
        },
        kpis: [TEAM_FIELDS.primary, "YdsPerG", "CmpPct", "EpaPerDb"],
    },
    rushing: {
        group: "offense",
        label: "Rushing",
        primaryLabel: "Rushing Yards",
        higherIsBetter: true,
        query: rushing,
        stats: {
            "[Rush Yds]": { name: TEAM_FIELDS.primary, displayName: "Rush Yds", format: "#,0" },
            "[Yds per G]": { name: "YdsPerG", displayName: "Yds/G", format: "0.0" },
            "[Att]": { name: "Att", displayName: "Att", format: "0" },
            "[Yds per Att]": { name: "YdsPerAtt", displayName: "Yds/Att", format: "0.0" },
            "[TD]": { name: "TD", displayName: "TD", format: "0" },
            "[Explosive Pct]": { name: "ExplosivePct", displayName: "Explosive %", format: "0.0%" },
            "[Stuff Pct]": { name: "StuffPct", displayName: "Stuff %", format: "0.0%" },
            "[EPA per Rush]": { name: "EpaPerRush", displayName: "EPA/Rush", format: "0.00" },
        },
        kpis: [TEAM_FIELDS.primary, "YdsPerG", "YdsPerAtt", "EpaPerRush"],
    },
    receiving: {
        group: "offense",
        label: "Receiving",
        primaryLabel: "Receiving Yards",
        higherIsBetter: true,
        query: receiving,
        stats: {
            "[Rec Yds]": { name: TEAM_FIELDS.primary, displayName: "Rec Yds", format: "#,0" },
            "[Yds per G]": { name: "YdsPerG", displayName: "Yds/G", format: "0.0" },
            "[Rec]": { name: "Rec", displayName: "Rec", format: "0" },
            "[Tgt]": { name: "Tgt", displayName: "Tgt", format: "0" },
            "[Catch Pct]": { name: "CatchPct", displayName: "Catch %", format: "0.0%" },
            "[YAC]": { name: "Yac", displayName: "YAC", format: "#,0" },
            "[YAC per Rec]": { name: "YacPerRec", displayName: "YAC/Rec", format: "0.00" },
            "[EPA per Tgt]": { name: "EpaPerTgt", displayName: "EPA/Tgt", format: "0.00" },
        },
        kpis: [TEAM_FIELDS.primary, "YdsPerG", "CatchPct", "EpaPerTgt"],
    },
    scoring: {
        group: "offense",
        label: "Scoring & Downs",
        primaryLabel: "Points per Game",
        higherIsBetter: true,
        query: scoring,
        stats: {
            "[PF per G]": { name: TEAM_FIELDS.primary, displayName: "PF/G", format: "0.0" },
            "[W]": { name: "W", displayName: "W", format: "0" },
            "[L]": { name: "L", displayName: "L", format: "0" },
            "[T]": { name: "T", displayName: "T", format: "0" },
            "[PF]": { name: "PF", displayName: "PF", format: "0" },
            "[Off EPA per Play]": { name: "OffEpaPerPlay", displayName: "Off EPA/Play", format: "0.00" },
            "[Success Pct]": { name: "SuccessPct", displayName: "Success %", format: "0.0%" },
            "[Pass Rate]": { name: "PassRate", displayName: "Pass Rate", format: "0.0%" },
            "[Third Down Pct]": { name: "ThirdDownPct", displayName: "3rd Down %", format: "0.0%" },
            "[Fourth Down Pct]": { name: "FourthDownPct", displayName: "4th Down %", format: "0.0%" },
            "[Red Zone TD Pct]": { name: "RedZoneTdPct", displayName: "Red Zone TD %", format: "0.0%" },
            "[TO]": { name: "TO", displayName: "TO", format: "0" },
        },
        kpis: [TEAM_FIELDS.primary, "OffEpaPerPlay", "ThirdDownPct", "RedZoneTdPct"],
    },
    defenseOverview: {
        group: "defense",
        label: "Overview",
        primaryLabel: "Points Allowed per Game",
        higherIsBetter: false,
        query: defenseOverview,
        stats: {
            "[PA per G]": { name: TEAM_FIELDS.primary, displayName: "PA/G", format: "0.0" },
            "[PA]": { name: "PA", displayName: "PA", format: "0" },
            "[Yds Allowed]": { name: "YdsAllowed", displayName: "Yds Allowed", format: "#,0" },
            "[Yds Allowed per G]": { name: "YdsAllowedPerG", displayName: "Yds Allowed/G", format: "0.0" },
            "[Def EPA per Play]": { name: "DefEpaPerPlay", displayName: "Def EPA/Play", format: "0.00" },
            "[Success Allowed Pct]": { name: "SuccessAllowedPct", displayName: "Success Allowed %", format: "0.0%" },
            "[Takeaways]": { name: "Takeaways", displayName: "Takeaways", format: "0" },
            "[Explosive Allowed per G]": { name: "ExplosiveAllowedPerG", displayName: "Explosive Allowed/G", format: "0.0" },
        },
        kpis: [TEAM_FIELDS.primary, "YdsAllowedPerG", "DefEpaPerPlay", "Takeaways"],
        note: "Yards allowed are dropback plus designed-rush yards on defensive snaps; the total matches official yardage.",
    },
    yardsAllowed: {
        group: "defense",
        label: "Yards Allowed",
        primaryLabel: "Yards Allowed per Game",
        higherIsBetter: false,
        query: yardsAllowed,
        stats: {
            "[Yds Allowed per G]": { name: TEAM_FIELDS.primary, displayName: "Yds Allowed/G", format: "0.0" },
            "[Yds Allowed]": { name: "YdsAllowed", displayName: "Yds Allowed", format: "#,0" },
            "[Dropback Yds Allowed]": { name: "DropbackYdsAllowed", displayName: "Dropback Yds", format: "#,0" },
            "[Dropback Yds per G]": { name: "DropbackYdsPerG", displayName: "Dropback Yds/G", format: "0.0" },
            "[Rush Yds Allowed]": { name: "RushYdsAllowed", displayName: "Designed-Rush Yds", format: "#,0" },
            "[Rush Yds per G]": { name: "RushYdsPerG", displayName: "Designed-Rush Yds/G", format: "0.0" },
            "[Def Plays]": { name: "DefPlays", displayName: "Def Plays", format: "0" },
            "[Yds per Play]": { name: "YdsPerPlay", displayName: "Yds/Play", format: "0.0" },
        },
        kpis: [TEAM_FIELDS.primary, "DropbackYdsPerG", "RushYdsPerG", "YdsPerPlay"],
        note: "Derived from play-level yards on defensive snaps. QB scrambles count as dropbacks, so the dropback / designed-rush split differs from official pass / rush yards allowed; the total matches.",
    },
    passRush: {
        group: "defense",
        label: "Pass Rush",
        primaryLabel: "Sacks",
        higherIsBetter: true,
        query: passRush,
        stats: {
            "[Sacks]": { name: TEAM_FIELDS.primary, displayName: "Sacks", format: "0" },
            "[Sacks per G]": { name: "SacksPerG", displayName: "Sacks/G", format: "0.0" },
            "[QB Hits]": { name: "QbHits", displayName: "QB Hits", format: "0" },
            "[Hit Sack Pct]": { name: "HitSackPct", displayName: "Hit + Sack %", format: "0.0%" },
            "[Dropbacks Faced]": { name: "DropbacksFaced", displayName: "Dropbacks Faced", format: "0" },
        },
        kpis: [TEAM_FIELDS.primary, "SacksPerG", "QbHits", "HitSackPct"],
    },
    fieldGoals: {
        group: "specialTeams",
        label: "Field Goals",
        primaryLabel: "Field Goals Made",
        higherIsBetter: true,
        query: fieldGoals,
        stats: {
            "[FGM]": { name: TEAM_FIELDS.primary, displayName: "FGM", format: "0" },
            "[FGA]": { name: "Fga", displayName: "FGA", format: "0" },
            "[FG Pct]": { name: "FgPct", displayName: "FG %", format: "0.0%" },
        },
        kpis: [TEAM_FIELDS.primary, "Fga", "FgPct"],
        note: "The semantic model has field goal data only; punting and return stats are not available.",
    },
    penalties: {
        group: "penalties",
        label: "Penalties",
        primaryLabel: "Penalties per Game",
        higherIsBetter: false,
        query: penalties,
        stats: {
            "[Penalties per G]": { name: TEAM_FIELDS.primary, displayName: "Penalties/G", format: "0.0" },
            "[Penalties]": { name: "Penalties", displayName: "Penalties", format: "0" },
            "[Penalty Yds]": { name: "PenaltyYds", displayName: "Penalty Yds", format: "#,0" },
            "[Penalty Yds per G]": { name: "PenaltyYdsPerG", displayName: "Penalty Yds/G", format: "0.0" },
        },
        kpis: [TEAM_FIELDS.primary, "Penalties", "PenaltyYds", "PenaltyYdsPerG"],
        note: "Accepted penalties charged to each team.",
    },
};

export function getTeamView(view: TeamView): TeamViewDefinition {
    if (!isTeamView(view)) {
        throw new Error(`Unknown team view "${String(view)}".`);
    }
    return TEAM_VIEW_DEFINITIONS[view];
}
