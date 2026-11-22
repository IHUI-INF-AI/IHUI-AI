// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('next-intl', async () => {
  // 工厂内自取依赖:vi.mock 会被提到 import 之前执行,引用模块作用域绑定会踩 TDZ
  const { readFileSync: readFile } = await import('node:fs')
  const { dirname: dir, join: cat } = await import('node:path')
  const { fileURLToPath: toPath } = await import('node:url')
  const { formatIcu: renderIcu } = await import('@ihui/i18n')
  const pack = cat(
    dir(toPath(import.meta.url)),
    '../../../../../../packages/i18n/messages/web/zh-CN.json',
  )
  const root = JSON.parse(readFile(pack, 'utf8')) as Record<string, unknown>
  const resolve = (ns: string): Record<string, unknown> | undefined =>
    ns
      .split('.')
      .reduce<Record<string, unknown> | undefined>(
        (node, part) =>
          node && typeof node === 'object' ? (node[part] as Record<string, unknown>) : undefined,
        root,
      )
  return {
    useTranslations:
      (ns: string) =>
      (key: string, values?: Record<string, string | number>): string => {
        const node = resolve(ns)
        const raw = node?.[key]
        if (typeof raw !== 'string' || raw === '') return key
        return renderIcu(raw, values ?? {}, { locale: 'zh-CN' })
      },
  }
})

const { chatStoreSetState } = vi.hoisted(() => ({ chatStoreSetState: vi.fn() }))
vi.mock('@/stores/chat', () => ({
  useChatStore: Object.assign(
    (selector: (s: Record<string, unknown>) => unknown) => selector({}),
    { setState: chatStoreSetState },
  ),
}))

import { ImportSourceBanner } from '../import-source-banner'
import { ImportAnalysisDialog } from '../import-analysis-dialog'
import type { ImportProvenance } from '@ihui/shared/import-analysis'

afterEach(() => {
  cleanup()
  chatStoreSetState.mockClear()
  vi.clearAllMocks()
})

const WECHAT_PROVENANCE: ImportProvenance = {
  source: 'wechat',
  via: 'conversation-import',
  fileName: '合并转发.zip',
  speakers: ['张三', '李四'],
  startedAt: '2026-09-05T00:05:00.000Z',
  endedAt: '2026-09-06T03:00:00.000Z',
}

describe('ImportSourceBanner', () => {
  it('显式说明"来自微信导入" + 文件名(诚实性:这不是你自己跟 AI 聊的会话)', () => {
    render(<ImportSourceBanner provenance={WECHAT_PROVENANCE} />)
    const banner = screen.getByTestId('import-source-banner')
    // 不用 toHaveAttribute:本仓未装 @testing-library/jest-dom,那些 matcher 不可用
    expect(banner.getAttribute('data-source')).toBe('wechat')
    expect(banner.textContent).toContain('来自微信导入')
    expect(banner.textContent).toContain('合并转发.zip')
  })

  it('wechat 展示发言人数与名单', () => {
    render(<ImportSourceBanner provenance={WECHAT_PROVENANCE} />)
    const speakers = screen.getByTestId('import-source-speakers')
    expect(speakers.textContent).toContain('2 位发言人')
    expect(speakers.textContent).toContain('张三')
    expect(speakers.textContent).toContain('李四')
  })

  it('识别不出发言人时改说"这是聊天记录导入",不显示 0 位发言人', () => {
    render(
      <ImportSourceBanner
        provenance={{ ...WECHAT_PROVENANCE, speakers: [], startedAt: null, endedAt: null }}
      />,
    )
    expect(screen.queryByTestId('import-source-speakers')).toBeNull()
    const hint = screen.getByTestId('import-source-no-speaker')
    expect(hint.textContent).toContain('聊天记录导入')
  })

  it('没有真实时间跨度时不渲染该片段(不拿导入时刻冒充记录时间)', () => {
    render(<ImportSourceBanner provenance={{ ...WECHAT_PROVENANCE, endedAt: null }} />)
    expect(screen.queryByTestId('import-source-range')).toBeNull()
  })

  it('有真实时间跨度时展示该片段', () => {
    render(<ImportSourceBanner provenance={WECHAT_PROVENANCE} />)
    expect(screen.getByTestId('import-source-range')).toBeTruthy()
  })

  it('非 wechat 来源不显示发言人/时间(编程会话正文里的冒号不是发言人)', () => {
    render(
      <ImportSourceBanner
        provenance={{
          source: 'claude_code',
          via: 'conversation-import',
          fileName: 'a.jsonl',
          speakers: [],
          startedAt: null,
          endedAt: null,
        }}
      />,
    )
    expect(screen.getByTestId('import-source-banner').textContent).toContain('来自Claude Code导入')
    expect(screen.queryByTestId('import-source-speakers')).toBeNull()
    expect(screen.queryByTestId('import-source-no-speaker')).toBeNull()
  })

  it('compact 模式收起 wechat 明细(移动端/窗格拆分时用)', () => {
    render(<ImportSourceBanner provenance={WECHAT_PROVENANCE} compact />)
    expect(screen.queryByTestId('import-source-speakers')).toBeNull()
    expect(screen.getByTestId('import-source-banner')).toBeTruthy()
  })
})

