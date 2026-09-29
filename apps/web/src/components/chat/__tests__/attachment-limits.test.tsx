// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-833 聊天附件三入口(选/拖/贴)三档校验 + "先聚合再报"回归
// 判据唯一源:apps/web/src/hooks/use-message-references.ts(screenAttachmentFiles /
// CHAT_ATTACHMENT_MAX_SIZE_BYTES / CHAT_ATTACHMENT_MAX_FILES)。
// 票面验收:"31 个附件 ⇒ 收到前 30 个并回报被拒 1 个";一次操作多文件被拒只弹**一条**汇总。
import { act, renderHook } from '@testing-library/react'
import type * as React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  CHAT_ATTACHMENT_MAX_FILES,
  CHAT_ATTACHMENT_MAX_SIZE_BYTES,
  screenAttachmentFiles,
  useMessageReferences,
} from '@/hooks/use-message-references'
import { useMessageSend } from '@/hooks/use-message-send'
import { toast } from '@/components/common'

// ── mock 面(重依赖全部替换为最小桩,判据本身保持真实) ──
vi.mock('@/lib/api', () => ({
  fetchApi: vi.fn(async () => ({ success: false, error: 'mock-offline' })),
}))
vi.mock('@/components/common', async () => {
  const { vi: vitestVi } = await import('vitest')
  const fn = vitestVi.fn()
  const toastMock = Object.assign(fn, {
    warning: vitestVi.fn(),
    error: vitestVi.fn(),
    info: vitestVi.fn(),
    success: vitestVi.fn(),
  })
  return { toast: toastMock }
})
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}|${JSON.stringify(values)}` : key,
}))
vi.mock('@ihui/api-client', () => ({ steerChatStream: vi.fn() }))
vi.mock('@/stores/chat', () => ({
  useChatStore: {
    getState: () => ({
      quotedMessage: null,
      setQuotedMessage: vi.fn(),
      conversationId: null,
      streamingAssistantId: null,
      enqueueSideQuestion: vi.fn(),
    }),
  },
}))
vi.mock('@/hooks/use-analytics', () => ({ useAnalytics: () => ({ track: vi.fn() }) }))
vi.mock('@/hooks/use-chat/slash-commands', () => ({
  answerSideQuestion: vi.fn(),
  tryHandleSideSlash: () => ({ handled: false }),
}))
vi.mock('@/config/downloads.config', () => ({ formatFileSize: (n: number) => `${n}B` }))

function mkFile(name: string, type: string, sizeBytes = 1024): File {
  const f = new File([new Uint8Array(0)], name, { type })
  // happy-dom 的 File 长度只读,用 defineProperty 覆盖 size 以满足档位断言
  // ⚠️ 仅限"文件对象直达判据"的用例;粘贴入口会 new File([blob]) 重包装而丢失伪 size,
  //    那条路径必须用 mkRealFile 真实分配字节。
  Object.defineProperty(f, 'size', { value: sizeBytes })
  return f
}

/** 真实内容分配(经任意重包装后 size 不变) —— 供 handlePaste 路径使用 */
function mkRealFile(name: string, type: string, sizeBytes: number): File {
  return new File([new Uint8Array(sizeBytes)], name, { type })
}

const MB = 1024 * 1024

beforeEach(() => {
  vi.clearAllMocks()
  // objectURL 在 happy-dom/jsdom 下均可能缺真实现:统一桩,断言不依赖其返回值
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:mock/${Math.random()}`)
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
})

