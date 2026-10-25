/// <reference types="vite/client" />

// Each locale's review status, from its catalogue, defined at build time (vite.config.ts).
declare const __TRANSLATION_STATUS__: Record<string, 'reviewed' | 'unreviewed'>;
