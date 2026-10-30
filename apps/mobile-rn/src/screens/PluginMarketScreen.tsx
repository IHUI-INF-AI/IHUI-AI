// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


import { useCallback, useEffect, useMemo, useState } from 'react'
import { Linking } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  getInstalledPlugins,
  installPlugin,
  uninstallPlugin,
  updatePluginPreferences,
  type PluginInstallState,
} from '@ihui/api-client'
import {
  PluginMarketScreen as SharedPluginMarketScreen,
  type PluginCategoryChip,
  type PluginMarketRowView,
} from '@ihui/rn-app'
import { MARKET_PLUGIN_CATALOG, PROJECT_PLUGIN_CATALOG } from '../data/plugin-catalog'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const NS = 'pluginMarketPage'

/** category → 分类筛选片的 i18n 键(与 web PluginMarketplace.tsx:203-235 的 cat* 一一对应) */
const CATEGORY_LABELS: Record<string, string> = {
  browser: 'catBrowser',
  computer: 'catComputer',
  video: 'catVideo',
  devops: 'catDevops',
  mcp: 'catMcp',
  agent: 'catAgent',
  search: 'catSearch',
  data: 'catData',
  ide: 'catIde',
  workflow: 'catWorkflow',
  design: 'catDesign',
  productivity: 'catProductivity',
  communication: 'catCommunication',
  security: 'catSecurity',
  model: 'catModel',
  tool: 'catTool',
  knowledge: 'catKnowledge',
  creation: 'catCreation',
}

/**
 * RN 端「插件市场」薄壳 —— 承载 web /plugins。
 *
 * 数据面(现读后端,只接真实注册路由):
 *  - 目录 **不走 HTTP**:web 端目录是前端静态数据(@ihui/shared/plugins-data),
 *    apps/api/src/routes/plugins.ts 只注册 /installed、/:id/install(POST|DELETE)、
 *    /:id/preferences(PATCH)、/:id/click(POST),没有目录端点
 *    ⇒ RN 端用同源镜像 apps/mobile-rn/src/data/plugin-catalog.ts(逐字抽取,不含 lucide 图标)。
 *  - 安装/启用态 GET /api/plugins/installed → { states, authenticated }
 *    (apps/api/src/routes/plugins.ts:72-98;经 routes/index.ts 挂 /api/plugins)
 *  - POST /api/plugins/:id/install(plugins.ts:99-144)、DELETE 同路径(plugins.ts:145-163)、
 *    PATCH /api/plugins/:id/preferences(plugins.ts:164-209)
 *  封装已存在(packages/api-client/src/endpoints/plugin.ts),本席未新建端点件。
 *
 * 未登录:web 仍展示目录、但隐藏启用/收藏按钮(PluginMarketplace.tsx:526-527)⇒ 本屏同口径:
 * 列表照常渲染,顶部给登录提示,行内不渲染启停/收藏按钮。
 * 口径差(如实登记):内置插件的站内路由(href)与市场卡片的「调用 / 添加到对话」在 RN 未承载,
 * 市场卡片只保留「访问官网」外链;web 的 toast 反馈在 RN 改为顶部错误行。
 */
