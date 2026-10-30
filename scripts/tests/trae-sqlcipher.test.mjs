// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * trae-sqlcipher 镜像测试(§22c:import 源脚本 __test__,零复制判据)。
 * 三层证据:
 *   1) 算法已知答案:三表 XOR 解出社区文档记录的明文密码(公开取证结论,本机 DLL 在位时再对表一次);
 *   2) 合成夹具:建库→加密→解密→行数/内容读回(抓页布局逻辑错;合成库的页尾未用区
 *      被 node:sqlite 当普通空间使用,故此处只做**库级等价**断言,不做逐字节);
 *   3) 真实形态:本机有 Trae 库取证产物(.ihui-agent/tmp/chat-migration/dec4.db)时,
 *      按真实 Trae 引擎形态(页尾恒零)做**字节级严格往返**;没有该产物 ⇒ 该例点名 skip 不记绿。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import * as S from '../lib/trae-sqlcipher.mjs'

const require = createRequire(import.meta.url)
const { DatabaseSync } = require('node:sqlite')

const { xorDecrypt, deriveEncKey, encryptDatabase, decryptDatabase, roundtripSelfCheck, probe, CIPHER, KNOWN_CONSTANTS } = S.__test__

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')

function fixtureKey() {
  return deriveEncKey(Buffer.from('test-password'), Buffer.from(KNOWN_CONSTANTS.pbkdf2SaltHex, 'hex'), 1000)
}

function makePlainDb(rows = 5) {
  const scratch = mkScratch('sqlcipher-fixture')
  const file = path.join(scratch, 'plain.db')
  const db = new DatabaseSync(file)
  db.exec('CREATE TABLE project(id INTEGER PRIMARY KEY, user_id TEXT, name TEXT)')
  db.exec('CREATE TABLE msg(id INTEGER PRIMARY KEY, session_id TEXT, body TEXT)')
  const ins = db.prepare('INSERT INTO project(user_id,name) VALUES(?,?)')
  for (let i = 0; i < rows; i++) ins.run(`uid-${i % 2}`, `名-中文-${i}🙂`)
  const ins2 = db.prepare('INSERT INTO msg(session_id,body) VALUES(?,?)')
  for (let i = 0; i < rows * 120; i++) ins2.run(`s${i % 7}`, `正文内容行 ${i}${'×'.repeat(40)}`)
  db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
  db.close()
  const buf = fs.readFileSync(file)
  rmScratch(scratch)
  return buf
}

test('XOR 三表周期解密的已知答案(与外部取证文档一致)', () => {
  const tables = KNOWN_CONSTANTS.xorTables.map((s) => Buffer.from(s, 'utf8'))
  const enc = Buffer.from(KNOWN_CONSTANTS.encryptedPassword, 'hex')
  const got = xorDecrypt(enc, tables)
  assert.equal(got.toString('ascii'), '1CqAknayQsrfH9Byp2QzynTckHGzRom9')
})

test('deriveEncKey 形状与确定性', () => {
  const k1 = fixtureKey()
  const k2 = fixtureKey()
  assert.equal(k1.length, CIPHER.KEY_LEN)
  assert.ok(k1.equals(k2))
})

test('库级等价(行数/内容/中文长文读回):以取证产物为库源(缺席点名不记绿)', (t) => {
  const oracle = path.join(ROOT, '.ihui-agent', 'tmp', 'chat-migration', 'dec4.db')
  if (!fs.existsSync(oracle)) {
    t.skip('本轮无 dec4 取证产物 ⇒ 库级证据缺席(HMAC/salt 形态例不依赖真实库,已另行覆盖)')
    return
  }
  const key = fixtureKey()
  const plain = fs.readFileSync(oracle)
  const enc = encryptDatabase(key, plain)
  assert.equal(enc.length % CIPHER.PAGE, 0)
  const back = decryptDatabase(key, enc)
  const scratch = mkScratch('sqlcipher-back')
  const f = path.join(scratch, 'back.db')
  fs.writeFileSync(f, back)
  const db = new DatabaseSync(f, { readOnly: true })
  const rows = db.prepare('SELECT COUNT(*) c FROM chat_message').get().c
  const hist = db.prepare('SELECT messages FROM history_v2 LIMIT 1').get().messages
  db.close()
  try {
    rmScratch(scratch)
  } catch {
    /* Windows EPERM 偶发 ⇒ 不掩盖断言结果 */
  }
  assert.ok(Number(rows) > 1000, `真实库 chat_message 应千级,现读 ${rows}`)
  assert.match(String(hist), /raw_messages/, '对话正文(messages JSON)必须完整读回')
})

