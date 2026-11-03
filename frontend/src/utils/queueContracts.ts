import type { Database } from './database.types';

export interface SongInput {
  id?: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  duration_ms?: number;
  track_uri?: string;
  spotify_uri?: string;
  cover_url?: string;
}

/** Translate search API fields into the schema declared in supabase-schema.sql. */
export function songInsert(queueId: string, song: SongInput, userId: string): Database['public']['Tables']['songs']['Insert'] {
  if (!userId) throw new Error('Authentication required to add a song');
  return {
    queue_id: queueId, title: song.title, artist: song.artist,
    album: song.album, cover_url: song.cover_url,
    track_uri: song.track_uri ?? song.spotify_uri ?? null,
    duration: song.duration ?? song.duration_ms ?? 0,
    added_by: userId,
  };
}
