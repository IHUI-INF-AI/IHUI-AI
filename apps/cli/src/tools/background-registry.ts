// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 后台任务注册表 — 管理异步 spawn 进程的生命周期与状态。
 *
 * 灵感来源:参考行业 Agent 框架的 background commands + opencode 的 /loop。
 * 简化策略(做减法):
 *   - 模块级 Map 管理任务(内存表在进程退出时消失),但**每一次生命周期事件都落一条台账**
 *     —— 见 `./background-ledger.ts`("只报不恢复"):重启后这些任务能被看见,判成
 *     `detached-unknown`,不会被渲染成完成,也不会被自动重跑。
 *   - 进程退出后保留最近 100 个已完成任务(供 get_command_output 查询)
 *   - 不引入 cron 库,/loop 用 setInterval
 */

import type { ChildProcess } from 'node:child_process';
import * as crypto from 'node:crypto';
// Worktree 并行隔离层:后台任务结束后自动清理其 worktree
import { cleanupWorktree } from './worktree.js';
// 跨进程台账(状态判据的唯一实现也在那里,本文件不再自己判"进程在不在")
import { recordHeartbeat, recordTaskSettle, recordTaskStart, type LedgerRecordedTerminal } from './background-ledger.js';
// 终态播报正文走语言包(AGENTS §30「后台进程的状态词汇是一等契约」+ 守门 70 的硬编码中文棘轮):
// 新增一档 = 同枚补齐五语言,而不是给文件加豁免或调基线。
import { t } from '../i18n/index.js';

// G-816003:终止词汇的**唯一真相源**在跨端契约包里(一张表 × 每消费面一列)。
// 本文件不再自拼任何一份同值字符串清单 —— 播报/名册/事件帧都从同一行取词。
import {
  BACKGROUND_TERMINATION_VOCAB,
  backgroundTerminationRowOf,
  type BackgroundResumeStance,
  type BackgroundTerminationVocabRow,
} from '@ihui/types';
// G-816001:分支代际计数器(G-632,零依赖模块)—— 条目代戳的章与唤醒入队面的比对判据
// 都只出自这里,不在本文件重写第二份"当前分支代"。
import { currentBranchGeneration, isBranchGenerationCurrent } from '../commands/branch-generation.js';

/**
 * 后台任务的可达状态(G-816025 补最后一档 `lost`)。
 *
 * `lost` 不是"失败的另一种写法":它标的是**结果永远拿不回来** —— 进程已经不在、
 * 内容一点没留下、退出码也没记到、当场还没有等待者能把终态接走。此前这一格落在
 * `exited + exitCode:null` 上,与"跑完了且我们没拿到码"同形,台账另有 `ended-unknown`
 * 承接它(见 `toLedgerTerminal`),而注册表面**没有档可写** —— 票面称之"按哪一档写没有定义"。
 *
 * 刻意与 `packages/types` 的两套对外契约值域**无关**(不扩那边、也不借那边的名字):
 * `AGENT_TASK_STATUSES` 六档 = triage/todo/ready/in_progress/blocked/done,
 * 第二域四档 = running/completed/failed/canceled —— 两边都不含 `lost`,
 * 所以这一档不触碰落库列 / REST `z.enum` / SSE 载荷(守门 151 SV2 的两域不相交判据照旧成立)。
 * 同族先例:`apps/cli/src/stream-tool-ledger.ts:33` 的 `LedgerState` 早就有 `lost`,
 * 是另一个域(流式工具台账),两处不是同一件事的两种写法。
 */
export type BackgroundTaskStatus = 'running' | 'exited' | 'killed' | 'error' | 'lost';

/**
 * G-816029 级联结算的**原因档**(与上游 `sealBackgroundTaskNotifications` 的 reason 同值域):
 *  - `subagent_cancelled`:子代理被停(父级 abort 落下 / 子代理落 cancelled);
 *  - `subagent_terminal` :子代理没正常完成就结束了(failed)—— task_id 只在它自己的
 *    context 里,父级拿不到,不清就是孤儿。
 * 只有这两档;「正常完成」不进本类型(那一支根本不级联,由 `resolveSubagentCascadeReason`
 * 的 undefined 档表达 —— 级联写成无条件清账就是把长跑任务杀了)。
 */
export type BackgroundCascadeReason = 'subagent_cancelled' | 'subagent_terminal';

export interface BackgroundTask {
  id: string;
  /**
   * G-654② —— **登记身份(代际 token)**:每一次 `registerTask`/`registerFailedTask`
   * 现场生成,终生不变。它回答的是"这个 key 上现在站着的是不是**我这一轮**"。
   *
   * 为什么 `id` 不够:`id` 是可复用的键(`genId()` = `Date.now()` + 3 随机字节,
   * 本文件 `notified` 字段的注释早就登记过"pruneCompleted() 之后同 id 复用是真路径"),
   * 而"按 id 删/按 id 投递"在键被复用时会拿**上一轮**的迟到终态去清**这一轮**的登记 ——
   * 表现是"新任务的等待者再也没收到终态",与本文件反对的每一件事同名。
   * 所以删除与投递一律要身份匹配;不匹配就**不动**,并计入 `getRemovalGuardStats()`。
   *
   * 刻意**不**进 `BackgroundTaskSnapshot` 的 Pick 清单:代际是本注册表的内部账,
   * 不是给模型读的任务结果。
   */
  identity: string;
  command: string;
  process: ChildProcess | null;
  startedAt: string;
  exitedAt?: string;
  exitCode?: number | null;
  status: BackgroundTaskStatus;
  /**
   * **尾部窗口**(G-937959):保留**最后** TASK_OUTPUT_TAIL_BYTES 字符 —— 终态视图读这里,
   * 结论/报错在输出末尾。旧实现这里保留的是头部,超限任务的收场反而读不到。
   */
  stdoutBuf: string;
  /** 同 stdoutBuf:stderr 的尾部窗口。 */
  stderrBuf: string;
  /** **头部窗口**:前 TASK_OUTPUT_RUNNING_BASH_PREFIX_BYTES 字符,运行中视图读这里(含第 1 行)。 */
  stdoutHead: string;
  stderrHead: string;
  /** 累计产出量(字符,两窗口记账的分母):省略量 = total − 所选窗口长度,读时现算。 */
  totalStdoutChars: number;
  totalStderrChars: number;
  truncated: boolean;
  /**
   * 尾窗(TASK_OUTPUT_TAIL_BYTES)之外的输出量(下界,按字符计)= 终态视图的省略量;
   * 运行中视图的省略量(total − 头窗)在投影时按 total* 现算,不占这个字段。
   * G-816028:截断必须能回答"省略了多少"—— 只立一个布尔,模型会把截断文本当全貌。
   */
  droppedStdoutBytes: number;
  droppedStderrBytes: number;
  timedOut: boolean;
  /**
   * 谁主动停的(G-816026):只能由 `killTask(id, initiator)` 落盘,close 处理器只读不猜。
   * 三态互斥:有发起方 ⇒ 主动停;无发起方的信号终止 ⇒ 外部(OOM/别的进程),发起方记
   * undefined;超时档只能由 deadline 持有者显式置 `timedOut=true`,绝不按 signal 形状反推。
   */
  stopInitiator?: 'user' | 'model' | null;
  /**
   * G-816029 **归属**:这枚任务是替哪个 agent 派生的(子代理 = 它自己的 subagentId;
   * REPL/主会话派生的任务**不带此字段** —— 无归属永远不参与级联,那是"级联不是清全场"
   * 的载体)。只在 `registerTask` 时由调用方给出,登记后不再改写:归属是登记事实,
   * 不是运行时可迁移的状态。**刻意进快照** —— 等待者要能读到"这是替谁派生的"。
   */
  ownerAgentId?: string;
  /**
   * G-816029 **谁替它收的场**:只有 `settleTasksOwnedByAgent` 在**发信号之前**落这一档
   * (与 `stopInitiator` 同一条"写在 abort 之前"判据 —— close 是异步的,晚写就读不到)。
   * 台账 note(`settled by <reason>`)与终态快照都从它取词,于是"级联收的"与"外部 OOM 杀"
   * 在账面上不同形。已经终态的条目**不贴**这一档 —— 那是把"它自己跑完了"改写成
   * "我替它收的"(终态单向门的同一条,见 settleTasksOwnedByAgent 的 ⑦ 用例)。
   * **进快照**:等待者据此分辨"这条终态是级联发出的,档位是哪一档"。
   */
  settledBy?: BackgroundCascadeReason;
  /**
   * 「已投递」位 —— 终态快照有没有已经交给过等待者(G-814418 判据①)。
   *
   * 它必须是**任务对象上的一个位**而不是 `Map<id, boolean>`:id 由 `genId()` 生成
   * (`Date.now()` + 3 随机字节),`pruneCompleted()` 之后同 id 复用是真路径,而按 id 记账
   * 会把**上一轮生命周期**的"已投递"顶到新任务头上 —— 新任务的等待者就永远收不到终态,
   * 只能等自己的 deadline 报 `timed-out-unknown`(把一个其实会结束的任务报成不知道)。
   * 上游同族实现(ZCode `background-task-registry.ts:168-192`)把这个位放在条目上、
   * 并在"重臂"(同 id 开新的一轮)时显式复位,判的是同一件事。
   *
   * 刻意**不**进 `BackgroundTaskSnapshot` 的 Pick 清单:它是投递台账不是任务结果,
   * 交给等待者的快照不该因为多了一个字段而形状变化。
   */
  notified: boolean;
  /**
   * G-816001 **分支代戳**:注册那一刻的分支代(`currentBranchGeneration()`,G-632 计数器)。
   * 防 rewind/fork 之后旧生命的唤醒被回灌进新分支 —— 上游 `registry.ts:40-130` 的
   * `branchGeneration` 同名能力。消费点只有一处:`notifySettled` 的播报(唤醒入队)面,
   * 代数不是当下 ⇒ 通知不进队列,但必须落 `stale_branch_dropped` 审计行(静默丢弃 =
   * 下一次没人知道丢过什么)。等待者投递面不经此门:等待者属于发起分支,其结果落地
   * 由 G-632 的落地口作废机制负责,两道门各管一轴。
   *
   * **重臂剥继承(G-816002 配套)**:本字段只在 `registerTask`/`registerFailedTask`
   * 构造时盖章,不存在"复用旧对象"的重臂路径(key 换代没有公开入口,见 `__test__`
   * 块的论证)—— 任何"重臂"都是走 register 的新对象,天然剥掉旧代戳、重盖当下代,
   * 绝不把旧生命的分支代带进新生命。
   *
   * 刻意**不**进 `BackgroundTaskSnapshot` 的 Pick 清单:与 identity/notified 同族,
   * 是投递围栏不是任务结果。
   */
  branchGeneration: number;
  /** 后台任务关联的 worktree 路径(可选,注册时记录,任务结束自动清理) */
  worktreePath?: string;
  /** worktree 对应的源仓库路径(清理时作为 git 命令工作目录) */
  worktreeSourcePath?: string;
}

export interface BackgroundTaskMeta {
  id: string;
  command: string;
  startedAt: string;
  exitedAt?: string;
  exitCode?: number | null;
  status: BackgroundTaskStatus;
  /** 后台任务关联的 worktree 路径(可选) */
  worktreePath?: string;
}

const MAX_COMPLETED_TASKS = 100;

