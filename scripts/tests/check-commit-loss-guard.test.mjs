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

test('同内容副本: 树同而题不同 → 仍判 blocking(白名单不放宽到仅树相等)', () => {
  const dir = createTempRepo()
  try {
    // 分支删除造悬空(不走 reset,避免混入 reset 判据):空树与 init 相同,题唯一
    execSync('git checkout -b temp', { cwd: dir, stdio: 'ignore' })
    execSync('git commit --allow-empty -m "unique-subject-XYZ"', { cwd: dir, stdio: 'ignore' })
    execSync('git checkout main', { cwd: dir, stdio: 'ignore' })
    execSync('git branch -D temp', { cwd: dir, stdio: 'ignore' })
    const r = runScript(['--blocking', '--filter-stash'], { cwd: dir })
    assert.equal(r.status, 1, `题不同不得放行,应 exit 1,实际 ${r.status}`)
    assert.doesNotMatch(r.stdout, /同内容副本放行/, '不得出现白名单放行点名')
  } finally {
    rmScratch(dir)
  }
})

// ─── ④ patch-id 等价放行(G-417②:union-converge 重写产出的同补丁副本**树不同**,③ 盖不住)──
// 判据面:`git cherry HEAD <c>` 对 c 打 `- <完整oid>` 行 ⇔ c 的补丁已在主线。
// 超单轮上限 / 派生失败 / 无 `-` 行 ⇒ 一律照拦(失效方向只许"多要一次定向说明")。

test('纯函数: parseCherryHit 只认 `- <完整40位oid>` 行(+ 行/缩写/空读数/他枚 一律 false)', () => {
  const oid = 'd63a61ad717dfe2659fb2e78b05c3ef1141defa9'
  assert.ok(__test__.parseCherryHit(`- ${oid}`, oid), '现读形态:无 subject 的 `-` 行')
  assert.ok(
    __test__.parseCherryHit(`- ${oid} docs(plan): 带 subject 的形态`, oid),
    '不同 git 版本带 subject 也应认得',
  )
  assert.ok(!__test__.parseCherryHit(`+ ${oid}`, oid), '+ 行 = 未合入主线,不得放行')
  assert.ok(!__test__.parseCherryHit(`- ${oid.slice(0, 12)}`, oid), '缩写 oid 不得当命中(保守方向)')
  assert.ok(!__test__.parseCherryHit(`- ${'0'.repeat(40)}`, oid), '`-` 行指向他枚不算这一枚命中')
  assert.ok(!__test__.parseCherryHit('', oid), '空读数(allowFail 折空的派生失败)⇒ 照拦')
  assert.ok(!__test__.parseCherryHit(null, oid))
  assert.ok(!__test__.parseCherryHit(`- ${oid}`, ''), 'oid 缺失不得命中')
})

