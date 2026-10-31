// Spotify API integration utility functions
import { supabase } from './supabase';
import { getAuthenticatedSupabaseClient, ensureValidSession, storeInSupabase } from './supabase-helpers';
import brain from '../brain';

// Constants
const SPOTIFY_AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

// This should match the redirect URI registered in the Spotify Developer Dashboard
export const REDIRECT_URI = `${window.location.origin}/auth/callback`;

// These scopes allow for playback control and reading user library
const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-library-read',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing'
];

// Utility function to encode query parameters
export const encodeQueryParams = (params: Record<string, string>) => {
  return Object.keys(params)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');
};

// Get Spotify configuration from backend or environment variables
export const getSpotifyConfig = async () => {
  try {
    console.log('Getting Spotify config...');
    
    // First try to get from environment variables (Vite exposes these with VITE_ prefix)
    const envClientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
    
    if (envClientId) {
      console.log('Using Spotify client ID from environment variables');
      return {
        client_id: envClientId,
        redirect_uri: REDIRECT_URI
      };
    }
    
    // Otherwise try the backend
    try {
      console.log('Fetching Spotify config from backend...');
      const response = await brain.get_spotify_config();
      
      // Check if the response is ok
      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Spotify config received from backend:', data);
      return data;
    } catch (error) {
      console.warn('Error fetching Spotify config from backend, using fallback:', error);
      
      // Fallback to hardcoded values if all else fails
      return {
        client_id: '1e4146465422449f9cf6cda11b2382d5', // Hardcoded from .env.example
        redirect_uri: REDIRECT_URI
      };
    }
  } catch (error) {
    console.error('Error getting Spotify config:', error);
    throw error;
  }
};

// Generate the authorization URL for Spotify login
export const getAuthUrl = async () => {
  try {
    const config = await getSpotifyConfig();
    
    const params = {
      client_id: config.client_id,
      response_type: 'code',
      redirect_uri: REDIRECT_URI,
      scope: SCOPES.join(' '),
      show_dialog: 'true' // Force the user to approve the app again
    };

    return `${SPOTIFY_AUTH_ENDPOINT}?${encodeQueryParams(params)}`;
  } catch (error) {
    console.error('Error generating auth URL:', error);
    throw error;
  }
};

