import type { ReactElement } from "react";
import { TabStrip } from "@/components/app-shell/header-tabs";
import { cn } from "@/lib/utils";
import { STAT_CATEGORIES, statCategories, type SeasonType, type StatCategory } from "@/queries/player-stats";

const SEASON_TYPE_LABELS: Record<SeasonType, string> = { REG: "Regular season", POST: "Postseason" };

export function seasonTypeLabel(seasonType: SeasonType): string {
    return SEASON_TYPE_LABELS[seasonType];
}

interface CategoryTabsProps {
    value: StatCategory;
    onChange: (category: StatCategory) => void;
}

const CATEGORY_OPTIONS = STAT_CATEGORIES.map((category) => ({ value: category, label: statCategories[category].label }));

/** NFL.com-style stat category tabs on the scoreboard band. */
export function CategoryTabs({ value, onChange }: CategoryTabsProps): ReactElement {
    return <TabStrip options={CATEGORY_OPTIONS} value={value} onChange={onChange} ariaLabel="Stat category" />;
}

interface SeasonControlsProps {
    seasons: readonly string[];
    season: string;
    onSeasonChange: (season: string) => void;
    seasonTypes: readonly SeasonType[];
    seasonType: SeasonType;
    onSeasonTypeChange: (seasonType: SeasonType) => void;
}

const CONTROL = "h-9 rounded-md border bg-card px-3 text-[length:var(--text-300)] text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring";

export function SeasonControls({
    seasons,
    season,
    onSeasonChange,
    seasonTypes,
    seasonType,
    onSeasonTypeChange,
}: SeasonControlsProps): ReactElement {
    return (
        <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
                <span className="font-heading text-200 font-bold uppercase tracking-wider text-muted-foreground">Season</span>
                <select
                    className={cn(CONTROL, "min-w-28 font-semibold")}
                    value={season}
                    onChange={(event) => onSeasonChange(event.target.value)}
                >
                    {seasons.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
            </label>
            <div className="flex flex-col gap-1">
                <span id="season-type-label" className="font-heading text-200 font-bold uppercase tracking-wider text-muted-foreground">
                    Season type
                </span>
                <div role="radiogroup" aria-labelledby="season-type-label" className="flex h-9 overflow-hidden rounded-md border bg-card">
                    {(["REG", "POST"] as const).map((option) => {
                        const available = seasonTypes.includes(option);
                        const checked = option === seasonType;
                        return (
                            <button
                                key={option}
                                type="button"
                                role="radio"
                                aria-checked={checked}
                                disabled={!available}
                                title={available ? undefined : `No ${seasonTypeLabel(option).toLowerCase()} stats for ${season}`}
                                onClick={() => onSeasonTypeChange(option)}
                                className={cn(
                                    "px-3 text-300 font-semibold transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                                    checked ? "bg-brand text-on-brand" : "text-foreground hover:bg-hover",
                                    "disabled:cursor-not-allowed disabled:text-muted-foreground disabled:opacity-60 disabled:hover:bg-transparent",
                                )}
                            >
                                {seasonTypeLabel(option)}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
