const { test } = require('node:test')
const assert = require('node:assert')
const { loadToolScript } = require('./helpers/loadScript')

const rp = loadToolScript('js/responsive-tool.js')

test('RP_DEVICES entries are complete with positive dimensions', () => {
  assert.ok(rp.RP_DEVICES.length >= 10)
  for (const d of rp.RP_DEVICES) {
    assert.ok(d.name && d.type, 'name/type present')
    assert.ok(Number.isInteger(d.w) && d.w > 0, d.name + ' width')
    assert.ok(Number.isInteger(d.h) && d.h > 0, d.name + ' height')
  }
  // spot-check a couple of well-known viewports
  const se = rp.RP_DEVICES.find(d => d.name === 'iPhone SE')
  assert.equal(se.w, 375); assert.equal(se.h, 667)
  const ipad = rp.RP_DEVICES.find(d => d.name === 'iPad Mini')
  assert.equal(ipad.w, 768); assert.equal(ipad.h, 1024)
})

test('rp_dims formats width × height', () => {
  assert.equal(rp.rp_dims({ w: 375, h: 667 }), '375 × 667')
})

test('RP_BREAKPOINTS list Tailwind + Bootstrap with ascending px', () => {
  const names = rp.RP_BREAKPOINTS.map(f => f.framework)
  assert.ok(names.includes('Tailwind CSS') && names.includes('Bootstrap 5'))
  for (const f of rp.RP_BREAKPOINTS) {
    const px = f.items.map(i => i[1])
    for (let i = 1; i < px.length; i++) assert.ok(px[i] > px[i - 1], f.framework + ' ascending')
  }
  const tw = rp.RP_BREAKPOINTS.find(f => f.framework === 'Tailwind CSS')
  assert.deepEqual(tw.items.map(i => i[1]), [640, 768, 1024, 1280, 1536])
})
