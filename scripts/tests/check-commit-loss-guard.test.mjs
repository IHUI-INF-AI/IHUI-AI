import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-commit-loss-guard.mjs')

// ─── 辅助:创建临时 git 仓库(含初始 commit) ──────────────
function createTempRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-loss-'))
  execSync('git init -b main', { cwd: dir, stdio: 'pipe' })
  execSync('git config user.email test@test.com', { cwd: dir, stdio: 'pipe' })
  execSync('git config user.name test', { cwd: dir, stdio: 'pipe' })
  execSync('git config commit.gpgsign false', { cwd: dir, stdio: 'pipe' })
  writeFileSync(join(dir, 'README.md'), '# init\n')
  execSync('git add README.md', { cwd: dir, stdio: 'pipe' })
  execSync('git commit -m "init"', { cwd: dir, stdio: 'pipe' })
  return dir
}

// 辅助:运行 check-commit-loss-guard.mjs
function runScript(args = [], opts = {}) {
  return spawnSync('node', [SCRIPT_PATH, ...args], {
    cwd: opts.cwd || process.cwd(),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, ...opts.env },
  })
}

// ─── 正则单元测试(源脚本未导出函数,直接测正则规则) ──────
// 这些正则复制自源脚本,用于验证规则逻辑的正确性

