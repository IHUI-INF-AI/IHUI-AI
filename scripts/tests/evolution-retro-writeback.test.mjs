#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 镜像测试:evolution-retro.mjs 的「教训写回腿」(O65 第 3 期补写回,2026-10-25 立)。
 *
 * 判据全部 import 生产实现(§22c:本文件不复制判据/指纹/上限常量)。钉七环:
 *  ① 指纹 = 教训正文归一化哈希:空白/CRLF/大小写漂移同指纹,异文异指纹;
 *  ② 同指纹只增计数不新增行,台账字段 at/fingerprint/kind/lesson/evidence/ticket/commit 齐备;
 *  ③ limits.maxLessons 超限淘汰最旧条目并报数;
 *  ④ 白名单:AGENTS.md(§0 铁律受 root-guard 哈希锁)/ PROJECT_PLAN.md / 护栏清单 / 沙箱外一律拒写;
 *  ⑤ digest 带计数、确定序、受 maxDigestEntries 约束;
 *  ⑥ 落盘腿:无变化不写盘,有变化时 lessons 每指纹一行 + digest 重写;
 *  ⑦ CLI 真跑:默认只预览不落盘、--apply 才落、重复派出同指纹只增计数、--apply 与 --dry-run 互斥 exit 2。
 *
 * 临时目录落在仓内 `.ihui-agent/tmp/`(不使用 os.tmpdir,§26 C 盘防护)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { __test__ as X } from '../evolution-retro.mjs'

const SCRIPT = fileURLToPath(new URL('../evolution-retro.mjs', import.meta.url))
const ROOT = fileURLToPath(new URL('../../', import.meta.url)).replace(/[\\/]$/, '')
const POLICY_PATH = join(ROOT, 'scripts', 'data', 'lesson-writeback-policy.json')
const policy = X.loadLessonPolicy(readFileSync(POLICY_PATH, 'utf8'))
const NOW = Date.parse('2026-10-25T12:00:00.000Z')
const at = (hours) => new Date(NOW - hours * 3600_000).toISOString()

function makeTmp(tag) {
  const base = join(ROOT, '.ihui-agent', 'tmp')
  mkdirSync(base, { recursive: true })
  return mkdtempSync(join(base, `${tag}-`))
}

const dispatchItem = (extra = {}) => ({
  bucket: 'rollback|llm+web',
  action: 'rollback',
  dims: ['llm', 'web'],
  count: 2,
  lastTs: at(1),
  shas: ['aaaaaaa'],
  sampleReason: '健康门禁未过',
  windowHours: 24,
  ...extra,
})

test('指纹:归一化后同文同指纹、异文异指纹、形状受策略约束', () => {
  assert.equal(X.fingerprintOf('  门禁 未过\r\n', policy), X.fingerprintOf('门禁 未过', policy))
  assert.equal(X.fingerprintOf('\ufeffHealth Check ', policy), X.fingerprintOf('health check', policy))
  assert.notEqual(X.fingerprintOf('门禁 未过', policy), X.fingerprintOf('门禁 已过', policy))
  assert.match(X.fingerprintOf('x', policy), new RegExp(`^[a-f0-9]{${policy.fingerprint.length}}$`))
  assert.throws(() => X.fingerprintOf('x', { fingerprint: { algorithm: 'md5', length: 16 } }), /sha256/)
  assert.throws(() => X.fingerprintOf('x', { fingerprint: { algorithm: 'sha256', length: 4 } }), /8\.\.64/)
})

test('合并:同指纹只增计数不新增行,台账字段齐备', () => {
  const cand = X.lessonCandidateOf(dispatchItem(), { now: NOW, policy, ticket: 'R5D', commit: 'abc' })
  const plan = X.mergeLessons([{ ...cand, count: 1, lastAt: at(1) }], [cand], policy)
  assert.equal(plan.records.length, 1)
  assert.equal(plan.records[0].count, 2)
  assert.deepEqual(plan.appended, [])
  assert.deepEqual(plan.merged, [cand.fingerprint])
  for (const key of ['at', 'fingerprint', 'kind', 'lesson', 'evidence', 'ticket', 'commit'])
    assert.ok(key in plan.records[0], `台账缺字段 ${key}`)
  assert.equal(plan.records[0].ticket, 'R5D')

  const fresh = X.lessonCandidateOf(dispatchItem({ bucket: 'build-fail|', action: 'build-fail', dims: [] }), { now: NOW, policy })
  const added = X.mergeLessons(plan.records, [fresh], policy)
  assert.equal(added.records.length, 2)
  assert.deepEqual(added.appended, [fresh.fingerprint])
})

