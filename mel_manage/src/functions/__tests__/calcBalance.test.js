import { describe, expect, it } from 'vitest'
import { calcSession, parseComplaints, MATCH_TOLERANCE } from '../calcBalance'

const values = (tele, reddy, deposit, withdrawal) => ({ tele, reddy, deposit, withdrawal })

describe('parseComplaints', () => {
  it('reads comma-separated amounts and skips blanks', () => {
    expect(parseComplaints('200, 150,, 75 ')).toEqual({ values: [200, 150, 75], error: null })
  })

  it('treats empty input as no complaints', () => {
    expect(parseComplaints('')).toEqual({ values: [], error: null })
    expect(parseComplaints(undefined)).toEqual({ values: [], error: null })
  })

  it.each(['abc', '0', '-5', '10, x'])('rejects %j', (text) => {
    const result = parseComplaints(text)
    expect(result.values).toEqual([])
    expect(result.error).toMatch(/not a valid complaint amount/)
  })
})

describe('calcSession', () => {
  it('matches when profit equals commission', () => {
    // 1000 deposit -> 30 commission; 500 withdrawal -> 10 commission.
    const r = calcSession(values(5000, 5000, 0, 0), values(5040, 5000, 1000, 500))
    expect(r.depositCommission).toBeCloseTo(30)
    expect(r.withdrawalCommission).toBeCloseTo(10)
    expect(r.difference).toBeCloseTo(0)
    expect(r.status).toBe('Match')
  })

  it('uses the tolerance as an inclusive Match band', () => {
    const at = calcSession(values(0, 0, 0, 0), values(MATCH_TOLERANCE, 0, 0, 0))
    const over = calcSession(values(0, 0, 0, 0), values(MATCH_TOLERANCE + 1, 0, 0, 0))
    const short = calcSession(values(0, 0, 0, 0), values(-MATCH_TOLERANCE - 1, 0, 0, 0))
    expect(at.status).toBe('Match')
    expect(over.status).toBe('Over')
    expect(short.status).toBe('Short')
  })

  it('adds complaints to the difference before deciding the adjusted status', () => {
    const r = calcSession(values(1000, 0, 0, 0), values(700, 0, 0, 0), [200])
    expect(r.status).toBe('Short')
    expect(r.complaintsTotal).toBe(200)
    expect(r.complaintCount).toBe(1)
    expect(r.adjustedDifference).toBeCloseTo(-100)
    expect(r.adjustedStatus).toBe('Match')
  })

  it('computes expected end balances and gaps', () => {
    const r = calcSession(values(1000, 2000, 0, 0), values(1500, 1600, 1000, 500))
    expect(r.expectedTele).toBeCloseTo(1500)
    expect(r.expectedReddy).toBeCloseTo(2000 + 500 * 1.02 - 1000 * 0.97)
    expect(r.teleGap).toBeCloseTo(0)
    expect(r.reddyGap).toBeCloseTo(1600 - r.expectedReddy)
  })

  it('treats blank or invalid fields as zero', () => {
    const r = calcSession(values('', 'x', '', ''), values('100', '', '', ''))
    expect(r.startTotal).toBe(0)
    expect(r.endTotal).toBe(100)
  })

  it('warns when counters go backwards', () => {
    const r = calcSession(values(0, 0, 100, 100), values(0, 0, 50, 50))
    expect(r.warnings).toEqual([
      'End deposit is lower than start deposit.',
      'End withdrawal is lower than start withdrawal.',
    ])
  })
})
