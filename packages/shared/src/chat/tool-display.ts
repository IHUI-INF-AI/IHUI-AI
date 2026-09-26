// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { FILE_WRITE_TOOLS, fileBasename, fileChangeForCall } from './task-status'

/**
 * 工具码名 → i18n 键 的展示映射(跨端单一真相源)。
 *
 * 面向用户的界面(任务状态条/消息流工具卡)禁止直接显示英文工具码名(如 read_file),
 * 必须显示工具的真实功能名(各端 i18n)。映射不到的(插件/MCP 动态名)返回 null,
 * 由调用方回落到 "调用 {name}" 式展示。
 */
const TOOL_DISPLAY_KEYS: Readonly<Record<string, string>> = {
  read_file: 'toolReadFile',
  edit_file: 'toolEditFile',
  file_edit: 'toolEditFile',
  apply_diff: 'toolEditFile',
  replace_in_file: 'toolEditFile',
  patch: 'toolEditFile',
  write_file: 'toolWriteFile',
  create_file: 'toolCreateFile',
  delete_file: 'toolDeleteFile',
  list_files: 'toolListFiles',
  file_search: 'toolFileSearch',
  search_codebase: 'toolSearchCodebase',
  index_codebase: 'toolIndexCodebase',
  analyze_code: 'toolAnalyzeCode',
  generate_test: 'toolGenerateTest',
  run_command: 'toolRunCommand',
  run_in_background: 'toolRunCommand',
  git_operations: 'toolGitOperations',
  web_search: 'toolWebSearch',
  search_web: 'toolWebSearch',
  fetch_url: 'toolFetchUrl',
  fetch_readable: 'toolFetchUrl',
  crawl_site: 'toolCrawlSite',
  map_site: 'toolCrawlSite',
  extract_web: 'toolFetchUrl',
  screenshot_url: 'toolScreenshot',
  knowledge_lookup: 'toolKnowledgeLookup',
  context_recall: 'toolContextRecall',
  parse_document: 'toolParseDocument',
  generate_chart: 'toolGenerateChart',
  summarize_artifacts: 'toolSummarizeArtifacts',
  image_generation: 'toolImageGeneration',
  image_edit: 'toolImageEdit',
  video_generation: 'toolVideoGeneration',
  music_generation: 'toolMusicGeneration',
  voice_tts: 'toolVoiceTts',
  audio_transcription: 'toolAudioTranscription',
  vision_analyze: 'toolVisionAnalyze',
  dispatch_subagent: 'toolDispatchSubagent',
  schedule_task: 'toolScheduleTask',
  configure_automation_task: 'toolScheduleTask',
  bg_task_status: 'toolBgTaskStatus',
  // 端侧操控桥:固定动词表(与 apps/web tool-config 的 WEB_UI_CONTROL_TOOLS / API_CONTROL_TOOLS 对齐)
  web_ui_describe: 'toolUiDescribe',
  web_ui_navigate: 'toolUiNavigate',
  web_ui_click: 'toolUiClick',
  web_ui_fill: 'toolUiFill',
  web_ui_submit: 'toolUiSubmit',
  web_ui_read: 'toolUiRead',
  web_ui_invoke: 'toolUiInvoke',
  api_endpoints_search: 'toolApiSearch',
  api_endpoint_call: 'toolApiCall',
  // 教育管理:固定动词表(与 eduToolsFor 对齐)
  edu_list_students: 'toolEduListStudents',
  edu_list_arrears: 'toolEduListArrears',
  edu_list_fee_reminders: 'toolEduListReminders',
  edu_list_payment_records: 'toolEduListPayments',
  edu_payment_summary: 'toolEduPaymentSummary',
  edu_list_tuition_fees: 'toolEduTuitionFees',
  edu_my_bills: 'toolEduMyBills',
  edu_list_refunds: 'toolEduListRefunds',
  edu_create_refund: 'toolEduCreateRefund',
  edu_approve_refund: 'toolEduApproveRefund',
  edu_reject_refund: 'toolEduRejectRefund',
  edu_send_fee_reminder: 'toolEduSendReminder',
  edu_send_fee_reminder_batch: 'toolEduSendReminderBatch',
  edu_create_payment_record: 'toolEduCreatePayment',
  // 浏览器操控族(mcp_server._TOOLS 的 browser_*,对标 Trae browser_action / Qoder browser.* 全中文)
  browser_navigate: 'toolBrowserNavigate',
  browser_click_element: 'toolBrowserClickElement',
  browser_type_text: 'toolBrowserTypeText',
  browser_scroll: 'toolBrowserScroll',
  browser_hover: 'toolBrowserHover',
  browser_select_option: 'toolBrowserSelectOption',
  browser_get_attribute: 'toolBrowserGetAttribute',
  browser_extract_dom: 'toolBrowserExtractDom',
  browser_wait_for_element: 'toolBrowserWaitForElement',
  browser_screenshot: 'toolBrowserScreenshot',
  browser_switch_tab: 'toolBrowserSwitchTab',
  browser_close_tab: 'toolBrowserCloseTab',
  browser_selfcheck: 'toolBrowserSelfcheck',
  browser_selfcheck_screenshot: 'toolBrowserSelfcheckScreenshot',
  // 页面语义快照句柄族(ai-service 声明、浏览器扩展执行;与上面选择器族并列但不同族)
  browser_page_snapshot: 'toolBrowserPageSnapshot',
  browser_page_click: 'toolBrowserPageClick',
  browser_page_type: 'toolBrowserPageType',
  browser_page_select: 'toolBrowserPageSelect',
  browser_page_hover: 'toolBrowserPageHover',
  browser_page_press_key: 'toolBrowserPagePressKey',
  browser_page_pick_at_point: 'toolBrowserPagePickAtPoint',
  // 电脑操控族(computer_*)
  computer_screenshot_screen: 'toolComputerScreenshotScreen',
  computer_mouse_click: 'toolComputerMouseClick',
  computer_mouse_move: 'toolComputerMouseMove',
  computer_mouse_scroll: 'toolComputerMouseScroll',
  computer_keyboard_type: 'toolComputerKeyboardType',
  computer_keyboard_press: 'toolComputerKeyboardPress',
  computer_keyboard_hotkey: 'toolComputerKeyboardHotkey',
  computer_clipboard_get: 'toolComputerClipboardGet',
  computer_clipboard_set: 'toolComputerClipboardSet',
  computer_active_window: 'toolComputerActiveWindow',
  // 其余零散内置工具
  db_query: 'toolDbQuery',
  document_tables: 'toolDocumentTables',
  extract_document_assets: 'toolExtractDocumentAssets',
  get_tool_schema: 'toolGetToolSchema',
  proactive_suggestion: 'toolProactiveSuggestion',
  resolve_conflict: 'toolResolveConflict',
  review_pr: 'toolReviewPr',
  // token6688 厂商侧能力(键名按"厂商"语义,不把厂商标识塞进 i18n 键)
  token6688_balance: 'toolVendorBalance',
  token6688_model_info: 'toolVendorModelInfo',
  token6688_upload_file: 'toolVendorUploadFile',
  token6688_cancel_task: 'toolVendorCancelTask',
  // DAP 调试会话族(apps/cli/src/tools/debug.ts,DEBUG_TOOLS 注册给模型)
  debug_launch: 'toolDebugLaunch',
  debug_attach: 'toolDebugAttach',
  debug_set_breakpoints: 'toolDebugSetBreakpoints',
  debug_continue: 'toolDebugContinue',
  debug_step: 'toolDebugStep',
  debug_get_stack_trace: 'toolDebugGetStackTrace',
  debug_get_variables: 'toolDebugGetVariables',
  debug_eval: 'toolDebugEval',
  debug_disconnect: 'toolDebugDisconnect',
  debug_list_sessions: 'toolDebugListSessions',
  token6688_voice_clone: 'toolVendorVoiceClone',
}

