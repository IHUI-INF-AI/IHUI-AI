import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-staged-files.mjs')

// ─── 辅助:创建临时 git 仓库(含初始 commit) ──────────────
function createTempRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-staged-files-'))
  execSync('git init -b main', { cwd: dir, stdio: 'pipe' })
  execSync('git config user.email test@test.com', { cwd: dir, stdio: 'pipe' })
  execSync('git config user.name test', { cwd: dir, stdio: 'pipe' })
  execSync('git config commit.gpgsign false', { cwd: dir, stdio: 'pipe' })
  // 禁用 git 对非 ASCII 路径的转义,使中文路径原样输出(脚本透传 git 输出)
  execSync('git config core.quotepath false', { cwd: dir, stdio: 'pipe' })
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
    execSync(`git add "${f}"`, { cwd: dir, stdio: 'pipe' })
  }
}

// ─── 辅助:运行 check-staged-files.mjs ────────────────────
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

// ─── 1. 非 git: 非 git 仓库目录 → exit 0(git 命令失败 catch 兜底) ──
test('非 git: 非 git 仓库目录 → exit 0(兜底)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-nongit-'))
  try {
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0, `非 git 应 exit 0,实际 ${r.status}`)
    const out = stripAnsi(r.stdout)
    assert.match(out, /暂无 staged 文件/, 'git 失败兜底应输出"暂无 staged 文件"')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 2. 空 staged: git 仓库无 staged 文件 → exit 0 + "暂无 staged 文件" ──
