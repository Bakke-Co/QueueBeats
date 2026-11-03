import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import { storeSpotifyTokens, exchangeCodeForToken } from '../utils/spotify';
import { LoadingIndicator, ErrorAlert } from '../components/common';
import { ensureSpotifyTokensTable } from '../utils/setupDatabase';

type SpotifyCallbackState = 'loading' | 'connecting' | 'setup' | 'error' | 'success';

const SpotifyCallback = () => {
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<SpotifyCallbackState>('loading');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        setState('loading');
        
        // Extract the authorization code from URL
        const params = new URLSearchParams(location.search);
        const code = params.get('code');
        const error = params.get('error');

        if (error) {
          console.error('Error during Spotify authorization:', error);
          setError(`Spotify authorization error: ${error}`);
          setState('error');
          return;
        }

        if (!code) {
          console.error('No authorization code found in callback URL');
          setError('No authorization code found in callback URL');
          setState('error');
          return;
        }

        // Get the current user session
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Error getting user session:', sessionError);
          setError('Authentication error. Please log in again.');
          setState('error');
          return;
        }

        if (!sessionData.session) {
          console.error('No active session found');
          setError('No active session found. Please log in again.');
          setState('error');
          return;
        }

        const userId = sessionData.session.user.id;
        
        // Before proceeding, check if the necessary database table exists
        console.log('Checking if spotify_tokens table exists...');
        setState('setup');
        const setupResult = await ensureSpotifyTokensTable();
        
        if (!setupResult.success) {
          console.error('Failed to set up database:', setupResult.message);
          setError(setupResult.message);
          setState('error');
          // Stop before exchanging or storing tokens.
          return;
        }
        
        console.log('Database setup verified, proceeding with token exchange...');
        setState('connecting');
        
        // Exchange the code for access and refresh tokens
        try {
          console.log('Exchanging authorization code for tokens...');
          const tokens = await exchangeCodeForToken(code);
          
          if (!tokens) {
            console.error('Failed to exchange code for tokens');
            setError('Failed to connect to Spotify. Please try again.');
            setState('error');
            return;
          }
          
          console.log('Successfully received tokens from Spotify');
          
          // Store the tokens in Supabase
          try {
            const storeResult = await storeSpotifyTokens({
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token,
              expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in
            });
            
            if (!storeResult) {
              console.error('Failed to store Spotify tokens');
              setError('Failed to save Spotify connection. Please try again.');
              setState('error');
              return;
            }
            
            console.log('Successfully stored Spotify tokens');
            setState('success');
            
            // Return to queue selection and Spotify controls.
            setTimeout(() => {
              navigate('/dashboard', { replace: true });
            }, 1000); // Slight delay to show success state
          } catch (storeError) {
            console.error('Error storing Spotify tokens:', storeError);
            setError('Error saving Spotify connection. Please try again.');
            setState('error');
          }
        } catch (tokenError) {
          console.error('Error exchanging code for tokens:', tokenError);
          setError('Error connecting to Spotify. Please try again.');
          setState('error');
        }
      } catch (e) {
        console.error('Unexpected error in Spotify callback:', e);
        setError('An unexpected error occurred. Please try again.');
        setState('error');
      }
    };

    handleCallback();
  }, [location, navigate]);

  // Error state
  if (state === 'error' && error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-md">
          <div className="text-center">
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Spotify Connection Error</h2>
            <ErrorAlert message={error} />
            <div className="mt-6">
              <button
                onClick={() => navigate('/dashboard', { replace: true })}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Setup state
  if (state === 'setup') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-md">
          <div className="text-center">
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Checking Spotify Integration</h2>
            <p className="mt-2 text-sm text-gray-600">
              Please wait while we check Spotify connection storage.
            </p>
            <div className="mt-6">
              <LoadingIndicator />
            </div>
            <div className="mt-6">
              <button
                onClick={() => navigate('/spotify-setup')}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Go to Setup Page
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Success state
  if (state === 'success') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-md">
          <div className="text-center">
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Successfully Connected!</h2>
            <p className="mt-2 text-sm text-gray-600">
              Your Spotify account is now connected to QueueBeats.
            </p>
            <div className="mt-6">
              <svg
                className="mx-auto h-12 w-12 text-green-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <div className="mt-6">
              <p className="text-sm text-gray-500">Redirecting you to the app...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loading or connecting state (default)
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-md">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            {state === 'connecting' ? 'Connecting to Spotify' : 'Loading...'}
          </h2>
          <p className="mt-2 text-sm text-gray-600">Please wait while we connect your account...</p>
          <div className="mt-6">
            <LoadingIndicator />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpotifyCallback;
