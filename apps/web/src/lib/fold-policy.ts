// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 语义折叠归组层(fold projection,2026-10-29 立,对标 Qoder 借鉴清单第 4 项)。
 *
 * 一句话:把「20 张工具卡平铺」折成「读取 5 个文件 · 执行 3 条命令」这样的**时间线行**。
 *
 * 与同名文件的**分工**(读代码的人第一件要分清的事):
 *   - 本文件 `src/lib/fold-policy.ts` —— **归组投影**:吃一串活动,吐一串"折叠行"。
 *     纯数据、不碰 localStorage、不判"过程区该不该默认收起"。
 *   - `src/components/chat/message-list/fold-policy.ts` —— **折叠开关策略**(D21):
 *     吃三维读数(字数/工具数/耗时),吐"过程区初始是开还是合",带持久化与广播。
 *   两者不是一个东西、也不互相 import;`MessageItem` 两个都用(一个决定组开合,
 *   一个决定组内怎么呈现)。**不要**把归组逻辑塞进开关策略那份文件,反之亦然。
 *
 * 为什么归组键取 18 类目表(`resolveToolCategory`)而**不是**共享层 5 分类(`toolCategory`):
 *   - 5 分类是**对象维度**(file / image / search / thinking / custom),供"类目级双时态
 *     动词"取词用;它的 `file` 族把 `read_file`(读)与 `write_file`/`edit_file`(写/改)
 *     放在同一类里 —— 用它归组,"读取 5 个文件"和"编辑 5 个文件"会折成同一句
 *     "5 个文件",这是语义错而不是取舍。
 *   - 18 类目是**动作维度**,`file_read`/`file_write`/`file_modify`/`file_delete`/
 *     `file_search`/`command`/`preview`/`web_search`/… 各自独立,正好是"一行读得懂"
 *     需要的分辨率;而且它已经是折叠例外集(`isNeverFoldTool`)的**同一张表**。
 *   - 所以本模块与 `turn-presentation.ts` 的 `activityOrder` 同口径:同一份输入,两条
 *     路径给出同一串类目键。新增工具只改 `tool-category.ts` 的 `EXACT_MAP` 一处,
 *     本模块 **零工具名字面量、零第二张分类表**(§0.6)。
 *
 * 归组规则(与类目卡的"同类连续聚合成一张卡"同语义):
 *   - 连续同类合并为一行;**被异类打断即断行**(不连续不聚合,不做跨段合并);
 *   - 单条自成一行(`kind:'item'`,不值得占一行摘要);
 *   - 连续同类 ≥2 条 ⇒ `kind:'summary'`(`folded:true`,可折成一句计数短语);
 *   - 连续同类 ≥2 条但**含永不折叠工具** ⇒ `kind:'group'`(`folded:false`)。
 *     理由不是体量而是入口:把"等你点一下"(`AskUserQuestion`)或一整块独立 UI
 *     (子代理树 / 图)压成一行计数,信息损失不可逆 —— 与 `isNeverFoldTool` 同一条口径,
 *     判据不在此处另立。
 *
 * 刻意**不纳入**归组的三类活动(计划步骤 / 终端任务 / 子代理活动):
 * 它们各自有独立卡片(`PlanStepsCard` / `TerminalSection` / `SubAgentActivityFeed`),
 * 折成一句计数就等于把可交互入口藏掉。任务书原文把这三类一起列进"活动列表",
 * 本模块按"折了会丢入口的一律不折"(§0.10 失效方向)只接工具活动 —— 这一格是**裁剪**
 * 不是遗漏,报告里如实登记。
 */

import {
  isNeverFoldTool,
  resolveToolCategory,
  type CategoryKey,
} from '@/components/ai/progress-sections/tool-category'

/**
 * 归组输入的最小结构(结构化子类型)。
 *
 * `ToolCall` 直接满足本形状(`id` / `toolName` / `status` 三件),故调用方可以
 * 原样把 `message.toolCalls` 递进来,不需要先 map 一遍(多一次 map = 多一次分配,
 * 流式每帧都要跑)。
 */
export interface FoldActivity {
  readonly id: string
  readonly toolName: string
  /** 工具调用状态;本模块**不读**它做归组判据(状态不是类目),只为渲染层保留。 */
  readonly status: string
}

