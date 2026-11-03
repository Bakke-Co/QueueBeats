#!/bin/bash
# netlify-build.sh - Specific build script for Netlify deployment
set -e

echo "=== ENVIRONMENT INFO ==="
node --version
npm --version
python3 --version || python --version
echo "======================="

# Create necessary directories
mkdir -p netlify/functions/utils

# Install root dependencies
echo "Installing root dependencies..."
npm install --no-progress

# Frontend build with simplified approach
echo "Building frontend..."
cd frontend

# Installing frontend dependencies with legacy peer deps
echo "Installing frontend dependencies..."
npm install --no-progress --legacy-peer-deps

# Use checked-in UI components and the same type-checked build as CI.
npm run build
cd ..

# Create Netlify function utilities
echo "Creating Netlify function utilities..."
cat > netlify/functions/utils/cors-headers.js << 'EOF'
// CORS headers for Netlify functions
exports.headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json'
};
EOF

# Create minimal test functions
echo "Creating minimal test functions..."
cat > netlify/functions/env-test.js << 'EOF'
const { headers } = require('./utils/cors-headers');

exports.handler = async () => {
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      message: "Environment test successful",
      node_version: process.version,
      environment: process.env.NODE_ENV || 'not set'
    })
  };
};
EOF

cat > netlify/functions/hello-world.js << 'EOF'
const { headers } = require('./utils/cors-headers');

exports.handler = async () => {
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      message: "Hello from Netlify Functions"
    })
  };
};
EOF

echo "Build complete!"
