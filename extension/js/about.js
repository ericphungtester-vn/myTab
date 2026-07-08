const COLOR_GROUPS = [
  {
    group: 'Brand',
    colors: [{ name: 'Primary', hex: '#2563EB', usage: 'Primary buttons, active states, links' }]
  },
  {
    group: 'Layout',
    colors: [
      { name: 'Sidebar', hex: '#334155', usage: 'Sidebar background' },
      { name: 'Background', hex: '#F9FAFB', usage: 'Page background' },
      { name: 'Surface', hex: '#FFFFFF', usage: 'Cards, panels' },
      { name: 'Border', hex: '#E5E7EB', usage: 'Dividers, input borders' },
    ]
  },
  {
    group: 'Text',
    colors: [
      { name: 'Primary', hex: '#111827', usage: 'Headings, primary text' },
      { name: 'Secondary', hex: '#6B7280', usage: 'Labels, secondary text' },
      { name: 'Muted', hex: '#D1D5DB', usage: 'Placeholder, empty states' },
    ]
  },
  {
    group: 'Status',
    colors: [
      { name: 'Success', hex: '#22C55E', usage: 'Pass status' },
      { name: 'Danger', hex: '#EF4444', usage: 'Fail status, delete actions' },
      { name: 'Warning', hex: '#F59E0B', usage: 'Pending status' },
    ]
  }
]

const TYPOGRAPHY = [
  { label: 'Page Title',    style: 'font-size:20px;font-weight:700;color:#111827', sample: 'Page Title', size: '20px · Bold' },
  { label: 'Section Title', style: 'font-size:14px;font-weight:700;color:#111827', sample: 'Section Title', size: '14px · Bold' },
  { label: 'Card Title',    style: 'font-size:12px;font-weight:600;color:#374151', sample: 'Card Title', size: '12px · Semibold' },
  { label: 'Body',          style: 'font-size:12px;color:#374151', sample: 'Regular body text for content areas', size: '12px · Regular' },
  { label: 'Label',         style: 'font-size:10px;font-weight:500;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em', sample: 'FIELD LABEL', size: '10px · Medium · Uppercase' },
  { label: 'Caption',       style: 'font-size:10px;color:#9CA3AF', sample: 'Caption or metadata text', size: '10px · Regular' },
]

const BUTTONS = [
  { label: 'Primary',   style: 'background:#2563EB;color:white',   desc: 'Main actions: Save, Create, Upload' },
  { label: 'Secondary', style: 'background:#F3F4F6;color:#374151', desc: 'Supporting actions: Cancel, Edit' },
  { label: 'Danger',    style: 'background:#FEF2F2;color:#DC2626', desc: 'Destructive actions: Delete' },
  { label: 'Ghost',     style: 'background:transparent;color:#9CA3AF', desc: 'Icon-only or inline actions' },
]

function e(str) {
  const d = document.createElement('div')
  d.textContent = str
  return d.innerHTML
}

document.getElementById('about-content').innerHTML = `
  <h1 style="font-size:20px;font-weight:700;color:#111827;margin-bottom:4px">About App</h1>
  <p style="font-size:12px;color:#9CA3AF;margin-bottom:40px">Design system reference</p>

  <div class="about-section">
    <h2 class="about-section-title">Color Palette</h2>
    ${COLOR_GROUPS.map(g => `
      <p class="color-group-label">${e(g.group)}</p>
      <div class="color-grid">
        ${g.colors.map(c => `
          <div class="color-item">
            <div class="color-swatch" style="background:${c.hex}"></div>
            <div>
              <div class="color-name">${e(c.name)}</div>
              <div class="color-hex">${e(c.hex)}</div>
              <div class="color-usage">${e(c.usage)}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `).join('')}
  </div>

  <div class="about-section">
    <h2 class="about-section-title">Typography</h2>
    <div class="about-card">
      ${TYPOGRAPHY.map(t => `
        <div class="typo-row">
          <span class="typo-label-col">${e(t.label)}</span>
          <span class="typo-sample" style="${t.style}">${e(t.sample)}</span>
          <span class="typo-size">${e(t.size)}</span>
        </div>
      `).join('')}
    </div>
    <p style="font-size:10px;color:#9CA3AF;margin-top:8px">Font: system-ui, -apple-system, Segoe UI, sans-serif</p>
  </div>

  <div class="about-section">
    <h2 class="about-section-title">Buttons</h2>
    <div class="buttons-grid">
      ${BUTTONS.map(b => `
        <div class="button-item">
          <button class="btn-demo" style="${b.style}">${e(b.label)}</button>
          <p>${e(b.desc)}</p>
        </div>
      `).join('')}
    </div>
    <p style="font-size:10px;color:#9CA3AF;margin-top:8px">Border radius: 8px · Padding: 7px 16px · Font: 12px</p>
  </div>

  <div class="about-section">
    <h2 class="about-section-title">Badges</h2>
    <div class="about-card badges-container">
      <p class="badges-label">Status</p>
      <div class="badge-row">
        <span class="badge" style="background:#DCFCE7;color:#15803D">Pass</span>
        <span class="badge" style="background:#FEE2E2;color:#B91C1C">Fail</span>
        <span class="badge" style="background:#FEF3C7;color:#B45309">Pending</span>
      </div>
      <p class="badges-label">Priority</p>
      <div class="badge-row">
        <span class="badge-priority" style="background:#FEF2F2;color:#DC2626;border-color:#FECACA">High</span>
        <span class="badge-priority" style="background:#FFFBEB;color:#B45309;border-color:#FDE68A">Medium</span>
        <span class="badge-priority" style="background:#F9FAFB;color:#6B7280;border-color:#E5E7EB">Low</span>
      </div>
    </div>
  </div>

  <div class="about-section">
    <h2 class="about-section-title">Fields</h2>
    <div class="about-card">
      <div class="fields-container">
        <div>
          <p class="field-group-label">Text Input</p>
          <input class="field-demo-input" placeholder="Placeholder text..." readonly>
          <p class="field-classes">border · rounded-lg · px-3 py-2 · focus:ring-blue-300</p>
        </div>
        <div>
          <p class="field-group-label">Textarea</p>
          <textarea class="field-demo-textarea" rows="3" placeholder="Enter content..." readonly></textarea>
          <p class="field-classes">border · rounded-xl · p-4 · resize-none</p>
        </div>
        <div>
          <p class="field-group-label">Select</p>
          <select class="field-demo-select">
            <option>Option 1</option>
            <option>Option 2</option>
          </select>
          <p class="field-classes">border · rounded-lg · px-3 py-2</p>
        </div>
        <div>
          <p class="field-group-label">Error State</p>
          <input class="field-demo-error" placeholder="Document title..." readonly>
          <p class="field-error-msg">Title is required</p>
          <p class="field-classes">border-b-2 border-red-400 · error: text-red-500</p>
        </div>
      </div>
    </div>
  </div>
`
