import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'sync-lost-commit-tags.mjs')

// ─── 辅助:创建临时 git 仓库(含初始 commit) ──────────────
function createTempRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-tag-sync-'))
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
  const dir = mkdtempSync(join(tmpdir(), 'ihui-tag-origin-'))
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

// 辅助:运行 sync-lost-commit-tags.mjs
function runScript(args = [], opts = {}) {
  return spawnSync('node', [SCRIPT_PATH, ...args], {
    cwd: opts.cwd || process.cwd(),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, ...opts.env },
  })
}

// 辅助:查询远端是否有指定 tag(通过 ls-remote)
function remoteHasTag(workDir, tagName) {
  const out = execSync(`git ls-remote origin "refs/tags/${tagName}"`, {
    cwd: workDir,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim()
  return out.length > 0
}

// 辅助:查询本地是否有指定 tag
function localHasTag(workDir, pattern) {
  const out = execSync(`git tag -l "${pattern}"`, {
    cwd: workDir,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim()
  return out.length > 0
}

// ─── CLI 行为测试 ────────────────────────────────────────

test('CLI: --help → exit 0 + 打印帮助文本', () => {
  const dir = createTempRepo()
  try {
    const r = runScript(['--help'], { cwd: dir })
    assert.equal(r.status, 0, `--help 应 exit 0,实际 ${r.status}`)
    assert.match(r.stdout, /sync-lost-commit-tags/, 'stdout 应含脚本名')
    assert.match(r.stdout, /--check/, 'stdout 应含 --check 说明')
    assert.match(r.stdout, /--fetch/, 'stdout 应含 --fetch 说明')
    assert.match(r.stdout, /--auto-push/, 'stdout 应含 --auto-push 说明')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('CLI: 无参数(默认 check)在干净无 tag 仓库 → exit 0', () => {
  const dir = createTempRepo()
  try {
    const r = runScript([], { cwd: dir })
    assert.equal(r.status, 0, `干净仓库应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('CLI: --check 在干净仓库 → exit 0', () => {
  const dir = createTempRepo()
  try {
    const r = runScript(['--check'], { cwd: dir })
    assert.equal(r.status, 0, `--check 干净仓库应 exit 0,实际 ${r.status}`)
    assert.match(r.stdout, /一致性校验|tag/, 'stdout 应含校验相关文本')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('CLI: --check --json 在干净仓库 → exit 0 + JSON status=ok', () => {
  const dir = createTempRepo()
  try {
    const r = runScript(['--check', '--json'], { cwd: dir })
    assert.equal(r.status, 0, `--check --json 应 exit 0,实际 ${r.status}`)
    const result = JSON.parse(r.stdout.trim())
    assert.equal(result.status, 'ok')
    assert.ok(Array.isArray(result.local.lostCommit), 'local.lostCommit 应为数组')
    assert.ok(Array.isArray(result.local.backup), 'local.backup 应为数组')
    assert.equal(result.summary.total, 0, '干净仓库 summary.total 应为 0')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('CLI: --check --json 有仅本地 lost-commit tag → exit 1 + JSON status=fail', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    execSync('git tag lost-commit/test-local HEAD', { cwd: work, stdio: 'pipe' })
    const r = runScript(['--check', '--json'], { cwd: work })
    assert.equal(r.status, 1, `仅本地 tag 应 exit 1,实际 ${r.status}`)
    const result = JSON.parse(r.stdout.trim())
    assert.equal(result.status, 'fail')
    assert.ok(result.local.lostCommit.includes('lost-commit/test-local'), 'JSON 应含本地 tag')
    assert.ok(result.diff.lostCommit.onlyLocal.includes('lost-commit/test-local'), 'diff.onlyLocal 应含 tag')
  } finally {
    rmSync(work, { recursive: true, force: true })
    rmSync(origin, { recursive: true, force: true })
  }
})

// ─── --auto-push 模式测试 ────────────────────────────────

test('CLI: --auto-push 无 tag → 跳过 push exit 0', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    const r = runScript(['--auto-push'], { cwd: work })
    assert.equal(r.status, 0, `无 tag --auto-push 应 exit 0,实际 ${r.status}`)
    assert.match(r.stdout, /跳过 push|无.*tag/, '应显示跳过信息')
  } finally {
    rmSync(work, { recursive: true, force: true })
    rmSync(origin, { recursive: true, force: true })
  }
})

test('CLI: --auto-push --dry-run 有 tag → dry-run,远端无 tag', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    // 创建两种 tag 避免 glob refspec 空匹配失败
    execSync('git tag lost-commit/dry-run-test HEAD', { cwd: work, stdio: 'pipe' })
    execSync('git tag backup/dry-run-snap HEAD', { cwd: work, stdio: 'pipe' })
    const r = runScript(['--auto-push', '--dry-run'], { cwd: work })
    assert.equal(r.status, 0, `dry-run 应 exit 0,实际 ${r.status}`)
    assert.match(r.stdout, /dry-run/, '应显示 dry-run')
    // 远端不应有 tag(dry-run 不实际 push)
    assert.ok(!remoteHasTag(work, 'lost-commit/dry-run-test'), '远端不应有 dry-run lost-commit tag')
    assert.ok(!remoteHasTag(work, 'backup/dry-run-snap'), '远端不应有 dry-run backup tag')
  } finally {
    rmSync(work, { recursive: true, force: true })
    rmSync(origin, { recursive: true, force: true })
  }
})

test('CLI: HUSKY_SKIP_TAG_SYNC=1 + --auto-push → 跳过 exit 0', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    execSync('git tag lost-commit/skip-test HEAD', { cwd: work, stdio: 'pipe' })
    execSync('git tag backup/skip-snap HEAD', { cwd: work, stdio: 'pipe' })
    const r = runScript(['--auto-push'], { cwd: work, env: { HUSKY_SKIP_TAG_SYNC: '1' } })
    assert.equal(r.status, 0, `SKIP + auto-push 应 exit 0,实际 ${r.status}`)
    assert.match(r.stdout, /已跳过|HUSKY_SKIP_TAG_SYNC/, '应显示跳过信息')
    // 远端不应有 tag(被跳过)
    assert.ok(!remoteHasTag(work, 'lost-commit/skip-test'), 'SKIP 后远端不应有 lost-commit tag')
    assert.ok(!remoteHasTag(work, 'backup/skip-snap'), 'SKIP 后远端不应有 backup tag')
  } finally {
    rmSync(work, { recursive: true, force: true })
    rmSync(origin, { recursive: true, force: true })
  }
})

test('CLI: HUSKY_SKIP_TAG_SYNC=1 + --fetch → 不跳过(执行 fetch + 拉回 tag)', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    // 在 origin 上创建 tag(通过 work 创建 + push,然后本地删除)
    execSync('git tag lost-commit/skip-fetch HEAD', { cwd: work, stdio: 'pipe' })
    execSync('git push origin lost-commit/skip-fetch', { cwd: work, stdio: 'pipe' })
    execSync('git tag -d lost-commit/skip-fetch', { cwd: work, stdio: 'pipe' })
    assert.ok(!localHasTag(work, 'lost-commit/skip-fetch'), '前置:本地无 tag')
    // SKIP=1 + --fetch → 应执行 fetch(不跳过)
    const r = runScript(['--fetch'], { cwd: work, env: { HUSKY_SKIP_TAG_SYNC: '1' } })
    assert.ok(r.status === 0 || r.status === 1, `SKIP + fetch 不应 crash,实际 exit ${r.status}`)
    assert.match(r.stdout, /不受 SKIP 影响|手动恢复必须执行/, '应打印不受 SKIP 影响的警告')
    // 验证 tag 已拉回本地
    assert.ok(localHasTag(work, 'lost-commit/skip-fetch'), 'fetch 后本地应有 tag')
  } finally {
    rmSync(work, { recursive: true, force: true })
    rmSync(origin, { recursive: true, force: true })
  }
})

// ─── check 模式一致性检测 ────────────────────────────────

test('检测: 本地 lost-commit/* tag + 已 push 到 origin → check exit 0', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    execSync('git tag lost-commit/synced HEAD', { cwd: work, stdio: 'pipe' })
    execSync('git push origin lost-commit/synced', { cwd: work, stdio: 'pipe' })
    const r = runScript(['--check'], { cwd: work })
    assert.equal(r.status, 0, `本地+远端一致应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /lost-commit\/synced/, 'stdout 应列出该 tag')
  } finally {
    rmSync(work, { recursive: true, force: true })
    rmSync(origin, { recursive: true, force: true })
  }
})

test('检测: 本地 lost-commit/* tag 未 push → check exit 1(仅本地)', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    execSync('git tag lost-commit/only-local HEAD', { cwd: work, stdio: 'pipe' })
    const r = runScript(['--check'], { cwd: work })
    assert.equal(r.status, 1, `仅本地 tag 应 exit 1,实际 ${r.status}`)
    assert.match(r.stdout, /仅本地|未 push/, '应报告仅本地/未 push')
    assert.match(r.stdout, /lost-commit\/only-local/, 'stdout 应列出该 tag')
  } finally {
    rmSync(work, { recursive: true, force: true })
    rmSync(origin, { recursive: true, force: true })
  }
})

test('检测: origin 有 lost-commit/* tag 本地缺失 → check exit 1(仅远端)', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    execSync('git tag lost-commit/only-remote HEAD', { cwd: work, stdio: 'pipe' })
    execSync('git push origin lost-commit/only-remote', { cwd: work, stdio: 'pipe' })
    execSync('git tag -d lost-commit/only-remote', { cwd: work, stdio: 'pipe' })
    const r = runScript(['--check'], { cwd: work })
    assert.equal(r.status, 1, `仅远端 tag 应 exit 1,实际 ${r.status}`)
    assert.match(r.stdout, /仅远端|本地缺失/, '应报告仅远端/本地缺失')
    assert.match(r.stdout, /lost-commit\/only-remote/, 'stdout 应列出该 tag')
  } finally {
    rmSync(work, { recursive: true, force: true })
    rmSync(origin, { recursive: true, force: true })
  }
})

test('检测: 本地有 backup/* tag + 已 push → check exit 0', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    execSync('git tag backup/snapshot-1 HEAD', { cwd: work, stdio: 'pipe' })
    execSync('git push origin backup/snapshot-1', { cwd: work, stdio: 'pipe' })
    const r = runScript(['--check'], { cwd: work })
    assert.equal(r.status, 0, `backup tag 已 push 应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /backup\/snapshot-1/, 'stdout 应列出该 tag')
  } finally {
    rmSync(work, { recursive: true, force: true })
    rmSync(origin, { recursive: true, force: true })
  }
})

// ─── --auto-push 实际推送测试 ────────────────────────────

test('auto-push: 本地有 tag → push 到 origin + 验证远端有 tag', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    // 创建两种 tag(避免 glob refspec 空匹配导致 push 失败)
    execSync('git tag lost-commit/push-test HEAD', { cwd: work, stdio: 'pipe' })
    execSync('git tag backup/push-snap HEAD', { cwd: work, stdio: 'pipe' })
    assert.ok(!remoteHasTag(work, 'lost-commit/push-test'), '前置:远端无 lost-commit tag')
    assert.ok(!remoteHasTag(work, 'backup/push-snap'), '前置:远端无 backup tag')
    const r = runScript(['--auto-push'], { cwd: work })
    assert.equal(r.status, 0, `auto-push 应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.ok(remoteHasTag(work, 'lost-commit/push-test'), 'auto-push 后远端应有 lost-commit tag')
    assert.ok(remoteHasTag(work, 'backup/push-snap'), 'auto-push 后远端应有 backup tag')
  } finally {
    rmSync(work, { recursive: true, force: true })
    rmSync(origin, { recursive: true, force: true })
  }
})

// ─── --fetch 拉回测试 ────────────────────────────────────

test('fetch: origin 有 tag 本地缺失 → fetch 后本地有 tag + exit 0', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    execSync('git tag lost-commit/fetch-test HEAD', { cwd: work, stdio: 'pipe' })
    execSync('git push origin lost-commit/fetch-test', { cwd: work, stdio: 'pipe' })
    execSync('git tag -d lost-commit/fetch-test', { cwd: work, stdio: 'pipe' })
    assert.ok(!localHasTag(work, 'lost-commit/fetch-test'), '前置:本地无 tag')
    const r = runScript(['--fetch'], { cwd: work })
    assert.equal(r.status, 0, `fetch 后应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.ok(localHasTag(work, 'lost-commit/fetch-test'), 'fetch 后本地应有 tag')
  } finally {
    rmSync(work, { recursive: true, force: true })
    rmSync(origin, { recursive: true, force: true })
  }
})
