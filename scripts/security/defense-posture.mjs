// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 诊断需要 stdout */
/**
 * 攻防态势(2026-11-24 立)。
 *
 * 回答「我的防线现在是什么水平」,而不是「有一条告警」。五项指标,每项都能被质疑:
 *   · 拦截率   已拦/全部攻击事件 —— 分母必须是「判定为攻击的事件」,不是全部请求(全量请求日志根本没留);
 *   · 覆盖率   已封 IP / 累计攻击 IP —— 缺口就是「他还在打我却没封」;
 *   · MTTD     首次事件 → 首次封禁的中位时长 —— 这是响应速度,不是「有没有响应」;
 *   · 杀伤链   按阶段分布,breached = 越过边界的实体数(唯一能证明防线被穿透的数字);
 *   · 趋势     按天事件量,用来识别「新一波」而不是看总量。
 *
 * 取不到任何一源 ⇒ 该项落 null 并显式标 unjudged,不用 0 冒充「没有」。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { collectEvents } from './lib/attack-collect.mjs'
import { defaultStatePath, loadState } from './lib/blocklist.mjs'
import { assessEntity, judgeIntent, stageIndex, summarize } from './lib/kill-chain.mjs'
import { appendEvidence, sha256 } from './lib/evidence-chain.mjs'

const ROUTER_LOG = process.env.IHUI_ROUTER_LOG || 'D:\\DevEnv\\logs\\svc-web-router.log'
const HUORONG_DB = process.env.IHUI_HUORONG_DB || 'C:\\ProgramData\\Huorong\\Sysdiag\\log.db'

/** 已拦事件:blocked===true 或本身就是「拒绝」类。 */
export function isIntercepted(ev) {
  if (ev?.blocked === true) return true
  return ['waf-block', 'waf-observe', 'rate-limit', 'edge-guard'].includes(String(ev?.kind ?? ''))
}

export function median(nums) {
  const a = nums.filter((n) => Number.isFinite(n) && n >= 0).sort((x, y) => x - y)
  if (!a.length) return null
  const mid = Math.floor(a.length / 2)
  return a.length % 2 ? Math.round(a[mid]) : Math.round((a[mid - 1] + a[mid]) / 2)
}

function dayKey(ts) {
  const d = new Date(ts)
  return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : null
}

