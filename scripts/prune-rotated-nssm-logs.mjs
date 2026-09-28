#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * nssm 轮转副本的保留策略量算仪(默认只读;`--apply` 才删)。
 *
 * 为什么需要它(2026-09-27 实测):给 ihui-loki / ihui-pg-exporter 配上 AppRotate* 之后,
 * nssm 会把写满的那份**改名**成带时间戳的副本(分双流时名字含 `-err-`/`-out-`,合写一份文件时不含)
 * 再起新文件 —— 它只封顶单文件体积,**一个都不删**。当时现读 `D:\DevEnv\logs` 已有 48 份这类副本、
 * 目录 1.19GB/385 文件,且没有任何一处有保留策略。"轮转配好了"读起来像这一维已收口,实际是把无界增长从
 * "单个文件无限大"换成"副本数无限多"—— 必须显式写出来。
 *
 * 判据全部抽成纯函数 `planPrune`,使"保留几份 / 什么算副本 / 大批量阀门"可在构造面上证明,
 * 不必靠真删生产日志来取证。
 *
 * 用法:
 *   node scripts/prune-rotated-nssm-logs.mjs                    # 只读:报每服务保留几份、可回收多少
 *   node scripts/prune-rotated-nssm-logs.mjs --keep 6 --apply    # 真删(每服务每流只留最新 N 份)
 *   node scripts/prune-rotated-nssm-logs.mjs --json
 *
 * 安全边界(任一条不成立就不删,而不是删了再解释):
 *  ① 认两种**已轮转**的名字形态:`svc-<名>-nssm-<err|out>-<时间戳>.log` 与
 *     `svc-<名>-nssm-<时间戳>.log`(后者是 nssm 在 stdout/stderr 指向同一个文件时产出的形态,
 *     没有流段)。正在写的那份(名字里没有时间戳)两种都永不进候选。
 *     ⚠ 2026-09-27 实测:旧判据只认带流段那一种,于是 `D:\DevEnv\logs` 里 164 份 / 1,004MB
 *     (svc-api 97 份 734MB、svc-ai 27 份 270MB,另 prometheus/rsshub 各 20 份)整族隐身,
 *     而工具打印的是"可回收候选 20 份 / 0.1 MB" —— 一份诚实却只量了一小层的报告,
 *     比没有报告更糟,因为它替人做出"这一维已经收口了"的判断。
 *  ② 刚轮转下来的文件可能仍被句柄占着 ⇒ mtime 距今不足 1 小时的一律跳过。
 *  ③ 大批量阀门:单次 >40 份或 >512MB 时 `--apply` 拒绝执行(需要 `--allow-mass`),
 *     与归档器 `archive-completed-tasks.mjs` 的"大批量只挡自动档"是同一条设计。
 *  ④ 射程锁死在 logs 目录本身:路径解析后不在该目录内的候选一律剔除(防符号链接/junction 穿透,
 *     §26 记过"递归删除顺着 junction 把 D 盘真实目标清空"的事故)。
 */
