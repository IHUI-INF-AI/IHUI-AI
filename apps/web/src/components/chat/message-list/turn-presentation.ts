// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 轮次呈现投影层(turn presentation projection)—— 纯函数 + 版本化缓存,单一真相源。
 *
 * 立因(2026-10-29,对标 Qoder CN 0.4.11 逆向出的第六层):UI **不直接渲染 messages 数组**,
 * 而是先把消息投影成 presentation rows。三条要学的设计(不是照抄代码,是学结构):
 *   ① 行类型有语义分级:`message`(用户消息 / 不该被聚合的助手消息)/ `thinkingAgent`
 *      (一条助手轮次的容器,聚合本轮全部助手消息)/ `activity-group`(一条助手消息内的
 *      工具活动组,带 parts + toolsSummary + activityOrder + isExploring);
 *   ② `isExploring` 是**独立语义位**:「Agent 正在探索(读文件/搜索/列目录)」与
 *      「正在思考」是两种动效、两种文案,不可合并成一句"正在处理";
 *   ③ 投影结构带**版本号 + 缓存**:源消息引用/版本不变 ⇒ 返回上一轮投影的同一引用,
 *      于是流式每帧只需增量重算"最后一行",前缀行引用逐格不变(React 侧天然跳过重渲染)。
 *
 * 职责边界(§0.6 单一真相源,违反即返工):
 *   - 本模块**只做**分组 / 聚合 / 排序 / 版本,**不重新实现**类目映射、工具摘要计数、折叠判定;
 *   - 工具 → 类目:唯一源 `@/components/ai/progress-sections/tool-category` 的 `resolveToolCategory`
 *     (18 个具名类目,含 `NEVER_FOLD_TOOLS` 与 `CategoryDef.neverFold` 的同一张表);
 *   - 工具摘要:唯一源 `@ihui/shared/chat` 的 `summarizeToolActivity`(共享层出口);
 *   - 折叠判定:唯一源 `./fold-policy`(本模块不判折叠,只投影结构)。
 *
 * 为什么 `isExploring` 选 `resolveToolCategory` 而**不是**共享层 `packages/shared/src/chat/
 * tool-category.ts` 的 `toolCategory`:
 *   - `toolCategory` 是**对象维度**五分类(file / image / search / thinking / custom),
 *     供"类目级双时态动词"取词用;它的 `file` 族把 `read_file`(读)与 `write_file` /
 *     `edit_file` / `delete_file`(写)放在**同一个类目**里 —— 用它判"是否在探索"会把
 *     "正在改文件"读成"正在探索",或反过来把"正在读文件"读成"正在改"。这是语义错,不是取舍。
 *   - `resolveToolCategory` 是**动作维度**十八分类,`file_read` / `file_search` / `web_search`
 *     与 `file_write` / `file_modify` / `file_delete` / `command` 各自独立,正好是
 *     「探索 vs 变更」这条线需要的分辨率;且它已经是折叠例外集(`isNeverFoldTool`)的同一张表,
 *     同一张表回答两件事,不产生第二套口径。
 *   - 因此:本模块只列**类目键**(`EXPLORING_CATEGORY_KEYS`),**一个工具名字面量都不列** ——
 *     新增工具只改 `tool-category.ts` 的 `EXACT_MAP`,本模块与全部消费方零改动。
 */

import type { ToolActivitySummary } from '@ihui/shared/chat'
import { summarizeToolActivity } from '@ihui/shared/chat'
import {
  resolveToolCategory,
  type CategoryKey,
} from '@/components/ai/progress-sections/tool-category'
import type { ChatMessage, ToolCall } from '@/stores/chat'

// ─── 行类型判别联合 ───────────────────────────────────────────────────────

/** 呈现行的三种语义级(与 Qoder 的 message / thinkingAgent / activity-group 一一对应)。 */
export type PresentationRowType = 'message' | 'thinkingAgent' | 'activity-group'

