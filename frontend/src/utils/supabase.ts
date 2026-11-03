import { createClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Check your .env file.');
  throw new Error('Missing required environment variables for Supabase initialization.');
}

console.log('Initializing Supabase client with URL:', supabaseUrl);

// Configure custom fetch with timeout
const timeoutDuration = 15000; // 15 seconds
const customFetch = async (url: RequestInfo, options?: RequestInit) => {
  const controller = new AbortController();
  const signal = controller.signal;
  
  // Setup timeout to abort the request
  const timeoutId = setTimeout(() => {
    controller.abort();
    console.error(`Supabase request timed out after ${timeoutDuration}ms:`, url);
  }, timeoutDuration);
  
  // Merge our signal with any existing options
  const fetchOptions = {
    ...options,
    signal
  };
  
  // Make sure we have headers object
  if (!fetchOptions.headers) {
    fetchOptions.headers = {};
  }
  
  // Try to get current session for authenticated requests
  try {
    // Get the session from storage first
    const storedSession = localStorage.getItem('supabase.auth.token');
    let accessToken = null;
    
    if (storedSession) {
      try {
        const sessionData = JSON.parse(storedSession);
        accessToken = sessionData?.currentSession?.access_token;
      } catch (parseError) {
        console.warn('Could not parse stored session:', parseError);
      }
    }
    
    if (accessToken) {
      // Add the auth token to the request
      Object.assign(fetchOptions.headers, {
        'Authorization': `Bearer ${accessToken}`
      });
    }
  } catch (error) {
    console.warn('Could not add auth token to request:', error);
  }
  
  // Add headers to ensure 406 Not Acceptable errors don't occur
  Object.assign(fetchOptions.headers, {
    'Prefer': 'return=representation',
    'Accept': 'application/json',
    'apikey': supabaseAnonKey // Always include the API key
  });
  
  // Debug request details
  console.debug(
    `Supabase ${fetchOptions.method || 'GET'} request:`, 
    url.toString().split('?')[0]
  );
  
  return fetch(url, fetchOptions)
    .then(response => {
      clearTimeout(timeoutId);
      return response;
    })
    .catch(error => {
      clearTimeout(timeoutId);
      console.error('Supabase fetch error:', error);
      if (error.name === 'AbortError') {
        throw new Error(`Request timed out after ${timeoutDuration}ms`);
      }
      throw error;
    });
};

// Create the Supabase client with custom fetch and debug flags
export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true, 
      detectSessionInUrl: true,
      storage: localStorage
    },
    global: {
      headers: {
        'Prefer': 'return=representation',
        'Accept': 'application/json'
      },
      fetch: customFetch
    },
    db: {
      schema: 'public'
    },
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    }
  }
);

// Function to add authorization header to Supabase queries
export const getSupabaseWithAuth = async () => {
  // Get the current session token
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    console.warn('No auth session available for Supabase request');
    return supabase;
  }
  
  // Creating a new client with the auth header
  const supabaseWithAuth = createClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      global: {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    }
  );
  
  return supabaseWithAuth;
};

// Helper to get the current user with timeout protection
export const getCurrentUser = async (): Promise<User | null> => {
  try {
    console.log('Checking for current user');
    
    // Create a timeout promise
    const timeoutPromise = new Promise<null>((_, reject) => {
      setTimeout(() => reject(new Error('Get current user timed out after 15 seconds')), 15000);
    });
    
    // Get current user, racing against the timeout
    const { data, error } = await Promise.race([
      supabase.auth.getUser(),
      timeoutPromise.then(() => { throw new Error('Get current user timeout'); })
    ]);
    
    if (error) {
      // AuthSessionMissingError is expected when user isn't logged in - don't log as error
      const isSessionMissing = error.name === 'AuthSessionMissingError' || 
        (error as any).__isAuthError;
      if (!isSessionMissing) {
        console.error('Error getting current user:', error);
      }
      return null;
    }
    
    if (data?.user) {
      console.log('Current user found:', data.user.id);
    } else {
      console.log('No current user found');
    }
    
    return data?.user || null;
  } catch (error) {
    console.error('Exception in getCurrentUser:', error);
    return null;
  }
};

// Probe the actual configured data service without loading customer rows.
export const loadSupabaseConfig = async (): Promise<boolean> => {
  try {
    const { error } = await supabase.from('profiles').select('id').limit(0);
    return !error;
  } catch { return false; }
};

// This function verifies the supplied configuration; it does not change the shared client.
export const initializeSupabase = async (url: string, key: string): Promise<boolean> => {
  if (!url || !key) return false;
  try {
    const client = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { error } = await client.from('profiles').select('id').limit(0);
    return !error;
  } catch { return false; }
};
