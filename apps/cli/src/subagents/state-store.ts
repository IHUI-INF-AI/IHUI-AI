// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Subagent 状态持久化 — 把 subagent 运行状态写到 ~/.ihui/subagents/<id>.json,
 * 供 resumeFrom 断点续跑使用(对齐 AGENTS.md 第 12 节 subagent git 隔离规则)。
 *
 * 做减法:
 *   - 文件即数据库,JSON 直读直写,无锁(单用户场景足够)
 *   - 接口最小化:save/load/list/delete/prune
 *     (G-687/G-688 追加三件:reconcileOrphans 孤儿收敛 / read*+query* 三态查询 / 观察汇)
 *   - 状态词汇引用 types.ts 的唯一成员清单(`SubagentLifecycleStatus`),
 *     不在本文件再抄第二份 `running|completed|failed|cancelled` 名单。
 *     新增一档 `detached_idle`(转后台中间态,非终态)= 只改 types.ts 一处即传导到此。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { randomUUID } from 'node:crypto';
import { sessionStatusFromInstance, type AgentInstanceState } from '@ihui/types';
// G-719(2026-10-03):会话水合读侧唯一入口 —— 落库工具结果元数据的版本分账/剥后校验收敛在这一份。
import { hydrateToolStateMap } from '../sessions/tool-part-hydration.js';
import { isRecord } from '../util/json.js';
import type { SubagentLifecycleStatus } from './types.js';
import { SUBAGENT_LIFECYCLE_STATUSES, isSubagentTerminalStatus } from './types.js';

export interface SubagentState {
  id: string;
  parentId: string;
  persona: string;
  capabilityMode: string;
  isolation: string;
  worktreePath?: string;
  transcript: unknown[];
  toolState?: Record<string, unknown>;
  model?: string;
  /** 生命周期状态(唯一清单见 types.ts `SUBAGENT_LIFECYCLE_STATUSES`) */
  status: SubagentLifecycleStatus;
  startedAt: string;
  endedAt?: string;
  error?: string;
  /**
   * G-687 专属失败编码 —— 与 `status` **正交**:`status` 说"落到哪个终态",
   * 本字段说"因何而终"。进程被杀遗留的行由 `reconcileOrphans()` 写这一档。
   *
   * 词表不另起炉灶:`'interrupted'` 是 `@ihui/types` 的 `AGENT_INSTANCE_STATES`(D103 实例七态)
   * 的成员,经 `Extract<>` 取用 —— 该词汇若删掉这一档,本行会编译失败而不是静默漂走。
   * 它**刻意既不等于脚本失败(`errored`)也不等于用户取消**(`shutdown`/`notFound`),
   * 同码会让"进程被外部杀死"与"脚本自己报错"在响应上长得一样(本仓记过多次的静默失真型)。
   */
  failureCode?: SubagentInterruptCode;
}

const STATE_DIR_ENV = 'IHUI_SUBAGENT_STATE_DIR';

export function getSubagentStateDir(): string {
  if (process.env[STATE_DIR_ENV]) return process.env[STATE_DIR_ENV]!;
  return path.join(os.homedir(), '.ihui', 'subagents');
}

export function getSubagentStatePath(id: string): string {
  return path.join(getSubagentStateDir(), `${id}.json`);
}

function ensureStateDir(): void {
  fs.mkdirSync(getSubagentStateDir(), { recursive: true });
}

export function newSubagentId(): string {
  return randomUUID();
}

export function saveSubagentState(state: SubagentState): void {
  // 先登记"本进程名下在飞",再收敛孤儿:resumeFrom 复用同一 id 时,不得把自己正接着跑的行判成孤儿。
  if (isSubagentTerminalStatus(state.status)) inFlightRows.delete(state.id);
  else inFlightRows.add(state.id);
  // G-687:本进程首次为该父会话落状态 = 该父会话"在本实例名下零在飞"那一刻 ⇒ 先收敛孤儿再写。
  // 边界③:收敛自身永不抛(见 reconcileOrphans),所以它不会把一次正常保存拖成启动失败。
  reconcileOnceForParent(state.parentId);
  // 持久化能力缺席(目录建不出 / 盘写不进)⇒ 原样抛出,**绝不静默退回内存实现**:
  // 内存兜底会让"这次跑完的东西"看起来成功而实际永久丢失,那比一次报错严重(G-688 大声降级条)。
  writeStateRow(state);
}

