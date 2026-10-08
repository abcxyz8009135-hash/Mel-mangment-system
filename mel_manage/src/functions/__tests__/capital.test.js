import { describe, expect, it } from 'vitest'
import { capitalRows, capitalTotals } from '../capital'

const sims = [
  { id: 2, name: 'Phone B', active: true, balance: '300' },
  { id: 1, name: 'Phone A', active: true, balance: 100 },
  { id: 3, name: 'Old', active: false, balance: 0 },
  { id: 4, name: 'Old with money', active: false, balance: 50 },
]

describe('capitalRows', () => {
  it('lists SIMs by name, then Reddy, hiding empty inactive SIMs', () => {
    const rows = capitalRows(sims, { reddy: 1000, sims: { 1: 80, 2: 250 } }, 1200)
    expect(rows.map((r) => r.label)).toEqual(['Old with money', 'Phone A', 'Phone B', 'Reddy'])
    expect(rows.find((r) => r.label === 'Phone B')).toMatchObject({ start: 250, current: 300 })
    expect(rows.at(-1)).toMatchObject({ key: 'reddy', start: 1000, current: 1200 })
  })

  it('treats a missing starting point as zero', () => {
    const rows = capitalRows(sims.slice(0, 1), {}, undefined)
    expect(rows).toEqual([
      { key: 'sim-2', label: 'Phone B', active: true, start: 0, current: 300 },
      { key: 'reddy', label: 'Reddy', start: 0, current: 0 },
    ])
  })
})

describe('capitalTotals', () => {
  it('sums start and current and gives the net change', () => {
    expect(capitalTotals([{ start: 100, current: 150 }, { start: 50, current: 20 }]))
      .toEqual({ start: 150, current: 170, net: 20 })
  })
})
