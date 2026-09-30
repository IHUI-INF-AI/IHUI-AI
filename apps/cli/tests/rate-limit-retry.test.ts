// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it, beforeEach } from 'vitest'
import {
  registerTools,
  clearTools,
  executeToolCall,
  checkRateLimit,
  resetRateLimiter,
  setGlobalRateLimitOpts,
  executeWithRetry,
  classifyError,
  isRetryableErrorType,
  isFatalErrorType,
  type Tool,
  type ToolContext,
} from '../src/tools/index.js'
import {
  ToolError,
  resolveFailureCode,
  getFailureFallbackStats,
  resetFailureFallbackStats,
} from '../src/tools/failure-classification.js'
import type { FailureCode } from '@ihui/types'

const ctx: ToolContext = { workspacePath: '.' }

describe('checkRateLimit 滑动窗口', () => {
  beforeEach(() => {
    resetRateLimiter()
  })

  it('未达上限允许调用', () => {
    for (let i = 0; i < 5; i++) {
      const r = checkRateLimit('tool_a')
      expect(r.allowed).toBe(true)
      expect(r.reason).toBeUndefined()
    }
  })

  it('达上限(第 6 次)拒绝', () => {
    for (let i = 0; i < 5; i++) checkRateLimit('tool_b')
    const r = checkRateLimit('tool_b')
    expect(r.allowed).toBe(false)
    expect(r.reason).toContain('tool_b')
    expect(r.reason).toContain('限流')
  })

  it('不同工具独立计数', () => {
    for (let i = 0; i < 5; i++) checkRateLimit('tool_x')
    expect(checkRateLimit('tool_x').allowed).toBe(false)
    expect(checkRateLimit('tool_y').allowed).toBe(true)
  })

  it('自定义窗口参数', () => {
    for (let i = 0; i < 3; i++) checkRateLimit('tool_c', { maxCalls: 3 })
    const r = checkRateLimit('tool_c', { maxCalls: 3 })
    expect(r.allowed).toBe(false)
    expect(r.reason).toContain('上限 3')
  })

  it('滑动窗口:旧时间戳被清理,允许新调用', () => {
    // 用极短窗口测试清理逻辑
    for (let i = 0; i < 5; i++) checkRateLimit('tool_d', { windowMs: 50 })
    // 等待窗口过期
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const r = checkRateLimit('tool_d', { windowMs: 50 })
        expect(r.allowed).toBe(true)
        resolve()
      }, 60)
    })
  })

  it('resetRateLimiter 清空所有计数', () => {
    for (let i = 0; i < 5; i++) checkRateLimit('tool_e')
    expect(checkRateLimit('tool_e').allowed).toBe(false)
    resetRateLimiter()
    expect(checkRateLimit('tool_e').allowed).toBe(true)
  })

  it('setGlobalRateLimitOpts 配置全局限流', () => {
    setGlobalRateLimitOpts({ maxCalls: 2 })
    expect(checkRateLimit('tool_f').allowed).toBe(true)
    expect(checkRateLimit('tool_f').allowed).toBe(true)
    expect(checkRateLimit('tool_f').allowed).toBe(false)
    setGlobalRateLimitOpts({})
  })
})

