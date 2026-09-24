// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * MCP 工具活动的 server × tool × 是否带上下文 三层定制措辞层(D83 / G-114,架构级)。
 *
 * 对标 Codex 的 `localConversation.mcpToolActivity.<server>.<tool>.{active,completed,
 * activeWithContext,completedWithContext}`。那一侧把「时态」做进了键名,本仓的既有约定是
 * **一种语义一个键、时态走 ICU select**(见 tool-activity.ts 的 `<功能名键>Activity`),
 * 所以这里的键只剩三个维度:server / tool / 是否带上下文参数 —— 三层键,不是四层。
 *
 * 回落链(确定性、可测,任何一级取不到都明确落到下一级,**绝不静默返回 undefined**):
 *   1. `server-tool` —— 该 server 下该 tool 的定制措辞(最精确)
 *   2. `server`      —— 该 server 的通用条目(只说"在调用哪个平台的工具")
 *   3. `tool`        —— 该 tool 的通用条目(跨 server,只说动作本身)
 *   4. `tool-name`   —— 既有「工具码名 → 功能名」一层(tool-display.ts 的 TOOL_DISPLAY_KEYS)
 *   5. `code-name`   —— 原始码名兜底(界面此时不声称任何措辞,只显示码名)
 *
 * 另有两条同层规则,都是"无定制时回落"的一部分,写在这里以免被当成隐藏分支:
 *   - **同层档位回落**:某条目只配了不带上下文的措辞而本次带上下文 ⇒ 用该条目自身的 base,
 *     **不**降级到下一级(定制仍然存在,只是不分档)。
 *   - **渲染失败继续走链**:命中的键在该端取不到值(回显键名 / 空 / ICU 语法没被解释原样吐出)
 *     ⇒ 判定本级未命中,继续下一级。语言包漏译不会把键名印到界面上。
 *
 * 表里**只登记语言包里真的存在的键**(与 TOOL_DISPLAY_KEYS 同一形状:字面量对象 + 值为 i18n 键),
 * 由 scripts/check-tool-display-resolvable.mjs 逐键核五语言 ×(shared + 各端合并视图)。
 * 键一律 `toolMcp` 前缀,便于该闸按前缀取材。
 */

import { toolDisplayKey } from './tool-display'
import {
  describeToolActivity,
  looksLikeUnrenderedIcu,
  TOOL_ACTIVITY_NAME_PARAM,
  TOOL_ACTIVITY_PARAM,
  type ToolActivityState,
} from './tool-activity'

/** 三层键的第三层:是否带可展示的上下文参数(对应 Codex 的 …WithContext 两档) */
export type McpActivityVariant = 'base' | 'withContext'

/** 回落链命中的层级;顺序即回落顺序,消费端与测试都按它断言"到底走了哪一级" */
export type McpActivityLevel = 'server-tool' | 'server' | 'tool' | 'tool-name' | 'code-name'

/** 回落链逐级遍历的固定顺序(单一定义处,不得在别处再抄一份数组字面量) */
export const MCP_ACTIVITY_LEVEL_ORDER: readonly McpActivityLevel[] = [
  'server-tool',
  'server',
  'tool',
  'tool-name',
  'code-name',
]

/** 一个条目最多两档措辞键;withContext 缺省即同层回落 base */
export interface McpActivityKeys {
  readonly base: string
  readonly withContext?: string
}

/** 第 1 层:server × tool 定制(键为归一化后的段名,见 canonicalMcpSegment) */
const SERVER_TOOL_ACTIVITY_KEYS: Readonly<
  Record<string, Readonly<Record<string, McpActivityKeys>>>
> = {
  github: {
    create_issue: {
      base: 'toolMcpGithubCreateIssueActivity',
      withContext: 'toolMcpGithubCreateIssueWithContextActivity',
    },
    create_pull_request: {
      base: 'toolMcpGithubCreatePullRequestActivity',
      withContext: 'toolMcpGithubCreatePullRequestWithContextActivity',
    },
    // 只配 base:带上下文时必须落回自身 base(同层档位回落),而不是掉到 server 档
    list_notifications: { base: 'toolMcpGithubListNotificationsActivity' },
  },
  linear: {
    create_issue: {
      base: 'toolMcpLinearCreateIssueActivity',
      withContext: 'toolMcpLinearCreateIssueWithContextActivity',
    },
    search: {
      base: 'toolMcpLinearSearchActivity',
      withContext: 'toolMcpLinearSearchWithContextActivity',
    },
  },
  figma: {
    get_code: {
      base: 'toolMcpFigmaGetCodeActivity',
      withContext: 'toolMcpFigmaGetCodeWithContextActivity',
    },
  },
  browser_use: {
    navigate: {
      base: 'toolMcpBrowserNavigateActivity',
      withContext: 'toolMcpBrowserNavigateWithContextActivity',
    },
  },
}

