import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  rmSync,
} from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SOURCE_SCRIPT = join(__dirname, '..', 'check-design-tokens-sync.mjs')

// ============================================================
// 源脚本核心规则(scripts/check-design-tokens-sync.mjs)
// ============================================================
// 统一 design-tokens 同步守门(P1-C + P1-F 合并)。
// - --target=miniapp-taro:比对 apps/miniapp-taro/src/app.css 首个 :root/.dark 块
//   的 design-tokens 变量与 tokens.css 一致(值比对模式)。
// - --target=mobile-rn:比对 apps/mobile-rn/global.css 首个 :root/.dark 块
//   的 design-tokens 变量与 tokens.css 一致(值比对模式)。
// - --target=web:校验 globals.css 含 @import tokens.css + 顶层 :root/.dark
//   未手抄 @theme 变量(防回归)。
// - P1-C 变量覆盖:--color-* / --radius* / --chart-* / --font-* / --animate-*
//   / --z-* / --shadow-*(7 类,原仅 --color-*)。
// - 目标文件取首个 :root/.dark 块(避免本地扩展块干扰);
//   tokens.css 合并所有 @theme + :root 块(后者覆盖前者)。
// - 剥离 CSS 注释,防注释内 `--chart-text:描述` 被误匹配。
// - BOM 鲁棒:读文件时去除 UTF-8 BOM。
// - CLI:--target 必填;--quiet / --staged / --check 接受;--help 显示帮助。
// - 退出码:0=同步,1=不一致/回归,2=CLI 错误。
// ============================================================

// ─── 辅助:创建临时环境(复制脚本 + 写入 fixture) ───
// 源脚本基于 import.meta.url 解析 root,所以必须把脚本复制到临时目录,
// 并在 tempDir/apps/<target>/<css> 与
// tempDir/packages/design-tokens/src/styles/tokens.css 放置 fixture。
/**
 * @param {string} targetCss     目标 CSS 内容
 * @param {string} tokensCss    tokens.css 内容
 * @param {'miniapp-taro'|'mobile-rn'|'web'} target  目标端
 * @returns {string} 临时目录路径
 */
function createTempEnv(targetCss, tokensCss, target) {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-design-tokens-sync-'))
  // 复制源脚本到 tempDir/scripts/
  mkdirSync(join(dir, 'scripts'), { recursive: true })
  copyFileSync(SOURCE_SCRIPT, join(dir, 'scripts', 'check-design-tokens-sync.mjs'))
  // 写入目标 CSS fixture
  const targetPaths = {
    'miniapp-taro': ['apps', 'miniapp-taro', 'src', 'app.css'],
    'mobile-rn': ['apps', 'mobile-rn', 'global.css'],
    web: ['apps', 'web', 'app', 'globals.css'],
  }
  const parts = targetPaths[target]
  for (let i = 0; i < parts.length - 1; i++) mkdirSync(join(dir, ...parts.slice(0, i + 1)), { recursive: true })
  writeFileSync(join(dir, ...parts), targetCss)
  // 写入 design-tokens/tokens.css fixture
  mkdirSync(join(dir, 'packages', 'design-tokens', 'src', 'styles'), { recursive: true })
  writeFileSync(
    join(dir, 'packages', 'design-tokens', 'src', 'styles', 'tokens.css'),
    tokensCss,
  )
  return dir
}

