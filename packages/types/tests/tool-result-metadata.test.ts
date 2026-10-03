// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-719(2026-10-03):落库工具结果元数据契约面的镜像测试。
 *
 * 验收判据(逐字取自台账 G-719):镜像两条成对断言 ——
 *   内层未知键 ⇒ 整块拒 / 顶层未知键 ⇒ 保留(passthrough)。
 * 外加:版本 literal(有版本必须有消费者语义)、唯一剥离卡点两向
 * (在场键被剥且不补 undefined / 未登记 kind 一个字节不动)。
 */

import { describe, expect, it } from 'vitest'
import {
  safeParseToolResultMetadata,
  scrubToolDisplayRevokedKeys,
  TOOL_RESULT_METADATA_SCHEMA_VERSION,
  TOOL_RESULT_DISPLAY_REVOKED_KEYS,
} from '../src/tool-result-metadata.js'
const VALID = {
  schemaVersion: 1,
  toolCallId: 'call_1',
  toolName: 'edit_file',
  display: { kind: 'text', text: '已写入 3 处' },
}

describe('G-719 · 镜像成对断言', () => {
  it('内层未知键 ⇒ 整块拒(issues 点名 display 路径)', () => {
    const result = safeParseToolResultMetadata({
      ...VALID,
      display: { ...VALID.display, ghostField: 1 },
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.issues.join(' | ')).toMatch(/display/)
      expect(result.issues.join(' | ')).toMatch(/ghostField/)
    }
  })

  it('顶层未知键 ⇒ passthrough 保留(出现在 data 里)', () => {
    const result = safeParseToolResultMetadata({ ...VALID, futureTopField: { a: 1 } })
    expect(result.success).toBe(true)
    if (result.success) {
      expect((result.data as Record<string, unknown>)['futureTopField']).toEqual({ a: 1 })
    }
  })

  it('基线反例:合法载荷原样通过,且 schemaVersion 是 literal(1)', () => {
    expect(safeParseToolResultMetadata(VALID).success).toBe(true)
    expect(safeParseToolResultMetadata({ ...VALID, schemaVersion: 2 }).success).toBe(false)
    expect(safeParseToolResultMetadata({ ...VALID, schemaVersion: 2 }).success).toBe(
      safeParseToolResultMetadata({ ...VALID, schemaVersion: 999 }).success,
    )
    expect(TOOL_RESULT_METADATA_SCHEMA_VERSION).toBe(1)
  })
})

describe('G-719 · 唯一剥离卡点(只改在场的键)', () => {
  it('登记的撤销键:在场 ⇒ 被剥;缺席 ⇒ 不凭空补 undefined', () => {
    const revokedByKind = { text: ['legacyNote'] }
    const present = { kind: 'text', text: 'x', legacyNote: 'old' }
    scrubToolDisplayRevokedKeys(present, revokedByKind)
    expect(present).toEqual({ kind: 'text', text: 'x' })
    expect('legacyNote' in present).toBe(false)

    const absent = { kind: 'text', text: 'x' }
    scrubToolDisplayRevokedKeys(absent, revokedByKind)
    expect(absent).toEqual({ kind: 'text', text: 'x' })
    expect('legacyNote' in absent).toBe(false)
    expect(Object.keys(absent)).toEqual(['kind', 'text'])
  })

  it('未登记的 kind:一个字节都不动', () => {
    const rows = { kind: 'rows', rows: [{ a: 1 }], legacyNote: 'old' }
    scrubToolDisplayRevokedKeys(rows, { text: ['legacyNote'] })
    expect(rows).toEqual({ kind: 'rows', rows: [{ a: 1 }], legacyNote: 'old' })
  })

  it('生产注册表当前为空表(第一条撤销登记发生在第一次真的撤字段时)', () => {
    expect(TOOL_RESULT_DISPLAY_REVOKED_KEYS).toEqual({})
  })

  it('剥完之后 strict 可过:撤销键不再触发整块拒(卡点在解析前,两步成对)', () => {
    // 用临时登记模拟"撤了一条字段"之后的历史载荷:未剥 ⇒ strict 整块拒;经卡点剥 ⇒ 恢复通过
    const revokedByKind = { text: ['legacyNote'] }
    const payload = {
      schemaVersion: 1,
      toolCallId: 'call_2',
      toolName: 'edit_file',
      display: { kind: 'text', text: 'x', legacyNote: 'old' },
    }
    expect(safeParseToolResultMetadata(payload).success).toBe(false)
    const display = payload.display as Record<string, unknown>
    scrubToolDisplayRevokedKeys(display, revokedByKind)
    expect(safeParseToolResultMetadata(payload).success).toBe(true)
  })
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
