// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * custom ↔ function 双向桥(2026-11-17)。
 *
 * 钉住四件事:
 * ① 降级只碰 `type:"custom"`,普通 function 一条都不改(同一个对象引用);
 * ② 降级后的入参契约固定为 `{input: string}`,且 required 只有 input;
 * ③ 入站还原只认本次降级过的名字,不把普通 function 误判成 custom_tool_call;
 * ④ 上游没按 `{input:…}` 包时整段当 input —— 丢内容比给错形态更糟。
 */
import { describe, expect, it } from 'vitest'
import {
  downgradeCustomTools,
  extractCustomInput,
  isCustomTool,
  isDowngradedCustomCall,
  restoreCustomToolCalls,
} from '../src/services/apply-patch-bridge.js'

describe('custom 工具判据与降级', () => {
  it('A1 custom ⇒ function(input:string),并把格式说明拼进 description', () => {
    const tool = {
      type: 'custom',
      name: 'apply_patch',
      description: '打补丁',
      format: { type: 'grammar', syntax: 'lark' },
    }
    const r = downgradeCustomTools([tool])
    expect(r.customNames).toEqual(['apply_patch'])
    const fn = r.tools[0] as {
      type: string
      function: { name: string; description: string; parameters: Record<string, unknown> }
    }
    expect(fn.type).toBe('function')
    expect(fn.function.name).toBe('apply_patch')
    expect(fn.function.description).toContain('lark')
    expect(fn.function.parameters).toMatchObject({ required: ['input'] })
  })

  it('A2 普通 function 原样保留(引用不变)', () => {
    const normal = { type: 'function', function: { name: 'read_file' } }
    const r = downgradeCustomTools([normal])
    expect(r.tools[0]).toBe(normal)
    expect(r.customNames).toEqual([])
    expect(isCustomTool(normal)).toBe(false)
  })

  it('A3 空/未定义工具集不产任何东西', () => {
    expect(downgradeCustomTools(undefined)).toEqual({ tools: [], customNames: [] })
    expect(downgradeCustomTools([])).toEqual({ tools: [], customNames: [] })
  })
})

describe('入站还原', () => {
  it('A4 arguments 里的 input 直接取出', () => {
    expect(extractCustomInput('{"input":"*** Begin Patch\\n*** End Patch"}')).toContain(
      'Begin Patch',
    )
  })

  it('A5 arguments 是纯文本(不是 JSON)⇒ 整段当 input', () => {
    expect(extractCustomInput('raw patch text')).toBe('raw patch text')
  })

  it('A6 arguments 是 JSON 字符串字面量 ⇒ 取该字符串', () => {
    expect(extractCustomInput('"abc"')).toBe('abc')
  })

  it('A7 只还原降级过的名字;普通 function_call 原样', () => {
    const outputs = [
      {
        type: 'function_call',
        id: 'fc_1',
        call_id: 'call_1',
        name: 'apply_patch',
        arguments: '{"input":"x"}',
      },
      { type: 'function_call', id: 'fc_2', call_id: 'call_2', name: 'read_file', arguments: '{}' },
    ]
    const restored = restoreCustomToolCalls(outputs, ['apply_patch'])
    expect((restored[0] as { type: string }).type).toBe('custom_tool_call')
    expect((restored[0] as { input: string }).input).toBe('x')
    expect(restored[1]).toBe(outputs[1])
    expect(isDowngradedCustomCall('read_file', ['apply_patch'])).toBe(false)
  })

  it('A8 没有降级记录时整组原样返回(空 customNames)', () => {
    const outputs = [{ type: 'function_call', name: 'x' }]
    expect(restoreCustomToolCalls(outputs, [])).toBe(outputs)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
