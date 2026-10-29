// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 验证自愈引擎屏(mobile-rn 原生实现,对应 Web 端 /self-healing)。
 *
 * 平台说明:
 * - 消费 @ihui/api-client/endpoints/self-healing 的 runSelfHealing(唯一端点),
 *   不跨端 import web 文件,也不臆造"历史列表/取消"等后端没有的能力。
 * - 端点返回 ApiResult<SelfHealingRunResponse>:成功载荷在 res.data,失败字段是 res.error
 *   (**不是 res.message**);HTTP 401 由 res.status 区分,单独提示登录。
 * - 服务端未开启(AGENT_SELF_HEALING_ENABLED)时后端仍回 HTTP 200 + code=1 +
 *   data.enabled=false —— 这是"提示"不是"报错",前端如实显示禁用说明。
 * - heal 循环真实起 pytest 子进程 + 多轮 LLM 补丁(分钟级),故整屏锁在 running 态。
 * - 样式与 McpStoreScreen 一致:Tailwind className + resolvedTheme 暗色适配 + NavBar。
 */
import { useCallback, useState } from 'react'
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { runSelfHealing, type SelfHealingOutcome } from '@ihui/api-client/endpoints/self-healing'
import NavBar from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { TextField } from '@ihui/rn-app'
import { useTheme } from '../context/ThemeContext'
import { useI18n } from '../i18n'

