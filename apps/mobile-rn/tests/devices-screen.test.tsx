// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G1 设备管理屏渲染套件(2026-10-30 立)。
// 纪律:mock @ihui/api-client 用户面六函数(developer-screen-render 同型夹具模式),
// 断言设备列表/空态/配对码大字/撤销确认/委派会话/任务状态六条用户面闭环。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import type { ConversationDetail, DeviceRow, DeviceTaskRow } from '@ihui/api-client'

const nav = vi.hoisted(() => ({ goBack: vi.fn(), navigate: vi.fn() }))
const pops = vi.hoisted(() => ({ appAlert: vi.fn() }))
/** 可变夹具:各用例改它,被 mock 的端点在渲染时现读 */
const state = vi.hoisted(() => ({
  devices: [] as unknown[],
  conversations: [] as unknown[],
  tasks: [] as unknown[],
  pairCode: { code: '246810', expires_at: '' },
  failList: false,
}))

vi.mock('@react-navigation/native', () => ({ useNavigation: () => nav }))
vi.mock('../src/components/BottomPops', () => ({ appAlert: pops.appAlert }))
vi.mock('../src/components/NavBar', () => ({
  NavBar: ({ title, onBack }: { title?: string; onBack?: () => void }) =>
    createElement('div', { 'data-role': 'navbar', onClick: onBack }, title),
}))
vi.mock('../src/components/NavChrome', () => ({
  NavChrome: ({ children }: { children?: ReactNode }) => createElement('div', null, children),
}))
vi.mock('@ihui/api-client', () => ({
  listDevices: () =>
    state.failList
      ? Promise.resolve({ success: false, error: 'boom', status: 500 })
      : Promise.resolve({ success: true, data: state.devices, status: 200 }),
  revokeDevice: vi.fn(() =>
    Promise.resolve({ success: true, data: { id: 'd1', revoked: true }, status: 200 }),
  ),
  issuePairCode: () => Promise.resolve({ success: true, data: state.pairCode, status: 200 }),
  listConversations: () =>
    Promise.resolve({
      success: true,
      data: {
        conversations: state.conversations,
        page: 1,
        pageSize: 50,
        total: state.conversations.length,
      },
      status: 200,
    }),
  delegateSession: vi.fn(() =>
    Promise.resolve({ success: true, data: { task_id: 'task-1', status: 'queued' }, status: 200 }),
  ),
  getDeviceTasks: vi.fn(() => Promise.resolve({ success: true, data: state.tasks, status: 200 })),
}))

import DevicesScreen from '../src/screens/DevicesScreen'
import { I18nProvider } from '../src/i18n'

const renderScreen = () => render(createElement(I18nProvider, null, createElement(DevicesScreen)))

const DEVICE_ONLINE: DeviceRow = {
  id: 'dev-1',
  userId: 'u1',
  name: '办公台式机',
  os: 'Windows 11',
  capabilities: null,
  lastSeenAt: '2026-10-30T08:00:00Z',
  createdAt: '2026-10-01T00:00:00Z',
  revokedAt: null,
  online: true,
}
const DEVICE_OFFLINE: DeviceRow = {
  ...DEVICE_ONLINE,
  id: 'dev-2',
  name: '书房笔记本',
  os: 'macOS 15',
  online: false,
}
const CONV: ConversationDetail = {
  id: 'conv-9',
  userId: 'u1',
  title: '产品评审讨论',
  model: 'm1',
  systemPrompt: null,
  metadata: null,
  lastMessageAt: '2026-10-30T07:00:00Z',
  createdAt: '2026-10-29T00:00:00Z',
  updatedAt: '2026-10-30T07:00:00Z',
}
const TASK: DeviceTaskRow = {
  id: 'task-1',
  sessionId: 'conv-9',
  targetDeviceId: 'dev-1',
  status: 'completed',
  claimedAt: null,
  finishedAt: '2026-10-30T09:00:00Z',
  error: null,
  resultSummary: null,
  createdAt: '2026-10-30T08:30:00Z',
  createdBy: 'u1',
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  state.devices = [DEVICE_ONLINE, DEVICE_OFFLINE]
  state.conversations = [CONV]
  state.tasks = [TASK]
  state.pairCode = { code: '246810', expires_at: new Date(Date.now() + 5 * 60_000).toISOString() }
  state.failList = false
})

describe('DevicesScreen 设备列表', () => {
  it('渲染设备名称 / OS / 在线与离线徽章 / 最后在线', async () => {
    renderScreen()
    expect(await screen.findByText('办公台式机')).toBeTruthy()
    expect(screen.getByText('书房笔记本')).toBeTruthy()
    expect(screen.getByText('在线')).toBeTruthy()
    expect(screen.getByText('离线')).toBeTruthy()
    expect(screen.getByText(/Windows 11/)).toBeTruthy()
    // 每台设备一行 meta(含「最后在线」),两台设备即两条
    expect(screen.getAllByText(/最后在线/).length).toBe(2)
  })

  it('无设备时显示空态文案', async () => {
    state.devices = []
    renderScreen()
    expect(await screen.findByText('还没有已连接的设备')).toBeTruthy()
  })

  it('加载失败时显示重试入口', async () => {
    state.failList = true
    renderScreen()
    // 后端 error 优先回显(无 error 才兜底 i18n 文案),且必须给出重试入口
    expect(await screen.findByText('boom')).toBeTruthy()
    expect(screen.getByText('重试')).toBeTruthy()
  })
})

describe('DevicesScreen 配对码', () => {
  it('点生成后大字展示 6 位码并显示剩余有效期', async () => {
    renderScreen()
    fireEvent.click(await screen.findByText('生成配对码'))
    expect(await screen.findByText('246810')).toBeTruthy()
    // 倒计时文案在 pair 状态提交后的 effect 帧才出现,必须用异步查询(同步 getByText 会读到过期占位帧)
    expect(await screen.findByText(/剩余有效期/)).toBeTruthy()
  })
})

describe('DevicesScreen 撤销 / 委派 / 任务', () => {
  it('点撤销弹二次确认(appAlert 收到设备名)', async () => {
    renderScreen()
    const revokeBtns = await screen.findAllByText('撤销')
    fireEvent.click(revokeBtns[0]!)
    expect(pops.appAlert).toHaveBeenCalledWith(
      '撤销设备',
      expect.stringContaining('办公台式机'),
      expect.any(Array),
    )
  })

  it('委派面板列出既有会话,点条目调 delegateSession(会话id, 设备id)', async () => {
    renderScreen()
    const delegateBtns = await screen.findAllByText('委派会话')
    fireEvent.click(delegateBtns[0]!)
    expect(await screen.findByText('产品评审讨论')).toBeTruthy()
    fireEvent.click(screen.getByText('产品评审讨论'))
    const api = await import('@ihui/api-client')
    await waitFor(() => expect(api.delegateSession).toHaveBeenCalledWith('conv-9', 'dev-1'))
    expect(pops.appAlert).toHaveBeenCalledWith('已委派', expect.stringContaining('办公台式机'))
  })

  it('任务面板按设备拉取并渲染状态徽章', async () => {
    renderScreen()
    const taskBtns = await screen.findAllByText('任务')
    fireEvent.click(taskBtns[0]!)
    expect(await screen.findByText('已完成')).toBeTruthy()
    const api = await import('@ihui/api-client')
    expect(api.getDeviceTasks).toHaveBeenCalledWith('dev-1')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
