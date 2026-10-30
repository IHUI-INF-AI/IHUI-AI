// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * base64 跨端工具测试(2026-10-26 立,补"零测试对应共享层工具"第一批)
 *
 * 取证对象:packages/shared/src/utils/base64.ts(web 走原生 btoa;
 * Hermes/miniapp 无 btoa 时走 polyfill)。
 * 用例纪律:期望值全部为独立可解释字面量或另一标准实现(原生 btoa / RFC 4648),
 * 不复制被测实现的正则/表(§22c)。
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { btoa, arrayBufferToBase64 } from '../../src/utils/base64'

/** 模块加载时环境里存在的那把原生 btoa(作为跨实现对照的 oracle,非被测拷贝) */
const nativeBtoaRef = globalThis.btoa

describe('btoa(当前宿主路径)', () => {
  it('空串 → 空串(两路径一致,零长度不进循环)', () => {
    expect(btoa('')).toBe('')
  })

  it('RFC 4648 标准样例:三字节整除 / 一字节 / 两字节三种填充族', () => {
    expect(btoa('abc')).toBe('YWJj') // 3n 无填充
    expect(btoa('a')).toBe('YQ==') // 3n+1 双等号
    expect(btoa('ab')).toBe('YWI=') // 3n+2 单等号
  })

  it('常见文本与 Buffer(base64 标准实现)逐字相等', () => {
    expect(btoa('Hello, World')).toBe('SGVsbG8sIFdvcmxk')
  })

  it('Latin-1 全字节域(0..255)与原生 btoa 逐字节一致 —— 编码族不分叉', () => {
    const latin1 = Array.from({ length: 256 }, (_, i) => String.fromCharCode(i)).join('')
    expect(btoa(latin1)).toBe(nativeBtoaRef(latin1))
  })

  it('同输入重复调用结果确定(纯函数、无内部游标状态)', () => {
    const first = btoa('repeat-me')
    expect(btoa('repeat-me')).toBe(first)
    expect(btoa('repeat-me')).toBe(first)
  })
})

describe('arrayBufferToBase64', () => {
  it('ASCII 字节序列 → 已知字面量', () => {
    expect(arrayBufferToBase64(new Uint8Array([72, 101, 108, 108, 111]).buffer)).toBe('SGVsbG8=')
  })

  it('含 >127 的二进制边界字节(音频/图片分片常见形态)→ 已知字面量', () => {
    expect(arrayBufferToBase64(new Uint8Array([0, 1, 2, 253, 254, 255]).buffer)).toBe('AAEC/f7/')
  })

  it('零长度 ArrayBuffer → 空串', () => {
    expect(arrayBufferToBase64(new Uint8Array(0).buffer)).toBe('')
  })

  it('入参 buffer 不被改写(无副作用)', () => {
    const buf = new Uint8Array([72, 101, 108, 108, 111])
    arrayBufferToBase64(buf.buffer)
    expect(Array.from(buf)).toEqual([72, 101, 108, 108, 111])
  })
})

describe('polyfill 路径(宿主无原生 btoa 时)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  /** 造一份"加载时看不到 btoa"的模块实例,逼出 polyfill 回退分支 */
  async function importPolyfillVariant() {
    vi.resetModules()
    vi.stubGlobal('btoa', undefined)
    return import('../../src/utils/base64')
  }

  it('Latin-1 全字节域 + 三种填充族与原生逐字相等(回退不分叉)', async () => {
    const mod = await importPolyfillVariant()
    const latin1 = Array.from({ length: 256 }, (_, i) => String.fromCharCode(i)).join('')
    expect(mod.btoa(latin1)).toBe(nativeBtoaRef(latin1))
    expect(mod.btoa('abc')).toBe('YWJj')
    expect(mod.btoa('a')).toBe('YQ==')
    expect(mod.btoa('ab')).toBe('YWI=')
    expect(mod.btoa('')).toBe('')
  })

  it('已知缺陷留档:码点 >255 时 polyfill 静默产出残缺结果,而原生 btoa 抛错(未收格)', async () => {
    // 现状钉桩(characterization),不是认可:中文等非 Latin-1 文本经 polyfill
    // 会得到"能解码但内容错"的串,调用方无从察觉 —— 与 web 端(抛 InvalidCharacterError)
    // 行为分叉。修复方向 = polyfill 遇码点 >255 显式 throw,或先 UTF-8 编码再折叠。
    const mod = await importPolyfillVariant()
    expect(() => nativeBtoaRef('中')).toThrow() // 原生:显式失败
    expect(mod.btoa('中')).toBe('Q==') // polyfill:静默错值(实测钉桩)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
