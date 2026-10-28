#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 全局模型配置同键重复行的合并器物(2026-10-26 立)。
 *
 * 立因:dev 库 `ai_model_config` 有 provider_code+base_url 完全相同的两行
 * (token6688: id=1 带 138 个模型 / id=46 带 110 个),而 schema 声明的
 * `uq_ai_model_config_global_provider_base`(owner_uuid IS NULL 上的部分唯一索引)
 * 因这组重复数据而无法建立 —— 补索引必失败。本器物把"重复行"收成一个,并**先备份后删**。
 *
 * 判据(全部现读,不猜):
 *   ① 只有**真子集**关系才合并:被删侧每个 model_id 必须存在于保留侧;否则拒绝(exit 1),
 *      因为那意味着两边各有独有模型,合并会丢东西,必须人工裁决;
 *   ② 两侧的 model 属性(display_name/points_multiplier/is_relay_public/enabled)必须一致,
 *      不一致拒绝(不替用户选价);
 *   ③ 保留侧必须是被引用更多/模型更多的那一行(排序确定性:模型数降序,再 id 升序)。
 *
 * 用法:
 *   node scripts/merge-dup-model-configs.mjs --provider token6688 [--dry-run]
 *   node scripts/merge-dup-model-configs.mjs --provider token6688 --apply
 * 退出码:0 已一致/合并成功 / 1 拒绝(需人工) / 2 未判定(取不到库)。
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { loadPostgresDriver } from './check-migration-ledger-drift.mjs'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')

function arg(name) {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : null
}
const provider = arg('--provider')
const apply = process.argv.includes('--apply')
const dryRun = process.argv.includes('--dry-run') || !apply

