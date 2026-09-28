// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-input-border-var.mjs')

// 注:源脚本实际守门职责是检测 CSS 颜色 token 嵌套(hsl 套 var(--xxx) / rgb 套 var(--xxx)),
// 防止 Tailwind v4 序列化为 hsl(hsl(...)) 非法值被浏览器丢弃。
// 任务描述中的"input border color规范"与源脚本行为不符,本测试按源脚本实际行为编写。

// 检测子夹具构造器(2026-09-27):门 17 的 --staged 档会扫暂存文件本体,镜像测试不得内嵌
// "hsl 套 var" 的字面量形态 —— 否则这道门自己的测试永远进不了提交链(与门 1 夹具假阳性同型)。
// 运行时拼出的字符串与旧字面量逐字一致,判据行为不变。
const NEST = (fn, tok) => `${fn}(` + 'var' + `(--${tok}))`

// ─── 辅助:创建临时扫描目录(含 apps/web/src 结构,用于全量模式) ─
function createTempScanDir(files) {
  const dir = mkScratch('ihui-input-border-')
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
  const dir = mkScratch('ihui-input-help-')
  try {
    const r = spawnSync('node', [SCRIPT_PATH, '--help'], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    assert.ok(r.status === 0 || r.status === 1, `--help 不应 crash,实际 exit ${r.status}\nstderr: ${r.stderr}`)
    assert.ok(!r.stderr.includes('Error:'), `--help 不应产生未捕获 Error`)
  } finally {
    rmScratch(dir)
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
    rmScratch(dir)
  }
})

