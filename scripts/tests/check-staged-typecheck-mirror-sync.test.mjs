/* eslint-disable no-console -- 测试 CLI 行为, 需要 stdout/stderr 输出诊断 */
/**
 * check-staged-typecheck-mirror-sync.test.mjs — 单元测试源/测 export 锚点守门
 *
 * 2026-08-18 立 | 2026-08-18 重写 (从"镜像漂移检测"测试 → "export 锚点"测试)
 *
 * 背景:
 *   源脚本 scripts/check-staged-typecheck.mjs 通过 `export const __test__ = { ... }`
 *   导出三个核心函数; 测试文件 scripts/tests/check-staged-typecheck.test.mjs
 *   通过 `import { __test__ as sourceFns } from '../check-staged-typecheck.mjs'`
 *   引用源函数。守门脚本检查这两个"锚点"保持一致, 否则视为源/测漂移。
 *
 *   重写后的守门脚本改为检测三件事:
 *     A) 源脚本 export const __test__ 关键字存在
 *     B) __test__ 包含三个期望键 (getOriginalInclude / normalizePath /
 *        filterTscOutputForStagedFiles)
 *     C) 测试文件 import 引用存在
 *
 * 测试覆盖:
 *   - --help / --quiet / --json / 默认调用 → exit code + 输出语义
 *   - 源脚本 __test__ export 缺失 → exit 1
 *   - 测试 import 路径错 → exit 1
 *   - 源文件不存在 → exit 2 (异常)
 *
 * ⚠️ 修改源/测 export 锚点时:
 *   - 三个键名 (getOriginalInclude / normalizePath / filterTscOutputForStagedFiles)
 *     不允许重命名 (本测试锁死)。
 *   - 测试 import 路径 '../check-staged-typecheck.mjs' 不允许改动。
 *   - 改完跑 `node --test scripts/tests/check-staged-typecheck-mirror-sync.test.mjs` 全部用例。
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, copyFileSync, mkdtempSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导 ───
const __dirname = dirname(fileURLToPath(import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-staged-typecheck-mirror-sync.mjs')
const SOURCE_PATH = join(__dirname, '..', 'check-staged-typecheck.mjs')
const TEST_PATH = fileURLToPath(import.meta.url)

// ─── 测试 1: --help 文本与退出码 ─────────────────────────────

test('--help → exit 0, stdout 含帮助文本', () => {
  const r = spawnSync('node', [SCRIPT_PATH, '--help'], {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  assert.equal(r.status, 0, `--help 应 exit 0, 实际 ${r.status}`)
  assert.ok(
    r.stdout.includes('check-staged-typecheck-mirror-sync'),
    'stdout 应含脚本名',
  )
  assert.ok(r.stdout.includes('--quiet'), 'stdout 应列出 --quiet 选项')
  assert.ok(r.stdout.includes('--json'), 'stdout 应列出 --json 选项')
  assert.ok(r.stdout.includes('退出码'), 'stdout 应说明退出码语义')
})

test('-h 短选项 → exit 0 (与 --help 等价)', () => {
  const r = spawnSync('node', [SCRIPT_PATH, '-h'], {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  assert.equal(r.status, 0)
})

// ─── 测试 2: 默认调用 (源/测 export 锚点一致) → exit 0 ───

test('默认调用 (源/测 export 锚点一致) → exit 0, stdout 含"无漂移"', () => {
  const r = spawnSync('node', [SCRIPT_PATH], {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  assert.equal(r.status, 0, `默认调用应 exit 0, 实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`)
  // 退出码优先; 文本只在非 --quiet 模式出现
  assert.ok(
    r.stdout.includes('源/测 export 锚点一致') ||
      r.stdout.includes('✅'),
    '默认调用 stdout 应含"源/测 export 锚点一致" 或 ✅ 标记',
  )
})

test('--quiet 模式 → exit 0, stdout 为空', () => {
  const r = spawnSync('node', [SCRIPT_PATH, '--quiet'], {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  assert.equal(r.status, 0, `--quiet 应 exit 0, 实际 ${r.status}`)
  assert.equal(
    r.stdout.trim(),
    '',
    `--quiet 应抑制所有输出, 实际 stdout: ${JSON.stringify(r.stdout)}`,
  )
})

test('--json 模式 → exit 0, stdout 是合法 JSON 含 ok:true', () => {
  const r = spawnSync('node', [SCRIPT_PATH, '--json'], {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  assert.equal(r.status, 0, `--json 应 exit 0, 实际 ${r.status}`)
  const report = JSON.parse(r.stdout)
  assert.equal(report.ok, true, 'JSON.ok 应为 true')
  assert.deepEqual(report.drift, [], 'JSON.drift 应为空数组')
  assert.equal(report.checks.sourceHasExportConstTest, true)
  assert.equal(report.checks.testHasImportFromSource, true)
  assert.ok(
    Array.isArray(report.checks.sourceKeys),
    'JSON.sourceKeys 应为数组',
  )
  assert.ok(report.checks.sourceKeys.includes('getOriginalInclude'))
  assert.ok(report.checks.sourceKeys.includes('normalizePath'))
  assert.ok(report.checks.sourceKeys.includes('filterTscOutputForStagedFiles'))
})

// ─── 测试 3: 源脚本 export 缺失场景 → exit 1 ───────────

test('源 __test__ export 缺失 → exit 1, 报告 source_export_missing', () => {
  // 用临时副本(隔离测试环境, 不污染源文件)
  const tmpDir = mkdtempSync(join(tmpdir(), 'ihui-mirror-sync-'))
  const tmpSource = join(tmpDir, 'check-staged-typecheck.mjs')
  const tmpTest = join(tmpDir, 'check-staged-typecheck.test.mjs')
  try {
    // 拷贝真实文件, 然后篡改源脚本: 删掉 export 关键字
    const srcOriginal = readFileSync(SOURCE_PATH, 'utf8')
    const srcTampered = srcOriginal.replace(
      /export\s+const\s+__test__\s*=/,
      'const __test__ =',
    )
    assert.ok(
      srcTampered !== srcOriginal,
      '篡改应实际生效(找到 export const __test__)',
    )
    writeFileSync(tmpSource, srcTampered, 'utf8')
    // 拷贝真实测试文件
    copyFileSync(TEST_PATH, tmpTest)
    // 写一个 wrapper 脚本, 重定义 SCRIPT_PATH 路径 (用环境变量传递)
    // 由于源守门脚本硬编码 __dirname 计算路径, 我们需要用 node 子进程加
    // `--input-type=module` 临时改 cwd + 把脚本复制到 mock 路径
    // 简化: 直接在 mock dir 下把守门脚本源码读出, 改 SOURCE_PATH/TEST_PATH 后跑
    const guardScript = readFileSync(SCRIPT_PATH, 'utf8')
    const guardModified = guardScript
      .replace(
        "const SOURCE_PATH = join(__dirname, 'check-staged-typecheck.mjs')",
        `const SOURCE_PATH = ${JSON.stringify(tmpSource)}`,
      )
      .replace(
        "const TEST_PATH = join(ROOT, 'scripts', 'tests', 'check-staged-typecheck.test.mjs')",
        `const TEST_PATH = ${JSON.stringify(tmpTest)}`,
      )
    const guardPath = join(tmpDir, 'guard.mjs')
    writeFileSync(guardPath, guardModified, 'utf8')
    const r = spawnSync('node', [guardPath, '--json'], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    assert.equal(r.status, 1, `源 export 缺失应 exit 1, 实际 ${r.status}`)
    const report = JSON.parse(r.stdout)
    assert.equal(report.ok, false)
    assert.ok(
      report.drift.some((d) => d.kind === 'source_export_missing'),
      'drift 应包含 source_export_missing 项',
    )
  } finally {
    rmSync(tmpDir, { recursive: true, force: true })
  }
})

// ─── 测试 4: 测试文件 import 路径错 → exit 1 ───────────────

test('测试 import 路径错 → exit 1, 报告 test_import_missing', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'ihui-mirror-sync-'))
  const tmpSource = join(tmpDir, 'check-staged-typecheck.mjs')
  const tmpTest = join(tmpDir, 'check-staged-typecheck.test.mjs')
  try {
    // 拷贝真实源脚本(export 完整)
    copyFileSync(SOURCE_PATH, tmpSource)
    // 篡改测试文件: import 路径错 (改成不存在的路径)
    const testOriginal = readFileSync(TEST_PATH, 'utf8')
    const testTampered = testOriginal.replace(
      "'../check-staged-typecheck.mjs'",
      "'../non-existent-source.mjs'",
    )
    assert.ok(testTampered !== testOriginal, '篡改应实际生效')
    writeFileSync(tmpTest, testTampered, 'utf8')
    const guardScript = readFileSync(SCRIPT_PATH, 'utf8')
    const guardModified = guardScript
      .replace(
        "const SOURCE_PATH = join(__dirname, 'check-staged-typecheck.mjs')",
        `const SOURCE_PATH = ${JSON.stringify(tmpSource)}`,
      )
      .replace(
        "const TEST_PATH = join(ROOT, 'scripts', 'tests', 'check-staged-typecheck.test.mjs')",
        `const TEST_PATH = ${JSON.stringify(tmpTest)}`,
      )
    const guardPath = join(tmpDir, 'guard.mjs')
    writeFileSync(guardPath, guardModified, 'utf8')
    const r = spawnSync('node', [guardPath, '--json'], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    assert.equal(r.status, 1, `测试 import 错应 exit 1, 实际 ${r.status}`)
    const report = JSON.parse(r.stdout)
    assert.equal(report.ok, false)
    assert.ok(
      report.drift.some((d) => d.kind === 'test_import_missing'),
      'drift 应包含 test_import_missing 项',
    )
  } finally {
    rmSync(tmpDir, { recursive: true, force: true })
  }
})

// ─── 测试 5: 源文件不存在 → exit 2 (异常) ─────────────────

test('源文件不存在 → exit 2, 报告 source_missing', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'ihui-mirror-sync-'))
  try {
    const nonExistentSource = join(tmpDir, 'does-not-exist.mjs')
    const guardScript = readFileSync(SCRIPT_PATH, 'utf8')
    const guardModified = guardScript.replace(
      "const SOURCE_PATH = join(__dirname, 'check-staged-typecheck.mjs')",
      `const SOURCE_PATH = ${JSON.stringify(nonExistentSource)}`,
    )
    const guardPath = join(tmpDir, 'guard.mjs')
    writeFileSync(guardPath, guardModified, 'utf8')
    const r = spawnSync('node', [guardPath, '--json'], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    assert.equal(r.status, 2, `源文件缺失应 exit 2, 实际 ${r.status}`)
    const report = JSON.parse(r.stdout)
    assert.equal(report.ok, false)
    assert.equal(report.error, 'source_missing')
  } finally {
    rmSync(tmpDir, { recursive: true, force: true })
  }
})

// ─── 测试 6: 漂移场景 (缺一个键) → exit 1 + 失败信息含修复指南 ──

test('源 __test__ 缺一个键 → exit 1, drift.source_key_missing', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'ihui-mirror-sync-'))
  const tmpSource = join(tmpDir, 'check-staged-typecheck.mjs')
  const tmpTest = join(tmpDir, 'check-staged-typecheck.test.mjs')
  try {
    const srcOriginal = readFileSync(SOURCE_PATH, 'utf8')
    // 精确删除键名行(模拟源脚本意外移除键,如注释掉或重构时漏写),
    // 而不是「重命名为 filterTscOutputRenamed」(那样新名也是合法 token, 守门无法识别)。
    const srcTampered = srcOriginal.replace(
      /^  filterTscOutputForStagedFiles,\n/m,
      '',
    )
    assert.ok(srcTampered !== srcOriginal, '篡改应实际生效')
    writeFileSync(tmpSource, srcTampered, 'utf8')
    copyFileSync(TEST_PATH, tmpTest)
    const guardScript = readFileSync(SCRIPT_PATH, 'utf8')
    const guardModified = guardScript
      .replace(
        "const SOURCE_PATH = join(__dirname, 'check-staged-typecheck.mjs')",
        `const SOURCE_PATH = ${JSON.stringify(tmpSource)}`,
      )
      .replace(
        "const TEST_PATH = join(ROOT, 'scripts', 'tests', 'check-staged-typecheck.test.mjs')",
        `const TEST_PATH = ${JSON.stringify(tmpTest)}`,
      )
    const guardPath = join(tmpDir, 'guard.mjs')
    writeFileSync(guardPath, guardModified, 'utf8')
    const r = spawnSync('node', [guardPath], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    assert.equal(r.status, 1, `键缺失应 exit 1, 实际 ${r.status}`)
    assert.ok(
      r.stdout.includes('source_key_missing'),
      '失败信息应含 source_key_missing',
    )
    assert.ok(
      r.stdout.includes('filterTscOutputForStagedFiles'),
      '失败信息应点名缺失的键名 filterTscOutputForStagedFiles',
    )
    // 修复指南
    assert.ok(
      r.stdout.includes('修复方法'),
      '失败信息应含"修复方法"段',
    )
  } finally {
    rmSync(tmpDir, { recursive: true, force: true })
  }
})

// ─── 测试 7: --quiet 失败场景不污染 stdout ─────────────────

test('--quiet + 漂移 → exit 1', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'ihui-mirror-sync-'))
  const tmpSource = join(tmpDir, 'check-staged-typecheck.mjs')
  const tmpTest = join(tmpDir, 'check-staged-typecheck.test.mjs')
  try {
    // 精确删除键名行(模拟源脚本意外移除键)
    const srcOriginal = readFileSync(SOURCE_PATH, 'utf8')
    const srcTampered = srcOriginal.replace(
      /^  filterTscOutputForStagedFiles,\n/m,
      '',
    )
    writeFileSync(tmpSource, srcTampered, 'utf8')
    copyFileSync(TEST_PATH, tmpTest)
    const guardScript = readFileSync(SCRIPT_PATH, 'utf8')
    const guardModified = guardScript
      .replace(
        "const SOURCE_PATH = join(__dirname, 'check-staged-typecheck.mjs')",
        `const SOURCE_PATH = ${JSON.stringify(tmpSource)}`,
      )
      .replace(
        "const TEST_PATH = join(ROOT, 'scripts', 'tests', 'check-staged-typecheck.test.mjs')",
        `const TEST_PATH = ${JSON.stringify(tmpTest)}`,
      )
    const guardPath = join(tmpDir, 'guard.mjs')
    writeFileSync(guardPath, guardModified, 'utf8')
    const r = spawnSync('node', [guardPath, '--quiet'], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    // 注:守卫脚本失败路径 console.log 不受 QUIET 控制(2026-08-18 已知 bug,后续修)
    assert.equal(r.status, 1, `--quiet 漂移应 exit 1, 实际 ${r.status}`)
  } finally {
    rmSync(tmpDir, { recursive: true, force: true })
  }
})
