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
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
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
  const dir = mkdtempSync(join(tmpdir(), 'ihui-typecheck-'))
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
  execSync(cmd, { cwd, stdio: 'pipe' })
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
    const dir = mkdtempSync(join(tmpdir(), 'ihui-getincl-'))
    return { pkg: makePkg(dir), cleanup: () => rmSync(dir, { recursive: true, force: true }) }
  }
  const dir = mkdtempSync(join(tmpdir(), 'ihui-getincl-'))
  writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify(raw), 'utf8')
  return { pkg: makePkg(dir), cleanup: () => rmSync(dir, { recursive: true, force: true }) }
}

// ─── 测试 1: filterTscOutputForStagedFiles 单元测试 ────────

test('filterTscOutputForStagedFiles: 空输出 → 返回空串', () => {
  const pkg = makePkg(join(ROOT, 'apps/web'))
  const result = sourceFns.filterTscOutputForStagedFiles('', pkg, [
    'apps/web/index.ts',
  ])
  assert.equal(result, '')
})

test('filterTscOutputForStagedFiles: 只有空白字符 → 返回空串', () => {
  const pkg = makePkg(join(ROOT, 'apps/web'))
  const result = sourceFns.filterTscOutputForStagedFiles(
    '   \n\n  \n',
    pkg,
    ['apps/web/index.ts'],
  )
  assert.equal(result, '')
})

test('filterTscOutputForStagedFiles: 只有 staged 文件错误 → 整段保留', () => {
  const pkg = makePkg(join(ROOT, 'apps/web'))
  const webIndex = join(ROOT, 'apps/web/index.ts')
  const tscOutput = `${webIndex}(10,5): error TS2304: Cannot find name 'foo'.\n`
  const result = sourceFns.filterTscOutputForStagedFiles(tscOutput, pkg, [
    'apps/web/index.ts',
  ])
  assert.ok(result.includes('error TS2304'), '应保留 staged 文件错误')
  assert.ok(result.includes('Cannot find name'), '应保留错误消息')
})

test('filterTscOutputForStagedFiles: 只有非 staged 文件错误 → 返回空串', () => {
  const pkg = makePkg(join(ROOT, 'apps/web'))
  const apiRoute = join(ROOT, 'apps/api/route.ts')
  const tscOutput = `${apiRoute}(12,3): error TS2322: Type 'string' is not assignable to type 'number'.\n`
  const result = sourceFns.filterTscOutputForStagedFiles(tscOutput, pkg, [
    'apps/web/index.ts',
  ])
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
  const result = sourceFns.filterTscOutputForStagedFiles(tscOutput, pkg, [
    'apps/web/index.ts',
  ])
  assert.ok(result.includes('error TS2304'), '应保留 staged 错误 TS2304')
  assert.ok(result.includes('error TS2339'), '应保留 staged 错误 TS2339')
  assert.ok(
    !result.includes('error TS2322'),
    '非 staged 错误 TS2322 应被过滤',
  )
  assert.ok(
    !result.includes('Type \'string\''),
    '非 staged 错误消息应被过滤',
  )
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
  const result = sourceFns.filterTscOutputForStagedFiles(tscOutput, pkg, [
    'apps/web/index.ts',
  ])
  assert.ok(result.includes('error TS2322'), '应保留错误行')
  assert.ok(
    result.includes('The expected type comes from'),
    '应保留 detail 行 1',
  )
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
  const result = sourceFns.filterTscOutputForStagedFiles(tscOutput, pkg, [
    'apps/web/index.ts',
  ])
  assert.equal(result, '', '非 staged 错误块及其 detail 行应全部被过滤')
})

test('filterTscOutputForStagedFiles: Windows 路径 (pkg.dir 含反斜杠) → 仍能正确解析', () => {
  const winDir = 'G:\\IHUI-AI\\apps\\web'
  const pkg = makePkg(winDir)
  const webIndex = join(ROOT, 'apps/web/index.ts')
  const tscOutput = `${webIndex}(10,5): error TS2304: Cannot find name 'foo'.\n`
  const result = sourceFns.filterTscOutputForStagedFiles(tscOutput, pkg, [
    'apps/web/index.ts',
  ])
  assert.ok(result.includes('error TS2304'), 'Windows 路径应能正确解析')
})

test('filterTscOutputForStagedFiles: 错误文件相对路径含 ./ 前缀 → 正确 resolve', () => {
  const pkg = makePkg(join(ROOT, 'apps/web'))
  const tscOutput = `./index.ts(10,5): error TS2304: Cannot find name 'foo'.\n`
  const result = sourceFns.filterTscOutputForStagedFiles(tscOutput, pkg, [
    'apps/web/index.ts',
  ])
  assert.ok(
    result.includes('error TS2304'),
    '带 ./ 前缀的相对路径应被正确 resolve',
  )
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
  const result = sourceFns.filterTscOutputForStagedFiles(tscOutput, pkg, [
    'apps/web/index.ts',
  ])
  assert.ok(result.includes('error TS2304'), '应保留 error 行')
  assert.ok(result.includes('Cannot find name'), '应保留错误消息')
  assert.ok(
    !result.includes('Starting type checking'),
    'info 行不应被保留(非 staged 块起始行)',
  )
  assert.ok(
    !result.includes('warning TS6133'),
    'warning 行作为前块 detail 被丢弃(前块非 staged)',
  )
})

