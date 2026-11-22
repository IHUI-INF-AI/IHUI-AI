#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * prod-bundle 影子副本清偿器(BUG-62,2026-11-06 立)
 *
 * 方向**唯一**:入库源(tracked,git 跟踪) → 被 .gitignore 忽略的运行副本(runner)。
 * 生产机实跑的是 runner,两侧不一致时「线上行为与仓内代码无关」;本器物只做一件事:
 * 把登记对里漂移的 runner 覆写成 tracked 的**逐字节**副本(Buffer 直写,不做任何
 * 文本/编码往返,也不要手工 cp —— 那正是本器物要替代的做法)。
 *
 * 判据不放水:PAIRS 直接 import check-prod-bundle-shadow.mjs(§0.6 单一真相源),
 * 不复制第二份清单,也不碰那道门的 S0–S3;清偿完由 check-prod-bundle-shadow.mjs
 * 独立复判。本器物只清偿 S3(字节不等),不代判 S0/S1/S2,更不改它们的退出码语义。
 *
 * 用法:
 *   node scripts/sync-prod-bundle-shadow.mjs --check   # 只读档:只报漂移,不写盘;有漂移 exit 1
 *   node scripts/sync-prod-bundle-shadow.mjs            # 清偿档:写全部漂移的 runner;已等值的对零写盘
 *   node scripts/sync-prod-bundle-shadow.mjs --only deploy/prod-bundle/pg-backup.ps1
 *       # 只同步点名这一对;未点名的对一律不读不写。
 *       # 缺参 / 点名不在 PAIRS / 点名多于一对 ⇒ 拒绝写盘,exit 2,一个字节都不改。
 * 退出码:0=所处理的对已逐字节等值(或已清偿完毕) 1=--check 下仍有漂移 2=无法判定或 --only 拒绝写盘
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// check 脚本顶层有 HUSKY_SKIP_PROD_BUNDLE_SHADOW 的早退分支;动态 import 前先清掉,
// 免得被 import 的那道门把本清偿器一起 exit(0) —— 那会是一次静默假绿。
delete process.env.HUSKY_SKIP_PROD_BUNDLE_SHADOW
const { PAIRS } = await import('./check-prod-bundle-shadow.mjs')

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BUNDLE_PREFIX = 'deploy/prod-bundle/'
const sha1 = (buf) => createHash('sha1').update(buf).digest('hex')

/** 点名路径归一:反斜杠、./ 前缀、以及落在 repo 下的绝对路径都收成登记表里的正斜杠相对路径。 */
export function normalizePairToken(token, repo) {
  let s = String(token ?? '')
    .trim()
    .replace(/\\/g, '/')
  if (!s) return ''
  const absLike = /^[A-Za-z]:\//.test(s) || s.startsWith('/')
  if (repo && absLike) {
    const rel = relative(repo, resolve(token)).replace(/\\/g, '/')
    if (rel && !rel.startsWith('..') && !/^[A-Za-z]:\//.test(rel)) s = rel
  }
  if (s.startsWith('./')) s = s.slice(2)
  return s
}

function splitOnlyValue(raw) {
  return String(raw)
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter(Boolean)
}

/**
 * 解析 --only。未出现该旗标 ⇒ only=null(全量清偿,既有行为)。
 * 出现了就必须恰好点名一对,且该对在 PAIRS 里;否则 ok=false,调用方不得写盘。
 * @param {string[]} argv 不含 node 与脚本名
 * @param {{tracked:string, runner:string}[]} pairs
 * @param {string} [repo]
 */
export function parseOnlyArgs(argv, pairs, repo) {
  const names = []
  let sawOnly = false
  let missing = false
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--only') {
      sawOnly = true
      const next = argv[i + 1]
      if (next === undefined || next.startsWith('--')) {
        missing = true
        continue
      }
      i += 1
      const parts = splitOnlyValue(next)
      if (parts.length === 0) missing = true
      else names.push(...parts)
      continue
    }
    if (arg.startsWith('--only=')) {
      sawOnly = true
      const parts = splitOnlyValue(arg.slice('--only='.length))
      if (parts.length === 0) missing = true
      else names.push(...parts)
      continue
    }
    if (sawOnly && !arg.startsWith('--')) names.push(arg)
  }
  if (!sawOnly) return { ok: true, only: null }
  if (names.length > 1) {
    return { ok: false, reason: `点名 ${names.length} 对,多于实际要修的一对,拒绝写盘` }
  }
  if (missing || names.length === 0) {
    return {
      ok: false,
      reason: '缺参: --only 必须点名恰好一对(运行副本路径,例如 deploy/prod-bundle/pg-backup.ps1)',
    }
  }
  const name = normalizePairToken(names[0], repo)
  const hit = pairs.filter(
    (p) => normalizePairToken(p.runner, repo) === name || normalizePairToken(p.tracked, repo) === name,
  )
  if (hit.length === 0) return { ok: false, reason: `点名不在 PAIRS 里: ${name}` }
  if (hit.length !== 1) {
    return { ok: false, reason: `点名命中 ${hit.length} 对,多于实际要修的一对,拒绝写盘` }
  }
  return { ok: true, only: hit[0].runner }
}

