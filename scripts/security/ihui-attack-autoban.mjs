#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具,需 stdout 输出决策与诊断 */
/**
 * 入口攻击自动封禁 / 自动解封(2026-11-24 立)。
 *
 * 定位:把「谁在打、打了几次、封不封、封多久」变成一条可重复执行的命令,
 * 由计划任务每 10 分钟跑一次,而不是靠人盯日志手工 netsh。
 *
 * 合规边界(必须写在代码里,避免后人加错能力):
 *   · 只做**防御性**动作:本机防火墙阻断、取证、生成 abuse 线索;
 *   · 绝不发起任何对外攻击/扫描/反射 —— 主动打回去在《网络安全法》《刑法》285/286
 *     下是违法行为,且会把本机从受害者变成加害者。要追责只走上报云厂商/执法通道。
 *
 * 用法:
 *   node scripts/security/ihui-attack-autoban.mjs            # 只扫描打分(dry-run,默认)
 *   node scripts/security/ihui-attack-autoban.mjs --apply    # 落防火墙规则(需管理员)
 *   node scripts/security/ihui-attack-autoban.mjs --status   # 看当前黑名单
 *   node scripts/security/ihui-attack-autoban.mjs --unban 1.2.3.4 --apply
 *   node scripts/security/ihui-attack-autoban.mjs --prune --apply
 *   加 --window-hours 168 看 7 天;--json 输出机器可读结果
 */
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { appendFileSync, readFileSync } from 'node:fs'
import { isIPv4 } from 'node:net'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { collectEvents } from './lib/attack-collect.mjs'
import { SECURITY_POLICY, scoreEvents, decideBans } from './lib/threat-policy.mjs'
import {
  defaultStatePath,
  loadState,
  applyDecisions,
  pruneExpired,
  unban,
  isElevated,
  addBlockRule,
  infraIps,
  ruleNameFor,
  saveState,
} from './lib/blocklist.mjs'
import { ENTITY_POLICY, clusterSubnets, planSubnetEscalation } from './lib/threat-entity.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')

function parseArgs(argv) {
  const out = {
    action: 'scan',
    apply: false,
    json: false,
    windowHours: SECURITY_POLICY.windowHours,
    routerLog: process.env.IHUI_ROUTER_LOG || 'D:\\DevEnv\\logs\\svc-web-router.log',
    huorongDb: process.env.IHUI_HUORONG_DB || 'C:\\ProgramData\\Huorong\\Sysdiag\\log.db',
    statePath: process.env.IHUI_ATTACK_STATE || defaultStatePath(ROOT),
    ip: '',
    banList: '',
    banFile: '',
    ttlHours: 168,
    // 段级升级默认关:封 /24 会误伤同段正常站点,必须显式 --escalate-subnets 才考虑
    escalateSubnets: false,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--apply') out.apply = true
    else if (a === '--escalate-subnets') out.escalateSubnets = true
    else if (a === '--json') out.json = true
    else if (a === '--status') out.action = 'status'
    else if (a === '--prune') out.action = 'prune'
    else if (a === '--ban') {
      out.action = 'ban'
      out.banList = argv[i + 1] || ''
      i += 1
    } else if (a === '--ban-file') {
      out.action = 'ban'
      out.banFile = argv[i + 1] || ''
      i += 1
    } else if (a === '--ttl-hours') {
      out.ttlHours = Number(argv[i + 1]) || out.ttlHours
      i += 1
    } else if (a === '--unban') {
      out.action = 'unban'
      out.ip = argv[i + 1] || ''
      i += 1
    } else if (a === '--window-hours') {
      out.windowHours = Number(argv[i + 1]) || out.windowHours
      i += 1
    } else if (a === '--router-log') {
      out.routerLog = argv[i + 1] || out.routerLog
      i += 1
    } else if (a === '--huorong-db') {
      out.huorongDb = argv[i + 1] || out.huorongDb
      i += 1
    } else if (a === '--state') {
      out.statePath = argv[i + 1] || out.statePath
      i += 1
    } else if (a === '--help' || a === '-h') {
      out.action = 'help'
    }
  }
  return out
}

