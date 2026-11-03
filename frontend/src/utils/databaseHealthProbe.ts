/** Read-only availability probes for the tables used by the public queue UI.
 * Protected token/settings tables are checked by their authenticated workflows.
 * A missing REST relation, denied access and a failed connection are distinct.
 */
export const PUBLIC_TABLES = ['profiles', 'queues', 'songs', 'votes'] as const;
export type PublicTable = typeof PUBLIC_TABLES[number];
export interface ProbeError { code?: string; message: string }
export interface HealthCheckResult {
  status: 'healthy' | 'missing_tables' | 'error';
  reason?: 'unavailable' | 'access_denied' | 'probe_failed';
  existing_tables?: string[];
  missing_tables?: string[];
  timestamp?: string;
  error?: string;
  message?: string;
}
export async function probeDatabase(
  readTable: (table: PublicTable) => PromiseLike<{ error: ProbeError | null }>,
): Promise<HealthCheckResult> {
  const existing: string[] = [];
  const missing: string[] = [];
  for (const table of PUBLIC_TABLES) {
    let error: ProbeError | null;
    try { ({ error } = await readTable(table)); }
    catch (caught) {
      return { status: 'error', reason: 'unavailable', error: String(caught), message: 'The database could not be reached. Please try again later.' };
    }
    if (!error) { existing.push(table); continue; }
    if (error.code === '42P01' || error.code === 'PGRST205') {
      missing.push(table);
      continue;
    }
    const denied = ['42501', 'PGRST301', 'PGRST302', 'PGRST303'].includes(error.code || '');
    const unavailable = !error.code || /fetch|network|timeout|connection/i.test(error.message);
    return {
      status: 'error',
      reason: denied ? 'access_denied' : unavailable ? 'unavailable' : 'probe_failed',
      error: error.message,
      message: denied ? 'The database refused the connection. Please contact support.'
        : unavailable ? 'The database could not be reached. Please try again later.'
        : 'Database availability could not be verified. Please try again later.',
    };
  }
  return {
    status: missing.length ? 'missing_tables' : 'healthy',
    existing_tables: existing, missing_tables: missing,
    timestamp: new Date().toISOString(),
    message: missing.length ? 'Required application tables are unavailable. Please contact support.' : 'Database connection is available',
  };
}
