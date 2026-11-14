import type { VisualizationSpec } from '@microsoft/fabric-visuals';

import type { ColumnMetadataMap } from '@/lib/to-data-table';

import {
  connection,
  fillLeaderboardQuery,
  type LeaderboardParams,
} from './params';
import efficiencySpec from './passing-efficiency.json';
import baseQuery from './passing-leaders.dax?raw';
import weekQuery from './passing-leaders-week.dax?raw';
import topEpaSpec from './top-epa.json';

/** Keyed by the exact column names the query returns. */
export const columnMetadata: ColumnMetadataMap = {
  '[Player]': { name: 'Player', displayName: 'Player' },
  '[Position]': { name: 'Position', displayName: 'Pos' },
  '[Team]': { name: 'Team', displayName: 'Team' },
  '[Dropbacks]': { name: 'Dropbacks', displayName: 'Dropbacks', format: '#,0' },
  '[Yards]': { name: 'Yards', displayName: 'Pass Yds', format: '#,0' },
  '[TD]': { name: 'TD', displayName: 'TD', format: '#,0' },
  '[INT]': { name: 'INT', displayName: 'INT', format: '#,0' },
  '[CompPct]': { name: 'CompPct', displayName: 'Comp %', format: '0.0%' },
  '[CPOE]': { name: 'CPOE', displayName: 'CPOE', format: '+0.0;-0.0;0.0' },
  '[EPA]': { name: 'EPA', displayName: 'Total EPA', format: '#,0.0' },
  '[EPAPerPlay]': {
    name: 'EPAPerPlay',
    displayName: 'EPA / Dropback',
    format: '+0.00;-0.00;0.00',
  },
};

export function passingLeaders(params: LeaderboardParams) {
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
