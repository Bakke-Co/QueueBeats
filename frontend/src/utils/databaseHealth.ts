// Database health check utilities
import { supabase } from './supabase';
import { getAuthenticatedSupabaseClient } from './supabase-helpers';
import { isNetlifyEnvironment } from './spotify';
// Type definitions
export interface HealthCheckResult {
  status: 'healthy' | 'missing_tables' | 'error';
  existing_tables?: string[];
  missing_tables?: string[];
  timestamp?: string;
  error?: string;
  message?: string;
}

/**
 * Run a comprehensive database health check
 * This will validate that all required tables exist
 */
export async function checkDatabaseHealth(): Promise<HealthCheckResult> {
  try {
    // Always try direct RPC first, only fall back to Netlify as a last resort
    try {
      return await checkDatabaseHealthViaRPC();
    } catch (error) {
      console.warn('Direct RPC health check failed, trying alternative methods:', error);
      
      // Only try Netlify function if explicitly enabled or in production
      if (import.meta.env.VITE_USE_NETLIFY_FUNCTIONS === 'true' || isNetlifyEnvironment()) {
        try {
          return await checkDatabaseHealthViaNetlify();
        } catch (netlifyError) {
          console.warn('Netlify health check failed:', netlifyError);
        }
      }
      
      // Last resort: manual direct check
      return await manualDatabaseCheck();
    }
  } catch (error) {
    console.error('All database health checks failed:', error);
    return {
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      message: 'Database health check failed',
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Check database health via Netlify function
 */
async function checkDatabaseHealthViaNetlify(): Promise<HealthCheckResult> {
  try {
    // Skip Netlify function if disabled
    if (import.meta.env.VITE_USE_NETLIFY_FUNCTIONS !== 'true') {
      console.log('Netlify functions disabled, skipping Netlify health check');
      throw new Error('Netlify functions disabled');
    }

    const { origin } = window.location;
    const netlifyFunctionUrl = `${origin}/.netlify/functions/database-health-check`;
    
    console.log('Checking database health via Netlify function:', netlifyFunctionUrl);
    
    const response = await fetch(netlifyFunctionUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.warn(`Netlify function returned status ${response.status} - falling back to direct check`);
      throw new Error(`Netlify function failed with status ${response.status}`);
    }
    
    // Check if the response is actually JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.warn('Netlify function did not return JSON - falling back to direct check');
      throw new Error('Netlify function did not return JSON');
    }
    
    const result = await response.json();
    
    if (!result.success) {
      console.warn('Netlify function reported failure:', result.error);
      return {
        status: 'error',
        error: result.error || 'Unknown error from Netlify function',
        message: 'Database health check failed'
      };
    }
    
    return result.data;
  } catch (error) {
    console.error('Error checking database health via Netlify:', error);
    
    // Fallback to direct RPC if Netlify function fails
    console.log('Falling back to direct database health check...');
    return await checkDatabaseHealthViaRPC();
  }
}

/**
 * Check database health via direct Supabase RPC call
 */
async function checkDatabaseHealthViaRPC(): Promise<HealthCheckResult> {
  try {
    // Try to get an authenticated client
    const { supabase: authClient, isAuthenticated } = 
      await getAuthenticatedSupabaseClient();
    
    // Use the client we got (authenticated or not)
    const client = isAuthenticated ? authClient : supabase;
    
    // Try to call the database health check function
    const { data, error } = await client.rpc('check_database_health');
    
    if (error) {
      console.error('Error calling database health check function:', error);
      
      // If the function doesn't exist, fall back to manual check
      return await manualDatabaseCheck(client);
    }
    
    return data as unknown as HealthCheckResult;
  } catch (error) {
    console.error('Error in direct database health check:', error);
    
    // Fallback to manual check if RPC fails
    return await manualDatabaseCheck();
  }
}

/**
 * Manual database health check when the RPC function is not available
 */
async function manualDatabaseCheck(client = supabase): Promise<HealthCheckResult> {
  try {
    // List of required tables
    const requiredTables = [
      'health_check',
      'spotify_tokens',
      'queues',
      'queue_tracks',
      'user_settings',
      'setup_log'
    ];
    
    console.log('Checking which tables exist in the database...');
    
    // Check which tables exist
    const { data, error } = await client
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', requiredTables);
    
    if (error) {
      console.error('Error checking tables:', error);
      return {
        status: 'error',
        error: error.message,
        message: 'Failed to check database tables'
      };
    }
    
    if (!data) {
      return {
        status: 'error',
        error: 'No data returned from table check',
        message: 'Failed to verify database tables'
      };
    }
    
    // Get list of existing table names
    const existingTables = data.map((row: any) => row.table_name);
    
    // Find missing tables
    const missingTables = requiredTables.filter(table => !existingTables.includes(table));
    
    // Determine health status
    const isHealthy = missingTables.length === 0;
    
    return {
      status: isHealthy ? 'healthy' : 'missing_tables',
      existing_tables: existingTables,
      missing_tables: missingTables,
      timestamp: new Date().toISOString(),
      message: isHealthy 
        ? 'All required database tables exist' 
        : `Missing tables: ${missingTables.join(', ')}`
    };
  } catch (error) {
    console.error('Error in manual database check:', error);
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to manually check database tables'
    };
  }
}

/**
 * Set up missing database tables if they don't exist
 */
export async function setupMissingTables(missingTables: string[]): Promise<{
  success: boolean;
  message: string;
  error?: string;
}> {
  try {
    if (missingTables.length === 0) {
      return { success: true, message: 'No missing tables to create' };
    }
    
    console.log('Setting up missing tables:', missingTables);
    
    // For Netlify environments, use the dedicated function
    if (isNetlifyEnvironment()) {
      const { origin } = window.location;
      const netlifyFunctionUrl = `${origin}/.netlify/functions/setup-database`;
      
      const response = await fetch(netlifyFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tables: missingTables })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed with status ${response.status}`);
      }
      
      const result = await response.json();
      
      return {
        success: result.success || false,
        message: result.message || 'Tables created successfully',
        error: result.error
      };
    } else {
      // In development, show instructions instead of trying to create tables
      console.log('Cannot automatically create tables in development environment');
      console.log('Please run the health_check_setup.sql script manually');
      
      return {
        success: false,
        message: 'Cannot automatically create tables in development',
        error: 'Please run the health_check_setup.sql script manually'
      };
    }
  } catch (error) {
    console.error('Error setting up missing tables:', error);
    return {
      success: false,
      message: 'Failed to set up missing tables',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Run a database health check and attempt to fix issues
 * Returns true if the database is healthy or was fixed, false otherwise
 */
export async function ensureDatabaseHealth(): Promise<boolean> {
  try {
    // Always try direct RPC first
    console.log('Starting database health check...');
    
    // Prioritize the more reliable methods over Netlify functions
    const healthResult = await checkDatabaseHealth();
    console.log('Health check result:', healthResult);
    
    if (healthResult.status === 'healthy') {
      console.log('Database is healthy!');
      return true;
    }
    
    if (healthResult.status === 'missing_tables') {
      console.log('Missing tables detected:', healthResult.missing_tables);
      
      if (healthResult.missing_tables && healthResult.missing_tables.length > 0) {
        console.log('Attempting to set up missing tables:', healthResult.missing_tables);
        
        try {
          const setupResult = await setupMissingTables(healthResult.missing_tables);
          
          if (setupResult.success) {
            console.log('Successfully set up missing tables:', setupResult.message);
            return true;
          } else {
            console.error('Failed to set up missing tables:', setupResult.error || setupResult.message);
            return false;
          }
        } catch (setupError) {
          console.error('Error setting up missing tables:', setupError);
          return false;
        }
      }
    }
    
    console.error('Database health check failed:', healthResult.error || healthResult.message);
    return false;
  } catch (error) {
    console.error('Error ensuring database health:', error);
    return false;
  }
}
