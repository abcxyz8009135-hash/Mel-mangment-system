// Runs the database's calc_session() (from supabase/schema.sql) in an
// in-memory Postgres and checks it agrees with the on-screen preview,
// so neither copy can change without the other.
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { calcSession } from '../calcBalance'

const schema = readFileSync(new URL('../../../supabase/schema.sql', import.meta.url), 'utf8')

// The calculation functions: from num_or_zero() to the end of calc_session().
function calcFunctionsSql() {
  const start = schema.indexOf('create or replace function public.num_or_zero')
  const calc = schema.indexOf('create or replace function public.calc_session')
  const bodyStart = schema.indexOf('$$', calc)
  const bodyEnd = schema.indexOf('$$;', bodyStart + 2)
  if (start < 0 || calc < 0 || bodyStart < 0 || bodyEnd < 0) {
    throw new Error('Calculation functions not found in supabase/schema.sql')
  }
  return schema.slice(start, bodyEnd + 3)
}

const v = (tele, reddy, deposit, withdrawal) => ({ tele, reddy, deposit, withdrawal })

const cases = [
  ['match', v(5000, 5000, 0, 0), v(5040, 5000, 1000, 500), []],
  ['over', v(1000, 1000, 0, 0), v(1500, 1000, 0, 0), []],
  ['short', v(1000, 1000, 0, 0), v(500, 1000, 0, 0), []],
  ['tolerance edge', v(0, 0, 0, 0), v(150, 0, 0, 0), []],
  ['complaints fix a short', v(1000, 0, 0, 0), v(700, 0, 0, 0), [200]],
  ['several complaints', v(2000, 3000, 100, 200), v(2500, 2100, 4100, 1200), [50, 75.5]],
  ['decimals', v(1234.56, 789.01, 10000.5, 2000.25), v(1300.1, 820.33, 12345.67, 2500.75), []],
  ['blank fields', v('', '', '', ''), v('100', '', '', ''), []],
  ['counters backwards', v(0, 0, 100, 100), v(0, 0, 50, 50), []],
]

let db

beforeAll(async () => {
  db = new PGlite()
  await db.exec(calcFunctionsSql())
}, 60_000)

afterAll(() => db?.close())

describe('calc_session() in schema.sql matches calcSession()', () => {
  it.each(cases)('%s', async (_name, start, end, complaints) => {
    const { rows } = await db.query('select public.calc_session($1::jsonb, $2::jsonb, $3::jsonb) as r', [
      JSON.stringify(start),
      JSON.stringify(end),
      JSON.stringify(complaints),
    ])
    const sql = rows[0].r
    const js = calcSession(start, end, complaints)

    expect(Object.keys(sql).sort()).toEqual(Object.keys(js).sort())
    for (const [key, jsValue] of Object.entries(js)) {
      if (typeof jsValue === 'number') expect(Number(sql[key]), key).toBeCloseTo(jsValue, 6)
      else if (key === 'complaints') expect(sql[key].map(Number), key).toEqual(jsValue)
      else expect(sql[key], key).toEqual(jsValue)
    }
  })
})
