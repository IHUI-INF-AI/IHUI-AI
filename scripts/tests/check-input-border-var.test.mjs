import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-input-border-var.mjs')

// 注:源脚本实际守门职责是检测 CSS 颜色 token 嵌套(hsl(var(--xxx)) / rgb(var(--xxx))),
// 防止 Tailwind v4 序列化为 hsl(hsl(...)) 非法值被浏览器丢弃。
// 任务描述中的"input border color规范"与源脚本行为不符,本测试按源脚本实际行为编写。

// ─── 辅助:创建临时扫描目录(含 apps/web/src 结构,用于全量模式) ─
function createTempScanDir(files) {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-input-border-'))
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = join(dir, relPath)
    mkdirSync(join(fullPath, '..'), { recursive: true })
    writeFileSync(fullPath, content)
  }
  return dir
}

// 辅助:运行 check-input-border-var.mjs(全量模式,无 --staged)
function runScript(cwd) {
  return spawnSync('node', [SCRIPT_PATH], {
    cwd: cwd || process.cwd(),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

// 辅助:断言违规(注:源脚本 violations 输出到 stderr via console.error)
function assertHasViolation(r) {
  assert.ok(
    r.status === 1,
    `应 exit 1(检测到违规),实际 exit ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
  )
  // 违规消息输出到 stderr(console.error)
  assert.match(r.stderr, /嵌套形式|违规/, `stderr 应含违规标记\nstderr: ${r.stderr}`)
}

// 辅助:断言通过(无违规)— 通过消息输出到 stdout(console.log)
function assertPass(r) {
  assert.ok(
    r.status === 0,
    `应 exit 0(无违规),实际 exit ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
  )
  assert.match(r.stdout, /✅.*通过|0 处违规/, `stdout 应含通过标记\nstdout: ${r.stdout}`)
}

// ─── 1. CLI --help 不崩溃(脚本未实现 --help,按默认模式运行) ─
test('CLI: --help 不崩溃(空目录 → 扫描 0 文件 exit 0)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-input-help-'))
  try {
    const r = spawnSync('node', [SCRIPT_PATH, '--help'], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    assert.ok(r.status === 0 || r.status === 1, `--help 不应 crash,实际 exit ${r.status}\nstderr: ${r.stderr}`)
    assert.ok(!r.stderr.includes('Error:'), `--help 不应产生未捕获 Error`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 2. var(--color-*) 直接引用 → 通过(正确写法)────────
test('合法: var(--color-border) 直接引用 → exit 0', () => {
  const dir = createTempScanDir({
    'apps/web/src/styles/tokens.css': `.border {\n  border-color: var(--color-border);\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 3. hsl(var(--xxx)) 嵌套 → 违规 ─────────────────────
test('违规: hsl(var(--color-x)) 嵌套 → exit 1', () => {
  const dir = createTempScanDir({
    'apps/web/src/styles/bad.css': `.x {\n  color: hsl(var(--color-primary));\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertHasViolation(r)
    assert.match(r.stderr, /hsl\(var/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 4. rgb(var(--xxx)) 嵌套 → 违规 ─────────────────────
test('违规: rgb(var(--color-x)) 嵌套 → exit 1', () => {
  const dir = createTempScanDir({
    'apps/web/src/styles/bad-rgb.css': `.y {\n  background: rgb(var(--color-bg));\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertHasViolation(r)
    assert.match(r.stderr, /rgb\(var/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 5. hsla(var(--xxx)) 嵌套 → 违规 ────────────────────
test('违规: hsla(var(--color-x)) 嵌套 → exit 1', () => {
  const dir = createTempScanDir({
    'apps/web/src/styles/bad-hsla.css': `.z {\n  color: hsla(var(--color-text));\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertHasViolation(r)
    assert.match(r.stderr, /hsla\(var/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 6. oklch(var(--xxx)) 嵌套 → 违规 ───────────────────
test('违规: oklch(var(--color-x)) 嵌套 → exit 1', () => {
  const dir = createTempScanDir({
    'apps/web/src/styles/bad-oklch.css': `.w {\n  color: oklch(var(--color-accent));\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertHasViolation(r)
    assert.match(r.stderr, /oklch\(var/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 7. color(var(--xxx)) 嵌套 → 违规 ───────────────────
test('违规: color(var(--color-x)) 嵌套 → exit 1', () => {
  const dir = createTempScanDir({
    'apps/web/src/styles/bad-color.css': `.v {\n  color: color(var(--color-text));\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertHasViolation(r)
    assert.match(r.stderr, /color\(var/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 8. 纯 hsl(120 50% 50%)(无 var 嵌套)→ 通过 ────────
test('合法: hsl(120 50% 50%) 纯字面量(无 var 嵌套)→ exit 0', () => {
  const dir = createTempScanDir({
    'apps/web/src/styles/literal.css': `.literal {\n  color: hsl(120 50% 50%);\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 9. color-mix(in srgb, var(--xxx) 60%, transparent) → 通过
test('合法: color-mix(in srgb, var(--color-x) 60%, transparent) → exit 0', () => {
  const dir = createTempScanDir({
    'apps/web/src/styles/mix.css': `.mix {\n  color: color-mix(in srgb, var(--color-primary) 60%, transparent);\n}\n`,
  })
  try {
    const r = runScript(dir)
    // color-mix 不匹配 NESTED_RE(因为 color-mix 后面不是 (var(--,而是 (in srgb, var(--)
    // 注:NESTED_RE = /\b(hsl|rgb|...|color)\(\s*var\(\s*--/g
    // color-mix( 不匹配(color-mix 不在交替组中,且 color( 后面是 mix 不是 var)
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 10. 注释行 // hsl(var(--xxx)) → 跳过(单行注释不检测) ─
test('豁免: 行首 // 注释 hsl(var(--xxx)) → 跳过 exit 0', () => {
  const dir = createTempScanDir({
    'apps/web/src/styles/commented.css': `/* hsl(var(--color-x)) is bad */\n.x {\n  // color: hsl(var(--color-y));\n  color: var(--color-text);\n}\n`,
  })
  try {
    const r = runScript(dir)
    // 行首 // 和 /* 开头的注释行被跳过
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 11. 批量扫描:多文件(2 违规 + 1 合法)──────────────
// 注:源脚本 roots 含 'apps/web/src' + 'apps/web/src/styles'(后者是前者子目录),
// 放在 styles/ 下的文件会被扫描两次(双重计数)。用 apps/web/app/ 避免重复扫描。
test('批量: apps/web/app 含 3 文件(2 违规 + 1 合法)→ 报告 2 违规', () => {
  const dir = createTempScanDir({
    'apps/web/app/styles/bad1.css': `.a {\n  color: hsl(var(--color-a));\n}\n`,
    'apps/web/app/styles/good.css': `.b {\n  color: var(--color-b);\n}\n`,
    'apps/web/app/styles/bad2.css': `.c {\n  background: rgb(var(--color-c));\n}\n`,
  })
  try {
    const r = runScript(dir)
    assert.equal(r.status, 1, `2 违规应 exit 1,实际 ${r.status}`)
    // 违规消息输出到 stderr
    assert.match(r.stderr, /2 处违规|找到 2 处/)
    assert.match(r.stderr, /bad1\.css/)
    assert.match(r.stderr, /bad2\.css/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 12. .tsx 文件中的 inline style 嵌套 → 违规 ─────────
test('违规: .tsx 文件 style={{ color: "hsl(var(--x))" }} → exit 1', () => {
  const dir = createTempScanDir({
    'apps/web/src/components/Bad.tsx': `export function Bad() {\n  return <div style={{ color: 'hsl(var(--color-x))' }} />\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertHasViolation(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 13. packages/ui/src 路径也扫描 ─────────────────────
test('路径: packages/ui/src 下的文件也被扫描', () => {
  const dir = createTempScanDir({
    'packages/ui/src/bad.css': `.x {\n  color: hsl(var(--color-x));\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertHasViolation(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 14. apps/web/app 路径也扫描 ────────────────────────
test('路径: apps/web/app 下的文件也被扫描', () => {
  const dir = createTempScanDir({
    'apps/web/app/layout.css': `.x {\n  color: hsl(var(--color-x));\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertHasViolation(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 15. 行内注释不跳过(违规在代码行末注释前)──────────
test('检测: 行内 hsl(var(--xxx)) 在代码中(非行首注释)→ 违规', () => {
  const dir = createTempScanDir({
    'apps/web/src/styles/inline.css': `.x {\n  color: hsl(var(--color-x)); /* this is bad */\n}\n`,
  })
  try {
    const r = runScript(dir)
    // 行不以 // 或 /* 开头(以 .x 或空格开头)→ 不跳过 → 检测到违规
    assertHasViolation(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 16. 空目录(无 apps/web/src)→ 扫描 0 文件 exit 0 ──
test('空目录: 无 apps/web/src 等 → 扫描 0 文件 exit 0', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-input-empty-'))
  try {
    const r = runScript(dir)
    assert.equal(r.status, 0, `空目录应 exit 0,实际 ${r.status}`)
    assert.match(r.stdout, /扫描 0 文件/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
