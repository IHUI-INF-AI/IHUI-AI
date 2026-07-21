/**
 * AI 自动控制跨端契约(2026-07-22 立)
 *
 * 定义 AI 在对话中调用浏览器/电脑控制能力时,ai-service MCP tool → api → extension/desktop 的跨端消息契约。
 * - browser_control.* 由 extension 执行(content script DOM 操作 + 截图)
 * - computer_control.* 由 desktop 执行(Tauri IPC + screenshots/enigo/arboard crate)
 *
 * 数据传输:截图统一用 base64 dataURL(无 'data:image/png;base64,' 前缀),避免二进制传输复杂度。
 */

// ================== Browser Control(由 extension 执行)==================

export type BrowserControlActionType =
  | 'screenshot'
  | 'click_element'
  | 'type_text'
  | 'scroll'
  | 'extract_dom'
  | 'navigate'
  | 'wait_for_element'
  | 'get_attribute'
  | 'hover'
  | 'select_option'
  | 'switch_tab'
  | 'close_tab'

export interface BrowserScreenshotParams {
  /** 截图区域:'viewport'(当前视口) | 'fullpage'(整页) | 'element'(指定元素) */
  area?: 'viewport' | 'fullpage' | 'element'
  /** 当 area='element' 时的元素选择器 */
  selector?: string
}

export interface BrowserClickParams {
  /** CSS 选择器 */
  selector: string
  button?: 'left' | 'right' | 'middle'
  /** 点击次数,默认 1 */
  count?: number
}

export interface BrowserTypeParams {
  selector: string
  text: string
  /** 输入前是否清空,默认 true */
  clear?: boolean
  /** 每字符延迟 ms,默认 0 */
  delay?: number
}

export interface BrowserScrollParams {
  direction: 'up' | 'down' | 'left' | 'right'
  /** 滚动量(像素),默认 300 */
  amount?: number
  /** 作用于指定元素,默认 window */
  selector?: string
}

export interface BrowserExtractDomParams {
  /** 提取范围:空='visible';'all'=全文档;其他=选择器 */
  selector?: string
  /** 提取哪些属性,默认 ['text','href','src','value'] */
  attributes?: string[]
  /** 最大返回节点数,默认 100 */
  maxNodes?: number
}

export interface BrowserNavigateParams {
  url: string
  /** 等待类型,默认 'load' */
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2'
  /** 超时 ms,默认 30000 */
  timeout?: number
}

export interface BrowserWaitForElementParams {
  selector: string
  /** 等待状态,默认 'visible' */
  state?: 'attached' | 'detached' | 'visible' | 'hidden'
  timeout?: number
}

export interface BrowserGetAttributeParams {
  selector: string
  attribute: string
}

export interface BrowserHoverParams {
  selector: string
}

export interface BrowserSelectOptionParams {
  selector: string
  /** 选项值或文本 */
  value: string
}

export interface BrowserSwitchTabParams {
  /** 0-based 标签页索引 */
  index: number
}

// ================== Computer Control(由 desktop 执行)==================

export type ComputerControlActionType =
  | 'screenshot_screen'
  | 'mouse_move'
  | 'mouse_click'
  | 'keyboard_type'
  | 'mouse_scroll'
  | 'keyboard_press'
  | 'keyboard_hotkey'
  | 'active_window'
  | 'clipboard_get'
  | 'clipboard_set'

export interface ComputerScreenshotScreenParams {
  /** 截屏显示器索引,默认 0(主屏) */
  displayIndex?: number
  /** 截屏区域 [x, y, w, h],默认全屏 */
  region?: [number, number, number, number]
}

export interface ComputerMouseMoveParams {
  x: number
  y: number
  /** 是否绝对坐标,默认 true */
  absolute?: boolean
}

export interface ComputerMouseClickParams {
  x: number
  y: number
  button?: 'left' | 'right' | 'middle'
  count?: number
}

export interface ComputerKeyboardTypeParams {
  text: string
  /** 每字符延迟 ms,默认 0 */
  delay?: number
}

export interface ComputerMouseScrollParams {
  /** 滚动量,正数向上,负数向下 */
  deltaY: number
  /** 滚动位置,默认当前位置 */
  x?: number
  y?: number
}

export interface ComputerKeyboardPressParams {
  /** 单个按键,如 'Enter' / 'Tab' / 'Escape' */
  key: string
}

export interface ComputerKeyboardHotkeyParams {
  /** 组合键,如 ['Control', 'Shift', 'A'] */
  keys: string[]
}

export interface ComputerActiveWindowParams {
  // 无参数,占位接口
}

export interface ComputerClipboardGetParams {
  /** 剪贴板格式,默认 'text' */
  format?: 'text' | 'image'
}

export interface ComputerClipboardSetParams {
  /** 文本内容(format='text' 时)或 base64 image dataURL(format='image' 时) */
  content: string
  format?: 'text' | 'image'
}

// ================== Agent Action Envelope(MCP tool ↔ api ↔ extension/desktop)==================

/** MCP tool → api → extension/desktop 的指令请求 envelope */
export interface AgentActionRequest {
  /** 唯一请求 ID,用于结果回传配对 */
  requestId: string
  /** 控制类别 */
  category: 'browser' | 'computer'
  /** 具体 action 类型 */
  action: BrowserControlActionType | ComputerControlActionType
  /** action 参数(根据 action 类型不同) */
  params: Record<string, unknown>
  /** 来源 MCP tool 调用 ID */
  toolCallId?: string
  /** 用户 ID(用于权限校验) */
  userId?: string
  /** 会话 ID */
  sessionId?: string
  /** 超时 ms,默认 30000 */
  timeout?: number
}

/** AgentActionResponse.errorCode 枚举 */
export type AgentActionErrorCode =
  | 'TIMEOUT'
  | 'SELECTOR_NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'EXECUTION_FAILED'
  | 'UNSUPPORTED_ACTION'
  | 'TARGET_NOT_CONNECTED'

/** 执行结果回传 envelope */
export interface AgentActionResponse {
  requestId: string
  success: boolean
  /** 错误消息(success=false 时) */
  error?: string
  errorCode?: AgentActionErrorCode
  /** 执行结果(根据 action 类型不同) */
  data?: {
    /** 截图 base64(无 'data:image/png;base64,' 前缀) */
    screenshot?: string
    /** 提取的 DOM/属性数据 */
    dom?: unknown
    /** 属性值 */
    value?: string | string[]
    /** URL/标题/状态 */
    url?: string
    title?: string
    /** active window 信息 */
    window?: { title: string; appName: string; bounds: [number, number, number, number] }
    /** 剪贴板内容 */
    clipboard?: string
    /** 自定义数据 */
    [key: string]: unknown
  }
  /** 执行耗时 ms */
  durationMs: number
  /** 执行端 */
  executedBy: 'extension' | 'desktop' | 'unknown'
}

// ================== Extension/Desktop → API 通道(能力声明)==================

/** 客户端能力声明(extension/desktop 启动时上报给 api) */
export interface AgentControlCapability {
  /** 端类型 */
  endpoint: 'extension' | 'desktop'
  /** 端实例 ID(多端并存时区分) */
  instanceId: string
  /** 支持的 browser action 列表 */
  browserActions?: BrowserControlActionType[]
  /** 支持的 computer action 列表 */
  computerActions?: ComputerControlActionType[]
  /** 端版本 */
  version?: string
  /** 上报时间 ISO */
  reportedAt: string
}
