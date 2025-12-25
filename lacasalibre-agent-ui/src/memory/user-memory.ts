/**
 * User Memory Service
 *
 * Provides long-term memory for users using Pinecone vector database.
 * Stores user preferences, conversation history, and contextual information.
 * Uses Pinecone's integrated embeddings (llama-text-embed-v2).
 */

import { Pinecone } from '@pinecone-database/pinecone';
import { env } from '@/config/env';

// Types for user memory
export interface UserMemoryRecord {
  _id: string;
  content: string;
  user_id: string;
  memory_type: 'preference' | 'conversation' | 'context';
  timestamp: string;
  [key: string]: string | number | boolean;
}

export interface SearchResult {
  id: string;
  content: string;
  score: number;
  fields: Record<string, string | number | boolean>;
}

/**
 * User Memory Client
 * Manages user-specific memory storage and retrieval using integrated embeddings
 */
export class UserMemory {
  private pc: Pinecone;
  private indexName: string;

  constructor() {
    if (!env.PINECONE_API_KEY) {
      throw new Error('PINECONE_API_KEY is required');
    }

    this.pc = new Pinecone({ apiKey: env.PINECONE_API_KEY });
    this.indexName = env.PINECONE_INDEX_NAME;
  }

  /**
   * Get namespace for a specific user
   */
  private getUserNamespace(userId: string): string {
    return `user_${userId}`;
  }

  /**
   * Store user memory using Records API (for integrated embeddings)
   */
  async storeMemory(
    userId: string,
    memory: {
      content: string;
      memory_type: 'preference' | 'conversation' | 'context';
      [key: string]: string | number | boolean;
    }
  ): Promise<void> {
    const index = this.pc.index(this.indexName);
    const namespace = this.getUserNamespace(userId);

    const record: UserMemoryRecord = {
      _id: `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      user_id: userId,
      timestamp: new Date().toISOString(),
      ...memory,
    };

    // TypeScript SDK uses namespace().upsert() with records for integrated embeddings
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await index.namespace(namespace).upsert([record as any]);

    console.log(`[UserMemory] Stored memory for user ${userId}: ${record.memory_type}`);
  }

  /**
   * Store user preference
   */
  async storePreference(
    userId: string,
    preferenceType: string,
    value: string,
    metadata?: Record<string, string | number | boolean>
  ): Promise<void> {
    await this.storeMemory(userId, {
      content: `User prefers ${preferenceType}: ${value}`,
      memory_type: 'preference',
      preference_type: preferenceType,
      preference_value: value,
      ...metadata,
    });
  }

  /**
   * Store conversation context
   */
  async storeConversation(
    userId: string,
    conversation: string,
    metadata?: Record<string, string | number | boolean>
  ): Promise<void> {
    await this.storeMemory(userId, {
      content: conversation,
      memory_type: 'conversation',
      ...metadata,
    });
  }

  /**
   * Search user memories semantically using integrated embeddings
   *
   * Note: This is a placeholder implementation. For production use with integrated embeddings,
   * you'll need to either use the Pinecone inference API or generate embeddings with OpenAI.
   */
  async searchMemories(
    userId: string,
    query: string,
    options: {
      topK?: number;
      memoryType?: 'preference' | 'conversation' | 'context';
    } = {}
  ): Promise<SearchResult[]> {
    const { topK = 5, memoryType } = options;
    const index = this.pc.index(this.indexName);
    const namespace = this.getUserNamespace(userId);

    // Build filter
    const filter = memoryType
      ? { memory_type: { $eq: memoryType } }
      : undefined;

    // Create a random vector for querying (1024 dimensions for llama-text-embed-v2)
    // TODO: Replace with actual embeddings from OpenAI or Pinecone inference API
    const queryVector = Array(1024).fill(0).map(() => Math.random());

    const results = await index.namespace(namespace).query({
      vector: queryVector,
      topK,
      includeMetadata: true,
      ...(filter && { filter }),
    });

    const matches = results?.matches || [];
    console.log(`[UserMemory] Found ${matches.length} memories for query: "${query}"`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return matches.map((match: any) => ({
      id: match.id,
      content: match.metadata?.content || '',
      score: match.score || 0,
      fields: match.metadata || {},
    }));
  }

  /**
   * Search with reranking for better relevance
   *
   * Note: Reranking requires Pinecone inference API which is not yet supported in TypeScript SDK.
   * This method currently falls back to regular search.
   */
  async searchMemoriesWithRerank(
    userId: string,
    query: string,
    options: {
      topK?: number;
      memoryType?: 'preference' | 'conversation' | 'context';
    } = {}
  ): Promise<SearchResult[]> {
    // For now, fall back to regular search
    // TODO: Implement reranking when Pinecone TypeScript SDK supports it
    console.log('[UserMemory] Reranking not yet supported, using regular search');
    return this.searchMemories(userId, query, options);
  }

  /**
   * Get all preferences for a user
   */
  async getUserPreferences(userId: string): Promise<SearchResult[]> {
    return this.searchMemories(userId, 'user preferences', {
      topK: 20,
      memoryType: 'preference',
    });
  }

  /**
   * Delete specific memory
   */
  async deleteMemory(userId: string, memoryId: string): Promise<void> {
    const index = this.pc.index(this.indexName);
    const namespace = this.getUserNamespace(userId);

    await index.namespace(namespace).deleteOne(memoryId);
    console.log(`[UserMemory] Deleted memory ${memoryId} for user ${userId}`);
  }

  /**
   * Delete all memories for a user (CAUTION)
   */
  async deleteAllUserMemories(userId: string): Promise<void> {
    const index = this.pc.index(this.indexName);
    const namespace = this.getUserNamespace(userId);

    await index.namespace(namespace).deleteAll();
    console.log(`[UserMemory] Deleted all memories for user ${userId}`);
  }
}

// Export singleton instance
export const userMemory = new UserMemory();
