// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// DDoS 守卫接线对账的镜像测试(§22c:import 生产判据 __test__，零复制)。
// 立因同 AGENTS §0.9：防线被摘掉时 typecheck / 单测 / build 表现逐字同形，
// 所以"接线还在"这件事必须由本门 + 本锁钉住；本锁又必须住在每次提交都跑的那一层。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { __test__ } from '../check-ddos-guard-wiring.mjs'
import { maskComments } from '../lib/code-mask.mjs'

const {
  evaluateWiring,
  evaluateHookShape,
  isHookScopeViable,
  isChecklistViable,
  pyAnchorInCode,
  anchorPresent,
  GUARD_SOURCES,
  WIRING,
  TERMINAL_HOOKS,
  HOOK_SHAPE_ROOT,
} = __test__

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8')

/** 递归取扫描根内的 .ts(排除测试与声明文件)——与门体 runJudge 的过滤口径一致 */
function listTsUnder(dirRel) {
  const out = []
  for (const e of readdirSync(resolve(ROOT, dirRel), { withFileTypes: true })) {
    if (e.name === '__tests__' || e.name === 'node_modules') continue
    const rel = `${dirRel}/${e.name}`
    if (e.isDirectory()) out.push(...listTsUnder(rel))
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.test.ts') && !e.name.endsWith('.d.ts'))
      out.push(rel)
  }
  return out
}

function faceOfRepo() {
  const files = new Map()
  for (const p of new Set([...GUARD_SOURCES, ...WIRING.map((w) => w.file)])) files.set(p, read(p))
  return files
}

test('真仓工作树面：四道闸全部在位(主判定零缺口)', () => {
  const { gaps } = evaluateWiring({ files: faceOfRepo() })
  assert.deepEqual(gaps, [], `接线缺口：${JSON.stringify(gaps)}`)
})

test('摘掉 register(httpConnGuard) 即翻红(成对夹具：接回即绿)', () => {
  const files = faceOfRepo()
  const key = 'apps/api/src/server.ts'
  const original = files.get(key)
  const mutated = original.replace('server.register(httpConnGuard', '// server.register(httpConnGuard')
  assert.notEqual(mutated, original, '夹具未命中(锚点形态漂了)')
  files.set(key, mutated)
  assert.ok(evaluateWiring({ files }).gaps.length > 0)
  files.set(key, original)
  assert.equal(evaluateWiring({ files }).gaps.length, 0)
})

test('删除 ws-guard 实现文件 ⇒ W1 点名(不是"少扫一个文件就过去")', () => {
  const files = faceOfRepo()
  files.delete('apps/api/src/plugins/ws-guard.ts')
  const gaps = evaluateWiring({ files }).gaps
  assert.ok(gaps.some((g) => g.kind === 'W1' && g.file === 'apps/api/src/plugins/ws-guard.ts'))
})

test('Python：整行 # 注释里的锚点不算接线；真代码行算', () => {
  assert.equal(pyAnchorInCode('# sio_conn_gate.allow_handshake(\n', 'sio_conn_gate.allow_handshake('), false)
  assert.equal(pyAnchorInCode('  x = sio_conn_gate.allow_handshake(ip)\n', 'sio_conn_gate.allow_handshake('), true)
})

test('Python：行尾 # 之后的锚点不算接线', () => {
  assert.equal(
    pyAnchorInCode('pass  # sio_conn_gate.acquire(\n', 'sio_conn_gate.acquire('),
    false,
  )
})

test('JS 面：注释里的锚点不算接线(守门 89 R1 同型)', () => {
  assert.equal(
    anchorPresent('apps/api/src/server.ts', '// await server.register(httpConnGuard)\n', 'server.register(httpConnGuard'),
    false,
  )
  assert.equal(
    anchorPresent('apps/api/src/server.ts', 'await server.register(httpConnGuard)\n', 'server.register(httpConnGuard'),
    true,
  )
})

test('main.py 的挂载行必须被认到(锁住 2026-10-28 那次的遮罩漂移)', () => {
  // JS 词法器扫 .py 会把这行抹成空白 ⇒ 门当场假红。这条锁住"Python 走按行档"这一处置本身。
  const text = read('apps/ai-service/app/main.py')
  assert.ok(anchorPresent('apps/ai-service/app/main.py', text, 'WsConnGuardMiddleware('))
})

test('清单为空/锚点被清空 ⇒ 判不成立(§0.3 判死不记绿)', () => {
  assert.equal(isChecklistViable([], []), false)
  assert.equal(isChecklistViable(GUARD_SOURCES, [{ file: 'x', anchors: [] }]), false)
  assert.equal(isChecklistViable(), true)
})

