import { promises as fs } from 'fs';
import path from 'path';

const LOG_FILE_PATH = path.join(process.cwd(), 'data', 'user-logs.json');

export type AuditLogEntry = {
  id: string;
  timestamp: string;
  userId: string;
  action: string;
  detail?: string;
  actorId?: string | null;
  actorEmail?: string | null;
  metadata?: Record<string, unknown>;
};

async function ensureLogFile() {
  const dir = path.dirname(LOG_FILE_PATH);
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    // ignore
  }
  try {
    await fs.access(LOG_FILE_PATH);
  } catch {
    await fs.writeFile(LOG_FILE_PATH, '[]', 'utf8');
  }
}

async function readAllLogs(): Promise<AuditLogEntry[]> {
  await ensureLogFile();
  const raw = await fs.readFile(LOG_FILE_PATH, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as AuditLogEntry[];
    }
    return [];
  } catch (error) {
    console.warn('[audit] failed to parse log file, resetting', error);
    await fs.writeFile(LOG_FILE_PATH, '[]', 'utf8');
    return [];
  }
}

async function writeAllLogs(entries: AuditLogEntry[]) {
  await fs.writeFile(LOG_FILE_PATH, JSON.stringify(entries, null, 2), 'utf8');
}

export async function recordUserActivity(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) {
  const logs = await readAllLogs();
  const newEntry: AuditLogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    ...entry
  };
  logs.push(newEntry);
  await writeAllLogs(logs);
}

export async function getUserLogs(userId: string, limit = 20): Promise<AuditLogEntry[]> {
  const logs = await readAllLogs();
  return logs
    .filter((entry) => entry.userId === userId)
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
    .slice(0, limit);
}

export async function getUserLogsMap(userIds: string[], limit = 10): Promise<Record<string, AuditLogEntry[]>> {
  const logs = await readAllLogs();
  const set = new Set(userIds);
  const grouped: Record<string, AuditLogEntry[]> = {};
  for (const entry of logs) {
    if (!set.has(entry.userId)) {
      continue;
    }
    if (!grouped[entry.userId]) {
      grouped[entry.userId] = [];
    }
    grouped[entry.userId].push(entry);
  }
  const result: Record<string, AuditLogEntry[]> = {};
  for (const id of userIds) {
    const entries = grouped[id] ?? [];
    result[id] = entries
      .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
      .slice(0, limit);
  }
  return result;
}
