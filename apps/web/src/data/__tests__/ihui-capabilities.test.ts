// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @vitest-environment node

import { describe, it, expect } from 'vitest'

import { IHUI_CAPABILITIES, IHUI_CATEGORIES, type IhuiCapability } from '../ihui-capabilities'
import { validatePluginViewManifest } from '@/lib/plugin-view-runtime'

/**
 * IHUI 能力矩阵数据契约锁。
 *
 * 只校验本仓自研能力清单的结构与落位，不依赖任何外部程序或取证产物。
 */
describe('IHUI 能力矩阵 · 数据契约', () => {
  it('①字段齐全且 id 唯一', () => {
    expect(IHUI_CAPABILITIES.length).toBeGreaterThan(0)
    const ids = new Set<string>()
    for (const c of IHUI_CAPABILITIES) {
      expect(c.id, 'id 缺失').toMatch(/^[a-z0-9-]+$/)
      expect(ids.has(c.id), `${c.id} 重复`).toBe(false)
      ids.add(c.id)
      expect(c.name.length, `${c.id} 名字空`).toBeGreaterThan(0)
      expect(c.summary.length, `${c.id} 摘要空`).toBeGreaterThan(0)
      expect(c.target.length, `${c.id} 落位空`).toBeGreaterThan(0)
      expect(IHUI_CATEGORIES).toContain(c.category)
      expect(['A', 'B', 'C']).toContain(c.maturity)
    }
  })

  it('②不携带外部程序或证据字段', () => {
    for (const c of IHUI_CAPABILITIES) {
      expect(Object.prototype.hasOwnProperty.call(c, 'source'), `${c.id} 不应有 source`).toBe(false)
      expect(Object.prototype.hasOwnProperty.call(c, 'evidence'), `${c.id} 不应有 evidence`).toBe(
        false,
      )
    }
  })

  it('③挂 view 的条目过 F 类 manifest 校验(单一真相源)', () => {
    const withView = IHUI_CAPABILITIES.filter(
      (c): c is IhuiCapability & { view: NonNullable<IhuiCapability['view']> } => !!c.view,
    )
    expect(withView.length).toBeGreaterThan(0)
    for (const c of withView) {
      const v = validatePluginViewManifest(c.view)
      expect(v.ok, `${c.id} view 未过校验: ${v.problems.join(';')}`).toBe(true)
    }
  })
})
