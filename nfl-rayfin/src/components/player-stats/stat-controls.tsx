import { useRef, type KeyboardEvent, type ReactElement } from "react";
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

/** NFL.com-style stat category tabs: a keyboard-navigable tablist with a signal-red active rule. */
export function CategoryTabs({ value, onChange }: CategoryTabsProps): ReactElement {
    const refs = useRef<Record<string, HTMLButtonElement | null>>({});

    const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
        const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
        if (delta === 0) return;
        event.preventDefault();
        const next = STAT_CATEGORIES[(index + delta + STAT_CATEGORIES.length) % STAT_CATEGORIES.length];
        onChange(next);
        refs.current[next]?.focus();
    };

    return (
        <div role="tablist" aria-label="Stat category" className="-mb-px flex gap-1 overflow-x-auto [scrollbar-width:none]">
            {STAT_CATEGORIES.map((category, index) => {
                const selected = category === value;
                return (
                    <button
                        key={category}
                        ref={(el) => { refs.current[category] = el; }}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => onChange(category)}
                        onKeyDown={(event) => onKeyDown(event, index)}
                        className={cn(
                            "shrink-0 border-b-4 px-4 py-3 font-heading text-400 font-bold uppercase tracking-wider transition-colors",
                            "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-on-brand",
                            selected
                                ? "border-signal text-on-brand"
                                : "border-transparent text-on-brand/70 hover:border-on-brand/40 hover:text-on-brand",
                        )}
                    >
                        {statCategories[category].label}
                    </button>
                );
            })}
        </div>
    );
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
