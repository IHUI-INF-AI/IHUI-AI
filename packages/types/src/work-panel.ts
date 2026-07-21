/**
 * 工作展示区(WorkPanel)跨端契约类型
 * 用于 AI 对话内嵌浏览器 / URL 预览 / Artifact 展示
 * 跨端共享: web + desktop + mobile-rn + miniapp-taro + extension
 */

/** 工作展示区 Tab 类型 */
export type WorkPanelTabType = 'browser' | 'preview' | 'code' | 'artifact'

/** URL 来源(决定联动行为) */
export type NavigateSource = 'user' | 'ai-tool' | 'markdown-link' | 'history'

/** WebView 加载状态 */
export type WebViewStatus =
  | 'idle' // 未加载
  | 'loading' // 加载中
  | 'loaded' // 加载成功(iframe 模式)
  | 'screenshot' // 降级到截图模式(X-Frame-Options 禁止)
  | 'failed' // 加载失败
  | 'blocked' // URL 不安全被拦截

/** WebView 嵌入模式(由前端探测决定) */
export type WebViewMode = 'iframe' | 'screenshot' | 'native' | 'external'

/** 工作展示区单个 Tab */
export interface WorkPanelTab {
  /** 唯一 ID(uuid 或 url+timestamp) */
  id: string
  /** Tab 类型 */
  type: WorkPanelTabType
  /** Tab 标题(浏览器 Tab 显示页面 title) */
  title: string
  /** 当前 URL(browser 类型必填,其他类型可选) */
  url?: string
  /** 历史栈(前进/后退) */
  history: string[]
  /** 当前历史索引 */
  historyIndex: number
  /** WebView 当前状态 */
  state: WebViewState
  /** 是否可关闭 */
  closable: boolean
  /** 创建时间 */
  createdAt: number
  /** 最后访问时间 */
  updatedAt: number
}

/** WebView 运行时状态 */
export interface WebViewState {
  /** 当前状态 */
  status: WebViewStatus
  /** 当前 URL */
  url: string
  /** 页面标题(加载后填充) */
  title?: string
  /** 嵌入模式 */
  mode: WebViewMode
  /** 截图 base64(screenshot 模式) */
  screenshot?: string
  /** 错误信息(failed/blocked) */
  error?: string
  /** 加载进度 0-100 */
  progress?: number
}

/** 导航选项 */
export interface NavigateOptions {
  /** 目标 URL */
  url: string
  /** 来源 */
  source?: NavigateSource
  /** 是否在新 Tab 打开(默认 false,当前 Tab 导航) */
  newTab?: boolean
  /** Tab 类型(默认 browser) */
  tabType?: WorkPanelTabType
  /** 是否强制截图模式(用于已知禁止 iframe 的站点) */
  forceScreenshot?: boolean
}

/** 工作展示区配置 */
export interface WorkPanelConfig {
  /** 面板宽度(px) */
  width: number
  /** 最小宽度 */
  minWidth: number
  /** 最大宽度 */
  maxWidth: number
  /** 是否展开 */
  open: boolean
  /** 当前激活 Tab ID */
  activeTabId: string | null
  /** Tab 列表 */
  tabs: WorkPanelTab[]
}

/** 打开工作展示区参数 */
export interface OpenWorkPanelParams {
  /** 要打开的 URL(可选,不传则只打开空面板) */
  url?: string
  /** 来源 */
  source?: NavigateSource
  /** Tab 类型 */
  tabType?: WorkPanelTabType
  /** 是否新 Tab */
  newTab?: boolean
}

/** 浏览器工具栏动作 */
export type BrowserToolbarAction =
  | 'back' // 后退
  | 'forward' // 前进
  | 'reload' // 刷新
  | 'stop' // 停止加载
  | 'home' // 主页
  | 'screenshot' // 手动截图
  | 'open-external' // 在外部浏览器打开
  | 'toggle-devtools' // 切换开发者工具(desktop)

/** 截图请求参数(API 契约) */
export interface ScreenshotRequest {
  /** 目标 URL */
  url: string
  /** 视口宽度(默认 1280) */
  width?: number
  /** 视口高度(默认 720) */
  height?: number
  /** 是否全页面截图(默认 false) */
  fullPage?: boolean
  /** 等待策略(none/dom/load/networkidle) */
  waitUntil?: 'none' | 'dom' | 'load' | 'networkidle'
  /** 超时 ms(默认 15000) */
  timeout?: number
}

/** 截图响应(API 契约) */
export interface ScreenshotResponse {
  /** base64 编码的 PNG 截图(不含 data: 前缀) */
  screenshot: string
  /** 页面标题 */
  title: string
  /** 最终 URL(可能因重定向变化) */
  url: string
  /** 是否可 iframe 嵌入(true=可以,false=需要用截图模式) */
  canEmbed: boolean
  /** 截图时间戳 */
  capturedAt: number
}

/** URL 嵌入探测请求 */
export interface EmbedProbeRequest {
  url: string
}

/** URL 嵌入探测响应 */
export interface EmbedProbeResponse {
  url: string
  /** 是否可 iframe 嵌入 */
  canEmbed: boolean
  /** 不可嵌入的原因 */
  reason?: 'x-frame-options' | 'csp-frame-ancestors' | 'cors' | 'network-error' | 'unknown'
  /** 响应头(调试用) */
  headers?: Record<string, string>
}

/** 工作展示区 store 动作(跨端统一接口) */
export interface WorkPanelActions {
  /** 打开面板(可带 URL) */
  openPanel: (params?: OpenWorkPanelParams) => void
  /** 关闭面板 */
  closePanel: () => void
  /** 切换展开/收起 */
  toggle: () => void
  /** 导航到 URL */
  navigate: (options: NavigateOptions) => void
  /** 后退 */
  back: () => void
  /** 前进 */
  forward: () => void
  /** 刷新当前页 */
  reload: () => void
  /** 停止加载 */
  stop: () => void
  /** 新建 Tab */
  newTab: (url?: string) => void
  /** 关闭 Tab */
  closeTab: (tabId: string) => void
  /** 切换激活 Tab */
  setActiveTab: (tabId: string) => void
  /** 更新 Tab 状态(WebView 加载状态变化时调用) */
  updateTabState: (tabId: string, state: Partial<WebViewState>) => void
  /** 设置面板宽度 */
  setWidth: (width: number) => void
}

/** 工作展示区 store 完整接口(状态 + 动作) */
export interface WorkPanelStore extends WorkPanelConfig, WorkPanelActions {}
