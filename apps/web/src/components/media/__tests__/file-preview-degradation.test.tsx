// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

import {
  PREVIEW_DEGRADATION_COPY,
  previewCopyText,
  type PreviewCopyKey,
} from '../preview-degradation-copy'

vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => React.createElement('img', { src, alt }),
}))

/**
 * 取词面刻意做成"可切换的两态":
 *  - resolved:新键已在词表里 → 返回可辨识的合成词,断言"有键取键"
 *  - missing :新键尚未入库(今天的真实状态)→ next-intl 抛 MISSING_MESSAGE,
 *            断言界面落内联文案且**绝不喷键名**
 */
const SYNTH_WORDS: Record<string, string> = {
  previewSnapshotBadge: 'WORD_BADGE',
  previewSnapshotReadAt: 'WORD_READAT({time})',
  previewSnapshotNotice: 'WORD_CANNOT_READ',
  previewIncompleteChange: 'WORD_INCOMPLETE',
  previewNoContent: 'WORD_NO_CONTENT',
  previewFileUpdated: 'WORD_UPDATED',
  previewFileUpdatedAction: 'WORD_UPDATED_ACTION',
}
let wordMode: 'resolved' | 'missing' = 'resolved'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string | number>) => {
    if (!key.startsWith('preview')) return key
    if (wordMode === 'missing') throw new Error(`MISSING_MESSAGE: a11y.${key}`)
    const word = SYNTH_WORDS[key] ?? key
    return word.replace('{time}', String(values?.time ?? ''))
  },
}))

import { FilePreview } from '../FilePreview'

interface StubReply {
  readonly ok?: boolean
  readonly text?: string
  readonly etag?: string
  readonly reject?: boolean
}

const fetchCalls: string[] = []

function stubFetch(replies: StubReply[]): typeof fetch {
  const impl = vi.fn(async (input: string | URL, init?: { signal?: AbortSignal | null }) => {
    fetchCalls.push(String(input))
    void init
    const reply = replies.shift() ?? { ok: false }
    if (reply.reject) throw new Error('network down')
    const ok = reply.ok ?? true
    const response = {
      ok,
      status: ok ? 200 : 404,
      headers: { get: () => null },
      text: async () => reply.text ?? '',
    }
    return response as unknown as Response
  })
  vi.stubGlobal('fetch', impl)
  return impl as unknown as typeof fetch
}

/** 重读的真实触发点:标签页重新可见(切走改文件再切回)。 */
async function revalidate(): Promise<void> {
  const before = fetchCalls.length
  document.dispatchEvent(new Event('visibilitychange'))
  await waitFor(() => expect(fetchCalls.length).toBeGreaterThan(before))
}

function recordNotice(): HTMLElement | null {
  return document.querySelector('[data-preview-state="record"]')
}

function expectRecordState(noticeKey: PreviewCopyKey): Promise<void> {
  return waitFor(() => {
    expect(recordNotice()).toBeTruthy()
    expect(document.body.textContent).toContain(SYNTH_WORDS[noticeKey])
    expect(document.body.textContent).toContain(SYNTH_WORDS.previewSnapshotBadge)
  })
}

