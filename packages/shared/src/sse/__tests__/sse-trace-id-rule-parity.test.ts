// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 帧级 traceId 值规则的**另一半对账**(与 packages/api-client/tests/stream-trace-id-parity.test.ts 同一张表)。
//
// 为什么要两边各跑一遍:`config/sse-trace-id-cases.json` 是**共享判据数据**,不共享文件。
// 两边各自绿只能证明"自己和自己一致";两把测试钉同一张表,才证明"两侧不会漂开"。
// 值提取在本测试里**故意用另一种机制**(正则找 `"traceId":"..."`,而不是复用任一实现的解析路径),
// 否则本测试就成了被检实现的复读机(AGENTS §22c)。
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { normalizeSSEFrameTraceId, SSE_TRACE_ID_PAYLOAD_KEY } from '../contract'

/** 往上找到放得下判据表的那一层 —— 数目录层数会在文件挪动时静默指错(本仓 ENOENT 被读成"判据没命中"过)。 */
function findRepoRoot(from: string): string {
  let dir = from
  for (let i = 0; i < 8; i += 1) {
    const candidate = join(dir, 'config', 'sse-trace-id-cases.json')
    if (readFileSyncExists(candidate)) return dir
    const parent = resolve(dir, '..')
    if (parent === dir) break
    dir = parent
  }
  throw new Error(`找不到 config/sse-trace-id-cases.json(从 ${from} 上溯 8 层)⇒ 判据表没读到,不得当成通过`)
}

function readFileSyncExists(p: string): boolean {
  try {
    readFileSync(p, 'utf8')
    return true
  } catch {
    return false
  }
}

const table = JSON.parse(
  readFileSync(
    join(findRepoRoot(dirname(fileURLToPath(import.meta.url))), 'config', 'sse-trace-id-cases.json'),
    'utf8',
  ),
) as { cases: Array<{ name: string; line: string; expect: string | null; lineOnly?: boolean }> }

describe('@ihui/shared 侧值规则 = 同一张共享判例表', () => {
  it('键名与表内样例一致(改名要同批改表,不得只改一侧)', () => {
    expect(SSE_TRACE_ID_PAYLOAD_KEY).toBe('traceId')
  })

  for (const c of table.cases) {
    // `lineOnly` = 这条案例的期望取决于**整行的解析形态**(是否 data: 前缀、是否 [DONE]、
    // 是否小程序自写传输层的 `1:{...}` 前缀、JSON 是否可解析),那是行级实现的判域,
    // 值规则函数看不到行 ⇒ 不能拿它去要求值规则一致。第一版没分这一层,当场被判例表揭出
    // "两侧对同一行的结论不同"——那不是 bug,是我拿错了比对对象(修法是把层级写进表,不是抹平差异)。
    if (c.lineOnly === true) continue
    const found = /"traceId"\s*:\s*"([^"]*)"/.exec(c.line)
    if (!found) {
      it(`${c.name}:表内无可提取值 ⇒ 期望必须是 null`, () => {
        expect(c.expect).toBeNull()
      })
      continue
    }
    it(`${c.name}:值规则判读一致`, () => {
      expect(normalizeSSEFrameTraceId(found[1])).toBe(c.expect ?? undefined)
    })
  }

  it('表的层级不能把对账掏空(值级案例必须留够,行级案例必须存在)', () => {
    expect(table.cases.filter((c) => c.lineOnly !== true).length).toBeGreaterThanOrEqual(8)
    expect(table.cases.filter((c) => c.lineOnly === true).length).toBeGreaterThanOrEqual(4)
  })

  it('正反例都存在(全正例的表证明不了任何事)', () => {
    expect(table.cases.some((c) => c.expect !== null)).toBe(true)
    expect(table.cases.filter((c) => c.expect === null).length).toBeGreaterThanOrEqual(5)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
