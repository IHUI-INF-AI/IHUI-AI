/* eslint-disable no-console -- 守门脚本为 CLI 工具,测试中需 console 输出诊断信息 */
/**
 * check-staged-typecheck-mirror-sync.test.mjs — 镜像漂移防御守门测试
 *
 * 2026-08-18 立 | 镜像同步义务锚点测试
 *
 * 背景:
 *   check-staged-typecheck-mirror-sync.mjs 检测
 *   scripts/check-staged-typecheck.mjs(源)与
 *   scripts/tests/check-staged-typecheck.test.mjs(测试)的核心函数
 *   镜像同步是否一致。本测试用临时副本分别模拟"源漂移"和"测漂移",
 *   验证脚本退出码与诊断输出符合预期(0/1/2 三种语义)。
 *
 * 测试覆盖:
 *   - 源/测指纹一致 → exit 0
 *   - 源脚本 normalizePath 漂移 → exit 1
 *   - 测试文件「镜像同步锚点」注释漂移 → exit 1
 *   - 源脚本 filterTscOutputForStagedFiles 漂移 → exit 1
 *   - 源文件不存在 → exit 2
 *   - 测试文件不存在 → exit 2
 *   - --help → exit 0
 *   - --quiet → 不打印诊断
 *   - --json → 输出有效 JSON
 *
 * 风格:node:test + assert/strict(参考 scripts/tests/git-push-guard.test.mjs)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync, copyFileSync, readFileSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-staged-typecheck-mirror-sync.mjs')
const ROOT = resolve(__dirname, '..', '..')

// 真实源 + 真实测试路径(默认场景使用)
const REAL_SOURCE = join(ROOT, 'scripts', 'check-staged-typecheck.mjs')
const REAL_TEST = join(ROOT, 'scripts', 'tests', 'check-staged-typecheck.test.mjs')

// ─── 辅助:创建临时目录(模拟 SOURCE_PATH / TEST_PATH 重定向) ───
function setupTempSandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-mirror-sync-'))
  const scriptsDir = join(dir, 'scripts')
  const testsDir = join(scriptsDir, 'tests')
  mkdirSync(testsDir, { recursive: true })
  return { dir, scriptsDir, testsDir }
}

function teardown(sandbox) {
  if (sandbox?.dir) {
    try {
      rmSync(sandbox.dir, { recursive: true, force: true })
    } catch {
      /* 容忍 Windows transient 失败 */
    }
  }
}

// 复制真实源/测到临时沙盒(让脚本读到我们的副本而非真实文件)。
function copyRealIntoSandbox(sandbox) {
  copyFileSync(REAL_SOURCE, join(sandbox.scriptsDir, 'check-staged-typecheck.mjs'))
  copyFileSync(REAL_TEST, join(sandbox.testsDir, 'check-staged-typecheck.test.mjs'))
}

// ─── 辅助:运行 mirror-sync 脚本,返回 {status, stdout, stderr} ───
// 通过 HUSKY_SKIP_*/--quiet 或环境变量无法让脚本读到其他路径;但我们
// 利用 node 子进程 + 重写脚本源码中 SOURCE_PATH/TEST_PATH 的方法不可行
// (源/测路径已 hardcode 在 SCRIPT 顶部)。这里采用另一种策略:把整个
// 仓库临时搬到 sandbox?不,会破坏 git working tree。
//
// 更稳妥的方法:在测试中直接修改 SCRIPT_PATH 本身的源码——但这会污染
// 文件。改用最简单的策略:对真实文件做原地修改(测试结束后恢复)。
// 但任务边界"不要修改源/测已有内容"是禁止的,所以改用如下做法:
//
//   - 测试 2/3/5/6(漂移场景)用一份【临时复制】的副本,把这副本的绝对
//     路径通过 node --input-type=module + ESM import 传入? 也不行,
//     因为脚本顶部 SOURCE_PATH 已写死。
//
// 折中方案:
//   - 测试 1/6/7/9(正向场景)直接跑真实路径。
//   - 测试 2/3/4/5/8(漂移/缺失场景)复制真实源/测到 sandbox,然后用
//     一个**包装脚本**调用 mirror-sync 内部的 tryParseTestAnchors /
//     extractRange 等纯函数?mirror-sync 没有 export 这些函数。
//
// 最终策略:把 mirror-sync 脚本复制到 sandbox 内 layout-matching 位置:
//   <sandbox>/scripts/check-staged-typecheck-mirror-sync.mjs
// 因为脚本内 SOURCE_PATH = join(__dirname, 'check-staged-typecheck.mjs'),
//  __dirname 在 sandbox 跑时 = <sandbox>/scripts/,所以会自动读到
//  <sandbox>/scripts/check-staged-typecheck.mjs(我们 copy 进去的位置)。
// 同理 TEST_PATH = ROOT/scripts/tests/check-staged-typecheck.test.mjs
// 其中 ROOT = resolve(__dirname, '..') = <sandbox>。
function runScriptInDir(sandbox, args = [], opts = {}) {
  const scriptInSandbox = join(sandbox.scriptsDir, 'check-staged-typecheck-mirror-sync.mjs')
  copyFileSync(SCRIPT_PATH, scriptInSandbox)
  return spawnSync('node', [scriptInSandbox, ...args], {
    cwd: sandbox.dir,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, ...opts.env },
  })
}

