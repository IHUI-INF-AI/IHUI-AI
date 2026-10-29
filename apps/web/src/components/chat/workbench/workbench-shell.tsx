// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

/**
 * /chat/workbench 全屏对话工作台壳(2026-10-28,"两形态共享内核";二档:接多窗格分屏)。
 *
 * 架构一句话:**壳是新的,内核全是现成的** ——
 * - 中央 = 票60 内核件 ChatPaneBody(MessageList + AiSidePanelTools + MessageInput +
 *   QuestionDialog + 历史加载 + 断线续接,一个都不重写),经 ChatPaneProvider 挂
 *   WORKBENCH_PANE_ID 的独立 pane store,与停靠侧栏(根单例)天然状态隔离;
 * - 分屏(片B)= 直接挂 PaneSplitContainer:同一棵全局布局树,委托面自接 ——
 *   根叶渲染工作台主体(URL 会话驱动),非根叶走叶 store 的 ChatPaneBody,rail 行
 *   draggable 拖入空叶由容器既有 dnd 承接;树⇆窗格实例回收接 useChatPaneSync;
 * - 左侧会话栏 = 薄行 rail(搜索/分组/行菜单直连共享出口,管理动作语义与 history 同源);
 * - 形态常量/深链拼装/选中判据/自动选中/分屏容量档 = chat-workbench-shell-spec 一份。
 *
 * 行为决定(如实标注):
 * ① 进入工作台收起停靠侧栏(同屏两份对话内核实例会并排显示同一会话,先收侧栏;
 *    用户仍可手动重新打开,不锁死);
 * ② URL 不带 conversationId 时自动选中"最近一条"(置顶优先;列表为空则落新任务欢迎面);
 * ③ 双宿主并挂(侧栏重新打开且树为多叶)时,两 host 各把"根叶"渲染成各自主体 ——
 *    布局树同源、状态不同源(根单例 vs 工作台 pane),视觉重复由用户动作引入,可接受;
 * ④ 新任务首发直发(workbench-new-task):发送编排全走 useChat 内核出口,建会话后
 *    由发送链(chatDeeplinkPath 钉)把 URL 换成工作台深链,壳无缝换装 ChatPaneBody。
 */
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Columns2, Loader2, Plus } from 'lucide-react'

import { ChatPaneBody } from '@/components/ai/chat-pane-body'
import { PaneSplitContainer } from '@/components/ai/pane-split-container'
import { ChatPaneProvider } from '@/stores/chat-pane-context'
import { useAiPanelStore } from '@/stores/ai-panel'
import { usePaneSplitStore } from '@/stores/pane-split'
import { useChatPaneSync } from '@/hooks/use-chat-pane-sync'
import { cn } from '@/lib/utils'
import { Button } from '@ihui/ui-react'
import { sortPinnedFirst } from '@ihui/shared'
import {
  collectPaneLeaves,
  ROOT_PANE_ID,
  type ForkFailureReason,
} from '@ihui/shared/chat/multi-pane'
import {
  WORKBENCH_LAYOUT,
  WORKBENCH_MAX_PANES,
  WORKBENCH_PANE_ID,
  WORKBENCH_ROUTE,
  pickAutoSelectConversationId,
  workbenchConversationHref,
} from '@ihui/shared/ui/chat-workbench-shell-spec'
import { StreamTelemetryBar } from '@/components/chat/workbench/stream-telemetry-bar'
import { useWorkbenchConversations } from '@/components/chat/workbench/use-workbench-conversations'
import { WorkbenchNewTask } from '@/components/chat/workbench/workbench-new-task'
import { WorkbenchPaneHeader } from '@/components/chat/workbench/workbench-pane-header'
import { WorkbenchSessionRail } from '@/components/chat/workbench/workbench-session-rail'

/** 大屏模式持久键:同一浏览器记住上次选择(纯观感偏好,不进服务端偏好表) */
const IMMERSIVE_STORAGE_KEY = 'ihui.workbench.immersive'

