// The smoke run after a deployment: only the @deployed scenarios, against the published site, still
// under the guard that every scenario runs under.
import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';
import { registeredFeatures } from './registered-features';

const siteUrl = process.env.SITE_URL;
if (!siteUrl) throw new Error('deployed: set SITE_URL to the published site, ending in "/"');

const testDir = defineBddConfig({
  features: registeredFeatures.map((f) => `features/${f}`),
  steps: ['steps/**/*.ts', 'fixtures.ts'],
  tags: '@deployed',
  missingSteps: 'fail-on-gen',
  outputDir: '.features-gen-deployed',
});

export default defineConfig({
  testDir,
  forbidOnly: !!process.env.CI,
  // A publication takes minutes to show; the waiting step polls for up to DEPLOY_WAIT_SECONDS.
  timeout: (Number(process.env.DEPLOY_WAIT_SECONDS ?? 600) + 60) * 1000,
  reporter: [['list'], ['json', { outputFile: 'test-results/deployed.json' }]],
  use: { baseURL: siteUrl },
  projects: [{ name: 'deployed', use: { ...devices['Desktop Chrome'] } }],
});
