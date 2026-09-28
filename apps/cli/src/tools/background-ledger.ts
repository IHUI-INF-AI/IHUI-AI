// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 后台任务台账 —— **只报不恢复**(用户拍板口径,2026-09-28)。
 *
 * 要解决的那一格:`background-registry.ts` 的任务表是**模块级内存 Map**,进程一退出就整块消失,
 * 于是"后台任务在会话结束后怎么样了"这个问题没有任何出口 —— 既不成功也不失败,就是查无此事。
 * 本模块给它一个落盘台账,并把"没记到终态"这一格钉成一个**明确的第三态**,
 * 因为 AGENTS §30 写着:没有终态就不得渲染成"完成"。
 *
 * 三条不可动摇的口径(改动前先读):
 *  ① **只报不恢复**:本模块的任何读路径都不得派生进程、不得重跑任务、不得删除既有条目。
 *     清理只有 `pruneLedger({ confirm: true })` 一个人工出口,默认档一条不动。
 *  ② **判据只有一份**:"是不是 detached-unknown"只在 `classifyLedgerRecord()` 里算一次,
 *     repl / 命令 / 别端一律调用它,不得各写一份"进程不在就算失败"。
 *  ③ **不记命令行原文**:命令行可能内嵌 `--token=…`。落盘的只有脱敏后的**程序名**、
 *     一个真摘要(sha-256,截断)与一条脱敏说明;脱敏唯一出口是
 *     `packages/shared/src/utils/redact.ts` 的 `redactCrashText`(守门 144 判"声明处 ≤ 1"),
 *     端内不得再写第二套规则。
 *
 * 落点选择(实测既有状态目录,不新建第五个落点):
 * `plugins/paths.ts` 的 `getIhuiRoot()` = `~/.ihui` —— 这是本端**已有**的跨进程状态根
 * (插件注册表 `installed-plugins/registry.json` 就在那儿),且它已被 §26 的 junction 改道到
 * `D:\DevEnv\cache\userhome\.ihui`,所以不写 C 盘、不进 `os.tmpdir()`。
 * 台账文件:`~/.ihui/background-tasks.jsonl`(JSONL 追加,**最后一行按 id 覆盖前面的状态**)。
 *
 * 原子性:走 `apps/cli/src/util/atomic-write.ts` 那一份出口(同目录 tmp + rename +
 * 读后写 stale 校验)。共享工作区里多个 CLI 会话可能同时写这张表,而"整文件重写"这一型
 * 若不校验就是静默互相覆盖(§12 记过多次);冲突时**有界重试**,仍冲突则**点名告警不静默**。
 * 代价是每次追加重写整文件 —— 由下面的规模闸(2000 行 / 1 MB)给出上界,且心跳按 30s 节流。
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { redactCrashText } from '@ihui/shared/utils/redact';
import { getIhuiRoot } from '../plugins/paths.js';
import { captureWriteBaseline, commitAtomicWrite, WriteConflictError } from '../util/atomic-write.js';
import { isRecord, tryParseJson } from '../util/json.js';

/** 台账文件名(同目录唯一)。派生判断都取这个名字,不得在别处再抄一遍。 */
export const LEDGER_FILE_NAME = 'background-tasks.jsonl';

/** 规模闸:超限即**拒绝自动清理并点名**,不得静默截断(§5c"单次缺口 >200 拒绝自动回写"同一条设计)。 */
export const LEDGER_MAX_LINES = 2000;
export const LEDGER_MAX_BYTES = 1024 * 1024;

/** 心跳节流:一次输出数据就重写整文件是不负责任的 IO,30s 一档足够判"最近还在动"。 */
export const LEDGER_HEARTBEAT_MIN_MS = 30_000;

/** 落盘文本的长度闸(码点,不是字节 —— 中文按码点截才不会切在半截)。 */
const KIND_MAX_CODEPOINTS = 60;
const NOTE_MAX_CODEPOINTS = 160;

/** 写冲突的有界重试次数(每次重取基线再追加)。 */
const APPEND_RETRY_LIMIT = 4;

export type LedgerRecordedTerminal = 'succeeded' | 'failed' | 'cancelled' | 'ended-unknown';

