// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import * as React from 'react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const {
  mockFetchApi,
  mockToast,
  mockChatState,
  mockCreateConversation,
  mockWorkspaceState,
  mockEnsureDefault,
  mockGetPermission,
} = vi.hoisted(() => ({
  mockFetchApi: vi.fn(),
  mockToast: { error: vi.fn(), success: vi.fn() },
  mockChatState: {
    conversationId: 'conv-test',
    currentModel: 'auto',
    setConversationId: vi.fn(),
  },
  mockCreateConversation: vi.fn(),
  mockWorkspaceState: {
    activeWorkspace: { path: 'C:\\IHUI-AI', name: 'IHUI-AI' },
    setActiveWorkspace: vi.fn(),
  },
  mockEnsureDefault: vi.fn(),
  mockGetPermission: vi.fn(),
}))

vi.mock('@/lib/api', () => ({ fetchApi: mockFetchApi }))
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ error: mockToast.error, success: mockToast.success }),
}))
vi.mock('@/hooks/use-auth-gate', () => ({
  useAuthGate: () => ({ allow: true, ready: true }),
}))
vi.mock('@/components/common', () => ({
  AuthGatePrompt: () => <div data-testid="auth-gate" />,
}))
vi.mock('@/components/layout/PageHeader', () => ({
  PageHeader: ({
    title,
    subtitle,
    actions,
  }: {
    title: string
    subtitle?: string
    actions?: React.ReactNode
  }) => (
    <header>
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
      {actions}
    </header>
  ),
}))
vi.mock('@/components/workspace/local-folder-picker', () => ({
  LocalFolderPicker: () => null,
}))
vi.mock('@/stores/ai-panel', () => ({
  useAiPanelStore: Object.assign(
    (
      selector: (s: {
        activeWorkspace: { path: string; name: string }
        setActiveWorkspace: (value: { path: string; name: string }) => void
        closePanel: () => void
        openPanel: () => void
      }) => unknown,
    ) =>
      selector({
        activeWorkspace: mockWorkspaceState.activeWorkspace,
        setActiveWorkspace: mockWorkspaceState.setActiveWorkspace,
        closePanel: vi.fn(),
        openPanel: vi.fn(),
      }),
    {
      getState: () => ({ openPanel: vi.fn() }),
    },
  ),
}))
vi.mock('@/stores/chat', () => ({
  useChatStore: Object.assign(
    (selector: (s: { conversationId: string }) => unknown) =>
      selector({ conversationId: mockChatState.conversationId }),
    {
      getState: () => mockChatState,
    },
  ),
}))
vi.mock('@ihui/api-client/endpoints/chat', () => ({
  createConversation: mockCreateConversation,
}))
vi.mock('@ihui/api-client/endpoints/workspace', () => ({
  ensureAgentDefaultWorkspace: mockEnsureDefault,
  getRecentWorkspaces: vi.fn(async () => ({ success: true, data: { workspaces: [] } })),
  getWorkspacePermission: mockGetPermission,
  setWorkspacePermission: vi.fn(async () => ({ success: true, data: {} })),
}))
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}))

import { AgentTaskCenter } from '../agent-task-center'

let tasks: Record<string, unknown> = {}
let historyTasks: unknown[] = []

