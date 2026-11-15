import { useRef, type KeyboardEvent, type ReactElement } from "react";
import { cn } from "@/lib/utils";

export interface TabOption<T extends string> {
    value: T;
    label: string;
}

interface TabStripProps<T extends string> {
    options: readonly TabOption<T>[];
    value: T;
    onChange: (value: T) => void;
    ariaLabel: string;
    /** "header" sits on the scoreboard band; "chips" sits on the page for sub-views. */
    variant?: "header" | "chips";
}

/** A keyboard-navigable tablist (arrow keys move and select), in header or chip style. */
export function TabStrip<T extends string>({ options, value, onChange, ariaLabel, variant = "header" }: TabStripProps<T>): ReactElement {
    const refs = useRef<Record<string, HTMLButtonElement | null>>({});

    const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
        const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
        if (delta === 0) return;
        event.preventDefault();
        const next = options[(index + delta + options.length) % options.length].value;
        onChange(next);
        refs.current[next]?.focus();
    };

    return (
        <div
            role="tablist"
            aria-label={ariaLabel}
            className={cn(
                "flex overflow-x-auto [scrollbar-width:none]",
                variant === "header" ? "-mb-px gap-1" : "gap-2",
            )}
        >
            {options.map((option, index) => {
                const selected = option.value === value;
                return (
                    <button
                        key={option.value}
                        ref={(el) => { refs.current[option.value] = el; }}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => onChange(option.value)}
                        onKeyDown={(event) => onKeyDown(event, index)}
                        className={cn(
                            "shrink-0 font-heading font-bold uppercase tracking-wider transition-colors",
                            variant === "header"
                                ? cn(
                                    "border-b-4 px-4 py-3 text-400",
                                    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-on-brand",
                                    selected
                                        ? "border-signal text-on-brand"
                                        : "border-transparent text-on-brand/70 hover:border-on-brand/40 hover:text-on-brand",
                                )
                                : cn(
                                    "h-9 rounded-full border px-4 text-300",
                                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                                    selected
                                        ? "border-brand bg-brand text-on-brand"
                                        : "bg-card text-foreground hover:bg-hover",
                                ),
                        )}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}
