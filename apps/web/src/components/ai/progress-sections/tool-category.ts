// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D58 工具类目聚合层(2026-09-23 立,G-71/G-72)。
 *
 * 在既有"按工具名分组"(ToolCallSummary.toolsByCategory: 工具名 → 次数)之上,
 * 引入**类目(category)**层:把工具名映射到一个具名类目,再按类目聚合展示。
 *
 * 硬约束(任务原文):**禁止新建第二套分组逻辑**。本文件是唯一的类目映射与聚合入口,
 * tool-call-summary-card.tsx(渲染)与 fold-policy.ts(展开策略联动)均复用此处,
 * 不另起分组体系。
 *
 * 类目以 PROJECT_PLAN.md D58 逐字为准:
 *   文件读/写/改/删/查、命令、预览、网页搜索、MCP、技能、任务管理、
 *   思考、用户交互、生图/生视频、环境初始化、结束、其他。
 *
 * 注:计划原文标注"20 类",但逐字枚举仅 18 个具名类目;本实现取 18 个具名类目,
 * order 1..18 单调递增;差 2 类待主会话确认是否需要补具名类目(如"文件移动"/
 * "子代理"等),不臆造。
 */

/** 类目键(稳定、与 CATEGORY_TABLE 一一对应) */
export type CategoryKey =
  | 'file_read'
  | 'file_write'
  | 'file_modify'
  | 'file_delete'
  | 'file_search'
  | 'command'
  | 'preview'
  | 'web_search'
  | 'mcp'
  | 'skill'
  | 'task_management'
  | 'thinking'
  | 'user_interaction'
  | 'image_gen'
  | 'video_gen'
  | 'env_init'
  | 'end'
  | 'other'

/** 类目展开策略(与 D21 折叠策略联动,见 fold-policy.ts 的 resolveCategoryInitialOpen) */
export type ExpandStrategy = 'auto' | 'collapse' | 'expand'

export interface CategoryDef {
  key: CategoryKey
  /** i18n 键(挂在 ai.pane 命名空间下)。词包由其他代理统一入库,本文件只引用键名 */
  labelKey: string
  /** 展示顺序,数值小在前 */
  order: number
  /** 是否"可计数":该动作是否以"×N"形式呈现。阶段/标记型类目为 false */
  countable: boolean
  /** 展开策略:
   *  - 'auto'     跟随 D21 自适应折叠策略(轻任务展开、重任务折叠)
   *  - 'collapse' 默认收起(思考/结束等阶段标记,默认让位正文)
   *  - 'expand'   默认展开(对标 Qoder 全程可见偏好) */
  expandStrategy: ExpandStrategy
  /** 永不折叠(语义维,与上面的档位维正交,2026-10-29 立)。
   *  为 true 时该类目卡**不受任何阈值约束**(字数/工具数/耗时再大也不折);
   *  判定出口只有一个:`isNeverFoldTool()` —— 调用方不得自建第二份名单。 */
  neverFold?: boolean
}

/** 18 个具名类目(逐字对齐 D58 原文;order 单调) */
export const CATEGORY_TABLE: readonly CategoryDef[] = [
  { key: 'file_read', labelKey: 'catFileRead', order: 1, countable: true, expandStrategy: 'auto' },
  {
    key: 'file_write',
    labelKey: 'catFileWrite',
    order: 2,
    countable: true,
    expandStrategy: 'auto',
  },
  {
    key: 'file_modify',
    labelKey: 'catFileModify',
    order: 3,
    countable: true,
    expandStrategy: 'auto',
  },
  {
    key: 'file_delete',
    labelKey: 'catFileDelete',
    order: 4,
    countable: true,
    expandStrategy: 'auto',
  },
  {
    key: 'file_search',
    labelKey: 'catFileSearch',
    order: 5,
    countable: true,
    expandStrategy: 'auto',
  },
  { key: 'command', labelKey: 'catCommand', order: 6, countable: true, expandStrategy: 'auto' },
  { key: 'preview', labelKey: 'catPreview', order: 7, countable: true, expandStrategy: 'auto' },
  {
    key: 'web_search',
    labelKey: 'catWebSearch',
    order: 8,
    countable: true,
    expandStrategy: 'auto',
  },
  { key: 'mcp', labelKey: 'catMcp', order: 9, countable: true, expandStrategy: 'auto' },
  { key: 'skill', labelKey: 'catSkill', order: 10, countable: true, expandStrategy: 'auto' },
  {
    key: 'task_management',
    labelKey: 'catTaskMgmt',
    order: 11,
    countable: true,
    expandStrategy: 'auto',
  },
  {
    key: 'thinking',
    labelKey: 'catThinking',
    order: 12,
    countable: false,
    expandStrategy: 'collapse',
  },
  {
    key: 'user_interaction',
    labelKey: 'catUserInteract',
    order: 13,
    countable: true,
    expandStrategy: 'auto',
    neverFold: true,
  },
  { key: 'image_gen', labelKey: 'catImageGen', order: 14, countable: true, expandStrategy: 'auto' },
  { key: 'video_gen', labelKey: 'catVideoGen', order: 15, countable: true, expandStrategy: 'auto' },
  { key: 'env_init', labelKey: 'catEnvInit', order: 16, countable: true, expandStrategy: 'auto' },
  { key: 'end', labelKey: 'catEnd', order: 17, countable: false, expandStrategy: 'collapse' },
  { key: 'other', labelKey: 'catOther', order: 18, countable: true, expandStrategy: 'auto' },
] as const

