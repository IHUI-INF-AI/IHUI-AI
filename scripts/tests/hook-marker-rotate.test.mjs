// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/lib/hook-marker.sh` + `scripts/lib/hook-markers.mjs` 的验收尺(第三笔)。
 *
 * 三条性质,与第一笔的并发治本同一套结论(不许全进程抢同一句柄):
 *   M1 按大小轮转**不丢行**:旧活跃文件整体变成 `.1`,新行只进活跃文件;
 *   M2 并发 N 路写**不写坏**:每行都是完整合法 JSON,行数恰好 N(锁串行 + 分片兜底);
 *   M3 读侧跨轮转顺序拼接:`.N` → … → `.1` → 活跃 → 分片;
 *      坏行进 `malformed` 而不是被静默丢掉。
 *
 * 跑法:`node --test scripts/tests/hook-marker-rotate.test.mjs`
 * 前提:Git Bash 的 bash 在 PATH(Node 里 spawn('bash') 实测可用)。
 */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { test } from 'node:test'

import { listHookMarkerFiles, readHookMarkers } from '../lib/hook-markers.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const ROOT = resolve(import.meta.dirname, '..', '..')
const LIB = join(ROOT, 'scripts', 'lib', 'hook-marker.sh').replace(/\\/g, '/')
const MARKER_SUBDIR = join('.ihui-agent', 'state', 'hook-logs')

function shPath(p) {
  return p.replace(/\\/g, '/')
}

function runMarker(dir, event, extraEnv = {}) {
  return new Promise((done) => {
    const script = `. "${LIB}"\nhook_marker "${event}" "expected-${event}" "got-${event}"\n`
    const cp = spawn('bash', ['-c', script], {
      cwd: ROOT,
      env: {
        ...process.env,
        IHUI_MARKER_DIR: shPath(dir),
        ...extraEnv,
      },
    })
    let err = ''
    cp.stderr.on('data', (b) => {
      err += String(b)
    })
    cp.on('error', (e) => done({ rc: null, err: `${err}${e?.message ?? e}` }))
    cp.on('close', (rc) => done({ rc, err }))
  })
}

function makeRoot() {
  const root = mkScratch('hook-marker-')
  const dir = join(root, MARKER_SUBDIR)
  mkdirSync(dir, { recursive: true })
  return { root, dir }
}

function parseJsonLines(text) {
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
    .map((l) => JSON.parse(l))
}

test('M1 按大小轮转:旧行整体进 .1,新行只进活跃文件,一行不丢', async () => {
  const { root, dir } = makeRoot()
  try {
    const active = join(dir, 'hook-markers.jsonl')
    const oldLines = Array.from(
      { length: 10 },
      (_, i) =>
        `{"hook":"pre-commit","stage":"sh","event":"old-${i}","ts":"2026-11-04T00:00:0${i}Z","expected":"e","got":"g"}`,
    )
    writeFileSync(active, `${oldLines.join('\n')}\n`)
    // 阈值 800 字节:旧文件(~1200B)必须先轮转,而单条新行(~150B)远低于阈值 ⇒
    // 第二次追加不应再次轮转,正是"按大小"而不是"每次必转"。
    const r = await runMarker(dir, 'new-1', { IHUI_MARKER_MAX_BYTES: '800' })
    assert.equal(r.rc, 0, `hook_marker 必须 rc=0(证据写失败不阻断),stderr=${r.err}`)

    const rotated = join(dir, 'hook-markers.jsonl.1')
    assert.ok(existsSync(rotated), '旧活跃文件必须轮转为 .1')
    assert.equal(readFileSync(rotated, 'utf8'), `${oldLines.join('\n')}\n`)
    const newLines = parseJsonLines(readFileSync(active, 'utf8'))
    assert.equal(newLines.length, 1, '活跃文件只应有轮转后的新行')
    assert.equal(newLines[0].event, 'new-1')

    // 再写一行:未到阈值,应继续落在活跃文件(不重复轮转)。
    const r2 = await runMarker(dir, 'new-2', { IHUI_MARKER_MAX_BYTES: '800' })
    assert.equal(r2.rc, 0)
    const both = parseJsonLines(readFileSync(active, 'utf8'))
    assert.deepEqual(
      both.map((x) => x.event),
      ['new-1', 'new-2'],
    )
    const all = readHookMarkers(root)
    assert.equal(all.malformed.length, 0, '轮转不得产生坏行')
    assert.equal(all.records.length, 12, `旧 10 + 新 2 = 12,实际 ${all.records.length}`)
  } finally {
    rmScratch(root)
  }
})

