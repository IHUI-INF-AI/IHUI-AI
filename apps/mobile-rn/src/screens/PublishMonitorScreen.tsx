// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


import { useCallback, useEffect, useMemo, useState } from 'react'
import { Linking } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  getPublishMonitorOverview,
  refreshPublishMetrics,
  verifyPublishStyle,
  type PublishMonitorItem,
} from '@ihui/api-client'
import {
  PublishMonitorScreen as SharedPublishMonitorScreen,
  type MonitorStatusTone,
  type PublishMonitorRowView,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const NS = 'publishMonitor'

/** web 同参数(apps/web/app/(main)/publish/monitor/page.tsx:34 limit=20) */
const OVERVIEW_LIMIT = 20

/** 与 web PLATFORM_KEY 子集同源(apps/web/app/(main)/publish/helpers.ts:18-61);
 *  移动端 i18n 只备了 10 个常用平台键,其余平台落原值(与 web 缺键时同表现)。 */
const PLATFORM_KEYS: Record<string, string> = {
  bilibili: 'publish.platformBilibili',
  douyin: 'publish.platformDouyin',
  kuaishou: 'publish.platformKuaishou',
  wechat: 'publish.platformWechat',
  toutiao: 'publish.platformToutiao',
  weibo: 'publish.platformWeibo',
  xiaohongshu: 'publish.platformXiaohongshu',
  zhihu: 'publish.platformZhihu',
  juejin: 'publish.platformJuejin',
  shipinhao: 'publish.platformShipinhao',
}

/** 与 web 同表(publish/monitor/MonitorCard.tsx:140-147),partial 复用 running 文案 */
const STATUS_KEYS: Record<string, string> = {
  success: 'statusSuccess',
  failed: 'statusFailed',
  running: 'statusRunning',
  pending: 'statusPending',
  partial: 'statusRunning',
  skipped: 'statusUnknown',
}

const STATUS_TONE: Record<string, MonitorStatusTone> = {
  success: 'ok',
  failed: 'failed',
  running: 'running',
  partial: 'running',
  pending: 'neutral',
  skipped: 'neutral',
}

/**
 * RN 端「发布监测」薄壳 —— 承载 web /publish/monitor。渲染委托共享屏,本文件只管:
 * 取数(GET /api/publish/monitor/overview,契约 apps/api/src/routes/publish-routes.ts:748-751)、
 * 逐篇核验(POST .../verify:id.753-755)与指标采集(POST .../refresh-metrics:id.757-759)、
 * 概览三统计的计数口径(web page.tsx:48-50)、时间/数字 Intl 格式化、外链与「去新建发布」
 * 路由跳转、登录门(三条端点均挂插件级 authenticate,publish-routes.ts:370-373)。
 * 口径差:web 时间固定 zh-CN + Asia/Shanghai(MonitorCard.tsx:77-84),RN 走当前 locale。
 */
export function PublishMonitorScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()

  const [items, setItems] = useState<PublishMonitorItem[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [verifyingTaskId, setVerifyingTaskId] = useState<string | null>(null)
  const [metricsTaskId, setMetricsTaskId] = useState<string | null>(null)

  const timeFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
    [locale],
  )
  const numFmt = useMemo(() => new Intl.NumberFormat(locale), [locale])

  const fmtTime = useCallback(
    (value: string | null): string => {
      if (!value) return '-'
      const d = new Date(value)
      return Number.isNaN(d.getTime()) ? '-' : timeFmt.format(d)
    },
    [timeFmt],
  )

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (!user) return
      if (mode === 'refresh') setRefreshing(true)
      else setLoading(true)
      try {
        const res = await getPublishMonitorOverview(OVERVIEW_LIMIT)
        if (!res.success) {
          setError(res.error || t('common.loadFailed'))
          return
        }
        setError(null)
        setItems(res.data?.items ?? [])
      } catch {
        setError(t('common.loadFailed'))
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [user, t],
  )

  useEffect(() => {
    void load('initial')
  }, [load])

  const rows = useMemo<PublishMonitorRowView[]>(
    () =>
      items.map((item) => ({
        taskId: item.task_id,
        title: item.title || '-',
        platformText: PLATFORM_KEYS[item.platform]
          ? t(PLATFORM_KEYS[item.platform] as string)
          : item.platform,
        statusText: STATUS_KEYS[item.status] ? t(`${NS}.${STATUS_KEYS[item.status]}`) : item.status,
        statusTone: STATUS_TONE[item.status] ?? 'neutral',
        lastError: item.last_error ?? null,
        publishedUrl: item.published_url ?? null,
        createdAtText: fmtTime(item.created_at),
        finishedAtText: fmtTime(item.finished_at),
        style: item.style_check
          ? {
              passed: item.style_check.passed,
              verifyAtText: fmtTime(item.style_check.checked_at),
              contentLengthText: numFmt.format(item.style_check.content_length ?? 0),
              imagesText: `${item.style_check.images_loaded}/${item.style_check.images_total}`,
              issues: item.style_check.issues ?? [],
            }
          : null,
        resubmitCount: item.resubmit_count ?? 0,
        metrics: item.metrics
          ? {
              viewsText: numFmt.format(item.metrics.views ?? 0),
              likesText: numFmt.format(item.metrics.likes ?? 0),
              commentsText: numFmt.format(item.metrics.comments ?? 0),
              sharesText: numFmt.format(item.metrics.shares ?? 0),
              collectedAtText: fmtTime(item.metrics.collected_at),
            }
          : null,
      })),
    [items, t, fmtTime, numFmt],
  )

  /** web 同口径(page.tsx:48-50):成功/失败按 status,核验未过 = 有核验且 passed=false */
  const summary = useMemo(
    () => ({
      success: items.filter((i) => i.status === 'success').length,
      failed: items.filter((i) => i.status === 'failed').length,
      unverified: items.filter((i) => i.style_check && !i.style_check.passed).length,
    }),
    [items],
  )

  const onVerify = useCallback(
    async (taskId: string) => {
      setVerifyingTaskId(taskId)
      setNotice(null)
      try {
        const res = await verifyPublishStyle(taskId)
        if (!res.success || !res.data) {
          setNotice(res.error || t(`${NS}.verifyFailed`))
          return
        }
        setNotice(res.data.passed ? t(`${NS}.verifyPassed`) : t(`${NS}.verifyFailed`))
        await load('refresh')
      } catch {
        setNotice(t('common.loadFailed'))
      } finally {
        setVerifyingTaskId(null)
      }
    },
    [load, t],
  )

  const onRefreshMetrics = useCallback(
    async (taskId: string) => {
      setMetricsTaskId(taskId)
      setNotice(null)
      try {
        const res = await refreshPublishMetrics(taskId)
        if (!res.success) {
          setNotice(res.error || t(`${NS}.refreshMetrics`))
          return
        }
        setNotice(t(`${NS}.refreshMetrics`))
        await load('refresh')
      } catch {
        setNotice(t('common.loadFailed'))
      } finally {
        setMetricsTaskId(null)
      }
    },
    [load, t],
  )

  return (
    <SharedPublishMonitorScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loginRequiredText={user ? '' : t('common.login')}
      loading={loading}
      refreshing={refreshing}
      error={error}
      notice={notice}
      rows={user ? rows : []}
      summary={summary}
      onRefresh={() => void load('refresh')}
      verifyingTaskId={verifyingTaskId}
      onVerify={(taskId) => void onVerify(taskId)}
      metricsTaskId={metricsTaskId}
      onRefreshMetrics={(taskId) => void onRefreshMetrics(taskId)}
      onOpenUrl={(url) => {
        if (url) void Linking.openURL(url)
      }}
      onGoCreate={() => navigation.navigate('PublishNew')}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
