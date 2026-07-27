import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-staged-pollution.mjs')

// ─── 辅助:创建临时 git 仓库(含初始 commit) ──────────────
function createTempRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-staged-'))
  execSync('git init -b main', { cwd: dir, stdio: 'pipe' })
  execSync('git config user.email test@test.com', { cwd: dir, stdio: 'pipe' })
  execSync('git config user.name test', { cwd: dir, stdio: 'pipe' })
  execSync('git config commit.gpgsign false', { cwd: dir, stdio: 'pipe' })
  writeFileSync(join(dir, 'README.md'), '# init\n')
  execSync('git add README.md', { cwd: dir, stdio: 'pipe' })
  execSync('git commit -m "init"', { cwd: dir, stdio: 'pipe' })
  return dir
}

// ─── 辅助:在工作仓库创建文件并 stage(不 commit) ─────────
// files: ['apps/web/a.ts', 'apps/api/b.ts', ...] (正斜杠路径)
function stageFiles(dir, files) {
  for (const f of files) {
    const fullPath = join(dir, f)
    mkdirSync(dirname(fullPath), { recursive: true })
    writeFileSync(fullPath, `content for ${f}\n`)
    // git add 用正斜杠路径(Windows 上 git 也接受)
    execSync(`git add "${f}"`, { cwd: dir, stdio: 'pipe' })
  }
}

