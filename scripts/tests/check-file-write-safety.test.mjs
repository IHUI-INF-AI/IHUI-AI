// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 `scripts/check-file-write-safety.mjs` 的镜像测试(§22c:直接 import 源脚本的 __test__,
 * 不在本文件里复制第二份判据实现)。
 *
 * 覆盖两类判据证明:
 *  A. **纯构造面**(快、不依赖仓库瞬时状态):名单成员逐个能命中;R1 棘轮四向;
 *     R2/R3 的"摘线必红 / 立项期必不红"成对;
 *  B. **临时 git 仓端到端**(证明取材面本身有牙,而不只是判据函数自洽):
 *     已收口仓 exit 0 → 把裸写盘改回去并暂存 ⇒ exit 1 且点名 → 把唯一出口暂存删除 ⇒ exit 1;
 *     两个面旗同给 ⇒ exit 2(拒绝在两个基准间猜)。
 *  D. **故障注入面(G-815961)**:唯一"真文件系统"的一组 —— 真实建临时件、真实删除,
 *     只把 `renameSync` 换成先问注入器(与上游同型:注入点摆在真正做事之前)。
 *     A 组与 `--self-test` 用内存袋证判据;这一组证**真实副作用**。
 */
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import * as nodeFs from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'
import { __test__ as G } from '../check-file-write-safety.mjs'
// 判据与出口都只从生产侧那两份取 —— 本文件不另抄一份注入器、一份原子写(§22c)
import { atomicWriteFileSync } from '../lib/atomic-write.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPTS_DIR = resolve(HERE, '..')
const GUARD_REL = 'check-file-write-safety.mjs'

const GIT_ARGS = ['-c', 'safe.directory=*', '-c', 'commit.gpgsign=false']
function git(dir, ...args) {
  // 2026-10-04：不吃的子进程必须给 stdio，否则本机报 spawnSync EBUSY
  const r = spawnSync('git', [...GIT_ARGS, '-C', dir, ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
  })
  assert.equal(r.status, 0, `git ${args.join(' ')} 失败:${r.stderr || r.stdout}`)
  return r.stdout
}

function runGuard(dir, flags = []) {
  return spawnSync(process.execPath, [join(dir, 'scripts', GUARD_REL), ...flags], {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
    cwd: dir,
  })
}

const EXIT_SRC = [
  'export interface WriteBaseline { readonly absPath: string; readonly content: string | null }',
  'export function captureWriteBaseline(absPath: string): WriteBaseline { return { absPath, content: null } }',
  'export function commitAtomicWrite(baseline: WriteBaseline, content: string): void { void baseline; void content }',
  'export class WriteConflictError extends Error { readonly code = "write_conflict" }',
].join('\n')

const WIRED_SRC = [
  "import { checkPathWritePermission } from './index.js'",
  "import { captureWriteBaseline, commitAtomicWrite } from '../util/atomic-write.js'",
  'export function writeIt(abs: string, content: string) {',
  '  const baseline = captureWriteBaseline(abs)',
  '  commitAtomicWrite(baseline, content)',
  '}',
  'void checkPathWritePermission',
].join('\n')

const BARE_SRC = WIRED_SRC.replace(
  "  commitAtomicWrite(baseline, content)",
  "  commitAtomicWrite(baseline, content)\n  require('fs').writeFileSync(abs, content)",
)

