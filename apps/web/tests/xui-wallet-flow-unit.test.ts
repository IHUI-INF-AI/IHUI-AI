// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// XUI-085: token_flows.quantity / balance_after 同列两义：
//   op_type 0–5 = 钱包金额（分）；op_type 6 = API 订阅配额计数（个）。
// GET /finance/margin/flows 是「钱流水」端点，默认不得把配额腿当金额返回。
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const WEB_ROOT = process.cwd()
const REPO_ROOT = join(WEB_ROOT, '..', '..')
const readRepo = (...p: string[]) => readFileSync(join(REPO_ROOT, ...p), 'utf8')

describe('XUI-085 token_flows 字段语义写清（分 / 配额计数）', () => {
  it('schema 注释写清同列两义：op_type 0–5 为分，op_type 6 为 API 配额', () => {
    const schema = readRepo('packages', 'database', 'src', 'schema', 'wallet.ts')
    expect(schema).toContain('op_type 6')
    expect(schema).toContain('配额')
    expect(schema).toContain('分')
  })

  it('钱流水端点默认排除 op_type=6（配额腿不是金额）', () => {
    const route = readRepo('apps', 'api', 'src', 'routes', 'finance.ts')
    expect(route).toMatch(/listTokenFlows\(userId, page, limit, opType, true\)/)
    const queries = readRepo('apps', 'api', 'src', 'db', 'commission-queries.ts')
    expect(queries).toMatch(/ne\(tokenFlows\.opType, 6\)/)
  })

  it('api-client 契约注释写明钱流水只含 op_type 0–5，金额单位分', () => {
    const client = readRepo('packages', 'api-client', 'src', 'endpoints', 'wallet.ts')
    expect(client).toContain('金额单位「分」')
    expect(client).toMatch(/op_type 0[–-]5/)
  })

  it('反例：把配额 500000 当分格式化会得到 ¥5000.00（所以必须排除而不是 /100）', () => {
    const asMoney = (cents: number) => (cents / 100).toFixed(2)
    expect(asMoney(500000)).toBe('5000.00')
    // 500000 是 API 配额（token 个），不是 ¥5000；钱腿只允许分
    expect(asMoney(19900)).toBe('199.00')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
