// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 回归:未登录时不得轮询用户维度接口。
// 立因(2026-09-25 生产实测):首页挂着 useActiveDispatches / useSwarmTopology,二者只有
// refetchInterval 而没有登录态守卫;游客拿到 401 后 fetchApi 把失败降级成空数组 ⇒ React Query
// 认为"这一轮成功",于是每 5s 无限打下去 —— 单个空闲标签页 4 分钟内 230+ 次请求
// (/api/subagents/active 401、/api/subagents/topology 401、/api/auth/refresh 400 各约 77 次)。
// 本用例把"游客 0 请求 / 已登录才请求"钉死,防止将来有人顺手把 enabled 删掉。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import React from 'react'
import { render, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// 登录态开关:模块级可变,供 useAuthStore 的桩读取
let authed = false

vi.mock('@/stores/auth', () => ({
  useAuthStore: (selector: (s: { isAuthenticated: boolean }) => unknown) =>
    selector({ isAuthenticated: authed }),
}))

vi.mock('@/hooks/use-page-visibility', () => ({
  usePageVisibility: () => true,
}))

const fetchApi = vi.fn(async () => ({
  success: true,
  data: { dispatches: [], topology: { nodes: [], edges: [] } },
}))
vi.mock('@/lib/api', () => ({
  fetchApi: (...args: unknown[]) => fetchApi(...(args as [string])),
}))

import { useActiveDispatches, useSwarmTopology } from '../use-subagent-dispatch'

// 两个 hook 各用独立探针组件:同一组件里 if/else 调 hook 违反 react-hooks/rules-of-hooks
// (eslint 在 lint-staged 阶段直接拦下,提交链因此提前中断——别学这种写法)。
function ActiveProbe() {
  useActiveDispatches()
  return React.createElement('div', { 'data-testid': 'probe' })
}
function TopologyProbe() {
  useSwarmTopology()
  return React.createElement('div', { 'data-testid': 'probe' })
}

function mount(which: 'active' | 'topology') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return render(
    React.createElement(
      QueryClientProvider,
      { client: qc },
      React.createElement(which === 'active' ? ActiveProbe : TopologyProbe),
    ),
  )
}

/** 等若干宏任务/定时器,给轮询一点机会暴露出来 */
async function settle(): Promise<void> {
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 20))
}

describe('use-subagent-dispatch 登录态守卫', () => {
  beforeEach(() => {
    authed = false
    fetchApi.mockClear()
  })
  afterEach(() => cleanup())

  for (const which of ['active', 'topology'] as const) {
    it(`游客(${which})挂载后一个请求都不发`, async () => {
      mount(which)
      await settle()
      expect(fetchApi).not.toHaveBeenCalled()
    })

    it(`已登录(${which})才会去拉数据 —— 反向对照,证明上一条不是恒真`, async () => {
      authed = true
      mount(which)
      await settle()
      expect(fetchApi).toHaveBeenCalledTimes(1)
      const path = String(fetchApi.mock.calls[0][0])
      expect(path).toBe(which === 'active' ? '/api/subagents/active' : '/api/subagents/topology')
    })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
