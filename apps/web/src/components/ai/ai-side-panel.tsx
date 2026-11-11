// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- 手柄 role="separator" 配合 onPointerDown
   是可拖拽交互元素,但 jsx-a11y 默认把 separator 视为非交互元素,需 Tab 聚焦做无障碍。 */
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions -- 同上:该 separator 是
   window splitter(WAI-ARIA),支持指针拖拽 + ←/→ 调宽,不是装饰性非交互元素。 */

import * as React from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
// BrandIcon 的**类型**走 type-only 导入(编译期擦除,不会把 95+ 个 @lobehub/icons 拖回主 chunk)
import type { BrandIconProps } from '@/components/ai/brand-icon'
// inferVendor 是纯函数,必须与 BrandIcon 分家:同模块导入会把整个图标集拖回面板 chunk
import { inferVendor } from '@/components/ai/vendor-infer'
import {
  Maximize2,
  Minimize2,
  Minus,
  PictureInPicture2,
  ChevronUp,
  SquareTerminal,
  Columns2,
  Loader2,
  GitPullRequest,
  MoreHorizontal,
  Check,
  X,
} from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { IconButton } from '@ihui/ui-react'
import { rnRadius } from '@ihui/design-tokens'
import { toast, AuthGatePrompt } from '@/components/common'
import { cn } from '@/lib/utils'
import { useChat } from '@/hooks/use-chat'
import { useConversationPaneCache } from '@/hooks/use-conversation-pane-cache'
import { useAuthGate } from '@/hooks/use-auth-gate'
import {
  useWebSocket,
  type WSNotification,
  isAIResponse,
  isAIQuestion,
  isAIQuestionAnswered,
  isChatMessage,
} from '@/hooks/use-websocket'
import { MessageList } from '@/components/chat/message-list'
import { MessageInput } from '@/components/chat/message-input'
import { SessionUsageBadge } from '@/components/chat/session-usage-badge'
// D28 补齐层(2026-10-03):导入会话的来源标识 + 「用场景分析」入口。
// 槽位(横幅 + 入口按钮)与 ChatPaneBody 共用 ImportProvenanceSlot,不各写一份;
// 目录大的分析弹窗走 dynamic,避免 210 条模板正文(≈493KB)进 AI 面板主 chunk。
import { ImportProvenanceSlot } from '@/components/ai/import-source-banner'
import { readImportProvenance, type ImportProvenance } from '@ihui/shared/import-analysis'
const ImportAnalysisDialog = dynamic(
  () => import('@/components/ai/import-analysis-dialog').then((m) => m.ImportAnalysisDialog),
  { ssr: false },
)
import { WorkspaceSelector } from '@/components/ai/workspace-selector'
import { Tooltip, TooltipProvider } from '@/components/feedback'
import { useChatStore, type ChatMessage } from '@/stores/chat'
import {
  AI_PANEL_MAX_WIDTH,
  AI_PANEL_MIN_WIDTH,
  useAiPanelStore,
} from '@/stores/ai-panel'
import { useEnvironmentInfoStore } from '@/stores/environment-info'
import { useTerminalDockStore } from '@/stores/terminal-dock'
import { useModeStore } from '@/stores/mode'
import { useLoginDialogStore } from '@/stores/login-dialog'
import { getConversation, getConversationHistory, getMessages } from '@ihui/api-client'
import type { ChatMode } from '@ihui/types'
import { parsePendingQuestion } from '@/lib/pending-question'
// Runtime 插话能力声明落库口(会话元数据 → store)
import { noteRuntimeCapabilities } from '@/hooks/use-chat/runtime-capabilities'
import { fetchApi } from '@/lib/api'
import { judgePageAdvance } from '@/lib/pagination-stall'
// P1-6 断点续传(片3,2026-10-21):编排与 ChatPaneBody 共用 useResumeBranch 一份出口
import { useResumeBranch } from '@/hooks/use-chat/resume-stream'
import { hydrateHistoryMessages } from '@/hooks/use-chat/history-message'
// 差距④(2026-10-30 立):?turn= 深链锚点目标(peek/clear)+ 既有跳转机制(锚点定位出口)
// 差距⑤补全:完整页按服务端 user 开轮口径盖 turnOrdinal(「分享此回合」生成端的数据源)
import {
  TURN_ANCHOR_UNRESOLVED_ERROR,
  decideAroundLoad,
  getTurnDeepLinkVersionForPane,
  markPageTurnOrdinals,
  peekTurnDeepLink,
  stampCompletePageTurnOrdinals,
  subscribeTurnDeepLink,
  unresolvedTurnAnchorState,
} from '@/lib/turn-deeplink'
import { useProgressJumpStore } from '@/stores/progress-jump-store'
// 形态档 + 浮窗几何唯一真相源(2026-11-11 立):断点只在这里定义,组件不再自己写 matchMedia。
import {
  AI_FAB_SIZE,
  clampFabPosition,
  clampFloatPosition,
  getFloatSize,
  getPanelBucket,
  planFormMigration,
  resolveFloatRect,
  snapFabPosition,
  snapFloatPosition,
  useViewportSize,
} from '@/lib/ai-panel-bucket'
import { useDesktop } from '@/hooks/use-desktop'
import { armWindowDragOnFirstMove, isDraggableBlankArea } from '@/lib/window-drag'
// P3 #34(2026-09-16 立):流式屏幕阅读器播报(aria-live)
import { SrStreamAnnouncer } from '@/components/chat/sr-stream-announcer'
import { VoiceStreamSpeaker } from '@/components/chat/voice-stream-speaker'
// P3 #43(2026-09-16 立):成本预检/对比条
import { CostEstimateBar } from '@/components/ai/cost-estimate-bar'

// D73 多任务窗格(G-100,2026-09-24):布局壳 + 窗格 store + 判定层类型/纯函数
import { PaneSplitContainer } from '@/components/ai/pane-split-container'
import { ChatPaneBody } from '@/components/ai/chat-pane-body'
// 2026-11-08 立:提问改为消息流内联卡(原 QuestionDialog 弹窗退场)
import { InlineQuestionCard } from '@/components/ai/inline-question-card'
import { ChatPaneProvider } from '@/stores/chat-pane-context'
import { usePaneSplitStore, rehydratePaneSplitLayout } from '@/stores/pane-split'
import {
  ROOT_PANE_ID,
  type ForkFailureReason,
  collectPaneLeaves,
} from '@ihui/shared/chat/multi-pane'

/* ──────────────────────────────────────────────────────────────────────────────
 * 懒加载边界(2026-09-30 立 · AI 面板首屏延迟根治)
 *
 * 背景:AISidePanel 自身已被 GlobalShell 用 next/dynamic({ ssr:false }) 懒加载,
 * 但本文件**此前零 lazy**,整条重依赖链被打成同一个 chunk ——
 * message-list(≈8k 行)/ message-input(1.5k 行)/ terminal-dock(≈2.3k 行)/
 * agent-task-progress-pane(2k + 7.9k 行)/ brand-icon(95+ 个 @lobehub/icons)…
 * 结果:必须整包下载并解析完,面板才出现 —— 用户体感"过一会才显示"。
 *
 * 方案:把"首屏不需要"的重组件下沉为独立 chunk。主 chunk 只留面板容器 +
 * header + MessageList + MessageInput,体积与解析成本大幅下降 → 面板可见提前。
 * 这些块默认不渲染(内部各自 `if (!open) return null`),故视觉上零闪烁;
 * 打开时才拉对应子 chunk(几十 ms 级,且是并行下载)。
 *
 * 刻意**不** lazy 的(改了会更糟):
 * - MessageList / MessageInput:面板主体。lazy = "面板出现后再空一会"的二次闪烁
 * - WorkspaceSelector:header 常驻入口,体积小、lazy 反而闪
 * - SrStreamAnnouncer:aria-live 播报区,延迟挂载会丢掉流式输出首段播报
 * - CostEstimateBar / PaneSplitContainer:体积收益≈0 或为布局容器(lazy 会塌陷)
 * - VoiceStreamSpeaker:其 readHandsFree 被 message-input 静态导入,摘不干净,收益为负
 *
 * 防回潮:scripts/check-ai-panel-mount-guards.mjs 的 R2 断言下列模块不得改回静态 import,
 * 且 inferVendor 不得改回从 brand-icon 导入(否则图标集被拖回主 chunk,且零视觉症状)。
 * ──────────────────────────────────────────────────────────────────────────── */

/** 任务进度面板(2k + 7.9k 行):默认关闭,内部 if (!open) return null */
const AgentTaskProgressPane = dynamic(
  () => import('@/components/ai/agent-task-progress-pane').then((m) => m.AgentTaskProgressPane),
  { ssr: false },
)
/** 环境信息浮层(817 + 946 行):点击才展开 */
const EnvironmentInfoPopover = dynamic(
  () => import('@/components/ai/environment-info-popover').then((m) => m.EnvironmentInfoPopover),
  { ssr: false },
)
/** D176 任务回顾/移交到新任务入口(301 行 + Dialog):点击才展开,头部按钮组常驻入口 */
const TaskRecapEntry = dynamic(
  () => import('@/components/ai/d176-task-recap').then((m) => m.TaskRecapEntry),
  { ssr: false },
)
/** 工具面板(818 行 + 15 个下游面板):默认折叠 */
const AiSidePanelTools = dynamic(
  () => import('@/components/ai/ai-side-panel-tools').then((m) => m.AiSidePanelTools),
  { ssr: false },
)
/** 底部终端 dock(≈2.3k 行):open=false 时渲染 null(@xterm 本体在其内部已二次 lazy) */
const AiTerminalDock = dynamic(
  () => import('@/components/ai/ai-terminal-dock').then((m) => m.AiTerminalDock),
  { ssr: false },
)
/** 工作区权限弹窗(459 行 + react-query):仅在绑定无权限工作区时挂载 */
const WorkspacePermissionDialog = dynamic(
  () =>
    import('@/components/workspace/workspace-permission-dialog').then(
      (m) => m.WorkspacePermissionDialog,
    ),
  { ssr: false },
)
/** 压缩状态栏(338 行):仅压缩进行中可见 */
const CompactionStatusBar = dynamic(
  () => import('@/components/chat/compaction-status-bar').then((m) => m.CompactionStatusBar),
  { ssr: false },
)

/**
 * 品牌图标(95+ 个 @lobehub/icons 深路径组件)—— 面板主 chunk 里最大的单点。
 * 用 React.lazy 而非 next/dynamic:dynamic 的 loading 插槽**拿不到 props**,
 * 无法按 size 渲染等尺寸占位(会闪一下)。这里用 Suspense + fallback 显式按 size 占位。
 */
const BrandIconLazy = React.lazy(() =>
  import('@/components/ai/brand-icon').then((m) => ({ default: m.BrandIcon })),
)

/** 品牌图标的延迟渲染包装:占位与真实图标同尺寸,加载完成时不跳动 */
function BrandIconDeferred({ size = 16, className, vendor, fallbackIcon }: BrandIconProps) {
  return (
    <React.Suspense
      fallback={
        <span
          aria-hidden
          className={cn('inline-block shrink-0 rounded bg-muted', className)}
          style={{ width: size, height: size }}
        />
      }
    >
      <BrandIconLazy
        size={size}
        className={className}
        vendor={vendor}
        fallbackIcon={fallbackIcon}
      />
    </React.Suspense>
  )
}

/** 头部「⋯」溢出菜单项的统一视觉规格(Radix Item 的高亮态与项目 DropdownMenu 惯例一致) */
const HEADER_MENU_ITEM_CLASS =
  'flex cursor-default select-none items-center gap-2 rounded-sm px-2.5 py-1.5 text-label outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground'

/** 全局 AI docked 侧边面板(对齐旧架构 .ai-side-panel 设计)。
 * - 默认 display:none,由 useAiPanelStore.open 控制
 * - 紧贴 Sidebar 右侧(flex 顺序:Sidebar → AISidePanel → main)
 * - 内嵌 ChatHeader + ModelSelector + MessageList + MessageInput
 * - 右侧 6px 拖拽手柄调整宽度(320-720px)
 * - 当前会话完全由 useChatStore.conversationId 驱动,不再依赖 URL ?conversationId=
 *   (AI 面板是全局 docked 组件,与 Sidebar 同性质,不应影响 URL 与右侧工作区)
 * - 监听 WebSocket ai_response 多端同步
 */

/** 浮窗默认位置锚点:工作内容展示区(#work-area-portal-root)左下角,向上弹出
 *  - left: 工作区左边缘 + 16px(紧贴 sidebar 右侧,留 16px 缓冲)
 *  - bottom: 工作区底边 - 16px(底部对齐,面板高度变化时顶部向上扩展 = "向上弹出"视觉效果)
 *  - 测量失败回退: left=256(sidebar 默认 240 + 16), bottom=innerHeight-16
 *  - 仅在 floatPosition 为哨兵(-1)时使用;拖拽后的坐标是**会话级**(不持久化),
 *    出口统一经 lib/ai-panel-bucket 的 resolveFloatRect 做视口收口。
 *  - 2026-09-01 fix:浮窗位置在 workAreaCollapsed 变化时不应跳变 → 缓存,只在首次使用时计算
 *    (每次 render 重新 getBoundingClientRect 会因主界面 reflow 得出不同值,导致浮窗位置抖动) */
function getDefaultFloatAnchor(): { left: number; bottom: number } {
  if (typeof window === 'undefined') return { left: 256, bottom: 1000 }
  const root = document.getElementById('work-area-portal-root')
  const rect = root?.getBoundingClientRect()
  return {
    left: rect ? rect.left + 16 : 256,
    bottom: rect ? rect.bottom - 16 : window.innerHeight - 16,
  }
}

// 锚点缓存(2026-11-11 修):原先是**模块求值**时测量 —— 模块 import 早于工作区挂载,
// 实测拿不到 #work-area-portal-root 就永久回落 256/innerHeight。改为首次真正用到
// (浮窗分支渲染 / 拖拽起手)时测量一次并缓存:此时布局已就绪,且不会每帧 reflow。
let _floatAnchorCache: { left: number; bottom: number } | null = null
function getFloatAnchor(): { left: number; bottom: number } {
  if (!_floatAnchorCache) _floatAnchorCache = getDefaultFloatAnchor()
  return _floatAnchorCache
}

/** 自定义"工作展示区"图标(对标设计稿):大圆角面板 + 短竖线,竖线两端不贴外框
 *  left=false 竖线在右侧(工作区展开状态);left=true 竖线在左侧(工作区收起状态) */
function PanelRightRounded({
  left = false,
  ...props
}: React.SVGProps<SVGSVGElement> & { left?: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect width="18" height="18" x="3" y="3" rx={rnRadius.sm} />
      <path d={left ? 'M7.5 8v8' : 'M16.5 8v8'} />
    </svg>
  )
}

/** 自定义"环境信息"图标:大圆角面板 + 菜单三条横线,选中切换为打勾 */
function EnvInfoRounded({
  checked = false,
  ...props
}: React.SVGProps<SVGSVGElement> & { checked?: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect width="18" height="18" x="3" y="3" rx={rnRadius.sm} />
      {checked ? (
        <path d="M8 12.5l2.5 2.5 5.5-6" />
      ) : (
        <>
          <path d="M8 8h8" />
          <path d="M8 12h8" />
          <path d="M8 16h8" />
        </>
      )}
    </svg>
  )
}

/**
 * 公开文档路由判定(2026-11-03 立,S5 票:游客在手机上看文档正文被面板整屏抢占)。
 * `/docs` 的精确条目住在 `src/lib/login-dialog-trigger.ts` 的 PUBLIC_PATHS(游客可达白名单,
 * 与 proxy 对齐的那一份);文档子页(`/docs/api`、`/docs/manual` …)由 `app/(main)/docs/**` 提供,
 * 白名单按精确路径匹配不含子页 ⇒ 此处只按 `/docs` 前缀补齐"文档站"这一族。
 * 返回值仅作面板形态的输入,不落任何 store ⇒ 不构成第二份显示状态真相源。
 */
const PUBLIC_DOCS_PREFIX = '/docs'
/**
 * 游客公开文档页的面板形态:保留 `fixed inset-0` 类名(DevTools/E2E/globals.css 的
 * `.ai-panel-root.fixed.inset-0 > aside` 安全区规则都靠它),只用 inline `top` 把盒子
 * 下移到视口下沿 ⇒ 文档占首屏主体、面板成为底部抽屉。类名一个字未动,可整体回退。
 */
const GUEST_DOCS_FLOAT_STYLE: React.CSSProperties = { top: '52%' }
function isPublicDocsRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  const pathOnly = pathname.split('?')[0]?.split('#')[0] ?? ''
  return pathOnly === PUBLIC_DOCS_PREFIX || pathOnly.startsWith(`${PUBLIC_DOCS_PREFIX}/`)
}

/**
 * 找出面板里"真正在滚"的元素(消息列表/历史区的滚动容器)。
 * 为什么不写死选择器:消息流承载件在 D73 窗格化后有多种分支,依赖内部 class/testid
 * 会让本功能随下游改版静默失效。这里按「能滚 + 溢出量最大」取,与实现解耦。
 * 只在最小化/关闭/重开的用户动作里调用(非渲染路径),O(n) 扫描可忽略。
 */
function findPanelScrollContainer(root: HTMLElement | null): HTMLElement | null {
  if (!root) return null
  let best: HTMLElement | null = null
  let bestRange = 0
  for (const el of root.querySelectorAll<HTMLElement>('*')) {
    const range = el.scrollHeight - el.clientHeight
    if (range <= 8) continue
    const { overflowY } = window.getComputedStyle(el)
    if (overflowY !== 'auto' && overflowY !== 'scroll') continue
    if (range > bestRange) {
      best = el
      bestRange = range
    }
  }
  return best
}

