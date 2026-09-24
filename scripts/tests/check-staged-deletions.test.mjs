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
const gitOpts = { encoding: 'utf8', windowsHide: true, timeout: 60000, maxBuffer: 64 << 20 }
const runGit = (dir, args) => execFileSync(GIT, ['-c', 'safe.directory=*', '-c', 'user.email=t@e2e.local', '-c', 'user.name=e2e', '-C', dir, ...args], gitOpts)
const runGuard = (dir, extra = []) =>
  spawnSync(process.execPath, [GUARD, '--root', dir, ...extra], { encoding: 'utf8', windowsHide: true, timeout: 180000, maxBuffer: 64 << 20 })

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

test('__test__ 必须导出判据所需的全部纯函数(§22c phase B)', () => {
  for (const k of ['stemOf', 'joinRel', 'moduleCandidates', 'classifySpecifier', 'referencesFor', 'matchAllowlist', 'parseAllowlist', 'auditDeletions'])
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

test('取材纪律:spawn 一律带 windowsHide + timeout(守门 52 / 80 的口径)', () => {
  const src = readFileSync(GUARD, 'utf8')
  const sites = [...src.matchAll(/execFileSync\(/g)]
  assert.ok(sites.length >= 2, `期望至少 2 处 git 派生,实际 ${sites.length}`)
  for (const [i, m] of sites.entries()) {
    const win = src.slice(m.index, m.index + 520)
    assert.match(win, /windowsHide:\s*true/, `第 ${i + 1} 处派生缺 windowsHide(守门 52 会拦)`)
    assert.match(win, /\btimeout\b/, `第 ${i + 1} 处派生缺 timeout(守门 80 会拦)`)
  }
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
