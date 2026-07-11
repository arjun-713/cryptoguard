import type { CaseLogEntry, SuspiciousAddress, Transaction } from '@/data/types';

const TRANSACTIONS_KEY = 'cryptoguard.transactions';
const ACTIONS_KEY = 'cryptoguard.actions';
const SESSION_EVENT = 'cryptoguard:session-update';

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readJson<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function emitUpdate(): void {
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent(SESSION_EVENT));
}

export function onSessionUpdate(callback: () => void): () => void {
  if (!isBrowser()) {
    return () => undefined;
  }

  const handler = () => callback();
  window.addEventListener(SESSION_EVENT, handler);
  window.addEventListener('storage', handler);

  return () => {
    window.removeEventListener(SESSION_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}

export function getStoredTransactions(): Transaction[] {
  return readJson<Transaction[]>(TRANSACTIONS_KEY, []);
}

export function saveTransactions(transactions: Transaction[]): void {
  writeJson(TRANSACTIONS_KEY, transactions.slice(0, 50));
  emitUpdate();
}

export function mergeTransactions(incoming: Transaction[]): Transaction[] {
  const current = getStoredTransactions();
  const byId = new Map<string, Transaction>();

  for (const tx of current) {
    byId.set(tx.id, tx);
  }

  for (const tx of incoming) {
    byId.set(tx.id, tx);
  }

  const merged = Array.from(byId.values())
    .sort((a, b) => (b.receivedAt ?? 0) - (a.receivedAt ?? 0))
    .slice(0, 50);

  saveTransactions(merged);
  return merged;
}

export function clearStoredTransactions(): void {
  saveTransactions([]);
}

export function getStoredActions(): CaseLogEntry[] {
  return readJson<CaseLogEntry[]>(ACTIONS_KEY, []);
}

export function appendStoredAction(action: CaseLogEntry): CaseLogEntry[] {
  const actions = [action, ...getStoredActions()];
  writeJson(ACTIONS_KEY, actions);
  emitUpdate();
  return actions;
}

export function getStoredStats() {
  const transactions = getStoredTransactions();
  const actions = getStoredActions();
  const autoHeld = transactions.filter(tx => tx.auto_held).length;
  const autoMonitored = transactions.filter(tx => tx.auto_monitored).length;
  const manualReleases = actions.filter(action => action.analyst_notes.includes('[ANALYST RELEASED]')).length;
  const confirmedScams = 0;
  const heldDenominator = autoHeld || 1;

  return {
    total_scored: transactions.length,
    auto_held: autoHeld,
    auto_monitored: autoMonitored,
    manual_releases: manualReleases,
    confirmed_scams: confirmedScams,
    false_positive_rate: Number((manualReleases / heldDenominator).toFixed(4)),
    precision: Number((confirmedScams / heldDenominator).toFixed(4)),
  };
}

export function getStoredSuspiciousAddresses(): SuspiciousAddress[] {
  const flagged = getStoredTransactions().filter(tx => tx.risk_score >= 40);
  const grouped = new Map<string, SuspiciousAddress & { rules: Set<string> }>();

  for (const tx of flagged) {
    const address = tx.from.toLowerCase();
    const existing = grouped.get(address);
    const seenAt = new Date(tx.receivedAt ?? Date.now()).toISOString();

    if (!existing) {
      grouped.set(address, {
        address,
        first_seen: seenAt,
        last_seen: seenAt,
        times_flagged: 1,
        highest_score: tx.risk_score,
        triggered_rules: JSON.stringify(tx.triggered_rules),
        notes: '',
        rules: new Set(tx.triggered_rules),
      });
      continue;
    }

    existing.last_seen = seenAt;
    existing.times_flagged += 1;
    existing.highest_score = Math.max(existing.highest_score, tx.risk_score);
    for (const rule of tx.triggered_rules) {
      existing.rules.add(rule);
    }
    existing.triggered_rules = JSON.stringify(Array.from(existing.rules));
  }

  return Array.from(grouped.values())
    .map(({ rules: _rules, ...addr }) => addr)
    .sort((a, b) => b.times_flagged - a.times_flagged || b.highest_score - a.highest_score);
}