export function AISidePanel() {
  const t = useTranslations('chat')
  const tc = useTranslations('aiChat')
  const tcommon = useTranslations('common')
  // 登录态门(与 settings 页同型):未就绪/未登录不发注定 401 的会话历史请求,消息区改显登录引导
  const tGate = useTranslations('chatHistory')
  const { ready, allow } = useAuthGate()

  // 性能修复(2026-07-25):全解构 → 单字段 selector。
  // zustand action 函数引用稳定,不会触发重渲染;state 字段(open/width/isResizing)
  // 只在对应字段变化时触发本组件重渲染,activeWorkspace 变化不再让本组件重渲染。
  const open = useAiPanelStore((s) => s.open)
  const width = useAiPanelStore((s) => s.width)
  const isResizing = useAiPanelStore((s) => s.isResizing)
  const closePanel = useAiPanelStore((s) => s.closePanel)
  const setWidth = useAiPanelStore((s) => s.setWidth)
  const setResizing = useAiPanelStore((s) => s.setResizing)
  const activeWorkspace = useAiPanelStore((s) => s.activeWorkspace)
  const setActiveWorkspace = useAiPanelStore((s) => s.setActiveWorkspace)
  const pendingPermissionSetup = useAiPanelStore((s) => s.pendingPermissionSetup)
  const setPendingPermissionSetup = useAiPanelStore((s) => s.setPendingPermissionSetup)
  // 浮窗模式状态(2026-07-30)
  // 2026-11-11 形态档重构:store 里的 floatMode 只是「用户偏好」,真正的形态由视口能力派生:
  //   sheet(<640) / float(640–1279) 档**不存在**停靠位 ⇒ 一律浮;只有 docked(≥1280)才看偏好。
  // 这样「open=true 却整块不可见」的死态在结构上不可能出现(见 lib/ai-panel-bucket 顶部说明)。
  const floatModePref = useAiPanelStore((s) => s.floatMode)
  const floatMinimized = useAiPanelStore((s) => s.floatMinimized)
  const floatCollapsed = useAiPanelStore((s) => s.floatCollapsed)
  const floatPosition = useAiPanelStore((s) => s.floatPosition)
  // FAB 拖拽后的独立位置(null = 跟随浮窗矩形左下角)
  const floatFabPosition = useAiPanelStore((s) => s.floatFabPosition)
  const viewport = useViewportSize()
  const bucket = getPanelBucket(viewport.width)
  const isSheet = bucket === 'sheet'
  /** 派生形态:本档是否浮窗(下文所有 floatMode 判断都指这个派生值) */
  const floatMode = bucket === 'docked' ? floatModePref : true
  /** 浮窗矩形:仅浮窗态计算(停靠 / SSR 不触碰 document,避免服务端无 window) */
  const floatRect = React.useMemo(
    () =>
      floatMode
        ? resolveFloatRect(floatPosition, getFloatAnchor(), viewport.width, viewport.height)
        : null,
    [floatMode, floatPosition, viewport.width, viewport.height],
  )
  /** 非空视图(零值占位):浮窗外的分支不会消费它的几何字段 */
  const floatBox = floatRect ?? { x: 0, y: 0, width: 0, height: 0 }

  // 宽度闪变修复(2026-09-08 用户反馈"刷新时先窄过一会又变宽"):
  // SSR 用 noopStorage 以默认宽度 300 渲染,客户端 zustand persist rehydrate 恢复
  // 用户拖拽偏好宽度,React 水合时补丁 style 触发宽度跳变;而 transition 会把这次
  // 跳变渲染成 0.2s 动画,被感知为"慢慢变宽"。首帧挂载前禁用所有宽度过渡,
  // 让水合宽度瞬时落定,挂载后(setMounted)再恢复过渡动画。
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  const dockedTransition = mounted && !isResizing ? 'width 0.2s cubic-bezier(0.4,0,0.2,1)' : 'none'
  const floatTransition =
    mounted && !isResizing
      ? 'width 0.2s cubic-bezier(0.4,0,0.2,1), height 0.2s cubic-bezier(0.4,0,0.2,1), left 0.2s cubic-bezier(0.4,0,0.2,1)'
      : 'none'
  // 三态切换动效(2026-11-11):最小化 FAB / 浮窗 / 停靠之间是 DOM 与定位的离散跳变,
  // 直接切会「硬闪」。统一用淡入 + 轻微缩放遮住落点变化:
  //  - leaving:最小化先播 280ms 退场,再真正切到 FAB 分支(仅动效,不改变状态语义)
  //  - modeFx:docked ↔ float 切换时给根节点临时补一次入场(挂载入场由 CSS 类负责)
  const [leaving, setLeaving] = React.useState(false)
  const [modeFx, setModeFx] = React.useState(false)
  const leaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  React.useEffect(
    () => () => {
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
    },
    [],
  )
  const prevBucketRef = React.useRef(bucket)
  React.useEffect(() => {
    if (prevBucketRef.current === bucket) return
    prevBucketRef.current = bucket
    setModeFx(true)
    const t = setTimeout(() => setModeFx(false), 440)
    return () => clearTimeout(t)
  }, [bucket])

  const setFloatMode = useAiPanelStore((s) => s.setFloatMode)
  const setFloatMinimized = useAiPanelStore((s) => s.setFloatMinimized)
  const setFloatCollapsed = useAiPanelStore((s) => s.setFloatCollapsed)
  const setFloatPosition = useAiPanelStore((s) => s.setFloatPosition)
  const setFloatFabPosition = useAiPanelStore((s) => s.setFloatFabPosition)
  const openPanel = useAiPanelStore((s) => s.openPanel)
  const {
    messages,
    currentModel,
    isStreaming,
    pendingQuestion,
    sendMessage,
    submitQuestionResponse,
    stop,
    clearMessages,
    setModel,
    // W5(2026-09-18 立):diff 应用工作流必须在面板处继续向 MessageList 透传,
    // 否则 InlineDiffCard 的 onApply/onReject 恒为 undefined,按钮点了没反应(死链修复)
    applyDiff,
    rejectDiff,
    applyAllDiffs,
    rejectAllDiffs,
    applyDiffSelection,
  } = useChat()
  const subAgentActivities = useChatStore((s) => s.subAgentActivities)
  const chatError = useChatStore((s) => s.error)
  // 「当前对话的模型」≠ 全局模型选择器(2026-11-11 用户报障):
  // currentModel 是选择器的值,打开历史对话不会回填(切会话不改它),默认恒为 'auto';
  // 而 message.model 里 auto 轮也是字面量 'auto'(见 resolveRoundModel),同样查不到厂商。
  // 真实模型只有计量帧带回来(MessageUsage.model = 实际计费模型,可区别于 'auto'),
  // 所以按「消息 model → 该消息 usage 的真实模型 → 选择器」三级回退。
  const usageByMessageId = useChatStore((s) => s.usageByMessageId)
  const conversationModel = React.useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const msg = messages[i]
      if (!msg) continue
      const declared = msg.model
      if (declared && declared !== 'auto') return declared
      const billed = msg.id ? usageByMessageId[msg.id]?.model : undefined
      if (billed && billed !== 'auto') return billed
    }
    return currentModel
  }, [messages, usageByMessageId, currentModel])
  // ChatMode 4 态(2026-07-28 移除独立 PlanActToggle):订阅 currentMode 用于动态切换输入框 placeholder
  const currentMode = useModeStore((s) => s.currentMode)
  // 登录弹窗打开状态(2026-07-31 立,双重保险):
  // AgentTaskProgressPane 内部已订阅 isLoginOpen 并 return null,但用户反馈"修了好几遍"
  // 仍未生效(可能 HMR 边界 / 父组件未订阅导致 zustand 通知链断裂)。
  // 父组件 AISidePanel 也订阅 isLoginOpen,登录弹窗打开时不渲染 AgentTaskProgressPane,
  // 双重保险确保 pane 不会浮在 z-modal(2000) 遮罩之上清晰高亮显示。
  const isLoginOpen = useLoginDialogStore((s) => s.isOpen)
  const { lastMessage } = useWebSocket()
  const lastWsRef = React.useRef<WSNotification | null>(null)

  // 2026-08-17 环境信息 / 终端 / 工作展示区三按钮(用户需求,对标 Cursor 右上角 env info 三件套)
  const toggleEnvInfo = useEnvironmentInfoStore((s) => s.togglePopover)
  const envInfoOpen = useEnvironmentInfoStore((s) => s.open)
  const toggleWorkPanel = useAiPanelStore((s) => s.toggleWorkAreaCollapsed)
  const workAreaCollapsed = useAiPanelStore((s) => s.workAreaCollapsed)
  // D182 工作面全屏(对标竞品 chatSession.headerActions enter/exitWorkspaceFullscreen):
  // 全屏 = AI 面板让位,work-area 占满;门槛 = 无活动会话(任务未开始)时禁用并提示
  const workAreaFullscreen = useAiPanelStore((s) => s.workAreaFullscreen)
  const setWorkAreaFullscreen = useAiPanelStore((s) => s.setWorkAreaFullscreen)
  // D183(2026-09-29 立,对标竞品 chatSession.headerActions.createDraftPullRequest):
  // 会话头部一键创建 Draft PR 写动作,与环境信息 popover 的只读 PR 状态展示互补。
  // 按需拉取 GitHub 仓库/分支状态(activeWorkspace 为准),POST /api/workspace/github/prs
  // (draft:true 透传 GitHub API);成功 toast 带 PR 链接并刷新环境快照,失败统一降级提示。
  // hooks 规则:组件下方有早退 return,本块必须留在所有 early return 之前(无条件执行)。
  const [creatingDraftPR, setCreatingDraftPR] = React.useState(false)
  const handleCreateDraftPR = React.useCallback(async () => {
    if (creatingDraftPR) return
    const wsPath = useAiPanelStore.getState().activeWorkspace?.path
    if (!wsPath) {
      toast.error(tc('headerActions.createDraftPullRequestFailed'))
      return
    }
    setCreatingDraftPR(true)
    try {
      await useEnvironmentInfoStore.getState().fetchGithubStatus(wsPath)
      const gh = useEnvironmentInfoStore.getState().githubStatus
      if (
        !gh?.isGithubRepo ||
        !gh.owner ||
        !gh.repo ||
        gh.ghConfigured !== true ||
        !gh.currentBranch ||
        !gh.defaultBranch
      ) {
        toast.error(tc('headerActions.createDraftPullRequestFailed'))
        return
      }
      const res = await fetchApi<{ html_url?: string }>('/api/workspace/github/prs', {
        method: 'POST',
        body: JSON.stringify({
          owner: gh.owner,
          repo: gh.repo,
          title: gh.currentBranch,
          head: gh.currentBranch,
          base: gh.defaultBranch,
          draft: true,
        }),
      })
      if (!res.success) throw new Error(res.error ?? 'create draft pull request failed')
      const prUrl = res.data?.html_url
      toast.success(tc('headerActions.createDraftPullRequestOk'), {
        description: prUrl,
      })
      // 刷新环境快照:popover/完整详情里的 PR 行随即从"无 PR"变为可点链接
      void useEnvironmentInfoStore.getState().fetchStatus(wsPath)
    } catch {
      toast.error(tc('headerActions.createDraftPullRequestFailed'))
    } finally {
      setCreatingDraftPR(false)
    }
  }, [creatingDraftPR, tc])
  const toggleTerminalDock = useTerminalDockStore((s) => s.toggle)
  const terminalDockOpen = useTerminalDockStore((s) => s.open)

  // 手机 / 平板 / 桌面三档一律由 bucket 派生(2026-11-11):此前 <640 用 useMediaQuery,
  // 640–1279 又单独一条 matchMedia,与 globals.css 的 media query 三处各自为政。
  const isMobileSmall = isSheet

  // 桌面端 + 停靠态:面板标题栏作为窗口拖拽把手(用户习惯抓任意顶部标题栏拖窗口)。
  // 浮窗态不接管——那时标题栏的职责是移动面板自身(handleFloatDragStart)。
  const { isDesktop } = useDesktop()
  const windowDragFromHeader = isDesktop && !isMobileSmall && !floatMode
  const handleHeaderWindowDragMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      if (!windowDragFromHeader || e.button !== 0) return
      // 同 handleFloatDragStart:Portal 内容会经 React 树冒泡到 header,不能当成窗口把手
      if (!e.currentTarget.contains(e.target as Node)) return
      if (!isDraggableBlankArea(e.target as HTMLElement)) return
      armWindowDragOnFirstMove(e.screenX, e.screenY)
    },
    [windowDragFromHeader],
  )

  // 形态档迁移(2026-11-11 重构;2026-11-11 二次收口抽出 planFormMigration):
  // - 进入 sheet/float 档:停靠位在本档不存在 ⇒ store 偏好必须落成 floatMode=true,
  //   否则 open=true 时组件仍按停靠渲染,而 CSS 在该区间把停靠容器隐藏(死态)。
  // - 回到 docked 档:只有「本档被动浮窗」才自动收回;用户手动点的浮窗保留。
  //   同时清掉浮窗期遗留的 floatMinimized(否则下次手动切浮窗直接掉成 FAB)。
  // - 任何浮窗形态:折叠工作区 / 工作面全屏都失去意义(浮窗不占 flex 位,
  //   工作区仍 hidden 会让整页变空),必须复位 —— 判据是「是否浮窗」,不是「是否离开停靠档」,
  //   否则在 docked 档手动切浮窗会悬在一片空白上。
  // 决策全在 lib/ai-panel-bucket 的纯函数里(可单测),这里只负责写回 store。
  const autoFloatRef = React.useRef(false)
  React.useEffect(() => {
    const store = useAiPanelStore.getState()
    const plan = planFormMigration(bucket, store, autoFloatRef.current)
    if (plan.floatMode !== null) setFloatMode(plan.floatMode)
    if (plan.floatMinimized !== null) setFloatMinimized(plan.floatMinimized)
    if (plan.floatCollapsed !== null) setFloatCollapsed(plan.floatCollapsed)
    autoFloatRef.current = plan.autoFloated
    if (plan.resetWorkAreaCollapsed) store.toggleWorkAreaCollapsed()
    if (plan.resetWorkAreaFullscreen) store.setWorkAreaFullscreen(false)
  }, [bucket, floatMode, setFloatMode, setFloatMinimized, setFloatCollapsed])
  const [loadingHistory, setLoadingHistory] = React.useState(false)
  const [conversationTitle, setConversationTitle] = React.useState<string | null>(null)
  // D28 补齐层(2026-10-03):当前会话的**导入来源**。
  // importedFrom/importedVia 落库时写入 metadata 但此前全仓只写不读 —— 导入的会话
  // 与用户自建的 AI 对话在消息区同形,用户点开一条"像自己聊过"的会话实际读到的是
  // 外部记录(微信群聊 / Claude Code …),这是幻觉级误导,必须在消息区显式交代来源。
  // null = 非导入会话(自建)⇒ 什么都不渲染,不用"未知来源"占位。
  const [importProvenance, setImportProvenance] = React.useState<ImportProvenance | null>(null)
  // 「用场景分析」弹窗开合(仅导入会话可见入口;弹窗本体按需 dynamic 加载)
  const [analysisOpen, setAnalysisOpen] = React.useState(false)
  const [workspaceName, setWorkspaceName] = React.useState<string | null>(null)
  // #11 切换会话 LRU + #8 向上翻页态(2026-10-21 窗格化):缓存键 = 窗格 + 会话二元身份,
  // 与 ChatPaneBody 共用 useConversationPaneCache 这一份出口(根窗格不挂 Provider ⇒ 桶归档到
  // ROOT_PANE_ID)。此前键只有 conversationId,根与非根承载同一条会话时互相顶掉快照,
  // 且非根窗格零缓存、每次切换全量重取。翻页态(游标/hasMore/loadingMore)随同一身份走。
  const {
    read: readConversationCache,
    write: writeConversationCache,
    patch: patchConversationCache,
    resetPager,
    oldestCursorRef,
    hasMoreHistory,
    setHasMoreHistory,
    loadingMoreHistory,
    setLoadingMoreHistory,
  } = useConversationPaneCache()
  // P1-6 断点续传(2026-09-13 立;片3 2026-10-21 起):候选捕获 / 历史结算后续接 / 中止
  // 三条时序与 ChatPaneBody 同一份编排出口;根主体 = 根单例 useChatStore + paneId null,
  // 显式传进去(不靠函数内隐式回落)—— 谁承载会话,续接就落在谁身上。
  const resume = useResumeBranch(useChatStore, null, t)
  // 差距⑤遗留边界1(2026-10-30):同会话换 turn 重锚 —— 订阅"归属根窗格"的目标版本号,
  // ?turn= 变化即进下方 loadHistory effect 依赖重跑(peek 不消费、同值不广播 ⇒ 参数没变
  // 不重跑,StrictMode 双 effect 可重放的现状不破)。边界2:归属别窗格的目标不动本快照。
  const turnDeepLinkVersion = React.useSyncExternalStore(
    subscribeTurnDeepLink,
    () => getTurnDeepLinkVersionForPane(null),
    () => getTurnDeepLinkVersionForPane(null),
  )
  // prevConversationIdRef:跟踪上一次会话 ID,切换时把旧会话状态写入缓存
  const prevConversationIdRef = React.useRef<string | null>(null)
  // 性能修复(2026-07-25):原 const pathname = usePathname() 订阅在 AISidePanel 根,
  // 导致每次路由切换 AISidePanel 整树重渲染(连带 MessageList/MessageInput/ModelSelector 等)。
  // 改为下推到 <WorkspaceNameSync> 子组件,pathname 订阅只触发子组件(渲染 null,无开销)。
  // 父组件通过 setWorkspaceName callback 接收项目名,不订阅 pathname。

  // WebSocket 多端同步:统一处理 ai_response / ai_question / chat_question_answered / chat_message 四种事件
  // - ai_response:其他端 AI 回复 → append/replace assistant 消息(原有逻辑)
  // - ai_question:其他端 AI 主动提问 → setPendingQuestion 弹窗(P2 新增)
  // - chat_question_answered:其他端用户已回答 → clearPendingQuestion 关闭弹窗(P2 新增)
  // - chat_message:其他端聊天消息(用户消息/落盘回答)→ 按 id 去重追加(V2 #23 新增)
  React.useEffect(() => {
    if (!lastMessage || lastMessage === lastWsRef.current) return
    lastWsRef.current = lastMessage
    const currentConv = useChatStore.getState().conversationId

    // P2 多端同步:AI 主动提问(其他端收到 ai_question → 弹窗)
    if (isAIQuestion(lastMessage)) {
      const { conversationId, question } = lastMessage.data
      // 仅处理当前会话的事件(其他会话的提问不弹窗,避免干扰)
      if (conversationId && currentConv && conversationId !== currentConv) return
      // 运行时 Zod 校验:WS payload 可能因客户端版本差异 / 中间件篡改而异常,
      // 校验失败时不弹窗(避免脏数据进 store 导致 UI 崩溃)
      const pending = parsePendingQuestion(question)
      if (pending) {
        useChatStore.getState().setPendingQuestion(pending)
      }
      return
    }

    // P2 多端同步:AI 提问已回答(其他端收到 chat_question_answered → 关闭弹窗)
    if (isAIQuestionAnswered(lastMessage)) {
      const { conversationId, questionId } = lastMessage.data
      if (conversationId && currentConv && conversationId !== currentConv) return
      const pending = useChatStore.getState().pendingQuestion
      // 仅关闭匹配 questionId 的弹窗(避免误关其他提问)
      if (pending && pending.questionId === questionId) {
        useChatStore.getState().clearPendingQuestion()
      }
      return
    }

    // V2 #23 多端同步:聊天消息同步(其他端发送/保存的消息 → 本端追加或校正)
    // - 用户消息:其他端发出的 user 消息 → 按 id 去重后追加(本端乐观渲染用的是
    //   crypto.randomUUID 临时 id,与后端 DB id 必不相同,无重复风险)
    // - assistant 消息:chat_question_answered 场景的落盘回答 → 按 id 去重追加
    //   (流式中的占位由 ai_response 路径校正,这里只补「本端没流过」的持久化消息)
    if (isChatMessage(lastMessage)) {
      const { conversationId, message } = lastMessage.data
      if (conversationId && currentConv && conversationId !== currentConv) return
      if (!message?.id) return
      const store = useChatStore.getState()
      // id 已存在(本端已渲染)→ 零操作,防重复
      if (store.messages.some((m) => m.id === message.id)) return
      useChatStore.setState({
        messages: [
          ...store.messages,
          {
            id: message.id,
            role: message.role === 'assistant' ? ('assistant' as const) : ('user' as const),
            content: message.content,
            createdAt: message.createdAt ? new Date(message.createdAt).getTime() : Date.now(),
          },
        ],
      })
      return
    }

    // AI 回复多端同步(原有逻辑)
    if (!isAIResponse(lastMessage)) return
    const { conversationId, message, clientMessageId } = lastMessage.data
    if (conversationId && currentConv && conversationId !== currentConv) return

    if (message) {
      const store = useChatStore.getState()
      const placeholderId = clientMessageId ?? message.id
      const existing = store.messages.find((m) => m.id === placeholderId)
      if (existing) {
        useChatStore.setState({
          messages: store.messages.map((m) =>
            m.id === placeholderId
              ? {
                  id: message.id,
                  role: 'assistant' as const,
                  content: message.content,
                  createdAt: message.createdAt
                    ? new Date(message.createdAt).getTime()
                    : m.createdAt,
                  error: false,
                }
              : m,
          ),
        })
      } else if (message.role === 'assistant') {
        useChatStore.setState({
          messages: [
            ...store.messages,
            {
              id: message.id,
              role: 'assistant' as const,
              content: message.content,
              createdAt: message.createdAt ? new Date(message.createdAt).getTime() : Date.now(),
            },
          ],
        })
      }
    }
  }, [lastMessage])

  const setConversationId = useChatStore((s) => s.setConversationId)
  // 从 store 订阅当前会话(取代原 URL ?conversationId= 同步逻辑)
  const storeConversationId = useChatStore((s) => s.conversationId)

  // 监听 store.conversationId 变化加载历史会话
  // (AI 面板是全局 docked 组件,与 Sidebar 同性质;不再依赖 URL ?conversationId=,
  // 会话 ID 完全由 useChatStore 维护,切换会话由历史项点击 / 新建对话 等动作触发)
  // #11 LRU 缓存(2026-07-25 立,2026-10-21 窗格化:桶键 = 窗格 + 会话):
  // - 切换会话前:把旧会话的 messages + 分页状态写入缓存出口
  // - 缓存命中:同步从缓存恢复 store.messages(无闪烁),后台异步拉取最新消息对比更新
  // - 缓存未命中:正常拉取,拉取后写入缓存(淘汰上限与 LRU 提升都在 useConversationPaneCache 里)
  React.useEffect(() => {
    if (!allow) return
    if (!open) return

    // 切换会话前保存旧会话到缓存(LRU 由出口内部维护)
    const prevId = prevConversationIdRef.current
    if (prevId && prevId !== storeConversationId) {
      const currentStore = useChatStore.getState()
      if (currentStore.messages.length > 0) {
        writeConversationCache(prevId, {
          messages: currentStore.messages,
          hasMore: hasMoreHistory,
          oldestCursor: oldestCursorRef.current,
          // 差距⑤补全:窗口 provenance 随快照带走(切回时 store 已换会话,现值只能从缓存取)
          turnWindowed: currentStore.messagesTurnWindowed,
        })
      }
    }
    prevConversationIdRef.current = storeConversationId

    let cancelled = false

    // 2026-09-12 W1 修复(本地在途消息被历史快照覆盖 → 正文 / plan / terminal 卡片整条消失):
    // 历史拉取是异步的,期间本地可能已写入新消息(新建会话后 addMessage + 流式增量)。
    // 以 messages 数组引用是否变化作为"本地已被写入"的判据 —— zustand 每次 set 都生成新引用。
    // 后端在流式期间尚未持久化 assistant 消息,快照里不含它;此时若用远端快照整体覆盖
    // (或拉取失败时清空 / 把 conversationId 置 null),会把流式中的 assistant 消息抹掉,
    // 后续 setMessagePlanSteps / appendMessageTerminalTask 因找不到消息而静默落空。
    function isLocalMessagesChanged(before: ChatMessage[]): boolean {
      return useChatStore.getState().messages !== before
    }

    async function loadHistory(id: string) {
      // 差距④(2026-10-30 立):?turn= 深链 —— 有锚点目标时**绕过 LRU 缓存**直接走
      // around 居中窗口(缓存装的是"上次落点"的内容,与分享链接指向的轮次无关,
      // 复用会让锚点行不在窗口里、跳转落空)。半径 5 轮与服务端 window 默认同量级。
      // 锚点解析失败(404 / 抛错 / 窗口里没有请求的那一轮)⇒ 空态错误码,不改拉最新页。
      // 已知退化(登记):窗口就位后上翻分页停用(resetPager(null,false)) —— around
      // 通道断点是 turn 游标,与 handleLoadMoreHistory 的 getMessages keyset 游标
      // 不是同一空间,不得混灌;下翻(prevCursor)通道本窗格暂无消费面,同样不接。
      const deepLink = peekTurnDeepLink(id)
      if (deepLink) {
        setLoadingHistory(true)
        const localBefore = useChatStore.getState().messages
        try {
          const [convRes, histRes] = await Promise.all([
            getConversation(id),
            getConversationHistory(id, {
              aroundTurnId: String(deepLink.turnOrdinal),
              aroundWindow: 5,
            }),
          ])
          if (cancelled) return
          const decision = decideAroundLoad({
            ok: histRes.success,
            turns: histRes.success ? histRes.data.turns : [],
            turnOrdinal: deepLink.turnOrdinal,
          })
          if (decision.action === 'unresolved-empty') {
            if (!isLocalMessagesChanged(localBefore)) {
              useChatStore.setState(unresolvedTurnAnchorState())
            }
            resetPager(null, false)
            setLoadingHistory(false)
            return
          }
          if (histRes.success) {
            // 差距⑤补全:拍平处给每行盖 turn 序号 —— /history 读面的 turn 分组自带
            // 服务端盖章的 turnOrdinal,这是窗口行序号的唯一权威来源(窗口尾部续聊的
            // live 行不再从头计数:窗口是"居中"的,尾行未必是会话最新轮,猜不得)。
            const hydrated: ChatMessage[] = hydrateHistoryMessages(
              histRes.data.turns.flatMap((t) =>
                t.messages.map((msg) => ({ ...msg, turnOrdinal: t.turnOrdinal })),
              ),
            )
            // 在途消息守卫与常规路径同一把尺(见 isLocalMessagesChanged 头注)
            if (!isLocalMessagesChanged(localBefore)) {
              useChatStore.setState({
                messages: hydrated,
                messagesTurnWindowed: true,
                error: null,
              })
            }
            if (convRes.success) {
              setConversationTitle(convRes.data.conversation.title || null)
              const prov = readImportProvenance(convRes.data.conversation.metadata, hydrated)
              setImportProvenance(prov.kind === 'imported' ? prov.provenance : null)
              const meta = convRes.data.conversation.metadata as {
                pendingQuestion?: unknown
              } | null
              noteRuntimeCapabilities(meta)
              const pending = parsePendingQuestion(meta?.pendingQuestion)
              if (pending) {
                useChatStore.getState().setPendingQuestion(pending)
              } else {
                useChatStore.getState().clearPendingQuestion()
              }
            }
            resetPager(null, false)
            writeConversationCache(id, {
              messages: hydrated,
              hasMore: false,
              oldestCursor: null,
              turnWindowed: true,
            })
            // 锚点定位复用既有跳转机制(根窗格 = 单例;归属别窗格的深链由 ChatPaneBody
            // 投递该窗格的 ProgressJumpStore 实例,本支只处理根窗格目标):
            // MessageList 消费 pendingJump ⇒ scrollIntoView(center) + flashHighlight;
            // 跳转产生的滚动事件按 scrollTop 回退记成"用户上翻",跟随权自然解除,
            // 不会被贴底 effect 拽回底部(无需给滚动权威另开口子)。
            useProgressJumpStore.getState().requestJumpToMessage(decision.anchorMessageId)
            setLoadingHistory(false)
            return
          }
          return
        } catch {
          if (cancelled) return
          if (!isLocalMessagesChanged(localBefore)) {
            useChatStore.setState(unresolvedTurnAnchorState())
          }
          resetPager(null, false)
          setLoadingHistory(false)
          return
        }
      }

      // 缓存命中:同步从缓存恢复(无闪烁),后台异步拉取最新消息对比更新
      // (read 读到即提为最近使用,LRU 提升在出口内部完成)
      const cached = readConversationCache(id)
      if (cached) {
        // 同步填充 store(无 loading 状态,无闪烁);窗口 provenance 随快照恢复
        // (老条目无 turnWindowed 键 ⇒ false,与"完整页盖号"同形)
        useChatStore.setState({
          messages: cached.messages,
          messagesTurnWindowed: cached.turnWindowed ?? false,
          error: null,
        })
        resetPager(cached.oldestCursor, cached.hasMore)
        setLoadingHistory(false)

        // 后台异步拉取最新消息对比更新(不阻塞 UI,完成后覆盖缓存数据)
        void (async () => {
          // 记录拉取前的 messages 引用,识别拉取期间本地是否被写入(见 isLocalMessagesChanged)
          const localBefore = useChatStore.getState().messages
          try {
            const [convRes, msgRes] = await Promise.all([
              getConversation(id),
              // P1 #24 keyset 复合游标:initial 取最新页,nextCursor 为 base64url 复合游标(透明回传)
              getMessages(id, { direction: 'initial', pageSize: 50 }),
            ])
            if (cancelled) return
            if (convRes.success && msgRes.success) {
              // 差距⑤补全:最新页盖号(完整页计数 / 截断页整页 null,见 markPageTurnOrdinals)
              const hydrated: ChatMessage[] = hydrateHistoryMessages(
                markPageTurnOrdinals(msgRes.data.messages, msgRes.data.hasMore),
              )
              // 仅当当前仍在该会话、且拉取期间本地未被写入时才更新 store
              // (前者避免覆盖用户已切换到的新会话;后者避免覆盖流式中的在途消息)
              if (
                useChatStore.getState().conversationId === id &&
                !isLocalMessagesChanged(localBefore)
              ) {
                useChatStore.setState({
                  messages: hydrated,
                  messagesTurnWindowed: false,
                  error: null,
                })
                setConversationTitle(convRes.data.conversation.title || null)
                // D28 补齐层:来源标识要在消息**已就位**之后才算 —— 发言人清单/时间跨度
                // 是从 hydrated 上的消息现算的,用 msgRes 原始行算会和 store 实际内容脱节
                const prov = readImportProvenance(convRes.data.conversation.metadata, hydrated)
                setImportProvenance(prov.kind === 'imported' ? prov.provenance : null)
                resetPager(msgRes.data.nextCursor, msgRes.data.hasMore)
              }
              if (cancelled) return
              // 更新缓存为最新数据
              writeConversationCache(id, {
                messages: hydrated,
                hasMore: msgRes.data.hasMore,
                oldestCursor: msgRes.data.nextCursor,
                turnWindowed: false,
              })
              // 恢复挂起提问(从 metadata)
              const meta = convRes.data.conversation.metadata as {
                pendingQuestion?: unknown
              } | null
              // Runtime 插话能力声明(会话元数据载体):读到 boolean 才落库,
              // 读不到 = 未声明 ⇒ 输入区回落 false(不得把"没读到"当成"支持插话")。
              noteRuntimeCapabilities(meta)
              const pending = parsePendingQuestion(meta?.pendingQuestion)
              if (cancelled) return
              if (pending) {
                useChatStore.getState().setPendingQuestion(pending)
              } else {
                useChatStore.getState().clearPendingQuestion()
              }
            }
          } catch {
            // 后台拉取失败时保留缓存数据,不阻塞用户
          }
        })()
        return
      }

      // 缓存未命中:正常拉取
      setLoadingHistory(true)
      // 记录拉取前的 messages 引用,识别拉取期间本地是否被写入(见 isLocalMessagesChanged)
      const localBefore = useChatStore.getState().messages
      try {
        // #8 分页加载:direction=initial 返回最新 pageSize 条(keyset 模式,按 desc + reverse)
        const [convRes, msgRes] = await Promise.all([
          getConversation(id),
          getMessages(id, { direction: 'initial', pageSize: 50 }),
        ])
        if (cancelled) return
        if (convRes.success && msgRes.success) {
          // 差距⑤补全:最新页盖号(与缓存命中后台刷新支同一把尺)
          const hydrated: ChatMessage[] = hydrateHistoryMessages(
            markPageTurnOrdinals(msgRes.data.messages, msgRes.data.hasMore),
          )
          // 拉取期间本地已写入(新建会话后在途的 assistant 消息)时保留本地,
          // 不用远端快照覆盖 —— 否则正文 / plan / terminal 卡片会被整条抹掉。
          // 窗口标志与消息**同进同出**:守卫失败时 store 里还是旧列表,provenance 不得单独改写。
          if (!isLocalMessagesChanged(localBefore)) {
            useChatStore.setState({
              messages: hydrated,
              messagesTurnWindowed: false,
              error: null,
            })
          }
          setConversationTitle(convRes.data.conversation.title || null)
          // D28 补齐层:导入来源(与缓存命中路径同一判据/同一算法,见上)
          const prov = readImportProvenance(convRes.data.conversation.metadata, hydrated)
          setImportProvenance(prov.kind === 'imported' ? prov.provenance : null)
          // 记录分页游标:oldestCursor = 当前最旧一条 id,hasMoreHistory = 是否还有更早历史
          resetPager(msgRes.data.nextCursor, msgRes.data.hasMore)

          // 写入缓存(LRU 淘汰由出口内部完成)
          writeConversationCache(id, {
            messages: hydrated,
            hasMore: msgRes.data.hasMore,
            oldestCursor: msgRes.data.nextCursor,
            turnWindowed: false,
          })

          // P2 多端同步:从 conversation.metadata.pendingQuestion 恢复挂起状态
          // 场景:用户 A 在 web 提问后刷新页面 / 切换会话再切回 / 在其他端打开同一会话
          // 后端 /chat/questions 已把 pendingQuestion 写入 conversation.metadata(merge 模式)
          // 这里读取并还原弹窗,让用户能继续回答(不丢失挂起态)
          //
          // 运行时 Zod 校验:防止 DB metadata 被其他端写入异常结构 / 被外部篡改 / 字段
          // 类型不匹配导致前端崩溃。校验失败时降级为 clearPendingQuestion(不弹窗)。
          const meta = convRes.data.conversation.metadata as {
            pendingQuestion?: unknown
          } | null
          // Runtime 插话能力声明(与上方缓存命中路径同一入口、同一回落形态)
          noteRuntimeCapabilities(meta)
          const pending = parsePendingQuestion(meta?.pendingQuestion)
          if (pending) {
            useChatStore.getState().setPendingQuestion(pending)
          } else {
            // 无挂起提问或数据非法时清空(避免上一会话的弹窗残留 / 脏数据崩溃)
            useChatStore.getState().clearPendingQuestion()
          }
        } else if (!isLocalMessagesChanged(localBefore)) {
          // 拉取失败但期间本地已写入(新建会话后的在途流式消息)时按成功路径同等对待:
          // 保留本地消息与 conversationId,不做任何清空(见 isLocalMessagesChanged)
          setConversationId(null)
          useChatStore.setState({ messages: [], error: null })
          setConversationTitle(null)
          // D28 补齐层:会话被清空 ⇒ 来源标识一并撤下,不得留在下一个会话上
          setImportProvenance(null)
          useChatStore.getState().clearPendingQuestion()
        }
      } catch {
        if (!cancelled && !isLocalMessagesChanged(localBefore)) {
          // 同上:异常路径同样不得抹掉在途消息
          setConversationId(null)
          useChatStore.setState({ messages: [], error: null })
          setConversationTitle(null)
          // D28 补齐层:会话被清空 ⇒ 来源标识一并撤下,不得留在下一个会话上
          setImportProvenance(null)
          useChatStore.getState().clearPendingQuestion()
        }
      } finally {
        if (!cancelled) setLoadingHistory(false)
      }
    }

    if (storeConversationId) {
      // 重置分页状态(防止上一会话的游标残留)
      resetPager(null, false)

      // 2026-07-27 修复 React Hydration 失败导致 AI 回复未渲染:
      // 原 chat.ts onRehydrateStorage 在 persist 初始化时同步把 recentMessages.messages
      // 赋给 state.messages,因 localStorage 同步 API,赋值发生在 React hydration 之前,
      // 导致 SSR(messages=[]) 与客户端 hydration(messages=50 条) 不一致 → hydration mismatch
      // → React 丢弃服务端 DOM 重建 → store 状态错乱 → onDelta 更新旧引用 → AI 回复不渲染。
      // 修复:onRehydrateStorage 移除 messages 赋值,改为此处 useEffect(hydration 后) 预填充。
      // 条件:仅当 messages 为空(首次加载/无缓存)且 recentMessages 匹配当前会话时预填充,
      // 避免覆盖缓存命中的数据(loadHistory 内部会先检查缓存)。
      const currentStore = useChatStore.getState()
      if (
        currentStore.messages.length === 0 &&
        currentStore.recentMessages &&
        currentStore.recentMessages.conversationId === storeConversationId &&
        Array.isArray(currentStore.recentMessages.messages)
      ) {
        useChatStore.setState({
          messages: currentStore.recentMessages.messages,
          error: null,
        })
      }

      // P1-6 断点续传(2026-09-13 立):必须在 loadHistory 之前捕获 ——
      // 未落库的本地助手消息不在服务端快照里,loadHistory 会用快照整体覆盖 messages,
      // 覆盖后就再也找不到了。片3(2026-10-21):编排走 useResumeBranch(根主体 = 根单例 + paneId null)。
      resume.capture(storeConversationId)

      void loadHistory(storeConversationId).finally(() => {
        // 历史结算之后才续接;本轮已被切走/卸载(cancelled)就不再点火
        if (!cancelled) resume.runAfterHistory(storeConversationId)
      })
    } else {
      resume.capture(null)
      useChatStore.setState({ messages: [], error: null })
      setConversationTitle(null)
      setImportProvenance(null)
      resetPager(null, false)
    }

    return () => {
      cancelled = true
      // P1-6:切会话/卸载时中止在途续接,避免把旧会话的 token 写进新会话
      resume.abort()
    }
    // hasMoreHistory 用于切换会话前保存旧会话到缓存,但不放入依赖:
    // 避免 hasMoreHistory 变化触发 loadHistory 重载(分页加载由 handleLoadMoreHistory +
    // messages 同步 effect 处理缓存更新)
    // read/write/patch/resetPager 引用只随窗格身份变(useCallback),放进依赖不会多跑一轮
    // resume 出口的三个回调引用恒定(取词走 ref),进依赖不多跑一轮
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hasMoreHistory/oldestCursorRef 故意不进依赖,避免其变化触发 loadHistory 重载
  }, [
    storeConversationId,
    turnDeepLinkVersion,
    setConversationId,
    open,
    allow,
    readConversationCache,
    writeConversationCache,
    resetPager,
    resume,
  ])

  // 工作区按对话隔离(2026-09-04 立,响应"工作区设置完以后全部对话都是这个工作区"反馈):
  // 切换会话时把 activeWorkspace 换装为该会话绑定的工作区:
  // - 映射中已有绑定(含显式 null)→ 应用该值
  // - 从未绑定(老会话)→ 解绑,避免上一会话的工作区泄漏到本会话
  // - 无会话(新对话,conversationId=null)→ 不动,保留当前待绑定工作区
  // 绑定写回映射由 ai-panel store 的 setActiveWorkspace / bindWorkspaceToConversation 负责。
  // 注意:换装期间保留浏览器 handle 与 context 缓存(不清理),切回原会话立即可用。
  React.useEffect(() => {
    const panel = useAiPanelStore.getState()
    if (!storeConversationId) return
    const map = panel.conversationWorkspaces
    if (Object.prototype.hasOwnProperty.call(map, storeConversationId)) {
      const mapped = map[storeConversationId]
      if (panel.activeWorkspace?.path !== mapped?.path) {
        panel.setActiveWorkspace(mapped ?? null)
      }
    } else if (panel.activeWorkspace) {
      panel.setActiveWorkspace(null)
    }
  }, [storeConversationId])

  // #11 LRU 缓存同步(2026-07-25 立):
  // messages 变化时(用户发送新消息、收到 AI 回复、流式增量、WebSocket 多端同步等)
  // 同步更新当前会话缓存的 messages + 分页状态,确保下次切回时数据是最新的。
  // hasMoreHistory 变化时也同步(分页加载在 handleLoadMoreHistory 已单独处理,此处兜底)。
  // messages 从 useChatStore.getState() 获取最新值(避免闭包陈旧值),但依赖数组
  // 仍需包含 messages 以触发 effect(组件重渲染时 messages 引用变化触发依赖)。
  React.useEffect(() => {
    if (!storeConversationId) return
    patchConversationCache(storeConversationId, useChatStore.getState().messages)
  }, [storeConversationId, messages, hasMoreHistory, patchConversationCache])

  // #8 滚动到顶部加载更多历史消息(keyset 复合游标分页,P1 #24)
  // - 由 MessageList 在 scrollTop 接近 0 时触发
  // - 加载完成后 prepend 到 messages 头部,并保持视觉滚动位置(由 MessageList 内部处理)
  const handleLoadMoreHistory = React.useCallback(async () => {
    const convId = useChatStore.getState().conversationId
    const cursor = oldestCursorRef.current
    if (!convId || !cursor || loadingMoreHistory || !hasMoreHistory) return
    setLoadingMoreHistory(true)
    try {
      // keyset 模式:cursor 为服务端下发的 base64url 复合游标,direction=older 向前翻更早消息
      const res = await getMessages(convId, { cursor, direction: 'older', pageSize: 50 })
      if (!res.success) return
      const older = res.data.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: new Date(m.createdAt).getTime(),
        // 差距⑤补全:更早页头部仍可能被截断,序号未知 ⇒ null(翻到底时整体重盖,见下)
        turnOrdinal: null as number | null,
      }))
      // G-816010 分页结果双重复核:响应游标 == 请求游标 ⇒ 本次没有任何前进信息,收下它与
      // replay 不可区分(下次上翻发同一个游标、拿回同一页,账面每次加载都成功而更早的历史
      // 永远读不到)⇒ 停止补拉并按可重试失败上报,不当"成功且没有更多",也不静默。
      // 窗口首行权威复核需要"请求前/响应后对权威侧两段重读"通道,本仓今天没有 ⇒ 不传
      // windowFront,判据落 undetermined 按报名处理(模块头注约定),不默认"首行没动"。
      const advance = judgePageAdvance({
        requestCursor: cursor,
        responseCursor: res.data.nextCursor,
        responseHasMore: res.data.hasMore,
        rows: older,
      })
      if (advance.retryable) {
        // stopPaging:带着同一游标再发就是 replay;复位 hasMore 防止滚动反复触发同一次失败。
        setHasMoreHistory(false)
        toast.error(tcommon('loadFailed'))
        return
      }
      if (older.length === 0) {
        // 差距⑤补全:空尾批 + hasMore=false 同样是"已翻到底"事件 ⇒ 与下方同口径整体重盖
        if (res.data.hasMore === false) {
          useChatStore.setState((s) => ({
            messages: stampCompletePageTurnOrdinals(s.messages),
            messagesTurnWindowed: false,
          }))
        }
        resetPager(null, false)
        return
      }
      // prepend 到 messages 头部(时间正序,older 也是正序且早于当前所有消息)
      // 差距⑤补全:翻到最早页(hasMore=false)⇒ 整表自 turn 1 完整,按服务端口径
      // 整体重盖(此前各页的 null 一并洗掉);未到底则维持 null(不猜)。
      if (res.data.hasMore === false) {
        useChatStore.setState((s) => ({
          messages: stampCompletePageTurnOrdinals([...older, ...s.messages]),
          messagesTurnWindowed: false,
        }))
      } else {
        useChatStore.setState((s) => ({ messages: [...older, ...s.messages] }))
      }
      resetPager(res.data.nextCursor, res.data.hasMore)
      // #11 LRU 缓存同步(2026-07-25 立):分页加载更多后,更新缓存的 messages + oldestCursor + hasMore
      patchConversationCache(convId, useChatStore.getState().messages)
    } finally {
      setLoadingMoreHistory(false)
    }
    // tcommon 是 next-intl 取词函数,按本文件既有口径不进依赖(与上方 loadHistory effect 同形)。
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tcommon 取词函数按本文件口径不进依赖
  }, [
    loadingMoreHistory,
    hasMoreHistory,
    oldestCursorRef,
    patchConversationCache,
    resetPager,
    setHasMoreHistory,
    setLoadingMoreHistory,
  ])

  const handleNewChat = React.useCallback(() => {
    clearMessages()
    setConversationId(null)
    setConversationTitle(null)
    setImportProvenance(null)
    resetPager(null, false)
  }, [clearMessages, setConversationId, resetPager])

  // 标题显示优先级(用户规则):
  //   1. 用户在 AI 面板手动添加的本地工作区 → 显示 workspace.name(参考 主流 IDE 顶部 project selector)
  //   2. workspace 项目页 → 显示项目文件夹名(选择项目文件时显示项目文件夹名)
  //   3. 已加载任务 → 显示任务名称(只是单纯对话时显示对话任务命名)
  //   4. 兜底 → 显示"空工作区"(没有选择项目时显示空工作区)
  const displayTitle =
    activeWorkspace?.name ?? workspaceName ?? conversationTitle ?? tc('emptyWorkspace')

  // 新建任务统一入口(2026-08-29 迁移整合):
  // 面板 header"新建任务"按钮已移除,三个入口(侧边栏按钮/Ctrl+Shift+N/Tauri 桌面端快捷键)
  // 全部通过 global-shortcut:new-chat 事件汇入本监听器,行为完全一致(DRY 单点收敛):
  //   1. 流式中禁止新建:与侧边栏按钮 disabled={isStreaming} 语义一致,防止流式中途清空会话
  //   2. 面板未开时自动打开:任何入口 = "打开面板 + 新建会话"
  //   3. handleNewChat:清空消息/会话 ID/标题/分页状态(服务端历史保留,仅前端切回新会话)
  // 监听始终注册(去掉 if(!open)):面板关闭时组件仍挂载(return null,hooks/refs 存活),
  // 侧边栏"面板关闭→打开+新建"需立即收到事件,不能等面板重挂载后 effect 再注册。
  React.useEffect(() => {
    const onNewChat = () => {
      if (useChatStore.getState().isStreaming) return
      // 2026-11-11 重构:不再在这里特判 640–1279「抬浮窗」——
      // openPanel 已是桶感知的唯一出口(sheet/float 档强制浮窗并复位折叠/最小化),
      // 侧栏按钮 / 快捷键 / 任何路由触发的入口都走同一条规则,不会各写一份。
      openPanel()
      handleNewChat()
    }
    window.addEventListener('global-shortcut:new-chat', onNewChat)
    return () => window.removeEventListener('global-shortcut:new-chat', onNewChat)
  }, [handleNewChat, openPanel])

  // Alt+P / Option+P 快捷键:切换 Plan/Act 模式(2026-07-25 立,对标 主流 AI IDE SOLO Plan 快捷键)
  // 2026-07-28 升级:Plan/Act 概念合并到 ChatMode,Alt+P 改为在 ChatMode.plan ↔ ChatMode.build 间切换
  // - 仅当 AI 面板打开时生效,避免污染其他页面
  // - 不在输入框聚焦时触发(避免与 Alt+字母 输入特殊字符冲突)
  // - 与 /plan /act 斜杠命令联动(两入口都走 ChatMode)
  React.useEffect(() => {
    if (!open) return
    const onAltP = (e: KeyboardEvent) => {
      if (!e.altKey || e.key !== 'p' || e.ctrlKey || e.metaKey || e.shiftKey) return
      // 避免在 textarea/input 聚焦时触发(用户可能用 Alt 组合输入特殊字符)
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable)
      ) {
        return
      }
      e.preventDefault()
      // ChatMode:plan ↔ build 切换(语义对齐:plan=只读分析,build=正常执行)
      const next: ChatMode = useModeStore.getState().currentMode === 'plan' ? 'build' : 'plan'
      useModeStore.getState().setMode(next)
    }
    window.addEventListener('keydown', onAltP)
    return () => window.removeEventListener('keydown', onAltP)
  }, [open])

  // Ctrl+1/2/3/4 切换 ChatMode 4态(2026-07-28 立,补全三通道)
  // 2026-08-27 根因修复:此处监听移至 GlobalHooksProvider(根 Layout)统一消费
  // `global-shortcut:mode-*` 事件 —— 原实现在本组件条件 useEffect 里(open 且深层
  // 组件树 hydration 完成才挂载),非 /chat 页面被 use-global-shortcuts preventDefault
  // 却无功能,且 /chat hydration 未完成时按键静默丢失(E2E 偶发失败根因)。
  // 快捷键语义不变:Ctrl+1/2/3/4 → build/plan/review/spec,与 /命令 + AI 自动判断联动。

  // 拖拽调整宽度
  // 关闭态下拖拽手柄:先 openPanel 再开始 resize,实现"拖拽即打开"
  const handleResizeStart = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      const store = useAiPanelStore.getState()
      if (!store.open) {
        store.openPanel()
      }
      setResizing(true)
      const startX = e.clientX
      const startWidth = store.width
      const onMove = (ev: PointerEvent) => {
        const delta = ev.clientX - startX
        setWidth(startWidth + delta)
      }
      const onUp = () => {
        setResizing(false)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [setResizing, setWidth],
  )

  // ==================== 浮窗拖拽逻辑(2026-07-30 立 · 2026-11-11 重写)====================
  // 重写点(逐条对应实测缺陷):
  // 1) 钳制口径:原来水平用**停靠宽度** width(480) 算右边界 ⇒ 浮窗 360 被拖出可视区外;
  //    现在统一走 clampFloatPosition(浮窗自身尺寸 + 8px 边距)。
  // 2) 竖直越界:原来只留 120px,允许大半屏出界;现在按面板高度收口。
  // 3) 每帧写 store:现在 pointermove 只记坐标 + rAF 合帧,每帧最多一次 setState。
  // 4) pointerup 丢失导致 isResizing 卡住:现在起手 setPointerCapture,
  //    pointerup / pointercancel / lostpointercapture 三路都能收尾。
  // 5) sheet(<640)全屏、不可拖:本档直接不接管(标题栏无拖拽语义)。
  const floatDragRef = React.useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
    frame: number | null
    next: { x: number; y: number } | null
  } | null>(null)

  const handleFloatDragStart = React.useCallback(
    (e: React.PointerEvent) => {
      if (!floatMode || floatMinimized || isSheet) return
      if (e.button !== 0) return
      // 只认**本 header DOM 内**的按下。Radix 菜单/弹窗虽然 Portal 到 body,
      // 但 React 事件沿 **React 树** 冒泡 —— 菜单项的 pointerdown 照样会冒到这里。
      // 若此时抢占指针(setPointerCapture),菜单项的 pointerup/click 会被重定向到 header,
      // 表现为「点菜单项没反应」(2026-11-11 真机实测:pointerdown=menuitem,
      // pointerup/click=HEADER,菜单不关、onSelect 不触发)。
      if (!e.currentTarget.contains(e.target as Node)) return
      // 空白区判定走共享词表(按钮/输入/[role=button] 等交互件一律不接管),
      // 再额外排除右缘分隔条:它的 pointerdown 属于调宽,不是移窗。
      const target = e.target as HTMLElement
      if (!isDraggableBlankArea(target, '[role="separator"]')) return

      // 用户重新拖面板 = 面板重新成为「收起落点」的真相源:作废图标独立坐标。
      // 否则下次最小化时图标会跳回上一次拖它的位置,而不是贴着面板左下角。
      setFloatFabPosition(null)

      const rect = resolveFloatRect(
        useAiPanelStore.getState().floatPosition,
        getFloatAnchor(),
        window.innerWidth,
        window.innerHeight,
      )
      const el = e.currentTarget as HTMLElement
      e.preventDefault()
      try {
        el.setPointerCapture(e.pointerId)
      } catch {
        // 某些合成事件(jSDOM / 旧浏览器)没有 pointer capture,退回窗口监听
      }
      setResizing(true)
      floatDragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        originX: rect.x,
        originY: rect.y,
        frame: null,
        next: null,
      }

      const flush = () => {
        const drag = floatDragRef.current
        if (!drag) return
        drag.frame = null
        if (!drag.next) return
        const { x, y } = drag.next
        drag.next = null
        setFloatPosition({ x, y })
      }

      const onMove = (ev: PointerEvent) => {
        const drag = floatDragRef.current
        if (!drag || ev.pointerId !== drag.pointerId) return
        const { x, y } = clampFloatPosition(
          drag.originX + (ev.clientX - drag.startX),
          drag.originY + (ev.clientY - drag.startY),
          window.innerWidth,
          window.innerHeight,
        )
        drag.next = { x, y }
        if (drag.frame === null) drag.frame = window.requestAnimationFrame(flush)
      }

      const finish = (ev?: PointerEvent) => {
        const drag = floatDragRef.current
        if (!drag) return
        if (ev && ev.pointerId !== drag.pointerId) return
        if (drag.frame !== null) {
          window.cancelAnimationFrame(drag.frame)
          drag.frame = null
        }
        // 收尾补一次最终位置(rAF 可能还没跑),避免松手瞬间回弹到上一帧。
        // 落点统一过 snapFloatPosition:贴到左右边距 24px 内自动吸住,中间位置不动。
        if (drag.next) {
          setFloatPosition(
            snapFloatPosition(drag.next.x, drag.next.y, window.innerWidth, window.innerHeight),
          )
        }
        floatDragRef.current = null
        setResizing(false)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', finish)
        window.removeEventListener('pointercancel', finish)
        el.removeEventListener('lostpointercapture', finish)
        try {
          el.releasePointerCapture(drag.pointerId)
        } catch {
          // 已释放或无 capture:忽略
        }
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', finish)
      window.addEventListener('pointercancel', finish)
      el.addEventListener('lostpointercapture', finish)
    },
    [floatMode, floatMinimized, isSheet, setFloatPosition, setResizing, setFloatFabPosition],
  )

  // ─── FAB(最小化图标)拖拽(2026-11-11 补)───
  // 用户反馈「最小化后的图标拖不动」:此前 FAB 是纯按钮,没有任何位移入口。
  // 它是面板收起后的落点,必须能挪走(否则挡住页面内容时只能点开→拖面板→再最小化)。
  // 位置单独记账(floatFabPosition),**不**复用 floatPosition:浮窗 360×600 的钳制
  // 会把 48px 圆钮锁在左侧 360px 带内,拖到右半屏会表现为「拖不动」。
  const fabDragRef = React.useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
    frame: number | null
    next: { x: number; y: number } | null
    moved: boolean
  } | null>(null)
  /** 拖过之后的松手不触发展开(位移 ≥3px 即视为拖拽,滤掉点击手抖) */
  const fabClickSinkRef = React.useRef(false)

  const handleFabDragStart = React.useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      // 手机 FAB 贴安全区左下固定位(56px):触摸拖拽与点击/滚动冲突,本档不接管
      if (isMobileSmall || e.button !== 0) return
      const state = useAiPanelStore.getState()
      const rect = resolveFloatRect(
        state.floatPosition,
        getFloatAnchor(),
        window.innerWidth,
        window.innerHeight,
      )
      // 起点 = FAB 当前真实位置(拖过用记账值,没拖过 = 浮窗矩形左下角)
      const origin = state.floatFabPosition ?? {
        x: rect.x,
        y: rect.y + Math.max(0, rect.height - AI_FAB_SIZE),
      }
      const el = e.currentTarget
      e.preventDefault() // 按住图标不应开始选中页面文字
      fabClickSinkRef.current = false
      try {
        el.setPointerCapture(e.pointerId)
      } catch {
        // 合成事件 / 旧浏览器没有 pointer capture:退回窗口监听(与浮窗拖拽同款)
      }
      fabDragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        originX: origin.x,
        originY: origin.y,
        frame: null,
        next: null,
        moved: false,
      }

      const flush = () => {
        const drag = fabDragRef.current
        if (!drag) return
        drag.frame = null
        if (!drag.next) return
        const { x, y } = drag.next
        drag.next = null
        setFloatFabPosition({ x, y })
      }

      const onMove = (ev: PointerEvent) => {
        const drag = fabDragRef.current
        if (!drag || ev.pointerId !== drag.pointerId) return
        const dx = ev.clientX - drag.startX
        const dy = ev.clientY - drag.startY
        if (!drag.moved && Math.hypot(dx, dy) >= 3) drag.moved = true
        if (!drag.moved) return
        drag.next = clampFabPosition(
          drag.originX + dx,
          drag.originY + dy,
          window.innerWidth,
          window.innerHeight,
        )
        if (drag.frame === null) drag.frame = window.requestAnimationFrame(flush)
      }

      const finish = (ev?: PointerEvent) => {
        const drag = fabDragRef.current
        if (!drag) return
        if (ev && ev.pointerId !== drag.pointerId) return
        if (drag.frame !== null) {
          window.cancelAnimationFrame(drag.frame)
          drag.frame = null
        }
        // 收尾补最终位置并吸边(rAF 可能还没跑,否则松手瞬间回弹一帧)
        if (drag.next) {
          setFloatFabPosition(
            snapFabPosition(drag.next.x, drag.next.y, window.innerWidth, window.innerHeight),
          )
        }
        if (drag.moved) {
          // 松开后浏览器仍会补发 click:吞掉它,否则「拖一下就自己展开」
          fabClickSinkRef.current = true
          window.setTimeout(() => {
            fabClickSinkRef.current = false
          }, 0)
        }
        fabDragRef.current = null
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', finish)
        window.removeEventListener('pointercancel', finish)
        el.removeEventListener('lostpointercapture', finish)
        try {
          el.releasePointerCapture(drag.pointerId)
        } catch {
          // 已释放或无 capture:忽略
        }
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', finish)
      window.addEventListener('pointercancel', finish)
      el.addEventListener('lostpointercapture', finish)
    },
    [isMobileSmall, setFloatFabPosition],
  )

  // 卸载时兜底:清掉挂起的 rAF,避免卸载后 setState
  React.useEffect(
    () => () => {
      const drag = floatDragRef.current
      if (drag && drag.frame !== null) window.cancelAnimationFrame(drag.frame)
      floatDragRef.current = null
      const fabDrag = fabDragRef.current
      if (fabDrag && fabDrag.frame !== null) window.cancelAnimationFrame(fabDrag.frame)
      fabDragRef.current = null
    },
    [],
  )

  // 视口变化重新收口(2026-11-11 修):此前 resize 后浮窗坐标原样保留,
  // 窗口缩小即整块跑出视口外。锚点未初始化(-1)时无需处理(渲染时按新视口重算)。
  // FAB 的独立位置同样要收口(否则窗口缩小后小圆钮留在视口外,用户以为它消失了)。
  React.useEffect(() => {
    if (!floatMode || isSheet) return
    const onResize = () => {
      const pos = useAiPanelStore.getState().floatPosition
      // 锚点未初始化(-1)时无需回写:渲染时按新视口重算
      if (pos.x >= 0 || pos.y >= 0) {
        const next = clampFloatPosition(
          pos.x < 0 ? 0 : pos.x,
          pos.y < 0 ? 0 : pos.y,
          window.innerWidth,
          window.innerHeight,
        )
        if (next.x !== pos.x || next.y !== pos.y) setFloatPosition(next)
      }
      const fabPos = useAiPanelStore.getState().floatFabPosition
      if (fabPos) {
        const nextFab = clampFabPosition(
          fabPos.x,
          fabPos.y,
          window.innerWidth,
          window.innerHeight,
        )
        if (nextFab.x !== fabPos.x || nextFab.y !== fabPos.y) setFloatFabPosition(nextFab)
      }
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [floatMode, isSheet, setFloatPosition, setFloatFabPosition])

  // ─── 浮窗焦点接力(2026-11-11 a11y)───
  // FAB ⇄ 面板是两个互斥的 return 分支,切换时 React 会把焦点丢给 body —— 键盘用户下一次
  // Tab 又从页面顶部开始(role="dialog" 却没有焦点入口,等于声明了没兑现)。
  // 这里只在**用户主动切换**(点 FAB / 最小化 / 关闭)时搬焦点,自动跨档与首屏弹出不抢焦点。
  const panelRootRef = React.useRef<HTMLDivElement | null>(null)
  const fabRef = React.useRef<HTMLButtonElement | null>(null)
  const pendingFocusRef = React.useRef<'panel' | 'fab' | null>(null)

  // ─── 滚动位置保持(2026-11-11)───
  // 最小化/关闭会把面板整棵子树卸载(分支互斥),MessageList 重挂后回到最新一条。
  // 用户在读历史时点一下 FAB 再展开,位置就被抹掉。
  // 做法:面板开着时用**捕获阶段 scroll 监听**持续记账(不逐次扫描 DOM、不触发渲染);
  // 这样无论收起走的是哪个入口(标题栏按钮 / ⋯菜单 / 全局快捷键 / 手机下拉),
  // 都留下最后一次真实位置。重开后一帧盖回去,原本就在底部的交给列表自己的贴底逻辑。
  const savedScrollRef = React.useRef<{ top: number; conversationId: string | null } | null>(null)

  React.useEffect(() => {
    const root = panelRootRef.current
    if (!root || !open || floatMinimized) return
    const onScroll = (e: Event) => {
      const target = e.target as HTMLElement | null
      if (!target || typeof target.scrollTop !== 'number') return
      // 只认纵向可滚的主容器,排除内部小滚动条/横向容器
      if (target.scrollHeight - target.clientHeight <= 8) return
      savedScrollRef.current = {
        top: target.scrollTop,
        conversationId: useChatStore.getState().conversationId ?? null,
      }
    }
    // scroll 不冒泡 ⇒ 必须 capture 才能从面板根收到内部滚动
    root.addEventListener('scroll', onScroll, true)
    return () => root.removeEventListener('scroll', onScroll, true)
    // floatCollapsed:折叠成输入条时同样是整棵子树换分支,监听要跟着挂到新根上
  }, [open, floatMinimized, floatMode, floatCollapsed])

  React.useEffect(() => {
    if (!open || floatMinimized) return
    const saved = savedScrollRef.current
    if (!saved) return
    // 会话已切换 ⇒ 旧位置对新内容无意义,直接丢弃
    if (saved.conversationId !== (useChatStore.getState().conversationId ?? null)) {
      savedScrollRef.current = null
      return
    }
    const raf = window.requestAnimationFrame(() => {
      const el = findPanelScrollContainer(panelRootRef.current)
      // 当前分支还没有滚动容器(如折叠成输入条):保留记账,等下次展开再还原
      if (!el) return
      savedScrollRef.current = null
      const atBottom = saved.top >= el.scrollHeight - el.clientHeight - 8
      if (atBottom) return
      el.scrollTop = saved.top
    })
    return () => window.cancelAnimationFrame(raf)
    // floatCollapsed:收起/展开输入条也会让消息列表重挂,同样要还原
  }, [open, floatMinimized, floatCollapsed])

  const handleMinimize = React.useCallback(() => {
    pendingFocusRef.current = 'fab'
    // 有动效偏好时先把面板淡出,再切到 FAB 分支:直接 setFloatMinimized 会让整块面板
    // 瞬间消失(硬闪)。焦点接力 effect 依赖 floatMinimized,因此会同步延后到切换之后。
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      setFloatMinimized(true)
      return
    }
    setLeaving(true)
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current)
    leaveTimerRef.current = setTimeout(() => {
      leaveTimerRef.current = null
      setLeaving(false)
      setFloatMinimized(true)
    }, 280)
  }, [setFloatMinimized])

  const handleClosePanel = React.useCallback(() => {
    // 仅浮窗形态有 FAB 可接焦点;停靠态关闭后是 6px 手柄条,不搬焦点
    if (floatMode) pendingFocusRef.current = 'fab'
    closePanel()
  }, [closePanel, floatMode])

  /** 目标分支渲染出来后再搬焦点;尚未渲染(同一提交内被后续状态更新推迟)则留到下一轮 effect。 */
  React.useEffect(() => {
    const target = pendingFocusRef.current
    if (!target) return
    const el =
      target === 'panel'
        ? open && !floatMinimized
          ? panelRootRef.current
          : null
        : floatMode && (floatMinimized || !open)
          ? fabRef.current
          : null
    if (!el) return
    pendingFocusRef.current = null
    el.focus({ preventScroll: true })
  }, [open, floatMinimized, floatMode])

  // 浮窗 Esc = 收成 FAB(2026-11-11 补 a11y):只处理焦点在面板内的 Esc,
  // 不抢应用层(Esc 关弹窗 / 退出编辑)的既有语义。
  const handlePanelKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (!floatMode || e.defaultPrevented || e.key !== 'Escape') return
      if (e.nativeEvent.isComposing) return
      e.preventDefault()
      handleMinimize()
    },
    [floatMode, handleMinimize],
  )

  // ─── 手机全屏抽屉:下拉收起手势(2026-11-11)───
  // 只挂在标题栏(触摸滚动区在消息列表,互不抢占);标题栏的 touch-action:none 由
  // globals.css 的 `.ai-panel-root.fixed.inset-0 > aside > header` 提供,否则浏览器会把
  // 纵向手势判定成滚动并 pointercancel 掉。
  // 拖动过程直接写 DOM transform(不走 state):每帧重渲染整块面板会把流式消息一起拖慢。
  const swipeRef = React.useRef<{ pointerId: number; startY: number; dy: number } | null>(null)
  const swipeTimerRef = React.useRef<number | null>(null)
  const clearSwipeStyles = React.useCallback(() => {
    const el = panelRootRef.current
    if (!el) return
    el.style.transition = ''
    el.style.transform = ''
    el.style.opacity = ''
  }, [])
  React.useEffect(
    () => () => {
      if (swipeTimerRef.current !== null) window.clearTimeout(swipeTimerRef.current)
    },
    [],
  )

  const handleSheetSwipeStart = React.useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      // 鼠标只认主键;触摸/触控笔不区分 button
      if (e.pointerType === 'mouse' && e.button !== 0) return
      // Portal 里的菜单/弹窗会经 React 树冒泡到 header(见 handleFloatDragStart 同款注释):
      // 不拦就会在菜单项按下时抢指针,手机端点「⋯ → 最小化」直接失效。
      if (!e.currentTarget.contains(e.target as Node)) return
      // 标题栏里的按钮/菜单/输入不参与下拉,否则点「关闭」会变成拖拽
      const target = e.target as HTMLElement
      if (target.closest('button, a, input, textarea, [role="menuitem"], [role="dialog"]')) return
      const el = panelRootRef.current
      if (!el) return
      if (swipeTimerRef.current !== null) window.clearTimeout(swipeTimerRef.current)
      el.style.transition = 'none'
      swipeRef.current = { pointerId: e.pointerId, startY: e.clientY, dy: 0 }
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [],
  )

  const handleSheetSwipeMove = React.useCallback((e: React.PointerEvent<HTMLElement>) => {
    const swipe = swipeRef.current
    if (!swipe || swipe.pointerId !== e.pointerId) return
    const dy = Math.max(0, Math.min(e.clientY - swipe.startY, viewport.height))
    swipe.dy = dy
    const el = panelRootRef.current
    if (!el) return
    el.style.transform = `translate3d(0, ${dy}px, 0)`
    el.style.opacity = String(Math.max(0.4, 1 - dy / Math.max(240, viewport.height * 0.6)))
  }, [viewport.height])

  const handleSheetSwipeEnd = React.useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const swipe = swipeRef.current
      if (!swipe || swipe.pointerId !== e.pointerId) return
      swipeRef.current = null
      try {
        e.currentTarget.releasePointerCapture(swipe.pointerId)
      } catch {
        // 已释放:忽略
      }
      // 阈值跟着视口走(小屏 96px 起效,大屏最多 180px),太灵敏会误杀正常点击拖动
      const dismissThreshold = Math.max(96, Math.min(180, viewport.height * 0.15))
      const dismiss = swipe.dy >= dismissThreshold
      const el = panelRootRef.current
      if (el) {
        el.style.transition = 'transform 180ms ease-out, opacity 180ms ease-out'
        el.style.transform = dismiss ? 'translate3d(0, 100%, 0)' : ''
        el.style.opacity = dismiss ? '0' : ''
      }
      swipeTimerRef.current = window.setTimeout(() => {
        swipeTimerRef.current = null
        clearSwipeStyles()
        if (dismiss) handleClosePanel()
      }, 180)
    },
    [clearSwipeStyles, handleClosePanel, viewport.height],
  )

  // 性能修复(2026-07-25):WorkspaceNameSync 子组件渲染 null,内部订阅 usePathname,
  // 把项目名通过 onNameChange callback 回传给父组件(setWorkspaceName)。
  // pathname 变化只触发子组件重渲染,不触发 AISidePanel 根重渲染。
  // S5(2026-11-03 立):同型口径再走一次 —— "当前是不是公开文档路由"也由子组件订阅 pathname
  // 后回传**一个布尔**(面板根自己 usePathname 会把 2026-07-25 的根治抵消掉)。
  // 值只在跨 /docs 边界时翻转 ⇒ 非文档路由的面板零额外重渲染。
  const [publicDocsRoute, setPublicDocsRoute] = React.useState(false)
  const handlePublicDocsRoute = React.useCallback(
    (isPublicDocs: boolean) => setPublicDocsRoute(isPublicDocs),
    [],
  )
  // 游客(auth 已就绪且未登录)+ 手机视口 + 公开文档页 ⇒ 面板不得整屏抢占文档正文。
  // 已登录用户与非文档路由的条件项各自为假 ⇒ 行为逐字节不变。
  const guestQuietDocs = ready && !allow && isMobileSmall && publicDocsRoute
  const workspaceNameSync = (
    <WorkspaceNameSync onNameChange={setWorkspaceName} onPublicDocsRoute={handlePublicDocsRoute} />
  )

  // ─── D73 多任务窗格宿主侧:Hook 取值(2026-09-27 提到无条件位置)───
  // 这四行原本写在 1090 行的"打开态"分支里,而组件在 901/945/1041 有三处提前 return,
  // 于是 react-hooks/rules-of-hooks 判为"条件调用"(渲染路径不同 ⇒ Hook 次数不同)。
  // 下面四个都是纯 selector / 取文案的 Hook 调用,提前到所有 return 之前求值,
  // 不改变任何分支的渲染结果(消费点 d73Expanded / d73HandleSplit / header 仍在打开态)。
  // 窗格命名空间文案(shared/i18n 已入库 12 键,与容器同一 ns,零新增语言包改动)
  const tp = useTranslations('ai.pane.multiPane')
  const d73PaneTree = usePaneSplitStore((s) => s.tree)
  const d73SplitPane = usePaneSplitStore((s) => s.splitPane)
  const d73DropConversation = usePaneSplitStore((s) => s.dropConversation)

  // G-935 缺口B:布局树持久化恢复只发生在挂载后(首帧必须与服务端同构的单叶树)。
  // 恢复点必须在 AI 面板宿主而不是 PaneSplitContainer —— 单叶时容器尚未挂载,
  // 恢复后叶数>1 才会让容器出现。
  React.useEffect(() => {
    rehydratePaneSplitLayout()
  }, [])

  // 浮窗最小化态(或浮窗模式 + 面板关闭):渲染 FAB 按钮
  // 2026-11-11 修锚点不一致:原先「未初始化」贴视口左下、「拖拽过」贴面板左上 ⇒
  // 同一个小圆钮两套锚点,点最小化瞬间按钮跳位。现统一贴**浮窗矩形左下角**,
  // 与默认锚点(工作区左下、向上弹出)视觉连续。
  if (floatMode && (floatMinimized || !open)) {
    const fabSize = isMobileSmall ? 56 : AI_FAB_SIZE
    // 拖过的 FAB 用独立坐标;没拖过 = 浮窗矩形左下角(最小化瞬间视觉连续,不跳位)
    const fabX = !isMobileSmall && floatFabPosition ? floatFabPosition.x : floatBox.x
    const fabY =
      !isMobileSmall && floatFabPosition
        ? floatFabPosition.y
        : floatBox.y + Math.max(0, floatBox.height - fabSize)
    return (
      <>
        {workspaceNameSync}
        <button
          ref={fabRef}
          type="button"
          onPointerDown={handleFabDragStart}
          onClick={() => {
            // 拖拽松手补发的 click:吞掉,不展开(否则「拖一下就自己弹开」)
            if (fabClickSinkRef.current) {
              fabClickSinkRef.current = false
              return
            }
            // 焦点接力:面板分支挂载后把焦点送进对话框(见 pendingFocusRef 注释)
            pendingFocusRef.current = 'panel'
            // 从**拖过**的 FAB 展开:面板左下角对齐 FAB(贴右缘时自然变成右缘对齐)。
            // 这里**不**清空 floatFabPosition —— 清了就会在下次最小化时回落到
            // 「面板左下角」,被浮窗 360 宽度拉回左侧(2026-11-11 实测:icon 拖到 1058,
            // 展开后最小化跳回 746)。图标位置只在用户**重新拖面板**时作废。
            const fabPos = useAiPanelStore.getState().floatFabPosition
            if (fabPos && !isMobileSmall) {
              const { height } = getFloatSize(window.innerWidth, window.innerHeight)
              setFloatPosition(
                clampFloatPosition(
                  fabPos.x,
                  fabPos.y + fabSize - height,
                  window.innerWidth,
                  window.innerHeight,
                ),
              )
            }
            setFloatMinimized(false)
            setFloatCollapsed(false)
            openPanel()
          }}
          aria-label={tc('title')}
          className={cn(
            // 拖拽图标 = 当前对话模型入口:圆角走规范档位 rounded-sm(4px,角色 control,
            // 见 docs/UI_GUIDELINES.md §3 + design-tokens RADIUS_ROLES)。禁止 rounded-full。
            // 底色用卡面而非黑块:厂商图标是 currentColor 线稿,黑底会把深色图标吃掉。
            // transition 只列会变的属性:位置逐帧跟随指针,transition-all 会拖尾;
            // translate / scale 是 Tailwind v4 的独立属性,必须显式列出才有过渡。
            'fixed z-sticky grid place-items-center rounded-sm border border-border bg-card text-foreground',
            // 挂载入场(最小化 / 关闭后出现):淡入 + 由 0.9 放大,避免硬闪(见 animations.css)
            'ai-fab-in',
            'transition-[box-shadow,translate,scale]',
            'shadow-[0_1px_2px_rgba(0,0,0,0.06),0_8px_20px_-6px_rgba(0,0,0,0.22)]',
            // 悬浮:靠「抬得更高 + 投影明显加深扩散 + 微放大」拉开层级(白卡投影天生偏弱,
            // 只加 2px/浅阴影几乎看不出,实测后加大到 3px、24px/0.42 的扩散层)
            'hover:-translate-y-[3px] hover:scale-[1.02] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10),0_24px_48px_-12px_rgba(0,0,0,0.42)]',
            // 按住拖拽:压回去且略缩,投影收紧 —— 明确「被手指抓住」的反馈
            'active:translate-y-0 active:scale-[0.96] active:shadow-[0_1px_3px_rgba(0,0,0,0.10),0_6px_16px_-6px_rgba(0,0,0,0.26)]',
            // 手机:FAB 更大(56px 适合触屏),固定左下角(与桌面端浮窗默认位置一致)
            // 安全区:CSS 变量是 fixed 定位,不受 GlobalShell 的 pb-[env(safe-area-inset-bottom)]
            // 影响 —— 必须自己叠加,否则全面屏手势条会压住按钮(数字键盘弹出时尤其明显)
            isMobileSmall
              ? 'h-14 w-14 bottom-[calc(env(safe-area-inset-bottom)_+_1rem)] left-[calc(env(safe-area-inset-left)_+_1rem)]'
              : // 桌面/平板端:48px FAB,可拖拽(手机档固定位,不接管指针)
                'h-12 w-12 cursor-grab active:cursor-grabbing',
          )}
          style={
            isMobileSmall
              ? undefined
              : {
                  left: `${fabX}px`,
                  top: `${fabY}px`,
                }
          }
        >
          <BrandIconDeferred
            // 对话真实模型优先(messages 末条 model → 该条 usage 的实际模型 → 选择器)。
            // 厂商可识别 → 厂商图标;auto / 未知厂商 → BrandIcon 默认回落到项目 logo(智汇AI),
            // 这是产品定义:auto 代表智汇AI 自己的路由,用自家标识,不用通用 Bot。
            vendor={inferVendor(conversationModel)}
            size={isMobileSmall ? 30 : 26}
          />
        </button>
      </>
    )
  }

  // 浮窗折叠态:只显示输入框 + 展开按钮,点击展开拉出完整面板
  // 用户交互:Pin → 折叠态(只看输入框)→ 点击展开 → 完整面板(对话历史+header)
  // 2026-07-30:工具条与输入卡片融合(共享 border + bg-card),不再占独立行;
  // 按钮无额外 px,左间距 = 容器 px-1.5(6px)= 上下 py-1.5(6px),四向一致。
  // 2026-07-31 移动端适配:移动端折叠态全屏覆盖(与完整面板一致的 inset-0),
  // 避免小屏上小浮窗遮挡内容且难以操作。
  if (floatMode && floatCollapsed) {
    return (
      <TooltipProvider>
        <>
          {workspaceNameSync}
          <div
            ref={panelRootRef}
            tabIndex={-1}
            data-testid="ai-panel-root"
            role={floatMode ? 'dialog' : undefined}
            aria-label={floatMode ? tc('title') : undefined}
            onKeyDown={handlePanelKeyDown}
            className={cn(
              'ai-panel-root fixed z-sticky outline-none',
              // 折叠态是独立分支(独立 DOM 节点):从停靠/展开态切过来时靠 CSS 入场动效
              // 掩住落点跳变(见 animations.css),否则输入条会硬闪出来。
              'ai-surface-in-mount',
              isMobileSmall
                ? 'inset-0' // 手机:全屏覆盖
                : 'ai-float-glow rounded-xl', // 桌面/平板端:浮窗 + 品牌色光晕
            )}
            style={
              isMobileSmall
                ? guestQuietDocs
                  ? GUEST_DOCS_FLOAT_STYLE // 游客公开文档页:盒子下移,不抢文档正文
                  : undefined
                : {
                    width: floatBox.width,
                    left: `${floatBox.x}px`,
                    // 折叠态高度是内容自适应(只有输入条),因此锚**下沿**:
                    // 下沿 = 浮窗矩形下沿,展开时顶部向上长,视觉位置不跳。
                    bottom: `${Math.max(8, viewport.height - floatBox.y - floatBox.height)}px`,
                  }
            }
          >
            <aside
              aria-label={tc('title')}
              className={cn(
                'group flex flex-col overflow-hidden bg-shell-panel',
                isMobileSmall ? 'h-full w-full' : 'rounded-xl',
              )}
            >
              {/* 拖拽手柄(2026-11-11):属于**浮窗容器**顶部,不是输入卡片的内部零件。
                  之前错放在 MessageInput 的灰条里 —— 层级错了,看起来像输入框里的空元素。
                  手柄 + 空白都能拖(handleFloatDragStart 内部排除 button/输入件);
                  hover/按住时变长变深,提示"这里能抓"。 */}
              <div
                onPointerDown={handleFloatDragStart}
                className="mx-4 flex shrink-0 cursor-grab justify-center pb-1.5 pt-1.5 active:cursor-grabbing"
              >
                <span
                  aria-hidden="true"
                  className="h-1 w-10 rounded-full bg-border/70 transition-[width,background-color] duration-150 group-hover:w-12 group-hover:bg-foreground/30 group-active:w-12 group-active:bg-foreground/45"
                />
              </div>
              {/* 输入区(直接渲染 MessageInput,无 MessageList)
                  floatHeader = 浮窗按钮(展开/停靠/最小化),并入输入卡片顶部工具栏右侧 */}
              <MessageInput
                onSend={sendMessage}
                onStop={stop}
                isStreaming={isStreaming}
                placeholder={currentMode === 'plan' ? t('placeholderPlan') : t('placeholder')}
                sendLabel={t('send')}
                stopLabel={t('stop')}
                model={currentModel}
                onModelChange={setModel}
                modelLabel={t('model')}
                autoResolvedModel={conversationModel}
                forceToolbarText
                onFloatDragStart={handleFloatDragStart}
                onTriggerClick={() => setFloatCollapsed(false)}
                compactTop
                floatHeader={
                  <>
                    {/* 纯图标 + Tooltip(h-8 w-8 + h-3.5 图标,与工具栏 查看历史/权限模式/添加 统一)
                        2026-09-08 用户反馈:折叠态展开按钮文案应为"展开对话",与 docked 头部的
                        "进入浮窗模式"按钮(floatMode)区分,故用独立 key expandConversation */}
                    <Tooltip content={tc('expandConversation')}>
                      <IconButton
                        onClick={() => setFloatCollapsed(false)}
                        aria-label={tc('expandConversation')}
                      >
                        <ChevronUp />
                      </IconButton>
                    </Tooltip>
                    {/* 停靠位只在 docked(≥1280)存在:640–1279 / 手机档不渲染该按钮,
                        否则点了就是「面板凭空消失」(历史死态) */}
                    {bucket === 'docked' ? (
                      <Tooltip content={tc('dockPanel')}>
                        <IconButton
                          onClick={() => {
                            setFloatMode(false)
                            setFloatCollapsed(false)
                          }}
                          aria-label={tc('dockPanel')}
                        >
                          <PanelRightRounded />
                        </IconButton>
                      </Tooltip>
                    ) : null}
                    <Tooltip content={tc('minimize')}>
                      <IconButton onClick={handleMinimize} aria-label={tc('minimize')}>
                        <Minus />
                      </IconButton>
                    </Tooltip>
                  </>
                }
              />
            </aside>
          </div>
        </>
      </TooltipProvider>
    )
  }

  // 关闭态:仅渲染拖拽手柄(可拖拽打开),不渲染整个面板内容。
  // 2026-07-30 彻底根治:容器从 fixed 改为 flex 子元素(relative + shrink-0),
  // width:0 使容器在 flex 流中不占视觉空间;手柄 right-[-12px] 跨越容器右边缘 8px 命中。
  // py-2 与 MainShell 的 pt-2/mb-2 垂直对齐(8px 上下间距)。
  // 2026-07-31 移动端适配:加 hidden min-[640px]:block 让 docked 关闭态(手柄)在 < 640px 隐藏,
  // 避免 AISidePanel 在手机视口下占 400px 宽把 work-area 推到 viewport 外。
  // 2026-11-11 形态档重构:640–1279 归入 float 档(停靠位在该区间会压死内容区),
  // 与 lib/ai-panel-bucket 的断点严格一致;本分支只在 docked(≥1280)关闭态出现。
  // mobile 下 AI 面板入口改用浮窗 FAB(由 floatMode 路径独立渲染,不受此规则影响)。
  if (!open) {
    return (
      <>
        {workspaceNameSync}
        <div
          className="relative hidden h-full shrink-0 py-2 mr-1.5 min-[640px]:block"
          style={{ width: 0 }}
        >
          {/* 右侧拖拽手柄(关闭态):命中区 right-[-12px] w-2(8px),完全位于 work-area 一侧
          (容器右边缘 +4px ~ +12px),与 Sidebar 自身手柄(Sidebar 右边缘 -4px ~ +4px)空间错开,
          两个手柄各保留完整 8px 命中区,互不重叠冲突。
          原因:AISidePanel 容器 z-[calc(var(--z-base)+5)]=z-6 创建 stacking context,
          其内手柄 z-20 只在容器内有效,整体低于 Sidebar 手柄(根 context z-20)。
          若关闭态手柄与 Sidebar 手柄位置重合(都跨越 Sidebar 右边缘),会被 Sidebar 手柄完全遮挡,
          "拖拽即打开"失效。空间错开后,关闭态手柄在 work-area 一侧(+4~+12)可正常触发。
          内层 0.5px 线居中在命中区中心(容器右边缘 +8px 处),hover 时显现提示可拖拽打开 AI 面板。
          0.5px 线在 2x DPR 高分屏渲染为 1 物理像素;子像素 calc 避免奇数像素容器模糊。
          默认 opacity:0 完全隐藏,仅 hover 或拖拽时显现渐变色。 */}
          {/* 右侧拖拽手柄(关闭态):separator + onPointerDown = 实际可拖拽手柄,需 Tab 聚焦做无障碍可达性;
          文件顶部已有 eslint-disable 块注释覆盖此规则,此处不再重复行级注释。 */}
          <div
            onPointerDown={handleResizeStart}
            tabIndex={0}
            role="separator"
            aria-orientation="vertical"
            aria-label={tcommon('resize')}
            className="group absolute right-[-12px] top-3 bottom-3 z-20 w-2 cursor-col-resize outline-none"
          >
            <div
              className={cn(
                'absolute left-[calc(50%-0.25px)] top-0 bottom-0 w-0.5 -translate-x-1/2 resize-handle-line',
                isResizing && 'is-resizing',
              )}
            />
            {/* 关闭态 hover 竖向提示:文字从上至下显示"点击或向右拉出AI工作区",
            默认隐藏,hover/focus-within 命中区时与手柄渐变线同步 fade-in + translateX 弹出。
            CSS 类 .ai-panel-handle-tooltip 在 globals.css 中定义。
            pointer-events: none 保证不拦截手柄的点击/拖拽。
            通过 group:focus-within 让键盘 Tab 聚焦 separator 时也显示,实现无障碍可达性。 */}
            <div aria-hidden="true" className="ai-panel-handle-tooltip">
              {tc('handleHint')}
            </div>
          </div>
        </div>
      </>
    )
  }

  // ─── D73 多任务窗格宿主侧(G-100,方案见 .ihui-agent/tmp/d73-mount/README.md) ───
  /** 窗格承载上限(布局层容量决策留在宿主:超过即 capacityFull,由容器给"重试"入口) */
  const D73_MAX_PANES = 4

  // tp / d73PaneTree / d73SplitPane / d73DropConversation 已提到组件顶部无条件调用
  // (见 handleFloatDragStart 之后),此处只保留由它们派生的渲染判据。
  const d73Expanded = collectPaneLeaves(d73PaneTree).length > 1

  /**
   * 票60 步序四:根窗格继续承载全局单例主体(AISidePanel 的 useChat / 侧栏状态都在
   * 这一份上);非根窗格若已承载会话,挂 ChatPaneProvider + ChatPaneBody,读写落在
   * 该窗格独立 chat store;空窗格仍只显示承载标记(等侧栏拖入)。
   * 边界 2(2026-10-21 订正此前的假前提):服务端岔开那条腿**早就在** —— 路由
   * `POST /api/chat/conversations/:id/branch`(落点 apps/api/src/routes/chat.ts,归属校验按 §5
   * 把 authenticate 的 request.userId 显式作入参传进 branchConversationFrom),api-client 已导出
   * `branchConversation`(packages/api-client/src/endpoints/chat.ts),web 侧 send-message 已在调用它。
   * 所以"仓内无会话级 fork 路由、要补得走 §24"这句是错的。本票当下的 Fork 仍是「该窗格承载既有会话」
   * 的标记(= 同一会话的双视图);要不要把拆分语义改成真分叉(岔开出一个新会话)属产品定档,不是缺接口。
   */
  const d73ConversationBody = (_paneConversationId: string | null, inPane: boolean) => (
    <div
      className={cn('flex min-h-0 w-full flex-col overflow-hidden', inPane ? 'h-full' : 'flex-1')}
    >
      {/* 消息区(v6.3:加 relative 让 popover 可定位到本容器右上角) */}
      <div className="relative min-h-0 flex-1">
        {/* D28 补齐层:导入会话的来源交代 + 分析入口(槽位实现与非根窗格共用
            ImportProvenanceSlot,两处不会说不同的话)。
            自建会话(importProvenance === null)整块不渲染,不留占位。 */}
        {importProvenance && (
          <ImportProvenanceSlot
            provenance={importProvenance}
            onOpenAnalysis={() => setAnalysisOpen(true)}
          />
        )}
        <MessageList
          messages={messages}
          isStreaming={isStreaming}
          isLoading={loadingHistory}
          emptyTitle={
            chatError === TURN_ANCHOR_UNRESOLVED_ERROR ? t('turnAnchorUnresolvedTitle') : t('empty')
          }
          emptyHint={
            chatError === TURN_ANCHOR_UNRESOLVED_ERROR
              ? t('turnAnchorUnresolvedHint')
              : t('emptyHint')
          }
          emptyKind={chatError === TURN_ANCHOR_UNRESOLVED_ERROR ? 'anchor-unresolved' : 'welcome'}
          assistantLabel={t('assistant')}
          loadingLabel={t('loading')}
          hasMoreHistory={hasMoreHistory}
          loadingMoreHistory={loadingMoreHistory}
          onLoadMoreHistory={handleLoadMoreHistory}
          // W5 死链修复(2026-09-18):Inline Diff 卡的 Accept/Reject/批量/hunk 级回调
          // 此前在面板处断链(props 恒 undefined → 按钮不渲染),此处接通 useApplyDiff 通道
          onApplyDiff={applyDiff}
          onRejectDiff={rejectDiff}
          onApplyAllDiffs={applyAllDiffs}
          onRejectAllDiffs={rejectAllDiffs}
          onApplyPartialDiff={applyDiffSelection}
          onTemplateSelect={(content) => {
            useChatStore.setState({ draftInput: content })
          }}
          // Phase 18.2: 传递 subAgentActivities 到 MessageList,
          // 对话流 inline 渲染在最后一条 AI 消息下方(而非 AI 面板底部)
          subAgentActivities={subAgentActivities}
          // Phase 18.4: step budget(从 store 派生,目前用固定 60 上限)
          stepBudget={
            subAgentActivities.length > 0
              ? {
                  used: subAgentActivities.reduce((sum, a) => sum + a.completedSteps.length, 0),
                  total: 60,
                }
              : undefined
          }
          // 2026-11-08 立:提问内联卡跟随最后一条消息,处于滚动区内(非模态浮层)
          trailing={
            <InlineQuestionCard
              question={pendingQuestion}
              onSubmit={submitQuestionResponse}
              className="mb-2 px-1"
            />
          }
        />
        {/* Agent 任务进度 popover(v14:absolute 锚定到本容器右上角,不再 fixed 到视口)
                由 store.open 联动显隐,trigger 在 MessageInput 上方居中切换 store
                双重保险(2026-07-31):父组件 AISidePanel 也检查 isLoginOpen,
                登录弹窗打开时不渲染 pane,避免 z-popover(2001) 浮在 z-modal(2000) 遮罩之上 */}
        {!isLoginOpen && <AgentTaskProgressPane />}
        {/* 2026-08-17 环境信息 popover(同消息区右上角锚定,与 agent progress pane 互斥) */}
        <EnvironmentInfoPopover />
      </div>

      {/* Sub-agent 活动流:已移至 MessageList 中 inline 渲染(Phase 18.2,AI 工作台 风格)
            历史:此区域之前独立在 AI 面板底部,但 AI 工作台 的 subagent 卡片是 inline 在对话流中。
            为保持视觉一致性,所有 subagent 卡片现在统一在最后一条 AI 消息下方展示。 */}

      {/* W10 工具面板(2026-09-13 立):tab 化挂载 15 个孤儿组件(plan/tasks/progress/agents/
              background/swarm/orchestration/trace/checkpoints/tokens/spec/runtime),位于消息区与
              压缩状态栏之间,默认折叠 */}
      <AiSidePanelTools />

      {/* 压缩状态栏(2026-08-16 立):在输入框上方显示压缩进度和结果 */}
      <CompactionStatusBar />

      {/* P3 #43 成本协商 v1(2026-09-16 立):发送前成本预检估算 + 流后实际对比 */}
      <CostEstimateBar />

      {/* 输入区 */}
      <MessageInput
        onSend={sendMessage}
        onStop={stop}
        isStreaming={isStreaming}
        // 2026-07-28 升级:placeholder 切换依据从 planMode 改为 ChatMode
        // - ChatMode.plan → placeholderPlan(只读分析提示)
        // - 其他(build/review/spec)→ placeholder(默认)
        placeholder={currentMode === 'plan' ? t('placeholderPlan') : t('placeholder')}
        sendLabel={t('send')}
        stopLabel={t('stop')}
        model={currentModel}
        onModelChange={setModel}
        modelLabel={t('model')}
        autoResolvedModel={conversationModel}
        forceToolbarText
      />

      {/* AI 主动提问已改为消息流内联卡(MessageList trailing 插槽),不再渲染弹窗 */}
      {/* D28 补齐层:「用场景分析」弹窗。自建会话永不挂载(没有可选的来源族,
          场景推荐也无从判断),避免挂一个点开就是"无推荐"的空壳。 */}
      {importProvenance && (
        <ImportAnalysisDialog
          open={analysisOpen}
          onOpenChange={setAnalysisOpen}
          source={importProvenance.source}
        />
      )}
      {/* 工作区权限确认弹窗(2026-07-25 立,深度对标 Codex):
            用户绑定新工作区但 perm=null 时,WorkspaceSelector 写入 pendingPermissionSetup,
            这里弹 Dialog 让用户主动选择权限模式(完全访问/请求批准/替我审批),
            用户在弹窗中保存后:回写 activeWorkspace.mode + 清空 pendingPermissionSetup。 */}
      {pendingPermissionSetup && (
        <WorkspacePermissionDialog
          open={!!pendingPermissionSetup}
          onOpenChange={(open) => {
            if (!open) setPendingPermissionSetup(null)
          }}
          workspacePath={pendingPermissionSetup.path}
          workspaceName={pendingPermissionSetup.name}
          techStack={pendingPermissionSetup.techStack}
          onSaved={(perm) => {
            // 弹窗保存成功:回写 store.activeWorkspace.mode(已绑定 workspace 的 mode)
            if (activeWorkspace && activeWorkspace.path === perm.workspacePath) {
              setActiveWorkspace({ ...activeWorkspace, mode: perm.mode })
            }
            setPendingPermissionSetup(null)
          }}
        />
      )}

      {/* 底部 PowerShell 终端停靠面板(2026-08-17 立,open=false 时渲染 null) */}
      <AiTerminalDock />
    </div>
  )

  /** 侧栏会话拖入空窗格 = 该窗格承载此会话(标记)。null=成功;reason=失败(容器渲染 forkFailureView) */
  const d73ForkIntoPane = (
    conversationId: string,
    _paneId: string,
    knownConversations?: ReadonlySet<string>,
  ): ForkFailureReason | null => {
    if (knownConversations && !knownConversations.has(conversationId)) return 'conversationMissing'
    if (collectPaneLeaves(usePaneSplitStore.getState().tree).length >= D73_MAX_PANES)
      return 'capacityFull'
    return null
  }

  /** header 拆分入口:先把根窗格登记为承载当前会话(否则根格判空只显拖入占位),再向右拆 */
  const d73HandleSplit = () => {
    d73DropConversation(ROOT_PANE_ID, storeConversationId ?? 'global-current')
    d73SplitPane(ROOT_PANE_ID, 'right', null)
  }

  // D182 门槛态:无活动会话 = 任务未开始,审阅工作面不可用(禁用全屏入口并提示)
  const workspaceUnavailable = !storeConversationId

  return (
    <TooltipProvider>
      <>
        {workspaceNameSync}
        {/* P3 #34(2026-09-16 立):流式屏幕阅读器播报区(visually-hidden,aria-live=polite) */}
        <SrStreamAnnouncer />
        <VoiceStreamSpeaker />
        {/* D182:工作面全屏退出按钮 — 面板让位(display:none)后头部按钮不可达,
            退出入口经 portal 挂到 work-area 右上角,与 AgentTaskProgressPane 同容器同层级 */}
        {workAreaFullscreen &&
          !floatMode &&
          createPortal(
            <TooltipProvider>
              <div
                className="absolute right-3 top-14 z-sticky"
                data-testid="work-area-fullscreen-exit"
              >
                <Tooltip content={tc('headerActions.exitWorkspaceFullscreen')}>
                  <IconButton
                    onClick={() => setWorkAreaFullscreen(false)}
                    aria-label={tc('headerActions.exitWorkspaceFullscreen')}
                    className="border border-border bg-popover/90 shadow-sm"
                  >
                    <Minimize2 />
                  </IconButton>
                </Tooltip>
              </div>
            </TooltipProvider>,
            document.getElementById('work-area-portal-root') ?? document.body,
          )}
        <div
          // AI 面板容器(最外层,DevTools 可选中)
          // - docked 模式:relative + shrink-0 + py-2,flex 流内布局,mr-1.5 固定 6px 间距
          // - float 模式(桌面/平板):fixed 定位,z-sticky,可拖拽,品牌色微光浮窗视觉(ai-float-glow)
          //   rounded-xl 匹配内层 aside 圆角(光晕跟随圆角呈圆弧),去掉 py-2(浮窗无需上下间距)
          // - float 模式(手机 <640px):fixed inset-0 全屏覆盖,无光晕无圆角,最大化可用空间
          // data-testid="ai-panel-root":全局唯一最外层容器标识,DevTools / E2E 可直接选中
          // 2026-08-02 阈值修复:全屏覆盖仅手机(<640px)触发;640–1279 走浮窗(非全屏)。
          data-testid="ai-panel-root"
          // 浮窗 = 非模态对话框:补 role/aria-label + Esc 收起(2026-11-11 a11y)。
          // docked 不设 role(它是页面的一列,不是叠加在内容上的对话层)。
          // ref/tabIndex:浮窗态做程序化焦点落点(点 FAB 展开);ref 在停靠态也挂,
          // 因为「关闭面板」在停靠态同样会卸载子树,滚动位置保持需要收起前能拿到容器。
          ref={panelRootRef}
          tabIndex={floatMode ? -1 : undefined}
          role={floatMode ? 'dialog' : undefined}
          aria-label={floatMode ? tc('title') : undefined}
          onKeyDown={handlePanelKeyDown}
          // 2026-11-11:640–1279 的停靠容器由 globals.css 同名 media query 兜底隐藏,
          // 但状态机在该区间**只会渲染浮窗**(bucket=float),这条规则仅作水合前的一帧保护,
          // 不再是第二套"真相"——形态判定统一在 lib/ai-panel-bucket。
          // 显隐由 globals.css 的同名 media query 兜底(JS 跑之前首帧就正确 ⇒ 无 hydration CLS),
          // 与 Sidebar 的 data-viewport-collapsed 同款双层范式。
          // floatMode 态靠 CSS 排除 .ai-float-glow(浮窗本就该盖在内容之上,不收起)。
          // className 一个字未动 ⇒ check-ai-panel-mount-guards 的 7 个几何 token 判定不受影响。
          data-viewport-tablet-collapsed="true"
          className={cn(
            'ai-panel-root',
            // 程序化焦点落点不画外圈 focus ring(真正的可交互元素各自有自己的焦点样式)
            floatMode && 'outline-none',
            // 三态切换动效(见 animations.css):挂载入场 / 档位切换入场 / 最小化退场互斥,
            // 避免两个 transform 动画互相覆盖。
            leaving ? 'ai-panel-out' : cn(floatMode && 'ai-surface-in-mount', modeFx && 'ai-mode-in'),
            floatMode
              ? isMobileSmall
                ? 'fixed inset-0 z-sticky' // 手机浮窗:全屏覆盖
                : 'fixed z-sticky ai-float-glow rounded-xl' // 桌面/平板浮窗:品牌色光晕
              : cn(
                  'relative hidden h-full min-[640px]:block mr-1.5 py-2',
                  // 2026-08-17 工作展示区折叠:AI 面板 flex-1 占满右侧(替代固定 width)
                  workAreaCollapsed ? 'flex-1 min-w-0' : 'shrink-0',
                ),
          )}
          style={
            floatMode
              ? isMobileSmall
                ? guestQuietDocs
                  ? GUEST_DOCS_FLOAT_STYLE // 游客公开文档页:盒子下移,不抢文档正文
                  : undefined // 手机:无定位 style,全屏由 inset-0 控制
                : {
                    width: floatBox.width,
                    left: `${floatBox.x}px`,
                    top: `${floatBox.y}px`,
                    height: floatBox.height,
                    transition: floatTransition,
                  }
              : workAreaFullscreen
                ? // D182 工作面全屏:面板让位(inline display:none,优先级高于 min-[640px]:block),
                  // work-area flex-1 占满;退出入口见上方 portal 按钮
                  { display: 'none' }
                : workAreaCollapsed
                  ? {
                      flex: '1 1 0%',
                      width: 'auto',
                      transition: dockedTransition,
                    }
                  : {
                      width,
                      transition: dockedTransition,
                    }
          }
        >
          <aside
            aria-label={tc('title')}
            // Pane 默认锚点(2026-07-29 立):AgentTaskProgressPane 用这个 data-testid 找到 AI 面板容器
            // 作为 Pane 默认位置的视口坐标系锚点,空消息时也能定位(不再依赖 message-list-inline-panel)
            data-testid="ai-side-panel-aside"
            // AI 面板必须有独立 bg-shell-panel 背景:
            // 1) 卡片感:AI 面板作为独立 flex 子元素,需要自己的背景色形成卡片视觉边界;
            // 2) 暗色模式下的遮罩一致性:登录/SSO/认证授权弹窗打开时,z-modal=2000 遮罩(z-50 Dialog 也会盖)叠加在 AI 面板之上,
            //    若 AI 面板透明,内容透到变暗的 work-area 上,视觉上像"AI 面板高亮"未被遮罩盖住;有 bg-shell-panel 后,
            //    AI 面板背景独立变暗,真正"暗下去到背景里"。
            // 之前 commit 5d378c22e 担心"深色背景下默认滚动条轨道透出深色",但 message-list 已加 hover-scroll
            // (scrollbar-width: none + ::-webkit-scrollbar { display: none })完全隐藏滚动条,不会透色,
            // 恢复 bg-shell-panel 安全。
            className={cn(
              'flex h-full flex-col overflow-hidden bg-shell-panel',
              // 手机全屏浮窗:无圆角;桌面/平板浮窗 + docked:保持 rounded-xl
              // (手机端的安全区内边距由 globals.css 的 `.ai-panel-root.fixed.inset-0 > aside`
              //  统一给,别在这里再写一份 Tailwind padding —— 两处同时生效会出现双份来源)
              isMobileSmall && floatMode ? 'rounded-none' : 'rounded-xl',
            )}
          >
            {/* 标题栏(浮窗模式下可拖拽,手机全屏模式禁用拖拽) */}
            {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- 桌面端 Tauri 窗口按下即拖拽(鼠标专属交互,无法用键盘拖拽窗口);键盘用户走窗口原生快捷键 */}
            <header
              // 停靠态:原生拖拽区(按下即启动窗口移动循环,无 JS 往返延迟);
              // 浮窗态不加——该态标题栏的职责是移动面板自身(handleFloatDragStart)
              data-tauri-drag-region={windowDragFromHeader ? '' : undefined}
              onPointerDown={
                isMobileSmall && floatMode
                  ? handleSheetSwipeStart
                  : floatMode
                    ? handleFloatDragStart
                    : undefined
              }
              // 下拉手势只在手机全屏档接管;move/up/cancel 三路都要收,防止手指抬起在
              // 标题栏外时 transform 留在半途(pointer capture 让事件仍回到 header)。
              onPointerMove={isMobileSmall && floatMode ? handleSheetSwipeMove : undefined}
              onPointerUp={isMobileSmall && floatMode ? handleSheetSwipeEnd : undefined}
              onPointerCancel={isMobileSmall && floatMode ? handleSheetSwipeEnd : undefined}
              onMouseDown={handleHeaderWindowDragMouseDown}
              className={cn(
                'flex h-14 shrink-0 items-center gap-2 px-3',
                // 手机全屏:为顶部「下拉把手」提供定位上下文
                isMobileSmall && floatMode && 'relative',
                // 2026-07-19 中文 + 图标垂直对齐:主标题 span 视觉居中
                '[&>div>span:first-child]:translate-y-[var(--text-vcenter-offset)]',
                // 浮窗模式(桌面端):header 可拖拽,非交互区域 cursor-move
                // 移动端全屏模式:不可拖拽
                // 停靠态(桌面端):标题栏拖的是整个窗口,同样给 move 指针
                ((floatMode && !isMobileSmall) || windowDragFromHeader) && 'cursor-move',
              )}
            >
              {/* 下拉把手(仅手机全屏):给用户「这里可以往下甩」的可见暗示,
                  同时作为手势的可视锚点。pointer-events-none 保证它不抢事件的 target。 */}
              {isMobileSmall && floatMode && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-foreground/25"
                />
              )}
              {/* 图标:使用当前模型对应的厂商图标(替代通用 Sparkles)
              用户规则:这个图标应该显示对应项目图标或者模型图标
              容器去掉背景色,只显示内部图标本体(2026-07-19 用户反馈) */}
              <div className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/80">
                <BrandIconDeferred
                  vendor={inferVendor(currentModel)}
                  size={18}
                  className="text-foreground/80"
                />
              </div>
              <div
                // 同 header 的拖拽语义:标题文字区是这块 flex-1,不标属性就只走 JS 兜底
                // 路径(滞后约 40px)。按钮/徽章是兄弟节点,不受影响。
                data-tauri-drag-region={windowDragFromHeader ? '' : undefined}
                className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden"
              >
                <span className="flex min-w-0 items-center gap-1">
                  <span className="min-w-0 truncate text-body font-semibold">{displayTitle}</span>
                  {/* 会话累计 Token / 费用徽章(2026-09-07 工作线 A;2026-09-12 W4 成本真网计价):
                  hover 展开输入/输出/请求数明细,按 currentModel 查真实价目表计费 */}
                  <SessionUsageBadge
                    conversationId={storeConversationId}
                    isStreaming={isStreaming}
                    model={currentModel}
                  />
                </span>
              </div>
              {/* 工作区选择器(参考 主流 IDE 顶部 project selector):
              空工作区时显示 FolderPlus 入口,已绑定时显示 Folder 入口可切换/清除
              2026-09-17 修复:原先放在 overflow-hidden 标题容器内,displayTitle 占满宽度时
              IconButton 被裁半/遮挡;现移出到右侧按钮组最左,不再受 overflow-hidden 裁切 */}
              <WorkspaceSelector />
              {/* 会话导出/分享入口(W15)已迁移至侧边栏会话"..."菜单(sidebar-chat-history) */}
              {/* Plan/Act 模式切换(2026-07-24 立,对标 AI 工作台 plan/act toggle + Codex)
              2026-07-28 移除:PlanActToggle 按钮与 sidebar ModeSwitcher 4 态(ChatMode build/plan/review/spec)
              语义重叠,统一用 ModeSwitcher 控制。当前 mode 视觉指示由 sidebar ModeSwitcher 高亮态承载,
              切换入口:ModeSwitcher 4 态按钮 + Ctrl+1/2/3/4 快捷键 + /build /plan /review /spec 斜杠命令 +
              Alt+P 快捷键(plan ↔ build)。AI 面板 header 释放 32px 空间,布局更紧凑。
              2026-07-28 v2:移除 sidebar 4 按钮后,ModeSwitcher 文件已删除,模式视觉指示由
              message-input.tsx 的 CurrentModeBadge 承载(输入区上方小徽章),
              切换入口:/build /plan /review /spec 斜杠命令 + Ctrl+1-4 快捷键 + AI 自动判断(发送时)。
              Alt+P 快捷键保留(plan ↔ build 二选一场景,2026-07-28 仍有效)。 */}
              {/* 新建任务按钮(2026-08-29 移除,迁移整合):
              入口统一到侧边栏 SidebarQuickActions"新建任务"按钮。
              该按钮原有能力(handleNewChat 新建会话 + isStreaming 时禁用 + Tooltip 提示)
              已完整迁移到侧边栏按钮;侧边栏通过派发 global-shortcut:new-chat 事件
              复用本组件的 handleNewChat(监听器已改为始终注册,面板关闭时也能触发)。 */}
              {/* 派发 Subagent 按钮(2026-07-28 移除):
              subagent 现已改为自动派发(主 agent 在对话流中调用 dispatch_subagent 工具时,
              后端发 subagent_spawn/end SSE 事件 → 前端进度面板自动展示生命周期),
              无需用户手动触发,移除手动派发按钮。 */}
              {/* 2026-11-04 信息架构重构(对标 ChatGPT/Claude/Cursor 的 composer/panel 结构):
                  头部只保留「标题 + ⋯」。此前 10 枚 32px 功能按钮(停靠/浮窗/最小化/
                  环境信息/终端/工作展示区/工作面全屏/向右拆分/Draft PR/任务回顾/关闭)
                  全部收进单一溢出菜单 —— 窄屏不再需要按宽度逐枚隐藏,标题也不再被按钮挤没。
                  菜单项沿用原 data-testid,既有测试与自动化脚本可继续定位同一入口。
                  D182 的 role=group + 组名保留在外层容器上,读屏用户仍可感知这是一个动作组。 */}
              <div
                role="group"
                aria-label={tc('headerActions.panelGroupButtons')}
                className="flex shrink-0 items-center"
                data-testid="ai-panel-header-actions-group"
              >
                <DropdownMenu.Root modal={false}>
                  <Tooltip content={tc('headerActions.overflowMenu')}>
                    <DropdownMenu.Trigger asChild>
                      <IconButton
                        aria-label={tc('headerActions.overflowMenu')}
                        data-testid="ai-panel-overflow-trigger"
                      >
                        <MoreHorizontal />
                      </IconButton>
                    </DropdownMenu.Trigger>
                  </Tooltip>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content
                      align="end"
                      sideOffset={6}
                      collisionPadding={8}
                      className="pointer-events-auto z-[2200] min-w-[13rem] rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
                      data-testid="ai-panel-overflow-menu"
                    >
                      <DropdownMenu.Label className="px-2.5 pb-0.5 pt-1 text-[11px] font-medium text-muted-foreground">
                        {tc('headerActions.groupPanel')}
                      </DropdownMenu.Label>
                      {/* 浮窗模式切换(原头部第一枚):docked → 浮窗折叠态;float → 停靠。
                          停靠位只在 docked(≥1280)存在,其余两档不渲染 —— 否则点「停靠」
                          就是面板凭空消失(640–1279 的历史死态)。 */}
                      {bucket === 'docked' && (
                        <DropdownMenu.Item
                          data-testid="ai-panel-float-toggle"
                          className={HEADER_MENU_ITEM_CLASS}
                          onSelect={() => {
                            if (floatMode) {
                              setFloatMode(false)
                              setFloatMinimized(false)
                            } else {
                              setFloatMode(true)
                              setFloatMinimized(false)
                              setFloatCollapsed(true)
                              openPanel()
                            }
                          }}
                        >
                          {floatMode ? <PanelRightRounded left /> : <PictureInPicture2 />}
                          <span className="truncate">
                            {floatMode ? tc('dockPanel') : tc('floatMode')}
                          </span>
                        </DropdownMenu.Item>
                      )}
                      {floatMode && (
                        <DropdownMenu.Item
                          className={HEADER_MENU_ITEM_CLASS}
                          onSelect={handleMinimize}
                        >
                          <Minus />
                          <span className="truncate">{tc('minimize')}</span>
                        </DropdownMenu.Item>
                      )}
                      {/* 工作展示区开关:只有停靠态(≥1280)有「工作区挤压」这回事;
                          浮窗 / 手机档面板不占 flex 位,折叠工作区只会让整页变空 */}
                      {!floatMode && (
                        <DropdownMenu.Item
                          className={HEADER_MENU_ITEM_CLASS}
                          onSelect={() => toggleWorkPanel()}
                        >
                          <PanelRightRounded left={workAreaCollapsed} />
                          <span className="min-w-0 flex-1 truncate">
                            {workAreaCollapsed ? tc('openWorkPanel') : tc('closeWorkPanel')}
                          </span>
                          {!workAreaCollapsed && <Check className="h-3.5 w-3.5 shrink-0" />}
                        </DropdownMenu.Item>
                      )}
                      {/* D182 工作面全屏(仅 docked;浮窗本身是独立小窗,再全屏无意义) */}
                      {!floatMode && !workspaceUnavailable && (
                        <DropdownMenu.Item
                          data-testid="ai-panel-workspace-fullscreen"
                          className={HEADER_MENU_ITEM_CLASS}
                          onSelect={() => setWorkAreaFullscreen(!workAreaFullscreen)}
                        >
                          {workAreaFullscreen ? <Minimize2 /> : <Maximize2 />}
                          <span className="min-w-0 flex-1 truncate">
                            {workAreaFullscreen
                              ? tc('headerActions.exitWorkspaceFullscreen')
                              : tc('headerActions.enterWorkspaceFullscreen')}
                          </span>
                          {workAreaFullscreen && <Check className="h-3.5 w-3.5 shrink-0" />}
                        </DropdownMenu.Item>
                      )}
                      {/* 向右拆分:只在停靠态可用 —— 360px 浮窗内再分两栏,
                          每栏不到 170px,输入框必然溢出(历史缺陷:只排除了 <640) */}
                      {!d73Expanded && !floatMode && (
                        <DropdownMenu.Item
                          className={HEADER_MENU_ITEM_CLASS}
                          aria-label={tp('splitRight')}
                          onSelect={() => d73HandleSplit()}
                        >
                          <Columns2 />
                          <span className="truncate">{tp('splitRight')}</span>
                        </DropdownMenu.Item>
                      )}
                      <DropdownMenu.Separator className="my-1 h-px bg-border" />
                      <DropdownMenu.Label className="px-2.5 pb-0.5 pt-1 text-[11px] font-medium text-muted-foreground">
                        {tc('headerActions.groupTools')}
                      </DropdownMenu.Label>
                      {/* 环境信息 / 终端(原 2026-08-17 三按钮组):勾选态与原高亮态等价 */}
                      <DropdownMenu.Item
                        className={HEADER_MENU_ITEM_CLASS}
                        onSelect={() => toggleEnvInfo()}
                      >
                        <EnvInfoRounded checked={envInfoOpen} />
                        <span className="min-w-0 flex-1 truncate">{tc('envInfoButton')}</span>
                        {envInfoOpen && <Check className="h-3.5 w-3.5 shrink-0" />}
                      </DropdownMenu.Item>
                      <DropdownMenu.Item
                        className={HEADER_MENU_ITEM_CLASS}
                        onSelect={() => toggleTerminalDock()}
                      >
                        <SquareTerminal />
                        <span className="min-w-0 flex-1 truncate">{tc('openTerminal')}</span>
                        {terminalDockOpen && <Check className="h-3.5 w-3.5 shrink-0" />}
                      </DropdownMenu.Item>
                      <DropdownMenu.Separator className="my-1 h-px bg-border" />
                      <DropdownMenu.Label className="px-2.5 pb-0.5 pt-1 text-[11px] font-medium text-muted-foreground">
                        {tc('headerActions.groupSession')}
                      </DropdownMenu.Label>
                      {/* D176 任务回顾(菜单项形态,组件内部自带 Dialog;不再占头部槽位) */}
                      <TaskRecapEntry variant="menu-item" />
                      {/* D183 一键创建 Draft PR:仅 docked、且有可用工作区时出现 */}
                      {!floatMode && (!workspaceUnavailable || creatingDraftPR) && (
                        <DropdownMenu.Item
                          data-testid="ai-panel-create-draft-pr"
                          className={HEADER_MENU_ITEM_CLASS}
                          disabled={creatingDraftPR}
                          onSelect={(e) => {
                            // 保持菜单关闭后再跑异步动作,避免 loading 态留在已卸载的菜单里
                            e.preventDefault()
                            void handleCreateDraftPR()
                          }}
                        >
                          {creatingDraftPR ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <GitPullRequest />
                          )}
                          <span className="truncate">
                            {tc('headerActions.createDraftPullRequest')}
                          </span>
                        </DropdownMenu.Item>
                      )}
                      <DropdownMenu.Separator className="my-1 h-px bg-border" />
                      <DropdownMenu.Item
                        data-testid="ai-panel-close"
                        className={HEADER_MENU_ITEM_CLASS}
                        onSelect={handleClosePanel}
                      >
                        <X />
                        <span className="truncate">{tcommon('close')}</span>
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </div>
            </header>

            {/* D73 多任务窗格(G-100):未拆分时主体直挂(与挂载前逐字同构,观感零变化);
                拆分后由容器画窗格树,主体唯一、固定在根窗格,其余窗格为承载标记(边界 1)。
                2026-11-11:浮窗档(含手机)不画窗格树 —— 360px 里再分两栏每栏不到 170px,
                输入框必然溢出;拆分布局本身保留在 store 里,停靠回 ≥1280 自动复原。 */}
            {!allow ? (
              <AuthGatePrompt message={tGate('loginRequired')} />
            ) : d73Expanded && !floatMode ? (
              <div className="relative flex min-h-0 flex-1 flex-col" data-d73-host="">
                <PaneSplitContainer
                  renderPaneContent={(paneConversationId, paneId) =>
                    paneId === ROOT_PANE_ID ? (
                      d73ConversationBody(storeConversationId, true)
                    ) : paneConversationId ? (
                      <ChatPaneProvider paneId={paneId}>
                        <ChatPaneBody paneId={paneId} conversationId={paneConversationId} />
                      </ChatPaneProvider>
                    ) : (
                      <div
                        className="flex h-full flex-col items-center justify-center gap-1 px-3"
                        data-pane-marker={paneId}
                      >
                        <span className="text-label text-muted-foreground">{paneId}</span>
                      </div>
                    )
                  }
                  onForkConversation={d73ForkIntoPane}
                />
              </div>
            ) : (
              d73ConversationBody(storeConversationId, false)
            )}
          </aside>
          {/* 右侧拖拽手柄:外层 8px 命中区 right-[-4px] 居中跨越 aside 右边缘(左右各 4px),
        内层 0.5px 线 left-[calc(50%-0.25px)] -translate-x-1/2 居中在命中区中心,与 aside 右边缘重合。
        手柄置于 aside 外层(父 div),避免 overflow-hidden 裁剪命中区。
        0.5px 线在 2x DPR 高分屏渲染为 1 物理像素;子像素 calc 避免奇数像素容器模糊。
        默认 opacity:0 完全隐藏,仅 hover 或拖拽时显现渐变色。 */}
          <div
            onPointerDown={handleResizeStart}
            // 键盘可调(2026-11-11 a11y):role=separator + tabIndex 若只有指针拖拽,
            // 键盘用户能聚焦却无法操作。←/→ 调宽 16px(Shift 48px):
            // 面板在右侧,手柄左移 = 面板变宽,故 ArrowLeft 增宽。
            onKeyDown={(e) => {
              if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
              e.preventDefault()
              const step = (e.shiftKey ? 48 : 16) * (e.key === 'ArrowLeft' ? 1 : -1)
              setWidth(useAiPanelStore.getState().width + step)
            }}
            tabIndex={0}
            role="separator"
            aria-orientation="vertical"
            aria-label={tcommon('resize')}
            aria-valuenow={width}
            aria-valuemin={AI_PANEL_MIN_WIDTH}
            aria-valuemax={AI_PANEL_MAX_WIDTH}
            className={cn(
              'group absolute right-[-4px] top-3 bottom-3 z-20 w-2 cursor-col-resize outline-none',
              // 浮窗(含手机全屏)宽度固定由几何纯函数决定,拖宽度没有意义:
              // 原先只在 <640 隐藏,640–1279 / 桌面浮窗里这条手柄是「假交互」(只改停靠 width)。
              floatMode && 'hidden',
            )}
          >
            <div
              className={cn(
                'absolute left-[calc(50%-0.25px)] top-0 bottom-0 w-0.5 -translate-x-1/2 resize-handle-line',
                isResizing && 'is-resizing',
              )}
            />
            {/* 打开态手柄提示:文字"拖拽调整宽度"竖向显示,默认隐藏,
            hover/focus-within 命中区时与手柄渐变线同步 fade-in + translateX 弹出。
            CSS 类 .ai-panel-resize-tooltip 在 globals.css 中定义,定位在面板内(手柄左侧)
            避免遮挡 work-area。pointer-events: none 不拦截手柄的点击/拖拽。 */}
            <div aria-hidden="true" className="ai-panel-resize-tooltip">
              {tc('resizeHandleHint')}
            </div>
          </div>
        </div>
      </>
    </TooltipProvider>
  )
}

