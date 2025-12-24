import { config } from 'dotenv';

// Load environment variables
config();

export const env = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  HOME_ASSISTANT_BASE_URL: process.env.HOME_ASSISTANT_BASE_URL || '',
  HOME_ASSISTANT_TOKEN: process.env.HOME_ASSISTANT_TOKEN || '',
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

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please copy .env.example to .env and fill in your values.'
    );
  }

  return env;
}
