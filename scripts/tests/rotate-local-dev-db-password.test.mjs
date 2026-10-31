// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票 O68 登记出口(`--register`)的镜像测试(2026-11-01 立)。
 * 判据单源 = ../rotate-local-dev-db-password.mjs 的 `__test__`(§22c:本文件不重写任何判定)。
 * 形状兼容钉的是 guardian 侧真读取腿 `sweepLocalDevDbRotation` —— **只 import,不修改它**。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

import { __test__ as R } from '../rotate-local-dev-db-password.mjs'
import { sweepLocalDevDbRotation } from '../git-guardian.mjs'
import { mkScratch } from '../lib/scratch-dir.mjs'

const FP_A = 'a1b2c3d4e5f6' // 12 位 hex,sha12 同形(测试用指纹,不含任何真凭据)
const FP_B = '0f1e2d3c4b5a6978'
const SRC = 'O68:口令前缀曾进会话(本机 dev 库,2026-10-31 主会话 grep 事故)'
const NOW = new Date('2026-11-01T01:10:00.000Z')

function regAt(dir) {
  return join(dir, 'dev-db-rotation-pending.json')
}

test('正常登记 ⇒ 文件生成、字段齐全、只含 fp 与出处(不含任何值形态)', () => {
  const dir = mkScratch('o68-reg-')
  const file = regAt(dir)
  const logs = []
  const rc = R.register({ fp: FP_A, source: SRC, pendingFile: file, now: NOW, logger: (m) => logs.push(m) })
  assert.equal(rc, 0)
  assert.ok(existsSync(file), '登记面必须被创建(此前全仓无创建出口 = 本票立因)')
  const parsed = JSON.parse(readFileSync(file, 'utf8'))
  assert.ok(Array.isArray(parsed), '规范形态 = 条目数组')
  assert.equal(parsed.length, 1)
  const e = parsed[0]
  assert.equal(e.fp, FP_A)
  assert.equal(e.key, 'DATABASE_URL')
  assert.equal(e.source, SRC)
  assert.equal(e.registeredAt, NOW.toISOString())
  assert.equal(e.expires, undefined, '未给 --expires 不落该字段')
  assert.match(logs.join('\n'), /已登记/)
})

test('重复登记同 fp ⇒ 幂等条数不涨;成对正向对照:不同 fp 会加一条', () => {
  const dir = mkScratch('o68-idem-')
  const file = regAt(dir)
  const logs = []
  const lg = (m) => logs.push(m)
  assert.equal(R.register({ fp: FP_A, source: SRC, pendingFile: file, now: NOW, logger: lg }), 0)
  assert.equal(R.register({ fp: FP_A, source: SRC, pendingFile: file, now: NOW, logger: lg }), 0)
  assert.equal(R.readPendingState(file).entries.length, 1, '同 fp 二次登记绝不产生第二条')
  assert.match(logs.at(-1), /幂等/)
  // 正向对照:换个 fp 必须真加一条(证明幂等不是"永不写")
  assert.equal(R.register({ fp: FP_B, source: `${SRC} · 对照第二枚`, pendingFile: file, now: NOW, logger: lg }), 0)
  assert.equal(R.readPendingState(file).entries.length, 2)
})

