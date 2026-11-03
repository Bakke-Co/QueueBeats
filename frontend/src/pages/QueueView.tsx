import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { AuthInit } from "../components/AuthInit";
import { AuthProvider } from "../components/AuthProvider";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { useAuth } from "../utils/auth";
import { getQueueById, getQueueSongs } from "../utils/queueHelpers";
import type { Queue } from "../utils/queueHelpers";
import { SongRow, type Song as SongRowSong } from "../components/SongRow";
import { SongRowDJ } from "../components/SongRowDJ";
import { NowPlaying } from "../components/NowPlaying";
import { RecentlyPlayed } from "../components/RecentlyPlayed";
import { updateSongPosition, removeSongFromQueue } from "../utils/queueHelpers";
import { subscribeSongsInQueue, subscribeVotesForQueue, subscribeQueueChanges, EventType } from "../utils/realtime";
import { markSongAsPlayed } from "../utils/queueHelpers";
import { toast } from "sonner";
import { ToasterProvider } from "../components/ToasterProvider";
import MainLayout from "../components/MainLayout";

export default function QueueView() {
  return (
    <ToasterProvider>
      <AuthInit>
        <AuthProvider>
          <ProtectedRoute>
            <MainLayout>
              <QueueViewContent />
            </MainLayout>
          </ProtectedRoute>
        </AuthProvider>
      </AuthInit>
    </ToasterProvider>
  );
}

type SongWithVotes = SongRowSong;

// Function to get all non-played songs
const getActiveSongs = (songs: SongWithVotes[]) => {
  return songs.filter(song => !song.played).sort((a, b) => {
    // First sort by votes (highest first)
    if ((b.total_votes || 0) !== (a.total_votes || 0)) {
      return (b.total_votes || 0) - (a.total_votes || 0);
    }
    // Then by position if it exists
    if (a.position !== undefined && b.position !== undefined) {
      return a.position - b.position;
    }
    // Finally by created_at
    return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
  });
};

