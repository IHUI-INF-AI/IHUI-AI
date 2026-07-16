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
  it('read 工具可重试错误(timeout)失败后重试 1 次,成功', async () => {
    let calls = 0
    const tool: Tool = {
      name: 'read_test',
      description: 'test',
      parameters: {},
      required: [],
      dangerLevel: 'read',
      execute: async () => {
        calls++
        if (calls === 1) return { success: false, output: '', error: 'timeout: 瞬时超时' }
        return { success: true, output: 'ok' }
      },
    }
    const result = await executeWithRetry(tool, {}, ctx)
    expect(result.success).toBe(true)
    expect(result.output).toBe('ok')
    expect(calls).toBe(2)
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
        return { success: false, output: '', error: `network error 失败-${calls}` }
      },
    }
    const result = await executeWithRetry(tool, {}, ctx)
    expect(result.success).toBe(false)
    expect(result.error).toBe('network error 失败-2')
    expect(result.errorType).toBe('network')
    expect(calls).toBe(2)
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

  it('read 工具抛可重试异常(timeout)后重试', async () => {
    let calls = 0
    const tool: Tool = {
      name: 'read_throw',
      description: 'test',
      parameters: {},
      required: [],
      dangerLevel: 'read',
      execute: async () => {
        calls++
        if (calls === 1) throw new Error('timeout: 瞬时异常')
        return { success: true, output: 'recovered' }
      },
    }
    const result = await executeWithRetry(tool, {}, ctx)
    expect(result.success).toBe(true)
    expect(result.output).toBe('recovered')
    expect(calls).toBe(2)
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
        if (calls === 1) return { success: false, output: '', error: 'rate_limited: 触发限流' }
        return { success: true, output: 'ok' }
      },
    }
    const start = Date.now()
    await executeWithRetry(tool, {}, ctx)
    const elapsed = Date.now() - start
    expect(elapsed).toBeGreaterThanOrEqual(90) // 100ms 退避,允许 10ms 误差
  })
})

describe('P1-4 ErrorType 分级', () => {
  it('classifyError 识别 rate_limited', () => {
    expect(classifyError('rate limit exceeded')).toBe('rate_limited')
    expect(classifyError('工具触发限流')).toBe('rate_limited')
    expect(classifyError('Too Many Requests')).toBe('rate_limited')
  })

  it('classifyError 识别 timeout', () => {
    expect(classifyError('request timeout')).toBe('timeout')
    expect(classifyError('operation timed out')).toBe('timeout')
    expect(classifyError('请求超时')).toBe('timeout')
  })

  it('classifyError 识别 permission', () => {
    expect(classifyError('permission denied')).toBe('permission')
    expect(classifyError('access forbidden')).toBe('permission')
    expect(classifyError('权限不足')).toBe('permission')
    expect(classifyError('操作被拒绝')).toBe('permission')
  })

  it('classifyError 识别 not_found', () => {
    expect(classifyError('file not found')).toBe('not_found')
    expect(classifyError('ENOENT: no such file')).toBe('not_found')
    expect(classifyError('文件不存在')).toBe('not_found')
  })

  it('classifyError 识别 network', () => {
    expect(classifyError('network error')).toBe('network')
    expect(classifyError('ECONNRESET')).toBe('network')
    expect(classifyError('fetch failed')).toBe('network')
    expect(classifyError('连接被拒绝')).toBe('network')
  })

  it('classifyError 兜底 unknown', () => {
    expect(classifyError('something weird')).toBe('unknown')
    expect(classifyError(undefined)).toBe('unknown')
    expect(classifyError('')).toBe('unknown')
  })

  it('isRetryableErrorType: network/timeout/rate_limited 可重试,其余不可', () => {
    expect(isRetryableErrorType('network')).toBe(true)
    expect(isRetryableErrorType('timeout')).toBe(true)
    expect(isRetryableErrorType('rate_limited')).toBe(true)
    expect(isRetryableErrorType('permission')).toBe(false)
    expect(isRetryableErrorType('not_found')).toBe(false)
    expect(isRetryableErrorType('unknown')).toBe(false)
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
        return { success: false, output: '', error: 'permission denied: 禁止访问' }
      },
    }
    const result = await executeWithRetry(tool, {}, ctx)
    expect(result.success).toBe(false)
    expect(result.errorType).toBe('permission')
    expect(calls).toBe(1) // 不可重试 → 不重试
  })

  it('read 工具未知错误(unknown)不重试', async () => {
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
  })

  it('工具主动标记 errorType 覆盖启发式分类', async () => {
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
          // 主动标记为 network,即使 error 文本像 unknown,也按 network 处理(可重试)
          return { success: false, output: '', error: 'whatever', errorType: 'network' as const }
        }
        return { success: true, output: 'ok' }
      },
    }
    const result = await executeWithRetry(tool, {}, ctx)
    expect(result.success).toBe(true)
    expect(calls).toBe(2)
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
