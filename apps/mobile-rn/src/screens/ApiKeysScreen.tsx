// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import Clipboard from '@react-native-clipboard/clipboard'
import { fetchApi, rotateDeveloperApiKey } from '@ihui/api-client'
import {
  API_KEY_PERMISSIONS,
  DEFAULT_API_KEY_PERMISSIONS,
  type ApiKeyInfo,
  type ApiKeyUsage,
  type CreateApiKeyInput,
} from '@ihui/types'
import { ApiKeysScreen as SharedApiKeysScreen } from '@ihui/rn-app'
import { NavBar } from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { appAlert } from '../components/BottomPops'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'
type NavigationProp = NativeStackNavigationProp<RootStackParamList>
/**
 * 对齐 web `/settings/api-keys`（apps/web/app/(main)/settings/api-keys/）。
 *
 * 端点与字段按 apps/api/src/routes/developer.ts（prefix `/api/developer`）现读：
 *  - GET    /api/developer/api-keys            → { list: SafeApiKey[] }
 *  - POST   /api/developer/api-keys            → 201 { apiKey, secret }（secret 仅此一次）
 *  - DELETE /api/developer/api-keys/:id        → { ok: true }
 *  - GET    /api/developer/api-keys/:id/usage  → { callCount, lastUsedAt, topEndpoints }
 *
 * 壳只保留数据层与平台件(NavBar / Clipboard / appAlert / 错误提示);
 * 三段卡(secret / 新建 / 列表)全部由 @ihui/rn-app 共享屏渲染,小程序腿经 @rn-shells 自动跟随。
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
      if (!res.success) setLoadError(res.error || t('apiKeys.loadFailed'))
      else setList(res.data.list)
    } catch {
      setLoadError(t('apiKeys.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const onCreate = async (input: CreateApiKeyInput) => {
    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetchApi<{ apiKey: ApiKeyInfo; secret: string }>(
        '/api/developer/api-keys',
        { method: 'POST', body: JSON.stringify(input) },
      )
      if (!res.success) {
        setCreateError(res.error || t('apiKeys.createFailed'))
        throw new Error(res.error || 'create failed')
      }
      setSecret({ value: res.data.secret, source: 'create' })
      void load()
    } catch (e) {
      setCreateError((prev) => prev || t('apiKeys.createFailed'))
      throw e
    } finally {
      setCreating(false)
    }
  }

  const onLoadUsage = async (id: string): Promise<ApiKeyUsage> => {
    const res = await fetchApi<ApiKeyUsage>(`/api/developer/api-keys/${id}/usage`)
    if (!res.success) throw new Error(res.error || t('apiKeys.usageFailed'))
    return res.data
  }

  const onRotate = async (id: string) => {
    setRotatingId(id)
    try {
      const res = await rotateDeveloperApiKey(id)
      if (!res.success) throw new Error(res.error || t('apiKeys.rotateFailed'))
      setSecret({ value: res.data.secret, source: 'rotate' })
    } catch (e) {
      appAlert(
        t('common.error'),
        (e instanceof Error ? e.message : '') || t('apiKeys.rotateFailed'),
      )
      throw e
    } finally {
      setRotatingId(null)
    }
  }

  const onDelete = async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetchApi<{ ok: boolean }>(`/api/developer/api-keys/${id}`, {
        method: 'DELETE',
      })
      if (!res.success) throw new Error(res.error || t('apiKeys.deleteFailed'))
      void load()
    } catch (e) {
      appAlert(
        t('common.error'),
        (e instanceof Error ? e.message : '') || t('apiKeys.deleteFailed'),
      )
      throw e
    } finally {
      setDeletingId(null)
    }
  }

  const onConfirm = (options: { title: string; message: string; destructive: boolean }) =>
    new Promise<boolean>((resolve) => {
      appAlert(options.title, options.message, [
        { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
        {
          text: t('common.confirm'),
          style: options.destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ])
    })

  const onCopy = (text: string) => {
    Clipboard.setString(text)
    appAlert(t('apiKeys.secretCopied'))
  }

  return (
    <>
      {/* 标题/副标题由共享屏统一渲染,NavBar 只保留返回;避免与页头重复 */}
      <NavChrome>
        <NavBar onBack={() => navigation.goBack()} />
      </NavChrome>
      <SharedApiKeysScreen
        t={t}
        colorScheme={resolvedTheme}
        list={list}
        loading={loading}
        error={loadError}
        onReload={() => void load()}
        permissionOptions={API_KEY_PERMISSIONS.map((perm) => ({ value: perm, label: perm }))}
        defaultPermissions={[...DEFAULT_API_KEY_PERMISSIONS]}
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
    </>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
