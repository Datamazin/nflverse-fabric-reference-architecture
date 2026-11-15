import { useCallback, useEffect, useState } from "react";

export const APP_ROUTES = ["players", "teams"] as const;
export type AppRoute = (typeof APP_ROUTES)[number];

const DEFAULT_ROUTE: AppRoute = "players";

/** Maps a location hash such as "#/teams" to a known route; anything else is the default page. */
export function parseRoute(hash: string): AppRoute {
    const name = hash.replace(/^#\/?/, "").split(/[/?]/)[0];
    return (APP_ROUTES as readonly string[]).includes(name) ? (name as AppRoute) : DEFAULT_ROUTE;
}

export function routeHref(route: AppRoute): string {
    return `#/${route}`;
}

/**
 * The current page, kept in the URL hash so it survives reloads and works inside the Fabric
 * host frame without a router or server rewrites.
 */
export function useHashRoute(): [AppRoute, (route: AppRoute) => void] {
    const [route, setRoute] = useState<AppRoute>(() => parseRoute(window.location.hash));

    useEffect(() => {
        const onHashChange = (): void => setRoute(parseRoute(window.location.hash));
        window.addEventListener("hashchange", onHashChange);
        return () => window.removeEventListener("hashchange", onHashChange);
    }, []);

    const navigate = useCallback((next: AppRoute) => {
        window.location.hash = routeHref(next);
    }, []);

    return [route, navigate];
}
