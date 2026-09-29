// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * web 端 legacy auth store 的登录态不变式与"第二份真相"兜底配对锁(G-370 / G-374 同一条线)。
 *
 * 判的三件事:
 * ① 显式登出后不得自动登回 —— 本 store 的 logout()/setToken(null) 必须落**持久**登出标记,
 *    且标记落在跨端共享层那一个 key 上(端内不得自立第二个名字)。
 * ② 带着有效凭据的冷启动/再登录不得被误伤 —— setToken(非空)/setTokenWithPrefs 必须抹掉标记。
 * ③ isAuthenticated 与 token 在场性在任何时刻不得分叉 —— 每个动作之后都按派生式(而不是存储式)断言。
 *
 * 最后一把是**配对形状锁**:`apps/web/src/stores/auth.ts` 此刻仍把 isAuthenticated 交进持久化
 * (台账登记在 packages/shared/tests/auth/persisted-auth-truth-shape-lock.test.ts,理由是该端权威
 * 凭据在 httpOnly cookie 里、JS 读不到,冷启动内存 token 恒 null,该键是 bootstrap 落定前的乐观提示)。
 * 这份提示**只因为它被持久登出标记 + bootstrap 兜住**才不构成"token 已清而 UI 认为已登录"。
 * 所以这里锁的不是"它还留着",而是"留着它的前提没被拆":谁把标记接线摘掉而仍持久化该键 ⇒ 判红。
 * 不得为了让本文件变绿去放宽判据,也不得顺手删掉那份乐观提示(那会把移动 App 首屏判成未登录)。
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { SESSION_LOGGED_OUT_STORAGE_KEY } from '@ihui/shared/auth/auto-login-policy'
import { useAuthStore } from '../auth'
import { __resetSessionLoggedOutMirrorForTest, isSessionLoggedOut } from '@/lib/session-marker'

// tests → stores → src → web → apps → 仓根:五跳,少一跳就会把 bootstrap 当成 store 来读
const ROOT = path.resolve(import.meta.dirname, '../../../../..')
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf-8')

const storeFile = 'apps/web/src/stores/auth.ts'
const bootstrapFile = 'apps/web/src/hooks/use-auth-bootstrap.ts'

const USER = { id: 'u1', nickname: 'tester', avatar: '' } as const

/** 派生不变式(不是"看存储里的布尔",而是"问 token 在不在") */
function expectNoDivergence(label: string): void {
  const s = useAuthStore.getState()
  expect(s.isAuthenticated, `${label}: isAuthenticated 与 token 在场性分叉`).toBe(s.token !== null)
}

beforeEach(() => {
  localStorage.clear()
  __resetSessionLoggedOutMirrorForTest()
  useAuthStore.setState({ token: null, refreshToken: null, expiresIn: null, user: null })
  useAuthStore.getState().setToken(null) // 走真动作而不是 setState,避免把派生位留成旧值
  localStorage.clear()
  __resetSessionLoggedOutMirrorForTest()
})

describe('夹具身份自证(路径读歪就等于锁空转)', () => {
  it('两个被锁的文件各自含有只有它自己才有的标识', () => {
    expect(read(storeFile)).toMatch(/export const useAuthStore = create<AuthState>/)
    expect(read(bootstrapFile)).toMatch(/export function useAuthBootstrap/)
  })
})

