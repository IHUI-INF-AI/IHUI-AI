// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * P0 工具链韧性三件的行为锁(2026-11-27)。
 *
 * ① 崩溃隔离:工具真抛异常 ⇒ 折成 suicide-free 的失败结果(errorType=tool_crashed),
 *    不得让 Promise.all 炸掉同批其余与后续批次;
 * ② tool_choice:显式给值才进请求体;缺省请求体没有该键(逐字节兼容旧请求);
 * ③ native 恢复:降级后满 NATIVE_TOOLS_RETRY_INTERVAL 轮重试一次原生,未满/未降级不重试。
 */
import { describe, expect, it } from 'vitest'
import { toolCrashResult } from '../src/tools/tool-crash.js'
import {
  buildNativeToolsBody,
  shouldRetryNativeTools,
  NATIVE_TOOLS_RETRY_INTERVAL,
  type ToolChoice,
} from '../src/tools/native-tools-body.js'

describe('P0 工具链韧性', () => {
  describe('① 崩溃隔离:toolCrashResult', () => {
    it('Error ⇒ success:false / errorType=tool_crashed / output 空 / 原文保留', () => {
      const r = toolCrashResult({ name: 'run_command' }, new Error('spawn failed'))
      expect(r.success).toBe(false)
      expect(r.output).toBe('')
      expect(r.errorType).toBe('tool_crashed')
      expect(r.error).toContain('run_command')
      expect(r.error).toContain('spawn failed')
    })

    it('非 Error 抛出物(字符串)也折,文案原样', () => {
      const r = toolCrashResult({ name: 'fetch_url' }, 'socket hang up')
      expect(r.success).toBe(false)
      expect(r.errorType).toBe('tool_crashed')
      expect(r.error).toContain('socket hang up')
    })
  })

  describe('② tool_choice:buildNativeToolsBody', () => {
    const oneTool = [{ type: 'function' as const, function: { name: 'a', parameters: {} } }]

    it('显式 required ⇒ 请求体带 tool_choice', () => {
      const body = buildNativeToolsBody(oneTool, 'required')
      expect(body).toBeDefined()
      expect(body?.tool_choice).toBe('required')
      expect(Array.isArray(body?.tools)).toBe(true)
    })

    it('缺省 ⇒ 请求体没有 tool_choice 键(逐字节兼容)', () => {
      const body = buildNativeToolsBody(oneTool)
      expect(body).toBeDefined()
      expect(Object.prototype.hasOwnProperty.call(body!, 'tool_choice')).toBe(false)
    })

    it('空 tools ⇒ undefined(不携带 tools 字段)', () => {
      expect(buildNativeToolsBody([], 'required')).toBeUndefined()
    })

    it('对象形(指定具体工具)原样进 body', () => {
      const choice: ToolChoice = { type: 'function', function: { name: 'search' } }
      const body = buildNativeToolsBody(oneTool, choice)
      expect(body?.tool_choice).toEqual(choice)
    })
  })

  describe('③ native 恢复:shouldRetryNativeTools', () => {
    it('降级后满间隔 ⇒ 重试;差一轮 ⇒ 不重试', () => {
      expect(shouldRetryNativeTools(false, 10, 10 + NATIVE_TOOLS_RETRY_INTERVAL - 1)).toBe(false)
      expect(shouldRetryNativeTools(false, 10, 10 + NATIVE_TOOLS_RETRY_INTERVAL)).toBe(true)
    })

    it('未降级 或 无降级记录 ⇒ 永不重试', () => {
      expect(shouldRetryNativeTools(true, 10, 1000)).toBe(false)
      expect(shouldRetryNativeTools(false, null, 1000)).toBe(false)
    })

    it('间隔常量钉在 5(改值必须同时改测试)', () => {
      expect(NATIVE_TOOLS_RETRY_INTERVAL).toBe(5)
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