/** 大屏模式下的正文最大阅读宽度:宽屏居中、窄屏吃满(1040px 约 90 个中文字符/行) */
const IMMERSIVE_CENTER_CLASS = 'mx-auto w-full max-w-[1040px]'

export interface WorkbenchShellProps {
  /** 深链会话 id(已规整;null = 新任务/自动选中态) */
  conversationId: string | null
}

export function WorkbenchShell({ conversationId }: WorkbenchShellProps) {
  const router = useRouter()
  const t = useTranslations('chat')
  const { data, isLoading } = useWorkbenchConversations()
  // 大屏模式(2026-10-29 立):收起会话栏 + 正文居中限宽 + 顶部转成遥测指挥条。
  // 只改壳的布局与可见性,对话内核(ChatPaneBody)一个字节不动。
  const [immersive, setImmersive] = React.useState(false)
  React.useEffect(() => {
    try {
      setImmersive(window.localStorage.getItem(IMMERSIVE_STORAGE_KEY) === '1')
    } catch {
      // localStorage 不可用(隐私模式/被禁用)⇒ 保持默认形态,不影响对话
    }
  }, [])
  const toggleImmersive = React.useCallback(() => {
    setImmersive((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(IMMERSIVE_STORAGE_KEY, next ? '1' : '0')
      } catch {
        // 同上:偏好写不进去只影响下次进入时的默认值
      }
      return next
    })
  }, [])
  // 用户显式点了"新会话" ⇒ 本会话内不再自动抢选(② 的一次性开关)
  const [autoSelectSuppressed, setAutoSelectSuppressed] = React.useState(false)
  // 清台信号:每次点"新会话"+1;WorkbenchNewTask 在 >0 的变更时清 pane store 会话指针
  const [resetSeq, setResetSeq] = React.useState(0)

  // 片B:布局树与窗格实例账(全局一份;容器/回收都用它)
  const paneTree = usePaneSplitStore((s) => s.tree)
  const splitPane = usePaneSplitStore((s) => s.splitPane)
  const dropConversation = usePaneSplitStore((s) => s.dropConversation)
  // 树里消失的叶子 ⇒ chat/mode/timeline 等六座窗格实例随之回收(侧栏同款出口)
  useChatPaneSync(paneTree)
  const paneExpanded = collectPaneLeaves(paneTree).length > 1

  const items = React.useMemo(() => {
    const list = data?.conversations ?? []
    return sortPinnedFirst(
      [...list].sort(
        (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
      ),
    )
  }, [data])

  // ① 进入工作台收起停靠侧栏(只挂一次;open 态由 store 自查,不制造"每次都改一遍全局态"的抖动)
  React.useEffect(() => {
    if (useAiPanelStore.getState().open) {
      useAiPanelStore.getState().closePanel()
    }
  }, [])

  // ② 无深链 + 数据就绪 + 未显式要求新任务 ⇒ 自动续接最近会话(等价的"上次打开"体验)
  React.useEffect(() => {
    if (conversationId || isLoading || autoSelectSuppressed) return
    const auto = pickAutoSelectConversationId(items.map((c) => c.id))
    if (auto) router.replace(workbenchConversationHref(auto))
  }, [conversationId, isLoading, autoSelectSuppressed, items, router])

  const handleSelect = React.useCallback(
    (id: string) => {
      setAutoSelectSuppressed(false)
      if (id !== conversationId) router.push(workbenchConversationHref(id))
    },
    [conversationId, router],
  )

  const handleNewTask = React.useCallback(() => {
    setAutoSelectSuppressed(true)
    setResetSeq((n) => n + 1)
    router.replace(WORKBENCH_ROUTE)
  }, [router])

  /** 拆分入口:与侧栏 d73HandleSplit 同口径 —— 先把根叶登记为有承载,再向右拆 */
  const handleSplit = React.useCallback(() => {
    if (collectPaneLeaves(usePaneSplitStore.getState().tree).length >= WORKBENCH_MAX_PANES) return
    dropConversation(ROOT_PANE_ID, conversationId ?? 'global-current')
    splitPane(ROOT_PANE_ID, 'right', null)
  }, [conversationId, dropConversation, splitPane])

  /** 拖入分屏的叶侧校验(与侧栏检查同构:missing/capacity;真实落叶由容器 dropConversation 办) */
  const handleForkIntoPane = React.useCallback(
    (
      draggedConversationId: string,
      _paneId: string,
      known?: ReadonlySet<string>,
    ): ForkFailureReason | null => {
      if (known && !known.has(draggedConversationId)) return 'conversationMissing'
      if (collectPaneLeaves(usePaneSplitStore.getState().tree).length >= WORKBENCH_MAX_PANES) {
        return 'capacityFull'
      }
      return null
    },
    [],
  )

  /** 工作台主体(根叶/单叶共用):URL 驱动,与会话 store 解耦 */
  const workbenchMainBody = conversationId ? (
    <div className="min-h-0 flex-1">
      <ChatPaneBody paneId={WORKBENCH_PANE_ID} conversationId={conversationId} />
    </div>
  ) : (
    <div className="min-h-0 flex-1">
      <WorkbenchNewTask resetSeq={resetSeq} />
    </div>
  )

  /** 顶栏标题:命中会话行用行标题,未命中(深链先于列表到位)回退通用名 */
  const headerTitle = conversationId
    ? (items.find((c) => c.id === conversationId)?.title ?? t('title'))
    : t('newConversation')

  return (
    <div
      className={WORKBENCH_LAYOUT.shellClass}
      data-workbench-shell=""
      data-workbench-immersive={immersive ? 'true' : undefined}
    >
      {/* 左:薄会话栏(大屏模式下整体收起,退出入口在顶栏) */}
      {!immersive && (
        <aside className={WORKBENCH_LAYOUT.railClass}>
          <div className="flex items-center justify-between gap-2 px-3 pb-1 pt-3">
            <span className="min-w-0 truncate text-sm font-medium">{t('workbenchSessions')}</span>
            <span className="flex shrink-0 items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="gap-1 px-2"
                onClick={handleSplit}
                title={t('workbenchSplit')}
                aria-label={t('workbenchSplit')}
              >
                <Columns2 className="h-3.5 w-3.5" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="gap-1 px-2"
                onClick={handleNewTask}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                {t('newConversation')}
              </Button>
            </span>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              {t('loading')}
            </div>
          ) : (
            <WorkbenchSessionRail
              items={items}
              selectedId={conversationId}
              onSelect={handleSelect}
            />
          )}
        </aside>
      )}

      {/* 中:顶栏(URL 会话档)+ 主体;分屏展开时由容器托管叶(③ 双宿主语义如实) */}
      <main className={cn(WORKBENCH_LAYOUT.centerClass, immersive && IMMERSIVE_CENTER_CLASS)}>
        <ChatPaneProvider paneId={WORKBENCH_PANE_ID}>
          <WorkbenchPaneHeader
            title={headerTitle}
            immersive={immersive}
            onToggleImmersive={toggleImmersive}
          />
          <StreamTelemetryBar />
          <div className="relative flex min-h-0 flex-1 flex-col" data-workbench-host="">
            {paneExpanded ? (
              <PaneSplitContainer
                renderPaneContent={(leafConversationId, leafPaneId) =>
                  leafPaneId === ROOT_PANE_ID ? (
                    workbenchMainBody
                  ) : leafConversationId ? (
                    <div className="h-full min-h-0">
                      <ChatPaneProvider paneId={leafPaneId}>
                        <ChatPaneBody paneId={leafPaneId} conversationId={leafConversationId} />
                      </ChatPaneProvider>
                    </div>
                  ) : (
                    <div
                      className="flex h-full flex-col items-center justify-center gap-1 px-3 text-center"
                      data-pane-marker={leafPaneId}
                    >
                      <span className="text-xs text-muted-foreground">
                        {t('workbenchDropHere')}
                      </span>
                    </div>
                  )
                }
                onForkConversation={handleForkIntoPane}
              />
            ) : (
              workbenchMainBody
            )}
          </div>
        </ChatPaneProvider>
      </main>
    </div>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