describe('FilePreview 四级降级(D90 / G-123)', () => {
  beforeEach(() => {
    fetchCalls.length = 0
    wordMode = 'resolved'
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('L1+L2:重读失败时留住已记录内容,并明说看到的是工具记录里的历史快照', async () => {
    stubFetch([{ text: 'RECORDED_BODY' }, { reject: true }])
    render(<FilePreview url="https://example.com/a.txt" type="text" />)
    await waitFor(() => expect(screen.getByText('RECORDED_BODY')).toBeTruthy())
    // 当前内容态:不打快照标识,不拿"历史"话术打扰用户
    expect(document.querySelector('[data-preview-state="current"]')).toBeTruthy()
    expect(recordNotice()).toBeNull()

    await revalidate()
    await expectRecordState('previewSnapshotNotice')

    expect(screen.getByText('WORD_CANNOT_READ')).toBeTruthy()
    expect(recordNotice()?.querySelector('[role="status"]')?.textContent).toBe('WORD_CANNOT_READ')
    // 内容没被抹掉,但状态已改口成"记录",且带读取时刻(防用户误以为是最新)
    expect(screen.getByText('RECORDED_BODY')).toBeTruthy()
    expect(document.querySelector('[data-preview-state="current"]')).toBeNull()
    expect(recordNotice()?.textContent).toMatch(/WORD_READAT\(/)
    // 反向哨兵:不能同时冒出另外两级的话术
    expect(screen.queryByText('WORD_INCOMPLETE')).toBeNull()
    expect(screen.queryByText('WORD_NO_CONTENT')).toBeNull()
  })

  it('L3:重读到 0 字节(这次变更没记全)时保留旧记录并说明不完整', async () => {
    stubFetch([{ text: 'RECORDED_BODY' }, { text: '' }])
    render(<FilePreview url="https://example.com/a.txt" type="text" />)
    await waitFor(() => expect(screen.getByText('RECORDED_BODY')).toBeTruthy())

    await revalidate()
    await expectRecordState('previewIncompleteChange')

    expect(screen.getByText('RECORDED_BODY')).toBeTruthy()
    expect(screen.queryByText('WORD_CANNOT_READ')).toBeNull()
  })

  it('L4:首读就取不到内容时不摆空白框,给"没有可预览内容 + 刷新"这一步动作', async () => {
    const fetchMock = stubFetch([{ reject: true }, { text: 'FRESH_AFTER_RETRY' }])
    render(<FilePreview url="https://example.com/a.txt" type="text" />)
    await waitFor(() => expect(screen.getByText('WORD_NO_CONTENT')).toBeTruthy())
    expect(document.querySelector('[data-preview-state="no-content"]')).toBeTruthy()
    expect(document.querySelector('pre')).toBeNull()
    // 手里没有任何记录,绝不冒充快照态
    expect(screen.queryByText('WORD_BADGE')).toBeNull()

    fireEvent.click(screen.getByText('refresh'))

    await waitFor(() => expect(screen.getByText('FRESH_AFTER_RETRY')).toBeTruthy())
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(recordNotice()).toBeNull()
    expect(screen.queryByText('WORD_NO_CONTENT')).toBeNull()
  })

  it('L4:读到 0 字节的可寻址文件同样落到"没有可预览内容"', async () => {
    stubFetch([{ text: '' }])
    render(<FilePreview url="https://example.com/empty.txt" type="text" />)
    await waitFor(() => expect(screen.getByText('WORD_NO_CONTENT')).toBeTruthy())
    expect(document.querySelector('pre')).toBeNull()
  })

  it('文件已更新:"刷新以查看最新内容"换成最新内容后回到当前态', async () => {
    stubFetch([{ text: 'OLD_BODY' }, { text: 'NEW_BODY' }])
    render(<FilePreview url="https://example.com/a.txt" type="text" />)
    await waitFor(() => expect(screen.getByText('OLD_BODY')).toBeTruthy())

    await revalidate()
    await waitFor(() => expect(screen.getByText('WORD_UPDATED')).toBeTruthy())
    expect(screen.getByText('WORD_UPDATED_ACTION')).toBeTruthy()
    expect(screen.getByText('OLD_BODY')).toBeTruthy() // 未经用户确认不偷换正文

    fireEvent.click(screen.getByText('WORD_UPDATED_ACTION'))
    await waitFor(() => expect(screen.getByText('NEW_BODY')).toBeTruthy())
    expect(screen.queryByText('WORD_UPDATED')).toBeNull()
    expect(document.querySelector('[data-preview-state="current"]')).toBeTruthy()
  })

  it('文件已更新:提示可关闭,关掉后提示条消失但快照标识保留', async () => {
    stubFetch([{ text: 'OLD_BODY' }, { text: 'NEW_BODY' }])
    render(<FilePreview url="https://example.com/a.txt" type="text" />)
    await waitFor(() => expect(screen.getByText('OLD_BODY')).toBeTruthy())
    await revalidate()
    await waitFor(() => expect(screen.getByText('WORD_UPDATED')).toBeTruthy())

    const dismissButton = screen.getByRole('button', { name: 'closeAlert' })
    fireEvent.click(dismissButton)

    await waitFor(() => expect(screen.queryByText('WORD_UPDATED')).toBeNull())
    expect(recordNotice()).toBeTruthy()
    expect(screen.getByText('WORD_BADGE')).toBeTruthy()
    expect(screen.getByText('OLD_BODY')).toBeTruthy()
    // 关闭只收起提示条,绝不"顺手"把未确认的新内容换成当前态
    expect(screen.queryByText('NEW_BODY')).toBeNull()
  })

  it('url 变化后上一文件的记录立即作废,不会冒充新文件的历史快照', async () => {
    stubFetch([{ text: 'FILE_A_BODY' }, { text: 'FILE_B_BODY' }])
    const { rerender } = render(<FilePreview url="https://example.com/a.txt" type="text" />)
    await waitFor(() => expect(screen.getByText('FILE_A_BODY')).toBeTruthy())

    rerender(<FilePreview url="https://example.com/b.txt" type="text" />)

    await waitFor(() => expect(screen.getByText('FILE_B_BODY')).toBeTruthy())
    expect(screen.queryByText('FILE_A_BODY')).toBeNull()
    expect(recordNotice()).toBeNull()
  })

  it('不可寻址资源不发投机请求,直接落到"没有可预览内容"', async () => {
    const fetchMock = stubFetch([])
    render(<FilePreview url="" type="text" />)
    await waitFor(() => expect(screen.getByText('WORD_NO_CONTENT')).toBeTruthy())
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('词表未入库(现状):回落内联文案,界面不出现键名', async () => {
    wordMode = 'missing'
    stubFetch([{ text: 'RECORDED_BODY' }, { reject: true }])
    render(<FilePreview url="https://example.com/a.txt" type="text" />)
    await waitFor(() => expect(screen.getByText('RECORDED_BODY')).toBeTruthy())
    await revalidate()

    await waitFor(() => {
      expect(recordNotice()).toBeTruthy()
      expect(document.body.textContent).toContain(PREVIEW_DEGRADATION_COPY.previewSnapshotNotice.en)
    })
    expect(document.body.textContent).toContain(PREVIEW_DEGRADATION_COPY.previewSnapshotBadge.en)
    for (const key of Object.keys(SYNTH_WORDS)) {
      expect(document.body.textContent).not.toContain(key)
    }
    // 内联兜底句子本身自带"当前文件 / 记录"两个事实,不依赖词表也说得清
    expect(PREVIEW_DEGRADATION_COPY.previewSnapshotNotice.en).toMatch(/current file/i)
    expect(PREVIEW_DEGRADATION_COPY.previewSnapshotNotice.en).toMatch(/record/i)
  })

  it('取词面:有键取键,回显键名/抛错/无 translator 三种失效都走兜底', () => {
    const table = PREVIEW_DEGRADATION_COPY
    expect(previewCopyText(() => 'Tool-recorded content', 'previewSnapshotBadge')).toBe(
      'Tool-recorded content',
    )
    expect(previewCopyText(undefined, 'previewNoContent')).toBe(table.previewNoContent.en)
    expect(previewCopyText(() => 'previewNoContent', 'previewNoContent')).toBe(
      table.previewNoContent.en,
    )
    expect(
      previewCopyText(() => {
        throw new Error('MISSING_MESSAGE: a11y.previewNoContent')
      }, 'previewNoContent'),
    ).toBe(table.previewNoContent.en)
    expect(previewCopyText(() => '', 'previewNoContent')).toBe(table.previewNoContent.en)
    // 词表命中时按 next-intl 的插值结果原样采用(它自己会填 {time})
    expect(
      previewCopyText(
        (_key, values) => `Read at ${String(values?.time ?? '')}`,
        'previewSnapshotReadAt',
        {
          time: '10:20',
        },
      ),
    ).toBe('Read at 10:20')
    // 缺词时兜底表自己插值,不把占位符喷给用户
    expect(previewCopyText(undefined, 'previewSnapshotReadAt', { time: '10:20' })).toBe(
      'Read at 10:20',
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
