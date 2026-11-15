/** The connector declared in `rayfin/rayfin.yml` for the NFL Play by Play semantic model. */
export const connection = "nflmodel";

/** Raw `'Player Season Summary'[season_type]` values in the model. */
export const SEASON_TYPES = ["REG", "POST"] as const;
export type SeasonType = (typeof SEASON_TYPES)[number];

export interface SeasonParams {
    /** A four-digit `'Player Season Summary'[season]` value, such as "2025". */
    season: string;
    seasonType: SeasonType;
}

const SEASON_TOKEN = "__SEASON__";
const SEASON_TYPE_TOKEN = "__SEASON_TYPE__";
const SEASON_PATTERN = /^\d{4}$/;

export function isSeasonType(value: unknown): value is SeasonType {
    return typeof value === "string" && (SEASON_TYPES as readonly string[]).includes(value);
}

/**
 * Substitutes the validated season and season type into the `.dax` file's
 * `TREATAS` string literals. Only closed or digit-only values are accepted, so no
 * caller-supplied text reaches the query unescaped.
 */
export function applySeasonFilter(query: string, { season, seasonType }: SeasonParams): string {
    if (!SEASON_PATTERN.test(season)) {
        throw new Error(`Invalid season "${season}". Expected a four-digit year.`);
    }
    if (!isSeasonType(seasonType)) {
        throw new Error(`Invalid season type "${String(seasonType)}".`);
    }
    if (query.split(SEASON_TOKEN).length !== 2 || query.split(SEASON_TYPE_TOKEN).length !== 2) {
        throw new Error("Expected exactly one season and one season-type placeholder in the query.");
    }

    return query.replace(SEASON_TOKEN, season).replace(SEASON_TYPE_TOKEN, seasonType);
}
