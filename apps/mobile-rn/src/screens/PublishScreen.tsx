// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * PublishScreen 内容发布中心(mobile-rn 端 wrapper)
 *
 * 2026-09-15 迁移:UI 与展示逻辑下沉共享层 @ihui/rn-app PublishScreen,
 * 本 wrapper 仅保留平台特定职责:
 * - 数据:listPublishTasks(后端 /api/publish/tasks,代理到 ai-service)
 * - 任务操作:取消/重试(cancelPublishTask/retryPublishTask)+ Alert 确认
 * - 平台名本地化(platformLabels 由 t() 构造,注入共享层)
 * - 导航 goBack;主题色 / i18n 注入
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  cancelPublishTask,
  listPublishTasks,
  retryPublishTask,
  type PublishTask,
} from '@ihui/api-client'
import { PublishScreen as PublishScreenView } from '@ihui/rn-app'
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
export function PublishScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [items, setItems] = useState<PublishTask[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  // 任务操作:pending/running 可取消,failed/partial 可重试(web /publish/history 同款规则)
  const [operatingId, setOperatingId] = useState<string | null>(null)

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

  // 平台 id → 本地化名(注入共享层;拉丁平台名无需翻译)
  const platformLabels = useMemo(
    () => ({
      wordpress: 'WordPress',
      medium: 'Medium',
      youtube: 'YouTube',
      bilibili: t('publish.platformBilibili'),
      douyin: t('publish.platformDouyin'),
      kuaishou: t('publish.platformKuaishou'),
      wechat: t('publish.platformWechat'),
      toutiao: t('publish.platformToutiao'),
      weibo: t('publish.platformWeibo'),
      xiaohongshu: t('publish.platformXiaohongshu'),
      zhihu: t('publish.platformZhihu'),
      csdn: 'CSDN',
      juejin: t('publish.platformJuejin'),
      shipinhao: t('publish.platformShipinhao'),
    }),
    [t],
  )

  return (
    <PublishScreenView
      t={t}
      tasks={items}
      loading={loading}
      refreshing={refreshing}
      error={error}
      operatingId={operatingId}
      platformLabels={platformLabels}
      onRefresh={() => {
        setRefreshing(true)
        void load()
      }}
      onRetryLoad={() => {
        setLoading(true)
        void load()
      }}
      onCancelTask={onCancelTask}
      onRetryTask={(task) => void onRetryTask(task)}
      onBack={() => navigation.goBack()}
      colorScheme={resolvedTheme}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
