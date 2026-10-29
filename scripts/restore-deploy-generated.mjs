// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// ff-only 前置:把"构建在自己树上重生成的派生态"与"上游已跟踪而同路径本地是未跟踪副本"这两型
// 让位动作机械化(2026-10-19 立)。
//
// 立因(当天现读):生产签出 D:\DevEnv\ihui-prod 落后 origin/main 57 枚、部署环每 60s 撞
// `git merge --ff-only` 失败,判据把它写成"有未提交文件挡住 ff(不代提交不删除)"并每 4h 寄一封。
// 而那批"未提交文件"里没有一份是人在写的:PROJECT_PLAN 的回灌旧账(行级 union 落进生产树)、
// 4 枚上游已同名跟踪的 Grafana 派生大屏、sw.js / dashboard-config.generated.ts / next-env.d.ts
// 这些构建每轮自己重写的被跟踪文件。既有自愈层只治"幻影漂移"(盘上内容==该路径**某祖先版本**),
// 生成物是"比 HEAD 更新的内容",结构上永远不满足那条判据 ⇒ 这一格是全仓盲区:
// 只要构建还在自己树上落生成物,下一次 ff 就还会被同一枚文件挡死(=永久停摆,不是偶发)。
//
// 纪律(与 §12e/§5e-2 同一条):
//   · 只处理**登记过**的路径(封闭清单 scripts/data/deploy-generated-paths.json),不猜、不放宽到全树;
//     唯一例外是"内容与 tip 同一枚 blob"的未跟踪影子(2026-10-19 立):零信息损失才免登记,
//     内容不同的影子照旧要逐条授权 —— 免的是"谁来登记"这一格,不是判据本身;
//   · 每一种都先逐字节备份到批准目录,再动盘;备份失败 ⇒ 该项不动并点名;
//   · 只在这两项同时成立时复原被跟踪文件:索引==HEAD(不是别人暂存的活) ∧ 盘上≠HEAD;
//   · 未跟踪副本只在"上游 tip 已跟踪同名路径"时才让位(否则那是别人在飞的源码,一律 HANDS-OFF);
//   · 默认 dry-run,`--apply` 才写;合并进行中整轮让路。
//
// 产出形态(2026-10-29 改,治"部署日志洪水"):生产实测每轮 83050 行逐文件 JSON 对象把
// deploy-loop.log 的 FAIL/OK/切流结论全淹了(11~13 分钟轮转一次、跨 5 个文件找一行结论)。
//   · 默认只打**单行**读数:mode/总计/blocked/耗时 一行 + 每个 tier×action 桶计数一行 +
//     明细落盘指针一行 + **非无害条目**(不动…/失败…)逐条点名(上限 ALERT_LINE_CAP 条,
//     超限写"另有 N 条未列出,逐条见 <JSONL>");
//   · `--verbose` 保留旧"逐文件多行 JSON 对象"全量 stdout(取证/调试用);
//   · 两种形态都把逐条明细整批落盘为机读 JSONL(IHUI_DEPLOY_GENERATED_DETAIL 可改落点,
//     缺省 .ihui-agent/state/deploy-generated-yield.jsonl,每轮覆盖);
//   · 退出码语义一字未动:0=正常跑完(含 blocked/fatal,与旧版一致)、2=用法错或顶层异常。
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { requireFlagValue } from './lib/flag-value.mjs'
import { gitRaw } from './lib/face-reader.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const REGISTRY = join(ROOT, 'scripts', 'data', 'deploy-generated-paths.json')
const BACKUP_ROOT = process.env.IHUI_DEPLOY_GENERATED_BACKUP || 'D:\\DevEnv\\backups\\deploy-generated'
const DETAIL_FILE = process.env.IHUI_DEPLOY_GENERATED_DETAIL || join(ROOT, '.ihui-agent', 'state', 'deploy-generated-yield.jsonl')
export const ALERT_LINE_CAP = 50

const git = (args, cwd, allowFail = false) => {
  try {
    // 取材统一走层(scripts/lib/face-reader.mjs):绝对 git + quotepath + 显式 stdio 由 gitRaw 同源提供。
    return gitRaw(args, cwd, { maxBuffer: 1 << 26 })
  } catch (e) {
    if (allowFail) return `__FAIL__:${String(e?.message ?? e).slice(0, 160)}`
    throw e
  }
}

