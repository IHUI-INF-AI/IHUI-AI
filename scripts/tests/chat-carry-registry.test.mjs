// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 全平台「对话随行」注册面锁定测试(2026-11-22 立)。
 *
 * 钉的是能力边界,不是跑通一次:
 *   1) 号池里每个平台都在矩阵里,且档位合法(rebind/local/cloud);
 *   2) local 平台一旦本地库出现账号维度 ⇒ 必须报 account-scoped-store(不许冒绿);
 *   3) 探不到库 ⇒ unlocated(未判定),不冒充"历史还在";
 *   4) rebind 平台缺 uid ⇒ no-uid,绝不猜"从哪搬到哪";
 *   5) 没有账号列 ⇒ 现场只读核验通过,报真实会话条数。
 *
 * 全部用临时目录里的真 SQLite(与客户端同最小面),零真实用户目录。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { after, before, describe, it } from 'node:test'

import {
  CARRY_MATRIX,
  POOL_PROVIDERS,
  auditProviders,
  probeProvider,
  switchCarry,
} from '../lib/chat-carry/index.mjs'
import { probeVscdb } from '../lib/chat-carry/local-store.mjs'

let tmpRoot

before(() => {
  const base = path.resolve(import.meta.dirname, '..', '..', '.tmp', 'test-chat-carry')
  fs.mkdirSync(base, { recursive: true })
  tmpRoot = fs.mkdtempSync(path.join(base, 'run-'))
})
after(() => {
  try {
    fs.rmSync(tmpRoot, { recursive: true, force: true, maxRetries: 3 })
  } catch {
    /* Windows 句柄释放滞后:残留由 .tmp 生命周期回收 */
  }
})

/** 造一个带账号列的会话库(qoder 形态) */
function seedScoped(file, { withAccounts }) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const db = new DatabaseSync(file)
  db.exec(`
    CREATE TABLE chat_sessions (
      session_id TEXT PRIMARY KEY, user_id TEXT, title TEXT, deleted_at INTEGER, archived INTEGER
    );
  `)
  const ins = db.prepare('INSERT INTO chat_sessions (session_id,user_id,title,deleted_at,archived) VALUES (?,?,?,?,?)')
  ins.run('s1', withAccounts ? 'uid-a' : null, '对话一', null, 0)
  ins.run('s2', withAccounts ? 'uid-a' : null, '对话二', 100, 0)
  ins.run('s3', withAccounts ? 'uid-b' : null, '对话三', null, 0)
  db.close()
}

/** 造一个 VS Code 系 state.vscdb(ItemTable) */
function seedVscdb(file, keys) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const db = new DatabaseSync(file)
  db.exec(`CREATE TABLE ItemTable (key TEXT PRIMARY KEY, value BLOB);`)
  const ins = db.prepare('INSERT INTO ItemTable (key,value) VALUES (?,?)')
  for (const k of keys) ins.run(k, Buffer.from('1'))
  db.close()
}

describe('能力矩阵', () => {
  it('号池平台全覆盖,档位合法', () => {
    assert.ok(POOL_PROVIDERS.length >= 10)
    for (const p of POOL_PROVIDERS) {
      const m = CARRY_MATRIX[p]
      assert.ok(['rebind', 'local', 'cloud'].includes(m.kind), `${p} 档位非法`)
      assert.equal(typeof m.detail, 'string')
      assert.equal(typeof m.identity, 'string', `${p} 缺账号身份说明`)
      assert.ok(m.identity.length > 0, `${p} 账号身份说明为空`)
    }
    assert.equal(CARRY_MATRIX.workbuddy.kind, 'rebind')
    assert.equal(CARRY_MATRIX.doubao.kind, 'cloud')
    const cloud = probeProvider('doubao')
    assert.equal(cloud.located, false)
    assert.equal(cloud.sessions, null, '云端本地零副本不能报 0 条')
    assert.equal(cloud.visible, null, '云端本地零副本不能报 0 条')
  })
})

