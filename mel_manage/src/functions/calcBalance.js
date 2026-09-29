// KEEP IN SYNC with calc_session() in supabase/schema.sql.
// This copy is only the on-screen preview; the database's copy decides
// Match / Over / Short when a session is saved.
export const DEPOSIT_RATE = 0.03;
export const WITHDRAWAL_RATE = 0.02;
export const MATCH_TOLERANCE = 150;

const toNumber = (value) => parseFloat(value) || 0;

export function calcSession(startValues, endValues) {
  const start = {
    tele: toNumber(startValues.tele),
    reddy: toNumber(startValues.reddy),
    deposit: toNumber(startValues.deposit),
    withdrawal: toNumber(startValues.withdrawal),
  };
  const end = {
    tele: toNumber(endValues.tele),
    reddy: toNumber(endValues.reddy),
    deposit: toNumber(endValues.deposit),
    withdrawal: toNumber(endValues.withdrawal),
  };

  // 1. Session profit from balances
  const startTotal = start.tele + start.reddy;
  const endTotal = end.tele + end.reddy;
  const sessionProfit = endTotal - startTotal;

  // 2. Deposits / withdrawals worked in the session and their commission
  const depositInSession = end.deposit - start.deposit;
  const withdrawalInSession = end.withdrawal - start.withdrawal;
  const depositCommission = depositInSession * DEPOSIT_RATE;
  const withdrawalCommission = withdrawalInSession * WITHDRAWAL_RATE;
  const totalCommission = depositCommission + withdrawalCommission;

  // 3. Compare commission with session profit
  const difference = sessionProfit - totalCommission;
  let status = 'Match';
  if (difference > MATCH_TOLERANCE) status = 'Over';
  else if (difference < -MATCH_TOLERANCE) status = 'Short';

  // 4. Expected end balances
  const expectedTele = start.tele + (depositInSession - withdrawalInSession);
  const expectedReddy =
    start.reddy +
    (withdrawalInSession * (1 + WITHDRAWAL_RATE) - depositInSession * (1 - DEPOSIT_RATE));

  const warnings = [];
  if (depositInSession < 0) warnings.push('End deposit is lower than start deposit.');
  if (withdrawalInSession < 0) warnings.push('End withdrawal is lower than start withdrawal.');

  return {
    startTotal,
    endTotal,
    sessionProfit,
    depositInSession,
    withdrawalInSession,
    depositCommission,
    withdrawalCommission,
    totalCommission,
    difference,
    status,
    expectedTele,
    expectedReddy,
    actualTele: end.tele,
    actualReddy: end.reddy,
    teleGap: end.tele - expectedTele,
    reddyGap: end.reddy - expectedReddy,
    warnings,
  };
}
