/**
 * Entity Cache with Smart Synonym Matching
 *
 * Combines manual synonyms for common terms with automatic learning
 * from entity names in your Home Assistant setup.
 */

import { haClient, HAState } from '@/ha/client';

// Common synonyms (minimal manual setup)
const COMMON_SYNONYMS: Record<string, string[]> = {
  'blinds': ['shutter', 'shade', 'curtain', 'cover'],
  'shutters': ['blind', 'shade', 'curtain', 'cover'],
  'ac': ['air conditioning', 'climate', 'hvac', 'cooling', 'aircon'],
  'lights': ['lamp', 'bulb', 'lighting', 'illumination'],
  'lamp': ['light', 'bulb', 'lighting'],
  'thermostat': ['temperature', 'heating', 'climate'],
};

interface EntityMatch {
  entity: HAState;
  score: number;
  matchReason: string;
}

export class EntityCache {
  private entities: HAState[] = [];
  private domainKeywords: Map<string, Set<string>> = new Map();
  private lastRefresh: Date | null = null;
  private refreshInterval = 5 * 60 * 1000; // 5 minutes

  /**
   * Initialize the cache by fetching all entities
   */
  async initialize(): Promise<void> {
    console.log('[EntityCache] Initializing entity cache...');
    await this.refresh();

    // Set up periodic refresh
    setInterval(() => {
      this.refresh().catch(err => {
        console.error('[EntityCache] Auto-refresh failed:', err);
      });
    }, this.refreshInterval);
  }

  /**
   * Refresh entity cache from Home Assistant
   */
  async refresh(): Promise<void> {
    try {
      this.entities = await haClient.listAllEntities();
      this.buildKeywordIndex();
      this.lastRefresh = new Date();
      console.log(`[EntityCache] Refreshed ${this.entities.length} entities`);
    } catch (error) {
      console.error('[EntityCache] Failed to refresh entities:', error);
      throw error;
    }
  }

  /**
   * Build keyword index from entity friendly names
   * Automatically learns which words map to which domains
   */
  private buildKeywordIndex(): void {
    this.domainKeywords.clear();

    this.entities.forEach(entity => {
      const domain = entity.entity_id.split('.')[0];
      const friendlyName = (entity.attributes.friendly_name as string) || '';

      // Extract meaningful words from friendly names
      const words = friendlyName
        .toLowerCase()
        .split(/[\s_-]+/)
        .filter(word => word.length > 2); // Skip very short words

      if (!this.domainKeywords.has(domain)) {
        this.domainKeywords.set(domain, new Set());
      }

      words.forEach(word => {
        this.domainKeywords.get(domain)!.add(word);
      });
    });

    console.log('[EntityCache] Built keyword index for domains:', Array.from(this.domainKeywords.keys()));
  }

  /**
   * Expand a search term with synonyms
   */
  private expandWithSynonyms(term: string): string[] {
    const normalized = term.toLowerCase().trim();
    const expanded = new Set([normalized]);

    // Add manual synonyms
    if (COMMON_SYNONYMS[normalized]) {
      COMMON_SYNONYMS[normalized].forEach(syn => expanded.add(syn));
    }

    // Add reverse synonyms (if term appears as a synonym, add the key)
    Object.entries(COMMON_SYNONYMS).forEach(([key, synonyms]) => {
      if (synonyms.includes(normalized)) {
        expanded.add(key);
      }
    });

    return Array.from(expanded);
  }

  /**
   * Calculate Levenshtein distance for fuzzy matching
   */
  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  /**
   * Find best matching entities for a natural language query
   */
  findMatches(query: string, options?: {
    domain?: string;
    location?: string;
    limit?: number;
  }): EntityMatch[] {
    const { domain, location, limit = 10 } = options || {};
    const queryLower = query.toLowerCase();
    const matches: EntityMatch[] = [];

    // Expand query with synonyms
    const expandedTerms = this.expandWithSynonyms(queryLower);
    const searchTerms = new Set([queryLower, ...expandedTerms]);

    // If location is specified, add it to search
    if (location) {
      const locationLower = location.toLowerCase();
      searchTerms.add(locationLower);
    }

    // Search through all entities
    this.entities.forEach(entity => {
      // Filter by domain if specified
      if (domain && !entity.entity_id.startsWith(`${domain}.`)) {
        return;
      }

      const entityIdLower = entity.entity_id.toLowerCase();
      const friendlyName = ((entity.attributes.friendly_name as string) || '').toLowerCase();
      const combinedText = `${entityIdLower} ${friendlyName}`;

      let score = 0;
      let matchReason = '';

      // Score exact matches highest
      searchTerms.forEach(term => {
        if (entityIdLower.includes(term) || friendlyName.includes(term)) {
          score += 100;
          if (!matchReason) matchReason = `Exact match for "${term}"`;
        }
      });

      // Score partial word matches
      const words = combinedText.split(/[\s_.-]+/);
      searchTerms.forEach(term => {
        words.forEach(word => {
          if (word.startsWith(term)) {
            score += 50;
            if (!matchReason) matchReason = `Partial match for "${term}"`;
          }
        });
      });

      // Fuzzy matching for typos (only if no exact match)
      if (score === 0) {
        searchTerms.forEach(term => {
          words.forEach(word => {
            if (word.length > 3 && term.length > 3) {
              const distance = this.levenshteinDistance(term, word);
              if (distance <= 2) {
                score += 30 - (distance * 10);
                if (!matchReason) matchReason = `Fuzzy match for "${term}" (${distance} edits)`;
              }
            }
          });
        });
      }

      // Bonus for location match
      if (location && (entityIdLower.includes(location.toLowerCase()) || friendlyName.includes(location.toLowerCase()))) {
        score += 50;
        matchReason += ` in ${location}`;
      }

      if (score > 0) {
        matches.push({
          entity,
          score,
          matchReason,
        });
      }
    });

    // Sort by score (highest first) and limit results
    return matches
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Get all entities (for debugging or full listing)
   */
  getAllEntities(): HAState[] {
    return this.entities;
  }

  /**
   * Get cache stats
   */
  getStats() {
    return {
      totalEntities: this.entities.length,
      domains: Array.from(this.domainKeywords.keys()),
      lastRefresh: this.lastRefresh,
    };
  }
}

// Singleton instance
export const entityCache = new EntityCache();