/** 折成一行摘要所需的最小条数:单条不折(一条也折,摘要与卡片同信息量)。 */
export const FOLD_SUMMARY_MIN_COUNT = 2

/**
 * 类目 → `chat` 命名空间下的**计数短语键**(18 项,TS 强制穷尽)。
 *
 * 这是**取词表**,不是分类表:分类唯一源仍是 `resolveToolCategory`。
 * 与 `src/lib/tool-activity-summary-text.ts` 的 `SUMMARY_KEYS`(5 类目)同族不同粒度 ——
 * 那份给"一轮聚合"出类目短语,本表给"折叠行"出计数短语;两表都不回答"某工具归哪一类"。
 *
 * 为什么不复用类目卡标题键(`catFileRead` 等):那批键是**名词标题**(类目卡头部),
 * 值里不含 `{n}`;摘要行要的是**带计数的短语**,共用一份键会让类目卡标题渲染出裸 `{n}`。
 */
const FOLD_LABEL_KEYS: Readonly<Record<CategoryKey, string>> = {
  file_read: 'foldReadFiles',
  file_write: 'foldWriteFiles',
  file_modify: 'foldModifyFiles',
  file_delete: 'foldDeleteFiles',
  file_search: 'foldSearchFiles',
  command: 'foldCommands',
  preview: 'foldPreviews',
  web_search: 'foldWebSearches',
  mcp: 'foldMcpCalls',
  skill: 'foldSkillCalls',
  task_management: 'foldTaskOps',
  thinking: 'foldThinking',
  user_interaction: 'foldUserInteractions',
  image_gen: 'foldImages',
  video_gen: 'foldVideos',
  env_init: 'foldEnvInits',
  end: 'foldEnds',
  other: 'foldOthers',
}

/** 折叠行的三种语义级(与 Qoder 借鉴清单的 summary / item / group 一一对应)。 */
export type FoldRowKind = 'summary' | 'group' | 'item'

/** 所有折叠行的公共字段(`kind` 之外)。 */
interface FoldRowBase {
  /** 稳定 id:`fold:<类目>:<段首活动 id>` —— 流式追加时前缀行 id 不变。 */
  readonly id: string
  readonly categoryKey: CategoryKey
  /** 计数短语键(`chat` 命名空间),取词在渲染层。 */
  readonly labelKey: string
  /** 本行覆盖的活动条数(`Σ count === 输入长度`,见不变量)。 */
  readonly count: number
  /** 是否被折成一句摘要(`true` 只有 `summary` 一行)。 */
  readonly folded: boolean
  /** 本行覆盖的活动(时序原样,不排序 —— 顺序是"连续同类"的判据前提)。 */
  readonly items: readonly FoldActivity[]
}

/** 连续同类 ≥2 且不含永不折叠工具 ⇒ 折成一句计数短语。 */
export interface FoldSummaryRow extends FoldRowBase {
  readonly kind: 'summary'
  readonly folded: true
}

/** 连续同类 ≥2 但含永不折叠工具 ⇒ 整组保留(不折,但作为一行参与遍历)。 */
export interface FoldGroupRow extends FoldRowBase {
  readonly kind: 'group'
  readonly folded: false
}

/** 单条活动自成一行。 */
export interface FoldItemRow extends FoldRowBase {
  readonly kind: 'item'
  readonly count: 1
  readonly folded: false
  readonly items: readonly [FoldActivity]
}

export type FoldRow = FoldSummaryRow | FoldGroupRow | FoldItemRow

/** 一段连续同类 → 一行。单段内的类目由调用方判好(`resolveToolCategory` 只调一次/元素)。 */
function buildRow(categoryKey: CategoryKey, items: readonly FoldActivity[]): FoldRow {
  const head = items[0]
  // 调用方保证 items 非空;`noUncheckedIndexedAccess` 下需显式收窄。
  if (!head) throw new Error('buildRow: items 不得为空(调用方保证)')
  const labelKey = FOLD_LABEL_KEYS[categoryKey]
  const id = `fold:${categoryKey}:${head.id}`
  if (items.length === 1) {
    return { kind: 'item', id, categoryKey, labelKey, count: 1, folded: false, items: [head] }
  }
  const count = items.length
  // 语义例外集判定只经单源 `isNeverFoldTool`(工具名例外 ∪ 类目级 neverFold 两档合判)。
  const neverFold = items.some((item) => isNeverFoldTool(item.toolName))
  if (neverFold) {
    return { kind: 'group', id, categoryKey, labelKey, count, folded: false, items }
  }
  return { kind: 'summary', id, categoryKey, labelKey, count, folded: true, items }
}

