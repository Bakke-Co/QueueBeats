import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Song, Vote } from './queueHelpers';

// Store active channels to avoid duplicate subscriptions
const activeChannels: Record<string, RealtimeChannel> = {};

// Types of subscription events
export type EventType = 'INSERT' | 'UPDATE' | 'DELETE';

// Event handler type
export type EventHandler<T> = (payload: { new: T | null; old: T | null; eventType: EventType }) => void;

/**
 * Subscribe to changes on the songs table for a specific queue
 */
export const subscribeSongsInQueue = (
  queueId: string,
  callback: EventHandler<Song>,
  onError?: (error: Error) => void
) => {
  const channelKey = `songs:queue_id=eq.${queueId}`;
  
  // Return existing channel if already subscribed
  if (activeChannels[channelKey]) {
    console.log(`Already subscribed to songs in queue: ${queueId}`);
    return () => {
      // Return unsubscribe function
      activeChannels[channelKey].unsubscribe();
      delete activeChannels[channelKey];
    };
  }
  
  try {
    console.log(`Subscribing to songs in queue: ${queueId}`);
    
    // Create channel for songs in queue
    const channel = supabase
      .channel(channelKey)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'songs',
          filter: `queue_id=eq.${queueId}`
        },
        (payload) => {
          console.log('Song change detected:', payload.eventType);
          callback({
            new: payload.new as Song || null,
            old: payload.old as Song || null,
            eventType: payload.eventType as EventType
          });
        }
      )
      .subscribe((status) => {
        console.log(`Songs subscription status: ${status}`);
        if (status === 'CHANNEL_ERROR' && onError) {
          onError(new Error('Failed to subscribe to songs changes'));
        }
      });
    
    // Store channel reference
    activeChannels[channelKey] = channel;
    
    // Return unsubscribe function
    return () => {
      console.log(`Unsubscribing from songs in queue: ${queueId}`);
      channel.unsubscribe();
      delete activeChannels[channelKey];
    };
  } catch (error) {
    console.error('Error subscribing to songs changes:', error);
    if (onError) onError(error as Error);
    
    // Return noop function
    return () => {};
  }
};

/**
 * Subscribe to votes for songs in a specific queue
 */
export const subscribeVotesForQueue = (
  queueId: string,
  callback: EventHandler<Vote>,
  onError?: (error: Error) => void
) => {
  // This is a bit trickier as votes table doesn't have queue_id directly
  // We need to use a join filter with the songs table
  const channelKey = `votes:queue_id=eq.${queueId}`;
  
  // Return existing channel if already subscribed
  if (activeChannels[channelKey]) {
    console.log(`Already subscribed to votes for queue: ${queueId}`);
    return () => {
      activeChannels[channelKey].unsubscribe();
      delete activeChannels[channelKey];
    };
  }
  
  try {
    console.log(`Subscribing to votes for queue: ${queueId}`);
    
    // You'd need to create a Postgres function or use a workaround since
    // Supabase realtime doesn't directly support joins in filters
    // One approach is to fetch the song IDs for the queue first, then subscribe to votes for those songs
    
    // Here's a simplified version - in a real app you might need a more robust solution
    // like refreshing the list of song IDs periodically
    Promise.resolve(supabase
      .from('songs')
      .select('id')
      .eq('queue_id', queueId))
      .then(({ data, error }) => {
        if (error) {
          console.error('Error fetching songs for vote subscription:', error);
          if (onError) onError(error);
          return;
        }
        
        if (!data || data.length === 0) {
          console.log('No songs found for vote subscription. Creating dummy channel to track initial votes.');
          
          // Create a channel that won't match any votes but will at least establish a connection
          const emptyChannel = supabase
            .channel(channelKey)
            .on(
              'postgres_changes',
              {
                event: '*', 
                schema: 'public',
                table: 'votes',
                filter: `song_id=eq.00000000-0000-0000-0000-000000000000` // This won't match any real votes
              },
              (payload) => {
                // This won't be called since the filter won't match anything
                console.log('Vote change detected (should not happen with dummy filter):', payload.eventType);
              }
            )
            .subscribe((status) => {
              console.log(`Votes subscription status (dummy): ${status}`);
              
              // Even with a dummy filter, we can still trigger the callback on success
              // to establish the real-time connection
              if (status === 'SUBSCRIBED') {
                callback({
                  new: null,
                  old: null,
                  eventType: 'INSERT' // Dummy event type
                });
              }
              
              if (status === 'CHANNEL_ERROR' && onError) {
                onError(new Error('Failed to subscribe to votes changes'));
              }
            });
          
          // Store channel reference
          activeChannels[channelKey] = emptyChannel;
          return;
        }
        
        const songIds = data.map(song => song.id);
        
        // Create channel for votes on songs in the queue
        const channel = supabase
          .channel(channelKey)
          .on(
            'postgres_changes',
            {
              event: '*', // Listen for all events (INSERT, UPDATE, DELETE)
              schema: 'public',
              table: 'votes',
              filter: `song_id=in.(${songIds.join(',')})` // Filter by song IDs in the queue
            },
            (payload) => {
              console.log('Vote change detected:', payload.eventType);
              callback({
                new: payload.new as Vote || null,
                old: payload.old as Vote || null,
                eventType: payload.eventType as EventType
              });
            }
          )
          .subscribe((status) => {
            console.log(`Votes subscription status: ${status}`);
            if (status === 'CHANNEL_ERROR' && onError) {
              onError(new Error('Failed to subscribe to votes changes'));
            }
          });
        
        // Store channel reference
        activeChannels[channelKey] = channel;
      })
      .catch(error => {
        console.error('Exception in vote subscription setup:', error);
        if (onError) onError(error);
      });
    
    // Return unsubscribe function
    return () => {
      console.log(`Unsubscribing from votes for queue: ${queueId}`);
      if (activeChannels[channelKey]) {
        activeChannels[channelKey].unsubscribe();
        delete activeChannels[channelKey];
      }
    };
  } catch (error) {
    console.error('Error subscribing to votes changes:', error);
    if (onError) onError(error as Error);
    
    // Return noop function
    return () => {};
  }
};

