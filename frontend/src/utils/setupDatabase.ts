import { supabase } from './supabase';
import { getAuthenticatedSupabaseClient } from './supabase-helpers';

// Check if the spotify_tokens table exists and create it if it doesn't
export async function ensureSpotifyTokensTable() {
  try {
    console.log('Checking if spotify_tokens table exists...');
    
    // First try to get an authenticated client
    const { supabase: authenticatedClient, isAuthenticated } = await getAuthenticatedSupabaseClient();
    if (!isAuthenticated) {
      console.error('Failed to get authenticated Supabase client');
      return {
        success: false,
        message: 'Authentication required to check database structure'
      };
    }
    
    // Check if the table exists by attempting a simple query
    const { error: checkError } = await authenticatedClient
      .from('spotify_tokens')
      .select('count(*)', { count: 'exact', head: true });
    
    // If the error code indicates the table doesn't exist
    if (checkError && checkError.code === '42P01') {
      console.log('spotify_tokens table does not exist, creating it using RPC...');
      
      // Create the table using RPC function
      const { error: createError } = await authenticatedClient.rpc(
        'create_spotify_tokens_table', 
        {}
      );
      
      if (createError) {
        console.error('Failed to create table via RPC:', createError);
        
        // Try the fallback method - calling the Netlify function
        return await callSetupDatabaseFunction();
      }
      
      console.log('Spotify tokens table created successfully via RPC!');
      return {
        success: true,
        message: 'Spotify tokens table created successfully!'
      };
    } else if (checkError) {
      // Some other error occurred
      console.error('Error checking for table existence:', checkError);
      
      // Try the fallback method
      return await callSetupDatabaseFunction();
    }
    
    // Table already exists
    console.log('Spotify tokens table already exists.');
    return {
      success: true,
      message: 'Spotify tokens table already exists.'
    };
  } catch (error) {
    console.error('Database setup check failed:', error);
    
    // Try the fallback method
    return await callSetupDatabaseFunction();
  }
}

// Fallback method to call Netlify function for setting up the database
async function callSetupDatabaseFunction() {
  try {
    console.log('Attempting to create table via Netlify function...');
    const response = await fetch('/.netlify/functions/setup-database');
    
    if (!response.ok) {
      console.error(`Netlify function returned status: ${response.status}`);
      return {
        success: false,
        message: `Setup function failed with status: ${response.status}`
      };
    }
    
    const result = await response.json();
    console.log('Netlify function result:', result);
    
    return {
      success: result.success,
      message: result.message || 'Database setup completed'
    };
  } catch (error) {
    console.error('Error calling setup database function:', error);
    return {
      success: false,
      message: 'Failed to set up database via functions API.'
    };
  }
}
