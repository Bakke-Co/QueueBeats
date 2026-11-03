import { ErrorBoundary } from "react-error-boundary";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { Head } from "./internal-components/Head";
import { ThemeProvider } from "./internal-components/ThemeProvider";
import { DEFAULT_THEME } from "./constants/default-theme";
import { AuthProvider } from "./components/AuthProvider";
import { AuthInit } from "./components/AuthInit";
import { useState, useEffect } from "react";
import { checkDatabaseHealth, setupMissingTables, HealthCheckResult } from "./utils/databaseHealth";

// Error fallback component
const ErrorFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
  <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
    <div className="max-w-md w-full bg-black/30 backdrop-blur-sm p-6 rounded-xl border border-red-500/30 shadow-xl">
      <div className="w-12 h-12 mx-auto bg-red-500/20 rounded-full flex items-center justify-center mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h2 className="text-xl font-bold mb-2 text-center">Something went wrong</h2>
      <p className="text-muted-foreground mb-4 text-center">{error.message}</p>
      <div className="text-xs text-muted-foreground mb-4 p-2 bg-black/20 rounded overflow-auto max-h-32">
        {error.stack}
      </div>
      <button
        onClick={resetErrorBoundary}
        className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
      >
        Try again
      </button>
    </div>
  </div>
);

// Database Health Check Component
const DatabaseHealthCheck = ({ onSetupComplete }: { onSetupComplete: () => void }) => {
  const [healthResult, setHealthResult] = useState<HealthCheckResult | null>(null);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [setupMessage, setSetupMessage] = useState<string | null>(null);
  
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const result = await checkDatabaseHealth();
        setHealthResult(result);
      } catch (error) {
        console.error('Error checking database health:', error);
        setHealthResult({
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
          message: 'Failed to check database health'
        });
      }
    };
    
    checkHealth();
  }, []);
  
  const handleSetupDatabase = async () => {
    if (!healthResult || healthResult.status !== 'missing_tables' || !healthResult.missing_tables) {
      return;
    }
    
    setIsSettingUp(true);
    setSetupMessage('Setting up missing database tables...');
    
    try {
      const result = await setupMissingTables(healthResult.missing_tables);
      
      if (result.success) {
        setSetupMessage('Database setup completed successfully!');
        // Wait a moment to show success message
        setTimeout(() => {
          onSetupComplete();
        }, 1500);
      } else {
        setSetupMessage(`Setup failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error setting up database:', error);
      setSetupMessage(`Setup error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSettingUp(false);
    }
  };
  
  if (!healthResult) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="p-8 max-w-md w-full bg-card rounded-lg shadow-lg border border-border">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Checking Database Health...</h2>
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (healthResult.status === 'healthy') {
    // Automatically continue if healthy
    setTimeout(() => onSetupComplete(), 0);
    return null;
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">
      <div className="max-w-md w-full bg-card p-8 rounded-lg shadow-lg border border-border">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold">{healthResult.status === 'missing_tables' ? 'Database Setup Required' : 'Database Unavailable'}</h2>
          <p className="text-muted-foreground mt-2">
            {healthResult.message || 'Some required database tables are missing.'}
          </p>
        </div>
        
        {healthResult.status === 'missing_tables' && healthResult.missing_tables && (
          <div className="mb-6">
            <h3 className="font-medium mb-2">Missing Tables:</h3>
            <ul className="list-disc list-inside text-sm text-muted-foreground bg-muted p-3 rounded">
              {healthResult.missing_tables.map(table => (
                <li key={table}>{table}</li>
              ))}
            </ul>
          </div>
        )}
        
        {setupMessage && (
          <div className={`p-3 rounded mb-4 ${
            setupMessage.includes('failed') || setupMessage.includes('error') 
              ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' 
              : setupMessage.includes('success') 
                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
          }`}>
            {setupMessage}
          </div>
        )}
        
        <div className="flex flex-col space-y-3">
          <button
            onClick={handleSetupDatabase}
            disabled={isSettingUp || healthResult.status !== 'missing_tables'}
            className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSettingUp ? (
              <span className="flex items-center justify-center">
                <span className="animate-spin mr-2 h-4 w-4 border-2 border-b-transparent rounded-full"></span>
                Setting Up Database...
              </span>
            ) : (
              'Set Up Database'
            )}
          </button>
          
          <button
            onClick={onSetupComplete}
            className="w-full px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors"
          >
            Continue Anyway
          </button>
        </div>
        
        <div className="mt-6 text-xs text-muted-foreground text-center">
          <p>Note: The application may not function correctly without the required database tables.</p>
        </div>
      </div>
    </div>
  );
};

export const AppWrapper = () => {
  const [databaseChecked, setDatabaseChecked] = useState(false);
  
	return (
		<ThemeProvider defaultTheme={DEFAULT_THEME}>
			<ErrorBoundary
				FallbackComponent={ErrorFallback}
				onError={(error) => {
					console.error(
						"Caught error in AppWrapper",
						error.message,
						error.stack,
					);
				}}
				onReset={() => {
					// Reset the state of your app here
					window.location.href = '/';
				}}
			>
        {!databaseChecked ? (
          <DatabaseHealthCheck onSetupComplete={() => setDatabaseChecked(true)} />
        ) : (
          <AuthInit>
            <AuthProvider>
              <RouterProvider router={router} />
              <Head />
            </AuthProvider>
          </AuthInit>
        )}
			</ErrorBoundary>
		</ThemeProvider>
	);
};
