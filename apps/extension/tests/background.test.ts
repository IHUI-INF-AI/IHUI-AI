/**
 * Background Service Worker 模块加载测试。
 *
 * 说明:background.ts 的 routeMessage / handleApiProxy / handleVocabLookup /
 * handleHighlightToggle / handleSidePanelOpen / parseVocabContent 等函数
 * 均未导出(只 export default defineBackground(() => {...})),
 * 无法在不修改源码的前提下直接单元测试。
 *
 * 这些函数的集成测试需通过 e2e(wxt dev + browser)覆盖:
 *  - 消息路由行为见 tests/message-router.test.ts(sendMessage 端)
 *  - agent action 执行器见 tests/agent-control.test.ts
 *
 * 本文件验证模块可加载不崩溃(冒烟测试),作为占位 + 防回归守门。
 */
import { describe, it, expect, vi } from 'vitest'

// === Mock defineBackground(WXT API,全局自动注入,测试环境需手动 mock) ===
// 参考 tests/refresh-token.test.ts 同样模式
;(globalThis as unknown as { defineBackground: unknown }).defineBackground = (fn: () => void) => fn

// === Mock @ihui/api-client(token.ts / token-utils.ts 依赖) ===
vi.mock('@ihui/api-client', () => ({
  setBaseUrl: vi.fn(),
  setTokenProvider: vi.fn(),
  refreshAccessToken: vi.fn(),
}))

describe('background service worker', () => {
  it('应可加载模块而不崩溃', async () => {
    // background.ts 用 defineBackground 包装,import 时只执行模块级代码:
    //   - 解析 imports(token / token-utils / message-router / config / agent-control / agent-control-bridge)
    //   - 定义 handler 函数(callApi / handleApiProxy / routeMessage 等)
    //   - 调用 defineBackground(() => {...}) 注册回调(被 mock 拦截,不执行回调体)
    // 不触发 chrome API 调用(都在 defineBackground 回调内)
    const mod = await import('../entrypoints/background')
    expect(mod).toBeDefined()
    expect(mod.default).toBeDefined()
  })
})