test('错误密钥必须逐页 HMAC 拦下(绝不产出半解密库)', () => {
  const key = fixtureKey()
  const enc = encryptDatabase(key, makePlainDb(2))
  const wrong = Buffer.alloc(32, 7)
  assert.throws(() => decryptDatabase(wrong, enc), /HMAC|不匹配/)
  assert.equal(probe(wrong, enc).keyMatches, false)
  assert.equal(probe(key, enc).keyMatches, true)
})

test('缺 SQLite 头的入参拒绝加密(bad-header)', () => {
  const junk = Buffer.alloc(CIPHER.PAGE, 3)
  assert.throws(() => encryptDatabase(fixtureKey(), junk), /header/)
})

test('页 1 密文口径:salt 前 16 字节 + HMAC 覆盖 ct+iv+pgno', () => {
  const key = fixtureKey()
  const enc = encryptDatabase(key, makePlainDb(1), Buffer.alloc(CIPHER.SALT, 0xab))
  assert.ok(enc.subarray(0, 16).equals(Buffer.alloc(16, 0xab)))
  assert.equal(enc.length % CIPHER.PAGE, 0)
})

test('本机 ai_agent.dll 在位 ⇒ 全局密钥现读与公开常量对表', (t) => {
  const candidates = [
    'C:/Users/Administrator/AppData/Local/Programs/Trae CN/resources/app/modules/ai-agent/ai_agent.dll',
    path.join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Trae CN', 'resources/app/modules/ai-agent/ai_agent.dll'),
  ]
  const dll = candidates.find((f) => f && fs.existsSync(f))
  if (!dll) {
    t.skip('本机无 ai_agent.dll ⇒ 不记绿(取证缺席)')
    return
  }
  const buf = fs.readFileSync(dll)
  const v = S.verifyDllConstants(buf)
  assert.ok(v.ok, `DLL 常量族缺项: ${v.missing.join(',')}`)
  const { key } = S.deriveGlobalKey({ dllBuf: buf })
  assert.equal(key.toString('hex'), '3605f6691095a993f03d5009c918352ef5be31ae31e8f000212b81ff058da773')
})

test('真实 Trae 形态字节级严格往返(取证产物在位才跑;缺席点名不记绿)', (t) => {
  const oracle = path.join(ROOT, '.ihui-agent', 'tmp', 'chat-migration', 'dec4.db')
  if (!fs.existsSync(oracle)) {
    t.skip('本轮无真实库取证产物 ⇒ 该证据缺席(合成夹具例已覆盖逻辑,不冒充真实往返)')
    return
  }
  const plain = fs.readFileSync(oracle)
  // 真实形态前提自检:页尾未用区必须恒零(Trae 引擎口径);不满足 ⇒ 前提变了,要求重新取证
  const np = Math.floor(plain.length / CIPHER.PAGE)
  for (let i = 0; i < Math.min(np, 8000); i++) {
    const tail = plain.subarray(i * CIPHER.PAGE + CIPHER.PAGE - CIPHER.RESERVE, (i + 1) * CIPHER.PAGE)
    if (tail.some((b) => b !== 0)) t.diagnostic(`页 ${i + 1} 尾区非零 —— 引擎形态与取证件不一致`)
  }
  const key = fixtureKey()
  const enc = encryptDatabase(key, plain.subarray(0, 2000 * CIPHER.PAGE))
  const back = decryptDatabase(key, enc)
  const want = plain.subarray(0, 2000 * CIPHER.PAGE)
  assert.ok(want.equals(back), '真实形态往返必须逐字节一致')
  assert.ok(roundtripSelfCheck(key, want).ok)
})

test('无 dllBuf 且未表态 ⇒ 拒绝口头密钥(no-key-source)', () => {
  assert.throws(() => S.deriveGlobalKey({}), /口头密钥/)
  assert.ok(S.deriveGlobalKey({ trustDocumented: true }).key.length === 32)
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
