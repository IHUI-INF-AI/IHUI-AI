// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync, rmSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SCRIPT_PATH = join(__dirname, '..', 'check-workspace-hygiene.mjs')
const PROJECT_ROOT = join(__dirname, '..', '..')

/**
 * 夹具落点 = 仓库树**外**的 scratch,经 `--root` 显式喂给被测脚本(2026-09-25 换的落点)。
 *
 * 此前它只能落在被扫描的真仓树里(源脚本 ROOT 由自身位置推导、不认 cwd,见守门 70 同型教训),
 * 代价实测两条:① 一次 SIGKILL(宿主清树/超时)就把带 `$env:TEMP\…` 字面量的夹具永久留在盘上,
 * 之后每次全量审计都报一条"项目数据写到系统 temp"的**假违规**,而违规者早已不存在
 * (2026-09-25 盘上还挂着 19:23 那一轮的残留);② 并行会话正在跑的那一轮,会把本文件的
 * "基线干净 / 豁免应 exit 0"两条断言踩红 —— 因为它的夹具也在同一棵扫描树里。
 * 换落点对两条都是根治,而不是再加一层容错。
 */
const FIXTURE_ROOT = mkScratch('hygiene-')
// 旧版本(可能仍跑在别的会话进程里)往这里落夹具,只清陈年的,别踩年轻那一份
const LEGACY_FIXTURE_PARENT = join(PROJECT_ROOT, '.ihui-agent', 'tmp')
const STALE_FIXTURE_MS = 30 * 60 * 1000

function listLegacyFixtures() {
  try {
    return readdirSync(LEGACY_FIXTURE_PARENT).filter((n) => n.startsWith('hygiene-test-'))
  } catch {
    return []
  }
}

/** 开局自愈:清掉"上一轮没走完就死掉"的残留夹具(年龄闸是必需的,不是可选)。 */
function sweepStaleLegacyFixtures() {
  const cutoff = Date.now() - STALE_FIXTURE_MS
  let swept = 0
  for (const name of listLegacyFixtures()) {
    const full = join(LEGACY_FIXTURE_PARENT, name)
    try {
      if (statSync(full).mtimeMs > cutoff) continue
      rmSync(full, { recursive: true, force: true })
      swept += 1
    } catch {
      // 目录正被占用等情形:下一轮再清,绝不自愈把测试自身弄红
    }
  }
  return swept
}

const sweptAtStart = sweepStaleLegacyFixtures()
if (sweptAtStart > 0) console.log(`  [自愈] 清掉旧落点残留夹具 ${sweptAtStart} 个`)

// ─── 拼接违规字符串(拆分写,避免本测试文件被守门脚本自检命中) ───
// 源脚本同时扫描本测试文件;若同行出现 "C:\temp\ihui-ext" 等连续模式会自伤。
// 用 cat() 拆分后,源码行内无连续违规模式,运行时拼接还原为单反斜杠路径。
const cat = (...parts) => parts.join('')

const createdDirs = []
let counter = 0

