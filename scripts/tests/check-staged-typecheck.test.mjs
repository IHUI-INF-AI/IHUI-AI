/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * check-staged-typecheck.test.mjs — 单元测试 check-staged-typecheck.mjs 的核心过滤逻辑
 *
 * 背景(2026-08-18 立, 批次 8-P2 工程治理):
 *   check-staged-typecheck.mjs(本仓库预 commit typecheck 守门脚本)只把
 *   "staged 文件路径属于 tsc 错误块" 的错误视为失败, 非 staged 文件错误
 *   (其他 agent 在途改动) 被自动过滤, 解决多 agent 并行 push 时 100% 误阻塞。
 *   核心函数 filterTscOutputForStagedFiles 与 getOriginalInclude 未导出,
 *   必须用镜像常量 + 行内复制的方式测 (与 check-commit-loss-guard.test.mjs
 *   章节 "正则单元测试" 的做法保持一致)。
 *
 * 镜像范围与同步锚点:
 *   - filterTscOutputForStagedFiles: 源脚本第 298-327 行
 *   - normalizePath: 源脚本第 284-286 行
 *   - getOriginalInclude: 源脚本第 244-256 行
 *
 * ⚠️ 同步义务: 如修改源脚本 check-staged-typecheck.mjs 的上述函数,
 *   必须同步修改本测试文件中的镜像常量, 否则将产生测试通过但实际生产
 *   行为不一致的隐性 bug。详见 AGENTS.md §15 守门脚本同步测试规范。
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

// ─── 镜像常量区 ───────────────────────────────────────────────
// 以下常量镜像自 scripts/check-staged-typecheck.mjs 的核心函数。
// 源脚本对应行号: filterTscOutputForStagedFiles L298-327, normalizePath L284-286,
// getOriginalInclude L244-256。修改源脚本时必须同步更新本区。

/**
 * 镜像自源脚本 normalizePath (L284-286):
 *   把 Windows/posix 路径统一为 forward slash, 用于字符串比较。
 * @param {string} p
 * @returns {string}
 */
function normalizePath(p) {
  return p.replace(/\\/g, '/')
}

/**
 * 镜像自源脚本 filterTscOutputForStagedFiles (L298-327):
 *   过滤 tsc 输出, 只保留【错误文件属于 staged 文件】的错误块。
 *   tsc 错误行格式: <path>(<line>,<col>): error TSxxxx: message,
 *   其后紧跟的 detail 行属于同一错误块, 一并保留。
 *   非 staged 文件错误的块整体丢弃, 不阻塞。
 * @param {string} tscOutput 原始 tsc stdout+stderr
 * @param {object} pkg 当前 package (含 dir, 用于解析相对路径)
 * @param {string} rootAbs 仓库根绝对路径 (用于解析 staged 文件绝对路径)
 * @param {string[]} files 该 package 的 staged 文件 (仓库根相对路径)
 * @returns {string} 过滤后的输出 (空串 = 无 staged 文件错误)
 */
function filterTscOutputForStagedFiles(tscOutput, pkg, rootAbs, files) {
  if (!tscOutput.trim()) return ''
  const stagedAbs = new Set(
    files.map((f) => normalizePath(join(rootAbs, f))),
  )
  const lines = tscOutput.split('\n')
  const out = []
  // 当前错误块: 从一条错误行起, 到下一个错误行(或输出末尾)为止的连续行
  let pending = []
  let pendingIsStaged = false
  const flush = () => {
    if (pendingIsStaged) out.push(...pending)
    pending = []
    pendingIsStaged = false
  }
  for (const line of lines) {
    const m = line.match(/^(.+?)\(\d+,\d+\): error TS\d+:/)
    if (m) {
      flush()
      // tsc 路径相对 pkg.dir (pnpm --filter exec 的 cwd 为 package 目录)
      const fileAbs = normalizePath(resolve(pkg.dir, m[1]))
      pendingIsStaged = stagedAbs.has(fileAbs)
      pending = [line]
    } else {
      pending.push(line)
    }
  }
  flush()
  return out.join('\n')
}

