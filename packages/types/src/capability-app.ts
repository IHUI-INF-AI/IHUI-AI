// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 端内能力应用(Capability App)跨端契约 —— AI 生成的应用直接在本程序内显示与使用。
 *
 * 定位(与既有插件体系的关系,不是平行系统):
 *  - 插件市场 `@ihui/types/plugin` 只管「目录 + 安装态」,没有运行时承载体;
 *  - 能力扩展 `@ihui/types/capability-extensions` 是**声明式** manifest,禁止携带可执行字段,
 *    其中 `views` / `sidebarNavItems` 两档在 CLI 侧被如实判为 `no-host`(宿主吃不下)。
 *  - 本文件补的正是那个缺失的宿主:**Web 端把声明式应用渲染进真实界面落点**。
 *    应用 = 一份 AppSpec(JSON),零编译、零重启、无任意代码执行,落库即生效。
 *
 * 为什么不做「生成代码 → 打包 → 安装」那条路:
 *  1) 安全:宿主进程执行他人代码不是沙箱边界,一条 `dangerouslySetInnerHTML` 就能越权;
 *  2) 时效:编译+构建+热更链路一旦失败,用户只看到「装了个空插件」;
 *  3) 可审计:JSON 可逐字段校验、可 diff、可回滚,代码包做不到。
 *  声明式 UI 把「AI 造应用」从「装软件」降级成「存一条配置」,这是可验证的超越轴。
 *
 * 单一真相源:
 *  - 落点枚举 `CAPABILITY_APP_SLOTS` 与 DSH 的五档同名(见 docs 取证),
 *    消费方 = Web 渲染器;新增一档必须同批有挂载点,否则校验器与渲染器漂移。
 *  - 块枚举 `CAPABILITY_APP_BLOCK_KINDS` 的消费方 = 渲染器块注册表(Record<Kind,…>,少一档编译期即红)。
 *  - 本模块只做纯函数校验,不注册、不落库、不 fetch。
 */

// ===========================================================================
// 落点
// ===========================================================================

/** 应用在界面上的落点。前四档与宿主外壳的真实挂载点一一对应。 */
export const CAPABILITY_APP_SLOTS = [
  /** 对话页新增 Tab(与会话绑定的流式输出/交互) */
  'page',
  /** 对话右侧栏(与会话绑定的查看器/编辑器) */
  'sidebar-right',
  /** 左侧入口打开主区域独立页面(全局功能) */
  'sidebar-left',
  /** 输入框下方 dock(一次性小工具) */
  'chat-dock',
  /** 全局浮层(必须自带位置,慎用) */
  'shell-overlay',
] as const
export type CapabilityAppSlot = (typeof CAPABILITY_APP_SLOTS)[number]

// ===========================================================================
// 只读能力调用(白名单)
// ===========================================================================

/**
 * 应用可调用的**只读一方能力**。这是「插件包运行时」的核心:
 * DSH 的插件包靠 `contributes.tools` 携带可执行实现,宿主只能信任包作者;
 * 我们反过来 —— 应用只声明**能力名 + 参数**,实现留在服务端白名单里,
 * 因此:可审计(每次调用落一条日志)、可撤销(白名单删名即失效)、
 * 可越权防御(用户作用域由服务端注入,应用拿不到 userId)。
 *
 * 单一真相源:本表是唯一词表,消费方 = 校验器(存盘时)、service(执行时)、渲染器(参数提示)。
 * 新增一项必须同时给出服务端 handler,否则 `CAPABILITY_APP_ACTION_HANDLERS` 编译期即红。
 */
export const CAPABILITY_APP_CALL_NAMES = [
  'conversations.recent',
  'notifications.recent',
  'usage.daily',
] as const
export type CapabilityAppCallName = (typeof CAPABILITY_APP_CALL_NAMES)[number]

export interface CapabilityAppCallParam {
  key: string
  kind: 'number' | 'string' | 'boolean'
  required?: boolean
  min?: number
  max?: number
  maxChars?: number
  description: string
}

export interface CapabilityAppCallSpec {
  name: CapabilityAppCallName
  summary: string
  params: readonly CapabilityAppCallParam[]
}

export const CAPABILITY_APP_CALLS: Record<CapabilityAppCallName, CapabilityAppCallSpec> = {
  'conversations.recent': {
    name: 'conversations.recent',
    summary: '当前用户最近的会话列表(标题 / 消息数 / 更新时间)',
    params: [
      { key: 'limit', kind: 'number', min: 1, max: 50, description: '返回条数,默认 10' },
      { key: 'search', kind: 'string', maxChars: 100, description: '按标题关键词过滤' },
      { key: 'includeArchived', kind: 'boolean', description: '是否包含已归档会话' },
    ],
  },
  'notifications.recent': {
    name: 'notifications.recent',
    summary: '当前用户最近的通知(含未读总数)',
    params: [
      { key: 'limit', kind: 'number', min: 1, max: 50, description: '返回条数,默认 10' },
      { key: 'unreadOnly', kind: 'boolean', description: '只看未读' },
    ],
  },
  'usage.daily': {
    name: 'usage.daily',
    summary: '当前用户按日积分消耗与新建会话数(上海业务日)',
    params: [{ key: 'days', kind: 'number', min: 1, max: 90, description: '回溯天数,默认 30' }],
  },
}

export const CAPABILITY_APP_CALL_NAME_SET = new Set<string>(CAPABILITY_APP_CALL_NAMES)

/** 调用入参统一用字符串承载(表单值天然是字符串),服务端按 param.kind 强转。 */
export type CapabilityAppCallArgs = Record<string, string>

export interface CapabilityAppCallArgIssue {
  /** 出问题的参数键;null = 整个 args 对象的问题 */
  key: string | null
  message: string
}

export type CapabilityAppCallArgsParse =
  { ok: true; value: CapabilityAppCallArgs } | { ok: false; errors: CapabilityAppCallArgIssue[] }

/**
 * 解析并校验白名单调用入参 —— **唯一实现**。
 *
 * 消费方:客户端校验器(存盘时逐字段报错)、服务端 service(收到请求时再跑一遍,
 * 因为客户端校验永远可被绕过)。两侧共用同一份元数据与同一套强转规则,
 * 不会出现"存盘通过、运行时 400"或反之的漂移。
 *
 * 规则:名字必须在白名单;键必须是该能力已声明参数;值只能是标量并满足 kind/范围。
 */
export function parseCapabilityAppCallArgs(
  name: CapabilityAppCallName,
  raw: unknown,
): CapabilityAppCallArgsParse {
  const spec = CAPABILITY_APP_CALLS[name]
  if (!spec) {
    return { ok: false, errors: [{ key: null, message: `未知能力 "${String(name)}"` }] }
  }
  const allowed = new Map(spec.params.map((param) => [param.key, param]))
  if (raw === undefined || raw === null) {
    const missing = spec.params.filter((param) => param.required)
    if (missing.length > 0) {
      return {
        ok: false,
        errors: [
          {
            key: null,
            message: `缺少必填参数:${missing.map((param) => param.key).join('/')}`,
          },
        ],
      }
    }
    return { ok: true, value: {} }
  }
  if (!isRecord(raw)) {
    return { ok: false, errors: [{ key: null, message: '入参必须是对象' }] }
  }
  const errors: CapabilityAppCallArgIssue[] = []
  const value: CapabilityAppCallArgs = {}
  for (const [key, cell] of Object.entries(raw)) {
    const param = allowed.get(key)
    if (!param) {
      errors.push({
        key,
        message: `不是 ${name} 的参数(可用:${[...allowed.keys()].join('/')})`,
      })
      continue
    }
    if (cell === undefined || cell === null) continue
    if (typeof cell !== 'string' && typeof cell !== 'number' && typeof cell !== 'boolean') {
      errors.push({ key, message: '只能是字符串/数字/布尔' })
      continue
    }
    const text = String(cell)
    if (param.kind === 'number') {
      const num = Number(text)
      if (!Number.isFinite(num)) {
        errors.push({ key, message: '必须是数字' })
        continue
      }
      if (param.min !== undefined && num < param.min) {
        errors.push({ key, message: `不得小于 ${param.min}` })
        continue
      }
      if (param.max !== undefined && num > param.max) {
        errors.push({ key, message: `不得大于 ${param.max}` })
        continue
      }
    }
    if (param.kind === 'boolean' && text !== 'true' && text !== 'false') {
      errors.push({ key, message: '只能是 true/false' })
      continue
    }
    if (param.maxChars !== undefined && text.length > param.maxChars) {
      errors.push({ key, message: `超过 ${param.maxChars} 字符上限` })
      continue
    }
    value[key] = text
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value }
}

