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
const {
  createCarryJournal,
  newRunId,
  checkUidLeftovers,
  scanOtherUidTables,
  leftoverKeys,
  describeServerHistoryInfo,
  atomicBackupAndWrite,
} = C.__test__

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

// ── 备份日志(2026-11-10 实测 5 缺陷的锁)──────────────────────────────────────
// 现场:一次真实对话随行(9520→5203)把 User/globalStorage/state.vscdb(8 处键撞车删旧)
// 与 workspaceStorage\*\state.vscdb(2 处)原地改写,而 fail() 的 backups[] 里只有
// storage.json 与 database.db ⇒ vscdb 写坏只能靠外部手拍 + SQLite 自带 .backup 救回。
// 下面四条分别锁:入账能回滚、改名能删新名、残留能抓到、runId 不互相覆盖。
test('journal①: vscdb 写前入账,真改之后能整组还原(键 + 伴生 -wal 一起)', () => {
  const scratch = mkScratch('carry-journal-vscdb')
  const userData = path.join(scratch, 'Trae CN')
  const file = path.join(userData, 'User', 'globalStorage', 'state.vscdb')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const db = new DatabaseSync(file)
  db.exec('CREATE TABLE ItemTable(key TEXT PRIMARY KEY, value BLOB)')
  const ins = db.prepare('INSERT INTO ItemTable(key,value) VALUES(?,?)')
  ins.run(`${OLD}:a`, 'old-a')
  ins.run(`${NEW}:b`, 'new-b')
  db.close()
  const before = fs.readFileSync(file)

  const journal = createCarryJournal({ backupRoot: path.join(userData, 'carry-backups'), root: userData })
  const bak = journal.backup(file)
  assert.ok(bak && bak.startsWith(journal.dir), `备份必须落进 carry-backups/<runId>/,实际:${bak}`)
  assert.match(path.basename(bak), /globalStorage__state\.vscdb$/) // 相对路径展平,不撞同名
  assert.equal(journal.count(), 1)
  assert.deepEqual(journal.backupPaths(), [bak])

  const out = rebindVscdb(file, OLD, NEW) // 真改:OLD:a → NEW:a
  assert.equal(out.renamed, 1)
  assert.equal(out.leftoverOldKeys, 0, '改完必须自证没有旧 uid 键残留')
  // 模拟 SQLite 在途帧:备份时不存在 ⇒ 回滚必须删掉,否则"还原主库 + 留一截新 WAL"= 坏库
  fs.writeFileSync(`${file}-wal`, 'stale-frames')

  const res = journal.restore()
  assert.deepEqual(fs.readFileSync(file), before, '主文件必须逐字节回到切前')
  assert.equal(fs.existsSync(`${file}-wal`), false, '备份时没有的伴生文件,回滚要删掉')
  assert.deepEqual(res.restored, [file])
  assert.ok(res.removed.includes(`${file}-wal`))
  rmScratch(scratch)
})

test('journal②: tips 回滚 —— 旧名内容还原,且我们造出的新名必须不存在(缺陷 3)', () => {
  const scratch = mkScratch('carry-journal-tips')
  const userData = path.join(scratch, 'Trae CN')
  const dir = path.join(userData, 'conversation-tips')
  fs.mkdirSync(dir, { recursive: true })
  const from = path.join(dir, `CN.${OLD}.abc.json`)
  const to = path.join(dir, `CN.${NEW}.abc.json`)
  fs.writeFileSync(from, '{"n":1}')

  const j1 = createCarryJournal({ backupRoot: path.join(userData, 'carry-backups'), root: userData })
  j1.backup(from)
  j1.recordRename(from, to, { preExisted: false })
  assert.deepEqual(j1.renames(), [{ from, to, preExisted: false }], '改名的 from→to 必须入账,回滚才有依据')
  fs.renameSync(from, to)
  assert.equal(fs.existsSync(from), false)
  j1.restore()
  assert.equal(fs.readFileSync(from, 'utf8'), '{"n":1}', '旧名内容必须还原')
  assert.equal(fs.existsSync(to), false, '回滚后新名副本不得残留(本机 .pre-carry.bak 同类现场)')

  // 边界:新名在切前就存在(上一轮遗留)⇒ 不许删,且要还原成切前内容
  fs.writeFileSync(from, '{"n":2}')
  fs.writeFileSync(to, '{"was":"there"}')
  const j2 = createCarryJournal({ backupRoot: path.join(userData, 'carry-backups'), root: userData })
  j2.backup(from)
  j2.backup(to)
  j2.recordRename(from, to, { preExisted: true })
  fs.renameSync(from, to)
  j2.restore()
  assert.equal(fs.readFileSync(to, 'utf8'), '{"was":"there"}', '新名切前就有 ⇒ 还原它,不得删')
  assert.equal(fs.readFileSync(from, 'utf8'), '{"n":2}')
  rmScratch(scratch)
})

