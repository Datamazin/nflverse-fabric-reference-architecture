import type { VisualizationSpec } from '@microsoft/fabric-visuals';

import type { ColumnMetadataMap } from '@/lib/to-data-table';

import {
  connection,
  fillLeaderboardQuery,
  type LeaderboardParams,
} from './params';
import efficiencySpec from './receiving-efficiency.json';
import baseQuery from './receiving-leaders.dax?raw';
import weekQuery from './receiving-leaders-week.dax?raw';
import topEpaSpec from './top-epa.json';

/** Keyed by the exact column names the query returns. */
export const columnMetadata: ColumnMetadataMap = {
  '[Player]': { name: 'Player', displayName: 'Player' },
  '[Position]': { name: 'Position', displayName: 'Pos' },
  '[Team]': { name: 'Team', displayName: 'Team' },
  '[Targets]': { name: 'Targets', displayName: 'Targets', format: '#,0' },
  '[Receptions]': { name: 'Receptions', displayName: 'Rec', format: '#,0' },
  '[CatchRate]': { name: 'CatchRate', displayName: 'Catch %', format: '0.0%' },
  '[Yards]': { name: 'Yards', displayName: 'Rec Yds', format: '#,0' },
  '[YACPerReception]': {
    name: 'YACPerReception',
    displayName: 'YAC / Rec',
    format: '0.0',
  },
  '[EPA]': { name: 'EPA', displayName: 'Total EPA', format: '#,0.0' },
  '[EPAPerPlay]': {
    name: 'EPAPerPlay',
    displayName: 'EPA / Target',
    format: '+0.00;-0.00;0.00',
  },
};

export function receivingLeaders(params: LeaderboardParams) {
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
