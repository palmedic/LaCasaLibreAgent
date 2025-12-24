/**
 * Server Initialization
 *
 * Handles startup tasks like initializing the entity cache
 */

import { entityCache } from '@/cache/entityCache';

let initialized = false;

export async function initializeServer() {
  if (initialized) {
    console.log('[Server Init] Already initialized, skipping...');
    return;
  }

  console.log('[Server Init] Starting server initialization...');

  try {
    // Initialize entity cache
    await entityCache.initialize();

    const stats = entityCache.getStats();
    console.log('[Server Init] Entity cache initialized:', stats);

    initialized = true;
    console.log('[Server Init] Server initialization complete');
  } catch (error) {
    console.error('[Server Init] Initialization failed:', error);
    // Don't throw - let the server start anyway, cache will retry
  }
}

export function isInitialized(): boolean {
  return initialized;
}
