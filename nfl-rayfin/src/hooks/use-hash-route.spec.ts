import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { parseRoute, routeHref, useHashRoute } from "./use-hash-route";

describe("parseRoute", () => {
    it("maps known hashes to their route", () => {
        expect(parseRoute("#/teams")).toBe("teams");
        expect(parseRoute("#teams")).toBe("teams");
        expect(parseRoute("#/players")).toBe("players");
        expect(parseRoute("#/teams?season=2025")).toBe("teams");
    });

    it("falls back to the players page", () => {
        expect(parseRoute("")).toBe("players");
        expect(parseRoute("#/unknown")).toBe("players");
    });
});

describe("useHashRoute", () => {
    it("navigates by updating the hash and follows hash changes", () => {
        window.location.hash = "";
        const { result } = renderHook(() => useHashRoute());
        expect(result.current[0]).toBe("players");

        act(() => {
            result.current[1]("teams");
            window.dispatchEvent(new HashChangeEvent("hashchange"));
        });
        expect(window.location.hash).toBe(routeHref("teams"));
        expect(result.current[0]).toBe("teams");
    });
});