test('patch-id 等价: 树已并入他改的同补丁副本(cherry-pick 到主线)→ 放行不阻塞且点名', () => {
  const dir = createTempRepo()
  try {
    // 分支提交:加 a.txt(树 = README+a.txt,题 "feat: add a")
    execSync('git checkout -qb feat', { cwd: dir, stdio: 'ignore' })
    writeFileSync(join(dir, 'a.txt'), 'content-a\n')
    execSync('git add a.txt', { cwd: dir, stdio: 'ignore' })
    execSync('git commit -qm "feat: add a"', { cwd: dir, stdio: 'ignore' })
    const featOid = execSync('git rev-parse HEAD', { cwd: dir, encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }).trim()
    // 主线先岔开(加 b.txt)再 cherry-pick 同一补丁 ⇒ 补丁已在主线,但落地树与副本树**不同**
    // ⇒ ③"树+题逐字同"盖不住(正是票面②点名的 9 枚那一型),必须由 ④ 接住。
    execSync('git checkout -q main', { cwd: dir, stdio: 'ignore' })
    writeFileSync(join(dir, 'b.txt'), 'content-b\n')
    execSync('git add b.txt', { cwd: dir, stdio: 'ignore' })
    execSync('git commit -qm "chore: b"', { cwd: dir, stdio: 'ignore' })
    execSync(`git cherry-pick ${featOid}`, { cwd: dir, stdio: 'ignore' })
    execSync('git branch -D feat', { cwd: dir, stdio: 'ignore' })
    const r = runScript(['--blocking', '--filter-stash'], { cwd: dir })
    assert.equal(
      r.status,
      0,
      `同补丁副本应放行 exit 0,实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
    )
    assert.match(r.stdout, /patch-id 等价放行/, '④ 放行必须点名,不得静默')
    assert.match(r.stdout, /feat: add a/, '放行明细应带 subject')
    assert.match(r.stdout, /经 patch-id 等价放行/, '综合判定必须留只报数结论,不得读成"已全部备份"')
  } finally {
    rmScratch(dir)
  }
})

test('patch-id 等价: 独有内容的悬空 commit(补丁不在主线)→ 仍判 blocking,④ 不放宽', () => {
  const dir = createTempRepo()
  try {
    execSync('git checkout -qb solo', { cwd: dir, stdio: 'ignore' })
    writeFileSync(join(dir, 'solo.txt'), 'only-on-this-branch\n')
    execSync('git add solo.txt', { cwd: dir, stdio: 'ignore' })
    execSync('git commit -qm "feat: unique-solo-XYZ"', { cwd: dir, stdio: 'ignore' })
    execSync('git checkout -q main', { cwd: dir, stdio: 'ignore' })
    execSync('git branch -D solo', { cwd: dir, stdio: 'ignore' })
    const r = runScript(['--blocking', '--filter-stash'], { cwd: dir })
    assert.equal(
      r.status,
      1,
      `独有内容悬空必须照拦,实际 ${r.status}\nstdout: ${r.stdout.slice(0, 600)}`,
    )
    assert.doesNotMatch(r.stdout, /patch-id 等价放行/, '补丁不在主线不得放行')
    assert.match(r.stdout, /未备份/, '仍按未备份悬空点名')
  } finally {
    rmScratch(dir)
  }
})

test('patch-id 维上限: 窗内未备份超 CHERRY_EQUIV_MAX 枚 → 整维不量、黄色点名、保守照拦', () => {
  const dir = createTempRepo()
  try {
    execSync('git checkout -qb bulk', { cwd: dir, stdio: 'ignore' })
    for (let i = 0; i < __test__.CHERRY_EQUIV_MAX + 1; i++)
      execSync(`git commit -qm "wip-bulk-${i}" --allow-empty`, { cwd: dir, stdio: 'ignore' })
    execSync('git checkout -q main', { cwd: dir, stdio: 'ignore' })
    execSync('git branch -D bulk', { cwd: dir, stdio: 'ignore' })
    const r = runScript(['--blocking', '--filter-stash'], { cwd: dir })
    assert.equal(
      r.status,
      1,
      `超上限必须保守照拦(绝不因"没量"折绿),实际 ${r.status}\nstdout: ${r.stdout.slice(0, 600)}`,
    )
    assert.match(r.stdout, /本维不量/, '整维跳过必须可见,不得静默')
    assert.doesNotMatch(r.stdout, /patch-id 等价放行/)
  } finally {
    rmScratch(dir)
  }
})

// ─── ⑤ 对象空间落地范式中间枚豁免(2026-10-23 代裁:30a 对 commit-tree+CAS 中间枚增豁免档)──
// 判据面:subject 与在册引用同题孪生 + 全部父枚在册 ⇒ 可归因的范式滞留枚;逐条点名、清单可取。
// 真悬空(题无孪生 / 父不在册 / 无父)一律照拦 —— §12f 不削牙。

test('纯函数: parseReachableCommitIndex 解析 %H\\t%P\\t%T\\t%s(根枚空父、题内 tab 并入、畸形行跳过)', () => {
  const idx = __test__.parseReachableCommitIndex(
    [
      'a'.repeat(40) + '\t' + 'b'.repeat(40) + ' ' + 'c'.repeat(40) + '\tT1\tsome merge',
      'd'.repeat(40) + '\t\tT2\troot subject', // 根提交:%P 为空(相邻两 tab)
      'e'.repeat(40) + '\t' + 'f'.repeat(40) + '\tT3\tsome\tsubject\twith\ttabs', // 题内 tab 原样并入
      'no-tab-line',
      '',
      '\t\t\t', // hash/tree 皆空 ⇒ 跳过
      'g'.repeat(40) + '\t' + 'h'.repeat(40) + '\t\t', // tree 为空 ⇒ 跳过
    ].join('\n'),
  )
  assert.equal(idx.subjectTwin.get('some merge'), 'a'.repeat(40), '同题留第一枚入表者')
  assert.equal(idx.subjectTwin.get('some\tsubject\twith\ttabs'), 'e'.repeat(40), '题内 tab 整段当题')
  assert.equal(idx.treeByHash.get('d'.repeat(40)), 'T2', '根枚也入 treeByHash(父在册判定域含根)')
  assert.equal(idx.subjectTwin.has(''), false, '空题不入表')
  assert.equal(idx.treeByHash.size, 3, '畸形行(不足三帧/空 hash/空 tree)不得入表,实得 ' + idx.treeByHash.size)
  assert.equal(idx.treeSubjectKeys.has('T1\tsome merge'), true, 'treeSubjectKeys 与 ③ 键集同形')
  const empty = __test__.parseReachableCommitIndex('')
  assert.equal(empty.subjectTwin.size, 0, '空读数 → 空表')
  assert.equal(__test__.parseReachableCommitIndex(null).treeByHash.size, 0, 'null → 空表')
})

test('纯函数: pickParadigmIntermediates 三件齐备才豁免;无孪生/父不在册/无父/索引缺位 一律留红', () => {
  const P = 'p'.repeat(40)
  const Q = 'q'.repeat(40)
  const index = {
    subjectTwin: new Map([['land: X', 't'.repeat(40)]]),
    treeByHash: new Map([
      [P, 'TREE_P'],
      [Q, 'TREE_Q'],
    ]),
  }
  // 单亲暂存枚:题有孪生、父在册、树与父不同
  let r = pick({
    candidates: ['c1'],
    subjectByHash: new Map([['c1', 'land: X']]),
    parentsByHash: new Map([['c1', [P]]]),
    treeByCommit: new Map([['c1', 'TREE_OTHER']]),
    index,
  })
  assert.equal(r.exempt.length, 1)
  assert.equal(r.exempt[0].shape, '单亲暂存枚')
  assert.equal(r.exempt[0].twin, 't'.repeat(40), '孪生 hash 必须带出(点名留痕)')
  assert.deepEqual(r.rest, [])
  // 空枚:树与在册父枚逐字同
  r = pick({
    candidates: ['c2'],
    subjectByHash: new Map([['c2', 'land: X']]),
    parentsByHash: new Map([['c2', [P]]]),
    treeByCommit: new Map([['c2', 'TREE_P']]),
    index,
  })
  assert.equal(r.exempt[0].shape, '空枚')
  // merge 中间态:双父都在册
  r = pick({
    candidates: ['c3'],
    subjectByHash: new Map([['c3', 'land: X']]),
    parentsByHash: new Map([['c3', [P, Q]]]),
    index,
  })
  assert.equal(r.exempt[0].shape, 'merge中间态')
  // 题无孪生 ⇒ 留红(真悬空)
  r = pick({
    candidates: ['c4'],
    subjectByHash: new Map([['c4', 'unique-subject-no-twin']]),
    parentsByHash: new Map([['c4', [P]]]),
    index,
  })
  assert.deepEqual(r.rest, ['c4'], '题无孪生不得豁免')
  assert.equal(r.exempt.length, 0)
  // 父枚不在册(悬空链)⇒ 即便题有孪生也留红
  r = pick({
    candidates: ['c5'],
    subjectByHash: new Map([['c5', 'land: X']]),
    parentsByHash: new Map([['c5', [P, 'x'.repeat(40)]]]),
    index,
  })
  assert.deepEqual(r.rest, ['c5'], '有一枚父不在册即整枚留红(全父在册是硬条件)')
  // 无父(悬空根)⇒ 留红
  r = pick({
    candidates: ['c6'],
    subjectByHash: new Map([['c6', 'land: X']]),
    parentsByHash: new Map([['c6', []]]),
    index,
  })
  assert.deepEqual(r.rest, ['c6'], '无父的悬空根枚无归因出口,照拦')
  // 父读数取不到(Map 里没有这一枚)⇒ 留红("没量到"不折绿)
  r = pick({
    candidates: ['c7'],
    subjectByHash: new Map([['c7', 'land: X']]),
    parentsByHash: new Map(),
    index,
  })
  assert.deepEqual(r.rest, ['c7'], '父枚读数缺失照拦')
  // 索引缺位 ⇒ 整维不量,全部留红且 indexMissing 大声
  r = pick({
    candidates: ['c8', 'c9'],
    subjectByHash: new Map([['c8', 'land: X']]),
    parentsByHash: new Map([['c8', [P]]]),
    index: null,
  })
  assert.deepEqual(r.rest, ['c8', 'c9'], '索引缺位时整维不量')
  assert.equal(r.indexMissing, true)
  assert.equal(r.exempt.length, 0)
  function pick(args) {
    return __test__.pickParadigmIntermediates(args)
  }
})

test('范式豁免·单亲暂存枚: CAS 重试滞留枚(题与主线孪生同、父在册、树不同)→ 豁免且点名,门转绿', () => {
  const dir = createTempRepo()
  try {
    // 旁路落地范式的重试形态:同一 subject 先在旁路支上 commit-tree(滞留),
    // 主线孪生同题但树不同(CAS 重试落在更新的基线上)⇒ ③(树+题逐字同)盖不住。
    execSync('git checkout -qb side', { cwd: dir, stdio: 'ignore' })
    writeFileSync(join(dir, 'a.txt'), 'v1\n')
    execSync('git add a.txt', { cwd: dir, stdio: 'ignore' })
    execSync('git commit -qm "land: X"', { cwd: dir, stdio: 'ignore' })
    const sideOid = execSync('git rev-parse HEAD', { cwd: dir, encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }).trim()
    execSync('git checkout -q main', { cwd: dir, stdio: 'ignore' })
    writeFileSync(join(dir, 'b.txt'), 'v2\n')
    execSync('git add b.txt', { cwd: dir, stdio: 'ignore' })
    execSync('git commit -qm "land: X"', { cwd: dir, stdio: 'ignore' })
    execSync('git branch -D side', { cwd: dir, stdio: 'ignore' })
    const r = runScript(['--blocking', '--filter-stash'], { cwd: dir })
    assert.equal(
      r.status,
      0,
      `范式中间枚应豁免 exit 0,实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
    )
    assert.match(r.stdout, /落地范式中间枚豁免/, '⑤ 放行必须点名,不得静默')
    assert.match(r.stdout, /单亲暂存枚/, '形态归类必须可见')
    assert.match(r.stdout, new RegExp(sideOid.slice(0, 12)), '豁免行必须带候选 hash')
    assert.match(r.stdout, /经对象空间落地范式豁免/, '综合判定必须留只报数结论,不得读成"已全部备份"')
  } finally {
    rmScratch(dir)
  }
})

