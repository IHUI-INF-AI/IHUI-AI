// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 冷启动抢跑门(G-933 小程序腿)的镜像用例:钉 `src/hooks/use-auth-ready-gate.ts` 的四臂语义
// + 就绪位置位落点唯一。判的是"门控出口本身有没有牙",为后续 50+ 枚页面的批量派单定形状。
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createElement } from 'react'
import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))

const { taroStorage } = vi.hoisted(() => ({ taroStorage: {} as Record<string, unknown> }))

// 本端存储面:Taro.storage 的同步三件套用内存对象替身(真机才是盘),
// 而 isLoggedIn() 的判据本体(@/utils/auth 的 tokenStore)照原样跑,不在测试里复刻。
vi.mock('@tarojs/taro', () => ({
  default: {
    getEnv: () => 'WEAPP',
    ENV_TYPE: { WEB: 'WEB', WEAPP: 'WEAPP', ALIPAY: 'ALIPAY', QQ: 'QQ', SWAN: 'SWAN', TT: 'TT' },
    showToast: vi.fn(),
    request: vi.fn(),
  },
  getStorageSync: (key: string) => taroStorage[key] ?? '',
  setStorageSync: (key: string, value: unknown) => {
    taroStorage[key] = value
  },
  removeStorageSync: (key: string) => {
    delete taroStorage[key]
  },
  reLaunch: vi.fn(),
  getCurrentPages: vi.fn(() => []),
}))

// store 模块顶层会 import 取票链与 api;本用例既不驱动那条链(它由
// src/stores/tests/auth-cold-start-ready.test.ts 负责),也不碰网络 ⇒ 只把这些旁支替身掉。
vi.mock('@/api', () => ({
  getProfile: vi.fn(async () => null),
  loginByWechat: vi.fn(async () => null),
  loginByAlipay: vi.fn(async () => null),
}))
vi.mock('@/utils/miniapp-login', () => ({
  miniAppLogin: vi.fn(async () => null),
  isMiniAppEnvironment: vi.fn(() => true),
}))
vi.mock('@/utils/wechat-login', () => ({ wechatLogin: vi.fn(async () => ({ success: true })) }))
vi.mock('@/utils/sso', () => ({ exchangeSsoCode: vi.fn(async () => null) }))

import { useUserStore } from '@/stores/user'
import { clearAuth, setToken } from '@/utils/auth'
import { useAuthReadyGate } from '@/hooks/use-auth-ready-gate'
import type { AuthReadyGate } from '@/hooks/use-auth-ready-gate'

/** 探针:钩子只能在一个真实 React 渲染里跑;渲染结果整份收下,便于断言 ready/allow 与取 waitUntilReady。 */
let probe: AuthReadyGate | null = null

function GateProbe(): ReactElement | null {
  probe = useAuthReadyGate()
  return null
}

function renderGate(): AuthReadyGate {
  probe = null
  renderToStaticMarkup(createElement(GateProbe, null))
  if (!probe) throw new Error('探针未跑到钩子(renderToStaticMarkup 没有执行 GateProbe 函数体)')
  return probe
}

beforeEach(() => {
  Object.keys(taroStorage).forEach((k) => delete taroStorage[k])
  probe = null
  // store 是模块级单例,状态跨用例存活:显式复位,否则后一条只是踩在前一条的成果上冒绿。
  useUserStore.setState({ token: '', refreshToken: '', user: null, authReady: false })
  clearAuth()
})

describe('① 未 ready:抢跑窗口里 cb 一次都不许执行', () => {
  it('allow===false 且 waitUntilReady 的 cb 不执行(执行了就是它要根治的那个抢跑)', () => {
    setToken('tk-hold') // 手里有票也不许在判定落定前放行
    const gate = renderGate()
    expect(gate.ready).toBe(false)
    expect(gate.allow).toBe(false)

    const calls: string[] = []
    const cancel = gate.waitUntilReady(() => calls.push('cb'))
    expect(typeof cancel).toBe('function')
    expect(calls).toEqual([])
  })

  it('未 ready 期间落定前的其它 set 也不触发 cb', () => {
    const gate = renderGate()
    const calls: string[] = []
    gate.waitUntilReady(() => calls.push('cb'))

    useUserStore.setState({ token: 'tk-churn' })
    useUserStore.setState({ refreshToken: 'rt-churn' })
    expect(calls).toEqual([])
  })
})

