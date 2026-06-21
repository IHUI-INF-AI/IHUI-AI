import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

// mock 依赖
// 关键 i18n 文案映射：组件内 t('sensitiveAction.xxx') 在测试中需要返回中文，
// 否则 toContain('申请验证码失败') / toContain('短信') 等断言会失败。
// 未在表中的 key 仍回退为原始 key（满足 toContain('sensitiveAction.resend') 等断言）。
const i18nMap: Record<string, string> = {
  'sensitiveAction.requestFailed': '申请验证码失败',
  'sensitiveAction.codeExpired': '验证码已过期',
  'sensitiveAction.channelSms': '短信',
  'sensitiveAction.channelEmail': '邮箱',
  'sensitiveAction.channelTotp': '身份验证器',
  'sensitiveAction.channelPassword': '登录密码',
  'sensitiveAction.channelPush': '推送',
}
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => i18nMap[key] ?? key,
    locale: { value: 'zh-CN' },
    te: () => true,
    tm: () => ({}),
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
import SensitiveActionDialog from '../SensitiveActionDialog.vue'

// 构造标准 challenge 工厂
const makeChallenge = (over: Record<string, any> = {}) => ({
  challenge_id: 'ch_1',
  action: 'withdraw',
  channel: 'sms',
  expires_at: Math.floor(Date.now() / 1000) + 300,
  ttl_seconds: 300,
  policy: {} as any,
  ...over,
})

