// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WorkBuddy 切号携带对话的锁定测试(2026-11-12 立)。
 *
 * 钉的是判据本身,不是"跑通一次":
 *   1) 会话按 uid 归属、客户端按 uid 过滤 ⇒ 重绑是必需动作(不是可选优化);
 *   2) 只搬旧号名下的 local 行,cloud 行与别人名下的行一行不许动;
 *   3) 侧边栏快照按 id 去重合并、目标优先、savedAt 不回退;
 *   4) 取不到输入/形状不符 ⇒ 抛 CarryError,绝不静默返回 0 条冒绿(§0.3)。
 *
 * 全部用临时目录里的真 SQLite(与客户端同 schema 的最小面),零真实用户目录。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { after, before, describe, it } from 'node:test'

import {
  CarryError,
  countByOwner,
  isUid,
  mergeSidebarSnapshot,
  planCarry,
  runCarry,
} from '../lib/workbuddy-chat-carry.mjs'

const UID_A = '11111111-1111-4111-8111-111111111111'
const UID_B = '22222222-2222-4222-8222-222222222222'
const UID_C = '33333333-3333-4333-8333-333333333333'

let tmpRoot

function seed(home) {
  fs.mkdirSync(home, { recursive: true })
  const db = new DatabaseSync(path.join(home, 'workbuddy.db'))
  db.exec(`
    CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id TEXT, transport TEXT, deleted_at INTEGER, title TEXT);
    CREATE TABLE spaces (id TEXT PRIMARY KEY, user_id TEXT);
    CREATE TABLE automations (id TEXT PRIMARY KEY, owner_user_id TEXT);
  `)
  const ins = db.prepare('INSERT INTO sessions (id,user_id,transport,deleted_at,title) VALUES (?,?,?,?,?)')
  ins.run('s-a1', UID_A, 'local', null, 'A 的对话一')
  ins.run('s-a2', UID_A, 'local', 123, 'A 的对话二(软删)')
  ins.run('s-a3', UID_A, 'cloud', -1, 'A 的云端会话')
  ins.run('s-b1', UID_B, 'local', null, 'B 自己的对话')
  ins.run('s-c1', UID_C, 'local', null, 'C 的对话')
  const sp = db.prepare('INSERT INTO spaces (id,user_id) VALUES (?,?)')
  sp.run('sp-a', UID_A)
  sp.run('sp-b', UID_B)
  const au = db.prepare('INSERT INTO automations (id,owner_user_id) VALUES (?,?)')
  au.run('au-a', UID_A)
  db.close()
}

function snapshotFile(home, uid, items, savedAt) {
  const dir = path.join(home, uid)
  fs.mkdirSync(dir, { recursive: true })
  const f = path.join(dir, 'sidebar-list-snapshot.json')
  fs.writeFileSync(f, JSON.stringify({ version: 3, savedAt, items }), 'utf8')
  return f
}

before(() => {
  // 临时目录用仓内 .tmp(系统 TEMP 在本机被重定向且偶发 EPERM,句柄释放滞后)
  const base = path.resolve(import.meta.dirname, '..', '..', '.tmp', 'test-workbuddy-carry')
  fs.mkdirSync(base, { recursive: true })
  tmpRoot = fs.mkdtempSync(path.join(base, 'run-'))
})
after(() => {
  try {
    fs.rmSync(tmpRoot, { recursive: true, force: true, maxRetries: 3 })
  } catch {
    /* Windows 句柄释放滞后:残留目录由 .tmp 自身生命周期回收,不因此判测试失败 */
  }
})

describe('isUid', () => {
  it('只认 UUID,空串是客户端哨兵不算uid', () => {
    assert.equal(isUid(UID_A), true)
    assert.equal(isUid(''), false)
    assert.equal(isUid('auto:abc'), false)
    assert.equal(isUid(null), false)
  })
})

