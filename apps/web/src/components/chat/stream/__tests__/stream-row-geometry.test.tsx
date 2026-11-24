// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 活动行几何单一来源锁定(2026-11-21 立)
//
// 用户实报"图标文字都没对齐 / 七扭八歪"。根因不是某处 1px,而是**几何量挂在"能不能点"上**:
// 可点击行当年走头行档(h-7 + px-1),展示行走普通档(h-6 + 无左内边距)⇒ 同一列表里
// 图标列左右跳 4px、行高 24/28 交替;再叠加全局中文 vcenter 规则只认 button,基线又差 0.3px
// (探针实测:div 行 0、button 行 +0.3)。
//
// 本用例用真实渲染钉住三件事:
//  ① 可点击与展示两个分支渲染出的 className **逐字相同**(几何只能来自同一个常量),且不含旧档 h-7;
//  ② 两个分支的行根都带 data-stream-row —— tokens.css 的行级字形补偿以它为唯一触发面;
//  ③ 行内左内边距/间距/行高在两个分支里一致(同 px-1 ⇒ 图标列与文字列不随可点击性位移)。
//
// i18n:StreamMetric 无条件调用 useTranslations,本用例只关心几何,把 next-intl 打桩即可。
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

import {
  STREAM_GROUP_BODY_CLASS,
  STREAM_HEADER_ROW_CLASS,
  STREAM_RUNNING_TEXT_CLASS,
  StreamGroup,
  StreamKindIcon,
  StreamRow,
} from '../stream-ui'
import type { StreamStatus } from '../stream-ui'