test('条数上限:超限从最旧一端淘汰并报数', () => {
  const small = { ...policy, limits: { ...policy.limits, maxLessons: 2 } }
  const mk = (text, hours) =>
    X.lessonCandidateOf(
      dispatchItem({ bucket: text, action: 'rollback', dims: [], sampleReason: text, lastTs: at(hours) }),
      { now: NOW, policy: small },
    )
  const plan = X.mergeLessons([], [mk('甲', 3), mk('乙', 2), mk('丙', 1)], small)
  assert.equal(plan.records.length, 2)
  assert.equal(plan.evicted.length, 1)
  assert.equal(plan.records[0].lesson.includes('乙'), true)
})

test('白名单:AGENTS.md / PROJECT_PLAN / 护栏清单 / 沙箱外一律拒写', () => {
  const bad = [
    'AGENTS.md',
    'PROJECT_PLAN.md',
    'scripts/data/root-guard-manifest.json',
    'scripts/data/lesson-writeback-policy.json',
    'scripts/evolution-retro.mjs',
    './.ihui-agent/../../AGENTS.md',
  ]
  for (const target of bad)
    assert.throws(
      () => X.assertWritableTarget({ kind: 'lessons', override: target, policy }),
      /禁写|哈希锁|沙箱|不可解析|越出/,
      `未拦住 ${target}`,
    )
  const ok = X.assertWritableTarget({ kind: 'lessons', policy })
  assert.ok(ok.replace(/\\/g, '/').endsWith('.ihui-agent/state/lessons.jsonl'))
  assert.ok(X.assertWritableTarget({ kind: 'digest', policy }).replace(/\\/g, '/').endsWith('.ihui-agent/state/lessons-digest.md'))
})

test('策略形状锁:坏 JSON / 缺字段 / 非法指纹口径 ⇒ 抛', () => {
  assert.throws(() => X.loadLessonPolicy('{'), /合法 JSON/)
  const broken = JSON.parse(readFileSync(POLICY_PATH, 'utf8'))
  delete broken.limits
  assert.throws(() => X.loadLessonPolicy(JSON.stringify(broken)), /limits/)
  const armed = JSON.parse(readFileSync(POLICY_PATH, 'utf8'))
  armed.targets.lessons = 'AGENTS.md'
  assert.throws(() => X.loadLessonPolicy(JSON.stringify(armed)), /AGENTS\.md|禁写/)
  const hollow = JSON.parse(readFileSync(POLICY_PATH, 'utf8'))
  hollow.sandboxRoots = []
  assert.throws(() => X.loadLessonPolicy(JSON.stringify(hollow)), /sandboxRoots/)
})

test('digest:带计数、确定序、受 maxDigestEntries 约束', () => {
  const mk = (text, count) =>
    X.lessonCandidateOf(
      dispatchItem({ bucket: text, action: 'rollback', dims: [], sampleReason: text, count }),
      { now: NOW, policy },
    )
  const first = mk('构建失败', 3)
  const plan = X.mergeLessons([{ ...first, count: 1, lastAt: at(1) }], [first, mk('健康门禁未过', 2)], policy)
  const text = X.formatLessonsDigest(plan.records, policy, { generatedAt: '2026-10-25T00:00:00.000Z' })
  assert.ok(text.includes('| 1 | 2 |'), '计数未进 digest')
  assert.ok(text.includes('桶='), '证据未进 digest')
  assert.ok(!text.includes('\r'))
  assert.equal(text, X.formatLessonsDigest(plan.records, policy, { generatedAt: '2026-10-25T00:00:00.000Z' }))
  const capped = X.formatLessonsDigest(plan.records, { ...policy, limits: { ...policy.limits, maxDigestEntries: 1 } }, { generatedAt: '2026-10-25T00:00:00.000Z' })
  assert.equal(capped.split('\n').filter((l) => /^\| \d+ \|/.test(l)).length, 1)
  assert.ok(capped.includes('仅列计数最高的前 1 条'))
})

