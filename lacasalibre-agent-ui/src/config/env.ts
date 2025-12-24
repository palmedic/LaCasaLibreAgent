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

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please copy .env.example to .env and fill in your values.'
    );
  }

  return env;
}
