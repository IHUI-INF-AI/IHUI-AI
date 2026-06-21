import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// mock http 请求模块
vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

import http from '@/utils/request'
import { useSecurityAudit } from '../useSecurityAudit'

describe('useSecurityAudit.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // 工具函数：清空全局 state，便于用例互不干扰
  const resetState = () => {
    const { state, error } = useSecurityAudit()
    state.policies = []
    state.challenges = []
    state.authzEvents = []
    state.behaviorEvents = []
    state.findings = []
    state.score = null
    state.loading = false
    state.error = null
    error.value = null
  }

  describe('fetchPolicies', () => {
    it('成功时应写入策略列表', async () => {
      const mock = [
        { action: 'withdraw', label: '提现', cooldown_seconds: 120, max_per_window: 3, window_seconds: 3600, channels: ['sms'] },
      ]
      ;(http.get as any).mockResolvedValue({ code: 0, data: mock })
      resetState()

      const { state, fetchPolicies } = useSecurityAudit()
      await fetchPolicies()

      expect(http.get).toHaveBeenCalledWith('/api/v1/security/policies')
      expect(state.policies).toEqual(mock)
    })

    it('失败时应写入错误并保持 loading 关闭', async () => {
      ;(http.get as any).mockRejectedValue(new Error('net fail'))
      resetState()

      const { state, loading, error, fetchPolicies } = useSecurityAudit()
      await fetchPolicies()

      expect(state.error).toBe('net fail')
      expect(error.value).toBe('net fail')
      expect(loading.value).toBe(false)
      expect(state.loading).toBe(false)
    })

    it('data 为空时应写入空数组', async () => {
      ;(http.get as any).mockResolvedValue({ code: 0, data: null })
      resetState()

      const { state, fetchPolicies } = useSecurityAudit()
      await fetchPolicies()

      expect(state.policies).toEqual([])
    })
  })

  describe('requestVerification', () => {
    it('成功时应返回 challenge 信息并加入 state.challenges', async () => {
      const ch = {
        challenge_id: 'ch_1',
        action: 'withdraw',
        channel: 'sms',
        expires_at: 99999,
        ttl_seconds: 300,
        policy: {} as any,
      }
      ;(http.post as any).mockResolvedValue({ code: 0, data: ch })
      resetState()

      const { state, requestVerification } = useSecurityAudit()
      const out = await requestVerification('u1', 'withdraw', 'sms')
      expect(out).toEqual(ch)
      expect(state.challenges).toContain(ch)
    })

    it('不传 channel 时应发送 channel: null', async () => {
      ;(http.post as any).mockResolvedValue({ code: 0, data: { challenge_id: 'ch_2' } })
      resetState()

      await useSecurityAudit().requestVerification('u1', 'withdraw')
      expect(http.post).toHaveBeenCalledWith('/api/v1/security/sensitive/request', {
        user_id: 'u1',
        action: 'withdraw',
        channel: null,
      })
    })

    it('失败时应返回 null 并写入错误', async () => {
      ;(http.post as any).mockRejectedValue(new Error('Too Many'))
      resetState()

      const { state, requestVerification } = useSecurityAudit()
      const out = await requestVerification('u1', 'withdraw')
      expect(out).toBeNull()
      expect(state.error).toBe('Too Many')
    })
  })

  describe('confirmVerification', () => {
    it('成功时应返回 token', async () => {
      ;(http.post as any).mockResolvedValue({
        code: 0,
        data: { verified: true, token: 'tok', expires_at: 99999 },
      })
      resetState()

      const { confirmVerification } = useSecurityAudit()
      const out = await confirmVerification('u1', 'ch1', '123456')
      expect(out?.verified).toBe(true)
      expect(out?.token).toBe('tok')
      expect(http.post).toHaveBeenCalledWith('/api/v1/security/sensitive/confirm', {
        user_id: 'u1',
        challenge_id: 'ch1',
        code: '123456',
      })
    })

    it('失败时应返回 null 并写入错误', async () => {
      ;(http.post as any).mockRejectedValue(new Error('code wrong'))
      resetState()

      const { state, error, confirmVerification } = useSecurityAudit()
      const out = await confirmVerification('u1', 'ch1', '000000')
      expect(out).toBeNull()
      expect(state.error).toBe('code wrong')
      expect(error.value).toBe('code wrong')
    })
  })

  describe('fetchAuthzEvents', () => {
    it('成功时应写入 state.authzEvents', async () => {
      const evs = [
        { event_id: 'e1', decision: 'deny' },
        { event_id: 'e2', decision: 'allow' },
      ]
      ;(http.get as any).mockResolvedValue({ code: 0, data: evs })
      resetState()

      const { state, fetchAuthzEvents } = useSecurityAudit()
      const out = await fetchAuthzEvents(50)
      expect(http.get).toHaveBeenCalledWith('/api/v1/security/authz/events', { params: { limit: 50 } })
      expect(out).toEqual(evs)
      expect(state.authzEvents).toEqual(evs)
    })

    it('不传 limit 时默认使用 100', async () => {
      ;(http.get as any).mockResolvedValue({ code: 0, data: [] })
      resetState()

      await useSecurityAudit().fetchAuthzEvents()
      expect(http.get).toHaveBeenCalledWith('/api/v1/security/authz/events', { params: { limit: 100 } })
    })

    it('失败时应返回空数组并写入错误', async () => {
      ;(http.get as any).mockRejectedValue(new Error('authz fail'))
      resetState()

      const { state, fetchAuthzEvents } = useSecurityAudit()
      const out = await fetchAuthzEvents()
      expect(out).toEqual([])
      expect(state.error).toBe('authz fail')
    })

    it('data 为空时应写入空数组', async () => {
      ;(http.get as any).mockResolvedValue({ code: 0, data: null })
      resetState()

      const { state, fetchAuthzEvents } = useSecurityAudit()
      const out = await fetchAuthzEvents()
      expect(state.authzEvents).toEqual([])
      expect(out).toEqual([])
    })
  })

  describe('checkAuthz', () => {
    it('成功时应返回 final 与 events', async () => {
      ;(http.post as any).mockResolvedValue({
        code: 0,
        data: { final: 'deny', events: [{ decision: 'deny' }] },
      })
      resetState()

      const { checkAuthz } = useSecurityAudit()
      const out = await checkAuthz({
        user_id: 'u1',
        resource_tenant_id: 't2',
        resource_type: 'order',
        resource_id: 'o1',
      })
      expect(out?.final).toBe('deny')
      expect(out?.events.length).toBe(1)
    })

    it('失败时应返回 null 并写入错误', async () => {
      ;(http.post as any).mockRejectedValue(new Error('check fail'))
      resetState()

      const { state, checkAuthz } = useSecurityAudit()
      const out = await checkAuthz({ user_id: 'u1' })
      expect(out).toBeNull()
      expect(state.error).toBe('check fail')
    })
  })

  describe('fetchBehaviorEvents', () => {
    it('应支持 userId 过滤', async () => {
      ;(http.get as any).mockResolvedValue({ code: 0, data: [{ event_id: 'e1' }] })
      resetState()

      const { fetchBehaviorEvents } = useSecurityAudit()
      await fetchBehaviorEvents('u1', 50)
      expect(http.get).toHaveBeenCalledWith('/api/v1/security/behavior/events', {
        params: { user_id: 'u1', limit: 50 },
      })
    })

    it('不传参数时应使用默认空 userId 与 100 limit', async () => {
      ;(http.get as any).mockResolvedValue({ code: 0, data: [] })
      resetState()

      await useSecurityAudit().fetchBehaviorEvents()
      expect(http.get).toHaveBeenCalledWith('/api/v1/security/behavior/events', {
        params: { user_id: undefined, limit: 100 },
      })
    })

    it('失败时应返回空数组并写入错误', async () => {
      ;(http.get as any).mockRejectedValue(new Error('behavior fail'))
      resetState()

      const { state, fetchBehaviorEvents } = useSecurityAudit()
      const out = await fetchBehaviorEvents('u1')
      expect(out).toEqual([])
      expect(state.error).toBe('behavior fail')
    })

    it('data 为空时应写入空数组', async () => {
      ;(http.get as any).mockResolvedValue({ code: 0, data: null })
      resetState()

      const { state, fetchBehaviorEvents } = useSecurityAudit()
      const out = await fetchBehaviorEvents('u1')
      expect(state.behaviorEvents).toEqual([])
      expect(out).toEqual([])
    })
  })

  describe('fetchFindings', () => {
    it('应支持 userId 过滤', async () => {
      ;(http.get as any).mockResolvedValue({ code: 0, data: [{ anomaly_id: 'a1' }] })
      resetState()

      const { state, fetchFindings } = useSecurityAudit()
      const out = await fetchFindings('u1', 50)
      expect(http.get).toHaveBeenCalledWith('/api/v1/security/behavior/findings', {
        params: { user_id: 'u1', limit: 50 },
      })
      expect(state.findings).toEqual([{ anomaly_id: 'a1' }])
      expect(out).toEqual([{ anomaly_id: 'a1' }])
    })

    it('不传参数时应使用默认空 userId 与 100 limit', async () => {
      ;(http.get as any).mockResolvedValue({ code: 0, data: [] })
      resetState()

      await useSecurityAudit().fetchFindings()
      expect(http.get).toHaveBeenCalledWith('/api/v1/security/behavior/findings', {
        params: { user_id: undefined, limit: 100 },
      })
    })

    it('失败时应返回空数组并写入错误', async () => {
      ;(http.get as any).mockRejectedValue(new Error('findings fail'))
      resetState()

      const { state, fetchFindings } = useSecurityAudit()
      const out = await fetchFindings('u1')
      expect(out).toEqual([])
      expect(state.error).toBe('findings fail')
    })

    it('data 为空时应写入空数组', async () => {
      ;(http.get as any).mockResolvedValue({ code: 0, data: null })
      resetState()

      const { state, fetchFindings } = useSecurityAudit()
      const out = await fetchFindings('u1')
      expect(state.findings).toEqual([])
      expect(out).toEqual([])
    })
  })

  describe('fetchRisk', () => {
    it('成功时应返回风险评分', async () => {
      const score = {
        user_id: 'u1',
        behavior_score: 40,
        authz_score: 10,
        authz_denies: 2,
        total: 50,
        label: 'warning',
        recent_findings: [],
      }
      ;(http.get as any).mockResolvedValue({ code: 0, data: score })
      resetState()

      const { state, fetchRisk } = useSecurityAudit()
      const out = await fetchRisk('u1', true)
      expect(http.get).toHaveBeenCalledWith('/api/v1/security/behavior/risk', {
        params: { user_id: 'u1', analyze: true },
      })
      expect(out).toEqual(score)
      expect(state.score).toEqual(score)
    })

    it('默认 analyze 为 false', async () => {
      ;(http.get as any).mockResolvedValue({ code: 0, data: {} })
      resetState()

      await useSecurityAudit().fetchRisk('u1')
      expect(http.get).toHaveBeenCalledWith('/api/v1/security/behavior/risk', {
        params: { user_id: 'u1', analyze: false },
      })
    })

    it('失败时应返回 null 并写入错误', async () => {
      ;(http.get as any).mockRejectedValue(new Error('risk fail'))
      resetState()

      const { state, fetchRisk } = useSecurityAudit()
      const out = await fetchRisk('u1')
      expect(out).toBeNull()
      expect(state.error).toBe('risk fail')
    })
  })

  describe('fetchScore', () => {
    it('成功时应返回综合评分', async () => {
      const score = {
        user_id: 'u1',
        behavior_score: 30,
        authz_score: 5,
        authz_denies: 1,
        total: 30,
        label: 'elevated',
        recent_findings: [],
      }
      ;(http.get as any).mockResolvedValue({ code: 0, data: score })
      resetState()

      const { state, fetchScore } = useSecurityAudit()
      const out = await fetchScore('u1')
      expect(out).toEqual(score)
      expect(state.score).toEqual(score)
      expect(http.get).toHaveBeenCalledWith('/api/v1/security/score', {
        params: { user_id: 'u1' },
      })
    })

    it('失败时应返回 null 并写入错误', async () => {
      ;(http.get as any).mockRejectedValue(new Error('score fail'))
      resetState()

      const { state, fetchScore } = useSecurityAudit()
      const out = await fetchScore('u1')
      expect(out).toBeNull()
      expect(state.error).toBe('score fail')
    })
  })

  describe('simulateBehavior', () => {
    it('应将参数序列化到 POST', async () => {
      ;(http.post as any).mockResolvedValue({ code: 0, data: { event_id: 'e1' } })
      resetState()

      const { simulateBehavior } = useSecurityAudit()
      const out = await simulateBehavior({ user_id: 'u1', kind: 'login_fail', ip: '1.1.1.1' })
      expect(http.post).toHaveBeenCalledWith('/api/v1/security/behavior/simulate', {
        user_id: 'u1',
        kind: 'login_fail',
        ip: '1.1.1.1',
        success: true,
        extra: {},
      })
      expect(out).toEqual({ event_id: 'e1' })
    })

    it('success 为 false 时应原样传递', async () => {
      ;(http.post as any).mockResolvedValue({ code: 0, data: { event_id: 'e2' } })
      resetState()

      await useSecurityAudit().simulateBehavior({
        user_id: 'u1',
        kind: 'login_fail',
        success: false,
        extra: { reason: 'wrong' },
      })
      expect(http.post).toHaveBeenCalledWith('/api/v1/security/behavior/simulate', {
        user_id: 'u1',
        kind: 'login_fail',
        ip: '',
        success: false,
        extra: { reason: 'wrong' },
      })
    })

    it('失败时应返回 null 并写入错误', async () => {
      ;(http.post as any).mockRejectedValue(new Error('sim fail'))
      resetState()

      const { state, simulateBehavior } = useSecurityAudit()
      const out = await simulateBehavior({ user_id: 'u1', kind: 'login_fail' })
      expect(out).toBeNull()
      expect(state.error).toBe('sim fail')
    })
  })

  describe('setError 非 Error 类型', () => {
    it('传入字符串时应写入字符串', async () => {
      ;(http.get as any).mockRejectedValue('plain string error')
      resetState()

      const { state, error, fetchPolicies } = useSecurityAudit()
      await fetchPolicies()
      expect(state.error).toBe('plain string error')
      expect(error.value).toBe('plain string error')
    })
  })

  describe('loading 状态', () => {
    it('请求结束后 loading 应回到 false', async () => {
      ;(http.get as any).mockResolvedValue({ code: 0, data: [] })
      resetState()

      const { loading, fetchPolicies } = useSecurityAudit()
      const p = fetchPolicies()
      // 在 await 之前 loading 应该是 true
      expect(loading.value).toBe(true)
      await p
      expect(loading.value).toBe(false)
    })
  })
})
