// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * trae-chat-carry 镜像测试(§22c:import 源 __test__,零复制判据)。只碰 scratch 夹具。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import * as C from '../lib/trae-chat-carry.mjs'
import * as SC from '../lib/trae-sqlcipher.mjs'

const require = createRequire(import.meta.url)
const { DatabaseSync } = require('node:sqlite')
const HERE = path.dirname(fileURLToPath(import.meta.url))

const { userIdFromUserInfo, rebindDatabase, planKeyRenames, rebindVscdb, rebindStorageJson, planTipsRenames } = C.__test__

const OLD = '256600094542297'
const NEW = '777000111222333'

test('userIdFromUserInfo:顶层 / account 内 / 坏形态', () => {
  assert.equal(userIdFromUserInfo({ userId: OLD }), OLD)
  assert.equal(userIdFromUserInfo({ account: { uid: OLD } }), OLD)
  assert.equal(userIdFromUserInfo({ uid: 'abc' }), null) // 非数字形态不认
  assert.equal(userIdFromUserInfo(null), null)
})

test('planKeyRenames:纯替换,不含旧 uid 的键不动', () => {
  const plan = planKeyRenames([`${OLD}:draft:session:x:code`, 'other', `${OLD}_${OLD}double`], OLD, NEW)
  assert.equal(plan.length, 2)
  assert.equal(plan[0].to, `${NEW}:draft:session:x:code`)
  assert.ok(plan.every((p) => !p.to.includes(OLD)))
})

test('rebindVscdb:rename 成功 + 与新号既有键相撞时保新删旧并计数', () => {
  const scratch = mkScratch('carry-vscdb')
  const file = path.join(scratch, 'state.vscdb')
  const db = new DatabaseSync(file)
  db.exec('CREATE TABLE ItemTable(key TEXT PRIMARY KEY, value BLOB)')
  const ins = db.prepare('INSERT INTO ItemTable(key,value) VALUES(?,?)')
  ins.run(`${OLD}:a`, 'old-a')
  ins.run(`${OLD}:b`, 'old-b')
  ins.run(`${NEW}:b`, 'new-b') // 目标号已有同键
  ins.run('plain', 'p')
  db.close()
  const out = rebindVscdb(file, OLD, NEW)
  assert.equal(out.renamed, 1) // a 改名;b 撞车
  assert.equal(out.collisions, 1)
  const check = new DatabaseSync(file, { readOnly: true })
  const rows = check.prepare('SELECT key,value FROM ItemTable').all()
  check.close()
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  assert.equal(byKey[`${NEW}:a`], 'old-a')
  assert.equal(byKey[`${OLD}:b`], undefined) // 旧行被删
  assert.equal(byKey[`${NEW}:b`], 'new-b') // 新值的赢
})

test('rebindDatabase:project/user_configuration/server_history_info 按旧 uid 改;NULL 归并只在存在旧号非空行时发生', () => {
  const scratch = mkScratch('carry-db')
  const file = path.join(scratch, 'plain.db')
  const db = new DatabaseSync(file)
  db.exec('CREATE TABLE project(id INTEGER PRIMARY KEY, user_id TEXT)')
  db.exec('CREATE TABLE user_configuration(id INTEGER PRIMARY KEY, user_id TEXT)')
  db.exec('CREATE TABLE server_history_info(history_id INTEGER PRIMARY KEY, user_id TEXT)')
  db.prepare('INSERT INTO project(user_id) VALUES(?)').run(OLD)
  db.prepare('INSERT INTO user_configuration(user_id) VALUES(?)').run(OLD)
  db.prepare('INSERT INTO server_history_info(user_id) VALUES(?)').run(OLD)
  db.prepare('INSERT INTO server_history_info(user_id) VALUES(?)').run(null)
  const reb = rebindDatabase(db, OLD, NEW)
  assert.equal(reb.project, 1)
  assert.equal(reb.user_configuration, 1)
  assert.equal(reb.server_history_info, 1)
  assert.equal(reb['server_history_info:null-merge'], 1) // 有旧号行 ⇒ NULL 归并
  const left = db.prepare('SELECT COUNT(*) c FROM server_history_info WHERE user_id IS NULL').get().c
  assert.equal(Number(left), 0)
  db.close()
  // 反例:全新空表场景(没有任何旧号行)⇒ 不得把匿名行错挂
  const file2 = path.join(scratch, 'anon.db')
  const d2 = new DatabaseSync(file2)
  d2.exec('CREATE TABLE server_history_info(history_id INTEGER PRIMARY KEY, user_id TEXT)')
  d2.exec('CREATE TABLE project(id INTEGER PRIMARY KEY, user_id TEXT)')
  d2.exec('CREATE TABLE user_configuration(id INTEGER PRIMARY KEY, user_id TEXT)')
  d2.exec('CREATE TABLE chat_session(id INTEGER PRIMARY KEY, user_id TEXT)')
  d2.prepare('INSERT INTO server_history_info(user_id) VALUES(?)').run(null)
  const reb2 = rebindDatabase(d2, OLD, NEW)
  assert.equal(reb2['server_history_info:null-merge'], undefined)
  d2.close()
  rmScratch(scratch)
})