test('范式豁免·merge 中间态: 双父均在册且题有主线孪生 → 豁免且点名(④ 对 merge 产不出命中,必须由 ⑤ 接住)', () => {
  const dir = createTempRepo()
  try {
    execSync('git checkout -qb theirs', { cwd: dir, stdio: 'ignore' })
    writeFileSync(join(dir, 't.txt'), 'theirs\n')
    execSync('git add t.txt', { cwd: dir, stdio: 'ignore' })
    execSync('git commit -qm "feat: theirs"', { cwd: dir, stdio: 'ignore' })
    execSync('git checkout -q main', { cwd: dir, stdio: 'ignore' })
    writeFileSync(join(dir, 'm.txt'), 'main\n')
    execSync('git add m.txt', { cwd: dir, stdio: 'ignore' })
    execSync('git commit -qm "chore: advance"', { cwd: dir, stdio: 'ignore' })
    // 旁路支先合一次(滞留枚 P1:父 = M1 与 T1,题 "union merge")
    execSync('git checkout -qb mbranch', { cwd: dir, stdio: 'ignore' })
    execSync('git merge -m "union merge" theirs', { cwd: dir, stdio: 'ignore' })
    const p1Oid = execSync('git rev-parse HEAD', { cwd: dir, encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }).trim()
    // 主线岔开后落地同题合并(孪生,树不同)
    execSync('git checkout -q main', { cwd: dir, stdio: 'ignore' })
    writeFileSync(join(dir, 'c.txt'), 'advance2\n')
    execSync('git add c.txt', { cwd: dir, stdio: 'ignore' })
    execSync('git commit -qm "chore: advance2"', { cwd: dir, stdio: 'ignore' })
    execSync('git merge -m "union merge" theirs', { cwd: dir, stdio: 'ignore' })
    execSync('git branch -D mbranch', { cwd: dir, stdio: 'ignore' })
    const r = runScript(['--blocking', '--filter-stash'], { cwd: dir })
    assert.equal(
      r.status,
      0,
      `merge 中间态应豁免 exit 0,实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
    )
    assert.match(r.stdout, /落地范式中间枚豁免/, '⑤ 放行必须点名')
    assert.match(r.stdout, /merge中间态/, '形态归类必须可见')
    assert.match(r.stdout, new RegExp(p1Oid.slice(0, 12)), '豁免行必须带滞留 merge 枚 hash')
  } finally {
    rmScratch(dir)
  }
})

test('范式豁免·空枚: 树与在册父枚逐字同且题有孪生 → 豁免,读数标"空枚"', () => {
  const dir = createTempRepo()
  try {
    execSync('git checkout -qb side', { cwd: dir, stdio: 'ignore' })
    execSync('git commit -qm "chore(auto): 收编" --allow-empty', { cwd: dir, stdio: 'ignore' })
    const eOid = execSync('git rev-parse HEAD', { cwd: dir, encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }).trim()
    execSync('git checkout -q main', { cwd: dir, stdio: 'ignore' })
    writeFileSync(join(dir, 'a.txt'), 'landed\n')
    execSync('git add a.txt', { cwd: dir, stdio: 'ignore' })
    execSync('git commit -qm "chore(auto): 收编"', { cwd: dir, stdio: 'ignore' })
    execSync('git branch -D side', { cwd: dir, stdio: 'ignore' })
    const r = runScript(['--blocking', '--filter-stash'], { cwd: dir })
    assert.equal(
      r.status,
      0,
      `范式空枚应豁免 exit 0,实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
    )
    assert.match(r.stdout, /落地范式中间枚豁免/, '⑤ 放行必须点名')
    assert.match(r.stdout, /空枚/, '形态归类必须可见')
    assert.match(r.stdout, new RegExp(eOid.slice(0, 12)), '豁免行必须带空枚 hash')
  } finally {
    rmScratch(dir)
  }
})

