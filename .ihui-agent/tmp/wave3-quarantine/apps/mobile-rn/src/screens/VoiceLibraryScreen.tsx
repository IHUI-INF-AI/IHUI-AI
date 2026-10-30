// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useRef, useState } from 'react'
import { Linking } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import * as DocumentPicker from 'expo-document-picker'
import {
  deleteVoiceClone,
  fetchApi,
  getVoiceClone,
  listVoiceClones,
  uploadVoiceClone,
  type VoiceCloneItem,
} from '@ihui/api-client'
import {
  VoiceLibraryScreen as SharedVoiceLibraryScreen,
  voiceCloneStateOf,
  type VoiceCloneDetail,
  type VoiceCloneRow,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import { appAlert } from '../components/BottomPops'
import { WEB_BASE_URL } from '../lib/config'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * 前置校验口径与 web 逐字同源:web `apps/web/app/(main)/voices/page.tsx:131-132`
 * (VOICE_MAX_BYTES / VOICE_EXTS),依据是 ai-service `token6688_provider.py:617-626`
 * 的官方硬限制(仅 MP3/M4A/WAV、严格 <20MiB)。超限当场拒发,不再全量传输后等 502。
 */
const VOICE_MAX_BYTES = 20 * 1024 * 1024
const VOICE_EXTS = new Set(['mp3', 'm4a', 'wav'])

/** 克隆是异步任务:存在非终态条目时按 web 同口径 5s 轮询(voices/page.tsx:111-118)。 */
const POLL_INTERVAL_MS = 5000

function idOf(item: VoiceCloneItem): string {
  const raw = item.voice_id ?? item.id
  return typeof raw === 'string' ? raw : ''
}

function nameOf(item: VoiceCloneItem, id: string): string {
  return typeof item.name === 'string' && item.name ? item.name : id || '-'
}

function urlOf(item: VoiceCloneItem): string | null {
  const raw = item.preview_url ?? item.audio_url
  return typeof raw === 'string' && raw ? raw : null
}

/** 时间格式化口径同 web:Intl.DateTimeFormat(locale, {…}) 而非端内自拼。 */
function formatCreatedAt(raw: string | undefined, locale: string): string {
  if (!raw) return '-'
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

/**
 * RN 端「声纹库」薄壳 —— 承载 web `/voices`(token6688 克隆音色列表/详情/上传/删除)。
 * 渲染全部委托共享屏 `packages/app/src/features/voice-clone/VoiceLibraryScreen.tsx`,
 * 本文件只管平台侧:取词、主题、导航落点、ai-service 取数与上传/删除/试听落点。
 *
 * 数据来源取证:这一页在 web 不直出 `/api` 字面量,而是 `apiOrThrow('/voice/voices')`
 * 经 `packages/api-client/src/client.ts:571` 补成 `/api/voice/voices`,再由
 * `apps/web/next.config.ts:370-371` 重写到 ai-service;**apps/api 未注册该路径**
 * (`apps/api/src/routes/index.ts:568` 只有 `/api/voice-notes`),故 RN 走 WEB_BASE_URL
 * 这条同源代理腿(与 VoiceSttScreen.tsx:118 的 STT 同口径),不直连 8803。
 *
 * 删除权限:后端 DELETE 带 `_require_admin`(voice_tts.py:327),web 用 store 里的 roleId 门控;
 * RN 侧无同源 store,改为拉一次 GET /api/auth/me(auth.ts:1457 的 payload 含 roleId,见 :201)
 * 取同样的 roleId>=1 判据 —— 拿不到就按非管理员处理(不给删除按钮),不乐观放行。
 */
export function VoiceLibraryScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()

  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [items, setItems] = useState<VoiceCloneItem[]>([])
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<VoiceCloneDetail | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const request = { baseUrl: WEB_BASE_URL }

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      try {
        const res = await listVoiceClones(request)
        if (!res.success || !res.data) {
          setListError(res.error || t('voicesPage.loadFailed'))
          setItems([])
          return
        }
        setListError(null)
        setItems(Array.isArray(res.data.voices) ? res.data.voices : [])
      } catch {
        setListError(t('voicesPage.loadFailed'))
        setItems([])
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [t],
  )

  useEffect(() => {
    void load()
  }, [load])

  // 非终态存在 ⇒ 5s 静默轮询;全部终态 ⇒ 停表(web refetchInterval 同语义)
  useEffect(() => {
    const pending = items.some(
      (item) => voiceCloneStateOf(item.status, Boolean(idOf(item))) === 'processing',
    )
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    if (!pending) return
    pollRef.current = setInterval(() => void load(true), POLL_INTERVAL_MS)
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [items, load])

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const res = await fetchApi<{ user?: { roleId?: number | null } }>('/auth/me')
        if (res.success && alive) setIsAdmin((res.data?.user?.roleId ?? 0) >= 1)
      } catch {
        // 读不到身份 ⇒ 不给删除入口(失效方向是少一个按钮,不是放行一次误删)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const rows: VoiceCloneRow[] = items.map((item) => {
    const id = idOf(item)
    return {
      id,
      name: nameOf(item, id),
      state: voiceCloneStateOf(item.status, Boolean(id)),
      createdAtLabel: formatCreatedAt(
        typeof item.created_at === 'string' ? item.created_at : undefined,
        locale,
      ),
      model: typeof item.model === 'string' && item.model ? item.model : null,
      previewUrl: urlOf(item),
    }
  })

  const onRefresh = useCallback(() => {
    setActionError(null)
    setNotice(null)
    void load()
  }, [load])

  const onUpload = useCallback(async () => {
    setActionError(null)
    setNotice(null)
    const picked = await DocumentPicker.getDocumentAsync({
      type: ['audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/*'],
      multiple: false,
      copyToCacheDirectory: true,
    }).catch(() => null)
    if (!picked || picked.canceled || picked.assets.length === 0) return
    const asset = picked.assets[0]
    const ext = (asset.name.split('.').pop() ?? '').toLowerCase()
    if (!VOICE_EXTS.has(ext)) {
      setActionError(`${t('voicesPage.upload')}: ${t('voicesPage.fileBadFormat')}`)
      return
    }
    if ((asset.size ?? 0) >= VOICE_MAX_BYTES) {
      setActionError(`${t('voicesPage.upload')}: ${t('voicesPage.fileTooLarge')}`)
      return
    }
    setUploading(true)
    try {
      const form = new FormData()
      // RN 原生 fetch 认 { uri, type, name } 结构读取文件(web 侧同名字段 'file' 传 Blob)
      form.append('file', { uri: asset.uri, type: asset.mimeType ?? 'audio/wav', name: asset.name } as never)
      const res = await uploadVoiceClone(form, request)
      if (!res.success) {
        setActionError(`${t('voicesPage.upload')}: ${res.error ?? t('voicesPage.loadFailed')}`)
        return
      }
      // 上传成功 ≠ 克隆完成:提示语义与 web 一致,完成由上面的 5s 轮询自动带出
      setNotice(t('voicesPage.cloneSubmitted'))
      await load(true)
    } catch {
      setActionError(`${t('voicesPage.upload')}: ${t('voicesPage.loadFailed')}`)
    } finally {
      setUploading(false)
    }
  }, [load, t])

  const onPreview = useCallback(
    (row: VoiceCloneRow) => {
      if (!row.previewUrl) return
      void Linking.openURL(row.previewUrl).catch(() =>
        setActionError(`${t('voicesPage.playPreview')}: ${t('voicesPage.loadFailed')}`),
      )
    },
    [t],
  )

  const onToggleExpand = useCallback(
    (row: VoiceCloneRow) => {
      if (!row.id) return
      if (expandedId === row.id) {
        setExpandedId(null)
        setDetail(null)
        return
      }
      setExpandedId(row.id)
      setDetail({ loading: true, error: null, fields: [] })
      void (async () => {
        try {
          const res = await getVoiceClone(row.id, request)
          if (!res.success || !res.data) {
            setDetail({ loading: false, error: res.error ?? t('voicesPage.notFound'), fields: [] })
            return
          }
          const d = res.data
          const known = new Set(['voice_id', 'id', 'name', 'status', 'created_at', 'preview_url', 'audio_url'])
          const fields = [
            { label: t('voicesPage.voiceId'), value: idOf(d) },
            { label: t('voicesPage.name'), value: typeof d.name === 'string' ? d.name : '' },
            { label: t('voicesPage.status'), value: typeof d.status === 'string' ? d.status : '' },
            { label: t('voicesPage.createdAt'), value: formatCreatedAt(typeof d.created_at === 'string' ? d.created_at : undefined, locale) },
            { label: t('voicesPage.previewUrl'), value: urlOf(d) ?? '' },
          ]
          // 与 web 详情面板同口径:未列在 known 里的标量字段一并摊开,对象字段不摊
          for (const [key, value] of Object.entries(d)) {
            if (known.has(key)) continue
            if (typeof value === 'object' && value !== null) continue
            fields.push({ label: key, value: String(value ?? '') })
          }
          setDetail({ loading: false, error: null, fields })
        } catch {
          setDetail({ loading: false, error: t('voicesPage.notFound'), fields: [] })
        }
      })()
    },
    [expandedId, locale, t],
  )

  const onDelete = useCallback(
    (row: VoiceCloneRow) => {
      if (!row.id) return
      appAlert(t('voicesPage.deleteConfirm'), undefined, [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('voicesPage.delete'),
          style: 'destructive',
          onPress: async () => {
            setDeletingId(row.id)
            setActionError(null)
            setNotice(null)
            try {
              const res = await deleteVoiceClone(row.id, request)
              if (!res.success) {
                // 后端只允许 admin;403 的成因如实透出,不写成"已删除"
                setActionError(`${t('voicesPage.delete')}: ${res.error ?? t('voicesPage.loadFailed')}`)
                return
              }
              if (expandedId === row.id) {
                setExpandedId(null)
                setDetail(null)
              }
              await load(true)
            } catch {
              setActionError(`${t('voicesPage.delete')}: ${t('voicesPage.loadFailed')}`)
            } finally {
              setDeletingId(null)
            }
          },
        },
      ])
    },
    [expandedId, load, t],
  )

  return (
    <SharedVoiceLibraryScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loading={loading}
      listError={listError}
      actionError={actionError}
      notice={notice}
      voices={rows}
      isAdmin={isAdmin}
      uploading={uploading}
      deletingId={deletingId}
      expandedId={expandedId}
      detail={detail}
      onRefresh={onRefresh}
      onUpload={() => void onUpload()}
      onPreview={onPreview}
      onToggleExpand={onToggleExpand}
      onDelete={onDelete}
    />
  )
}

export default VoiceLibraryScreen
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