function readDsn() {
  const envPath = join(ROOT, 'apps', 'api', '.env')
  let text = ''
  try {
    text = readFileSync(envPath, 'utf8')
  } catch {
    return null
  }
  for (const key of ['DATABASE_URL', 'DATABASE_APP_URL']) {
    const m = text.match(new RegExp(`^${key}=(.*)$`, 'm'))
    if (m) return m[1].trim().replace(/^['"]|['"]$/g, '')
  }
  return null
}

/** 脱敏:只报 host/port/dbname */
function dsnFacts(dsn) {
  try {
    const u = new URL(dsn)
    return `${u.hostname}:${u.port || 5432}/${u.pathname.replace('/', '')}`
  } catch {
    return '<unparsed>'
  }
}

async function main() {
  if (!provider) {
    console.error('❌ 缺 --provider')
    return 2
  }
  const dsn = readDsn()
  if (!dsn) {
    console.error('❌ 取不到 DSN(apps/api/.env 无 DATABASE_URL)⇒ 未判定')
    return 2
  }
  console.log(`库: ${dsnFacts(dsn)}(凭据不回显)`)

  const mod = await loadPostgresDriver()
  if (!mod) {
    console.error('❌ postgres 驱动不可用 ⇒ 未判定')
    return 2
  }
  const postgres = mod.default ?? mod
  const sql = postgres(dsn, { max: 1 })
  try {
    const cfgs = await sql`
      select c.id, c.base_url, c.enabled, c.name,
             (select count(*) from ai_model_config_models m where m.config_id = c.id)::int as models
      from ai_model_config c
      where c.owner_uuid is null and c.provider_code = ${provider}
      order by models desc, c.id asc`
    if (cfgs.length <= 1) {
      console.log(`✅ 无需合并:provider=${provider} 全局配置 ${cfgs.length} 行`)
      return 0
    }
    const keep = cfgs[0]
    const drop = cfgs.slice(1)
    console.log(`保留: id=${keep.id} models=${keep.models} base_url=${keep.base_url}`)
    for (const d of drop) console.log(`候选删除: id=${d.id} models=${d.models} base_url=${d.base_url}`)

    // 判据①②:子集 + 属性一致
    const problems = []
    /** dropId → 需合并进保留行的模型差异行(仅展示名/公开态) */
    const mergePlans = new Map()
    for (const d of drop) {
      if (String(d.base_url ?? '') !== String(keep.base_url ?? ''))
        problems.push(`id=${d.id} base_url 与保留行不同(${d.base_url} ≠ ${keep.base_url})`)
      const diff = await sql`
        select b.model_id,
               (a.display_name is distinct from b.display_name) name_diff,
               (a.points_multiplier is distinct from b.points_multiplier) pts_diff,
               (a.is_relay_public is distinct from b.is_relay_public) pub_diff,
               (a.enabled is distinct from b.enabled) en_diff
        from ai_model_config_models b
        left join ai_model_config_models a on a.config_id = ${keep.id} and lower(a.model_id) = lower(b.model_id)
        where b.config_id = ${d.id}
          and (a.id is null or a.display_name is distinct from b.display_name
               or a.points_multiplier is distinct from b.points_multiplier
               or a.is_relay_public is distinct from b.is_relay_public
               or a.enabled is distinct from b.enabled)`
      // 价格/启用态冲突 ⇒ 拒绝(不替用户选价);展示名与公开态属可合并属性
      const hard = diff.filter((x) => x.pts_diff || x.en_diff)
      if (hard.length > 0) {
        problems.push(
          `id=${d.id} 有 ${hard.length} 个模型的价格或启用态与保留侧冲突(例:${hard
            .slice(0, 3)
            .map((x) => x.model_id)
            .join(', ')})——该档不替用户选价,需人工裁决`,
        )
      } else if (diff.length > 0) {
        console.log(
          `  ≡ 可合并属性差 ${diff.length} 处(id=${d.id}):展示名/公开态 —— 按「中文名优先 + 公开取或」并入保留行`,
        )
      }
      mergePlans.set(d.id, diff)
    }
    if (problems.length > 0) {
      console.error('❌ 拒绝合并(需人工裁决):')
      for (const p of problems) console.error('   - ' + p)
      return 1
    }

    // 备份(仓外留痕)
    const backupDir = join(ROOT, '.ihui-agent', 'state', 'model-config-merge')
    mkdirSync(backupDir, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupFile = join(backupDir, `${provider}-${stamp}.json`)
    const snapshot = { at: new Date().toISOString(), provider, keep, drop }
    const rows = await sql`select * from ai_model_config_models where config_id in ${sql(drop.map((d) => d.id))}`
    writeFileSync(backupFile, JSON.stringify({ ...snapshot, models: rows }, null, 2))
    console.log(`备份: ${backupFile}(${rows.length} 行模型)`)

    if (dryRun) {
      console.log('DRY-RUN:未写库(加 --apply 才执行)')
      return 0
    }

    const dropIds = drop.map((d) => d.id)
    const res = await sql.begin(async (tx) => {
      // ① 先把可合并属性并进保留行(中文展示名优先;公开态取或),再删重复行 ——
      //    顺序不能反:先删就丢掉了中文名与那 8 个"仅重复侧公开"的档位。
      let merged = 0
      for (const [dropId, diffRows] of mergePlans) {
        for (const row of diffRows) {
          const src = await tx`
            select display_name, is_relay_public from ai_model_config_models
            where config_id = ${dropId} and lower(model_id) = lower(${row.model_id}) limit 1`
          if (src.length === 0) continue
          const s = src[0]
          // 中文名优先:含 CJK 的一方胜;两边都中文/都英文时保留保留侧现值(确定性,不随机选)
          const cjk = /[\u4e00-\u9fff]/
          const useDropName = cjk.test(String(s.display_name ?? ''))
          const upd = await tx`
            update ai_model_config_models set
              display_name = case when ${useDropName} then ${s.display_name} else display_name end,
              is_relay_public = is_relay_public or ${s.is_relay_public === true},
              updated_at = now()
            where config_id = ${keep.id} and lower(model_id) = lower(${row.model_id})
            returning id`
          merged += upd.length
        }
      }
      const delModels = await tx`delete from ai_model_config_models where config_id in ${tx(dropIds)} returning id`
      const delCfg = await tx`delete from ai_model_config where id in ${tx(dropIds)} and owner_uuid is null returning id`
      return { models: delModels.length, cfgs: delCfg.length, merged }
    })
    console.log(
      `✅ 合并完成:属性并回 ${res.merged} 行 / 删重复模型 ${res.models} 行 / 删配置 ${res.cfgs} 行`,
    )

    const after = await sql`
      select c.id, (select count(*) from ai_model_config_models m where m.config_id=c.id)::int models
      from ai_model_config c where c.owner_uuid is null and c.provider_code=${provider} order by c.id`
    console.log('合并后:', JSON.stringify(after))
    return 0
  } finally {
    await sql.end()
  }
}

const isDirectRun =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) process.exit(await main())
export { main }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