import { readdirSync, statSync, lstatSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
// §15b 外置根唯一出口:盘根由它推导,本文件不再自己截盘符首字符。
import { devEnvRoot } from './seal-c-root-stray.mjs'

const LOGS_DIR = join(devEnvRoot(), 'logs')

// 流段可选:带 `-err-`/`-out-` 的是分双流配置,不带的是 stdout/stderr 合写一份文件的配置。
// 时间戳仍是必需的那一格 —— 它才是"已轮转"的唯一凭据,活文件名里没有它。
const ROTATED_RE = /^svc-(.+)-nssm-(?:(err|out)-)?(\d{8}T\d{6}(?:\.\d{1,3})?)\.log$/
const MIN_AGE_MS = 60 * 60 * 1000
const MASS_FILES = 40
const MASS_BYTES = 512 * 1024 * 1024

/**
 * 纯函数:给一份目录清单,算出"留哪些、删哪些、为什么没删"。
 * entries: [{name, size, mtimeMs}]  —— 由调用方从磁盘取,便于用构造面证明判据。
 * 三态绝不并桶:candidate(可删)/ kept(保留)/ skipped 各带原因,report 里分别计数。
 */
export function planPrune(entries, opts = {}) {
  // 边界校验留在命令行(main 拒绝 --keep 0);纯函数接受 0 —— 否则"留 0 份"这一格在构造面上
  // 表达不出来,年龄跳过/大批量阀门这些分支就只能靠间接推断证明,而自检会静默失去牙齿。
  const keep = Number.isInteger(opts.keep) && opts.keep >= 0 ? opts.keep : 10
  const nowMs = typeof opts.nowMs === 'number' ? opts.nowMs : Date.now()
  const minAgeMs = typeof opts.minAgeMs === 'number' ? opts.minAgeMs : MIN_AGE_MS
  const allowMass = Boolean(opts.allowMass)
  const groups = new Map()
  const notRotated = []
  for (const e of entries) {
    const m = ROTATED_RE.exec(e.name)
    if (!m) {
      notRotated.push(e.name)
      continue
    }
    // 分组键是"服务 + 流"两个维度 —— 只按服务分会把 err 的份数额度让 out 占掉,
    // 于是查故障时最需要的那几份先被删了。合写一份文件的服务没有流段,归到 'log' 档,
    // 不得与同服务的 err/out 组共用额度(否则合写型会把分流型的保留名额吃光)。
    const key = `${m[1]}|${m[2] || 'log'}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(e)
  }
  const candidate = []
  const kept = []
  const skipped = []
  for (const [key, list] of groups) {
    // 时间戳文件名 + mtime 双键排序:同一秒轮转两份时按名字定序,保证幂等(结果不随输入顺序变)
    list.sort((a, b) => b.mtimeMs - a.mtimeMs || (a.name < b.name ? 1 : -1))
    list.forEach((e, i) => {
      if (i < keep) kept.push({ ...e, group: key, why: '保留:该组最新 N 份之内' })
      else if (nowMs - e.mtimeMs < minAgeMs) skipped.push({ ...e, group: key, why: '刚轮转(<1h),句柄可能未释放' })
      else candidate.push({ ...e, group: key })
    })
  }
  const bytes = candidate.reduce((s, e) => s + e.size, 0)
  const massBlocked = !allowMass && (candidate.length > MASS_FILES || bytes > MASS_BYTES)
  return {
    keep,
    groups: groups.size,
    candidate,
    candidateBytes: bytes,
    kept,
    skipped,
    notRotatedCount: notRotated.length,
    massBlocked,
    massCap: { files: MASS_FILES, bytes: MASS_BYTES },
  }
}

function listEntries(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    let st
    try {
      const ls = lstatSync(p)
      if (ls.isSymbolicLink()) continue // §26:重解析点一律不跟随
      st = statSync(p)
    } catch {
      continue // 读不到不计入任何计数,也不等于"没得删"
    }
    if (!st.isFile()) continue
    out.push({ name, path: p, size: st.size, mtimeMs: st.mtimeMs })
  }
  return out
}

function parseArgs(argv) {
  const o = { apply: false, json: false, keep: 10, allowMass: false, dir: LOGS_DIR }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--apply') o.apply = true
    else if (a === '--json') o.json = true
    else if (a === '--allow-mass') o.allowMass = true
    else if (a === '--keep') o.keep = parseInt(argv[++i], 10)
    else if (a === '--dir') o.dir = resolve(argv[++i])
    else if (a === '--self-test') o.selfTest = true
    else if (a === '--help' || a === '-h') o.help = true
  }
  return o
}

export function __selfTest() {
  const day = 86400000
  const now = 1_800_000_000_000
  const mk = (name, size = 100, ageMs = day) => ({ name, size, mtimeMs: now - ageMs })
  const rot = (svc, stream, ts) => `svc-${svc}-nssm-${stream}-${ts}.log`
  let fails = 0
  const ok = (cond, msg) => {
    if (!cond) {
      fails++
      console.error(`✗ ${msg}`)
    }
  }
  // 1 每服务每流各留 keep 份
  const e1 = []
  for (let i = 1; i <= 12; i++) e1.push(mk(rot('loki', 'err', `202609${String(i).padStart(2, '0')}T010000`), 1000, i * day))
  const r1 = planPrune(e1, { keep: 3, nowMs: now })
  ok(r1.kept.filter((x) => x.group === 'loki|err').length === 3, '用例1:keep=3 应留 3 份')
  ok(r1.candidate.length === 9, '用例1:其余 9 份应是候选')
  // 2 正在写的那份(无时间戳)永不进候选
  const r2 = planPrune([mk('svc-loki-nssm-err.log'), mk(rot('loki', 'err', '20260901T010000.328'))], { keep: 0, nowMs: now })
  ok(r2.notRotatedCount === 1 && !r2.candidate.some((c) => c.name === 'svc-loki-nssm-err.log'), '用例2:活文件不得是删除候选')
  // 3 err 与 out 分家:out 占满不能吃掉 err 的保留额度
  const mixed = []
  for (let i = 1; i <= 6; i++) mixed.push(mk(rot('api', 'out', `202609${String(i).padStart(2, '0')}T010000`), 10, i * day))
  mixed.push(mk(rot('api', 'err', '20260901T010000'), 10, day))
  const r3 = planPrune(mixed, { keep: 2, nowMs: now })
  ok(r3.kept.some((k) => k.name.includes('-err-')), '用例3:唯一的 err 份必须被保留(out 不得顶掉它')
  // 4 刚轮转(<1h)只跳过不删
  const r4 = planPrune([mk(rot('a', 'err', '20260927T010000'), 10, 60000), mk(rot('a', 'err', '20260926T010000'), 10, 2 * day)], { keep: 0, nowMs: now })
  ok(r4.skipped.length === 1 && r4.candidate.length === 1, '用例4:1 小时内的那份应落 skipped 而不是 candidate')
  // 5 大批量阀门:超限拒绝(默认),--allow-mass 才放行
  const many = []
  for (let i = 1; i <= 45; i++) many.push(mk(rot('bulk', 'err', `202601${String(i).padStart(2, '0')}T010000`), 10, i * day))
  ok(planPrune(many, { keep: 1, nowMs: now }).massBlocked === true, '用例5:45 份候选应触发大批量拦截')
  ok(planPrune(many, { keep: 1, nowMs: now, allowMass: true }).massBlocked === false, '用例5:--allow-mass 必须放行')
  // 6 幂等:同一批输入乱序喂,候选集合不变
  const shuf = [...e1].reverse()
  ok(planPrune(shuf, { keep: 3, nowMs: now }).candidate.map((c) => c.name).sort().join() === r1.candidate.map((c) => c.name).sort().join(), '用例6:结果不得依赖输入顺序')
  // 7 无流段形态(nssm 把 stdout/stderr 合写一份文件时产出的轮转名)必须被认下来
  const rotNo = (svc, ts) => `svc-${svc}-nssm-${ts}.log`
  const e7 = []
  for (let i = 1; i <= 5; i++) e7.push(mk(rotNo('api', `202609${String(i).padStart(2, '0')}T010000.620`), 1000, i * day))
  const r7 = planPrune(e7, { keep: 2, nowMs: now })
  ok(r7.groups === 1 && r7.kept.length === 2 && r7.candidate.length === 3, '用例7:无流段的轮转副本必须进射程(旧判据整族看不见 164 份/1004MB)')
  // 7b 无流段的**活文件**(名字里没时间戳)同样永不进候选 —— 放宽形态不得把这一格一起放开
  const live7 = 'svc-api-nssm.log'
  const r7b = planPrune([mk(live7), mk(rotNo('api', '20260901T010000.620'))], { keep: 0, nowMs: now })
  ok(!r7b.candidate.some((c) => c.name === live7) && r7b.notRotatedCount === 1, '用例7b:无流段的活文件不得是删除候选')
  // 7c 合写型与分流型是两个独立额度,前者不得吃掉后者的保留名额
  const r7c = planPrune(
    [...Array(6)].map((_, i) => mk(rotNo('api', `202609${String(i + 1).padStart(2, '0')}T010000.620`), 10, (i + 1) * day)).concat(
      mk(rot('api', 'err', '20260901T010000'), 10, day),
    ),
    { keep: 1, nowMs: now },
  )
  ok(r7c.groups === 2 && r7c.kept.some((k) => k.name.includes('-err-')), '用例7c:同服务的合写组不得顶掉 err 组的额度')
  console.info(`--self-test: ${fails === 0 ? '✅ 全部通过' : `❌ 失败 ${fails} 条`} (7 组用例)`)
  return fails === 0 ? 0 : 1
}

function main() {
  const a = parseArgs(process.argv.slice(2))
  if (a.help) {
    console.info('用法: node scripts/prune-rotated-nssm-logs.mjs [--keep N] [--apply] [--allow-mass] [--json] [--dir <目录>] [--self-test]')
    return 0
  }
  if (a.selfTest) return __selfTest()
  if (a.keep <= 0 || !Number.isInteger(a.keep)) {
    console.error('❌ --keep 必须是正整数(它决定出故障时你还查得到几份历史日志)')
    return 2
  }
  let entries
  try {
    entries = listEntries(a.dir)
  } catch (e) {
    // 取不到 = 无法判定,绝不记为"没有要清理的"
    console.error(`⚠️ 未判定:读不到日志目录 ${a.dir} —— ${String(e.message || e).slice(0, 120)}`)
    return 2
  }
  const plan = planPrune(entries, { keep: a.keep })
  const scope = resolve(a.dir) + '\\'
  const off = plan.candidate.filter((c) => !resolve(c.path).startsWith(scope))
  if (off.length) console.error(`❌ 剔除 ${off.length} 个解析后落在目录外的候选(防 junction 穿透),它们不会被删`)
  const del = plan.candidate.filter((c) => resolve(c.path).startsWith(scope))
  if (a.json) {
    process.stdout.write(JSON.stringify({ dir: a.dir, keep: plan.keep, groups: plan.groups, candidate: del, candidateBytes: plan.candidateBytes, skipped: plan.skipped.length, notRotatedCount: plan.notRotatedCount, massBlocked: plan.massBlocked }, null, 1) + '\n')
    return 0
  }
  console.info(`轮转副本保留策略 —— 目录 ${a.dir}`)
  console.info(`  已轮转分组 ${plan.groups} 组;每组保留最新 ${plan.keep} 份;活文件与非副本名 ${plan.notRotatedCount} 个不参与`)
  console.info(`  可回收候选 ${del.length} 份 / ${(plan.candidateBytes / 1048576).toFixed(1)} MB;刚轮转(<1h)跳过 ${plan.skipped.length} 份`)
  if (plan.massBlocked) console.warn(`  ⚠️ 超过大批量阀门(${MASS_FILES} 份 / ${MASS_BYTES / 1048576} MB)—— 需 --allow-mass 才放行,先人工看一眼`)
  if (!del.length) {
    console.info('✅ 无候选(这一维此刻不需要清理;不是"没读到")')
    return 0
  }
  for (const c of del.slice(0, 12)) console.info(`    - ${c.name}  ${(c.size / 1048576).toFixed(1)} MB`)
  if (del.length > 12) console.info(`    …另 ${del.length - 12} 份(计数已含)`)
  if (!a.apply) {
    console.info('  模式=只读(默认)。要真删请加 --apply;本工具永不删活文件、永不跟随重解析点。')
    return 0
  }
  if (plan.massBlocked) {
    console.error('❌ 拒绝 --apply:命中大批量阀门。先人工核对这份清单,确认无误再加 --allow-mass。')
    return 1
  }
  let removed = 0
  let bytesFreed = 0
  const errors = []
  for (const c of del) {
    try {
      rmSync(c.path)
      removed++
      bytesFreed += c.size
    } catch (e) {
      errors.push(`${c.name}: ${String(e.code || e.message).slice(0, 40)}`)
    }
  }
  console.info(`✅ 已删 ${removed}/${del.length} 份,回收 ${(bytesFreed / 1048576).toFixed(1)} MB`)
  for (const line of errors) console.error(`   删除失败:${line}`)
  return errors.length ? 1 : 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exitCode = main()
  } catch (e) {
    console.error('❌ ' + String((e && e.message) || e))
    process.exitCode = 2
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
