import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pluginDir = resolve(__dirname, '..', 'plugins', 'surfacing')

export function loadPluginScript() {
  const html = readFileSync(resolve(pluginDir, 'index.html'), 'utf-8')
  const match = html.match(/<script>([\s\S]*?)<\/script>/)
  if (!match) throw new Error('No script tag found in index.html')
  return match[1]
}

const INPUT_DEFAULTS = {
  width: 300,
  length: 300,
  depth: 1,
  passes: 1,
  stepover: 12,
  toolDia: 0,
  zlift: 5,
  finishEnabled: false,
  finishStepover: 6,
  finishStock: 0.2,
  feedrate: 1500,
  plunge: 300,
  travel: 3000,
  spindle: 10000,
  zigzag: false,
  dryrun: false,
  direction: 'E',
  rowprog: 'normal',
}

const BOOL_IDS = new Set(['finishEnabled', 'zigzag', 'dryrun'])
const SELECT_IDS = new Set(['direction', 'rowprog'])
const STAT_IDS = ['s-passes', 's-rows', 's-cut', 's-travel', 's-time']

export function createDOM(overrides = {}) {
  document.body.innerHTML = ''
  const values = { ...INPUT_DEFAULTS, ...overrides }

  // Create input/select/checkbox elements
  for (const [id, val] of Object.entries(values)) {
    let el
    if (SELECT_IDS.has(id)) {
      el = document.createElement('select')
      el.id = id
      // Add option children so .value works
      const opts = id === 'direction'
        ? ['E', 'W', 'N', 'S']
        : ['normal', 'reverse']
      for (const o of opts) {
        const opt = document.createElement('option')
        opt.value = o
        opt.textContent = o
        el.appendChild(opt)
      }
    } else if (BOOL_IDS.has(id)) {
      el = document.createElement('input')
      el.type = 'checkbox'
      el.id = id
    } else {
      el = document.createElement('input')
      el.type = 'number'
      el.id = id
    }
    document.body.appendChild(el)
    if (typeof val === 'boolean') {
      el.checked = val
    } else {
      el.value = String(val)
    }
  }

  // Create the textarea for G-code output (s-passes etc are already there)
  const ta = document.createElement('textarea')
  ta.id = 'gcode-output'
  ta.readOnly = true
  document.body.appendChild(ta)

  // Create stats display elements
  for (const id of STAT_IDS) {
    const el = document.createElement('span')
    el.id = id
    document.body.appendChild(el)
  }

  // Create status display element
  const status = document.createElement('span')
  status.id = 'status'
  document.body.appendChild(status)

  // Create save/send buttons (needed by generate to disable them)
  for (const id of ['save-btn', 'send-btn']) {
    const btn = document.createElement('button')
    btn.id = id
    btn.disabled = true
    document.body.appendChild(btn)
  }
}

export function evalPlugin(scriptStr) {
  const fn = new Function(
    'call',
    scriptStr +
    '\nreturn {' +
    '  fmt, setStatus, parseParams, generate,' +
    '  saveGCode, sendGCode, loadSettings, saveSettings, formatTime,' +
    '  get generatedCode() { return generatedCode },' +
    '  get settingsLoaded() { return settingsLoaded },' +
    '  msgId, pending' +
    '};'
  )
  const callStub = () => new Promise(() => {})
  return fn(callStub)
}
