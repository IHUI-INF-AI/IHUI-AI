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

// ─── 正则单元测试(源脚本未导出函数,直接测正则规则) ──────
// 这些正则复制自源脚本,用于验证规则逻辑的正确性

const RESET_REGEX = /reset:\s*moving to HEAD[~@]/
const STASH_REGEXES = [/^WIP on /, /^On \S+: /, /^index on \S+: /, /^untracked files on /]
const HASH_EXTRACT_REGEX = /^[A-Za-z ]+on\s+\S+:\s+([0-9a-f]{7,40})\b/

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

test('正则: WIP on main: → 匹配 stash subject', () => {
  assert.ok(STASH_REGEXES.some((re) => re.test('WIP on main: 5ef36e59d fix sidebar')))
})

test('正则: index on main: → 匹配 stash subject', () => {
  assert.ok(STASH_REGEXES.some((re) => re.test('index on main: 5ef36e59d')))
})

test('正则: index on fix/<branch>: → 匹配 stash subject(非 main 分支)', () => {
  assert.ok(
    STASH_REGEXES.some((re) =>
      re.test('index on fix/test-suite-cleanup-2026-08-17: 8f957984b0 fix(msg)'),
    ),
  )
})

test('正则: On fix/<branch>: → 匹配 stash subject(非 main 分支)', () => {
  assert.ok(STASH_REGEXES.some((re) => re.test('On fix/foo: 5ef36e59d fix(msg)')))
})

test('正则: 普通提交 subject → 不匹配 stash', () => {
  assert.ok(!STASH_REGEXES.some((re) => re.test('feat: add new feature')))
})

test('正则: 从 stash subject 提取原 commit hash', () => {
  const m = 'WIP on main: 5ef36e59d fix sidebar'.match(HASH_EXTRACT_REGEX)
  assert.ok(m, '应匹配')
  assert.equal(m[1], '5ef36e59d')
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

    const r = runScript(['--blocking'], { cwd: local })
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
