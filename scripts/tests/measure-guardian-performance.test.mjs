import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = join(__dirname, '..', '..')
const SCRIPT = join(__dirname, '..', 'measure-guardian-performance.mjs')

// ============================================================
// 源脚本核心规则(scripts/measure-guardian-performance.mjs)
// ============================================================
// 守门项执行性能监控(P2-E)。
// - 从 guardian-runner.mjs 源码动态提取 checks 数组(不修改原文件)。
// - 默认跳过 blocking 模式的守门项(只测量 warn/info)。
// - 用 performance.now() 测量,spawnSync 子进程执行每个脚本。
// - CLI:--filter=<id> / --runs=<N>(默认 3) / --json / --threshold=<ms>(默认 5000) / --help。
// - 状态:OK(≤ 阈值)/ SLOW(> 阈值)/ FAIL(脚本崩溃/超时/exit >= 2)。
// - 退出码:0 测量完成,2 CLI 参数错误,3 guardian-runner.mjs 解析失败。
// ============================================================

/** 运行脚本并去除 ANSI 颜色码。 */
function runScript(args = []) {
  const r = spawnSync('node', [SCRIPT, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  r.cleanStdout = (r.stdout || '').replace(/\x1b\[[0-9;]*m/g, '')
  r.cleanStderr = (r.stderr || '').replace(/\x1b\[[0-9;]*m/g, '')
  return r
}

// ─── 1. CLI 行为 ─────────────────────────────────────────

test('CLI: --help → exit 0 + 含关键用法文本', () => {
  const r = runScript(['--help'])
  assert.equal(r.status, 0, `--help 应 exit 0\ncleanStdout: ${r.cleanStdout}`)
  assert.match(r.cleanStdout, /性能监控/)
  assert.match(r.cleanStdout, /--filter/)
  assert.match(r.cleanStdout, /--runs/)
  assert.match(r.cleanStdout, /--json/)
  assert.match(r.cleanStdout, /--threshold/)
})

test('CLI: -h 短选项等价 --help', () => {
  const r = runScript(['-h'])
  assert.equal(r.status, 0, `-h 应 exit 0\ncleanStdout: ${r.cleanStdout}`)
  assert.match(r.cleanStdout, /性能监控/)
})

test('CLI: --filter=nonexistent-id → exit 2 + "未匹配" + 可用 ID', () => {
  const r = runScript(['--filter=nonexistent-id'])
  assert.equal(r.status, 2, `不存在的 filter 应 exit 2\ncleanStderr: ${r.cleanStderr}`)
  assert.match(r.cleanStderr, /未匹配/)
  assert.match(r.cleanStderr, /可用 ID/)
})

test('CLI: --runs=0 → exit 2 + "正整数" 错误', () => {
  const r = runScript(['--runs=0'])
  assert.equal(r.status, 2, `--runs=0 应 exit 2`)
  assert.match(r.cleanStderr, /正整数/)
})

test('CLI: --runs=abc → exit 2 + "正整数" 错误', () => {
  const r = runScript(['--runs=abc'])
  assert.equal(r.status, 2, `--runs=abc 应 exit 2`)
  assert.match(r.cleanStderr, /正整数/)
})

test('CLI: --threshold=-1 → exit 2 + "非负整数" 错误', () => {
  const r = runScript(['--threshold=-1'])
  assert.equal(r.status, 2, `--threshold=-1 应 exit 2`)
  assert.match(r.cleanStderr, /非负整数/)
})

test('CLI: 未知参数 → exit 2 + "未知参数"', () => {
  const r = runScript(['--unknown-flag'])
  assert.equal(r.status, 2, `未知参数应 exit 2`)
  assert.match(r.cleanStderr, /未知参数/)
})

// ─── 2. 实际测量(--filter 限制范围,--runs=1 加速) ────────
// 使用 --filter=23(check-staged-files.mjs,info 模式,最快)

test('测量: --json --runs=1 --filter=23 → exit 0 + 有效 JSON + summary 结构', () => {
  const r = runScript(['--json', '--runs=1', '--filter=23'])
  assert.equal(r.status, 0, `JSON 测量应 exit 0\ncleanStderr: ${r.cleanStderr}`)
  let data
  try {
    data = JSON.parse(r.cleanStdout)
  } catch (e) {
    assert.fail(`--json 应输出有效 JSON: ${e.message}\ncleanStdout: ${r.cleanStdout}`)
  }
  assert.ok(data.summary, 'JSON 应含 summary 字段')
  assert.ok(data.items, 'JSON 应含 items 字段')
  assert.equal(data.summary.measured, 1, '应只测量 1 个项')
  assert.equal(data.items.length, 1, 'items 应只有 1 个元素')
  assert.equal(data.items[0].id, '23', '测量的项 ID 应为 23')
})

test('测量: --runs=1 --filter=23 → exit 0 + 表格输出 + "性能报告"', () => {
  const r = runScript(['--runs=1', '--filter=23'])
  assert.equal(r.status, 0, `表格模式应 exit 0\ncleanStderr: ${r.cleanStderr}`)
  assert.match(r.cleanStdout, /性能报告/)
  assert.match(r.cleanStdout, /23/)
})

test('测量: --threshold=0 --runs=1 --filter=23 → SLOW 状态(阈值 0)', () => {
  const r = runScript(['--json', '--runs=1', '--filter=23', '--threshold=0'])
  assert.equal(r.status, 0, `测量应 exit 0`)
  const data = JSON.parse(r.cleanStdout)
  // 阈值 0:avgMs > 0 → SLOW(脚本执行几乎必然 > 0ms)
  assert.ok(
    ['OK', 'SLOW'].includes(data.items[0].status),
    `状态应为 OK 或 SLOW,实际: ${data.items[0].status}`,
  )
  assert.equal(data.summary.thresholdMs, 0, 'thresholdMs 应为 0')
})

test('测量: --threshold=999999 --runs=1 --filter=23 → OK 状态(大阈值)', () => {
  const r = runScript(['--json', '--runs=1', '--filter=23', '--threshold=999999'])
  assert.equal(r.status, 0, `测量应 exit 0`)
  const data = JSON.parse(r.cleanStdout)
  assert.equal(
    data.items[0].status,
    'OK',
    `大阈值应标记 OK,实际: ${data.items[0].status}`,
  )
})

test('测量: --json items 结构含完整字段', () => {
  const r = runScript(['--json', '--runs=1', '--filter=23'])
  assert.equal(r.status, 0)
  const data = JSON.parse(r.cleanStdout)
  const item = data.items[0]
  assert.equal(typeof item.id, 'string', 'id 应为 string')
  assert.equal(typeof item.label, 'string', 'label 应为 string')
  assert.equal(typeof item.mode, 'string', 'mode 应为 string')
  assert.equal(typeof item.avgMs, 'number', 'avgMs 应为 number')
  assert.equal(typeof item.maxMs, 'number', 'maxMs 应为 number')
  assert.equal(typeof item.p95Ms, 'number', 'p95Ms 应为 number')
  assert.equal(typeof item.runs, 'number', 'runs 应为 number')
  assert.equal(typeof item.status, 'string', 'status 应为 string')
  assert.ok(
    item.errorMsg === null || typeof item.errorMsg === 'string',
    'errorMsg 应为 null 或 string',
  )
})

test('测量: --runs=2 → 每项运行 2 次', () => {
  const r = runScript(['--json', '--runs=2', '--filter=23'])
  assert.equal(r.status, 0)
  const data = JSON.parse(r.cleanStdout)
  assert.equal(data.items[0].runs, 2, `应运行 2 次,实际: ${data.items[0].runs}`)
})

test('测量: --json summary 含 slowest 字段', () => {
  const r = runScript(['--json', '--runs=1', '--filter=23'])
  assert.equal(r.status, 0)
  const data = JSON.parse(r.cleanStdout)
  assert.ok(data.summary.slowest, 'summary 应含 slowest 字段')
  assert.equal(data.summary.slowest.id, '23', 'slowest 应为测量的唯一项')
  assert.equal(typeof data.summary.slowest.avgMs, 'number', 'slowest.avgMs 应为 number')
})

test('测量: 表格模式含汇总信息(OK/SLOW/FAIL 计数 + 最慢项)', () => {
  const r = runScript(['--runs=1', '--filter=23'])
  assert.equal(r.status, 0)
  assert.match(r.cleanStdout, /汇总/)
  assert.match(r.cleanStdout, /OK/)
  assert.match(r.cleanStdout, /最慢/)
})