/** 造一个"已收口"的临时 git 仓(HEAD 里出口在位、落盘方已接线) */
function makeLandedRepo() {
  const dir = mkScratch('o75-fws-')
  // 闭包必须推导:本门 import face-reader,face-reader 又 import gitdir —— 只拷一份必 ERR_MODULE_NOT_FOUND
  copyScriptWithClosure(SCRIPTS_DIR, GUARD_REL, join(dir, 'scripts'), [
    'lib/face-reader.mjs',
    'lib/gitdir.mjs',
    // G-815961:守门新增 import 这两跳,少拷一个就是演练仓 ERR_MODULE_NOT_FOUND
    'lib/fs-fault-injection.mjs',
    'lib/atomic-write.mjs',
  ])
  mkdirSync(join(dir, 'apps/cli/src/util'), { recursive: true })
  mkdirSync(join(dir, 'apps/cli/src/tools'), { recursive: true })
  writeFileSync(join(dir, 'apps/cli/src/util/atomic-write.ts'), EXIT_SRC)
  writeFileSync(join(dir, 'apps/cli/src/tools/file-edit.ts'), WIRED_SRC)
  git(dir, 'init', '-q')
  git(dir, 'config', 'user.email', 't@example.invalid')
  git(dir, 'config', 'user.name', 't')
  git(dir, 'add', '-A')
  git(dir, 'commit', '-q', '-m', 'landed baseline')
  return dir
}

// ───────────────────────── A. 纯构造面 ─────────────────────────

test('A0 §22c:源脚本必须 export __test__ 且键齐(否则镜像测试测的是空气)', () => {
  for (const key of [
    'EXIT_MODULE',
    'TOOL_MODULE',
    'BARE_WRITE_APIS',
    'WORKSPACE_GATE_SYMBOL',
    'REQUIRED_EXIT_EXPORTS',
    'analyzeFile',
    'evaluateBareWrites',
    'evaluateWiring',
    'assertNonEmptyScan',
    'runAudit',
  ]) {
    assert.ok(key in G, `__test__ 缺键 ${key}`)
  }
})

test('A1 名单正向:每个裸写 API 都能被自己的判据命中(守门 120 的要求)', () => {
  for (const api of G.BARE_WRITE_APIS) {
    const facts = G.analyzeFile(G.TOOL_MODULE, `import { ${G.WORKSPACE_GATE_SYMBOL} } from './index.js'\nfs.${api}(abs, body);\n`)
    assert.equal(facts.bareWrites.length, 1, `${api} 未被认出`)
    assert.equal(facts.bareWrites[0].api, api)
    assert.equal(facts.usesWorkspaceWriteGate, true, `${G.WORKSPACE_GATE_SYMBOL} 未被认出`)
  }
})

test('A2 名单正向:出口的每个必需导出都能被逐个认出', () => {
  const facts = G.analyzeFile(G.EXIT_MODULE, EXIT_SRC)
  for (const name of G.REQUIRED_EXIT_EXPORTS) {
    assert.equal(facts.exports[name], true, `出口导出 ${name} 未被认出`)
  }
})

test('A3 遮噪方向不可混用:注释/串里的裸写不判,代码里的判', () => {
  const asComment = G.analyzeFile(G.TOOL_MODULE, `import { ${G.WORKSPACE_GATE_SYMBOL} } from './index.js'\n// fs.writeFileSync(abs, x)\n`)
  assert.equal(asComment.bareWrites.length, 0, '注释里的调用被当成代码')
  const asString = G.analyzeFile(G.TOOL_MODULE, `import { ${G.WORKSPACE_GATE_SYMBOL} } from './index.js'\nconst s = 'fs.writeFileSync(abs, x)'\n`)
  assert.equal(asString.bareWrites.length, 0, '字符串里的调用被当成代码')
  // 而 import 判据**必须**看得见字符串(模块说明符就是字符串)—— 两档遮噪不能互换
  assert.equal(asString.importsAtomicExit, false)
  assert.equal(
    G.analyzeFile(G.TOOL_MODULE, `import { commitAtomicWrite } from '../util/atomic-write.js'\n`).importsAtomicExit,
    true,
  )
})

