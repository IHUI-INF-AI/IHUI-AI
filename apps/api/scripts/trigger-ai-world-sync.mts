// 一次性手动触发 AI World 全量同步(验证 2026-09-05 国内媒体源根治效果;幂等,验证后可删除)
import 'dotenv/config'
import { syncAllSources } from '../src/jobs/ai-world-sync.js'

const results = await syncAllSources()
for (const r of results) {
  const line = `[${r.status}] ${r.source} (${r.kind}): items=${r.itemCount}${r.error ? ' | error=' + r.error : ''}`
  console.log(line)
}
const ok = results.filter((r) => r.status === 'success').length
const partial = results.filter((r) => r.status === 'partial').length
console.log(`SUMMARY: success=${ok} partial=${partial} failed=${results.length - ok - partial}/${results.length}`)
process.exit(0)
