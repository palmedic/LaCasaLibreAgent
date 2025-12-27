import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { haClient } from '@/ha/client';

// Helper to find Arlo alarm control panel entity
async function findArloAlarmPanel(): Promise<string | null> {
  const allEntities = await haClient.listAllEntities();
  const arloPanel = allEntities.find(e =>
    e.entity_id.startsWith('alarm_control_panel.aarlo')
  );
  return arloPanel?.entity_id || null;
}

// Helper to find Arlo camera entities
async function findArloCameras(): Promise<Array<{ entity_id: string; friendly_name: string; state: string }>> {
  const allEntities = await haClient.listAllEntities();
  return allEntities
    .filter(e => e.entity_id.startsWith('camera.aarlo'))
    .map(e => ({
      entity_id: e.entity_id,
      friendly_name: (e.attributes.friendly_name as string) || e.entity_id,
      state: e.state,
    }));
}


// Tool 1: Get Arlo system status
export const arloGetStatusTool = tool(
  async () => {
    try {
      const allEntities = await haClient.listAllEntities();

      // Find alarm panel
      const alarmPanel = allEntities.find(e =>
        e.entity_id.startsWith('alarm_control_panel.aarlo')
      );

      // Find cameras
      const cameras = allEntities
        .filter(e => e.entity_id.startsWith('camera.aarlo'))
        .map(e => ({
          entity_id: e.entity_id,
          friendly_name: e.attributes.friendly_name || e.entity_id,
          state: e.state,
          battery_level: e.attributes.battery_level,
          motion_detected: e.attributes.motion_detected,
        }));

      // Find sensors (motion, battery, signal, etc.)
      const sensors = allEntities
        .filter(e => e.entity_id.includes('aarlo') && e.entity_id.startsWith('sensor.'))
        .map(e => ({
          entity_id: e.entity_id,
          friendly_name: e.attributes.friendly_name || e.entity_id,
          state: e.state,
          unit: e.attributes.unit_of_measurement,
        }));

      // Find binary sensors (motion, sound, connectivity)
      const binarySensors = allEntities
        .filter(e => e.entity_id.includes('aarlo') && e.entity_id.startsWith('binary_sensor.'))
        .map(e => ({
          entity_id: e.entity_id,
          friendly_name: e.attributes.friendly_name || e.entity_id,
          state: e.state,
        }));

      return JSON.stringify({
        success: true,
        alarm_panel: alarmPanel ? {
          entity_id: alarmPanel.entity_id,
          state: alarmPanel.state, // disarmed, armed_away, armed_home, etc.
          friendly_name: alarmPanel.attributes.friendly_name,
        } : null,
        cameras,
        sensors,
        binary_sensors: binarySensors,
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[arlo_get_status] Error:', message);
      return JSON.stringify({
        success: false,
        error: `Failed to get Arlo status: ${message}`,
      });
    }
  },
  {
    name: 'arlo_get_status',
    description:
      'Get the current status of the Arlo security system. ' +
      'Returns alarm panel state (armed/disarmed), camera states, battery levels, motion sensors, and connectivity status. ' +
      'Use this to check if the security system is armed, see camera status, or check for motion events.',
    schema: z.object({}),
  }
);

// Tool 2: Set Arlo alarm mode
export const arloSetModeTool = tool(
  async ({ mode }) => {
    try {
      const alarmPanel = await findArloAlarmPanel();

      if (!alarmPanel) {
        return JSON.stringify({
          success: false,
          error: 'No Arlo alarm panel found. Make sure aarlo integration is configured.',
        });
      }

      let service: string;
      let domain: string;
      let data: Record<string, unknown>;

      // Standard modes use alarm_control_panel services
      if (mode === 'disarmed') {
        domain = 'alarm_control_panel';
        service = 'alarm_disarm';
        data = { entity_id: alarmPanel };
      } else if (mode === 'armed_away' || mode === 'away') {
        domain = 'alarm_control_panel';
        service = 'alarm_arm_away';
        data = { entity_id: alarmPanel };
      } else if (mode === 'armed_home' || mode === 'home') {
        domain = 'alarm_control_panel';
        service = 'alarm_arm_home';
        data = { entity_id: alarmPanel };
      } else if (mode === 'armed_night' || mode === 'night') {
        domain = 'alarm_control_panel';
        service = 'alarm_arm_night';
        data = { entity_id: alarmPanel };
      } else {
        // Custom mode - use aarlo.alarm_set_mode
        domain = 'aarlo';
        service = 'alarm_set_mode';
        data = { entity_id: alarmPanel, mode };
      }

      console.log(`[arlo_set_mode] Setting mode to "${mode}" via ${domain}.${service}`);

      await haClient.callService(domain, service, data);

      return JSON.stringify({
        success: true,
        mode,
        alarm_panel: alarmPanel,
        message: `Arlo alarm set to ${mode}`,
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[arlo_set_mode] Error:', message);
      return JSON.stringify({
        success: false,
        error: `Failed to set Arlo mode: ${message}`,
      });
    }
  },
  {
    name: 'arlo_set_mode',
    description:
      'Set the Arlo alarm system mode. ' +
      'Standard modes: "disarmed" (off), "armed_away" or "away" (full protection), "armed_home" or "home" (partial), "armed_night" or "night". ' +
      'You can also set custom modes defined in your Arlo system by providing the mode name. ' +
      'Examples: "Set Arlo to away mode", "Arm the security system", "Disarm Arlo"',
    schema: z.object({
      mode: z
        .string()
        .describe('The alarm mode: "disarmed", "armed_away", "away", "armed_home", "home", "armed_night", "night", or a custom mode name'),
    }),
  }
);

// Helper function to wait
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Tool 3: Take camera snapshot
export const arloSnapshotTool = tool(
  async ({ camera_name }) => {
    try {
      const cameras = await findArloCameras();

      if (cameras.length === 0) {
        return JSON.stringify({
          success: false,
          error: 'No Arlo cameras found.',
        });
      }

      // Find the specified camera or use the first one
      let targetCamera: string;
      let cameraFriendlyName: string;
      if (camera_name) {
        const found = cameras.find(c =>
          c.entity_id.toLowerCase().includes(camera_name.toLowerCase()) ||
          c.friendly_name.toLowerCase().includes(camera_name.toLowerCase())
        );
        if (!found) {
          return JSON.stringify({
            success: false,
            error: `Camera "${camera_name}" not found. Available cameras: ${cameras.map(c => c.friendly_name).join(', ')}`,
          });
        }
        targetCamera = found.entity_id;
        cameraFriendlyName = found.friendly_name;
      } else {
        targetCamera = cameras[0].entity_id;
        cameraFriendlyName = cameras[0].friendly_name;
      }

      console.log(`[arlo_snapshot] Requesting snapshot from ${targetCamera}`);

      // Request a fresh snapshot
      await haClient.callService('aarlo', 'camera_request_snapshot', {
        entity_id: targetCamera,
      });

      // Wait for the snapshot to be captured (Arlo cameras can take a few seconds)
      console.log('[arlo_snapshot] Waiting for snapshot to be captured...');
      await sleep(3000);

      // Fetch the image from Home Assistant
      console.log('[arlo_snapshot] Fetching image from camera proxy...');
      const imageData = await haClient.getCameraImage(targetCamera);

      console.log(`[arlo_snapshot] Image fetched successfully (${Math.round(imageData.length / 1024)}KB)`);

      return JSON.stringify({
        success: true,
        camera: targetCamera,
        camera_name: cameraFriendlyName,
        image: imageData,
        message: `Snapshot captured from ${cameraFriendlyName}`,
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[arlo_snapshot] Error:', message);
      return JSON.stringify({
        success: false,
        error: `Failed to take snapshot: ${message}`,
      });
    }
  },
  {
    name: 'arlo_snapshot',
    description:
      'Request a snapshot from an Arlo camera and return the image. ' +
      'Takes a current picture from the specified camera (or first available camera if not specified). ' +
      'Returns the image as base64 data that can be displayed.',
    schema: z.object({
      camera_name: z
        .string()
        .optional()
        .nullable()
        .describe('Optional: Name or part of camera name (e.g., "front door", "backyard"). If not specified, uses the first camera.'),
    }),
  }
);

// Tool 4: Start/stop camera recording
export const arloRecordingTool = tool(
  async ({ camera_name, action, duration }) => {
    try {
      const cameras = await findArloCameras();

      if (cameras.length === 0) {
        return JSON.stringify({
          success: false,
          error: 'No Arlo cameras found.',
        });
      }

      // Find the specified camera or use the first one
      let targetCamera: string;
      if (camera_name) {
        const found = cameras.find(c =>
          c.entity_id.toLowerCase().includes(camera_name.toLowerCase()) ||
          c.friendly_name.toLowerCase().includes(camera_name.toLowerCase())
        );
        if (!found) {
          return JSON.stringify({
            success: false,
            error: `Camera "${camera_name}" not found. Available cameras: ${cameras.map(c => c.friendly_name).join(', ')}`,
          });
        }
        targetCamera = found.entity_id;
      } else {
        targetCamera = cameras[0].entity_id;
      }

      if (action === 'start') {
        console.log(`[arlo_recording] Starting recording on ${targetCamera} for ${duration || 30} seconds`);

        await haClient.callService('aarlo', 'camera_start_recording', {
          entity_id: targetCamera,
          duration: duration || 30,
        });

        return JSON.stringify({
          success: true,
          action: 'started',
          camera: targetCamera,
          duration: duration || 30,
          message: `Recording started on ${targetCamera} for ${duration || 30} seconds`,
        });
      } else {
        console.log(`[arlo_recording] Stopping recording on ${targetCamera}`);

        await haClient.callService('aarlo', 'camera_stop_activity', {
          entity_id: targetCamera,
        });

        return JSON.stringify({
          success: true,
          action: 'stopped',
          camera: targetCamera,
          message: `Recording stopped on ${targetCamera}`,
        });
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[arlo_recording] Error:', message);
      return JSON.stringify({
        success: false,
        error: `Failed to ${action} recording: ${message}`,
      });
    }
  },
  {
    name: 'arlo_recording',
    description:
      'Start or stop video recording on an Arlo camera. ' +
      'Use action "start" to begin recording (default 30 seconds), or "stop" to end recording. ' +
      'The recording will be saved to the Arlo cloud library.',
    schema: z.object({
      camera_name: z
        .string()
        .optional()
        .nullable()
        .describe('Optional: Name or part of camera name. If not specified, uses the first camera.'),
      action: z
        .enum(['start', 'stop'])
        .describe('Action to perform: "start" to begin recording, "stop" to end recording'),
      duration: z
        .number()
        .optional()
        .nullable()
        .describe('Optional: Recording duration in seconds (default: 30). Only used with "start" action.'),
    }),
  }
);

// Tool 5: Control siren
export const arloSirenTool = tool(
  async ({ action, duration, volume }) => {
    try {
      if (action === 'on') {
        console.log(`[arlo_siren] Activating siren (duration: ${duration || 10}s, volume: ${volume || 8})`);

        await haClient.callService('aarlo', 'siren_on', {
          duration: duration || 10,
          volume: volume || 8,
        });

        return JSON.stringify({
          success: true,
          action: 'activated',
          duration: duration || 10,
          volume: volume || 8,
          message: `Siren activated for ${duration || 10} seconds at volume ${volume || 8}`,
        });
      } else {
        console.log('[arlo_siren] Deactivating all sirens');

        await haClient.callService('aarlo', 'sirens_off', {});

        return JSON.stringify({
          success: true,
          action: 'deactivated',
          message: 'All sirens turned off',
        });
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[arlo_siren] Error:', message);
      return JSON.stringify({
        success: false,
        error: `Failed to control siren: ${message}`,
      });
    }
  },
  {
    name: 'arlo_siren',
    description:
      'Control the Arlo siren. ' +
      'Turn on the siren with specified duration and volume, or turn it off. ' +
      'WARNING: This will trigger a loud alarm! Use carefully.',
    schema: z.object({
      action: z
        .enum(['on', 'off'])
        .describe('Action: "on" to activate siren, "off" to deactivate'),
      duration: z
        .number()
        .optional()
        .nullable()
        .describe('Optional: How long the siren should sound in seconds (default: 10, max: 300). Only used with "on".'),
      volume: z
        .number()
        .optional()
        .nullable()
        .describe('Optional: Siren volume level 1-10 (default: 8). Only used with "on".'),
    }),
  }
);

// Tool 6: List Arlo devices
export const arloListDevicesTool = tool(
  async () => {
    try {
      const allEntities = await haClient.listAllEntities();

      // Group entities by type
      const alarmPanels = allEntities
        .filter(e => e.entity_id.startsWith('alarm_control_panel.aarlo'))
        .map(e => ({
          entity_id: e.entity_id,
          friendly_name: e.attributes.friendly_name || e.entity_id,
          state: e.state,
        }));

      const cameras = allEntities
        .filter(e => e.entity_id.startsWith('camera.aarlo'))
        .map(e => ({
          entity_id: e.entity_id,
          friendly_name: e.attributes.friendly_name || e.entity_id,
          state: e.state,
          model: e.attributes.model,
          brand: e.attributes.brand,
        }));

      const sirens = allEntities
        .filter(e => e.entity_id.includes('aarlo') && (e.entity_id.includes('siren') || e.entity_id.startsWith('switch.aarlo')))
        .map(e => ({
          entity_id: e.entity_id,
          friendly_name: e.attributes.friendly_name || e.entity_id,
          state: e.state,
        }));

      const sensors = allEntities
        .filter(e => e.entity_id.includes('aarlo') && (e.entity_id.startsWith('sensor.') || e.entity_id.startsWith('binary_sensor.')))
        .map(e => ({
          entity_id: e.entity_id,
          friendly_name: e.attributes.friendly_name || e.entity_id,
          state: e.state,
          type: e.entity_id.split('.')[0],
        }));

      return JSON.stringify({
        success: true,
        devices: {
          alarm_panels: alarmPanels,
          cameras,
          sirens,
          sensors,
        },
        summary: {
          total_alarm_panels: alarmPanels.length,
          total_cameras: cameras.length,
          total_sirens: sirens.length,
          total_sensors: sensors.length,
        },
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[arlo_list_devices] Error:', message);
      return JSON.stringify({
        success: false,
        error: `Failed to list Arlo devices: ${message}`,
      });
    }
  },
  {
    name: 'arlo_list_devices',
    description:
      'List all Arlo devices and their current states. ' +
      'Returns all alarm panels, cameras, sirens, and sensors registered with the Arlo integration. ' +
      'Use this to discover available Arlo devices and their entity IDs.',
    schema: z.object({}),
  }
);

// Export all Arlo tools
export const arloTools = [
  arloGetStatusTool,
  arloSetModeTool,
  arloSnapshotTool,
  arloRecordingTool,
  arloSirenTool,
  arloListDevicesTool,
];
