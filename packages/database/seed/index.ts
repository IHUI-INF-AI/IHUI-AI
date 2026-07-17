import { seedAiTutorials } from './ai-tutorials.js'
import { seedLessons } from './lessons.js'
import { seedAiCategories } from './ai-categories.js'
import { seedPermissions } from './permissions.js'
import { seedUsers } from './users.js'
import { seedAiFresh2026 } from './ai-fresh-2026.js'

async function main() {
  console.info('=== 开始种子数据导入 ===')
  console.info('')

  // 1. AI 行业分类(先导入分类,后续资源/课程可关联)
  console.info('[1/6] 导入 AI 行业分类...')
  await seedAiCategories()
  console.info('')

  // 2. 课程数据
  console.info('[2/6] 导入课程数据...')
  await seedLessons()
  console.info('')

  // 3. AI 教学资源
  console.info('[3/6] 导入 AI 教学资源...')
  await seedAiTutorials()
  console.info('')

  // 4. 2026-07 真实 AI 资讯(直播/考试/资讯/文章/问答/社区/知识库)
  console.info('[4/6] 导入 2026-07 真实 AI 资讯(WebSearch 抓取)...')
  await seedAiFresh2026()
  console.info('')

  // 5. RBAC 权限点(214 条权限码 + admin 角色绑定)
  console.info('[5/6] 导入 RBAC 权限点...')
  await seedPermissions()
  console.info('')

  // 6. 默认登录用户(test / admin)
  console.info('[6/6] 导入默认用户...')
  await seedUsers()
  console.info('')

  console.info('=== 种子数据导入完成 ===')
  process.exit(0)
}

main().catch((err) => {
  console.error('种子数据导入失败:', err)
  process.exit(1)
})
