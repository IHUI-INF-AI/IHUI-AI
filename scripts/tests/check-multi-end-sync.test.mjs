import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-multi-end-sync.mjs')

// ─── 辅助:创建临时 git 仓库(含初始 commit) ──────────────
// check-multi-end-sync.mjs 调用 git diff --cached 读取 staged 文件,需 git 环境
function createTempRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-multi-end-'))
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

// ─── 辅助:在工作仓库创建文件并 stage(不 commit) ─────────
// files: ['apps/web/a.ts', 'packages/ui/b.tsx', ...] (正斜杠路径)
function stageFiles(dir, files) {
  for (const f of files) {
    const fullPath = join(dir, f)
    mkdirSync(dirname(fullPath), { recursive: true })
    writeFileSync(fullPath, `content for ${f}\n`)
    execSync(`git add "${f}"`, { cwd: dir, stdio: 'pipe' })
  }
}

// ─── 辅助:写入 PROJECT_PLAN.md(不 stage,仅供脚本读取) ──
function writePlan(dir, content) {
  writeFileSync(join(dir, 'PROJECT_PLAN.md'), content)
}

// ─── 辅助:运行 check-multi-end-sync.mjs ──────────────────
function runScript(opts = {}) {
  const r = spawnSync('node', [SCRIPT_PATH], {
    cwd: opts.cwd || process.cwd(),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  // 去除 ANSI 颜色码,便于正则断言
  r.out = (r.stdout || '').replace(/\x1b\[[0-9;]*m/g, '')
  return r
}

// ═══════════════════════════════════════════════════════════
// CLI 行为
// ═══════════════════════════════════════════════════════════

// ─── 1. CLI: --help 不崩溃(脚本未实现 --help,按默认模式运行) ──
test('CLI: --help 不崩溃(脚本未实现 --help,按默认模式运行)', () => {
  const dir = createTempRepo()
  try {
    const r = runScript({ cwd: dir })
    // 无 --help 解析,直接走 main()(空 staged → 跳过)
    assert.equal(r.status, 0, `应 exit 0,实际 ${r.status}\nstderr: ${r.stderr}`)
    assert.ok(!r.stderr.includes('Error:'), `不应产生未捕获 Error`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 2. 非 git: 非 git 仓库目录 → exit 0(getStagedFiles catch 返回空) ──
test('非 git: 非 git 仓库目录 → exit 0(跳过)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-nongit-'))
  try {
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0, `非 git 应 exit 0,实际 ${r.status}`)
    assert.match(r.out, /无 staged 文件|跳过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 3. 空 staged: git 仓库无 staged 文件 → exit 0(跳过) ─────────────
test('空 staged: git 仓库无 staged 文件 → exit 0(跳过)', () => {
  const dir = createTempRepo()
  try {
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0, `空 staged 应 exit 0,实际 ${r.status}`)
    assert.match(r.out, /无 staged 文件|跳过/)
    assert.ok(!r.out.includes('warn-only'), '空 staged 不应触发警告')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ═══════════════════════════════════════════════════════════
// 场景 1: 0 端 + 0 共享(纯豁免目录)→ pass
// ═══════════════════════════════════════════════════════════

// ─── 4. 场景1: 纯 scripts/ 文件 → exit 0 pass(豁免) ──────────────────
test('场景1: 纯 scripts/ 文件 → exit 0 pass(豁免,非端代码)', () => {
  const dir = createTempRepo()
  try {
    stageFiles(dir, ['scripts/check-foo.mjs', 'scripts/helpers/util.mjs'])
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0, `场景1 应 exit 0,实际 ${r.status}`)
    assert.match(r.out, /豁免/)
    assert.ok(!r.out.includes('warn-only'), '纯 scripts/ 不应触发警告')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 5. 场景1: 纯根目录文件(README.md + package.json)→ exit 0 pass ──
test('场景1: 纯根目录文件(README.md + package.json)→ exit 0 pass(豁免)', () => {
  const dir = createTempRepo()
  try {
    // README.md 已在初始 commit,修改使其 staged(Modified 走 diff-filter=M)
    writeFileSync(join(dir, 'README.md'), '# updated\n')
    writeFileSync(join(dir, 'package.json'), '{"name":"test"}\n')
    execSync('git add README.md package.json', { cwd: dir, stdio: 'pipe' })
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0, `根目录文件应 exit 0,实际 ${r.status}`)
    assert.match(r.out, /豁免/)
    assert.ok(!r.out.includes('warn-only'), '根目录文件不应触发警告')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ═══════════════════════════════════════════════════════════
// 场景 2: 触及 packages/* 未标注 → warn;已标注 → pass
// ═══════════════════════════════════════════════════════════

// ─── 6. 场景2: 仅 packages/types + 无 PROJECT_PLAN.md → exit 0 warn ──
test('场景2: 仅 packages/types + 无 PROJECT_PLAN.md → exit 0 warn(未标注共享包)', () => {
  const dir = createTempRepo()
  try {
    stageFiles(dir, ['packages/types/index.ts', 'packages/types/user.d.ts'])
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0, 'warn-only 始终 exit 0')
    assert.match(r.out, /warn-only/, '应输出 warn-only')
    assert.match(r.out, /共享包改动未标注跨端验证/)
    assert.ok(!r.out.includes('豁免'), '不应走场景1 豁免路径')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 7. 场景2: 仅 packages/ui + PROJECT_PLAN.md 标注"共享包" → pass ──
test('场景2: 仅 packages/ui + PROJECT_PLAN.md 标注"共享包" → exit 0 pass', () => {
  const dir = createTempRepo()
  try {
    stageFiles(dir, ['packages/ui/button.tsx'])
    writePlan(
      dir,
      '# plan\n\n### 任务A(共享包改动)\n更新 packages/ui Button 组件,8 端引用已验证一致\n',
    )
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0, `已标注共享包应 exit 0,实际 ${r.status}`)
    assert.match(r.out, /已标注共享包|pass/)
    assert.ok(!r.out.includes('warn-only'), '已标注不应触发警告')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 8. 场景2: 仅 packages/database + 标注"packages/*" → pass ────────
test('场景2: 仅 packages/database + PROJECT_PLAN.md 标注"packages/*" → exit 0 pass', () => {
  const dir = createTempRepo()
  try {
    stageFiles(dir, ['packages/database/src/schema.ts'])
    writePlan(
      dir,
      '# plan\n\n### 任务A\npackages/* 单包改动(database schema 更新)\n',
    )
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0, `标注 packages/* 应 exit 0,实际 ${r.status}`)
    assert.match(r.out, /已标注共享包|pass/)
    assert.ok(!r.out.includes('warn-only'), '标注 packages/* 不应触发警告')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 9. 场景2: 仅 packages/auth + PROJECT_PLAN.md 未标注 → exit 0 warn
test('场景2: 仅 packages/auth + PROJECT_PLAN.md 未标注 → exit 0 warn', () => {
  const dir = createTempRepo()
  try {
    stageFiles(dir, ['packages/auth/src/jwt.ts'])
    writePlan(dir, '# plan\n\n### 任务A\n修复 auth 模块 JWT 验证逻辑\n')
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0, 'warn-only 始终 exit 0')
    assert.match(r.out, /warn-only/)
    assert.match(r.out, /共享包改动未标注跨端验证/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ═══════════════════════════════════════════════════════════
// 场景 3: 触及 ≥2 端 → pass(满足跨端连通)
// ═══════════════════════════════════════════════════════════

// ─── 10. 场景3: apps/web + apps/api(2 端)→ exit 0 pass ──────────────
test('场景3: apps/web + apps/api(2 端)→ exit 0 pass(满足跨端连通)', () => {
  const dir = createTempRepo()
  try {
    stageFiles(dir, ['apps/web/page.tsx', 'apps/api/route.ts'])
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0, `2 端应 exit 0,实际 ${r.status}`)
    assert.match(r.out, /满足跨端连通|2 端/)
    assert.ok(!r.out.includes('warn-only'), '2 端连通不应触发警告')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 11. 场景3: 3 端(web + api + ai-service)→ exit 0 pass ───────────
test('场景3: 3 端(web + api + ai-service)→ exit 0 pass(满足跨端连通)', () => {
  const dir = createTempRepo()
  try {
    stageFiles(dir, [
      'apps/web/page.tsx',
      'apps/api/route.ts',
      'apps/ai-service/main.py',
    ])
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0, `3 端应 exit 0,实际 ${r.status}`)
    assert.match(r.out, /满足跨端连通|3 端/)
    assert.match(r.out, /web/, '应列出端名 web')
    assert.match(r.out, /api/, '应列出端名 api')
    assert.match(r.out, /ai-service/, '应列出端名 ai-service')
    assert.ok(!r.out.includes('warn-only'), '3 端连通不应触发警告')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ═══════════════════════════════════════════════════════════
// 场景 4: 触及 1 端 → 检查标注(平台独占 / 跨端:仅 X 端 / X 独占)
// ═══════════════════════════════════════════════════════════

// ─── 12. 场景4: 仅 apps/web + 标注"平台独占" → exit 0 pass ────────────
test('场景4: 仅 apps/web + PROJECT_PLAN.md 标注"平台独占" → exit 0 pass', () => {
  const dir = createTempRepo()
  try {
    stageFiles(dir, ['apps/web/page.tsx'])
    writePlan(dir, '# plan\n\n### 任务A\n平台独占:web 端专属页面\n')
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0, `已标注平台独占应 exit 0,实际 ${r.status}`)
    assert.match(r.out, /已标注平台独占|pass/)
    assert.ok(!r.out.includes('warn-only'), '已标注不应触发警告')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 13. 场景4: 仅 apps/web + 标注"跨端:仅 web 端" → exit 0 pass ────
test('场景4: 仅 apps/web + 标注"跨端:仅 web 端" → exit 0 pass(端名匹配)', () => {
  const dir = createTempRepo()
  try {
    stageFiles(dir, ['apps/web/dashboard.tsx'])
    writePlan(dir, '# plan\n\n### 任务A\n跨端:仅 web 端(web 独占页面)\n')
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0, `端名匹配应 exit 0,实际 ${r.status}`)
    assert.match(r.out, /已标注平台独占|pass/)
    assert.ok(!r.out.includes('warn-only'), '端名匹配不应触发警告')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 14. 场景4: 仅 apps/api + 标注"web 独占"(端不匹配)→ warn ──────
test('场景4: 仅 apps/api + 标注"web 独占"(端不匹配)→ exit 0 warn', () => {
  const dir = createTempRepo()
  try {
    stageFiles(dir, ['apps/api/route.ts'])
    // 活跃任务标注 "web 独占",但 staged 触及 api 端 → 端名不匹配 → warn
    writePlan(dir, '# plan\n\n### 任务A\nweb 独占页面开发\n')
    const r = runScript({ cwd: dir })
    assert.equal(r.status, 0, 'warn-only 始终 exit 0')
    assert.match(r.out, /warn-only/)
    assert.match(r.out, /单端改动未标注平台独占/)
    assert.match(r.out, /api/, '应报告触及 api 端')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 15. 场景4 边界: apps/web + packages/ui(1 端 + 共享)+ 无标注 → warn
test('场景4 边界: apps/web + packages/ui(1 端 + 共享)+ 无标注 → exit 0 warn(走场景4)', () => {
  const dir = createTempRepo()
  try {
    stageFiles(dir, ['apps/web/page.tsx', 'packages/ui/button.tsx'])
    writePlan(dir, '# plan\n\n### 任务A\n更新 web 页面引用的新 Button\n')
    const r = runScript({ cwd: dir })
    // endCount=1(web), sharedFiles=[packages/ui/...] → 命中场景4(endCount===1)
    // 共享包不影响场景4 判定,无标注 → warn
    assert.equal(r.status, 0, 'warn-only 始终 exit 0')
    assert.match(r.out, /warn-only/)
    assert.match(r.out, /单端改动未标注平台独占/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
