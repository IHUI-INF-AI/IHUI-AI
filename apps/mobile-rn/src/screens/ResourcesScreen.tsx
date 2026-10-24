// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 资源中心屏(mobile-rn 原生实现,对应 Web 端 /resources 与 /resources/[id])。
 *
 * 平台说明:
 * - 列表消费 @ihui/api-client/endpoints/resource 的 getResources;详情消费 getResourceDetail;
 *   下载消费 downloadResource(GET /api/resources/:id/download,后端返签名 URL,前端只负责打开)。
 * - 分类筛选走 GET /api/resources/categories(后端 apps/api/src/routes/resource.ts 的公开端点,
 *   api-client 目前**只有** admin 版 getAdminResourceCategories,没有公开版 wrapper),
 *   故这一段用 fetchApi 直连,不臆造一个名叫 getResourceCategories 的导出。
 * - 端点返回 ApiResult(成功载荷在 res.data),失败按 res.error 显式报错,不静默。
 * - 样式与 McpStoreScreen / ConnectorsScreen 一致:Tailwind className + resolvedTheme
 *   暗色适配 + <NavChrome><NavBar/></NavChrome> 置顶。
 * - 不实现 /resources/edit:那是 admin 端表单(必填 type/productId/introduction + 文件 FormData
 *   上传 /api/oss/resource/file,mobile-rn 侧没有对应的 api-client wrapper 也没有文件选择器),
 *   在 RN 上假接会造成"能点但存不进去"的假成功,故本屏只做浏览/搜索/详情/下载。
 */
