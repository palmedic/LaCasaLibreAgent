/**
 * Spotify Client
 *
 * Handles Spotify API interactions using Client Credentials flow
 * for server-side music search and playback control
 */

import { SpotifyApi } from '@spotify/web-api-ts-sdk';
import { validateEnv } from '@/config/env';

const env = validateEnv();

// Create Spotify client with Client Credentials (no user auth needed for search)
const spotify = SpotifyApi.withClientCredentials(
  env.SPOTIFY_CLIENT_ID,
  env.SPOTIFY_CLIENT_SECRET
);

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: string[];
  album: string;
  uri: string;
  duration_ms: number;
  preview_url: string | null;
}

export interface SpotifySearchResult {
  tracks: SpotifyTrack[];
  query: string;
}

/**
 * Search Spotify for tracks, artists, albums, or playlists
 */
export async function searchSpotify(
  query: string,
  type: 'track' | 'artist' | 'album' | 'playlist' = 'track',
  limit: number = 10
): Promise<SpotifySearchResult> {
  console.log(`[Spotify] Searching for "${query}" (type: ${type})`);

  try {
    const results = await spotify.search(query, [type], undefined, limit);

    if (type === 'track' && results.tracks) {
      const tracks: SpotifyTrack[] = results.tracks.items.map(track => ({
        id: track.id,
        name: track.name,
        artists: track.artists.map(a => a.name),
        album: track.album.name,
        uri: track.uri,
        duration_ms: track.duration_ms,
        preview_url: track.preview_url,
      }));

      console.log(`[Spotify] Found ${tracks.length} tracks`);
      return { tracks, query };
    }

    // Handle other types (artist, album, playlist) by getting their top tracks
    if (type === 'artist' && results.artists?.items.length) {
      const artistId = results.artists.items[0].id;
      const topTracks = await spotify.artists.topTracks(artistId, 'US');

      const tracks: SpotifyTrack[] = topTracks.tracks.map(track => ({
        id: track.id,
        name: track.name,
        artists: track.artists.map(a => a.name),
        album: track.album.name,
        uri: track.uri,
        duration_ms: track.duration_ms,
        preview_url: track.preview_url,
      }));

      console.log(`[Spotify] Found ${tracks.length} tracks for artist`);
      return { tracks, query };
    }

    if (type === 'album' && results.albums?.items.length) {
      const albumId = results.albums.items[0].id;
      const albumTracks = await spotify.albums.tracks(albumId);

      const tracks: SpotifyTrack[] = albumTracks.items.map(track => ({
        id: track.id,
        name: track.name,
        artists: track.artists.map(a => a.name),
        album: results.albums!.items[0].name,
        uri: track.uri,
        duration_ms: track.duration_ms,
        preview_url: track.preview_url,
      }));

      console.log(`[Spotify] Found ${tracks.length} tracks in album`);
      return { tracks, query };
    }

    if (type === 'playlist' && results.playlists?.items.length) {
      const playlistId = results.playlists.items[0].id;
      const playlistTracks = await spotify.playlists.getPlaylistItems(playlistId);

      const tracks: SpotifyTrack[] = playlistTracks.items
        .filter(item => item.track && 'uri' in item.track)
        .map(item => {
          const track = item.track as any;
          return {
            id: track.id,
            name: track.name,
            artists: track.artists.map((a: any) => a.name),
            album: track.album?.name || '',
            uri: track.uri,
            duration_ms: track.duration_ms,
            preview_url: track.preview_url,
          };
        });

      console.log(`[Spotify] Found ${tracks.length} tracks in playlist`);
      return { tracks, query };
    }

    return { tracks: [], query };
  } catch (error) {
    console.error('[Spotify] Search error:', error);
    throw new Error(`Spotify search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get a specific track by ID
 */
export async function getTrack(trackId: string): Promise<SpotifyTrack | null> {
  try {
    const track = await spotify.tracks.get(trackId);

    return {
      id: track.id,
      name: track.name,
      artists: track.artists.map(a => a.name),
      album: track.album.name,
      uri: track.uri,
      duration_ms: track.duration_ms,
      preview_url: track.preview_url,
    };
  } catch (error) {
    console.error('[Spotify] Get track error:', error);
    return null;
  }
}

export { spotify };
