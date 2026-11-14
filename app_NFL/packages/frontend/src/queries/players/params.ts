/** Connector alias declared in rayfin/rayfin.yml for the NFL Play by Play Model. */
export const connection = 'nflpbp';

export type SeasonType = 'REG' | 'POST';

export interface LeaderboardParams {
  /** Season as stored in the model, e.g. "2025". */
  season: string;
  seasonType: SeasonType;
  /** A single week of the season; omit for the whole season. */
  week?: number;
  /** Minimum dropbacks, rush attempts or targets for a player to appear. */
  minVolume: number;
}

/**
 * Fills the placeholders in a leaderboard `.dax` file. Values are validated
 * before substitution so nothing but a four-digit season, a known season type,
 * a positive integer week and a non-negative integer can reach the query text.
 */
export function fillLeaderboardQuery(
  template: string,
  { season, seasonType, week, minVolume }: LeaderboardParams
): string {
  if (!/^\d{4}$/.test(season)) throw new Error(`Invalid season "${season}".`);
  if (seasonType !== 'REG' && seasonType !== 'POST') {
    throw new Error(`Invalid season type "${String(seasonType)}".`);
  }
  if (week !== undefined && !(Number.isInteger(week) && week >= 1 && week <= 30)) {
    throw new Error(`Invalid week "${String(week)}".`);
  }
  const min = Math.max(
    0,
    Math.floor(Number.isFinite(minVolume) ? minVolume : 0)
  );
  return template
    .replace('__SEASON__', season)
    .replace('__SEASON_TYPE__', seasonType)
    .replace('__WEEK__', String(week ?? ''))
    .replace('__MIN_VOLUME__', String(min));
}
