// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * canary-traffic — 金丝雀「灰度分流」的选择逻辑与放量档位判定(O65 第 2 期 · 2026-10-27 立)。
 *
 * 补的是 canary-verdict 之外的另一半:
 *   canary-verdict 答「这枚新版本有没有回归」(错误率/延迟),
 *   本模块答       「新版本先吃多少流量、这一步该不该往下走」。
 * 两者在 ihui-deploy-loop.ps1 的观察窗里串成一条链:
 *   档位推进(本模块) → 采样比对(canary-verdict) → 升档 / 撤灰度 / 回滚。
 *
 * 判据纪律(与 canary-verdict 同源,不得放宽):
 *  - **比例只有一处**:档位表、桶粒度、槽位端口全部在 scripts/data/canary-policy.json 的
 *    traffic 段;本文件不内置第二份数值(单一真相源,AGENTS §0.6)。
 *  - **端点/阈值只有一份**:策略的其余部分由 canary-verdict.mjs 的 loadPolicy 解析
 *    (本文件直接 import 它,不另写一个策略加载器 —— 两个加载器必然漂)。
 *  - **桶口径对齐 apps/ai-service/app/services/compaction_canary.py**:sha256 前 8 字节大端
 *    取模万分位,同一 key 跨进程/跨次调用恒定 ⇒ 同一会话不会在两次判定里来回跳。
 *    (那一处是压缩策略放量、本处是部署环放量,两处**算法**同源,免得仓内出现两种灰度哈希。)
 *  - **fail-closed**:比例非法 ⇒ 0(不放量);形状坏 ⇒ 抛错 ⇒ 调用方按「未判定」处理,
 *    既不冒绿也不据此回滚(§0.3 三态退出码)。
 *  - **unknown 不推进**:观察窗判不出好坏时档位原地不动 —— 不放量也不回滚。
 *
 * 术语:
 *  - lane(车道):一个请求落到 stable(现网)还是 canary(灰度候选)。依据是
 *    「稳定哈希桶 < 比例 × 粒度」,同一 key 的归属稳定,不随请求数抖动。
 *  - stage(档位):放量阶梯的一级(off → ramp-1 → ramp-2 → … → ramp-full)。
 *  - slot(槽位):stable / canary 两个实例所在的本机端口(写在 policy.traffic.slots)。
 *
 * 退出码:
 *   0 — 判定完成
 *   2 — 未判定(形状坏 / 参数非法)
 */

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadPolicy } from './canary-verdict.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const POLICY_PATH = join(ROOT, 'scripts', 'data', 'canary-policy.json')

export const EXIT_OK = 0
export const EXIT_UNKNOWN = 2

export const OFF_STAGE = 'off'
export const VERDICTS = ['pass', 'fail', 'unknown']

export class TrafficShapeError extends Error {}

const asText = (v) => (typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v)).trim()
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const isPosInt = (v) => Number.isInteger(v) && v > 0

/**
 * 稳定分桶:sha256(salt:key) 前 8 字节大端整数取模粒度。
 * 与 apps/ai-service/app/services/compaction_canary.py 的 canary_bucket 同口径
 * (那里是 sha256(f"ihui-compaction-canary:{key}") 前 8 字节大端 % 10000)。
 * 同一 key ⇒ 同一桶,跨进程恒定。
 */
export function trafficBucket(key, { granularity = 10000, salt = 'ihui-deploy-canary' } = {}) {
  const digest = createHash('sha256').update(`${salt}:${asText(key)}`).digest()
  const head = digest.readBigUInt64BE(0)
  return Number(head % BigInt(granularity))
}

/**
 * 比例解析(fail-closed):非法 ⇒ 0(不放量);越界 ⇒ clamp 到 [0,100];未设置 ⇒ 0。
 * 口径对齐 compaction_canary.parse_canary_percent 的「非法→0、越界 clamp」,但那里
 * 未设置 ⇒ 100、这里未设置 ⇒ 0 —— 部署环灰度的缺省必须是「不放量」。
 */
