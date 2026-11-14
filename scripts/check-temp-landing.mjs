#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * 活 TEMP 落点回潮哨兵(warn / 告警档,刻意不接提交链)— 票 G-1058525 ①,2026-10-05 立。
 *
 * 立因:2026-10-04 那次把 HKCU TEMP 改到 `D:\tmp` 之后,2026-10-05 才拍板改回 `D:\DevEnv\Temp`。
 * 拍板、写回、备份都做了,**缺的是"漂回去没人喊"的那把尺子**:此前没有任何执行体问过
 * "这台机现在的 TEMP 是什么"。文档里那句"TEMP 已指向 X"不是证据(AGENTS §26:落点是第七类
 * 机器事实,只许现读),而当轮现读就是活的反例 —— 注册表已改对,活进程 `os.tmpdir()` 仍是旧值。
 *
 * 三条不可漂的写法:
 *  ① **两个读数绝不并桶**。注册表那一层是判据(match/drift/undetermined 三态);活进程那一层
 *     **只报数** —— 注册表改动只到达新开终端/宿主,已在跑的进程持旧值是既成事实且重启自愈,
 *     拿它判红就是挂一条当场没人能整改的判据(§12e 那条恒红门逼跳门的教训 + 盘根门 2026-10-03
 *     实测 27 封同因告警换来的"不能整改就别挂到人通道")。
 *  ② **未判定绝不记为通过**。注册表键读不到 / `reg` 派生失败 / 值缺失或为空 / 载荷解析不出该值
 *     ⇒ state='undetermined' 并写明原因;`--strict` 下不出合格证。
 *  ③ **落点字面量只在本表一处**:`config/temp-landing.json`。本脚本不抄一份路径,清扫根也不抄
 *     —— 直接 import `scrub-temp-fixtures.mjs::defaultRoots()`(两处各算一份"该扫哪些根"必漂移)。
 *
 * 旧落点探针(回潮的**行为证据**):注册表可以已改对而进程照旧往 `D:\tmp` 写,所以只看值会把
 * "还在写"读成"已修好"。探针 = `defaultRoots()` 里非批准的那些根,一级条目的 mtime 落在近窗内
 * 的计数;**>0 就点名,并写明清理归既有清扫器**(它已由 git-guardian 的 scrubTempFixtures()
 * 以 24h 档调度)。本门不新建任何删除路径(§5e-2:清理是代理的活,但动作归那把既有尺子)。
 *
 * 定级:warn/告警档,派生出面的唯一调度器 = `scripts/git-guardian.mjs` 健康轮次 `!CHECK_ONLY`
 * 巡检格(auditTempLanding())。判的是本机注册表 + 本机进程环境 = 机器状态 ⇒ 提交者结构上
 * 满足不了 ⇒ 进提交链就是每台每次被逼 `--no-verify`,连带废掉全部守门(§12e/§12f)。
 * 这条定级本身由 `scripts/tests/check-temp-landing.test.mjs` 的反向锁钉住。
 *
 * 用法:
 *   node scripts/check-temp-landing.mjs              # 报告档(恒 exit 0)
 *   node scripts/check-temp-landing.mjs --json       # 机器可读档(巡检消费)
 *   node scripts/check-temp-landing.mjs --strict     # 问责档(drift / 未判定 ⇒ exit 1)
 *   node scripts/check-temp-landing.mjs --self-test  # 自检(不碰注册表,构造面)
 * 测试通道:--config <file>(替身声明表)。
 */
import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { defaultRoots } from './scrub-temp-fixtures.mjs'
import { SCRATCH_DIR_NAME } from './lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..')
const CONFIG_REL = join('config', 'temp-landing.json')

function parseArgv(argv) {
  const out = { _: [] }
  const BOOLS = new Set(['self-test', 'strict', 'json'])
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2)
      if (BOOLS.has(key)) {
        out[key] = true
      } else {
        out[key] = argv[i + 1]
        i++
      }
    } else out._.push(argv[i])
  }
  return out
}

/**
 * 落点规范化,只用于**比较**,不用于输出(输出保留现读原样,否则"当前值"就被尺子改写过)。
 * 展开 `%VAR%`(HKCU 那三个值是 REG_EXPAND_SZ);统一分隔符;去尾分隔符;整体小写
 * (Windows 大小写不敏感 —— `d:\deventemp` 与 `D:\DevEnv\Temp` 是同一个落点,判成 drift 就是假红)。
 */
