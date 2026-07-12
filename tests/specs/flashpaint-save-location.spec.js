const { test, expect } = require('../fixtures')

// window.showDirectoryPicker requires a real native OS dialog, which Playwright can't drive —
// these tests mock it with an in-memory stand-in that implements the same interface
// (name/queryPermission/requestPermission/getFileHandle/createWritable) so the app's own logic
// (IndexedDB persistence, permission checks, write-vs-fallback branching) is exercised for real.
function installFakeDirHandle(page, { name = 'MyScreenshots', permission = 'granted' } = {}) {
  return page.evaluate(({ name, permission }) => {
    const files = new Map()
    window.__writtenFiles = files
    window.__fakeDirHandle = {
      name,
      kind: 'directory',
      async queryPermission() { return permission },
      async requestPermission() { return permission },
      async getFileHandle(filename) {
        return {
          async createWritable() {
            return { async write(blob) { files.set(filename, blob) }, async close() {} }
          }
        }
      }
    }
    window.showDirectoryPicker = async () => window.__fakeDirHandle
  }, { name, permission })
}

test('defaults to "Default (Downloads)" with the reset button hidden', async ({ context }) => {
  const page = await context.newPage()
  try { await page.goto('chrome://newtab/', { waitUntil: 'domcontentloaded', timeout: 10_000 }) } catch {}
  await page.waitForTimeout(500)
  await page.click('#settings-btn')
  await page.waitForTimeout(200)

  await expect(page.locator('#fp-save-location-label')).toHaveText('Default (Downloads)')
  await expect(page.locator('#fp-save-location-reset')).toBeHidden()
})

test('Change picks a folder, updates the label, and shows the reset button', async ({ context }) => {
  const page = await context.newPage()
  try { await page.goto('chrome://newtab/', { waitUntil: 'domcontentloaded', timeout: 10_000 }) } catch {}
  await page.waitForTimeout(500)
  await installFakeDirHandle(page)

  await page.click('#settings-btn')
  await page.waitForTimeout(200)
  await page.click('#fp-save-location-change')
  await page.waitForTimeout(300)

  await expect(page.locator('#fp-save-location-label')).toHaveText('MyScreenshots')
  await expect(page.locator('#fp-save-location-reset')).toBeVisible()
})

test('a denied permission leaves the save location unchanged', async ({ context }) => {
  const page = await context.newPage()
  try { await page.goto('chrome://newtab/', { waitUntil: 'domcontentloaded', timeout: 10_000 }) } catch {}
  await page.waitForTimeout(500)
  await installFakeDirHandle(page, { permission: 'denied' })

  await page.click('#settings-btn')
  await page.waitForTimeout(200)
  await page.click('#fp-save-location-change')
  await page.waitForTimeout(300)

  await expect(page.locator('#fp-save-location-label')).toHaveText('Default (Downloads)')
  await expect(page.locator('#fp-save-location-reset')).toBeHidden()
})

test('Reset clears the chosen folder, in memory and in IndexedDB', async ({ context }) => {
  const page = await context.newPage()
  try { await page.goto('chrome://newtab/', { waitUntil: 'domcontentloaded', timeout: 10_000 }) } catch {}
  await page.waitForTimeout(500)
  await installFakeDirHandle(page)

  await page.click('#settings-btn')
  await page.waitForTimeout(200)
  await page.click('#fp-save-location-change')
  await page.waitForTimeout(300)
  await expect(page.locator('#fp-save-location-label')).toHaveText('MyScreenshots')

  await page.click('#fp-save-location-reset')
  await page.waitForTimeout(300)

  await expect(page.locator('#fp-save-location-label')).toHaveText('Default (Downloads)')
  await expect(page.locator('#fp-save-location-reset')).toBeHidden()
  expect(await page.evaluate(() => fpGetSavedDirHandle())).toBeNull()
})

test('Export PNG and Save project write straight into the chosen folder instead of downloading', async ({ flashpaintPage: page }) => {
  const errors = []
  page.on('pageerror', e => errors.push(e.message))

  await page.evaluate(() => {
    const files = new Map()
    window.__writtenFiles = files
    fpSaveDirHandle = {
      name: 'MyScreenshots',
      async queryPermission() { return 'granted' },
      async getFileHandle(filename) {
        return { async createWritable() { return { async write(b) { files.set(filename, b) }, async close() {} } } }
      }
    }
  })

  await page.click('#file-menu-btn')
  await page.waitForTimeout(300)
  await page.click('#save-project-btn')
  await page.waitForTimeout(800)

  await page.click('#file-menu-btn')
  await page.waitForTimeout(300)
  await page.click('#download-btn')
  await page.waitForTimeout(800)

  const written = await page.evaluate(() => [...window.__writtenFiles.keys()])
  expect(written.some(f => f.endsWith('.json'))).toBe(true)
  expect(written.some(f => f.endsWith('.png'))).toBe(true)
  expect(errors).toEqual([])
})

test('a save that fails mid-flight (folder permission revoked) falls back to a normal download instead of erroring', async ({ flashpaintPage: page }) => {
  const errors = []
  page.on('pageerror', e => errors.push(e.message))

  const savedTo = await page.evaluate(async () => {
    fpSaveDirHandle = {
      name: 'MyScreenshots',
      async queryPermission() { return 'denied' },
      async requestPermission() { return 'denied' },
      async getFileHandle() { throw new Error('should not be reached') }
    }
    const blob = new Blob(['x'], { type: 'text/plain' })
    const result = await fpSaveBlob(blob, 'test.txt')
    return result.savedTo
  })

  expect(savedTo).toBeNull()
  expect(errors).toEqual([])
})