// Exchange authorization code for access token
export const getAccessToken = async (code: string) => {
  try {
    console.log('Exchanging authorization code for token...');
    
    // First try to exchange through the backend
    try {
      const response = await brain.exchange_code_for_token({
        code,
        redirect_uri: REDIRECT_URI
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Token exchange API error:', response.status, errorText);
        throw new Error(`Failed to exchange token: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Token exchange successful via backend');
      return data;
    } catch (backendError) {
      // The client secret lives only in the spotify-token Netlify function; there is no browser fallback.
      console.error('Token exchange failed:', backendError);
      throw backendError;
    }
  } catch (error) {
    console.error('Error exchanging token:', error);
    throw error;
  }
};

// Alias for getAccessToken to maintain API compatibility
export const exchangeCodeForToken = getAccessToken;

// Store Spotify tokens in Supabase
export async function storeSpotifyTokens(tokens: SpotifyTokens): Promise<boolean> {
  try {
    // Get the user id from the session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Error fetching user session:', sessionError);
      return false;
    }
    
    if (!session || !session.user) {
      console.error('No active session found when trying to store Spotify tokens');
      return false;
    }
    
    const userId = session.user.id;
    
    if (!userId) {
      console.error('User ID is undefined or invalid:', userId);
      return false;
    }
    
    const { error } = await supabase.from('spotify_tokens').upsert({
      user_id: userId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: tokens.expires_at
    }, {
      onConflict: 'user_id'
    });
    
    if (error) {
      console.error('Error storing spotify tokens:', error);
      return false;
    }
    
    console.log('Successfully stored Spotify tokens for user:', userId);
    return true;
  } catch (error) {
    console.error('Unexpected error in storeSpotifyTokens:', error);
    return false;
  }
}

// Get user's Spotify tokens from Supabase
export async function getUserSpotifyTokens(): Promise<SpotifyTokens | null> {
  try {
    // Get the current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('Error fetching user session:', sessionError);
      return null;
    }
    
    if (!session || !session.user) {
      console.warn('No active session found when trying to get Spotify tokens');
      return null;
    }
    
    const userId = session.user.id;
    
    if (!userId) {
      console.error('User ID is undefined or invalid:', userId);
      return null;
    }
    
    console.log('Getting Spotify tokens for user ID:', userId);
    
    // Query the database for the user's spotify tokens
    try {
      const { data, error } = await supabase
        .from('spotify_tokens')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error) {
        // Handle the specific case where no tokens exist yet
        if (error.code === 'PGRST116') {
          console.info(`User ${userId} has not connected to Spotify yet.`);
          // Return null to indicate no tokens exist (not an error)
          return null;
        }
        
        // For other errors, log and return null
        console.error('Error fetching spotify tokens:', error);
        return null;
      }
      
      if (!data) {
        console.warn('No Spotify tokens found for user:', userId);
        return null;
      }
      
      const tokens: SpotifyTokens = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at
      };
      
      return tokens;
    } catch (dbError) {
      console.error('Database error in getUserSpotifyTokens:', dbError);
      return null;
    }
  } catch (error) {
    console.error('Unexpected error in getUserSpotifyTokens:', error);
    return null;
  }
}

// Refresh expired Spotify access token
export const refreshSpotifyToken = async (refreshToken: string, userId?: string) => {
  // Validate inputs
  if (!refreshToken) {
    console.error("refreshSpotifyToken: Missing refresh token");
    return {
      success: false,
      error: "Missing refresh token",
      data: null
    };
  }

  try {
    console.log("Attempting to refresh Spotify access token...");
    
    // First ensure we have a valid session if we need to update the database
    if (userId) {
      const sessionValid = await ensureValidSession();
      if (!sessionValid) {
        console.warn("refreshSpotifyToken: No valid Supabase session available");
        // We can still try to refresh the token even without session, but we won't be able to save it
      }
    }
    
    // First try to refresh through the backend
    try {
      console.log("Refreshing token through backend API...");
      const response = await brain.refresh_spotify_token({
        refresh_token: refreshToken
      });
      
      // Check if the response is ok
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Token refresh API error:", response.status, errorText);
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log("Token refresh successful via backend");
      
      // Store the new tokens if we have a user ID
      if (userId && data.access_token) {
        await storeSpotifyTokens({
          access_token: data.access_token,
          refresh_token: data.refresh_token || refreshToken,
          expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 3600)
        });
      }
      
      return {
        success: true,
        data: {
          access_token: data.access_token,
          refresh_token: data.refresh_token || refreshToken,
          expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 3600)
        },
        error: null
      };
    } catch (backendError) {
      // The client secret lives only in the spotify-token Netlify function; there is no browser fallback.
      console.error("Token refresh failed:", backendError);
      return {
        success: false,
        error: `Token refresh failed: ${backendError instanceof Error ? backendError.message : String(backendError)}`,
        data: null
      };
    }
  } catch (error) {
    console.error("Exception in refreshSpotifyToken:", error instanceof Error ? error.message : String(error));
    return {
      success: false,
      error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
      data: null
    };
  }
};

// Get a valid Spotify access token (refreshes if necessary)
export const getValidSpotifyToken = async (userId: string): Promise<string | null> => {
  if (!userId) {
    console.error("getValidSpotifyToken: Missing userId parameter");
    return null;
  }

  try {
    // Get tokens with enhanced error handling
    const tokensResult = await getUserSpotifyTokens();
    
    if (!tokensResult) {
      console.warn(`Could not get Spotify tokens for user ${userId}: Unknown error`);
      return null;
    }
    
    const { access_token, refresh_token, expires_at } = tokensResult;
    
    // Check if token is expired
    const now = Math.floor(Date.now() / 1000);
    
    if (expires_at && now >= expires_at) {
      console.log('Spotify token expired, refreshing...');
      
      // Refresh token
      const refreshResult = await refreshSpotifyToken(refresh_token, userId);
      
      if (refreshResult.success && refreshResult.data) {
        return refreshResult.data.access_token;
      } else {
        console.warn(`Failed to refresh Spotify token: ${refreshResult.error || 'Unknown error'}`);
        return null;
      }
    } else {
      // Token is valid
      return access_token;
    }
  } catch (error) {
    console.error('Error getting valid Spotify token:', error instanceof Error ? error.message : String(error));
    return null;
  }
};

// Check if the user is connected to Spotify
export const isConnectedToSpotify = async (userId: string): Promise<boolean> => {
  if (!userId) {
    console.error("isConnectedToSpotify: Missing userId parameter");
    return false;
  }
  
  try {
    // Get the tokens with enhanced error handling
    const tokensResult = await getUserSpotifyTokens();
    
    if (!tokensResult) {
      console.info(`User ${userId} is not connected to Spotify (no tokens found)`);
      return false;
    }
    
    // The user is considered connected if they have both tokens
    const hasAccessToken = !!tokensResult.access_token;
    const hasRefreshToken = !!tokensResult.refresh_token;
    
    const isConnected = Boolean(hasAccessToken && hasRefreshToken);
    console.info(`User ${userId} Spotify connection status: ${isConnected ? 'connected' : 'not connected'}`);
    
    return isConnected;
  } catch (error) {
    console.error("Error in isConnectedToSpotify:", error instanceof Error ? error.message : String(error));
    return false;
  }
};

// Get currently playing track from Spotify API
export const getCurrentTrack = async (accessToken: string) => {
  try {
    const response = await fetch(`${SPOTIFY_API_BASE}/me/player/currently-playing`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });
    
    if (response.status === 204) {
      // No track currently playing
      return null;
    }
    
    if (!response.ok) {
      throw new Error(`Failed to get current track: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error getting current track:', error);
    return null;
  }
};

// Play a track using Spotify API
export const playTrack = async (accessToken: string, uri: string, deviceId?: string) => {
  try {
    let endpoint = `${SPOTIFY_API_BASE}/me/player/play`;
    if (deviceId) {
      endpoint += `?device_id=${deviceId}`;
    }
    
    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        uris: [uri]
      })
    });
    
    if (!response.ok && response.status !== 204) {
      const errorDetails = await response.json().catch(() => ({}));
      console.error('Play track error details:', errorDetails);
      throw new Error(`Failed to play track: ${response.statusText}`);
    }
    
    return true;
  } catch (error) {
    console.error('Error playing track:', error);
    return false;
  }
};

