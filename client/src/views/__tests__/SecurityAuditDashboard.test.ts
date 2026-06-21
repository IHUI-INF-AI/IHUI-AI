import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

// mock vue-i18n
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: { value: 'zh-CN' },
    te: () => true,
    tm: () => ({}),
  }),
  createI18n: (options: any) => ({
    install: (app: any) => {
      app.config.globalProperties.$t = (key: string) => key
      app.provide('i18n', {})
    },
    global: { t: (key: string) => key },
  }),
}))

vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

vi.mock('@/composables/useA11y', () => ({
  useA11y: () => ({
    announce: vi.fn(),
    focusFirst: vi.fn(),
    focusLast: vi.fn(),
    getFocusable: vi.fn(() => []),
    trapFocus: vi.fn(),
    isReducedMotion: { value: false },
    isHighContrast: { value: false },
    isForcedColors: { value: false },
  }),
}))

import http from '@/utils/request'
import SecurityAuditDashboard from '../SecurityAuditDashboard.vue'

const policies = [
  { action: 'withdraw', label: '提现', cooldown_seconds: 120, max_per_window: 3, window_seconds: 3600, channels: ['sms', 'email'] },
  { action: 'change_password', label: '修改密码', cooldown_seconds: 30, max_per_window: 5, window_seconds: 3600, channels: ['sms', 'email'] },
]

const authzEvents = [
  { event_id: 'a1', ts: Date.now() / 1000, principal_user_id: 'u1', principal_tenant_id: 't1', target_user_id: 'u2', target_tenant_id: 't2', resource_type: 'order', resource_id: 'o1', action: 'read', decision: 'deny', reason: 'cross_tenant', ip: '', user_agent: '', note: '' },
  { event_id: 'a2', ts: Date.now() / 1000, principal_user_id: 'u1', principal_tenant_id: 't1', target_user_id: null, target_tenant_id: 't1', resource_type: 'order', resource_id: 'o1', action: 'read', decision: 'allow', reason: null, ip: '', user_agent: '', note: '' },
]

const behaviorEvents = [
  { event_id: 'b1', user_id: 'u_p9_demo', kind: 'login', ts: Date.now() / 1000, ip: '1.1.1.1', user_agent: 'test', success: true, extra: {} },
  { event_id: 'b2', user_id: 'u_p9_demo', kind: 'api_call', ts: Date.now() / 1000, ip: '1.1.1.2', user_agent: 'test', success: false, extra: {} },
]

const findings = [
  { anomaly_id: 'f1', user_id: 'u_p9_demo', anomaly_type: 'brute_force', severity: 'critical', risk_score: 80, ts: Date.now() / 1000, evidence: {}, message: '5 分钟内失败登录 8 次' },
  { anomaly_id: 'f2', user_id: 'u_p9_demo', anomaly_type: 'unusual_hour', severity: 'warning', risk_score: 50, ts: Date.now() / 1000, evidence: {}, message: '凌晨 3 点执行 withdraw' },
]

const score = {
  user_id: 'u_p9_demo',
  behavior_score: 80,
  authz_score: 5,
  authz_denies: 1,
  total: 80,
  label: 'critical',
  recent_findings: findings,
}

