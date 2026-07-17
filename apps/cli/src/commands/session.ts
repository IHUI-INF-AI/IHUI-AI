/**
 * 会话管理 — 持久化对话历史到 ~/.ihui/sessions/
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { repairMessages, type RepairableMessage } from '@ihui/types';

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

/**
 * P1-1 会话历史自愈 — 修复 history 结构异常。
 *
 * 灵感来源:grok-build 的 `x.ai/session/repair` 扩展方法。
 * 跨端共享:5 条修复规则实现在 `@ihui/types/message-repair`,CLI/API/ai-service 共用同一套规则。
 * CLI 本地保留 `tryRecoverSessionFromCorruptedJson`(JSON 文件损坏恢复,CLI 独有)。
 *
 * 修复规则(详见 `packages/types/src/message-repair.ts`):
 *   1. 过滤非法 role(只保留 system/user/assistant)
 *   2. 过滤空 content(去除空字符串/纯空白)
 *   3. 去重连续相同 role(合并为单条,content 用 \n\n 连接)
 *   4. 确保首条是 system 或 user(丢弃开头的 assistant)
 *   5. 移除末尾无响应的 user 消息(interjection 残留,没有 assistant 响应)
 *
 * 返回修复后的 history + 移除条数 + 修复原因清单(供 /repair 命令展示)。
 */
export function repairSessionHistory(history: ChatMessage[]): {
  repaired: ChatMessage[];
  removed: number;
  reasons: string[];
} {
  return repairMessages(history as RepairableMessage[]) as {
    repaired: ChatMessage[];
    removed: number;
    reasons: string[];
  };
}

/**
 * 尝试从损坏的 JSON 文件内容中恢复 Session。
 * 策略:
 *   1. 找最后一个完整的 } 边界截断
 *   2. 直接 parse;失败则统计未闭合的 {/[ 并补全对应的 }/] 后再 parse
 *   3. parse 成功后用 repairSessionHistory 清理 history
 */
export function tryRecoverSessionFromCorruptedJson(raw: string): Session | null {
  const lastBrace = raw.lastIndexOf('}');
  if (lastBrace === -1) return null;
  const truncated = raw.slice(0, lastBrace + 1);

  // 第一次尝试:直接 parse
  let session = tryParseSession(truncated);
  if (session) return session;

  // 第二次尝试:补全未闭合的括号(逐字符扫描,跳过字符串字面量内的 { } [ ])
  const closed = closeUnbalancedBrackets(truncated);
  if (closed !== truncated) {
    session = tryParseSession(closed);
    if (session) return session;
  }

  return null;
}

function tryParseSession(s: string): Session | null {
  try {
    const session = JSON.parse(s) as Session;
    if (!session || typeof session !== 'object') return null;
    if (!session.id || !Array.isArray(session.history)) return null;
    const { repaired } = repairSessionHistory(session.history);
    session.history = repaired;
    return session;
  } catch {
    return null;
  }
}

/** 统计未闭合的 { / [ 并在末尾补全对应的 } / ](跳过字符串字面量) */
function closeUnbalancedBrackets(s: string): string {
  const stack: string[] = [];
  let inString = false;
  let escape = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{' || ch === '[') stack.push(ch);
    else if (ch === '}') { if (stack[stack.length - 1] === '{') stack.pop(); }
    else if (ch === ']') { if (stack[stack.length - 1] === '[') stack.pop(); }
  }
  if (stack.length === 0) return s;
  // 按栈逆序补全
  let result = s;
  for (let i = stack.length - 1; i >= 0; i--) {
    result += stack[i] === '{' ? '}' : ']';
  }
  return result;
}
