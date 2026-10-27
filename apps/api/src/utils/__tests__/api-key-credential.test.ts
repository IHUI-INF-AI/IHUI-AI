// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * utils/api-key-credential.ts 直接单测(2026-10-27,E2E 自动补测票补缺)。
 *
 * 全仓此前零测试引用(仅业务路由 import),本文件补纯函数真断言与 compose/parse 往返。
 * 模块契约:只负责"拆",绝不负责"信"——真伪由调用方查库 + 哈希比对判定。
 */
import { describe, it, expect } from 'vitest'

import { composeApiCredential, parseApiCredential } from '../api-key-credential.js'

describe('parseApiCredential', () => {
  it('空输入(null/undefined/空串/纯空白)→ 三字段空态,不冒充 API key', () => {
    expect(parseApiCredential(null)).toEqual({ key: null, secret: null, looksLikeApiKey: false })
    expect(parseApiCredential(undefined)).toEqual({
      key: null,
      secret: null,
      looksLikeApiKey: false,
    })
    expect(parseApiCredential('')).toEqual({ key: null, secret: null, looksLikeApiKey: false })
    expect(parseApiCredential('   ')).toEqual({ key: null, secret: null, looksLikeApiKey: false })
  })

  it('非 ihui_ 输入(JWT/乱码)key 原样返回、looksLikeApiKey=false(解析层不制造拒绝分支)', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.payload.sig'
    expect(parseApiCredential(jwt)).toEqual({ key: jwt, secret: null, looksLikeApiKey: false })
  })

  it('纯公开标识 ihui_<hex> → key 原样、secret null、looksLikeApiKey=true', () => {
    expect(parseApiCredential('ihui_0123456789abcdef01234567')).toEqual({
      key: 'ihui_0123456789abcdef01234567',
      secret: null,
      looksLikeApiKey: true,
    })
  })

  it('组合形态 ihui_key.sk_secret → 双因子都拆出;首点分隔,secret 自身可含点', () => {
    expect(
      parseApiCredential('ihui_0123456789abcdef01234567.sk_0123456789abcdef0123456789abcdef'),
    ).toEqual({
      key: 'ihui_0123456789abcdef01234567',
      secret: 'sk_0123456789abcdef0123456789abcdef',
      looksLikeApiKey: true,
    })
    expect(parseApiCredential('ihui_a.sk_x.y.z')).toEqual({
      key: 'ihui_a',
      secret: 'sk_x.y.z',
      looksLikeApiKey: true,
    })
  })

  it('两端空白在拆分前后都被 trim;拆完为空的段回 null(不造空串假凭据)', () => {
    expect(parseApiCredential('  ihui_a.sk_b  ')).toEqual({
      key: 'ihui_a',
      secret: 'sk_b',
      looksLikeApiKey: true,
    })
    expect(parseApiCredential('ihui_a.')).toEqual({
      key: 'ihui_a',
      secret: null,
      looksLikeApiKey: true,
    })
    expect(parseApiCredential('ihui_a.   ')).toEqual({
      key: 'ihui_a',
      secret: null,
      looksLikeApiKey: true,
    })
    // 前缀内的点:ikey 段退到 'ihui_' 仍在(前缀保证 key 非空,点后段照拆)
    expect(parseApiCredential('ihui_.sk_b')).toEqual({
      key: 'ihui_',
      secret: 'sk_b',
      looksLikeApiKey: true,
    })
  })
})

describe('composeApiCredential', () => {
  it('有 secret → 组合形态;无/空 secret → 退化为纯公开标识', () => {
    expect(composeApiCredential('ihui_a', 'sk_b')).toBe('ihui_a.sk_b')
    expect(composeApiCredential('ihui_a')).toBe('ihui_a')
    expect(composeApiCredential('ihui_a', null)).toBe('ihui_a')
    expect(composeApiCredential('ihui_a', '   ')).toBe('ihui_a')
  })

  it('compose/parse 往返恒等(单凭据下发↔解析闭环)', () => {
    const key = 'ihui_0123456789abcdef01234567'
    const secret = 'sk_0123456789abcdef0123456789abcdef'
    expect(parseApiCredential(composeApiCredential(key, secret))).toEqual({
      key,
      secret,
      looksLikeApiKey: true,
    })
    expect(parseApiCredential(composeApiCredential(key))).toEqual({
      key,
      secret: null,
      looksLikeApiKey: true,
    })
  })
})