export function SelfHealingScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const [task, setTask] = useState('')
  const [targetPath, setTargetPath] = useState('')
  const [running, setRunning] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [needLogin, setNeedLogin] = useState(false)
  const [disabled, setDisabled] = useState(false)
  const [outcome, setOutcome] = useState<SelfHealingOutcome | null>(null)

  const run = useCallback(() => {
    if (!task.trim() || !targetPath.trim() || running) return
    setRunning(true)
    setRefreshing(false)
    setError('')
    setNeedLogin(false)
    setDisabled(false)
    setOutcome(null)
    void (async () => {
      const res = await runSelfHealing({
        task: task.trim(),
        targetPath: targetPath.trim(),
      })
      setRunning(false)
      if (!res.success) {
        if (res.status === 401) setNeedLogin(true)
        else setError(res.error || t('selfHealing.loadFailed'))
        return
      }
      const body = res.data
      if (body.code !== 0) {
        if (body.data && typeof body.data === 'object' && 'enabled' in body.data) {
          setDisabled(true)
        } else {
          setError(body.message || t('selfHealing.loadFailed'))
        }
        return
      }
      if (body.data && typeof body.data === 'object' && 'ok' in body.data) {
        setOutcome(body.data as SelfHealingOutcome)
      }
    })()
  }, [running, targetPath, task, t])

  /** 表单区本身不会自己变,下拉刷新只做"清空结果重新来过"这一件有意义的事 */
  const onRefresh = useCallback(() => {
    setRefreshing(true)
    setOutcome(null)
    setError('')
    setDisabled(false)
    setNeedLogin(false)
    setRefreshing(false)
  }, [])

  const inputClass =
    'rounded-sm border px-3 py-2 text-sm border-neutral-300 bg-white text-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100'

  const lastRun = outcome?.run_history.length
    ? outcome.run_history[outcome.run_history.length - 1]
    : null

  return (
    <View className={`flex-1 ${isDark ? 'bg-neutral-950' : 'bg-neutral-50'}`}>
      <NavChrome>
        <NavBar title={t('selfHealing.title')} subtitle={t('selfHealing.subtitle')} />
      </NavChrome>

      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View className="mx-4 mb-3 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
          <Text className="mb-1 text-xs text-neutral-600 dark:text-neutral-400">
            {t('selfHealing.taskLabel')}
          </Text>
          <TextField
            colorScheme={resolvedTheme}
            multiline
            value={task}
            onChangeText={setTask}
            placeholder={t('selfHealing.taskPlaceholder')}
            className={`${inputClass} h-20`}
          />
          <Text className="mb-1 mt-2 text-xs text-neutral-600 dark:text-neutral-400">
            {t('selfHealing.targetLabel')}
          </Text>
          <TextField
            colorScheme={resolvedTheme}
            value={targetPath}
            onChangeText={setTargetPath}
            placeholder={t('selfHealing.targetPlaceholder')}
            className={inputClass}
          />
          <Text className="mt-2 text-xs text-neutral-500">{t('selfHealing.durationHint')}</Text>
          <TouchableOpacity
            disabled={running || !task.trim() || !targetPath.trim()}
            onPress={run}
            className={`mt-3 self-start rounded-sm px-4 py-2 ${
              running || !task.trim() || !targetPath.trim()
                ? 'bg-neutral-300 dark:bg-neutral-800'
                : 'bg-neutral-900 dark:bg-neutral-100'
            }`}
          >
            <Text
              className={`text-xs ${
                running || !task.trim() || !targetPath.trim()
                  ? 'text-neutral-600 dark:text-neutral-400'
                  : 'text-neutral-50 dark:text-neutral-900'
              }`}
            >
              {running ? t('selfHealing.running') : t('selfHealing.run')}
            </Text>
          </TouchableOpacity>
        </View>

        {needLogin ? (
          <View className="mx-4 mb-3 rounded-xl border border-red-300 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950">
            <Text className="text-sm text-red-600 dark:text-red-400">
              {t('selfHealing.needLogin')}
            </Text>
          </View>
        ) : null}

        {disabled ? (
          <View className="mx-4 mb-3 rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
            <Text className="text-sm text-amber-700 dark:text-amber-400">
              {t('selfHealing.disabledHint')}
            </Text>
          </View>
        ) : null}

        {error ? (
          <View className="mx-4 mb-3 rounded-xl border border-red-300 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950">
            <Text className="text-sm text-red-600 dark:text-red-400">{error}</Text>
          </View>
        ) : null}

        {outcome ? (
          <>
            <View className="mx-4 mb-3 flex-row">
              <View className="mr-2 flex-1 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
                <Text className="mb-1 text-xs text-neutral-500">{t('selfHealing.attempts')}</Text>
                <Text className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                  {outcome.attempts}
                </Text>
              </View>
              <View className="mr-2 flex-1 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
                <Text className="mb-1 text-xs text-neutral-500">{t('selfHealing.status')}</Text>
                <Text
                  className={`text-base font-bold ${
                    outcome.final_passed ? 'text-emerald-600' : 'text-red-600'
                  }`}
                >
                  {outcome.final_passed ? t('selfHealing.healed') : t('selfHealing.notHealed')}
                </Text>
              </View>
              <View className="flex-1 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
                <Text className="mb-1 text-xs text-neutral-500">{t('selfHealing.lastRun')}</Text>
                <Text className="text-base font-bold">
                  <Text className="text-emerald-600">{lastRun?.passed ?? 0}</Text>
                  <Text className="text-neutral-400">{` / `}</Text>
                  <Text className="text-red-600">{lastRun?.failed ?? 0}</Text>
                </Text>
              </View>
            </View>

            <View className="mx-4 mb-3 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
              <Text className="mb-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {t('selfHealing.history')}
              </Text>
              {outcome.run_history.length === 0 ? (
                <Text className="py-2 text-center text-xs text-neutral-500">
                  {t('selfHealing.noHistory')}
                </Text>
              ) : (
                outcome.run_history.map((rec) => (
                  <View
                    key={rec.attempt}
                    className="mb-2 rounded-sm border border-neutral-200 p-2 dark:border-neutral-800"
                  >
                    <View className="flex-row flex-wrap items-center">
                      <View className="mr-2 rounded-xs bg-neutral-100 px-2 py-0.5 dark:bg-neutral-800">
                        <Text className="text-xs font-medium text-neutral-800 dark:text-neutral-200">
                          {`#${rec.attempt}`}
                        </Text>
                      </View>
                      <View className="mr-2 rounded-xs bg-emerald-500/15 px-2 py-0.5">
                        <Text className="text-xs text-emerald-600">
                          {t('selfHealing.passedCount', { count: rec.passed })}
                        </Text>
                      </View>
                      {rec.failed > 0 ? (
                        <View className="mr-2 rounded-xs bg-red-500/15 px-2 py-0.5">
                          <Text className="text-xs text-red-600">
                            {t('selfHealing.failedCount', { count: rec.failed })}
                          </Text>
                        </View>
                      ) : (
                        <View className="rounded-xs bg-emerald-500/15 px-2 py-0.5">
                          <Text className="text-xs font-medium text-emerald-600">
                            {t('selfHealing.allGreen')}
                          </Text>
                        </View>
                      )}
                    </View>
                    {rec.patch_applied !== null && rec.patch_applied !== undefined ? (
                      <View className="mt-1">
                        <Text className="text-xs text-neutral-500">
                          {t('selfHealing.patchApplied')}
                        </Text>
                        <Text className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                          {JSON.stringify(rec.patch_applied)}
                        </Text>
                      </View>
                    ) : (
                      <Text className="mt-1 text-xs text-neutral-500">
                        {t('selfHealing.noPatch')}
                      </Text>
                    )}
                  </View>
                ))
              )}
            </View>

            {outcome.suggestions.length > 0 ? (
              <View className="mx-4 mb-3 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
                <Text className="mb-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {t('selfHealing.suggestions')}
                </Text>
                {outcome.suggestions.map((s, i) => (
                  <Text key={i} className="mb-1 text-xs text-neutral-600 dark:text-neutral-400">
                    {`- ${s}`}
                  </Text>
                ))}
              </View>
            ) : null}
          </>
        ) : (
          <View className="items-center py-10">
            <Text className="text-sm text-neutral-500">{t('selfHealing.empty')}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