test('A4 R1 棘轮四向:HEAD 存量不红 / 加回来必红 / 归零后再裸写必红', () => {
  const hit = { line: 1, api: 'writeFileSync', text: 'x' }
  assert.equal(G.evaluateBareWrites([{ ...mk(G.TOOL_MODULE), bareWrites: [hit] }], { [G.TOOL_MODULE]: 1 }).findings.length, 0)
  assert.equal(G.evaluateBareWrites([{ ...mk(G.TOOL_MODULE), bareWrites: [hit, hit] }], { [G.TOOL_MODULE]: 1 }).findings.length, 1)
  assert.equal(G.evaluateBareWrites([{ ...mk(G.TOOL_MODULE), bareWrites: [hit] }], { [G.TOOL_MODULE]: 0 }).findings.length, 1)
  assert.equal(G.evaluateBareWrites([{ ...mk(G.TOOL_MODULE), bareWrites: [] }], {}).findings.length, 0)
})

test('A5 出口模块自身不参与裸写判据(门不得咬自己写的 tmp)', () => {
  const f = { ...mk(G.EXIT_MODULE), bareWrites: [{ line: 1, api: 'writeFileSync', text: 'x' }] }
  assert.equal(G.evaluateBareWrites([f], {}).findings.length, 0)
})

test('A6 R2/R3 立项期只报数,已入库后摘线必红(成对)', () => {
  const exitFacts = G.analyzeFile(G.EXIT_MODULE, EXIT_SRC)
  const toolOk = { ...mk(G.TOOL_MODULE), importsAtomicExit: true, callsCommitAtomic: 2, callsCaptureBaseline: 2 }
  const birth = G.evaluateWiring({ exitFacts: null, toolFacts: toolOk, headExitPresent: false, headToolWired: false })
  assert.equal(birth.findings.length, 0, '立项期就被判红 = 恒红门')
  assert.ok(birth.notices.length > 0)
  const removed = G.evaluateWiring({ exitFacts: null, toolFacts: toolOk, headExitPresent: true, headToolWired: true })
  assert.ok(removed.findings.some((f) => f.rule === 'R2'), '出口被摘线必须红')
  const unwired = G.evaluateWiring({ exitFacts, toolFacts: mk(G.TOOL_MODULE), headExitPresent: true, headToolWired: true })
  assert.ok(unwired.findings.some((f) => f.rule === 'R3'), '接线回退必须红')
})

test('A7 空枚举判"无法判定";面外文件被排除(判据覆盖面不靠运气)', () => {
  assert.throws(() => G.assertNonEmptyScan([], 'head'), /无法判定/)
  assert.equal(G.assertNonEmptyScan(['apps/cli/src/tools/x.ts'], 'head'), 1)
  assert.equal(G.inScope('apps/cli/src/index.ts'), false, '面外文件被误纳')
  assert.equal(G.inScope('apps/cli/src/tools/x.ts'), true, '面内文件被误排除')
  assert.equal(G.inScope('apps/cli/src/tools/x.js'), false, '非扫描扩展名被误纳')
})

// ───────────────────────── B. 临时 git 仓端到端 ─────────────────────────

test('B1 已收口的仓:全量档与 --staged 档都 exit 0(不是靠"判据没跑"跑绿)', () => {
  const dir = makeLandedRepo()
  try {
    for (const flags of [[], ['--staged']]) {
      const r = runGuard(dir, flags)
      assert.equal(r.status, 0, `flags=${flags} ⇒ ${r.stdout}\n${r.stderr}`)
      assert.match(r.stdout, /扫描 1 个工具文件/)
      assert.doesNotMatch(r.stdout, /降级取用/, '锚点已在判定面上,不该报降级')
    }
  } finally {
    rmScratch(dir)
  }
})

test('B2 变异对照:把裸写盘改回去并暂存 ⇒ --staged 判红并点名文件', () => {
  const dir = makeLandedRepo()
  try {
    writeFileSync(join(dir, 'apps/cli/src/tools/file-edit.ts'), BARE_SRC)
    git(dir, 'add', 'apps/cli/src/tools/file-edit.ts')
    const r = runGuard(dir, ['--staged'])
    assert.equal(r.status, 1, `应当判红,实得 ${r.status}\n${r.stdout}\n${r.stderr}`)
    assert.match(r.stdout + r.stderr, /file-edit\.ts/)
    assert.match(r.stdout + r.stderr, /R1|R3/)
  } finally {
    rmScratch(dir)
  }
})

