// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-448 回归锁:ab_test_results 唯一约束在 schema 与迁移间漂移。
 *
 * 缺陷(见 docs/tickets/2026-11/findings-api.md#F-448):
 *   UNIQUE(variant_id,bucket) 只在首定义迁移 0043_neat_the_spike.sql 里存在;
 *   20260831_feature_gap_tables.sql 的重复建表与 TS schema 都把它丢了(bucket 可空、
 *   无唯一约束)。routes/ab-testing.ts 两处 onConflictDoUpdate({target:[variantId,bucket]})
 *   在 drizzle-kit push / 按 20260831 重建的库上必撞 42P10,同一 variant+bucket 还会重复计数。
 *
 * 修复:迁移 20261112000002_ab_test_results_variant_bucket_uniq.sql 补齐(回填 NULL→exposure、
 *   去重、SET NOT NULL、幂等补约束);本锁钉住 TS schema 侧必须同样接线:
 *   ① bucket 列 NOT NULL;② 存在与迁移同名的 (variant_id,bucket) 唯一约束。
 *
 * 接线锁范式(非直连库):解析 packages/database/src/schema/ab-tests.ts 与修复迁移文本,
 *   断言两侧均声明 NOT NULL 与同名唯一约束——任一侧被摘掉即红。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(here, '..', '..', '..')

const schemaPath = resolve(REPO_ROOT, 'packages/database/src/schema/ab-tests.ts')
const migrationName = '20261112000002_ab_test_results_variant_bucket_uniq.sql'
const migrationPath = resolve(REPO_ROOT, 'packages/database/drizzle', migrationName)

describe('F-448:ab_test_results 唯一约束 schema↔迁移不漂移', () => {
  it('接线锁:schema 侧 bucket 列必须 NOT NULL', () => {
    const src = readFileSync(schemaPath, 'utf8')
    // bucket 列定义行须带 .notNull()(bucket 可空 ⇒ onConflict 判据与约束均退化)
    expect(src).toMatch(/bucket:\s*varchar\('bucket'[^)]*\)\.notNull\(\)/)
  })

  it('接线锁:schema 侧必须存在 (variant_id,bucket) 唯一约束', () => {
    const src = readFileSync(schemaPath, 'utf8')
    // 必须用表级 unique() 约束(对齐迁移 CONSTRAINT UNIQUE),不能退化成可空的独立索引
    expect(src).toMatch(/unique\(\s*'ab_test_results_variant_bucket_uniq'[^)]*\)\.on\(\s*t\.variantId,\s*t\.bucket,\s*\)/)
  })

  it('接线锁:迁移侧必须存在同名约束且 bucket SET NOT NULL', () => {
    const src = readFileSync(migrationPath, 'utf8')
    expect(src).toContain('ALTER COLUMN "bucket" SET NOT NULL')
    expect(src).toContain('ADD CONSTRAINT "ab_test_results_variant_bucket_uniq"')
    expect(src).toMatch(/UNIQUE\s*\(\s*"variant_id",\s*"bucket"\s*\)/)
  })

  it('接线锁:两侧约束名完全一致(否则 generate 又会建第二份)', () => {
    const schemaSrc = readFileSync(schemaPath, 'utf8')
    const migrationSrc = readFileSync(migrationPath, 'utf8')
    const CONSTRAINT = 'ab_test_results_variant_bucket_uniq'
    expect(schemaSrc).toContain(CONSTRAINT)
    expect(migrationSrc).toContain(CONSTRAINT)
  })

  it('接线锁:ab-testing upsert 仍以 [variantId,bucket] 为冲突判据(否则约束形同虚设)', () => {
    const routeSrc = readFileSync(
      resolve(REPO_ROOT, 'apps/api/src/routes/ab-testing.ts'),
      'utf8',
    )
    expect(routeSrc).toMatch(/target:\s*\[\s*abTestResults\.variantId,\s*abTestResults\.bucket\s*\]/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