/**
 * Subscribe to changes to a specific queue
 */
export const subscribeQueueChanges = (
  queueId: string,
  callback: EventHandler<any>,
  onError?: (error: Error) => void
) => {
  const channelKey = `queue:id=eq.${queueId}`;
  
  // Return existing channel if already subscribed
  if (activeChannels[channelKey]) {
    console.log(`Already subscribed to queue changes: ${queueId}`);
    return () => {
      activeChannels[channelKey].unsubscribe();
      delete activeChannels[channelKey];
    };
  }
  
  try {
    console.log(`Subscribing to queue changes: ${queueId}`);
    
    // Create channel for queue changes
    const channel = supabase
      .channel(channelKey)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'queues',
          filter: `id=eq.${queueId}`
        },
        (payload) => {
          console.log('Queue change detected:', payload.eventType);
          callback({
            new: payload.new || null,
            old: payload.old || null,
            eventType: payload.eventType as EventType
          });
        }
      )
      .subscribe((status) => {
        console.log(`Queue subscription status: ${status}`);
        
        // Trigger the callback on success even without a data change
        // This helps establish the real-time connection indicator
        if (status === 'SUBSCRIBED') {
          callback({
            new: null,
            old: null,
            eventType: 'UPDATE' // Dummy event to indicate connection
          });
        }
        
        if (status === 'CHANNEL_ERROR' && onError) {
          onError(new Error('Failed to subscribe to queue changes'));
        }
      });
    
    // Store channel reference
    activeChannels[channelKey] = channel;
    
    // Return unsubscribe function
    return () => {
      console.log(`Unsubscribing from queue changes: ${queueId}`);
      channel.unsubscribe();
      delete activeChannels[channelKey];
    };
  } catch (error) {
    console.error('Error subscribing to queue changes:', error);
    if (onError) onError(error as Error);
    
    // Return noop function
    return () => {};
  }
};

/**
 * Unsubscribe from all active channels
 */
export const unsubscribeAll = () => {
  console.log(`Unsubscribing from all channels: ${Object.keys(activeChannels).length} active`);
  
  Object.values(activeChannels).forEach(channel => {
    channel.unsubscribe();
  });
  
  // Clear active channels
  Object.keys(activeChannels).forEach(key => {
    delete activeChannels[key];
  });
};
