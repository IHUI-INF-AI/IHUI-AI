// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 主动巡逻 Agent 屏(mobile-rn 原生实现,对应 Web 端 /patrol)。
 *
 * 平台说明:
 * - 消费 @ihui/api-client/endpoints/patrol 的 listPatrolTasks / createPatrolTask /
 *   updatePatrolTask / deletePatrolTask / runPatrolTaskNow / listPatrolRuns,不跨端 import web 文件。
 * - 该组端点内部已 assertOk 收敛:**成功直接返回载荷、失败抛 Error**,
 *   所以这里一律 try/catch 取 e.message,不读 res.error(读不到,也没有 res.success)。
 * - 删除会 cascade 掉巡检历史 ⇒ 二次确认走 appAlert(AGENTS §4 禁原生弹窗)。
 * - 样式与 McpStoreScreen 一致:Tailwind className + resolvedTheme 暗色适配 + NavBar。
 */
import { useCallback, useEffect, useState } from 'react'
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { appAlert } from '../components/BottomPops'
import {
  createPatrolTask,
  deletePatrolTask,
  listPatrolRuns,
  listPatrolTasks,
  runPatrolTaskNow,
  updatePatrolTask,
  type PatrolRun,
  type PatrolRunStatus,
  type PatrolTask,
  type PatrolType,
} from '@ihui/api-client/endpoints/patrol'
import NavBar from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { TextField } from '@ihui/rn-app'
import { useTheme } from '../context/ThemeContext'
import { useI18n } from '../i18n'

type Translate = (key: string, params?: Record<string, string | number>) => string

/** 巡检类型 → i18n 键(静态映射,新增类型必须同步补五语言) */
const TYPE_LABEL_KEYS: Record<PatrolType, string> = {
  ci: 'patrol.typeCi',
  dependency: 'patrol.typeDependency',
  log: 'patrol.typeLog',
  deadlink: 'patrol.typeDeadlink',
  workspace: 'patrol.typeWorkspace',
  custom: 'patrol.typeCustom',
}

const TYPE_OPTIONS: readonly PatrolType[] = [
  'ci',
  'dependency',
  'log',
  'deadlink',
  'workspace',
  'custom',
]

/** 单次巡检结论 → i18n 键 */
const RESULT_LABEL_KEYS: Record<PatrolRunStatus, string> = {
  ok: 'patrol.resultOk',
  issue: 'patrol.resultIssue',
  error: 'patrol.resultError',
}

const DEFAULT_RRULE = 'FREQ=DAILY;BYHOUR=9;BYMINUTE=0'

function formatDateTime(value: string | null): string {
  if (!value) return '-'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString()
}

/**
 * rrule → 人读计划描述(对齐 web 端 rruleToParts 的语义,但只覆盖 patrol 实际会下发的
 * HOURLY/DAILY/WEEKLY 三档;解析不出就原样回显 rrule,不臆造频率)。
 */
