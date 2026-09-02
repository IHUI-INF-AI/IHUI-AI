// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​​‌​​⁠

import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildWsUrl, detectWsOrigin } from '../ws-url'

afterEach(() => {
  vi.unstubAllEnvs()
  // 清理桌面端探测标记(jsdom 默认无 __TAURI_INTERNALS__)
  if ('__TAURI_INTERNALS__' in window) {
    delete (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__
  }
})

/** 模拟桌面端:注入 Tauri 运行时标记 */
function stubDesktop(): void {
  Object.defineProperty(window, '__TAURI_INTERNALS__', { value: {}, configurable: true })
}

describe('detectWsOrigin - WS 源解析优先级', () => {
  it('浏览器 dev/生产无任何 env → 空字符串(同源,行为与改造前一致)', () => {
    expect(detectWsOrigin()).toBe('')
  })

  it('显式 NEXT_PUBLIC_WS_BASE_URL 优先(非桌面端也生效)', () => {
    vi.stubEnv('NEXT_PUBLIC_WS_BASE_URL', 'https://api.aizhs.top')
    expect(detectWsOrigin()).toBe('wss://api.aizhs.top')
  })

  it('桌面端无显式 WS base 时由 API base 推导(http→ws)', () => {
    stubDesktop()
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'http://localhost:8802')
    expect(detectWsOrigin()).toBe('ws://localhost:8802')
  })

  it('桌面端推导去除尾部斜杠(https→wss)', () => {
    stubDesktop()
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://aizhs.top/')
    expect(detectWsOrigin()).toBe('wss://aizhs.top')
  })

  it('非桌面端即使有 API base 也不推导(保持同源)', () => {
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://aizhs.top')
    expect(detectWsOrigin()).toBe('')
  })
})

describe('buildWsUrl - 地址与 token 注入', () => {
  const sameOrigin = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`

  it('无 env 浏览器 → 同源 + 路径 + ?token', () => {
    expect(buildWsUrl('/ws/tasks/abc', 'tok_1')).toBe(
      `${sameOrigin}/ws/tasks/abc?token=tok_1`,
    )
  })

  it('路径已含 query → token 用 & 拼接', () => {
    vi.stubEnv('NEXT_PUBLIC_WS_BASE_URL', 'https://api.aizhs.top')
    expect(buildWsUrl('/ws/agent/stream?room=1', 'tok_2')).toBe(
      'wss://api.aizhs.top/ws/agent/stream?room=1&token=tok_2',
    )
  })

  it('桌面端 + API base → 推导 WS 源', () => {
    stubDesktop()
    vi.stubEnv('NEXT_PUBLIC_API_BASE_URL', 'https://aizhs.top')
    expect(buildWsUrl('/ws/messages', 'tok_3')).toBe(
      'wss://aizhs.top/ws/messages?token=tok_3',
    )
  })

  it('显式绝对 URL 路径(wsPath 覆盖)→ 统一转 ws/wss 并追加 token', () => {
    vi.stubEnv('NEXT_PUBLIC_WS_BASE_URL', 'wss://api.aizhs.top')
    expect(buildWsUrl('https://custom.example.com/v1/ai/capabilities/ws/stream', 'tok_4')).toBe(
      'wss://custom.example.com/v1/ai/capabilities/ws/stream?token=tok_4',
    )
  })

  it('token 特殊字符 URL 编码', () => {
    expect(buildWsUrl('/ws/x', 'a b&c=')).toBe(`${sameOrigin}/ws/x?token=a%20b%26c%3D`)
  })
})
