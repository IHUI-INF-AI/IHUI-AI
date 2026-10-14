import { describe, expect, it } from 'vitest'
import {
  attributeError,
  listAttributionRules,
  ERROR_ATTRIBUTION_RULE_IDS,
  UNATTRIBUTED_RULE_ID,
} from '../error-attribution.js'
import type { ErrorSource, FailureReason } from '../error-attribution.js'

/**
 * G-816012:错误归因唯一出口的成对用例。
 * 一半钉"命中各档 ⇒ 原子返回 {errorSource, failureReason}",另一半钉"全未命中 ⇒ 落 unknown
 * 并在返回值里报名"—— 只测命中不测未命中,等于把"禁止默认归 provider"那条纪律留在口头。
 */
describe('attributeError(G-816012 错误归因唯一出口)', () => {
  it('命中 storage 档:PG 22P02 uuid 语法错误 ⇒ invalid-identifier(agent-creation 404 档)', () => {
    expect(attributeError(new Error('invalid input syntax for type uuid: "xyz"'))).toEqual({
      errorSource: 'storage',
      failureReason: 'invalid-identifier',
      ruleId: 'storage.pg-uuid-syntax',
      attributed: true,
    })
  })

  it('命中 config 档:文案含「未配置」⇒ not-configured(coze-oauth 400 档,不是 500 也不是重试)', () => {
    expect(attributeError(new Error('Coze OAuth client_id 未配置'))).toEqual({
      errorSource: 'config',
      failureReason: 'not-configured',
      ruleId: 'config.missing',
      attributed: true,
    })
  })

  it('命中 capacity 档:Bulkhead rejected ⇒ concurrency-limit(workspace 503 档)', () => {
    expect(attributeError(new Error('Bulkhead rejected (limit=32)'))).toEqual({
      errorSource: 'capacity',
      failureReason: 'concurrency-limit',
      ruleId: 'capacity.bulkhead',
      attributed: true,
    })
  })

  it('命中 transport.timeout 档:name = AbortError / TimeoutError ⇒ timeout', () => {
    const abort = new Error('The operation was aborted')
    abort.name = 'AbortError'
    expect(attributeError(abort)).toEqual({
      errorSource: 'transport',
      failureReason: 'timeout',
      ruleId: 'transport.abort',
      attributed: true,
    })
    const timeout = new Error('fetch timed out')
    timeout.name = 'TimeoutError'
    expect(attributeError(timeout).failureReason).toBe('timeout')
    expect(attributeError(timeout).ruleId).toBe('transport.abort')
  })

  it('命中 transport.timeout 档:中英两个 needle + errno 同一档(im-outbound-policy 两侧判据)', () => {
    expect(attributeError(new Error('上游回复超时,已放弃'))).toEqual({
      errorSource: 'transport',
      failureReason: 'timeout',
      ruleId: 'transport.timeout',
      attributed: true,
    })
    expect(attributeError(new Error('socket hang up: timeout on read')).ruleId).toBe('transport.timeout')
    const errnoTimeout = Object.assign(new Error('connect failed'), { code: 'ETIMEDOUT' })
    expect(attributeError(errnoTimeout)).toEqual({
      errorSource: 'transport',
      failureReason: 'timeout',
      ruleId: 'transport.timeout',
      attributed: true,
    })
    const errnoEsT = Object.assign(new Error('sock read'), { code: 'ESOCKETTIMEDOUT' })
    expect(attributeError(errnoEsT).failureReason).toBe('timeout')
  })

  it('命中 transport.executable-busy 档:ETXTBSY(code 与消息两种载体)+ ENOEXEC ⇒ executable-busy', () => {
    expect(attributeError(Object.assign(new Error('spawn failed'), { code: 'ETXTBSY' }))).toEqual({
      errorSource: 'transport',
      failureReason: 'executable-busy',
      ruleId: 'transport.executable-busy',
      attributed: true,
    })
    expect(attributeError(new Error('Text file busy (ETXTBSY)')).failureReason).toBe('executable-busy')
    expect(attributeError(Object.assign(new Error('exec format error'), { code: 'ENOEXEC' })).failureReason).toBe(
      'executable-busy',
    )
  })

  it('命中 transport.network 档:errno 表 + 消息载体 ⇒ network(http-utils / developer 提示档)', () => {
    expect(attributeError(Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:8802'), { code: 'ECONNRESET' }))).toEqual(
      {
        errorSource: 'transport',
        failureReason: 'network',
        ruleId: 'transport.network',
        attributed: true,
      },
    )
    expect(attributeError(new Error('fetch failed')).failureReason).toBe('network')
    expect(attributeError(new Error('connect ECONNREFUSED 127.0.0.1:8802')).failureReason).toBe('network')
    const refused = Object.assign(new Error('connect'), { code: 'ECONNREFUSED' })
    expect(attributeError(refused).ruleId).toBe('transport.network')
  })

  it('求值顺序:业务档先于通用传输档(文案里出现 timeout 不得被读成超时)', () => {
    const attribution = attributeError(new Error('Bulkhead rejected after timeout window'))
    expect(attribution.errorSource).toBe('capacity')
    expect(attribution.failureReason).toBe('concurrency-limit')
  })

  it('全未命中 ⇒ 落 unknown 并**三字段同时报名**(禁止默认归 provider/任何具体档)', () => {
    expect(attributeError(new Error('boom'))).toEqual({
      errorSource: 'unknown',
      failureReason: 'unattributed',
      ruleId: UNATTRIBUTED_RULE_ID,
      attributed: false,
    })
    // provider 502 腔:不得被读成 transport/任何 provider 档 —— 报名等立档,不是静默降级
    const provider502 = attributeError(new Error('upstream provider returned 502 Bad Gateway, please retry'))
    expect(provider502.errorSource).toBe('unknown')
    expect(provider502.attributed).toBe(false)
    expect(provider502.ruleId).toBe(UNATTRIBUTED_RULE_ID)
  })

  it('未命中报名位:attributed:false / ruleId:unattributed / failureReason:unattributed 缺一不可', () => {
    const attribution = attributeError(new Error('some novel failure'))
    expect(attribution.attributed).toBe(false)
    expect(attribution.ruleId).toBe(UNATTRIBUTED_RULE_ID)
    expect(attribution.failureReason).toBe('unattributed')
    expect(attribution.errorSource).toBe('unknown')
  })

  it('非 Error / 非对象输入不抛错,同样落 unknown 报名', () => {
    for (const input of [null, undefined, 42, 'plain string', true, { nope: 1 }]) {
      const attribution = attributeError(input)
      expect(attribution).toEqual({
        errorSource: 'unknown',
        failureReason: 'unattributed',
        ruleId: UNATTRIBUTED_RULE_ID,
        attributed: false,
      })
    }
  })

  it('读取边界:只读顶层三字段,不走 cause 链(链上命中也按未命中报名)', () => {
    const wrapped = new Error('boom')
    wrapped.cause = new Error('invalid input syntax for type uuid')
    expect(attributeError(wrapped).attributed).toBe(false)
    expect(attributeError(wrapped).errorSource).toBe('unknown')
    // 非字符串字段视为缺席:code 是数字 / message 是数字 ⇒ 不参与命中
    expect(attributeError({ message: 123, code: 42 }).attributed).toBe(false)
    expect(attributeError({ message: null, code: 'ECONNRESET', name: null }).attributed).toBe(true)
  })

  it('结构断言:规则 id 唯一,且 unattributed 不由任何规则产出', () => {
    expect(new Set(ERROR_ATTRIBUTION_RULE_IDS).size).toBe(ERROR_ATTRIBUTION_RULE_IDS.length)
    for (const rule of listAttributionRules()) {
      expect(rule.id).not.toBe(UNATTRIBUTED_RULE_ID)
      expect(rule.failureReason).not.toBe('unattributed')
      expect(rule.errorSource).not.toBe('unknown')
    }
  })

  it('结构断言:needle / errno / name 跨规则两两不相交(共享 = 第二条不可达的重复规则)', () => {
    const rules = listAttributionRules()
    for (const key of ['needles', 'errnos', 'names'] as const) {
      const seen = new Map<string, string>()
      for (const rule of rules) {
        for (const token of rule[key]) {
          const owner = seen.get(token)
          expect(owner === undefined || owner === rule.id).toBe(true)
          if (owner === undefined) seen.set(token, rule.id)
        }
      }
    }
  })

  it('结构断言:归因结果落在封闭集内(低基数,不是自由文本)', () => {
    const sources: ErrorSource[] = ['transport', 'storage', 'config', 'capacity', 'unknown']
    const reasons: FailureReason[] = [
      'timeout',
      'network',
      'executable-busy',
      'invalid-identifier',
      'not-configured',
      'concurrency-limit',
      'unattributed',
    ]
    const samples = [
      new Error('invalid input syntax for type uuid'),
      new Error('未配置'),
      new Error('Bulkhead rejected'),
      new Error('超时'),
      new Error('fetch failed'),
      new Error('boom'),
    ]
    for (const sample of samples) {
      const attribution = attributeError(sample)
      expect(sources).toContain(attribution.errorSource)
      expect(reasons).toContain(attribution.failureReason)
    }
  })
})
