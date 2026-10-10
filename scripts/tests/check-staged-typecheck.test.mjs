// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-staged-typecheck.test.mjs — 单元测试 check-staged-typecheck.mjs 的核心过滤逻辑
 *
 * 背景(2026-08-18 立, 批次 8-P2 工程治理):
 *   check-staged-typecheck.mjs(本仓库预 commit typecheck 守门脚本)只把
 *   "staged 文件路径属于 tsc 错误块" 的错误视为失败, 非 staged 文件错误
 *   (其他 agent 在途改动) 被自动过滤, 解决多 agent 并行 push 时 100% 误阻塞。
 *
 * 镜像范围与同步锚点(§22c, 2026-08-18 根治):
 *   源脚本通过 `export const __test__ = { ... }` 导出三个核心函数;
 *   本测试直接 import 它们, 不再维护任何"镜像常量", 杜绝源/测字面量子串漂移。
 *   三个键名(getOriginalInclude / normalizePath / filterTscOutputForStagedFiles)
 *   被 check-staged-typecheck-mirror-sync 守门锁死, 不允许重命名。
 *
 * 退出码语义 (源脚本定义):
 *   0  通过 (无 staged .ts/.tsx / 全部 typecheck 通过)
 *   1  失败 (任一 package typecheck 不通过, 错误文件路径 ∈ staged)
 *   2  异常 (脚本本身执行异常, 区别于 typecheck 失败)
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync, execSync } from 'node:child_process'
import { writeFileSync, mkdirSync, existsSync, chmodSync } from 'node:fs'
import { join, resolve, delimiter } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url, 不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-staged-typecheck.mjs')
const ROOT = resolve(__dirname, '..', '..')

// ─── 直接 import 源脚本(§22c 镜像常量守门模式) ───────────────
// 三个键名不允许重命名, 被 check-staged-typecheck-mirror-sync 守门锁死。
// 修改源脚本函数体允许, 但 export 键名与测试 import 路径不允许改。
import { __test__ as sourceFns } from '../check-staged-typecheck.mjs'

// ─── 辅助: 构造测试用的 pkg 对象 ─────────────────────────────
function makePkg(dir) {
  return {
    dir,
    name: '@ihui/test',
    prefix: 'apps/test',
    hasTypecheck: true,
    hasTsconfig: true,
    tsconfigPath: join(dir, 'tsconfig.json'),
  }
}

// ─── 辅助: 去除 ANSI 颜色码 (脚本输出含 \x1B[31m 等) ───────
function stripAnsi(s) {
  return s.replace(/\x1B\[[0-9;]*m/g, '')
}

// ─── 辅助: 创建临时 git 仓库 (含初始 commit) ───────────────
function createTempRepo() {
  const dir = mkScratch('ihui-typecheck-')
  execSyncQuiet('git init -b main', dir)
  execSyncQuiet('git config user.email test@test.com', dir)
  execSyncQuiet('git config user.name test', dir)
  execSyncQuiet('git config commit.gpgsign false', dir)
  writeFileSync(join(dir, 'README.md'), '# init\n')
  execSyncQuiet('git add README.md', dir)
  execSyncQuiet('git commit -m "init"', dir)
  return dir
}

function execSyncQuiet(cmd, cwd) {
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  execSync(cmd, { cwd, stdio: 'ignore' })
}

/**
 * 构造一个 getOriginalInclude 测试用的临时 tsconfig.json,
 * 调用 sourceFns.getOriginalInclude(mockPkg) 直接走源函数逻辑。
 * 这样既消除镜像常量, 又能测"JSON 解析失败"等 case (传 null → 走 catch 分支)。
 *
 * @param {object|null} raw 期望 tsconfig.json 内容; null 表示不写文件, 模拟缺失。
 * @returns {object} mock pkg
 */
function makeGetOriginalIncludePkg(raw) {
  if (raw === null) {
    const dir = mkScratch('ihui-getincl-')
    return { pkg: makePkg(dir), cleanup: () => rmScratch(dir) }
  }
  const dir = mkScratch('ihui-getincl-')
  writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify(raw), 'utf8')
  return { pkg: makePkg(dir), cleanup: () => rmScratch(dir) }
}

// ─── 测试 1: filterTscOutputForStagedFiles 单元测试 ────────

test('filterTscOutputForStagedFiles: 空输出 → 返回空串', () => {
  const pkg = makePkg(join(ROOT, 'apps/web'))
  const result = sourceFns.filterTscOutputForStagedFiles('', pkg, ['apps/web/index.ts'])
  assert.equal(result, '')
})