describe('executeWithRetry 错误恢复', () => {
  beforeEach(() => {
    resetFailureFallbackStats()
  })

  it('read 工具携带 timeout 码的失败重试 1 次后成功(判定读码,不读文本)', async () => {
    let calls = 0
    const tool: Tool = {
      name: 'read_test',
      description: 'test',
      parameters: {},
      required: [],
      dangerLevel: 'read',
      execute: async () => {
        calls++
        if (calls === 1) {
          // 文本里**没有**任何 timeout 字样:判定若仍在读文本,这一发就不会重试(阳性对照)
          return { success: false, output: '', error: '上游没有按时回来', errorType: 'timeout' }
        }
        return { success: true, output: 'ok' }
      },
    }
    const result = await executeWithRetry(tool, {}, ctx)
    expect(result.success).toBe(true)
    expect(result.output).toBe('ok')
    expect(calls).toBe(2)
    // 带码 ⇒ 一次兜底都不许走(计数为 0 是本票的核心断言)
    expect(getFailureFallbackStats().total).toBe(0)
  })

  it('read 工具两次可重试错误都失败,返回最后一次错误', async () => {
    let calls = 0
    const tool: Tool = {
      name: 'read_fail',
      description: 'test',
      parameters: {},
      required: [],
      dangerLevel: 'read',
      execute: async () => {
        calls++
        return {
          success: false,
          output: '',
          error: `连接抖动-${calls}`,
          errorType: 'network',
        }
      },
    }
    const result = await executeWithRetry(tool, {}, ctx)
    expect(result.success).toBe(false)
    expect(result.error).toBe('连接抖动-2')
    expect(result.errorType).toBe('network')
    expect(calls).toBe(2)
    expect(getFailureFallbackStats().total).toBe(0)
  })

  it('write 工具失败不重试', async () => {
    let calls = 0
    const tool: Tool = {
      name: 'write_test',
      description: 'test',
      parameters: {},
      required: [],
      dangerLevel: 'write',
      execute: async () => {
        calls++
        return { success: false, output: '', error: '写入失败' }
      },
    }
    const result = await executeWithRetry(tool, {}, ctx)
    expect(result.success).toBe(false)
    expect(calls).toBe(1)
  })

  it('dangerous 工具失败不重试', async () => {
    let calls = 0
    const tool: Tool = {
      name: 'danger_test',
      description: 'test',
      parameters: {},
      required: [],
      dangerLevel: 'dangerous',
      execute: async () => {
        calls++
        return { success: false, output: '', error: '危险失败' }
      },
    }
    const result = await executeWithRetry(tool, {}, ctx)
    expect(result.success).toBe(false)
    expect(calls).toBe(1)
  })

  it('read 工具抛 ToolError(timeout)后重试:码从抛出方一路带到判定', async () => {
    let calls = 0
    const tool: Tool = {
      name: 'read_throw',
      description: 'test',
      parameters: {},
      required: [],
      dangerLevel: 'read',
      execute: async () => {
        calls++
        // 抛出方给码:消息文本刻意不含 timeout/timed out 任何字样
        if (calls === 1) throw new ToolError('timeout', '墙钟到点(文本已无关)')
        return { success: true, output: 'recovered' }
      },
    }
    const result = await executeWithRetry(tool, {}, ctx)
    expect(result.success).toBe(true)
    expect(result.output).toBe('recovered')
    expect(calls).toBe(2)
    expect(getFailureFallbackStats().total).toBe(0)
  })

  it('read 工具首次成功不重试', async () => {
    let calls = 0
    const tool: Tool = {
      name: 'read_ok',
      description: 'test',
      parameters: {},
      required: [],
      dangerLevel: 'read',
      execute: async () => {
        calls++
        return { success: true, output: 'first-ok' }
      },
    }
    const result = await executeWithRetry(tool, {}, ctx)
    expect(result.success).toBe(true)
    expect(calls).toBe(1)
  })

  it('重试间隔约 100ms', async () => {
    let calls = 0
    const tool: Tool = {
      name: 'read_timing',
      description: 'test',
      parameters: {},
      required: [],
      dangerLevel: 'read',
      execute: async () => {
        calls++
        if (calls === 1) {
          return { success: false, output: '', error: '配额窗口已满', errorType: 'rate_limited' }
        }
        return { success: true, output: 'ok' }
      },
    }
    const start = Date.now()
    await executeWithRetry(tool, {}, ctx)
    const elapsed = Date.now() - start
    expect(elapsed).toBeGreaterThanOrEqual(90) // 100ms 退避,允许 10ms 误差
    expect(getFailureFallbackStats().total).toBe(0)
  })
})