export function toolDisplayKey(toolName: string): string | null {
  return TOOL_DISPLAY_KEYS[toolName] ?? null
}

/**
 * 把自由文本里的英文工具码名替换为本地化功能名。
 * 用于后端 plan step 标题等含 "read_file: path" 式前缀的文本 —— 界面禁止直显英文工具码名。
 * translate 接收 i18n 键(如 'toolReadFile')返回本地化功能名;无翻译时键名原样回落可接受。
 */
export function humanizeToolText(text: string, translate: (key: string) => string): string {
  let out = text
  for (const [code, key] of Object.entries(TOOL_DISPLAY_KEYS)) {
    if (out.includes(code)) {
      out = out.split(code).join(translate(key))
    }
  }
  return out
}

export const __toolDisplayKeys = TOOL_DISPLAY_KEYS

/**
 * 工具行的"对象"类型 —— 决定渲染层用等宽字体还是普通文本,以及前置图标。
 * - path:文件/目录路径;query:检索词;url:网页地址;command:shell 命令;
 * - name:实体名(子代理名/任务标题);none:无可靠对象,只显示功能名。
 */
export type ToolSubjectKind = 'path' | 'query' | 'url' | 'command' | 'name' | 'none'

/** 工具行的"结果度量"类型,渲染层用 i18n 单位键渲染成 "12 行" / "5 个结果" */
export type ToolMetricKind = 'lines' | 'results' | 'files' | 'chars' | 'none'

