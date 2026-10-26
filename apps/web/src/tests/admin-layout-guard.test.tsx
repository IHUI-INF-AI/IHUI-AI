// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 管理员守卫的「角色还没查到」那一格(2026-10-21 立)。
//
// 为什么必须有这一层:守卫原先写 `(userRoleId ?? 0) < 1` ⇒ 「资料没到」被折成「角色不够」,
// 真管理员被 replace 到 /forbidden 且不会自己回来。bootstrap 的顺序是先 setToken
// (isAuthenticated=true)再拉 /auth/me 才 setUser(roleId 随资料一起到),中间那一格就是 undefined。
// 现读复现:同一份登录态下 6 次冷加载 3 次落在 /forbidden(纯时间差)。
// 这种竞态只有"渲染真组件 + 推进真时序"才看得见 —— 纯函数测试两侧各自都会绿。
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const replace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn(), prefetch: vi.fn() }),
  // admin 布局后接入 usePathname(redirect 拼回跳地址),mock 缺导出 ⇒ 布局 import 期炸(2026-10-24)
  usePathname: () => '/admin',
  useSearchParams: () => new URLSearchParams(),
}))

import AdminLayout from '../../app/(main)/admin/layout'
import { useAuthStore } from '@/stores/auth'
import {
  markSessionLoggedOut,
  __resetSessionEstablishedMirrorForTest,
  __resetSessionLoggedOutMirrorForTest,
} from '@/lib/session-marker'

const ADMIN = { id: 'u1', nickname: 'admin', roleId: 1 } as const

async function mount() {
  render(
    <AdminLayout>
      <div>受守卫的后台内容</div>
    </AdminLayout>,
  )
  // 等 hydration effect 落地(hasHydrated 为真后判定分支才会开始跑)
  await act(async () => {
    await Promise.resolve()
  })
}