describe('② ready 落定:cb 恰好执行 1 次(不是"执行过")', () => {
  it('落定时执行 1 次,后续任意 set 不再执行第二遍(证明订阅已注销)', () => {
    const gate = renderGate()
    const calls: string[] = []
    gate.waitUntilReady(() => calls.push('cb'))

    useUserStore.getState().markAuthReady()
    expect(calls).toEqual(['cb'])

    useUserStore.getState().markAuthReady()
    useUserStore.setState({ token: 'tk-after' })
    expect(calls.length).toBe(1)
  })

  it('同一枚 cb 重复注册只执行 1 次(useLoad 与 useDidShow 挂同一个函数的形状)', () => {
    const gate = renderGate()
    const calls: string[] = []
    const onReady = (): void => {
      calls.push('cb')
    }
    const cancelA = gate.waitUntilReady(onReady)
    const cancelB = gate.waitUntilReady(onReady)
    expect(cancelA).toBe(cancelB) // 复用同一条订阅,不是第二条
    expect(calls).toEqual([])

    useUserStore.getState().markAuthReady()
    expect(calls.length).toBe(1)
  })

  it('已经 ready 时调用 ⇒ 立刻执行 1 次并返回可调用取消函数', () => {
    useUserStore.getState().markAuthReady()
    const gate = renderGate()
    const calls: string[] = []
    const cancel = gate.waitUntilReady(() => calls.push('cb'))
    expect(calls.length).toBe(1)
    expect(() => cancel()).not.toThrow()
  })
})

describe('③ allow = ready && isLoggedIn()(两维各造一次)', () => {
  it('ready 且已登录 ⇒ allow===true', () => {
    setToken('tk-live')
    useUserStore.getState().markAuthReady()
    const gate = renderGate()
    expect(gate.ready).toBe(true)
    expect(gate.allow).toBe(true)
  })

  it('ready 但未登录 ⇒ allow===false,而 cb 仍然执行 1 次(落定即放行,页面得能进未登录空态)', () => {
    clearAuth()
    const gate = renderGate()
    const calls: string[] = []
    gate.waitUntilReady(() => calls.push('cb')) // 此刻未 ready:不许执行
    expect(calls).toEqual([])

    useUserStore.getState().markAuthReady() // 落定,但仍未登录
    expect(calls.length).toBe(1)

    const rerendered = renderGate()
    expect(rerendered.ready).toBe(true)
    expect(rerendered.allow).toBe(false)
  })
})

describe('④ 反向锁:取消函数必须真的把订阅摘掉', () => {
  it('cancel 之后再 ready ⇒ cb 执行次数仍为 0(不靠顺序侥幸)', () => {
    const gate = renderGate()
    const calls: string[] = []
    const cancel = gate.waitUntilReady(() => calls.push('cb'))
    cancel()
    expect(calls).toEqual([])

    useUserStore.getState().markAuthReady()
    expect(calls).toEqual([])

    // 取消后重复调用取消函数不得有副作用
    cancel()
    expect(calls).toEqual([])
  })

  it('cancel 之后同一枚 cb 可重新注册并在下一个落定点执行(注销是真的、不是永久拉黑)', () => {
    const gate = renderGate()
    const calls: string[] = []
    const onReady = (): void => {
      calls.push('cb')
    }
    gate.waitUntilReady(onReady)()
    useUserStore.getState().markAuthReady()
    expect(calls).toEqual([])

    const settledGate = renderGate()
    settledGate.waitUntilReady(onReady)
    expect(calls.length).toBe(1) // 已 ready ⇒ 立刻补跑
  })
})

