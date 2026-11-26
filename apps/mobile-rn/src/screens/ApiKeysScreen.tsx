// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Clipboard from '@react-native-clipboard/clipboard'
import { fetchApi, rotateDeveloperApiKey } from '@ihui/api-client'
import { ApiKeysScreen as SharedApiKeysScreen } from '@ihui/rn-app'
import {
  API_KEY_PERMISSIONS,
  DEFAULT_API_KEY_PERMISSIONS,
  type ApiKeyInfo,
  type ApiKeyUsage,
  type CreateApiKeyInput,
} from '@ihui/types'
import { tokens } from '../theme/active-tokens'
import { NavBar } from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { appAlert } from '../components/BottomPops'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * API 密钥薄壳 —— 渲染全部委托共享屏
 * `packages/app/src/features/api-keys/ApiKeysScreen.tsx`。
 *
 * 本文件只保留平台侧:端点调用、剪贴板、二次确认弹窗、导航 chrome。
 * 端点与 web `/settings/api-keys` 同源(按 apps/api/src/routes/developer.ts,前缀 /api/developer):
 *  - GET    /api/developer/api-keys            → { list }
 *  - POST   /api/developer/api-keys            → { apiKey, secret }(secret 仅此一次)
 *  - DELETE /api/developer/api-keys/:id        → { ok }
 *  - GET    /api/developer/api-keys/:id/usage  → { callCount, lastUsedAt, topEndpoints }
 *
 * 此前本屏自建 605 行 UI,共享层另写 617 行、全端零渲染;现共享屏为唯一实现,
 * 小程序经 @rn-shells 跟随本壳,三端首次同源。
 */
export default function ApiKeysScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()

  const [list, setList] = useState<ApiKeyInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [secret, setSecret] = useState<{ value: string; source: 'create' | 'rotate' } | null>(null)
  const [rotatingId, setRotatingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetchApi<{ list: ApiKeyInfo[] }>('/api/developer/api-keys')
      if (!res.success) throw new Error(res.error || t('apiKeys.loadFailed'))
      setList(res.data?.list ?? [])
    } catch (e) {
      setList([])
      setLoadError(e instanceof Error && e.message ? e.message : t('apiKeys.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const onCreate = useCallback(
    async (input: CreateApiKeyInput) => {
      setCreating(true)
      setCreateError(null)
      try {
        const res = await fetchApi<{ apiKey: ApiKeyInfo; secret: string }>(
          '/api/developer/api-keys',
          { method: 'POST', body: JSON.stringify(input) },
        )
        if (!res.success) throw new Error(res.error || t('apiKeys.createFailed'))
        setSecret({ value: res.data.secret, source: 'create' })
        await load()
      } catch (e) {
        const msg = e instanceof Error && e.message ? e.message : t('apiKeys.createFailed')
        setCreateError(msg)
        throw e
      } finally {
        setCreating(false)
      }
    },
    [load, t],
  )

  const onRotate = useCallback(
    async (id: string) => {
      setRotatingId(id)
      try {
        const res = await rotateDeveloperApiKey(id)
        if (!res.success) throw new Error(res.error || t('apiKeys.rotateFailed'))
        setSecret({ value: res.data.secret, source: 'rotate' })
      } catch (e) {
        appAlert(
          t('common.error'),
          e instanceof Error && e.message ? e.message : t('apiKeys.rotateFailed'),
        )
        throw e
      } finally {
        setRotatingId(null)
      }
    },
    [t],
  )

  const onDelete = useCallback(
    async (id: string) => {
      setDeletingId(id)
      try {
        const res = await fetchApi<{ ok: boolean }>(`/api/developer/api-keys/${id}`, {
          method: 'DELETE',
        })
        if (!res.success) throw new Error(res.error || t('apiKeys.deleteFailed'))
        await load()
      } catch (e) {
        appAlert(
          t('common.error'),
          e instanceof Error && e.message ? e.message : t('apiKeys.deleteFailed'),
        )
        throw e
      } finally {
        setDeletingId(null)
      }
    },
    [load, t],
  )

  const onLoadUsage = useCallback(
    async (id: string): Promise<ApiKeyUsage> => {
      const res = await fetchApi<ApiKeyUsage>(`/api/developer/api-keys/${id}/usage`)
      if (!res.success) throw new Error(res.error || t('apiKeys.usageFailed'))
      return res.data
    },
    [t],
  )

  const onCopy = useCallback(
    (text: string, kind: 'key' | 'secret') => {
      Clipboard.setString(text)
      appAlert(
        t('common.hint'),
        kind === 'secret' ? t('apiKeys.secretCopied') : t('apiKeys.copied'),
      )
    },
    [t],
  )

  const onConfirm = useCallback(
    (options: { title: string; message: string; destructive: boolean }) =>
      new Promise<boolean>((resolve) => {
        appAlert(options.title, options.message, [
          { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
          {
            text: t('common.confirm'),
            style: options.destructive ? 'destructive' : 'default',
            onPress: () => resolve(true),
          },
        ])
      }),
    [t],
  )

  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar title={t('apiKeys.title')} onBack={() => navigation.goBack()} />
      </NavChrome>
      <SharedApiKeysScreen
        t={t}
        colorScheme={resolvedTheme}
        list={list}
        loading={loading}
        error={loadError}
        onReload={() => void load()}
        permissionOptions={PERMISSION_OPTIONS}
        defaultPermissions={DEFAULT_PERMISSIONS}
        onCreate={onCreate}
        creating={creating}
        createError={createError}
        secret={secret}
        onCloseSecret={() => setSecret(null)}
        onRotate={onRotate}
        onDelete={onDelete}
        rotatingId={rotatingId}
        deletingId={deletingId}
        onLoadUsage={onLoadUsage}
        onCopy={onCopy}
        onConfirm={onConfirm}
      />
    </View>
  )
}

const PERMISSION_OPTIONS = API_KEY_PERMISSIONS.map((value) => ({ value, label: value }))
const DEFAULT_PERMISSIONS = [...DEFAULT_API_KEY_PERMISSIONS]
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg },
})
