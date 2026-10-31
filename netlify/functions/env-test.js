// netlify/functions/env-test.js
// A simple function to test environment variable loading
const { loadEnv } = require('./utils/load-env');
const { headers } = require('./utils/cors-headers');

// Load environment variables
loadEnv();

exports.handler = async function(event, context) {
  try {
    // Check for the presence of required environment variables
    const envStatus = {
      SPOTIFY_CLIENT_ID: !!process.env.SPOTIFY_CLIENT_ID,
      SPOTIFY_CLIENT_SECRET: !!process.env.SPOTIFY_CLIENT_SECRET,
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
      BACKEND_PORT: process.env.BACKEND_PORT || '8001',
      FRONTEND_PORT: process.env.FRONTEND_PORT || '5173',
      NODE_ENV: process.env.NODE_ENV || 'development'
    };
    
    // Create a safe version of the environment for display
    // This masks sensitive values while confirming they exist
    const safeEnv = {
      SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID ? 
        `${process.env.SPOTIFY_CLIENT_ID.substring(0, 5)}...${process.env.SPOTIFY_CLIENT_ID.slice(-4)}` : 
        'missing',
      // Presence only: this endpoint is public, so no characters of the secret
      SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET ? 'set' : 'missing',
      SUPABASE_URL: process.env.SUPABASE_URL ? 
        process.env.SUPABASE_URL.split('://')[0] + '://' + process.env.SUPABASE_URL.split('://')[1].substring(0, 10) + '...' : 
        'missing',
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 
        `${process.env.SUPABASE_ANON_KEY.substring(0, 5)}...${process.env.SUPABASE_ANON_KEY.slice(-5)}` : 
        'missing'
    };
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Environment variables test',
        env: envStatus,
        safeEnv,
        loadEnvSuccess: true,
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('Error in env-test function:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to test environment variables',
        message: error.message
      })
    };
  }
};