/**
 * WorkspaceNameSync 子组件(性能修复 2026-07-25)。
 *
 * 设计目的:把 usePathname 订阅从 AISidePanel 根下推到本子组件,
 * 避免每次路由切换 AISidePanel 整树重渲染(连带 MessageList /
 * MessageInput / ModelSelector 等重渲染)。
 *
 * - 内部订阅 usePathname + useEffect 拉取 workspace 项目名
 * - 通过 onNameChange callback 回传给父组件(setWorkspaceName)
 * - 渲染 null,无视觉开销
 * - 若 activeWorkspace 已绑定则跳过拉取(原逻辑保留)
 */
function WorkspaceNameSync({
  onNameChange,
  onPublicDocsRoute,
}: {
  onNameChange: (name: string | null) => void
  onPublicDocsRoute: (isPublicDocs: boolean) => void
}) {
  const pathname = usePathname()

  React.useEffect(() => {
    // 路由身份回传(2026-11-03 S5 票):公开文档路由判定留在本子组件,面板根只接一个布尔
    onPublicDocsRoute(isPublicDocsRoute(pathname))
    if (!pathname) {
      onNameChange(null)
      return
    }
    const m = pathname.match(/^\/workspace\/([^/]+)/)
    if (!m) {
      onNameChange(null)
      return
    }
    // activeWorkspace 已绑定时跳过 URL 项目名拉取,避免无谓网络请求
    if (useAiPanelStore.getState().activeWorkspace) {
      return
    }
    const projectId = m[1]!
    let cancelled = false
    void (async () => {
      try {
        const res = await fetchApi<{ project: { id: string; name: string } }>(
          `/api/workspace/projects/${encodeURIComponent(projectId)}`,
        )
        if (cancelled) return
        if (res.success && res.data?.project?.name) {
          onNameChange(res.data.project.name)
        } else {
          onNameChange(null)
        }
      } catch {
        if (!cancelled) onNameChange(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [pathname, onNameChange, onPublicDocsRoute])

  return null
}

export default AISidePanel
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