// ─── 辅助:运行 check-staged-pollution.mjs ────────────────
function runScript(opts = {}) {
  return spawnSync('node', [SCRIPT_PATH], {
    cwd: opts.cwd || process.cwd(),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

// ─── 辅助:去除 ANSI 颜色码(脚本输出含 \x1B[31m 等) ────
function stripAnsi(s) {
  return s.replace(/\x1B\[[0-9;]*m/g, '')
}

// ─── 1. 非 git: 非 git 仓库目录 → exit 0(getStagedFiles catch 返回空) ──
test('非 git: 非 git 仓库目录 → exit 0(跳过)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-nongit-'))
  try {
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0, `非 git 应 exit 0,实际 ${r.status}`)
    const out = stripAnsi(r.stdout)
    assert.match(out, /无 staged 文件|跳过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 2. 空 staged: git 仓库无 staged 文件 → exit 0(跳过) ─────────────
test('空 staged: git 仓库无 staged 文件 → exit 0(跳过)', () => {
  const dir = createTempRepo()
  try {
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0, `空 staged 应 exit 0,实际 ${r.status}`)
    const out = stripAnsi(r.stdout)
    assert.match(out, /无 staged 文件|跳过/)
    assert.ok(!out.includes('warn-only'), '空 staged 不应触发警告')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 3. 单文件: 1 个 apps/web 文件 → exit 0(未触发) ─────────────────
test('单文件: 1 个 apps/web 文件 → exit 0(未触发)', () => {
  const dir = createTempRepo()
  try {
    stageFiles(dir, ['apps/web/index.ts'])
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0, `单文件应 exit 0,实际 ${r.status}`)
    const out = stripAnsi(r.stdout)
    assert.match(out, /未触发/)
    assert.ok(!out.includes('warn-only'), '单文件不应触发警告')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 4. 单目录多文件: 3 个 apps/web 文件(1 组)→ exit 0(未触发) ──
test('单目录多文件: 3 个 apps/web 文件(1 组)→ exit 0(未触发)', () => {
  const dir = createTempRepo()
  try {
    stageFiles(dir, [
      'apps/web/index.ts',
      'apps/web/button.tsx',
      'apps/web/utils.ts',
    ])
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    const out = stripAnsi(r.stdout)
    assert.match(out, /未触发/)
    assert.ok(!out.includes('warn-only'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 5. 跨 2 目录小改: 1 apps/web + 1 apps/api → exit 0(未触发) ───
test('跨 2 目录小改: 1 apps/web + 1 apps/api → exit 0(未触发)', () => {
  const dir = createTempRepo()
  try {
    stageFiles(dir, ['apps/web/index.ts', 'apps/api/route.ts'])
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    const out = stripAnsi(r.stdout)
    assert.match(out, /未触发/)
    assert.ok(!out.includes('warn-only'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 6. 跨 3 目录小改边界: 3 文件 3 目录 → exit 0(未触发,< 4) ─────
test('跨 3 目录小改(边界): 3 文件 3 目录 → exit 0(未触发,groups < 4)', () => {
  const dir = createTempRepo()
  try {
    stageFiles(dir, ['apps/web/a.ts', 'apps/api/b.ts', 'packages/ui/c.ts'])
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    const out = stripAnsi(r.stdout)
    assert.match(out, /未触发/)
    assert.ok(!out.includes('warn-only'), '3 组 < 4 不应触发')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 7. 违规: 跨 4 目录(4 文件)→ 触发污染预警(warn-only, exit 0) ──
test('违规: 跨 4 目录(4 文件)→ 触发污染预警(warn-only, exit 0)', () => {
  const dir = createTempRepo()
  try {
    stageFiles(dir, [
      'apps/web/a.ts',
      'apps/api/b.ts',
      'apps/ai-service/c.py',
      'packages/ui/d.tsx',
    ])
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0, 'warn-only 始终 exit 0')
    const out = stripAnsi(r.stdout)
    assert.match(out, /Staged 污染预警|warn-only/)
    assert.match(out, /跨 4 个一级子目录/)
    assert.ok(!out.includes('未触发'), '触发时不应输出未触发')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 8. 违规: 跨 3 目录 + 16 文件(>15 且 ≥3)→ 触发污染预警 ─────────
test('违规: 跨 3 目录 + 16 文件(>15 且 ≥3)→ 触发污染预警', () => {
  const dir = createTempRepo()
  try {
    const files = []
    for (let i = 0; i < 6; i++) files.push(`apps/web/file${i}.ts`)
    for (let i = 0; i < 5; i++) files.push(`apps/api/file${i}.ts`)
    for (let i = 0; i < 5; i++) files.push(`packages/ui/file${i}.ts`)
    stageFiles(dir, files)
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    const out = stripAnsi(r.stdout)
    assert.match(out, /Staged 污染预警|warn-only/)
    assert.match(out, /跨 3 个一级子目录/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 9. 边界: 跨 3 目录 + 15 文件(=15, not > 15)→ exit 0(未触发) ──
test('边界: 跨 3 目录 + 15 文件(=15, not > 15)→ exit 0(未触发)', () => {
  const dir = createTempRepo()
  try {
    const files = []
    for (let i = 0; i < 5; i++) files.push(`apps/web/file${i}.ts`)
    for (let i = 0; i < 5; i++) files.push(`apps/api/file${i}.ts`)
    for (let i = 0; i < 5; i++) files.push(`packages/ui/file${i}.ts`)
    stageFiles(dir, files)
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    const out = stripAnsi(r.stdout)
    assert.match(out, /未触发/)
    assert.ok(!out.includes('warn-only'), '=15 不应触发(需 > 15)')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 10. 边界: 跨 2 目录 + 20 文件(20>15 但仅 2 组)→ exit 0(未触发) ─
test('边界: 跨 2 目录 + 20 文件(20>15 但仅 2 组)→ exit 0(未触发)', () => {
  const dir = createTempRepo()
  try {
    const files = []
    for (let i = 0; i < 10; i++) files.push(`apps/web/file${i}.ts`)
    for (let i = 0; i < 10; i++) files.push(`apps/api/file${i}.ts`)
    stageFiles(dir, files)
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    const out = stripAnsi(r.stdout)
    assert.match(out, /未触发/)
    assert.ok(!out.includes('warn-only'), '2 组 < 3 不应触发第二条')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 11. 单目录 + 20 文件(单 agent 大改)→ exit 0(未触发) ──────────
test('单目录 + 20 文件(单 agent 大改)→ exit 0(未触发)', () => {
  const dir = createTempRepo()
  try {
    const files = []
    for (let i = 0; i < 20; i++) files.push(`apps/web/file${i}.ts`)
    stageFiles(dir, files)
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    const out = stripAnsi(r.stdout)
    assert.match(out, /未触发/)
    assert.ok(!out.includes('warn-only'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 12. 违规: 混合 apps/web + apps/api + packages/ui + scripts → 4 组 ─
test('违规: 混合 apps/web + apps/api + packages/ui + scripts → 4 组触发预警', () => {
  const dir = createTempRepo()
  try {
    stageFiles(dir, [
      'apps/web/a.ts',
      'apps/api/b.ts',
      'packages/ui/c.tsx',
      'scripts/d.mjs',
    ])
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    const out = stripAnsi(r.stdout)
    assert.match(out, /Staged 污染预警|warn-only/)
    assert.match(out, /跨 4 个一级子目录/)
    // 验证分组正确:apps/web / apps/api / packages/ui / scripts 各 1 个
    assert.match(out, /apps\/web/)
    assert.match(out, /apps\/api/)
    assert.match(out, /packages\/ui/)
    assert.match(out, /scripts/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 13. 边界: 全 .md 文件跨 2 目录(文档任务)→ exit 0(未触发) ─────
test('边界: 全 .md 文件跨 2 目录(docs + README.md)→ exit 0(未触发)', () => {
  const dir = createTempRepo()
  try {
    stageFiles(dir, ['docs/guide.md', 'docs/api.md', 'README.md'])
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    const out = stripAnsi(r.stdout)
    // docs(2 文件) + README.md(1 文件,根目录自成一组) = 2 组
    assert.match(out, /未触发/)
    assert.ok(!out.includes('warn-only'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 14. 根目录文件分组: README.md + LICENSE → 2 组(各成一组)→ exit 0 ─
test('根目录文件: README.md(modified) + LICENSE(added)→ 2 组 → exit 0(未触发)', () => {
  const dir = createTempRepo()
  try {
    // README.md 已在初始 commit,修改使其 staged(Modified 走 diff-filter=M)
    writeFileSync(join(dir, 'README.md'), '# updated\n')
    writeFileSync(join(dir, 'LICENSE'), 'MIT\n')
    execSync('git add README.md LICENSE', { cwd: dir, stdio: 'pipe' })
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    const out = stripAnsi(r.stdout)
    // getTopGroup 对单段路径返回文件名本身 → README.md / LICENSE 各成一组 = 2 组
    assert.match(out, /未触发/)
    assert.ok(!out.includes('warn-only'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