/**
 * 呈现态。前四档是**已记到的终态**(其中 `ended-unknown` = 进程确认结束了但结果无从判定,
 * 例如 Windows 上外部终止后 `close(null, null)`),后四档是"没有记到终态"的可分辨形态:
 *  - `detached-unknown`   没记到终态 ∧ 属主进程确已不在 ⇒ 脱离,结果永远无法知道
 *  - `outcome-unknown`    没记到终态 ∧ **判不出**属主是否还活着(跨机器记录 / 探测被拒)
 *  - `owned-elsewhere`    没记到终态 ∧ 属主进程还活着 ⇒ 别的在跑会话持有它,更不许报成脱离
 *  - `running-here`       没记到终态 ∧ 就在本进程的注册表里
 * 这七档里除了 `succeeded`,任何一档都**不得**被渲染成"完成"(§30)。
 */
export type LedgerTerminalState = LedgerRecordedTerminal | 'detached-unknown';
export type LedgerUnsettledState = 'detached-unknown' | 'outcome-unknown' | 'owned-elsewhere' | 'running-here';
export type LedgerDisplayState = LedgerTerminalState | LedgerUnsettledState;

export interface BackgroundLedgerRecord {
  readonly id: string;
  /** 脱敏后的程序名(命令的第一个词),**不是**完整命令行。 */
  readonly kind: string;
  /** 完整命令行的 sha-256 十六进制前 16 位(不可逆,只用于人对照"大概是哪条命令")。 */
  readonly commandDigest: string;
  readonly startedAt: string;
  /** 最后一次更新(创建 / 心跳 / 终态)的时刻。 */
  readonly lastSeenAt: string;
  /** null = 终态没记到 —— 这一格就是 §30 说的"没有终态"。 */
  readonly terminal: LedgerRecordedTerminal | null;
  /** 拿得到才写;拿不到是 null,并且**不得**据此推断成败。 */
  readonly exitCode: number | null;
  readonly host: string;
  /** 写入这条记录的 CLI 进程 pid(判"脱离"用的就是它)。 */
  readonly ownerPid: number;
  readonly childPid: number | null;
  /** 脱敏 + 截断后的说明(失败原因一类)。 */
  readonly note: string;
}

export interface LedgerOversizeInfo {
  readonly lines: number;
  readonly bytes: number;
  readonly maxLines: number;
  readonly maxBytes: number;
}

export type LedgerWriteCode = 'written' | 'oversized' | 'write-conflict' | 'io-error';

export interface LedgerWriteResult {
  readonly ok: boolean;
  readonly code: LedgerWriteCode;
  readonly path: string;
  readonly oversize: LedgerOversizeInfo | null;
  readonly message: string;
}

export interface LedgerEntryView {
  readonly record: BackgroundLedgerRecord;
  readonly state: LedgerDisplayState;
  /** `state === 'detached-unknown'` 时给判定依据;其余为 null。 */
  readonly basis: string | null;
}

export interface LedgerSummary {
  readonly path: string;
  readonly total: number;
  readonly counts: Readonly<Record<LedgerDisplayState, number>>;
  readonly entries: readonly LedgerEntryView[];
  /** 逐条点名的"没终态"清单(detached-unknown / outcome-unknown / owned-elsewhere / running-here)。 */
  readonly unsettled: readonly LedgerEntryView[];
  readonly malformedLines: number;
  readonly oversize: LedgerOversizeInfo | null;
}

export type PruneResult =
  | { readonly ok: true; readonly archived: number; readonly retained: number; readonly archivePath: string; readonly message: string }
  | { readonly ok: false; readonly code: 'not-confirmed' | 'nothing-to-prune' | 'oversized' | 'io-error'; readonly message: string };

/** 台账写失败与规模闸的**待播告警**(只报不恢复,但绝不能静默)。 */
const alerts: string[] = [];
const ALERT_QUEUE_MAX = 20;
const heartbeatsAt = new Map<string, number>();

function pushAlert(text: string): void {
  alerts.push(text);
  if (alerts.length > ALERT_QUEUE_MAX) alerts.splice(0, alerts.length - ALERT_QUEUE_MAX);
}

/** 取走并清空待播告警(repl 的呈现点调用它,把"没记上账"这件事喊出来)。 */
export function drainLedgerAlerts(): string[] {
  const out = alerts.slice();
  alerts.length = 0;
  return out;
}

export function ledgerFilePath(): string {
  return path.join(getIhuiRoot(), LEDGER_FILE_NAME);
}

