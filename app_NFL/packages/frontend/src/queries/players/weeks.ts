import { connection } from './params';
import query from './weeks.dax?raw';

/** Column names exactly as the weeks query returns them. */
export const weekColumns = {
  season: 'Passing Play[season]',
  seasonType: 'Passing Play[season_type]',
  week: 'Passing Play[week]',
} as const;

/** Season, season type and week combinations that have play data. */
export function weeks() {
  return { connection, query };
}