/** 造一个 ZCode tasks-index(桌面端正库形态):archived/deleted/cli_deleted 三列复合可见 */
function seedZcodeTasks(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const db = new DatabaseSync(file)
  db.exec(`
    CREATE TABLE tasks (
      task_id TEXT PRIMARY KEY, title TEXT, task_status TEXT,
      archived INTEGER, deleted INTEGER, cli_deleted INTEGER,
      provider TEXT, workspace_key TEXT, project_id TEXT, host_id TEXT
    );
  `)
  const ins = db.prepare(
    'INSERT INTO tasks (task_id,title,task_status,archived,deleted,cli_deleted,provider,workspace_key,project_id,host_id) VALUES (?,?,?,?,?,?,?,?,?,?)',
  )
  ins.run('sess_a', '可见任务', 'completed', 0, 0, null, 'glm', 'c:/repo', 'p1', 'local')
  ins.run('sess_b', '已归档任务', 'completed', 1, 0, 0, 'glm', 'c:/repo', 'p1', 'local')
  ins.run('sess_c', '已删除任务', 'error', 0, 1, 0, 'glm', 'c:/repo', 'p1', 'local')
  db.close()
}

/** 造一个 MiniMax runtime-state 形态:archived 是 0/1 整数列,不是 NULL 软删列 */
function seedMiniMax(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const db = new DatabaseSync(file)
  db.exec(`
    CREATE TABLE local_runtime_sessions (
      session_id TEXT PRIMARY KEY, title TEXT, archived INTEGER, status TEXT
    );
  `)
  const ins = db.prepare('INSERT INTO local_runtime_sessions (session_id,title,archived,status) VALUES (?,?,?,?)')
  ins.run('m1', '可见一', 0, 'idle')
  ins.run('m2', '可见二', 0, 'error')
  ins.run('m3', '已归档', 1, 'idle')
  db.close()
}

/** 造一个小浣熊 local-chat v1 正库:侧栏只看 available=1,user_id 不参与过滤 */
function seedRaccoon(file, rows) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const db = new DatabaseSync(file)
  db.exec(`
    CREATE TABLE schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY, title TEXT NOT NULL DEFAULT '', chat_type TEXT NOT NULL DEFAULT 'agent',
      available INTEGER NOT NULL DEFAULT 1, project_uuid TEXT, doc_uid TEXT, user_id TEXT,
      workspace_dir TEXT, created_at_ms INTEGER NOT NULL, updated_at_ms INTEGER NOT NULL,
      last_chatted_at_ms INTEGER NOT NULL, raw_message_count INTEGER NOT NULL DEFAULT 0,
      display_message_count INTEGER NOT NULL DEFAULT 0, user_message_count INTEGER NOT NULL DEFAULT 0,
      assistant_message_count INTEGER NOT NULL DEFAULT 0, migration_status TEXT NOT NULL DEFAULT 'native',
      payload_json TEXT NOT NULL
    );
    CREATE TABLE messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL, seq INTEGER NOT NULL,
      display_group_seq INTEGER, role TEXT NOT NULL, type TEXT, turn_id TEXT, uuid TEXT,
      run_id TEXT, external_idempotency_key TEXT, visible INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1, created_at_ms INTEGER, updated_at_ms INTEGER,
      payload_json TEXT NOT NULL, legacy_document_id TEXT, legacy_array_index INTEGER
    );
  `)
  db.prepare(`INSERT INTO schema_meta (key,value) VALUES ('schema_version','1')`).run()
  const ins = db.prepare(
    `INSERT INTO sessions (id,title,user_id,available,created_at_ms,updated_at_ms,last_chatted_at_ms,payload_json)
     VALUES (?,?,?,?,?,?,?,?)`,
  )
  for (const [id, uid, available] of rows) {
    ins.run(id, `对话-${id}`, uid, available, 1, 1, 1, JSON.stringify({ id, title: `对话-${id}`, available }))
    db.prepare(
      `INSERT INTO messages (session_id,seq,role,visible,active,payload_json) VALUES (?,?,?,?,?,?)`,
    ).run(id, 1, 'assistant', 1, 1, JSON.stringify({ role: 'assistant', content: 'ok' }))
  }
  db.close()
}

/** 造一个 Chromium LevelDB 目录,里面只放可扫描的会话 id 文本 */
function seedLeveldbSessions(dir, ids) {
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, '000003.log'), ids.map((id) => `\u0000key\u0000${id}\u0000`).join('\n'), 'latin1')
}

