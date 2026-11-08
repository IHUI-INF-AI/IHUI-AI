// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * XUI-063:miniapp 页面用的 key 与源文案键名漂移。
 * 口径(2026-11-08 用户定):**只对源断言**,不对 `.gen.ts` 产物断言 ——
 * 产物重生成随 XUI-076 一次性完成,本夹具防护的是"源里 key 齐、页面用规范名"。
 *
 * 旧码:广场页用 `plaza.index.search/menu/category`(源里只有 navSearch/navMenu/navCategory),
 * 充值壳用 `wallet.recharge.title/balance/rate/introTitle/introBody`(源里缺) ⇒ 非中文回落到中文。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(__dirname, '..', '..')
const REPO = join(SRC, '..', '..', '..')
const MSG = join(REPO, 'packages', 'i18n', 'messages')
const LOCALES = ['zh-CN', 'en', 'ja', 'ko', 'zh-TW'] as const

const read = (p: string) => readFileSync(join(SRC, p), 'utf8')

function flatten(
  obj: Record<string, unknown>,
  prefix = '',
  out = new Map<string, string>(),
): Map<string, string> {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      flatten(v as Record<string, unknown>, key, out)
    } else {
      out.set(key, String(v))
    }
  }
  return out
}

/** 运行时词典 = shared 底座 + miniapp-taro 覆盖(与 zh-cn-pack 的合并口径一致) */
function messages(locale: string): Map<string, string> {
  const base = flatten(JSON.parse(readFileSync(join(MSG, 'shared', `${locale}.json`), 'utf8')))
  const own = flatten(JSON.parse(readFileSync(join(MSG, 'miniapp-taro', `${locale}.json`), 'utf8')))
  return new Map([...base, ...own])
}

/** 取页面里的字面量 key(动态 key 如 `tt(it.labelKey, …)` 不参与静态校验) */
function literalKeys(file: string): string[] {
  return [...read(file).matchAll(/\btt\(\s*'([^']+)'/g)].map((m) => m[1] as string)
}

const FILES = ['pages/plaza/index/index.tsx', 'pkg-shop/wallet/recharge/recharge-props.ts']

describe('XUI-063 miniapp 文案 key 漂移', () => {
  it('页面用到的每个字面量 key 在 5 语源文案里都存在', () => {
    const keys = [...new Set(FILES.flatMap(literalKeys))]
    expect(keys.length).toBeGreaterThan(0)
    for (const locale of LOCALES) {
      const dict = messages(locale)
      const missing = keys.filter((k) => !dict.has(k))
      expect(missing, `${locale} 源文案缺失`).toEqual([])
    }
  })

  it('广场页用源里的规范 key(navSearch/navMenu/navCategory),不再用旧名', () => {
    const src = read('pages/plaza/index/index.tsx')
    expect(src).toContain('plaza.index.navSearch')
    expect(src).toContain('plaza.index.navMenu')
    expect(src).toContain('plaza.index.navCategory')
    expect(src).not.toMatch(/tt\('plaza\.index\.(search|menu|category)'/)
  })
})