test('B3 变异对照:把唯一出口从索引里删掉 ⇒ --staged 判 R2(降级兜底不得遮掉暂存删除)', () => {
  const dir = makeLandedRepo()
  try {
    git(dir, 'rm', '--cached', '-q', 'apps/cli/src/util/atomic-write.ts')
    const r = runGuard(dir, ['--staged'])
    assert.equal(r.status, 1, `应当判红,实得 ${r.status}\n${r.stdout}\n${r.stderr}`)
    assert.match(r.stdout + r.stderr, /R2/)
  } finally {
    rmScratch(dir)
  }
})

test('B4 两个面旗同给 ⇒ exit 2(不許在两个基准间猜)', () => {
  const dir = makeLandedRepo()
  try {
    const r = runGuard(dir, ['--staged', '--worktree'])
    assert.equal(r.status, 2)
    assert.match(r.stdout + r.stderr, /不得同用/)
  } finally {
    rmScratch(dir)
  }
})

test('B5 立项期(出口只在工作树,HEAD/索引都没有)⇒ exit 0 且大声点名未收口,不出生即红', () => {
  const dir = mkScratch('o75-fws-birth-')
  copyScriptWithClosure(SCRIPTS_DIR, GUARD_REL, join(dir, 'scripts'), [
    'lib/face-reader.mjs',
    'lib/gitdir.mjs',
    // G-815961:守门新增 import 这两跳,少拷一个就是演练仓 ERR_MODULE_NOT_FOUND
    'lib/fs-fault-injection.mjs',
    'lib/atomic-write.mjs',
  ])
  mkdirSync(join(dir, 'apps/cli/src/util'), { recursive: true })
  mkdirSync(join(dir, 'apps/cli/src/tools'), { recursive: true })
  writeFileSync(join(dir, 'apps/cli/src/util/atomic-write.ts'), EXIT_SRC)
  writeFileSync(join(dir, 'apps/cli/src/tools/file-edit.ts'), WIRED_SRC)
  git(dir, 'init', '-q')
  git(dir, 'config', 'user.email', 't@example.invalid')
  git(dir, 'config', 'user.name', 't')
  git(dir, 'add', 'apps/cli/src/tools/file-edit.ts')
  git(dir, 'commit', '-q', '-m', 'tools only, exit module not yet landed')
  try {
    const r = runGuard(dir, ['--staged'])
    assert.equal(r.status, 0, `立项期不得判红:${r.stdout}\n${r.stderr}`)
    assert.match(r.stdout, /未收口|降级取用/)
  } finally {
    rmScratch(dir)
  }
})

// ───────────────────────── D. 故障注入面(真文件系统,G-815961) ─────────────────────────

/**
 * 真 fs 袋 + **只**把 renameSync 换成"先问注入器,再真做"。
 * 其余(openSync/writeSync/rmSync/lstatSync…)全是 node:fs 原件 ——
 * 所以"临时文件被清"这句是被真实 unlink 证到的,不是内存 Map 记了一笔。
 */
function realFsWithRenameFault(injector) {
  return {
    ...nodeFs,
    renameSync(from, to) {
      injector.maybeThrow({ operation: 'rename', path: to })
      nodeFs.renameSync(from, to)
    },
  }
}

