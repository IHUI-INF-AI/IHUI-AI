#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/* eslint-disable no-console -- 本工具是判据,机器行必须走 stdout */
/**
 * 守门 260 — 生产依赖 critical/high 必须为 0(2026-10-29 立)。
 *
 * 立因(机主令「强化所有,黑客一点都攻不进来」的收尾项):2026-10-29 全量审计实测
 * critical 28 / high 49,但**没有任何机读判据**——这 28 个全靠人读 docs/SECURITY.md §10.7,
 * 下一个人不会读。票族存在而源头空转,与 O65 第 0 期「派单白名单预留了依赖族却没人看」同型。
 *
 * 判据(只判两件,都不判存量):
 *   ① **生产可达**的 critical/high 必须全部被**未过期**的 waiver 覆盖 ⇒ 否则红。
 *      「生产可达」= pnpm audit 的 findings 里存在 `dev !== true` 的路径。这一维必须分开:
 *      Taro 构建链的 28 个 critical 威胁模型是「构建机被投毒」,与线上 RCE 是两件事;
 *      混为一谈的门会恒红,恒红门的唯一结局是被 `--no-verify` 连带废掉(§0.2/§12e)。
 *   ② waiver 必须「验过才免」且会到期(§0.7):缺 module/reason/expiresAt 之一即红,
 *      expiresAt 已过即红。豁免不是消红通道,是带到期日的债。
 *
 * 构建链(devOnly)存量**只报数**,一条不拦(§12e 差值棘轮只拦新增;这里连新增也不拦 ——
 * 加依赖时没人能选 Taro 的传递依赖,拦了只会逼人跳门)。
 *
 * 数据源与「未判定」纪律(§0.3):
 *   - 判据读**审计快照**(.ihui-agent/state/dep-audit-cache.json),不在提交链上跑网络审计
 *     (实测 `pnpm audit --registry` 6.8s,全量档可接受、每次提交不可接受);
 *   - 快照缺失 ⇒ exit 2 **未判定**(附 `--refresh` 命令),绝不写成「零漏洞」;
 *   - 快照超过 maxCacheAgeDays ⇒ 先自动刷新一次;刷新失败仍过期 ⇒ exit 2 未判定。
 *     **不把「没刷新」判成红**:那不是本次提交的错,判红只会制造恒红门。
 *
 * 用法:
 *   node scripts/check-prod-dep-advisories.mjs            # 完整判定(guardian 全量档)
 *   node scripts/check-prod-dep-advisories.mjs --staged   # 提交链档:只判政策文件形态
 *   node scripts/check-prod-dep-advisories.mjs --refresh  # 重新抓审计快照(需官方 registry 可达)
 *   node scripts/check-prod-dep-advisories.mjs --self-test
 *   node scripts/check-prod-dep-advisories.mjs --json     # 机读输出
 *
 * 退出码:0 = 绿(含「只报数」的构建链存量);1 = 红(生产未豁免 critical/high 或 waiver 形态坏);
 *         2 = 未判定(快照缺失/过期且刷新失败/政策读不到)。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

import { parseAudit } from './dep-advisory-radar.mjs'
// 取材面纪律(守门 118):政策文件是**仓库内容**,必须经统一取材层 ——
// 全量判 HEAD blob、--staged 判索引 blob、取不到即 exit 2,绝不回落另一个面(§0.4)。
// 审计快照(.ihui-agent/state/)是**运行时状态、不入库**,不在取材面内,按磁盘读。
import { catBatch, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const POLICY_REL = 'scripts/data/dep-audit-policy.json'
const CACHE_PATH = join(ROOT, '.ihui-agent', 'state', 'dep-audit-cache.json')
const DEFAULT_REGISTRY = 'https://registry.npmjs.org'
const DAY_MS = 24 * 60 * 60 * 1000
/** waiver 剩余不足这么多天 ⇒ 报 warn(不红):豁免快到期,该排期重验或升级了。 */
const WAIVER_WARN_DAYS = 30

const SEVERITY_RANK = Object.freeze({ critical: 4, high: 3, moderate: 2, low: 1, info: 0 })

