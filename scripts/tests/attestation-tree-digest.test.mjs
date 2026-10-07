// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-1059139 的 §22c 镜像:批次留痕出口 + treeDigest 归一。判据的**唯一实现**住在
 * `scripts/lib/attestation-tree-digest.mjs`,本文件只 import `__test__`(§22c:禁止在测试里复制源判据)。
 *
 * 有牙证明分两头,因为它们各防一种"等价变异":
 *   - **排序**这一步必须由乱序构造面证明 —— 真仓的 ls-files 与 ls-tree 天然同序,
 *     只拿真仓做正向证明时,"把 sort() 去掉"是一条不动任何结论的等价变异;
 *   - **剥类型字段**这一步必须由形状锁证明 —— ls-files 侧本就没有 `blob` 这个词,
 *     留着它就与 ls-files 永不同形,而那正是"两侧对不上 ⇒ 全都落不回新态"的成因。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'
import { __test__ as gate } from '../lib/attestation-tree-digest.mjs'

const GIT = resolveGitBin()
const ro = (root, args, timeout = 60_000) =>
  execFileSync(GIT, ['-c', 'safe.directory=*', ...args], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    timeout,
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  })
const A40 = 'a'.repeat(40)
const B40 = 'b'.repeat(40)

test('T1 排序有牙:两侧行序不同也必须同 digest(去掉 sort() 即翻红)', () => {
  const lf = `100644 ${A40} 0\tb/c.ts\u0000100644 ${B40} 0\ta/d.ts\u0000`
  const lt = `100644 blob ${B40}\ta/d.ts\u0000100644 blob ${A40}\tb/c.ts\u0000`
  const a = gate.digestFromEntryText(lf, 'ls-files')
  const b = gate.digestFromEntryText(lt, 'ls-tree')
  assert.equal(a.ok, true, a.why)
  assert.equal(b.ok, true, b.why)
  assert.equal(a.digest, b.digest, '乱序的两份同内容条目必须归一到同一 digest')
})

test('T2 形状锁:ls-tree 的 blob/tree/commit 类型字段必须被剥掉(不剥即翻红)', () => {
  const n = gate.normalizeGitEntries(`100644 blob ${A40}\tsrc/x.ts\u0000`, 'ls-tree')
  assert.equal(n.count, 1)
  assert.equal(n.lines[0], `100644 ${A40}\tsrc/x.ts`)
  assert.ok(!n.lines[0].includes('blob'), '行内不得残留类型字段')
  const same = gate.digestFromEntryText(`100644 ${A40} 0\tsrc/x.ts\u0000`, 'ls-files')
  assert.equal(gate.digestFromEntryText(`100644 blob ${A40}\tsrc/x.ts\u0000`, 'ls-tree').digest, same.digest)
})

test('T3 unmerged 条目整条剔除;剔到空集合不得签发 digest', () => {
  const n = gate.normalizeGitEntries(`100644 ${A40} 1\tf.ts\u0000100644 ${B40} 2\tf.ts\u0000`, 'ls-files')
  assert.equal(n.count, 0)
  assert.equal(n.droppedUnmerged, 2)
  const d = gate.digestFromEntryText(`100644 ${A40} 1\tf.ts\u0000`, 'ls-files')
  assert.equal(d.ok, false)
  assert.match(d.why, /枚举到 0 条目/)
  assert.equal(d.digest, null)
})

test('T4 空枚举判死:0 条目不签发;未知取材形态直接抛', () => {
  for (const src of ['ls-files', 'ls-tree']) {
    const d = gate.digestFromEntryText('', src)
    assert.equal(d.ok, false)
    assert.equal(d.digest, null)
  }
  assert.throws(() => gate.normalizeGitEntries(`100644 ${A40} 0\tf\u0000`, 'nonsense'), /未知取材形态/)
})

test('T5 构造校验:结构不齐就抛,不留"看起来有记录"的空壳;declaredFiles 超上限只截断', () => {
  const base = {
    mode: 'staged',
    totalChecks: 214,
    executed: 211,
    blockingFailed: 0,
    selfSkipped: [],
    notTriggered: [],
    declaredFiles: ['x.ts'],
    undeclaredSkipHits: 0,
    treeDigest: 'f'.repeat(64),
  }
  assert.equal(gate.buildGateBatchRecord(base).kind, gate.GATE_BATCH_KIND)
  assert.equal(typeof gate.buildGateBatchRecord({ ...base, nowMs: 1_760_000_000_000 }).ts, 'number')
  assert.throws(() => gate.buildGateBatchRecord({ ...base, mode: 'push-gate' }), /mode/)
  assert.throws(() => gate.buildGateBatchRecord({ ...base, executed: 300 }), /executed/)
  assert.throws(() => gate.buildGateBatchRecord({ ...base, selfSkipped: [{ id: '52' }] }), /skipEnv/)
  assert.throws(() => gate.buildGateBatchRecord({ ...base, selfSkipped: [{ skipEnv: 'X' }] }), /缺 id/)
  assert.throws(() => gate.buildGateBatchRecord({ ...base, declaredFiles: null }), /declaredFiles/)
  const many = Array.from({ length: 350 }, (_, i) => `f${i}.ts`)
  const rec = gate.buildGateBatchRecord({ ...base, declaredFiles: many, declaredFilesTotalSeen: many.length })
  assert.equal(rec.declaredFiles.length, gate.DECLARED_FILES_CAP, '超出上限只截断,不写全量')
  assert.equal(rec.declaredFilesTruncated, true)
  assert.equal(rec.declaredFilesTotalSeen, 350)
  assert.equal(gate.buildGateBatchRecord({ ...base, treeDigest: null, treeDigestWhy: 'ls-files 挂了' }).treeDigest, null)
  assert.equal(gate.buildGateBatchRecord({ ...base, undeclaredSkipHits: null }).undeclaredSkipHits, null)
})

