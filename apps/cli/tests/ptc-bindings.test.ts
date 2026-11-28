// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it, vi } from 'vitest'
import {
  PTC_DEFAULT_BINDING_TOOL_NAMES,
  PTC_READ_ONLY_TOOL_NAMES,
  createPtcDefaultBindingApprover,
  createPtcReadOnlyExecutor,
  createRunCodeTool,
} from '../src/tools/ptc-tool.js'
import type { PtcRunSpec, PtcRuntime } from '@ihui/ptc-runtime'
import { selectPtcBindingTools } from '../src/tools/ptc-sdk.js'
import { buildNativeToolsBody } from '../src/tools/native-tools-body.js'
import type { Tool } from '../src/tools/index.js'

function fakeTool(name: string, dangerLevel: Tool['dangerLevel']): Tool {
  return {
    name,
    description: name,
    parameters: {},
    required: [],
    dangerLevel,
    execute: async () => ({ success: true, output: '' }),
  }
}

/**
 * 只验证"审批包在绑定调用之前"：runtime.run 直接调一次 write_file，
 * 审批拒绝时把错误折成 exception 返回，批准时把绑定结果当程序值返回。
 */
function fakeWritableRuntime(callMember = 'write_file'): PtcRuntime {
  return {
    language: 'typescript',
    isolation: { kind: 'child-process', retainedState: false },
    timeout: { defaultMs: 120_000, maxMs: 600_000 },
    executionInstructions: '',
    retainsState: false,
    resolve(request): PtcRunSpec {
      return {
        ...request,
        programFormat: 'function-body',
        cwd: request.cwd ?? process.cwd(),
        timeoutMs: 120_000,
        bindingTimeoutMs: 30_000,
        typeCheck: false,
      }
    },
    async run(spec) {
      try {
        const fn = spec.bindings[0]?.functions[callMember]
        if (fn === undefined) return { logs: [], error: { kind: 'exception', message: 'missing binding' } }
        const value = await fn({ path: 'out.txt', content: 'hello' })
        return { logs: [], value }
      } catch (error) {
        return {
          logs: [],
          error: { kind: 'exception', message: error instanceof Error ? error.message : String(error) },
        }
      }
    },
    async release() {},
  }
}

describe('PTC binding surface', () => {
  it('默认面含只读与三枚可写/验证绑定，但不放 run_command', () => {
    for (const name of PTC_READ_ONLY_TOOL_NAMES) {
      expect(PTC_DEFAULT_BINDING_TOOL_NAMES).toContain(name)
    }
    expect(PTC_DEFAULT_BINDING_TOOL_NAMES).toContain('write_file')
    expect(PTC_DEFAULT_BINDING_TOOL_NAMES).toContain('edit_file')
    expect(PTC_DEFAULT_BINDING_TOOL_NAMES).toContain('run_tests')
    expect(PTC_DEFAULT_BINDING_TOOL_NAMES).not.toContain('run_command')
  })

  it('selectPtcBindingTools 只选已注册且安全的默认绑定', () => {
    const tools = [
      fakeTool('read_file', 'read'),
      fakeTool('write_file', 'write'),
      fakeTool('run_command', 'dangerous'),
      fakeTool('not_registered', 'read'),
    ]
    const selected = selectPtcBindingTools(tools).map((tool) => tool.name)
    expect(selected).toEqual(['read_file', 'write_file'])
  })

  it('无宿主审批器时只读放行、可写拒绝', async () => {
    const approve = createPtcDefaultBindingApprover(PTC_DEFAULT_BINDING_TOOL_NAMES)
    const base = { namespace: 'tools', args: {}, signal: new AbortController().signal }
    expect(await approve({ ...base, memberName: 'read_file' })).toBe(true)
    expect(await approve({ ...base, memberName: 'write_file' })).toBe(false)
    expect(await approve({ ...base, memberName: 'run_tests' })).toBe(false)
    expect(await approve({ ...base, memberName: 'run_command' })).toBe(false)
  })

  it('run_code 的广告面写明可写绑定必须逐次审批', () => {
    const tool = createRunCodeTool({
      runner: async () => ({ success: true, output: '' }),
    })
    expect(tool.description).toContain('write_file/edit_file/run_tests')
    expect(tool.description).toContain('每次调用前必须过宿主审批')
  })

  it('没有审批器时 write_file 绑定被默认拒绝，程序收到 exception', async () => {
    const executor = createPtcReadOnlyExecutor({
      runner: async () => ({ success: true, output: '' }),
      bindingTools: PTC_DEFAULT_BINDING_TOOL_NAMES,
      runtimeFactory: () => fakeWritableRuntime(),
    })
    const result = await executor.execute(
      { name: 'run_code', arguments: { code: 'return 1', description: 'write probe' } },
      { workspacePath: '.' } as never,
    )
    expect(result.success).toBe(false)
    expect(result.error).toContain('审批未通过')
  })

  it('显式注入审批器并返回 true 后，write_file 绑定才执行', async () => {
    const approve = vi.fn(async () => true)
    const executor = createPtcReadOnlyExecutor({
      runner: async () => ({ success: true, output: '' }),
      bindingTools: PTC_DEFAULT_BINDING_TOOL_NAMES,
      runtimeFactory: () => fakeWritableRuntime(),
      approveBinding: approve,
    })
    const result = await executor.execute(
      { name: 'run_code', arguments: { code: 'return 1', description: 'write probe' } },
      { workspacePath: '.' } as never,
    )
    expect(result.success).toBe(true)
    expect(approve).toHaveBeenCalledWith(
      expect.objectContaining({ namespace: 'tools', memberName: 'write_file' }),
    )
  })
})

describe('native tools body', () => {
  it('显式 parallel_tool_calls 与 tool_choice 都进请求体', () => {
    const body = buildNativeToolsBody(
      [{ type: 'function', function: { name: 'read_file', parameters: {} } }],
      'required',
      false,
    )
    expect(body).toEqual({
      tools: [{ type: 'function', function: { name: 'read_file', parameters: {} } }],
      tool_choice: 'required',
      parallel_tool_calls: false,
    })
  })

  it('未给 parallel_tool_calls 时不写该字段，旧请求逐字节不变', () => {
    const body = buildNativeToolsBody(
      [{ type: 'function', function: { name: 'read_file', parameters: {} } }],
      undefined,
      undefined,
    )
    expect(body).toEqual({
      tools: [{ type: 'function', function: { name: 'read_file', parameters: {} } }],
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
