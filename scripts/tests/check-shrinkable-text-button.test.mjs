import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-shrinkable-text-button.mjs')

// ─── 辅助:创建临时扫描目录(含 apps/web 结构)─────────────
function createTempScanDir(files) {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-shrinkbtn-'))
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = join(dir, relPath)
    mkdirSync(join(fullPath, '..'), { recursive: true })
    writeFileSync(fullPath, content)
  }
  return dir
}

function runScript(cwd, extraArgs = []) {
  return spawnSync('node', [SCRIPT_PATH, ...extraArgs], {
    cwd: cwd || process.cwd(),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

// ─── CLI --help ───────────────────────────────────────────
test('CLI: --help 打印帮助并 exit 0', () => {
  const r = runScript(process.cwd(), ['--help'])
  assert.equal(r.status, 0, `--help 应 exit 0,实际 ${r.status}\nstderr: ${r.stderr}`)
  assert.match(r.stdout, /用法:/, '应打印用法')
  assert.match(r.stdout, /--scan/, '应列出 --scan 选项')
  assert.match(r.stdout, /--strict/, '应列出 --strict 选项')
  assert.match(r.stdout, /--quiet/, '应列出 --quiet 选项')
  assert.match(r.stdout, /--dry-run/, '应列出 --dry-run 选项')
})

test('CLI: -h 等同于 --help', () => {
  const r = runScript(process.cwd(), ['-h'])
  assert.equal(r.status, 0, `-h 应 exit 0,实际 ${r.status}`)
  assert.match(r.stdout, /用法:/)
})

// ─── 违规命中场景 ─────────────────────────────────────────
// 4 条 AND 规则 + 白名单

test('违规: <button> h-5 + text-[10px] + 中文 span + 缺 shrink-0/whitespace-nowrap → 命中', () => {
  const dir = createTempScanDir({
    'apps/web/Bad.tsx': `export function Bad() {\n  return <button type="button" className="inline-flex h-5 items-center gap-1 rounded-md px-1.5 text-[10px]"><span>对话流</span></button>\n}\n`,
  })
  try {
    const r = runScript(dir, ['--dry-run'])
    assert.equal(r.status, 0, '默认模式 warn-only,exit 0')
    assert.match(r.stderr, /发现 \d+ 处/)
    assert.match(r.stderr, /对话流/)
    assert.match(r.stderr, /shrink-0/)
    assert.match(r.stderr, /whitespace-nowrap/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('违规: 多行 className 表达式 cn(...) 内含 h-7 + text-xs + 中文 → 命中', () => {
  const dir = createTempScanDir({
    'apps/web/Cn.tsx': `import { cn } from '@/lib/utils'\nexport function Cn() {\n  return (\n    <button\n      type="button"\n      className={cn(\n        'flex h-7 items-center gap-1 rounded-md px-3 text-xs font-medium',\n        'bg-primary text-primary-foreground hover:bg-primary/90',\n      )}\n    >\n      <span>生成</span>\n    </button>\n  )\n}\n`,
  })
  try {
    const r = runScript(dir, ['--dry-run'])
    assert.equal(r.status, 0)
    assert.match(r.stderr, /生成/, '应识别中文 label')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('违规: <button> 含 h-6 + text-xs + 含 truncate(白名单)→ 跳过', () => {
  const dir = createTempScanDir({
    'apps/web/Truncate.tsx': `export function Truncate() {\n  return <button type="button" className="h-6 truncate text-xs"><span>长文本</span></button>\n}\n`,
  })
  try {
    const r = runScript(dir, ['--dry-run'])
    assert.equal(r.status, 0)
    // 应输出"通过"消息
    assert.match(r.stdout, /通过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('合法: <button> h-5 + text-[10px] + 中文 + 已含 shrink-0 和 whitespace-nowrap → 通过', () => {
  const dir = createTempScanDir({
    'apps/web/Ok.tsx': `export function Ok() {\n  return <button type="button" className="inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-1.5 text-[10px]"><span>对话流</span></button>\n}\n`,
  })
  try {
    const r = runScript(dir, ['--dry-run'])
    assert.equal(r.status, 0)
    assert.match(r.stdout, /通过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('合法: <button> h-5 + text-[10px] + icon-only(无中文 span)→ 跳过', () => {
  const dir = createTempScanDir({
    'apps/web/IconOnly.tsx': `export function IconOnly() {\n  return <button type="button" aria-label="关闭" className="h-5 w-5 text-[10px]"><X className="h-3 w-3" /></button>\n}\n`,
  })
  try {
    const r = runScript(dir, ['--dry-run'])
    assert.equal(r.status, 0)
    assert.match(r.stdout, /通过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('合法: <button> h-9 + text-sm(非极小字号)→ 跳过', () => {
  const dir = createTempScanDir({
    'apps/web/NotTiny.tsx': `export function NotTiny() {\n  return <button type="button" className="h-9 px-4 text-sm"><span>普通按钮</span></button>\n}\n`,
  })
  try {
    const r = runScript(dir, ['--dry-run'])
    assert.equal(r.status, 0)
    assert.match(r.stdout, /通过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('合法: <button> h-10 + text-xs(高度不在 h-4~h-8 范围)→ 跳过', () => {
  const dir = createTempScanDir({
    'apps/web/Tall.tsx': `export function Tall() {\n  return <button type="button" className="h-10 text-xs"><span>高按钮</span></button>\n}\n`,
  })
  try {
    const r = runScript(dir, ['--dry-run'])
    assert.equal(r.status, 0)
    assert.match(r.stdout, /通过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('合法: <button> h-5 + text-xs 但 span 含纯英文(非中文 label)→ 跳过', () => {
  const dir = createTempScanDir({
    'apps/web/English.tsx': `export function English() {\n  return <button type="button" className="h-5 text-xs"><span>Click me</span></button>\n}\n`,
  })
  try {
    const r = runScript(dir, ['--dry-run'])
    assert.equal(r.status, 0)
    assert.match(r.stdout, /通过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('合法: <button> h-5 + text-xs 含 1 个中文字(需 ≥2)→ 跳过', () => {
  const dir = createTempScanDir({
    'apps/web/OneChar.tsx': `export function OneChar() {\n  return <button type="button" className="h-5 text-xs"><span>关</span></button>\n}\n`,
  })
  try {
    const r = runScript(dir, ['--dry-run'])
    assert.equal(r.status, 0)
    assert.match(r.stdout, /通过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── JSON 输出 ────────────────────────────────────────────

test('--scan --output 写 JSON 文件', () => {
  const dir = createTempScanDir({
    'apps/web/Bad.tsx': `export function Bad() {\n  return <button type="button" className="inline-flex h-5 items-center gap-1 text-[10px]"><span>对话流</span></button>\n}\n`,
  })
  try {
    const outPath = join(dir, '.trae-cn/tmp/scan-button-wrap/output.json')
    const r = runScript(dir, ['--scan', '--output', outPath, '--quiet'])
    assert.equal(r.status, 0)
    const out = JSON.parse(readFileSync(outPath, 'utf8'))
    assert.equal(out.summary.totalHits, 1)
    assert.equal(out.hits.length, 1)
    assert.equal(out.hits[0].file, 'apps/web/Bad.tsx')
    assert.deepEqual(out.hits[0].missing, ['shrink-0', 'whitespace-nowrap'])
    assert.match(out.hits[0].label, /对话流/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('--scan 无 --output → stdout 输出 JSON', () => {
  const dir = createTempScanDir({
    'apps/web/Bad.tsx': `export function Bad() {\n  return <button type="button" className="h-5 text-[10px]"><span>测试</span></button>\n}\n`,
  })
  try {
    const r = runScript(dir, ['--scan'])
    assert.equal(r.status, 0)
    const out = JSON.parse(r.stdout)
    assert.ok(out.hits.length >= 1, '应至少 1 个命中')
    assert.ok(out.summary, '应包含 summary')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── --strict / --quiet ──────────────────────────────────

test('--strict: 命中即 exit 1', () => {
  const dir = createTempScanDir({
    'apps/web/Bad.tsx': `export function Bad() {\n  return <button type="button" className="h-5 text-[10px]"><span>测试</span></button>\n}\n`,
  })
  try {
    const r = runScript(dir, ['--dry-run', '--strict'])
    assert.equal(r.status, 1, '有命中且 --strict 应 exit 1')
    assert.match(r.stderr, /发现 1 处/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('--quiet: 只输出统计行', () => {
  const dir = createTempScanDir({
    'apps/web/Bad.tsx': `export function Bad() {\n  return <button type="button" className="h-5 text-[10px]"><span>测试</span></button>\n}\n`,
  })
  try {
    const r = runScript(dir, ['--dry-run', '--quiet'])
    assert.equal(r.status, 0)
    assert.match(r.stdout, /scanned=\d+/)
    assert.match(r.stdout, /hits=\d+/)
    // 不应包含违规详情
    assert.doesNotMatch(r.stdout, /className:/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── --path 自定义扫描路径 ───────────────────────────────

test('--path 限制只扫指定路径', () => {
  const dir = createTempScanDir({
    'apps/web/Bad.tsx': `export function Bad() {\n  return <button type="button" className="h-5 text-[10px]"><span>测试</span></button>\n}\n`,
    'apps/api/AlsoBad.tsx': `export function AlsoBad() {\n  return <button type="button" className="h-5 text-[10px]"><span>测试</span></button>\n}\n`,
  })
  try {
    const r = runScript(dir, ['--path', 'apps/web', '--dry-run', '--quiet'])
    assert.equal(r.status, 0)
    // 应只扫 apps/web,files=1
    assert.match(r.stdout, /files=1/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 嵌套 button 处理 ────────────────────────────────────

test('嵌套 button: 外层 button 缺规则,内层 button 命中 → 独立判定', () => {
  const dir = createTempScanDir({
    'apps/web/Nested.tsx': `export function Nested() {\n  return (\n    <div className="h-9 p-4 text-sm">\n      <button type="button" className="h-9 text-sm">\n        <span>外层</span>\n        <button type="button" className="h-5 text-[10px]">\n          <span>内层中文</span>\n        </button>\n      </button>\n    </div>\n  )\n}\n`,
  })
  try {
    const r = runScript(dir, ['--dry-run'])
    assert.equal(r.status, 0)
    // 应只命中内层(h-5 + text-[10px] + 中文)
    assert.match(r.stderr, /内层中文/)
    assert.doesNotMatch(r.stderr, /"外层"/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 空目录 / 不存在路径 ────────────────────────────────

test('空目录: 无 apps/packages 目录 → 扫描 0 文件 exit 0', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-shrinkbtn-empty-'))
  try {
    const r = runScript(dir, ['--dry-run'])
    assert.equal(r.status, 0)
    assert.match(r.stdout, /通过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 参数错误 ─────────────────────────────────────────────

test('错误: --output 无参数 → exit 2', () => {
  const r = runScript(process.cwd(), ['--output'])
  assert.equal(r.status, 2, '--output 无参数应 exit 2')
  assert.match(r.stderr, /--output.*需要/)
})

test('错误: --path 无参数 → exit 2', () => {
  const r = runScript(process.cwd(), ['--path'])
  assert.equal(r.status, 2, '--path 无参数应 exit 2')
  assert.match(r.stderr, /--path.*需要/)
})

// ─── 已修复参考点(回归测试)───────────────────────────────
// 真实修复案例:apps/web/src/components/ai/agent-task-progress-pane.tsx "对话流" / "时间线" tab 按钮
// 修复后 className 含 shrink-0 + whitespace-nowrap → 不应命中
test('回归: 含 shrink-0 + whitespace-nowrap 的 "对话流" 按钮 → 通过', () => {
  const dir = createTempScanDir({
    'apps/web/Tab.tsx': `export function Tab() {\n  return (\n    <button\n      type="button"\n      role="tab"\n      className="inline-flex h-5 shrink-0 items-center gap-0.5 whitespace-nowrap rounded-sm px-1 text-[10px] font-medium transition-colors"\n    >\n      <Icon className="h-2.5 w-2.5" aria-hidden />\n      <span>对话流</span>\n    </button>\n  )\n}\n`,
  })
  try {
    const r = runScript(dir, ['--dry-run'])
    assert.equal(r.status, 0)
    assert.match(r.stdout, /通过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
