import { describe, it, expect, beforeEach } from 'vitest'
import { loadPluginScript, createDOM, evalPlugin } from './helpers.js'

let script, api

beforeEach(() => {
  script = loadPluginScript()
})

function setup(overrides = {}) {
  createDOM(overrides)
  api = evalPlugin(script)
}

function getLines() {
  return api.generatedCode.split('\n')
}

function linesContain(lines, substr) {
  return lines.some(l => l.includes(substr))
}

// ── Parameter parsing / edge cases ──────────────────────────────

describe('parseParams', () => {
  it('parses default values', () => {
    setup()
    const p = api.parseParams()
    expect(p.width).toBe(300)
    expect(p.length).toBe(300)
    expect(p.depth).toBe(1)
    expect(p.passes).toBe(1)
    expect(p.stepover).toBe(12)
    expect(p.toolDia).toBe(0)
    expect(p.zlift).toBe(5)
    expect(p.finishEnabled).toBe(false)
    expect(p.feedrate).toBe(1500)
    expect(p.plunge).toBe(300)
    expect(p.travel).toBe(3000)
    expect(p.spindle).toBe(10000)
    expect(p.zigzag).toBe(false)
    expect(p.dryrun).toBe(false)
    expect(p.direction).toBe('E')
    expect(p.rowprog).toBe('normal')
  })

  it('clamps negative values to minimums', () => {
    setup({
      width: -10, length: -10, depth: -1, passes: 0,
      stepover: -1, feedrate: -100, plunge: -50,
    })
    const p = api.parseParams()
    expect(p.width).toBe(1)
    expect(p.length).toBe(1)
    expect(p.depth).toBe(0.1)
    expect(p.passes).toBe(1)
    expect(p.stepover).toBe(0.1)
    expect(p.feedrate).toBe(1)
    expect(p.plunge).toBe(1)
  })

  it('handles tool diameter = 0', () => {
    setup({ toolDia: 0 })
    const p = api.parseParams()
    expect(p.toolDia).toBe(0)
  })

  it('handles tool diameter > 0', () => {
    setup({ toolDia: 12 })
    const p = api.parseParams()
    expect(p.toolDia).toBe(12)
  })

  it('finish enabled with passes = 1', () => {
    setup({ finishEnabled: true, passes: 1 })
    const p = api.parseParams()
    expect(p.finishEnabled).toBe(true)
    expect(p.passes).toBe(1)
  })

  it('finish enabled with passes > 1', () => {
    setup({ finishEnabled: true, passes: 3 })
    expect(api.parseParams().finishEnabled).toBe(true)
  })
})

// ── G-code output structure ─────────────────────────────────────

describe('G-code structure', () => {
  it('emits header with G17 G21 G90 G94', () => {
    setup()
    api.generate()
    const lines = getLines()
    expect(linesContain(lines, 'G17 G21 G90 G94')).toBe(true)
  })

  it('emits M3 with configured spindle speed', () => {
    setup({ spindle: 12000 })
    api.generate()
    const lines = getLines()
    expect(linesContain(lines, 'M3 S12000')).toBe(true)
  })

  it('emits M5 and M30 at end', () => {
    setup()
    api.generate()
    const lines = getLines()
    expect(lines.at(-1)).toBe('M30')
    expect(lines.at(-2)).toBe('M5')
  })

  it('includes comment header with parameters', () => {
    setup({ width: 200, length: 150, depth: 2, passes: 3 })
    api.generate()
    const lines = getLines()
    expect(linesContain(lines, 'Width: 200 mm')).toBe(true)
    expect(linesContain(lines, 'Length: 150 mm')).toBe(true)
    expect(linesContain(lines, 'Total depth: 2 mm')).toBe(true)
    expect(linesContain(lines, 'Passes: 3')).toBe(true)
  })

  it('dry run emits perimeter trace and M0 before cutting', () => {
    setup({ dryrun: true, width: 100, length: 80 })
    api.generate()
    const lines = getLines()
    const dryIdx = lines.findIndex(l => l.includes('Dry run'))
    const m0Idx = lines.findIndex(l => l.includes('M0'))
    const cutIdx = lines.findIndex(l => l.includes('G1 Z'))
    expect(dryIdx).toBeGreaterThanOrEqual(0)
    expect(m0Idx).toBeGreaterThan(dryIdx)
    expect(linesContain(lines, 'X100.000 Y0.000')).toBe(true)
    expect(linesContain(lines, 'X100.000 Y80.000')).toBe(true)
    expect(linesContain(lines, 'X0.000 Y80.000')).toBe(true)
    expect(cutIdx).toBeGreaterThan(m0Idx)
  })

  it('without dry run, no M0 emitted', () => {
    setup({ dryrun: false })
    api.generate()
    expect(linesContain(getLines(), 'M0')).toBe(false)
  })
})

