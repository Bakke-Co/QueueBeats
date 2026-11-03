import React, { useState } from "react";
import { Button } from "./Button";
import { voteForSong } from "../utils/queueHelpers";

export interface Song {
  id: string;
  created_at?: string;
  title: string;
  artist: string;
  album?: string;
  cover_url?: string;
  total_votes: number;
  user_has_voted?: boolean;
  position?: number;
  played?: boolean;
  played_at?: string;
}

export interface Props {
  song: Song;
  index: number;
  isGuest?: boolean;
  userId?: string;
  onVote?: (songId: string) => void;
  onPlayNow?: (songId: string) => void;
  refreshSongs?: () => void;
}

export const SongRow: React.FC<Props> = ({ 
  song, 
  index, 
  isGuest = false,
  userId,
  onVote,
  onPlayNow,
  refreshSongs
}) => {
  const [isVoting, setIsVoting] = useState(false);
  const [voteSuccess, setVoteSuccess] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  
  const handleVote = async () => {
    if (!userId) return;
    
    try {
      setIsVoting(true);
      setVoteError(null);
      
      // Call the voteForSong function
      await voteForSong(song.id, userId);
      
      // Show success indicator briefly
      setVoteSuccess(true);
      setTimeout(() => setVoteSuccess(false), 2000);
      
      // Call the onVote callback if provided
      if (onVote) {
        onVote(song.id);
      }
      
      // Refresh the songs list if the callback is provided
      if (refreshSongs) {
        refreshSongs();
      }
    } catch (err: any) {
      console.error("Error voting for song:", err);
      setVoteError("Failed to vote. Please try again.");
      setTimeout(() => setVoteError(null), 3000);
    } finally {
      setIsVoting(false);
    }
  };
  
  return (
    <div className="p-3 md:p-4 hover:bg-white/5 hover:bg-gradient-to-r hover:from-purple-900/10 hover:to-transparent flex items-center gap-2 md:gap-4 transition-all relative overflow-hidden group">
      {/* Rank number */}
      <div className="w-8 h-8 flex items-center justify-center text-lg font-medium bg-black/30 rounded-full border border-white/10 group-hover:border-purple-500/30 transition-colors">
        {index + 1}
      </div>
      
      {/* Album cover */}
      {song.cover_url ? (
        <img
          src={song.cover_url}
          alt={`${song.title} cover`}
          className="w-12 h-12 md:w-14 md:h-14 object-cover rounded-md shadow-glow-sm group-hover:shadow-glow transition-all duration-300 transform group-hover:scale-105"
        />
      ) : (
        <div className="w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br from-purple-900/30 to-black rounded-md flex items-center justify-center shadow-glow-sm group-hover:shadow-glow transition-all duration-300 transform group-hover:scale-105">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
          </svg>
        </div>
      )}
      
      {/* Song info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium truncate group-hover:text-purple-300 transition-colors">{song.title}</h3>
        <p className="text-sm text-muted-foreground truncate">{song.artist}</p>
        {song.played && (
          <div className="mt-1 inline-flex items-center gap-1 bg-purple-900/30 px-2 py-0.5 rounded-full text-xs text-purple-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Playing</span>
          </div>
        )}
      </div>
      
      {/* Vote count and button */}
      <div className="flex items-center gap-2">
        {/* Vote count indicator */}
        <div 
          className={`flex items-center px-3 py-1 rounded-full ${song.user_has_voted 
            ? 'bg-purple-500/30 text-purple-300 shadow-glow-sm' 
            : 'bg-purple-500/20 text-purple-400'} transition-all transform hover:scale-105`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
          </svg>
          <span>{song.total_votes || 0}</span>
        </div>
        
        {/* Vote button - only show for guests or if isGuest is true */}
        {(isGuest || !onPlayNow) && userId && (
          <Button
            variant={song.user_has_voted ? "outline" : "glow"}
            size="sm"
            disabled={isVoting || song.user_has_voted}
            onClick={handleVote}
            className={`relative ${song.user_has_voted ? 'opacity-80 border-purple-500/40' : ''} px-6 py-2 h-auto touch-manipulation`}
          >
            {isVoting ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </span>
            ) : song.user_has_voted ? (
              <span className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Voted
              </span>
            ) : (
              "Vote"
            )}
            
            {/* Success animation */}
            {voteSuccess && (
              <span className="absolute inset-0 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-400 animate-scale-in" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </span>
            )}
          </Button>
        )}
        
        {/* Play Now button - only show for DJ view */}
        {onPlayNow && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPlayNow(song.id)}
          >
            Play Now
          </Button>
        )}
      </div>
      
      {/* Error message */}
      {voteError && (
        <div className="absolute bottom-0 left-0 right-0 bg-red-500/80 text-white text-center py-1 text-sm">
          {voteError}
        </div>
      )}
    </div>
  );
};