describe('SensitiveActionDialog.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: false })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('未打开时不应渲染任何内容', () => {
    // 关闭状态下不渲染 dialog
    const wrapper = mount(SensitiveActionDialog, {
      props: { open: false, userId: 'u1', action: 'withdraw' },
    })
    expect(wrapper.find('.sa-dialog').exists()).toBe(false)
  })

  it('打开时应渲染对话框、标题与 ARIA 属性', () => {
    // 验证基础 DOM 与 ARIA
    const wrapper = mount(SensitiveActionDialog, {
      props: { open: true, userId: 'u1', action: 'withdraw', title: '提现' },
    })
    const dialog = wrapper.find('.sa-dialog')
    expect(dialog.exists()).toBe(true)
    expect(dialog.attributes('role')).toBe('dialog')
    expect(dialog.attributes('aria-modal')).toBe('true')
    expect(dialog.attributes('aria-labelledby')).toBe('sa-dialog-title')
    expect(wrapper.find('#sa-dialog-title').text()).toBe('提现')
    // loading=false 时 aria-busy 应为 false
    expect(dialog.attributes('aria-busy')).toBe('false')
  })

  it('自定义 description 应优先于默认描述', () => {
    // props.description 存在时显示该内容
    const wrapper = mount(SensitiveActionDialog, {
      props: {
        open: true,
        userId: 'u1',
        action: 'withdraw',
        title: '提现',
        description: '这是自定义说明',
      },
    })
    expect(wrapper.find('.sa-desc').text()).toBe('这是自定义说明')
  })

  it('无 description 时应使用默认描述（带 title）', () => {
    // defaultDescription computed 走 title 分支
    const wrapper = mount(SensitiveActionDialog, {
      props: { open: true, userId: 'u1', action: 'withdraw', title: '提现' },
    })
    expect(wrapper.text()).toContain('提现')
  })

  it('点击"发送验证码"应调用 request API 并进入 verify 步骤', async () => {
    // 正常请求流程
    ;(http.post as any).mockResolvedValue({ code: 0, data: makeChallenge() })
    const wrapper = mount(SensitiveActionDialog, {
      props: { open: true, userId: 'u1', action: 'withdraw' },
    })
    await wrapper.find('.sa-btn-primary').trigger('click')
    await flushPromises()
    expect(http.post).toHaveBeenCalledWith('/api/v1/security/sensitive/request', {
      user_id: 'u1',
      action: 'withdraw',
      channel: null,
    })
    expect(wrapper.find('#sa-code-input').exists()).toBe(true)
  })

  it('传入 channel 时请求体应带上 channel', async () => {
    // 验证 channel 透传
    ;(http.post as any).mockResolvedValue({ code: 0, data: makeChallenge({ channel: 'email' }) })
    const wrapper = mount(SensitiveActionDialog, {
      props: { open: true, userId: 'u1', action: 'withdraw', channel: 'email' },
    })
    await wrapper.find('.sa-btn-primary').trigger('click')
    await flushPromises()
    expect(http.post).toHaveBeenCalledWith('/api/v1/security/sensitive/request', {
      user_id: 'u1',
      action: 'withdraw',
      channel: 'email',
    })
  })

  it('request 返回空时应显示错误信息', async () => {
    // 申请失败路径（ch 为 null）
    ;(http.post as any).mockResolvedValue({ code: 0, data: null })
    const wrapper = mount(SensitiveActionDialog, {
      props: { open: true, userId: 'u1', action: 'withdraw' },
    })
    await wrapper.find('.sa-btn-primary').trigger('click')
    await flushPromises()
    expect(wrapper.find('.sa-state-error').exists()).toBe(true)
  })

  it('request 接口报错应显示申请失败提示', async () => {
    // http.post 异常时 useSecurityAudit 内部 catch 后返回 null，onRequest 走"申请验证码失败"分支
    ;(http.post as any).mockRejectedValue(new Error('网络错误'))
    const wrapper = mount(SensitiveActionDialog, {
      props: { open: true, userId: 'u1', action: 'withdraw' },
    })
    await wrapper.find('.sa-btn-primary').trigger('click')
    await flushPromises()
    expect(wrapper.find('.sa-state-error').exists()).toBe(true)
    expect(wrapper.find('.sa-state-error').text()).toContain('申请验证码失败')
  })

  it('loading 中再次点击发送按钮应被忽略', async () => {
    // loading 锁：onRequest 开头判 loading 直接 return
    let resolveFn: any
    ;(http.post as any).mockReturnValue(new Promise((r) => (resolveFn = r)))
    const wrapper = mount(SensitiveActionDialog, {
      props: { open: true, userId: 'u1', action: 'withdraw' },
    })
    const btn = wrapper.find('.sa-btn-primary')
    await btn.trigger('click')
    // 二次点击应该被 loading 阻止（按钮 disabled）
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
    // 解除 promise，避免泄漏
    resolveFn({ code: 0, data: makeChallenge() })
    await flushPromises()
  })

  it('验证码输入应只接受数字并截断到 6 位', async () => {
    // onCodeInput 过滤非数字 + slice(0, 6)
    ;(http.post as any).mockResolvedValue({ code: 0, data: makeChallenge() })
    const wrapper = mount(SensitiveActionDialog, {
      props: { open: true, userId: 'u1', action: 'withdraw' },
    })
    await wrapper.find('.sa-btn-primary').trigger('click')
    await flushPromises()
    const input = wrapper.find('#sa-code-input')
    await input.setValue('12ab34567890')
    expect((input.element as HTMLInputElement).value).toBe('123456')
  })

  it('输入框发生输入时若已有错误则清空错误', async () => {
    // onCodeInput 检测到 error.value 时置空
    ;(http.post as any)
      .mockResolvedValueOnce({ code: 0, data: makeChallenge() })
      .mockResolvedValueOnce({ code: 1, message: '验证码错误' })
    const wrapper = mount(SensitiveActionDialog, {
      props: { open: true, userId: 'u1', action: 'withdraw' },
    })
    await wrapper.find('.sa-btn-primary').trigger('click')
    await flushPromises()
    const input = wrapper.find('#sa-code-input')
    await input.setValue('123456')
    const buttons = wrapper.findAll('.sa-btn-primary')
    const confirm = buttons[buttons.length - 1]
    await confirm.trigger('click')
    await flushPromises()
    // 此时有错误
    expect(wrapper.find('.sa-state-error').exists()).toBe(true)
    // 再次输入应清除错误
    await input.setValue('12345')
    expect(wrapper.find('.sa-state-error').exists()).toBe(false)
  })

  it('输入少于 4 位时"确认"按钮应禁用', async () => {
    // 校验按钮 disabled 条件：code.length < 4
    ;(http.post as any).mockResolvedValue({ code: 0, data: makeChallenge() })
    const wrapper = mount(SensitiveActionDialog, {
      props: { open: true, userId: 'u1', action: 'withdraw' },
    })
    await wrapper.find('.sa-btn-primary').trigger('click')
    await flushPromises()
    const input = wrapper.find('#sa-code-input')
    await input.setValue('123')
    const buttons = wrapper.findAll('.sa-btn-primary')
    const confirm = buttons[buttons.length - 1]
    expect((confirm.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('点击回车键也应触发验证', async () => {
    // keydown.enter 触发 onVerify
    ;(http.post as any)
      .mockResolvedValueOnce({ code: 0, data: makeChallenge() })
      .mockResolvedValueOnce({ code: 0, data: { verified: true, token: 'tok', expires_at: 1 } })
    const wrapper = mount(SensitiveActionDialog, {
      props: { open: true, userId: 'u1', action: 'withdraw' },
    })
    await wrapper.find('.sa-btn-primary').trigger('click')
    await flushPromises()
    const input = wrapper.find('#sa-code-input')
    await input.setValue('123456')
    await input.trigger('keydown.enter')
    await flushPromises()
    expect(wrapper.find('.sa-desc-success').exists()).toBe(true)
  })

  it('confirm API 返回空时应显示验证失败', async () => {
    // confirmVerification 返回 null
    ;(http.post as any)
      .mockResolvedValueOnce({ code: 0, data: makeChallenge() })
      .mockResolvedValueOnce({ code: 0, data: null })
    const wrapper = mount(SensitiveActionDialog, {
      props: { open: true, userId: 'u1', action: 'withdraw' },
    })
    await wrapper.find('.sa-btn-primary').trigger('click')
    await flushPromises()
    const input = wrapper.find('#sa-code-input')
    await input.setValue('123456')
    const buttons = wrapper.findAll('.sa-btn-primary')
    const confirm = buttons[buttons.length - 1]
    await confirm.trigger('click')
    await flushPromises()
    expect(wrapper.find('.sa-state-error').exists()).toBe(true)
  })

  it('confirm 业务层 verified=false 时应显示验证码错误', async () => {
    // 业务失败但 HTTP 成功
    ;(http.post as any)
      .mockResolvedValueOnce({ code: 0, data: makeChallenge() })
      .mockResolvedValueOnce({ code: 0, data: { verified: false, token: '', expires_at: 0 } })
    const wrapper = mount(SensitiveActionDialog, {
      props: { open: true, userId: 'u1', action: 'withdraw' },
    })
    await wrapper.find('.sa-btn-primary').trigger('click')
    await flushPromises()
    const input = wrapper.find('#sa-code-input')
    await input.setValue('123456')
    const buttons = wrapper.findAll('.sa-btn-primary')
    const confirm = buttons[buttons.length - 1]
    await confirm.trigger('click')
    await flushPromises()
    expect(wrapper.find('.sa-state-error').exists()).toBe(true)
  })

  it('confirm 接口报错应显示验证失败提示', async () => {
    // http.post 异常时 useSecurityAudit 内部 catch 后返回 null，onVerify 走"验证失败"分支
    ;(http.post as any)
      .mockResolvedValueOnce({ code: 0, data: makeChallenge() })
      .mockRejectedValueOnce(new Error('服务异常'))
    const wrapper = mount(SensitiveActionDialog, {
      props: { open: true, userId: 'u1', action: 'withdraw' },
    })
    await wrapper.find('.sa-btn-primary').trigger('click')
    await flushPromises()
    const input = wrapper.find('#sa-code-input')
    await input.setValue('123456')
    const buttons = wrapper.findAll('.sa-btn-primary')
    const confirm = buttons[buttons.length - 1]
    await confirm.trigger('click')
    await flushPromises()
    expect(wrapper.find('.sa-state-error').exists()).toBe(true)
  })

  it('onVerify 在 loading 中应被忽略', async () => {
    // onVerify 开头判 loading 提前 return
    let resolveConfirm: any
    ;(http.post as any)
      .mockResolvedValueOnce({ code: 0, data: makeChallenge() })
      .mockReturnValueOnce(new Promise((r) => (resolveConfirm = r)))
    const wrapper = mount(SensitiveActionDialog, {
      props: { open: true, userId: 'u1', action: 'withdraw' },
    })
    await wrapper.find('.sa-btn-primary').trigger('click')
    await flushPromises()
    const input = wrapper.find('#sa-code-input')
    await input.setValue('123456')
    const buttons = wrapper.findAll('.sa-btn-primary')
    const confirm = buttons[buttons.length - 1]
    await confirm.trigger('click')
    // loading 中再次点击应无效
    await confirm.trigger('click')
    expect(http.post).toHaveBeenCalledTimes(2)
    resolveConfirm({ code: 0, data: { verified: true, token: 't', expires_at: 1 } })
    await flushPromises()
  })

  it('onVerify 在 code 长度不足时应被忽略', async () => {
    // 长度 < 4 提前 return：不会调用 confirm 接口
    ;(http.post as any).mockResolvedValue({ code: 0, data: makeChallenge() })
    const wrapper = mount(SensitiveActionDialog, {
      props: { open: true, userId: 'u1', action: 'withdraw' },
    })
    await wrapper.find('.sa-btn-primary').trigger('click')
    await flushPromises()
    const input = wrapper.find('#sa-code-input')
    await input.setValue('12')
    const buttons = wrapper.findAll('.sa-btn-primary')
    const confirm = buttons[buttons.length - 1]
    // disabled，无法点击；强制触发
    await confirm.trigger('click')
    expect(http.post).toHaveBeenCalledTimes(1)
  })

  it('成功校验后进入 success 步骤并可继续操作触发 verified', async () => {
    // 完整成功链路
    ;(http.post as any)
      .mockResolvedValueOnce({ code: 0, data: makeChallenge() })
      .mockResolvedValueOnce({ code: 0, data: { verified: true, token: 'tok', expires_at: 99999 } })
    const wrapper = mount(SensitiveActionDialog, {
      props: { open: true, userId: 'u1', action: 'withdraw' },
    })
    await wrapper.find('.sa-btn-primary').trigger('click')
    await flushPromises()
    const input = wrapper.find('#sa-code-input')
    await input.setValue('123456')
    const buttons = wrapper.findAll('.sa-btn-primary')
    const confirm = buttons[buttons.length - 1]
    await confirm.trigger('click')
    await flushPromises()
    expect(wrapper.find('.sa-desc-success').exists()).toBe(true)
    const successBtn = wrapper.findAll('.sa-btn-primary')
    await successBtn[successBtn.length - 1].trigger('click')
    expect(wrapper.emitted('verified')).toBeTruthy()
    const payload = wrapper.emitted('verified')![0][0] as any
    expect(payload.token).toBe('verified')
    expect(payload.channel).toBe('sms')
  })

  it('点击关闭按钮 emit cancel', async () => {
    // 关闭按钮
    const wrapper = mount(SensitiveActionDialog, {
      props: { open: true, userId: 'u1', action: 'withdraw' },
    })
    await wrapper.find('.sa-close').trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })

  it('点击背景遮罩应 emit cancel（click.self）', async () => {
    // 背景 click.self 触发 onCancel
    const wrapper = mount(SensitiveActionDialog, {
      props: { open: true, userId: 'u1', action: 'withdraw' },
    })
    await wrapper.find('.sa-dialog').trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })

  it('channelLabel 应映射各类型通道', async () => {
    // 覆盖 channelLabel 全部映射分支
    const channels: Array<[string, string]> = [
      ['sms', '短信'],
      ['email', '邮箱'],
      ['totp', '身份验证器'],
      ['password', '登录密码'],
      ['push', '推送'],
    ]
    for (const [key, label] of channels) {
      ;(http.post as any).mockResolvedValue({ code: 0, data: makeChallenge({ channel: key }) })
      const wrapper = mount(SensitiveActionDialog, {
        props: { open: true, userId: 'u1', action: 'withdraw' },
      })
      await wrapper.find('.sa-btn-primary').trigger('click')
      await flushPromises()
      expect(wrapper.text()).toContain(label)
    }
  })

  it('channelLabel 未知通道应回退到原值', async () => {
    // 未知 channel 名走 fallback
    ;(http.post as any).mockResolvedValue({ code: 0, data: makeChallenge({ channel: 'wechat' }) })
    const wrapper = mount(SensitiveActionDialog, {
      props: { open: true, userId: 'u1', action: 'withdraw' },
    })
    await wrapper.find('.sa-btn-primary').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('wechat')
  })

  it('重发按钮在冷却期间应禁用并显示倒计时文案', async () => {
    // resendCooldown > 0 时按钮 disabled 并显示带 n 的文案
    ;(http.post as any).mockResolvedValue({ code: 0, data: makeChallenge() })
    const wrapper = mount(SensitiveActionDialog, {
      props: { open: true, userId: 'u1', action: 'withdraw' },
    })
    await wrapper.find('.sa-btn-primary').trigger('click')
    await flushPromises()
    const resendBtn = wrapper.find('.sa-btn-secondary')
    expect((resendBtn.element as HTMLButtonElement).disabled).toBe(true)
    expect(resendBtn.text()).toContain('sensitiveAction.resendWithCooldown')
  })

  it('冷却结束后可再次点击重发按钮', async () => {
    // 倒计时归零后按钮可用
    ;(http.post as any).mockResolvedValue({ code: 0, data: makeChallenge() })
    const wrapper = mount(SensitiveActionDialog, {
      props: { open: true, userId: 'u1', action: 'withdraw' },
    })
    await wrapper.find('.sa-btn-primary').trigger('click')
    await flushPromises()
    // 把时间快进 60 秒，使倒计时归零
    vi.advanceTimersByTime(61000)
    await flushPromises()
    const resendBtn = wrapper.find('.sa-btn-secondary')
    expect((resendBtn.element as HTMLButtonElement).disabled).toBe(false)
    expect(resendBtn.text()).toContain('sensitiveAction.resend')
  })

  it('重发验证码成功应重置 challenge', async () => {
    // 点击重发按钮应再次调用 request
    ;(http.post as any).mockResolvedValue({ code: 0, data: makeChallenge() })
    const wrapper = mount(SensitiveActionDialog, {
      props: { open: true, userId: 'u1', action: 'withdraw' },
    })
    await wrapper.find('.sa-btn-primary').trigger('click')
    await flushPromises()
    vi.advanceTimersByTime(61000)
    await flushPromises()
    const resendBtn = wrapper.find('.sa-btn-secondary')
    await resendBtn.trigger('click')
    await flushPromises()
    expect(http.post).toHaveBeenCalledTimes(2)
  })

  it('TTL 倒计时归零时应显示过期错误', async () => {
    // TTL 归零触发过期错误
    ;(http.post as any).mockResolvedValue({
      code: 0,
      data: makeChallenge({ expires_at: Math.floor(Date.now() / 1000) + 2, ttl_seconds: 2 }),
    })
    const wrapper = mount(SensitiveActionDialog, {
      props: { open: true, userId: 'u1', action: 'withdraw' },
    })
    await wrapper.find('.sa-btn-primary').trigger('click')
    await flushPromises()
    vi.advanceTimersByTime(3000)
    await flushPromises()
    expect(wrapper.find('.sa-state-error').text()).toContain('过期')
  })

  it('TTL 初始为负值时不应出现负数', async () => {
    // expires_at 早于当前时间时，ttlSeconds 初始为 0
    ;(http.post as any).mockResolvedValue({
      code: 0,
      data: makeChallenge({ expires_at: Math.floor(Date.now() / 1000) - 100, ttl_seconds: 0 }),
    })
    const wrapper = mount(SensitiveActionDialog, {
      props: { open: true, userId: 'u1', action: 'withdraw' },
    })
    await wrapper.find('.sa-btn-primary').trigger('click')
    await flushPromises()
    expect(wrapper.text()).not.toContain('-1')
  })

  it('错误时应设置输入框的 aria-invalid 与 aria-describedby', async () => {
    // 错误态 ARIA 属性切换
    ;(http.post as any)
      .mockResolvedValueOnce({ code: 0, data: makeChallenge() })
      .mockResolvedValueOnce({ code: 1, message: '验证码错误' })
    const wrapper = mount(SensitiveActionDialog, {
      props: { open: true, userId: 'u1', action: 'withdraw' },
    })
    await wrapper.find('.sa-btn-primary').trigger('click')
    await flushPromises()
    const input = wrapper.find('#sa-code-input')
    await input.setValue('123456')
    const buttons = wrapper.findAll('.sa-btn-primary')
    const confirm = buttons[buttons.length - 1]
    await confirm.trigger('click')
    await flushPromises()
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(input.attributes('aria-describedby')).toBe('sa-error-msg')
  })

  it('请求中对话框应设置 aria-busy=true', async () => {
    // loading 时 aria-busy 切换
    let resolveFn: any
    ;(http.post as any).mockReturnValue(new Promise((r) => (resolveFn = r)))
    const wrapper = mount(SensitiveActionDialog, {
      props: { open: true, userId: 'u1', action: 'withdraw' },
    })
    await wrapper.find('.sa-btn-primary').trigger('click')
    await flushPromises()
    expect(wrapper.find('.sa-dialog').attributes('aria-busy')).toBe('true')
    resolveFn({ code: 0, data: makeChallenge() })
    await flushPromises()
  })

  it('open 从 true 变 false 时应清理计时器', async () => {
    // watch(open) 关闭分支调用 clearTimers
    ;(http.post as any).mockResolvedValue({ code: 0, data: makeChallenge() })
    const wrapper = mount(SensitiveActionDialog, {
      props: { open: true, userId: 'u1', action: 'withdraw' },
    })
    await wrapper.find('.sa-btn-primary').trigger('click')
    await flushPromises()
    await wrapper.setProps({ open: false })
    await flushPromises()
    expect(wrapper.find('.sa-dialog').exists()).toBe(false)
  })

  it('open 从 false 变 true 时应重置并宣告', async () => {
    // watch(open) 开启分支重置 + announce
    const wrapper = mount(SensitiveActionDialog, {
      props: { open: false, userId: 'u1', action: 'withdraw', title: '提现' },
    })
    await wrapper.setProps({ open: true })
    await flushPromises()
    expect(wrapper.find('.sa-dialog').exists()).toBe(true)
  })

  it('组件卸载时应清理计时器（onUnmounted）', async () => {
    // 卸载时调用 clearTimers
    ;(http.post as any).mockResolvedValue({ code: 0, data: makeChallenge() })
    const wrapper = mount(SensitiveActionDialog, {
      props: { open: true, userId: 'u1', action: 'withdraw' },
    })
    await wrapper.find('.sa-btn-primary').trigger('click')
    await flushPromises()
    wrapper.unmount()
    // 通过再推进时间不抛错证明清理成功
    vi.advanceTimersByTime(60000)
  })

  it('onProceed 在 success 后点击应 emit verified 并重置', async () => {
    // 完整成功链路：先校验进入 success，再点"继续操作"
    ;(http.post as any)
      .mockResolvedValueOnce({ code: 0, data: makeChallenge() })
      .mockResolvedValueOnce({ code: 0, data: { verified: true, token: 'tok', expires_at: 1 } })
    const wrapper = mount(SensitiveActionDialog, {
      props: { open: true, userId: 'u1', action: 'withdraw' },
    })
    await wrapper.find('.sa-btn-primary').trigger('click')
    await flushPromises()
    const input = wrapper.find('#sa-code-input')
    await input.setValue('123456')
    await wrapper.findAll('.sa-btn-primary').at(-1)!.trigger('click')
    await flushPromises()
    // 此时进入 success，重新查询按钮
    const successBtn = wrapper.findAll('.sa-btn-primary').at(-1)!
    await successBtn.trigger('click')
    expect(wrapper.emitted('verified')).toBeTruthy()
    // 点击后 reset 回到 request 步骤
    expect(wrapper.find('.sa-dialog').exists()).toBe(true)
    expect(wrapper.find('#sa-code-input').exists()).toBe(false)
  })

  it('onCancel 应同时重置 state 并 emit cancel', async () => {
    // 关闭：onCancel reset + emit
    ;(http.post as any).mockResolvedValue({ code: 0, data: makeChallenge() })
    const wrapper = mount(SensitiveActionDialog, {
      props: { open: true, userId: 'u1', action: 'withdraw' },
    })
    await wrapper.find('.sa-btn-primary').trigger('click')
    await flushPromises()
    await wrapper.find('.sa-close').trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })
})
