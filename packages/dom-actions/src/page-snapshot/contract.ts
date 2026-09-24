// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 页面语义快照与可复用元素句柄 —— 跨端契约（纯类型 + 纯常量 + 纯函数，零 DOM 依赖）。
 *
 * 为什么单独成文件：这一层同时被两类宿主取用 ——
 * ① 页内执行体（扩展 content script 直接 import；CLI 经 CDP 把安装函数注入页面）；
 * ② 页外宿主（Node / service worker 侧的预算核算与序列化）。
 * 两侧必须对同一套句柄格式、错误码、预算字段、字段顺序达成一致，否则
 * "页内产出的行"与"宿主截断的行"会各漂移一份。
 */

/** 页内 API 挂载的全局键（带版本号：残留旧脚本时按版本判失效）。 */
export const PAGE_API_GLOBAL_KEY = '__ihuiPageApiV1'

/** 句柄前缀：让模型与日志一眼区分"句柄"与"CSS 选择器"。 */
export const PAGE_HANDLE_PREFIX = 'el'

/** 快照结构版本，宿主据此拒绝解读旧版页内脚本产出的行。 */
export const PAGE_SNAPSHOT_SCHEMA = 1

/** scope 长度：导航后凭它把整批旧句柄判失效，而不是撞上一个同号新元素。 */
export const PAGE_HANDLE_SCOPE_LENGTH = 8

// ===== 动作面 =====

/**
 * 面向页面的动作动词。与既有 `BrowserControlActionType`（选择器形态）并列而非改写：
 * 旧动词每轮按 CSS 重新解析，页面改版或同名元素并存即错位；新动词只认页内活引用。
 */
export type PageActionType =
  | 'page_snapshot'
  | 'page_click'
  | 'page_type'
  | 'page_select'
  | 'page_hover'
  | 'page_press_key'
  | 'page_pick_at_point'

export const PAGE_ACTIONS: readonly PageActionType[] = [
  'page_snapshot',
  'page_click',
  'page_type',
  'page_select',
  'page_hover',
  'page_press_key',
  'page_pick_at_point',
]

/** 只读动词：结构上不触碰页面，因此副作用恒为 none。 */
export const PAGE_READONLY_ACTIONS: readonly PageActionType[] = [
  'page_snapshot',
  'page_pick_at_point',
]

export function isPageAction(action: string): action is PageActionType {
  return (PAGE_ACTIONS as readonly string[]).includes(action)
}

// ===== 错误码 =====

/**
 * 结构化错误码：句柄取不到**必须**可判读。
 * 为什么不复用既有的 SELECTOR_NOT_FOUND：那条码把"选择器没匹配"与"活引用失效"混成
 * 一码，模型无从知道该重拍快照、该换坐标、还是该放弃。
 */
export type PageActionErrorCode =
  /** 句柄字符串本身不合法（前缀/段数/进制任一不符） */
  | 'HANDLE_MALFORMED'
  /** 句柄 scope 与当前页内安装不符 ⇒ 页面已换，旧句柄整批改判失效 */
  | 'HANDLE_SCOPE_MISMATCH'
  /** scope 对得上但元素已被回收或脱离文档 */
  | 'HANDLE_STALE'
  /** 元素在文档内但拿不到有效矩形（折叠容器内 / 零尺寸） */
  | 'HANDLE_NOT_RENDERED'
  /** 目标存在但不是可输入控件 */
  | 'TARGET_NOT_EDITABLE'
  /** 目标存在但不是 <select> */
  | 'TARGET_NOT_SELECTABLE'
  /** 页内 API 未安装或版本不符（宿主须先安装再重试） */
  | 'PAGE_API_UNAVAILABLE'
  /** 坐标落在视口外 */
  | 'COORD_OUT_OF_BOUNDS'
  /** 该坐标没有可交互元素 */
  | 'NO_ELEMENT_AT_POINT'
  /** 入参缺失/类型不符（尚未派发任何输入事件，sideEffect 恒为 none） */
  | 'PARAM_INVALID'
  /** 动词超时 */
  | 'TIMEOUT'
  /** 其余执行期异常 */
  | 'EXECUTION_FAILED'

// ===== 副作用确定性 =====

/**
 * `none` = 该次调用**结构上不可能**改动页面（未派发任何输入事件即返回）；
 * `uncertain` = 已派发过输入事件，之后发生什么不受我方观测保证（可能已提交表单、
 * 可能已发出网络请求），因此**不得盲目重试**。
 *
 * 刻意不设"确定无副作用的成功"这一档：点击之后页面是否发请求，页内脚本看不到；
 * 把未知说成已知，正是模型重复提交同一表单的成因。
 */
export type SideEffectCertainty = 'none' | 'uncertain'

// ===== 行结构 =====

