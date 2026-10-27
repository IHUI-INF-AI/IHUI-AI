// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D03 会话内快捷笔记(mobile-rn)—— 移动端行为用例(2026-10-27 立)。
 *
 * 票面验收里 RN 侧真正缺的格子(前两轮只落了「挂载」,这三格是移动端实现的实体):
 * ① completed 相「转写完成即插入当前对话」入口(票③闭环的 RN 腿):此前 RN 端只有
 *    归档行上的「插入对话」,转写完成后**当场**没有插入入口 ⇒ 票③在 RN 端拿不到闭环;
 * ② cancel 事件接线:共享表 recording --cancel--> cancelled 这条边在 RN 从未派发
 *    ⇒ cancelled 相在 RN 端不可达(12 相机在端上少了一相);
 * ③ interrupt 事件接线(票面①型②/④):App 退到后台(后台回收)⇒ 收成 interrupted 终态。
 *    共享层事件词表**无**「回收后复位」出口(见 shared 的矩阵测试第④型),端侧唯一可用
 *    近似就是自己派发 interrupt —— 本文件按此钉,不是各写一份判定。
 *
 * 取材纪律(§22c):相/事件的判据一律走**生产出口**
 * `transitionVoiceNotePhase`(共享层唯一入口),本文件不抄第二份转换表;断言里出现的
 * 相名字面量只用来「读出界面当前处于哪一相」(徽章 testID 后缀),不用于判定迁移是否合法。
 *
 * DOM 口径:RN 的 `testID` 在本仓共享替身里落成小写 `testid` 属性(RTL 的 getByTestId
 * 查的是 `data-testid`,不适用)⇒ 本文件按属性名检索,不用 getByTestId。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, createElement, type ReactNode } from 'react'
import { render } from '@testing-library/react'
import { AppState } from 'react-native'

const mocks = vi.hoisted(() => ({
  listVoiceNotes: vi.fn(),
  createVoiceNote: vi.fn(),
  deleteVoiceNote: vi.fn(),
  // 录音 hook 的替身:本套件只关心「面板怎么派事件、界面落在哪一相」,
  // expo-audio 那层由 tests/use-voice-recorder.test.ts 单独覆盖。
  useVoiceRecorder: vi.fn(),
}))

vi.mock('@ihui/api-client', () => ({
  listVoiceNotes: mocks.listVoiceNotes,
  createVoiceNote: mocks.createVoiceNote,
  deleteVoiceNote: mocks.deleteVoiceNote,
}))

vi.mock('../src/hooks/use-voice-recorder', () => ({
  useVoiceRecorder: mocks.useVoiceRecorder,
}))

import { VoiceNote } from '../src/components/chat/VoiceNote'
import { I18nProvider } from '../src/i18n'

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(I18nProvider, null, children)

/** 按 RN 的 testID(落 DOM 为小写 testid 属性)取元素 */
function byTestId(container: HTMLElement, id: string): HTMLElement | null {
  return container.querySelector(`[testid="${id}"]`)
}

function requireByTestId(container: HTMLElement, id: string): HTMLElement {
  const el = byTestId(container, id)
  if (!el) throw new Error(`找不到 testID=${id} 的元素`)
  return el
}

/** 面板当前处于哪一相:徽章 testID 形如 voice-note-phase-cancelled(相名即后缀) */
function currentPhase(container: HTMLElement): string {
  const badge = container.querySelector('[testid^="voice-note-phase-"]')
  const id = badge?.getAttribute('testid') ?? ''
  return id.startsWith('voice-note-phase-') ? id.slice('voice-note-phase-'.length) : ''
}

/** 替身录音 hook 的默认返回:未录音、未转写 */
function recorderStub(overrides: Record<string, unknown> = {}) {
  return {
    recording: false,
    transcribing: false,
    duration: 0,
    start: vi.fn(),
    stop: vi.fn(),
    cancel: vi.fn(),
    ...overrides,
  }
}

