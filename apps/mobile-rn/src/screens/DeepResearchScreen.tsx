// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 深度研究屏(mobile-rn 原生实现,对应 Web 端 /deep-research)。
 *
 * 平台说明:
 * - 消费 @ihui/api-client/endpoints/research 的 startResearch / getResearchReport。
 *   这两个函数**失败即 throw**(不像 ApiResult 端点那样返回 res.success),因此本屏统一
 *   用 try/catch 收口,不写 `res.error` 那种形状 —— 形状按端点文件实测,不凭猜。
 * - 启动拿到 research_id 后按 2.5s 轮询快照,finished / error 自动停轮询;卸载清定时器。
 * - 来源分级(authoritative / media / community / unknown)与阶段态(running / done /
 *   skipped)一律映射到词表键,**不裸显英文枚举**;认不出的值落「未知」档,不静默当已知档。
 * - 样式与 McpStoreScreen 一致:Tailwind className + resolvedTheme 暗色适配 + NavBar。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { TextField } from '@ihui/rn-app'
import { appAlert } from '../components/BottomPops'
import {
  getResearchReport,
  startResearch,
  type ResearchReportDto,
  type ResearchSourceRef,
  type ResearchStage,
} from '@ihui/api-client/endpoints/research'
import NavBar from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { useTheme } from '../context/ThemeContext'
import { useI18n } from '../i18n'
import { tokens } from '../theme/active-tokens'

/** 轮询间隔(与 Web 端 POLL_INTERVAL_MS 同值,便于两端观感一致) */
const POLL_INTERVAL_MS = 2500
const MIN_ITERATIONS = 1
const MAX_ITERATIONS = 10
const EVIDENCE_PREVIEW = 20

/** 来源分级 → 词表键(认不出落「未知来源」,不裸显英文 tier) */
function sourceTierKey(tier: string): string {
  if (tier === 'authoritative') return 'deepResearch.tierAuthoritative'
  if (tier === 'media') return 'deepResearch.tierMedia'
  if (tier === 'community') return 'deepResearch.tierCommunity'
  return 'deepResearch.tierUnknown'
}

/** 阶段态 → 词表键(认不出落「未知阶段」) */
function stageStatusKey(status: string): string {
  if (status === 'running') return 'deepResearch.stageRunning'
  if (status === 'done') return 'deepResearch.stageDone'
  if (status === 'skipped') return 'deepResearch.stageSkipped'
  return 'deepResearch.stageUnknown'
}

/** 整份快照的进展态 → 词表键(error 优先,其次 finished / running) */
function reportStatusKey(report: ResearchReportDto): string {
  if (report.error) return 'deepResearch.statusError'
  if (report.finished) return 'deepResearch.statusDone'
  if (report.running || report.status === 'running') return 'deepResearch.statusRunning'
  return 'deepResearch.statusUnknown'
}