/**
 * 清偿。--only 合法时只处理那一对,其余对不读不写。
 * --only 不合法时在任何读盘/写盘之前返回 exit 2。
 */
export function syncProdBundleShadow({ pairs, repo, argv = [], checkOnly = false, log = () => {} }) {
  const parsed = parseOnlyArgs(argv, pairs, repo)
  if (!parsed.ok) {
    log(`❌ ${parsed.reason}`)
    log('❌ 拒绝写盘')
    return { exitCode: 2, drift: 0, synced: 0, unjudged: 1, written: [] }
  }
  const selected = parsed.only ? pairs.filter((p) => p.runner === parsed.only) : pairs
  let drift = 0
  let synced = 0
  let unjudged = 0
  const written = []
  for (const p of selected) {
    // 护栏:清偿只许落在被忽略的 prod-bundle 目录内,绝不写回入库源或越界路径。
    if (!p.runner.startsWith(BUNDLE_PREFIX)) {
      log(`  ❌ 拒绝越界写入(不是 ${BUNDLE_PREFIX} 前缀): ${p.runner}`)
      unjudged += 1
      continue
    }
    const tAbs = join(repo, p.tracked)
    const rAbs = join(repo, p.runner)
    if (!existsSync(tAbs)) {
      log(`  ❌ 入库源不存在(登记表有配对而仓内没源): ${p.tracked}`)
      unjudged += 1
      continue
    }
    let tb
    let rb
    try {
      tb = readFileSync(tAbs)
      rb = existsSync(rAbs) ? readFileSync(rAbs) : null
    } catch (e) {
      log(`  ⚠ 读取失败 ${p.tracked} / ${p.runner}: ${e.message}`)
      unjudged += 1
      continue
    }
    if (rb !== null && sha1(tb) === sha1(rb)) continue
    drift += 1
    if (checkOnly) {
      log(
        `  ❌ 影子漂移 ${p.runner}  <-  ${p.tracked}` +
          (rb === null ? '(运行副本不存在)' : ` (入库源 ${tb.length} 字节 / 运行副本 ${rb.length} 字节)`),
      )
      continue
    }
    try {
      mkdirSync(dirname(rAbs), { recursive: true })
      writeFileSync(rAbs, tb) // Buffer 直写 ⇒ 逐字节等值
      synced += 1
      written.push(p.runner)
      log(`  ✅ 已清偿 ${p.tracked} → ${p.runner} (${tb.length} 字节)`)
    } catch (e) {
      log(`  ❌ 写入失败 ${p.runner}: ${e.message}`)
      unjudged += 1
    }
  }

  if (unjudged > 0) {
    log(`❌ ${unjudged} 对无法判定 —— 不记为通过`)
    return { exitCode: 2, drift, synced, unjudged, written }
  }
  if (checkOnly) {
    if (parsed.only) {
      log(
        drift === 0
          ? `✅ --check --only ${parsed.only}: 点名这一对逐字节等值(未写盘)`
          : `❌ --check --only ${parsed.only}: 点名这一对影子漂移(未写盘;保留同一 --only 并去掉 --check 才写这一对)`,
      )
    } else {
      log(
        drift === 0
          ? `✅ --check: ${selected.length} 对全部逐字节等值(未写盘)`
          : `❌ --check: ${drift}/${selected.length} 对影子漂移(未写盘;跑不带 --check 的清偿档修复)`,
      )
    }
    return { exitCode: drift === 0 ? 0 : 1, drift, synced, unjudged, written }
  }
  if (parsed.only) {
    log(
      synced === 0
        ? '✅ 点名这一对已逐字节等值(未写盘);其余登记对未触碰'
        : `✅ 点名清偿完成:只写 ${parsed.only};新写 ${synced} 份;其余登记对未触碰`,
    )
    return { exitCode: 0, drift, synced, unjudged, written }
  }
  log(`✅ 清偿完成:新写 ${synced} 份运行副本;原有 ${selected.length - drift} 对已逐字节等值`)
  return { exitCode: 0, drift, synced, unjudged, written }
}

async function main() {
  const argv = process.argv.slice(2)
  const result = syncProdBundleShadow({
    pairs: PAIRS,
    repo: REPO,
    argv,
    checkOnly: argv.includes('--check'),
    log: (line) => console.log(line),
  })
  process.exit(result.exitCode)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}

export const __test__ = {
  PAIRS,
  BUNDLE_PREFIX,
  normalizePairToken,
  parseOnlyArgs,
  syncProdBundleShadow,
  main,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
