// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池上游登记的**纯判据层**(零 IO、零 DB):登记表形状判定 + 「缺登记/已一致/漂移」三态与写动作集。
 *
 * 为什么单独一层:CLI 会被 IO 拖住(镜像测试就得连库才能跑);分层后判据只此一份(§0.6),库面读写在
 * `scripts/lib/relay-upstream-models-db.mjs`,测试钉的是判据本身。
 *
 * 四条不显然的口径:
 *  1. `isRelayPublic` 是登记器的写面之一,且恒按登记表(false):渠道路由
 *     `relay-channel-router#selectChannelCandidates` 的入口谓词要求 is_relay_public=true,登记成
 *     true 会把「只有账号池适配器能服务」的 provider 冒充成 OpenAI 兼容渠道去直连不存在的端点。
 *  2. **同键判据 = (provider_code, COALESCE(base_url,''))**:同 provider 不同 base_url 是两行
 *     (库里 `uq_ai_model_config_global_provider_base` 就是这个键),plan 层不靠库索引也表达同一关系。
 *     同键行只有当 description 带本器出处标记(`PROVENANCE_MARK`)才算"自己写的" —— 不带 ⇒
 *     **两条路径抢同一行**,既不复用也不改(进 `breaches`,不落任何动作),交人工裁决。
 *     只按 provider 判同键会造成"同 provider 另一端点行被判成 insert/update",那正是 23505 与
 *     "悄悄接管别人路径写的行"两个事故的共同入口。
 *  3. 既有行的 name / display_name / description 属其它生产者 ⇒ 只在缺失时写、绝不覆盖;漂移只比 enabled 与 api_format(这两项决定反查能不能命中)。
 *  4. model_id 有两把唯一索引(逐字节与 lower(model_id)):先按逐字节找、再按大小写变体找 —— 只有
 *     大小写变体那种"看着是同一条、插进去必撞索引"必须当场拒绝并点名,不得自动改名。
 */

import { requireFlagValue } from './flag-value.mjs'

/** 本器出处标记:写侧落进 description、读侧据此认领,两处必须同一枚常量(§0.6)。 */
export const PROVENANCE_MARK = '号池上游登记 · 由 scripts/relay-upstream-models-sync.mjs'

/** 本器写的配置行 description:出处标记 + 登记表里的定向说明。 */
export function provenanceDescription(reason) {
  return `${PROVENANCE_MARK} 依 scripts/data/relay-upstream-models.jsonl 落库(${reason})`
}

/** 该配置行是不是本器写的。取不到 description ⇒ false(不认领 = 不动别人行,失效方向恒为"多要一次人工裁决")。 */
export function isOurs(cfg) {
  return String(cfg?.description ?? '').includes(PROVENANCE_MARK)
}

/** 展示用 DSN 面:只留 host:port/db —— 用户名与密码段整段丢弃(比逐位打 *** 更严,§5d)。 */
export function dsnFace(raw) {
  const m = /^postgres(?:ql)?:\/\/[^@]*@([^/:?]+)(?::(\d+))?\/([\w.-]+)/.exec(
    String(raw || '').trim(),
  )
  if (!m) return null
  return `${m[1]}:${m[2] ?? '5432'}/${m[3]}`
}

/** 从单源文件解析 RELAY_PROVIDERS(号池支持的 provider 白名单);取不到 ⇒ null ⇒ 调用方落未判定。 */
export function relayProviderCodes(fileText) {
  const m = /export const RELAY_PROVIDERS\s*=\s*\[([^\]]*)\]/.exec(String(fileText || ''))
  if (!m) return null
  const codes = [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1])
  return codes.length > 0 ? codes : null
}

/**
 * 登记表判定(纯函数)⇒ `{ entries, problems }`。
 * problems 非空 ⇒ 整轮未判定:半张登记表落库比不落更糟(它会让人以为号池已经登记好了)。
 */
