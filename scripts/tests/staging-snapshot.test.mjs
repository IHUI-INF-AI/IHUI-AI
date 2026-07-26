import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// 动态导入 .js 模块(CommonJS → ESM 互操作)
const { takeStagingSnapshot, restoreStaging } = await import('../lib/staging-snapshot.js')

// ─── 测试辅助:创建临时 git 仓库 ─────────────────────────────
function createTempGitRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-staging-snap-'))
  execSync('git init -b main', { cwd: dir, stdio: 'pipe' })
  execSync('git config user.email test@test.com', { cwd: dir, stdio: 'pipe' })
  execSync('git config user.name test', { cwd: dir, stdio: 'pipe' })
  execSync('git config commit.gpgsign false', { cwd: dir, stdio: 'pipe' })
  // 创建初始 commit(建立 HEAD)
  writeFileSync(join(dir, 'README.md'), '# init\n')
  execSync('git add README.md', { cwd: dir, stdio: 'pipe' })
  execSync('git commit -m "init"', { cwd: dir, stdio: 'pipe' })
  return dir
}

function stageFile(dir, path, content = 'test') {
  const fullPath = join(dir, path)
  const parentDir = join(fullPath, '..')
  mkdirSync(parentDir, { recursive: true })
  writeFileSync(fullPath, content)
  execSync(`git add "${path}"`, { cwd: dir, stdio: 'pipe' })
}

