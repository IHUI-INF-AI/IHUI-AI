// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 路由注册唯一性锁(2026-11-01 立)。
 *
 * 起因:一枚 union 归并把 `workbookRoutes` 连 import 带 register 各留了两份(两侧各自往
 * `routes/index.ts` 同一条腿上加过行)。重复 import 会被 tsc 判 TS2300 拦下,但**只重复
 * `server.register(...)` 那一行时类型面全绿**,而 Fastify 在启动时才抛
 * FST_ERR_DUPLICATED_ROUTE —— 于是"能不能起来"这个结论只能在生产启动那一刻才知道。
 * 本用例把这一格提前到测试面:静态读 `src/routes/index.ts`,同 (插件, 前缀) 出现两次即红。
 *
 * 判据口径(与 §22c 一致,不在测试里造第二套语义):
 * - 只认 `server.register(<标识符>, { prefix: '<字面量>' })` 这一形态(全文件唯一写法);
 *   匹配不到的行不参与判定(宁可漏判,不误拦合法的第二种注册形态)。
 * - 键 = 标识符 + 前缀逐字拼接;注释行(以 `//` 起始)整行跳过,免得文档里的示例被当注册。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const SOURCE = fileURLToPath(new URL('../src/routes/index.ts', import.meta.url))

/** `server.register(x, { prefix: '/api/x' })` ⇒ `x|/api/x`;形态不符返回 null */
function registerKeyOf(line: string): string | null {
  if (line.trimStart().startsWith('//')) return null
  const m = /server\.register\(\s*([A-Za-z0-9_$]+)\s*,\s*\{\s*prefix:\s*'([^']*)'/.exec(line)
  return m ? `${m[1]}|${m[2]}` : null
}

function duplicatedKeys(text: string): string[] {
  const seen = new Map<string, number>()
  for (const line of text.split(/\r?\n/)) {
    const key = registerKeyOf(line)
    if (key === null) continue
    seen.set(key, (seen.get(key) ?? 0) + 1)
  }
  return [...seen.entries()].filter(([, n]) => n > 1).map(([key, n]) => `${key} ×${n}`)
}

describe('routes/index.ts 路由注册唯一性', () => {
  it('同一 (插件, 前缀) 不得注册两次(重复注册只在 Fastify 启动时才炸)', () => {
    const text = readFileSync(SOURCE, 'utf8')
    const dup = duplicatedKeys(text)
    expect(dup, `重复注册会让服务起不来(FST_ERR_DUPLICATED_ROUTE):${dup.join(', ')}`).toEqual([])
  })

  it('判据本身有牙:把同一行复制一遍必须被点名', () => {
    const text = readFileSync(SOURCE, 'utf8')
    const sample = /\n(\s*)server\.register\(\s*[A-Za-z0-9_$]+\s*,\s*\{\s*prefix:\s*'[^']*'/.exec(
      text,
    )
    expect(
      sample,
      '源文件里一条注册都没解析到 ⇒ 本用例的形态假设已失效,须改判据而非放行',
    ).not.toBeNull()
    const tampered = `${text.slice(0, sample!.index)}${sample![0]}\n${sample![0]}${text.slice(sample!.index + sample![0].length)}`
    expect(duplicatedKeys(tampered).length).toBeGreaterThan(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
