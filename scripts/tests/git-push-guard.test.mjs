import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'git-push-guard.mjs')

// ─── 辅助:创建临时 git 仓库(含初始 commit) ──────────────
function createTempRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-push-'))
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

// 辅助:运行 git-push-guard.mjs
function runScript(args = [], opts = {}) {
  return spawnSync('node', [SCRIPT_PATH, ...args], {
    cwd: opts.cwd || process.cwd(),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, ...opts.env },
  })
}

// 辅助:在工作仓库中创建并 push 一个新 commit(使本地 ahead)
function makeCommit(dir, relPath, content, message) {
  if (relPath) {
    const fullPath = join(dir, relPath)
    mkdirSync(join(fullPath, '..'), { recursive: true })
    writeFileSync(fullPath, content)
    execSync(`git add "${relPath.replace(/\\/g, '/')}"`, { cwd: dir, stdio: 'pipe' })
  } else {
    execSync('git add -A', { cwd: dir, stdio: 'pipe' })
  }
  execSync(`git commit -m "${message}"`, { cwd: dir, stdio: 'pipe' })
}

// 辅助:生成 N 行 JSON 内容(用于截断测试)
function generateJsonLines(n) {
  const lines = ['{']
  for (let i = 0; i < n - 2; i++) {
    lines.push(`  "k${i}": "v${i}",`)
  }
  lines.push(`  "k${n - 2}": "v${n - 2}"`)
  lines.push('}')
  return lines.join('\n')
}

// ─── CLI 行为测试 ────────────────────────────────────────

test('CLI: 无参数运行(默认 branch=main,无 origin) → exit 2', () => {
  const dir = createTempRepo()
  try {
    const r = runScript([], { cwd: dir })
    assert.equal(r.status, 2, `无 origin 应 exit 2,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /未配置 origin|origin remote/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('CLI: --branch=dev 参数解析(stdout 含 dev)', () => {
  const dir = createTempRepo()
  try {
    const r = runScript(['--branch=dev'], { cwd: dir })
    // 无 origin → exit 2,但 stdout 应提及目标分支 dev
    assert.equal(r.status, 2)
    assert.match(r.stdout, /dev/, 'stdout 应含 --branch 参数值 dev')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('CLI: --help 不崩溃(脚本未实现 --help,按默认运行)', () => {
  const dir = createTempRepo()
  try {
    const r = runScript(['--help'], { cwd: dir })
    // 无 origin → exit 2,但不应 crash
    assert.ok(r.status === 2 || r.status === 0 || r.status === 1, `--help 不应 crash,实际 exit ${r.status}`)
    assert.ok(!r.stderr.includes('Error:'), `--help 不应产生未捕获 Error`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('CLI: HUSKY_SKIP_PUSH=1 → stdout 显示 "仅检测" 模式', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    const r = runScript([], { cwd: work, env: { HUSKY_SKIP_PUSH: '1' } })
    // synced 状态 → exit 0,但 stdout 应显示 "仅检测" 模式
    assert.match(r.stdout, /仅检测/, '应显示仅检测模式')
  } finally {
    rmSync(work, { recursive: true, force: true })
    rmSync(origin, { recursive: true, force: true })
  }
})

// ─── 同步 / ahead / behind 状态测试 ──────────────────────

test('同步: 本地 HEAD == origin/main → exit 0', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    const r = runScript([], { cwd: work })
    assert.equal(r.status, 0, `同步状态应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /已同步|无需 push/)
  } finally {
    rmSync(work, { recursive: true, force: true })
    rmSync(origin, { recursive: true, force: true })
  }
})

test('ahead: 本地 ahead + HUSKY_SKIP_PUSH=1 → exit 1(仅检测不推送)', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    makeCommit(work, 'new-file.txt', 'content\n', 'add new file')
    const r = runScript([], { cwd: work, env: { HUSKY_SKIP_PUSH: '1' } })
    assert.equal(r.status, 1, `ahead + skipPush 应 exit 1,实际 ${r.status}`)
    assert.match(r.stdout, /ahead|未推送|仅检测/)
  } finally {
    rmSync(work, { recursive: true, force: true })
    rmSync(origin, { recursive: true, force: true })
  }
})

test('behind: 本地 behind origin → exit 1 + 提示 pull --rebase', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    // 在工作仓库再 push 一个 commit(origin 前进)
    makeCommit(work, 'second.txt', 'second\n', 'second commit')
    execSync('git push origin main', { cwd: work, stdio: 'pipe' })
    // reset --hard HEAD~1 使本地落后 origin
    execSync('git reset --hard HEAD~1', { cwd: work, stdio: 'pipe' })
    const r = runScript([], { cwd: work })
    assert.equal(r.status, 1, `behind 应 exit 1,实际 ${r.status}`)
    assert.match(r.stdout, /pull --rebase|落后/)
  } finally {
    rmSync(work, { recursive: true, force: true })
    rmSync(origin, { recursive: true, force: true })
  }
})

// ─── 无 origin / detached HEAD ───────────────────────────