const asText = (v) =>
  typeof v === 'string' ? v.trim() : v === null || v === undefined ? '' : String(v).trim()

// ============================================================================
// 纯函数区(判据全在这里,main 只做 I/O —— 便于单测钉死)
// ============================================================================

export class PolicyShapeError extends Error {}

/**
 * 校验政策文件形态。缺 severityFloor / waivers 不是数组 ⇒ throw(调用方判未判定)。
 * 单条 waiver 的形态问题**不 throw**,而是进 `malformed` 集合 —— 它是要判红的债,
 * 不是「读不到政策」,两者混了会让「有人写坏 waiver」变成未判定(反而逃过红)。
 */
export function parsePolicy(text) {
  let doc
  try {
    doc = JSON.parse(String(text ?? ''))
  } catch (e) {
    throw new PolicyShapeError(`政策 JSON 解析失败:${e?.message ?? e}`)
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    throw new PolicyShapeError('政策顶层不是对象')
  }
  const floor = Array.isArray(doc.severityFloor) ? doc.severityFloor.map((s) => asText(s).toLowerCase()) : null
  if (!floor || floor.length === 0) throw new PolicyShapeError('政策缺 severityFloor 数组')
  const unknown = floor.filter((s) => !(s in SEVERITY_RANK))
  if (unknown.length) throw new PolicyShapeError(`severityFloor 含未知档位:${unknown.join(',')}`)

  const rawWaivers = Array.isArray(doc.waivers) ? doc.waivers : null
  if (!rawWaivers) throw new PolicyShapeError('政策缺 waivers 数组')

  const waivers = []
  const malformed = []
  for (const [i, w] of rawWaivers.entries()) {
    const module = asText(w?.module)
    const reason = asText(w?.reason)
    const expiresAt = asText(w?.expiresAt)
    const missing = []
    if (!module) missing.push('module')
    if (!reason) missing.push('reason')
    if (!expiresAt) missing.push('expiresAt')
    // 三要素之外还要求 reason 有实质长度:一个字的「已知」「可接受」等于没写理由。
    if (reason && reason.length < 20) missing.push('reason(太短,需说明为何不可达)')
    if (missing.length) {
      malformed.push({ index: i, module: module || `#${i}`, missing })
      continue
    }
    const ts = Date.parse(expiresAt)
    if (!Number.isFinite(ts)) {
      malformed.push({ index: i, module, missing: ['expiresAt(不是可解析日期)'] })
      continue
    }
    waivers.push({ module, reason, expiresAt, expiresTs: ts, evidence: asText(w.evidence) })
  }

  const maxCacheAgeDays = Number(doc.maxCacheAgeDays)
  return {
    floor,
    maxCacheAgeDays: Number.isFinite(maxCacheAgeDays) && maxCacheAgeDays > 0 ? maxCacheAgeDays : 30,
    waivers,
    malformed,
  }
}

/** 解析缓存。形态坏 ⇒ throw(调用方判未判定)。 */
export function parseCache(text) {
  let doc
  try {
    doc = JSON.parse(String(text ?? ''))
  } catch (e) {
    throw new PolicyShapeError(`审计快照 JSON 解析失败:${e?.message ?? e}`)
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    throw new PolicyShapeError('审计快照顶层不是对象')
  }
  const fetchedTs = Date.parse(asText(doc.fetchedAt))
  if (!Number.isFinite(fetchedTs)) throw new PolicyShapeError('审计快照缺可解析的 fetchedAt')
  if (!Array.isArray(doc.rows)) throw new PolicyShapeError('审计快照缺 rows 数组')
  return { fetchedAt: asText(doc.fetchedAt), fetchedTs, rows: doc.rows, counts: doc.counts ?? null }
}