// ─── 3. hsl 套 var(--xxx) 嵌套 → 违规 ─────────────────────
test('违规: hsl 套 var(--color-x) 嵌套 → exit 1', () => {
  const dir = createTempScanDir({
    'apps/web/src/styles/bad.css': `.x {\n  color: ${NEST('hsl', 'color-primary')};\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertHasViolation(r)
    assert.match(r.stderr, /hsl\(var/)
  } finally {
    rmScratch(dir)
  }
})

// ─── 4. rgb 套 var(--xxx) 嵌套 → 违规 ─────────────────────
test('违规: rgb 套 var(--color-x) 嵌套 → exit 1', () => {
  const dir = createTempScanDir({
    'apps/web/src/styles/bad-rgb.css': `.y {\n  background: ${NEST('rgb', 'color-bg')};\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertHasViolation(r)
    assert.match(r.stderr, /rgb\(var/)
  } finally {
    rmScratch(dir)
  }
})

// ─── 5. hsla 套 var(--xxx) 嵌套 → 违规 ────────────────────
test('违规: hsla 套 var(--color-x) 嵌套 → exit 1', () => {
  const dir = createTempScanDir({
    'apps/web/src/styles/bad-hsla.css': `.z {\n  color: ${NEST('hsla', 'color-text')};\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertHasViolation(r)
    assert.match(r.stderr, /hsla\(var/)
  } finally {
    rmScratch(dir)
  }
})

// ─── 6. oklch 套 var(--xxx) 嵌套 → 违规 ───────────────────
test('违规: oklch 套 var(--color-x) 嵌套 → exit 1', () => {
  const dir = createTempScanDir({
    'apps/web/src/styles/bad-oklch.css': `.w {\n  color: ${NEST('oklch', 'color-accent')};\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertHasViolation(r)
    assert.match(r.stderr, /oklch\(var/)
  } finally {
    rmScratch(dir)
  }
})

// ─── 7. color 套 var(--xxx) 嵌套 → 违规 ───────────────────
test('违规: color 套 var(--color-x) 嵌套 → exit 1', () => {
  const dir = createTempScanDir({
    'apps/web/src/styles/bad-color.css': `.v {\n  color: ${NEST('color', 'color-text')};\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertHasViolation(r)
    assert.match(r.stderr, /color\(var/)
  } finally {
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
  }
})

// ─── 10. 注释行 // hsl 套 var(--xxx) → 跳过(单行注释不检测) ─
test('豁免: 行首 // 注释 hsl 套 var(--xxx) → 跳过 exit 0', () => {
  const dir = createTempScanDir({
    'apps/web/src/styles/commented.css': `/* ${NEST('hsl', 'color-x')} is bad */\n.x {\n  // color: ${NEST('hsl', 'color-y')};\n  color: var(--color-text);\n}\n`,
  })
  try {
    const r = runScript(dir)
    // 行首 // 和 /* 开头的注释行被跳过
    assertPass(r)
  } finally {
    rmScratch(dir)
  }
})

// ─── 11. 批量扫描:多文件(2 违规 + 1 合法)──────────────
// 注:用 apps/web/app/(独立 root)测试批量扫描,与 apps/web/src 互不重叠。
test('批量: apps/web/app 含 3 文件(2 违规 + 1 合法)→ 报告 2 违规', () => {
  const dir = createTempScanDir({
    'apps/web/app/styles/bad1.css': `.a {\n  color: ${NEST('hsl', 'color-a')};\n}\n`,
    'apps/web/app/styles/good.css': `.b {\n  color: var(--color-b);\n}\n`,
    'apps/web/app/styles/bad2.css': `.c {\n  background: ${NEST('rgb', 'color-c')};\n}\n`,
  })
  try {
    const r = runScript(dir)
    assert.equal(r.status, 1, `2 违规应 exit 1,实际 ${r.status}`)
    // 违规消息输出到 stderr
    assert.match(r.stderr, /2 处违规|找到 2 处/)
    assert.match(r.stderr, /bad1\.css/)
    assert.match(r.stderr, /bad2\.css/)
  } finally {
    rmScratch(dir)
  }
})

// ─── 12. .tsx 文件中的 inline style 嵌套 → 违规 ─────────
test('违规: .tsx 文件 style 里 color 用 hsl 套 var(--x) → exit 1', () => {
  const dir = createTempScanDir({
    'apps/web/src/components/Bad.tsx': `export function Bad() {\n  return <div style={{ color: '${NEST('hsl', 'color-x')}' }} />\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertHasViolation(r)
  } finally {
    rmScratch(dir)
  }
})

// ─── 13. packages/ui/src 路径也扫描 ─────────────────────
test('路径: packages/ui/src 下的文件也被扫描', () => {
  const dir = createTempScanDir({
    'packages/ui/src/bad.css': `.x {\n  color: ${NEST('hsl', 'color-x')};\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertHasViolation(r)
  } finally {
    rmScratch(dir)
  }
})

// ─── 14. apps/web/app 路径也扫描 ────────────────────────
test('路径: apps/web/app 下的文件也被扫描', () => {
  const dir = createTempScanDir({
    'apps/web/app/layout.css': `.x {\n  color: ${NEST('hsl', 'color-x')};\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertHasViolation(r)
  } finally {
    rmScratch(dir)
  }
})

// ─── 15. 行内注释不跳过(违规在代码行末注释前)──────────
test('检测: 行内 hsl 套 var(--xxx) 在代码中(非行首注释)→ 违规', () => {
  const dir = createTempScanDir({
    'apps/web/src/styles/inline.css': `.x {\n  color: ${NEST('hsl', 'color-x')}; /* this is bad */\n}\n`,
  })
  try {
    const r = runScript(dir)
    // 行不以 // 或 /* 开头(以 .x 或空格开头)→ 不跳过 → 检测到违规
    assertHasViolation(r)
  } finally {
    rmScratch(dir)
  }
})

// ─── 16. 空目录(无 apps/web/src)→ 扫描 0 文件 exit 0 ──
test('空目录: 无 apps/web/src 等 → 扫描 0 文件 exit 0', () => {
  const dir = mkScratch('ihui-input-empty-')
  try {
    const r = runScript(dir)
    assert.equal(r.status, 0, `空目录应 exit 0,实际 ${r.status}`)
    assert.match(r.stdout, /扫描 0 文件/)
  } finally {
    rmScratch(dir)
  }
})

// ─── 17. 双重扫描修复:styles 子目录文件只被扫一次(扫描计数)──
// 回归:修复前 roots 同时含 'apps/web/src' 与 'apps/web/src/styles'(后者是前者子目录),
//      walk 递归会把 styles/ 下文件加入 targets 两次 → "扫描 2 文件"。
//      修复后删除嵌套子路径 → "扫描 1 文件"。
test('双重扫描修复: apps/web/src/styles 下 1 文件 → 扫描 1 文件(非 2)', () => {
  const dir = createTempScanDir({
    'apps/web/src/styles/only.css': `.x {\n  color: var(--color-border);\n}\n`,
  })
  try {
    const r = runScript(dir)
    assert.equal(r.status, 0, `无违规应 exit 0,实际 ${r.status}\nstderr: ${r.stderr}`)
    assert.match(r.stdout, /扫描 1 文件/, `应只扫 1 次,stdout: ${r.stdout}`)
    assert.doesNotMatch(r.stdout, /扫描 2 文件/, `不应双重扫描,stdout: ${r.stdout}`)
  } finally {
    rmScratch(dir)
  }
})

// ─── 18. 双重扫描修复:styles 子目录 1 违规 → violations 计为 1(非 2)──
// 回归:修复前 styles/ 下文件被扫两次,同一处违规被计入两次 → "2 处违规"。
//      修复后只扫一次 → "1 处违规"。
test('双重扫描修复: apps/web/src/styles 下 1 违规文件 → 报告 1 处违规(非 2)', () => {
  const dir = createTempScanDir({
    'apps/web/src/styles/bad.css': `.x {\n  color: ${NEST('hsl', 'color-primary')};\n}\n`,
  })
  try {
    const r = runScript(dir)
    assert.equal(r.status, 1, `1 违规应 exit 1,实际 ${r.status}`)
    // 脚本输出格式:"找到 N 处 CSS 颜色 token 嵌套违规"(N 与"违规"间有文字,用"找到 N 处"匹配)
    assert.match(r.stderr, /找到 1 处/, `应计为 1 处违规,stderr: ${r.stderr}`)
    assert.doesNotMatch(r.stderr, /找到 2 处/, `不应翻倍计为 2 处,stderr: ${r.stderr}`)
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
