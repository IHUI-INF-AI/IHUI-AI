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
import { buildBatch, appendRecords } from '../lib/leveldb-log.mjs'

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

// ── 2026-10-31 扩容:workbuddy(两层文件族)/ codearts(递归+段过滤)/ loomy(IndexedDB 活主键)──

test('workbuddy 两层 JSONL:3 会话=count 3;删 1 个 ⇒ broken 并点名 lostFp', () => {
  const scratch = mkScratch('cont-workbuddy')
  try {
    const root = path.join(scratch, 'projects')
    for (const [proj, sessions] of [
      ['p1', ['s1', 's2']],
      ['p2', ['s3']],
    ]) {
      const d = path.join(root, proj)
      fs.mkdirSync(d, { recursive: true })
      for (const s of sessions) fs.writeFileSync(path.join(d, `${s}.jsonl`), '{"type":"message"}\n')
    }
    assert.equal(C.APPS.workbuddy.fileSet.depth, 2, 'workbuddy 必须钉两层(更深是子代理流水)')
    const before = C.snapshotApp('workbuddy', { dbPath: root })
    assert.equal(before.state, 'ok')
    assert.equal(before.sessions.count, 3)
    assert.equal(before.sessionIds.length, 3)
    assert.equal(before.messageRows, null, '文件族形态无消息行维度')

    // 同一颗会话旁边会出现子代理流水与回滚旁注 —— 都不是独立会话,不得计入
    fs.mkdirSync(path.join(root, 'p1', 's1', 'subagents'), { recursive: true })
    fs.writeFileSync(path.join(root, 'p1', 's1', 'subagents', 'agent-1.jsonl'), '{}')
    fs.writeFileSync(path.join(root, 'p1', 's1.file-rollback.ndjson'), '{}')
    const same = C.snapshotApp('workbuddy', { dbPath: root })
    assert.equal(same.sessions.count, 3, '子代理流水 / ndjson 旁注不得计入会话')
    assert.equal(same.sessions.digest, before.sessions.digest, '旁注出现不得翻清单钉')

    fs.rmSync(path.join(root, 'p2', 's3.jsonl'))
    const after = C.snapshotApp('workbuddy', { dbPath: root })
    assert.equal(after.sessions.count, 2)
    const cmp = C.compareSnapshots(before, after)
    assert.equal(cmp.verdict, 'continuity-broken')
    assert.equal(cmp.lostFp.length, 1)
    assert.deepEqual(
      cmp.lostFp,
      [C.fp('p2/s3')],
      '丢失必须点名到具体会话(id 带项目层,防跨项目同名撞键)',
    )
  } finally {
    cleanScratch(scratch)
  }
})

test('codearts 递归 + 只认 chatSessions 段:other/ 与非会话 jsonl 不计入', () => {
  const scratch = mkScratch('cont-codearts')
  try {
    const root = path.join(scratch, 'workspaceStorage')
    const put = (rel, body = '{}\n') => {
      const f = path.join(root, rel)
      fs.mkdirSync(path.dirname(f), { recursive: true })
      fs.writeFileSync(f, body)
    }
    put('a/chatSessions/x.jsonl')
    put('a/other/y.jsonl')
    put('b/chatSessions/z.jsonl')
    put('b/chatSessions2/w.jsonl') // 子串相同但段名不同 ⇒ 不算(防 includes 误伤)
    put('state.jsonl') // 根直属非会话文件
    const s = C.snapshotApp('codearts', { dbPath: root })
    assert.equal(s.state, 'ok')
    assert.equal(s.sessions.count, 2, '只有 chatSessions 段下的两份算会话')
    assert.deepEqual(
      s.sessionIds.slice().sort(),
      [C.fp('a/chatSessions/x'), C.fp('b/chatSessions/z')].sort(),
    )
    assert.equal(C.APPS.codearts.fileSet.deep, true, '层级随产品变 ⇒ 递归')
    assert.equal(C.APPS.codearts.fileSet.segment, 'chatSessions')
  } finally {
    cleanScratch(scratch)
  }
})

test('递归不泄漏到单层形态:opencode 子目录里的 json 不计入', () => {
  const scratch = mkScratch('cont-nondeep')
  try {
    const dir = path.join(scratch, 'history-snip')
    fs.mkdirSync(path.join(dir, 'sub'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'a.json'), '{}')
    fs.writeFileSync(path.join(dir, 'b.json'), '{}')
    fs.writeFileSync(path.join(dir, 'sub', 'c.json'), '{}')
    assert.equal(
      C.listFileSet(dir, C.APPS.opencode.fileSet).join(','),
      'a,b',
      'depth 缺省=1,不下探',
    )
    assert.equal(C.snapshotApp('opencode', { dbPath: dir }).sessions.count, 2)
  } finally {
    cleanScratch(scratch)
  }
})

