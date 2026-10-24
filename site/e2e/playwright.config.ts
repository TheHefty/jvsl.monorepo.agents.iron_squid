import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';
import { pendingPattern, registeredFeatures } from './registered-features';
import { basePath, previewPort } from './site-under-test';

const testDir = defineBddConfig({
  features: registeredFeatures.map((f) => `features/${f}`),
  steps: ['steps/**/*.ts', 'fixtures.ts'],
  // Scenarios that only GitHub can perform, or that need the published site, run elsewhere.
  tags: 'not @manual and not @deployed',
  missingSteps: 'fail-on-gen',
  outputDir: '.features-gen',
});

export default defineConfig({
  testDir,
  forbidOnly: !!process.env.CI,
  grepInvert: pendingPattern,
  reporter: [['list'], ['json', { outputFile: 'test-results/acceptance.json' }]],
  use: { baseURL: `http://localhost:${previewPort}${basePath}` },
  projects: [
    { name: 'acceptance', use: { ...devices['Desktop Chrome'] } },
    { name: 'guard', testDir: 'guard', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `tsx scripts/pages-server.ts`,
    cwd: '..',
    url: `http://localhost:${previewPort}${basePath}`,
    reuseExistingServer: !process.env.CI,
  },
});
