// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useState } from 'react'
import { Alert, FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { cancelPublishTask, listPublishTasks, retryPublishTask, type PublishTask } from '@ihui/api-client'
import { useI18n } from '../i18n'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

/**
 * 内容发布中心(M3 补齐:web /publish 在移动端的原生入口)
 * 数据源:listPublishTasks(后端 /api/publish/tasks,代理到 ai-service)
 * 桌面侧复杂运营(账号管理 / 日历排期 / 批量导入 / 扫码登录)建议留在 web,
 * 本页聚焦移动端最常用的"发布历史 + 任务状态查询"。
 */

/** 状态 → 文案 + badge 样式(与 web TaskCard STATUS_LABEL 对齐) */
const STATUS_META: Record<string, { label: string; badge: string }> = {
  success: { label: '成功', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  failed: { label: '失败', badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  partial: { label: '部分成功', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  running: { label: '运行中', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  pending: { label: '待处理', badge: 'bg-gray-100 text-gray-600 dark:bg-neutral-700 dark:text-neutral-300' },
  skipped: { label: '跳过', badge: 'bg-gray-100 text-gray-600 dark:bg-neutral-700 dark:text-neutral-300' },
}

/** 平台 id → 中文名(web 端 PLATFORM_KEY 静态映射的精简版) */
const PLATFORM_LABELS: Record<string, string> = {
  wordpress: 'WordPress',
  medium: 'Medium',
  youtube: 'YouTube',
  bilibili: '哔哩哔哩',
  douyin: '抖音',
  kuaishou: '快手',
  wechat: '微信公众号',
  toutiao: '今日头条',
  weibo: '微博',
  xiaohongshu: '小红书',
  zhihu: '知乎',
  csdn: 'CSDN',
  juejin: '掘金',
  shipinhao: '微信视频号',
}

/** 单个平台目标(运行时归一化;后端可能返回 string 或对象) */
interface PlatformLike {
  platform?: string
  success?: boolean
}

function isPlatformObject(v: string | PlatformLike): v is PlatformLike {
  return typeof v === 'object' && v !== null && 'platform' in v
}

function platformLabel(p: string | PlatformLike): string {
  const id = isPlatformObject(p) ? p.platform ?? '' : p
  return PLATFORM_LABELS[id] ?? id
}

function formatPlatforms(platforms: string[] | undefined): string {
  if (!platforms || platforms.length === 0) return ''
  // 后端契约与 api-client 类型可能不一致(对象数组 vs string[]),运行时归一化
  const raw = platforms as unknown as ReadonlyArray<string | PlatformLike>
  return raw.map(platformLabel).join('、')
}

function fmtTime(iso: string | undefined): string {
  if (!iso) return '-'
  // 简化展示:取 ISO 前 16 位(T → 空格),避免 RN Intl 兼容性问题
  return iso.replace('T', ' ').slice(0, 16)
}

export function PublishScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [items, setItems] = useState<PublishTask[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await listPublishTasks({ limit: 50 })
      if (res.success && res.data) {
        setItems(res.data.items ?? [])
      } else {
        setError(res.error || t('publish.loadFailed'))
      }
    } catch {
      setError(t('publish.loadFailed'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const successCount = items.filter((i) => i.status === 'success').length
  const failedCount = items.filter((i) => i.status === 'failed' || i.status === 'partial').length

  // 任务操作:pending/running 可取消,failed/partial 可重试(web /publish/history 同款规则)
  const [operatingId, setOperatingId] = useState<string | null>(null)

  const onCancelTask = (task: PublishTask) => {
    Alert.alert(t('publish.cancelTitle'), t('publish.cancelConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        style: 'destructive',
        onPress: async () => {
          setOperatingId(String(task.id))
          try {
            const res = await cancelPublishTask(String(task.id))
            if (!res.success) throw new Error(res.error)
            await load()
          } catch {
            Alert.alert(t('publish.operateFailed'))
          } finally {
            setOperatingId(null)
          }
        },
      },
    ])
  }

  const onRetryTask = async (task: PublishTask) => {
    setOperatingId(String(task.id))
    try {
      const res = await retryPublishTask(String(task.id))
      if (!res.success) throw new Error(res.error)
      await load()
    } catch {
      Alert.alert(t('publish.operateFailed'))
    } finally {
      setOperatingId(null)
    }
  }

  if (loading) {
    return (
      <View className={`flex-1 items-center justify-center ${resolvedTheme === 'dark' ? 'bg-neutral-900' : 'bg-white'}`}>
        <Text className="text-gray-500">{t('common.loading')}</Text>
      </View>
    )
  }

  return (
    <View className={`flex-1 ${resolvedTheme === 'dark' ? 'bg-neutral-900' : 'bg-white'}`}>
      <View className="flex-row items-center justify-between px-4 pb-2 pt-3">
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text className="text-sm text-gray-500">{t('common.back')}</Text>
        </TouchableOpacity>
        <Text className="text-base font-medium">{t('publish.title')}</Text>
        <View className="w-8" />
      </View>

      {/* 简易统计条(从当前列表计算,不再单独请求 /publish/stats) */}
      <View className="mx-4 mb-1 flex-row gap-2">
        <View className="flex-1 rounded-lg bg-gray-100 p-2 dark:bg-neutral-800">
          <Text className="text-xs text-gray-500">{t('publish.statsTotal')}</Text>
          <Text className="mt-0.5 text-base font-semibold">{items.length}</Text>
        </View>
        <View className="flex-1 rounded-lg bg-emerald-50 p-2 dark:bg-emerald-900/20">
          <Text className="text-xs text-emerald-600 dark:text-emerald-300">{t('publish.statsSuccess')}</Text>
          <Text className="mt-0.5 text-base font-semibold text-emerald-700 dark:text-emerald-300">{successCount}</Text>
        </View>
        <View className="flex-1 rounded-lg bg-red-50 p-2 dark:bg-red-900/20">
          <Text className="text-xs text-red-600 dark:text-red-300">{t('publish.statsFailed')}</Text>
          <Text className="mt-0.5 text-base font-semibold text-red-700 dark:text-red-300">{failedCount}</Text>
        </View>
      </View>

      {error ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="mb-3 text-center text-sm text-gray-500">{error}</Text>
          <TouchableOpacity
            onPress={() => {
              setLoading(true)
              void load()
            }}
            className="rounded-md bg-gray-200 px-4 py-2"
          >
            <Text className="text-sm">{t('publish.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load() }} />}
          ListEmptyComponent={
            <View className="items-center py-16">
              <Text className="text-sm text-gray-500">{t('publish.empty')}</Text>
              <Text className="mt-1 text-xs text-gray-400">{t('publish.emptyHint')}</Text>
            </View>
          }
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => {
            const status =
              STATUS_META[item.status] ??
              { label: item.status, badge: 'bg-gray-100 text-gray-600 dark:bg-neutral-700 dark:text-neutral-300' }
            const platforms = formatPlatforms(item.platforms)
            return (
              <View className="mb-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-800">
                <View className="flex-row items-start justify-between gap-2">
                  <Text className="flex-1 text-base font-medium" numberOfLines={1}>{item.title}</Text>
                  <Text className={`rounded-md px-2 py-0.5 text-xs font-medium ${status.badge}`}>{status.label}</Text>
                </View>
                {platforms ? (
                  <Text className="mt-1.5 text-xs text-gray-500" numberOfLines={1}>
                    {platforms}
                  </Text>
                ) : null}
                <Text className="mt-1.5 text-xs text-gray-400">
                  {fmtTime(item.createdAt)}
                  {item.scheduledAt ? ` · ${t('publish.scheduled')} ${fmtTime(item.scheduledAt)}` : ''}
                </Text>
                {item.errorMessage ? (
                  <Text className="mt-1.5 text-xs text-red-500" numberOfLines={2}>{item.errorMessage}</Text>
                ) : null}
                {(item.status === 'pending' || item.status === 'running' || item.status === 'failed' || item.status === 'partial') ? (
                  <View className="mt-2 flex-row gap-2">
                    {(item.status === 'pending' || item.status === 'running') ? (
                      <TouchableOpacity
                        onPress={() => onCancelTask(item)}
                        disabled={operatingId === String(item.id)}
                        className="rounded-md border border-gray-200 px-2.5 py-1 dark:border-neutral-600"
                      >
                        <Text className="text-xs text-gray-500">{t('publish.cancelTask')}</Text>
                      </TouchableOpacity>
                    ) : null}
                    {(item.status === 'failed' || item.status === 'partial') ? (
                      <TouchableOpacity
                        onPress={() => void onRetryTask(item)}
                        disabled={operatingId === String(item.id)}
                        className="rounded-md bg-blue-600 px-2.5 py-1"
                      >
                        <Text className="text-xs text-white">{t('publish.retryTask')}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}
              </View>
            )
          }}
        />
      )}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