/**
 * 收集应用声明用到的全部能力名(`data[].call` + 动作 `tool.call`)。
 *
 * 服务端只允许调用应用自己声明过的能力 —— 一个泄露的 app id 也不等于
 * 一张任意能力的通行证。这是 "capability scoping",也是与 DSH 插件工具面
 * 最大的差别:那边插件一旦加载即持有全部 contributes.tools。
 */
export function collectDeclaredCalls(spec: unknown): Set<CapabilityAppCallName> {
  const found = new Set<CapabilityAppCallName>()
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) visit(item)
      return
    }
    if (!isRecord(value)) return
    const call = value['call']
    if (typeof call === 'string' && CAPABILITY_APP_CALL_NAME_SET.has(call)) {
      found.add(call as CapabilityAppCallName)
    }
    for (const child of Object.values(value)) visit(child)
  }
  visit(spec)
  return found
}

/** POST /api/capability-apps/:id/invoke 请求体 */
export interface CapabilityAppInvokeRequest {
  call: CapabilityAppCallName
  args?: CapabilityAppCallArgs
}

/** POST /api/capability-apps/:id/invoke 响应体 */
export interface CapabilityAppInvokeResult {
  call: CapabilityAppCallName
  result: CapabilityJsonValue
  /** 服务端执行耗时(毫秒),用于 UI 提示与慢调用排查 */
  elapsedMs: number
}

// ===========================================================================
// JSON 值
// ===========================================================================

export type CapabilityJsonPrimitive = string | number | boolean | null
export type CapabilityJsonValue =
  CapabilityJsonPrimitive | CapabilityJsonValue[] | { [key: string]: CapabilityJsonValue }

// ===========================================================================
// 动作(声明式,不含可执行入口)
// ===========================================================================

/**
 * 应用内可触发的动作。**没有** `tool` / `http` / `eval` 这类自由调用档:
 *  - 站内跳转走 `navigate`(渲染器复用 `ui-action-registry` 的路由白名单);
 *  - 想调模型就走 `agent` —— 把提示词投回对话,由既有 Agent 链路执行(深度融合点);
 *  - 数据刷新走 `refresh`(重取 `data` 里声明的同源 GET 绑定);
 *  - 取一方只读数据走 `call` —— 只能是 `CAPABILITY_APP_CALL_NAMES` 白名单里的名字,
 *    没有地址、没有方法、没有请求头,实现与用户作用域都在服务端。
 */
export type CapabilityAppAction =
  | { type: 'navigate'; path: string }
  | { type: 'copy'; text: string }
  | { type: 'agent'; prompt: string }
  | { type: 'refresh' }
  | { type: 'submit'; prompt?: string }
  | {
      type: 'tool'
      call: CapabilityAppCallName
      args?: CapabilityAppCallArgs
      /** 结果写回哪个绑定键;给出后任何 `from: <into>` 的块会立刻显示该结果 */
      into?: string
    }

export type CapabilityAppTone = 'info' | 'success' | 'warn' | 'error'

// ===========================================================================
// 块
// ===========================================================================

export interface CapabilityAppBaseBlock {
  /** 可选稳定 id,用于表单 `setField` 定位与 React key */
  id?: string
  /** 数据绑定名(键必须存在于 spec.data);声明后该块从绑定取数 */
  from?: string
  /** 绑定取数后的字段名:数组取行、对象取值 */
  valueKey?: string
}

export interface CapabilityAppHeadingBlock extends CapabilityAppBaseBlock {
  kind: 'heading'
  text: string
  level?: 1 | 2 | 3
}

export interface CapabilityAppTextBlock extends CapabilityAppBaseBlock {
  kind: 'text'
  text: string
}

export interface CapabilityAppCalloutBlock extends CapabilityAppBaseBlock {
  kind: 'callout'
  text: string
  title?: string
  tone?: CapabilityAppTone
}

export interface CapabilityAppBadgeBlock extends CapabilityAppBaseBlock {
  kind: 'badge'
  text: string
  tone?: CapabilityAppTone
}

export interface CapabilityAppDividerBlock extends CapabilityAppBaseBlock {
  kind: 'divider'
}

export interface CapabilityAppKeyValueBlock extends CapabilityAppBaseBlock {
  kind: 'keyValue'
  items?: Array<{ label: string; value: string }>
}

export interface CapabilityAppStatBlock extends CapabilityAppBaseBlock {
  kind: 'stat'
  items?: Array<{ label: string; value: string; hint?: string }>
}

export interface CapabilityAppProgressBlock extends CapabilityAppBaseBlock {
  kind: 'progress'
  label: string
  value: number
  max?: number
}

export interface CapabilityAppListBlock extends CapabilityAppBaseBlock {
  kind: 'list'
  items?: string[]
  ordered?: boolean
  /** 绑定行里作为显示文本的字段名(默认取行本身) */
  labelKey?: string
}

export interface CapabilityAppTableBlock extends CapabilityAppBaseBlock {
  kind: 'table'
  columns: Array<{ key: string; label: string }>
  rows?: Array<Record<string, string | number>>
}

export interface CapabilityAppCodeBlock extends CapabilityAppBaseBlock {
  kind: 'code'
  code: string
  language?: string
}

export interface CapabilityAppImageBlock extends CapabilityAppBaseBlock {
  kind: 'image'
  src: string
  alt: string
  caption?: string
}

export interface CapabilityAppButtonBlock extends CapabilityAppBaseBlock {
  kind: 'button'
  label: string
  variant?: 'primary' | 'secondary' | 'ghost'
  action: CapabilityAppAction
}

export interface CapabilityAppChartBlock extends CapabilityAppBaseBlock {
  kind: 'chart'
  chartType: 'bar' | 'line' | 'pie'
  items?: Array<{ label: string; value: number }>
  title?: string
}

export interface CapabilityAppTabsBlock extends CapabilityAppBaseBlock {
  kind: 'tabs'
  tabs: Array<{ label: string; blocks: CapabilityAppBlock[] }>
}

export interface CapabilityAppColumnsBlock extends CapabilityAppBaseBlock {
  kind: 'columns'
  columns: Array<{ label?: string; blocks: CapabilityAppBlock[] }>
}

export interface CapabilityAppFieldBase {
  name: string
  label: string
  placeholder?: string
  required?: boolean
  defaultValue?: string
}

export type CapabilityAppField =
  | (CapabilityAppFieldBase & { kind: 'input' })
  | (CapabilityAppFieldBase & { kind: 'textarea' })
  | (CapabilityAppFieldBase & { kind: 'select'; options: Array<{ label: string; value: string }> })
  | (CapabilityAppFieldBase & { kind: 'toggle'; defaultChecked?: boolean })

