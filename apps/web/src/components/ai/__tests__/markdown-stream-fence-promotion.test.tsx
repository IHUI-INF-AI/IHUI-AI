// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment jsdom
// 2026-10-29 流式观感档⑦守门:「围栏写完 → 晋升 stable」这一拍的折叠回塌。
// 机制取证(markdown-stream.tsx 同区注记 / react-markdown v10 无位置键):
// 晋升 = 代码块跨 ReactMarkdown 双树迁居,React 只能旧树卸载 + 新树挂载;
// 折叠 useState 是挂载初值,新实例若无"已展开"事实继承即 collapsed=true ⇒ 屏幕瞬间塌回 5 行。
// 本文件三例钉三格:① 常规"闭合→晋升"两拍不塌且 stable 腿自证;② 历史重载默认折叠逐字不变;
// ③ "前块闭合+后块开栏同拍"(先记后判出口)前块同拍晋升也不塌。
// 脚手架沿 markdown-stream.test.tsx 全套 mock + smoothness 件假定时器节拍;
// SyntaxHighlighter 是 next/dynamic 懒加载(主测件 waitFor 同源教训),每拍后 await 冲刷 chunk。
import * as React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act, cleanup } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

vi.mock('@/components/feedback', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

const { mockUseTheme } = vi.hoisted(() => ({
  mockUseTheme: vi.fn((): { resolvedTheme: 'light' | 'dark' } => ({ resolvedTheme: 'light' })),
}))
vi.mock('next-themes', () => ({ useTheme: () => mockUseTheme() }))

// 高亮器 mock 成原样吐 children 的 <pre>,折叠(前 5 行)与全展一眼可辨
vi.mock('react-syntax-highlighter', async () => ({
  Prism: ({ language, children }: { language?: string; children?: string }) =>
    React.createElement(
      'pre',
      { 'data-testid': 'syntax-highlighter', 'data-lang': language ?? '' },
      children,
    ),
}))

vi.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({
  oneDark: { __styleKey: 'oneDark' },
  oneLight: { __styleKey: 'oneLight' },
}))

vi.mock('@/components/media/MermaidDiagram', async () => ({
  default: ({ code }: { code?: string }) =>
    React.createElement('div', { 'data-testid': 'mermaid' }, code),
}))

import MarkdownStreamDefault from '../markdown-stream'
// G-826 纪律:用例必须自证切到了真腿——晋升断言前先用生产同一判据核 stable/active 归属
import { splitMarkdownStable } from '@/lib/markdown-stable-split'

const MarkdownStream = MarkdownStreamDefault

// —— 内容构造:正文 >1500(MARKDOWN_SPLIT_MIN_LENGTH),代码块 8 行(collapseLines 5,过折叠阈)——
function filler(): string {
  return Array.from(
    { length: 11 },
    (_, k) => '段落' + '字'.repeat(150) + String.fromCharCode(65 + k),
  ).join('\n\n')
}
const PROSE = filler()
const CODE_A = Array.from({ length: 8 }, (_, i) => `const alpha${i + 1} = ${i + 1}`).join('\n')

// 流式三拍:未闭合 → 已闭合未晋升 → 尾段开写(晋升拍)
const S1 = `${PROSE}\n\n\`\`\`js\n${CODE_A}\n`
const S2 = `${S1}\`\`\``
const S3 = `${S2}\n\n尾追段`
const S4 = `${S3}继续写`
// 历史重载用:全闭全文(未经历任何未闭合拍)
const DONE = `${PROSE}\n\n\`\`\`js\n${CODE_A}\n\`\`\`\n\n尾追段落`
// ③ 同拍题面:A 闭合与 B 开栏挤在同一拍到达;M2 续写尾块
const M1 = `${S2}\n\n\`\`\`py\nconst beta1 = 1`
const M2 = `${M1}\nconst beta2 = 2\n`

beforeEach(() => {
  if (typeof globalThis.requestAnimationFrame !== 'function') {
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
      setTimeout(() => cb(Date.now()), 16) as unknown as number) as typeof requestAnimationFrame
    globalThis.cancelAnimationFrame = ((id: number) =>
      clearTimeout(id as unknown as ReturnType<typeof setTimeout>)) as typeof cancelAnimationFrame
  }
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const hlTexts = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll('[data-testid="syntax-highlighter"]')).map(
    (el) => el.textContent ?? '',
  )
const expandButton = (container: HTMLElement): Element | null =>
  container.querySelector('button[aria-label="展开代码"]')

/** 推进一拍节流 + 冲刷 next/dynamic 微任务(chunk 到齐后高亮 mock 才出现在树里) */
async function tick(): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(16)
  })
}

async function step(rerender: (ui: React.ReactElement) => void, content: string): Promise<void> {
  act(() => {
    rerender(<MarkdownStream content={content} isStreaming />)
  })
  await tick()
}