/** 从 --ban 字面量 / --ban-file(CSV 或每行一个) 里取合法 IPv4，其余原样回给调用方列示。 */
function collectBanIps(opt) {
  const strip = (s) => String(s ?? '').trim().replace(/^["']+|["']+$/g, '').trim()
  const raw = []
  if (opt.banList) raw.push(...opt.banList.split(/[\s,;]+/))
  if (opt.banFile) {
    const text = readFileSync(opt.banFile, 'utf8')
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim()
      if (!t) continue
      const first = strip(t.split(/[,;\t]/)[0])
      if (/^ip$/i.test(first)) continue // CSV 表头
      raw.push(first)
    }
  }
  const ips = []
  const ignored = []
  for (const r of raw) {
    const v = strip(r)
    if (!v) continue
    if (isIPv4(v)) {
      if (!ips.includes(v)) ips.push(v)
    } else ignored.push(v)
  }
  return { ips, ignored }
}

function printHuman(result) {
  if (result.action === 'status') {
    console.log(`黑名单条目: ${result.entries.length}`)
    for (const e of result.entries) {
      console.log(`  ${e.ip.padEnd(16)} 分=${e.score} 次数=${e.hits} 到期=${e.expiresAt} 规则=${e.ruleName}`)
    }
    return
  }
  console.log(`窗口 ${result.windowHours}h | 事件 ${result.stats.total} 条 | 聚合 IP ${result.aggregates.length} 个`)
  for (const u of result.unjudged) console.log(`  ⚠ 未判定 ${u.source}: ${u.reason}`)
  const top = result.aggregates.slice(0, 10)
  for (const a of top) {
    console.log(`  ${a.ip.padEnd(16)} 分=${String(a.score).padStart(3)} 次数=${String(a.hits).padStart(4)} ${a.detections.join(',') || a.kinds ? Object.keys(a.kinds).join('/') : ''}`)
  }
  const bans = result.decisions.filter((d) => d.action === 'ban')
  const refresh = result.decisions.filter((d) => d.action === 'refresh')
  console.log(`决策: 封禁 ${bans.length} | 续期 ${refresh.length} | 观察 ${result.decisions.length - bans.length - refresh.length}`)
  for (const b of bans) console.log(`  → 封 ${b.ip} ${b.ttlHours}h (${b.detections.join(',') || b.score + '分'})`)
  if (result.subnets) {
    console.log(`段级升级: 放行 ${result.subnets.approve.length} | 拒绝 ${result.subnets.reject.length} | 留待 ${result.subnets.held.length}`)
    if (result.subnets.dryRun) {
      for (const cidr of result.subnets.approve) console.log(`  → 将封段 ${cidr}(dry-run,加 --apply 落地)`)
    } else {
      for (const a of result.subnetApplied) console.log(`  → 封段 ${a.cidr}（${a.ips.length} IP / ${a.hits} 命中 / 至 ${a.expiresAt}）`)
    }
    for (const r of result.subnets.reject) console.log(`  ⊘ 拒绝 ${r.cidr}: ${r.reason}`)
    for (const h of result.subnets.held) console.log(`  ⊘ 留待 ${h.cidr}: ${h.reason}`)
  }
  for (const f of result.failed) console.log(`  ✗ 应用失败 ${f.ip}: ${f.error}`)
}

async function main() {
  const opt = parseArgs(process.argv.slice(2))
  if (opt.action === 'help') {
    console.log('用法: --apply | --status | --prune | --unban <ip> | --ban <ip[,ip]> | --ban-file <csv> | --ttl-hours N | --window-hours N | --escalate-subnets | --json')
    return 0
  }

  const state = { ...loadState(opt.statePath), path: opt.statePath }

  if (opt.action === 'status') {
    const entries = Object.values(state.entries)
    const result = { action: 'status', entries }
    if (opt.json) console.log(JSON.stringify(result, null, 2))
    else printHuman(result)
    return 0
  }

  if (opt.action === 'ban') {
    const { ips, ignored } = collectBanIps(opt)
    if (!ips.length) {
      console.error('--ban/--ban-file 未解析到任何合法 IPv4')
      return 2
    }
    if (opt.apply && !isElevated()) {
      console.error('未判定: 当前进程不是管理员，--ban --apply 需要管理员权限')
      return 2
    }
    const now = Date.now()
    const decisions = ips.map((ip) => ({
      ip,
      action: 'ban',
      hits: 1,
      score: 100,
      detections: ['manual-list'],
      kinds: { manual: 1 },
      expiresAt: new Date(now + opt.ttlHours * 3600_000).toISOString(),
      rebanCount: 0,
    }))
    const r = applyDecisions(decisions, state, { dryRun: !opt.apply, now })
    const result = {
      action: 'ban',
      dryRun: !opt.apply,
      requested: ips.length,
      ttlHours: opt.ttlHours,
      applied: r.applied,
      held: r.held,
      failed: r.failed,
      ignored,
    }
    if (opt.json) console.log(JSON.stringify(result, null, 2))
    else {
      console.log(`${opt.apply ? '' : '[dry-run] '}批量封禁 ${ips.length} 个 IP，TTL ${opt.ttlHours}h`)
      if (ignored.length) console.log(`  忽略非 IP ${ignored.length} 项: ${ignored.slice(0, 5).join(' ')}`)
      for (const h of r.held) console.log(`  ⚠ 跳过 ${h.ip}: ${h.reason}`)
      for (const f of r.failed) console.log(`  ✗ 失败 ${f.ip}: ${f.error}`)
      console.log(`  落地 ${r.applied.filter((a) => a.applied).length} / ${r.applied.length}`)
    }
    return r.failed.length ? 1 : 0
  }

  if (opt.action === 'unban') {
    if (!opt.ip) {
      console.error('--unban 需要 IP')
      return 2
    }
    if (!opt.apply) console.log(`[dry-run] 将解封 ${opt.ip}(加 --apply 执行)`)
    const r = unban(state, opt.ip, { dryRun: !opt.apply })
    console.log(JSON.stringify({ action: 'unban', ip: opt.ip, existed: r.existed, applied: opt.apply }, null, 2))
    return 0
  }

  if (opt.action === 'prune') {
    if (opt.apply && !isElevated()) {
      console.error('未判定: 当前进程不是管理员,--prune --apply 需要管理员权限')
      return 2
    }
    const r = pruneExpired(state, { dryRun: !opt.apply })
    console.log(JSON.stringify({ action: 'prune', removed: r.removed, applied: opt.apply }, null, 2))
    return 0
  }

  // scan(默认)
  const now = Date.now()
  const { events, unjudged } = await collectEvents({ routerLog: opt.routerLog, huorongDb: opt.huorongDb })
  const policy = { ...SECURITY_POLICY, windowHours: opt.windowHours }
  const { aggregates, stats } = scoreEvents(events, { policy, extraWhitelist: state.allowlist })
  const decisions = decideBans(aggregates, state.entries, { policy })

  let applied = []
  let failed = []
  let held = []
  let subnetApplied = []
  let subnetPlan = null
  // 段候选在 dry-run 也要算出来给人看(落地与否由 --apply 决定)
  const subnetClusters = opt.escalateSubnets ? clusterSubnets(aggregates) : []
  if (opt.escalateSubnets) {
    const plan = planSubnetEscalation(subnetClusters, {
      entries: state.entries,
      allowlist: state.allowlist,
      infra: [...infraIps()],
    })
    subnetPlan = { ...plan, dryRun: !opt.apply }
  }
  if (opt.apply) {
    if (!isElevated()) {
      console.error('未判定: 当前进程不是管理员,--apply 无法写防火墙(以管理员身份运行或由计划任务以 SYSTEM 运行)')
      if (opt.json) console.log(JSON.stringify({ ok: false, unjudged, decisions }, null, 2))
      return 2
    }
    const r = applyDecisions(decisions, state, { dryRun: false })
    applied = r.applied
    failed = r.failed
    held = r.held ?? []
    for (const h of held) console.log(`  ⊘ 拒绝封禁 ${h.ip}: 本机基础设施地址(封了会断服)`)
    const pruned = pruneExpired({ ...r.state, path: opt.statePath }, { dryRun: false })
    if (pruned.removed.length) console.log(`到期解封: ${pruned.removed.join(', ')}`)

    // 段级升级:同 /24 多个独立 IP 都有证据才封段。默认不做,必须显式开启。
    if (opt.escalateSubnets) {
      const plan = planSubnetEscalation(subnetClusters, {
        entries: r.state.entries,
        allowlist: state.allowlist,
        infra: [...infraIps()],
      })
      const next = { ...r.state, entries: { ...r.state.entries }, updatedAt: new Date().toISOString() }
      subnetApplied = []
      for (const cidr of plan.approve) {
        const c = subnetClusters.find((x) => x.cidr === cidr)
        const nowIso = new Date().toISOString()
        try {
          addBlockRule(cidr)
          next.entries[cidr] = {
            ip: cidr,
            scope: 'subnet',
            firstSeen: nowIso,
            lastSeen: nowIso,
            hits: c?.hits ?? 0,
            score: 0,
            detections: ['subnet-cluster'],
            kinds: { subnet: c?.ips.length ?? 0 },
            bannedAt: nowIso,
            expiresAt: new Date(now + ENTITY_POLICY.subnetTtlHours * 3600_000).toISOString(),
            rebanCount: 0,
            ruleName: ruleNameFor(cidr),
            applied: true,
          }
          subnetApplied.push({ cidr, ips: c?.ips ?? [], hits: c?.hits ?? 0, expiresAt: next.entries[cidr].expiresAt })
        } catch (err) {
          failed.push({ ip: cidr, error: String(err?.message ?? err) })
        }
      }
      saveState(opt.statePath, next)
      subnetPlan = { approve: plan.approve, reject: plan.reject, held: plan.held }
    }
  }

  const result = {
    ok: failed.length === 0,
    action: 'scan',
    appliedMode: opt.apply,
    windowHours: opt.windowHours,
    stats,
    unjudged,
    aggregates: aggregates.slice(0, 20),
    decisions,
    applied,
    failed,
    held,
    subnets: subnetPlan,
    subnetApplied,
    statePath: opt.statePath,
  }
  if (opt.json) console.log(JSON.stringify(result, null, 2))
  else printHuman(result)

  if (failed.length) return 3
  const hasBan = decisions.some((d) => d.action === 'ban')
  if (hasBan && !opt.apply) return 1
  if (unjudged.length === 2 && stats.total === 0) return 2
  return 0
}

/**
 * 告知入链(2026-11-24 三轮):与封禁**同频**跑(每 10 分钟)。
 *
 * 为什么挂这里、不新建计划任务:新脚本在无界面 SYSTEM 会话里会被 HIPS 拦成
 * "永久运行中"(见 README 的 HIPS 段),挂在已受信任的父进程下才是稳的 ——
 * 与 attack-attribution 派发 host-triage / posture 是同一个理由。
 *
 * 为什么只在 --apply 档派发:干跑和查状态不该产生"写证据链"这种副作用。
 * 顺带把"已封入证据链"的最坏延迟从 24 小时压到 10 分钟 —— 这句话写在对外文案里,
 * 时效就该对得上,不能让对手隔天才入链。
 */
function dispatchNoticeIntake() {
  const t0 = Date.now()
  const r = spawnSync(process.execPath, [join(HERE, 'notice-intake.mjs'), '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 60_000,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 1 << 24,
  })
  const rec = {
    ts: new Date().toISOString(),
    name: 'notice-intake',
    code: r.status ?? (r.error ? 2 : 0),
    ms: Date.now() - t0,
    error: r.error ? String(r.error.message) : null,
    tail: String(r.stdout ?? '').trim().split(/\r?\n/).slice(-1).join(' | '),
  }
  try {
    appendFileSync(join(ROOT, '.ihui-agent', 'state', 'downstream-dispatch.jsonl'), `${JSON.stringify(rec)}\n`, 'utf8')
  } catch {
    /* 留痕失败不影响主流程 */
  }
}

/**
 * 生产一致性哨兵派发(2026-11-25 立,治 2026-11-24 的静默回滚)。
 *
 * 为什么挂在 autoban 而不是新开计划任务:本机新建独立 SYSTEM 任务跑新脚本会永久卡
 * 「运行中」(HIPS 未学习、无界面无法放行)。autoban tick 已是受信任父进程串行派发的入口。
 *
 * 为什么带 `--alert`:只有 drift 才发信(--alert 内部先判状态),身份走
 * `prod-parity-drift` + 4h 窗口 —— 每 10 分钟一次 tick 不会把收件人刷爆。
 */
function dispatchProdParity() {
  const t0 = Date.now()
  const r = spawnSync(process.execPath, [join(HERE, 'check-prod-parity.mjs'), '--json', '--alert'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 120_000,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 1 << 24,
  })
  let state = 'undetermined'
  let reason = ''
  try {
    const last = String(r.stdout ?? '').trim().split(/\r?\n/).filter(Boolean).pop()
    const parsed = JSON.parse(last)
    state = parsed.state ?? 'undetermined'
    reason = parsed.reason ?? ''
  } catch {
    /* 解析不出来就按未判定记,不当绿 */
  }
  const rec = {
    ts: new Date().toISOString(),
    name: 'prod-parity',
    code: r.status ?? (r.error ? 2 : 0),
    ms: Date.now() - t0,
    state,
    reason,
    error: r.error ? String(r.error.message) : null,
  }
  try {
    appendFileSync(join(ROOT, '.ihui-agent', 'state', 'downstream-dispatch.jsonl'), `${JSON.stringify(rec)}\n`, 'utf8')
  } catch {
    /* 留痕失败不影响主流程 */
  }
}

/**
 * 证据链外锚派发(2026-11-25 立)。
 *
 * 为什么也挂在这里:锚是**节律**动作(默认 60 分钟),而 tick 是 10 分钟一格 ——
 * 由 evidence-anchor.mjs 自己判"到没到点",这里只负责按时把它叫醒。
 * 未到点返回 rc=0 且末行是"跳过",台账照记一行,运维能看见节流确实在工作。
 */
function dispatchEvidenceAnchor() {
  const t0 = Date.now()
  const r = spawnSync(process.execPath, [join(HERE, 'evidence-anchor.mjs')], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 150_000,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 1 << 24,
  })
  const rec = {
    ts: new Date().toISOString(),
    name: 'evidence-anchor',
    code: r.status ?? (r.error ? 2 : 0),
    ms: Date.now() - t0,
    error: r.error ? String(r.error.message) : null,
    tail: String(r.stdout ?? '').trim().split(/\r?\n/).slice(-1).join(' | '),
  }
  try {
    appendFileSync(join(ROOT, '.ihui-agent', 'state', 'downstream-dispatch.jsonl'), `${JSON.stringify(rec)}\n`, 'utf8')
  } catch {
    /* 留痕失败不影响主流程 */
  }
}

