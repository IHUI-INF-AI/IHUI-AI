// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 颜色写法单一化不变量(2026-11-22 立)。
 *
 * 立因:同一颜色在 tokens.css 里曾同时以 hsl()/#rrggbb/oklch() 三种写法出现(纯白 20 处、
 * 纯黑 10 处、#262626 与 hsl(0 0% 14.9%) 等共 6 组),grep 一种写法永远找不全同值的另一份;
 * 而当时没有任何判据在看"写法",门 93 只按变量名对账、门 323 只判 8 档与 alpha 数值。
 *
 * 定档规则(与门 323 R1 不冲突,alpha 角色本就要求 rgba()):
 *  - 不透明色(alpha=1) → `#rrggbb` 小写
 *  - 带透明度(alpha<1) → `rgba(r, g, b, a)` 逗号后带空格
 *  - 关键字 `transparent` 与 `var()` / `color-mix()` / 渐变原样保留
 *  - 同一个 (r,g,b,a) 只允许一种写法(同值异写 = 红)
 *
 * RN 侧(rn-tokens.ts)只判"形态可解析":hex 大小写不限(该文件由 sync-rn-tokens 派生,
 * 历史值大小写混合且门 93 按数值比较),但不得再出现 hsl()/oklch() 这类 RN 解析不了的写法。
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const here = dirname(fileURLToPath(import.meta.url))
const readSrc = (rel: string): string => readFileSync(join(here, rel), 'utf8')

const TOKENS_CSS = readSrc('../src/styles/tokens.css')
const RN_TOKENS = readSrc('../src/rn-tokens.ts')

