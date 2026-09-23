// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  isRemoteWindow,
  isTauriRuntime,
  resolveApiBaseUrl,
  resolveStreamApiBaseUrl,
  resolveWsApiBaseUrl,
} from './api-base-url'

/**
 * 后端寻址契约测试(2026-09-21 立)。
 *
 * 锁定真实故障:桌面端是薄壳 —— 主窗口加载线上 https://aizhs.top/agents
 * (apps/desktop/src-tauri/tauri.conf.json windows[0].url),而线上 web 构建
 * 刻意把 NEXT_PUBLIC_API_BASE_URL 置空(scripts/build-next-prod.ps1)。
 * 旧逻辑 `'__TAURI_INTERNALS__' in window ? env || 'http://127.0.0.1:8802' : ...`
 * 把"Tauri 运行时"等同于"本地联调",空 env 被 `||` 吞掉 → 桌面端全部 REST/SSE/WS
 * 打到用户本机 8802:无本地后端=连接被拒(登录页报无法连接后端);有 dev 后端=
 * 打到本地库,生产账号登录必失败。
 *
 * 本文件的第 1 组用例即该故障的回归锁:桌面端 + 远端 origin **必须**同源。
 */

type WindowWithLooseLocation = Omit<Window, 'location'> & {
  location: Location | Record<string, unknown>
}

/** 覆盖 window.location(只提供被测函数读取的字段,不依赖测试环境的 URL 实现) */
function setWindowLocation(url: string): void {
  const u = new URL(url)
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: {
      protocol: u.protocol,
      hostname: u.hostname,
      port: u.port,
      origin: u.origin,
      href: u.href,
    },
  })
}

/** 模拟 Tauri 运行时标识(Tauri 2 在 withGlobalTauri=false 下只注入 __TAURI_INTERNALS__) */
function setTauriRuntime(on: boolean): void {
  if (on) {
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      writable: true,
      value: {},
    })
    return
  }
  delete (window as unknown as WindowWithLooseLocation as Record<string, unknown>)
    .__TAURI_INTERNALS__
}

/** 对齐线上构建:build-next-prod.ps1 把 NEXT_PUBLIC_API_BASE_URL 显式置空 */
function clearBakedEnv(): void {
  vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', '')
  vi.stubEnv('NEXT_PUBLIC_STREAM_API_BASE_URL', '')
  vi.stubEnv('NEXT_PUBLIC_WS_BASE_URL', '')
}

afterEach(() => {
  vi.unstubAllEnvs()
  setTauriRuntime(false)
  setWindowLocation('http://localhost/')
})

describe('桌面端薄壳加载线上站点(故障回归锁)', () => {
  it('REST/SSE 走同源,绝不回退本机 8802', () => {
    setTauriRuntime(true)
    setWindowLocation('https://aizhs.top/agents')
    clearBakedEnv()

    expect(isTauriRuntime()).toBe(true)
    expect(isRemoteWindow()).toBe(true)
    expect(resolveApiBaseUrl()).toBe('')
    expect(resolveStreamApiBaseUrl()).toBe('')
    // 显式断言坏值不再出现(这是"桌面端连不上生产后端"的直接原因)
    expect(resolveApiBaseUrl()).not.toContain('127.0.0.1')
    expect(resolveStreamApiBaseUrl()).not.toContain('8802')
  })

  it('WS 必须给出绝对地址(new URL 解析要求),同源推导为当前 origin', () => {
    setTauriRuntime(true)
    setWindowLocation('https://aizhs.top/agents')
    clearBakedEnv()

    expect(resolveWsApiBaseUrl()).toBe('https://aizhs.top')
    expect(() => new URL(resolveWsApiBaseUrl())).not.toThrow()
  })
})

describe('本地三端联调语义保留', () => {
  it('桌面端 + 本地 dev(8801) 回退本机 API', () => {
    setTauriRuntime(true)
    setWindowLocation('http://localhost:8801/agents')
    clearBakedEnv()

    expect(isRemoteWindow()).toBe(false)
    expect(resolveApiBaseUrl()).toBe('http://127.0.0.1:8802')
    expect(resolveStreamApiBaseUrl()).toBe('http://localhost:8802')
  })

  it('桌面端 + tauri.localhost 本地壳回退本机 API', () => {
    setTauriRuntime(true)
    setWindowLocation('http://tauri.localhost/index.html')
    clearBakedEnv()

    expect(resolveApiBaseUrl()).toBe('http://127.0.0.1:8802')
    expect(resolveStreamApiBaseUrl()).toBe('http://localhost:8802')
  })
})

describe('浏览器语义零回归', () => {
  it('浏览器生产 origin 走同源', () => {
    setTauriRuntime(false)
    setWindowLocation('https://aizhs.top/agents')
    clearBakedEnv()

    expect(resolveApiBaseUrl()).toBe('')
    expect(resolveStreamApiBaseUrl()).toBe('')
    expect(resolveWsApiBaseUrl()).toBe('https://aizhs.top')
  })
})

describe('显式环境变量最高优先(桌面端 SaaS 烘焙)', () => {
  it('NEXT_PUBLIC_API_BASE_URL 非空时覆盖一切判定', () => {
    setTauriRuntime(true)
    setWindowLocation('https://aizhs.top/agents')
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://staging.example.com')
    vi.stubEnv('NEXT_PUBLIC_STREAM_API_BASE_URL', 'https://staging.example.com')
    vi.stubEnv('NEXT_PUBLIC_WS_BASE_URL', 'https://ws.example.com')

    expect(resolveApiBaseUrl()).toBe('https://staging.example.com')
    expect(resolveStreamApiBaseUrl()).toBe('https://staging.example.com')
    expect(resolveWsApiBaseUrl()).toBe('https://ws.example.com')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
