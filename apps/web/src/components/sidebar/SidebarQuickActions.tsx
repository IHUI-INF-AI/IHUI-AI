'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Plus, Package, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BTN_NEW_CONVERSATION_CLASS } from '@/lib/nav-styles'
import { Tooltip } from '@/components/feedback'
import { useAiPanelStore } from '@/stores/ai-panel'
import { useChatStore } from '@/stores/chat'

/**
 * 侧边栏顶部快捷操作区:新建任务 / 插件市场 / 自动化任务 三个按钮(展开态显示文字,折叠态只显图标)。
 * 从原 Sidebar.navContent 抽出,主组件直接渲染 <SidebarQuickActions />。
 */
export function SidebarQuickActions({
  collapsed,
  onCloseMobile,
}: {
  collapsed: boolean
  onCloseMobile: () => void
}) {
  const t = useTranslations('nav')
  const tchat = useTranslations('aiChat')
  const pathname = usePathname()
  const aiPanelOpen = useAiPanelStore((s) => s.open)
  const openPanel = useAiPanelStore((s) => s.openPanel)
  // 2026-08-29 迁移整合:AI 面板 header"新建任务"按钮已移除,能力统一到此按钮。
  // isStreaming 时禁用(原 header 按钮 disabled={isStreaming} 能力)。
  const isStreaming = useChatStore((s) => s.isStreaming)

  // 新建任务 = 打开 AI 面板(若未开) + 新建会话。
  // 会话重置逻辑复用 ai-side-panel 的 handleNewChat:派发 global-shortcut:new-chat 事件,
  // 与 Ctrl+Shift+N 快捷键同一通路(面板内监听器已改为始终注册,面板关闭时也能触发)。
  const handleNewTask = () => {
    openPanel()
    window.dispatchEvent(new CustomEvent('global-shortcut:new-chat'))
  }

  return (
    <>
      {/* 新建任务按钮(对齐旧架构 .nav-new-chat,黑白对调主题)
            2026-07-19 用户反馈:整体偏灰,不再用极端黑/白对比;
            改用 bg-foreground/10 + text-foreground,保持"亮色暗色反向对比"特性
            (亮色模式 10% 黑 = 浅灰底 + 黑字 / 暗色模式 10% 白 = 深灰底 + 白字),
            hover 升至 /20 给出明显反馈,但整体仍不抢眼。
            2026-08-29 迁移整合:AI 面板 header"新建任务"按钮已移除,入口统一到此按钮。
            能力 = 打开 AI 面板 + 新建会话(handleNewTask);流式中禁用(原 header 按钮能力)。 */}
      <div className={cn('mb-1', collapsed && 'flex justify-center')}>
        {collapsed ? (
          <Tooltip content={tchat('newConversation')} side="right">
            <button
              type="button"
              onClick={handleNewTask}
              disabled={isStreaming}
              aria-label={tchat('newConversation')}
              aria-pressed={aiPanelOpen}
              className="flex h-9 w-9 items-center justify-center rounded-md bg-foreground/10 text-foreground transition-colors hover:bg-foreground/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="h-5 w-5" />
            </button>
          </Tooltip>
        ) : (
          <button
            type="button"
            onClick={handleNewTask}
            disabled={isStreaming}
            aria-pressed={aiPanelOpen}
            className={cn(
              BTN_NEW_CONVERSATION_CLASS,
              'bg-foreground/10 text-foreground hover:bg-foreground/20',
              'disabled:cursor-not-allowed disabled:opacity-40',
            )}
          >
            <Plus className="h-5 w-5 shrink-0" />
            <span className="min-w-0 whitespace-nowrap text-left">{tchat('newConversation')}</span>
          </button>
        )}
      </div>

      {/* 插件市场按钮(2026-07-22 新增,位于"新建任务"按钮正下方)
            - 默认态无背景(与下方 NavLink 导航项一致),仅 hover 出现 bg-foreground/20
            - active 态(/plugins 路由命中):bg-foreground/20 锁定,提示"正在该页面"
            - 折叠态:36×36 正方形图标按钮,与"新建任务"折叠态对齐
            - 与新建任务按钮共用 BTN_NEW_CONVERSATION_CLASS(h-9 + gap-2 + translateY 对齐)
            - 2026-07-22 用户反馈:默认不应与新建任务一样有灰底,改为透明 */}
      <div className={cn('mb-1', collapsed && 'flex justify-center')}>
        {collapsed ? (
          <Tooltip content={t('pluginMarket')} side="right">
            <Link
              href="/plugins"
              onClick={onCloseMobile}
              aria-label={t('pluginMarket')}
              aria-current={pathname.startsWith('/plugins') ? 'page' : undefined}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-md text-foreground transition-colors',
                pathname.startsWith('/plugins') ? 'bg-foreground/20' : 'hover:bg-foreground/20',
              )}
            >
              <Package className="h-5 w-5" />
            </Link>
          </Tooltip>
        ) : (
          <Link
            href="/plugins"
            onClick={onCloseMobile}
            aria-current={pathname.startsWith('/plugins') ? 'page' : undefined}
            className={cn(
              BTN_NEW_CONVERSATION_CLASS,
              pathname.startsWith('/plugins')
                ? 'bg-foreground/20 text-foreground'
                : 'text-foreground hover:bg-foreground/20',
            )}
          >
            <Package className="h-5 w-5 shrink-0" />
            <span className="min-w-0 whitespace-nowrap text-left">{t('pluginMarket')}</span>
          </Link>
        )}
      </div>

      {/* 自动化任务按钮(2026-07-22 新增,位于"插件市场"按钮正下方,快捷区第3个)
            - 默认态无背景(与下方 NavLink 导航项一致),仅 hover 出现 bg-foreground/20
            - active 态(/self-media/automation 路由命中):bg-foreground/20 锁定
            - 折叠态:36×36 正方形图标按钮,与上方两个按钮对齐
            - 从 AI 分组移出,提升为快捷入口(用户需求 2026-07-22)
            - 2026-07-22 用户反馈:默认不应与新建任务一样有灰底,改为透明 */}
      <div className={cn('mb-1', collapsed && 'flex justify-center')}>
        {collapsed ? (
          <Tooltip content={t('selfMediaAutomation')} side="right">
            <Link
              href="/self-media/automation"
              onClick={onCloseMobile}
              aria-label={t('selfMediaAutomation')}
              aria-current={pathname.startsWith('/self-media/automation') ? 'page' : undefined}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-md text-foreground transition-colors',
                pathname.startsWith('/self-media/automation')
                  ? 'bg-foreground/20'
                  : 'hover:bg-foreground/20',
              )}
            >
              <Clock className="h-5 w-5" />
            </Link>
          </Tooltip>
        ) : (
          <Link
            href="/self-media/automation"
            onClick={onCloseMobile}
            aria-current={pathname.startsWith('/self-media/automation') ? 'page' : undefined}
            className={cn(
              BTN_NEW_CONVERSATION_CLASS,
              pathname.startsWith('/self-media/automation')
                ? 'bg-foreground/20 text-foreground'
                : 'text-foreground hover:bg-foreground/20',
            )}
          >
            <Clock className="h-5 w-5 shrink-0" />
            <span className="min-w-0 whitespace-nowrap text-left">{t('selfMediaAutomation')}</span>
          </Link>
        )}
      </div>
    </>
  )
}
