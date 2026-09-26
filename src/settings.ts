export const PLATFORM_NAME = 'verisure';
export const PLUGIN_NAME = 'homebridge-verisure';

/** How long a cached Verisure overview may be reused for an ad-hoc HomeKit
 * "get" request before we fetch a fresh one. Collapses bursts of near
 * simultaneous reads (HomeKit often asks for several characteristics within
 * the same second) into a single API call. The scheduled poll tick always
 * forces a fresh fetch regardless of this value. */
export const OVERVIEW_CACHE_TTL_MS = 5000;

/** Same idea, for the door lock configuration query (auto-lock + audio
 * volume), which is otherwise fetched independently by up to three different
 * characteristics. */
export const DOOR_LOCK_CONFIG_CACHE_TTL_MS = 5000;

/** Upper bound on how long we'll keep polling for an arm/lock state change
 * to resolve before giving up. Without a cap, a Verisure-side issue that
 * never resolves a transaction would make resolveChangeResult() retry
 * forever. */
export const CHANGE_RESULT_TIMEOUT_MS = 30000;
export const CHANGE_RESULT_POLL_INTERVAL_MS = 200;

/** Minimum time to wait before polling again after a rate-limit response,
 * regardless of the configured pollInterval. */
export const RATE_LIMIT_BACKOFF_MS = 15 * 60 * 1000;
