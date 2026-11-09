#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 只读对账尺:内置出口名单件 ⇄ TS 源 ⇄ Rust 消费面(goal-b49 Z26)。
 *
 * 三格(缺一即红,取不到输入一律 exit 2「未判定」—— §0.3):
 *  - **L1 件 ⇄ 源**:把 `scripts/generate-egress-builtin-list.mjs` 的重算结果与产物逐字节比
 *    (派生态禁止手改;手改、漏跑生成器、源改了没落档 全在这一格翻红)。
 *  - **L2 件 ⇄ Rust 消费面**:`egress_gate.rs` 必须 `include_str!` 本件,且 `include_str!`
 *    里的相对路径按该 .rs 的位置拼出来必须**逐字**指向本件(路径写歪 = 吃了另一张表);
 *    反向锁同批跑:名单里任一条字面量**不得**作为数据出现在 Rust 门体代码行(§0.6 第二把尺)。
 *  - **L3 跨语言向量在册**:产物里的行为向量枚数 > 0,且 Rust 门体确有逐值比对它们的用例
 *    (§0.9:判据在、器物在、没人跑 = 没有)。
 *
 * 档位:**判机器/仓库内容同源状态的只读尺,刻意不进提交链**(§12e;注册进
 * `scripts/guardian-runner.mjs` 需另票,本票白名单不含 runner)。
 * 取材口径(本仓通行):全量判 **HEAD blob**、`--staged` 判**索引 blob**、`--worktree` 仅人工逃生舱;
 * 清单与内容同面同轮;两面旗同给 ⇒ exit 2。
 *
 * 用法:
 *   node scripts/check-egress-builtin-list-sync.mjs            # 全量(HEAD)
 *   node scripts/check-egress-builtin-list-sync.mjs --staged   # 索引面
 *   node scripts/check-egress-builtin-list-sync.mjs --worktree # 人工:盘上现状
 *   node scripts/check-egress-builtin-list-sync.mjs --self-test
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { ARTIFACT_REL, buildManifest, loadTsEngines, serialize } from './generate-egress-builtin-list.mjs'
import { gitRaw } from './lib/face-reader.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const RUST_GATE_REL = 'apps/desktop/src-tauri/src/egress_gate.rs'

class Undetermined extends Error {}

function faceFlags (argv) {
  const staged = argv.includes('--staged')
  const worktree = argv.includes('--worktree')
  if (staged && worktree) throw new Undetermined('--staged 与 --worktree 互斥(两面旗同给 ⇒ 未判定)')
  if (staged) return 'staged'
  if (worktree) return 'worktree'
  return 'head'
}

/** 同一轮、同一张面取正文;取不到 ⇒ 抛 Undetermined,绝不回落另一个面。 */
function readFace (face, rel) {
  if (face === 'worktree') {
    const abs = join(ROOT, rel)
    if (!existsSync(abs)) throw new Undetermined(`worktree 面没有 ${rel}`)
    return readFileSync(abs, 'utf8')
  }
  const spec = face === 'staged' ? `:${rel}` : `HEAD:${rel}`
  const out = runGit(['show', spec])
  if (out === null) throw new Undetermined(`${face} 面取不到 ${rel}(git show ${spec} 非零/报错)`)
  return out
}

function runGit (args) {
  try {
    return String(gitRaw(args, ROOT, { timeout: 60_000, maxBuffer: 1 << 26 }) ?? '')
  } catch (e) {
    if (typeof e?.status === 'number') return null
    throw new Undetermined(`git 派生失败(${args[0]}): ${e?.message ?? e}`)
  }
}

/** L1:产物 ⇄ TS 源(逐字节)。 */
export async function checkArtifactVsSource (face, { artifactText, recomputed }) {
  const drift = artifactText !== recomputed
  return {
    id: 'L1',
    ok: !drift,
    detail: drift
      ? `产物与源重算不同面(手改派生件 / 漏跑生成器)→ 跑 node scripts/generate-egress-builtin-list.mjs --write`
      : `产物 == 源重算(${recomputed.length} 字节)`,
  }
}

/** L2:Rust 消费面 include 的正是本件,且反向锁(名单字面量不得作为数据落进门体)。 */
export function checkRustConsumes (rustText, manifest) {
  const includes = [...rustText.matchAll(/include_str!\s*\(\s*"([^"]+)"\s*\)/g)].map((m) => m[1])
  if (includes.length === 0) return { id: 'L2', ok: false, detail: 'Rust 门体没有 include_str! ⇒ 名单腿仍无人吃' }
  const hits = includes.filter((rel) => {
    const abs = resolve(dirname(join(ROOT, RUST_GATE_REL)), rel)
    return abs.replace(/\\/g, '/') === join(ROOT, ARTIFACT_REL).replace(/\\/g, '/')
  })
  if (hits.length !== 1) {
    return { id: 'L2', ok: false, detail: `include_str! 现读 ${includes.length} 枚、指向本件的恰 ${hits.length} 枚(须恰 1): ${JSON.stringify(includes)}` }
  }
  const codeLines = rustText
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\/\/!|\*)/.test(line))
    .join('\n')
  const literals = [...manifest.hostNames, ...manifest.hostSuffixes, ...manifest.deniedCidrs, ...manifest.rows.map((r) => r.domain)]
  const offenders = [...new Set(literals.filter((l) => codeLines.includes(`"${l}"`)))]
  if (offenders.length > 0) {
    return { id: 'L2', ok: false, detail: `内置名单被抄进 Rust 门体(§0.6 第二把尺): ${JSON.stringify(offenders)}` }
  }
  return { id: 'L2', ok: true, detail: `include_str!("${hits[0]}") 指向本件;门体零名单字面量` }
}

