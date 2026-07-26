import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-rounded-full.mjs')

// ─── 辅助:创建临时扫描目录(含 apps/ 结构,用于全量模式) ─
function createTempScanDir(files) {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-rounded-'))
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = join(dir, relPath)
    mkdirSync(join(fullPath, '..'), { recursive: true })
    writeFileSync(fullPath, content)
  }
  return dir
}

// 辅助:运行 check-rounded-full.mjs(全量模式,无 --staged)
function runScript(cwd) {
  return spawnSync('node', [SCRIPT_PATH], {
    cwd: cwd || process.cwd(),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

// 辅助:断言 stdout 含违规标记
function assertHasViolation(r, pattern) {
  assert.ok(
    r.stdout.includes('❌') || /发现\s+\d+\s+处违规/.test(r.stdout),
    `应报告违规,但未找到违规标记\nstdout: ${r.stdout}`,
  )
  if (pattern) {
    assert.match(r.stdout, pattern, `stdout 应含 ${pattern}`)
  }
}

// 辅助:断言 stdout 含通过标记(无违规)
function assertPass(r) {
  assert.ok(
    r.stdout.includes('✅ 容器圆角守门通过') || r.stdout.includes('违规数:   0 处'),
    `应无违规通过,实际 stdout:\n${r.stdout}`,
  )
}

// ─── 违规检测:rounded-full / rounded-pill / 9999px / 50% ──
// 注:全量模式始终 exit 0(warn-only),通过 stdout 判断违规

test('违规: className 含 rounded-full → stdout 报告违规', () => {
  const dir = createTempScanDir({
    'apps/web/Button.tsx': `export function Button() {\n  return <button className="rounded-full px-4 py-2">Click</button>\n}\n`,
  })
  try {
    const r = runScript(dir)
    assert.equal(r.status, 0, '全量模式应 exit 0(warn-only)')
    assertHasViolation(r, /rounded-full/)
    assert.match(r.stdout, /Button\.tsx/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('违规: className 含 rounded-pill → stdout 报告违规', () => {
  const dir = createTempScanDir({
    'apps/web/Pill.tsx': `export function Pill() {\n  return <span className="rounded-pill px-3 py-1">Tag</span>\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertHasViolation(r, /rounded-pill/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('违规: CSS border-radius: 9999px → stdout 报告违规', () => {
  const dir = createTempScanDir({
    'apps/web/styles.css': `.circle {\n  border-radius: 9999px;\n  width: 100px;\n  height: 100px;\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertHasViolation(r, /9999px/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('违规: CSS border-radius: 50% → stdout 报告违规', () => {
  const dir = createTempScanDir({
    'apps/web/circle.css': `.big-circle {\n  border-radius: 50%;\n  width: 200px;\n  height: 200px;\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertHasViolation(r, /50%/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('违规: border-radius:9999px(无空格) → 正则匹配', () => {
  const dir = createTempScanDir({
    'apps/web/no-space.css': `.no-space {\n  border-radius:9999px;\n  width: 80px;\n  height: 80px;\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertHasViolation(r, /9999px/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 合法圆角档位 → 通过 ─────────────────────────────────

test('合法: rounded-xl → 无违规', () => {
  const dir = createTempScanDir({
    'apps/web/Card.tsx': `export function Card() {\n  return <div className="rounded-xl border p-4">Content</div>\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('合法: rounded-2xl → 无违规', () => {
  const dir = createTempScanDir({
    'apps/web/Panel.tsx': `export function Panel() {\n  return <section className="rounded-2xl bg-card p-6">Panel</section>\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('合法: rounded-md → 无违规', () => {
  const dir = createTempScanDir({
    'apps/web/Input.tsx': `export function Input() {\n  return <input className="rounded-md border px-3 py-2" />\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 豁免场景 → 通过 ─────────────────────────────────────
// 注:源脚本 isExempt() 豁免 <img>/<Image>/AvatarImage(非 <Avatar>),
// Switch Thumb 特征串,小尺寸装饰点(w/h ≤ 3.5),红点(bg-red-500+小尺寸),animate-spin

test('豁免: <img className="rounded-full"> 头像图片 → 无违规', () => {
  const dir = createTempScanDir({
    'apps/web/Avatar.tsx': `export function Avatar() {\n  return <img className="rounded-full w-10 h-10" src="/avatar.png" alt="avatar" />\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('豁免: <Image className="rounded-full"> next/image → 无违规', () => {
  const dir = createTempScanDir({
    'apps/web/NextImage.tsx': `import Image from 'next/image'\nexport function Profile() {\n  return <Image className="rounded-full w-12 h-12" src="/me.png" alt="me" width={48} height={48} />\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('豁免: 装饰点 rounded-full w-2 h-2 → 无违规', () => {
  const dir = createTempScanDir({
    'apps/web/StatusDot.tsx': `export function StatusDot() {\n  return <span className="rounded-full bg-green-500 w-2 h-2" />\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('豁免: 红点 bg-red-500 rounded-full h-4 w-4 → 无违规', () => {
  const dir = createTempScanDir({
    'apps/web/UnreadBadge.tsx': `export function UnreadBadge() {\n  return <span className="bg-red-500 rounded-full h-4 w-4 text-xs">3</span>\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('豁免: Switch Thumb block rounded-full bg-background shadow-lg → 无违规', () => {
  const dir = createTempScanDir({
    'apps/web/Switch.tsx': `export function SwitchThumb() {\n  return (\n    <span className="block rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0" />\n  )\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('豁免: animate-spin + rounded-full → 无违规', () => {
  const dir = createTempScanDir({
    'apps/web/Spinner.tsx': `export function Spinner() {\n  return <div className="animate-spin rounded-full border-4 border-primary border-t-transparent h-8 w-8" />\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 非豁免场景使用 rounded-full → 违规 ──────────────────

test('非豁免: <Button className="rounded-full"> → 违规(容器禁用纯圆)', () => {
  const dir = createTempScanDir({
    'apps/web/RoundButton.tsx': `export function RoundButton() {\n  return <button className="rounded-full bg-primary px-6 py-3 text-white">Submit</button>\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertHasViolation(r, /rounded-full/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('非豁免: <Card className="rounded-full"> 大容器(flex-1+text-base) → 违规', () => {
  const dir = createTempScanDir({
    'apps/web/RoundCard.tsx': `export function RoundCard() {\n  return <div className="rounded-full p-8 flex-1 text-base">Card Content</div>\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertHasViolation(r, /rounded-full/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 多文件批量扫描 ───────────────────────────────────────

test('批量: apps/ 含 3 文件(2 违规 + 1 合法) → 报告 2 违规', () => {
  const dir = createTempScanDir({
    'apps/web/Bad1.tsx': `export function Bad1() {\n  return <div className="rounded-full p-4">Bad</div>\n}\n`,
    'apps/web/Good.tsx': `export function Good() {\n  return <div className="rounded-lg p-4">Good</div>\n}\n`,
    'apps/web/Bad2.tsx': `export function Bad2() {\n  return <span className="rounded-pill px-2">Bad2</span>\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertHasViolation(r)
    assert.match(r.stdout, /Bad1\.tsx/)
    assert.match(r.stdout, /Bad2\.tsx/)
    // Good.tsx 不应出现在违规文件列表中
    const violationSection = r.stdout.split('扫描结果:')[1] || ''
    const goodInViolation = /Good\.tsx/.test(violationSection.split('修复方法:')[0] || '')
    assert.ok(!goodInViolation, 'Good.tsx 不应出现在违规列表中')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── CLI 行为 ────────────────────────────────────────────

test('全量模式: 无 apps/packages 目录 → 扫描 0 文件 exit 0', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-rounded-empty-'))
  try {
    const r = runScript(dir)
    assert.equal(r.status, 0)
    assert.match(r.stdout, /扫描文件: 0/)
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('CLI --help 不崩溃(脚本未实现 --help flag,验证不 crash)', () => {
  // 注:源脚本未实现 --help,传入 --help 会按默认全量模式运行
  // 本测试验证不 crash(exit code 0/1),而非显示帮助文本
  const dir = mkdtempSync(join(tmpdir(), 'ihui-rounded-help-'))
  try {
    const r = spawnSync('node', [SCRIPT_PATH, '--help'], { cwd: dir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
    assert.ok(
      r.status === 0 || r.status === 1,
      `--help 不应导致 crash,实际 exit ${r.status}\nstderr: ${r.stderr}`,
    )
    assert.ok(!r.stderr.includes('Error:'), `--help 不应产生 Error 输出`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('注释行 // rounded-full → 豁免(纯注释不检测)', () => {
  const dir = createTempScanDir({
    'apps/web/Comment.tsx': `// 使用 rounded-full 是违规的,请用 rounded-lg\nexport function Comment() {\n  return <div className="rounded-lg p-4">OK</div>\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('CSS 小装饰点 border-radius:50% + width:8px + height:8px → 豁免', () => {
  const dir = createTempScanDir({
    'apps/web/dot.css': `.dot {\n  width: 8px;\n  height: 8px;\n  border-radius: 50%;\n  background: green;\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── staged 模式 bug 记录(源脚本 bug,不修改) ──────────
// 发现:源脚本 getStagedAddedLines() 在 'diff --git' 行上匹配 '\+\+\+\s+b\/(.+)$',
// 但 '+++' 是 diff 输出中的独立行,不在 'diff --git' 行上。
// 导致 staged 模式下 addedLinesMap 始终为空 → files 为空 → 脚本报
// "暂存区无 .ts/.tsx/.js/.jsx/.css/.scss 变更,跳过" 并 exit 0。
// 本测试记录此 bug,待源脚本修复后可移除。

test('已知 bug: staged 模式无法检测违规(getStagedAddedLines 正则错位)', () => {
  const dir = createTempScanDir({
    'apps/web/Bad.tsx': `export function Bad() {\n  return <div className="rounded-full p-4">Bad</div>\n}\n`,
  })
  try {
    const r = spawnSync('node', [SCRIPT_PATH, '--staged'], { cwd: dir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
    // bug:staged 模式总是跳过(exit 0),即使有违规文件
    assert.equal(r.status, 0, 'staged 模式因 bug 总是 exit 0')
    assert.match(r.stdout, /跳过|暂存区无/, '应显示跳过消息(bug 行为)')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
