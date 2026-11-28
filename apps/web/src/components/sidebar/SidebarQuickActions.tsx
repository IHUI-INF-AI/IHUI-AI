// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Plus, Package, Clock, PackageOpen, Sparkles, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BTN_NEW_CONVERSATION_CLASS } from '@/lib/nav-styles'
import { Tooltip } from '@/components/feedback'
import { useAiPanelStore } from '@/stores/ai-panel'
import { useChatStore } from '@/stores/chat'

/**
 * 侧边栏顶部快捷操作区:新建任务 / 插件市场 / 自动化任务 / 产物中心 四个按钮(展开态显示文字,折叠态只显图标)。
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
  // 2026-10-30 G3 产物中心:入口文案放 artifacts.* 命名空间(与页面词同源,不动 nav)
  const tart = useTranslations('artifacts')
  const pathname = usePathname()
  const aiPanelOpen = useAiPanelStore((s) => s.open)
  // 2026-11-28 用户定档:总管不再单独做页,作为 AI 面板的一种内容形态;
  // 侧边栏入口放在「新建任务」上方,点击 = 打开面板 + 切到总管。
  const masterMode = useAiPanelStore((s) => s.masterMode)
  const openMaster = useAiPanelStore((s) => s.openMaster)
  // 2026-08-29 迁移整合:AI 面板 header"新建任务"按钮已移除,能力统一到此按钮。
  // isStreaming 时禁用(原 header 按钮 disabled={isStreaming} 能力)。
  const isStreaming = useChatStore((s) => s.isStreaming)

  // 新建任务 = 打开 AI 面板(若未开) + 新建会话。
  // 只派发 global-shortcut:new-chat 事件:streaming 门控 + 自动开面板 + 会话重置
  // 全部由 ai-side-panel 监听器单点收敛(DRY),侧边栏/Ctrl+Shift+N/桌面端快捷键行为完全一致。
  const handleNewTask = () => {
    window.dispatchEvent(new CustomEvent('global-shortcut:new-chat'))
  }

  return (
    <>
      {/* 工作台入口(2026-11-27):/start 八卡是"一人公司操作系统"的每日入口。
          没有这个侧边栏入口,八卡只是藏在 URL 里的页面;放在新建任务上方,
          不改变新建任务的流式门控能力。 */}
      <div className={cn('mb-1', collapsed && 'flex justify-center')}>
        {collapsed ? (
          <Tooltip content={t('workbench')} side="right">
            <Link
              href="/start"
              onClick={onCloseMobile}
              aria-label={t('workbench')}
              aria-current={pathname.startsWith('/start') ? 'page' : undefined}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-md transition-colors',
                pathname.startsWith('/start')
                  ? 'bg-cta text-cta-foreground'
                  : 'text-muted-foreground hover:bg-sidebar-item-hover-bg hover:text-foreground',
              )}
            >
              <Sparkles className="h-5 w-5" />
            </Link>
          </Tooltip>
        ) : (
          <Link
            href="/start"
            onClick={onCloseMobile}
            aria-current={pathname.startsWith('/start') ? 'page' : undefined}
            className={cn(
              BTN_NEW_CONVERSATION_CLASS,
              pathname.startsWith('/start')
                ? 'bg-cta text-cta-foreground font-semibold'
                : 'text-muted-foreground hover:bg-sidebar-item-hover-bg hover:text-foreground',
            )}
          >
            <Sparkles className="h-5 w-5 shrink-0" />
            <span className="min-w-0 whitespace-nowrap text-left">{t('workbench')}</span>
          </Link>
        )}
      </div>

      {/* AI总管入口(2026-11-28 用户定档):
          不新开页面,点击直接把现有 AI 面板切成总管形态。
          位置在「新建任务」上方 —— 总管是"接活的人",新建任务只是开一张空白会话。 */}
      <div className={cn('mb-1', collapsed && 'flex justify-center')}>
        {collapsed ? (
          <Tooltip content="AI总管" side="right">
            <button
              type="button"
              onClick={() => {
                openMaster()
                onCloseMobile()
              }}
              aria-label="AI总管"
              aria-pressed={masterMode && aiPanelOpen}
              data-testid="quick-master"
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-md transition-colors',
                masterMode && aiPanelOpen
                  ? 'bg-cta text-cta-foreground'
                  : 'text-muted-foreground hover:bg-sidebar-item-hover-bg hover:text-foreground',
              )}
            >
              <Bot className="h-5 w-5" />
            </button>
          </Tooltip>
        ) : (
          <button
            type="button"
            onClick={() => {
              openMaster()
              onCloseMobile()
            }}
            aria-pressed={masterMode && aiPanelOpen}
            data-testid="quick-master"
            className={cn(
              BTN_NEW_CONVERSATION_CLASS,
              masterMode && aiPanelOpen
                ? 'bg-cta text-cta-foreground font-semibold'
                : 'text-muted-foreground hover:bg-sidebar-item-hover-bg hover:text-foreground',
            )}
          >
            <Bot className="h-5 w-5 shrink-0" />
            <span className="min-w-0 whitespace-nowrap text-left">AI总管</span>
          </button>
        )}
      </div>

      {/* 新建任务按钮(对齐旧架构 .nav-new-chat,黑白对调主题)
            2026-07-19 用户反馈:整体偏灰,不再用极端黑/白对比;
            2026-11-11 用户反馈:该按钮与导航项不同,不需要「选中」语义,却常驻灰底,
            看起来像一直处于激活态 —— 与首页误高亮同型观感问题。
            现改为与下方导航项/快捷钮完全一致的默认透明 + hover 弱底(sidebar-item-hover-bg),
            不再有常驻底色;文字仍用 text-foreground 保持可读性。
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
              data-testid="quick-new-task"
              // 2026-11-26 起 4px 档删除,control 与 chip 同为 md=6px:
              // 三枚快捷钮与导航项统一取 rounded-md,不再有 sm/md 两档并存。
              className="flex h-9 w-9 items-center justify-center rounded-md text-foreground transition-colors hover:bg-sidebar-item-hover-bg disabled:cursor-not-allowed disabled:opacity-40"
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
            data-testid="quick-new-task"
            className={cn(
              BTN_NEW_CONVERSATION_CLASS,
              'text-foreground hover:bg-sidebar-item-hover-bg',
              'disabled:cursor-not-allowed disabled:opacity-40',
            )}
          >
            <Plus className="h-5 w-5 shrink-0" />
            <span className="min-w-0 whitespace-nowrap text-left">{tchat('newConversation')}</span>
          </button>
        )}
      </div>

      {/* 插件市场按钮(2026-07-22 新增,位于"新建任务"按钮正下方)
            - 默认态无背景(与下方 NavLink 导航项一致),仅 hover 出现 sidebar-item-hover-bg 弱底
            - active 态(/plugins 路由命中):反色锁定(亮色黑底白字 / 暗色白底黑字),提示"正在该页面"
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
                'flex h-9 w-9 items-center justify-center rounded-md transition-colors',
                pathname.startsWith('/plugins')
                  ? 'bg-cta text-cta-foreground'
                  : 'text-muted-foreground hover:bg-sidebar-item-hover-bg hover:text-foreground',
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
                ? 'bg-cta text-cta-foreground font-semibold'
                : 'text-muted-foreground hover:bg-sidebar-item-hover-bg hover:text-foreground',
            )}
          >
            <Package className="h-5 w-5 shrink-0" />
            <span className="min-w-0 whitespace-nowrap text-left">{t('pluginMarket')}</span>
          </Link>
        )}
      </div>

      {/* 自动化任务按钮(2026-07-22 新增,位于"插件市场"按钮正下方,快捷区第3个)
            - 默认态无背景(与下方 NavLink 导航项一致),仅 hover 出现 sidebar-item-hover-bg 弱底
            - active 态(/self-media/automation 路由命中):反色锁定(亮色黑底白字 / 暗色白底黑字)
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
                'flex h-9 w-9 items-center justify-center rounded-md transition-colors',
                pathname.startsWith('/self-media/automation')
                  ? 'bg-cta text-cta-foreground'
                  : 'text-muted-foreground hover:bg-sidebar-item-hover-bg hover:text-foreground',
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
                ? 'bg-cta text-cta-foreground font-semibold'
                : 'text-muted-foreground hover:bg-sidebar-item-hover-bg hover:text-foreground',
            )}
          >
            <Clock className="h-5 w-5 shrink-0" />
            <span className="min-w-0 whitespace-nowrap text-left">{t('selfMediaAutomation')}</span>
          </Link>
        )}
      </div>

      {/* 产物中心按钮(2026-10-30 G3 新增,快捷区第4个)
            - 样式与插件市场/自动化同款:默认透明仅 hover 出 sidebar-item-hover-bg 弱底,
              active 态(/artifacts 路由命中)用反色锁定(亮色黑底白字 / 暗色白底黑字);折叠态 36×36 图标按钮
            - 文案取 artifacts.navEntry(与产物中心页面词同源) */}
      <div className={cn('mb-1', collapsed && 'flex justify-center')}>
        {collapsed ? (
          <Tooltip content={tart('navEntry')} side="right">
            <Link
              href="/artifacts"
              onClick={onCloseMobile}
              aria-label={tart('navEntry')}
              aria-current={pathname.startsWith('/artifacts') ? 'page' : undefined}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-md transition-colors',
                pathname.startsWith('/artifacts')
                  ? 'bg-cta text-cta-foreground'
                  : 'text-muted-foreground hover:bg-sidebar-item-hover-bg hover:text-foreground',
              )}
            >
              <PackageOpen className="h-5 w-5" />
            </Link>
          </Tooltip>
        ) : (
          <Link
            href="/artifacts"
            onClick={onCloseMobile}
            aria-current={pathname.startsWith('/artifacts') ? 'page' : undefined}
            className={cn(
              BTN_NEW_CONVERSATION_CLASS,
              pathname.startsWith('/artifacts')
                ? 'bg-cta text-cta-foreground font-semibold'
                : 'text-muted-foreground hover:bg-sidebar-item-hover-bg hover:text-foreground',
            )}
          >
            <PackageOpen className="h-5 w-5 shrink-0" />
            <span className="min-w-0 whitespace-nowrap text-left">{tart('navEntry')}</span>
          </Link>
        )}
      </div>
    </>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