/** `message` 行:用户消息、system 条目,以及**不该被聚合**的助手消息(失败轮等)。 */
export interface MessageRow {
  readonly type: 'message'
  readonly id: string
  /** 所属轮次 id(该轮用户消息 id;无用户消息的前导助手行取本段首条消息 id)。 */
  readonly turnId: string
  readonly role: ChatMessage['role']
  readonly message: ChatMessage
}

/**
 * `activity-group` 行:一条助手消息内的工具活动组。
 *
 * 字段与 Qoder 的 `qO1()` 同义:parts / startIndex / endIndex / toolsSummary /
 * activityOrder / isExploring。**计数与分类一律来自单一真相源**,本层零复算。
 */
export interface ActivityGroupRow {
  readonly type: 'activity-group'
  readonly id: string
  readonly turnId: string
  readonly messageId: string
  /** 该消息的工具调用(时序原样,不排序 —— 时序是"同类连续聚合成一张卡"的前提)。 */
  readonly parts: readonly ToolCall[]
  readonly startIndex: number
  readonly endIndex: number
  /** 共享层 `summarizeToolActivity` 的产出(总数 / 运行中 / 失败 / 五类分布)。 */
  readonly toolsSummary: ToolActivitySummary
  /** 逐 part 的动作类目序列(`resolveToolCategory` 原样,不去重,保留时序)。 */
  readonly activityOrder: readonly CategoryKey[]
  /** 此刻是否在**探索**(读文件 / 搜索 / 列目录)。与"在思考"是两件事,见下方语义说明。 */
  readonly isExploring: boolean
}

/** `thinkingAgent` 行:一条助手轮次的容器,聚合本轮全部可聚合的助手消息。 */
export interface ThinkingAgentRow {
  readonly type: 'thinkingAgent'
  readonly id: string
  readonly turnId: string
  readonly messages: readonly ChatMessage[]
  /** 本轮**当前**动作是否在探索(取最后一条带工具的消息判);无活动 = false。 */
  readonly isExploring: boolean
  /** 本轮产出的活动组行 id(顺序即渲染顺序),便于宿主持 id 索引子行。 */
  readonly activityIds: readonly string[]
}

export type PresentationRow = MessageRow | ActivityGroupRow | ThinkingAgentRow

// ─── isExploring 语义位 ───────────────────────────────────────────────────

/**
 * "探索"类目集(只列**类目键**,零工具名字面量)。
 *
 * - `file_read`  读文件 / 列目录(`read_file` / `list_dir` …)
 * - `file_search` 代码库检索(`search_codebase` / `grep` / `glob` …)
 * - `web_search` 网页检索与抓取(`web_search` / `fetch_url` …)
 *
 * 刻意不含:
 * - `command` —— 执行命令可能是构建/测试/安装,不必然是"探索";
 * - `preview` —— 打开预览/浏览器导航是**呈现**动作,不是取材动作(混进来会让"打开面板"
 *   亮成"正在探索");
 * - `thinking` —— 这正是要与探索**分开**的那一格(两种动效两种文案的立因)。
 */
export const EXPLORING_CATEGORY_KEYS: readonly CategoryKey[] = [
  'file_read',
  'file_search',
  'web_search',
]

/** 该工具调用的类目是否属于"探索"族(判据只经 `resolveToolCategory`)。 */
export function isExploringActivity(toolCall: ToolCall): boolean {
  return EXPLORING_CATEGORY_KEYS.includes(resolveToolCategory(toolCall.toolName))
}

/**
 * 一组活动"此刻"是否在探索。
 *
 * 语义刻意收在**现在时**:取时序上最后一条活动,且它必须仍在运行
 * (`status === 'running'`)—— 已结束的读取不是"正在探索",完成态该走完成态文案;
 * 把完成态也算成探索,会让一个已经交出答案的轮次永远亮着"探索中"动效(失效方向是把
 * 假陈述渲染给用户,本仓 §0.10 的同型禁令)。
 *
 * 空组 ⇒ false(不臆造)。
 */
