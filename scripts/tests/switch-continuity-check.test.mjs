// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * switch-continuity-check 镜像测试(§22c:判据 import 源 __test__,不复制)。
 * 只碰 scratch 造的合成库;真机会话面由 CLI 手跑(判机器状态,不进提交链 §12e)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as C } from '../lib/switch-continuity-check.mjs'

const require = createRequire(import.meta.url)
const { DatabaseSync } = require('node:sqlite')

/** 造一枚 minimax 形态的合成库(表名与生产一致,数据自造) */
function makeMinimaxDb(dir, sessions, messages = 0) {
  const file = path.join(dir, 'runtime-state.sqlite')
  const db = new DatabaseSync(file)
  db.exec('CREATE TABLE local_runtime_sessions (session_id TEXT PRIMARY KEY, record_json TEXT)')
  db.exec('CREATE TABLE local_runtime_message_rows (id INTEGER PRIMARY KEY, session_id TEXT)')
  const insS = db.prepare('INSERT INTO local_runtime_sessions(session_id, record_json) VALUES(?,?)')
  for (let i = 0; i < sessions; i++)
    insS.run(`s-${i}`, JSON.stringify({ sessionId: `s-${i}`, workspaceDir: '/w' + i }))
  if (messages) {
    const insM = db.prepare('INSERT INTO local_runtime_message_rows(session_id) VALUES(?)')
    for (let i = 0; i < messages; i++) insM.run(`s-${i % sessions}`)
  }
  db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
  db.close()
  return file
}

test('snapshotApp(dbPath):会话场数/行数/清单钉与手算一致', () => {
  const scratch = mkScratch('cont-snap')
  try {
    const file = makeMinimaxDb(scratch, 4, 11)
    const s = C.snapshotApp('minimax', { dbPath: file })
    assert.equal(s.state, 'ok')
    assert.equal(s.sessions.count, 4)
    assert.equal(s.messageRows.count, 11)
    assert.match(s.sessions.digest, /^[0-9a-f]{16}$/)
    assert.equal(s.sessionIds.length, 4)
    assert.ok(!JSON.stringify(s).includes('workspaceDir'), '清单不得带业务正文')
  } finally {
    cleanScratch(scratch)
  }
})

/**
 * 带重试的清 scratch:Windows 上 SQLite 句柄释放有延迟(EPERM 实测),
 * 清不掉 ⇒ 点名(不静默残留;残留面由 scratch  janitor 兜,但测试必须报告)。
 */
function cleanScratch(dir) {
  for (let i = 0; i < 3; i++) {
    try {
      rmScratch(dir)
      return
    } catch (e) {
      const wait = 150 * (i + 1)
      const t = Date.now()
      while (Date.now() - t < wait) {
        /* 退避 */
      }
      if (i === 2) console.warn(`⚠️ scratch 未清:${dir} —— ${String(e.message).slice(0, 80)}`)
    }
  }
}

test('compareSnapshots:同号在位=ok,少一场=broken 并点名丢失 fp', () => {
  const s1 = mkScratch('cont-cmp-a')
  const s2 = mkScratch('cont-cmp-b')
  try {
    const fourSrc = makeMinimaxDb(s1, 4, 11)
    const threeDir = s2
    const threeSrc = makeMinimaxDb(threeDir, 3, 9)
    const a = path.join(s1, 'a.sqlite')
    const b = path.join(s2, 'b.sqlite')
    fs.copyFileSync(fourSrc, a)
    fs.copyFileSync(threeSrc, b)
    const sa = C.snapshotApp('minimax', { dbPath: a })
    const sb = C.snapshotApp('minimax', { dbPath: b })
    assert.equal(sa.sessions.count, 4)
    assert.equal(sb.sessions.count, 3)
    const self = C.compareSnapshots(sa, sa)
    assert.equal(self.verdict, 'continuity-ok')
    const cross = C.compareSnapshots(sa, sb)
    assert.equal(cross.verdict, 'continuity-broken')
    assert.equal(cross.lostFp.length, 1)
    assert.equal(cross.beforeSessions, 4)
    assert.equal(cross.afterSessions, 3)
  } finally {
    cleanScratch(s1)
    cleanScratch(s2)
  }
})

test('任一腿未判定 ⇒ compare 报 undetermined(不冒 ok 也不冒 broken)', () => {
  const v = C.compareSnapshots({ state: 'undetermined', why: '没装' }, { state: 'ok', sessionIds: [] })
  assert.equal(v.verdict, 'undetermined')
  assert.match(v.why, /没装/)
})

test('locateDbAll:同家多份身份并存时全列出(取第一个存在者=冒充空身份)', () => {
  const scratch = mkScratch('cont-locate')
  try {
    const fake = path.join(scratch, 'runtime-state.sqlite')
    makeMinimaxDb(scratch, 2)
    const got = C.locateDbAll('minimax', { APPDATA: scratch, IHUI_TRAE_SCAN_USERS: '0' })
    assert.ok(Array.isArray(got))
    assert.ok(got.length >= 1, '至少列出本机那份')
    void fake
  } finally {
    cleanScratch(scratch)
  }
})