export function parseRegistry(text, providerCodes, today = new Date().toISOString().slice(0, 10)) {
  const entries = []
  const problems = []
  if (!Array.isArray(providerCodes) || providerCodes.length === 0)
    return { entries, problems: ['provider 白名单未取到(RELAY_PROVIDERS 单源解析失败)'] }
  const aliasSeen = new Set()
  String(text || '')
    .split('\n')
    .forEach((line, i) => {
      if (!line.trim()) return
      const at = `第 ${i + 1} 行`
      let o
      try {
        o = JSON.parse(line)
      } catch (e) {
        problems.push(`${at}: 不是合法 JSON(${e.message})`)
        return
      }
      const str = (v) => typeof v === 'string' && v !== ''
      const pk = String(o?.providerCode ?? '')
      const bad = []
      if (!str(o.providerCode)) bad.push('providerCode')
      else if (!providerCodes.includes(pk))
        bad.push(`providerCode=${pk} 不在号池白名单(${providerCodes.join('/')})`)
      if (!str(o.configName)) bad.push('configName')
      if (!str(o.baseUrl)) bad.push('baseUrl')
      if (!str(o.apiFormat)) bad.push('apiFormat')
      if (typeof o.enabled !== 'boolean') bad.push('enabled(必须布尔)')
      if (typeof o.isRelayPublic !== 'boolean') bad.push('isRelayPublic(必须布尔)')
      if (!Array.isArray(o.models) || o.models.length === 0) bad.push('models(必须非空数组)')
      else
        o.models.forEach((m, j) => {
          if (!str(m?.alias) || !str(m?.upstreamModel))
            return void bad.push(`models[${j}] 缺 alias/upstreamModel`)
          const key = `${pk}\u0000${m.alias}`
          if (aliasSeen.has(key)) bad.push(`models[${j}] alias=${m.alias} 在同 provider 内重复`)
          aliasSeen.add(key)
        })
      if (!str(o.reason) || o.reason.trim().length < 10) bad.push('reason(必须 ≥10 字定向说明)')
      // 形态 + 历法双重校验:`2099-13-01` 过得了正则但根本不是一天,只查正则等于让坏日期照登
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(String(o.reviewBy ?? '')) ||
        Number.isNaN(Date.parse(String(o.reviewBy)))
      )
        bad.push('reviewBy(必须 YYYY-MM-DD 且是真实一天)')
      else if (String(o.reviewBy) < today)
        bad.push(`reviewBy=${o.reviewBy} 已到期(须重审后顺延,不得照登)`)
      if (bad.length) problems.push(`${at}[${str(o.providerCode) ? pk : '?'}]: ${bad.join(' · ')}`)
      else entries.push(o)
    })
  if (!entries.length && !problems.length)
    problems.push('登记表为空(枚举到 0 个登记意图判死,不记绿)')
  return { entries, problems }
}

/**
 * 登记计划(纯判据):登记表 + 库快照 ⇒ 三态读数 + 写动作集。
 * 快照形状 `{ configs:[{id,providerCode,baseUrl,apiFormat,enabled,description}],
 *              models:[{id,configId,modelId,enabled,isRelayPublic}] }`。
 * `breaches` = 判得出的"不许动"(同键行是别的路径写的):这类条目不产任何动作,整轮拒绝落库。
 */