test('filterTscOutputForStagedFiles: 只有空白字符 → 返回空串', () => {
  const pkg = makePkg(join(ROOT, 'apps/web'))
  const result = sourceFns.filterTscOutputForStagedFiles('   \n\n  \n', pkg, ['apps/web/index.ts'])
  assert.equal(result, '')
})

test('filterTscOutputForStagedFiles: 只有 staged 文件错误 → 整段保留', () => {
  const pkg = makePkg(join(ROOT, 'apps/web'))
  const webIndex = join(ROOT, 'apps/web/index.ts')
  const tscOutput = `${webIndex}(10,5): error TS2304: Cannot find name 'foo'.\n`
  const result = sourceFns.filterTscOutputForStagedFiles(tscOutput, pkg, ['apps/web/index.ts'])
  assert.ok(result.includes('error TS2304'), '应保留 staged 文件错误')
  assert.ok(result.includes('Cannot find name'), '应保留错误消息')
})

test('filterTscOutputForStagedFiles: 只有非 staged 文件错误 → 返回空串', () => {
  const pkg = makePkg(join(ROOT, 'apps/web'))
  const apiRoute = join(ROOT, 'apps/api/route.ts')
  const tscOutput = `${apiRoute}(12,3): error TS2322: Type 'string' is not assignable to type 'number'.\n`
  const result = sourceFns.filterTscOutputForStagedFiles(tscOutput, pkg, ['apps/web/index.ts'])
  assert.equal(result, '', '非 staged 文件错误应被过滤')
})

test('filterTscOutputForStagedFiles: 混合 staged + 非 staged 错误 → 只保留 staged 块', () => {
  const pkg = makePkg(join(ROOT, 'apps/web'))
  const webIndex = join(ROOT, 'apps/web/index.ts')
  const apiRoute = join(ROOT, 'apps/api/route.ts')
  const tscOutput = [
    `${webIndex}(10,5): error TS2304: Cannot find name 'foo'.`,
    `${apiRoute}(12,3): error TS2322: Type 'string' is not assignable to type 'number'.`,
    `${webIndex}(20,1): error TS2339: Property 'bar' does not exist on type 'Baz'.`,
    '',
  ].join('\n')
  const result = sourceFns.filterTscOutputForStagedFiles(tscOutput, pkg, ['apps/web/index.ts'])
  assert.ok(result.includes('error TS2304'), '应保留 staged 错误 TS2304')
  assert.ok(result.includes('error TS2339'), '应保留 staged 错误 TS2339')
  assert.ok(!result.includes('error TS2322'), '非 staged 错误 TS2322 应被过滤')
  assert.ok(!result.includes("Type 'string'"), '非 staged 错误消息应被过滤')
})

test('filterTscOutputForStagedFiles: 错误行带 detail 行 → 整块都保留', () => {
  const pkg = makePkg(join(ROOT, 'apps/web'))
  const webIndex = join(ROOT, 'apps/web/index.ts')
  const tscOutput = [
    `${webIndex}(10,5): error TS2322: Type 'X' is not assignable to type 'Y'.`,
    `  The expected type comes from property 'a' which is declared here: type Y`,
    `    at ${webIndex}(5,3)`,
    '',
  ].join('\n')
  const result = sourceFns.filterTscOutputForStagedFiles(tscOutput, pkg, ['apps/web/index.ts'])
  assert.ok(result.includes('error TS2322'), '应保留错误行')
  assert.ok(result.includes('The expected type comes from'), '应保留 detail 行 1')
  assert.ok(result.includes('at'), '应保留 detail 行 2')
})

test('filterTscOutputForStagedFiles: 非 staged 错误块的 detail 行也被过滤', () => {
  const pkg = makePkg(join(ROOT, 'apps/web'))
  const apiRoute = join(ROOT, 'apps/api/route.ts')
  const tscOutput = [
    `${apiRoute}(12,3): error TS2322: Type 'X' is not assignable to type 'Y'.`,
    `  The expected type comes from property 'a' which is declared here: type Y`,
    `    at ${apiRoute}(5,3)`,
    '',
  ].join('\n')
  const result = sourceFns.filterTscOutputForStagedFiles(tscOutput, pkg, ['apps/web/index.ts'])
  assert.equal(result, '', '非 staged 错误块及其 detail 行应全部被过滤')
})

test('filterTscOutputForStagedFiles: Windows 路径 (pkg.dir 含反斜杠) → 仍能正确解析', () => {
  const winDir = 'G:\\IHUI-AI\\apps\\web'
  const pkg = makePkg(winDir)
  const webIndex = join(ROOT, 'apps/web/index.ts')
  const tscOutput = `${webIndex}(10,5): error TS2304: Cannot find name 'foo'.\n`
  const result = sourceFns.filterTscOutputForStagedFiles(tscOutput, pkg, ['apps/web/index.ts'])
  assert.ok(result.includes('error TS2304'), 'Windows 路径应能正确解析')
})

