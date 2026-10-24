import type { Plugin } from 'vite';

// GitHub Pages cannot set response headers, so the policy travels in the page. It allows nothing
// from any host but the site's own (NFR-D2): widening it changes the data map, and is a charter
// change (docs/RULES.md).
export const contentSecurityPolicy =
  `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; ` +
  `style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; manifest-src 'self'; ` +
  `base-uri 'self'; form-action 'none'" />`;

// Build only: the dev server injects inline scripts for hot reload, which the policy forbids. That
// is also why the acceptance tests run against the build and never against the dev server.
export function cspPlugin(): Plugin {
  return {
    name: 'iron-squid-csp',
    apply: 'build',
    transformIndexHtml: (html: string) =>
      html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />${contentSecurityPolicy}`),
  };
}
