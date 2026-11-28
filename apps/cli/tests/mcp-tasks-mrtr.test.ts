// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { describe, expect, it } from 'vitest'
import { MCP_STATELESS_PROTOCOL_VERSION } from '@ihui/shared'
import {
  buildStatelessMcpHttpRequest,
  driveMcpToolResult,
  McpInputRequiredError,
  McpTaskCancelledError,
  McpTaskFailedError,
  type McpInputHandler,
} from '../src/tools/mcp-runtime.js'

const clientInfo = { name: 'ihui-cli', version: '0.1.0' }

function noSleep(): Promise<void> {
  return Promise.resolve()
}

describe('MCP 2026-07-28 MRTR', () => {
  it('input_required 答完后带 inputResponses/requestState 重发原调用', async () => {
    const calls: Array<Record<string, unknown>> = []
    const handler: McpInputHandler = async (requests) => {
      expect(Object.keys(requests)).toEqual(['bookingConfirmation'])
      expect(requests.bookingConfirmation?.method).toBe('elicitation/create')
      return { bookingConfirmation: { action: 'accept', content: { confirmBooking: true } } }
    }
    const result = await driveMcpToolResult(
      {
        resultType: 'input_required',
        inputRequests: {
          bookingConfirmation: {
            method: 'elicitation/create',
            params: { mode: 'form', message: 'confirm?' },
          },
        },
        requestState: 'opaque-state',
      },
      { name: 'book', arguments: { hotelId: 'h1' } },
      {
        retryCall: async (params) => {
          calls.push(params)
          return { resultType: 'complete', content: [{ type: 'text', text: 'ok' }] }
        },
        taskCall: async () => {
          throw new Error('不应走 task 分支')
        },
      },
      { inputHandler: handler, sleep: noSleep },
    )

    expect(result).toMatchObject({ resultType: 'complete' })
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      name: 'book',
      arguments: { hotelId: 'h1' },
      inputResponses: { bookingConfirmation: { action: 'accept', content: { confirmBooking: true } } },
      requestState: 'opaque-state',
    })
  })

  it('没有 inputHandler 时抛可诊断错误，不静默替用户答', async () => {
    const promise = driveMcpToolResult(
      {
        resultType: 'input_required',
        inputRequests: { approval: { method: 'elicitation/create', params: { message: 'approve?' } } },
        requestState: 'state',
      },
      { name: 'deploy', arguments: {} },
      {
        retryCall: async () => {
          throw new Error('不应重发')
        },
        taskCall: async () => {
          throw new Error('不应走 task 分支')
        },
      },
      { sleep: noSleep },
    )

    await expect(promise).rejects.toBeInstanceOf(McpInputRequiredError)
    await promise.catch((err: McpInputRequiredError) => {
      expect(err.inputRequests.approval?.method).toBe('elicitation/create')
      expect(err.requestState).toBe('state')
    })
  })

  it('超过最大轮数即失败，避免死循环', async () => {
    const promise = driveMcpToolResult(
      {
        resultType: 'input_required',
        inputRequests: { a: { method: 'elicitation/create' } },
      },
      { name: 'loop', arguments: {} },
      {
        retryCall: async () => ({
          resultType: 'input_required',
          inputRequests: { a: { method: 'elicitation/create' } },
        }),
        taskCall: async () => {
          throw new Error('不应走 task 分支')
        },
      },
      {
        inputHandler: async () => ({ a: { action: 'accept' } }),
        maxMrtrRounds: 2,
        sleep: noSleep,
      },
    )
    await expect(promise).rejects.toThrow('超过 2 轮')
  })

  it('未知 resultType 不被当成成功', async () => {
    await expect(
      driveMcpToolResult(
        { resultType: 'extension_future' },
        { name: 'x', arguments: {} },
        {
          retryCall: async () => {
            throw new Error('不应重发')
          },
          taskCall: async () => {
            throw new Error('不应走 task 分支')
          },
        },
        { sleep: noSleep },
      ),
    ).rejects.toThrow('未知 resultType')
  })
})