function readJson(path) {
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

export function buildPosture({ events, entries = {}, attribution = null, triage = null, unjudged = [], now = Date.now() }) {
  const list = Array.isArray(events) ? events : []
  const byIp = new Map()
  let intercepted = 0
  let passed = 0
  // 火绒 waf 的 blocked 三态必须分开数:unknown 不能并入 true(未判定不冒绿)
  let wafTrue = 0
  let wafFalse = 0
  let wafUnknown = 0
  const byKind = {}
  const byDay = {}
  for (const ev of list) {
    byKind[ev.kind] = (byKind[ev.kind] ?? 0) + 1
    const day = dayKey(ev.ts)
    if (day) byDay[day] = (byDay[day] ?? 0) + 1
    if (ev?.kind === 'waf') {
      if (ev.blocked === true) wafTrue += 1
      else if (ev.blocked === false) wafFalse += 1
      else wafUnknown += 1
    }
    if (isIntercepted(ev)) intercepted += 1
    else if (ev?.kind === 'waf' && ev?.blocked === false) passed += 1
    const ip = String(ev?.ip ?? '')
    if (!ip) continue
    if (!byIp.has(ip)) byIp.set(ip, [])
    byIp.get(ip).push(ev)
  }

  const entities = [...byIp.entries()].map(([ip, evs]) => {
    const a = assessEntity(evs)
    return { ip, ...a, firstTs: evs.map((e) => e.ts).sort()[0], intent: judgeIntent(evs) }
  })
  const chain = summarize(entities)

  const banned = Object.keys(entries ?? {})
  const attackIps = entities.length
  const coverage = attackIps ? banned.filter((ip) => byIp.has(ip)).length / attackIps : null

  // MTTD 只取「最近 7 天内首见」的样本:历史补封(攻击了 11 天才被追封)不是响应速度,
  // 混进来会把 16909 分钟这种历史数字当成今天的能力。
  const mttdSamples = []
  const mttdWindow = now - 7 * 86400_000
  for (const e of entities) {
    const entry = entries?.[e.ip]
    if (!entry?.bannedAt) continue
    const first = Date.parse(e.firstTs)
    const ban = Date.parse(entry.bannedAt)
    if (!Number.isFinite(first) || !Number.isFinite(ban) || ban < first || first < mttdWindow) continue
    mttdSamples.push((ban - first) / 60000)
  }

  const total = list.length
  const bannedSet = new Set(banned)
  const unbannedActive = entities
    .filter((e) => stageIndex(e.stage) >= stageIndex('initial-access') && !bannedSet.has(e.ip))
    .sort((a, b) => stageIndex(b.stage) - stageIndex(a.stage) || b.hits - a.hits)
    .map((e) => ({ ip: e.ip, stage: e.stage, hits: e.hits }))

  return {
    generatedAt: new Date(now).toISOString(),
    totals: { events: total, ips: attackIps, banned: banned.length },
    interception: {
      intercepted,
      passed,
      // 分母只含火绒确认的 waf 三态(true/false);unknown 单列
      rate: wafTrue + wafFalse ? wafTrue / (wafTrue + wafFalse) : null,
      wafBlocked: { true: wafTrue, false: wafFalse, unknown: wafUnknown },
      note: '拦截率的分母只含「被检测到并留痕」的尝试。未被检测到的攻击不会出现在任何日志里,真实检测覆盖率不可知 —— 这一项不能当防线强度的证明。',
    },
    coverage,
    unbannedActive,
    mttdMinutes: { median: median(mttdSamples), samples: mttdSamples.length, windowDays: 7 },
    byKind,
    byDay,
    chain,
    top: entities.sort((a, b) => stageRank(b) - stageRank(a) || b.hits - a.hits).slice(0, 8).map((e) => ({
      ip: e.ip, stage: e.stage, hits: e.hits, entryPassed: e.entryPassed, confidence: e.confidence, intent: e.intent.intent,
    })),
    attributionIps: attribution?.totals?.ips ?? null,
    triageVerdict: triage?.verdict ?? null,
    unjudged,
  }
}

function stageRank(e) {
  return ['recon', 'initial-access', 'execution', 'persistence', 'c2', 'exfil'].indexOf(e.stage)
}

function renderMarkdown(p) {
  const lines = [
    '# 攻防态势',
    '',
    `生成时间:${p.generatedAt}`,
    '',
    '| 指标 | 值 |',
    '| --- | --- |',
    `| 攻击事件 | ${p.totals.events} |`,
    `| 攻击 IP | ${p.totals.ips} |`,
    `| 已封 IP | ${p.totals.banned} |`,
    `| 拦截率 | ${p.interception.rate === null ? '未判定' : `${(p.interception.rate * 100).toFixed(1)}%`} (拦 ${p.interception.wafBlocked.true} / 过 ${p.interception.wafBlocked.false} / 未判定 ${p.interception.wafBlocked.unknown}) |`,
    `| 封禁覆盖率 | ${p.coverage === null ? '未判定' : `${(p.coverage * 100).toFixed(1)}%`} |`,
    `| MTTD 中位 | ${p.mttdMinutes.median === null ? '未判定' : `${p.mttdMinutes.median} 分钟`} (近 ${p.mttdMinutes.windowDays} 天样本 ${p.mttdMinutes.samples}) |`,
    `| 越过边界实体 | ${p.chain.breached} |`,
    `| 主机三查 | ${p.triageVerdict ?? '未判定'} |`,
    '',
    `> ${p.interception.note}`,
    '',
    '## 杀伤链分布',
    '',
    '| 阶段 | 实体数 |',
    '| --- | --- |',
    ...['recon', 'initial-access', 'execution', 'persistence', 'c2', 'exfil'].map((s) => `| ${s} | ${p.chain.distribution[s] ?? 0} |`),
    '',
    '## 最深实体',
    '',
    '| IP | 阶段 | 命中 | 越过边界 | 置信 | 目的 |',
    '| --- | --- | --- | --- | --- | --- |',
    ...p.top.map((e) => `| ${e.ip} | ${e.stage} | ${e.hits} | ${e.entryPassed ? '是' : '否'} | ${e.confidence} | ${e.intent} |`),
    '',
    `## 反制缺口:已到初始访问但未封(${p.unbannedActive.length})`,
    '',
    ...(p.unbannedActive.length
      ? ['| IP | 阶段 | 命中 |', '| --- | --- | --- |', ...p.unbannedActive.slice(0, 15).map((e) => `| ${e.ip} | ${e.stage} | ${e.hits} |`)]
      : ['- 无']),
    '',
    '## 趋势(近 14 天)',
    '',
    ...Object.entries(p.byDay).sort().slice(-14).map(([d, n]) => `- ${d}: ${n}`),
    '',
    '## 未判定',
    '',
    ...(p.unjudged.length ? p.unjudged.map((u) => `- ${u.source}: ${u.reason ?? ''}`) : ['- 无']),
    '',
  ]
  return lines.join('\n')
}

async function main() {
  // 根按脚本位置算,不用 process.cwd():计划任务(SYSTEM)的 cwd 是 System32,
  // 用 cwd 会把状态写进系统目录或直接失败(2026-11-24 实测卡成"运行中")。
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
  const stateDir = join(root, '.ihui-agent', 'state')
  const jsonOut = process.argv.includes('--json')

  const { events, unjudged } = await collectEvents({ routerLog: ROUTER_LOG, huorongDb: HUORONG_DB })
  const statePath = defaultStatePath(root)
  const state = loadState(statePath)
  const attribution = readJson(join(stateDir, 'attack-attribution.json'))
  const triage = readJson(join(stateDir, 'host-triage.json'))

  const posture = buildPosture({ events, entries: state.entries, attribution, triage, unjudged })

  mkdirSync(stateDir, { recursive: true })
  writeFileSync(join(stateDir, 'defense-posture.json'), `${JSON.stringify(posture, null, 2)}\n`, 'utf8')
  const mdText = renderMarkdown(posture)
  writeFileSync(join(stateDir, 'defense-posture.md'), mdText, 'utf8')
  // 每次生成态势都往证据链追加一条:报告摘要 + 哈希。这样「当时看到的是什么」可被事后校验。
  const ev = appendEvidence(join(stateDir, 'evidence-chain.jsonl'), {
    kind: 'defense-posture',
    generatedAt: posture.generatedAt,
    reportSha256: sha256(mdText),
    totals: posture.totals,
    breached: posture.chain.breached,
    triage: posture.triageVerdict,
  })
  if (!ev.ok) console.error(`⚠ 证据链追加失败: ${ev.error}(不影响本次报告)`)

  if (jsonOut) {
    console.log(JSON.stringify(posture, null, 2))
  } else {
    console.log(renderMarkdown(posture))
    console.log(`报告: ${join(stateDir, 'defense-posture.md')}`)
  }
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}`) main()

export const __test__ = { buildPosture, isIntercepted, median }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