/** 行落盘的唯一原语(不含收敛钩子,供 reconcile 自身复用 ⇒ 不会递归回 save 入口)。 */
function writeStateRow(state: SubagentState): void {
  ensureStateDir();
  const p = getSubagentStatePath(state.id);
  fs.writeFileSync(p, JSON.stringify(state, null, 2), 'utf-8');
}

/**
 * 单行读取的三态出口(G-688)。`loadSubagentState` 是它的投影,不再是判据本体。
 *
 * 三种结论必须在**类型**上可分,否则调用方拿不到"该不该据此降级"的信息:
 *   · `{stateKnown:true, state: 行}`     = 查到了
 *   · `{stateKnown:true}`               = **确实没有**(文件不存在 / 目录没建过)
 *   · `{stateKnown:false, reason,…}`    = **查不到**(读到内容但判不出形状/解析失败)
 * 第三档的 `state` 字段**缺席**(不是 `null`、不是空对象)—— "把没判写成判过了"是本仓最高频失效型。
 */
export function readSubagentState(id: string): SubagentStateReadResult {
  const p = getSubagentStatePath(id);
  let raw: string;
  try {
    if (!fs.existsSync(p)) return { stateKnown: true };
    raw = fs.readFileSync(p, 'utf-8');
  } catch (e) {
    // 存在性与读取之间被抢删 / EACCES / EISDIR:这一行**判不出**,不得读成"没有这条"
    return { stateKnown: false, reason: 'unreadable', detail: describeError(e) };
  }
  const decoded = decodeStateRow(raw);
  if (!decoded.ok) return { stateKnown: false, reason: 'unreadable', detail: decoded.detail };
  return { stateKnown: true, state: decoded.state };
}

/**
 * 兼容投影(G-688 之前只有这一档):查不到 与 确实没有 **同形返回 null**。
 * 新代码请用 readSubagentState;保留本函数只为不砸既有调用方(tools/subagent.ts 的 resumeFrom)。
 */
export function loadSubagentState(id: string): SubagentState | null {
  const r = readSubagentState(id);
  return r.stateKnown ? r.state ?? null : null;
}

/**
 * 集合查询的三态出口(G-688)。`listSubagentStates` 是它的投影,不再是判据本体。
 *
 * 两档必须类型上可分:
 *   · `{statesKnown:true, states:[]}`  = **确实没有**(目录尚未建过 = 全新安装)
 *   · `{statesKnown:false, reason,…}`  = **查不到**(目录存在却枚举不了:EACCES/ENOTDIR/IO)
 * 第三态"部分判不出"不进 `statesKnown:false`(枚举本身成功了,集合完整),而是并列在
 * `unreadable` 里点名 —— 那些行**不参与收敛判定**:"读不出它的状态"永远不等于"它不是孤儿"。
 *
 * 判不出 ⇒ 大声降级(stderr warn 一行并点名原因),但**绝不**因此退回内存副本继续跑。
 */
export function querySubagentStates(
  parentId?: string,
  deps: { warn?: (msg: string) => void } = {},
): SubagentStatesQueryResult {
  const warn = deps.warn ?? defaultWarn;
  const dir = getSubagentStateDir();
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return { statesKnown: true, states: [], unreadable: [] };
    const detail = describeError(e);
    warn(`subagent 状态目录枚举失败(集合不可判定,本轮不收敛任何行):${dir} — ${detail}`);
    return { statesKnown: false, reason: 'unreadable', detail };
  }
  const states: SubagentState[] = [];
  const unreadable: string[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.json')) continue;
    const id = entry.slice(0, -'.json'.length);
    const r = readSubagentState(id);
    if (!r.stateKnown) {
      unreadable.push(id);
      // 单行判不出也必须喊:静默跳过会让"少了一行"读成"本来就没有这一行"
      warn(`subagent 状态行判不出(跳过,不收敛也不计入集合):${id} — ${r.detail}`);
      continue;
    }
    const s = r.state;
    if (!s) continue;
    if (parentId && s.parentId !== parentId) continue;
    states.push(s);
  }
  return { statesKnown: true, states, unreadable };
}