beforeEach(() => {
  tasks = {}
  historyTasks = []
  mockChatState.conversationId = 'conv-test'
  mockChatState.setConversationId.mockReset()
  mockCreateConversation.mockReset()
  mockFetchApi.mockReset()
  mockToast.error.mockReset()
  mockToast.success.mockReset()
  mockWorkspaceState.activeWorkspace = { path: 'C:\\IHUI-AI', name: 'IHUI-AI' }
  mockWorkspaceState.setActiveWorkspace.mockReset()
  mockEnsureDefault.mockReset()
  mockGetPermission.mockReset()
  mockGetPermission.mockResolvedValue({
    success: true,
    data: { permission: { workspacePath: 'C:\\IHUI-AI', mode: 'accept-edits' } },
  })
  mockEnsureDefault.mockResolvedValue({
    success: true,
    data: {
      path: 'C:\\IHUI-AI\\.ihui\\agent-workspaces\\565efe12-73fa-4a89-9e98-00a83225a36e',
      name: 'AI 默认工作区',
      permissionMode: 'accept-edits',
    },
  })
  mockFetchApi.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url === '/api/workspace/agent/tasks' && (!init || !init.method)) {
      return { success: true, data: { tasks } }
    }
    if (url === '/api/workspace/agent/history?limit=50') {
      return { success: true, data: { tasks: historyTasks } }
    }
    if (url === '/api/workspace/agent/run') {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        goal: string
        workspacePath: string
        background: boolean
      }
      tasks = {
        created: {
          taskId: 'created',
          goal: body.goal,
          status: 'running',
          iterations: 1,
          startedAt: '2026-11-27T06:00:00.000Z',
          workspacePath: body.workspacePath,
          steps: [],
        },
      }
      return { success: true, data: { taskId: 'created', status: 'running' } }
    }
    return { success: false, error: `unexpected ${url}` }
  })
})

afterEach(() => {
  cleanup()
})