/**
 * 核心判定。
 *
 * @param {{rows: Array<{module:string,severity:string,devOnly:boolean,title?:string,patched?:string}>}} audit
 * @param {{floor:string[], waivers:Array, malformed:Array, maxCacheAgeDays:number}} policy
 * @param {{now?: number}} [opts]
 * @returns {{
 *   red: Array<{module:string,severity:string,title:string,patched:string,kind:'unwaived'|'expired-waiver'|'malformed-waiver'}>,
 *   waived: Array<{module:string,expiresAt:string,reason:string}>,
 *   devOnly: Array<{module:string,severity:string}>,
 *   devOnlyTotal: number,
 *   prodTotal: number
 * }}
 */
export function evaluateAudit(audit, policy, opts = {}) {
  const now = Number.isFinite(opts.now) ? opts.now : Date.now()
  const floorRank = Math.min(...policy.floor.map((s) => SEVERITY_RANK[s] ?? 0))
  const rows = Array.isArray(audit?.rows) ? audit.rows : []

  const red = []

  // ① waiver 形态坏 ⇒ 红。这不是「读不到」,是「有人写了不合格的豁免」。
  for (const m of policy.malformed) {
    red.push({
      module: m.module,
      severity: 'high',
      title: `waiver 形态不合格:缺 ${m.missing.join(' / ')}`,
      patched: '',
      kind: 'malformed-waiver',
    })
  }

  // ② waiver 过期 ⇒ 红。豁免必须会到期(§0.7),过期就是该还的债。
  const activeWaivers = new Map()
  const expiredModules = new Set()
  for (const w of policy.waivers) {
    if (w.expiresTs <= now) {
      expiredModules.add(w.module)
      red.push({
        module: w.module,
        severity: 'high',
        title: `waiver 已于 ${w.expiresAt} 到期,须重新验证或升级依赖`,
        patched: '',
        kind: 'expired-waiver',
      })
      continue
    }
    // 同 module 多枚 waiver 取到期最晚的那枚(否则先过期的会误报)
    const prev = activeWaivers.get(w.module)
    if (!prev || prev.expiresTs < w.expiresTs) activeWaivers.set(w.module, w)
  }

  // ③ 按 module 聚合:同一 module 多条通告取最高 severity,并记录是否生产可达。
  const byModule = new Map()
  for (const r of rows) {
    const module = asText(r?.module)
    if (!module) continue
    const rank = SEVERITY_RANK[asText(r?.severity).toLowerCase()] ?? 0
    const prev = byModule.get(module)
    const devOnly = r?.devOnly === true
    if (!prev) {
      byModule.set(module, { module, rank, devOnly, title: asText(r?.title), patched: asText(r?.patched) })
      continue
    }
    // 只要有一条 finding 是生产可达,这个 module 就算生产可达(保守方向)
    prev.devOnly = prev.devOnly && devOnly
    if (rank > prev.rank) {
      prev.rank = rank
      prev.title = asText(r?.title)
      prev.patched = asText(r?.patched)
    }
  }

  const devOnly = []
  let prodTotal = 0
  for (const m of byModule.values()) {
    if (m.rank < floorRank) continue
    if (m.devOnly) {
      devOnly.push({ module: m.module, severity: Object.keys(SEVERITY_RANK).find((k) => SEVERITY_RANK[k] === m.rank) })
      continue
    }
    prodTotal += 1
    const w = activeWaivers.get(m.module)
    if (w) continue // 已豁免(且未过期)
    // 该 module 的豁免刚被判过期 ⇒ 只报「过期」这一条。同一个根因报两次会让
    // 点名数虚高,也会让人以为「有两个包要处理」。
    if (expiredModules.has(m.module)) continue
    red.push({
      module: m.module,
      severity: Object.keys(SEVERITY_RANK).find((k) => SEVERITY_RANK[k] === m.rank),
      title: m.title,
      patched: m.patched,
      kind: 'unwaived',
    })
  }

  const waived = [...activeWaivers.values()]
    .filter((w) => byModule.has(w.module) && !byModule.get(w.module).devOnly)
    .map((w) => ({ module: w.module, expiresAt: w.expiresAt, reason: w.reason }))

  // ④ 临期提醒(不红):豁免快到期时必须有人被提醒,否则到期那天门突然红,而那时
  //    没人记得这枚豁免当初验的是什么 —— 「到期」本身不是错,「到期没人知道」才是。
  const warnMs = WAIVER_WARN_DAYS * DAY_MS
  const expiringSoon = [...activeWaivers.values()]
    .filter((w) => w.expiresTs > now && w.expiresTs - now <= warnMs)
    .map((w) => ({
      module: w.module,
      expiresAt: w.expiresAt,
      daysLeft: Math.max(0, Math.floor((w.expiresTs - now) / DAY_MS)),
    }))
    .sort((a, b) => a.daysLeft - b.daysLeft)

  devOnly.sort((a, b) => (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0) || a.module.localeCompare(b.module))
  red.sort((a, b) => (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0) || a.module.localeCompare(b.module))

  return { red, waived, devOnly, devOnlyTotal: devOnly.length, prodTotal, expiringSoon }
}