describe('③ isAuthenticated 恒为 token 的派生投影(任何动作之后都不得分叉)', () => {
  it('初始:无 token ⇒ false', () => {
    expectNoDivergence('初始')
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('setToken(有效凭据) ⇒ true(冷启动带有效 token 必须仍然算已登录)', () => {
    useAuthStore.getState().setToken('access-token-abc')
    expectNoDivergence('setToken(t)')
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })

  it('setToken(null) ⇒ false(凭据被清与登出同处置)', () => {
    useAuthStore.getState().setToken('access-token-abc')
    useAuthStore.getState().setToken(null)
    expectNoDivergence('setToken(null)')
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('setTokenWithPrefs(登录页勾了自动登录那条链) ⇒ true,且带 pair 形态也一致', () => {
    useAuthStore.getState().setTokenWithPrefs('t1', 'r1', true)
    expectNoDivergence('setTokenWithPrefs(string rt)')
    useAuthStore.getState().setTokenWithPrefs('t2', { accessToken: 't2', refreshToken: 'r2', expiresIn: 3600 }, false)
    expectNoDivergence('setTokenWithPrefs(TokenPair)')
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })

  it('setUser 不得成为独立开关:无 token 时写 user 仍是未登录', () => {
    useAuthStore.getState().setUser(USER)
    expectNoDivergence('setUser(无 token)')
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    useAuthStore.getState().setToken('t')
    useAuthStore.getState().setUser(null)
    expectNoDivergence('setUser(null) 有 token')
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })

  it('hydrateRefreshToken 不得把登录态翻成 true(它只补 refreshToken,不发凭据)', () => {
    useAuthStore.getState().hydrateRefreshToken()
    expectNoDivergence('hydrateRefreshToken')
  })

  it('logout ⇒ 凭据清空且登录态跟着 false', () => {
    useAuthStore.getState().setToken('t')
    useAuthStore.getState().setUser(USER)
    useAuthStore.getState().logout()
    expectNoDivergence('logout')
    expect(useAuthStore.getState().token).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
  })
})

describe('①② web 侧持久登出标记与凭据同源同步(G-370 在 web 的落点)', () => {
  it('① logout() 在共享层那一个 key 上落标记 ⇒ 冷启动判"已登出"', () => {
    useAuthStore.getState().setToken('t')
    useAuthStore.getState().logout()
    expect(localStorage.getItem(SESSION_LOGGED_OUT_STORAGE_KEY)).not.toBeNull()
    expect(isSessionLoggedOut()).toBe(true)
  })

  it('① 凭据被清(setToken(null))与 logout 同处置', () => {
    useAuthStore.getState().setToken('t')
    useAuthStore.getState().setToken(null)
    expect(isSessionLoggedOut()).toBe(true)
  })

  it('② 反向对照:再登录写入非空凭据 ⇒ 标记被抹,正常自动恢复不被误伤', () => {
    useAuthStore.getState().logout()
    expect(isSessionLoggedOut()).toBe(true)
    useAuthStore.getState().setToken('fresh-token')
    expect(localStorage.getItem(SESSION_LOGGED_OUT_STORAGE_KEY)).toBeNull()
    expect(isSessionLoggedOut()).toBe(false)
  })

  it('② setTokenWithPrefs 同样抹标记(登录页那条链不得留下"刚登出"的假状态)', () => {
    useAuthStore.getState().logout()
    useAuthStore.getState().setTokenWithPrefs('t', 'r', true)
    expect(isSessionLoggedOut()).toBe(false)
  })
})

describe('配对形状锁:那份乐观提示必须一直被登出标记 + bootstrap 一起兜住', () => {
  it('stores/auth.ts 必须继续接上标记的两个出口(摘掉它 = G-370 那一型在 web 复发)', () => {
    const src = read(storeFile)
    // 该键此刻仍被持久化 ⇒ 它之所以还不是"第二份真相",全靠下面三条界住它。
    // 任何一条被摘,存储里那份 true 就会脱离登出语义而长期存活(UI 认为已登录、请求全 401)。
    expect(
      src,
      '持久化形态已变(partialize 不再携 isAuthenticated)⇒ 同步删除 shape-lock 台账行并复核本判据',
    ).toMatch(/\bisAuthenticated:\s*s\.isAuthenticated/)
    expect(src, '登出/清凭据必须落持久登出标记').toMatch(/markSessionLoggedOut/)
    expect(src, '写入有效凭据必须抹掉持久登出标记').toMatch(/clearSessionLoggedOutMarker/)
  })

  it('bootstrap 的"已登出"那一支必须真的清掉幽灵登录态,而不是只停在未 ready', () => {
    const src = read(bootstrapFile)
    const gate = src.indexOf('canSilentlyReLogin({ sessionLoggedOut: isSessionLoggedOut })')
    expect(gate, 'bootstrap 不再问跨端判据 ⇒ web 冷启动这一径路重新放开').toBeGreaterThan(-1)
    const branch = src.slice(gate, gate + 400)
    expect(
      branch,
      '标记在场那一支必须 logout(清 isAuthenticated),否则存储里的 true 继续替用户做决定',
    ).toMatch(/logout\(\)/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
