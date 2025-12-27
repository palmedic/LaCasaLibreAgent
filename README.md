# La Casa Libre Agent

A Home Assistant AI agent with Dr. House personality, built with Next.js, LangGraph, and OpenAI.

## Features

- **Natural Language Control**: Talk to your smart home like talking to Dr. House
- **Entity Search**: Smart entity matching with synonyms and fuzzy search
- **Real-Time Streaming**: Server-Sent Events for responsive chat experience
- **Spotify Integration**: Play music on Home Assistant speakers with natural language
- **Discogs Integration**: Search your vinyl collection and get music recommendations
- **Arlo Security**: Control Arlo cameras, alarm modes, sirens, and recordings
- **Entity Caching**: Fast access to 480+ Home Assistant entities

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **AI**: LangGraph + OpenAI GPT-4o
- **Language**: TypeScript
- **APIs**: Home Assistant REST API, Spotify Web API, Discogs API, Arlo (via aarlo)
- **Deployment**: Vercel-ready

## Setup

1. Clone the repository:
```bash
git clone https://github.com/palmedic/LaCasaLibreAgent.git
cd LaCasaLibreAgent/lacasalibre-agent-ui
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
```

Edit `.env` with your credentials:
- `OPENAI_API_KEY`: Get from [OpenAI Platform](https://platform.openai.com/api-keys)
- `HOME_ASSISTANT_BASE_URL`: Your Home Assistant URL (e.g., https://admin.lacasalibre.com)
- `HOME_ASSISTANT_TOKEN`: Long-lived access token from Home Assistant
- `SPOTIFY_CLIENT_ID`: From [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
- `SPOTIFY_CLIENT_SECRET`: From Spotify Developer Dashboard
- `SPOTIFY_REDIRECT_URI`: Your callback URL (e.g., https://admin.lacasalibre.com/api/spotify/callback)
- `DISCOGS_TOKEN`: Personal access token from [Discogs Developer Settings](https://www.discogs.com/settings/developers)
- `DISCOGS_USERNAME`: Your Discogs username (for collection access)

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

## Available Tools

The agent has access to these tools:

### Home Assistant Tools
1. **ha_smart_search** - Natural language entity search with synonyms
2. **ha_list_entities** - List entities by domain/area
3. **ha_get_entity_state** - Get detailed entity information
4. **ha_call_service** - Execute Home Assistant services
5. **ha_play_spotify** - Search Spotify and play music on speakers
6. **ha_get_weather** - Get current weather and forecast

### Discogs Tools
7. **discogs_search_collection** - Search your personal vinyl record collection
8. **discogs_search_database** - Search the global Discogs database for recommendations
9. **discogs_get_release** - Get detailed information about a specific album

### Arlo Security Tools
10. **arlo_get_status** - Get current status of alarm, cameras, and sensors
11. **arlo_set_mode** - Set alarm mode (armed_away, armed_home, disarmed, custom modes)
12. **arlo_snapshot** - Take a snapshot from any Arlo camera
13. **arlo_recording** - Start or stop video recording on cameras
14. **arlo_siren** - Activate or deactivate the Arlo siren
15. **arlo_list_devices** - List all Arlo devices and their states

## Example Interactions

- "Turn on the living room lights"
- "What's the temperature in the bedroom?"
- "Play some jazz music"
- "Play Coldplay in the bedroom"
- "Is the front door locked?"
- "Set the thermostat to 72 degrees"
- "Do I have any Miles Davis records?"
- "Recommend some bebop albums"
- "What's the weather like?"
- "Arm the security system"
- "Is the Arlo alarm on?"
- "Take a snapshot from the front door camera"

## Dr. House Personality

The agent responds with House's characteristic sarcasm:

> "You want me to turn on the lights? Because apparently, evolution forgot to give you opposable thumbs. Fine. *turns on lights*"

## Deployment

### Vercel

- Framework: Next.js
- Root Directory: `lacasalibre-agent-ui`
- Environment Variables: Add all variables from `.env`

## Auto-Commit Feature

This project uses Claude Code hooks to automatically commit and push changes to GitHub whenever files are modified.

## License

MIT