describe('AgentTaskCenter 普通用户任务中心', () => {
  it('进行中列表展示目标与状态，并默认选中第一条任务', async () => {
    tasks = {
      live: {
        taskId: 'live',
        goal: '整理项目里的 TODO 并生成清单',
        status: 'running',
        iterations: 1,
        startedAt: '2026-11-27T06:00:00.000Z',
        workspacePath: 'C:\\IHUI-AI',
        steps: [
          {
            iteration: 1,
            type: 'tool_call',
            tool: 'read_file',
            content: '{"path":"README.md"}',
          },
        ],
      },
    }

    render(<AgentTaskCenter />)

    await waitFor(() => expect(screen.getByTestId('agent-task-row-live')).toBeTruthy())
    expect(screen.getByTestId('agent-task-detail')).toBeTruthy()
    expect(screen.getAllByText('整理项目里的 TODO 并生成清单').length).toBeGreaterThan(0)
  })

  it('“进行中”只保留仍会继续执行的任务，终态任务归历史', async () => {
    tasks = {
      live: {
        taskId: 'live',
        goal: '正在执行的任务',
        status: 'running',
        iterations: 1,
        startedAt: '2026-11-27T06:00:00.000Z',
        workspacePath: 'C:\\IHUI-AI',
        steps: [],
      },
      done: {
        taskId: 'done',
        goal: '已经完成的任务',
        status: 'completed',
        iterations: 2,
        startedAt: '2026-11-26T06:00:00.000Z',
        workspacePath: 'C:\\IHUI-AI',
        steps: [],
      },
    }

    render(<AgentTaskCenter />)

    await waitFor(() => expect(screen.getByTestId('agent-task-row-live')).toBeTruthy())
    expect(screen.queryByTestId('agent-task-row-done')).toBeNull()
    expect(screen.getByTestId('agent-task-mode-current').textContent).toContain('1')
  })

  it('首次切历史就加载 /history，不依赖再点刷新', async () => {
    historyTasks = [
      {
        taskId: 'archived',
        goal: '生成依赖说明',
        status: 'completed',
        iterations: 2,
        startedAt: '2026-11-26T06:00:00.000Z',
        workspacePath: 'C:\\IHUI-AI',
        result: '已写入 deps.md',
        steps: [],
      },
    ]

    render(<AgentTaskCenter />)
    await waitFor(() => expect(screen.getByTestId('agent-task-center')).toBeTruthy())

    fireEvent.click(screen.getByTestId('agent-task-mode-history'))

    await waitFor(() => expect(screen.getByTestId('agent-task-row-archived')).toBeTruthy())
    expect(screen.getAllByText('生成依赖说明').length).toBeGreaterThan(0)
    expect(
      mockFetchApi.mock.calls.filter((call) => call[0] === '/api/workspace/agent/history?limit=50'),
    ).toHaveLength(1)
  })

  it('新建任务弹窗提交时带工作区、后台执行与 10 轮上限', async () => {
    render(<AgentTaskCenter />)
    await waitFor(() => expect(screen.getByTestId('agent-task-center')).toBeTruthy())

    fireEvent.click(screen.getByTestId('agent-task-new'))
    await waitFor(() => expect(screen.getByTestId('agent-task-goal')).toBeTruthy())

    fireEvent.change(screen.getByTestId('agent-task-goal'), {
      target: { value: '读 package.json 并生成依赖说明' },
    })
    fireEvent.click(screen.getByTestId('agent-task-start'))

    await waitFor(() => {
      expect(mockFetchApi).toHaveBeenCalledWith(
        '/api/workspace/agent/run',
        expect.objectContaining({ method: 'POST' }),
      )
    })
    const runCall = mockFetchApi.mock.calls.find((call) => call[0] === '/api/workspace/agent/run')
    const body = JSON.parse(String((runCall?.[1] as RequestInit).body))
    expect(body).toMatchObject({
      goal: '读 package.json 并生成依赖说明',
      workspacePath: 'C:\\IHUI-AI',
      conversationId: 'conv-test',
      background: true,
      maxIterations: 10,
    })
    await waitFor(() => expect(screen.getByTestId('agent-task-row-created')).toBeTruthy())
  })

  it('没有当前会话时先建会话，并把新会话 id 写进任务', async () => {
    mockChatState.conversationId = ''
    mockCreateConversation.mockResolvedValue({
      success: true,
      data: { conversation: { id: 'conv-new' } },
    })

    render(<AgentTaskCenter />)
    await waitFor(() => expect(screen.getByTestId('agent-task-center')).toBeTruthy())

    fireEvent.click(screen.getByTestId('agent-task-new'))
    await waitFor(() => expect(screen.getByTestId('agent-task-goal')).toBeTruthy())
    fireEvent.change(screen.getByTestId('agent-task-goal'), {
      target: { value: '整理今天的待办' },
    })
    fireEvent.click(screen.getByTestId('agent-task-start'))

    await waitFor(() => expect(mockCreateConversation).toHaveBeenCalledTimes(1))
    expect(mockCreateConversation).toHaveBeenCalledWith(
      expect.objectContaining({ title: '整理今天的待办', model: 'auto' }),
    )
    expect(mockChatState.setConversationId).toHaveBeenCalledWith('conv-new')

    const runCall = await waitFor(() => {
      const call = mockFetchApi.mock.calls.find((item) => item[0] === '/api/workspace/agent/run')
      expect(call).toBeTruthy()
      return call
    })
    const body = JSON.parse(String((runCall?.[1] as RequestInit).body))
    expect(body.conversationId).toBe('conv-new')
  })

  it('老账号默认工作区仍是 default 档时，提交前先幂等迁移为 accept-edits', async () => {
    const defaultPath = 'C:\\IHUI-AI\\.ihui\\agent-workspaces\\565efe12-73fa-4a89-9e98-00a83225a36e'
    mockWorkspaceState.activeWorkspace = { path: defaultPath, name: 'AI 默认工作区' }
    mockGetPermission.mockResolvedValue({
      success: true,
      data: { permission: { workspacePath: defaultPath, mode: 'default' } },
    })
    mockEnsureDefault.mockResolvedValue({
      success: true,
      data: { path: defaultPath, name: 'AI 默认工作区', permissionMode: 'accept-edits' },
    })

    render(<AgentTaskCenter />)
    await waitFor(() => expect(screen.getByTestId('agent-task-center')).toBeTruthy())

    fireEvent.click(screen.getByTestId('agent-task-new'))
    await waitFor(() => expect(screen.getByTestId('agent-task-goal')).toBeTruthy())
    fireEvent.change(screen.getByTestId('agent-task-goal'), {
      target: { value: '写一个根目录证明文件' },
    })
    fireEvent.click(screen.getByTestId('agent-task-start'))

    await waitFor(() => expect(mockEnsureDefault).toHaveBeenCalledTimes(1))
    const runCall = await waitFor(() => {
      const call = mockFetchApi.mock.calls.find((item) => item[0] === '/api/workspace/agent/run')
      expect(call).toBeTruthy()
      return call
    })
    const body = JSON.parse(String((runCall?.[1] as RequestInit).body))
    expect(body.workspacePath).toBe(defaultPath)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
