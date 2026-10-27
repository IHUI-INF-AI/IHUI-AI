// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RN「扫一扫登录」登录态守卫行为锁(2026-10-27 立)。
 *
 * 现读不对称:小程序 `handleScanLogin` 进门先判 `isLoggedIn()`,未登录直接提示
 * `scanLogin.needLogin` 且不拉相机;RN 的 ScanLoginScreen 没有这一格 ⇒ 未登录用户扫到码
 * 只会得到一句"确认失败",真因(没登录)在文案里看不见,而相机授权框还照样弹了一次。
 * 五语言的 `scanLogin.needLogin` 早就在包里的,只是没人接 —— 本套件钉的就是"接上了"。
 *
 * 四档判据(缺一档就少一档牙):
 *   ① 未登录 ⇒ 上 needLogin 文案 + 「去登录」落到已注册屏,且**不申请相机权限、不渲染相机、不发确认请求**;
 *   ② 已登录 ⇒ 相机层照常起来(证明这条守卫不是把整屏关掉);
 *   ③ 未登录时点「去登录」⇒ navigate('Login')(真跳转出口,不是提示完就停);
 *   ④ 判据来源锁 ⇒ 登录态只认共享工厂的 selectIsAuthenticated(端内不得自算 token 布尔)。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement } from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

const h = vi.hoisted(() => ({
  nav: { navigate: vi.fn(), goBack: vi.fn() },
  requestPermission: vi.fn(async () => ({ granted: true, status: 'granted', canAskAgain: false })),
  confirmQrLogin: vi.fn(async () => ({ success: true, data: { confirmed: true } })),
  appAlert: vi.fn(),
  cameraMounts: 0,
}))

// expo-camera 是真原生模块,vitest 下起不来:CameraView 记账自己的挂载次数,
// 这样"未登录不许渲染相机"这一档判据量得到,而不是靠读源码猜。
vi.mock('expo-camera', () => ({
  CameraView: () => {
    h.cameraMounts += 1
    return createElement('div', { 'data-role': 'camera' })
  },
  useCameraPermissions: () => [
    { granted: true, status: 'granted', canAskAgain: false },
    h.requestPermission,
  ],
}))

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: h.nav.navigate, goBack: h.nav.goBack }),
}))

vi.mock('@ihui/api-client', () => ({ confirmQrLogin: h.confirmQrLogin }))
vi.mock('../src/components/BottomPops', () => ({ appAlert: h.appAlert }))

import { ScanLoginScreen } from '../src/screens/ScanLoginScreen'
import { rnAuthStore, selectIsAuthenticated } from '../src/stores/auth-store'
import { I18nProvider, messages } from '../src/i18n'

const zh = messages['zh-CN'] as Record<string, unknown>
const needLoginText = (zh.scanLogin as Record<string, string>).needLogin
const loginText = (zh.common as Record<string, string>).login

function renderScreen() {
  return render(createElement(I18nProvider, null, createElement(ScanLoginScreen)))
}

beforeEach(() => {
  h.nav.navigate.mockReset()
  h.nav.goBack.mockReset()
  h.requestPermission.mockClear()
  h.confirmQrLogin.mockClear()
  h.appAlert.mockReset()
  h.cameraMounts = 0
})

afterEach(() => {
  cleanup()
})

/** 走真实 store 与真实判据(token 是登录态唯一事实),不在测试里复抄判据(§0.6/门 191)。 */
function asLoggedOut() {
  rnAuthStore.setState({ token: null, refreshToken: null } as never)
}
function asLoggedIn() {
  rnAuthStore.setState({ token: 'test-access', refreshToken: 'test-refresh' } as never)
}

describe('ScanLoginScreen 登录态守卫', () => {
  it('未登录:提示"先登录"并给出去登录出口,相机与确认请求都不起', () => {
    asLoggedOut()
    renderScreen()
    expect(screen.getByText(needLoginText)).toBeTruthy()
    expect(screen.getByText(loginText)).toBeTruthy()
    expect(h.cameraMounts).toBe(0)
    expect(h.requestPermission).not.toHaveBeenCalled()
    expect(h.confirmQrLogin).not.toHaveBeenCalled()
  })

  it('未登录点「登录」:落到已注册的 Login 屏(不是提示完就停)', () => {
    asLoggedOut()
    renderScreen()
    fireEvent.click(screen.getByText(loginText))
    expect(h.nav.navigate).toHaveBeenCalledWith('Login')
  })

  it('已登录:相机层照常渲染(守卫不是把整屏关掉)', () => {
    asLoggedIn()
    renderScreen()
    expect(screen.queryByText(needLoginText)).toBeNull()
    expect(h.cameraMounts).toBe(1)
  })

  it('登录态判据只认共享工厂那一份选择器(端内不得自算 token 布尔)', () => {
    // ①②③ 已经用行为量到"守卫排在相机之前";这一档钉的是判据来源:
    // selectIsAuthenticated 必须是 re-export 自共享工厂的选择器,而不是端内 `Boolean(token)` 第二份。
    asLoggedOut()
    const a = rnAuthStore.getState()
    expect(selectIsAuthenticated(a)).toBe(false)
    asLoggedIn()
    expect(selectIsAuthenticated(rnAuthStore.getState())).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
