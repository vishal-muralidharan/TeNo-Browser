import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from './firebase'
import { DEFAULT_FEATURE_FLAGS, isEnabled as _isEnabled } from './utils/featureFlags'

// ── Context ──────────────────────────────────────────────────────────────────
const FeatureFlagContext = createContext({
  flags: DEFAULT_FEATURE_FLAGS,
  isEnabled: (/** @type {string} */ _key) => true,
})

/**
 * useFeatureFlags() — access feature flags from any component.
 *
 * Returns:
 *   flags      — the full { links: true, cart: false, … } object
 *   isEnabled  — convenience function: isEnabled('cart') → boolean
 */
export const useFeatureFlags = () => useContext(FeatureFlagContext)

// ── Provider ─────────────────────────────────────────────────────────────────
/**
 * <FeatureFlagProvider> wraps the app and:
 *   1. Boots instantly with DEFAULT_FEATURE_FLAGS (no loading state needed).
 *   2. Subscribes to Firestore `system_config/feature_flags` via onSnapshot.
 *   3. Merges Firestore values on top of defaults — missing keys stay true.
 *   4. Cleans up the listener on unmount.
 *
 * The listener is NOT user-scoped — it reads a single global document so
 * there is no dependency on auth state.
 */
export const FeatureFlagProvider = ({ children }) => {
  const [flags, setFlags] = useState(DEFAULT_FEATURE_FLAGS)

  useEffect(() => {
    const flagsRef = doc(db, 'system_config', 'feature_flags')

    const unsubscribe = onSnapshot(
      flagsRef,
      (snapshot) => {
        if (snapshot.exists()) {
          // Merge: defaults ← Firestore overrides
          // Only boolean values from Firestore are applied; unknown keys are ignored.
          const remote = snapshot.data()
          const merged = { ...DEFAULT_FEATURE_FLAGS }
          for (const key of Object.keys(DEFAULT_FEATURE_FLAGS)) {
            if (typeof remote[key] === 'boolean') {
              merged[key] = remote[key]
            }
          }
          setFlags(merged)
        }
        // If the document doesn't exist, keep defaults (everything enabled)
      },
      (error) => {
        // Permission error or network failure — keep defaults, log for debug
        console.error('[FeatureFlags] Firestore listener error:', error)
      },
    )

    return unsubscribe
  }, [])

  // Stable callback so consumers don't re-render when flags haven't changed
  const isEnabled = useCallback(
    (key) => _isEnabled(flags, key),
    [flags],
  )

  return (
    <FeatureFlagContext.Provider value={{ flags, isEnabled }}>
      {children}
    </FeatureFlagContext.Provider>
  )
}