const HEX6 = /^#[0-9a-f]{6}$/
const RGBA_CANON = /^rgba\(\d{1,3}, \d{1,3}, \d{1,3}, (?:0|1|0\.[0-9]+)\)$/
const ALPHA_ROLES = ['subtle', 'default', 'strong', 'inverse', 'field'] as const
const NON_LITERAL = /var\(|color-mix\(|gradient\(/

interface Decl {
  line: number
  name: string
  value: string
}

/** 取 `--x: value;` 声明行(注释与多行值天然不匹配,自动落在判面之外) */
function declsOf(src: string): Decl[] {
  const out: Decl[] = []
  src.split(/\r?\n/).forEach((line, i) => {
    const m = /^\s*(--[A-Za-z0-9-]+)\s*:\s*(.+?)\s*;\s*$/.exec(line)
    if (m) out.push({ line: i + 1, name: m[1], value: m[2].trim() })
  })
  return out
}

const isColorish = (v: string): boolean => /^#|^rgb|^hsl|^oklch|^hwb|^lab|^lch|^color\(/i.test(v)

/** 归一成 (r,g,b,a) 元组,用于"同值只有一种写法"的查重;无法解析返回 null */
function tupleOf(v: string): string | null {
  const hex = /^#([0-9a-fA-F]{6})$/.exec(v)
  if (hex) {
    const h = hex[1]
    return `${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},1`
  }
  const rgba = /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*([0-9.]+)\s*\)$/.exec(v)
  if (rgba) return `${+rgba[1]},${+rgba[2]},${+rgba[3]},${+rgba[4]}`
  return null
}

const literalDecls = declsOf(TOKENS_CSS).filter(
  (d) => isColorish(d.value) && !NON_LITERAL.test(d.value) && d.value !== 'transparent',
)

describe('tokens.css 颜色写法单一化', () => {
  it('不透明色一律 #rrggbb 小写,带透明度一律 rgba(r, g, b, a)', () => {
    const bad: string[] = []
    for (const d of literalDecls) {
      if (d.value.startsWith('#')) {
        if (!HEX6.test(d.value)) bad.push(`${d.line} ${d.name}: ${d.value}（hex 不是小写 6 位）`)
        continue
      }
      if (!RGBA_CANON.test(d.value))
        bad.push(`${d.line} ${d.name}: ${d.value}（非 rgba 规范形态或空格缺失）`)
    }
    expect(bad).toEqual([])
  })

  it('全文件不得再出现 hsl()/hsla()/oklch()/hwb()/lab()/lch() 字面值', () => {
    const bad = literalDecls
      .filter((d) => /^(hsl|hsla|oklch|hwb|lab|lch|color)\(/i.test(d.value))
      .map((d) => `${d.line} ${d.name}: ${d.value}`)
    expect(bad).toEqual([])
  })

  it('alpha 角色(subtle/default/strong/inverse/field)必须是 rgba() —— 与门 323 R1 同一条契约', () => {
    const bad: string[] = []
    for (const role of ALPHA_ROLES) {
      const hits = declsOf(TOKENS_CSS).filter((d) => d.name === `--color-stroke-${role}`)
      // 亮暗两档各一枚:取不到就是结构塌了,单独报红而不是空过
      expect(hits.length, `--color-stroke-${role} 亮/暗两档缺一`).toBeGreaterThanOrEqual(2)
      for (const h of hits) {
        if (!RGBA_CANON.test(h.value)) bad.push(`${h.line} ${h.name}: ${h.value}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('同一个颜色只有一种写法(同值异写 = 0)', () => {
    const groups = new Map<string, Map<string, string[]>>()
    for (const d of literalDecls) {
      const t = tupleOf(d.value)
      if (!t) continue
      const notation = d.value.startsWith('#') ? 'hex' : 'rgba'
      if (!groups.has(t)) groups.set(t, new Map())
      const inner = groups.get(t)!
      if (!inner.has(notation)) inner.set(notation, [])
      inner.get(notation)!.push(`${d.line} ${d.name}: ${d.value}`)
    }
    const conflicts = [...groups.entries()]
      .filter(([, v]) => v.size > 1)
      .map(
        ([t, v]) =>
          `rgb(${t}): ${[...v.entries()].map(([n, locs]) => `${n} → ${locs.join(' / ')}`).join(' ‖ ')}`,
      )
    expect(conflicts).toEqual([])
  })
})

describe('rn-tokens.ts 颜色字面量形态', () => {
  const quoted = [...RN_TOKENS.matchAll(/'([^']*)'|"([^"]*)"/g)].map((m) => m[1] ?? m[2])

  it('不得出现 RN 解析不了的 hsl()/oklch() 写法', () => {
    const bad = quoted.filter((v) => /^(hsl|hsla|oklch)\(/i.test(v.trim()))
    expect(bad).toEqual([])
  })

  it('颜色字符串只能是 #rrggbb(大小写不限)、rgba() 或 transparent', () => {
    const bad = quoted
      .map((v) => v.trim())
      .filter((v) => isColorish(v))
      .filter((v) => !/^#[0-9a-fA-F]{6}$/.test(v) && !/^rgba?\(\s*\d+/.test(v))
    expect(bad).toEqual([])
  })
})

describe('尺子自检(判据本身不得是装饰)', () => {
  it('合成样本里的 hsl 与同值异写都能被同一套解析抓到', () => {
    const sample = [
      ':root {',
      '  --a: hsl(0 0% 0%);',
      '  --b: #000000;',
      '  --c: rgba(0, 0, 0, 0.14);',
      '}',
    ].join('\n')
    const ds = declsOf(sample).filter((d) => isColorish(d.value))
    expect(ds.length).toBe(3)
    // hsl 残留可判
    expect(ds.filter((d) => /^hsl/.test(d.value)).length).toBe(1)
    // #000000 与 hsl(0 0% 0%) 同值:同值异写可判(hsl 自身 tuple 解析不出,故用 hex 唯一性反向验)
    expect(tupleOf('#000000')).toBe('0,0,0,1')
    expect(tupleOf('rgba(0, 0, 0, 0.14)')).toBe('0,0,0,0.14')
    expect(tupleOf('hsl(0 0% 0%)')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
