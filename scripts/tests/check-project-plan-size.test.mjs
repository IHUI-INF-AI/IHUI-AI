// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { writeFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-project-plan-size.mjs')

// 源脚本常量(同步源代码 check-project-plan-size.mjs 第 21 行)
const WARN_BYTES = 500 * 1024 // 500KB

function createTempRoot() {
  return mkScratch('ihui-plan-size-')
}

// 运行脚本并去除 ANSI 颜色码
function runScript(cwd, args = []) {
  const r = spawnSync('node', [SCRIPT_PATH, ...args], {
    cwd,
    encoding: 'utf8',
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
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
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
  }
})

// ─── 4. 体积 > 阈值 → warn(warn-only 违规 exit 1) ────────

test('PROJECT_PLAN.md 体积 > 500KB → exit 1(warn-only)+ ⚠️ 警告', () => {
  const dir = createTempRoot()
  try {
    // 生成 500KB + 1KB 内容
    writePlan(dir, 'x'.repeat(WARN_BYTES + 1024))
    const r = runScript(dir)
    // 2026-08-19 起脚本有意 exit 1 供 runner 计 warning(依据:scripts/check-project-plan-size.mjs:51-53 注释 + runner id 13b mode=warn)
    assert.equal(r.status, 1, `warn-only 违规应 exit 1\nstdout: ${r.out}\nstderr: ${r.err}`)
    // warn 输出在 console.warn(stderr),源脚本第 46-54 行
    assert.match(r.err, /体积偏大/)
    assert.match(r.err, /warn-only/)
  } finally {
    rmScratch(dir)
  }
})

// ─── 4b. 出路必须与现状相符(2026-10-16 存档机制退役后,不得再引用已退役归档器)──────
// 根因:2026-09-25 立此锁时出路 = 探测归档器(archive-completed-tasks)并印其"实测"行;
// 2026-10-16 机主令"完成即删",归档器 / 守门 13c / pnpm archive 已整体拆除
// (实测 HEAD 与磁盘皆无 `scripts/archive-completed-tasks.mjs`)⇒ 再要 stderr 含"归档器实测"
// 就是钉一句永远跑不通的旧话(AGENTS.md §0.8)。判源在 check-project-plan-size.mjs(§22c):
// 本测试改为断言"与现状相符的可执行出路",阈值 500KB / warn 定级(exit 1 供 runner 计)一律不动。

test('warn 的出路必须与现状相符:给出可执行出路(完成即删+折同文行),不得再引用已退役归档器或旧死路', () => {
  const dir = createTempRoot()
  try {
    writePlan(dir, 'x'.repeat(WARN_BYTES + 1024))
    const r = runScript(dir)
    assert.equal(r.status, 1, 'warn-only 违规仍应 exit 1(本测试不得改退出语义)')
    // 现状可执行出路(§5e-1 可整改性 + §0.8 出路须跑得到):
    // 必须(a)给出一条出路、(b)与"完成即删"现状相符、(c)点名真实存在的折除命令。
    assert.match(r.err, /出路/, 'warn 必须给出一条出路')
    assert.match(r.err, /完成\(✅\)行直接删除/, '出路须与 2026-10-16"完成即删"现状相符')
    assert.match(
      r.err,
      /fold-identical-open-rows/,
      '出路必须点名真实存在的折除命令(scripts/plan-tasks-merge.mjs --fold-identical-open-rows)'
    )
    // 反向锁:旧"去归档"死路措辞不得回来(它会让人跑一条返回 0 / 已不存在的命令)。
    assert.doesNotMatch(
      r.err,
      /建议: 把已完成\(✅\)历史条目归档/,
      '旧那条"去归档"的死路措辞不得回来(它会让人跑一条返回 0 的命令)'
    )
    // 反向锁:不得再让用户去跑 2026-10-16 已退役删除的归档器。
    assert.doesNotMatch(
      r.err,
      /node scripts\/archive-completed-tasks/,
      '出路不得引用已退役删除的归档器 archive-completed-tasks'
    )
    // 若印「未判定」必须自带原因,不许只说"跑不了"(§0.3)。
    if (/未判定/.test(r.err)) assert.match(r.err, /未判定\(.+\)/, '未判定必须带括号里的原因')
  } finally {
    rmScratch(dir)
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
    rmScratch(dir)
  }
})

test('边界: 体积 = 500KB + 1 字节 → 触发 warn', () => {
  const dir = createTempRoot()
  try {
    writePlan(dir, 'x'.repeat(WARN_BYTES + 1))
    const stats = statSync(join(dir, 'PROJECT_PLAN.md'))
    assert.equal(stats.size, WARN_BYTES + 1)
    const r = runScript(dir)
    // 2026-08-19 起脚本有意 exit 1 供 runner 计 warning(依据:scripts/check-project-plan-size.mjs:51-53 注释 + runner id 13b mode=warn)
    assert.equal(r.status, 1, 'warn-only 违规应 exit 1')
    assert.match(r.err, /体积偏大/)
    assert.match(r.err, /warn-only/)
  } finally {
    rmScratch(dir)
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
    rmScratch(dir)
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
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
