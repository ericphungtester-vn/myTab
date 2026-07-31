const { test, expect } = require('@playwright/test')

test.beforeEach(async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="compare"]')
})

test('side-by-side diff: highlights the changed word and downloads a report', async ({ page }) => {
  await page.fill('#cp-a', 'the quick brown fox\nsecond line')
  await page.fill('#cp-b', 'the slow brown fox\nsecond line')
  await page.click('#cp-compare')

  await expect(page.locator('#cp-output')).toBeVisible()
  // one changed line (mod row) + one equal line
  await expect(page.locator('.cp-diff tr.cp-mod')).toHaveCount(1)
  await expect(page.locator('.cp-diff tr.cp-equal')).toHaveCount(1)
  await expect(page.locator('.cp-w-del').first()).toHaveText('quick')
  await expect(page.locator('.cp-w-ins').first()).toHaveText('slow')
  await expect(page.locator('#cp-stats')).toContainText('similar')

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#cp-download')
  ])
  expect(download.suggestedFilename()).toBe('text-comparison.html')
})

test('added and removed lines render on the correct side', async ({ page }) => {
  await page.fill('#cp-a', 'keep\nremove-me')
  await page.fill('#cp-b', 'keep\nadd-me\nand-me')
  await page.click('#cp-compare')
  // "remove-me" vs "add-me" pairs into a mod row; "and-me" is a pure insertion
  await expect(page.locator('.cp-diff tr.cp-ins')).toHaveCount(1)
  await expect(page.locator('#cp-stats')).toContainText('added')
})

test('empty inputs show an error, not a crash', async ({ page }) => {
  await page.click('#cp-compare')
  await expect(page.locator('#cp-error')).toBeVisible()
  await expect(page.locator('#cp-output')).toBeHidden()
})

test('reset clears the boxes and the rendered diff', async ({ page }) => {
  await page.fill('#cp-a', 'a')
  await page.fill('#cp-b', 'b')
  await page.check('#cp-ignore-case')
  await page.click('#cp-compare')
  await expect(page.locator('#cp-output')).toBeVisible()

  await page.click('#cp-reset-btn')
  await expect(page.locator('#cp-a')).toHaveValue('')
  await expect(page.locator('#cp-b')).toHaveValue('')
  await expect(page.locator('#cp-ignore-case')).not.toBeChecked()
  await expect(page.locator('#cp-output')).toBeHidden()
})