export function planGeneratedYield(repoRoot, registryText, { nowMs = Date.now(), ref = 'origin/main' } = {}) {
  const reg = JSON.parse(registryText)
  const paths = (reg.paths || []).map((p) => String(p.path))
  if (paths.length === 0) return { fatal: '清单为空 ⇒ 本器物无事可做(枚举到 0 判死不记绿,§0.3)' }
  if (git(['rev-parse', '--git-dir'], repoRoot, true).startsWith('__FAIL__')) return { fatal: `${repoRoot} 不是 git 仓 ⇒ 未判定` }
  if (existsSync(join(repoRoot, '.git', 'MERGE_HEAD'))) return { fatal: '合并进行中 ⇒ 整轮让路' }

  const tipTree = new Set(
    git(['ls-tree', '-r', '--name-only', ref], repoRoot, true).startsWith('__FAIL__')
      ? []
      : git(['ls-tree', '-r', '--name-only', ref], repoRoot).split(/\r?\n/).filter(Boolean),
  )
  const porcelain = git(['status', '--porcelain=v1', '-uall'], repoRoot).split(/\r?\n/).filter(Boolean)
  const stagedBlobs = new Map(
    git(['ls-files', '-s'], repoRoot, true)
      .split(/\r?\n/)
      .filter(Boolean)
      .map((l) => {
        const [meta, ...rest] = l.split('\t')
        return [rest.join('\t').trim(), meta.trim().split(/\s+/)[1]]
      }),
  )
  const backupDir = join(BACKUP_ROOT, new Date(nowMs).toISOString().replace(/[:.]/g, '-'))
  const actions = []
  let blocked = false

  for (const line of porcelain) {
    const xy = line.slice(0, 2)
    let rel = line.slice(3).trim()
    if (rel.includes(' -> ')) rel = rel.split(' -> ')[1].trim()
    const norm = rel.replace(/\\/g, '/')

    if (xy.includes('?')) {
      // 未跟踪:只有"上游 tip 已跟踪同名"才是 ff 的阻塞项(否则是他人在飞,绝不碰)
      if (!tipTree.has(norm)) {
        actions.push({ rel: norm, tier: 'untracked-unique', action: 'HANDS-OFF' })
        continue
      }
      const src = join(repoRoot, rel)
      if (!existsSync(src)) {
        actions.push({ rel: norm, tier: 'untracked-collides-tip', action: '盘上已无此文件(无需让位)' })
        continue
      }
      // 内容同一性优先于逐条授权(2026-10-19 立):**盘上影子与 tip 是同一枚 blob** 时,让位
      // 不丢任何一个字节 —— 装的本来就是即将合进来的那份。这一格必须与清单无关,否则每新增一枚
      // 上游文件都要先有人想到去登记才能解停摆(现读实测:生产签出被两枚 `packages/shared/src/sse/*`
      // 的未跟踪影子挡死 ff,内容与 tip 逐字节相同,而清单里没有它们 ⇒ 停摆 3 小时、每 4h 一封)。
      // 内容**不同**的影子仍然走逐条授权 —— 那才是"可能是人在写的",判据不许猜。
      // 比字节不比标签:`hash-object`(盘上)↔ `rev-parse tip:path`(库里),两个 oid 相等才算同内容。
      const diskOid = git(['hash-object', '--', src], repoRoot, true).trim()
      const tipOid = git(['rev-parse', `${ref}:${norm}`], repoRoot, true).trim()
      if (!diskOid.startsWith('__FAIL__') && !tipOid.startsWith('__FAIL__') && diskOid === tipOid) {
        const dst = join(backupDir, 'untracked__' + norm.replace(/[\\/]/g, '__'))
        actions.push({
          rel: norm,
          tier: 'untracked-collides-tip',
          action: '备份后让位(内容与 tip 同一枚 blob)',
          backup: dst,
          reason: `未跟踪影子与 ${ref} 的该路径逐字节相同(hash-object↔rev-parse 两 oid 相等)⇒ 让位零信息损失`,
        })
        continue
      }
      // 授权是**逐条**的:只有清单里显式写了 untrackedCollide 的路径(或目录前缀)才允许让位
      const grant = reg.paths.find(
        (p) => p.untrackedCollide === true && (norm === String(p.path).replace(/\\/g, '/') || norm.startsWith(String(p.path).replace(/\\/g, '/') + '/')),
      )
      if (!grant) {
        actions.push({ rel: norm, tier: 'untracked-collides-tip', action: '不动(清单未授予 untrackedCollide ⇒ 交人工)' })
        blocked = true
        continue
      }
      const dst = join(backupDir, 'untracked__' + norm.replace(/[\\/]/g, '__'))
      actions.push({ rel: norm, tier: 'untracked-collides-tip', action: '备份后让位', backup: dst, reason: grant.reason })
      continue
    }

    const listed = reg.paths.find((p) => String(p.path).replace(/\\/g, '/') === norm)
    if (!listed) {
      actions.push({ rel: norm, tier: 'tracked-dirty-unlisted', action: '不动(不在封闭清单 ⇒ 可能是真人在写)' })
      blocked = true
      continue
    }
    const headBlob = git(['rev-parse', `HEAD:${norm}`], repoRoot, true)
    const idxBlob = stagedBlobs.get(rel) || stagedBlobs.get(norm)
    const indexClean =
      !headBlob.startsWith('__FAIL__') && Boolean(idxBlob) && idxBlob === headBlob.trim()
    if (!listed.trackedYield) {
      actions.push({ rel: norm, tier: 'tracked-dirty-listed-noyield', action: '不动(该条只授予 untrackedCollide,未授予 trackedYield)' })
      blocked = true
      continue
    }
    if (!indexClean) {
      actions.push({ rel: norm, tier: 'tracked-generated', action: '不动(索引≠HEAD ⇒ 暂存的是别人/别的轮的活)' })
      blocked = true
      continue
    }
    const dst = join(backupDir, 'tracked__' + norm.replace(/[\\/]/g, '__'))
    actions.push({ rel: norm, tier: 'tracked-generated', action: '备份后复原到 HEAD', backup: dst, reason: listed.reason })
  }
  return { backupDir, actions, blocked }
}