/**
 * D 组共用**一个**夹具目录,整组只 mk 一次、rm 一次(与
 * `scripts/tests/check-commit-loss-guard-fsck-unread.test.mjs:105-113` 同一处置)。
 *
 * 为什么不能每用例一对 mk/rm:宿主 shim 的删除守卫 `SAFE_DELETE_BULK_CONFIRM_REQUIRED`
 * 按**本轮累计删除数**计、阈值 50(该文件实测:11 个夹具各 7 文件也会在第 5 个用例上撞线,
 * 报 count:51)。撞线时 `rmScratch` 从 `finally` 抛,**盖掉本用例真正的断言结果** ——
 * 判据的红被换成一句与判据无关的清理噪声(那正是本文件第一版 D2-D4 全红的成因:
 * 断言其实全过,红的是清理)。
 * ⇒ 故:整组一次建、末尾一次删;删不掉就在报告里说明,不静默留(留着下一轮复核会被它误导)。
 */
let _dfix = null
function dFixture() {
  if (_dfix === null) _dfix = mkScratch('g815961-fault-')
  return _dfix
}
/** 收尾只删一次;被守卫挡住时**如实报告**(本仓纪律:绝不静默留)。 */
function dCleanup() {
  if (_dfix === null) return
  const dir = _dfix
  _dfix = null
  try {
    rmScratch(dir)
  } catch (e) {
    console.warn(`⚠️  D 组夹具未删净(${dir}):${e.message} —— 删不掉是宿主删除守卫的 per-turn 计数满了,非判据问题;残留目录可手工清`)
  }
}
process.on('exit', dCleanup)

/**
 * 宿主删除守卫是否把 `rmSync` 整个挡了(而不是只挡批量递归)。
 * 判据:`SAFE_DELETE_BULK_CONFIRM_REQUIRED` 由宿主 shim 注入,per-turn 累计到阈值 50 后
 * **连单文件 rm 都会被拒**(实测 `G:/tmp-probe` 单文件探针同样被挡)。
 * 这不是本仓代码的问题,但它会**把"清理确实被调用了"与"清理确实成功了"混成一件事** ——
 * 所以下面 D2 的断言必须把两件事分开断言,否则读起来像"原子写的失败清理是坏的"。
 */
function hostDeleteBlocked(e) {
  return /SAFE_DELETE_BULK_CONFIRM_REQUIRED/.test(String(e?.message ?? e))
}

test('D1 §22c:F 判据的转手面齐(否则下面几行测的是空气)', () => {
  for (const key of [
    'FAULT_INJECTION_MODULE',
    'FAULT_OPERATIONS',
    'FAULT_ERROR_FIELDS',
    'FAULTS_ENV',
    'FAULTS_ALLOW_ENV',
    'FAULTS_ENV_GUARD',
    'isFaultInjectionEnabled',
    'createFaultInjector',
    'createFaultInjectorFromEnv',
    'parseFaultRules',
    'ruleMatches',
    'collectFaultInjectionFace',
    'classifyFaultInjectionFace',
  ]) {
    assert.ok(key in G, `__test__ 缺键 ${key}`)
  }
  assert.equal(G.FAULT_INJECTION_MODULE, 'scripts/lib/fs-fault-injection.mjs')
})