function getStagedFiles(dir) {
  try {
    return execSync('git diff --cached --name-only --diff-filter=ACMR', {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
      .split('\n')
      .filter(Boolean)
      .map((f) => f.replace(/\\/g, '/'))
  } catch {
    return []
  }
}

// ─── takeStagingSnapshot 测试 ──────────────────────────────

test('takeStagingSnapshot: 空 staging area → 空集', () => {
  const dir = createTempGitRepo()
  try {
    const snapshot = takeStagingSnapshot({ cwd: dir })
    assert.ok(snapshot instanceof Set)
    assert.equal(snapshot.size, 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('takeStagingSnapshot: 含 staged 文件 → 正确返回路径集合', () => {
  const dir = createTempGitRepo()
  try {
    stageFile(dir, 'file1.ts', 'a')
    stageFile(dir, 'apps/web/page.tsx', 'b')
    const snapshot = takeStagingSnapshot({ cwd: dir })
    assert.equal(snapshot.size, 2)
    assert.ok(snapshot.has('file1.ts'))
    assert.ok(snapshot.has('apps/web/page.tsx'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('takeStagingSnapshot: Windows 反斜杠路径 → 归一化为 POSIX', () => {
  const dir = createTempGitRepo()
  try {
    stageFile(dir, 'apps/web/page.tsx', 'x')
    const snapshot = takeStagingSnapshot({ cwd: dir })
    for (const f of snapshot) {
      assert.ok(!f.includes('\\'), `路径应归一化为 POSIX: ${f}`)
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('takeStagingSnapshot: 非 git 环境 → 返回 null', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-non-git-'))
  try {
    const snapshot = takeStagingSnapshot({ cwd: dir })
    assert.equal(snapshot, null)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('takeStagingSnapshot: 不含 Deleted 文件(只 ACMR)', () => {
  const dir = createTempGitRepo()
  try {
    stageFile(dir, 'to-delete.ts', 'x')
    execSync('git commit -m "add"', { cwd: dir, stdio: 'pipe' })
    rmSync(join(dir, 'to-delete.ts'))
    execSync('git add to-delete.ts', { cwd: dir, stdio: 'pipe' })
    const snapshot = takeStagingSnapshot({ cwd: dir })
    assert.equal(snapshot.size, 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── restoreStaging 测试 ───────────────────────────────────

test('restoreStaging: 快照==当前 staged → 无操作', () => {
  const dir = createTempGitRepo()
  try {
    stageFile(dir, 'file1.ts', 'a')
    stageFile(dir, 'file2.ts', 'b')
    const snapshot = takeStagingSnapshot({ cwd: dir })
    const result = restoreStaging(snapshot, { cwd: dir, silent: true })
    assert.equal(result.skipped, false)
    assert.equal(result.restored.length, 0)
    const staged = getStagedFiles(dir)
    assert.equal(staged.length, 2)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('restoreStaging: hook 期间新增 staged 文件 → unstage 新增', () => {
  const dir = createTempGitRepo()
  try {
    stageFile(dir, 'file1.ts', 'a')
    const snapshot = takeStagingSnapshot({ cwd: dir })
    stageFile(dir, 'file2.ts', 'b')
    assert.equal(getStagedFiles(dir).length, 2)
    const result = restoreStaging(snapshot, { cwd: dir, silent: true })
    assert.equal(result.restored.length, 1)
    assert.ok(result.restored.includes('file2.ts'))
    const staged = getStagedFiles(dir)
    assert.equal(staged.length, 1)
    assert.ok(staged.includes('file1.ts'))
    assert.ok(!staged.includes('file2.ts'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('restoreStaging: hook 期间新增多个文件 → 全部 unstage', () => {
  const dir = createTempGitRepo()
  try {
    stageFile(dir, 'task-file.ts', 'a')
    const snapshot = takeStagingSnapshot({ cwd: dir })
    stageFile(dir, 'pollution1.ts', 'b')
    stageFile(dir, 'pollution2.ts', 'c')
    stageFile(dir, 'pollution3.ts', 'd')
    const result = restoreStaging(snapshot, { cwd: dir, silent: true })
    assert.equal(result.restored.length, 3)
    const staged = getStagedFiles(dir)
    assert.equal(staged.length, 1)
    assert.ok(staged.includes('task-file.ts'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('restoreStaging: null 快照 → 跳过(skipped=true)', () => {
  const dir = createTempGitRepo()
  try {
    const result = restoreStaging(null, { cwd: dir, silent: true })
    assert.equal(result.skipped, true)
    assert.equal(result.restored.length, 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('restoreStaging: options.skip=true → 跳过', () => {
  const dir = createTempGitRepo()
  try {
    stageFile(dir, 'file1.ts', 'a')
    const snapshot = takeStagingSnapshot({ cwd: dir })
    stageFile(dir, 'file2.ts', 'b')
    const result = restoreStaging(snapshot, { cwd: dir, skip: true, silent: true })
    assert.equal(result.skipped, true)
    assert.equal(result.restored.length, 0)
    assert.equal(getStagedFiles(dir).length, 2)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('restoreStaging: 空快照 + 新增文件 → unstage 全部新增', () => {
  const dir = createTempGitRepo()
  try {
    const snapshot = takeStagingSnapshot({ cwd: dir })
    assert.equal(snapshot.size, 0)
    stageFile(dir, 'pollution.ts', 'x')
    const result = restoreStaging(snapshot, { cwd: dir, silent: true })
    assert.equal(result.restored.length, 1)
    assert.equal(getStagedFiles(dir).length, 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('restoreStaging: working tree 保留(unstage 非破坏性)', () => {
  const dir = createTempGitRepo()
  try {
    stageFile(dir, 'file1.ts', 'a')
    const snapshot = takeStagingSnapshot({ cwd: dir })
    stageFile(dir, 'file2.ts', 'b')
    restoreStaging(snapshot, { cwd: dir, silent: true })
    assert.ok(existsSync(join(dir, 'file2.ts')))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('restoreStaging: lint-staged 修改已 staged 文件内容 → 不 unstage(路径仍在快照)', () => {
  const dir = createTempGitRepo()
  try {
    stageFile(dir, 'file1.ts', 'original')
    const snapshot = takeStagingSnapshot({ cwd: dir })
    writeFileSync(join(dir, 'file1.ts'), 'fixed content')
    execSync('git add file1.ts', { cwd: dir, stdio: 'pipe' })
    const result = restoreStaging(snapshot, { cwd: dir, silent: true })
    assert.equal(result.restored.length, 0)
    const staged = getStagedFiles(dir)
    assert.equal(staged.length, 1)
    assert.ok(staged.includes('file1.ts'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('restoreStaging: 模拟真实事故场景(c3c864131 类似)', () => {
  const dir = createTempGitRepo()
  try {
    mkdirSync(join(dir, 'apps/web'), { recursive: true })
    mkdirSync(join(dir, 'packages/i18n/messages/web'), { recursive: true })
    writeFileSync(join(dir, 'apps/web/seo.tsx'), 'seo code')
    execSync('git add apps/web/seo.tsx', { cwd: dir, stdio: 'pipe' })
    const snapshot = takeStagingSnapshot({ cwd: dir })
    writeFileSync(join(dir, 'packages/i18n/messages/web/zh-CN.json'), '{}')
    execSync('git add packages/i18n/messages/web/zh-CN.json', { cwd: dir, stdio: 'pipe' })
    const result = restoreStaging(snapshot, { cwd: dir, silent: true })
    assert.equal(result.restored.length, 1)
    assert.ok(result.restored[0].includes('zh-CN.json'))
    const staged = getStagedFiles(dir)
    assert.equal(staged.length, 1)
    assert.ok(staged[0].includes('seo.tsx'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 端到端验证:不影响正常 commit 流程 ─────────────────────

test('E2E: 正常 commit 流程(单文件)不受影响', () => {
  const dir = createTempGitRepo()
  try {
    writeFileSync(join(dir, 'task.ts'), 'task content')
    execSync('git add task.ts', { cwd: dir, stdio: 'pipe' })
    const snapshot = takeStagingSnapshot({ cwd: dir })
    restoreStaging(snapshot, { cwd: dir, silent: true })
    execSync('git commit -m "feat: task"', { cwd: dir, stdio: 'pipe' })
    const lastCommitFiles = execSync('git show --name-only --pretty=format:', {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
      .split('\n')
      .filter(Boolean)
    assert.equal(lastCommitFiles.length, 1)
    assert.ok(lastCommitFiles[0].includes('task.ts'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('E2E: 多文件正常 commit 不受影响', () => {
  const dir = createTempGitRepo()
  try {
    mkdirSync(join(dir, 'apps/web'), { recursive: true })
    writeFileSync(join(dir, 'apps/web/page.tsx'), 'page')
    writeFileSync(join(dir, 'apps/web/style.css'), 'style')
    writeFileSync(join(dir, 'README.md'), '# updated\n')
    execSync('git add apps/web/page.tsx apps/web/style.css README.md', {
      cwd: dir,
      stdio: 'pipe',
    })
    const snapshot = takeStagingSnapshot({ cwd: dir })
    restoreStaging(snapshot, { cwd: dir, silent: true })
    execSync('git commit -m "feat: multi-file"', { cwd: dir, stdio: 'pipe' })
    const lastCommitFiles = execSync('git show --name-only --pretty=format:', {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
      .split('\n')
      .filter(Boolean)
    assert.equal(lastCommitFiles.length, 3)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('E2E: 还原后 commit 不含被 unstage 的文件', () => {
  const dir = createTempGitRepo()
  try {
    writeFileSync(join(dir, 'task.ts'), 'task')
    execSync('git add task.ts', { cwd: dir, stdio: 'pipe' })
    const snapshot = takeStagingSnapshot({ cwd: dir })
    writeFileSync(join(dir, 'pollution.ts'), 'pollution')
    execSync('git add pollution.ts', { cwd: dir, stdio: 'pipe' })
    restoreStaging(snapshot, { cwd: dir, silent: true })
    execSync('git commit -m "feat: task only"', { cwd: dir, stdio: 'pipe' })
    const lastCommitFiles = execSync('git show --name-only --pretty=format:', {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
      .split('\n')
      .filter(Boolean)
    assert.equal(lastCommitFiles.length, 1)
    assert.ok(lastCommitFiles[0].includes('task.ts'))
    assert.ok(!lastCommitFiles.some((f) => f.includes('pollution.ts')))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
