// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-need
/**
 * G-710:失败码判定的成对回归(出口 = tools/failure-classification.ts,守门 162 点名)。
 *
 * 三条能力各配一条反向对照 —— 只留正例的话,门可能只是把功能改坏了(AGENTS §5"测试口径"同一条):
 *  ① 有码 ⇒ 判定读码,**且不读文本**(用"文本与码互相矛盾"的夹具证明,而不是"文本恰好一致")
 *  ② 无码 ⇒ 兜底仍给出结论,**且这次使用被计数**(否则"降级为兜底"就等於"把能力删了")
 *  ③ 抛出方摘掉码 ⇒ 结论必须回落到兜底并被计数(变异自证:这条红了才说明 ① 不是恒真)
 *
 * 还钉了两条口径:
 *  - `resolveFailureCode` 读的是**码位**,不是措辞:同一段文本挂不同码 ⇒ 不同结论
 *  - 站点分档:兜底台账必须回答"是哪一处在读文本",不然它只是总量计数
 */
import { beforeEach, describe, expect, it } from 'vitest'

import {
  COMPACTION_TEXT_RULES,
  COMPACTION_TRANSIENT_FAILURE_CODES,
  FAILURE_CODES,
  FAILURE_TEXT_RULES,
  RETRYABLE_FAILURE_CODES,
  ToolError,
  classifyFailureText,
  formatFailureFallbackStats,
  getFailureFallbackStats,
  isFailureCode,
  isFatalFailureCode,
  isRetryableFailureCode,
  isTransientFailureCode,
  resetFailureFallbackStats,
  resolveFailureCode,
  structuredFailureCodeOf,
} from '../src/tools/failure-classification.js'
import { sampleWithRetry } from '../src/compaction-v2.js'

describe('FailureCode 闭集(单一真相源)', () => {
  it('票面要求的五档加 unknown 全部在闭集里,且闭集成员都是字符串', () => {
    for (const need of ['rate_limited', 'timeout', 'cancelled', 'driver', 'context_limit', 'unknown']) {
      expect(FAILURE_CODES).toContain(need)
    }
    expect(FAILURE_CODES.every((c) => typeof c === 'string')).toBe(true)
    expect(new Set(FAILURE_CODES).size).toBe(FAILURE_CODES.length)
  })

  it('isFailureCode 只认闭集:陌生串与大小写变体都不算(不得把"认不出"洗成 unknown)', () => {
    expect(isFailureCode('rate_limited')).toBe(true)
    expect(isFailureCode('RATE_LIMITED')).toBe(false)
    expect(isFailureCode('timeout-ish')).toBe(false)
    expect(isFailureCode(undefined)).toBe(false)
    expect(isFailureCode(429)).toBe(false)
  })
})

describe('ToolError:抛出方给码', () => {
  it('码在结构化通道上一路可见:resolveFailureCode 读到它,一次文本都不读', () => {
    resetFailureFallbackStats()
    const err = new ToolError('context_limit', '上下文已用满,原样重投没有意义')
    const r = resolveFailureCode(err, 'tool-retry')
    expect(r.code).toBe('context_limit')
    expect(r.via).toBe('structured')
    expect(r.fallbackUsed).toBe(false)
    expect(getFailureFallbackStats().total).toBe(0)
  })

  it('toJSON/fromJSON 往返保住码(跨日志/IPC 之后接收端仍不用读文本)', () => {
    const err = new ToolError('rate_limited', 'too many requests', { detail: { tool: 'read_file', windowMs: 10000 } })
    const json = err.toJSON()
    expect(json.code).toBe('rate_limited')
    expect(json.detail?.tool).toBe('read_file')
    const back = ToolError.fromJSON(JSON.parse(JSON.stringify(json)))
    expect(back).toBeInstanceOf(ToolError)
    expect(back?.code).toBe('rate_limited')
    // detail 只收标量:凭据面不得被顺手带进错误载荷
    expect(Object.values(back?.detail ?? {}).every((v) => typeof v !== 'object')).toBe(true)
  })

  it('fromJSON 认不出时返回 undefined,绝不替载荷编一个码', () => {
    expect(ToolError.fromJSON({ name: 'ToolError', code: 'made_up', message: 'x' })).toBeUndefined()
    expect(ToolError.fromJSON({ name: 'ToolError', message: 'x' })).toBeUndefined()
    expect(ToolError.fromJSON(null)).toBeUndefined()
  })

  it('cause 透传:包一层不许丢掉原始故障(排障时链尾才是答案)', () => {
    const inner = new Error('ECONNRESET')
    const outer = new ToolError('network', '工具调用失败', { cause: inner })
    expect(outer.cause).toBe(inner)
  })
})

