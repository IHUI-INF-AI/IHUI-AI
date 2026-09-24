// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, vi, afterEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * D76 产物归属 turn 与产物面板分型(G-103/G-105,2026-09-24 立)。
 *  - 分型判据四类断言(文档/演示/电子表格/文件)+ 与 D41 SUPPORTED_EXTS 对齐;
 *  - originating turn 派生 + 徽章渲染 + 点击 scrollIntoView(mock);
 *  - step-back/step-forward 多 turn 序列移动 + 首个/末个边界禁用;
 *  - ←/→ 键盘导航用例;
 *  - artifactTurn 词表五语直锁(turn 含 {turn} 插值)。
 */

const WORDS: Record<string, string> = {
  turn: 'TURN_{turn}',
  stepBack: 'WORD_STEP_BACK',
  stepForward: 'WORD_STEP_FORWARD',
  jumpToOrigin: 'WORD_JUMP_ORIGIN',
  kindDocument: 'WORD_DOC',
  kindPresentation: 'WORD_PRES',
  kindSpreadsheet: 'WORD_SHEET',
  kindFile: 'WORD_FILE',
}

vi.mock('next-intl', () => ({
  useTranslations:
    () =>
    (key: string, values?: Record<string, string | number>): string => {
      const word = WORDS[key] ?? key
      return word.replace(/\{(\w+)\}/g, (_m, n: string) => String(values?.[n] ?? ''))
    },
}))

import {
  artifactKindOf,
  assertOfficeExtAlignment,
  collectArtifactTurns,
  ArtifactTurnBadge,
  ArtifactKindBadge,
  ArtifactTurnNav,
  jumpToMessageOrigin,
  emitFocusArtifact,
  SCROLL_TO_MESSAGE_EVENT,
  FOCUS_ARTIFACT_EVENT,
} from '../artifact-turn-badge'
import { SUPPORTED_EXTS } from '../office-preview'

afterEach(cleanup)

// --------------------------------------------------------- 分型判据 ----

describe('artifactKindOf 分型判据(D76/G-105)', () => {
  it('四类判据:docx/md→文档, pptx→演示, xlsx/csv→电子表格, 其余→文件', () => {
    // 文档
    expect(artifactKindOf('报告.docx')).toBe('document')
    expect(artifactKindOf('notes.md')).toBe('document')
    // 演示
    expect(artifactKindOf('deck.pptx')).toBe('presentation')
    // 电子表格
    expect(artifactKindOf('data.xlsx')).toBe('spreadsheet')
    expect(artifactKindOf('table.csv')).toBe('spreadsheet')
    // 其余 → 文件(含无扩展名/图片/URL 查询串/大写扩展名)
    expect(artifactKindOf('shot.png')).toBe('file')
    expect(artifactKindOf('noext')).toBe('file')
    expect(artifactKindOf('/tmp/charts/a.pptx?token=1')).toBe('presentation')
    expect(artifactKindOf('年度表.XLSX')).toBe('spreadsheet')
  })

  it('Office 三型判据与 D41 office-preview SUPPORTED_EXTS 对齐(禁第二套)', () => {
    for (const ext of ['docx', 'xlsx', 'pptx']) {
      expect(SUPPORTED_EXTS.has(ext)).toBe(true)
      expect(artifactKindOf(`a.${ext}`)).not.toBe('file')
    }
    // SUPPORTED_EXTS 只覆盖这三型:其余扩展名不允许混入分型判据
    expect(SUPPORTED_EXTS.size).toBe(3)
    // 模块级对齐守卫:两表漂移时抛错
    expect(() => assertOfficeExtAlignment()).not.toThrow()
  })
})

// --------------------------------------------------------- turn 派生 ----

