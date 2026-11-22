// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-1018306(2026-09-29 立):partial 载体与 error 载体不得同形 —— 契约两侧同形对账 + "partial 不带 error 键"用例。
 *
 * 票面:截断的部分结果须走自己的字段(tool-delta 的 partialText/truncated),不得伪装成 error.message。
 * 本文件只做对账与用例(票面验收即这两件),不改生产代码 —— wire 两侧的形状声明此前已在
 * (TS:contract.ts 判别联合两成员 + toolDeltaSchema .strict();PY:sse_contract.py 两条
 * SSEEventContract 元组),缺的是把它们钉在同一张对账上的钉子:
 *  ① 两侧同形:tool-delta(partial 载体)与 error(error 载体)的键集,TS 侧与 PY 侧逐键等值;
 *  ② 不得同形:两个载体的键集交集为空(TS / PY 各自独立量,任何一侧出现交集即红);
 *  ③ 用例:tool-delta 帧携带 error 键 ⇒ 帧级 schema 唯一出口判 SCHEMA_MISMATCH 并点名 error;
 *    不带 ⇒ 通过。partial 想借 error 载体说话,在唯一出口就被 typed fault 拦下,不冒充错误帧。
 *
 * 取材面纪律:PY 侧声明抽自 sse_contract.py 源码(锚点恰好 1 处,0 / 多义都拒);
 * TS 侧 tool-delta 键集从 SSE_FRAME_SCHEMAS 的 zod shape **现量**(行为,不是文本);
 * TS 侧 error 成员无 schema 登记(表外交既有解析层),键集从契约源码段结构抽取(同 G-816035 段锚法)。
 *
 * 残余(如实登记,不由本文件掩盖):PY 侧出站判据 sse_frame_schema_fault 的枚举/必要对表
 * 尚未登记 tool-delta(TS 侧 .strict() 的键闭合在 PY 侧无镜像)。按 sse_contract.py 自己的
 * 头注,出站组装点接入属 llm.py 现场、由主会话统一排期 —— 不在本票验收内。
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { parseSseFrameSchema, SSE_FRAME_SCHEMAS } from '../src/sse/contract'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '../../..')
const PY_CONTRACT_REL = 'apps/ai-service/app/core/sse_contract.py'
const TS_CONTRACT_REL = 'packages/shared/src/sse/contract.ts'
const pyText = readFileSync(resolve(REPO, PY_CONTRACT_REL), 'utf8')
const tsText = readFileSync(resolve(REPO, TS_CONTRACT_REL), 'utf8')

function countOccurrences(haystack: string, needle: string): number {
  let n = 0
  for (let i = haystack.indexOf(needle); i >= 0; i = haystack.indexOf(needle, i + needle.length))
    n++
  return n
}

/** 抽 PY 侧 SSEEventContract("事件", ("键", …)) 的键清单;声明必须恰好命中 1 处(0/多义都拒,不猜)。 */
function pyContractKeys(event: string): string[] {
  const re = new RegExp(`SSEEventContract\\(\\s*"${event}"\\s*,\\s*\\(([^)]*)\\)`, 'g')
  const hits = [...pyText.matchAll(re)]
  if (hits.length !== 1) {
    throw new Error(
      `${PY_CONTRACT_REL} 里 ${event} 的 SSEEventContract 声明命中 ${hits.length} 处(须恰好 1)⇒ 判据没跑到,不得当成通过`,
    )
  }
  return [...hits[0][1].matchAll(/"([A-Za-z_][A-Za-z0-9_]*)"/g)].map((m) => m[1])
}

/** TS 侧 tool-delta 键集:从帧级 schema 登记表的 zod shape 现量(登记缺失即判据没跑到,不冒充通过)。 */
function tsToolDeltaKeys(): string[] {
  const schema = SSE_FRAME_SCHEMAS['tool-delta'] as { shape?: Record<string, unknown> } | undefined
  if (!schema?.shape) {
    throw new Error('SSE_FRAME_SCHEMAS 里没有 tool-delta 的对象 schema ⇒ 键集现量不到,不得当成通过')
  }
  return Object.keys(schema.shape)
}

/** TS 侧判别成员的载荷键集:契约源码段结构抽取(锚点 `type: '<名>'` 恰好 1 处;剥掉判别位)。 */
function tsPayloadKeys(discriminator: string): string[] {
  const anchor = `type: '${discriminator}'`
  const n = countOccurrences(tsText, anchor)
  if (n !== 1) {
    throw new Error(
      `${TS_CONTRACT_REL} 里成员锚点 ${anchor} 命中 ${n} 处(须恰好 1)⇒ 判据没跑到,不得当成通过`,
    )
  }
  const start = tsText.indexOf(anchor)
  const end = tsText.indexOf('}>', start)
  if (end < 0) throw new Error(`${discriminator} 成员闭合形态认不出 ⇒ 判据没跑到,不得当成通过`)
  const seg = tsText.slice(start, end)
  return [...seg.matchAll(/^\s*([A-Za-z_][A-Za-z0-9_]*)(\?)?:/gm)]
    .map((m) => m[1])
    .filter((k) => k !== 'type')
}

describe('G-1018306 partial 载体与 error 载体不得同形(两侧对账)', () => {
  const pyToolDelta = pyContractKeys('tool-delta')
  const pyError = pyContractKeys('error')
  const tsToolDelta = tsToolDeltaKeys()
  const tsError = tsPayloadKeys('error')

  it('两侧同形:tool-delta(partial 载体)键集 TS ≡ PY,partialText/truncated 在场', () => {
    expect([...tsToolDelta].sort()).toEqual([...pyToolDelta].sort())
    expect(pyToolDelta).toContain('partialText')
    expect(pyToolDelta).toContain('truncated')
  })

  it('两侧同形:error(error 载体)键集 TS ≡ PY,恒为 message/errorCode', () => {
    expect([...tsError].sort()).toEqual([...pyError].sort())
    expect(pyError).toEqual(['message', 'errorCode'])
  })

  it('不得同形:两个载体的键集交集为空(TS / PY 各自独立量)', () => {
    expect(tsToolDelta.filter((k) => tsError.includes(k))).toEqual([])
    expect(pyToolDelta.filter((k) => pyError.includes(k))).toEqual([])
  })

  it('用例:partial 不带 error 键 —— tool-delta 帧携带 error 键 ⇒ typed fault 并点名 error', () => {
    const withError = parseSseFrameSchema('tool-delta', {
      toolCallId: 'c1',
      seq: 1,
      partialText: '截至当前的整段预览',
      error: { message: 'boom', errorCode: 'E1' },
    })
    expect(withError.ok).toBe(false)
    if (!withError.ok) {
      expect(withError.fault.code).toBe('SCHEMA_MISMATCH')
      expect(withError.fault.issues.join('\n')).toContain('error')
    }
  })

  it('正向对照:同一载荷不带 error 键 ⇒ 通过(truncated 照常在自己的字段上承载)', () => {
    const ok = parseSseFrameSchema('tool-delta', {
      toolCallId: 'c1',
      seq: 1,
      partialText: 'x',
      truncated: true,
    })
    expect(ok.ok).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