/**
 * 证据链对账派发(2026-11-25 立)。
 *
 * 为什么单列一格:`evidence-anchor` 只负责"到点就锚",它不回答"链还是不是外面看到的那条"。
 * 对账要每 10 分钟问一次 —— 链被截断/改写、锚停摆(锚龄超节律 2 倍)、锚严重落后(链远超已锚),
 * 任一都要有人知道。非 ok 时 --alert 走唯一邮件出口,身份是 evidence-audit-<state>(稳定语义,
 * 不拼时刻与条数),4h 窗口。
 */
function dispatchEvidenceAudit() {
  const t0 = Date.now()
  const r = spawnSync(process.execPath, [join(HERE, 'evidence-audit.mjs'), '--alert'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 150_000,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 1 << 24,
  })
  let state = 'undetermined'
  let lag = null
  let ageMin = null
  let alerted = false
  try {
    const parsed = JSON.parse(String(r.stdout ?? '').trim())
    state = parsed.state ?? 'undetermined'
    lag = parsed.lag ?? null
    ageMin = parsed.ageMin ?? null
    alerted = Boolean(parsed.alerted)
  } catch {
    /* 解析不出来按未判定记,不当绿 */
  }
  const rec = {
    ts: new Date().toISOString(),
    name: 'evidence-audit',
    code: r.status ?? (r.error ? 2 : 0),
    ms: Date.now() - t0,
    state,
    lag,
    ageMin,
    alerted,
    error: r.error ? String(r.error.message) : null,
  }
  try {
    appendFileSync(join(ROOT, '.ihui-agent', 'state', 'downstream-dispatch.jsonl'), `${JSON.stringify(rec)}\n`, 'utf8')
  } catch {
    /* 留痕失败不影响主流程 */
  }
}