describe('P1-4 失败码判定(G-710:判定读码,文本档只是被计数的兜底)', () => {
  beforeEach(() => {
    resetFailureFallbackStats()
  })

  it('带码即结论:文本说什么都不影响判定(逐码成对)', () => {
    const cases: ReadonlyArray<{ code: FailureCode; text: string }> = [
      { code: 'rate_limited', text: 'Too Many Requests' },
      { code: 'timeout', text: 'operation timed out' },
      { code: 'permission', text: 'permission denied' },
      { code: 'not_found', text: 'file not found' },
      { code: 'network', text: 'fetch failed' },
      { code: 'cancelled', text: '用户按了停止' },
      { code: 'provider_unavailable', text: 'bad gateway' },
      { code: 'context_limit', text: '上下文太长' },
    ]
    for (const { code, text } of cases) {
      const r = resolveFailureCode(new ToolError(code, text), 'direct-call')
      expect(r.code, `ToolError(${code}) 必须原样给出码`).toBe(code)
      expect(r.via).toBe('structured')
      expect(r.fallbackUsed).toBe(false)
    }
    // 反向对照:上一条一次兜底都没走。摘掉抛码(见 ToolError 用例)⇒ 本断言必红
    expect(getFailureFallbackStats().total).toBe(0)
  })

  it('文本与码矛盾时**以码为准**(旧实现这里会被文本带走)', () => {
    // 旧 classifyError 读到 'rate limit' 就判 rate_limited(可重试);
    // 现在同一段文本挂上 cancelled 码 ⇒ 结论必须是 cancelled。
    const r = resolveFailureCode(new ToolError('cancelled', 'rate limit exceeded'), 'direct-call')
    expect(r.code).toBe('cancelled')
    expect(isRetryableErrorType(r.code)).toBe(false)
    expect(getFailureFallbackStats().total).toBe(0)
  })

  it('既有发射名 permission_denied 归一成 permission(两处判定第一次对得上)', () => {
    const r = resolveFailureCode({ errorType: 'permission_denied' }, 'direct-call')
    expect(r.code).toBe('permission')
    expect(r.via).toBe('structured')
    expect(isFatalErrorType(r.code)).toBe(true)
  })

  it('后端稳定 errorCode 与 HTTP status 两档结构化字段都算"有码"', () => {
    expect(resolveFailureCode({ errorCode: 'RATE_LIMITED' }, 'direct-call').code).toBe('rate_limited')
    expect(resolveFailureCode({ status: 429 }, 'direct-call').code).toBe('rate_limited')
    expect(resolveFailureCode({ status: 503 }, 'direct-call').code).toBe('provider_unavailable')
    expect(resolveFailureCode({ status: 413 }, 'direct-call').code).toBe('context_limit')
    expect(getFailureFallbackStats().total).toBe(0)
  })

  it('无码时兜底仍工作,**且每次使用都被计数**(能力没被删,只是不再静默)', () => {
    expect(getFailureFallbackStats().total).toBe(0)
    expect(classifyError('rate limit exceeded')).toBe('rate_limited')
    expect(classifyError('工具触发限流')).toBe('rate_limited')
    expect(classifyError('Too Many Requests')).toBe('rate_limited')
    expect(classifyError('request timeout')).toBe('timeout')
    expect(classifyError('operation timed out')).toBe('timeout')
    expect(classifyError('请求超时')).toBe('timeout')
    expect(classifyError('permission denied')).toBe('permission')
    expect(classifyError('access forbidden')).toBe('permission')
    expect(classifyError('权限不足')).toBe('permission')
    expect(classifyError('操作被拒绝')).toBe('permission')
    expect(classifyError('file not found')).toBe('not_found')
    expect(classifyError('ENOENT: no such file')).toBe('not_found')
    expect(classifyError('文件不存在')).toBe('not_found')
    expect(classifyError('network error')).toBe('network')
    expect(classifyError('ECONNRESET')).toBe('network')
    expect(classifyError('fetch failed')).toBe('network')
    expect(classifyError('连接被拒绝')).toBe('network')
    expect(classifyError('something weird')).toBe('unknown')
    expect(classifyError(undefined)).toBe('unknown')
    expect(classifyError('')).toBe('unknown')

    const stats = getFailureFallbackStats()
    // 20 次调用 ⇒ 计数必须与调用数同阶(不是 0,也不是把结构化那几发算进来)
    expect(stats.total).toBe(20)
    expect(stats.bySite['direct-call']).toBe(20)
    expect(stats.bySiteAndCode['direct-call|rate_limited']).toBe(3)
    expect(stats.bySiteAndCode['direct-call|unknown']).toBe(3)
  })

  it('兜底计数按站点分档:工具重试与压缩各记各的,合起来才是总账', () => {
    resetFailureFallbackStats()
    resolveFailureCode('网络抖动', 'tool-retry')
    resolveFailureCode('网络抖动', 'compaction-sampling')
    resolveFailureCode('网络抖动', 'compaction-sampling')
    const stats = getFailureFallbackStats()
    expect(stats.total).toBe(3)
    expect(stats.bySite['tool-retry']).toBe(1)
    expect(stats.bySite['compaction-sampling']).toBe(2)
  })

  it('isRetryableErrorType: network/timeout/rate_limited 可重试,其余不可', () => {
    expect(isRetryableErrorType('network')).toBe(true)
    expect(isRetryableErrorType('timeout')).toBe(true)
    expect(isRetryableErrorType('rate_limited')).toBe(true)
    expect(isRetryableErrorType('permission')).toBe(false)
    expect(isRetryableErrorType('not_found')).toBe(false)
    expect(isRetryableErrorType('unknown')).toBe(false)
    // 新增两档同样不可重试:取消与墙钟不是"再来一次"能解决的(见 failure-classification 注记)
    expect(isRetryableErrorType('cancelled')).toBe(false)
    expect(isRetryableErrorType('context_limit')).toBe(false)
    expect(isRetryableErrorType(undefined)).toBe(false)
  })

  it('isFatalErrorType: 仅 permission 为致命,其余非致命', () => {
    expect(isFatalErrorType('permission')).toBe(true)
    expect(isFatalErrorType('network')).toBe(false)
    expect(isFatalErrorType('timeout')).toBe(false)
    expect(isFatalErrorType('not_found')).toBe(false)
    expect(isFatalErrorType('rate_limited')).toBe(false)
    expect(isFatalErrorType('unknown')).toBe(false)
    expect(isFatalErrorType(undefined)).toBe(false)
  })

  it('read 工具不可重试错误(permission)不重试', async () => {
    let calls = 0
    const tool: Tool = {
      name: 'read_perm',
      description: 'test',
      parameters: {},
      required: [],
      dangerLevel: 'read',
      execute: async () => {
        calls++
        return { success: false, output: '', error: '禁止访问', errorType: 'permission' }
      },
    }
    const result = await executeWithRetry(tool, {}, ctx)
    expect(result.success).toBe(false)
    expect(result.errorType).toBe('permission')
    expect(calls).toBe(1) // 不可重试 → 不重试
    expect(getFailureFallbackStats().total).toBe(0)
  })

  it('read 工具未知错误(无码 ⇒ 走被计数的兜底)不重试', async () => {
    let calls = 0
    const tool: Tool = {
      name: 'read_unknown',
      description: 'test',
      parameters: {},
      required: [],
      dangerLevel: 'read',
      execute: async () => {
        calls++
        return { success: false, output: '', error: '未分类错误' }
      },
    }
    const result = await executeWithRetry(tool, {}, ctx)
    expect(result.success).toBe(false)
    expect(result.errorType).toBe('unknown')
    expect(calls).toBe(1) // unknown 不可重试
    // 兜底不是静默的:这一发的两次判定(重试窗 + 收尾打标)都必须进计数
    expect(getFailureFallbackStats().total).toBeGreaterThan(0)
  })

  it('工具主动标记 errorType 覆盖文本判定', async () => {
    let calls = 0
    const tool: Tool = {
      name: 'read_override',
      description: 'test',
      parameters: {},
      required: [],
      dangerLevel: 'read',
      execute: async () => {
        calls++
        if (calls === 1) {
          // 主动标记 network,文本刻意写成别的样子也照样按 network 处置(可重试)
          return { success: false, output: '', error: 'whatever', errorType: 'network' as const }
        }
        return { success: true, output: 'ok' }
      },
    }
    const result = await executeWithRetry(tool, {}, ctx)
    expect(result.success).toBe(true)
    expect(calls).toBe(2)
    expect(getFailureFallbackStats().total).toBe(0)
  })

  it('外层取消(ctx.signal 在 handler 内被 abort)按 cancelled 处置,不读错误文本', async () => {
    const controller = new AbortController()
    let calls = 0
    const tool: Tool = {
      name: 'read_cancelled',
      description: 'test',
      parameters: {},
      required: [],
      dangerLevel: 'read',
      execute: async () => {
        calls++
        // 取消发生在 handler 内:抛出的是一段 AbortError 文本(旧实现只能靠文本猜,判成 unknown)
        controller.abort()
        throw new Error('operation was aborted')
      },
    }
    const result = await executeWithRetry(tool, {}, { ...ctx, signal: controller.signal })
    expect(result.success).toBe(false)
    expect(result.errorType).toBe('cancelled')
    expect(calls).toBe(1) // 取消不是瞬态 → 不重试
    expect(getFailureFallbackStats().total).toBe(0)
  })
})

