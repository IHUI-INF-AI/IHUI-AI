// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-340 取证:登记表"解析不到"不得被读成"没有 retired 行"。
 *
 * 旧码的三级失效链:
 * `registryArrayText` 找不到声明返回 `''` → `extractRegistryBlocks` 把 `''` 读成 `[]` →
 * `readPreviousFaceEntries` 把"解析失败"当成"上一面没有 retired 行" → R4 判"已判定且无问题" →
 * 一次无关的声明/引号格式改动就让删行检测静默通过。
 *
 * 本文件只判一件事:**解析失败必须与合法空表可分辨,且未判定不得默认绿灯**。正常文本的
 * 好路径同时钉住,防止 fail-closed 把正常表判成坏表。
 */
import { describe, it, expect } from 'vitest'
import * as registryModule from '../src/services/audit-export-key-registry.js'
import type { AuditExportKeyEntry } from '../src/services/audit-export-key-registry.js'

const DECLARATION = 'const AUDIT_EXPORT_KEY_REGISTRY: readonly AuditExportKeyEntry[] = ['

/** 正常两行(retired + active)。 */
const NORMAL_SOURCE = [
  DECLARATION,
  '  {',
  "    kid: 'kid-retired',",
  "    status: 'retired',",
  '  },',
  '  {',
  "    kid: 'kid-active',",
  "    status: 'active',",
  '  },',
  ']',
].join('\n')

/** 真·空表:声明在、数组配平、里面确实没有行。 */
const LEGIT_EMPTY_SOURCE = `${DECLARATION}]`

/** 声明被改名(票面触发路径①):源文件里根本没有登记数组。 */
const NO_DECLARATION_SOURCE = 'export const RENAMED_REGISTRY = []'

/** 声明在但数组没有闭合(配平失败)。 */
const UNBALANCED_SOURCE = [
  DECLARATION,
  '  {',
  "    kid: 'kid-retired',",
  "    status: 'retired',",
  '  },',
].join('\n')

/** 块内用双引号(票面触发路径②):旧抽取器只认单引号,整块被静默丢掉。 */
const DOUBLE_QUOTED_SOURCE = [
  DECLARATION,
  '  {',
  '    kid: "kid-retired",',
  '    status: "retired",',
  '  },',
  ']',
].join('\n')

const TODAY = '2026-10-08'

function entryOf(kid: string, status: AuditExportKeyEntry['status']): AuditExportKeyEntry {
  return {
    kid,
    publicKey: 'not-a-real-key',
    status,
    reason: '夹具构造行',
    addedAt: '2026-01-01',
    ...(status === 'retired' ? { retiredAt: '2026-09-01' } : {}),
  }
}

describe('F-340 解析失败必须是可识别的失败,而不是"合法空数组"', () => {
  it('畸形 registry 文本 → registryArrayText 返回 null(不是空串冒充解析成功)', () => {
    expect(registryModule.registryArrayText(NO_DECLARATION_SOURCE)).toBeNull()
    expect(registryModule.registryArrayText(UNBALANCED_SOURCE)).toBeNull()
    // 好路径:真·空表仍然解析成功(否则 fail-closed 会把正常形态判成坏表)。
    expect(registryModule.registryArrayText(LEGIT_EMPTY_SOURCE)).toBe('[]')
    expect(registryModule.registryArrayText(NORMAL_SOURCE)).toContain("kid: 'kid-retired'")
  })

  it('畸形块 → extractRegistryBlocks 给出失败标记,而不是丢块', () => {
    const quoted = registryModule.extractRegistryBlocks(DOUBLE_QUOTED_SOURCE)
    expect(registryModule.registryBlocksParseFailed(quoted)).toBe(true)

    const noDeclaration = registryModule.extractRegistryBlocks(NO_DECLARATION_SOURCE)
    expect(registryModule.registryBlocksParseFailed(noDeclaration)).toBe(true)

    const unbalanced = registryModule.extractRegistryBlocks(UNBALANCED_SOURCE)
    expect(registryModule.registryBlocksParseFailed(unbalanced)).toBe(true)

    // 合法空表不是失败:两处读数为 0 但语义不同,必须靠标记区分。
    const legitEmpty = registryModule.extractRegistryBlocks(LEGIT_EMPTY_SOURCE)
    expect(legitEmpty.length).toBe(0)
    expect(registryModule.registryBlocksParseFailed(legitEmpty)).toBe(false)
  })

  it('空/畸形文本下 readPreviousFaceEntries 返回 null(调用方才能判未判定)', () => {
    const readPrevious = registryModule.readPreviousFaceEntries
    expect(typeof readPrevious).toBe('function')
    if (typeof readPrevious !== 'function') return

    expect(readPrevious(() => '')).toBeNull()
    expect(readPrevious(() => '   ')).toBeNull()
    expect(readPrevious(() => NO_DECLARATION_SOURCE)).toBeNull()
    expect(readPrevious(() => UNBALANCED_SOURCE)).toBeNull()
    expect(readPrevious(() => DOUBLE_QUOTED_SOURCE)).toBeNull()

    const normal = readPrevious(() => NORMAL_SOURCE)
    expect(normal).not.toBeNull()
    expect(normal?.length).toBe(1)
    expect(normal?.[0]?.kid).toBe('kid-retired')
  })

  it('R4 未判定(null)时不得通过:体检退出码必须是失败,而不是绿灯', () => {
    const report = registryModule.auditExportKeyRegistryIssues([], {
      today: TODAY,
      previousEntries: null,
    })
    expect(report.undetermined.some((line) => line.includes('R4'))).toBe(true)
    // 未判定 ≠ 判定为"没删行":不得伪造 R4 结论。
    expect(report.issues.some((issue) => issue.code === 'R4_RETIRED_ROW_DELETED')).toBe(false)

    const check = registryModule.checkAuditExportKeyRegistry({}, TODAY, null)
    expect(check.previousFace).toBe('unavailable')
    expect(check.exitCode).toBe(1)
  })

  it('正常文本仍全部通过:块可解析、R4 能判、合法空表不误报', () => {
    const blocks = registryModule.extractRegistryBlocks(NORMAL_SOURCE)
    expect(registryModule.registryBlocksParseFailed(blocks)).toBe(false)
    expect(blocks.length).toBe(2)
    expect(blocks.map((block) => block.status)).toEqual(['retired', 'active'])

    const previous = registryModule.readPreviousFaceEntries(() => NORMAL_SOURCE) ?? []

    // 行仍在 ⇒ R4 不报删行、也不落未判定。
    const kept = registryModule.auditExportKeyRegistryIssues([entryOf('kid-retired', 'retired')], {
      today: TODAY,
      previousEntries: previous,
    })
    expect(kept.undetermined.some((line) => line.includes('R4'))).toBe(false)
    expect(kept.issues.some((issue) => issue.code === 'R4_RETIRED_ROW_DELETED')).toBe(false)

    // 行被删 ⇒ R4 必须报出来(证明正常解析路径仍能发现真删行)。
    const removed = registryModule.auditExportKeyRegistryIssues([], {
      today: TODAY,
      previousEntries: previous,
    })
    expect(removed.issues.some((issue) => issue.code === 'R4_RETIRED_ROW_DELETED')).toBe(true)

    // 上一面是合法空表 ⇒ 已判定且无问题,不得被 fail-closed 误判成失败。
    const emptyCheck = registryModule.checkAuditExportKeyRegistry({}, TODAY, [])
    expect(emptyCheck.exitCode).toBe(0)
    expect(emptyCheck.undetermined).toEqual([])
  })
})