test('M2 并发 16 路写:锁串行,行数恰好 16 且每行都是完整 JSON', async () => {
  const { root, dir } = makeRoot()
  try {
    const N = 16
    const events = Array.from({ length: N }, (_, i) => `c-${i}`)
    const rs = await Promise.all(
      events.map((e) => runMarker(dir, e, { IHUI_MARKER_MAX_BYTES: '999999999' })),
    )
    const failed = rs.filter((r) => r.rc !== 0)
    assert.equal(failed.length, 0, `hook_marker 不得失败:${JSON.stringify(failed.map((r) => r.err))}`)

    const parsed = readHookMarkers(root)
    assert.equal(parsed.malformed.length, 0, `并发写不得写坏:${JSON.stringify(parsed.malformed.slice(0, 3))}`)
    const seen = new Set(parsed.records.map((r) => r.event))
    for (const e of events) assert.ok(seen.has(e), `丢失事件 ${e}`)
    assert.equal(parsed.records.length, N, `行数必须恰好 ${N},实际 ${parsed.records.length}(重复或丢行都算坏)`)
    const sources = new Set(parsed.records.map((r) => r._source))
    assert.deepEqual([...sources], ['active'], '锁可用时不应产生分片(分片是超时兜底)')
  } finally {
    rmScratch(root)
  }
})

test('M3 读侧跨轮转顺序拼接,坏行显式入 malformed', () => {
  const { root, dir } = makeRoot()
  try {
    mkdirSync(join(dir, 'hook-markers.d'), { recursive: true })
    const line = (event) =>
      `{"hook":"pre-commit","stage":"sh","event":"${event}","ts":"2026-11-04T00:00:00Z","expected":"e","got":"g"}`
    writeFileSync(join(dir, 'hook-markers.jsonl.2'), `${line('gen-2')}\n`)
    writeFileSync(join(dir, 'hook-markers.jsonl.1'), `${line('gen-1')}\n`)
    writeFileSync(join(dir, 'hook-markers.jsonl'), `${line('active-1')}\nBROKEN\n`)
    writeFileSync(join(dir, 'hook-markers.d', '20261104T000000Z-1-0.jsonl'), `${line('shard-1')}\n`)

    const fam = listHookMarkerFiles(root)
    assert.deepEqual(
      fam.files.map((f) => [f.path.slice(dir.length + 1).replace(/\\/g, '/'), f.source]),
      [
        ['hook-markers.jsonl.2', 'rotated'],
        ['hook-markers.jsonl.1', 'rotated'],
        ['hook-markers.jsonl', 'active'],
        ['hook-markers.d/20261104T000000Z-1-0.jsonl', 'shard'],
      ],
    )

    const parsed = readHookMarkers(root)
    assert.deepEqual(
      parsed.records.map((r) => r.event),
      ['gen-2', 'gen-1', 'active-1', 'shard-1'],
      '顺序必须旧 → 新,且分片在活跃文件之后',
    )
    assert.equal(parsed.malformed.length, 1, '坏行必须显式保留在 malformed')
    assert.equal(parsed.malformed[0].raw, 'BROKEN')
    assert.equal(parsed.ok, false, '有坏行 ⇒ ok=false,不得冒充全绿')
  } finally {
    rmScratch(root)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