/** 一条可交互元素行。除 `handle`/`role` 外字段均可选（缺字段是正常态，不是错误）。 */
export interface PageElementRow {
  /** 活引用句柄 */
  handle: string
  /** 归一化 role（button/link/textbox/checkbox/…） */
  role: string
  /** 可访问名：脱离上下文须自证成立 */
  name?: string
  /** 元素可见文本（与 name 同源时省略，避免整表重复） */
  text?: string
  /** 控件当前值 */
  value?: string
  disabled?: boolean
  checked?: boolean
  /** 距 body 的层级，供模型理解分组 */
  depth?: number
  /** 父行句柄（父未进表时省略） */
  parent?: string
  /** iframe 路径，如 `0/2`；主文档省略 */
  frame?: string
  /** 是否落在当前视口内 */
  inViewport?: boolean
  /** 有界属性集：白名单键 + 每值/每行字符上限 */
  attrs?: Record<string, string>
  /** [x, y, w, h] 顶层视口坐标，仅作兜底/核验 */
  rect?: [number, number, number, number]
}

/** 正文语义块（与句柄行分预算，见 PageSnapshotBudget）。 */
export interface PageBodyBlock {
  text: string
  /** 该块最近的前置标题，让模型知道"这段在讲什么" */
  heading?: string
}

export interface PageSnapshotCounts {
  /** 页内实际扫到的可交互元素数（>= rowsEmitted，差额即"还有多少没交出来"） */
  interactiveFound: number
  rowsEmitted: number
  /** 正文截断前总字符数 */
  bodyCharsFound: number
  bodyCharsEmitted: number
  /** 跨不过去的跨域 iframe 个数（只登记，不解析） */
  crossOriginFrames: number
}

/** 页内 `snapshot()` 的原始返回。 */
export interface PageSnapshotRaw {
  schema: number
  scope: string
  title: string
  url: string
  rows: PageElementRow[]
  body: PageBodyBlock[]
  counts: PageSnapshotCounts
}

/** 宿主按预算装配后的快照（结构化形态，给付程序用；文本形态见 renderSnapshot）。 */
export interface PageSnapshotResult {
  schema: number
  scope: string
  title: string
  url: string
  rows: PageElementRow[]
  body: PageBodyBlock[]
  counts: PageSnapshotCounts
  /** 截断/失效说明，逐条到人可读 */
  notices: string[]
}

/** 页内动作的统一返回。 */
export interface PageActionRaw {
  ok: boolean
  errorCode?: PageActionErrorCode
  error?: string
  /** 是否已把输入事件派发出去（决定 sideEffect 归类） */
  dispatched: boolean
  detail?: Record<string, unknown>
}

/** 宿主动词返回：恒带副作用确定性。 */
export interface PageActionResult {
  ok: boolean
  errorCode?: PageActionErrorCode
  error?: string
  dispatched: boolean
  sideEffect: SideEffectCertainty
  sideEffectReason: string
  data?: Record<string, unknown>
  /** 面向模型的下一步建议（例如"重拍快照"），仅在失败时给 */
  hint?: string
}

// ===== 预算 =====

/**
 * 正文与句柄**分预算**。这是本契约最要紧的一条约束：
 * 一篇长文可以轻易吃掉上万字符，若两者共用配额，模型拿到的快照里一个可动作元素都不会有。
 */
export interface PageSnapshotBudget {
  /** 句柄配额：最多交出行数 */
  maxRows: number
  /** 单行序列化字符上限（超限按丢弃阶梯丢字段，绝不丢 handle/role/name） */
  maxRowChars: number
  /** 正文语义字符预算（独立于 maxRows） */
  bodyChars: number
  /** 正文块数上限 */
  maxBodyBlocks: number
  /** 每行有界属性集的字符上限 */
  attrsChars: number
  /** 可访问名/文本/值单字段字符上限 */
  labelChars: number
}

export const DEFAULT_PAGE_SNAPSHOT_BUDGET: PageSnapshotBudget = {
  maxRows: 80,
  maxRowChars: 200,
  bodyChars: 4000,
  maxBodyBlocks: 40,
  attrsChars: 90,
  labelChars: 90,
}

/** 硬上限：防止调用方传一个天文数字把上下文打满。 */
export const PAGE_SNAPSHOT_BUDGET_CAPS: PageSnapshotBudget = {
  maxRows: 300,
  maxRowChars: 600,
  bodyChars: 20000,
  maxBodyBlocks: 200,
  attrsChars: 300,
  labelChars: 300,
}

const BUDGET_FIELDS: (keyof PageSnapshotBudget)[] = [
  'maxRows',
  'maxRowChars',
  'bodyChars',
  'maxBodyBlocks',
  'attrsChars',
  'labelChars',
]