/**
 * 主机侧实时检测派发(2026-11-25 立)。
 *
 * 为什么挂这里:`host-triage` 三查要人去跑,webshell 落地到被发现之间是空的。
 * 这里把它变成 10 分钟一格的节律动作 —— 指纹去重与告警节律都在 host-watch 自己身上,
 * 本函数只负责按时叫醒、并把结论留痕。
 */
function dispatchHostWatch() {
  const t0 = Date.now()
  const r = spawnSync(process.execPath, [join(HERE, 'host-watch.mjs'), '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 300_000,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 1 << 24,
  })
  let state = 'undetermined'
  let newCount = 0
  try {
    const last = String(r.stdout ?? '').trim().split(/\r?\n/).filter(Boolean).pop()
    const parsed = JSON.parse(last)
    state = parsed.state ?? 'undetermined'
    newCount = Number(parsed.newCount ?? 0)
  } catch {
    /* 解析不出来就按未判定记 */
  }
  const rec = {
    ts: new Date().toISOString(),
    name: 'host-watch',
    code: r.status ?? (r.error ? 2 : 0),
    ms: Date.now() - t0,
    state,
    newCount,
    error: r.error ? String(r.error.message) : null,
  }
  try {
    appendFileSync(join(ROOT, '.ihui-agent', 'state', 'downstream-dispatch.jsonl'), `${JSON.stringify(rec)}\n`, 'utf8')
  } catch {
    /* 留痕失败不影响主流程 */
  }
}

