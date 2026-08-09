const { test, expect } = require('@playwright/test')

test('Tree: renders an indented list as a Unicode tree, with an ASCII option', async ({ page }) => {
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="tree"]')

  await page.fill('#tr-input', 'project\n  src\n    index.js\n  README.md')
  const out = page.locator('#tr-output')
  await expect(out).toContainText('├── src')
  await expect(out).toContainText('│   └── index.js')
  await expect(out).toContainText('└── README.md')

  await page.click('#tr-style .seg-btn[data-value="ascii"]')
  await expect(out).toContainText('|-- src')
  await expect(out).toContainText('`-- README.md')
  expect(errors).toEqual([])
})

test('Tree: Copy puts the rendered tree on the clipboard; persists across reload', async ({ page }) => {
  await page.goto('/popup.html')
  await page.click('.tab-btn[data-tab="tree"]')

  await page.fill('#tr-input', 'a\n  b')
  await page.click('#tr-copy')
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('a\n└── b')

  await page.reload()
  await page.click('.tab-btn[data-tab="tree"]')
  await expect(page.locator('#tr-input')).toHaveValue('a\n  b')
})