// Pause playback using Spotify API
export const pausePlayback = async (accessToken: string, deviceId?: string) => {
  try {
    let endpoint = `${SPOTIFY_API_BASE}/me/player/pause`;
    if (deviceId) {
      endpoint += `?device_id=${deviceId}`;
    }
    
    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok && response.status !== 204) {
      throw new Error(`Failed to pause playback: ${response.statusText}`);
    }
    
    return true;
  } catch (error) {
    console.error('Error pausing playback:', error);
    return false;
  }
};

// Skip to next track using Spotify API
export const skipToNext = async (accessToken: string, deviceId?: string) => {
  try {
    let endpoint = `${SPOTIFY_API_BASE}/me/player/next`;
    if (deviceId) {
      endpoint += `?device_id=${deviceId}`;
    }
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok && response.status !== 204) {
      throw new Error(`Failed to skip to next track: ${response.statusText}`);
    }
    
    return true;
  } catch (error) {
    console.error('Error skipping to next track:', error);
    return false;
  }
};

// Skip to previous track using Spotify API
export const skipToPrevious = async (accessToken: string, deviceId?: string) => {
  try {
    let endpoint = `${SPOTIFY_API_BASE}/me/player/previous`;
    if (deviceId) {
      endpoint += `?device_id=${deviceId}`;
    }
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok && response.status !== 204) {
      throw new Error(`Failed to skip to previous track: ${response.statusText}`);
    }
    
    return true;
  } catch (error) {
    console.error('Error skipping to previous track:', error);
    return false;
  }
};

