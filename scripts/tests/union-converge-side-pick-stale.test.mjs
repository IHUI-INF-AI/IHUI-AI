// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 声明式选边出口的「错道 / 未命中 / 未判定」点名镜像测试(票「take-theirs 错道声明静默不消费」,2026-11-06)。
 *
 * 立因是本席实测的一次空转:`node scripts/git-sync-converge.mjs` 被 `README.en.md` 等 5 项
 * merge-file 冲突挡住,union-converge 自己提示「整路径取对侧请改用 --take-theirs,它对非活文档
 * 本来就生效」——于是按提示传了 `--take-theirs "README.en.md=<理由>"`(带等号理由,那是
 * `--take-theirs-doc` 那一族的值形态)。结果本器**一个字节都没消费这枚声明**:路径族按逐字路径
 * 查表(`takeTheirs.has(p)`),`README.en.md=<理由>` 永远查不到 ⇒ 日志照旧只复读「需人工 N」,
 * 既没说"声明未命中",也没说"值形态不被接受"。"配了一副不被消费的声明"与"没配声明"在日志里
 * 同形 —— 正是 §0.3 点名的「把没量到写成量到了」(配了清单 ≠ 这轮真放过东西)。
 * 而 doc 族(`--take-theirs-doc`)早就有这条点名判序(`plan()` 的 staleDocPicks 那一格),
 * 路径族没有 ⇒ 三族现在共用唯一实现 `staleSidePickRows`(§0.6 单一真相源,本文件不复算判据)。
 *
 * 七条成对,缺一条都不算修好:
 *   S-a 变异臂(纯函数):四种错道/未命中形态各点名一次;consumed=true 的一条绝不进射程。
 *   S-b 变异臂(端到端):带 `=<理由>` 的 --take-theirs 声明 ⇒ bad 必须当场点名,且该路径仍
 *        needHuman(证明"没消费"被说出来,而不是被读成"判过")。
 *   S-c 正控:裸路径且真被消费 ⇒ bad 一条点名都不许有(把已生效的再判一遍 = 假红)。
 *   S-d 变异臂:两侧都不存在的路径 ⇒ 未判定(§0.3:取不到输入既不冒绿也不冒红)。
 *   S-e 变异臂:对活文档做路径级选边 ⇒ 未命中,并给出 --take-theirs-doc 那条正解(与 doc 族
 *        既有提示互为反向)。
 *   S-f 回归:doc 族那句措辞逐字未漂(合并判序不等于改文案)。
 *   S-g 装车锁:plan() 必须真调用 staleSidePickRows 并把结果并进 bad;全源里那条 doc 文案
 *        只能出现一次(第二份实现 = 必然漂移)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as U } from '../union-converge.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'

const GIT = resolveGitBin() || 'git'
const here = dirname(fileURLToPath(import.meta.url))
const srcOfTool = () => readFileSync(resolve(here, '..', 'union-converge.mjs'), 'utf8')

/**
 * 夹具:clash.ts 两侧把**同一行**改成两种写法(真三方必冲突 ⇒ 走到 needHuman 那一格),
 * PROJECT_PLAN.md 两侧同改(活文档行级 union),notes.md 只在基底存在(非活文档)。
 */
function sidePickFixture() {
  const dir = mkScratch('union-sidepick-')
  const run = (...a) =>
    execFileSync(GIT, ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', ...a], {
      stdio: ['ignore', 'pipe', 'pipe'], // §12g:派生 git 必须显式接管 stdio(stdin ignore 避 EBUSY)
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
    }).trim()
  run('init', '-q', '-b', 'main')
  run('config', 'user.email', 't@t')
  run('config', 'user.name', 't')
  run('config', 'core.autocrlf', 'false') // 字节断言前钉死行尾(本机 autocrlf=true)
  writeFileSync(join(dir, 'clash.ts'), 'c1\nc2\nc3\n', 'utf8')
  writeFileSync(join(dir, 'PROJECT_PLAN.md'), 'a\nb\n', 'utf8')
  writeFileSync(join(dir, 'notes.md'), 'n-base\n', 'utf8')
  run('add', '-A')
  run('commit', '-qm', 'base')
  const base = run('rev-parse', 'HEAD')
  writeFileSync(join(dir, 'clash.ts'), 'c1\nOURS-WAY\nc3\n', 'utf8')
  writeFileSync(join(dir, 'PROJECT_PLAN.md'), 'a\nb\nours-line\n', 'utf8')
  run('add', '-A')
  run('commit', '-qm', 'ours')
  const ours = run('rev-parse', 'HEAD')
  run('checkout', '-q', '-b', 'theirs', base)
  writeFileSync(join(dir, 'clash.ts'), 'c1\nTHEIRS-WAY\nc3\n', 'utf8')
  writeFileSync(join(dir, 'PROJECT_PLAN.md'), 'a\nb\ntheirs-line\n', 'utf8')
  run('add', '-A')
  run('commit', '-qm', 'theirs')
  const theirs = run('rev-parse', 'HEAD')
  run('checkout', '-q', 'main')
  run('update-ref', 'refs/heads/main', ours)
  return { dir, base, ours, theirs }
}

