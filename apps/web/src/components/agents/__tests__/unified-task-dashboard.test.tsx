// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D25(2026-09-19 立):UnifiedTaskDashboard 接线防回归测试。
 *
 * 与 kanban-board.test.tsx 同策略:完整 jsdom 挂载在测试环境受限(四源聚合
 * 组件依赖大量 Provider),故验证两层可靠契约:
 * ①kanban api 层新增函数(改名 PATCH / 消息 GET+POST)的信封行为与请求形状;
 * ②side panel 的 unified tab 接线与 dashboard 关键 testid 未被意外移除。
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import * as fs from 'node:fs'
import path from 'node:path'
import { renameKanbanTask, listTaskMessages, sendTaskMessage } from '@/lib/agent-kanban-api'
import { fetchApi } from '@/lib/api'

vi.mock('@/lib/api', () => ({ fetchApi: vi.fn() }))
vi.mock('@/stores/auth', () => ({
  useAuthStore: { getState: () => ({ user: null, token: null }) },
}))

const mockedFetchApi = vi.mocked(fetchApi)

const ID_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ID_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

describe('D25 kanban api 层(改名 + 任务消息)', () => {
  beforeEach(() => {
    mockedFetchApi.mockReset()
  })

  it('renameKanbanTask:PATCH 请求形状正确,成功透传 KanbanTask', async () => {
    const task = { id: ID_A, name: '新名' }
    mockedFetchApi.mockResolvedValue({ success: true, data: task } as never)
    await expect(renameKanbanTask(ID_A, { name: '新名' })).resolves.toEqual(task)
    const [url, opts] = mockedFetchApi.mock.calls[0]!
    expect(url).toBe(`/api/agents/kanban/tasks/${ID_A}`)
    expect((opts as RequestInit).method).toBe('PATCH')
    expect(JSON.parse((opts as RequestInit).body as string)).toEqual({ name: '新名' })
  })

  it('renameKanbanTask:失败信封抛错并携带 status(供 UI 区分 404/409)', async () => {
    mockedFetchApi.mockResolvedValue({ success: false, error: '任务不存在', status: 404 } as never)
    await expect(renameKanbanTask(ID_A, { name: 'x' })).rejects.toMatchObject({
      message: '任务不存在',
      status: 404,
    })
  })

  it('listTaskMessages:taskId/limit/offset 进 query string,成功透传分页', async () => {
    const page = { taskId: ID_A, messages: [], hasMore: false }
    mockedFetchApi.mockResolvedValue({ success: true, data: page } as never)
    await expect(listTaskMessages(ID_A, 20, 40)).resolves.toEqual(page)
    const [url] = mockedFetchApi.mock.calls[0]!
    expect(url).toBe(`/api/task-messages?taskId=${ID_A}&limit=20&offset=40`)
  })

  it('listTaskMessages:默认 limit=50 offset=0', async () => {
    mockedFetchApi.mockResolvedValue({
      success: true,
      data: { taskId: ID_A, messages: [], hasMore: false },
    } as never)
    await listTaskMessages(ID_A)
    const [url] = mockedFetchApi.mock.calls[0]!
    expect(url).toBe(`/api/task-messages?taskId=${ID_A}&limit=50&offset=0`)
  })

  it('sendTaskMessage:POST body 序列化 mentions,成功透传消息行', async () => {
    const row = {
      id: ID_B,
      taskId: ID_A,
      fromType: 'user',
      fromId: 'user-1',
      content: 'hi',
      mentions: [],
      createdBy: 'user-1',
      createdAt: '2026-09-19T00:00:00.000Z',
    }
    mockedFetchApi.mockResolvedValue({ success: true, data: row } as never)
    const mentions = [{ type: 'task' as const, taskId: ID_B, name: 'B' }]
    await expect(sendTaskMessage({ taskId: ID_A, content: 'hi', mentions })).resolves.toEqual(row)
    const [url, opts] = mockedFetchApi.mock.calls[0]!
    expect(url).toBe('/api/task-messages')
    expect((opts as RequestInit).method).toBe('POST')
    expect(JSON.parse((opts as RequestInit).body as string)).toEqual({
      taskId: ID_A,
      content: 'hi',
      mentions,
    })
  })

  it('sendTaskMessage:失败信封抛错(如 @引用不存在 400)', async () => {
    mockedFetchApi.mockResolvedValue({
      success: false,
      error: '存在无效的 @任务引用',
      status: 400,
    } as never)
    await expect(
      sendTaskMessage({ taskId: ID_A, content: 'x', mentions: [{ type: 'task', taskId: ID_B }] }),
    ).rejects.toMatchObject({ message: '存在无效的 @任务引用', status: 400 })
  })
})

describe('unified tab 接线防回归(D25)', () => {
  it('ai-side-panel-tools 已注册 unified tab 并挂载 UnifiedTaskDashboard', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/ai/ai-side-panel-tools.tsx'),
      'utf-8',
    )
    expect(src).toContain("| 'unified'")
    expect(src).toContain("'unified',")
    expect(src).toContain("case 'unified':")
    expect(src).toContain('@/components/agents/UnifiedTaskDashboard')
  })

  it('UnifiedTaskDashboard 组件存在且为具名导出(含关键 testid)', () => {
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/agents/UnifiedTaskDashboard.tsx'),
      'utf-8',
    )
    expect(src).toContain('export function UnifiedTaskDashboard')
    expect(src).toContain('data-testid="unified-task-dashboard"')
    expect(src).toContain('data-testid="unified-task-search"')
    expect(src).toContain('data-testid="unified-send-btn"')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
