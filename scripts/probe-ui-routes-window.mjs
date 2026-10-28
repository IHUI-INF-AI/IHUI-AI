#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * probe-ui-routes-window.mjs —— 门 105 G5 四端 ui-routes「重生成窗口」只读探测器
 *
 * 立因(票 G-1142551):两个生成器(`apps/web/scripts/generate-ui-routes.mjs` /
 * `apps/miniapp-taro/scripts/generate-ui-routes.mjs`)都用 `readFileSync` 读**工作树**并据此算
 * `inputsSha256`,而门 105 用 **HEAD 面**重算 —— 只要任一输入文件在别席未提交状态,重生成就会
 * 把脏输入烘进产物,产出照样 stale。于是「窗口」= 目标产物的全部输入在 HEAD / 工作树 / 索引三面
 * 逐文件一致的那一刻;本脚本把那一次等待器物化(AGENTS §1:不挂账等条件)。
 *
 * 判据**不另写一份**:输入清单与分端派生全部 import 门 105 自己的 `__test__`
 * (`makeReader` / `UI_ROUTES_ARTIFACTS`),面取材也走 `scripts/lib/face-reader.mjs`;
 * 字节归一走 `scripts/lib/generated-input-pin.mjs` 的 `normalizeInputBytes`(与钉实现同一份)。
 * 三面都要比:工作树(生成器读的那面)、索引(`git commit` 实际收进去的那面)都必须与 HEAD 同形,
 * 只比工作树会漏掉「别席已 staged 但未提交」的半窗口。
 *
 * 只读:不写任何文件、不派生 git(全走 face-reader)、不接提交链、不进 CI。
 *
 * 用法:
 *   node scripts/probe-ui-routes-window.mjs                 # 单次探测,exit 0=OPEN / 1=CLOSED / 2=UNDETERMINED
 *   node scripts/probe-ui-routes-window.mjs --wait          # 轮询(默认 25s/轮,上限 12min)
 *   node scripts/probe-ui-routes-window.mjs --wait --interval-ms 20000 --max-ms 720000
 *   node scripts/probe-ui-routes-window.mjs --json          # 机器可读
 *   node scripts/probe-ui-routes-window.mjs --root <dir>    # 显式判定根(夹具用)
 *
 * 末行契约(供上层判读):`WINDOW-OPEN` / `WINDOW-CLOSED diffs=N` / `UNDETERMINED <原因>`。
 * 取不到面一律 UNDETERMINED(exit 2),不猜;绝不把「没判成」写成 CLOSED 或 OPEN。
 */

import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { __test__ as gate } from './check-miniapp-generated.mjs'
import { normalizeInputBytes } from './lib/generated-input-pin.mjs'
import { Undetermined } from './lib/face-reader.mjs'

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
/** 本票要重钉的两枚产物;其余两端只作为「同一套输入集」的对照读数 */
const TARGET_ARTIFACTS = new Set([
  'apps/web/src/lib/ui-routes.generated.ts',
  'apps/miniapp-taro/src/constants/ui-routes.generated.ts',
])
const DEFAULT_INTERVAL_MS = 25_000
const DEFAULT_MAX_MS = 12 * 60_000

const fmtTime = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

/** 单面的输入取材:清单与内容同面同轮(与门 105 runCheck 的 ui-routes 段同序) */
function collectInputs(reader) {
  // 第一段必须先把「直接输入」预取好:taro 的 inputRels 要求值 app.config 才能列页面 config
  // 与扫描集(head/staged reader 的 read 对未预取键直接抛,不偷偷补读)。
  reader.prefetch([gate.RN_NAVIGATOR, gate.RN_LINKING, gate.EXT_SIDEPANEL, gate.TARO_APP_CONFIG])
  const perArtifact = new Map()
  const rels = new Set()
  for (const art of gate.UI_ROUTES_ARTIFACTS) {
    const list = art.inputRels(reader)
    perArtifact.set(art.rel, list)
    for (const rel of list) rels.add(rel)
  }
  reader.prefetch([...rels])
  const text = new Map()
  for (const rel of rels) text.set(rel, reader.has(rel) ? reader.read(rel) : null)
  return { perArtifact, rels, text }
}

