import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-overlay-zindex.mjs')

// 注:源脚本实际守门职责是检测 fixed inset-0 + 视觉遮罩背景(bg-black/N 等)
// + 禁止 z 类(z-0/10/20/30/40/50)三者同时满足的违规。
// 任务描述中的"z-index 梯度(base/dropdown/modal/toast/tooltip)"与源脚本行为不符,
// 源脚本不区分组件类型,只检测上述三条件组合。本测试按源脚本实际行为编写。

// ─── 辅助:创建临时扫描目录(含 apps/web 结构)────────────
function createTempScanDir(files) {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-overlay-z-'))
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = join(dir, relPath)
    mkdirSync(join(fullPath, '..'), { recursive: true })
    writeFileSync(fullPath, content)
  }
  return dir
}

// 辅助:运行 check-overlay-zindex.mjs
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
  assert.match(r.stderr, /违规|检查失败/, `stderr 应含违规标记\nstderr: ${r.stderr}`)
}

// 辅助:断言通过(无违规)— 通过消息输出到 stdout(console.log)
function assertPass(r) {
  assert.ok(
    r.status === 0,
    `应 exit 0(无违规),实际 exit ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
  )
  assert.match(r.stdout, /✅.*通过|z-index 检查通过/, `stdout 应含通过标记\nstdout: ${r.stdout}`)
}

// ─── 1. CLI --help 不崩溃(脚本未实现 --help,按默认模式运行) ─
test('CLI: --help 不崩溃(空目录 → exit 0)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-overlay-help-'))
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

// ─── 2. fixed inset-0 bg-black/50 z-50 → 违规(三条件满足) ─
test('违规: fixed inset-0 bg-black/50 z-50 → exit 1', () => {
  const dir = createTempScanDir({
    'apps/web/components/Overlay.tsx': `export function Overlay() {\n  return <div className="fixed inset-0 bg-black/50 z-50" />\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertHasViolation(r)
    assert.match(r.stderr, /z-50/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 3. fixed inset-0 bg-black/50 z-10 → 违规(z-10 也是禁止类) ─
test('违规: fixed inset-0 bg-black/50 z-10 → exit 1', () => {
  const dir = createTempScanDir({
    'apps/web/components/LowZ.tsx': `export function LowZ() {\n  return <div className="fixed inset-0 bg-black/50 z-10" />\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertHasViolation(r)
    assert.match(r.stderr, /z-10/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 4. fixed inset-0 bg-black/50 z-modal → 通过(z-modal 不在禁止列表) ─
test('合法: fixed inset-0 bg-black/50 z-modal → exit 0', () => {
  const dir = createTempScanDir({
    'apps/web/components/Modal.tsx': `export function Modal() {\n  return <div className="fixed inset-0 bg-black/50 z-modal" />\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 5. fixed inset-0 bg-black/50(无 z 类)→ 通过(无禁止 z) ─
test('合法: fixed inset-0 bg-black/50(无 z 类)→ exit 0', () => {
  const dir = createTempScanDir({
    'apps/web/components/NoZ.tsx': `export function NoZ() {\n  return <div className="fixed inset-0 bg-black/50" />\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 6. fixed inset-0 z-50(无 bg-black 背景)→ 通过(透明点击捕获层) ─
test('合法: fixed inset-0 z-50(无视觉遮罩背景)→ exit 0(透明点击层)', () => {
  const dir = createTempScanDir({
    'apps/web/components/Capture.tsx': `export function Capture() {\n  return <div className="fixed inset-0 z-50" />\n}\n`,
  })
  try {
    const r = runScript(dir)
    // 无 bg-black 等视觉遮罩背景 → 不在守门范围(透明点击捕获层)
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 7. inset-0 bg-black/50 z-50(无 fixed)→ 通过(非全屏遮罩) ─
test('合法: inset-0 bg-black/50 z-50(无 fixed)→ exit 0', () => {
  const dir = createTempScanDir({
    'apps/web/components/NoFixed.tsx': `export function NoFixed() {\n  return <div className="inset-0 bg-black/50 z-50" />\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 8. fixed bg-black/50 z-50(无 inset-0)→ 通过(非全屏) ─
test('合法: fixed bg-black/50 z-50(无 inset-0)→ exit 0', () => {
  const dir = createTempScanDir({
    'apps/web/components/NoInset.tsx': `export function NoInset() {\n  return <div className="fixed bg-black/50 z-50" />\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 9. fixed inset-0 bg-slate-900/80 z-40 → 违规(slate 视觉遮罩) ─
test('违规: fixed inset-0 bg-slate-900/80 z-40 → exit 1(slate 遮罩)', () => {
  const dir = createTempScanDir({
    'apps/web/components/Slate.tsx': `export function Slate() {\n  return <div className="fixed inset-0 bg-slate-900/80 z-40" />\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertHasViolation(r)
    assert.match(r.stderr, /z-40/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 10. fixed inset-0 bg-background/90 z-30 → 违规(background 遮罩) ─
test('违规: fixed inset-0 bg-background/90 z-30 → exit 1(background 遮罩)', () => {
  const dir = createTempScanDir({
    'apps/web/components/Bg90.tsx': `export function Bg90() {\n  return <div className="fixed inset-0 bg-background/90 z-30" />\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertHasViolation(r)
    assert.match(r.stderr, /z-30/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 11. 批量扫描:多文件(2 违规 + 1 合法)──────────────
test('批量: apps/web 含 3 文件(2 违规 + 1 合法)→ 报告 2 违规', () => {
  const dir = createTempScanDir({
    'apps/web/components/Bad1.tsx': `export function Bad1() {\n  return <div className="fixed inset-0 bg-black/50 z-50" />\n}\n`,
    'apps/web/components/Good.tsx': `export function Good() {\n  return <div className="fixed inset-0 bg-black/50 z-modal" />\n}\n`,
    'apps/web/components/Bad2.tsx': `export function Bad2() {\n  return <div className="fixed inset-0 bg-black/60 z-40" />\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertHasViolation(r)
    // 注:源脚本输出含 ANSI 颜色码(如 \x1B[1m2\x1B[0m),strip 后再匹配
    const cleanStderr = r.stderr.replace(/\x1B\[[0-9;]*m/g, '')
    assert.match(cleanStderr, /发现 2 处违规|2 处违规/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 12. z-0 也是禁止类 ────────────────────────────────
test('违规: fixed inset-0 bg-black/50 z-0 → exit 1(z-0 禁止)', () => {
  const dir = createTempScanDir({
    'apps/web/components/Zero.tsx': `export function Zero() {\n  return <div className="fixed inset-0 bg-black/50 z-0" />\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertHasViolation(r)
    assert.match(r.stderr, /z-0/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 13. z-100 不在禁止列表(禁止列表只有 z-0/10/20/30/40/50) ─
test('合法: fixed inset-0 bg-black/50 z-100 → exit 0(z-100 不在禁止列表)', () => {
  const dir = createTempScanDir({
    'apps/web/components/Z100.tsx': `export function Z100() {\n  return <div className="fixed inset-0 bg-black/50 z-100" />\n}\n`,
  })
  try {
    const r = runScript(dir)
    // z-100 不匹配 \bz-10\b(z-100 中 z-10 后还有 0,无词边界)
    // 也不匹配 \bz-100\b(不在 FORBIDDEN_Z_CLASSES)
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 14. packages/ui-react/src 路径也扫描 ───────────────
test('路径: packages/ui-react/src 下的文件也被扫描', () => {
  const dir = createTempScanDir({
    'packages/ui-react/src/Overlay.tsx': `export function Overlay() {\n  return <div className="fixed inset-0 bg-black/50 z-50" />\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertHasViolation(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 15. bg-zinc-900/80 视觉遮罩 → 违规 ─────────────────
test('违规: fixed inset-0 bg-zinc-900/80 z-20 → exit 1(zinc 遮罩)', () => {
  const dir = createTempScanDir({
    'apps/web/components/Zinc.tsx': `export function Zinc() {\n  return <div className="fixed inset-0 bg-zinc-900/80 z-20" />\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertHasViolation(r)
    assert.match(r.stderr, /z-20/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 16. 空目录(无 apps/web)→ 扫描 0 文件 exit 0 ──────
test('空目录: 无 apps/web → 扫描 0 文件 exit 0', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-overlay-empty-'))
  try {
    const r = runScript(dir)
    assert.equal(r.status, 0, `空目录应 exit 0,实际 ${r.status}`)
    assert.match(r.stdout, /扫描 0 文件|扫描.*文件/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 17. .css 文件中的 z-index(注:源脚本只检测 className z 类,不检测 CSS z-index) ─
test('注: .css 文件 z-index: 9999 不被检测(源脚本只检测 className z 类)→ exit 0', () => {
  const dir = createTempScanDir({
    'apps/web/styles/modal.css': `.modal {\n  position: fixed;\n  inset: 0;\n  z-index: 9999;\n  background: rgba(0,0,0,0.5);\n}\n`,
  })
  try {
    const r = runScript(dir)
    // 源脚本只检测 className 中的 z-N 类,不检测 CSS z-index 属性
    // 注:这是源脚本的已知行为(只覆盖 Tailwind z 类,不覆盖原生 CSS)
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
