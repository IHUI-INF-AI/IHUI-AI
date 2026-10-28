// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 后台任务花名册投影(G-937976,[C10] run 内省 roster 投影纪律)。
 *
 * 机制照上游 ZCode `get-workflow-run-roster-output.ts` / `get-workflow-run-format-roster.ts`
 * 的 roster 投影纪律,四条(上游出处:roster-output.ts:5-10,67,78-81,121-124;
 * format-roster.ts:83-99,144-151,201-205):
 *  ① **逐字段搬**:输出行的字段是这里显式列出的这份清单。数据面(`listTasks` 的元数据)哪天
 *     多长出一个字段,原样透传就会让它无声地出现在模型面;逐字段搬等于把「模型面看得到什么」
 *     写死在一处,数据面演进不会从背后改变它。(上游防的是 strict runtimeOutputSchema 击穿;
 *     我方工具输出是 text、无 schema 校验,但「模型面看得到什么写死在一处」这一格同构成立。)
 *  ② **无则缺席**:可选字段一律 `...(x === undefined ? {} : { x })`。显式的 undefined 值与
 *     缺席在 `toStrictEqual` 和 JSON 序列化里是两件事,而模型面的契约是「不知道就没有这个键」
 *     —— 快照缺哪列,输出行就没有哪个键,不补 0、不补空串。
 *  ③ **「不知道」与 0 可分辨**:exitCode 三态各是一件事 —— 数字(含 0)是事实;null 是
 *     "已退出但没记录到退出码"(Windows 外部终止常见 close(null,null),与本文件族
 *     background-registry 的 toLedgerTerminal 落 ended-unknown 判的是同一件事:结果没记到
 *     不许被渲染成完成);undefined 是"还没退出"。绝不 `?? 0`,也绝不把三态折成一个 '-'。
 *  ④ **截断说出口**:花名册按 {@link TASK_ROSTER_LIMITS.maxTasks} 截断,并把「截过」说出口
 *     (truncated=true + 尾部说明行)—— 一个静默少掉几十行的花名册读起来像
 *     「这个会话只有 20 个后台任务」,而那是一句假话。
 */

import type { BackgroundTaskMeta, BackgroundTaskStatus } from './background-registry.js';

/**
 * 花名册投影上限(上游 `GET_WORKFLOW_RUN_ROSTER_LIMITS` 同位物;我方此前无此常数)。
 * 注册表自身保留最近 100 个终态任务(MAX_COMPLETED_TASKS),模型面一次读全是噪音;
 * 上限截断只发生在投影层,数据面(注册表)不动。
 */
export const TASK_ROSTER_LIMITS = {
  /** 花名册最多列出的任务行数(新到旧)。 */
  maxTasks: 20,
} as const;

/**
 * 花名册输出行 —— 「模型面看得到什么」写死在这一份字段清单里(判据①)。
 * 与 `BackgroundTaskMeta` 的字段差异是有意的:数据面哪天多长字段,这里不加就不出现在模型面;
 * 前四列永在,后三列可缺席(判据②)。
 */
export interface TaskRosterRow {
  id: string;
  command: string;
  status: BackgroundTaskStatus;
  startedAt: string;
  /** 终态时刻。running 行没有这件事 —— 缺席,不补空串。 */
  exitedAt?: string;
  /**
   * 三态互异(判据③):数字(含 0)= 事实;null = 已退出但无退出码记录(「不知道」);
   * undefined(键缺席)= 还没退出。
   */
  exitCode?: number | null;
  /** worktree 并行隔离层的关联路径;没有 worktree 的任务没有这个键。 */
  worktreePath?: string;
}

/** 一次逐字段搬运:输出行的每一列都从 meta 显式取出,可选列缺席即不写(判据①②)。 */
export function toTaskRosterRow(meta: BackgroundTaskMeta): TaskRosterRow {
  return {
    id: meta.id,
    command: meta.command,
    status: meta.status,
    startedAt: meta.startedAt,
    ...(meta.exitedAt === undefined ? {} : { exitedAt: meta.exitedAt }),
    ...(meta.exitCode === undefined ? {} : { exitCode: meta.exitCode }),
    ...(meta.worktreePath === undefined ? {} : { worktreePath: meta.worktreePath }),
  };
}