export function currentActivityIsExploring(parts: readonly ToolCall[]): boolean {
  const last = parts[parts.length - 1]
  if (!last) return false
  if (last.status !== 'running') return false
  return isExploringActivity(last)
}

// ─── 行的构造(单条消息 / 单个轮次)─────────────────────────────────────────

/** 该消息是否带"中间过程"(只有带过程的消息才值得被容器聚合)。 */
export function hasIntermediateActivity(message: ChatMessage): boolean {
  if ((message.toolCalls?.length ?? 0) > 0) return true
  if (message.reasoning && message.reasoning.length > 0) return true
  if ((message.planSteps?.length ?? 0) > 0) return true
  if ((message.subagentActivities?.length ?? 0) > 0) return true
  if ((message.terminalTasks?.length ?? 0) > 0) return true
  return false
}

/**
 * 该助手消息是否**不该被聚合**(必须独占一行)。
 *
 * 目前只有一族:失败轮(`error`)。理由不是体量,而是入口:失败气泡承载重试 / 交接单 /
 * 额度动作族,收进折叠容器就等于把"该点哪儿"藏起来(与 `NEVER_FOLD_TOOLS` 同一判断口径)。
 * system 条目与用户消息天然不聚合(它们不是助手轮次),由分组层先分流。
 */
export function isUnaggregatableAssistantMessage(message: ChatMessage): boolean {
  return message.role === 'assistant' && message.error === true
}

/**
 * 一段连续助手消息是否值得容器化。
 *
 * 判据两条(任成立即聚合):
 *  - 段内 ≥2 条(多段助手输出本身就是"一个 agent 的连续动作");
 *  - 段内单条但**带中间过程**(工具 / 思考 / 计划 / 子代理 / 终端) —— 单条纯答案不套容器,
 *    否则每条普通回答外面都会多一层无信息的壳。
 */
export function shouldAggregateAssistantRun(run: readonly ChatMessage[]): boolean {
  if (run.length === 0) return false
  if (run.some((m) => isUnaggregatableAssistantMessage(m))) return false
  if (run.length > 1) return true
  const only = run[0]
  return only ? hasIntermediateActivity(only) : false
}

/** 活动组行的唯一构造点(纯函数)。`groupIndex` 用于 id 稳定性。 */
export function buildActivityGroupRow(
  message: ChatMessage,
  turnId: string,
  groupIndex = 0,
): ActivityGroupRow | null {
  const parts = message.toolCalls ?? []
  if (parts.length === 0) return null
  return {
    type: 'activity-group',
    id: `activity:${message.id}:${groupIndex}`,
    turnId,
    messageId: message.id,
    parts,
    startIndex: 0,
    endIndex: Math.max(0, parts.length - 1),
    toolsSummary: summarizeToolActivity(
      parts.map((tc) => ({ toolName: tc.toolName, status: tc.status })),
    ),
    activityOrder: parts.map((tc) => resolveToolCategory(tc.toolName)),
    isExploring: currentActivityIsExploring(parts),
  }
}

/** 单条消息独占一行的 row(用户 / system / 不该聚合的助手消息)。 */
function buildMessageRow(message: ChatMessage, turnId: string): MessageRow {
  return { type: 'message', id: `message:${message.id}`, turnId, role: message.role, message }
}

// ─── 分组:消息数组 → 轮次 → 行 ────────────────────────────────────────────

type Segment =
  | { readonly kind: 'single'; readonly message: ChatMessage }
  | { readonly kind: 'assistant-run'; readonly messages: readonly ChatMessage[] }

interface Turn {
  readonly turnId: string
  /** 本轮的源消息引用(缓存判等的唯一依据 —— 引用未变即"这一轮没动")。 */
  readonly refs: readonly ChatMessage[]
  readonly segments: readonly Segment[]
}

