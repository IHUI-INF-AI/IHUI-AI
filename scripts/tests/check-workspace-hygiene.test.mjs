import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-workspace-hygiene.mjs')
const PROJECT_ROOT = join(__dirname, '..', '..')
// 源脚本 ROOT 由 import.meta.url 推导,始终扫描 g:\IHUI-AI\
// .trae-cn/tmp/ 被 scanDir(ROOT→.trae-cn→tmp) 递归扫描且已 gitignore,
// 是唯一可被脚本检测到的 fixture 落点(不污染 git)
const FIXTURE_PARENT = join(PROJECT_ROOT, '.trae-cn', 'tmp')

// ─── 拼接违规字符串(拆分写,避免本测试文件被守门脚本自检命中) ───
// 源脚本同时扫描本测试文件;若同行出现 "C:\temp\ihui-ext" 等连续模式会自伤。
// 用 cat() 拆分后,源码行内无连续违规模式,运行时拼接还原为单反斜杠路径。
const cat = (...parts) => parts.join('')

const createdDirs = []
let counter = 0

function makeFixture(label) {
  counter += 1
  const dir = join(FIXTURE_PARENT, `hygiene-test-${counter}-${label}-${Date.now()}`)
  mkdirSync(dir, { recursive: true })
  createdDirs.push(dir)
  return dir
}

function writeFixture(dir, name, content) {
  writeFileSync(join(dir, name), content)
}

function cleanup(dir) {
  rmSync(dir, { recursive: true, force: true })
}