/** 按码点截断并**留下被截掉多少**:静默变短等于伪造完整性(AGENTS §30)。 */
function capCodepoints(text: string, max: number): string {
  const cps = Array.from(text);
  if (cps.length <= max) return text;
  return `${cps.slice(0, max).join('')}…[+${cps.length - max}]`;
}

/** 一切进台账的文本都先过唯一脱敏出口,再按码点截断。 */
function sanitizeForLedger(text: string, max: number): string {
  const redacted = redactCrashText(text ?? '');
  return capCodepoints(redacted.replace(/[\u0000-\u001f\u007f]/g, ' ').trim(), max);
}

/**
 * 命令行的"台账名":只取第一个词(程序名)。
 * 刻意不保留参数 —— 参数是凭据的主要载体,而摘要已经够人回溯"大概是哪条"。
 */
export function deriveLedgerKind(command: string): string {
  const first = command.trim().split(/\s+/)[0] ?? '';
  return sanitizeForLedger(first, KIND_MAX_CODEPOINTS) || 'unknown';
}

export function deriveCommandDigest(command: string): string {
  // 先脱敏再哈希:不把原文留在内存里更久,也保证同一命令的摘要稳定可比
  return crypto.createHash('sha256').update(sanitizeForLedger(command, NOTE_MAX_CODEPOINTS * 8)).digest('hex').slice(0, 16);
}

function nowIso(): string {
  return new Date().toISOString();
}

function readLedgerText(): string | null {
  try {
    return fs.readFileSync(ledgerFilePath(), 'utf-8');
  } catch (e) {
    const code = errCode(e);
    if (code === 'ENOENT') return null;
    pushAlert(`[bg-ledger] failed to read the ledger (${String(code ?? (e instanceof Error ? e.message : e))}): ${ledgerFilePath()}`);
    return null;
  }
}