/** 第 2 层:该 server 的通用条目(server 名归一化后为键) */
const SERVER_ACTIVITY_KEYS: Readonly<Record<string, McpActivityKeys>> = {
  github: {
    base: 'toolMcpServerGithubActivity',
    withContext: 'toolMcpServerGithubWithContextActivity',
  },
  linear: {
    base: 'toolMcpServerLinearActivity',
    withContext: 'toolMcpServerLinearWithContextActivity',
  },
  figma: {
    base: 'toolMcpServerFigmaActivity',
    withContext: 'toolMcpServerFigmaWithContextActivity',
  },
  browser_use: {
    base: 'toolMcpServerBrowserActivity',
    withContext: 'toolMcpServerBrowserWithContextActivity',
  },
}

/** 第 3 层:该 tool 的通用条目(跨 server;同一个 tool 名挂在任何未定制的 server 下都走这里) */
const TOOL_ACTIVITY_KEYS: Readonly<Record<string, McpActivityKeys>> = {
  create_issue: {
    base: 'toolMcpToolCreateIssueActivity',
    withContext: 'toolMcpToolCreateIssueWithContextActivity',
  },
  create_pull_request: {
    base: 'toolMcpToolCreatePullRequestActivity',
    withContext: 'toolMcpToolCreatePullRequestWithContextActivity',
  },
  search_documents: {
    base: 'toolMcpToolSearchDocumentsActivity',
    withContext: 'toolMcpToolSearchDocumentsWithContextActivity',
  },
  get_file: {
    base: 'toolMcpToolGetFileActivity',
    withContext: 'toolMcpToolGetFileWithContextActivity',
  },
}

/**
 * 段名归一化:任意大小写/分隔符 → 小写下划线形态,作为查表的唯一键形。
 * `github`→`github`、`browser-use`→`browser_use`、`createIssue`→`create_issue`。
 * 空段(全非字母数字)归一化为空串,调用方按"该级不可用"处理。
 *
 * **驼峰拆分只对"首字符小写"的段生效**(实测踩过的坑):MCP 的 server 名常是品牌专名
 * (`GitHub`),无条件拆驼峰把它拆成 `git_hub`,于是"同一 server 的两种写法"落到不同级 ——
 * 归一化本该消除写法差异,反造出一个。工具名一律小写开头(`createIssue`),所以这一条
 * 规则同时保住两端:品牌名整体小写化,驼峰工具名正常拆档。
 * 代价是 PascalCase 的工具名(`CreateIssue`)拆不出来 ⇒ 不命中,按回落链往下走(宁可不命中也不猜)。
 */
