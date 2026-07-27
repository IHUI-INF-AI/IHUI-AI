import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync, execSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-z-index-guard.mjs')

// ─── Fixtures:4 个合规文件(全绿基线)─────────────────────
// 源脚本检查 4 个固定路径文件:
//   packages/design-tokens/src/styles/tokens.css  (11 个 z-index 变量,无 !important)
//   apps/web/app/globals.css                       (5 个工具类,无 !important)
//   apps/web/app/layout.tsx                        (inline script 含 11 个 setProperty)
//   packages/ui-react/src/components/dialog.tsx   (遮罩无 open 态 fade-in)
const VALID_TOKENS_CSS = `:root {
  --z-base: 1;
  --z-sticky: 990;
  --z-modal: 2000;
  --z-popover: 2001;
  --z-notification: 9999;
  --z-max: 10003;
  --z-0: 0;
  --z-header: 100;
  --z-dropdown: 1000;
  --z-overlay: 1000;
  --z-loading: 10000;
}
`

const VALID_GLOBALS_CSS = `.z-sticky { z-index: var(--z-sticky); }
.z-modal { z-index: var(--z-modal); }
.z-popover { z-index: var(--z-popover); }
.z-notification { z-index: var(--z-notification); }
.z-max { z-index: var(--z-max); }
`

const VALID_LAYOUT_TSX = `export default function RootLayout() {
  return (
    <html>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: \`
            document.documentElement.style.setProperty('--z-base', '1');
            document.documentElement.style.setProperty('--z-sticky', '990');
            document.documentElement.style.setProperty('--z-modal', '2000');
            document.documentElement.style.setProperty('--z-popover', '2001');
            document.documentElement.style.setProperty('--z-notification', '9999');
            document.documentElement.style.setProperty('--z-max', '10003');
            document.documentElement.style.setProperty('--z-0', '0');
            document.documentElement.style.setProperty('--z-header', '100');
            document.documentElement.style.setProperty('--z-dropdown', '1000');
            document.documentElement.style.setProperty('--z-overlay', '1000');
            document.documentElement.style.setProperty('--z-loading', '10000');
          \`
        }} />
      </head>
      <body />
    </html>
  )
}
`

const VALID_DIALOG_TSX = `import { DialogPrimitive } from './dialog-primitive'
export function Dialog() {
  return (
    <DialogPrimitive.Overlay className="bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
  )
}
`

const DEFAULT_FILES = {
  'packages/design-tokens/src/styles/tokens.css': VALID_TOKENS_CSS,
  'apps/web/app/globals.css': VALID_GLOBALS_CSS,
  'apps/web/app/layout.tsx': VALID_LAYOUT_TSX,
  'packages/ui-react/src/components/dialog.tsx': VALID_DIALOG_TSX,
}