export function applyGeneratedYield(repoRoot, plan) {
  if (plan.fatal) return { skipped: plan.fatal }
  mkdirSync(plan.backupDir, { recursive: true })
  const done = []
  for (const a of plan.actions) {
    if (!a.action.startsWith('备份后')) {
      done.push({ rel: a.rel, result: a.action })
      continue
    }
    const src = join(repoRoot, a.rel)
    if (!existsSync(src)) {
      done.push({ rel: a.rel, result: '盘上已无此文件(无需让位)' })
      continue
    }
    try {
      if (a.tier === 'untracked-collides-tip') {
        copyFileSync(src, a.backup)
        rmSync(src, { force: true })
        done.push({ rel: a.rel, result: '已备份并移除' })
      } else {
        writeFileSync(a.backup, readFileSync(src))
        git(['checkout', '--', a.rel], repoRoot)
        done.push({ rel: a.rel, result: '已备份并复原到 HEAD' })
      }
    } catch (e) {
      // 备份失败绝不继续删 —— 宁可下一轮继续红,也不能让别人的活没有退路
      done.push({ rel: a.rel, result: `失败(未动盘):${String(e.message).slice(0, 120)}` })
    }
  }
  return { done }
}

// ── 产出层(2026-10-29):默认聚合、逐条明细落 JSONL、--verbose 保留旧全量 stdout ──
// 判定"非无害"的唯一实现:HANDS-OFF / 盘上已无此文件 / 备份后…(让位或复原,执行结果另由
// APPLY 桶与"失败…"行兜底) / 已备份并… 都是噪音或已成功;其余(不动…/失败…)必须逐条点名。
// 测试 import 本函数,禁止复制第二份(§22c)。
export function isNonHarmlessOutcome(text) {
  const s = String(text ?? '')
  if (s.startsWith('HANDS-OFF')) return false
  if (s.startsWith('盘上已无此文件')) return false
  if (s.startsWith('备份后')) return false
  if (s.startsWith('已备份并移除')) return false
  if (s.startsWith('已备份并复原到 HEAD')) return false
  return true
}

// 读数不得断行:任何进 stdout 的字段先折掉换行(错误消息可能自带 \n)
export function oneLineReading(s) {
  return String(s ?? '').replace(/\r?\n/g, ' ').trim()
}

const applyOutcomeBucket = (r) => (String(r).startsWith('失败') ? '失败(未动盘)' : String(r))

export function collectDetailRows({ mode, repo, plan, applied, at }) {
  if (plan.fatal) return []
  const rows = []
  for (const a of plan.actions || []) rows.push({ at, mode, repo, kind: 'action', ...a })
  for (const d of (applied && applied.done) || []) rows.push({ at, mode, repo, kind: 'applied', ...d })
  return rows
}

