const STORAGE_KEY = 'auto-trading-strategy-names';

function readNames(): string[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function writeNames(names: string[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(new Set(names))));
}

export function listLocalStrategyNames() {
  return readNames();
}

export function isNameTaken(name: string) {
  const names = readNames();
  return names.includes(name.trim());
}

export function upsertLocalStrategyName(name: string) {
  const names = readNames();
  const trimmed = name.trim();
  if (!trimmed) return;
  if (!names.includes(trimmed)) {
    names.push(trimmed);
    writeNames(names);
  }
}

export function removeLocalStrategyName(name: string) {
  const trimmed = name.trim();
  const names = readNames().filter((n) => n !== trimmed);
  writeNames(names);
}