export function parseTrafficPercent(raw) {
  const text = asText(raw)
  if (!text) return 0
  const value = Number(text)
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

/** 该 key 是否命中灰度:桶 < 比例 × 粒度。percent<=0 ⇒ 恒 false;percent>=100 ⇒ 恒 true。 */
export function isTrafficSelected(key, percent, opts = {}) {
  const p = Number(percent)
  if (!Number.isFinite(p) || p <= 0) return false
  if (p >= 100) return true
  const granularity = opts.granularity ?? 10000
  return trafficBucket(key, { granularity, salt: opts.salt }) < p * (granularity / 100)
}

/**
 * 车道选择:强制头优先(运维/探针用),否则按稳定哈希桶。
 * tag 语义与 apps/api/src/plugins/canary-router.ts 一致:canary ⇒ 强制灰度,
 * stable ⇒ 强制现网 —— 同一仓里两种灰度对「强制」的叫法一致,免得运维记两套。
 */
export function selectTrafficLane(key, { percent = 0, tag = '', ...opts } = {}) {
  const forced = asText(tag).toLowerCase()
  if (forced === 'canary') return { lane: 'canary', forced: true, bucket: null, percent: Number(percent) }
  if (forced === 'stable') return { lane: 'stable', forced: true, bucket: null, percent: Number(percent) }
  const granularity = opts.granularity ?? 10000
  const bucket = trafficBucket(key, { granularity, salt: opts.salt })
  const lane = bucket < Number(percent) * (granularity / 100) ? 'canary' : 'stable'
  return { lane, forced: false, bucket, percent: Number(percent) }
}

/**
 * 加载并锁形状:复用 canary-verdict.mjs 的 loadPolicy 解析端点/阈值(策略只有一份解析),
 * 再叠加 traffic 段的形状锁。形状坏 ⇒ 抛 TrafficShapeError(调用方按「未判定」处理)。
 */
export function loadTrafficPolicy(rawText) {
  const base = loadPolicy(rawText)
  const t = base.traffic
  if (!isPlainObject(t)) throw new TrafficShapeError('策略形状坏:缺 traffic 对象')

  if (!isPosInt(t.bucketGranularity)) {
    throw new TrafficShapeError('策略形状坏:traffic.bucketGranularity 必须是正整数')
  }
  if (!asText(t.bucketSalt)) throw new TrafficShapeError('策略形状坏:traffic.bucketSalt 不能为空')
  if (!asText(t.routingKeyHeader)) throw new TrafficShapeError('策略形状坏:traffic.routingKeyHeader 不能为空')
  if (!asText(t.tagHeader)) throw new TrafficShapeError('策略形状坏:traffic.tagHeader 不能为空')

  const stages = t.stages
  if (!Array.isArray(stages) || stages.length === 0) {
    throw new TrafficShapeError('策略形状坏:traffic.stages 必须是非空数组')
  }
  const seen = new Set()
  let prevPercent = -1
  const outStages = []
  for (let i = 0; i < stages.length; i += 1) {
    const s = stages[i]
    if (!isPlainObject(s)) throw new TrafficShapeError(`档位[${i}] 不是对象`)
    const id = asText(s.id)
    if (!id) throw new TrafficShapeError(`档位[${i}] 缺 id`)
    if (seen.has(id)) throw new TrafficShapeError(`档位 id 重复:${id}`)
    seen.add(id)
    const percent = Number(s.percent)
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      throw new TrafficShapeError(`档位 ${id} 的 percent 必须是 0..100 的数`)
    }
    if (percent <= prevPercent) {
      throw new TrafficShapeError(`档位 ${id} 的 percent 必须严格递增(放大量只能往上走)`)
    }
    prevPercent = percent
    outStages.push({ id, percent })
  }
  if (outStages[outStages.length - 1].percent !== 100) {
    throw new TrafficShapeError('策略形状坏:traffic.stages 末档 percent 必须是 100(否则没有「全量」这一档)')
  }

  const slots = t.slots
  if (!isPlainObject(slots)) throw new TrafficShapeError('策略形状坏:缺 traffic.slots 对象')
  for (const name of ['stable', 'canary']) {
    const s = slots[name]
    if (!isPlainObject(s) || !isPosInt(s.port)) {
      throw new TrafficShapeError(`策略形状坏:traffic.slots.${name}.port 必须是正整数`)
    }
  }
  if (slots.stable.port === slots.canary.port) {
    throw new TrafficShapeError('策略形状坏:stable 槽位与 canary 槽位不能同端口(分流就没有分流了)')
  }

  const grayEndpoints = t.grayEndpoints ?? []
  if (!Array.isArray(grayEndpoints)) throw new TrafficShapeError('策略形状坏:traffic.grayEndpoints 必须是数组')
  for (const id of grayEndpoints) {
    const eid = asText(id)
    if (!eid) throw new TrafficShapeError('策略形状坏:traffic.grayEndpoints 含空 id')
    if (!base.endpoints.some((e) => e.id === eid)) {
      throw new TrafficShapeError(`策略形状坏:traffic.grayEndpoints 的 ${eid} 在 endpoints 里不存在`)
    }
  }

  return {
    version: base.version,
    window: base.window,
    thresholds: base.thresholds,
    endpoints: base.endpoints,
    bucketGranularity: t.bucketGranularity,
    bucketSalt: asText(t.bucketSalt),
    routingKeyHeader: asText(t.routingKeyHeader),
    tagHeader: asText(t.tagHeader),
    stages: outStages,
    slots: {
      stable: { port: slots.stable.port },
      canary: { port: slots.canary.port },
    },
    grayEndpoints: grayEndpoints.map((x) => asText(x)),
  }
}