export interface CapabilityAppFormBlock extends CapabilityAppBaseBlock {
  kind: 'form'
  fields: CapabilityAppField[]
  submitLabel: string
  action: CapabilityAppAction
}

export type CapabilityAppBlock =
  | CapabilityAppHeadingBlock
  | CapabilityAppTextBlock
  | CapabilityAppCalloutBlock
  | CapabilityAppBadgeBlock
  | CapabilityAppDividerBlock
  | CapabilityAppKeyValueBlock
  | CapabilityAppStatBlock
  | CapabilityAppProgressBlock
  | CapabilityAppListBlock
  | CapabilityAppTableBlock
  | CapabilityAppCodeBlock
  | CapabilityAppImageBlock
  | CapabilityAppButtonBlock
  | CapabilityAppChartBlock
  | CapabilityAppTabsBlock
  | CapabilityAppColumnsBlock
  | CapabilityAppFormBlock

/** 块词表。渲染器以 Record<Kind, …> 承接,新增一档而渲染器未跟上 ⇒ 编译期即红。 */
export const CAPABILITY_APP_BLOCK_KINDS = [
  'heading',
  'text',
  'callout',
  'badge',
  'divider',
  'keyValue',
  'stat',
  'progress',
  'list',
  'table',
  'code',
  'image',
  'button',
  'chart',
  'tabs',
  'columns',
  'form',
] as const
export type CapabilityAppBlockKind = (typeof CAPABILITY_APP_BLOCK_KINDS)[number]

// ===========================================================================
// 应用定义
// ===========================================================================

/**
 * 数据绑定:两条腿,二选一。
 *  - `path`:**同源 GET**、必须以 `/api/` 开头。刻意不开放任意 URL / 方法 / 请求头,
 *    否则等于给声明式 UI 开一个可被 AI 指使的 SSRF 面。
 *  - `call`:**白名单只读能力**,走 `POST /:id/invoke`,用户作用域由服务端注入。
 *    比 `path` 更强的一点:应用不必知道我们内部的路由形状,接口重构不破坏存量应用。
 */
export interface CapabilityAppDataSource {
  path?: string
  /** 结果选取(可选):从响应 JSON 里取哪个字段作为数据体 */
  pick?: string
  call?: CapabilityAppCallName
  args?: CapabilityAppCallArgs
}

export interface CapabilityAppSpec {
  /** 应用级说明,显示在页头(可选) */
  description?: string
  /** 数据绑定表:键 = blocks 里 `from` 的取值 */
  data?: Record<string, CapabilityAppDataSource>
  blocks: CapabilityAppBlock[]
}

/** 落库前的最小草稿(id 由调用方给定或服务端生成)。 */
export interface CapabilityAppDraft {
  id: string
  title: string
  description?: string
  /** 图标名(渲染器只认内置图标表,不加载远端资源) */
  icon?: string
  slot: CapabilityAppSlot
  version: string
  /** ai = 模型生成,user = 用户手写/粘贴 */
  source: 'ai' | 'user'
  spec: CapabilityAppSpec
}

/** 持久化记录(user_preferences.value 解析后的形状)。 */
export interface CapabilityAppRecord extends CapabilityAppDraft {
  createdAt: string
  updatedAt: string
}

/** GET /api/capability-apps 响应体 */
export interface CapabilityAppListResponse {
  apps: CapabilityAppRecord[]
  authenticated: boolean
}

/** GET /api/capability-apps/:id 响应体 */
export interface CapabilityAppDetailResponse {
  app: CapabilityAppRecord
}

/** DELETE /api/capability-apps/:id 响应体 */
export interface CapabilityAppDeleteResponse {
  id: string
  removed: true
}

// ===========================================================================
// 限额(校验器与服务端共用,单一真相源)
// ===========================================================================

export const CAPABILITY_APP_LIMITS = {
  /** 单应用块总数(含 tabs/columns 嵌套) */
  maxBlocks: 160,
  /** 嵌套深度(tabs/columns 递归) */
  maxDepth: 6,
  /** 单应用序列化字节上限 */
  maxBytes: 96 * 1024,
  /** 单个字符串字段字符上限 */
  maxStringChars: 4000,
  /** 单用户应用数上限 */
  maxAppsPerUser: 40,
  /** 数据绑定条数上限 */
  maxDataSources: 8,
  /** tabs/columns 子容器数上限 */
  maxChildren: 6,
  /** 列表/表格/图表行数上限 */
  maxRows: 500,
} as const

export const CAPABILITY_APP_ID_RE = /^[a-z][a-z0-9-]{1,63}$/
export const CAPABILITY_APP_VERSION_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/
/** 绑定键:应用内 `data` 的键 / 动作 `into` 的目标(两处同一口径) */
export const CAPABILITY_APP_BINDING_KEY_RE = /^[A-Za-z][A-Za-z0-9_-]{0,31}$/

/**
 * manifest 任何层级出现这些键都拒绝(与 capability-extensions 同一份黑名单口径)。
 * 声明式 UI 只能**描述**,不能携带入口。
 */
export const CAPABILITY_APP_FORBIDDEN_KEYS = [
  'exec',
  'script',
  'command',
  'shell',
  'bin',
  'main',
  'run',
  'eval',
  'spawn',
  'require',
  'import',
  'entrypoint',
  'dangerouslySetInnerHTML',
] as const

// ===========================================================================
// 校验
// ===========================================================================

export interface CapabilityAppIssue {
  path: string
  code:
    | 'invalid_type'
    | 'unknown_field'
    | 'executable_field_forbidden'
    | 'missing_field'
    | 'invalid_id'
    | 'invalid_version'
    | 'invalid_slot'
    | 'invalid_block_kind'
    | 'invalid_action'
    | 'invalid_path'
    | 'unknown_call'
    | 'invalid_call_args'
    | 'conflicting_data_source'
    | 'too_many'
    | 'too_deep'
    | 'too_large'
    | 'string_too_long'
    | 'number_out_of_range'
    | 'unknown_data_source'
  message: string
}

export type CapabilityAppValidation =
  | { ok: true; value: CapabilityAppDraft; bytes: number }
  | { ok: false; errors: CapabilityAppIssue[] }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function issue(
  path: string,
  code: CapabilityAppIssue['code'],
  message: string,
): CapabilityAppIssue {
  return { path, code, message }
}

const FORBIDDEN_SET = new Set<string>(CAPABILITY_APP_FORBIDDEN_KEYS)
const SLOT_SET = new Set<string>(CAPABILITY_APP_SLOTS)
const BLOCK_KIND_SET = new Set<string>(CAPABILITY_APP_BLOCK_KINDS)
const TONE_SET = new Set<string>(['info', 'success', 'warn', 'error'])
const CHART_TYPE_SET = new Set<string>(['bar', 'line', 'pie'])
const ACTION_TYPES = new Set<string>(['navigate', 'copy', 'agent', 'refresh', 'submit', 'tool'])

/** 深度扫描可执行键(与 capability-extensions.findExecutableFields 同口径)。 */
export function findCapabilityAppExecutableFields(
  value: unknown,
  path = '$',
): CapabilityAppIssue[] {
  const found: CapabilityAppIssue[] = []
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      found.push(...findCapabilityAppExecutableFields(item, `${path}[${index}]`))
    })
    return found
  }
  if (!isRecord(value)) return found
  for (const [key, child] of Object.entries(value)) {
    const childPath = path === '$' ? key : `${path}.${key}`
    if (FORBIDDEN_SET.has(key)) {
      found.push(
        issue(
          childPath,
          'executable_field_forbidden',
          `字段 "${childPath}" 是可执行字段(禁止项:${CAPABILITY_APP_FORBIDDEN_KEYS.join('/')}),应用定义只允许声明式内容`,
        ),
      )
      continue
    }
    found.push(...findCapabilityAppExecutableFields(child, childPath))
  }
  return found
}

