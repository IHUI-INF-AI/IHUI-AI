// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ChangePhoneScreen(RN 侧)旧验证码安全步骤契约测试。
 *
 * 判的是端内壳职责 + 共享屏新行真渲染:
 *   - RN 传真实旧手机号 ⇒ 界面新增"当前手机号 + 旧验证码"行(web 已有步骤的正向 parity)
 *   - 旧码发送打 /api/auth/sms/send 并进入 60s 倒计时(倒计时期间发送口不可再点)
 *   - 旧码为空时提交被拦(不发 /api/auth/change-phone/confirm);填入旧码后同一动作放行
 * 双向阴性对照:oldPhone 为空时新行不出现;填好旧码后提交按钮由禁用转可用。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const { apiMocks, authState } = vi.hoisted(() => ({
  apiMocks: { fetchApi: vi.fn(), goBack: vi.fn() },
  authState: { phone: '13800138000' },
}))

vi.mock('@ihui/api-client', () => ({ fetchApi: apiMocks.fetchApi }))
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: vi.fn(), goBack: apiMocks.goBack }),
}))
vi.mock('@react-navigation/native-stack', () => ({}))
vi.mock('../src/i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('../src/context/ThemeContext', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }))
vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { phone: authState.phone } }),
}))
vi.mock('../src/components/FloatBox', () => ({ FloatBox: () => null }))
vi.mock('@ihui/shared/utils', () => ({
  apiFailureToError: (res: unknown) => new Error(String(res)),
  toUserFriendlyMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}))

import { ChangePhoneScreen } from '../src/screens/ChangePhoneScreen'

function fillNewPhoneAndCodes(oldCode: string | null, newCode: string) {
  fireEvent.change(screen.getByPlaceholderText('user.profile.newPhonePlaceholder'), {
    target: { value: '13900139000' },
  })
  const codeInputs = screen.getAllByPlaceholderText('user.profile.codePlaceholder')
  if (oldCode === null) {
    fireEvent.change(codeInputs[0]!, { target: { value: newCode } })
    return
  }
  if (oldCode) fireEvent.change(codeInputs[0]!, { target: { value: oldCode } })
  fireEvent.change(codeInputs[1]!, { target: { value: newCode } })
}

function submitBtn(): HTMLButtonElement {
  return screen.getByLabelText('user.profile.confirmChange') as unknown as HTMLButtonElement
}

describe('ChangePhoneScreen 旧验证码步骤(RN)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.phone = '13800138000'
    apiMocks.fetchApi.mockResolvedValue({ success: true, data: {} })
  })

  it('已绑定手机号 ⇒ 新增“当前手机号 + 旧验证码”行', () => {
    render(<ChangePhoneScreen />)
    expect(screen.getByText('user.profile.oldPhone')).toBeTruthy()
    expect(screen.getByText('13800138000')).toBeTruthy()
    expect(screen.getByText('user.profile.oldCode')).toBeTruthy()
    expect(screen.getByLabelText('user.profile.sendOldCode')).toBeTruthy()
  })

  it('阴性对照:未绑定手机号 ⇒ 同一判据不得命中新行', () => {
    authState.phone = ''
    render(<ChangePhoneScreen />)
    expect(screen.queryByText('user.profile.oldPhone')).toBeNull()
    expect(screen.queryByText('user.profile.oldCode')).toBeNull()
    expect(screen.queryByLabelText('user.profile.sendOldCode')).toBeNull()
    // 旧码槽缺席时提交不应被旧码闸禁用(证明闸门是 new prop 带来的,不是无条件)
    fillNewPhoneAndCodes(null, '654321')
    expect(submitBtn().disabled).toBe(false)
  })

  it('获取旧验证码打 /api/auth/sms/send 且倒计时期间发送口不可再点', async () => {
    render(<ChangePhoneScreen />)
    fireEvent.click(screen.getByLabelText('user.profile.sendOldCode'))
    await waitFor(() => {
      expect(apiMocks.fetchApi).toHaveBeenCalledWith(
        '/api/auth/sms/send',
        expect.objectContaining({ method: 'POST' }),
      )
    })
    expect(JSON.parse(apiMocks.fetchApi.mock.calls[0]![1].body as string)).toEqual({
      phone: '13800138000',
      scene: 'phone-binding',
    })
    await waitFor(() => {
      expect(screen.getByText('user.profile.resend')).toBeTruthy()
    })
    // 阴性对照:倒计时已起 ⇒ 同一发送口不得仍可点(闸生效)
    expect(screen.queryByLabelText('user.profile.sendOldCode')).toBeNull()
  })

  it('旧码为空 ⇒ 提交被拦,不发 confirm 请求', () => {
    render(<ChangePhoneScreen />)
    fillNewPhoneAndCodes('', '654321')
    expect(submitBtn().disabled).toBe(true)
    fireEvent.click(submitBtn())
    expect(apiMocks.fetchApi).not.toHaveBeenCalled()
  })

  it('填入旧码 ⇒ 同一提交动作放行到 /api/auth/change-phone/confirm', async () => {
    render(<ChangePhoneScreen />)
    fillNewPhoneAndCodes('123456', '654321')
    expect(submitBtn().disabled).toBe(false)
    fireEvent.click(submitBtn())
    await waitFor(() => {
      expect(apiMocks.fetchApi).toHaveBeenCalledWith(
        '/api/auth/change-phone/confirm',
        expect.objectContaining({ method: 'POST' }),
      )
    })
    // 旧码是端内安全步骤,不写入 confirm 请求体
    expect(JSON.parse(apiMocks.fetchApi.mock.calls[0]![1].body as string)).toEqual({
      newPhone: '13900139000',
      code: '654321',
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
