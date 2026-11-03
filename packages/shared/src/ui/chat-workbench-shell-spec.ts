// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * chat-workbench-shell-spec(2026-10-28 立):全屏「AI 对话工作台」形态的契约层。
 *
 * 定位一句话:**外壳新形态,内核零复制**。
 * - 本规格只拥有"工作台壳"的常量与纯函数(窗格身份 / 路由 / 深链参数 / 布局档);
 * - 对话内核(消息流 MessageList、输入区 MessageInput、工具面板 AiSidePanelTools、
 *   历史加载与断线续接)一律复用票60 出品的 ChatPaneBody(pane 化出口),
 *   本规格与壳组件都不另写一份(AGENTS §0.6 单一真相源)。
 *
 * 形态谱系:
 *   根单例形态 = AISidePanel(全局停靠侧栏,既有)
 *   多窗格形态 = PaneSplitContainer(侧栏内分屏,既有)
 *   全屏工作台 = 本规格的 /chat/workbench(新挂载点,消费同一内核)
 */

/** 工作台对话窗格的 paneId:与根窗格(pane-root)和布局树叶 id 都不同域,store 实例天然隔离 */
export const WORKBENCH_PANE_ID = 'pane-workbench-main' as const

/** 工作台路由(深链契约:URL 是唯一真相,刷新/书签/分享不破坏) */
export const WORKBENCH_ROUTE = '/chat/workbench' as const

/** 深链查询参数名:与 /chat?conversationId= 同一参数名(跨形态心智一致) */
export const WORKBENCH_CONVERSATION_PARAM = 'conversationId' as const

/** 分屏叶上限(2026-10-28 片B):与侧栏多窗格宿主 D73_MAX_PANES 同档=4;
 *  两处常量以本行为对账真相,侧栏私有常量的并轨留后续票(§0.6 不新开第二把尺,先钉同值)。 */
export const WORKBENCH_MAX_PANES = 4

/**
 * 布局档(壳组件只引用常量,不各自散落 class 串;Tailwind 档位与 (main) 工作区口径一致):
 * - shell:全高扣掉 (main) 顶栏 58px(与 chat/page.tsx 登录引导同档);
 * - rail:左会话栏固定宽,可收缩让位;
 * - center:对话主区吃剩余宽度,min-w-0 防长内容撑破。
 */
export const WORKBENCH_LAYOUT = {
  shellClass: 'flex h-[calc(100vh-58px)] w-full overflow-hidden',
  railClass: 'flex w-[260px] shrink-0 flex-col border-r border-border bg-muted/30',
  centerClass: 'min-w-0 flex-1 flex-col overflow-hidden',
} as const

/** rail 行是否该被高亮(把"选中态"从视图里抽出成判据,壳与测试同一把尺) */
export function isRailRowSelected(rowId: string, selectedId: string | null): boolean {
  return rowId === selectedId
}

/**
 * 从 useSearchParams().get() 的原始值规整出会话 id:
 * 去首尾空白,空串视为无会话(新任务态);非法超长串直接拒(深链防御,阈值 128 与后端 id 档同量级)。
 */
export function resolveWorkbenchConversationId(raw: string | null): string | null {
  const id = (raw ?? '').trim()
  if (!id || id.length > 128) return null
  return id
}

/** 深链生成:工作台内切换会话/清空回新任务,都从这一个出口拼 URL */
export function workbenchConversationHref(conversationId: string | null): string {
  if (!conversationId) return WORKBENCH_ROUTE
  return `${WORKBENCH_ROUTE}?${WORKBENCH_CONVERSATION_PARAM}=${encodeURIComponent(conversationId)}`
}

/**
 * 发送链"建会话后同步 URL"的目标路由档(2026-10-28 立,两形态共享内核的钉子件):
 * - 停靠侧栏/根形态:行为与历史逐字一致 —— 恒回 `/chat`(此前 send-message 里三处硬编码);
 * - 工作台形态(含深链查询的全路径):留在 `/chat/workbench`,新建会话不得把用户从全屏壳
 *   拽回侧栏形态(形态切换必须经用户动作,不能由发送副产触发)。
 * 判据只认精确前缀(工作台路由及其子路径),任意其他 /chat 兄弟页(/chat/history 等)
 * 维持旧行为回 /chat —— 面板在那些页面照样"跳回 /chat 承载会话",零回归。
 */
export function chatDeeplinkPath(pathname: string): string {
  if (pathname === WORKBENCH_ROUTE || pathname.startsWith(`${WORKBENCH_ROUTE}/`)) {
    return WORKBENCH_ROUTE
  }
  return '/chat'
}

/**
 * 自动选中判据:URL 没带会话且会话池非空时,默认打开"最近一条"(Qoder 式续接体验)。
 * 调用方负责先按 pinned/lastMessageAt 排好序(壳里用的是既有的 sortPinnedFirst 出口),
 * 本函数只做"取第一条或 null",不在这里长第二份排序。
 */
export function pickAutoSelectConversationId(orderedIds: readonly string[]): string | null {
  return orderedIds.length > 0 ? (orderedIds[0] ?? null) : null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
