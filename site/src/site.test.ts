import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { siteOrigin } from './site';

describe('the site origin', () => {
  it('is the domain the deploy and the DNS check expect (page-meta, failure 2)', () => {
    const domain = new URL(siteOrigin).host;
    expect(siteOrigin).toBe(`https://${domain}`);
    expect(readFileSync('../.github/workflows/deploy.yml', 'utf8')).toContain(`"${domain} true"`);
    expect(readFileSync('scripts/check-dns.sh', 'utf8')).toContain(`domain=\${DOMAIN:-${domain}}`);
  });
});