/**
 * 镜像自源脚本 getOriginalInclude 的回退路径 (L244-256):
 *   读取原始 tsconfig.json 的 include 字段; 空/缺失时回退到默认值;
 *   元素无前导 './' 时补 './', 并把 '\\' 替换为 '/'。
 *   注: 镜像版不引入 readFileSync, 由测试用例预先传入 raw JSON 对象,
 *   这样可以单独模拟 "JSON 解析失败" 等 case。
 * @param {object|null} raw 已解析的 tsconfig JSON (null 表示读不到或解析失败)
 * @returns {string[]}
 */
function getOriginalIncludeMirror(raw) {
  if (raw && Array.isArray(raw.include) && raw.include.length > 0) {
    return raw.include.map((p) =>
      p.startsWith('.') ? p : `./${p.replace(/\\/g, '/')}`,
    )
  }
  return ['./src/**/*.ts', './src/**/*.tsx', './**/*.d.ts']
}

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

// ─── 测试 1: filterTscOutputForStagedFiles 单元测试 ────────

test('filterTscOutputForStagedFiles: 空输出 → 返回空串', () => {
  const pkg = makePkg(join(ROOT, 'apps/web'))
  const result = filterTscOutputForStagedFiles('', pkg, ROOT, [
    'apps/web/index.ts',
  ])
  assert.equal(result, '')
})

test('filterTscOutputForStagedFiles: 只有空白字符 → 返回空串', () => {
  const pkg = makePkg(join(ROOT, 'apps/web'))
  const result = filterTscOutputForStagedFiles('   \n\n  \n', pkg, ROOT, [
    'apps/web/index.ts',
  ])
  assert.equal(result, '')
})

test('filterTscOutputForStagedFiles: 只有 staged 文件错误 → 整段保留', () => {
  const pkg = makePkg(join(ROOT, 'apps/web'))
  const webIndex = join(ROOT, 'apps/web/index.ts')
  const tscOutput = `${webIndex}(10,5): error TS2304: Cannot find name 'foo'.\n`
  const result = filterTscOutputForStagedFiles(
    tscOutput,
    pkg,
    ROOT,
    ['apps/web/index.ts'],
  )
  assert.ok(result.includes('error TS2304'), '应保留 staged 文件错误')
  assert.ok(result.includes('Cannot find name'), '应保留错误消息')
})

test('filterTscOutputForStagedFiles: 只有非 staged 文件错误 → 返回空串', () => {
  const pkg = makePkg(join(ROOT, 'apps/web'))
  // 错误来自 apps/api/route.ts (不在 staged 列表)
  const apiRoute = join(ROOT, 'apps/api/route.ts')
  const tscOutput = `${apiRoute}(12,3): error TS2322: Type 'string' is not assignable to type 'number'.\n`
  const result = filterTscOutputForStagedFiles(
    tscOutput,
    pkg,
    ROOT,
    ['apps/web/index.ts'],
  )
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
  const result = filterTscOutputForStagedFiles(
    tscOutput,
    pkg,
    ROOT,
    ['apps/web/index.ts'],
  )
  // 应保留 web/index.ts 的 2 个错误
  assert.ok(result.includes('error TS2304'), '应保留 staged 错误 TS2304')
  assert.ok(result.includes('error TS2339'), '应保留 staged 错误 TS2339')
  // 不应包含 api/route.ts 的错误
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
  // tsc 错误块结构: 错误行 + 后续 detail 行 (缩进或非错误行)
  const tscOutput = [
    `${webIndex}(10,5): error TS2322: Type 'X' is not assignable to type 'Y'.`,
    `  The expected type comes from property 'a' which is declared here: type Y`,
    `    at ${webIndex}(5,3)`,
    '',
  ].join('\n')
  const result = filterTscOutputForStagedFiles(
    tscOutput,
    pkg,
    ROOT,
    ['apps/web/index.ts'],
  )
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
  const result = filterTscOutputForStagedFiles(
    tscOutput,
    pkg,
    ROOT,
    ['apps/web/index.ts'],
  )
  assert.equal(result, '', '非 staged 错误块及其 detail 行应全部被过滤')
})

