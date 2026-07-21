/**
 * 临时验证脚本:直接调 listAiWorldItems 验证 H4/H5/H6 数据非空。
 * 不依赖 api server(因其他 agent clawdbot 问题导致 api 起不来)。
 */
import 'dotenv/config'
import { listAiWorldItems, findAiWorldCategories } from '../src/db/ai-world-queries.js'

async function main() {
  const cats = await findAiWorldCategories()
  console.log(`categories: ${cats.length}`)

  for (const kind of ['tool', 'app', 'news', 'paper', 'project'] as const) {
    const items = await listAiWorldItems({ kind, limit: 5 })
    console.log(`${kind}: ${items.length} sample(取前 5)`)
    items.slice(0, 2).forEach((it) => {
      console.log(`  - [${it.source}] ${it.title}`.slice(0, 100))
    })
  }
  process.exit(0)
}

main().catch((e) => {
  console.error('verify failed:', e)
  process.exit(1)
})