test('坏输入 ⇒ 拒写并点名原因,且原文件一字节未动(先写好一笔,再喂坏的)', () => {
  const dir = mkScratch('o68-reject-')
  const file = regAt(dir)
  assert.equal(R.register({ fp: FP_A, source: SRC, pendingFile: file, now: NOW, logger: () => {} }), 0)
  const before = readFileSync(file, 'utf8')
  const cases = [
    [{ fp: 'abc123', source: SRC }, /--fp 形态不合法/], // 短 fp(6<8)
    [{ fp: 'ZZZZZZZZZZZZ', source: SRC }, /--fp 形态不合法/], // 非 hex
    [{ fp: FP_A, source: '' }, /缺 --source/], // 空 source
    [{ fp: FP_A, source: '太短了' }, /--source 过短/], // 过短 source
    [{ fp: FP_A, source: 'postgres://u:p%40ss@localhost:5432/ihui' }, /--source 拒收/], // URL/DSN 形
    [{ fp: FP_A, source: 'DATABASE_URL=postgres://x' }, /--source 拒收/], // key=value 连接串形
    [{ fp: 'dGhpc0lzQVN1c3BpY291c1Rva2Vu', source: SRC }, /--fp 形态不合法/], // base64 塞进 fp 位(非 hex)
    [{ fp: FP_A, source: SRC, expires: '2026-13-99' }, /--expires/], // 非法日期
  ]
  for (const [input, re] of cases) {
    const logs = []
    assert.equal(R.register({ ...input, pendingFile: file, now: NOW, logger: (m) => logs.push(m) }), 2, `应拒: ${JSON.stringify(Object.keys(input))}`)
    assert.match(logs.join('\n'), re, `点名原因缺失: ${logs.join('|')}`)
    assert.equal(readFileSync(file, 'utf8'), before, '拒收路径绝不允许碰登记面一字节')
  }
})

test('登记面坏(JSON 烂/空)⇒ 未判定且原字节保留,不静默洗面', () => {
  const dir = mkScratch('o68-corrupt-')
  const file = regAt(dir)
  writeFileSync(file, '{"这": "不是合法条目面', 'utf8')
  const before = readFileSync(file, 'utf8')
  const logs = []
  assert.equal(R.register({ fp: FP_A, source: SRC, pendingFile: file, logger: (m) => logs.push(m) }), 2)
  assert.match(logs.join('\n'), /未判定/)
  assert.equal(readFileSync(file, 'utf8'), before)
})