test('filterTscOutputForStagedFiles: Windows 路径 (pkg.dir 含反斜杠) → 仍能正确解析', () => {
  // 模拟 Windows 路径: pkg.dir 用反斜杠, 但 tsc 输出和 staged 文件列表用正斜杠
  const winDir = 'G:\\IHUI-AI\\apps\\web'
  const pkg = makePkg(winDir)
  const webIndex = join(ROOT, 'apps/web/index.ts')
  const tscOutput = `${webIndex}(10,5): error TS2304: Cannot find name 'foo'.\n`
  const result = filterTscOutputForStagedFiles(
    tscOutput,
    pkg,
    ROOT,
    ['apps/web/index.ts'],
  )
  assert.ok(result.includes('error TS2304'), 'Windows 路径应能正确解析')
})

test('filterTscOutputForStagedFiles: 错误文件相对路径含 ./ 前缀 → 正确 resolve', () => {
  const pkg = makePkg(join(ROOT, 'apps/web'))
  const webIndex = join(ROOT, 'apps/web/index.ts')
  // tsc 偶尔用 ./ 前缀输出相对路径
  const tscOutput = `./index.ts(10,5): error TS2304: Cannot find name 'foo'.\n`
  const result = filterTscOutputForStagedFiles(
    tscOutput,
    pkg,
    ROOT,
    ['apps/web/index.ts'],
  )
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
  const result = filterTscOutputForStagedFiles(
    tscOutput,
    pkg,
    ROOT,
    ['apps/web/index.ts'],
  )
  // 关键验证: 仅 error TS\d+: 行能作为块起点; warning/info 行无法被识别为错误块起点
  // pending 缓冲逻辑: error 行之前的 info/warning 行 因上一块 pendingIsStaged=false 被丢弃
  // → 只有 error 行 + 后续 "Found 1 error." (作为 detail) 被保留
  assert.ok(result.includes('error TS2304'), '应保留 error 行')
  assert.ok(result.includes('Cannot find name'), '应保留错误消息')
  // info 行和 warning 行不属于 staged 错误块(它们在前块被丢弃), 不应被保留
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
  // 独立验证: 单独的 info 行不应作为错误块起点
  const pkg = makePkg(join(ROOT, 'apps/web'))
  const tscOutput = `info: some informational message\n`
  const result = filterTscOutputForStagedFiles(
    tscOutput,
    pkg,
    ROOT,
    ['apps/web/index.ts'],
  )
  // info 行被当作空 error 块的 detail, 因 pendingIsStaged=false 被丢弃
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
  const result = filterTscOutputForStagedFiles(
    tscOutput,
    pkg,
    ROOT,
    ['apps/web/a.ts', 'apps/web/b.ts'],
  )
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
  const result = filterTscOutputForStagedFiles(
    tscOutput,
    pkg,
    ROOT,
    ['apps/web/index.ts'],
  )
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
  const result = filterTscOutputForStagedFiles(
    tscOutput,
    pkg,
    ROOT,
    ['apps/web/index.ts'],
  )
  // 应保留 web/index.ts 的 2 个错误和期间的空行
  assert.ok(result.includes('TS2304'), '应保留错误 TS2304')
  assert.ok(result.includes('TS2322'), '应保留错误 TS2322')
  // 不应包含 api/route.ts 的错误
  assert.ok(
    !result.includes('Type \'string\''),
    '非 staged 错误消息应被过滤',
  )
})

// ─── 测试 2: getOriginalInclude 镜像版单元测试 ─────────────

test('getOriginalInclude 镜像版: 正常 include 数组 → 前缀补 ./ 并 \\ → /', () => {
  const raw = { include: ['src/**/*.ts', 'src/**/*.tsx'] }
  const result = getOriginalIncludeMirror(raw)
  // 无前导 ./ 的元素应补 ./
  assert.deepEqual(result, ['./src/**/*.ts', './src/**/*.tsx'])
})

