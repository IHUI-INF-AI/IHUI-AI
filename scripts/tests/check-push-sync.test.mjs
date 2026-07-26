import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-push-sync.mjs')

// ─── 辅助:创建临时 git 仓库(含初始 commit) ──────────────
function createTempRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-pushsync-'))
  execSync('git init -b main', { cwd: dir, stdio: 'pipe' })
  execSync('git config user.email test@test.com', { cwd: dir, stdio: 'pipe' })
  execSync('git config user.name test', { cwd: dir, stdio: 'pipe' })
  execSync('git config commit.gpgsign false', { cwd: dir, stdio: 'pipe' })
  writeFileSync(join(dir, 'README.md'), '# init\n')
  execSync('git add README.md', { cwd: dir, stdio: 'pipe' })
  execSync('git commit -m "init"', { cwd: dir, stdio: 'pipe' })
  return dir
}

// 辅助:创建临时 bare 仓库(作为 origin)
function createTempBareOrigin() {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-origin-'))
  execSync('git init --bare -b main', { cwd: dir, stdio: 'pipe' })
  return dir
}

// 辅助:创建工作仓库 + bare origin,并 push 初始 commit(synced 状态)
function createSyncedRepoWithOrigin() {
  const work = createTempRepo()
  const origin = createTempBareOrigin()
  // Windows 路径转正斜杠(git remote add 兼容)
  const originUrl = origin.replace(/\\/g, '/')
  execSync(`git remote add origin "${originUrl}"`, { cwd: work, stdio: 'pipe' })
  execSync('git push -u origin main', { cwd: work, stdio: 'pipe' })
  return { work, origin }
}

// 辅助:运行 check-push-sync.mjs
function runScript(args = [], opts = {}) {
  return spawnSync('node', [SCRIPT_PATH, ...args], {
    cwd: opts.cwd || process.cwd(),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, ...opts.env },
  })
}

// 辅助:在工作仓库中创建一个新 commit(不 push)
function makeLocalCommit(dir, message) {
  writeFileSync(join(dir, `file-${Date.now()}.txt`), `content-${Date.now()}\n`)
  execSync('git add -A', { cwd: dir, stdio: 'pipe' })
  execSync(`git commit -m "${message}"`, { cwd: dir, stdio: 'pipe' })
}