const planWith = (f, { takeOurs, takeTheirs, takeTheirsDocs }) =>
  U.plan(
    f.ours,
    f.theirs,
    f.dir,
    takeOurs || new Set(),
    new Map(),
    takeTheirs || new Set(),
    null,
    null,
    null,
    null,
    null,
    takeTheirsDocs || null,
  )

const namedAs = (bad, path, flag, word) =>
  bad.some((b) => b.includes(path) && b.includes(flag) && b.includes(word))

test('S-a 变异臂(纯函数):错道/未判定/两种未命中各点名一次,已消费的一条不进射程', () => {
  const picks = [
    { flag: '--take-theirs', value: 'README.en.md=本侧这一份是被取代的', consumed: false },
    { flag: '--take-ours', value: 'ghost.ts', consumed: false, exists: false },
    { flag: '--take-theirs', value: 'PROJECT_PLAN.md', consumed: false, exists: true },
    { flag: '--take-theirs-doc', value: 'notes.md', consumed: false, exists: true },
    { flag: '--take-theirs', value: 'clash.ts', consumed: true, exists: true },
    { flag: '--take-ours', value: '  ', consumed: false },
  ]
  const rows = U.staleSidePickRows(picks, {
    liveDocs: ['PROJECT_PLAN.md', 'AGENTS.md', 'README.md'],
  })
  assert.equal(rows.length, 6 - 1, `已消费的 clash.ts 必须被跳过:${JSON.stringify(rows)}`)
  assert.ok(
    namedAs(rows, 'README.en.md=本侧这一份是被取代的', '--take-theirs', '错道'),
    `带 =理由 的路径族声明必须点名错道:${JSON.stringify(rows)}`,
  )
  assert.ok(
    namedAs(rows, 'ghost.ts', '--take-ours', '未判定'),
    `取不到输入必须落未判定:${JSON.stringify(rows)}`,
  )
  assert.ok(
    namedAs(rows, 'PROJECT_PLAN.md', '--take-theirs', '声明未命中') &&
      rows.some((b) => b.includes('PROJECT_PLAN.md') && b.includes('--take-theirs-doc')),
    `活文档被路径族选边 ⇒ 未命中并给出 doc 族正解:${JSON.stringify(rows)}`,
  )
  assert.ok(
    rows.some((b) => b.includes('notes.md') && b.includes('--take-theirs-doc 声明未命中')),
    `doc 族声明非活文档 ⇒ 未命中:${JSON.stringify(rows)}`,
  )
  assert.ok(
    rows.some((b) => b.includes('值为空') && b.includes('未判定')),
    `空值声明必须点名:${JSON.stringify(rows)}`,
  )
})

test('S-b 变异臂(端到端):--take-theirs 写成 <path>=<理由> ⇒ 当场点名错道,且仍照旧 needHuman', () => {
  const f = sidePickFixture()
  try {
    const p = planWith(f, { takeTheirs: new Set(['clash.ts=本侧这一份是被取代的那一份']) })
    assert.ok(
      namedAs(p.bad, 'clash.ts', '--take-theirs 错道声明', '不记通过'),
      `错道声明必须进落地闸清单(此前它一个字都不说):${JSON.stringify(p.bad)}`,
    )
    assert.ok(
      p.needHuman.some((h) => h.path === 'clash.ts'),
      `声明没被消费 ⇒ 该路径仍按人工裁决呈现,不得被读成已放过:${JSON.stringify(p.needHuman.map((h) => h.path))}`,
    )
    assert.equal(
      p.keptTheirs.length,
      0,
      `一枚都不许被记成"取对侧已生效":${JSON.stringify(p.keptTheirs)}`,
    )
  } finally {
    rmScratch(f.dir, { bestEffort: true })
  }
})

