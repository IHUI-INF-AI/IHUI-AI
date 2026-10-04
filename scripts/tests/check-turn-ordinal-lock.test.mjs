// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:check-turn-ordinal-lock(守门 167,turn 序号分配点上锁)
//
// 与源脚本的关系:本文件 `import { __test__ }`(§22d isDirectRun 保证 import 无副作用),
// 不复制判据实现 —— 两份真相是登记在案的漂移源。
// 覆盖面:投影(等长/模板保留/字符串注释遮白)→ 纯判据(真形态放过 ×3 / patrol 形态点名 /
// 防伪 ×3 / 跳过语义 ×3 / 不平衡)→ decide 退出码三态 → 临时仓端到端(--staged 棘轮双向 +
// 全量档只报数)。

import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as gate } from '../check-turn-ordinal-lock.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const SCRIPT = join(ROOT, 'scripts', 'check-turn-ordinal-lock.mjs')

const wrap = (body) => `import { chatMessages } from './schema'\nimport { db } from './db'\n\n${body}`

// 真形态缩略(与 HEAD 三处同构)
const LOCKED_TX =
  'export async function createMessage(input: CMI): Promise<ChatMessage> {\n' +
  '  return db.transaction(async (tx) => {\n' +
  "    await tx.select({ id: chatConversations.id }).from(chatConversations).for('update')\n" +
  '    const turnRows = await tx\n' +
  '      .select({ maxTurn: sql<number | null>`max(${chatMessages.turnOrdinal})` })\n' +
  '      .from(chatMessages)\n' +
  '      .where(eq(chatMessages.conversationId, input.conversationId))\n' +
  '    const rows = await tx.insert(chatMessages).values({ turnOrdinal: 1 })\n' +
  '    return rows[0]\n' +
  '  })\n' +
  '}\n'
const UNLOCKED_PATROL =
  'async function injectAlert() {\n' +
  '  if (status === "issue") {\n' +
  '    try {\n' +
  '      const turnRows = await db\n' +
  '        .select({ maxTurn: sql<number | null>`max(${chatMessages.turnOrdinal})` })\n' +
  '        .from(chatMessages)\n' +
  '      await db.insert(chatMessages).values({ turnOrdinal: 1 })\n' +
  '    } catch (err) {\n' +
  '      log.warn(err)\n' +
  '    }\n' +
  '  }\n' +
  '}\n'
const TX_NO_FOR =
  'async function f() {\n' +
  '  await db.transaction(async (tx) => {\n' +
  "    const turnRows = await tx.select({ m: sql`max(${chatMessages.turnOrdinal})` }).from(chatMessages)\n" +
  '    await tx.insert(chatMessages).values({ turnOrdinal: 1 })\n' +
  '  })\n' +
  '}\n'
const TX_SHARE = TX_NO_FOR.replace(
  'await db.transaction(async (tx) => {',
  "await db.transaction(async (tx) => {\n    await tx.select({ id: c.id }).from(c).for('share')",
)
const DIFF_BODIES =
  'async function readMax() {\n' +
  '  const r = await db.select({ m: sql`max(${chatMessages.turnOrdinal})` }).from(chatMessages)\n' +
  '  return r\n' +
  '}\n' +
  'async function insertMsg() {\n' +
  '  await db.insert(chatMessages).values({ turnOrdinal: 1 })\n' +
  '}\n'
const OBJECT_LITERAL =
  'const impl = {\n' +
  '  async read() {\n' +
  '    return db.select({ m: sql`max(${chatMessages.turnOrdinal})` }).from(chatMessages)\n' +
  '  },\n' +
  '  async write() {\n' +
  '    await db.insert(chatMessages).values({ turnOrdinal: 1 })\n' +
  '  },\n' +
  '}\n'
const REVERSED =
  'async function f() {\n' +
  '  await db.insert(chatMessages).values({ turnOrdinal: 1 })\n' +
  '  const r = await db.select({ m: sql`max(${chatMessages.turnOrdinal})` }).from(chatMessages)\n' +
  '}\n'
const LOCKED_PATCHED = UNLOCKED_PATROL.replace(
  '    try {\n',
  "    try {\n      await db.transaction(async (tx) => {\n        await tx.select({ id: c.id }).from(chatConversations).for('update')\n",
).replace('      await db.insert(chatMessages)', '        await tx.insert(chatMessages)')