/**
 * 钳制调用方给的预算：非数字/越界一律取默认或上限，**不抛错**。
 * 为什么宁可静默钳制也不报错：预算来自模型传参，报错等于把一个可用请求打死。
 */
export function clampPageSnapshotBudget(
  input?: Partial<Record<keyof PageSnapshotBudget, unknown>> | null,
): PageSnapshotBudget {
  const out: PageSnapshotBudget = { ...DEFAULT_PAGE_SNAPSHOT_BUDGET }
  if (!input) return out
  for (const field of BUDGET_FIELDS) {
    const raw = input[field]
    if (typeof raw !== 'number' || !Number.isFinite(raw)) continue
    const wanted = Math.floor(raw)
    if (wanted <= 0) continue
    out[field] = Math.min(wanted, PAGE_SNAPSHOT_BUDGET_CAPS[field])
  }
  return out
}

// ===== 字段顺序（截断语义的唯一依据） =====

/**
 * 序列化字段顺序 = 语义优先。整行超预算时从**队尾**开始丢，
 * 于是被截断的永远是定位细节，留下的是"这一行是什么、叫什么、能不能用、句柄是什么"。
 */
export const SNAPSHOT_ROW_FIELD_ORDER: readonly (keyof PageElementRow)[] = [
  'role',
  'name',
  'text',
  'value',
  'disabled',
  'checked',
  'handle',
  'depth',
  'parent',
  'frame',
  'inViewport',
  'attrs',
  'rect',
]

/**
 * 丢弃阶梯（自队尾起）。
 * `handle` 刻意排在保护侧：没有句柄的行对模型是纯噪声 —— 读得懂却动不了，
 * 而 rect/attrs/层级这些定位细节丢了仍可用 `page_pick_at_point` 找回。
 */
export const SNAPSHOT_ROW_DROP_ORDER: readonly (keyof PageElementRow)[] = [
  'rect',
  'attrs',
  'inViewport',
  'frame',
  'parent',
  'depth',
]

/** 永不丢弃的字段（自检与测试引用这一份，不得各自抄字面量）。 */
export const SNAPSHOT_ROW_PROTECTED_FIELDS: readonly (keyof PageElementRow)[] = [
  'role',
  'name',
  'text',
  'value',
  'disabled',
  'checked',
  'handle',
]

/**
 * 顶层（整份快照）丢弃阶梯：行表比正文值钱，所以正文先于行被丢。
 * 顺序：URL → 标题 → scope 回显 → 正文 → 行。
 */
export const SNAPSHOT_TOP_LEVEL_DROP_ORDER = ['url', 'title', 'scope', 'body'] as const

/**
 * 组装句柄字符串（页内与宿主共用这一份，避免两处拼格式漂移）。
 * 页内注入体无法 import 本函数（见 page-api.ts 的注入约束），因此它在页内按同一规则内联拼接，
 * 宿主则用 `parsePageHandle` 复验 —— 单向依赖，不会两头各写一套。
 */
export function formatPageHandle(scope: string, serial: number): string {
  return `${PAGE_HANDLE_PREFIX}:${scope}:${serial.toString(36)}`
}

export interface ParsedPageHandle {
  scope: string
  serial: number
}

/** 解析句柄；不合法返回 null，由调用方落到 HANDLE_MALFORMED。 */
export function parsePageHandle(handle: unknown): ParsedPageHandle | null {
  if (typeof handle !== 'string') return null
  const parts = handle.split(':')
  if (parts.length !== 3 || parts[0] !== PAGE_HANDLE_PREFIX) return null
  const scope = parts[1] ?? ''
  const serialText = parts[2] ?? ''
  if (scope.length !== PAGE_HANDLE_SCOPE_LENGTH) return null
  const serial = Number.parseInt(serialText, 36)
  if (!Number.isFinite(serial) || serial < 0) return null
  // 反向对齐：`00` 与 `0` 同值但不同串，读不回原串即视为伪造/截断产物
  if (serialText !== serial.toString(36)) return null
  return { scope, serial }
}

// ===== 有界属性集 =====

/**
 * 属性白名单：只交"能改变模型决策"的那几个。
 * class/style 是体积大户且几乎无语义价值，一律不进表。
 */
export const PAGE_ATTR_WHITELIST: readonly string[] = [
  'href',
  'src',
  'type',
  'name',
  'id',
  'placeholder',
  'alt',
  'aria-expanded',
  'aria-checked',
  'aria-current',
  'aria-disabled',
  'data-testid',
  'target',
  'download',
  'accept',
  'maxlength',
  'min',
  'max',
  'step',
  'rows',
]

export function normalizeAttrName(name: string): string {
  return name.toLowerCase()
}

export function isWhitelistedAttr(name: string): boolean {
  return PAGE_ATTR_WHITELIST.includes(normalizeAttrName(name))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
