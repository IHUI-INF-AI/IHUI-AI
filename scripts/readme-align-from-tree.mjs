#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 把 README（与 README.en）的生成块刷成"某一棵树自身自洽"的取值（2026-11-18）。
 *
 * ── 为什么需要它（实测根因，不是推测）────────────────────────────────────────
 * 唯一写入口 `scripts/sync-readme-numbers.mjs` 按**索引面**取数，它的设计假设是
 * "索引 == 提交之后会变成的 HEAD 面"。但本仓多会话共享同一个索引（实测 6 席并发、
 * 索引里常年挂 60+ 个别人的暂存文件），该假设不成立：
 *   2026-11-18 同刻两面读数 —— head 面 testFiles **5829** / trackedFiles **22774**，
 *   索引面 testFiles **5792** / trackedFiles **22715**（少 37 / 59）。
 * ⇒ 写进 README 的数字天然偏小 ⇒ 与被推送的那棵树不自洽 ⇒ 每次 push 都要手工
 *   "刷到此刻再推"，而推的是"那棵树"，刷完下一次又漂。
 *
 * ── 本器做什么（不新造第二份写实现）──────────────────────────────────────────
 * 仍调唯一写入口，只是把它的取材面换成"某一棵树"：
 *   ① 备份工作树 README（不污染别人的草稿，结束即还原）
 *   ② 临时索引 `git read-tree <treeish>` ⇒ sync 读到的 staged 面 == 该树面
 *   ③ 跑 sync（独占写锁、writer 令牌、写盘前后 CAS 复核全部沿用，判据零改动）
 *   ④ 从工作树读回刷好的内容，立即还原工作树
 *   ⑤ 写到 --out（缺省写到 .ihui-agent/tmp/README.aligned-<tree>.md）
 *
 * ── 收敛性（一轮即够，写进注释免得下次有人加轮次）──────────────────────────────
 * 设 T1 = "要提交的代码树 + 旧 README"。按 T1 取数得 README'，T2 = 代码树 + README'。
 * README 自身不计入 trackedFiles 的增量（它在 T1 里已经在），故 T2 面读数 == T1 面读数
 * ⇒ 一轮收敛，无需迭代。
 *
 * ── 用法 ────────────────────────────────────────────────────────────────────
 *   node scripts/readme-align-from-tree.mjs --tree HEAD
 *   node scripts/readme-align-from-tree.mjs --tree <40 位 tree|commit> --out <路径>
 *   node scripts/readme-align-from-tree.mjs --tree HEAD --only README.md --out <路径>
 *
 * 退出码：0 = 已产出；2 = 无法判定（取不到树 / sync 拒绝 / 还原失败均显式点名）。
 */

import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

const ROOT = process.env.IHUI_REPO_ROOT ? resolve(process.env.IHUI_REPO_ROOT) : process.cwd()
const GIT = process.env.IHUI_GIT_EXE || 'git'

/** 本器认的两篇被审文档；`--only` 只用来限制"报告哪一篇"，两篇都会被刷（单源同轮）。 */
const DOCS = ['README.md', 'README.en.md']

function readArg(argv, name) {
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === name) {
      const v = argv[i + 1]
      return v && !v.startsWith('-') ? v : null
    }
    if (a.startsWith(`${name}=`)) return a.slice(name.length + 1) || null
  }
  return null
}

function fail(msg) {
  console.error(`❌ 无法判定：${msg}`)
  process.exit(2)
}

const argv = process.argv.slice(2)
const treeish = readArg(argv, '--tree') ?? 'HEAD'
const only = readArg(argv, '--only')
const outArg = readArg(argv, '--out')

if (only && !DOCS.includes(only)) fail(`--only 只认 ${DOCS.join(' / ')}，收到 ${only}`)

const run = (args, extraEnv = {}) =>
  execFileSync(GIT, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...extraEnv },
  })

