export const SESSIONS = ['Session 1', 'Session 2', 'Session 3', 'Session 4'];

export const EMPTY_VALUES = { tele: '', reddy: '', deposit: '', withdrawal: '' };

export const FIELD_LABELS = {
  tele: 'Tele Birr',
  reddy: 'Reddy',
  deposit: 'Deposit',
  withdrawal: 'Withdrawal',
};

export function todayString() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Current time as "HH:MM", the format of <input type="time">.
export function nowTimeString() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const fmt = (n) =>
  Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
