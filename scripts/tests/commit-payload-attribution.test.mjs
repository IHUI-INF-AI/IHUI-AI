// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-920 载荷归因出口的镜像测试(§22c:判据只引实现那一份,本文件不得再算一遍)。
 *
 * 钉住的四型必须**互相可分辨**(少一型就可能把"我们那枚被灌了内容"和"我们的东西被他人那枚带走"
 * 读成同一句话),而且建议要与形态绑死 —— 2026-10-14 晚的真实事故里,旧实现把①型报成"未能定位本次
 * 提交"并建议 `git reset HEAD~1`,而当时 HEAD~1 已是他人的提交(照做就退掉别人的活)。
 *
 * 另有一条**接线锁**:判据住在 lib,只有当 `safe-commit.mjs` 真引它、真按形态分支走,才算装上
 * (§0.9"造好没装车"是本仓最高频失效型)。这条用源码文本判,不 import safe-commit —— 它是直线执行
 * 脚本、没有 §22d 守卫,import 一次就等于真跑一遍提交流程。
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { gitStagedPaths, gitStagedStatusEntries } from '../lib/git-paths.mjs'
import {
  adviceFor,
  classifyConcurrentCommits,
  diffForeignIndexEntries,
  foreignEntryAdvice,
} from '../lib/commit-payload-attribution.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const files = (map) => (sha) => map[sha] ?? []

test('A1 clean:载荷恰好等于声明集 ⇒ 判 clean 且不改退出码', () => {
  const map = { s1: ['a.ts', 'b.ts'] }
  const r = classifyConcurrentCommits({
    newShas: ['s1'],
    filesOf: files(map),
    expected: ['a.ts', 'b.ts'],
  })
  assert.equal(r.kind, 'clean')
  assert.equal(adviceFor(r.kind).exit, 0)
  assert.deepEqual(adviceFor(r.kind).lines, [])
})

test('A2 ①型:标题是本次的那枚、载荷却含他人 staged 路径 ⇒ polluted-ours,建议里禁止 reset HEAD~1', () => {
  const map = { s1: ['a.ts', 'b.ts', 'their-wip.ts'], s2: ['unrelated.ts'] }
  const subj = { s1: 'chore(ours): 本票', s2: 'fix(theirs): 别家' }
  const r = classifyConcurrentCommits({
    newShas: ['s2', 's1'],
    filesOf: files(map),
    expected: ['a.ts', 'b.ts'],
    subjectOf: (sha) => subj[sha] ?? '',
    ourSubject: 'chore(ours): 本票',
  })
  assert.equal(r.kind, 'polluted-ours')
  assert.equal(r.sha, 's1', '必须点名我们那一枚,而不是"未能定位"')
  assert.deepEqual(r.extraFiles, ['their-wip.ts'])
  const adv = adviceFor(r.kind)
  assert.equal(adv.exit, 1)
  assert.match(adv.lines.join('\n'), /不要.*git reset HEAD~1/, '这一型的建议必须明确禁止照旧 reset')
})

test('A2b 保守臂:拿不到标题时,"含声明集+外来件"仍判 polluted-ours(宁可多喊一次,不静默)', () => {
  const map = { s1: ['a.ts', 'b.ts', 'their-wip.ts'] }
  const r = classifyConcurrentCommits({
    newShas: ['s1'],
    filesOf: files(map),
    expected: ['a.ts', 'b.ts'],
  })
  assert.equal(r.kind, 'polluted-ours')
  assert.deepEqual(r.extraFiles, ['their-wip.ts'])
})

test('A3 ②型:含我们路径的那枚**不是**本次标题 ⇒ carried-by-other 并点名 carrier 与它带走的路径', () => {
  const map = { s1: ['x.ts'], s2: ['a.ts', 'b.ts', 'theirs.ts'] }
  const subj = { s1: 'docs: 无关', s2: 'fix(autostart): …' }
  const r = classifyConcurrentCommits({
    newShas: ['s1', 's2'],
    filesOf: files(map),
    expected: ['a.ts', 'b.ts'],
    subjectOf: (sha) => subj[sha] ?? '',
    ourSubject: 'chore(plan): 本会话的收尾件',
  })
  assert.equal(r.kind, 'carried-by-other')
  assert.equal(r.carriers.length, 1)
  assert.equal(r.carriers[0].sha, 's2')
  assert.deepEqual(r.carriers[0].carried, ['a.ts', 'b.ts'])
  assert.match(r.carriers[0].subject, /fix\(autostart\)/)
  assert.equal(adviceFor(r.kind).exit, 1, '"落地在他人标题下"不是成功,必须喊')
})