/** 把消息数组切成"轮次"(用户消息开新轮;轮次内的助手消息再切成段)。纯函数。 */
export function groupTurns(messages: readonly ChatMessage[]): Turn[] {
  const turns: Turn[] = []
  let current: { turnId: string; refs: ChatMessage[]; segments: Segment[] } | null = null
  let run: ChatMessage[] = []

  const flushRun = () => {
    if (!current || run.length === 0) {
      run = []
      return
    }
    // 可聚合 ⇒ 一整段进同一容器;不可聚合 ⇒ 逐条独占一行(保持原顺序)。
    if (shouldAggregateAssistantRun(run)) {
      current.segments.push({ kind: 'assistant-run', messages: run.slice() })
    } else {
      for (const m of run) current.segments.push({ kind: 'single', message: m })
    }
    run = []
  }

  for (const message of messages) {
    if (message.role === 'assistant') {
      if (!current) {
        // 前导助手消息(历史截断/回放):自成一轮,轮次 id 取本条 id。
        current = { turnId: message.id, refs: [], segments: [] }
      }
      current.refs.push(message)
      run.push(message)
      continue
    }
    // 用户 / system:收尾上一轮,自己开新一轮。
    flushRun()
    if (current) turns.push(current)
    current = { turnId: message.id, refs: [message], segments: [] }
    current.segments.push({ kind: 'single', message })
  }
  flushRun()
  if (current) turns.push(current)
  return turns
}

/** 段的行序列 + 段内已用掉的容器序号(供下一段接着编号,id 与整轮构建完全一致)。 */
interface SegmentRows {
  readonly rows: readonly PresentationRow[]
  readonly nextRunIndex: number
}

/**
 * 单个**段** → 行序列(纯函数)。
 *
 * 粒度刻意收到"段"而不是"轮次":一轮里通常是一段用户消息 + N 段助手输出,
 * 流式追加只动最后一段,若按轮次复用,同一轮里没变的用户消息行也会被重算 ——
 * 那正是"每帧只重算最后一行"要避免的事。
 */
function buildSegmentRows(segment: Segment, turnId: string, runIndex: number): SegmentRows {
  if (segment.kind === 'single') {
    return { rows: [buildMessageRow(segment.message, turnId)], nextRunIndex: runIndex }
  }
  const containerId = `thinking-agent:${turnId}:${runIndex}`
  const activityIds: string[] = []
  const activityRows: ActivityGroupRow[] = []
  for (const message of segment.messages) {
    const row = buildActivityGroupRow(message, turnId)
    if (!row) continue
    activityIds.push(row.id)
    activityRows.push(row)
  }
  const withParts = [...segment.messages].reverse().find((m) => (m.toolCalls?.length ?? 0) > 0)
  return {
    rows: [
      {
        type: 'thinkingAgent',
        id: containerId,
        turnId,
        messages: segment.messages,
        isExploring: withParts ? currentActivityIsExploring(withParts.toolCalls ?? []) : false,
        activityIds,
      },
      ...activityRows,
    ],
    nextRunIndex: runIndex + 1,
  }
}

/** 段的缓存判等键:段内消息引用逐格相同即视为"这段没动"。 */
function segmentRefs(segment: Segment): readonly ChatMessage[] {
  return segment.kind === 'single' ? [segment.message] : segment.messages
}

/** 单个轮次 → 行序列(纯函数;缓存层按段复用,本函数是无缓存的对照基准)。 */
export function buildTurnRows(turn: Turn): PresentationRow[] {
  const rows: PresentationRow[] = []
  let runIndex = 0
  for (const segment of turn.segments) {
    const built = buildSegmentRows(segment, turn.turnId, runIndex)
    runIndex = built.nextRunIndex
    rows.push(...built.rows)
  }
  return rows
}

