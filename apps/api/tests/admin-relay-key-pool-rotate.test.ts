// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池「换 Key」出口的形状锁(2026-10-24 立)。
 *
 * 立因:PUT 原本明确不更新 apiKeyEnc,换一把 key 只能"新增一条 + 手工删旧"两步。
 * 2026-10-24 01:17 那次换 key 只做了前半截,三枚已失效的退役行留在池子里,
 * 而大屏「异常 Key」按行计数 ⇒ 一把好 key 都没坏,格子却永久红。
 *
 * 两条断言各拦一种回潮:
 *  ① updateBodySchema 必须认 apiKey(取源码里的真 schema 求值,不在测试里抄第二份 —— §22c);
 *  ② apiKey 分支必须把"覆盖密文"和"复位健康态/连续失败计数"写在同一批里 ——
 *     只换密文会让上一轮的 down/熔断计数继续挂在新 key 上,正是本格变红的成因。
 * 另钉一条:计数键名必须 import 巡检服务的 CF_KEY,不得在路由里再写字面量。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { z } from 'zod'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROUTE = join(HERE, '..', 'src', 'routes', 'admin', 'relay-key-pool.ts')
const src = readFileSync(ROUTE, 'utf8')

/** 从源里取出 updateBodySchema 的真实定义并求值(跑的是 zod 本体,不是字符串比对)。 */
function loadUpdateBodySchema(): z.ZodType<Record<string, unknown>> {
  const m = src.match(/^const updateBodySchema = (z\.object\(\{[\s\S]*?\n\}\))/m)
  if (!m) throw new Error('relay-key-pool.ts 里找不到 updateBodySchema 定义块,形状漂了')
  return new Function('z', `return ${m[1]}`)(z) as z.ZodType<Record<string, unknown>>
}

/** 括号配对取出 apiKey 分支体(只到它自己的右花括号,不吃后面的代码)。 */
function extractApiKeyBranch(): string {
  const start = src.indexOf('if (d.apiKey !== undefined) {')
  if (start < 0) throw new Error('PUT 处理里没有 apiKey 分支 ⇒ 换 Key 出口被摘掉了')
  let depth = 0
  for (let i = src.indexOf('{', start); i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') {
      depth--
      if (depth === 0) return src.slice(start, i + 1)
    }
  }
  throw new Error('apiKey 分支花括号不配对')
}

const schema = loadUpdateBodySchema()

describe('号池换 Key 出口', () => {
  it('① PUT 认 apiKey,且留空/缺省都不破坏原有字段', () => {
    expect(schema.parse({ apiKey: 'sk-abcdef123456' }).apiKey).toBe('sk-abcdef123456')
    // 不给 apiKey ⇒ 走原语义(只改名称等),不得把 apiKey 变成必填
    expect(schema.parse({ name: 'x' }).apiKey).toBeUndefined()
    // 空串必须拒:否则等于"用一把空 key 覆盖掉能用的那把"
    expect(schema.safeParse({ apiKey: '' }).success).toBe(false)
  })

  it('② apiKey 分支同批覆盖密文并复位健康态与连续失败计数', () => {
    const branch = extractApiKeyBranch()
    for (const need of [
      'apiKeyEnc',
      'keyPrefix',
      "healthStatus = 'unknown'",
      'healthCheckedAt = null',
      'lastErrorMessage = null',
      'CF_KEY',
    ]) {
      expect(branch, `apiKey 分支缺 ${need}`).toContain(need)
    }
    // 复位必须写 0,写成别的值等于没复位
    expect(branch).toMatch(/\[CF_KEY\]:\s*0/)
  })

  it('③ 计数键名走巡检服务的 CF_KEY 单源,不在路由里复写字面量', () => {
    expect(src).toMatch(/import \{[^}]*CF_KEY[^}]*\} from '.*relay-health-check-service\.js'/)
    const literals = (src.match(/['"]consecutiveFailures['"]/g) ?? []).length
    expect(literals, `路由里出现 ${literals} 处字面量 consecutiveFailures`).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
