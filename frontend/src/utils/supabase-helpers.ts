import type { Database } from './database.types';
import { supabase } from './supabase';

/**
 * Enhanced version of getSupabaseWithAuth that handles session validation
 * and implements retries with exponential backoff
 */
export const getAuthenticatedSupabaseClient = async (retries = 2) => {
  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= retries) {
    try {
      // Get the current session
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        throw new Error(`Session error: ${sessionError.message}`);
      }
      
      if (!sessionData || !sessionData.session) {
        throw new Error('No active session found');
      }
      
      // Session exists, return the client with auth headers
      return { 
        supabase,
        session: sessionData.session,
        userId: sessionData.session.user.id,
        isAuthenticated: true
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Only retry if it seems like a temporary issue
      const isRetryable = 
        lastError.message.includes('timeout') || 
        lastError.message.includes('network') ||
        lastError.message.includes('failed to fetch');
      
      if (!isRetryable || attempt >= retries) {
        // Only log as error if it's an actual error, not just "no session"
        const isNoSession = lastError.message.includes('No active session');
        if (!isNoSession) {
          console.error(`Auth client retrieval failed after ${attempt + 1} attempts:`, lastError);
        }
        // Return unauthenticated client as fallback
        return { 
          supabase, 
          session: null, 
          userId: null, 
          isAuthenticated: false,
          error: isNoSession ? null : lastError 
        };
      }
      
      // Exponential backoff before retry
      const backoffMs = Math.pow(2, attempt) * 500; // 500ms, 1s, 2s
      console.log(`Retrying auth client retrieval in ${backoffMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, backoffMs));
      
      attempt++;
    }
  }
  
  // This should never be reached due to the returns in the loop
  return { 
    supabase, 
    session: null, 
    userId: null, 
    isAuthenticated: false,
    error: lastError 
  };
};

/**
 * Checks if a user has a valid session and refreshes if needed
 */
export const ensureValidSession = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      throw error;
    }
    
    if (!data.session) {
      // Try to refresh
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError) {
        throw refreshError;
      }
      
      return !!refreshData.session;
    }
    
    return true;
  } catch (error) {
    console.error('Session validation error:', error);
    return false;
  }
};

/**
 * Store values in Supabase with retry logic
 */
export const storeInSupabase = async (table: keyof Database['public']['Tables'], data: any, matchCondition: any) => {
  const { supabase: authClient, isAuthenticated } = await getAuthenticatedSupabaseClient();
  
  if (!isAuthenticated) {
    throw new Error('Cannot store data: No authenticated session available');
  }
  
  try {
    // Try upsert first
    const { error: upsertError } = await authClient
      .from(table)
      .upsert(data, { 
        onConflict: Object.keys(matchCondition)[0],
        ignoreDuplicates: false
      });
      
    if (!upsertError) {
      return true;
    }
    
    // If upsert fails with specific errors, try update then insert
    console.warn(`Upsert failed, trying update: ${upsertError.message}`);
    
    // Try update
    const { data: existingData, error: selectError } = await authClient
      .from(table)
      .select('*')
      .match(matchCondition)
      .single();
      
    if (selectError && selectError.code !== 'PGRST116') { // Not 'no rows returned'
      throw selectError;
    }
    
    if (existingData) {
      // Update existing record
      const { error: updateError } = await authClient
        .from(table)
        .update(data)
        .match(matchCondition);
        
      if (updateError) throw updateError;
      return true;
    } else {
      // Insert new record
      const { error: insertError } = await authClient
        .from(table)
        .insert(data);
        
      if (insertError) throw insertError;
      return true;
    }
  } catch (error) {
    console.error(`Error storing data in ${table}:`, error);
    throw error;
  }
};
