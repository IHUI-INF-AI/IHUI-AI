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
 *  - 写失败 / 链断**不再静默**:失效方向由 egress 层按策略结算(F-078:审计与放行不脱耦)——
 *    本文件只如实回报 `unjudged` + 原因码,放行结论由 `env-inject.ts` 按档位落地。
 *  - F-078:每行带 `seq`(单调序号)、`prev`(前一行哈希)、`hash`(本行内容哈希)组成哈希链;
 *    追加前先校验既有链,链断即拒写并落 `unjudged`。首次从旧格式台账(无链字段)升级时,
 *    旧行只作为迁移前缀,新行从其后接链(不重写历史)。文件权限钉 0600(新建即 mode,
 *    存量靠 chmod 纠偏,与 `lib/private-file.ts` 同一写法)。
 */

import { createHash } from 'node:crypto';
import { appendFileSync, chmodSync, mkdirSync, readFileSync, type Stats } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

import { findProjectRoot } from '../../runs/manifest.js';
import { EGRESS_ENV, type EgressDecision, type EgressJudgement } from './policy.js';

const EGRESS_LEDGER_REL_PATH = join('.ihui-agent', 'state', 'egress-decisions.jsonl');

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

/** 台账读取结果:`missing` 与 `error` 必须分开 —— 读失败不得冒充"空台账"。 */
export type LedgerReadResult =
  | { readonly kind: 'missing' }
  | { readonly kind: 'ok'; readonly text: string }
  | { readonly kind: 'error'; readonly code: string };

/** 注入式读盘器(校验既有链用)。 */
export type LedgerReader = (absolutePath: string) => LedgerReadResult;

/** 台账文件权限:私有可读写。 */
const LEDGER_MODE = 0o600;
/** 链锚:空台账 / 旧格式迁移边界的 prev 取值。 */
const CHAIN_SEED = '0'.repeat(64);
/** 参与哈希的行字段(固定顺序,便于跨机复算)。 */
const CHAIN_FIELDS = ['ts', 'pid', 'target', 'decision', 'layer', 'ruleId', 'reason', 'enforcement', 'enforced'] as const;

const defaultAppender: RowAppender = (abs, line) => {
  try {
    mkdirSync(dirname(abs), { recursive: true });
    // mode 只对新建文件生效;存量文件靠下面 chmod 纠偏(同 lib/private-file.ts 的写法)。
    appendFileSync(abs, line + '\n', { encoding: 'utf8', mode: LEDGER_MODE });
    try {
      chmodSync(abs, LEDGER_MODE);
    } catch {
      // Windows 无 POSIX 权限语义:写入已完成,不因纠偏失败把整条命令判死
    }
    return null;
  } catch (e) {
    // 只取错误码这类 ASCII 标识,异常原文不进台账(原文里可能带路径/凭据形态)。
    const code = (e as { code?: unknown }).code;
    return typeof code === 'string' ? code : 'write-failed';
  }
};

const defaultReader: LedgerReader = (abs) => {
  try {
    return { kind: 'ok', text: readFileSync(abs, 'utf8') };
  } catch (e) {
    const code = (e as { code?: unknown }).code;
    if (code === 'ENOENT') return { kind: 'missing' };
    return { kind: 'error', code: typeof code === 'string' ? code : 'read-failed' };
  }
};

/** 一行的内容哈希:`seq` + `prev` + 固定字段序列(字段序写死,跨进程可复算)。 */
function chainHashOf(row: Record<string, unknown>, seq: number, prev: string): string {
  const payload = JSON.stringify([seq, prev, ...CHAIN_FIELDS.map((key) => row[key])]);
  return createHash('sha256').update(payload).digest('hex');
}

type ChainAnchor = { readonly seq: number; readonly hash: string };
type ChainVerdict = { readonly ok: true; readonly anchor: ChainAnchor } | { readonly ok: false; readonly reason: string };

/**
 * 校验既有台账链:逐行验 `seq` 连续、`prev` 指向前一行 `hash`、`hash` 可复算。
 * 全旧格式(本特性之前落盘、无任何链字段)⇒ 只作迁移前缀,锚点从其后接起;
 * 旧行之后又冒出无链行、或哈希/序号对不上 ⇒ 链断(拒绝追加)。
 */
