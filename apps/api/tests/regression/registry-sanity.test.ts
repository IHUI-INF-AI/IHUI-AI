/**
 * 回归测试注册表完整性校验
 *
 * 验证 bugfix-registry.ts 的数据完整性:
 * - bug ID 唯一性
 * - bug ID 格式
 * - migrated 状态的测试文件实际存在
 * - pending 状态的测试文件允许不存在(列入待创建计划)
 *
 * 运行:pnpm -F @ihui/api test -- tests/regression/registry-sanity.test.ts
 */
import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { BUG_FIXES, listPendingBugFixes, listMigratedBugFixes } from './bugfix-registry.js'

describe('Bug 修复回归测试注册表完整性', () => {
  it('注册表非空', () => {
    expect(BUG_FIXES.length).toBeGreaterThan(0)
  })

  it('所有 bug ID 唯一', () => {
    const ids = BUG_FIXES.map((b) => b.bugId)
    const duplicates = ids.filter((id, idx) => ids.indexOf(id) !== idx)
    expect(duplicates).toEqual([])
  })

  it('所有 bug ID 符合格式 BUG-R{轮次}-{类别}', () => {
    const pattern = /^BUG-R(\d+)-[A-Z0-9-]+$/
    const invalid = BUG_FIXES.filter((b) => !pattern.test(b.bugId))
    expect(invalid).toEqual([])
  })

  it('migrated 状态的测试文件必须存在', () => {
    const migrated = listMigratedBugFixes()
    const missing: string[] = []
    for (const fix of migrated) {
      const fullPath = resolve(process.cwd(), 'src', fix.testFile)
      if (!existsSync(fullPath)) {
        missing.push(`${fix.bugId} → ${fix.testFile}`)
      }
    }
    expect(missing).toEqual([])
  })

  it('pending 状态的 bug 修复有明确的待创建计划', () => {
    const pending = listPendingBugFixes()
    // pending 状态的记录应有非空的 testFile 和 scenario
    const invalid = pending.filter((p) => !p.testFile || !p.scenario)
    expect(invalid).toEqual([])
  })

  it('pending 数量记录(用于追踪补齐进度)', () => {
    const pending = listPendingBugFixes()
    const migrated = listMigratedBugFixes()
    // 当前全部 pending(17 轮 bug 修复测试均未迁移)
    // 后续每迁移一个,此断言需更新
    console.info(
      `[回归测试进度] migrated: ${migrated.length}/${BUG_FIXES.length}, pending: ${pending.length}`,
    )
    expect(pending.length + migrated.length).toBe(BUG_FIXES.length)
  })
})