/** 类目键 → 定义 的 O(1) 查询表 */
export const CATEGORY_TABLE_BY_KEY: Readonly<Record<CategoryKey, CategoryDef>> = Object.fromEntries(
  CATEGORY_TABLE.map((d) => [d.key, d]),
) as Record<CategoryKey, CategoryDef>

// ─── 工具名 → 类目映射 ─────────────────────────────────────────────
// 已知工具名精确命中;MCP 类按命名约定识别;其余(插件/MCP 动态名)一律 other。
// 绝不臆造类目:命中不到就归 other,由词包 catOther 兜底呈现原名。

const EXACT_MAP: Readonly<Record<string, CategoryKey>> = {
  // 文件读
  read_file: 'file_read',
  list_dir: 'file_read',
  read_dir: 'file_read',
  // 文件查
  search_codebase: 'file_search',
  file_search: 'file_search',
  grep: 'file_search',
  ripgrep: 'file_search',
  glob: 'file_search',
  find_files: 'file_search',
  // 文件写
  write_file: 'file_write',
  create_file: 'file_write',
  create_document: 'file_write',
  // 文件改
  edit_file: 'file_modify',
  file_edit: 'file_modify',
  // 文件删
  delete_file: 'file_delete',
  remove_file: 'file_delete',
  // 命令
  run_command: 'command',
  execute_command: 'command',
  shell: 'command',
  bash: 'command',
  terminal: 'command',
  exec: 'command',
  // 预览
  preview_url: 'preview',
  open_preview: 'preview',
  browser_open: 'preview',
  browser_navigate: 'preview',
  // 网页搜索
  web_search: 'web_search',
  search_web: 'web_search',
  fetch_url: 'web_search',
  // 技能
  use_skill: 'skill',
  run_skill: 'skill',
  invoke_skill: 'skill',
  skill: 'skill',
  // 任务管理
  create_task: 'task_management',
  update_task: 'task_management',
  list_tasks: 'task_management',
  task_status: 'task_management',
  todo_write: 'task_management',
  todo_read: 'task_management',
  // 思考
  think: 'thinking',
  reasoning: 'thinking',
  internal_thought: 'thinking',
  // Qoder 0.4.11 例外集原字面量(独立 UI 型思考块,永不折叠)
  Thinking: 'thinking',
  // 用户交互
  ask_user: 'user_interaction',
  ask_followup: 'user_interaction',
  user_input: 'user_interaction',
  request_clarification: 'user_interaction',
  permission_request: 'user_interaction',
  // 用户交互 · Qoder 0.4.11 例外集的驼峰原字面量(2026-10-29 对标登记)。
  // 与上面蛇形名是同一族语义,收在此处而不是另起一张表 —— 例外集(NEVER_FOLD_TOOLS)
  // 只放"折叠策略"这一维,类目归属仍只由本表回答。
  AskQuestion: 'user_interaction',
  AskUserQuestion: 'user_interaction',
  SwitchMode: 'user_interaction',
  // 子代理:18 类目无独立"子代理"档,按"任务编排"归 task_management(不臆造第 19 类)
  Agent: 'task_management',
  Task: 'task_management',
  TaskOutput: 'task_management',
  TaskText: 'task_management',
  ExitPlanMode: 'task_management',
  // 生图
  image_gen: 'image_gen',
  generate_image: 'image_gen',
  text_to_image: 'image_gen',
  dalle: 'image_gen',
  imagen: 'image_gen',
  // Qoder 0.4.11 例外集原字面量(2026-10-29 对标登记):独立 UI 型生图卡,永不折叠
  ImageGen: 'image_gen',
  // 生视频
  video_gen: 'video_gen',
  generate_video: 'video_gen',
  text_to_video: 'video_gen',
  // 环境初始化
  init_env: 'env_init',
  setup_environment: 'env_init',
  install_deps: 'env_init',
  env_init: 'env_init',
  workspace_init: 'env_init',
  // 结束
  finish: 'end',
  end_turn: 'end',
  task_complete: 'end',
  done: 'end',
}

