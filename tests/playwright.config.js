// @ts-check
const { defineConfig } = require('@playwright/test')

module.exports = defineConfig({
  testDir: './specs',
  timeout: 30_000,
  fullyParallel: false, // each test launches its own Chrome profile with the extension loaded;
  // running them concurrently is fine resource-wise, but keeping it serial makes failures easier
  // to read in the terminal. Flip to true once the suite is large enough to need the speedup.
  retries: 0,
  reporter: [['list']],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  }
})
