// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-825 · markdown 渲染守卫纯函数层用例(2026-09-29 立)。
// 本票的全部价值在"流式中键必须恒定"这一条:每个 token 换键 ⇒ 每 token 复位一次 ⇒ 边界成摆设。
// 形状在这里判最直接(不借 DOM);接线取证见 message-item-markdown-boundary.test.tsx。
import { describe, expect, it } from 'vitest'

import {
  MARKDOWN_RENDER_FAILURE_EVENT,
  markdownRenderFailureFacts,
  markdownRenderModeFor,
  markdownResetKeys,
} from '../markdown-render-guard'

const STREAMING = { renderStreaming: true, mode: markdownRenderModeFor(undefined) } as const

describe('markdownRenderModeFor', () => {
  it('collapseLines<=0 / 缺省 → code-plain;>0 → code-collapsible(与 MarkdownStream 的开关同义)', () => {
    expect(markdownRenderModeFor(undefined)).toBe('code-plain')
    expect(markdownRenderModeFor(0)).toBe('code-plain')
    expect(markdownRenderModeFor(-1)).toBe('code-plain')
    expect(markdownRenderModeFor(5)).toBe('code-collapsible')
  })
})

describe('markdownResetKeys · 流式支', () => {
  it('流式中给恒定键 streaming:<mode>,不掺长度也不掺 hash', () => {
    expect(markdownResetKeys({ content: '第一个 token', ...STREAMING })).toEqual([
      'streaming:code-plain',
    ])
  })

  it('流式中正文怎么长都同一个键(成对:每 token 换键就是本票要防的抖动)', () => {
    const k1 = markdownResetKeys({ content: 'a', ...STREAMING })
    const k2 = markdownResetKeys({ content: 'a'.repeat(20000), ...STREAMING })
    expect(k2).toEqual(k1)
    // 反向锁:键里若掺进了 hash/长度,上面两条相等就会假通过
    expect(k1[0]).not.toMatch(/done:/)
  })

  it('mode 参与流式键:渲染模式变了就该允许重试一次', () => {
    expect(
      markdownResetKeys({
        content: 'a',
        renderStreaming: true,
        mode: markdownRenderModeFor(5),
      }),
    ).toEqual(['streaming:code-collapsible'])
  })
})

describe('markdownResetKeys · 完成态支', () => {
  const done = (content: string) =>
    markdownResetKeys({ content, renderStreaming: false, mode: markdownRenderModeFor(undefined) })

  it('完成态掺内容键:同文同键、换文换键(这是边界唯一能重试的理由)', () => {
    expect(done('同一篇正文')).toEqual(done('同一篇正文'))
    expect(done('同一篇正文')).not.toEqual(done('另一篇正文'))
  })

  it('长度相同而内容不同的两篇 → 键必须不同(只掺长度就等于把两篇当同一篇,错误态永不复位)', () => {
    expect(done('aaaa')).not.toEqual(done('aaab'))
  })

  it('hash 是 FNV-1a 32 位(与 packages/types/src/device.ts 那份同算法):钉三组公开向量,防止被换成别的 hash', () => {
    // FNV-1a(offset 0x811c9dc5, prime 0x01000193):"" → 811c9dc5,"a" → e40c292c,"foobar" → bf9cf968
    expect(done('')).toEqual(['done:code-plain:0:811c9dc5'])
    expect(done('a')).toEqual(['done:code-plain:1:e40c292c'])
    expect(done('foobar')).toEqual(['done:code-plain:6:bf9cf968'])
  })
})

describe('markdownRenderFailureFacts', () => {
  it('带 markdownLength / mode / renderStreaming 三条量', () => {
    const body = '用户的一段聊天正文,含密钥样式 sk-should-not-leak'
    expect(
      markdownRenderFailureFacts({ content: body, renderStreaming: true, mode: 'code-plain' }),
    ).toEqual({
      event: MARKDOWN_RENDER_FAILURE_EVENT,
      markdownLength: body.length,
      mode: 'code-plain',
      renderStreaming: true,
    })
    expect(
      markdownRenderFailureFacts({
        content: body,
        renderStreaming: false,
        mode: markdownRenderModeFor(5),
      }),
    ).toEqual({
      event: MARKDOWN_RENDER_FAILURE_EVENT,
      markdownLength: body.length,
      mode: 'code-collapsible',
      renderStreaming: false,
    })
  })

  it('载荷里一个正文字符都不许出现(上报面不落用户内容)', () => {
    const body = '绝不该出现在日志里的正文-marker-xyz'
    const serialized = JSON.stringify(
      markdownRenderFailureFacts({ content: body, renderStreaming: false, mode: 'code-plain' }),
    )
    expect(serialized).not.toContain(body)
    expect(serialized).not.toContain('marker-xyz')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
