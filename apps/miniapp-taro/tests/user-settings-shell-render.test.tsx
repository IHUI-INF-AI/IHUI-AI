// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 设置页薄壳锁(apps/miniapp-taro/src/pkg-user/user/settings.tsx)。
//
// 判据:
//   ① 源码钉住共享屏入口;页内不得再出现 View/Text/Switch/LineIcon 渲染段
//   ② 20 个 prop 逐个到齐(集合精确相等),值语义与端内事实一致
//   ③ 菜单 13 行真实跳转;语言/主题/通知/密码/退出/弹窗回调真调用
//   (阴性对照:摘掉任一 prop、摘掉 changePhone 路由、把共享屏换回本地 View,断言立即转红)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'

const h = vi.hoisted(() => ({
  props: null as Record<string, unknown> | null,
  navigateTo: vi.fn(),
  navigateBack: vi.fn(),
  showModal: vi.fn(),
  setLocale: vi.fn(),
  setThemeMode: vi.fn(),
  onToast: vi.fn(),
  clearAuth: vi.fn(),
  goToLogin: vi.fn(),
  getMiniappVersion: vi.fn(() => '1.2.3'),
  setLanguage: vi.fn(),
  setTheme: vi.fn(),
  updateNotificationPreferences: vi.fn(),
  changePassword: vi.fn(),
  logout: vi.fn(),
  getProfile: vi.fn(),
  getNotificationPreferences: vi.fn(),
}))

vi.mock('@ihui/rn-app/features/settings/SettingsScreen', () => ({
  SettingsScreen: (p: Record<string, unknown>) => {
    h.props = p
    return createElement('div', { 'data-screen': 'settings' })
  },
}))

vi.mock('@/api', () => ({
  getProfile: h.getProfile,
  getNotificationPreferences: h.getNotificationPreferences,
  updateNotificationPreferences: h.updateNotificationPreferences,
  changePassword: h.changePassword,
  logout: h.logout,
  setLanguage: h.setLanguage,
  setTheme: h.setTheme,
}))

vi.mock('@tarojs/taro', () => {
  const api = {
    navigateTo: h.navigateTo,
    navigateBack: h.navigateBack,
    showModal: h.showModal,
  }
  return { default: api, ...api, useDidShow: vi.fn() }
})

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    locale: 'zh-CN',
    setLocale: h.setLocale,
  }),
  useTt: () => (key: string, fallback?: string) => fallback ?? key,
}))

