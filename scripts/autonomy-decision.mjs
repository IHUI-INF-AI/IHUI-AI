// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * autonomy-decision — 自治决策模型(收益 / 风险 / 成本 / 紧急度 加权排序)(O65 P2,2026-10-25 立)。
 *
 * 只做一件事:给定候选票 JSON 与策略文件,输出**可审计**的排期顺序 ——
 * 每一枚票的每个因子都给出「原始值 → 归一分 → 因子权重 → 加权贡献」,总分 = 各维度贡献之和,
 * 并逐条写明"为什么它是首位 / 为什么排在某枚之后 / 为什么被压后"。
 *
 * 纪律(违反任何一条 = 排期结论不可复核):
 *  - 权重与阈值**只**来自 scripts/data/autonomy-policy.json(§22c 单一真相源);本文件不内置第二份数值。
 *  - 判据全是纯函数并 export,测试 import 源脚本 `__test__`,不复制任何判据(§22c)。
 *  - 候选为空 / 策略或输入读不到 / 形状坏 ⇒ exit 2 显式「未判定」,不猜绿(§0.3)。
 *  - 有可排期票 ⇒ 0;候选全被压后(风险阻断 / 低于最低分)⇒ 3「本轮不排期」。
 *  - 排序确定性:总分 → 紧急度 → 风险(低者先)→ id 字典序,任何人重跑得到同一顺序。
 *
 * 用法:
 *   node scripts/autonomy-decision.mjs --input <候选 JSON>          # 人读排序报告
 *   node scripts/autonomy-decision.mjs --input <候选 JSON> --json   # 机器可读(逐项贡献明细)
 *   node scripts/autonomy-decision.mjs --self-test                  # 内置断言
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const POLICY_PATH = join(ROOT, 'scripts', 'data', 'autonomy-policy.json')

export const EXIT_DECIDED = 0
export const EXIT_UNKNOWN = 2
export const EXIT_DEFERRED = 3

/** 四维与各维因子 —— 策略文件必须逐键对上(多一个少一个都判形状坏)。 */
export const DIMENSIONS = ['benefit', 'risk', 'cost', 'urgency']
export const FACTOR_KEYS = {
  benefit: ['impact', 'userValue'],
  risk: ['irreversible', 'externalDependency', 'ruleTouch'],
  cost: ['changeSurface', 'verifyMinutes'],
  urgency: ['leaseHours', 'blockingOthers'],
}

/** risk / cost 是"分越高越差"的维度,计分时取余量(1 - 归一分)。 */
const NEGATIVE_DIMENSIONS = new Set(['risk', 'cost'])

const DIMENSION_LABELS = { benefit: '收益', risk: '风险', cost: '成本', urgency: '紧急度' }
const FACTOR_LABELS = {
  impact: '影响面',
  userValue: '用户价值',
  irreversible: '不可逆',
  externalDependency: '外部依赖',
  ruleTouch: '触碰铁律',
  changeSurface: '改动面',
  verifyMinutes: '验证时长',
  leaseHours: '租约',
  blockingOthers: '阻塞他人',
}

const r6 = (n) => Math.round(n * 1e6) / 1e6
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

/** 键集必须逐字相等(排序后比对,不受书写顺序影响)。 */
function assertKeySet(obj, keys, where) {
  const have = Object.keys(obj).sort()
  const want = [...keys].sort()
  const same = have.length === want.length && have.every((k, i) => k === want[i])
  if (!same) {
    throw new Error(
      `策略形状坏:${where} 的键必须恰为 ${keys.join('/')}(现为 ${have.join('/') || '空'})`,
    )
  }
}

/**
 * 策略加载 + 形状锁。任何一处不合规都抛错 ⇒ main 落 exit 2「未判定」,
 * 绝不回落成内置默认权重(§0.3:没判绝不写成判过)。
 */