test('T1 §22c 锚点:__test__ 必须导出核心判据且 skipEnv 命名在位', () => {
  for (const k of [
    'SELF_SKIP',
    'SCAN_ROOT',
    'maskCommentsKeepTemplates',
    'lineOf',
    'buildBodySpans',
    'deepestCommonBody',
    'bodyPrefix',
    'isBlockishBody',
    'hasLockInRange',
    'judgeSource',
    'inScanRoot',
    'listFace',
    'readFace',
    'decide',
    'analyze',
  ]) {
    assert.ok(k in gate, `__test__ 缺导出:${k}`)
  }
  assert.equal(gate.SELF_SKIP, 'HUSKY_SKIP_TURN_ORDINAL_LOCK')
  assert.equal(gate.SCAN_ROOT, 'apps/api/src/')
})

test('T2 视图B投影:等长、模板原文保留、字符串/注释/正则体遮白', () => {
  const src =
    "import { chatMessages } from './s' // max(${chatMessages.turnOrdinal})\n" +
    'const re = /max\\(/g\n' +
    "const s = 'fake max(${chatMessages.turnOrdinal})'\n" +
    'const t = sql`max(${chatMessages.turnOrdinal})`\n'
  const vb = gate.maskCommentsKeepTemplates(src)
  assert.equal(vb.length, src.length, '投影必须等长(行号直通)')
  assert.ok(vb.includes('max(${chatMessages.turnOrdinal})`'), '模板原文必须保留')
  assert.ok(!vb.includes('fake'), '普通字符串内容必须遮白')
  assert.ok(!vb.includes('// max'), '行注释必须遮白')
  assert.ok(!vb.includes('g\n'.length ? 'max\\(' : ''), '正则体必须遮白')
})

test('T3 正向三形态:事务+.for / 显式事务无 .for / .for(share) 都放过', () => {
  assert.deepEqual(gate.judgeSource(wrap(LOCKED_TX)).reds, [])
  assert.deepEqual(gate.judgeSource(wrap(TX_NO_FOR)).reds, [])
  assert.deepEqual(gate.judgeSource(wrap(TX_SHARE)).reds, [])
  assert.equal(gate.judgeSource(wrap(LOCKED_TX)).pairs.length, 1)
})

test('T4 patrol 形态必红,点名行 = max 所在行', () => {
  const r = gate.judgeSource(wrap(UNLOCKED_PATROL))
  assert.equal(r.reds.length, 1)
  // wrap 前缀 3 行 + 夹具里 max 在第 5 行 ⇒ 全文第 8 行
  assert.equal(r.reds[0].line, 8)
  assert.equal(r.pairs.length, 1)
  assert.equal(r.maxPoints.length, 1)
})

test('T5 防伪:字符串/注释里的伪分配点、非 max 的 turnOrdinal 用法都不可见', () => {
  const inString = wrap("const doc = 'max(${chatMessages.turnOrdinal}) db.insert(chatMessages)'\nconst x = 1\n")
  assert.equal(gate.judgeSource(inString).maxPoints.length, 0)
  const inComment = wrap('// max(${chatMessages.turnOrdinal}) db.insert(chatMessages)\nconst x = 1\n')
  assert.equal(gate.judgeSource(inComment).maxPoints.length, 0)
  const nonMax = wrap(
    'const rows = await db.select().from(chatMessages).where(eq(chatMessages.turnOrdinal, 1))\n' +
      'await db.insert(chatMessages).values({ turnOrdinal: 1 })\n',
  )
  assert.equal(gate.judgeSource(nonMax).maxPoints.length, 0)
})

test('T6 跳过语义:异体 / 对象字面量假体 / insert 先于 max,都不判红', () => {
  assert.equal(gate.judgeSource(wrap(DIFF_BODIES)).skipped.noPair, 1)
  assert.equal(gate.judgeSource(wrap(OBJECT_LITERAL)).skipped.fakeBody, 1)
  assert.equal(gate.judgeSource(wrap(REVERSED)).skipped.noPair, 1)
  assert.equal(gate.judgeSource(wrap(DIFF_BODIES)).reds.length, 0)
})

test('T7 括号不平衡 ⇒ unbalanced(不猜、不记绿)', () => {
  const broken =
    'async function f() {\n' +
    '  const r = await db.select({ m: sql`max(${chatMessages.turnOrdinal})` }).from(chatMessages)\n' +
    '  await db.insert(chatMessages).values({ turnOrdinal: 1 })\n'
  assert.equal(gate.judgeSource(wrap(broken)).unbalanced, true)
})

test('T8 decide 退出码三态:undetermined⇒2 / staged 红⇒1 / 全量红只报数⇒0', () => {
  const judged = new Map([['apps/api/src/services/patrol-scheduler.ts', gate.judgeSource(wrap(UNLOCKED_PATROL))]])
  assert.equal(gate.decide({ perFile: judged, undetermined: [], mode: 'staged' }).exit, 1)
  assert.equal(gate.decide({ perFile: judged, undetermined: [], mode: 'head' }).exit, 0)
  assert.equal(
    gate.decide({ perFile: new Map(), undetermined: ['apps/api/src/db/x.ts'], mode: 'staged' }).exit,
    2,
  )
  const clean = new Map([['apps/api/src/db/chat-queries.ts', gate.judgeSource(wrap(LOCKED_TX))]])
  assert.equal(gate.decide({ perFile: clean, undetermined: [], mode: 'staged' }).exit, 0)
})