/**
 * 兼容投影(G-688 之前的形态):"查不到"与"没有"**同形返回 `[]`**。
 * 新代码请用 querySubagentStates;本投影保留只为不砸既有调用方与既有断言。
 */
export function listSubagentStates(parentId?: string): SubagentState[] {
  const r = querySubagentStates(parentId);
  return r.statesKnown ? r.states : [];
}

export function deleteSubagentState(id: string): boolean {
  const p = getSubagentStatePath(id);
  if (!fs.existsSync(p)) return false;
  fs.unlinkSync(p);
  return true;
}

export function pruneOldSubagentStates(maxAgeMs: number): number {
  const dir = getSubagentStateDir();
  if (!fs.existsSync(dir)) return 0;
  const now = Date.now();
  let removed = 0;
  for (const entry of fs.readdirSync(dir)) {
    if (!entry.endsWith('.json')) continue;
    const id = entry.slice(0, -'.json'.length);
    const s = loadSubagentState(id);
    if (!s) continue;
    const startedAtMs = Date.parse(s.startedAt);
    if (Number.isNaN(startedAtMs)) continue;
    if (now - startedAtMs > maxAgeMs) {
      if (deleteSubagentState(id)) removed++;
    }
  }
  return removed;
}

// ═════════════════ G-687 孤儿收敛(挂在构造时刻) + G-688 三态查询面 / 观察汇 ═════════════════

/**
 * G-687 专属失败编码。词表不另起炉灶:`'interrupted'` 是 `@ihui/types` 的
 * `AGENT_INSTANCE_STATES`(D103 子智能体实例七态)的成员,经 `Extract<>` 取用 ——
 * 该词汇若删掉这一档,这里会**编译失败**而不是静默漂走。
 *
 * 它刻意既不等于脚本失败(`errored`)也不等于用户取消(`shutdown`/`notFound`):
 * 同码会让"进程被外部杀死"与"脚本自己报错"在响应上完全同形,
 * 于是重试策略与用户提示都读到假归因(本仓"计数要取库确认集"是同一条纪律的另一半)。
 */
export type SubagentInterruptCode = Extract<AgentInstanceState, 'interrupted'>;
export const SUBAGENT_INTERRUPT_CODE: SubagentInterruptCode = 'interrupted';

/**
 * 孤儿行的终态落点。**映射不在本文件写死**:`sessionStatusFromInstance` 是
 * `@ihui/types` 里"实例态 → 会话/生命周期态"的唯一出口(其 switch 不穷尽会编译失败),
 * 所以 `interrupted → cancelled` 这一格只有一份真相;将来上游改映射,这里自动跟着走。
 */
export const SUBAGENT_ORPHAN_TERMINAL_STATUS: SubagentLifecycleStatus =
  sessionStatusFromInstance(SUBAGENT_INTERRUPT_CODE);

/** 孤儿行的归因文案(进 `error` 字段,只在原行没有更具体的错误时写)。 */
const ORPHAN_RECONCILE_MESSAGE =
  '上一实例进程被中断(非脚本失败、非用户取消);本实例于构造时刻收敛该行为终态 — G-687';

/** G-688:单行"查不到"的原因档(唯一清单,消费端不得内联第二份)。 */
export type SubagentReadFailure = 'unreadable';

/** G-688:集合"查不到"的原因档。 */
export type SubagentStatesQueryFailure = 'unreadable';

/**
 * G-688 单行三态:
 *   · `{stateKnown:true, state:行}`  = 查到了
 *   · `{stateKnown:true}`            = **确实没有**(文件/目录不存在 = 一个可判定的否定)
 *   · `{stateKnown:false, …}`        = **查不到**(存在却读不出/判不出形状)
 * 第三档的 `state` 字段**缺席**(不是 null、不是空壳对象)。把"没判"写成"判过了"
 * 是本仓最高频的失效型:空数组与判不出同形时,下一层就会拿"没有孤儿"当结论。
 */
