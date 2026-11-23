// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 倍率只读审计(2026-11-23 立,用户定案「只接后台可配置」;同日改为禁止回写)。
 *
 * 历史用途:数据库列 `ai_model_config_models.points_multiplier` 默认 '1.00' 且非空,
 * 没有"未设置"语义。读取源切到该列之前,曾用本脚本把存量行对齐到旧推断值。
 * 初始回填已完成(两次 dry-run changes=0 后上线),现在 DB 是唯一生效源:
 *   · 后台「中转站模型 → 积分倍数」是唯一编辑入口,展示与扣分都读同列;
 *   · 本脚本**只做只读审计**,列出"当前 DB vs 关键词兜底"的差异供排查;
 *   · 传 `--apply` 直接拒绝(exit 2),避免有人重跑旧推断把后台调好的价格覆盖掉。
 *
 * 用法(生产机,只读):
 *   node --experimental-strip-types apps/api/scripts/backfill-points-multiplier.mts
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

    console.log(`[points-audit] rows=${rows.length} changes=${changes.length} apply=${APPLY}`)
    console.log(
      `[points-audit] target distribution=${JSON.stringify(
        Object.fromEntries([...distribution.entries()].sort((a, b) => Number(a[0]) - Number(b[0]))),
      )}`,
    )
    for (const change of changes.slice(0, 20)) {
      console.log(`[points-audit] #${change.id} ${change.modelId}: ${change.from} -> ${change.to}`)
    }
    if (changes.length > 20) {
      console.log(`[points-audit] ... ${changes.length - 20} more`)
    }

    if (!APPLY) {
      console.log('[points-audit] read-only done; DB points_multiplier is the only source')
      return
    }

    console.error(
      '[points-audit] refused: --apply 已停用。DB points_multiplier 是唯一生效源,请在后台「中转站模型 → 积分倍数」改价;旧推断不得覆盖后台配置。',
    )
    process.exitCode = 2
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main().catch((err: unknown) => {
  console.error('[points-audit] failed:', err instanceof Error ? err.message : err)
  process.exitCode = 1
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