/**
 * head 面 ↔ 另一面(other)逐文件比对。
 * 先比枚举集合(新增/删除会改变钉清单),再比归一后字节(钉的哈希输入)。
 */
function compareFace(name, head, other) {
  const diffs = []
  for (const art of gate.UI_ROUTES_ARTIFACTS) {
    const hs = new Set(head.perArtifact.get(art.rel) ?? [])
    const os = new Set(other.perArtifact.get(art.rel) ?? [])
    for (const rel of [...hs].filter((r) => !os.has(r)).sort()) {
      diffs.push({
        artifact: art.rel,
        rel,
        kind: `${name}-missing`,
        detail: `HEAD 面枚举到该输入,${name} 面没有(删除/改名/未跟踪)`,
      })
    }
    for (const rel of [...os].filter((r) => !hs.has(r)).sort()) {
      diffs.push({
        artifact: art.rel,
        rel,
        kind: `${name}-extra`,
        detail: `${name} 面多出该输入(未提交新增/替换)`,
      })
    }
  }
  for (const rel of [...new Set([...head.rels, ...other.rels])].sort()) {
    if (!head.text.has(rel) || !other.text.has(rel)) continue // 集合差已在上面点名
    const a = head.text.get(rel)
    const b = other.text.get(rel)
    if (a === null || b === null) {
      if (a !== b) {
        diffs.push({ artifact: '(shared)', rel, kind: `${name}-unreadable`, detail: `${name} 面取不到内容` })
      }
      continue
    }
    const na = normalizeInputBytes(a)
    const nb = normalizeInputBytes(b)
    if (na !== nb) {
      diffs.push({
        artifact: '(shared)',
        rel,
        kind: `${name}-bytes`,
        detail: `归一后字节不同:HEAD ${na.length}B vs ${name} ${nb.length}B`,
      })
    }
  }
  return diffs
}

/** 一次完整探测:head / worktree / staged 三面。取不到任一面 ⇒ 抛 Undetermined(exit 2)。 */
function probeOnce(root) {
  const head = collectInputs(gate.makeReader('head', root))
  const worktree = collectInputs(gate.makeReader('worktree', root))
  const staged = collectInputs(gate.makeReader('staged', root))
  const diffs = [...compareFace('worktree', head, worktree), ...compareFace('staged', head, staged)]
  return { diffs, inputCount: head.rels.size, head }
}

