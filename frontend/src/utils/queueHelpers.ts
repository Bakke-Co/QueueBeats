import { supabase, loadSupabaseConfig } from './supabase';
import { getAuthenticatedSupabaseClient, ensureValidSession } from './supabase-helpers';
import type { Database } from './database.types';
import { songInsert, type SongInput } from './queueContracts';

export type Queue = Omit<Database['public']['Tables']['queues']['Row'], 'settings'> & { settings: Partial<QueueSettings> | null };
export type Song = Database['public']['Tables']['songs']['Row'];
export type Vote = Database['public']['Tables']['votes']['Row'];

export type QueueSettings = {
  isPublic: boolean;
  allowGuestAddSongs: boolean;
  maxVotesPerUser?: number;
  requireApproval?: boolean;
};

// Remove a song from the queue
export const removeSongFromQueue = async (songId: string) => {
  try {
    const { data, error } = await supabase
      .from('songs')
      .delete()
      .eq('id', songId)
      .select()
      .single();
    
    if (error) throw error;
    return data as Song;
  } catch (error) {
    console.error('Error removing song from queue:', error);
    throw error;
  }
};

// Update song position in queue
export const updateSongPosition = async (songId: string, position: number) => {
  try {
    const { data, error } = await supabase
      .from('songs')
      .update({ position })
      .eq('id', songId)
      .select()
      .single();
    
    if (error) throw error;
    return data as Song;
  } catch (error) {
    console.error('Error updating song position:', error);
    throw error;
  }
};

// Get recently played songs
export const getRecentlyPlayedSongs = async (queueId: string, limit: number = 5) => {
  try {
    const { data, error } = await supabase
      .from('songs')
      .select('*')
      .eq('queue_id', queueId)
      .eq('played', true)
      .order('played_at', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data as Song[];
  } catch (error) {
    console.error('Error fetching recently played songs:', error);
    throw error;
  }
};

// Get current playing song (most recently marked as played)
export const getCurrentPlayingSong = async (queueId: string) => {
  try {
    const { data, error } = await supabase
      .from('songs')
      .select('*')
      .eq('queue_id', queueId)
      .eq('played', true)
      .order('played_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error && error.code === 'PGRST116') { // No rows found
      return null;
    }
    
    if (error) throw error;
    return data as Song;
  } catch (error) {
    console.error('Error fetching currently playing song:', error);
    return null;
  }
};

// Create a new queue with robust error handling
export const createQueue = async (
  userId: string, 
  name: string, 
  description?: string, 
  settings?: QueueSettings
) => {
  // Ensure Supabase is initialized
  const ensureSupabaseInitialized = async () => {
    if (!supabase) {
      console.log("Supabase client not available, attempting to initialize...");
      try {
        const success = await loadSupabaseConfig();
        if (!success) {
          throw new Error("Failed to initialize Supabase client");
        }
      } catch (error) {
        console.error("Error initializing Supabase:", error);
        throw new Error("Database connection failed: Could not initialize client");
      }
    }
  };

  try {
    console.log("Creating queue with:", { userId, name, description, settings });
    
    // Validate required fields
    if (!userId) {
      console.error("Invalid userId:", userId);
      throw new Error("User ID is required");
    }
    if (!name) {
      console.error("Invalid name:", name);
      throw new Error("Queue name is required");
    }
    
    // Make sure Supabase is initialized
    await ensureSupabaseInitialized();
    
    // Generate a random 6-digit access code
    const accessCode = Math.floor(100000 + Math.random() * 900000).toString();
    console.log("Generated access code:", accessCode);
    
    // Prepare queue data
    const queueData = {
      name,
      description: description || null,
      creator_id: userId,
      active: true,
      access_code: accessCode,
      settings: settings || { isPublic: true, allowGuestAddSongs: true },
    };
    
    console.log("Inserting queue data:", queueData);
    
    // First attempt
    let response = await supabase
      .from('queues')
      .insert(queueData)
      .select()
      .single();
    
    console.log("Initial queue creation response:", response);
    
    // Safely check if there's a network-related error
    if (response.error && response.error.message && (
      response.error.message.includes('connection') || 
      response.error.message.includes('timeout') ||
      response.error.message.includes('network')
    )) {
      console.log("Got connection error, retrying after delay...");
      
      // Wait for network to stabilize
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Retry the request
      response = await supabase
        .from('queues')
        .insert(queueData)
        .select()
        .single();
      
      console.log("Retry queue creation response:", response);
    }
    
    // Handle final result
    if (response.error) {
      console.error("Supabase error creating queue:", response.error);
      
      // Check if the error is a 404 (table not found)
      if (response.status === 404) {
        throw new Error("The 'queues' table does not exist in the database. Please set up the required database tables first.");
      }
      
      // Try to provide more helpful error messages
      if (response.error.code === '23505') {
        throw new Error("A queue with this name already exists");
      } else if (response.error.code === '23502') {
        throw new Error("Missing required field: " + (response.error.details || response.error.message));
      } else if (response.error.code === '42P01') {
        throw new Error("Database table 'queues' not found. Please check your database setup.");
      } else {
        throw new Error("Failed to create queue: " + (response.error.message || response.statusText || "Unknown error"));
      }
    }
    
    if (!response.data) {
      console.error("No data returned from queue creation");
      throw new Error("Failed to create queue: No data returned");
    }
    
    return response.data as Queue;
  } catch (error: any) {
    console.error('Error creating queue:', error);
    
    // Convert any unknown errors to a readable message
    const errorMessage = error.message || "An unexpected error occurred";
    throw new Error(`Queue creation failed: ${errorMessage}`);
  }
};

// Get all queues for a user
export const getUserQueues = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('queues')
      .select('*')
      .eq('creator_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as Queue[];
  } catch (error) {
    console.error('Error fetching user queues:', error);
    throw error;
  }
};

