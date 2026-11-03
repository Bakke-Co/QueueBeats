import React, { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "./Button";
import { getCurrentPlayingSong, type Song } from "../utils/queueHelpers";
import { useAuth } from "../utils/auth";
import { Spinner } from "./Spinner";
import {
  getValidSpotifyToken,
  initializePlayer,
  isPlayerConnected,
  playTrackOnPlayer,
  skipToNext,
  skipToPrevious,
  togglePlayback,
  disconnectPlayer,
  getPlayerDeviceId,
  isConnectedToSpotify
} from "../utils/spotify";

interface Props {
  queueId: string;
  onRefresh?: () => void;
}

// Format milliseconds to MM:SS format
const formatTime = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export function NowPlaying({ queueId, onRefresh }: Props) {
  const { user } = useAuth();
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [progressMs, setProgressMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [spotifyReady, setSpotifyReady] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const playerCheckInterval = useRef<number | null>(null);
  const progressInterval = useRef<number | null>(null);
  const spotifyToken = useRef<string | null>(null);
  
  // Check Spotify connection
  useEffect(() => {
    const checkSpotifyConnection = async () => {
      if (!user) return;

      try {
        const connected = await isConnectedToSpotify(user.id);
        setSpotifyConnected(connected);

        if (connected) {
          // Get a valid token
          const token = await getValidSpotifyToken(user.id);
          if (token) {
            spotifyToken.current = token;
            setInitializing(true);
          }
        }
      } catch (error) {
        console.error("Error checking Spotify connection:", error);
      }
    };

    checkSpotifyConnection();
  }, [user]);

  // Initialize Spotify player
  useEffect(() => {
    if (!initializing || !spotifyToken.current) return;

    const setupPlayer = async () => {
      try {
        if (!spotifyToken.current) return;

        // Initialize the Spotify Web Playback SDK
        await initializePlayer(spotifyToken.current);
        setSpotifyReady(true);
        setError(null);

        // Set up player state check interval
        if (playerCheckInterval.current) {
          window.clearInterval(playerCheckInterval.current);
        }

        playerCheckInterval.current = window.setInterval(() => {
          const connected = isPlayerConnected();
          if (!connected && spotifyReady) {
            setSpotifyReady(false);
            setError("Spotify player disconnected. Please refresh the page.");
          }
        }, 5000);

      } catch (error) {
        console.error("Error initializing Spotify player:", error);
        setError(
          error instanceof Error 
            ? error.message 
            : "Failed to initialize Spotify player. Please refresh the page."
        );
      } finally {
        setInitializing(false);
      }
    };

    setupPlayer();

    // Clean up
    return () => {
      if (playerCheckInterval.current) {
        window.clearInterval(playerCheckInterval.current);
        playerCheckInterval.current = null;
      }
      disconnectPlayer();
    };
  }, [initializing]);

  // Fetch the currently playing song
  useEffect(() => {
    const fetchCurrentSong = async () => {
      try {
        setLoading(true);
        const song = await getCurrentPlayingSong(queueId);
        setCurrentSong(song);

        // If the song changed and we have Spotify, play it
        if (song && spotifyReady && spotifyToken.current && song.track_uri) {
          await playTrackOnPlayer(spotifyToken.current, song.track_uri);
          setIsPlaying(true);
          
          // Reset and start progress
          setProgress(0);
          setProgressMs(0);
          startProgressTracking(song.duration || 0);
        }
      } catch (error) {
        console.error("Error fetching current song:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchCurrentSong();
    
    // Refresh every 15 seconds
    const interval = setInterval(fetchCurrentSong, 15000);
    return () => clearInterval(interval);
  }, [queueId, spotifyReady]);
  
  // Progress tracking function
  const startProgressTracking = useCallback((durationMs: number) => {
    // Clear any existing interval
    if (progressInterval.current) {
      window.clearInterval(progressInterval.current);
      progressInterval.current = null;
    }

    if (!durationMs) return;

    // Start a new interval to update progress
    const intervalTime = 500; // Update every 500ms
    let elapsed = 0;

    progressInterval.current = window.setInterval(() => {
      if (!isPlaying) return;

      elapsed += intervalTime;
      setProgressMs(elapsed);
      
      const percentage = (elapsed / durationMs) * 100;
      setProgress(Math.min(percentage, 100));

      if (elapsed >= durationMs) {
        if (progressInterval.current) {
          window.clearInterval(progressInterval.current);
          progressInterval.current = null;
        }
      }
    }, intervalTime);
  }, [isPlaying]);

  // Cleanup progress interval on unmount
  useEffect(() => {
    return () => {
      if (progressInterval.current) {
        window.clearInterval(progressInterval.current);
        progressInterval.current = null;
      }
    };
  }, []);
  
  const handlePlayPause = async () => {
    if (!currentSong) return;

    if (spotifyReady && spotifyToken.current) {
      // Use Spotify to control playback
      const success = await togglePlayback(spotifyToken.current);
      if (success) {
        setIsPlaying(!isPlaying);
      }
    } else {
      // Use local playback control
      setIsPlaying(!isPlaying);
      if (progress >= 100) {
        setProgress(0);
        setProgressMs(0);
      }

      if (!isPlaying && currentSong.duration) {
        startProgressTracking(currentSong.duration);
      }
    }
  };

  const handlePrevious = async () => {
    if (!spotifyReady || !spotifyToken.current) return;
    
    await skipToPrevious(spotifyToken.current);
  };

  const handleNext = async () => {
    if (!spotifyReady || !spotifyToken.current) return;
    
    await skipToNext(spotifyToken.current);
  };
  
  if (loading) {
    return (
      <div className="bg-black/40 border border-white/10 rounded-xl p-4 animate-pulse">
        <div className="h-6 w-48 bg-white/10 rounded mb-6"></div>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/10 rounded"></div>
          <div className="flex-1">
            <div className="h-4 w-36 bg-white/10 rounded mb-2"></div>
            <div className="h-3 w-24 bg-white/10 rounded"></div>
          </div>
        </div>
      </div>
    );
  }
  
  if (!currentSong) {
    return (
      <div className="bg-black/40 border border-white/10 rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4">Now Playing</h2>
        <div className="text-center py-6">
          <div className="w-16 h-16 mx-auto flex items-center justify-center rounded-full bg-black/50 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <p className="text-muted-foreground mb-4">
            No song is currently playing.
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-white/10 rounded-xl p-6">
      <h2 className="text-xl font-semibold mb-4">Now Playing</h2>
      
      <div className="flex items-center gap-4 mb-4">
        {currentSong.cover_url ? (
          <img 
            src={currentSong.cover_url} 
            alt={`${currentSong.title} cover`} 
            className="w-16 h-16 object-cover rounded-lg ring-2 ring-purple-500/50"
          />
        ) : (
          <div className="w-16 h-16 bg-black/50 rounded-lg flex items-center justify-center ring-2 ring-purple-500/50">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
        )}
        
        <div className="flex-1">
          <h3 className="font-semibold text-lg">{currentSong.title}</h3>
          <p className="text-sm text-muted-foreground">{currentSong.artist}</p>
        </div>
      </div>
      
      {/* Progress bar */}
      <div className="mb-3">
        <div className="relative w-full h-1.5 bg-white/10 rounded overflow-hidden">
          <div 
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-500 to-pink-500"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        {currentSong?.duration && (
          <div className="flex justify-between text-xs text-white/60 mt-1">
            <span>{formatTime(progressMs)}</span>
            <span>{formatTime(currentSong.duration)}</span>
          </div>
        )}
      </div>
      
      {/* Controls */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-center items-center gap-4">
          <button 
            className="w-10 h-10 flex items-center justify-center rounded-full bg-black/40 text-white/80 hover:bg-white/20 transition-colors"
            onClick={handlePrevious}
            disabled={!spotifyReady}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
            </svg>
          </button>
          
          <button 
            className="w-12 h-12 flex items-center justify-center rounded-full bg-purple-500 hover:bg-purple-600 transition-colors"
            onClick={handlePlayPause}
          >
            {initializing ? (
              <Spinner size="sm" />
            ) : isPlaying ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </button>
          
          <button 
            className="w-10 h-10 flex items-center justify-center rounded-full bg-black/40 text-white/80 hover:bg-white/20 transition-colors"
            onClick={handleNext}
            disabled={!spotifyReady}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
            </svg>
          </button>
        </div>
        
        {error && (
          <div className="text-xs text-red-400 text-center mt-2">
            {error}
          </div>
        )}
        
        {spotifyReady && (
          <div className="flex items-center justify-center mt-1">
            <div className="flex items-center px-2 py-1 bg-[#1DB954]/20 rounded-full">
              <svg viewBox="0 0 24 24" className="h-3 w-3 mr-1 text-[#1DB954]" fill="currentColor">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
              <span className="text-xs text-white">Playing on Spotify</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
