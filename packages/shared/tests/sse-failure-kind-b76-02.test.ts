// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// b76-02 票1:失败 kind 决定「可重试」还是「必须换一条路」。
// 断言打在共享层唯一判据出口(resolveSseFailureDisposition / classifyHttpFailureKind,
// packages/shared/src/sse/contract.ts)上 —— 这正是 api-client 失败→ApiResult 与
// web 错误态组件重试闸门要共同消费的那份数据,不是平行导出。
import { describe, expect, it } from 'vitest'

import {
  classifyHttpFailureKind,
  resolveSseFailureDisposition,
  SSE_FAILURE_KINDS,
} from '../src/sse/contract'

describe('b76-02 失败 kind 字段级判据', () => {
  it('可重试档(限流带 retry-after)产出重试计划,canRetry=true', () => {
    const r = resolveSseFailureDisposition('rate_limited', { retryAfterSeconds: 30 })
    expect(r.disposition).toBe('retry-same-path')
    expect(r.canRetry).toBe(true)
    expect(r.retryPlan).toBeDefined()
    // retryAfterSeconds=30 ⇒ retryInMs=30000(不是拍脑袋的退避)
    expect(r.retryPlan?.retryInMs).toBe(30000)
    // 瞬时档没有 retry-after,按基数指数退避
    const t = resolveSseFailureDisposition('transient', { attempt: 1 })
    expect(t.canRetry).toBe(true)
    expect(t.retryPlan?.retryInMs).toBe(2000)
  })

  it('换路档(凭据被拒/端点不可用)产出 switch-path,且不得自动重发(无 retryPlan)', () => {
    for (const kind of ['credentials_rejected', 'endpoint_unavailable'] as const) {
      const r = resolveSseFailureDisposition(kind)
      expect(r.disposition).toBe('switch-path')
      // 换路不是重试:UI 重试闸门在 canRetry=false 时不渲染重试按钮
      expect(r.canRetry).toBe(false)
      // 不带 retryPlan ⇒ 调用方结构上无法"自动重发同路"
      expect(r.retryPlan).toBeUndefined()
    }
  })

  it('确定失败档(契约不匹配)canRetry=false ⇒ UI 不渲染重试入口', () => {
    const r = resolveSseFailureDisposition('contract_mismatch')
    expect(r.disposition).toBe('terminal')
    expect(r.canRetry).toBe(false)
    expect(r.retryPlan).toBeUndefined()
    // HTTP 侧 SCHEMA_MISMATCH 归到同一档(码面上 4xx 不该被误判成可重试)
    expect(classifyHttpFailureKind(422, 'SCHEMA_MISMATCH')).toBe('contract_mismatch')
  })

  it('HTTP 归类:429→限流(带 retry-after 的可重试档)、401/403→凭据被拒(换路档)', () => {
    expect(classifyHttpFailureKind(429)).toBe('rate_limited')
    expect(
      resolveSseFailureDisposition(classifyHttpFailureKind(429), { retryAfterSeconds: 5 })
        .disposition,
    ).toBe('retry-same-path')
    expect(classifyHttpFailureKind(401)).toBe('credentials_rejected')
    expect(classifyHttpFailureKind(403)).toBe('credentials_rejected')
    expect(
      resolveSseFailureDisposition(classifyHttpFailureKind(401)).disposition,
    ).toBe('switch-path')
    expect(classifyHttpFailureKind(503)).toBe('endpoint_unavailable')
    expect(classifyHttpFailureKind(500)).toBe('transient')
  })

  it('重试预算耗尽后,可重试档也转 terminal(不再"再试一次")', () => {
    const r = resolveSseFailureDisposition('rate_limited', { attempt: 3 })
    expect(r.disposition).toBe('terminal')
    expect(r.canRetry).toBe(false)
  })

  it('kind 集合封闭且每个 kind 都有唯一处置结论', () => {
    expect(SSE_FAILURE_KINDS).toHaveLength(6)
    for (const kind of SSE_FAILURE_KINDS) {
      const r = resolveSseFailureDisposition(kind)
      expect(['retry-same-path', 'switch-path', 'terminal']).toContain(r.disposition)
      expect(typeof r.canRetry).toBe('boolean')
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