test('D2 正反成对①:rename 注入一次 EPERM ⇒ 目标保持旧内容、临时文件被清(真 fs)', () => {
  const dir = join(dFixture(), 'd2')
  mkdirSync(dir, { recursive: true })
  const target = join(dir, 'state.json')
  const tmp = join(dir, '.state.json.injected-tmp')
  writeFileSync(target, 'OLD-CONTENT', 'utf8')
  const injector = G.createFaultInjector([
    { id: 'rename-ep', code: 'EPERM', operations: ['rename'], pathEndsWith: 'state.json' },
  ])
  let error = null
  try {
    atomicWriteFileSync(target, 'NEW-CONTENT', {
      fs: realFsWithRenameFault(injector),
      tmpName: tmp,
      backoff: [],
      sleep: () => {},
    })
  } catch (e) {
    error = e
  }
  // 失败分支被真的走到了 —— 不是"看注释以为走到了"。
  // ⚠️ 分层要认对:`atomicWriteFileSync` 把 rename 的原始错误包进
  // `AtomicReplaceFailedError`(`atomic-write.mjs:100-114`),外层 code 是
  // `atomic_replace_failed`;**注入器的四个字段在 `cause` 上**。
  // 断言外层 code 是不是 EPERM,等于断言"原子写不许包装错误"—— 那是在测一个不存在的行为。
  assert.ok(error, '注入 EPERM 后原子写应当抛错,实得成功')
  assert.equal(error.name, 'AtomicReplaceFailedError')
  assert.equal(error.code, 'atomic_replace_failed')
  assert.equal(error.absPath, target)
  assert.equal(error.attempts, 1, 'backoff:[] ⇒ 只该试一次')
  const inner = error.cause
  assert.ok(inner, '包装错误必须带 cause(否则注入器的四个字段就丢了,断言只能 match 字符串)')
  assert.equal(inner.code, 'EPERM')
  assert.equal(inner.syscall, 'rename')
  assert.equal(inner.zcodeFsFaultId, 'rename-ep')
  assert.equal(inner.path, target)
  // 票面正反成对第①条:目标保持旧内容(不得留半截)
  assert.equal(readFileSync(target, 'utf8'), 'OLD-CONTENT', '失败后目标内容被改了 = 截断了读者')
  // 票面正反成对第①条:临时文件被清。
  // ⚠️ 宿主删除守卫会在 per-turn 计数满 50 后把 `rmSync` 整个挡掉(实测单文件也挡),
  //   此时"临时件还在盘上"的成因是**环境**,不是原子写的失败清理 —— 那两件事必须分开断言,
  //   否则一句环境噪声会被读成"失败路径留了半成品"(本文件第一版正是这样全红)。
  //   守卫命中时改验第二格:失败路径**如实把清理失败带在 cleanupError 上**(不静默吞)。
  if (error.cleanupError && hostDeleteBlocked(error.cleanupError)) {
    assert.match(error.cleanupError, /SAFE_DELETE_BULK_CONFIRM_REQUIRED/)
    console.warn(
      `⚠️  D2:本轮命中宿主删除守卫(SAFE_DELETE_BULK_CONFIRM_REQUIRED),临时件未真正落盘清除;` +
        `已改验"清理失败被如实带在 cleanupError 上"。守卫计数是 per-turn 的,单跑本用例即恢复。`,
    )
  } else {
    assert.equal(error.cleanupError, null, '清理失败必须如实带出,不得静默')
    assert.equal(existsSync(tmp), false, '失败后临时件仍在盘上')
    assert.deepEqual(readdirSync(dir), ['state.json'], `盘上不止目标一个文件: ${readdirSync(dir).join(',')}`)
  }
})

test('D3 与 D2 成对:不注入 ⇒ 正常换上去且不留临时件(否则 D2 的红可能只是"它压根不写")', () => {
  const dir = join(dFixture(), 'd3')
  mkdirSync(dir, { recursive: true })
  const target = join(dir, 'state.json')
  const tmp = join(dir, '.state.json.clean-tmp')
  writeFileSync(target, 'OLD-CONTENT', 'utf8')
  const receipt = atomicWriteFileSync(target, 'NEW-CONTENT', {
    fs: realFsWithRenameFault(G.createFaultInjector([])),
    tmpName: tmp,
    backoff: [],
    sleep: () => {},
  })
  assert.ok(receipt.bytes > 0)
  assert.equal(readFileSync(target, 'utf8'), 'NEW-CONTENT')
  assert.equal(existsSync(tmp), false)
  assert.deepEqual(readdirSync(dir), ['state.json'])
})

