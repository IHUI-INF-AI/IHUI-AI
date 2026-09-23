// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍​‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 工具活动条目 · 类目聚合双时态(D81 第①②④⑤⑥项,对标 Codex widgets.hermes.workflow)。
// 与 tool-activity(逐工具手写措辞,D83 领土)分工:本模块只做"类目聚合"——
// 把任意工具按对象维度归到 文件/图片/搜索/思考/自定义 五类之一,给出类级别的
// 「正在 X」/「已 X」双时态动词。两模块共用 taskStatus 命名空间下的双时态词表,
// 不得各建一套(台账 B4g 明文纪律)。认不出的工具落 'custom'(不编造)。

import { toolDisplayKey } from './tool-display'
import { looksLikeUnrenderedIcu } from './tool-activity'

/** 活动条目五大类目(对象维度) */
export type ActivityCategory = 'file' | 'image' | 'search' | 'thinking' | 'custom'

/**
 * 类目 → taskStatus 下的双时态词表键(字面量,禁止动态拼接绕过键扫描)。
 * 值走 ICU `{state, select, running {…} completed {…} other {…}}`,与 H28 已验证链路一致。
 */
export const TOOL_CATEGORY_ACTIVITY_KEYS: Readonly<Record<ActivityCategory, string>> = {
  file: 'fileActivity',
  image: 'imageActivity',
  search: 'searchActivity',
  thinking: 'thinkingActivity',
  custom: 'customActivity',
}

/** 文件类:读 / 写 / 创建 / 删除 / 列出 / 解析文档 / 解决冲突 / 审阅 / 上传文件 */
const FILE_TOOLS: ReadonlySet<string> = new Set([
  'read_file',
  'edit_file',
  'file_edit',
  'apply_diff',
  'replace_in_file',
  'patch',
  'write_file',
  'create_file',
  'delete_file',
  'list_files',
  'parse_document',
  'document_tables',
  'extract_document_assets',
  'resolve_conflict',
  'review_pr',
  'token6688_upload_file',
])

/** 图片类:图像 / 视频 / 音乐 / 语音 / 视觉分析 / 截图 */
const IMAGE_TOOLS: ReadonlySet<string> = new Set([
  'image_generation',
  'image_edit',
  'video_generation',
  'music_generation',
  'voice_tts',
  'audio_transcription',
  'vision_analyze',
  'screenshot_url',
  'browser_screenshot',
  'computer_screenshot_screen',
  'token6688_voice_clone',
])

/** 搜索类:网页 / 代码库 / 文件 / 知识库 / 抓取 等检索动作 */
const SEARCH_TOOLS: ReadonlySet<string> = new Set([
  'web_search',
  'search_web',
  'file_search',
  'search_codebase',
  'index_codebase',
  'knowledge_lookup',
  'context_recall',
  'fetch_url',
  'fetch_readable',
  'crawl_site',
  'map_site',
  'extract_web',
  'api_endpoints_search',
])

/** 思考类:分析 / 生成(测试·图表) / 汇总 / 调度子代理 / 计划 / 主动建议 / 参数查看 / 厂商查询 */
const THINKING_TOOLS: ReadonlySet<string> = new Set([
  'analyze_code',
  'generate_test',
  'generate_chart',
  'summarize_artifacts',
  'dispatch_subagent',
  'schedule_task',
  'configure_automation_task',
  'bg_task_status',
  'proactive_suggestion',
  'get_tool_schema',
  'token6688_balance',
  'token6688_model_info',
  'token6688_cancel_task',
])

/** 工具码名 → 类目;未登记(插件 / MCP 动态名 / 命令 / 浏览器操控 / 电脑操控 / 教务 / 数据库 等)一律落 'custom' */
export function toolCategory(toolName: string): ActivityCategory {
  if (FILE_TOOLS.has(toolName)) return 'file'
  if (IMAGE_TOOLS.has(toolName)) return 'image'
  if (SEARCH_TOOLS.has(toolName)) return 'search'
  if (THINKING_TOOLS.has(toolName)) return 'thinking'
  return 'custom'
}

/** 工具调用状态(与 @ihui/types 的 AgentToolCall['status'] 同集合,此处不引类型包以免成环) */
export type ToolActivityStatus = 'running' | 'success' | 'error' | 'cancelled'

/**
 * 状态 → 时态。**error / cancelled 一律 null**:
 * 失败或被撤回的调用显示"已 X"是假陈述,宁可只显示中性功能名。
 */
export function toolCategoryState(status: ToolActivityStatus): 'running' | 'completed' | null {
  if (status === 'running') return 'running'
  if (status === 'success') return 'completed'
  return null
}