function errCode(e: unknown): string | undefined {
  return typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : undefined;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

/** 逐字段验形:坏行**跳过并计数**,不得半收下(收下一个残缺记录就等于替它编状态)。 */
function parseLedgerRecord(raw: unknown): BackgroundLedgerRecord | null {
  if (!isRecord(raw)) return null;
  const { id, kind, commandDigest, startedAt, lastSeenAt, terminal, exitCode, host, ownerPid, childPid, note } = raw;
  if (!isNonEmptyString(id) || !isNonEmptyString(startedAt) || !isNonEmptyString(lastSeenAt)) return null;
  if (!isNonEmptyString(kind)) return null;
  if (!isNonEmptyString(host)) return null;
  if (typeof ownerPid !== 'number' || !Number.isInteger(ownerPid)) return null;
  const terminalOk =
    terminal === null ||
    terminal === 'succeeded' ||
    terminal === 'failed' ||
    terminal === 'cancelled' ||
    terminal === 'ended-unknown';
  if (!terminalOk) return null;
  const exitOk = exitCode === null || exitCode === undefined || (typeof exitCode === 'number' && Number.isInteger(exitCode));
  if (!exitOk) return null;
  const childOk = childPid === null || childPid === undefined || (typeof childPid === 'number' && Number.isInteger(childPid));
  if (!childOk) return null;
  return {
    id,
    kind,
    commandDigest: typeof commandDigest === 'string' ? commandDigest : '',
    startedAt,
    lastSeenAt,
    terminal: (terminal as LedgerRecordedTerminal | null) ?? null,
    exitCode: typeof exitCode === 'number' ? exitCode : null,
    host,
    ownerPid,
    childPid: typeof childPid === 'number' ? childPid : null,
    note: typeof note === 'string' ? note : '',
  };
}

function measure(text: string | null): LedgerOversizeInfo {
  const body = text ?? '';
  return {
    lines: body.length === 0 ? 0 : body.split('\n').filter((l) => l.trim().length > 0).length,
    bytes: Buffer.byteLength(body, 'utf-8'),
    maxLines: LEDGER_MAX_LINES,
    maxBytes: LEDGER_MAX_BYTES,
  };
}

function oversizeOf(info: LedgerOversizeInfo): LedgerOversizeInfo | null {
  return info.lines > LEDGER_MAX_LINES || info.bytes > LEDGER_MAX_BYTES ? info : null;
}

/** 折叠:同一个 id 只留最后一条(追加式台账的当前状态)。 */
function foldRecords(text: string | null): { records: BackgroundLedgerRecord[]; malformed: number } {
  const byId = new Map<string, BackgroundLedgerRecord>();
  let malformed = 0;
  if (!text) return { records: [], malformed };
  for (const line of text.split('\n')) {
    if (line.trim().length === 0) continue;
    const parsed = parseLedgerRecord(tryParseJson(line));
    if (!parsed) {
      malformed += 1;
      continue;
    }
    byId.set(parsed.id, parsed);
  }
  return { records: [...byId.values()], malformed };
}

function writeResult(ok: boolean, code: LedgerWriteCode, message: string, oversize: LedgerOversizeInfo | null = null): LedgerWriteResult {
  return { ok, code, path: ledgerFilePath(), oversize, message };
}

/**
 * 追加一条记录:取基线 → 拼新行 → 原子写;`WriteConflictError` 说明别人在我们读后写了,
 * 重取基线再试(有界),仍失败就**点名告警**,不覆盖、不静默。
 */
function appendRecord(record: BackgroundLedgerRecord): LedgerWriteResult {
  const file = ledgerFilePath();
  const line = `${JSON.stringify(record)}\n`;
  let lastConflict = '';
  for (let attempt = 0; attempt < APPEND_RETRY_LIMIT; attempt++) {
    const current = readLedgerText();
    const oversize = oversizeOf(measure(current));
    if (oversize) {
      // 规模闸:拒绝自动清理,也拒绝继续把文件撑大。清理只有 pruneLedger({confirm:true})。
      const msg =
        `[bg-ledger] ledger exceeded its size gate — AUTO-CLEAN REFUSED, nothing written: ${file} ` +
        `has ${oversize.lines} lines / ${oversize.bytes} B (limits ${oversize.maxLines} lines / ${oversize.maxBytes} B). ` +
        `To clean it up, run pruneLedger({ confirm: true }) by hand.`;
      pushAlert(msg);
      return writeResult(false, 'oversized', msg, oversize);
    }
    try {
      const baseline = captureWriteBaseline(file);
      commitAtomicWrite(baseline, `${current ?? ''}${line}`);
      return writeResult(true, 'written', `recorded: ${record.id}`);
    } catch (e) {
      if (e instanceof WriteConflictError) {
        lastConflict = e.message;
        continue; // 别的会话刚写过:重读再追加,绝不整块盖掉它
      }
      const msg = `[bg-ledger] ledger write failed: ${file} — ${e instanceof Error ? e.message : String(e)}`;
      pushAlert(msg);
      return writeResult(false, 'io-error', msg);
    }
  }
  const msg = `[bg-ledger] ${APPEND_RETRY_LIMIT} consecutive write conflicts — this record WAS NOT RECORDED: ${file} — ${lastConflict}`;
  pushAlert(msg);
  return writeResult(false, 'write-conflict', msg);
}

function baseRecord(
  id: string,
  command: string,
  childPid: number | null,
  ownerPid: number = process.pid,
): BackgroundLedgerRecord {
  return {
    id,
    kind: deriveLedgerKind(command),
    commandDigest: deriveCommandDigest(command),
    startedAt: nowIso(),
    lastSeenAt: nowIso(),
    terminal: null,
    exitCode: null,
    host: os.hostname(),
    ownerPid,
    childPid,
    note: '',
  };
}

/**
 * 任务创建时记账(注册表调用)。失败不改判任务本身 —— 台账是观测面,不是执行面。
 *
 * `ownerPid` 默认取本进程:判"脱离"问的就是**写这条账的那个进程还在不在**。
 * 它做成可选是因为测试要能造出"写账进程已经不在"的真实现场(而不是靠改判据凑)。
 */
export function recordTaskStart(input: {
  id: string;
  command: string;
  childPid: number | null;
  ownerPid?: number;
}): LedgerWriteResult {
  return appendRecord(baseRecord(input.id, input.command, input.childPid, input.ownerPid));
}

/**
 * 任务落终态时记账:保留原 startedAt / kind(读台账里那一份),只标注状态。
 * 找不到原记录也照样写一条(宁可多一条也不留一个无人知道的任务)。
 */
export function recordTaskSettle(input: {
  id: string;
  terminal: LedgerRecordedTerminal;
  exitCode: number | null;
  note?: string;
  command?: string;
  childPid?: number | null;
}): LedgerWriteResult {
  const existing = foldRecords(readLedgerText()).records.find((r) => r.id === input.id);
  const stamp = nowIso();
  const record: BackgroundLedgerRecord = existing
    ? {
        ...existing,
        lastSeenAt: stamp,
        terminal: input.terminal,
        exitCode: input.exitCode,
        note: sanitizeForLedger(input.note ?? existing.note ?? '', NOTE_MAX_CODEPOINTS),
      }
    : {
        ...baseRecord(input.id, input.command ?? '', input.childPid ?? null),
        startedAt: stamp,
        terminal: input.terminal,
        exitCode: input.exitCode,
        note: sanitizeForLedger(input.note ?? '', NOTE_MAX_CODEPOINTS),
      };
  return appendRecord(record);
}

/** 心跳(按 id 节流)。没记上账不影响任务本身,但会在告警队列里留痕。 */
export function recordHeartbeat(id: string): LedgerWriteResult | 'throttled' {
  const now = Date.now();
  const prev = heartbeatsAt.get(id);
  if (prev !== undefined && now - prev < LEDGER_HEARTBEAT_MIN_MS) return 'throttled';
  heartbeatsAt.set(id, now);
  const existing = foldRecords(readLedgerText()).records.find((r) => r.id === id);
  if (!existing || existing.terminal !== null) return 'throttled';
  return appendRecord({ ...existing, lastSeenAt: nowIso() });
}

/**
 * 属主进程是否还活着。**只探测,不派生任何进程**(所以本模块没有 windowsHide 那一类接线)。
 * 返回 null = 判不出,调用方必须落到 `outcome-unknown`,不得把"判不出"折成"已脱离",
 * 也不得折成"还在跑"。
 *
 * **已知局限(如实登记,不当已完成)**:这一探测只问"这个 pid 在不在",没问"这个 pid 还是
 * 当初那个进程吗"。pid 被系统复用时会把已死的属主读成活着 ⇒ 条目报成 `owned-elsewhere`
 * 而不是 `detached-unknown`(§5b G-193 记过同型:pid 复用能让"存活判断"永远成立)。
 * 失效方向是"少喊一次脱离",不会重跑、也不会把任何条目渲染成完成,所以没有安全代价;
 * 要彻底闭合得把 `pid + pidStart + host` 三元组一起落盘并在读侧现测启动时刻 ——
 * 那份实现住在 `scripts/lib/proc-identity.mjs`,而 `apps/cli/tsconfig.json` 写死
 * `rootDir: "src"` 使端内运行时无法 import 工具层(TS6059),需要另开一票把它做成共享运行时。
 */
export function probeOwnerAlive(record: BackgroundLedgerRecord): boolean | null {
  if (record.host !== os.hostname()) return null; // 跨机器记录:本机无从探测
  const pid = record.ownerPid;
  if (!Number.isInteger(pid) || pid <= 0) return null;
  if (pid === process.pid) return true; // 本进程自己写的
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    const code = errCode(e);
    if (code === 'ESRCH') return false;
    if (code === 'EPERM') return true; // 存在但无权探测
    return null;
  }
}