describe('executeToolCall 集成限流', () => {
  beforeEach(() => {
    resetRateLimiter()
    clearTools()
  })

  it('限流触发后 executeToolCall 返回 error', async () => {
    const tool: Tool = {
      name: 'rate_test',
      description: 'test',
      parameters: {},
      required: [],
      dangerLevel: 'read',
      execute: async () => ({ success: true, output: 'ok' }),
    }
    registerTools([tool])
    // 先消耗 5 次配额
    for (let i = 0; i < 5; i++) {
      const r = await executeToolCall({ name: 'rate_test', arguments: {} }, ctx)
      expect(r.success).toBe(true)
    }
    // 第 6 次应被限流
    const r = await executeToolCall({ name: 'rate_test', arguments: {} }, ctx)
    expect(r.success).toBe(false)
    expect(r.error).toContain('限流')
    expect(r.errorType).toBe('rate_limited')
  })

  it('未知工具返回 not_found errorType,不消耗限流配额', async () => {
    const r = await executeToolCall({ name: 'unknown_tool', arguments: {} }, ctx)
    expect(r.success).toBe(false)
    expect(r.error).toContain('未知工具')
    expect(r.errorType).toBe('not_found')
    // 未知工具不影响其他工具配额
    expect(checkRateLimit('other_tool').allowed).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
