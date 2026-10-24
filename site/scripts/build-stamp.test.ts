import { describe, expect, it } from 'vitest';
import { buildStampPlugin } from './build-stamp';

const transform = (plugin: ReturnType<typeof buildStampPlugin>, html: string) =>
  (plugin.transformIndexHtml as (h: string) => string)(html);

// The deploy's smoke run compares this stamp on the live page with the commit it deployed, so a
// stale cache never passes for the new version (task pages-deploy, failure 2).
describe('buildStampPlugin', () => {
  it('stamps the page with the commit it was built from', () => {
    expect(transform(buildStampPlugin('abc123'), '<head><title>t</title></head>')).toBe(
      '<head><title>t</title><meta name="iron-squid-build" content="abc123" /></head>',
    );
  });

  it('stamps "local" when no commit is given, so a local build never matches a deployed one', () => {
    expect(transform(buildStampPlugin(undefined), '<head></head>')).toBe(
      '<head><meta name="iron-squid-build" content="local" /></head>',
    );
  });

  it('refuses a stamp that is not a commit-like token', () => {
    expect(() => buildStampPlugin('"><script>')).toThrow(/not a commit/);
  });
});