describe('planCarry', () => {
  it('统计三张表里属于旧号的行,并给出两个快照落点', () => {
    const home = path.join(tmpRoot, 'plan')
    seed(home)
    const db = new DatabaseSync(path.join(home, 'workbuddy.db'))
    const plan = planCarry(db, { fromUid: UID_A, toUid: UID_B, home })
    assert.equal(plan.sessions, 3, 'A 名下 3 行(含 cloud)')
    assert.equal(plan.spaces, 1)
    assert.equal(plan.automations, 1)
    assert.equal(plan.snapshotFrom, path.join(home, UID_A, 'sidebar-list-snapshot.json'))
    db.close()
  })

  it('同号/坏形状一律拒绝,不猜', () => {
    const home = path.join(tmpRoot, 'plan-bad')
    seed(home)
    const db = new DatabaseSync(path.join(home, 'workbuddy.db'))
    assert.throws(() => planCarry(db, { fromUid: UID_A, toUid: UID_A, home }), CarryError)
    assert.throws(() => planCarry(db, { fromUid: 'x', toUid: UID_B, home }), CarryError)
    assert.throws(() => planCarry(db, { fromUid: UID_A, toUid: '', home }), CarryError)
    db.close()
  })
})

describe('runCarry', () => {
  it('只搬旧号的 local 行:cloud 行与别人名下的一行不动', () => {
    const home = path.join(tmpRoot, 'run')
    seed(home)
    const r = runCarry({ fromUid: UID_A, toUid: UID_B, home })
    assert.equal(r.ok, true)
    assert.equal(r.moved.sessions, 2, 'A 的 2 条 local 行')
    assert.equal(r.moved.spaces, 1)
    assert.equal(r.moved.automations, 1)

    const db = new DatabaseSync(path.join(home, 'workbuddy.db'))
    const rows = db.prepare('SELECT id,user_id,transport FROM sessions ORDER BY id').all()
    const byId = Object.fromEntries(rows.map((x) => [x.id, x]))
    assert.equal(byId['s-a1'].user_id, UID_B, '旧号 local 行改归新号')
    assert.equal(byId['s-a2'].user_id, UID_B, '软删的 local 行同样要搬(否则历史看着少)')
    assert.equal(byId['s-a3'].user_id, UID_A, 'cloud 行归云端账号体系,不许动')
    assert.equal(byId['s-b1'].user_id, UID_B, '新号原有行不受影响')
    assert.equal(byId['s-c1'].user_id, UID_C, '第三方账号的行绝不许动')
    assert.equal(countByOwner(db, UID_A).local, 0)
    assert.equal(countByOwner(db, UID_B).local, 3, 'B 原有 1 + 搬来 2')
    db.close()
  })

  it('搬完写库备份,可回滚', () => {
    const home = path.join(tmpRoot, 'backup')
    seed(home)
    const r = runCarry({ fromUid: UID_A, toUid: UID_B, home })
    const baks = r.backups.filter((b) => b.includes('workbuddy.db'))
    assert.equal(baks.length, 1)
    assert.ok(fs.existsSync(baks[0]))
    const old = new DatabaseSync(baks[0])
    assert.equal(countByOwner(old, UID_A).local, 2, '备份里旧号仍有 2 条 local')
    old.close()
  })

  it('dry-run 一行都不改', () => {
    const home = path.join(tmpRoot, 'dry')
    seed(home)
    const r = runCarry({ fromUid: UID_A, toUid: UID_B, home, dryRun: true })
    assert.equal(r.dryRun, true)
    assert.equal(r.moved.sessions, 3)
    const db = new DatabaseSync(path.join(home, 'workbuddy.db'))
    assert.equal(countByOwner(db, UID_A).local, 2, 'dry-run 后旧号仍有 2 条 local')
    db.close()
  })

  it('无会话库 ⇒ 抛 CarryError 并点名,不静默成功', () => {
    const home = path.join(tmpRoot, 'nodb')
    fs.mkdirSync(home, { recursive: true })
    assert.throws(
      () => runCarry({ fromUid: UID_A, toUid: UID_B, home }),
      (e) => e instanceof CarryError && e.code === 'no-db',
    )
  })
})