test('A4 unlocated 与 A5 空区间:两者都不冒充①/②', () => {
  const r = classifyConcurrentCommits({
    newShas: ['s1'],
    filesOf: files({ s1: ['other.ts'] }),
    expected: ['a.ts'],
  })
  assert.equal(r.kind, 'unlocated')
  const empty = classifyConcurrentCommits({ newShas: [], filesOf: files({}), expected: ['a.ts'] })
  assert.equal(empty.kind, 'unlocated')
  assert.match(empty.reason, /零枚新提交/)
})

test('A6 反证:把 lib 从 safe-commit 里摘掉 ⇒ 接线锁必须红(判据不能只是躺在 lib 里没人调)', () => {
  const src = readFileSync(join(here, '..', 'safe-commit.mjs'), 'utf8')
  assert.match(src, /from '\.\/lib\/commit-payload-attribution\.mjs'/, 'safe-commit 必须引这份唯一出口')
  assert.match(src, /classifyConcurrentCommits\(/, '必须真调分类器')
  assert.match(src, /adviceFor\(/, '处置建议必须与形态同处产出,不得另抄一份措辞')
  // 形态分支齐备(缺一型就会把两种相反的错位读成同一句话)
  for (const k of ['polluted-ours', 'carried-by-other', 'unlocated'])
    assert.ok(src.includes(`'${k}'`), `缺形态分支 ${k}`)
  // 旧的那句危险建议不得再以"唯一出路"出现
  assert.doesNotMatch(src, /建议立即: git reset HEAD~1/, '污染型的旧建议语必须已被形态化建议取代')
})

// ─── B 系列:G-920 **前置**护栏(发令前复量共享索引的差值棘轮)────────────────
// 与 A 系列同源同理:判据只引 lib 那一份(§22c),本文件不复算。
// B3 是这一半的**命门**:它证明"外来件"判的是**窗口期新增**而不是**存量水位**。
// 那条一旦退化成"索引里有外来件就拒",在多会话环境下就是恒红;恒红尺子的唯一出路是
// 被人绕回裸 `git commit` 跳门(§12e),连带该枚提交上的全部守门一起作废 ⇒ 比不装更坏。

const foreign = (baseline, current, expected) =>
  diffForeignIndexEntries({ baseline, current, expected })

test('B1 正控(结构):窗口期内索引面无变化 ⇒ 不拦', () => {
  const r = foreign(['a.ts', 'b.ts'], ['a.ts', 'b.ts'], ['a.ts', 'b.ts'])
  assert.equal(r.blocking, false)
  assert.deepEqual(r.newEntries, [])
  assert.equal(r.baselineForeign.length, 0)
  assert.equal(r.currentForeign.length, 0)
})

test('B2 窗口期新进外来件 ⇒ 当场判红并点名路径(普通提交会把它一起交出去)', () => {
  const r = foreign(['a.ts', 'b.ts'], ['a.ts', 'b.ts', 'their-wip.ts'], ['a.ts', 'b.ts'])
  assert.equal(r.blocking, true)
  assert.deepEqual(r.newEntries, ['their-wip.ts'])
})

test('B3 棘轮命门:取样时已在外来水位里的 ⇒ **不拦**(否则多会话下恒红)', () => {
  const r = foreign(
    ['a.ts', 'b.ts', 'their-wip.ts'],
    ['a.ts', 'b.ts', 'their-wip.ts'],
    ['a.ts', 'b.ts'],
  )
  assert.equal(r.blocking, false, '既有外来水位不是本次窗口期引入的,不许拦')
  assert.deepEqual(r.newEntries, [])
  assert.deepEqual(r.currentForeign, ['their-wip.ts'], '不拦 ≠ 不记账:水位必须照实报出')
})

test('B4 棘轮只认增量:新进的才进 newEntries,既有的不重复点名', () => {
  const r = foreign(
    ['a.ts', 'their-wip.ts'],
    ['a.ts', 'their-wip.ts', 'another-wip.ts'],
    ['a.ts'],
  )
  assert.equal(r.blocking, true)
  assert.deepEqual(r.newEntries, ['another-wip.ts'])
})

test('B5 resolved:窗口期内从索引消失的外来件只记账、不拦(它进不了本枚提交)', () => {
  const r = foreign(['a.ts', 'their-wip.ts'], ['a.ts'], ['a.ts'])
  assert.equal(r.blocking, false)
  assert.deepEqual(r.resolved, ['their-wip.ts'])
})

test('B6 归一化:./ 前缀与反斜杠不得产出幽灵外来件(中文路径下最难自查的错读)', () => {
  const r = foreign(['./a.ts', 'dir\\b.ts'], ['a.ts', 'dir/b.ts'], ['a.ts', 'dir/b.ts'])
  assert.equal(r.blocking, false)
  assert.deepEqual(r.newEntries, [])
})

test('B7 变异验证:把"只拦新增"退化成"有外来件就拦" ⇒ B3 必须转红(棘轮是被真覆盖的,不是装饰)', async () => {
  const libPath = join(here, '..', 'lib', 'commit-payload-attribution.mjs')
  const src = readFileSync(libPath, 'utf8')
  const needle = 'blocking: newEntries.length > 0'
  assert.ok(src.includes(needle), '源脚本里必须有这一行(本锁钉的就是它)')

  const dir = mkScratch('g920-ratchet-mutation')
  try {
    const mutantPath = join(dir, 'mutant.mjs')
    // 变异:忽略 baseline,变成存量判定 ⇒ 多会话环境下恒红
    writeFileSync(mutantPath, src.replace(needle, 'blocking: currentForeign.length > 0'), 'utf8')
    const mutant = await import(pathToFileURL(mutantPath).href)
    const m = mutant.diffForeignIndexEntries({
      baseline: ['a.ts', 'their-wip.ts'],
      current: ['a.ts', 'their-wip.ts'],
      expected: ['a.ts'],
    })
    assert.equal(
      m.blocking,
      true,
      '退化成存量判定后 B3 必须转红 ⇒ 说明这条用例真的咬住了棘轮语义',
    )
    // 对照组:未变异的那一份在同一组输入下必须绿(证明差异**只**来自这一行)
    const pristine = foreign(['a.ts', 'their-wip.ts'], ['a.ts', 'their-wip.ts'], ['a.ts'])
    assert.equal(pristine.blocking, false)
  } finally {
    rmScratch(dir)
  }
})

test('B8 接线锁:前置护栏必须在**两处**发令前都被调用,且拒发走 exit 1', () => {
  const src = readFileSync(join(here, '..', 'safe-commit.mjs'), 'utf8')
  assert.match(src, /gitStagedStatusEntries/, '取材要走 lib 的带状态出口,不自己拆 -z 帧')
  const calls = src.match(/rejectIfForeignEnteredIndex\(/g) ?? []
  assert.ok(calls.length >= 2, `前置护栏调用点必须覆盖两处发令(现状 ${calls.length} 处)`)
  const iFirst = src.indexOf('commitArgs(false)')
  const iSecond = src.indexOf('commitArgs(true)')
  assert.ok(iFirst > 0 && iSecond > 0, '两处发令点都必须还在')
  const guarded = (idx) => src.lastIndexOf('rejectIfForeignEnteredIndex(', idx) > 0
  assert.ok(guarded(iFirst), '首次发令前必须复量索引')
  assert.ok(guarded(iSecond), '跳门重试也是一次整索引提交,同样必须复量')
  // T1 端必须存在,且取的是**全量**索引面(声明集留到判据里减)
  assert.match(src, /const stagedBaselineAtStep3 = stagedFiles\.map\(normalize\)/)
})

test('B9 反证:前置护栏**不得**给出行内豁免 env(票面硬约束)', () => {
  const adv = foreignEntryAdvice()
  assert.equal(adv.exit, 1)
  const text = adv.lines.join('\n')
  assert.doesNotMatch(text, /IHUI_SKIP_[A-Z_]+/, '不得新增"一键关掉这道闸"的行内豁免通道')
  assert.match(text, /object-space-land\.mjs/, '出路必须是换工具(commit-tree 只交声明集),不是加开关')
})

// ─── C 系列:真仓夹具 ────────────────────────────────────────────────────────
// B 系列用的是纯函数夹具,证明的是**判据**。这里在真 git 仓上再走一遍"取材 → 判据"
// 的整条链,专门钉两处只能在真仓暴露的错读:
//  ① 中文名路径被 core.quotePath 八进制转写(D171 的事故原形);
//  ② `--name-status -z` 的帧形是 `<status>NUL<path>NUL` 交替 —— 若按 `--name-only` 的
//     帧形去 split,状态字母会被当成一条路径,报出来的"外来件"里全是 A/M/D 幽灵。
// 这两条夹具测不出来:不跑真 git,两种错读都不会发生。

const gitIn = (dir, args) =>
  execFileSync('git', ['-C', dir, ...args], { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', windowsHide: true })

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'g920-'))
  gitIn(dir, ['init', '-q', '-b', 'main'])
  for (const [k, v] of [
    ['user.email', 't@example.com'],
    ['user.name', 'T'],
    ['commit.gpgsign', 'false'],
    ['core.autocrlf', 'false'],
  ])
    gitIn(dir, ['config', k, v])
  writeFileSync(join(dir, 'base.txt'), 'base\n', 'utf8')
  gitIn(dir, ['add', '--', 'base.txt'])
  gitIn(dir, ['commit', '-q', '-m', 'base'])
  return dir
}

test('C1 真仓:窗口期新进一条中文名外来件 ⇒ 判红并点名**真路径**(非八进制转写)', () => {
  const dir = makeRepo()
  try {
    writeFileSync(join(dir, 'mine.txt'), 'mine\n', 'utf8')
    writeFileSync(join(dir, '他人-在飞件.txt'), 'theirs\n', 'utf8')
    gitIn(dir, ['add', '--', 'mine.txt'])
    const baseline = gitStagedPaths({ root: dir })
    assert.deepEqual(baseline, ['mine.txt'], '基线应当恰是本票声明面')

    // 模拟并发会话在窗口期内把它的在飞件放进了共享索引
    gitIn(dir, ['add', '--', '他人-在飞件.txt'])
    const current = gitStagedPaths({ root: dir })

    const r = diffForeignIndexEntries({ baseline, current, expected: ['mine.txt'] })
    assert.equal(r.blocking, true)
    assert.deepEqual(r.newEntries, ['他人-在飞件.txt'], '必须报真路径,不是转写后的字面量')
    // 反向对照:本票件不许被读成外来件(否则会自己拒自己)
    assert.ok(!r.newEntries.includes('mine.txt'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('C2 真仓棘轮对照:取样时已在外来水位里 ⇒ 不拦', () => {
  const dir = makeRepo()
  try {
    writeFileSync(join(dir, 'mine.txt'), 'mine\n', 'utf8')
    writeFileSync(join(dir, '他人-在飞件.txt'), 'theirs\n', 'utf8')
    gitIn(dir, ['add', '--', 'mine.txt', '他人-在飞件.txt'])
    const baseline = gitStagedPaths({ root: dir })
    const r = diffForeignIndexEntries({ baseline, current: baseline, expected: ['mine.txt'] })
    assert.equal(r.blocking, false, '既有外来水位不是本窗口引入的,拦它就是恒红')
    assert.deepEqual(r.currentForeign, ['他人-在飞件.txt'], '不拦 ≠ 不记账')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('C3 真仓:`gitStagedStatusEntries()` 的 -z 交替帧解析 ⇒ 状态与真路径成对', () => {
  const dir = makeRepo()
  try {
    writeFileSync(join(dir, '新增件.txt'), 'a\n', 'utf8')
    gitIn(dir, ['add', '--', '新增件.txt'])
    gitIn(dir, ['rm', '--cached', '-q', '--', 'base.txt'])
    const entries = gitStagedStatusEntries({ root: dir })
    assert.ok(entries.length >= 2, `应当取到多条带状态条目(现状 ${entries.length})`)
    for (const e of entries) {
      assert.ok(/^[AMDTR]?$/.test(e.status), `状态字母形态异常:${e.status}`)
      assert.ok(e.path.length > 0, '路径不得为空')
      assert.ok(!/^[AMDTR]$/.test(e.path), `把状态码读成了路径(幽灵外来件):${e.path}`)
    }
    const byName = new Map(entries.map((e) => [e.path, e.status]))
    assert.equal(byName.get('新增件.txt'), 'A')
    assert.equal(byName.get('base.txt'), 'D')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