test('真悬空仍判红: 题无孪生的独有内容悬空(父在册)→ ⑤ 不放行,blocking 照旧(§12f 不削牙)', () => {
  const dir = createTempRepo()
  try {
    execSync('git checkout -qb solo', { cwd: dir, stdio: 'ignore' })
    writeFileSync(join(dir, 'solo.txt'), 'only-here\n')
    execSync('git add solo.txt', { cwd: dir, stdio: 'ignore' })
    execSync('git commit -qm "feat: unique-solo-P5"', { cwd: dir, stdio: 'ignore' })
    execSync('git checkout -q main', { cwd: dir, stdio: 'ignore' })
    execSync('git branch -D solo', { cwd: dir, stdio: 'ignore' })
    const r = runScript(['--blocking', '--filter-stash'], { cwd: dir })
    assert.equal(r.status, 1, `独有内容悬空必须照拦,实际 ${r.status}`)
    assert.doesNotMatch(r.stdout, /落地范式中间枚豁免/, '题无孪生不得被 ⑤ 折绿')
    assert.match(r.stdout, /未备份/, '仍按未备份悬空点名')
  } finally {
    rmScratch(dir)
  }
})

test('真悬空仍判红: 悬空链(父枚本身不在册)→ 即便题有孪生也不豁免', () => {
  const dir = createTempRepo()
  try {
    execSync('git checkout -qb side', { cwd: dir, stdio: 'ignore' })
    writeFileSync(join(dir, 'x.txt'), 'x\n')
    execSync('git add x.txt', { cwd: dir, stdio: 'ignore' })
    execSync('git commit -qm "land: Y"', { cwd: dir, stdio: 'ignore' })
    writeFileSync(join(dir, 'y.txt'), 'y\n')
    execSync('git add y.txt', { cwd: dir, stdio: 'ignore' })
    execSync('git commit -qm "land: Z"', { cwd: dir, stdio: 'ignore' })
    const topOid = execSync('git rev-parse HEAD', { cwd: dir, encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }).trim()
    // 主线只有 "land: Z" 的孪生(顶枚题有出处),但它的父(第一枚)不在册 ⇒ 整链无出处
    execSync('git checkout -q main', { cwd: dir, stdio: 'ignore' })
    writeFileSync(join(dir, 'w.txt'), 'w\n')
    execSync('git add w.txt', { cwd: dir, stdio: 'ignore' })
    execSync('git commit -qm "land: Z"', { cwd: dir, stdio: 'ignore' })
    execSync('git branch -D side', { cwd: dir, stdio: 'ignore' })
    const r = runScript(['--blocking', '--filter-stash'], { cwd: dir })
    assert.equal(r.status, 1, `父不在册的悬空链必须照拦,实际 ${r.status}`)
    assert.doesNotMatch(r.stdout, /落地范式中间枚豁免/, '全父在册是硬条件,链上枚不得折绿')
    assert.match(r.stdout, new RegExp(topOid.slice(0, 12)), '未备份点名必须含链上顶枚')
  } finally {
    rmScratch(dir)
  }
})