test('stdout 脱敏:输出面只出键名+fp+出处,任何疑似凭据片段都不出现', () => {
  const dir = mkScratch('o68-mask-')
  const file = regAt(dir)
  const out = []
  R.register({ fp: FP_A, source: SRC, pendingFile: file, logger: (m) => out.push(m) })
  // 同 fp 幂等 + 坏输入各再来一笔,输出面一并核
  R.register({ fp: FP_A, source: SRC, pendingFile: file, logger: (m) => out.push(m) })
  R.register({ fp: 'BAD FP HERE=secret', source: 'x', pendingFile: file, logger: (m) => out.push(m) })
  const all = out.join('\n')
  assert.ok(!/:\/\//.test(all), '输出不得含 URL/DSN 形态')
  assert.ok(!all.includes('@'), '输出不得含 userinfo 形态')
  assert.ok(!all.includes('secret'), '喂进去的可疑值绝不允许被回显')
  assert.ok(!all.includes('BAD FP HERE'), '非法 fp 原文绝不回显(错误只报形态与长度)')
  assert.match(all, /fp=a1b2c3d4e5f6/, '合法登记读数 = 指纹 + 出处,原样可见')
  assert.match(all, /DATABASE_URL/, '点名到键名')
})

test('派发侧形状兼容:register 写出的账能被 guardian 真读取腿解析成"有欠账"(只 import 不改它)', () => {
  const dir = mkScratch('o68-shape-')
  const pendingFile = regAt(dir)
  const tickFile = join(dir, 'dev-db-rotation-last.json')
  assert.equal(R.register({ fp: FP_A, source: SRC, pendingFile, logger: () => {} }), 0)
  // 窗口注入"活服务在场" ⇒ 必然零派生;能落到 window-busy 而非 pending-unreadable/no-pending,
  // 即证明本器写的数组形态被派发腿读成了"存在未结清条目"。
  const logsBusy = []
  const busy = sweepLocalDevDbRotation({
    pendingFile,
    tickFile,
    now: Date.now(),
    logger: (m) => logsBusy.push(m),
    livePortsProbe: () => [8801],
  })
  assert.equal(busy.spawned, false, '活服务在场绝不派生')
  assert.equal(busy.state, 'window-busy', `登记面必须被读成有欠账,实得=${busy.state}`)
  // 负对照:登记面不在位 ⇒ no-pending(零派生),证明上面的 window-busy 不是无条件态
  const logsEmpty = []
  const none = sweepLocalDevDbRotation({
    pendingFile: join(dir, 'no-such-pending.json'),
    tickFile: join(dir, 'tick2.json'),
    now: Date.now(),
    logger: (m) => logsEmpty.push(m),
    livePortsProbe: () => [8801],
  })
  assert.equal(none.state, 'no-pending')
  assert.equal(none.spawned, false)
})

test('旧人工手写形({reason,registeredAt})⇒ 归一可读、source 取 reason、重归一不丢交代', () => {
  const dir = mkScratch('o68-legacy-')
  const file = regAt(dir)
  writeFileSync(file, JSON.stringify({ reason: SRC, registeredAt: '2026-11-01T00:00:00.000Z' }), 'utf8')
  const st = R.readPendingState(file)
  assert.equal(st.state, 'ok')
  assert.equal(st.entries.length, 1)
  assert.equal(st.entries[0].source, SRC)
  assert.equal(st.entries[0].fp, '', '手写形没有 fp ⇒ 归一为空 fp,verifyRegistered 会点名而非记结清')
  // 再登记一枚真 fp:旧交代被保留在同一份规范文件里
  assert.equal(R.register({ fp: FP_A, source: SRC, pendingFile: file, now: NOW, logger: () => {} }), 0)
  const after = R.readPendingState(file)
  assert.equal(after.state, 'ok')
  assert.equal(after.entries.length, 2)
  assert.equal(after.entries[0].source, SRC)
})

test('--verify-registered 只读复算:命中现值 ⇒ 1(欠账还在);全部不命中 ⇒ 0;坏账 ⇒ 2', () => {
  const dir = mkScratch('o68-verify-')
  const root = join(dir, 'repo')
  mkdirRootWithEnv(root, 'postgres://ihui_user:secretA@localhost:5432/ihui')
  const file = regAt(dir)
  const fpNow = hashPw('secretA')
  const logs = []
  const lg = (m) => logs.push(m)
  // 登记的正是当前住在文件里的值 ⇒ 欠账还在
  R.register({ fp: fpNow, source: SRC, pendingFile: file, logger: () => {} })
  assert.equal(R.verifyRegistered({ pendingFile: file, root, logger: lg }), 1)
  assert.match(logs.join('\n'), /欠账还在/)
  // 换掉文件值 ⇒ 文件面复算通过(结清仍留给 --apply 留痕,读数里点名)
  mkdirRootWithEnv(root, 'postgres://ihui_user:secretB@localhost:5432/ihui')
  const logs2 = []
  assert.equal(R.verifyRegistered({ pendingFile: file, root, logger: (m) => logs2.push(m) }), 0)
  assert.match(logs2.join('\n'), /文件面复算/)
  assert.ok(!logs2.join('\n').includes('secret'), '复算输出绝不回显口令(即便夹具里是假值)')
  // 无账 ⇒ 0;坏账 ⇒ 2
  const none = R.verifyRegistered({ pendingFile: join(dir, 'nope.json'), root, logger: () => {} })
  assert.equal(none, 0)
  writeFileSync(file, '{坏 JSON', 'utf8')
  assert.equal(R.verifyRegistered({ pendingFile: file, root, logger: () => {} }), 2)
})

// ===== 夹具:scratch 内假 repo 根(不落真仓、不碰真 .env) =====
function hashPw(pw) {
  return createHash('sha256').update(pw).digest('hex').slice(0, 12)
}
function mkdirRootWithEnv(root, dsn) {
  mkdirSync(join(root, 'apps', 'api'), { recursive: true })
  mkdirSync(join(root, 'apps', 'ai-service'), { recursive: true })
  writeFileSync(join(root, '.env'), `DATABASE_URL=${dsn}\n`, 'utf8')
  writeFileSync(join(root, 'apps', 'api', '.env'), `DATABASE_URL="${dsn}"\n`, 'utf8')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