/**
 * 边缘层派发(2026-11-25 立)。
 *
 * 把本机在册封禁推到 EdgeOne 的 IP 黑白名单:被 drop 的 IP 在边缘直接丢包,
 * 不再消耗源站连接与日志。名单每轮全量重建,过期条目自动从边缘消失。
 * 同步器自带写后复核与回滚,本函数只负责按时叫醒并把结论留痕。
 *
 * 注意:同步器的 stdout 是**一个完整 JSON 对象**(多行 pretty),不是"最后一行 JSON",
 * 所以这里整段解析 —— 照抄别的 dispatcher 的 split('\n').pop() 会永远落 undetermined。
 */
function dispatchEdgeSync() {
  const t0 = Date.now()
  const r = spawnSync(process.execPath, [join(HERE, 'sync-edge-blocklist.mjs'), '--apply'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 300_000,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 1 << 24,
  })
  let state = 'undetermined'
  let targets = 0
  let ruleCount = null
  let addedCount = 0
  try {
    const parsed = JSON.parse(String(r.stdout ?? '').trim())
    state = parsed.state ?? 'undetermined'
    targets = Number(parsed.targets ?? 0)
    ruleCount = parsed.ruleCount ?? parsed.plannedRules ?? null
    addedCount = Array.isArray(parsed.added) ? parsed.added.length : 0
  } catch {
    /* 输出解析不出来就按未判定记,不猜结论 */
  }
  const rec = {
    ts: new Date().toISOString(),
    name: 'edge-blocklist-sync',
    code: r.status ?? (r.error ? 2 : 0),
    ms: Date.now() - t0,
    state,
    targets,
    ruleCount,
    added: addedCount,
    error: r.error ? String(r.error.message) : null,
  }
  try {
    appendFileSync(join(ROOT, '.ihui-agent', 'state', 'downstream-dispatch.jsonl'), `${JSON.stringify(rec)}\n`, 'utf8')
  } catch {
    /* 留痕失败不影响主流程 */
  }
}