interface BlockContext {
  errors: CapabilityAppIssue[]
  dataKeys: Set<string>
  blockCount: { value: number }
}

function readString(
  raw: Record<string, unknown>,
  key: string,
  path: string,
  ctx: BlockContext,
  required: boolean,
): string | undefined {
  const value = raw[key]
  if (value === undefined || value === null) {
    if (required) {
      ctx.errors.push(issue(`${path}.${key}`, 'missing_field', `缺少必填字段 "${path}.${key}"`))
    }
    return undefined
  }
  if (typeof value !== 'string') {
    ctx.errors.push(issue(`${path}.${key}`, 'invalid_type', `字段 "${path}.${key}" 必须是字符串`))
    return undefined
  }
  if (value.length > CAPABILITY_APP_LIMITS.maxStringChars) {
    ctx.errors.push(
      issue(
        `${path}.${key}`,
        'string_too_long',
        `字段 "${path}.${key}" 超过 ${CAPABILITY_APP_LIMITS.maxStringChars} 字符上限`,
      ),
    )
  }
  return value
}

function readArray(
  raw: Record<string, unknown>,
  key: string,
  path: string,
  ctx: BlockContext,
): unknown[] | undefined {
  const value = raw[key]
  if (value === undefined) return undefined
  if (!Array.isArray(value)) {
    ctx.errors.push(issue(`${path}.${key}`, 'invalid_type', `字段 "${path}.${key}" 必须是数组`))
    return undefined
  }
  if (value.length > CAPABILITY_APP_LIMITS.maxRows) {
    ctx.errors.push(
      issue(
        `${path}.${key}`,
        'too_many',
        `字段 "${path}.${key}" 超过 ${CAPABILITY_APP_LIMITS.maxRows} 行上限`,
      ),
    )
  }
  return value
}

function checkForbiddenKeys(raw: Record<string, unknown>, path: string, ctx: BlockContext): void {
  for (const key of Object.keys(raw)) {
    if (FORBIDDEN_SET.has(key)) {
      ctx.errors.push(
        issue(
          `${path}.${key}`,
          'executable_field_forbidden',
          `字段 "${path}.${key}" 是可执行字段,应用定义只允许声明式内容`,
        ),
      )
    }
  }
}

const ALLOWED_KEYS: Record<CapabilityAppBlockKind, readonly string[]> = {
  heading: ['kind', 'id', 'from', 'valueKey', 'text', 'level'],
  text: ['kind', 'id', 'from', 'valueKey', 'text'],
  callout: ['kind', 'id', 'from', 'valueKey', 'text', 'title', 'tone'],
  badge: ['kind', 'id', 'from', 'valueKey', 'text', 'tone'],
  divider: ['kind', 'id', 'from', 'valueKey'],
  keyValue: ['kind', 'id', 'from', 'valueKey', 'items'],
  stat: ['kind', 'id', 'from', 'valueKey', 'items'],
  progress: ['kind', 'id', 'from', 'valueKey', 'label', 'value', 'max'],
  list: ['kind', 'id', 'from', 'valueKey', 'labelKey', 'items', 'ordered'],
  table: ['kind', 'id', 'from', 'valueKey', 'columns', 'rows'],
  code: ['kind', 'id', 'from', 'valueKey', 'code', 'language'],
  image: ['kind', 'id', 'from', 'valueKey', 'src', 'alt', 'caption'],
  button: ['kind', 'id', 'from', 'valueKey', 'label', 'variant', 'action'],
  chart: ['kind', 'id', 'from', 'valueKey', 'chartType', 'items', 'title'],
  tabs: ['kind', 'id', 'from', 'valueKey', 'tabs'],
  columns: ['kind', 'id', 'from', 'valueKey', 'columns'],
  form: ['kind', 'id', 'from', 'valueKey', 'fields', 'submitLabel', 'action'],
}

function validateAction(
  raw: unknown,
  path: string,
  ctx: BlockContext,
): CapabilityAppAction | undefined {
  if (!isRecord(raw)) {
    ctx.errors.push(issue(path, 'invalid_action', `"${path}" 必须是动作对象`))
    return undefined
  }
  const type = raw['type']
  if (typeof type !== 'string' || !ACTION_TYPES.has(type)) {
    ctx.errors.push(
      issue(path, 'invalid_action', `"${path}.type" 必须是 ${[...ACTION_TYPES].join('/')} 之一`),
    )
    return undefined
  }
  checkForbiddenKeys(raw, path, ctx)
  switch (type) {
    case 'navigate': {
      const target = readString(raw, 'path', path, ctx, true)
      if (target !== undefined && (!target.startsWith('/') || target.startsWith('//'))) {
        ctx.errors.push(
          issue(`${path}.path`, 'invalid_path', `"${path}.path" 必须是站内绝对路径(/ 开头)`),
        )
        return undefined
      }
      return { type: 'navigate', path: target ?? '/' }
    }
    case 'copy': {
      const text = readString(raw, 'text', path, ctx, true)
      if (text === undefined) return undefined
      return { type: 'copy', text }
    }
    case 'agent': {
      const prompt = readString(raw, 'prompt', path, ctx, true)
      if (prompt === undefined) return undefined
      return { type: 'agent', prompt }
    }
    case 'submit': {
      const prompt = readString(raw, 'prompt', path, ctx, false)
      return prompt === undefined ? { type: 'submit' } : { type: 'submit', prompt }
    }
    case 'tool': {
      const allowed = new Set(['type', 'call', 'args', 'into'])
      for (const key of Object.keys(raw)) {
        if (!allowed.has(key) && !FORBIDDEN_SET.has(key)) {
          ctx.errors.push(
            issue(
              `${path}.${key}`,
              'invalid_action',
              `字段 "${path}.${key}" 不在 tool 动作允许键内`,
            ),
          )
        }
      }
      const call = readCallName(raw, path, ctx)
      if (!call) return undefined
      const args = validateCallArgs(raw['args'], `${path}.args`, ctx, call)
      const into = readString(raw, 'into', path, ctx, false)
      if (into !== undefined && !CAPABILITY_APP_BINDING_KEY_RE.test(into)) {
        ctx.errors.push(
          issue(
            `${path}.into`,
            'invalid_action',
            `"${path}.into" 必须是绑定键(${CAPABILITY_APP_BINDING_KEY_RE.source})`,
          ),
        )
        return undefined
      }
      return {
        type: 'tool',
        call,
        ...(args === undefined ? {} : { args }),
        ...(into === undefined ? {} : { into }),
      }
    }
    default:
      return { type: 'refresh' }
  }
}

