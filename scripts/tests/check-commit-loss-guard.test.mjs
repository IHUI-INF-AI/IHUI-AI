// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync, execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ } from '../check-commit-loss-guard.mjs'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-commit-loss-guard.mjs')

// ─── 辅助:创建临时 git 仓库(含初始 commit) ──────────────
function createTempRepo() {
  const dir = mkScratch('ihui-loss-')
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  execSync('git init -b main', { cwd: dir, stdio: 'ignore' })
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  execSync('git config user.email test@test.com', { cwd: dir, stdio: 'ignore' })
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  execSync('git config user.name test', { cwd: dir, stdio: 'ignore' })
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  execSync('git config commit.gpgsign false', { cwd: dir, stdio: 'ignore' })
  writeFileSync(join(dir, 'README.md'), '# init\n')
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  execSync('git add README.md', { cwd: dir, stdio: 'ignore' })
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  execSync('git commit -m "init"', { cwd: dir, stdio: 'ignore' })
  return dir
}

// 辅助:运行 check-commit-loss-guard.mjs
function runScript(args = [], opts = {}) {
  return spawnSync('node', [SCRIPT_PATH, ...args], {
    cwd: opts.cwd || process.cwd(),
    encoding: 'utf8',
    // 2026-10-04:子进程必须给 stdio(留管道取输出),否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...opts.env },
  })
}

// ─── 判据单元测试:一律驱动门体导出的那一判据(§22c) ──────
// 这一族原先在测试里抄了三份正则。其中 stash 那两条早已在 2026-10-03 被源侧从 \S+ 放宽成 \S.*?
// (detached HEAD 的分支名是含空格的 "(no branch)"),抄的那份没跟着改 ⇒ 它一路测的是自己那份**过期**
// 规则,源侧的放宽没有任何断言覆盖 —— 比"复读机"更糟一格:连复读都复读了旧版。现在只留导出口。
const RESET_REGEX = __test__.RESET_LINE_RE
const isStash = (subject) => __test__.isStashSubject(subject)
const originalHash = (subject) => __test__.extractOriginalHashFromStash(subject)

test('正则: reset: moving to HEAD~1 → 匹配', () => {
  assert.ok(RESET_REGEX.test('abc1234 HEAD@{0}: reset: moving to HEAD~1'))
})

test('正则: reset: moving to HEAD@{1} → 匹配', () => {
  assert.ok(RESET_REGEX.test('abc1234 HEAD@{0}: reset: moving to HEAD@{1}'))
})

test('正则: checkout: moving from → 不匹配(非 reset)', () => {
  assert.ok(!RESET_REGEX.test('abc1234 HEAD@{0}: checkout: moving from temp to main'))
})

test('正则: commit: → 不匹配(非 reset)', () => {
  assert.ok(!RESET_REGEX.test('abc1234 HEAD@{0}: commit: add feature'))
})

test('门体判据: WIP on main: → 识别为 stash subject', () => {
  assert.ok(isStash('WIP on main: 5ef36e59d fix sidebar'))
})

test('门体判据: index on main: → 识别为 stash subject', () => {
  assert.ok(isStash('index on main: 5ef36e59d'))
})

test('门体判据: index on fix/<branch>: → 识别为 stash subject(非 main 分支)', () => {
  assert.ok(isStash('index on fix/test-suite-cleanup-2026-08-17: 8f957984b0 fix(msg)'))
})

test('门体判据: On fix/<branch>: → 识别为 stash subject(非 main 分支)', () => {
  assert.ok(isStash('On fix/foo: 5ef36e59d fix(msg)'))
})

// 这一条是本次收口的**有牙证明**:源侧 2026-10-03 把分支名放宽成 \S.*? 才认得这一型,
// 而测试抄的那份(\S+)在这里是假阴 —— 换回抄件本条必红。它钉的不是"测试能跑",
// 是"测试测的是源里那一判据"。识别与取 hash 两半必须同判:只改识别侧会留下
// "认得出是 stash、却取不出原 hash"的新格(源侧注释明令两处同改)。
test('门体判据: 分支名含空格(detached HEAD 的 "(no branch)")→ 必须识别得出且取得出原 hash', () => {
  const subject = 'index on (no branch): 5ef36e59d wip'
  assert.ok(isStash(subject), '识别侧失配 = 该提交在备份核对里被当成普通 commit')
  assert.equal(originalHash(subject), '5ef36e59d', '只改识别侧不改取 hash 侧 = 认得出却追不回原提交')
})

test('门体判据: 普通提交 subject → 不识别为 stash', () => {
  assert.ok(!isStash('feat: add new feature'))
})

test('门体判据: 从 stash subject 提取原 commit hash;非 stash 取空而不抛', () => {
  assert.equal(originalHash('WIP on main: 5ef36e59d fix sidebar'), '5ef36e59d')
  assert.equal(originalHash('feat: add new feature'), '')
})

// ─── CLI 行为测试 ────────────────────────────────────────

test('CLI: 干净仓库无参数运行 → exit 0(无违规)', () => {
  const dir = createTempRepo()
  try {
    const r = runScript([], { cwd: dir })
    assert.equal(
      r.status,
      0,
      `干净仓库应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
    )
    assert.match(r.stdout, /无 commit 丢失风险|未检测到 reset|未检测到悬空 commit/)
  } finally {
    rmScratch(dir)
  }
})

test('CLI: --help 不崩溃(脚本未实现 --help,按默认模式运行)', () => {
  const dir = createTempRepo()
  try {
    const r = runScript(['--help'], { cwd: dir })
    assert.ok(
      r.status === 0 || r.status === 1,
      `--help 不应 crash,实际 exit ${r.status}\nstderr: ${r.stderr}`,
    )
    assert.ok(!r.stderr.includes('Error:'), `--help 不应产生 Error`)
  } finally {
    rmScratch(dir)
  }
})

test('CLI: --blocking flag 在干净仓库 → exit 0(无阻塞项)', () => {
  const dir = createTempRepo()
  try {
    const r = runScript(['--blocking'], { cwd: dir })
    assert.equal(r.status, 0, `干净仓库 +blocking 应 exit 0,实际 ${r.status}`)
  } finally {
    rmScratch(dir)
  }
})

test('CLI: --filter-stash flag 在干净仓库 → exit 0', () => {
  const dir = createTempRepo()
  try {
    const r = runScript(['--filter-stash'], { cwd: dir })
    assert.equal(r.status, 0, `干净仓库 +filter-stash 应 exit 0,实际 ${r.status}`)
  } finally {
    rmScratch(dir)
  }
})

test('CLI: HUSKY_SKIP_COMMIT_LOSS_CHECK=1 → 跳过检测 exit 0', () => {
  const dir = createTempRepo()
  try {
    const r = runScript([], { cwd: dir, env: { HUSKY_SKIP_COMMIT_LOSS_CHECK: '1' } })
    assert.equal(r.status, 0)
    assert.match(r.stdout, /已跳过/, '应显示跳过消息')
  } finally {
    rmScratch(dir)
  }
})

// ─── reflog reset 检测 ───────────────────────────────────

test('检测: reflog 含 reset: moving to HEAD~ → 命中(stdout 报告 reset)', () => {
  const dir = createTempRepo()
  try {
    // 创建第二个 commit,然后 reset 撤销 → reflog 记录 reset
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    execSync('git commit --allow-empty -m "temp-commit"', { cwd: dir, stdio: 'ignore' })
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    execSync('git reset HEAD~1', { cwd: dir, stdio: 'ignore' })
    const r = runScript([], { cwd: dir })
    assert.match(r.stdout, /reset/, 'stdout 应提及 reset')
    assert.match(r.stdout, /检测到.*reset|reset 操作/, '应报告检测到 reset')
  } finally {
    rmScratch(dir)
  }
})

test('检测: reflog 不含 reset → 不报告 reset(干净仓库)', () => {
  const dir = createTempRepo()
  try {
    const r = runScript([], { cwd: dir })
    assert.match(r.stdout, /未检测到 reset/, '应报告未检测到 reset')
  } finally {
    rmScratch(dir)
  }
})

test('检测: reset + --blocking → exit 1(阻塞模式)', () => {
  const dir = createTempRepo()
  try {
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    execSync('git commit --allow-empty -m "temp"', { cwd: dir, stdio: 'ignore' })
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    execSync('git reset HEAD~1', { cwd: dir, stdio: 'ignore' })
    const r = runScript(['--blocking'], { cwd: dir })
    assert.equal(r.status, 1, `reset + blocking 应 exit 1,实际 ${r.status}`)
    assert.match(r.stdout, /阻塞 commit|commit 丢失风险/)
  } finally {
    rmScratch(dir)
  }
})

test('检测: reset 丢掉的那一枚已打 lost-commit tag ⇒ blocking 放行(2026-10-21 判据更正)', () => {
  const dir = createTempRepo()
  try {
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    execSync('git commit --allow-empty -m "temp-dropped"', { cwd: dir, stdio: 'ignore' })
    const dropped = execSync('git rev-parse HEAD', { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    execSync('git reset HEAD~1', { cwd: dir, stdio: 'ignore' })
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    execSync(`git tag lost-commit/test-dropped ${dropped}`, { cwd: dir, stdio: 'ignore' })
    const r = runScript(['--blocking'], { cwd: dir })
    assert.equal(r.status, 0, `被丢的那枚已备份 ⇒ 应放行,实际 ${r.status}\n${r.stdout}\n${r.stderr}`)
    assert.match(r.stdout, /未检测到 reset|无 commit 丢失风险/)
  } finally {
    rmScratch(dir)
  }
})

test('判据单元: dropBackedResets 看被丢的那枚,不看 reset 后的 HEAD', () => {
  const line = 'bbbbbbb HEAD@{0}: reset: moving to HEAD~1'
  // beforeHash(被丢的 aaaaaaa)已备份、行首 bbbbbbb 未备份 ⇒ 放行
  assert.deepEqual(__test__.dropBackedResets([line], new Set(['aaaaaaa']), () => 'aaaaaaa'), [])
  // 两枚都未备份 ⇒ 保留
  assert.equal(__test__.dropBackedResets([line], new Set(['ccccccc']), () => 'aaaaaaa').length, 1)
  // 取不到 beforeHash 时退回旧行为(行首已备份 ⇒ 放行)
  assert.deepEqual(__test__.dropBackedResets([line], new Set(['bbbbbbb'])), [])
})

test('判据单元: reflogRefOf 从 ref@{} 前缀取 ref 名', () => {
  assert.equal(__test__.reflogRefOf('abc1234 refs/heads/main@{2026-10-21 16:50:22 +0800}: reset: moving to HEAD~1'), 'refs/heads/main')
  assert.equal(__test__.reflogRefOf('abc1234 HEAD@{2026-10-21 16:50:22 +0800}: reset: moving to HEAD~1'), 'HEAD')
  assert.equal(__test__.reflogRefOf(''), '')
})

// ─── fsck 悬空 commit 检测 ───────────────────────────────

test('检测: fsck 悬空 commit(分支删除) → 命中', () => {
  const dir = createTempRepo()
  try {
    // 在临时分支上创建 commit,然后删除分支 → commit 悬空
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    execSync('git checkout -b temp-branch', { cwd: dir, stdio: 'ignore' })
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    execSync('git commit --allow-empty -m "dangling-commit"', { cwd: dir, stdio: 'ignore' })
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    execSync('git checkout main', { cwd: dir, stdio: 'ignore' })
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    execSync('git branch -D temp-branch', { cwd: dir, stdio: 'ignore' })
    const r = runScript([], { cwd: dir })
    // 悬空 commit 应被检测到(可能被 tag 备份规则处理,但应出现在报告中)
    assert.match(r.stdout, /悬空 commit|dangling|unreachable|未.*备份/, '应提及悬空 commit')
  } finally {
    rmScratch(dir)
  }
})

// ─── 同内容副本白名单(G-1018289②:区分"本次引入的悬空"与"并发重写留下的同内容副本") ──
// 判据面:树 hash 与 subject **两元同时相等**才放行;索引取不到 ⇒ 白名单失效,朝红不朝绿。

test('纯函数: parseTreeSubjectIndex 解析 %T%x09%s 行(题内 tab 并入 subject,畸形行跳过)', () => {
  const keys = __test__.parseTreeSubjectIndex(
    ['abc\tinit', 'def\tsome\tsubject\twith\ttabs', 'no-tab-line', '', '\t', 'ghi\t'].join('\n'),
  )
  assert.ok(keys.has('abc\tinit'), '正常行应入集')
  assert.ok(keys.has('def\tsubject\twith\ttabs'), '题内再含 tab 应整段并入 subject')
  assert.equal(keys.size, 2, '畸形行(无 tab/空段)不得入集')
  assert.equal(__test__.parseTreeSubjectIndex('').size, 0, '空读数 → 空集')
  assert.equal(__test__.parseTreeSubjectIndex(null).size, 0, 'null → 空集')
})

test('纯函数: reachableTreeSet 从「树\\t题」键集派生可达树集(畸形行跳过)', () => {
  const trees = __test__.reachableTreeSet(
    __test__.parseTreeSubjectIndex(['t1\tinit', 't1\tother', 't2\tx'].join('\n')),
  )
  assert.deepEqual([...trees].sort(), ['t1', 't2'], '同一树不同题只收一次,树段按 \\t 切出')
  assert.equal(__test__.reachableTreeSet(null).size, 0, 'null → 空集(该档不生效)')
  assert.equal(__test__.reachableTreeSet([]).size, 0, '空索引 → 空集')
})

test('纯函数: splitReachableSameContent 三档(树+题 / 仅树 / 待处置)', () => {
  const keys = __test__.parseTreeSubjectIndex(['T1\tS1', 'T2\tother'].join('\n'))
  const trees = __test__.reachableTreeSet(keys)
  const split = __test__.splitReachableSameContent({
    candidates: ['c-same', 'c-tree-only', 'c-lost'],
    treeByCommit: new Map([
      ['c-same', 'T1'],
      ['c-tree-only', 'T2'],
      ['c-lost', 'T9'],
    ]),
    subjectByHash: new Map([
      ['c-same', 'S1'],
      ['c-tree-only', 'MY-OWN-SUBJECT'],
      ['c-lost', 'lost'],
    ]),
    reachableKeys: keys,
    reachableTrees: trees,
  })
  assert.deepEqual(split.sameContent, ['c-same'], '树+题都逐字同 → 第一档')
  assert.deepEqual(split.treeEquivalent, ['c-tree-only'], '仅树逐字同 → 等价残留档')
  assert.deepEqual(split.remaining, ['c-lost'], '树不在可达历史里 → 待处置')

  // fail-safe:索引为空(取不到)⇒ 三枚全落待处置,绝不按等价放行
  const noIdx = __test__.splitReachableSameContent({
    candidates: ['c-same', 'c-tree-only', 'c-lost'],
    treeByCommit: new Map([['c-same', 'T1'], ['c-tree-only', 'T2'], ['c-lost', 'T9']]),
    subjectByHash: new Map(),
    reachableKeys: new Set(),
    reachableTrees: new Set(),
  })
  assert.deepEqual(noIdx.remaining, ['c-same', 'c-tree-only', 'c-lost'], '索引缺位 → 全部待处置')
  assert.deepEqual(noIdx.treeEquivalent, [], '索引缺位不得产出等价残留')
})

test('同内容副本: amend 重写留下的旧对象(树+题与可达历史逐字同) → 放行不阻塞且点名', () => {
  const dir = createTempRepo()
  try {
    execSync('git commit --allow-empty -m "work-in-progress"', { cwd: dir, stdio: 'ignore' })
    // amend 生成新 commit(同树同题;空提交须带 --allow-empty),旧 commit 成悬空。
    // --date 刻意换作者时间:同一秒内 amend 会产出与旧对象**逐字相同**的 commit hash
    // (没有新对象、没有悬空),阳性对照就根本不会出现 —— 尺子必须先确认有对象可判。
    execSync('git commit --amend --no-edit --allow-empty --date="2020-01-01T00:00:00 +08:00"', {
      cwd: dir,
      stdio: 'ignore',
    })
    const r = runScript(['--blocking', '--filter-stash'], { cwd: dir })
    assert.equal(
      r.status,
      0,
      `同内容副本应放行 exit 0,实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
    )
    assert.match(r.stdout, /同内容副本放行/, '白名单放行必须点名,不得静默')
    assert.match(r.stdout, /work-in-progress/, '放行明细应带 subject')
  } finally {
    rmScratch(dir)
  }
})

