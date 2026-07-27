import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-readme-sync.mjs')

// ─── 辅助:创建临时 git 仓库(含初始 commit,README.md 已纳入版本控制) ──
// check-readme-sync.mjs 通过 git diff 读取 staged/working 文件,需 git 环境
function createTempRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-readme-sync-'))
  const opt = { cwd: dir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
  spawnSync('git', ['init', '-b', 'main'], opt)
  spawnSync('git', ['config', 'user.email', 'test@ihui.local'], opt)
  spawnSync('git', ['config', 'user.name', 'Test'], opt)
  spawnSync('git', ['config', 'commit.gpgsign', 'false'], opt)
  writeFileSync(join(dir, 'README.md'), '# init\n')
  spawnSync('git', ['add', 'README.md'], opt)
  spawnSync('git', ['commit', '-q', '-m', 'init'], opt)
  return dir
}

// ─── 辅助:在工作仓库创建新文件并 stage(不 commit) ─────────
// files: ['apps/web/src/foo.ts', ...] (正斜杠路径,Windows 上 git 也接受)
function stageFiles(dir, files) {
  for (const f of files) {
    const fullPath = join(dir, f)
    mkdirSync(dirname(fullPath), { recursive: true })
    writeFileSync(fullPath, `content for ${f}\n`)
    execSync(`git add "${f}"`, { cwd: dir, stdio: 'pipe' })
  }
}

// ─── 辅助:修改已纳入版本控制的 README.md 并 stage ────────
// 用于"README 已同步"场景(README.md 在初始 commit 中,需 modified 才进 staged)
function stageReadme(dir, content) {
  writeFileSync(join(dir, 'README.md'), content)
  execSync('git add README.md', { cwd: dir, stdio: 'pipe' })
}

function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, '')
}

