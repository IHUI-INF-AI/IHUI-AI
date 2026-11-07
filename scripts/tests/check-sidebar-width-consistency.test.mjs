// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync, execSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-sidebar-width-consistency.mjs')

// ─── Fixtures(2026-11-07 判据重写后的三件套) ────────────────────────────────
// 期望值只取几何档;CSS 是镜像值;sidebar 组件必须**精确绑定**到档。
// 本文件的用例除"合规基线"外,每条都对应一个真实可绕过路径(见门脚本头注 A/B/C 三个缺陷)。
const GEOMETRY_OK = `export const GEOMETRY_PX = {
  drawerWidth: 160,
  sidebarMaxWidth: 180,
  sidebarCollapsedWidth: 60,
}

export const rnGeometry = GEOMETRY_PX
`

const TOKENS_OK = `:root {
  --sidebar-width: 160px;
  --sidebar-collapsed-width: 60px;
}
`

const TSX_OK = `import { rnGeometry } from '@ihui/design-tokens'

const SIDEBAR_WIDTH = rnGeometry.drawerWidth
const SIDEBAR_MIN_WIDTH = rnGeometry.drawerWidth
const SIDEBAR_MAX_WIDTH = rnGeometry.sidebarMaxWidth
const SIDEBAR_COLLAPSED_WIDTH = rnGeometry.sidebarCollapsedWidth

export const widths = [SIDEBAR_WIDTH, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH, SIDEBAR_COLLAPSED_WIDTH]
`

const GEOM_PATH = 'packages/design-tokens/src/geometry.js'
const TOKENS_PATH = 'packages/design-tokens/src/styles/tokens.css'
const BARREL_PATH = 'apps/web/src/components/sidebar.tsx'
const SUBMODULE_PATH = 'apps/web/src/components/sidebar/SidebarExtra.tsx'

const DEFAULT_FILES = {
  [GEOM_PATH]: GEOMETRY_OK,
  [TOKENS_PATH]: TOKENS_OK,
  [BARREL_PATH]: TSX_OK,
}

