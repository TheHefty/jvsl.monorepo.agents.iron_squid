// The site's own origin, where it is published (FR-71, FR-72): the addresses it names to search
// engines and preview generators are absolute on it, whatever base path a build was made under.
// The deploy's Pages check and the DNS check name the same domain; site.test.ts holds them to it.
export const siteOrigin = 'https://iron-squid.top';
