import type { VisualizationSpec } from '@microsoft/fabric-visuals';

import type { ColumnMetadataMap } from '@/lib/to-data-table';

import {
  connection,
  fillLeaderboardQuery,
  type LeaderboardParams,
} from './params';
import efficiencySpec from './rushing-efficiency.json';
import baseQuery from './rushing-leaders.dax?raw';
import weekQuery from './rushing-leaders-week.dax?raw';
import topEpaSpec from './top-epa.json';

/** Keyed by the exact column names the query returns. */
export const columnMetadata: ColumnMetadataMap = {
  '[Player]': { name: 'Player', displayName: 'Player' },
  '[Position]': { name: 'Position', displayName: 'Pos' },
  '[Team]': { name: 'Team', displayName: 'Team' },
  '[Attempts]': { name: 'Attempts', displayName: 'Rushes', format: '#,0' },
  '[Yards]': { name: 'Yards', displayName: 'Rush Yds', format: '#,0' },
  '[YardsPerCarry]': {
    name: 'YardsPerCarry',
    displayName: 'Yds / Rush',
    format: '0.0',
  },
  '[TD]': { name: 'TD', displayName: 'TD', format: '#,0' },
  '[StuffRate]': { name: 'StuffRate', displayName: 'Stuff %', format: '0.0%' },
  '[ExplosiveRate]': {
    name: 'ExplosiveRate',
    displayName: 'Explosive %',
    format: '0.0%',
  },
  '[EPA]': { name: 'EPA', displayName: 'Total EPA', format: '#,0.0' },
  '[EPAPerPlay]': {
    name: 'EPAPerPlay',
    displayName: 'EPA / Rush',
    format: '+0.00;-0.00;0.00',
  },
};

export function rushingLeaders(params: LeaderboardParams) {
  return {
    connection,
    query: fillLeaderboardQuery(
      params.week === undefined ? baseQuery : weekQuery,
      params
    ),
    columnMetadata,
    efficiencySpec: efficiencySpec as VisualizationSpec,
    topEpaSpec: topEpaSpec as VisualizationSpec,
  };
}
