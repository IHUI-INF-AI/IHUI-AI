// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { useCallback, useState } from 'react'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { dispatchSubagent, type SubagentDispatchInput } from '@ihui/api-client'
import {
  SubagentsDispatchScreen as SharedSubagentsDispatchScreen,
  type SubagentsDispatchResultView,
} from '@ihui/rn-app'
import { useI18n } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import type { RootStackParamList } from '../navigation/RootNavigator'

type NavigationProp = NativeStackNavigationProp<RootStackParamList>

const NS = 'subagentsDispatchPage'

/** 与 web dispatchStatus 命名空间同值集(apps/web 语言包 dispatchStatus:*),值=本页 ns 键 */
const DISPATCH_STATUS_KEYS: Record<string, string> = {
  pending: 'dispatchPending',
  running: 'dispatchRunning',
  completed: 'dispatchCompleted',
  failed: 'dispatchFailed',
  cancelled: 'dispatchCancelled',
}

/** 后端 zod 接受但 api-client 入参类型未列的两组可选字段(subagent-dispatch.ts:112/115) */
type DispatchPayload = SubagentDispatchInput & {
  retry?: { maxAttempts: number; delayMs: number }
  quotas?: { timeoutMs: number; tokenQuota: number; maxRetries: number }
}

/** web 同义:每行一条(DispatchForm.tsx:51-56) */
function linesToArray(text: string): string[] {  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

/**
 * RN 端「新建 Subagent 派单」薄壳 —— 承载 web /subagents/dispatch。
 *
 * 取数走既有封装 @ihui/api-client 的 dispatchSubagent(POST /api/subagents/dispatch),
 * 后端 apps/api/src/routes/subagent-dispatch.ts:400-428:入参 zod 校验(:93-118)、
 * success({dispatch})(:425)、并发超限 429(:416-418)、DAG 循环依赖 400(:421-423)。
 * 端点层是 apiOrThrow(失败即抛),故错误文案优先取后端 error.message,兜底走本页 errorDefault。
 * 口径差:web 表单的「DAG 节点 / 边编辑器」子面板未承载(如实登记);其余字段与取值集逐一同源。
 */
export function SubagentsDispatchScreen() {
  const navigation = useNavigation<NavigationProp>()
  const { t } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()

  const [goal, setGoal] = useState('')
  const [affectedFiles, setAffectedFiles] = useState('')
  const [forbidden, setForbidden] = useState('')
  const [verifyCommands, setVerifyCommands] = useState('')
  const [constraints, setConstraints] = useState('')
  const [deliverables, setDeliverables] = useState('')

  const [agentRole, setAgentRole] = useState('')
  const [orchestration, setOrchestration] = useState('')
  const [priority, setPriority] = useState('')

  const [retryCount, setRetryCount] = useState('1')
  const [retryDelayMs, setRetryDelayMs] = useState('1000')
  const [timeoutMs, setTimeoutMs] = useState('300000')
  const [tokenQuota, setTokenQuota] = useState('50000')
  const [maxRetries, setMaxRetries] = useState('2')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SubagentsDispatchResultView | null>(null)

  const submit = useCallback(async () => {
    if (!user || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const payload: DispatchPayload = {
        goal: goal.trim(),
        affectedFiles: linesToArray(affectedFiles),
        constraints: constraints.trim(),
        deliverables: deliverables.trim(),
        verifyCommands: linesToArray(verifyCommands),
      }
      const forbiddenList = linesToArray(forbidden)
      if (forbiddenList.length > 0) payload.forbidden = forbiddenList
      if (agentRole) payload.agentRole = agentRole as SubagentDispatchInput['agentRole']
      if (orchestration) {
        payload.orchestration = orchestration as SubagentDispatchInput['orchestration']
      }
      if (priority) payload.priority = priority as SubagentDispatchInput['priority']

      const maxAttempts = Number(retryCount)
      const delayMs = Number(retryDelayMs)
      if (maxAttempts > 0) payload.retry = { maxAttempts, delayMs }

      const quotaTimeout = Number(timeoutMs)
      const quotaTokens = Number(tokenQuota)
      const quotaRetries = Number(maxRetries)
      if (quotaTimeout > 0) {
        payload.quotas = {
          timeoutMs: quotaTimeout,
          tokenQuota: quotaTokens,
          maxRetries: quotaRetries,
        }
      }

      const res = await dispatchSubagent(payload)
      const statusKey = DISPATCH_STATUS_KEYS[res.dispatch.status]
      setResult({
        id: res.dispatch.id,
        statusText: statusKey ? t(`${NS}.${statusKey}`) : res.dispatch.status,
      })
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : t(`${NS}.errorDefault`))
    } finally {
      setSubmitting(false)
    }
  }, [
    user,
    submitting,
    goal,
    affectedFiles,
    constraints,
    deliverables,
    verifyCommands,
    forbidden,
    agentRole,
    orchestration,
    priority,
    retryCount,
    retryDelayMs,
    timeoutMs,
    tokenQuota,
    maxRetries,
    t,
  ])

  const reset = useCallback(() => {
    setResult(null)
    setError(null)
    setGoal('')
    setAffectedFiles('')
    setForbidden('')
    setVerifyCommands('')
    setConstraints('')
    setDeliverables('')
  }, [])

  return (
    <SharedSubagentsDispatchScreen
      t={t}
      colorScheme={resolvedTheme}
      onBack={() => navigation.goBack()}
      loginRequiredText={user ? '' : t(`${NS}.loginRequired`)}
      goal={goal}
      affectedFiles={affectedFiles}
      forbidden={forbidden}
      verifyCommands={verifyCommands}
      constraints={constraints}
      deliverables={deliverables}
      onGoalChange={setGoal}
      onAffectedFilesChange={setAffectedFiles}
      onForbiddenChange={setForbidden}
      onVerifyCommandsChange={setVerifyCommands}
      onConstraintsChange={setConstraints}
      onDeliverablesChange={setDeliverables}
      agentRole={agentRole}
      orchestration={orchestration}
      priority={priority}
      onAgentRoleChange={setAgentRole}
      onOrchestrationChange={setOrchestration}
      onPriorityChange={setPriority}
      retryCount={retryCount}
      retryDelayMs={retryDelayMs}
      timeoutMs={timeoutMs}
      tokenQuota={tokenQuota}
      maxRetries={maxRetries}
      onRetryCountChange={setRetryCount}
      onRetryDelayChange={setRetryDelayMs}
      onTimeoutChange={setTimeoutMs}
      onTokenQuotaChange={setTokenQuota}
      onMaxRetriesChange={setMaxRetries}
      submitting={submitting}
      error={error}
      result={result}
      onSubmit={() => void submit()}
      onDispatchAnother={reset}
    />
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
