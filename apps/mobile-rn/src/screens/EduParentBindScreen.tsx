// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 家长绑定管理页(mobile-rn 端)—— 薄壳,复用通用控制台列表屏 ConsoleTableScreen。
 * 端点(与 web edu/parent/bind 同源):
 *  - GET    /api/edu-ai-management/parent-binding        ⇒ { list: BindingRecord[] }
 *  - PUT    /api/edu-ai-management/parent-binding/:id/confirm
 *  - PUT    /api/edu-ai-management/parent-binding/:id/reject
 *  - DELETE /api/edu-ai-management/parent-binding/:id
 * 行点按 → 三键确认弹层(确认/拒绝/删除),pending 状态才显示确认/拒绝。
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigation, type NavigationProp } from '@react-navigation/native'
import { fetchApi } from '@ihui/api-client'
import { ConsoleTableScreen, type ConsoleColumn, type ConsoleRowView } from '@ihui/rn-app'
import { appAlert } from '../components/BottomPops'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

interface BindingRecord {
  id: string
  studentId: string
  relationship: string
  status: string
  confirmedAt: string | null
  createdAt: string
}

export function EduParentBindScreen() {
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp<RootStackParamList>>()
  const [rows, setRows] = useState<ConsoleRowView[]>([])
  const [raw, setRaw] = useState<BindingRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const fmtDate = useCallback(
    (iso: string | null) => {
      if (!iso) return ''
      const d = new Date(iso)
      if (Number.isNaN(d.getTime())) return ''
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d)
    },
    [locale],
  )

  const statusLabel = useCallback(
    (s: string) => {
      const v = t(`eduParent.status.${s}`)
      return v === `eduParent.status.${s}` ? s : v
    },
    [t],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchApi<{ list: BindingRecord[] }>('/api/edu-ai-management/parent-binding')
      if (!res.success) throw new Error(res.error || 'load failed')
      const list = res.data?.list ?? []
      setRaw(list)
      setRows(
        list.map((b) => ({
          id: b.id,
          cells: {
            student: b.studentId,
            relationship: b.relationship,
            status: statusLabel(b.status),
            created: fmtDate(b.createdAt),
          },
          badgeTone:
            b.status === 'confirmed'
              ? ('ok' as const)
              : b.status === 'rejected'
                ? ('danger' as const)
                : ('warn' as const),
        })),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load failed')
    } finally {
      setLoading(false)
    }
  }, [statusLabel, fmtDate])

  useEffect(() => {
    void load()
  }, [load])

  const act = useCallback(
    async (id: string, kind: 'confirm' | 'reject' | 'delete') => {
      setPending(true)
      try {
        const url =
          kind === 'confirm'
            ? `/api/edu-ai-management/parent-binding/${id}/confirm`
            : kind === 'reject'
              ? `/api/edu-ai-management/parent-binding/${id}/reject`
              : `/api/edu-ai-management/parent-binding/${id}`
        const res = await fetchApi(url, { method: kind === 'delete' ? 'DELETE' : 'PUT' })
        if (!res.success) throw new Error(res.error)
        void load()
      } catch (e) {
        void appAlert(t('common.error'), e instanceof Error ? e.message : t('eduParentBind.title'))
      } finally {
        setPending(false)
      }
    },
    [load, t],
  )

  const onRowPress = useCallback(
    (row: ConsoleRowView) => {
      const rec = raw.find((b) => b.id === row.id)
      if (!rec || pending) return
      const buttons: Array<{
        text: string
        style?: 'cancel' | 'destructive'
        onPress?: () => void
      }> = [{ text: t('common.cancel'), style: 'cancel' }]
      if (rec.status === 'pending') {
        buttons.push({
          text: t('eduParentBind.confirm'),
          onPress: () => void act(rec.id, 'confirm'),
        })
        buttons.push({
          text: t('eduParentBind.reject'),
          style: 'destructive',
          onPress: () => void act(rec.id, 'reject'),
        })
      }
      buttons.push({
        text: t('eduParentBind.delete'),
        style: 'destructive',
        onPress: () => void act(rec.id, 'delete'),
      })
      void appAlert(
        t('eduParentBind.actionTitle'),
        `${rec.studentId} · ${rec.relationship}`,
        buttons,
      )
    },
    [raw, pending, act, t],
  )

  const columns: ConsoleColumn[] = [
    { key: 'student', title: t('eduParentBind.student'), render: 'mono', flex: 2 },
    { key: 'relationship', title: t('eduParent.relationship') },
    { key: 'status', title: t('eduParent.statusTitle'), render: 'badge' },
    { key: 'created', title: t('eduParentBind.created') },
  ]

  return (
    <ConsoleTableScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      title={t('eduParentBind.title')}
      columns={columns}
      rows={rows}
      loading={loading}
      error={error}
      onRetry={() => void load()}
      onRefresh={() => void load()}
      onRowPress={onRowPress}
    />
  )
}

export default EduParentBindScreen
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
