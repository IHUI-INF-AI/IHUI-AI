// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DB-11 夹具（纯静态，读 SQL/源码文本）。
 *
 * 缺陷：迁移 20261106150000 在大表 chat_messages 上直接 CREATE INDEX（整文件包在
 * 事务里 ⇒ SHARE ROW EXCLUSIVE 持到 migrate 结束），索引缺失时部署当轮聊天写入被锁。
 *
 * 判据：
 *  ① manual-sql 的 CONCURRENTLY 脚本幂等：只重建 INVALID 索引，不再无条件 DROP；
 *  ② 部署脚本在迁移前执行该 CONCURRENTLY 脚本（迁移内 IF NOT EXISTS 只作兜底）；
 *  ③ 迁移仍保留 IF NOT EXISTS 兜底（from-zero 不被静默漏索引）。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8')
}

describe('DB-11 大表索引走 CONCURRENTLY', () => {
  const manualSql = read(
    'packages/database/scripts/manual-sql/20261003103000_chat_messages_created_at_idx_CONCURRENTLY.sql',
  )
  const deploy = read('deploy/win/ihui-deploy.ps1')

  it('manual-sql 只重建 INVALID 索引，不再无条件 DROP', () => {
    expect(manualSql).toContain('NOT i.indisvalid')
    expect(manualSql).not.toContain("DROP INDEX CONCURRENTLY IF EXISTS %I;', indexname")
  })

  it('部署在 migrate 前执行 CONCURRENTLY 索引脚本', () => {
    expect(deploy).toContain('function Invoke-PreMigrateConcurrentIndexes')
    expect(deploy).toContain(
      '20261003103000_chat_messages_created_at_idx_CONCURRENTLY.sql',
    )
    const defineAt = deploy.indexOf('function Invoke-PreMigrateConcurrentIndexes')
    const invokeAt = deploy.lastIndexOf('Invoke-PreMigrateConcurrentIndexes')
    const migrateAt = deploy.lastIndexOf('Invoke-MigrateWithBudget')
    expect(invokeAt).toBeGreaterThan(defineAt)
    expect(invokeAt).toBeLessThan(migrateAt)
  })

  it('头注声明迁移内 IF NOT EXISTS 仅作兜底（不修改已入库迁移字节）', () => {
    expect(manualSql).toContain('CREATE INDEX IF NOT EXISTS')
    expect(manualSql).toContain('Invoke-MigrateWithBudget')
    expect(manualSql).toContain('Invoke-PreMigrateConcurrentIndexes')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