function makeFixture(label) {
  counter += 1
  const dir = join(FIXTURE_ROOT, `hygiene-test-${counter}-${label}-${Date.now()}`)
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
function runRaw(args = []) {
  const r = spawnSync('node', [SCRIPT_PATH, ...args], {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  r.out = (r.stdout || '').replace(/\x1b\[[0-9;]*m/g, '')
  r.err = (r.stderr || '').replace(/\x1b\[[0-9;]*m/g, '')
  return r
}

/**
 * 夹具用例的默认入口:一律只扫 scratch 那一棵 ROOT。
 * 刻意把 `--root` 收在这一处而非每个用例里 —— 漏写一次的后果是"该用例回退成全仓扫描"
 * (单用例 ~90s、且把别人在飞的夹具算进判定),而不是编译不过,故不给它留可漏的空间。
 */
function runScript(args = []) {
  return runRaw(['--root', FIXTURE_ROOT, ...args])
}

/** 全仓口径:只有"真仓基线必须干净"这三条用,一条 = 一次整仓扫描(~90s)。 */
function runOnRepo(args = []) {
  return runRaw(args)
}

// 兜底清理:即使某测试 try/finally 未执行,after 钩子也会清掉所有 fixture
after(() => {
  for (const dir of createdDirs) {
    rmSync(dir, { recursive: true, force: true })
  }
  rmScratch(FIXTURE_ROOT)
})

test('落点:夹具 ROOT 必须在仓库树外(否则残留又会落进被扫描面)', () => {
  assert.ok(existsSync(FIXTURE_ROOT), `scratch 未创建: ${FIXTURE_ROOT}`)
  const rel = relative(PROJECT_ROOT, FIXTURE_ROOT)
  assert.ok(rel.startsWith('..'), `夹具落点逃不出仓库树(rel=${rel})⇒ 残留会永久挂在扫描面里`)
})

// ─── 1. CLI 行为 / 基线(受版本控制的内容面必须干净)─────────────

/**
 * 「真仓基线干净」判的是**被跟踪的内容面**,不是这台机此刻的磁盘 —— 由实测逼出:
 * 全仓扫描把 `.ihui-agent/tmp/continue-session-20260923/*.cjs`(另一个会话 09-23 留下的
 * 临时脚本,`.gitignore` 忽略、不在任何检出里)计成 3 处 warning,于是这两条断言与任何提交
 * 都无关地恒红。而 §15 恰恰规定"临时脚本→`.ihui-agent/tmp/<任务名>`、任务完成后清理":
 * **本仓指定的垃圾场本身是扫描面**,谁也无法保证它此刻是空的 —— 拿它当判据等于把
 * "别人会话的运行态"记成"我们的存量债"(§12e/守门 77/83 同型,恒红门的结局只逼人 --no-verify)。
 *
 * 所以判据换成不变量:**受版本控制的文件里不得有 hygiene 违规**;退出码仍照原样判
 * (blocking 一条都不许有)。未跟踪的临时物照实打印,不静默 —— 只看不到不等于没有。
 * 源脚本本身一个字没改,它的扫描面与定级都不动。
 */
const trackedSet = new Set(
  spawnSync('git', ['ls-files', '-z'], { cwd: PROJECT_ROOT, encoding: 'utf8', windowsHide: true })
    .stdout.split('\0')
    .filter(Boolean),
)

/** 从报告里取违规行的文件路径(形如 `  <path>:<line>  [规则名]`,不含 `> 源码` 那行) */
function violatingPaths(out) {
  return [...out.matchAll(/^ {2}(\S+?):\d+\s+\[/gm)].map((m) => m[1].replace(/\\/g, '/'))
}

/**
 * 报告是**分流**的:汇总行走 stdout,逐条明细(`  path:line [规则]`)走 stderr(实测:
 * `node scripts/check-workspace-hygiene.mjs 2>/dev/null` 只剩一行汇总)。
 * 所以取违规面必须拼两个流 —— 只读 stdout 的那把尺子会永远数到 0 条,
 * 于是"断言通过"与"什么都没判"长得一模一样(§判据失效的表现永远是安静)。
 */
function reportOf(r) {
  // out/err 是 runRaw 剥过 ANSI 色码的版本;裸 stdout/stderr 只作兜底(带色会打断行首锚定)。
  return `${r.out ?? r.stdout ?? ''}${r.err ?? r.stderr ?? ''}`
}

/** 违规里属于"仓库内容"(被跟踪)的那一部分 —— 这才是本断言要拦的债 */
function trackedViolations(out) {
  return violatingPaths(out).filter((p) => trackedSet.has(p))
}

test('CLI: 默认模式(受跟踪内容面干净)→ exit 0 且无一条违规来自被跟踪文件', () => {
  const r = runOnRepo()
  assert.equal(r.status, 0, `基线应 exit 0\nstdout: ${r.out}\nstderr: ${r.err}`)
  const rep = reportOf(r)
  const ours = trackedViolations(rep)
  const untracked = violatingPaths(rep).filter((p) => !trackedSet.has(p))
  if (untracked.length)
    console.log(
      `  ℹ️  ${untracked.length} 处 warning 来自未跟踪的会话临时物(不计入本仓债):${untracked.join(', ')}`,
    )
  assert.deepEqual(ours, [], `受版本控制的文件里有 hygiene 违规:${ours.join(', ')}`)
  if (untracked.length === 0) assert.match(r.out, /无违规/, '整棵盘面都干净时,源脚本必须打"无违规"')
})

test('CLI: --warn 模式(受跟踪内容面干净)→ exit 0 且无一条违规来自被跟踪文件', () => {
  const r = runOnRepo(['--warn'])
  assert.equal(r.status, 0, `--warn 基线应 exit 0\nstdout: ${r.out}`)
  assert.deepEqual(trackedViolations(reportOf(r)), [], 'warn 档同样不得让被跟踪文件带着违规通过')
})

test('CLI: --staged 模式(无 staged 脚本)→ exit 0 + "跳过"/"无违规" 提示', () => {
  const r = runOnRepo(['--staged'])
  // 测试环境通常无 staged 脚本文件;若有 staged 且无违规也 exit 0
  assert.equal(r.status, 0, `--staged 应 exit 0\nstdout: ${r.out}\nstderr: ${r.err}`)
  assert.match(r.out, /跳过|无违规/)
})

test('基线判据有牙(成对):被跟踪文件的违规必须算进红线,未跟踪临时物必须被剔出但不静默', () => {
  // 正例:同名报告形态、路径换成**真被跟踪**的文件 ⇒ 必须落到 trackedViolations 里
  // (没有这一条,"只判被跟踪面"就是一句可以被任意放宽的过滤)。
  const trackedPath = trackedSet.has('scripts/check-workspace-hygiene.mjs')
    ? 'scripts/check-workspace-hygiene.mjs'
    : [...trackedSet][0]
  assert.ok(trackedPath, '前提:git ls-files 必须给出被跟踪清单(空清单 ⇒ 本断言恒真,尺子失效)')
  const fake = `⚠️  workspace-hygiene [WARNING]: 1 处硬编码中文路径(不阻塞,但建议修复)\n  ${trackedPath}:7  [某规则]\n    > const a = 1\n`
  assert.deepEqual(trackedViolations(fake), [trackedPath], '被跟踪路径必须被认成本仓违规')
  assert.deepEqual(violatingPaths(fake).length, 1, '违规行提取必须恰好一条')
  // 反例:未跟踪的会话临时物形态(真实报告里那三条就是这个形状)⇒ 不算本仓债,但仍要被 violatingPaths 看见
  const junk = '  .ihui-agent/tmp/some-dead-session/dump.cjs:2  [某规则]\n    > const a = 1\n'
  assert.deepEqual(trackedViolations(junk), [], '未跟踪临时物不得算进红线')
  assert.equal(violatingPaths(junk).length, 1, '未跟踪违规必须仍被数到(只报数,不静默)')
  // `> 源码` 续行不得被当成违规路径,否则同一条违规会被数两遍
  assert.deepEqual(violatingPaths('    > const a = 1\n'), [], '源码续行不得计为违规')
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
      'C:',
      '\\',
      'Users',
      '\\',
      'u',
      '\\',
      'AppData',
      '\\',
      'Local',
      '\\',
      'Temp',
      '\\',
      'd.json',
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