describe('MCP 2026-07-28 Tasks', () => {
  it('task 轮询到 completed 后返回原 tools/call 结果', async () => {
    const taskCalls: Array<{ method: string; params: Record<string, unknown> }> = []
    let gets = 0
    const result = await driveMcpToolResult(
      {
        resultType: 'task',
        taskId: 'task-1',
        status: 'working',
        pollIntervalMs: 0,
      },
      { name: 'build', arguments: { target: 'all' } },
      {
        retryCall: async () => {
          throw new Error('不应重发')
        },
        taskCall: async (method, params) => {
          taskCalls.push({ method, params })
          if (method === 'tasks/get') {
            gets += 1
            if (gets === 1) {
              return { resultType: 'complete', taskId: 'task-1', status: 'working' }
            }
            return {
              resultType: 'complete',
              taskId: 'task-1',
              status: 'completed',
              result: { content: [{ type: 'text', text: 'built' }] },
            }
          }
          return { resultType: 'complete' }
        },
      },
      { sleep: noSleep },
    )

    expect(result).toMatchObject({ content: [{ type: 'text', text: 'built' }] })
    expect(taskCalls.map((c) => c.method)).toEqual(['tasks/get', 'tasks/get'])
    expect(taskCalls[0]?.params).toEqual({ taskId: 'task-1' })
  })

  it('task input_required 走 tasks/update，答完继续轮询', async () => {
    const calls: Array<{ method: string; params: Record<string, unknown> }> = []
    let gets = 0
    const handler: McpInputHandler = async (requests, context) => {
      expect(context.taskId).toBe('task-2')
      expect(requests.approval?.method).toBe('elicitation/create')
      return { approval: { action: 'accept', content: { approved: true } } }
    }
    const result = await driveMcpToolResult(
      {
        resultType: 'task',
        taskId: 'task-2',
        status: 'working',
        pollIntervalMs: 0,
      },
      { name: 'deploy', arguments: {} },
      {
        retryCall: async () => {
          throw new Error('不应重发')
        },
        taskCall: async (method, params) => {
          calls.push({ method, params })
          if (method === 'tasks/get') {
            gets += 1
            if (gets === 1) {
              return {
                resultType: 'complete',
                taskId: 'task-2',
                status: 'input_required',
                inputRequests: { approval: { method: 'elicitation/create', params: { message: 'approve?' } } },
              }
            }
            return { resultType: 'complete', taskId: 'task-2', status: 'completed', result: { content: [] } }
          }
          return { resultType: 'complete' }
        },
      },
      { inputHandler: handler, sleep: noSleep },
    )

    expect(result).toEqual({ content: [] })
    expect(calls.map((c) => c.method)).toEqual(['tasks/get', 'tasks/update', 'tasks/get'])
    expect(calls[1]?.params).toMatchObject({
      taskId: 'task-2',
      inputResponses: { approval: { action: 'accept', content: { approved: true } } },
    })
  })

  it('failed / cancelled 终态不被伪装成空成功', async () => {
    await expect(
      driveMcpToolResult(
        { resultType: 'task', taskId: 'task-f', status: 'working', pollIntervalMs: 0 },
        { name: 'f', arguments: {} },
        {
          retryCall: async () => {
            throw new Error('不应重发')
          },
          taskCall: async () => ({
            resultType: 'complete',
            taskId: 'task-f',
            status: 'failed',
            error: { code: -32603, message: 'boom' },
          }),
        },
        { sleep: noSleep },
      ),
    ).rejects.toBeInstanceOf(McpTaskFailedError)

    await expect(
      driveMcpToolResult(
        { resultType: 'task', taskId: 'task-c', status: 'working', pollIntervalMs: 0 },
        { name: 'c', arguments: {} },
        {
          retryCall: async () => {
            throw new Error('不应重发')
          },
          taskCall: async () => ({ resultType: 'complete', taskId: 'task-c', status: 'cancelled' }),
        },
        { sleep: noSleep },
      ),
    ).rejects.toBeInstanceOf(McpTaskCancelledError)
  })

  it('tasks/get 用 taskId 作 Mcp-Name 路由头', () => {
    const built = buildStatelessMcpHttpRequest(
      'tasks/get',
      { taskId: 'task-route-1' },
      MCP_STATELESS_PROTOCOL_VERSION,
      clientInfo,
      {},
    )
    expect(built.headers['Mcp-Name']).toBe('task-route-1')
    expect(built.headers['Mcp-Method']).toBe('tasks/get')
  })
})
