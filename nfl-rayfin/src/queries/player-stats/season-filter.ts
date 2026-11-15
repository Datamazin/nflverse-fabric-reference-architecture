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
 * Substitutes the validated season and season type into every `TREATAS` season filter in a
 * `.dax` file. Team queries filter several fact tables (each has its own season columns), so a
 * query may hold several placeholder pairs. Only closed or digit-only values are accepted, so no
 * caller-supplied text reaches the query unescaped.
 */
export function applySeasonFilter(query: string, { season, seasonType }: SeasonParams): string {
    if (!SEASON_PATTERN.test(season)) {
        throw new Error(`Invalid season "${season}". Expected a four-digit year.`);
    }
    if (!isSeasonType(seasonType)) {
        throw new Error(`Invalid season type "${String(seasonType)}".`);
    }
    const seasonCount = query.split(SEASON_TOKEN).length - 1;
    const seasonTypeCount = query.split(SEASON_TYPE_TOKEN).length - 1;
    if (seasonCount === 0 || seasonCount !== seasonTypeCount) {
        throw new Error("Expected matching season and season-type placeholders in the query.");
    }

    return query.replaceAll(SEASON_TOKEN, season).replaceAll(SEASON_TYPE_TOKEN, seasonType);
}
