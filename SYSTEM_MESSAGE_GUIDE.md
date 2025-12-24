# System Message Configuration Guide

## Overview

The agent uses a system message to understand your house layout, room names, and device mappings. This allows it to handle natural language variations like:

- "Turn on Guy's room light" → finds `switch.master_bedroom`
- "Turn on my office light" → finds `switch.work_room`
- "Turn on the kitchen light" → searches in `switch` domain, not `light` domain

## Why This Matters

Your Home Assistant setup uses **switch entities** (`switch.*`) to control most lights, not light entities (`light.*`). Without proper context, the LLM would:

1. Hear "turn on the kitchen light"
2. Search for `domain="light"` + `search_term="kitchen"`
3. Find **0 results** (because your kitchen light is `switch.kitchen`)
4. Fail to complete the task

The system message teaches the LLM to:
- Search in the `switch` domain for lights
- Understand room aliases and variations
- Exclude non-light switches (boiler, appliances, etc.)

## Configuration File

Edit [src/config/houseContext.ts](lacasalibre-agent-ui/src/config/houseContext.ts) to customize the system message.

## Key Sections to Update

### 1. Room Light Mappings

```typescript
ROOM LIGHT MAPPINGS (switch.* entities that control lights):
- Kitchen: switch.kitchen (friendly_name: "Kitchen Light")
- Master Bedroom / Guy's Room: switch.master_bedroom
- Work Room / Home Office / Guy's Office: switch.work_room
```

**What to update:**
- Add new rooms as you add devices
- Include the actual entity ID and friendly name
- List all variations of the room name

### 2. Room Aliases

```typescript
ROOM ALIASES AND VARIATIONS:
- "Master Bedroom" = "Guy's room" = "Guy's bedroom" = "bedroom"
- "Work Room" = "Home Office" = "Guy's office" = "office"
```

**What to update:**
- Add how people in your household refer to rooms
- Include possessive forms ("my room", "Guy's room")
- Add language variations if multilingual

### 3. Residents

```typescript
RESIDENTS:
- Guy (owner, primary resident)
- Uses: Master Bedroom, Work Room/Home Office
```

**What to update:**
- List all household members
- Map each person to their rooms
- This helps with "my room", "my office" type commands

### 4. Search Strategy

```typescript
SEARCH STRATEGY FOR LIGHTS:
1. When user asks about "lights", DO NOT filter by domain="light"
2. Instead, use domain="switch" OR no domain filter at all
3. Search by room name
```

**When to update:**
- If you add actual `light.*` entities later
- If you change device naming patterns
- If you wrap switches as lights (using the YAML configuration)

### 5. Entities to Exclude

```typescript
ENTITIES TO EXCLUDE (these are NOT lights):
- switch.boiler (heating system)
- switch.dishwasher_* (appliance features)
- switch.marcel_* (robot vacuum)
```

**What to update:**
- Add new non-light switches as you install them
- Helps the LLM avoid suggesting "turn on the boiler" when you say "turn on all lights"

## Testing Your Changes

1. Edit [src/config/houseContext.ts](lacasalibre-agent-ui/src/config/houseContext.ts)
2. Save the file
3. Restart the dev server: `npm run dev`
4. Test with natural language queries:
   - "Turn on [room name] light"
   - "Turn on my room light" (if you added a resident)
   - "What lights are on?"

## Advanced: Multiple Languages or Households

If you have multiple people or languages, you can expand the aliases:

```typescript
ROOM ALIASES AND VARIATIONS:
- "Master Bedroom" = "Guy's room" = "חדר ראשי" (Hebrew) = "bedroom"
- "Kids Bathroom" = "children's bathroom" = "האמבטיה של הילדים" (Hebrew)

RESIDENTS:
- Guy (owner, uses: Master Bedroom, Work Room)
- [Partner name] (uses: Master Bedroom, [other rooms])
- Kids (use: Kids Bathroom, Kids Bedroom)

CONTEXT-AWARE MAPPING:
- "my room" → depends on who's speaking (requires voice identification)
- For now, "my room" defaults to Guy's room (master bedroom)
```

## After Wrapping Switches as Lights

If you later implement the YAML wrapper configuration ([home-assistant-light-wrappers.yaml](lacasalibre-agent-ui/home-assistant-light-wrappers.yaml)), you should update the system message:

1. Change search strategy to allow `domain="light"`
2. Update entity IDs from `switch.*` to `light.*`
3. Keep the room aliases (they'll still be useful)

Example update:

```typescript
CRITICAL: LIGHTS ARE NOW IN BOTH DOMAINS
After wrapping switches as lights, most lights appear in both domains:
- switch.kitchen (original entity)
- light.kitchen_ceiling_light (wrapper)

PREFER using light.* entities when available.

SEARCH STRATEGY FOR LIGHTS:
1. When user asks about "lights", search domain="light" first
2. If not found, fall back to domain="switch"
3. Search by room name
```

## Viewing the System Message in Action

The system message is visible in the UI when you expand LLM_PROMPT events (purple badges in the trace panel). You'll see it as the first message in the conversation context sent to GPT-4.

This helps you debug if the agent is misunderstanding commands - you can see exactly what context it has.
