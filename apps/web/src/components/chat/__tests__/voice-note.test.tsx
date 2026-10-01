// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// ③ 降级路径:sttEnabled=false → waitingTranscript 停留 pending 不崩(验收:端点缺失优雅降级)
// ④ 归档闭环:落 localStorage 分桶 + 插入对话走 draftInput 既有通道。

// @vitest-environment jsdom

import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, fireEvent, act } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations:
    () =>
    (key: string): string =>
      key,
}))

const sttFromBlobMock = vi.fn()
vi.mock('@ihui/api-client', () => ({
  voiceSttFromBlob: (...args: unknown[]) => sttFromBlobMock(...args),
}))

vi.mock('@/stores/auth-store', () => ({
  useWebAuthStore: (sel: (s: { token: string }) => string) => sel({ token: 'tok-1' }),
}))

const chatSetState = vi.fn()
vi.mock('@/stores/chat', () => ({
  useChatStore: { setState: (...args: unknown[]) => chatSetState(...args) },
}))

vi.mock('@ihui/ui-react', () => ({
  Button: ({
    children,
    onClick,
    'data-testid': testId,
  }: {
    children: React.ReactNode
    onClick?: () => void
    'data-testid'?: string
  }): React.ReactElement => (
    <button type="button" onClick={onClick} data-testid={testId}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }): React.ReactElement => (
    <div>{children}</div>
  ),
}))

class MockMediaRecorder {
  static instances: MockMediaRecorder[] = []
  state = 'inactive'
  ondataavailable: ((e: { data: { size: number } }) => void) | null = null
  onstop: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor() {
    MockMediaRecorder.instances.push(this)
  }
  start(): void {
    this.state = 'recording'
    this.ondataavailable?.({ data: { size: 1024 } })
  }
  stop(): void {
    this.state = 'inactive'
  }
}

const mockGetUserMedia = vi.fn()

function installBrowserMocks(): void {
  MockMediaRecorder.instances = []
  vi.stubGlobal('MediaRecorder', MockMediaRecorder)
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: mockGetUserMedia },
    configurable: true,
  })
}

import { VoiceNote } from '@/components/chat/voice-note'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  window.localStorage.clear()
})

describe('VoiceNote(D43 会话内快捷笔记)', () => {
  it('happy path:开始→停止→转写成功→completed,转写文本上屏并落归档桶', async () => {
    installBrowserMocks()
    mockGetUserMedia.mockResolvedValue({ getTracks: () => [] })
    sttFromBlobMock.mockResolvedValue('需求:登录页要支持验证码登录')

    render(<VoiceNote storageKey="test:vn" />)
    fireEvent.click(screen.getByTestId('voice-note-trigger'))
    fireEvent.click(screen.getByTestId('voice-note-start'))
    await act(async () => {})
    expect(screen.getByTestId('voice-note-phase').getAttribute('data-phase')).toBe('recording')

    fireEvent.click(screen.getByTestId('voice-note-stop'))
    // 转写 promise 微任务排空
    await act(async () => {})
    const phase = screen.getByTestId('voice-note-phase').getAttribute('data-phase')
    expect(phase).toBe('completed')
    expect(screen.getByTestId('voice-note-transcript').textContent).toBe(
      '需求:登录页要支持验证码登录',
    )
    // 归档落桶
    const bucket = JSON.parse(window.localStorage.getItem('test:vn') ?? '[]') as Array<{
      transcript: string | null
      phase: string
    }>
    expect(bucket).toHaveLength(1)
    expect(bucket[0]?.transcript).toBe('需求:登录页要支持验证码登录')
    expect(bucket[0]?.phase).toBe('completed')
  })

  it('验收:权限拒绝(getUserMedia NotAllowedError)→ failed + errors.permission 文案', async () => {
    installBrowserMocks()
    mockGetUserMedia.mockRejectedValue(
      Object.assign(new Error('denied'), { name: 'NotAllowedError' }),
    )
    render(<VoiceNote storageKey="test:vn" />)
    fireEvent.click(screen.getByTestId('voice-note-trigger'))
    fireEvent.click(screen.getByTestId('voice-note-start'))
    await act(async () => {})
    expect(screen.getByTestId('voice-note-phase').getAttribute('data-phase')).toBe('failed')
    expect(screen.getByTestId('voice-note-error').textContent).toBe('errors.permission')
  })

  it('降级路径:sttEnabled=false → waitingTranscript 停留 pending,给明确文案,不崩', async () => {
    installBrowserMocks()
    mockGetUserMedia.mockResolvedValue({ getTracks: () => [] })
    render(<VoiceNote storageKey="test:vn" sttEnabled={false} />)
    fireEvent.click(screen.getByTestId('voice-note-trigger'))
    fireEvent.click(screen.getByTestId('voice-note-start'))
    await act(async () => {})
    fireEvent.click(screen.getByTestId('voice-note-stop'))
    await act(async () => {})
    expect(screen.getByTestId('voice-note-phase').getAttribute('data-phase')).toBe(
      'waitingTranscript',
    )
    expect(screen.getByTestId('voice-note-stt-pending').textContent).toBe('errors.sttPending')
    // 不崩且转写未被调用
    expect(sttFromBlobMock).not.toHaveBeenCalled()
  })

  it('归档闭环:插入对话走 draftInput 既有通道;删除同步回写 localStorage', async () => {
    installBrowserMocks()
    mockGetUserMedia.mockResolvedValue({ getTracks: () => [] })
    sttFromBlobMock.mockResolvedValue('可插入的笔记文本')
    render(<VoiceNote storageKey="test:vn" />)
    fireEvent.click(screen.getByTestId('voice-note-trigger'))
    fireEvent.click(screen.getByTestId('voice-note-start'))
    await act(async () => {})
    fireEvent.click(screen.getByTestId('voice-note-stop'))
    await act(async () => {})

    fireEvent.click(screen.getByTestId('voice-note-insert'))
    expect(chatSetState).toHaveBeenCalledWith({ draftInput: '可插入的笔记文本' })

    fireEvent.click(screen.getByTestId('voice-note-archive-delete'))
    expect(window.localStorage.getItem('test:vn')).toBe('[]')
  })
})