describe('screenAttachmentFiles 三档判据(纯函数)', () => {
  it('数量档:31 个合规文件、当前 0 引用 ⇒ 收前 30,回报 max_files 恰 1 个被拒(票面验收)', () => {
    const files = Array.from({ length: 31 }, (_, i) => mkFile(`p${i}.png`, 'image/png'))
    const { accepted, rejections } = screenAttachmentFiles(files, 0)
    expect(accepted).toHaveLength(CHAT_ATTACHMENT_MAX_FILES)
    expect(rejections).toHaveLength(1)
    expect(rejections[0]!.code).toBe('max_files')
    expect(rejections[0]!.fileNames).toHaveLength(1)
  })

  it('类型档:白名单外扩展名被拒且**不静默**(code=accept);扩展名白名单内即使 MIME 为空也放行', () => {
    const { accepted, rejections } = screenAttachmentFiles(
      [mkFile('tool.exe', 'application/octet-stream'), mkFile('note.pdf', '')],
      0,
    )
    expect(accepted.map((f) => f.name)).toEqual(['note.pdf'])
    expect(rejections).toHaveLength(1)
    expect(rejections[0]!.code).toBe('accept')
    expect(rejections[0]!.fileNames).toEqual(['tool.exe'])
  })

  it('大小档:边界同侧律 —— 恰等于上限放行,上限+1 拒绝(code=max_file_size)', () => {
    const { accepted, rejections } = screenAttachmentFiles(
      [mkFile('edge.pdf', '', CHAT_ATTACHMENT_MAX_SIZE_BYTES), mkFile('big.pdf', '', CHAT_ATTACHMENT_MAX_SIZE_BYTES + 1)],
      0,
    )
    expect(accepted.map((f) => f.name)).toEqual(['edge.pdf'])
    expect(rejections).toHaveLength(1)
    expect(rejections[0]!.code).toBe('max_file_size')
    expect(rejections[0]!.fileNames).toEqual(['big.pdf'])
  })

  it('聚合维度:同一 code 的多文件合成**一个** rejection 条目(两个 .exe ⇒ 1 条 2 名)', () => {
    const { rejections } = screenAttachmentFiles(
      [mkFile('a.exe', ''), mkFile('b.exe', ''), mkFile('ok.md', '')],
      0,
    )
    expect(rejections).toHaveLength(1)
    expect(rejections[0]!.fileNames).toEqual(['a.exe', 'b.exe'])
  })

  it('容量随当前引用数收缩:已有 29 个时再来 2 个 ⇒ 只收 1 个并回报 1 个 max_files', () => {
    const { accepted, rejections } = screenAttachmentFiles(
      [mkFile('x.md', ''), mkFile('y.md', '')],
      CHAT_ATTACHMENT_MAX_FILES - 1,
    )
    expect(accepted).toHaveLength(1)
    expect(rejections[0]!.code).toBe('max_files')
  })

  it('三档混合批次:按 类型→大小→数量 顺序各归各码,互不吞并', () => {
    const files = [
      mkFile('bad.exe', ''),
      mkFile('huge.pdf', '', CHAT_ATTACHMENT_MAX_SIZE_BYTES + 1),
      mkFile('ok1.md', ''),
      mkFile('ok2.md', ''),
    ]
    const { accepted, rejections } = screenAttachmentFiles(files, 0)
    expect(accepted.map((f) => f.name)).toEqual(['ok1.md', 'ok2.md'])
    expect(rejections.map((r) => r.code).sort()).toEqual(['accept', 'max_file_size'])
  })
})

describe('useMessageReferences.addFileReferences(批量入口结构化回报)', () => {
  it('31 个 png ⇒ references 收 30,返回 rejections 恰报 1 个 max_files(不再静默丢弃)', () => {
    const { result } = renderHook(() => useMessageReferences())
    const files = Array.from({ length: 31 }, (_, i) => mkFile(`i${i}.png`, 'image/png'))
    let rejections: ReturnType<typeof screenAttachmentFiles>['rejections'] = []
    act(() => {
      rejections = result.current.addFileReferences(files)
    })
    expect(result.current.references).toHaveLength(CHAT_ATTACHMENT_MAX_FILES)
    expect(rejections).toHaveLength(1)
    expect(rejections[0]!.code).toBe('max_files')
  })

  it('类型不符:原静默 return 已废除 —— 返回 accept 拒绝且 references 不变', () => {
    const { result } = renderHook(() => useMessageReferences())
    let rejections: ReturnType<typeof screenAttachmentFiles>['rejections'] = []
    act(() => {
      rejections = result.current.addFileReference(mkFile('sh.exe', ''))
    })
    expect(rejections[0]?.code).toBe('accept')
    expect(result.current.references).toHaveLength(0)
  })
})