/** 造 Loomy 自带 OpenCode v1 正库:session 顶层/子会话 + message 正文 + part */
function seedLoomyDb(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const db = new DatabaseSync(file)
  db.exec(`
    CREATE TABLE session (
      id TEXT PRIMARY KEY, project_id TEXT, parent_id TEXT, title TEXT,
      time_created INTEGER, time_updated INTEGER, time_archived INTEGER
    );
    CREATE TABLE message (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, data TEXT);
    CREATE TABLE part (id TEXT PRIMARY KEY, message_id TEXT, session_id TEXT NOT NULL, data TEXT);
    CREATE TABLE account (id TEXT PRIMARY KEY, email TEXT);
    CREATE TABLE account_state (id INTEGER PRIMARY KEY, active_account_id TEXT);
  `)
  const s = db.prepare('INSERT INTO session (id,project_id,parent_id,title,time_created,time_updated,time_archived) VALUES (?,?,?,?,?,?,?)')
  s.run('ses_lroot_visible', 'p1', null, '可见顶层', 1, 1, null)
  s.run('ses_lroot_archived', 'p1', null, '已归档顶层', 1, 1, 100)
  s.run('ses_lchild', 'p1', 'ses_lroot_visible', '子会话', 1, 1, null)
  const m = db.prepare('INSERT INTO message (id,session_id,data) VALUES (?,?,?)')
  m.run('lmsg1', 'ses_lroot_visible', '{}')
  m.run('lmsg2', 'ses_lroot_visible', '{}')
  m.run('lmsg3', 'ses_lroot_archived', '{}')
  m.run('lmsg4', 'ses_lchild', '{}')
  const p = db.prepare('INSERT INTO part (id,message_id,session_id,data) VALUES (?,?,?,?)')
  for (let i = 1; i <= 5; i++) p.run(`lpart${i}`, `lmsg${Math.min(i, 4)}`, i <= 2 ? 'ses_lroot_visible' : 'ses_lchild', '{}')
  db.close()
}
function seedOpenCodeDb(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const db = new DatabaseSync(file)
  db.exec(`
    CREATE TABLE session_v2 (
      id TEXT PRIMARY KEY, project_id TEXT, parent_id TEXT, title TEXT,
      time_created INTEGER, time_updated INTEGER, time_archived INTEGER
    );
    CREATE TABLE session_message (
      id TEXT PRIMARY KEY, session_id TEXT NOT NULL, type TEXT, seq INTEGER, data TEXT
    );
    CREATE TABLE credential (
      id TEXT PRIMARY KEY, integration_id TEXT, label TEXT, value TEXT, active INTEGER
    );
    CREATE TABLE account (id TEXT PRIMARY KEY, email TEXT);
    CREATE TABLE account_state (id INTEGER PRIMARY KEY, active_account_id TEXT);
  `)
  const s = db.prepare('INSERT INTO session_v2 (id,project_id,parent_id,title,time_created,time_updated,time_archived) VALUES (?,?,?,?,?,?,?)')
  s.run('ses_root_visible', 'p1', null, '可见顶层', 1, 1, null)
  s.run('ses_root_archived', 'p1', null, '已归档顶层', 1, 1, 100)
  s.run('ses_child', 'p1', 'ses_root_visible', '子会话', 1, 1, null)
  const m = db.prepare('INSERT INTO session_message (id,session_id,type,seq,data) VALUES (?,?,?,?,?)')
  m.run('msg1', 'ses_root_visible', 'user', 1, '{}')
  m.run('msg2', 'ses_root_visible', 'assistant', 2, '{}')
  m.run('msg3', 'ses_root_archived', 'user', 1, '{}')
  m.run('msg4', 'ses_child', 'assistant', 1, '{}')
  db.prepare(`INSERT INTO credential (id,integration_id,label,value,active) VALUES ('cred_1','opencode','OAuth','{}',1)`).run()
  db.close()
}

