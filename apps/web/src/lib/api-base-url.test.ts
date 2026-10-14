// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  isDesktopAuthVaultEnabled,
  isLocalWebDevOrigin,
  isRemoteWindow,
  isTauriRuntime,
  resolveAiServiceBaseUrl,
  resolveApiBaseUrl,
  resolveStreamApiBaseUrl,
  resolveWsApiBaseUrl,
} from './api-base-url'

/**
 * 后端寻址契约测试(2026-09-21 立)。
 *
 * 锁定真实故障:桌面端是薄壳 —— 主窗口加载线上 https://aizhs.top/ 首页
 * (2026-10-13 起启动页,此前 /agents;apps/desktop/src-tauri/tauri.conf.json windows[0].url),而线上 web 构建
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
  vi.stubEnv('NEXT_PUBLIC_AI_SERVICE_URL', '')
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
  it('桌面端 dev 壳(窗口=本机 8801)REST 走同源反代,不再跨 host 直连', () => {
    setTauriRuntime(true)
    setWindowLocation('http://localhost:8801/agents')
    clearBakedEnv()

    expect(isRemoteWindow()).toBe(false)
    expect(isLocalWebDevOrigin()).toBe(true)
    // 2026-10-15 改判(原锁 'http://127.0.0.1:8802'):跨 host 直连让 httpOnly refresh
    // cookie 变成第三方 ⇒ 桌面 dev 壳只能靠与生产壳共享的 vault 键维持登录态,两侧互相清库。
    // 同源后经 next rewrites 反代到 8802/8803,与浏览器 dev 同形,cookie 回到第一方。
    expect(resolveApiBaseUrl()).toBe('')
    expect(resolveAiServiceBaseUrl()).toBe('')
    // SSE / WS 不属本次改判:dev 代理会缓冲 SSE、且 next 不反代 WS 升级,必须直连本机。
    expect(resolveStreamApiBaseUrl()).toBe('http://localhost:8802')
    expect(resolveWsApiBaseUrl()).toBe('http://127.0.0.1:8802')
    // 凭据库同判据关闭(dev 壳不得读写那颗跨壳共享键)
    expect(isDesktopAuthVaultEnabled()).toBe(false)
  })

  it('桌面端 + tauri.localhost 本地壳回退本机 API', () => {
    setTauriRuntime(true)
    setWindowLocation('http://tauri.localhost/index.html')
    clearBakedEnv()

    expect(isLocalWebDevOrigin()).toBe(false)
    expect(resolveApiBaseUrl()).toBe('http://127.0.0.1:8802')
    expect(resolveStreamApiBaseUrl()).toBe('http://localhost:8802')
    // 这类窗口没有 dev server 可反代 ⇒ 凭据库照旧启用(生产壳同路径,零回归)
    expect(isDesktopAuthVaultEnabled()).toBe(true)
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

/**
 * ai-service 基址判定(2026-10-12 立)。
 *
 * 锁定真实故障:桌面端 Tauri dev(窗口 origin=localhost:8801)下 REST 共享基址是
 * 本机 API 8802,而签到等路由只在 ai-service(8803) —— fetchAiServiceJson 复用共享
 * 基址把 /api/checkin/* 打到 8802 → Fastify 404
 * (信封 `Route GET:/api/checkin/accounts not found`)。
 */
describe('ai-service 基址判定(桌面端 dev 签到页 404 回归锁)', () => {
  it('桌面端 dev 壳(8801)走同源 /api/checkin,经 rewrites 落 8803,绝不落 8802', () => {
    setTauriRuntime(true)
    setWindowLocation('http://localhost:8801/checkin')
    clearBakedEnv()

    // 2026-10-15 改判(原锁 'http://127.0.0.1:8803'):同源 '' 同样修好那枚 404 ——
    // next dev 的 `/api/checkin/:path*` rewrite 把请求转发到 8803;差别是 cookie 变第一方,
    // 桌面 dev 壳不再依赖与生产壳共享的 vault 键维持登录态。
    expect(resolveAiServiceBaseUrl()).toBe('')
    // 显式断言坏值不再出现(404 的直接原因:共享基址 8802)
    expect(resolveAiServiceBaseUrl()).not.toContain('8802')
    expect(resolveApiBaseUrl()).toBe('')
  })

  it('桌面端 + tauri.localhost 本地壳直连本机 ai-service 8803', () => {
    setTauriRuntime(true)
    setWindowLocation('http://tauri.localhost/checkin')
    clearBakedEnv()

    expect(resolveAiServiceBaseUrl()).toBe('http://127.0.0.1:8803')
  })

  it('桌面端 + 远端站点(生产薄壳)走同源,绝不回退本机 8803', () => {
    setTauriRuntime(true)
    setWindowLocation('https://aizhs.top/checkin')
    clearBakedEnv()

    expect(resolveAiServiceBaseUrl()).toBe('')
    expect(resolveAiServiceBaseUrl()).not.toContain('127.0.0.1')
    expect(resolveAiServiceBaseUrl()).not.toContain('8803')
  })

  it('浏览器 dev(8801)走同源(经 next rewrites 转发 8803),行为零回归', () => {
    setTauriRuntime(false)
    setWindowLocation('http://localhost:8801/checkin')
    clearBakedEnv()

    expect(resolveAiServiceBaseUrl()).toBe('')
  })

  it('浏览器生产 origin 走同源(nginx 反代),行为零回归', () => {
    setTauriRuntime(false)
    setWindowLocation('https://aizhs.top/checkin')
    clearBakedEnv()

    expect(resolveAiServiceBaseUrl()).toBe('')
  })

  it('NEXT_PUBLIC_AI_SERVICE_URL 显式非空时覆盖一切判定(与 aiServiceBaseUrl() 同一 env 名)', () => {
    setTauriRuntime(true)
    setWindowLocation('http://localhost:8801/checkin')
    vi.stubEnv('NEXT_PUBLIC_AI_SERVICE_URL', 'https://ai-staging.example.com')

    expect(resolveAiServiceBaseUrl()).toBe('https://ai-staging.example.com')
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