test('形状锁：本门在 runner 里成套(blocking + skipEnv + 射程齐备)，按 script 名定位而非写死编号', () => {
  // 用"只剥注释、保留字符串"那一档：注册条目要认的东西(id/script/skipEnv 的值)本身就是字符串，
  // 连字符串一起抹的那档会把合规条目读成"没登记"(code-mask 头注记过同型)。
  //
  // 2026-10-29 改按 script 名定位：原先写死 `id: '257'`，而插号把本门推到 258 后这条锁
  // 立刻在 HEAD 面变红(门其实装着)—— 编号是登记序的产物、不是身份；写死它等于把锁
  // 变成"每次有人插号就红一次"的恒红面(§12e)。身份是 script 文件名，编号唯一性另有专锁。
  const runner = maskComments(read('scripts/guardian-runner.mjs'))
  const at = runner.indexOf("script: 'check-ddos-guard-wiring.mjs'")
  assert.ok(at > 0, '本门未登记进 guardian-runner(= 造好没装车)')
  // 注册对象从它自己的 id 行开始，到 onFailHint 为止
  const start = runner.lastIndexOf('id:', at)
  assert.ok(start > 0, '本门注册条目里找不到 id 字段(条目形状坏了)')
  const entry = runner.slice(start, runner.indexOf('onFailHint', at))
  assert.match(entry, /mode: 'blocking'/)
  assert.match(entry, /skipEnv: 'HUSKY_SKIP_DDOS_GUARD_WIRING'/)
  assert.match(entry, /stagedTriggers: \[/)
  // 射程必须覆盖 W4 的扫描根：routes/ 下也能长出终结型钩子，射程窄了就判不到。
  // 用门体导出的常量比对，不在此重写路径(§0.6 —— 写死的那份会跟着扫描根漂移而假绿)。
  assert.ok(
    entry.includes(`'${HOOK_SHAPE_ROOT}/'`),
    `stagedTriggers 未覆盖 W4 扫描根 ${HOOK_SHAPE_ROOT}/ ⇒ 该根内的新违规不会触发本门`,
  )
})

test('形状锁：注册条目 id 不得重复(门 89 R5 同判据，剥注释后数)', () => {
  // 注释里那句 grep 示例("id: '186'")曾被本锁的原文正则读成第二条注册条目 ⇒ 假阳。
  // 数的是**注册对象**，不是文档提到的编号。
  const runner = maskComments(read('scripts/guardian-runner.mjs'))
  const ids = [...runner.matchAll(/^ {2,6}id: '(\d+)'/gm)].map((m) => m[1])
  assert.ok(ids.length > 100, `解析到的注册条目数异常(${ids.length})—— 判据自身坏了，不据此出绿`)
  const dup = ids.filter((v, i) => ids.indexOf(v) !== i)
  assert.deepEqual(dup, [], `重复 id：${dup.join(', ')}`)
  // 本门自己的编号现读现证(不写死)：它必须存在且只存在一次
  const runner2 = maskComments(read('scripts/guardian-runner.mjs'))
  const at = runner2.indexOf("script: 'check-ddos-guard-wiring.mjs'")
  const myId = (runner2.slice(runner2.lastIndexOf('id:', at), at).match(/'(\d+)'/) ?? [])[1]
  assert.ok(myId, '取不到本门自己的 id(条目形状坏了)')
  assert.equal(ids.filter((v) => v === myId).length, 1, `本门 id ${myId} 在注册表里不唯一`)
})

// ───────────────────────── W4 终结型钩子形态(2026-10-29 立) ─────────────────────────

test('W4 真仓现读：扫描根内不得有同步形态的终结型钩子', () => {
  // 取材用工作树(本锁跟着门体跑在提交口，面由门体自己按 --staged/HEAD 判；这里只证现值不成红)
  const files = new Map()
  for (const rel of listTsUnder(HOOK_SHAPE_ROOT)) files.set(rel, read(rel))
  assert.ok(isHookScopeViable([...files.keys()]), '扫描根枚举到 0 个文件(判据自身坏了，不据此记绿)')
  const { gaps, candidates } = evaluateHookShape(files)
  assert.ok(candidates > 0, '一处终结型钩子都没判到 ⇒ 射程或正则失效，不记绿')
  assert.deepEqual(
    gaps.map((g) => `${g.file} ${g.detail}`),
    [],
    '存在会把下游整条链静默冻住的同步钩子',
  )
})

test('W4 变异自证：同一行只差 async 这一个词，红绿必须翻转', () => {
  const sync = new Map([['a.ts', "server.addHook('onResponse', (req, reply) => { void reply })"]])
  const async_ = new Map([
    ['a.ts', "server.addHook('onResponse', async (req, reply) => { void reply })"],
  ])
  assert.equal(evaluateHookShape(sync).gaps.length, 1, '同步形态未翻红 ⇒ 本锁没有牙齿')
  assert.equal(evaluateHookShape(async_).gaps.length, 0, 'async 形态被误判 ⇒ 本锁过头')
})

test('W4 具名处理器跨文件解析：定义在别处的 async 不得被误判，解析不到的一律判红', () => {
  const okPair = new Map([
    ['r.ts', "server.addHook('onResponse', auditOnResponse)"],
    ['_h.ts', 'export const auditOnResponse = async (request) => { void request }'],
  ])
  assert.equal(evaluateHookShape(okPair).gaps.length, 0)
  const dangling = new Map([['r.ts', "server.addHook('onResponse', unseenHandler)"]])
  assert.equal(
    evaluateHookShape(dangling).gaps.length,
    1,
    '解析不到定义就放绿 ⇒ 看不见的那一格正好是事故会待的地方',
  )
})

test('W4 遮噪档位：注释里的注册形态不算命中，字符串里的钩子名必须仍被认得到', () => {
  assert.equal(
    evaluateHookShape(new Map([['a.ts', "// addHook('onResponse', (req) => { void req })"]])).gaps
      .length,
    0,
    '注释被当成代码命中 ⇒ 假阳',
  )
  assert.equal(
    evaluateHookShape(new Map([['a.ts', "server.addHook('onRequestAbort', (req) => {})"]])).gaps
      .length,
    1,
    '钩子名字符串被抹掉 ⇒ W4 静默失效(遮错档)'
  )
})

test('W4 射程清单：TERMINAL_HOOKS 必须含 onResponse/onRequestAbort/onTimeout', () => {
  for (const h of ['onResponse', 'onRequestAbort', 'onTimeout']) {
    assert.ok(TERMINAL_HOOKS.includes(h), `射程缺 ${h}`)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
