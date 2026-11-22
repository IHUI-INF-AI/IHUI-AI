// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Linking } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi } from '@ihui/api-client'
import {
  ConnectedAccountsScreen as SharedConnectedAccountsScreen,
  accountPlatformLabel,
  type ConnectedAccountBinding,
} from '@ihui/rn-app'
import { appAlert } from '../components/BottomPops'
import { useTheme } from '../context/ThemeContext'
import { useI18n } from '../i18n'
import { WEB_BASE_URL } from '../lib/config'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * 对齐 web `/settings/connected-accounts`(apps/web/app/(main)/settings/connected-accounts/page.tsx)。
 *
 * 〔门 39 六屏共享化第一批 2026-10-22〕UI 已下沉到共享层 `@ihui/rn-app` 的
 * ConnectedAccountsScreen —— 本文件改成 wrapper,只留平台侧四件事:API 调用、解绑二次确认
 * 弹层(`appAlert`)、打开外部浏览器(`Linking`)、i18n/时间格式化/主题注入。
 *
 * 端点按 apps/api/src/routes/auth-extended.ts 现读:
 *  - GET    /api/auth/bindings      → { items: userThirdPartyAccounts[] }（id/platform/createdAt…）
 *  - DELETE /api/auth/bindings/:id  → { deleted: boolean }（where 带 userId 归属过滤）
 *
 * 绑定入口**有意不在 App 内发起**:web 的 `window.location.href = /api/auth/${platform}`
 * 在该 API 里没有对应 GET 路由(只有 `/auth/:platform/callback`),现网这一跳即 404。
 * 因此本屏按钮改为打开 web 的已连接账号页,由用户在那里走真实可用的授权流程。
 */
interface Binding {
  id: string
  platform: string
  createdAt: string
}

function fmt(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export default function ConnectedAccountsScreen() {
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [bindings, setBindings] = useState<Binding[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [unbinding, setUnbinding] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetchApi<{ items?: Binding[] }>('/auth/bindings')
      if (!res.success) {
        setLoadError(res.error || t('connectedAccounts.loadFailed'))
        return
      }
      setBindings(Array.isArray(res.data.items) ? res.data.items : [])
    } catch {
      setLoadError(t('connectedAccounts.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  /** 共享层只认 `createdAtText`(时间格式化归平台);未知平台回落原始标识由共享层处理。 */
  const items = useMemo<ConnectedAccountBinding[]>(
    () =>
      bindings.map((b) => ({
        id: b.id,
        platform: b.platform,
        createdAtText: fmt(b.createdAt, locale),
      })),
    [bindings, locale],
  )

  const doUnbind = useCallback(
    async (binding: ConnectedAccountBinding) => {
      setUnbinding(binding.id)
      try {
        const res = await fetchApi<{ deleted: boolean }>(
          `/auth/bindings/${encodeURIComponent(binding.id)}`,
          { method: 'DELETE' },
        )
        if (!res.success) {
          appAlert(t('common.error'), res.error || t('connectedAccounts.unbindFailed'))
          return
        }
        if (!res.data.deleted) {
          appAlert(t('common.error'), t('connectedAccounts.unbindFailed'))
          return
        }
        void load()
      } catch {
        appAlert(t('common.error'), t('connectedAccounts.unbindFailed'))
      } finally {
        setUnbinding(null)
      }
    },
    [load, t],
  )

  /** 解绑二次确认属平台能力,共享层只收 `onUnbind`;平台名走共享层同一枚取词函数。 */
  const askUnbind = useCallback(
    (binding: ConnectedAccountBinding) => {
      appAlert(
        t('connectedAccounts.unbindTitle'),
        t('connectedAccounts.unbindConfirm', {
          platform: accountPlatformLabel(t, binding.platform),
        }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('connectedAccounts.unbind'),
            style: 'destructive',
            onPress: () => {
              void doUnbind(binding)
            },
          },
        ],
      )
    },
    [doUnbind, t],
  )

  const openWebBinding = useCallback(async () => {
    const url = `${WEB_BASE_URL}/settings/connected-accounts`
    try {
      const ok = await Linking.canOpenURL(url)
      if (!ok) {
        appAlert(t('common.error'), t('connectedAccounts.openBrowserFailed'))
        return
      }
      await Linking.openURL(url)
    } catch {
      appAlert(t('common.error'), t('connectedAccounts.openBrowserFailed'))
    }
  }, [t])

  return (
    <SharedConnectedAccountsScreen
      t={t}
      bindings={items}
      loading={loading}
      error={loadError}
      unbindingId={unbinding}
      onRefresh={() => void load()}
      onUnbind={askUnbind}
      onBindOnWeb={() => void openWebBinding()}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
