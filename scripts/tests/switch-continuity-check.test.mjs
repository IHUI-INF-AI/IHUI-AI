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

test('loomy IndexedDB:活主键 ∪ 日志历史 id —— 真机全量 tombstone 也数得出会话', () => {
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
    assert.equal(before.sessions.liveCount, 2, '活主键 = ses_a/ses_b(同键跨 store 去重)')
    assert.equal(
      before.sessions.count,
      3,
      '清单钉 = 活主键 ∪ 日志历史 id(ses_gone 已被 tombstone 但日志里写过)',
    )
    assert.ok(before.sessionIds.includes(C.fp('ses_gone')), '历史 id 必须进清单(真机形态)')
    assert.ok(!before.sessionIds.includes(C.fp('theme-mode')), '非 ses_ 前缀不计')

    // 同法再拍:删掉一枚活记录 ⇒ 钉不翻(历史口径的结构性局限,见实现注)
    const dir2 = path.join(scratch, 'idb2')
    fs.cpSync(dir, dir2, { recursive: true })
    fs.writeFileSync(
      path.join(dir2, '000004.log'),
      appendRecords(Buffer.alloc(0), [
        buildBatch(9, [{ key: idbKey('ses_b'), type: 0, value: null }]),
      ]),
    )
    const after = C.snapshotApp('loomy', { dbPath: dir2 })
    assert.equal(after.sessions.liveCount, 1, '活主键少了 ses_b')
    assert.equal(after.sessions.count, 3, '历史口径不随单条删除翻钉(局限,已如实标注)')
    assert.equal(C.compareSnapshots(before, after).verdict, 'continuity-ok')
  } finally {
    cleanScratch(scratch)
  }
})

test('loomy 真机键布局:db/store 是 varint(旧实现钉死 buf[2]=0x02 ⇒ 恒数 0)', () => {
  const scratch = mkScratch('cont-loomy-layout')
  try {
    const dir = path.join(scratch, 'idb')
    fs.mkdirSync(dir, { recursive: true })
    // 真机键:00 01 <db> <store> 01 <varint 字符数> UTF-16BE
    const realKey = (str, db, store) => {
      const body = Buffer.from(str, 'utf16le')
      body.swap16()
      return Buffer.concat([Buffer.from([0x00, 0x01, db, store, 0x01, str.length]), body])
    }
    assert.equal(C.decodeIdbStringKey(realKey('ses_e4ac4497effeIguY', 2, 1)), 'ses_e4ac4497effeIguY')
    assert.equal(C.decodeIdbStringKey(realKey('theme-mode', 1, 1)), 'theme-mode')
    // 对象存储元数据键(00 01 00 00 32 01 00)不是记录键 ⇒ 不猜
    assert.equal(C.decodeIdbStringKey(Buffer.from('00010000320100', 'hex')), null)
    fs.writeFileSync(
      path.join(dir, '000003.log'),
      appendRecords(Buffer.alloc(0), [
        buildBatch(1, [
          { key: realKey('ses_a', 2, 1), value: Buffer.from('"sessionId"ses_a') },
          { key: realKey('ses_b', 2, 2), value: Buffer.from('x') },
        ]),
      ]),
    )
    const s = C.snapshotApp('loomy', { dbPath: dir })
    assert.equal(s.state, 'ok')
    assert.equal(s.sessions.count, 2)
    assert.equal(s.sessions.liveCount, 2)
  } finally {
    cleanScratch(scratch)
  }
})

test('loomy 值里的会话 id(loomy-current-task 指针 / 索引值)也算历史,ascii 明文扫得出', () => {
  const scratch = mkScratch('cont-loomy-val')
  try {
    const dir = path.join(scratch, 'idb')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(
      path.join(dir, '000003.log'),
      appendRecords(Buffer.alloc(0), [
        buildBatch(1, [
          {
            key: idbKey('loomy-current-task'),
            // 真机值 = V8 单字节串:`"` + 长度 + 原文
            value: Buffer.from('o"key".loomy-current-task".value".ses_pointerONLY1234', 'latin1'),
          },
        ]),
      ]),
    )
    const s = C.snapshotApp('loomy', { dbPath: dir })
    assert.equal(s.state, 'ok', '只有指针、没有会话记录时也必须数得出(否则又是空转)')
    assert.equal(s.sessions.liveCount, 0)
    assert.equal(s.sessions.count, 1)
    assert.deepEqual(s.sessionIds, [C.fp('ses_pointerONLY1234')])
  } finally {
    cleanScratch(scratch)
  }
})

