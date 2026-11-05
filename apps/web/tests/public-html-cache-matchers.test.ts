// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 公开可缓存页匹配器 + "nonce 与 public 缓存互斥"这条不变量(2026-11-01 立)。
 *
 * 为什么本文件必须存在:`sourceToRegExp` 此前把绝对路径的**空首段**也拼成 `/`,
 * `/agents` 折成 `^//agents/?$` ⇒ 六十几条规则对任何真实 pathname 全不匹配(现跑现读),
 * `isPublicCacheablePath` 因此恒 false,`proxy.ts` 的"公开可缓存页不上 nonce"那一支从未生效。
 * 后果不是"少个优化",而是本文件自己声明绝不允许的形态落地:同一枚响应既
 * `Cache-Control: public, s-maxage=…` 又被钉上 per-request nonce —— 边缘缓存把一份带 nonce 的
 * HTML 发给后续所有访客,nonce 变成全站共用常量,CSP 的脚本白名单形同虚设。
 * 而这条链**零测试覆盖**(全仓除 proxy.ts 与本文件外无人引用 `isPublicCacheablePath`),
 * 所以 bug 能一直活着。本文件就是那把缺失的尺子。
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { PUBLIC_HTML_CACHE_RULES, isPublicCacheablePath } from '../src/config/public-html-cache'

describe('isPublicCacheablePath 真实命中', () => {
  // 正向:这些是 PUBLIC_HTML_CACHE_RULES 里在册的形态(精确页 / 通配 / 参数段)
  it.each([
    '/agents',
    '/agents/',
    '/models',
    '/capability-market',
    '/compare/xyz',
    '/docs/getting-started',
    '/download/win',
    '/ko/use-cases/a/b',
  ])('在册页 %s ⇒ true', (p) => {
    expect(isPublicCacheablePath(p)).toBe(true)
  })

  // 反例:边界必须段级,前缀相同不算;受保护面与未在册页一律 false
  it.each([
    '/agentsXYZ', // 前缀相同但不是那一段
    '/agents/123', // 精确规则不带通配
    '/docs', // :path+ 要求至少一段
    '/admin/users',
    '/api/whatever',
    '',
    '/',
  ])('不在册/越界 %s ⇒ false', (p) => {
    expect(isPublicCacheablePath(p)).toBe(false)
  })

  it('覆盖面自证:规则表非空,且"命中"不是来自空表恒真的假绿', () => {
    expect(PUBLIC_HTML_CACHE_RULES.length).toBeGreaterThan(10)
    // 反向锁:摘掉空首段那一格的处理,规则会退回 `^//…` 形态 —— 这里直接复核正则本体
    const broken = PUBLIC_HTML_CACHE_RULES.map(
      (r) =>
        new RegExp(
          '^' +
            r.source
              .split('/')
              .map((s) => '/' + s)
              .join('') +
            '/?$',
        ),
    )
    const real = '/agents'
    expect(broken.some((re) => re.test(real))).toBe(false)
    expect(isPublicCacheablePath(real)).toBe(true)
  })
})

describe('nonce 与 public 缓存必须互斥(proxy.ts 接线锁)', () => {
  const proxy = readFileSync(join(process.cwd(), 'proxy.ts'), 'utf8')

  it('不发 nonce 的条件里必须同时排除"公开可缓存页"', () => {
    expect(proxy).toMatch(/!isNonHtmlPath\(pathname\)\s*&&\s*!isPublicCacheablePath\(pathname\)/)
  })

  it('缓存头与 nonce 不得由同一枚响应同时带出:pass() 走的是不带 CSP 的那一支', () => {
    // pass() 在 `!csp || !nonce` 时直接 NextResponse.next() ⇒ 只有 next.config 那份(无 nonce 档)
    // 生效。这条断言钉的是"缺一枚就整条不写 nonce 头"的形状,反向即缓存件锁 nonce 的成因。
    expect(proxy).toMatch(/if \(!csp \|\| !nonce\) return NextResponse\.next\(\)/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