export interface TaskRosterProjection {
  /** 截断后保留的行(新到旧,沿用 listTasks 既有的排序)。 */
  tasks: TaskRosterRow[];
  /** 「截过」必须说出口(判据④):保留行数 < 输入行数 ⇒ true。 */
  truncated: boolean;
  /**
   * 被截掉的行数。为 0 时格式化面不说话 —— `omitted=0` 读起来像一件发生过的事
   * (上游 roster-output.ts:121-124「为 0 时缺席」同格)。
   */
  omittedCount: number;
}

/**
 * 花名册按 {@link TASK_ROSTER_LIMITS.maxTasks} 截断(上游 `toGetWorkflowRunSubagents` 的
 * `truncated: kept.length < subagents.length` 同形,roster-output.ts:67)。
 */
export function projectTaskRoster(metas: readonly BackgroundTaskMeta[]): TaskRosterProjection {
  const kept = metas.slice(0, TASK_ROSTER_LIMITS.maxTasks).map(toTaskRosterRow);
  return {
    tasks: kept,
    truncated: kept.length < metas.length,
    omittedCount: metas.length - kept.length,
  };
}

// ==================== 格式化(模型面的行文) ====================

/** 命令列的显示上界:超出原样截断并补 `...`(声明式截断,不是静默掉行)。 */
const COMMAND_CELL_MAX = 60;

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h${minutes % 60 > 0 ? `${minutes % 60}m` : ''}`;
  return `${minutes}m${totalSeconds % 60 > 0 ? `${totalSeconds % 60}s` : ''}`;
}

/**
 * exitCode 格:三态互异(判据③),绝不 `?? 0` 也绝不折成 '-'。
 *  - 数字(含 0):事实 —— `exitCode=0` 是"正常收场",它是一件发生过的事;
 *  - null:已退出但没记录到退出码 —— 说出口是「未知」,与 0 可分辨;
 *  - undefined(running 行):还没发生的事 —— 没有这一格,缺席。
 */
function exitCodeCell(row: TaskRosterRow): string {
  if (row.exitCode === undefined) return '';
  if (row.exitCode === null) return 'exitCode=未知(无退出码记录)';
  return `exitCode=${row.exitCode}`;
}

/**
 * 时长格(上游 format-roster.ts:144-151 的 phaseDurationCell 同构):
 *  - 有 exitedAt:时长是已结算的事实(`耗时 5s`);
 *  - running:活着的任务说「到现在为止」(`已运行 5s`);
 *  - 终态却没有 exitedAt(类型上可达、当前写路径不产生):什么都不说 —— 拿读时的 now 去减
 *    等于把「进程死后的时间」算进去,那是一句假话(上游 terminal 分支同格)。
 */
function durationCell(row: TaskRosterRow, nowMs: number): string {
  if (row.exitedAt !== undefined) {
    return `耗时 ${formatDuration(Date.parse(row.exitedAt) - Date.parse(row.startedAt))}`;
  }
  if (row.status === 'running') return `已运行 ${formatDuration(nowMs - Date.parse(row.startedAt))}`;
  return '';
}

function rowLine(row: TaskRosterRow, nowMs: number): string {
  const commandCell =
    row.command.length > COMMAND_CELL_MAX
      ? `${row.command.slice(0, COMMAND_CELL_MAX)}...`
      : row.command;
  const cells = [
    `  ${row.id}`,
    `[${row.status}]`,
    commandCell,
    exitCodeCell(row),
    durationCell(row, nowMs),
    `started=${row.startedAt}`,
  ];
  // 空段(= 不知道的事实)直接消失:running 行不留下 "exitCode=" 的空洞(上游 joinCells 同形)。
  return cells.filter((cell) => cell.length > 0).join('  ');
}

/**
 * 花名册行文。截断的说明行放**尾部**(上游 format-roster.ts:201-205 同形:
 * `Only the first N subagents are listed; this run has more.`)—— 头部只说「显示多少个」,
 * 不说总数;总数是尾部说明行的事。
 */
export function formatTaskRoster(projection: TaskRosterProjection, opts?: { now?: number }): string {
  const nowMs = opts?.now ?? Date.now();
  const lines = projection.tasks.map((row) => rowLine(row, nowMs));
  if (projection.truncated) {
    lines.push(
      `(只列出前 ${projection.tasks.length} 个;还有 ${projection.omittedCount} 个未列出。列表按开始时间新到旧排序,更早的任务不展示)`,
    );
  }
  return lines.join('\n');
}