export interface ToolCallView {
  /** 本地化功能名的 i18n 键;映射不到为 null(插件/MCP 动态名) */
  nameKey: string | null
  /** 原始工具码名,仅在 nameKey 为 null 时作为兜底显示 */
  codeName: string
  subjectKind: ToolSubjectKind
  /** 已经过空白折叠与截断的对象文本;空串表示没有 */
  subject: string
  metricKind: ToolMetricKind
  /** 度量数值;null = 拿不到,渲染层不显示单位而不是显示 0 */
  metricValue: number | null
  /** 写类文件的增删行数(拿不到为 -1) */
  added: number
  removed: number
  /** 是否为改动工作区文件的写类工具 */
  writesFile: boolean
}

const SUBJECT_KEYS: Readonly<Record<Exclude<ToolSubjectKind, 'none'>, readonly string[]>> = {
  path: ['path', 'file_path', 'filePath', 'file', 'filename', 'target_file', 'dir', 'directory'],
  query: [
    'query',
    'keyword',
    'keywords',
    'pattern',
    'q',
    'search_term',
    'prompt',
    'description',
    'selector',
    'target',
  ],
  url: ['url', 'uri', 'link', 'target_url', 'site_url'],
  command: ['command', 'cmd', 'script'],
  name: ['agent', 'agent_name', 'subagent_type', 'name', 'title', 'task_name', 'key', 'text'],
}

/** 工具 → 对象类型。未登记的走"按类型逐个试探"的通用兜底,避免每加一个工具都要改表 */
const TOOL_SUBJECT_KINDS: Readonly<Record<string, Exclude<ToolSubjectKind, 'none'>>> = {
  read_file: 'path',
  write_file: 'path',
  edit_file: 'path',
  file_edit: 'path',
  create_file: 'path',
  delete_file: 'path',
  list_files: 'path',
  parse_document: 'path',
  file_search: 'query',
  search_codebase: 'query',
  analyze_code: 'query',
  generate_test: 'query',
  knowledge_lookup: 'query',
  context_recall: 'query',
  web_search: 'query',
  search_web: 'query',
  fetch_url: 'url',
  fetch_readable: 'url',
  crawl_site: 'url',
  map_site: 'url',
  extract_web: 'url',
  screenshot_url: 'url',
  web_ui_navigate: 'url',
  run_command: 'command',
  run_in_background: 'command',
  git_operations: 'command',
  dispatch_subagent: 'name',
  schedule_task: 'name',
  configure_automation_task: 'name',
  api_endpoint_call: 'path',
  image_generation: 'query',
  image_edit: 'query',
  video_generation: 'query',
  music_generation: 'query',
  voice_tts: 'query',
  vision_analyze: 'query',
}

const SUBJECT_MAX = 160

function normalizeSubject(raw: string): string {
  // 路径统一分隔符,长文本折叠空白;两端留白去掉
  const collapsed = raw.replace(/\s+/g, ' ').trim()
  const slashed = collapsed.replace(/\\/g, '/')
  return slashed.length > SUBJECT_MAX ? `${slashed.slice(0, SUBJECT_MAX - 1)}…` : slashed
}