/** L3:跨语言行为向量既在件里、也被 Rust 逐值跑过。 */
export function checkVectors (rustText, manifest) {
  const n = manifest.vectors?.length ?? 0
  if (n === 0) return { id: 'L3', ok: false, detail: '产物行为向量为 0 枚 ⇒ 枚举到空判死,不记绿' }
  if (!/for\s+v\s+in\s+manifest\(\)\.vectors|vectors\.iter\(\)/.test(rustText)) {
    return { id: 'L3', ok: false, detail: 'Rust 门体没有逐值跑产物向量的用例 ⇒ 件吃到了但没人对账(§0.9)' }
  }
  const unjudged = manifest.vectors.filter((v) => v.decision === 'unjudged').length
  return { id: 'L3', ok: true, detail: `向量 ${n} 枚(含 unjudged ${unjudged})已在 Rust 侧逐值比对` }
}

export const __test__ = { ROOT, RUST_GATE_REL, ARTIFACT_REL, checkArtifactVsSource, checkRustConsumes, checkVectors, readFace, faceFlags, Undetermined }

async function main () {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()
  let face
  try {
    face = faceFlags(argv)
    const artifactText = readFace(face, ARTIFACT_REL)
    const rustText = readFace(face, RUST_GATE_REL)
    const manifest = buildManifest(await loadTsEngines())
    const results = [
      await checkArtifactVsSource(face, { artifactText, recomputed: serialize(manifest) }),
      checkRustConsumes(rustText, manifest),
      checkVectors(rustText, manifest),
    ]
    for (const r of results) console.log(`${r.ok ? '✓' : '✗'} ${r.id} ${r.detail}`)
    const bad = results.filter((r) => !r.ok)
    console.log(`[egress-list-sync] 面=${face} 三格 ${results.length - bad.length}/${results.length} 绿`)
    process.exitCode = bad.length === 0 ? 0 : 1
  } catch (e) {
    console.error(`[egress-list-sync] 未判定: ${e?.message ?? e}`)
    process.exitCode = 2
  }
}

function selfTest () {
  const rs = []
  const ok = (n, c) => rs.push([c, n])
  const fake = { hostNames: ['fixture-host'], hostSuffixes: ['.fixture'], deniedCidrs: ['203.0.113.0/24'], rows: [{ domain: 'fixture-host' }], vectors: [{ target: 'fixture-host', decision: 'deny' }] }
  ok('两面旗同给 ⇒ 未判定', (() => { try { faceFlags(['--staged', '--worktree']); return false } catch (e) { return e instanceof Undetermined } })())
  ok('无 include ⇒ 红', !checkRustConsumes('fn a() {}', fake).ok)
  ok('include 指歪 ⇒ 红', !checkRustConsumes('include_str!("../../elsewhere/x.json")', fake).ok)
  ok('include 指对且零字面量 ⇒ 绿', checkRustConsumes(`include_str!("../../../../${ARTIFACT_REL}")`, fake).ok)
  ok('字面量被抄进门体 ⇒ 红', !checkRustConsumes(`include_str!("../../../../${ARTIFACT_REL}")\nconst X: &str = "fixture-host";`, fake).ok)
  ok('注释里的点名不算抄', checkRustConsumes(`include_str!("../../../../${ARTIFACT_REL}")\n// "fixture-host" 只在说明里`, fake).ok)
  ok('向量 0 枚 ⇒ 红(枚举到空判死)', !checkVectors('vectors.iter()', { ...fake, vectors: [] }).ok)
  ok('向量在册但 Rust 没跑 ⇒ 红', !checkVectors('fn nothing() {}', fake).ok)
  ok('向量在册且 Rust 逐值跑 ⇒ 绿', checkVectors('for v in manifest().vectors { }', fake).ok)
  let failed = 0
  for (const [pass, n] of rs) { console.log(`${pass ? '✓' : '✗'} ${n}`); if (!pass) failed += 1 }
  console.log(`[egress-list-sync:self-test] ${rs.length - failed}/${rs.length} 通过`)
  process.exitCode = failed === 0 ? 0 : 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
