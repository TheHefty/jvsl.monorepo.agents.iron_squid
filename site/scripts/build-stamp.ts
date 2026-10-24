import type { Plugin } from 'vite';

// Stamps every page with the commit it was built from. The deploy's smoke run waits for the live
// page to carry the commit being deployed, so a cached older build cannot pass for the new one.
export function buildStampPlugin(commit: string | undefined): Plugin {
  const stamp = commit ?? 'local';
  if (!/^[0-9A-Za-z]+$/.test(stamp)) {
    throw new Error(
      `build-stamp: "${stamp}" is not a commit SHA; set BUILD_SHA to one, or leave it unset`,
    );
  }
  return {
    name: 'iron-squid-build-stamp',
    transformIndexHtml: (html: string) =>
      html.replace('</head>', `<meta name="iron-squid-build" content="${stamp}" /></head>`),
  };
}
