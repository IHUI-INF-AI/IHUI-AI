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
    }
    assert.equal(CARRY_MATRIX.workbuddy.kind, 'rebind')
    assert.equal(CARRY_MATRIX.doubao.kind, 'cloud')
  })
})

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