describe('local 平台现场核验', () => {
  it('无账号列 ⇒ 通过并报真实条数', () => {
    const env = { APPDATA: path.join(tmpRoot, 'env-local'), LOCALAPPDATA: tmpRoot, USERPROFILE: tmpRoot }
    seedScoped(path.join(env.APPDATA, 'com.qodercn.app.stable', 'main.sqlite'), { withAccounts: false })
    const r = switchCarry({ provider: 'qoder', env })
    assert.equal(r.ok, true, r.notes.join(';'))
    assert.equal(r.kind, 'local')
    assert.equal(r.probe.sessions, 3)
    assert.equal(r.probe.visible, 2, 'deleted_at 非空的 1 条不可见')
  })

  it('出现账号维度 ⇒ account-scoped-store,绝不冒绿', () => {
    const env = { APPDATA: path.join(tmpRoot, 'env-scoped'), LOCALAPPDATA: tmpRoot, USERPROFILE: tmpRoot }
    seedScoped(path.join(env.APPDATA, 'com.qodercn.app.stable', 'main.sqlite'), { withAccounts: true })
    const r = switchCarry({ provider: 'qoder', env })
    assert.equal(r.ok, false)
    assert.equal(r.code, 'account-scoped-store')
    assert.equal(r.probe.accountScoped, true)
  })

  it('ZCode 读 tasks 正库,可见按 archived/deleted/cli_deleted 复合口径', () => {
    const env = { APPDATA: path.join(tmpRoot, 'env-zcode'), LOCALAPPDATA: tmpRoot, USERPROFILE: tmpRoot }
    seedZcodeTasks(path.join(env.USERPROFILE, '.zcode', 'v2', 'tasks-index.sqlite'))
    const r = switchCarry({ provider: 'zcode', env })
    assert.equal(r.ok, true, r.notes.join(';'))
    assert.equal(r.probe.raw.table, 'tasks')
    assert.equal(r.probe.sessions, 3)
    assert.equal(r.probe.visible, 1, 'archived 与 deleted 都不能算可见')
    assert.equal(r.probe.accountScoped, false)
  })

  it('MiniMax 的 archived 是 0/1 整数列,不能按 IS NULL 把 25 条全判成不可见', () => {
    const env = { APPDATA: path.join(tmpRoot, 'env-minimax'), LOCALAPPDATA: tmpRoot, USERPROFILE: tmpRoot }
    seedMiniMax(path.join(env.USERPROFILE, '.minimax', 'v2', 'sqlite', 'runtime-state.sqlite'))
    const r = switchCarry({ provider: 'minimax', env })
    assert.equal(r.ok, true, r.notes.join(';'))
    assert.equal(r.probe.sessions, 3)
    assert.equal(r.probe.visible, 2, 'archived=1 的 1 条不可见')
  })

  it('小浣熊读 local-chat.sqlite3 正库,available=1 为侧栏可见,user_id 不构成账号过滤', () => {
    const env = { APPDATA: path.join(tmpRoot, 'env-raccoon'), LOCALAPPDATA: tmpRoot, USERPROFILE: path.join(tmpRoot, 'home-raccoon') }
    seedRaccoon(path.join(env.USERPROFILE, '.office-raccoon', 'user-data', 'local-chat.sqlite3'), [
      ['r1', 'u-old', 1],
      ['r2', 'u-old', 1],
      ['r3', 'u-new', 0],
    ])
    const r = switchCarry({ provider: 'raccoon', env })
    assert.equal(r.ok, true, r.notes.join(';'))
    assert.equal(r.probe.sessions, 3)
    assert.equal(r.probe.visible, 2, 'available=0 的 1 条不可见')
    assert.equal(r.probe.accountScoped, false, 'user_id 只给外部只读会话,不能当侧栏账号维度')
    assert.equal(r.probe.table, 'sessions')
    assert.equal(r.probe.schemaVersion, 1)
    assert.ok(r.notes.join(';').includes('listSessions 只按 available=1 过滤'))
  })

  it('小浣熊已安装但 profile 未初始化 ⇒ 0 条且不冒充未安装', () => {
    const env = { APPDATA: path.join(tmpRoot, 'env-raccoon-empty'), LOCALAPPDATA: tmpRoot, USERPROFILE: path.join(tmpRoot, 'home-raccoon-empty') }
    fs.mkdirSync(path.join(env.USERPROFILE, '.office-raccoon'), { recursive: true })
    const r = switchCarry({ provider: 'raccoon', env })
    assert.equal(r.ok, false)
    assert.equal(r.code, 'profile-uninitialized')
    assert.ok(r.notes.join(';').includes('profile 未初始化'))
  })

  it('OpenCode 读 session_v2 正库,顶层未归档为可见,子会话不混进侧栏计数', () => {
    const env = {
      APPDATA: path.join(tmpRoot, 'env-opencode'),
      LOCALAPPDATA: tmpRoot,
      USERPROFILE: path.join(tmpRoot, 'home-opencode'),
      XDG_DATA_HOME: path.join(tmpRoot, 'xdg-open'),
    }
    seedOpenCodeDb(path.join(env.XDG_DATA_HOME, 'opencode', 'opencode.db'))
    const r = switchCarry({ provider: 'opencode', env })
    assert.equal(r.ok, true, r.notes.join(';'))
    assert.equal(r.probe.table, 'session_v2')
    assert.equal(r.probe.sessions, 2, 'session_v2 顶层会话 2 条,子会话不算侧栏')
    assert.equal(r.probe.visible, 1, 'time_archived 非空的顶层会话不可见')
    assert.equal(r.probe.accountScoped, false, 'session_v2 无 account_id/user_id')
    assert.equal(r.probe.messageCount, 4)
    assert.match(r.notes.join(';'), /session_v2 无 account_id\/user_id/)
  })

  it('OpenCode 只有 drafts.sqlite 索引 ⇒ 不能冒充正库/历史仍在', () => {
    const env = { APPDATA: path.join(tmpRoot, 'env-opencode-drafts'), LOCALAPPDATA: tmpRoot, USERPROFILE: path.join(tmpRoot, 'home-opencode-drafts') }
    fs.mkdirSync(path.join(env.APPDATA, 'ai.opencode.desktop'), { recursive: true })
    const db = new DatabaseSync(path.join(env.APPDATA, 'ai.opencode.desktop', 'drafts.sqlite'))
    db.exec(`CREATE TABLE document (key TEXT PRIMARY KEY, value TEXT);`)
    db.prepare('INSERT INTO document (key,value) VALUES (?,?)').run('session:ses_x', '{}')
    db.close()
    const r = switchCarry({ provider: 'opencode', env })
    assert.equal(r.ok, false)
    assert.equal(r.code, 'unlocated')
  })

  it('Loomy 读自带 OpenCode 正库 session/message/part,不把 Local Storage 索引当正文', () => {
    const env = {
      APPDATA: path.join(tmpRoot, 'env-loomy'),
      LOCALAPPDATA: tmpRoot,
      USERPROFILE: tmpRoot,
      PUBLIC: path.join(tmpRoot, 'Public'),
    }
    const file = path.join(env.PUBLIC, 'Loomy', 'tenant-a', 'share', 'opencode', 'opencode.db')
    seedLoomyDb(file)
    const r = switchCarry({ provider: 'loomy', env })
    assert.equal(r.ok, true, r.notes.join(';'))
    assert.equal(r.probe.table, 'session')
    assert.equal(r.probe.sessions, 2, '顶层会话 2 条,子会话不混进侧栏')
    assert.equal(r.probe.visible, 1, 'time_archived 非空的顶层会话不可见')
    assert.equal(r.probe.messageCount, 4)
    assert.equal(r.probe.partCount, 5)
    assert.equal(r.probe.accountScoped, false, 'session 无 account_id/user_id')
    assert.match(r.notes.join(';'), /旧会话在新号仍在/)
  })

  it('Loomy 只有 Local Storage 索引 ⇒ unlocated,不冒充正库', () => {
    const env = { APPDATA: path.join(tmpRoot, 'env-loomy-index'), LOCALAPPDATA: tmpRoot, USERPROFILE: tmpRoot, PUBLIC: path.join(tmpRoot, 'Public-empty') }
    seedLeveldbSessions(path.join(env.APPDATA, 'Loomy', 'Local Storage', 'leveldb'), ['ses_dddddddddddddddddddddddddd'])
    const r = switchCarry({ provider: 'loomy', env })
    assert.equal(r.ok, false)
    assert.equal(r.code, 'unlocated')
  })

  it('探不到库 ⇒ unlocated,不冒充通过', () => {
    const env = { APPDATA: path.join(tmpRoot, 'env-empty'), LOCALAPPDATA: tmpRoot, USERPROFILE: tmpRoot }
    fs.mkdirSync(env.APPDATA, { recursive: true })
    const r = switchCarry({ provider: 'qoder', env })
    assert.equal(r.ok, false)
    assert.equal(r.code, 'unlocated')
  })
})

