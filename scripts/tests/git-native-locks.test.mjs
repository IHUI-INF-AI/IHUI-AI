// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

/**
 * git-native-locks.test.mjs — G-262 原生锁可判检测的镜像测试(§22c:import 源实现,不抄判据)
 *
 * 红线:全部用例在 mkScratch 夹具目录里跑,绝不碰真实 `.git`;
 * 真死 pid 用"前提自证"(与 git-lock-stale-steal.test.mjs 同一姿势),不靠假设。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, utimesSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import {
  listNativeLocks,
  classifyLock,
  scanNativeLocks,
  countGitProcsFromTasklist,
  EMBED_PID_PATTERNS,
} from '../lib/git-native-locks.mjs'
import { __test__ as gl } from '../git-lock.mjs'

const DEAD_PID = 991234 // 下面第 0 条自证它是死的

function mkGit(t) {
  const scratch = mkScratch('git-native-locks')
  t.after(() => rmScratch(scratch))
  mkdirSync(join(scratch, 'worktrees', 'wt1'), { recursive: true })
  mkdirSync(join(scratch, 'objects'), { recursive: true })
  return scratch
}
function put(t, rel, { ageMs = 1000, content = '' } = {}) {
  const p = join(t, ...rel.split('/'))
  writeFileSync(p, content)
  const when = new Date(Date.now() - ageMs)
  utimesSync(p, when, when)
  return p
}

test('前提:DEAD_PID 在本机确实是死的(否则 dead-confirmed 用例测的是空气)', () => {
  assert.equal(gl.isPidAlive(DEAD_PID), false, `pid ${DEAD_PID} 居然活着`)
  assert.equal(gl.isPidAlive(process.pid), true)
})

test('① 枚举:三族锁全收、非锁不收、embeddedPid 从名字解出', (t) => {
  const g = mkGit(t)
  put(g, 'index.lock')
  put(g, 'next-index-4242.lock')
  put(g, 'worktrees/wt1/index.lock')
  put(g, 'objects/maintenance.lock')
  put(g, 'HEAD') // 非 .lock 不得进集
  const { locks, gitRootUnreadable } = listNativeLocks({ gitRoot: g, now: Date.now() })
  assert.equal(gitRootUnreadable, false)
  const rels = locks.map((l) => l.rel).sort()
  assert.deepEqual(rels, [
    'index.lock',
    'next-index-4242.lock',
    'objects/maintenance.lock',
    'worktrees/wt1/index.lock',
  ])
  const ni = locks.find((l) => l.name === 'next-index-4242.lock')
  assert.equal(ni.embeddedPid, 4242)
  assert.equal(locks.find((l) => l.name === 'index.lock').embeddedPid, null)
})

test('② 分类三态:死 pid⇒dead-confirmed,活 pid⇒pid-alive,无归属证据⇒no-owner-evidence', () => {
  const isPidAlive = (pid) => pid !== DEAD_PID // 桩:只有 DEAD_PID 判死,其余判活
  assert.equal(classifyLock({ embeddedPid: DEAD_PID }, { isPidAlive }).verdict, 'dead-confirmed')
  assert.equal(classifyLock({ embeddedPid: 4242 }, { isPidAlive: () => true }).verdict, 'pid-alive')
  assert.equal(classifyLock({ embeddedPid: null }, { isPidAlive }).verdict, 'no-owner-evidence')
  // 判活本身抛错 ⇒ 不得折成"死"(unverifiable 与"判过是死"必须长得不一样)
  const thrown = classifyLock(
    { embeddedPid: 4242 },
    {
      isPidAlive: () => {
        throw new Error('boom')
      },
    },
  )
  assert.equal(thrown.verdict, 'no-owner-evidence')
  assert.match(thrown.why, /不可达/)
})

test('③ scanNativeLocks 计数与真实判活端到端(夹具内真 pid,不注桩)', (t) => {
  const g = mkGit(t)
  put(g, `next-index-${DEAD_PID}.lock`)
  put(g, `next-index-${process.pid}.lock`)
  put(g, 'index.lock')
  const r = scanNativeLocks({ gitRoot: g, isPidAlive: gl.isPidAlive })
  assert.deepEqual(r.counts, { dead: 1, alive: 1, unevidenced: 1 })
})

test('④ tasklist 计数:GBK 码页的"没有运行的任务"必须读成 0 而不是量不到', () => {
  // 真机实测(2026-09-28):tasklist 无匹配时按 GBK 码页输出该行,utf8 读得到乱码 ⇒
  // 旧写法把"0 个进程"读成"量不到"。这里用已知 GBK 字节钉死解码方向。
  const realGbk = Buffer.from([
    0xd0, 0xc5, 0xcf, 0xa2, 0x3a, 0x20, 0xc3, 0xbb, 0xd3, 0xd0, 0xd4, 0xcb, 0xd0, 0xd0, 0xb5, 0xc4,
    0xc8, 0xce, 0xce, 0xf1, 0xc6, 0xa5, 0xc5, 0xe4, 0xd6, 0xb8, 0xb6, 0xa8, 0xb5, 0xc4, 0xd7, 0xbc,
    0xb1, 0xb8, 0xa1, 0xa3,
  ])
  assert.equal(countGitProcsFromTasklist(realGbk), 0, 'GBK 乱码坑的回归锁:0 进程不得读成 null')
  assert.equal(
    countGitProcsFromTasklist('INFO: No Tasks Are Running which Match the Specified Criteria'),
    0,
  )
  const three = [
    'git.exe        123 Console  ...',
    'git.exe        456 Console  ...',
    'git.exe        789 Console  ...',
  ].join('\r\n')
  assert.equal(countGitProcsFromTasklist(Buffer.from(three, 'latin1')), 3)
  assert.equal(countGitProcsFromTasklist('完全不相干的输出'), null, '认不出的格式 ⇒ null,不折成 0')
  assert.equal(countGitProcsFromTasklist(undefined), null)
})

test('⑤ clean 接线:dead-confirmed 立即清,pid-alive 与无证据的活 index.lock 不碰', (t) => {
  const g = mkGit(t)
  const dead = put(g, `next-index-${DEAD_PID}.lock`)
  const live = put(g, `next-index-${process.pid}.lock`)
  const idx = put(g, 'index.lock', { ageMs: 1000 })
  const cleaned = gl.cleanStaleIndexLocks({ gitRoot: g, hasGitProcessProbe: () => true })
  assert.ok(
    cleaned.some((c) => c.startsWith(dead)),
    `死锁未被清理:${cleaned}`,
  )
  assert.ok(!existsSync(dead))
  assert.ok(existsSync(live), 'pid 存活的同名锁被误删 ⇒ 抢占判据失守')
  assert.ok(existsSync(idx), '有 git 进程在跑且 index.lock 未超龄 ⇒ 既有判据不得放宽')
})

test('⑥ percentile:P95 取数形状(n=20 时是第 19 个,不是第 20 个)', () => {
  const nums = Array.from({ length: 20 }, (_, i) => i + 1)
  assert.equal(gl.percentile(nums, 0.95), 19)
  assert.equal(gl.percentile([], 0.95), null)
})

test('⑦ acquire 记账:等过才记,没等不记;不传 metricsFile 一个字都不落', async (t) => {
  const g = mkScratch('git-lock-metrics')
  t.after(() => rmScratch(g))
  const dir = join(g, 'ihui-git-write.lock')
  const metricsFile = join(g, 'metrics.jsonl')
  // 先放一把死 pid 的锁 ⇒ 本轮必然等过(抢占后成功)
  mkdirSync(dir)
  writeFileSync(
    join(dir, 'meta.json'),
    JSON.stringify({ unitId: 'other', pid: DEAD_PID, ts: Date.now() - 1000 }),
    'utf8',
  )
  const logs = []
  const ok = await gl.acquire({
    unitId: 'me',
    dir,
    metricsFile,
    cleanIndexLocks: false,
    claimArchiveRoot: join(g, 'arch'),
    log: (m) => logs.push(m),
  })
  assert.equal(ok, true)
  const lines = readFileSync(metricsFile, 'utf8').split(/\r?\n/).filter(Boolean)
  assert.equal(lines.length, 1)
  const rec = JSON.parse(lines[0])
  assert.equal(rec.kind, 'wait')
  assert.equal(rec.outcome, 'acquired')
  assert.ok(rec.polls >= 1 && rec.waitMs >= 0)
  // 不传 metricsFile 的同型流程 ⇒ 不得产生任何账本文件
  const dir2 = join(g, 'l2')
  mkdirSync(dir2)
  writeFileSync(
    join(dir2, 'meta.json'),
    JSON.stringify({ unitId: 'other2', pid: DEAD_PID, ts: Date.now() - 1000 }),
    'utf8',
  )
  await gl.acquire({
    unitId: 'me2',
    dir: dir2,
    cleanIndexLocks: false,
    claimArchiveRoot: join(g, 'arch2'),
    log: () => {},
  })
  assert.ok(!existsSync(join(g, 'l2', 'metrics.jsonl')))
})

test('⑧ EMBED_PID_PATTERNS 形态锁:next-index 命名变了要当场翻红,而不是静默漏族', () => {
  assert.deepEqual(EMBED_PID_PATTERNS.map(String), ['/^next-index-(\\d+)\\.lock$/'])
})
