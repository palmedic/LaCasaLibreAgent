import { config } from 'dotenv';

// Load environment variables
config();

export const env = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  HOME_ASSISTANT_BASE_URL: process.env.HOME_ASSISTANT_BASE_URL || '',
  HOME_ASSISTANT_TOKEN: process.env.HOME_ASSISTANT_TOKEN || '',
  SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID || '',
  SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET || '',
  SPOTIFY_REDIRECT_URI: process.env.SPOTIFY_REDIRECT_URI || '',
  DISCOGS_API_KEY: process.env.DISCOGS_API_KEY || '',
  DISCOGS_USERNAME: process.env.DISCOGS_USERNAME || '',
  DISCOGS_USER_AGENT: process.env.DISCOGS_USER_AGENT || 'LaCasaLibreAgent/1.0',
  PINECONE_API_KEY: process.env.PINECONE_API_KEY || '',
  PINECONE_INDEX_NAME: process.env.PINECONE_INDEX_NAME || 'lacasalibre-user-memory',
};

// Validate required environment variables
export function validateEnv() {
  const missing: string[] = [];

  if (!env.OPENAI_API_KEY) {
    missing.push('OPENAI_API_KEY');
  }
  if (!env.HOME_ASSISTANT_BASE_URL) {
    missing.push('HOME_ASSISTANT_BASE_URL');
  }
  if (!env.HOME_ASSISTANT_TOKEN) {
    missing.push('HOME_ASSISTANT_TOKEN');
  }
  if (!env.SPOTIFY_CLIENT_ID) {
    missing.push('SPOTIFY_CLIENT_ID');
  }
  if (!env.SPOTIFY_CLIENT_SECRET) {
    missing.push('SPOTIFY_CLIENT_SECRET');
  }
  if (!env.SPOTIFY_REDIRECT_URI) {
    missing.push('SPOTIFY_REDIRECT_URI');
  }
  // Note: Discogs variables are optional - validated when Discogs client is used

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please copy .env.example to .env and fill in your values.'
    );
  }

  return env;
}