describe('ImportAnalysisDialog', () => {
  it('未选场景时"发起分析"按钮禁用(不许发一条没有要求的指令)', async () => {
    render(<ImportAnalysisDialog open onOpenChange={() => {}} source="wechat" />)
    await waitFor(() =>
      expect(screen.getAllByTestId('import-analysis-recommended').length).toBeGreaterThan(0),
    )
    expect((screen.getByTestId('import-analysis-submit') as HTMLButtonElement).disabled).toBe(true)
  })

  it('wechat 默认推荐聊天记录类场景(与 codex/claude_code 的编程类不同)', async () => {
    render(<ImportAnalysisDialog open onOpenChange={() => {}} source="wechat" />)
    await waitFor(() =>
      expect(screen.getAllByTestId('import-analysis-recommended').length).toBeGreaterThan(0),
    )
    const ids = screen
      .getAllByTestId('import-analysis-recommended')
      .map((el) => el.getAttribute('data-scenario-id'))
    // 库内 id:062 知识笔记整理 / 058 任务优先级决策 / 163 项目复盘 / 088 投诉话术 / 166 项目沟通
    expect(ids).toEqual(['062', '058', '163', '088', '166'])
  })

  it('codex 来源默认推荐编程会话类场景', async () => {
    render(<ImportAnalysisDialog open onOpenChange={() => {}} source="codex" />)
    await waitFor(() =>
      expect(screen.getAllByTestId('import-analysis-recommended').length).toBeGreaterThan(0),
    )
    const ids = screen
      .getAllByTestId('import-analysis-recommended')
      .map((el) => el.getAttribute('data-scenario-id'))
    // 001 深度代码审查 / 002 代码重构方案 / 003 智能调试助手
    expect(ids).toEqual(['001', '002', '003'])
  })

  it('选中场景后按库的 variables 逐条渲染输入框', async () => {
    render(<ImportAnalysisDialog open onOpenChange={() => {}} source="wechat" />)
    await waitFor(() =>
      expect(screen.getAllByTestId('import-analysis-recommended').length).toBeGreaterThan(0),
    )
    // 062 知识笔记整理的库内变量:raw_info / source / purpose / background
    fireEvent.click(screen.getAllByTestId('import-analysis-recommended')[0]!)
    await waitFor(() => expect(screen.getByTestId('import-analysis-variables')).toBeTruthy())
    expect(screen.getByTestId('import-analysis-var-raw_info')).toBeTruthy()
    expect(screen.getByTestId('import-analysis-var-source')).toBeTruthy()
    expect(screen.getByTestId('import-analysis-var-purpose')).toBeTruthy()
    expect(screen.getByTestId('import-analysis-var-background')).toBeTruthy()
  })

  it('发起分析:写 chat store 待发草稿(draftInput+draftAutoSend)并关闭弹窗', async () => {
    const onOpenChange = vi.fn()
    render(<ImportAnalysisDialog open onOpenChange={onOpenChange} source="wechat" />)
    await waitFor(() =>
      expect(screen.getAllByTestId('import-analysis-recommended').length).toBeGreaterThan(0),
    )
    fireEvent.click(screen.getAllByTestId('import-analysis-recommended')[0]!)
    await waitFor(() =>
      expect((screen.getByTestId('import-analysis-submit') as HTMLButtonElement).disabled).toBe(
        false,
      ),
    )
    fireEvent.click(screen.getByTestId('import-analysis-submit'))
    // 复用既有聊天通道:draftInput + draftAutoSend,不新造 LLM 调用链
    expect(chatStoreSetState).toHaveBeenCalledTimes(1)
    const patch = chatStoreSetState.mock.calls[0]![0] as Record<string, unknown>
    expect(patch.draftAutoSend).toBe(true)
    expect(typeof patch.draftInput).toBe('string')
    expect(patch.draftInput as string).toContain('知识笔记整理')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
