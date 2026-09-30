// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

/**
 * 守门:并发档位字面量唯一性 + AIMD 常量表 ⊇ 裸数字。
 *
 * 两面判据(同形于 WORLD_READ_CAPS 一族"数字即契约、住在纯包、两侧断言同一份常量"):
 *  1. 并发档位字面量(`?? 4` / `= 4` / `Math.min(16`)在并发派发面五个调用点文件中
 *     只允许出现在 concurrency-budget.ts 一处(它自述"唯一允许出现并发档位字面量的地方")。
 *  2. concurrency-budget.ts 内除常量声明与结构性 0/1/-1 外,不得再出现裸数字——
 *     AIMD 五常量 + MAX/MIN + CPU 兜底就是全部档位真相,加档必须先改常量表。
 */

const here = path.dirname(fileURLToPath(import.meta.url))
const BUDGET = path.resolve(here, '../src/subagents/concurrency-budget.ts')

/** 票面调用点清单(逐条抄自 concurrency-budget.ts 头注,勿按旧文档派单)。 */
const CALLSITE_FILES = [
  '../src/subagents/worker-pool.ts',
  '../src/commands/subagent-collab.ts',
  '../src/commands/subagent-parallel.ts',
  '../src/tools/subagent.ts',
]

const LITERAL_PATTERNS: Array<[RegExp, string]> = [
  [/\?\?\s*4\b/g, '`?? 4`'],
  [/(?<![=!<>])=(?!=)\s*4\b/g, '`= 4`(赋值/默认值,不含 === 4 比较语义)'],
  [/Math\.min\(\s*16\b/g, '`Math.min(16`'],
]

/** 剔除注释(// 行注释与 /* 块注释)与字符串字面量后剩余的"代码体"。 */
function stripCommentsAndStrings(src: string): string {
  let out = ''
  let i = 0
  let mode: 'code' | 'line' | 'block' | 'sq' | 'dq' | 'tpl' = 'code'
  while (i < src.length) {
    const ch = src[i] as string
    const next = i + 1 < src.length ? (src[i + 1] as string) : ''
    if (mode === 'line') {
      if (ch === '\n') {
        mode = 'code'
        out += '\n'
      }
      i += 1
      continue
    }
    if (mode === 'block') {
      if (ch === '*' && next === '/') {
        mode = 'code'
        out += ' '
        i += 2
        continue
      }
      i += 1
      continue
    }
    if (mode === 'sq' || mode === 'dq' || mode === 'tpl') {
      if (ch === '\\') {
        i += 2 // 跳过转义对
        continue
      }
      const closed = (mode === 'sq' && ch === "'") || (mode === 'dq' && ch === '"') || (mode === 'tpl' && ch === '`')
      if (closed) mode = 'code'
      i += 1
      continue
    }
    // mode === 'code'
    if (ch === '/' && next === '/') {
      mode = 'line'
      i += 2
      continue
    }
    if (ch === '/' && next === '*') {
      mode = 'block'
      i += 2
      continue
    }
    if (ch === "'") {
      mode = 'sq'
      out += ' '
      i += 1
      continue
    }
    if (ch === '"') {
      mode = 'dq'
      out += ' '
      i += 1
      continue
    }
    if (ch === '`') {
      mode = 'tpl'
      out += ' '
      i += 1
      continue
    }
    out += ch
    i += 1
  }
  return out
}

/** 收集 const 常量声明里的数字字面量值(唯一真相源表)。 */
function collectConstValues(src: string): Set<string> {
  const values = new Set<string>()
  const re = /(?:^|\n)\s*(?:export\s+)?const\s+[A-Z_0-9]+\s*=\s*(-?\d[\d_]*(?:\.\d+)?)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    values.add((m[1] as string).replace(/_/g, ''))
  }
  return values
}

/** 结构性小整数:索引/计数语义,不是档位。 */
const STRUCTURAL = new Set(['0', '1', '-1'])

describe('守门:并发档位字面量唯一性 + AIMD 常量表覆盖', () => {
  it('并发派发面调用点不得出现并发档位字面量(注释剔除后)', () => {
    for (const rel of CALLSITE_FILES) {
      const file = path.resolve(here, rel)
      const raw = readFileSync(file, 'utf8')
      const src = stripCommentsAndStrings(raw)
      for (const [re, label] of LITERAL_PATTERNS) {
        const hits = [...src.matchAll(re)]
        expect(hits, `${rel} 出现并发档位字面量 ${label}(应经 resolveMaxConcurrency/AIMD 常量)`).toEqual([])
      }
    }
  })

  it('concurrency-budget.ts:常量表 ⊇ 代码体裸数字(除结构性 0/1/-1)', () => {
    const raw = readFileSync(BUDGET, 'utf8')
    const consts = collectConstValues(raw)
    // 常量表本身至少要含 MAX/MIN/AIMD 五常量与 CPU 兜底
    expect(consts.has('16')).toBe(true) // MAX_CONCURRENCY
    expect(consts.has('1')).toBe(true) // MIN_CONCURRENCY / AIMD_ADDITIVE_STEP
    expect(consts.has('2')).toBe(true) // CPU_UNREADABLE_FALLBACK
    expect(consts.has('8')).toBe(true) // AIMD_EPOCH_BATCH / AIMD_LASTGOOD_STREAK
    expect(consts.has('0.75')).toBe(true) // AIMD_DECREASE_FACTOR
    expect(consts.has('300000')).toBe(true) // AIMD_IDLE_RESET_MS
    const body = stripCommentsAndStrings(raw)
    const nums = new Set<string>()
    const re = /-?\b\d[\d_]*(?:\.\d+)?\b/g
    let m: RegExpExecArray | null
    while ((m = re.exec(body)) !== null) {
      nums.add((m[0] as string).replace(/_/g, ''))
    }
    const offenders: string[] = []
    for (const n of nums) {
      if (STRUCTURAL.has(n)) continue
      if (consts.has(n)) continue
      offenders.push(n)
    }
    expect(offenders, `裸数字 ${offenders.join(',')} 不在常量表:加档先改常量声明`).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