function readArg(
  args: Record<string, unknown> | undefined | null,
  keys: readonly string[],
): string {
  if (!args) return ''
  for (const key of keys) {
    const value = args[key]
    if (typeof value === 'string' && value.trim() !== '') return value
  }
  return ''
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

const COUNT_FIELDS = ['count', 'total', 'num_results', 'result_count', 'matches_count'] as const
const ARRAY_FIELDS = [
  'results',
  'matches',
  'items',
  'files',
  'entries',
  'hits',
  'documents',
  'listings',
] as const
const TEXT_FIELDS = ['content', 'text', 'output', 'body', 'markdown'] as const

/** 真实行数:末尾换行不构成额外一行(与状态条 ±行数同一口径) */
function realLineCount(text: string): number {
  if (!text) return 0
  return (text.endsWith('\n') ? text.slice(0, -1) : text).split('\n').length
}

/** 结果条数:空行不算一条(检索类文本结果按行近似) */
function entryCount(text: string): number {
  return text.split('\n').filter((line) => line.trim() !== '').length
}

function metricFromResult(
  toolName: string,
  result: unknown,
): { kind: ToolMetricKind; value: number | null } {
  const record = asRecord(result)
  if (record) {
    for (const field of ARRAY_FIELDS) {
      const list = record[field]
      if (Array.isArray(list)) {
        return {
          kind: field === 'files' || field === 'entries' ? 'files' : 'results',
          value: list.length,
        }
      }
    }
    for (const field of COUNT_FIELDS) {
      const n = record[field]
      if (typeof n === 'number' && Number.isFinite(n)) return { kind: 'results', value: n }
    }
    for (const field of TEXT_FIELDS) {
      const text = record[field]
      if (typeof text === 'string' && text !== '') {
        if (READ_LINE_TOOLS.has(toolName)) return { kind: 'lines', value: realLineCount(text) }
        if (SEARCH_TOOLS.has(toolName)) return { kind: 'results', value: entryCount(text) }
        return { kind: 'lines', value: realLineCount(text) }
      }
    }
  }
  if (typeof result === 'string' && result !== '') {
    if (SEARCH_TOOLS.has(toolName)) return { kind: 'results', value: entryCount(result) }
    const lines = realLineCount(result)
    if (lines > 1) return { kind: 'lines', value: lines }
  }
  return { kind: 'none', value: null }
}

const READ_LINE_TOOLS: ReadonlySet<string> = new Set(['read_file', 'parse_document', 'web_ui_read'])
const SEARCH_TOOLS: ReadonlySet<string> = new Set([
  'file_search',
  'search_codebase',
  'web_search',
  'search_web',
  'knowledge_lookup',
  'context_recall',
  'analyze_code',
  'api_endpoints_search',
])

/** 从工具调用推出"一行话该怎么写"所需的视图模型(跨端单一真相源) */
export interface DescribeToolCallInput {
  toolName: string
  args?: Record<string, unknown> | null
  result?: unknown
  /** 'running' | 'success' | 'error' …;仅用于决定要不要显示结果度量 */
  status?: string
}

/**
 * 把一次工具调用描述成 "功能名 + 对象 + 结果度量"(对标 Qoder / Trae / Codex 的活动行信息结构)。
 *
 * 界面只需要这一层信息就能把一行说清楚(如「读取文件内容 apps/web/src/app/page.tsx · 128 行」),
 * 不需要各自从 args/result 里现挖,也不允许把英文工具码名当作用户可见文案。
 */
export function describeToolCall(input: DescribeToolCallInput): ToolCallView {
  const { toolName, args, result, status } = input
  const kind = TOOL_SUBJECT_KINDS[toolName] ?? 'none'
  let subject = kind === 'none' ? '' : normalizeSubject(readArg(args, SUBJECT_KEYS[kind]))
  if (kind === 'none') {
    // 未登记的工具(插件 / MCP 动态名):按 path → url → query → command → name 试探
    for (const probe of ['path', 'url', 'query', 'command', 'name'] as const) {
      const value = normalizeSubject(readArg(args, SUBJECT_KEYS[probe]))
      if (value !== '') {
        subject = value
        break
      }
    }
  }

  const writesFile = FILE_WRITE_TOOLS.has(toolName)
  const change = writesFile ? fileChangeForCall(toolName, args ?? undefined, result) : null
  const metric =
    status === 'success'
      ? metricFromResult(toolName, result)
      : { kind: 'none' as ToolMetricKind, value: null }

  return {
    nameKey: toolDisplayKey(toolName),
    codeName: toolName,
    subjectKind: kind === 'none' && subject !== '' ? guessKind(subject) : kind,
    subject,
    metricKind: change ? 'none' : metric.kind,
    metricValue: change ? null : metric.value,
    added: change?.added ?? -1,
    removed: change?.removed ?? -1,
    writesFile,
  }
}

/** 通用兜底猜出来的对象长什么样,就按什么类型渲染(路径/URL/命令都有明显字形特征) */
function guessKind(subject: string): ToolSubjectKind {
  if (/^https?:\/\//i.test(subject)) return 'url'
  if (/[\\/]|\.[a-z0-9]{1,8}$/i.test(subject)) return 'path'
  if (/[;&|`$]|\s--\w/.test(subject)) return 'command'
  return 'query'
}

/** 路径末段(消息流行内优先显示相对路径,过长时由渲染层裁;这里提供统一 basename 口径) */
export function toolSubjectBasename(subject: string): string {
  return subject === '' ? '' : fileBasename(subject)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
