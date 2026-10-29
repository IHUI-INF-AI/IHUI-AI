// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RN 端「云运行」薄壳 —— 渲染全部委托共享屏
 * `packages/app/src/features/cloud-runs/CloudRunsScreen.tsx`，本文件只管平台侧：
 * 取数（GET /api/cloud-runs?page&page_size 列表、GET /api/cloud-runs/{run_id} 详情，
 * 与 web `CloudRunsView.tsx:49/:65` 同端点同参）、分页游标、详情态的本地展开。
 *
 * 一屏两路由：web 侧 /cloud-run 与 /cloud-agent 复用同一实现（CloudRunsView 头注自述），
 * 本壳同样只有一份，不按路由各写一遍。
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import { CloudRunsScreen, type CloudRunItem } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const PAGE_SIZE = 20

interface RunListData {
  list: CloudRunItem[]
  total: number
  page: number
  pageSize: number
}

export function CloudRunScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const [runs, setRuns] = useState<CloudRunItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detail, setDetail] = useState<CloudRunItem | null>(null)

  const load = useCallback(
    async (target = page) => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetchApi<RunListData>(
          `/api/cloud-runs?page=${target}&page_size=${PAGE_SIZE}`,
        )
        if (!res.success || !res.data) {
          setError((res as { message?: string }).message || t('cloudRuns.loadFailed'))
          return
        }
        setRuns(res.data.list ?? [])
        setTotal(res.data.total ?? 0)
        setPage(res.data.page ?? target)
      } catch {
        setError(t('cloudRuns.loadFailed'))
      } finally {
        setLoading(false)
      }
    },
    [t, page],
  )

  useEffect(() => {
    void load(page)
  }, [load, page])

  const openRun = useCallback(
    async (run: CloudRunItem) => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetchApi<CloudRunItem>(
          `/api/cloud-runs/${encodeURIComponent(run.run_id)}`,
        )
        if (res.success && res.data) setDetail(res.data)
        else setError((res as { message?: string }).message || t('cloudRuns.loadFailed'))
      } catch {
        setError(t('cloudRuns.loadFailed'))
      } finally {
        setLoading(false)
      }
    },
    [t],
  )

  return (
    <CloudRunsScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loading={loading}
      error={error}
      runs={runs}
      total={total}
      page={page}
      pageSize={PAGE_SIZE}
      onPageChange={(next) => setPage(next)}
      onRefresh={() => void load(page)}
      onOpenRun={(run) => void openRun(run)}
      detail={detail}
      onCloseDetail={() => setDetail(null)}
    />
  )
}

export default CloudRunScreen
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