const RESET_REGEX = /reset:\s*moving to HEAD[~@]/
const STASH_REGEXES = [
  /^WIP on /,
  /^On main: /,
  /^index on main: /,
  /^untracked files on main: /,
  /^untracked files on /,
]
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
    assert.equal(r.status, 0, `干净仓库应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`)
    assert.match(r.stdout, /无 commit 丢失风险|未检测到 reset|未检测到悬空 commit/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('CLI: --help 不崩溃(脚本未实现 --help,按默认模式运行)', () => {
  const dir = createTempRepo()
  try {
    const r = runScript(['--help'], { cwd: dir })
    assert.ok(r.status === 0 || r.status === 1, `--help 不应 crash,实际 exit ${r.status}\nstderr: ${r.stderr}`)
    assert.ok(!r.stderr.includes('Error:'), `--help 不应产生 Error`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('CLI: --blocking flag 在干净仓库 → exit 0(无阻塞项)', () => {
  const dir = createTempRepo()
  try {
    const r = runScript(['--blocking'], { cwd: dir })
    assert.equal(r.status, 0, `干净仓库 +blocking 应 exit 0,实际 ${r.status}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('CLI: --filter-stash flag 在干净仓库 → exit 0', () => {
  const dir = createTempRepo()
  try {
    const r = runScript(['--filter-stash'], { cwd: dir })
    assert.equal(r.status, 0, `干净仓库 +filter-stash 应 exit 0,实际 ${r.status}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('CLI: HUSKY_SKIP_COMMIT_LOSS_CHECK=1 → 跳过检测 exit 0', () => {
  const dir = createTempRepo()
  try {
    const r = runScript([], { cwd: dir, env: { HUSKY_SKIP_COMMIT_LOSS_CHECK: '1' } })
    assert.equal(r.status, 0)
    assert.match(r.stdout, /已跳过/, '应显示跳过消息')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── reflog reset 检测 ───────────────────────────────────

test('检测: reflog 含 reset: moving to HEAD~ → 命中(stdout 报告 reset)', () => {
  const dir = createTempRepo()
  try {
    // 创建第二个 commit,然后 reset 撤销 → reflog 记录 reset
    execSync('git commit --allow-empty -m "temp-commit"', { cwd: dir, stdio: 'pipe' })
    execSync('git reset HEAD~1', { cwd: dir, stdio: 'pipe' })
    const r = runScript([], { cwd: dir })
    assert.match(r.stdout, /reset/, 'stdout 应提及 reset')
    assert.match(r.stdout, /检测到.*reset|reset 操作/, '应报告检测到 reset')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('检测: reflog 不含 reset → 不报告 reset(干净仓库)', () => {
  const dir = createTempRepo()
  try {
    const r = runScript([], { cwd: dir })
    assert.match(r.stdout, /未检测到 reset/, '应报告未检测到 reset')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('检测: reset + --blocking → exit 1(阻塞模式)', () => {
  const dir = createTempRepo()
  try {
    execSync('git commit --allow-empty -m "temp"', { cwd: dir, stdio: 'pipe' })
    execSync('git reset HEAD~1', { cwd: dir, stdio: 'pipe' })
    const r = runScript(['--blocking'], { cwd: dir })
    assert.equal(r.status, 1, `reset + blocking 应 exit 1,实际 ${r.status}`)
    assert.match(r.stdout, /阻塞 commit|commit 丢失风险/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── fsck 悬空 commit 检测 ───────────────────────────────

test('检测: fsck 悬空 commit(分支删除) → 命中', () => {
  const dir = createTempRepo()
  try {
    // 在临时分支上创建 commit,然后删除分支 → commit 悬空
    execSync('git checkout -b temp-branch', { cwd: dir, stdio: 'pipe' })
    execSync('git commit --allow-empty -m "dangling-commit"', { cwd: dir, stdio: 'pipe' })
    execSync('git checkout main', { cwd: dir, stdio: 'pipe' })
    execSync('git branch -D temp-branch', { cwd: dir, stdio: 'pipe' })
    const r = runScript([], { cwd: dir })
    // 悬空 commit 应被检测到(可能被 tag 备份规则处理,但应出现在报告中)
    assert.match(r.stdout, /悬空 commit|dangling|unreachable|未.*备份/, '应提及悬空 commit')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── lost-commit/* 和 backup/* tag 检测 ─────────────────

test('检测: lost-commit/* tag 存在 → stdout 列出', () => {
  const dir = createTempRepo()
  try {
    execSync('git tag lost-commit/test-backup HEAD', { cwd: dir, stdio: 'pipe' })
    const r = runScript([], { cwd: dir })
    assert.match(r.stdout, /lost-commit\/test-backup/, '应列出 lost-commit/test-backup tag')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('检测: backup/* tag 存在 → stdout 列出', () => {
  const dir = createTempRepo()
  try {
    execSync('git tag backup/snapshot-1 HEAD', { cwd: dir, stdio: 'pipe' })
    const r = runScript([], { cwd: dir })
    assert.match(r.stdout, /backup\/snapshot-1/, '应列出 backup/snapshot-1 tag')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 多规则命中(reset + 悬空 commit 同时) ─────────────

test('多规则: reset + 悬空 commit 同时 → 综合报告 + blocking exit 1', () => {
  const dir = createTempRepo()
  try {
    // commit B,然后 reset HEAD~1 → reset 记录 + B 悬空
    execSync('git commit --allow-empty -m "will-be-lost"', { cwd: dir, stdio: 'pipe' })
    execSync('git reset HEAD~1', { cwd: dir, stdio: 'pipe' })
    const r = runScript(['--blocking', '--filter-stash'], { cwd: dir })
    assert.equal(r.status, 1, `reset + 悬空 + blocking 应 exit 1,实际 ${r.status}`)
    // stdout 应同时提及 reset 和悬空 commit
    assert.match(r.stdout, /reset/, '应报告 reset')
    assert.match(r.stdout, /悬空 commit|unreachable/, '应报告悬空 commit')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── tag 备份悬空 commit → 不阻塞 ───────────────────────

test('备份: 悬空 commit 已 tag 备份 → 非 blocking(已保护)', () => {
  const dir = createTempRepo()
  try {
    // 创建悬空 commit
    execSync('git checkout -b temp', { cwd: dir, stdio: 'pipe' })
    execSync('git commit --allow-empty -m "backed-up-commit"', { cwd: dir, stdio: 'pipe' })
    const hash = execSync('git rev-parse HEAD', { cwd: dir, encoding: 'utf8' }).trim()
    execSync('git checkout main', { cwd: dir, stdio: 'pipe' })
    execSync('git branch -D temp', { cwd: dir, stdio: 'pipe' })
    // 为悬空 commit 创建 lost-commit tag 备份
    execSync(`git tag lost-commit/backed-up ${hash}`, { cwd: dir, stdio: 'pipe' })
    const r = runScript(['--blocking', '--filter-stash'], { cwd: dir })
    // 已备份的悬空 commit 不应导致 blocking(exit 0,因为已保护)
    // 注:可能因 lost-commit tag 仅本地(未 push)而 warn,但不 blocking
    assert.equal(r.status, 0, `已备份悬空 commit + blocking 应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /已全部 tag 备份|已保护|lost-commit\/backed-up/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── --filter-stash 行为验证 ─────────────────────────────

test('filter-stash: stash-like 悬空 commit 被过滤(不报告为丢失)', () => {
  const dir = createTempRepo()
  try {
    // 创建一个 stash,然后 drop 使其悬空
    writeFileSync(join(dir, 'file.txt'), 'content\n')
    execSync('git add file.txt', { cwd: dir, stdio: 'pipe' })
    execSync('git stash', { cwd: dir, stdio: 'pipe' })
    execSync('git stash drop', { cwd: dir, stdio: 'pipe' })
    // 用 --filter-stash 运行 → stash-like 悬空 commit 应被过滤
    const r = runScript(['--filter-stash'], { cwd: dir })
    assert.equal(r.status, 0, `filter-stash 过滤 stash-like 后应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
    // 验证过滤行为:stdout 应提及已过滤,或不报告 stash-like 为未备份悬空
    assert.ok(
      /已过滤|stash-like|未检测到悬空 commit/.test(r.stdout),
      '应显示过滤行为或无悬空 commit',
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 无 origin remote 场景(不 crash) ────────────────────

test('鲁棒性: 无 origin remote → 不 crash(远程 tag 校验跳过)', () => {
  const dir = createTempRepo()
  try {
    // 临时仓库无 origin,git ls-remote origin 会失败
    // 脚本应 allowFail 处理,不 crash
    const r = runScript([], { cwd: dir })
    assert.ok(r.status === 0 || r.status === 1, `无 origin 不应 crash,实际 exit ${r.status}`)
    assert.ok(!r.stderr.includes('Error:'), `不应有未捕获 Error`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
