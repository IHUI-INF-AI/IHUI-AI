// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/lib/guardian-gate-cache.mjs` 的镜像测试(§22c:直接 import 源实现,不抄第二份)。
 *
 * 钉三件事:
 *   ① 白名单纪律 —— 全部门必须是 PAR_GATE_IDS 子集,且已知"写/时间/远端/产物"依赖的门
 *      一个都不许混进来(缓存一条红变绿的捷径比慢更贵);
 *   ② 指纹确实随内容变化 —— 暂存面(索引)、未暂存面、未跟踪文件、HEAD 树,任一变即失效;
 *      判不出(未合并索引)必须返回 null 而不是猜;
 *   ③ 只缓存通过 / TTL / 逃生舱 / 坏文件容错 —— 失效方向永远是"多跑一次门"。
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { resolveGitBin } from '../lib/gitdir.mjs'
import { mkScratch } from '../lib/scratch-dir.mjs'
import {
  CONTENT_CACHE_GATE_IDS,
  GATE_CACHE_FILE_REL,
  GATE_CACHE_TTL_MS,
  computeStateFingerprint,
  createGateContentCache,
} from '../lib/guardian-gate-cache.mjs'

const EXECUTOR = resolve(import.meta.dirname, '../lib/guardian-executor.mjs')
const GIT = resolveGitBin()