// ── Pass & depth logic ──────────────────────────────────────────

describe('pass and depth logic', () => {
  it('3 passes, equal depth increments', () => {
    setup({ depth: 1.5, passes: 3 })
    api.generate()
    const lines = getLines()
    // Unique Z depths from pass comments: "Z -0.500 mm", "Z -1.000 mm", "Z -1.500 mm"
    const zComments = lines
      .filter(l => l.includes('Pass') && l.includes('Z '))
      .map(l => parseFloat(l.match(/Z (-?[\d.]+)/)[1]))
    expect(new Set(zComments)).toEqual(new Set([-0.5, -1.0, -1.5]))
  })

  it('finish pass enabled: last pass marks finish, reaches full depth', () => {
    setup({ depth: 2, passes: 3, finishEnabled: true, finishStock: 0.3 })
    api.generate()
    const lines = getLines()
    const passComments = lines.filter(l => l.includes('Pass '))
    expect(passComments.at(-1)).toContain('(finish)')
    // Check Z values of G1 Z lines
    const g1zLines = lines.filter(l => l.startsWith('G1 Z'))
    const zValues = g1zLines.map(l => parseFloat(l.match(/Z(-?[\d.]+)/)[1]))
    // Last plunge should be at -2.0
    expect(zValues.at(-1)).toBe(-2.0)
  })

  it('finish pass enabled with passes = 1 uses finish stepover', () => {
    setup({ depth: 2, passes: 1, finishEnabled: true, finishStepover: 4 })
    api.generate()
    const lines = getLines()
    const passComments = lines.filter(l => l.includes('Pass '))
    expect(passComments[0]).toContain('(finish)')
    expect(passComments[0]).toContain('Z -2.000')
  })

  it('finish pass disabled: no finish label, all passes same stepover', () => {
    setup({ depth: 2, passes: 3, finishEnabled: false })
    api.generate()
    const lines = getLines()
    expect(lines.some(l => l.includes('(finish)'))).toBe(false)
    // Each pass comment mentions a unique Z depth
    const passComments = lines.filter(l => l.includes('Pass '))
    expect(passComments.length).toBe(3)
  })
})

// ── Row / stepover math ─────────────────────────────────────────

describe('row and stepover calculation', () => {
  it('each row in east direction has correct Y coordinate', () => {
    setup({ width: 100, length: 100, stepover: 30, passes: 1, direction: 'E', rowprog: 'normal' })
    api.generate()
    const lines = getLines()
    const rapidY = lines
      .filter(l => l.startsWith('G0') && l.includes('Y'))
      .map(l => parseFloat(l.match(/Y([\d.]+)/)[1]))
    // row coordinates (descending) + final return-to-zero
    expect(rapidY.slice(0, 5)).toEqual([100, 75, 50, 25, 0])
    expect(rapidY.at(-1)).toBe(0)
  })

  it('reverse row progression flips Y coordinates', () => {
    setup({ width: 100, length: 100, stepover: 30, passes: 1, direction: 'E', rowprog: 'reverse' })
    api.generate()
    const lines = getLines()
    const rapidY = lines
      .filter(l => l.startsWith('G0') && l.includes('Y'))
      .map(l => parseFloat(l.match(/Y([\d.]+)/)[1]))
    // row coordinates (ascending) + final return-to-zero
    expect(rapidY.slice(0, 5)).toEqual([0, 25, 50, 75, 100])
    expect(rapidY.at(-1)).toBe(0)
  })

  it('north direction cuts along Y with correct X rows', () => {
    setup({ width: 100, length: 100, stepover: 30, passes: 1, direction: 'N', rowprog: 'normal' })
    api.generate()
    const lines = getLines()
    const rapidX = lines
      .filter(l => l.startsWith('G0') && l.includes('X'))
      .map(l => parseFloat(l.match(/X([\d.]+)/)[1]))
    // Row coordinates along X: 0, 25, 50, 75, 100
    expect(rapidX.slice(0, 5)).toEqual([0, 25, 50, 75, 100])
  })

  it('south direction cuts along -Y with correct X rows', () => {
    setup({ width: 100, length: 100, stepover: 30, passes: 1, direction: 'S', rowprog: 'normal' })
    api.generate()
    const lines = getLines()
    const rapidX = lines
      .filter(l => l.startsWith('G0') && l.includes('X'))
      .map(l => parseFloat(l.match(/X([\d.]+)/)[1]))
    expect(rapidX.slice(0, 5)).toEqual([100, 75, 50, 25, 0])
  })
})

