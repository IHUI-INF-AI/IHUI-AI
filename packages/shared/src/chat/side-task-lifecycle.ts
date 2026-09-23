// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D75 侧边任务生命周期(G-102,2026-09-24 立)—— 共享层判定。
//
// **自证结论(改本文件前必读)**:D28 的 `/side` 只有「解析 + 即答 + 入队」三个瞬间动作
// (`apps/web/src/hooks/use-chat/slash-commands.ts` 的 tryHandleSideSlash /
// answerSideQuestion,+ `stores/chat.ts` 的 sideQueueByConversation),**没有任何生命周期**:
//   · 回答只写本地消息流(`meta.sidechat`),不进主线历史、不调 persistMessageSafe
//     —— 事实上的「临时任务」,但用户侧**从未被显式声明过**;
//   · 队列条目只有 {id, text, createdAt},没有保留窗口、没有过期、没有清理入口;
//   · 没有并行运行位置说明、没有文件变更计数入口、没有关闭前确认判据。
// 本模块补的正是这五件空缺,**但不接管队列**:W27 预备消息优先规则保持不变
// (`message-input.tsx` 流结束 effect:`pendingMessages.length > 0` 先出队发送,
// 仅当无预备消息时才 `answerCurrentSideQuestion()`;且 `use-message-send.ts` 明文
// 「侧问正文……不进 W27 队列」)。本模块**不导出任何入队 / 发送能力**,所有函数均为纯函数
// (输入不可被篡改,见 `__tests__` 的「冻结输入」用例),因此不可能改变该优先级。
//
// **数据面纪律(与 D72 `worktree-lifecycle` 同)**:不取数。任务对象由调用方注入;
// 批量清理只**返回**被清理项(渲染件据此渲染「来自已清理的 {标题}」),本模块不落存、不发命令。
//
// 四态(顺序即生命周期顺序):running(运行中) / completed(已完成) /
// expired(已过期) / cleaned(已清理)。**只有 `cleaned` 是终态** —— completed 仍可能
// 走到 expired → cleaned,把它当终态会提前宣称「不用管了」。

/** 侧边任务生命周期四态(取值即 i18n 键片段;`ai.pane.sideTask.state.<key>`) */
export const SIDE_TASK_LIFECYCLE_STATES = ['running', 'completed', 'expired', 'cleaned'] as const
export type SideTaskState = (typeof SIDE_TASK_LIFECYCLE_STATES)[number]

/** 语义色档(判定层只给语义,具体样式由渲染件决定) */
export const SIDE_TASK_TONES = ['info', 'success', 'warning', 'neutral'] as const
export type SideTaskTone = (typeof SIDE_TASK_TONES)[number]

/** 并行运行位置两种:**同文件夹** / **同环境**(用户需要知道自己改动落在哪儿) */
export const SIDE_TASK_RUN_LOCATIONS = ['sameFolder', 'sameEnvironment'] as const
export type SideTaskRunLocation = (typeof SIDE_TASK_RUN_LOCATIONS)[number]

/** 卡片动作族(数据面在调用方;`cleanup` 仅在 expired 态给入口) */
export const SIDE_TASK_ACTIONS = ['close', 'confirmClose', 'cancelClose', 'cleanup'] as const
export type SideTaskAction = (typeof SIDE_TASK_ACTIONS)[number]

/** 词包命名空间(web 侧 `useTranslations('ai.pane.sideTask')`) */
export const SIDE_TASK_NAMESPACE = 'ai.pane.sideTask' as const

/**
 * **显式声明**的文案键 —— 「临时任务关闭后消失」。
 *
 * 这是一条**独立于状态之外**的常驻声明:四态 `ephemeralNoticeKey` 恒为该键,
 * 运行(刚创建)时就渲染,而不是等任务被清理后才告知(届时用户已经丢了东西)。
 */
export const SIDE_TASK_EPHEMERAL_NOTICE_KEY = 'ephemeralNotice' as const