function git(cwd, args) {
  return execFileSync(GIT, args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function gitOk(cwd, args) {
  try {
    git(cwd, args)
    return true
  } catch {
    return false
  }
}

function initRepo() {
  const box = mkScratch('gate-cache-')
  const repo = join(box, 'repo')
  mkdirSync(repo, { recursive: true })
  git(repo, ['init'])
  git(repo, ['config', 'user.email', 'gate-cache@test.local'])
  git(repo, ['config', 'user.name', 'gate-cache-test'])
  writeFileSync(join(repo, 'a.mjs'), 'export const a = 1\n')
  git(repo, ['add', 'a.mjs'])
  git(repo, ['commit', '-m', 'init'])
  return { box, repo }
}

test('T1 白名单是 PAR_GATE_IDS 子集,且混不进写/时间/远端/产物门', () => {
  const src = readFileSync(EXECUTOR, 'utf8')
  const parBlock = src.match(/const PAR_GATE_IDS = new Set\(\[([\s\S]*?)\]\)/)
  assert.ok(parBlock, '执行器里找不到 PAR_GATE_IDS 集合')
  const parIds = new Set([...parBlock[1].matchAll(/'([^']+)'/g)].map((m) => m[1]))
  for (const id of CONTENT_CACHE_GATE_IDS) {
    assert.ok(parIds.has(id), `缓存门 ${id} 不在 PAR_GATE_IDS 里 —— 只读门白名单已漂移`)
  }
  const forbidden = ['3', '4b', '8', '15', '29', '30a', '30c', '47', '100', '103', '107', '232']
  for (const id of forbidden) {
    assert.ok(!CONTENT_CACHE_GATE_IDS.has(id), `${id} 依赖写/时间/远端/产物,不得进纯内容缓存`)
  }
  assert.ok(GATE_CACHE_FILE_REL.startsWith('.ihui-agent/state/'), '缓存文件必须落在 gitignore 已盖的 .ihui-agent/state/')
})

test('T2 指纹确定性 + 四类内容变化各自失效', () => {
  const { repo } = initRepo()
  const fp1 = computeStateFingerprint({ cwd: repo })
  assert.ok(fp1, '干净仓库应算出指纹')
  assert.equal(computeStateFingerprint({ cwd: repo }), fp1, '同一内容两次必须同指纹')

  // 未暂存改动
  writeFileSync(join(repo, 'a.mjs'), 'export const a = 2\n')
  const fp2 = computeStateFingerprint({ cwd: repo })
  assert.notEqual(fp2, fp1, '未暂存内容变化必须失效')

  // 未跟踪文件
  writeFileSync(join(repo, 'b.mjs'), 'export const b = 1\n')
  const fp3 = computeStateFingerprint({ cwd: repo })
  assert.notEqual(fp3, fp2, '新增未跟踪文件必须失效')

  // 暂存面(索引条目流)
  git(repo, ['add', 'a.mjs'])
  const fp4 = computeStateFingerprint({ cwd: repo })
  assert.notEqual(fp4, fp3, '暂存区变化必须失效')

  // HEAD 树(--staged 门的取材面由 HEAD 树与索引之差决定)
  git(repo, ['commit', '-m', 'second'])
  const fp5 = computeStateFingerprint({ cwd: repo })
  assert.notEqual(fp5, fp4, 'HEAD 树变化必须失效')
})

test('T3 未合并索引判不出 ⇒ 返回 null(整批禁用缓存,而不是猜)', () => {
  const { repo } = initRepo()
  const branch = git(repo, ['rev-parse', '--abbrev-ref', 'HEAD']).trim()
  git(repo, ['checkout', '-b', 'side', 'HEAD~0'])
  writeFileSync(join(repo, 'a.mjs'), 'export const a = "side"\n')
  git(repo, ['add', 'a.mjs'])
  git(repo, ['commit', '-m', 'side'])

  git(repo, ['checkout', branch])
  writeFileSync(join(repo, 'a.mjs'), 'export const a = "main"\n')
  git(repo, ['add', 'a.mjs'])
  git(repo, ['commit', '-m', 'main'])
  assert.equal(gitOk(repo, ['merge', 'side']), false, '这次合并必须冲突,否则用例前提不成立')
  assert.equal(computeStateFingerprint({ cwd: repo }), null, '未合并索引必须判不出 ⇒ null')
})

test('T4 只缓存通过 / TTL / argv / 白名单 / 逃生舱 / 坏文件容错', () => {
  const { box, repo } = initRepo()
  const file = join(box, 'gate-cache.json')
  let clock = 1_000_000
  const gateIds = new Set(['11', '2e-dupns'])
  const input = { script: 'scripts/check-rounded-full.mjs', args: ['--staged'] }
  const cache = createGateContentCache({ cwd: repo, file, gateIds, ttlMs: GATE_CACHE_TTL_MS, now: () => clock })

  assert.equal(cache.lookup('11', input), null, '冷缓存不得命中')
  assert.equal(cache.record('11', input, { passed: false, ms: 9 }), false, '失败结果绝不入缓存')
  assert.equal(cache.lookup('11', input), null, '失败之后仍不得命中')

  assert.equal(cache.record('11', input, { passed: true, ms: 42 }), true, '通过结果应入缓存')
  assert.deepEqual(cache.lookup('11', input), { ageMs: 0, ms: 42 }, '同内容应命中并带原耗时')
  assert.equal(
    cache.lookup('11', { ...input, args: ['--staged', '--x'] }),
    null,
    'argv 不同不得命中(同一门的两个档不能互相顶替)',
  )
  assert.equal(cache.lookup('12', input), null, '白名单外不得查缓存')
  assert.equal(cache.record('12', input, { passed: true, ms: 1 }), false, '白名单外不得写缓存')

  clock += GATE_CACHE_TTL_MS
  assert.equal(cache.lookup('11', input), null, 'TTL 到期必须失效')

  // 内容一变 ⇒ 换一个实例也命中不了(键里有内容指纹,不是按 mtime/时间猜)。
  const cache2 = createGateContentCache({ cwd: repo, file, gateIds, ttlMs: GATE_CACHE_TTL_MS, now: () => clock })
  assert.equal(cache2.record('2e-dupns', input, { passed: true, ms: 7 }), true)
  writeFileSync(join(repo, 'a.mjs'), 'export const a = 3\n')
  const cache3 = createGateContentCache({ cwd: repo, file, gateIds, ttlMs: GATE_CACHE_TTL_MS, now: () => clock })
  assert.equal(cache3.lookup('2e-dupns', input), null, '内容变化后换实例也必须失效')

  // 逃生舱
  const off = createGateContentCache({ cwd: repo, file, gateIds, enabled: false, now: () => clock })
  assert.equal(off.lookup('11', input), null)
  assert.equal(off.record('11', input, { passed: true, ms: 1 }), false)

  // 坏文件 = 冷缓存,不得抛错
  writeFileSync(file, '{ this is not json')
  const broken = createGateContentCache({ cwd: repo, file, gateIds, now: () => clock })
  assert.equal(broken.lookup('11', input), null)
})

test('T5 过期条目在写盘时被修剪,不无限增长', () => {
  const { box, repo } = initRepo()
  const file = join(box, 'gate-cache.json')
  let clock = 2_000_000
  const cache = createGateContentCache({ cwd: repo, file, gateIds: new Set(['11', '2e-dupns']), now: () => clock })
  const input = { script: 's.mjs', args: [] }

  assert.equal(cache.record('11', input, { passed: true, ms: 1 }), true)
  clock += Math.floor(GATE_CACHE_TTL_MS / 2)
  assert.equal(cache.record('2e-dupns', input, { passed: true, ms: 2 }), true)
  clock += GATE_CACHE_TTL_MS + 1 // 此时 '11' 与 '2e-dupns' 都已过期
  assert.equal(cache.record('11', input, { passed: true, ms: 3 }), true)

  const saved = JSON.parse(readFileSync(file, 'utf8'))
  assert.deepEqual(Object.keys(saved.entries), ['11'], '过期条目应在写盘时被修剪')
})

test('T6 执行器接线:命中显式打印 ⚡、只在成功分支记账、重型门进延后清单', () => {
  const src = readFileSync(EXECUTOR, 'utf8')
  assert.match(src, /from '\.\/guardian-gate-cache\.mjs'/, '执行器必须 import 缓存 lib')
  assert.match(src, /命中指纹缓存/, '命中必须显式打印,不得静默跳门')

  const fnIdx = src.indexOf('function applyGateResult')
  assert.ok(fnIdx > 0, '找不到 applyGateResult')
  const passedIdx = src.indexOf('passed++', fnIdx)
  const recordIdx = src.indexOf('gateContentCache.record(', fnIdx)
  const catchIdx = src.indexOf('} catch (e) {', fnIdx)
  assert.ok(recordIdx > passedIdx && recordIdx < catchIdx, '记账必须落在成功分支内(失败/崩溃/warn 不入缓存)')

  const heavyIdx = src.indexOf('HEAVY_GATE_IDS.has(String(check.id))')
  assert.ok(heavyIdx > 0, '找不到重型门跳过分支')
  assert.ok(
    src.slice(heavyIdx, heavyIdx + 700).includes('deferredGates.push'),
    '重型门必须进延后清单 —— 否则预算没爆时 post-commit 不知道有门没跑',
  )
  assert.ok(
    src.indexOf('gateContentCache.lookup(') > heavyIdx,
    '缓存查询必须排在 skipEnv/stagedTriggers/重型门之后(被跳过的门不得被缓存洗绿)',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
