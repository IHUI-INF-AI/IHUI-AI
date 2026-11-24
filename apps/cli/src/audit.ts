// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 审计日志 — 记录所有工具调用,决策链路可追溯。
 *
 * 灵感来源:参考行业 Agent 框架的可观测性设计(Agent 行为可审计)。
 * 简化策略(做减法):
 *   - JSONL 格式追加写入 ~/.ihui/audit.jsonl
 *   - 默认启用,IHUI_AUDIT=0 可禁用
 *   - 同步写入(appendFileSync,保证日志不丢失,且单次 I/O 极快)
 *   - 输入/输出截断到 500 字符防止日志膨胀
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { redactSecrets, redactObjectDeepKeyed } from './redact.js';
import { tryParseJson, isRecord } from './util/json.js';
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

/**
 * F-039:审计日志里住着工具入参与输出 ⇒ 目录 0700、文件 0600。
 * 只在 POSIX 上判:Windows 没有 POSIX 权限位语义(chmod 只动"只读"标),跳过才是无害的。
 */
const AUDIT_DIR_MODE = 0o700;
const AUDIT_FILE_MODE = 0o600;
const POSIX_PERMISSIONS = process.platform !== 'win32';

/**
 * 显式收紧权限位。`mkdirSync`/`appendFileSync` 的 mode **只管新建**,已存在的目录/文件
 * 一个权限位都不改,所以要在每次写日志时再纠一次偏(顺带覆盖轮转后新落的那一份)。
 * 收紧失败不掀结论:本次审计已经写成,不能因为纠偏失败把日志本身丢掉。
 */
function tightenPermissions(target: string, mode: number): void {
  if (!POSIX_PERMISSIONS) return;
  try {
    fs.chmodSync(target, mode);
  } catch {
    /* 读不到/不是自己的文件 ⇒ 留给下一次写日志再纠;审计落盘优先 */
  }
}

/**
 * 一次截断的读数(对照组 `tools/mcp-runtime.ts` 的 bytesRead/sizeBytes 形态,G-814409):
 * 四个字段**全是真实量值**,没有一个是恒真 —— `truncated` 由 `bytesRead > sizeBytes` 比较得出
 * (而不是写死 true/false),所以"超长时标 (truncated)、量值可信"这条判据有牙,
 * 恒真标注会被用例咬出来。
 */
export interface AuditTruncationReading {
  /** 输入总字符数(**含**被截掉的那部分) */
  bytesRead: number;
  /** 实际保留进审计日志的字符数 */
  sizeBytes: number;
  /** 保留文本(截断时自带 `...(truncated bytesRead/sizeBytes)` 标注) */
  text: string;
  /** 真的截断过(= bytesRead > sizeBytes) */
  truncated: boolean;
}

/**
 * 唯一截断出口:截断时**自报丢了多少**(`...(truncated bytesRead/sizeBytes)`),
 * 不再只留一句不带量的 `...(truncated)`(G-814409:裁剪必须自报丢了多少)。
 */
export function truncateWithReading(text: string, max = 500): AuditTruncationReading {
  const bytesRead = text.length;
  const sizeBytes = Math.min(max, bytesRead);
  const truncated = bytesRead > sizeBytes;
  return {
    bytesRead,
    sizeBytes,
    text: truncated ? text.slice(0, max) + `...(truncated ${bytesRead}/${sizeBytes})` : text,
    truncated,
  };
}

function truncate(text: string, max = 500): string {
  return truncateWithReading(text, max).text;
}

export function auditLog(entry: AuditEntry): void {
  if (!isEnabled()) return;

  const logPath = getAuditLogPath();
  const dir = path.dirname(logPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: AUDIT_DIR_MODE });
  // F-039:已存在的目录不受 mkdir 的 mode 管束(且 umask 还会削位)⇒ 每次写日志都收紧一次
  tightenPermissions(dir, AUDIT_DIR_MODE);

  const record: AuditEntry = {
    ...entry,
    // F-006:审计是凭据落盘的最后一道;必须走"键名档 + 大文本档"深脱敏,
    // 否则嵌套对象里的 apiKey/token 字段会原样进 append-only 审计文件。
    input: redactObjectDeepKeyed(entry.input),
    output: entry.output ? truncate(redactSecrets(entry.output)) : undefined,
    error: entry.error ? redactSecrets(entry.error) : undefined,
  };

  // F-039:文件 0600。先按路径收紧存量(轮转后新落的那份由下面的 mode 管),再追加 ——
  // 追加路径每次按当前路径重新打开,所以轮转不会把日志写进已改名的旧 inode。
  tightenPermissions(logPath, AUDIT_FILE_MODE);
  fs.appendFileSync(logPath, JSON.stringify(record) + '\n', { encoding: 'utf-8', mode: AUDIT_FILE_MODE });
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
export function queryAuditLog(
  opts: AuditQueryOptions = {},
  stat?: (path: string) => fs.Stats,
): AuditQueryResult {
  const logPath = getAuditLogPath();
  const look = stat ?? ((target: string) => fs.statSync(target));
  try {
    look(logPath);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      return { entries: [], total: 0, filtered: 0 };
    }
    throw new Error(`审计日志读不到,不能把它说成没有记录 (${code ?? 'unknown'})`);
  }

  let content: string;
  try {
    content = fs.readFileSync(logPath, 'utf-8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code) throw new Error(`审计日志读不到,不能把它说成没有记录 (${code})`);
    throw err;
  }
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
      const parsed = tryParseJson(line);
      // 损坏行 / 非对象 / 缺关键字段的行统一跳过(与原 catch 语义一致,额外防 null.tool 崩溃)
      if (!isRecord(parsed) || typeof parsed.tool !== 'string') continue;
      const entry = parsed as unknown as AuditEntry;
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