test('filterTscOutputForStagedFiles: 错误文件相对路径含 ./ 前缀 → 正确 resolve', () => {
  const pkg = makePkg(join(ROOT, 'apps/web'))
  const tscOutput = `./index.ts(10,5): error TS2304: Cannot find name 'foo'.\n`
  const result = sourceFns.filterTscOutputForStagedFiles(tscOutput, pkg, ['apps/web/index.ts'])
  assert.ok(result.includes('error TS2304'), '带 ./ 前缀的相对路径应被正确 resolve')
})

test('filterTscOutputForStagedFiles: 正则不匹配 warning/info 行', () => {
  const pkg = makePkg(join(ROOT, 'apps/web'))
  const webIndex = join(ROOT, 'apps/web/index.ts')
  const tscOutput = [
    `info: Starting type checking...`,
    `${webIndex}(10,5): warning TS6133: 'foo' is declared but its value is never read.`,
    `${webIndex}(20,1): error TS2304: Cannot find name 'bar'.`,
    `Found 1 error.`,
  ].join('\n')
  const result = sourceFns.filterTscOutputForStagedFiles(tscOutput, pkg, ['apps/web/index.ts'])
  assert.ok(result.includes('error TS2304'), '应保留 error 行')
  assert.ok(result.includes('Cannot find name'), '应保留错误消息')
  assert.ok(!result.includes('Starting type checking'), 'info 行不应被保留(非 staged 块起始行)')
  assert.ok(!result.includes('warning TS6133'), 'warning 行作为前块 detail 被丢弃(前块非 staged)')
})

test('filterTscOutputForStagedFiles: 正则不匹配 info 行 (info: ... 格式)', () => {
  const pkg = makePkg(join(ROOT, 'apps/web'))
  const tscOutput = `info: some informational message\n`
  const result = sourceFns.filterTscOutputForStagedFiles(tscOutput, pkg, ['apps/web/index.ts'])
  assert.equal(result, '', '纯 info 行不应被保留')
})

test('filterTscOutputForStagedFiles: 多个 staged 文件, 各自的错误都保留', () => {
  const pkg = makePkg(join(ROOT, 'apps/web'))
  const fileA = join(ROOT, 'apps/web/a.ts')
  const fileB = join(ROOT, 'apps/web/b.ts')
  const tscOutput = [
    `${fileA}(1,1): error TS2304: Cannot find name 'x'.`,
    `${fileB}(2,2): error TS2304: Cannot find name 'y'.`,
    '',
  ].join('\n')
  const result = sourceFns.filterTscOutputForStagedFiles(tscOutput, pkg, [
    'apps/web/a.ts',
    'apps/web/b.ts',
  ])
  assert.ok(result.includes("Cannot find name 'x'"), '应保留 fileA 错误')
  assert.ok(result.includes("Cannot find name 'y'"), '应保留 fileB 错误')
})

test('filterTscOutputForStagedFiles: 同文件多个错误 → 全部保留', () => {
  const pkg = makePkg(join(ROOT, 'apps/web'))
  const webIndex = join(ROOT, 'apps/web/index.ts')
  const tscOutput = [
    `${webIndex}(1,1): error TS2304: Cannot find name 'x'.`,
    `${webIndex}(5,5): error TS2322: Type mismatch.`,
    `${webIndex}(10,1): error TS2339: Property not found.`,
    '',
  ].join('\n')
  const result = sourceFns.filterTscOutputForStagedFiles(tscOutput, pkg, ['apps/web/index.ts'])
  assert.ok(result.includes('TS2304'), '应保留错误 1')
  assert.ok(result.includes('TS2322'), '应保留错误 2')
  assert.ok(result.includes('TS2339'), '应保留错误 3')
})

test('filterTscOutputForStagedFiles: 错误块之间空行处理正确', () => {
  const pkg = makePkg(join(ROOT, 'apps/web'))
  const webIndex = join(ROOT, 'apps/web/index.ts')
  const apiRoute = join(ROOT, 'apps/api/route.ts')
  const tscOutput = [
    `${webIndex}(1,1): error TS2304: Cannot find name 'x'.`,
    '',
    `${apiRoute}(2,2): error TS2304: Cannot find name 'y'.`,
    '',
    `${webIndex}(5,5): error TS2322: Type mismatch.`,
    '',
  ].join('\n')
  const result = sourceFns.filterTscOutputForStagedFiles(tscOutput, pkg, ['apps/web/index.ts'])
  assert.ok(result.includes('TS2304'), '应保留错误 TS2304')
  assert.ok(result.includes('TS2322'), '应保留错误 TS2322')
  assert.ok(!result.includes("Type 'string'"), '非 staged 错误消息应被过滤')
})

