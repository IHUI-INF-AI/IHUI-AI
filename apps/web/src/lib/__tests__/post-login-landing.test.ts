// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import { resolvePostLoginLanding, ADMIN_POST_LOGIN_LANDING } from '../post-login-landing'

describe('resolvePostLoginLanding', () => {
  it('管理员 + 无显式目标 → 落到监控大屏', () => {
    expect(resolvePostLoginLanding({ roleId: 1 })).toBe(ADMIN_POST_LOGIN_LANDING)
  })

  it('非 role_id=1 的角色(含 manager=2、任意 roleId>1)一律不算管理员(DBG-23 收紧口径)', () => {
    // 与 packages/shared/src/auth/auth-utils.ts isAdmin 一致:本仓系统管理员仅 role_id=1。
    // 旧期望 roleId>=1 视为管理员,会把 manager(roleId=2) 引到 /admin 监控大屏 ⇒ 越权面。
    expect(resolvePostLoginLanding({ roleId: 9 })).toBeNull()
    expect(resolvePostLoginLanding({ roleId: 2 })).toBeNull()
  })

  it('role 字符串形态的管理员同样认(与 isAdmin 同口径)', () => {
    expect(resolvePostLoginLanding({ role: 'admin' })).toBe(ADMIN_POST_LOGIN_LANDING)
    expect(resolvePostLoginLanding({ role: 'Administrator' })).toBe(ADMIN_POST_LOGIN_LANDING)
  })

  it('普通用户 / 身份缺失 + 无显式目标 → null(维持留在当前页)', () => {
    expect(resolvePostLoginLanding({ roleId: 0 })).toBeNull()
    expect(resolvePostLoginLanding({ role: 'user' })).toBeNull()
    expect(resolvePostLoginLanding({})).toBeNull()
    expect(resolvePostLoginLanding(null)).toBeNull()
    expect(resolvePostLoginLanding(undefined)).toBeNull()
  })

  it('有显式目标 ⇒ 原样返回,不切屏(登录守卫带回的路径不被旁路)', () => {
    expect(resolvePostLoginLanding({ roleId: 1 }, '/chat/history')).toBe('/chat/history')
    expect(resolvePostLoginLanding({ roleId: 0 }, '/chat/history')).toBe('/chat/history')
  })

  it('空字符串显式目标按"无目标"处理(与 `if (!redirectUrl)` 语义一致)', () => {
    expect(resolvePostLoginLanding({ roleId: 1 }, '')).toBe(ADMIN_POST_LOGIN_LANDING)
    expect(resolvePostLoginLanding({ roleId: 0 }, '')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
