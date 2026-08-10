import type {NextConfig} from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const nextConfig: NextConfig = {
  poweredByHeader: false,

  /**
   * Cache Components: `use cache`, `cacheLife` and `cacheTag`.
   *
   * Enabling it makes the build assert that every route can produce a static
   * shell. Ours cannot, and deliberately: the theme is resolved from a cookie
   * on the server so a page never paints the wrong one first. The root layout
   * therefore carries `instant = false`, which is the documented way to say
   * "this tree blocks, on purpose".
   *
   * What we take from it is data-level caching — see src/lib/challenge.server.ts.
   */
  cacheComponents: true
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
