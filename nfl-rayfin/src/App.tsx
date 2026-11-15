//-----------------------------------------------------------------------
// <copyright company="Microsoft Corporation">
//        Copyright (c) Microsoft Corporation.  All rights reserved.
//        Licensed under the MIT license. See LICENSE file in the project root for full license information.
// </copyright>
//-----------------------------------------------------------------------

import { PlayerStatsPage } from "@/components/player-stats/player-stats-page";
import { TeamStatsPage } from "@/components/team-stats/team-stats-page";
import { useHashRoute } from "@/hooks/use-hash-route";

function App() {
    const [route] = useHashRoute();
    // Each page owns its own InteractionManager, so switching pages starts from a clean selection.
    return route === "teams" ? <TeamStatsPage /> : <PlayerStatsPage />;
}

export default App;