function validateField(
  raw: unknown,
  path: string,
  ctx: BlockContext,
): CapabilityAppField | undefined {
  if (!isRecord(raw)) {
    ctx.errors.push(issue(path, 'invalid_type', `"${path}" 必须是对象`))
    return undefined
  }
  checkForbiddenKeys(raw, path, ctx)
  const kind = raw['kind']
  if (kind !== 'input' && kind !== 'textarea' && kind !== 'select' && kind !== 'toggle') {
    ctx.errors.push(
      issue(
        `${path}.kind`,
        'invalid_type',
        `"${path}.kind" 必须是 input/textarea/select/toggle 之一`,
      ),
    )
    return undefined
  }
  const name = readString(raw, 'name', path, ctx, true)
  const label = readString(raw, 'label', path, ctx, true)
  const placeholder = readString(raw, 'placeholder', path, ctx, false)
  const defaultValue = readString(raw, 'defaultValue', path, ctx, false)
  if (name === undefined || label === undefined) return undefined
  const base = {
    name,
    label,
    ...(placeholder === undefined ? {} : { placeholder }),
    ...(defaultValue === undefined ? {} : { defaultValue }),
    ...(raw['required'] === true ? { required: true } : {}),
  }
  if (kind === 'select') {
    const optionsRaw = readArray(raw, 'options', path, ctx)
    if (!optionsRaw || optionsRaw.length === 0) {
      ctx.errors.push(issue(`${path}.options`, 'missing_field', `"${path}.options" 不能为空`))
      return undefined
    }
    const options: Array<{ label: string; value: string }> = []
    optionsRaw.forEach((item, index) => {
      if (!isRecord(item)) {
        ctx.errors.push(
          issue(
            `${path}.options[${index}]`,
            'invalid_type',
            `"${path}.options[${index}]" 必须是对象`,
          ),
        )
        return
      }
      const optionLabel = readString(item, 'label', `${path}.options[${index}]`, ctx, true)
      const optionValue = readString(item, 'value', `${path}.options[${index}]`, ctx, true)
      if (optionLabel !== undefined && optionValue !== undefined) {
        options.push({ label: optionLabel, value: optionValue })
      }
    })
    return { kind, ...base, options }
  }
  if (kind === 'toggle') {
    return { kind, ...base, ...(raw['defaultChecked'] === true ? { defaultChecked: true } : {}) }
  }
  return { kind, ...base }
}

