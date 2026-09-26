// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:scripts/object-space-land.mjs(§22c —— 判据函数直接 import,端到端一律 spawn CLI 打临时仓)。
// 票面要求的取证逐条钉死:
//  3. 空清单/空消息必须非零退出(本仓踩过:空 LAND_PATHS 会把 "undefined" 当路径提交);
//  2. 索引对齐的归属纪律:索引==父提交 ⇒ 对齐;索引==别人新暂存 ⇒ 不动并点名;
//  + 防覆盖护栏:任一目标路径在基线与当下 HEAD 之间被别人改过 ⇒ 停,不覆盖;
//  + 声明无差异 ⇒ 事先拒绝(提交面回读结构上证明不了它,"commit message 只能写能被回读证明的东西");
//  + happy path:落地 + 提交面回读 + 主索引对齐三段各有正向断言。
// git 写操作只发生在 scripts/lib/scratch-dir.mjs 的临时仓内(§26/§15b 唯一夹具落点),绝不碰真仓。

import { execFileSync, spawnSync } from 'node:child_process'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ } from '../object-space-land.mjs'
import { git, headBlobOf, indexBlobOf, writeBlob } from '../lib/bypass-git.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const TOOL = join(HERE, '..', 'object-space-land.mjs')
const GIT = resolveGitBin() || 'git'
const runOpts = { encoding: 'utf8', windowsHide: true, timeout: 60_000, maxBuffer: 64 << 20 }
const runGit = (dir, args) =>
  execFileSync(GIT, ['-c', 'safe.directory=*', '-c', 'user.email=t@e2e.local', '-c', 'user.name=e2e', '-c', 'core.autocrlf=false', '-C', dir, ...args], runOpts)

function makeRepo(t) {
  const dir = mkScratch('osl-')
  t.after(() => rmScratch(dir))
  runGit(dir, ['init', '-q'])
  writeFileSync(join(dir, 'a.txt'), 'v1\n')
  mkdirSync(join(dir, 'sub'), { recursive: true })
  writeFileSync(join(dir, 'sub', 'keep.txt'), 'keep\n')
  runGit(dir, ['add', '-A'])
  runGit(dir, ['commit', '-q', '-m', 'init'])
  return dir
}

function runLand(dir, { paths = '', msg = 'chore: e2e land', baseRef } = {}) {
  const env = { ...process.env, LAND_ROOT: dir, LAND_PATHS: paths, LAND_MSG: msg }
  if (baseRef) env.LAND_BASE_REF = baseRef
  else delete env.LAND_BASE_REF
  return spawnSync(process.execPath, [TOOL], { env, encoding: 'utf8', windowsHide: true, timeout: 180_000, maxBuffer: 64 << 20 })
}

test('T1 §22c 导出面:判据函数必须在 __test__ 里', () => {
  for (const k of ['parseArgs', 'clobberedPaths']) assert.equal(typeof __test__[k], 'function', `__test__.${k} 缺失`)
})

test('T2 happy path:落地 ⇒ 提交面回读 + 主索引对齐(新文件不留幽灵 D)', (t) => {
  const dir = makeRepo(t)
  const before = git(['rev-parse', 'HEAD'], { root: dir })
  writeFileSync(join(dir, 'a.txt'), 'v3\n')
  writeFileSync(join(dir, 'b.txt'), 'brand-new\n')
  const r = runLand(dir, { paths: 'a.txt;b.txt' })
  assert.equal(r.status, 0, `应成功,实得 ${r.status}:${r.stderr}`)
  assert.match(r.stdout, /提交面回读 2\/2 路径在树/)
  assert.match(r.stdout, /主索引已对齐 2\/2 路径/)
  const head = git(['rev-parse', 'HEAD'], { root: dir })
  assert.notEqual(head, before, 'HEAD 必须前进')
  assert.equal(headBlobOf(head, 'a.txt', { root: dir }), writeBlob('v3\n', { root: dir }))
  assert.notEqual(headBlobOf(head, 'b.txt', { root: dir }), 'ABSENT')
  assert.equal(headBlobOf(head, 'sub/keep.txt', { root: dir }), headBlobOf(before, 'sub/keep.txt', { root: dir }), '非声明路径必须原样')
  assert.equal(indexBlobOf('a.txt', { root: dir }), headBlobOf(head, 'a.txt', { root: dir }), '主索引必须对齐到新 blob')
  assert.notEqual(indexBlobOf('b.txt', { root: dir }), 'ABSENT', '新文件不得留在"暂存删除"形态')
})