/**
 * 可推进的录音 hook 替身。
 *
 * 组件的相由 dispatch 链推进:start → requestingPermission →(recording 翻真时补发
 * permissionGranted/mediaReady/connected)→ recording ⇒ 替身必须在 `start()` 之后把
 * `recording` 翻真,否则相停在 requestingPermission,cancel / interrupt 两条出边够不着。
 * `recording` 用 getter 读可变状态:组件每次渲染都重新问 hook 要一次当前值。
 */
function makeRecorder(
  onCompleteRef: { current: ((text: string) => void) | null },
  overrides: Record<string, unknown> = {},
) {
  const state = { recording: false }
  const stub = {
    get recording() {
      return state.recording
    },
    transcribing: false,
    duration: 0,
    start: vi.fn(() => {
      state.recording = true
    }),
    stop: vi.fn(),
    cancel: vi.fn(),
    ...overrides,
  }
  mocks.useVoiceRecorder.mockImplementation((opts: { onComplete?: (text: string) => void }) => {
    onCompleteRef.current = opts.onComplete ?? null
    return stub
  })
  return { stub, state }
}

/** 打开面板(单独一次 act:面板是 Modal,点开后才进 DOM) */
function openPanel(container: HTMLElement) {
  act(() => {
    requireByTestId(container, 'voice-note-trigger').click()
  })
}

/** 点「开始录音」把相推到 recording */
function startRecording(container: HTMLElement) {
  act(() => {
    requireByTestId(container, 'voice-note-start').click()
  })
}

/** 点「停止录音」把相推到 waitingTranscript(等待转写结果) */
function stopRecording(container: HTMLElement) {
  act(() => {
    requireByTestId(container, 'voice-note-stop').click()
  })
}

beforeEach(() => {
  mocks.listVoiceNotes.mockResolvedValue({ success: true, data: { list: [], groups: [] } })
  mocks.createVoiceNote.mockResolvedValue({ success: true, data: {} })
  mocks.deleteVoiceNote.mockResolvedValue({ success: true, data: {} })
  mocks.useVoiceRecorder.mockReturnValue(recorderStub())
  ;(AppState as unknown as { __reset: () => void }).__reset()
})

describe('D03 RN 语音笔记:completed 相「转写完成即插入当前对话」', () => {
  it('转写完成后面板出现插入入口,点击把转写文本交给 onInsert(不经服务端归档行)', () => {
    const onInsert = vi.fn()
    const completeRef: { current: ((text: string) => void) | null } = { current: null }
    makeRecorder(completeRef)

    const { container } = render(createElement(VoiceNote, { conversationId: 'conv-1', onInsert }), {
      wrapper,
    })
    openPanel(container)
    startRecording(container)
    // 相序:recording --stop--> stopping --saved--> waitingTranscript --transcriptReady--> completed
    // (shared 12 相机里 transcriptReady 只在 waitingTranscript 上有出边,直接回调转写结果是 no-op)
    stopRecording(container)
    // 触发一次成功转写(hook 契约:非空串 = 转写成功)
    act(() => {
      completeRef.current?.('今天的会议要点')
    })

    const insertBtn = byTestId(container, 'voice-note-insert-current')
    expect(insertBtn, '转写完成后没有插入入口 ⇒ 票③在 RN 端拿不到闭环').toBeTruthy()
    act(() => {
      insertBtn?.click()
    })
    expect(onInsert).toHaveBeenCalledWith('今天的会议要点')
  })

  it('插入入口只在有转写文本时出现(空转写不给出「插空」的按钮)', () => {
    const completeRef: { current: ((text: string) => void) | null } = { current: null }
    makeRecorder(completeRef)
    const { container } = render(createElement(VoiceNote, { onInsert: vi.fn() }), { wrapper })
    openPanel(container)
    startRecording(container)
    stopRecording(container)
    act(() => {
      completeRef.current?.('   ')
    })
    expect(byTestId(container, 'voice-note-insert-current')).toBeNull()
  })
})

