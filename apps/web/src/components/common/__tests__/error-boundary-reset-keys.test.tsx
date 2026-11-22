// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ErrorBoundary.resetKeys —— 局部错误边界随上下文标识自动复位(机制吸收 A10B-2,2026-09-26 立)
 *
 * 立因(实测):全仓 `resetKeys` 0 命中,`ErrorBoundary` 类里既没有 `componentDidUpdate`
 * 也没有任何复位通道 ⇒ 一处面板崩过一次,此后只要不刷新页面就一直停在 fallback。
 * 用户切到别的会话/工作区再回来,看到的仍是**上一个对象**的错误卡,而新对象的数据其实已经是好的;
 * fallback 上那个手动「重试」按钮此时重试的还是旧对象的那棵子树 —— 它不是这条缺口的解。
 *
 * 覆盖(与票面验收一一对应):
 *  ① 抛错 → 停在 fallback
 *  ② 换一个对象(resetKeys 变)→ 错误态清空、children 重新渲染
 *  ③ resetKeys 内容不变但换了数组引用 → **不**复位(证明是逐项 Object.is,不是引用比较)
 *  ④ resetKeys 长度变化 → 复位
 *  ⑤ 不传 resetKeys(全部既有调用方的形态)→ 重渲染后仍停在 fallback,行为逐字不变
 *  ⑥ NaN 参与 → 同值不复位(=== 会失真成"变了")
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ErrorBoundary } from '../ErrorBoundary'

/** 只有落在"坏对象"上才抛 —— 用来区分"边界复位了"与"子树本来就没抛"。 */
function Boom({ id }: { id: string }): ReactNode {
  if (id === 'poisoned') throw new Error(`boom:${id}`)
  return <span data-testid="panel">{`panel:${id}`}</span>
}

const FALLBACK_MARK = '页面出错了'

