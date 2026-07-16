import { describe, expect, it, beforeEach } from 'vitest'
import {
  registerTools,
  clearTools,
  executeToolCall,
  checkRateLimit,
  resetRateLimiter,
  setGlobalRateLimitOpts,
  executeWithRetry,
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
  it('read 工具失败后重试 1 次,成功', async () => {
    let calls = 0
    const tool: Tool = {
      name: 'read_test',
      description: 'test',
      parameters: {},
      required: [],
      dangerLevel: 'read',
      execute: async () => {
        calls++
        if (calls === 1) return { success: false, output: '', error: '瞬时错误' }
        return { success: true, output: 'ok' }
      },
    }
    const result = await executeWithRetry(tool, {}, ctx)
    expect(result.success).toBe(true)
    expect(result.output).toBe('ok')
    expect(calls).toBe(2)
  })

  it('read 工具两次都失败,返回最后一次错误', async () => {
    let calls = 0
    const tool: Tool = {
      name: 'read_fail',
      description: 'test',
      parameters: {},
      required: [],
      dangerLevel: 'read',
      execute: async () => {
        calls++
        return { success: false, output: '', error: `失败-${calls}` }
      },
    }
    const result = await executeWithRetry(tool, {}, ctx)
    expect(result.success).toBe(false)
    expect(result.error).toBe('失败-2')
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

  it('read 工具抛异常后重试', async () => {
    let calls = 0
    const tool: Tool = {
      name: 'read_throw',
      description: 'test',
      parameters: {},
      required: [],
      dangerLevel: 'read',
      execute: async () => {
        calls++
        if (calls === 1) throw new Error('异常')
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
        if (calls === 1) return { success: false, output: '', error: 'fail' }
        return { success: true, output: 'ok' }
      },
    }
    const start = Date.now()
    await executeWithRetry(tool, {}, ctx)
    const elapsed = Date.now() - start
    expect(elapsed).toBeGreaterThanOrEqual(90) // 100ms 退避,允许 10ms 误差
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
  })

  it('未知工具不消耗限流配额', async () => {
    const r = await executeToolCall({ name: 'unknown_tool', arguments: {} }, ctx)
    expect(r.success).toBe(false)
    expect(r.error).toContain('未知工具')
    // 未知工具不影响其他工具配额
    expect(checkRateLimit('other_tool').allowed).toBe(true)
  })
})
