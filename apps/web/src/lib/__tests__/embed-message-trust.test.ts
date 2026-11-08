// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).

/**
 * 内嵌代理 iframe 消息来源闸夹具（2026-11-08）。
 *
 * 钉死的不变量：
 *  - 只有 `e.source === 本面板 iframe.contentWindow` 的消息才被解析；
 *    任何外部/嵌套窗口伪造的消息返回 null，调用方零副作用（不导航、不开标签、不降级）。
 *  - `ihui-embed-newtab` / `ihui-embed-nav` / `ihui-embed-loaded` 的 url 仅接受 http(s)，
 *    阻断 `javascript:` / `data:` 等形态进入地址栏或新标签。
 *  - opaque origin 下 `e.origin='null'` 无法用于同源校验，因此来源判定只认 `e.source`。
 */
import { describe, it, expect } from 'vitest'
import { parseEmbedMessage } from '../embed-message-trust'

const WIN = {} as unknown as Window
const FOREIGN_WIN = {} as unknown as Window

describe('parseEmbedMessage', () => {
  it('来源不匹配 → null（零副作用，即使 payload 完全合法）', () => {
    expect(
      parseEmbedMessage(
        { type: 'ihui-embed-newtab', url: 'https://example.com' },
        FOREIGN_WIN as unknown as MessageEventSource,
        WIN,
      ),
    ).toBeNull()
  })

  it('expectedWindow 为空（iframe 未挂载）→ null', () => {
    expect(
      parseEmbedMessage({ type: 'ihui-embed-nav', url: 'https://a.com' }, WIN as unknown as MessageEventSource, null),
    ).toBeNull()
    expect(
      parseEmbedMessage({ type: 'ihui-embed-nav', url: 'https://a.com' }, null, WIN),
    ).toBeNull()
  })

  it('来源匹配 + newtab http(s) → 动作', () => {
    expect(
      parseEmbedMessage(
        { type: 'ihui-embed-newtab', url: 'https://example.com/x', title: 'X' },
        WIN as unknown as MessageEventSource,
        WIN,
      ),
    ).toEqual({ kind: 'newtab', url: 'https://example.com/x', title: 'X' })
  })

  it('来源匹配但 newtab 非 http(s) → null', () => {
    expect(
      parseEmbedMessage(
        { type: 'ihui-embed-newtab', url: 'javascript:alert(1)' },
        WIN as unknown as MessageEventSource,
        WIN,
      ),
    ).toBeNull()
  })

  it('nav/loaded 的 url 非 http(s) → null', () => {
    expect(
      parseEmbedMessage(
        { type: 'ihui-embed-nav', url: 'data:text/html,x' },
        WIN as unknown as MessageEventSource,
        WIN,
      ),
    ).toBeNull()
  })

  it('非白名单前缀 / 非对象 → null', () => {
    expect(
      parseEmbedMessage({ type: 'evil', url: 'https://a.com' }, WIN as unknown as MessageEventSource, WIN),
    ).toBeNull()
    expect(parseEmbedMessage(null, WIN as unknown as MessageEventSource, WIN)).toBeNull()
  })

  it('来源匹配 + nav/loaded/proxy-error → 动作', () => {
    expect(
      parseEmbedMessage(
        { type: 'ihui-embed-nav', url: 'https://b.com', title: 'B' },
        WIN as unknown as MessageEventSource,
        WIN,
      ),
    ).toEqual({ kind: 'nav', url: 'https://b.com', title: 'B' })
    expect(
      parseEmbedMessage(
        { type: 'ihui-embed-loaded', url: 'https://c.com' },
        WIN as unknown as MessageEventSource,
        WIN,
      ),
    ).toEqual({ kind: 'loaded', url: 'https://c.com', title: undefined })
    expect(
      parseEmbedMessage(
        { type: 'ihui-embed-proxy-error', message: 'boom' },
        WIN as unknown as MessageEventSource,
        WIN,
      ),
    ).toEqual({ kind: 'proxy-error', message: 'boom' })
  })
})