// ─── 测试 2: getOriginalInclude 源函数直调 (临时 tsconfig) ──

test('getOriginalInclude: 正常 include 数组 → 前缀补 ./ 并 \\ → /', () => {
  const { pkg, cleanup } = makeGetOriginalIncludePkg({
    include: ['src/**/*.ts', 'src/**/*.tsx'],
  })
  try {
    const result = sourceFns.getOriginalInclude(pkg)
    assert.deepEqual(result, ['./src/**/*.ts', './src/**/*.tsx'])
  } finally {
    cleanup()
  }
})

test('getOriginalInclude: 已有 ./ 前缀 → 不重复补', () => {
  const { pkg, cleanup } = makeGetOriginalIncludePkg({
    include: ['./src/**/*.ts', './src/**/*.tsx'],
  })
  try {
    const result = sourceFns.getOriginalInclude(pkg)
    assert.deepEqual(result, ['./src/**/*.ts', './src/**/*.tsx'])
  } finally {
    cleanup()
  }
})

test('getOriginalInclude: 含反斜杠 → 替换为 /', () => {
  const { pkg, cleanup } = makeGetOriginalIncludePkg({
    include: ['src\\**\\*.ts', 'src\\**\\*.tsx'],
  })
  try {
    const result = sourceFns.getOriginalInclude(pkg)
    assert.deepEqual(result, ['./src/**/*.ts', './src/**/*.tsx'])
  } finally {
    cleanup()
  }
})

test('getOriginalInclude: 已有 ./ 前缀 + 反斜杠 → 不重复补 + 仍转 /', () => {
  const { pkg, cleanup } = makeGetOriginalIncludePkg({
    include: ['.\\src\\**\\*.ts'],
  })
  try {
    const result = sourceFns.getOriginalInclude(pkg)
    assert.deepEqual(result, ['.\\src\\**\\*.ts'])
  } finally {
    cleanup()
  }
})

test('getOriginalInclude: 空 include 数组 → 走回退默认', () => {
  const { pkg, cleanup } = makeGetOriginalIncludePkg({ include: [] })
  try {
    const result = sourceFns.getOriginalInclude(pkg)
    assert.deepEqual(result, ['./src/**/*.ts', './src/**/*.tsx', './**/*.d.ts'])
  } finally {
    cleanup()
  }
})

test('getOriginalInclude: 缺失 include 字段 → 走回退默认', () => {
  const { pkg, cleanup } = makeGetOriginalIncludePkg({
    compilerOptions: { strict: true },
  })
  try {
    const result = sourceFns.getOriginalInclude(pkg)
    assert.deepEqual(result, ['./src/**/*.ts', './src/**/*.tsx', './**/*.d.ts'])
  } finally {
    cleanup()
  }
})

test('getOriginalInclude: include 非数组 (string) → 走回退默认', () => {
  const { pkg, cleanup } = makeGetOriginalIncludePkg({ include: 'src/**/*.ts' })
  try {
    const result = sourceFns.getOriginalInclude(pkg)
    assert.deepEqual(result, ['./src/**/*.ts', './src/**/*.tsx', './**/*.d.ts'])
  } finally {
    cleanup()
  }
})

test('getOriginalInclude: tsconfig.json 不存在 (读取失败) → 走回退默认', () => {
  const { pkg, cleanup } = makeGetOriginalIncludePkg(null)
  try {
    const result = sourceFns.getOriginalInclude(pkg)
    assert.deepEqual(result, ['./src/**/*.ts', './src/**/*.tsx', './**/*.d.ts'])
  } finally {
    cleanup()
  }
})

test('getOriginalInclude: tsconfig.json 是非法 JSON → 走回退默认', () => {
  const dir = mkScratch('ihui-getincl-')
  try {
    writeFileSync(join(dir, 'tsconfig.json'), '{ invalid json', 'utf8')
    const pkg = makePkg(dir)
    const result = sourceFns.getOriginalInclude(pkg)
    assert.deepEqual(result, ['./src/**/*.ts', './src/**/*.tsx', './**/*.d.ts'])
  } finally {
    rmScratch(dir)
  }
})

// ─── 测试 3: normalizePath 源函数直调 ─────────────────────

test('normalizePath: 正斜杠路径 → 不变', () => {
  assert.equal(sourceFns.normalizePath('apps/web/src/index.ts'), 'apps/web/src/index.ts')
})

test('normalizePath: 反斜杠路径 → 全部转 /', () => {
  assert.equal(sourceFns.normalizePath('apps\\web\\src\\index.ts'), 'apps/web/src/index.ts')
})

