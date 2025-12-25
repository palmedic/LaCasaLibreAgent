import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { discogsClient, DiscogsRelease, DiscogsCollectionItem } from '@/discogs/client';

// Helper function to check if a release matches the search query
function matchesQuery(release: DiscogsRelease, query: string): boolean {
  const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
  const searchableText = [
    release.title,
    release.artists.map(a => a.name).join(' '),
    release.labels?.map(l => l.name).join(' ') || '',
    release.genres?.join(' ') || '',
    release.styles?.join(' ') || '',
    release.year?.toString() || '',
  ].join(' ').toLowerCase();

  // All search terms must be found in the searchable text
  return searchTerms.every(term => searchableText.includes(term));
}

// Tool 1: Search user's vinyl collection
export const discogsSearchCollectionTool = tool(
  async ({ query, limit }) => {
    try {
      console.log(`[discogs_search_collection] Searching for: "${query}"`);

      // Fetch collection items with pagination (max 100 per page)
      const allReleases: DiscogsCollectionItem[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore && allReleases.length < 500) { // Safety limit of 500 items
        const results = await discogsClient.getCollectionItems({
          per_page: 100,
          page,
          sort: 'artist',
          sort_order: 'asc',
        });

        allReleases.push(...results.releases);

        // Check if there are more pages
        hasMore = results.pagination.pages > page;
        page++;
      }

      console.log(`[discogs_search_collection] Fetched ${allReleases.length} total items from collection`);

      // Filter releases by query (client-side search)
      const matchingReleases = allReleases.filter(item =>
        matchesQuery(item.basic_information, query)
      );

      console.log(`[discogs_search_collection] Found ${matchingReleases.length} matches for "${query}"`);

      if (matchingReleases.length === 0) {
        return JSON.stringify({
          success: false,
          message: `No records found in your collection matching "${query}"`,
          total_found: 0,
          results: [],
        });
      }

      // Format results for LLM consumption
      const maxResults = Math.min(matchingReleases.length, limit || 50);
      const formattedResults = matchingReleases.slice(0, maxResults).map((item) => {
        const release = item.basic_information;
        return {
          title: release.title,
          artist: release.artists.map(a => a.name).join(', '),
          year: release.year,
          label: release.labels?.[0]?.name || 'Unknown',
          catalog_number: release.labels?.[0]?.catno || '',
          format: release.formats?.[0]
            ? `${release.formats[0].name}${release.formats[0].descriptions ? ` (${release.formats[0].descriptions.join(', ')})` : ''}`
            : 'Unknown',
          genres: release.genres || [],
          styles: release.styles || [],
          release_id: release.id,
        };
      });

      return JSON.stringify({
        success: true,
        total_found: matchingReleases.length,
        results: formattedResults,
        truncated: matchingReleases.length > maxResults,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[discogs_search_collection] Error:', message);
      return JSON.stringify({
        success: false,
        error: `Failed to search collection: ${message}`,
        results: [],
      });
    }
  },
  {
    name: 'discogs_search_collection',
    description:
      'Search your personal vinyl record collection on Discogs. ' +
      'Use this to answer questions like "Do I have this album?" or "What Bob Dylan records do I own?" or "Do I own any Blue Note jazz?". ' +
      'Searches across artist names, album titles, and labels in your collection. ' +
      'Returns details about matching records including artist, title, year, label, format, genres, and styles.',
    schema: z.object({
      query: z
        .string()
        .describe(
          'Search query for your collection (e.g., "Kind of Blue", "Miles Davis", "Blue Note jazz", "bebop")'
        ),
      limit: z
        .number()
        .optional()
        .nullable()
        .describe('Maximum number of results to return (default: 10, max: 50)'),
    }),
  }
);

// Tool 2: Search Discogs database for recommendations
export const discogsSearchDatabaseTool = tool(
  async ({ query, genre, style, limit }) => {
    try {
      console.log(
        `[discogs_search_database] Searching for: "${query}"${genre ? ` (genre: ${genre})` : ''}${style ? ` (style: ${style})` : ''}`
      );

      const results = await discogsClient.searchDatabase(query, {
        type: 'release',
        genre: genre || undefined,
        style: style || undefined,
        per_page: limit || 10,
      });

      if (results.results.length === 0) {
        return JSON.stringify({
          success: false,
          message: `No albums found matching "${query}"${genre ? ` in ${genre}` : ''}${style ? ` (${style})` : ''}`,
          total_found: 0,
          results: [],
        });
      }

      // Format results for LLM consumption
      const formattedResults = results.results.slice(0, limit || 10).map((release) => ({
        title: release.title,
        artist: release.artists?.map((a) => a.name).join(', ') || 'Various Artists',
        year: release.year || 'Unknown',
        label: release.labels?.[0]?.name || 'Unknown',
        catalog_number: release.labels?.[0]?.catno || '',
        format: release.formats?.[0]
          ? `${release.formats[0].name}${release.formats[0].descriptions ? ` (${release.formats[0].descriptions.join(', ')})` : ''}`
          : 'Vinyl',
        genres: release.genres || [],
        styles: release.styles || [],
        release_id: release.id,
        cover_image: release.cover_image || release.thumb,
      }));

      return JSON.stringify({
        success: true,
        total_found: results.pagination.items,
        results: formattedResults,
        truncated: results.pagination.items > (limit || 10),
        query_info: {
          search_term: query,
          genre_filter: genre || null,
          style_filter: style || null,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[discogs_search_database] Error:', message);
      return JSON.stringify({
        success: false,
        error: `Failed to search Discogs database: ${message}`,
        results: [],
      });
    }
  },
  {
    name: 'discogs_search_database',
    description:
      'Search the Discogs music database for recommendations and album information. ' +
      'Use this when the user asks for music recommendations or wants to explore music they might not own. ' +
      'Examples: "What smooth saxophone jazz should I listen to?", "Recommend some 1950s bebop albums", "Find classic Blue Note records". ' +
      'Can filter by genre (Jazz, Rock, Electronic, etc.) and style (Bebop, Smooth Jazz, Hard Bop, etc.) for better recommendations. ' +
      'Returns album details from the entire Discogs database, not just the user\'s collection.',
    schema: z.object({
      query: z
        .string()
        .describe(
          'Search query (e.g., "smooth saxophone jazz", "bebop 1950s", "Blue Note records", "Coltrane")'
        ),
      genre: z
        .string()
        .optional()
        .nullable()
        .describe(
          'Optional genre filter (e.g., "Jazz", "Rock", "Electronic", "Classical"). Leave empty to search all genres.'
        ),
      style: z
        .string()
        .optional()
        .nullable()
        .describe(
          'Optional style filter (e.g., "Bebop", "Smooth Jazz", "Hard Bop", "Free Jazz"). Leave empty to search all styles.'
        ),
      limit: z
        .number()
        .optional()
        .nullable()
        .describe('Maximum number of results to return (default: 10, max: 25)'),
    }),
  }
);

// Tool 3: Get detailed release information
export const discogsGetReleaseTool = tool(
  async ({ release_id }) => {
    try {
      console.log(`[discogs_get_release] Getting release ID: ${release_id}`);

      const release = await discogsClient.getRelease(release_id);

      const formattedRelease = {
        title: release.title,
        artists: release.artists.map((a) => a.name).join(', '),
        year: release.year,
        labels: release.labels?.map((l) => `${l.name} (${l.catno})`).join(', ') || 'Unknown',
        formats: release.formats?.map((f) =>
          `${f.name} ${f.qty ? `x${f.qty}` : ''}${f.descriptions ? ` (${f.descriptions.join(', ')})` : ''}`
        ).join(', ') || 'Unknown',
        genres: release.genres || [],
        styles: release.styles || [],
        cover_image: release.cover_image || release.thumb,
        release_id: release.id,
      };

      return JSON.stringify({
        success: true,
        release: formattedRelease,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[discogs_get_release] Error:', message);
      return JSON.stringify({
        success: false,
        error: `Failed to get release details: ${message}`,
      });
    }
  },
  {
    name: 'discogs_get_release',
    description:
      'Get detailed information about a specific album/release on Discogs using its release ID. ' +
      'Use this for follow-up queries like "Tell me more about that album" after a search. ' +
      'Returns comprehensive details including full label info, format details, and tracklist.',
    schema: z.object({
      release_id: z
        .number()
        .describe('Discogs release ID (obtained from search results)'),
    }),
  }
);

// Export all Discogs tools
export const discogsTools = [
  discogsSearchCollectionTool,
  discogsSearchDatabaseTool,
  discogsGetReleaseTool,
];