/** 政策文件形态自检(提交链档用:只判被改的政策文件本身)。 */
export function lintPolicy(policy, now = Date.now()) {
  const problems = []
  for (const m of policy.malformed) {
    problems.push(`${m.module}: 缺 ${m.missing.join(' / ')}`)
  }
  for (const w of policy.waivers) {
    if (w.expiresTs <= now) problems.push(`${w.module}: waiver 已于 ${w.expiresAt} 到期`)
  }
  return problems
}

// ============================================================================
// I/O 区
// ============================================================================

/**
 * 按面读政策文件。返回 {text, error}。
 *
 * 为什么必须按面:政策是**仓库内容**,它在 HEAD 面、索引面、磁盘面上可以各不相同。
 * 判"这次提交会不会带进一枚永不到期的豁免",必须判**索引面**(=本次提交真正携带的东西);
 * 判"当前生效的豁免清单",判 HEAD 面。取不到 ⇒ error(调用方 exit 2),不回落另一个面。
 */
function readPolicyText(face) {
  try {
    if (face === 'worktree') return { text: readWorktreeFile(ROOT, POLICY_REL), error: '' }
    // git rev 规格:索引面 = `:path`,HEAD 面 = `HEAD:path`(与门 238 的 faceSpec 同形;
    // 仓里没有共享实现,且 import 一个门脚本会触发它执行 —— 故这里内联两行,不引第二个真相源)。
    const spec = face === 'staged' ? `:${POLICY_REL}` : `HEAD:${POLICY_REL}`
    const m = catBatch(ROOT, [spec])
    return { text: m.get(spec) ?? null, error: '' }
  } catch (e) {
    return { text: null, error: `${face} 面取不到政策文件:${e?.message ?? e}` }
  }
}

function readPolicy(face) {
  const { text, error } = readPolicyText(face)
  if (error) throw new PolicyShapeError(error)
  if (text === null) throw new PolicyShapeError(`${face} 面没有 ${POLICY_REL}(尚未入库?)`)
  return parsePolicy(text)
}

function readCache() {
  if (!existsSync(CACHE_PATH)) return null
  return parseCache(readFileSync(CACHE_PATH, 'utf8'))
}

