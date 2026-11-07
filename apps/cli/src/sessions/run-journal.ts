// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话断点续跑日志(Run Journal) — 把一轮里每个工具调用的生命周期落到
 * ~/.ihui/sessions/<sessionId>.run-journal.json,为 `--resume` 提供
 * "哪些步骤已完成、哪些副作用状态未知"的判据(接线由 agent 循环消费)。
 *
 * 设计理由(借鉴 src/sessions/state-store.ts 与 src/compaction-timeline-resume.ts):
 *   - 文件即数据库,JSON 直读直写;单用户单写者,不需要锁和 CAS;
 *   - 写侧原子:先写同目录临时文件再 renameSync,杀掉进程也留不下一份半截 JSON
 *     (半截 JSON 在 resume 侧等于"账本读不出来",会把已完成步骤当没做过);
 *   - 读侧保守:日志是辅助账本,损坏只 console.warn 并返回 null(按无日志从头跑),
 *     绝不 throw 把 CLI 崩在恢复路径上;只有非法 sessionId(路径穿越)当场 throw,
 *     那是调用方用错,必须拒绝而不是污染 sessions 目录;
 *   - 状态机 3 态:planned → started → settled。进程被杀后 started 一律降级为
 *     unknown —— "工具是否已经产生副作用"不可知,这是禁止自动重放的唯一依据;
 *   - 只存 outputExcerpt(≤2000 字符):恢复时回灌上下文,大输出不写盘。
 *
 * 时间戳一律由调用方用 now 参数钉死(不传才取系统时钟),便于测试与回放。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { createHash, randomUUID } from 'node:crypto';

export type RunJournalStatus = 'running' | 'completed' | 'interrupted';
export type JournalCallStatus = 'planned' | 'started' | 'settled' | 'unknown';

export interface JournalCall {
  seq: number;
  toolCallId: string;
  toolName: string;
  fingerprint: string;
  status: JournalCallStatus;
  ok?: boolean;
  outputExcerpt?: string;
  errorType?: string;
  startedAt?: string;
  settledAt?: string;
}

export interface JournalTurn {
  turn: number;
  startedAt: string;
  completedAt?: string;
  calls: JournalCall[];
}

export interface RunJournal {
  version: 1;
  sessionId: string;
  workspacePath: string;
  status: RunJournalStatus;
  startedAt: string;
  updatedAt: string;
  turns: JournalTurn[];
}

export interface ResumePlan {
  journalStatus: RunJournalStatus;
  /** 从哪一步续:turn + callSeq;全部已结算时指向下一轮 seq=0;无任何记录指到 turn 1 seq 0 */
  resumeFrom: { turn: number; callSeq: number };
  /** 判据:true 表示中断点没有副作用未知的调用,可直接续跑 */
  canAutoResume: boolean;
  completedCount: number;
  pendingCount: number;
  unknownCount: number;
  completed: Array<{ turn: number; seq: number; toolName: string }>;
  pending: Array<{ turn: number; seq: number; toolName: string }>;
  unknown: Array<{ turn: number; seq: number; toolName: string }>;
  summaryLines: string[];
}

const JOURNAL_VERSION = 1 as const;
const JOURNAL_SUFFIX = '.run-journal.json';
/** 恢复时回灌上下文的输出上限:够用即可,避免把大输出整段写进会话账本。 */
const OUTPUT_EXCERPT_LIMIT = 2000;
const RUN_JOURNAL_STATUSES: ReadonlySet<string> = new Set<RunJournalStatus>([
  'running',
  'completed',
  'interrupted',
]);
const CALL_STATUSES: ReadonlySet<string> = new Set<JournalCallStatus>([
  'planned',
  'started',
  'settled',
  'unknown',
]);

function nowIso(): string {
  return new Date().toISOString();
}

/** 与 state-store 的 sessions 目录同址;接线时也可显式传 baseDir 复用 getSessionStateDir()。 */
function defaultBaseDir(): string {
  return path.join(os.homedir(), '.ihui', 'sessions');
}

