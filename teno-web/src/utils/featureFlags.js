/**
 * featureFlags.js
 *
 * Central source of truth for all feature flag IDs and their default states.
 * These defaults are used immediately on app boot (before Firestore responds)
 * and as the fallback if the Firestore document is missing or a key is absent.
 *
 * Flag semantics:
 *   true  = feature is enabled (visible, functional)
 *   false = feature is disabled (hidden from UI, Firestore listeners skipped)
 *
 * Firestore location: system_config/feature_flags
 */

export const DEFAULT_FEATURE_FLAGS = {
  /** Core modules (tabs) */
  links:          true,
  cart:            true,
  reminders:       true,
  timer:           true,

  /** Structural UI */
  terminal:        true,

  /** Settings sub-features */
  settings:        true,
  clickStats:      true,
  changePassword:  true,
}

/**
 * Pure helper — checks whether a feature is enabled in a flags object.
 * A missing key is treated as enabled (fail-open).
 *
 * @param {Record<string, boolean>} flags
 * @param {string} key
 * @returns {boolean}
 */
export const isEnabled = (flags, key) => flags[key] !== false