/**
 * 输出投影的两个窗口(G-937959,机制照上游 ZCode `task-output-projection.ts:10-11` /
 * `task-output-bash.ts:115-121` 的"终态尾读 + 运行中头读"模型):
 *  - 终态视图读**尾部**:结论/报错在输出末尾,复用头部只会看到开头(上游 8 MiB 文件尾读;
 *    我方无全量落盘,尾窗就是内存预算 1 MiB,规模不同、机制同构)。
 *  - 运行中视图读**头部** 30000:运行中的尾部是半截滚动的进度,第 1 行(命令回显/早期报错)
 *    才是模型定位任务用的信息(上游 `TASK_OUTPUT_RUNNING_BASH_PREFIX_BYTES` 同值)。
 * 两个常量沿用上游命名;口径差异如实登记:上游按**字节**读文件,我方缓冲按**字符**(utf-16
 * 码元)计 —— 与本文件既有 dropped* 记账同口径(见 G-816028 注)。
 */
const TASK_OUTPUT_TAIL_BYTES = 1024 * 1024;
const TASK_OUTPUT_RUNNING_BASH_PREFIX_BYTES = 30_000;

const tasks = new Map<string, BackgroundTask>();

function genId(): string {
  return `bg_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
}

/**
 * G-654② 代际身份 token:每次登记一枚,只用于"这个 key 上还是不是我这一轮"的判定。
 * 与 `id` 分工:`id` 是**对外键名**(可复用、会被台账引用),`identity` 是**对内世代号**
 * (不外传、不进快照、每次登记新生成)。两者缺一都会退化成"按 key 盲删"。
 */
function genIdentity(): string {
  return `gen_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * G-654② 守卫账:被身份守卫拦下来的次数(每一格都是"盲删本该发生而没发生"的证据面)。
 * - `missingIdentity` —— 调用方**没给身份**就要删 ⇒ 拒绝(本票明令不得保留"不带身份就盲删"的默认档)
 * - `identityMismatch` —— 给了身份但**不是在任那一代** ⇒ 拒绝(旧一轮删不掉新一轮的登记)
 * - `staleTerminalRejected` —— 迟到终态:对象所属世代已被新登记取代 ⇒ 不改状态、不投递、不摘桶
 * - `staleBucketReconciled` —— 桶属于另一代 ⇒ 先把旧等待者以 `null` 回答(不留无人应答的等待),再换桶
 * 只增不减;测试按**增量**断言(模块级状态跨用例存活,断言绝对值就是把测试绑在跑序上)。
 */
const removalGuardStats = {
  missingIdentity: 0,
  identityMismatch: 0,
  staleTerminalRejected: 0,
  staleBucketReconciled: 0,
  /** G-816001:旧分支代的终态通知在唤醒入队面被拒(每一条都伴随 stderr 审计行,不静默)。 */
  staleBranchDropped: 0,
};

/** 身份守卫账只读出口(成对用例用它问出"拒绝了几次",而不是只问"有没有抛")。 */
export function getRemovalGuardStats(): {
  missingIdentity: number;
  identityMismatch: number;
  staleTerminalRejected: number;
  staleBucketReconciled: number;
  staleBranchDropped: number;
} {
  return { ...removalGuardStats };
}

/** G-654② `removeTask`/`removeLoop` 的结果:三种拒绝档位互不相通,绝不塌成"没删就是不存在"。 */
export type GuardedRemovalOutcome =
  | { removed: true; id: string }
  | { removed: false; reason: 'missing-identity' | 'identity-mismatch' | 'not-found'; id: string };

/** 清理任务关联的 worktree(收尾调用,失败吞掉不阻塞) */
function cleanupTaskWorktree(task: BackgroundTask): void {
  if (!task.worktreePath) return;
  cleanupWorktree(task.worktreePath, task.worktreeSourcePath ?? process.cwd(), true);
  task.worktreePath = undefined;
}

/**
 * 注册表的终态 → 台账终态。
 *
 * 刻意**不**把"拿不到退出码"折成成败:Windows 上外部终止常见 `close(null, null)`,
 * 那种情况下落 `ended-unknown` —— 进程确实结束了(这是我们观察到的),但结果没记到,
 * 而"结果没记到"永远不许被渲染成完成(AGENTS §30)。
 */
function toLedgerTerminal(status: BackgroundTaskStatus, exitCode: number | null | undefined): LedgerRecordedTerminal {
  if (status === 'killed') return 'cancelled';
  if (status === 'error') return 'failed';
  // G-816025:`lost` 在台账侧**不新立档**。`ended-unknown` 的原话就是它该表达的语义
  // ("进程确实结束了,但结果没记到"),而 `background-ledger.ts` 的 `LedgerRecordedTerminal`
  // 值域是跨进程契约(旧检出读得到新值就解不了),扩那一侧属另一票。
  // 等价性由测试钉住:lost 与 (exited + 拿不到码) 经本函数必得同一个终态。
  if (status === 'lost') return 'ended-unknown';
  if (exitCode === 0) return 'succeeded';
  if (typeof exitCode === 'number') return 'failed';
  return 'ended-unknown';
}

/**
 * 落台账。**台账失败不改判任务** —— 它是观测面不是执行面,但失败必须留痕:
 * `background-ledger` 自己把失败压进告警队列,呈现点(`repl` 的 `/bg list`)会把它喊出来。
 *
 * G-1058645 世代围栏(写账侧):与 `notifySettled` 的代际归属门**同构** —— 这个 key 上
 * 如今站着**另一代**登记 ⇒ 手上这条结算是旧世代迟到的 ⇒ 不得写账。没有这道门时,error /
 * close 两支都直接拿 `task.id` 记账,而同 id 复用(`pruneCompleted()` 之后是真路径)后,
 * 上一代迟到的收尾会把新一代那条账标成旧世结局 —— "账面说这一代已经结了,而它其实还在跑"。
 * 判据与投递侧逐字同形(`live && live.identity !== task.identity`):没有在册登记(已被裁掉)
 * 时照写 —— 那是这一代给自己补账,不是冒名。拦截计入 `staleTerminalRejected`(与投递侧
 * 同一格:"迟到终态:对象所属世代已被新登记取代")。
 */
function ledgerSettle(task: BackgroundTask, note: string): void {
  const live = tasks.get(task.id);
  if (live && live.identity !== task.identity) {
    removalGuardStats.staleTerminalRejected += 1;
    return;
  }
  recordTaskSettle({
    id: task.id,
    identity: task.identity,
    terminal: toLedgerTerminal(task.status, task.exitCode),
    exitCode: typeof task.exitCode === 'number' ? task.exitCode : null,
    note,
    command: task.command,
  });
}

/** 任务是否已进入终态(四档里除 'running' 都算)—— 终态单向门的判据,只此一份。 */
function isTerminalStatus(status: BackgroundTaskStatus): boolean {
  return status !== 'running';
}

/**
 * 某一时刻的**任务快照** —— 冻结副本,不是注册表里那个还在被 stdout/stderr 回调
 * 与 close 事件就地改写的活对象。
 *
 * 刻意排除两个字段:
 *  - `process`:活的 ChildProcess 句柄,快照一旦带上它,"快照"就退化成"活对象的引用",
 *    调用方顺着就能读到之后才写进来的输出。
 *  - `worktreePath`:任务结束时会先清理 worktree 再置 undefined,同一条快照里
 *    "路径还在"与"已经清完"哪个是真的取决于读的时刻 —— 该字段请走 listTasks/getTask。
 */
export type BackgroundTaskSnapshot = Readonly<
  Pick<
    BackgroundTask,
    'id' | 'command' | 'startedAt' | 'exitedAt' | 'exitCode' | 'status' | 'stdoutBuf' | 'stderrBuf' | 'stdoutHead' | 'stderrHead' | 'totalStdoutChars' | 'totalStderrChars' | 'truncated' | 'droppedStdoutBytes' | 'droppedStderrBytes' | 'timedOut' | 'stopInitiator' | 'ownerAgentId' | 'settledBy'
  >
>;

function toSnapshot(t: BackgroundTask): BackgroundTaskSnapshot {
  return Object.freeze({
    id: t.id,
    command: t.command,
    startedAt: t.startedAt,
    exitedAt: t.exitedAt,
    exitCode: t.exitCode,
    status: t.status,
    stdoutBuf: t.stdoutBuf,
    stderrBuf: t.stderrBuf,
    stdoutHead: t.stdoutHead,
    stderrHead: t.stderrHead,
    totalStdoutChars: t.totalStdoutChars,
    totalStderrChars: t.totalStderrChars,
    truncated: t.truncated,
    droppedStdoutBytes: t.droppedStdoutBytes,
    droppedStderrBytes: t.droppedStderrBytes,
    timedOut: t.timedOut,
    stopInitiator: t.stopInitiator,
    ownerAgentId: t.ownerAgentId,
    settledBy: t.settledBy,
  });
}

/**
 * 终态监听器:task.id → **该代登记的**等待者集合。
 * 回调参数是**该任务那一刻的快照**;null 表示"任务已从注册表消失,无人能给出终态"。
 *
 * G-654②:桶上必须带**世代身份**(`identity`)。只有 `Map<id, Set>` 的话,同一 key 上的
 * 上一轮遗留桶会被这一轮的终态事件整块摘掉(或反过来:上一轮迟到的终态向这一轮新登记的
 * 等待者投递一份**别人家的**快照)—— 两种都是"按 key 盲操作"的形态,本票要杀的就是它。
 */
type SettleListener = (snapshot: BackgroundTaskSnapshot | null) => void;

interface SettleBucket {
  /** 桶建立时该 key 上在任登记的世代;`NO_GENERATION_IDENTITY` = 此刻键上没有登记。 */
  identity: string;
  listeners: Set<SettleListener>;
}

/** 没有在册登记时的世代占位值(与 `genIdentity()` 的形态永不相撞:后者必带 `gen_` 前缀)。 */
const NO_GENERATION_IDENTITY = '';

const settleListeners = new Map<string, SettleBucket>();

/** 此刻该 key 上在任登记的世代身份(无登记 ⇒ 占位档)。删除/投递的匹配基准就是它。 */
function currentIdentityOf(id: string): string {
  return tasks.get(id)?.identity ?? NO_GENERATION_IDENTITY;
}

/** 逐个回答桶里的等待者(与 `clearAllTasks`/`notifySettled` 同一条纪律:**逐个包**,一人抛错不吞后面)。 */
function answerBucketListeners(bucket: SettleBucket, snapshot: BackgroundTaskSnapshot | null): void {
  for (const fn of Array.from(bucket.listeners)) {
    try {
      fn(snapshot);
    } catch {
      /* 单个等待者的清理体内抛错不许带崩整桶收尾 */
    }
  }
  bucket.listeners.clear();
}

/**
 * G-654② 摘桶的唯一守卫出口:**身份匹配才摘**。
 * 匹配 ⇒ 先把桶里剩下的等待者以 `null` 回答(留一个没人回答的等待 = Promise 泄漏),再摘桶;
 * 不匹配 ⇒ 这一格**原样不动**并计数 —— 那是别的一代登记的桶,本票禁止拿 key 相等当删除凭据。
 */
function dropSettleBucketGuarded(id: string, identity: string): boolean {
  const bucket = settleListeners.get(id);
  if (!bucket) return false;
  if (bucket.identity !== identity) {
    removalGuardStats.identityMismatch += 1;
    return false;
  }
  settleListeners.delete(id);
  answerBucketListeners(bucket, null);
  return true;
}

/**
 * 挂一个终态监听器,返回撤销函数。
 *
 * **必须在读状态之前登记**(调用方 `waitForTask` 里那条判序是载荷性的):
 * 反过来(先读到 running → 再挂监听)会在"读"与"挂"之间漏掉那次终态,
 * 于是这个等待者只能等自己的 deadline 到点,把一个**其实早就结束**的任务报成
 * `timed-out-unknown`。这类漏登记在单线程下也能发生 —— await 就是让出点。
 *
 * G-654②:桶按**世代身份**归置。若该 key 上残留的是另一代的桶(上一轮迟到的等待者),
 * 先把那一桶以 `null` 回答完再换桶 —— 既不把旧等待者吊死,也不让旧桶占住新登记的投递面。
 * 撤销函数同样带身份守卫:key 上换代的桶**不是我的**,摘它会顺手清掉新登记的等待者。
 */
function addSettleListener(id: string, fn: SettleListener): () => void {
  const identity = currentIdentityOf(id);
  let bucket = settleListeners.get(id);
  if (bucket && bucket.identity !== identity) {
    // 另一代遗留的桶:当场结掉它(报 `null` = "无人能为其给出终态"),再为当代开新桶。
    settleListeners.delete(id);
    removalGuardStats.staleBucketReconciled += 1;
    answerBucketListeners(bucket, null);
    bucket = undefined;
  }
  if (!bucket) {
    bucket = { identity, listeners: new Set() };
    settleListeners.set(id, bucket);
  }
  bucket.listeners.add(fn);
  return () => {
    const current = settleListeners.get(id);
    if (!current) return;
    if (current.identity !== identity) {
      // 键已换代:这一桶不属于我这一代,整块摘它就是本票要杀的形状 ⇒ 不动、只计数。
      removalGuardStats.identityMismatch += 1;
      return;
    }
    current.listeners.delete(fn);
    // 逐层删空集合:留着空 Set 就是让 Map 只增不减
    if (current.listeners.size === 0) settleListeners.delete(id);
  };
}

/**
 * 任务进入终态:算一份快照,所有等待者拿同一份(而不是各读一次活对象)。
 *
 * 三条判据(G-814418 判据①;机制形状照上游 ZCode
 * `background-task-registry.ts:168-192` 的 claim/release 一对,那边"入队"这一格
 * 在我们这里就是"把快照交给等待者"):
 *  ① **claim 先行**:本轮生命周期已经投递过 ⇒ 直接返回,不再通知监听者。
 *     它与下面的终态单向门各判一件事、互不替代 —— 门拦的是"迟到的快照改写状态",
 *     claim 拦的是"同一轮里通知发两次";去掉任一条,对应的成对用例必红。
 *  ② **投递抛错 ⇒ 回退 claim**:某一个监听者体内抛错,不等于这次投递成功了。
 *     不回退的话这些等待者此后永远收不到终态(位已经是 true,再来什么事件都不发),
 *     只能等自己的 deadline 到点报 `timed-out-unknown` —— 那是把"没送到"写成"已送到"。
 *  ③ **逐个摘除而不是整块 delete**:旧写法在调用任何监听者之前就把整个 Set 从 Map 上
 *     摘掉,于是第一个抛错的监听者会连带吞掉排在它后面所有等待者的终态 —— 与本文件
 *     `clearAllTasks` 里那句"留一个没人回答的等待 = Promise 泄漏"是同一条禁令。
 *     现只摘**真送达**的那些,抛错的原样留在集合里等下一次投递重试。
 *
 * G-816025 新增的前半段 = **五道有序校验走一遍**(`decideTerminalSettlement`):
 * 归属 → 幂等 → 可观察性 → 跨生产者去重 → 容量。它同时管两件事 ——
 *  a) 确无结果去处时把条目落成 `lost`,**并且照样播报**(旧实现在这里直接 `return`,
 *     于是"结果丢了"是一个既不落档也不出声的洞;只补档位不发通知等于把静默换个名字);
 *  b) 容量截断只许在归属与幂等**之后**发生 —— 止步于前四道的条目拿不到通知文本,
 *     也就结构上不可能带 `[truncated]`(判据③的载体)。
 * 后半段的投递语义(claim / 回退 / 逐个摘除)一字未改;三条各去掉一条,红的必须是不同的用例。
 *
 * G-654② 在最前面再加一道**代际归属门**,与上面三条各判各的:
 *  - 终态单向门拦"同一个对象被迟到的快照改写";
 *  - claim(判据①)拦"同一轮里通知发两次";
 *  - 本门拦"迟到的是**上一代登记**的对象,而 key 上已经换成了新一代" —— 旧写法 key 相等就当
 *    归属成立,于是上一轮的终态会向新一轮的等待者投递一份别人家的快照,并把那一桶整块摘掉。
 *    现在:不改新条目、不投递、不摘桶,`getRemovalGuardStats().staleTerminalRejected` 计一次。
 */
function notifySettled(task: BackgroundTask): void {
  // G-654② 代际归属门(先于一切判据):这个 key 上如今站着**另一代**登记 ⇒ 手上一条终态
  // 是上一轮迟到的 ⇒ 整段拒收:不改新条目的状态、不向新登记的等待者投递、不摘新登记的桶,
  // 并计数。旧写法只问 `settleListeners.get(task.id)` —— key 相等就当归属成立,正是本票要杀的
  // "按 id 盲操作"那一型(票面②:旧一次运行迟到的终态不得清掉同一 key 的新登记)。
  const live = tasks.get(task.id);
  if (live && live.identity !== task.identity) {
    removalGuardStats.staleTerminalRejected += 1;
    return;
  }
  // 桶同样要按身份认领:另一代遗留的桶不由这一轮投递,也不在这一轮手里被清。
  const bucket = settleListeners.get(task.id);
  const set = bucket && bucket.identity === task.identity ? bucket.listeners : undefined;
  const hasDirectWaiter = !!set && set.size > 0;
  const decision = decideTerminalSettlement({
    ownsEntry: isTerminalStatus(task.status),
    alreadyClaimed: task.notified,
    hasObservableOutcome: hasObservableOutcome(task),
    hasDirectWaiter,
    handledByAnotherProducer: false,
    buildNotice: (outcome) => terminalNoticeOf(task, outcome),
  });
  // 可观察性判不过 ⇒ 结果没有任何去处 ⇒ 显式落成 lost。
  // 台账侧无需改次序:lost 与 (exited + 拿不到码) 经 toLedgerTerminal 得同一个 ended-unknown,
  // 所以 handlers 里"先 ledgerSettle 再 notifySettled"的既有顺序不受影响(等价性由测试钉住)。
  if (decision.markLost) task.status = 'lost';
  if (decision.consumeClaim) task.notified = true;
  if (decision.emitNotice && decision.notification !== null) {
    // G-816001 分支代门(唤醒入队面):条目代戳 ≠ 当下分支代 ⇒ 会话已 rewind/fork,
    // 这条唤醒属于旧生命,回灌进新分支就是"旧分支的终态通知出现在新分支的对话里"。
    // 拦的是**播报入队**,不是任务结算本身:状态/台账/claim/等待者投递各走各的既有门。
    // 拦下必须留痕(上游 background-notifications 同款要求):stderr 审计行 + 计数,
    // 静默丢弃 = 下一次没人知道丢过什么。
    if (isBranchGenerationCurrent(task.branchGeneration)) {
      emitTerminalNotice(decision.notification);
    } else {
      removalGuardStats.staleBranchDropped += 1;
      try {
        process.stderr.write(
          `[background-registry] stale_branch_dropped: task ${task.id} registered at branch generation ` +
            `${task.branchGeneration}, current is ${currentBranchGeneration()}; ` +
            `terminal notice NOT enqueued (stale branch唤醒不得回灌新分支)\n`,
        );
      } catch {
        /* 审计出口本身抛错不许把终态处理带崩(与播报出口同一条纪律) */
      }
    }
  }
  // 止步于归属 / 幂等 / 跨生产者去重 ⇒ 一律不向等待者投递(迟到快照不得二次投递,原语义保持)。
  if (decision.haltedAt !== null) return;
  // 没有等待者就没有"待投递的东西",也就不该消耗 claim —— 位一旦被一个不存在的接收方
  // 占掉,随后登记进来的等待者会被 ① 拒收,而它从来没有被通知过。
  // (settled 一支保持这条;只有 lost 在上面已经消耗过位 —— 那一支此刻必然没有等待者。)
  // 这里重读 `set` 而不是用 `hasDirectWaiter`:同一条件,但 TS 只能在直接判空后收窄类型。
  if (!set || set.size === 0) return;
  task.notified = true; // ① claim 先行(投递一支)
  const snapshot = toSnapshot(task);
  const failures: unknown[] = [];
  // 迭代副本:监听者体内会走 waitForTask 的 cleanup 自行摘除自己(载荷性动作),
  // 直接在活集合上 for-of 会跟着边跑边变。
  for (const fn of Array.from(set)) {
    try {
      fn(snapshot);
      set.delete(fn); // ③ 只有真送达的才摘
    } catch (e) {
      failures.push(e);
    }
  }
  // 空集合不留(与 addSettleListener 的撤销路径同一条纪律)
  if (set.size === 0) settleListeners.delete(task.id);
  if (failures.length > 0) {
    task.notified = false; // ② 没送全 ⇒ 位回退,下一次终态事件仍能重投
    // 失败必须响:这一格不能只靠"位回退了"来自证,否则投递失败的表现永远是安静。
    // 本端诊断出口的既有形态就是 stderr 一行(见 commands/agent.ts),不另立日志设施。
    try {
      process.stderr.write(
        `[background-registry] terminal delivery to ${failures.length} waiter(s) threw for task ${task.id}; ` +
          `claim released so a later terminal event can retry — ${String(
            (failures[0] as Error | undefined)?.message ?? failures[0],
          )}\n`,
      );
    } catch {
      /* 诊断出口本身抛错不该把终态处理带崩 */
    }
  }
}

/**
 * 注册一个后台任务,返回 task id。
 *
 * @param opts.worktreePath 可选 — 任务关联的 worktree 路径(Worktree 并行隔离层),
 *                          记录在任务上,任务结束(error/close)时自动清理
 * @param opts.worktreeSourcePath 可选 — worktree 对应的源仓库路径(默认 process.cwd())
 * @param opts.ownerAgentId 可选(G-816029) — 派生该任务的 agent 归属;只有登记时给得出
 *                          (task_id 与归属同处一个 context),缺席 ⇒ 无归属 ⇒ 永不参与级联。
 */
export function registerTask(
  process: ChildProcess | null,
  command: string,
  opts?: { worktreePath?: string; worktreeSourcePath?: string; ownerAgentId?: string },
): string {
  const id = genId();
  const task: BackgroundTask = {
    id,
    identity: genIdentity(),
    command,
    process,
    startedAt: new Date().toISOString(),
    status: 'running',
    stdoutBuf: '',
    stderrBuf: '',
    stdoutHead: '',
    stderrHead: '',
    totalStdoutChars: 0,
    totalStderrChars: 0,
    truncated: false,
    droppedStdoutBytes: 0,
    droppedStderrBytes: 0,
    timedOut: false,
    notified: false,
    // G-816001:分支代戳 = 注册那一刻的分支代;唤醒入队面按它比对(重臂只能经本函数
    // 重新盖章,不存在继承旧代戳的路径)。
    branchGeneration: currentBranchGeneration(),
    worktreePath: opts?.worktreePath,
    worktreeSourcePath: opts?.worktreeSourcePath,
    ownerAgentId: opts?.ownerAgentId,
  };
  tasks.set(id, task);

  // 台账先落一条"已开始、无终态"的记录:进程一旦被宿主清掉而没人写终态,
  // 读侧就会把它判成 detached-unknown —— 这是"能被看见"的唯一前提。
  // G-1058645:账随世代走 —— 台账记录带上本代 identity,折叠按世代进行。
  recordTaskStart({ id, command, childPid: process?.pid ?? null, identity: task.identity });

  if (process) {
    // 双窗口捕获(G-937959):每个流同时维护"头窗"(前 30k,运行中视图)与"尾窗"
    // (后 1MiB,终态视图)。上游把全量落文件、读时投影头/尾;我方无全量落盘,
    // 就在捕获层把两个窗口都留住 —— 内存上界 ≈ 旧实现(1MiB 头缓冲)+ 3%(头窗)。
    const capture = (
      chunk: Buffer,
      win: { head: string; tail: string; total: number; dropped: number },
    ): typeof win => {
      const text = chunk.toString('utf-8');
      win.total += text.length;
      // 头窗:只收前 TASK_OUTPUT_RUNNING_BASH_PREFIX_BYTES,之后不再增长
      if (win.head.length < TASK_OUTPUT_RUNNING_BASH_PREFIX_BYTES) {
        win.head += text;
        if (win.head.length > TASK_OUTPUT_RUNNING_BASH_PREFIX_BYTES) {
          win.head = win.head.slice(0, TASK_OUTPUT_RUNNING_BASH_PREFIX_BYTES);
        }
      }
      // 尾窗:滚动保留最后 TASK_OUTPUT_TAIL_BYTES;溢出量入账(= 终态视图省略量,G-816028)
      win.tail += text;
      if (win.tail.length > TASK_OUTPUT_TAIL_BYTES) {
        const overflow = win.tail.length - TASK_OUTPUT_TAIL_BYTES;
        win.dropped += overflow;
        win.tail = win.tail.slice(overflow);
      }
      return win;
    };
    process.stdout?.on('data', (chunk: Buffer) => {
      const w = capture(chunk, {
        head: task.stdoutHead,
        tail: task.stdoutBuf,
        total: task.totalStdoutChars,
        dropped: task.droppedStdoutBytes,
      });
      task.stdoutHead = w.head;
      task.stdoutBuf = w.tail;
      task.totalStdoutChars = w.total;
      task.droppedStdoutBytes = w.dropped;
      if (w.dropped > 0) task.truncated = true;
      recordHeartbeat(id, task.identity); // 有输出就是"还活着"的证据(模块内按 30s 节流;找账按世代,G-1058645)
    });
    process.stderr?.on('data', (chunk: Buffer) => {
      const w = capture(chunk, {
        head: task.stderrHead,
        tail: task.stderrBuf,
        total: task.totalStderrChars,
        dropped: task.droppedStderrBytes,
      });
      task.stderrHead = w.head;
      task.stderrBuf = w.tail;
      task.totalStderrChars = w.total;
      task.droppedStderrBytes = w.dropped;
      if (w.dropped > 0) task.truncated = true;
      recordHeartbeat(id, task.identity);
    });
    process.on('error', () => {
      // 终态单向门(G-814418 判据②):已经终态的条目不许被**迟到的快照**改写。
      // 形状照上游 ZCode `background-task-registry.ts:127-147`
      // (`isTerminalRuntimeTask(current) ? current : {...}`)与
      // `runtime/methods/background.ts:235-244`(同一判据的第二处用法)。
      // 真实可达路径不止一条:Node 在 spawn 失败时会先 'error' 后 'close';测试与某些
      // 宿主(Windows 上 taskkill 之后)还会再补一发;而 pruneCompleted() 之后同 id 复用
      // 会让上一轮的收尾事件打到**新条目**的监听器上 —— 那时新条目还在 running,门不误伤,
      // 但旧条目已经终态,再改写就是凭空造第二个终态。
      if (isTerminalStatus(task.status)) return;
      task.status = 'error';
      task.exitedAt = new Date().toISOString();
      // 任务异常结束,自动清理关联 worktree
      cleanupTaskWorktree(task);
      pruneCompleted();
      ledgerSettle(task, 'spawn error');
      // 终态通知放在状态改写之后:等待者读到的快照必须已经是 'error',
      // 否则会出现"任务已通知结束而 status 仍是 running"这种自相矛盾的观测。
      notifySettled(task);
    });
    process.on('close', (code, signal) => {
      // 同上 —— 第二次 close 不得改写 status/exitedAt/exitCode/timedOut,也不得二次通知。
      if (isTerminalStatus(task.status)) return;
      task.exitedAt = new Date().toISOString();
      task.exitCode = code;
      if (signal === 'SIGTERM' || signal === 'SIGKILL') {
        task.status = 'killed';
        // G-816026:谁停的是另一条轴,只能读 killTask 落盘的 stopInitiator,绝不按 signal
        // 形状反推(旧写法把用户手停/模型停/外部杀按 signal 形状塌成一件事,模型读到
        // `killed+timedOut` 只会去重跑同一条命令)。无发起方的信号终止(OOM/外部 kill)
        // 记 undefined,同样非超时 —— 反向锁见 kill-initiator 测试。
        // G-896416:但 deadline 持有者在发信号**之前**显式置位的 `timedOut=true`
        // (killTask 的 opts.timedOut,如"超时自动转后台"后的后台预算杀)不得被这里冲掉
        // —— close 只读不猜,唯独不覆写持有者已经落盘的事实。
        if (task.timedOut !== true) {
          task.timedOut = false;
        }
      } else {
        task.status = 'exited';
      }
      task.process = null;
      // 任务结束,自动清理关联 worktree
      cleanupTaskWorktree(task);
      pruneCompleted();
      // G-816029:级联收的场,账面要写"是谁替它收的"(`settled by <reason>`)—— 否则
      // "子代理被停 ⇒ 宿主级联结算"与"外部 OOM 杀"在台账上同形,谁都查不出孤儿去哪了。
      // 档是 settleTasksOwnedByAgent 在发信号之前落的,这里只读不猜(同 stopInitiator 纪律)。
      ledgerSettle(
        task,
        task.settledBy
          ? `settled by ${task.settledBy}`
          : signal
            ? `closed by signal ${signal}`
            : 'closed',
      );
      notifySettled(task);
    });
  }

  return id;
}

/** 注册一个占位任务(用于沙盒预检失败的情况)。 */
export function registerFailedTask(command: string, errorMessage: string): string {
  const id = genId();
  const task: BackgroundTask = {
    id,
    identity: genIdentity(),
    command,
    process: null,
    startedAt: new Date().toISOString(),
    exitedAt: new Date().toISOString(),
    exitCode: null,
    status: 'error',
    stdoutBuf: '',
    stderrBuf: errorMessage,
    stdoutHead: '',
    stderrHead: '',
    totalStdoutChars: 0,
    totalStderrChars: errorMessage.length,
    truncated: false,
    droppedStdoutBytes: 0,
    droppedStderrBytes: 0,
    timedOut: false,
    // 占位任务生下来就是终态,但"已投递"位仍要显式起在 false:
    // 它标的是"有没有把终态交给过等待者",不是"是不是终态"—— 两者分开,
    // 单向门与 claim 才各自有牙(见 notifySettled 判据①)。
    notified: false,
    // G-816001:与 registerTask 同一盖章口径 —— 分支代只来自注册时刻,绝不继承。
    branchGeneration: currentBranchGeneration(),
  };
  tasks.set(id, task);
  pruneCompleted();
  // 占位任务从未有过进程,但同样要进台账:否则"沙盒拒绝"这一类任务在重启后彻底查无此事。
  // G-1058645:账随世代走。
  recordTaskSettle({
    id,
    identity: task.identity,
    terminal: 'failed',
    exitCode: null,
    note: errorMessage,
    command,
    childPid: null,
  });
  return id;
}

export function getTask(id: string): BackgroundTask | null {
  return tasks.get(id) ?? null;
}

export function listTasks(): BackgroundTaskMeta[] {
  const list: BackgroundTaskMeta[] = [];
  for (const t of tasks.values()) {
    list.push({
      id: t.id,
      command: t.command,
      startedAt: t.startedAt,
      exitedAt: t.exitedAt,
      exitCode: t.exitCode,
      status: t.status,
      worktreePath: t.worktreePath,
    });
  }
  return list.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

/**
 * G-937959 的视图感知投影(机制照上游 `task-output-projection.ts:107-158` 的
 * `readTaskOutputFileSnapshot`:读选中的窗口、算省略量、加 omitted 前缀、绝不抛)。
 * 上游读的是**文件**(终态尾 8MB / 运行中头 30k);我方读的是捕获层的双窗口内存缓冲,
 * 投影语义同构:省略量 = total − 所选窗口长度。
 */
interface TaskOutputViewRead {
  available: boolean;
  content: string;
  truncated: boolean;
  omittedChars: number;
}

/** 一次视图投影:running ⇒ 头窗(含第 1 行),终态 ⇒ 尾窗(含末尾)。 */
function projectOutputView(
  running: boolean,
  head: string,
  tail: string,
  total: number,
): TaskOutputViewRead {
  if (running) {
    const omitted = total - head.length;
    // 运行中视图的截断也要能回答"省略了多少"(G-816028),前缀嵌入内容(上游同形:
    // `[NKB of earlier output omitted]` 一族)。
    return {
      available: true,
      content:
        omitted > 0
          ? `[运行中预览:仅保留前 ${TASK_OUTPUT_RUNNING_BASH_PREFIX_BYTES} 字符,已省略 ≥${omitted} 字符;结束后读取尾部窗口]\n${head}`
          : head,
      truncated: omitted > 0,
      omittedChars: omitted,
    };
  }
  const omitted = total - tail.length;
  return {
    available: true,
    content:
      omitted > 0
        ? `[${Math.round(omitted / 1024)}KB of earlier output omitted]\n${tail}`
        : tail,
    truncated: omitted > 0,
    omittedChars: omitted,
  };
}

export interface TaskOutput {
  id: string;
  status: BackgroundTaskStatus;
  /**
   * 视图感知的输出投影(G-937959):running ⇒ 头窗(30k,含第 1 行),终态 ⇒ 尾窗(1MiB,
   * 含末尾)。窗口装不下时内容自带 omitted 前缀(上游 `[NKB of earlier output omitted]` 同形)。
   */
  stdout: string;
  stderr: string;
  truncated: boolean;
  /** 丢弃量下界(字符):G-816028 要求截断时能回答"省略了多少"。= 终态视图(尾窗)的省略量。 */
  droppedStdoutBytes: number;
  droppedStderrBytes: number;
  /** 谁主动停的(G-816026):user/model 由 killTask 落盘;undefined = 外部终止(OOM/别的进程)。 */
  stopInitiator?: 'user' | 'model' | null;
  /** 只有"deadline 持有者"显式置位才为 true;绝不按 signal 形状反推(G-816026)。 */
  timedOut: boolean;
  exitCode?: number | null;
  startedAt: string;
  exitedAt?: string;
}

/**
 * 获取任务输出(视图感知投影)。
 *
 * 判据(G-937959 验收面):
 *  - running ⇒ 读头窗 ⇒ 含第 1 行;装不下时带"已省略 ≥N"前缀;
 *  - 终态 ⇒ 读尾窗 ⇒ 含末尾;装不下时带 `[NKB of earlier output omitted]` 前缀且长度 ≤ 尾窗上限;
 *  - 任务不存在 ⇒ 返回 null(= 上游 `available:false`),**绝不抛** —— 读面不负责报错,
 *    "不存在"是一个事实,不是一个异常。
 * 与上游的口径差如实登记:上游还有 abort 感知,因为它是异步文件 IO、有可取消的 await 窗口;
 * 我方读的是同步内存投影,没有让出点,不存在可中断的 IO —— abort 一格无载体,不虚设。
 */
export function getTaskOutput(id: string, tailLines?: number): TaskOutput | null {
  const t = tasks.get(id);
  // 读不存在 ⇒ available:false 不抛(上游 readTaskOutputFileSnapshot 的 unavailable 档)
  if (!t) return null;
  const running = !isTerminalStatus(t.status);
  const stdoutView = projectOutputView(running, t.stdoutHead, t.stdoutBuf, t.totalStdoutChars);
  const stderrView = projectOutputView(running, t.stderrHead, t.stderrBuf, t.totalStderrChars);
  let stdout = stdoutView.content;
  let stderr = stderrView.content;
  if (tailLines !== undefined && tailLines > 0) {
    const stdoutLines = stdout.split('\n');
    const stderrLines = stderr.split('\n');
    stdout = stdoutLines.slice(-tailLines).join('\n');
    stderr = stderrLines.slice(-tailLines).join('\n');
  }
  return {
    id: t.id,
    status: t.status,
    stdout,
    stderr,
    truncated: t.truncated || stdoutView.truncated || stderrView.truncated,
    droppedStdoutBytes: t.droppedStdoutBytes,
    droppedStderrBytes: t.droppedStderrBytes,
    stopInitiator: t.stopInitiator,
    timedOut: t.timedOut,
    exitCode: t.exitCode,
    startedAt: t.startedAt,
    exitedAt: t.exitedAt,
  };
}

// ==================== 任务完成通知的顺序化截断(G-937956) ====================

/**
 * 终态通知总预算(机制照上游 ZCode `runtime-task/notification.ts:18` 同名常量):
 * 超预算的通知按**段序**斩,不是按字符乱斩 —— 段序即优先级,见 formatSettledTaskNotification。
 */
export const TASK_NOTIFICATION_MAX_CHARS = 120_000;

const TASK_NOTIFICATION_TRUNCATED_MARK = '[truncated]';

export interface SettledTaskNotificationInput {
  /** 状态事实行(等价上游 `<task-id>/<status>/<summary>` 块):通知的头,永在。 */
  status: string;
  /** 结果正文(我方 = stdout):任务的收场,**保住**(上游 result 同格)。 */
  result?: string;
  /** 失败正文(我方 = stderr):**保住**(上游 error 同格)。 */
  error?: string;
  /** 过程产物节(上游 `<reports>` 同格):次之被斩。 */
  reports?: string;
  /** 交付物节(上游 `<artifacts>` 同格):次之被斩。 */
  artifacts?: string;
  /** 呈现指引(上游 deliveryGuidance 同格):补充材料,**先斩**。 */
  guidance?: string;
}

/**
 * 总截断:超预算从头保留 TASK_NOTIFICATION_MAX_CHARS,尾部立 `[truncated]` 标记
 * (上游 `truncateTaskNotification` 同形)。被斩掉的部分调用方靠段序预知:排在后面的先没。
 */
export function truncateTaskNotification(value: string): string {
  if (value.length <= TASK_NOTIFICATION_MAX_CHARS) return value;
  return `${value.slice(0, TASK_NOTIFICATION_MAX_CHARS)}\n${TASK_NOTIFICATION_TRUNCATED_MARK}`;
}

/**
 * 组装一条终态通知,并应用 120k 总截断。
 *
 * 段序即斩序(上游 notification.ts:185-221 的立论原样适用):result/error 是通知的正文,
 * 排在前;reports/artifacts 是补充材料,排在后;guidance 是最外围的指引,排最后。
 * 总截断从头部保留 —— 于是 >120k 时**先斩 guidance、再斩 reports/artifacts、保住
 * result/error**,读侧看到 `[truncated]` 就知道后面还有被斩掉的节。
 */
export function formatSettledTaskNotification(input: SettledTaskNotificationInput): string {
  const lines = [input.status];
  if (input.result !== undefined && input.result.length > 0) lines.push(input.result);
  if (input.error !== undefined && input.error.length > 0) lines.push(input.error);
  // 正文之后的节按"先产物后指引"排:总截断先斩指引、再斩产物(上游同序同理)
  if (input.reports !== undefined && input.reports.length > 0) lines.push(input.reports);
  if (input.artifacts !== undefined && input.artifacts.length > 0) lines.push(input.artifacts);
  if (input.guidance !== undefined && input.guidance.length > 0) lines.push(input.guidance);
  return truncateTaskNotification(lines.join('\n'));
}

// ==================== 结果回灌历史前的五道有序校验(G-816025) ====================

/**
 * 一次终态结算必须**按序**走的五道判据。顺序即语义,不可重排:
 *
 *  ① `ownership`          归属 —— 这条终态事件属不属于该条目**当前这一轮**生命周期。
 *                          我方载体 = 条目已落终态(`isTerminalStatus`):各 handler 之前
 *                          的终态单向门已经把迟到快照挡在门外,这里再判一次是因为
 *                          `__test__.notifySettled` 可以在没有事件的情况下被直接调用。
 *  ② `idempotency`        幂等 —— 本轮是否已经 claim 过(`notified` 位)。已经投递过
 *                          就不许再产出第二条通知(它与 `notifySettled` 文档里那条
 *                          "① claim 先行"是同一个事实,只是在这里落成判据链的第二格,不重复实现)。
 *  ③ `observability`      可观察性 —— 结果**还有没有去处**。三者皆无(内容没留、
 *                          成败没记、当场没人接)⇒ 判 `lost`,**但通知照发**。
 *  ④ `crossProducerDedup` 跨生产者去重 —— 这条终态已由另一个生产者处理过 ⇒ **仍 claim,但不发通知**。
 *  ⑤ `capacity`           容量 —— 只有前四道都走完,才允许截断并产出通知文本。
 *
 * 为什么容量必须排在最后:截断会把"还该发通知"的条目正文先斩掉;而归属/幂等不合格的条目
 * 根本不该产出一条看起来完整的通知 —— 上游同构:`background-tasks.ts:95-106`(归属)与
 * `:130-145`(可观察性 ⇒ lost 且仍发通知)都排在 `task-output.ts:199-217` 的截断之前。
 *
 * 我方与上游的**取材口径差异**(如实登记,不得读成"已等价"):上游有全量落盘的输出文件,
 * `hasSnapshotProvider` 量的是"文件还在不在";我方无落盘,能回灌进历史的只有条目自己留住的
 * 两个窗口、记到的退出码、以及当场还活着的等待者 —— 所以 `hasObservableOutcome` 量的是这三样。
 * 同理 `handledByAnotherProducer`:现读我方**没有第二个终态生产者**(`apps/cli/src/subagents`
 * 不 import 本注册表;`git grep -nE "enqueueBackgroundTaskNotification|backgroundTaskNotification|pendingNotifications" HEAD -- apps/cli/src` 零命中),
 * 故生产调用点恒传 `false`。判据先建在有序链里,是为了第二生产者落地时**只改这一个入参**、
 * 不在别处再抄一遍顺序 —— 两处算同一件事必漂移。
 */
export type SettlementCheckName = 'ownership' | 'idempotency' | 'observability' | 'crossProducerDedup' | 'capacity';

export interface TerminalSettlementEvidence {
  /** ① 事件归属于该条目当前这一轮生命周期。 */
  ownsEntry: boolean;
  /** ② 本轮已经 claim 过(`notified` 位为真)。 */
  alreadyClaimed: boolean;
  /** ③ 结果还有去处(之一):内容留着 / 成败已记 / 终止原因已记。 */
  hasObservableOutcome: boolean;
  /** ③ 结果还有去处(之二):此刻有直接等待者能把终态接走。 */
  hasDirectWaiter: boolean;
  /** ④ 这条终态已由另一个生产者处理过。 */
  handledByAnotherProducer: boolean;
  /**
   * ⑤ 正文的**构造函数**,不是正文本身 —— 只有走到容量步才会被调用。
   * 之所以给构造函数而不是字符串:`lost` 这句结论本身要进正文,而它要等第③步判完才知道。
   * 前四道止步 ⇒ 一次都不调用 ⇒ 拿不到文本,也就带不出 `[truncated]`(判据③的载体)。
   */
  buildNotice: (outcome: TerminalSettlementOutcome) => SettledTaskNotificationInput;
}

export type TerminalSettlementOutcome = 'settled' | 'lost' | 'not-owned' | 'already-claimed' | 'deduped-by-producer';

export interface TerminalSettlementDecision {
  outcome: TerminalSettlementOutcome;
  /** 按序**通过**的判据名;`haltedAt` 非空时,其后的判据一律不在列。 */
  passedChecks: SettlementCheckName[];
  /** 止步于哪一道;`null` = 五道走完(此时 `notification` 才有值)。 */
  haltedAt: SettlementCheckName | null;
  /** 条目该不该落成 `lost` 终态。 */
  markLost: boolean;
  /** 要不要播报 —— `lost` 必为 true(票面判据①:补了档位而事件仍静默 = 把静默换个名字)。 */
  emitNotice: boolean;
  /** 该不该消耗 claim:`lost` 播报与跨生产者去重都要(后者"不发通知但仍 claim",上游 :484-504)。 */
  consumeClaim: boolean;
  /** 只有走到 ⑤ 容量步才有文本;前四道止步 ⇒ `null`。 */
  notification: string | null;
}

/**
 * 五道有序校验的唯一实现(纯函数:不读注册表、不读进程、不写台账,所以能被构造面逐条问出颜色)。
 *
 * 三条判读边界,每条都有成对用例钉着:
 *  - **lost 不是失败**:它不发"失败通知",它发的是"结果拿不回来"这件事本身,所以
 *    `emitNotice` 与 `markLost` 必须同时为真,不许只落档位不出声。
 *  - **有去处不得判 lost**(反向锁):否则等于把所有终态都塞进新档,把 `exited`/`killed`
 *    这些已知结论洗成"不知道"。
 *  - **止步即无文本**:前四道任何一道拦下,`notification` 恒为 `null` 且 `buildNotice`
 *    一次都不调用 —— 截断标记因此不可能出现在不合格的条目上。
 */
export function decideTerminalSettlement(evidence: TerminalSettlementEvidence): TerminalSettlementDecision {
  const passed: SettlementCheckName[] = [];
  const halt = (at: SettlementCheckName, outcome: TerminalSettlementOutcome, consumeClaim: boolean): TerminalSettlementDecision => ({
    outcome,
    passedChecks: passed.slice(),
    haltedAt: at,
    markLost: false,
    emitNotice: false,
    consumeClaim,
    notification: null,
  });

  // ① 归属:不合格连正文都不构造 —— 更谈不上截断。
  if (!evidence.ownsEntry) return halt('ownership', 'not-owned', false);
  passed.push('ownership');

  // ② 幂等:本轮已经 claim 过 ⇒ 不再产出第二条通知。
  if (evidence.alreadyClaimed) return halt('idempotency', 'already-claimed', false);
  passed.push('idempotency');

  // ③ 可观察性:内容留着 / 成败已记 / 有人当场接得住 —— 三者皆无才是"无可观察源"。
  const hasSomewhereToGo = evidence.hasObservableOutcome || evidence.hasDirectWaiter;
  const outcome: TerminalSettlementOutcome = hasSomewhereToGo ? 'settled' : 'lost';
  passed.push('observability');

  // ④ 跨生产者去重:另一处已经处理过 ⇒ 仍要 claim(免得下一轮再判一遍),但不发通知。
  //    且此时结果并非"无去处" —— 不得再报 lost,所以这一支把 outcome 覆盖掉。
  if (evidence.handledByAnotherProducer) return halt('crossProducerDedup', 'deduped-by-producer', true);
  passed.push('crossProducerDedup');

  // ⑤ 容量:最后一步才截断(顺序锁的正向半边 —— 合格的条目**必须**能拿到截断后的文本,
  //    否则"止步即无文本"那条判据可以靠"永远不产出"蒙过去)。斩法复用既有那一份实现,
  //    不在这里抄第二份。
  const notification = formatSettledTaskNotification(evidence.buildNotice(outcome));
  passed.push('capacity');
  return {
    outcome,
    passedChecks: passed.slice(),
    haltedAt: null,
    markLost: outcome === 'lost',
    // settled 一支的"通知"载体是等待者投递(见 notifySettled 后半段),不从这里播报;
    // 这里只补"当场没有人可投、又没有去处"那一格 —— 也就是 lost。不播报 settled,
    // 否则每一次正常收尾都往 stderr 打一行,把这条出口变成噪音。
    emitNotice: outcome === 'lost',
    consumeClaim: outcome === 'lost',
    notification,
  };
}

/**
 * ③ 的判据实现,**只此一份**(注册表与测试都问它,不许在别处再写一遍"有没有去处")。
 *
 * 三条载体按"信息量"排:内容留着 > 成败已记 > 终止原因已记。`killed`/`error` 计入第三条:
 * 那两档是**已知的结论**(谁杀的 / 出错了),把它们折进 lost 就是把已知洗成未知。
 * 所以真正落到 `lost` 的只剩一型:`close(null, null)` —— 进程没了,退出码没有、信号也没有、
 * 一个字节输出都没留(Windows 上外部终止的典型形态,`toLedgerTerminal` 的注释早就登记过它)。
 */
function hasObservableOutcome(t: BackgroundTask): boolean {
  if (t.totalStdoutChars > 0 || t.totalStderrChars > 0) return true;
  if (typeof t.exitCode === 'number') return true;
  if (t.status === 'killed' || t.status === 'error') return true;
  return false;
}

/**
 * 终态播报的**取词入参**(G-816003)。刻意只收**已落盘的字段**:
 *  - `timedOut` 只认 deadline 持有者在发信号**之前**显式置位的那一个值(G-896416);
 *  - `stopInitiator` 只认 `killTask` 落盘的那一个值(G-816026)。
 * **signal / 退出码 / 时序一律不是入参** —— 谁停的是另一条轴,按 signal 形状反推
 * 就是把"用户手停"和"外部 OOM 杀"折成一档(本文件 :647 那条纪律的同一条)。
 */
export interface TerminalNoticeVocabFacts {
  timedOut?: boolean | null;
  stopInitiator?: 'user' | 'model' | null;
}

export interface TerminalNoticeVocab {
  /** 表里那一行(注册表/播报/事件帧四列都在它身上)。 */
  row: BackgroundTerminationVocabRow;
  /** 发起方轴是否真的落到了表里某一行;`false` = 未记录,已落 `unknown` 中性档。 */
  resolved: boolean;
  /** 未记录/未知时调用方要登记的那个原值(不猜、不折成 user)。 */
  unresolvedReason: string | null;
  /** 播报进 `cli.bgNoticeStatus` 的 `{status}` 槽的那一列。 */
  notificationToken: string;
  /** 该档的补充指引 i18n 键(用户可见文案唯一通道;空串 = 这一档没有额外句子)。 */
  guidanceKey: string;
  /** 文案分支判据:这一档能不能被暗示"还可以继续/重跑"。 */
  resumeStance: BackgroundResumeStance;
}

/**
 * 一行查表 —— 播报与呈现面的**唯一**取词出口(纯函数:不读注册表、不读进程)。
 *
 * 分支次序即语义,不可重排:
 *  ① `timedOut === true` ⇒ `timed-out`(它压过发起方轴 —— 超时是被"预算杀"停的,
 *     与"谁按的停"是两件事,而它的句子早就有档 `cli.bgNoticeTimedOut`,不另立新句);
 *  ② 否则按落盘的 `stopInitiator` 查表;
 *  ③ 查不到(缺席/未记录)⇒ `unknown` 行,**中性档**:既不劝 resume 也不禁 resume,
 *     并把原值回传成 `unresolvedReason` 供调用方报名(绝不默认成 `user`)。
 */
export function backgroundTerminationVocabFor(facts: TerminalNoticeVocabFacts): TerminalNoticeVocab {
  const rawReason = facts.timedOut === true ? 'timed-out' : (facts.stopInitiator ?? null);
  const { row, resolved } = backgroundTerminationRowOf(rawReason);
  return {
    row,
    resolved,
    unresolvedReason: resolved ? null : String(rawReason),
    notificationToken: row.notification,
    guidanceKey: row.guidanceKey,
    resumeStance: row.resumeStance,
  };
}

/**
 * 把某一档的补充指引取成人话。`t()` 取不到键时**原样回显键名**(见 `src/i18n/index.ts`),
 * 而播报里出现键名等于把没做完的事冒充成做完了 ⇒ 这里判"取回的是不是键本身",
 * 取不到就返回空串并由调用方计一格"文案未落地"(见 terminalNoticeOf)。
 */
function resolveNoticeGuidance(key: string): string | null {
  if (!key) return null;
  const text = t(key);
  return text === key ? null : text;
}

/**
 * 今天有哪些档的补充指引还没进五语言词表(测试与巡检用它把"未做"说成未做,
 * 而不是让播报悄悄少一行)。CLI 侧不硬编码任何中文句子。
 */
export function pendingNoticeGuidanceKeys(): string[] {
  return BACKGROUND_TERMINATION_VOCAB.map((row) => row.guidanceKey).filter((k) => !!k && resolveNoticeGuidance(k) === null);
}

/**
 * 终态播报正文(状态事实行 + 两个正文节 + 该档的指引节)。
 *
 * 与 `builtins.ts` 的 `wait_command` 那段状态行同形而**不是它的一份副本**:那一段是
 * "模型问一次、当场答一次"的工具结果(带 `timed-out-unknown` 等等待侧才有的档位),
 * 这一段是"没人问也喊一声"的播报。两者合并需要改 `builtins.ts` 与 `repl.ts`(不在本票面),
 * 差异已登记在交付报告里,不在这里顺手统一措辞。
 *
 * G-816003:状态词与指引**都由表给**(`backgroundTerminationVocabFor`),不再在这里
 * 逐字写 `outcome === 'lost' ? 'lost' : task.status` 那类折叠 —— 上游 `notificationStatus`
 * 的立论正是"runStatus 讲真话、通用词折起来",折的动作住进表,不住进文案。
 */
function terminalNoticeOf(task: BackgroundTask, outcome: TerminalSettlementOutcome): SettledTaskNotificationInput {
  const vocab = backgroundTerminationVocabFor({ timedOut: task.timedOut, stopInitiator: task.stopInitiator });
  // `lost` 是"结果拿不回来"这件事本身,它讲的就是状态轴,所以状态槽仍写 `lost`
  // (G-816025 判据①:补了档位而事件仍静默 = 把静默换个名字);发起方轴的词叠在指引里。
  const statusToken = outcome === 'lost' ? 'lost' : vocab.notificationToken;
  const lines = [t('cli.bgNoticeStatus', { id: task.id, status: statusToken, exitCode: task.exitCode ?? '-' })];
  if (task.timedOut) lines.push(t('cli.bgNoticeTimedOut'));
  if (outcome === 'lost') {
    lines.push(t('cli.bgNoticeNoObservableSource'));
  }
  // 指引节进 `guidance` 槽而不是正文:总截断先斩指引、保住 result/error(段序即斩序)。
  // `timed-out` 那一档的句子已由上面 `bgNoticeTimedOut` 带过,不重复推一遍。
  const guidance = vocab.row.stopReason === 'timed-out' ? null : resolveNoticeGuidance(vocab.guidanceKey);
  return {
    status: lines.join('\n'),
    result: task.stdoutBuf.trim() ? `[stdout]\n${task.stdoutBuf.trimEnd()}` : undefined,
    error: task.stderrBuf.trim() ? `[stderr]\n${task.stderrBuf.trimEnd()}` : undefined,
    guidance: guidance ?? undefined,
  };
}

/**
 * 播报出口类型。我方今天**没有**异步通知注入通道(上面 `handledByAnotherProducer` 那条现读),
 * 所以"通知照发"能落到的载体只有这一行 stderr —— 与投递失败诊断(`notifySettled` 后半段)
 * 同一形态,不另立日志设施。**通知通道一旦落地,这个出口的发射点必须改走它**,
 * 而不是把这行留着当第二份真相。
 */
type TerminalNoticeSink = (notice: string) => void;

const stderrTerminalNoticeSink: TerminalNoticeSink = (notice) => {
  try {
    process.stderr.write(`[background-registry] ${notice}\n`);
  } catch {
    /* 播报出口本身抛错不许把终态处理带崩(与投递失败诊断同一条纪律) */
  }
};

let terminalNoticeSink: TerminalNoticeSink = stderrTerminalNoticeSink;

function emitTerminalNotice(notice: string): void {
  terminalNoticeSink(notice);
}

/** 测试通道:换掉播报出口(传 `null` 复原成默认的 stderr)。生产代码不调。 */
function setTerminalNoticeSink(sink: TerminalNoticeSink | null): void {
  terminalNoticeSink = sink ?? stderrTerminalNoticeSink;
}

/**
 * `waitForTask` 的四种结论,必须**互相可分辨**。
 *
 * 立论(机制来源:ZCode 第十轮 A10A-2):旧实现到点 `resolve(cur)`,把
 * "超时读到的中间状态"当成答案交给调用方 —— 而调用方只能靠
 * `result.status !== 'running'` 这一句去反推"到底是被我等到了,还是我没等到"。
 * 一旦哪天有人加了个 `if (result)` 就把它当成结束了,超时就被静默升格成结论。
 * 所以这次把"等待有没有产生结论"做成返回形状的一部分,让调用方**必须**分支。
 *
 *  - `settled`            在窗口内观察到终态 ⇒ 快照可作结论
 *  - `still-running`      非阻塞探询(timeoutMs<=0)时仍未终态 ⇒ 已知"还在跑",不是结论
 *  - `timed-out-unknown`  窗口用尽仍未终态 ⇒ **未知**;既不得当成功也不得当失败
 *  - `gone`               任务不在注册表里(不存在或已被裁掉)⇒ 无人能为其负责
 */
export type WaitForTaskState = 'settled' | 'still-running' | 'timed-out-unknown' | 'gone';

export interface WaitForTaskResult {
  state: WaitForTaskState;
  /** 与 state 同时刻取得的快照;`gone` 时为 null(没有任何东西可快照)。 */
  snapshot: BackgroundTaskSnapshot | null;
}

/**
 * 等待任务结束。
 *
 * timeoutMs <= 0 ⇒ 只做一次非阻塞观测(未终态即 `still-running`,不会挂到 deadline)。
 *
 * 三条实现判据(逐条都对应一次真实故障形态,改动前请一并看 addSettleListener 的注释):
 *  ① 先登记终态监听器、再读状态 —— 顺序反了会漏掉"读与挂之间"完成的那次终态;
 *  ② 交出的是快照而不是活对象 —— 一个会在背后自己变大的结果比一个保守的结果危险得多;
 *  ③ 到点是 `timed-out-unknown` 而不是"当前状态" —— **超时不等于静默**。
 */
export async function waitForTask(id: string, timeoutMs = 30_000): Promise<WaitForTaskResult> {
  return new Promise<WaitForTaskResult>((resolve) => {
    let settled = false;
    let removeListener: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const cleanup = (): void => {
      settled = true;
      if (removeListener) {
        const r = removeListener;
        removeListener = null;
        r();
      }
      if (timer) {
        // 撤闹钟:一个还没响的 setTimeout 会把 CLI 的退出拖到上界
        clearTimeout(timer);
        timer = null;
      }
    };
    const finish = (result: WaitForTaskResult): void => {
      if (settled) return;
      cleanup();
      resolve(result);
    };

    // ① 登记在读取之前
    removeListener = addSettleListener(id, (snapshot) => {
      finish({ state: snapshot ? 'settled' : 'gone', snapshot });
    });

    const current = tasks.get(id);
    if (!current) {
      finish({ state: 'gone', snapshot: null });
      return;
    }
    if (current.status !== 'running') {
      finish({ state: 'settled', snapshot: toSnapshot(current) });
      return;
    }
    if (timeoutMs <= 0) {
      // 非阻塞探询:没等过任何东西,所以也谈不上"超时",只是"此刻仍在跑"
      finish({ state: 'still-running', snapshot: toSnapshot(current) });
      return;
    }
    timer = setTimeout(() => {
      const atDeadline = tasks.get(id);
      // ③ 到点:绝不把这一刻的中间状态升格成"已结束",也不压成"失败"
      finish({
        state: atDeadline ? 'timed-out-unknown' : 'gone',
        snapshot: atDeadline ? toSnapshot(atDeadline) : null,
      });
    }, timeoutMs);
    // 等待中的闹钟不该单独把进程钉住(任务本身有自己的句柄)
    timer.unref?.();
  });
}

/**
 * `settleAllInFlight` 的结论:三档**互相可分辨**(G-814419)。
 *
 * 立论与 `WaitForTaskState` 四态同一条:一个 `settled` 计数不许同时表达
 * "全都结束了"和"我什么都没等到"。所以到点没终态的那些必须**逐名**落在 `unknown`,
 * 而不是被折进 `settled` 或干脆不报。
 */
export interface SettleAllInFlightResult {
  /** 在窗口内**观察到终态**的任务数(唯一的"结束了"凭据)。 */
  settled: number;
  /** 到点仍未终态(或此刻还在跑)的任务 id —— 结果无从判定,不等于没结束也不等于结束。 */
  unknown: string[];
  /** 等待期间记录从注册表消失(被裁/被清)的任务 id —— 同样不是结论,但成因不同。 */
  gone: string[];
}

/**
 * 集合级出口:等**本刻所有在飞任务**收敛,给一个可分辨的结论。
 *
 * 判据三条:
 *  ① 集合是**入口时刻**的 running 快照。窗口内新派生的任务不在此列 —— 这一格的语义是
 *     "把此刻已知的在飞项结算掉",不是"保证之后不再有在飞项"(要那个得靠调用点自己不再派生)。
 *  ② 到点未终态 ⇒ 进 `unknown` 并**点名**,绝不并入 `settled`。
 *     上游同族机制(ZCode `headless-workflow.ts:341-347` 的 100ms 轮询 +
 *     `runtime-command-queue.ts:100-109` 的两个 busy 布尔)在 abort 时
 *     "既不报'没结束'也不报'不知道'",返回 `Promise<void>` 就把这一格洗成了沉默;
 *     本出口不许那样收场。
 *  ③ 复用 `waitForTask`,因此"先登记监听器再读状态""交出的是快照""超时不等于静默"
 *     三条判据一处生效、不在这里重写第二遍(两处算同一件事必漂移)。
 *
 * 现状登记(为什么不接 `apps/cli/src/index.ts` 的一次性入口):实测
 * 一次性进程带在飞后台任务时**根本不会提前退出** —— 子进程自己的 `ProcessWrap` 与
 * 两族 flowing 的 `PipeWrap` 句柄钉住事件循环。取证 2026-09-29 用一次性探针跑三支 arm
 * (临时探针按 §25 交付后已清理,数字记在这里,复现只需复刻这三步):
 *   · 真实路径(`runSandboxedAsync` + `registerTask` + `handle.result.then`,尾巴与
 *     index.ts:452 同形):`TAIL_REACHED` 在 12ms 到达(此刻 status 仍是 running、子进程活着、
 *     activeResources 含 PipeWrap×4 + ProcessWrap + Timeout),进程在 **7104ms** 才退出,
 *     退出时子进程已不在 ⇒ 没有孤儿;
 *   · 对照"pipe + data 监听、无 setTimeout":同样 7064ms ⇒ 钉住的是**管道**不是那个 600s 闹钟;
 *   · 对照"stdio ignore + unref":3ms 就退、子进程仍在跑 ⇒ 孤儿化这一型需要**不读管道**才成立,
 *     而本端四个登记点(repl.ts:1698/1748、builtins.ts:704/711)全部走
 *     `runSandboxedAsync` 的 `stdio:['pipe','pipe','pipe']`,没有这样的载体。
 * 所以"不接线就会孤儿化"这一故障形态在本端**当前不成立**,把本出口接到退出点等于
 * 为实现票造一个不存在的故障;它今天的用处是给有界等待/主动收敛的调用点(以及测试)
 * 一个可问责的结论形状。
 *
 * 与同族机制的分工(不是第二份真相):`commands/agent.ts` 的
 * `drainInFlightBackgroundTasks`(2026-09-29 现读**尚未入 HEAD**,是并行会话的在飞改动)
 * 判的是"**等到完或等到被取消**"—— 不设总上限、每轮重并清单(覆盖"在飞派生在飞"),
 * 结论是 `drained | interrupted(unsettledTaskIds)`。本出口判的是另一格:
 * **给定窗口内能收多少、收不到的逐名报名**,单轮、不重并、不看取消信号。
 * 两者不可互替:把本出口改成无限等待就没了"有界"这一维,把排水改成一轮就漏了
 * 在飞派生那一型。谁落地都不要"顺手合并"另一个。
 */
export async function settleAllInFlight(timeoutMs = 30_000): Promise<SettleAllInFlightResult> {
  // ① 入口快照(先取名单再等,免得边等边被新条目改动遍历面)
  const ids: string[] = [];
  for (const t of tasks.values()) {
    if (!isTerminalStatus(t.status)) ids.push(t.id);
  }
  const results = await Promise.all(ids.map((id) => waitForTask(id, timeoutMs)));
  let settled = 0;
  const unknown: string[] = [];
  const gone: string[] = [];
  results.forEach((r, i) => {
    const id = ids[i]!;
    if (r.state === 'settled') settled += 1;
    else if (r.state === 'gone') gone.push(id);
    // timed-out-unknown / still-running 都是"没结论",逐名报名(②)
    else unknown.push(id);
  });
  return { settled, unknown, gone };
}

/** 终止任务,signal 默认 SIGTERM,5 秒后未退出强杀 SIGKILL。 */
export async function killTask(
  id: string,
  initiator?: 'user' | 'model' | null,
  opts?: {
    /**
     * deadline 持有者显式置位(G-896416):本次 kill 的原因是**超时**而不是人。
     * 必须在发信号之前落盘(与 stopInitiator 同一条"写在 abort 之前"判据),
     * close 处理器读到 signal 时只保住这个事实,绝不按 signal 形状反推。
     * 调用点:run_command 超时自动转后台后的后台预算杀(600s,与显式后台同预算)。
     */
    timedOut?: boolean;
  },
): Promise<{ killed: boolean; reason?: string; exitConfirmed: boolean }> {
  const t = tasks.get(id);
  if (!t) return { killed: false, exitConfirmed: false, reason: `任务 ${id} 不存在` };
  if (t.status !== 'running') return { killed: false, exitConfirmed: true, reason: `任务已结束(状态: ${t.status})` };
  if (!t.process) return { killed: false, exitConfirmed: false, reason: '无进程引用' };

  // G-816026:发起方**必须在发信号之前落盘** —— close 事件是异步的,晚写就会让
  // close 处理器读到 undefined,把主动停误判成"外部终止"(上游同课:
  // background-stop-dynamic-workflow.ts:45-57「写在 abort 之前,否则结算可能抢先一步读到空值」)。
  // G-896416:超时档同理,而且先于 stopInitiator —— 两件事两条轴,谁都不能吃掉谁。
  if (opts?.timedOut === true) {
    t.timedOut = true;
  }
  t.stopInitiator = initiator ?? null;

  try {
    t.process.kill('SIGTERM');
  } catch {
    return { killed: false, exitConfirmed: false, reason: 'kill 信号发送失败' };
  }

  // 等待 5 秒
  const first = await waitForTask(id, 5000);
  if (first.state === 'settled') {
    return { killed: true, exitConfirmed: true };
  }
  // timed-out-unknown / gone / still-running:SIGTERM 没能收敛,继续走强杀。
  // 这一支就是"超时不等于已结束"必须显式处理的地方 —— 旧写法靠
  // `exited.status !== 'running'` 反推,读起来像在看结论,其实是在猜。

  // 进程组团灭(2026-09-10 CI 根修):runSandboxedAsync 以 detached+shell 派生,
  // SIGTERM 只杀 shell,孙进程(如 sleep)继承 stdio 管道,shell 死后 close 事件
  // 仍不触发 → 任务状态永久卡在 running(ubuntu CI 实测 SIGKILL 亦无效)。
  // detached 进程组 → kill(-pid) 团灭整组,管道随即关闭。
  if (t.process.pid && process.platform !== 'win32') {
    try {
      process.kill(-t.process.pid, 'SIGKILL');
    } catch {
      /* 进程组可能已退出 */
    }
  }
  // 强杀
  try {
    t.process.kill('SIGKILL');
  } catch { /* ignore */ }
  const second = await waitForTask(id, 2000);
  if (second.state === 'settled') {
    return { killed: true, exitConfirmed: true };
  }
  // 信号已经发出去了(这是事实),但**没有等到终态确认** —— 两件事必须分开说。
  // 刻意不把 unknown 洗成"终止成功",也不改口成"失败":
  // 前者会让人以为进程没了(实际可能还挂着管道),后者会诱使调用方再 kill 一次。
  return {
    killed: true,
    exitConfirmed: false,
    reason:
      second.state === 'gone'
        ? 'SIGKILL 已发送,但任务记录在确认前被清理,终态未确认'
        : 'SIGKILL 已发送,但等待窗口内未观察到终态(未确认退出,不等于已退出)',
  };
}

/** G-816029 级联结算的结论形状:**三类各报各的**,不许塌成一个布尔或一个数。 */
export interface AgentCascadeSettleReport {
  /** 入口时刻该 agent 名下**在飞**的任务数(级联只结算这一批;窗口内新派生的不在此列 —— 与 settleAllInFlight ① 同判)。 */
  inFlightAtEntry: number;
  /** 窗口内**观察到终态确认**的任务 id(唯一的"结束了"凭据)。 */
  settled: string[];
  /** 入口时刻已终态(自己跑完 / 已被别处结算)—— 一律不动、不贴 settledBy、不二次封口。 */
  alreadyTerminal: string[];
  /** 发了信号但没等到终态确认(含无进程引用)—— 未确认不等于已结束,逐名报名,绝不并进 settled。 */
  unknown: string[];
}

/**
 * G-816029 **级联结算**:子代理被停/异常结束时,把它自己派生的在飞后台任务收进终态,
 * 不留孤儿(上游同族 = `sealBackgroundTaskNotifications` + `cancelRunningRuntimeBackgroundTasks`)。
 *
 * 四条判据(每条都有对应用例,见 `apps/cli/tests/subagent-cascade-background.test.ts`):
 *  ① **只结算同名归属**:无归属(undefined)或空串一律零命中 —— "级联不是清全场",
 *     REPL/用户自己起的长跑任务、别的 agent 的任务都在此列;
 *  ② **已终态的不碰**:终态单向门的同一条 —— 把"它自己跑完了"改写成"我替它收的"是伪造账面;
 *  ③ **档先落盘、信号后发**:与 killTask 的 stopInitiator 同一判据(close 是异步的),
 *     台账 note 由 close 处理器读 `settledBy` 写 `settled by <reason>`;
 *  ④ **确认才进 settled**:信号发出去与进程结束是两件事,没等到终态的逐名进 unknown
 *     (复用 killTask 的 SIGTERM→SIGKILL 升级与"未确认退出,不等于已退出"三态)。
 */
export async function settleTasksOwnedByAgent(
  agentId: string | undefined,
  reason: BackgroundCascadeReason,
): Promise<AgentCascadeSettleReport> {
  const report: AgentCascadeSettleReport = { inFlightAtEntry: 0, settled: [], alreadyTerminal: [], unknown: [] };
  // 归属缺席/空串 ⇒ 零命中(①)。空串必须显式拒:它与"给了一个不存在的 agent"同形,
  // 但绝不能落进 `t.ownerAgentId === undefined` 那种"按缺省值相等"的盲匹配。
  if (typeof agentId !== 'string' || agentId === '') return report;

  const inFlight: BackgroundTask[] = [];
  for (const t of tasks.values()) {
    if (t.ownerAgentId !== agentId) continue; // ① 只结算同名归属
    if (isTerminalStatus(t.status)) report.alreadyTerminal.push(t.id); // ② 已终态不碰
    else inFlight.push(t);
  }
  report.inFlightAtEntry = inFlight.length;

  for (const t of inFlight) {
    // ③ 档先落盘(发信号之前):close 处理器读它写台账 note 与快照 settledBy。
    t.settledBy = reason;
    const outcome = await killTask(t.id, null);
    if (outcome.exitConfirmed) report.settled.push(t.id);
    else report.unknown.push(t.id); // ④ 未确认逐名报名,不洗成"已结算"
  }
  return report;
}

/** 清理已完成任务,保留最近 MAX_COMPLETED_TASKS 个。 */
function pruneCompleted(): void {
  const completed = listTasks().filter((t) => t.status !== 'running');
  if (completed.length <= MAX_COMPLETED_TASKS) return;
  const toRemove = completed.slice(MAX_COMPLETED_TASKS);
  for (const t of toRemove) {
    // 被裁掉的都是非 running 的任务 ⇒ 终态通知早已在 close/error 里发过。
    // 这里仍要摘监听器集合,否则一个"任务已被删除"的键会把监听器永久留在 Map 里。
    // G-654② 两处都换成**带身份**的摘除:先按在册那一代的身份了结等待者再摘条目。
    // 旧写法凭 key 整块 `settleListeners.delete` / `tasks.delete`,而这份清单来自
    // `listTasks()` 的**快照**(与删除之间隔着一次遍历)—— 正是票面②要杀的盲删形状。
    const live = tasks.get(t.id);
    if (!live) continue; // 快照已过时:key 上已经没有登记,无可删(不拿过期条目当删除凭据)
    deleteTaskGeneration(live.id, live);
  }
}

/**
 * G-654② 摘除一代登记的**唯一**出口:`tasks.delete` 只在这里发生
 * (`clearAllTasks` 是整表终局重置,不是"按 key 删某一代",另说)。
 * 顺序判据:先按身份了结该代等待者,再摘条目 —— 反过来会让等待者在一个已经不在册的条目上
 * 收到投递,而 `notifySettled` 的代际门此时读不到登记,等于把"没人负责"伪装成"已结算"。
 */
function deleteTaskGeneration(id: string, task: BackgroundTask): void {
  dropSettleBucketGuarded(id, task.identity);
  tasks.delete(id);
}

/**
 * G-654② —— **删除要带身份守卫**:`remove(id, identity)` 语义,只有身份匹配才删。
 *
 * 三档拒绝互不相通,不塌成"没删就是不存在":
 *  - `missing-identity` —— 调用方**没给身份**就要删 ⇒ 拒绝并计数。本票明令不得保留
 *    "不带身份就盲删"的默认档,所以这一格是**拒**,不是"那就按 key 删吧"。
 *  - `identity-mismatch` —— 给了身份但不是在册那一代 ⇒ 拒绝并计数:旧一轮迟到的收尾
 *    不得清掉同一 key 上新登记的条目。
 *  - `not-found` —— key 上根本没有登记(已被裁掉/从未注册)。
 * 匹配 ⇒ 摘条目 + 按身份了结该代等待者(`waitForTask` 收到 `gone`)。
 * 公开 API 既有签名一个都没动:本函数是**新增**出口。
 */
export function removeTask(id: string, identity?: string): GuardedRemovalOutcome {
  if (typeof identity !== 'string' || identity === '') {
    removalGuardStats.missingIdentity += 1;
    return { removed: false, reason: 'missing-identity', id };
  }
  const live = tasks.get(id);
  if (!live) return { removed: false, reason: 'not-found', id };
  if (live.identity !== identity) {
    removalGuardStats.identityMismatch += 1;
    return { removed: false, reason: 'identity-mismatch', id };
  }
  deleteTaskGeneration(live.id, live);
  return { removed: true, id };
}

/** 清空所有任务(用于 REPL 退出或测试清理)。 */
export function clearAllTasks(): void {
  for (const t of tasks.values()) {
    if (t.process && t.status === 'running') {
      try { t.process.kill('SIGKILL'); } catch { /* ignore */ }
    }
  }
  // 整表清空前逐个结掉等待者:留一个没人回答的等待 = Promise 泄漏
  // (与本文件 killTask 处 P0-4 修复记的是同一型故障)。
  // 与 notifySettled 同一条纪律:**逐个包**,一个监听者体内抛错不许吞掉它后面所有等待者
  // —— 那正是本段存在的理由要排除的形态。清空是终局动作,所以这里不参与 claim/回退语义。
  // G-654② 口径登记:`tasks.clear()` / 逐桶摘除是**整表终局重置**,不是"按 key 删某一代登记",
  // 没有可比的世代身份(它要清的就是全部世代),所以这一支不走身份守卫,但桶仍是按世代归置的,
  // 回答的仍是各自那一桶里的等待者。
  for (const [id, bucket] of [...settleListeners]) {
    settleListeners.delete(id);
    answerBucketListeners(bucket, null);
  }
  tasks.clear();
}

// ==================== /loop 周期任务(内存版) ====================

export interface LoopTask {
  id: string;
  /** G-654② 世代身份(与 `BackgroundTask.identity` 同一判据:删除凭身份,不凭 key 相等)。 */
  identity: string;
  command: string;
  intervalMs: number;
  timer: NodeJS.Timeout;
  lastRunAt?: string;
  lastTaskId?: string;
  runCount: number;
}

const loops = new Map<string, LoopTask>();

function parseInterval(input: string): number | null {
  const m = /^(\d+)([smhd])$/.exec(input.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 10);
  const unit = m[2]!;
  const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return n * multipliers[unit]!;
}

export interface StartLoopOptions {
  command: string;
  interval: string;
  spawn: (command: string) => string; // 注入 registerTask 的方式
}

export function startLoop(opts: StartLoopOptions): { id: string; intervalMs: number; identity: string } | { error: string } {
  const intervalMs = parseInterval(opts.interval);
  if (intervalMs === null) {
    return { error: `非法间隔格式: "${opts.interval}",应为 Ns/Nm/Nh/Nd(如 5m / 1h)` };
  }
  if (intervalMs < 1000) {
    return { error: '间隔不能小于 1 秒' };
  }

  const id = `loop_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
  const loopTask: LoopTask = {
    id,
    identity: genIdentity(),
    command: opts.command,
    intervalMs,
    timer: null as unknown as NodeJS.Timeout,
    runCount: 0,
  };

  const run = () => {
    loopTask.lastRunAt = new Date().toISOString();
    loopTask.lastTaskId = opts.spawn(opts.command);
    loopTask.runCount++;
  };

  // 立即执行一次,然后按间隔重复
  run();
  loopTask.timer = setInterval(run, intervalMs);
  loops.set(id, loopTask);

  return { id, intervalMs, identity: loopTask.identity };
}

export function listLoops(): Array<{ id: string; command: string; intervalMs: number; runCount: number; lastRunAt?: string; lastTaskId?: string }> {
  return Array.from(loops.values()).map((l) => ({
    id: l.id,
    command: l.command,
    intervalMs: l.intervalMs,
    runCount: l.runCount,
    lastRunAt: l.lastRunAt,
    lastTaskId: l.lastTaskId,
  }));
}

/**
 * G-654② 周期任务的**严格**删除:与 `removeTask` 同一套三档拒绝,不给"不带身份就盲删"留默认档。
 * 身份匹配才 `clearInterval` + 摘表 ——  clearInterval 也是删除的一部分:停错一代的定时器
 * 会让上一轮迟到的收尾掐掉这一轮的重复执行。
 */
export function removeLoop(id: string, identity?: string): GuardedRemovalOutcome {
  if (typeof identity !== 'string' || identity === '') {
    removalGuardStats.missingIdentity += 1;
    return { removed: false, reason: 'missing-identity', id };
  }
  const live = loops.get(id);
  if (!live) return { removed: false, reason: 'not-found', id };
  if (live.identity !== identity) {
    removalGuardStats.identityMismatch += 1;
    return { removed: false, reason: 'identity-mismatch', id };
  }
  clearInterval(live.timer);
  loops.delete(id);
  return { removed: true, id };
}

/**
 * 终止周期任务(既有签名向后兼容:传不传身份都还能调)。
 *
 * 每一处 `loops.delete` 现在都经 `removeLoop` 的身份守卫出口。刻意说明**这一支的口径**:
 * 调用方没给身份时,取"此刻在册那一代"的身份再去守卫 —— 这是"读到的就是摘掉的"同代删除,
 * 不是"凭 key 盲删"(它删不掉任何它没看见的世代,身份不匹配照样拒)。
 * 为什么不改成"无身份即拒":`apps/cli/src/commands/repl.ts:1758` 是 `/loop stop` 的既有调用点,
 * 本票禁改该文件;把它逼成拒绝等于**顺手改坏用户命令**,而票面要杀的是跨代误删,不是这一格。
 * 需要严格档的调用点请直接用 `removeLoop(id, identity)`(身份可从 `startLoop` 返回值取)。
 */
export function stopLoop(id: string, identity?: string): boolean {
  const live = loops.get(id);
  if (!live) return false;
  return removeLoop(id, identity ?? live.identity).removed;
}

export function clearAllLoops(): void {
  for (const l of loops.values()) {
    clearInterval(l.timer);
  }
  loops.clear();
}

/**
 * 测试通道(本端既有形态:`apps/cli/src/plugins/path-safety.ts:237`)。
 *
 * 为什么只暴露这四个:投递的 claim/回退语义要能**脱离真实进程事件**被驱动
 * (一个会抛错的监听者体内没有任何生产入口能构造出来 —— `waitForTask` 自己的监听体
 * 只做 resolve,而 resolve 不抛)。把 `addSettleListener`/`notifySettled` 交出去,
 * 判据就能被成对用例正面问出"抛错之后位有没有回退、下一次还能不能投",
 * 而不必靠改产品代码去撞一条不可达分支。
 * `setTerminalNoticeSink`(G-816025)是同一个理由的第二格:"lost 也要播报"必须能被
 * 问出**播报文本**与**播报次数**(0 次与 1 次的差别就是本票判据①的全部内容),
 * 而默认出口是 stderr —— 靠抓 stderr 断言会把测试绑在控制台编码上(§26 那类码页陷阱),
 * 所以给一个可换的出口,并且只给换出口、不给换判据。
 * `toLedgerTerminal`(G-816025)是第三格:`lost` 在台账侧**不新立档**,它与
 * `exited + 拿不到退出码` 必须得同一个 `ended-unknown` —— 这条等价性是本票敢"先记账
 * 再定终态"(不重排 handlers)的唯一理由;它一旦被改成 `failed`,"结果拿不回来"就会被
 * 渲染成"跑失败了",而账面什么都不会红。判据本身没有值域可跑,只能问这一个纯函数。
 * 终态单向门**不放**进这个通道:它只认 `task.status`,由真事件驱动才有意义。
 */
export const __test__ = {
  addSettleListener,
  notifySettled,
  setTerminalNoticeSink,
  toLedgerTerminal,
  /**
   * G-1058645:写账入口与投递入口(`notifySettled`)同权暴露 —— 迟到旧世代的结算只能从
   * handlers 携带的活对象进来,而 key 换代没有任何公开入口(同 G-816002 块头的论证),
   * 测试从这枚口喂"同一枚 key + 旧世代号"的载体。
   */
  ledgerSettle,
  /**
   * G-816003:播报正文的构造器同权暴露 —— "按停止发起方分支"这件事只能在**文本面**被问出
   * (user 档不得含任何"可继续/重跑"的暗示、model/被取代档不得反过来劝"别重跑"、
   * 未知档必须中性),而默认出口是 stderr,靠抓 stderr 断言会把测试绑在控制台编码上(§26)。
   * 只给换构造器、不给换判据:分支次序住在 `backgroundTerminationVocabFor`,那张表是唯一真相源。
   */
  terminalNoticeOf,
};
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
