// Kept under its own key, away from the training log, so a key never ends up in an exported backup.
const KEY = 'hermes-workout:anthropic-key';

export function getApiKey(): string | null {
  try {
    return localStorage.getItem(KEY) || null;
  } catch {
    return null;
  }
}

export function setApiKey(key: string | null) {
  try {
    const trimmed = key?.trim();
    if (trimmed) localStorage.setItem(KEY, trimmed);
    else localStorage.removeItem(KEY);
  } catch {
    // Storage can be blocked (private windows, site data off); the key just isn't remembered.
  }
}
