// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AccountCancelScreen(RN 侧)注销后果与只读手机号契约测试。
 *
 * 判的是端内壳职责 + 共享屏新能力真渲染:
 *   - RN 真传 7 项 consequences ⇒ 注销后果列表出现(可见差异)
 *   - RN 真传 phoneReadOnly=true ⇒ 手机号只读展示,不再出现可编辑输入框
 *   - RN 保留二次确认弹窗(首击开 5 秒弹窗),不被"无弹窗端"的页级倒计时误锁
 * 双向阴性对照:phoneReadOnly=false 时输入框回归;showConfirmModal=false 时页级倒计时生效。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const { apiMocks, navMocks } = vi.hoisted(() => ({
  apiMocks: {
    deleteAccountWithCode: vi.fn(),
    sendSmsCode: vi.fn(),
    appAlert: vi.fn(),
  },
  navMocks: { goBack: vi.fn() },
}))

vi.mock('@ihui/api-client', () => ({
  deleteAccountWithCode: apiMocks.deleteAccountWithCode,
  sendSmsCode: apiMocks.sendSmsCode,
}))
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: vi.fn(), goBack: navMocks.goBack }),
}))
vi.mock('@react-navigation/native-stack', () => ({}))
vi.mock('../src/i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('../src/context/ThemeContext', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }))
vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { phone: '13800138000' }, logout: vi.fn() }),
}))
vi.mock('../src/components/BottomPops', () => ({ appAlert: apiMocks.appAlert }))
vi.mock('@ihui/shared/utils', () => ({ toUserFriendlyMessage: (e: unknown) => String(e) }))

import AccountCancelScreen from '../src/screens/AccountCancelScreen'
import { AccountCancelScreen as SharedAccountCancelScreen } from '@ihui/rn-app'

const SHARED_BASE_PROPS = {
  t: (key: string) => key,
  phone: '13800138000',
  confirmText: '',
  smsCode: '',
  countdown: 0,
  showConfirmModal: false,
  confirmCountdown: 0,
  submitting: false,
  consequences: [],
  onPhoneChange: () => {},
  onConfirmTextChange: () => {},
  onSmsCodeChange: () => {},
  onSendSms: () => {},
  onSubmit: () => {},
  onCloseModal: () => {},
  onBack: () => {},
  colorScheme: 'light' as const,
}

describe('AccountCancelScreen 注销后果与只读手机号(RN)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('7 项后果逐项可见 + 手机号只读展示', () => {
    render(<AccountCancelScreen />)
    for (let i = 1; i <= 7; i += 1) {
      expect(screen.getByText(new RegExp(`settings\\.accountDeletionConsequence${i}`))).toBeTruthy()
    }
    expect(screen.getByText('13800138000')).toBeTruthy()
    // phoneReadOnly=true ⇒ 手机号不再有可编辑输入框
    expect(screen.queryByPlaceholderText('settings.accountDeletionPhonePlaceholder')).toBeNull()
  })

  it('阴性对照:phoneReadOnly=false ⇒ 同一判据下输入框回归', () => {
    render(<SharedAccountCancelScreen {...SHARED_BASE_PROPS} phoneReadOnly={false} />)
    expect(screen.getByPlaceholderText('settings.accountDeletionPhonePlaceholder')).toBeTruthy()
    expect(screen.getByText('settings.accountDeletionPhoneLabel')).toBeTruthy()
  })

  it('RN 首击仍开 5 秒二次确认弹窗(主按钮不被页级倒计时锁)', () => {
    render(<AccountCancelScreen />)
    // mount 时 confirmCountdown=0 ⇒ 主按钮是正常文案,不是页级倒计时读数
    expect(screen.getByText('settings.accountDeletionSubmit')).toBeTruthy()
    fireEvent.change(screen.getByPlaceholderText('settings.accountDeletionCodePlaceholder'), {
      target: { value: '123456' },
    })
    fireEvent.change(screen.getByPlaceholderText('settings.accountDeletionConfirm'), {
      target: { value: '确认注销' },
    })
    fireEvent.click(screen.getByText('settings.accountDeletionSubmit'))
    expect(screen.getByText('settings.accountDeletionConfirmTitle')).toBeTruthy()
    expect(apiMocks.deleteAccountWithCode).not.toHaveBeenCalled()
  })

  it('阴性对照:showConfirmModal=false + 倒计时读数 ⇒ 页级闸生效(仅无弹窗端)', () => {
    render(
      <SharedAccountCancelScreen
        {...SHARED_BASE_PROPS}
        phoneReadOnly={true}
        showConfirmModal={false}
        confirmCountdown={5}
      />,
    )
    const submit = screen.getByText('5s')
    expect(submit).toBeTruthy()
    expect(screen.queryByText('settings.accountDeletionSubmit')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
