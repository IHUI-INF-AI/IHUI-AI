import { seedAiTutorials } from './ai-tutorials.js'
import { seedLessons } from './lessons.js'
import { seedAiCategories } from './ai-categories.js'
import { seedPermissions } from './permissions.js'
import { seedUsers } from './users.js'
import { seedAiFresh2026 } from './ai-fresh-2026.js'
import { seedCrossDomain } from './seed-cross-domain.js'

interface SeedStep {
  /** 步骤编号(1-based) */
  index: number
  /** 步骤简短名称(用于输出) */
  name: string
  /** 步骤说明(用于输出) */
  description: string
  /** 步骤执行函数 */
  fn: () => Promise<void>
  /**
   * 是否关键步骤: 失败时整个 seed 进程退出码 1(默认 false,失败仅记录)
   * 仅在以下情况标为 critical:
   *   - seedUsers: 默认登录账号,失败则无法登录
   *   - seedPermissions: RBAC 权限点,失败则 admin 角色无权限
   * 其余数据步骤失败仅记录,便于运维定位但不影响整体 seed 流程
   */
  critical?: boolean
}

const STEPS: SeedStep[] = [
  {
    index: 1,
    name: 'AI 行业分类',
    description: '先导入分类,后续资源/课程可关联',
    fn: seedAiCategories,
  },
  {
    index: 2,
    name: '课程数据',
    description: 'lessons / chapters / sections',
    fn: seedLessons,
  },
  {
    index: 3,
    name: 'AI 教学资源',
    description: 'tutorials / resourceCategories',
    fn: seedAiTutorials,
  },
  {
    index: 4,
    name: '2026-07 真实 AI 资讯',
    description: '直播/考试/资讯/文章/问答/社区/知识库(WebSearch 抓取)',
    fn: seedAiFresh2026,
  },
  {
    index: 5,
    name: '跨领域数据',
    description: '8 领域 80 条:科技/教育/金融/医疗/机器人/AI 艺术/创业投资/政策法规',
    fn: seedCrossDomain,
  },
  {
    index: 6,
    name: 'RBAC 权限点',
    description: '214 条权限码 + admin 角色绑定',
    fn: seedPermissions,
    critical: true,
  },
  {
    index: 7,
    name: '默认登录用户',
    description: 'test / admin 默认账号',
    fn: seedUsers,
    critical: true,
  },
]

/** 解析 CLI 参数: --only=1,3,5 只跑指定编号; --skip=2,4 跳过指定编号 */
function parseFilter(): { only: Set<number>; skip: Set<number> } {
  const only = new Set<number>()
  const skip = new Set<number>()
  for (const arg of process.argv.slice(2)) {
    const onlyMatch = /^--only=(.+)$/.exec(arg)
    if (onlyMatch && onlyMatch[1]) {
      for (const n of onlyMatch[1].split(',').map((s) => Number(s.trim()))) {
        if (Number.isFinite(n)) only.add(n)
      }
      continue
    }
    const skipMatch = /^--skip=(.+)$/.exec(arg)
    if (skipMatch && skipMatch[1]) {
      for (const n of skipMatch[1].split(',').map((s) => Number(s.trim()))) {
        if (Number.isFinite(n)) skip.add(n)
      }
    }
  }
  return { only, skip }
}

async function main() {
  console.info('=== 开始种子数据导入 ===')
  const overallStart = Date.now()
  const { only, skip } = parseFilter()
  const filtered = STEPS.filter((s) => {
    if (only.size > 0 && !only.has(s.index)) return false
    if (skip.has(s.index)) return false
    return true
  })
  if (only.size > 0 || skip.size > 0) {
    console.info(
      `[过滤] only=${only.size > 0 ? [...only].join(',') : '-'}  skip=${
        skip.size > 0 ? [...skip].join(',') : '-'
      }  实际执行 ${filtered.length}/${STEPS.length} 步`,
    )
  }

  let successCount = 0
  let failedCount = 0
  const failures: Array<{ index: number; name: string; error: string }> = []
  let criticalFailed = false

  for (const step of filtered) {
    const stepStart = Date.now()
    process.stdout.write(`[${step.index}/${STEPS.length}] ${step.name} ... `)
    try {
      await step.fn()
      const elapsed = ((Date.now() - stepStart) / 1000).toFixed(1)
      console.info(`✓ ${elapsed}s${step.description ? `  (${step.description})` : ''}`)
      successCount++
    } catch (err) {
      const elapsed = ((Date.now() - stepStart) / 1000).toFixed(1)
      const message = (err as Error).message ?? String(err)
      console.info(`✗ ${elapsed}s  (失败: ${message})`)
      failedCount++
      failures.push({ index: step.index, name: step.name, error: message })
      if (step.critical) criticalFailed = true
    }
  }

  const overallElapsed = ((Date.now() - overallStart) / 1000).toFixed(1)
  console.info('')
  console.info(
    `=== 种子数据导入${criticalFailed ? '失败' : '完成'}: 成功 ${successCount}/${filtered.length}, 失败 ${failedCount}, 耗时 ${overallElapsed}s ===`,
  )
  if (failures.length > 0) {
    console.info('失败步骤:')
    for (const f of failures) {
      console.info(`  - [${f.index}] ${f.name}: ${f.error}`)
    }
  }
  process.exit(criticalFailed ? 1 : 0)
}

main().catch((err) => {
  console.error('种子数据导入未捕获异常:', err)
  process.exit(1)
})