// 第二条外锚腿(2026-11-25 立):RFC 3161 时间戳。邮件锚的凭据躺在本机 .env 里,
// 本机失陷后能被借去发假锚信;TSA 的私钥在第三方手里,本机伪造不了 —— 两条腿互不依赖。
function dispatchEvidenceTsa() {
  const t0 = Date.now()
  const r = spawnSync(process.execPath, [join(HERE, 'evidence-tsa.mjs')], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 150_000,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 1 << 24,
  })
  let state = 'undetermined'
  let count = null
  let tsaTime = null
  try {
    const text = String(r.stdout ?? '').trim()
    // 人读行:✅/❌/❔ 开头;skip 会是 JSON。两种都认,但只从可判定的形态里取数。
    if (text.startsWith('{')) {
      const parsed = JSON.parse(text)
      state = parsed.state ?? 'undetermined'
      count = parsed.count ?? null
    } else {
      const m = text.match(/^([✅❌❔])\s+\[evidence-tsa\]\s+count=(\d+).*?tsaTime=([^·]+)/)
      if (m) {
        state = m[1] === '✅' ? 'ok' : m[1] === '❌' ? 'failed' : 'undetermined'
        count = Number(m[2])
        tsaTime = m[3].trim()
      }
    }
  } catch {
    /* 解析不出来按未判定记,不猜结论 */
  }
  const rec = {
    ts: new Date().toISOString(),
    name: 'evidence-tsa',
    code: r.status ?? (r.error ? 2 : 0),
    ms: Date.now() - t0,
    state,
    count,
    tsaTime,
    error: r.error ? String(r.error.message) : null,
  }
  try {
    appendFileSync(join(ROOT, '.ihui-agent', 'state', 'downstream-dispatch.jsonl'), `${JSON.stringify(rec)}\n`, 'utf8')
  } catch {
    /* 留痕失败不影响主流程 */
  }
}

// 封禁双腿对账(2026-11-25 立):本机防火墙与 EO 边缘名单,两边都在才叫"封住了"。
// 不自己抢着推 —— 只读两面实际,发现不一致就报,修复留给各自的同步器。
function dispatchBanParity() {
  const t0 = Date.now()
  const r = spawnSync(process.execPath, [join(HERE, 'check-ban-parity.mjs'), '--json', '--alert'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 180_000,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 1 << 24,
  })
  let state = 'undetermined'
  let reason = ''
  let want = 0
  try {
    const last = String(r.stdout ?? '').trim().split(/\r?\n/).filter(Boolean).pop()
    const parsed = JSON.parse(last)
    state = parsed.state ?? 'undetermined'
    reason = parsed.reason ?? ''
    want = Number(parsed.want ?? 0)
  } catch {
    /* 解析不出来按未判定记,不猜结论 */
  }
  const rec = {
    ts: new Date().toISOString(),
    name: 'ban-parity',
    code: r.status ?? (r.error ? 2 : 0),
    ms: Date.now() - t0,
    state,
    reason,
    want,
    error: r.error ? String(r.error.message) : null,
  }
  try {
    appendFileSync(join(ROOT, '.ihui-agent', 'state', 'downstream-dispatch.jsonl'), `${JSON.stringify(rec)}\n`, 'utf8')
  } catch {
    /* 留痕失败不影响主流程 */
  }
}

// 安全面自完整性(2026-11-25 立):仓库盘上 vs HEAD,守的是"防线自身的代码有没有被绕过 git 动过"。
// prod-parity 只守 8 件生产副本,而本机真跑的判据有 65 件 —— 其余的不盯,被改宽/摘掉都无声。
function dispatchSelfIntegrity() {
  const t0 = Date.now()
  const r = spawnSync(process.execPath, [join(HERE, 'check-self-integrity.mjs'), '--json', '--alert'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 180_000,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 1 << 24,
  })
  let state = 'undetermined'
  let reason = ''
  let total = 0
  let drifted = 0
  try {
    const last = String(r.stdout ?? '').trim().split(/\r?\n/).filter(Boolean).pop()
    const parsed = JSON.parse(last)
    state = parsed.state ?? 'undetermined'
    reason = parsed.reason ?? ''
    total = Number(parsed.total ?? 0)
    drifted = Array.isArray(parsed.drifted) ? parsed.drifted.length : 0
  } catch {
    /* 解析不出来按未判定记,不猜结论 */
  }
  const rec = {
    ts: new Date().toISOString(),
    name: 'self-integrity',
    code: r.status ?? (r.error ? 2 : 0),
    ms: Date.now() - t0,
    state,
    reason,
    total,
    drifted,
    error: r.error ? String(r.error.message) : null,
  }
  try {
    appendFileSync(join(ROOT, '.ihui-agent', 'state', 'downstream-dispatch.jsonl'), `${JSON.stringify(rec)}\n`, 'utf8')
  } catch {
    /* 留痕失败不影响主流程 */
  }
}

