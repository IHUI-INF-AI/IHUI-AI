// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 帧级 traceId 判据的**跨包对账**(D174 到端那一半)。
// 背景:值规则在两个包里各有一份实现(@ihui/shared 的 normalizeSSEFrameTraceId、
// 本包的 readStreamTraceId —— 本包不依赖 shared,加依赖就是未声明的幽灵依赖)。
// 两份实现只靠一张共享判例表 `config/sse-trace-id-cases.json` 钉住:两侧各跑同一张表,
// 任何一侧改规则而不同步表,这一侧就红。**这张表不是本测试的夹具,是两侧共同的判据**。
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { readStreamTraceId } from '../src/client'

/** 上溯找仓库根(数层数会在文件挪动后静默指错,ENOENT 会被读成"判据没命中")。 */
function findRepoRoot(from: string): string {
  let dir = from
  for (let i = 0; i < 8; i += 1) {
    try {
      readFileSync(join(dir, 'config', 'sse-trace-id-cases.json'), 'utf8')
      return dir
    } catch {
      const parent = resolve(dir, '..')
      if (parent === dir) break
      dir = parent
    }
  }
  throw new Error(`找不到 config/sse-trace-id-cases.json(从 ${from} 上溯 8 层)⇒ 判据表没读到,不得当成通过`)
}

const table = JSON.parse(
  readFileSync(join(findRepoRoot(dirname(fileURLToPath(import.meta.url))), 'config', 'sse-trace-id-cases.json'), 'utf8'),
) as { cases: Array<{ name: string; line: string; expect: string | null }> }

describe('api-client 侧帧级 traceId 判读 = 共享判例表', () => {
  it('判例表非空且正反例都有(空表 / 全正例 ⇒ 这把对账是空转)', () => {
    expect(table.cases.length).toBeGreaterThanOrEqual(8)
    expect(table.cases.filter((c) => c.expect !== null).length).toBeGreaterThanOrEqual(2)
    expect(table.cases.filter((c) => c.expect === null).length).toBeGreaterThanOrEqual(5)
  })

  for (const c of table.cases) {
    it(c.name, () => {
      expect(readStreamTraceId(c.line)).toBe(c.expect)
    })
  }

  it('同一条流里多次出现同值只认一次语义(值稳定,不随大小写漂移)', () => {
    const line = 'data: {"traceId":"0AF7651916CD43DD8448EB211C80319C"}'
    expect(readStreamTraceId(line)).toBe(readStreamTraceId(line).toLowerCase())
    expect(readStreamTraceId(line)).toBe('0af7651916cd43dd8448eb211c80319c')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
