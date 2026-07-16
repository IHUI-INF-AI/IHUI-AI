/**
 * 历史数据迁移脚本框架（P0-MIG-1）。
 *
 * 用法：
 *   pnpm --filter @ihui/api tsx src/scripts/migrate-legacy-data.ts --dry-run
 *   pnpm --filter @ihui/api tsx src/scripts/migrate-legacy-data.ts --batch 20260717-001
 *
 * 模式：
 * - --dry-run：输出导入计划（表/预估行数/依赖顺序），不写库
 * - --batch <batchId>：实际导入模式，按依赖顺序导入，断点续传
 *
 * 依赖顺序（Java 旧表 → TS 新表）：
 *   user → course → chapter → enrollment → answer → wrong_question → point_record
 *
 * 断点续传：每条记录导入前调 hasBeenMigrated 跳过已完成。
 * 具体导入逻辑由 P0-MIG-2 实现，本框架只提供骨架。
 */
import { hasBeenMigrated } from '../db/id-mapping-queries.js'

interface MigrationStep {
  legacyTable: string
  newTable: string
  dependsOn: string[]
  // P0-MIG-2 将实现具体导入逻辑（读源库 → 写目标库 → 写 id_mapping）
  // importFn 内部应调 shouldSkip 实现断点续传
  importFn?: (
    batch: string,
    dryRun: boolean,
  ) => Promise<{ total: number; migrated: number; skipped: number }>
}

/** 断点续传检查:已迁移记录返回 true,importFn 应跳过。 */
export async function shouldSkip(legacyTable: string, legacyId: number): Promise<boolean> {
  return hasBeenMigrated(legacyTable, legacyId)
}

const MIGRATION_PLAN: MigrationStep[] = [
  { legacyTable: 'user', newTable: 'users', dependsOn: [] },
  { legacyTable: 'course', newTable: 'courses', dependsOn: ['user'] },
  { legacyTable: 'chapter', newTable: 'chapters', dependsOn: ['course'] },
  { legacyTable: 'enrollment', newTable: 'enrollments', dependsOn: ['user', 'course'] },
  { legacyTable: 'answer', newTable: 'answers', dependsOn: ['user', 'chapter'] },
  { legacyTable: 'wrong_question', newTable: 'wrong_questions', dependsOn: ['user', 'chapter'] },
  { legacyTable: 'point_record', newTable: 'point_records', dependsOn: ['user'] },
]

function parseArgs(argv: string[]): { dryRun: boolean; batch: string | null } {
  const dryRun = argv.includes('--dry-run')
  const batchIdx = argv.indexOf('--batch')
  const batch = batchIdx >= 0 ? (argv[batchIdx + 1] ?? null) : null
  return { dryRun, batch }
}

function generateBatchId(): string {
  const d = new Date()
  const ts = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`
  return `mig-${ts}`
}

function printPlan(batch: string): void {
  console.info('=== 历史数据迁移计划（dry-run）===')
  console.info(`批次号: ${batch}`)
  console.info(`步骤数: ${MIGRATION_PLAN.length}`)
  console.info('依赖顺序:')
  for (const step of MIGRATION_PLAN) {
    const deps = step.dependsOn.length ? ` ← ${step.dependsOn.join(', ')}` : ''
    console.info(`  - ${step.legacyTable} → ${step.newTable}${deps}`)
  }
  console.info('提示: 实际导入请使用 --batch <batchId>')
}

async function runMigration(opts: { dryRun: boolean; batch: string }): Promise<void> {
  const { dryRun, batch } = opts
  if (dryRun) {
    printPlan(batch)
    return
  }

  console.info(`=== 开始历史数据迁移(批次: ${batch})===`)
  for (const step of MIGRATION_PLAN) {
    console.info(`\n[${step.legacyTable} → ${step.newTable}]`)
    if (!step.importFn) {
      console.info('  ⏸ 导入逻辑待 P0-MIG-2 实现,跳过')
      continue
    }
    const result = await step.importFn(batch, dryRun)
    console.info(`  完成: 总计 ${result.total} / 已迁 ${result.migrated} / 跳过 ${result.skipped}`)
  }
  console.info(`\n=== 迁移结束(批次: ${batch})===`)
}

async function main(): Promise<void> {
  const { dryRun, batch } = parseArgs(process.argv.slice(2))
  const batchId = batch ?? generateBatchId()
  if (!dryRun && !batch) {
    console.info(`未指定 --batch,自动生成批次号: ${batchId}`)
  }
  await runMigration({ dryRun, batch: batchId })
}

main().catch((err) => {
  console.error('迁移脚本异常:', err)
  process.exit(1)
})

export { MIGRATION_PLAN, runMigration, parseArgs, generateBatchId }
export type { MigrationStep }
