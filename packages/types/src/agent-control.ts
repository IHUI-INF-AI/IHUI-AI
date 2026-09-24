// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AI 自动控制跨端契约(2026-07-22 立)
 *
 * 定义 AI 在对话中调用浏览器/电脑/本站前端控制能力时,ai-service MCP tool → api →
 * extension/desktop/web 的跨端消息契约。
 * - browser_control.* 由 extension 执行(content script DOM 操作 + 截图)
 * - computer_control.* 由 desktop 执行(Tauri IPC + screenshots/enigo/arboard crate)
 * - web_ui_* 由 web 前端执行(本站页面导航 / 表单填写 / 按钮点击 / 命令调用)
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

export type ComputerActiveWindowParams = Record<string, never>

export interface ComputerClipboardGetParams {
  /** 剪贴板格式,默认 'text' */
  format?: 'text' | 'image'
}

export interface ComputerClipboardSetParams {
  /** 文本内容(format='text' 时)或 base64 image dataURL(format='image' 时) */
  content: string
  format?: 'text' | 'image'
}

// ================== Web UI Control(由 web 前端执行,2026-09-20 立)==================

/**
 * 移动端(React Native)可控动作类别(2026-09-21 立,同日补齐 click/fill/submit)。
 *
 * 七个动词与 web 同形,但**定位方式完全不同**:web 靠 DOM 查询,RN 渲染原生视图没有 DOM,
 * click/fill 只能靠组件在挂载时把 onPress / 写入通道交给端内控件注册表
 * (apps/mobile-rn/src/lib/ui-field-registry.ts)。注册表里没有对应控件、或组件没交出通道,
 * 就如实返回 UNSUPPORTED_ACTION —— 不存在"回了 ok 而界面没动"。
 * 单独占一个 category('app_ui')而非复用 'ui',是因为 api 侧 category→endpoint 是一对一,
 * 同一用户 web 与 RN 同时在线时必须各投各的端(否则指令会被随机一端吃掉)。
 */
export type AppUiActionType =
  'describe' | 'navigate' | 'read' | 'invoke' | 'click' | 'fill' | 'submit'

/** 小程序端(Taro)可控动作:与 RN 同七项,但单独占 category='miniapp_ui'(见上段注释的 1:1 择端约束) */
export type TaroUiActionType = AppUiActionType

/**
 * 浏览器扩展**自有界面**(sidepanel / popup)可控动作(2026-09-21 立,第五族 `ext_ui`)。
 *
 * 为什么不能复用 `browser`:该 category 已按 1:1 择端映射到 endpoint='extension',语义是
 * "通过 content script 操控用户正在看的外部网页"。扩展自己的 `chrome-extension://` 页面
 * content script 进不去,却要同一 endpoint 承载两种完全不同的执行面 —— 若仍挂在 `browser` 上,
 * `findEndpointByCategory('browser')` 就会在"外部网页"和"扩展面板"之间二选一(随机吃掉一侧指令)。
 * 故单开 category,endpoint 仍是 extension:一个扩展注册一次能力,两族动作各走各的 category。
 * 执行端有真实同源 DOM,所以动作集与 web 同形(七动词)。
 */
export type ExtUiActionType = AppUiActionType
/**
 * 无 DOM 端describe 交出的**控件**条目(与 web 的 elements 同形,便于模型同一套用法)。
 * 只有真正挂载并交出通道的控件才会出现在这里;敏感框(密码/验证码)根本不入表。
 */
export interface AppUiElement {
  /** 稳定 id(如 'fld:input#3'),单调递增且永不复用 —— 卸载后重填会如实报未找到 */
  id: string
  /**
   * 控件类型。协议上保持 string:各端的取值集合不同且会各自演进
   * (web 另有 richtext/code/file,RN 只有 input/button/form,小程序还有 textarea/number/select/switch)。
   * 端内一律用自己的窄联合类型产出,消费方按字面量窄化。
   */
  kind: string
  label: string
  value?: string
  /** 约束提示,如 'multiline' / 'maxLength=50' / 'keyboardType=numeric' */
  constraint?: string
  group?: string
  disabled?: boolean
  /** fill 是否可用:组件没交出合法写入 path 时为 false */
  writable?: boolean
  /** click 是否可用:没挂 onPress 时为 false */
  pressable?: boolean
}

/** RN 端 web_ui_describe 的应答快照:路由清单 + 可调用命令 + 当前路由 */
export interface AppUiSnapshot {
  version: 1
  screen: { name: string; key?: string; params?: Record<string, unknown> }
  routes: { name: string; requiresParams: boolean; tab: boolean }[]
  commands: { id: string; label: string; group: string }[]
  /** 未登录时只挂 3 条 Screen,其余会静默失败 —— 用该字段告诉模型真实可用面 */
  authed: boolean
  /** 当前屏上可操控的控件(输入框/按钮/表单);没挂注册表的旧端缺省不返回 */
  elements?: AppUiElement[]
  /** 超出快照上限被挤掉的控件数:让模型知道"还有,只是没列出来",而不是以为页面就这么大 */
  suppressed?: number
}

