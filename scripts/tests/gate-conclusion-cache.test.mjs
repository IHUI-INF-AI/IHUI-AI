// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 门结论缓存库的镜子（`scripts/lib/gate-conclusion-cache.mjs`）。
 *
 * 这座库不是判据，但它决定"一段结论能不能被重印" —— 一旦它在不该命中时命中，
 * 后果就是一次**假绿**（日志里有结论、实际上没判）。所以这几条必须逐条钉住：
 * T1 往返、T2 超期、T3 畸形、T4 schema、T5 摘要敏感性、T6 输出捕获、T7 接入形状。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const LIB = pathToFileURL(resolve('scripts/lib/gate-conclusion-cache.mjs')).href
const GATE = resolve('scripts/check-rounded-full.mjs')

const {
  CONCLUSION_SCHEMA,
  cacheEnabled,
  captureStdout,
  digestOf,
  fmtAge,
  readConclusion,
  replayNote,
  writeConclusion,
} = await import(LIB)

function tmpRoot() {
  const d = mkdtempSync(join(tmpdir(), 'gate-cache-'))
  return { dir: d, cleanup: () => rmSync(d, { recursive: true, force: true }) }
}

test('T1 写—读往返：键、退出码、逐行正文原样回来', () => {
  const { dir, cleanup } = tmpRoot()
  try {
    const key = digestOf(['k', 1])
    const ok = writeConclusion(dir, 'demo', { key, exitCode: 0, lines: ['a', 'b  c'], nowMs: 1000 })
    assert.equal(ok, true)
    const back = readConclusion(dir, 'demo', { nowMs: 1001, ttlMs: 60_000 })
    assert.equal(back.key, key)
    assert.equal(back.exitCode, 0)
    assert.deepEqual(back.lines, ['a', 'b  c'])
    assert.equal(back.finishedAt, 1000)
  } finally {
    cleanup()
  }
})

test('T2 超期一律当没有：宁可多跑一次，也不回放陈旧结论', () => {
  const { dir, cleanup } = tmpRoot()
  try {
    writeConclusion(dir, 'demo', { key: digestOf(['k']), exitCode: 0, lines: ['x'], nowMs: 0 })
    assert.equal(readConclusion(dir, 'demo', { nowMs: 10, ttlMs: 60_000 }).key, digestOf(['k']))
    assert.equal(readConclusion(dir, 'demo', { nowMs: 60_001, ttlMs: 60_000 }), null)
  } finally {
    cleanup()
  }
})

test('T3 畸形件（半截 JSON / 非数组 lines / 缺 finishedAt）⇒ null，不得抛', () => {
  const { dir, cleanup } = tmpRoot()
  try {
    const p = join(dir, '.ihui-agent', 'state', 'gate-conclusions', 'bad.json')
    writeConclusion(dir, 'bad', { key: digestOf(['k']), exitCode: 0, lines: ['x'], nowMs: 1 })
    writeFileSync(p, '{ not json', 'utf8')
    assert.equal(readConclusion(dir, 'bad', { nowMs: 1 }), null)
    writeFileSync(
      p,
      JSON.stringify({ schema: CONCLUSION_SCHEMA, key: digestOf(['k']), exitCode: 0, lines: 'oops', finishedAt: 1 }),
      'utf8',
    )
    assert.equal(readConclusion(dir, 'bad', { nowMs: 1 }), null)
    writeFileSync(
      p,
      JSON.stringify({ schema: CONCLUSION_SCHEMA, key: digestOf(['k']), exitCode: 0, lines: [] }),
      'utf8',
    )
    assert.equal(readConclusion(dir, 'bad', { nowMs: 1 }), null)
  } finally {
    cleanup()
  }
})

test('T4 schema 抬版本后旧件自然失效（不做迁移）', () => {
  const { dir, cleanup } = tmpRoot()
  try {
    const p = join(dir, '.ihui-agent', 'state', 'gate-conclusions', 'old.json')
    writeConclusion(dir, 'old', { key: digestOf(['k']), exitCode: 0, lines: ['x'], nowMs: 1 })
    writeFileSync(
      p,
      JSON.stringify({ schema: 999, key: digestOf(['k']), exitCode: 0, lines: ['x'], finishedAt: 1 }),
      'utf8',
    )
    assert.equal(readConclusion(dir, 'old', { nowMs: 1 }), null)
  } finally {
    cleanup()
  }
})

test('T5 摘要：同入参稳定、任一片段变即变（键必须覆盖判据与内容）', () => {
  assert.equal(digestOf(['a', 'b']), digestOf(['a', 'b']))
  assert.notEqual(digestOf(['a', 'b']), digestOf(['a', 'c']))
  assert.notEqual(digestOf(['a', 'b']), digestOf(['ab']))
  assert.match(digestOf(['a']), /^[0-9a-f]{40}$/)
})

test('T6 captureStdout 真行为：捕获期内 console.log 进缓冲，restore 后回到原函数', () => {
  const before = console.log
  const cap = captureStdout()
  const seen = []
  // 在捕获后的实现上再套一层记录，验证"原样仍打到 stdout"
  const captured = console.log
  console.log = (...a) => {
    captured(...a)
    seen.push(a.join(' '))
  }
  try {
    console.log('hello world')
    assert.equal(seen.length, 1)
    assert.equal(seen[0], 'hello world')
    assert.deepEqual(cap.lines, ['hello world'])
  } finally {
    console.log = before
    cap.restore()
  }
  // restore 之后再用 console.log 不得再进缓冲
  const after = cap.lines.length
  console.log = before
  assert.equal(cap.lines.length, after)
})

test('T7 接入形状锁：只在全量档缓存，且键含判据指纹、退出时落盘', () => {
  const src = readFileSync(GATE, 'utf8')
  // ① 启用条件必须同时排除 staged 与 worktree（两者都不许回放）
  assert.match(src, /!isStaged && !isWorktree && cacheEnabled\(\)/)
  // ② 键里必须有判据指纹函数，且指纹覆盖库自身（判据一改键必变）
  assert.match(src, /function judgeFingerprint\(\)/)
  assert.match(src, /scripts\/lib\/gate-conclusion-cache\.mjs/)
  // ③ 取不到 sha ⇒ 不算键（不猜）
  assert.match(src, /missing > 0\) return null/)
  // ④ 回放必须带"复用的是哪一刻"与作废出路
  assert.match(src, /replayNote\(cached, conclusionKey\)/)
  // ⑤ 结论在退出码定下来时才落盘（不能先写后跑）
  assert.match(src, /process\.on\('exit', \(code\)/)
})

test('T8 总开关与时长文案', () => {
  assert.equal(cacheEnabled({}), true)
  assert.equal(cacheEnabled({ IHUI_GATE_CONCLUSION_CACHE: '0' }), false)
  assert.equal(fmtAge(0), '0s')
  assert.equal(fmtAge(59_000), '59s')
  assert.equal(fmtAge(15 * 60_000), '15 分钟')
  const entry = { finishedAt: 0, exitCode: 0, lines: [] }
  const note = replayNote(entry, 'abcdef0123', 60_000)
  assert.match(note, /复用 1 分钟前的结论/)
  assert.match(note, /abcdef0123/)
  assert.match(note, /IHUI_GATE_CONCLUSION_CACHE=0/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