test('rebindStorageJson:checkin 键改名 + 信封重封(能加回解出新 uid)', () => {
  const key = SC.deriveEncKey(Buffer.from('pw'), Buffer.from('123456789abcdef01122334455667788', 'hex'), 10)
  // 用 lib 的信封函数造:先加密一份含旧 uid 的信封需经 trae-auth-extract 的 encryptEnvelope
  const { encryptEnvelope, decryptEnvelope } = require('../lib/trae-auth-extract.mjs')
  const envelope = encryptEnvelope(JSON.stringify({ userId: OLD, token: 't0k3n', account: { username: 'me' } }))
  const store = {
    ['icube.checkin1024.' + OLD + '.intro']: '1',
    'iCubeAuthInfo://icube.cloudide': envelope,
    unrelated: 'keep',
  }
  const { next, actions } = rebindStorageJson(store, OLD, NEW)
  assert.equal(next['icube.checkin1024.' + NEW + '.intro'], '1')
  assert.equal(next['icube.checkin1024.' + OLD + '.intro'], undefined)
  const back = JSON.parse(decryptEnvelope(next['iCubeAuthInfo://icube.cloudide']))
  assert.equal(back.userId, NEW)
  assert.equal(back.token, 't0k3n') // 凭据字段原样(切号链之后会被池票覆盖,这里保结构)
  assert.ok(actions.some((a) => a.kind === 'envelope-uid-rebind'))
  void key
})

test('planTipsRenames:文件名含旧 uid ⇒ 改名计划;目录不存在 ⇒ 空', () => {
  const scratch = mkScratch('carry-tips')
  const dir = path.join(scratch, 'conversation-tips')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, `CN.${OLD}.abc.json`), '{}')
  fs.writeFileSync(path.join(dir, 'CN.other.def.json'), '{}')
  const plan = planTipsRenames(scratch, OLD, NEW)
  assert.equal(plan.length, 1)
  assert.ok(plan[0].to.endsWith(`CN.${NEW}.abc.json`))
  assert.equal(planTipsRenames(path.join(scratch, 'nope'), OLD, NEW).length, 0)
  rmScratch(scratch)
})

test('verifyRebuiltCipher:正常路径过;密文被破坏时点名拒绝(取证产物在位才跑)', (t) => {
  const oracle = path.resolve(HERE, '../../.ihui-agent/tmp/chat-migration/dec4.db')
  if (!fs.existsSync(oracle)) {
    t.skip('无 dec4 取证产物 ⇒ 该证据缺席')
    return
  }
  const useBuf = fs.readFileSync(oracle)
  const key = SC.__test__.deriveGlobalKey({ trustDocumented: true }).key
  const enc = SC.encryptDatabase(key, useBuf)
  assert.ok(C.verifyRebuiltCipher(useBuf, enc, key).ok)
  // 人为破坏:把密文第二页换成另一页 ⇒ HMAC/对拍必拦
  const broken = Buffer.from(enc)
  enc.copy(broken, SC.CIPHER.PAGE, 2 * SC.CIPHER.PAGE, 3 * SC.CIPHER.PAGE)
  assert.throws(() => C.verifyRebuiltCipher(useBuf, broken, key), /HMAC|自证|形态/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

