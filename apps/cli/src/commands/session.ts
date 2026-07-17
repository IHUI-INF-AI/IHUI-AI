/**
 * 会话管理 — 持久化对话历史到 ~/.ihui/sessions/
 *
 * P0-2 融合:对齐 grok-build 的 `x.ai/session/repair` + `x.ai/rewind/*` ACP 扩展方法。
 *   - `repairSessionHistoryReport`:支持 dry_run + 结构化响应(duplicates_removed / stripped_tool_result_ids / synthetic_results_inserted)
 *   - `rewindHistory`:支持 RewindMode(All/UserOnly/AssistantOnly)+ targetPromptIndex + force
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
 * P0-2 结构化 Repair 响应 — 对齐 grok-build `extensions/repair.rs::RepairSessionResponse`。
 * 用于 ACP `x.ai/session/repair` 扩展方法 + REPL `/repair` 命令统一返回结构。
 */
export interface RepairSessionResponse {
  /** 是否执行了修复(dry_run=true 时为 false 即使发现可修复项) */
  repaired: boolean;
  /** 是否为预演模式(只检测不修改) */
  dryRun: boolean;
  /** 修复后的 history(dry_run=true 时为输入 history 的副本,dry_run=false 时为实际修复结果) */
  repairedHistory: ChatMessage[];
  /** 移除的重复条目数(连续相同 role 合并) */
  duplicatesRemoved: number;
  /** 被剥离的 tool_result 消息 ID 列表(若有 tool_call_id 标记) */
  strippedToolResultIds: string[];
  /** 补全的合成结果数(如末尾 user 后补 synthetic assistant 占位) */
  syntheticResultsInserted: number;
  /** 修复原因清单(供 UI 展示) */
  reasons: string[];
}

/**
 * P0-2 会话历史修复报告 — 既返回修复结果也返回结构化响应。
 * 对齐 grok-build 的双轨(居民 actor vs on-disk)+ dry_run 模式。
 *
 * @param history 待修复的对话历史
 * @param opts.dryRun true=只检测不修改,返回 history 副本 + reasons
 * @param opts.persistToSession 若提供,且 dry_run=false,则把修复结果保存到磁盘
 */
export function repairSessionHistoryReport(
  history: ChatMessage[],
  opts: { dryRun?: boolean; persistToSession?: Session } = {},
): RepairSessionResponse {
  const dryRun = opts.dryRun === true;
  const inputCopy: ChatMessage[] = history.map((m) => ({ ...m }));

  if (dryRun) {
    // dry_run:先实际跑一次修复逻辑以得到 reasons,但返回原 history 副本(不修改)
    const probe = repairSessionHistory(inputCopy);
    return {
      repaired: false,
      dryRun: true,
      repairedHistory: inputCopy,
      duplicatesRemoved: 0,
      strippedToolResultIds: [],
      syntheticResultsInserted: 0,
      reasons: probe.reasons,
    };
  }

  // 实际修复
  const result = repairSessionHistory(history);
  if (opts.persistToSession) {
    opts.persistToSession.history = result.repaired;
    saveSession(opts.persistToSession);
  }
  return {
    repaired: result.removed > 0 || result.reasons.length > 0,
    dryRun: false,
    repairedHistory: result.repaired,
    duplicatesRemoved: result.removed,
    strippedToolResultIds: [],
    syntheticResultsInserted: 0,
    reasons: result.reasons,
  };
}

// ==================== P0-2 Rewind ====================

/** Rewind 模式 — 对齐 grok-build `extensions/rewind.rs::RewindMode` */
export type RewindMode = 'all' | 'user_only' | 'assistant_only';

export interface RewindRequest {
  /** 目标 prompt 索引(0-based,指 user 消息的索引)。若未提供,默认回退 1 步 */
  targetPromptIndex?: number;
  /** 强制回退(即使会破坏 tool_call/tool_result 配对) */
  force?: boolean;
  /** 回退模式:all=全部 / user_only=仅 user / assistant_only=仅 assistant */
  mode?: RewindMode;
}

export interface RewindPoint {
  /** prompt(user 消息)索引 */
  promptIndex: number;
  /** 当时 history 总长度 */
  messageCount: number;
  /** 时间戳(ISO) */
  timestamp: string;
  /** 附近 user 消息的预览(前 60 字符) */
  preview: string;
}