describe('StreamRow 几何单一来源', () => {
  it('可点击与展示两个分支的行几何逐字相同', () => {
    const plain = render(<StreamRow status="success" kind="thinking" title="思考过程" />)
    const clickable = render(
      <StreamRow status="success" kind="terminal" title="执行命令" onClick={() => {}} />,
    )

    const plainRoot = plain.container.firstElementChild as HTMLElement
    const clickableRoot = clickable.container.firstElementChild as HTMLElement

    expect(plainRoot.className).toBe(clickableRoot.className)
    // 几何不允许在分支里各写一份:必须整段等于唯一常量
    expect(plainRoot.className).toContain(STREAM_HEADER_ROW_CLASS)
    // 旧的头行高度档回来就又是 24/28 两档
    expect(plainRoot.className).not.toMatch(/\bh-7\b/)
  })

  it('两个分支的行根都带 data-stream-row(行级字形补偿的唯一触发面)', () => {
    const plain = render(<StreamRow status="success" title="思考过程" />)
    const clickable = render(<StreamRow status="success" title="执行命令" onClick={() => {}} />)
    expect(plain.container.firstElementChild?.getAttribute('data-stream-row')).toBe('true')
    expect(clickable.container.firstElementChild?.getAttribute('data-stream-row')).toBe('true')
  })

  it('图标列/文字列的横向几何不随可点击性变化(左内边距与间距同源)', () => {
    const plain = render(
      <StreamRow status="success" kind="fileRead" title="读取文件内容" subject="a.ts" />,
    )
    const clickable = render(
      <StreamRow
        status="success"
        kind="fileRead"
        title="读取文件内容"
        subject="a.ts"
        onClick={() => {}}
      />,
    )
    const geometry = (container: HTMLElement) => {
      const root = container.firstElementChild as HTMLElement
      const cs = getComputedStyle(root)
      return { paddingLeft: cs.paddingLeft, gap: cs.gap, height: cs.height }
    }
    expect(geometry(plain.container)).toEqual(geometry(clickable.container))
  })

  it('行尾度量/耗时紧跟前文排,弹性空位只留在最后(不把内容顶到行末)', () => {
    const { container } = render(
      <StreamRow
        status="success"
        kind="fileRead"
        title="读取文件内容"
        subject="a.ts"
        metricKind="lines"
        metricValue={807}
        elapsedMs={380}
        onClick={() => {}}
      />,
    )
    const root = container.firstElementChild as HTMLElement
    const kids = [...root.children]
    const spacerIdx = kids.findIndex((k) => k.className.includes('flex-1'))
    const elapsedIdx = kids.findIndex((k) => (k.textContent ?? '').endsWith('ms'))
    // 弹性空位必须排在耗时之后:否则内容会被它顶到行末
    expect(spacerIdx).toBeGreaterThan(elapsedIdx)
    expect(elapsedIdx).toBeGreaterThan(-1)
    // 且每个前文元素都不许自己带 flex-1(它会把后面所有内容推开)
    expect(kids.filter((k) => k.className.includes('flex-1'))).toHaveLength(1)
  })

  it('组内左让位由 StreamGroup 一处施加(引导线轨道不会压在图标上)', () => {
    const { container } = render(
      <StreamGroup active={false} stepCount={2} headline="步骤" open onOpenChange={() => {}}>
        <div className="space-y-1">
          <StreamRow status="success" title="思考过程" />
        </div>
      </StreamGroup>,
    )
    // 展开体的唯一包裹层必须带让位档:漏套 = 行图标落回 4px 处、被 7px 轨道穿过
    const body = container.querySelector('[data-stream-group-body="true"]')
    expect(body).not.toBeNull()
    expect(body?.className).toContain(STREAM_GROUP_BODY_CLASS)
    // 拱起让位档的只有这一个节点,调用方再套一层就会变成双倍缩进
    const indenters = [...container.querySelectorAll('[class]')].filter(
      (el) =>
        el.className.includes('ml-1.5') &&
        el.className.includes('pl-3') &&
        el.getAttribute('data-stream-group-body') === 'true',
    )
    expect(indenters).toHaveLength(1)
  })

  it('行首图标颜色恒定:状态不得用图标透明度表达(running 不再呼吸)', () => {
    const statuses: StreamStatus[] = ['running', 'success', 'pending', 'skipped', 'stub', 'error']
    const classes = statuses.map((status) => {
      const { container, unmount } = render(<StreamKindIcon kind="terminal" status={status} />)
      const cls = (container.firstElementChild as HTMLElement).getAttribute('class') ?? ''
      unmount()
      return { status, cls }
    })
    // 进行中的图标类名与成功态逐字相同 ⇒ 不会因为呼吸帧落在 0.5 被读成"颜色不一致"
    expect(classes.find((c) => c.status === 'running')?.cls).toBe(
      classes.find((c) => c.status === 'success')?.cls,
    )
    // 任何状态都不许在图标上叠透明度动画/透明度档
    expect(classes.filter((c) => /animate-pulse|opacity-/.test(c.cls))).toEqual([])
    // 错误态仍取语义红(不是因为透明度变淡)
    expect(classes.find((c) => c.status === 'error')?.cls).toContain('text-red-500')
  })

  it('进行中的活信号只落在标题文字扫光上(STREAM_RUNNING_TEXT_CLASS),图标保持恒定', () => {
    const { container } = render(<StreamRow status="running" kind="terminal" title="运行代码" />)
    // 标题文字挂扫光档(左→右高光扫过字面,与对标程序一致)
    const title = [...container.querySelectorAll('span')].find(
      (el) => (el.textContent ?? '').trim() === '运行代码',
    )
    expect(title?.className).toContain(STREAM_RUNNING_TEXT_CLASS)
    // 图标不叠任何动效类,只留恒定前景色
    const icon = container.querySelector('svg')
    expect((icon as SVGElement).getAttribute('class') ?? '').not.toMatch(
      /animate-pulse|animate-status-breathe|opacity-/,
    )
    // 结束态不挂扫光(避免"已完成还在扫")
    const done = render(<StreamRow status="success" kind="terminal" title="运行代码" />)
    const doneTitle = [...done.container.querySelectorAll('span')].find(
      (el) => (el.textContent ?? '').trim() === '运行代码',
    )
    expect(doneTitle?.className ?? '').not.toContain(STREAM_RUNNING_TEXT_CLASS)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
