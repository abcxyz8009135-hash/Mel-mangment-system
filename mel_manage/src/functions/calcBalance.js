// KEEP IN SYNC with calc_session() in supabase/schema.sql.
// This copy is only the on-screen preview; the database's copy decides
// Match / Over / Short when a session is saved.
export const DEPOSIT_RATE = 0.03;
export const WITHDRAWAL_RATE = 0.02;
export const MATCH_TOLERANCE = 150;

const toNumber = (value) => parseFloat(value) || 0;

const statusFor = (difference) => {
  if (difference > MATCH_TOLERANCE) return 'Over';
  if (difference < -MATCH_TOLERANCE) return 'Short';
  return 'Match';
};

// "200, 150, 75" -> { values: [200, 150, 75] }. Blank entries are ignored;
// anything that is not a positive number gives { error }.
export function parseComplaints(text) {
  const parts = (text || '').split(',').map((p) => p.trim()).filter(Boolean);
  const values = [];
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isFinite(n) || n <= 0) {
      return { values: [], error: `"${part}" is not a valid complaint amount. Use positive numbers separated by commas.` };
    }
    values.push(n);
  }
  return { values, error: null };
}

export function calcSession(startValues, endValues, complaints = []) {
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
  const status = statusFor(difference);

  // 3b. Complaints worked in the session are added to the difference
  const complaintsTotal = complaints.reduce((sum, n) => sum + n, 0);
  const adjustedDifference = difference + complaintsTotal;
  const adjustedStatus = statusFor(adjustedDifference);

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
    complaints,
    complaintCount: complaints.length,
    complaintsTotal,
    adjustedDifference,
    adjustedStatus,
    expectedTele,
    expectedReddy,
    actualTele: end.tele,
    actualReddy: end.reddy,
    teleGap: end.tele - expectedTele,
    reddyGap: end.reddy - expectedReddy,
    warnings,
  };
}
