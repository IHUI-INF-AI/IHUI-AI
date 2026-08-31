// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 子智能体调度屏(mobile-rn 原生实现,对应 Web 端 /subagents)。
 *
 * 平台说明:
 * - 复用 @ihui/api-client/endpoints/subagents 端点封装(走 fetchApi 统一鉴权/超时),
 *   不跨端 import web 文件。
 * - 三段式 Tab:概览(StatsCards + 队列)/ 调度(活跃派单,可取消)/ 拓扑(节点 + 边)。
 * - 标题走 i18n key subagents.title。
 * - 样式与 KnowledgeBaseScreen 一致:Tailwind className + resolvedTheme 暗色适配 + NavBar。
 * - 端点失败时整页错误态 + 重试;支持下拉刷新。
 */
import { useCallback, useEffect, useState } from 'react'
import { Alert, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  cancelSubagentDispatch,
  getActiveSubagentDispatches,
  getSubagentQueue,
  getSubagentStats,
  getSubagentTopology,
  type SubagentDispatch,
  type SubagentGlobalStats,
  type SubagentQueueEntry,
  type SwarmTopology,
  type SwarmTopologyNode,
} from '@ihui/api-client/endpoints/subagents'
import NavBar from '../components/NavBar'
import { useTheme } from '../context/ThemeContext'
import { useI18n } from '../i18n'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

type TabKey = 'overview' | 'dispatches' | 'topology'

const TABS: ReadonlyArray<{ key: TabKey; label: string }> = [
  { key: 'overview', label: '概览' },
  { key: 'dispatches', label: '调度' },
  { key: 'topology', label: '拓扑' },
]

interface StatItem {
  key: string
  label: string
  value: number
  /** 数字后缀,如 % */
  suffix?: string
}

/** 状态徽章样式 + 文案(暗色由调用方用 Tailwind dark: 变体处理) */
function statusBadgeClass(status: string): string {
  switch (status) {
    case 'running':
      return 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
    case 'pending':
      return 'bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-300'
    case 'completed':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
    case 'failed':
      return 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300'
    case 'cancelled':
    case 'paused':
    default:
      return 'bg-gray-200 text-gray-500 dark:bg-neutral-700 dark:text-neutral-400'
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'running':
      return '运行中'
    case 'pending':
      return '排队中'
    case 'completed':
      return '已完成'
    case 'failed':
      return '失败'
    case 'cancelled':
      return '已取消'
    case 'paused':
      return '已暂停'
    default:
      return status
  }
}

function priorityLabel(priority: string): string {
  switch (priority) {
    case 'urgent':
      return '紧急'
    case 'high':
      return '高'
    case 'low':
      return '低'
    default:
      return '普通'
  }
}

/** 从统计计算总派单(兼容 web/shared totalDispatches 与后端 total 漂移) */
function statsTotal(stats: SubagentGlobalStats | null): number {
  return stats?.total ?? stats?.totalDispatches ?? 0
}

/** 队列条目取 ID(兼容 web/shared id 与后端 dispatchId 漂移) */
function queueEntryId(entry: SubagentQueueEntry): string {
  return entry.id ?? entry.dispatchId ?? ''
}

/** 拓扑节点展示名(兼容 V1 agentRole/task 与 V2 label/role 漂移) */
function topologyNodeName(node: SwarmTopologyNode): string {
  return node.label ?? node.role ?? node.agentRole ?? node.id
}