describe('vscdb 键面', () => {
  it('uid 前缀键 ⇒ 判需重绑;无前缀 ⇒ 历史天然在', () => {
    const scopedFile = path.join(tmpRoot, 'vscdb-scoped', 'state.vscdb')
    seedVscdb(scopedFile, ['1234abcd:chat.sessions', '1234abcd:chat.messages', 'theme'])
    const s = probeVscdb({ candidates: [scopedFile], provider: 'codearts' })
    assert.equal(s.accountScoped, true)
    assert.equal(s.keyCount, 3)

    const plainFile = path.join(tmpRoot, 'vscdb-plain', 'state.vscdb')
    seedVscdb(plainFile, ['chat.sessions', 'theme'])
    const p = probeVscdb({ candidates: [plainFile], provider: 'codearts' })
    assert.equal(p.accountScoped, false)
  })
})

describe('rebind 平台', () => {
  it('缺 uid ⇒ no-uid,不猜', () => {
    const r = switchCarry({ provider: 'workbuddy', fromUid: '', toUid: 'x' })
    assert.equal(r.ok, false)
    assert.equal(r.code, 'no-uid')
  })

  it('有 uid ⇒ 走注入实现并回明细', () => {
    const r = switchCarry({
      provider: 'workbuddy',
      fromUid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      toUid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      wbImpl: ({ reviveSessionIds }) => ({
        moved: { sessions: 2, spaces: 1, automations: 0, revived: reviveSessionIds.length },
        revive: { ids: reviveSessionIds.length, revived: reviveSessionIds.length },
        snapshot: { merged: 1 },
        notes: ['测试实现'],
      }),
      reviveSessionIds: ['s-x'],
    })
    assert.equal(r.ok, true)
    assert.equal(r.kind, 'rebind')
    assert.equal(r.moved.revived, 1)
  })

  it('trae 走专用链,注册层只登记能力', () => {
    const r = switchCarry({ provider: 'trae' })
    assert.equal(r.ok, true)
    assert.equal(r.action, 'dedicated')
  })
})

