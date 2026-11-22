// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// D115(G-229)审查卡展示面用例(2026-10-24 立):
// ① 帧到端后按严重度分组:组序恒 P1 → P2 → Nit,空档不渲染,组内保持到达顺序;
// ② 行号可跳(jsdom):点 finding ⇒ 复用 IDE 出口(openFile + setActiveTopTab('editor')),
//    并调用编辑器揭示入口 revealAt(`文件:行`,line>0 才调);文案是 `文件:行`;
//    line=0(整文件级)只显示文件、不补假行号、也不揭示。
// ③ 无 finding ⇒ 整卡不渲染(不占位)。
// 与 turn-changes-card / file-chips 同纪律:喂真 store,不 mock 组件本身。
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ReviewFindingsCard,
  reviewFindingLocation,
  type ReviewFinding,
} from '@/components/chat/message-list/review-findings-card'
import { useIDEWorkspace } from '@/stores/ide-workspace'

function finding(overrides: Partial<ReviewFinding> & { findingId: string }): ReviewFinding {
  return {
    type: 'review-finding',
    index: 1,
    total: 1,
    severity: 'P1',
    file: 'src/a.ts',
    line: 42,
    title: 'finding',
    detail: '',
    suggestion: '',
    ...overrides,
  }
}

const FINDINGS: ReviewFinding[] = [
  finding({ findingId: 'rf-1', severity: 'P2', index: 1, total: 4, file: 'src/p2.ts', line: 7 }),
  finding({ findingId: 'rf-2', severity: 'P1', index: 2, total: 4, file: 'src/a.ts', line: 42 }),
  finding({
    findingId: 'rf-3',
    severity: 'Nit',
    index: 3,
    total: 4,
    file: 'src/c.ts',
    line: 0,
    title: '整文件级',
  }),
  finding({ findingId: 'rf-4', severity: 'P1', index: 4, total: 4, file: 'src/b.ts', line: 9 }),
]

beforeEach(() => {
  useIDEWorkspace.setState({
    openFile: vi.fn(),
    setActiveTopTab: vi.fn(),
    revealAt: vi.fn(),
  })
})

afterEach(() => {
  cleanup()
})

describe('ReviewFindingsCard 按严重度分组(D115)', () => {
  it('组序 P1 → P2 → Nit,组内保持到达顺序,空档不渲染', () => {
    render(<ReviewFindingsCard findings={FINDINGS} />)
    const card = screen.getByTestId('review-findings-card')
    const groups = Array.from(card.querySelectorAll('section[data-severity]'))
    expect(groups.map((g) => g.getAttribute('data-severity'))).toEqual(['P1', 'P2', 'Nit'])
    const p1 = screen.getByTestId('review-group-P1')
    expect(
      Array.from(p1.querySelectorAll('[data-testid^="review-finding-"]')).map((el) =>
        el.getAttribute('data-testid'),
      ),
    ).toEqual(['review-finding-rf-2', 'review-finding-rf-4'])
    expect(p1.textContent).toContain('2')
  })

  it('未出现的档位不渲染空组', () => {
    render(<ReviewFindingsCard findings={[FINDINGS[1]!]} />)
    expect(screen.getByTestId('review-group-P1')).toBeTruthy()
    expect(screen.queryByTestId('review-group-P2')).toBeNull()
    expect(screen.queryByTestId('review-group-Nit')).toBeNull()
  })

  it('行号可跳:点击复用 IDE 出口,文案为 文件:行', () => {
    render(<ReviewFindingsCard findings={FINDINGS} />)
    const row = screen.getByTestId('review-finding-rf-2')
    expect(row.getAttribute('aria-label')).toBe('src/a.ts:42')
    expect(row.textContent).toContain('src/a.ts:42')
    row.click()
    const state = useIDEWorkspace.getState()
    expect(state.openFile).toHaveBeenCalledTimes(1)
    expect(state.openFile).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'src/a.ts', path: 'src/a.ts', type: 'file' }),
    )
    expect(state.setActiveTopTab).toHaveBeenCalledWith('editor')
    // line>0:打开文件后再揭示到行(同一跳转通道的第二步)
    expect(state.revealAt).toHaveBeenCalledTimes(1)
    expect(state.revealAt).toHaveBeenCalledWith('src/a.ts', 42, 1)
  })

  it('line=0 是整文件级:只显示文件、不补假行号,点击仍可打开文件', () => {
    render(<ReviewFindingsCard findings={[FINDINGS[2]!]} />)
    expect(reviewFindingLocation(FINDINGS[2]!)).toBe('src/c.ts')
    const row = screen.getByTestId('review-finding-rf-3')
    expect(row.getAttribute('aria-label')).toBe('src/c.ts')
    expect(row.textContent).not.toContain('src/c.ts:0')
    row.click()
    expect(useIDEWorkspace.getState().openFile).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'src/c.ts' }),
    )
    // 整文件级不揭示到行(不补假行号)
    expect(useIDEWorkspace.getState().revealAt).not.toHaveBeenCalled()
  })

  it('无 finding ⇒ 整卡不渲染', () => {
    const { container } = render(<ReviewFindingsCard findings={[]} />)
    expect(container.firstChild).toBeNull()
    expect(screen.queryByTestId('review-findings-card')).toBeNull()
  })
})
