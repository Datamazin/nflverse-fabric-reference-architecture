import { DataGrid } from '@microsoft/fabric-datagrid';
import { VegaVisual, useCssTheme } from '@microsoft/fabric-visuals';
import { Moon, Sun } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useTheme } from '@/hooks/theme.context';
import { useSemanticModelQuery } from '@/hooks/use-semantic-model-query';
import { queryProblem, rowObjects, type QueryTable } from '@/lib/query-table';
import { toDataTable } from '@/lib/to-data-table';
import { cn } from '@/lib/utils';
import {
  seasonColumns,
  seasons,
  weekColumns,
  weeks,
  type SeasonType,
} from '@/queries';

import {
  CATEGORIES,
  type CategoryDef,
  type CategoryId,
  type VolumeScope,
} from './categories';
import { Panel, PanelMessage, Skeleton } from './panel';

const SEASON_TYPE_LABEL: Record<SeasonType, string> = {
  REG: 'Regular season',
  POST: 'Postseason',
};

/** Season → available season types, newest season first. */
function useSeasonOptions() {
  const { data, error, isLoading } = useSemanticModelQuery(seasons());
  const options = useMemo(() => {
    if (data?.status !== 'success') return [];
    const bySeason = new Map<string, Set<SeasonType>>();
    for (const row of rowObjects(data.table)) {
      const season = String(row[seasonColumns.season] ?? '');
      const type = row[seasonColumns.seasonType];
      if (!season || (type !== 'REG' && type !== 'POST')) continue;
      if (!bySeason.has(season)) bySeason.set(season, new Set());
      bySeason.get(season)!.add(type);
    }
    return [...bySeason.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([season, types]) => ({ season, types }));
  }, [data]);
  return { options, isLoading, problem: queryProblem(error, data) };
}

const POSTSEASON_ROUNDS = ['Wild Card', 'Divisional', 'Conference', 'Super Bowl'];

/** Weeks with play data, keyed by `${season}:${seasonType}`, in week order. */
function useWeekOptions() {
  const { data } = useSemanticModelQuery(weeks());
  return useMemo(() => {
    const byKey = new Map<string, number[]>();
    if (data?.status !== 'success') return byKey;
    for (const row of rowObjects(data.table)) {
      const season = String(row[weekColumns.season] ?? '');
      const type = row[weekColumns.seasonType];
      const week = Number(row[weekColumns.week]);
      if (!season || !Number.isInteger(week)) continue;
      const key = `${season}:${String(type)}`;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key)!.push(week);
    }
    for (const list of byKey.values()) list.sort((a, b) => a - b);
    return byKey;
  }, [data]);
}

/** "Week 5" for the regular season; round names for the postseason. */
function weekLabel(week: number, seasonType: SeasonType, weeksInType: number[]) {
  if (seasonType === 'POST') {
    const round = POSTSEASON_ROUNDS[weeksInType.indexOf(week)];
    if (round) return round;
  }
  return `Week ${week}`;
}