describe('collectArtifactTurns originating turn 派生(G-103)', () => {
  it('产物归属产生它的 assistant 消息,turn=assistant 序号,无产物轮不出现', () => {
    const messages = [
      { id: 'u1', role: 'user' },
      {
        id: 'a1',
        role: 'assistant',
        toolCalls: [
          {
            summary_data: {
              artifacts: [{ path: '报告.docx' }, { name: 'deck.pptx' }, {} as { path?: string }],
            },
          },
        ],
      },
      { id: 'a2', role: 'assistant' },
      {
        id: 'a3',
        role: 'assistant',
        toolCalls: [{ summary_data: { artifacts: [{ path: 't.csv' }] } }],
      },
    ]
    const turns = collectArtifactTurns(messages)
    expect(turns.length).toBe(2)
    expect(turns[0]).toEqual({
      turn: 1,
      messageId: 'a1',
      artifacts: [
        { path: '报告.docx', kind: 'document' },
        { path: 'deck.pptx', kind: 'presentation' },
      ],
    })
    // a2 无产物不出现,但仍占 turn 序号 → a3 是第 3 轮
    const second = turns[1]
    expect(second?.turn).toBe(3)
    expect(second?.messageId).toBe('a3')
    expect(second?.artifacts[0]?.kind).toBe('spreadsheet')
  })
})

// --------------------------------------------------------- 徽章 ----

describe('ArtifactTurnBadge / ArtifactKindBadge', () => {
  it('徽章渲染"第 N 轮",点击 scrollIntoView 到 [data-message-id] 锚点并派发既有事件', () => {
    render(
      <div>
        <div data-message-id="a1">
          <ArtifactKindBadge nameOrPath="报告.docx" />
        </div>
        <ArtifactTurnBadge turn={3} messageId="a1" />
      </div>,
    )
    const badge = screen.getByTestId('artifact-turn-badge')
    expect(badge.textContent).toContain('TURN_3')
    // 分型徽章:文档型(图标+文案),判据来自扩展名表而非文件名启发式
    const kindBadge = screen.getByTestId('artifact-kind-badge')
    expect(kindBadge.getAttribute('data-kind')).toBe('document')
    expect(kindBadge.textContent).toContain('WORD_DOC')

    const anchor = document.querySelector('[data-message-id="a1"]') as HTMLElement
    const scrollSpy = vi.spyOn(anchor, 'scrollIntoView').mockImplementation(() => {})
    const onScroll = vi.fn()
    window.addEventListener(SCROLL_TO_MESSAGE_EVENT, onScroll)
    fireEvent.click(badge)
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
    expect(onScroll).toHaveBeenCalledTimes(1)
    const detail = (onScroll.mock.calls[0]?.[0] as CustomEvent | undefined)?.detail as
      | { messageId: string }
      | undefined
    expect(detail?.messageId).toBe('a1')
    window.removeEventListener(SCROLL_TO_MESSAGE_EVENT, onScroll)
    scrollSpy.mockRestore()
  })

  it('emitFocusArtifact 派发反向事件(消息侧 → 产物面板)', () => {
    const onFocus = vi.fn()
    window.addEventListener(FOCUS_ARTIFACT_EVENT, onFocus)
    emitFocusArtifact('tmp/artifacts/report.xlsx')
    expect(onFocus).toHaveBeenCalledTimes(1)
    const detail = (onFocus.mock.calls[0]?.[0] as CustomEvent | undefined)?.detail as
      | { path: string }
      | undefined
    expect(detail?.path).toBe('tmp/artifacts/report.xlsx')
    window.removeEventListener(FOCUS_ARTIFACT_EVENT, onFocus)
  })
})

// --------------------------------------------------------- 前后跳导航 ----

interface NavHarnessProps {
  readonly count: number
  readonly initial: number
  readonly onIndexChange?: (next: number) => void
}

function NavHarness({ count, initial, onIndexChange }: NavHarnessProps) {
  const [idx, setIdx] = React.useState(initial)
  return (
    <ArtifactTurnNav
      count={count}
      activeIndex={idx}
      onChangeIndex={(n) => {
        setIdx(n)
        onIndexChange?.(n)
      }}
    />
  )
}

