// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 本工具是运维记账器,机器行必须走 stdout */
/**
 * deploy-decision — 部署决策机读台账(auto-evolve 四期系列 O65 · 第 2 期「部署闭环」,2026-10-25 立)。
 *
 * 补的是「回滚决策」的机读口径:部署环此前只在日志里打中文结论(人读),告警邮件也只带
 * 自由文本明细 —— 「这一轮为什么切流 / 为什么整份退回上一可用包 / 退回的是哪一枚包」
 * 没有任何结构化载体,后续自治 agent 与 incident 复盘都得靠正则猜日志。
 *
 * 形态纪律:
 *  - 一条决策一行 JSONL,只追加不改写(与既有 triage/mail 台账同形);台账路径默认落在
 *    `.ihui-agent/`(整目录被 .gitignore 覆盖)⇒ 生产机上写它**不会弄脏 git 工作树**,
 *    不会挡住部署环的 ff-only 合并;
 *  - 身份字段只放"这一轮的事实"(action / sha / verdict / dims),路径与报错原文只进 reason,
 *    并做换行折叠与截断 —— 明细漂移不得变成"每轮一个新身份"(§5e-1);
 *  - 参数非法不静默:退出码 2 并点名哪一格坏;写盘失败退出码 3。调用方(PowerShell)只
 *    记账不据此改流程,但"没记成"必须能在日志里看见。
 *
 * action 闭集(与部署环的出口一一对应,新增出口必须在此登记):
 *   pass               健康门禁三项全绿后切流
 *   pass-unproven      已切流但没有任何一轮拿到三项全绿(放行≠通过)
 *   pass-entry-broken  已切流但公网入口读不到(源站直探正常)⇒ 不回滚好构建
 *   rollback           健康门禁未过,整份退回上一可用包
 *   manual-rollback    人工执行 -rollbackOnly
 *   build-fail         构建失败,未切流
 *   canary-pass        金丝雀观察窗通过(错误率/延迟未超策略阈值),放量完成
 *   canary-rollback    金丝雀观察窗异常,自动回滚到上一可用包
 *   canary-unproven    金丝雀观察窗未判定(样本不足/未知占比过高),不回滚也不冒充通过
 *
 * 用法:
 *   node scripts/deploy-decision.mjs --action rollback --sha <sha> --verdict fail \
 *        --dims "web,llm" --prev-sha <sha> --rollback-id <id> --shadow-rc 0 \
 *        --reason "健康门禁未过" [--ledger <path>] [--dry-run]
 *   node scripts/deploy-decision.mjs --self-test
 */
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { hostname } from 'node:os'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_LEDGER = join(ROOT, '.ihui-agent', 'deploy-decisions.jsonl')
const SCHEMA_VERSION = 1

export const DECISION_ACTIONS = Object.freeze([
  'pass',
  'pass-unproven',
  'pass-entry-broken',
  'rollback',
  'manual-rollback',
  'build-fail',
  'canary-pass',
  'canary-rollback',
  'canary-unproven',
])
export const DECISION_VERDICTS = Object.freeze(['pass', 'pass-unproven', 'fail', 'entry-broken', 'unknown', 'not-run'])

const SHA_RE = /^[0-9a-f]{7,40}$/
const MAX_REASON = 400
const MAX_DIMS = 12

export class DecisionShapeError extends Error {}