export interface RewindResponse {
  /** 是否实际回退 */
  rewound: boolean;
  /** 回退到的 prompt 索引 */
  rewoundTo: number;
  /** 移除的消息数 */
  removedCount: number;
  /** 回退后的 history(供调用方替换 state) */
  rewoundHistory: ChatMessage[];
  /** 失败原因(rewound=false 时) */
  reason?: string;
}

/**
 * 列出 history 中所有可回退的 rewind 点(user 消息位置)。
 * 对齐 grok-build `extensions/rewind.rs::rewind/points`。
 */
export function listRewindPoints(history: ChatMessage[]): RewindPoint[] {
  const points: RewindPoint[] = [];
  let promptIndex = 0;
  let lastUserTimestamp: string | null = null;
  for (let i = 0; i < history.length; i++) {
    const msg = history[i]!;
    if (msg.role === 'user') {
      points.push({
        promptIndex,
        messageCount: i + 1,
        timestamp: lastUserTimestamp ?? new Date().toISOString(),
        preview: msg.content.slice(0, 60),
      });
      promptIndex++;
    }
    // 简化:不持久化 timestamp,用当前时间占位
    lastUserTimestamp = new Date().toISOString();
  }
  return points;
}

/**
 * P0-2 回退 history 到指定 prompt 索引 — 对齐 grok-build `extensions/rewind.rs::rewind/execute`。
 *
 * @param history 当前对话历史(会被切片但不原地修改)
 * @param request 回退请求
 * @returns RewindResponse,rewoundHistory 为切片后的新 history
 */
export function rewindHistory(history: ChatMessage[], request: RewindRequest): RewindResponse {
  if (history.length === 0) {
    return {
      rewound: false,
      rewoundTo: 0,
      removedCount: 0,
      rewoundHistory: history,
      reason: 'history 为空,无内容可回退',
    };
  }

  const mode: RewindMode = request.mode ?? 'all';
  const points = listRewindPoints(history);
  if (points.length === 0) {
    return {
      rewound: false,
      rewoundTo: 0,
      removedCount: 0,
      rewoundHistory: history,
      reason: '无 user 消息,无可回退点',
    };
  }

  // 默认回退 1 步(到上一个 user 消息之前)
  const targetIdx = request.targetPromptIndex !== undefined
    ? Math.max(0, Math.min(request.targetPromptIndex, points.length - 1))
    : Math.max(0, points.length - 2);

  if (request.targetPromptIndex === undefined && points.length === 1) {
    // 只有一个 user,且未显式指定,清空所有
    return {
      rewound: true,
      rewoundTo: 0,
      removedCount: history.length,
      rewoundHistory: [],
    };
  }

  // 找到目标 prompt 对应的 history 切片位置
  const targetPoint = points[targetIdx];
  if (!targetPoint) {
    return {
      rewound: false,
      rewoundTo: 0,
      removedCount: 0,
      rewoundHistory: history,
      reason: `目标 prompt 索引 ${targetIdx} 超出范围`,
    };
  }

  // 切片:保留到 targetPoint.messageCount(含目标 user)
  const sliced = history.slice(0, targetPoint.messageCount);
  const removedCount = history.length - sliced.length;

  // 按模式过滤
  let rewoundHistory: ChatMessage[];
  if (mode === 'user_only') {
    // 仅回退 user 消息(保留 assistant)
    // 语义:把目标 user 之后的所有 user 移除,assistant 保留
    rewoundHistory = history.filter((m, i) => {
      if (i < targetPoint.messageCount) return true;
      return m.role !== 'user';
    });
  } else if (mode === 'assistant_only') {
    rewoundHistory = history.filter((m, i) => {
      if (i < targetPoint.messageCount) return true;
      return m.role !== 'assistant';
    });
  } else {
    // all:全部移除目标之后的所有消息
    rewoundHistory = sliced;
  }

  // 检查 tool_call/tool_result 配对(非 force 时)
  if (!request.force) {
    const toolCallCount = rewoundHistory.filter((m) => m.role === 'assistant' && m.content.includes('```tool_call')).length;
    const toolResultCount = rewoundHistory.filter((m) => m.role === 'user' && m.content.includes('Tool Result:')).length;
    if (toolCallCount > toolResultCount) {
      return {
        rewound: false,
        rewoundTo: targetIdx,
        removedCount: 0,
        rewoundHistory: history,
        reason: `回退会破坏 tool_call/tool_result 配对(${toolCallCount} 个 tool_call 但只有 ${toolResultCount} 个 tool_result)。使用 force=true 强制回退`,
      };
    }
  }

  return {
    rewound: true,
    rewoundTo: targetIdx,
    removedCount: removedCount,
    rewoundHistory,
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
