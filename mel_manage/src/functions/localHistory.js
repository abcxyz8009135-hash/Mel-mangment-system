// Sessions saved in this browser before the database existed.
// Used once by the admin to import them.
const STORAGE_KEY = 'mel_session_history';

export function loadLocalHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalHistory(entries) {
  try {
    if (entries.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage unavailable — nothing to clean up
  }
}