test('S-c 正控:裸路径且真被消费 ⇒ 一条点名都不产生(把已生效的再判一遍就是假红)', () => {
  const f = sidePickFixture()
  try {
    const p = planWith(f, { takeTheirs: new Set(['clash.ts']) })
    assert.ok(p.keptTheirs.includes('clash.ts'), `声明必须真生效:${JSON.stringify(p.keptTheirs)}`)
    assert.equal(
      p.bad.filter((b) => b.includes('错道') || b.includes('声明未命中') || b.includes('未判定'))
        .length,
      0,
      `消费掉的声明不得换来任何点名:${JSON.stringify(p.bad)}`,
    )
  } finally {
    rmScratch(f.dir, { bestEffort: true })
  }
})

test('S-d 变异臂:声明两侧都不存在的路径 ⇒ 未判定(不冒绿也不冒充"没声明过")', () => {
  const f = sidePickFixture()
  try {
    const p = planWith(f, { takeOurs: new Set(['no-such-path.ts']) })
    assert.ok(
      namedAs(p.bad, 'no-such-path.ts', '--take-ours', '未判定'),
      `路径取不到必须写未判定:${JSON.stringify(p.bad)}`,
    )
  } finally {
    rmScratch(f.dir, { bestEffort: true })
  }
})

test('S-e 变异臂:对活文档做路径级选边 ⇒ 未命中并点名 doc 族正解', () => {
  const f = sidePickFixture()
  try {
    const p = planWith(f, { takeTheirs: new Set(['PROJECT_PLAN.md']) })
    assert.ok(
      namedAs(p.bad, 'PROJECT_PLAN.md', '声明未命中', '--take-theirs-doc'),
      `活文档那一格必须告诉调用方正解是哪族:${JSON.stringify(p.bad)}`,
    )
    assert.ok(
      p.keptTheirsDocs.length === 0 && !p.keptTheirs.includes('PROJECT_PLAN.md'),
      `路径级选边对活文档结构上不生效(留痕不得出现"已生效"):${JSON.stringify([p.keptTheirs, p.keptTheirsDocs])}`,
    )
  } finally {
    rmScratch(f.dir, { bestEffort: true })
  }
})

test('S-f 回归:doc 族那条既有文案逐字未漂(合并判序 ≠ 改文案)', () => {
  const f = sidePickFixture()
  try {
    const p = planWith(f, { takeTheirsDocs: new Set(['notes.md']) })
    assert.ok(
      p.bad.some(
        (b) => b.includes('notes.md') && b.includes('声明未命中') && b.includes('--take-theirs'),
      ),
      `T-Doc-e 钉过的那句必须仍然成立:${JSON.stringify(p.bad)}`,
    )
  } finally {
    rmScratch(f.dir, { bestEffort: true })
  }
})

test('S-g 装车锁:plan() 真调用 staleSidePickRows 并把结果并进 bad;doc 文案全源只一份', () => {
  const src = srcOfTool()
  assert.match(
    src,
    /const staleSidePicks = staleSidePickRows\(sidePicks, \{ liveDocs: LIVE_DOCS \}\)/,
    'plan() 必须调用三族共用的那条判序(判据造好没装车 = 没有,§0.9)',
  )
  assert.match(src, /\.\.\.staleSidePicks,/, '点名结果必须真并进落地闸 bad')
  // 单一真相源的牙:同一条 doc 族文案在全源只许出现一次(出现在实现里),
  // 第二次出现(比如在 plan() 里另写一份循环)就是漂移的开始。
  const occurrences = src
    .split('\n')
    .filter((l) => l.includes('声明未命中(该路径存在但不在活文档清单')).length
  assert.equal(occurrences, 1, `doc 族点名文案出现 ${occurrences} 次,判据被写了第二份(§0.6)`)
  assert.ok(
    !/for \(const d of takeDocPaths\(takeTheirsDocs\)\) \{/.test(src),
    'plan() 里那段旧的 doc 族专用循环必须已被共用判序取代',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