describe('ArtifactTurnNav step-back/step-forward(G-103 ③)', () => {
  it('多 turn 产物序列上逐个移动,首个/末个对应按钮禁用', () => {
    const seq: number[] = []
    render(<NavHarness count={3} initial={0} onIndexChange={(n) => seq.push(n)} />)

    const back = screen.getByTestId('artifact-step-back') as HTMLButtonElement
    const forward = screen.getByTestId('artifact-step-forward') as HTMLButtonElement
    const position = screen.getByTestId('artifact-turn-position')

    // 边界:首个 → step-back 禁用
    expect(back.disabled).toBe(true)
    expect(forward.disabled).toBe(false)
    expect(position.textContent).toBe('1/3')

    fireEvent.click(forward)
    expect(seq).toEqual([1])
    expect(position.textContent).toBe('2/3')

    fireEvent.click(forward)
    expect(seq).toEqual([1, 2])
    // 边界:末个 → step-forward 禁用
    expect(forward.disabled).toBe(true)
    expect(back.disabled).toBe(false)
    expect(position.textContent).toBe('3/3')

    fireEvent.click(back)
    fireEvent.click(back)
    expect(seq).toEqual([1, 2, 1, 0])
    expect(back.disabled).toBe(true)
  })

  it('键盘 ←/→ 在面板聚焦时前后跳,边界不越界,其他键不触发', () => {
    const seq: number[] = []
    render(<NavHarness count={3} initial={1} onIndexChange={(n) => seq.push(n)} />)
    const nav = screen.getByTestId('artifact-turn-nav')

    fireEvent.keyDown(nav, { key: 'ArrowRight' })
    expect(seq).toEqual([2])
    fireEvent.keyDown(nav, { key: 'ArrowLeft' })
    fireEvent.keyDown(nav, { key: 'ArrowLeft' })
    expect(seq).toEqual([2, 1, 0])
    // 首个再按 ←:不越界(无新索引)
    fireEvent.keyDown(nav, { key: 'ArrowLeft' })
    expect(seq).toEqual([2, 1, 0])
    // 非导航键不触发
    fireEvent.keyDown(nav, { key: 'ArrowDown' })
    fireEvent.keyDown(nav, { key: 'Enter' })
    expect(seq).toEqual([2, 1, 0])
  })

  it('导航与产物 turn 序列联动:onIndexChange → jumpToMessageOrigin 滚到对应 assistant 消息', () => {
    const turns = collectArtifactTurns([
      { id: 'u1', role: 'user' },
      {
        id: 'a1',
        role: 'assistant',
        toolCalls: [{ summary_data: { artifacts: [{ path: 'a.docx' }] } }],
      },
      { id: 'a2', role: 'assistant' },
      {
        id: 'a3',
        role: 'assistant',
        toolCalls: [{ summary_data: { artifacts: [{ path: 'b.csv' }] } }],
      },
    ])
    render(
      <div>
        <div data-message-id="a1" />
        <div data-message-id="a3" />
        <NavHarness
          count={turns.length}
          initial={0}
          onIndexChange={(n) => {
            const entry = turns[n]
            if (entry) jumpToMessageOrigin(entry.messageId)
          }}
        />
      </div>,
    )
    const spyA1 = vi.spyOn(document.querySelector('[data-message-id="a1"]') as HTMLElement, 'scrollIntoView').mockImplementation(() => {})
    const spyA3 = vi.spyOn(document.querySelector('[data-message-id="a3"]') as HTMLElement, 'scrollIntoView').mockImplementation(() => {})
    // forward:第 0 个产物 turn(a1)→ 第 1 个(a3,无产物的 a2 被跳过)
    fireEvent.click(screen.getByTestId('artifact-step-forward'))
    expect(spyA3).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
    expect(spyA1).not.toHaveBeenCalled()
    // back:回到 a1
    fireEvent.click(screen.getByTestId('artifact-step-back'))
    expect(spyA1).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
    spyA1.mockRestore()
    spyA3.mockRestore()
  })
})

// --------------------------------------------------------- 词表 ----

const MESSAGES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../../../packages/i18n/messages/web',
)

describe('artifactTurn 词表五语直锁', () => {
  it('五语键齐平,{turn} 插值一个不少', () => {
    const keys = [
      'turn',
      'stepBack',
      'stepForward',
      'jumpToOrigin',
      'kindDocument',
      'kindPresentation',
      'kindSpreadsheet',
      'kindFile',
    ]
    for (const loc of ['en', 'ja', 'ko', 'zh-CN', 'zh-TW']) {
      const j = JSON.parse(readFileSync(path.join(MESSAGES_DIR, `${loc}.json`), 'utf8')) as {
        artifactTurn?: Record<string, unknown>
      }
      const ns = j.artifactTurn
      expect(ns, loc).toBeTruthy()
      for (const k of keys) {
        expect(typeof ns?.[k], `${loc}.${k}`).toBe('string')
      }
      const turn = String(ns?.turn)
      expect(turn.includes('{turn}'), `${loc}: {turn} placeholder`).toBe(true)
      expect(turn.includes('{ turn }')).toBe(false)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
