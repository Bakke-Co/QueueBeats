import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, getCurrentUser } from './supabase';
import type { User } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Profile cache to reduce database load
const profileCache: Record<string, {
  profile: Profile | null,
  timestamp: number
}> = {};

// Cache expiration time in milliseconds (5 minutes)
const CACHE_EXPIRATION = 5 * 60 * 1000;

export type AuthContextType = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any } | undefined>;
  signUp: (email: string, password: string) => Promise<{ error: any, data: any } | undefined>;
  signOut: () => Promise<boolean>;
  updateProfile: (profile: Partial<Profile>) => Promise<void>;
};

export type Profile = Database['public']['Tables']['profiles']['Row'];

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Helper to get profile from cache or fetch if needed
const getProfileFromCacheOrFetch = async (userId: string): Promise<Profile | null> => {
  // Check if profile is in cache and not expired
  const cachedData = profileCache[userId];
  if (cachedData && (Date.now() - cachedData.timestamp) < CACHE_EXPIRATION) {
    console.log(`Using cached profile for user ID: ${userId}`);
    return cachedData.profile;
  }
  
  // Not cached or expired, try to fetch
  try {
    const profile = await fetchProfile(userId);
    // Update cache
    profileCache[userId] = {
      profile,
      timestamp: Date.now()
    };
    return profile;
  } catch (error) {
    console.error('Error fetching profile for cache:', error);
    // If there's a cached profile but expired, still use it as fallback
    if (cachedData) {
      console.log('Using expired cached profile as fallback');
      return cachedData.profile;
    }
    throw error;
  }
};

// Helper to update profile cache
const updateProfileCache = (userId: string, profile: Profile | null) => {
  profileCache[userId] = {
    profile,
    timestamp: Date.now()
  };
};

export const fetchProfile = async (userId: string) => {
  console.log(`Fetching profile for user ID: ${userId}`);
  
  try {
    // Create a timeout promise
    const timeoutPromise = new Promise<null>((_, reject) => {
      setTimeout(() => reject(new Error('Profile fetch timed out after 15 seconds')), 15000);
    });

    // Create the actual fetch promise
    const fetchPromise = supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url, website')
      .eq('id', userId)
      .single();

    // Race the fetch against the timeout
    const { data, error, status } = await Promise.race([
      fetchPromise,
      timeoutPromise.then(() => { throw new Error('Fetch profile timeout'); })
    ]);

    console.log(`Profile fetch response:`, { status, error: error?.message, hasData: !!data });
    
    if (error) {
      console.error('Error fetching profile:', { message: error.message, code: error.code, details: error.details });
      throw error;
    }
    
    // Cache the profile
    updateProfileCache(userId, data as Profile);
    
    return data as Profile;
  } catch (error) {
    console.error('Exception in fetchProfile:', error);
    throw error;
  }
};

