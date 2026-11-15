import type { ReactElement, ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import { useThemeContext } from "@/hooks/theme.context";
import { APP_ROUTES, routeHref, type AppRoute } from "@/hooks/use-hash-route";
import { cn } from "@/lib/utils";

const ROUTE_LABELS: Record<AppRoute, string> = { players: "Players", teams: "Teams" };

interface AppHeaderProps {
    route: AppRoute;
    title: string;
    subtitle: string;
    /** The page's category tabs, drawn along the bottom of the band. */
    tabs: ReactNode;
}

/** The scoreboard band shared by every page: page switch, title, theme toggle, and tabs. */
export function AppHeader({ route, title, subtitle, tabs }: AppHeaderProps): ReactElement {
    const { isDark, toggleTheme } = useThemeContext();
    return (
        <header className="yard-lines text-on-brand">
            <div className="mx-auto flex max-w-screen-2xl flex-col gap-4 px-4 pt-6 md:px-8">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <nav aria-label="Stats pages" className="flex items-center gap-1 font-heading text-300 font-bold uppercase tracking-[0.2em]">
                            <span className="text-on-brand/80">Gridiron ·</span>
                            {APP_ROUTES.map((page) => (
                                <a
                                    key={page}
                                    href={routeHref(page)}
                                    aria-current={page === route ? "page" : undefined}
                                    className={cn(
                                        "rounded-sm px-1 underline-offset-4 focus-visible:outline-2 focus-visible:outline-on-brand",
                                        page === route ? "text-on-brand underline decoration-signal decoration-2" : "text-on-brand/70 hover:text-on-brand",
                                    )}
                                >
                                    {ROUTE_LABELS[page]}
                                </a>
                            ))}
                        </nav>
                        <h1 className="font-page-title text-page-title uppercase leading-none tracking-wide text-on-brand">{title}</h1>
                        <p className="font-page-subtitle text-page-subtitle mt-1 text-on-brand/80">{subtitle}</p>
                    </div>
                    <button
                        type="button"
                        onClick={toggleTheme}
                        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-on-brand/30 text-on-brand hover:bg-on-brand/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-brand"
                    >
                        {isDark ? <Sun aria-hidden className="icon-size-200" /> : <Moon aria-hidden className="icon-size-200" />}
                    </button>
                </div>
                {tabs}
            </div>
        </header>
    );
}
