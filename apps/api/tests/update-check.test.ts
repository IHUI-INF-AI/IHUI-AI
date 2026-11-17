// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 更新检测判据(2026-11-17)。
 *
 * 这组用例的重点不是"能算出有没有新版本",而是**不把"没问到"说成"已是最新"**:
 * 远端无 release / 预发布 / 版本非法,全部必须落 determined:false 并带原因。
 */
import { describe, expect, it } from 'vitest'
import {
  compareVersions,
  decideUpdate,
  normalizeVersion,
} from '../src/services/update-check-service.js'

describe('版本归一与比较', () => {
  it('V1 基本比较', () => {
    expect(compareVersions('1.2.3', '1.2.4')).toBe(-1)
    expect(compareVersions('1.3.0', '1.2.9')).toBe(1)
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0)
  })

  it('V2 v 前缀与空白不影响结论', () => {
    expect(normalizeVersion(' v1.2.3 ')).toBe('1.2.3')
    expect(compareVersions('v1.2.3', '1.2.3')).toBe(0)
  })

  it('V3 段数不等按 0 补(1.2 == 1.2.0)', () => {
    expect(compareVersions('1.2', '1.2.0')).toBe(0)
    expect(compareVersions('1.2.1', '1.2')).toBe(1)
  })

  it('V4 预发布后缀只取数字前缀', () => {
    expect(compareVersions('1.2.3-beta.1', '1.2.3')).toBe(0)
  })

  it('V5 非法版本 ⇒ null(不猜)', () => {
    expect(compareVersions('', '1.2.3')).toBeNull()
    expect(compareVersions('abc', '1.2.3')).toBeNull()
  })
})

describe('更新结论', () => {
  it('V6 远端更新 ⇒ determined + has_update', () => {
    const r = decideUpdate('1.1.5', {
      tag_name: 'v1.2.0',
      html_url: 'https://example.com/release/1.2.0',
      name: 'v1.2.0',
    })
    expect(r.determined).toBe(true)
    expect(r.has_update).toBe(true)
    expect(r.latest).toBe('1.2.0')
    expect(r.release_url).toBe('https://example.com/release/1.2.0')
  })

  it('V7 已是最新 ⇒ determined + has_update=false(这是唯一允许返回 false 的格)', () => {
    const r = decideUpdate('1.2.0', { tag_name: 'v1.2.0' })
    expect(r.determined).toBe(true)
    expect(r.has_update).toBe(false)
  })

  it('V8 远端没有 release ⇒ 未判定,不冒充已最新', () => {
    const r = decideUpdate('1.2.0', null)
    expect(r.determined).toBe(false)
    expect(r.has_update).toBeNull()
    expect(r.reason).toContain('没有可用 release')
  })

  it('V9 draft / pre-release 不计入升级提示', () => {
    const draft = decideUpdate('1.2.0', { tag_name: 'v1.3.0', draft: true })
    expect(draft.determined).toBe(false)
    expect(draft.reason).toContain('draft')
    const pre = decideUpdate('1.2.0', { tag_name: 'v1.3.0', prerelease: true })
    expect(pre.determined).toBe(false)
  })

  it('V10 缺 tag_name 或本机版本为空 ⇒ 未判定并点名', () => {
    expect(decideUpdate('1.2.0', {}).reason).toContain('tag_name')
    expect(decideUpdate('', { tag_name: 'v1.2.0' }).reason).toContain('本机版本为空')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