export function PlayerStatsPage() {
  const { isDark, toggleTheme } = useTheme();
  const seasonOptions = useSeasonOptions();
  const weekOptions = useWeekOptions();

  const [pickedSeason, setPickedSeason] = useState<string>();
  const [pickedType, setPickedType] = useState<SeasonType>('REG');
  const [pickedWeek, setPickedWeek] = useState<number>();
  const [categoryId, setCategoryId] = useState<CategoryId>('passing');
  const [volumeOverrides, setVolumeOverrides] = useState<
    Record<string, number>
  >({});

  const season = pickedSeason ?? seasonOptions.options[0]?.season;
  const availableTypes = seasonOptions.options.find(
    (o) => o.season === season
  )?.types;
  // A season without postseason data (e.g. one in progress) falls back to REG.
  const seasonType: SeasonType =
    availableTypes && !availableTypes.has(pickedType) ? 'REG' : pickedType;

  const availableWeeks = weekOptions.get(`${season}:${seasonType}`) ?? [];
  // Keep the picked week only while it exists for this season and season type.
  const week =
    pickedWeek !== undefined && availableWeeks.includes(pickedWeek)
      ? pickedWeek
      : undefined;
  const weekText =
    week === undefined ? undefined : weekLabel(week, seasonType, availableWeeks);

  const category = CATEGORIES.find((c) => c.id === categoryId)!;
  const volumeScope: VolumeScope = week === undefined ? seasonType : 'WEEK';
  const volumeKey = `${category.id}:${volumeScope}`;
  const minVolume =
    volumeOverrides[volumeKey] ?? category.volume[volumeScope].default;

  return (
    <div className="flex min-h-full flex-col">
      <header className="field-stripes text-field-foreground">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-500 px-600 pt-600 pb-500">
          <div className="flex flex-wrap items-end justify-between gap-400">
            <div className="flex flex-col gap-100">
              <p className="font-heading text-300 leading-300 font-semibold tracking-widest text-field-accent uppercase">
                NFL Play by Play Model
              </p>
              <h1 className="font-heading text-hero-900 leading-hero-900 font-bold tracking-wide uppercase">
                Player Stats
              </h1>
              <p className="text-300 leading-300 text-field-muted">
                {season
                  ? `${season} ${SEASON_TYPE_LABEL[seasonType].toLowerCase()}${weekText ? ` · ${weekText}` : ''} · ranked by expected points added`
                  : 'Loading seasons…'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-300">
              <label className="flex flex-col gap-100 text-200 leading-200 text-field-muted">
                Season
                <select
                  className="h-800 min-w-24 rounded-lg border border-field-stripe bg-field px-300 text-300 text-field-foreground focus-visible:outline-2 focus-visible:outline-field-accent disabled:opacity-60"
                  value={season ?? ''}
                  disabled={!season}
                  onChange={(e) => setPickedSeason(e.target.value)}
                >
                  {seasonOptions.options.map((o) => (
                    <option key={o.season} value={o.season}>
                      {o.season}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-100 text-200 leading-200 text-field-muted">
                Week
                <select
                  className="h-800 min-w-32 rounded-lg border border-field-stripe bg-field px-300 text-300 text-field-foreground focus-visible:outline-2 focus-visible:outline-field-accent disabled:opacity-60"
                  value={week ?? ''}
                  disabled={!season || availableWeeks.length === 0}
                  onChange={(e) =>
                    setPickedWeek(
                      e.target.value === '' ? undefined : Number(e.target.value)
                    )
                  }
                >
                  <option value="">All weeks</option>
                  {availableWeeks.map((w) => (
                    <option key={w} value={w}>
                      {weekLabel(w, seasonType, availableWeeks)}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-col gap-100 text-200 leading-200 text-field-muted">
                <span id="season-type-label">Games</span>
                <div
                  role="radiogroup"
                  aria-labelledby="season-type-label"
                  className="flex h-800 rounded-lg border border-field-stripe p-100"
                >
                  {(['REG', 'POST'] as const).map((t) => {
                    const enabled = !availableTypes || availableTypes.has(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        role="radio"
                        aria-checked={seasonType === t}
                        disabled={!enabled}
                        title={enabled ? undefined : `No ${SEASON_TYPE_LABEL[t].toLowerCase()} data for ${season}`}
                        onClick={() => setPickedType(t)}
                        className={cn(
                          'rounded-md px-300 text-300 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-field-accent disabled:cursor-not-allowed disabled:opacity-40',
                          seasonType === t
                            ? 'bg-field-accent text-field'
                            : 'text-field-foreground hover:bg-field-stripe'
                        )}
                      >
                        {t === 'REG' ? 'Regular' : 'Playoffs'}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={toggleTheme}
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                className="mt-500 flex size-800 items-center justify-center rounded-lg border border-field-stripe text-field-foreground hover:bg-field-stripe focus-visible:outline-2 focus-visible:outline-field-accent"
              >
                {isDark ? (
                  <Sun className="icon-size-200" aria-hidden />
                ) : (
                  <Moon className="icon-size-200" aria-hidden />
                )}
              </button>
            </div>
          </div>

          <nav
            role="tablist"
            aria-label="Stat category"
            className="flex gap-100 border-b border-field-stripe"
          >
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={c.id === category.id}
                onClick={() => setCategoryId(c.id)}
                className={cn(
                  '-mb-px border-b-4 px-400 pb-200 font-heading text-500 leading-500 font-semibold tracking-wide uppercase transition-colors focus-visible:outline-2 focus-visible:outline-field-accent',
                  c.id === category.id
                    ? 'border-field-accent text-field-foreground'
                    : 'border-transparent text-field-muted hover:text-field-foreground'
                )}
              >
                {c.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-500 px-600 py-600">
        {seasonOptions.problem ? (
          <Panel title="Couldn't load seasons">
            <PanelMessage tone="error">{seasonOptions.problem}</PanelMessage>
          </Panel>
        ) : (
          <CategoryView
            key={category.id}
            category={category}
            season={season}
            seasonType={seasonType}
            week={week}
            volumeScope={volumeScope}
            minVolume={minVolume}
            onMinVolumeChange={(v) =>
              setVolumeOverrides((prev) => ({ ...prev, [volumeKey]: v }))
            }
          />
        )}
      </main>
    </div>
  );
}

interface CategoryViewProps {
  category: CategoryDef;
  season: string | undefined;
  seasonType: SeasonType;
  week: number | undefined;
  volumeScope: VolumeScope;
  minVolume: number;
  onMinVolumeChange: (value: number) => void;
}

function CategoryView({
  category,
  season,
  seasonType,
  week,
  volumeScope,
  minVolume,
  onMinVolumeChange,
}: CategoryViewProps) {
  const theme = useCssTheme();
  const leaderboard = useMemo(
    () =>
      season
        ? category.factory({ season, seasonType, week, minVolume })
        : undefined,
    [category, season, seasonType, week, minVolume]
  );

  const { data, error, isLoading } = useSemanticModelQuery({
    connection: leaderboard?.connection ?? '',
    query: leaderboard?.query ?? '',
  });

  const problem = queryProblem(error, data);
  const table: QueryTable | undefined =
    data?.status === 'success' ? data.table : undefined;
  const dataTable = useMemo(
    () =>
      table && leaderboard
        ? toDataTable(table, leaderboard.columnMetadata)
        : undefined,
    [table, leaderboard]
  );
  const rows = useMemo(() => (table ? rowObjects(table) : []), [table]);
  const loading = !season || isLoading || (!table && !problem);
  const empty = !loading && !problem && rows.length === 0;

  const presets = category.volume[volumeScope].options;
  const volumeOptions = presets.includes(minVolume)
    ? presets
    : [...presets, minVolume].sort((a, b) => a - b);

  const qualifierNote = `Players with at least ${minVolume} ${category.volumeNoun}`;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-300">
        <p className="text-300 leading-300 text-muted-foreground" aria-live="polite">
          {loading
            ? 'Loading players…'
            : problem
              ? ' '
              : `${rows.length} qualifying ${rows.length === 1 ? 'player' : 'players'} · ${qualifierNote.toLowerCase()}`}
        </p>
        <label className="flex items-center gap-200 text-300 leading-300 text-muted-foreground">
          Minimum {category.volumeNoun}
          <select
            className="h-700 rounded-lg border border-input bg-card px-200 text-300 text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            value={minVolume}
            onChange={(e) => onMinVolumeChange(Number(e.target.value))}
          >
            {volumeOptions.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>

      {problem ? (
        <Panel title={`${category.label} leaders`}>
          <PanelMessage tone="error">
            Couldn&apos;t load {category.label.toLowerCase()} stats. {problem}
          </PanelMessage>
        </Panel>
      ) : (
        <>
          <LeaderCards category={category} rows={rows} loading={loading} />

          <div className="grid grid-cols-1 gap-500 lg:grid-cols-5">
            <Panel
              className="lg:col-span-3"
              title={category.scatterTitle}
              subtitle={`${category.scatterSubtitle} Top 8 by total EPA are labelled.`}
            >
              <div className="h-chart">
                {loading ? (
                  <Skeleton className="h-full w-full" />
                ) : empty ? (
                  <PanelMessage>
                    No players reach {minVolume} {category.volumeNoun}. Lower the minimum.
                  </PanelMessage>
                ) : (
                  leaderboard &&
                  dataTable && (
                    <VegaVisual
                      className="h-full w-full"
                      spec={leaderboard.efficiencySpec}
                      data={dataTable}
                      theme={theme}
                    />
                  )
                )}
              </div>
            </Panel>

            <Panel
              className="lg:col-span-2"
              title="Top 15 by total EPA"
              subtitle="Expected points added across every qualifying play."
            >
              <div className="h-chart">
                {loading ? (
                  <Skeleton className="h-full w-full" />
                ) : empty ? (
                  <PanelMessage>No qualifying players.</PanelMessage>
                ) : (
                  leaderboard &&
                  dataTable && (
                    <VegaVisual
                      className="h-full w-full"
                      spec={leaderboard.topEpaSpec}
                      data={dataTable}
                      theme={theme}
                    />
                  )
                )}
              </div>
            </Panel>
          </div>

          <Panel
            title={`${category.label} leaderboard`}
            subtitle={`${qualifierNote}. Players traded mid-season are combined, with every team listed. Sort or filter any column.`}
          >
            <div className="h-grid overflow-auto">
              {loading ? (
                <Skeleton className="h-full w-full" />
              ) : empty ? (
                <PanelMessage>No qualifying players.</PanelMessage>
              ) : (
                dataTable && <DataGrid data={dataTable} theme={theme} />
              )}
            </div>
          </Panel>
        </>
      )}
    </>
  );
}

function LeaderCards({
  category,
  rows,
  loading,
}: {
  category: CategoryDef;
  rows: Record<string, unknown>[];
  loading: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-500 sm:grid-cols-3">
      {category.leaders.map((def) => {
        let top: Record<string, unknown> | undefined;
        for (const row of rows) {
          const v = row[def.column];
          if (typeof v !== 'number') continue;
          if (!top || v > (top[def.column] as number)) top = row;
        }
        return (
          <article
            key={def.label}
            className="relative overflow-hidden rounded-xl border border-border bg-card px-500 py-400"
          >
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 w-100 bg-primary"
            />
            <p className="font-heading text-300 leading-300 font-semibold tracking-wider text-muted-foreground uppercase">
              {def.label} leader
            </p>
            {loading ? (
              <div className="mt-200 flex flex-col gap-200">
                <Skeleton className="h-700 w-1/2" />
                <Skeleton className="h-400 w-2/3" />
              </div>
            ) : top ? (
              <>
                <p className="mt-100 font-numeric text-hero-800 leading-hero-800 font-semibold tabular-nums">
                  {def.format(top[def.column] as number)}
                </p>
                <p className="text-300 leading-300">
                  <span className="font-semibold">{String(top['[Player]'])}</span>{' '}
                  <span className="text-muted-foreground">
                    {String(top['[Position]'])} · {String(top['[Team]'])}
                  </span>
                </p>
              </>
            ) : (
              <p className="mt-200 text-300 leading-300 text-muted-foreground">
                No qualifying players
              </p>
            )}
          </article>
        );
      })}
    </div>
  );
}
