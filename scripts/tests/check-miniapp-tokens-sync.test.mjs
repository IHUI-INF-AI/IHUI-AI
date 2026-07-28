import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  copyFileSync,
  rmSync,
} from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SOURCE_SCRIPT = join(__dirname, '..', 'check-miniapp-tokens-sync.mjs')

// ============================================================
// 源脚本核心规则(scripts/check-miniapp-tokens-sync.mjs)
// ============================================================
// - 守门规则:apps/miniapp-taro/src/app.css 中的 --color-* 变量必须与
//   packages/design-tokens/src/styles/tokens.css 保持同步。
//   (Taro 4 + Tailwind v3,无法 @import tokens.css,由 sync-design-tokens.mjs 生成)
// - 路径解析:基于 import.meta.url(非 process.cwd),root = 脚本父目录的上一级
// - miniapp-taro 提取::root(浅色)+ .dark(深色)
// - tokens.css 提取:@theme + :root(浅色,两种语法合并)+ .dark(深色)
// - 比较范围:仅检查 miniapp-taro 中存在的变量(它复制的是子集)
// - 退出码:0 = 同步,1 = 发现不一致
// - CLI 标志:--quiet(仅输出错误)/ --staged(接受,无操作,仍全量扫描)
// ============================================================

// ─── 辅助:创建临时环境(复制脚本 + 写入 fixture) ───
// 源脚本基于 import.meta.url 解析 root,所以必须把脚本复制到临时目录,
// 并在 tempDir/apps/miniapp-taro/src/app.css 与
// tempDir/packages/design-tokens/src/styles/tokens.css 放置 fixture。
function createTempEnv(appCss, tokensCss) {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-miniapp-tokens-sync-'))
  // 复制源脚本到 tempDir/scripts/(不改源脚本,只读复制)
  mkdirSync(join(dir, 'scripts'), { recursive: true })
  copyFileSync(SOURCE_SCRIPT, join(dir, 'scripts', 'check-miniapp-tokens-sync.mjs'))
  // 写入 miniapp-taro/src/app.css fixture
  mkdirSync(join(dir, 'apps', 'miniapp-taro', 'src'), { recursive: true })
  writeFileSync(join(dir, 'apps', 'miniapp-taro', 'src', 'app.css'), appCss)
  // 写入 design-tokens/tokens.css fixture
  mkdirSync(join(dir, 'packages', 'design-tokens', 'src', 'styles'), { recursive: true })
  writeFileSync(
    join(dir, 'packages', 'design-tokens', 'src', 'styles', 'tokens.css'),
    tokensCss,
  )
  return dir
}