// Get available devices using Spotify API
export const getAvailableDevices = async (accessToken: string) => {
  try {
    const response = await fetch(`${SPOTIFY_API_BASE}/me/player/devices`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get available devices: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.devices;
  } catch (error) {
    console.error('Error getting available devices:', error);
    return [];
  }
};

// Transfer playback to a specific device
export const transferPlayback = async (accessToken: string, deviceId: string) => {
  try {
    const response = await fetch(`${SPOTIFY_API_BASE}/me/player`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        device_ids: [deviceId],
        play: true
      })
    });
    
    if (!response.ok && response.status !== 204) {
      throw new Error(`Failed to transfer playback: ${response.statusText}`);
    }
    
    return true;
  } catch (error) {
    console.error('Error transferring playback:', error);
    return false;
  }
};

// Check if running in Netlify environment
export const isNetlifyEnvironment = () => {
  // Always use Netlify functions when explicitly enabled
  if (import.meta.env.VITE_USE_NETLIFY_FUNCTIONS === 'true') {
    return true;
  }
  
  // Also detect Netlify deployment environment
  return window.location.hostname.includes('netlify.app') || 
         window.location.hostname === 'queuebeats.netlify.app';
};

// Get the base URL for Spotify API requests
export const getSpotifyApiBaseUrl = () => {
  if (isNetlifyEnvironment()) {
    return `${window.location.origin}/spotify`;
  }
  return SPOTIFY_API_BASE;
};

// Search for a track on Spotify
export const searchTracks = async (accessToken: string, query: string) => {
  try {
    if (!accessToken) {
      console.error('No access token provided for searchTracks');
      return [];
    }

    // Create query parameters
    const params = encodeQueryParams({
      query,
      type: 'track',
      limit: '10'
    });
    
    // Determine which endpoint to use
    const baseUrl = getSpotifyApiBaseUrl();
    const url = `${baseUrl}/search?${params}`;
    
    console.log(`Searching tracks with URL: ${url}`);
    
    // Make the request
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to search for track: ${response.status} - ${errorText}`);
      throw new Error(`Failed to search for track: ${response.status} - ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Handle different response formats
    if (data.tracks && data.tracks.items) {
      console.log(`Search returned ${data.tracks.items.length} tracks`);
      return data.tracks.items;
    } else if (Array.isArray(data)) {
      console.log(`Search returned ${data.length} tracks (array format)`);
      return data;
    } else {
      console.warn('Unexpected search response format:', data);
      return [];
    }
  } catch (error) {
    console.error('Error searching for track:', error);
    
    // Add retries for certain errors
    if (error instanceof Error && 
        (error.message.includes('404') || error.message.includes('Failed to fetch'))) {
      console.log('Attempting to retry search with fallback method...');
      return retrySearchTracksWithFallback(accessToken, query);
    }
    
    return [];
  }
};

