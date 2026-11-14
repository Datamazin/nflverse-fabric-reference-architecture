import { connection } from './params';
import query from './seasons.dax?raw';

/** Column names exactly as the seasons query returns them. */
export const seasonColumns = {
  season: 'Player Season Summary[season]',
  seasonType: 'Player Season Summary[season_type]',
} as const;

/** Season and season-type pairs that have player data, newest first. */
export function seasons() {
  return { connection, query };
}
