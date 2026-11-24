// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Key 级出口绑定的区意图判据(E1–E6)。
 *
 * 钉住的行为契约(2026-11-17 立):
 * - 模型名三段前缀 > Key 上的默认区 > null(交给亲和域推断);
 * - 三者都缺 ⇒ null,绝不是 'global'(null 是"没意见",不是"国际区");
 * - 前缀写的是区内但平台不识别 ⇒ 仍回落 Key 默认区(前缀解析失败不等于放弃绑定)。
 */
import { describe, expect, it } from 'vitest'
import { resolveEgressRegion } from '../src/services/relay-account-forwarder.js'

describe('resolveEgressRegion — Key 级出口绑定', () => {
  it('E1 三段前缀优先于 Key 默认区', () => {
    expect(resolveEgressRegion('qoder/cn/glm-5.2', 'global')).toBe('cn')
    expect(resolveEgressRegion('qoder/global/glm-5.2', 'cn')).toBe('global')
  })

  it('E2 Key 默认区在无前缀时生效', () => {
    expect(resolveEgressRegion('glm-5.2', 'cn')).toBe('cn')
    expect(resolveEgressRegion('glm-5.2', 'global')).toBe('global')
  })

  it('E3 两者都缺 ⇒ null(跟随推断,不冒充 global)', () => {
    expect(resolveEgressRegion('glm-5.2')).toBeNull()
    expect(resolveEgressRegion('glm-5.2', null)).toBeNull()
    expect(resolveEgressRegion('glm-5.2', undefined)).toBeNull()
  })

  it('E4 前缀区名不被识别时回落 Key 默认区', () => {
    // cnx 不是合法区段 ⇒ parseProviderPrefix 拿不到 region ⇒ 用 Key 绑定
    expect(resolveEgressRegion('qoder/cnx/glm-5.2', 'global')).toBe('global')
  })

  it('E5 两段前缀(平台/模型)不被误当区段', () => {
    expect(resolveEgressRegion('qoder/glm-5.2', 'cn')).toBe('cn')
  })

  it('E6 裸名 + 无绑定 = 不改既有行为', () => {
    expect(resolveEgressRegion('Qwen3.8-Max', null)).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