// Fallback method for searching tracks (direct Spotify API)
export const retrySearchTracksWithFallback = async (accessToken: string, query: string) => {
  try {
    const params = encodeQueryParams({
      q: query,
      type: 'track',
      limit: '10'
    });
    
    // Always use direct Spotify API for fallback
    const response = await fetch(`https://api.spotify.com/v1/search?${params}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Fallback search failed: ${response.status} - ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.tracks.items;
  } catch (error) {
    console.error('Fallback search also failed:', error);
    return [];
  }
};

// Get user's Spotify access token for Edge Functions
export const getSpotifyAccessTokenForApi = async (userId: string): Promise<string | null> => {
  if (!userId) {
    console.error("getSpotifyAccessTokenForApi: Missing userId parameter");
    return null;
  }

  try {
    // First try to get tokens from our getUserSpotifyTokens function
    console.debug(`Getting Spotify tokens for Edge Function API call (userId: ${userId})`);
    const tokensResult = await getUserSpotifyTokens();
    
    if (!tokensResult) {
      console.warn(`Could not get Spotify tokens for Edge Function: Unknown error`);
      return null;
    }
    
    const { access_token, refresh_token, expires_at } = tokensResult;
    
    // Check if token is expired
    const now = Math.floor(Date.now() / 1000);
    
    if (expires_at && now >= expires_at) {
      console.log('Spotify token expired, refreshing for Edge Function...');
      
      // Refresh token
      const refreshResult = await refreshSpotifyToken(refresh_token, userId);
      
      if (refreshResult.success && refreshResult.data) {
        console.debug('Successfully refreshed token for Edge Function');
        return refreshResult.data.access_token;
      } else {
        console.warn(`Failed to refresh Spotify token for Edge Function: ${refreshResult.error || 'Unknown error'}`);
        return null;
      }
    } else {
      // Token is valid
      console.debug('Using existing valid Spotify token for Edge Function');
      return access_token;
    }
  } catch (error) {
    console.error('Error getting Spotify access token for API:', error instanceof Error ? error.message : String(error));
    return null;
  }
};

// Spotify Web Playback SDK initialization
let spotifyPlayer: any = null;
let deviceId: string | null = null;

// Initialize Spotify Web Playback SDK
export const initializePlayer = (token: string) => {
  return new Promise<string>((resolve, reject) => {
    // Check if Spotify is already loaded
    if (window.Spotify) {
      createPlayer(token, resolve, reject);
      return;
    }
    
    // Load Spotify Player script
    const script = document.createElement('script');
    script.src = 'https://sdk.scdn.co/spotify-player.js';
    script.async = true;
    
    script.onload = () => {
      // Wait for Spotify to be ready
      window.onSpotifyWebPlaybackSDKReady = () => {
        createPlayer(token, resolve, reject);
      };
    };
    
    script.onerror = (error) => {
      reject('Failed to load Spotify Web Playback SDK');
    };
    
    document.body.appendChild(script);
  });
};

// Create the Spotify player instance
const createPlayer = (token: string, resolve: (deviceId: string) => void, reject: (reason: any) => void) => {
  spotifyPlayer = new window.Spotify.Player({
    name: 'QueueBeats Player',
    getOAuthToken: (cb: (token: string) => void) => { cb(token); },
    volume: 0.5
  });
  
  // Error handling
  spotifyPlayer.addListener('initialization_error', ({ message }: { message: string }) => {
    console.error('Initialization error:', message);
    reject(message);
  });
  
  spotifyPlayer.addListener('authentication_error', ({ message }: { message: string }) => {
    console.error('Authentication error:', message);
    reject(message);
  });
  
  spotifyPlayer.addListener('account_error', ({ message }: { message: string }) => {
    console.error('Account error:', message);
    reject(message);
  });
  
  spotifyPlayer.addListener('playback_error', ({ message }: { message: string }) => {
    console.error('Playback error:', message);
  });
  
  // Ready event
  spotifyPlayer.addListener('ready', ({ device_id }: { device_id: string }) => {
    console.log('Ready with Device ID', device_id);
    deviceId = device_id;
    resolve(device_id);
  });
  
  // Not ready event
  spotifyPlayer.addListener('not_ready', ({ device_id }: { device_id: string }) => {
    console.log('Device ID has gone offline', device_id);
    deviceId = null;
  });
  
  // Connect to the player
  spotifyPlayer.connect();
};

// Get the current device ID
export const getPlayerDeviceId = () => deviceId;

// Disconnect the player
export const disconnectPlayer = () => {
  if (spotifyPlayer) {
    spotifyPlayer.disconnect();
    spotifyPlayer = null;
    deviceId = null;
  }
};

// Check if the player is connected
export const isPlayerConnected = () => {
  return !!spotifyPlayer && !!deviceId;
};

// Toggle play/pause
export const togglePlayback = async (accessToken: string) => {
  if (!spotifyPlayer) return false;
  
  return await spotifyPlayer.togglePlay();
};

// Play a specific track via the SDK player
export const playTrackOnPlayer = async (accessToken: string, uri: string) => {
  if (!deviceId) return false;
  
  return await playTrack(accessToken, uri, deviceId);
};

declare global {
  interface Window {
    Spotify: any;
    onSpotifyWebPlaybackSDKReady: () => void;
  }
}
