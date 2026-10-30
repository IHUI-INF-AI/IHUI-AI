// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  getRegistryItems,
  installRegistryItem,
  type RegistryItemRecord,
  type RegistrySourceType,
} from '@ihui/api-client'
import {
  RegistryScreen as SharedRegistryScreen,
  type RegistryFilterOption,
  type RegistryItemRowView,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const NS = 'registryPage'

/** 与后端 pageSize 默认同值(上限 100,apps/api/src/routes/registry-sync.ts:90) */
const PAGE_SIZE = 20

type FilterKey = 'all' | RegistrySourceType

/**
 * RN 端「资源更新中心」薄壳 —— 承载 web /registry。渲染全部委托共享屏,本文件只管:
 * 取数 GET /api/registry/items(契约 apps/api/src/routes/registry-sync.ts:282-296,需登录,
 * data = { items, total, page, pageSize, installedIds })、分页(page/pageSize 触底续页)、
 * 安装 POST /api/registry/install(同文件:485-534,body { sourceType, sourceId })、
 * 文案拼装(类型 / 安装状态 / 筛选标签)、登录门(未登录不发注定 401 的查询)。
 * 口径差:web 的排序 Tabs「最热/最优」两档全库无对应 i18n 文案,RN 固定 sort='latest',
 * 不渲染这两档;管理员面板(同步 / 配置漂移 / Worker 指标 / 同步日志,后端全 requireAdmin)未承载。
 */
export function RegistryScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()

  const [filter, setFilter] = useState<FilterKey>('all')
  const [rows, setRows] = useState<RegistryItemRowView[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [installingId, setInstallingId] = useState<string | null>(null)

  const filters = useMemo<RegistryFilterOption[]>(
    () => [
      { key: 'all', label: t(`${NS}.filterAll`) },
      { key: 'mcp', label: t(`${NS}.typeMcp`) },
      { key: 'skill', label: t(`${NS}.typeSkill`) },
      { key: 'plugin', label: t(`${NS}.typePlugin`) },
    ],
    [t],
  )

  const typeText = useCallback(
    (sourceType: RegistrySourceType): string => {
      if (sourceType === 'mcp') return t(`${NS}.typeMcp`)
      if (sourceType === 'skill') return t(`${NS}.typeSkill`)
      return t(`${NS}.typePlugin`)
    },
    [t],
  )

  const toRow = useCallback(
    (item: RegistryItemRecord, ids: string[]): RegistryItemRowView => {
      const installed = ids.includes(item.id)
      return {
        id: item.id,
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        name: item.name,
        description: item.description ?? '',
        typeText: typeText(item.sourceType),
        statusText: installed ? t(`${NS}.installed`) : t(`${NS}.notInstalled`),
        installed,
        version: item.version ?? '',
        author: item.author ?? '',
        tags: item.tags ?? [],
      }
    },
    [typeText, t],
  )

  const load = useCallback(
    async (nextPage: number, append: boolean, nextFilter: FilterKey) => {
      if (!user) return
      if (append) setLoadingMore(true)
      else setLoading(true)
      try {
        const res = await getRegistryItems({
          sort: 'latest',
          sourceType: nextFilter === 'all' ? undefined : nextFilter,
          page: nextPage,
          pageSize: PAGE_SIZE,
        })
        if (!res.success || !res.data) {
          setError(res.error ?? t('common.loadFailed'))
          return
        }
        setError(null)
        const ids = res.data.installedIds ?? []
        setTotal(res.data.total ?? 0)
        const mapped = (res.data.items ?? []).map((item) => toRow(item, ids))
        setRows((prev) => (append ? [...prev, ...mapped] : mapped))
        setPage(nextPage)
      } catch {
        setError(t('common.loadFailed'))
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [user, toRow, t],
  )

  useEffect(() => {
    void load(1, false, filter)
  }, [load, filter])

  const handleFilterChange = useCallback((key: string) => {
    setFilter(key === 'mcp' || key === 'skill' || key === 'plugin' ? key : 'all')
  }, [])

  const handleInstall = useCallback(
    async (row: RegistryItemRowView) => {
      if (installingId) return
      setInstallingId(row.id)
      try {
        const res = await installRegistryItem({
          sourceType: row.sourceType as RegistrySourceType,
          sourceId: row.sourceId,
        })
        if (!res.success) {
          setError(res.error ?? t('common.loadFailed'))
          return
        }
        await load(1, false, filter)
      } catch {
        setError(t('common.loadFailed'))
      } finally {
        setInstallingId(null)
      }
    },
    // load 内部已带 filter,这里随 filter 重建
    [installingId, load, filter, t],
  )

  const hasMore = rows.length < total

  return (
    <SharedRegistryScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loginRequiredText={user ? '' : t(`${NS}.loginRequired`)}
      loading={loading}
      error={error}
      rows={rows}
      total={total}
      filters={filters}
      activeFilter={filter}
      onFilterChange={handleFilterChange}
      installingId={installingId}
      onInstall={(row) => void handleInstall(row)}
      loadingMore={loadingMore}
      hasMore={hasMore}
      onEndReached={() => {
        if (!loading && !loadingMore && hasMore) void load(page + 1, true, filter)
      }}
      onRefresh={() => void load(1, false, filter)}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