describe('有码不读文本 / 无码兜底并计数', () => {
  beforeEach(() => resetFailureFallbackStats())

  it('成对 A:同一段文本,码不同 ⇒ 结论不同(证明判据不是文本)', () => {
    const a = resolveFailureCode(new ToolError('cancelled', 'rate limit exceeded'), 'tool-retry')
    const b = resolveFailureCode(new ToolError('rate_limited', 'rate limit exceeded'), 'tool-retry')
    expect(a.code).toBe('cancelled')
    expect(b.code).toBe('rate_limited')
    expect(isRetryableFailureCode(a.code)).toBe(false)
    expect(isRetryableFailureCode(b.code)).toBe(true)
    expect(getFailureFallbackStats().total).toBe(0)
  })

  it('成对 B:无码的纯文本仍然给出结论,并且这次使用被计数报名', () => {
    const r = resolveFailureCode(new Error('fetch failed by upstream'), 'compaction-sampling')
    expect(r.code).toBe('network')
    expect(r.via).toBe('text-fallback')
    expect(r.fallbackUsed).toBe(true)
    const stats = getFailureFallbackStats()
    expect(stats.total).toBe(1)
    expect(stats.bySite['compaction-sampling']).toBe(1)
    expect(stats.bySiteAndCode['compaction-sampling|network']).toBe(1)
    expect(formatFailureFallbackStats()).toContain('total=1')
  })

  it('变异自证:把抛码摘掉(留同一段文本),结论仍对但必须落进兜底计数', () => {
    const withCode = resolveFailureCode(new ToolError('timeout', 'x'), 'tool-retry')
    expect(withCode.via).toBe('structured')
    resetFailureFallbackStats()
    const withoutCode = resolveFailureCode(new Error('the wall clock ran out'), 'tool-retry')
    expect(withoutCode.code).toBe('unknown')
    expect(withoutCode.via).toBe('text-fallback')
    expect(getFailureFallbackStats().total).toBe(1)
  })

  it('结构化字段(显式码 / errno / HTTP status)都算有码,一次文本都不读', () => {
    expect(structuredFailureCodeOf({ status: 429 })).toBe('rate_limited')
    expect(structuredFailureCodeOf({ status: 408 })).toBe('timeout')
    expect(structuredFailureCodeOf({ status: 404 })).toBe('not_found')
    expect(structuredFailureCodeOf({ status: 200 })).toBeUndefined()
    expect(structuredFailureCodeOf({ code: 'EACCES' })).toBe('permission')
    expect(structuredFailureCodeOf({ code: 'ENOENT' })).toBe('not_found')
    expect(structuredFailureCodeOf({ code: 'ETIMEDOUT' })).toBe('timeout')
    expect(structuredFailureCodeOf(new ToolError('context_limit', '窗口已满'))).toBe('context_limit')
    expect(structuredFailureCodeOf('boom')).toBeUndefined()
    expect(structuredFailureCodeOf(undefined)).toBeUndefined()
    expect(getFailureFallbackStats().total).toBe(0)
  })

  it('坏 getter 不把判定升级成二次故障(与 error-serialize 的"永不抛"同一条)', () => {
    const hostile = {
      get code() {
        throw new Error('getter exploded')
      },
    }
    expect(() => structuredFailureCodeOf(hostile)).not.toThrow()
    expect(structuredFailureCodeOf(hostile)).toBeUndefined()
  })

  it('文案表是数据驱动的:两张表每条都有 code ∈ 闭集、label 串、且 needles/patterns 至少一项', () => {
    for (const rule of [...FAILURE_TEXT_RULES, ...COMPACTION_TEXT_RULES]) {
      expect(isFailureCode(rule.code)).toBe(true)
      expect(typeof rule.label).toBe('string')
      expect((rule.needles?.length ?? 0) > 0 || (rule.patterns?.length ?? 0) > 0).toBe(true)
    }
  })

  it('classifyFailureText 是纯文本档:大小写无关,未命中落 unknown(同样计数)', () => {
    expect(classifyFailureText('Request TIMEOUT', 'tools/classifyError').code).toBe('timeout')
    expect(classifyFailureText('完全无关的文本', 'tools/classifyError').code).toBe('unknown')
    expect(getFailureFallbackStats().total).toBe(2)
  })
})