/** 造一枚 Loomy 形态的 IndexedDB leveldb 目录:键按 Chromium IDB 记录键布局编码 */
function idbKey(str, store = 0x01) {
  const body = Buffer.from(str, 'utf16le')
  body.swap16()
  return Buffer.concat([Buffer.from([0x00, 0x01, 0x02, store, 0x01, str.length]), body])
}

function makeIdbDir(dir, { puts = [], deletes = [] } = {}) {
  fs.mkdirSync(dir, { recursive: true })
  const keyOf = (x) => (typeof x === 'string' ? idbKey(x) : idbKey(x.k, x.store))
  let buf = Buffer.alloc(0)
  let seq = 1
  if (puts.length) {
    const entries = puts.map((x) => ({ key: keyOf(x), value: Buffer.from('m'.repeat(40)) }))
    buf = appendRecords(buf, [buildBatch(seq, entries)])
    seq += puts.length
  }
  if (deletes.length) {
    buf = appendRecords(buf, [
      buildBatch(
        seq,
        deletes.map((x) => ({ key: keyOf(x), type: 0, value: null })),
      ),
    ])
  }
  fs.writeFileSync(path.join(dir, '000003.log'), buf)
  return dir
}

test('loomy IndexedDB 活主键:只数 ses_ 前缀且 tombstone 不算,删一枚 ⇒ broken', () => {
  const scratch = mkScratch('cont-loomy')
  try {
    const dir = makeIdbDir(path.join(scratch, 'idb'), {
      // theme-mode 是库元数据键:能解成字符串但没 ses_ 前缀,越界时正是这枚先炸
      // {k:'ses_a', store:2} 复刻真机:同一枚会话主键另有一个 store 的短记录,数场次必须去重
      puts: ['ses_a', 'ses_b', 'theme-mode', { k: 'ses_a', store: 0x02 }],
      deletes: ['ses_gone'],
    })
    assert.equal(C.decodeIdbStringKey(idbKey('ses_a')), 'ses_a')
    assert.equal(
      C.decodeIdbStringKey(Buffer.from([0, 1, 1, 1, 1, 3])),
      null,
      '库元数据键不是记录键',
    )
    const before = C.snapshotApp('loomy', { dbPath: dir })
    assert.equal(before.state, 'ok')
    assert.equal(
      before.sessions.count,
      2,
      '两枚活会话(同键跨 store 去重);元数据键与 tombstone 都不计入',
    )
    assert.deepEqual(before.sessionIds.slice().sort(), [C.fp('ses_a'), C.fp('ses_b')].sort())
    assert.ok(!JSON.stringify(before).includes('ses_gone'), '已删会话不得出现在清单')

    const dir2 = path.join(scratch, 'idb2')
    fs.cpSync(dir, dir2, { recursive: true })
    fs.writeFileSync(
      path.join(dir2, '000004.log'),
      appendRecords(Buffer.alloc(0), [
        buildBatch(9, [{ key: idbKey('ses_b'), type: 0, value: null }]),
      ]),
    )
    const after = C.snapshotApp('loomy', { dbPath: dir2 })
    assert.equal(after.sessions.count, 1)
    const cmp = C.compareSnapshots(before, after)
    assert.equal(cmp.verdict, 'continuity-broken')
    assert.deepEqual(cmp.lostFp, [C.fp('ses_b')])
  } finally {
    cleanScratch(scratch)
  }
})

test('loomy 目录在但 0 枚活会话 ⇒ undetermined(不冒绿)', () => {
  const scratch = mkScratch('cont-loomy-empty')
  try {
    const dir = makeIdbDir(path.join(scratch, 'idb'), { puts: ['theme-mode'] })
    const s = C.snapshotApp('loomy', { dbPath: dir })
    assert.equal(s.state, 'undetermined')
    assert.match(String(s.why), /0 份会话/)
    assert.equal(C.compareSnapshots(s, s).verdict, 'undetermined')
  } finally {
    cleanScratch(scratch)
  }
})

test('2026-10-31 扩容三键在册:workbuddy/codearts/loomy 形态各自可寻址', () => {
  for (const k of ['workbuddy', 'codearts', 'loomy']) {
    assert.ok(C.APPS[k], `${k} 必须在 APPS 注册表`)
    assert.ok(C.APPS[k].label)
  }
  assert.ok(C.APPS.workbuddy.fileSet, 'workbuddy = JSONL 文件族(sessions 表 90 行全软删)')
  assert.ok(C.APPS.codearts.fileSet, 'codearts = chatSessions/*.jsonl 文件族')
  assert.ok(C.APPS.loomy.keyCount, 'loomy = IndexedDB 活主键(keyCount;文件数恒定,钉文件只能粗检)')
  assert.equal(C.APPS.doubao, undefined, '豆包是云端回包缓存,刻意不接')
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