export function loadPolicy(rawText) {
  let doc
  try {
    doc = JSON.parse(rawText)
  } catch (e) {
    throw new Error(`自治决策策略不是合法 JSON:${e?.message ?? e}`)
  }
  if (!isPlainObject(doc)) throw new Error('自治决策策略必须是 JSON 对象')
  if (!Number.isInteger(doc.version) || doc.version <= 0) {
    throw new Error('策略形状坏:version 必须是正整数')
  }

  const dims = doc.dimensions
  if (!isPlainObject(dims)) throw new Error('策略形状坏:缺 dimensions 对象')
  const weights = dims.weights
  if (!isPlainObject(weights)) throw new Error('策略形状坏:缺 dimensions.weights 对象')
  assertKeySet(weights, DIMENSIONS, 'dimensions.weights')
  let weightSum = 0
  for (const dim of DIMENSIONS) {
    if (!Number.isFinite(weights[dim]) || weights[dim] <= 0) {
      throw new Error(`策略形状坏:dimensions.weights.${dim} 必须是正数`)
    }
    weightSum += weights[dim]
  }
  if (Math.abs(weightSum - 1) > 1e-9) {
    throw new Error(`策略形状坏:维度权重之和必须是 1(现为 ${weightSum})`)
  }

  const factors = dims.factors
  if (!isPlainObject(factors)) throw new Error('策略形状坏:缺 dimensions.factors 对象')
  assertKeySet(factors, DIMENSIONS, 'dimensions.factors')
  for (const dim of DIMENSIONS) {
    const f = factors[dim]
    if (!isPlainObject(f)) throw new Error(`策略形状坏:dimensions.factors.${dim} 不是对象`)
    assertKeySet(f, FACTOR_KEYS[dim], `dimensions.factors.${dim}`)
    let sum = 0
    for (const key of FACTOR_KEYS[dim]) {
      if (!Number.isFinite(f[key]) || f[key] <= 0) {
        throw new Error(`策略形状坏:dimensions.factors.${dim}.${key} 必须是正数`)
      }
      sum += f[key]
    }
    if (Math.abs(sum - 1) > 1e-9) {
      throw new Error(`策略形状坏:${dim} 的因子权重之和必须是 1(现为 ${sum})`)
    }
  }

  const scales = doc.scales
  if (!isPlainObject(scales)) throw new Error('策略形状坏:缺 scales 对象')
  assertKeySet(scales, ['levelMax', 'verifyMinutesRef', 'leaseHoursRef'], 'scales')
  if (!Number.isInteger(scales.levelMax) || scales.levelMax < 1) {
    throw new Error('策略形状坏:scales.levelMax 必须是正整数')
  }
  if (!Number.isFinite(scales.verifyMinutesRef) || scales.verifyMinutesRef <= 0) {
    throw new Error('策略形状坏:scales.verifyMinutesRef 必须是正数')
  }
  if (!Number.isFinite(scales.leaseHoursRef) || scales.leaseHoursRef <= 0) {
    throw new Error('策略形状坏:scales.leaseHoursRef 必须是正数')
  }

  const thresholds = doc.thresholds
  if (!isPlainObject(thresholds)) throw new Error('策略形状坏:缺 thresholds 对象')
  assertKeySet(thresholds, ['riskReview', 'riskBlock', 'minScore', 'hardBlock'], 'thresholds')
  for (const key of ['riskReview', 'riskBlock', 'minScore']) {
    const v = thresholds[key]
    if (!Number.isFinite(v) || v < 0 || v > 1) {
      throw new Error(`策略形状坏:thresholds.${key} 必须是 0..1 的数`)
    }
  }
  if (thresholds.riskReview > thresholds.riskBlock) {
    throw new Error('策略形状坏:riskReview 不得大于 riskBlock')
  }
  const hardBlock = thresholds.hardBlock
  if (!isPlainObject(hardBlock)) throw new Error('策略形状坏:thresholds.hardBlock 必须是对象')
  for (const key of Object.keys(hardBlock)) {
    if (!FACTOR_KEYS.risk.includes(key)) {
      throw new Error(
        `策略形状坏:hardBlock 只认风险因子(${FACTOR_KEYS.risk.join('/')}),收到 ${key}`,
      )
    }
    const v = hardBlock[key]
    if (!Number.isInteger(v) || v < 0 || v > scales.levelMax) {
      throw new Error(`策略形状坏:hardBlock.${key} 必须是 0..${scales.levelMax} 的整数`)
    }
  }
  return doc
}