// 运行脚本并去除 ANSI 颜色码,便于正则断言
function runScript(args = []) {
  const r = spawnSync('node', [SCRIPT_PATH, ...args], {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  r.out = (r.stdout || '').replace(/\x1b\[[0-9;]*m/g, '')
  r.err = (r.stderr || '').replace(/\x1b\[[0-9;]*m/g, '')
  return r
}

// 兜底清理:即使某测试 try/finally 未执行,after 钩子也会清掉所有 fixture
after(() => {
  for (const dir of createdDirs) {
    rmSync(dir, { recursive: true, force: true })
  }
})

// ─── 1. CLI 行为 / 基线(项目当前状态干净) ─────────────────

test('CLI: 默认模式(基线干净)→ exit 0 + stdout 含 "无违规"', () => {
  const r = runScript()
  assert.equal(r.status, 0, `基线应 exit 0\nstdout: ${r.out}\nstderr: ${r.err}`)
  assert.match(r.out, /无违规/)
})

test('CLI: --warn 模式(基线干净)→ exit 0 + stdout 含 "无违规"', () => {
  const r = runScript(['--warn'])
  assert.equal(r.status, 0, `--warn 基线应 exit 0\nstdout: ${r.out}`)
  assert.match(r.out, /无违规/)
})

test('CLI: --staged 模式(无 staged 脚本)→ exit 0 + "跳过"/"无违规" 提示', () => {
  const r = runScript(['--staged'])
  // 测试环境通常无 staged 脚本文件;若有 staged 且无违规也 exit 0
  assert.equal(r.status, 0, `--staged 应 exit 0\nstdout: ${r.out}\nstderr: ${r.err}`)
  assert.match(r.out, /跳过|无违规/)
})

// ─── 2. BLOCKING 违规:项目外路径写入(核心规则,AGENTS.md §15) ───

test('BLOCKING: 系统盘 temp 写项目数据(非 .log/.txt)→ exit 1 + stderr 报告', () => {
  const dir = makeFixture('blk-temp')
  try {
    // 运行时拼接为 C:\temp\ihui-ext\data.json(单反斜杠,触发 BLOCKING 1)
    const v = cat('C:', '\\', 'temp', '\\', 'ihui-ext', '\\', 'data.json')
    writeFixture(dir, 'v.mjs', `const p = '${v}'\n`)
    const r = runScript()
    assert.equal(r.status, 1, `BLOCKING 应 exit 1\nstdout: ${r.out}\nstderr: ${r.err}`)
    assert.match(r.err, /BLOCK|项目外路径违规/)
    assert.match(r.err, /v\.mjs/)
  } finally {
    cleanup(dir)
  }
})

test('BLOCKING: $env:TEMP 写项目数据 → exit 1', () => {
  const dir = makeFixture('blk-env')
  try {
    // 运行时拼接为 $env:TEMP\ihui-prof\cfg.json
    const v = cat('$', 'env:TEMP', '\\', 'ihui-prof', '\\', 'cfg.json')
    writeFixture(dir, 'v.mjs', `const p = '${v}'\n`)
    const r = runScript()
    assert.equal(r.status, 1, `BLOCKING 应 exit 1\nstderr: ${r.err}`)
    assert.match(r.err, /v\.mjs/)
  } finally {
    cleanup(dir)
  }
})

test('BLOCKING: AppData\\Local\\Temp 写项目数据 → exit 1', () => {
  const dir = makeFixture('blk-appdata')
  try {
    // 运行时拼接为 C:\Users\u\AppData\Local\Temp\d.json
    const v = cat(
      'C:', '\\', 'Users', '\\', 'u', '\\',
      'AppData', '\\', 'Local', '\\', 'Temp', '\\', 'd.json',
    )
    writeFixture(dir, 'v.mjs', `const p = '${v}'\n`)
    const r = runScript()
    assert.equal(r.status, 1, `BLOCKING 应 exit 1\nstderr: ${r.err}`)
    assert.match(r.err, /v\.mjs/)
  } finally {
    cleanup(dir)
  }
})

test('BLOCKING: 相对路径跳出项目(..\\..\\)+ Copy-Item 文件写入 → exit 1', () => {
  const dir = makeFixture('blk-rel')
  try {
    // 运行时拼接为 Copy-Item ..\..\foo.txt(单反斜杠)
    const content = 'Copy-Item ..' + '\\' + '..' + '\\' + 'foo.txt\n'
    writeFixture(dir, 'v.ps1', content)
    const r = runScript()
    assert.equal(r.status, 1, `BLOCKING 应 exit 1\nstderr: ${r.err}`)
    assert.match(r.err, /v\.ps1/)
    assert.match(r.err, /跳出项目|相对路径/)
  } finally {
    cleanup(dir)
  }
})

// ─── 3. WARNING 违规:硬编码中文路径(不阻塞,提醒) ───────────

test('WARNING: 硬编码中文路径 d:\\桌面\\foo → exit 0(warning 不阻塞)+ stderr 警告', () => {
  const dir = makeFixture('warn-cn')
  try {
    // 运行时拼接为 d:\桌面\foo
    const v = cat('d:', '\\', '桌面', '\\', 'foo')
    writeFixture(dir, 'v.mjs', `const p = '${v}'\n`)
    const r = runScript()
    // WARNING 级别不阻塞,exit 0
    assert.equal(r.status, 0, `WARNING 应 exit 0\nstdout: ${r.out}\nstderr: ${r.err}`)
    // 警告输出到 stderr
    assert.match(r.err, /WARNING|warning|中文路径/)
    assert.match(r.err, /v\.mjs/)
  } finally {
    cleanup(dir)
  }
})

// ─── 4. 豁免场景(行级白名单)→ 不检测 ─────────────────────

test('豁免: 注释行(# 开头)含违规路径 → 不检测(exit 0)', () => {
  const dir = makeFixture('exempt-cmt')
  try {
    const v = cat('C:', '\\', 'temp', '\\', 'ihui-ext', '\\', 'd.json')
    // # 开头的行被 isLineWhitelisted 跳过
    writeFixture(dir, 'f.mjs', `# ${v}\n`)
    const r = runScript()
    assert.equal(r.status, 0, `注释行应豁免\nstdout: ${r.out}\nstderr: ${r.err}`)
    assert.doesNotMatch(r.err, /f\.mjs/)
  } finally {
    cleanup(dir)
  }
})

test('豁免: 含 "禁止" 的行 → 不检测(exit 0)', () => {
  const dir = makeFixture('exempt-ban')
  try {
    const v = cat('C:', '\\', 'temp', '\\', 'ihui-ext', '\\', 'd.json')
    // 行含 "禁止" 被 isLineWhitelisted 跳过(规则文档反面案例)
    writeFixture(dir, 'f.mjs', `const p = '${v}' // 禁止使用此路径\n`)
    const r = runScript()
    assert.equal(r.status, 0, `含"禁止"应豁免\nstdout: ${r.out}\nstderr: ${r.err}`)
    assert.doesNotMatch(r.err, /f\.mjs/)
  } finally {
    cleanup(dir)
  }
})

test('豁免: .log 文件路径在 temp → 不检测(exit 0,系统日志例外)', () => {
  const dir = makeFixture('exempt-log')
  try {
    const v = cat('C:', '\\', 'temp', '\\', 'ihui-ext', '\\', 'debug.log')
    // .log 后跟引号 → isLineWhitelisted 命中(系统日志例外)
    writeFixture(dir, 'f.mjs', `const log = '${v}'\n`)
    const r = runScript()
    assert.equal(r.status, 0, `.log 应豁免\nstdout: ${r.out}\nstderr: ${r.err}`)
    assert.doesNotMatch(r.err, /f\.mjs/)
  } finally {
    cleanup(dir)
  }
})

test('豁免: --redirect 参数行 → 不检测(exit 0)', () => {
  const dir = makeFixture('exempt-redir')
  try {
    const v = cat('C:', '\\', 'temp', '\\', 'ihui-ext', '\\', 'out.bin')
    // 行含 --redirect 被 isLineWhitelisted 跳过(日志重定向例外)
    writeFixture(dir, 'f.ps1', `--redirect ${v}\n`)
    const r = runScript()
    assert.equal(r.status, 0, `--redirect 应豁免\nstdout: ${r.out}\nstderr: ${r.err}`)
    assert.doesNotMatch(r.err, /f\.ps1/)
  } finally {
    cleanup(dir)
  }
})

// ─── 5. 模式对比:--warn 降级 vs 默认阻塞 ─────────────────

test('模式: --warn + BLOCKING 违规 → exit 0(降级,stderr 仍输出警告)', () => {
  const dir = makeFixture('mode-warn')
  try {
    const v = cat('C:', '\\', 'temp', '\\', 'ihui-ext', '\\', 'd.json')
    writeFixture(dir, 'v.mjs', `const p = '${v}'\n`)
    const r = runScript(['--warn'])
    // --warn 模式下 BLOCKING 不阻塞,exit 0
    assert.equal(r.status, 0, `--warn 应 exit 0\nstdout: ${r.out}\nstderr: ${r.err}`)
    // 但 stderr 仍输出 [WARN] 报告
    assert.match(r.err, /WARN|BLOCK|workspace-hygiene/)
    assert.match(r.err, /v\.mjs/)
  } finally {
    cleanup(dir)
  }
})

test('模式: 默认 + BLOCKING 违规 → exit 1(阻塞,与 --warn 形成对比)', () => {
  const dir = makeFixture('mode-blk')
  try {
    const v = cat('C:', '\\', 'temp', '\\', 'ihui-ext', '\\', 'd.json')
    writeFixture(dir, 'v.mjs', `const p = '${v}'\n`)
    const r = runScript()
    assert.equal(r.status, 1, `默认应 exit 1\nstderr: ${r.err}`)
    assert.match(r.err, /BLOCK|项目外路径违规/)
    assert.match(r.err, /v\.mjs/)
  } finally {
    cleanup(dir)
  }
})