export function PluginMarketScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()

  const [states, setStates] = useState<Record<string, PluginInstallState>>({})
  const [authenticated, setAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actingId, setActingId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState<'default' | 'name' | 'installed'>('default')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getInstalledPlugins()
      setStates(res.states ?? {})
      setAuthenticated(Boolean(res.authenticated))
      setError(null)
    } catch {
      setStates({})
      setAuthenticated(false)
      setError(t('common.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const handleToggleInstall = useCallback(
    async (id: string) => {
      if (actingId) return
      setActingId(id)
      const wasInstalled = Boolean(states[id])
      try {
        if (wasInstalled) {
          const res = await uninstallPlugin(id)
          if (!res || !res.removed) throw new Error('failed')
          setStates((prev) => {
            const next = { ...prev }
            delete next[id]
            return next
          })
        } else {
          const res = await installPlugin(id, { pinned: false })
          setStates((prev) => ({ ...prev, [id]: res.state }))
        }
        setError(null)
      } catch {
        setError(t(`${NS}.mutationError`))
      } finally {
        setActingId(null)
      }
    },
    [actingId, states, t],
  )

  const handleTogglePinned = useCallback(
    async (id: string) => {
      if (actingId) return
      const current = states[id]
      if (!current) return
      setActingId(id)
      const nextPinned = !current.pinned
      setStates((prev) => ({ ...prev, [id]: { ...current, pinned: nextPinned } }))
      try {
        const res = await updatePluginPreferences(id, { pinned: nextPinned })
        setStates((prev) => ({ ...prev, [id]: res.state }))
        setError(null)
      } catch {
        setStates((prev) => ({ ...prev, [id]: { ...current, pinned: current.pinned } }))
        setError(t(`${NS}.mutationError`))
      } finally {
        setActingId(null)
      }
    },
    [actingId, states, t],
  )

  const openUrl = useCallback((url: string) => {
    if (!/^https?:\/\//i.test(url)) return
    void Linking.openURL(url).catch(() => undefined)
  }, [])

  /** 目录 → 行视图(内置在前、市场在后,顺序即 web 的分组顺序) */
  const allRows: PluginMarketRowView[] = useMemo(() => {
    const toRow = (entry: (typeof PROJECT_PLUGIN_CATALOG)[number], source: 'project' | 'market') => ({
      id: entry.id,
      name: entry.name,
      desc: entry.desc,
      tags: entry.tags,
      cat: entry.cat,
      source,
      official: entry.official,
      free: entry.free,
      integration: entry.integration,
      installed: Boolean(states[entry.id]),
      pinned: Boolean(states[entry.id]?.pinned),
      url: entry.url,
    })
    return [
      ...PROJECT_PLUGIN_CATALOG.map((entry) => toRow(entry, 'project')),
      ...MARKET_PLUGIN_CATALOG.map((entry) => toRow(entry, 'market')),
    ]
  }, [states])

  const categories: PluginCategoryChip[] = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of allRows) counts.set(row.cat, (counts.get(row.cat) ?? 0) + 1)
    const installedCount = allRows.filter((r) => r.installed).length
    const pinnedCount = allRows.filter((r) => r.pinned).length
    const chips: PluginCategoryChip[] = [
      { key: 'all', label: t(`${NS}.catAll`), count: allRows.length },
      { key: 'builtin', label: t(`${NS}.catBuiltin`), count: PROJECT_PLUGIN_CATALOG.length },
      { key: 'market', label: t(`${NS}.catMarket`), count: MARKET_PLUGIN_CATALOG.length },
      { key: 'installed', label: t(`${NS}.catInstalled`), count: installedCount },
      { key: 'pinned', label: t(`${NS}.catPinned`), count: pinnedCount },
    ]
    for (const [cat, labelKey] of Object.entries(CATEGORY_LABELS)) {
      const count = counts.get(cat) ?? 0
      if (count > 0) chips.push({ key: cat, label: t(`${NS}.${labelKey}`), count })
    }
    return chips
  }, [allRows, t])

  const rows: PluginMarketRowView[] = useMemo(() => {
    let list = allRows
    if (filter === 'builtin') list = list.filter((r) => r.source === 'project')
    else if (filter === 'market') list = list.filter((r) => r.source === 'market')
    else if (filter === 'installed') list = list.filter((r) => r.installed)
    else if (filter === 'pinned') list = list.filter((r) => r.pinned)
    else if (filter !== 'all') list = list.filter((r) => r.cat === filter)

    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.desc.toLowerCase().includes(q) ||
          r.tags.some((tag) => tag.toLowerCase().includes(q)),
      )
    }

    if (sort === 'name') {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name))
    } else if (sort === 'installed') {
      // 与 web 同序:pinned 优先 → installedAt 倒序 → 未安装排最后(PluginMarketplace.tsx:265-278)
      list = [...list].sort((a, b) => {
        const sa = states[a.id]
        const sb = states[b.id]
        if (sa && sb) {
          if (Boolean(sa.pinned) !== Boolean(sb.pinned)) return sa.pinned ? -1 : 1
          return (sb.installedAt ?? '').localeCompare(sa.installedAt ?? '')
        }
        if (sa) return -1
        if (sb) return 1
        return 0
      })
    }
    return list
  }, [allRows, filter, query, sort, states])

  return (
    <SharedPluginMarketScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loginRequiredText={authenticated ? '' : t(`${NS}.loginRequired`)}
      loading={loading}
      error={error}
      query={query}
      onQueryChange={setQuery}
      filter={filter}
      categories={categories}
      onFilterChange={setFilter}
      sort={sort}
      onSortChange={setSort}
      rows={rows}
      actingId={actingId}
      onToggleInstall={(id) => void handleToggleInstall(id)}
      onTogglePinned={(id) => void handleTogglePinned(id)}
      onOpenUrl={openUrl}
      onResetFilters={() => {
        setQuery('')
        setFilter('all')
      }}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