function describeRrule(rrule: string, t: Translate): string {
  const hour = /BYHOUR=(\d{1,2})/.exec(rrule)?.[1] ?? '0'
  const minute = /BYMINUTE=(\d{1,2})/.exec(rrule)?.[1] ?? '0'
  const time = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`
  if (rrule.includes('FREQ=HOURLY')) return t('patrol.freqHourly')
  if (rrule.includes('FREQ=WEEKLY')) return t('patrol.freqWeekly', { time })
  if (rrule.includes('FREQ=DAILY')) return t('patrol.freqDaily', { time })
  return rrule
}

export function PatrolScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const [items, setItems] = useState<PatrolTask[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')

  const [formOpen, setFormOpen] = useState(false)
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState<PatrolType>('ci')
  const [formTarget, setFormTarget] = useState('')
  const [formRrule, setFormRrule] = useState(DEFAULT_RRULE)
  const [submitting, setSubmitting] = useState(false)

  const [historyId, setHistoryId] = useState('')
  const [runs, setRuns] = useState<PatrolRun[]>([])
  const [runsLoading, setRunsLoading] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const data = await listPatrolTasks({ limit: 100 })
      setItems(data.items ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : t('patrol.loadFailed'))
      setItems([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    void load()
  }, [load])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    void load()
  }, [load])

  const onSubmit = useCallback(() => {
    if (!formName.trim()) {
      appAlert(t('patrol.formTitle'), t('patrol.nameRequired'))
      return
    }
    if (!formRrule.trim()) {
      appAlert(t('patrol.formTitle'), t('patrol.rruleRequired'))
      return
    }
    setSubmitting(true)
    void (async () => {
      try {
        await createPatrolTask({
          name: formName.trim(),
          patrolType: formType,
          rrule: formRrule.trim(),
          ...(formTarget.trim() ? { target: formTarget.trim() } : {}),
        })
        setFormOpen(false)
        setFormName('')
        setFormTarget('')
        setFormRrule(DEFAULT_RRULE)
        await load()
      } catch (e) {
        appAlert(t('patrol.formFailed'), e instanceof Error ? e.message : t('patrol.formFailed'))
      } finally {
        setSubmitting(false)
      }
    })()
  }, [formName, formRrule, formTarget, formType, load, t])

  const onRunNow = useCallback(
    (task: PatrolTask) => {
      setBusyId(task.id)
      void (async () => {
        try {
          const res = await runPatrolTaskNow(task.id)
          appAlert(
            t('patrol.runNowDone'),
            res.status === 'issue'
              ? t('patrol.runNowIssue')
              : res.summary.slice(0, 120) || t('patrol.resultOk'),
          )
          await load()
        } catch (e) {
          appAlert(
            t('patrol.runNowFailed'),
            e instanceof Error ? e.message : t('patrol.runNowFailed'),
          )
        } finally {
          setBusyId('')
        }
      })()
    },
    [load, t],
  )

  const onToggleStatus = useCallback(
    (task: PatrolTask) => {
      const next = task.status === 'active' ? 'paused' : 'active'
      setBusyId(task.id)
      void (async () => {
        try {
          await updatePatrolTask(task.id, { status: next })
          appAlert(next === 'active' ? t('patrol.resumeDone') : t('patrol.pauseDone'))
          await load()
        } catch (e) {
          appAlert(
            t('patrol.updateFailed'),
            e instanceof Error ? e.message : t('patrol.updateFailed'),
          )
        } finally {
          setBusyId('')
        }
      })()
    },
    [load, t],
  )

  const onDelete = useCallback(
    (task: PatrolTask) => {
      appAlert(t('patrol.actionDelete'), t('patrol.confirmDelete', { name: task.name }), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            setBusyId(task.id)
            void (async () => {
              try {
                await deletePatrolTask(task.id)
                appAlert(t('patrol.deleteDone'))
                await load()
              } catch (e) {
                appAlert(
                  t('patrol.deleteFailed'),
                  e instanceof Error ? e.message : t('patrol.deleteFailed'),
                )
              } finally {
                setBusyId('')
              }
            })()
          },
        },
      ])
    },
    [load, t],
  )

  const onToggleHistory = useCallback(
    (task: PatrolTask) => {
      if (historyId === task.id) {
        setHistoryId('')
        setRuns([])
        return
      }
      setHistoryId(task.id)
      setRuns([])
      setRunsLoading(true)
      void (async () => {
        try {
          const data = await listPatrolRuns(task.id, { limit: 20 })
          setRuns(data.items ?? [])
        } catch (e) {
          appAlert(t('patrol.loadFailed'), e instanceof Error ? e.message : t('patrol.loadFailed'))
        } finally {
          setRunsLoading(false)
        }
      })()
    },
    [historyId, t],
  )

  const inputClass =
    'rounded-sm border px-3 py-2 text-sm border-neutral-300 bg-white text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100'

  return (
    <View className={`flex-1 ${isDark ? 'bg-neutral-950' : 'bg-neutral-50'}`}>
      <NavChrome>
        <NavBar title={t('patrol.title')} subtitle={t('patrol.subtitle')} />
      </NavChrome>

      <View className="flex-row items-center px-4 pb-2">
        <TouchableOpacity
          onPress={() => {
            setFormOpen((v) => !v)
          }}
          className="mr-2 rounded-sm bg-neutral-900 px-3 py-1.5 dark:bg-neutral-100"
        >
          <Text className="text-xs text-neutral-50 dark:text-neutral-900">
            {t('patrol.create')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          disabled={loading}
          onPress={onRefresh}
          className="rounded-sm border border-neutral-300 px-3 py-1.5 dark:border-neutral-700"
        >
          <Text className="text-xs text-neutral-700 dark:text-neutral-300">
            {t('patrol.refresh')}
          </Text>
        </TouchableOpacity>
      </View>

      {formOpen ? (
        <View className="mx-4 mb-3 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
          <Text className="mb-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {t('patrol.formTitle')}
          </Text>
          <Text className="mb-1 text-xs text-neutral-600 dark:text-neutral-400">
            {t('patrol.formName')}
          </Text>
          <TextField
            colorScheme={resolvedTheme}
            value={formName}
            onChangeText={setFormName}
            placeholder={t('patrol.formNamePlaceholder')}
            className={inputClass}
          />
          <Text className="mb-1 mt-2 text-xs text-neutral-600 dark:text-neutral-400">
            {t('patrol.formType')}
          </Text>
          <View className="flex-row flex-wrap">
            {TYPE_OPTIONS.map((k) => {
              const active = formType === k
              return (
                <TouchableOpacity
                  key={k}
                  onPress={() => setFormType(k)}
                  className={`mb-1 mr-1 rounded-sm px-2 py-1 ${
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
                    {t(TYPE_LABEL_KEYS[k])}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
          <Text className="mb-1 mt-2 text-xs text-neutral-600 dark:text-neutral-400">
            {t('patrol.formTarget')}
          </Text>
          <TextField
            colorScheme={resolvedTheme}
            value={formTarget}
            onChangeText={setFormTarget}
            placeholder={t('patrol.formTargetPlaceholder')}
            className={inputClass}
          />
          <Text className="mb-1 mt-2 text-xs text-neutral-600 dark:text-neutral-400">
            {t('patrol.formRrule')}
          </Text>
          <TextField
            colorScheme={resolvedTheme}
            value={formRrule}
            onChangeText={setFormRrule}
            placeholder={t('patrol.formRrulePlaceholder')}
            className={inputClass}
          />
          <TouchableOpacity
            disabled={submitting}
            onPress={onSubmit}
            className="mt-3 self-start rounded-sm bg-neutral-900 px-4 py-2 dark:bg-neutral-100"
          >
            <Text className="text-xs text-neutral-50 dark:text-neutral-900">
              {t('patrol.formSubmit')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-sm text-neutral-500 dark:text-neutral-400">{t('patrol.loading')}</Text>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="mb-3 text-sm text-neutral-600 dark:text-neutral-300">{error}</Text>
          <TouchableOpacity
            onPress={() => void load()}
            className="rounded-sm bg-neutral-900 px-4 py-2"
          >
            <Text className="text-sm text-neutral-50">{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {items.length === 0 ? (
            <View className="items-center py-16">
              <Text className="text-sm text-neutral-500 dark:text-neutral-400">{t('patrol.empty')}</Text>
            </View>
          ) : (
            items.map((task) => (
              <View
                key={task.id}
                className="mx-4 mb-3 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"
              >
                <View className="flex-row flex-wrap items-center">
                  <Text className="mr-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    {task.name}
                  </Text>
                  <View className="mr-2 rounded-xs bg-neutral-100 px-2 py-0.5 dark:bg-neutral-800">
                    <Text className="text-xs text-neutral-700 dark:text-neutral-300">
                      {t(TYPE_LABEL_KEYS[task.patrolType])}
                    </Text>
                  </View>
                  <View
                    className={`rounded-xs px-2 py-0.5 ${
                      task.status === 'active'
                        ? 'bg-emerald-500/15'
                        : 'bg-neutral-200 dark:bg-neutral-800'
                    }`}
                  >
                    <Text
                      className={`text-xs ${
                        task.status === 'active'
                          ? 'text-emerald-600'
                          : 'text-neutral-600 dark:text-neutral-300'
                      }`}
                    >
                      {t(task.status === 'active' ? 'patrol.statusActive' : 'patrol.statusPaused')}
                    </Text>
                  </View>
                </View>

                <Text className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                  {describeRrule(task.rrule, t)} · {t('patrol.nextRunAt')}:{' '}
                  {formatDateTime(task.nextRunAt)}
                </Text>

                {task.lastResult ? (
                  <View className="mt-2 flex-row flex-wrap items-center">
                    <View className="mr-2 rounded-xs bg-neutral-100 px-2 py-0.5 dark:bg-neutral-800">
                      <Text
                        className={`text-xs ${
                          task.lastResult.status === 'ok'
                            ? 'text-emerald-600'
                            : task.lastResult.status === 'issue'
                              ? 'text-amber-600'
                              : 'text-red-600'
                        }`}
                      >
                        {t(RESULT_LABEL_KEYS[task.lastResult.status] ?? 'patrol.resultOk')}
                      </Text>
                    </View>
                    <Text className="flex-1 text-xs text-neutral-600 dark:text-neutral-400">
                      {task.lastResult.summary}
                    </Text>
                  </View>
                ) : null}

                <View className="mt-3 flex-row flex-wrap items-center">
                  <TouchableOpacity
                    disabled={busyId === task.id}
                    onPress={() => onRunNow(task)}
                    className="mb-1 mr-2 rounded-sm bg-neutral-900 px-3 py-1.5 dark:bg-neutral-100"
                  >
                    <Text className="text-xs text-neutral-50 dark:text-neutral-900">
                      {t('patrol.actionRunNow')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={busyId === task.id}
                    onPress={() => onToggleStatus(task)}
                    className="mb-1 mr-2 rounded-sm border border-neutral-300 px-3 py-1.5 dark:border-neutral-700"
                  >
                    <Text className="text-xs text-neutral-700 dark:text-neutral-300">
                      {t(task.status === 'active' ? 'patrol.actionPause' : 'patrol.actionResume')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={busyId === task.id}
                    onPress={() => onToggleHistory(task)}
                    className="mb-1 mr-2 rounded-sm border border-neutral-300 px-3 py-1.5 dark:border-neutral-700"
                  >
                    <Text className="text-xs text-neutral-700 dark:text-neutral-300">
                      {t('patrol.actionHistory')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={busyId === task.id}
                    onPress={() => onDelete(task)}
                    className="mb-1 rounded-sm border border-red-300 px-3 py-1.5 dark:border-red-800"
                  >
                    <Text className="text-xs text-red-600 dark:text-red-400">
                      {t('patrol.actionDelete')}
                    </Text>
                  </TouchableOpacity>
                </View>

                {historyId === task.id ? (
                  <View className="mt-2 pt-2">
                    <Text className="mb-1 text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                      {t('patrol.historyTitle')}
                    </Text>
                    {runsLoading ? (
                      <Text className="text-xs text-neutral-500 dark:text-neutral-400">{t('common.loading')}</Text>
                    ) : runs.length === 0 ? (
                      <Text className="text-xs text-neutral-500 dark:text-neutral-400">{t('patrol.historyEmpty')}</Text>
                    ) : (
                      runs.map((run) => (
                        <View key={run.id} className="mb-1">
                          <Text className="text-xs text-neutral-600 dark:text-neutral-400">
                            {formatDateTime(run.createdAt)} ·{' '}
                            {t(RESULT_LABEL_KEYS[run.status] ?? 'patrol.resultOk')} · {run.summary}
                          </Text>
                        </View>
                      ))
                    )}
                  </View>
                ) : null}
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  )
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