// ─── 辅助:创建临时项目目录(默认 3 文件,overrides 可覆盖/置 null 删除) ───
function createTempProject(overrides = {}) {
  const dir = mkScratch('ihui-sidebar-w-')
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

// ─── 辅助:运行守门 ───
const ANSI_RE = /\x1b\[[0-9;]*m/g
function runScript(cwd, args = []) {
  const r = spawnSync('node', [SCRIPT_PATH, ...args], {
    cwd,
    encoding: 'utf8',
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (r.stdout) r.stdout = r.stdout.replace(ANSI_RE, '')
  if (r.stderr) r.stderr = r.stderr.replace(ANSI_RE, '')
  return r
}

function assertPass(r) {
  assert.equal(r.status, 0, `应 exit 0,实际 exit ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`)
  assert.match(r.stdout, /✅/, `stdout 应含 ✅ 标记\nstdout: ${r.stdout}`)
}

function assertFail(r, re = /❌/) {
  assert.equal(r.status, 1, `应 exit 1,实际 exit ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`)
  assert.match(r.stdout, re, `stdout 应匹配 ${re}\nstdout: ${r.stdout}`)
}

/** 未判定 = exit 2 + 明说「未判定」。逐格 ✅ 允许存在(那是已判格),但整体结论必须是未判定 */
function assertUndetermined(r, re = /未判定/) {
  assert.equal(
    r.status,
    2,
    `取不到判据输入应 exit 2(未判定),实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
  )
  assert.match(r.stdout, re, `stdout 应说明未判定原因\nstdout: ${r.stdout}`)
}

function initGitRepo(dir) {
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  execSync('git init -b main', { cwd: dir, encoding: 'utf8', stdio: 'ignore' })
  execSync('git config user.email "test@test.com"', { cwd: dir, encoding: 'utf8', stdio: 'ignore' })
  execSync('git config user.name "test"', { cwd: dir, encoding: 'utf8', stdio: 'ignore' })
  execSync('git config commit.gpgsign false', { cwd: dir, encoding: 'utf8', stdio: 'ignore' })
}

// ============================================================
// 1. 合规基线
// ============================================================

test('合规: 档 160/180/60 + CSS 镜像一致 + 四枚精确绑定 → exit 0', () => {
  const dir = createTempProject()
  try {
    const r = runScript(dir)
    assertPass(r)
    assert.match(r.stdout, /--sidebar-width: 160px === 几何档 160px/)
    assert.match(r.stdout, /--sidebar-collapsed-width: 60px === 几何档 60px/)
    assert.match(r.stdout, /SIDEBAR_MAX_WIDTH = rnGeometry\.sidebarMaxWidth/)
  } finally {
    rmScratch(dir)
  }
})

// ============================================================
// 2. CSS 镜像漂移(两个方向)
// ============================================================

test('违规: --sidebar-width 200px ≠ 档 160 → exit 1 + 点名跳变', () => {
  const dir = createTempProject({
    [TOKENS_PATH]: TOKENS_OK.replace('--sidebar-width: 160px', '--sidebar-width: 200px'),
  })
  try {
    const r = runScript(dir)
    assertFail(r, /200px ≠ 几何档 160px/)
    assert.match(r.stdout, /跳变/, `stdout 应含跳变提示\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /改为 160px/, `stdout 应含修复建议\nstdout: ${r.stdout}`)
  } finally {
    rmScratch(dir)
  }
})

test('违规: --sidebar-collapsed-width 54px ≠ 档 60 → exit 1', () => {
  const dir = createTempProject({
    [TOKENS_PATH]: TOKENS_OK.replace(
      '--sidebar-collapsed-width: 60px',
      '--sidebar-collapsed-width: 54px',
    ),
  })
  try {
    const r = runScript(dir)
    assertFail(r, /54px ≠ 几何档 60px/)
  } finally {
    rmScratch(dir)
  }
})

// ============================================================
// 3. B1:删 token / 换单位 曾经判绿 —— 现在必须 exit 2
// ============================================================

test('B1 违规: 整行删掉 --sidebar-width → exit 2(删 token 不等于没有约束)', () => {
  const dir = createTempProject({
    [TOKENS_PATH]: ':root {\n  --sidebar-collapsed-width: 60px;\n}\n',
  })
  try {
    const r = runScript(dir)
    assertUndetermined(r, /找不到 --sidebar-width/)
  } finally {
    rmScratch(dir)
  }
})

test('B1 违规: --sidebar-width 改 10rem(换单位)→ exit 2', () => {
  const dir = createTempProject({
    [TOKENS_PATH]: TOKENS_OK.replace('--sidebar-width: 160px', '--sidebar-width: 10rem'),
  })
  try {
    const r = runScript(dir)
    assertUndetermined(r, /单位是 rem/)
  } finally {
    rmScratch(dir)
  }
})

test('B1 违规: --sidebar-width 只出现在媒体查询(不在 :root)→ exit 2', () => {
  const dir = createTempProject({
    [TOKENS_PATH]: ':root {\n  --sidebar-collapsed-width: 60px;\n}\n@media (max-width: 800px) {\n  :root { --sidebar-width: 160px; }\n}\n',
  })
  try {
    const r = runScript(dir)
    assertUndetermined(r, /找不到 --sidebar-width|不在 :root/)
  } finally {
    rmScratch(dir)
  }
})

// ============================================================
// 4. B2:引用只做存在性检查曾判绿 —— 现在绑定式,表达式一律红
// ============================================================

test('B2 违规: const SIDEBAR_WIDTH = 160 字面量 → exit 1', () => {
  const dir = createTempProject({
    [BARREL_PATH]: TSX_OK.replace(
      'const SIDEBAR_WIDTH = rnGeometry.drawerWidth',
      'const SIDEBAR_WIDTH = 160',
    ),
  })
  try {
    const r = runScript(dir)
    assertFail(r, /SIDEBAR_WIDTH = 160 不是几何档引用/)
    assert.match(r.stdout, /geometry\.js/, `stdout 应指向唯一数字所在文件\nstdout: ${r.stdout}`)
  } finally {
    rmScratch(dir)
  }
})

test('B2 违规: const SIDEBAR_WIDTH = rnGeometry.drawerWidth + 40 → exit 1', () => {
  const dir = createTempProject({
    [BARREL_PATH]: TSX_OK.replace(
      'const SIDEBAR_WIDTH = rnGeometry.drawerWidth',
      'const SIDEBAR_WIDTH = rnGeometry.drawerWidth + 40',
    ),
  })
  try {
    const r = runScript(dir)
    assertFail(r, /不是几何档引用/)
  } finally {
    rmScratch(dir)
  }
})

test('B2 违规: const SIDEBAR_WIDTH = Number("160") → exit 1', () => {
  const dir = createTempProject({
    [BARREL_PATH]: TSX_OK.replace(
      'const SIDEBAR_WIDTH = rnGeometry.drawerWidth',
      "const SIDEBAR_WIDTH = Number('160')",
    ),
  })
  try {
    const r = runScript(dir)
    assertFail(r, /不是几何档引用/)
  } finally {
    rmScratch(dir)
  }
})

test('B2 违规: 陪跑引用(void rnGeometry.drawerWidth)+ 数字常量 → exit 1', () => {
  const dir = createTempProject({
    [BARREL_PATH]: TSX_OK.replace(
      'const SIDEBAR_WIDTH = rnGeometry.drawerWidth',
      'void rnGeometry.drawerWidth\nconst SIDEBAR_WIDTH = 160',
    ),
  })
  try {
    const r = runScript(dir)
    assertFail(r, /不是几何档引用/)
  } finally {
    rmScratch(dir)
  }
})

test('B2 违规: 常量绑错档(SIDEBAR_MAX_WIDTH = drawerWidth)→ exit 1', () => {
  const dir = createTempProject({
    [BARREL_PATH]: TSX_OK.replace(
      'const SIDEBAR_MAX_WIDTH = rnGeometry.sidebarMaxWidth',
      'const SIDEBAR_MAX_WIDTH = rnGeometry.drawerWidth',
    ),
  })
  try {
    const r = runScript(dir)
    assertFail(r, /绑到了 rnGeometry\.drawerWidth,期望 rnGeometry\.sidebarMaxWidth/)
  } finally {
    rmScratch(dir)
  }
})

// ============================================================
// 5. B3:let / var / 改名 / 删常量
// ============================================================

test('B3 违规: let SIDEBAR_WIDTH = 160 → exit 1(不再只认 const)', () => {
  const dir = createTempProject({
    [BARREL_PATH]: TSX_OK.replace(
      'const SIDEBAR_WIDTH = rnGeometry.drawerWidth',
      'let SIDEBAR_WIDTH = 160',
    ),
  })
  try {
    const r = runScript(dir)
    assertFail(r, /不是几何档引用/)
  } finally {
    rmScratch(dir)
  }
})

test('B3 违规: 常量被改名(SIDEBAR_WIDTH 消失)→ exit 1', () => {
  const dir = createTempProject({
    [BARREL_PATH]: TSX_OK.replace(/SIDEBAR_WIDTH/g, 'SIDEBAR_W'),
  })
  try {
    const r = runScript(dir)
    assertFail(r, /找不到 SIDEBAR_WIDTH/)
  } finally {
    rmScratch(dir)
  }
})

// ============================================================
// 6. B5/B6:两种「合规写法」不得误报
// ============================================================

test('B5 不误报: 解构 const { drawerWidth, sidebarMaxWidth, sidebarCollapsedWidth } = rnGeometry', () => {
  const dir = createTempProject({
    [BARREL_PATH]: `import { rnGeometry } from '@ihui/design-tokens'

const { drawerWidth, sidebarMaxWidth, sidebarCollapsedWidth } = rnGeometry
const SIDEBAR_WIDTH = drawerWidth
const SIDEBAR_MIN_WIDTH = drawerWidth
const SIDEBAR_MAX_WIDTH = sidebarMaxWidth
const SIDEBAR_COLLAPSED_WIDTH = sidebarCollapsedWidth
`,
  })
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmScratch(dir)
  }
})

test('B6 不误报: 块注释中间行写反例 const SIDEBAR_WIDTH = 160', () => {
  const dir = createTempProject({
    [BARREL_PATH]: `import { rnGeometry } from '@ihui/design-tokens'

/*
反例(禁止这样写):
const SIDEBAR_WIDTH = 160
*/

const SIDEBAR_WIDTH = rnGeometry.drawerWidth
const SIDEBAR_MIN_WIDTH = rnGeometry.drawerWidth
const SIDEBAR_MAX_WIDTH = rnGeometry.sidebarMaxWidth
const SIDEBAR_COLLAPSED_WIDTH = rnGeometry.sidebarCollapsedWidth
`,
  })
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmScratch(dir)
  }
})