describe('全平台巡检', () => {
  it('每行都有明确结论,未定位不当成功', () => {
    const rows = auditProviders({ env: { APPDATA: path.join(tmpRoot, 'audit-empty'), LOCALAPPDATA: tmpRoot, USERPROFILE: tmpRoot } })
    assert.equal(rows.length, POOL_PROVIDERS.length)
    for (const r of rows) {
      assert.equal(typeof r.ok, 'boolean')
      assert.ok(Array.isArray(r.notes))
      if (!r.located && r.installed !== false && r.kind !== 'cloud') assert.equal(r.ok, false)
    }
  })
})

describe('切号入口覆盖', () => {
  it('switch-client-account 支持集覆盖注册表全部平台(不许"注册了但切不了")', () => {
    const src = fs.readFileSync(path.resolve(import.meta.dirname, '..', 'switch-client-account.mjs'), 'utf8')
    const m = src.match(/const SUPPORTED_PLATFORMS = Object\.freeze\(\[([\s\S]*?)\]\)/)
    assert.ok(m, '未找到 SUPPORTED_PLATFORMS 定义')
    for (const p of POOL_PROVIDERS) {
      assert.ok(new RegExp(`'${p}'`).test(m[1]), `${p} 不在切号入口支持集`)
    }
  })

  it('一键切号的对话文案覆盖全部平台且不空', () => {
    const src = fs.readFileSync(path.resolve(import.meta.dirname, '..', 'client-oneclick-switch.mjs'), 'utf8')
    for (const p of POOL_PROVIDERS) {
      assert.ok(new RegExp(`\\n  ${p}: \\{`).test(src), `${p} 缺 CHAT_CARRY 文案`)
    }
  })
})

describe('WorkBuddy 探针入口', () => {
  it('读不到登录态 ⇒ located:false 且给出原因', () => {
    const p = probeProvider('workbuddy', { env: { LOCALAPPDATA: path.join(tmpRoot, 'no-la'), USERPROFILE: path.join(tmpRoot, 'no-home') } })
    assert.equal(p.located, false)
    assert.ok(p.notes.join(';').includes('探针未判定'))
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
