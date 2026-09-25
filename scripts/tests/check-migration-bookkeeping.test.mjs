// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

 
/**
 * 守门 49(check-migration-bookkeeping.mjs)B10「journal 登记表空闲性」的镜像测试。
 *
 * 为什么 spawn CLI 而不是 import 判据(AGENTS.md §22c/§22d 的已知例外形态):
 *   源脚本顶层就是 CLI 且**没有** isDirectRun 守卫(import 它会立刻跑完整个 B1-B5 并
 *   按结果 process.exit)。给它加守卫要重构 261 行主体,而本票硬约束是"退出码语义一字不动"
 *   —— 所以取证只能在进程边界做,与 `merge-live-doc-anchor.test.mjs` 同法。
 *
 * 本文件要钉死的四条(前三条是"不改变既有语义"的正反对照,第四条是取材面):
 *   T1/T2 空闲态与在飞态各跑一遍
 *   T3 B1-B5 的结论行在两态**逐字一致**
 *   T4 只有未跟踪 .sql 时也要判在飞(不因 B1-B5 绿而隐身)
 *   T5 取不到 git ⇒ 判「未判定」,绝不得记为「空闲」
 *   T6 B10 不得占用 B1-B4 的「N 条告警」计数器(否则改了既有汇总行)
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const GATE = join(REPO, 'scripts', 'check-migration-bookkeeping.mjs')
const GIT = resolveGitBin()

const ANSI = /\x1b\[[0-9;]*m/g
const strip = (s) => (s ?? '').replace(ANSI, '')

/** B10_WATCH 的五路径(与源脚本同源;改动时两处一起改) */
const WATCH = [
  'packages/database/drizzle/meta/_journal.json',
  'packages/database/src/schema/chat.ts',
  'packages/database/src/schema/relation-tables.ts',
  'apps/api/src/routes/chat.ts',
  'apps/api/src/db/chat-queries.ts',
]

const tagOf = (i) => `2026092500000${i}_mirror_fixture_${i}`

/** 造一份 B1-B5 全绿的最小记账夹具(n 条迁移) */
function writeFixture(root, n) {
  const drizzle = join(root, 'packages/database/drizzle')
  mkdirSync(join(drizzle, 'meta'), { recursive: true })
  const entries = Array.from({ length: n }, (_, i) => ({ idx: i, tag: tagOf(i), when: 1760000000000 + i * 1000 }))
  writeFileSync(join(drizzle, 'meta/_journal.json'), `${JSON.stringify({ version: 7, dialect: 'postgresql', entries }, null, 2)}\n`)
  for (const e of entries) writeFileSync(join(drizzle, `${e.tag}.sql`), 'SELECT 1;\n')
  for (const p of WATCH.slice(1)) {
    mkdirSync(dirname(join(root, p)), { recursive: true })
    writeFileSync(join(root, p), 'export {}\n')
  }
}

function gitAt(cwd, args) {
  const r = spawnSync(GIT, ['-c', 'safe.directory=*', '-c', 'user.name=f', '-c', 'user.email=f@l', '-C', cwd, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
  })
  assert.equal(r.status, 0, `git ${args.join(' ')} 失败: ${r.stderr}`)
  return r.stdout
}

/** 建一个"干净已提交"的 scratch 仓(五路径全 tracked + 无未跟踪 .sql) */
function mkCleanRepo(prefix) {
  const dir = mkScratch(prefix)
  writeFixture(dir, 2)
  gitAt(dir, ['init', '-q'])
  gitAt(dir, ['add', '-A'])
  gitAt(dir, ['commit', '-q', '--no-verify', '-m', 'fixture'])
  return dir
}

function runGate(cwd, extra = []) {
  const r = spawnSync(process.execPath, [GATE, ...extra], {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
  })
  return { code: r.status, out: strip(r.stdout), err: strip(r.stderr) }
}

/** B1-B5 的结论行(排除 B10 段里带"B1-B5"字样的自述行) */const b15Lines = (out) =>
  out
    .split(/\r?\n/)
    .filter((l) => /[✓✗!] B[1-5] /.test(l) && !l.includes('不参与 B1-B5'))

/**
 * 让 journal **只在工作树**变脏而结构不变(追加一个尾部换行)。
 * 反例存档:第一版这里写的是"整份覆盖成 entries:[]",那会让 B5 提前 process.exit(1),
 * 于是"在飞态"根本没跑到 B1-B5,T3 拿到空数组 —— 测的成了夹具而不是判据。
 */
function dirtyJournalInWorktree(dir) {
  const p = join(dir, WATCH[0])
  writeFileSync(p, `${readFileSync(p, 'utf8')}\n`)
}

