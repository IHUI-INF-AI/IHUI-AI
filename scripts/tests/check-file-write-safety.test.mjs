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
 */
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { copyScriptWithClosure } from '../lib/scratch-module-closure.mjs'
import { __test__ as G } from '../check-file-write-safety.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPTS_DIR = resolve(HERE, '..')
const GUARD_REL = 'check-file-write-safety.mjs'

const GIT_ARGS = ['-c', 'safe.directory=*', '-c', 'commit.gpgsign=false']
function git(dir, ...args) {
  const r = spawnSync('git', [...GIT_ARGS, '-C', dir, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
  })
  assert.equal(r.status, 0, `git ${args.join(' ')} 失败:${r.stderr || r.stdout}`)
  return r.stdout
}

function runGuard(dir, flags = []) {
  return spawnSync(process.execPath, [join(dir, 'scripts', GUARD_REL), ...flags], {
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
  copyScriptWithClosure(SCRIPTS_DIR, GUARD_REL, join(dir, 'scripts'), ['lib/face-reader.mjs', 'lib/gitdir.mjs'])
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
  copyScriptWithClosure(SCRIPTS_DIR, GUARD_REL, join(dir, 'scripts'), ['lib/face-reader.mjs', 'lib/gitdir.mjs'])
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