function normalizeCandidate(raw, index, policy, seen) {
  const where = `候选[${index}]`
  if (!isPlainObject(raw)) throw new Error(`${where} 不是对象`)
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : null
  if (!id) throw new Error(`${where} 缺 id(非空字符串)`)
  if (seen.has(id)) throw new Error(`候选 id 重复:${id}(顺序会不可判,先改成唯一 id)`)
  seen.add(id)
  const title = typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : null
  if (!title) throw new Error(`候选 ${id} 缺 title(非空字符串)`)

  const max = policy.scales.levelMax
  const level = (dim, key) => {
    const v = raw[dim]?.[key]
    if (!Number.isInteger(v) || v < 0 || v > max) {
      throw new Error(
        `候选 ${id} 的 ${dim}.${key} 必须是 0..${max} 的整数(现为 ${JSON.stringify(v)})`,
      )
    }
    return v
  }
  const verifyMinutes = raw.cost?.verifyMinutes
  if (!Number.isFinite(verifyMinutes) || verifyMinutes < 0) {
    throw new Error(`候选 ${id} 的 cost.verifyMinutes 必须是非负数`)
  }
  const leaseRaw = raw.urgency?.leaseHours
  const leaseHours = leaseRaw === undefined ? null : leaseRaw
  if (!(leaseHours === null || (Number.isFinite(leaseHours) && leaseHours >= 0))) {
    throw new Error(`候选 ${id} 的 urgency.leaseHours 必须是非负数或 null(无租约)`)
  }

  return {
    id,
    title,
    benefit: { impact: level('benefit', 'impact'), userValue: level('benefit', 'userValue') },
    risk: {
      irreversible: level('risk', 'irreversible'),
      externalDependency: level('risk', 'externalDependency'),
      ruleTouch: level('risk', 'ruleTouch'),
    },
    cost: { changeSurface: level('cost', 'changeSurface'), verifyMinutes },
    urgency: { leaseHours, blockingOthers: level('urgency', 'blockingOthers') },
  }
}

/**
 * 候选输入形状锁:接受裸数组或 `{ candidates: [...] }`;空数组 ⇒ 抛(枚举到 0 枚不记绿);
 * id 重复 ⇒ 抛(排序会不可判)。返回剥掉多余字段的规范候选,原始值一律保留给审计。
 */
export function validateCandidates(input, policy) {
  const list = Array.isArray(input)
    ? input
    : isPlainObject(input) && Array.isArray(input.candidates)
      ? input.candidates
      : null
  if (!list) throw new Error('候选输入必须是数组,或带 candidates 数组的对象')
  if (list.length === 0) throw new Error('候选为空 ⇒ 未判定(枚举到 0 枚不记绿)')
  const seen = new Set()
  return list.map((raw, i) => normalizeCandidate(raw, i, policy, seen))
}

/**
 * 单因子归一。normalized 一律是"越接近 1 越值得优先"的方向吗?不是 ——
 * normalized 量的是该因子本身的量级(影响面/风险/成本/紧迫度),credit 才是计入总分的余量方向:
 *   · benefit / urgency(阻塞他人)= normalized(越高越好)
 *   · risk / cost = 1 - normalized(越高越差)
 *   · 租约 leaseHours = 1 - min(剩余小时/参照小时, 1)(越临近到期越紧急);null = 无租约 ⇒ 紧迫度 0
 *   · 验证时长 verifyMinutes = min(分钟/参照分钟, 1)
 */
function normalizeFactor(policy, dim, key, raw) {
  if (key === 'leaseHours') {
    if (raw === null) return { normalized: 0, credit: 0, polarity: 'good' }
    const n = r6(1 - Math.min(raw / policy.scales.leaseHoursRef, 1))
    return { normalized: n, credit: n, polarity: 'good' }
  }
  if (key === 'verifyMinutes') {
    const n = r6(Math.min(raw / policy.scales.verifyMinutesRef, 1))
    return { normalized: n, credit: r6(1 - n), polarity: 'bad' }
  }
  const n = r6(raw / policy.scales.levelMax)
  const bad = NEGATIVE_DIMENSIONS.has(dim)
  return { normalized: n, credit: r6(bad ? 1 - n : n), polarity: bad ? 'bad' : 'good' }
}

