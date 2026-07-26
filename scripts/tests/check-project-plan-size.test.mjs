import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-project-plan-size.mjs')

// 源脚本常量(同步源代码 check-project-plan-size.mjs 第 21 行)
const WARN_BYTES = 500 * 1024 // 500KB

function createTempRoot() {
  return mkdtempSync(join(tmpdir(), 'ihui-plan-size-'))
}

// 运行脚本并去除 ANSI 颜色码
function runScript(cwd, args = []) {
  const r = spawnSync('node', [SCRIPT_PATH, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  r.out = r.stdout.replace(/\x1b\[[0-9;]*m/g, '')
  r.err = r.stderr.replace(/\x1b\[[0-9;]*m/g, '')
  return r
}

function writePlan(root, content) {
  writeFileSync(join(root, 'PROJECT_PLAN.md'), content)
}

// ─── 1. CLI 行为 ─────────────────────────────────────────

test('CLI: --help 不崩溃(脚本未实现 --help,按默认模式运行)', () => {
  const dir = createTempRoot()
  try {
    const r = runScript(dir, ['--help'])
    assert.ok(r.status === 0, `--help 应 exit 0(warn-only 始终 exit 0),实际 ${r.status}`)
    assert.ok(!r.stderr.includes('Error:'), `--help 不应产生 Error`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 2. 文件不存在 → 跳过 ────────────────────────────────

test('PROJECT_PLAN.md 不存在 → exit 0 + 跳过消息', () => {
  const dir = createTempRoot()
  try {
    const r = runScript(dir)
    assert.equal(r.status, 0, `文件不存在应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /跳过/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 3. 体积 < 阈值 → 通过 ───────────────────────────────

test('PROJECT_PLAN.md 体积 < 500KB → exit 0 + ✅ 通过', () => {
  const dir = createTempRoot()
  try {
    // 1KB 内容
    writePlan(dir, '# PROJECT_PLAN\n\n'.repeat(50))
    const r = runScript(dir)
    assert.equal(r.status, 0, `小体积应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /体积信息/)
    assert.match(r.out, /warn-only/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('空文件(0 字节)→ exit 0', () => {
  const dir = createTempRoot()
  try {
    writePlan(dir, '')
    const r = runScript(dir)
    assert.equal(r.status, 0, `空文件应 exit 0\nstdout: ${r.out}`)
    assert.match(r.out, /0\.00 KB/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 4. 体积 > 阈值 → warn(仍 exit 0,warn-only) ────────

test('PROJECT_PLAN.md 体积 > 500KB → exit 0(warn-only)+ ⚠️ 警告', () => {
  const dir = createTempRoot()
  try {
    // 生成 500KB + 1KB 内容
    writePlan(dir, 'x'.repeat(WARN_BYTES + 1024))
    const r = runScript(dir)
    assert.equal(r.status, 0, `warn-only 始终 exit 0\nstdout: ${r.out}\nstderr: ${r.err}`)
    // warn 输出在 console.warn(stderr),源脚本第 42-46 行
    assert.match(r.err, /体积偏大|warn-only/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 5. 阈值边界 ────────────────────────────────────────

test('边界: 体积刚好 = 500KB → 不触发 warn(源脚本用 > 严格大于)', () => {
  const dir = createTempRoot()
  try {
    // 刚好 500KB
    writePlan(dir, 'x'.repeat(WARN_BYTES))
    const stats = statSync(join(dir, 'PROJECT_PLAN.md'))
    assert.equal(stats.size, WARN_BYTES, 'fixture 体积应为 500KB')
    const r = runScript(dir)
    assert.equal(r.status, 0)
    // 严格大于 → 刚好等于不触发 warn
    assert.match(r.out, /体积信息/)
    assert.doesNotMatch(r.err, /体积偏大/, '刚好等于阈值不应触发 warn')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('边界: 体积 = 500KB + 1 字节 → 触发 warn', () => {
  const dir = createTempRoot()
  try {
    writePlan(dir, 'x'.repeat(WARN_BYTES + 1))
    const stats = statSync(join(dir, 'PROJECT_PLAN.md'))
    assert.equal(stats.size, WARN_BYTES + 1)
    const r = runScript(dir)
    assert.equal(r.status, 0)
    assert.match(r.err, /体积偏大/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 6. 体积计算正确(字节 → KB) ─────────────────────────

test('体积计算: statSync().size 字节数正确转换为 KB(2 位小数)', () => {
  const dir = createTempRoot()
  try {
    // 1024 字节 = 1.00 KB
    writePlan(dir, 'x'.repeat(1024))
    const r = runScript(dir)
    assert.equal(r.status, 0)
    // 源脚本:(stats.size / 1024).toFixed(2)
    assert.match(r.out, /1\.00 KB/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 7. 输出格式 ────────────────────────────────────────

test('输出格式: 含 KB 数值 + 软参考阈值 + warn-only 标记', () => {
  const dir = createTempRoot()
  try {
    writePlan(dir, '# plan\n')
    const r = runScript(dir)
    assert.equal(r.status, 0)
    // 源脚本输出:"✅ PROJECT_PLAN.md 体积信息 (X.XX KB / 软参考 500 KB, warn-only)"
    assert.match(r.out, /KB/)
    assert.match(r.out, /软参考 500 KB/)
    assert.match(r.out, /warn-only/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