test('pickRichestDb:返回 {file,scored};胜出者按会话数排序,读不成的候选记 -1 不冒充', () => {
  const r = C.pickRichestDb('minimax', { APPDATA: 'Z:\\不存在' })
  assert.ok(Array.isArray(r.scored), 'scored 必须是数组(逐条报数)')
  for (const s of r.scored) assert.ok(typeof s.sessions === 'number', `sessions 不是数:${String(s.sessions)}`)
  const sorted = [...r.scored].sort((a, b) => b.sessions - a.sessions)
  assert.deepEqual(
    r.scored.map((x) => x.sessions),
    sorted.map((x) => x.sessions),
    'scored 必须按会话数降序(胜出者在前)',
  )
  if (r.file) {
    assert.ok(r.scored.some((s) => s.file === r.file && s.sessions > 0), 'file 必须是 scored 中会话数>0 的那份')
  } else {
    assert.ok(r.scored.every((s) => s.sessions <= 0), 'file:null ⇔ 没有任何候选有会话(未判定,不是"没装")')
  }
})

test('snapshotApp 未判定腿点名原因,不抛异常', () => {
  const s = C.snapshotApp('minimax', { dbPath: undefined, env: { IHUI_TRAE_SCAN_USERS: '0', APPDATA: 'Z:\\不存在的目录' } })
  assert.ok(s.state === 'undetermined' || s.state === 'ok', `got ${s.state}`)
  if (s.state === 'undetermined') assert.ok(s.why.length > 0)
})

test('2026-10-30 扩容三键在册:codex/zcode/opencode 可寻址(fileSet 形态各异)', () => {
  for (const k of ['codex', 'zcode', 'opencode']) {
    assert.ok(C.APPS[k], `${k} 必须在 APPS 注册表`)
    assert.ok(C.APPS[k].label)
  }
  assert.ok(C.APPS.opencode.fileSet, 'opencode 必须是 fileSet 形态(主库 0 行,清单钉取 history-snip 文件族)')
  assert.equal(C.APPS.codex.sessions.distinct, true, 'codex 会话必须 DISTINCT thread_id')
})

test('DISTINCT 摘要:同 thread 多行只计一场(codex 形态合成库)', () => {
  const scratch = mkScratch('cont-distinct')
  try {
    const file = path.join(scratch, 'thread_history_1.sqlite')
    const db = new DatabaseSync(file)
    db.exec('CREATE TABLE thread_items (item_id TEXT PRIMARY KEY, thread_id TEXT, item_type TEXT)')
    const ins = db.prepare('INSERT INTO thread_items(item_id, thread_id, item_type) VALUES(?,?,?)')
    // 6 条 item 分属 2 个 thread ⇒ DISTINCT thread_id = 2
    for (let i = 0; i < 6; i++) ins.run(`i-${i}`, `t-${i % 2}`, 'message')
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
    db.close()
    const s = C.snapshotApp('codex', { dbPath: file })
    assert.equal(s.state, 'ok')
    assert.equal(s.sessions.count, 2, 'DISTINCT 后会话数 = thread 数,不是 item 数')
    assert.equal(s.messageRows.count, 6)
  } finally {
    cleanScratch(scratch)
  }
})

test('fileSet 快照:文件名集合即清单钉,增删文件翻钉(opencode 形态合成目录)', () => {
  const scratch = mkScratch('cont-fileset')
  try {
    const dir = path.join(scratch, 'history-snip')
    fs.mkdirSync(dir, { recursive: true })
    for (const n of ['ses_a.json', 'ses_b.json', 'ses_c.json']) fs.writeFileSync(path.join(dir, n), '{}')
    const s1 = C.snapshotApp('opencode', { dbPath: dir })
    assert.equal(s1.state, 'ok')
    assert.equal(s1.sessions.count, 3)
    assert.equal(s1.messageRows, null, '文件族形态无消息行维度')
    fs.writeFileSync(path.join(dir, 'ses_d.json'), '{}')
    const s2 = C.snapshotApp('opencode', { dbPath: dir })
    assert.notEqual(s1.sessions.digest, s2.sessions.digest, '多一份会话文件 ⇒ 钉必须翻')
    const cmp = C.compareSnapshots(s1, s2)
    assert.equal(cmp.verdict, 'continuity-ok', '只增不删 ⇒ continuity-ok 且多出的一枚进 gainedFp')
    assert.equal(cmp.gainedFp.length, 1)
    fs.rmSync(path.join(dir, 'ses_a.json'))
    const cmp2 = C.compareSnapshots(s1, C.snapshotApp('opencode', { dbPath: dir }))
    assert.equal(cmp2.verdict, 'continuity-broken', '少一份会话文件 ⇒ broken 并点名')
    assert.equal(cmp2.lostFp.length, 1)
  } finally {
    cleanScratch(scratch)
  }
})

test('不认识的应用 ⇒ CheckError bad-app(绝不静默返回空清单)', () => {
  assert.throws(() => C.locateDbAll('nosuchapp'), /bad-app|不认识/)
  assert.throws(() => C.snapshotApp('nosuchapp'), /bad-app|不认识/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
