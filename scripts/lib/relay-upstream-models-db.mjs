// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池上游登记的**库面适配层**(纯 IO,零判据):连接守卫复用 scripts/lib/db-probe-client.mjs 的
 * guardDbDsn,写动作全部参数化,只碰 provider_code ∈ 登记表且 owner_uuid IS NULL 的行。
 * 判据(三态 / 写动作集 / 同键归属)住在 `scripts/lib/relay-upstream-models-plan.mjs` 与
 * `scripts/relay-upstream-models-sync.mjs`,本层不复制第二份(§0.6)。
 * description 是"这行是谁写的"唯一取证面:写侧只用 plan 层的 `provenanceDescription` 生成它。
 */
import { loadPostgresDriver } from '../check-migration-ledger-drift.mjs'
import { provenanceDescription } from './relay-upstream-models-plan.mjs'

/** 只允许本机回环库 + 拒生产隧道口;取不到驱动/被守卫拦下 ⇒ {ok:false, why}(调用方落未判定)。 */
export async function openDevClient(dsn) {
  const mod = await loadPostgresDriver()
  const postgres = mod?.default ?? mod
  if (!postgres) return { ok: false, why: 'postgres-js 驱动不可用' }
  return { ok: true, postgres, dsn }
}

/**
 * 快照:全局配置行 + 其模型行。codes 先剥掉数组字面量分隔符,防把清单串拼成非法字面量。
 * 别名必须带双引号:postgres-js 会把未加引号的返回列名整体小写(providerCode → providercode),
 * 判据层按驼峰取键会静默读成 undefined ⇒ 每一行都被判成"缺登记"(假红)。
 * description 必须一起读:同键行是不是本器写的,判据层只认它(读不到 ⇒ 不认领,不动)。
 */
export async function readSnapshot(sql, codes) {
  const literal = `{${codes.map((c) => String(c).replace(/[",{}\\]/g, '')).join(',')}}`
  const configs = await sql`select id, provider_code as "providerCode", name, base_url as "baseUrl",
       api_format as "apiFormat", enabled, description
     from ai_model_config
     where owner_uuid is null and provider_code = any(${literal}::text[]) order by id`
  const ids = configs.map((c) => String(c.id).replace(/[^0-9]/g, '')).filter(Boolean)
  const models = ids.length
    ? await sql`select id, config_id as "configId", model_id as "modelId", enabled,
           is_relay_public as "isRelayPublic"
         from ai_model_config_models
         where config_id = any(${`{${ids.join(',')}}`}::bigint[]) order by config_id, model_id`
    : []
  return { configs, models }
}

/**
 * 落库(单事务)。description 里的出处是"这行是谁写的"唯一可追证面,故必带;
 * 既有行的 name/display_name/description 一律不覆盖(属其它生产者)。
 */
export async function applyActions(sql, actions) {
  const written = []
  await sql.begin(async (tx) => {
    const configIdByProvider = new Map()
    for (const a of actions) {
      if (a.kind === 'insertConfig') {
        // 并发窗口(2026-10-26 补,票面第二半格):快照判 missing 与真正 insert 之间,另一事务
        // 可能已写入同键行。裸 insert 撞唯一约束 ⇒ 整笔事务 23505 回滚;on conflict do nothing
        // 把它降级成"这条没插进去",再由同事务内的复选拿到对方的 id 继续后续模型行。
        // 不带冲突目标:本表有两枚唯一索引(全局部分唯一 + 其它),指定单一目标会漏掉另一枚。
        const ins = await tx`insert into ai_model_config
             (name, provider_code, base_url, api_format, enabled, is_builtin, description)
           values (${a.name}, ${a.providerCode}, ${a.baseUrl}, ${a.apiFormat}, ${a.enabled}, false,
             ${provenanceDescription(a.reason)})
           on conflict do nothing
           returning id`
        let cid = ins[0]?.id
        if (cid === undefined) {
          const again = await tx`select id from ai_model_config
             where provider_code = ${a.providerCode}
               and coalesce(base_url, '') = ${a.baseUrl ?? ''}
               and owner_uuid is null
             order by id limit 1`
          if (again.length !== 1)
            throw new Error(
              `insertConfig 撞唯一约束后复选不到同键行(provider=${a.providerCode} base_url=${a.baseUrl})⇒ 不猜`,
            )
          cid = again[0].id
          written.push(
            `ai_model_config =1 id=${cid} provider=${a.providerCode} base_url=${a.baseUrl}(并发同键 ⇒ 复选复用,未新增)`,
          )
        } else {
          written.push(
            `ai_model_config +1 id=${cid} provider=${a.providerCode} base_url=${a.baseUrl}`,
          )
        }
        configIdByProvider.set(a.providerCode, Number(cid))
      } else if (a.kind === 'updateConfig') {
        // provider + owner_uuid 谓词写进 WHERE(不是只靠 id):登记器结构上改不到别人的配置行
        await tx`update ai_model_config set enabled=${a.enabled}, api_format=${a.apiFormat}, updated_at=now()
           where id=${a.id} and provider_code=${a.providerCode} and owner_uuid is null`
        written.push(
          `ai_model_config ~1 id=${a.id} provider=${a.providerCode} enabled=${a.enabled}`,
        )
      } else if (a.kind === 'insertModel') {
        const cid = a.configId ?? configIdByProvider.get(a.providerCode)
        if (cid === null || cid === undefined)
          throw new Error(`insertModel 定不到 config_id(provider=${a.providerCode})`)
        // metadata 带上游真名的出处(与 apps/api/scripts/relay-workbuddy-models.ts 同形态),
        // 便于日后核对别名映射;catalog(别名→上游真名)不归本器写,见 CLI 头注。
        const ins = await tx`insert into ai_model_config_models
             (config_id, model_id, display_name, enabled, is_relay_public, points_multiplier, metadata)
           values (${cid}, ${a.alias}, ${a.displayName}, true, ${a.isRelayPublic}, 1.00,
             ${JSON.stringify({ [a.providerCode]: { upstreamModel: a.upstreamModel, by: 'scripts/relay-upstream-models-sync.mjs' } })}::jsonb)
           on conflict do nothing
           returning id`
        if (ins.length === 1) {
          written.push(
            `ai_model_config_models +1 config=${cid} model_id=${a.alias} upstream=${a.upstreamModel}`,
          )
        } else {
          // 冲突 ⇒ 复用同键行(大小写不敏感索引也走这一支:lower(model_id) 那把尺子在库里)。
          const dup = await tx`select id from ai_model_config_models
             where config_id = ${cid} and lower(model_id) = lower(${a.alias}) limit 1`
          if (dup.length !== 1)
            throw new Error(
              `insertModel 撞唯一约束后复选不到同键行(config=${cid} model_id=${a.alias})⇒ 不猜`,
            )
          written.push(
            `ai_model_config_models =1 config=${cid} model_id=${a.alias} upstream=${a.upstreamModel}(同键 ⇒ 复用未新增)`,
          )
        }
      } else {
        // updateModel 不需要 config_id(按 id + provider 归属谓词收窄);把它和 insertModel 分岔,
        // 否则漂移这一格会拿 undefined 当"定不到 config_id"炸掉整笔事务。
        await tx`update ai_model_config_models
             set enabled=${a.enabled}, is_relay_public=${a.isRelayPublic}, updated_at=now()
           where id=${a.id} and config_id in (
             select id from ai_model_config where provider_code=${a.providerCode} and owner_uuid is null)`
        written.push(`ai_model_config_models ~1 id=${a.id} provider=${a.providerCode}`)
      }
    }
  })
  return written
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