// ============ 落点唯一性锁 ============

/** 递归列出本端 src 下的生产源码(排除用例与测试目录),供落点计数用。 */
function listProductionSources(root: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = join(root, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'tests' || entry.name === '__tests__' || entry.name === 'node_modules')
        continue
      found.push(...listProductionSources(full))
      continue
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue
    if (/\.(test|spec)\.(ts|tsx)$/.test(entry.name)) continue
    found.push(full)
  }
  return found
}

/**
 * 数一个文件里的**置位调用**次数(只认 `.markAuthReady()` 这个调用形态)。
 * 先削掉行内 `//` 之后的内容:整行注释掉的置位必须算 0,否则这道锁把 app.tsx 那一行注释掉
 * 也照样冒绿(兄弟用例的阳性对照实测过这一型)。块注释里的散文不带这个调用形态,天然不计。
 */
function countSetCalls(text: string): number {
  let n = 0
  for (const line of text.split('\n')) {
    const cut = line.indexOf('//')
    n += ((cut === -1 ? line : line.slice(0, cut)).match(/\.markAuthReady\s*\(\s*\)/g) ?? []).length
  }
  return n
}

/** 数"绕过 action 的直写"(把这一位写成 true 的字面量)——合法点只有 store 里 action 的函数体。 */
function countTrueWrites(text: string): number {
  let n = 0
  for (const line of text.split('\n')) {
    const cut = line.indexOf('//')
    n += ((cut === -1 ? line : line.slice(0, cut)).match(/authReady\s*:\s*true/g) ?? []).length
  }
  return n
}

describe('⑤ 落点唯一:就绪位的置位点仍只有 app.tsx 一处,本钩子不自己点亮', () => {
  const srcRoot = resolve(HERE, '..', '..')
  const hookFile = resolve(HERE, '..', 'use-auth-ready-gate.ts')

  it('计数器自己有牙(三对照:活的一行算 1、注释掉的那行算 0、声明行算 0)', () => {
    expect(countSetCalls('useUserStore.getState().markAuthReady()\n')).toBe(1)
    expect(countSetCalls('  // useUserStore.getState().markAuthReady()\n')).toBe(0)
    expect(countSetCalls('  markAuthReady: () => void\n')).toBe(0)
    expect(countTrueWrites('  set({ authReady: true })\n')).toBe(1)
    expect(countTrueWrites('  authReady: false,\n')).toBe(0)
  })

  it('取材非空(src 确实扫到了源码,否则下面几条是空转冒绿)', () => {
    expect(listProductionSources(srcRoot).length).toBeGreaterThan(50)
    expect(listProductionSources(srcRoot)).toContain(hookFile)
  })

  it('置位调用总次数恰好 1,且落在 app.tsx', () => {
    const callSites = listProductionSources(srcRoot)
      .map((file) => ({ file, hits: countSetCalls(readFileSync(file, 'utf-8')) }))
      .filter((entry) => entry.hits > 0)

    expect(callSites.map((entry) => `${basename(entry.file)}:${entry.hits}`)).toEqual(['app.tsx:1'])
    expect(callSites.reduce((n, entry) => n + entry.hits, 0)).toBe(1)
  })

  it('直写 true 只发生在 store 的 action 体内(钩子与各页面都不许绕过 action)', () => {
    const writeSites = listProductionSources(srcRoot)
      .map((file) => ({ file, hits: countTrueWrites(readFileSync(file, 'utf-8')) }))
      .filter((entry) => entry.hits > 0)

    expect(writeSites.map((entry) => basename(entry.file))).toEqual(['user.ts'])
  })

  it('本钩子文件既不含置位调用也不含直写(它只读这一位)', () => {
    const text = readFileSync(hookFile, 'utf-8')
    expect(countSetCalls(text)).toBe(0)
    expect(countTrueWrites(text)).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