test('D4 **防生产误开的锁**:未设测试环境且无 ALLOW ⇒ 注入器整条不生效(票面点名不可省)', () => {
  const rules = JSON.stringify([{ id: 'prod', code: 'EPERM', operations: ['rename'], pathEndsWith: '.json' }])
  const onlyRules = { [G.FAULTS_ENV]: rules }
  assert.equal(G.isFaultInjectionEnabled(onlyRules), false, '只有规则串就敢开 = 生产面可被打穿')
  const inj = G.createFaultInjectorFromEnv(onlyRules)
  assert.equal(inj.rules.length, 0, '未启用时不得装载任何规则')
  assert.doesNotThrow(() => inj.maybeThrow({ operation: 'rename', path: 'C:/x/a.json' }))
  // 端到端:同一份"未启用"注入器接到真 fs 上,写盘一路绿灯(证明它真的什么也没注入)
  const dir = join(dFixture(), 'd4')
  mkdirSync(dir, { recursive: true })
  const target = join(dir, 'state.json')
  writeFileSync(target, 'OLD', 'utf8')
  atomicWriteFileSync(target, 'NEW', {
    fs: realFsWithRenameFault(inj),
    tmpName: join(dir, '.state.json.gate-tmp'),
    backoff: [],
    sleep: () => {},
  })
  assert.equal(readFileSync(target, 'utf8'), 'NEW', '未启用的注入器竟然打断了写盘')
})

test('D5 双条件的两个臂各自都能开(与 D4 成对:防"永远打不开"变成另一种假绿)', () => {
  const rules = JSON.stringify([{ id: 'a', code: 'EPERM', operations: ['rename'] }])
  assert.equal(G.isFaultInjectionEnabled({ [G.FAULTS_ENV]: rules, [G.FAULTS_ENV_GUARD]: 'test' }), true)
  assert.equal(G.isFaultInjectionEnabled({ [G.FAULTS_ENV]: rules, [G.FAULTS_ALLOW_ENV]: '1' }), true)
  assert.equal(G.isFaultInjectionEnabled({ [G.FAULTS_ENV]: rules, [G.FAULTS_ENV_GUARD]: 'production' }), false)
  assert.equal(G.isFaultInjectionEnabled({ [G.FAULTS_ENV]: '  ' }), false)
  assert.equal(G.createFaultInjectorFromEnv({ [G.FAULTS_ENV]: rules, [G.FAULTS_ENV_GUARD]: 'test' }).rules.length, 1)
  assert.equal(G.createFaultInjectorFromEnv({ [G.FAULTS_ENV]: rules, [G.FAULTS_ALLOW_ENV]: '1' }).rules.length, 1)
})

test('D6 规则写错在解析期抛(闭集/maxMatches/pathRegex/JSON 四路),不是静默失效', () => {
  const bad = [
    [[{ id: 'i', code: 'E', operations: ['sqlite_open'] }], '闭集外 operation'],
    [[{ id: 'i', code: 'E', maxMatches: -1 }], 'maxMatches 负数'],
    [[{ id: 'i', code: 'E', maxMatches: 1.5 }], 'maxMatches 非整数'],
    [[{ id: 'i', code: 'E', pathRegex: '([' }], 'pathRegex 编译不过'],
    [[{ code: 'E' }], '缺 id'],
    [[{ id: 'i' }], '缺 code'],
  ]
  for (const [rules, why] of bad) {
    assert.throws(() => G.createFaultInjector(rules), /Invalid fs fault rule/, `${why} 未在解析期抛`)
  }
  for (const raw of ['{ not json', '{"a":1}', '42', 'null']) {
    assert.throws(() => G.parseFaultRules(raw), /Invalid/, `坏规则串 ${raw} 未抛`)
  }
})

test('D7 maxMatches 缺省 1:只炸第一次(票面 :98),显式 N 则恰好 N 次', () => {
  const count = (inj, times) => {
    let n = 0
    for (let i = 0; i < times; i++) {
      try {
        inj.maybeThrow({ operation: 'rename', path: 'C:/a' })
      } catch {
        n += 1
      }
    }
    return n
  }
  assert.equal(count(G.createFaultInjector([{ id: 'd', code: 'E', operations: ['rename'] }]), 5), 1)
  assert.equal(count(G.createFaultInjector([{ id: 'd', code: 'E', operations: ['rename'], maxMatches: 3 }]), 5), 3)
  assert.equal(count(G.createFaultInjector([{ id: 'd', code: 'E', maxMatches: 0 }]), 5), 0)
})

