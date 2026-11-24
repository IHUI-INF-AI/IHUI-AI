// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// @vitest-environment jsdom
/**
 * G-816020 面三 + 面四 + 面七:vision-analysis / feature-center documents 页的**源码级装载锁**。
 *
 * 为什么这两面不是渲染对用例:vision-analysis 的 ReactMarkdown 只在 useMutation 成功写入
 * answer 后渲染(documents 页在文档数据拉取后渲染)—— 组件级渲染需要把数据流整条 mock 穿透,
 * 守卫成本远超这一行配置本身;面七(MarkdownViewer)另有一层:其 ReactMarkdown 本体也经 next/dynamic(ssr:false)装载,双 dynamic 链在 vitest 里无 Next 运行时挂不完成,渲染对用例整面空转 —— 故同样落源码锁。按仓内"源码级装载锁"先例(M2 形态):锁**确切配置字面量**在位、
 * 且裸形态已消失 —— 配置被摘线即红。渲染行为本身由 remark-gfm 的上游语义保证,与 G-826
 * 在 markdown-stream 的渲染对用例互补(那一面已证 singleTilde:false 的确产出"~a~ 不划、
 * ~~b~~ 划"的行为,本锁只守"这四面没有掉队")。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = resolve(__dirname, '../../../..')

const readSrc = (rel: string): string => readFileSync(resolve(WEB_ROOT, rel), 'utf8')

describe('G-816020 源码级装载锁 — singleTilde:false 在位且裸形态消失', () => {
  it('面三 vision-analysis.tsx', () => {
    const src = readSrc('src/components/ai-generation/vision-analysis.tsx')
    expect(src).toContain('remarkPlugins={[[remarkGfm, { singleTilde: false }]]}')
    expect(src).not.toContain('remarkPlugins={[remarkGfm]}')
  })

  it('面四 feature-center/documents/page.tsx', () => {
    const src = readSrc('app/(main)/feature-center/documents/page.tsx')
    expect(src).toContain('remarkPlugins={[[remarkGfm, { singleTilde: false }]]}')
    expect(src).not.toContain('remarkPlugins={[remarkGfm]}')
  })

  it('面七 media/MarkdownViewer.tsx', () => {
    const src = readSrc('src/components/media/MarkdownViewer.tsx')
    expect(src).toContain('remarkGfm ? [[remarkGfm, { singleTilde: false }]] : []')
    expect(src).not.toContain('remarkGfm ? [remarkGfm] : []')
  })
})