/** 临时侧任务的默认保留窗口(24h):超时未取走 ⇒ 可被清理 */
export const DEFAULT_SIDE_TASK_TTL_MS = 24 * 60 * 60 * 1000

/** 侧边任务(调用方注入的事实;本模块不构造、不补默认值以外的字段) */
export interface SideTask {
  readonly id: string
  /** 标题(`/side` 的问题正文,已 trim;`来自已清理的 {标题}` 的插值源) */
  readonly title: string
  readonly state: SideTaskState
  /** 创建时间戳(Date.now() ms) */
  readonly createdAt: number
  /** 并行运行位置:与主任务**同文件夹** / **同环境** */
  readonly location: SideTaskRunLocation
  /** 变更文件数;缺省按 0 处理(0 走明确空态文案,不得显示「0」了事) */
  readonly changedFiles?: number
  /** 未落盘产物数;>0 ⇒ 关闭前必须确认 */
  readonly unsavedArtifacts?: number
  /** 仍在跑的子进程数;>0 ⇒ 关闭前必须确认 */
  readonly runningChildProcesses?: number
  /** 显式过期时间戳(ms);缺省时按 createdAt + DEFAULT_SIDE_TASK_TTL_MS 计 */
  readonly expiresAt?: number
}

/** 文件变更计数派发结果 */
export interface SideTaskChangedFiles {
  /** 归一化后的计数(负数 / 非数 / 小数一律归到 [,>0]) */
  readonly count: number
  /** true ⇒ 走空态文案 `files.empty` */
  readonly empty: boolean
  /** i18n 键(`ai.pane.sideTask.files.<…>`) */
  readonly key: string
  /** 插值参数;空态为 undefined(不插 count,避免出现「0」) */
  readonly values: { readonly count: string } | undefined
}

/** 批量清理出来的条目(渲染件据此渲染「来自已清理的 {标题}」) */
export interface CleanedSideTaskEntry {
  readonly id: string
  /** 原标题(保留给 ICU 插值;内容已不可取,标题是唯一残留信息) */
  readonly title: string
  /** i18n 键(含 `{title}` 占位) */
  readonly labelKey: string
  /** 插值参数 */
  readonly values: { readonly title: string }
}

/** 「来自已清理的 {标题}」的判据位;非 cleaned 态一律 null(不与 expired 同形) */
export interface SideTaskCleanedFrom {
  readonly key: string
  readonly title: string
  readonly values: { readonly title: string }
}

export interface SideTaskView {
  readonly state: SideTaskState
  readonly tone: SideTaskTone
  /** `ai.pane.sideTask` 内的标题键 */
  readonly titleKey: string
  /** `ai.pane.sideTask` 内的 aria-label 键(读屏用,比标题更完整) */
  readonly ariaKey: string
  /** 临时任务关闭后消失的**显式声明**键(四态恒非空) */
  readonly ephemeralNoticeKey: string
  /** 补充说明键;`expired` / `cleaned` 非空,其余态不画蛇添足 */
  readonly hintKey: string | null
  /** 并行运行位置键(`location.<location>`) */
  readonly locationKey: string
  /** 位置本体(渲染件直接取值,免得再解一次 location 字段) */
  readonly location: SideTaskRunLocation
  /** 「来自已清理的 {标题}」;仅 cleaned 非空 */
  readonly cleanedFrom: SideTaskCleanedFrom | null
  /** 文件变更计数(已归一化,含空态文案位) */
  readonly files: SideTaskChangedFiles
  /** 未落盘产物数(归一化) */
  readonly unsavedArtifacts: number
  /** 仍在跑的子进程数(归一化) */
  readonly runningChildProcesses: number
  /** 关闭前是否必须确认(见 `needsCloseConfirm`) */
  readonly needsCloseConfirm: boolean
  /** 是否终态(四态里**只有 cleaned**) */
  readonly terminal: boolean
}

const STATE_SET: ReadonlySet<string> = new Set<string>(SIDE_TASK_LIFECYCLE_STATES)
const LOCATION_SET: ReadonlySet<string> = new Set<string>(SIDE_TASK_RUN_LOCATIONS)

