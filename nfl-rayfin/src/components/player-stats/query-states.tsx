import type { ReactElement, ReactNode } from "react";
import { AlertTriangle, RotateCw, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";

/** Connector error categories (see the semantic-model-data skill). */
export type QueryErrorCategory = "api" | "query" | "network" | "overflow" | "unknown";

const CATEGORY_HINTS: Record<QueryErrorCategory, string> = {
    query: "The semantic model rejected the query.",
    network: "No response from the service. Check your connection and retry.",
    api: "The service refused the request. Check that you are signed in and can access the semantic model.",
    overflow: "A value in the result is too large to display precisely.",
    unknown: "Something went wrong while loading data.",
};

const KNOWN_CATEGORIES: readonly string[] = Object.keys(CATEGORY_HINTS);

/** Reads the connector error category from a query error, or from an Error whose `cause` carries one. */
export function errorCategoryOf(error: unknown): QueryErrorCategory {
    const candidate: unknown =
        error instanceof Error && error.cause !== undefined ? error.cause : error;
    if (candidate && typeof candidate === "object" && "category" in candidate) {
        const category = (candidate as { category: unknown }).category;
        if (typeof category === "string" && KNOWN_CATEGORIES.includes(category)) {
            return category as QueryErrorCategory;
        }
    }
    return "unknown";
}

interface ErrorBannerProps {
    title: string;
    message: string;
    category: QueryErrorCategory;
    onRetry?: () => void;
    className?: string;
}

export function ErrorBanner({ title, message, category, onRetry, className }: ErrorBannerProps): ReactElement {
    return (
        <div
            role="alert"
            className={cn(
                "flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-foreground",
                className,
            )}
        >
            <AlertTriangle aria-hidden className="icon-size-300 shrink-0 text-destructive" />
            <div className="min-w-0 flex-1">
                <p className="font-heading text-400 font-bold uppercase tracking-wide text-destructive">{title}</p>
                <p className="text-300 text-foreground">{CATEGORY_HINTS[category]}</p>
                <p className="mt-1 break-words text-200 text-muted-foreground">{message}</p>
            </div>
            {onRetry && (
                <button
                    type="button"
                    onClick={onRetry}
                    className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-destructive/50 px-3 text-300 font-semibold text-destructive hover:bg-destructive/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                    <RotateCw aria-hidden className="icon-size-200" />
                    Retry
                </button>
            )}
        </div>
    );
}

export function EmptyState({ title, children, className }: { title: string; children?: ReactNode; className?: string }): ReactElement {
    return (
        <div
            role="status"
            className={cn(
                "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-card p-8 text-center",
                className,
            )}
        >
            <SearchX aria-hidden className="icon-size-600 text-muted-foreground" />
            <p className="font-heading text-500 font-bold uppercase tracking-wide text-emphasis-foreground">{title}</p>
            {children && <p className="max-w-md text-300 text-muted-foreground">{children}</p>}
        </div>
    );
}

export function Skeleton({ className, label }: { className?: string; label?: string }): ReactElement {
    return (
        <div
            role="status"
            aria-label={label ?? "Loading"}
            className={cn("animate-pulse rounded-lg border bg-card", className)}
        >
            <div className="flex h-full flex-col gap-3 p-4">
                <div className="h-4 w-1/3 rounded-sm bg-muted" />
                <div className="flex-1 rounded-sm bg-muted/70" />
            </div>
        </div>
    );
}
