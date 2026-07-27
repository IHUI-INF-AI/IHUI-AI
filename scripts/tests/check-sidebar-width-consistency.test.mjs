import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync, execSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-sidebar-width-consistency.mjs')

// ─── Fixtures:合规基线(CSS 200px === JS SIDEBAR_WIDTH=200) ───
// 源脚本检查 2 个固定路径:
//   apps/web/src/styles/design-tokens.css  (--sidebar-width: Npx)
//   apps/web/src/components/sidebar.tsx    (const SIDEBAR_WIDTH = N)
const VALID_CSS = `:root {
  --sidebar-width: 200px;
  --other-token: 10px;
}
`

const VALID_TSX = `import { useState } from 'react'

const SIDEBAR_WIDTH = 200

export function Sidebar() {
  return <aside style={{ width: SIDEBAR_WIDTH }} />
}
`

const DEFAULT_FILES = {
  'apps/web/src/styles/design-tokens.css': VALID_CSS,
  'apps/web/src/components/sidebar.tsx': VALID_TSX,
}

// ─── 辅助:创建临时项目目录(默认 2 文件,overrides 可覆盖/置 null 删除) ───
function createTempProject(overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-sidebar-w-'))
  const files = { ...DEFAULT_FILES }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null) {
      delete files[key]
    } else {
      files[key] = value
    }
  }
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = join(dir, relPath)
    mkdirSync(join(fullPath, '..'), { recursive: true })
    writeFileSync(fullPath, content)
  }
  return dir
}