describe('D03 RN 语音笔记:cancel 事件接线(共享表 recording --cancel--> cancelled)', () => {
  it('录音中点「取消」⇒ 面板进入 cancelled 相(此前 RN 从不派发 cancel,该相不可达)', () => {
    const completeRef: { current: ((text: string) => void) | null } = { current: null }
    makeRecorder(completeRef)
    const { container } = render(createElement(VoiceNote, { onInsert: vi.fn() }), { wrapper })
    openPanel(container)
    startRecording(container)
    const cancelBtn = byTestId(container, 'voice-note-cancel')
    expect(cancelBtn, '录音中没有取消入口 ⇒ cancelled 相在 RN 端不可达').toBeTruthy()
    act(() => {
      cancelBtn?.click()
    })
    expect(currentPhase(container)).toBe('cancelled')
    // 取消不是「停止」⇒ 不得把这次录音当成待转写/待存盘的东西推出去
    expect(mocks.createVoiceNote).not.toHaveBeenCalled()
  })

  it('取消走 hook 的 cancel 出口(只释放麦克风,不产生转写结果)', () => {
    const completeRef: { current: ((text: string) => void) | null } = { current: null }
    const cancel = vi.fn()
    const stop = vi.fn()
    const { stub } = makeRecorder(completeRef, { cancel, stop })
    const { container } = render(createElement(VoiceNote, { onInsert: vi.fn() }), { wrapper })
    openPanel(container)
    startRecording(container)
    act(() => {
      requireByTestId(container, 'voice-note-cancel').click()
    })
    expect(cancel, '取消没有走 hook 的 cancel 出口').toHaveBeenCalled()
    // stop 会走 STT 上传并回调 onComplete ⇒ 取消绝不能复用它
    expect(stop, '取消复用了 stop ⇒ 被取消的录音仍会走 STT 上传').not.toHaveBeenCalled()
    expect(stub.cancel).toHaveBeenCalled()
    expect(mocks.createVoiceNote).not.toHaveBeenCalled()
  })
})

describe('D03 RN 语音笔记:interrupt 事件接线(票面①型②中途中断/④后台回收)', () => {
  it('录音中 App 退到后台 ⇒ 面板进入 interrupted 相', () => {
    const completeRef: { current: ((text: string) => void) | null } = { current: null }
    makeRecorder(completeRef)
    const { container } = render(createElement(VoiceNote, { onInsert: vi.fn() }), { wrapper })
    openPanel(container)
    startRecording(container)
    act(() => {
      ;(AppState as unknown as { __emit: (s: string) => void }).__emit('background')
    })
    expect(currentPhase(container)).toBe('interrupted')
  })

  it('后台中断同样走 cancel 出口(不产生转写结果、不落库)', () => {
    const completeRef: { current: ((text: string) => void) | null } = { current: null }
    const cancel = vi.fn()
    const stop = vi.fn()
    makeRecorder(completeRef, { cancel, stop })
    const { container } = render(createElement(VoiceNote, { onInsert: vi.fn() }), { wrapper })
    openPanel(container)
    startRecording(container)
    act(() => {
      ;(AppState as unknown as { __emit: (s: string) => void }).__emit('background')
    })
    expect(cancel, '后台中断没有走 hook 的 cancel 出口').toHaveBeenCalled()
    expect(stop, '后台中断复用了 stop ⇒ 仍会走 STT 上传').not.toHaveBeenCalled()
    expect(mocks.createVoiceNote).not.toHaveBeenCalled()
  })

  it('未在录音时退后台不产生中断(空闲相收不到 interrupt)', () => {
    const { container } = render(createElement(VoiceNote, { onInsert: vi.fn() }), { wrapper })
    openPanel(container)
    act(() => {
      ;(AppState as unknown as { __emit: (s: string) => void }).__emit('background')
    })
    // 空闲相(ready)收不到 interrupt(共享表内无该出边)⇒ 相不变、徽章不出现
    expect(currentPhase(container)).toBe('')
  })
})
// ⁠‌‌‌‍‍‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‌‍‌‌‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌**⁠
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