function hardBlockOf(policy, candidate) {
  const keys = Object.keys(policy.thresholds.hardBlock).sort()
  for (const key of keys) {
    const threshold = policy.thresholds.hardBlock[key]
    const raw = candidate.risk[key]
    if (raw >= threshold) return { key, label: FACTOR_LABELS[key], raw, threshold }
  }
  return null
}

/**
 * 单枚打分。总分 = 各维度加权贡献之和;每项的因子明细都带原始值 / 归一分 / 权重 / 贡献,
 * 所以"为什么这个分"可以逐格加得出来(可审计)。
 */
export function scoreCandidate(policy, candidate) {
  const contributions = []
  for (const dim of DIMENSIONS) {
    const dimWeight = policy.dimensions.weights[dim]
    const factors = []
    let creditSum = 0
    for (const key of FACTOR_KEYS[dim]) {
      const factorWeight = policy.dimensions.factors[dim][key]
      const raw = candidate[dim][key]
      const factor = normalizeFactor(policy, dim, key, raw)
      const credit = r6(factorWeight * factor.credit)
      creditSum += credit
      factors.push({
        key,
        label: FACTOR_LABELS[key],
        raw,
        normalized: factor.normalized,
        credit: factor.credit,
        polarity: factor.polarity,
        factorWeight,
        weight: r6(dimWeight * factorWeight),
        contribution: r6(dimWeight * credit),
      })
    }
    const credit = r6(creditSum)
    contributions.push({
      dimension: dim,
      label: DIMENSION_LABELS[dim],
      weight: dimWeight,
      credit,
      contribution: r6(dimWeight * credit),
      factors,
    })
  }
  // 总分用同一批已舍入的维度贡献相加 —— 账面加得出的数才是审计能复核的数。
  const score = r6(contributions.reduce((sum, c) => sum + c.contribution, 0))
  const riskDim = contributions.find((c) => c.dimension === 'risk')
  const urgencyDim = contributions.find((c) => c.dimension === 'urgency')
  const riskSeverity = r6(1 - riskDim.credit)
  const hardBlock = hardBlockOf(policy, candidate)
  let riskLevel = 'ok'
  if (hardBlock || riskSeverity >= policy.thresholds.riskBlock) riskLevel = 'block'
  else if (riskSeverity >= policy.thresholds.riskReview) riskLevel = 'review'
  return {
    id: candidate.id,
    title: candidate.title,
    score,
    riskSeverity,
    riskLevel,
    hardBlock,
    urgencyCredit: urgencyDim.credit,
    contributions,
  }
}

function formatRaw(policy, factor) {
  if (factor.key === 'leaseHours') return factor.raw === null ? '无租约' : `${factor.raw}h`
  if (factor.key === 'verifyMinutes') return `${factor.raw}min`
  return `${factor.raw}/${policy.scales.levelMax}`
}

function firstReason(policy, item) {
  const topDim = [...item.contributions].sort((a, b) => b.contribution - a.contribution)[0]
  const topFactor = [...topDim.factors].sort((a, b) => b.contribution - a.contribution)[0]
  const parts = [
    `首位:总分 ${item.score}`,
    `最大贡献来自${topDim.label} ${topDim.contribution}(主因${topFactor.label} ` +
      `${formatRaw(policy, topFactor)} ⇒ 归一 ${topFactor.normalized})`,
  ]
  if (item.riskLevel === 'review') {
    parts.push(
      `风险 ${item.riskSeverity} ≥ 复核阈值 ${policy.thresholds.riskReview},需人工复核后再排`,
    )
  } else {
    parts.push(`风险 ${item.riskSeverity}(低于复核阈值 ${policy.thresholds.riskReview})`)
  }
  return parts.join(';')
}

