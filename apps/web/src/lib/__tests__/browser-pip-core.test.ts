// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment node
// 2026-11-24 画中画监看:纯逻辑层直测(尺寸夹取/尺寸记忆/状态判定/登录闸识别)。
// 浮窗 DOM 与 WebSocket 生命周期不在本文件覆盖范围(由 components 层测试兜)。
import { describe, expect, it } from 'vitest'

import {
  PIP_DEFAULT_HEIGHT,
  PIP_DEFAULT_WIDTH,
  PIP_MIN_HEIGHT,
  PIP_MIN_WIDTH,
  PIP_STALL_MS,
  clampPipSize,
  looksLikeHumanGate,
  readStoredPipSize,
  resolveBrowserPipStatus,
  storePipSize,
} from '../browser-pip-core'

function memoryStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const map = new Map<string, string>()
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value)
    },
  }
}

describe('clampPipSize:开窗前把尺寸夹到可读档', () => {
  it('未给尺寸 → 默认 420×280', () => {
    expect(clampPipSize()).toEqual({ width: PIP_DEFAULT_WIDTH, height: PIP_DEFAULT_HEIGHT })
  })

  it('过小尺寸抬到下限 320×200', () => {
    expect(clampPipSize({ width: 120, height: 90 })).toEqual({
      width: PIP_MIN_WIDTH,
      height: PIP_MIN_HEIGHT,
    })
  })

  it('NaN / Infinity 回默认;小数取整', () => {
    expect(clampPipSize({ width: Number.NaN, height: Number.POSITIVE_INFINITY })).toEqual({
      width: PIP_DEFAULT_WIDTH,
      height: PIP_DEFAULT_HEIGHT,
    })
    expect(clampPipSize({ width: 419.6, height: 279.4 })).toEqual({ width: 420, height: 279 })
  })
})

describe('尺寸记忆:坏数据不阻断开窗', () => {
  it('写入后再读回,越界值读时再夹一次', () => {
    const storage = memoryStorage()
    storePipSize({ width: 100, height: 900 }, storage)
    expect(readStoredPipSize(storage)).toEqual({ width: PIP_MIN_WIDTH, height: 900 })
  })

  it('空/坏 JSON/无 storage → 默认', () => {
    const storage = memoryStorage()
    expect(readStoredPipSize(storage)).toEqual({
      width: PIP_DEFAULT_WIDTH,
      height: PIP_DEFAULT_HEIGHT,
    })
    storage.setItem('ihui-browser-pip-size', '{oops')
    expect(readStoredPipSize(storage)).toEqual({
      width: PIP_DEFAULT_WIDTH,
      height: PIP_DEFAULT_HEIGHT,
    })
    expect(readStoredPipSize(null)).toEqual({
      width: PIP_DEFAULT_WIDTH,
      height: PIP_DEFAULT_HEIGHT,
    })
  })
})

describe('resolveBrowserPipStatus:状态优先级', () => {
  const base = { connected: true, phase: 'running' as const, now: 1_000_000 }

  it('未连接 → connecting', () => {
    expect(resolveBrowserPipStatus({ ...base, connected: false, lastFrameAt: 0 }).kind).toBe(
      'connecting',
    )
  })

  it('会话错误压过连接态', () => {
    expect(
      resolveBrowserPipStatus({ ...base, connected: true, phase: 'error', lastFrameAt: 990_000 })
        .kind,
    ).toBe('error')
  })

  it('等待人工 > 画面停更', () => {
    expect(resolveBrowserPipStatus({ ...base, phase: 'waiting', lastFrameAt: 900_000 }).kind).toBe(
      'waiting',
    )
  })

  it('超过 15s 没有新帧 → stalled,并给出秒数', () => {
    const view = resolveBrowserPipStatus({ ...base, lastFrameAt: base.now - (PIP_STALL_MS + 1000) })
    expect(view.kind).toBe('stalled')
    expect(view.stalledSeconds).toBe(16)
  })

  it('帧很新但停在登录页 → gate(画面在动,是人没在)', () => {
    expect(
      resolveBrowserPipStatus({
        ...base,
        lastFrameAt: base.now - 1000,
        url: 'https://accounts.example.com/login?next=/app',
      }).kind,
    ).toBe('gate')
  })

  it('帧很新且普通页面 → running', () => {
    expect(
      resolveBrowserPipStatus({
        ...base,
        lastFrameAt: base.now - 1000,
        url: 'https://example.com/docs',
      }).kind,
    ).toBe('running')
  })
})

describe('looksLikeHumanGate:只做提示,不做判定', () => {
  it('登录/验证/SSO/2FA 命中', () => {
    expect(looksLikeHumanGate('https://example.com/login')).toBe(true)
    expect(looksLikeHumanGate('https://example.com/sign-in?from=home')).toBe(true)
    expect(looksLikeHumanGate('https://sso.example.com/oauth/authorize')).toBe(true)
    expect(looksLikeHumanGate('https://example.com/verify?ticket=1')).toBe(true)
    expect(looksLikeHumanGate('https://example.com/2fa')).toBe(true)
  })

  it('普通内容页不命中', () => {
    expect(looksLikeHumanGate('https://example.com/blog/how-to-login')).toBe(false)
    expect(looksLikeHumanGate('https://example.com/docs/authorization')).toBe(false)
    expect(looksLikeHumanGate('')).toBe(false)
    expect(looksLikeHumanGate(null)).toBe(false)
  })

  it('非法 URL 字符串走兜底正则,不抛错', () => {
    expect(looksLikeHumanGate('not a url but /login here')).toBe(true)
    expect(looksLikeHumanGate('not a url at all')).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