test('无 origin: 仓库无 origin remote → exit 2', () => {
  const dir = createTempRepo()
  try {
    const r = runScript([], { cwd: dir })
    assert.equal(r.status, 2, `无 origin 应 exit 2,实际 ${r.status}`)
    assert.match(r.stdout, /未配置 origin|origin remote/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('detached HEAD: git checkout <hash> → exit 2', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    // 切到 detached HEAD
    const headHash = execSync('git rev-parse HEAD', { cwd: work, encoding: 'utf8' }).trim()
    execSync(`git checkout ${headHash}`, { cwd: work, stdio: 'pipe' })
    const r = runScript([], { cwd: work })
    assert.equal(r.status, 2, `detached HEAD 应 exit 2,实际 ${r.status}`)
    assert.match(r.stdout, /detached/)
  } finally {
    rmSync(work, { recursive: true, force: true })
    rmSync(origin, { recursive: true, force: true })
  }
})

// ─── AGENT_SCOPE 校验 ────────────────────────────────────

test('AGENT_SCOPE: commit 含越界文件 + AGENT_SCOPE=apps/api → exit 1', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    // 创建 apps/web/ 下的文件(不在 AGENT_SCOPE=apps/api 范围内)
    makeCommit(work, 'apps/web/page.tsx', 'export const X = 1\n', 'feat: add web page')
    const r = runScript([], {
      cwd: work,
      env: { AGENT_SCOPE: 'apps/api' },
    })
    assert.equal(r.status, 1, `AGENT_SCOPE 越界应 exit 1,实际 ${r.status}`)
    assert.match(r.stdout, /非本 agent 范围|AGENT_SCOPE|越界|范围文件/)
  } finally {
    rmSync(work, { recursive: true, force: true })
    rmSync(origin, { recursive: true, force: true })
  }
})

test('AGENT_SCOPE_OVERRIDE=1: 越界但强制推送 → push 成功 exit 0', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    makeCommit(work, 'apps/web/page.tsx', 'export const X = 1\n', 'feat: add web page')
    const r = runScript([], {
      cwd: work,
      env: { AGENT_SCOPE: 'apps/api', AGENT_SCOPE_OVERRIDE: '1' },
    })
    // 强制推送 → push 成功 → 验证 local == remote → exit 0
    assert.equal(r.status, 0, `AGENT_SCOPE_OVERRIDE=1 + push 成功应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /强制推送|FORCE|override/i)
  } finally {
    rmSync(work, { recursive: true, force: true })
    rmSync(origin, { recursive: true, force: true })
  }
})

// ─── JSON 截断预检 ───────────────────────────────────────

test('JSON 截断: HEAD json 行数 < HEAD~1 × 50% 且减少 > 100 → exit 1', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    // Commit 1:大 json(300 行),push 到 origin
    writeFileSync(join(work, 'data.json'), generateJsonLines(300))
    execSync('git add data.json', { cwd: work, stdio: 'pipe' })
    execSync('git commit -m "add large json"', { cwd: work, stdio: 'pipe' })
    execSync('git push origin main', { cwd: work, stdio: 'pipe' })
    // Commit 2:截断 json(50 行)→ ahead
    writeFileSync(join(work, 'data.json'), generateJsonLines(50))
    execSync('git add data.json', { cwd: work, stdio: 'pipe' })
    execSync('git commit -m "truncate json"', { cwd: work, stdio: 'pipe' })
    const r = runScript([], { cwd: work })
    assert.equal(r.status, 1, `JSON 截断应 exit 1,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /截断|完整性预检失败|truncat/i)
  } finally {
    rmSync(work, { recursive: true, force: true })
    rmSync(origin, { recursive: true, force: true })
  }
})

test('AUTO_PUSH_CONFIRM=1: 跳过 JSON 截断预检 → push 成功 exit 0', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    // Commit 1:大 json
    writeFileSync(join(work, 'data.json'), generateJsonLines(300))
    execSync('git add data.json', { cwd: work, stdio: 'pipe' })
    execSync('git commit -m "add large json"', { cwd: work, stdio: 'pipe' })
    execSync('git push origin main', { cwd: work, stdio: 'pipe' })
    // Commit 2:截断
    writeFileSync(join(work, 'data.json'), generateJsonLines(50))
    execSync('git add data.json', { cwd: work, stdio: 'pipe' })
    execSync('git commit -m "truncate json"', { cwd: work, stdio: 'pipe' })
    const r = runScript([], {
      cwd: work,
      env: { AUTO_PUSH_CONFIRM: '1' },
    })
    assert.equal(r.status, 0, `AUTO_PUSH_CONFIRM=1 + push 成功应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /AUTO_PUSH_CONFIRM|跳过完整性预检|强制推送/i)
  } finally {
    rmSync(work, { recursive: true, force: true })
    rmSync(origin, { recursive: true, force: true })
  }
})

// ─── push 成功后验证 local == remote ─────────────────────

test('push 成功: ahead + 自动 push → exit 0 + local == remote', () => {
  const { work, origin } = createSyncedRepoWithOrigin()
  try {
    makeCommit(work, 'new-feature.txt', 'feature\n', 'feat: new feature')
    const r = runScript([], { cwd: work })
    assert.equal(r.status, 0, `ahead + push 应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /push 成功|验证通过|local HEAD.*origin/)
    // 验证 local HEAD == origin/main
    const localHead = execSync('git rev-parse HEAD', { cwd: work, encoding: 'utf8' }).trim()
    const remoteHead = execSync('git rev-parse origin/main', { cwd: work, encoding: 'utf8' }).trim()
    assert.equal(localHead, remoteHead, 'push 后 local HEAD 应 == origin/main')
  } finally {
    rmSync(work, { recursive: true, force: true })
    rmSync(origin, { recursive: true, force: true })
  }
})
