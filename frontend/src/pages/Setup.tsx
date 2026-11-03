import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { validateSupabaseConfig } from "../utils/supabase";
import brain from "../brain";

export default function Setup() {
  const navigate = useNavigate();
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [supabaseAnonKey, setSupabaseAnonKey] = useState("");
  const [isConfigVerified, setIsConfigVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [debug, setDebug] = useState<Record<string, any>>({});
  const [testUserData, setTestUserData] = useState<{
    email: string;
    password: string;
    queue_access_code: string;
  } | null>(null);

  // Force dark theme
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  // Save current debug information
  useEffect(() => {
    setDebug({
      origin: window.location.origin,
      hostname: window.location.hostname,
      pathname: window.location.pathname,
      search: window.location.search,
      href: window.location.href,
      protocol: window.location.protocol,
      port: window.location.port,
    });

  }, []);

  // Verify the deployed configuration without changing browser or server credentials.
  const checkSupabaseConfig = async () => {
    setLoading(true);
    setIsConfigVerified(false);
    setError(null);
    setSuccess(null);

    try {
      if (!supabaseUrl || !supabaseAnonKey) {
        setError("Both Supabase URL and Anon Key are required");
        setLoading(false);
        return;
      }

      const initialized = await validateSupabaseConfig(supabaseUrl, supabaseAnonKey);
      if (!initialized) {
        throw new Error("Could not verify the deployed configuration. Changing projects requires an administrator to update the deployment.");
      }

      setIsConfigVerified(true);
      setSuccess("The deployed database connection is available. Configuration was not changed.");
      toast.success("Deployed connection verified.");
    } catch (error: any) {
      console.error("Error verifying deployed configuration:", error);
      setError(error.message || "Failed to verify the deployed configuration");
      toast.error("Failed to connect to Supabase");
    } finally {
      setLoading(false);
    }
  };

  // Function to set up database tables
  const setupDatabase = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await brain.setup_database();
      const data = await response.json();
      
      if (data.success) {
        setSuccess("Database setup initiated successfully! Now copy and run the SQL in your Supabase SQL Editor.");
        toast.success("Database setup initiated!");
      } else {
        throw new Error(data.message || "Failed to set up database");
      }
    } catch (error: any) {
      console.error("Error setting up database:", error);
      setError(error.message || "Failed to set up database");
      toast.error(`Database setup failed: ${error.message || 'Unknown error'}`);  
    } finally {
      setLoading(false);
    }
  };

  // Function to create test data
  const createTestData = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await brain.create_test_data();
      const data = await response.json();
      
      if (data.success) {
        setSuccess("Test data created successfully!");
        setTestUserData(data.test_user);
        toast.success("Test data created!");
      } else {
        throw new Error(data.message || "Failed to create test data");
      }
    } catch (error: any) {
      console.error("Error creating test data:", error);
      setError(error.message || "Failed to create test data");
      toast.error(`Failed to create test data: ${error.message || 'Unknown error'}`);  
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        toast.success("Copied to clipboard!");
      },
      () => {
        toast.error("Failed to copy");
      }
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-purple-950 text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent mb-2">
            QueueBeats Setup
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Configure your application and database settings
          </p>
        </header>

        <Tabs defaultValue="config" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="config">Configuration</TabsTrigger>
            <TabsTrigger value="database">Database</TabsTrigger>
            <TabsTrigger value="debug">Debug Info</TabsTrigger>
          </TabsList>

          <TabsContent value="config">
            <Card className="bg-black/30 backdrop-blur-sm border-gray-800">
              <CardHeader>
                <CardTitle>Supabase Configuration</CardTitle>
                <CardDescription className="text-gray-400">
                  Verify the deployed database connection. This form does not change configuration.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {error && (
                  <Alert variant="destructive" className="mb-6 bg-red-950/50 border-red-900">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {success && (
                  <Alert className="mb-6 bg-green-950/50 border-green-900">
                    <AlertTitle>Success</AlertTitle>
                    <AlertDescription>{success}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="supabaseUrl">Supabase URL</Label>
                    <Input
                      id="supabaseUrl"
                      placeholder="https://your-project.supabase.co"
                      value={supabaseUrl}
                      onChange={(e) => setSupabaseUrl(e.target.value)}
                      className="bg-black/20 border-gray-700"
                    />
                    <p className="text-xs text-gray-400">
                      Found in the Project Settings {">"}  API in your Supabase dashboard
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="supabaseAnonKey">Supabase Anon Key</Label>
                    <Input
                      id="supabaseAnonKey"
                      placeholder="your-anon-key"
                      value={supabaseAnonKey}
                      onChange={(e) => setSupabaseAnonKey(e.target.value)}
                      className="bg-black/20 border-gray-700"
                    />
                    <p className="text-xs text-gray-400">
                      Found in the Project Settings {">"}  API {">"} Project API keys in your Supabase dashboard
                    </p>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/')}
                  className="border-gray-700 text-gray-300 hover:bg-gray-800"
                >
                  Back to Home
                </Button>
                <Button 
                  onClick={checkSupabaseConfig}
                  disabled={loading}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                >
                  {loading ? 'Checking...' : 'Verify Deployed Configuration'}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="database">
            <Card className="bg-black/30 backdrop-blur-sm border-gray-800">
              <CardHeader>
                <CardTitle>Database Management</CardTitle>
                <CardDescription className="text-gray-400">
                  Set up database tables and test data
                </CardDescription>
              </CardHeader>
              <CardContent>
                {error && (
                  <Alert variant="destructive" className="mb-6 bg-red-950/50 border-red-900">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {success && (
                  <Alert className="mb-6 bg-green-950/50 border-green-900">
                    <AlertTitle>Success</AlertTitle>
                    <AlertDescription>{success}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-6">
                  <div className="space-y-2">
                    <h3 className="text-lg font-medium">Initialize Database</h3>
                    <p className="text-sm text-gray-400">
                      Create the required tables in your Supabase database. This only needs to be done once.
                    </p>
                    <div className="bg-black/40 p-4 rounded-md overflow-x-auto my-4">
                      <p className="mb-2 text-sm font-medium">SQL to run in Supabase SQL Editor:</p>
                      <pre className="text-xs text-gray-300 whitespace-pre-wrap">{`CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  website TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS queues (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  access_code TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  settings JSONB DEFAULT '{}'::JSONB
);

CREATE TABLE IF NOT EXISTS songs (
  id UUID PRIMARY KEY,
  queue_id UUID REFERENCES queues ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users ON DELETE SET NULL,
  title TEXT NOT NULL,
  artist TEXT,
  album TEXT,
  cover_url TEXT,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  played BOOLEAN DEFAULT FALSE,
  played_at TIMESTAMP WITH TIME ZONE,
  track_uri TEXT,
  total_votes INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS votes (
  id UUID PRIMARY KEY,
  song_id UUID REFERENCES songs ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(song_id, user_id)
);`}</pre>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-2" 
                        onClick={() => copyToClipboard(`CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  website TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS queues (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  access_code TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  settings JSONB DEFAULT '{}'::JSONB
);

CREATE TABLE IF NOT EXISTS songs (
  id UUID PRIMARY KEY,
  queue_id UUID REFERENCES queues ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users ON DELETE SET NULL,
  title TEXT NOT NULL,
  artist TEXT,
  album TEXT,
  cover_url TEXT,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  played BOOLEAN DEFAULT FALSE,
  played_at TIMESTAMP WITH TIME ZONE,
  track_uri TEXT,
  total_votes INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS votes (
  id UUID PRIMARY KEY,
  song_id UUID REFERENCES songs ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(song_id, user_id)
);`)}
                      >
                        Copy SQL
                      </Button>
                    </div>
                    <Button 
                      onClick={setupDatabase} 
                      disabled={loading || !isConfigVerified}
                      className="mt-2 bg-blue-600 hover:bg-blue-700"
                    >
                      {loading ? 'Setting Up...' : 'Setup Database Tables'}
                    </Button>
                    {!isConfigVerified && (
                      <p className="text-xs text-amber-400 mt-2">
                        You must verify the deployed configuration in the Configuration tab before setting up the database.
                      </p>
                    )}
                  </div>

                  <Separator className="bg-gray-800" />

                  <div className="space-y-2">
                    <h3 className="text-lg font-medium">Create Test Data</h3>
                    <p className="text-sm text-gray-400">
                      Populate your database with sample data for testing. Only use this for development.
                    </p>
                    <Button 
                      onClick={createTestData} 
                      disabled={loading || !isConfigVerified}
                      className="mt-2 bg-amber-600 hover:bg-amber-700"
                    >
                      {loading ? 'Creating...' : 'Create Test Data'}
                    </Button>
                    {!isConfigVerified && (
                      <p className="text-xs text-amber-400 mt-2">
                        You must verify the deployed configuration in the Configuration tab before creating test data.
                      </p>
                    )}
                  </div>

                  {testUserData && (
                    <div className="mt-4 p-4 bg-black/50 rounded-md">
                      <h3 className="font-semibold mb-2">Test User Credentials</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Email:</span>
                          <code className="bg-black/40 px-2 py-1 rounded">
                            {testUserData.email}
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="ml-2 h-5 px-1"
                              onClick={() => copyToClipboard(testUserData.email)}
                            >
                              Copy
                            </Button>
                          </code>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Password:</span>
                          <code className="bg-black/40 px-2 py-1 rounded">
                            {testUserData.password}
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="ml-2 h-5 px-1"
                              onClick={() => copyToClipboard(testUserData.password)}
                            >
                              Copy
                            </Button>
                          </code>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Queue Access Code:</span>
                          <code className="bg-black/40 px-2 py-1 rounded">
                            {testUserData.queue_access_code}
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="ml-2 h-5 px-1"
                              onClick={() => copyToClipboard(testUserData.queue_access_code)}
                            >
                              Copy
                            </Button>
                          </code>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/')}
                  className="border-gray-700 text-gray-300 hover:bg-gray-800"
                >
                  Back to Home
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="debug">
            <Card className="bg-black/30 backdrop-blur-sm border-gray-800">
              <CardHeader>
                <CardTitle>Debugging Information</CardTitle>
                <CardDescription className="text-gray-400">
                  Technical details to help troubleshoot connection issues
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-medium mb-2">Location</h3>
                    <div className="bg-black/40 p-4 rounded-md overflow-x-auto">
                      <pre className="text-xs text-gray-300">
                        {JSON.stringify(debug, null, 2)}
                      </pre>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium mb-2">API Test</h3>
                    <Button 
                      onClick={async () => {
                        setLoading(true);
                        try {
                          // Test the health check endpoint
                          const response = await fetch('/api/debug/health');
                          const text = await response.text();
                          
                          try {
                            const data = JSON.parse(text);
                            setSuccess(`API connection successful: ${JSON.stringify(data)}`);
                          } catch (e) {
                            setSuccess(`API responded with: ${text}`);
                          }
                        } catch (error: any) {
                          setError(`API connection error: ${error.message}`);
                        } finally {
                          setLoading(false);
                        }
                      }} 
                      disabled={loading}
                      className="bg-violet-600 hover:bg-violet-700"
                    >
                      {loading ? 'Testing...' : 'Test API Connection'}
                    </Button>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/')}
                  className="border-gray-700 text-gray-300 hover:bg-gray-800"
                >
                  Back to Home
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}