// 调度健康(2026-11-25 立):判的是"自动链本身还在不在跑",不是任何一条防线。
// 为什么必须单独存在:所有哨兵都住在 autoban 里,autoban 自己停摆时它们一起哑 ——
// 本段亲历过一次 1.5 小时停摆,Last Result 恒为 1,没有任何东西通知任何人,靠手动排查才发现。
function dispatchSchedulerHealth() {
  const t0 = Date.now()
  const r = spawnSync(process.execPath, [join(HERE, 'check-scheduler-health.mjs'), '--json', '--alert'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 240_000,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 << 20,
  })
  let state = 'undetermined'
  let reason = ''
  let total = 0
  let breaches = 0
  try {
    const last = String(r.stdout ?? '').trim().split(/\r?\n/).filter(Boolean).pop()
    const parsed = JSON.parse(last)
    state = parsed.state ?? 'undetermined'
    reason = parsed.reason ?? ''
    total = Number(parsed.total ?? 0)
    breaches = Array.isArray(parsed.breaches) ? parsed.breaches.length : 0
  } catch {
    /* 解析不出来按未判定记,不猜结论 */
  }
  const rec = {
    ts: new Date().toISOString(),
    name: 'scheduler-health',
    code: r.status ?? (r.error ? 2 : 0),
    ms: Date.now() - t0,
    state,
    reason,
    total,
    breaches,
    error: r.error ? String(r.error.message) : null,
  }
  try {
    appendFileSync(join(ROOT, '.ihui-agent', 'state', 'downstream-dispatch.jsonl'), `${JSON.stringify(rec)}\n`, 'utf8')
  } catch {
    /* 留痕失败不影响主流程 */
  }
}

// 入口存活(2026-11-25 立):判的是"服务还能不能应答",不是"进程还在不在"。
// nssm 的 AppExit[Default]=Restart 只覆盖「进程退出」;僵死(进程活着、端口仍 LISTENING、
// 但请求没人应答)它看不出来 —— 那种状态下服务是 SERVICE_RUNNING、Last Result 是 0,
// 而用户侧已经全站不可用。这种故障只有主动发请求才看得见。
function dispatchEndpointLiveness() {
  const t0 = Date.now()
  const r = spawnSync(process.execPath, [join(HERE, 'check-endpoint-liveness.mjs'), '--json', '--alert'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 90_000,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 1 << 24,
  })
  let state = 'undetermined'
  let reason = ''
  let total = 0
  let dead = 0
  let consecutiveFail = 0
  try {
    const last = String(r.stdout ?? '').trim().split(/\r?\n/).filter(Boolean).pop()
    const parsed = JSON.parse(last)
    state = parsed.state ?? 'undetermined'
    reason = parsed.reason ?? ''
    total = Number(parsed.total ?? 0)
    dead = Array.isArray(parsed.dead) ? parsed.dead.length : 0
    consecutiveFail = Number(parsed.consecutiveFail ?? 0)
  } catch {
    /* 解析不出来按未判定记,不猜结论 */
  }
  const rec = {
    ts: new Date().toISOString(),
    name: 'endpoint-liveness',
    code: r.status ?? (r.error ? 2 : 0),
    ms: Date.now() - t0,
    state,
    reason,
    total,
    dead,
    consecutiveFail,
    error: r.error ? String(r.error.message) : null,
  }
  try {
    appendFileSync(join(ROOT, '.ihui-agent', 'state', 'downstream-dispatch.jsonl'), `${JSON.stringify(rec)}\n`, 'utf8')
  } catch {
    /* 留痕失败不影响主流程 */
  }
}

// 账号与凭据面(2026-11-25 立):host-triage 的 persistence 只盯 run-key/service/task,
// 攻击者手里还有三条更安静的路一条都没被盯 —— 新建本地用户、把自己塞进 Administrators、
// 往 authorized_keys 加一条自己的公钥。三条的共同点:加进去之后系统一切正常,每条判据都还是绿的。
function dispatchAccountWatch() {
  const t0 = Date.now()
  const r = spawnSync(process.execPath, [join(HERE, 'account-watch.mjs'), '--json', '--alert'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 90_000,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 1 << 24,
  })
  let state = 'undetermined'
  let reason = ''
  let added = 0
  let removed = 0
  let totalCurrent = 0
  try {
    const last = String(r.stdout ?? '').trim().split(/\r?\n/).filter(Boolean).pop()
    const parsed = JSON.parse(last)
    state = parsed.state ?? 'undetermined'
    reason = parsed.reason ?? ''
    added = Array.isArray(parsed.addedAll) ? parsed.addedAll.length : 0
    removed = Array.isArray(parsed.removedAll) ? parsed.removedAll.length : 0
    totalCurrent = Number(parsed.totalCurrent ?? 0)
  } catch {
    /* 解析不出来按未判定记,不猜结论 */
  }
  const rec = {
    ts: new Date().toISOString(),
    name: 'account-watch',
    code: r.status ?? (r.error ? 2 : 0),
    ms: Date.now() - t0,
    state,
    reason,
    added,
    removed,
    totalCurrent,
    error: r.error ? String(r.error.message) : null,
  }
  try {
    appendFileSync(join(ROOT, '.ihui-agent', 'state', 'downstream-dispatch.jsonl'), `${JSON.stringify(rec)}\n`, 'utf8')
  } catch {
    /* 留痕失败不影响主流程 */
  }
}