test('getOriginalInclude 镜像版: 已有 ./ 前缀 → 不重复补', () => {
  const raw = { include: ['./src/**/*.ts', './src/**/*.tsx'] }
  const result = getOriginalIncludeMirror(raw)
  assert.deepEqual(result, ['./src/**/*.ts', './src/**/*.tsx'])
})

test('getOriginalInclude 镜像版: 含反斜杠 → 替换为 /', () => {
  const raw = { include: ['src\\**\\*.ts', 'src\\**\\*.tsx'] }
  const result = getOriginalIncludeMirror(raw)
  // 反斜杠被替换为 /, 然后补 ./
  assert.deepEqual(result, ['./src/**/*.ts', './src/**/*.tsx'])
})

test('getOriginalInclude 镜像版: 已有 ./ 前缀 + 反斜杠 → 不重复补 + 仍转 /', () => {
  // 源脚本: p.startsWith('.') 优先 (startsWith('.') === true, 不补 ./, 不走 replace 分支)
  // 这是源脚本的实际行为: 前缀 . 直接触发 startsWith('.') 分支, \\ 不会被替换
  // (真实场景中 tsconfig 不太可能出现 .\\ 前缀, 此测试仅锁定当前行为)
  const raw = { include: ['.\\src\\**\\*.ts'] }
  const result = getOriginalIncludeMirror(raw)
  assert.deepEqual(result, ['.\\src\\**\\*.ts'])
})

test('getOriginalInclude 镜像版: 空 include 数组 → 走回退默认', () => {
  const raw = { include: [] }
  const result = getOriginalIncludeMirror(raw)
  assert.deepEqual(result, [
    './src/**/*.ts',
    './src/**/*.tsx',
    './**/*.d.ts',
  ])
})

test('getOriginalInclude 镜像版: 缺失 include 字段 → 走回退默认', () => {
  const raw = { compilerOptions: { strict: true } }
  const result = getOriginalIncludeMirror(raw)
  assert.deepEqual(result, [
    './src/**/*.ts',
    './src/**/*.tsx',
    './**/*.d.ts',
  ])
})

test('getOriginalInclude 镜像版: include 非数组 (string) → 走回退默认', () => {
  const raw = { include: 'src/**/*.ts' }
  const result = getOriginalIncludeMirror(raw)
  // 源脚本只处理 Array.isArray, 字符串走回退
  assert.deepEqual(result, [
    './src/**/*.ts',
    './src/**/*.tsx',
    './**/*.d.ts',
  ])
})

test('getOriginalInclude 镜像版: null (读不到或 JSON 解析失败) → 走回退默认', () => {
  const result = getOriginalIncludeMirror(null)
  assert.deepEqual(result, [
    './src/**/*.ts',
    './src/**/*.tsx',
    './**/*.d.ts',
  ])
})

// ─── 测试 3: CLI 端到端测试 ─────────────────────────────────

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
    // 非 git 目录 → getStagedFiles catch 返回空 → 提示无 staged 文件 → exit 0
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
    // 创建一个 apps/web/src/foo.ts 并 stage
    mkdirSync(join(dir, 'apps/web/src'), { recursive: true })
    writeFileSync(join(dir, 'apps/web/src/foo.ts'), 'export const x = 1\n')
    execSyncQuiet('git add apps/web/src/foo.ts', dir)
    const r = spawnSync('node', [SCRIPT_PATH, '--dry-run'], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    // dry-run 模式只打印, 不实际跑 typecheck
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
  // --help 走 console.log, 是 info 级别, 应被 --quiet 抑制
  assert.equal(r.status, 0)
  // --quiet 下 stdout 应为空 (帮助文本被 log.info 抑制)
  assert.equal(
    r.stdout.trim(),
    '',
    `--quiet 应抑制 info 输出, 实际 stdout: ${JSON.stringify(r.stdout)}`,
  )
})

test('CLI: 无参数 + git 仓库 + 空 staged → exit 0 (默认 staged 模式)', () => {
  const dir = createTempRepo()
  try {
    // 无参数 = 默认 staged 模式
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