/**
 * **唯一的**状态判据(别处不得再写一份)。
 * 关键:终态字段为 null 时,绝不返回任何"成功/失败",只返回三种"没有终态"之一。
 */
export function classifyLedgerRecord(
  record: BackgroundLedgerRecord,
  ctx: { liveIds?: ReadonlySet<string> } = {},
): { state: LedgerDisplayState; basis: string | null } {
  if (record.terminal !== null) return { state: record.terminal, basis: null };
  if (ctx.liveIds?.has(record.id)) return { state: 'running-here', basis: null };
  const alive = probeOwnerAlive(record);
  if (alive === true) {
    return { state: 'owned-elsewhere', basis: null };
  }
  if (alive === false) {
    return {
      state: 'detached-unknown',
      basis: `owner process pid=${record.ownerPid}@${record.host} is gone and the ledger holds no terminal (outcome unknowable)`,
    };
  }
  return {
    state: 'outcome-unknown',
    basis: `cannot tell whether the owner process is still alive (host=${record.host || '(empty)'}, pid=${record.ownerPid}); ledger has no terminal`,
  };
}

/** 呈现文案:已记到的终态与"没有记到终态"各说各话,除 succeeded 外一律带上"不等于完成"。 */
export function ledgerStateLabel(state: LedgerDisplayState): string {
  switch (state) {
    case 'succeeded':
      return 'succeeded';
    case 'failed':
      return 'failed';
    case 'cancelled':
      return 'cancelled';
    case 'ended-unknown':
      return 'ended-unknown (process confirmed gone, exit outcome not recorded — NOT completed)';
    case 'detached-unknown':
      return 'detached-unknown (no terminal recorded, owner process gone — NOT completed)';
    case 'outcome-unknown':
      return 'outcome-unknown (no terminal recorded, liveness undetermined — NOT completed)';
    case 'owned-elsewhere':
      return 'owned-elsewhere (owner process still alive in another session — NOT completed)';
    case 'running-here':
      return 'running-here';
  }
}

