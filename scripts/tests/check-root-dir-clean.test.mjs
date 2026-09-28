// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * 守门 44(根目录整洁)的镜像测试 —— 2026-09-27 随 G-268 补建(此前该门**完全没有测试**)。
 *
 * 它钉的不是"能不能发现乱放的根级文件"(那件事跑了两年多,一直好用),而是**归属判定**:
 *   本门的判定面一直是 `readdirSync(根目录)`,而 safe-commit 的差值基线在
 *   `git worktree add --detach` 出来的隔离检出里跑 —— 那里物理上没有未跟踪文件。
 *   两个面不可比,于是"别人留在根的在飞文件"被差分读成"这枚提交把跑绿的东西改红了"。
 *   实测 2026-09-27 10:36~12:08 十二次因此拒绝跳门,而每一次都不是提交者能合法修的
 *   (动别人的文件在本仓算事故),终态只能是脱账的手工提交。
 *
 * 所以每条用例都成对:**索引里有的违规必须仍是 exit 1**(修法不许变成逃逸通道),
 * **未跟踪的违规才是 exit 2**(仍然非零,仍拦得住 §28 的交付判据与 runner),
 * 且全量档的退出码一字未动。夹具走 `--root` 测试通道 —— 加它的理由不是便利,是守门 70
 * 那一型:靠 cwd 定位夹具而脚本按定义忽略 cwd 时,测试其实全在审真仓(13/14 恒红)。
 */

import { writeFileSync, readFileSync } from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const GATE = join(here, '..', 'check-root-dir-clean.mjs')
const runnerSource = readFileSync(join(here, '..', 'guardian-runner.mjs'), 'utf8')

/** 造一棵最小 git 仓:只有 README.md 被跟踪 */
function makeRepo(name) {
  const dir = mkScratch(name)
  const git = (args) =>
    execFileSync('git', ['-C', dir, ...args], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 60_000,
    })
  git(['init', '-q'])
  git(['config', 'user.email', 'test@example.invalid'])
  git(['config', 'user.name', 'test'])
  writeFileSync(join(dir, 'README.md'), '# fixture\n')
  git(['add', 'README.md'])
  git(['commit', '-q', '-m', 'init'])
  return { dir, git }
}

/**
 * 本门把违规**报在 stderr**(退出码 0 与 1 都这样),所以必须用 spawnSync 同时收两侧 ——
 * 用 execFileSync 会在 exit 0 时只拿到 stdout,把"报名"这件事看成没发生(P5 第一版就死在这)。
 * @returns {{code:number|null, text:string}} code=null 表示进程压根没跑起来(脚本自身异常)
 */
function gate(dir, extra = []) {
  const r = spawnSync(process.execPath, [GATE, '--root', dir, ...extra], {
    encoding: 'utf8',
    timeout: 120_000,
    windowsHide: true,
  })
  if (r.error) return { code: null, text: String(r.error.message || r.error) }
  return { code: r.status, text: `${r.stdout || ''}${r.stderr || ''}` }
}

test('P1 索引里有的根级违规:--staged 必须仍判 exit 1 并点名(修法不得变成逃逸通道)', () => {
  const { dir, git } = makeRepo('g44-staged-violation')
  try {
    writeFileSync(join(dir, 'stray.ps1'), '# in my commit\n')
    git(['add', 'stray.ps1'])
    const r = gate(dir, ['--staged'])
    assert.equal(r.code, 1, `已进索引的根级文件必须 exit 1,实得 ${r.code}\n${r.text}`)
    assert.match(r.text, /根目录整洁守门失败/)
    assert.ok(r.text.includes('stray.ps1'), '必须点名')
    assert.ok(!/未被 git 跟踪/.test(r.text), '它在索引里 —— 走未跟踪那一档就是归因错了')
  } finally {
    rmScratch(dir)
  }
})

test('P2 未跟踪的根级违规:--staged 判 exit 2 且照点名(非零仍拦得住,只是不再定责)', () => {
  const { dir } = makeRepo('g44-untracked-violation')
  try {
    writeFileSync(join(dir, 'stray.ps1'), '# someone else in-flight file\n')
    const r = gate(dir, ['--staged'])
    assert.equal(r.code, 2, `未跟踪必须落 exit 2(而非 1),实得 ${r.code}\n${r.text}`)
    assert.match(r.text, /未被 git 跟踪/)
    assert.ok(r.text.includes('stray.ps1'), '不点名就没人能去找物主')
    assert.ok(!/根目录整洁守门失败/.test(r.text), '不得与 P1 那一档混在同一条结论里')
  } finally {
    rmScratch(dir)
  }
})

