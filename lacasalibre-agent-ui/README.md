# Home Assistant Agent UI

A Next.js-based UI for a LangGraph-powered home agent that controls Home Assistant via REST API.

## Features

- **Server-side agent runtime**: LangGraph runs on the server; Home Assistant token never exposed to browser
- **Real-time streaming UI**: See each step as it happens using Server-Sent Events (NEW!)
- **Real-time chat interface**: Chat with your home agent
- **Execution tracing**: View detailed trace of agent runs including tool calls and results
- **LLM Prompt Visibility**: See the exact messages/context sent to the LLM
- **Smart device discovery**: Agent automatically searches for devices before taking actions
- **Home Assistant integration**: Control your home via REST API
- **Configurable allowlists**: Optionally restrict which entities and services can be accessed

## Architecture

- **Frontend**: Next.js 15 (App Router) + React 19 + TypeScript
- **Agent**: LangGraph with OpenAI GPT-4
- **Tools**: Three LangChain tools for Home Assistant:
  - `ha_list_entities`: Discover and search for available devices (NEW!)
  - `ha_get_entity_state`: Get state of any entity
  - `ha_call_service`: Call any Home Assistant service
- **Tracing**: Structured execution trace with timestamps and step tracking

## Prerequisites

- Node.js 18+ and npm
- Home Assistant instance with REST API enabled
- Home Assistant long-lived access token
- OpenAI API key

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and fill in your actual values:
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `HOME_ASSISTANT_BASE_URL`: Your Home Assistant URL (e.g., `http://homeassistant.local:8123`)
   - `HOME_ASSISTANT_TOKEN`: Your Home Assistant long-lived access token

   To create a Home Assistant token:
   - Go to your Home Assistant profile
   - Scroll to "Long-Lived Access Tokens"
   - Click "Create Token"

3. **Run the development server**:
   ```bash
   npm run dev
   ```

4. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## Usage

Simply type natural language commands in the chat interface. The agent will **automatically discover** available devices when needed:

### Smart Device Discovery
The agent now intelligently searches for devices before taking actions:

- **"Turn on the kitchen lights"** → Agent searches for kitchen lights, then controls them
- **"What lights are in the bedroom?"** → Agent lists all bedroom light entities
- **"Set the living room temperature to 72"** → Agent finds thermostats in living room

### Example Queries
- "What devices do you have access to?"
- "List all lights in the house"
- "Show me all temperature sensors"
- "Turn on the bedroom lights"
- "What's the state of the thermostat?"
- "Turn off all kitchen devices"

### How It Works
1. When you ask about a device the agent doesn't know, it uses `ha_list_entities` to search
2. The agent filters by domain (light, switch, sensor, etc.) and/or location (kitchen, bedroom)
3. Once found, it can get states or control the devices
4. All actions are visible in the trace panel

The UI shows:
- **Left panel**: Conversation with the agent
- **Right panel**: Real-time execution trace showing:
  - **LLM_PROMPT events** (purple): Full conversation context sent to GPT-4
  - **TOOL_CALL events** (orange): Agent calling Home Assistant tools
  - **TOOL_RESULT events** (cyan): Results from tool executions
  - **USER/ASSISTANT events** (blue/green): Chat messages
  - Events appear **as they happen** using Server-Sent Events streaming

## Allowlist Configuration

By default, the agent can access **all** entities and services (`ALLOW_ALL_ENTITIES = true`, `ALLOW_ALL_SERVICES = true`).

To restrict access:

1. Open [src/config/allowlist.ts](src/config/allowlist.ts)
2. Set `ALLOW_ALL_ENTITIES = false` and/or `ALLOW_ALL_SERVICES = false`
3. Add specific entity IDs to `READ_ENTITIES`:
   ```typescript
   export const READ_ENTITIES: Set<string> = new Set([
     'light.living_room',
     'sensor.temperature',
   ]);
   ```
4. Add specific services to `WRITE_SERVICES`:
   ```typescript
   export const WRITE_SERVICES: Set<string> = new Set([
     'light.turn_on',
     'light.turn_off',
     'switch.toggle',
   ]);
   ```

The allowlist enforcement logic is already implemented in [src/tools/haTools.ts](src/tools/haTools.ts).

## House Context Configuration

The agent includes a system message that teaches it about your house layout, room aliases, and device mappings. This allows natural language understanding of phrases like "Guy's room" → "Master Bedroom" or "my office" → "Work Room".

To customize the agent's understanding of your home:

1. Open [src/config/houseContext.ts](src/config/houseContext.ts)
2. Edit the `HOUSE_SYSTEM_MESSAGE` to match your house:
   - Update room names and aliases
   - Add/remove residents
   - Map switch entities to their room/purpose
   - Add common variations people use when speaking

### Why This Matters

Many Home Assistant setups use `switch.*` entities to control lights (especially with older smart plugs or relay switches). The agent's system message tells it to:
- Search in the `switch` domain when looking for lights
- Understand room aliases ("Guy's room" = "Master Bedroom")
- Exclude non-light switches (boiler, appliances, etc.)

Without this context, the LLM might search `domain="light"` and find nothing, even though `switch.kitchen` controls the kitchen light.

## Project Structure

```
lacasalibre-agent-ui/
├── src/
│   ├── app/
│   │   ├── api/chat/
│   │   │   └── route.ts          # Chat API endpoint
│   │   ├── globals.css           # UI styles
│   │   ├── layout.tsx            # Root layout
│   │   └── page.tsx              # Main UI component
│   ├── agent/
│   │   ├── graph.ts              # LangGraph workflow
│   │   └── tracing.ts            # Trace event types
│   ├── config/
│   │   ├── allowlist.ts          # Allowlist configuration
│   │   ├── env.ts                # Environment validation
│   │   └── houseContext.ts       # House layout and room aliases
│   ├── ha/
│   │   └── client.ts             # Home Assistant REST client
│   └── tools/
│       └── haTools.ts            # LangChain tools
├── .env.example                  # Environment template
├── .gitignore
├── next.config.ts
├── package.json
├── tsconfig.json
└── README.md
```

## Development

- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run start`: Start production server
- `npm run lint`: Run ESLint

## Thread Management

The app maintains conversation context using thread IDs. Threads are stored in memory (will reset when server restarts). For production, consider using:
- Database (PostgreSQL, MongoDB)
- Redis
- LangGraph checkpointer with persistent storage

## Security Notes

- Environment variables (`.env`) are **never** committed to Git
- Home Assistant token is only used server-side
- All API calls to Home Assistant are made from the Next.js server
- Browser never has access to secrets

## Troubleshooting

**"Missing required environment variables" error**:
- Make sure you've copied `.env.example` to `.env`
- Verify all three environment variables are set in `.env`

**"Failed to get state" or "Failed to call service" errors**:
- Check that your `HOME_ASSISTANT_BASE_URL` is correct and accessible
- Verify your `HOME_ASSISTANT_TOKEN` is valid
- Ensure the entity IDs or services exist in your Home Assistant instance

**Agent not responding**:
- Check that your `OPENAI_API_KEY` is valid and has available quota
- Check the server console for error messages

## License

ISC