function validateBlock(
  raw: unknown,
  path: string,
  ctx: BlockContext,
  depth: number,
): CapabilityAppBlock | undefined {
  if (!isRecord(raw)) {
    ctx.errors.push(issue(path, 'invalid_type', `"${path}" 必须是对象`))
    return undefined
  }
  if (depth > CAPABILITY_APP_LIMITS.maxDepth) {
    ctx.errors.push(issue(path, 'too_deep', `"${path}" 超过嵌套深度上限`))
    return undefined
  }
  ctx.blockCount.value += 1
  if (ctx.blockCount.value > CAPABILITY_APP_LIMITS.maxBlocks) {
    if (ctx.blockCount.value === CAPABILITY_APP_LIMITS.maxBlocks + 1) {
      ctx.errors.push(
        issue(path, 'too_many', `应用块总数超过 ${CAPABILITY_APP_LIMITS.maxBlocks} 上限`),
      )
    }
    return undefined
  }

  checkForbiddenKeys(raw, path, ctx)
  const kind = raw['kind']
  if (typeof kind !== 'string' || !BLOCK_KIND_SET.has(kind)) {
    ctx.errors.push(
      issue(
        `${path}.kind`,
        'invalid_block_kind',
        `"${path}.kind" 必须是 ${CAPABILITY_APP_BLOCK_KINDS.join('/')} 之一`,
      ),
    )
    return undefined
  }
  const blockKind = kind as CapabilityAppBlockKind
  const allowed = new Set(ALLOWED_KEYS[blockKind])
  for (const key of Object.keys(raw)) {
    if (!allowed.has(key) && !FORBIDDEN_SET.has(key)) {
      ctx.errors.push(
        issue(
          `${path}.${key}`,
          'unknown_field',
          `字段 "${path}.${key}" 不在 ${blockKind} 允许键内`,
        ),
      )
    }
  }

  // 数据绑定引用必须已声明
  const from = readString(raw, 'from', path, ctx, false)
  if (from !== undefined && !ctx.dataKeys.has(from)) {
    ctx.errors.push(
      issue(`${path}.from`, 'unknown_data_source', `"${path}.from" 引用了未声明的数据源 "${from}"`),
    )
  }
  const valueKey = readString(raw, 'valueKey', path, ctx, false)
  const id = readString(raw, 'id', path, ctx, false)

  switch (blockKind) {
    case 'heading': {
      const text = readString(raw, 'text', path, ctx, true)
      if (text === undefined) return undefined
      const level = raw['level']
      if (level !== undefined && level !== 1 && level !== 2 && level !== 3) {
        ctx.errors.push(issue(`${path}.level`, 'invalid_type', 'level 只能是 1/2/3'))
        return undefined
      }
      return {
        kind: 'heading',
        ...common(id, from, valueKey),
        text,
        ...(level === 1 || level === 2 || level === 3 ? { level } : {}),
      }
    }
    case 'text': {
      const text = readString(raw, 'text', path, ctx, true)
      if (text === undefined) return undefined
      return { kind: 'text', ...common(id, from, valueKey), text }
    }
    case 'callout': {
      const text = readString(raw, 'text', path, ctx, true)
      const title = readString(raw, 'title', path, ctx, false)
      if (text === undefined) return undefined
      const tone = readTone(raw, path, ctx)
      return {
        kind: 'callout',
        ...common(id, from, valueKey),
        text,
        ...(title === undefined ? {} : { title }),
        ...(tone === undefined ? {} : { tone }),
      }
    }
    case 'badge': {
      const text = readString(raw, 'text', path, ctx, true)
      if (text === undefined) return undefined
      const tone = readTone(raw, path, ctx)
      return {
        kind: 'badge',
        ...common(id, from, valueKey),
        text,
        ...(tone === undefined ? {} : { tone }),
      }
    }
    case 'divider':
      return { kind: 'divider', ...common(id, from, valueKey) }
    case 'keyValue':
    case 'stat': {
      const itemsRaw = readArray(raw, 'items', path, ctx)
      if (itemsRaw === undefined) {
        // 允许纯绑定取数
        if (from === undefined) {
          ctx.errors.push(
            issue(`${path}.items`, 'missing_field', `"${path}.items" 与 from 至少提供一个`),
          )
          return undefined
        }
      }
      const items: Array<{ label: string; value: string; hint?: string }> = []
      itemsRaw?.forEach((item, index) => {
        if (!isRecord(item)) {
          ctx.errors.push(
            issue(
              `${path}.items[${index}]`,
              'invalid_type',
              `"${path}.items[${index}]" 必须是对象`,
            ),
          )
          return
        }
        const label = readString(item, 'label', `${path}.items[${index}]`, ctx, true)
        const value = readString(item, 'value', `${path}.items[${index}]`, ctx, true)
        if (label === undefined || value === undefined) return
        const hint = readString(item, 'hint', `${path}.items[${index}]`, ctx, false)
        items.push(hint === undefined ? { label, value } : { label, value, hint })
      })
      return blockKind === 'stat'
        ? { kind: 'stat', ...common(id, from, valueKey), items }
        : { kind: 'keyValue', ...common(id, from, valueKey), items }
    }
    case 'progress': {
      const label = readString(raw, 'label', path, ctx, true)
      const value = raw['value']
      if (label === undefined) return undefined
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        ctx.errors.push(issue(`${path}.value`, 'invalid_type', `"${path}.value" 必须是数字`))
        return undefined
      }
      const max = raw['max']
      if (max !== undefined && (typeof max !== 'number' || !Number.isFinite(max) || max <= 0)) {
        ctx.errors.push(issue(`${path}.max`, 'number_out_of_range', `"${path}.max" 必须是正数`))
        return undefined
      }
      return {
        kind: 'progress',
        ...common(id, from, valueKey),
        label,
        value,
        ...(max === undefined ? {} : { max: max as number }),
      }
    }
    case 'list': {
      const itemsRaw = readArray(raw, 'items', path, ctx)
      const labelKey = readString(raw, 'labelKey', path, ctx, false)
      if (itemsRaw === undefined && from === undefined) {
        ctx.errors.push(
          issue(`${path}.items`, 'missing_field', `"${path}.items" 与 from 至少提供一个`),
        )
        return undefined
      }
      const items: string[] = []
      itemsRaw?.forEach((item, index) => {
        if (typeof item !== 'string') {
          ctx.errors.push(
            issue(
              `${path}.items[${index}]`,
              'invalid_type',
              `"${path}.items[${index}]" 必须是字符串`,
            ),
          )
          return
        }
        if (item.length > CAPABILITY_APP_LIMITS.maxStringChars) {
          ctx.errors.push(
            issue(`${path}.items[${index}]`, 'string_too_long', `"${path}.items[${index}]" 过长`),
          )
          return
        }
        items.push(item)
      })
      return {
        kind: 'list',
        ...common(id, from, valueKey),
        items,
        ...(raw['ordered'] === true ? { ordered: true } : {}),
        ...(labelKey === undefined ? {} : { labelKey }),
      }
    }
    case 'table': {
      const columnsRaw = readArray(raw, 'columns', path, ctx)
      if (!columnsRaw || columnsRaw.length === 0) {
        ctx.errors.push(issue(`${path}.columns`, 'missing_field', `"${path}.columns" 不能为空`))
        return undefined
      }
      const columns: Array<{ key: string; label: string }> = []
      columnsRaw.forEach((item, index) => {
        if (!isRecord(item)) {
          ctx.errors.push(
            issue(
              `${path}.columns[${index}]`,
              'invalid_type',
              `"${path}.columns[${index}]" 必须是对象`,
            ),
          )
          return
        }
        const key = readString(item, 'key', `${path}.columns[${index}]`, ctx, true)
        const label = readString(item, 'label', `${path}.columns[${index}]`, ctx, true)
        if (key !== undefined && label !== undefined) columns.push({ key, label })
      })
      const rowsRaw = readArray(raw, 'rows', path, ctx)
      const rows: Array<Record<string, string | number>> = []
      rowsRaw?.forEach((item, index) => {
        if (!isRecord(item)) {
          ctx.errors.push(
            issue(`${path}.rows[${index}]`, 'invalid_type', `"${path}.rows[${index}]" 必须是对象`),
          )
          return
        }
        const row: Record<string, string | number> = {}
        for (const [key, cell] of Object.entries(item)) {
          if (typeof cell === 'string' || typeof cell === 'number') row[key] = cell
          else {
            ctx.errors.push(
              issue(`${path}.rows[${index}].${key}`, 'invalid_type', `单元格只能是字符串或数字`),
            )
          }
        }
        rows.push(row)
      })
      return { kind: 'table', ...common(id, from, valueKey), columns, rows }
    }
    case 'code': {
      const code = readString(raw, 'code', path, ctx, true)
      if (code === undefined) return undefined
      const language = readString(raw, 'language', path, ctx, false)
      return {
        kind: 'code',
        ...common(id, from, valueKey),
        code,
        ...(language === undefined ? {} : { language }),
      }
    }
    case 'image': {
      const src = readString(raw, 'src', path, ctx, true)
      const alt = readString(raw, 'alt', path, ctx, true)
      if (src === undefined || alt === undefined) return undefined
      if (!/^(https:\/\/|\/)/.test(src)) {
        ctx.errors.push(
          issue(`${path}.src`, 'invalid_path', `"${path}.src" 只允许 https:// 或站内 / 路径`),
        )
        return undefined
      }
      const caption = readString(raw, 'caption', path, ctx, false)
      return {
        kind: 'image',
        ...common(id, from, valueKey),
        src,
        alt,
        ...(caption === undefined ? {} : { caption }),
      }
    }
    case 'button': {
      const label = readString(raw, 'label', path, ctx, true)
      if (label === undefined) return undefined
      const action = validateAction(raw['action'], `${path}.action`, ctx)
      if (!action) return undefined
      const variant = raw['variant']
      if (
        variant !== undefined &&
        variant !== 'primary' &&
        variant !== 'secondary' &&
        variant !== 'ghost'
      ) {
        ctx.errors.push(
          issue(`${path}.variant`, 'invalid_type', 'variant 只能是 primary/secondary/ghost'),
        )
        return undefined
      }
      return {
        kind: 'button',
        ...common(id, from, valueKey),
        label,
        action,
        ...(variant === undefined ? {} : { variant }),
      }
    }
    case 'chart': {
      const chartType = raw['chartType']
      if (typeof chartType !== 'string' || !CHART_TYPE_SET.has(chartType)) {
        ctx.errors.push(issue(`${path}.chartType`, 'invalid_type', 'chartType 只能是 bar/line/pie'))
        return undefined
      }
      const itemsRaw = readArray(raw, 'items', path, ctx)
      if (itemsRaw === undefined && from === undefined) {
        ctx.errors.push(
          issue(`${path}.items`, 'missing_field', `"${path}.items" 与 from 至少提供一个`),
        )
        return undefined
      }
      const items: Array<{ label: string; value: number }> = []
      itemsRaw?.forEach((item, index) => {
        if (!isRecord(item)) {
          ctx.errors.push(
            issue(
              `${path}.items[${index}]`,
              'invalid_type',
              `"${path}.items[${index}]" 必须是对象`,
            ),
          )
          return
        }
        const label = readString(item, 'label', `${path}.items[${index}]`, ctx, true)
        const value = item['value']
        if (label === undefined) return
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          ctx.errors.push(
            issue(`${path}.items[${index}].value`, 'invalid_type', '图表数值必须是数字'),
          )
          return
        }
        items.push({ label, value })
      })
      const title = readString(raw, 'title', path, ctx, false)
      return {
        kind: 'chart',
        ...common(id, from, valueKey),
        chartType: chartType as 'bar' | 'line' | 'pie',
        items,
        ...(title === undefined ? {} : { title }),
      }
    }
    case 'tabs': {
      const tabsRaw = readArray(raw, 'tabs', path, ctx)
      if (!tabsRaw || tabsRaw.length === 0) {
        ctx.errors.push(issue(`${path}.tabs`, 'missing_field', `"${path}.tabs" 不能为空`))
        return undefined
      }
      if (tabsRaw.length > CAPABILITY_APP_LIMITS.maxChildren) {
        ctx.errors.push(
          issue(
            `${path}.tabs`,
            'too_many',
            `"${path}.tabs" 超过 ${CAPABILITY_APP_LIMITS.maxChildren} 上限`,
          ),
        )
        return undefined
      }
      const tabs: Array<{ label: string; blocks: CapabilityAppBlock[] }> = []
      tabsRaw.forEach((item, index) => {
        const tabPath = `${path}.tabs[${index}]`
        if (!isRecord(item)) {
          ctx.errors.push(issue(tabPath, 'invalid_type', `"${tabPath}" 必须是对象`))
          return
        }
        const label = readString(item, 'label', tabPath, ctx, true)
        const blocks = validateBlocks(item['blocks'], `${tabPath}.blocks`, ctx, depth + 1)
        if (label !== undefined) tabs.push({ label, blocks })
      })
      return { kind: 'tabs', ...common(id, from, valueKey), tabs }
    }
    case 'columns': {
      const columnsRaw = readArray(raw, 'columns', path, ctx)
      if (!columnsRaw || columnsRaw.length === 0) {
        ctx.errors.push(issue(`${path}.columns`, 'missing_field', `"${path}.columns" 不能为空`))
        return undefined
      }
      if (columnsRaw.length > CAPABILITY_APP_LIMITS.maxChildren) {
        ctx.errors.push(
          issue(
            `${path}.columns`,
            'too_many',
            `"${path}.columns" 超过 ${CAPABILITY_APP_LIMITS.maxChildren} 上限`,
          ),
        )
        return undefined
      }
      const columns: Array<{ label?: string; blocks: CapabilityAppBlock[] }> = []
      columnsRaw.forEach((item, index) => {
        const colPath = `${path}.columns[${index}]`
        if (!isRecord(item)) {
          ctx.errors.push(issue(colPath, 'invalid_type', `"${colPath}" 必须是对象`))
          return
        }
        const label = readString(item, 'label', colPath, ctx, false)
        const blocks = validateBlocks(item['blocks'], `${colPath}.blocks`, ctx, depth + 1)
        columns.push(label === undefined ? { blocks } : { label, blocks })
      })
      return { kind: 'columns', ...common(id, from, valueKey), columns }
    }
    case 'form': {
      const fieldsRaw = readArray(raw, 'fields', path, ctx)
      if (!fieldsRaw || fieldsRaw.length === 0) {
        ctx.errors.push(issue(`${path}.fields`, 'missing_field', `"${path}.fields" 不能为空`))
        return undefined
      }
      const fields: CapabilityAppField[] = []
      const names = new Set<string>()
      fieldsRaw.forEach((item, index) => {
        const field = validateField(item, `${path}.fields[${index}]`, ctx)
        if (!field) return
        if (names.has(field.name)) {
          ctx.errors.push(
            issue(
              `${path}.fields[${index}].name`,
              'invalid_type',
              `表单字段名 "${field.name}" 重复`,
            ),
          )
          return
        }
        names.add(field.name)
        fields.push(field)
      })
      const submitLabel = readString(raw, 'submitLabel', path, ctx, true)
      if (submitLabel === undefined) return undefined
      const action = validateAction(raw['action'], `${path}.action`, ctx)
      if (!action) return undefined
      return { kind: 'form', ...common(id, from, valueKey), fields, submitLabel, action }
    }
    default:
      return undefined
  }
}