function asText(v) {
  if (typeof v === 'string') return v.trim()
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

/** 回滚点 sha / 构建号:空与未判定必须可分(空串=没读到,不是"没有")。 */
function asSha(v) {
  const s = asText(v).toLowerCase()
  if (!s) return ''
  return SHA_RE.test(s) ? s : `undetermined(${s})`
}

function normalizeDims(v) {
  // 部署环的维度串历史上用 '+' 拼(ihui-deploy.ps1 :895),台账口径统一按逗号;
  // 两种分隔符都在这里吃掉,免得"归一"散落在两端各写一份。
  const arr = Array.isArray(v) ? v : asText(v).split(/[,+]/)
  const out = []
  for (const raw of arr) {
    const d = asText(raw)
    if (!d || out.includes(d)) continue
    out.push(d)
    if (out.length >= MAX_DIMS) break
  }
  return out
}

function normalizeReason(v) {
  const s = asText(v).replace(/\s+/g, ' ').trim()
  return s.length > MAX_REASON ? `${s.slice(0, MAX_REASON)}…` : s
}

/**
 * 把一轮部署出口归一成一条决策记录。纯函数(不碰盘),供自检与镜像测试共用。
 * 非法 action / verdict 一律 throw —— 记账器不得替调用方猜"这大概是回滚"。
 */
export function buildDecision(input = {}, opt = {}) {
  const action = asText(input.action)
  if (!DECISION_ACTIONS.includes(action)) {
    throw new DecisionShapeError(`action 非法:「${action || '(空)'}」(闭集:${DECISION_ACTIONS.join('/')})`)
  }
  const verdict = asText(input.gateVerdict) || 'not-run'
  if (!DECISION_VERDICTS.includes(verdict)) {
    throw new DecisionShapeError(`verdict 非法:「${verdict}」(闭集:${DECISION_VERDICTS.join('/')})`)
  }
  const shadowRaw = asText(input.shadowRc)
  let shadowRc = null
  if (shadowRaw) {
    if (!/^-?\d+$/.test(shadowRaw)) throw new DecisionShapeError(`shadow-rc 必须是整数或留空:「${shadowRaw}」`)
    shadowRc = Number(shadowRaw)
  }
  const now = opt.now instanceof Date ? opt.now : new Date()
  return {
    v: SCHEMA_VERSION,
    ts: now.toISOString(),
    action,
    sha: asSha(input.sha),
    prevSha: asSha(input.prevSha),
    rollbackBuildId: asText(input.rollbackBuildId),
    gateVerdict: verdict,
    failDims: normalizeDims(input.failDims),
    shadowRc,
    reason: normalizeReason(input.reason),
    host: opt.host || hostname(),
    pid: Number.isInteger(opt.pid) ? opt.pid : process.pid,
  }
}

/** 机器行:日志与告警正文里可 grep 的那一行(纯 ASCII 前缀 + 单行 JSON)。 */
export function formatDecisionLine(decision) {
  return `DEPLOY-DECISION ${JSON.stringify(decision)}`
}

export function appendDecision(ledgerPath, decision) {
  mkdirSync(dirname(resolve(ledgerPath)), { recursive: true })
  appendFileSync(ledgerPath, `${JSON.stringify(decision)}\n`, 'utf8')
  return ledgerPath
}

export function readDecisions(ledgerPath) {
  let text
  try {
    text = readFileSync(ledgerPath, 'utf8')
  } catch (e) {
    if (e && e.code === 'ENOENT') return []
    throw e
  }
  const out = []
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim()
    if (!t) continue
    let obj
    try {
      obj = JSON.parse(t)
    } catch {
      continue // 半截行/坏行不参与统计,但不让整本台账作废
    }
    if (obj && obj.v === SCHEMA_VERSION) out.push(obj)
  }
  return out
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
  const now = new Date('2026-10-25T12:00:00.000Z')

  t('合法 pass 记录形状完整', () => {
    const d = buildDecision({ action: 'pass', sha: 'c05ca0d5', gateVerdict: 'pass', shadowRc: '0' }, { now, host: 'h', pid: 1 })
    if (d.v !== 1) throw new Error('v 必须为 1')
    if (d.ts !== now.toISOString()) throw new Error('ts 不是给定时刻')
    if (d.sha !== 'c05ca0d5') throw new Error('sha 未原样保留')
    if (d.shadowRc !== 0) throw new Error('shadowRc 应归一为数字 0')
    if (d.failDims.length !== 0) throw new Error('dims 应为空')
  })
  t('回滚三件套(prev/rollbackId/verdict)', () => {
    const d = buildDecision(
      { action: 'rollback', sha: 'c05ca0d5', prevSha: '8486d01d', rollbackBuildId: 'b-1', gateVerdict: 'fail', failDims: 'web, api ,web' },
      { now, host: 'h', pid: 1 },
    )
    if (d.prevSha !== '8486d01d') throw new Error('prevSha 丢')
    if (d.rollbackBuildId !== 'b-1') throw new Error('rollbackBuildId 丢')
    if (d.gateVerdict !== 'fail') throw new Error('verdict 丢')
    if (d.failDims.join('|') !== 'web|api') throw new Error(`dims 去重/切分错:${d.failDims.join('|')}`)
  })
  t('未知 action 必须拒绝(不得猜)', () => {
    let hit = false
    try {
      buildDecision({ action: 'auto-heal' }, { now })
    } catch (e) {
      hit = e instanceof DecisionShapeError
    }
    if (!hit) throw new Error('未抛 DecisionShapeError')
  })
  t('未判定的 sha 不得写成空', () => {
    const d = buildDecision({ action: 'build-fail', sha: 'not-a-sha' }, { now })
    if (!d.sha.startsWith('undetermined(')) throw new Error(`sha 应标未判定,实得 ${d.sha}`)
    const e = buildDecision({ action: 'build-fail' }, { now })
    if (e.sha !== '') throw new Error('空 sha 应保留空串(调用方未给)')
  })
  t('reason 折叠换行并截断', () => {
    const long = `${'错误\n路径 C:\\x '.repeat(80)}`
    const d = buildDecision({ action: 'build-fail', reason: long }, { now })
    if (d.reason.includes('\n')) throw new Error('reason 含换行')
    if (d.reason.length > MAX_REASON + 1) throw new Error(`reason 未截断(${d.reason.length})`)
  })
  t('机器行前缀与单行性', () => {
    const line = formatDecisionLine(buildDecision({ action: 'pass' }, { now, host: 'h', pid: 1 }))
    if (!line.startsWith('DEPLOY-DECISION ')) throw new Error('前缀错')
    if (line.includes('\n')) throw new Error('机器行含换行')
    JSON.parse(line.slice('DEPLOY-DECISION '.length))
  })
  t('shadow-rc 非整数拒绝', () => {
    let hit = false
    try {
      buildDecision({ action: 'pass', shadowRc: 'ok' }, { now })
    } catch (e) {
      hit = e instanceof DecisionShapeError
    }
    if (!hit) throw new Error('未拒绝非整数 shadow-rc')
  })

  for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.ok ? '' : ` — ${c.why}`}`)
  const bad = checks.filter((c) => !c.ok)
  console.log(`# self-test ${checks.length - bad.length}/${checks.length}`)
  return bad.length === 0 ? 0 : 1
}

function main(argv) {
  const args = parseArgs(argv)
  if (args['self-test']) return selfTest()
  const ledger = asText(args.ledger) || DEFAULT_LEDGER
  let decision
  try {
    decision = buildDecision({
      action: args.action,
      sha: args.sha,
      prevSha: args['prev-sha'],
      rollbackBuildId: args['rollback-id'],
      gateVerdict: args.verdict,
      failDims: args.dims,
      shadowRc: args['shadow-rc'],
      reason: args.reason,
    })
  } catch (e) {
    console.error(`DEPLOY-DECISION-ERROR ${e?.message ?? e}`)
    return 2
  }
  if (args['dry-run']) {
    console.log(formatDecisionLine(decision))
    return 0
  }
  try {
    appendDecision(ledger, decision)
  } catch (e) {
    console.error(`DEPLOY-DECISION-WRITE-FAILED ${ledger}: ${e?.message ?? e}`)
    return 3
  }
  console.log(formatDecisionLine(decision))
  return 0
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (invokedDirectly) process.exitCode = main(process.argv.slice(2))
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
