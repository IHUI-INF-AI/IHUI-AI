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

/**
 * P1-1 会话历史自愈 — 修复 history 结构异常。
 *
 * 灵感来源:grok-build 的 `x.ai/session/repair` 扩展方法。
 * 问题:长期运行的 session 偶发损坏(85% 自动压缩 / checkpoint 频繁操作 / interjection buffer 残留 /
 * 中断恢复)会导致 history 结构异常,触发 LLM 400 错误或语义错乱。
 *
 * 修复规则:
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
  const reasons: string[] = [];
  const VALID_ROLES = new Set(['system', 'user', 'assistant']);
  let removed = 0;

  // Rule 1+2:过滤非法 role + 空 content
  let cleaned = history.filter((m) => {
    if (!m || typeof m !== 'object') { removed++; return false; }
    if (!VALID_ROLES.has(m.role)) {
      reasons.push(`移除非法 role: ${m.role}`);
      removed++;
      return false;
    }
    if (typeof m.content !== 'string' || m.content.trim() === '') {
      reasons.push(`移除空 content(role=${m.role})`);
      removed++;
      return false;
    }
    return true;
  });

  // Rule 3:去重连续相同 role(合并 content)
  const deduped: ChatMessage[] = [];
  for (const m of cleaned) {
    const last = deduped[deduped.length - 1];
    if (last && last.role === m.role) {
      reasons.push(`合并连续 ${m.role} 消息`);
      last.content = `${last.content}\n\n${m.content}`;
    } else {
      deduped.push({ ...m });
    }
  }
  cleaned = deduped;

  // Rule 4:确保首条是 system 或 user(丢弃开头的 assistant)
  while (cleaned.length > 0 && cleaned[0]!.role === 'assistant') {
    reasons.push('移除开头的 assistant 消息(无前置 user)');
    cleaned.shift();
    removed++;
  }

  // Rule 5:移除末尾无响应的 user 消息(interjection 残留)
  if (cleaned.length > 0 && cleaned[cleaned.length - 1]!.role === 'user') {
    // 仅当末尾 user 不是首轮(前面有 assistant 响应)时移除
    // 首轮 user(前面无 assistant)保留
    const hasAssistant = cleaned.some((m) => m.role === 'assistant');
    if (hasAssistant) {
      reasons.push('移除末尾无 assistant 响应的 user 消息(可能是 interjection 残留)');
      cleaned.pop();
      removed++;
    }
  }

  return { repaired: cleaned, removed, reasons };
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