/** 无缓存的整表投影(纯函数;缓存层的兜底路径与单测对照基准)。 */
export function buildPresentationRows(messages: readonly ChatMessage[]): PresentationRow[] {
  const rows: PresentationRow[] = []
  for (const turn of groupTurns(messages)) rows.push(...buildTurnRows(turn))
  return rows
}

// ─── 版本化缓存 ───────────────────────────────────────────────────────────

/** 投影统计:流式每帧该重算几行,是"只重算最后一行"这条要求的可观测凭据。 */
export interface PresentationStats {
  /** 本次调用重算出来的行数 */
  readonly recomputedRows: number
  /** 本次调用直接复用的上一轮行数(引用不变) */
  readonly reusedRows: number
  readonly totalRows: number
  /** 命中的"整表未变"次数与"整表变更"次数(排查用,不影响判据) */
  readonly unchangedHits: number
  readonly changedHits: number
}

export interface PresentationProjection {
  readonly rows: readonly PresentationRow[]
  /** 结构版本号:投影结果(行集合与行引用)真的变了才 +1;同一输入恒不变。 */
  readonly presentationStructureRevision: number
  readonly stats: PresentationStats
}

export interface PresentationCache {
  /** 投影消息数组;源消息引用/版本不变 ⇒ 返回**同一份** projection(含 rows 引用)。 */
  project(messages: readonly ChatMessage[]): PresentationProjection
  /** 只读最近一次投影(未投影过 ⇒ null)。 */
  peek(): PresentationProjection | null
  /** 清空缓存(切换会话时调用;不调用也不会错,只是丢掉复用机会)。 */
  reset(): void
}

interface CachedSegment {
  /** 段内源消息引用(判等唯一依据之一)。 */
  readonly refs: readonly ChatMessage[]
  /** 该段构建时的起始容器序号(容器 id 由它决定 ⇒ 序号变了就不能复用旧行)。 */
  readonly startRunIndex: number
  /** 该段产出的行(引用即复用单位)。 */
  readonly rows: readonly PresentationRow[]
  readonly nextRunIndex: number
}

const EMPTY_PROJECTION: PresentationProjection = {
  rows: [],
  presentationStructureRevision: 0,
  stats: {
    recomputedRows: 0,
    reusedRows: 0,
    totalRows: 0,
    unchangedHits: 0,
    changedHits: 0,
  },
}

