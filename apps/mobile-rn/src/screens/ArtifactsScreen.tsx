// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { Share } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { ARTIFACT_SUPPORTED_FMTS, getArtifactDownload, getArtifacts } from '@ihui/api-client'
import type { ArtifactListItem } from '@ihui/api-client'
import { ArtifactsScreen as SharedArtifactsScreen, type ArtifactItem } from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const PAGE_SIZE = 50

/**
 * RN 端「产物中心」薄壳 —— 渲染全部委托共享屏
 * `packages/app/src/features/artifacts/ArtifactsScreen.tsx`,本文件只管平台侧:
 * 枚举取数(GET /api/artifacts?page&pageSize,与 web 同 pageSize=50)、
 * 导出下载(GET /api/artifacts/:id/download,按 kind 走 ARTIFACT_SUPPORTED_FMTS
 * 矩阵,文本体经 Share API 导出 —— 对齐 web <a download> 的「拿到文件」语义)、
 * 签名预览(仅 html_report:下载 html 后交 ArtifactPreview 屏内 WebView 渲染,
 * 与 web「token + iframe/新窗口」同一「在线看产物」语义;不依赖 ai-service 独立基址)。
 */
export function ArtifactsScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<ArtifactListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const load = useCallback(
    async (targetPage: number, append: boolean) => {
      if (append) setLoadingMore(true)
      else setLoading(true)
      setError(null)
      try {
        const res = await getArtifacts({ page: targetPage, pageSize: PAGE_SIZE })
        if (!res.success || !res.data) {
          setError(res.error || t('artifacts.loadFailed'))
          return
        }
        const list = res.data.list ?? []
        setItems((prev) => (append ? [...prev, ...list] : list))
        setTotal(res.data.total ?? 0)
        setPage(targetPage)
      } catch {
        setError(t('artifacts.loadFailed'))
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [t],
  )

  useEffect(() => {
    void load(1, false)
  }, [load])

  const handleDownload = useCallback(
    async (item: ArtifactItem) => {
      // video_ref 无导出形态(共享屏已禁用按钮,此处按矩阵再挡一次)
      const fmts = ARTIFACT_SUPPORTED_FMTS[item.kind]
      const fmt = fmts.length > 0 ? fmts[0] : undefined
      if (!fmt) return
      setDownloadingId(item.id)
      try {
        const body = await getArtifactDownload(item.id, fmt)
        await Share.share({ title: `${item.name}.v${item.version}.${fmt}`, message: body })
      } catch {
        setError(t('artifacts.loadFailed'))
      } finally {
        setDownloadingId(null)
      }
    },
    [t],
  )

  const handlePreview = useCallback(
    (item: ArtifactItem) => {
      // 渲染直接走下载体(自包含 HTML),交 ArtifactPreview 屏内 WebView 加载 ——
      // 与 web「签名 token + iframe」同一「在线看产物」语义;免 RN 端维护
      // ai-service 独立基址(web 的 token+iframe 依赖同源反代)。
      navigation.navigate('ArtifactPreview', { artifactId: item.id, name: item.name })
    },
    [navigation],
  )

  const handleViewSession = useCallback(
    (item: ArtifactItem) => {
      navigation.navigate('Chat', { conversationId: item.session_id })
    },
    [navigation],
  )

  return (
    <SharedArtifactsScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loading={loading}
      loadingMore={loadingMore}
      error={error}
      items={items}
      page={page}
      total={total}
      totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))}
      onPageChange={(target) => void load(target, target > page)}
      onRefresh={() => void load(1, false)}
      onDownload={(item) => void handleDownload(item)}
      downloadingId={downloadingId}
      onPreview={handlePreview}
      onViewSession={handleViewSession}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
