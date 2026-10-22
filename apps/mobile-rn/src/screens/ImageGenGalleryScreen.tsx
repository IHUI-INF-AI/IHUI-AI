// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { fetchApi, resolveFileUrl } from '@ihui/api-client'
import {
  ImageGenGalleryScreen as SharedImageGenGalleryScreen,
  type GalleryImageItem,
} from '@ihui/rn-app'
import ImagePreviewModal from '../components/ImagePreviewModal'
import { appAlert } from '../components/BottomPops'
import { useTheme } from '../context/ThemeContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const PAGE_SIZE = 20

/** ai_gc_content 行(与 drizzle schema 的列集一致) */
interface GalleryRow {
  id: string
  userUuid: string
  agentId: string | null
  gcType: string | null
  content: string | null
  status: number | null
  createdAt: string
  updatedAt: string
}

interface GalleryData {
  list: GalleryRow[]
  total: number
  page: number
  pageSize: number
}

/** content 本身是图片地址时才可当图片用;提示词一律不当图片(避免把文字塞进 Image.src) */
function imageUrlOf(content: string | null): string | null {
  const raw = content?.trim()
  if (!raw) return null
  if (/^https?:\/\//i.test(raw) || raw.startsWith('/uploads/') || raw.startsWith('/files/')) {
    return resolveFileUrl(raw)
  }
  return null
}

/**
 * 公开图库 —— 对齐 web `/image-gen/gallery`。
 *
 * 〔门 39 六屏共享化第一批 2026-10-22〕UI 已下沉到共享层 `@ihui/rn-app` 的
 * ImageGenGalleryScreen —— 本文件改成 wrapper,只留平台侧四件事:API 分页、图片地址解析
 * (`resolveFileUrl` 属 api-client)、全屏预览弹层(`ImagePreviewModal`)与"非图片"提示
 * (`appAlert`)、i18n/时间格式化/主题注入。
 *
 * 契约(按 apps/api/src/routes/other/image-gen-routes.ts 与 ai_gc_content 表实读):
 *  - `GET /api/image-gen/gallery` 返回 `{ list, total, page, pageSize }`,行 = `ai_gc_content`;
 *  - 该表只有 id/userUuid/agentId/gcType/content/status/createdAt/updatedAt,**没有 image_url 列**,
 *    web 页假设的 imageUrl/authorName/likeCount 三个字段在响应里都不存在;
 *  - `POST /image-gen/generate` 把提示词写进 `content`,所以本屏把 content 当作提示词展示;
 *    仅当旧数据的 content 本身是一个图片地址时才渲染图片(不伪造 URL,也不显示假作者/假点赞)。
 *  - 分页参数上限 pageSize=100(routes/other/_shared.ts 的 paginationSchema)。
 */
export default function ImageGenGalleryScreen() {
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()

  const [rows, setRows] = useState<GalleryRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<{ urls: string[]; index: number } | null>(null)

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }),
    [locale],
  )

  const items = useMemo<GalleryImageItem[]>(
    () =>
      rows.map((row) => ({
        id: row.id,
        content: row.content,
        imageUrl: imageUrlOf(row.content),
        createdAtText: Number.isNaN(new Date(row.createdAt).getTime())
          ? '—'
          : dateFmt.format(new Date(row.createdAt)),
      })),
    [rows, dateFmt],
  )

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetchApi<GalleryData>('/api/image-gen/gallery', {
        params: { page: 1, pageSize: PAGE_SIZE },
      })
      if (!res.success) {
        setError(t('imageGenGallery.loadFailed'))
        return
      }
      setRows(res.data.list)
      setTotal(res.data.total)
      setPage(1)
    } catch {
      setError(t('imageGenGallery.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || rows.length >= total) return
    setLoadingMore(true)
    try {
      const nextPage = page + 1
      const res = await fetchApi<GalleryData>('/api/image-gen/gallery', {
        params: { page: nextPage, pageSize: PAGE_SIZE },
      })
      if (res.success) {
        setRows((prev) => [...prev, ...res.data.list])
        setTotal(res.data.total)
        setPage(nextPage)
      }
      // 加载更多失败保持静默,下次触底重试(与 ImageGenHistoryScreen 同策略)
    } catch {
      // 同上
    } finally {
      setLoadingMore(false)
    }
  }, [loading, loadingMore, rows.length, total, page])

  const previewSources = useMemo(
    () => (preview ? preview.urls.map((uri) => ({ uri })) : []),
    [preview],
  )

  return (
    <>
      <SharedImageGenGalleryScreen
        t={t}
        items={items}
        total={total}
        loading={loading}
        refreshing={refreshing}
        loadingMore={loadingMore}
        error={error}
        onRefresh={() => {
          setRefreshing(true)
          void load()
        }}
        onRetry={() => {
          setLoading(true)
          void load()
        }}
        onLoadMore={() => void loadMore()}
        onPreview={(urls, index) => setPreview({ urls, index })}
        onMissingImage={() =>
          appAlert(t('imageGenGallery.noImageTitle'), t('imageGenGallery.noImageHint'))
        }
        onBack={() => navigation.goBack()}
        colorScheme={resolvedTheme}
      />

      <ImagePreviewModal
        visible={preview !== null}
        source={null}
        sources={previewSources}
        initialIndex={preview?.index ?? 0}
        onClose={() => setPreview(null)}
      />
    </>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
