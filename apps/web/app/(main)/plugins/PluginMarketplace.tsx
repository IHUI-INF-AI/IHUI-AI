'use client'

import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  ArrowRight,
  Check,
  ExternalLink,
  Gift,
  Pin,
  Plus,
  Power,
  Search,
  Shield,
  X,
  Zap,
} from 'lucide-react'

import { Card } from '@ihui/ui-react'
import { BrandIcon } from '@/components/ai/brand-icon'
import { Input } from '@ihui/ui-react'
import { usePlugins } from '@/hooks/use-plugins'
import { useDebounce } from '@/hooks/use-debounce'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { useToast } from '@/hooks/use-toast'
import { useAiPanelStore } from '@/stores/ai-panel'
import { useChat } from '@/hooks/use-chat'
import { useChatStore } from '@/stores/chat'

import {
  PROJECT_PLUGINS,
  MARKET_PLUGINS,
  type ProjectPlugin,
  type MarketPlugin,
  type PluginCategory,
  getPluginIntegration,
} from './plugins-data'

type Filter = 'all' | 'builtin' | 'market' | 'installed' | 'pinned' | PluginCategory
type Sort = 'default' | 'name' | 'installed'

interface CategoryOption {
  key: Filter
  label: string
  count: number
}

interface PluginUIPrefs {
  filter: Filter
  sort: Sort
}

/**
 * 插件市场客户端组件(2026-07-22 重构 v2 — 真实接入版)
 *
 * 配套能力:
 *  - 实时搜索(防抖 300ms,名称 / 描述 / 标签)
 *  - 分类筛选(all/builtin/market/installed/pinned + 10 个 category)
 *  - 排序(default/name/installed — installed 按 installedAt desc + pinned 优先)
 *  - 真实接入:启用/禁用按钮 + 收藏/置顶按钮(持久化到 user_preferences 表)
 *  - UI 偏好持久化:filter/sort 存 localStorage(启用态走 server 避免跨设备不一致)
 *  - 空状态提示
 *  - 未登录隐藏操作按钮(isAuthenticated=false)
 *
 * 卡片设计:
 *  - 圆角 rounded-lg,无 rounded-full
 *  - hover:bg-accent/40 + hover:shadow-md,无蓝色发光边框
 *  - icon + 中文 span 同行 [&>span]:translate-y-[0.5px] 视觉对齐
 */
