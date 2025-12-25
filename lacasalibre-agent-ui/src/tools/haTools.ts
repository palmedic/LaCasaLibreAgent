import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { haClient } from '@/ha/client';
import { isEntityAllowed, isServiceAllowed } from '@/config/allowlist';
import { searchSpotify } from '@/spotify/client';

// Tool 1: Get entity state
export const haGetEntityStateTool = tool(
  async ({ entity_id }) => {
    // Check allowlist
    if (!isEntityAllowed(entity_id)) {
      throw new Error(
        `Access denied: entity_id '${entity_id}' is not in the allowlist`
      );
    }

    try {
      const state = await haClient.getEntityState(entity_id);
      return JSON.stringify({
        entity_id: state.entity_id,
        state: state.state,
        attributes: state.attributes,
        last_updated: state.last_updated,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get entity state: ${message}`);
    }
  },
  {
    name: 'ha_get_entity_state',
    description:
      'Get the current state of a Home Assistant entity. ' +
      'Returns the entity state, attributes, and last updated time. ' +
      'Example entity_id: "light.living_room", "switch.bedroom", "sensor.temperature"',
    schema: z.object({
      entity_id: z
        .string()
        .describe('The entity ID to query (e.g., "light.living_room")'),
    }),
  }
);

// Tool 2: Call Home Assistant service
export const haCallServiceTool = tool(
  async ({ domain, service, data }) => {
    // Check allowlist
    if (!isServiceAllowed(domain, service)) {
      throw new Error(
        `Access denied: service '${domain}.${service}' is not in the allowlist`
      );
    }

    try {
      const result = await haClient.callService(domain, service, data ?? undefined);
      return JSON.stringify({
        success: true,
        service: `${domain}.${service}`,
        data: data || {},
        result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to call service: ${message}`);
    }
  },
  {
    name: 'ha_call_service',
    description:
      'Call a Home Assistant service to control devices. ' +
      'Common services: light.turn_on, light.turn_off, switch.toggle, climate.set_temperature. ' +
      'The data parameter should include entity_id and any service-specific parameters.',
    schema: z.object({
      domain: z
        .string()
        .describe('The domain of the service (e.g., "light", "switch")'),
      service: z
        .string()
        .describe('The service to call (e.g., "turn_on", "turn_off")'),
      data: z
        .record(z.unknown())
        .optional()
        .nullable()
        .describe(
          'Optional data for the service call. Should include entity_id and service-specific parameters (e.g., {"entity_id": "light.living_room", "brightness": 255})'
        ),
    }),
  }
);

// Tool 3: List and search entities
export const haListEntitiesTool = tool(
  async ({ domain, search_term }) => {
    try {
      const allEntities = await haClient.listAllEntities();

      // Filter by domain if specified
      let filteredEntities = allEntities;
      if (domain) {
        filteredEntities = allEntities.filter(e => e.entity_id.startsWith(`${domain}.`));
      }

      // Filter by search term if specified (case insensitive)
      if (search_term) {
        const searchLower = search_term.toLowerCase();
        filteredEntities = filteredEntities.filter(e => {
          const entityIdMatch = e.entity_id.toLowerCase().includes(searchLower);
          const friendlyName = (e.attributes.friendly_name as string)?.toLowerCase() || '';
          const friendlyNameMatch = friendlyName.includes(searchLower);
          return entityIdMatch || friendlyNameMatch;
        });
      }

      // Return a simplified list with key information
      const simplifiedEntities = filteredEntities.map(e => ({
        entity_id: e.entity_id,
        friendly_name: e.attributes.friendly_name || e.entity_id,
        state: e.state,
        domain: e.entity_id.split('.')[0],
      }));

      return JSON.stringify({
        total_count: simplifiedEntities.length,
        entities: simplifiedEntities.slice(0, 50), // Limit to 50 results to avoid token overflow
        truncated: simplifiedEntities.length > 50,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to list entities: ${message}`);
    }
  },
  {
    name: 'ha_list_entities',
    description:
      'List and search for Home Assistant entities. Use this to discover available devices before taking actions. ' +
      'You can filter by domain (e.g., "light", "switch", "climate") and/or search by name (e.g., "kitchen", "bedroom"). ' +
      'IMPORTANT: Always use this tool first when you don\'t know the exact entity_id. ' +
      'Returns entity_id, friendly_name, current state, and domain for matching entities.',
    schema: z.object({
      domain: z
        .string()
        .optional()
        .nullable()
        .describe('Filter by domain (e.g., "light", "switch", "sensor", "climate"). Leave empty to search all domains.'),
      search_term: z
        .string()
        .optional()
        .nullable()
        .describe('Search term to filter entities by name or ID (e.g., "kitchen", "bedroom", "temperature"). Case insensitive.'),
    }),
  }
);

// Tool 4: Smart entity search with synonym matching
export const haSmartSearchTool = tool(
  async ({ query, domain, location }) => {
    try {
      const { entityCache } = await import('@/cache/entityCache');

      const matches = entityCache.findMatches(query, {
        domain: domain ?? undefined,
        location: location ?? undefined,
        limit: 10,
      });

      if (matches.length === 0) {
        return JSON.stringify({
          success: false,
          message: `No entities found matching "${query}"${domain ? ` in domain "${domain}"` : ''}${location ? ` at location "${location}"` : ''}`,
          matches: [],
        });
      }

      const results = matches.map(m => ({
        entity_id: m.entity.entity_id,
        friendly_name: m.entity.attributes.friendly_name || m.entity.entity_id,
        state: m.entity.state,
        domain: m.entity.entity_id.split('.')[0],
        match_score: m.score,
        match_reason: m.matchReason,
      }));

      return JSON.stringify({
        success: true,
        message: `Found ${matches.length} matching entities`,
        matches: results,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Smart search failed: ${message}`);
    }
  },
  {
    name: 'ha_smart_search',
    description:
      'Smart entity search with synonym matching and fuzzy search. Use this when the user refers to devices with common names or synonyms. ' +
      'Examples: "blinds" will find shutters/shades/covers, "ac" will find climate entities, "lights" will find lamps. ' +
      'This tool automatically handles typos and learns from your entity names. ' +
      'PREFER THIS TOOL over ha_list_entities when dealing with natural language queries.',
    schema: z.object({
      query: z
        .string()
        .describe('Natural language search query (e.g., "blinds", "ac", "bedroom lights"). Supports synonyms and fuzzy matching.'),
      domain: z
        .string()
        .optional()
        .nullable()
        .describe('Optional: Filter by domain (e.g., "cover", "climate", "switch"). Leave empty to search all domains.'),
      location: z
        .string()
        .optional()
        .nullable()
        .describe('Optional: Location/room name (e.g., "bedroom", "kitchen"). Boosts matches in this location.'),
    }),
  }
);

// Tool 5: Play Spotify music on Home Assistant speakers
export const haPlaySpotifyTool = tool(
  async ({ query, speaker_entity_id, search_type }) => {
    try {
      console.log(`[ha_play_spotify] Searching Spotify for: "${query}" (type: ${search_type})`);

      // Search Spotify
      const searchResults = await searchSpotify(query, search_type || 'track', 5);

      if (searchResults.tracks.length === 0) {
        return JSON.stringify({
          success: false,
          error: `No results found for "${query}"`,
        });
      }

      // Get the best match (first result)
      const track = searchResults.tracks[0];
      console.log(`[ha_play_spotify] Found: "${track.name}" by ${track.artists.join(', ')}`);

      // Determine speaker entity
      let targetSpeaker = speaker_entity_id;

      // If no speaker specified, try to find a default one
      if (!targetSpeaker) {
        // Try to find Living Room speaker first (likely Sonos Beam)
        const allEntities = await haClient.listAllEntities();
        const mediaPlayers = allEntities.filter(e => e.entity_id.startsWith('media_player.'));

        // Prefer Living Room or first available media player
        const defaultSpeaker = mediaPlayers.find(e => {
          const friendlyName = e.attributes.friendly_name;
          return e.entity_id.includes('living_room') ||
            (typeof friendlyName === 'string' && friendlyName.toLowerCase().includes('living room'));
        }) || mediaPlayers[0];

        if (!defaultSpeaker) {
          return JSON.stringify({
            success: false,
            error: 'No media player found. Please specify a speaker_entity_id.',
          });
        }

        targetSpeaker = defaultSpeaker.entity_id;
        console.log(`[ha_play_spotify] Using default speaker: ${targetSpeaker}`);
      }

      // Check allowlist
      if (!isServiceAllowed('media_player', 'play_media')) {
        throw new Error('Service media_player.play_media is not in the allowlist');
      }

      // Play on Home Assistant media player using Spotify URI
      const serviceData = {
        entity_id: targetSpeaker,
        media_content_type: 'music',
        media_content_id: track.uri,
      };

      console.log(`[ha_play_spotify] Playing on ${targetSpeaker}: ${track.uri}`);

      await haClient.callService('media_player', 'play_media', serviceData);

      return JSON.stringify({
        success: true,
        track: {
          name: track.name,
          artists: track.artists,
          album: track.album,
          uri: track.uri,
        },
        speaker: targetSpeaker,
        message: `Now playing "${track.name}" by ${track.artists.join(', ')} on ${targetSpeaker}`,
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[ha_play_spotify] Error:', message);
      return JSON.stringify({
        success: false,
        error: `Failed to play music: ${message}`,
      });
    }
  },
  {
    name: 'ha_play_spotify',
    description:
      'Search Spotify and play music on a Home Assistant speaker. ' +
      'Searches for songs, artists, albums, or playlists and plays the best match. ' +
      'Works with Sonos, Chromecast, and other media players integrated with Home Assistant. ' +
      'Examples: "play some jazz", "play Coldplay", "play chill music"',
    schema: z.object({
      query: z
        .string()
        .describe('Natural language music search query (e.g., "play some jazz", "Coldplay", "relaxing music")'),
      speaker_entity_id: z
        .string()
        .optional()
        .nullable()
        .describe('Optional: Specific speaker entity ID (e.g., "media_player.living_room"). If not specified, uses default speaker.'),
      search_type: z
        .enum(['track', 'artist', 'album', 'playlist'])
        .optional()
        .nullable()
        .describe('Optional: Type of search - track (default), artist, album, or playlist'),
    }),
  }
);

// Tool 6: Get weather information
export const haGetWeatherTool = tool(
  async () => {
    try {
      // Find weather entities
      const allEntities = await haClient.listAllEntities();
      const weatherEntities = allEntities.filter(e => e.entity_id.startsWith('weather.'));

      if (weatherEntities.length === 0) {
        return JSON.stringify({
          success: false,
          error: 'No weather entities found in Home Assistant',
        });
      }

      // Get the first weather entity (usually the primary one)
      const weatherEntity = weatherEntities[0];
      const state = weatherEntity.state;
      const attrs = weatherEntity.attributes;

      // Extract relevant weather data
      const weatherData = {
        condition: state,
        temperature: attrs.temperature,
        temperature_unit: attrs.temperature_unit,
        humidity: attrs.humidity,
        pressure: attrs.pressure,
        pressure_unit: attrs.pressure_unit || 'hPa',
        wind_speed: attrs.wind_speed,
        wind_speed_unit: attrs.wind_speed_unit || 'km/h',
        wind_bearing: attrs.wind_bearing,
        visibility: attrs.visibility,
        visibility_unit: attrs.visibility_unit || 'km',
        forecast: attrs.forecast ? (attrs.forecast as Array<{
          datetime: string;
          condition: string;
          temperature?: number;
          templow?: number;
          precipitation?: number;
          precipitation_probability?: number;
        }>).slice(0, 5) : [], // Limit to next 5 forecast periods
        attribution: attrs.attribution,
        friendly_name: attrs.friendly_name,
      };

      return JSON.stringify({
        success: true,
        entity_id: weatherEntity.entity_id,
        weather: weatherData,
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[ha_get_weather] Error:', message);
      return JSON.stringify({
        success: false,
        error: `Failed to get weather: ${message}`,
      });
    }
  },
  {
    name: 'ha_get_weather',
    description:
      'Get current weather conditions and forecast from Home Assistant. ' +
      'Returns temperature, humidity, pressure, wind speed/direction, visibility, current conditions, and upcoming forecast. ' +
      'Use this to answer questions about the weather, temperature, or forecast.',
    schema: z.object({}),
  }
);

export const homeAssistantTools = [
  haSmartSearchTool,
  haListEntitiesTool,
  haGetEntityStateTool,
  haCallServiceTool,
  haPlaySpotifyTool,
  haGetWeatherTool,
];