// ─── 辅助:运行复制的脚本 ───
function runScript(tempDir, args = []) {
  const scriptPath = join(tempDir, 'scripts', 'check-miniapp-tokens-sync.mjs')
  return spawnSync('node', [scriptPath, ...args], {
    cwd: tempDir,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

// ─── 辅助:断言通过(exit 0 + stdout 含 "in sync") ───
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

// ─── 辅助:断言不一致(exit 1 + stderr 含 "mismatch") ───
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
// 检查 1:CLI 标志 —— --quiet 抑制通过消息(仍 exit 0)
// ============================================================

// ─── 1. CLI: --quiet 同步时抑制 stdout 通过消息(仍 exit 0) ───
test('CLI: --quiet 同步时抑制 stdout 通过消息(仍 exit 0)', () => {
  const dir = createTempEnv(
    `:root {\n  --color-primary: #fff;\n}\n`,
    `:root {\n  --color-primary: #fff;\n}\n`,
  )
  try {
    const r = runScript(dir, ['--quiet'])
    assert.equal(r.status, 0, `--quiet 同步应 exit 0\nstdout: ${r.stdout}`)
    // --quiet 时不应输出通过消息
    assert.equal(
      r.stdout,
      '',
      `--quiet 应抑制 stdout,实际: ${r.stdout}`,
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 2. CLI: --staged 被接受(无操作,仍全量扫描)→ exit 0 ───
test('CLI: --staged 被接受(无操作)→ exit 0 同步消息', () => {
  const dir = createTempEnv(
    `:root {\n  --color-bg: #000;\n}\n`,
    `:root {\n  --color-bg: #000;\n}\n`,
  )
  try {
    const r = runScript(dir, ['--staged'])
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 2:核心规则 —— :root + .dark 全部同步 → exit 0
// ============================================================

// ─── 3. 核心: :root + .dark 全部同步 → exit 0 + 计数消息 ───
test('核心: :root + .dark 全部同步 → exit 0 + 计数消息', () => {
  const appCss = `:root {\n  --color-primary: #fff;\n  --color-bg: #000;\n}\n.dark {\n  --color-primary: #ccc;\n  --color-bg: #111;\n}\n`
  const tokensCss = `:root {\n  --color-primary: #fff;\n  --color-bg: #000;\n}\n.dark {\n  --color-primary: #ccc;\n  --color-bg: #111;\n}\n`
  const dir = createTempEnv(appCss, tokensCss)
  try {
    const r = runScript(dir)
    assertPass(r)
    // 通过消息应含变量总数(4 = 2 root + 2 dark)
    assert.match(r.stdout, /4 variables are in sync/, `stdout 应含 "4 variables"\nstdout: ${r.stdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 3:核心规则 —— :root 值不一致 → exit 1
// ============================================================

// ─── 4. 核心: :root 值不一致 → exit 1 + 报告 :root diff ───
test('核心: :root 值不一致 → exit 1 + 报告 :root diff', () => {
  const appCss = `:root {\n  --color-primary: #fff;\n}\n`
  const tokensCss = `:root {\n  --color-primary: #f5f5f5;\n}\n`
  const dir = createTempEnv(appCss, tokensCss)
  try {
    const r = runScript(dir)
    assertMismatch(r)
    // stderr 应含 :root 块标记
    assert.match(r.stderr, /:root block/, `stderr 应含 ":root block"\nstderr: ${r.stderr}`)
    // stderr 应含变量名 + 双方值
    assert.match(r.stderr, /--color-primary/, `stderr 应含 "--color-primary"\nstderr: ${r.stderr}`)
    assert.match(r.stderr, /#fff/, `stderr 应含 miniapp-taro 值 #fff\nstderr: ${r.stderr}`)
    assert.match(r.stderr, /#f5f5f5/, `stderr 应含 tokens 值 #f5f5f5\nstderr: ${r.stderr}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 4:核心规则 —— .dark 值不一致 → exit 1
// ============================================================

// ─── 5. 核心: .dark 值不一致 → exit 1 + 报告 .dark diff ───
test('核心: .dark 值不一致 → exit 1 + 报告 .dark diff', () => {
  const appCss = `:root {\n  --color-primary: #fff;\n}\n.dark {\n  --color-primary: #aaa;\n}\n`
  const tokensCss = `:root {\n  --color-primary: #fff;\n}\n.dark {\n  --color-primary: #bbb;\n}\n`
  const dir = createTempEnv(appCss, tokensCss)
  try {
    const r = runScript(dir)
    assertMismatch(r)
    // stderr 应含 .dark 块标记
    assert.match(r.stderr, /\.dark block/, `stderr 应含 ".dark block"\nstderr: ${r.stderr}`)
    assert.match(r.stderr, /#aaa/, `stderr 应含 miniapp-taro 值 #aaa\nstderr: ${r.stderr}`)
    assert.match(r.stderr, /#bbb/, `stderr 应含 tokens 值 #bbb\nstderr: ${r.stderr}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 5:核心规则 —— miniapp-taro 有变量但 tokens 缺失 → exit 1
// ============================================================

// ─── 6. 核心: :root 变量在 tokens 中缺失 → exit 1 + "<missing>" ───
test('核心: :root 变量在 tokens 中缺失 → exit 1 + "<missing>"', () => {
  const appCss = `:root {\n  --color-accent: #ff0;\n}\n`
  const tokensCss = `:root {\n  --color-other: #abc;\n}\n`
  const dir = createTempEnv(appCss, tokensCss)
  try {
    const r = runScript(dir)
    assertMismatch(r)
    // stderr 应含 <missing> 标记(tokens 中不存在该变量)
    assert.match(r.stderr, /<missing>/, `stderr 应含 "<missing>"\nstderr: ${r.stderr}`)
    assert.match(r.stderr, /--color-accent/, `stderr 应含 "--color-accent"\nstderr: ${r.stderr}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 7. 核心: .dark 变量在 tokens 中缺失 → exit 1 + "<missing>" ───
test('核心: .dark 变量在 tokens 中缺失 → exit 1 + "<missing>"', () => {
  const appCss = `:root {\n  --color-x: #000;\n}\n.dark {\n  --color-x: #111;\n}\n`
  const tokensCss = `:root {\n  --color-x: #000;\n}\n`
  const dir = createTempEnv(appCss, tokensCss)
  try {
    const r = runScript(dir)
    assertMismatch(r)
    assert.match(r.stderr, /\.dark block/, `stderr 应含 ".dark block"\nstderr: ${r.stderr}`)
    assert.match(r.stderr, /<missing>/, `stderr 应含 "<missing>"\nstderr: ${r.stderr}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 6:核心规则 —— tokens 有额外变量(miniapp-taro 无)→ exit 0
// ============================================================

// ─── 8. 核心: tokens 有额外变量(miniapp-taro 未复制)→ exit 0(子集检查) ───
test('核心: tokens 有额外变量(miniapp-taro 未复制)→ exit 0(子集检查)', () => {
  const appCss = `:root {\n  --color-primary: #fff;\n}\n`
  // tokens 含 miniapp-taro 没有的 --color-extra,不应触发不一致
  const tokensCss = `:root {\n  --color-primary: #fff;\n  --color-extra: #abc;\n}\n`
  const dir = createTempEnv(appCss, tokensCss)
  try {
    const r = runScript(dir)
    assertPass(r)
    // 计数应只算 miniapp-taro 的变量(1 个),不含 tokens 的额外变量
    assert.match(r.stdout, /1 variables are in sync/, `stdout 应含 "1 variables"\nstdout: ${r.stdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 7:语法支持 —— tokens.css 使用 @theme {} 语法
// ============================================================

// ─── 9. 语法: tokens.css 使用 @theme {} 语法 → 正确解析 ───
test('语法: tokens.css 使用 @theme {} 语法 → 正确解析,exit 0', () => {
  const appCss = `:root {\n  --color-primary: #fff;\n}\n`
  const tokensCss = `@theme {\n  --color-primary: #fff;\n}\n`
  const dir = createTempEnv(appCss, tokensCss)
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 8:语法支持 —— tokens.css 同时含 @theme + :root(合并)
// ============================================================

// ─── 10. 语法: tokens.css 同时含 @theme + :root(合并,后者覆盖前者)→ exit 0 ───
test('语法: tokens.css @theme + :root 合并(后者覆盖前者)→ exit 0', () => {
  const appCss = `:root {\n  --color-primary: #fff;\n  --color-bg: #000;\n}\n`
  // @theme 定义 --color-primary,:root 定义 --color-bg,合并后两者都在
  const tokensCss = `@theme {\n  --color-primary: #fff;\n}\n:root {\n  --color-bg: #000;\n}\n`
  const dir = createTempEnv(appCss, tokensCss)
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 9:边界 —— 两个文件都无 --color-* 变量 → exit 0(0 in sync)
// ============================================================

// ─── 11. 边界: 两文件均无 --color-* 变量 → exit 0(0 in sync) ───
test('边界: 两文件均无 --color-* 变量 → exit 0(0 in sync)', () => {
  const appCss = `:root {\n  --spacing-sm: 4px;\n}\n`
  const tokensCss = `:root {\n  --spacing-sm: 4px;\n}\n`
  const dir = createTempEnv(appCss, tokensCss)
  try {
    const r = runScript(dir)
    assert.equal(r.status, 0, `无 --color-* 变量应 exit 0\nstdout: ${r.stdout}`)
    assert.match(r.stdout, /0 variables are in sync/, `stdout 应含 "0 variables"\nstdout: ${r.stdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 10:边界 —— 多个 :root 块(后者覆盖前者)
// ============================================================

// ─── 12. 边界: tokens.css 含多个 :root 块(后者覆盖前者)→ 同步 ───
test('边界: tokens.css 多个 :root 块(后者覆盖)→ 同步 exit 0', () => {
  const appCss = `:root {\n  --color-primary: #final;\n}\n`
  // 第一个 :root 定义旧值,第二个 :root 覆盖为新值,合并后应取新值
  const tokensCss = `:root {\n  --color-primary: #old;\n}\n:root {\n  --color-primary: #final;\n}\n`
  const dir = createTempEnv(appCss, tokensCss)
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 11:边界 —— miniapp-taro 含多个 :root 块(后者覆盖前者)
// ============================================================

// ─── 13. 边界: miniapp-taro 多个 :root 块(后者覆盖)→ 用合并值比对 ───
test('边界: miniapp-taro 多个 :root 块(后者覆盖)→ 用合并值比对 exit 0', () => {
  // miniapp-taro 第一个块旧值,第二个块覆盖;tokens 只有最终值 → 同步
  const appCss = `:root {\n  --color-x: #old;\n}\n:root {\n  --color-x: #new;\n}\n`
  const tokensCss = `:root {\n  --color-x: #new;\n}\n`
  const dir = createTempEnv(appCss, tokensCss)
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 12:输出格式 —— 通过消息含检查提示 + 变量计数
// ============================================================

// ─── 14. 输出: 默认模式 stdout 含 "Checking" 提示 + "in sync" 计数 ───
test('输出: 默认模式 stdout 含 "Checking" 提示 + "in sync" 计数', () => {
  const appCss = `:root {\n  --color-a: #111;\n}\n.dark {\n  --color-a: #222;\n}\n`
  const tokensCss = `:root {\n  --color-a: #111;\n}\n.dark {\n  --color-a: #222;\n}\n`
  const dir = createTempEnv(appCss, tokensCss)
  try {
    const r = runScript(dir)
    assert.equal(r.status, 0, `应 exit 0\nstdout: ${r.stdout}`)
    // 默认模式应输出检查提示
    assert.match(r.stdout, /Checking/, `stdout 应含 "Checking" 提示\nstdout: ${r.stdout}`)
    // 应输出变量计数(2 = 1 root + 1 dark)
    assert.match(r.stdout, /2 variables are in sync/, `stdout 应含 "2 variables"\nstdout: ${r.stdout}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ============================================================
// 检查 13:边界 —— --quiet 不一致时仍输出错误(stderr 不受抑制)
// ============================================================

// ─── 15. 输出: --quiet 不一致时 stderr 仍输出错误(exit 1) ───
test('输出: --quiet 不一致时 stderr 仍输出错误(exit 1)', () => {
  const appCss = `:root {\n  --color-x: #aaa;\n}\n`
  const tokensCss = `:root {\n  --color-x: #bbb;\n}\n`
  const dir = createTempEnv(appCss, tokensCss)
  try {
    const r = runScript(dir, ['--quiet'])
    assert.equal(r.status, 1, `--quiet 不一致应 exit 1\nstderr: ${r.stderr}`)
    // --quiet 抑制 stdout 的 "Checking" 提示
    assert.equal(r.stdout, '', `--quiet 应抑制 stdout,实际: ${r.stdout}`)
    // 但 stderr 仍输出错误
    assert.match(r.stderr, /mismatch/, `stderr 应含 "mismatch"\nstderr: ${r.stderr}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
