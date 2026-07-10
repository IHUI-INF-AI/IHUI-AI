/**
 * 会话管理 — 持久化对话历史到 ~/.ihui/sessions/
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export interface ChatMessage {
  role: string;
  content: string;
}

export interface Session {
  id: string;
  createdAt: string;
  updatedAt: string;
  workspacePath: string;
  modelId: string;
  history: ChatMessage[];
}

export function getSessionsDir(): string {
  return path.join(os.homedir(), '.ihui', 'sessions');
}

function ensureSessionsDir(): void {
  const dir = getSessionsDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function createSession(workspacePath: string, modelId: string): Session {
  ensureSessionsDir();
  const id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  return { id, createdAt: now, updatedAt: now, workspacePath, modelId, history: [] };
}

export function saveSession(session: Session): void {
  ensureSessionsDir();
  session.updatedAt = new Date().toISOString();
  fs.writeFileSync(
    path.join(getSessionsDir(), `${session.id}.json`),
    JSON.stringify(session, null, 2),
    'utf-8',
  );
}

export function loadSession(id: string): Session | null {
  const filePath = path.join(getSessionsDir(), `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Session;
  } catch {
    return null;
  }
}

export function listSessions(): Session[] {
  ensureSessionsDir();
  const dir = getSessionsDir();
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  const sessions: Session[] = [];
  for (const f of files) {
    try {
      sessions.push(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')) as Session);
    } catch {
      /* ignore corrupted files */
    }
  }
  return sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getMostRecentSession(): Session | null {
  const sessions = listSessions();
  return sessions.length > 0 ? sessions[0]! : null;
}
