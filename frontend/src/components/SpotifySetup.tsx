import React, { useState, useEffect } from 'react';
import { ensureSpotifyTokensTable } from '../utils/setupDatabase';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabase';

type SetupStatus = 'loading' | 'success' | 'error' | 'not_needed';

export function SpotifySetup() {
  const [setupStatus, setSetupStatus] = useState<SetupStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();
  
  useEffect(() => {
    checkAndSetupDatabase();
  }, []);
  
  const checkAndSetupDatabase = async () => {
    try {
      console.log('Starting database setup check...');
      
      // Check for authentication first
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('No active session, redirecting to login...');
        setSetupStatus('error');
        setErrorMessage('Authentication required. Please log in first.');
        return;
      }
      
      // Check storage availability without provisioning schema.
      const result = await ensureSpotifyTokensTable();
      
      if (result.success) {
        console.log('Database setup successful:', result.message);
        setSetupStatus('success');
      } else {
        console.error('Database setup failed:', result.message);
        setSetupStatus('error');
        setErrorMessage(result.message || 'Failed to set up database');
      }
    } catch (error) {
      console.error('Unexpected error during setup:', error);
      setSetupStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Unexpected error during setup');
    }
  };
  
  const handleContinue = () => {
    // Redirect to Spotify auth page or back to the previous page
    navigate('/spotify-auth');
  };
  
  const handleRetry = () => {
    setSetupStatus('loading');
    checkAndSetupDatabase();
  };
  
  if (setupStatus === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500 mb-4"></div>
        <h3 className="text-lg font-semibold">Checking Spotify Integration Setup...</h3>
        <p className="text-sm text-gray-600 mt-2">This will only take a moment.</p>
      </div>
    );
  }
  
  if (setupStatus === 'error') {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-red-50 rounded-lg border border-red-200">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="text-xl font-bold text-red-700">Database Setup Error</h3>
        <p className="text-center my-4 text-red-600">{errorMessage}</p>
        <div className="flex space-x-4">
          <button 
            onClick={handleRetry}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Retry Check
          </button>
          <button 
            onClick={() => navigate('/')}
            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-100 transition-colors"
          >
            Back to Home
          </button>
        </div>
        <p className="text-sm text-gray-600 mt-6">
          If this issue persists, please contact support for assistance.
        </p>
      </div>
    );
  }
  
  if (setupStatus === 'success') {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-green-50 rounded-lg border border-green-200">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-green-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <h3 className="text-xl font-bold text-green-700">Spotify Storage Available</h3>
        <p className="text-center my-4 text-green-600">
          The Spotify integration is now ready to use!
        </p>
        <button 
          onClick={handleContinue}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
        >
          Continue to Spotify
        </button>
      </div>
    );
  }
  
  // not_needed case - shouldn't really get here directly
  return null;
}