export const updateProfile = async (userId: string, profile: Partial<Profile>) => {
  try {
    // Filter out any undefined values
    const updates = Object.entries(profile).reduce((acc, [key, value]) => {
      if (value !== undefined) acc[key] = value;
      return acc;
    }, {} as Record<string, any>);
    
    // Only proceed if there are actual updates
    if (Object.keys(updates).length === 0) return;

    const { error } = await supabase
      .from('profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) throw error;
    
    // Update the cache
    const existingProfile = await getProfileFromCacheOrFetch(userId);
    if (existingProfile) {
      updateProfileCache(userId, { ...existingProfile, ...updates });
    }
  } catch (error) {
    console.error('Error updating profile:', error);
    throw error;
  }
};

export const createProfile = async (userId: string, profile: Partial<Profile> = {}) => {
  console.log(`Creating profile for user ID: ${userId}`, profile);
  
  try {
    // First check if profile already exists to prevent 409 conflicts
    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();
    
    if (existingProfile) {
      console.log(`Profile for user ID: ${userId} already exists, skipping creation`);
      updateProfileCache(userId, existingProfile as Profile);
      return { data: existingProfile, error: null };
    }

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.warn(`Error checking existing profile: ${fetchError.message}`);
      // Continue with creation attempt even if check fails
    }

    // Create a timeout promise
    const timeoutPromise = new Promise<null>((_, reject) => {
      setTimeout(() => reject(new Error('Profile creation timed out after 15 seconds')), 15000);
    });

    // Create the actual insert promise
    const insertPromise = supabase
      .from('profiles')
      .insert({
        id: userId,
        ...profile,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    // Race the insert against the timeout
    const { data, error, status } = await Promise.race([
      insertPromise,
      timeoutPromise.then(() => { throw new Error('Create profile timeout'); })
    ]);

    console.log(`Profile creation response:`, { status, error: error?.message });
    
    if (error) {
      // If we still get a conflict error, it might have been created in parallel
      if (error.code === '23505' || error.message?.includes('duplicate key value')) {
        console.log('Profile already exists (detected after insert attempt)');
        
        // Try to fetch the profile that already exists
        try {
          const existingProfile = await fetchProfile(userId);
          updateProfileCache(userId, existingProfile);
          return { data: existingProfile, error: null };
        } catch (fetchError) {
          console.error('Failed to fetch existing profile after conflict:', fetchError);
        }
        
        return { error: null };
      }
      console.error('Error creating profile:', { message: error.message, code: error.code, details: error.details });
      throw error;
    }
    
    // Created successfully, now get the complete profile and cache it
    try {
      const newProfile = await fetchProfile(userId);
      updateProfileCache(userId, newProfile);
    } catch (fetchError) {
      console.warn('Created profile but failed to fetch for cache:', fetchError);
    }
    
    return { data, error: null };
  } catch (error) {
    console.error('Exception in createProfile:', error);
    throw error;
  }
};

// Helper function to ensure a user profile exists with timeout protection
export const ensureUserProfileWithTimeout = async (userId: string): Promise<Profile | null> => {
  console.log(`Ensuring profile exists for user ID: ${userId} with timeout protection`);
  
  // First check the cache
  const cachedData = profileCache[userId];
  if (cachedData && (Date.now() - cachedData.timestamp) < CACHE_EXPIRATION) {
    console.log(`Using cached profile for ensureUserProfile: ${userId}`);
    return cachedData.profile;
  }
  
  // Maximum retry attempts
  const maxRetries = 3;
  let retryCount = 0;
  let lastError = null;
  
  while (retryCount < maxRetries) {
    try {
      // Try to fetch profile
      try {
        const profile = await getProfileFromCacheOrFetch(userId);
        if (profile) {
          console.log('Found existing profile:', profile);
          return profile;
        }
      } catch (fetchError) {
        console.warn(`Error fetching profile (attempt ${retryCount + 1}):`, fetchError);
        
        // Try to create a profile
        try {
          const result = await createProfile(userId);
          console.log('Profile creation result:', result);
          
          // Wait a short time to ensure profile is committed to the database
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Now fetch the newly created profile
          try {
            const newProfile = await getProfileFromCacheOrFetch(userId);
            console.log('Fetched newly created profile:', newProfile);
            return newProfile;
          } catch (refetchError) {
            console.error('Failed to fetch newly created profile:', refetchError);
            lastError = refetchError;
          }
        } catch (createError) {
          console.error('Failed to create profile:', createError);
          lastError = createError;
          
          // If we get a conflict error, try fetching again immediately
          if (
            createError.code === '23505' || 
            (createError.message && createError.message.includes('duplicate key value'))
          ) {
            try {
              const existingProfile = await getProfileFromCacheOrFetch(userId);
              console.log('Found profile after conflict error:', existingProfile);
              return existingProfile;
            } catch (secondFetchError) {
              console.error('Failed to fetch profile after conflict error:', secondFetchError);
              lastError = secondFetchError;
            }
          }
        }
      }
      
      // Increase retry counter and add exponential backoff delay
      retryCount++;
      if (retryCount < maxRetries) {
        const backoffMs = Math.min(1000 * Math.pow(2, retryCount), 5000);
        console.log(`Retrying profile operation in ${backoffMs}ms (attempt ${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    } catch (error) {
      console.error(`Exception in ensureUserProfileWithTimeout (attempt ${retryCount + 1}):`, error);
      lastError = error;
      retryCount++;
      
      if (retryCount < maxRetries) {
        const backoffMs = Math.min(1000 * Math.pow(2, retryCount), 5000);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }
  }
  
  // If we have an expired cache entry, use it as a last resort
  if (cachedData) {
    console.warn(`Using expired cache as last resort after ${maxRetries} failed attempts`);
    return cachedData.profile;
  }
  
  console.error(`Failed to ensure profile after ${maxRetries} attempts, last error:`, lastError);
  return null;
};
