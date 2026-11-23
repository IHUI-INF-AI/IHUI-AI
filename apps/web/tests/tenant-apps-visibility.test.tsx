// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment happy-dom

/**
 * 「企业应用凭据」入口可见性门控(2026-11-24 立)。
 *
 * 钉两类判据,与后端 `guardTenantAccess(tenantId, 'admin')` 放行条件对齐:
 *  ① 纯谓词 `canSeeTenantAdminEntry` / `isTenantAdminRole`:平台管理员旁路,
 *     否则须在任一租户担任 owner/admin;角色列表未加载完成时保守判不可见。
 *  ② hook `useMyTenantRoles`:从 GET /api/tenants/ 取当前用户的租户角色列表;
 *     失败/空列表回空数组,未登录不发请求。
 *
 * 鉴权层判据(能不能看)与用户自选降噪层(advancedOnly)严格分开,本档不碰后者。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as React from 'react'

const fetchApiMock = vi.hoisted(() => vi.fn())
const gateState = vi.hoisted(() => ({ allow: true, ready: true }))

vi.mock('@/lib/api', () => ({ fetchApi: fetchApiMock }))
vi.mock('@/hooks/use-auth-gate', () => ({
  useAuthGate: () => ({ ready: gateState.ready, allow: gateState.allow }),
}))

import { canSeeTenantAdminEntry, isTenantAdminRole } from '@/components/sidebar/use-nav-visibility'
import { useMyTenantRoles } from '@/hooks/use-my-tenant-roles'

function wrapHook() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return renderHook(() => useMyTenantRoles(), { wrapper })
}

beforeEach(() => {
  fetchApiMock.mockReset()
  gateState.allow = true
  gateState.ready = true
})

describe('isTenantAdminRole — 租户管理员档位判定', () => {
  it('owner / admin 视为租户管理员', () => {
    expect(isTenantAdminRole('owner')).toBe(true)
    expect(isTenantAdminRole('admin')).toBe(true)
  })

  it('member / 空值 / 未知角色一律按非管理员处理', () => {
    expect(isTenantAdminRole('member')).toBe(false)
    expect(isTenantAdminRole(undefined)).toBe(false)
    expect(isTenantAdminRole(null)).toBe(false)
    expect(isTenantAdminRole('stranger')).toBe(false)
  })
})

describe('canSeeTenantAdminEntry — 入口可见性谓词', () => {
  it('平台管理员旁路放行,与角色列表无关', () => {
    expect(canSeeTenantAdminEntry({ isSystemAdmin: true, tenantRoles: [] })).toBe(true)
    expect(canSeeTenantAdminEntry({ isSystemAdmin: true, tenantRoles: undefined })).toBe(true)
  })

  it('非平台管理员:任一租户 owner/admin 即可见', () => {
    expect(canSeeTenantAdminEntry({ isSystemAdmin: false, tenantRoles: ['admin'] })).toBe(true)
    expect(canSeeTenantAdminEntry({ isSystemAdmin: false, tenantRoles: ['owner'] })).toBe(true)
    expect(canSeeTenantAdminEntry({ isSystemAdmin: false, tenantRoles: ['member', 'admin'] })).toBe(
      true,
    )
  })

  it('非平台管理员:仅 member / 空列表 / 未加载 → 不可见(保守收敛)', () => {
    expect(canSeeTenantAdminEntry({ isSystemAdmin: false, tenantRoles: ['member'] })).toBe(false)
    expect(canSeeTenantAdminEntry({ isSystemAdmin: false, tenantRoles: [] })).toBe(false)
    expect(canSeeTenantAdminEntry({ isSystemAdmin: false, tenantRoles: undefined })).toBe(false)
  })
})

describe('useMyTenantRoles — 我的租户角色列表', () => {
  it('成功返回 → 透出各租户角色,标记已加载', async () => {
    fetchApiMock.mockResolvedValue({
      success: true,
      data: [
        { id: 't1', slug: 'acme', role: 'owner' },
        { id: 't2', slug: 'other', role: 'member' },
      ],
    })

    const { result } = wrapHook()
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.roles).toEqual(['owner', 'member'])
  })

  it('拉取失败 → 空角色列表,仍标记已加载(按非管理员收敛)', async () => {
    fetchApiMock.mockResolvedValue({ success: false, error: '读取租户列表失败', status: 403 })

    const { result } = wrapHook()
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.roles).toEqual([])
  })

  it('未登录 / 会话未就绪:不发请求,loaded 为 false(入口保守隐藏)', () => {
    gateState.allow = false
    const { result } = wrapHook()
    expect(fetchApiMock).not.toHaveBeenCalled()
    expect(result.current.loaded).toBe(false)
    expect(result.current.roles).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
