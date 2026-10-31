// API utility for QueueBeats
import { supabase } from './utils/supabase';

// API URL is now handled in the api.ts module
// Use baseUrl parameter instead when needed

type ApiResponse = {
  success: boolean;
  message?: string;
  data?: any;
  test_user?: {
    email: string;
    password: string;
    queue_access_code: string;
  };
};

const brain = {
  // Setup database tables
  setup_database: async ({ baseUrl = '' } = {}): Promise<Response> => {
    return fetch(`${baseUrl}/routes/setup/database`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
  },

  // Create test data
  create_test_data: async ({ baseUrl = '' } = {}): Promise<Response> => {
    return fetch(`${baseUrl}/routes/setup/test-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
  },

  // Helper to check API status
  check_status: async ({ baseUrl = '' } = {}): Promise<Response> => {
    return fetch(`${baseUrl}/debug/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
  },

  // Get Spotify configuration from backend
  get_spotify_config: async ({ baseUrl = '' } = {}): Promise<Response> => {
    return fetch(`${baseUrl}/routes/spotify/config`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });
  },

  // Exchange authorization code for Spotify token
  exchange_code_for_token: async (data: { code: string; redirect_uri: string }, { baseUrl = '' } = {}): Promise<Response> => {
    try {
      // Get the current session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('No active session found for token exchange');
        throw new Error('Authentication required');
      }
      
      const response = await fetch(`${baseUrl}/apis/spotify_auth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          code: data.code,
          redirect_uri: data.redirect_uri
        })
      });
      
      return response;
    } catch (error) {
      console.error('Error exchanging code for token:', error);
      throw error;
    }
  },

  // Refresh Spotify access token
  refresh_token: async (data: { refresh_token: string }, { baseUrl = '' } = {}): Promise<Response> => {
    try {
      if (!data.refresh_token) {
        console.error('Missing refresh token for Spotify token refresh');
        throw new Error('Missing refresh token');
      }
      
      // Get the current user session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('No active session found for token refresh');
        throw new Error('Authentication required');
      }
      
      const response = await fetch(`${baseUrl}/apis/spotify_auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          refresh_token: data.refresh_token
        })
      });
      
      return response;
    } catch (error) {
      console.error('Error refreshing Spotify token:', error);
      throw error;
    }
  },

  // New version of refresh token with support for user_id
  refresh_spotify_token: async (data: { refresh_token: string; user_id?: string }, { baseUrl = '' } = {}): Promise<Response> => {
    try {
      if (!data.refresh_token) {
        console.error('Missing refresh token for Spotify token refresh');
        throw new Error('Missing refresh token');
      }
      
      // Get the current user session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('No active session found for token refresh');
        throw new Error('Authentication required');
      }
      
      const response = await fetch(`${baseUrl}/apis/spotify_auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          refresh_token: data.refresh_token,
          user_id: data.user_id
        })
      });
      
      return response;
    } catch (error) {
      console.error('Error refreshing Spotify token:', error);
      throw error;
    }
  },

  // Get Spotify tokens for a user
  get_user_spotify_tokens: async ({ baseUrl = '' } = {}): Promise<Response> => {
    try {
      // Get the current user session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Error fetching user session:', sessionError);
        return {
          ok: false,
          status: 401,
          statusText: 'Authentication error: ' + sessionError.message
        };
      }
      
      if (!session || !session.user) {
        console.error('No active session found for token request');
        return {
          ok: false,
          status: 401,
          statusText: 'Authentication required'
        };
      }
      
      const userId = session.user.id;
      
      if (!userId) {
        console.error('User ID is missing from session');
        return {
          ok: false,
          status: 400,
          statusText: 'Missing user ID'
        };
      }
      
      console.log('Fetching Spotify tokens for user:', userId);
      
      const response = await fetch(`${baseUrl}/apis/spotify_auth/tokens/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          console.log('No tokens found for user:', userId);
          // Return a structured response with empty tokens instead of an error
          return new Response(JSON.stringify({
            success: true,
            spotify_access_token: '',
            spotify_refresh_token: '',
            expires_at: 0,
            has_expired: true,
            message: 'User not connected to Spotify'
          }), {
            status: 200,
            headers: {
              'Content-Type': 'application/json'
            }
          });
        }
        
        console.error(`Failed to fetch tokens: ${response.status} ${response.statusText}`);
      }
      
      return response;
    } catch (error) {
      console.error('Error getting user Spotify tokens:', error);
      return {
        ok: false,
        status: 500,
        statusText: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  // Search Spotify for tracks
  search_spotify_tracks: async (query: string, userId?: string, limit: number = 10, { baseUrl = '' } = {}): Promise<Response> => {
    try {
      // Get config variables
      const useNetlifyFunctions = import.meta.env.VITE_USE_NETLIFY_FUNCTIONS === 'true';
      
      // Get the base URL from environment or use the provided one
      const apiBaseUrl = baseUrl || import.meta.env.VITE_API_URL || '';
      
      // Create the endpoint URL
      let endpointUrl = '';
      if (useNetlifyFunctions) {
        endpointUrl = `${apiBaseUrl}/.netlify/functions/spotify-search?query=${encodeURIComponent(query)}&limit=${limit}`;
      } else {
        // The correct endpoint follows the pattern of /routes/{module_name}/{router_prefix}/{endpoint}
        // From backend/app/apis/spotify_search/__init__.py we see:
        // router = APIRouter()
        // @router.get("/spotify/search", ...)
        endpointUrl = `${apiBaseUrl}/routes/spotify_search/spotify/search?query=${encodeURIComponent(query)}&limit=${limit}`;
      }
      
      console.log('Spotify search URL:', endpointUrl);
      
      // Make the request
      try {
        const response = await fetch(endpointUrl);
        
        if (!response.ok) {
          // If we're getting a 401 Unauthorized, it might be a token issue
          if (response.status === 401 || response.status === 403) {
            console.warn('Authentication issue with Spotify search. Tokens might be expired.');
            // Could attempt to refresh tokens here
          }
          
          console.error('Spotify search failed:', response.status, response.statusText);
          
          // Try to get the error details for debugging
          let errorDetails = '';
          try {
            errorDetails = await response.text();
            console.error('Spotify search error details:', errorDetails);
          } catch (textError) {
            console.error('Could not read error details:', textError);
          }
          
          // Return empty results
          return new Response(JSON.stringify({ 
            error: 'Failed to search for tracks',
            message: 'Spotify search failed',
            timestamp: new Date().toISOString(),
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        const data = await response.json();
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (fetchError) {
        console.error('Network error in spotify_search:', fetchError);
        
        // Return empty results
        return new Response(JSON.stringify({ 
          error: 'Failed to search for tracks',
          message: 'Network error: ' + (fetchError instanceof Error ? fetchError.message : String(fetchError)),
          timestamp: new Date().toISOString(),
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } catch (error) {
      console.error('Unexpected error in spotify_search:', error);
      return new Response(JSON.stringify({ 
        error: 'Failed to search for tracks',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  // Add a song to a queue
  add_song_to_queue: async (data: { queue_id: string, song: any, user_id: string }, { baseUrl = '', uuid_format = true } = {}): Promise<Response> => {
    try {
      // Validate parameters
      if (!data.queue_id) {
        throw new Error('queue_id is required');
      }
      
      if (!data.song) {
        throw new Error('song object is required');
      }
      
      if (!data.user_id) {
        throw new Error('user_id is required');
      }
      
      // Check if queue_id is a valid UUID (required by the backend)
      if (uuid_format) {
        // Simple regex to validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        
        if (!uuidRegex.test(data.queue_id)) {
          console.error('Invalid queue_id format:', data.queue_id);
          console.error('The queue_id must be a valid UUID format (e.g., 123e4567-e89b-12d3-a456-426614174000)');
          
          return new Response(
            JSON.stringify({
              error: 'Invalid queue_id format',
              message: 'The queue_id must be a valid UUID format',
              detail: 'Required format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
            }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        }
      }
      
      // Prepare song_id - for the mock backend, we just need a simple ID that exists in the backend
      // The mock backend has song IDs like "1", "2", "3"
      let song_id = data.song.id || "1"; // Default to "1" if no ID provided
      
      // Prepare the request data
      const request_data = {
        queue_id: data.queue_id,
        song_id: song_id,
        user_id: data.user_id
      };
      
      console.log(`Adding song to queue. Queue ID: ${data.queue_id}, Song ID: ${song_id}, User ID: ${data.user_id}`);
      
      // Get the current user session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('Error getting session:', sessionError);
        throw new Error(`Authentication error: ${sessionError.message}`);
      }
      
      if (!session) {
        console.error('No active session found for adding song to queue');
        throw new Error('Authentication required');
      }
      
      // Determine the API endpoint to use
      const useNetlifyFunctions = import.meta.env.VITE_USE_NETLIFY_FUNCTIONS === 'true';
      
      // Get the base URL from environment or use the provided one
      const apiBaseUrl = baseUrl || import.meta.env.VITE_API_URL || '';
      console.log('Using API base URL:', apiBaseUrl);
      
      // The correct endpoint path based on the OpenAPI documentation
      // The actual structure is /routes/{module_name}/{module_name}/{endpoint}
      let apiEndpoint = '/routes/songs/songs/add';
      
      if (useNetlifyFunctions) {
        console.log('Using Netlify Functions for add_song_to_queue');
        apiEndpoint = '/.netlify/functions/songs-add';
      }
      
      // Log the API request details for debugging
      console.log('Using auth token for API request:', session.access_token ? 'Token available' : 'No token');
      
      const fullUrl = `${apiBaseUrl}${apiEndpoint}`;
      console.log('Sending add song request to:', fullUrl);
      
      // Add additional debugging
      console.log('Request payload:', JSON.stringify(request_data, null, 2));
      
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(request_data),
      });
      
      if (!response.ok) {
        console.error('Error response from add_song_to_queue:', {
          status: response.status,
          statusText: response.statusText,
          url: response.url
        });
        
        // Try to get more details from the response
        try {
          const errorText = await response.text();
          console.error('Error details:', errorText);
        } catch (readError) {
          console.error('Could not read error details:', readError);
        }
      } else {
        console.log('Successfully added song to queue:', response.status);
      }
      
      return response;
    } catch (error) {
      console.error('Error adding song to queue:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Network error', 
          message: error instanceof Error ? error.message : 'Failed to connect to API server'
        }),
        { 
          status: 500, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }
  }
};

export default brain;
