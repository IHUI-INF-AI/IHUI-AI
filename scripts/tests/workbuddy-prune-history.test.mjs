// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WorkBuddy 历史清理的锁定测试(2026-11-22 立)。
 *
 * 钉的是边界:可见会话不动、cloud 行不动、软删行与无主正文才进回收目录;
 * 库先备份;dry-run 零改动。全部在临时目录造真 SQLite,零真实用户目录。
 */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { after, before, describe, it } from 'node:test'

import { pruneWorkbuddyHistory } from '../workbuddy-prune-history.mjs'

let tmpRoot
before(() => {
  const base = path.resolve(import.meta.dirname, '..', '..', '.tmp', 'test-workbuddy-prune')
  fs.mkdirSync(base, { recursive: true })
  tmpRoot = fs.mkdtempSync(path.join(base, 'run-'))
})
after(() => {
  try {
    fs.rmSync(tmpRoot, { recursive: true, force: true, maxRetries: 3 })
  } catch {
    /* Windows 句柄滞后:残留由 .tmp 生命周期回收 */
  }
})

const UID = '11111111-1111-4111-8111-111111111111'

function seed(home) {
  fs.mkdirSync(home, { recursive: true })
  const db = new DatabaseSync(path.join(home, 'workbuddy.db'))
  db.exec(`
    CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id TEXT, transport TEXT, deleted_at INTEGER, title TEXT, space_id TEXT);
  `)
  const ins = db.prepare('INSERT INTO sessions (id,user_id,transport,deleted_at,title,space_id) VALUES (?,?,?,?,?,?)')
  ins.run('s-visible', UID, 'local', null, '要留的对话', null)
  ins.run('s-hidden', UID, 'local', 123, '已软删的对话', null)
  ins.run('s-cloud', UID, 'cloud', 456, '云端会话', null)
  db.close()
  for (const id of ['s-visible', 's-hidden', 's-orphan']) {
    const f = path.join(home, 'projects', 'p', `${id}.jsonl`)
    fs.mkdirSync(path.dirname(f), { recursive: true })
    fs.writeFileSync(f, '{"m":1}\n', 'utf8')
  }
}

describe('pruneWorkbuddyHistory', () => {
  it('dry-run 零改动:不删行、不搬正文、不建备份', () => {
    const home = path.join(tmpRoot, 'dry')
    seed(home)
    const r = pruneWorkbuddyHistory({ apply: false, home })
    assert.equal(r.dryRun, true)
    assert.equal(r.rows.delete, 1, '只把 local 软删行当目标(cloud 不算)')
    assert.equal(r.bodies.targetFiles, 1)
    assert.equal(r.bodies.orphanFiles, 1)
    const db = new DatabaseSync(path.join(home, 'workbuddy.db'))
    assert.equal(db.prepare('SELECT count(*) AS n FROM sessions').get().n, 3)
    db.close()
    assert.ok(fs.existsSync(path.join(home, 'projects', 'p', 's-hidden.jsonl')))
    assert.equal(fs.existsSync(path.join(home, '.ihui-trash')), false)
  })

  it('apply:只清软删本地行,可见行/cloud 行与可见正文原样保留', () => {
    const home = path.join(tmpRoot, 'apply')
    seed(home)
    const r = pruneWorkbuddyHistory({ apply: true, home, runId: 't1' })
    assert.equal(r.ok, true)
    assert.equal(r.deleted, 1)
    assert.ok(fs.existsSync(r.backup), '库先备份')
    const db = new DatabaseSync(path.join(home, 'workbuddy.db'))
    const ids = db.prepare('SELECT id FROM sessions ORDER BY id').all().map((x) => x.id)
    assert.deepEqual(ids, ['s-cloud', 's-visible'])
    db.close()
    assert.ok(fs.existsSync(path.join(home, 'projects', 'p', 's-visible.jsonl')), '可见对话正文不动')
    assert.equal(fs.existsSync(path.join(home, 'projects', 'p', 's-hidden.jsonl')), false, '软删正文已搬走')
    assert.equal(fs.existsSync(path.join(home, 'projects', 'p', 's-orphan.jsonl')), false, '无主正文已搬走')
    assert.ok(fs.existsSync(path.join(home, '.ihui-trash', 't1', 'projects', 'p', 's-hidden.jsonl')))
    assert.ok(fs.existsSync(path.join(home, '.ihui-trash', 't1', 'manifest.json')))
  })

  it('没有会话库 ⇒ 如实失败,不静默成功', () => {
    const empty = path.join(tmpRoot, 'nodb')
    fs.mkdirSync(empty, { recursive: true })
    const r = pruneWorkbuddyHistory({ apply: true, home: empty })
    assert.equal(r.ok, false)
    assert.equal(r.code, 'no-db')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
