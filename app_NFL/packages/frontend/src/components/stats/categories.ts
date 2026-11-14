import {
  passingLeaders,
  receivingLeaders,
  rushingLeaders,
  type LeaderboardParams,
  type SeasonType,
} from '@/queries';

export type CategoryId = 'passing' | 'rushing' | 'receiving';

/** Minimum-volume presets differ for a full season and a single week. */
export type VolumeScope = SeasonType | 'WEEK';

export interface LeaderCardDef {
  label: string;
  /** Exact query column to rank by and display. */
  column: string;
  format: (value: number) => string;
}

export interface CategoryDef {
  id: CategoryId;
  label: string;
  factory: typeof passingLeaders;
  /** Noun for the qualifying volume, e.g. "dropbacks". */
  volumeNoun: string;
  /** Minimum-volume presets and the default, per season type or single week. */
  volume: Record<VolumeScope, { options: number[]; default: number }>;
  scatterTitle: string;
  scatterSubtitle: string;
  leaders: LeaderCardDef[];
}

const decimal1 = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const signed2 = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
});
const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

const totalEpa: LeaderCardDef = {
  label: 'Total EPA',
  column: '[EPA]',
  format: (v) => decimal1.format(v),
};

export const CATEGORIES: CategoryDef[] = [
  {
    id: 'passing',
    label: 'Passing',
    factory: passingLeaders,
    volumeNoun: 'dropbacks',
    volume: {
      REG: { options: [50, 100, 150, 250, 400], default: 150 },
      POST: { options: [10, 20, 40, 80], default: 20 },
      WEEK: { options: [5, 10, 15, 20, 30], default: 15 },
    },
    scatterTitle: 'Accuracy vs. efficiency',
    scatterSubtitle:
      'Completion % over expected (x) against EPA per dropback (y). Bubble size is dropbacks.',
    leaders: [
      totalEpa,
      { label: 'EPA / Dropback', column: '[EPAPerPlay]', format: (v) => signed2.format(v) },
      { label: 'Passing yards', column: '[Yards]', format: (v) => whole.format(v) },
    ],
  },
  {
    id: 'rushing',
    label: 'Rushing',
    factory: rushingLeaders,
    volumeNoun: 'rushes',
    volume: {
      REG: { options: [25, 50, 75, 150, 250], default: 75 },
      POST: { options: [5, 10, 20, 40], default: 10 },
      WEEK: { options: [3, 5, 10, 15, 20], default: 10 },
    },
    scatterTitle: 'Yards vs. value',
    scatterSubtitle:
      'Yards per rush (x) against EPA per rush (y). Bubble size is rush attempts.',
    leaders: [
      totalEpa,
      { label: 'EPA / Rush', column: '[EPAPerPlay]', format: (v) => signed2.format(v) },
      { label: 'Rushing yards', column: '[Yards]', format: (v) => whole.format(v) },
    ],
  },
  {
    id: 'receiving',
    label: 'Receiving',
    factory: receivingLeaders,
    volumeNoun: 'targets',
    volume: {
      REG: { options: [20, 40, 60, 100], default: 40 },
      POST: { options: [3, 6, 10, 20], default: 6 },
      WEEK: { options: [2, 4, 6, 8, 10], default: 4 },
    },
    scatterTitle: 'Hands vs. impact',
    scatterSubtitle:
      'Catch rate (x) against EPA per target (y). Bubble size is targets.',
    leaders: [
      totalEpa,
      { label: 'EPA / Target', column: '[EPAPerPlay]', format: (v) => signed2.format(v) },
      { label: 'Receiving yards', column: '[Yards]', format: (v) => whole.format(v) },
    ],
  },
];

export type { LeaderboardParams };