test('空 staged: git 仓库无 staged 文件 → exit 0 + 提示文案', () => {
  const dir = createTempRepo()
  try {
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0, `空 staged 应 exit 0,实际 ${r.status}`)
    const out = stripAnsi(r.stdout)
    assert.match(out, /ℹ️  暂无 staged 文件/)
    // 不应出现"清单"字样
    assert.ok(!out.includes('清单'), '空 staged 不应输出清单')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 3. 单 staged 文件 → exit 0 + 列出 1 个文件 ────────────────────
test('单 staged 文件 → exit 0 + 列出该文件', () => {
  const dir = createTempRepo()
  try {
    stageFiles(dir, ['apps/web/index.ts'])
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    const out = stripAnsi(r.stdout)
    assert.match(out, /staged 文件清单\(1 个\)/)
    assert.match(out, /- apps\/web\/index\.ts/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 4. 多 staged 文件(3 个)→ exit 0 + 计数正确 + 全部列出 ─────────
test('多 staged 文件(3 个)→ exit 0 + 计数 + 全部列出', () => {
  const dir = createTempRepo()
  try {
    stageFiles(dir, ['apps/web/a.ts', 'apps/api/b.ts', 'packages/ui/c.tsx'])
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    const out = stripAnsi(r.stdout)
    assert.match(out, /staged 文件清单\(3 个\)/)
    assert.match(out, /- apps\/web\/a\.ts/)
    assert.match(out, /- apps\/api\/b\.ts/)
    assert.match(out, /- packages\/ui\/c\.tsx/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 5. 始终 exit 0: 多文件场景不阻塞(明示硬约束) ──────────────────
test('始终 exit 0: 跨 4 目录 16 文件 → exit 0(始终不阻塞)', () => {
  const dir = createTempRepo()
  try {
    const files = []
    for (let i = 0; i < 4; i++) files.push(`apps/web/f${i}.ts`)
    for (let i = 0; i < 4; i++) files.push(`apps/api/f${i}.ts`)
    for (let i = 0; i < 4; i++) files.push(`apps/ai-service/f${i}.py`)
    for (let i = 0; i < 4; i++) files.push(`packages/ui/f${i}.tsx`)
    stageFiles(dir, files)
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0, 'info-only 脚本始终 exit 0,不阻塞 commit')
    const out = stripAnsi(r.stdout)
    assert.match(out, /staged 文件清单\(16 个\)/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 6. 输出格式: 缩进 + 引导符 + 计数文案完整 ─────────────────────
test('输出格式: 含 ℹ️ 引导符 + 缩进 + 文件路径前缀 - ', () => {
  const dir = createTempRepo()
  try {
    stageFiles(dir, ['src/a.ts'])
    const r = runScript({ cwd: dir })
    const out = stripAnsi(r.stdout)
    // 引导符 + 缩进
    assert.match(out, /ℹ️  staged 文件清单\(\d+ 个\):/)
    // 文件行以 "     - " 开头(5 空格 + 短横线 + 空格)
    assert.match(out, /^     - src\/a\.ts$/m)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 7. Modified 文件(commit 后修改并 stage)→ 显示在清单 ──────────
test('Modified 文件(已 commit 后修改并 add)→ 显示在清单', () => {
  const dir = createTempRepo()
  try {
    // README.md 已在 init commit,修改并 stage
    writeFileSync(join(dir, 'README.md'), '# updated\n')
    execSync('git add README.md', { cwd: dir, stdio: 'pipe' })
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    const out = stripAnsi(r.stdout)
    assert.match(out, /staged 文件清单\(1 个\)/)
    assert.match(out, /- README\.md/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 8. Deleted 文件(git rm 后 stage)→ 显示在清单 ─────────────────
test('Deleted 文件(git rm 后 stage)→ 显示在清单', () => {
  const dir = createTempRepo()
  try {
    execSync('git rm README.md', { cwd: dir, stdio: 'pipe' })
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    const out = stripAnsi(r.stdout)
    assert.match(out, /staged 文件清单\(1 个\)/)
    assert.match(out, /- README\.md/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 9. Renamed 文件(git mv)--name-only 只显示新路径 ───────────────
test('Renamed 文件(git mv)→ --name-only 显示新路径', () => {
  const dir = createTempRepo()
  try {
    execSync('git mv README.md NEWREADME.md', { cwd: dir, stdio: 'pipe' })
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    const out = stripAnsi(r.stdout)
    // git diff --cached --name-only 对 rename 默认只输出新路径(无 diff-filter)
    assert.match(out, /staged 文件清单\(1 个\)/)
    assert.match(out, /- NEWREADME\.md/)
    assert.ok(!out.includes('README.md -> '), 'name-only 模式不应显示 -> 重命名标记')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 10. 中文路径文件 → 正确输出 ──────────────────────────────────
test('中文路径文件 → 正确显示在清单', () => {
  const dir = createTempRepo()
  try {
    stageFiles(dir, ['docs/中文指南.md'])
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    const out = stripAnsi(r.stdout)
    assert.match(out, /staged 文件清单\(1 个\)/)
    assert.match(out, /- docs\/中文指南\.md/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 11. 路径含空格 → 正确输出(引号包裹 add) ─────────────────────
test('路径含空格 → 正确显示在清单', () => {
  const dir = createTempRepo()
  try {
    stageFiles(dir, ['apps/web/my file.ts'])
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    const out = stripAnsi(r.stdout)
    assert.match(out, /staged 文件清单\(1 个\)/)
    assert.match(out, /- apps\/web\/my file\.ts/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 12. 空白行过滤: filter(Boolean) 过滤 git 输出末尾空行 ─────────
test('空白行过滤: 单文件不会因末尾换行产生空条目', () => {
  const dir = createTempRepo()
  try {
    stageFiles(dir, ['a.ts'])
    const r = runScript({ cwd: dir })
    const out = stripAnsi(r.stdout)
    // 计数应为 1(末尾 \n 被 filter(Boolean) 过滤,不会变成 2)
    assert.match(out, /staged 文件清单\(1 个\)/)
    // 不应出现两个 "- " 行
    const dashLines = (out.match(/^     - /gm) || []).length
    assert.equal(dashLines, 1, `应只有 1 个文件行,实际 ${dashLines}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 13. 输出顺序: 与 git diff --cached --name-only 一致 ───────────
test('输出顺序: 与 git diff --cached --name-only 一致', () => {
  const dir = createTempRepo()
  try {
    // 故意用反字典序的文件名,验证脚本不排序
    stageFiles(dir, ['zeta.ts', 'alpha.ts', 'mid.ts'])
    const r = runScript({ cwd: dir })
    const out = stripAnsi(r.stdout)
    // git 默认按字典序输出,这里 3 个根文件 git 会排序为 alpha/mid/zeta
    // 脚本保持 git 输出顺序,不做额外排序
    const fileLines = out
      .split('\n')
      .filter((l) => /^     - /.test(l))
      .map((l) => l.replace(/^     - /, ''))
    // 与 git 原始输出比对
    const gitOut = execSync('git diff --cached --name-only', {
      cwd: dir,
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean)
    assert.deepEqual(fileLines, gitOut, '脚本输出顺序应与 git 一致(不额外排序)')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 14. 大量文件(50 个)→ 计数 + 全部列出 + exit 0 ────────────────
test('大量文件(50 个)→ 计数正确 + 全部列出 + exit 0', () => {
  const dir = createTempRepo()
  try {
    const files = []
    for (let i = 0; i < 50; i++) files.push(`apps/web/file${i}.ts`)
    stageFiles(dir, files)
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0)
    const out = stripAnsi(r.stdout)
    assert.match(out, /staged 文件清单\(50 个\)/)
    const dashLines = (out.match(/^     - /gm) || []).length
    assert.equal(dashLines, 50, `应有 50 个文件行,实际 ${dashLines}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