/**
 * 活动序列 → 折叠行序列(纯函数,零 IO、零模块级状态)。
 *
 * 不变量(测试逐条锁):
 *  ① 输入每一项**恰好出现一次**、顺序不变 —— 遍历源是活动数组本身,
 *     归组只决定"哪些项合成一行",绝不丢项、绝不重排;于是任何未来退化的
 *     失效方向都是"少一行摘要",不可能是"少一个工具调用"。
 *  ② `Σ rows[i].count === activities.length`。
 *  ③ 同一入参恒得同一结果(不读外部状态、不碰 Date/Math.random)。
 */
export function buildFoldRows(activities: readonly FoldActivity[]): FoldRow[] {
  const rows: FoldRow[] = []
  let index = 0
  while (index < activities.length) {
    const head = activities[index]
    if (!head) break
    const categoryKey = resolveToolCategory(head.toolName)
    let end = index + 1
    for (;;) {
      const next = activities[end]
      if (!next) break
      if (resolveToolCategory(next.toolName) !== categoryKey) break
      end += 1
    }
    rows.push(buildRow(categoryKey, activities.slice(index, end)))
    index = end
  }
  return rows
}

/**
 * 「折叠视图」下被收起的那批活动 id(纯函数)。
 *
 * 语义:只有被折成一句计数短语的行(`summary`)覆盖的活动才会被收起;
 * `group` 行(含永不折叠工具)与 `item` 行(单条)一律留在台面 ——
 * 前者折了会丢入口(等用户点一下 / 子代理树 / 独立 UI),后者折了与不折信息量相同。
 *
 * 为什么要一个专用出口而不是让调用方 `rows.filter(...)` 自己拼:
 * 这条规则与 `buildRow` 的折叠判据是**同一件事的两面** —— 判"折"与判"收"必须由同一份
 * 实现回答,两处各写一遍必然漂移(§0.6),而漂移的失效方向正是"把该点的入口藏掉"。
 */
export function foldedAwayIds(rows: readonly FoldRow[]): ReadonlySet<string> {
  const ids = new Set<string>()
  for (const row of rows) {
    if (row.kind !== 'summary') continue
    for (const item of row.items) ids.add(item.id)
  }
  return ids
}

/** 端内取词函数(与 `toolActivitySummaryText` 同形,便于同一处 mock)。 */
export type FoldTranslate = (key: string, values?: Record<string, number | string>) => string

/**
 * 单行摘要取词(取词失败 ⇒ 空串)。
 *
 * 失败判据三条:返回键名本身(端侧缺键)/ 空白串 / 空串。三者都当"取不到"而不是
 * 把坏字渲染出来 —— 摘要行是装饰性交代,坏字比缺字更糟(与 `toolActivitySummaryText` 同一取舍)。
 *
 * 只有 `summary` 行会取词:`group` 行要保留整组卡片、`item` 行本来就只有一条,
 * 它们都**不该**有一句"1 个文件"的冗余摘要。
 */
export function foldRowText(row: FoldRow, translate: FoldTranslate): string {
  if (row.kind !== 'summary') return ''
  const rendered = translate(row.labelKey, { n: row.count })
  if (rendered === row.labelKey || rendered.trim() === '') return ''
  return rendered
}

/**
 * 折叠行 → 一行的可读摘要(所有 `summary` 行按序以 ` · ` 连接)。
 *
 * 与 `foldRowText` 同源(后者是取词的单行实现),不是两份判据 —— 这里只是把它逐行拼起来。
 * 全部取不到 ⇒ 空串,调用方据此不渲染该行(不占位、不留空壳)。
 */
export function foldSummaryText(rows: readonly FoldRow[], translate: FoldTranslate): string {
  const parts: string[] = []
  for (const row of rows) {
    const text = foldRowText(row, translate)
    if (text !== '') parts.push(text)
  }
  return parts.join(' · ')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
