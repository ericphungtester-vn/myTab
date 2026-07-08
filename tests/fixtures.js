// Shared Playwright Test fixtures for loading the myTab extension as an unpacked Chrome extension.
// Chrome extensions can only be tested via a persistent context (`launchPersistentContext`), not
// the default `browser.newContext()` — so this file replaces the built-in `context`/`page`
// fixtures with ones backed by a real, extension-loaded Chromium instance.
const { test: base, chromium } = require('@playwright/test')
const path = require('path')
const fs = require('fs')
const os = require('os')

const EXTENSION_PATH = path.resolve(__dirname, '..', 'extension')

const test = base.extend({
  context: async ({}, use) => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mytab-test-'))
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false, // Chrome extensions do not load reliably in headless mode
      // Wide enough that the whole FlashPaint toolbar fits without collapsing into the "»"
      // overflow menu — several tests click buttons directly by id and need them on-screen
      viewport: { width: 1600, height: 900 },
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-first-run'
      ]
    })
    await use(context)
    await context.close()
    fs.rmSync(userDataDir, { recursive: true, force: true })
  },

  // A page already navigated to the extension's New Tab override, with the FlashPaint tab active
  flashpaintPage: async ({ context }, use) => {
    const page = await context.newPage()
    try {
      await page.goto('chrome://newtab/', { waitUntil: 'domcontentloaded', timeout: 10_000 })
    } catch {
      // chrome://newtab/ sometimes reports a benign navigation error even though the override
      // page has already loaded correctly — ignore and proceed
    }
    await page.waitForTimeout(500)
    await page.click('button[data-tab="flashpaint"]')
    await page.waitForTimeout(200)
    await use(page)
  }
})

module.exports = { test, expect: base.expect, EXTENSION_PATH }