export function normalizeLanding(p, env = process.env) {
  if (p === null || p === undefined) return ''
  let s = String(p)
  s = s.replace(/%([A-Za-z_][A-Za-z0-9_]*)%/g, (m, name) => (env[name] === undefined ? m : String(env[name])))
  s = s.replace(/[\\/]/g, sep).replace(/\\{2,}/g, sep)
  // 去尾分隔符,但盘根那一种(`D:\`)必须留着 —— 把 `D:\` 削成 `D:` 会让两个不同的东西同名。
  if (s.length > 2 && s.endsWith(sep) && !s.endsWith(`:${sep}`)) s = s.slice(0, -1)
  return s.toLowerCase()
}

/** 纯函数:reg 输出 → { name: value }。按 tab/多空格分列,只认 ASCII 键名,非 ASCII 段不参与判定。 */
export function parseRegValues(text, names) {
  const out = {}
  const want = new Set(names.map((n) => String(n).toUpperCase()))
  const lines = String(text || '').split(/\r?\n/)
  for (const line of lines) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s+REG_[A-Z_]+\s+(.*)$/.exec(line)
    if (!m) continue
    const name = m[1].toUpperCase()
    if (!want.has(name)) continue
    out[name] = m[2].trim()
  }
  return out
}

/** REG_MULTI_SZ 形态的一整坨(如 Session Manager 的 Environment 值)按 \0 切开后取 NAME=data 对。 */
export function parseMultiSz(blob, names) {
  const out = {}
  const want = new Set(names.map((n) => String(n).toUpperCase()))
  for (const seg of String(blob || '').split(/\\0|\0|\u0000/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/.exec(seg)
    if (!m) continue
    if (!want.has(m[1].toUpperCase())) continue
    out[m[1].toUpperCase()] = m[2].trim()
  }
  return out
}

/**
 * 现读一层注册表。返回 { values, error, rc } —— **三条失效方向分开**:
 *   error='spawn:<msg>'  派生不起来(reg 不在 PATH / 被拦)  ⇒ 上层落 undetermined
 *   error='rc:<n>'       reg 报"找不到键/值"                ⇒ 上层落 undetermined(不是"没改")
 *   values={}            键能读但里面没有要找的值            ⇒ 上层落 undetermined(空不是通过)
 */
export function readRegistryTier(tier, { spawner = spawnSync } = {}) {
  const names = tier.values || []
  const key = tier.registryKey
  if (!key || !names.length) return { values: null, error: '表里该层缺 registryKey/values ⇒ 无法读' }
  const args = ['query', key]
  if (tier.registryValue) args.push('/v', tier.registryValue)
  let res
  try {
    res = spawner('reg', args, { encoding: 'buffer', windowsHide: true, timeout: 15000, stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (e) {
    return { values: null, error: `spawn:${String(e && e.message).replace(/\s+/g, ' ').slice(0, 140)}` }
  }
  if (!res || res.error) {
    return { values: null, error: `spawn:${String((res && res.error && (res.error.code || res.error.message)) || '未知派生错误')}` }
  }
  const text = Buffer.isBuffer(res.stdout) ? res.stdout.toString('latin1') : String(res.stdout || '')
  if (res.status !== 0) return { values: null, error: `rc:${res.status}(reg 报键/值不存在或不可读;载荷首行=${JSON.stringify(text.split(/\r?\n/)[0] || '').slice(0, 120)})` }
  if (tier.registryValue) {
    const m = new RegExp(`^\\s*${tier.registryValue}\\s+REG_[A-Z_]+\\s+([\\s\\S]*)$`, 'm').exec(text)
    if (!m) return { values: {}, error: null, note: `值 ${tier.registryValue} 在载荷里解析不出` }
    return { values: parseMultiSz(m[1], names), error: null }
  }
  return { values: parseRegValues(text, names), error: null }
}

/**
 * 判定一层(纯函数,三态永不并桶)。judged=false 的层也走同一函数,但 verdictOf() 不取它 ——
 * 这样"只报数"的层在载荷里仍带它自己的 state,读载荷的人看得见它到底量到了什么。
 */
export function judgeTier(tier, read) {
  const approved = tier.approved || []
  const base = { name: tier.name, label: tier.label || tier.name, judged: tier.judged !== false, approved }
  if (read.error) {
    return { ...base, state: 'undetermined', current: [], why: `注册表读不到:${read.error}(未判定 ≠ 已通过,也 ≠ 已漂)` }
  }
  const values = read.values
  if (!values || typeof values !== 'object') {
    return { ...base, state: 'undetermined', current: [], why: '注册表载荷不可解析 ⇒ 未判定' }
  }
  if (Array.isArray(read.note) ? read.note.length : read.note) {
    return { ...base, state: 'undetermined', current: [], why: `注册表读到了但拿不出要找的值(${read.note})⇒ 空值不记通过` }
  }
  const current = Object.entries(values).map(([name, value]) => ({ name, value }))
  if (!current.length) {
    return { ...base, state: 'undetermined', current: [], why: `键可读但里面没有 ${(tier.values || []).join('/')} 任何一个值 ⇒ 未判定(读不到不等于已改对)` }
  }
  const empty = current.filter((c) => !String(c.value || '').trim())
  if (empty.length) {
    return {
      ...base,
      state: 'undetermined',
      current,
      why: `值为空:${empty.map((e) => e.name).join(',')} ⇒ 未判定(空值会落回系统默认,不是"指向批准落点")`,
    }
  }
  const approvedKeys = new Set(approved.map((a) => normalizeLanding(a)))
  if (!approvedKeys.size) {
    return { ...base, state: 'undetermined', current, why: `本表该层没有 approved 声明 ⇒ 无尺子可判(不得当作"没有漂移")` }
  }
  const bad = current.filter((c) => !approvedKeys.has(normalizeLanding(c.value)))
  if (bad.length) {
    return {
      ...base,
      state: 'drift',
      current,
      why: `${bad.map((b) => `${b.name}=${b.value}`).join(';')} 不等于批准落点 ${JSON.stringify(approved)} ⇒ 回潮`,
    }
  }
  return { ...base, state: 'match', current, why: `${current.map((c) => c.name).join('/')} 均等于批准落点` }
}

/**
 * 活进程读数(只报数)。**这一层的任何不等都不进 verdict**:注册表改动只到新终端/宿主,
 * 老进程持旧值是既成事实且重启自愈。它的作用是让人看见"要重开哪些宿主才真生效"。
 */
export function liveProcessReadings({ env = process.env, tmp = tmpdir(), tiers = [], registryByKey = {} } = {}) {
  const interactive = tiers.find((t) => t.name === 'interactive-account')
  const names = (interactive && interactive.values) || ['TEMP', 'TMP', 'TMPDIR']
  const values = {}
  for (const n of names) values[n] = env[n] === undefined ? null : String(env[n])
  const osTmp = String(tmp)
  const approvedKeys = new Set(((interactive && interactive.approved) || []).map((a) => normalizeLanding(a)))
  const regValues = registryByKey[(interactive && interactive.registryKey) || ''] || {}
  const differsFromRegistry = names.some((n) => {
    const r = regValues[n]
    const e = values[n]
    if (r === undefined || e === undefined || e === null) return false
    return normalizeLanding(r) !== normalizeLanding(e)
  })
  const differsFromApproved =
    approvedKeys.size > 0 &&
    [...names.map((n) => values[n]), osTmp].filter((v) => typeof v === 'string' && v.trim()).some((v) => !approvedKeys.has(normalizeLanding(v)))
  return {
    graded: 'count-only(只报数,绝不据此判红)',
    values,
    osTmpdir: osTmp,
    differsFromRegistry,
    differsFromApproved,
    note: '活进程值 = 本判据进程继承到的那份环境;注册表改动只对新开终端/宿主生效,持旧值属既成事实、重启自愈 ⇒ 只报数。',
  }
}

/**
 * 旧落点写入探针(只报不删)。roots = defaultRoots() 现读派生(不在本脚本抄字面量),
 * 排除批准落点后逐个量一级条目 mtime。四个结局互斥且**都得留痕**:
 *   approved-skipped / absent / unreadable / quiet / writing(+truncated 标记)
 * "取不到"与"没有近期写入"绝不能同形 —— 那是本仓记过最多次的失效型(没跑 ≠ 跑过没候选)。
 */
export function probeRecentWrites({
  roots = [],
  approved = [],
  now = Date.now(),
  windowMs = 3600000,
  maxNames = 10,
  maxEntries = 20000,
  skipNames = [SCRATCH_DIR_NAME],
  readdir = (d) => readdirSync(d, { withFileTypes: true }),
  lstat = (p) => lstatSync(p),
  exists = (p) => existsSync(p),
} = {}) {
  const approvedKeys = new Set(approved.map((a) => normalizeLanding(a)))
  const declared = new Set((skipNames || []).filter(Boolean))
  const out = []
  for (const root of roots) {
    const key = normalizeLanding(root)
    if (approvedKeys.has(key)) {
      out.push({ root, state: 'approved-skipped', recent: 0, total: 0, why: '这是批准落点,写东西是它的本职' })
      continue
    }
    if (!exists(root)) {
      out.push({ root, state: 'absent', recent: 0, total: 0, why: '根不存在 ⇒ 该落点没被用(不记为"已清干净",只记为"这个根不在盘上")' })
      continue
    }
    let dirents
    try {
      dirents = readdir(root)
    } catch (e) {
      out.push({ root, state: 'unreadable', recent: null, total: null, why: `一级列不出来:${String(e && e.code ? e.code : e && e.message).slice(0, 100)} ⇒ 未判定,不得读成"没在写"` })
      continue
    }
    const recent = []
    let total = 0
    let truncated = false
    let statErrors = 0
    let skippedDeclared = 0
    for (const d of dirents) {
      if (total >= maxEntries) {
        truncated = true
        break
      }
      total++
      // 已声明的本项目夹具落点(名字来自 `lib/scratch-dir.mjs::SCRATCH_DIR_NAME`,不在此抄字面量):
      // 它是 §15b 外置夹具机制的常驻写入者,天天在被写。把"机制在跑"报成"回潮"就是那条
      // 2026-10-03 用 27 封同因告警换来的教训 —— 但**跳过必须计数留痕**,悄悄过滤等于少报。
      if (declared.has(d.name)) {
        skippedDeclared++
        continue
      }
      let st
      try {
        st = lstat(join(String(root), d.name))
      } catch {
        statErrors++
        continue
      }
      const t = Number(st.mtimeMs)
      if (!Number.isFinite(t)) {
        statErrors++
        continue
      }
      if (now - t <= windowMs) recent.push({ name: d.name, mtimeMs: t, kind: d.isDirectory() ? 'dir' : 'file' })
    }
    recent.sort((a, b) => b.mtimeMs - a.mtimeMs)
    out.push({
      root,
      state: recent.length ? 'writing' : 'quiet',
      recent: recent.length,
      total,
      statErrors,
      skippedDeclared,
      truncated,
      windowMs,
      names: recent.slice(0, maxNames).map((r) => ({ ...r, ageSeconds: Math.max(0, Math.round((now - r.mtimeMs) / 1000)) })),
    })
  }
  return out
}

/** verdict 只看 judged!==false 的层。undetermined 压过 drift(未判定不出合格证)。 */
export function verdictOf(tierResults) {
  const judged = (tierResults || []).filter((t) => t.judged)
  if (!judged.length) return 'undetermined'
  if (judged.some((t) => t.state === 'undetermined')) return 'undetermined'
  if (judged.some((t) => t.state === 'drift')) return 'drift'
  return 'green'
}

/** 探针计数四态(供巡检载荷用,不并桶)。 */
export function probeCounts(probes) {
  const c = { writing: 0, quiet: 0, absent: 0, unreadable: 0, approvedSkipped: 0, roots: (probes || []).length }
  for (const p of probes || []) {
    if (p.state === 'writing') c.writing++
    else if (p.state === 'quiet') c.quiet++
    else if (p.state === 'absent') c.absent++
    else if (p.state === 'unreadable') c.unreadable++
    else if (p.state === 'approved-skipped') c.approvedSkipped++
  }
  return c
}

function buildReport(conf, opts = {}) {
  const tiers = conf.tiers || []
  const reads = {}
  const results = tiers.map((tier) => {
    if (tier.deriveFrom) {
      return {
        name: tier.name,
        label: tier.label || tier.name,
        judged: false,
        state: 'derived',
        current: [],
        approved: [],
        why: `本层不落字面量,来源 = ${tier.deriveFrom}(抄进表就是两处算同一件事)`,
      }
    }
    const read = readRegistryTier(tier, opts)
    reads[tier.registryKey] = read.values || {}
    return judgeTier(tier, read)
  })
  const interactive = tiers.find((t) => t.name === 'interactive-account') || {}
  const approved = interactive.approved || []
  const derived = defaultRoots()
  const probes = probeRecentWrites({
    roots: derived.roots,
    approved,
    windowMs: Number((conf.recentWriteProbe && conf.recentWriteProbe.windowMs) || 3600000),
    maxNames: Number((conf.recentWriteProbe && conf.recentWriteProbe.maxNamesReported) || 10),
    maxEntries: Number((conf.recentWriteProbe && conf.recentWriteProbe.maxEntriesPerRoot) || 20000),
    now: opts.now || Date.now(),
    readdir: opts.readdir,
    lstat: opts.lstat,
    exists: opts.exists,
  })
  return {
    verdict: verdictOf(results),
    tiers: results,
    live: liveProcessReadings({ env: opts.env || process.env, tmp: opts.tmp || tmpdir(), tiers, registryByKey: reads }),
    scrubber: { roots: derived.roots, undetermined: derived.undetermined, ownedBy: 'scripts/scrub-temp-fixtures.mjs' },
    probes,
    counts: {
      judgedTiers: results.filter((t) => t.judged).length,
      reportOnlyTiers: results.filter((t) => !t.judged).length,
      drift: results.filter((t) => t.judged && t.state === 'drift').length,
      undetermined: results.filter((t) => t.judged && t.state === 'undetermined').length,
      ...probeCounts(probes),
    },
    grading: conf.grading || {},
  }
}

const ARMS = { match: '✅', drift: '🚨', undetermined: '⚠️', derived: 'ℹ️' }

function printHuman(r) {
  console.log('── 活 TEMP 落点回潮哨兵(warn 尺子,巡检档)──')
  for (const t of r.tiers) {
    const arm = `${ARMS[t.state] || 'ℹ️'} [${t.judged ? '判定' : '只报数'}] ${t.label}: ${t.state}`
    console.log(`  ${arm}`)
    console.log(`      ${t.why}`)
    if (t.current.length) console.log(`      当前值: ${t.current.map((c) => `${c.name}=${c.value}`).join(' | ')}`)
    if (t.approved && t.approved.length) console.log(`      批准值: ${t.approved.join(' | ')}(声明表 config/temp-landing.json)`)
  }
  const L = r.live
  console.log(`  ℹ️ [只报数] 活进程读数: ${Object.entries(L.values).map(([k, v]) => `${k}=${v === null ? '(未设)' : v}`).join(' | ')} | os.tmpdir()=${L.osTmpdir}`)
  console.log(`      ${L.note}`)
  console.log(`      与注册表不等: ${L.differsFromRegistry ? '是(既成事实,重启/新开宿主后自愈 ⇒ 不判红)' : '否'};与批准落点不等: ${L.differsFromApproved ? '是' : '否'}`)
  const winMin = Math.round(Number(((r.probes.find((x) => x.windowMs) || {}).windowMs || 3600000) / 60000))
  console.log(`  ── 旧落点写入探针(窗口 ${winMin} 分钟,只报不删)──`)
  for (const p of r.probes) {
    if (p.state === 'approved-skipped') {
      console.log(`      ⏭️ ${p.root} —— 批准落点,不探`)
      continue
    }
    if (p.state === 'writing') {
      console.log(`      🚨 ${p.root} —— 近窗内被写 ${p.recent} 个一级条目(共量 ${p.total}${p.truncated ? ',已截断' : ''}): ${p.names.map((n) => `${n.name}(${n.ageSeconds}s)`).join(', ')}`)
      continue
    }
    if (p.state === 'unreadable') {
      console.log(`      ⚠️ ${p.root} —— 未判定:${p.why}`)
      continue
    }
    if (p.state === 'absent') {
      console.log(`      · ${p.root} —— 根不存在`)
      continue
    }
    console.log(`      ✅ ${p.root} —— 近窗内无写入(量了 ${p.total}${p.truncated ? ',已截断' : ''}${p.statErrors ? `,${p.statErrors} 条取不到 mtime` : ''})`)
  }
  console.log(`      清理归既有清扫器 scripts/scrub-temp-fixtures.mjs(24h 档,由 git-guardian scrubTempFixtures() 调度);本门不删任何东西。`)
  const c = r.counts
  console.log(`\n读数:判定层 ${c.judgedTiers}(drift ${c.drift} / 未判定 ${c.undetermined})/ 只报数层 ${c.reportOnlyTiers}/ 旧落点在被写 ${c.writing}(共探 ${c.roots} 根:静默 ${c.quiet} / 不存在 ${c.absent} / 未判定 ${c.unreadable} / 批准跳过 ${c.approvedSkipped})`)
  console.log(`定级:${r.grading.tier || 'warn'};inCommitChain=${r.grading.inCommitChain === false ? 'false' : 'true'};问责:${r.grading.accountability || 'node scripts/check-temp-landing.mjs --strict'}`)
  console.log(`判定:${r.verdict}${r.verdict === 'undetermined' ? '(未判定不出合格证)' : ''}`)
}

export function selfTest() {
  const cases = []
  const t = (name, fn) => {
    try {
      fn()
      cases.push(`  ✅ ${name}`)
    } catch (e) {
      cases.push(`  ❌ ${name}\n      ${e.message}`)
      process.exitCode = 1
    }
  }
  const assert = (cond, msg) => {
    if (!cond) throw new Error(msg)
  }
  const tier = { name: 'interactive-account', label: 'x', registryKey: 'HKCU\\Environment', values: ['TEMP'], approved: ['D:\\DevEnv\\Temp'], judged: true }

  t('三态:等 ⇒ match', () => assert(judgeTier(tier, { values: { TEMP: 'D:\\DevEnv\\Temp' }, error: null }).state === 'match', '应 match'))
  t('三态:不等 ⇒ drift 且同时点名当前值与批准值', () => {
    const r = judgeTier(tier, { values: { TEMP: 'D:\\tmp' }, error: null })
    assert(r.state === 'drift', '应 drift')
    assert(/D:\\tmp/.test(r.why) && /DevEnv/.test(r.why), `drift 必须两边都点名:${r.why}`)
  })
  t('三态:派生失败 ⇒ undetermined,绝不记通过', () => {
    assert(judgeTier(tier, { values: null, error: 'spawn:ENOENT' }).state === 'undetermined', 'spawn 失败应未判定')
    assert(judgeTier(tier, { values: null, error: 'rc:1' }).state === 'undetermined', 'reg 报键不存在应未判定')
    assert(judgeTier(tier, { values: {}, error: null }).state === 'undetermined', '读不到该值应未判定')
    assert(judgeTier(tier, { values: { TEMP: '  ' }, error: null }).state === 'undetermined', '空值应未判定')
  })
  t('大小写/分隔符同义不构成 drift(假红比漏判更难查)', () => {
    assert(judgeTier(tier, { values: { TEMP: 'd:\\devenv\\temp\\' }, error: null }).state === 'match', '同义形态必须 match')
  })
  t('verdict:undetermined 压过 drift;只报数层不参与', () => {
    assert(verdictOf([{ judged: true, state: 'drift' }, { judged: true, state: 'undetermined' }]) === 'undetermined', '未判定应压过 drift')
    assert(verdictOf([{ judged: false, state: 'undetermined' }]) === 'undetermined', '一条判定层都没有 ⇒ 不许读成绿')
    assert(verdictOf([{ judged: false, state: 'undetermined' }, { judged: true, state: 'match' }]) === 'green', '只报数层的未判定不得污染合格证')
  })
  t('探针:writing / quiet / absent / unreadable 四态不并桶', () => {
    const p = probeRecentWrites({
      roots: ['D:\\DevEnv\\Temp', 'Z:\\gone', 'R:\\denied'],
      approved: ['D:\\DevEnv\\Temp'],
      exists: (x) => x !== 'Z:\\gone',
      readdir: (x) => {
        if (x === 'R:\\denied') throw new Error('EPERM')
        return [{ name: 'a', isDirectory: () => false }]
      },
      lstat: () => ({ mtimeMs: Date.now() - 1000 }),
    })
    const by = Object.fromEntries(p.map((x) => [x.root, x.state]))
    assert(by['D:\\DevEnv\\Temp'] === 'approved-skipped', '批准落点应跳过')
    assert(by['Z:\\gone'] === 'absent', '不存在应 absent')
    assert(by['R:\\denied'] === 'unreadable', '列不出来必须未判定,不得读成 quiet')
  })
  t('探针:近窗外不计,近窗内点名并给龄', () => {
    const now = 1e12
    const p = probeRecentWrites({
      roots: ['X:\\old'],
      approved: [],
      now,
      windowMs: 60000,
      exists: () => true,
      readdir: () => [{ name: 'old', isDirectory: () => false }, { name: 'new', isDirectory: () => true }],
      lstat: (f) => ({ mtimeMs: String(f).endsWith('old') ? now - 10 * 60000 : now - 5000 }),
    })
    assert(p[0].state === 'writing' && p[0].recent === 1 && p[0].names[0].name === 'new', `应只点近期那一个:${JSON.stringify(p[0])}`)
  })
  t('截断必须留痕:超预算的根不许读成"量过了"', () => {
    const p = probeRecentWrites({
      roots: ['X:\\huge'],
      approved: [],
      maxEntries: 2,
      exists: () => true,
      readdir: () => Array.from({ length: 50 }, (_, i) => ({ name: `e${i}`, isDirectory: () => false })),
      lstat: () => ({ mtimeMs: Date.now() }),
    })
    assert(p[0].truncated === true && p[0].total === 2, `必须标截断:${JSON.stringify(p[0])}`)
  })
  t('REG_MULTI_SZ 与 %VAR% 展开:展开只用进程环境里的同名键,不拿被检对象当尺子', () => {
    const m = parseMultiSz('Path=C:\\x\\0TEMP=%SystemRoot%\\temp\\0TMP=D:\\DevEnv\\Temp', ['TEMP', 'TMP'])
    assert(m.TEMP === '%SystemRoot%\\temp' && m.TMP === 'D:\\DevEnv\\Temp', JSON.stringify(m))
    assert(normalizeLanding('%SystemRoot%\\temp', { SystemRoot: 'C:\\Windows' }) === 'c:\\windows\\temp', '展开失败')
    assert(normalizeLanding('D:\\') !== normalizeLanding('D:'), '盘根 `D:\\` 不许被削成 `D:`(两个不同对象同名 = 假绿)')
  })
  console.log(cases.join('\n'))
  console.log(`\n自检:pass ${cases.filter((c) => c.includes('✅')).length} / fail ${cases.filter((c) => c.includes('❌')).length}`)
}

async function main() {
  const argv = parseArgv(process.argv.slice(2))
  if (argv['self-test']) {
    selfTest()
    return
  }
  const configPath = resolve(argv.config ? argv.config : join(REPO_ROOT, CONFIG_REL))
  let conf
  try {
    conf = JSON.parse(readFileSync(configPath, 'utf8'))
  } catch (e) {
    console.error(`❌ 声明表读不到/解析失败:${configPath} —— ${String(e && e.message).slice(0, 140)}`)
    process.exitCode = 2
    return
  }
  if (!Array.isArray(conf.tiers) || !conf.tiers.length) {
    console.error('❌ 声明表缺 tiers ⇒ 无法判定(不出合格证)')
    process.exitCode = 2
    return
  }
  const report = buildReport(conf, { now: Date.now() })
  if (argv.json) {
    console.log(JSON.stringify({ ...report, configPath: configPath.replace(REPO_ROOT + sep, '') }))
    if (argv.strict && report.verdict !== 'green') process.exitCode = 1
    return
  }
  printHuman(report)
  if (argv.strict && report.verdict !== 'green') {
    console.error(`\n--strict:判定层为 ${report.verdict} ⇒ exit 1(问责档;未判定不出合格证)`)
    process.exitCode = 1
  }
}

/** §22c:镜像测试只从这里取常量,不在测试里另抄一份判据字面量。 */
export const __test__ = {
  REPO: REPO_ROOT,
  CONFIG_REL,
  normalizeLanding,
  parseRegValues,
  parseMultiSz,
  judgeTier,
  readRegistryTier,
  liveProcessReadings,
  probeRecentWrites,
  probeCounts,
  verdictOf,
  buildReport,
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((e) => {
    console.error('❌ 尺子自身异常:', e && e.message)
    process.exit(2)
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
