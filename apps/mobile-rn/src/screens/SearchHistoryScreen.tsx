// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  clearSearchHistoryAll,
  deleteSearchHistoryRow,
  getSearchHistoryRows,
} from '@ihui/api-client'
import {
  SearchHistoryScreen as SharedSearchHistoryScreen,
  type SearchHistoryRowView,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * RN 端「搜索历史」薄壳 —— 承载 web /search/history。渲染全部委托共享屏,本文件只管:
 * 取数(GET /api/search/history)、清空(DELETE /api/search/history)、单删(DELETE /api/search/history/:id)、
 * 时间 Intl 格式化(与 web 同参 locale,MM/DD HH:mm)、登录门(与 web useAuthGate 同口径)。
 * 降级说明:RN Search 路由为无参路由,web 的「点行带词重搜」不可复刻 ⇒ 行只读。
 */
export function SearchHistoryScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()

  const [rows, setRows] = useState<SearchHistoryRowView[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clearPending, setClearPending] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [locale],
  )

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const res = await getSearchHistoryRows()
      if (!res.success || !res.data) {
        setError(res.error ?? t('searchHistoryPage.error'))
        return
      }
      setError(null)
      setRows(
        (res.data.list ?? []).map((item) => ({
          id: item.id,
          query: item.query,
          metaText: `${dateFmt.format(new Date(item.createdAt))} · ${t(
            'searchHistoryPage.resultCount',
            { count: item.resultsCount },
          )}`,
        })),
      )
    } catch {
      setError(t('searchHistoryPage.error'))
    } finally {
      setLoading(false)
    }
  }, [user, dateFmt, t])

  useEffect(() => {
    void load()
  }, [load])

  const clearAll = useCallback(async () => {
    setClearPending(true)
    try {
      const res = await clearSearchHistoryAll()
      if (res.success) await load()
      else setError(res.error ?? t('searchHistoryPage.error'))
    } catch {
      setError(t('searchHistoryPage.error'))
    } finally {
      setClearPending(false)
    }
  }, [load, t])

  const removeOne = useCallback(
    async (id: string) => {
      setDeletingId(id)
      try {
        const res = await deleteSearchHistoryRow(id)
        if (res.success) setRows((prev) => prev.filter((r) => r.id !== id))
        else setError(res.error ?? t('searchHistoryPage.error'))
      } catch {
        setError(t('searchHistoryPage.error'))
      } finally {
        setDeletingId(null)
      }
    },
    [t],
  )

  return (
    <SharedSearchHistoryScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loginRequiredText={user ? '' : t('searchHistoryPage.loginRequired')}
      loading={!user ? false : loading}
      error={error}
      rows={rows}
      clearPending={clearPending}
      deletingId={deletingId}
      onClearAll={() => void clearAll()}
      onDelete={(id) => void removeOne(id)}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