export function PluginMarketplace() {
  const t = useTranslations('plugins')
  const toast = useToast()
  const plugins = usePlugins()
  const openAiPanel = useAiPanelStore((s) => s.openPanel)
  const { sendMessage } = useChat()
  // 订阅已选工具列表(用于卡片"已添加"状态显示)
  const selectedToolsIds = useChatStore((s) => s.selectedTools)

  /** 内置插件调用:打开 AI 对话面板并注入"使用该插件"消息(2026-07-22 新增)
   *  用户点击插件卡片后,不跳转外部,而是在平台内通过 AI 对话调用该插件能力。
   *  AI 会根据插件类型(category)和描述,调用对应工具或引导用户完成操作。
   *
   *  2026-07-22 升级:按 category 选择精准调用指令,而非通用模板。
   *  - browser/computer:强调"控制浏览器/电脑执行操作"
   *  - video:强调"生成/剪辑视频内容"
   *  - devops:强调"部署/运维操作"
   *  - mcp/agent:强调"调用 MCP 工具/Agent 能力"
   *  - 其他:走通用模板 */
  const handleInvokePlugin = React.useCallback(
    (plugin: MarketPlugin) => {
      openAiPanel()
      // 按 category 选择精准 prompt 模板(找不到则 fallback 到通用模板)
      const promptKeyMap: Partial<Record<PluginCategory, string>> = {
        browser: 'invokePromptBrowser',
        computer: 'invokePromptComputer',
        video: 'invokePromptVideo',
        devops: 'invokePromptDevops',
        mcp: 'invokePromptMcp',
        agent: 'invokePromptAgent',
      }
      const promptKey = promptKeyMap[plugin.category] ?? 'invokePromptTemplate'
      const invokePrompt = t(promptKey, {
        name: plugin.name,
        category: plugin.category,
        description: plugin.description,
      })
      void sendMessage(invokePrompt)
      toast.info(t('invokeToast', { name: plugin.name }))
    },
    [openAiPanel, sendMessage, t, toast],
  )

  /** 添加到对话(2026-07-22 新增,用户需求:加号按钮添加到 AI 输入框)
   *  与 handleInvokePlugin 区别:
   *   - invoke:点击卡片立即发送 prompt 调用插件
   *   - addToChat:点击"+"按钮把插件作为"已选工具"加入 chat store,
   *     在 AI 输入框上方显示 chip,用户可继续编辑输入后主动发送
   *  真集成插件:对应 MCP 工具会合并到 agentTools,LLM 真能调用
   *  仅 prompt 意图插件:只作 UI 标记,sendMessage 时 prompt 文本仍会注入 */
  const handleAddToChat = React.useCallback(
    (plugin: MarketPlugin) => {
      const store = useChatStore.getState()
      if (store.selectedTools.includes(plugin.id)) {
        // 已添加:移除(toggle 行为)
        store.removeSelectedTool(plugin.id)
        toast.info(t('removedFromChat', { name: plugin.name }))
        return
      }
      store.addSelectedTool(plugin.id)
      openAiPanel()
      const integration = getPluginIntegration(plugin.id)
      if (integration === true) {
        toast.success(t('addedToChatReal', { name: plugin.name }))
      } else if (integration === 'model') {
        toast.success(t('addedToChatModel', { name: plugin.name }))
      } else {
        toast.info(t('addedToChatPrompt', { name: plugin.name }))
      }
    },
    [openAiPanel, t, toast],
  )

  // UI 偏好持久化到 localStorage(只存 filter/sort,不存启用态)
  const [uiPrefs, setUiPrefs] = useLocalStorage<PluginUIPrefs>('ihui:plugins:ui-prefs', {
    filter: 'all',
    sort: 'default',
  })
  const filter = uiPrefs.filter
  const sort = uiPrefs.sort

  // 搜索输入(立即更新) + 防抖值(300ms 后才触发过滤)
  const [queryInput, setQueryInput] = React.useState('')
  const query = useDebounce(queryInput, 300)

  // 合并两类插件为统一列表,带 source 标记
  const allPlugins = React.useMemo(() => {
    const project = PROJECT_PLUGINS.map((p) => ({ ...p, source: 'project' as const }))
    const market = MARKET_PLUGINS.map((p) => ({ ...p, source: 'market' as const }))
    return [...project, ...market]
  }, [])

  // 分类选项 + 计数(按热度排序:浏览器控制 / 电脑控制 / 视频创作 / 开发部署 排前面)
  const categories = React.useMemo<CategoryOption[]>(() => {
    const counts: Record<string, number> = {
      all: allPlugins.length,
      builtin: PROJECT_PLUGINS.length,
      market: MARKET_PLUGINS.length,
      installed: 0,
      pinned: 0,
      browser: 0,
      computer: 0,
      video: 0,
      devops: 0,
      mcp: 0,
      agent: 0,
      search: 0,
      data: 0,
      ide: 0,
      workflow: 0,
      design: 0,
      productivity: 0,
      communication: 0,
      security: 0,
      model: 0,
      market_cat: 0,
      tool: 0,
      knowledge: 0,
      creation: 0,
    }
    for (const p of allPlugins) {
      // 'market' category 计入 market_cat 避免与 source='market' 冲突
      const catKey = p.category === 'market' ? 'market_cat' : p.category
      counts[catKey] = (counts[catKey] ?? 0) + 1
      if (plugins.isInstalled(p.id)) counts.installed = (counts.installed ?? 0) + 1
      if (plugins.isPinned(p.id)) counts.pinned = (counts.pinned ?? 0) + 1
    }
    return [
      { key: 'all' as Filter, label: t('catAll'), count: counts.all ?? 0 },
      { key: 'browser' as Filter, label: t('catBrowser'), count: counts.browser ?? 0 },
      { key: 'computer' as Filter, label: t('catComputer'), count: counts.computer ?? 0 },
      { key: 'video' as Filter, label: t('catVideo'), count: counts.video ?? 0 },
      { key: 'devops' as Filter, label: t('catDevops'), count: counts.devops ?? 0 },
      { key: 'builtin' as Filter, label: t('catBuiltin'), count: counts.builtin ?? 0 },
      { key: 'market' as Filter, label: t('catMarket'), count: counts.market ?? 0 },
      { key: 'installed' as Filter, label: t('catInstalled'), count: counts.installed ?? 0 },
      { key: 'pinned' as Filter, label: t('catPinned'), count: counts.pinned ?? 0 },
      { key: 'mcp' as Filter, label: t('catMcp'), count: counts.mcp ?? 0 },
      { key: 'agent' as Filter, label: t('catAgent'), count: counts.agent ?? 0 },
      { key: 'search' as Filter, label: t('catSearch'), count: counts.search ?? 0 },
      { key: 'data' as Filter, label: t('catData'), count: counts.data ?? 0 },
      { key: 'ide' as Filter, label: t('catIde'), count: counts.ide ?? 0 },
      { key: 'workflow' as Filter, label: t('catWorkflow'), count: counts.workflow ?? 0 },
      { key: 'design' as Filter, label: t('catDesign'), count: counts.design ?? 0 },
      { key: 'productivity' as Filter, label: t('catProductivity'), count: counts.productivity ?? 0 },
      { key: 'communication' as Filter, label: t('catCommunication'), count: counts.communication ?? 0 },
      { key: 'security' as Filter, label: t('catSecurity'), count: counts.security ?? 0 },
      { key: 'model' as Filter, label: t('catModel'), count: counts.model ?? 0 },
      { key: 'tool' as Filter, label: t('catTool'), count: counts.tool ?? 0 },
      { key: 'knowledge' as Filter, label: t('catKnowledge'), count: counts.knowledge ?? 0 },
      { key: 'creation' as Filter, label: t('catCreation'), count: counts.creation ?? 0 },
    ].filter((c) => (c.count ?? 0) > 0 || c.key === 'all')
  }, [allPlugins, plugins, t])

  // 过滤 + 排序
  const filtered = React.useMemo(() => {
    let list = allPlugins
    if (filter === 'builtin') {
      list = list.filter((p) => p.source === 'project')
    } else if (filter === 'market') {
      list = list.filter((p) => p.source === 'market')
    } else if (filter === 'installed') {
      list = list.filter((p) => plugins.isInstalled(p.id))
    } else if (filter === 'pinned') {
      list = list.filter((p) => plugins.isPinned(p.id))
    } else if (filter !== 'all') {
      list = list.filter((p) => p.category === filter)
    }

    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.tags.some((tag) => tag.toLowerCase().includes(q)),
      )
    }

    if (sort === 'name') {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    } else if (sort === 'installed') {
      // pinned 优先,然后按 installedAt desc,未安装排最后
      list = [...list].sort((a, b) => {
        const sa = plugins.getState(a.id)
        const sb = plugins.getState(b.id)
        if (sa && sb) {
          if (sa.pinned !== sb.pinned) return sa.pinned ? -1 : 1
          return sb.installedAt.localeCompare(sa.installedAt)
        }
        if (sa) return -1
        if (sb) return 1
        return 0
      })
    }

    return list
  }, [allPlugins, filter, query, sort, plugins])

  // 按来源分组渲染
  const projectList = filtered.filter((p) => p.source === 'project')
  const marketList = filtered.filter((p) => p.source === 'market')

  // 操作处理(带 toast 反馈)
  const handleToggleInstall = React.useCallback(
    async (pluginId: string, pluginName: string) => {
      const wasInstalled = plugins.isInstalled(pluginId)
      const ok = await plugins.toggleInstall(pluginId)
      if (ok) {
        if (wasInstalled) {
          toast.success(t('uninstalled', { name: pluginName }))
        } else {
          toast.success(t('installed', { name: pluginName }))
        }
      } else {
        toast.error(t('mutationError'))
      }
    },
    [plugins, toast, t],
  )

  const handleTogglePinned = React.useCallback(
    async (pluginId: string, pluginName: string) => {
      const wasPinned = plugins.isPinned(pluginId)
      const ok = await plugins.togglePinned(pluginId)
      if (ok) {
        if (wasPinned) {
          toast.info(t('unpinned', { name: pluginName }))
        } else {
          toast.success(t('pinned', { name: pluginName }))
        }
      } else {
        toast.error(t('mutationError'))
      }
    },
    [plugins, toast, t],
  )

  return (
    <div className="space-y-6">
      {/* 工具栏:搜索 + 排序 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="h-9 pl-9 pr-9 [&>span]:translate-y-[0.5px]"
          />
          {queryInput && (
            <button
              type="button"
              onClick={() => setQueryInput('')}
              aria-label={t('clear')}
              className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 [&>span]:translate-y-[0.5px]">
          <span className="text-xs text-muted-foreground">{t('sortLabel')}</span>
          <div className="flex rounded-md bg-muted/60 p-0.5">
            {(['default', 'name', 'installed'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setUiPrefs((prev) => ({ ...prev, sort: s }))}
                className={cn(
                  'rounded px-2.5 py-1 text-xs font-medium transition-colors [&>span]:translate-y-[0.5px]',
                  sort === s
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <span>{t(s === 'default' ? 'sortDefault' : s === 'name' ? 'sortName' : 'sortInstalled')}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 分类筛选标签 */}
      <div className="flex flex-wrap gap-1.5">
        {categories.map((cat) => (
          <button
            key={cat.key}
            type="button"
            onClick={() => setUiPrefs((prev) => ({ ...prev, filter: cat.key }))}
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors [&>span]:translate-y-[0.5px]',
              filter === cat.key
                ? 'bg-foreground/10 text-foreground'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <span>{cat.label}</span>
            <span className="text-[10px] opacity-70">{cat.count}</span>
          </button>
        ))}
      </div>

      {/* 统计行 */}
      <div className="text-xs text-muted-foreground [&>span]:translate-y-[0.5px]">
        <span>{t('resultCount', { count: filtered.length })}</span>
      </div>

      {/* 空状态 */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">{t('emptyTitle')}</p>
          <p className="mt-1 text-xs text-muted-foreground/70">{t('emptyDesc')}</p>
          <button
            type="button"
            onClick={() => {
              setQueryInput('')
              setUiPrefs((prev) => ({ ...prev, filter: 'all' }))
            }}
            className="mt-4 rounded-md bg-foreground/10 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-foreground/15"
          >
            {t('emptyReset')}
          </button>
        </div>
      )}

      {/* 项目内置插件区 */}
      {projectList.length > 0 && (
        <section>
          <SectionHeader
            title={t('sectionProject')}
            desc={t('sectionProjectDesc')}
            count={projectList.length}
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {projectList.map((p) => (
              <ProjectPluginCard
                key={p.id}
                plugin={p}
                openLabel={t('open')}
                builtinLabel={t('builtin')}
                isAuthenticated={plugins.isAuthenticated}
                isInstalled={plugins.isInstalled(p.id)}
                isPinned={plugins.isPinned(p.id)}
                onToggleInstall={() => handleToggleInstall(p.id, p.name)}
                onTogglePinned={() => handleTogglePinned(p.id, p.name)}
                installedBadgeLabel={t('installedBadge')}
                installLabel={t('install')}
                uninstallLabel={t('uninstall')}
                pinLabel={t('pin')}
                unpinLabel={t('unpin')}
              />
            ))}
          </div>
        </section>
      )}

      {/* 市场插件区 */}
      {marketList.length > 0 && (
        <section>
          <SectionHeader
            title={t('sectionMarket')}
            desc={t('sectionMarketDesc')}
            count={marketList.length}
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {marketList.map((p) => (
              <MarketPluginCard
                key={p.id}
                plugin={p}
                visitLabel={t('visit')}
                invokeLabel={t('invoke')}
                officialLabel={t('official')}
                freeLabel={t('free')}
                isAuthenticated={plugins.isAuthenticated}
                isInstalled={plugins.isInstalled(p.id)}
                isPinned={plugins.isPinned(p.id)}
                onToggleInstall={() => handleToggleInstall(p.id, p.name)}
                onTogglePinned={() => handleTogglePinned(p.id, p.name)}
                onRecordClick={() => plugins.recordClick(p.id)}
                onInvoke={() => handleInvokePlugin(p)}
                onAddToChat={() => handleAddToChat(p)}
                isAddedToChat={selectedToolsIds.includes(p.id)}
                integrationLevel={getPluginIntegration(p.id)}
                addToChatLabel={t('addToChat')}
                addedToChatLabel={t('addedToChat')}
                realIntegratedLabel={t('realIntegrated')}
                modelIntegratedLabel={t('modelIntegrated')}
                promptOnlyLabel={t('promptOnly')}
                installedBadgeLabel={t('installedBadge')}
                installLabel={t('install')}
                uninstallLabel={t('uninstall')}
                pinLabel={t('pin')}
                unpinLabel={t('unpin')}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function SectionHeader({ title, desc, count }: { title: string; desc: string; count: number }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold leading-tight">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
      </div>
      <span className="shrink-0 rounded-md bg-muted/60 px-2 py-1 text-xs font-medium text-muted-foreground [&>span]:translate-y-[0.5px]">
        <span>{count}</span>
      </span>
    </div>
  )
}

/** 卡片右上角操作按钮组:Pin + Enable/Disable */
function PluginCardActions({
  isAuthenticated,
  isInstalled,
  isPinned,
  onToggleInstall,
  onTogglePinned,
  installLabel,
  uninstallLabel,
  pinLabel,
  unpinLabel,
}: {
  isAuthenticated: boolean
  isInstalled: boolean
  isPinned: boolean
  onToggleInstall: () => void
  onTogglePinned: () => void
  installLabel: string
  uninstallLabel: string
  pinLabel: string
  unpinLabel: string
}) {
  // 未登录:不显示操作按钮(前端隐藏,后端兜底鉴权)
  if (!isAuthenticated) return null
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onTogglePinned()
        }}
        disabled={!isInstalled}
        aria-label={isPinned ? unpinLabel : pinLabel}
        title={isPinned ? unpinLabel : pinLabel}
        className={cn(
          'flex h-6 w-6 items-center justify-center rounded transition-colors [&>span]:translate-y-[0.5px]',
          isPinned
            ? 'text-amber-500 hover:bg-amber-500/10'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          !isInstalled && 'cursor-not-allowed opacity-40',
        )}
      >
        {isPinned ? <Pin className="h-3.5 w-3.5 fill-current" /> : <Pin className="h-3.5 w-3.5" />}
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onToggleInstall()
        }}
        aria-label={isInstalled ? uninstallLabel : installLabel}
        title={isInstalled ? uninstallLabel : installLabel}
        className={cn(
          'flex h-6 w-6 items-center justify-center rounded transition-colors [&>span]:translate-y-[0.5px]',
          isInstalled
            ? 'text-emerald-500 hover:bg-emerald-500/10'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        )}
      >
        <Power className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

/** 已安装徽章(右上角,与操作按钮同区) */
function InstalledBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 [&>span]:translate-y-[0.5px]">
      <span>{label}</span>
    </span>
  )
}