export function isSideTaskState(value: string): value is SideTaskState {
  return STATE_SET.has(value)
}

export function isSideTaskRunLocation(value: string): value is SideTaskRunLocation {
  return LOCATION_SET.has(value)
}

/** 非正整数 / 非有限数一律归 0(脏数据源不值得第三个分支) */
function normalizeCount(n: number | undefined): number {
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return 0
  return Math.floor(n)
}

/**
 * 文件变更计数入口。
 *
 * `n <= 0`(含缺省 / 负数 / NaN)走**明确空态文案** `files.empty`,
 * 而不是渲染一个孤零零的「0」—— 用户要的是「改没改」,不是「计数是多少」。
 */
export function formatChangedFilesCount(n: number | undefined): SideTaskChangedFiles {
  const count = normalizeCount(n)
  if (count === 0) {
    return { count: 0, empty: true, key: 'files.empty', values: undefined }
  }
  return { count, empty: false, key: 'files.changedCount', values: { count: String(count) } }
}

/**
 * 过期判定。
 *
 * 判定顺序(逐条可测,不臆断):
 *   1. `cleaned` ⇒ true(内容已不可取,过期性上等价于过期);
 *   2. `expired` ⇒ true(已被标记过期,不得再出现「标记过期但判定未过期」的两套真相);
 *   3. `running` ⇒ false(**保留窗口只对"已产出、待取走"的结果计时**;在跑的任务
 *      不适用过期,它由「运行多久」而不是「产出多久」决定命运);
 *   4. `expiresAt` 已知 ⇒ `now > expiresAt`;
 *   4. 否则 ⇒ `now > createdAt + DEFAULT_SIDE_TASK_TTL_MS`;
 *   5. `now` 非有限数 ⇒ false(时钟不可信时不清理)。
 */
export function isSideTaskExpired(task: SideTask | null | undefined, now: number): boolean {
  if (!task) return false
  if (task.state === 'cleaned' || task.state === 'expired') return true
  if (task.state === 'running') return false
  if (!Number.isFinite(now)) return false
  const createdAt = Number.isFinite(task.createdAt) ? task.createdAt : NaN
  const explicit = task.expiresAt
  const deadline =
    typeof explicit === 'number' && Number.isFinite(explicit)
      ? explicit
      : Number.isFinite(createdAt)
        ? createdAt + DEFAULT_SIDE_TASK_TTL_MS
        : NaN
  if (!Number.isFinite(deadline)) return false
  return now > deadline
}

/**
 * 关闭前确认弹层判据。
 *
 * · 有未落盘产物(`unsavedArtifacts > 0`)/ 有在跑子进程(`runningChildProcesses > 0`)
 *   ⇒ 必须确认(关闭即消失,且这些产物/进程一并没了);
 * · `running` 态 ⇒ 必须确认(就算暂时没有子进程,关闭运行中的任务也是不可逆的);
 * · **纯已完成态**(completed 且无产物无子进程)⇒ **不打扰**;
 * · `cleaned` ⇒ 不打扰(已经 clean 完了,没什么可确认的)。
 */
export function needsCloseConfirm(task: SideTask | null | undefined): boolean {
  if (!task) return false
  if (task.state === 'cleaned') return false
  if (task.state === 'running') return true
  return normalizeCount(task.unsavedArtifacts) > 0 || normalizeCount(task.runningChildProcesses) > 0
}

/**
 * 批量清理:**返回**被清理项(供渲染「来自已清理的 {标题}」),不落存、不改输入。
 *
 * 收与不收的边界:
 *   · `running` **不收**(在跑的任务不能被自家生命周期收走 —— 与 `needsCloseConfirm`
 *     「运行中要确认」同源,是本模块对「别吓着用户」的一致约束);
 *   · `cleaned` **不重复收**(幂等:已清理的不该再报一次「已清理」);
 *   · `completed` 走 `isSideTaskExpired` 的时间窗判据;`expired` 态直接收。
 */