test('落盘腿:无变化不写盘,有变化 = lessons 每指纹一行 + digest 重写', () => {
  const cand = X.lessonCandidateOf(dispatchItem(), { now: NOW, policy })
  const plan = X.mergeLessons([], [cand], policy)
  const writes = []
  const res = X.applyLessonWriteback({
    policy,
    plan,
    lessonsPath: 'L.jsonl',
    digestPath: 'D.md',
    write: (p, text) => writes.push([p, text]),
  })
  assert.equal(res.wrote, true)
  assert.deepEqual(writes.map((w) => w[0]), ['L.jsonl', 'D.md'])
  const rows = writes[0][1].split('\n').filter(Boolean)
  assert.equal(rows.length, 1)
  assert.equal(JSON.parse(rows[0]).fingerprint, cand.fingerprint)

  const quiet = []
  const noop = X.applyLessonWriteback({
    policy,
    plan: { records: [cand], appended: [], merged: [], evicted: [] },
    lessonsPath: 'L.jsonl',
    digestPath: 'D.md',
    write: (p, text) => quiet.push([p, text]),
  })
  assert.equal(noop.wrote, false)
  assert.equal(quiet.length, 0)
})

test('CLI:默认只预览不落盘 / --apply 才落 / 重复派出只增计数 / 互斥与越界 exit 2', () => {
  const dir = makeTmp('lesson-writeback')
  try {
    const decisions = join(dir, 'decisions.jsonl')
    const recent = (h) => new Date(Date.now() - h * 3600_000).toISOString()
    const rows = [
      { v: 1, ts: recent(1), action: 'rollback', failDims: ['web', 'llm'], reason: '健康门禁未过', sha: 'aaaaaaa' },
      { v: 1, ts: recent(2), action: 'rollback', failDims: ['llm', 'web'], reason: '健康门禁未过', sha: 'bbbbbbb' },
    ]
    writeFileSync(decisions, `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`, 'utf8')
    const lessons = join(dir, 'lessons.jsonl')
    const digest = join(dir, 'digest.md')
    const baseArgs = [SCRIPT, '--decisions', decisions, '--lessons', lessons, '--digest', digest]

    const preview = spawnSync(process.execPath, [...baseArgs, '--ledger', join(dir, 'r1.jsonl')], { encoding: 'utf8', cwd: ROOT })
    assert.equal(preview.status, 0, preview.stderr)
    assert.ok(preview.stdout.includes('教训写回'))
    assert.ok(preview.stdout.includes('未加 --apply'))
    assert.ok(!existsSync(lessons), '预览不得落 lessons')
    assert.ok(!existsSync(digest), '预览不得落 digest')

    const first = spawnSync(process.execPath, [...baseArgs, '--ledger', join(dir, 'r2.jsonl'), '--apply', '--ticket', 'R5D'], { encoding: 'utf8', cwd: ROOT })
    assert.equal(first.status, 0, first.stderr)
    assert.ok(existsSync(lessons) && existsSync(digest), '--apply 必须落两件产物')
    assert.equal(readFileSync(lessons, 'utf8').split('\n').filter(Boolean).length, 1)
    assert.equal(JSON.parse(readFileSync(lessons, 'utf8').trim()).ticket, 'R5D')

    // 换本 retro 台账 ⇒ 同一病灶再派一次,教训同指纹只增计数不新增行
    const second = spawnSync(process.execPath, [...baseArgs, '--ledger', join(dir, 'r3.jsonl'), '--apply'], { encoding: 'utf8', cwd: ROOT })
    assert.equal(second.status, 0, second.stderr)
    const stored = readFileSync(lessons, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    assert.equal(stored.length, 1, '同指纹不得新增行')
    assert.equal(stored[0].count, 2, '重复派出必须只增计数')
    assert.ok(readFileSync(digest, 'utf8').includes('| 1 | 2 |'))

    const both = spawnSync(process.execPath, [...baseArgs, '--ledger', join(dir, 'r4.jsonl'), '--apply', '--dry-run'], { encoding: 'utf8', cwd: ROOT })
    assert.equal(both.status, 2, both.stdout)

    const guarded = spawnSync(process.execPath, [SCRIPT, '--decisions', decisions, '--lessons', 'AGENTS.md', '--digest', digest, '--ledger', join(dir, 'r5.jsonl'), '--apply'], { encoding: 'utf8', cwd: ROOT })
    assert.equal(guarded.status, 2, guarded.stdout)
    assert.ok(guarded.stdout.includes('AGENTS.md'))

    const missing = spawnSync(process.execPath, [...baseArgs, '--decisions', join(dir, 'nope.jsonl')], { encoding: 'utf8', cwd: ROOT })
    assert.equal(missing.status, 2, missing.stdout)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