function ProjectPluginCard({
  plugin,
  openLabel,
  builtinLabel,
  isAuthenticated,
  isInstalled,
  isPinned,
  onToggleInstall,
  onTogglePinned,
  installedBadgeLabel,
  installLabel,
  uninstallLabel,
  pinLabel,
  unpinLabel,
}: {
  plugin: ProjectPlugin
  openLabel: string
  builtinLabel: string
  isAuthenticated: boolean
  isInstalled: boolean
  isPinned: boolean
  onToggleInstall: () => void
  onTogglePinned: () => void
  installedBadgeLabel: string
  installLabel: string
  uninstallLabel: string
  pinLabel: string
  unpinLabel: string
}) {
  const Icon = plugin.icon
  return (
    <Link
      href={plugin.href}
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:rounded-lg"
    >
      <Card className="flex h-full flex-col gap-3 p-4 transition-all hover:bg-accent/40 hover:shadow-md">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold leading-tight">{plugin.name}</h3>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs [&>span]:translate-y-[0.5px]">
              <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400">
                <Shield className="mr-0.5 h-3 w-3" />
                {builtinLabel}
              </span>
              {isInstalled && <InstalledBadge label={installedBadgeLabel} />}
            </div>
          </div>
          <PluginCardActions
            isAuthenticated={isAuthenticated}
            isInstalled={isInstalled}
            isPinned={isPinned}
            onToggleInstall={onToggleInstall}
            onTogglePinned={onTogglePinned}
            installLabel={installLabel}
            uninstallLabel={uninstallLabel}
            pinLabel={pinLabel}
            unpinLabel={unpinLabel}
          />
        </div>
        <p className="line-clamp-2 min-h-[2.5rem] text-xs text-muted-foreground">{plugin.description}</p>
        <div className="mt-auto flex flex-wrap gap-1">
          {plugin.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-primary/8 px-1.5 py-0.5 text-[10px] font-medium text-primary"
            >
              {tag}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-end text-xs font-medium text-primary [&>span]:translate-y-[0.5px]">
          <span>{openLabel}</span>
          <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </div>
      </Card>
    </Link>
  )
}

function MarketPluginCard({
  plugin,
  visitLabel,
  invokeLabel,
  officialLabel,
  freeLabel,
  isAuthenticated,
  isInstalled,
  isPinned,
  onToggleInstall,
  onTogglePinned,
  onRecordClick,
  onInvoke,
  onAddToChat,
  isAddedToChat,
  integrationLevel,
  addToChatLabel,
  addedToChatLabel,
  realIntegratedLabel,
  modelIntegratedLabel,
  promptOnlyLabel,
  installedBadgeLabel,
  installLabel,
  uninstallLabel,
  pinLabel,
  unpinLabel,
}: {
  plugin: MarketPlugin
  visitLabel: string
  invokeLabel: string
  officialLabel: string
  freeLabel: string
  isAuthenticated: boolean
  isInstalled: boolean
  isPinned: boolean
  onToggleInstall: () => void
  onTogglePinned: () => void
  onRecordClick: () => void
  onInvoke: () => void
  onAddToChat: () => void
  isAddedToChat: boolean
  integrationLevel?: boolean | 'model'
  addToChatLabel: string
  addedToChatLabel: string
  realIntegratedLabel: string
  modelIntegratedLabel: string
  promptOnlyLabel: string
  installedBadgeLabel: string
  installLabel: string
  uninstallLabel: string
  pinLabel: string
  unpinLabel: string
}) {
  // 调用模式:默认 'dialog'(内置可调用),少数为 'external'(纯外链参考)
  const invokeMode = plugin.invokeMode ?? 'dialog'
  const isInternal = plugin.url.startsWith('/')
  const FallbackIcon = plugin.fallbackIcon
  // dialog 模式:点击卡片触发 onInvoke(打开 AI 对话面板调用)
  // external 模式:点击卡片跳转外部(isInternal 时走 Link,否则新窗口 <a>)
  const isDialogMode = invokeMode === 'dialog' && !isInternal

  // 集成度徽章文案 + 颜色(2026-07-22 新增)
  const integrationBadge = (() => {
    if (integrationLevel === true) {
      return {
        label: realIntegratedLabel,
        className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
      }
    }
    if (integrationLevel === 'model') {
      return {
        label: modelIntegratedLabel,
        className: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
      }
    }
    return {
      label: promptOnlyLabel,
      className: 'bg-muted text-muted-foreground',
    }
  })()

  const card = (
    <Card className="flex h-full flex-col gap-3 p-4 transition-all hover:bg-accent/40 hover:shadow-md">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
          {plugin.vendor ? <BrandIcon vendor={plugin.vendor} size={22} /> : <FallbackIcon className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold leading-tight">{plugin.name}</h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs [&>span]:translate-y-[0.5px]">
            {plugin.official && (
              <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400">
                <Shield className="mr-0.5 h-3 w-3" />
                {officialLabel}
              </span>
            )}
            {plugin.free && (
              <span className="inline-flex items-center text-amber-600 dark:text-amber-400">
                <Gift className="mr-0.5 h-3 w-3" />
                {freeLabel}
              </span>
            )}
            {isInstalled && <InstalledBadge label={installedBadgeLabel} />}
            {/* 集成度徽章:已集成(绿)/ 模型接入(蓝)/ 仅参考(灰) */}
            <span
              className={cn(
                'rounded-md px-1.5 py-0.5 text-[10px] font-medium',
                integrationBadge.className,
              )}
              title={
                integrationLevel === true
                  ? 'ai-service 后端有对应 MCP 工具,LLM 真能调用'
                  : integrationLevel === 'model'
                    ? 'LiteLLM 已接入,需配 .env 激活'
                    : '仅前端 prompt 意图,后端无对应实现'
              }
            >
              {integrationBadge.label}
            </span>
          </div>
        </div>
        {/* 添加到对话按钮(2026-07-22 新增):独立 + 图标,与 Pin/Power 并列
            点击后把插件作为"已选工具"加入 chat store,在 AI 输入框上方显示 chip */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onAddToChat()
          }}
          aria-label={isAddedToChat ? addedToChatLabel : addToChatLabel}
          title={isAddedToChat ? addedToChatLabel : addToChatLabel}
          className={cn(
            'flex h-6 w-6 shrink-0 items-center justify-center rounded transition-colors',
            isAddedToChat
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          {isAddedToChat ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        </button>
        <PluginCardActions
          isAuthenticated={isAuthenticated}
          isInstalled={isInstalled}
          isPinned={isPinned}
          onToggleInstall={onToggleInstall}
          onTogglePinned={onTogglePinned}
          installLabel={installLabel}
          uninstallLabel={uninstallLabel}
          pinLabel={pinLabel}
          unpinLabel={unpinLabel}
        />
      </div>
      <p className="line-clamp-2 min-h-[2.5rem] text-xs text-muted-foreground">{plugin.description}</p>
      <div className="mt-auto flex flex-wrap gap-1">
        {plugin.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
          >
            {tag}
          </span>
        ))}
      </div>
      {/* 底部行动条:dialog 模式显示"调用"(Zap 图标),external 模式显示"访问"(ExternalLink 图标) */}
      <div className="flex items-center justify-end text-xs font-medium text-primary [&>span]:translate-y-[0.5px]">
        {isDialogMode ? (
          <>
            <span>{invokeLabel}</span>
            <Zap className="ml-1 h-3 w-3 transition-transform group-hover:scale-110" />
          </>
        ) : (
          <>
            <span>{visitLabel}</span>
            <ExternalLink className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </>
        )}
      </div>
    </Card>
  )

  // 内部路由(项目插件):走 Link
  if (isInternal) {
    return (
      <Link
        href={plugin.url}
        onClick={onRecordClick}
        className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:rounded-lg"
      >
        {card}
      </Link>
    )
  }
  // dialog 模式(内置可调用):点击触发 onInvoke,不跳转外部
  if (isDialogMode) {
    return (
      <button
        type="button"
        onClick={() => {
          onRecordClick()
          onInvoke()
        }}
        className="group block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:rounded-lg"
        aria-label={`${invokeLabel} ${plugin.name}`}
      >
        {card}
      </button>
    )
  }
  // external 模式(纯外链参考):新窗口跳转
  return (
    <a
      href={plugin.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onRecordClick}
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:rounded-lg"
    >
      {card}
    </a>
  )
}

// 局部 cn 工具(避免引入额外依赖,保持最小化)
function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ')
}
