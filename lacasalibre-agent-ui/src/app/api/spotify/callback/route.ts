/**
 * Spotify OAuth Callback Endpoint
 *
 * This endpoint is required by Spotify OAuth flow but is not actively used
 * since we're using Client Credentials flow for server-side operations.
 *
 * Kept for future user-specific features (playlists, favorites, etc.)
 */

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return new Response(
      JSON.stringify({ error: `Spotify authorization failed: ${error}` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!code) {
    return new Response(
      JSON.stringify({ error: 'No authorization code received' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // For now, just acknowledge the callback
  // In the future, this could exchange the code for user tokens
  return new Response(
    JSON.stringify({
      success: true,
      message: 'Spotify callback received. User authentication not yet implemented.',
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
