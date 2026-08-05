// =============================================================================
// seed-zhs-model-info.mjs
// 用途:把 apps/ai-service/app/data/default_models.json(102 个模型)seed 进
//       zhs_ai_model_info 表(模型市场 DB 驱动数据源,zhs-full.ts schema)。
// 幂等:先清空表再事务插入(配置数据,允许重建)。zhs_ai_model_info 无 RLS。
// 用法:
//   node scripts/seed-zhs-model-info.mjs
// 2026-08-05 立:生产 zhs_ai_model_info 为 0 条,补 /api/models/market 路由后
//   getMarketModels(前端 models-api.ts)链路完整。
// =============================================================================

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
// pnpm 结构下 postgres 在 .pnpm 目录,根 node_modules 无 symlink,直接用绝对路径 require
const { createRequire } = await import('node:module')
const require = createRequire(
  join(__dirname, '..', 'node_modules', '.pnpm', 'postgres@3.4.9', 'node_modules', 'postgres', 'package.json'),
)
const postgres = require('postgres')

const DSN = process.env.DATABASE_URL
const MODELS_FILE = join(__dirname, '..', 'apps', 'ai-service', 'app', 'data', 'default_models.json')

if (!DSN) {
  console.error('[FATAL] DATABASE_URL 未设置(可复制 apps/api/.env 的值)')
  process.exit(1)
}

const sql = postgres(DSN, { max: 2 })

try {
  const raw = JSON.parse(readFileSync(MODELS_FILE, 'utf-8'))
  const models = Array.isArray(raw) ? raw : raw.models
  if (!Array.isArray(models) || models.length === 0) {
    console.error('[FATAL] default_models.json 为空或格式异常')
    process.exit(1)
  }

  console.log(`读取模型清单: ${models.length} 个(${MODELS_FILE})`)

  // 清空(配置数据,允许重建)
  const cleared = await sql`DELETE FROM zhs_ai_model_info`
  console.log(`已清空 zhs_ai_model_info(${cleared.count} 行)`)

  // 事务批量插入
  await sql.begin(async (tx) => {
    for (let i = 0; i < models.length; i += 50) {
      const batch = models.slice(i, i + 50)
      for (const m of batch) {
        await tx`
          INSERT INTO zhs_ai_model_info (
            name, source, status, sort, code, type, model_code, manufacturer,
            variables, is_gratis, is_new, is_top, is_hot, created_at, updated_at
          ) VALUES (
            ${m.name}, ${m.provider}, 1, ${i + 1}, ${m.id}, 0, ${m.id}, ${m.provider},
            ${JSON.stringify({ context_length: m.context_length, input_price: m.input_price })},
            ${m.input_price === 0}, false, false, false, now(), now()
          )
        `
      }
      console.log(`  已插入 ${Math.min(i + 50, models.length)}/${models.length}`)
    }
  })

  const total = await sql`SELECT count(*)::int AS n FROM zhs_ai_model_info`
  const gratis = await sql`SELECT count(*)::int AS n FROM zhs_ai_model_info WHERE is_gratis = true`
  console.log(`\n完成:共 ${total[0].n} 条(免费 ${gratis[0].n} 条)`)
} catch (e) {
  console.error('[FAILED]', e instanceof Error ? e.message : e)
  process.exit(1)
} finally {
  await sql.end()
}
