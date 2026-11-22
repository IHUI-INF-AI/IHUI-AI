// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SSO 别名路由的取值面(2026-10-31 立)。
 *
 * 现读缺陷:`const canonical = PROVIDER_ALIASES[provider] || provider` 把 URL 路径段
 * 原样插进下面那段 `dangerouslySetInnerHTML` 的内联脚本里。路径段是攻击者可控的,
 * `%27` 解码后即为单引号 ⇒ 闭合 `'…'` 字符串再往里拼任意 JS;而这一族页面落在
 * csp.ts 的"公开缓存/无 nonce"分支(script-src 含 'unsafe-inline'),注入当场可执行。
 *
 * 判据的正确形状是:能进脚本的值**只来自常量表**,未命中的别名一律 404。
 * 两档成对钉:
 *   ① 已知别名 ⇒ 脚本里的 platform 值是常量表里那个(摘掉常量表取值 ⇒ 本条翻红);
 *   ② 未知别名 ⇒ 走 notFound(),不产出任何内联脚本(把 `|| provider` 加回来 ⇒ 本条翻红,
 *      且带引号的探针会原样出现在 __html 里,正是缺陷的指纹)。
 */
import { describe, expect, it, vi } from 'vitest'

const notFoundMock = vi.hoisted(() => vi.fn(() => {
  throw new Error('__NOT_FOUND__')
}))

vi.mock('next/navigation', () => ({ notFound: notFoundMock }))

import SsoProviderCompatPage from '../../app/sso/[provider]/page'

type Rendered = {
  props?: { children?: unknown }
}

/** 从返回的 Fragment 里把所有 dangerouslySetInnerHTML 片段抽出来 */
function inlineHtmlOf(node: unknown): string[] {
  if (!node || typeof node !== 'object') return []
  const el = node as Rendered
  const found: string[] = []
  const props = (el.props ?? {}) as Record<string, unknown>
  const ds = props.dangerouslySetInnerHTML as { __html?: unknown } | undefined
  if (ds && typeof ds === 'object' && '__html' in ds) {
    found.push(String(ds.__html))
  }
  const kids = props.children
  if (Array.isArray(kids)) {
    for (const k of kids) found.push(...inlineHtmlOf(k))
  }
  return found
}

describe('/sso/[provider] 别名路由', () => {
  it('① 已知别名 ⇒ platform 只取常量表的值', async () => {
    const el = (await SsoProviderCompatPage({
      params: Promise.resolve({ provider: 'wx' }),
    })) as unknown

    const html = inlineHtmlOf(el).join('')
    expect(html).toContain("'enterpriseWechat'")
    expect(notFoundMock).not.toHaveBeenCalled()
  })

  it('② 未知别名 ⇒ notFound,且绝不把路径段拼进脚本', async () => {
    // 探针形状就是原缺陷的利用串:闭合 `'…'` 后接任意 JS
    const probe = "a');alert(1);('"
    await expect(
      SsoProviderCompatPage({ params: Promise.resolve({ provider: probe }) }),
    ).rejects.toThrow('__NOT_FOUND__')
    expect(notFoundMock).toHaveBeenCalled()
  })

  it('③ 大小写/前后缀变体也不属于别名表 ⇒ 同样 404(别名匹配是逐字等值)', async () => {
    await expect(
      SsoProviderCompatPage({ params: Promise.resolve({ provider: 'WX' }) }),
    ).rejects.toThrow('__NOT_FOUND__')
    await expect(
      SsoProviderCompatPage({ params: Promise.resolve({ provider: 'wechat;x' }) }),
    ).rejects.toThrow('__NOT_FOUND__')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