/** 某档位的百分比;off ⇒ 0;不在档位表里 ⇒ 抛形状错(不猜)。 */
export function stagePercent(stage, stages) {
  const id = asText(stage)
  if (!id || id === OFF_STAGE) return 0
  const hit = stages.find((s) => s.id === id)
  if (!hit) throw new TrafficShapeError(`档位 ${id} 不在 traffic.stages 里`)
  return hit.percent
}

/**
 * 档位推进判定(纯函数,也是回滚判定的唯一出口):
 *  - fail    ⇒ 归零(off):异常即刻撤下灰度流量。
 *  - unknown ⇒ 原地不动:没有证据既不放量也不回滚。
 *  - pass    ⇒ 下一档;已在末档 ⇒ 保持末档(全量后不再有「下一档」)。
 */
export function resolveStage(current, verdict, stages) {
  const cur = asText(current) || OFF_STAGE
  const v = asText(verdict)
  if (!VERDICTS.includes(v)) throw new TrafficShapeError(`verdict 非法:${v}`)
  const idx = stages.findIndex((s) => s.id === cur)
  if (cur !== OFF_STAGE && idx < 0) throw new TrafficShapeError(`当前档位 ${cur} 不在 traffic.stages 里`)
  if (v === 'fail') {
    return { stage: OFF_STAGE, percent: 0, changed: cur !== OFF_STAGE, reason: `判定异常 ⇒ 灰度流量归零(原档位 ${cur})` }
  }
  if (v === 'unknown') {
    return { stage: cur, percent: stagePercent(cur, stages), changed: false, reason: '未判定 ⇒ 档位原地不动(不放量也不回滚)' }
  }
  const nextIdx = cur === OFF_STAGE ? 0 : idx + 1
  if (nextIdx >= stages.length) {
    return { stage: cur, percent: stagePercent(cur, stages), changed: false, reason: `已在末档(${cur})⇒ 保持不变` }
  }
  const next = stages[nextIdx]
  return { stage: next.id, percent: next.percent, changed: next.id !== cur, reason: `判定通过 ⇒ 档位 ${cur} → ${next.id}(${next.percent}%)` }
}

