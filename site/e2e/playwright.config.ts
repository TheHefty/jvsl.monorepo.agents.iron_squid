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
  // A Given or When and a Then may share their words and mean different things ("the player has 3
  // lives" sets a run up in one story and checks the page in another): match the keyword too.
  matchKeywords: true,
  outputDir: '.features-gen',
});

export default defineConfig({
  testDir,
  forbidOnly: !!process.env.CI,
  grepInvert: pendingPattern,
  reporter: [['list'], ['json', { outputFile: 'test-results/acceptance.json' }]],
  use: { baseURL: `http://localhost:${previewPort}${basePath}` },
  projects: [
    // Every scenario in both themes, so the guard's accessibility check covers each of them
    // (task visual-foundation, failure 1).
    { name: 'acceptance-dark', use: { ...devices['Desktop Chrome'], colorScheme: 'dark' } },
    { name: 'acceptance-light', use: { ...devices['Desktop Chrome'], colorScheme: 'light' } },
    { name: 'guard', testDir: 'guard', use: { ...devices['Desktop Chrome'] } },
    { name: 'screen', testDir: 'screen', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `tsx scripts/pages-server.ts`,
    cwd: '..',
    url: `http://localhost:${previewPort}${basePath}`,
    reuseExistingServer: !process.env.CI,
  },
});
