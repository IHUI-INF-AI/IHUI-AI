// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).
// [IHUI-AI-PROVENANCE]: D58 工具类目聚合层 (2026-09-23 · G-71/G-72)

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
}

/** 18 个具名类目(逐字对齐 D58 原文;order 单调) */
export const CATEGORY_TABLE: readonly CategoryDef[] = [
  { key: 'file_read', labelKey: 'catFileRead', order: 1, countable: true, expandStrategy: 'auto' },
  { key: 'file_write', labelKey: 'catFileWrite', order: 2, countable: true, expandStrategy: 'auto' },
  { key: 'file_modify', labelKey: 'catFileModify', order: 3, countable: true, expandStrategy: 'auto' },
  { key: 'file_delete', labelKey: 'catFileDelete', order: 4, countable: true, expandStrategy: 'auto' },
  { key: 'file_search', labelKey: 'catFileSearch', order: 5, countable: true, expandStrategy: 'auto' },
  { key: 'command', labelKey: 'catCommand', order: 6, countable: true, expandStrategy: 'auto' },
  { key: 'preview', labelKey: 'catPreview', order: 7, countable: true, expandStrategy: 'auto' },
  { key: 'web_search', labelKey: 'catWebSearch', order: 8, countable: true, expandStrategy: 'auto' },
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
  },
  { key: 'image_gen', labelKey: 'catImageGen', order: 14, countable: true, expandStrategy: 'auto' },
  { key: 'video_gen', labelKey: 'catVideoGen', order: 15, countable: true, expandStrategy: 'auto' },
  { key: 'env_init', labelKey: 'catEnvInit', order: 16, countable: true, expandStrategy: 'auto' },
  { key: 'end', labelKey: 'catEnd', order: 17, countable: false, expandStrategy: 'collapse' },
  { key: 'other', labelKey: 'catOther', order: 18, countable: true, expandStrategy: 'auto' },
] as const

/** 类目键 → 定义 的 O(1) 查询表 */
export const CATEGORY_TABLE_BY_KEY: Readonly<Record<CategoryKey, CategoryDef>> =
  Object.fromEntries(CATEGORY_TABLE.map((d) => [d.key, d])) as Record<CategoryKey, CategoryDef>

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
  // 用户交互
  ask_user: 'user_interaction',
  ask_followup: 'user_interaction',
  user_input: 'user_interaction',
  request_clarification: 'user_interaction',
  permission_request: 'user_interaction',
  // 生图
  image_gen: 'image_gen',
  generate_image: 'image_gen',
  text_to_image: 'image_gen',
  dalle: 'image_gen',
  imagen: 'image_gen',
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

/** 单个工具名 + 次数(聚合输入单元) */
export interface ToolNameCount {
  toolName: string
  count: number
}

/** 聚合后的一个类目 run(一张卡) */
export interface CategoryRun {
  categoryKey: CategoryKey
  labelKey: string
  order: number
  countable: boolean
  expandStrategy: ExpandStrategy
  /** 该 run 内所有工具调用数之和 */
  totalCount: number
  /** run 内工具明细(已按同类连续聚合并合并同工具) */
  tools: ToolNameCount[]
}

function makeRun(categoryKey: CategoryKey, first: ToolNameCount): CategoryRun {
  const def = CATEGORY_TABLE_BY_KEY[categoryKey]
  return {
    categoryKey,
    labelKey: def.labelKey,
    order: def.order,
    countable: def.countable,
    expandStrategy: def.expandStrategy,
    totalCount: first.count,
    tools: [first],
  }
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
      // 同类连续:合并进当前卡
      last.tools.push(item)
      last.totalCount += item.count
    } else {
      runs.push(makeRun(cat, item))
    }
  }
  return runs
}

/**
 * 从"无顺序的聚合计数"(ToolCallSummary.toolsByCategory)生成类目 run。
 * 无顺序信息 → 每个类目合并为单一 run(不臆造连续关系)。
 * 纯函数,可单测。
 */
export function summarizeCategoriesByTool(
  toolsByCategory: Record<string, number>,
): CategoryRun[] {
  const byCat = new Map<CategoryKey, ToolNameCount[]>()
  for (const [toolName, count] of Object.entries(toolsByCategory)) {
    const cat = resolveToolCategory(toolName)
    const arr = byCat.get(cat) ?? []
    arr.push({ toolName, count })
    byCat.set(cat, arr)
  }
  const runs: CategoryRun[] = []
  for (const [cat, tools] of byCat) {
    const total = tools.reduce((s, t) => s + t.count, 0)
    const run = makeRun(cat, tools[0])
    run.totalCount = total
    run.tools = tools
    runs.push(run)
  }
  return sortRuns(runs)
}