// 2026-11-03 判据补细(门 30a):树与可达提交逐字同、题不同 ⇒ **等价残留**,内容整体已入库,
// 只有提交身份/题没入库 ⇒ 不 blocking,但必须点名报数。原用例断的是"仅树相等不得放行",
// 那格把"内容一字节没丢"的旧对象判成丢失风险(本仓实测 31bfb9a335c2 即此形态,只因当时
// 题也恰好同才躲过);放宽的**只有**题这一维,树必须真的在可达历史里(索引取不到仍朝红)。
test('等价残留: 树同而题不同 → 不阻塞,但逐条点名「等价残留」', () => {
  const dir = createTempRepo()
  try {
    // 分支删除造悬空(不走 reset,避免混入 reset 判据):空树与 init 相同,题唯一
    execSync('git checkout -b temp', { cwd: dir, stdio: 'ignore' })
    execSync('git commit --allow-empty -m "unique-subject-XYZ"', { cwd: dir, stdio: 'ignore' })
    execSync('git checkout main', { cwd: dir, stdio: 'ignore' })
    execSync('git branch -D temp', { cwd: dir, stdio: 'ignore' })
    const r = runScript(['--blocking', '--filter-stash'], { cwd: dir })
    assert.equal(
      r.status,
      0,
      `树等价残留不得判红,应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
    )
    assert.match(r.stdout, /等价残留 1 个/, '等价残留必须报数,不得静默放行')
    assert.match(r.stdout, /unique-subject-XYZ/, '等价残留明细应带 subject')
    assert.doesNotMatch(r.stdout, /同内容副本放行/, '题不同不得进"树+题"那一档')
    // 分档行必须恒打印:门判绿时也要能读出"存量里有几枚对象、各是什么出处"
    assert.match(
      r.stdout,
      /悬空分档:已备份 0 \/ 同内容副本 0 \/ 等价残留 1 \/ 待处置 0/,
      '判绿时也必须逐档报数,不得让存量从账面上蒸发',
    )
  } finally {
    rmScratch(dir)
  }
})

test('真丢失对照: 树不在可达历史里 → 仍 blocking(判据没被摘空)', () => {
  const dir = createTempRepo()
  try {
    // 唯一内容 ⇒ 树不在任何可达提交中;分支删除造悬空
    execSync('git checkout -b temp', { cwd: dir, stdio: 'ignore' })
    writeFileSync(join(dir, 'lost-only.txt'), 'only-on-temp-branch\n')
    execSync('git add lost-only.txt', { cwd: dir, stdio: 'ignore' })
    execSync('git commit -m "lost-work"', { cwd: dir, stdio: 'ignore' })
    execSync('git checkout main', { cwd: dir, stdio: 'ignore' })
    execSync('git branch -D temp', { cwd: dir, stdio: 'ignore' })
    const r = runScript(['--blocking', '--filter-stash'], { cwd: dir })
    assert.equal(r.status, 1, `真丢失必须判红,应 exit 1,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.doesNotMatch(r.stdout, /等价残留 1 个/, '树不在可达历史里不得按等价残留放行')
    assert.match(r.stdout, /未备份/, '真丢失须落"未备份"档')
  } finally {
    rmScratch(dir)
  }
})

// ─── 逐路径覆盖判据(2026-11-04,取代「整树相等」)────────────────

test('逐路径覆盖解析: raw -z 记录解析(A/M/D)且 old blob 必须保留、截断/坏头必须抛', () => {
  const A = 'a'.repeat(40)
  const B = 'b'.repeat(40)
  const Z = '0'.repeat(40)
  const meta = (oldSha, newSha, status) => `:100644 100644 ${oldSha} ${newSha} ${status}`
  const entries = __test__.parseRawDiffZ(
    `${meta(Z, A, 'A')}\0add.txt\0${meta(A, B, 'M')}\0mod.txt\0${meta(B, Z, 'D')}\0del.txt\0`,
  )
  // oldBlob 是收紧后 D 类判据的**唯一内容凭据**("删的确实是同一内容"),必须逐条保留;
  // A / root 的全零 old sha 折成空串,免得把"没有旧内容"当成一个真实 blob。
  assert.deepEqual(
    entries.map((e) => [e.status, e.path, e.blob, e.oldBlob]),
    [
      ['A', 'add.txt', A, ''],
      ['M', 'mod.txt', B, A],
      ['D', 'del.txt', Z, B],
    ],
  )
  assert.throws(() => __test__.parseRawDiffZ(`:badheader\0x.txt\0`), /raw diff/)
  // 只有记录头、没有路径段 = 输出被截断 ⇒ 必须抛(不得读成"没有改动")
  assert.throws(() => __test__.parseRawDiffZ(meta(A, B, 'M')), /缺路径段/)
})

test('逐路径覆盖解析: 可达面 commit 段必须带 committer 时刻(IHUI:<sha>:<ct>),缺时刻判"取不到"', () => {
  const A = 'a'.repeat(40)
  const B = 'b'.repeat(40)
  const sha = 'c'.repeat(40)
  const meta = `:100644 100644 ${A} ${B} M`
  const parsed = __test__.parseRawDiffZ(`IHUI:${sha}:1700000000\0\0${meta}\0f.txt\0`, {
    withCommit: true,
  })
  assert.equal(parsed[0].commit, sha, 'commit 段必须解析出完整 sha')
  assert.equal(parsed[0].ct, 1700000000, 'committer 时刻用于跨面判"最新",取不到就无从判最新')
  // 旧形态(只有 sha、没有时刻)不得继续被接受:否则"最新状态"无从确定,判定会静默降级。
  assert.throws(
    () => __test__.parseRawDiffZ(`IHUI:${sha}\0\0${meta}\0f.txt\0`, { withCommit: true }),
    /commit 段非法/,
  )
})

test('逐路径覆盖判定: 全覆盖放行 / 任一未覆盖点名 / 同内容不同路径不算 / D 类只认"最新且同 old blob"', () => {
  const A = 'a'.repeat(40)
  const B = 'b'.repeat(40)
  const C = 'c'.repeat(40)
  const Z = '0'.repeat(40)
  const entriesByCommit = new Map([
    [
      'c-full',
      [
        { status: 'M', path: 'x.txt', blob: A, oldBlob: B },
        { status: 'A', path: 'y.txt', blob: B, oldBlob: '' },
      ],
    ],
    [
      'c-part',
      [
        { status: 'M', path: 'x.txt', blob: A, oldBlob: B },
        { status: 'A', path: 'z.txt', blob: C, oldBlob: '' },
      ],
    ],
    ['c-same-content-other-path', [{ status: 'A', path: 'new.txt', blob: B, oldBlob: '' }]],
    ['c-del-ok', [{ status: 'D', path: 'gone.txt', blob: Z, oldBlob: A }]],
    ['c-del-no-record', [{ status: 'D', path: 'keep.txt', blob: Z, oldBlob: A }]],
    ['c-del-present-latest', [{ status: 'D', path: 'rebuild.txt', blob: Z, oldBlob: A }]],
    ['c-del-other-old', [{ status: 'D', path: 'other.txt', blob: Z, oldBlob: A }]],
    ['c-null', null],
  ])
  const coverage = new Map([
    [`x.txt\0${A}`, { commit: 'c1', surface: 'ref' }],
    [`y.txt\0${B}`, { commit: 'c2', surface: 'reflog' }],
  ])
  // 每路径**最新一次可达改动**:只有 gone.txt 的最新记录正好是"删 A"这一条 ⇒ 放行;
  // 另外三条各差一个条件(无记录 / 最新是存在 / 最新删的是别的 old blob)⇒ 都必须判红。
  const latestByPath = new Map([
    ['gone.txt', { commit: 'c3', surface: 'ref', status: 'D', oldBlob: A, blob: Z, ct: 3 }],
    ['rebuild.txt', { commit: 'c4', surface: 'ref', status: 'A', oldBlob: '', blob: A, ct: 4 }],
    ['other.txt', { commit: 'c5', surface: 'ref', status: 'D', oldBlob: B, blob: Z, ct: 5 }],
  ])
  const split = __test__.splitByPathCoverage({
    candidates: [...entriesByCommit.keys()],
    entriesByCommit,
    coverage,
    latestByPath,
    problemsByCommit: new Map([['c-null', 'diff-tree 取不到:boom']]),
  })
  assert.deepEqual(
    split.covered.map((x) => x.hash),
    ['c-full', 'c-del-ok'],
    '每条路径都有同路径同 blob / 最新且同 old blob 的删除记录,才放行',
  )
  const gap = new Map(split.uncovered.map((u) => [u.hash, u]))
  assert.equal(gap.get('c-part').missing[0].path, 'z.txt', '未覆盖路径必须点名')
  assert.equal(
    gap.get('c-same-content-other-path').missing[0].path,
    'new.txt',
    '同内容只在别处文件名 ⇒ 不得放行(防重命名误判)',
  )
  assert.equal(
    gap.get('c-del-no-record').missing[0].reason,
    '删除意图未在可达面生效(该路径在可达面无任何改动记录)',
    '可达面从没改过该路径 ⇒ 本次删除无出处,必须判红',
  )
  // 删→重建之后最新状态是"存在":即便可达面确实有更早的删除记录,也不能为本次删除作证。
  assert.match(
    gap.get('c-del-present-latest').missing[0].reason,
    /最新状态仍是"存在"[\s\S]*更早的删除记录不能为新删除作证/,
    '旧删除记录不得给重建后的再次删除搭便车',
  )
  // 最新删除记录删的是另一份内容 ⇒ 本次删的那份从未入可达面,必须判红。
  assert.match(
    gap.get('c-del-other-old').missing[0].reason,
    /另一份内容[\s\S]*旧删除不能为新删除作证/,
    'old blob 不同 = 删的不是同一内容,旧删除记录不得作证',
  )
  assert.equal(gap.get('c-null').reason, 'diff-tree 取不到:boom', '取材失败必须朝红')
  assert.equal(split.covered[0].evidence[0].surface, 'ref', '证据必须记录覆盖面')
  assert.equal(split.covered[0].evidence[1].surface, 'reflog', '证据必须记录覆盖面')
  // D 类证据必须把"被删掉的那份内容"也带上,判绿时才能复核"删的确实是同一 blob"。
  const delEvidence = split.covered.find((x) => x.hash === 'c-del-ok').evidence[0]
  assert.equal(delEvidence.blob, A, 'D 证据的 blob 应为本次 old blob(被删内容)')
  assert.equal(delEvidence.commit, 'c3', 'D 证据必须指向那条最新删除记录')
})

test('逐路径覆盖判定: 同秒并列(D vs M)⇒ 未判定档,既不判绿也不判红;另有真缺口时仍判红', () => {
  const A = 'a'.repeat(40)
  const B = 'b'.repeat(40)
  const Z = '0'.repeat(40)
  const entriesByCommit = new Map([
    ['c-tie', [{ status: 'D', path: 'gone.txt', blob: Z, oldBlob: A }]],
    [
      'c-tie-plus-gap',
      [
        { status: 'D', path: 'gone.txt', blob: Z, oldBlob: A },
        { status: 'A', path: 'new.txt', blob: B, oldBlob: '' },
      ],
    ],
  ])
  const split = __test__.splitByPathCoverage({
    candidates: [...entriesByCommit.keys()],
    entriesByCommit,
    coverage: new Map(),
    // 即便 latestByPath 里有一条"最新是删 A"的记录,它的来源是 same-ct 并列的先到者 ⇒ 不可信。
    latestByPath: new Map([
      ['gone.txt', { commit: 'c1', surface: 'ref', status: 'D', oldBlob: A, blob: Z, ct: 7 }],
    ]),
    ambiguousPaths: new Set(['gone.txt']),
  })
  assert.deepEqual(split.covered, [], '并列歧义的 D 路径不得判绿(先到者不是拓扑结论)')
  assert.deepEqual(
    split.undetermined.map((u) => u.hash),
    ['c-tie'],
    '只有并列歧义、没有别的真缺口 ⇒ 落未判定档(→ exit 2),不得折成判红或放行',
  )
  assert.deepEqual(split.undetermined[0].paths, ['gone.txt'], '未判定必须点名是哪条路径并列')
  assert.deepEqual(
    split.uncovered.map((u) => u.hash),
    ['c-tie-plus-gap'],
    '另有确定的未覆盖路径 ⇒ 仍是判红(判红比未判定更确定,不得被未判定吞掉)',
  )
})

test('逐路径覆盖·端到端: 两条可达分支同秒改同一路径(一枚 D 一枚 M)⇒ exit 2 未判定', () => {
  const dir = createTempRepo()
  const git = (cmd, extraEnv) =>
    execSync(cmd, {
      cwd: dir,
      stdio: 'ignore',
      env: { ...process.env, ...(extraEnv || {}) },
    })
  // 两台并列改动必须落在 30 天窗内(窗档只报数不拦,而本用例要走到 exit 2 那一档);
  // 同时它们必须比 base 更新 —— 否则侧支的提交时刻比主线还旧,latestByPath 会选到 base。
  const T = new Date().toISOString()
  try {
    // base:{README, f=v1, k=k1};main 先让 k=v2 的 blob 可达,再删掉 k(让"删 k"有出处)。
    writeFileSync(join(dir, 'f.txt'), 'v1\n')
    writeFileSync(join(dir, 'k.txt'), 'k1\n')
    git('git add f.txt k.txt')
    git('git commit -m "base"')
    writeFileSync(join(dir, 'k.txt'), 'k2\n')
    git('git add k.txt')
    git('git commit -m "k-v2"')
    git('git rm -q k.txt')
    git('git commit -m "del-k"')
    // 两条**可达**分支同秒改同一路径:一枚 D(side-del)、一枚 M(side-mod)。
    git('git checkout -b side-del')
    git('git rm -q f.txt')
    git('git commit -m "side-del"', { GIT_AUTHOR_DATE: T, GIT_COMMITTER_DATE: T })
    git('git checkout main')
    git('git checkout -b side-mod')
    writeFileSync(join(dir, 'f.txt'), 'v2\n')
    git('git add f.txt')
    git('git commit -m "side-mod"', { GIT_AUTHOR_DATE: T, GIT_COMMITTER_DATE: T })
    git('git checkout main')
    // 悬空候选:从 base 删 f、把 k 改成可达的 k2(避免整树等价档把它提前放行)。
    git('git checkout -b tmp-dangling')
    git('git rm -q f.txt')
    writeFileSync(join(dir, 'k.txt'), 'k2\n')
    git('git add k.txt')
    git('git commit -m "dangling-del-f"', { GIT_AUTHOR_DATE: T, GIT_COMMITTER_DATE: T })
    git('git checkout main')
    git('git branch -D tmp-dangling')
    const r = runScript(['--blocking', '--filter-stash'], { cwd: dir })
    assert.equal(
      r.status,
      2,
      `同秒并列的删除判定不可判定 ⇒ 必须 exit 2,实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
    )
    assert.match(r.stdout, /UNDETERMINED/, '未判定必须显式报出,不得静默')
    assert.match(r.stdout, /同秒并列/, '必须点名原因')
    assert.match(r.stdout, /f\.txt/, '必须点名是哪条路径并列')
    assert.doesNotMatch(r.stdout, /无 commit 丢失风险/, '未判定绝不许打印通过句')
  } finally {
    rmScratch(dir)
  }
})

test('逐路径覆盖·端到端: 树与任何可达提交都不同,但每条改动路径同路径同 blob ⇒ 放行并逐条给证据', () => {
  const dir = createTempRepo()
  const git = (cmd) => execSync(cmd, { cwd: dir, stdio: 'ignore' })
  try {
    // 两个可达提交分别覆盖 a.txt / b.txt 的新 blob;没有任何可达树同时含两者。
    git('git checkout -b side-a')
    writeFileSync(join(dir, 'a.txt'), 'vA\n')
    git('git add a.txt')
    git('git commit -m "land-a"')
    git('git checkout main')
    git('git checkout -b side-b')
    writeFileSync(join(dir, 'b.txt'), 'vB\n')
    git('git add b.txt')
    git('git commit -m "land-b"')
    git('git checkout main')
    // 悬空提交的树 = {README, a:vA, b:vB};与 side-a/side-b/main 的树都不同(并发夹带形态)
    git('git checkout -b temp-concurrency')
    writeFileSync(join(dir, 'a.txt'), 'vA\n')
    writeFileSync(join(dir, 'b.txt'), 'vB\n')
    git('git add a.txt b.txt')
    git('git commit -m "concurrency-dangling"')
    git('git checkout main')
    git('git branch -D temp-concurrency')
    const r = runScript(['--blocking', '--filter-stash'], { cwd: dir })
    assert.equal(
      r.status,
      0,
      `逐路径全覆盖应放行 exit 0,实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
    )
    assert.match(r.stdout, /逐路径覆盖放行 1 个/, '放行必须点名,不得静默')
    assert.match(r.stdout, /a\.txt/, '证据应逐条列出被覆盖的路径')
    assert.match(r.stdout, /b\.txt/, '证据应逐条列出被覆盖的路径')
    assert.match(r.stdout, /\(ref\)/, '证据应标明覆盖面')
    assert.match(r.stdout, /悬空分档:.*逐路径覆盖 1/, '分档行必须报数')
  } finally {
    rmScratch(dir)
  }
})

test('逐路径覆盖·端到端: 有一条路径未覆盖 ⇒ 判红并点名该路径与 blob + 复核命令', () => {
  const dir = createTempRepo()
  const git = (cmd) => execSync(cmd, { cwd: dir, stdio: 'ignore' })
  try {
    git('git checkout -b side-a')
    writeFileSync(join(dir, 'a.txt'), 'vA\n')
    git('git add a.txt')
    git('git commit -m "land-a"')
    git('git checkout main')
    // a.txt 的 blob 已被 side-a 覆盖;lost-unique.txt 只存在于悬空提交里
    git('git checkout -b temp-partial')
    writeFileSync(join(dir, 'a.txt'), 'vA\n')
    writeFileSync(join(dir, 'lost-unique.txt'), 'never-landed\n')
    git('git add a.txt lost-unique.txt')
    git('git commit -m "partial-dangling"')
    git('git checkout main')
    git('git branch -D temp-partial')
    const r = runScript(['--blocking', '--filter-stash'], { cwd: dir })
    assert.equal(
      r.status,
      1,
      `有路径未覆盖必须判红,实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
    )
    assert.match(r.stdout, /未覆盖:A lost-unique\.txt blob=/, '判红必须点名未覆盖路径与 blob')
    assert.match(
      r.stdout,
      /复核:git log --all --raw --no-renames -- "lost-unique\.txt"/,
      '判红必须给出可直接执行的复核命令',
    )
  } finally {
    rmScratch(dir)
  }
})

test('逐路径覆盖·端到端: 新增路径只有"同内容不同路径" ⇒ 判红(防重命名误判成已覆盖)', () => {
  const dir = createTempRepo()
  const git = (cmd) => execSync(cmd, { cwd: dir, stdio: 'ignore' })
  try {
    writeFileSync(join(dir, 'other.txt'), 'shared-content\n')
    git('git add other.txt')
    git('git commit -m "add-other"')
    git('git checkout -b temp-renamed')
    writeFileSync(join(dir, 'new-name.txt'), 'shared-content\n')
    git('git add new-name.txt')
    git('git commit -m "add-new-name"')
    git('git checkout main')
    git('git branch -D temp-renamed')
    const r = runScript(['--blocking', '--filter-stash'], { cwd: dir })
    assert.equal(
      r.status,
      1,
      `同内容不同路径不得放行,实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
    )
    assert.match(r.stdout, /未覆盖:A new-name\.txt/, '未覆盖的新增路径必须点名')
    assert.doesNotMatch(r.stdout, /逐路径覆盖放行 1 个/, '不得按"别处有同内容"放行')
  } finally {
    rmScratch(dir)
  }
})

test('逐路径覆盖·端到端: 删除路径的意图未在可达面生效 ⇒ 判红并点名该路径', () => {
  const dir = createTempRepo()
  const git = (cmd) => execSync(cmd, { cwd: dir, stdio: 'ignore' })
  try {
    // keep.txt 在可达面一直存在(没有任何可达提交删过它)
    writeFileSync(join(dir, 'keep.txt'), 'keep-me\n')
    git('git add keep.txt')
    git('git commit -m "add-keep"')
    // 另两条可达路径各自覆盖 a.txt / b.txt,保证悬空树不等于任何可达树(否则会先落"等价残留")
    git('git checkout -b side-a')
    writeFileSync(join(dir, 'a.txt'), 'vA\n')
    git('git add a.txt')
    git('git commit -m "land-a"')
    git('git checkout main')
    git('git checkout -b side-b')
    writeFileSync(join(dir, 'b.txt'), 'vB\n')
    git('git add b.txt')
    git('git commit -m "land-b"')
    git('git checkout main')
    // 悬空提交:删除 keep.txt,同时带上 a:vA / b:vB(树 = {README,a,b},不可达)
    git('git checkout -b temp-del')
    execFileSync('git', ['rm', 'keep.txt'], { cwd: dir, stdio: 'ignore' })
    writeFileSync(join(dir, 'a.txt'), 'vA\n')
    writeFileSync(join(dir, 'b.txt'), 'vB\n')
    git('git add a.txt b.txt')
    git('git commit -m "delete-keep-dangling"')
    git('git checkout main')
    git('git branch -D temp-del')
    const r = runScript(['--blocking', '--filter-stash'], { cwd: dir })
    assert.equal(
      r.status,
      1,
      `删除意图未在可达面生效必须判红,实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
    )
    // keep.txt 在可达面最新状态仍是"存在"(只被 add 过、从没被删过)⇒ 本次删除没有出处。
    assert.match(
      r.stdout,
      /未覆盖:D keep\.txt blob=.*最新状态仍是"存在"/,
      '必须点名删除路径,并说明"更早的删除记录不能作证"的判红依据',
    )
    assert.doesNotMatch(r.stdout, /已覆盖:D keep\.txt/, '不得把"可达面从没删过它"读成覆盖')
  } finally {
    rmScratch(dir)
  }
})

// ─── D 类收紧(2026-11-04):删的必须是同一内容、且是该路径最新状态 ───────────

test('D 类收紧①: 删 → 重建 → 再删 ⇒ 判红(旧删除记录不得为新的删除意图作证)', () => {
  const dir = createTempRepo()
  // 夹具时钟:每次 git 调用推进 1 秒 ⇒ 同一路径的连续改动不会落在同一秒。
  // (2026-11-04 起「同秒并列且状态不同」判未判定 → exit 2;夹具必须把"谁更新"钉死,
  //  否则测到的是并列歧义,而不是本用例要证的 D 收紧判据。)
  let clock = Date.now() - 3_600_000
  const git = (cmd) => {
    clock += 1000
    const d = new Date(clock).toISOString()
    return execSync(cmd, {
      cwd: dir,
      stdio: 'ignore',
      env: { ...process.env, GIT_AUTHOR_DATE: d, GIT_COMMITTER_DATE: d },
    })
  }
  try {
    // 旁支提供 q.txt 的同路径同 blob 覆盖,并让悬空枚的树不等于任何可达树(否则会先落等价残留)
    git('git checkout -b side')
    writeFileSync(join(dir, 'q.txt'), 'q-content\n')
    writeFileSync(join(dir, 'r.txt'), 'r-content\n')
    git('git add q.txt r.txt')
    git('git commit -m "side-q-r"')
    git('git checkout main')
    // 可达历史:p.txt 先落地 → 删掉(留下一条最早的删除记录)→ 用**同内容**重建
    writeFileSync(join(dir, 'p.txt'), 'p-v1\n')
    git('git add p.txt')
    git('git commit -m "add-p"')
    git('git rm p.txt')
    git('git commit -m "delete-p-first"')
    writeFileSync(join(dir, 'p.txt'), 'p-v1\n')
    git('git add p.txt')
    git('git commit -m "rebuild-p-same-content"')
    // 悬空枚:删掉重建后的 p.txt。它的 old blob 与最早那次删除完全相同 ⇒ 宽判据会放行。
    git('git checkout -b temp-dangle')
    git('git rm p.txt')
    writeFileSync(join(dir, 'q.txt'), 'q-content\n')
    git('git add q.txt')
    git('git commit -m "dangle-delete-p-after-rebuild"')
    git('git checkout main')
    git('git branch -D temp-dangle')
    const r = runScript(['--blocking', '--filter-stash'], { cwd: dir })
    // 为什么正确:该路径在可达面的**最新状态是"存在"**(重建后的那份),删除这件事从未落地;
    // 最早那次删除的 old blob 虽然相同,但它早于重建,不能给本次删除作证。
    assert.equal(
      r.status,
      1,
      `删→重建→再删必须判红,实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
    )
    assert.match(r.stdout, /未覆盖:D p\.txt blob=[0-9a-f]{12}/, '必须点名删除路径与被删内容')
    assert.match(r.stdout, /最新状态仍是"存在"/, '判红理由必须指出"最新状态是存在"')
    assert.match(r.stdout, /更早的删除记录不能为新删除作证/, '必须写明搭便车被挡住的原因')
    assert.doesNotMatch(r.stdout, /已覆盖:D p\.txt/, '旧删除记录不得被当成覆盖证据')
  } finally {
    rmScratch(dir)
  }
})

test('D 类收紧②: 可达面最新改动就是删掉同一 old blob ⇒ 放行并给出该删除记录', () => {
  const dir = createTempRepo()
  // 夹具时钟:每次 git 调用推进 1 秒(否则同一秒的 D/M 并列会被判未判定)。
  let clock = Date.now() - 3_600_000
  const git = (cmd) => {
    clock += 1000
    const d = new Date(clock).toISOString()
    return execSync(cmd, {
      cwd: dir,
      stdio: 'ignore',
      env: { ...process.env, GIT_AUTHOR_DATE: d, GIT_COMMITTER_DATE: d },
    })
  }
  const rev = () =>
    execSync('git rev-parse HEAD', { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  try {
    git('git checkout -b side')
    writeFileSync(join(dir, 'q.txt'), 'q-content\n')
    writeFileSync(join(dir, 'r.txt'), 'r-content\n')
    git('git add q.txt r.txt')
    git('git commit -m "side-q-r"')
    git('git checkout main')
    writeFileSync(join(dir, 'p.txt'), 'p-v1\n')
    git('git add p.txt')
    git('git commit -m "add-p"')
    const withP = rev()
    git('git rm p.txt')
    git('git commit -m "delete-p-latest"')
    const deleteP = rev()
    // 悬空枚从 add-p 分出(那时 p.txt 还在),删的正是同一份内容
    git(`git checkout -b temp-dangle ${withP}`)
    git('git rm p.txt')
    writeFileSync(join(dir, 'q.txt'), 'q-content\n')
    git('git add q.txt')
    git('git commit -m "dangle-delete-p-same-old-blob"')
    git('git checkout main')
    git('git branch -D temp-dangle')
    const r = runScript(['--blocking', '--filter-stash'], { cwd: dir })
    // 为什么正确:可达面最新一次改动就是"删掉同一份内容",之后没有任何重建把该路径复活
    // ⇒ 这次删除的意图已经在可达历史里原样发生过,放行不是降低标准。
    assert.equal(
      r.status,
      0,
      `最新状态即同内容删除应放行,实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
    )
    assert.match(r.stdout, /逐路径覆盖放行 1 个/, '放行必须点名,不得静默')
    const line = (r.stdout.split('\n').find((l) => l.includes('D p.txt')) || '').trim()
    assert.match(line, /D p\.txt blob=[0-9a-f]{12}/, '证据必须写明"被删掉的那份内容"(old blob)')
    assert.ok(
      line.includes(deleteP.slice(0, 12)),
      `证据必须指向可达面那条最新删除记录 ${deleteP.slice(0, 12)},实际行: ${line}`,
    )
    assert.doesNotMatch(r.stdout, /未覆盖:D p\.txt/, '已证明的删除不得再判红')
  } finally {
    rmScratch(dir)
  }
})

test('D 类收紧③: 最新删除记录删的 old blob 不同 ⇒ 判红(删的不是同一内容)', () => {
  const dir = createTempRepo()
  // 夹具时钟:每次 git 调用推进 1 秒(否则同一秒的 D/M 并列会被判未判定)。
  let clock = Date.now() - 3_600_000
  const git = (cmd) => {
    clock += 1000
    const d = new Date(clock).toISOString()
    return execSync(cmd, {
      cwd: dir,
      stdio: 'ignore',
      env: { ...process.env, GIT_AUTHOR_DATE: d, GIT_COMMITTER_DATE: d },
    })
  }
  try {
    git('git checkout -b side')
    writeFileSync(join(dir, 'q.txt'), 'q-content\n')
    writeFileSync(join(dir, 'r.txt'), 'r-content\n')
    git('git add q.txt r.txt')
    git('git commit -m "side-q-r"')
    git('git checkout main')
    writeFileSync(join(dir, 'p.txt'), 'p-v1\n')
    git('git add p.txt')
    git('git commit -m "add-p-v1"')
    const v1Commit = execSync('git rev-parse HEAD', {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
    writeFileSync(join(dir, 'p.txt'), 'p-v2\n')
    git('git add p.txt')
    git('git commit -m "modify-p-v2"')
    git('git rm p.txt')
    git('git commit -m "delete-p-latest-v2"')
    // 悬空枚从 v1 那个提交分出:它删的是 p-v1,而可达面最新那条删除删的是 p-v2
    git(`git checkout -b temp-dangle ${v1Commit}`)
    git('git rm p.txt')
    writeFileSync(join(dir, 'q.txt'), 'q-content\n')
    git('git add q.txt')
    git('git commit -m "dangle-delete-p-old-v1"')
    git('git checkout main')
    git('git branch -D temp-dangle')
    const r = runScript(['--blocking', '--filter-stash'], { cwd: dir })
    // 为什么正确:悬空枚删掉的 v1 那版内容在"被删"这件事上从未进入可达面(可达面删的是 v2),
    // 最新删除记录的 old blob 与本次不同 ⇒ 旧记录不能作证,必须判红。
    assert.equal(
      r.status,
      1,
      `old blob 不同的删除必须判红,实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
    )
    assert.match(r.stdout, /未覆盖:D p\.txt blob=[0-9a-f]{12}/, '必须点名删除路径与被删内容')
    assert.match(r.stdout, /可达面最新删除记录删的是另一份内容/, '判红理由必须指出 old blob 不同')
    assert.match(r.stdout, /旧删除不能为新删除作证/, '必须写明为什么旧记录不作证')
    assert.doesNotMatch(r.stdout, /已覆盖:D p\.txt/, 'old blob 不同的旧记录不得被当成覆盖证据')
  } finally {
    rmScratch(dir)
  }
})

test('D 类收紧④: 多次删除中只有最后一次同 old blob ⇒ 放行,且证据只指向最后一次', () => {
  const dir = createTempRepo()
  // 夹具时钟:每次 git 调用推进 1 秒(否则同一秒的 D/M 并列会被判未判定)。
  let clock = Date.now() - 3_600_000
  const git = (cmd) => {
    clock += 1000
    const d = new Date(clock).toISOString()
    return execSync(cmd, {
      cwd: dir,
      stdio: 'ignore',
      env: { ...process.env, GIT_AUTHOR_DATE: d, GIT_COMMITTER_DATE: d },
    })
  }
  const rev = () =>
    execSync('git rev-parse HEAD', { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  try {
    git('git checkout -b side')
    writeFileSync(join(dir, 'q.txt'), 'q-content\n')
    writeFileSync(join(dir, 'r.txt'), 'r-content\n')
    git('git add q.txt r.txt')
    git('git commit -m "side-q-r"')
    git('git checkout main')
    writeFileSync(join(dir, 'p.txt'), 'p-v1\n')
    git('git add p.txt')
    git('git commit -m "add-p-v1"')
    git('git rm p.txt')
    git('git commit -m "delete-p-v1"')
    const firstDelete = rev()
    writeFileSync(join(dir, 'p.txt'), 'p-v2\n')
    git('git add p.txt')
    git('git commit -m "rebuild-p-v2"')
    const withV2 = rev()
    git('git rm p.txt')
    git('git commit -m "delete-p-v2"')
    const lastDelete = rev()
    // 悬空枚从 rebuild-p-v2 分出:删的也正是 p-v2(与最后一次删除同 old blob)
    git(`git checkout -b temp-dangle ${withV2}`)
    git('git rm p.txt')
    writeFileSync(join(dir, 'q.txt'), 'q-content\n')
    git('git add q.txt')
    git('git commit -m "dangle-delete-p-v2"')
    git('git checkout main')
    git('git branch -D temp-dangle')
    const r = runScript(['--blocking', '--filter-stash'], { cwd: dir })
    // 为什么正确:第一次删除删的是 v1(既非最新状态、old blob 也不同),不作证;
    // 最后一次删除既是该路径最新改动、old blob 又与本次逐字相同 ⇒ 本次删除意图已在可达面落地。
    assert.equal(
      r.status,
      0,
      `最新那次同内容删除应放行,实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
    )
    assert.match(r.stdout, /逐路径覆盖放行 1 个/, '放行必须点名')
    const line = (r.stdout.split('\n').find((l) => l.includes('D p.txt')) || '').trim()
    assert.ok(
      line.includes(lastDelete.slice(0, 12)),
      `证据必须指向最后一次删除 ${lastDelete.slice(0, 12)},实际行: ${line}`,
    )
    assert.ok(
      !line.includes(firstDelete.slice(0, 12)),
      `证据不得指向那次 old blob 不同的旧删除 ${firstDelete.slice(0, 12)}`,
    )
    assert.doesNotMatch(r.stdout, /未覆盖:D p\.txt/, '最新同内容删除已作证,不得判红')
  } finally {
    rmScratch(dir)
  }
})

// ─── lost-commit/* 和 backup/* tag 检测 ─────────────────

test('检测: lost-commit/* tag 存在 → stdout 列出', () => {
  const dir = createTempRepo()
  try {
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    execSync('git tag lost-commit/test-backup HEAD', { cwd: dir, stdio: 'ignore' })
    const r = runScript([], { cwd: dir })
    assert.match(r.stdout, /lost-commit\/test-backup/, '应列出 lost-commit/test-backup tag')
  } finally {
    rmScratch(dir)
  }
})

test('检测: backup/* tag 存在 → stdout 列出', () => {
  const dir = createTempRepo()
  try {
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    execSync('git tag backup/snapshot-1 HEAD', { cwd: dir, stdio: 'ignore' })
    const r = runScript([], { cwd: dir })
    assert.match(r.stdout, /backup\/snapshot-1/, '应列出 backup/snapshot-1 tag')
  } finally {
    rmScratch(dir)
  }
})

// ─── 多规则命中(reset + 悬空 commit 同时) ─────────────

test('多规则: reset + 悬空 commit 同时 → 综合报告 + blocking exit 1', () => {
  const dir = createTempRepo()
  try {
    // commit B,然后 reset HEAD~1 → reset 记录 + B 悬空
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    execSync('git commit --allow-empty -m "will-be-lost"', { cwd: dir, stdio: 'ignore' })
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    execSync('git reset HEAD~1', { cwd: dir, stdio: 'ignore' })
    const r = runScript(['--blocking', '--filter-stash'], { cwd: dir })
    assert.equal(r.status, 1, `reset + 悬空 + blocking 应 exit 1,实际 ${r.status}`)
    // stdout 应同时提及 reset 和悬空 commit
    assert.match(r.stdout, /reset/, '应报告 reset')
    assert.match(r.stdout, /悬空 commit|unreachable/, '应报告悬空 commit')
  } finally {
    rmScratch(dir)
  }
})

// ─── tag 备份悬空 commit → 不阻塞 ───────────────────────

test('备份: 悬空 commit 已 tag 备份 → 非 blocking(已保护)', () => {
  const dir = createTempRepo()
  try {
    // 创建悬空 commit
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    execSync('git checkout -b temp', { cwd: dir, stdio: 'ignore' })
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    execSync('git commit --allow-empty -m "backed-up-commit"', { cwd: dir, stdio: 'ignore' })
    // 2026-10-04:子进程必须给 stdio(留管道取输出),否则本机报 spawnSync EBUSY
    const hash = execSync('git rev-parse HEAD', {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    execSync('git checkout main', { cwd: dir, stdio: 'ignore' })
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    execSync('git branch -D temp', { cwd: dir, stdio: 'ignore' })
    // 为悬空 commit 创建 lost-commit tag 备份
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    execSync(`git tag lost-commit/backed-up ${hash}`, { cwd: dir, stdio: 'ignore' })
    const r = runScript(['--blocking', '--filter-stash'], { cwd: dir })
    // 已备份的悬空 commit 不应导致 blocking(exit 0,因为已保护)
    // 注:可能因 lost-commit tag 仅本地(未 push)而 warn,但不 blocking
    assert.equal(
      r.status,
      0,
      `已备份悬空 commit + blocking 应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`,
    )
    assert.match(r.stdout, /已全部 tag 备份|已保护|lost-commit\/backed-up/)
  } finally {
    rmScratch(dir)
  }
})

// ─── --filter-stash 行为验证 ─────────────────────────────

test('filter-stash: stash-like 悬空 commit 被过滤(不报告为丢失)', () => {
  const dir = createTempRepo()
  try {
    // 创建一个 stash,然后 drop 使其悬空
    writeFileSync(join(dir, 'file.txt'), 'content\n')
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    execSync('git add file.txt', { cwd: dir, stdio: 'ignore' })
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    execSync('git stash', { cwd: dir, stdio: 'ignore' })
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    execSync('git stash drop', { cwd: dir, stdio: 'ignore' })
    // 用 --filter-stash 运行 → stash-like 悬空 commit 应被过滤
    const r = runScript(['--filter-stash'], { cwd: dir })
    assert.equal(
      r.status,
      0,
      `filter-stash 过滤 stash-like 后应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`,
    )
    // 验证过滤行为:stdout 应提及已过滤,或不报告 stash-like 为未备份悬空
    assert.ok(
      /已过滤|stash-like|未检测到悬空 commit/.test(r.stdout),
      '应显示过滤行为或无悬空 commit',
    )
  } finally {
    rmScratch(dir)
  }
})

// ─── 无 origin remote 场景(不 crash) ────────────────────

test('鲁棒性: 无 origin remote → 不 crash(远程 tag 校验跳过)', () => {  const dir = createTempRepo()
  try {
    // 临时仓库无 origin,git ls-remote origin 会失败
    // 脚本应 allowFail 处理,不 crash
    const r = runScript([], { cwd: dir })
    assert.ok(r.status === 0 || r.status === 1, `无 origin 不应 crash,实际 exit ${r.status}`)
    assert.ok(!r.stderr.includes('Error:'), `不应有未捕获 Error`)
  } finally {
    rmScratch(dir)
  }
})

// ─── 自愈:仅远端 tag 不得把提交钉成恒红(2026-09-24 装车证明) ───────────
//
// 场景复刻:另一台机器(或另一个会话)往 origin 推了 `lost-commit/*` tag,本机没有。
// 旧判定把这视同"必须人工 fetch"并 blocking ⇒ 结果只是逼人人 --no-verify,把真正防丢的
// reset / 悬空 commit / 不可达对象三条一起关掉。新判定:本门自己 fetch + 固化,拿不到才降级为警告。
test('自愈: 另一台机推来的 lost-commit tag → 本门自己 fetch 回来并固化,不阻塞提交', () => {
  const base = mkScratch('ihui-loss-heal-')
  const origin = join(base, 'origin.git')
  const local = join(base, 'local')
  const other = join(base, 'other')
  const G = (cwd, args) =>
    execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
  try {
    execFileSync('git', ['init', '--bare', origin], {
      encoding: 'utf8',
      windowsHide: true,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    for (const [dir, name] of [
      [local, 'local'],
      [other, 'other'],
    ]) {
      mkdirSync(dir, { recursive: true })
      G(dir, ['init', '-b', 'main'])
      G(dir, ['config', 'user.email', `${name}@test.local`])
      G(dir, ['config', 'user.name', name])
      G(dir, ['config', 'commit.gpgsign', 'false'])
      // 2026-10-30:关掉 auto-gc / 自动 maintenance。本用例在阶段②会真跑一次 `git fetch`,
      // 而 fetch 收尾可能拉起 `git maintenance run --auto` —— 那是**后台**进程,会在
      // spawnSync 已经返回之后仍握着仓库句柄,导致临时目录 rmdir 报 EBUSY(实测踩到)。
      // 它既是本用例的抖动源,也与"用例只验门的行为"无关,故在造仓时就关掉。
      G(dir, ['config', 'gc.auto', '0'])
      G(dir, ['config', 'maintenance.auto', 'false'])
      writeFileSync(join(dir, 'README.md'), `# ${name}\n`)
      G(dir, ['add', 'README.md'])
      G(dir, ['commit', '-m', `init ${name}`])
      G(dir, ['remote', 'add', 'origin', origin])
      G(dir, ['push', '-u', 'origin', 'main', '--force'])
    }
    // "另一台机"造一个只存在于远端的备份 tag
    writeFileSync(join(other, 'extra.txt'), 'x\n')
    G(other, ['add', 'extra.txt'])
    G(other, ['commit', '-m', 'other work'])
    G(other, ['tag', 'lost-commit/only-on-remote'])
    G(other, ['push', 'origin', 'refs/tags/lost-commit/only-on-remote'])

    assert.equal(
      G(local, ['tag', '-l', 'lost-commit/only-on-remote']).trim(),
      '',
      '前置:本机确实没有这个 tag',
    )

    // ⚠️ 必须显式开远端档(2026-10-30 修正):本门的远端扫描由 `IHUI_COMMIT_LOSS_REMOTE=1` 门控 ——
    // 提交链上每枚提交都做一次 ls-remote 是不可接受的(实测单次 60s 超时上限),所以默认档
    // **完全不看远端**,`remoteTagScan()` 直接返回 null ⇒ `remoteCheckSkipped=true` ⇒ heal 分支
    // 根本不执行。原用例没开这个档,于是它测的其实是"压根没看远端",与用例名要证的
    // "走自愈、不是干脆不看远端"恰好相反 —— 一条永远不可能失败的假绿。
    // 下面两段成对:① 远端档开着 ⇒ 必须真把 tag 拉回来并固化;② 默认档 ⇒ 不联网、不阻塞。
    const REMOTE_ON = { IHUI_COMMIT_LOSS_REMOTE: '1' }

    // 阶段①(先跑,因为它是"不做任何处置"的那一档):默认档 = 提交链形态,必须**不联网**。
    // 顺序有讲究:本仓此刻本机没有任何指向那枚 commit 的 ref,所以它既不会出现在远端 diff 的
    // "仅远端"里被补拉,也不会在本地制造悬空 —— 两件事都不发生,才是干净的"未判定"证据。
    // (若把它放到阶段②之后再跑,补拉已经发生过,删掉本地 tag 反而会造出一枚真悬空 commit,
    //  门判红是对的,断言就变成在测别的东西了。)
    const off = runScript(['--blocking'], { cwd: local, env: { IHUI_COMMIT_LOSS_REMOTE: '' } })
    assert.equal(
      G(local, ['tag', '-l', 'lost-commit/only-on-remote']).trim(),
      '',
      '默认档不得联网补 tag(提交链上每枚提交都 ls-remote 是不可接受的)',
    )
    assert.equal(off.status, 0, `默认档对"未判定"的远端差异不得判红,实际 ${off.status}`)
    assert.match(
      off.stdout,
      /远端|跳过/,
      '默认档必须明写"远端校验跳过",不得静默(静默 = 把没判读成判过了)',
    )

    // 阶段②:远端档 ⇒ 必须真把 tag 拉回来并固化(证明走的是自愈,不是"干脆不看远端")
    const r = runScript(['--blocking'], { cwd: local, env: REMOTE_ON })
    assert.doesNotMatch(
      r.stdout,
      /❌ 仅远端/,
      `不应再报「仅远端」红线,实际:\n${r.stdout.slice(-800)}`,
    )
    assert.equal(
      r.status,
      0,
      `仅远端 tag 已被自愈,不应阻塞提交,实际 exit ${r.status}:\n${(r.stdout || '').slice(-900)}\n${(r.stderr || '').slice(-300)}`,
    )
    // tag 必须真回到本机(证明走的是自愈,不是"干脆不看远端"糊过去)
    assert.equal(
      G(local, ['rev-parse', '--verify', '--quiet', 'refs/tags/lost-commit/only-on-remote'])
        .length > 0,
      true,
      '自愈后本机应能解析该 tag',
    )
    // 且已固化进 packed-refs(松散嵌套 ref 会被宿主清理层删掉,不 pack 等于下次再红)
    //    必须 --absolute-git-dir:`--git-dir` 返回相对路径,join 会解析到测试进程的 cwd 而非临时仓
    const gitDir = G(local, ['rev-parse', '--absolute-git-dir']).trim()
    const packed = readFileSync(join(gitDir, 'packed-refs'), 'utf8')
    assert.match(packed, /refs\/tags\/lost-commit\/only-on-remote/, '自愈后必须固化进 packed-refs')

  } finally {
    rmScratch(base)
  }
})

// ─── 时间窗量纲(2026-10-11 立,G-1117436 同批)──────────────────────────
// 立因:本仓未 tag 备份的悬空 commit 实测 9809 枚(封件 .ihui-agent/tmp/gate30a-before.md,
// #EVIDENCE-RC=1)⇒ 恒红门。恒红的后果不是"每次都拦住丢失",是**每次提交都被逼跳过这道门**,
// 于是"刚丢的那一枚"也不再有人被拦住(AGENTS §12f)。
// 判据没有放宽"什么算丢失":改的是"哪一档由提交链负责"。窗内 = 拦;超窗(§29 写明的人工 GC
// 存量)= 只报数并点名最老一枚;读不到时刻 = 保守算窗内。以下每一档都有成对用例。

const DAY = 86_400

test('纯函数: parseCommitterDateLines 认 %H\\t%ct,畸形行与非正数时刻一律跳过', () => {
  const rows = __test__.parseCommitterDateLines(
    ['a'.repeat(40) + '\t1700000000', 'b'.repeat(40) + '\t-'].join('\n') +
      '\nno-tab-line\n\n\t123\n' +
      'c'.repeat(40) +
      '\t0',
  )
  assert.equal(rows.length, 1, '只有"完整 oid + 正整数时刻"成立')
  assert.equal(rows[0][0], 'a'.repeat(40))
  assert.equal(rows[0][1], 1700000000)
  assert.equal(__test__.parseCommitterDateLines('').length, 0, '空读数 → 空表')
  assert.equal(__test__.parseCommitterDateLines(null).length, 0, 'null → 空表')
})

test('纯函数: resolveWindowDays 认 flag > env > 默认,0 合法,非法值回落默认并标 invalid', () => {
  const T = __test__.resolveWindowDays
  assert.deepEqual(T({ flagValue: '7', envValue: '3' }), {
    days: 7,
    source: 'flag',
    invalid: false,
  })
  assert.deepEqual(T({ envValue: '3' }), { days: 3, source: 'env', invalid: false })
  assert.deepEqual(T({}), {
    days: __test__.WINDOW_DAYS_DEFAULT,
    source: 'default',
    invalid: false,
  })
  // 0 = 显式关掉窗维(全量语义),必须被认成合法值而不是"没给"
  assert.deepEqual(T({ flagValue: '0' }), { days: 0, source: 'flag', invalid: false })
  // 打错值 ⇒ 回落默认 **且** 标 invalid(不得静默当成"关掉窗维")
  const bad = T({ flagValue: 'abc', envValue: undefined })
  assert.equal(bad.days, __test__.WINDOW_DAYS_DEFAULT)
  assert.equal(bad.invalid, true, '给了旗却解不出 ⇒ 必须报名')
  assert.equal(T({ flagValue: '-1' }).invalid, true, '负数不是合法窗宽')
})

test('窗维成对: 窗内拦 / 超窗只报数(同一条判据,差别只有时刻)', () => {
  const now = 1_700_000_000
  const mk = (h, ageDays) => [h, now - ageDays * DAY]
  const map = new Map([mk('a'.repeat(40), 1), mk('b'.repeat(40), 400)])
  const r = __test__.splitUnbackedByWindow({
    unbacked: ['a'.repeat(40), 'b'.repeat(40)],
    committerUnixByHash: map,
    nowUnix: now,
    windowDays: 30,
  })
  assert.deepEqual(r.blocking, ['a'.repeat(40)], '1 天前的无出处悬空必须照拦')
  assert.equal(r.outOfWeek.length, 1, '400 天前那枚进"只报数"档')
  assert.equal(r.outOfWeek[0].hash, 'b'.repeat(40))
  assert.equal(r.strict, false, '默认档不是问责档')
})

test('窗维保守方向: 取不到时刻 ⇒ 算窗内(照拦),绝不因"没量到"而放行', () => {
  const now = 1_700_000_000
  const r = __test__.splitUnbackedByWindow({
    unbacked: ['c'.repeat(40)],
    committerUnixByHash: new Map(), // 有读数但没这一枚 ⇒ 不是"整批失败"
    nowUnix: now,
    windowDays: 30,
    failedBatches: 0,
  })
  assert.deepEqual(r.blocking, ['c'.repeat(40)], '无时刻必须照拦')
  assert.deepEqual(r.undated, ['c'.repeat(40)])
  assert.ok(!r.wholeWalkFailed, '单枚读不到不得冒充"整批失败"')
})

test('窗维保守方向: 整批时刻都派生失败 ⇒ 窗维未生效,全部照拦并大声报名', () => {
  const r = __test__.splitUnbackedByWindow({
    unbacked: ['d'.repeat(40), 'e'.repeat(40)],
    committerUnixByHash: new Map(),
    nowUnix: 1_700_000_000,
    windowDays: 30,
    failedBatches: 3,
  })
  assert.equal(r.wholeWalkFailed, true)
  assert.equal(r.blocking.length, 2, '"没量到"不得折成"没风险"')
  assert.equal(r.outOfWeek.length, 0)
})

test('变异对照: --window-days 0(窗维关闭)⇒ 超窗也拦,逐字回到 2026-10-11 之前的语义', () => {
  const now = 1_700_000_000
  const args = {
    unbacked: ['b'.repeat(40)],
    committerUnixByHash: new Map([['b'.repeat(40), now - 400 * DAY]]),
    nowUnix: now,
  }
  const off = __test__.splitUnbackedByWindow({ ...args, windowDays: 0 })
  const on = __test__.splitUnbackedByWindow({ ...args, windowDays: 30 })
  assert.deepEqual(off.blocking, ['b'.repeat(40)], '窗维关闭必须照拦(这条断言就是判据有牙的证明)')
  assert.deepEqual(on.blocking, [], '同一枚在 30 天窗档只报数')
})

test('问责档: --strict 把超窗存量也算进拦(存量不得在问责面上被读成"没有")', () => {
  const now = 1_700_000_000
  const r = __test__.splitUnbackedByWindow({
    unbacked: ['b'.repeat(40)],
    committerUnixByHash: new Map([['b'.repeat(40), now - 400 * DAY]]),
    nowUnix: now,
    windowDays: 30,
    strict: true,
  })
  assert.deepEqual(r.blocking, ['b'.repeat(40)], 'strict 必须把超窗拉回问责面')
})

test('排序: 超窗档按时刻升序(报告行"最老一枚"直接取 [0],不得是任意一枚)', () => {
  const now = 1_700_000_000
  const r = __test__.splitUnbackedByWindow({
    unbacked: ['x'.repeat(40), 'y'.repeat(40), 'z'.repeat(40)],
    committerUnixByHash: new Map([
      ['x'.repeat(40), now - 100 * DAY],
      ['y'.repeat(40), now - 500 * DAY],
      ['z'.repeat(40), now - 200 * DAY],
    ]),
    nowUnix: now,
    windowDays: 30,
  })
  assert.deepEqual(
    r.outOfWeek.map((o) => o.hash.slice(0, 1)),
    ['y', 'z', 'x'],
  )
})

// ─── 端到端: 窗维在真 git 仓上两条分支都成立(不接受"只有纯函数会判") ───

function makeDangling(dir, subject, committerDate) {
  execFileSync('git', ['checkout', '-b', 'tmp-x'], {
    cwd: dir,
    stdio: 'ignore',
    windowsHide: true,
  })
  const env = committerDate ? { ...process.env, GIT_COMMITTER_DATE: committerDate } : process.env
  // 2026-11-03:以前用 `--allow-empty` ⇒ 树恒等于 init 的树 ⇒ 新判据(等价残留)会把
  // 这些夹具正确判成"内容已入库",端到端用例要的"真·无出处悬空"就造不出来了。
  // 故每枚提交落一个题名唯一的文件:内容唯一 ⇒ 树不在任何可达提交里 ⇒ 真待处置。
  const onlyFile = `dangling-${subject.replace(/[^\w-]/g, '_')}.txt`
  writeFileSync(join(dir, onlyFile), `${subject}\n`)
  execFileSync('git', ['add', onlyFile], { cwd: dir, stdio: 'ignore', windowsHide: true })
  // `--date` 只改**作者**时刻,committer 时刻照旧取当前时钟 ⇒ 必须用 GIT_COMMITTER_DATE,
  // 否则造出来的"老提交"在窗维眼里是新的,那格端到端用例就是空的。
  execFileSync('git', ['commit', '-m', subject], {
    cwd: dir,
    env,
    stdio: 'ignore',
    windowsHide: true,
  })
  const oid = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  }).trim()
  execFileSync('git', ['checkout', 'main'], { cwd: dir, stdio: 'ignore', windowsHide: true })
  execFileSync('git', ['branch', '-D', 'tmp-x'], { cwd: dir, stdio: 'ignore', windowsHide: true })
  return oid
}

test('端到端·窗内: 刚丢的无出处悬空 commit ⇒ 拦,且 --list-unbacked 交出完整 oid 供处置', () => {
  const dir = createTempRepo()
  try {
    const oid = makeDangling(dir, 'e2e-recent-loss-XYZ')
    const r = runScript(['--blocking', '--filter-stash'], { cwd: dir })
    assert.equal(r.status, 1, `窗内丢失必须拦,实际 ${r.status}:\n${r.stdout.slice(-600)}`)
    assert.match(r.stdout, /天窗内/, '拦的那一档必须写明是窗内')
    const l = runScript(['--blocking', '--filter-stash', '--list-unbacked'], { cwd: dir })
    assert.match(l.stdout, new RegExp(oid), `--list-unbacked 必须逐枚给出完整 oid(${oid})`)
    // 处置出口成立:照 §22 tag 备份之后同一道门必须转绿(不是靠调窗宽)
    execFileSync('git', ['tag', `lost-commit/e2e-${oid.slice(0, 12)}`, oid], {
      cwd: dir,
      stdio: 'ignore',
      windowsHide: true,
    })
    const after = runScript(['--blocking', '--filter-stash'], { cwd: dir })
    assert.equal(
      after.status,
      0,
      `已 tag 备份应放行,实际 ${after.status}:\n${after.stdout.slice(-600)}`,
    )
  } finally {
    rmScratch(dir)
  }
})

test('端到端·超窗: 只报数不拦,同仓 --window-days 0 必翻回拦(量纲有牙的双向证明)', () => {
  const dir = createTempRepo()
  try {
    makeDangling(dir, 'e2e-ancient-loss-XYZ', '2020-01-01T00:00:00 +08:00')
    const def = runScript(['--blocking', '--filter-stash'], { cwd: dir })
    assert.equal(def.status, 0, `超窗不得拦,实际 ${def.status}:\n${def.stdout.slice(-700)}`)
    assert.match(def.stdout, /超出 \d+ 天窗、只报数不拦/, '报数行必须在(不得静默成"门绿了")')
    const full = runScript(['--blocking', '--filter-stash', '--window-days', '0'], { cwd: dir })
    assert.equal(full.status, 1, `窗维关闭必须照拦,实际 ${full.status}`)
    assert.match(full.stdout, /全量档/, '全量档的措辞必须与窗内档可区分')
    const strict = runScript(['--blocking', '--filter-stash', '--strict'], { cwd: dir })
    assert.equal(strict.status, 1, '--strict 是问责存量档,超窗也算红')
    // 环境变量与旗标同义(否则运维只能记两种写法,而记错一种就静默回到默认窗宽)
    const byEnv = runScript(['--blocking', '--filter-stash'], {
      cwd: dir,
      env: { [__test__.WINDOW_DAYS_ENV]: '0' },
    })
    assert.equal(byEnv.status, 1, `${__test__.WINDOW_DAYS_ENV}=0 必须与 --window-days 0 同义`)
  } finally {
    rmScratch(dir)
  }
})

// ─── 清单出口(--list-unbacked / --list-out-of-window):门点名了债,就必须交出债的名单 ───
// 立因:超窗那一批按设计**不由提交链拦**,所以它只有一行人读报数("9785 枚,最老一枚 …")。
// 想按 §29 处置的人只能自己重算窗口,而重算那份必然与本门漂开(§22c)。名单住在门里,
// 处置才可复现;而 safe-gc.mjs 的破坏性前置直接依赖 "--window-days 0 时 --list-unbacked
// 交出的是**全部**未备份悬空" 这条契约 —— 契约断了,前置就会把"还有近万枚没备份"读成"干净"。
const ANSI_RE = /\u001b\[[0-9;]*m/g
const O40_RE = /^[0-9a-f]{40}$/
function oidsAfterHeader(text, header) {
  const lines = String(text)
    .replace(ANSI_RE, '')
    .split('\n')
    .map((l) => l.trim())
  const at = lines.findIndex((l) => l.startsWith(header))
  assert.ok(at >= 0, `输出里找不到清单头「${header}」`)
  const out = []
  for (const l of lines.slice(at + 1)) {
    if (l === '') continue
    if (!O40_RE.test(l)) break
    out.push(l)
  }
  return out
}

test('清单出口·超窗: --list-out-of-window 逐枚交完整 oid,行形状与 --list-unbacked 同形', () => {
  const dir = createTempRepo()
  try {
    const ancient = makeDangling(dir, 'e2e-list-outwise-XYZ', '2020-01-01T00:00:00 +08:00')
    const r = runScript(['--blocking', '--filter-stash', __test__.FLAGS.listOutOfWindow], { cwd: dir })
    assert.equal(r.status, 0, `超窗不得拦,实际 ${r.status}:\n${String(r.stdout).slice(-700)}`)
    const listed = oidsAfterHeader(r.stdout, '--list-out-of-window:')
    assert.deepEqual(listed, [ancient], `超窗清单必须恰含那一枚 ${ancient},实际 ${listed}`)
  } finally {
    rmScratch(dir)
  }
})

test('清单出口·两桶不互蔽: 窗内与超窗同仓时,一次运行两个清单都必须交出(不得被 if/else 吞掉)', () => {
  const dir = createTempRepo()
  try {
    const recent = makeDangling(dir, 'e2e-list-inwin-XYZ')
    const ancient = makeDangling(dir, 'e2e-list-outwin-XYZ', '2020-01-01T00:00:00 +08:00')
    const both = runScript(
      ['--blocking', '--filter-stash', __test__.FLAGS.listUnbacked, __test__.FLAGS.listOutOfWindow],
      { cwd: dir },
    )
    assert.equal(both.status, 1, `窗内有债必须拦,实际 ${both.status}`)
    const inWin = oidsAfterHeader(both.stdout, '--list-unbacked:')
    const outWin = oidsAfterHeader(both.stdout, '--list-out-of-window:')
    assert.ok(inWin.includes(recent), `窗内清单须含 ${recent},实际 ${inWin}`)
    assert.ok(!inWin.includes(ancient), '窗内清单不得混入超窗那枚(两桶不得并成一个数)')
    // 这一条是本用例的全部意义:清单打印若被放回 if/else 链里,窗内有债时超窗名单就整个消失
    assert.ok(outWin.includes(ancient), `超窗清单须含 ${ancient},实际 ${outWin}`)
  } finally {
    rmScratch(dir)
  }
})

test('清单出口·全量档契约: --window-days 0 时 --list-unbacked 必须把超窗一起交出(safe-gc 前置靠这条)', () => {
  const dir = createTempRepo()
  try {
    const ancient = makeDangling(dir, 'e2e-list-fullface-XYZ', '2020-01-01T00:00:00 +08:00')
    const full = runScript(
      ['--blocking', '--filter-stash', __test__.FLAGS.listUnbacked, '--window-days', '0'],
      { cwd: dir },
    )
    assert.equal(full.status, 1, `窗维关闭必须照拦,实际 ${full.status}`)
    const listed = oidsAfterHeader(full.stdout, '--list-unbacked:')
    assert.ok(listed.includes(ancient), `全量档的未备份清单必须含超窗那枚 ${ancient},实际 ${listed}`)
  } finally {
    rmScratch(dir)
  }
})

test('装车证明: 超窗清单旗标必须①在 FLAGS 唯一源头里②被 argv 读取③真的打印(三处分设断言)', () => {
  const src = readFileSync(SCRIPT_PATH, 'utf8')
  const flag = __test__.FLAGS.listOutOfWindow
  assert.ok(/listOutOfWindow:\s*'--list-out-of-window'/.test(src), 'FLAGS 必须声明该旗标(唯一源头)')
  assert.ok(src.includes(`process.argv.includes(FLAGS.listOutOfWindow)`), 'main 必须从 FLAGS 读,不得写死字面量')
  assert.ok(/if \(isListOutOfWindow\)/.test(src), '读取点之后必须有真判定点')
  assert.ok(/for \(const o of win\.outOfWeek\) console\.log\(o\.hash\)/.test(src), '判定必须落到逐枚打印')
  // 顺序锁:清单打印必须排在 if/else 分桶链**之后**,否则窗内有债时超窗名单会被 else 吞掉
  const chain = src.lastIndexOf('} else if (unreachable.length > 0')
  const print = src.indexOf('if (isListOutOfWindow)')
  assert.ok(chain >= 0 && print > chain, `清单打印必须在分桶链之后(chain=${chain}, print=${print})`)
  assert.ok(
    __test__.FLAGS && __test__.FLAGS.listOutOfWindow === flag,
    'FLAGS 必须随 __test__ 导出该键,否则测试只能抄字面量(§22c 的镜像漂移)',
  )
})

test('装车证明: 窗维判据必须真挂在 main 的判定链上(函数在而无人调 = 没有)', () => {
  const src = readFileSync(SCRIPT_PATH, 'utf8')
  // 守门 70/76/81 同型教训:判据写完、自检过了,但 main 没调它 ⇒ 提交链上一路绿灯。
  // 数法刻意分开:**声明处**只允许一次,**带括号的调用**必须至少两次(声明行不带括号,
  // 所以 `calls >= 2` 等价于"除声明外至少真有一处调用");导出面单独核,免得测试 import 不到
  // 却也没人发现。只写一条 `>= 3` 的粗断言会把"导出面漏了"与"main 没调"混成同一种红。
  const pairs = [
    ['splitUnbackedByWindow', /^\s*splitUnbackedByWindow,?\s*$/m],
    ['committerUnixFor', null],
  ]
  for (const [name, exportRe] of pairs) {
    const decl = (src.match(new RegExp(`^function ${name}\\s*\\(`, 'm')) || []).length
    const calls = (src.match(new RegExp(`\\b${name}\\s*\\(`, 'g')) || []).length
    assert.equal(decl, 1, `${name} 应且仅应声明一次,实得 ${decl}`)
    assert.ok(calls >= 2, `${name} 除声明外必须有调用点(main 未接=门对该型失明),实得 ${calls}`)
    // 导出面只核**纯判据**:`committerUnixFor` 会派生 git,而 __test__ 那条约定是
    // "任何 git 派生都不在这里发生" —— 导出它的引用虽不触发派生,但会让下一个会话以为
    // 测试可以自己叫它取时刻(那就不再是"消费生产判据",而是第二条取材通道)。
    if (exportRe)
      assert.match(src, exportRe, `${name} 必须进 __test__ 导出面,供镜像直接消费而非另抄判据`)
  }
  assert.match(src, /wholeWalkFailed/, '整批派生失败那一支必须有实现,不得只写在注释里')
})

/**
 * 2026-11-04:远程 tag 完整性档「显式发起但取不到」必须显式未判定(exit 2),不得折成通过。
 * 夹具用**必然取不到**的 origin(指向不存在的本地路径):它与真超时同走 remoteTagScan 的
 * catch 分支(parsed=null ⇒ attempted/failed=true),但不需要真等 60s。
 * 为什么不注入假 git:PATH 注入在本门不成立 —— 派生走共用层的绝对路径 `GIT_BIN`,不经 PATH;
 * 且 Windows 下 `execFileSync` 不能直接起 `.cmd`(实测 EINVAL)。故采用等价可控的"取不到"夹具。
 */
test('远程 tag 完整性·显式发起但 ls-remote 取不到 ⇒ UNDETERMINED + exit 2,不得记通过', () => {
  const dir = createTempRepo()
  // 不存在的远端路径 ⇒ ls-remote 必然失败(与超时同一分支:catch ⇒ null ⇒ 未判定)
  execFileSync('git', ['remote', 'add', 'origin', join(dir, 'no-such-remote')], {
    cwd: dir,
    stdio: 'ignore',
  })
  const r = runScript(['--blocking', '--filter-stash'], {
    cwd: dir,
    env: { IHUI_COMMIT_LOSS_REMOTE: '1', IHUI_COMMIT_LOSS_NO_CACHE: '1' },
  })
  const out = `${r.stdout || ''}${r.stderr || ''}`
  // ① 输出必须出现未判定标记
  assert.match(out, /UNDETERMINED/, `显式发起却没取到,输出必须标未判定,实际:\n${out.slice(-600)}`)
  // ② 退码必须是 2(0=通过 / 1=判红 / 2=没判成)
  assert.equal(r.status, 2, `未判定必须 exit 2,实际 ${r.status}:\n${out.slice(-600)}`)
  // ③ 不得出现"通过"字样(尤其不得打印成功句)
  assert.ok(!out.includes('通过'), `未判定不得写成通过,实际输出:\n${out.slice(-600)}`)
  assert.ok(
    !out.includes(__test__.GREEN_MARKERS.noRisk),
    '未判定不得打印"无 commit 丢失风险"',
  )
})

// ─── 3b 维(2026-11-05):lost-commit/* tag 直接指向的提交也纳入逐路径覆盖 ───
// 盲区:tag 让提交可达 ⇒ fsck --unreachable 看不到它 ⇒ 旧判据完全失明。
// 这四条用例把「新维度会不会恒红 / 缺口报不报 / 会不会误扩 / 会不会重复计数」分别钉住。

test('3b·判据单元: tag 直接指向 ∧ 交付面不可达 ∧ 不在 fsck 悬空集 才进候选(④ 去重)', () => {
  const tagPointed = new Set(['aa', 'bb', 'cc'])
  const deliveryReachable = new Set(['bb'])
  const rawUnreachable = new Set(['cc'])
  assert.deepEqual(
    __test__.selectTagCoverageCandidates({ tagPointed, deliveryReachable, rawUnreachable }),
    ['aa'],
    'bb 已在交付面、cc 已被 fsck 档处理 ⇒ 只剩 aa;cc 若再进候选就是两桶重复计数',
  )
})

test('3b·判据单元: tagPointedCommitSet 只认 lost-commit/* 名集(③ 防误扩)', () => {
  const reachability = [
    { tag: 'lost-commit/auto-1', hash: 'a1' },
    { tag: 'lost-commit/auto-2', hash: 'a2' },
    { tag: 'release/v1', hash: 'r1' },
    { tag: 'backup/snapshot', hash: 'b1' },
  ]
  assert.deepEqual(
    [...__test__.tagPointedCommitSet(reachability, new Set(['lost-commit/auto-1', 'lost-commit/auto-2']))].sort(),
    ['a1', 'a2'],
    '普通 tag / backup tag 不承担"悬空提交备份"语义,纳进来是误扩',
  )
})

test('3b·端到端①: tag 指向的提交全部路径已在交付面覆盖 ⇒ 不得报红(证明不是恒红)', () => {
  const dir = createTempRepo()
  const git = (cmd) => execSync(cmd, { cwd: dir, stdio: 'ignore' })
  try {
    // 先在 temp 上造一枚"待备份"提交:新增 shared.txt=T
    git('git checkout -b temp-covered')
    writeFileSync(join(dir, 'shared.txt'), 'T\n')
    git('git add shared.txt')
    git('git commit -m "covered-dangling"')
    git('git checkout main')
    git('git branch -D temp-covered')
    const oid = execSync('git rev-parse HEAD@{1}', { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
    // 再在主线上落地同样内容(同路径同 blob)⇒ 该提交"已备份且已清偿"
    writeFileSync(join(dir, 'shared.txt'), 'T\n')
    git('git add shared.txt')
    git('git commit -m "land-shared"')
    git(`git tag lost-commit/covered ${oid}`)
    const r = runScript(['--blocking', '--filter-stash'], { cwd: dir })
    assert.equal(
      r.status,
      0,
      `已清偿必须 exit 0(否则新维度恒红),实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
    )
    assert.match(r.stdout, /↳ 逐路径覆盖:已清偿 1 \/ 未清偿 0/, '必须点名"已清偿 1"')
  } finally {
    rmScratch(dir)
  }
})

test('3b·端到端②: tag 指向的提交有路径无覆盖 ⇒ 必须点名报出来(即 b96a9dc2 形态)', () => {
  const dir = createTempRepo()
  const git = (cmd) => execSync(cmd, { cwd: dir, stdio: 'ignore' })
  try {
    git('git checkout -b temp-unpledged')
    writeFileSync(join(dir, 'lost-unique-3b.txt'), 'never-landed\n')
    git('git add lost-unique-3b.txt')
    git('git commit -m "unpledged-dangling"')
    const oid = execSync('git rev-parse HEAD', { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
    git('git checkout main')
    git('git branch -D temp-unpledged')
    git(`git tag lost-commit/unpledged ${oid}`)
    const r = runScript(['--blocking', '--filter-stash'], { cwd: dir })
    // 报告口径:本单不把 3b 未清偿转 blocking(属用户级决定),但必须**报出来**且不得记绿。
    assert.equal(r.status, 0, `3b 未清偿本轮不拦(exit 0),实际 ${r.status}:\n${r.stdout}`)
    assert.match(r.stdout, /↳ 逐路径覆盖:已清偿 0 \/ 未清偿 1/, '缺口必须计入"未清偿"')
    assert.match(
      r.stdout,
      /其中有未覆盖路径 1 \/ 无改动路径 merge或空提交 0/,
      '必须把"真有未覆盖路径"与 merge/空提交分开计数(后者没有路径可清偿)',
    )
    assert.match(r.stdout, /已备份但缺口仍在/, '必须明确这是"已备份但未落地",不是"已保护"')
    assert.match(r.stdout, new RegExp(oid.slice(0, 7)), `必须点名该提交 ${oid}`)
    assert.match(r.stdout, /lost-unique-3b\.txt/, '必须点名未覆盖路径')
    assert.ok(
      !r.stdout.includes(__test__.GREEN_MARKERS.noRisk),
      '有未清偿缺口时不得打印"无 commit 丢失风险"(那正是盲区原形)',
    )
  } finally {
    rmScratch(dir)
  }
})

test('3b·端到端③: 非 lost-commit/* 的普通 tag ⇒ 不纳入新维度(防误扩)', () => {
  const dir = createTempRepo()
  const git = (cmd) => execSync(cmd, { cwd: dir, stdio: 'ignore' })
  try {
    git('git checkout -b temp-normal-tag')
    writeFileSync(join(dir, 'normal-only.txt'), 'never-landed\n')
    git('git add normal-only.txt')
    git('git commit -m "normal-tag-dangling"')
    const oid = execSync('git rev-parse HEAD', { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
    git('git checkout main')
    git('git branch -D temp-normal-tag')
    git(`git tag release/3b-normal ${oid}`)
    const r = runScript(['--blocking', '--filter-stash'], { cwd: dir })
    assert.equal(r.status, 0, `普通 tag 不应触发任何新债,实际 ${r.status}:\n${r.stdout}`)
    assert.match(
      r.stdout,
      /(无 lost-commit\/\* tag 指向的提交|↳ 逐路径覆盖:已清偿 0 \/ 未清偿 0)/,
      '普通 tag 不得进入 3b 候选',
    )
    assert.doesNotMatch(r.stdout, new RegExp(oid.slice(0, 7)), '普通 tag 指向的提交不得被点名')
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
