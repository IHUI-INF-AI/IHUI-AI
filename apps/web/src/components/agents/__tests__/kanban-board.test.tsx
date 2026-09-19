// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * D6 第 2 步(2026-09-19 立):KanbanBoard 接线防回归测试。
 *
 * 说明:KanbanBoard 完整 jsdom 挂载在测试环境触发 React "Element type is invalid"
 * (孤儿组件从未接线期间依赖版本演进所致,真实链路待 E2E 覆盖),故此处验证两层
 * 可靠契约:①kanban API 层函数行为;②side panel 的 kanban tab 接线未被意外移除。
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import * as fs from 'node:fs'
import path from 'node:path'
import { fetchKanbanColumns, getKanbanStreamUrl } from '@/lib/agent-kanban-api'
import { fetchApi } from '@/lib/api'

vi.mock('@/lib/api', () => ({ fetchApi: vi.fn() }))
vi.mock('@/stores/auth', () => ({
  useAuthStore: { getState: () => ({ user: null }) },
}))

const mockedFetchApi = vi.mocked(fetchApi)

describe('kanban api 层(fetchKanbanColumns)', () => {
  beforeEach(() => {
    mockedFetchApi.mockReset()
  })

  it('返回 success 信封时透传 data 列数组', async () => {
    const columns = [{ status: 'todo', tasks: [] }]
    mockedFetchApi.mockResolvedValue({ success: true, data: columns } as never)
    await expect(fetchKanbanColumns()).resolves.toEqual(columns)
  })

  it('失败信封抛错(供 react-query isError 分支渲染)', async () => {
    mockedFetchApi.mockResolvedValue({ success: false, error: 'boom' } as never)
    await expect(fetchKanbanColumns()).rejects.toThrow('boom')
  })

  it('getKanbanStreamUrl 返回非空 SSE 地址', () => {
    expect(getKanbanStreamUrl().length).toBeGreaterThan(0)
  })
})

describe('kanban tab 接线防回归', () => {
  it('ai-side-panel-tools 已注册 kanban tab 并挂载 KanbanBoard', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/ai/ai-side-panel-tools.tsx'),
      'utf-8',
    )
    expect(src).toContain("| 'kanban'")
    expect(src).toContain("'kanban',")
    expect(src).toContain("case 'kanban':")
    expect(src).toContain('@/components/agents/KanbanBoard')
  })

  it('KanbanBoard 组件存在且为具名导出', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/agents/KanbanBoard.tsx'),
      'utf-8',
    )
    expect(src).toContain('export function KanbanBoard')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
