//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { lightThemeColors } from "@microsoft/fabric-visuals-core";
import App from "@/App";
import { ThemeContext } from "@/hooks/theme.context";

// The page queries the semantic model on mount; keep it in its loading state here.
vi.mock("@/hooks/use-semantic-model-query", () => ({
    useSemanticModelQuery: () => ({ data: undefined, isLoading: true, error: undefined, refetch: vi.fn() }),
}));

function renderApp() {
    return render(
        <ThemeContext.Provider value={{ isDark: false, toggleTheme: vi.fn(), theme: lightThemeColors }}>
            <App />
        </ThemeContext.Provider>,
    );
}

describe("App", () => {
    it("renders without throwing", () => {
        expect(() => renderApp()).not.toThrow();
    });

    it("renders the player stats page with category tabs and a loading state", () => {
        renderApp();
        expect(screen.getByRole("heading", { name: /passing leaders/i })).toBeInTheDocument();
        expect(screen.getAllByRole("tab")).toHaveLength(5);
        expect(screen.getByRole("status", { name: /loading seasons/i })).toBeInTheDocument();
    });
});
