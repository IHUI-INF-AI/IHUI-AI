// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigation, useRoute } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import {
  cancelSubagentDispatch,
  getActiveSubagentDispatches,
  getSubagentDispatchDag,
  getSubagentDispatchMessages,
  getSubagentDispatchQuotas,
  resumeSubagentDispatch,
  type SubagentQuotaUsage,
} from '@ihui/api-client'
import {
  SubagentDetailScreen as SharedSubagentDetailScreen,
  type SubagentDagEdgeView,
  type SubagentDagNodeView,
  type SubagentDetailHeaderView,
  type SubagentMessageView,
  type SubagentQuotaBarView,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const NS = 'subagentDetailPage'

/** 状态字典:值=本页 ns 下的键(web STATUS_LABEL 硬编码中文,RN 走 dispatchStatus.* 五语) */
const STATUS_KEY: Record<string, string> = {
  pending: 'statusPending',
  running: 'statusRunning',
  completed: 'statusCompleted',
  failed: 'statusFailed',
  cancelled: 'statusCancelled',
  paused: 'paused',
}

/** 角色字典(web ROLE_LABEL,SubagentDetailClient.tsx:41-47) */
const ROLE_KEY: Record<string, string> = {
  researcher: 'roleResearcher',
  coder: 'roleCoder',
  reviewer: 'roleReviewer',
  architect: 'roleArchitect',
  debugger: 'roleDebugger',
}

/** 优先级字典(web PRIORITY_LABEL,client.tsx:48-53) */
const PRIORITY_KEY: Record<string, string> = {
  low: 'priorityLow',
  normal: 'priorityNormal',
  high: 'priorityHigh',
  urgent: 'priorityUrgent',
}

/**
 * RN 端「派单详情」薄壳 —— 承载 web /subagents/detail?=id。渲染全部委托共享屏,本文件只管:
 * 取 header(GET /api/subagents/active,契约 apps/api/src/routes/subagent-dispatch.ts:433)、
 * DAG / 配额 / 消息三条新端点(endpoints/subagents-detail.ts,契约 :575/:593/:611)、
 * 取消 / 恢复动作(复用 endpoints/subagents.ts:198/205,契约 :460/:478)、登录门与格式化。
 * 与 web 的口径差:web 对 active 5s、messages 3s 轮询(client.tsx:102/119),RN 不做常驻轮询
 * (移动端后台耗电/流量),改为进入页面与动作后各拉一次 —— 如实登记,不谎称同款。
 */
export function SubagentDetailScreen() {
  const navigation = useNavigation<NavigationProp>()
  // 参数形状内联(本席位不改 RootNavigator.tsx,接线前引用 route 名会 TS 报错)
  const route = useRoute<{ key: string; name: 'SubagentDetail'; params: { id: string } }>()
  const { t, locale } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()
  const id = route.params?.id ?? ''

  const [header, setHeader] = useState<SubagentDetailHeaderView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionPending, setActionPending] = useState(false)

  const [dagLoading, setDagLoading] = useState(true)
  const [dagNodes, setDagNodes] = useState<SubagentDagNodeView[]>([])
  const [dagEdges, setDagEdges] = useState<SubagentDagEdgeView[]>([])

  const [quotasLoading, setQuotasLoading] = useState(true)
  const [quotaBars, setQuotaBars] = useState<SubagentQuotaBarView[]>([])
  const [quotaExceeded, setQuotaExceeded] = useState(false)

  const [messagesLoading, setMessagesLoading] = useState(true)
  const [messages, setMessages] = useState<SubagentMessageView[]>([])

  // web 同参 Intl(SubagentDetailClient.tsx:55-61:year/month/day/hour/minute)
  const dateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [locale],
  )

  const fmtDate = useCallback(
    (value: string): string => {
      const d = new Date(value)
      return Number.isNaN(d.getTime()) ? '-' : dateFmt.format(d)
    },
    [dateFmt],
  )

  const loadHeader = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getActiveSubagentDispatches()
      const d = res.dispatches.find((x) => x.id === id)
      if (!d) {
        setHeader(null)
      } else {
        const statusKey = STATUS_KEY[d.status]
        const roleKey = d.agentRole ? ROLE_KEY[d.agentRole] : undefined
        const priorityKey = d.priority ? PRIORITY_KEY[d.priority] : undefined
        setHeader({
          id: d.id,
          goal: d.goal,
          status: d.status,
          statusText: statusKey ? t(`${NS}.${statusKey}`) : d.status,
          roleText: roleKey ? t(`${NS}.${roleKey}`) : '',
          priorityText: priorityKey ? t(`${NS}.${priorityKey}`) : '',
          createdAtText: fmtDate(d.createdAt),
          // web:status==='paused' 才给恢复;pending/running/paused 给取消(client.tsx:159-190)
          canResume: d.status === 'paused',
          canCancel: d.status === 'pending' || d.status === 'running' || d.status === 'paused',
        })
      }
    } catch (e) {
      setHeader(null)
      setError(e instanceof Error ? e.message : t(`${NS}.loadFailed`))
    }
    setLoading(false)
  }, [id, t, fmtDate])

  const loadDag = useCallback(async () => {
    if (!id) return
    setDagLoading(true)
    try {
      const dag = await getSubagentDispatchDag(id)
      setDagNodes((dag.nodes ?? []).map((n) => ({ id: n.id, task: n.task })))
      setDagEdges(
        (dag.edges ?? []).map((e) => ({ from: e.from, to: e.to, condition: e.condition ?? '' })),
      )
    } catch {
      setDagNodes([])
      setDagEdges([])
    }
    setDagLoading(false)
  }, [id])

  const loadQuotas = useCallback(async () => {
    if (!id) return
    setQuotasLoading(true)
    try {
      const q: SubagentQuotaUsage = await getSubagentDispatchQuotas(id)
      setQuotaBars([
        { key: 'time', label: t(`${NS}.quotaTimeout`), used: q.used.elapsedMs, total: q.quota.timeoutMs, unit: 'ms' },
        { key: 'token', label: t(`${NS}.quotaTokens`), used: q.used.tokensUsed, total: q.quota.tokenQuota, unit: '' },
        { key: 'retry', label: t(`${NS}.quotaRetries`), used: q.used.retriesUsed, total: q.quota.maxRetries, unit: '' },
      ])
      setQuotaExceeded(Boolean(q.exceeded))
    } catch {
      setQuotaBars([])
      setQuotaExceeded(false)
    }
    setQuotasLoading(false)
  }, [id, t])

  const loadMessages = useCallback(async () => {
    if (!id) return
    setMessagesLoading(true)
    try {
      const res = await getSubagentDispatchMessages(id)
      setMessages(
        (res.messages ?? []).map((m) => ({
          id: m.id,
          fromAgent: m.fromAgent,
          toAgent: m.toAgent,
          content: m.content,
          typeText: m.messageType,
          timeText: fmtDate(m.timestamp),
        })),
      )
    } catch {
      setMessages([])
    }
    setMessagesLoading(false)
  }, [id, fmtDate])

  useEffect(() => {
    if (!user || !id) {
      setLoading(false)
      return
    }
    void loadHeader()
    void loadDag()
    void loadQuotas()
    void loadMessages()
  }, [user, id, loadHeader, loadDag, loadQuotas, loadMessages])

  const act = useCallback(
    async (kind: 'cancel' | 'resume') => {
      if (!id) return
      setActionPending(true)
      try {
        if (kind === 'cancel') await cancelSubagentDispatch(id)
        else await resumeSubagentDispatch(id)
      } catch (e) {
        setError(e instanceof Error ? e.message : t(`${NS}.loadFailed`))
      }
      setActionPending(false)
      await loadHeader()
      await loadMessages()
    },
    [id, t, loadHeader, loadMessages],
  )

  return (
    <SharedSubagentDetailScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loginRequiredText={user ? '' : t(`${NS}.loginRequired`)}
      missingId={!id}
      loading={loading}
      error={error}
      onRetry={() => void loadHeader()}
      header={header}
      actionPending={actionPending}
      onResume={() => void act('resume')}
      onCancel={() => void act('cancel')}
      dagLoading={dagLoading}
      dagNodes={dagNodes}
      dagEdges={dagEdges}
      quotasLoading={quotasLoading}
      quotaBars={quotaBars}
      quotaExceeded={quotaExceeded}
      messagesLoading={messagesLoading}
      messages={messages}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