// ============================================================
// 7. B4:子模块旁路(barrel 好看,子模块写死)
// ============================================================

test('B4 违规: 子模块写 SIDEBAR_WIDTH = 999 → exit 1', () => {
  const dir = createTempProject({
    [SUBMODULE_PATH]: `const SIDEBAR_WIDTH = 999\nexport const w = SIDEBAR_WIDTH\n`,
  })
  try {
    const r = runScript(dir)
    assertFail(r, /SidebarExtra\.tsx.*SIDEBAR_WIDTH = 999/)
  } finally {
    rmScratch(dir)
  }
})

test('B4 违规: 子模块用 w-[160px] 类名写死宽度 → exit 1', () => {
  const dir = createTempProject({
    [SUBMODULE_PATH]: `export const box = 'w-[160px]'\n`,
  })
  try {
    const r = runScript(dir)
    assertFail(r, /类名写死了侧栏宽度 w-\[160px\]/)
  } finally {
    rmScratch(dir)
  }
})

test('B4 合规: 子模块引用 barrel 常量 / 直接读档 → exit 0', () => {
  const dir = createTempProject({
    [SUBMODULE_PATH]: `import { rnGeometry } from '@ihui/design-tokens'\nconst drawerWidth = rnGeometry.drawerWidth\nexport const w = drawerWidth\n`,
  })
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmScratch(dir)
  }
})