function sameRefs(a: readonly ChatMessage[], b: readonly ChatMessage[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false
  return true
}

/**
 * 建立投影缓存(小类,纯内存、零副作用、零模块级状态 —— 每个宿主自持一份)。
 *
 * 复用粒度 = **段**(轮次内的一次连续输出),并按段的**位序 + 源引用**判等:
 *  - 段位序相同且段内消息引用逐格不变 ⇒ 该段的行数组原样复用(行对象引用一并保留);
 *  - 于是流式追加 token 时(store 只替换被追加那一条消息对象,其余保持引用),
 *    前缀段全部命中复用,**只有最后一行被重算** —— 这正是 `presentationStructureRevision`
 *    要支撑的那件事;
 *  - 整表每一段都命中 ⇒ 连 rows 数组本身都复用,版本号不变。
 *
 * 为什么不能只做"整轮复用":一轮里通常是一段用户消息 + N 段助手输出,
 * 整轮粒度会把同轮里没变的用户消息行也判成"要重算",前缀引用就不再稳定。
 *
 * 判等键里刻意**不含**段内的 `isExploring` 派生量:它由源消息(工具调用状态)纯函数推出,
 * 源引用不变 ⇒ 派生量必然不变,多存一份就会漂。
 */
export function createPresentationCache(): PresentationCache {
  let prevMessages: readonly ChatMessage[] | null = null
  let prevSegments: CachedSegment[] = []
  let projection: PresentationProjection = EMPTY_PROJECTION
  let revision = 0
  let unchangedHits = 0
  let changedHits = 0

  function project(messages: readonly ChatMessage[]): PresentationProjection {
    // 最快路径:同一个数组引用 ⇒ 原样返回(连统计都不重算)。
    if (messages === prevMessages) return projection

    const flat: Array<{ turnId: string; segment: Segment }> = []
    for (const turn of groupTurns(messages)) {
      for (const segment of turn.segments) flat.push({ turnId: turn.turnId, segment })
    }

    const nextSegments: CachedSegment[] = new Array<CachedSegment>(flat.length)
    const nextRows: PresentationRow[] = []
    let reusedRows = 0
    let recomputedRows = 0
    let everySegmentReused = flat.length === prevSegments.length
    // 容器序号(`thinking-agent:<turnId>:<n>`)必须**每轮重置**,与无缓存的
    // `buildTurnRows` 同口径。2026-10-29 修:此前这里是跨轮全局累加,于是同一份输入
    // 走缓存与走纯函数给出不同的行 id(`u2:1` vs `u2:0`),既有那条"缓存版与无缓存
    // 逐行等值"的断言在多容器场景下是**假绿**(它当时的夹具里第二轮的助手消息恰好
    // 是失败轮 ⇒ 不产容器 ⇒ 序号没机会漂)。
    // 全局累加的危害不止"两份 id 不一致":它让"在前面某一轮多出一个容器"把其后
    // **所有**容器 id 一起推走 ⇒ 段复用判等(`startRunIndex`)全线落空 ⇒ 一次中间
    // 插入触发整表重算,正是本层要避免的事。id 里已有 `turnId`,轮内计数已足够唯一。
    let runIndex = 0
    let currentTurnId: string | null = null

    for (let i = 0; i < flat.length; i += 1) {
      const item = flat[i] as { turnId: string; segment: Segment }
      if (item.turnId !== currentTurnId) {
        currentTurnId = item.turnId
        runIndex = 0
      }
      const refs = segmentRefs(item.segment)
      const prev = prevSegments[i]
      // 可复用要三条同时成立:位序相同 ∧ 段内引用逐格相同 ∧ 容器起始序号相同。
      // 第三条是容器 id(`thinking-agent:<turnId>:<n>`)的组成部分 —— 只比引用不看序号,
      // 会在"中间插进一段"时把旧 id 的行原样搬过来,React key 冲突且指向错消息。
      if (prev && prev.startRunIndex === runIndex && sameRefs(prev.refs, refs)) {
        nextSegments[i] = prev
        for (const row of prev.rows) nextRows.push(row)
        reusedRows += prev.rows.length
        runIndex = prev.nextRunIndex
        continue
      }
      everySegmentReused = false
      const built = buildSegmentRows(item.segment, item.turnId, runIndex)
      nextSegments[i] = {
        refs,
        startRunIndex: runIndex,
        rows: built.rows,
        nextRunIndex: built.nextRunIndex,
      }
      runIndex = built.nextRunIndex
      for (const row of built.rows) nextRows.push(row)
      recomputedRows += built.rows.length
    }

    let rows: readonly PresentationRow[]
    if (everySegmentReused) {
      // 每一段都命中复用 ⇒ 行集合与行引用逐格不变 ⇒ 连数组都复用,版本号不动。
      rows = projection.rows
      unchangedHits += 1
    } else {
      rows = nextRows
      revision += 1
      changedHits += 1
    }

    prevMessages = messages
    prevSegments = nextSegments
    projection = {
      rows,
      presentationStructureRevision: revision,
      stats: {
        recomputedRows,
        reusedRows,
        totalRows: rows.length,
        unchangedHits,
        changedHits,
      },
    }
    return projection
  }

  return {
    project,
    peek: () => (prevMessages === null ? null : projection),
    reset: () => {
      prevMessages = null
      prevSegments = []
      projection = EMPTY_PROJECTION
      revision = 0
      unchangedHits = 0
      changedHits = 0
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
