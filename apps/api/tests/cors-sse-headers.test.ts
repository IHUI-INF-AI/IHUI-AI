// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import {
  buildSseCorsHeaders,
  deriveCorsAllowanceInputs,
  DESKTOP_ORIGINS,
  MOBILE_CAP_ORIGINS,
} from '../src/plugins/cors-origin.js'

// 2026-10-31 R10 安全强化:把 SSE 的 CORS 回显逻辑收敛到 buildSseCorsHeaders 后,
// 用单测钉死 fail-closed 契约 —— 任何不在白名单的 origin 都不得回显 ACAO/ACAC,
// 否则即 CORS 凭证绕过(CWE-346):恶意站点可带用户凭据跨域读取其 SSE 流。
describe('buildSseCorsHeaders (SSE CORS 回显, fail-closed)', () => {
  const CORS = 'https://app.ihui.example, https://admin.ihui.example'
  const EXT = '' // 未配置扩展白名单

  it('缺失 origin(非浏览器客户端)不回显任何 CORS 头', () => {
    expect(buildSseCorsHeaders(undefined, CORS, EXT)).toEqual({})
    expect(buildSseCorsHeaders('', CORS, EXT)).toEqual({})
  })

  it('白名单内的 web origin 回显 ACAO + ACAC', () => {
    const h = buildSseCorsHeaders('https://app.ihui.example', CORS, EXT)
    expect(h['Access-Control-Allow-Origin']).toBe('https://app.ihui.example')
    expect(h['Access-Control-Allow-Credentials']).toBe('true')
  })

  it('大小写/空白容差:配置里小写、请求里大写也能命中', () => {
    const h = buildSseCorsHeaders('HTTPS://APP.IHUI.EXAMPLE', CORS, EXT)
    expect(h['Access-Control-Allow-Origin']).toBe('HTTPS://APP.IHUI.EXAMPLE')
  })

  it('恶意 origin(evil.com)一律不回显 —— CORS 凭证绕过的核心防线', () => {
    const h = buildSseCorsHeaders('https://evil.example.net', CORS, EXT)
    expect(h['Access-Control-Allow-Origin']).toBeUndefined()
    expect(h['Access-Control-Allow-Credentials']).toBeUndefined()
  })

  it('桌面端 Tauri origin 固定白名单命中', () => {
    for (const o of DESKTOP_ORIGINS) {
      const h = buildSseCorsHeaders(o, CORS, EXT)
      expect(h['Access-Control-Allow-Origin'], `期望 ${o} 放行`).toBe(o)
    }
  })

  it('移动壳 Capacitor origin 固定白名单命中', () => {
    for (const o of MOBILE_CAP_ORIGINS) {
      const h = buildSseCorsHeaders(o, CORS, EXT)
      expect(h['Access-Control-Allow-Origin'], `期望 ${o} 放行`).toBe(o)
    }
  })

  it('chrome-extension:未配置 IHUI_EXTENSION_IDS 时整类拒绝(fail-closed)', () => {
    const h = buildSseCorsHeaders('chrome-extension://abcdefghijklmnopqrstuvwxyz', CORS, EXT)
    expect(h['Access-Control-Allow-Origin']).toBeUndefined()
  })

  it('chrome-extension:配置了精确 ID 才放行,非匹配 ID 仍拒绝', () => {
    const extCfg = 'chrome-extension://exactid000'
    const ok = buildSseCorsHeaders('chrome-extension://exactid000', CORS, extCfg)
    expect(ok['Access-Control-Allow-Origin']).toBe('chrome-extension://exactid000')
    const bad = buildSseCorsHeaders('chrome-extension://otherid111', CORS, extCfg)
    expect(bad['Access-Control-Allow-Origin']).toBeUndefined()
  })

  it('未知 origin 类(如 file:/// 或非白名单 scheme)不回显', () => {
    const h = buildSseCorsHeaders('file:///C:/Users/me/secret.html', CORS, EXT)
    expect(h['Access-Control-Allow-Origin']).toBeUndefined()
  })
})

describe('deriveCorsAllowanceInputs (config 串 → 归一化输入, 单一真源)', () => {
  it('逗号分隔 + 去空白 + 去空串 + 小写化', () => {
    const { allowedOrigins, extensionIds } = deriveCorsAllowanceInputs(
      ' A.com ,B.com,, C.com ',
      ' X ,, Y ',
    )
    expect(allowedOrigins).toEqual(['a.com', 'b.com', 'c.com'])
    expect(extensionIds).toEqual(['x', 'y'])
  })

  it('空串不产生任何匹配项(防尾逗号产生空 origin 命中)', () => {
    const { allowedOrigins } = deriveCorsAllowanceInputs('', '')
    expect(allowedOrigins).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
