/**
 * 审计日志 — 记录所有工具调用,决策链路可追溯。
 *
 * 灵感来源:cli 的可观测性设计(Agent 行为可审计)。
 * 简化策略(做减法):
 *   - JSONL 格式追加写入 ~/.ihui/audit.jsonl
 *   - 默认启用,IHUI_AUDIT=0 可禁用
 *   - 同步写入(appendFileSync,保证日志不丢失,且单次 I/O 极快)
 *   - 输入/输出截断到 500 字符防止日志膨胀
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { redactSecrets, redactObject } from './redact.js';
import { loadSettings } from './commands/settings.js';

export interface AuditEntry {
  timestamp: string;
  tool: string;
  input: Record<string, unknown>;
  output?: string;
  success?: boolean;
  durationMs?: number;
  error?: string;
}

let _enabled: boolean | null = null;

function isEnabled(): boolean {
  if (_enabled === null) {
    const settingsEnabled = loadSettings().auditEnabled ?? true;
    const envDisabled = process.env.IHUI_AUDIT === '0';
    _enabled = settingsEnabled && !envDisabled;
  }
  return _enabled;
}

function getAuditLogPath(): string {
  return path.join(os.homedir(), '.ihui', 'audit.jsonl');
}

function truncate(text: string, max = 500): string {
  return text.length > max ? text.slice(0, max) + '...(truncated)' : text;
}

export function auditLog(entry: AuditEntry): void {
  if (!isEnabled()) return;

  const logPath = getAuditLogPath();
  const dir = path.dirname(logPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const record: AuditEntry = {
    ...entry,
    input: redactObject(entry.input),
    output: entry.output ? truncate(redactSecrets(entry.output)) : undefined,
    error: entry.error ? redactSecrets(entry.error) : undefined,
  };

  fs.appendFileSync(logPath, JSON.stringify(record) + '\n', 'utf-8');
}

// ==================== P1-3 Audit log query(查询/过滤审计日志)====================

export interface AuditQueryOptions {
  /** 按工具名过滤(子串匹配,大小写不敏感) */
  tool?: string;
  /** 起始时间(ISO 字符串或相对时间如 "1h"/"30m"/"1d") */
  since?: string;
  /** 按成功/失败过滤 */
  success?: boolean;
  /** 返回条数上限(默认 50) */
  limit?: number;
}

export interface AuditQueryResult {
  entries: AuditEntry[];
  total: number;
  filtered: number;
}

/** 解析相对时间字符串为毫秒时间戳("1h" → 1 小时前,"30m" → 30 分钟前,"1d" → 1 天前) */
function parseSinceToTimestamp(since: string): number | null {
  // ISO 字符串
  const isoDate = new Date(since);
  if (!Number.isNaN(isoDate.getTime())) {
    return isoDate.getTime();
  }
  // 相对时间:Nh/Nm/Nd/Ns(0s = 当前瞬间,旧数据全部排除)
  const match = since.match(/^(\d+)([smhd])$/);
  if (!match) return null;
  const n = parseInt(match[1]!, 10);
  const unit = match[2]!;
  const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return Date.now() - n * multipliers[unit]!;
}

/** 查询审计日志,支持按工具名/时间/成功状态过滤 */
export function queryAuditLog(opts: AuditQueryOptions = {}): AuditQueryResult {
  const logPath = getAuditLogPath();
  if (!fs.existsSync(logPath)) {
    return { entries: [], total: 0, filtered: 0 };
  }

  const content = fs.readFileSync(logPath, 'utf-8');
  const lines = content.split('\n').filter((l) => l.trim().length > 0);

  let sinceTs: number | null = null;
  if (opts.since) {
    sinceTs = parseSinceToTimestamp(opts.since);
    if (sinceTs === null) {
      return { entries: [], total: 0, filtered: 0 };
    }
  }

  const toolFilter = opts.tool?.toLowerCase();
  const limit = opts.limit ?? 50;

  const entries: AuditEntry[] = [];
  let total = 0;
  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as AuditEntry;
      total++;

      // 按工具名过滤(子串匹配)
      if (toolFilter && !entry.tool.toLowerCase().includes(toolFilter)) continue;

      // 按时间过滤
      if (sinceTs !== null) {
        const entryTs = new Date(entry.timestamp).getTime();
        if (Number.isNaN(entryTs) || entryTs < sinceTs) continue;
      }

      // 按成功/失败过滤
      if (opts.success !== undefined && entry.success !== opts.success) continue;

      entries.push(entry);
    } catch {
      // 跳过损坏的 JSON 行
    }
  }

  // 按时间倒序(最近的在前),取 limit 条
  entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const filtered = entries.length;
  const result = entries.slice(0, limit);

  return { entries: result, total, filtered };
}
