// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Agent 运行时屏(mobile-rn 原生实现,对应 Web 端 /agent-runtime)。
 *
 * 平台说明:
 * - 消费 @ihui/api-client/endpoints/agent-runtime 的 listAgentRuntimeSessions /
 *   getAgentRuntimeStatus / resumeAgentRuntimeSession / cancelAgentRuntime /
 *   checkAgentRuntimePermission。
 *   这五个函数**失败即 throw**(不是返回 ApiResult),故统一 try/catch 收口,
 *   不写 `res.error` 那种形状 —— 形状按端点文件实测。
 * - 会话档位与权限档位的措辞走唯一真源:档名一律 `permissionTierWordKeys(mode)` 取词
 *   (@ihui/types/permission-mode 是档位注册表),**绝不裸显 accept-edits 这类英文枚举**;
 *   审批结论走 `permissionDecisionWord`,认不出原样显示也不猜语义。
 * - 取消会话是破坏性动作,走 appAlert 二次确认;继续(resume)按端点注释走**按会话**
 *   的 resume,不拿暂停响应里的 checkpoint_id 去续跑(那会重跑一轮已执行的工具调用)。
 * - 样式与 McpStoreScreen 一致:Tailwind className + resolvedTheme 暗色适配 + NavBar。
 */
import { useCallback, useEffect, useState } from 'react'
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { TextField } from '@ihui/rn-app'
import { appAlert } from '../components/BottomPops'
import {
  cancelAgentRuntime,
  checkAgentRuntimePermission,
  getAgentRuntimeStatus,
  listAgentRuntimeSessions,
  resumeAgentRuntimeSession,
} from '@ihui/api-client/endpoints/agent-runtime'
import type { SessionState, SessionStatus } from '@ihui/types'
import { PERMISSION_MODE_WIRE_VALUES, type PermissionModeWire } from '@ihui/types/permission-mode'
import { permissionDecisionWord, permissionTierWordKeys } from '@ihui/shared/chat'
import NavBar from '../components/NavBar'
import { NavChrome } from '../components/NavChrome'
import { useTheme } from '../context/ThemeContext'
import { useI18n } from '../i18n'
import { tokens } from '../theme/active-tokens'

const SESSION_PAGE_SIZE = 50
const DANGER_LEVELS = ['read', 'write', 'dangerous'] as const

/** 会话态 → 词表键(认不出落「未知状态」,不裸显英文枚举) */
function sessionStatusKey(status: SessionStatus | string | undefined): string {
  if (status === 'running') return 'agentRuntime.statusRunning'
  if (status === 'completed') return 'agentRuntime.statusCompleted'
  if (status === 'failed') return 'agentRuntime.statusFailed'
  if (status === 'cancelled') return 'agentRuntime.statusCancelled'
  return 'agentRuntime.statusUnknown'
}

/** 危险级别 → 词表键(认不出落「未知级别」) */
function dangerLevelKey(level: string): string {
  if (level === 'read') return 'agentRuntime.levelRead'
  if (level === 'write') return 'agentRuntime.levelWrite'
  if (level === 'dangerous') return 'agentRuntime.levelDangerous'
  return 'agentRuntime.levelUnknown'
}

/** 长 id 只显示前 8 位,避免列表被整串 UUID 撑破 */
function shortId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id
}