// ============================================================
// 8. 几何档缺失 / 缺档 → exit 2
// ============================================================

test('未判定: geometry.js 缺失 → exit 2', () => {
  const dir = createTempProject({ [GEOM_PATH]: null })
  try {
    const r = runScript(dir)
    assertUndetermined(r, /取不到几何档/)
  } finally {
    rmScratch(dir)
  }
})

test('未判定: geometry.js 缺 sidebarMaxWidth → exit 2', () => {
  const dir = createTempProject({
    [GEOM_PATH]: GEOMETRY_OK.replace('  sidebarMaxWidth: 180,\n', ''),
  })
  try {
    const r = runScript(dir)
    assertUndetermined(r, /缺 sidebarMaxWidth/)
  } finally {
    rmScratch(dir)
  }
})

test('未判定: barrel 与 sidebar/ 目录都不存在 → exit 2', () => {
  const dir = createTempProject({ [BARREL_PATH]: null })
  try {
    const r = runScript(dir)
    assertUndetermined(r, /侧栏源码面读不到|未找到/)
  } finally {
    rmScratch(dir)
  }
})

// ============================================================
// 9. import 来源 / token-registry 第三源
// ============================================================

test('违规: barrel 不从 @ihui/design-tokens 导入 → exit 1', () => {
  const dir = createTempProject({
    [BARREL_PATH]: TSX_OK.replace("from '@ihui/design-tokens'", "from '@ihui/other'"),
  })
  try {
    const r = runScript(dir)
    assertFail(r, /未从 @ihui\/design-tokens 导入几何档/)
  } finally {
    rmScratch(dir)
  }
})

test('违规: token-registry defaultValue 200px ≠ tokens.css 160px → exit 1', () => {
  const dir = createTempProject({
    'packages/design-tokens/src/token-registry.ts': `export const TOKEN_REGISTRY = [
  { name: '--sidebar-width', type: 'layout', defaultValue: '200px' },
]
`,
  })
  try {
    const r = runScript(dir)
    assertFail(r, /token-registry\.ts --sidebar-width defaultValue: 200px/)
  } finally {
    rmScratch(dir)
  }
})

test('合规: token-registry 与 tokens.css 同值 → exit 0', () => {
  const dir = createTempProject({
    'packages/design-tokens/src/token-registry.ts': `export const TOKEN_REGISTRY = [
  { name: '--sidebar-width', type: 'layout', defaultValue: '160px' },
  { name: '--sidebar-collapsed-width', type: 'layout', defaultValue: '60px' },
]
`,
  })
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmScratch(dir)
  }
})

// ============================================================
// 10. --staged 模式
// ============================================================

test('staged 模式: 无相关文件 → 跳过 exit 0', () => {
  const dir = createTempProject()
  try {
    initGitRepo(dir)
    writeFileSync(join(dir, 'README.md'), '# test\n')
    execSync('git add README.md', { cwd: dir, encoding: 'utf8', stdio: 'ignore' })
    const r = runScript(dir, ['--staged'])
    assert.equal(r.status, 0, `应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /跳过/)
  } finally {
    rmScratch(dir)
  }
})

test('staged 模式: staged geometry.js 触发全量检查', () => {
  const dir = createTempProject()
  try {
    initGitRepo(dir)
    execSync(`git add ${GEOM_PATH}`, { cwd: dir, encoding: 'utf8', stdio: 'ignore' })
    const r = runScript(dir, ['--staged'])
    assertPass(r)
  } finally {
    rmScratch(dir)
  }
})

test('staged 模式: staged sidebar/ 子模块也触发(不再只看 barrel)', () => {
  const dir = createTempProject({ [SUBMODULE_PATH]: 'export const w = 1\n' })
  try {
    initGitRepo(dir)
    execSync(`git add ${SUBMODULE_PATH}`, { cwd: dir, encoding: 'utf8', stdio: 'ignore' })
    const r = runScript(dir, ['--staged'])
    assertPass(r)
  } finally {
    rmScratch(dir)
  }
})

test('staged 模式: 非 git 环境 → 回退全量 exit 0', () => {
  const dir = createTempProject()
  try {
    const r = runScript(dir, ['--staged'])
    assertPass(r)
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