describe('MarkdownStream 档⑦:围栏晋升 stable 不回塌折叠', () => {
  it('闭合→晋升→再生长三拍全程展开,且用例确实跨过了 stable/active 边', async () => {
    vi.useFakeTimers()
    const { container, rerender } = render(<MarkdownStream content={S1} isStreaming />)
    await tick()

    // 腿自证①:在写拍,块还不在 stable(与组件同判据:未闭合 ⇒ 虚拟闭合后再切)
    const v1 = splitMarkdownStable(`${S1}\n\`\`\`\n`)
    expect(v1.active).toContain('```js')
    expect(v1.stable).not.toContain('alpha')
    // 在写尾块全展(④:流式尾随全展)
    expect(hlTexts(container).some((t) => t.includes('alpha8 = 8'))).toBe(true)
    expect(expandButton(container)).toBeNull()

    // 腿自证②:闭合拍 splitStart 未动(闭合后尚无新安全边界)= 同一实例,⑥ 沿变保持展开
    await step(rerender, S2)
    expect(splitMarkdownStable(S2).stable).not.toContain('alpha8')
    expect(
      hlTexts(container).some((t) => t.includes('alpha1 = 1') && t.includes('alpha8 = 8')),
    ).toBe(true)
    expect(expandButton(container)).toBeNull()

    // 核心:尾段首字到达 = 晋升拍,块从 active 迁居 stable。旧病 = 这一拍塌回 5 行并
    // 现身"展开代码";修后必须仍全展,折叠按钮以"收起代码"形态在场。
    const v3 = splitMarkdownStable(S3)
    expect(v3.stable).toContain('alpha8 = 8')
    expect(v3.active).toBe('尾追段')
    await step(rerender, S3)
    expect(
      hlTexts(container).some((t) => t.includes('alpha1 = 1') && t.includes('alpha8 = 8')),
    ).toBe(true)
    expect(expandButton(container)).toBeNull()
    expect(container.querySelector('button[aria-label="收起代码"]')).not.toBeNull()

    // 生长拍:stable 前缀冻结(块不再被 parse / 不再迁移)= memo 前提不破
    await step(rerender, S4)
    expect(splitMarkdownStable(S4).stable).toBe(v3.stable)
    expect(hlTexts(container).some((t) => t.includes('alpha8 = 8'))).toBe(true)
    expect(expandButton(container)).toBeNull()
  })

  it('历史重载(未经流式)默认折叠设计逐字不变', async () => {
    vi.useFakeTimers()
    const sp = splitMarkdownStable(DONE)
    // 自证腿:历史块恰好落在晋升会走的那条腿(stable)里;折叠设计判的正是这条腿的首挂载
    expect(sp.stable).toContain('alpha8 = 8')
    expect(sp.active).toBe('尾追段落')
    const { container } = render(<MarkdownStream content={DONE} isStreaming={false} />)
    await tick()
    expect(expandButton(container)).not.toBeNull()
    const texts = hlTexts(container)
    expect(texts.some((t) => t.includes('alpha1 = 1'))).toBe(true)
    expect(texts.some((t) => t.includes('alpha8 = 8'))).toBe(false)
  })

  it('前块闭合 + 后块开栏挤同一拍:先记后判,前块同拍晋升也不塌', async () => {
    vi.useFakeTimers()
    const { container, rerender } = render(<MarkdownStream content={M1} isStreaming />)
    await tick()
    // 腿自证:同拍到达 ⇒ A 块首拍就以 stable 身份挂载(上一拍从未存在)
    const vm = splitMarkdownStable(`${M1}\n\`\`\`\n`)
    expect(vm.stable).toContain('alpha8 = 8')
    expect(vm.active).toContain('```py')
    // A:虽从未以"active 中的完成块"过一遍,首拍即入簿即被判认可 ⇒ 展开挂载
    expect(
      hlTexts(container).some((t) => t.includes('alpha1 = 1') && t.includes('alpha8 = 8')),
    ).toBe(true)
    expect(expandButton(container)).toBeNull()
    // 续写尾块:在写尾块不入簿,但 isStreaming 外观本就全展(高亮防抖 300ms 后再核)
    await step(rerender, M2)
    await act(async () => {
      vi.advanceTimersByTime(320)
    })
    expect(hlTexts(container).some((t) => t.includes('alpha8 = 8'))).toBe(true)
    expect(hlTexts(container).some((t) => t.includes('beta2 = 2'))).toBe(true)
    expect(expandButton(container)).toBeNull()
  })

  it('⑧ 在写判定逐块化:写完毕的非尾块当拍升完成外观,在写尾块仍无动作按钮', async () => {
    vi.useFakeTimers()
    const { container } = render(<MarkdownStream content={M1} isStreaming />)
    await tick()
    // A(js)已闭且非尾 ⇒ 动作区出现(应用按钮一枚);B(py)在写 ⇒ 无动作按钮。
    // 旧粗判整实例一个位:此拍全局"在写",两处都不应有 → 计数判据直接量出逐块化是否接线。
    expect(container.querySelectorAll('[data-testid="apply-to-file-button"]').length).toBe(1)
    // A 完成外观 + ⑦ 携带展开 ⇒ 折叠控件以"收起代码"形态当拍在场(不等整实例翻转)
    expect(container.querySelector('button[aria-label="收起代码"]')).not.toBeNull()
    // 尾块 B 在写:全展、无"展开代码"(④ 尾随全展语义不变)
    expect(expandButton(container)).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
