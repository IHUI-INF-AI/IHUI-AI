// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:守门「暂存删除存续性对账」(§22c 直接 import 源模块,不复制实现)
//
// 钉四件事:
//  1. 源模块必须 export `__test__` 且关键纯函数在内(§22c 前置条件);
//  2. 判据正反成对 —— "真被引用的删除必判红"与"引用方也一起删必放行"两条正向对照;
//  3. 真仓取材通路可用(git grep --cached / cat-file --batch 读索引 blob),只读不改索引;
//  4. 临时独立仓端到端装车:git rm 一个仍被 barrel 引用的文件 → 本门 exit 1 并点名引用方;
//     把引用方一起 git rm → exit 0。这是"0 违规"结论唯一可被采信的证明。
import { execFileSync, spawnSync } from 'node:child_process'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'
import { __test__ } from '../check-staged-deletions.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const GUARD = join(ROOT, 'scripts/check-staged-deletions.mjs')
const GIT = resolveGitBin() || 'git'
// 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
const gitOpts = { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', windowsHide: true, timeout: 60000, maxBuffer: 64 << 20 }
const runGit = (dir, args) => execFileSync(GIT, ['-c', 'safe.directory=*', '-c', 'user.email=t@e2e.local', '-c', 'user.name=e2e', '-C', dir, ...args], { ...gitOpts, stdio: ['ignore', 'pipe', 'pipe'] })
const runGuard = (dir, extra = []) =>
  // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
  spawnSync(process.execPath, [GUARD, '--root', dir, ...extra], { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', windowsHide: true, timeout: 180000, maxBuffer: 64 << 20 })

// 真被引用的删除:barrel 仍 export * from,实现却被 git rm
const BARREL = "export * from './input-notices'\nexport const other = 1\n"
const IMPL = 'export const notices = []\n'

function makeRepo(t) {
  const dir = mkScratch('staged-deletions-')
  t.after(() => rmScratch(dir))
  runGit(dir, ['init', '-q'])
  mkdirSync(join(dir, 'packages/shared'), { recursive: true })
  writeFileSync(join(dir, 'packages/shared/index.ts'), BARREL)
  writeFileSync(join(dir, 'packages/shared/input-notices.ts'), IMPL)
  writeFileSync(join(dir, 'package.json'), '{ "name": "e2e" }\n')
  runGit(dir, ['add', '-A'])
  runGit(dir, ['commit', '-q', '-m', 'init'])
  return dir
}

// E3 端到端夹具:一个"测试文件测一个仍然存活的生产模块"的最小仓(事故形态)
function makeTestRepo(t) {
  const dir = mkScratch('staged-deletions-e3-')
  t.after(() => rmScratch(dir))
  runGit(dir, ['init', '-q'])
  mkdirSync(join(dir, 'apps/web/src/components'), { recursive: true })
  mkdirSync(join(dir, 'apps/web/tests'), { recursive: true })
  writeFileSync(join(dir, 'apps/web/src/components/AnalyticsCapture.tsx'), 'export const track = (n: string) => n\n')
  writeFileSync(
    join(dir, 'apps/web/tests/analytics-capture-aria-label.test.tsx'),
    "import { track } from '../src/components/AnalyticsCapture'\n\ntest('x', () => track('a'))\n",
  )
  writeFileSync(join(dir, 'package.json'), '{ "name": "e3" }\n')
  runGit(dir, ['add', '-A'])
  runGit(dir, ['commit', '-q', '-m', 'init'])
  return dir
}

test('__test__ 必须导出判据所需的全部纯函数(§22c phase B)', () => {  for (const k of ['stemOf', 'joinRel', 'moduleCandidates', 'classifySpecifier', 'referencesFor', 'matchAllowlist', 'parseAllowlist', 'auditDeletions'])
    assert.equal(typeof __test__[k], 'function', `__test__.${k} 缺失`)
})

test('正向对照 A:仍被 barrel 引用的删除必判红,并点名引用方', () => {
  const live = ['packages/shared/index.ts'] // 实现不在存续集里 = 已被暂存删除
  const res = __test__.auditDeletions(['packages/shared/input-notices.ts'], {
    livePaths: live,
    readFile: (p) => (p === 'packages/shared/index.ts' ? BARREL : null),
    getCandidates: () => live,
  })
  assert.equal(res[0].verdict, 'red')
  assert.equal(res[0].hits[0].file, 'packages/shared/index.ts')
  assert.equal(res[0].hits[0].form, 'relative')
})

test('正向对照 B:引用方也一起删 ⇒ 放过(正当删除的形态)', () => {
  const res = __test__.auditDeletions(['packages/shared/input-notices.ts', 'packages/shared/index.ts'], {
    livePaths: [], // 索引里两者都已消失
    readFile: () => null,
    getCandidates: () => [],
  })
  assert.equal(res[0].verdict, 'no-reference')
})

test('替代路径存在(= 已迁移到别的目录)⇒ 不计红', () => {
  const res = __test__.auditDeletions(['a/gone-moved.ts'], {
    livePaths: ['a/i.ts', 'b/gone-moved.ts'],
    readFile: (p) => (p === 'a/i.ts' ? "import { f } from './gone-moved'\n" : ''),
    getCandidates: () => ['a/i.ts'],
  })
  assert.equal(res[0].verdict, 'alternative-path')
})

test('豁免清单:文件不存在正常工作;坏 JSON 必须显式报错(不得静默当空清单)', () => {
  const missing = __test__.parseAllowlist(null, 'x.json')
  assert.equal(missing.entries.length, 0)
  assert.equal(missing.parseError, null)
  assert.equal(missing.missing, true)
  const bad = __test__.parseAllowlist('{ 这不是 JSON', 'x.json')
  assert.ok(bad.parseError, '坏 JSON 必须带出 parseError')
  assert.equal(bad.entries.length, 0)
})

// 取材纪律(2026-09-25 同位重锚:本门的 git 派生与 `cat-file --batch` 已收口到
// scripts/lib/face-reader.mjs,源文件里**不再有** execFileSync —— 旧断言"每处 spawn 必须带
// windowsHide + timeout"的前置(存在 spawn)已经不成立,照它执行会恒红。
// 现行更强的口径:① 本门一律不自拼派生;② 必须真的经层(gitRaw + catBatch 都在用);
// ③ safe.directory 这类"只有一个人会写对"的细节不得在端内重复一份;④ 层必须仍然导出这些原语。)
test('取材纪律:本门不得自拼 git 派生,取材一律经 scripts/lib/face-reader.mjs', () => {
  const src = readFileSync(GUARD, 'utf8')
  for (const banned of ['execFileSync(', 'execSync(', 'spawnSync(', 'spawn(']) {
    assert.ok(!src.includes(banned), `迁移后门里不应再有自拼派生 ${banned}`)
  }
  assert.ok(!src.includes(`'safe.directory=*'`), 'safe.directory 该由层单点持有,不得在端内重复')
  assert.match(src, /from '\.\/lib\/face-reader\.mjs'/, '必须真接层')
  for (const used of ['gitRaw(', 'catBatch('])
    assert.ok(src.includes(used), `取材通道必须真的用到层的 ${used}`)
})

test('层的 gitErrText 空 stderr 措辞必须与门内的"零命中"常量逐字同', async () => {
  // 旧判据读 `e.status === 1`;层把所有非零折成 Undetermined 且**不暴露 exit code**,
  // 于是"git grep 零命中(合法空集)"与"真失败"只剩一条可观测差异:git 有没有留下诊断。
  // 这条耦合必须由机器看着 —— 层改了措辞,本门会把"零命中"读成"真失败"而整门 exit 2。
  const layer = await import('../lib/face-reader.mjs')
  assert.equal(typeof layer.gitErrText, 'function', '层必须仍导出 gitErrText')
  assert.equal(
    __test__.ZERO_HIT_MARK,
    layer.gitErrText({ stderr: '' }),
    'ZERO_HIT_MARK 与层的空诊断措辞漂移 ⇒ grep 的零命中/真失败分档失效',
  )
})

test('真仓取材通路可用(只读:不改索引、不改工作区)', () => {
  const staged = __test__.collectDeletions(ROOT, 'staged')
  assert.equal(staged.noHead, false, '真仓有提交,noHead 必为 false')
  assert.ok(Array.isArray(staged.staged) && staged.staged.every((p) => !p.startsWith('/')))
  const blobs = __test__.readIndexBlobs(ROOT, ['package.json', 'no/such/path-xyz.ts'])
  assert.match(String(blobs.get('package.json')), /"name"/, '索引 blob 必须真读得到内容')
  assert.equal(blobs.get('no/such/path-xyz.ts'), null, '索引里不存在的路径必须为 null(不得抛异常)')
  // git grep --cached 的取材面 = 索引(不是工作区):拿一个必然入库的标识符验一次
  const hits = __test__.grepFiles(ROOT, ['check-mass-deletion.mjs'])
  assert.ok(hits.includes('scripts/guardian-runner.mjs'), `grep --cached 应命中注册表,实际:${hits.slice(0, 5).join(', ')}`)
})

test('端到端装车:git rm 仍被引用的文件 → exit 1 并点名引用方', (t) => {
  const dir = makeRepo(t)
  runGit(dir, ['rm', '-q', 'packages/shared/input-notices.ts'])
  const r = runGuard(dir)
  assert.equal(r.status, 1, `期望 exit 1,实际 ${r.status}\n${r.stdout}\n${r.stderr}`)
  assert.match(r.stdout, /input-notices\.ts/)
  assert.match(r.stdout, /packages\/shared\/index\.ts/, '必须点名引用它的那个文件')
  assert.match(r.stdout, /\[relative\]/)
})

test('端到端装车:引用方也一起删 → exit 0(与上一条成对)', (t) => {
  const dir = makeRepo(t)
  runGit(dir, ['rm', '-q', 'packages/shared/input-notices.ts', 'packages/shared/index.ts'])
  const r = runGuard(dir)
  assert.equal(r.status, 0, `期望 exit 0,实际 ${r.status}\n${r.stdout}\n${r.stderr}`)
})

test('端到端装车:确属有意删除可登记豁免清单(只报数不判红)', (t) => {
  const dir = makeRepo(t)
  runGit(dir, ['rm', '-q', 'packages/shared/input-notices.ts'])
  assert.equal(runGuard(dir).status, 1, '登记前必须判红')
  mkdirSync(join(dir, 'scripts'), { recursive: true })
  writeFileSync(
    join(dir, 'scripts/staged-deletions-allowlist.json'),
    JSON.stringify({ paths: [{ path: 'packages/shared/input-notices.ts', reason: '功能迁到 packages/shared/notices/index.ts' }] }, null, 2),
  )
  const r = runGuard(dir)
  assert.equal(r.status, 0, `登记后应放行,实际 ${r.status}\n${r.stdout}`)
  assert.match(r.stdout, /allowlisted/, '豁免项必须如实报数,不得静默')
})

test('端到端装车:--json 输出可被解析且 verdict 计数正确', (t) => {
  const dir = makeRepo(t)
  runGit(dir, ['rm', '-q', 'packages/shared/input-notices.ts'])
  const r = runGuard(dir, ['--json'])
  const obj = JSON.parse(r.stdout)
  assert.equal(obj.red, 1)
  assert.equal(obj.results[0].path, 'packages/shared/input-notices.ts')
  assert.equal(obj.results[0].hits[0].file, 'packages/shared/index.ts')
})

test('登记前置:未注册进 guardian-runner 时本组测试仍绿;注册后必须 blocking + skipEnv', () => {
  const runnerPath = join(ROOT, 'scripts/guardian-runner.mjs')
  if (!existsSync(runnerPath)) return
  const src = readFileSync(runnerPath, 'utf8')
  if (!src.includes('check-staged-deletions.mjs')) return // 主 agent 尚未注册(登记属主 agent 串行动作)
  const hits = [...src.matchAll(/script: 'check-staged-deletions\.mjs'/g)]
  assert.equal(hits.length, 1, `注册块出现 ${hits.length} 次(重复登记即撞号)`)
  const block = src.slice(Math.max(0, hits[0].index - 600), hits[0].index + 600)
  assert.match(block, /mode: 'blocking'/)
  assert.match(block, /skipEnv: 'HUSKY_SKIP_STAGED_DELETIONS'/)
})

// T11/T12 —— 别名与整仓库路径字面量这两个形态的"同 stem 另一份存活 ⇒ 引用未断"歧义判据。
// 立因:守门 98 的 D4 影子维规定"删掉那份 .js、别去改说明符",而本门原先只在**相对**说明符那一支
// 做歧义放过 ⇒ 门 99 把门 98 规定的正确修法判成红(两道门互咬,实测于 G-815918 那枚删除)。
// 两条必须成对:只留 T11 就等于允许"任何别名引用都放过"。
test('T11 影子 .js 被删而同目录 .ts 存活 ⇒ 别名与字面量都不算断链(放过)', () => {
  const p = 'pkg/svc/concurrency.js'
  const from = 'pkg/tests/concurrency.test.ts'
  const live = new Set([p, 'pkg/svc/concurrency.ts', from])
  assert.equal(__test__.altSiblingsAlive(p, live), true, '同 stem 的 .ts 在审面上存活')
  assert.equal(__test__.classifySpecifier('pkg/svc/concurrency.js', from, p, live), null, '字面量形态')
  assert.equal(__test__.classifySpecifier('pkg/svc/concurrency.ts', from, p, live), null, '别名形态')
})

test('T12 与 T11 成对:同 stem 没有另一份存活时,字面量引用照旧判(放过不等于取消)', () => {
  const p = 'pkg/svc/concurrency.js'
  const from = 'pkg/tests/concurrency.test.ts'
  const live = new Set([p, from])
  assert.equal(__test__.altSiblingsAlive(p, live), false, '面上没有另一份实现')
  assert.deepEqual(
    __test__.classifySpecifier('pkg/svc/concurrency.js', from, p, live),
    { kind: 'path-literal', spec: p },
    '缺这一判就是替"删除仍被引用的文件"背书',
  )
})

// ── E3(测试文件删除的意向声明)—— 2026-10-27 补 ───────────────────────────────────
// 立因:一枚按旧基线写回的提交(`b966cb21676`)静默删掉 4 个测试文件,而门 99 报绿 ——
// E1 的证据是"索引里还有别的文件 import 它",测试文件结构上不满足这一条。
const ACC_TEST = 'apps/web/tests/analytics-capture-aria-label.test.tsx'
const ACC_MOD = 'apps/web/src/components/AnalyticsCapture.tsx'
const ACC_SRC = "import { track } from '../src/components/AnalyticsCapture'\n\ntest('x', () => track('a'))\n"

test('E3:__test__ 必须导出 E3 的判据原语(§22c phase B)', () => {
  for (const k of ['isTestPath', 'extractModuleSpecifiers', 'auditTestDeletions', 'mergeE3Results', 'resolveAliasSpec', 'matchAllowlistLive'])
    assert.equal(typeof __test__[k], 'function', `__test__.${k} 缺失`)
})

test('E3 纯函数:删测试而它测的模块仍在 ⇒ 红;同一夹具只跑 E1/E2 ⇒ 绿(缺口复现)', () => {
  const files = { [ACC_TEST]: ACC_SRC, [ACC_MOD]: 'export const track = (n: string) => n\n' }
  const e3 = __test__.auditTestDeletions([ACC_TEST], {
    livePaths: [ACC_MOD],
    readBlob: (p) => (p in files ? { text: files[p], from: 'fixture' } : null),
  })[0]
  assert.equal(e3.verdict, 'test-red')
  assert.equal(e3.modules[0].path, ACC_MOD)
  // 变异自证:摘掉 E3 那几行 == 只跑原判据 ⇒ 同一夹具翻绿(这就是那段缺口)
  const e1 = __test__.auditDeletions([ACC_TEST], {
    livePaths: [ACC_MOD],
    readFile: (p) => (p in files ? files[p] : null),
    getCandidates: () => [ACC_MOD],
  })[0]
  assert.equal(e1.verdict, 'no-reference')
})

test('E3 端到端:git rm 一个测试而其被测模块仍在 → exit 1,点名模块与三条放过通道', (t) => {
  const dir = makeTestRepo(t)
  runGit(dir, ['rm', '-q', ACC_TEST])
  const r = runGuard(dir)
  assert.equal(r.status, 1, `期望 exit 1,实际 ${r.status}\n${r.stdout}\n${r.stderr}`)
  assert.match(r.stdout, /analytics-capture-aria-label\.test\.tsx/)
  assert.match(r.stdout, /AnalyticsCapture\.tsx/, '必须点名它测的是哪个模块')
  assert.match(r.stdout, /放过通道/, '必须把三条通道的成立情况写出来')
  assert.match(r.stdout, /intentional-delete/, '必须给出可执行的下一步')
})

test('E3 端到端:--message 带 intentional-delete: → exit 0(与上一条成对)', (t) => {
  const dir = makeTestRepo(t)
  runGit(dir, ['rm', '-q', ACC_TEST])
  assert.equal(runGuard(dir).status, 1, '默认档必须先判红')
  const r = runGuard(dir, ['--message', 'refactor: 删测试\n\nintentional-delete: 场景已迁到 e2e'])
  assert.equal(r.status, 0, `期望 exit 0,实际 ${r.status}\n${r.stdout}`)
  assert.match(r.stdout, /test-intent-marker/)
})

test('E3 端到端:豁免台账命中(未过期)→ exit 0,过期 → exit 1(逾期即失效)', (t) => {
  const dir = makeTestRepo(t)
  runGit(dir, ['rm', '-q', ACC_TEST])
  const okFile = join(dir, 'al-ok.json')
  writeFileSync(okFile, JSON.stringify({ paths: [{ path: ACC_TEST, reason: '同批删除', ticket: 'T-1', until: '2099-01-01' }] }))
  assert.equal(runGuard(dir, ['--allowlist', okFile]).status, 0)
  const expFile = join(dir, 'al-exp.json')
  writeFileSync(expFile, JSON.stringify({ paths: [{ path: ACC_TEST, reason: '同批删除', until: '2020-01-01' }] }))
  const r = runGuard(dir, ['--allowlist', expFile])
  assert.equal(r.status, 1, `过期豁免必须失效,实际 ${r.status}\n${r.stdout}`)
  assert.match(r.stdout, /逾期即失效/)
})

test('E3 端到端:改名 ⇒ exit 0;同一笔提交把被测模块也删掉 ⇒ exit 0', (t) => {
  const dir = makeTestRepo(t)
  runGit(dir, ['mv', ACC_TEST, 'apps/web/tests/analytics-a11y.test.tsx'])
  assert.equal(runGuard(dir).status, 0, '重命名是放过通道①')
  runGit(dir, ['reset', '-q', '--hard', 'HEAD'])
  runGit(dir, ['rm', '-q', ACC_TEST, ACC_MOD])
  const r = runGuard(dir)
  assert.equal(r.status, 0, `源模块自己也被删 ⇒ 题二不成立,实际 ${r.status}\n${r.stdout}`)
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
