// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 编辑器内预测式编辑建议条单测(Trae CUE 对齐,2026-10-31)。
 *
 * 钉住的行为:
 * ① 建议条呈现 N 处变更 + 逐条 checkbox 默认全选;
 * ② 取消部分勾选后「应用所选」回调只带勾选集(逐条选择性应用 = 超越 Trae
 *    all/line/word 三档粒度的判据);
 * ③ hover 条目上报预览索引,离开回 null(悬停即预览);
 * ④ 关闭钮触发 onDismiss;
 * ⑤ 容器带 role="status" + aria-live(H27 无障碍四件套的读屏播报面)。
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'

import { EditIntentBar } from '@/components/editor/edit-intent-bar'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values && 'count' in values ? `${key}(${String(values.count)})` : key,
}))

const PREDICTION = {
  document: 'const a = 1\nconst b = 2\n',
  actions: [
    { kind: 'replace' as const, start: 6, end: 7, text: '2', anchor: '1' },
    { kind: 'insert' as const, start: 21, end: 21, text: '\nconst c = 3' },
  ],
  model: 'm1',
  latencyMs: 120,
}

function setup() {
  const onApplySelected = vi.fn()
  const onDismiss = vi.fn()
  const onPreviewIndexChange = vi.fn()
  render(
    <EditIntentBar
      prediction={PREDICTION}
      onApplySelected={onApplySelected}
      onDismiss={onDismiss}
      onPreviewIndexChange={onPreviewIndexChange}
    />,
  )
  return { onApplySelected, onDismiss, onPreviewIndexChange }
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('EditIntentBar — 编辑器内预测建议条', () => {
  it('呈现变更计数与逐条 checkbox,默认全选', () => {
    setup()
    expect(screen.getByTestId('editor-edit-intent-bar').textContent).toContain(
      'predictiveEditChanges(2)',
    )
    const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    expect(boxes).toHaveLength(2)
    expect(boxes.every((b) => b.checked)).toBe(true)
  })

  it('容器 role=status + aria-live=polite(H27 读屏播报面)', () => {
    const bar = setup()
    expect(bar).toBeTruthy()
    const el = screen.getByTestId('editor-edit-intent-bar')
    expect(el.getAttribute('role')).toBe('status')
    expect(el.getAttribute('aria-live')).toBe('polite')
  })

  it('取消勾选第 2 条 ⇒ 应用回调只带 [0](逐条选择性应用)', () => {
    const { onApplySelected } = setup()
    const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    fireEvent.click(boxes[1]!)
    fireEvent.click(screen.getByRole('button', { name: 'predictiveEditApplySelected' }))
    expect(onApplySelected).toHaveBeenCalledTimes(1)
    expect(onApplySelected).toHaveBeenCalledWith([0])
  })

  it('全部取消勾选 ⇒ 应用钮禁用,回调不触发', () => {
    const { onApplySelected } = setup()
    for (const box of screen.getAllByRole('checkbox') as HTMLInputElement[]) {
      fireEvent.click(box)
    }
    const apply = screen.getByRole('button', {
      name: 'predictiveEditApplySelected',
    }) as HTMLButtonElement
    expect(apply.disabled).toBe(true)
    fireEvent.click(apply)
    expect(onApplySelected).not.toHaveBeenCalled()
  })

  it('hover 条目上报预览索引,鼠标离开回 null', () => {
    const { onPreviewIndexChange } = setup()
    // mouseEnter/Leave 绑在条目的 <label> 上(li 只是列表容器外壳)。
    const labels = screen.getAllByRole('listitem').map((item) => item.querySelector('label'))
    expect(labels).toHaveLength(2)
    fireEvent.mouseEnter(labels[1]!)
    expect(onPreviewIndexChange).toHaveBeenCalledWith(1)
    fireEvent.mouseLeave(labels[1]!)
    expect(onPreviewIndexChange).toHaveBeenCalledWith(null)
  })

  it('关闭钮触发 onDismiss', () => {
    const { onDismiss } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'cancel' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('换新建议(引用不同)时勾选重置为全选', () => {
    const { rerender } = render(
      <EditIntentBar
        prediction={PREDICTION}
        onApplySelected={vi.fn()}
        onDismiss={vi.fn()}
        onPreviewIndexChange={vi.fn()}
      />,
    )
    const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    fireEvent.click(boxes[0]!)
    rerender(
      <EditIntentBar
        prediction={{ ...PREDICTION, actions: [PREDICTION.actions[0]!] }}
        onApplySelected={vi.fn()}
        onDismiss={vi.fn()}
        onPreviewIndexChange={vi.fn()}
      />,
    )
    const fresh = screen.getAllByRole('checkbox') as HTMLInputElement[]
    expect(fresh).toHaveLength(1)
    expect(fresh[0]!.checked).toBe(true)
  })
})