test('T1 空闲态:默认档 exit 0 且 B10 报空闲', () => {
  const dir = mkCleanRepo('gate49-idle-t1')
  try {
    const r = runGate(dir)
    assert.equal(r.code, 0, r.out + r.err)
    assert.match(r.out, /B10 空闲:五路径全干净/)
    assert.ok(!/有人在飞|未判定\(无法取证\)/.test(r.out), '空闲态不得报在飞/未判定')
  } finally {
    rmScratch(dir)
  }
})

test('T2 在飞态:默认档仍 exit 0(不改变既有退出码),--require-idle 才判红', () => {
  const dir = mkCleanRepo('gate49-idle-t2')
  try {
    // 只动工作树(不 add)—— 正是"别人在飞"的形态
    dirtyJournalInWorktree(dir)
    const d = runGate(dir)
    assert.equal(d.code, 0, `B10 warn 级不得改默认退出码:\n${d.out}${d.err}`)
    assert.match(d.out, /B10 未判定,有人在飞/)
    assert.match(d.out, /_journal\.json 仅工作树脏/)
    const ri = runGate(dir, ['--require-idle'])
    assert.equal(ri.code, 1, '--require-idle 必须把在飞升成判红')
    assert.match(ri.err, /B10 --require-idle:journal 登记表非空闲 —— 有人在飞/)
  } finally {
    rmScratch(dir)
  }
})

test('T3 B1-B5 结论行在空闲/在飞两态逐字一致', () => {
  const clean = mkCleanRepo('gate49-idle-t3a')
  const dirty = mkCleanRepo('gate49-idle-t3b')
  try {
    const a = b15Lines(runGate(clean).out)
    dirtyJournalInWorktree(dirty)
    const b = b15Lines(runGate(dirty).out)
    assert.ok(a.length >= 5, `夹具的 B1-B5 结论行不足 5 条,判据失效:${a}`)
    assert.deepEqual(b, a, '在飞态不得改动 B1-B5 的任何结论行')
  } finally {
    rmScratch(clean)
    rmScratch(dirty)
  }
})

test('T4 只有未跟踪 .sql 时:B1-B5 仍绿但 B10 判在飞并点名', () => {
  const dir = mkCleanRepo('gate49-idle-t4')
  try {
    // 追加第 3 条:journal 提交落地(干净),.sql 留在未跟踪面 —— B1 靠磁盘文件仍绿
    writeFixture(dir, 3)
    gitAt(dir, ['add', '--', WATCH[0]])
    gitAt(dir, ['commit', '-q', '--no-verify', '-m', 'journal only'])
    const d = runGate(dir)
    assert.equal(d.code, 0)
    assert.match(d.out, /B1 双向一一对应\(3 ↔ 3\)/, 'B1 必须是绿的,否则本例没证到"只有未跟踪 .sql"')
    assert.match(d.out, /mirror_fixture_2\.sql 未跟踪的迁移文件\(在飞\)/)
    assert.match(d.out, /B10 未判定,有人在飞/)
    assert.equal(runGate(dir, ['--require-idle']).code, 1)
  } finally {
    rmScratch(dir)
  }
})

test('T5 取不到 git 状态:判「未判定」并给原因,绝不得记为空闲', () => {
  const dir = mkScratch('gate49-idle-t5')
  try {
    writeFixture(dir, 2) // 不 git init:整目录不在任何工作树内
    const d = runGate(dir)
    assert.equal(d.code, 0, '未判定同样不得改默认退出码')
    assert.match(d.out, /B10 未判定\(无法取证\):/)
    assert.ok(!/B10 空闲/.test(d.out), '取不到证据时记为空闲 = 把"没查"当成"查过且干净"')
    assert.equal(runGate(dir, ['--require-idle']).code, 1, '未判定在问责档下不等于通过')
  } finally {
    rmScratch(dir)
  }
})

test('T6 B10 不得占用 B1-B4 的「N 条告警」计数器(汇总行是既有语义)', () => {
  const dir = mkCleanRepo('gate49-idle-t6')
  try {
    const clean = runGate(dir)
    writeFileSync(join(dir, WATCH[1]), 'export { inFlight }\n')
    const busy = runGate(dir)
    const countLine = (o) => (o.match(/\[迁移记账\] \d+ 条告警\(非阻塞\)/) ?? ['<无>'])[0]
    assert.equal(countLine(busy.out), countLine(clean.out), 'B10 在飞不得把汇总告警计数从 0 抬上去')
    assert.ok(!/\d+ 条告警/.test(clean.out), '夹具本身应零告警,否则 T6 的前提出错')
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