// ─── 辅助:创建临时项目目录(默认 4 文件,overrides 可覆盖/置 null 删除) ───
function createTempProject(overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-zguard-'))
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

// ─── 辅助:运行 check-z-index-guard.mjs ───
function runScript(cwd, args = []) {
  return spawnSync('node', [SCRIPT_PATH, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

// ─── 辅助:断言通过(exit 0 + stdout 含 ✅ 通过) ───
function assertPass(r) {
  assert.equal(r.status, 0, `应 exit 0,实际 exit ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`)
  assert.match(r.stdout, /✅.*通过/, `stdout 应含通过标记\nstdout: ${r.stdout}`)
}

// ─── 辅助:断言失败(exit 1 + stdout 含 ❌ 失败) ───
function assertFail(r) {
  assert.equal(r.status, 1, `应 exit 1,实际 exit ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`)
  assert.match(r.stdout, /❌.*失败/, `stdout 应含失败标记\nstdout: ${r.stdout}`)
}

// ─── 辅助:在临时目录初始化 git 仓库 ───
function initGitRepo(dir) {
  execSync('git init', { cwd: dir, encoding: 'utf8', stdio: 'pipe' })
  execSync('git config user.email "test@test.com"', { cwd: dir, encoding: 'utf8', stdio: 'pipe' })
  execSync('git config user.name "test"', { cwd: dir, encoding: 'utf8', stdio: 'pipe' })
}

// ============================================================
// 检查 1:tokens.css z-index 变量(无 !important + 值精确匹配)
// ============================================================

// ─── 1. 合法:4 文件全部合规 → exit 0 ───
test('合法: 4 文件全部合规 → exit 0', () => {
  const dir = createTempProject()
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 2. 违规: tokens.css --z-base 含 !important → exit 1 ───
test('违规: tokens.css --z-base 含 !important → exit 1', () => {
  const badTokens = VALID_TOKENS_CSS.replace('--z-base: 1;', '--z-base: 1 !important;')
  const dir = createTempProject({ 'packages/design-tokens/src/styles/tokens.css': badTokens })
  try {
    const r = runScript(dir)
    assertFail(r)
    assert.match(r.stdout, /!important/, `stdout 应含 !important 标记\nstdout: ${r.stdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 3. 违规: tokens.css 缺少 --z-modal 变量 → exit 1 ───
test('违规: tokens.css 缺少 --z-modal → exit 1', () => {
  const badTokens = VALID_TOKENS_CSS.replace('  --z-modal: 2000;\n', '')
  const dir = createTempProject({ 'packages/design-tokens/src/styles/tokens.css': badTokens })
  try {
    const r = runScript(dir)
    assertFail(r)
    assert.match(r.stdout, /--z-modal.*未找到|未找到.*--z-modal/, `stdout 应含 --z-modal 未找到\nstdout: ${r.stdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 4. 违规: tokens.css --z-sticky 值错误(990→991)→ exit 1 ───
test('违规: tokens.css --z-sticky 值错误 → exit 1', () => {
  const badTokens = VALID_TOKENS_CSS.replace('--z-sticky: 990;', '--z-sticky: 991;')
  const dir = createTempProject({ 'packages/design-tokens/src/styles/tokens.css': badTokens })
  try {
    const r = runScript(dir)
    assertFail(r)
    assert.match(r.stdout, /--z-sticky.*未找到|未找到.*--z-sticky/, `stdout 应含 --z-sticky 未找到\nstdout: ${r.stdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 2:globals.css z-index 工具类(无 !important)
// ============================================================

// ─── 5. 违规: globals.css .z-modal 含 !important → exit 1 ───
test('违规: globals.css .z-modal 含 !important → exit 1', () => {
  const badGlobals = VALID_GLOBALS_CSS.replace(
    '.z-modal { z-index: var(--z-modal); }',
    '.z-modal { z-index: var(--z-modal) !important; }',
  )
  const dir = createTempProject({ 'apps/web/app/globals.css': badGlobals })
  try {
    const r = runScript(dir)
    assertFail(r)
    assert.match(r.stdout, /\.z-modal.*!important|!important.*\.z-modal/, `stdout 应含 .z-modal !important\nstdout: ${r.stdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 3:layout.tsx inline script(11 个 setProperty 调用)
// ============================================================

// ─── 6. 违规: layout.tsx 缺少 setProperty('--z-modal') → exit 1 ───
test('违规: layout.tsx 缺少 setProperty(--z-modal) → exit 1', () => {
  const badLayout = VALID_LAYOUT_TSX.replace(
    "document.documentElement.style.setProperty('--z-modal', '2000');\n",
    '',
  )
  const dir = createTempProject({ 'apps/web/app/layout.tsx': badLayout })
  try {
    const r = runScript(dir)
    assertFail(r)
    assert.match(r.stdout, /setProperty\('--z-modal'/, `stdout 应含 setProperty('--z-modal' 缺失\nstdout: ${r.stdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 4:dialog.tsx 遮罩(无 open 态 fade-in 动画)
// ============================================================

// ─── 7. 违规: dialog.tsx 含 animate-in + fade-in-0 → exit 1 ───
test('违规: dialog.tsx 含 data-[state=open]:animate-in + fade-in-0 → exit 1', () => {
  const badDialog = VALID_DIALOG_TSX.replace(
    'className="bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"',
    'className="bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0"',
  )
  const dir = createTempProject({ 'packages/ui-react/src/components/dialog.tsx': badDialog })
  try {
    const r = runScript(dir)
    assertFail(r)
    assert.match(r.stdout, /fade-in|animate-in/, `stdout 应含 fade-in/animate-in 标记\nstdout: ${r.stdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 8. 违规: dialog.tsx 仅含 data-[state=open]:fade-in-0(无 animate-in)→ exit 1 ───
test('违规: dialog.tsx 仅含 data-[state=open]:fade-in-0 → exit 1', () => {
  const badDialog = VALID_DIALOG_TSX.replace(
    'className="bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"',
    'className="bg-black/50 data-[state=open]:fade-in-0"',
  )
  const dir = createTempProject({ 'packages/ui-react/src/components/dialog.tsx': badDialog })
  try {
    const r = runScript(dir)
    assertFail(r)
    assert.match(r.stdout, /fade-in/, `stdout 应含 fade-in 标记\nstdout: ${r.stdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 边界:4 个文件各自缺失 → exit 1(每个 existsSync 检查)
// ============================================================

// ─── 9. 违规: tokens.css 缺失 → exit 1 ───
test('违规: tokens.css 文件缺失 → exit 1', () => {
  const dir = createTempProject({ 'packages/design-tokens/src/styles/tokens.css': null })
  try {
    const r = runScript(dir)
    assertFail(r)
    assert.match(r.stdout, /tokens\.css 不存在/, `stdout 应含 tokens.css 不存在\nstdout: ${r.stdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 10. 违规: globals.css 缺失 → exit 1 ───
test('违规: globals.css 文件缺失 → exit 1', () => {
  const dir = createTempProject({ 'apps/web/app/globals.css': null })
  try {
    const r = runScript(dir)
    assertFail(r)
    assert.match(r.stdout, /globals\.css 不存在/, `stdout 应含 globals.css 不存在\nstdout: ${r.stdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 11. 违规: layout.tsx 缺失 → exit 1 ───
test('违规: layout.tsx 文件缺失 → exit 1', () => {
  const dir = createTempProject({ 'apps/web/app/layout.tsx': null })
  try {
    const r = runScript(dir)
    assertFail(r)
    assert.match(r.stdout, /layout\.tsx 不存在/, `stdout 应含 layout.tsx 不存在\nstdout: ${r.stdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 12. 违规: dialog.tsx 缺失 → exit 1 ───
test('违规: dialog.tsx 文件缺失 → exit 1', () => {
  const dir = createTempProject({ 'packages/ui-react/src/components/dialog.tsx': null })
  try {
    const r = runScript(dir)
    assertFail(r)
    assert.match(r.stdout, /dialog\.tsx 不存在/, `stdout 应含 dialog.tsx 不存在\nstdout: ${r.stdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 边界:dialog.tsx 无 DialogPrimitive.Overlay(警告不阻塞)
// ============================================================

// ─── 13. 边界: dialog.tsx 无 Overlay 匹配 → exit 0(仅 ⚠️ 警告,不设 hasError) ───
test('边界: dialog.tsx 无 DialogPrimitive.Overlay → exit 0(仅警告不阻塞)', () => {
  const noOverlayDialog = `export function Dialog() {
  return <div>no overlay here</div>
}
`
  const dir = createTempProject({ 'packages/ui-react/src/components/dialog.tsx': noOverlayDialog })
  try {
    const r = runScript(dir)
    assertPass(r)
    assert.match(r.stdout, /未找到 DialogPrimitive\.Overlay/, `stdout 应含未找到 Overlay 警告\nstdout: ${r.stdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// --staged 模式(git diff --cached 相关性过滤)
// ============================================================

// ─── 14. staged: git 仓库无相关 staged 文件(仅 README)→ 跳过 exit 0 ───
test('staged 模式: git 仓库无相关 staged 文件 → 跳过 exit 0', () => {
  const dir = createTempProject()
  try {
    initGitRepo(dir)
    writeFileSync(join(dir, 'README.md'), '# test')
    execSync('git add README.md', { cwd: dir, encoding: 'utf8', stdio: 'pipe' })
    const r = runScript(dir, ['--staged'])
    assert.equal(r.status, 0, `无相关 staged 应 exit 0,实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`)
    assert.match(r.stdout, /跳过/, `stdout 应含跳过标记\nstdout: ${r.stdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 15. staged: git 仓库有相关 staged 文件(globals.css)→ 跑全量检查 exit 0 ───
test('staged 模式: git 仓库有相关 staged 文件(globals.css)→ 跑全量检查 exit 0', () => {
  const dir = createTempProject()
  try {
    initGitRepo(dir)
    execSync('git add apps/web/app/globals.css', { cwd: dir, encoding: 'utf8', stdio: 'pipe' })
    const r = runScript(dir, ['--staged'])
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
