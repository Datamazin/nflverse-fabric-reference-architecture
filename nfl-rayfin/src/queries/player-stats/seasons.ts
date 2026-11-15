import type { ColumnMetadataMap } from "@/lib/to-data-table";
import { connection } from "./season-filter";
import query from "./seasons.dax?raw";

/** Every season / season-type pair with player stats, newest first. At most ~60 rows. */
export const seasons = {
    connection,
    query,
    columnMetadata: {
        "Player Season Summary[season]": { name: "Season", displayName: "Season" },
        "Player Season Summary[season_type]": { name: "SeasonType", displayName: "Season Type" },
    } satisfies ColumnMetadataMap,
};