// ─── 辅助:运行 check-sidebar-width-consistency.mjs ───
// 去除 ANSI 颜色码,便于正则断言
const ANSI_RE = /\x1b\[[0-9;]*m/g
function runScript(cwd, args = []) {
  const r = spawnSync('node', [SCRIPT_PATH, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  if (r.stdout) r.stdout = r.stdout.replace(ANSI_RE, '')
  if (r.stderr) r.stderr = r.stderr.replace(ANSI_RE, '')
  return r
}

// ─── 辅助:断言通过(exit 0 + stdout 含 ✅ 一致) ───
function assertPass(r) {
  assert.equal(r.status, 0, `应 exit 0,实际 exit ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`)
  assert.match(r.stdout, /✅.*一致/, `stdout 应含一致标记\nstdout: ${r.stdout}`)
}

// ─── 辅助:断言失败(exit 1 + stdout 含 ❌ 不一致) ───
function assertFail(r) {
  assert.equal(r.status, 1, `应 exit 1,实际 exit ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`)
  assert.match(r.stdout, /❌.*不一致/, `stdout 应含不一致标记\nstdout: ${r.stdout}`)
}

// ─── 辅助:在临时目录初始化 git 仓库 ───
function initGitRepo(dir) {
  execSync('git init -b main', { cwd: dir, encoding: 'utf8', stdio: 'pipe' })
  execSync('git config user.email "test@test.com"', { cwd: dir, encoding: 'utf8', stdio: 'pipe' })
  execSync('git config user.name "test"', { cwd: dir, encoding: 'utf8', stdio: 'pipe' })
  execSync('git config commit.gpgsign false', { cwd: dir, encoding: 'utf8', stdio: 'pipe' })
}

// ============================================================
// 检查 1:核心规则 —— CSS 与 JS 宽度一致 → exit 0
// ============================================================

// ─── 1. 合法:CSS 200px === JS SIDEBAR_WIDTH=200 → exit 0 ───
test('合法: CSS --sidebar-width: 200px === JS SIDEBAR_WIDTH=200 → exit 0', () => {
  const dir = createTempProject()
  try {
    const r = runScript(dir)
    assertPass(r)
    assert.match(r.stdout, /200px === SIDEBAR_WIDTH: 200px/, `stdout 应含一致数值对照\nstdout: ${r.stdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 2. 合法:两者都是 130 → exit 0(项目实际值) ───
test('合法: CSS 130px === JS SIDEBAR_WIDTH=130 → exit 0', () => {
  const dir = createTempProject({
    'apps/web/src/styles/design-tokens.css': VALID_CSS.replace('200px', '130px'),
    'apps/web/src/components/sidebar.tsx': VALID_TSX.replace('SIDEBAR_WIDTH = 200', 'SIDEBAR_WIDTH = 130'),
  })
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 2:核心规则 —— CSS 与 JS 宽度不一致 → exit 1
// ============================================================

// ─── 3. 违规: CSS 200px ≠ JS SIDEBAR_WIDTH=130 → exit 1(根因案例值) ──
test('违规: CSS 200px ≠ JS 130(根因案例值)→ exit 1 + 报告宽度跳变', () => {
  const dir = createTempProject({
    'apps/web/src/components/sidebar.tsx': VALID_TSX.replace('SIDEBAR_WIDTH = 200', 'SIDEBAR_WIDTH = 130'),
  })
  try {
    const r = runScript(dir)
    assertFail(r)
    assert.match(r.stdout, /200px.*!==.*130px|200px.*≠.*130px/, `stdout 应含 200 vs 130 对照\nstdout: ${r.stdout}`)
    // 根因说明:首屏 CSS 预设 → JS useEffect 覆盖的宽度跳变闪烁
    assert.match(r.stdout, /跳变/, `stdout 应含跳变提示\nstdout: ${r.stdout}`)
    // 修复建议:把 design-tokens.css 的 --sidebar-width 改为 JS 值
    assert.match(r.stdout, /130px/, `stdout 应含修复建议值 130px\nstdout: ${r.stdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 4. 违规: CSS 130px ≠ JS SIDEBAR_WIDTH=200 → exit 1(反向) ───
test('违规: CSS 130px ≠ JS 200(反向)→ exit 1', () => {
  const dir = createTempProject({
    'apps/web/src/styles/design-tokens.css': VALID_CSS.replace('200px', '130px'),
  })
  try {
    const r = runScript(dir)
    assertFail(r)
    assert.match(r.stdout, /130px/, `stdout 应含 CSS 值 130px\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /200px/, `stdout 应含 JS 值 200px\nstdout: ${r.stdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 3:边界 —— 文件缺失(警告不阻塞,exit 0)
// ============================================================

// ─── 5. 边界: design-tokens.css 缺失 → exit 0(仅 ⚠️ 警告) ───
test('边界: design-tokens.css 缺失 → exit 0(仅警告不阻塞)', () => {
  const dir = createTempProject({ 'apps/web/src/styles/design-tokens.css': null })
  try {
    const r = runScript(dir)
    assert.equal(r.status, 0, `css 缺失应 exit 0(仅警告),实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /design-tokens\.css.*未找到|--sidebar-width.*未找到/, `stdout 应含未找到 --sidebar-width 警告\nstdout: ${r.stdout}`)
    // 不应有 ✅ 通过标记(因为没有完成一致性对比)
    assert.doesNotMatch(r.stdout, /✅.*一致/, `不应有 ✅ 一致标记\nstdout: ${r.stdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 6. 边界: sidebar.tsx 缺失 → exit 0(仅 ⚠️ 警告) ───
test('边界: sidebar.tsx 缺失 → exit 0(仅警告不阻塞)', () => {
  const dir = createTempProject({ 'apps/web/src/components/sidebar.tsx': null })
  try {
    const r = runScript(dir)
    assert.equal(r.status, 0, `tsx 缺失应 exit 0(仅警告),实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /sidebar\.tsx.*未找到|SIDEBAR_WIDTH.*未找到/, `stdout 应含未找到 SIDEBAR_WIDTH 警告\nstdout: ${r.stdout}`)
    assert.doesNotMatch(r.stdout, /✅.*一致/, `不应有 ✅ 一致标记\nstdout: ${r.stdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 7. 边界: 两文件都缺失 → exit 0(仅 ⚠️ 警告,先报 CSS 缺失) ───
test('边界: 两文件都缺失 → exit 0(优先报 CSS 缺失)', () => {
  const dir = createTempProject({
    'apps/web/src/styles/design-tokens.css': null,
    'apps/web/src/components/sidebar.tsx': null,
  })
  try {
    const r = runScript(dir)
    assert.equal(r.status, 0, `两文件都缺失应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
    // 源脚本先判 cssWidth===null,故优先报 CSS 缺失
    assert.match(r.stdout, /design-tokens\.css.*未找到|--sidebar-width.*未找到/, `stdout 应含 CSS 缺失警告\nstdout: ${r.stdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 4:边界 —— 文件存在但模式不匹配(警告不阻塞,exit 0)
// ============================================================

// ─── 8. 边界: CSS 存在但无 --sidebar-width 定义 → exit 0(警告) ───
test('边界: CSS 存在但无 --sidebar-width → exit 0(警告)', () => {
  const dir = createTempProject({
    'apps/web/src/styles/design-tokens.css': `:root { --other: 10px; }\n`,
  })
  try {
    const r = runScript(dir)
    assert.equal(r.status, 0, `CSS 无 --sidebar-width 应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /design-tokens\.css.*未找到|--sidebar-width.*未找到/, `stdout 应含未找到警告\nstdout: ${r.stdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 9. 边界: TSX 存在但无 SIDEBAR_WIDTH 常量 → exit 0(警告) ───
test('边界: TSX 存在但无 SIDEBAR_WIDTH 常量 → exit 0(警告)', () => {
  const dir = createTempProject({
    'apps/web/src/components/sidebar.tsx': `export function Sidebar() { return <aside /> }\n`,
  })
  try {
    const r = runScript(dir)
    assert.equal(r.status, 0, `TSX 无 SIDEBAR_WIDTH 应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /sidebar\.tsx.*未找到|SIDEBAR_WIDTH.*未找到/, `stdout 应含未找到警告\nstdout: ${r.stdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 5:正则解析鲁棒性 —— 不同写法仍能匹配
// ============================================================

// ─── 10. 鲁棒: CSS --sidebar-width 带不同空白/数值 → exit 0 ───
test('鲁棒: CSS "--sidebar-width: 180px" 与 JS 180 → exit 0', () => {
  const dir = createTempProject({
    'apps/web/src/styles/design-tokens.css': `:root{--sidebar-width:   180px  ;}\n`,
    'apps/web/src/components/sidebar.tsx': VALID_TSX.replace('SIDEBAR_WIDTH = 200', 'SIDEBAR_WIDTH = 180'),
  })
  try {
    const r = runScript(dir)
    assertPass(r)
    assert.match(r.stdout, /180px === SIDEBAR_WIDTH: 180px/, `stdout 应含 180 一致对照\nstdout: ${r.stdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 11. 鲁棒: TSX SIDEBAR_WIDTH 用 const 但无分号 → exit 0 ───
test('鲁棒: TSX "const SIDEBAR_WIDTH = 250"(无分号)与 CSS 250px → exit 0', () => {
  const dir = createTempProject({
    'apps/web/src/styles/design-tokens.css': VALID_CSS.replace('200px', '250px'),
    'apps/web/src/components/sidebar.tsx': `const SIDEBAR_WIDTH = 250\nexport function Sidebar() { return null }\n`,
  })
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 6:--staged 模式(git diff --cached 相关性过滤)
// ============================================================

// ─── 12. staged: git 仓库无相关 staged 文件(仅 README)→ 跳过 exit 0 ───
test('staged 模式: git 仓库无相关 staged 文件 → 跳过 exit 0', () => {
  const dir = createTempProject()
  try {
    initGitRepo(dir)
    writeFileSync(join(dir, 'README.md'), '# test\n')
    execSync('git add README.md', { cwd: dir, encoding: 'utf8', stdio: 'pipe' })
    const r = runScript(dir, ['--staged'])
    assert.equal(r.status, 0, `无相关 staged 应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /跳过/, `stdout 应含跳过标记\nstdout: ${r.stdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 13. staged: git 仓库 staged design-tokens.css → 跑全量检查 exit 0 ──
test('staged 模式: staged design-tokens.css → 跑全量检查 exit 0', () => {
  const dir = createTempProject()
  try {
    initGitRepo(dir)
    execSync('git add apps/web/src/styles/design-tokens.css', { cwd: dir, encoding: 'utf8', stdio: 'pipe' })
    const r = runScript(dir, ['--staged'])
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 14. staged: git 仓库 staged sidebar.tsx → 跑全量检查 exit 0 ───
test('staged 模式: staged sidebar.tsx → 跑全量检查 exit 0', () => {
  const dir = createTempProject()
  try {
    initGitRepo(dir)
    execSync('git add apps/web/src/components/sidebar.tsx', { cwd: dir, encoding: 'utf8', stdio: 'pipe' })
    const r = runScript(dir, ['--staged'])
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 15. staged: 非 git 环境(无 .git)→ 回退全量检查 exit 0 ───
test('staged 模式: 非 git 环境 → 回退全量检查 exit 0', () => {
  const dir = createTempProject()
  try {
    // 不 initGitRepo,直接跑 --staged
    const r = runScript(dir, ['--staged'])
    // 非 git 环境 catch 块吞掉异常,继续走全量检查
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