test('问责档: --strict 不关 ⑤(范式豁免判的是"不是丢失",不是"不由提交链负责")', () => {
  const dir = createTempRepo()
  try {
    execSync('git checkout -qb side', { cwd: dir, stdio: 'ignore' })
    writeFileSync(join(dir, 'a.txt'), 'v1\n')
    execSync('git add a.txt', { cwd: dir, stdio: 'ignore' })
    execSync('git commit -qm "land: X"', { cwd: dir, stdio: 'ignore' })
    execSync('git checkout -q main', { cwd: dir, stdio: 'ignore' })
    writeFileSync(join(dir, 'b.txt'), 'v2\n')
    execSync('git add b.txt', { cwd: dir, stdio: 'ignore' })
    execSync('git commit -qm "land: X"', { cwd: dir, stdio: 'ignore' })
    execSync('git branch -D side', { cwd: dir, stdio: 'ignore' })
    const r = runScript(['--blocking', '--filter-stash', '--strict'], { cwd: dir })
    assert.equal(r.status, 0, `--strict 下范式中间枚仍应豁免,实际 ${r.status}\n${r.stdout}`)
    assert.match(r.stdout, /落地范式中间枚豁免/)
  } finally {
    rmScratch(dir)
  }
})

test('清单出口·范式豁免: --list-paradigm-exempt 逐枚交完整 oid,行形状与 --list-unbacked 同形', () => {
  const dir = createTempRepo()
  try {
    execSync('git checkout -qb side', { cwd: dir, stdio: 'ignore' })
    writeFileSync(join(dir, 'a.txt'), 'v1\n')
    execSync('git add a.txt', { cwd: dir, stdio: 'ignore' })
    execSync('git commit -qm "land: X"', { cwd: dir, stdio: 'ignore' })
    const sideOid = execSync('git rev-parse HEAD', { cwd: dir, encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }).trim()
    execSync('git checkout -q main', { cwd: dir, stdio: 'ignore' })
    writeFileSync(join(dir, 'b.txt'), 'v2\n')
    execSync('git add b.txt', { cwd: dir, stdio: 'ignore' })
    execSync('git commit -qm "land: X"', { cwd: dir, stdio: 'ignore' })
    execSync('git branch -D side', { cwd: dir, stdio: 'ignore' })
    const r = runScript(['--blocking', '--filter-stash', __test__.FLAGS.listParadigmExempt], {
      cwd: dir,
    })
    assert.equal(r.status, 0, `实际 ${r.status}\n${r.stdout}`)
    const listed = oidsAfterHeader(r.stdout, '--list-paradigm-exempt:')
    assert.deepEqual(listed, [sideOid], `豁免清单必须恰含 ${sideOid},实际 ${listed}`)
  } finally {
    rmScratch(dir)
  }
})