/**
 * 本站前端可控动作类别。与 browser_*(外部网页)/ computer_*(操作系统)互补:
 * ui 类动作只作用于**自家应用页面**,靠注册表(actionId)定位而非任意选择器。
 */
export type UiControlActionType =
  /** 返回当前页面可操控清单(导航/命令/表单/交互元素) */
  | 'describe'
  /** 站内路由跳转(目标必须命中 ui-routes 白名单) */
  | 'navigate'
  /** 点击注册表内的按钮/链接/开关 */
  | 'click'
  /** 填写注册表内的输入框/下拉框 */
  | 'fill'
  /** 提交注册表内的表单 */
  | 'submit'
  /** 读取当前页面可读状态(标题/URL/可见文本/表单当前值) */
  | 'read'
  /** 调用命令注册表里的命令(含 ChatMode 切换、面板开关等) */
  | 'invoke'

export interface UiNavigateParams {
  /** 目标路由路径,如 '/settings/preferences';带参路由须填实际值 */
  path: string
}

export interface UiTargetParams {
  /**
   * 动作定位符:优先用 web_ui_describe 返回的 actionId(形如 'el:btn#7'),
   * 也可用可见文本(如 '保存')或 CSS 选择器。前端按此顺序解析。
   */
  target: string
}

export interface UiFillParams extends UiTargetParams {
  value: string | number | boolean
  /** 是否先清空原值,默认 true */
  clear?: boolean
}

export interface UiSubmitParams {
  /** 表单标识(web_ui_describe 返回的 form id);省略时提交页面主表单 */
  form?: string
}

export interface UiInvokeParams {
  /** 命令 ID(command-registry 的 id,如 'cmd:new-chat' / 'mode:plan') */
  name: string
  /** 命令参数(可选,由具体命令解释) */
  args?: Record<string, unknown>
}

/** web_ui_describe / web_ui_read 返回的交互元素描述符 */
export interface UiElementDescriptor {
  /** 稳定定位符:'el:<kind>#<序号>',本次 describe 快照内唯一 */
  id: string
  /** 元素类型:button / link / input / select / textarea / checkbox / switch / tab */
  kind: string
  /** 可读标签(可见文本 / aria-label / placeholder / name) */
  label: string
  /** 当前值(input/select/textarea) */
  value?: string
  /** 校验规则(input[type=number] 的 min/max/step 等) */
  constraint?: string
  /** 所属分组:'page' | 表单 id */
  group: string
  /** 是否禁用 */
  disabled?: boolean
  /** 2026-09-21 立:kind='link' 时回传 a[href] 指向(截断至 120 字符),模型据此知道"这条链接通向哪" */
  target?: string
}

/**
 * web_ui_describe 的全站路由检索摘要(2026-09-21 立,令牌成本硬约束)。
 *
 * 879 条路由全量绝不进回执:冷 describe 只带 total/navigable/groups(按顶级前缀的
 * 计数摘要,≤25 桶);模型再用 web_ui_describe(query=…) 拿回 top-N(≤40)命中,
 * 然后用 web_ui_navigate 跳转。matches[].path 是唯一会出现完整路径的字段,且仅按需。
 */
export interface UiRouteGroupCount {
  /** 路由组(顶级路径段;根路径为 'root';溢出尾桶为 '…others') */
  prefix: string
  /** 该组可导航路由条数 */
  count: number
}

/** describe(query=…) 的单条命中 */
export interface UiRouteMatch {
  path: string
  /** 路由分组(生成器 group) */
  group: string
  /** 是否含 :param 段(导航前须把 :id 替换为真实值) */
  param: boolean
}

export interface UiRouteIndex {
  /** 生成器产出的全部路由条数(含禁跳段) */
  total: number
  /** AI 可导航条数(剔除 login/sso/api 等禁跳前缀后) */
  navigable: number
  /** 按顶级前缀的计数摘要 */
  groups: UiRouteGroupCount[]
  /** 恒 true:web_ui_describe 接受可选 query 做全站检索 */
  queryable: true
  /** 带 query 检索时回显检索词 */
  query?: string
  /** 带 query 检索时的命中(top ≤40) */
  matches?: UiRouteMatch[]
  /** 命中总数(matches 可能截断于它) */
  matchTotal?: number
}

/** web_ui_describe 返回的表单描述符 */
export interface UiFormDescriptor {
  id: string
  /** 表单标题(legend / 最近标题元素) */
  title: string
  action: 'submit'
  fields: UiElementDescriptor[]
}

/** web_ui_describe 返回的命令描述符(命令面板 / 导航 / 模式 / 面板) */
export interface UiCommandDescriptor {
  id: string
  label: string
  description?: string
  /** 'navigate' | 'command' | 'mode' | 'panel' | 'ide' */
  group: string
  /** 目标(导航路由或命令 id) */
  target: string
}