function printDiffs(diffs, log) {
  const targets = diffs.filter((d) => TARGET_ARTIFACTS.has(d.artifact))
  log(`  差异 ${diffs.length} 条(其中落在本票两枚产物上 ${targets.length} 条):`)
  for (const d of diffs) {
    const mark = TARGET_ARTIFACTS.has(d.artifact) ? '🎯' : '  '
    log(`  ${mark}[${d.kind}] ${d.rel} —— ${d.detail}${d.artifact === '(shared)' ? '' : `(产物 ${d.artifact})`}`)
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function parseArgv(argv) {
  const opts = {
    wait: false,
    json: false,
    intervalMs: DEFAULT_INTERVAL_MS,
    maxMs: DEFAULT_MAX_MS,
    root: DEFAULT_ROOT,
  }
  const num = (v, flag) => {
    const n = Number(v)
    if (!Number.isFinite(n) || n < 1) throw new Error(`${flag} 需要一个 ≥1 的整数,实得 ${JSON.stringify(v)}`)
    return n
  }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--wait') opts.wait = true
    else if (a === '--json') opts.json = true
    else if (a === '--interval-ms') opts.intervalMs = num(argv[++i], '--interval-ms')
    else if (a === '--max-ms') opts.maxMs = num(argv[++i], '--max-ms')
    else if (a === '--root') {
      const v = argv[++i]
      if (!v || v.startsWith('--')) throw new Error(`--root 需要一个目录参数,实得 ${JSON.stringify(v)}`)
      opts.root = resolve(v)
    } else throw new Error(`未知参数:${a}`)
  }
  return opts
}

async function main(argv) {
  const opts = parseArgv(argv)
  const log = opts.json ? () => {} : (s) => console.log(s)
  const started = Date.now()
  const rounds = []
  let last = null
  let finalUndetermined = null

  log(
    `[probe-ui-routes-window] root=${opts.root} 目标产物 ${TARGET_ARTIFACTS.size} 枚 / 四端输入集同源门 105` +
      (opts.wait ? ` / 轮询 ${opts.intervalMs}ms × ≤${opts.maxMs}ms` : ' / 单次'),
  )

  for (;;) {
    const at = fmtTime.format(new Date())
    let result = null
    let error = null
    try {
      result = probeOnce(opts.root)
    } catch (e) {
      if (!(e instanceof Undetermined)) throw e
      error = e.message
    }
    if (result) {
      last = { status: result.diffs.length === 0 ? 'WINDOW-OPEN' : 'WINDOW-CLOSED', ...result, at }
      rounds.push({ at, status: last.status, diffs: result.diffs.length })
      log(
        `[${at}] ${last.status} diffs=${result.diffs.length} inputs=${result.inputCount}` +
          (opts.wait ? '' : ''),
      )
      if (last.status === 'WINDOW-OPEN') break
    } else {
      rounds.push({ at, status: 'UNDETERMINED', error })
      finalUndetermined = error
      log(`[${at}] UNDETERMINED —— ${error}`)
      if (!opts.wait) break
    }

    if (!opts.wait) break
    if (Date.now() - started + opts.intervalMs > opts.maxMs) break
    await sleep(opts.intervalMs)
  }

  const elapsedMs = Date.now() - started
  // 只有**最后一轮成功**才给 OPEN/CLOSED;最后一轮取不到面 ⇒ UNDETERMINED。
  // 中途失败轮只留档不落槌(不把「没判成」写成 CLOSED/OPEN,§0.3)。
  const lastOk = last && last.at === rounds[rounds.length - 1]?.at && rounds[rounds.length - 1]?.status !== 'UNDETERMINED'
  let status
  if (lastOk && last.status === 'WINDOW-OPEN') status = 'WINDOW-OPEN'
  else if (lastOk && last.status === 'WINDOW-CLOSED') status = 'WINDOW-CLOSED'
  else status = 'UNDETERMINED'

  if (opts.json) {
    process.stdout.write(
      JSON.stringify({
        status,
        elapsedMs,
        root: opts.root,
        rounds,
        diffs: last?.diffs ?? [],
        inputs: last?.inputCount ?? 0,
        undeterminedReason: status === 'UNDETERMINED' ? finalUndetermined : null,
      }) + '\n',
    )
  } else {
    if (status === 'WINDOW-CLOSED') printDiffs(last?.diffs ?? [], log)
    log(
      status === 'WINDOW-OPEN'
        ? `WINDOW-OPEN diffs=0 inputs=${last?.inputCount ?? 0} 用时 ${Math.round(elapsedMs / 1000)}s —— ` +
            '此刻跑生成器不会把脏输入烘进产物'
        : status === 'WINDOW-CLOSED'
          ? `WINDOW-CLOSED diffs=${last?.diffs.length ?? 0} 用时 ${Math.round(elapsedMs / 1000)}s`
          : `UNDETERMINED ${finalUndetermined ?? '取不到判定面'} 用时 ${Math.round(elapsedMs / 1000)}s`,
    )
  }
  return status === 'WINDOW-OPEN' ? 0 : status === 'WINDOW-CLOSED' ? 1 : 2
}

// §22d 双形态入口:被 import 时只取导出符号,不跑主流程
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code
    })
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exitCode = 2
    })
}

export const __test__ = { collectInputs, compareFace, probeOnce, parseArgv, TARGET_ARTIFACTS }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