export function SubagentsScreen() {
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const [tab, setTab] = useState<TabKey>('overview')
  const [stats, setStats] = useState<SubagentGlobalStats | null>(null)
  const [queue, setQueue] = useState<SubagentQueueEntry[]>([])
  const [dispatches, setDispatches] = useState<SubagentDispatch[]>([])
  const [topology, setTopology] = useState<SwarmTopology | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [cancellingId, setCancellingId] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const [statsRes, queueRes, dispatchRes, topoRes] = await Promise.all([
        getSubagentStats(),
        getSubagentQueue(),
        getActiveSubagentDispatches(),
        getSubagentTopology(),
      ])
      setStats(statsRes)
      setQueue(queueRes.queue)
      setDispatches(dispatchRes.dispatches)
      setTopology(topoRes.topology)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.loadFailed'))
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

  const onRetry = useCallback(() => {
    setLoading(true)
    void load()
  }, [load])

  const onCancelDispatch = useCallback(
    (d: SubagentDispatch) => {
      Alert.alert('取消派单', `确认取消「${d.goal}」?`, [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          style: 'destructive',
          onPress: async () => {
            setCancellingId(d.id)
            try {
              await cancelSubagentDispatch(d.id)
              setDispatches((prev) => prev.filter((x) => x.id !== d.id))
            } catch (e) {
              Alert.alert(t('common.loadFailed'), e instanceof Error ? e.message : '取消失败')
            } finally {
              setCancellingId('')
            }
          },
        },
      ])
    },
    [t],
  )

  const total = statsTotal(stats)
  const activeCount = stats?.active ?? 0
  const completedCount = stats?.completed ?? 0
  const successRate = total > 0 ? Math.round((completedCount / total) * 100) : 0
  const statItems: StatItem[] = [
    { key: 'total', label: '总调度', value: total },
    { key: 'active', label: '运行中', value: activeCount },
    { key: 'successRate', label: '成功率', value: successRate, suffix: '%' },
    { key: 'queue', label: '队列长度', value: queue.length },
  ]

  const bgClass = resolvedTheme === 'dark' ? 'bg-neutral-900' : 'bg-white'
  const cardClass =
    resolvedTheme === 'dark' ? 'border-neutral-700 bg-neutral-800' : 'border-gray-200 bg-white'
  const textPrimary = resolvedTheme === 'dark' ? 'text-white' : 'text-gray-900'
  const textSecondary = resolvedTheme === 'dark' ? 'text-neutral-400' : 'text-gray-500'
  const textTertiary = resolvedTheme === 'dark' ? 'text-neutral-500' : 'text-gray-400'

  if (loading) {
    return (
      <View className={`flex-1 ${bgClass}`}>
        <NavBar title={t('subagents.title')} onBack={() => navigation.goBack()} />
        <View className="flex-1 items-center justify-center">
          <Text className={`text-sm ${textSecondary}`}>{t('common.loading')}</Text>
        </View>
      </View>
    )
  }

  return (
    <View className={`flex-1 ${bgClass}`}>
      <NavBar title={t('subagents.title')} onBack={() => navigation.goBack()} />

      {/* 分段切换(概览 / 调度 / 拓扑) */}
      <View className="flex-row gap-2 px-4 pb-3 pt-3">
        {TABS.map((item) => {
          const active = tab === item.key
          return (
            <TouchableOpacity
              key={item.key}
              onPress={() => setTab(item.key)}
              activeOpacity={0.8}
              className={`flex-1 items-center rounded-lg py-2 ${
                active
                  ? 'bg-black dark:bg-white'
                  : resolvedTheme === 'dark'
                    ? 'bg-neutral-800'
                    : 'bg-gray-100'
              }`}
            >
              <Text
                className={`text-sm ${
                  active
                    ? 'font-medium text-white dark:text-black'
                    : resolvedTheme === 'dark'
                      ? 'text-neutral-400'
                      : 'text-gray-500'
                }`}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {error ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className={`mb-3 text-center text-sm ${textSecondary}`}>{error}</Text>
          <TouchableOpacity
            onPress={onRetry}
            className="rounded-md bg-gray-200 px-4 py-2 dark:bg-neutral-700"
          >
            <Text className={`text-sm ${textPrimary}`}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {tab === 'overview' ? (
            <>
              {/* 概览:StatsCards(总调度/运行中/成功率/队列长度) */}
              <View className="flex-row flex-wrap justify-between">
                {statItems.map((it) => (
                  <View
                    key={it.key}
                    className={`mb-3 w-[48.5%] rounded-lg border p-4 ${cardClass}`}
                  >
                    <Text className={`text-xs ${textSecondary}`}>{it.label}</Text>
                    <Text className={`mt-1 text-2xl font-semibold ${textPrimary}`}>
                      {loading ? '—' : `${it.value}${it.suffix ?? ''}`}
                    </Text>
                  </View>
                ))}
              </View>

              {/* 队列概览 */}
              <View className="mt-2">
                <Text className={`mb-2 text-sm font-medium ${textPrimary}`}>调度队列</Text>
                {queue.length === 0 ? (
                  <Text className={`text-sm ${textTertiary}`}>队列为空</Text>
                ) : (
                  queue.map((entry) => (
                    <View
                      key={queueEntryId(entry) || entry.goal}
                      className={`mb-2 rounded-lg border p-3 ${cardClass}`}
                    >
                      <View className="flex-row items-center justify-between">
                        <Text className={`flex-1 text-sm ${textPrimary}`} numberOfLines={1}>
                          {entry.goal}
                        </Text>
                        <Text className="ml-2 text-xs text-orange-500">
                          {priorityLabel(entry.priority)}
                        </Text>
                      </View>
                      <View className="mt-1 flex-row items-center justify-between">
                        <Text className={`text-xs ${textTertiary}`}>位置 #{entry.position}</Text>
                        <Text className={`text-xs ${textTertiary}`}>
                          {new Date(entry.createdAt).toLocaleString()}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </>
          ) : null}

          {tab === 'dispatches' ? (
            <>
              <Text className={`mb-2 text-sm font-medium ${textPrimary}`}>活跃调度</Text>
              {dispatches.length === 0 ? (
                <View className="items-center py-16">
                  <Text className={`text-sm ${textSecondary}`}>{t('common.empty')}</Text>
                  <Text className={`mt-1 text-xs ${textTertiary}`}>暂无运行中的子智能体调度</Text>
                </View>
              ) : (
                dispatches.map((d) => (
                  <View key={d.id} className={`mb-3 rounded-lg border p-4 ${cardClass}`}>
                    <View className="flex-row items-center justify-between">
                      <Text
                        className={`flex-1 text-base font-medium ${textPrimary}`}
                        numberOfLines={1}
                      >
                        {d.goal}
                      </Text>
                      <View className={`ml-2 rounded px-2 py-0.5 ${statusBadgeClass(d.status)}`}>
                        <Text className="text-xs">{statusLabel(d.status)}</Text>
                      </View>
                    </View>
                    <Text className={`mt-1 text-xs ${textTertiary}`}>
                      {d.agentRole ?? '默认智能体'}
                      {d.orchestration ? ` · ${d.orchestration}` : ''}
                    </Text>
                    {d.errorMessage ? (
                      <Text className="mt-1 text-xs text-red-500" numberOfLines={2}>
                        {d.errorMessage}
                      </Text>
                    ) : null}
                    <View className="mt-2 flex-row items-center justify-between">
                      <Text className={`text-xs ${textTertiary}`}>
                        {new Date(d.createdAt).toLocaleString()}
                      </Text>
                      <TouchableOpacity
                        onPress={() => onCancelDispatch(d)}
                        disabled={cancellingId === d.id}
                        className="rounded-md border border-red-200 px-3 py-1"
                      >
                        <Text className="text-xs text-red-500">
                          {cancellingId === d.id ? '取消中…' : '取消'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </>
          ) : null}

          {tab === 'topology' ? (
            <>
              <Text className={`mb-2 text-sm font-medium ${textPrimary}`}>Swarm 拓扑</Text>
              {!topology || topology.nodes.length === 0 ? (
                <View className="items-center py-16">
                  <Text className={`text-sm ${textSecondary}`}>暂无拓扑数据</Text>
                </View>
              ) : (
                <>
                  {topology.nodes.map((node) => (
                    <View key={node.id} className={`mb-2 rounded-lg border p-3 ${cardClass}`}>
                      <View className="flex-row items-center justify-between">
                        <Text className={`flex-1 text-sm ${textPrimary}`} numberOfLines={1}>
                          {topologyNodeName(node)}
                        </Text>
                        <View
                          className={`ml-2 rounded px-2 py-0.5 ${statusBadgeClass(node.status)}`}
                        >
                          <Text className="text-xs">{statusLabel(node.status)}</Text>
                        </View>
                      </View>
                      <Text className={`mt-1 text-xs ${textTertiary}`} numberOfLines={1}>
                        {node.task ?? node.id}
                      </Text>
                    </View>
                  ))}
                  {topology.edges.length > 0 ? (
                    <View className={`mt-2 rounded-lg border p-3 ${cardClass}`}>
                      <Text className={`mb-2 text-xs font-medium ${textSecondary}`}>依赖关系</Text>
                      {topology.edges.map((edge, idx) => {
                        const fromName = topology.nodes.find((n) => n.id === edge.from) ?? null
                        const toName = topology.nodes.find((n) => n.id === edge.to) ?? null
                        return (
                          <Text
                            key={`${edge.from}-${edge.to}-${idx}`}
                            className={`mb-1 text-xs ${textTertiary}`}
                            numberOfLines={1}
                          >
                            {fromName ? topologyNodeName(fromName) : edge.from} →{' '}
                            {toName ? topologyNodeName(toName) : edge.to}
                            {edge.label ? ` (${edge.label})` : ''}
                          </Text>
                        )
                      })}
                    </View>
                  ) : null}
                </>
              )}
            </>
          ) : null}
        </ScrollView>
      )}
    </View>
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