// ① 先确认树可读（取不到就显式未判定，不猜）
try {
  run(['rev-parse', '--verify', `${treeish}^{tree}`])
} catch (e) {
  fail(`取不到树 ${treeish}（${e?.stderr?.trim() || e?.message || '未知'}）`)
}

// ② 备份工作树文档（工作树可能挂着别人的重排草稿，绝不能丢）
const backups = new Map()
for (const rel of DOCS) {
  const abs = join(ROOT, rel)
  if (existsSync(abs)) {
    const bak = `${abs}.align-bak-${process.pid}`
    copyFileSync(abs, bak)
    backups.set(abs, bak)
  }
}

const idxPath = join(tmpdir(), `ihui-readme-align-${process.pid}-${Date.now()}.idx`)
let restored = true

try {
  // ③ 临时索引 = 目标树 ⇒ sync 的 staged 面就等价于该树面
  run(['read-tree', `${treeish}^{tree}`], { GIT_INDEX_FILE: idxPath })

  // ④ 跑唯一写入口（判据、锁、CAS 全沿用，一个参数都没改）
  execFileSync(process.execPath, [join(ROOT, 'scripts', 'sync-readme-numbers.mjs')], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_INDEX_FILE: idxPath, IHUI_REPO_ROOT: ROOT },
  })

  // ⑤ 从工作树读回结果，写 --out
  const target = DOCS.filter((rel) => !only || rel === only)
  const produced = []
  for (const rel of target) {
    const abs = join(ROOT, rel)
    if (!existsSync(abs)) fail(`刷完之后 ${rel} 不在工作树（sync 未写盘？）`)
    produced.push({ rel, text: readFileSync(abs, 'utf8') })
  }

  const out = outArg
    ? resolve(ROOT, outArg)
    : join(ROOT, '.ihui-agent', 'tmp', `README.aligned-${process.pid}.md`)
  mkdirSync(dirname(out), { recursive: true })

  if (produced.length === 1 && produced[0].rel === 'README.md') {
    writeFileSync(out, produced[0].text, 'utf8')
  } else {
    // 两篇都给时各写一份，后缀与文档同名，避免把 en 正文怼进 zh 文件
    for (const p of produced) {
      const suffix = p.rel === 'README.md' ? '' : `.${p.rel.split('.').slice(-2).join('.')}`
      const p2 = suffix ? `${out}${suffix}` : out
      writeFileSync(p2, p.text, 'utf8')
      console.log(`已写出：${p2.replace(`${ROOT}/`, '').replace(`${ROOT}\\`, '')}`)
    }
  }
  if (produced.length === 1 && produced[0].rel === 'README.md') {
    console.log(`已写出：${out.replace(`${ROOT}/`, '').replace(`${ROOT}\\`, '')}`)
  }

  // ⑥ 把刷到的关键读数亮出来，便于当场核"是否与树自洽"
  const block = produced.find((p) => p.rel === 'README.md')?.text ?? ''
  for (const key of ['testFiles', 'trackedFiles', 'apiRoutes', 'apiRouteFiles']) {
    const m = new RegExp(`\\|\\s*[^|]*\\|\\s*([\\d,]+)\\s*\\|\\s*\`${key}\`\\s*\\|`).exec(block)
    console.log(`  ${key} = ${m ? m[1] : '（块内无此行）'}`)
  }
} finally {
  // ⑦ 无条件还原工作树（失败也不留污染）
  for (const [abs, bak] of backups) {
    try {
      copyFileSync(bak, abs)
      rmSync(bak, { force: true })
    } catch {
      restored = false
    }
  }
  for (const abs of DOCS) {
    const absPath = join(ROOT, abs)
    // 工作树原本没有这篇 ⇒ 本次产物也不留在工作树
    if (!backups.has(absPath) && existsSync(absPath)) rmSync(absPath, { force: true })
  }
  rmSync(idxPath, { force: true })
}

if (!restored) fail('工作树还原失败：请检查是否残留 *.align-bak-<pid> 文件，勿提交')
console.log('✅ 完成（工作树已还原，只有 --out 产物留在磁盘）')
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
