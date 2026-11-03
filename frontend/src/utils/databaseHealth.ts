import { supabase } from './supabase';
import { isNetlifyEnvironment } from './spotify';
import { probeDatabase } from './databaseHealthProbe';
export type { HealthCheckResult } from './databaseHealthProbe';

// Zero-row GET requests return structured errors but no customer rows and never call schema-changing RPCs.
export function checkDatabaseHealth() {
  return probeDatabase(table => supabase.from(table).select('id').limit(0));
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

/** Startup checks report availability; they never provision or mutate a database. */
export async function ensureDatabaseHealth(): Promise<boolean> {
  return (await checkDatabaseHealth()).status === 'healthy';
}