test('装车证明: 范式豁免清单旗标必须①在 FLAGS 唯一源头②被 argv 读取③真的逐枚打印', () => {
  const src = readFileSync(SCRIPT_PATH, 'utf8')
  assert.ok(
    /listParadigmExempt:\s*'--list-paradigm-exempt'/.test(src),
    'FLAGS 必须声明该旗标(唯一源头)',
  )
  assert.ok(
    src.includes('process.argv.includes(FLAGS.listParadigmExempt)'),
    'main 必须从 FLAGS 读,不得写死字面量',
  )
  assert.ok(/if \(isListParadigmExempt\)/.test(src), '读取点之后必须有真判定点')
  assert.ok(/for \(const e of paradigmExempt\) console\.log\(e\.hash\)/.test(src), '判定必须落到逐枚打印')
  assert.ok(
    __test__.FLAGS && __test__.FLAGS.listParadigmExempt === '--list-paradigm-exempt',
    'FLAGS 必须随 __test__ 导出该键,否则测试只能抄字面量(§22c 的镜像漂移)',
  )
})

test('装车证明: ⑤ 判据必须真挂在 main 的判定链上(函数在而无人调 = 没有)', () => {
  const src = readFileSync(SCRIPT_PATH, 'utf8')
  for (const name of ['parseReachableCommitIndex', 'pickParadigmIntermediates']) {
    const decl = (src.match(new RegExp(`^function ${name}\\s*\\(`, 'm')) || []).length
    const calls = (src.match(new RegExp(`\\b${name}\\s*\\(`, 'g')) || []).length
    assert.equal(decl, 1, `${name} 应且仅应声明一次,实得 ${decl}`)
    assert.ok(calls >= 2, `${name} 除声明外必须有调用点(main 未接=门对该型失明),实得 ${calls}`)
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

    // 2026-10-21 起远端扫描默认不发网络(IHUI_COMMIT_LOSS_REMOTE=1 才开)——本条测的正是
    // 远端面,必须显式开旗;不开则 remoteTagScan 直接跳过,"仅远端 tag 不自愈"是必然红。
    const r = runScript(['--blocking'], { cwd: local, env: { IHUI_COMMIT_LOSS_REMOTE: '1' } })
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
  // `--date` 只改**作者**时刻,committer 时刻照旧取当前时钟 ⇒ 必须用 GIT_COMMITTER_DATE,
  // 否则造出来的"老提交"在窗维眼里是新的,那格端到端用例就是空的。
  execFileSync('git', ['commit', '--allow-empty', '-m', subject], {
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
  const chain = src.lastIndexOf('} else if (unreachable.length > 0) {')
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
