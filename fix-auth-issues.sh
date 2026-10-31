#!/bin/bash
# QueueBeats Authentication Fix Script
# This script fixes Supabase authentication issues in the QueueBeats application

echo "QueueBeats Authentication Fix Script"
echo "===================================="

# Step 1: Check if backend is running on port 8001
echo -e "\n[1/5] Checking backend service status..."
if lsof -i :8001 | grep LISTEN > /dev/null; then
    echo "✅ Backend service is running on port 8001"
else
    echo "⚠️ Backend service is not running on port 8001. Starting it now..."
    cd "$(dirname "$0")/backend" && nohup uvicorn main:app --reload --port 8001 &
    echo "Backend started on port 8001"
fi

# Step 2: Check and update environment variables
echo -e "\n[2/5] Checking environment variables..."
ENV_FILE="$(dirname "$0")/.env"
FRONTEND_ENV_FILE="$(dirname "$0")/frontend/.env.development"

if [ -f "$ENV_FILE" ]; then
    echo "✅ .env file exists"
    
    # Make sure the BACKEND_PORT is 8001
    if grep -q "BACKEND_PORT=" "$ENV_FILE"; then
        sed -i '' 's/BACKEND_PORT=.*/BACKEND_PORT=8001/g' "$ENV_FILE"
        echo "Updated BACKEND_PORT to 8001 in .env"
    else
        echo "BACKEND_PORT=8001" >> "$ENV_FILE"
        echo "Added BACKEND_PORT=8001 to .env"
    fi
    
    # Check for JWT secret
    if ! grep -q "SUPABASE_JWT_SECRET=" "$ENV_FILE"; then
        echo "⚠️ SUPABASE_JWT_SECRET not found in .env"
        echo "Please add your JWT secret to the .env file (from Supabase Dashboard > Settings > API)"
    else
        echo "✅ SUPABASE_JWT_SECRET is configured"
    fi
else
    echo "⚠️ .env file not found. Creating from example..."
    cp "$(dirname "$0")/.env.example" "$ENV_FILE"
    echo "Created .env file from example. Please update with your actual credentials."
    echo "BACKEND_PORT=8001" >> "$ENV_FILE"
fi

# Step 3: Check and update frontend environment
echo -e "\n[3/5] Checking frontend environment variables..."
if [ -f "$FRONTEND_ENV_FILE" ]; then
    echo "✅ Frontend .env.development file exists"
    
    # Make sure VITE_API_URL is set to port 8001
    if grep -q "VITE_API_URL=" "$FRONTEND_ENV_FILE"; then
        sed -i '' 's#VITE_API_URL=.*#VITE_API_URL=http://localhost:8001#g' "$FRONTEND_ENV_FILE"
        echo "Updated VITE_API_URL to http://localhost:8001"
    else
        echo "VITE_API_URL=http://localhost:8001" >> "$FRONTEND_ENV_FILE"
        echo "Added VITE_API_URL=http://localhost:8001"
    fi
else
    echo "⚠️ Frontend .env.development file not found. Creating from default values..."
    mkdir -p "$(dirname "$FRONTEND_ENV_FILE")"
    echo "# QueueBeats Frontend Development Environment Configuration
VITE_SUPABASE_URL=https://thuqfmfgpodaxxvydbcz.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRodXFmbWZncG9kYXh4dnlkYmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA4NTQyNzgsImV4cCI6MjA1NjQzMDI3OH0.jYnRbXoGR9lliBLj_L0D1jundPXa2SV55Enp04w8YO0
VITE_API_URL=http://localhost:8001
VITE_APP_ID=queuebeats
VITE_SPOTIFY_CLIENT_ID=1e4146465422449f9cf6cda11b2382d5" > "$FRONTEND_ENV_FILE"
    echo "Created frontend .env.development file with proper VITE_API_URL"
fi

# Step 4: Fix API_URL in brain.ts
echo -e "\n[4/5] Updating brain.ts API_URL value..."
BRAIN_FILE="$(dirname "$0")/frontend/src/brain.ts"
if [ -f "$BRAIN_FILE" ]; then
    # Ensure the default API_URL in brain.ts uses 8001
    sed -i '' "s/const API_URL = import.meta.env.VITE_API_URL || 'http:\/\/localhost:[0-9]\+';/const API_URL = import.meta.env.VITE_API_URL || 'http:\/\/localhost:8001';/g" "$BRAIN_FILE"
    echo "✅ Updated API_URL in brain.ts to use port 8001 as fallback"
else
    echo "⚠️ brain.ts file not found at $BRAIN_FILE"
fi

# Step 5: Provide instructions for Supabase table setup
echo -e "\n[5/5] Supabase database setup instructions"
echo "To complete the fix, you need to create the health_check table in your Supabase database."
echo "1. Log in to your Supabase dashboard at https://app.supabase.io"
echo "2. Navigate to your project"
echo "3. Go to SQL Editor"
echo "4. Execute the SQL in health_check_setup.sql file"
echo
echo "You also need to make sure user_settings table is properly set up:"
echo "1. In the same SQL Editor, execute the SQL in user-settings-setup.sql file"
echo

echo "✅ Fix script completed!"
echo "Please restart your application and test the authentication flow."
