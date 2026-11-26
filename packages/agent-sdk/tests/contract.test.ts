// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * L14/RP-21 三端共用协议层的契约测试(2026-11-26)。
 *
 * 钉的是"方法表只有一份"这件事本身:
 *  1. 方法值互不重复(重复即两套语义挤在一个字面量上);
 *  2. 请求方法 / 通知方法两族**恰好**覆盖全部方法,不重不漏(漏一个 = 某端静默收不到);
 *  3. 错误码表是运行时真值,长度与内容稳定(三端比对读的是这张表,不是各自的 type);
 *  4. 键名是语义名(三端按它写代码),值才是线上一字不差的字面量 —— 两者不许混用。
 */

import { describe, expect, it } from 'vitest'
import { ACP_METHODS as TYPES_ACP_METHODS } from '@ihui/types'

import {
  ACP_METHODS,
  ACP_NOTIFICATION_METHODS,
  ACP_REQUEST_METHODS,
  AGENT_SDK_ERROR_CODES,
  type AcpMethodName,
} from '../src/index.js'

describe('L14 三端共用协议契约', () => {
  it('方法值互不重复', () => {
    const values = Object.values(ACP_METHODS)
    expect(new Set(values).size).toBe(values.length)
  })

  it('请求族 + 通知族恰好覆盖全部方法,不重不漏', () => {
    const all = new Set<AcpMethodName>(Object.values(ACP_METHODS))
    const partitioned = new Set<AcpMethodName>([
      ...ACP_REQUEST_METHODS,
      ...ACP_NOTIFICATION_METHODS,
    ])
    expect(partitioned.size).toBe([...partitioned].length)
    expect(partitioned).toEqual(all)
    for (const overlap of ACP_REQUEST_METHODS) {
      expect(ACP_NOTIFICATION_METHODS).not.toContain(overlap)
    }
  })

  it('方法名限定在 ACP 命名空间内,且不含空格/大写', () => {
    for (const value of Object.values(ACP_METHODS)) {
      expect(value).toMatch(/^[a-z]+\/[a-z]+$|^[a-z]+$/)
    }
  })

  it('错误码是运行时真值且稳定(5 个,顺序即契约)', () => {
    expect(AGENT_SDK_ERROR_CODES).toEqual(['PROTOCOL', 'RPC', 'SPAWN', 'AGENT_EXIT', 'ABORTED'])
    expect(Array.isArray(AGENT_SDK_ERROR_CODES)).toBe(true)
    expect(AGENT_SDK_ERROR_CODES.length).toBe(5)
  })

  it('SDK 转发的是 @ihui/types 的同一份方法表,不是第二份副本', () => {
    expect(ACP_METHODS).toBe(TYPES_ACP_METHODS)
  })

  it('键是语义名、值是线上字面量:sessionNew/sessionPrompt 不许反过来', () => {
    expect(ACP_METHODS.sessionNew).toBe('session/new')
    expect(ACP_METHODS.sessionPrompt).toBe('session/prompt')
    expect(ACP_METHODS.sessionUpdate).toBe('session/update')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
