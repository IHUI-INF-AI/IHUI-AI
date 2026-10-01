// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { exchangeSsoCodeOnce, resetSsoCodeOnceState } from '../src/lib/sso-exchange-once'

interface Token {
  accessToken: string
}

describe('一次性 sso_code 只换一次(G-367)', () => {
  beforeEach(() => {
    resetSsoCodeOnceState()
  })

  it('O1 两个并发消费者同一枚 code:上游只被问一次,两路都拿到成功', async () => {
    const exchange = vi.fn(async (code: string): Promise<Token | null> => ({ accessToken: `t-${code}` }))
    const written: string[] = []
    const onToken = vi.fn(async (t: Token) => {
      written.push(t.accessToken)
    })

    const [a, b] = await Promise.all([
      exchangeSsoCodeOnce('CODE-1', exchange, onToken),
      exchangeSsoCodeOnce('CODE-1', exchange, onToken),
    ])

    expect(a).toBe(true)
    expect(b).toBe(true)
    expect(exchange).toHaveBeenCalledTimes(1)
    // 落库回调同样只该发生一次:两次 setAuth 会把同一份令牌写两遍
    expect(onToken).toHaveBeenCalledTimes(1)
    expect(written).toEqual(['t-CODE-1'])
  })

  it('O2 迟到的一路复用已有结论:即便第一次已结算,也不得再问服务端', async () => {
    const exchange = vi.fn(async (): Promise<Token | null> => ({ accessToken: 'x' }))
    const onToken = vi.fn(async () => {})

    await expect(exchangeSsoCodeOnce('CODE-2', exchange, onToken)).resolves.toBe(true)
    await expect(exchangeSsoCodeOnce('CODE-2', exchange, onToken)).resolves.toBe(true)
    expect(exchange).toHaveBeenCalledTimes(1)
  })

  it('O3 反向对照:不同 code 不得互相顶账', async () => {
    const exchange = vi.fn(async (code: string): Promise<Token | null> => ({ accessToken: code }))
    const onToken = vi.fn(async () => {})

    await exchangeSsoCodeOnce('A', exchange, onToken)
    await exchangeSsoCodeOnce('B', exchange, onToken)
    expect(exchange).toHaveBeenCalledTimes(2)
  })

  it('O4 换令牌失败:返回 false 且不写任何凭据', async () => {
    const exchange = vi.fn(async (): Promise<Token | null> => null)
    const onToken = vi.fn(async () => {})

    await expect(exchangeSsoCodeOnce('CODE-3', exchange, onToken)).resolves.toBe(false)
    expect(onToken).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