test('D8 三条件取与 + 分隔符归一(少一个条件就不命中)', () => {
  const mk = () =>
    G.createFaultInjector([
      { id: 't', code: 'EPERM', operations: ['rename'], pathIncludes: 'wt/', pathEndsWith: '.json' },
    ])
  const hit = (inj, p) => {
    try {
      inj.maybeThrow({ operation: 'rename', path: p })
      return false
    } catch {
      return true
    }
  }
  assert.equal(hit(mk(), 'C:/wt/a.json'), true)
  assert.equal(hit(mk(), 'C:/other/a.json'), false, 'pathIncludes 不中却命中了 = 取了或')
  assert.equal(hit(mk(), 'C:/wt/a.txt'), false, 'pathEndsWith 不中却命中了')
  assert.equal(hit(mk(), 'C:\\wt\\a.json'), true, '反斜杠形态未归一')
})

test('D9 注入点摆在真正做事之前:未命中时 rename 仍要真做(不许"注入即全拦")', () => {
  const dir = join(dFixture(), 'd9')
  mkdirSync(dir, { recursive: true })
  const target = join(dir, 'other.txt')
  writeFileSync(target, 'OLD', 'utf8')
  // 规则只拦 .json ⇒ 对 .txt 的 rename 一律放行
  const inj = G.createFaultInjector([{ id: 'j', code: 'EPERM', operations: ['rename'], pathEndsWith: '.json' }])
  atomicWriteFileSync(target, 'NEW', {
    fs: realFsWithRenameFault(inj),
    tmpName: join(dir, '.other.txt.pass-tmp'),
    backoff: [],
    sleep: () => {},
  })
  assert.equal(readFileSync(target, 'utf8'), 'NEW')
})

test('D10 F 维度是 warn 起步:默认档取到注入面时不产 findings、不影响 rc', () => {
  const face = G.collectFaultInjectionFace(resolve(SCRIPTS_DIR, '..'), 'head')
  assert.equal(face.present, true, `注入面取不到:${JSON.stringify(face)}`)
  assert.equal(face.undetermined === false || face.undetermined === undefined, true)
  assert.ok(!('findings' in face), 'F 维度带了 findings = 已接成 blocking,违反头注')
  assert.ok(!('wiring' in face), 'F 维度带 wiring = 已接成 blocking,违反头注')
})

test('D10b 三态不并桶:取不到 / 判据抛 ⇒ 未判定,绝不报成通过(纯判定层构造)', () => {
  // ⚠️ 不靠"传一个不存在的仓根"去撞那一档:取材的降级链会退到工作树照样取到
  //   (第一版正是这么写的,提交后实测转红 —— 判据没坏,是用例够不到它要的那一档)。
  const missing = G.classifyFaultInjectionFace(null)
  assert.equal(missing.present, false)
  assert.equal(missing.undetermined, true, '取不到却报成通过 = 三态并桶')
  const probeThrows = G.classifyFaultInjectionFace('x', {
    probe: () => {
      throw new Error('probe boom')
    },
  })
  assert.equal(probeThrows.present, true)
  assert.equal(probeThrows.undetermined, true, '判据自身抛却报成通过 = 三态并桶')
  assert.equal(G.classifyFaultInjectionFace('x', { probe: () => 1 }).undetermined, false)
})

/** 一个"合格工具文件"的基线事实(纯函数用例的公共夹具) */
function mk(rel) {
  return {
    rel,
    present: true,
    bareWrites: [],
    usesWorkspaceWriteGate: true,
    importsAtomicExit: false,
    callsCommitAtomic: 0,
    callsCaptureBaseline: 0,
    exports: {},
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