/** 抓审计快照。返回 {ok, cache?, error?}。 */
export function refreshCache({ registry = DEFAULT_REGISTRY, timeoutMs = 180_000 } = {}) {
  const isWin = process.platform === 'win32'
  const res = spawnSync(isWin ? 'pnpm.cmd' : 'pnpm', ['audit', '--json', '--registry', registry], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 64 * 1024 * 1024,
    shell: isWin,
    windowsHide: true,
  })
  const stdout = String(res.stdout ?? '')
  if (!stdout.trim()) {
    return { ok: false, error: `pnpm audit 无输出(exit=${res.status},${String(res.error?.message ?? '').slice(0, 120)})` }
  }
  let parsed
  try {
    parsed = parseAudit(stdout)
  } catch (e) {
    return { ok: false, error: `审计输出不可解析:${e?.message ?? e}` }
  }
  const cache = {
    fetchedAt: new Date().toISOString(),
    registry,
    counts: parsed.counts,
    rows: parsed.rows,
  }
  mkdirSync(dirname(CACHE_PATH), { recursive: true })
  writeFileSync(CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`, 'utf8')
  return { ok: true, cache }
}

const fmt = (list) => list.map((x) => `${x.module}[${x.severity}]`).join(', ')

function main(argv) {
  const json = argv.includes('--json')
  const now = Date.now()
  // --json 时人类可读行全部走 stderr,stdout 只留一行 JSON。
  // 混排会让调用方(guardian 派发点)把「脚本正常」读成「结论不可解析」——
  // 而「结论不可解析」按 §0.3 要记未判定,等于把一次成功的判定写成没判。
  const say = json ? (...a) => console.error(...a) : (...a) => console.log(...a)
  const emit = (verdict, payload = {}) => {
    if (!json) return
    console.log(JSON.stringify({ verdict, generatedAt: new Date(now).toISOString(), ...payload }))
  }

  if (argv.includes('--self-test')) {
    const failures = selfTest()
    if (failures.length) {
      console.error(`❌ 自检失败 ${failures.length} 项:`)
      for (const f of failures) console.error(`   · ${f}`)
      return 1
    }
    say('✅ 自检通过(判据方向锁 12 例)')
    return 0
  }

  if (argv.includes('--refresh')) {
    const r = refreshCache()
    if (!r.ok) {
      console.error(`⚠️ 刷新失败:${r.error}`)
      emit('unjudged', { why: `审计快照刷新失败:${r.error}` })
      say(`结论[undetermined] exit=2 [无法判定] 审计快照刷新失败 —— ${r.error}`)
      return 2
    }
    const c = r.cache.counts ?? {}
    emit('clean', { counts: c, fetchedAt: r.cache.fetchedAt, mode: 'refresh' })
    say(
      `✅ 审计快照已更新:${CACHE_PATH}(critical=${c.critical ?? 0} high=${c.high ?? 0} moderate=${c.moderate ?? 0} low=${c.low ?? 0})`,
    )
    say(`结论[clean] exit=0 快照刷新完成(fetchedAt=${r.cache.fetchedAt})`)
    return 0
  }

  // 取材面(§0.4):全量判 HEAD blob、--staged 判索引 blob、--worktree 仅人工取证。
  // 两面旗同给 ⇒ selectFace 返回 face=null,按用法错 exit 2,不猜。
  const { face, error: faceError } = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
  })
  if (!face) {
    emit('unjudged', { why: `取材面旗标冲突:${faceError}` })
    say(`结论[undetermined] exit=2 [无法判定] 取材面旗标冲突 —— ${faceError}`)
    return 2
  }

  let policy
  try {
    policy = readPolicy(face)
  } catch (e) {
    const why = `政策读不到(${face} 面):${e?.message ?? e}`
    emit('unjudged', { why })
    say(`结论[undetermined] exit=2 [无法判定] ${why}`)
    return 2
  }

  // 提交链档:只判「本次改动的政策文件」本身,不碰审计快照(不跑网络、不判存量)。
  if (argv.includes('--staged')) {
    const problems = lintPolicy(policy, now)
    if (problems.length) {
      emit('red', { mode: 'staged', problems })
      console.error('❌ 依赖豁免政策形态不合格:')
      for (const p of problems) console.error(`   · ${p}`)
      console.error('   修法:waiver 三要素(module/reason/expiresAt)齐全、reason 说明为何不可达、到期前重验。')
      say(`结论[red] exit=1 政策形态问题 ${problems.length} 条(点名:${problems.length} 项)`)
      return 1
    }
    emit('clean', { mode: 'staged', waivers: policy.waivers.length })
    say(`结论[clean] exit=0 政策形态合格(waiver ${policy.waivers.length} 枚,均未过期)`)
    return 0
  }

  // 完整档:读快照 → 过期则尝试刷新一次 → 仍不可用则未判定。
  let cache = null
  let cacheError = ''
  try {
    cache = readCache()
  } catch (e) {
    cacheError = e?.message ?? String(e)
  }

  const maxAgeMs = policy.maxCacheAgeDays * DAY_MS
  const ageMs = cache ? now - cache.fetchedTs : Infinity
  if (!cache || ageMs > maxAgeMs) {
    const why = !cache
      ? `快照缺失${cacheError ? `(${cacheError})` : ''}`
      : `快照已 ${Math.floor(ageMs / DAY_MS)} 天未更新(上限 ${policy.maxCacheAgeDays} 天)`
    const r = refreshCache()
    if (!r.ok) {
      emit('unjudged', { why: `${why};自动刷新失败:${r.error}` })
      console.error(`⚠️ ${why};自动刷新失败:${r.error}`)
      say(
        `结论[undetermined] exit=2 [无法判定] ${why}且刷新失败 —— 复现:node scripts/check-prod-dep-advisories.mjs --refresh`,
      )
      return 2
    }
    cache = r.cache
  }

  const result = evaluateAudit({ rows: cache.rows }, policy, { now })
  const verdict = result.red.length ? 'red' : result.expiringSoon.length ? 'warn' : 'clean'

  emit(verdict, {
    red: result.red,
    waived: result.waived,
    devOnlyTotal: result.devOnlyTotal,
    devOnlyTop: result.devOnly.slice(0, 10),
    expiringSoon: result.expiringSoon,
    cacheFetchedAt: cache.fetchedAt,
  })

  const head =
    `生产 critical/high 未豁免 ${result.red.length} 条` +
    ` | 已豁免 ${result.waived.length} 枚` +
    ` | 构建链存量 ${result.devOnlyTotal} 条(只报数,不拦)`

  if (result.red.length) {
    console.error('❌ 生产可达的 critical/high 必须为 0:')
    for (const r of result.red) {
      const tag = r.kind === 'unwaived' ? '未豁免' : r.kind === 'expired-waiver' ? '豁免过期' : '豁免形态坏'
      console.error(`   · ${r.module} [${r.severity}] ${tag}${r.title ? ` — ${r.title.slice(0, 90)}` : ''}`)
      if (r.patched) console.error(`     修复版:${r.patched}`)
    }
    console.error(
      '   修法:升级依赖到修复版;确属不可达的,在 scripts/data/dep-audit-policy.json 加 waiver\n' +
        '   (三要素 module/reason/expiresAt,reason 必须写清「为什么这个漏洞 API 不可达」,不接受「先免了再说」)。',
    )
    say(`结论[red] exit=1 ${head}(点名:${fmt(result.red)})`)
    return 1
  }

  if (result.waived.length) {
    for (const w of result.waived) {
      say(`   ⏳ 豁免 ${w.module} → ${w.expiresAt}(到期前必须重验)`)
    }
  }
  if (result.expiringSoon.length) {
    const soon = result.expiringSoon.map((w) => `${w.module}(${w.daysLeft}天)`).join(', ')
    say(`   ⏰ 临期提醒(不判红,${WAIVER_WARN_DAYS} 天内到期):${soon}`)
  }
  if (result.devOnlyTotal) {
    const top = result.devOnly.slice(0, 5).map((x) => `${x.module}[${x.severity}]`).join(', ')
    say(`   ℹ️ 构建链存量 ${result.devOnlyTotal} 条(威胁模型=构建机投毒,非线上):${top}${result.devOnlyTotal > 5 ? ' …' : ''}`)
  }
  say(`结论[clean] exit=0 ${head}(快照 ${cache.fetchedAt.slice(0, 10)})`)
  return 0
}

// ============================================================================
// 自检:方向锁 —— 每条正例配一条「看起来像但不该放过」的反例
// ============================================================================

function selfTest() {
  const failures = []
  const NOW = Date.parse('2026-10-29T00:00:00Z')
  const policy = {
    floor: ['critical', 'high'],
    maxCacheAgeDays: 30,
    malformed: [],
    waivers: [],
  }
  const row = (module, severity, devOnly = false) => ({ module, severity, devOnly, title: 't', patched: '>=1' })

  const cases = [
    [
      '生产 critical 无豁免 ⇒ 红',
      () => evaluateAudit({ rows: [row('bad', 'critical')] }, policy, { now: NOW }).red.length === 1,
    ],
    [
      '构建链 critical 无豁免 ⇒ 不红(只报数)',
      () => {
        const r = evaluateAudit({ rows: [row('build', 'critical', true)] }, policy, { now: NOW })
        return r.red.length === 0 && r.devOnlyTotal === 1
      },
    ],
    [
      'moderate 不进门(低于 floor)⇒ 不红',
      () => evaluateAudit({ rows: [row('meh', 'moderate')] }, policy, { now: NOW }).red.length === 0,
    ],
    [
      '同 module 既有 dev 又有 prod ⇒ 按生产可达算 ⇒ 红',
      () =>
        evaluateAudit({ rows: [row('mixed', 'high', true), row('mixed', 'high', false)] }, policy, {
          now: NOW,
        }).red.length === 1,
    ],
    [
      '有效 waiver ⇒ 不红且计入已豁免',
      () => {
        const p = { ...policy, waivers: [{ module: 'ok', reason: 'x'.repeat(30), expiresAt: '2027-01-01', expiresTs: Date.parse('2027-01-01') }] }
        const r = evaluateAudit({ rows: [row('ok', 'high')] }, p, { now: NOW })
        return r.red.length === 0 && r.waived.length === 1
      },
    ],
    [
      'waiver 过期 ⇒ 红(豁免必须会到期)',
      () => {
        const p = { ...policy, waivers: [{ module: 'old', reason: 'x'.repeat(30), expiresAt: '2026-01-01', expiresTs: Date.parse('2026-01-01') }] }
        return evaluateAudit({ rows: [row('old', 'high')] }, p, { now: NOW }).red.some((r) => r.kind === 'expired-waiver')
      },
    ],
    [
      'waiver 形态坏 ⇒ 红(不是未判定)',
      () => {
        const p = { ...policy, malformed: [{ index: 0, module: 'bad-w', missing: ['reason'] }] }
        return evaluateAudit({ rows: [] }, p, { now: NOW }).red.some((r) => r.kind === 'malformed-waiver')
      },
    ],
    [
      'waiver 覆盖 devOnly 的包 ⇒ 不计入已豁免(避免假绿)',
      () => {
        const p = { ...policy, waivers: [{ module: 'b', reason: 'x'.repeat(30), expiresAt: '2027-01-01', expiresTs: Date.parse('2027-01-01') }] }
        return evaluateAudit({ rows: [row('b', 'high', true)] }, p, { now: NOW }).waived.length === 0
      },
    ],
    [
      '空 rows ⇒ 绿(零漏洞是合法结论)',
      () => evaluateAudit({ rows: [] }, policy, { now: NOW }).red.length === 0,
    ],
    [
      'severity 未知 ⇒ 按 0 档处理,不进门',
      () => evaluateAudit({ rows: [row('weird', 'unknown-level')] }, policy, { now: NOW }).red.length === 0,
    ],
    [
      '政策缺 expiresAt ⇒ 进 malformed(不是静默放行)',
      () => {
        const p = parsePolicy(JSON.stringify({ severityFloor: ['high'], waivers: [{ module: 'a', reason: 'x'.repeat(30) }] }))
        return p.malformed.length === 1 && p.malformed[0].missing.includes('expiresAt')
      },
    ],
    [
      'reason 太短 ⇒ 进 malformed(一个字等于没写)',
      () => {
        const p = parsePolicy(JSON.stringify({ severityFloor: ['high'], waivers: [{ module: 'a', reason: '已知', expiresAt: '2027-01-01' }] }))
        return p.malformed.length === 1 && p.malformed[0].missing.some((m) => m.startsWith('reason'))
      },
    ],
  ]

  for (const [name, fn] of cases) {
    try {
      if (!fn()) failures.push(name)
    } catch (e) {
      failures.push(`${name}(抛异常:${e?.message ?? e})`)
    }
  }
  return failures
}

// 直接执行时才走 main(被 import 做单测时不执行)
const invokedDirectly =
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])
if (invokedDirectly) {
  process.exitCode = main(process.argv.slice(2))
}