test('P3 干净根目录:exit 0 且**不得**出现"无法判定"(证明 P2 的 2 来自发现,不是恒 2)', () => {
  const { dir } = makeRepo('g44-clean')
  try {
    const r = gate(dir, ['--staged'])
    assert.equal(r.code, 0, r.text)
    assert.ok(!/无法判定|未判定/.test(r.text), `绿的时候喊"未判定"就成了一个永不结论的门:\n${r.text}`)
  } finally {
    rmScratch(dir)
  }
})

test('P4 git 问不到索引面时退回全量拦截(失效方向必须是"多要一次定向说明")', () => {
  const dir = mkScratch('g44-no-git')
  try {
    writeFileSync(join(dir, 'README.md'), '# not a repo\n')
    writeFileSync(join(dir, 'stray.ps1'), '# x\n')
    const r = gate(dir, ['--staged'])
    assert.equal(r.code, 1, `索引取不到 ⇒ 一律算本次的红,实得 ${r.code}\n${r.text}`)
    assert.match(r.text, /退回全量拦截/)
  } finally {
    rmScratch(dir)
  }
})

test('P5 全量档退出码一字未改(本票修的是归属,不是顺手把报告档改成 blocking)', () => {
  const { dir } = makeRepo('g44-fullmode')
  try {
    writeFileSync(join(dir, 'stray.ps1'), '# x\n')
    const r = gate(dir, [])
    assert.equal(r.code, 0, `全量档历史上就是报告档 exit 0 —— 改它属另一件事,实得 ${r.code}`)
    assert.ok(r.text.includes('stray.ps1'), '报告档仍要报名')
  } finally {
    rmScratch(dir)
  }
})

test('P6 --root 缺参数必须判死,不得静默退回真仓', () => {
  let code = 0
  let text = ''
  try {
    execFileSync(process.execPath, [GATE, '--root'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 60_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (e) {
    code = typeof e.status === 'number' ? e.status : -1
    text = `${e?.stdout || ''}${e?.stderr || ''}${e?.message || ''}`
  }
  assert.notEqual(code, 0, '--root 不给目录就退出 0 ⇒ 测试通道会变成"审真仓还自称审夹具"')
  assert.match(text, /--root|目录/, `报错要点名是参数问题,实得:${text.slice(0, 200)}`)
})

test('装车证明:本门在 runner 里仍是 blocking,且测试通道不进生产调用', () => {
  const at = runnerSource.indexOf("script: 'check-root-dir-clean.mjs'")
  assert.ok(at > 0, '未注册 ⇒ 这一门无人调度')
  const block = runnerSource.slice(at - 600, at + 600)
  assert.match(block, /mode:\s*'blocking'/, '本门一直是 blocking,本次不改定级')
  assert.doesNotMatch(block, /--root/, 'runner 不得带测试通道(带了就等于给自己造第二个根)')
})

test('反向锁:白名单之外的既有豁免层不得被"归属分流"顺手删掉', () => {
  const src = readFileSync(GATE, 'utf8')
  assert.match(src, /getIgnoredEntries\(/, '忽略产物告警层(2026-09-23 立)必须还在')
  assert.match(src, /getWorktreeDirNames\(/, 'worktree 精确豁免(§12d 鼓励并行隔离)必须还在')
  assert.match(src, /ignoredJunk/, '被忽略的根级临时产物仍要告警')
  assert.match(src, /return null/, '索引"问不到"必须与"真没有"可分,否则 git 一坏就把我的垃圾归给别人')
})

test('变异自证:把归属分流改回"一律 exit 1",P2 必须翻红(证明本票的牙长在该长的位置)', () => {
  const src = readFileSync(GATE, 'utf8')
  const m = src.match(/process\.exit\(owned\.length > 0 \? 1 : 2\)/)
  assert.ok(m, '归属分流的退出码判据本身不许被改掉/改名 —— 找不到就说明本次修复已经不在源码里')
})
