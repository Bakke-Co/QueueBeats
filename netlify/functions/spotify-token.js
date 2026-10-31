// Netlify Serverless Function for the Spotify OAuth token exchange.
// The client secret lives only in this function's environment
// (SPOTIFY_CLIENT_SECRET); the browser never sees it.
// POST { code, redirect_uri } → authorization_code grant
// POST { refresh_token }      → refresh_token grant
const { headers } = require('./utils/cors-headers');
const fetch = require('node-fetch');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error('Missing Spotify credentials');
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server configuration error' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const params = new URLSearchParams();
  if (body.code && body.redirect_uri) {
    params.append('grant_type', 'authorization_code');
    params.append('code', body.code);
    params.append('redirect_uri', body.redirect_uri);
  } else if (body.refresh_token) {
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', body.refresh_token);
  } else {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Expected { code, redirect_uri } or { refresh_token }' })
    };
  }

  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
      },
      body: params.toString()
    });
    const data = await response.json();
    return { statusCode: response.status, headers, body: JSON.stringify(data) };
  } catch (error) {
    console.error('Error calling the Spotify token endpoint:', error);
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'Spotify token endpoint unreachable' }) };
  }
};
