// =============================================================================
// seed-ai-feed-source.mjs
// 用途:初始化 ai_feed_source 源配置表(此前生产为 0 条 → ai-feed-collect 空转)。
// 全部用原生 RSS/Atom 源(sourceType='rss' + 完整 URL),collectAllSources 的
// fetchRssXml 分支直接抓取,不依赖 DAILYHOT_API_URL / RSSHUB_URL(本机实测
// rsshub.app 403 被 Cloudflare 拦、aihot.virxact.com 无公开 API)。
// 源清单(2026-08-05 生产实测可达,返回 <rss>/<feed>):9 个
// 幂等:先清空再插入。ai_feed_source 无 RLS。
// 用法:
//   DATABASE_URL=... node scripts/seed-ai-feed-source.mjs
// =============================================================================

import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const { createRequire } = await import('node:module')
const require = createRequire(
  join(__dirname, '..', 'node_modules', '.pnpm', 'postgres@3.4.9', 'node_modules', 'postgres', 'package.json'),
)
const postgres = require('postgres')

const DSN = process.env.DATABASE_URL
if (!DSN) {
  console.error('[FATAL] DATABASE_URL 未设置(可复制 apps/api/.env 的值)')
  process.exit(1)
}

/** 源清单:sourceCode / sourceName / category / endpoint(原生 RSS 完整 URL) */
const SOURCES = [
  { sourceCode: 'openai-blog', sourceName: 'OpenAI Blog', category: 'ai-media', endpoint: 'https://openai.com/blog/rss.xml', color: '#10a37f' },
  { sourceCode: 'mistral', sourceName: 'Mistral', category: 'ai-media', endpoint: 'https://mistral.ai/rss.xml', color: '#f7a100' },
  { sourceCode: 'nvidia-ai', sourceName: 'NVIDIA AI', category: 'ai-media', endpoint: 'https://blogs.nvidia.com/blog/category/deep-learning/feed/', color: '#76b900' },
  { sourceCode: 'google-research', sourceName: 'Google Research', category: 'ai-media', endpoint: 'https://research.google/blog/rss/', color: '#4285f4' },
  { sourceCode: 'apple-ml', sourceName: 'Apple ML', category: 'ai-media', endpoint: 'https://machinelearning.apple.com/rss.xml', color: '#a2aaad' },
  { sourceCode: 'theverge-ai', sourceName: 'The Verge AI', category: 'ai-media', endpoint: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', color: '#00a6ff' },
  { sourceCode: 'huggingface-blog', sourceName: 'Hugging Face', category: 'ai-media', endpoint: 'https://huggingface.co/blog/feed.xml', color: '#ffd21e' },
  { sourceCode: 'arxiv-cs-ai', sourceName: 'arXiv cs.AI', category: 'ai-paper', endpoint: 'https://export.arxiv.org/rss/cs.AI', color: '#b31b1b' },
  { sourceCode: 'wired-ai', sourceName: 'Wired AI', category: 'ai-media', endpoint: 'https://www.wired.com/feed/tag/ai/latest/rss', color: '#000000' },
]

const sql = postgres(DSN, { max: 2 })

try {
  const cleared = await sql`DELETE FROM ai_feed_source`
  console.log(`已清空 ai_feed_source(${cleared.count} 行)`)

  for (let i = 0; i < SOURCES.length; i++) {
    const s = SOURCES[i]
    await sql`
      INSERT INTO ai_feed_source (
        source_code, source_name, source_type, endpoint, category, color,
        enabled, sort_order, fetch_interval_minutes, description, created_at, updated_at
      ) VALUES (
        ${s.sourceCode}, ${s.sourceName}, 'rss', ${s.endpoint}, ${s.category}, ${s.color},
        true, ${i + 1}, 360, ${`原生 RSS: ${s.endpoint}`}, now(), now()
      )
    `
  }
  console.log(`已插入 ${SOURCES.length} 个源`)

  const rows = await sql`SELECT source_code, source_name, source_type, endpoint, enabled FROM ai_feed_source ORDER BY sort_order`
  console.table(rows)
} catch (e) {
  console.error('[FAILED]', e instanceof Error ? e.message : e)
  process.exit(1)
} finally {
  await sql.end()
}
