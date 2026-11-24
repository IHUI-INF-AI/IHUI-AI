// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
//
// 引擎模式 local 腿 · agent 流基址守卫(2026-11-15)。
//
// 钉住的真实缺陷(脑裂):resolveAgentStreamUrl 在 leg=local 时,曾用**引擎不感知**的
// resolveAiServiceBaseUrl() —— 浏览器端它返回 ''(同源),于是 agent 流静默降级云端,
// 而工具链(api.ts 用引擎感知的 resolveAiServiceBaseUrlForEngineMode 注入)仍直连本机
// 8803。结果 = 浏览器选 local 时「编排跑云端 + 工具打本机」的脑裂。
//
// 本守卫锁三件事:
//   ① leg=local(浏览器)→ agent 流基址 = 引擎感知版给的 http://127.0.0.1:8803(与工具链一致);
//   ② leg=cloud → agent 流走云端 /api/agent-langgraph(零回归);
//   ③ 有牙自证:若把 resolveAgentStreamUrl 改回引擎不感知版,① 必须翻红。

import { afterEach, describe, expect, it, vi } from 'vitest'

import { setGlobalEngineMode } from '@ihui/shared'

import { resolveAgentStreamUrl } from '@/hooks/use-agent-stream'

vi.mock('@/lib/api', () => ({
  getStreamBaseUrl: () => '',
  getToken: () => null,
}))

afterEach(() => {
  setGlobalEngineMode('auto')
  vi.unstubAllEnvs()
})

describe('resolveAgentStreamUrl · 引擎 local 腿用引擎感知基址(防脑裂)', () => {
  it('浏览器选 local → agent 流直连本机 8803 /api/langgraph(与工具链同基址)', () => {
    // 浏览器环境(非 Tauri):NEXT_PUBLIC_AI_SERVICE_URL 置空,确保不被 env 短路
    vi.stubEnv('NEXT_PUBLIC_AI_SERVICE_URL', '')
    setGlobalEngineMode('local')

    const url = resolveAgentStreamUrl('t-1', undefined)
    expect(url).toContain('127.0.0.1:8803')
    expect(url).toContain('/api/langgraph/t-1/stream')
  })

  it('浏览器选 local 且带 input → query 正确拼接在 8803 本地腿上', () => {
    vi.stubEnv('NEXT_PUBLIC_AI_SERVICE_URL', '')
    setGlobalEngineMode('local')

    const url = resolveAgentStreamUrl('t-2', '{"a":1}')
    expect(url).toContain('127.0.0.1:8803/api/langgraph/t-2/stream?input=')
    expect(url).toContain(encodeURIComponent('{"a":1}'))
  })

  it('选 cloud → agent 流走云端 /api/agent-langgraph(零回归,不连 8803)', () => {
    vi.stubEnv('NEXT_PUBLIC_AI_SERVICE_URL', '')
    setGlobalEngineMode('cloud')

    const url = resolveAgentStreamUrl('t-3', undefined)
    expect(url).toContain('/api/agent-langgraph/t-3/stream')
    expect(url).not.toContain('127.0.0.1:8803')
  })

  it('有牙自证:local 腿基址必须是引擎感知版(改回不感知版则 8803 丢失)', () => {
    vi.stubEnv('NEXT_PUBLIC_AI_SERVICE_URL', '')
    setGlobalEngineMode('local')

    // 引擎感知版在浏览器 local 下恒返回 8803;引擎不感知版返回 ''(同源)→ 会降级成云端前缀。
    // 这条断言把「用哪个解析函数」这件事钉死。
    expect(resolveAgentStreamUrl('t-4', undefined)).toMatch(/^http:\/\/127\.0\.0\.1:8803\//)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