// 辅助:去除 ANSI 颜色码(脚本输出含 \x1B[31m 等颜色码,需剥离后匹配)
function stripAnsi(s) {
  return s.replace(/\x1B\[[0-9;]*m/g, '')
}

// ─── 1. CLI --help ──────────────────────────────────────
test('CLI: --help 不崩溃(脚本未实现 --help,按默认模式运行)', () => {
  const dir = createTempRepo()
  try {
    // 无 origin → exit 0 (跳过)
    const r = runScript(['--help'], { cwd: dir })
    assert.ok(r.status === 0, `--help 不应 crash,实际 exit ${r.status}`)
    assert.ok(!r.stderr.includes('Error:'), `--help 不应产生未捕获 Error`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 2. CLI 无参数运行(无 origin → 跳过) ────────────────
test('CLI: 无参数运行(无 origin remote → exit 0 跳过)', () => {
  const dir = createTempRepo()
  try {
    const r = runScript([], { cwd: dir })
    assert.equal(r.status, 0, `无 origin 应 exit 0(跳过),实际 ${r.status}`)
    assert.match(r.stdout, /未配置 origin|跳过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 3. HUSKY_SKIP_PUSH_SYNC=1 跳过 ─────────────────────
test('豁免: HUSKY_SKIP_PUSH_SYNC=1 → exit 0(跳过检查)', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    // 即使本地 ahead,也跳过
    makeLocalCommit(work, 'unpushed commit')
    const r = runScript([], { cwd: work, env: { HUSKY_SKIP_PUSH_SYNC: '1' } })
    assert.equal(r.status, 0, `HUSKY_SKIP_PUSH_SYNC=1 应 exit 0,实际 ${r.status}`)
    assert.match(r.stdout, /HUSKY_SKIP_PUSH_SYNC|跳过/)
  } finally {
    rmSync(work, { recursive: true, force: true })
    rmSync(origin, { recursive: true, force: true })
  }
})

// ─── 4. IHUI_ARCHIVE_COMMIT=1 归档 commit 豁免 ───────────
test('豁免: IHUI_ARCHIVE_COMMIT=1 → exit 0(归档 commit 跳过)', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    makeLocalCommit(work, 'archive commit')
    const r = runScript([], { cwd: work, env: { IHUI_ARCHIVE_COMMIT: '1' } })
    assert.equal(r.status, 0, `IHUI_ARCHIVE_COMMIT=1 应 exit 0,实际 ${r.status}`)
    assert.match(r.stdout, /IHUI_ARCHIVE_COMMIT|归档|跳过/)
  } finally {
    rmSync(work, { recursive: true, force: true })
    rmSync(origin, { recursive: true, force: true })
  }
})

// ─── 5. 本地与 origin 同步 → exit 0 ─────────────────────
test('同步: 本地 HEAD == origin/main → exit 0', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    const r = runScript([], { cwd: work })
    assert.equal(r.status, 0, `同步状态应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /已同步|HEAD/)
  } finally {
    rmSync(work, { recursive: true, force: true })
    rmSync(origin, { recursive: true, force: true })
  }
})

// ─── 6. 本地 ahead 1 个 commit → exit 1 阻塞 ────────────
test('ahead: 本地 ahead 1 个 commit → exit 1(阻塞)', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    makeLocalCommit(work, 'unpushed commit 1')
    const r = runScript([], { cwd: work })
    assert.equal(r.status, 1, `ahead 1 应 exit 1,实际 ${r.status}`)
    // 错误消息走 console.error(stderr),含 ANSI 颜色码,需剥离后匹配
    assert.match(stripAnsi(r.stderr), /1 个未 push|Push 同步/)
  } finally {
    rmSync(work, { recursive: true, force: true })
    rmSync(origin, { recursive: true, force: true })
  }
})

// ─── 7. 本地 ahead 3 个 commit → exit 1 阻塞 ────────────
test('ahead: 本地 ahead 3 个 commit → exit 1(显示 3)', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    makeLocalCommit(work, 'unpushed commit 1')
    makeLocalCommit(work, 'unpushed commit 2')
    makeLocalCommit(work, 'unpushed commit 3')
    const r = runScript([], { cwd: work })
    assert.equal(r.status, 1, `ahead 3 应 exit 1,实际 ${r.status}`)
    // 错误消息走 console.error(stderr),含 ANSI 颜色码,需剥离后匹配
    assert.match(stripAnsi(r.stderr), /3 个未 push/)
  } finally {
    rmSync(work, { recursive: true, force: true })
    rmSync(origin, { recursive: true, force: true })
  }
})

// ─── 8. 本地 behind origin → exit 0(跳过,不阻塞) ──────
test('behind: 本地 behind origin → exit 0(无 ahead commit,跳过)', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    // 在 work 创建并 push 一个 commit(origin 前进)
    makeLocalCommit(work, 'second commit')
    execSync('git push origin main', { cwd: work, stdio: 'pipe' })
    // reset --hard HEAD~1 使本地落后 origin
    execSync('git reset --hard HEAD~1', { cwd: work, stdio: 'pipe' })
    const r = runScript([], { cwd: work })
    // HEAD 不同但无 ahead commit(behind)→ 跳过,exit 0
    assert.equal(r.status, 0, `behind 应 exit 0(跳过),实际 ${r.status}`)
    assert.match(r.stdout, /behind|无 ahead|跳过/)
  } finally {
    rmSync(work, { recursive: true, force: true })
    rmSync(origin, { recursive: true, force: true })
  }
})

// ─── 9. 无 origin remote → exit 0(跳过) ────────────────
test('无 origin: 仓库无 origin remote → exit 0(跳过)', () => {
  const dir = createTempRepo()
  try {
    // 有 git 仓库但无 origin remote
    const r = runScript([], { cwd: dir })
    assert.equal(r.status, 0, `无 origin 应 exit 0(跳过),实际 ${r.status}`)
    assert.match(r.stdout, /未配置 origin|跳过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 10. detached HEAD → exit 0(跳过) ─────────────────
test('detached HEAD: git checkout <hash> → exit 0(跳过)', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    // 切到 detached HEAD
    const headHash = execSync('git rev-parse HEAD', { cwd: work, encoding: 'utf8' }).trim()
    execSync(`git checkout ${headHash}`, { cwd: work, stdio: 'pipe' })
    const r = runScript([], { cwd: work })
    assert.equal(r.status, 0, `detached HEAD 应 exit 0(跳过),实际 ${r.status}`)
    assert.match(r.stdout, /detached HEAD|跳过/)
  } finally {
    rmSync(work, { recursive: true, force: true })
    rmSync(origin, { recursive: true, force: true })
  }
})

// ─── 11. 本地分支无 upstream(origin/<branch> ref 缺失) ──
test('无 upstream: 有 origin remote 但无 origin/main ref → exit 0(跳过)', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    // 删除本地 origin/main ref(remote-tracking ref)
    execSync('git remote remove origin', { cwd: work, stdio: 'pipe' })
    // 重新加 origin 但不 push/fetch → 无 origin/main ref
    const originUrl = origin.replace(/\\/g, '/')
    execSync(`git remote add origin "${originUrl}"`, { cwd: work, stdio: 'pipe' })
    const r = runScript([], { cwd: work })
    // 有 origin remote 但 git rev-parse origin/main 失败 → exit 0(跳过)
    assert.equal(r.status, 0, `无 origin/main ref 应 exit 0(跳过),实际 ${r.status}`)
    assert.match(r.stdout, /无.*origin\/main|未 fetch|跳过/)
  } finally {
    rmSync(work, { recursive: true, force: true })
    rmSync(origin, { recursive: true, force: true })
  }
})

// ─── 12. 非 git 环境 → exit 0(跳过) ─────────────────────
test('非 git: 非 git 仓库目录 → exit 0(跳过)', () => {
  // 创建一个临时目录,不 init git
  const dir = mkdtempSync(join(tmpdir(), 'ihui-nongit-'))
  try {
    const r = runScript([], { cwd: dir })
    assert.equal(r.status, 0, `非 git 仓库应 exit 0(跳过),实际 ${r.status}`)
    assert.match(r.stdout, /非 git|跳过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