// 服务与配置面(2026-11-25 立):账号面盯「谁能进来」,这一面盯「门本身有没有被改松」。
// 把 IHUI_EDGE_SECRET_MODE 从 enforce 改成 observe、把 WAF 关掉、把启动类型改成手动、
// 在 0.0.0.0 上多开一个监听端口 —— 四件事做完服务照常跑、原有判据照常全绿,但防线已换了一副样子。
function dispatchServiceBaseline() {
  const t0 = Date.now()
  const r = spawnSync(process.execPath, [join(HERE, 'check-service-baseline.mjs'), '--json', '--alert'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 180_000,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 1 << 24,
  })
  let state = 'undetermined'
  let reason = ''
  let added = 0
  let removed = 0
  let totalCurrent = 0
  try {
    const last = String(r.stdout ?? '').trim().split(/\r?\n/).filter(Boolean).pop()
    const parsed = JSON.parse(last)
    state = parsed.state ?? 'undetermined'
    reason = parsed.reason ?? ''
    added = Array.isArray(parsed.addedAll) ? parsed.addedAll.length : 0
    removed = Array.isArray(parsed.removedAll) ? parsed.removedAll.length : 0
    totalCurrent = Number(parsed.totalCurrent ?? 0)
  } catch {
    /* 解析不出来按未判定记,不猜结论 */
  }
  const rec = {
    ts: new Date().toISOString(),
    name: 'service-baseline',
    code: r.status ?? (r.error ? 2 : 0),
    ms: Date.now() - t0,
    state,
    reason,
    added,
    removed,
    totalCurrent,
    error: r.error ? String(r.error.message) : null,
  }
  try {
    appendFileSync(join(ROOT, '.ihui-agent', 'state', 'downstream-dispatch.jsonl'), `${JSON.stringify(rec)}\n`, 'utf8')
  } catch {
    /* 留痕失败不影响主流程 */
  }
}

// §22d 入口守卫:被 import(测试/其他脚本)时不得执行 main —— 这个脚本会落防火墙规则
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    .then((code) => {
      if (process.argv.includes('--apply')) {
        try {
          dispatchNoticeIntake()
        } catch {
          /* 入链失败不该改变封禁动作的退出码 */
        }
        try {
          dispatchProdParity()
        } catch {
          /* 哨兵失败不该改变封禁动作的退出码;它自己的留痕在 downstream-dispatch.jsonl */
        }
        try {
          dispatchEvidenceAnchor()
        } catch {
          /* 外锚失败同上:锚断一轮只影响下次锚的间隔,不是安全事件 */
        }
        try {
          // 第二条腿:与邮件锚互不依赖。邮件挂了它照跑,它挂了邮件照跑。
          dispatchEvidenceTsa()
        } catch {
          /* TSA 失败不改封禁退出码;token 是否取得在 downstream-dispatch.jsonl 与 evidence-tsa.jsonl */
        }
        try {
          dispatchEvidenceAudit()
        } catch {
          /* 对账失败不改封禁退出码;它的结论与是否发信都在 downstream-dispatch.jsonl */
        }
        try {
          dispatchHostWatch()
        } catch {
          /* 主机侧检测失败不改封禁退出码;它自己的结论在 downstream-dispatch.jsonl */
        }
        try {
          dispatchEdgeSync()
        } catch {
          /* 边缘同步失败同上:边缘漏一轮只是这轮少丢些包,源站防火墙仍在拦 */
        }
        try {
          dispatchBanParity()
        } catch {
          /* 对账失败不改封禁退出码;它的结论与是否发信都在 downstream-dispatch.jsonl 与 ban-parity.jsonl */
        }
        try {
          dispatchSelfIntegrity()
        } catch {
          /* 自完整性失败同上:结论在 downstream-dispatch.jsonl 与 self-integrity.jsonl */
        }
        try {
          dispatchSchedulerHealth()
        } catch {
          /* 调度健康失败同上:结论在 downstream-dispatch.jsonl 与 scheduler-health.jsonl */
        }
        try {
          dispatchEndpointLiveness()
        } catch {
          /* 入口存活失败同上:结论在 downstream-dispatch.jsonl 与 endpoint-liveness.jsonl */
        }
        try {
          dispatchAccountWatch()
        } catch {
          /* 账号面失败同上:结论在 downstream-dispatch.jsonl 与 account-drift.jsonl */
        }
        try {
          dispatchServiceBaseline()
        } catch {
          /* 配置面失败同上:结论在 downstream-dispatch.jsonl 与 service-drift.jsonl */
        }
      }
      process.exit(code)
    })
    .catch((err) => {
      console.error('FATAL:', err?.stack ?? err)
      process.exit(2)
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
