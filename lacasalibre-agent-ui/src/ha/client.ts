import { env } from '@/config/env';

export interface HAState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
  context: {
    id: string;
    parent_id: string | null;
    user_id: string | null;
  };
}

export interface HAServiceCallResponse {
  success?: boolean;
  error?: string;
  [key: string]: unknown;
}

export class HomeAssistantClient {
  private baseUrl: string;
  private token: string;

  constructor() {
    this.baseUrl = env.HOME_ASSISTANT_BASE_URL;
    this.token = env.HOME_ASSISTANT_TOKEN;
  }

  private getHeaders(): HeadersInit {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };
  }

  async getEntityState(entityId: string): Promise<HAState> {
    const url = `${this.baseUrl}/api/states/${entityId}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to get state for ${entityId}: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return response.json();
  }

  async callService(
    domain: string,
    service: string,
    data?: Record<string, unknown>
  ): Promise<HAServiceCallResponse> {
    const url = `${this.baseUrl}/api/services/${domain}/${service}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data || {}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to call service ${domain}.${service}: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    // Service calls often return an array of states or empty array
    const result = await response.json();
    return { success: true, result };
  }

  async listAllEntities(): Promise<HAState[]> {
    const url = `${this.baseUrl}/api/states`;

    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to list entities: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return response.json();
  }
}

export const haClient = new HomeAssistantClient();
