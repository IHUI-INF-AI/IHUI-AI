// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 一次性回填全部 Coze BotInfo 配置。
 *
 * 用法：
 *   node --env-file=D:\IHUI-AI\apps\api\.env --import tsx scripts/coze-sync-all.ts
 *
 * 按 agentIds 分批（服务端单批上限 100），确保不会因为错误条目导致剩余条目饿死。
 */

import { isNotNull } from 'drizzle-orm'
import { agents } from '@ihui/database'
import { dbRead } from '../src/db/index.js'
import {
  getCozeCoverage,
  syncManyCozeAgents,
  type SyncAgentResult,
} from '../src/services/coze-bot-sync.js'

const BATCH_SIZE = 100
const CONCURRENCY = 8

async function main(): Promise<void> {
  const rows = await dbRead
    .select({ agentId: agents.agentId, botId: agents.botId })
    .from(agents)
    .where(isNotNull(agents.botId))
    .orderBy(agents.createdAt)

  if (rows.length === 0) {
    console.log(JSON.stringify({ ok: true, totalBots: 0, message: '没有带 bot_id 的 agent' }))
    return
  }

  const allResults: SyncAgentResult[] = []
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE)
    const started = Date.now()
    const result = await syncManyCozeAgents({
      agentIds: chunk.map((r) => r.agentId),
      limit: BATCH_SIZE,
      concurrency: CONCURRENCY,
      isPublished: true,
      allowDraft: true,
    })
    allResults.push(...result.results)
    console.log(
      JSON.stringify({
        phase: 'batch',
        offset: i,
        size: chunk.length,
        synced: result.synced,
        partial: result.partial,
        errors: result.errors,
        elapsedMs: Date.now() - started,
      }),
    )
  }

  const failed = allResults.filter((r) => r.status === 'error')
  const notFound = allResults.filter((r) => r.status === 'not_found')
  const partial = allResults.filter((r) => r.status === 'partial')
  const coverage = await getCozeCoverage()
  console.log(
    JSON.stringify(
      {
        ok: failed.length === 0 && partial.length === 0,
        totalBots: rows.length,
        synced: allResults.filter((r) => r.status === 'synced').length,
        partial: partial.length,
        errors: failed.length,
        notFound: notFound.length,
        failedBotIds: failed.map((r) => r.botId),
        notFoundBotIds: notFound.map((r) => r.botId),
        partialBotIds: partial.map((r) => r.botId),
        coverage,
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(err instanceof Error ? `${err.name}: ${err.message}` : String(err))
  process.exitCode = 1
})