/**
 * 工具名 → 类目。
 * 返回 'other' 的情形:空名 / 未在 EXACT_MAP 命中 / 非 MCP 命名约定的插件或动态工具名。
 */
export function resolveToolCategory(toolName: string): CategoryKey {
  if (!toolName) return 'other'
  const exact = EXACT_MAP[toolName]
  if (exact) return exact
  // MCP 工具常以 mcp__<server>__<tool> / <server>_mcp 形态出现(下划线是词字符,
  // 故用 includes 而非 \b 边界,避免 server_mcp_tool 这类漏判)
  const lower = toolName.toLowerCase()
  if (lower.startsWith('mcp__') || lower.includes('__mcp__') || lower.includes('mcp')) {
    return 'mcp'
  }
  return 'other'
}

// ─── 永不折叠例外集(语义维,2026-10-29 立,对标 Qoder 0.4.11) ──────────
// 竞品做法(asar 字节抽取取证):折叠**不按长度阈值**,而按语义分类 + 例外集;
// 例外集全是字面量工具名,分三族 ——
//   ① 需要用户确认  AskQuestion / AskUserQuestion / SwitchMode
//   ② 子代理        Agent / Task
//   ③ 独立 UI       ExitPlanMode / TaskOutput / ImageGen / Thinking / TaskText
// 三族的共同点:折叠起来要么把"等你点一下"的东西藏掉,要么把一块自成一体的 UI
// (子代理树 / 图 / 思考块)压成一行摘要,信息损失不可逆。
//
// 纪律(§0.6 单一真相源):本 Set 只回答"折叠策略"这一维,**类目归属仍只由
// `EXACT_MAP` + `CATEGORY_TABLE` 回答**;判定出口只有 `isNeverFoldTool()` 一个,
// 调用方不得另抄一份名单(反例警告见仓库 `check-test-judge-not-replicated.mjs`)。
export const NEVER_FOLD_TOOLS: ReadonlySet<string> = new Set([
  // ① 需要用户确认
  'AskQuestion',
  'AskUserQuestion',
  'SwitchMode',
  // ② 子代理
  'Agent',
  'Task',
  // ③ 独立 UI
  'ExitPlanMode',
  'TaskOutput',
  'ImageGen',
  'Thinking',
  'TaskText',
])

/**
 * 该工具是否"永不折叠"。
 *
 * 两档合判,缺一不可:
 *  - 按**工具名**命中例外集(上面那张字面量表);
 *  - 按**类目**命中 `CategoryDef.neverFold`(整个类目语义上都不该被自动折叠,
 *    如 user_interaction —— 它整类都是"等人回话")。
 * 空名/未知名一律 false(不臆造例外)。
 */
export function isNeverFoldTool(toolName: string): boolean {
  if (!toolName) return false
  if (NEVER_FOLD_TOOLS.has(toolName)) return true
  return CATEGORY_TABLE_BY_KEY[resolveToolCategory(toolName)].neverFold === true
}

/** 单个工具名 + 次数(聚合输入单元) */
export interface ToolNameCount {
  toolName: string
  count: number
}

/** 聚合后的一个类目 run(一张卡) */
export interface CategoryRun {
  categoryKey: CategoryKey
  /** b75-5#3:流式稳定分组 key —— 锚定组内首行工具名,
   *  同类目被其他类目打断后再次出现时 key 不冲突(原用 categoryKey 会撞 key)。 */
  groupKey: string
  labelKey: string
  order: number
  countable: boolean
  expandStrategy: ExpandStrategy
  /**
   * 本 run 是否"永不折叠"(2026-10-29 立,语义维)。
   * 成立条件二选一:类目自身 `neverFold`(如 user_interaction 整类都要等人回话),
   * 或 run 内**含至少一枚**例外集工具(见 `isNeverFoldTool`)。
   *
   * **混合语义(已定档,调用方不必再猜)**:类目内只要混有一枚永不折叠的工具,
   * 该 run 的 `expandStrategy` 一律**提升为 'expand'** —— 因为类目卡是整体折叠的粒度,
   * 无法只展开其中一行;若按阈值把整卡折起来,那枚"等你点一下"的入口就被藏掉了。
   * 提升只发生在 run 这一层,`CATEGORY_TABLE` 的类目档位不受影响(18 个类目的
   * order / countable / labelKey / expandStrategy 语义保持原样)。
   */
  neverFold: boolean
  /** 该 run 内所有工具调用数之和 */
  totalCount: number
  /** run 内工具明细(已按同类连续聚合并合并同工具) */
  tools: ToolNameCount[]
}