describe('admin layout 守卫:角色未知 ≠ 角色不够', () => {
  beforeEach(async () => {
    vi.useFakeTimers()
    replace.mockClear()
    localStorage.clear()
    // session-marker 有进程内镜像,不清会把上一个用例的判定带进本用例
    __resetSessionEstablishedMirrorForTest()
    __resetSessionLoggedOutMirrorForTest()
    useAuthStore.setState({ isAuthenticated: false, user: null, token: null })
    await vi.waitFor(() => useAuthStore.persist.hasHydrated())
    vi.useRealTimers()
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('A 资料晚于"那一帧"才到 ⇒ 不许弹(旧写法在这一格就会弹)', async () => {
    vi.useFakeTimers()
    useAuthStore.setState({ isAuthenticated: true, token: 't', user: null })
    await mount()
    expect(screen.queryByText('受守卫的后台内容')).toBeNull() // 还没判完,挂在校验占位上
    // 关键的一拍:原写法把导航排在 requestAnimationFrame 里,而 /auth/me 实测 ~870ms 才回 ——
    // 远晚于那一帧。上一版这格把 setUser 排在推进时钟**之前**,effect 重跑的 cleanup 顺手
    // cancelAnimationFrame 把导航取消了,于是旧代码也"过"这一例 = 假自证。必须先过帧,再给资料。
    await act(async () => {
      vi.advanceTimersByTime(100)
    })
    expect(
      replace,
      `资料还没到就弹了 ⇒ 又把"未知"折成 0(实寄 calls=${JSON.stringify(replace.mock.calls)})`,
    ).not.toHaveBeenCalled()
    act(() => {
      useAuthStore.setState({ user: ADMIN })
    })
    await act(async () => {
      vi.advanceTimersByTime(20_000)
    })
    expect(replace).not.toHaveBeenCalled()
    expect(screen.getByText('受守卫的后台内容')).toBeTruthy()
  })

  it('B 资料始终不到 ⇒ 到点必须有终态(不许永远挂在"正在校验"上)', async () => {
    vi.useFakeTimers()
    useAuthStore.setState({ isAuthenticated: true, token: 't', user: null })
    await mount()
    await act(async () => {
      vi.advanceTimersByTime(20_000)
    })
    expect(replace).toHaveBeenCalledWith('/forbidden')
  })

  it('C 真·非管理员(roleId=0)照旧弹,本修复没有把门放宽', async () => {
    vi.useFakeTimers()
    useAuthStore.setState({ isAuthenticated: true, token: 't', user: { ...ADMIN, roleId: 0 } })
    await mount()
    await act(async () => {
      vi.advanceTimersByTime(1_000)
    })
    expect(replace).toHaveBeenCalledWith('/forbidden')
  })

  it('D 未登录且未显式登出 ⇒ 先宽限、到点仍弹登录页并带上 redirect', async () => {
    vi.useFakeTimers()
    useAuthStore.setState({ isAuthenticated: false, token: null, user: null })
    await mount()

    // 宽限内不弹:服务端守卫只在 refresh cookie 在场时才放行到这里,
    // 而 isAuthenticated 只是 persist 标志位,一次被动失效就能把它落成 false ——
    // 立即弹会把仍有 30 天凭据的用户画成"被踢出"(2026-10-26)。
    await act(async () => {
      vi.advanceTimersByTime(1_000)
    })
    expect(replace).not.toHaveBeenCalled()

    // 到点仍无登录态 ⇒ 必须有终态,不许永远挂在"正在校验"上
    await act(async () => {
      vi.advanceTimersByTime(5_000)
    })
    expect(replace).toHaveBeenCalledTimes(1)
    expect(String(replace.mock.calls[0]?.[0])).toMatch(/^\/sso\/login\?redirect=/)
  })

  it('E 宽限期内把登录态接回来 ⇒ 不弹,照常放行', async () => {
    vi.useFakeTimers()
    useAuthStore.setState({ isAuthenticated: false, token: null, user: null })
    await mount()

    await act(async () => {
      vi.advanceTimersByTime(1_000)
    })
    expect(replace).not.toHaveBeenCalled()

    act(() => {
      useAuthStore.setState({ isAuthenticated: true, token: 't', user: ADMIN })
    })
    await act(async () => {
      vi.advanceTimersByTime(20_000)
    })
    expect(replace).not.toHaveBeenCalled()
    expect(screen.getByText('受守卫的后台内容')).toBeTruthy()
  })

  it('G 用户已显式登出 ⇒ 立即弹,不给宽限(不得把退出的人静默登回去)', async () => {
    vi.useFakeTimers()
    markSessionLoggedOut()
    useAuthStore.setState({ isAuthenticated: false, token: null, user: null })
    await mount()

    await act(async () => {
      vi.advanceTimersByTime(100)
    })
    expect(replace).toHaveBeenCalledTimes(1)
    expect(String(replace.mock.calls[0]?.[0])).toMatch(/^\/sso\/login\?redirect=/)
  })

  it('形状锁:守卫不得再把"取不到角色"折成 0 参与比较(§0.3)', async () => {
    // 走 fileURLToPath(import.meta.url) 而不是 import.meta.dirname:后者在 TS 类型里是
    // string | undefined,而 vitest 下 import.meta.url 是 http: URL —— 两者都不能直接喂 readFileSync
    const src = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '../../app/(main)/admin/layout.tsx'),
      'utf8',
    )
    const guard = src.slice(src.indexOf('已登录但非管理员'), src.indexOf('setChecked(true)'))
    expect(guard.length > 200, '切片没抓到守卫那一段 ⇒ 这把锁自己瞎了').toBe(true)
    // 取"完整 if 语句"而不是片段:注释里引用过旧写法 `(userRoleId ?? 0) < 1`,按片段比位置会被注释骗到
    const unknownBranch = guard.indexOf('if (userRoleId === undefined || userRoleId === null) {')
    const roleBranch = guard.indexOf('if ((userRoleId ?? 0) < ADMIN_ROLE_THRESHOLD)')
    expect(
      unknownBranch,
      '缺「角色未知」那一支 ⇒ 「取不到」又会被折成 0 判成无权限(§0.3)',
    ).toBeGreaterThanOrEqual(0)
    expect(roleBranch, '缺「角色不够」那一支 ⇒ 真非管理员被放进来').toBeGreaterThanOrEqual(0)
    expect(unknownBranch).toBeLessThan(roleBranch)
    expect(guard).toContain('clearTimeout(timer)') // 等待必须有终态,也不许在资料到位后还留着定时器
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
