import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-no-divider.mjs')

// ─── 辅助:创建临时扫描目录(含 apps/ 结构,用于全量模式) ───
function createTempScanDir(files) {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-divider-'))
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = join(dir, relPath)
    mkdirSync(join(fullPath, '..'), { recursive: true })
    writeFileSync(fullPath, content)
  }
  return dir
}

// ─── 辅助:运行 check-no-divider.mjs(全量模式) ───
function runScript(cwd) {
  return spawnSync('node', [SCRIPT_PATH], {
    cwd: cwd || process.cwd(),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

// ─── 辅助:运行 check-no-divider.mjs --staged(staged 模式) ───
function runStaged(cwd) {
  return spawnSync('node', [SCRIPT_PATH, '--staged'], {
    cwd: cwd || process.cwd(),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

// ─── 辅助:创建临时 git repo(含 baseline commit),用于 staged 模式测试 ───
function createTempGitRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-divider-git-'))
  spawnSync('git', ['init', '-q'], { cwd: dir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
  spawnSync('git', ['config', 'user.email', 'test@ihui.local'], { cwd: dir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
  spawnSync('git', ['config', 'user.name', 'Test'], { cwd: dir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
  spawnSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: dir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
  return dir
}

// ─── 辅助:在 git repo 中写入文件并 stage ───
function stageFile(repoDir, relPath, content) {
  const fullPath = join(repoDir, relPath)
  mkdirSync(join(fullPath, '..'), { recursive: true })
  writeFileSync(fullPath, content)
  spawnSync('git', ['add', relPath], { cwd: repoDir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
}

// 辅助:断言 stdout 含违规标记
function assertHasViolation(r, pattern) {
  assert.ok(
    /发现\s+\d+\s+处违规/.test(r.stdout),
    `应报告违规,但未找到违规标记\nstdout: ${r.stdout}`,
  )
  if (pattern) {
    assert.match(r.stdout, pattern, `stdout 应含 ${pattern}`)
  }
}

// 辅助:断言 stdout 含通过标记(无违规)
function assertPass(r) {
  assert.ok(
    r.stdout.includes('✅'),
    `应通过,但未找到 ✅ 标记\nstdout: ${r.stdout}`,
  )
}

test('全量模式:divide-y className 应报违规(warn-only, exit 0)', () => {
  const dir = createTempScanDir({
    'apps/web/app/x/page.tsx': 'export function P() {\n  return <ul className="divide-y">\n    <li>a</li>\n  </ul>\n}\n',
  })
  try {
    const r = runScript(dir)
    assert.equal(r.status, 0, '全量模式应 exit 0(warn-only)')
    assertHasViolation(r, /divide-y/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('全量模式:divide-x className 应报违规', () => {
  const dir = createTempScanDir({
    'apps/web/app/x/page.tsx': 'export function P() {\n  return <div className="divide-x">a</div>\n}\n',
  })
  try {
    const r = runScript(dir)
    assertHasViolation(r, /divide-x/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('全量模式:注释行提及 divide-y 应豁免(不误报)', () => {
  const dir = createTempScanDir({
    'apps/web/src/x.ts': '// AGENTS.md §4 禁止 divide-y 分割线,用 space-y-* 替代\n/** 无 divide-x */\nexport const ok = 1\n',
  })
  try {
    const r = runScript(dir)
    assert.equal(r.status, 0)
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('全量模式:合规替代 space-y-1 应通过', () => {
  const dir = createTempScanDir({
    'apps/web/app/x/page.tsx': 'export function P() {\n  return <ul className="space-y-1">\n    <li>a</li>\n  </ul>\n}\n',
  })
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('staged 模式:新增 divide-y 行应 exit 1(阻塞提交)', () => {
  const dir = createTempGitRepo()
  try {
    stageFile(dir, 'apps/web/app/x/page.tsx', 'export function P() {\n  return <ul className="space-y-1">\n    <li>a</li>\n  </ul>\n}\n')
    stageFile(dir, 'apps/web/app/y/page.tsx', 'export function Q() {\n  return <ul className="divide-y">\n    <li>b</li>\n  </ul>\n}\n')
    const r = runStaged(dir)
    assert.equal(r.status, 1, 'staged 模式新增 divide-y 应 exit 1')
    // Windows 路径分隔符为反斜杠,兼容两种格式
    assert.ok(
      /page\.tsx/.test(r.stdout) && r.stdout.includes('[divide-y]'),
      `stdout 应含违规文件与 divide-y 标记\n${r.stdout}`,
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('staged 模式:仅注释提及 divide-y 应通过(exit 0)', () => {
  const dir = createTempGitRepo()
  try {
    stageFile(dir, 'apps/web/src/x.ts', '// 禁 divide-y,用 space-y-*\nexport const ok = 1\n')
    const r = runStaged(dir)
    assert.equal(r.status, 0, '仅注释提及 divide-y 不应阻塞')
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