export function AgentRuntimeScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const [sessions, setSessions] = useState<SessionState[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [busyKey, setBusyKey] = useState('')

  // 展开行:按需单取一次实时状态(列表里的 status 可能是上一次落库的快照)
  const [expandedId, setExpandedId] = useState('')
  const [liveStatus, setLiveStatus] = useState<Record<string, { status: string; count: number }>>(
    {},
  )

  // 权限判定探针
  const [probeTool, setProbeTool] = useState('')
  const [probeMode, setProbeMode] = useState<PermissionModeWire>('default')
  const [probeLevel, setProbeLevel] = useState<string>('read')
  const [probing, setProbing] = useState(false)
  const [probeResult, setProbeResult] = useState<{
    toolName: string
    mode: string
    dangerLevel: string
    decision: string
  } | null>(null)

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await listAgentRuntimeSessions({ limit: SESSION_PAGE_SIZE, offset: 0 })
      setSessions(res.sessions ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : t('agentRuntime.loadFailed'))
      setSessions([])
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

  const onToggleExpand = useCallback(
    (session: SessionState) => {
      if (expandedId === session.sessionId) {
        setExpandedId('')
        return
      }
      setExpandedId(session.sessionId)
      void (async () => {
        try {
          const res = await getAgentRuntimeStatus(session.sessionId)
          setLiveStatus((prev) => ({
            ...prev,
            [session.sessionId]: { status: String(res.status), count: res.messageCount },
          }))
        } catch (e) {
          appAlert(
            t('common.loadFailed'),
            e instanceof Error ? e.message : t('agentRuntime.loadFailed'),
          )
        }
      })()
    },
    [expandedId, t],
  )

  const onResume = useCallback(
    (session: SessionState) => {
      setBusyKey(session.sessionId)
      void (async () => {
        try {
          await resumeAgentRuntimeSession(session.sessionId)
          await load()
        } catch (e) {
          appAlert(
            t('agentRuntime.actionFailed'),
            e instanceof Error ? e.message : t('agentRuntime.actionFailed'),
          )
        } finally {
          setBusyKey('')
        }
      })()
    },
    [load, t],
  )

  const onCancel = useCallback(
    (session: SessionState) => {
      appAlert(t('agentRuntime.cancelConfirmTitle'), shortId(session.sessionId), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          style: 'destructive',
          onPress: () => {
            setBusyKey(session.sessionId)
            void (async () => {
              try {
                await cancelAgentRuntime(session.sessionId)
                await load()
              } catch (e) {
                appAlert(
                  t('agentRuntime.actionFailed'),
                  e instanceof Error ? e.message : t('agentRuntime.actionFailed'),
                )
              } finally {
                setBusyKey('')
              }
            })()
          },
        },
      ])
    },
    [load, t],
  )

  const onProbe = useCallback(() => {
    const tool = probeTool.trim()
    if (!tool || probing) return
    setProbing(true)
    setProbeResult(null)
    void (async () => {
      try {
        const res = await checkAgentRuntimePermission({
          toolName: tool,
          mode: probeMode,
          dangerLevel: probeLevel,
        })
        setProbeResult({
          toolName: res.toolName,
          mode: res.mode,
          dangerLevel: String(res.dangerLevel),
          decision: String(res.decision),
        })
      } catch (e) {
        appAlert(
          t('agentRuntime.probeFailed'),
          e instanceof Error ? e.message : t('agentRuntime.probeFailed'),
        )
      } finally {
        setProbing(false)
      }
    })()
  }, [probeLevel, probeMode, probeTool, probing, t])

  return (
    <View className={`flex-1 ${isDark ? 'bg-neutral-950' : 'bg-neutral-50'}`}>
      <NavChrome>
        <NavBar title={t('agentRuntime.title')} />
      </NavChrome>

      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View className="mx-4 mb-3 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
          <Text className="mb-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {t('agentRuntime.probeTitle')}
          </Text>
          <TextField
            colorScheme={resolvedTheme}
            value={probeTool}
            onChangeText={setProbeTool}
            placeholder={t('agentRuntime.probeToolPlaceholder')}
            placeholderTextColor={tokens.text.tertiary}
            className="rounded-sm border border-neutral-200 px-3 py-2 text-sm text-neutral-900 dark:border-neutral-700 dark:text-neutral-100"
          />

          <Text className="mt-3 mb-1 text-xs text-neutral-600 dark:text-neutral-400">
            {t('agentRuntime.probeMode')}
          </Text>
          <View className="flex-row flex-wrap">
            {PERMISSION_MODE_WIRE_VALUES.map((mode) => {
              const active = probeMode === mode
              const words = permissionTierWordKeys(mode)
              return (
                <TouchableOpacity
                  key={mode}
                  onPress={() => setProbeMode(mode)}
                  className={`mb-2 mr-2 rounded-sm px-3 py-1.5 min-h-[44px] ${
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
                    {t(words.title)}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <Text className="mb-1 text-xs text-neutral-600 dark:text-neutral-400">
            {t('agentRuntime.probeLevel')}
          </Text>
          <View className="flex-row flex-wrap">
            {DANGER_LEVELS.map((level) => {
              const active = probeLevel === level
              return (
                <TouchableOpacity
                  key={level}
                  onPress={() => setProbeLevel(level)}
                  className={`mb-2 mr-2 rounded-sm px-3 py-1.5 min-h-[44px] ${
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
                    {t(dangerLevelKey(level))}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <TouchableOpacity
            disabled={probing || probeTool.trim().length === 0}
            onPress={onProbe}
            className={`mt-1 self-start rounded-sm px-4 py-2 min-h-[44px] ${
              probing || probeTool.trim().length === 0
                ? 'bg-neutral-300 dark:bg-neutral-800'
                : 'bg-neutral-900 dark:bg-neutral-100'
            }`}
          >
            <Text
              className={`text-xs ${
                probing || probeTool.trim().length === 0
                  ? 'text-neutral-600'
                  : 'text-neutral-50 dark:text-neutral-900'
              }`}
            >
              {probing ? t('agentRuntime.probeChecking') : t('agentRuntime.probeCheck')}
            </Text>
          </TouchableOpacity>

          {probeResult ? (
            <View className="mt-3 rounded-sm bg-neutral-100 p-3 dark:bg-neutral-800">
              <Text className="text-xs text-neutral-700 dark:text-neutral-300">
                {t('agentRuntime.probeTool')}: {probeResult.toolName}
              </Text>
              <Text className="mt-1 text-xs text-neutral-700 dark:text-neutral-300">
                {t('agentRuntime.probeMode')}: {t(permissionTierWordKeys(probeResult.mode).title)}
              </Text>
              <Text className="mt-1 text-xs text-neutral-700 dark:text-neutral-300">
                {t('agentRuntime.probeLevel')}: {t(dangerLevelKey(probeResult.dangerLevel))}
              </Text>
              <Text className="mt-1 text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                {t('agentRuntime.probeDecision')}:{' '}
                {permissionDecisionWord(probeResult.decision, (k) => t(`stepDecision.${k}`))}
              </Text>
            </View>
          ) : (
            <Text className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">{t('agentRuntime.probeHint')}</Text>
          )}
        </View>

        {loading ? (
          <View className="items-center py-12">
            <Text className="text-sm text-neutral-500 dark:text-neutral-400">{t('common.loading')}</Text>
          </View>
        ) : error ? (
          <View className="mx-4 mb-3 rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950">
            <Text className="mb-3 text-xs text-red-700 dark:text-red-300">{error}</Text>
            <TouchableOpacity
              onPress={() => void load()}
              className="self-start rounded-sm bg-neutral-900 px-4 py-2 dark:bg-neutral-100 min-h-[44px]"
            >
              <Text className="text-xs text-neutral-50 dark:text-neutral-900">
                {t('common.retry')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : sessions.length === 0 ? (
          <View className="items-center py-12">
            <Text className="text-sm text-neutral-500 dark:text-neutral-400">{t('agentRuntime.empty')}</Text>
          </View>
        ) : (
          sessions.map((session) => {
            const live = liveStatus[session.sessionId]
            const expanded = expandedId === session.sessionId
            return (
              <TouchableOpacity
                key={session.id || session.sessionId}
                onPress={() => onToggleExpand(session)}
                activeOpacity={0.9}
                className="mx-4 mb-3 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900"
              >
                <View className="flex-row items-center justify-between">
                  <Text className="flex-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    #{shortId(session.sessionId)}
                  </Text>
                  <View className="rounded-xs bg-neutral-100 px-2 py-0.5 dark:bg-neutral-800">
                    <Text className="text-xs text-neutral-700 dark:text-neutral-300">
                      {t(sessionStatusKey(session.status))}
                    </Text>
                  </View>
                </View>

                <Text className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  {t('agentRuntime.messages', { count: live?.count ?? session.messages.length })}
                  {session.model ? ` · ${t('agentRuntime.model')}: ${session.model}` : ''}
                </Text>
                {session.error ? (
                  <Text className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {session.error}
                  </Text>
                ) : null}

                {expanded && live ? (
                  <Text className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    {t('agentRuntime.liveStatus')}: {t(sessionStatusKey(live.status))}
                  </Text>
                ) : null}

                <View className="mt-3 flex-row items-center">
                  <TouchableOpacity
                    disabled={busyKey === session.sessionId}
                    onPress={() => onResume(session)}
                    className="mr-2 rounded-sm bg-neutral-900 px-3 py-1.5 dark:bg-neutral-100 min-h-[44px]"
                  >
                    <Text className="text-xs text-neutral-50 dark:text-neutral-900">
                      {t('agentRuntime.resume')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={busyKey === session.sessionId}
                    onPress={() => onCancel(session)}
                    className="rounded-sm border border-neutral-300 px-3 py-1.5 dark:border-neutral-700 min-h-[44px]"
                  >
                    <Text className="text-xs text-neutral-700 dark:text-neutral-300">
                      {t('agentRuntime.cancel')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            )
          })
        )}
      </ScrollView>
    </View>
  )
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
