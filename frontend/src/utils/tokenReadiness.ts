import type { ProbeError } from './databaseHealthProbe';

export async function checkTokenReadiness(read: () => PromiseLike<{ error: ProbeError | null }>) {
  try {
    const { error } = await read();
    if (!error) return { success: true, message: 'Spotify connection storage is available.' };
    if (['42P01', 'PGRST205'].includes(error.code || '')) {
      return { success: false, message: 'Spotify connection storage is unavailable. Please contact support.' };
    }
    if (['42501', 'PGRST301', 'PGRST302', 'PGRST303'].includes(error.code || '')) {
      return { success: false, message: 'Access to Spotify connection storage was denied. Please sign in again or contact support.' };
    }
    return { success: false, message: 'Spotify connection storage could not be checked. Please try again later.' };
  } catch {
    return { success: false, message: 'The database could not be reached. Please try again later.' };
  }
}