/** 运行复制的脚本。 */
function runScript(tempDir, args = []) {
  const scriptPath = join(tempDir, 'scripts', 'check-design-tokens-sync.mjs')
  return spawnSync('node', [scriptPath, ...args], {
    cwd: tempDir,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

/** 断言值比对通过(exit 0 + stdout 含 "in sync")。 */
function assertPass(r) {
  assert.equal(
    r.status,
    0,
    `应 exit 0(同步),实际 exit ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
  )
  assert.match(
    r.stdout,
    /in sync/,
    `stdout 应含 "in sync"\nstdout: ${r.stdout}`,
  )
}

/** 断言值比对不一致(exit 1 + stderr 含 "mismatch")。 */
function assertMismatch(r) {
  assert.equal(
    r.status,
    1,
    `应 exit 1(不一致),实际 exit ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
  )
  assert.match(
    r.stderr,
    /mismatch/,
    `stderr 应含 "mismatch"\nstderr: ${r.stderr}`,
  )
}

// ============================================================
// 检查 1:CLI 标志 --help
// ============================================================

// ─── 1. CLI: --help 显示帮助并 exit 0 ───
test('CLI: --help 显示帮助并 exit 0', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-help-'))
  mkdirSync(join(dir, 'scripts'), { recursive: true })
  copyFileSync(SOURCE_SCRIPT, join(dir, 'scripts', 'check-design-tokens-sync.mjs'))
  try {
    const r = runScript(dir, ['--help'])
    assert.equal(r.status, 0, `--help 应 exit 0\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /--target/, `stdout 应含 "--target"\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /miniapp-taro/, `stdout 应含 "miniapp-taro"`)
    assert.match(r.stdout, /mobile-rn/, `stdout 应含 "mobile-rn"`)
    assert.match(r.stdout, /web/, `stdout 应含 "web"`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 2:CLI 缺少 --target → exit 2
// ============================================================

// ─── 2. CLI: 缺少 --target → exit 2 + 错误消息 ───
test('CLI: 缺少 --target → exit 2 + 错误消息', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-no-target-'))
  mkdirSync(join(dir, 'scripts'), { recursive: true })
  copyFileSync(SOURCE_SCRIPT, join(dir, 'scripts', 'check-design-tokens-sync.mjs'))
  try {
    const r = runScript(dir, [])
    assert.equal(r.status, 2, `缺少 --target 应 exit 2\nstderr: ${r.stderr}`)
    assert.match(r.stderr, /--target/, `stderr 应提示 --target`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 3:CLI 未知 target → exit 2
// ============================================================

// ─── 3. CLI: 未知 target → exit 2 + 可选值列表 ───
test('CLI: 未知 target → exit 2 + 可选值列表', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-bad-target-'))
  mkdirSync(join(dir, 'scripts'), { recursive: true })
  copyFileSync(SOURCE_SCRIPT, join(dir, 'scripts', 'check-design-tokens-sync.mjs'))
  try {
    const r = runScript(dir, ['--target=nonexistent'])
    assert.equal(r.status, 2, `未知 target 应 exit 2\nstderr: ${r.stderr}`)
    assert.match(r.stderr, /miniapp-taro/, `stderr 应列可选值`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 4:CLI --quiet 抑制通过消息(值比对模式)
// ============================================================

// ─── 4. CLI: --quiet 同步时抑制 stdout 通过消息(仍 exit 0) ───
test('CLI: --quiet 同步时抑制 stdout 通过消息(值比对模式)', () => {
  const dir = createTempEnv(
    `:root {\n  --color-primary: #fff;\n}\n`,
    `:root {\n  --color-primary: #fff;\n}\n`,
    'miniapp-taro',
  )
  try {
    const r = runScript(dir, ['--target=miniapp-taro', '--quiet'])
    assert.equal(r.status, 0, `--quiet 同步应 exit 0\nstdout: ${r.stdout}`)
    assert.equal(r.stdout, '', `--quiet 应抑制 stdout,实际: ${r.stdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 5:CLI --staged 被接受(无操作,仍全量扫描)
// ============================================================

// ─── 5. CLI: --staged 被接受(无操作)→ exit 0 ───
test('CLI: --staged 被接受(无操作)→ exit 0', () => {
  const dir = createTempEnv(
    `:root {\n  --color-bg: #000;\n}\n`,
    `:root {\n  --color-bg: #000;\n}\n`,
    'miniapp-taro',
  )
  try {
    const r = runScript(dir, ['--target=miniapp-taro', '--staged'])
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 6:CLI --check 被接受(无操作,向后兼容)
// ============================================================

// ─── 6. CLI: --check 被接受(无操作)→ exit 0 ───
test('CLI: --check 被接受(无操作,向后兼容)→ exit 0', () => {
  const dir = createTempEnv(
    `:root {\n  --color-x: #abc;\n}\n`,
    `:root {\n  --color-x: #abc;\n}\n`,
    'mobile-rn',
  )
  try {
    const r = runScript(dir, ['--target=mobile-rn', '--check'])
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 7:核心规则 -- :root + .dark 全部同步 → exit 0
// ============================================================

// ─── 7. 核心: :root + .dark 全部同步 → exit 0 + 计数消息 ───
test('核心: :root + .dark 全部同步 → exit 0 + 计数消息', () => {
  const appCss = `:root {\n  --color-primary: #fff;\n  --color-bg: #000;\n}\n.dark {\n  --color-primary: #ccc;\n  --color-bg: #111;\n}\n`
  const tokensCss = `:root {\n  --color-primary: #fff;\n  --color-bg: #000;\n}\n.dark {\n  --color-primary: #ccc;\n  --color-bg: #111;\n}\n`
  const dir = createTempEnv(appCss, tokensCss, 'miniapp-taro')
  try {
    const r = runScript(dir, ['--target=miniapp-taro'])
    assertPass(r)
    assert.match(r.stdout, /4 variables are in sync/, `stdout 应含 "4 variables"\nstdout: ${r.stdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 8:核心规则 -- :root 值不一致 → exit 1
// ============================================================

// ─── 8. 核心: :root 值不一致 → exit 1 + 报告 :root diff ───
test('核心: :root 值不一致 → exit 1 + 报告 :root diff', () => {
  const appCss = `:root {\n  --color-primary: #fff;\n}\n`
  const tokensCss = `:root {\n  --color-primary: #f5f5f5;\n}\n`
  const dir = createTempEnv(appCss, tokensCss, 'miniapp-taro')
  try {
    const r = runScript(dir, ['--target=miniapp-taro'])
    assertMismatch(r)
    assert.match(r.stderr, /:root block/, `stderr 应含 ":root block"`)
    assert.match(r.stderr, /--color-primary/, `stderr 应含 "--color-primary"`)
    assert.match(r.stderr, /#fff/, `stderr 应含目标值 #fff`)
    assert.match(r.stderr, /#f5f5f5/, `stderr 应含 tokens 值 #f5f5f5`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 9:核心规则 -- .dark 值不一致 → exit 1
// ============================================================

// ─── 9. 核心: .dark 值不一致 → exit 1 + 报告 .dark diff ───
test('核心: .dark 值不一致 → exit 1 + 报告 .dark diff', () => {
  const appCss = `:root {\n  --color-primary: #fff;\n}\n.dark {\n  --color-primary: #aaa;\n}\n`
  const tokensCss = `:root {\n  --color-primary: #fff;\n}\n.dark {\n  --color-primary: #bbb;\n}\n`
  const dir = createTempEnv(appCss, tokensCss, 'mobile-rn')
  try {
    const r = runScript(dir, ['--target=mobile-rn'])
    assertMismatch(r)
    assert.match(r.stderr, /\.dark block/, `stderr 应含 ".dark block"`)
    assert.match(r.stderr, /#aaa/, `stderr 应含目标值 #aaa`)
    assert.match(r.stderr, /#bbb/, `stderr 应含 tokens 值 #bbb`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 10:核心规则 -- 目标有变量但 tokens 缺失 → exit 1
// ============================================================

// ─── 10. 核心: :root 变量在 tokens 中缺失 → exit 1 + "<missing>" ───
test('核心: :root 变量在 tokens 中缺失 → exit 1 + "<missing>"', () => {
  const appCss = `:root {\n  --color-accent: #ff0;\n}\n`
  const tokensCss = `:root {\n  --color-other: #abc;\n}\n`
  const dir = createTempEnv(appCss, tokensCss, 'miniapp-taro')
  try {
    const r = runScript(dir, ['--target=miniapp-taro'])
    assertMismatch(r)
    assert.match(r.stderr, /<missing>/, `stderr 应含 "<missing>"`)
    assert.match(r.stderr, /--color-accent/, `stderr 应含 "--color-accent"`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 11:核心规则 -- tokens 有额外变量(目标未复制)→ exit 0
// ============================================================

// ─── 11. 核心: tokens 有额外变量(目标未复制)→ exit 0(子集检查) ───
test('核心: tokens 有额外变量(目标未复制)→ exit 0(子集检查)', () => {
  const appCss = `:root {\n  --color-primary: #fff;\n}\n`
  const tokensCss = `:root {\n  --color-primary: #fff;\n  --color-extra: #abc;\n}\n`
  const dir = createTempEnv(appCss, tokensCss, 'miniapp-taro')
  try {
    const r = runScript(dir, ['--target=miniapp-taro'])
    assertPass(r)
    assert.match(r.stdout, /1 variables are in sync/, `stdout 应含 "1 variables"`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 12:P1-C 扩展 -- --radius* 变量校验
// ============================================================

// ─── 12. P1-C: --radius + --radius-sm 同步 → exit 0 ───
test('P1-C: --radius + --radius-sm 同步 → exit 0(扩展覆盖)', () => {
  const appCss = `:root {\n  --radius: 0.5rem;\n  --radius-sm: 0.25rem;\n}\n`
  const tokensCss = `:root {\n  --radius: 0.5rem;\n  --radius-sm: 0.25rem;\n}\n`
  const dir = createTempEnv(appCss, tokensCss, 'miniapp-taro')
  try {
    const r = runScript(dir, ['--target=miniapp-taro'])
    assertPass(r)
    assert.match(r.stdout, /2 variables/, `应检测到 2 个 radius 变量`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 13. P1-C: --radius 值不一致 → exit 1 ───
test('P1-C: --radius 值不一致 → exit 1(扩展覆盖)', () => {
  const appCss = `:root {\n  --radius: 0.5rem;\n}\n`
  const tokensCss = `:root {\n  --radius: 0.75rem;\n}\n`
  const dir = createTempEnv(appCss, tokensCss, 'miniapp-taro')
  try {
    const r = runScript(dir, ['--target=miniapp-taro'])
    assertMismatch(r)
    assert.match(r.stderr, /--radius:/, `stderr 应含 "--radius:"`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 13:P1-C 扩展 -- --chart-* 变量校验
// ============================================================

// ─── 14. P1-C: --chart-1 同步 → exit 0 ───
test('P1-C: --chart-1 同步 → exit 0(扩展覆盖)', () => {
  const appCss = `:root {\n  --chart-1: #3b82f6;\n}\n`
  const tokensCss = `@theme {\n  --chart-1: #3b82f6;\n}\n`
  const dir = createTempEnv(appCss, tokensCss, 'miniapp-taro')
  try {
    const r = runScript(dir, ['--target=miniapp-taro'])
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 15. P1-C: --chart-1 值不一致 → exit 1 ───
test('P1-C: --chart-1 值不一致 → exit 1(扩展覆盖)', () => {
  const appCss = `:root {\n  --chart-1: #3b82f6;\n}\n`
  const tokensCss = `@theme {\n  --chart-1: #0000ff;\n}\n`
  const dir = createTempEnv(appCss, tokensCss, 'miniapp-taro')
  try {
    const r = runScript(dir, ['--target=miniapp-taro'])
    assertMismatch(r)
    assert.match(r.stderr, /--chart-1/, `stderr 应含 "--chart-1"`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 14:P1-C 扩展 -- --font-*/--animate-*/--z-*/--shadow-* 变量校验
// ============================================================

// ─── 16. P1-C: --font-sans / --animate-ripple / --z-modal / --shadow-premium 全同步 → exit 0 ───
test('P1-C: --font-sans / --animate-ripple / --z-modal / --shadow-premium 全同步 → exit 0', () => {
  const appCss = `:root {\n  --font-sans: 'Helvetica', sans-serif;\n  --animate-ripple: ripple 0.6s ease;\n  --z-modal: 2000;\n  --shadow-premium: 0 2px 8px rgba(0,0,0,0.1);\n}\n`
  const tokensCss = `:root {\n  --font-sans: 'Helvetica', sans-serif;\n  --animate-ripple: ripple 0.6s ease;\n  --z-modal: 2000;\n  --shadow-premium: 0 2px 8px rgba(0,0,0,0.1);\n}\n`
  const dir = createTempEnv(appCss, tokensCss, 'miniapp-taro')
  try {
    const r = runScript(dir, ['--target=miniapp-taro'])
    assertPass(r)
    assert.match(r.stdout, /4 variables/, `应检测到 4 个扩展类型变量`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 17. P1-C: --z-modal 值不一致 → exit 1 ───
test('P1-C: --z-modal 值不一致 → exit 1(扩展覆盖)', () => {
  const appCss = `:root {\n  --z-modal: 2000;\n}\n`
  const tokensCss = `:root {\n  --z-modal: 1500;\n}\n`
  const dir = createTempEnv(appCss, tokensCss, 'mobile-rn')
  try {
    const r = runScript(dir, ['--target=mobile-rn'])
    assertMismatch(r)
    assert.match(r.stderr, /--z-modal/, `stderr 应含 "--z-modal"`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 15:注释剥离 -- 注释内 --chart-text: 描述 不被误匹配
// ============================================================

// ─── 18. 注释剥离: 注释内 `--chart-text:描述文字` 不被误匹配 → exit 0 ───
test('注释剥离: tokens.css 注释内 --chart-text:描述 不被误匹配 → exit 0', () => {
  const appCss = `:root {\n  --chart-1: #3b82f6;\n  --chart-text: #94a3b8;\n}\n`
  // 注释中含 `--chart-text:图表文字色`,若无注释剥离会吞掉 --chart-1
  const tokensCss = `@theme {\n  /* --chart-text:图表文字色  --chart-axis:轴线色 */\n  --chart-1: #3b82f6;\n  --chart-text: #94a3b8;\n}\n`
  const dir = createTempEnv(appCss, tokensCss, 'miniapp-taro')
  try {
    const r = runScript(dir, ['--target=miniapp-taro'])
    assertPass(r)
    assert.match(r.stdout, /2 variables/, `应正确检测到 2 个变量(非被注释吞掉)`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 16:语法支持 -- tokens.css @theme {} 语法
// ============================================================

// ─── 19. 语法: tokens.css 使用 @theme {} 语法 → 正确解析,exit 0 ───
test('语法: tokens.css 使用 @theme {} 语法 → 正确解析,exit 0', () => {
  const appCss = `:root {\n  --color-primary: #fff;\n}\n`
  const tokensCss = `@theme {\n  --color-primary: #fff;\n}\n`
  const dir = createTempEnv(appCss, tokensCss, 'miniapp-taro')
  try {
    const r = runScript(dir, ['--target=miniapp-taro'])
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 17:语法支持 -- tokens.css @theme + :root 合并
// ============================================================

// ─── 20. 语法: tokens.css @theme + :root 合并(后者覆盖)→ exit 0 ───
test('语法: tokens.css @theme + :root 合并(后者覆盖)→ exit 0', () => {
  const appCss = `:root {\n  --color-primary: #fff;\n  --color-bg: #000;\n}\n`
  const tokensCss = `@theme {\n  --color-primary: #fff;\n}\n:root {\n  --color-bg: #000;\n}\n`
  const dir = createTempEnv(appCss, tokensCss, 'miniapp-taro')
  try {
    const r = runScript(dir, ['--target=miniapp-taro'])
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 18:首个块 -- 目标第二个 :root 块(本地扩展)不干扰
// ============================================================

// ─── 21. 首个块: 目标第二个 :root 块(本地扩展变量)不干扰 → exit 0 ───
test('首个块: 目标第二个 :root 块(本地扩展变量)不干扰 → exit 0', () => {
  // 首个 :root 含与 tokens.css 同步的变量
  // 第二个 :root 含本地扩展变量(--color-local-ext,不在 tokens.css 中)
  const appCss = `:root {\n  --color-primary: #fff;\n}\n/* 本地扩展 */\n:root {\n  --color-local-ext: #abc;\n}\n`
  const tokensCss = `:root {\n  --color-primary: #fff;\n}\n`
  const dir = createTempEnv(appCss, tokensCss, 'miniapp-taro')
  try {
    const r = runScript(dir, ['--target=miniapp-taro'])
    assertPass(r)
    // 只检测首个 :root 块的 1 个变量,不含本地扩展
    assert.match(r.stdout, /1 variables/, `应只检测首个块的 1 个变量`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 19:web @import 单源模式 -- @import 存在 → exit 0
// ============================================================

// ─── 22. web: globals.css 含 @import tokens.css → exit 0 ───
test('web: globals.css 含 @import tokens.css → exit 0', () => {
  const webCss = `@import '../../../packages/design-tokens/src/styles/tokens.css';\n`
  const tokensCss = `@theme {\n  --color-primary: #fff;\n}\n`
  const dir = createTempEnv(webCss, tokensCss, 'web')
  try {
    const r = runScript(dir, ['--target=web'])
    assert.equal(r.status, 0, `web @import OK 应 exit 0\nstdout: ${r.stdout}\nstderr: ${r.stderr}`)
    assert.match(r.stdout, /@import tokens.css OK/, `stdout 应含 "@import tokens.css OK"`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 20:web @import 回归 -- 缺少 @import → exit 1
// ============================================================

// ─── 23. web: globals.css 缺少 @import tokens.css → exit 1(回归) ───
test('web: globals.css 缺少 @import tokens.css → exit 1(回归)', () => {
  const webCss = `:root {\n  --color-primary: #fff;\n}\n`
  const tokensCss = `@theme {\n  --color-primary: #fff;\n}\n`
  const dir = createTempEnv(webCss, tokensCss, 'web')
  try {
    const r = runScript(dir, ['--target=web'])
    assert.equal(r.status, 1, `web 缺 @import 应 exit 1\nstderr: ${r.stderr}`)
    assert.match(r.stderr, /REGRESSION/, `stderr 应含 "REGRESSION"`)
    assert.match(r.stderr, /@import/, `stderr 应提示 @import`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 21:web 手抄回归 -- 顶层 :root 手抄 @theme 变量 → exit 1
// ============================================================

// ─── 24. web: 顶层 :root 手抄 @theme 变量(--radius-sm)→ exit 1(回归) ───
test('web: 顶层 :root 手抄 @theme 变量(--radius-sm)→ exit 1(回归)', () => {
  const webCss = `@import '../../../packages/design-tokens/src/styles/tokens.css';\n:root {\n  --radius-sm: 0.25rem;\n}\n`
  const tokensCss = `@theme {\n  --radius-sm: 0.25rem;\n}\n`
  const dir = createTempEnv(webCss, tokensCss, 'web')
  try {
    const r = runScript(dir, ['--target=web'])
    assert.equal(r.status, 1, `web 手抄 @theme 变量应 exit 1\nstderr: ${r.stderr}`)
    assert.match(r.stderr, /REGRESSION/, `stderr 应含 "REGRESSION"`)
    assert.match(r.stderr, /--radius-sm/, `stderr 应含被手抄的变量名`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 22:web -- @media 内 :root 不算顶层(允许高对比度覆盖)
// ============================================================

// ─── 25. web: @media 内 :root 不算顶层(允许)→ exit 0 ───
test('web: @media 内 :root 不算顶层(允许)→ exit 0', () => {
  const webCss = `@import '../../../packages/design-tokens/src/styles/tokens.css';\n@media (prefers-contrast: high) {\n  :root {\n    --color-primary: #000;\n  }\n}\n`
  const tokensCss = `@theme {\n  --color-primary: #fff;\n}\n`
  const dir = createTempEnv(webCss, tokensCss, 'web')
  try {
    const r = runScript(dir, ['--target=web'])
    assert.equal(r.status, 0, `@media 内 :root 不应触发回归\nstderr: ${r.stderr}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 23:BOM 鲁棒性 -- 目标文件含 UTF-8 BOM 仍正确解析
// ============================================================

// ─── 26. BOM: 目标文件含 UTF-8 BOM 仍正确解析 → exit 0 ───
test('BOM: 目标文件含 UTF-8 BOM 仍正确解析 → exit 0', () => {
  const dir = createTempEnv(
    `:root {\n  --color-primary: #fff;\n}\n`,
    `:root {\n  --color-primary: #fff;\n}\n`,
    'miniapp-taro',
  )
  // 给目标 CSS 文件加 BOM
  const targetPath = join(dir, 'apps', 'miniapp-taro', 'src', 'app.css')
  const content = readFileSync(targetPath)
  if (content[0] !== 0xef) {
    writeFileSync(targetPath, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), content]))
  }
  try {
    const r = runScript(dir, ['--target=miniapp-taro'])
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 24:边界 -- 两文件均无 design-tokens 变量 → exit 0
// ============================================================

// ─── 27. 边界: 两文件均无 design-tokens 变量 → exit 0(0 in sync) ───
test('边界: 两文件均无 design-tokens 变量 → exit 0(0 in sync)', () => {
  // --spacing-sm 不在 7 类覆盖范围内,应被忽略
  const appCss = `:root {\n  --spacing-sm: 4px;\n}\n`
  const tokensCss = `:root {\n  --spacing-sm: 4px;\n}\n`
  const dir = createTempEnv(appCss, tokensCss, 'miniapp-taro')
  try {
    const r = runScript(dir, ['--target=miniapp-taro'])
    assert.equal(r.status, 0, `无 design-tokens 变量应 exit 0\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /0 variables are in sync/, `stdout 应含 "0 variables"`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 25:边界 -- --quiet 不一致时仍输出错误
// ============================================================

// ─── 28. 输出: --quiet 不一致时 stderr 仍输出错误(exit 1) ───
test('输出: --quiet 不一致时 stderr 仍输出错误(exit 1)', () => {
  const appCss = `:root {\n  --color-x: #aaa;\n}\n`
  const tokensCss = `:root {\n  --color-x: #bbb;\n}\n`
  const dir = createTempEnv(appCss, tokensCss, 'miniapp-taro')
  try {
    const r = runScript(dir, ['--target=miniapp-taro', '--quiet'])
    assert.equal(r.status, 1, `--quiet 不一致应 exit 1\nstderr: ${r.stderr}`)
    assert.equal(r.stdout, '', `--quiet 应抑制 stdout`)
    assert.match(r.stderr, /mismatch/, `stderr 应含 "mismatch"`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 26:边界 -- 多值变量(--font-sans 多行值)正确提取
// ============================================================

// ─── 29. 边界: --font-sans 多行值正确提取 → exit 0 ───
test('边界: --font-sans 多行值正确提取 → exit 0', () => {
  const fontVal = `'HarmonyOS Sans SC', ui-sans-serif,\n    system-ui, -apple-system, sans-serif`
  const appCss = `:root {\n  --font-sans: ${fontVal};\n}\n`
  const tokensCss = `@theme {\n  --font-sans: ${fontVal};\n}\n`
  const dir = createTempEnv(appCss, tokensCss, 'miniapp-taro')
  try {
    const r = runScript(dir, ['--target=miniapp-taro'])
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