/** web 前端上报的当前页面可操控快照(ai-service 经 web_ui_describe 拿到) */
export interface UiRegistrySnapshot {
  version: 1
  page: { path: string; title: string; url: string }
  commands: UiCommandDescriptor[]
  forms: UiFormDescriptor[]
  elements: UiElementDescriptor[]
  /** 被安全策略排除的元素数量(如密码框),供 AI 知悉而非静默丢弃 */
  suppressed: number
  /** 全站路由检索摘要(2026-09-21 立):冷回执只含计数分组,完整路径仅随 query 检索返回 */
  routes?: UiRouteIndex
  reportedAt: number
}

// ================== Agent Action Envelope(MCP tool ↔ api ↔ extension/desktop/web)==================

/** MCP tool → api → extension/desktop/web 的指令请求 envelope */
export interface AgentActionRequest {
  /** 唯一请求 ID,用于结果回传配对 */
  requestId: string
  /** 控制类别 */
  category: 'browser' | 'computer' | 'ui' | 'app_ui' | 'miniapp_ui' | 'ext_ui' | 'ext_ui'
  /** 具体 action 类型 */
  action:
    | BrowserControlActionType
    | ComputerControlActionType
    | UiControlActionType
    | AppUiActionType
    | TaroUiActionType
    | ExtUiActionType
  /** action 参数(根据 action 类型不同) */
  params: Record<string, unknown>
  /** 来源 MCP tool 调用 ID */
  toolCallId?: string
  /** 用户 ID(用于权限校验) */
  userId?: string
  /** 会话 ID */
  sessionId?: string
  /**
   * 指定执行端实例(2026-09-20 立,web 多标签页路由)。
   *
   * 同一用户可能开多个 app 标签页(都上报 endpoint='web'),不指定时 api 只能挑
   * "最后心跳那个",于是 web_ui_describe 与紧随其后的 web_ui_fill 会落到不同标签页 ——
   * describe 返回的元素 id 是**该页自己的映射**,换页执行必然 SELECTOR_NOT_FOUND。
   * 故 describe/read 应答里回传 instanceId,后续动作按它钉回同一个页面。
   */
  targetInstanceId?: string
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
  /** 2026-09-20 web UI 桥接:目标命中破坏性操作黑名单(注销/删除/提现等),前端拒绝执行 */
  | 'DESTRUCTIVE_BLOCKED'
  /** 2026-09-20 web UI 桥接:导航目标不在站内路由白名单内 */
  | 'ROUTE_NOT_ALLOWED'
  /**
   * 2026-09-25 页内语义快照(活句柄)一侧的结构化错误码。
   * 必须与 `@ihui/dom-actions` 的 `PageActionErrorCode` 保持一致 —— 扩展端
   * `lib/agent-control.ts` 把它们原样赋给本枚举,少一条就是 `TS2322`(编译期即护栏,
   * 不需要另建对账清单)。不复用 SELECTOR_NOT_FOUND 的理由见 contract:那条码把
   * "选择器没匹配"和"活引用失效"混成一码,模型无从判断该重拍快照还是换坐标。
   */
  | 'HANDLE_MALFORMED'
  | 'HANDLE_SCOPE_MISMATCH'
  | 'HANDLE_STALE'
  | 'HANDLE_NOT_RENDERED'
  | 'TARGET_NOT_EDITABLE'
  | 'TARGET_NOT_SELECTABLE'
  | 'PAGE_API_UNAVAILABLE'
  | 'COORD_OUT_OF_BOUNDS'
  | 'NO_ELEMENT_AT_POINT'
  | 'PARAM_INVALID'

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
    /** 应答端实例 ID(web 桥用于把后续动作钉回同一标签页) */
    instanceId?: string
    /** 自定义数据 */
    [key: string]: unknown
  }
  /** 执行耗时 ms */
  durationMs: number
  /** 执行端 */
  executedBy: 'extension' | 'desktop' | 'web' | 'rn' | 'miniapp' | 'unknown'
}

// ================== Extension/Desktop/Web → API 通道(能力声明)==================

/** 客户端能力声明(extension/desktop/web 启动时上报给 api) */
export interface AgentControlCapability {
  /** 端类型 */
  endpoint: 'extension' | 'desktop' | 'web' | 'rn' | 'miniapp'
  /** 端实例 ID(多端并存时区分) */
  instanceId: string
  /** 支持的 browser action 列表 */
  browserActions?: BrowserControlActionType[]
  /** 支持的 computer action 列表 */
  computerActions?: ComputerControlActionType[]
  /** 支持的 web UI action 列表(2026-09-20 立,web 前端上报) */
  uiActions?: UiControlActionType[]
  /** 支持的 RN 端 action 列表(2026-09-21 立,mobile-rn 上报) */
  appUiActions?: AppUiActionType[]
  /** 支持的小程序 action 列表(2026-09-21 立,miniapp-taro 上报) */
  taroUiActions?: TaroUiActionType[]
  /** 支持的扩展自有界面 action 列表(2026-09-21 立,sidepanel/popup 上报) */
  extUiActions?: ExtUiActionType[]
  /** 端版本 */
  version?: string
  /** 上报时间 ISO */
  reportedAt: string
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