describe('策略档:两个消费者读同一份码,策略差异显式登记', () => {
  it('工具面可重试集合逐字未变(network/timeout/rate_limited)', () => {
    expect([...RETRYABLE_FAILURE_CODES].sort()).toEqual(['network', 'rate_limited', 'timeout'])
  })

  it('致命档仍只有 permission;cancelled 不是"致命",是"别自作主张重来"', () => {
    expect(FAILURE_CODES.filter((c) => isFatalFailureCode(c))).toEqual(['permission'])
    expect(isFatalFailureCode('permission')).toBe(true)
    expect(isFatalFailureCode('cancelled')).toBe(false)
    expect(isFatalFailureCode('context_limit')).toBe(false)
  })

  it('压缩面瞬态档:rate_limited/timeout/network/driver/unknown;确定性档照旧不重试', () => {
    for (const c of COMPACTION_TRANSIENT_FAILURE_CODES) expect(isTransientFailureCode(c)).toBe(true)
    expect(isTransientFailureCode('context_limit')).toBe(false)
    expect(isTransientFailureCode('permission')).toBe(false)
    expect(isTransientFailureCode('cancelled')).toBe(false)
    expect(isTransientFailureCode('client_error')).toBe(false)
    expect(isTransientFailureCode('parse')).toBe(false)
    expect(isTransientFailureCode('not_found')).toBe(false)
  })
})

describe('压缩链路的端到端行为(sampleWithRetry 读码,不读措辞)', () => {
  beforeEach(() => resetFailureFallbackStats())

  it('sampler 抛 ToolError(rate_limited)⇒ 退避重试,而不是按 4xx 文本直接放弃', async () => {
    let calls = 0
    const r = await sampleWithRetry(
      [{ role: 'user', content: 'hi' }],
      {
        async sampleCompaction() {
          calls++
          if (calls < 2) throw new ToolError('rate_limited', '配额窗口已满(文本无关)')
          return { response: 'ok-response' }
        },
      },
      { maxAttempts: 3, retryDelayMs: 5, samplingTimeoutMs: 1000 },
    )
    expect(r.attempts).toBe(2)
    expect(r.statusLabel).toBe('ok')
    expect(getFailureFallbackStats().total).toBe(0)
  })

  it('sampler 抛 ToolError(context_limit)⇒ 立即放弃,不烧三次退避', async () => {
    let calls = 0
    await expect(
      sampleWithRetry(
        [{ role: 'user', content: 'hi' }],
        {
          async sampleCompaction() {
            calls++
            throw new ToolError('context_limit', '窗口已满')
          },
        },
        { maxAttempts: 3, retryDelayMs: 5 },
      ),
    ).rejects.toThrow(/context_limit/)
    expect(calls).toBe(1)
    expect(getFailureFallbackStats().total).toBe(0)
  })

  it('无码的文本错误仍然按既有文案归档(label 保住了 [4xx]),但这次使用被计数', async () => {
    let calls = 0
    await expect(
      sampleWithRetry(
        [{ role: 'user', content: 'hi' }],
        {
          async sampleCompaction() {
            calls++
            throw new Error('HTTP 400 Bad Request')
          },
        },
        { maxAttempts: 3, retryDelayMs: 5 },
      ),
    ).rejects.toThrow(/\[4xx\]/)
    expect(calls).toBe(1)
    expect(getFailureFallbackStats().total).toBe(1)
    expect(getFailureFallbackStats().bySite['compaction-sampling']).toBe(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