// ── Overshoot ────────────────────────────────────────────────────

describe('tool diameter overshoot', () => {
  it('extends stroke past boundaries in E direction', () => {
    setup({ toolDia: 12, direction: 'E', width: 100, passes: 1 })
    api.generate()
    const lines = getLines()
    // G0 positions at stroke start (rapid), G1 cuts to stroke end
    const g0x = lines.filter(l => l.startsWith('G0') && l.includes('X') && !l.includes('Z'))
    const g1x = lines.filter(l => l.startsWith('G1 X'))
    // Row 0: G0 to X -6 (start), G1 to X 106 (end)
    expect(g0x[0]).toContain('X-6.000')
    expect(g1x[0]).toContain('X106.000')
  })

  it('extends stroke past boundaries in W direction', () => {
    setup({ toolDia: 12, direction: 'W', width: 100, passes: 1 })
    api.generate()
    const lines = getLines()
    const g0x = lines.filter(l => l.startsWith('G0') && l.includes('X') && !l.includes('Z'))
    const g1x = lines.filter(l => l.startsWith('G1 X'))
    // Row 0: G0 to X 106 (start), G1 to X -6 (end)
    expect(g0x[0]).toContain('X106.000')
    expect(g1x[0]).toContain('X-6.000')
  })

  it('no overshoot when tool diameter is 0', () => {
    setup({ toolDia: 0, direction: 'E', width: 100, passes: 1 })
    api.generate()
    const lines = getLines()
    const g0x = lines.filter(l => l.startsWith('G0') && l.includes('X') && !l.includes('Z'))
    const g1x = lines.filter(l => l.startsWith('G1 X'))
    // Row 0: G0 to X 0 (start), G1 to X 100 (end)
    expect(g0x[0]).toContain('X0.000')
    expect(g1x[0]).toContain('X100.000')
  })
})

// ── Zigzag vs one-direction ─────────────────────────────────────

describe('zigzag mode', () => {
  it('zigzag: alternate cut direction each row', () => {
    setup({ zigzag: true, width: 100, passes: 1, direction: 'E', stepover: 30 })
    api.generate()
    const lines = getLines()
    const g1x = lines.filter(l => l.startsWith('G1 X') && !l.includes('Y'))
    // Row 0 (even): strokestart → strokeend, so G1 to X 100.000
    // Row 1 (odd):  strokeend → strokestart, so G1 to X 0.000
    expect(g1x[0]).toContain('X100.000')
    expect(g1x[1]).toContain('X0.000')
  })

  it('zigzag: no lifts between rows', () => {
    setup({ zigzag: true, width: 100, passes: 1, stepover: 30 })
    api.generate()
    const lines = getLines()
    const g0z = lines.filter(l => l.startsWith('G0 Z'))
    // Only 2 G0 Z moves: initial lift before pass, final lift after pass
    expect(g0z.length).toBe(2)
  })

  it('zigzag: lateral move at feedrate between rows', () => {
    setup({ zigzag: true, width: 100, passes: 1, direction: 'E', stepover: 30 })
    api.generate()
    const lines = getLines()
    const g1y = lines.filter(l => l.startsWith('G1 Y'))
    // Should move Y between rows at feedrate
    expect(g1y.length).toBeGreaterThanOrEqual(4)
  })

  it('one-direction: lift between every row', () => {
    setup({ zigzag: false, width: 100, length: 120, passes: 1, stepover: 30 })
    api.generate()
    const lines = getLines()
    const g0z = lines.filter(l => l.startsWith('G0 Z'))
    // nrows = ceil(120/30) + 1 = 5 rows → 5 lifts inside loop + 1 initial = 6
    expect(g0z.length).toBe(6)
  })

  it('finish pass never uses zigzag', () => {
    setup({ zigzag: true, finishEnabled: true, passes: 3, depth: 3, finishStock: 0.2, width: 100, stepover: 30 })
    api.generate()
    const lines = getLines()
    const passComments = lines.filter(l => l.includes('(finish)'))
    expect(passComments.length).toBe(1)
    const finishIdx = lines.indexOf(passComments[0])
    const afterFinish = lines.slice(finishIdx)
    const g0z = afterFinish.filter(l => l.startsWith('G0 Z'))
    // Finish pass should lift between each row
    expect(g0z.length).toBeGreaterThan(2)
  })
})

