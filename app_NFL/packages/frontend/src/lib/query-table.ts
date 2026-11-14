import type { SemanticModelQueryResult } from '@microsoft/rayfin-connector-fabric-semanticmodel';

type SuccessResult = Extract<SemanticModelQueryResult, { status: 'success' }>;
export type QueryTable = SuccessResult['table'];

/**
 * Collapses the hook's two disjoint failure channels into one user-facing
 * message: `error` is what the connector threw (wiring, transport, auth) and
 * `data.status === 'error'` is what Power BI returned (bad DAX, permissions,
 * overflow). Returns undefined when neither applies.
 */
export function queryProblem(
  error: Error | undefined,
  data: SemanticModelQueryResult | undefined
): string | undefined {
  if (error) return error.message || 'The data service could not be reached.';
  if (data?.status === 'error') {
    const { category, message } = data.error;
    if (category === 'overflow') {
      return 'The result was too large to load. Raise the minimum volume to narrow it.';
    }
    return message || `The model returned a ${category} error.`;
  }
  return undefined;
}

/** Reads one row into an object keyed by the query's exact column names. */
export function rowObjects(
  table: QueryTable
): Record<string, unknown>[] {
  const names = table.columns.map((c) => c.name);
  return table.rows.map((row) => {
    const out: Record<string, unknown> = {};
    const cells = row as readonly unknown[];
    names.forEach((name, i) => {
      out[name] = cells[i];
    });
    return out;
  });
}