test('loomy 目录在但 0 枚会话 ⇒ undetermined(不冒绿)', () => {
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

// ── 2026-11-10 四端空转整改:codearts 双面 / zcode 双库 / opencode XDG 新表 / 路径令牌 ──

test('路径令牌:全表不再硬编码 C:/Users/Administrator,{xdgData} 优先 XDG_DATA_HOME', () => {
  const flat = JSON.stringify(C.APPS)
  assert.ok(!flat.includes('C:/Users/Administrator'), '注册表里不得再出现硬编码用户目录')
  assert.deepEqual(C.APPS.opencode.dbCandidates, ['{xdgData}/opencode/opencode.db'])
  assert.equal(
    C.resolveDataPath('{xdgData}/opencode/opencode.db', {
      USERPROFILE: 'D:/u',
      XDG_DATA_HOME: 'D:/xdg/data',
    }),
    'D:/xdg/data/opencode/opencode.db',
    'XDG_DATA_HOME 在 ⇒ 用它',
  )
  assert.equal(
    C.resolveDataPath('{xdgData}/opencode/opencode.db', { USERPROFILE: 'D:/u' }),
    'D:/u/.local/share/opencode/opencode.db',
    '没有 XDG_DATA_HOME ⇒ 退 ~/.local/share',
  )
  assert.equal(
    C.resolveDataPath('{appData}/Loomy/x', { USERPROFILE: 'D:/u', APPDATA: 'E:/r' }),
    'E:/r/Loomy/x',
    'APPDATA 重定向必须跟着走',
  )
})

/** codearts 形态:真库 session/message + chatSessions 文件族 */
function makeCodeartsEnv(scratch, { dbSessions = 0, jsonl = 0 } = {}) {
  const dbFile = path.join(scratch, '.codeartsdoer', 'codearts-data', 'opencode.db')
  fs.mkdirSync(path.dirname(dbFile), { recursive: true })
  const db = new DatabaseSync(dbFile)
  db.exec('CREATE TABLE session (id TEXT PRIMARY KEY, time_archived INTEGER, title TEXT)')
  db.exec('CREATE TABLE message (id TEXT PRIMARY KEY, session_id TEXT)')
  const ins = db.prepare('INSERT INTO session(id, time_archived, title) VALUES(?,?,?)')
  for (let i = 0; i < dbSessions; i++) ins.run(`sess_db_${i}`, null, 't')
  db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
  db.close()
  const root = path.join(scratch, 'AppData', 'Roaming', 'codearts-agent', 'User', 'workspaceStorage')
  if (jsonl) {
    const d = path.join(root, 'hash1', 'chatSessions')
    fs.mkdirSync(d, { recursive: true })
    for (let i = 0; i < jsonl; i++) fs.writeFileSync(path.join(d, `chat-${i}.jsonl`), '{}\n')
  } else {
    fs.mkdirSync(root, { recursive: true })
  }
  return {
    env: {
      USERPROFILE: scratch,
      APPDATA: path.join(scratch, 'AppData', 'Roaming'),
      IHUI_TRAE_SCAN_USERS: '0',
    },
    dbFile,
  }
}

test('codearts:库优先(库有数据用库),库空回落 chatSessions 文件族,两数并报', () => {
  const s1 = mkScratch('cont-ca-db')
  const s2 = mkScratch('cont-ca-file')
  const s3 = mkScratch('cont-ca-none')
  try {
    // ① 库有 3 场 + 文件族 4 份 ⇒ 用库,fallback 报文件族
    const a = makeCodeartsEnv(s1, { dbSessions: 3, jsonl: 4 })
    const withDb = C.snapshotApp('codearts', { env: a.env })
    assert.equal(withDb.state, 'ok')
    assert.equal(withDb.sessions.count, 3, '库有数据 ⇒ 用库')
    assert.equal(withDb.dbFile, a.dbFile)
    assert.ok(withDb.fallback, '另一形态必须并报')
    assert.equal(withDb.fallback.kind, 'fileSet')
    assert.equal(withDb.fallback.count, 4)

    // ② 库 0 行 + 文件族 5 份 ⇒ 回落文件族
    const b = makeCodeartsEnv(s2, { dbSessions: 0, jsonl: 5 })
    const fallback = C.snapshotApp('codearts', { env: b.env })
    assert.equal(fallback.state, 'ok', '库空不是"未判定",真会话面在文件族')
    assert.equal(fallback.sessions.count, 5)
    assert.match(String(fallback.dbFile), /workspaceStorage/)
    assert.equal(fallback.fallback.kind, 'sqlite')
    assert.equal(fallback.fallback.count, 0, '库那一侧的 0 也要报出来')

    // ③ 两边都 0 ⇒ undetermined,且 why 里两边的数都点名
    const c = makeCodeartsEnv(s3, { dbSessions: 0, jsonl: 0 })
    const none = C.snapshotApp('codearts', { env: c.env })
    assert.equal(none.state, 'undetermined')
    assert.match(String(none.why), /库 .*opencode\.db=0 份/)
    assert.match(String(none.why), /文件族 .*workspaceStorage=0 份/)
    assert.equal(none.faces.length, 2)
  } finally {
    cleanScratch(s1)
    cleanScratch(s2)
    cleanScratch(s3)
  }
})

test('zcode:cli/db.sqlite 空但 v2/tasks-index.sqlite 有数据 ⇒ 取有数据的那库,两库都数', () => {
  const scratch = mkScratch('cont-zcode')
  try {
    const cli = path.join(scratch, '.zcode', 'cli', 'db', 'db.sqlite')
    fs.mkdirSync(path.dirname(cli), { recursive: true })
    const d1 = new DatabaseSync(cli)
    d1.exec('CREATE TABLE session (id TEXT PRIMARY KEY)')
    d1.exec('CREATE TABLE message (id TEXT PRIMARY KEY, session_id TEXT)')
    d1.close()

    const idx = path.join(scratch, '.zcode', 'v2', 'tasks-index.sqlite')
    fs.mkdirSync(path.dirname(idx), { recursive: true })
    const d2 = new DatabaseSync(idx)
    // 列名按真库 35 列实测:deleted INTEGER(0=未删);不存在 time_deleted 列
    d2.exec('CREATE TABLE tasks (task_id TEXT PRIMARY KEY, title TEXT, deleted INTEGER DEFAULT 0)')
    const ins = d2.prepare('INSERT INTO tasks(task_id, title, deleted) VALUES(?,?,?)')
    ins.run('sess_a', 'a', 0)
    ins.run('sess_b', 'b', 0)
    ins.run('sess_gone', 'gone', 1) // 软删 ⇒ 不计
    d2.close()

    const s = C.snapshotApp('zcode', {
      env: { USERPROFILE: scratch, IHUI_TRAE_SCAN_USERS: '0' },
    })
    assert.equal(s.state, 'ok')
    assert.equal(s.sessions.count, 2, 'tasks 未删 2 条(软删 1 条不计)')
    assert.match(String(s.dbFile), /tasks-index\.sqlite/)
    assert.equal(s.faces.length, 2, '两个库各自数都要报')
    assert.ok(s.faces.some((f) => /db\.sqlite$/.test(f.path) && f.count === 0))
  } finally {
    cleanScratch(scratch)
  }
})

test('opencode 2.2.6:会话表是 session_v2/session_message,数据根跟 XDG_DATA_HOME', () => {
  const scratch = mkScratch('cont-opencode')
  try {
    assert.equal(C.APPS.opencode.sessions.table, 'session_v2', '旧 session 表在 2.2.6 已不存在')
    assert.equal(C.APPS.opencode.messages.table, 'session_message')
    const xdg = path.join(scratch, 'xdg')
    const dbFile = path.join(xdg, 'opencode', 'opencode.db')
    fs.mkdirSync(path.dirname(dbFile), { recursive: true })
    const db = new DatabaseSync(dbFile)
    db.exec('CREATE TABLE session_v2 (id TEXT PRIMARY KEY, project_id TEXT, time_archived INTEGER)')
    db.exec('CREATE TABLE session_message (id TEXT PRIMARY KEY, session_id TEXT)')
    db.exec("INSERT INTO session_v2(id, project_id, time_archived) VALUES('ses_1','p1',NULL)")
    db.exec("INSERT INTO session_v2(id, project_id, time_archived) VALUES('ses_2','p1',1)")
    db.exec("INSERT INTO session_message(id, session_id) VALUES('m1','ses_1')")
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
    db.close()

    const s = C.snapshotApp('opencode', {
      env: { USERPROFILE: scratch, XDG_DATA_HOME: xdg, IHUI_TRAE_SCAN_USERS: '0' },
    })
    assert.equal(s.state, 'ok')
    assert.equal(s.sessions.count, 1, 'archived 的那场不计')
    assert.equal(s.messageRows.count, 1)
    assert.equal(s.dbFile, dbFile)
  } finally {
    cleanScratch(scratch)
  }
})

// ── 2026-11-10 尾刀:codearts / opencode 库表 0 行时的字节残留兜底(rawScanFallback) ──

/** 临时目录(mkdtemp;沿用仓库 scratch 落点,不依赖本机真库,CI 上也不会挂) */
function tmpDir(tag) {
  return mkScratch(`cont-${tag}-`)
}

/** 与生产同形状的会话 id:ses_ + 26 字符(12 位时间戳 + 14 位 base62) */
const rawId = (n) => `ses_${String(n).padStart(12, '0')}abcdefghijklmn`

/**
 * 造"曾被写满、现在 0 行"的合成库:插 N 枚会话(id + 关联消息)⇒ 全删 ⇒ checkpoint。
 * SQLite 默认 secure_delete=0,空闲页里的字节不会被抹(与真库 freelist 残留同因),
 * 这就是 raw-scan 能数出历史 id 的物理依据。
 */
function makeResidualDb(file, ids, { table = 'session_v2', messages = 'session_message' } = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const db = new DatabaseSync(file)
  db.exec(`CREATE TABLE "${table}" (id TEXT PRIMARY KEY, project_id TEXT, time_archived INTEGER)`)
  db.exec(`CREATE TABLE "${messages}" (id TEXT PRIMARY KEY, session_id TEXT)`)
  const insS = db.prepare(`INSERT INTO "${table}"(id, project_id, time_archived) VALUES(?,?,?)`)
  const insM = db.prepare(`INSERT INTO "${messages}"(id, session_id) VALUES(?,?)`)
  for (const id of ids) {
    insS.run(id, 'p1', null)
    insM.run(`msg_${id.slice(4, 16)}`, id)
  }
  db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
  db.exec(`DELETE FROM "${table}"`)
  db.exec(`DELETE FROM "${messages}"`)
  db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
  const left = db.prepare(`SELECT COUNT(*) c FROM "${table}"`).get().c
  const leftM = db.prepare(`SELECT COUNT(*) c FROM "${messages}"`).get().c
  db.close()
  assert.equal(left, 0, '夹具前提:会话表必须真的 0 行')
  assert.equal(leftM, 0, '夹具前提:消息表也必须 0 行')
  return file
}

test('extractSessionIds:粘着 next 列的游程按 id 定长截断,短残片丢弃(不猜)', () => {
  const raw = C.APPS.opencode.rawScan
  assert.equal(raw.idLength, 26, 'opencode 的 id = ses_ + 26(本机游程分布里 26 是绝对多数)')
  assert.deepEqual(C.APPS.codearts.rawScan, raw, 'codearts 是同一 id 形状(实测两库一致)')
  const buf = Buffer.from(
    [
      'ses_000000000001abcdefghijklmnassistant', // id + 粘着的 next 列(SQLite 记录体里相邻 text 无分隔)
      'ses_000000000001abcdefghijklmn', // 同一枚的光秃写法
      'ses_000000000002abcdefghijklmnuser',
      'ses_0000000', // 页边界截断残片 ⇒ 丢弃
    ].join('\u0001'),
    'latin1',
  )
  const ids = C.extractSessionIds(buf, raw)
  assert.deepEqual(ids, ['ses_000000000001abcdefghijklmn', 'ses_000000000002abcdefghijklmn'])
})

test('codearts/opencode 库 0 行 ⇒ 走 raw-scan:count=历史 id 数,liveCount=0,mode=raw-scan', () => {
  const dir = tmpDir('cont-raw')
  try {
    const dbFile = path.join(dir, 'opencode.db')
    const ids = [rawId(0), rawId(1), rawId(2), rawId(3)]
    makeResidualDb(dbFile, ids)

    const s = C.snapshotApp('opencode', { dbPath: dbFile })
    assert.equal(s.state, 'ok', '0 行不再等于"未判定"(否则这两个平台永远无对账)')
    assert.equal(s.mode, 'raw-scan')
    assert.equal(s.sessions.count, 4, '历史 id 数')
    assert.equal(s.sessions.liveCount, 0, '活行数必须显式报 0,不能被 count 掩盖')
    assert.match(s.note, /历史会话 id/, 'note 必须写明是历史残留,不是活会话')
    assert.match(s.note, /freelist\/wal/)
    assert.equal(s.messageRows, null, '字节口径不编造消息行数')
    assert.deepEqual(s.sessionIds.slice().sort(), ids.map(C.fp).sort())

    // codearts 同法(表名 session/message)
    const caFile = path.join(dir, 'ca', 'opencode.db')
    makeResidualDb(caFile, [rawId(10), rawId(11)], { table: 'session', messages: 'message' })
    const ca = C.snapshotApp('codearts', { dbPath: caFile })
    assert.equal(ca.mode, 'raw-scan')
    assert.equal(ca.sessions.count, 2)
    assert.equal(ca.sessions.liveCount, 0)
  } finally {
    cleanScratch(dir)
  }
})

test('raw-scan 快照:切后历史 id 数变少 ⇒ continuity-broken 并点名(切号只搬不删)', () => {
  const dir = tmpDir('cont-raw-cmp')
  try {
    const beforeFile = path.join(dir, 'before.db')
    const afterFile = path.join(dir, 'after.db')
    makeResidualDb(beforeFile, [rawId(0), rawId(1), rawId(2), rawId(3)])
    makeResidualDb(afterFile, [rawId(0), rawId(1), rawId(2)]) // 切后被删掉一场
    const before = C.snapshotApp('opencode', { dbPath: beforeFile })
    const after = C.snapshotApp('opencode', { dbPath: afterFile })
    assert.equal(before.sessions.count, 4)
    assert.equal(after.sessions.count, 3)

    const same = C.compareSnapshots(before, before)
    assert.equal(same.verdict, 'continuity-ok')
    assert.match(same.note, /字节残留/, '同口径时必须标注这是历史残留口径')

    const cross = C.compareSnapshots(before, after)
    assert.equal(cross.verdict, 'continuity-broken', '历史 id 数变少 = 真删了会话')
    assert.deepEqual(cross.lostFp, [C.fp(rawId(3))])

    // 反向:多了会话(切号后继续用)⇒ 仍是 ok
    assert.equal(C.compareSnapshots(after, before).verdict, 'continuity-ok')
  } finally {
    cleanScratch(dir)
  }
})

test('字节扫描两趟不一致 ⇒ undetermined(不许拿不稳定的数冒绿)', () => {
  const dir = tmpDir('cont-raw-unstable')
  try {
    const dbFile = path.join(dir, 'opencode.db')
    makeResidualDb(dbFile, []) // 库本身 0 行、无残留,抖动全靠注入的读取器
    const a = Buffer.from(rawId(0), 'latin1')
    const b = Buffer.from(`${rawId(0)}\u0001${rawId(1)}`, 'latin1')
    let calls = 0
    // 每趟扫 [主库, -wal] 两个文件 ⇒ 前 2 次给 a、后 2 次给 b
    const rawScanReader = () => (calls++ < 2 ? a : b)
    const s = C.snapshotApp('opencode', { dbPath: dbFile, rawScanReader })
    assert.equal(s.state, 'undetermined', '两趟不一致必须降级')
    assert.equal(s.mode, 'raw-scan')
    assert.match(s.why, /不一致/)
    assert.match(s.why, /1 vs 2/)
    assert.equal(C.compareSnapshots(s, s).verdict, 'undetermined')

    // 两趟一致时同一注入器必须给出确定数(证明降级不是"永远未判定")
    const steady = C.snapshotApp('opencode', { dbPath: dbFile, rawScanReader: () => a })
    assert.equal(steady.state, 'ok')
    assert.equal(steady.sessions.count, 1)
  } finally {
    cleanScratch(dir)
  }
})

test('库 0 行且字节里也扫不到残留 ⇒ undetermined(不冒绿)', () => {
  const dir = tmpDir('cont-raw-none')
  try {
    const dbFile = path.join(dir, 'opencode.db')
    makeResidualDb(dbFile, [])
    const s = C.snapshotApp('opencode', { dbPath: dbFile })
    assert.equal(s.state, 'undetermined')
    assert.match(s.why, /扫不到/)
    assert.equal(C.compareSnapshots(s, s).verdict, 'undetermined')
  } finally {
    cleanScratch(dir)
  }
})

test('liveCount 在库有行时等于 SQL 计数(mode=sqlite,不误走字节口径)', () => {
  const dir = tmpDir('cont-live')
  try {
    const dbFile = path.join(dir, 'opencode.db')
    fs.mkdirSync(path.dirname(dbFile), { recursive: true })
    const db = new DatabaseSync(dbFile)
    db.exec('CREATE TABLE session_v2 (id TEXT PRIMARY KEY, project_id TEXT, time_archived INTEGER)')
    db.exec('CREATE TABLE session_message (id TEXT PRIMARY KEY, session_id TEXT)')
    db.exec(`INSERT INTO session_v2(id,project_id,time_archived) VALUES('${rawId(0)}','p1',NULL)`)
    db.exec(`INSERT INTO session_v2(id,project_id,time_archived) VALUES('${rawId(1)}','p1',NULL)`)
    db.exec(`INSERT INTO session_message(id,session_id) VALUES('m1','${rawId(0)}')`)
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
    db.close()

    const s = C.snapshotApp('opencode', { dbPath: dbFile })
    assert.equal(s.mode, 'sqlite', '有活行就不走字节口径')
    assert.equal(s.sessions.count, 2)
    assert.equal(s.sessions.liveCount, 2, '库有行时 liveCount 必须等于 SQL 计数')
    assert.equal(s.messageRows.count, 1)
  } finally {
    cleanScratch(dir)
  }
})

test('走本机路径时也兜得住:活行全 0 ⇒ snapshotApp 自动落到 raw-scan(XDG 真落点)', () => {
  const dir = tmpDir('cont-raw-env')
  try {
    const xdg = path.join(dir, 'xdg')
    const dbFile = path.join(xdg, 'opencode', 'opencode.db')
    makeResidualDb(dbFile, [rawId(0), rawId(1)])
    const s = C.snapshotApp('opencode', {
      env: { USERPROFILE: dir, XDG_DATA_HOME: xdg, IHUI_TRAE_SCAN_USERS: '0' },
    })
    assert.equal(s.state, 'ok', 'pickRichestDb 全 0 时也必须救回一条可对账的面')
    assert.equal(s.mode, 'raw-scan')
    assert.equal(s.dbFile, dbFile)
    assert.equal(s.sessions.count, 2)
    assert.equal(s.sessions.liveCount, 0)
    assert.ok(Array.isArray(s.faces), '逐面数仍要报(活行那一列全是 0)')
  } finally {
    cleanScratch(dir)
  }
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
