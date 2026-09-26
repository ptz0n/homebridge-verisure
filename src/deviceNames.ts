/** Maps Verisure's internal climate/gui device labels to a human name, which
 * is then run through `i18n()` for display. */
export const CLIMATE_DEVICE_NAMES: Record<string, string> = {
  HOMEPAD: 'VoiceBox',
  HUMIDITY: 'Climate sensor',
  SIREN: 'Siren',
  SMOKE: 'Smoke detector',
  VOICEBOX: 'VoiceBox',
  // Old ones, not verified from GraphQL.
  SMARTCAMERA1: 'SmartCam',
  WATER1: 'Water detector',
};
