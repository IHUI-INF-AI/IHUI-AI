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
    _enabled = process.env.IHUI_AUDIT !== '0';
  }
  return _enabled;
}

export function getAuditLogPath(): string {
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
    output: entry.output ? truncate(entry.output) : undefined,
  };

  fs.appendFileSync(logPath, JSON.stringify(record) + '\n', 'utf-8');
}
