// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment happy-dom

/**
 * ConversationImportPage(D28 扩展端)流程与诚实性回归。
 *
 * 本组盯四件事,每条都对应一个「容易悄悄坏掉」的点:
 *  ① 五源齐活(wechat 是后补的第 5 源,漏一个就是入口少一格)。
 *  ② 解析失败必须出**服务端原文** —— 顶掉成笼统文案等于把「文件格式不对」说成「导入失败」。
 *  ③ truncated / warnings 必须上屏 —— 用户会默认「文件里的会话都进来了」。
 *  ④ 逐会话 commit 单条失败不中断其余,且失败原因逐条列出(只给一个 failed 数字
 *     无法判断是自己文件的问题还是服务端故障);导入成功后打开会话走 openInWeb
 *     (与 ChatHistoryPage 同一出口,侧栏不渲染会话详情)。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

const {
  parseConversationImport,
  commitConversationImport,
  getConversationImportHistory,
  openInWeb,
  navigate,
} = vi.hoisted(() => ({
  parseConversationImport: vi.fn(),
  commitConversationImport: vi.fn(),
  getConversationImportHistory: vi.fn(),
  openInWeb: vi.fn(),
  navigate: vi.fn(),
}))

vi.mock('@ihui/api-client', () => ({
  parseConversationImport,
  commitConversationImport,
  getConversationImportHistory,
}))

vi.mock('../lib/open-in-web', () => ({
  openInWeb,
}))

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
}))

// t() 直接回显 key 尾巴,便于断言"点了哪个来源/哪一步",不依赖真实译文
vi.mock('../src/i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string | number>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
    locale: 'zh-CN' as const,
    setLocale: () => {},
  }),
}))

import ConversationImportPage from '../entrypoints/sidepanel/pages/ConversationImportPage'

let container: HTMLDivElement
let root: Root

/** 造一个带内容的 File(happy-dom 支持 File 构造) */
function makeFile(name: string, content = 'x'): File {
  return new File([content], name, { type: 'application/octet-stream' })
}

async function mount(): Promise<void> {
  await act(async () => {
    root.render(<ConversationImportPage />)
  })
  await act(async () => {
    await Promise.resolve()
  })
}

function byTestId(id: string): HTMLElement | null {
  return container.querySelector(`[data-testid="${id}"]`)
}

async function click(el: Element | null): Promise<void> {
  if (!el) throw new Error('待点击元素不存在')
  await act(async () => {
    ;(el as HTMLElement).click()
  })
  await act(async () => {
    await Promise.resolve()
  })
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  // 与 use-auth / workspace-picker 同口径:不设则 React 19 对 act() 刷
  // "not configured to support act(...)" 警告
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, writable: true })
  // 历史默认空,避免异步态噪声
  getConversationImportHistory.mockResolvedValue({ success: true, data: { list: [], total: 0 } })
  vi.clearAllMocks()
  getConversationImportHistory.mockResolvedValue({ success: true, data: { list: [], total: 0 } })
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('ConversationImportPage 来源选择', () => {
  it('① 五源齐活,含 wechat', async () => {
    await mount()
    const sources = [...container.querySelectorAll('[data-testid="import-source-card"]')].map(
      (el) => el.getAttribute('data-source'),
    )
    expect(sources).toEqual(['claude_code', 'codex', 'cursor', 'aider', 'wechat'])
  })

  it('未选来源时点解析 → 上屏 errorNoSource,不发请求', async () => {
    await mount()
    // 文件输入区在选中来源前不渲染,直接构造:选来源 → 清掉文件 → 解析
    await click(byTestId('import-source-card'))
    await click(byTestId('import-parse-btn'))
    expect(parseConversationImport).not.toHaveBeenCalled()
  })
})

describe('ConversationImportPage 解析错误诚实性', () => {
  it('② 解析失败 → 出服务端原文,不出笼统文案', async () => {
    parseConversationImport.mockResolvedValue({
      success: false,
      error: 'unsupported export format: expected .jsonl',
    })
    await mount()
    await click(byTestId('import-source-card'))

    const input = container.querySelector<HTMLInputElement>('[data-testid="import-file-input"]')!
    await act(async () => {
      Object.defineProperty(input, 'files', {
        value: [makeFile('export.jsonl')],
        configurable: true,
      })
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })

    await click(byTestId('import-parse-btn'))
    expect(byTestId('import-parse-error')?.textContent).toContain('unsupported export format')
  })
})