function common(
  id: string | undefined,
  from: string | undefined,
  valueKey: string | undefined,
): { id?: string; from?: string; valueKey?: string } {
  return {
    ...(id === undefined ? {} : { id }),
    ...(from === undefined ? {} : { from }),
    ...(valueKey === undefined ? {} : { valueKey }),
  }
}

function readTone(
  raw: Record<string, unknown>,
  path: string,
  ctx: BlockContext,
): CapabilityAppTone | undefined {
  const tone = raw['tone']
  if (tone === undefined) return undefined
  if (typeof tone !== 'string' || !TONE_SET.has(tone)) {
    ctx.errors.push(
      issue(`${path}.tone`, 'invalid_type', `"${path}.tone" 只能是 info/success/warn/error`),
    )
    return undefined
  }
  return tone as CapabilityAppTone
}

/**
 * 校验白名单调用的入参。
 *
 * 强转与范围判定交给 `parseCapabilityAppCallArgs`(**唯一实现**,服务端运行时复用同一份),
 * 这里只负责把错误映射成带 path 的 issue,让存盘期就能逐字段定位。
 * 额外的本地检查:可执行键在 args 内同样禁止。
 */
function validateCallArgs(
  raw: unknown,
  path: string,
  ctx: BlockContext,
  call: CapabilityAppCallName,
): CapabilityAppCallArgs | undefined {
  if (isRecord(raw)) checkForbiddenKeys(raw, path, ctx)
  const parsed = parseCapabilityAppCallArgs(call, raw)
  if (!parsed.ok) {
    for (const item of parsed.errors) {
      const target = item.key === null ? path : `${path}.${item.key}`
      ctx.errors.push(issue(target, 'invalid_call_args', `"${target}" ${item.message}`))
    }
    return undefined
  }
  return Object.keys(parsed.value).length > 0 ? parsed.value : undefined
}

/** 读取并校验 `call` 字段;未知名字返回 undefined 并点名。 */
function readCallName(
  raw: Record<string, unknown>,
  path: string,
  ctx: BlockContext,
): CapabilityAppCallName | undefined {
  const value = raw['call']
  if (value === undefined) return undefined
  if (typeof value !== 'string' || !CAPABILITY_APP_CALL_NAME_SET.has(value)) {
    ctx.errors.push(
      issue(
        `${path}.call`,
        'unknown_call',
        `"${path}.call" 必须是白名单能力:${CAPABILITY_APP_CALL_NAMES.join('/')}`,
      ),
    )
    return undefined
  }
  return value as CapabilityAppCallName
}

function validateBlocks(
  raw: unknown,
  path: string,
  ctx: BlockContext,
  depth: number,
): CapabilityAppBlock[] {
  if (!Array.isArray(raw)) {
    ctx.errors.push(issue(path, 'invalid_type', `"${path}" 必须是数组`))
    return []
  }
  const blocks: CapabilityAppBlock[] = []
  raw.forEach((item, index) => {
    const block = validateBlock(item, `${path}[${index}]`, ctx, depth)
    if (block) blocks.push(block)
  })
  return blocks
}

function validateDataSource(
  raw: unknown,
  path: string,
  ctx: BlockContext,
): CapabilityAppDataSource | undefined {
  if (!isRecord(raw)) {
    ctx.errors.push(issue(path, 'invalid_type', `"${path}" 必须是对象`))
    return undefined
  }
  checkForbiddenKeys(raw, path, ctx)
  const DATA_SOURCE_KEYS = new Set(['path', 'pick', 'call', 'args'])
  for (const key of Object.keys(raw)) {
    if (!DATA_SOURCE_KEYS.has(key) && !FORBIDDEN_SET.has(key)) {
      ctx.errors.push(
        issue(`${path}.${key}`, 'unknown_field', `字段 "${path}.${key}" 不在数据源允许键内`),
      )
    }
  }

  const call = readCallName(raw, path, ctx)
  const target = readString(raw, 'path', path, ctx, false)
  if (call !== undefined && target !== undefined) {
    ctx.errors.push(
      issue(path, 'conflicting_data_source', `"${path}" 的 path 与 call 互斥,只能二选一`),
    )
    return undefined
  }
  if (call === undefined && target === undefined) {
    ctx.errors.push(issue(path, 'missing_field', `"${path}" 必须提供 path 或 call`))
    return undefined
  }

  const pick = readString(raw, 'pick', path, ctx, false)
  if (call !== undefined) {
    if (pick !== undefined) {
      ctx.errors.push(
        issue(`${path}.pick`, 'invalid_call_args', `"${path}.pick" 只对 path 数据源有效`),
      )
      return undefined
    }
    const args = validateCallArgs(raw['args'], `${path}.args`, ctx, call)
    return args === undefined ? { call } : { call, args }
  }

  if (!target!.startsWith('/api/') || target!.startsWith('//') || target!.includes('..')) {
    ctx.errors.push(
      issue(`${path}.path`, 'invalid_path', `"${path}.path" 必须是同源 /api/ 路径,不得包含 ".."`),
    )
    return undefined
  }
  if (raw['args'] !== undefined) {
    ctx.errors.push(
      issue(`${path}.args`, 'invalid_call_args', `"${path}.args" 只对 call 数据源有效`),
    )
    return undefined
  }
  return pick === undefined ? { path: target } : { path: target, pick }
}

/**
 * 预扫 `into` 目标:动作把结果写回绑定后,任何 `from: <into>` 的块都要能引用它,
 * 而块校验发生在动作解析之前 —— 因此先扫一遍登记,避免"声明了结果块却报未声明数据源"。
 */
