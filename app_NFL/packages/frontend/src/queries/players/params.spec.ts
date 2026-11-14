import { describe, expect, it } from 'vitest';

import { fillLeaderboardQuery } from './params';

const template =
  'VAR s = "__SEASON__" VAR t = "__SEASON_TYPE__" VAR m = __MIN_VOLUME__';

describe('fillLeaderboardQuery', () => {
  it('substitutes season, season type and minimum volume', () => {
    expect(
      fillLeaderboardQuery(template, {
        season: '2025',
        seasonType: 'POST',
        minVolume: 20,
      })
    ).toBe('VAR s = "2025" VAR t = "POST" VAR m = 20');
  });

  it('substitutes a week when one is given', () => {
    expect(
      fillLeaderboardQuery(`${template} VAR w = __WEEK__`, {
        season: '2025',
        seasonType: 'REG',
        week: 7,
        minVolume: 10,
      })
    ).toBe('VAR s = "2025" VAR t = "REG" VAR m = 10 VAR w = 7');
  });

  it('rejects a week that is not a positive integer', () => {
    for (const week of [0, 2.5, -1, Number.NaN]) {
      expect(() =>
        fillLeaderboardQuery(template, {
          season: '2025',
          seasonType: 'REG',
          week,
          minVolume: 1,
        })
      ).toThrow(/Invalid week/);
    }
  });

  it('floors and clamps the minimum volume', () => {
    expect(
      fillLeaderboardQuery(template, {
        season: '2025',
        seasonType: 'REG',
        minVolume: -3.7,
      })
    ).toContain('VAR m = 0');
  });

  it('rejects values that are not a season or season type', () => {
    expect(() =>
      fillLeaderboardQuery(template, {
        season: '2025" || 1=1',
        seasonType: 'REG',
        minVolume: 1,
      })
    ).toThrow(/Invalid season/);
    expect(() =>
      fillLeaderboardQuery(template, {
        season: '2025',
        seasonType: 'PRE' as never,
        minVolume: 1,
      })
    ).toThrow(/Invalid season type/);
  });
});
