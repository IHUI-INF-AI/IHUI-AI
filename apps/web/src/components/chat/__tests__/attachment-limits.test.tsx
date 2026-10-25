// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-833 聊天附件三入口(选/拖/贴)三档校验 + "先聚合再报"回归
// 判据唯一源:apps/web/src/hooks/use-message-references.ts(screenAttachmentFiles /
// CHAT_ATTACHMENT_MAX_SIZE_BYTES / CHAT_ATTACHMENT_MAX_FILES)。
// 票面验收:"31 个附件 ⇒ 收到前 30 个并回报被拒 1 个";一次操作多文件被拒只弹**一条**汇总。
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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
      [
        mkFile('edge.pdf', '', CHAT_ATTACHMENT_MAX_SIZE_BYTES),
        mkFile('big.pdf', '', CHAT_ATTACHMENT_MAX_SIZE_BYTES + 1),
      ],
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

  it('G-863 跨批空窗:同帧两批各 25(批间 await 微任务) ⇒ 总收录 30,不超容', async () => {
    // 旧实现 countedBatchRef 在微任务后归零,而 refsRef 要到下一渲染才反映第一批,
    // "微任务后、渲染前"的空窗里第二批按 capacity=30 全收 ⇒ 50>30;
    // 修复后 pendingCommitRef(未落账量)与 refsRef(已反映量)互补,两批总收录钉在 30。
    const { result } = renderHook(() => useMessageReferences())
    const mkBatch = (tag: string) =>
      Array.from({ length: 25 }, (_, i) => mkFile(`${tag}-${i}.png`, 'image/png'))
    await act(async () => {
      result.current.addFileReferences(mkBatch('b1'))
      await Promise.resolve()
      result.current.addFileReferences(mkBatch('b2'))
    })
    expect(result.current.references).toHaveLength(CHAT_ATTACHMENT_MAX_FILES)
  })
})

/** 真实 hook 接线:useMessageReferences + useMessageSend 同挂,供三入口与语音入口复用 */
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