import { useCallback, useEffect, useState } from 'react'
import { Linking, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { TextField } from '@ihui/rn-app'
import { appAlert } from '../components/BottomPops'
import {
  downloadResource,
  getResourceDetail,
  getResources,
  type Resource,
} from '@ihui/api-client/endpoints/resource'
import { fetchApi } from '@ihui/api-client'
import NavBar from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { useTheme } from '../context/ThemeContext'
import { useI18n } from '../i18n'
import { tokens } from '../theme/active-tokens'

const PAGE_SIZE = 20

/** 分类项(api-client 无公开版 wrapper,按后端 resources/categories 响应自行建模) */
interface ResourceCategory {
  id: string
  name: string
}

/** 按字节数取人类可读体积;空值统一给 '-',不猜单位 */
function formatFileSize(bytes?: number | null): string {
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

/** 日期只取到日,时区差异不在本屏处理 */
function formatDay(value?: string | null): string {
  return value ? String(value).slice(0, 10) : '-'
}

/** Resource 类型带索引签名,未声明字段取出来是 unknown,渲染前必须收窄 */
function textOf(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export function ResourcesScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const [categories, setCategories] = useState<ResourceCategory[]>([])
  const [categoryId, setCategoryId] = useState('all')
  const [search, setSearch] = useState('')
  const [keyword, setKeyword] = useState('')

  const [items, setItems] = useState<Resource[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')

  const [detail, setDetail] = useState<Resource | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [downloading, setDownloading] = useState(false)

  // 昵称式输入防抖 300ms,与 web 端一致
  useEffect(() => {
    const timer = setTimeout(() => setKeyword(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  // 分类是辅助筛选位:取不到就退化成不分类浏览,不打断主链路
  useEffect(() => {
    void (async () => {
      const res = await fetchApi<{ list: ResourceCategory[] }>('/api/resources/categories')
      if (res.success) setCategories(res.data?.list ?? [])
    })()
  }, [])

  const fetchList = useCallback(
    async (page: number): Promise<{ list: Resource[]; total: number }> => {
      const res = await getResources({
        page,
        pageSize: PAGE_SIZE,
        ...(categoryId !== 'all' ? { categoryId } : {}),
        ...(keyword ? { title: keyword } : {}),
      })
      if (!res.success) throw new Error(res.error || t('resources.loadFailed'))
      return { list: res.data?.list ?? [], total: res.data?.total ?? 0 }
    },
    [categoryId, keyword, t],
  )

  const load = useCallback(async () => {
    setError('')
    try {
      const page = await fetchList(1)
      setItems(page.list)
      setTotal(page.total)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('resources.loadFailed'))
      setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [fetchList, t])

  useEffect(() => {
    setLoading(true)
    void load()
  }, [load])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    void load()
  }, [load])

  const hasMore = items.length > 0 && items.length < total

  const onLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const nextPage = Math.floor(items.length / PAGE_SIZE) + 1
      const page = await fetchList(nextPage)
      setItems((prev) => [...prev, ...page.list])
      setTotal(page.total)
    } catch (e) {
      appAlert(t('common.loadFailed'), e instanceof Error ? e.message : t('resources.loadFailed'))
    } finally {
      setLoadingMore(false)
    }
  }, [fetchList, hasMore, items.length, loadingMore, t])

  const openDetail = useCallback(
    async (item: Resource) => {
      setDetail(item)
      setDetailError('')
      setDetailLoading(true)
      try {
        const res = await getResourceDetail(item.id)
        if (!res.success) {
          setDetailError(res.error || t('resources.detailFailed'))
          return
        }
        setDetail(res.data?.resource ?? item)
      } catch (e) {
        setDetailError(e instanceof Error ? e.message : t('resources.detailFailed'))
      } finally {
        setDetailLoading(false)
      }
    },
    [t],
  )

  const closeDetail = useCallback(() => {
    setDetail(null)
    setDetailError('')
  }, [])

  const doDownload = useCallback(
    async (id: string) => {
      setDownloading(true)
      try {
        const res = await downloadResource(id)
        if (!res.success) throw new Error(res.error || t('resources.downloadFailed'))
        const url = res.data?.url
        if (!url) throw new Error(t('resources.noDownloadUrl'))
        await Linking.openURL(url)
      } catch (e) {
        appAlert(
          t('common.loadFailed'),
          e instanceof Error ? e.message : t('resources.downloadFailed'),
        )
      } finally {
        setDownloading(false)
      }
    },
    [t],
  )

  // 外链在系统浏览器打开:下载前二次确认,不静默跳出 App
  const onDownload = useCallback(
    (item: Resource) => {
      appAlert(t('resources.download'), t('resources.downloadConfirm'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.confirm'), onPress: () => void doDownload(item.id) },
      ])
    },
    [doDownload, t],
  )

  const listContent = () => {
    if (loading) {
      return (
        <View className="flex-1 items-center justify-center">
          <Text className="text-sm text-neutral-500 dark:text-neutral-400">{t('common.loading')}</Text>
        </View>
      )
    }
    if (error) {
      return (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="mb-3 text-sm text-neutral-600 dark:text-neutral-300">{error}</Text>
          <TouchableOpacity
            onPress={() => void load()}
            className="rounded-sm bg-neutral-900 px-4 py-2 min-h-[44px]"
          >
            <Text className="text-sm text-neutral-50">{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      )
    }
    return (
      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {items.length === 0 && !hasMore ? (
          <View className="items-center py-16">
            <Text className="text-sm text-neutral-500 dark:text-neutral-400">{t('resources.empty')}</Text>
          </View>
        ) : null}

        {items.map((item) => (
          <TouchableOpacity key={item.id} onPress={() => void openDetail(item)}>
            <View className="mx-4 mb-3 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
              <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {item.title}
              </Text>
              {item.intro ? (
                <Text
                  className="mt-1 text-xs text-neutral-600 dark:text-neutral-400"
                  numberOfLines={2}
                >
                  {item.intro}
                </Text>
              ) : null}
              <View className="mt-2 flex-row flex-wrap items-center">
                {item.fileType ? (
                  <Text className="mr-3 text-xs text-neutral-500 dark:text-neutral-400">{item.fileType}</Text>
                ) : null}
                <Text className="mr-3 text-xs text-neutral-500 dark:text-neutral-400">
                  {t('resources.fileSize')}: {formatFileSize(item.fileSize)}
                </Text>
                <Text className="mr-3 text-xs text-neutral-500 dark:text-neutral-400">
                  {t('resources.viewCount')}: {item.viewCount ?? 0}
                </Text>
                <Text className="text-xs text-neutral-500 dark:text-neutral-400">
                  {t('resources.downloadCount')}: {item.downloadCount ?? 0}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}

        {hasMore ? (
          <TouchableOpacity
            disabled={loadingMore}
            onPress={() => void onLoadMore()}
            className="mx-4 mb-6 items-center rounded-sm border border-neutral-300 py-2 dark:border-neutral-700 min-h-[44px]"
          >
            <Text className="text-xs text-neutral-700 dark:text-neutral-300">
              {loadingMore ? t('common.loading') : t('resources.loadMore')}
            </Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    )
  }

  const detailContent = () => {
    if (!detail) return null
    const resource = detail
    const categoryName = textOf(resource.categoryName)
    const introduction = resource.introduction ?? resource.intro ?? null
    const canDownload = Boolean(resource.fileUrl)
    return (
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={detailLoading} onRefresh={() => void openDetail(resource)} />
        }
      >
        <View className="mx-4 mb-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <Text className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            {resource.title}
          </Text>
          {resource.intro ? (
            <Text className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
              {resource.intro}
            </Text>
          ) : null}

          <View className="mt-3 flex-row flex-wrap items-center">
            {categoryName ? (
              <Text className="mr-3 text-xs text-neutral-500 dark:text-neutral-400">{categoryName}</Text>
            ) : null}
            {resource.fileType ? (
              <Text className="mr-3 text-xs text-neutral-500 dark:text-neutral-400">{resource.fileType}</Text>
            ) : null}
            <Text className="mr-3 text-xs text-neutral-500 dark:text-neutral-400">
              {t('resources.fileSize')}: {formatFileSize(resource.fileSize)}
            </Text>
            <Text className="mr-3 text-xs text-neutral-500 dark:text-neutral-400">
              {t('resources.viewCount')}: {resource.viewCount ?? 0}
            </Text>
            <Text className="text-xs text-neutral-500 dark:text-neutral-400">
              {t('resources.downloadCount')}: {resource.downloadCount ?? 0}
            </Text>
          </View>

          <Text className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            {t('resources.publishedAt', { date: formatDay(resource.createdAt) })}
          </Text>

          {detailError ? (
            <Text className="mt-3 text-xs text-red-600 dark:text-red-400">{detailError}</Text>
          ) : null}
        </View>

        <View className="mx-4 mb-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {t('resources.introTitle')}
          </Text>
          <Text className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
            {introduction ? introduction : t('resources.noIntro')}
          </Text>
        </View>

        {canDownload ? (
          <TouchableOpacity
            disabled={downloading}
            onPress={() => onDownload(resource)}
            className="mx-4 mb-6 items-center rounded-sm bg-neutral-900 py-2.5 dark:bg-neutral-100 min-h-[44px]"
          >
            <Text className="text-sm text-neutral-50 dark:text-neutral-900">
              {t('resources.download')}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text className="mx-4 mb-6 text-xs text-neutral-500 dark:text-neutral-400">{t('resources.noFile')}</Text>
        )}
      </ScrollView>
    )
  }

  return (
    <View className={`flex-1 ${isDark ? 'bg-neutral-950' : 'bg-neutral-50'}`}>
      <NavChrome>
        <NavBar title={t('resources.title')} onBack={detail ? closeDetail : undefined} />
      </NavChrome>

      {detail ? (
        detailContent()
      ) : (
        <>
          <View className="px-4 pb-2">
            <Text className="mb-1 text-xs text-neutral-500 dark:text-neutral-400">{t('resources.subtitle')}</Text>
            <TextField
              colorScheme={resolvedTheme}
              value={search}
              onChangeText={setSearch}
              placeholder={t('resources.searchPlaceholder')}
              placeholderTextColor={tokens.text.tertiary}
              className="h-9 rounded-sm border border-neutral-200 bg-white px-3 text-sm text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100 min-h-[44px]"
            />
          </View>

          {categories.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4 pb-2">
              <TouchableOpacity
                onPress={() => setCategoryId('all')}
                className={`mr-2 rounded-sm px-3 py-1.5 min-h-[44px] ${
                  categoryId === 'all'
                    ? 'bg-neutral-900 dark:bg-neutral-100'
                    : 'bg-neutral-200 dark:bg-neutral-800'
                }`}
              >
                <Text
                  className={`text-xs ${
                    categoryId === 'all'
                      ? 'text-neutral-50 dark:text-neutral-900'
                      : 'text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  {t('resources.allCategories')}
                </Text>
              </TouchableOpacity>
              {categories.map((category) => {
                const active = categoryId === category.id
                return (
                  <TouchableOpacity
                    key={category.id}
                    onPress={() => setCategoryId(category.id)}
                    className={`mr-2 rounded-sm px-3 py-1.5 min-h-[44px] ${
                      active
                        ? 'bg-neutral-900 dark:bg-neutral-100'
                        : 'bg-neutral-200 dark:bg-neutral-800'
                    }`}
                  >
                    <Text
                      className={`text-xs ${
                        active
                          ? 'text-neutral-50 dark:text-neutral-900'
                          : 'text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          ) : null}

          {listContent()}
        </>
      )}
    </View>
  )
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
