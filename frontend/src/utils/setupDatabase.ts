import { getAuthenticatedSupabaseClient } from './supabase-helpers';
import { checkTokenReadiness } from './tokenReadiness';

// Availability only. Schema provisioning belongs to an authorized migration.
export async function ensureSpotifyTokensTable() {
  try {
    const { supabase: client, isAuthenticated } = await getAuthenticatedSupabaseClient();
    if (!isAuthenticated) return { success: false, message: 'Please log in before connecting Spotify.' };
    return await checkTokenReadiness(() => client.from('spotify_tokens').select('id').limit(0));
  } catch {
    return { success: false, message: 'The database could not be reached. Please try again later.' };
  }
}