export type SubagentStateReadResult =
  | { stateKnown: true; state: SubagentState }
  | { stateKnown: true; state?: undefined }
  | { stateKnown: false; state?: undefined; reason: SubagentReadFailure; detail: string };

/**
 * G-688 集合三态:
 *   · `{statesKnown:true, states:[]}` = **确实没有**(目录尚未建过)
 *   · `{statesKnown:false, …}`        = **查不到**(目录在但枚举失败),`states` 字段缺席
 * "集合完整但个别行判不出"不降到 `statesKnown:false`(枚举成功了),而是并列在
 * `unreadable` 里点名 —— 那些行**不参与收敛判定**:"读不出它的状态"永远不等于"它不是孤儿"。
 */
export type SubagentStatesQueryResult =
  | { statesKnown: true; states: SubagentState[]; unreadable: string[] }
  | { statesKnown: false; states?: undefined; reason: SubagentStatesQueryFailure; detail: string };

/**
 * 观察记录的一条(审计留痕,不是引擎事件)。
 * `senderId` = 归属身份;观察汇按它做闸门(见 createSubagentObservationSink)。
 */
export interface SubagentObservation {
  readonly kind: string;
  readonly senderId: string;
  readonly at: string;
  readonly subagentId?: string;
  readonly detail?: string;
}

/** 孤儿收敛审计观察的 kind(唯一声明处)。 */
export const SUBAGENT_OBSERVATION_KIND_ORPHAN_RECONCILED = 'subagent.orphan.reconciled' as const;

/** 观察汇拒收的四种原因(唯一清单)。 */
export type SubagentObservationRejection =
  | 'malformed'
  | 'untrusted-sender'
  | 'capability-absent'
  | 'write-failed';

export type SubagentObservationOutcome =
  | { accepted: true }
  | { accepted: false; reason: SubagentObservationRejection; detail?: string };

/** 观察汇接口:唯一动作是 observe,且**永不抛**(结论一律走返回值)。 */
export interface SubagentObservationSink {
  observe(raw: unknown): SubagentObservationOutcome;
}

export interface SubagentObservationSinkDeps {
  /** 按 sender 的身份闸门信任名单;空名单 ⇒ 一律拒收(保守向,绝不"名单空=都放行")。 */
  readonly trustedSenderIds: readonly string[];
  /** 落点。**缺席 = 观察能力不存在** ⇒ 大声降级,不允许静默退回内存副本(见实现注释)。 */
  readonly write?: (obs: SubagentObservation) => void;
  readonly warn?: (msg: string) => void;
}

/**
 * 观察汇唯一工厂(G-688)。三条不可漂的口径:
 *  1. **永不抛**:三条出口一律返回结论;"观察汇自己变成故障源"是本票要防的原型形态。
 *  2. **按 sender 的身份闸门**:不在信任名单 ⇒ 拒收,且写口**一次都不调用**(副作用没发生)。
 *  3. **能力缺席 ⇒ 大声降级**:没有 `write` 落点时喊一行 + `capability-absent`,
 *     **禁止**在内存里攒队列冒充"收到了" —— 内存副本进程一死就没了,而账面读起来像已落盘,
 *     那正是"静默退回会丢数据的内存实现"这一型。
 */
export function createSubagentObservationSink(deps: SubagentObservationSinkDeps): SubagentObservationSink {
  const warn = deps.warn ?? defaultWarn;
  return {
    observe(raw: unknown): SubagentObservationOutcome {
      if (
        !isRecord(raw) ||
        typeof raw.kind !== 'string' ||
        typeof raw.senderId !== 'string' ||
        typeof raw.at !== 'string'
      ) {
        return { accepted: false, reason: 'malformed', detail: '观察记录缺 kind/senderId/at 之一或非字符串' };
      }
      const obs: SubagentObservation = {
        kind: raw.kind,
        senderId: raw.senderId,
        at: raw.at,
        subagentId: typeof raw.subagentId === 'string' ? raw.subagentId : undefined,
        detail: typeof raw.detail === 'string' ? raw.detail : undefined,
      };
      if (!deps.trustedSenderIds.includes(obs.senderId)) {
        return {
          accepted: false,
          reason: 'untrusted-sender',
          detail: `sender=${obs.senderId} 不在信任名单(${deps.trustedSenderIds.length} 项)内`,
        };
      }
      const write = deps.write;
      if (!write) {
        warn(`subagent 观察汇无落点(能力缺席),本次观察丢弃且不退回内存:kind=${obs.kind} sender=${obs.senderId}`);
        return { accepted: false, reason: 'capability-absent' };
      }
      try {
        write(obs);
      } catch (e) {
        const detail = describeError(e);
        warn(`subagent 观察汇写入失败(不抛给调用方):kind=${obs.kind} — ${detail}`);
        return { accepted: false, reason: 'write-failed', detail };
      }
      return { accepted: true };
    },
  };
}

