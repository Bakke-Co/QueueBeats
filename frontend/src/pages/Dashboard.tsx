import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "../components/Button";
import { Navigation } from "../components/Navigation";
import { useAuth } from "../utils/auth";
import type { Profile } from "../utils/auth";
import { supabase } from "../utils/supabase";
import { getUserQueues, type Queue } from "../utils/queueHelpers";
import { getAuthUrl, isConnectedToSpotify } from "../utils/spotify";
import { Spinner } from "../components/Spinner";
import { AuthInit } from "../components/AuthInit";
import { AuthProvider } from "../components/AuthProvider";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { toast } from "sonner";
import { ToasterProvider } from "../components/ToasterProvider";
import MainLayout from "../components/MainLayout";

export default function Dashboard() {
  return (
    <AuthInit>
      <AuthProvider>
        <ProtectedRoute>
          <ToasterProvider>
            <DashboardContent />
          </ToasterProvider>
        </ProtectedRoute>
      </AuthProvider>
    </AuthInit>
  );
}

function DashboardContent() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [queues, setQueues] = useState<Queue[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingQueues, setLoadingQueues] = useState(true);
  const [isSpotifyConnected, setIsSpotifyConnected] = useState(false);
  const [isCheckingSpotify, setIsCheckingSpotify] = useState(false);
  const [connectingToSpotify, setConnectingToSpotify] = useState(false);
  const [isSpotifyConnectionChecked, setIsSpotifyConnectionChecked] = useState(false);
  
  useEffect(() => {
    // Redirect if not authenticated
    if (!user) {
      navigate('/login');
      return;
    }
    
    // Check if connected to Spotify
    const checkSpotifyConnection = async () => {
      if (!user) return;
      
      // Don't check again if already checking
      if (isCheckingSpotify) return;
      
      try {
        setIsCheckingSpotify(true);
        console.log('Checking Spotify connection for user:', user.id);
        
        // Add retry logic with backoff
        let attempt = 0;
        const maxAttempts = 2;
        let connected = false;
        
        while (attempt < maxAttempts && !connected) {
          try {
            // If this is a retry, wait with exponential backoff
            if (attempt > 0) {
              const backoffMs = Math.pow(2, attempt) * 1000;
              console.log(`Retrying Spotify connection check (attempt ${attempt+1}/${maxAttempts}) after ${backoffMs}ms`);
              await new Promise(resolve => setTimeout(resolve, backoffMs));
            }
            
            // Check connection
            connected = await isConnectedToSpotify(user.id);
            
            // If we got a response (whether true or false), we can stop trying
            break;
          } catch (attemptError) {
            console.error(`Spotify connection check attempt ${attempt+1} failed:`, attemptError);
            attempt++;
          }
        }
        
        // Update state with final result
        setIsSpotifyConnected(connected);
        
      } catch (error) {
        console.error('Error checking Spotify connection:', error);
        // Set to false on error to be safe
        setIsSpotifyConnected(false);
      } finally {
        setIsCheckingSpotify(false);
      }
    };

    // Fetch user profile
    const fetchProfile = async () => {
      try {
        setLoading(true);
        
        // Try to fetch the profile
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url, website')
          .eq('id', user.id)
          .single();
        
        // If there's an error OR no data, create a default profile object to avoid UI issues
        if (error || !data) {
          console.warn('Could not fetch profile, using default placeholder:', error);
          // Use a default profile as a fallback
          setProfile({
            id: user.id,
            created_at: new Date().toISOString(),
            updated_at: null,
            username: null,
            full_name: null,
            avatar_url: null,
            website: null,
          });
        } else {
          setProfile(data as Profile);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
        // Even on error, set a default profile to prevent UI issues
        setProfile({
          id: user.id,
          created_at: new Date().toISOString(),
          updated_at: null,
          username: null,
          full_name: null,
          avatar_url: null,
          website: null,
        });
      } finally {
        setLoading(false);
      }
    };

    // Fetch user queues with timeout and error handling
    const fetchQueues = async () => {
      if (!user) return;
      
      try {
        setLoadingQueues(true);
        
        // Add timeout to prevent hanging
        const fetchPromise = getUserQueues(user.id);
        const timeoutPromise = new Promise<Queue[]>((_, reject) => {
          setTimeout(() => reject(new Error('Fetch queues timed out')), 5000);
        });
        
        try {
          const userQueues = await Promise.race([fetchPromise, timeoutPromise]);
          setQueues(userQueues);
        } catch (timeoutError) {
          console.error('Error or timeout fetching queues:', timeoutError);
          // On timeout, set empty queues array
          setQueues([]);
        }
      } catch (error) {
        console.error('Exception in fetchQueues:', error);
        setQueues([]);
      } finally {
        setLoadingQueues(false);
      }
    };
    
    fetchProfile();
    fetchQueues();
    
    // Use a debounce for Spotify connection check to prevent rapid API calls
    const spotifyCheckTimeout = setTimeout(() => {
      if (!isCheckingSpotify && !isSpotifyConnectionChecked) {
        checkSpotifyConnection();
        setIsSpotifyConnectionChecked(true);
      }
    }, 1000);
    
    return () => {
      // Clean up timeout on unmount
      clearTimeout(spotifyCheckTimeout);
    };
  }, [user, navigate]);
  
  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };
  
  const handleConnectSpotify = async () => {
    if (!user) return;
    
    try {
      setConnectingToSpotify(true);
      
      // Track start time for performance monitoring
      const startTime = Date.now();
      
      // Add retry mechanism with exponential backoff - attempt up to 3 times
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`Attempting to connect to Spotify (Attempt ${attempt}/3)`);
          
          // Add timeout for the getAuthUrl call to prevent hanging
          const authUrlPromise = getAuthUrl();
          const timeoutPromise = new Promise<string>((_, reject) => {
            setTimeout(() => reject(new Error('Spotify auth URL request timed out')), 5000);
          });
          
          const authUrl = await Promise.race([authUrlPromise, timeoutPromise]);
          
          if (!authUrl || !authUrl.includes('accounts.spotify.com')) {
            throw new Error('Invalid Spotify authorization URL received');
          }
          
          // Log performance metrics
          const elapsed = Date.now() - startTime;
          console.log(`Successfully obtained Spotify auth URL in ${elapsed}ms`);
          
          // Save state to localStorage to detect successful return from Spotify OAuth
          localStorage.setItem('spotify_connect_attempt', 'true');
          localStorage.setItem('spotify_connect_timestamp', String(Date.now()));
          
          // Navigate to Spotify auth
          window.location.href = authUrl;
          return; // Success, exit the function
        } catch (error) {
          console.error(`Spotify connection attempt ${attempt} failed:`, 
                        error instanceof Error ? error.message : String(error));
          
          // If this is the last attempt, throw the error to be caught by the outer try/catch
          if (attempt === 3) throw error;
          
          // Otherwise wait with exponential backoff and try again
          const backoffMs = Math.pow(2, attempt) * 1000;
          console.log(`Retrying in ${backoffMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    } catch (error) {
      console.error('All attempts to connect to Spotify failed:', 
                    error instanceof Error ? error.stack : String(error));
      
      // Provide more specific error messages based on the error type
      let errorMessage = 'Failed to connect to Spotify. Please try again.';
      let errorDescription = 'The Spotify integration could not be initialized.';
      
      if (error instanceof Error) {
        // Network-related errors
        if (error.message.includes('Network') || 
            error.message.includes('ECONNREFUSED') || 
            error.message.includes('fetch') ||
            error.message.includes('Failed to fetch')) {
          errorMessage = 'Network error connecting to Spotify.';
          errorDescription = 'Please check your internet connection and try again.';
        } 
        // Timeout errors
        else if (error.message.includes('timeout')) {
          errorMessage = 'Connection to Spotify timed out.';
          errorDescription = 'The server is taking too long to respond. Please try again later.';
        } 
        // Configuration errors
        else if (error.message.includes('config') || error.message.includes('client_id')) {
          errorMessage = 'Spotify configuration error.';
          errorDescription = 'App configuration is missing required Spotify credentials.';
        }
        // Authentication errors
        else if (error.message.includes('auth') || error.message.includes('token')) {
          errorMessage = 'Spotify authentication error.';
          errorDescription = 'There was a problem with your Spotify credentials. Please try reconnecting.';
        }
        // Invalid URL errors
        else if (error.message.includes('URL') || error.message.includes('Invalid')) {
          errorMessage = 'Invalid response from Spotify.';
          errorDescription = 'The application received an invalid response from Spotify. Please try again.';
        }
      }
      
      // Show error toast with more helpful information
      toast.error(errorMessage, {
        description: errorDescription
      });
      
      // Reset connection state
      setIsSpotifyConnected(false);
    } finally {
      setConnectingToSpotify(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <div className="w-12 h-12 border-t-2 border-purple-500 border-solid rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <MainLayout>
      <main className="container mx-auto px-4 py-8 flex justify-center">
        <div className="max-w-4xl mx-auto w-full">
          <h1 className="text-3xl font-bold mb-6 text-center">Welcome{profile?.username ? `, ${profile.username}` : ''}!</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-8">
            <div className="md:col-span-7 bg-black/30 backdrop-blur-sm p-6 rounded-xl border border-white/10 shadow-lg">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold flex items-center">
                  <span className="mr-2 text-purple-400 text-2xl">🎵</span>
                  Your Queues
                </h2>
                <Button 
                  variant="glow" 
                  size="sm"
                  onClick={() => navigate('/create-queue')}
                >
                  Create New Queue
                </Button>
              </div>
              
              {loadingQueues ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-8 h-8 border-t-2 border-purple-500 border-solid rounded-full animate-spin"></div>
                  <span className="ml-3 text-muted-foreground">Loading queues...</span>
                </div>
              ) : queues.length === 0 ? (
                <div className="text-center py-10 border border-dashed border-white/20 rounded-lg">
                  <div className="w-16 h-16 mx-auto flex items-center justify-center rounded-full bg-black/50 mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium mb-2">No Queues Yet</h3>
                  <p className="text-muted-foreground mb-4 max-w-xs mx-auto">Create your first music queue to start collecting song requests from your guests.</p>
                  <Button 
                    variant="default" 
                    onClick={() => navigate('/create-queue')}
                  >
                    Create Your First Queue
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {queues.map((queue) => (
                    <div key={queue.id} className="group relative flex flex-col border border-white/10 rounded-lg overflow-hidden transition-all hover:border-purple-500/50 hover:shadow-[0_0_15px_rgba(168,85,247,0.15)]">
                      <div className="flex items-center justify-between p-4 bg-black/40">
                        <h3 className="font-semibold text-lg truncate">{queue.name}</h3>
                        <div className="flex gap-2">
                          <span className="px-2 py-1 text-xs rounded-full bg-purple-500/20 text-purple-300">
                            {queue.settings?.isPublic ? 'Public' : 'Private'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="p-4 flex-1">
                        {queue.description && (
                          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                            {queue.description}
                          </p>
                        )}
                        
                        <div className="flex flex-wrap gap-y-2 gap-x-4 text-xs text-muted-foreground">
                          <div className="flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {new Date(queue.created_at).toLocaleDateString()}
                          </div>
                          <div className="flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                            </svg>
                            Code: {queue.access_code}
                          </div>
                        </div>
                      </div>
                      
                      <div className="p-4 border-t border-white/10 bg-black/20 flex justify-between">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            const shareUrl = `${window.location.origin}/join-queue?code=${queue.access_code}`;
                            navigator.clipboard.writeText(shareUrl);
                            alert("Queue link copied to clipboard!");
                          }}
                        >
                          Copy Link
                        </Button>
                        <Button 
                          variant="default" 
                          size="sm"
                          onClick={() => navigate(`/queue/${queue.id}`)}
                        >
                          Manage Queue
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="md:col-span-5 bg-black/30 backdrop-blur-sm p-6 rounded-xl border border-white/10 shadow-lg flex flex-col">
              <h2 className="text-xl font-bold mb-4 flex items-center">
                <span className="mr-2 text-purple-400 text-2xl">🎧</span>
                Recent Activity
              </h2>
              <div className="flex-1 flex flex-col items-center justify-center py-10 border border-dashed border-white/20 rounded-lg">
                <div className="w-16 h-16 mx-auto flex items-center justify-center rounded-full bg-black/50 mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-muted-foreground mb-4 text-center">No recent activity to show.</p>
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/join-queue')}
                >
                  Join a Queue
                </Button>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 p-6 rounded-xl border border-white/10 shadow-lg text-center">
            <h2 className="text-xl font-bold mb-2">Connect Your Music Service</h2>
            <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
              Link your Spotify or Apple Music account to start playing tracks from your queue.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              {isCheckingSpotify ? (
                <Button disabled className="bg-[#1DB954]/50">
                  <Spinner size="sm" className="mr-2" />
                  Checking...
                </Button>
              ) : isSpotifyConnected ? (
                <Button 
                  className="bg-[#1DB954] hover:bg-[#1DB954]/90 flex items-center"
                  onClick={() => navigate('/queue-settings')}
                >
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                  Spotify Connected
                </Button>
              ) : (
                <Button 
                  className="bg-[#1DB954] hover:bg-[#1DB954]/90 flex items-center"
                  onClick={handleConnectSpotify}
                  disabled={connectingToSpotify}
                >
                  {connectingToSpotify ? (
                    <>
                      <Spinner size="sm" className="mr-2" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm4.59-12.42L10 14.17l-2.59-2.58L6 13l4 4 8-8z"/>
                      </svg>
                      Connect Spotify
                    </>
                  )}
                </Button>
              )}
              <Button className="bg-[#FB233B] hover:bg-[#FB233B]/90" disabled>
                Connect Apple Music
                <span className="ml-2 text-xs opacity-70">(Coming Soon)</span>
              </Button>
            </div>
          </div>
        </div>
      </main>
    </MainLayout>
  );
}