export function collectExpiredSideTasks(
  tasks: readonly SideTask[],
  now: number,
): CleanedSideTaskEntry[] {
  if (!Array.isArray(tasks)) return []
  const out: CleanedSideTaskEntry[] = []
  for (const task of tasks) {
    if (!task) continue
    if (task.state === 'running' || task.state === 'cleaned') continue
    if (!isSideTaskExpired(task, now)) continue
    const title = task.title
    out.push({
      id: task.id,
      title,
      labelKey: 'cleanedFrom',
      values: { title },
    })
  }
  return out
}

/**
 * 任务 → 视图判据的**唯一**派发点。
 *
 * switch 穷尽四态、**无 default**:漏改任一态 ⇒ `task.state` 无法收窄为 `never`,
 * `assertNeverState` 处编译失败(新增态必须同步补判据,否则构建拦截)。
 */
export function sideTaskView(task: SideTask | null | undefined): SideTaskView | null {
  if (!task) return null
  const files = formatChangedFilesCount(task.changedFiles)
  const unsavedArtifacts = normalizeCount(task.unsavedArtifacts)
  const runningChildProcesses = normalizeCount(task.runningChildProcesses)
  const confirm = needsCloseConfirm(task)
  const base = {
    ephemeralNoticeKey: SIDE_TASK_EPHEMERAL_NOTICE_KEY,
    locationKey: runningLocationKey(task.location),
    location: task.location,
    files,
    unsavedArtifacts,
    runningChildProcesses,
    needsCloseConfirm: confirm,
  }
  switch (task.state) {
    case 'running':
      // 运行中:显式声明必须在**此刻**就出现(刚创建就该告知会消失),不给提示性补充
      return {
        ...base,
        state: 'running',
        tone: 'info',
        titleKey: sideTaskStateKey('running'),
        ariaKey: sideTaskAriaKey('running'),
        hintKey: null,
        cleanedFrom: null,
        terminal: false,
      }
    case 'completed':
      // 已完成:可随时被清理,故**不是**终态;无产物无子进程时不打扰用户
      return {
        ...base,
        state: 'completed',
        tone: 'success',
        titleKey: sideTaskStateKey('completed'),
        ariaKey: sideTaskAriaKey('completed'),
        hintKey: null,
        cleanedFrom: null,
        terminal: false,
      }
    case 'expired':
      // 已过期:必须说明「超过临时保留时限、可被清理」,与 cleaned **不同形**
      return {
        ...base,
        state: 'expired',
        tone: 'warning',
        titleKey: sideTaskStateKey('expired'),
        ariaKey: sideTaskAriaKey('expired'),
        hintKey: 'hint.expired',
        cleanedFrom: null,
        terminal: false,
      }
    case 'cleaned':
      // 已清理:唯一终态 —— 内容已不可取,只留下「来自已清理的 {标题}」
      return {
        ...base,
        state: 'cleaned',
        tone: 'neutral',
        titleKey: sideTaskStateKey('cleaned'),
        ariaKey: sideTaskAriaKey('cleaned'),
        hintKey: 'hint.cleaned',
        cleanedFrom: {
          key: 'cleanedFrom',
          title: task.title,
          values: { title: task.title },
        },
        terminal: true,
      }
  }
  return assertNeverState(task.state)
}

/** 编译期穷尽性断言(运行时兜底;正常路径不可达) */
function assertNeverState(state: never): never {
  throw new Error(`unhandled side task state: ${String(state)}`)
}

/** 四态 → i18n 标题键(`ai.pane.sideTask.state.<key>`) */
export function sideTaskStateKey(state: SideTaskState): string {
  return `state.${state}`
}

/** 四态 → i18n aria-label 键(`ai.pane.sideTask.aria.<key>`) */
export function sideTaskAriaKey(state: SideTaskState): string {
  return `aria.${state}`
}

/** 并行运行位置 → i18n 键(`ai.pane.sideTask.location.<key>`) */
export function runningLocationKey(location: SideTaskRunLocation): string {
  return `location.${location}`
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