/** 边界捕获错误时 React 一定会 console.error 整段组件栈 —— 与本判据无关,降噪。 */
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  // componentDidCatch 会裸 fetch 上报崩溃;桩掉,不真发请求
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve({ ok: true } as unknown as Response)),
  )
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('ErrorBoundary / resetKeys 自动复位(A10B-2)', () => {
  it('① 子树抛错 → 停在 fallback,且上报了一次崩溃(不得静默)', () => {
    const { container } = render(
      <ErrorBoundary resetKeys={['poisoned']}>
        <Boom id="poisoned" />
      </ErrorBoundary>,
    )
    expect(container.textContent).toContain(FALLBACK_MARK)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain('/api/crash-reports')
  })

  it('② 换一个对象(resetKeys 变了)→ 错误态清空并渲染新对象', () => {
    const { container, rerender } = render(
      <ErrorBoundary resetKeys={['poisoned']}>
        <Boom id="poisoned" />
      </ErrorBoundary>,
    )
    expect(container.textContent).toContain(FALLBACK_MARK)

    rerender(
      <ErrorBoundary resetKeys={['fresh']}>
        <Boom id="fresh" />
      </ErrorBoundary>,
    )
    expect(container.textContent).not.toContain(FALLBACK_MARK)
    expect(container.textContent).toContain('panel:fresh')
  })

  it('③ 同一组值 + 新数组引用 → 不复位(逐项 Object.is,不是"数组引用变了")', () => {
    const { container, rerender } = render(
      <ErrorBoundary resetKeys={['poisoned']}>
        <Boom id="poisoned" />
      </ErrorBoundary>,
    )
    expect(container.textContent).toContain(FALLBACK_MARK)

    // 调用方每次 render 新建数组是常态:若按引用比,错误会被下一次重渲染悄悄抹掉
    rerender(
      <ErrorBoundary resetKeys={[...['poisoned']]}>
        <Boom id="poisoned" />
      </ErrorBoundary>,
    )
    expect(container.textContent).toContain(FALLBACK_MARK)
    // 判据的**真正载体**是这条:复位过一次 ⇒ 子树重挂 ⇒ 再次抛错 ⇒ componentDidCatch 再上报一次。
    // 只断言"仍在 fallback"是没有牙的 —— 复位后子树又抛、边界又抓,DOM 结论自己会愈合。
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('④ resetKeys 长度变化 → 复位', () => {
    const { container, rerender } = render(
      <ErrorBoundary resetKeys={['poisoned']}>
        <Boom id="poisoned" />
      </ErrorBoundary>,
    )
    expect(container.textContent).toContain(FALLBACK_MARK)

    rerender(
      <ErrorBoundary resetKeys={['poisoned', 'tab-2']}>
        <Boom id="poisoned" />
      </ErrorBoundary>,
    )
    // 长度变了即复位;子树仍抛 ⇒ 边界重新捕获(不是"错误被吞了")
    expect(container.textContent).toContain(FALLBACK_MARK)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('⑤ 不传 resetKeys(既有唯一调用方的形态)→ 重渲染后仍停在 fallback', () => {
    const { container, rerender } = render(
      <ErrorBoundary>
        <Boom id="poisoned" />
      </ErrorBoundary>,
    )
    expect(container.textContent).toContain(FALLBACK_MARK)

    rerender(
      <ErrorBoundary>
        <Boom id="poisoned" />
      </ErrorBoundary>,
    )
    expect(container.textContent).toContain(FALLBACK_MARK)
  })

  it('⑥ NaN 参与且未变 → 不复位(=== 会把它读成"变了"⇒ 错误态反复被抹)', () => {
    const { container, rerender } = render(
      <ErrorBoundary resetKeys={[Number.NaN]}>
        <Boom id="poisoned" />
      </ErrorBoundary>,
    )
    expect(container.textContent).toContain(FALLBACK_MARK)

    rerender(
      <ErrorBoundary resetKeys={[Number.NaN]}>
        <Boom id="poisoned" />
      </ErrorBoundary>,
    )
    expect(container.textContent).toContain(FALLBACK_MARK)
    // 同 ③:复位会引发第二次崩溃上报,这是唯一不会被"DOM 自愈"糊过去的观测
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('⑦ 无错时 resetKeys 变化不得引发多余 setState(避免正常面板每次切页被重挂/重渲)', () => {
    let renders = 0
    function Counted({ id }: { id: string }): ReactNode {
      renders += 1
      if (id === 'poisoned') throw new Error(`boom:${id}`)
      return <span data-testid="panel">{`panel:${id}`}</span>
    }
    const { container, rerender } = render(
      <ErrorBoundary resetKeys={['a']}>
        <Counted id="ok-1" />
      </ErrorBoundary>,
    )
    expect(container.textContent).toContain('panel:ok-1')
    const baseline = renders
    rerender(
      <ErrorBoundary resetKeys={['b']}>
        <Counted id="ok-1" />
      </ErrorBoundary>,
    )
    // 无错态下边界不该"顺手"再推一次子树渲染(componentDidUpdate 的 hasError 早退是这条的判据);
    // 上面那次 rerender 本身会带来一次由 props 变化引起的常规渲染,所以只允许 +1。
    expect(renders - baseline).toBeLessThanOrEqual(1)
  })
})

/**
 * 装车证明:机制在位而**零消费方**在本仓不算交付(守门 64/70/81 同型)。
 * 判的是源码结构,不是渲染行为 —— 行为由上面各例保证,这一例防的是"改完组件忘了接线"。
 */
describe('接线对账', () => {
  const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

  it('FilesSection 的通用面板边界真的带 resetKeys,且键是工程身份', () => {
    const src = read('../../../../app/(main)/workspace/[id]/FilesSection.tsx')
    expect(src).toMatch(/<ErrorBoundary\s+resetKeys=\{\[projectId\]\}>/)
    // 复位键必须来自 props 而不是本地常量 —— 否则切工程时它不变,接线等于没接
    expect(src).toMatch(/projectId\?:\s*string/)
  })

  it('PageClient 真的把路由上的工程 id 喂了进去', () => {
    const src = read('../../../../app/(main)/workspace/[id]/PageClient.tsx')
    expect(src).toMatch(/<FilesSection[\s\S]{0,200}?projectId=\{projectId\}/)
    expect(src).toMatch(/const projectId = params\.id/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
