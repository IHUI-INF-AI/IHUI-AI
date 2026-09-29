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

export type BackgroundTaskStatus = 'running' | 'exited' | 'killed' | 'error';

export interface BackgroundTask {
  id: string;
  command: string;
  process: ChildProcess | null;
  startedAt: string;
  exitedAt?: string;
  exitCode?: number | null;
  status: BackgroundTaskStatus;
  stdoutBuf: string;
  stderrBuf: string;
  truncated: boolean;
  /**
   * 超出 MAX_OUTPUT_PER_TASK 后被丢弃的输出量(下界,按 chunk 计)。
   * G-816028:截断必须能回答"省略了多少"—— 只立一个布尔,模型会把截断文本当全貌。
   */
  droppedStdoutBytes: number;
  droppedStderrBytes: number;
  timedOut: boolean;
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
const MAX_OUTPUT_PER_TASK = 1024 * 1024;

const tasks = new Map<string, BackgroundTask>();

function genId(): string {
  return `bg_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
}

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
  if (exitCode === 0) return 'succeeded';
  if (typeof exitCode === 'number') return 'failed';
  return 'ended-unknown';
}

/**
 * 落台账。**台账失败不改判任务** —— 它是观测面不是执行面,但失败必须留痕:
 * `background-ledger` 自己把失败压进告警队列,呈现点(`repl` 的 `/bg list`)会把它喊出来。
 */
function ledgerSettle(task: BackgroundTask, note: string): void {
  recordTaskSettle({
    id: task.id,
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
    'id' | 'command' | 'startedAt' | 'exitedAt' | 'exitCode' | 'status' | 'stdoutBuf' | 'stderrBuf' | 'truncated' | 'droppedStdoutBytes' | 'droppedStderrBytes' | 'timedOut'
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
    truncated: t.truncated,
    droppedStdoutBytes: t.droppedStdoutBytes,
    droppedStderrBytes: t.droppedStderrBytes,
    timedOut: t.timedOut,
  });
}

/**
 * 终态监听器:task.id → 等待者集合。
 * 回调参数是**该任务那一刻的快照**;null 表示"任务已从注册表消失,无人能给出终态"。
 */
type SettleListener = (snapshot: BackgroundTaskSnapshot | null) => void;
const settleListeners = new Map<string, Set<SettleListener>>();

/**
 * 挂一个终态监听器,返回撤销函数。
 *
 * **必须在读状态之前登记**(调用方 `waitForTask` 里那条判序是载荷性的):
 * 反过来(先读到 running → 再挂监听)会在"读"与"挂"之间漏掉那次终态,
 * 于是这个等待者只能等自己的 deadline 到点,把一个**其实早就结束**的任务报成
 * `timed-out-unknown`。这类漏登记在单线程下也能发生 —— await 就是让出点。
 */
function addSettleListener(id: string, fn: SettleListener): () => void {
  let set = settleListeners.get(id);
  if (!set) {
    set = new Set();
    settleListeners.set(id, set);
  }
  set.add(fn);
  return () => {
    const current = settleListeners.get(id);
    if (!current) return;
    current.delete(fn);
    // 逐层删空集合:留着空 Set 就是让 Map 只增不减
    if (current.size === 0) settleListeners.delete(id);
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
 */
function notifySettled(task: BackgroundTask): void {
  const set = settleListeners.get(task.id);
  // 没有等待者就没有"待投递的东西",也就不该消耗 claim —— 位一旦被一个不存在的接收方
  // 占掉,随后登记进来的等待者会被 ① 拒收,而它从来没有被通知过。
  if (!set || set.size === 0) return;
  if (task.notified) return; // ① 本轮已投递过,不重复
  task.notified = true;
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
 */
export function registerTask(
  process: ChildProcess | null,
  command: string,
  opts?: { worktreePath?: string; worktreeSourcePath?: string },
): string {
  const id = genId();
  const task: BackgroundTask = {
    id,
    command,
    process,
    startedAt: new Date().toISOString(),
    status: 'running',
    stdoutBuf: '',
    stderrBuf: '',
    truncated: false,
    droppedStdoutBytes: 0,
    droppedStderrBytes: 0,
    timedOut: false,
    notified: false,
    worktreePath: opts?.worktreePath,
    worktreeSourcePath: opts?.worktreeSourcePath,
  };
  tasks.set(id, task);

  // 台账先落一条"已开始、无终态"的记录:进程一旦被宿主清掉而没人写终态,
  // 读侧就会把它判成 detached-unknown —— 这是"能被看见"的唯一前提。
  recordTaskStart({ id, command, childPid: process?.pid ?? null });

  if (process) {
    process.stdout?.on('data', (chunk: Buffer) => {
      if (task.stdoutBuf.length < MAX_OUTPUT_PER_TASK) {
        task.stdoutBuf += chunk.toString('utf-8');
        if (task.stdoutBuf.length >= MAX_OUTPUT_PER_TASK) {
          task.truncated = true;
          // G-816028:跨界那一段的溢出同样是被丢弃的输出,必须与 else 分支同一口径(字符)入账,
          // 否则"已省略 ≥N"在单大块输出下会少报。
          task.droppedStdoutBytes += task.stdoutBuf.length - MAX_OUTPUT_PER_TASK;
          task.stdoutBuf = task.stdoutBuf.slice(0, MAX_OUTPUT_PER_TASK);
        }
      } else {
        // G-816028:丢弃也要记账,否则"截断了"回答不了"省略了多少"。按字符计,与缓冲上限同口径。
        task.droppedStdoutBytes += chunk.toString('utf-8').length;
      }
      recordHeartbeat(id); // 有输出就是"还活着"的证据(模块内按 30s 节流)
    });
    process.stderr?.on('data', (chunk: Buffer) => {
      if (task.stderrBuf.length < MAX_OUTPUT_PER_TASK) {
        task.stderrBuf += chunk.toString('utf-8');
        if (task.stderrBuf.length >= MAX_OUTPUT_PER_TASK) {
          task.truncated = true;
          task.droppedStderrBytes += task.stderrBuf.length - MAX_OUTPUT_PER_TASK;
          task.stderrBuf = task.stderrBuf.slice(0, MAX_OUTPUT_PER_TASK);
        }
      } else {
        task.droppedStderrBytes += chunk.toString('utf-8').length;
      }
      recordHeartbeat(id);
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
        task.timedOut = signal === 'SIGTERM';
      } else {
        task.status = 'exited';
      }
      task.process = null;
      // 任务结束,自动清理关联 worktree
      cleanupTaskWorktree(task);
      pruneCompleted();
      ledgerSettle(task, signal ? `closed by signal ${signal}` : 'closed');
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
    command,
    process: null,
    startedAt: new Date().toISOString(),
    exitedAt: new Date().toISOString(),
    exitCode: null,
    status: 'error',
    stdoutBuf: '',
    stderrBuf: errorMessage,
    truncated: false,
    droppedStdoutBytes: 0,
    droppedStderrBytes: 0,
    timedOut: false,
    // 占位任务生下来就是终态,但"已投递"位仍要显式起在 false:
    // 它标的是"有没有把终态交给过等待者",不是"是不是终态"—— 两者分开,
    // 单向门与 claim 才各自有牙(见 notifySettled 判据①)。
    notified: false,
  };
  tasks.set(id, task);
  pruneCompleted();
  // 占位任务从未有过进程,但同样要进台账:否则"沙盒拒绝"这一类任务在重启后彻底查无此事。
  recordTaskSettle({
    id,
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

export interface TaskOutput {
  id: string;
  status: BackgroundTaskStatus;
  stdout: string;
  stderr: string;
  truncated: boolean;
  /** 丢弃量下界(字节):G-816028 要求截断时能回答"省略了多少"。 */
  droppedStdoutBytes: number;
  droppedStderrBytes: number;
  exitCode?: number | null;
  startedAt: string;
  exitedAt?: string;
}

/**
 * G-816028 的诚实截断注记:截断必须同时回答"省略了多少"与"全量还在不在"。
 * 我方没有全量落盘 —— 超出 MAX_OUTPUT_PER_TASK 的部分**当场丢弃且继续丢**,
 * 所以诚实的说法是"未保留全量",而不是上游那种 `[Truncated. Full output: <path>]`
 * (它有 artifact 文件才写得出来;照抄会变成一句兑现不了的话)。
 */
export function formatTruncatedNote(dropped: { droppedStdoutBytes: number; droppedStderrBytes: number }): string {
  const total = dropped.droppedStdoutBytes + dropped.droppedStderrBytes;
  return `[输出被截断: 已省略 ≥${total} 字符;超出单任务上限(每流 1MiB)的部分未保留,后续输出同样被丢弃,需要完整输出请重跑任务]`;
}

/** 获取任务输出,支持 tail 截取最后 N 行(默认全部)。 */
export function getTaskOutput(id: string, tailLines?: number): TaskOutput | null {
  const t = tasks.get(id);
  if (!t) return null;
  let stdout = t.stdoutBuf;
  let stderr = t.stderrBuf;
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
    truncated: t.truncated,
    droppedStdoutBytes: t.droppedStdoutBytes,
    droppedStderrBytes: t.droppedStderrBytes,
    exitCode: t.exitCode,
    startedAt: t.startedAt,
    exitedAt: t.exitedAt,
  };
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
export async function killTask(id: string): Promise<{ killed: boolean; reason?: string; exitConfirmed: boolean }> {
  const t = tasks.get(id);
  if (!t) return { killed: false, exitConfirmed: false, reason: `任务 ${id} 不存在` };
  if (t.status !== 'running') return { killed: false, exitConfirmed: true, reason: `任务已结束(状态: ${t.status})` };
  if (!t.process) return { killed: false, exitConfirmed: false, reason: '无进程引用' };

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

/** 清理已完成任务,保留最近 MAX_COMPLETED_TASKS 个。 */
function pruneCompleted(): void {
  const completed = listTasks().filter((t) => t.status !== 'running');
  if (completed.length <= MAX_COMPLETED_TASKS) return;
  const toRemove = completed.slice(MAX_COMPLETED_TASKS);
  for (const t of toRemove) {
    // 被裁掉的都是非 running 的任务 ⇒ 终态通知早已在 close/error 里发过。
    // 这里仍要摘监听器集合,否则一个"任务已被删除"的键会把监听器永久留在 Map 里。
    settleListeners.delete(t.id);
    tasks.delete(t.id);
  }
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
  for (const id of settleListeners.keys()) {
    const set = settleListeners.get(id);
    if (!set) continue;
    settleListeners.delete(id);
    for (const fn of Array.from(set)) {
      try {
        fn(null);
      } catch {
        /* 单个等待者的清理体内抛错不带崩整表清空 */
      }
    }
  }
  tasks.clear();
}

// ==================== /loop 周期任务(内存版) ====================

export interface LoopTask {
  id: string;
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

export function startLoop(opts: StartLoopOptions): { id: string; intervalMs: number } | { error: string } {
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

  return { id, intervalMs };
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

export function stopLoop(id: string): boolean {
  const l = loops.get(id);
  if (!l) return false;
  clearInterval(l.timer);
  loops.delete(id);
  return true;
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
 * 为什么只暴露这两个:投递的 claim/回退语义要能**脱离真实进程事件**被驱动
 * (一个会抛错的监听者体内没有任何生产入口能构造出来 —— `waitForTask` 自己的监听体
 * 只做 resolve,而 resolve 不抛)。把 `addSettleListener`/`notifySettled` 交出去,
 * 判据就能被成对用例正面问出"抛错之后位有没有回退、下一次还能不能投",
 * 而不必靠改产品代码去撞一条不可达分支。
 * 终态单向门**不放**进这个通道:它只认 `task.status`,由真事件驱动才有意义。
 */
export const __test__ = {
  addSettleListener,
  notifySettled,
};
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