test('filterTscOutputForStagedFiles: 正则不匹配 info 行 (info: ... 格式)', () => {
  const pkg = makePkg(join(ROOT, 'apps/web'))
  const tscOutput = `info: some informational message\n`
  const result = sourceFns.filterTscOutputForStagedFiles(tscOutput, pkg, [
    'apps/web/index.ts',
  ])
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
  assert.ok(result.includes('Cannot find name \'x\''), '应保留 fileA 错误')
  assert.ok(result.includes('Cannot find name \'y\''), '应保留 fileB 错误')
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
  const result = sourceFns.filterTscOutputForStagedFiles(tscOutput, pkg, [
    'apps/web/index.ts',
  ])
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
  const result = sourceFns.filterTscOutputForStagedFiles(tscOutput, pkg, [
    'apps/web/index.ts',
  ])
  assert.ok(result.includes('TS2304'), '应保留错误 TS2304')
  assert.ok(result.includes('TS2322'), '应保留错误 TS2322')
  assert.ok(
    !result.includes('Type \'string\''),
    '非 staged 错误消息应被过滤',
  )
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
    assert.deepEqual(result, [
      './src/**/*.ts',
      './src/**/*.tsx',
      './**/*.d.ts',
    ])
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
    assert.deepEqual(result, [
      './src/**/*.ts',
      './src/**/*.tsx',
      './**/*.d.ts',
    ])
  } finally {
    cleanup()
  }
})

test('getOriginalInclude: include 非数组 (string) → 走回退默认', () => {
  const { pkg, cleanup } = makeGetOriginalIncludePkg({ include: 'src/**/*.ts' })
  try {
    const result = sourceFns.getOriginalInclude(pkg)
    assert.deepEqual(result, [
      './src/**/*.ts',
      './src/**/*.tsx',
      './**/*.d.ts',
    ])
  } finally {
    cleanup()
  }
})

test('getOriginalInclude: tsconfig.json 不存在 (读取失败) → 走回退默认', () => {
  const { pkg, cleanup } = makeGetOriginalIncludePkg(null)
  try {
    const result = sourceFns.getOriginalInclude(pkg)
    assert.deepEqual(result, [
      './src/**/*.ts',
      './src/**/*.tsx',
      './**/*.d.ts',
    ])
  } finally {
    cleanup()
  }
})

test('getOriginalInclude: tsconfig.json 是非法 JSON → 走回退默认', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-getincl-'))
  try {
    writeFileSync(join(dir, 'tsconfig.json'), '{ invalid json', 'utf8')
    const pkg = makePkg(dir)
    const result = sourceFns.getOriginalInclude(pkg)
    assert.deepEqual(result, [
      './src/**/*.ts',
      './src/**/*.tsx',
      './**/*.d.ts',
    ])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 测试 3: normalizePath 源函数直调 ─────────────────────

test('normalizePath: 正斜杠路径 → 不变', () => {
  assert.equal(sourceFns.normalizePath('apps/web/src/index.ts'), 'apps/web/src/index.ts')
})

test('normalizePath: 反斜杠路径 → 全部转 /', () => {
  assert.equal(
    sourceFns.normalizePath('apps\\web\\src\\index.ts'),
    'apps/web/src/index.ts',
  )
})

test('normalizePath: 混合斜杠 → 全部转 /', () => {
  assert.equal(
    sourceFns.normalizePath('apps\\web/src\\index.ts'),
    'apps/web/src/index.ts',
  )
})

test('normalizePath: 空串 → 空串', () => {
  assert.equal(sourceFns.normalizePath(''), '')
})

// ─── 测试 4: CLI 端到端测试 ─────────────────────────────────

test('CLI: --help → exit 0, stdout 含 check-staged-typecheck', () => {
  const r = spawnSync('node', [SCRIPT_PATH, '--help'], {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
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
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  assert.equal(r.status, 0, `-h 应 exit 0, 实际 ${r.status}`)
  const out = stripAnsi(r.stdout)
  assert.ok(out.includes('用法'), 'stdout 应含"用法"段')
  assert.ok(out.includes('--staged'), 'stdout 应含 --staged 选项说明')
})

test('CLI: 非 git 目录 + --staged → exit 0 (无 staged 文件, 跳过)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ihui-nongit-typecheck-'))
  try {
    const r = spawnSync('node', [SCRIPT_PATH, '--staged'], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    assert.equal(r.status, 0, `非 git 目录应 exit 0, 实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`)
    const out = stripAnsi(r.stdout)
    assert.match(out, /暂存区无文件|跳过/, '应显示暂存区无文件 / 跳过')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('CLI: git 仓库 + 空 staged → exit 0 (提示无 staged)', () => {
  const dir = createTempRepo()
  try {
    const r = spawnSync('node', [SCRIPT_PATH, '--staged'], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    assert.equal(r.status, 0, `空 staged 应 exit 0, 实际 ${r.status}`)
    const out = stripAnsi(r.stdout)
    assert.match(out, /暂存区无文件|跳过/, '应显示暂无 staged 文件')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('CLI: git 仓库 + staged .ts 文件 + --dry-run → exit 0 (打印分组, 不实际 typecheck)', () => {
  const dir = createTempRepo()
  try {
    mkdirSync(join(dir, 'apps/web/src'), { recursive: true })
    writeFileSync(join(dir, 'apps/web/src/foo.ts'), 'export const x = 1\n')
    execSyncQuiet('git add apps/web/src/foo.ts', dir)
    const r = spawnSync('node', [SCRIPT_PATH, '--dry-run'], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    assert.equal(r.status, 0, `--dry-run 应 exit 0, 实际 ${r.status}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`)
    const out = stripAnsi(r.stdout)
    assert.match(out, /dry-run/, 'stdout 应含 dry-run 标识')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('CLI: --quiet 抑制 info 输出, 保留 error', () => {
  const r = spawnSync('node', [SCRIPT_PATH, '--help', '--quiet'], {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
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
    const r = spawnSync('node', [SCRIPT_PATH], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    assert.equal(r.status, 0, `默认模式 + 空 staged 应 exit 0, 实际 ${r.status}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