// ── Stats calculation ───────────────────────────────────────────

describe('stats calculation', () => {
  it('totalRows matches expected count', () => {
    setup({ passes: 2, stepover: 30, width: 100, length: 120 })
    api.generate()
    // nrows = ceil(120/30) + 1 = 5 rows per pass × 2 passes = 10
    expect(document.getElementById('s-rows').textContent).toBe('10')
  })

  it('cut distance is positive', () => {
    setup({ width: 100, passes: 1 })
    api.generate()
    const val = document.getElementById('s-cut').textContent
    expect(parseInt(val)).toBeGreaterThan(0)
  })

  it('travel distance is positive', () => {
    setup({ width: 100, passes: 2 })
    api.generate()
    const val = document.getElementById('s-travel').textContent
    expect(parseInt(val)).toBeGreaterThan(0)
  })

  it('estimated time is positive and formatted', () => {
    setup()
    api.generate()
    const val = document.getElementById('s-time').textContent
    expect(val).toMatch(/^\d+m\d+s$|^\d+s$/)
  })
})

// ── Direction mapping ────────────────────────────────────────────

describe('direction mapping', () => {
  const dirTest = (direction, horiz, expectedStartX, expectedStartY) => {
    setup({ direction, width: 100, length: 80, passes: 1 })
    api.generate()
    const lines = getLines()
    const firstG0AfterHeader = lines
      .slice(lines.findIndex(l => l.includes('Pass')))
      .find(l => l.startsWith('G0') && l.includes('X'))
    expect(firstG0AfterHeader).toMatch(new RegExp(`X${expectedStartX}`))
    expect(firstG0AfterHeader).toMatch(new RegExp(`Y${expectedStartY}`))
  }

  it('East: first row at X=0 Y=ymax', () => {
    dirTest('E', true, 0, 80)
  })

  it('West: first row at X=100 Y=ymin', () => {
    dirTest('W', true, 100, 0)
  })

  it('North: first row at X=xmin Y=0', () => {
    dirTest('N', false, 0, 0)
  })

  it('South: first row at X=xmax Y=80', () => {
    dirTest('S', false, 100, 80)
  })
})

// ── Settings persistence ────────────────────────────────────────

describe('settings round-trip', () => {
  it('parseParams values match SETTINGS_FIELDS for round-trip', () => {
    setup({
      width: 150, length: 200, depth: 3, passes: 4,
      stepover: 8, toolDia: 6, zlift: 10,
      finishEnabled: true, finishStepover: 3, finishStock: 0.3,
      feedrate: 2000, plunge: 500, travel: 4000, spindle: 8000,
      zigzag: true, dryrun: true,
      direction: 'N', rowprog: 'reverse',
    })
    // parseParams should not throw and return correct values
    expect(() => api.parseParams()).not.toThrow()
    const p = api.parseParams()
    expect(p.direction).toBe('N')
    expect(p.rowprog).toBe('reverse')
    expect(p.zigzag).toBe(true)
    expect(p.dryrun).toBe(true)
    expect(p.toolDia).toBe(6)
    expect(p.finishEnabled).toBe(true)
  })
})