test('T3 空清单 / 空消息 ⇒ 非零退出(2)且 HEAD 不动(本仓踩过把 undefined 当路径提交)', (t) => {
  const dir = makeRepo(t)
  const before = git(['rev-parse', 'HEAD'], { root: dir })
  const r1 = runLand(dir, { paths: '', msg: 'x' })
  assert.equal(r1.status, 2)
  assert.match(r1.stderr, /LAND_PATHS/)
  const r2 = runLand(dir, { paths: 'a.txt', msg: '' })
  assert.equal(r2.status, 2)
  assert.match(r2.stderr, /LAND_MSG/)
  assert.equal(git(['rev-parse', 'HEAD'], { root: dir }), before, '拒绝路径上 HEAD 必须一步没动')
})

test('T4 防覆盖护栏:目标路径在基线与当下 HEAD 之间被别人改过 ⇒ 拒绝落地并点名(LAND_BASE_REF 是造该现场的取证通道)', (t) => {
  const dir = makeRepo(t)
  writeFileSync(join(dir, 'a.txt'), 'v2-theirs\n')
  runGit(dir, ['add', '--', 'a.txt'])
  runGit(dir, ['commit', '-q', '-m', 'theirs']) // 别人把 a.txt 推进到 v2
  const theirsHead = git(['rev-parse', 'HEAD'], { root: dir })
  writeFileSync(join(dir, 'a.txt'), 'v3-mine\n')
  const r = runLand(dir, { paths: 'a.txt', baseRef: 'HEAD^' }) // 我方误按旧基线(v1)登记
  assert.equal(r.status, 1, `护栏必须拦,实得 ${r.status}:${r.stdout}|${r.stderr}`)
  assert.match(r.stderr + r.stdout, /被别人改过/)
  assert.match(r.stderr + r.stdout, /a\.txt/, '必须点名是哪条路径')
  assert.equal(git(['rev-parse', 'HEAD'], { root: dir }), theirsHead, 'HEAD 必须仍停在别人的提交上(未新增落地提交)')
  assert.equal(headBlobOf('HEAD', 'a.txt', { root: dir }), writeBlob('v2-theirs\n', { root: dir }), '别人的 v2 不得被覆盖')
})

test('T5 声明无差异 ⇒ 事先拒绝(提交面回读永远证不了"改了它")', (t) => {
  const dir = makeRepo(t)
  const before = git(['rev-parse', 'HEAD'], { root: dir })
  const r = runLand(dir, { paths: 'a.txt', msg: 'chore: no-op' }) // 盘上 a.txt == HEAD 的 v1
  assert.equal(r.status, 1)
  assert.match(r.stderr, /逐字节相同|无差异/)
  assert.equal(git(['rev-parse', 'HEAD'], { root: dir }), before)
})

test('T6 归属纪律端到端:索引==别人新暂存 ⇒ 落地成功但对齐不动该路径并点名"归属他人"', (t) => {
  const dir = makeRepo(t)
  // 现场:HEAD=v1;索引被别人暂存成 v2;盘上 v3(我要落的正是 v3)
  writeFileSync(join(dir, 'a.txt'), 'v2\n')
  runGit(dir, ['add', '--', 'a.txt'])
  writeFileSync(join(dir, 'a.txt'), 'v3\n')
  const foreign = indexBlobOf('a.txt', { root: dir })
  const r = runLand(dir, { paths: 'a.txt' })
  assert.equal(r.status, 0, `落地本身应成功:${r.stderr}`)
  assert.match(r.stdout, /未动\(归属他人\)[\s\S]*a\.txt/)
  assert.equal(indexBlobOf('a.txt', { root: dir }), foreign, '别人暂存的 v2 必须原样留在索引里')
  assert.equal(headBlobOf('HEAD', 'a.txt', { root: dir }), writeBlob('v3\n', { root: dir }), '提交面照落 v3')
})

test('T7 parseArgs 纯函数面:同一 env 两次调用结论一致(连跑不漂移的最小证明)', (t) => {
  const dir = makeRepo(t)
  writeFileSync(join(dir, 'b.txt'), 'nb\n')
  const envA = { LAND_PATHS: ' a.txt ; b.txt ', LAND_MSG: 'm', LAND_ROOT: dir }
  const a1 = __test__.parseArgs(envA)
  const a2 = __test__.parseArgs(envA)
  assert.equal(a1.error, undefined, `应通过,实得:${a1.error}`)
  assert.deepEqual(a2.paths, ['a.txt', 'b.txt'])
  assert.equal(a1.paths.join(','), a2.paths.join(','))
  const noPaths = __test__.parseArgs({ LAND_MSG: 'm', LAND_ROOT: dir })
  assert.match(String(noPaths.error), /LAND_PATHS/)
  const noMsg = __test__.parseArgs({ LAND_PATHS: 'a.txt', LAND_ROOT: dir })
  assert.match(String(noMsg.error), /LAND_MSG/)
  const notRepo = __test__.parseArgs({ LAND_PATHS: 'a.txt', LAND_MSG: 'm', LAND_ROOT: mkScratch('osl-notrepo-') })
  assert.match(String(notRepo.error), /不是可用仓库/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