describe('选/拖/贴三入口:拒绝聚合为一条提示(先聚合再报)', () => {
  function wire() {
    return renderHook(() => {
      const refs = useMessageReferences()
      const send = useMessageSend({
        value: '',
        setValue: () => {},
        isStreaming: false,
        isHighRisk: false,
        references: refs.references,
        resetReferences: refs.resetReferences,
        addFileReference: refs.addFileReference as unknown as (file: File) => void,
        addFileReferences: refs.addFileReferences,
        screenAttachments: refs.screenAttachments,
        commitFileReference: refs.commitFileReference,
        addTextReference: refs.addTextReference,
        onSend: () => true,
        inputCoreRef: { current: null },
        draftKey: 'g833-test',
      })
      return { refs, send }
    })
  }

  it('选择入口(change):31 png + 2 exe ⇒ toast.warning 恰一条(含两档 code),收 30 个', () => {
    const { result } = wire()
    act(() => {
      result.current.send.handleFileInputChange({
        target: {
          files: [
            ...Array.from({ length: 31 }, (_, i) => mkFile(`s${i}.png`, 'image/png')),
            mkFile('a.exe', ''),
            mkFile('b.exe', ''),
          ],
          value: '',
        },
      } as unknown as React.ChangeEvent<HTMLInputElement>)
    })
    expect(result.current.refs.references).toHaveLength(CHAT_ATTACHMENT_MAX_FILES)
    expect(toast.warning).toHaveBeenCalledTimes(1)
    const msg = String(vi.mocked(toast.warning).mock.calls[0]![0])
    expect(msg).toContain('attachRejectType')
    expect(msg).toContain('attachRejectCount')
  })

  it('拖拽入口(drop):单个类型外文件 ⇒ 一条 attachRejectType,不逐文件弹', () => {
    const { result } = wire()
    act(() => {
      result.current.send.handleDrop({
        preventDefault: vi.fn(),
        dataTransfer: { files: [mkFile('nope.bin', 'application/octet-stream')] },
      } as unknown as React.DragEvent<HTMLDivElement>)
    })
    expect(toast.warning).toHaveBeenCalledTimes(1)
    expect(String(vi.mocked(toast.warning).mock.calls[0]![0])).toContain('attachRejectType')
    expect(result.current.refs.references).toHaveLength(0)
  })

  it('粘贴入口(paste):两张正常图 ⇒ 零拒绝零提示;含一张超限图 ⇒ 恰一条 attachRejectSize', () => {
    const { result } = wire()
    const pasteEvent = (files: File[]) =>
      ({
        preventDefault: vi.fn(),
        clipboardData: {
          items: files.map((f) => ({
            kind: 'file',
            type: f.type,
            getAsFile: () => f,
          })),
          getData: () => '',
        },
      }) as unknown as React.ClipboardEvent<HTMLTextAreaElement>
    act(() => {
      result.current.send.handlePaste(pasteEvent([mkFile('a.png', 'image/png'), mkFile('b.png', 'image/png')]))
    })
    expect(toast.warning).not.toHaveBeenCalled()
    expect(result.current.refs.references).toHaveLength(2)
    act(() => {
      result.current.send.handlePaste(
        pasteEvent([mkRealFile('huge.png', 'image/png', 51 * MB), mkRealFile('fine.png', 'image/png', 1024)]),
      )
    })
    expect(toast.warning).toHaveBeenCalledTimes(1)
    expect(String(vi.mocked(toast.warning).mock.calls[0]![0])).toContain('attachRejectSize')
  })

  it('全部合规批次:零拒绝 ⇒ 不弹任何提示(校验不得反噬正常路径)', () => {
    const { result } = wire()
    act(() => {
      result.current.send.handleFileInputChange({
        target: { files: [mkFile('ok.pdf', ''), mkFile('ok2.mp4', 'video/mp4')], value: '' },
      } as unknown as React.ChangeEvent<HTMLInputElement>)
    })
    expect(toast.warning).not.toHaveBeenCalled()
    expect(result.current.refs.references).toHaveLength(2)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