test('journal③: runId 目录隔离 —— 同一文件跑两次,第一轮写前态不被覆盖(缺陷 2)', () => {
  const scratch = mkScratch('carry-journal-runs')
  const file = path.join(scratch, 'storage.json')
  const root = path.join(scratch, 'carry-backups')
  fs.writeFileSync(file, 'v1')
  const j1 = createCarryJournal({ backupRoot: root, root: scratch })
  const b1 = j1.backup(file)
  fs.writeFileSync(file, 'v2')
  const j2 = createCarryJournal({ backupRoot: root, root: scratch })
  const b2 = j2.backup(file)
  assert.notEqual(j1.runId, j2.runId, '同毫秒两轮也要给出不同 runId')
  assert.notEqual(b1, b2)
  assert.equal(fs.readFileSync(b1, 'utf8'), 'v1', '第一轮备份绝不能被第二轮顶掉')
  assert.equal(fs.readFileSync(b2, 'utf8'), 'v2')

  // 同一轮里重复入账 = 幂等:不得拿"已改过的现状"覆盖写前态
  fs.writeFileSync(file, 'v3')
  assert.equal(j2.backup(file), b2)
  assert.equal(fs.readFileSync(b2, 'utf8'), 'v2')

  j2.restore()
  assert.equal(fs.readFileSync(file, 'utf8'), 'v2', '各轮只回退各自那一步')

  // 显式 backupPath 时不再落固定后缀(老 .pre-carry.bak 就是这么套娃出来的)
  atomicBackupAndWrite(file, Buffer.from('v4'), { backupPath: b2 })
  assert.equal(fs.readFileSync(file, 'utf8'), 'v4')
  assert.equal(fs.existsSync(`${file}.pre-carry.bak`), false)
  // runId 形状 = ISO(文件系统安全)+ 序号;同毫秒两次也必须不同
  assert.match(newRunId(0), /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-\d+$/)
  assert.notEqual(newRunId(0), newRunId(0))
  rmScratch(scratch)
})

test('残留断言: uidCols 有非空值的表旧 uid 行必须为 0;全 NULL 表按判据跳过', () => {
  const scratch = mkScratch('carry-leftover')
  const file = path.join(scratch, 'plain.db')
  const db = new DatabaseSync(file)
  db.exec('CREATE TABLE project(id INTEGER PRIMARY KEY, user_id TEXT)')
  db.exec('CREATE TABLE user_configuration(id INTEGER PRIMARY KEY, user_id TEXT)')
  db.exec('CREATE TABLE server_history_info(history_id INTEGER PRIMARY KEY, user_id TEXT)')
  db.exec('CREATE TABLE model_config_cache(id INTEGER PRIMARY KEY, user_id TEXT)')
  db.prepare('INSERT INTO project(user_id) VALUES(?)').run(OLD)
  db.prepare('INSERT INTO user_configuration(user_id) VALUES(?)').run(OLD)
  db.prepare('INSERT INTO server_history_info(user_id) VALUES(?)').run(null) // 本机形态:全 NULL
  db.prepare('INSERT INTO model_config_cache(user_id) VALUES(?)').run(OLD)

  const pre = checkUidLeftovers(db, OLD)
  assert.deepEqual(pre.leftovers.map((l) => l.table).sort(), ['project', 'user_configuration'])
  assert.equal(pre.checked.find((c) => c.table === 'server_history_info').skipped, 'all-null')
  assert.equal(pre.checked.find((c) => c.table === 'chat_session').skipped, 'no-column')
  // uidCols 之外的旧号只报不改,但必须报出来(本机实读 model_config_cache 仍有 7 行旧号)
  assert.deepEqual(scanOtherUidTables(db, OLD), [{ table: 'model_config_cache', column: 'user_id', leftover: 1 }])

  rebindDatabase(db, OLD, NEW)
  assert.deepEqual(checkUidLeftovers(db, OLD).leftovers, [], '归一之后旧 uid 行必须为 0')

  const shi = describeServerHistoryInfo(db)
  assert.equal(shi.decision, 'left-untouched', '全 NULL ⇒ 判定为客户端从不填写,保持不动')
  assert.ok(shi.evidence.length >= 3, '判定必须带依据,不许只有结论')
  db.close()

  // vscdb 键面同判:改完仍含旧 uid(且不是我们造出来的)⇒ 残留
  assert.deepEqual(leftoverKeys([`${OLD}:a`, `${NEW}:b`, 'plain'], OLD, new Set([`${NEW}:b`])), [`${OLD}:a`])
  assert.deepEqual(
    leftoverKeys([`${NEW}:a`], OLD, new Set([`${NEW}:a`])),
    [],
    '我们自己造出来的键不算残留(新 uid 含旧 uid 子串的号段巧合)',
  )
  rmScratch(scratch)
})

test('接线锁: 编排层把 vscdb/正库/storage/tips 全部写前入账,失败走 journal.restore', () => {
  const src = fs.readFileSync(path.resolve(HERE, '../../apps/api/scripts/relay-trae-chat-switch.ts'), 'utf8')
  assert.match(src, /carry\.createCarryJournal\(/)
  assert.match(src, /journal\.restore\(\)/)
  assert.match(src, /backups: journal\.backupPaths\(\)/, 'report.rollback.backups 仍是路径字符串数组')
  assert.equal(src.includes('${from}.pre-carry.bak'), false, '固定后缀已被 runId 目录取代')
  assert.equal(/backupDir:/.test(src), false, '正库备份不得再走孤立 backupDir(缺陷 4:失败时救不回来)')
  assert.match(src, /journal\.backup\(storageFile\)/)
  assert.match(src, /rebindAgentDbFile\(dbFile, \{[\s\S]{0,400}?journal,/, '正库调用必须把 journal 传下去')
  // 缺陷 5 的证据面:残留断言不能只活在 lib 里,报告要带 server_history_info 的判定与依据
  assert.match(src, /report\.serverHistoryInfoUserId = res\.serverHistoryInfo/)
  assert.match(src, /assert-no-leftover-uid/)
  assert.match(src, /abort-leftover-uid/)

  let idx = 0
  let seen = 0
  while ((idx = src.indexOf('carry.rebindVscdb(', idx)) !== -1) {
    const head = src.slice(Math.max(0, idx - 400), idx)
    assert.match(head, /journal\.backup\(/, `第 ${seen + 1} 个 rebindVscdb 调用点之前没入账(缺陷 1 复发)`)
    seen += 1
    idx += 1
  }
  assert.equal(seen, 2, 'global 与 workspace 两条 rebindVscdb 都必须有写前备份')
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