test('normalizePath: 混合斜杠 → 全部转 /', () => {
  assert.equal(sourceFns.normalizePath('apps\\web/src\\index.ts'), 'apps/web/src/index.ts')
})

test('normalizePath: 空串 → 空串', () => {
  assert.equal(sourceFns.normalizePath(''), '')
})

// ─── 测试 4: CLI 端到端测试 ─────────────────────────────────

test('CLI: --help → exit 0, stdout 含 check-staged-typecheck', () => {
  const r = spawnSync('node', [SCRIPT_PATH, '--help'], {
    encoding: 'utf8',
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.equal(r.status, 0, `--help 应 exit 0, 实际 ${r.status}\nstderr: ${r.stderr}`)
  assert.ok(
    r.stdout.includes('check-staged-typecheck'),
    'stdout 应含脚本名 "check-staged-typecheck"',
  )
})

test('CLI: -h 短选项 → exit 0, stdout 含帮助文本', () => {
  const r = spawnSync('node', [SCRIPT_PATH, '-h'], {
    encoding: 'utf8',
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.equal(r.status, 0, `-h 应 exit 0, 实际 ${r.status}`)
  const out = stripAnsi(r.stdout)
  assert.ok(out.includes('用法'), 'stdout 应含"用法"段')
  assert.ok(out.includes('--staged'), 'stdout 应含 --staged 选项说明')
})

test('CLI: 非 git 目录 + --staged → exit 0 (无 staged 文件, 跳过)', () => {
  const dir = mkScratch('ihui-nongit-typecheck-')
  try {
    // --root 是测试通道: 不带它则本用例读的是真仓的共享索引(别人随时会 staged .ts,
    // 于是"跳过"这一句取决于并发会话此刻在做什么,而不是本夹具)
    const r = spawnSync('node', [SCRIPT_PATH, '--staged', '--root', dir], {
      cwd: dir,
      encoding: 'utf8',
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
    })
    assert.equal(
      r.status,
      0,
      `非 git 目录应 exit 0, 实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
    )
    const out = stripAnsi(r.stdout)
    assert.match(out, /暂存区无文件|跳过/, '应显示暂存区无文件 / 跳过')
  } finally {
    rmScratch(dir)
  }
})

test('CLI: git 仓库 + 空 staged → exit 0 (提示无 staged)', () => {
  const dir = createTempRepo()
  try {
    // --root:同上 —— 断的是**这个夹具**的空暂存区,不是真仓索引此刻的状态
    const r = spawnSync('node', [SCRIPT_PATH, '--staged', '--root', dir], {
      cwd: dir,
      encoding: 'utf8',
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
    })
    assert.equal(r.status, 0, `空 staged 应 exit 0, 实际 ${r.status}`)
    const out = stripAnsi(r.stdout)
    assert.match(out, /暂存区无文件|跳过/, '应显示暂无 staged 文件')
  } finally {
    rmScratch(dir)
  }
})

test('CLI: git 仓库 + staged .ts 文件 + --dry-run → exit 0 (打印分组, 不实际 typecheck)', () => {
  const dir = createTempRepo()
  try {
    // 夹具要有 package.json + tsconfig,否则分组为空、根本走不到 dry-run 那一打印
    makeProbePkg(dir, { name: 'web' })
    writeFileSync(join(dir, 'apps/web/src/foo.ts'), 'export const x = 1\n')
    execSyncQuiet('git add apps/web/src/foo.ts', dir)
    const r = spawnSync('node', [SCRIPT_PATH, '--dry-run', '--root', dir], {
      cwd: dir,
      encoding: 'utf8',
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
    })
    assert.equal(
      r.status,
      0,
      `--dry-run 应 exit 0, 实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`,
    )
    const out = stripAnsi(r.stdout)
    assert.match(out, /dry-run/, 'stdout 应含 dry-run 标识')
  } finally {
    rmScratch(dir)
  }
})

test('CLI: --quiet 抑制 info 输出, 保留 error', () => {
  const r = spawnSync('node', [SCRIPT_PATH, '--help', '--quiet'], {
    encoding: 'utf8',
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  assert.equal(r.status, 0)
  assert.equal(
    r.stdout.trim(),
    '',
    `--quiet 应抑制 info 输出, 实际 stdout: ${JSON.stringify(r.stdout)}`,
  )
})

test('CLI: 无参数 + git 仓库 + 空 staged → exit 0 (默认 staged 模式)', () => {
  const dir = createTempRepo()
  try {
    // --root:同上,默认档也必须断在夹具上而不是真仓共享索引
    const r = spawnSync('node', [SCRIPT_PATH, '--root', dir], {
      cwd: dir,
      encoding: 'utf8',
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
    })
    assert.equal(r.status, 0, `默认模式 + 空 staged 应 exit 0, 实际 ${r.status}`)
  } finally {
    rmScratch(dir)
  }
})

// ─── 测试 5: --files 档与未知旗标(G-831) ────────────────────
//
// 为什么夹具要转发 pnpm:探针文件不得写进真仓(§15/§26 的夹具落点),而 --files 必须**真跑
// tsc** 才证得了"审到了" —— 只断退出码的话,"pnpm 在夹具里跑不起来"同样回 1,那是一台空转
// 的尺子。转发器只承担 `pnpm --filter X exec -- tsc …` 的语义(cwd 落到包目录),编译、
// 报错文本与退出码全部由仓库里装好的 typescript 产生。
const TSC_BIN = join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc')
// 能力探测在模块顶层量一次:skip 必须是求值后的布尔,不能是函数
const TSC_SKIP = existsSync(TSC_BIN)
  ? false
  : `tsc 不在位, --files 的真实编译用例无法取证: ${TSC_BIN}`

function runTool(argv, opts = {}) {
  return spawnSync(process.execPath, [SCRIPT_PATH, ...argv], {
    cwd: opts.cwd ?? ROOT,
    encoding: 'utf8',
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
    env: opts.env,
    windowsHide: true, // 防 Windows 弹可见控制台窗口(守门 52)
  })
}

function makeProbePkg(dir, { name = 'probe', withTypecheck = true } = {}) {
  const pkgDir = join(dir, 'apps', name)
  mkdirSync(join(pkgDir, 'src'), { recursive: true })
  const manifest = { name: `@ihui/${name}`, version: '0.0.0' }
  if (withTypecheck) manifest.scripts = { typecheck: 'tsc --noEmit' }
  writeFileSync(join(pkgDir, 'package.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8')
  writeFileSync(
    join(pkgDir, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          strict: true,
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'Bundler',
          noEmit: true,
        },
        include: ['src/**/*.ts'],
      },
      null,
      2,
    ) + '\n',
    'utf8',
  )
  return pkgDir
}

function makePnpmStub(dir) {
  const binDir = join(dir, 'fakebin')
  mkdirSync(binDir, { recursive: true })
  writeFileSync(
    join(binDir, 'pnpm-stub.mjs'),
    [
      "import { spawnSync } from 'node:child_process'",
      'const argv = process.argv.slice(2)',
      "const at = argv.indexOf('tsc')",
      "if (at === -1) { console.error('stub: 转发器只认 tsc 形态'); process.exit(127) }",
      'const r = spawnSync(process.execPath, [process.env.IHUI_TSC_STUB_BIN, ...argv.slice(at + 1)], {',
      '  cwd: process.env.IHUI_TSC_STUB_PKG_DIR,',
      "  stdio: 'inherit',",
      '  windowsHide: true,',
      '})',
      'process.exit(r.status ?? 1)',
      '',
    ].join('\n'),
    'utf8',
  )
  if (process.platform === 'win32') {
    writeFileSync(join(binDir, 'pnpm.cmd'), '@echo off\r\nnode "%~dp0pnpm-stub.mjs" %*\r\n', 'utf8')
  } else {
    const sh = join(binDir, 'pnpm')
    writeFileSync(sh, '#!/bin/sh\nexec node "$(dirname "$0")/pnpm-stub.mjs" "$@"\n', 'utf8')
    chmodSync(sh, 0o755)
  }
  return binDir
}

function makeFilesFixture() {
  const dir = mkScratch('ihui-files-cst-')
  const pkgDir = makeProbePkg(dir)
  const nocheckDir = makeProbePkg(dir, {
    name: 'nocheck',
    withTypecheck: false,
  })
  writeFileSync(join(pkgDir, 'src', 'clean.ts'), 'export const okNumber: number = 1\n', 'utf8')
  // 阳性对照的病灶:类型不符,真 tsc 必报 TS2322
  writeFileSync(
    join(pkgDir, 'src', 'broken.ts'),
    "export const badNumber: number = 'oops'\n",
    'utf8',
  )
  writeFileSync(join(pkgDir, 'notes.md'), '# not typescript\n', 'utf8')
  writeFileSync(join(nocheckDir, 'src', 'a.ts'), 'export const a: number = 1\n', 'utf8')
  writeFileSync(join(dir, 'loose.ts'), 'export const loose: number = 1\n', 'utf8')
  const binDir = makePnpmStub(dir)
  // PATH 族在 Windows 环境块里有两种拼写:继承会话给 `PATH`,由注册表组合的登录环境块给 `Path`
  // (G-1105300 实测)。这里若固定写大写键,在 `Path` 宿主上就会产出两份拼写 ⇒ 子进程只读到一份,
  // 前置的 fakebin 消失、`pnpm` 解析回真 pnpm。写法:读回宿主实际那一种拼写,不新增第二种。
  const pathKey = Object.keys(process.env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH'
  const inheritedPath = process.env[pathKey]
  return {
    dir,
    pkgDir,
    env: {
      ...process.env,
      [pathKey]: inheritedPath ? `${binDir}${delimiter}${inheritedPath}` : binDir,
      IHUI_TSC_STUB_PKG_DIR: pkgDir,
      IHUI_TSC_STUB_BIN: TSC_BIN,
    },
  }
}

const TEMP_TSCONFIG = 'tsconfig.staged-typecheck.json'

test('--files 干净文件 → exit 0, 且被审清单点名该文件(不是只看退出码)', { skip: TSC_SKIP }, () => {
  const fx = makeFilesFixture()
  try {
    const r = runTool(['--files', 'apps/probe/src/clean.ts', '--root', fx.dir], {
      env: fx.env,
    })
    assert.equal(r.status, 0, `干净文件应 exit 0, 实际 ${r.status}\n${r.stdout}\n${r.stderr}`)
    const out = stripAnsi(r.stdout) + stripAnsi(r.stderr)
    assert.ok(
      out.includes('+ apps/probe/src/clean.ts'),
      `被审清单必须列出声明的文件, 实得:\n${out}`,
    )
    assert.ok(out.includes('审的是声明的 1 个文件'), `结论行必须明写审的是声明集, 实得:\n${out}`)
    assert.ok(!out.includes('暂存区'), '--files 档不得去读共享索引(两档不得混在同一轮)')
    assert.equal(existsSync(join(fx.pkgDir, TEMP_TSCONFIG)), false, '临时 tsconfig 必须被清掉')
  } finally {
    rmScratch(fx.dir)
  }
})

test(
  '--files 故意写坏的文件 → exit 1 并报出真 tsc 错误(阳性对照:审到了)',
  { skip: TSC_SKIP },
  () => {
    const fx = makeFilesFixture()
    try {
      const r = runTool(['--files', 'apps/probe/src/broken.ts', '--root', fx.dir], {
        env: fx.env,
      })
      assert.equal(r.status, 1, `写坏的文件必须判失败, 实际 ${r.status}\n${r.stdout}`)
      const out = stripAnsi(r.stdout) + stripAnsi(r.stderr)
      assert.match(
        out,
        /error TS\d+:/,
        `必须看到真 tsc 报错, 否则"红"可能只是 pnpm 没跑起来:\n${out}`,
      )
      assert.ok(out.includes('broken.ts'), `报错必须落在声明的文件上:\n${out}`)
      assert.ok(out.includes('审的是声明的 1 个文件'), `失败结论同样要明写口径:\n${out}`)
      assert.equal(
        existsSync(join(fx.pkgDir, TEMP_TSCONFIG)),
        false,
        '失败路径同样要清掉临时 tsconfig',
      )
    } finally {
      rmScratch(fx.dir)
    }
  },
)

test('--files 一个路径都没给 → exit 2 并点名, 不落默认档', () => {
  const r = runTool(['--files'])
  assert.equal(r.status, 2, `--files 无路径应 exit 2, 实际 ${r.status}`)
  const err = stripAnsi(r.stderr)
  assert.ok(err.includes('--files'), `stderr 必须点名 --files, 实得:\n${err}`)
  assert.ok(!stripAnsi(r.stdout).includes('扫描 staged'), '用法错误不得去跑 staged 档再回一个 0')
})

test('--files 给了不存在的路径 → exit 2 并点名该路径', () => {
  const fx = makeFilesFixture()
  try {
    const r = runTool(['--files', 'apps/probe/src/nope.ts', '--root', fx.dir])
    assert.equal(r.status, 2, `不存在的路径应 exit 2, 实际 ${r.status}`)
    const err = stripAnsi(r.stderr)
    assert.ok(err.includes('apps/probe/src/nope.ts'), `必须点名不存在的路径, 实得:\n${err}`)
    assert.ok(!err.includes('全部通过'), '不得把"没审到"写成通过')
  } finally {
    rmScratch(fx.dir)
  }
})

test('未知旗标 --fles → exit 2 并点名, 绝不落默认 staged 档', () => {
  const r = runTool(['--fles', 'apps/cli/src/index.ts'])
  assert.equal(r.status, 2, `拼错的旗标必须炸, 实际 ${r.status}`)
  const err = stripAnsi(r.stderr)
  assert.ok(err.includes('--fles'), `必须点名 --fles, 实得:\n${err}`)
  const out = stripAnsi(r.stdout) + err
  assert.ok(!out.includes('扫描 staged'), `未知旗标不得落进默认档去审共享索引:\n${out}`)
  assert.ok(!out.includes('全部通过'), `不得对没跑的检查出合格证:\n${out}`)
})

test('--staged 与 --files 同轮混用 → exit 2(两种口径不得混在一轮)', () => {
  const r = runTool(['--staged', '--files', 'apps/probe/src/clean.ts'])
  assert.equal(r.status, 2, `混用应 exit 2, 实际 ${r.status}`)
  assert.ok(
    stripAnsi(r.stderr).includes('不得同轮混用'),
    `必须说明为何拒绝: ${stripAnsi(r.stderr)}`,
  )
})

test('反向锁: 不带参数与带 --staged 的结论形状逐字一致', () => {
  const dir = createTempRepo()
  try {
    const a = runTool(['--root', dir])
    const b = runTool(['--staged', '--root', dir])
    assert.equal(a.status, 0, `默认档应 exit 0, 实际 ${a.status}`)
    assert.equal(b.status, 0, `--staged 档应 exit 0, 实际 ${b.status}`)
    const oa = stripAnsi(a.stdout) + stripAnsi(a.stderr)
    const ob = stripAnsi(b.stdout) + stripAnsi(b.stderr)
    assert.equal(oa, ob, '默认档与 --staged 档必须同形(不得把默认改成 files)')
    assert.ok(oa.includes('暂存区'), `两档都走索引口径: ${oa}`)
    assert.ok(!oa.includes('审的是声明的'), '索引档不得被改成声明集口径')
  } finally {
    rmScratch(dir)
  }
})

test('反向锁: staged 档结论行明写"审的是索引暂存集"', () => {
  const dir = createTempRepo()
  try {
    const pkgDir = makeProbePkg(dir)
    writeFileSync(join(pkgDir, 'src', 'staged.ts'), 'export const s: number = 1\n', 'utf8')
    execSyncQuiet('git add apps/probe/src/staged.ts', dir)
    const r = runTool(['--staged', '--dry-run', '--root', dir])
    assert.equal(r.status, 0, `dry-run 应 exit 0, 实际 ${r.status}\n${r.stdout}\n${r.stderr}`)
    const out = stripAnsi(r.stdout)
    assert.ok(out.includes('dry-run'), '既有 dry-run 标识不得丢')
    assert.ok(out.includes('审的是索引暂存集'), `staged 档结论行必须明写口径:\n${out}`)
    assert.ok(!out.includes('审的是声明的'), '两档措辞不得串门')
  } finally {
    rmScratch(dir)
  }
})

test('--files 指向不支持 typecheck 的 package → exit 2 点名, 不静默跳过', () => {
  const fx = makeFilesFixture()
  try {
    const r = runTool(['--files', 'apps/nocheck/src/a.ts', '--root', fx.dir])
    assert.equal(r.status, 2, `审不到的声明应 exit 2, 实际 ${r.status}`)
    const err = stripAnsi(r.stderr)
    assert.ok(err.includes('apps/nocheck/src/a.ts'), `应点名文件: ${err}`)
    assert.ok(err.includes('无 typecheck script'), `应点名原因: ${err}`)
  } finally {
    rmScratch(fx.dir)
  }
})

test('--files 指向不属于任何 package 的 .ts → exit 2 点名', () => {
  const fx = makeFilesFixture()
  try {
    const r = runTool(['--files', 'loose.ts', '--root', fx.dir])
    assert.equal(r.status, 2, `无法归属的声明应 exit 2, 实际 ${r.status}`)
    assert.ok(stripAnsi(r.stderr).includes('loose.ts'), `必须点名该路径: ${stripAnsi(r.stderr)}`)
  } finally {
    rmScratch(fx.dir)
  }
})

test('--files 混列非 .ts 路径 → 剔除但仍点名, 审到的部分照常通过', { skip: TSC_SKIP }, () => {
  const fx = makeFilesFixture()
  try {
    const r = runTool(
      ['--files', 'apps/probe/src/clean.ts', 'apps/probe/notes.md', '--root', fx.dir],
      { env: fx.env },
    )
    assert.equal(r.status, 0, `干净文件应 exit 0, 实际 ${r.status}\n${r.stdout}`)
    const out = stripAnsi(r.stdout) + stripAnsi(r.stderr)
    assert.ok(out.includes('notes.md'), `被剔除的路径必须点名(不静默): ${out}`)
    assert.ok(out.includes('审的是声明的 1 个文件'), `口径计数只算审到的: ${out}`)
  } finally {
    rmScratch(fx.dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
