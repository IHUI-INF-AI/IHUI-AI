// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 出口裁决留痕( goal-b49 复现腿的"量得到"那一半,对齐 AGENTS.md §5e-3)。
 *
 * 立因:一次裁决如果只活在内存里,事后就无法回答"这条命令当时到底放没放行、是谁放行的"。
 * 对方(WorkBuddy)的裁决落在代理进程日志里,本仓没有常驻代理,所以把**每一次裁决**
 * 逐条落成 `.ihui-agent/state/egress-decisions.jsonl`(gitignored 状态目录,§15 卫生)。
 *
 * 台账纪律(与 §5e-3 的发信台账同一口径):
 *  - 一行一次裁决;键与取值一律 ASCII 机器码,便于跨机对账;
 *  - **不得含任何凭据 / URL 查询串 / 解析出的地址**:写之前过 `rowIsSafe`,不合格的行
 *    整批不写并落 `unjudged` 点名(失效方向是"多要一次定向说明",不是"少记几行")——
 *    `§0.3`:取不到台账目录 ⇒ unjudged,不静默丢;
 *  - 写失败**永不阻塞**主流程(观测件不挡干活的腿,同 `appendSandboxAuditLog`)。
 */

import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

import { findProjectRoot } from '../../runs/manifest.js';
import { EGRESS_ENV, type EgressDecision, type EgressJudgement } from './policy.js';

export const EGRESS_LEDGER_REL_PATH = join('.ihui-agent', 'state', 'egress-decisions.jsonl');

/** 绝不允许出现在台账行里的键名(值形态由 `rowIsSafe` 另行把守)。 */
export const FORBIDDEN_LEDGER_KEYS: readonly string[] = [
  'url',
  'href',
  'query',
  'path',
  'authorization',
  'cookie',
  'headers',
  'token',
  'secret',
  'password',
  'key',
  'address',
  'addresses',
  'resolved',
];

/** 值形态红线:含 scheme / 查询串 / userinfo 分隔符的字符串都不是"域名"。 */
const FORBIDDEN_VALUE_PATTERNS: readonly RegExp[] = [/\/\//, /\?/, /@/, /\bBearer\b/i];

export interface EgressAuditRow {
  /** ISO 时刻(可注入,测试不依赖真实时钟)。 */
  readonly ts: string;
  /** 发起派生的父进程 pid(不是子进程 —— 子进程可能根本没起来)。 */
  readonly pid: number;
  /** 脱敏后的目标形态:只有主机名(`normalizeEgressHost` 的产物)。 */
  readonly target: string;
  readonly decision: EgressDecision;
  readonly layer: string;
  readonly ruleId: string | null;
  readonly reason: string;
  readonly enforcement: string;
  /** 这次裁决有没有真的拦下派生(区别于"判了但只是出声")。 */
  readonly enforced: boolean;
}

/** 由裁决 + 现场拼一行;字段固定,不留"顺手多写一个"的缝。 */
export function toAuditRow(
  verdict: EgressJudgement,
  now: () => Date = () => new Date(),
  pid: number = process.pid,
  enforced = false,
): EgressAuditRow {
  return {
    ts: now().toISOString(),
    pid,
    target: verdict.target,
    decision: verdict.decision,
    layer: verdict.layer,
    ruleId: verdict.ruleId,
    reason: verdict.reason,
    enforcement: verdict.enforcement,
    enforced,
  };
}

/** 形状锁:键名不在禁列、字符串值不含 URL/凭据形态。测试直接断言这一把尺。 */
export function ledgerViolation(row: EgressAuditRow): string | null {
  for (const key of Object.keys(row)) {
    if (FORBIDDEN_LEDGER_KEYS.includes(key)) return `forbidden-key:${key}`;
  }
  for (const [key, value] of Object.entries(row)) {
    if (typeof value !== 'string') continue;
    if (FORBIDDEN_VALUE_PATTERNS.some((re) => re.test(value))) return `forbidden-value:${key}`;
  }
  return null;
}

export type LedgerOutcome =
  | { readonly state: 'written'; readonly rows: number; readonly path: string }
  | { readonly state: 'skipped'; readonly rows: number; readonly reason: 'no-rows' }
  | { readonly state: 'unjudged'; readonly rows: number; readonly reason: string };

/** 注入式落盘器:返回 null = 写不成(原因由实现方给,不抛)。 */
export type RowAppender = (absolutePath: string, line: string) => string | null;

const defaultAppender: RowAppender = (abs, line) => {
  try {
    mkdirSync(dirname(abs), { recursive: true });
    appendFileSync(abs, line + '\n', 'utf8');
    return null;
  } catch (e) {
    // 只取错误码这类 ASCII 标识,异常原文不进台账(原文里可能带路径/凭据形态)。
    const code = (e as { code?: unknown }).code;
    return typeof code === 'string' ? code : 'write-failed';
  }
};

/**
 * 台账落点:`IHUI_EGRESS_AUDIT_LOG` 优先(与 `IHUI_SANDBOX_AUDIT_LOG` 同一形态),
 * 否则仓库根下的状态目录。取不到仓库根 ⇒ null(调用方必须记 unjudged,不得静默丢)。
 */
export function resolveLedgerPath(
  startDir: string,
  env: Record<string, string | undefined> = process.env,
): string | null {
  const declared = env[EGRESS_ENV.ledger]?.trim();
  if (declared) return isAbsolute(declared) ? declared : resolve(startDir, declared);
  const root = findProjectRoot(startDir);
  return root === null ? null : join(root, EGRESS_LEDGER_REL_PATH);
}

/**
 * 逐条追加(整批原子判定):任何一行不过形状锁 ⇒ **整批不写**并点名是哪一行、哪条违规。
 * 宁可少记一批、也不要记进半截凭据 —— 台账一旦含凭据,它自己就成了新的敞口。
 */
export function appendEgressAuditRows(
  rows: readonly EgressAuditRow[],
  opts: {
    /** 派生点的工作目录(由调用方显式交进来,不取 process.cwd() —— §15 定根纪律)。 */
    readonly startDir: string;
    readonly env?: Record<string, string | undefined>;
    readonly append?: RowAppender;
  },
): LedgerOutcome {
  if (rows.length === 0) return { state: 'skipped', rows: 0, reason: 'no-rows' };
  for (const row of rows) {
    const violation = ledgerViolation(row);
    if (violation !== null) {
      return { state: 'unjudged', rows: rows.length, reason: `row-shape-rejected:${violation}` };
    }
  }
  const path = resolveLedgerPath(opts.startDir, opts.env ?? process.env);
  if (path === null) {
    return {
      state: 'unjudged',
      rows: rows.length,
      reason: 'ledger-dir-unavailable: no project root above the spawn cwd (set ' + EGRESS_ENV.ledger + ')',
    };
  }
  const append = opts.append ?? defaultAppender;
  for (const row of rows) {
    const failure = append(path, JSON.stringify(row));
    if (failure !== null) {
      return { state: 'unjudged', rows: rows.length, reason: `ledger-write-failed:${failure}` };
    }
  }
  return { state: 'written', rows: rows.length, path };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
