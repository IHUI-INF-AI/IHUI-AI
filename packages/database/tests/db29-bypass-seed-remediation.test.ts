// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * DB-33 夹具：迁移种子的 known 占位账号 is_active=true 与头注矛盾。
 * 受「不得改 packages/database/drizzle/**」约束，修复以 manual-sql 数据脚本
 * 收口；本夹具断言该脚本存在、覆盖两个标识、关闭 is_active、并改默认值。
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const SCRIPT_PATH = fileURLToPath(
  new URL(
    '../../../packages/database/scripts/manual-sql/20261108090000_disable_test_verify_code_bypass_seed.sql',
    import.meta.url,
  ),
)

describe('DB-33 bypass 种子关闭脚本', () => {
  it('manual-sql 关闭脚本存在', () => {
    expect(existsSync(SCRIPT_PATH)).toBe(true)
  })

  it('覆盖两个已知占位账号并置 is_active=false', () => {
    const source = readFileSync(SCRIPT_PATH, 'utf8')
    expect(source).toMatch(/UPDATE\s+"test_verify_code_bypass"/)
    expect(source).toMatch(/admin@ihui\.local/)
    expect(source).toMatch(/'13000000000'/)
    expect(source).toMatch(/"is_active"\s*=\s*false/)
    // 不得再出现"重新激活"的写法
    expect(source).not.toMatch(/"is_active"\s*=\s*true/)
  })

  it('表级默认值同步改为 false（防止未来 INSERT 静默激活）', () => {
    const source = readFileSync(SCRIPT_PATH, 'utf8')
    expect(source).toMatch(/ALTER\s+TABLE\s+"test_verify_code_bypass"/)
    expect(source).toMatch(/ALTER\s+COLUMN\s+"is_active"\s+SET\s+DEFAULT\s+false/)
  })
})
