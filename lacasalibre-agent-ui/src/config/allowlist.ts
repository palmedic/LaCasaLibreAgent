// Allowlist configuration for Home Assistant entities and services
// When ALLOW_ALL_* flags are true, the allowlists are not enforced

export const ALLOW_ALL_ENTITIES = true;
export const ALLOW_ALL_SERVICES = true;

// Allowlist of entity IDs that can be read
// Example: new Set(['light.living_room', 'switch.bedroom', 'sensor.temperature'])
export const READ_ENTITIES: Set<string> = new Set([
  // Add allowed entity IDs here when you want to restrict access
]);

// Allowlist of services that can be called
// Format: 'domain.service' (e.g., 'light.turn_on', 'switch.toggle')
export const WRITE_SERVICES: Set<string> = new Set([
  // Add allowed services here when you want to restrict access
  // Example: 'light.turn_on', 'light.turn_off', 'switch.toggle'
]);

export function isEntityAllowed(entityId: string): boolean {
  if (ALLOW_ALL_ENTITIES) {
    return true;
  }
  return READ_ENTITIES.has(entityId);
}

export function isServiceAllowed(domain: string, service: string): boolean {
  if (ALLOW_ALL_SERVICES) {
    return true;
  }
  const serviceKey = `${domain}.${service}`;
  return WRITE_SERVICES.has(serviceKey);
}
