// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment happy-dom

/**
 * 设置页「企业应用凭据」入口接线测试(2026-11-24 立)。
 *
 * 纯谓词分支由 tenant-apps-visibility.test.ts 钉住;本档证明谓词**真的接在入口卡片上**
 * (写反了条件,函数对也会把入口泄漏给无权用户)。断言界面事实:入口 Link 上带
 * `data-testid="tenant-apps-entry"`,按身份出现 / 隐藏。
 *
 * 被页面引用的其余子卡片整体替身,本档只关注这一张入口卡片的显隐。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

const authUserRef = vi.hoisted(() => ({ current: { roleId: 0 } as { roleId?: number } }))
const rolesRef = vi.hoisted(() => ({ current: [] as string[] }))
const loadedRef = vi.hoisted(() => ({ current: true }))

vi.mock('@/stores/auth', () => ({
  useAuthStore: (sel: (s: { user?: { roleId?: number } }) => unknown) =>
    sel({ user: authUserRef.current }),
}))
vi.mock('@/hooks/use-my-tenant-roles', () => ({
  useMyTenantRoles: () => ({ roles: rolesRef.current, loaded: loadedRef.current }),
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: (props: Record<string, unknown> & { children?: React.ReactNode }) => (
    <a {...props}>{props.children}</a>
  ),
}))
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'zh',
}))
vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: vi.fn() }),
}))
vi.mock('lucide-react', () => {
  const base: Record<PropertyKey, unknown> = { __esModule: true }
  return new Proxy(base, {
    get(target, prop) {
      if (prop in target) return target[prop]
      if (typeof prop === 'symbol' || prop === 'then' || prop === 'default') return undefined
      return () => null
    },
    has() {
      return true
    },
  })
})
vi.mock('@ihui/ui-react', () => {
  const Box = ({ children }: { children?: React.ReactNode }) => <>{children}</>
  return { Tabs: Box, TabsList: Box, TabsTrigger: Box, TabsContent: Box }
})
vi.mock('@/components/feedback', () => ({ Alert: () => null }))
vi.mock('@/components/common', () => ({ BackButton: () => null }))
vi.mock('@/components/settings', () => ({
  DeviceManager: () => null,
  IpWhitelist: () => null,
  LoginHistory: () => null,
  SecurityScore: () => null,
  SessionManager: () => null,
  TwoFactorAuth: () => null,
  ThemeBackupSync: () => null,
}))
vi.mock('../app/(main)/settings/LanguageCard', () => ({ LanguageCard: () => null }))
vi.mock('../app/(main)/settings/SidebarCard', () => ({ SidebarCard: () => null }))
vi.mock('../app/(main)/settings/MiniappQrCard', () => ({ MiniappQrCard: () => null }))
vi.mock('../app/(main)/settings/DesktopSettingsCard', () => ({
  DesktopSettingsCard: () => null,
}))

import SettingsPage from '../app/(main)/settings/page'

function renderSettings() {
  return render(<SettingsPage />)
}

beforeEach(() => {
  cleanup()
  authUserRef.current = { roleId: 0 }
  rolesRef.current = []
  loadedRef.current = true
})

describe('设置页「企业应用凭据」入口显隐', () => {
  it('平台管理员(roleId >= 1)可见入口', () => {
    authUserRef.current = { roleId: 1 }
    renderSettings()
    expect(screen.getByTestId('tenant-apps-entry')).toBeTruthy()
  })

  it('普通用户仅为 member → 入口隐藏', () => {
    authUserRef.current = { roleId: 0 }
    rolesRef.current = ['member']
    renderSettings()
    expect(screen.queryByTestId('tenant-apps-entry')).toBeNull()
  })

  it('非平台管理员,但在某租户担任 admin → 入口可见', () => {
    authUserRef.current = { roleId: 0 }
    rolesRef.current = ['admin']
    renderSettings()
    expect(screen.getByTestId('tenant-apps-entry')).toBeTruthy()
  })

  it('非平台管理员且租户角色尚未加载完成 → 保守隐藏入口', () => {
    authUserRef.current = { roleId: 0 }
    loadedRef.current = false
    rolesRef.current = undefined as unknown as string[]
    renderSettings()
    expect(screen.queryByTestId('tenant-apps-entry')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