export function planRegistration(entries, snapshot) {
  const actions = []
  const rows = []
  const problems = []
  const breaches = []
  const push = (providerCode, alias, state, why) => rows.push({ providerCode, alias, state, why })
  for (const e of entries) {
    const cfgs = (snapshot.configs ?? []).filter(
      (c) =>
        c.providerCode === e.providerCode && String(c.baseUrl ?? '') === String(e.baseUrl ?? ''),
    )
    if (cfgs.length > 1) {
      problems.push(
        `provider=${e.providerCode} 同 (provider_code, base_url) 有 ${cfgs.length} 行全局配置(无法判定该写哪一行)`,
      )
      continue
    }
    const cfg = cfgs[0] ?? null
    if (cfg && !isOurs(cfg)) {
      // 同键行已存在但不带本器出处 ⇒ 别的路径先占了这一行。复用或改它 = 悄悄接管别人的行,
      // 唯一合法结局是点名交人工(既不复用也不改)。
      breaches.push(
        `provider=${e.providerCode} base_url=${e.baseUrl} 两条路径抢同一行:id=${cfg.id} 已占该键但 description 不带本器出处标记(${PROVENANCE_MARK})⇒ 既不复用也不改`,
      )
      continue
    }
    const configId = cfg ? Number(cfg.id) : null
    let state = 'matched'
    if (!cfg) {
      state = 'missing'
      actions.push({
        kind: 'insertConfig',
        providerCode: e.providerCode,
        name: e.configName,
        baseUrl: e.baseUrl,
        apiFormat: e.apiFormat,
        enabled: e.enabled,
        reason: e.reason,
      })
      push(
        e.providerCode,
        null,
        'missing',
        `缺全局配置行 (provider_code=${e.providerCode}, base_url=${e.baseUrl}, owner_uuid IS NULL)`,
      )
    } else {
      const diff = []
      if (cfg.enabled !== e.enabled) diff.push(`enabled 库=${cfg.enabled} 表=${e.enabled}`)
      if (String(cfg.apiFormat) !== String(e.apiFormat))
        diff.push(`api_format 库=${cfg.apiFormat} 表=${e.apiFormat}`)
      if (diff.length) {
        state = 'drift'
        actions.push({
          kind: 'updateConfig',
          providerCode: e.providerCode,
          id: configId,
          enabled: e.enabled,
          apiFormat: e.apiFormat,
        })
        push(e.providerCode, null, 'drift', `配置行 id=${configId}: ${diff.join(' · ')}`)
      } else push(e.providerCode, null, 'matched', `配置行 id=${configId} 已一致`)
    }
    for (const m of e.models) {
      const mine = (snapshot.models ?? []).filter((x) => Number(x.configId) === configId)
      const exact = mine.find((x) => String(x.modelId) === String(m.alias))
      const ciVar =
        !exact &&
        mine.find((x) => String(x.modelId).toLowerCase() === String(m.alias).toLowerCase())
      if (ciVar) {
        problems.push(
          `provider=${e.providerCode} alias=${m.alias} 与既有 model_id=${ciVar.modelId} 仅大小写不同(撞 ai_model_config_models_cid_model_lower_uniq),须人工定名`,
        )
        continue
      }
      if (!exact) {
        if (state === 'matched') state = 'missing'
        actions.push({
          kind: 'insertModel',
          providerCode: e.providerCode,
          configId,
          alias: m.alias,
          upstreamModel: m.upstreamModel,
          displayName: m.displayName ?? null,
          isRelayPublic: e.isRelayPublic,
        })
        push(
          e.providerCode,
          m.alias,
          'missing',
          cfg ? `model 行缺(config_id=${configId})` : 'model 行缺(随新配置行一起建)',
        )
        continue
      }
      const diff = []
      if (exact.enabled !== true) diff.push(`enabled 库=${exact.enabled} 应为 true`)
      if (exact.isRelayPublic !== e.isRelayPublic)
        diff.push(`is_relay_public 库=${exact.isRelayPublic} 表=${e.isRelayPublic}`)
      if (diff.length) {
        if (state !== 'missing') state = 'drift'
        actions.push({
          kind: 'updateModel',
          providerCode: e.providerCode,
          id: Number(exact.id),
          enabled: true,
          isRelayPublic: e.isRelayPublic,
        })
        push(e.providerCode, m.alias, 'drift', diff.join(' · '))
      } else push(e.providerCode, m.alias, 'matched', '已一致')
    }
  }
  const count = { missing: 0, matched: 0, drift: 0 }
  for (const r of rows) count[r.state]++
  return { rows, actions, problems, breaches, count }
}

/** 把动作集渲染成一行预览(CLI 写前打印与测试断言共用同一出口,不各写一份)。 */
export function describeAction(a) {
  if (a.kind === 'insertConfig')
    return `INSERT ai_model_config provider=${a.providerCode} name=${a.name} base_url=${a.baseUrl} api_format=${a.apiFormat} enabled=${a.enabled}`
  if (a.kind === 'updateConfig')
    return `UPDATE ai_model_config id=${a.id} enabled=${a.enabled} api_format=${a.apiFormat}`
  if (a.kind === 'insertModel')
    return `INSERT ai_model_config_models config=${a.configId ?? '(随新配置行)'} model_id=${a.alias} display_name=${a.displayName} is_relay_public=${a.isRelayPublic}`
  return `UPDATE ai_model_config_models id=${a.id} enabled=${a.enabled} is_relay_public=${a.isRelayPublic}`
}

/** DSN 取法:--dsn > .env 的 DATABASE_URL > DATABASE_APP_URL > 同名环境变量(顺序即优先级)。 */
export function resolveDsn(argv, envFileText, env) {
  const f = requireFlagValue(argv, '--dsn', { noun: ' Postgres 连接串' })
  if (f.error) return { error: f.error }
  if (f.present) return { dsn: f.value }
  for (const key of ['DATABASE_URL', 'DATABASE_APP_URL']) {
    const m = new RegExp(`^${key}=(.+)$`, 'm').exec(envFileText || '')
    if (m?.[1]?.trim()) return { dsn: m[1].trim() }
  }
  for (const key of ['DATABASE_URL', 'DATABASE_APP_URL']) if (env?.[key]) return { dsn: env[key] }
  return {
    error: 'DSN 取不到(--dsn / apps/api/.env 的 DATABASE_URL|DATABASE_APP_URL / 环境变量均为空)',
  }
}

/** 动作是否只落在登记 provider 上(正向对照用:非登记 provider 一条都不许被碰)。 */
export function touchesOnlyRegistered(actions, registeredCodes) {
  const set = new Set(registeredCodes)
  return actions.every((a) => (a.providerCode ? set.has(a.providerCode) : true))
}

export const __test__ = {
  PROVENANCE_MARK,
  isOurs,
  provenanceDescription,
  dsnFace,
  relayProviderCodes,
  parseRegistry,
  planRegistration,
  describeAction,
  resolveDsn,
  touchesOnlyRegistered,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
