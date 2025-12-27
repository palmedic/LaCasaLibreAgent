// API endpoint to expose server configuration for the UI
export async function GET() {
  const config = {
    model: 'gpt-4o',
    provider: 'OpenAI',
    temperature: 0.7,
    framework: 'LangGraph',
    tools: {
      homeAssistant: 6,
      discogs: 3,
      arlo: 6,
      total: 15,
    },
    features: [
      'Real-time streaming (SSE)',
      'Image extraction for token savings',
      'Entity caching',
    ],
  };

  return Response.json(config);
}