/**
 * 派生「灰期策略」:把灰度档位对应的源站端点改指到 canary 槽位。
 * 不改原策略文件,只产出内存副本 —— 观察窗用它采样,采样目标才是真正承载灰度流量的那一实例。
 * 不在 grayEndpoints 列表里的端点(如 api/llm 源站)保持原样:灰度只切 web 产物。
 */
export function deriveGrayPolicy(policy, stage) {
  const id = asText(stage)
  if (!id || id === OFF_STAGE) return { policy, changed: false, moved: [] }
  const moved = []
  const endpoints = policy.endpoints.map((ep) => {
    if (!policy.grayEndpoints.includes(ep.id) || ep.kind !== 'origin') return ep
    const u = new URL(ep.url)
    u.port = String(policy.slots.canary.port)
    moved.push({ id: ep.id, from: ep.url, to: u.toString() })
    return { ...ep, url: u.toString() }
  })
  return { policy: { ...policy, endpoints }, changed: moved.length > 0, moved }
}

/**
 * 生成灰度契约(机读):分流执行体按这份契约把流量按比例导到 canary 槽位。
 * 契约里写清比例、槽位端口、路由键头、强制头、桶口径 —— 执行体不需要猜任何一样。
 */
export function buildRampContract({ policy, stage, sha = '', now } = {}) {
  const percent = stagePercent(stage, policy.stages)
  return {
    v: 1,
    stage: asText(stage) || OFF_STAGE,
    percent,
    deploySha: asText(sha),
    routingKeyHeader: policy.routingKeyHeader,
    tagHeader: policy.tagHeader,
    bucketGranularity: policy.bucketGranularity,
    bucketSalt: policy.bucketSalt,
    slots: policy.slots,
    updatedAt: (now ? new Date(now) : new Date()).toISOString(),
  }
}

function parseArgs(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (!a.startsWith('--')) {
      out._.push(a)
      continue
    }
    const key = a.slice(2)
    const eq = key.indexOf('=')
    if (eq >= 0) {
      out[key.slice(0, eq)] = key.slice(eq + 1)
      continue
    }
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) {
      out[key] = true
      continue
    }
    out[key] = next
    i += 1
  }
  return out
}