/** 收敛一次的注入点(全部可选;缺省走真实落盘 + stderr 审计)。 */
export interface OrphanReconcileDeps {
  /** 行写入原语(默认 writeStateRow;测试注入以证"写入抛错时构造仍成功")。 */
  readonly writeRow?: (state: SubagentState) => void;
  /** 审计观察落点(默认 stderr)。 */
  readonly auditWrite?: (obs: SubagentObservation) => void;
  readonly warn?: (msg: string) => void;
  /**
   * 引擎事件派发口(边界②"不合成引擎事件")。**本模块永不调用它**。
   * 它存在的唯一理由是让这条边界可被机器断言:测试注入 spy 并断言零调用,
   * 另有源码锁判"state-store.ts 遮注释后的代码面里不得出现对本口的调用"。
   */
  readonly engineEventPort?: (name: string, payload: unknown) => void;
}

/** 被收敛的一行(只留判据要看的三件事)。 */
export interface OrphanReconciledRow {
  readonly id: string;
  readonly from: SubagentLifecycleStatus;
  readonly to: SubagentLifecycleStatus;
  readonly failureCode: SubagentInterruptCode;
}

/** 一轮收敛的结论。三态绝不并桶:reconciled / skippedInFlight / skippedUnreadable / writeFailures 各一格。 */
export interface OrphanReconcileReport {
  parentId: string;
  reconciled: OrphanReconciledRow[];
  /** 本进程自己名下仍在飞的行(刻意不动)。 */
  skippedInFlight: string[];
  /** 判不出的行(unknown ≠ 孤儿)。 */
  skippedUnreadable: string[];
  /** 可判定的本父会话行数。 */
  enumerated: number;
  /** 集合本身是否可判定(false ⇒ 整轮未做任何写,等下一次触碰重试)。 */
  enumeratedKnown: boolean;
  writeFailures: Array<{ id: string; detail: string }>;
  /** 边界③:读写失败的降级点全部留名(只 warn,不改构造结论)。 */
  warnings: string[];
  /** 边界②:恒 0,且由"spy 零调用 + 源码锁"两条独立判据共同证明,不是自说自话。 */
  engineEventsDispatched: 0;
}

/** 本进程名下仍在飞(由本进程写下且非终态)的行 id —— 收敛时必须跳过,否则杀活人。 */
const inFlightRows = new Set<string>();
/** 本进程已收敛过的父会话 —— "二次构造天然幂等"的载体。 */
const reconciledParents = new Set<string>();

function describeError(e: unknown): string {
  return e instanceof Error ? `${e.name}: ${e.message}` : String(e);
}

type DecodedStateRow = { ok: true; state: SubagentState } | { ok: false; detail: string };

/**
 * 行形状守卫:只校验**判定所需**的三字段(id / parentId / status)。
 * status 必须落在 types.ts 那份唯一清单内 —— 不在清单内的字符串是"判不出",
 * 不是"非终态 ⇒ 是孤儿"(把未知值默认当非终态会让一次脏写入换来一次误杀)。
 * 其余字段按既有契约原样透传,不在这里收窄(resumeFrom 依赖 transcript/toolState 完整)。
 */