export function buildSummaryLines({ mode, repo, plan, applied, elapsedMs, detailFile, alertCap = ALERT_LINE_CAP }) {
  const detailRows = collectDetailRows({ mode, repo, plan, applied, at: new Date().toISOString() })
  if (plan.fatal) {
    return { lines: [`GEN-YIELD mode=${mode} repo=${repo} FATAL ${oneLineReading(plan.fatal)}`], detailRows }
  }
  const actions = plan.actions || []
  const done = (applied && applied.done) || []
  const buckets = new Map()
  for (const a of actions) {
    const k = `PLAN|${a.tier}|${oneLineReading(a.action)}`
    buckets.set(k, (buckets.get(k) || 0) + 1)
  }
  for (const d of done) {
    const k = `APPLY|${oneLineReading(applyOutcomeBucket(d.result))}`
    buckets.set(k, (buckets.get(k) || 0) + 1)
  }
  const alerts = []
  for (const a of actions) if (isNonHarmlessOutcome(a.action)) alerts.push({ rel: a.rel, source: 'plan', outcome: oneLineReading(a.action) })
  for (const d of done) if (isNonHarmlessOutcome(d.result)) alerts.push({ rel: d.rel, source: 'apply', outcome: oneLineReading(d.result) })

  const lines = []
  lines.push(`GEN-YIELD mode=${mode} repo=${repo} actions=${actions.length} applied=${done.length} alerts=${alerts.length} blocked=${plan.blocked ? 'true' : 'false'} elapsed=${elapsedMs}ms`)
  for (const [k, c] of [...buckets.entries()].sort((x, y) => y[1] - x[1])) lines.push(`GEN-YIELD-TIER bucket=${k} count=${c}`)
  lines.push(`GEN-YIELD-DETAIL file=${detailFile} rows=${detailRows.length}`)
  const shown = alerts.slice(0, alertCap)
  shown.forEach((al, i) => lines.push(`GEN-YIELD-ALERT #${i + 1} src=${al.source} rel=${al.rel} outcome=${al.outcome}`))
  if (alerts.length > shown.length) {
    lines.push(`GEN-YIELD-ALERT-TAIL 另有 ${alerts.length - shown.length} 条未列出，逐条见 ${detailFile}`)
  }
  return { lines, detailRows }
}

// 旧 stdout 形态原样保留(--verbose 专用):逐文件多行 JSON 对象
export function renderVerboseDump(obj) {
  return JSON.stringify(obj, null, 1)
}

export function writeDetailLedger(file, rows) {
  try {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''), 'utf8')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: oneLineReading(String(e?.message ?? e).slice(0, 160)) }
  }
}

async function main() {
  const apply = process.argv.includes('--apply')
  const verbose = process.argv.includes('--verbose')
  const repoFlag = requireFlagValue(process.argv, '--repo', { noun: '路径', fallback: ROOT })
  if (repoFlag.error) {
    console.error(`❌ 用法错:${repoFlag.error}`)
    process.exit(2)
  }
  const repo = repoFlag.value
  const startedAt = Date.now()
  const plan = planGeneratedYield(repo, readFileSync(REGISTRY, 'utf8'))
  const applied = apply && !plan.fatal ? applyGeneratedYield(repo, plan) : null
  const mode = apply ? 'APPLY' : 'DRY-RUN'
  const summary = buildSummaryLines({ mode, repo, plan, applied, elapsedMs: Date.now() - startedAt, detailFile: DETAIL_FILE })
  const write = writeDetailLedger(DETAIL_FILE, summary.detailRows)
  if (verbose) {
    console.log(renderVerboseDump({ mode, repo, ...plan }))
    if (applied) console.log(renderVerboseDump({ applied }))
    if (!write.ok) console.error(`❌ 明细落盘失败:${write.error}`)
    return
  }
  for (const line of summary.lines) console.log(line)
  if (!write.ok) {
    console.log(`GEN-YIELD-DETAIL-FAIL 落盘失败:${write.error} ⇒ 上方“另有 N 条未列出”指向的文件本轮未更新`)
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = {
  planGeneratedYield,
  applyGeneratedYield,
  isNonHarmlessOutcome,
  oneLineReading,
  collectDetailRows,
  buildSummaryLines,
  renderVerboseDump,
  writeDetailLedger,
  ALERT_LINE_CAP,
  DETAIL_FILE,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