test('T9 临时仓端到端:--staged 棘轮双向 + 全量档只报数(§22c 禁止在测试里抄判据)', () => {
  const dir = mkScratch('g818-turnlock-')
  try {
    const git = (args) =>
      // 2026-10-04：不吃的子进程必须给 stdio，否则本机报 spawnSync EBUSY
      spawnSync('git', ['-C', dir, ...args], { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', windowsHide: true, timeout: 60000 })
    assert.equal(git(['init', '-q']).status, 0)
    assert.equal(git(['config', 'user.email', 'gate@example.invalid']).status, 0)
    assert.equal(git(['config', 'user.name', 'gate']).status, 0)
    const rel = join('apps', 'api', 'src', 'services', 'patrol-x.ts')
    mkdirSync(join(dir, 'apps', 'api', 'src', 'services'), { recursive: true })
    const runGate = (args) =>
      spawnSync(process.execPath, [SCRIPT, ...args, '--root', dir], {
        stdio: ['ignore', 'pipe', 'pipe'],
        encoding: 'utf8',
        windowsHide: true,
        timeout: 120000,
      })

    // B1 违规版入索引 ⇒ --staged 判红 rc=1,点名文件
    writeFileSync(join(dir, rel), wrap(UNLOCKED_PATROL))
    assert.equal(git(['add', '-A']).status, 0)
    const red = runGate(['--staged'])
    assert.equal(red.status, 1, `违规版应 rc=1,stdout=${red.stdout} stderr=${red.stderr}`)
    assert.ok(red.stderr.includes(rel.replace(/\\/g, '/')), '红必须点名文件')

    // B2 补锁版替换索引(事务 + 会话行锁)⇒ --staged rc=0
    writeFileSync(join(dir, rel), wrap(LOCKED_PATCHED))
    assert.equal(git(['add', '-A']).status, 0)
    const green = runGate(['--staged'])
    assert.equal(green.status, 0, `补锁版应 rc=0,stdout=${green.stdout} stderr=${green.stderr}`)

    // B3 违规版落 HEAD ⇒ 全量档只报数 rc=0(改到才红,存量一次性判红就是恒红门)
    writeFileSync(join(dir, rel), wrap(UNLOCKED_PATROL))
    assert.equal(git(['add', '-A']).status, 0)
    assert.equal(git(['commit', '-qm', 'patrol unlocked']).status, 0)
    const full = runGate([])
    assert.equal(full.status, 0, `全量档只报数应 rc=0,stdout=${full.stdout} stderr=${full.stderr}`)
    assert.ok(full.stderr.includes('patrol-x.ts'), '存量红必须可见(点名走 stderr,只报数不判死)')
    const fullJson = spawnSync(process.execPath, [SCRIPT, '--json', '--root', dir], {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
    })
    const parsed = JSON.parse(fullJson.stdout)
    assert.equal(parsed.exit, 0)
    assert.equal(parsed.reds.length, 1)
    assert.equal(parsed.reds[0].file, 'apps/api/src/services/patrol-x.ts')
    assert.equal(parsed.mode, 'head')
  } finally {
    rmScratch(dir)
  }
})

test('T10 改动集未触及扫描根 ⇒ 回落全量只报数(与守门 121 同型)', () => {
  const dir = mkScratch('g818-turnlock-fb-')
  try {
    const git = (args) =>
      spawnSync('git', ['-C', dir, ...args], { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', windowsHide: true, timeout: 60000 })
    assert.equal(git(['init', '-q']).status, 0)
    assert.equal(git(['config', 'user.email', 'gate@example.invalid']).status, 0)
    assert.equal(git(['config', 'user.name', 'gate']).status, 0)
    mkdirSync(join(dir, 'apps', 'web', 'src'), { recursive: true })
    writeFileSync(join(dir, 'apps', 'web', 'src', 'page.tsx'), 'export const a = 1\n')
    assert.equal(git(['add', '-A']).status, 0)
    assert.equal(git(['commit', '-qm', 'base']).status, 0)
    const r = spawnSync(process.execPath, [SCRIPT, '--staged', '--json', '--root', dir], {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
    })
    // HEAD 无 apps/api/src 文件 ⇒ 空扫判死(exit 2),绝不静默记绿
    assert.equal(r.status, 2, `空扫应 exit 2,stdout=${r.stdout} stderr=${r.stderr}`)
    assert.ok((r.stderr || '').includes('空扫不记绿'))
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