function decodeStateRow(raw: string): DecodedStateRow {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { ok: false, detail: `JSON 解析失败:${describeError(e)}` };
  }
  if (!isRecord(parsed)) return { ok: false, detail: '顶层不是对象' };
  if (typeof parsed.id !== 'string' || parsed.id.length === 0) {
    return { ok: false, detail: 'id 字段缺失或非字符串' };
  }
  if (typeof parsed.parentId !== 'string') {
    return { ok: false, detail: 'parentId 字段缺失或非字符串' };
  }
  if (
    typeof parsed.status !== 'string' ||
    !(SUBAGENT_LIFECYCLE_STATUSES as readonly string[]).includes(parsed.status)
  ) {
    return { ok: false, detail: `status 不在唯一清单内:${String(parsed.status ?? '(缺席)')}` };
  }
  // G-719:水合落库工具结果元数据(唯一入口)。降级条目剥 display 保外层,
  // 绝不因元数据不合法让整行读不出来(resume 依赖 toolState 完整)。
  const { toolState, report } = hydrateToolStateMap(parsed['toolState'] as Record<string, unknown> | undefined);
  if (report.degraded > 0) {
    defaultWarn(
      `[subagent-state] ${parsed.id as string} toolState 水合降级 ${report.degraded} 条:` +
        report.degradedEntries.map((d) => `${d.key}(${d.reason})`).join(', '),
    );
  }
  if (parsed['toolState'] !== undefined) parsed['toolState'] = toolState;
  return { ok: true, state: parsed as unknown as SubagentState };
}

const defaultWarn = (msg: string): void => {
  try {
    process.stderr.write(`[subagent-state] WARN ${msg}\n`);
  } catch (e) {
    // stderr 本身写不出去(句柄被关闭/重定向)时无处可喊,但绝不让"喊"这个动作改结论。
    void e;
  }
};

const defaultAuditWrite = (obs: SubagentObservation): void => {
  process.stderr.write(
    `[subagent-state] observation kind=${obs.kind} sender=${obs.senderId} ` +
      `subagent=${obs.subagentId ?? '-'} at=${obs.at}\n`,
  );
};

/**
 * G-687 孤儿收敛。**挂在构造时刻**的理由(也是本票的判据本体):
 * 进程被杀遗留的非终态行,只在"本实例名下零在飞"那一刻可判定 —— 晚一步(本进程已派生过
 * 子 agent)再问"这行为什么还是 running",答案就可能是"是我自己正在跑的那一条",
 * 那时收敛等于杀活人;早一步则集合还没建出来,判了个空。
 *
 * 三条边界:
 *  ① **只收敛本父会话**:`querySubagentStates(parentId)` 在枚举阶段就过滤掉了别人的行,
 *     判不出归属的行一律不动(见 skippedUnreadable)。
 *  ② **不合成引擎事件**:全程不碰 `engineEventPort`(hook/SSE 的派发口都在上层),
 *     留痕只走观察汇的审计 kind;由 `report.engineEventsDispatched` 恒 0 + 测试 spy + 源码锁三重证明。
 *  ③ **读写失败仅 warn 不拖垮启动**:目录判不出 / 单行写失败都只降级并点名,函数正常返回报告。
 *
 * 幂等:一行只有"非终态且不在本进程在飞集合"才会被写;写下去就是终态,
 * 所以第二次调用(以及 `openSubagentStateStore` 的二次构造)不再改任何行 —— 无需另设"已收敛"标记位。
 */