function verifyLedgerChain(text: string): ChainVerdict {
  const lines = text.split('\n').filter((line) => line.trim() !== '');
  if (lines.length === 0) return { ok: true, anchor: { seq: 0, hash: CHAIN_SEED } };
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(lines[i]!);
    } catch {
      return { ok: false, reason: `ledger-chain-broken:line-${i + 1}-unparseable` };
    }
    if (typeof parsed !== 'object' || parsed === null) {
      return { ok: false, reason: `ledger-chain-broken:line-${i + 1}-shape` };
    }
    rows.push(parsed as Record<string, unknown>);
  }
  const firstChained = rows.findIndex(
    (row) => typeof row.hash === 'string' || typeof row.seq === 'number' || typeof row.prev === 'string',
  );
  // 全旧格式:迁移边界,历史不可验,但仍要求它是**连续前缀**(无链字段)。
  if (firstChained < 0) return { ok: true, anchor: { seq: rows.length, hash: CHAIN_SEED } };
  let prev = CHAIN_SEED;
  let seq = firstChained;
  for (let i = firstChained; i < rows.length; i += 1) {
    const row = rows[i]!;
    if (typeof row.seq !== 'number' || typeof row.prev !== 'string' || typeof row.hash !== 'string') {
      return { ok: false, reason: `ledger-chain-broken:line-${i + 1}-unchained` };
    }
    if (row.seq !== seq + 1) return { ok: false, reason: `ledger-chain-broken:line-${i + 1}-seq` };
    if (row.prev !== prev) return { ok: false, reason: `ledger-chain-broken:line-${i + 1}-prev` };
    if (row.hash !== chainHashOf(row, row.seq, row.prev)) {
      return { ok: false, reason: `ledger-chain-broken:line-${i + 1}-hash` };
    }
    prev = row.hash;
    seq = row.seq;
  }
  return { ok: true, anchor: { seq, hash: prev } };
}

/**
 * 台账落点:`IHUI_EGRESS_AUDIT_LOG` 优先(与 `IHUI_SANDBOX_AUDIT_LOG` 同一形态),
 * 否则仓库根下的状态目录。取不到仓库根 ⇒ null(调用方必须记 unjudged,不得静默丢)。
 */
export function resolveLedgerPath(
  startDir: string,
  env: Record<string, string | undefined> = process.env,
  stat?: (target: string) => Stats,
): string | null {
  const declared = env[EGRESS_ENV.ledger]?.trim();
  if (declared) return isAbsolute(declared) ? declared : resolve(startDir, declared);
  try {
    const root = findProjectRoot(startDir, stat);
    return root === null ? null : join(root, EGRESS_LEDGER_REL_PATH);
  } catch {
    return null;
  }
}

/**
 * 逐条追加(整批原子判定):任何一行不过形状锁 ⇒ **整批不写**并点名是哪一行、哪条违规。
 * 宁可少记一批、也不要记进半截凭据 —— 台账一旦含凭据,它自己就成了新的敞口。
 * F-078:追加前校验既有链(链断/读不成 ⇒ 整批不写并落 unjudged);每行接 `seq/prev/hash`。
 */
export function appendEgressAuditRows(
  rows: readonly EgressAuditRow[],
  opts: {
    /** 派生点的工作目录(由调用方显式交进来,不取 process.cwd() —— §15 定根纪律)。 */
    readonly startDir: string;
    readonly env?: Record<string, string | undefined>;
    readonly append?: RowAppender;
    readonly read?: LedgerReader;
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
  const read = (opts.read ?? defaultReader)(path);
  if (read.kind === 'error') {
    return { state: 'unjudged', rows: rows.length, reason: `ledger-read-failed:${read.code}` };
  }
  let anchor: ChainAnchor = { seq: 0, hash: CHAIN_SEED };
  if (read.kind === 'ok') {
    const verdict = verifyLedgerChain(read.text);
    if (!verdict.ok) return { state: 'unjudged', rows: rows.length, reason: verdict.reason };
    anchor = verdict.anchor;
  }
  const append = opts.append ?? defaultAppender;
  let seq = anchor.seq;
  let prev = anchor.hash;
  for (const row of rows) {
    seq += 1;
    const hash = chainHashOf(row as unknown as Record<string, unknown>, seq, prev);
    const failure = append(path, JSON.stringify({ ...row, seq, prev, hash }));
    if (failure !== null) {
      return { state: 'unjudged', rows: rows.length, reason: `ledger-write-failed:${failure}` };
    }
    prev = hash;
  }
  return { state: 'written', rows: rows.length, path };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