// Get a queue by ID
export const getQueueById = async (queueId: string) => {
  try {
    // Get authenticated client
    const { supabase: authClient, isAuthenticated } = await getAuthenticatedSupabaseClient();
    
    if (!isAuthenticated) {
      console.warn('Using unauthenticated Supabase client for queue fetch - this may cause 406 errors');
    }
    
    // Use the client with proper auth
    const { data, error } = await authClient
      .from('queues')
      .select('*')
      .eq('id', queueId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        console.warn(`Queue not found with ID: ${queueId}`);
        
        // Try the mock endpoint as fallback
        console.log('Trying mock API as fallback...');
        return await getMockQueueById(queueId);
      }
      
      // For 406 Not Acceptable errors, try the mock API
      if (error.message?.includes('406') || error.code === '406') {
        console.warn('406 Not Acceptable error - falling back to mock API');
        return await getMockQueueById(queueId);
      }
      
      throw error;
    }
    
    return data as Queue;
  } catch (error) {
    console.error('Error fetching queue:', error);
    
    // As a last resort, try the mock API
    try {
      console.log('Error occurred fetching from Supabase, trying mock API as fallback...');
      return await getMockQueueById(queueId);
    } catch (mockError) {
      console.error('Mock API fallback also failed:', mockError);
      throw error; // Throw the original error
    }
  }
};

// Fetch from mock API endpoint
export const getMockQueueById = async (queueId: string): Promise<Queue> => {
  try {
    // Get current user ID if possible
    let userId = null;
    try {
      const { data } = await supabase.auth.getUser();
      userId = data.user?.id;
    } catch (e) {
      console.warn('Could not get user ID for mock API:', e);
    }
    
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001';
    const url = `${apiUrl}/routes/debug/debug/mock-queue/${queueId}${userId ? `?user_id=${userId}` : ''}`;
    
    console.log(`Fetching mock queue from: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Mock API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Mock queue data:', data);
    
    return data as Queue;
  } catch (error) {
    console.error('Error fetching from mock API:', error);
    throw error;
  }
};

// Check if a user has voted for a song
export const hasUserVotedForSong = async (songId: string, userId: string) => {
  try {
    const { data, error } = await supabase
      .from('votes')
      .select('*')
      .eq('song_id', songId)
      .eq('profile_id', userId)
      .single();
    
    if (error && error.code === 'PGRST116') { // No rows found
      return false;
    }
    
    if (error) throw error;
    return !!data; // Returns true if vote exists
  } catch (error) {
    console.error('Error checking if user voted for song:', error);
    return false; // Default to false on error
  }
};

// Get a queue by access code
export const getQueueByAccessCode = async (accessCode: string) => {
  try {
    const { data, error } = await supabase
      .from('queues')
      .select('*')
      .eq('access_code', accessCode)
      .eq('active', true)
      .single();
    
    if (error) throw error;
    return data as Queue;
  } catch (error) {
    console.error('Error fetching queue by access code:', error);
    throw error;
  }
};

// Add a song to a queue
export const addSongToQueue = async (queueId: string, song: SongInput) => {
  try {
    // Attempt to use the backend API first (recommended)
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001';
      const response = await fetch(`${apiUrl}/routes/songs/songs/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          queue_id: queueId,
          song_data: {
            id: song.id,
            title: song.title,
            artist: song.artist,
            album: song.album,
            cover_url: song.cover_url,
            spotify_uri: song.spotify_uri ?? song.track_uri ?? null,
            duration_ms: song.duration_ms ?? song.duration ?? 0
          }
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Song added via backend API:', data);
        return data;
      } else {
        console.warn(`Backend API error ${response.status}: ${response.statusText}. Trying Supabase direct...`);
        // Continue to try Supabase directly
      }
    } catch (apiError) {
      console.warn('Error using backend API to add song, trying Supabase direct:', apiError);
      // Continue to try Supabase directly
    }

    // If backend API fails, try Supabase directly
    const { supabase: authClient, isAuthenticated, userId } = await getAuthenticatedSupabaseClient();
    
    if (!isAuthenticated || !userId) {
      throw new Error('Authentication required to add a song');
    }
    
    // First check if the queue exists
    const { data: queueData, error: queueError } = await authClient
      .from('queues')
      .select('id')
      .eq('id', queueId)
      .single();
    
    if (queueError || !queueData) {
      console.warn(`Queue check failed or queue not found with ID: ${queueId}`, queueError);
      // Try updating a mock song cache instead
      return await addSongToMockQueue(queueId, song);
    }
    
    // Add the song to the songs table
    const { data, error } = await authClient
      .from('songs')
      .insert(songInsert(queueId, song, userId))
      .select()
      .single();
    
    if (error) {
      console.error('Error adding song to Supabase:', error);
      
      // If Supabase fails, update the mock cache
      return await addSongToMockQueue(queueId, song);
    }
    
    return data;
  } catch (error) {
    console.error('Error adding song to queue:', error);
    
    // Last resort: try adding to mock queue
    try {
      return await addSongToMockQueue(queueId, song);
    } catch (mockError) {
      console.error('Mock API fallback also failed:', mockError);
      throw error; // Throw the original error
    }
  }
};