export function reconcileOrphans(parentId: string, deps: OrphanReconcileDeps = {}): OrphanReconcileReport {
  const warn = deps.warn ?? defaultWarn;
  const writeRow = deps.writeRow ?? writeStateRow;
  const report: OrphanReconcileReport = {
    parentId,
    reconciled: [],
    skippedInFlight: [],
    skippedUnreadable: [],
    enumerated: 0,
    enumeratedKnown: false,
    writeFailures: [],
    warnings: [],
    engineEventsDispatched: 0,
  };
  const note = (m: string): void => {
    report.warnings.push(m);
    warn(m);
  };
  const sink = createSubagentObservationSink({
    trustedSenderIds: [parentId],
    write: deps.auditWrite ?? defaultAuditWrite,
    warn: note,
  });

  // 边界③:querySubagentStates 内部已把"枚举失败"转成 statesKnown:false,不会抛到这里
  const query = querySubagentStates(parentId, { warn: note });
  if (!query.statesKnown) {
    note(`孤儿收敛整轮跳过:父会话 ${parentId} 的状态集合不可判定(${query.detail}),本轮不写任何行`);
    return report;
  }
  report.enumeratedKnown = true;
  report.enumerated = query.states.length;
  report.skippedUnreadable.push(...query.unreadable);

  const now = new Date().toISOString();
  for (const row of query.states) {
    if (isSubagentTerminalStatus(row.status)) continue;
    if (inFlightRows.has(row.id)) {
      report.skippedInFlight.push(row.id);
      continue;
    }
    const next: SubagentState = {
      ...row,
      status: SUBAGENT_ORPHAN_TERMINAL_STATUS,
      endedAt: row.endedAt ?? now,
      error: row.error ?? ORPHAN_RECONCILE_MESSAGE,
      failureCode: SUBAGENT_INTERRUPT_CODE,
    };
    try {
      writeRow(next);
    } catch (e) {
      // 边界③:写失败只降级 + 点名,不改本轮构造结论;行保持原样(绝不落半改写的状态)
      const detail = describeError(e);
      report.writeFailures.push({ id: row.id, detail });
      note(`孤儿收敛写入失败(仅降级,不拖垮构造):id=${row.id} — ${detail}`);
      continue;
    }
    // 已经落终态的行不再是"本进程在飞";同时把上一实例的脏账从集合里摘掉
    inFlightRows.delete(row.id);
    report.reconciled.push({
      id: row.id,
      from: row.status,
      to: next.status,
      failureCode: SUBAGENT_INTERRUPT_CODE,
    });
    const outcome = sink.observe({
      kind: SUBAGENT_OBSERVATION_KIND_ORPHAN_RECONCILED,
      senderId: parentId,
      subagentId: row.id,
      at: now,
      detail: `status ${row.status} → ${next.status} code=${SUBAGENT_INTERRUPT_CODE}`,
    });
    if (!outcome.accepted) {
      report.warnings.push(
        `孤儿收敛审计观察未落:${outcome.reason}${outcome.detail ? ` — ${outcome.detail}` : ''}`,
      );
    }
  }
  return report;
}

/**
 * 状态存储的"构造时刻"入口(G-687):每个父进程对同一 parentId 只会真收敛一次。
 * `saveSubagentState` 内部走它,上层(池构造 / 启动路径)也可显式调用 —— 两者共用**同一份**
 * 幂等集合,不得各立第二份"已收敛"标记(两处算同一件事必漂移)。
 */
export interface SubagentStateStoreHandle {
  readonly parentId: string;
  /** null = 本进程此前已对该父会话收敛过(二次构造,天然幂等,不再改任何行)。 */
  readonly orphans: OrphanReconcileReport | null;
}

export function openSubagentStateStore(
  parentId: string,
  deps: OrphanReconcileDeps = {},
): SubagentStateStoreHandle {
  return { parentId, orphans: reconcileAtConstruction(parentId, deps) };
}

/** saveSubagentState 的收敛钩子(默认注入,不接受外部 deps 以免与生产写路径分叉)。 */
function reconcileOnceForParent(parentId: string): OrphanReconcileReport | null {
  return reconcileAtConstruction(parentId);
}

/**
 * 销号条件的**唯一实现**(两处构造入口共用;两处各写一遍必然漂开)。
 * 只在"集合可判定 且 本轮没有想改却没改成的行"时销号:
 * 一次瞬时 IO 故障或半轮写失败都不该把该父会话永久锁在"不再尝试收敛",
 * 否则孤儿行会一直挂在 running,下一次 resumeFrom 就把死行当活行接着跑。
 */
function reconcileAtConstruction(
  parentId: string,
  deps: OrphanReconcileDeps = {},
): OrphanReconcileReport | null {
  if (reconciledParents.has(parentId)) return null;
  const report = reconcileOrphans(parentId, deps);
  if (report.enumeratedKnown && report.writeFailures.length === 0) reconciledParents.add(parentId);
  return report;
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