describe('mergeSidebarSnapshot', () => {
  it('按 id 去重合并,目标已有的条目优先', () => {
    const home = path.join(tmpRoot, 'snap')
    const from = snapshotFile(home, UID_A, [
      { id: 'c1', title: '旧号的对话', lastActivityAt: 100 },
      { id: 'shared', title: '旧号里的同名条目', lastActivityAt: 200 },
    ], 1000)
    const to = snapshotFile(home, UID_B, [{ id: 'shared', title: '新号自己的条目', lastActivityAt: 300 }], 900)
    const r = mergeSidebarSnapshot({ fromFile: from, toFile: to })
    assert.equal(r.changed, true)
    assert.equal(r.merged, 1, '只并入 c1,shared 已存在')
    const out = JSON.parse(fs.readFileSync(to, 'utf8'))
    assert.equal(out.version, 3)
    const ids = out.items.map((i) => i.id).sort()
    assert.deepEqual(ids, ['c1', 'shared'])
    assert.equal(out.items.find((i) => i.id === 'shared').title, '新号自己的条目', '目标优先')
    assert.ok(out.savedAt >= 1000, 'savedAt 取较大值,不回退')
  })

  it('目标没有快照 ⇒ 以源为底建,并备份源', () => {
    const home = path.join(tmpRoot, 'snap2')
    const from = snapshotFile(home, UID_A, [{ id: 'c1', title: 'x', lastActivityAt: 1 }], 500)
    const to = path.join(home, UID_B, 'sidebar-list-snapshot.json')
    const r = mergeSidebarSnapshot({ fromFile: from, toFile: to })
    assert.equal(r.changed, true)
    assert.equal(r.merged, 1)
    assert.ok(r.backups.length >= 1, '源文件已备份')
    assert.ok(fs.existsSync(to))
  })

  it('源多无条目 ⇒ 不造空改动', () => {
    const home = path.join(tmpRoot, 'snap3')
    const from = snapshotFile(home, UID_A, [], 10)
    const to = snapshotFile(home, UID_B, [], 20)
    const r = mergeSidebarSnapshot({ fromFile: from, toFile: to })
    assert.equal(r.changed, false)
    assert.equal(r.merged, 0)
  })

  it('快照损坏 ⇒ 抛 CarryError,绝不覆盖成空', () => {
    const home = path.join(tmpRoot, 'snap4')
    const from = path.join(home, UID_A, 'sidebar-list-snapshot.json')
    fs.mkdirSync(path.dirname(from), { recursive: true })
    fs.writeFileSync(from, '{不是 JSON', 'utf8')
    const to = snapshotFile(home, UID_B, [], 20)
    assert.throws(
      () => mergeSidebarSnapshot({ fromFile: from, toFile: to }),
      (e) => e instanceof CarryError && e.code === 'snapshot-shape',
    )
    assert.equal(fs.readFileSync(to, 'utf8').includes('items'), true, '目标未被破坏')
  })
})

describe('runCarry 快照联动', () => {
  it('旧号快照条目并入新号,旧分片清空防残影', () => {
    const home = path.join(tmpRoot, 'full')
    seed(home)
    const from = snapshotFile(home, UID_A, [{ id: 'c1', title: '旧号的对话', lastActivityAt: 1 }], 1000)
    const to = snapshotFile(home, UID_B, [], 500)
    const r = runCarry({ fromUid: UID_A, toUid: UID_B, home })
    assert.equal(r.snapshot.merged, 1)
    const dst = JSON.parse(fs.readFileSync(to, 'utf8'))
    assert.deepEqual(dst.items.map((i) => i.id), ['c1'])
    const src = JSON.parse(fs.readFileSync(from, 'utf8'))
    assert.equal(src.items.length, 0, '旧分片清空')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
