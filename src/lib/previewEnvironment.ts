/**
 * Preview environment detection.
 *
 * Lovable preview surfaces (lovableproject.com, lovable.app, gpt-eng.com,
 * gptengineer.run) are NOT in the Firebase project's authorized domains list,
 * so Firebase Auth rejects all sign-in attempts with `auth/unauthorized-domain`.
 *
 * Adding those domains to Firebase Console → Authentication → Settings →
 * Authorized domains would fix it, but:
 *   1. Lovable preview domains are ephemeral and per-project, so the list would
 *      need constant maintenance.
 *   2. The developer may not have Firebase project owner access.
 *
 * Instead, when running on a preview domain we fall back to **local-only auth**
 * (the persistentAuth.ts layer) so the app is fully testable in the Lovable
 * editor. Production deployments (shadowtalk-ai-7a513.web.app, custom domains)
 * always use real Firebase Auth.
 */

const PREVIEW_ZONES = [
  'lovableproject.com',
  'lovableproject-dev.com',
  'lovable.app',
  'gpt-eng.com',
  'gptengineer.run',
  // Local dev is also a "preview" environment for auth purposes — but only
  // treat it as preview if Firebase auth is explicitly known to be broken
  // (e.g. the user hasn't added localhost to authorized domains). We do NOT
  // include localhost here by default because `npm run dev` on localhost:8080
  // should use real Firebase Auth. Set VITE_USE_LOCAL_AUTH=1 to force it.
];

/**
 * Returns true when running on a Lovable preview surface where Firebase Auth
 * cannot be used (domain not authorized).
 */
export function isPreviewEnvironment(): boolean {
  if (typeof window === 'undefined') return false;

  // Explicit override via env var (for local testing of the preview path).
  const env = (import.meta as any).env ?? {};
  if (env.VITE_USE_LOCAL_AUTH === '1' || env.VITE_USE_LOCAL_AUTH === 'true') {
    return true;
  }

  const host = window.location.hostname;
  return PREVIEW_ZONES.some((z) => host === z || host.endsWith('.' + z));
}

/**
 * Human-readable label for the current environment, shown in the UI banner.
 */
export function getEnvironmentLabel(): string {
  if (typeof window === 'undefined') return 'Server';
  if (isPreviewEnvironment()) {
    return 'Preview (Local Auth)';
  }
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
    return 'Local Dev';
  }
  return 'Production';
}