function scratchRepo(t) {
  const dir = mkScratch('gate-batch-')
  ro(dir, ['init', '-q', '-b', 'main'])
  writeFileSync(join(dir, 'a.ts'), 'export const a = 1\n')
  mkdirSync(join(dir, 'sub'), { recursive: true })
  writeFileSync(join(dir, 'sub', 'b.ts'), 'export const b = 2\n')
  return dir
}

test('T6 真 git 面端到端:index digest ↔ commit tree digest 逐字同形,台账写后读回一致', (t) => {
  const dir = scratchRepo(t)
  try {
    ro(dir, ['add', '-A'])
    const idx = gate.indexTreeDigest({ root: dir })
    assert.equal(idx.ok, true, idx.why)
    ro(dir, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'seed'])
    const sha = ro(dir, ['rev-parse', 'HEAD']).trim()
    const td = gate.treeDigestForCommit({ root: dir, sha })
    assert.equal(td.ok, true, td.why)
    // 绑定钥匙的正向证明:索引面与刚落地那枚的 tree 必须同形(两侧共用一份归一)。
    assert.equal(td.digest, idx.digest, 'ls-files 与 ls-tree 归一后的行集必须逐字相等')
    const w = gate.appendGateBatchRecord({
      root: dir,
      mode: 'staged',
      totalChecks: 3,
      executed: 3,
      blockingFailed: 0,
      selfSkipped: [{ id: '52', label: '弹窗守门', skipEnv: 'HUSKY_SKIP_VISIBLE_SPAWN' }],
      notTriggered: [{ id: '61', label: '安装器', reason: 'stagedTriggers 未触及' }],
      undeclaredSkipHits: 0,
      declaredFiles: ['a.ts'],
      treeDigest: idx.digest,
      ranFullBatch: true,
    })
    assert.equal(w.ok, true, w.why)
    assert.ok(existsSync(w.path), '批次留痕必须写进同一本台账(commit-attestation 的那条路径)')
    const rd = gate.readGateBatchRecords(dir)
    assert.equal(rd.ok, true)
    assert.equal(rd.records.length, 1)
    assert.equal(rd.records[0].treeDigest, idx.digest)
    assert.equal(rd.records[0].selfSkipped[0].skipEnv, 'HUSKY_SKIP_VISIBLE_SPAWN')
    assert.equal(rd.records[0].notTriggered[0].id, '61', '未触及 ≠ 跳门,必须分格存下来')
    assert.equal(rd.records[0].gatesRun, true)
    assert.equal(dirname(w.path), join(dir, '.workbuddy'))
    const lines = readFileSync(w.path, 'utf8').split('\n').filter((l) => l.trim() !== '')
    assert.equal(lines.length, 1)
    assert.equal(JSON.parse(lines[0]).kind, gate.GATE_BATCH_KIND)
  } finally {
    rmScratch(dir)
  }
})

test('T7 写留痕永不抛:台账不可写时回 {ok:false,why},不改调用方退出码', (t) => {
  const dir = mkScratch('gate-batch-')
  try {
    writeFileSync(join(dir, 'not-a-dir'), 'x')
    const w = gate.appendGateBatchRecord({
      root: join(dir, 'not-a-dir'),
      mode: 'full',
      totalChecks: 1,
      executed: 1,
      blockingFailed: 0,
      selfSkipped: [],
      notTriggered: [],
      declaredFiles: [],
      treeDigest: 'd'.repeat(64),
    })
    assert.equal(w.ok, false)
    assert.match(w.why, /未落批次留痕/)
  } finally {
    rmScratch(dir)
  }
})

test('T8 步骤级门三态:命中才计数,面读不到落 undetermined(绝不折成 0)', () => {
  const env = { HUSKY_SKIP_UNDECLARED: '1', HUSKY_SKIP_OTHER: '' }
  const files = {
    'scripts/lib/pre-commit-hook.js':
      "if (process.env.HUSKY_SKIP_UNDECLARED === '1') {}\nif (process.env.HUSKY_SKIP_DECLARED === '1') {}\n",
    '.husky/pre-commit': 'if [ "${HUSKY_SKIP_DECLARED:-0}" = "1" ]; then :; fi\n',
  }
  const r = gate.stepLevelSkipHits({
    root: '/nope',
    declared: ['HUSKY_SKIP_DECLARED'],
    env,
    faces: ['scripts/lib/pre-commit-hook.js', '.husky/pre-commit', '.husky/commit-msg'],
    readFile: (p) => {
      const norm = String(p).split(String.fromCharCode(92)).join("/")
      const rel = Object.keys(files).find((k) => norm.endsWith("/" + k))
      if (!rel) throw Object.assign(new Error("no such face: " + p), { code: "ENOENT" })
      return files[rel]
    },
  })
  assert.equal(r.count, 1, JSON.stringify(r.hits))
  assert.equal(r.hits[0].name, 'HUSKY_SKIP_UNDECLARED', 'runner 已声明的 skipEnv 不得重复计成"未声明命中"')
  assert.equal(r.undetermined.length, 1, '读不到的那个面必须点名')
  assert.equal(r.ok, false)
})

test('T9 台账缺席 ≠ 没人跑门:missing 必须如实报 state,不得静默成 0 条', (t) => {
  const dir = mkScratch('gate-batch-')
  try {
    const r = gate.readGateBatchRecords(dir)
    assert.equal(r.ok, false)
    assert.equal(r.state, 'missing')
    assert.equal(r.records.length, 0)
    assert.match(r.why, /ENOENT/)
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
