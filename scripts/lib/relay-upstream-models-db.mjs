// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池上游登记的**库面适配层**(纯 IO,零判据):连接守卫复用 scripts/lib/db-probe-client.mjs 的
 * guardDbDsn,写动作全部参数化,只碰 provider_code ∈ 登记表且 owner_uuid IS NULL 的行。
 * 判据(三态与写动作集)住在 `scripts/relay-upstream-models-sync.mjs`,本层不复制第二份(§0.6)。
 */
import { loadPostgresDriver } from '../check-migration-ledger-drift.mjs'

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
 */
export async function readSnapshot(sql, codes) {
  const literal = `{${codes.map((c) => String(c).replace(/[",{}\\]/g, '')).join(',')}}`
  const configs = await sql`select id, provider_code as "providerCode", name, base_url as "baseUrl",
       api_format as "apiFormat", enabled
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
        const ins = await tx`insert into ai_model_config
             (name, provider_code, base_url, api_format, enabled, is_builtin, description)
           values (${a.name}, ${a.providerCode}, ${a.baseUrl}, ${a.apiFormat}, ${a.enabled}, false,
             ${`号池上游登记 · 由 scripts/relay-upstream-models-sync.mjs 依 scripts/data/relay-upstream-models.jsonl 落库(${a.reason})`})
           returning id`
        configIdByProvider.set(a.providerCode, Number(ins[0].id))
        written.push(`ai_model_config +1 id=${ins[0].id} provider=${a.providerCode} base_url=${a.baseUrl}`)
      } else if (a.kind === 'updateConfig') {
        // provider + owner_uuid 谓词写进 WHERE(不是只靠 id):登记器结构上改不到别人的配置行
        await tx`update ai_model_config set enabled=${a.enabled}, api_format=${a.apiFormat}, updated_at=now()
           where id=${a.id} and provider_code=${a.providerCode} and owner_uuid is null`
        written.push(`ai_model_config ~1 id=${a.id} provider=${a.providerCode} enabled=${a.enabled}`)
      } else {
        const cid = a.configId ?? configIdByProvider.get(a.providerCode)
        if (cid === null || cid === undefined)
          throw new Error(`insertModel 定不到 config_id(provider=${a.providerCode})`)
        if (a.kind === 'insertModel') {
          // metadata 带上游真名的出处(与 apps/api/scripts/relay-workbuddy-models.ts 同形态),
          // 便于日后核对别名映射;catalog(别名→上游真名)不归本器写,见 CLI 头注。
          await tx`insert into ai_model_config_models
               (config_id, model_id, display_name, enabled, is_relay_public, points_multiplier, metadata)
             values (${cid}, ${a.alias}, ${a.displayName}, true, ${a.isRelayPublic}, 1.00,
               ${JSON.stringify({ [a.providerCode]: { upstreamModel: a.upstreamModel, by: 'scripts/relay-upstream-models-sync.mjs' } })}::jsonb)`
          written.push(`ai_model_config_models +1 config=${cid} model_id=${a.alias} upstream=${a.upstreamModel}`)
        } else {
          await tx`update ai_model_config_models
               set enabled=${a.enabled}, is_relay_public=${a.isRelayPublic}, updated_at=now()
             where id=${a.id} and config_id in (
               select id from ai_model_config where provider_code=${a.providerCode} and owner_uuid is null)`
          written.push(`ai_model_config_models ~1 id=${a.id} provider=${a.providerCode}`)
        }
      }
    }
  })
  return written
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