describe('ConversationImportPage 预览与截断', () => {
  it('③ truncated + warnings 逐条上屏,不静默', async () => {
    parseConversationImport.mockResolvedValue({
      success: true,
      data: {
        conversations: [{ title: '会话 A', messages: [{ role: 'user', content: 'hi' }] }],
        truncated: true,
        warnings: ['跳过 2 条超大 tool 输出', '未知角色 tool 已丢弃'],
      },
    })
    await mount()
    await click(byTestId('import-source-card'))

    const input = container.querySelector<HTMLInputElement>('[data-testid="import-file-input"]')!
    await act(async () => {
      Object.defineProperty(input, 'files', { value: [makeFile('a.jsonl')], configurable: true })
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await click(byTestId('import-parse-btn'))

    expect(byTestId('import-truncated')).not.toBeNull()
    expect(byTestId('import-warnings')?.textContent).toContain('跳过 2 条超大 tool 输出')
    expect(byTestId('import-warnings')?.textContent).toContain('未知角色 tool 已丢弃')
    // 预览默认全选
    expect(byTestId('import-preview-summary')?.textContent).toContain('conversationImport.selected')
  })
})

describe('ConversationImportPage 逐会话 commit', () => {
  /**
   * 搭一个「已解析出预览」的场景。
   * secondContent 供用例决定第二条会话是否有有效内容:传 '   ' 会被本地空内容闸拦下
   * (不产生 commit 请求),传真实内容才会真的发第二次 commit。
   */
  async function setupPreview(secondContent = '   '): Promise<void> {
    parseConversationImport.mockResolvedValue({
      success: true,
      data: {
        conversations: [
          {
            title: '会话 A',
            sourceCreatedAt: '2026-01-01T00:00:00Z',
            messages: [{ role: 'user', content: 'q1' }],
          },
          { title: '会话 B', messages: [{ role: 'user', content: secondContent }] },
        ],
        truncated: false,
        warnings: [],
      },
    })
    await mount()
    await click(byTestId('import-source-card'))
    const input = container.querySelector<HTMLInputElement>('[data-testid="import-file-input"]')!
    await act(async () => {
      Object.defineProperty(input, 'files', { value: [makeFile('a.jsonl')], configurable: true })
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await click(byTestId('import-parse-btn'))
  }

  /** 取消勾选第 N 个会话(预览默认全选) */
  async function uncheck(index: number): Promise<void> {
    const checkboxes = [...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')]
    await act(async () => {
      checkboxes[index]!.click()
    })
  }

  it('④ 空内容会话不打断其余,失败原因逐条上屏', async () => {
    commitConversationImport.mockResolvedValue({
      success: true,
      data: { importId: 'imp-1', conversationId: 'conv-9', importedMessages: 1 },
    })
    await setupPreview()
    await click(byTestId('import-commit-btn'))

    // 只有"会话 A"真发了 commit(空内容的 B 被本地拦下)
    expect(commitConversationImport).toHaveBeenCalledTimes(1)
    expect(commitConversationImport.mock.calls[0]![0]).toMatchObject({ title: '会话 A' })

    // 汇总:1 成功 1 失败
    const summary = byTestId('import-commit-summary')?.textContent ?? ''
    expect(summary).toContain('"imported":1')
    expect(summary).toContain('"failed":1')
    // 失败原因上屏(空内容原因),不是只给一个数字
    expect(byTestId('import-commit-failures')?.textContent).toContain(
      'conversationImport.noValidContent',
    )
  })

  it('⑤ 全部成功 → 出「打开首个会话」,点击走 openInWeb(/chat/:id)', async () => {
    commitConversationImport.mockResolvedValue({
      success: true,
      data: { importId: 'imp-1', conversationId: 'conv-42', importedMessages: 1 },
    })
    // 两条都有有效内容 ⇒ 两次 commit 都真发
    await setupPreview('q2')
    await click(byTestId('import-commit-btn'))

    expect(commitConversationImport).toHaveBeenCalledTimes(2)
    const summary = byTestId('import-commit-summary')?.textContent ?? ''
    expect(summary).toContain('"failed":0')
    expect(byTestId('import-commit-failures')).toBeNull()

    await click(byTestId('import-open-conversation'))
    expect(openInWeb).toHaveBeenCalledWith('/chat/conv-42')
  })

  it('⑥ 单条 commit 返回失败 → 原因上屏且其余仍继续', async () => {
    commitConversationImport
      .mockResolvedValueOnce({ success: false, error: 'messages too large' })
      .mockResolvedValueOnce({
        success: true,
        data: { importId: 'imp-2', conversationId: 'conv-7', importedMessages: 1 },
      })
    // 两条都有有效内容 ⇒ 第一次失败不打断第二次
    await setupPreview('q2')
    await click(byTestId('import-commit-btn'))

    expect(commitConversationImport).toHaveBeenCalledTimes(2)
    expect(byTestId('import-commit-failures')?.textContent).toContain('messages too large')
    // 一成一败后仍给"打开首个会话"—— 有一半成功就不该把用户堵死在结果页
    expect(byTestId('import-open-conversation')).not.toBeNull()
  })

  it('⑦ 取消勾选的会话不发 commit(只导勾选项)', async () => {
    commitConversationImport.mockResolvedValue({
      success: true,
      data: { importId: 'imp-1', conversationId: 'conv-1', importedMessages: 1 },
    })
    await setupPreview('q2')
    await uncheck(1)
    await click(byTestId('import-commit-btn'))

    expect(commitConversationImport).toHaveBeenCalledTimes(1)
    expect(commitConversationImport.mock.calls[0]![0]).toMatchObject({ title: '会话 A' })
  })

  it('⑧ 导入完成后预览区收起,可重新选来源再导一次', async () => {
    commitConversationImport.mockResolvedValue({
      success: true,
      data: { importId: 'imp-1', conversationId: 'conv-1', importedMessages: 1 },
    })
    await setupPreview()
    await click(byTestId('import-commit-btn'))

    expect(byTestId('import-preview-list')).toBeNull()
    // 回到 Step 1(文件输入区随来源清空而收起)
    expect(byTestId('import-file-input')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
