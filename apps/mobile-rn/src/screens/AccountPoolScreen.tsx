// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import {
  AccountPoolScreen as SharedAccountPoolScreen,
  type AccountPoolDraft,
  type AccountPoolRow,
} from '@ihui/rn-app'
import { appAlert } from '../components/BottomPops'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const EMPTY_DRAFT: AccountPoolDraft = {
  providerCode: 'trae',
  name: '',
  token: '',
  refreshToken: '',
}

/**
 * 个人号池(RN 薄壳)。渲染在 packages/app 的共享屏里,本文件只管平台侧:
 * 导航、/api/account-pool* 调用、删除确认弹窗。
 * 与 Web `/account-pool`、小程序 `/pkg-user/account-pool/index` 打同一组用户态端点,
 * 按登录用户 owner_user_id 分池 ⇒ 三端数据互通;池内账号由签到引擎每日自动签到。
 */
export default function AccountPoolScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [rows, setRows] = useState<AccountPoolRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [draft, setDraft] = useState<AccountPoolDraft>(EMPTY_DRAFT)

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true)
      else setLoading(true)
      try {
        const res = await fetchApi<{ list: AccountPoolRow[] }>('/api/account-pool')
        if (res.success) setRows(res.data?.list ?? [])
        else appAlert(t('accountPool.actionFailed'), res.error ?? '')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [t],
  )

  useEffect(() => {
    void load()
  }, [load])

  const fail = (row: AccountPoolRow, e?: string) =>
    appAlert(t('accountPool.actionFailed'), `${row.name}${e ? `:${e}` : ''}`)

  const checkin = async (row: AccountPoolRow) => {
    setBusyId(row.id)
    try {
      const res = await fetchApi(`/api/account-pool/${row.id}/checkin`, { method: 'POST' })
      if (!res.success) fail(row, res.error)
      else void load(true)
    } finally {
      setBusyId(null)
    }
  }

  const toggle = async (row: AccountPoolRow) => {
    setBusyId(row.id)
    try {
      const res = await fetchApi(`/api/account-pool/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isEnabled: !row.isEnabled }),
      })
      if (!res.success) fail(row, res.error)
      else void load(true)
    } finally {
      setBusyId(null)
    }
  }

  const remove = (row: AccountPoolRow) => {
    appAlert(t('accountPool.delete'), t('accountPool.deleteConfirm', { name: row.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('accountPool.delete'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusyId(row.id)
            try {
              const res = await fetchApi(`/api/account-pool/${row.id}`, { method: 'DELETE' })
              if (!res.success) fail(row, res.error)
              else void load(true)
            } finally {
              setBusyId(null)
            }
          })()
        },
      },
    ])
  }

  const save = async () => {
    setSubmitting(true)
    try {
      const res = await fetchApi('/api/account-pool', {
        method: 'POST',
        body: JSON.stringify({
          providerCode: draft.providerCode,
          name: draft.name.trim(),
          token: draft.token.trim(),
          refreshToken: draft.refreshToken.trim() || undefined,
        }),
      })
      if (!res.success) {
        appAlert(t('accountPool.actionFailed'), res.error ?? '')
        return
      }
      setDraft(EMPTY_DRAFT)
      // 添加成功反馈(2026-10-28 补):词条 accountPool.addSuccess 早已在册,小程序页一直弹它,
      // 而 RN 壳此前静默 —— 两端"添加成功"体验不一致,也让该页无法判等价迁移
      appAlert(t('accountPool.addSuccess'))
      void load(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SharedAccountPoolScreen
      t={t}
      rows={rows}
      loading={loading}
      refreshing={refreshing}
      busyId={busyId}
      submitting={submitting}
      draft={draft}
      onDraftChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
      onSave={() => void save()}
      onCheckin={(row) => void checkin(row)}
      onToggle={(row) => void toggle(row)}
      onDelete={remove}
      onRefresh={() => void load(true)}
      onBack={() => navigation.goBack()}
      onBackToCheckin={() => navigation.navigate('CheckinAssistant')}
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