// Add a song to the mock queue (updates the mock_songs.json file on the backend)
export const addSongToMockQueue = async (queueId: string, song: SongInput) => {
  try {
    // Get current user ID if possible
    let userId = null;
    try {
      const { data } = await supabase.auth.getUser();
      userId = data.user?.id;
    } catch (e) {
      console.warn('Could not get user ID for mock song add:', e);
    }
    
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001';
    const url = `${apiUrl}/routes/debug/debug/add-mock-song`;
    
    console.log(`Adding song to mock queue at: ${url}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        queue_id: queueId,
        song_data: {
          id: song.id || crypto.randomUUID(),
          title: song.title,
          artist: song.artist,
          album: song.album,
          cover_url: song.cover_url,
          added_by: userId || "00000000-0000-0000-0000-000000000000",
          created_at: new Date().toISOString()
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`Mock API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Added song to mock queue:', data);
    
    return data;
  } catch (error) {
    console.error('Error adding song to mock queue:', error);
    throw error;
  }
};

// Vote for a song
export const voteForSong = async (songId: string, userId: string, voteCount: number = 1) => {
  console.log('Voting for song:', { songId, userId, voteCount });
  try {
    // Check if user has already voted for this song
    const { data: existingVote, error: checkError } = await supabase
      .from('votes')
      .select('*')
      .eq('song_id', songId)
      .eq('profile_id', userId)
      .single();
      
    console.log('Existing vote check:', { existingVote, checkError });
    
    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is the "no rows returned" error code
      throw checkError;
    }
    
    // If user has already voted, update the vote count
    if (existingVote) {
      const { data, error } = await supabase
        .from('votes')
        .update({ vote_count: voteCount })
        .eq('id', existingVote.id)
        .select()
        .single();
      
      if (error) throw error;
      return data as Vote;
    }
    
    // Otherwise, create a new vote
    const { data, error } = await supabase
      .from('votes')
      .insert({
        song_id: songId,
        profile_id: userId,
        vote_count: voteCount,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    return data as Vote;
  } catch (error) {
    console.error('Error voting for song:', error);
    throw error;
  }
};

// Get songs in a queue with their vote counts
export const getQueueSongs = async (queueId: string, userId?: string) => {
  try {
    const { data, error } = await supabase
      .from('songs')
      .select(`
        *,
        votes:votes(vote_count, profile_id)
      `)
      .eq('queue_id', queueId)
      .eq('played', false)
      .order('created_at');
    
    if (error) throw error;
    
    // Process the data to calculate total votes and check if user has voted
    const songsWithVotes = data.map(song => {
      const totalVotes = song.votes?.reduce((sum: number, vote: any) => sum + vote.vote_count, 0) || 0;
      
      // Check if the current user has voted for this song
      const userHasVoted = userId ? 
        song.votes?.some((vote: any) => vote.profile_id === userId) : 
        false;
      
      return {
        ...song,
        total_votes: totalVotes,
        user_has_voted: userHasVoted
      };
    });
    
    // Sort by total votes (descending)
    songsWithVotes.sort((a, b) => b.total_votes - a.total_votes);
    
    return songsWithVotes;
  } catch (error) {
    console.error('Error fetching queue songs:', error);
    throw error;
  }
};

// Mark a song as played
export const markSongAsPlayed = async (songId: string) => {
  try {
    const { data, error } = await supabase
      .from('songs')
      .update({
        played: true,
        played_at: new Date().toISOString()
      })
      .eq('id', songId)
      .select()
      .single();
    
    if (error) throw error;
    return data as Song;
  } catch (error) {
    console.error('Error marking song as played:', error);
    throw error;
  }
};
