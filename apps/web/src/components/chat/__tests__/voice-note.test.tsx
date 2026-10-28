// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// ③ 降级路径:sttEnabled=false → waitingTranscript 停留 pending 不崩(验收:端点缺失优雅降级)
// ④ 归档闭环(D43 第②格后):落服务端 chat_voice_notes + 插入对话走 draftInput 既有通道。

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
/** 服务端归档列表的可变夹具:每个用例按要判的场景改它,断言的是"组件真调了这些出口"。 */
const noteRows = vi.hoisted(() => [] as unknown[])
const noteGroups = vi.hoisted(() => [] as unknown[])
const listVoiceNotesMock = vi.fn()
const createVoiceNoteMock = vi.fn()
const deleteVoiceNoteMock = vi.fn()
const setVoiceNoteArchivedMock = vi.fn()
const updateVoiceNoteMock = vi.fn()
vi.mock('@ihui/api-client', () => ({
  voiceSttFromBlob: (...args: unknown[]) => sttFromBlobMock(...args),
  listVoiceNotes: (...args: unknown[]) => listVoiceNotesMock(...args),
  createVoiceNote: (...args: unknown[]) => createVoiceNoteMock(...args),
  deleteVoiceNote: (...args: unknown[]) => deleteVoiceNoteMock(...args),
  setVoiceNoteArchived: (...args: unknown[]) => setVoiceNoteArchivedMock(...args),
  updateVoiceNote: (...args: unknown[]) => updateVoiceNoteMock(...args),
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
  SearchInput: ({
    value,
    onChange,
    'data-testid': testId,
  }: {
    value?: string
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
    'data-testid'?: string
  }): React.ReactElement => <input value={value} onChange={onChange} data-testid={testId} />,
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
  noteRows.splice(0)
  noteGroups.splice(0)
})

/** 服务端归档读口的形状(闭环用例要判"服务端真按条件筛过",所以这里按入参模拟谓词)。 */
interface ServerQuery {
  partition?: 'active' | 'archived'
  groupKey?: string
  q?: string
}
type ServerRow = ReturnType<typeof serverRow>

/**
 * 归档读口的默认实现:成功 + 按入参(partition/groupKey/q)过滤当前夹具行。
 * 分面在服务端是独立 groupBy,故 `noteGroups` 非空时以它为准(分组用例要钉"分面优先"),
 * 否则由当前行派生 —— 闭环用例靠这条派生链路看到"改完分组后 chip 换了"。
 */
function stubListOk(): void {
  listVoiceNotesMock.mockImplementation(async (query: ServerQuery = {}) => {
    const partition = query.partition ?? 'active'
    const rows = (noteRows as ServerRow[]).filter((row) => {
      if (partition === 'archived' ? row.archivedAt === null : row.archivedAt !== null) return false
      if (query.groupKey && row.groupKey !== query.groupKey) return false
      if (query.q && !(row.transcript ?? '').includes(query.q)) return false
      return true
    })
    const derived = new Map<string, number>()
    for (const row of rows) derived.set(row.groupKey, (derived.get(row.groupKey) ?? 0) + 1)
    const groups =
      noteGroups.length > 0
        ? noteGroups
        : [...derived].map(([groupKey, count]) => ({ groupKey, count }))
    return {
      success: true,
      data: {
        list: rows,
        total: rows.length,
        page: 1,
        pageSize: 50,
        groups,
      },
    }
  })
}
const NOTE_ID = '22222222-2222-4222-8222-222222222222'

/** 服务端 chat_voice_notes 行的夹具形状(归档列表的唯一事实源)。 */
function serverRow(transcript: string | null) {
  return {
    id: NOTE_ID,
    conversationId: null,
    title: transcript ?? '语音笔记',
    transcript,
    durationMs: 2_000,
    audioUrl: null,
    groupKey: 'inbox',
    archivedAt: null as string | null,
    createdAt: '2026-10-18T00:00:00.000Z',
    updatedAt: '2026-10-18T00:00:00.000Z',
  }
}

describe('VoiceNote(D43 会话内快捷笔记)', () => {
  it('happy path:开始→停止→转写成功→completed,转写上屏并落**服务端**归档', async () => {
    installBrowserMocks()
    stubListOk()
    mockGetUserMedia.mockResolvedValue({ getTracks: () => [] })
    sttFromBlobMock.mockResolvedValue('需求:登录页要支持验证码登录')
    createVoiceNoteMock.mockImplementation(
      async (input: { transcript: string | null }): Promise<unknown> => {
        noteRows.push(serverRow(input.transcript))
        return { success: true, data: serverRow(input.transcript) }
      },
    )

    render(<VoiceNote />)
    fireEvent.click(screen.getByTestId('voice-note-trigger'))
    fireEvent.click(screen.getByTestId('voice-note-start'))
    await act(async () => {})
    expect(screen.getByTestId('voice-note-phase').getAttribute('data-phase')).toBe('recording')

    fireEvent.click(screen.getByTestId('voice-note-stop'))
    // 转写 promise 微任务排空
    await act(async () => {})
    expect(screen.getByTestId('voice-note-phase').getAttribute('data-phase')).toBe('completed')
    expect(screen.getByTestId('voice-note-transcript').textContent).toBe(
      '需求:登录页要支持验证码登录',
    )
    // 落库走 api-client(端内不再有任何 localStorage 写)
    expect(createVoiceNoteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        transcript: '需求:登录页要支持验证码登录',
        conversationId: null,
      }),
    )
    // 列表由服务端行渲染 ⇒ 重载后仍在
    await act(async () => {})
    expect(screen.getAllByTestId('voice-note-archive-item')).toHaveLength(1)
  })

  it('转写成功即可一键插入当前输入框:落库失败也走得通(draftInput 既有通道)', async () => {
    installBrowserMocks()
    stubListOk()
    mockGetUserMedia.mockResolvedValue({ getTracks: () => [] })
    sttFromBlobMock.mockResolvedValue('刚说完的一段话')
    // 服务端落库失败 ⇒ 乐观行被回滚,归档列表里没有插入图标
    createVoiceNoteMock.mockResolvedValue({ success: false, error: 'persist down' })

    render(<VoiceNote />)
    fireEvent.click(screen.getByTestId('voice-note-trigger'))
    fireEvent.click(screen.getByTestId('voice-note-start'))
    await act(async () => {})
    fireEvent.click(screen.getByTestId('voice-note-stop'))
    await act(async () => {})
    expect(screen.queryByTestId('voice-note-archive-item')).toBe(null)

    // 转写结果本身带插入入口:插入的是 draftInput(MessageInput 消费后填充 textarea)
    fireEvent.click(screen.getByTestId('voice-note-insert-current'))
    expect(chatSetState).toHaveBeenCalledWith({ draftInput: '刚说完的一段话' })
  })

  it('读失败:显式喊 errors.loadFailed,不静默兜一张空列表', async () => {
    installBrowserMocks()
    listVoiceNotesMock.mockResolvedValue({ success: false, error: 'backend down' })
    render(<VoiceNote />)
    await act(async () => {})
    fireEvent.click(screen.getByTestId('voice-note-trigger'))
    expect(screen.getByTestId('voice-note-list-error').textContent).toBe('errors.loadFailed')
    expect(screen.queryByTestId('voice-note-archive-item')).toBe(null)
  })

  it('写失败当场回滚乐观行 + errors.saveFailed(不留 renderer-only 假记录)', async () => {
    installBrowserMocks()
    stubListOk()
    mockGetUserMedia.mockResolvedValue({ getTracks: () => [] })
    sttFromBlobMock.mockResolvedValue('存不进去的一段话')
    createVoiceNoteMock.mockResolvedValue({ success: false, error: 'persist down' })

    render(<VoiceNote />)
    fireEvent.click(screen.getByTestId('voice-note-trigger'))
    fireEvent.click(screen.getByTestId('voice-note-start'))
    await act(async () => {})
    fireEvent.click(screen.getByTestId('voice-note-stop'))
    await act(async () => {})

    expect(screen.getByTestId('voice-note-error').textContent).toBe('errors.saveFailed')
    expect(screen.queryByTestId('voice-note-archive-item')).toBe(null)
  })

  it('验收:权限拒绝(getUserMedia NotAllowedError)→ failed + errors.permission 文案', async () => {
    installBrowserMocks()
    stubListOk()
    mockGetUserMedia.mockRejectedValue(
      Object.assign(new Error('denied'), { name: 'NotAllowedError' }),
    )
    render(<VoiceNote />)
    fireEvent.click(screen.getByTestId('voice-note-trigger'))
    fireEvent.click(screen.getByTestId('voice-note-start'))
    await act(async () => {})
    expect(screen.getByTestId('voice-note-phase').getAttribute('data-phase')).toBe('failed')
    expect(screen.getByTestId('voice-note-error').textContent).toBe('errors.permission')
    // 失败不落库:一条没有内容的"笔记"不是笔记
    expect(createVoiceNoteMock).not.toHaveBeenCalled()
  })

  it('降级路径:sttEnabled=false → waitingTranscript 停留 pending,给明确文案,不崩', async () => {
    installBrowserMocks()
    stubListOk()
    mockGetUserMedia.mockResolvedValue({ getTracks: () => [] })
    render(<VoiceNote sttEnabled={false} />)
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

  it('归档闭环:插入对话走 draftInput 既有通道;删除打到服务端出口', async () => {
    installBrowserMocks()
    noteRows.push(serverRow('可插入的笔记文本'))
    stubListOk()
    deleteVoiceNoteMock.mockResolvedValue({ success: true, data: { id: NOTE_ID, deleted: true } })
    render(<VoiceNote />)
    await act(async () => {})
    fireEvent.click(screen.getByTestId('voice-note-trigger'))

    fireEvent.click(screen.getByTestId('voice-note-insert'))
    expect(chatSetState).toHaveBeenCalledWith({ draftInput: '可插入的笔记文本' })

    fireEvent.click(screen.getByTestId('voice-note-archive-delete'))
    expect(deleteVoiceNoteMock).toHaveBeenCalledWith(NOTE_ID)
    // 删除成功后列表里确实没有它了(判"没了"而不是判"调过")
    await act(async () => {})
    expect(screen.queryByTestId('voice-note-archive-item')).toBe(null)
  })

  it('检索:关键词交给服务端(去抖后带 q 重查),列表按服务端行渲染', async () => {
    installBrowserMocks()
    noteRows.push(serverRow('登录页验证码'))
    stubListOk()
    render(<VoiceNote />)
    await act(async () => {})
    fireEvent.click(screen.getByTestId('voice-note-trigger'))
    fireEvent.change(screen.getByTestId('voice-note-search'), { target: { value: '验证码' } })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350))
    })
    expect(listVoiceNotesMock).toHaveBeenLastCalledWith(expect.objectContaining({ q: '验证码' }))
  })

  it('分组:服务端回的分面渲染成档,点档即以 groupKey 重查', async () => {
    installBrowserMocks()
    noteGroups.push({ groupKey: 'lectures', count: 2 })
    noteRows.push(serverRow('可插入的笔记文本'))
    stubListOk()
    render(<VoiceNote />)
    await act(async () => {})
    fireEvent.click(screen.getByTestId('voice-note-trigger'))
    const chip = screen.getByTestId('voice-note-group-chip')
    expect(chip.textContent).toContain('lectures')
    fireEvent.click(chip)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350))
    })
    expect(listVoiceNotesMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ groupKey: 'lectures' }),
    )
  })

  /**
   * 票面②验收原文:「新建→归档→按分组检索→命中,全链路走 @ihui/api-client」。
   * 这一例把四环串起来走一遍,末尾判的是**列表里真看见了那一行**(命中),不是"函数被调过"。
   */
  it('验收②:新建→改分组→归档→切归档分区按分组检索→命中(全程只经 api-client)', async () => {
    installBrowserMocks()
    stubListOk()
    mockGetUserMedia.mockResolvedValue({ getTracks: () => [] })
    sttFromBlobMock.mockResolvedValue('周会要点:Q4 目标')
    createVoiceNoteMock.mockImplementation(
      async (input: { transcript: string | null }): Promise<unknown> => {
        noteRows.push(serverRow(input.transcript))
        return { success: true, data: serverRow(input.transcript) }
      },
    )
    updateVoiceNoteMock.mockImplementation(
      async (id: string, patch: { groupKey?: string }): Promise<unknown> => {
        const row = (noteRows as ServerRow[]).find((item) => item.id === id)
        if (row && patch.groupKey) row.groupKey = patch.groupKey
        return { success: true, data: row }
      },
    )
    setVoiceNoteArchivedMock.mockImplementation(
      async (id: string, archived: boolean): Promise<unknown> => {
        const row = (noteRows as ServerRow[]).find((item) => item.id === id)
        if (row) row.archivedAt = archived ? '2026-10-27T00:00:00.000Z' : null
        return { success: true, data: row }
      },
    )

    render(<VoiceNote />)
    fireEvent.click(screen.getByTestId('voice-note-trigger'))
    fireEvent.click(screen.getByTestId('voice-note-start'))
    await act(async () => {})
    fireEvent.click(screen.getByTestId('voice-note-stop'))
    await act(async () => {})

    // ① 新建:落库后活跃分区看得见这一行
    expect(createVoiceNoteMock).toHaveBeenCalled()
    await act(async () => {})
    expect(screen.getAllByTestId('voice-note-archive-item')).toHaveLength(1)

    // ② 改分组 → lectures(只调 updateVoiceNote,不写任何本地桶)
    fireEvent.click(screen.getByTestId('voice-note-group-set'))
    const groupInput = screen.getByTestId('voice-note-group-input')
    // 角色档 control ⇒ rounded-sm(4px)。这里是门 150 静态判据的运行时锁:
    // 改回裸 `rounded`(8px) 静态门会红,而这条断言保证"渲染出来的类名"也被钉住。
    expect(groupInput.className).toContain('rounded-sm')
    fireEvent.change(groupInput, {
      target: { value: 'lectures' },
    })
    fireEvent.click(screen.getByTestId('voice-note-group-submit'))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350))
    })
    expect(updateVoiceNoteMock).toHaveBeenCalledWith(NOTE_ID, { groupKey: 'lectures' })
    expect(screen.getByTestId('voice-note-group-chip').textContent).toContain('lectures')

    // ③ 归档:走 setVoiceNoteArchived(true),行从活跃分区消失
    fireEvent.click(screen.getByTestId('voice-note-archive-action'))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350))
    })
    expect(setVoiceNoteArchivedMock).toHaveBeenCalledWith(NOTE_ID, true)
    expect(screen.queryByTestId('voice-note-archive-item')).toBe(null)

    // ④ 切归档分区 + 点分组档 → 服务端按 (partition, groupKey) 重查,行命中
    fireEvent.click(screen.getByTestId('voice-note-partition-toggle'))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350))
    })
    expect(listVoiceNotesMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ partition: 'archived' }),
    )
    fireEvent.click(screen.getByTestId('voice-note-group-chip'))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350))
    })
    expect(listVoiceNotesMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ partition: 'archived', groupKey: 'lectures' }),
    )
    expect(screen.getAllByTestId('voice-note-archive-item')).toHaveLength(1)
  })

  it('归档上行失败:乐观摘掉的行当场放回 + errors.saveFailed(不把失败吞成"已归档")', async () => {
    installBrowserMocks()
    noteRows.push(serverRow('归档失败的一条'))
    stubListOk()
    setVoiceNoteArchivedMock.mockResolvedValue({ success: false, error: 'db down' })
    render(<VoiceNote />)
    await act(async () => {})
    fireEvent.click(screen.getByTestId('voice-note-trigger'))

    fireEvent.click(screen.getByTestId('voice-note-archive-action'))
    await act(async () => {})
    expect(screen.getByTestId('voice-note-error').textContent).toBe('errors.saveFailed')
    expect(screen.getAllByTestId('voice-note-archive-item')).toHaveLength(1)
  })

  it('归档分区里可恢复:同一行换成 unarchive 出口,调 setVoiceNoteArchived(id,false)', async () => {
    installBrowserMocks()
    const row = serverRow('已归档的一条')
    row.archivedAt = '2026-10-20T00:00:00.000Z'
    noteRows.push(row)
    stubListOk()
    setVoiceNoteArchivedMock.mockResolvedValue({ success: true, data: row })
    render(<VoiceNote />)
    await act(async () => {})
    fireEvent.click(screen.getByTestId('voice-note-trigger'))

    // 活跃分区看不到已归档行
    expect(screen.queryByTestId('voice-note-archive-item')).toBe(null)
    fireEvent.click(screen.getByTestId('voice-note-partition-toggle'))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350))
    })
    expect(screen.getAllByTestId('voice-note-archive-item')).toHaveLength(1)
    // 归档分区里同位置换成恢复出口(不是再点一次"归档")
    expect(screen.queryByTestId('voice-note-archive-action')).toBe(null)

    fireEvent.click(screen.getByTestId('voice-note-unarchive-action'))
    await act(async () => {})
    expect(setVoiceNoteArchivedMock).toHaveBeenCalledWith(NOTE_ID, false)
  })
})
