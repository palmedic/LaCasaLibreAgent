import { env } from '@/config/env';

// TypeScript interfaces for Discogs API responses
export interface DiscogsArtist {
  id: number;
  name: string;
  resource_url?: string;
}

export interface DiscogsLabel {
  id: number;
  name: string;
  catno?: string;
  resource_url?: string;
}

export interface DiscogsFormat {
  name: string;
  qty: string;
  descriptions?: string[];
  text?: string;
}

export interface DiscogsRelease {
  id: number;
  title: string;
  artists: DiscogsArtist[];
  year: number;
  genres?: string[];
  styles?: string[];
  labels?: DiscogsLabel[];
  formats?: DiscogsFormat[];
  thumb?: string;
  cover_image?: string;
  resource_url?: string;
}

export interface DiscogsCollectionItem {
  id: number;
  instance_id: number;
  date_added: string;
  basic_information: DiscogsRelease;
}

export interface DiscogsPagination {
  items: number;
  page: number;
  pages: number;
  per_page: number;
  urls?: {
    last?: string;
    next?: string;
  };
}

export interface DiscogsSearchResult {
  pagination: DiscogsPagination;
  results: DiscogsRelease[];
}

export interface DiscogsCollectionResponse {
  pagination: DiscogsPagination;
  releases: DiscogsCollectionItem[];
}

export class DiscogsClient {
  private baseUrl = 'https://api.discogs.com';
  private apiKey: string;
  private username: string;
  private userAgent: string;

  constructor() {
    this.apiKey = env.DISCOGS_API_KEY;
    this.username = env.DISCOGS_USERNAME;
    this.userAgent = env.DISCOGS_USER_AGENT;
  }

  private getHeaders(): HeadersInit {
    return {
      'Authorization': `Discogs token=${this.apiKey}`,
      'User-Agent': this.userAgent,
    };
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorText = await response.text();

      if (response.status === 401) {
        throw new Error('Invalid Discogs API token. Please check your DISCOGS_API_KEY.');
      }
      if (response.status === 404) {
        throw new Error('Resource not found on Discogs.');
      }
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Discogs allows 60 requests per minute. Please wait before making more requests.');
      }

      throw new Error(
        `Discogs API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return response.json();
  }

  /**
   * Search user's vinyl collection
   * @param query - Search query (artist, album, label)
   * @param options - Search options (sort, pagination, etc.)
   */
  async searchCollection(
    query: string,
    options?: {
      sort?: 'artist' | 'title' | 'year' | 'added';
      sort_order?: 'asc' | 'desc';
      per_page?: number;
      page?: number;
    }
  ): Promise<DiscogsCollectionResponse> {
    const params = new URLSearchParams();
    params.append('q', query);

    if (options?.sort) {
      params.append('sort', options.sort);
    }
    if (options?.sort_order) {
      params.append('sort_order', options.sort_order);
    }
    if (options?.per_page) {
      params.append('per_page', String(options.per_page));
    }
    if (options?.page) {
      params.append('page', String(options.page));
    }

    const url = `${this.baseUrl}/users/${this.username}/collection/folders/0/releases?${params.toString()}`;

    console.log(`[DiscogsClient] Searching collection: ${query}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    return this.handleResponse<DiscogsCollectionResponse>(response);
  }

  /**
   * Search Discogs database for recommendations
   * @param query - Search query
   * @param options - Search filters (genre, style, year, etc.)
   */
  async searchDatabase(
    query: string,
    options?: {
      type?: 'release' | 'master' | 'artist' | 'label';
      genre?: string;
      style?: string;
      year?: string;
      format?: string;
      per_page?: number;
      page?: number;
    }
  ): Promise<DiscogsSearchResult> {
    const params = new URLSearchParams();
    params.append('q', query);

    // Default to release search
    params.append('type', options?.type || 'release');

    if (options?.genre) {
      params.append('genre', options.genre);
    }
    if (options?.style) {
      params.append('style', options.style);
    }
    if (options?.year) {
      params.append('year', options.year);
    }
    if (options?.format) {
      params.append('format', options.format);
    }
    if (options?.per_page) {
      params.append('per_page', String(options.per_page));
    }
    if (options?.page) {
      params.append('page', String(options.page));
    }

    const url = `${this.baseUrl}/database/search?${params.toString()}`;

    console.log(`[DiscogsClient] Searching database: ${query}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    return this.handleResponse<DiscogsSearchResult>(response);
  }

  /**
   * Get detailed information about a specific release
   * @param releaseId - Discogs release ID
   */
  async getRelease(releaseId: number): Promise<DiscogsRelease> {
    const url = `${this.baseUrl}/releases/${releaseId}`;

    console.log(`[DiscogsClient] Getting release: ${releaseId}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    return this.handleResponse<DiscogsRelease>(response);
  }
}

// Singleton export
export const discogsClient = new DiscogsClient();
