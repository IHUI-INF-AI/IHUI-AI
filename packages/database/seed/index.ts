import { seedAiTutorials } from './ai-tutorials.js'
import { seedLessons } from './lessons.js'
import { seedAiCategories } from './ai-categories.js'

async function main() {
  console.log('=== 开始种子数据导入 ===')
  console.log('')

  // 1. AI 行业分类（先导入分类，后续资源/课程可关联）
  console.log('[1/3] 导入 AI 行业分类...')
  await seedAiCategories()
  console.log('')

  // 2. 课程数据
  console.log('[2/3] 导入课程数据...')
  await seedLessons()
  console.log('')

  // 3. AI 教学资源
  console.log('[3/3] 导入 AI 教学资源...')
  await seedAiTutorials()
  console.log('')

  console.log('=== 种子数据导入完成 ===')
  process.exit(0)
}

main().catch((err) => {
  console.error('种子数据导入失败:', err)
  process.exit(1)
})
