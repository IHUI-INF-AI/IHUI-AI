import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-test-paths.mjs')

// ─── 辅助:创建临时 git repo(check-test-paths.mjs 调用 git check-ignore,需 git 环境) ─
function createTempGitRepo(gitignoreContent = '') {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-test-paths-'))
  const opt = { cwd: dir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
  spawnSync('git', ['init', '-q'], opt)
  spawnSync('git', ['config', 'user.email', 'test@ihui.local'], opt)
  spawnSync('git', ['config', 'user.name', 'Test'], opt)
  spawnSync('git', ['config', 'commit.gpgsign', 'false'], opt)
  if (gitignoreContent) {
    writeFileSync(join(dir, '.gitignore'), gitignoreContent)
  }
  return dir
}

// 运行脚本并去除 ANSI 颜色码,便于正则断言
function runScript(cwd, args = []) {
  const r = spawnSync('node', [SCRIPT_PATH, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  r.out = r.stdout.replace(/\x1b\[[0-9;]*m/g, '')
  return r
}

function writeDir(dir, relPath) {
  mkdirSync(join(dir, relPath), { recursive: true })
}

function writeFile(dir, relPath, content = '') {
  mkdirSync(join(dir, relPath, '..'), { recursive: true })
  writeFileSync(join(dir, relPath), content)
}

// ─── 1. CLI 行为 ─────────────────────────────────────────

test('CLI: --help 不崩溃(脚本未实现 --help,按默认模式运行)', () => {
  const dir = createTempGitRepo()
  try {
    const r = runScript(dir, ['--help'])
    assert.ok(
      r.status === 0 || r.status === 1,
      `--help 不应 crash,实际 exit ${r.status}\nstderr: ${r.stderr}`,
    )
    assert.ok(!r.stderr.includes('Error:'), `--help 不应产生 Error 输出`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('CLI: 无参数运行(空目录)→ exit 0 + 未发现 __tests__/', () => {
  const dir = createTempGitRepo()
  try {
    const r = runScript(dir)
    assert.equal(r.status, 0, `空目录应 exit 0\nstdout: ${r.out}\nstderr: ${r.stderr}`)
    assert.match(r.out, /未发现 __tests__\/ 目录/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 2. __tests__/ 目录检测(主项,AGENTS.md §23) ────────

test('__tests__/ 有 .gitkeep 且被 __* 规则命中 → 通过(exit 0)', () => {
  const dir = createTempGitRepo('__*\n')
  try {
    writeDir(dir, 'apps/web/__tests__')
    writeFile(dir, 'apps/web/__tests__/.gitkeep')
    const r = runScript(dir)
    assert.equal(r.status, 0, `有 .gitkeep 应通过\nstdout: ${r.out}`)
    assert.match(r.out, /__tests__/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('__tests__/ 无 .gitkeep 且被 __* 规则吞掉 → exit 1 (block,AGENTS.md §23 事故场景)', () => {
  const dir = createTempGitRepo('__*\n')
  try {
    writeDir(dir, 'apps/web/__tests__')
    // 无 .gitkeep → 命中 __* 规则 + 无标记 → block
    const r = runScript(dir)
    assert.equal(r.status, 1, `无 .gitkeep + 被 ignore 应 exit 1\nstdout: ${r.out}`)
    assert.match(r.out, /BLOCK/)
    assert.match(r.out, /__tests__/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('__tests__/ 无 .gitkeep 但未被 gitignore → 通过(exit 0,未命中 ignore 规则)', () => {
  // .gitignore 不含 __* 规则 → __tests__/ 不会被吞掉 → 通过
  const dir = createTempGitRepo('node_modules/\n')
  try {
    writeDir(dir, 'apps/web/__tests__')
    const r = runScript(dir)
    assert.equal(r.status, 0, `未被 ignore 应通过\nstdout: ${r.out}`)
    assert.match(r.out, /未命中 ignore 规则/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 3. 合法测试目录命名 → 通过 ──────────────────────────

test('tests/ 目录(推荐命名)→ 通过(exit 0,不触发 __tests__ 检测)', () => {
  const dir = createTempGitRepo('__*\n')
  try {
    writeDir(dir, 'apps/web/tests')
    const r = runScript(dir)
    assert.equal(r.status, 0, `tests/ 应通过\nstdout: ${r.out}`)
    assert.match(r.out, /未发现 __tests__\/ 目录/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('spec/ 目录 → 通过(exit 0)', () => {
  const dir = createTempGitRepo('')
  try {
    writeDir(dir, 'apps/api/spec')
    const r = runScript(dir)
    assert.equal(r.status, 0, `spec/ 应通过\nstdout: ${r.out}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 4. 临时/备份目录检测(*.tmp / *.bak) ────────────────

test('*.tmp 目录 → 默认 warn exit 0, --strict exit 1', () => {
  const dir = createTempGitRepo('')
  try {
    writeDir(dir, 'apps/web/cache.tmp')
    const rDefault = runScript(dir)
    assert.equal(rDefault.status, 0, `默认 warn-only 应 exit 0\nstdout: ${rDefault.out}`)
    assert.match(rDefault.out, /WARN/)
    const rStrict = runScript(dir, ['--strict'])
    assert.equal(rStrict.status, 1, `--strict 模式应 exit 1\nstdout: ${rStrict.out}`)
    assert.match(rStrict.out, /--strict/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('*.bak 目录 → 默认 warn exit 0, --strict exit 1', () => {
  const dir = createTempGitRepo('')
  try {
    writeDir(dir, 'packages/backup.bak')
    const rDefault = runScript(dir)
    assert.equal(rDefault.status, 0)
    assert.match(rDefault.out, /WARN/)
    const rStrict = runScript(dir, ['--strict'])
    assert.equal(rStrict.status, 1)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 5. 隐藏目录白名单检测 ───────────────────────────────

test('非白名单隐藏目录(.unknown/) → 默认 warn exit 0, --strict exit 1', () => {
  // .cache 在 EXCLUDE_DIRS 中会被跳过,用 .unknown 触发 findUnknownDotDirs
  const dir = createTempGitRepo('')
  try {
    writeDir(dir, 'apps/web/.unknown')
    const rDefault = runScript(dir)
    assert.equal(rDefault.status, 0, `默认 warn 应 exit 0\nstdout: ${rDefault.out}`)
    assert.match(rDefault.out, /WARN/)
    const rStrict = runScript(dir, ['--strict'])
    assert.equal(rStrict.status, 1)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 6. git check-ignore 调用正确性 ──────────────────────

test('git check-ignore 调用:被 ignore 的 __tests__/ 会被检测到并报告 git rule', () => {
  // 端到端验证:__tests__/ 被 __* 规则命中 → stdout 应含 git rule 来源信息
  const dir = createTempGitRepo('__*\n')
  try {
    writeDir(dir, 'apps/web/__tests__')
    const r = runScript(dir)
    assert.equal(r.status, 1)
    // 源脚本输出 "git rule: <规则来源>"
    assert.match(r.out, /git rule|__\*/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 7. 批量扫描 ─────────────────────────────────────────

test('批量扫描: 多个 __tests__/ (block) + 多个 *.tmp (warn) → exit 1 + 计数正确', () => {
  const dir = createTempGitRepo('__*\n')
  try {
    // 2 个 __tests__/ 无 .gitkeep(被 ignore)→ 2 个 block
    writeDir(dir, 'apps/web/__tests__')
    writeDir(dir, 'apps/api/__tests__')
    // 1 个 __tests__/ 有 .gitkeep → 通过
    writeDir(dir, 'packages/__tests__')
    writeFile(dir, 'packages/__tests__/.gitkeep')
    // 2 个 *.tmp 目录 → 2 个 warn
    writeDir(dir, 'apps/web/cache.tmp')
    writeDir(dir, 'scripts/build.tmp')
    const r = runScript(dir)
    assert.equal(r.status, 1, `有 block 应 exit 1\nstdout: ${r.out}`)
    assert.match(r.out, /阻断项: 2/)
    assert.match(r.out, /警告项: 2/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