function dominantFactorNote(policy, current, previous) {
  let best = null
  for (let i = 0; i < current.factors.length; i += 1) {
    const factor = current.factors[i]
    const prevFactor = previous.factors[i]
    const delta = r6(factor.contribution - prevFactor.contribution)
    if (delta !== 0 && (!best || Math.abs(delta) > Math.abs(best.delta))) {
      best = {
        delta,
        label: factor.label,
        from: formatRaw(policy, prevFactor),
        to: formatRaw(policy, factor),
      }
    }
  }
  return best ? `(${best.label} ${best.from}→${best.to})` : ''
}

function afterReason(policy, item, previous) {
  const deltas = item.contributions.map((c, i) => ({
    label: c.label,
    contribution: c.contribution,
    note: dominantFactorNote(policy, c, previous.contributions[i]),
    delta: r6(c.contribution - previous.contributions[i].contribution),
  }))
  const fmt = (d) => `${d.label} ${d.delta > 0 ? '+' : ''}${d.delta}${d.note}`
  const losing = deltas.filter((d) => d.delta < 0).sort((a, b) => a.delta - b.delta)
  const winning = deltas.filter((d) => d.delta > 0).sort((a, b) => b.delta - a.delta)
  const lose = losing.length
    ? `失分项:${losing.map(fmt).join('、')}`
    : '无失分项(同分,靠紧急度/风险/id 裁决)'
  const win = winning.length ? `;占优项:${winning.map(fmt).join('、')}` : ''
  return `较前一位 ${previous.id} 低 ${r6(previous.score - item.score)};${lose}${win}`
}

