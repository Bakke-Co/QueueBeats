import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../components/Button";
import { Navigation } from "../components/Navigation";
import { AuthInit } from "../components/AuthInit";
import { AuthProvider } from "../components/AuthProvider";
import { useAuth } from "../utils/auth";
import { getQueueByAccessCode, getQueueSongs, markSongAsPlayed } from "../utils/queueHelpers";
import { subscribeSongsInQueue, subscribeVotesForQueue, subscribeQueueChanges, EventType } from "../utils/realtime";
import type { Queue } from "../utils/queueHelpers";
import { SongRow, type Song as SongRowSong } from "../components/SongRow";
import { toast } from "sonner";
import { ToasterProvider } from "../components/ToasterProvider";

export default function GuestQueueView() {
  return (
    <ToasterProvider>
      <AuthInit>
        <AuthProvider>
          <GuestQueueViewContent />
        </AuthProvider>
      </AuthInit>
    </ToasterProvider>
  );
}

function GuestQueueViewContent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const accessCode = searchParams.get("code") || "";
  const { user } = useAuth();
  
  const [queue, setQueue] = useState<Queue | null>(null);
  const [songs, setSongs] = useState<SongRowSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSongs, setLoadingSongs] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [isRealTimeActive, setIsRealTimeActive] = useState(false);
  
  // Redirect to join queue if no access code
  useEffect(() => {
    if (!accessCode) {
      navigate("/join-queue");
    }
  }, [accessCode, navigate]);
  
  // Fetch queue data
  useEffect(() => {
    if (!accessCode) {
      setError("No access code provided");
      setLoading(false);
      return;
    }
    
    const fetchQueueData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const queueData = await getQueueByAccessCode(accessCode);
        
        // Check if queue exists
        if (!queueData) {
          setError("Queue not found");
          return;
        }
        
        setQueue(queueData);
      } catch (err: any) {
        console.error("Error fetching queue:", err);
        setError(err.message || "Failed to load queue");
      } finally {
        setLoading(false);
      }
    };
    
    fetchQueueData();
  }, [accessCode, navigate]);
  
  // Set up real-time subscriptions
  useEffect(() => {
    if (!queue) return;
    
    let unsubFunctions: Array<() => void> = [];
    
    try {
      // Initial fetch
      const fetchSongs = async () => {
        try {
          setLoadingSongs(true);
          
          const songsData = await getQueueSongs(queue.id, user?.id);
          setSongs(songsData);
        } catch (err: any) {
          console.error("Error fetching songs:", err);
          toast.error("Failed to load songs");
        } finally {
          setLoadingSongs(false);
        }
      };
      
      fetchSongs();
      
      // Set up real-time subscriptions
      const unsubscribeSongs = subscribeSongsInQueue(
        queue.id,
        (payload) => {
          const { new: newSong, old: oldSong, eventType } = payload;
          
          console.log(`Song ${eventType} event:`, newSong || oldSong);
          setIsRealTimeActive(true);
          
          // Handle different event types
          switch (eventType) {
            case 'INSERT':
              if (newSong) {
                setSongs(prev => {
                  // Check if song already exists
                  if (prev.find(s => s.id === newSong.id)) return prev;
                  
                  // Add new song with required fields for display
                  return [...prev, { 
                    ...newSong, 
                    total_votes: 0,
                    user_has_voted: false
                  }];
                });
                
                // Show toast notification for new songs
                toast.success(`New song added: ${newSong.title}`);
              }
              break;
              
            case 'UPDATE':
              if (newSong) {
                setSongs(prev => prev.map(song => 
                  song.id === newSong.id ? { 
                    ...song, 
                    ...newSong,
                    // Preserve user_has_voted from previous state
                    user_has_voted: song.user_has_voted
                  } : song
                ));
                
                // If song was marked as played, show notification
                if (newSong.played && oldSong && !oldSong.played) {
                  toast.success(`"${newSong.title}" is now playing!`);
                }
              }
              break;
              
            case 'DELETE':
              if (oldSong) {
                setSongs(prev => prev.filter(song => song.id !== oldSong.id));
              }
              break;
          }
        },
        (error) => {
          console.error("Error in songs subscription:", error);
          toast.error("Lost connection to song updates");
        }
      );
      
      unsubFunctions.push(unsubscribeSongs);
      
      // Subscribe to vote changes
      const unsubscribeVotes = subscribeVotesForQueue(
        queue.id,
        (payload) => {
          const { new: newVote, old: oldVote, eventType } = payload;
          
          console.log(`Vote ${eventType} event:`, newVote || oldVote);
          setIsRealTimeActive(true);
          
          // Only handle votes for active user if they're logged in
          if (user && (newVote?.profile_id === user.id || oldVote?.profile_id === user.id)) {
            // On vote added or removed, update the user_has_voted property
            setSongs(prev => prev.map(song => {
              if ((newVote && song.id === newVote.song_id) || (oldVote && song.id === oldVote.song_id)) {
                return {
                  ...song,
                  user_has_voted: eventType === 'INSERT'
                };
              }
              return song;
            }));
          }
          
          // Always refresh songs when votes change to get updated counts
          // Using a small timeout to avoid excessive refreshes
          setTimeout(() => {
            setRefreshCounter(prev => prev + 1);
          }, 300);
        },
        (error) => {
          console.error("Error in votes subscription:", error);
          toast.error("Lost connection to vote updates");
        }
      );
      
      unsubFunctions.push(unsubscribeVotes);
      
      // Subscribe to queue changes
      const unsubscribeQueue = subscribeQueueChanges(
        queue.id,
        (payload) => {
          const { new: newQueue, eventType } = payload;
          
          console.log(`Queue ${eventType} event:`, newQueue);
          setIsRealTimeActive(true);
          
          // If queue was deleted or deactivated, show a message and redirect
          if (eventType === 'DELETE' || (newQueue && !newQueue.is_active)) {
            toast.error("This queue has been closed by the host");
            setTimeout(() => {
              navigate('/join-queue');
            }, 3000);
          }
        },
        (error) => {
          console.error("Error in queue subscription:", error);
          toast.error("Lost connection to queue updates");
        }
      );
      
      unsubFunctions.push(unsubscribeQueue);
      
    } catch (err) {
      console.error("Error setting up real-time subscriptions:", err);
      toast.error("Failed to connect to real-time updates");
    }
    
    // Cleanup function to unsubscribe from all channels
    return () => {
      console.log("Cleaning up subscriptions");
      unsubFunctions.forEach(unsubFn => {
        try {
          unsubFn();
        } catch (err) {
          console.error("Error unsubscribing:", err);
        }
      });
      setIsRealTimeActive(false);
    };
  }, [queue, user, navigate, setRefreshCounter]);
  
  // Fetch queue songs when refresh is requested manually
  useEffect(() => {
    if (!queue) return;
    
    const fetchSongs = async () => {
      try {
        setLoadingSongs(true);
        
        const songsData = await getQueueSongs(queue.id, user?.id);
        setSongs(songsData);
      } catch (err: any) {
        console.error("Error fetching songs:", err);
        toast.error("Failed to load songs");
      } finally {
        setLoadingSongs(false);
      }
    };
    
    fetchSongs();
    
  }, [queue, user?.id, refreshCounter, navigate]);
  
  // Function to refresh songs after voting
  const refreshSongs = () => {
    setRefreshCounter(prev => prev + 1);
    toast.success("Your vote has been recorded!");
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-black via-purple-950/30 to-black text-foreground overflow-x-hidden">
        <div className="sticky top-0 z-10 backdrop-blur-md bg-black/50 border-b border-white/10 shadow-lg mb-2">
          <Navigation />
        </div>
        <main className="container mx-auto px-4 py-12">
          <div className="flex items-center justify-center h-[60vh]">
            <div className="text-center p-8 rounded-2xl bg-black/40 backdrop-blur-sm border border-white/10 max-w-sm">
              <div className="w-16 h-16 relative mx-auto mb-4">
                <div className="absolute inset-0 border-t-2 border-l-2 border-purple-500 border-solid rounded-full animate-spin"></div>
                <div className="absolute inset-0 border-r-2 border-b-2 border-pink-500 border-solid rounded-full animate-spin-slow"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
              </div>
              <h3 className="text-xl font-bold mb-2 text-white">Loading Your Beats</h3>
              <p className="text-muted-foreground">Getting the party queue ready...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }
  
  if (error || !queue) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-black via-purple-950/30 to-black text-foreground overflow-x-hidden">
        <div className="sticky top-0 z-10 backdrop-blur-md bg-black/50 border-b border-white/10 shadow-lg mb-2">
          <Navigation />
        </div>
        <main className="container mx-auto px-4 py-12">
          <div className="max-w-lg mx-auto text-center">
            <div className="p-8 rounded-2xl bg-black/40 backdrop-blur-sm border border-red-500/20 mb-4">
              <div className="w-16 h-16 mx-auto flex items-center justify-center rounded-full bg-red-500/20 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold mb-4">{error || "Queue not found"}</h2>
              <p className="text-muted-foreground mb-6">
                {error ? "There was an error loading the queue. Please try again later." : "The queue you're looking for doesn't exist or has been closed."}
              </p>
            </div>
            <Button
              variant="glow"
              onClick={() => navigate('/join-queue')}
              className="w-full max-w-xs mx-auto"
            >
              <span className="flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Try Another Queue
              </span>
            </Button>
          </div>
        </main>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-purple-950/30 to-black text-foreground overflow-x-hidden">
      <div className="sticky top-0 z-10 backdrop-blur-md bg-black/50 border-b border-white/10 shadow-lg mb-2">
        <Navigation />
      </div>
      
      <main className="container mx-auto px-4 py-4 pb-20">
        {/* Now Playing Section */}
        {songs.filter(song => song.played && !song.played_at).length > 0 && (
          <div className="mb-6 p-4 bg-gradient-to-r from-purple-900/30 to-pink-900/30 rounded-xl border border-purple-500/30 shadow-glow">
            <h2 className="text-xs uppercase tracking-wider text-purple-300 mb-2">Now Playing</h2>
            {songs.filter(song => song.played && !song.played_at).map(song => (
              <div key={song.id} className="flex items-center gap-3">
                {song.cover_url ? (
                  <img
                    src={song.cover_url}
                    alt={`${song.title} cover`}
                    className="w-16 h-16 object-cover rounded-lg shadow-glow"
                  />
                ) : (
                  <div className="w-16 h-16 bg-black/50 rounded-lg flex items-center justify-center shadow-glow">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-bold text-lg text-white">{song.title}</h3>
                  <p className="text-purple-300">{song.artist}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-purple-500/20 flex-shrink-0 flex items-center justify-center">
                  <div className="w-2 h-4 bg-purple-400 rounded-sm animate-sound-wave1 mx-0.5"></div>
                  <div className="w-2 h-5 bg-purple-400 rounded-sm animate-sound-wave2 mx-0.5"></div>
                  <div className="w-2 h-3 bg-purple-400 rounded-sm animate-sound-wave3 mx-0.5"></div>
                </div>
              </div>
            ))}
          </div>
        )}
            
        {/* Queue header */}
        <div className="mb-6">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h1 className="text-2xl md:text-3xl font-bold truncate relative">
              {queue.name}
              <span className="absolute -top-3 -right-3 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span>
              </span>
            </h1>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/join-queue')}
              className="border-purple-500/30 hover:bg-purple-500/20"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back
            </Button>
          </div>
          
          {queue.description && (
            <p className="text-muted-foreground mb-4">{queue.description}</p>
          )}
          
          <div className="mb-4 p-3 md:p-4 bg-gradient-to-r from-purple-900/20 to-pink-900/20 rounded-lg border border-purple-500/20 animate-pulse-slow">
            <div className="flex items-center gap-3 justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                </svg>
              </div>
                <div>
                  <h3 className="font-medium text-lg">Vote for your favorite songs!</h3>
                  <p className="text-muted-foreground text-sm">Help the DJ know which songs you want to hear next.</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {isRealTimeActive ? (
                  <div className="flex items-center text-xs text-green-400 bg-green-900/20 px-2 py-1 rounded-full">
                    <span className="relative flex h-2 w-2 mr-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    Live Updates
                  </div>
                ) : (
                  <div className="flex items-center text-xs text-gray-400 bg-gray-900/20 px-2 py-1 rounded-full">
                    <span className="relative flex h-2 w-2 mr-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gray-500 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-gray-500"></span>
                    </span>
                    Connecting...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Songs list */}
        <div className="bg-black/30 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden drop-shadow-glow">
          <div className="p-4 border-b border-white/10 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <h2 className="text-lg md:text-xl font-semibold">Song Queue</h2>
              {isRealTimeActive && (
                <div className="flex items-center text-xs text-green-400 bg-green-900/20 px-2 py-1 rounded-full">
                  <span className="relative flex h-2 w-2 mr-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  Live
                </div>
              )}
            </div>
            {queue.settings?.allowGuestAddSongs && (
              <Button
                variant="glow"
                size="sm"
                onClick={() => navigate(`/add-song?queueId=${queue.id}&code=${accessCode}`)}
                className="relative overflow-hidden animate-pulse-slow"
              >
                <span className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Song
                </span>
                <span className="absolute inset-0 bg-gradient-to-r from-purple-600/0 via-purple-600/30 to-purple-600/0 transform translate-x-[-100%] animate-shimmer"></span>
              </Button>
            )}
          </div>
          
          {loadingSongs ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-t-2 border-purple-500 border-solid rounded-full animate-spin"></div>
              <span className="ml-3 text-muted-foreground">Loading songs...</span>
            </div>
          ) : songs.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto flex items-center justify-center rounded-full bg-black/50 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
              <h3 className="text-lg font-medium mb-2">No Songs in Queue</h3>
              <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                Check back later or add a song yourself.
              </p>
              {queue.settings?.allowGuestAddSongs && (
                <Button
                  variant="default"
                  onClick={() => navigate(`/add-song?queueId=${queue.id}&code=${accessCode}`)}
                >
                  Add First Song
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {songs.map((song, index) => (
                <SongRow
                  key={song.id}
                  song={song}
                  index={index}
                  isGuest={true}
                  userId={user?.id}
                  onVote={() => {}} // Will use the internal handler
                  refreshSongs={refreshSongs}
                />
              ))}
            </div>
          )}
        </div>
        
        {/* Info section */}
        {/* Fixed bottom song actions */}
        {queue.settings?.allowGuestAddSongs && (
          <div className="fixed bottom-0 left-0 right-0 p-3 bg-black/80 backdrop-blur-md border-t border-white/10 flex justify-center z-10">
            <Button
              variant="glow"
              onClick={() => navigate(`/add-song?queueId=${queue.id}&code=${accessCode}`)}
              className="w-full max-w-xs animate-pulse-slow relative overflow-hidden"
            >
              <span className="flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add a Song to the Queue
              </span>
              <span className="absolute inset-0 bg-gradient-to-r from-purple-600/0 via-purple-600/30 to-purple-600/0 transform translate-x-[-100%] animate-shimmer"></span>
            </Button>
          </div>
        )}
        
        <div className="mt-6 mb-14 p-4 md:p-6 bg-black/30 backdrop-blur-sm border border-white/10 rounded-xl">
          <h3 className="text-base md:text-lg font-medium mb-3">About this Queue</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 md:p-4 bg-black/40 rounded-lg flex items-center gap-2 md:gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <div className="text-xs md:text-sm text-muted-foreground">Total Songs</div>
                <div className="text-sm md:text-base font-medium">{songs.length} songs</div>
              </div>
            </div>
            
            <div className="p-4 bg-black/40 rounded-lg flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                </svg>
              </div>
              <div>
                <div className="text-xs md:text-sm text-muted-foreground">Total Votes</div>
                <div className="text-sm md:text-base font-medium">
                  {songs.reduce((sum, song) => sum + (song.total_votes || 0), 0)} votes
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>QueueBeats - The Ultimate Party Playlist Democracy</p>
          </div>
        </div>
      </main>
    </div>
  );
}
