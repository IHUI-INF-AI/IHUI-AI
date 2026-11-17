// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DSML 回退解析(2026-11-17)。
 *
 * 夹具按公开格式写(不是自造):`｜` 为 U+FF5C;包裹标签 tool_calls(V4)/function_calls(V3.2);
 * parameter 的 string 属性区分"原样字符串"与"JSON 值";多行参数必须能吃下。
 * 变体三类(双杠 / 无前杠 / ASCII 管道)各有一条用例 —— 同一条上游换节点就换变体。
 */
import { describe, expect, it } from 'vitest'
import {
  hasDsmlMarkers,
  normalizeDsmlMarkers,
  parseDsmlToolCalls,
} from '../src/services/dsml-tool-call-parser.js'

const BAR = '｜DSML｜'

describe('DSML 标记归一', () => {
  it('D1 双杠变体归一为标准形态', () => {
    const raw = '<｜｜DSML｜｜tool_calls><｜｜DSML｜｜invoke name="x"></｜｜DSML｜｜invoke>'
    const norm = normalizeDsmlMarkers(raw)
    expect(norm).toContain(`<${BAR}tool_calls>`)
    expect(norm).toContain(`<${BAR}invoke name="x">`)
  })

  it('D2 无前杠与 ASCII 管道变体也归一', () => {
    expect(normalizeDsmlMarkers('<DSML｜invoke name="a">')).toContain(`<${BAR}invoke name="a">`)
    expect(normalizeDsmlMarkers('< | DSML | invoke name="a">')).toContain(`<${BAR}invoke name="a">`)
    expect(normalizeDsmlMarkers('</ | DSML | invoke>')).toContain(`</${BAR}invoke>`)
  })
})

describe('DSML 工具调用解析', () => {
  it('D3 标准单杠形态:string=true 原样、string=false 走 JSON', () => {
    const text = [
      `<${BAR}tool_calls>`,
      `<${BAR}invoke name="code_exec">`,
      `<${BAR}parameter name="language" string="true">python</${BAR}parameter>`,
      `<${BAR}parameter name="timeout" string="false">30</${BAR}parameter>`,
      `</${BAR}invoke>`,
      `</${BAR}tool_calls>`,
    ].join('\n')
    const r = parseDsmlToolCalls(text)
    expect(r).not.toBeNull()
    expect(r?.calls).toHaveLength(1)
    expect(r?.calls[0]?.name).toBe('code_exec')
    expect(JSON.parse(r!.calls[0]!.arguments)).toEqual({ language: 'python', timeout: 30 })
    expect(r?.degraded).toEqual([])
  })

  it('D4 多行参数(换行不被吃掉)', () => {
    const text = `<${BAR}invoke name="bash"><${BAR}parameter name="command" string="true">echo a\necho b</${BAR}parameter></${BAR}invoke>`
    const r = parseDsmlToolCalls(text)
    expect(JSON.parse(r!.calls[0]!.arguments).command).toBe('echo a\necho b')
  })

  it('D5 多个 invoke 一次解析', () => {
    const text = `<${BAR}tool_calls><${BAR}invoke name="a"><${BAR}parameter name="x" string="false">1</${BAR}parameter></${BAR}invoke><${BAR}invoke name="b"><${BAR}parameter name="y" string="true">z</${BAR}parameter></${BAR}invoke></${BAR}tool_calls>`
    const r = parseDsmlToolCalls(text)
    expect(r?.calls.map((c) => c.name)).toEqual(['a', 'b'])
  })

  it('D6 string=false 但 JSON 非法 ⇒ 回落原文字符串并记 degraded(不丢内容)', () => {
    const text = `<${BAR}invoke name="f"><${BAR}parameter name="p" string="false">{bad json</${BAR}parameter></${BAR}invoke>`
    const r = parseDsmlToolCalls(text)
    expect(JSON.parse(r!.calls[0]!.arguments).p).toBe('{bad json')
    expect(r?.degraded).toEqual(['f.p'])
  })

  it('D7 体内直接 JSON 对象(无 parameter 标签)', () => {
    const text = `<${BAR}invoke name="g">{"k":2}</${BAR}invoke>`
    const r = parseDsmlToolCalls(text)
    expect(JSON.parse(r!.calls[0]!.arguments)).toEqual({ k: 2 })
  })

  it('D8 无标记 ⇒ null(不是空数组)', () => {
    expect(parseDsmlToolCalls('普通回答,没有工具调用')).toBeNull()
    expect(hasDsmlMarkers('普通回答')).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