describe('选/拖/贴三入口:拒绝聚合为一条提示(先聚合再报)', () => {
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
      result.current.send.handlePaste(
        pasteEvent([mkFile('a.png', 'image/png'), mkFile('b.png', 'image/png')]),
      )
    })
    expect(toast.warning).not.toHaveBeenCalled()
    expect(result.current.refs.references).toHaveLength(2)
    act(() => {
      result.current.send.handlePaste(
        pasteEvent([
          mkRealFile('huge.png', 'image/png', 51 * MB),
          mkRealFile('fine.png', 'image/png', 1024),
        ]),
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

// G-863 语音入口:webm 恒过扩展名白名单(UPLOADABLE_EXTENSIONS 含 webm),三档里只剩数量档能拦;
// 原实现忽略 addFileReference 返回值 ⇒ 容量满静默失败还 toast"已添加"。
// MessageInput 体量大不整体挂载(仓内惯例,同 d184 消费者测试):行为层用真实 hook 复刻
// 语音回调语义,锚点层静态钉 message-input.tsx 的接线在位且顺序正确(先 guard 后报成功)。
describe('G-863 语音入口:拒绝接同一汇总出口(不再静默)', () => {
  it('行为层:容量满(30/30)再投语音 webm ⇒ addFileReference 返回 max_files,reportAttachmentRejections 弹恰一条 attachRejectCount', () => {
    const { result } = wire()
    act(() => {
      result.current.refs.addFileReferences(
        Array.from({ length: CHAT_ATTACHMENT_MAX_FILES }, (_, i) =>
          mkFile(`v${i}.png`, 'image/png'),
        ),
      )
    })
    expect(result.current.refs.references).toHaveLength(CHAT_ATTACHMENT_MAX_FILES)
    let rejections: ReturnType<typeof screenAttachmentFiles>['rejections'] = []
    act(() => {
      // 复刻语音回调体:Blob 转 File 走统一附件链路,audio/webm 过 accept 档、不过 size 档
      const voiceFile = new File([new Uint8Array(1024)], 'voice-1700000000000.webm', {
        type: 'audio/webm',
      })
      rejections = result.current.refs.addFileReference(voiceFile)
    })
    expect(rejections).toHaveLength(1)
    expect(rejections[0]!.code).toBe('max_files')
    act(() => {
      result.current.send.reportAttachmentRejections(rejections)
    })
    expect(toast.warning).toHaveBeenCalledTimes(1)
    expect(String(vi.mocked(toast.warning).mock.calls[0]![0])).toContain('attachRejectCount')
    expect(result.current.refs.references).toHaveLength(CHAT_ATTACHMENT_MAX_FILES)
  })

  it('行为层反例:未满容量语音文件正常接收 ⇒ 零拒绝零汇总提示(不得反噬成功路径)', () => {
    const { result } = wire()
    let rejections: ReturnType<typeof screenAttachmentFiles>['rejections'] = []
    act(() => {
      rejections = result.current.refs.addFileReference(
        new File([new Uint8Array(1024)], 'voice-ok.webm', { type: 'audio/webm' }),
      )
    })
    expect(rejections).toHaveLength(0)
    expect(result.current.refs.references).toHaveLength(1)
    act(() => {
      result.current.send.reportAttachmentRejections(rejections)
    })
    expect(toast.warning).not.toHaveBeenCalled()
  })

  it('锚点层:message-input.tsx 语音回调接住返回值走 reportAttachmentRejections,成功才 toast voiceRecord.added', () => {
    const host = readFileSync(
      resolve(process.cwd(), 'src/components/chat/message-input.tsx'),
      'utf-8',
    )
    expect(host).toContain('const rejections = addFileReference(file)')
    expect(host).toContain('reportAttachmentRejections(rejections)')
    // 顺序牙齿:拒绝 guard 必须在"已添加"提示之前 —— 摘掉 return 即 added 抢跑回到静默老形态
    const guardIdx = host.indexOf('if (rejections.length > 0)')
    const addedIdx = host.indexOf("toast(t('voiceRecord.added'))")
    expect(guardIdx).toBeGreaterThan(-1)
    expect(addedIdx).toBeGreaterThan(guardIdx)
  })
})

// ── G-863(2026-10-25):容量判定改"提交式"回归 —— 预筛即占位、提交写前 CAS,不再以屏时快照作数 ──
describe('G-863 容量提交式:预筛占位 + 写前 CAS', () => {
  it('同帧两批各 25(预筛后未提交,批间 await)⇒ 第二批只剩 5 个口子,合计收录不超过 30', async () => {
    // 30 为票面口径的字面值(本用例刻意不引生产常量):旧"读屏时快照"实现里第二批按 0 起算
    // ⇒ 两次预筛各收 25、合计 50;预筛占位后第二次只能再放 5。
    const { result } = renderHook(() => useMessageReferences())
    const mkBatch = (tag: string) =>
      Array.from({ length: 25 }, (_, i) => mkFile(`${tag}-${i}.png`, 'image/png'))
    let first: File[] = []
    let second: File[] = []
    let secondRejected = 0
    await act(async () => {
      first = result.current.screenAttachments(mkBatch('c1')).accepted
      await Promise.resolve()
      const screened = result.current.screenAttachments(mkBatch('c2'))
      second = screened.accepted
      secondRejected = screened.rejections.reduce((n, r) => n + r.fileNames.length, 0)
      // 两批都提交:第一批的占位在预筛时即生效,第二批无法再借快照双收
      for (const f of [...first, ...second]) result.current.commitFileReference(f)
    })
    expect(first.length + second.length).toBeLessThanOrEqual(30)
    expect(first.length + second.length).toBe(result.current.references.length)
    expect(secondRejected).toBe(25 - second.length)
  })

  it('未经预筛直接提交 31 个 ⇒ 写前 CAS 只放行 30,第 31 个返回 max_files 且不建 ref', () => {
    const { result } = renderHook(() => useMessageReferences())
    const rejected: ReturnType<typeof screenAttachmentFiles>['rejections'] = []
    act(() => {
      for (let i = 0; i < 31; i += 1) {
        rejected.push(...result.current.commitFileReference(mkFile(`d${i}.png`, 'image/png')))
      }
    })
    expect(result.current.references).toHaveLength(30)
    expect(rejected).toHaveLength(1)
    expect(rejected[0]!.code).toBe('max_files')
    expect(rejected[0]!.fileNames).toEqual(['d30.png'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