function collectToolBindingKeys(value: unknown, acc: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectToolBindingKeys(item, acc)
    return
  }
  if (!isRecord(value)) return
  if (value['type'] === 'tool') {
    const into = value['into']
    if (typeof into === 'string' && CAPABILITY_APP_BINDING_KEY_RE.test(into)) acc.add(into)
  }
  for (const child of Object.values(value)) collectToolBindingKeys(child, acc)
}

/**
 * 校验入口(纯函数)。
 *
 * @param raw 未信任的输入(来自模型 / 用户粘贴 / 网络)
 * @param options.expectedId 路由参数里的 id;给出时必须与 raw.id 一致(防「改体改 id」)
 */
export function validateCapabilityApp(
  raw: unknown,
  options: { expectedId?: string } = {},
): CapabilityAppValidation {
  if (!isRecord(raw)) {
    return { ok: false, errors: [issue('$', 'invalid_type', '应用定义必须是 JSON 对象')] }
  }

  const errors: CapabilityAppIssue[] = []
  errors.push(...findCapabilityAppExecutableFields(raw))

  // 顶层允许键:落库记录会多出 createdAt/updatedAt,其余未知键一律点名(防"夹带配置")。
  const TOP_LEVEL_KEYS = new Set([
    'id',
    'title',
    'description',
    'icon',
    'slot',
    'version',
    'source',
    'spec',
    'createdAt',
    'updatedAt',
  ])
  for (const key of Object.keys(raw)) {
    if (!TOP_LEVEL_KEYS.has(key) && !FORBIDDEN_SET.has(key)) {
      errors.push(issue(key, 'unknown_field', `未知字段 "${key}"`))
    }
  }

  const id = raw['id']
  if (typeof id !== 'string' || !CAPABILITY_APP_ID_RE.test(id)) {
    errors.push(
      issue(
        'id',
        'invalid_id',
        `字段 "id" 必须是 ${CAPABILITY_APP_ID_RE.source}(小写字母开头,2-64 位)`,
      ),
    )
  } else if (options.expectedId !== undefined && id !== options.expectedId) {
    errors.push(issue('id', 'invalid_id', `字段 "id" 与路径参数不一致`))
  }

  const title = typeof raw['title'] === 'string' ? raw['title'].trim() : ''
  if (!title) errors.push(issue('title', 'missing_field', '缺少必填字段 "title"'))
  else if (title.length > 120) {
    errors.push(issue('title', 'string_too_long', '"title" 超过 120 字符上限'))
  }

  const description = raw['description']
  if (description !== undefined && typeof description !== 'string') {
    errors.push(issue('description', 'invalid_type', '"description" 必须是字符串'))
  } else if (typeof description === 'string' && description.length > 500) {
    errors.push(issue('description', 'string_too_long', '"description" 超过 500 字符上限'))
  }

  const icon = raw['icon']
  if (icon !== undefined && typeof icon !== 'string') {
    errors.push(issue('icon', 'invalid_type', '"icon" 必须是字符串'))
  } else if (typeof icon === 'string' && !/^[A-Za-z][A-Za-z0-9-]{0,39}$/.test(icon)) {
    errors.push(issue('icon', 'invalid_type', '"icon" 必须是内置图标名(字母开头,可含连字符)'))
  }

  const slot = raw['slot']
  if (typeof slot !== 'string' || !SLOT_SET.has(slot)) {
    errors.push(
      issue('slot', 'invalid_slot', `字段 "slot" 必须是 ${CAPABILITY_APP_SLOTS.join('/')} 之一`),
    )
  }

  const version = typeof raw['version'] === 'string' ? raw['version'] : '1.0.0'
  if (!CAPABILITY_APP_VERSION_RE.test(version)) {
    errors.push(issue('version', 'invalid_version', `字段 "version" 必须是语义化版本(x.y.z)`))
  }

  const sourceRaw = raw['source']
  const source: 'ai' | 'user' = sourceRaw === 'ai' ? 'ai' : 'user'
  if (sourceRaw !== undefined && sourceRaw !== 'ai' && sourceRaw !== 'user') {
    errors.push(issue('source', 'invalid_type', '"source" 只能是 ai/user'))
  }

  const specRaw = raw['spec']
  const ctx: BlockContext = { errors, dataKeys: new Set<string>(), blockCount: { value: 0 } }
  let spec: CapabilityAppSpec | undefined

  if (!isRecord(specRaw)) {
    errors.push(issue('spec', 'invalid_type', '缺少必填对象 "spec"'))
  } else {
    const dataRaw = specRaw['data']
    const data: Record<string, CapabilityAppDataSource> = {}
    if (dataRaw !== undefined) {
      if (!isRecord(dataRaw)) {
        errors.push(issue('spec.data', 'invalid_type', '"spec.data" 必须是对象'))
      } else {
        const entries = Object.entries(dataRaw)
        if (entries.length > CAPABILITY_APP_LIMITS.maxDataSources) {
          errors.push(
            issue(
              'spec.data',
              'too_many',
              `"spec.data" 超过 ${CAPABILITY_APP_LIMITS.maxDataSources} 条上限`,
            ),
          )
        }
        for (const [key, value] of entries) {
          if (!CAPABILITY_APP_BINDING_KEY_RE.test(key)) {
            errors.push(
              issue(
                `spec.data.${key}`,
                'invalid_type',
                `数据源键 "${key}" 必须字母开头,只含字母数字 _ -`,
              ),
            )
            continue
          }
          const parsed = validateDataSource(value, `spec.data.${key}`, ctx)
          if (parsed) {
            data[key] = parsed
            ctx.dataKeys.add(key)
          }
        }
      }
    }

    // 动作 `into` 写回的绑定键先登记,块校验才能合法引用
    collectToolBindingKeys(specRaw['blocks'], ctx.dataKeys)

    const blocks = validateBlocks(specRaw['blocks'], 'spec.blocks', ctx, 0)
    const specDescription = specRaw['description']
    if (specDescription !== undefined && typeof specDescription !== 'string') {
      errors.push(issue('spec.description', 'invalid_type', '"spec.description" 必须是字符串'))
    }
    spec = {
      ...(typeof specDescription === 'string' ? { description: specDescription } : {}),
      ...(Object.keys(data).length > 0 ? { data } : {}),
      blocks,
    }
  }

  if (errors.length > 0) return { ok: false, errors }

  const draft: CapabilityAppDraft = {
    id: id as string,
    title,
    ...(typeof description === 'string' ? { description } : {}),
    ...(typeof icon === 'string' ? { icon } : {}),
    slot: slot as CapabilityAppSlot,
    version,
    source,
    spec: spec as CapabilityAppSpec,
  }

  const bytes = new TextEncoder().encode(JSON.stringify(draft)).byteLength
  if (bytes > CAPABILITY_APP_LIMITS.maxBytes) {
    return {
      ok: false,
      errors: [
        issue(
          '$',
          'too_large',
          `应用定义 ${bytes} 字节,超过 ${CAPABILITY_APP_LIMITS.maxBytes} 字节上限`,
        ),
      ],
    }
  }

  return { ok: true, value: draft, bytes }
}

/** 解析落库记录(user_preferences.value),形状不符返回 null(不做宽松兜底)。 */
export function parseCapabilityAppRecord(value: string | null): CapabilityAppRecord | null {
  if (!value) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    return null
  }
  if (!isRecord(parsed)) return null
  if (typeof parsed['createdAt'] !== 'string' || typeof parsed['updatedAt'] !== 'string')
    return null
  const validation = validateCapabilityApp(parsed)
  if (!validation.ok) return null
  return {
    ...validation.value,
    createdAt: parsed['createdAt'] as string,
    updatedAt: parsed['updatedAt'] as string,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