function emptyCounts(): Record<LedgerDisplayState, number> {
  return {
    succeeded: 0,
    failed: 0,
    cancelled: 0,
    'ended-unknown': 0,
    'detached-unknown': 0,
    'outcome-unknown': 0,
    'owned-elsewhere': 0,
    'running-here': 0,
  };
}

/**
 * 结果是否已经确立。`ended-unknown` 与四档"没记到终态"都算**未确立** ——
 * 它们进 `unsettled`,被逐条点名,而不是只在一个总数里飘着。
 */
export function isOutcomeEstablished(state: LedgerDisplayState): boolean {
  return state === 'succeeded' || state === 'failed' || state === 'cancelled';
}

/** 读台账并出摘要。纯读:不写、不删、不派生。 */
export function summarizeLedger(ctx: { liveIds?: Iterable<string> } = {}): LedgerSummary {
  const text = readLedgerText();
  const { records, malformed } = foldRecords(text);
  const liveIds: ReadonlySet<string> = new Set(ctx.liveIds ?? []);
  const entries: LedgerEntryView[] = records
    .map((record) => ({ record, ...classifyLedgerRecord(record, { liveIds }) }))
    .sort((a, b) => b.record.startedAt.localeCompare(a.record.startedAt));
  const counts = emptyCounts();
  for (const e of entries) counts[e.state] += 1;
  return {
    path: ledgerFilePath(),
    total: entries.length,
    counts,
    entries,
    unsettled: entries.filter((e) => !isOutcomeEstablished(e.state)),
    malformedLines: malformed,
    oversize: oversizeOf(measure(text)),
  };
}

/**
 * **人工**清理出口:只有 `{ confirm: true }` 才动文件,且只搬走"已记到终态"的记录 ——
 * 没终态的那些是证据,永久保留(它们正是这一票要人看见的东西)。
 * 默认档(不带 confirm)一条不动并说明为什么。
 */
export function pruneLedger(opts: { confirm?: boolean } = {}): PruneResult {
  if (opts.confirm !== true) {
    return {
      ok: false,
      code: 'not-confirmed',
      message:
        'pruneLedger does not touch anything by default: ledger cleanup is a manual action, pass { confirm: true } to run it. ' +
        'Records without a terminal state are never removed even then (they are the only trace of where a task went).',
    };
  }
  const file = ledgerFilePath();
  const text = readLedgerText();
  const { records } = foldRecords(text);
  const terminal = records.filter((r) => r.terminal !== null);
  const retained = records.filter((r) => r.terminal === null);
  if (terminal.length === 0) {
    return { ok: false, code: 'nothing-to-prune', message: `no settled record to prune: ${file}` };
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const archivePath = path.join(path.dirname(file), `${path.basename(file, '.jsonl')}.archive-${stamp}.jsonl`);
  const archiveBody = `${terminal.map((r) => `${JSON.stringify(r)}\n`).join('')}`;
  try {
    commitAtomicWrite(captureWriteBaseline(archivePath), archiveBody);
  } catch (e) {
    const msg = `[bg-ledger] archive write failed, ledger left untouched: ${archivePath} — ${e instanceof Error ? e.message : String(e)}`;
    pushAlert(msg);
    return { ok: false, code: 'io-error', message: msg };
  }
  const kept = `${retained.map((r) => `${JSON.stringify(r)}\n`).join('')}`;
  try {
    commitAtomicWrite(captureWriteBaseline(file), kept);
  } catch (e) {
    const msg = `[bg-ledger] ledger rewrite failed (archive already at ${archivePath}, ledger NOT emptied): ${e instanceof Error ? e.message : String(e)}`;
    pushAlert(msg);
    return { ok: false, code: 'io-error', message: msg };
  }
  const msg = `pruned ${terminal.length} settled record(s) into ${archivePath}, retained ${retained.length} unsettled record(s).`;
  pushAlert(`[bg-ledger] manual prune: ${msg}`);
  return { ok: true, archived: terminal.length, retained: retained.length, archivePath, message: msg };
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