export interface DescribeToolCategoryActivityInput {
  toolName: string
  status: ToolActivityStatus
  /** 端内取词函数:必须接受 params 第二参(web=next-intl t、miniapp/rn/cli=共享 translate 包装) */
  translate: (key: string, params?: Record<string, string | number>) => string
}

function isUsable(text: string, key: string): boolean {
  return text !== key && text.trim() !== '' && !looksLikeUnrenderedIcu(text)
}

/** 中性功能名(键缺失或该端取不到值时返回空串) */
function resolveNeutralName(
  toolName: string,
  translate: DescribeToolCategoryActivityInput['translate'],
): string {
  const baseKey = toolDisplayKey(toolName)
  if (!baseKey) return ''
  const neutral = translate(baseKey)
  return isUsable(neutral, baseKey) ? neutral : ''
}

/**
 * 类目双时态动词:running/success 出类目「正在 X / 已 X」,
 * error/cancelled 只出中性功能名(不假称"已完成")。取词失败(缺键 / ICU 未渲染)回落中性名,
 * 连中性名也取不到时回落原始工具码名(绝不喷键名到界面)。
 */
export function describeToolCategoryActivity({
  toolName,
  status,
  translate,
}: DescribeToolCategoryActivityInput): string {
  const state = toolCategoryState(status)
  if (!state) return resolveNeutralName(toolName, translate) || toolName
  const key = TOOL_CATEGORY_ACTIVITY_KEYS[toolCategory(toolName)]
  const rendered = translate(key, { state })
  if (isUsable(rendered, key)) return rendered
  return resolveNeutralName(toolName, translate) || toolName
}

/** 期望类目活动键清单(覆盖率判据与"还剩多少类目待补"计数用) */
export function toolCategoryKeyList(): string[] {
  return [...new Set(Object.values(TOOL_CATEGORY_ACTIVITY_KEYS))]
}

/** 搜索类工具的查询词取值键(顺序即优先级) */
const SEARCH_QUERY_KEYS: ReadonlyArray<string> = [
  'query',
  'keyword',
  'keywords',
  'q',
  'search_term',
  'pattern',
  'prompt',
]

/**
 * 取搜索类工具的查询词(D81 第③项 searchWithQuery)。
 * 非搜索类一律返回空串(避免把其它工具的 prompt/command 误当查询词展示);
 * 拿不到时返回空串,渲染层据此决定是否显示查询条。
 */
export function toolActivitySearchQuery(
  toolName: string,
  args?: Record<string, unknown> | null,
): string {
  if (toolCategory(toolName) !== 'search') return ''
  if (!args) return ''
  for (const key of SEARCH_QUERY_KEYS) {
    const value = args[key]
    if (typeof value === 'string' && value.trim() !== '') return value
  }
  return ''
}

// ─────────────────────────────────────────────────────────────────────────────
// ⑤ 活动按连接器读写分组(D81 第⑤项):把带连接器来源的工具活动按"读 / 写"方向聚合。
// 纯函数,跨端共用;渲染层用 readingConnector / writingConnector 词表给分组加标签。
// ─────────────────────────────────────────────────────────────────────────────

export type ConnectorDirection = 'read' | 'write'

export interface ConnectorActivityItem {
  id: string
  /** 连接器(连接器来源)名称,如 "github" / "notion";无来源可为空 */
  connector?: string
  /** 该活动相对连接器的方向:读 / 写;缺省按 'read' 处理 */
  direction?: ConnectorDirection
  /** 活动展示标签(已由调用方本地化,如类目动词或工具名) */
  label: string
}

export interface ConnectorActivityGroup {
  connector: string
  direction: ConnectorDirection
  items: ConnectorActivityItem[]
}

const EMPTY_CONNECTOR = '__none__'

/** 按连接器 + 读/写方向分组;无来源的活动归入单一"无连接器"组 */
export function groupToolActivitiesByConnector(
  items: ConnectorActivityItem[],
): ConnectorActivityGroup[] {
  const map = new Map<string, ConnectorActivityGroup>()
  for (const item of items) {
    const connector = item.connector && item.connector.trim() !== '' ? item.connector : EMPTY_CONNECTOR
    const direction: ConnectorDirection = item.direction === 'write' ? 'write' : 'read'
    const groupKey = `${connector}::${direction}`
    const group = map.get(groupKey)
    if (group) {
      group.items.push(item)
    } else {
      map.set(groupKey, { connector, direction, items: [item] })
    }
  }
  return [...map.values()].sort((a, b) => {
    if (a.connector !== b.connector) return a.connector.localeCompare(b.connector)
    return a.direction.localeCompare(b.direction)
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍​‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
