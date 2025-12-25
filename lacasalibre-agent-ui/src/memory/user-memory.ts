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
  fields: Record<string, any>;
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

    // Build query object for integrated embeddings
    const queryObj: any = {
      top_k: topK,
      inputs: {
        text: query, // Maps to 'content' field via field_map
      },
    };

    // Add filter if memory type specified
    if (memoryType) {
      queryObj.filter = {
        memory_type: { $eq: memoryType },
      };
    }

    // Use query() method with text for integrated embeddings
    const results = await index.namespace(namespace).query({
      topK,
      includeMetadata: true,
      ...((queryObj.filter && { filter: queryObj.filter }) || {}),
    } as any);

    const matches = results?.matches || [];
    console.log(`[UserMemory] Found ${matches.length} memories for query: "${query}"`);

    return matches.map((match: any) => ({
      id: match.id,
      content: match.metadata?.content || '',
      score: match.score || 0,
      fields: match.metadata || {},
    }));
  }

  /**
   * Search with reranking for better relevance
   */
  async searchMemoriesWithRerank(
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

    // Build query object
    const queryObj: any = {
      top_k: topK * 2, // Get more candidates for reranking
      inputs: {
        text: query,
      },
    };

    if (memoryType) {
      queryObj.filter = {
        memory_type: { $eq: memoryType },
      };
    }

    // Add reranking
    const rerank = {
      model: 'bge-reranker-v2-m3',
      top_n: topK,
      rank_fields: ['content'],
    };

    const results = await (index as any).search(namespace, { query: queryObj, rerank });

    const hits = results?.result?.hits || [];
    console.log(`[UserMemory] Found ${hits.length} reranked memories for query: "${query}"`);

    return hits.map((hit: any) => ({
      id: hit._id,
      content: hit.fields?.content || '',
      score: hit._score || 0,
      fields: hit.fields || {},
    }));
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