describe('SecurityAuditDashboard.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(http.get as any).mockImplementation((url: string) => {
      if (url.includes('/policies')) return Promise.resolve({ code: 0, data: policies })
      if (url.includes('/authz/events')) return Promise.resolve({ code: 0, data: authzEvents })
      if (url.includes('/behavior/events')) return Promise.resolve({ code: 0, data: behaviorEvents })
      if (url.includes('/behavior/findings')) return Promise.resolve({ code: 0, data: findings })
      if (url.includes('/score')) return Promise.resolve({ code: 0, data: score })
      return Promise.resolve({ code: 0, data: null })
    })
    ;(http.post as any).mockResolvedValue({ code: 0, data: { event_id: 'sim1' } })
  })

  it('挂载时应自动拉取全部数据', async () => {
    mount(SecurityAuditDashboard)
    await flushPromises()
    expect(http.get).toHaveBeenCalledWith('/api/v1/security/policies')
    expect(http.get).toHaveBeenCalledWith('/api/v1/security/authz/events', expect.any(Object))
    expect(http.get).toHaveBeenCalledWith('/api/v1/security/behavior/events', expect.any(Object))
    expect(http.get).toHaveBeenCalledWith('/api/v1/security/behavior/findings', expect.any(Object))
    expect(http.get).toHaveBeenCalledWith('/api/v1/security/score', expect.any(Object))
  })

  it('应渲染标题与四个面板', async () => {
    const wrapper = mount(SecurityAuditDashboard)
    await flushPromises()
    expect(wrapper.find('#sa-dashboard-title').text()).toBe('securityAudit.title')
    expect(wrapper.find('#sa-policies-title').exists()).toBe(true)
    expect(wrapper.find('#sa-authz-title').exists()).toBe(true)
    expect(wrapper.find('#sa-behavior-title').exists()).toBe(true)
    expect(wrapper.find('#sa-findings-title').exists()).toBe(true)
  })

  it('策略面板应列出每个策略', async () => {
    const wrapper = mount(SecurityAuditDashboard)
    await flushPromises()
    const items = wrapper.findAll('.sa-policy-item')
    expect(items.length).toBe(2)
    expect(items[0].text()).toContain('提现')
    expect(items[0].text()).toContain('sms / email')
  })

  it('越权面板应正确显示 DENY 数量', async () => {
    const wrapper = mount(SecurityAuditDashboard)
    await flushPromises()
    const meta = wrapper.findAll('.sa-panel-meta')
    // 第二个面板的 meta 应显示 DENY: 1
    expect(wrapper.text()).toContain('DENY: 1')
  })

  it('异常面板应按 severity 分类', async () => {
    const wrapper = mount(SecurityAuditDashboard)
    await flushPromises()
    const items = wrapper.findAll('.sa-finding-item')
    expect(items.length).toBe(2)
    expect(items[0].classes()).toContain('sa-sev-critical')
    expect(items[1].classes()).toContain('sa-sev-warning')
  })

  it('综合风险分数应正确显示', async () => {
    const wrapper = mount(SecurityAuditDashboard)
    await flushPromises()
    expect(wrapper.find('.sa-risk-score').text()).toBe('80')
    expect(wrapper.find('.sa-risk-tag').text()).toBe('securityAudit.riskCritical')
  })

  it('"刷新全部"按钮应再次调用 5 个 GET', async () => {
    const wrapper = mount(SecurityAuditDashboard)
    await flushPromises()
    const before = (http.get as any).mock.calls.length
    const refreshBtn = wrapper.findAll('.sa-btn')[0]
    await refreshBtn.trigger('click')
    await flushPromises()
    const after = (http.get as any).mock.calls.length
    expect(after - before).toBeGreaterThanOrEqual(5)
  })

  it('"模拟失败登录"按钮应触发 10 次 simulate API', async () => {
    const wrapper = mount(SecurityAuditDashboard)
    await flushPromises()
    const before = (http.post as any).mock.calls.length
    const simBtn = wrapper.findAll('.sa-btn')[1]
    await simBtn.trigger('click')
    await flushPromises()
    const simulateCalls = (http.post as any).mock.calls.filter(
      (c: any[]) => c[0] === '/api/v1/security/behavior/simulate',
    )
    expect(simulateCalls.length).toBe(10)
    expect((http.post as any).mock.calls.length).toBeGreaterThan(before)
  })

  it('主区域应使用 role=main', async () => {
    const wrapper = mount(SecurityAuditDashboard)
    await flushPromises()
    const main = wrapper.find('[role="main"]')
    expect(main.exists()).toBe(true)
  })
})