function selfTest() {
  const checks = []
  const t = (name, fn) => {
    try {
      fn()
      checks.push({ name, ok: true })
    } catch (e) {
      checks.push({ name, ok: false, why: e?.message ?? String(e) })
    }
  }
  const stages = [
    { id: 'ramp-1', percent: 1 },
    { id: 'ramp-2', percent: 5 },
    { id: 'ramp-full', percent: 100 },
  ]
  const endpoints = [
    { id: 'web-origin', kind: 'origin', url: 'http://127.0.0.1:8801/' },
    { id: 'api-origin', kind: 'origin', url: 'http://127.0.0.1:8802/api/health' },
  ]
  const policy = {
    version: 1,
    window: { ticks: 1, gapMs: 1, timeoutMs: 1 },
    thresholds: {
      minSamples: 2, maxErrorRate: 0.2, maxErrorRateDelta: 0.1, maxP95Ms: 500,
      maxP95Ratio: 2, maxP95DeltaMs: 100, minBaselineP95Ms: 10, maxUnknownRatio: 0.5,
    },
    endpoints,
    traffic: {
      bucketGranularity: 10000,
      bucketSalt: 'ihui-deploy-canary',
      routingKeyHeader: 'x-ihui-canary-key',
      tagHeader: 'x-canary-tag',
      stages,
      slots: { stable: { port: 8801 }, canary: { port: 8845 } },
      grayEndpoints: ['web-origin'],
    },
  }

  t('同 key 恒同桶', () => {
    const a = trafficBucket('user-42')
    const b = trafficBucket('user-42')
    if (a !== b) throw new Error(`实得 ${a} vs ${b}`)
    if (a < 0 || a >= 10000) throw new Error(`越界:${a}`)
  })
  t('不同 key 落不同桶', () => {
    if (trafficBucket('user-42') === trafficBucket('user-43')) throw new Error('两 key 同桶')
  })
  t('比例非法 ⇒ 0(fail-closed)', () => {
    if (parseTrafficPercent('abc') !== 0) throw new Error('非法值未归零')
    if (parseTrafficPercent('') !== 0) throw new Error('空值未归零')
    if (parseTrafficPercent('250') !== 100) throw new Error('越界未 clamp')
    if (parseTrafficPercent('-5') !== 0) throw new Error('负值未 clamp')
  })
  t('0% ⇒ 恒不命中;100% ⇒ 恒命中', () => {
    if (isTrafficSelected('k', 0)) throw new Error('0% 竟命中')
    if (!isTrafficSelected('k', 100)) throw new Error('100% 未命中')
  })
  t('1% 命中量级合理(2000 key 落在 0.5%~1.5%)', () => {
    let hit = 0
    for (let i = 0; i < 2000; i += 1) if (isTrafficSelected(`k${i}`, 1)) hit += 1
    if (hit < 10 || hit > 30) throw new Error(`命中 ${hit}/2000`)
  })
  t('强制头覆盖哈希判定', () => {
    const c = selectTrafficLane('k', { percent: 0, tag: 'canary' })
    const s = selectTrafficLane('k', { percent: 100, tag: 'stable' })
    if (c.lane !== 'canary' || !c.forced) throw new Error('强制灰度失效')
    if (s.lane !== 'stable' || !s.forced) throw new Error('强制现网失效')
  })
  t('档位推进:pass 进下一档', () => {
    const r = resolveStage('ramp-1', 'pass', stages)
    if (r.stage !== 'ramp-2' || r.percent !== 5) throw new Error(`实得 ${r.stage}/${r.percent}`)
  })
  t('档位推进:fail ⇒ 归零', () => {
    const r = resolveStage('ramp-2', 'fail', stages)
    if (r.stage !== 'off' || r.percent !== 0 || !r.changed) throw new Error(`实得 ${r.stage}/${r.percent}`)
  })
  t('档位推进:unknown ⇒ 原地不动', () => {
    const r = resolveStage('ramp-2', 'unknown', stages)
    if (r.stage !== 'ramp-2' || r.percent !== 5 || r.changed) throw new Error(`实得 ${r.stage}/${r.percent}`)
  })
  t('档位推进:末档 pass ⇒ 保持末档', () => {
    const r = resolveStage('ramp-full', 'pass', stages)
    if (r.stage !== 'ramp-full' || r.changed) throw new Error(`实得 ${r.stage}`)
  })
  t('灰期策略:只有 grayEndpoints 里的源站端点改指 canary 槽位', () => {
    const loaded = loadTrafficPolicy(JSON.stringify(policy))
    const { policy: derived, moved } = deriveGrayPolicy(loaded, 'ramp-1')
    if (derived.endpoints[0].url !== 'http://127.0.0.1:8845/') throw new Error(`web 端点未改指:${derived.endpoints[0].url}`)
    if (derived.endpoints[1].url !== 'http://127.0.0.1:8802/api/health') throw new Error('api 端点被误改')
    if (moved.length !== 1) throw new Error(`moved=${moved.length}`)
    if (deriveGrayPolicy(loaded, 'off').changed) throw new Error('off 档不该改指')
  })
  t('形状锁:档位不递增 / 缺末档 / 同端口 / 缺桶粒度 / 灰度端点不存在 全拒', () => {
    const bad = [
      { ...policy, traffic: { ...policy.traffic, stages: [{ id: 'a', percent: 5 }, { id: 'b', percent: 1 }, { id: 'c', percent: 100 }] } },
      { ...policy, traffic: { ...policy.traffic, stages: [{ id: 'a', percent: 5 }] } },
      { ...policy, traffic: { ...policy.traffic, slots: { stable: { port: 8801 }, canary: { port: 8801 } } } },
      { ...policy, traffic: { ...policy.traffic, bucketGranularity: 0 } },
      { ...policy, traffic: { ...policy.traffic, grayEndpoints: ['nope'] } },
    ]
    for (const b of bad) {
      let hit = false
      try {
        loadTrafficPolicy(JSON.stringify(b))
      } catch (e) {
        hit = e instanceof TrafficShapeError
      }
      if (!hit) throw new Error('形状坏未被拒')
    }
  })
  t('契约写清比例/槽位/路由键', () => {
    const loaded = loadTrafficPolicy(JSON.stringify(policy))
    const c = buildRampContract({ policy: loaded, stage: 'ramp-2', sha: 'abc1234', now: '2026-10-27T00:00:00Z' })
    if (c.percent !== 5 || c.slots.canary.port !== 8845) throw new Error(`实得 ${JSON.stringify(c)}`)
    if (c.routingKeyHeader !== 'x-ihui-canary-key' || c.bucketGranularity !== 10000) throw new Error('契约缺字段')
  })

  const failed = checks.filter((c) => !c.ok)
  for (const c of checks) console.log(`${c.ok ? 'ok  ' : 'FAIL'}  ${c.name}${c.ok ? '' : ` — ${c.why}`}`)
  console.log(`\n通过 ${checks.length - failed.length} / 失败 ${failed.length}`)
  if (failed.length) process.exitCode = 1
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args['self-test']) return selfTest()

  const policyPath = args.policy || POLICY_PATH
  let policy
  try {
    policy = loadTrafficPolicy(readFileSync(policyPath, 'utf8'))
  } catch (e) {
    console.error(`灰度策略未判定(${policyPath}):${e?.message ?? e}`)
    process.exit(EXIT_UNKNOWN)
  }

  if (args.resolve) {
    const key = asText(args.key)
    if (!key) {
      console.error('--resolve 必须给 --key <路由键>')
      process.exit(EXIT_UNKNOWN)
    }
    const percent = args.percent === undefined ? 0 : parseTrafficPercent(args.percent)
    const r = selectTrafficLane(key, {
      percent,
      tag: args.tag ?? '',
      granularity: policy.bucketGranularity,
      salt: policy.bucketSalt,
    })
    console.log(JSON.stringify(r))
    return
  }

  if (args.advance) {
    const verdict = asText(args.verdict)
    if (!VERDICTS.includes(verdict)) {
      console.error(`--advance 必须给 --verdict pass|fail|unknown(实得:${verdict})`)
      process.exit(EXIT_UNKNOWN)
    }
    const current = asText(args.current) || OFF_STAGE
    let next
    try {
      next = resolveStage(current, verdict, policy.stages)
    } catch (e) {
      console.error(`档位推进未判定:${e?.message ?? e}`)
      process.exit(EXIT_UNKNOWN)
    }
    const contract = buildRampContract({ policy, stage: next.stage, sha: args.sha ?? '' })
    if (args['contract-out']) {
      const out = resolve(asText(args['contract-out']))
      mkdirSync(dirname(out), { recursive: true })
      writeFileSync(out, `${JSON.stringify(contract, null, 2)}\n`, 'utf8')
    }
    console.log(JSON.stringify({ ...next, contract }))
    return
  }

  if (args['gray-policy']) {
    const stage = asText(args.stage) || OFF_STAGE
    let derived
    try {
      derived = deriveGrayPolicy(policy, stage)
    } catch (e) {
      console.error(`灰期策略未判定:${e?.message ?? e}`)
      process.exit(EXIT_UNKNOWN)
    }
    const text = `${JSON.stringify(derived.policy, null, 2)}\n`
    if (args.out) {
      const out = resolve(asText(args.out))
      mkdirSync(dirname(out), { recursive: true })
      writeFileSync(out, text, 'utf8')
    }
    console.log(text.trim())
    return
  }

  console.error('用法:--resolve --key <k> [--percent N] [--tag canary|stable] | --advance --verdict <v> [--current <stage>] [--contract-out <file>] | --gray-policy --stage <s> [--out <file>] | --self-test')
  process.exit(EXIT_UNKNOWN)
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