function QueueViewContent() {
  const { queueId } = useParams<{ queueId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Redirect to dashboard if no queue ID
  useEffect(() => {
    if (!queueId) {
      navigate("/dashboard");
    }
  }, [queueId, navigate]);
  
  const [queue, setQueue] = useState<Queue | null>(null);
  const [songs, setSongs] = useState<SongWithVotes[]>([]);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [isRealTimeActive, setIsRealTimeActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingSongs, setLoadingSongs] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showQrCode, setShowQrCode] = useState(false);
  
  // Function to refresh songs
  const refreshSongs = async () => {
    if (!queueId || !user?.id) return;
    
    try {
      setLoadingSongs(true);
      const songsData = await getQueueSongs(queueId, user.id);
      setSongs(songsData);
      toast.success("Songs refreshed");
    } catch (err: any) {
      console.error("Error refreshing songs:", err);
      toast.error("Failed to refresh songs");
    } finally {
      setLoadingSongs(false);
    }
  };
  
  // Move song up in the queue
  const handleMoveUp = async (songId: string) => {
    try {
      const activeSongs = getActiveSongs(songs);
      const currentIndex = activeSongs.findIndex(song => song.id === songId);
      
      if (currentIndex <= 0) return; // Already at the top
      
      const newPosition = activeSongs[currentIndex - 1].position || 0;
      await updateSongPosition(songId, newPosition - 1);
      toast.success("Song moved up");
      refreshSongs();
    } catch (err) {
      console.error("Error moving song up:", err);
      toast.error("Failed to reorder queue");
    }
  };
  
  // Move song down in the queue
  const handleMoveDown = async (songId: string) => {
    try {
      const activeSongs = getActiveSongs(songs);
      const currentIndex = activeSongs.findIndex(song => song.id === songId);
      
      if (currentIndex === -1 || currentIndex >= activeSongs.length - 1) return; // Already at the bottom
      
      const newPosition = activeSongs[currentIndex + 1].position || 0;
      await updateSongPosition(songId, newPosition + 1);
      toast.success("Song moved down");
      refreshSongs();
    } catch (err) {
      console.error("Error moving song down:", err);
      toast.error("Failed to reorder queue");
    }
  };
  
  // Handle song removal
  const handleRemoveSong = async (songId: string) => {
    try {
      // The actual removal logic is handled in the SongRowDJ component
      // This is just for state updates
      setSongs(prevSongs => prevSongs.filter(song => song.id !== songId));
    } catch (err) {
      console.error("Error handling song removal:", err);
    }
  };
  
  // Function to mark a song as played
  const handlePlayNow = async (songId: string) => {
    try {
      await markSongAsPlayed(songId);
      toast.success("Song marked as played");
      refreshSongs();
    } catch (err: any) {
      console.error("Error marking song as played:", err);
      toast.error("Failed to mark song as played");
    }
  };
  
  // Fetch queue data
  useEffect(() => {
    if (!queueId || !user) return;
    
    const fetchQueueData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('Fetching queue data for queue ID:', queueId);
        
        const queueData = await getQueueById(queueId);
        
        // Check if queue exists
        if (!queueData) {
          console.warn(`Queue not found: ${queueId}`);
          setError("Queue not found. Please check the URL or try again later.");
          return;
        }
        
        // Check if queue belongs to user
        if (queueData.creator_id !== user.id) {
          console.warn(`User ${user.id} tried to access queue ${queueId} owned by ${queueData.creator_id}`);
          setError("You don't have permission to view this queue");
          return;
        }
        
        console.log('Queue data loaded successfully:', queueData.name);
        setQueue(queueData);
      } catch (err: any) {
        console.error("Error fetching queue:", err);
        
        // Handle specific error cases
        if (err.message?.includes('406') || err.message?.includes('Authentication')) {
          setError("Authentication error. Please sign out and sign back in.");
        } else {
          setError(err.message || "Failed to load queue");
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchQueueData();
  }, [queueId, user]);
  
  // Set up real-time subscriptions
  useEffect(() => {
    if (!queueId || !queue || !user?.id) return;
    
    // Initial fetch
    const fetchSongs = async () => {
      try {
        setLoadingSongs(true);
        
        const songsData = await getQueueSongs(queueId, user?.id);
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
      queueId,
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
                  // Preserve total_votes and user_has_voted from previous state
                  total_votes: song.total_votes,
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
              toast.info(`Song removed: ${oldSong.title}`);
            }
            break;
        }
      },
      (error) => {
        console.error("Song subscription error:", error);
        toast.error("Real-time updates interrupted");
        setIsRealTimeActive(false);
      }
    );
    
    // Subscribe to vote changes
    const unsubscribeVotes = subscribeVotesForQueue(
      queueId,
      (payload) => {
        const { new: newVote, old: oldVote, eventType } = payload;
        
        console.log(`Vote ${eventType} event:`, newVote || oldVote);
        setIsRealTimeActive(true);
        
        // We need to refresh the songs when votes change
        // This could be optimized to just update the specific song's vote count
        refreshSongs();
      },
      (error) => {
        console.error("Vote subscription error:", error);
        toast.error("Real-time updates interrupted");
        setIsRealTimeActive(false);
      }
    );
    
    // Subscribe to queue changes
    const unsubscribeQueue = subscribeQueueChanges(
      queueId,
      (payload) => {
        const { new: newQueue, eventType } = payload;
        
        console.log(`Queue ${eventType} event:`, newQueue);
        setIsRealTimeActive(true);
        
        if (eventType === 'UPDATE' && newQueue) {
          setQueue(newQueue as Queue);
        }
      },
      (error) => {
        console.error("Queue subscription error:", error);
      }
    );
    
    return () => {
      // Clean up all subscriptions
      unsubscribeSongs();
      unsubscribeVotes();
      unsubscribeQueue();
      setIsRealTimeActive(false);
    };
  }, [queueId, queue, user?.id]);
  
  // Fetch queue songs when refresh is requested manually
  useEffect(() => {
    if (!queueId || !queue) return;
    
    const fetchSongs = async () => {
      try {
        setLoadingSongs(true);
        
        const songsData = await getQueueSongs(queueId, user?.id);
        setSongs(songsData);
      } catch (err: any) {
        console.error("Error fetching songs:", err);
        toast.error("Failed to load songs");
      } finally {
        setLoadingSongs(false);
      }
    };
    
    fetchSongs();
    
    // No need for polling anymore as we have real-time updates
  }, [queueId, queue, refreshCounter, user?.id]);
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        alert("Link copied to clipboard!");
      })
      .catch(err => {
        console.error("Could not copy text: ", err);
      });
  };
  
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="text-center">
          <div className="w-12 h-12 border-t-2 border-purple-500 border-solid rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading queue...</p>
        </div>
      </div>
    );
  }
  
  if (error || !queue) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-lg mx-auto text-center">
          <div className="w-16 h-16 mx-auto flex items-center justify-center rounded-full bg-red-500/20 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-4">{error || "Queue not found"}</h2>
          <p className="text-muted-foreground mb-6">
            {error ? "There was an error loading the queue. Please try again later." : "The queue you're looking for doesn't exist or you don't have permission to view it."}
          </p>
          <Button
            variant="default"
            onClick={() => navigate('/dashboard')}
          >
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <MainLayout>
      {/* Live Queue View Header */}
      <main className="container mx-auto px-4 py-8">
        {/* Queue header */}
        <div className="mb-8">
          <div className="flex items-center justify-between gap-4 mb-2">
            <h1 className="text-3xl font-bold truncate">{queue.name}</h1>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/dashboard')}
            >
              Back to Dashboard
            </Button>
          </div>
          
          {queue.description && (
            <p className="text-muted-foreground mb-4">{queue.description}</p>
          )}
          
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="px-3 py-1 rounded-full bg-black/40 border border-purple-500/30 text-sm flex items-center">
              <span className="mr-2">🌐</span>
              {queue.settings?.isPublic ? 'Public Queue' : 'Private Queue'}
            </div>
            {queue.settings?.requireApproval && (
              <div className="px-3 py-1 rounded-full bg-black/40 border border-purple-500/30 text-sm flex items-center">
                <span className="mr-2">✅</span>
                Song Approval Required
              </div>
            )}
            <div className="px-3 py-1 rounded-full bg-black/40 border border-purple-500/30 text-sm flex items-center">
              <span className="mr-2">🔑</span>
              Code: {queue.access_code}
            </div>
            <div className="px-3 py-1 rounded-full bg-black/40 border border-white/10 text-sm flex items-center">
              <span className="mr-2">
                {isRealTimeActive ? (
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                  </span>
                ) : (
                  <span className="relative flex h-3 w-3">
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-gray-500"></span>
                  </span>
                )}
              </span>
              {isRealTimeActive ? 'Real-time connected' : 'Real-time connecting...'}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Share link */}
            <div className="flex">
              <button 
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-black/40 border border-white/10 hover:border-purple-500/30 rounded-lg transition-colors"
                onClick={() => {
                  const shareUrl = `${window.location.origin}/join-queue?code=${queue.access_code}`;
                  copyToClipboard(shareUrl);
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share Link
              </button>
            </div>
            
            {/* Show QR Code */}
            <div className="flex">
              <button 
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-black/40 border border-white/10 hover:border-purple-500/30 rounded-lg transition-colors"
                onClick={() => setShowQrCode(true)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                Show QR Code
              </button>
            </div>
            
            {/* Copy access code */}
            <div className="flex">
              <button 
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-black/40 border border-white/10 hover:border-purple-500/30 rounded-lg transition-colors"
                onClick={() => copyToClipboard(queue.access_code)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy Access Code
              </button>
            </div>
          </div>
        </div>
        
        {/* Content area */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Songs list */}
          <div className="lg:col-span-8">
            <div className="bg-black/30 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-white/10 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold">Song Queue</h2>
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/add-song?queueId=${queueId}`)}
                >
                  Add Song
                </Button>
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
                    Share your queue with guests or add songs yourself to get started.
                  </p>
                  <Button
                    variant="default"
                    onClick={() => navigate(`/add-song?queueId=${queueId}`)}
                  >
                    Add First Song
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-white/10">
                  {getActiveSongs(songs).map((song, index, array) => (
                    <SongRowDJ
                      key={song.id}
                      song={song}
                      index={index}
                      userId={user?.id || ""}
                      onPlayNow={handlePlayNow}
                      onRemove={handleRemoveSong}
                      onMoveUp={handleMoveUp}
                      onMoveDown={handleMoveDown}
                      isFirst={index === 0}
                      isLast={index === array.length - 1}
                      refreshSongs={refreshSongs}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {/* DJ Control Panel */}
          <div className="lg:col-span-4 space-y-6">
            {/* Now Playing */}
            <NowPlaying queueId={queueId || ""} onRefresh={refreshSongs} />
            
            {/* Recently Played */}
            <RecentlyPlayed queueId={queueId || ""} limit={5} />
            
            {/* Queue Stats */}
            <div className="bg-black/30 backdrop-blur-sm border border-white/10 rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-4">Queue Stats</h2>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-black/40 rounded-lg text-center">
                    <div className="text-2xl font-bold text-purple-400">{songs.length}</div>
                    <div className="text-xs text-muted-foreground mt-1">Songs in Queue</div>
                  </div>
                  
                  <div className="p-4 bg-black/40 rounded-lg text-center">
                    <div className="text-2xl font-bold text-purple-400">
                      {songs.reduce((sum, song) => sum + (song.total_votes || 0), 0)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Total Votes</div>
                  </div>
                </div>
                
                <div className="p-4 bg-gradient-to-r from-purple-900/30 to-pink-900/30 rounded-lg">
                  <h3 className="font-medium mb-2">Queue Settings</h3>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Queue Type:</span>
                      <span>{queue.settings?.isPublic ? 'Public' : 'Private'}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Guest Submissions:</span>
                      <span>{queue.settings?.allowGuestAddSongs ? 'Allowed' : 'Restricted'}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Max Votes Per User:</span>
                      <span>{queue.settings?.maxVotesPerUser || 'Unlimited'}</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Song Approval:</span>
                      <span>{queue.settings?.requireApproval ? 'Required' : 'Not Required'}</span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => navigate(`/queue/${queueId}/settings`)}
                  >
                    Edit Queue Settings
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      {/* QR Code Modal */}
      {showQrCode && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-black/80 border border-purple-500/30 p-8 rounded-xl max-w-md w-full">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold mb-2">QR Code</h3>
              <p className="text-muted-foreground">Scan to join the queue</p>
            </div>
            
            <div className="bg-white p-4 rounded-lg mb-6 mx-auto max-w-[200px]">
              {/* This would be the actual QR code in a real implementation */}
              <div className="aspect-square bg-gray-200 flex items-center justify-center">
                <span className="text-black">QR Code Placeholder</span>
              </div>
            </div>
            
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Or join with code: <span className="font-mono text-purple-400">{queue.access_code}</span>
              </p>
              
              <Button
                variant="outline"
                onClick={() => setShowQrCode(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