/**
 * sessionId 直接参与文件名,必须挡住路径分隔符与 `..`:
 * 否则 `--resume ../../x` 就能把日志写到 sessions 目录之外。
 */
function assertSafeSessionId(sessionId: string): void {
  if (sessionId.length === 0) {
    throw new Error('run journal: sessionId 不能为空');
  }
  if (sessionId.includes('/') || sessionId.includes('\\') || sessionId.includes('..') || sessionId.includes('\0')) {
    throw new Error(`run journal: sessionId 含非法路径字符: ${sessionId}`);
  }
}

export function runJournalPath(sessionId: string, baseDir?: string): string {
  assertSafeSessionId(sessionId);
  return path.join(baseDir ?? defaultBaseDir(), `${sessionId}${JOURNAL_SUFFIX}`);
}

/**
 * 原子写:临时文件 + renameSync(同目录 rename 在同一文件系统内才是原子的)。
 * 失败时清掉临时文件再原样抛 —— 保存是显式动作,失败要让调用方知道;
 * 与读侧"绝不 throw"不同,这里吞错会写出"看起来存了其实没存"的假象。
 */
export function saveRunJournal(journal: RunJournal, baseDir?: string): void {
  const target = runJournalPath(journal.sessionId, baseDir);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temp = `${target}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temp, JSON.stringify(journal, null, 2), 'utf-8');
    fs.renameSync(temp, target);
  } catch (error) {
    try {
      fs.rmSync(temp, { force: true });
    } catch {
      // 临时文件清不掉不影响主流程,下次写会换一个新的随机名
    }
    throw error;
  }
}

/**
 * 读日志:不存在 ⇒ null(没有可恢复的断点);读不到/损坏/结构不合法 ⇒
 * console.warn 后返回 null。日志坏了最多是"回到从头跑",不能把 CLI 崩掉。
 */
export function loadRunJournal(sessionId: string, baseDir?: string): RunJournal | null {
  const target = runJournalPath(sessionId, baseDir);
  let raw: string;
  try {
    raw = fs.readFileSync(target, 'utf-8');
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return null;
    console.warn(`[run-journal] 日志读取失败,按无日志处理: ${target} (${code ?? 'unknown'})`);
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`[run-journal] 日志损坏,已忽略并从头开跑: ${target} (${reason})`);
    return null;
  }
  const journal = normalizeJournal(parsed);
  if (journal === null) {
    console.warn(`[run-journal] 日志结构不合法(version 非 ${JOURNAL_VERSION}),已忽略并从头开跑: ${target}`);
    return null;
  }
  return journal;
}

/** 删除日志:幂等 —— 文件本来就不在也算删除成功(清理路径不该有存在性前置判断)。 */
export function deleteRunJournal(sessionId: string, baseDir?: string): void {
  fs.rmSync(runJournalPath(sessionId, baseDir), { force: true });
}

export function createRunJournal(sessionId: string, workspacePath: string): RunJournal {
  assertSafeSessionId(sessionId);
  const ts = nowIso();
  return {
    version: JOURNAL_VERSION,
    sessionId,
    workspacePath,
    status: 'running',
    startedAt: ts,
    updatedAt: ts,
    turns: [],
  };
}

/**
 * 稳定序列化 + sha256。包含 toolName:同参数不同工具必须是两个指纹,
 * 否则 `findSettledCall` 会把 read 的结论错配给 write。对象键排序保证
 * {a,b} 与 {b,a} 同指纹(JSON.stringify 的顺序依赖对象插入序)。
 */
export function computeToolFingerprint(toolName: string, args: unknown): string {
  const payload = `${toolName}\u0000${canonicalize(args, new Set<object>())}`;
  return createHash('sha256').update(payload, 'utf-8').digest('hex');
}

export function beginTurn(journal: RunJournal, turn: number, now?: string): JournalTurn {
  const ts = now ?? nowIso();
  const existing = findTurn(journal, turn);
  journal.status = 'running';
  journal.updatedAt = ts;
  if (existing !== undefined) {
    // 幂等:续跑同一轮时保留已记录调用,否则会丢掉"哪些已结算"的判据。
    return existing;
  }
  const created: JournalTurn = { turn, startedAt: ts, calls: [] };
  journal.turns.push(created);
  // 落盘按轮次有序,人读和排障都不需要自己再排。
  journal.turns.sort((a, b) => a.turn - b.turn);
  return created;
}

/**
 * 记录一个"已规划、尚未开始"的调用。缺少轮次时补建(而不是抛错):
 * 日志是辅助账本,写日志不能把主循环写崩。
 */
export function recordPlanned(
  journal: RunJournal,
  turn: number,
  call: { toolCallId: string; toolName: string; args: unknown },
  now?: string,
): JournalCall {
  const ts = now ?? nowIso();
  const targetTurn = findTurn(journal, turn) ?? beginTurn(journal, turn, ts);
  const planned: JournalCall = {
    seq: nextSeq(targetTurn),
    toolCallId: call.toolCallId,
    toolName: call.toolName,
    fingerprint: computeToolFingerprint(call.toolName, call.args),
    status: 'planned',
  };
  targetTurn.calls.push(planned);
  journal.status = 'running';
  journal.updatedAt = ts;
  return planned;
}

/** planned → started:副作用从这里开始可能落地。找不到记录只警告不抛(理由同 recordPlanned)。 */
export function recordStarted(journal: RunJournal, turn: number, seq: number, now?: string): void {
  const ts = now ?? nowIso();
  const call = findCall(journal, turn, seq);
  if (call === undefined) {
    console.warn(`[run-journal] recordStarted 找不到第 ${turn} 轮第 ${seq} 步的调用记录,已忽略`);
    return;
  }
  call.status = 'started';
  call.startedAt = ts;
  journal.status = 'running';
  journal.updatedAt = ts;
}

/** started → settled:结算结果 + 输出摘要(截断)落盘,供恢复时回灌上下文。 */
export function recordSettled(
  journal: RunJournal,
  turn: number,
  seq: number,
  outcome: { ok: boolean; output?: string; errorType?: string },
  now?: string,
): void {
  const ts = now ?? nowIso();
  const call = findCall(journal, turn, seq);
  if (call === undefined) {
    console.warn(`[run-journal] recordSettled 找不到第 ${turn} 轮第 ${seq} 步的调用记录,已忽略`);
    return;
  }
  call.status = 'settled';
  call.ok = outcome.ok;
  call.settledAt = ts;
  if (outcome.output !== undefined) {
    call.outputExcerpt = truncateExcerpt(outcome.output);
  }
  if (outcome.errorType !== undefined) {
    call.errorType = outcome.errorType;
  }
  journal.updatedAt = ts;
}

export function completeTurn(journal: RunJournal, turn: number, now?: string): void {
  const ts = now ?? nowIso();
  const targetTurn = findTurn(journal, turn);
  if (targetTurn === undefined) {
    console.warn(`[run-journal] completeTurn 找不到第 ${turn} 轮记录,已忽略`);
    return;
  }
  targetTurn.completedAt = ts;
  journal.updatedAt = ts;
}

/**
 * 只落"进程被中断"这一事实,不在这里动调用状态:
 * started → unknown 由 recoverInterruptedJournal 在下次启动时统一收敛,保证幂等。
 */
export function markJournalInterrupted(journal: RunJournal, now?: string): void {
  journal.status = 'interrupted';
  journal.updatedAt = now ?? nowIso();
}

export function markJournalCompleted(journal: RunJournal, now?: string): void {
  journal.status = 'completed';
  journal.updatedAt = now ?? nowIso();
}

/**
 * 进程恢复时对账:
 *   - running → interrupted;
 *   - 所有 started → unknown(工具是否已产生副作用未知,禁止自动重放);
 *   - settled 与 planned 原样保留(前者是已完成判据,后者从未开始可安全重放)。
 * 幂等:不依赖调用方是否先调用 markJournalInterrupted。
 * 不推进 updatedAt —— 恢复不是新活动,时钟由落盘前的调用方显式推进。
 */
export function recoverInterruptedJournal(journal: RunJournal): RunJournal {
  for (const turn of journal.turns) {
    for (const call of turn.calls) {
      if (call.status === 'started') call.status = 'unknown';
    }
  }
  if (journal.status === 'running') journal.status = 'interrupted';
  return journal;
}

/**
 * 恢复判据(纯读,不改 journal):
 *   - 按 turn 升序、seq 升序找第一个非 settled 的调用;
 *   - planned ⇒ pending,可安全重放(从未开始);
 *   - unknown ⇒ 禁止自动重放(副作用可能已落地);
 *   - 全部 settled ⇒ resumeFrom 指向下一轮 seq=0(含"某轮调用都结算了但
 *     completedAt 缺记"这种半成品轮次 —— 视为该轮已续完,不重跑)。
 */
export function planResume(journal: RunJournal | null): ResumePlan {
  if (journal === null) {
    // 没有日志 = 没有未完成的工作;从头开始是安全的(canAutoResume=true)。
    return {
      journalStatus: 'completed',
      resumeFrom: { turn: 1, callSeq: 0 },
      canAutoResume: true,
      completedCount: 0,
      pendingCount: 0,
      unknownCount: 0,
      completed: [],
      pending: [],
      unknown: [],
      summaryLines: [
        '无运行日志,从第 1 轮第 0 步续跑',
        '已完成 0 步,待重放 0 步,状态未知 0 步',
      ],
    };
  }

  const orderedTurns = [...journal.turns].sort((a, b) => a.turn - b.turn);
  const completed: ResumePlan['completed'] = [];
  const pending: ResumePlan['pending'] = [];
  const unknown: ResumePlan['unknown'] = [];
  let firstUnsettled: { turn: number; call: JournalCall } | null = null;

  for (const turn of orderedTurns) {
    for (const call of sortCalls(turn.calls)) {
      const item = { turn: turn.turn, seq: call.seq, toolName: call.toolName };
      if (call.status === 'settled') {
        completed.push(item);
        continue;
      }
      if (call.status === 'planned') pending.push(item);
      else unknown.push(item);
      if (firstUnsettled === null) firstUnsettled = { turn: turn.turn, call };
    }
  }

  const lastTurn = orderedTurns.length > 0 ? (orderedTurns[orderedTurns.length - 1]?.turn ?? 0) : 0;
  const resumeFrom =
    firstUnsettled === null
      ? { turn: lastTurn + 1, callSeq: 0 }
      : { turn: firstUnsettled.turn, callSeq: firstUnsettled.call.seq };

  // 只要有一只调用停在 started/unknown,重放到它前面就可能重复副作用。
  const canAutoResume = unknown.length === 0;

  const summaryLines: string[] = [
    `从第 ${resumeFrom.turn} 轮第 ${resumeFrom.callSeq} 步续跑`,
    `已完成 ${completed.length} 步,待重放 ${pending.length} 步,状态未知 ${unknown.length} 步`,
  ];
  for (const item of unknown) {
    summaryLines.push(
      `第 ${item.turn} 轮第 ${item.seq} 步 ${item.toolName} 状态未知:副作用可能已落地,禁止自动重放`,
    );
  }
  if (unknown.length > 0) {
    summaryLines.push('存在状态未知的调用,已禁止自动重放:请先人工确认副作用后再续跑');
  }

  return {
    journalStatus: journal.status,
    resumeFrom,
    canAutoResume,
    completedCount: completed.length,
    pendingCount: pending.length,
    unknownCount: unknown.length,
    completed,
    pending,
    unknown,
    summaryLines,
  };
}

/** 按 turn + fingerprint + 第 occurrence 次出现(0-based,seq 升序)查已结算调用。 */
export function findSettledCall(
  journal: RunJournal,
  turn: number,
  fingerprint: string,
  occurrence: number,
): JournalCall | undefined {
  return findCallByPredicate(journal, turn, fingerprint, occurrence, (call) => call.status === 'settled');
}

/** 同上,查 started/unknown 状态的调用(恢复后 started 已被收敛成 unknown)。 */
export function findUnknownCall(
  journal: RunJournal,
  turn: number,
  fingerprint: string,
  occurrence: number,
): JournalCall | undefined {
  return findCallByPredicate(
    journal,
    turn,
    fingerprint,
    occurrence,
    (call) => call.status === 'unknown' || call.status === 'started',
  );
}

/** seq 从 1 开始;0 是"该轮第一个调用之前"的哨兵(planResume 用 seq=0 表示从轮首开始)。 */
function nextSeq(turn: JournalTurn): number {
  let max = 0;
  for (const call of turn.calls) {
    if (call.seq > max) max = call.seq;
  }
  return max + 1;
}

function findTurn(journal: RunJournal, turn: number): JournalTurn | undefined {
  for (const candidate of journal.turns) {
    if (candidate.turn === turn) return candidate;
  }
  return undefined;
}

function findCall(journal: RunJournal, turn: number, seq: number): JournalCall | undefined {
  const targetTurn = findTurn(journal, turn);
  if (targetTurn === undefined) return undefined;
  for (const call of targetTurn.calls) {
    if (call.seq === seq) return call;
  }
  return undefined;
}

function sortCalls(calls: readonly JournalCall[]): JournalCall[] {
  return [...calls].sort((a, b) => a.seq - b.seq);
}

function findCallByPredicate(
  journal: RunJournal,
  turn: number,
  fingerprint: string,
  occurrence: number,
  predicate: (call: JournalCall) => boolean,
): JournalCall | undefined {
  if (!Number.isInteger(occurrence) || occurrence < 0) return undefined;
  const targetTurn = findTurn(journal, turn);
  if (targetTurn === undefined) return undefined;
  let seen = 0;
  for (const call of sortCalls(targetTurn.calls)) {
    if (call.fingerprint !== fingerprint || !predicate(call)) continue;
    if (seen === occurrence) return call;
    seen += 1;
  }
  return undefined;
}

/**
 * 截断到 2000 个 UTF-16 码元(JS 语义下的"字符")。
 * 若截断点落在代理对中间(末位是高位代理),退一格,避免回灌出半个 emoji。
 */
function truncateExcerpt(output: string): string {
  if (output.length <= OUTPUT_EXCERPT_LIMIT) return output;
  const head = output.slice(0, OUTPUT_EXCERPT_LIMIT);
  const lastUnit = head.charCodeAt(head.length - 1);
  if (lastUnit >= 0xd800 && lastUnit <= 0xdbff) return head.slice(0, -1);
  return head;
}

/**
 * 读侧结构校验:逐字段重建(顺带丢掉文件里多出来的未知字段),
 * 任何必填字段不合法 ⇒ 整份日志判为不可信(返回 null,按无日志处理)。
 */
function normalizeJournal(value: unknown): RunJournal | null {
  if (value === null || typeof value !== 'object') return null;
  const rec = value as Record<string, unknown>;
  if (rec.version !== JOURNAL_VERSION) return null;
  if (typeof rec.sessionId !== 'string' || rec.sessionId.length === 0) return null;
  if (typeof rec.workspacePath !== 'string') return null;
  if (typeof rec.status !== 'string' || !RUN_JOURNAL_STATUSES.has(rec.status)) return null;
  if (typeof rec.startedAt !== 'string' || typeof rec.updatedAt !== 'string') return null;
  if (!Array.isArray(rec.turns)) return null;

  const turns: JournalTurn[] = [];
  for (const rawTurn of rec.turns as unknown[]) {
    if (rawTurn === null || typeof rawTurn !== 'object') return null;
    const tr = rawTurn as Record<string, unknown>;
    if (typeof tr.turn !== 'number' || !Number.isInteger(tr.turn) || tr.turn <= 0) return null;
    if (typeof tr.startedAt !== 'string') return null;
    if (tr.completedAt !== undefined && typeof tr.completedAt !== 'string') return null;
    if (!Array.isArray(tr.calls)) return null;
    const calls: JournalCall[] = [];
    for (const rawCall of tr.calls as unknown[]) {
      const call = normalizeCall(rawCall);
      if (call === null) return null;
      calls.push(call);
    }
    const turn: JournalTurn = { turn: tr.turn, startedAt: tr.startedAt, calls };
    if (typeof tr.completedAt === 'string') turn.completedAt = tr.completedAt;
    turns.push(turn);
  }

  return {
    version: JOURNAL_VERSION,
    sessionId: rec.sessionId,
    workspacePath: rec.workspacePath,
    status: rec.status as RunJournalStatus,
    startedAt: rec.startedAt,
    updatedAt: rec.updatedAt,
    turns,
  };
}

function normalizeCall(value: unknown): JournalCall | null {
  if (value === null || typeof value !== 'object') return null;
  const rec = value as Record<string, unknown>;
  if (typeof rec.seq !== 'number' || !Number.isInteger(rec.seq) || rec.seq <= 0) return null;
  if (typeof rec.toolCallId !== 'string' || typeof rec.toolName !== 'string') return null;
  if (typeof rec.fingerprint !== 'string') return null;
  if (typeof rec.status !== 'string' || !CALL_STATUSES.has(rec.status)) return null;
  if (rec.ok !== undefined && typeof rec.ok !== 'boolean') return null;
  if (rec.outputExcerpt !== undefined && typeof rec.outputExcerpt !== 'string') return null;
  if (rec.errorType !== undefined && typeof rec.errorType !== 'string') return null;
  if (rec.startedAt !== undefined && typeof rec.startedAt !== 'string') return null;
  if (rec.settledAt !== undefined && typeof rec.settledAt !== 'string') return null;

  const call: JournalCall = {
    seq: rec.seq,
    toolCallId: rec.toolCallId,
    toolName: rec.toolName,
    fingerprint: rec.fingerprint,
    status: rec.status as JournalCallStatus,
  };
  if (typeof rec.ok === 'boolean') call.ok = rec.ok;
  if (typeof rec.outputExcerpt === 'string') call.outputExcerpt = rec.outputExcerpt;
  if (typeof rec.errorType === 'string') call.errorType = rec.errorType;
  if (typeof rec.startedAt === 'string') call.startedAt = rec.startedAt;
  if (typeof rec.settledAt === 'string') call.settledAt = rec.settledAt;
  return call;
}

/**
 * 稳定序列化:对象键排序、递归处理、循环引用打标记。
 * 不是 JSON:undefined/函数/symbol 用固定字面量占位,保证同一 args 永远同一指纹。
 */
function canonicalize(value: unknown, ancestors: Set<object>): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'bigint') return `${value.toString()}n`;
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
    return 'undefined';
  }
  if (typeof value !== 'object') return 'undefined';

  const obj: object = value;
  if (ancestors.has(obj)) return '"[circular]"';
  ancestors.add(obj);

  let serialized: string;
  if (Array.isArray(obj)) {
    const items: string[] = [];
    for (const item of obj as readonly unknown[]) {
      items.push(canonicalize(item, ancestors));
    }
    serialized = `[${items.join(',')}]`;
  } else {
    const record = obj as Record<string, unknown>;
    const parts: string[] = [];
    for (const key of Object.keys(record).sort()) {
      const field = record[key];
      // 与 JSON 一致:undefined 字段不参与序列化(避免 {a:1} 与 {a:1,b:undefined} 指纹分裂)。
      if (field === undefined) continue;
      parts.push(`${JSON.stringify(key)}:${canonicalize(field, ancestors)}`);
    }
    serialized = `{${parts.join(',')}}`;
  }

  ancestors.delete(obj);
  return serialized;
}