vi.mock('@/rn-compat/theme', () => ({
  useTheme: () => ({ themeMode: 'light', resolvedTheme: 'dark', setThemeMode: h.setThemeMode }),
}))
vi.mock('@/utils/auth', () => ({ clearAuth: h.clearAuth, goToLogin: h.goToLogin }))
vi.mock('@/utils/app-version', () => ({ getMiniappVersion: h.getMiniappVersion }))
vi.mock('@/utils/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('@/host/on-toast', () => ({ onToast: h.onToast }))
vi.mock('@/hooks/use-auth-ready-gate', () => ({
  useAuthReadyGate: () => ({ waitUntilReady: (cb: () => void) => cb() }),
}))
vi.mock('@/components/ThemeRoot', () => {
  const Stub = (props: { children?: ReactNode }) =>
    createElement('div', { 'data-theme-root': '' }, props.children)
  Stub.displayName = 'ThemeRootStub'
  return { default: Stub }
})

import SettingsPage, { maskPhone } from '../src/pkg-user/user/settings'

const SOURCE = readFileSync(resolve('src/pkg-user/user/settings.tsx'), 'utf8')

const EXPECTED_KEYS = [
  't',
  'user',
  'locale',
  'localeOptions',
  'onSelectLocale',
  'theme',
  'themeOptions',
  'onSelectTheme',
  'notifications',
  'onToggleNotification',
  'onEditProfile',
  'onChangePassword',
  'onAlert',
  'onConfirm',
  'onLogout',
  'menuItems',
  'onMenuPress',
  'appVersion',
  'onBack',
  'colorScheme',
]

const EXPECTED_MENU_KEYS = [
  'changePhone',
  'realname',
  'email',
  'accountCancel',
  'cache',
  'feedback',
  'about',
  'announcement',
  'activity',
  'aiSkill',
  'privacy',
  'agreement',
  'appPermission',
]

const MENU_TARGETS: Record<string, string> = {
  changePhone: '/pkg-user/user/phone',
  realname: '/pkg-user/user/realname',
  email: '/pkg-user/user/email',
  accountCancel: '/pkg-user/account-cancel/index',
  cache: '/pages/setting/cache',
  feedback: '/pkg-user/user/feedback',
  about: '/pkg-about/about/index',
  announcement: '/pkg-content/announcement/index',
  activity: '/pkg-content/activity/index',
  aiSkill: '/pkg-ai/ai-skill/index',
  privacy: '/pkg-about/about/privacy',
  agreement: '/pkg-about/about/protocol',
  appPermission: '/pkg-about/about/app-permission/index',
}

function assertShellSource(src: string): void {
  expect(src).toContain("from '@ihui/rn-app/features/settings/SettingsScreen'")
  expect(src).toContain('<SharedSettingsScreen')
  expect(src).not.toContain('@tarojs/components')
  expect(src).not.toContain('<View')
  expect(src).not.toContain('<Text')
  expect(src).not.toContain('<Switch')
  expect(src).not.toContain('LineIcon')
}

function assertSharedScreenProps(props: Record<string, unknown>): void {
  expect(Object.keys(props).sort()).toEqual([...EXPECTED_KEYS].sort())
  expect(props.user).toBeNull()
  expect(props.locale).toBe('zh-CN')
  expect((props.localeOptions as Array<{ value: string }>).map((x) => x.value)).toEqual([
    'zh-CN',
    'zh-TW',
    'en',
    'ko',
    'ja',
  ])
  expect((props.themeOptions as Array<{ value: string }>).map((x) => x.value)).toEqual([
    'light',
    'dark',
    'system',
  ])
  expect(props.theme).toBe('light')
  expect(props.colorScheme).toBe('dark')
  expect(props.appVersion).toBe('1.2.3')
  expect(props.notifications).toEqual({ push: true, message: true, email: false })
  const menu = props.menuItems as Array<{ key: string; label: string }>
  expect(menu.map((x) => x.key)).toEqual(EXPECTED_MENU_KEYS)
  expect(menu[0]?.label).toBe('更换手机号（未绑定）')
  for (const key of [
    't',
    'onSelectLocale',
    'onSelectTheme',
    'onToggleNotification',
    'onEditProfile',
    'onChangePassword',
    'onAlert',
    'onConfirm',
    'onLogout',
    'onMenuPress',
    'onBack',
  ]) {
    expect(typeof props[key]).toBe('function')
  }
}

function renderPage(): Record<string, unknown> {
  h.props = null
  renderToStaticMarkup(createElement(SettingsPage))
  expect(h.props).not.toBeNull()
  return h.props as unknown as Record<string, unknown>
}

describe('user/settings 薄壳', () => {
  beforeEach(() => {
    h.props = null
    h.navigateTo.mockReset()
    h.navigateBack.mockReset()
    h.showModal.mockReset()
    h.setLocale.mockReset()
    h.setThemeMode.mockReset()
    h.onToast.mockReset()
    h.clearAuth.mockReset()
    h.goToLogin.mockReset()
    h.getMiniappVersion.mockReset()
    h.setLanguage.mockReset()
    h.setTheme.mockReset()
    h.updateNotificationPreferences.mockReset()
    h.changePassword.mockReset()
    h.logout.mockReset()
    h.getProfile.mockReset()
    h.getNotificationPreferences.mockReset()

    h.getMiniappVersion.mockReturnValue('1.2.3')
    h.setLanguage.mockResolvedValue({ success: true })
    h.setTheme.mockResolvedValue({ success: true })
    h.updateNotificationPreferences.mockResolvedValue({ success: true })
    h.changePassword.mockResolvedValue({ success: true })
    h.logout.mockResolvedValue({ success: true })
    h.getProfile.mockResolvedValue({
      id: 'u1',
      nickname: '阿甲',
      avatar: 'https://img.example/a.png',
      email: 'a@x.com',
      phone: '13800138000',
    })
    h.getNotificationPreferences.mockResolvedValue({
      pushEnabled: true,
      inAppEnabled: true,
      emailEnabled: false,
    })
    h.showModal.mockImplementation(
      (opts: { success?: (r: { confirm: boolean; cancel: boolean }) => void }) => {
        opts.success?.({ confirm: true, cancel: false })
      },
    )
  })

  it('① 源码钉住共享屏入口,页内渲染型 JSX 已清零', () => {
    assertShellSource(SOURCE)

    // 阴性对照:换回本地 View / 删掉共享屏 import / 重新引 @tarojs/components 立即转红
    expect(() =>
      assertShellSource(
        SOURCE.replace(
          "from '@ihui/rn-app/features/settings/SettingsScreen'",
          "from '@/components/ThemeRoot'",
        ),
      ),
    ).toThrow()
    expect(() => assertShellSource(SOURCE.replace('<SharedSettingsScreen', '<View'))).toThrow()
    expect(() =>
      assertShellSource(
        SOURCE.replace(
          'import Taro, { useDidShow }',
          "import { View } from '@tarojs/components'\nimport Taro, { useDidShow }",
        ),
      ),
    ).toThrow()
  })

  it('② 20 个 prop 逐个到齐,菜单 13 行与选项语义一致', () => {
    assertSharedScreenProps(renderPage())
  })

  it('③ 阴性对照:摘 prop / 少菜单行 / 换 colorScheme 必须红', () => {
    const good = renderPage()
    const noMenu = { ...good }
    delete noMenu.menuItems
    expect(() => assertSharedScreenProps(noMenu)).toThrow()
    expect(() =>
      assertSharedScreenProps({ ...good, menuItems: (good.menuItems as unknown[]).slice(1) }),
    ).toThrow()
    expect(() => assertSharedScreenProps({ ...good, colorScheme: 'light' })).toThrow()
    expect(() => assertSharedScreenProps({ ...good, appVersion: undefined })).toThrow()
    expect(() => assertSharedScreenProps({ ...good, user: {} })).toThrow()
  })

  it('④ 菜单 13 行真跳转,编辑资料/返回/语言/主题/通知/密码/退出链路接通', async () => {
    const p = renderPage()

    for (const [key, url] of Object.entries(MENU_TARGETS)) {
      ;(p.onMenuPress as (k: string) => void)(key)
      expect(h.navigateTo).toHaveBeenLastCalledWith({ url })
    }
    ;(p.onMenuPress as (k: string) => void)('unknown')
    expect(h.navigateTo).toHaveBeenCalledTimes(13)

    ;(p.onEditProfile as () => void)()
    expect(h.navigateTo).toHaveBeenLastCalledWith({ url: '/pkg-user/user/profile' })
    ;(p.onBack as () => void)()
    expect(h.navigateBack).toHaveBeenCalledTimes(1)

    // 语言:同值 no-op,异值本地切换 + 落库
    ;(p.onSelectLocale as (v: string) => void)('zh-CN')
    expect(h.setLocale).not.toHaveBeenCalled()
    ;(p.onSelectLocale as (v: string) => void)('en')
    expect(h.setLocale).toHaveBeenCalledWith('en')
    expect(h.setLanguage).toHaveBeenCalledWith('en')

    // 主题:current=light,同值 no-op;system ↔ auto 仅此处映射
    ;(p.onSelectTheme as (v: string) => void)('light')
    expect(h.setThemeMode).not.toHaveBeenCalled()
    ;(p.onSelectTheme as (v: string) => void)('dark')
    expect(h.setThemeMode).toHaveBeenCalledWith('dark')
    expect(h.setTheme).toHaveBeenCalledWith('dark')
    ;(p.onSelectTheme as (v: string) => void)('system')
    expect(h.setThemeMode).toHaveBeenCalledWith('system')
    expect(h.setTheme).toHaveBeenLastCalledWith('auto')

    // 通知三键 → 后端字段
    ;(p.onToggleNotification as (k: string, v: boolean) => void)('push', false)
    expect(h.updateNotificationPreferences).toHaveBeenLastCalledWith({ pushEnabled: false })
    ;(p.onToggleNotification as (k: string, v: boolean) => void)('message', false)
    expect(h.updateNotificationPreferences).toHaveBeenLastCalledWith({ inAppEnabled: false })
    ;(p.onToggleNotification as (k: string, v: boolean) => void)('email', true)
    expect(h.updateNotificationPreferences).toHaveBeenLastCalledWith({ emailEnabled: true })

    ;(p.onAlert as (title: string) => void)('提示')
    expect(h.onToast).toHaveBeenCalledWith('提示')

    let confirmed = false
    ;(p.onConfirm as (t: string, m: string, ok: () => void) => void)('退出', '确认退出?', () => {
      confirmed = true
    })
    expect(h.showModal).toHaveBeenCalledTimes(1)
    expect(h.showModal.mock.calls[0]?.[0]).toMatchObject({ title: '退出', content: '确认退出?' })
    expect(confirmed).toBe(true)

    await expect(
      (p.onChangePassword as (a: string, b: string) => Promise<boolean>)('old', 'new'),
    ).resolves.toBe(true)
    expect(h.changePassword).toHaveBeenCalledWith({ oldPassword: 'old', newPassword: 'new' })
    h.changePassword.mockRejectedValueOnce(new Error('bad'))
    await expect(
      (p.onChangePassword as (a: string, b: string) => Promise<boolean>)('old', 'x'),
    ).resolves.toBe(false)

    await (p.onLogout as () => Promise<void>)()
    expect(h.logout).toHaveBeenCalledTimes(1)
    expect(h.clearAuth).toHaveBeenCalledTimes(1)
    expect(h.goToLogin).toHaveBeenCalledTimes(1)
  })

  it('⑤ 手机号脱敏:11 位中段掩码,不足 11 位回落未绑定', () => {
    expect(maskPhone('13800138000')).toBe('138****8000')
    expect(maskPhone(' 13800138000 ')).toBe('138****8000')
    expect(maskPhone('')).toBe('未绑定')
    expect(maskPhone(undefined)).toBe('未绑定')
    expect(maskPhone('1380013')).toBe('未绑定')
    // 阴性对照:原样回显 / 不截尾的写法过不了同一断言
    expect(maskPhone('13800138000')).not.toBe('13800138000')
    expect(() => expect('13800138000').toBe(maskPhone('13800138000'))).toThrow()
    expect(maskPhone('13800138000')).not.toBe('13800****000')
  })
})
