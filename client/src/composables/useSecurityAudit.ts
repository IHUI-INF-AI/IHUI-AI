// useSecurityAudit - 安全审计 composable (P9 阶段)
// 提供: 策略查询、二次验证流程、越权检查、行为事件、风险评分

import { ref } from 'vue'
import http from '@/utils/request'

export interface SensitivePolicy {
  action: string
  label: string
  cooldown_seconds: number
  max_per_window: number
  window_seconds: number
  channels: string[]
}

export interface ChallengeInfo {
  challenge_id: string
  action: string
  channel: string
  expires_at: number
  ttl_seconds: number
  policy: SensitivePolicy
}

export interface AuthzEvent {
  event_id: string
  ts: number
  principal_user_id: string
  principal_tenant_id: string
  target_user_id: string | null
  target_tenant_id: string | null
  resource_type: string
  resource_id: string
  action: string
  decision: 'allow' | 'deny' | 'uncertain'
  reason: string | null
  ip: string
  user_agent: string
  note: string
}

export interface BehaviorEvent {
  event_id: string
  user_id: string
  kind: string
  ts: number
  ip: string
  user_agent: string
  success: boolean
  extra: Record<string, unknown>
}

export interface AnomalyFinding {
  anomaly_id: string
  user_id: string
  anomaly_type: string
  severity: 'warning' | 'critical'
  risk_score: number
  ts: number
  evidence: Record<string, unknown>
  message: string
}

export interface SecurityScore {
  user_id: string
  behavior_score: number
  authz_score: number
  authz_denies: number
  total: number
  label: 'ok' | 'elevated' | 'warning' | 'critical'
  recent_findings: AnomalyFinding[]
}

export interface SecurityAuditState {
  policies: SensitivePolicy[]
  challenges: ChallengeInfo[]
  authzEvents: AuthzEvent[]
  behaviorEvents: BehaviorEvent[]
  findings: AnomalyFinding[]
  score: SecurityScore | null
  loading: boolean
  error: string | null
}

const state: SecurityAuditState = {
  policies: [],
  challenges: [],
  authzEvents: [],
  behaviorEvents: [],
  findings: [],
  score: null,
  loading: false,
  error: null,
}

export function useSecurityAudit() {
  const loading = ref(false)
  const error = ref<string | null>(null)

  const setError = (e: unknown) => {
    state.error = e instanceof Error ? e.message : String(e)
    error.value = state.error
  }

  const fetchPolicies = async () => {
    state.loading = true
    loading.value = true
    try {
      const res = await http.get('/api/v1/security/policies')
      state.policies = (res.data || []) as SensitivePolicy[]
    } catch (e) {
      setError(e)
    } finally {
      state.loading = false
      loading.value = false
    }
  }

  const requestVerification = async (
    userId: string,
    action: string,
    channel?: string,
  ): Promise<ChallengeInfo | null> => {
    state.loading = true
    loading.value = true
    try {
      const res = await http.post('/api/v1/security/sensitive/request', {
        user_id: userId,
        action,
        channel: channel || null,
      })
      const ch = res.data as ChallengeInfo
      state.challenges.push(ch)
      return ch
    } catch (e) {
      setError(e)
      return null
    } finally {
      state.loading = false
      loading.value = false
    }
  }

  const confirmVerification = async (
    userId: string,
    challengeId: string,
    code: string,
  ): Promise<{ verified: boolean; token: string; expires_at: number } | null> => {
    state.loading = true
    loading.value = true
    try {
      const res = await http.post('/api/v1/security/sensitive/confirm', {
        user_id: userId,
        challenge_id: challengeId,
        code,
      })
      return res.data
    } catch (e) {
      setError(e)
      return null
    } finally {
      state.loading = false
      loading.value = false
    }
  }

  const fetchAuthzEvents = async (limit = 100): Promise<AuthzEvent[]> => {
    state.loading = true
    loading.value = true
    try {
      const res = await http.get('/api/v1/security/authz/events', { params: { limit } })
      state.authzEvents = (res.data || []) as AuthzEvent[]
      return state.authzEvents
    } catch (e) {
      setError(e)
      return []
    } finally {
      state.loading = false
      loading.value = false
    }
  }

  const checkAuthz = async (params: {
    user_id: string
    tenant_id?: string
    role?: string
    is_admin?: boolean
    resource_tenant_id?: string
    resource_owner_id?: string
    resource_type?: string
    resource_id?: string
    action?: string
    check?: 'tenant' | 'owner' | 'both'
  }): Promise<{ final: 'allow' | 'deny' | 'uncertain'; events: AuthzEvent[] } | null> => {
    state.loading = true
    loading.value = true
    try {
      const res = await http.post('/api/v1/security/authz/check', params)
      return res.data
    } catch (e) {
      setError(e)
      return null
    } finally {
      state.loading = false
      loading.value = false
    }
  }

  const fetchBehaviorEvents = async (
    userId?: string,
    limit = 100,
  ): Promise<BehaviorEvent[]> => {
    state.loading = true
    loading.value = true
    try {
      const res = await http.get('/api/v1/security/behavior/events', {
        params: { user_id: userId, limit },
      })
      state.behaviorEvents = (res.data || []) as BehaviorEvent[]
      return state.behaviorEvents
    } catch (e) {
      setError(e)
      return []
    } finally {
      state.loading = false
      loading.value = false
    }
  }

  const fetchFindings = async (userId?: string, limit = 100): Promise<AnomalyFinding[]> => {
    state.loading = true
    loading.value = true
    try {
      const res = await http.get('/api/v1/security/behavior/findings', {
        params: { user_id: userId, limit },
      })
      state.findings = (res.data || []) as AnomalyFinding[]
      return state.findings
    } catch (e) {
      setError(e)
      return []
    } finally {
      state.loading = false
      loading.value = false
    }
  }

  const fetchRisk = async (userId: string, analyze = false): Promise<SecurityScore | null> => {
    state.loading = true
    loading.value = true
    try {
      const res = await http.get('/api/v1/security/behavior/risk', {
        params: { user_id: userId, analyze },
      })
      state.score = res.data as SecurityScore
      return state.score
    } catch (e) {
      setError(e)
      return null
    } finally {
      state.loading = false
      loading.value = false
    }
  }

  const fetchScore = async (userId: string): Promise<SecurityScore | null> => {
    state.loading = true
    loading.value = true
    try {
      const res = await http.get('/api/v1/security/score', {
        params: { user_id: userId },
      })
      state.score = res.data as SecurityScore
      return state.score
    } catch (e) {
      setError(e)
      return null
    } finally {
      state.loading = false
      loading.value = false
    }
  }

  const simulateBehavior = async (params: {
    user_id: string
    kind: string
    ip?: string
    success?: boolean
    extra?: Record<string, unknown>
  }): Promise<BehaviorEvent | null> => {
    state.loading = true
    loading.value = true
    try {
      const body = {
        user_id: params.user_id,
        kind: params.kind,
        ip: params.ip || '',
        success: params.success !== false,
        extra: params.extra || {},
      }
      const res = await http.post('/api/v1/security/behavior/simulate', body)
      return res.data as BehaviorEvent
    } catch (e) {
      setError(e)
      return null
    } finally {
      state.loading = false
      loading.value = false
    }
  }

  return {
    state,
    loading,
    error,
    fetchPolicies,
    requestVerification,
    confirmVerification,
    fetchAuthzEvents,
    checkAuthz,
    fetchBehaviorEvents,
    fetchFindings,
    fetchRisk,
    fetchScore,
    simulateBehavior,
  }
}
