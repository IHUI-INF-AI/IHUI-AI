// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 倍率回填(2026-11-23 立,用户定案「只接后台可配置」)。
 *
 * 为什么需要:数据库列 `ai_model_config_models.points_multiplier` 默认 '1.00' 且非空,
 * 没有"未设置"语义。读取源切到该列之前,必须把存量行对齐到**当前实际生效**的推断值,
 * 否则所有 3x/10x/30x 模型会一起被压成 1x(相当于全站降价)。
 *
 * 口径:
 *   · 只处理全局配置(owner_uuid IS NULL),与运行时 resolver 的读取面一致;
 *   · 目标值 = `inferPointsMultiplier(model_id)`,即切换前的真实扣分档位;
 *   · 默认 dry-run,显式 `--apply` 才写库;逐行只改值不同的行,幂等可重跑。
 *
 * 用法(生产机):
 *   node --experimental-strip-types apps/api/scripts/backfill-points-multiplier.mts
 *   node --experimental-strip-types apps/api/scripts/backfill-points-multiplier.mts --apply
 */
import 'dotenv/config'
import postgres from 'postgres'
import { inferPointsMultiplier } from '../src/services/points-multiplier.js'

const APPLY = process.argv.includes('--apply')

interface Row {
  id: number
  modelId: string
  current: string
}

function main(): Promise<void> {
  return run()
}

async function run(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) throw new Error('DATABASE_URL 未设置,拒绝回填(不猜默认值)。')
  const sql = postgres(url, { max: 2 })

  try {
    const rows = await sql<Row[]>`
      SELECT m.id,
             m.model_id AS "modelId",
             m.points_multiplier::text AS current
      FROM ai_model_config_models m
      JOIN ai_model_config c ON c.id = m.config_id
      WHERE c.owner_uuid IS NULL
      ORDER BY m.id
    `

    const changes: Array<{ id: number; modelId: string; from: string; to: string }> = []
    const distribution = new Map<string, number>()
    for (const row of rows) {
      const target = inferPointsMultiplier(row.modelId).toFixed(2)
      distribution.set(target, (distribution.get(target) ?? 0) + 1)
      if (Number(row.current) !== Number(target)) {
        changes.push({ id: row.id, modelId: row.modelId, from: row.current, to: target })
      }
    }

    console.log(`[points-backfill] rows=${rows.length} changes=${changes.length} apply=${APPLY}`)
    console.log(
      `[points-backfill] target distribution=${JSON.stringify(
        Object.fromEntries([...distribution.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))),
      )}`,
    )
    for (const change of changes.slice(0, 20)) {
      console.log(
        `[points-backfill] #${change.id} ${change.modelId}: ${change.from} -> ${change.to}`,
      )
    }
    if (changes.length > 20) {
      console.log(`[points-backfill] ... ${changes.length - 20} more`)
    }

    if (!APPLY || changes.length === 0) {
      console.log('[points-backfill] dry-run done; add --apply to write')
      return
    }

    await sql.begin(async (tx) => {
      for (const change of changes) {
        await tx`
          UPDATE ai_model_config_models
          SET points_multiplier = ${change.to}::numeric(5,2),
              updated_at = now()
          WHERE id = ${change.id}
        `
      }
    })
    console.log(`[points-backfill] applied ${changes.length} rows`)
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main().catch((err: unknown) => {
  console.error('[points-backfill] failed:', err instanceof Error ? err.message : err)
  process.exitCode = 1
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
