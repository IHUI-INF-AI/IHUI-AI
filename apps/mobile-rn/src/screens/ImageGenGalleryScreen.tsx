// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 公开图库 —— 对齐 web `/image-gen/gallery`。
 *
 * 契约(按 apps/api/src/routes/other/image-gen-routes.ts 与 ai_gc_content 表实读):
 *  - `GET /api/image-gen/gallery` 返回 `{ list, total, page, pageSize }`,行 = `ai_gc_content`;
 *  - 该表只有 id/userUuid/agentId/gcType/content/status/createdAt/updatedAt,**没有 image_url 列**,
 *    web 页假设的 imageUrl/authorName/likeCount 三个字段在响应里都不存在;
 *  - `POST /image-gen/generate` 把提示词写进 `content`,所以本屏把 content 当作提示词展示;
 *    仅当旧数据的 content 本身是一个图片地址时才渲染图片(不伪造 URL,也不显示假作者/假点赞)。
 *  - 分页参数上限 pageSize=100(routes/other/_shared.ts 的 paginationSchema)。
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { ImageOff, Images } from 'lucide-react-native'
import { fetchApi, resolveFileUrl } from '@ihui/api-client'
import { rnRadius } from '@ihui/design-tokens'
import { tokens } from '../theme/active-tokens'
import { NavBar } from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import ImagePreviewModal from '../components/ImagePreviewModal'
import { appAlert } from '../components/BottomPops'
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

export default function ImageGenGalleryScreen() {
  const { t, locale } = useI18n()
  const navigation = useNavigation<NavigationProp>()

  const [items, setItems] = useState<GalleryRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)

  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }),
    [locale],
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
      setItems(res.data.list)
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
    if (loading || loadingMore || items.length >= total) return
    setLoadingMore(true)
    try {
      const nextPage = page + 1
      const res = await fetchApi<GalleryData>('/api/image-gen/gallery', {
        params: { page: nextPage, pageSize: PAGE_SIZE },
      })
      if (res.success) {
        setItems((prev) => [...prev, ...res.data.list])
        setTotal(res.data.total)
        setPage(nextPage)
      }
      // 加载更多失败保持静默,下次触底重试(与 ImageGenHistoryScreen 同策略)
    } catch {
      // 同上
    } finally {
      setLoadingMore(false)
    }
  }, [loading, loadingMore, items.length, total, page])

  /** 可预览图片集合:索引只在同一份数组上映射,避免把"第几张卡"当成"第几张图" */
  const previewables = useMemo(
    () =>
      items
        .map((item) => ({ id: item.id, url: imageUrlOf(item.content) }))
        .filter((x): x is { id: string; url: string } => x.url !== null),
    [items],
  )
  const previewSources = useMemo(() => previewables.map((x) => ({ uri: x.url })), [previewables])

  const openItem = (item: GalleryRow) => {
    const url = imageUrlOf(item.content)
    if (!url) {
      appAlert(t('imageGenGallery.noImageTitle'), t('imageGenGallery.noImageHint'))
      return
    }
    const idx = previewables.findIndex((x) => x.id === item.id)
    setPreviewIndex(idx >= 0 ? idx : 0)
  }

  const renderCard = ({ item }: { item: GalleryRow }) => {
    const url = imageUrlOf(item.content)
    return (
      <TouchableOpacity style={styles.card} onPress={() => openItem(item)} activeOpacity={0.7}>
        <View style={styles.imageBox}>
          {url ? (
            <Image source={{ uri: url }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={styles.placeholder}>
              <ImageOff size={24} color={tokens.text.tertiary} />
              <Text style={styles.placeholderText}>{t('imageGenGallery.noImage')}</Text>
            </View>
          )}
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.prompt} numberOfLines={2}>
            {item.content ?? ''}
          </Text>
          <Text style={styles.metaText}>
            {Number.isNaN(new Date(item.createdAt).getTime())
              ? '—'
              : dateFmt.format(new Date(item.createdAt))}
          </Text>
        </View>
      </TouchableOpacity>
    )
  }

  const header = (
    <View style={styles.header}>
      <Text style={styles.subtitle}>{t('imageGenGallery.subtitle')}</Text>
      {loading ? (
        <ActivityIndicator style={styles.loading} color={tokens.text.tertiary} />
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => {
              setLoading(true)
              void load()
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.retryText}>{t('imageGenGallery.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyBox}>
          <Images size={32} color={tokens.text.tertiary} />
          <Text style={styles.emptyText}>{t('imageGenGallery.empty')}</Text>
        </View>
      ) : null}
    </View>
  )

  return (
    <View style={styles.container}>
      <NavChrome>
        <NavBar title={t('imageGenGallery.title')} onBack={() => navigation.goBack()} />
      </NavChrome>

      <FlatList
        data={error ? [] : items}
        keyExtractor={(item) => item.id}
        renderItem={renderCard}
        numColumns={2}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.body}
        ListHeaderComponent={header}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true)
              void load()
            }}
            tintColor={tokens.text.tertiary}
          />
        }
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          error ? null : loadingMore ? (
            <ActivityIndicator style={styles.footerLoading} color={tokens.text.tertiary} />
          ) : items.length > 0 && items.length >= total ? (
            <Text style={styles.footerText}>{t('imageGenGallery.noMore')}</Text>
          ) : null
        }
      />

      <ImagePreviewModal
        visible={previewIndex !== null}
        source={null}
        sources={previewSources}
        initialIndex={previewIndex ?? 0}
        onClose={() => setPreviewIndex(null)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: tokens.surface.bg },
  body: { padding: 12, paddingBottom: 32, gap: 10 },
  column: { gap: 10 },
  header: { gap: 10, paddingBottom: 2 },
  subtitle: { fontSize: 13, color: tokens.text.secondary },
  loading: { paddingVertical: 24 },
  errorBox: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: rnRadius.lg,
    borderWidth: 1,
    borderColor: tokens.danger.DEFAULT,
    backgroundColor: tokens.surface.card,
    gap: 8,
  },
  errorText: { fontSize: 13, color: tokens.danger.DEFAULT },
  retryBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: rnRadius.sm,
    borderWidth: 1,
    borderColor: tokens.border.medium,
  },
  retryText: { fontSize: 13, color: tokens.text.primary },
  emptyBox: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 13, color: tokens.text.secondary },
  card: {
    flex: 1,
    borderRadius: rnRadius.lg,
    borderWidth: 1,
    borderColor: tokens.border.light,
    backgroundColor: tokens.surface.card,
    overflow: 'hidden',
  },
  imageBox: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: tokens.surface.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
  placeholder: { alignItems: 'center', gap: 6, paddingHorizontal: 8 },
  placeholderText: { fontSize: 11, color: tokens.text.tertiary, textAlign: 'center' },
  cardBody: { padding: 16, gap: 4 },
  prompt: { fontSize: 12, lineHeight: 17, color: tokens.text.primary },
  metaText: { fontSize: 11, color: tokens.text.tertiary },
  footerLoading: { paddingVertical: 16 },
  footerText: {
    paddingVertical: 16,
    textAlign: 'center',
    fontSize: 12,
    color: tokens.text.tertiary,
  },
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