function makeRun(categoryKey: CategoryKey, tools: ToolNameCount[]): CategoryRun {
  const def = CATEGORY_TABLE_BY_KEY[categoryKey]
  // groupKey 锚定首行工具名:同类目多段时各段首工具通常不同,避免 React key 冲突
  const anchor = tools[0]?.toolName ?? ''
  // 语义维:类目级 neverFold ∨ run 内含例外工具 ⇒ 整卡永不折叠(见 CategoryRun.neverFold)
  const neverFold = def.neverFold === true || tools.some((t) => isNeverFoldTool(t.toolName))
  return {
    categoryKey,
    groupKey: `${categoryKey}::${anchor}`,
    labelKey: def.labelKey,
    order: def.order,
    countable: def.countable,
    expandStrategy: neverFold ? 'expand' : def.expandStrategy,
    neverFold,
    totalCount: tools.reduce((s, t) => s + t.count, 0),
    tools,
  }
}

/** 给 run 列表的 groupKey 追加段序号,确保同类目多段(含同首工具)的 key 全局唯一。
 *  流式末尾追加时,已有段的序号不变 → groupKey 稳定 → 展开态不丢。 */
function withSegmentIndex(runs: CategoryRun[]): CategoryRun[] {
  return runs.map((r, i) => ({ ...r, groupKey: `${r.groupKey}::${i}` }))
}

/**
 * 就地重算一张 run 的语义维与档位。
 *
 * 必要性(2026-10-29 实测踩到的真缺陷):`aggregateCategoryRuns` 的"同类连续"分支
 * 只往 `last.tools` 推元素、改 `totalCount`,**不会重跑 makeRun** —— 于是首元素是普通工具、
 * 后续才追加一枚例外工具时,`neverFold` 会永远停在 false(`混合语义` 用例当场红)。
 * 流式追加恰是这种顺序(先 image_gen、后 ImageGen),不能靠"首元素就够"的假设。
 */
function refreshRunSemantics(run: CategoryRun): void {
  const def = CATEGORY_TABLE_BY_KEY[run.categoryKey]
  const neverFold = def.neverFold === true || run.tools.some((t) => isNeverFoldTool(t.toolName))
  run.neverFold = neverFold
  run.expandStrategy = neverFold ? 'expand' : def.expandStrategy
}

/** run 列表按类目 order 稳定排序,便于渲染顺序与断言 */
export function sortRuns(runs: CategoryRun[]): CategoryRun[] {
  return [...runs].sort((a, b) => a.order - b.order)
}

/**
 * 把"有序的工具调用序列"按类目聚合成 run。
 * 同类连续步骤合并进同一张卡;一旦被其他类目打断,则断成新卡(不连续不聚合)。
 * 纯函数、无副作用、无模块状态,可单测。
 *
 * 关键:返回结果**保持输入时序**(不做按 order 的全局重排)。
 * "同类连续聚合成一张卡"依赖时序,全局按 order 重排会破坏"被中断断卡"的语义。
 * 仅 summarizeCategoriesByTool(无顺序信息)才按 order 排序。
 *
 * @param ordered 按时间顺序的工具调用(每项可为聚合后的次数)
 */
export function aggregateCategoryRuns(ordered: ToolNameCount[]): CategoryRun[] {
  const runs: CategoryRun[] = []
  for (const item of ordered) {
    const cat = resolveToolCategory(item.toolName)
    const last = runs[runs.length - 1]
    if (last && last.categoryKey === cat) {
      // 同类连续:合并进当前卡。合并后必须重算语义维 —— 否则"先普通、后例外"的
      // 流式追加顺序会让这类目卡停在 folded(见 refreshRunSemantics 的立因)。
      last.tools.push(item)
      last.totalCount += item.count
      if (!last.neverFold) refreshRunSemantics(last)
    } else {
      runs.push(makeRun(cat, [item]))
    }
  }
  return withSegmentIndex(runs)
}

/**
 * 从"无顺序的聚合计数"(ToolCallSummary.toolsByCategory)生成类目 run。
 * 无顺序信息 → 每个类目合并为单一 run(不臆造连续关系)。
 * 纯函数,可单测。
 */
export function summarizeCategoriesByTool(toolsByCategory: Record<string, number>): CategoryRun[] {
  const byCat = new Map<CategoryKey, ToolNameCount[]>()
  for (const [toolName, count] of Object.entries(toolsByCategory)) {
    const cat = resolveToolCategory(toolName)
    const arr = byCat.get(cat) ?? []
    arr.push({ toolName, count })
    byCat.set(cat, arr)
  }
  const runs: CategoryRun[] = []
  for (const [cat, tools] of byCat) {
    // byCat 的每个键都是在推入至少一个元素后紧接着 set 的(见上方循环),
    // 故 tools 恒非空;totalCount / tools 直接由 makeRun 从数组派生,
    // 不再经数组下标取值(noUncheckedIndexedAccess 下 `tools[0]` 类型为可空)。
    runs.push(makeRun(cat, tools))
  }
  return withSegmentIndex(sortRuns(runs))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