// ─── 辅助:运行 check-readme-sync.mjs ─────────────────────
// 默认传 --staged(pre-commit 钩子模式);opts.args 可覆盖(传 [] 走默认 working tree 模式)
// 脚本用 console.warn → 业务输出走 stderr;stdout 始终空
function runScript(opts = {}) {
  const args = opts.args !== undefined ? opts.args : ['--staged']
  const r = spawnSync('node', [SCRIPT_PATH, ...args], {
    cwd: opts.cwd || process.cwd(),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  r.err = stripAnsi(r.stderr || '')
  r.out = stripAnsi(r.stdout || '')
  return r
}

// ═══════════════════════════════════════════════════════════
// 环境与空状态
// ═══════════════════════════════════════════════════════════

// ─── 1. 非 git: 非 git 仓库目录 + --staged → exit 0(getStagedFiles catch 返回空) ──
test('非 git: 非 git 仓库目录 + --staged → exit 0(跳过,无 warn)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-nongit-'))
  try {
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0, `非 git 应 exit 0,实际 ${r.status}`)
    assert.ok(!r.err.includes('[check-readme-sync]'), '非 git 不应触发 warn')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 2. 空 staged: git 仓库无 staged 文件 → exit 0(无 trigger,无 warn) ─────
test('空 staged: git 仓库无 staged 文件 → exit 0(无 trigger,无 warn)', () => {
  const dir = createTempRepo()
  try {
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0, `空 staged 应 exit 0,实际 ${r.status}`)
    assert.ok(!r.err.includes('[check-readme-sync]'), '空 staged 不应触发 warn')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ═══════════════════════════════════════════════════════════
// pass 场景(README 已同步 / 无功能代码改动)
// ═══════════════════════════════════════════════════════════

// ─── 3. pass: staged apps/web/src 功能代码 + README.md 已同步 → exit 0 ─────
test('pass: staged apps/web/src 功能代码 + README.md 已同步 → exit 0,无 warn', () => {
  const dir = createTempRepo()
  try {
    stageFiles(dir, ['apps/web/src/page.tsx'])
    stageReadme(dir, '# updated\n')
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0, `README 已同步应 exit 0,实际 ${r.status}`)
    assert.ok(!r.err.includes('[check-readme-sync]'), 'README 已同步不应 warn')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 4. pass: staged packages/ui/src 共享包代码 + README.md 已同步 → exit 0 ─
test('pass: staged packages/ui/src 共享包代码 + README.md 已同步 → exit 0,无 warn', () => {
  const dir = createTempRepo()
  try {
    stageFiles(dir, ['packages/ui/src/button.tsx'])
    stageReadme(dir, '# updated\n')
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    assert.ok(!r.err.includes('[check-readme-sync]'), 'packages + README 同步不应 warn')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 5. pass: staged 仅 scripts/ 改动(豁免,非功能代码)→ exit 0 ──────────────
test('pass: staged 仅 scripts/ 改动(豁免,非功能代码)→ exit 0,无 warn', () => {
  const dir = createTempRepo()
  try {
    stageFiles(dir, ['scripts/check-foo.mjs', 'scripts/helpers/util.mjs'])
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    assert.ok(!r.err.includes('[check-readme-sync]'), 'scripts/ 豁免不应 warn')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 6. pass: staged 仅 README.md(modified,无功能代码)→ exit 0 ─────────────
test('pass: staged 仅 README.md(modified,无功能代码)→ exit 0,无 warn', () => {
  const dir = createTempRepo()
  try {
    stageReadme(dir, '# only readme\n')
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    assert.ok(!r.err.includes('[check-readme-sync]'), '仅 README.md 不应 warn')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ═══════════════════════════════════════════════════════════
// warn 场景(功能代码改动但 README.md 未同步)
// ═══════════════════════════════════════════════════════════

// ─── 7. warn: staged apps/web/src 功能代码,无 README.md → exit 0 + warn ─────
test('warn: staged apps/web/src 功能代码,无 README.md → exit 0 + warn', () => {
  const dir = createTempRepo()
  try {
    stageFiles(dir, ['apps/web/src/page.tsx'])
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0, 'warn-only 始终 exit 0')
    assert.match(r.err, /\[check-readme-sync\]/, '应输出脚本标识')
    assert.match(r.err, /README\.md 未同步/, '应提示 README 未同步')
    assert.match(r.err, /warn-only/, '应标明 warn-only')
    assert.match(r.err, /apps\/web\/src\/page\.tsx/, '应列出触发文件')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 8. warn: staged packages/ui/src 共享包代码,无 README.md → exit 0 + warn ─
test('warn: staged packages/ui/src 共享包代码,无 README.md → exit 0 + warn', () => {
  const dir = createTempRepo()
  try {
    stageFiles(dir, ['packages/ui/src/button.tsx'])
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    assert.match(r.err, /\[check-readme-sync\]/)
    assert.match(r.err, /README\.md 未同步/)
    assert.match(r.err, /packages\/ui\/src\/button\.tsx/, '应列出 packages 触发文件')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 9. warn: staged apps/ai-service/app/api/ 改动,无 README.md → exit 0 + warn ─
test('warn: staged apps/ai-service/app/api/ 改动,无 README.md → exit 0 + warn', () => {
  const dir = createTempRepo()
  try {
    stageFiles(dir, ['apps/ai-service/app/api/route.py'])
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    assert.match(r.err, /\[check-readme-sync\]/)
    assert.match(r.err, /README\.md 未同步/)
    assert.match(r.err, /apps\/ai-service\/app\/api\/route\.py/, '应列出 ai-service api 触发文件')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 10. warn: staged apps/ai-service/app/services/ 改动,无 README.md → exit 0 + warn ─
test('warn: staged apps/ai-service/app/services/ 改动,无 README.md → exit 0 + warn', () => {
  const dir = createTempRepo()
  try {
    stageFiles(dir, ['apps/ai-service/app/services/llm.py'])
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    assert.match(r.err, /\[check-readme-sync\]/)
    assert.match(r.err, /README\.md 未同步/)
    assert.match(r.err, /apps\/ai-service\/app\/services\/llm\.py/, '应列出 ai-service services 触发文件')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ═══════════════════════════════════════════════════════════
// 边界场景(豁免交互 / 非 trigger 路径 / 截断 / 默认模式)
// ═══════════════════════════════════════════════════════════

// ─── 11. 边界 pass: staged apps/web/src/foo.test.ts(测试文件豁免)→ exit 0 ──
test('边界 pass: staged apps/web/src/foo.test.ts(测试文件豁免)→ exit 0,无 warn', () => {
  const dir = createTempRepo()
  try {
    stageFiles(dir, ['apps/web/src/foo.test.ts'])
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    assert.ok(!r.err.includes('[check-readme-sync]'), '测试文件豁免不应 warn')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 12. 边界 pass: staged apps/web/src/guide.md(md 文件豁免,TRIGGER 命中但被 EXEMPT 抵消)→ exit 0 ──
test('边界 pass: staged apps/web/src/guide.md(md 豁免,TRIGGER+EXEMPT 抵消)→ exit 0,无 warn', () => {
  const dir = createTempRepo()
  try {
    stageFiles(dir, ['apps/web/src/guide.md'])
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    assert.ok(!r.err.includes('[check-readme-sync]'), 'md 文件豁免不应 warn')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 13. 边界 pass: staged apps/web/foo.ts(不在 src/,非 trigger)→ exit 0 ──
test('边界 pass: staged apps/web/foo.ts(不在 src/,非 trigger)→ exit 0,无 warn', () => {
  const dir = createTempRepo()
  try {
    stageFiles(dir, ['apps/web/foo.ts'])
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    assert.ok(!r.err.includes('[check-readme-sync]'), '非 src 路径不触发')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 14. 边界 warn: staged 6 个 trigger 文件(>5)→ exit 0 + warn,含"还有 1 个"截断 ──
test('边界 warn: staged 6 个 trigger 文件(>5)→ exit 0 + warn,含"还有 1 个"截断提示', () => {
  const dir = createTempRepo()
  try {
    const files = []
    for (let i = 0; i < 6; i++) files.push(`apps/web/src/file${i}.ts`)
    stageFiles(dir, files)
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    assert.match(r.err, /\[check-readme-sync\]/)
    assert.match(r.err, /6 个功能文件/, '应报告 6 个功能文件')
    assert.match(r.err, /还有 1 个/, '应输出截断提示"还有 1 个"')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 15. 非 staged 模式: 默认模式(无 --staged)读取 working tree 改动,无 README.md → warn ──
test('非 staged 模式: 默认模式(无 --staged)读取 working tree 改动,无 README.md → exit 0 + warn', () => {
  const dir = createTempRepo()
  try {
    // stageFiles 创建并 stage 新文件;git diff --name-only HEAD 会包含 staged 新文件(HEAD 未含)
    stageFiles(dir, ['apps/web/src/page.tsx'])
    // 不传 --staged,走默认 working tree 模式(line 87-94 分支)
    const r = runScript({ cwd: dir, args: [] })
    assert.equal(r.status, 0)
    assert.match(r.err, /\[check-readme-sync\]/, '默认模式也应检测功能代码改动')
    assert.match(r.err, /README\.md 未同步/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
