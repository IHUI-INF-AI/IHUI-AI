import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-native-title-tooltip.mjs')

// ─── 辅助:创建临时扫描目录(含 apps/ 结构,用于全量模式) ─
function createTempScanDir(files) {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-title-'))
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = join(dir, relPath)
    mkdirSync(join(fullPath, '..'), { recursive: true })
    writeFileSync(fullPath, content)
  }
  return dir
}

// 辅助:运行脚本(全量模式,无 --staged)
function runScript(cwd) {
  return spawnSync('node', [SCRIPT_PATH], {
    cwd: cwd || process.cwd(),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

// 辅助:运行脚本 --staged
function runStaged(cwd) {
  return spawnSync('node', [SCRIPT_PATH, '--staged'], {
    cwd: cwd || process.cwd(),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

// 辅助:创建临时 git repo(含 baseline commit),用于 staged 模式测试
function createTempGitRepo(files) {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-title-git-'))
  spawnSync('git', ['init', '-q'], { cwd: dir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
  spawnSync('git', ['config', 'user.email', 'test@ihui.local'], { cwd: dir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
  spawnSync('git', ['config', 'user.name', 'Test'], { cwd: dir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
  spawnSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: dir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = join(dir, relPath)
    mkdirSync(join(fullPath, '..'), { recursive: true })
    writeFileSync(fullPath, content)
  }
  spawnSync('git', ['add', '-A'], { cwd: dir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
  spawnSync('git', ['commit', '-q', '-m', 'init'], { cwd: dir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
  return dir
}

// 辅助:在 git repo 中写入文件并 stage
function stageFile(repoDir, relPath, content) {
  const fullPath = join(repoDir, relPath)
  mkdirSync(join(fullPath, '..'), { recursive: true })
  writeFileSync(fullPath, content)
  spawnSync('git', ['add', relPath], { cwd: repoDir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })
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
    r.stdout.includes('✅ 原生 title tooltip 守门通过') || r.stdout.includes('违规数:   0 处'),
    `应无违规通过,实际 stdout:\n${r.stdout}`,
  )
}

// ─── 违规检测(全量模式 warn-only, exit 0) ──────────────
// 注:全量模式始终 exit 0(warn-only),通过 stdout 判断违规

test('违规: <Button title="编辑"> → stdout 报告 [title], exit 0(warn-only)', () => {
  const dir = createTempScanDir({
    'apps/web/BadButton.tsx': `export function BadButton() {\n  return <Button title="编辑">Edit</Button>\n}\n`,
  })
  try {
    const r = runScript(dir)
    assert.equal(r.status, 0, '全量模式应 exit 0(warn-only)')
    assertHasViolation(r, /\[title\]/)
    assert.match(r.stdout, /BadButton\.tsx/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('违规: <button title="...">(原生小写) → 报告 [title]', () => {
  const dir = createTempScanDir({
    'apps/web/NativeBtn.tsx': `export function NativeBtn() {\n  return <button title="提交">OK</button>\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertHasViolation(r, /\[title\]/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('违规: <td title={value}> → 报告 [title]', () => {
  const dir = createTempScanDir({
    'apps/web/Cell.tsx': `export function Cell({v}:{v:string}) {\n  return <td title={v}>{v}</td>\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertHasViolation(r, /\[title\]/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('违规: <div title="..."> → 报告 [title]', () => {
  const dir = createTempScanDir({
    'apps/web/DivHover.tsx': `export function DivHover() {\n  return <div title="提示">x</div>\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertHasViolation(r, /\[title\]/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('违规: span/a/img 多行各含 title → 报告 3 处违规', () => {
  const dir = createTempScanDir({
    'apps/web/Multi.tsx': `export function Multi() {\n  return (\n    <>\n      <span title="s">s</span>\n      <a title="a">a</a>\n      <img title="i" />\n    </>\n  )\n}\n`,
  })
  try {
    const r = runScript(dir)
    assert.equal(r.status, 0, '全量模式应 exit 0(warn-only)')
    assert.match(r.stdout, /违规数:\s+3\s+处/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 豁免场景 → 通过 ─────────────────────────────────────
// 注:源脚本 isViolation() 豁免 <Button asChild title> / <iframe title>(a11y) /
// <Document/html/head/title title>(SEO) / component prop title(Modal/Dialog/...)
// / 注释行(// /* *)

test('豁免: <Button asChild title="..."> → 无违规(asChild 透传)', () => {
  const dir = createTempScanDir({
    'apps/web/AsChild.tsx': `export function AsChild() {\n  return <Button asChild title="详情"><a href="/x">x</a></Button>\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('豁免: <iframe title="..."> → 无违规(a11y 必需,WCAG)', () => {
  const dir = createTempScanDir({
    'apps/web/Frame.tsx': `export function Frame() {\n  return <iframe title="视频" src="/v" />\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('豁免: <Modal title="..."> / <Dialog title="..."> → 无违规(component prop)', () => {
  const dir = createTempScanDir({
    'apps/web/Comp.tsx': `export function Comp() {\n  return (<><Modal title="标题" /><Dialog title="对话框" /></>)\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('豁免: <Document title="..."> / <html title="..."> → 无违规(SEO 元数据)', () => {
  const dir = createTempScanDir({
    'apps/web/SEO.tsx': `export function SEO() {\n  return (<><Document title="页面" /><html title="root" /></>)\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('豁免: 注释行 // <button title="..."> → 无违规(纯注释不检测)', () => {
  const dir = createTempScanDir({
    'apps/web/Comment.tsx': `// <button title="注释里的不算违规">x</button>\nexport function Comment() {\n  return <div>x</div>\n}\n`,
  })
  try {
    const r = runScript(dir)
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 边界场景 ────────────────────────────────────────────

test('边界: 空 .tsx 文件 → 无违规', () => {
  const dir = createTempScanDir({
    'apps/web/Empty.tsx': ``,
  })
  try {
    const r = runScript(dir)
    assert.equal(r.status, 0)
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('边界: 无 apps/packages 目录 → 扫描 0 文件 exit 0', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-title-empty-'))
  try {
    const r = runScript(dir)
    assert.equal(r.status, 0)
    assert.match(r.stdout, /扫描文件: 0/)
    assertPass(r)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('批量: apps/ 含 3 文件(2 违规 + 1 合法)→ 报告 2 违规,合法文件不入列表', () => {
  const dir = createTempScanDir({
    'apps/web/Bad1.tsx': `export function Bad1() {\n  return <div title="x">Bad</div>\n}\n`,
    'apps/web/Good.tsx': `export function Good() {\n  return <div>Good</div>\n}\n`,
    'apps/web/Bad2.tsx': `export function Bad2() {\n  return <span title="y">Bad2</span>\n}\n`,
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

// ─── staged 模式 ─────────────────────────────────────────

test('staged 模式: 空暂存区(无 .ts/.tsx 变更)→ exit 0 跳过', () => {
  const dir = createTempGitRepo({
    'apps/web/Base.tsx': `export function Base() {\n  return <div>Base</div>\n}\n`,
  })
  try {
    const r = runStaged(dir)
    assert.equal(r.status, 0, '空暂存区应 exit 0')
    assert.match(r.stdout, /跳过|暂存区无/, '应显示跳过消息')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// TODO: 源脚本 bug,待修复
// check-native-title-tooltip.mjs 的 getStagedAddedLines() 在 'diff --git' 行上
// 匹配 /\+\+\+\s+b\/(.+)$/,但 '+++' 是 git diff 输出中的独立行(紧跟 'diff --git' 后),
// 不在 'diff --git' 行上,导致 curFile 始终为 null → addedLinesMap 始终为空 → files
// 为空 → 脚本始终输出 "暂存区无 .ts/.tsx/.js/.jsx 变更,跳过" 并 exit 0(即使有违规文件)。
// 修复方法:把 '+++ b/' 解析从 'diff --git' 块中分离为独立判断
// (参考 check-rounded-full.mjs 已修复版本,2026-07-27 修复同款 bug)。
test('staged 模式(源脚本 bug,文档化): 暂存含 Button title 违规 → 实际 exit 0 跳过(应 exit 1)', () => {
  const dir = createTempGitRepo({
    'apps/web/Base.tsx': `export function Base() {\n  return <div>Base</div>\n}\n`,
  })
  try {
    stageFile(
      dir,
      'apps/web/Bad.tsx',
      `export function Bad() {\n  return <Button title="编辑">Edit</Button>\n}\n`,
    )
    const r = runStaged(dir)
    // BUG: 因 curFile 始终 null,files 为空,脚本输出"跳过"并 exit 0
    assert.equal(r.status, 0, '源脚本 bug:有违规也 exit 0(应 exit 1)')
    assert.match(r.stdout, /跳过|暂存区无/, '源脚本 bug:输出跳过消息(应报告违规)')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// TODO: 源脚本 bug 修复后,把本 todo 转为 regular test 并启用以下断言:
//   const dir = createTempGitRepo({ 'apps/web/Base.tsx': `...` })
//   stageFile(dir, 'apps/web/Bad.tsx', `...<Button title="编辑">Edit</Button>...`)
//   const r = runStaged(dir)
//   assert.equal(r.status, 1, 'staged 模式应检测到 Button title 违规并 exit 1')
//   assert.match(r.stdout, /\[title\]/, 'stdout 应报告 [title] 违规')
//   assert.match(r.stdout, /Bad\.tsx/, 'stdout 应列出违规文件 Bad.tsx')
test.todo('staged 模式(源脚本 bug 修复后): 暂存含 Button title 违规 → 应 exit 1')
