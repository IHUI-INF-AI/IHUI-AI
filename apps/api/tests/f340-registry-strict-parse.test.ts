// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-340:上一面(HEAD)登记表"解析不到"必须落成未判定,不能读成"没有 retired 行"。
 *
 * 否则一次无关的声明格式改动(改名/改类型标注/换双引号)就会让"退而被删"检查静默通过。
 */
import { describe, it, expect } from 'vitest'
import {
  extractRegistryBlocks,
  extractRegistryBlocksStrict,
} from '../src/services/audit-export-key-registry.js'

const HEADER = 'export const AUDIT_EXPORT_KEY_REGISTRY: readonly AuditExportKeyEntry[] = ['

function withRows(rows: string[], header: string = HEADER): string {
  return [header, ...rows, ']'].join('\n')
}

describe('extractRegistryBlocksStrict', () => {
  it('正常单引号登记行:可解析', () => {
    const src = withRows([
      "  { kid: 'kid-a', status: 'retired' },",
      "  { kid: 'kid-b', status: 'active' },",
    ])
    const blocks = extractRegistryBlocksStrict(src)
    expect(blocks).toEqual([
      { kid: 'kid-a', status: 'retired' },
      { kid: 'kid-b', status: 'active' },
    ])
  })

  it('空表是合法形态(没有行 ≠ 解析失败)', () => {
    expect(extractRegistryBlocksStrict(withRows([]))).toEqual([])
  })

  it('声明被改名/改类型标注 ⇒ null(未判定)', () => {
    const renamed = withRows(["  { kid: 'kid-a', status: 'retired' },"], 'const REGISTRY = [')
    expect(extractRegistryBlocksStrict(renamed)).toBeNull()
    const retyped = withRows(
      ["  { kid: 'kid-a', status: 'retired' },"],
      'export const AUDIT_EXPORT_KEY_REGISTRY: ReadonlyArray<AuditExportKeyEntry> = [',
    )
    expect(extractRegistryBlocksStrict(retyped)).toBeNull()
  })

  it('块内换成双引号 ⇒ null(未判定),不得悄悄跳过该行', () => {
    const src = withRows([
      '  { kid: "kid-a", status: "retired" },',
      "  { kid: 'kid-b', status: 'active' },",
    ])
    expect(extractRegistryBlocksStrict(src)).toBeNull()
  })

  it('宽松版保持旧语义(空数组),供不参与未判定判据的调用方使用', () => {
    const src = withRows(['  { kid: "kid-a", status: "retired" },'])
    expect(extractRegistryBlocks(src)).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
