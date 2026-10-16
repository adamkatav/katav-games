/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** Injected by vite.config.ts from package.json, so the on-screen version
 *  can never drift from the release. */
declare const __APP_VERSION__: string;
/** True in the beta channel build (BETA=1), which keeps its own saves. */
declare const __APP_BETA__: boolean;