export function canonicalMcpSegment(raw: string): string {
  const spaced = /^[a-z]/u.test(raw.trim()) ? raw.replace(/([a-z0-9])([A-Z])/gu, '$1_$2') : raw
  return spaced
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/**
 * 剥掉工具名里的 server 命名空间前缀,让 `mcp__github__create_issue` 与
 * `github:create_issue` 都能命中 server×tool 表。
 *
 * **刻意不剥** `github_create_issue` 这种裸下划线前缀 —— 它与"工具名本身就叫
 * github_token_list"无法区分,剥了会查错表。宁可不命中往下回落,也不猜。
 */
export function normalizeMcpToolName(toolName: string, serverName?: string | null): string {
  const raw = toolName.trim()
  const server = canonicalMcpSegment(serverName ?? '')
  if (server === '') return canonicalMcpSegment(raw)
  const namespaceForms = [
    new RegExp(`^mcp__${server}__(.+)$`, 'i'),
    new RegExp(`^${server}[.:](.+)$`, 'i'),
  ]
  for (const pattern of namespaceForms) {
    const hit = pattern.exec(raw)
    if (hit && hit[1] !== undefined && hit[1] !== '') return canonicalMcpSegment(hit[1])
  }
  return canonicalMcpSegment(raw)
}

/** 有无可展示的上下文参数:只有拿到非空文本才算"带"(withContext 措辞里有 {name},空了就是假陈述) */
export function hasDisplayableContext(context: string | null | undefined): boolean {
  return typeof context === 'string' && context.trim() !== ''
}

export interface ResolveMcpToolActivityInput {
  /** MCP 服务名;拿不到(空/null)即跳过第 1、2 层,从第 3 层起判 */
  serverName?: string | null
  /** MCP 工具名(可带 mcp__server__ 命名空间前缀) */
  toolName: string
  /** 是否带可展示的上下文参数 */
  hasContext?: boolean
}

export interface McpToolActivityResolution {
  level: McpActivityLevel
  /** 命中的 i18n 键;仅 level === 'code-name' 时为 null */
  key: string | null
  /** 实际取到的档位;withContext 定制缺失时这里会是 base(同层回落) */
  variant: McpActivityVariant
  /** 归一化后的 server 段(可能为空串) */
  server: string
  /** 归一化并剥命名空间后的 tool 段 */
  tool: string
  /** 始终非空的原始码名:链尾兜底显示的就是它,不构成"静默 undefined" */
  codeName: string
}

function pickVariantKeys(
  entry: McpActivityKeys,
  hasContext: boolean,
): { key: string; variant: McpActivityVariant } {
  if (hasContext && entry.withContext !== undefined) {
    return { key: entry.withContext, variant: 'withContext' }
  }
  return { key: entry.base, variant: 'base' }
}

/** 前缀/后缀都归一化后再比对,避免同一 server 两种写法命中不同级 */
function readLevelEntry(
  level: McpActivityLevel,
  server: string,
  tool: string,
  tables: McpActivityTables,
): McpActivityKeys | null {
  if (level === 'server-tool') {
    if (server === '') return null
    return tables.serverTool[server]?.[tool] ?? null
  }
  if (level === 'server') {
    if (server === '') return null
    return tables.server[server] ?? null
  }
  if (level === 'tool') return tables.tool[tool] ?? null
  return null
}

/**
 * 三层表的注入口(§3 工厂 + 依赖注入同一取向):默认取本模块登记的表,
 * 消费端(接线票)若带来自己的 server×tool 定制,可整张替换或合并后传入 —— 回落链只有一份实现。
 * 也用于测试注入一条定制键,证明"命中定制即不再回落"不是恒真断言。
 */
export interface McpActivityTables {
  readonly serverTool: Readonly<Record<string, Readonly<Record<string, McpActivityKeys>>>>
  readonly server: Readonly<Record<string, McpActivityKeys>>
  readonly tool: Readonly<Record<string, McpActivityKeys>>
}

/** 本模块登记的三层表(单一真相源;新增措辞先在这里登记,再到五语言 taskStatus 落键) */
export const MCP_TOOL_ACTIVITY_TABLES: McpActivityTables = {
  serverTool: SERVER_TOOL_ACTIVITY_KEYS,
  server: SERVER_ACTIVITY_KEYS,
  tool: TOOL_ACTIVITY_KEYS,
}

/** 空表(全链只剩第 4、5 层):供测试与"该端不带任何定制"的场景使用 */
export const EMPTY_MCP_ACTIVITY_TABLES: McpActivityTables = { serverTool: {}, server: {}, tool: {} }

/**
 * 纯解析(不取词、不渲染):输入 (server, tool, hasContext) 输出命中的层级与词条键。
 * 逐级按 MCP_ACTIVITY_LEVEL_ORDER 走,任何一级命中即返回;全链不命中返回 code-name 级,
 * key 为 null、codeName 为原始入参名(调用方据此显示码名,不存在 undefined 分支)。
 */
export function resolveMcpToolActivityKey(
  input: ResolveMcpToolActivityInput,
  tables: McpActivityTables = MCP_TOOL_ACTIVITY_TABLES,
): McpToolActivityResolution {
  const server = canonicalMcpSegment(input.serverName ?? '')
  const tool = normalizeMcpToolName(input.toolName, input.serverName)
  const hasContext = input.hasContext === true
  const base: Omit<McpToolActivityResolution, 'level' | 'key' | 'variant'> = {
    server,
    tool,
    codeName: input.toolName,
  }

  for (const level of MCP_ACTIVITY_LEVEL_ORDER) {
    if (level === 'tool-name') {
      // 第 4 层:既有「工具码名 → 功能名」一层;先试剥过前缀的名,再试原始名
      const displayKey = toolDisplayKey(tool) ?? toolDisplayKey(canonicalMcpSegment(input.toolName))
      if (displayKey) return { ...base, level, key: displayKey, variant: 'base' }
      continue
    }
    if (level === 'code-name') {
      // 链尾:没有键,只有原始码名。显式返回而不是 undefined。
      return { ...base, level, key: null, variant: 'base' }
    }
    const entry = readLevelEntry(level, server, tool, tables)
    if (entry) {
      const picked = pickVariantKeys(entry, hasContext)
      return { ...base, level, key: picked.key, variant: picked.variant }
    }
  }
  // 循环必然在 code-name 级 return;到此只可能是有人往 ORDER 里加了未实现的层级
  throw new Error(
    'MCP_ACTIVITY_LEVEL_ORDER 含未实现的层级,回落链无法收口(检查 ORDER 与 resolveMcpToolActivityKey 是否同批改)',
  )
}

export interface DescribeMcpToolActivityInput extends ResolveMcpToolActivityInput {
  /** running / completed;error / cancelled 由调用方按既有 toolActivityState 挡在外面 */
  state: ToolActivityState
  /** 可展示的对象文本(议题标题/检索词/URL…);空即按不带上下文措辞 */
  context?: string | null
  /** 端内取词函数:必须接受 params 第二参(与 tool-activity 同一契约) */
  translate: (key: string, params?: Record<string, string | number>) => string
}

/**
 * 一帧取词结果是否可用:没回显键名、非空、没把 ICU 语法原样吐到界面。
 * 判据与 tool-activity 的私有 isUsable 同形 —— 该文件本票不得改,故此处复用其公开出口
 * looksLikeUnrenderedIcu 组合出同一判据;接线票把它提为共享出口后应改为 import 单点。
 */
function usableRenderedText(text: string, key: string): boolean {
  return text !== key && text.trim() !== '' && !looksLikeUnrenderedIcu(text)
}

/**
 * 渲染位入口:先按三层定制措辞取词,取不到值即继续走既有链
 * (describeToolActivity = 惯用活动键 → 通用档 → 中性功能名 → 原始码名)。
 * 与 resolveMcpToolActivityKey 共用同一条回落顺序,不存在两套链。
 */
export function describeMcpToolActivity(
  input: DescribeMcpToolActivityInput,
  tables: McpActivityTables = MCP_TOOL_ACTIVITY_TABLES,
): string {
  const context = typeof input.context === 'string' ? input.context.trim() : ''
  const resolution = resolveMcpToolActivityKey(
    {
      serverName: input.serverName,
      toolName: input.toolName,
      hasContext: context !== '',
    },
    tables,
  )

  if (
    resolution.key !== null &&
    (resolution.level === 'server-tool' ||
      resolution.level === 'server' ||
      resolution.level === 'tool')
  ) {
    const params: Record<string, string | number> = { [TOOL_ACTIVITY_PARAM]: input.state }
    if (resolution.variant === 'withContext') params[TOOL_ACTIVITY_NAME_PARAM] = context
    const rendered = input.translate(resolution.key, params)
    if (usableRenderedText(rendered, resolution.key)) return rendered
  }

  // 第 4、5 层:交给既有链,由它负责"惯用活动键 → 通用档 → 中性功能名 → 原始码名"
  return describeToolActivity({
    toolName: input.toolName,
    state: input.state,
    translate: input.translate,
  })
}

/** 已登记的 MCP 措辞键清单(供覆盖率判据与"还剩多少 server×tool 待补"计数) */
export function mcpToolActivityKeyList(
  tables: McpActivityTables = MCP_TOOL_ACTIVITY_TABLES,
): string[] {
  const keys = new Set<string>()
  for (const server of Object.values(tables.serverTool)) {
    for (const entry of Object.values(server)) {
      keys.add(entry.base)
      if (entry.withContext) keys.add(entry.withContext)
    }
  }
  for (const entry of Object.values(tables.server)) {
    keys.add(entry.base)
    if (entry.withContext) keys.add(entry.withContext)
  }
  for (const entry of Object.values(tables.tool)) {
    keys.add(entry.base)
    if (entry.withContext) keys.add(entry.withContext)
  }
  return [...keys].sort()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