export function DeepResearchScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const [query, setQuery] = useState('')
  const [iterations, setIterations] = useState(4)
  const [starting, setStarting] = useState(false)
  const [activeId, setActiveId] = useState('')
  const [report, setReport] = useState<ResearchReportDto | null>(null)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => stopPolling, [stopPolling])

  const fetchReport = useCallback(
    async (researchId: string) => {
      try {
        const data = await getResearchReport(researchId)
        setReport(data)
        setError('')
        if (data.finished || data.error || data.status === 'error') stopPolling()
      } catch (e) {
        setError(e instanceof Error ? e.message : t('deepResearch.loadFailed'))
        stopPolling()
      } finally {
        setRefreshing(false)
      }
    },
    [stopPolling, t],
  )

  const startPolling = useCallback(
    (researchId: string) => {
      stopPolling()
      void fetchReport(researchId)
      timerRef.current = setInterval(() => void fetchReport(researchId), POLL_INTERVAL_MS)
    },
    [fetchReport, stopPolling],
  )

  /**
   * 已有研究在跑时再点开始会顶掉当前轮询中的任务(旧的 research_id 再也无人看),
   * 因此二次确认;确认后才真正发请求。
   */
  const runStart = useCallback(() => {
    const q = query.trim()
    setStarting(true)
    setError('')
    setReport(null)
    void (async () => {
      try {
        const res = await startResearch(q, iterations)
        setActiveId(res.research_id)
        setStarting(false)
        startPolling(res.research_id)
      } catch (e) {
        setError(e instanceof Error ? e.message : t('deepResearch.startFailed'))
        setStarting(false)
      }
    })()
  }, [iterations, query, startPolling, t])

  const onStart = useCallback(() => {
    if (starting || query.trim().length === 0) return
    if (report?.running) {
      appAlert(t('deepResearch.restartConfirmTitle'), t('deepResearch.restartConfirmBody'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.confirm'), onPress: runStart },
      ])
      return
    }
    runStart()
  }, [query, report, runStart, starting, t])

  const onRefresh = useCallback(() => {
    if (!activeId) {
      setRefreshing(false)
      return
    }
    setRefreshing(true)
    void fetchReport(activeId)
  }, [activeId, fetchReport])

  const clampIterations = useCallback((next: number) => {
    setIterations(Math.max(MIN_ITERATIONS, Math.min(MAX_ITERATIONS, next)))
  }, [])

  const sources: ResearchSourceRef[] = report?.sources ?? []
  const stages: ResearchStage[] = report?.stages ?? []
  const subquestions = report?.subquestions ?? []
  const evidence = report?.evidence ?? []

  return (
    <View className={`flex-1 ${isDark ? 'bg-neutral-950' : 'bg-neutral-50'}`}>
      <NavChrome>
        <NavBar title={t('deepResearch.title')} />
      </NavChrome>

      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View className="mx-4 mb-3 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
          <TextField
            colorScheme={resolvedTheme}
            value={query}
            onChangeText={setQuery}
            multiline
            numberOfLines={3}
            placeholder={t('deepResearch.queryPlaceholder')}
            placeholderTextColor={tokens.text.tertiary}
            className="rounded-sm border border-neutral-200 px-3 py-2 text-sm text-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
          />
          <View className="mt-3 flex-row items-center">
            <Text className="mr-2 text-xs text-neutral-600 dark:text-neutral-400">
              {t('deepResearch.maxIterations')}
            </Text>
            <TouchableOpacity
              onPress={() => clampIterations(iterations - 1)}
              className="rounded-sm bg-neutral-200 px-2.5 py-1 dark:bg-neutral-800"
            >
              <Text className="text-xs text-neutral-700 dark:text-neutral-300">-</Text>
            </TouchableOpacity>
            <Text className="mx-3 min-w-6 text-center text-sm text-neutral-900 dark:text-neutral-100">
              {iterations}
            </Text>
            <TouchableOpacity
              onPress={() => clampIterations(iterations + 1)}
              className="rounded-sm bg-neutral-200 px-2.5 py-1 dark:bg-neutral-800"
            >
              <Text className="text-xs text-neutral-700 dark:text-neutral-300">+</Text>
            </TouchableOpacity>
            <View className="flex-1" />
            <TouchableOpacity
              disabled={starting || query.trim().length === 0}
              onPress={onStart}
              className={`rounded-sm px-4 py-2 ${
                starting || query.trim().length === 0
                  ? 'bg-neutral-300 dark:bg-neutral-800'
                  : 'bg-neutral-900 dark:bg-neutral-100'
              }`}
            >
              <Text
                className={`text-xs ${
                  starting || query.trim().length === 0
                    ? 'text-neutral-600'
                    : 'text-neutral-50 dark:text-neutral-900'
                }`}
              >
                {starting ? t('deepResearch.starting') : t('deepResearch.start')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {error ? (
          <View className="mx-4 mb-3 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
            <Text className="text-xs text-red-700 dark:text-red-300">{error}</Text>
          </View>
        ) : null}

        {!report ? (
          <View className="items-center py-12">
            <Text className="text-sm text-neutral-500">{t('deepResearch.idle')}</Text>
          </View>
        ) : (
          <>
            <View className="mx-4 mb-3 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {t('deepResearch.status')}
                </Text>
                <Text className="text-xs text-neutral-600 dark:text-neutral-400">
                  {t(reportStatusKey(report))}
                </Text>
              </View>
              {report.iteration !== undefined && report.max_iterations ? (
                <Text className="mt-1 text-xs text-neutral-500">
                  {t('deepResearch.iteration', {
                    cur: report.iteration,
                    max: report.max_iterations,
                  })}
                </Text>
              ) : null}
              {report.error ? (
                <Text className="mt-2 text-xs text-red-600 dark:text-red-400">{report.error}</Text>
              ) : null}
            </View>

            {stages.length > 0 ? (
              <View className="mx-4 mb-3 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
                <Text className="mb-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {t('deepResearch.stages')}
                </Text>
                {stages.map((stage, index) => (
                  <View key={`${stage.phase}-${index}`} className="mb-2 flex-row items-start">
                    <View className="mr-2 mt-1 h-1.5 w-1.5 rounded-full bg-neutral-400" />
                    <View className="flex-1">
                      <Text className="text-xs font-medium text-neutral-800 dark:text-neutral-200">
                        {stage.phase}
                      </Text>
                      <Text className="mt-0.5 text-xs text-neutral-500">
                        {t(stageStatusKey(stage.status))}
                        {stage.detail ? ` · ${stage.detail}` : ''}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {subquestions.length > 0 ? (
              <View className="mx-4 mb-3 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
                <Text className="mb-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {t('deepResearch.subquestions')}
                </Text>
                {subquestions.map((sq, index) => (
                  <Text
                    key={`sq-${index}`}
                    className="mb-1 text-xs text-neutral-600 dark:text-neutral-400"
                  >
                    {index + 1}. {sq}
                  </Text>
                ))}
              </View>
            ) : null}

            {evidence.length > 0 ? (
              <View className="mx-4 mb-3 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
                <Text className="mb-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {t('deepResearch.evidence', { count: evidence.length })}
                </Text>
                {evidence.slice(0, EVIDENCE_PREVIEW).map((item, index) => (
                  <View key={`ev-${index}`} className="mb-2">
                    <Text className="text-xs font-medium text-neutral-800 dark:text-neutral-200">
                      {item.question}
                    </Text>
                    <Text className="mt-0.5 text-xs text-neutral-500">
                      {t('deepResearch.evidenceDepth', { depth: item.depth })} ·{' '}
                      {item.content.slice(0, 80)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {report.markdown ? (
              <View className="mx-4 mb-3 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
                <View className="mb-2 flex-row items-center justify-between">
                  <Text className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    {t('deepResearch.report')}
                  </Text>
                  <Text className="text-xs text-neutral-500">
                    {t('deepResearch.sourceCount', { count: sources.length })}
                  </Text>
                </View>
                <Text
                  selectable
                  className="text-xs leading-5 text-neutral-700 dark:text-neutral-300"
                >
                  {report.markdown}
                </Text>
              </View>
            ) : report.running ? (
              <View className="items-center py-10">
                <Text className="text-sm text-neutral-500">{t('deepResearch.generating')}</Text>
              </View>
            ) : null}

            {sources.length > 0 ? (
              <View className="mx-4 mb-3 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
                <Text className="mb-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {t('deepResearch.sources')}
                </Text>
                {sources.map((src, index) => (
                  <View key={`${src.url}-${index}`} className="mb-3 pb-2">
                    <Text className="text-xs font-medium text-neutral-800 dark:text-neutral-200">
                      {src.title || src.url}
                    </Text>
                    <Text className="mt-0.5 text-xs text-neutral-500" numberOfLines={1}>
                      {src.url}
                    </Text>
                    <View className="mt-1 flex-row flex-wrap items-center">
                      <View className="mr-2 rounded-xs bg-neutral-100 px-2 py-0.5 dark:bg-neutral-800">
                        <Text className="text-xs text-neutral-700 dark:text-neutral-300">
                          {t(sourceTierKey(src.tier))}
                        </Text>
                      </View>
                      <Text className="mr-2 text-xs text-neutral-500">
                        {t('deepResearch.confidence')}: {Math.round((src.confidence ?? 0) * 100)}%
                      </Text>
                      <Text className="text-xs text-neutral-500">
                        {src.verified ? t('deepResearch.verified') : t('deepResearch.unverified')}
                      </Text>
                    </View>
                    {src.snippet ? (
                      <Text className="mt-1 text-xs text-neutral-500" numberOfLines={3}>
                        {src.snippet}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  )
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