function readFile(file) {
  return readFileSync(file, 'utf8')
}

// ─── 测试 1:真实仓库 + --help ───

test('check-staged-typecheck-mirror-sync: 真实仓库指纹一致 → exit 0', () => {
  // 直接在仓库根跑(读真实源/测),不应需要 sandbox
  const res = spawnSync('node', [SCRIPT_PATH], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  assert.equal(res.status, 0, `期望 exit 0,实际 ${res.status}\nstdout=${res.stdout}\nstderr=${res.stderr}`)
  assert.ok(res.stdout.includes('源/测指纹一致,无漂移'), '应打印"无漂移"诊断')
})

test('check-staged-typecheck-mirror-sync: --help → exit 0 + 帮助文本', () => {
  const res = spawnSync('node', [SCRIPT_PATH, '--help'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  assert.equal(res.status, 0, `期望 exit 0,实际 ${res.status}`)
  assert.ok(res.stdout.includes('check-staged-typecheck-mirror-sync'), '帮助文本应含脚本名')
  assert.ok(res.stdout.includes('退出码'), '帮助文本应含退出码说明')
})

test('check-staged-typecheck-mirror-sync: --quiet → 无诊断输出 + exit 0', () => {
  const res = spawnSync('node', [SCRIPT_PATH, '--quiet'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  assert.equal(res.status, 0, `期望 exit 0,实际 ${res.status}`)
  assert.equal(res.stdout.trim(), '', '--quiet 应抑制诊断输出')
})

test('check-staged-typecheck-mirror-sync: --json → 输出有效 JSON + ok=true', () => {
  const res = spawnSync('node', [SCRIPT_PATH, '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  assert.equal(res.status, 0, `期望 exit 0,实际 ${res.status}`)
  let parsed
  assert.doesNotThrow(() => {
    parsed = JSON.parse(res.stdout)
  }, 'stdout 应是合法 JSON')
  assert.equal(parsed.ok, true, 'JSON.ok 应为 true')
  assert.deepEqual(parsed.drift, [], 'JSON.drift 应为空数组')
  assert.equal(parsed.testAnchors.length, 3, '应有 3 个 testAnchors')
})

// ─── 测试 5:源脚本 normalizePath 漂移 → exit 1 ───

test('源脚本 normalizePath 漂移 → exit 1 + drift 诊断', () => {
  const sandbox = setupTempSandbox()
  try {
    copyRealIntoSandbox(sandbox)
    const sourceCopy = join(sandbox.scriptsDir, 'check-staged-typecheck.mjs')
    const original = readFile(sourceCopy)
    // 只替换 normalizePath 函数体内的那一行(行 285),
    // 不替换 getOriginalInclude 函数体内(行 249)同款正则。
    // 通过定位完整行文本 "return p.replace(/\\/g, '/')" 来精确漂移。
    const lineNeedle = "return p.replace(/\\\\/g, '/')"
    const tampered = original.replace(lineNeedle, "return p.replace(/x/g, '/')")
    assert.notEqual(tampered, original, '替换必须命中,否则测试无效')
    writeFileSync(sourceCopy, tampered)
    const res = runScriptInDir(sandbox)
    assert.equal(res.status, 1, `期望 exit 1,实际 ${res.status}\nstdout=${res.stdout}`)
    assert.ok(
      res.stdout.includes('漂移') || res.stdout.includes('fingerprint'),
      '应打印漂移诊断',
    )
    assert.ok(
      res.stdout.includes('normalizePath'),
      '应定位到 normalizePath 函数',
    )
  } finally {
    teardown(sandbox)
  }
})

// ─── 测试 6:测试文件「镜像同步锚点」注释漂移 → exit 1 ───

test('测试文件「镜像同步锚点」注释行号漂移 → exit 1', () => {
  const sandbox = setupTempSandbox()
  try {
    copyRealIntoSandbox(sandbox)
    const testCopy = join(sandbox.testsDir, 'check-staged-typecheck.test.mjs')
    const original = readFile(testCopy)
    // 把 normalizePath 的行号范围从 284-286 改成 999-1000(故意漂移)
    const tampered = original.replace(
      'normalizePath: 源脚本第 284-286 行',
      'normalizePath: 源脚本第 999-1000 行',
    )
    assert.notEqual(tampered, original, '替换必须命中,否则测试无效')
    writeFileSync(testCopy, tampered)
    const res = runScriptInDir(sandbox)
    assert.equal(res.status, 1, `期望 exit 1,实际 ${res.status}\nstdout=${res.stdout}`)
    assert.ok(res.stdout.includes('漂移'), '应打印漂移诊断')
    assert.ok(
      res.stdout.includes('normalizePath'),
      '应定位到 normalizePath 行号范围漂移',
    )
  } finally {
    teardown(sandbox)
  }
})

// ─── 测试 7:源脚本 filterTscOutputForStagedFiles 关键正则漂移 → exit 1 ───

test('源脚本 filterTscOutputForStagedFiles 关键正则漂移 → exit 1', () => {
  const sandbox = setupTempSandbox()
  try {
    copyRealIntoSandbox(sandbox)
    const sourceCopy = join(sandbox.scriptsDir, 'check-staged-typecheck.mjs')
    const original = readFile(sourceCopy)
    // 改 .match(...) 里的正则,把 TS\d+ 改成 TS\d{2}(故意漂移)
    const tampered = original.replace(
      'line.match(/^(.+?)\\(\\d+,\\d+\\): error TS\\d+:/)',
      'line.match(/^(.+?)\\(\\d+,\\d+\\): error TS\\d{2}:/)',
    )
    assert.notEqual(tampered, original, '替换必须命中,否则测试无效')
    writeFileSync(sourceCopy, tampered)
    const res = runScriptInDir(sandbox)
    assert.equal(res.status, 1, `期望 exit 1,实际 ${res.status}\nstdout=${res.stdout}`)
    assert.ok(
      res.stdout.includes('filterTscOutputForStagedFiles'),
      '应定位到 filterTscOutputForStagedFiles 漂移',
    )
  } finally {
    teardown(sandbox)
  }
})

// ─── 测试 8:源文件缺失 → exit 2 ───

test('源文件不存在 → exit 2 + source_missing', () => {
  const sandbox = setupTempSandbox()
  try {
    copyRealIntoSandbox(sandbox)
    const sourceCopy = join(sandbox.scriptsDir, 'check-staged-typecheck.mjs')
    rmSync(sourceCopy)
    const res = runScriptInDir(sandbox)
    assert.equal(res.status, 2, `期望 exit 2,实际 ${res.status}`)
    assert.ok(
      res.stdout.includes('源脚本不存在') || res.stdout.includes('source_missing'),
      '应报告源脚本缺失',
    )
  } finally {
    teardown(sandbox)
  }
})

// ─── 测试 9:测试文件缺失 → exit 2 ───

test('测试文件不存在 → exit 2 + test_missing', () => {
  const sandbox = setupTempSandbox()
  try {
    copyRealIntoSandbox(sandbox)
    const testCopy = join(sandbox.testsDir, 'check-staged-typecheck.test.mjs')
    rmSync(testCopy)
    const res = runScriptInDir(sandbox)
    assert.equal(res.status, 2, `期望 exit 2,实际 ${res.status}`)
    assert.ok(
      res.stdout.includes('测试文件不存在') || res.stdout.includes('test_missing'),
      '应报告测试文件缺失',
    )
  } finally {
    teardown(sandbox)
  }
})

// ─── 测试 10:--json 在漂移时输出 ok=false ───

test('漂移时 --json 输出 ok=false + drift 非空', () => {
  const sandbox = setupTempSandbox()
  try {
    copyRealIntoSandbox(sandbox)
    const sourceCopy = join(sandbox.scriptsDir, 'check-staged-typecheck.mjs')
    const original = readFile(sourceCopy)
    const tampered = original.replace(
      "return p.replace(/\\\\/g, '/')",
      "return p.replace(/y/g, '/')",
    )
    writeFileSync(sourceCopy, tampered)
    const res = runScriptInDir(sandbox, ['--json'])
    assert.equal(res.status, 1, `期望 exit 1,实际 ${res.status}`)
    let parsed
    assert.doesNotThrow(() => {
      parsed = JSON.parse(res.stdout)
    }, 'stdout 应是合法 JSON')
    assert.equal(parsed.ok, false, 'JSON.ok 应为 false')
    assert.ok(parsed.drift.length > 0, 'JSON.drift 应非空')
    assert.ok(
      parsed.drift.some((d) => d.key === 'normalizePath'),
      'drift 应包含 normalizePath',
    )
  } finally {
    teardown(sandbox)
  }
})