const byRank = (a, b) =>
  b.score - a.score ||
  b.urgencyCredit - a.urgencyCredit ||
  a.riskSeverity - b.riskSeverity ||
  (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

/**
 * 排期裁决:先判压后(硬阻断 > 风险阻断 > 低于最低分),其余按确定性规则排序并逐条写理由。
 * 返回面自带 policy 快照(权重/阈值/参照),审计时不必再去读文件才能复核。
 */
export function decide({ policy, candidates }) {
  const list = validateCandidates(candidates, policy)
  const scored = list.map((candidate) => scoreCandidate(policy, candidate))
  const ranked = []
  const deferred = []
  for (const item of scored) {
    if (item.hardBlock) {
      const hb = item.hardBlock
      deferred.push({
        ...item,
        code: 'hard-block',
        reason: `风险硬阻断:${hb.label}=${hb.raw} ≥ 策略 hardBlock ${hb.threshold},交人工阀`,
      })
    } else if (item.riskLevel === 'block') {
      deferred.push({
        ...item,
        code: 'risk-block',
        reason: `风险 ${item.riskSeverity} ≥ 阻断阈值 ${policy.thresholds.riskBlock}`,
      })
    } else if (item.score < policy.thresholds.minScore) {
      deferred.push({
        ...item,
        code: 'low-score',
        reason: `总分 ${item.score} < 最低分 ${policy.thresholds.minScore}`,
      })
    } else {
      ranked.push(item)
    }
  }
  ranked.sort(byRank)
  ranked.forEach((item, i) => {
    item.rank = i + 1
    item.reason = i === 0 ? firstReason(policy, item) : afterReason(policy, item, ranked[i - 1])
  })
  deferred.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return {
    state: ranked.length > 0 ? 'decided' : 'deferred-all',
    policy,
    counts: { input: list.length, ranked: ranked.length, deferred: deferred.length },
    ranked,
    deferred,
  }
}

export function exitCodeOf(result) {
  return result.state === 'decided' ? EXIT_DECIDED : EXIT_DEFERRED
}

export function formatReport(result) {
  const policy = result.policy
  const lines = [
    `自治决策(策略 v${policy.version}):候选 ${result.counts.input} 枚 ⇒ ` +
      `可排期 ${result.counts.ranked} 枚 / 压后 ${result.counts.deferred} 枚`,
  ]
  for (const item of result.ranked) {
    lines.push(`#${item.rank} [${item.score}] ${item.id} ${item.title}`)
    for (const dim of item.contributions) {
      const factors = dim.factors
        .map(
          (f) =>
            `${f.label} ${formatRaw(policy, f)}→${f.normalized}(×${f.weight}=${f.contribution})`,
        )
        .join(', ')
      lines.push(`   ${dim.label} ${dim.contribution}(维度得分 ${dim.credit}):${factors}`)
    }
    lines.push(`   理由:${item.reason}`)
  }
  if (result.deferred.length > 0) {
    lines.push('压后(本轮不排期):')
    for (const item of result.deferred) {
      lines.push(`- ${item.id} ${item.title} [${item.score}] ${item.reason}`)
    }
  }
  return lines.join('\n')
}

const USAGE = [
  '用法:',
  '  node scripts/autonomy-decision.mjs --input <候选 JSON> [--json]',
  '  node scripts/autonomy-decision.mjs --self-test',
  '',
  '候选 JSON 形态(裸数组或 { "candidates": [...] }):',
  '  [{ "id": "G-1", "title": "...",',
  '     "benefit": { "impact": 0..3, "userValue": 0..3 },',
  '     "risk": { "irreversible": 0..3, "externalDependency": 0..3, "ruleTouch": 0..3 },',
  '     "cost": { "changeSurface": 0..3, "verifyMinutes": 分钟 },',
  '     "urgency": { "leaseHours": 小时(null=无租约), "blockingOthers": 0..3 } }]',
  '退出码:0 有可排期票 / 3 全被压后 / 2 未判定(缺输入、读不到、形状坏、空候选)',
].join('\n')

function selfTest() {
  let cases = 0
  const assert = (ok, message) => {
    cases += 1
    if (!ok) throw new Error(`self-test 失败:${message}`)
  }
  const policy = loadPolicy(readFileSync(POLICY_PATH, 'utf8'))
  const max = policy.scales.levelMax
  const mk = (id, benefit, risk, cost, urgency) => ({
    id,
    title: `${id} 票`,
    benefit,
    risk,
    cost,
    urgency,
  })
  const good = mk(
    'A',
    { impact: max, userValue: max },
    { irreversible: 0, externalDependency: 0, ruleTouch: 0 },
    { changeSurface: 0, verifyMinutes: 0 },
    { leaseHours: 0, blockingOthers: max },
  )
  const review = mk(
    'B',
    { impact: max, userValue: max },
    { irreversible: 2, externalDependency: max, ruleTouch: 0 },
    { changeSurface: 0, verifyMinutes: 0 },
    { leaseHours: null, blockingOthers: 0 },
  )
  const hard = mk(
    'C',
    { impact: max, userValue: max },
    { irreversible: 0, externalDependency: 0, ruleTouch: max },
    { changeSurface: 0, verifyMinutes: 0 },
    { leaseHours: 0, blockingOthers: max },
  )
  const low = mk(
    'D',
    { impact: 0, userValue: 0 },
    { irreversible: 1, externalDependency: 1, ruleTouch: 0 },
    { changeSurface: max, verifyMinutes: policy.scales.verifyMinutesRef * 2 },
    { leaseHours: policy.scales.leaseHoursRef, blockingOthers: 0 },
  )

  assert(Object.keys(policy.dimensions.weights).length === DIMENSIONS.length, '维度权重齐四维')
  const a = scoreCandidate(policy, good)
  const sum = r6(a.contributions.reduce((s, c) => s + c.contribution, 0))
  assert(a.score === sum, '总分必须等于各维度贡献之和')
  assert(a.riskSeverity === 0 && a.riskLevel === 'ok', '零风险应是 ok 且风险严重度 0')
  const risk = a.contributions.find((c) => c.dimension === 'risk')
  assert(
    risk.credit === 1 && risk.contribution === policy.dimensions.weights.risk,
    '零风险拿满风险维度权重',
  )
  const urgency = a.contributions.find((c) => c.dimension === 'urgency')
  assert(urgency.credit === 1, '零小时租约 + 最大阻塞 = 满紧急度')
  const leaseFactor = urgency.factors.find((f) => f.key === 'leaseHours')
  assert(leaseFactor.normalized === 1, '租约越临近到期紧迫度越高')
  const b = scoreCandidate(policy, review)
  assert(b.riskLevel === 'review', '风险达复核阈值应标 review')
  const c = scoreCandidate(policy, hard)
  assert(c.riskLevel === 'block' && c.hardBlock?.key === 'ruleTouch', '触碰铁律最高档必须硬阻断')
  const d = scoreCandidate(policy, low)
  assert(d.score < policy.thresholds.minScore, '低收益高成本票应低于最低分')

  const result = decide({ policy, candidates: [low, hard, review, good] })
  assert(result.state === 'decided' && result.ranked[0].id === 'A', '高收益低风险票应排第一')
  assert(result.ranked[0].reason.startsWith('首位:'), '首位理由必须点名首位与最大贡献维度')
  assert(result.ranked[1].reason.includes('A'), '第二位的理由必须点名前一位 id')
  assert(
    result.deferred.some((x) => x.id === 'C' && x.code === 'hard-block'),
    '硬阻断票必须进压后并点名',
  )
  assert(
    result.deferred.some((x) => x.id === 'D' && x.code === 'low-score'),
    '低分票必须进压后并点名',
  )
  assert(result.counts.input === 4 && result.counts.ranked === 2, '计数应与入参一致')
  assert(exitCodeOf(result) === EXIT_DECIDED, '有可排期票 exit 0')
  const allDeferred = decide({ policy, candidates: [hard, low] })
  assert(
    allDeferred.state === 'deferred-all' && exitCodeOf(allDeferred) === EXIT_DEFERRED,
    '全压后 exit 3',
  )
  assert(formatReport(result).includes('理由:首位:'), '人读报告必须带理由行')

  let threw = null
  try {
    decide({ policy, candidates: [] })
  } catch (e) {
    threw = e
  }
  assert(threw !== null && /候选为空/.test(threw.message), '空候选必须判未判定')
  threw = null
  try {
    validateCandidates(
      [
        { ...good, id: 'A' },
        { ...review, id: 'A' },
      ],
      policy,
    )
  } catch (e) {
    threw = e
  }
  assert(threw !== null && /id 重复/.test(threw.message), '重复 id 必须抛')
  threw = null
  try {
    loadPolicy('{"version":1}')
  } catch (e) {
    threw = e
  }
  assert(threw !== null && /dimensions/.test(threw.message), '缺维度的策略必须判形状坏')

  console.info(`self-test: 全绿(${cases} 组断言)`)
}

function valueOf(argv, flag) {
  const i = argv.indexOf(flag)
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null
}

async function main(argv) {
  if (argv.includes('--self-test')) return selfTest()
  if (argv.includes('--help') || argv.includes('-h')) {
    console.info(USAGE)
    return
  }
  const inputPath = valueOf(argv, '--input')
  if (!inputPath) {
    console.error('❌ 未判定:缺 --input <候选 JSON 文件>(不猜绿,exit 2)')
    process.exitCode = EXIT_UNKNOWN
    return
  }
  let policy
  try {
    policy = loadPolicy(readFileSync(POLICY_PATH, 'utf8'))
  } catch (e) {
    console.error(`❌ 未判定:${e.message}`)
    process.exitCode = EXIT_UNKNOWN
    return
  }
  let candidates
  try {
    candidates = JSON.parse(readFileSync(inputPath, 'utf8'))
  } catch (e) {
    console.error(`❌ 未判定:候选输入读不到或不是合法 JSON(${inputPath}):${e?.message ?? e}`)
    process.exitCode = EXIT_UNKNOWN
    return
  }
  let result
  try {
    result = decide({ policy, candidates })
  } catch (e) {
    console.error(`❌ 未判定:${e.message}`)
    process.exitCode = EXIT_UNKNOWN
    return
  }
  console.info(argv.includes('--json') ? JSON.stringify(result, null, 2) : formatReport(result))
  process.exitCode = exitCodeOf(result)
}

export const __test__ = {
  POLICY_PATH,
  DIMENSIONS,
  FACTOR_KEYS,
  EXIT_DECIDED,
  EXIT_UNKNOWN,
  EXIT_DEFERRED,
  loadPolicy,
  validateCandidates,
  scoreCandidate,
  decide,
  exitCodeOf,
  formatReport,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}
