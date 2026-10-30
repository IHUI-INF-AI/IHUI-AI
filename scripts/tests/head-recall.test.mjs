// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// HEAD 面回捞判据 + 兜底清扫器 镜像(§22c:import 生产判据 __test__,零复制;测试里不写第二份尺子)。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const LIB_PATH = resolve(HERE, '..', 'lib', 'head-recall.mjs')
const SWEEP_PATH = resolve(HERE, '..', 'strip-head-recall-rows.mjs')
const LIB = readFileSync(LIB_PATH, 'utf8')
const SWEEP = readFileSync(SWEEP_PATH, 'utf8')

const { __test__ } = await import(import.meta.resolve('../lib/head-recall.mjs'))
const sweepMod = await import(import.meta.resolve('../strip-head-recall-rows.mjs'))
const idx = await import(import.meta.resolve('../lib/plan-task-index.mjs'))
const scrub = await import(import.meta.resolve('../scrub-declared-removals.mjs'))

const R_DROPPED = '- [ ] G-901 已被摘除的回捞件'
const R_LIVE = '- [ ] G-902 真活,没被谁处置过'
const R_CLAIMED = '- [ ]（进行中@2026-10-30/在飞席） G-903 台账里有但它还在飞'

const declaredFixture = (rows) => ({
  filesSeen: 2,
  dropTitleFps: new Set(),
  dropTitleRows: new Map([['__fp__', rows]]),
  set: new Set(rows),
})

test('M1 判据单源:面/主键/牌/指纹四把尺全部 import,lib 里不得有第二份', () => {
  assert.match(LIB, /from '\.\/plan-task-index\.mjs'/, '面与主键应取 plan-task-index 单源')
  assert.match(
    LIB,
    /from '\.\.\/scrub-declared-removals\.mjs'/,
    '题面指纹应取 scrub 的 titleFpOf 单源',
  )
  for (const name of ['function titleFpOf', 'function parseTaskRows', 'function compositeKeyOf'])
    assert.ok(!LIB.includes(name), `lib 里出现了第二份 ${name} ⇒ 判据复制(§22c)`)
})

test('M2 台账取不到 ⇒ 未判定,既不记绿也不冒红(§0.3)', () => {
  const r = __test__.recallRowsOf(`# 计划\n${R_DROPPED}\n`, { filesSeen: 0 })
  assert.equal(r.undetermined, true)
  assert.equal(r.rows.length, 0)
  assert.match(r.why, /摘除台账取不到/)
  const emptyFace = __test__.recallRowsOf('', declaredFixture([R_DROPPED]))
  assert.equal(emptyFace.undetermined, true, '面取不到同样不得判成"干净"')
})

test('M3 逐字命中 ⇒ 进候选;同文两副本都进(不靠第二把尺)', () => {
  const r = __test__.recallRowsOf(
    `# 计划\n${R_LIVE}\n${R_DROPPED}\n${R_DROPPED}\n`,
    declaredFixture([R_DROPPED]),
  )
  assert.equal(r.undetermined, false)
  assert.equal(r.rows.length, 2, '两枚逐字相同的回捞件都该点到')
  assert.ok(r.rows.every((x) => x.via === 'verbatim'))
  assert.equal(r.held.length, 0, '同文副本之间不得互判"他行在册"')
})

test('M4 带活跃认领牌 ⇒ 让路(摘牌权归席位自己)', () => {
  const r = __test__.recallRowsOf(`# 计划\n${R_CLAIMED}\n`, declaredFixture([R_CLAIMED]))
  assert.equal(r.rows.length, 0, '在飞的席位不许被代摘')
  assert.equal(r.held.length, 1)
  assert.match(r.held[0].why, /活跃认领牌/)
})

test('M5 同复合主键另有非候选行 ⇒ 让路;两枚同题都被声明删除时不互为"他行"', () => {
  const twin = `${R_DROPPED}（续做批）`
  const sameKey = idx.compositeKeyOf(R_DROPPED) === idx.compositeKeyOf(twin)
  const oneDropped = __test__.recallRowsOf(
    `# 计划\n${R_DROPPED}\n${twin}\n`,
    declaredFixture([R_DROPPED]),
  )
  const bothDropped = __test__.recallRowsOf(
    `# 计划\n${R_DROPPED}\n${twin}\n`,
    declaredFixture([R_DROPPED, twin]),
  )
  if (sameKey) {
    assert.equal(oneDropped.held.length, 1, '同主键他行在册必须让路')
    assert.equal(oneDropped.rows.length, 0)
    assert.equal(bothDropped.rows.length, 2, '两枚都在台账 ⇒ 都进候选')
  } else {
    assert.equal(oneDropped.rows.length, 1, '主键不同形时不该触发让路')
    assert.equal(oneDropped.held.length, 0)
  }
})

test('M6 与 scrub() 的分工可证:同一枚行 scrub 因"HEAD 面有此行"结构上扣不动,本器判它是候选', () => {
  const face = `# 计划\n${R_DROPPED}\n`
  const declared = declaredFixture([R_DROPPED])
  // scrub 的维一要求 HEAD 面无此行(它服务的是"收编器带回盘上滞后副本"那一型)
  const s = scrub.scrub(face, face, declared)
  assert.equal(s.dropped.length, 0, '前提:scrub 在"污染就在 HEAD 面上"时恒 0 扣(这正是缺的那一格)')
  const r = __test__.recallRowsOf(face, declared)
  assert.equal(r.rows.length, 1, '本器补的正是这一型')
})

test('M7 pairs 形状必须是 live-doc-edit 删除档接受的形态', () => {
  const r = __test__.recallRowsOf(
    `# 计划\n${R_DROPPED}\n${R_DROPPED}\n`,
    declaredFixture([R_DROPPED]),
  )
  const pairs = sweepMod.__test__.dropPairsOf(r.rows)
  assert.equal(pairs.length, 1, '同文两枚必须折成一项(重复 before 会被改写闸拒)')
  for (const p of pairs) {
    assert.equal(p.drop, true)
    assert.equal(p.after, null)
    assert.equal(p.all, true)
    assert.ok(!p.before.includes('\n'), '本档只作整行替换')
  }
  const befores = pairs.map((p) => p.before)
  assert.equal(new Set(befores).size, befores.length, 'before 不得重复')
})

test('M8 落地通道唯一:只走 live-doc-edit 删除档,推送腿自带', () => {
  assert.match(SWEEP, /live-doc-edit\.mjs/, '落地必须走正牌写盘闸')
  for (const envName of ['LIVE_DOC', 'LIVE_MSG', 'LIVE_SEAT', 'LIVE_REPLACE_FILE'])
    assert.ok(SWEEP.includes(envName), `缺 env ${envName} ⇒ 改写档拿不到声明`)
  assert.match(
    SWEEP,
    /git-push-guard\.mjs/,
    '旁路落地不跑 post-commit ⇒ 推送腿必须自带(§5b 回潮通道①)',
  )
  assert.ok(!SWEEP.includes('LAND_REMOVE_PATHS'), '不该另开一份 object-space-land 手写落地')
})

test('M9 结论态词表双向锁(源码产出的态 == 词表登记的态)', () => {
  const used = [...new Set([...SWEEP.matchAll(/state:\s*'([a-z-]+)'/g)].map((m) => m[1]))]
  const declaredList = sweepMod.__test__.SWEEP_STATES.split('|')
  assert.ok(used.length >= 6, `应至少量到 6 个态(实测 ${used.length} ⇒ 尺子自身失效)`)
  for (const s of used) assert.ok(declaredList.includes(s), `态 "${s}" 不在词表里`)
  for (const s of declaredList) assert.ok(used.includes(s), `词表里的 "${s}" 没有产出点 ⇒ 腐烂条目`)
})

test('M10 留痕排在落地成功之后,且以"面上真没了"为凭据(不拿退出码当凭据)', () => {
  const atRefused = SWEEP.indexOf("state: 'refused'")
  const atLog = SWEEP.indexOf('留痕由 live-doc-edit')
  assert.ok(atRefused > 0 && atLog > atRefused, '落地未成必须先于"已写留痕"返回')
  assert.match(SWEEP, /面上仍有/, '归因要量"面上还剩几枚",不是只看退出码')
  assert.doesNotThrow(() => sweepMod.__test__.selfTest, '自检器必须可 import')
})

test('M11 真台账 + 真 HEAD 面端到端:判得出条数(读数随并发浮动,不断言具体值)', async () => {
  // 派生 git 一律走 face-reader 的 gitRaw(本仓裸 git 债务账只减不增,新触点必须走层)
  const fr = await import(import.meta.resolve('../lib/face-reader.mjs'))
  const face = fr.gitRaw(['show', 'HEAD:PROJECT_PLAN.md'], resolve(HERE, '..', '..'), {
    maxBuffer: 1 << 26,
  })
  const declared = scrub.declaredRows()
  const r = __test__.recallRowsOf(face, declared)
  assert.equal(r.undetermined, false, `真台账应判得出(why=${r.why})`)
  assert.ok(Number.isInteger(r.rows.length) && Number.isInteger(r.held.length))
  for (const row of r.rows.slice(0, 20)) {
    assert.equal(idx.claimMarkOf(row.raw), null, `候选里混进了带牌行 L${row.line}`)
  }
})

// ── 接线面(§0.9「判据必须在真跑它的那一刻才成立」:写了没装车 = 没有)──────────────
test('W1 派发层三处齐备:函数体 + 巡检轮调用点 + __test__ 导出(注释剥掉后再判)', async () => {
  const guardian = readFileSync(resolve(HERE, '..', 'git-guardian.mjs'), 'utf8')
  const code = guardian.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  assert.match(code, /export function sweepHeadRecallRows\(/, '派发函数体不得缺席')
  assert.match(code, /if \(!CHECK_ONLY\) sweepHeadRecallRows\(\)/, '巡检轮调用点不得缺席')
  assert.match(code, /^\s*sweepHeadRecallRows,$/m, '__test__ 导出条目不得缺席(外部问责靠它反查)')
})

test('W2 提交链注册成套:blocking + skipEnv + stagedTriggers 三样缺一即假接线', () => {
  const runner = readFileSync(resolve(HERE, '..', 'guardian-runner.mjs'), 'utf8')
  const entry = runner.match(/id:\s*'268',[\s\S]*?\n {2}\}/)
  assert.ok(entry, 'runner 里找不到 id 268 的注册条目 ⇒ 门体从未被任何通道执行')
  const body = entry[0]
  assert.match(body, /script:\s*'check-head-recall-stock\.mjs'/)
  assert.match(body, /mode:\s*'blocking'/, 'warn 档的"根治"等于没根治')
  assert.match(
    body,
    /skipEnv:\s*'HUSKY_SKIP_HEAD_RECALL_STOCK'/,
    'blocking 必须成套带应急出口(§0.8)',
  )
  assert.match(
    body,
    /stagedTriggers:\s*\[[^\]]*PROJECT_PLAN\.md/,
    '缺射程 ⇒ 落地通道读成"永不复跑"(守门 253)',
  )
  assert.equal(
    [...runner.matchAll(/id:\s*'268'/g)].length,
    1,
    '同一 id 注册两门(守门 89 R5)—— 后写的会静默覆盖前写的',
  )
})

test('W3 本席注册对象形状:一个对象只许一个 id:/script:,脚本名全表唯一(89 R13/R5 同型反查)', () => {
  const runner = readFileSync(resolve(HERE, '..', 'guardian-runner.mjs'), 'utf8')
  const at = runner.indexOf("id: '268'")
  assert.ok(at > 0, '找不到 268 的注册起点')
  const obj = runner.slice(runner.lastIndexOf('\n  {', at), runner.indexOf('\n  },', at))
  assert.equal((obj.match(/id:\s*'/g) || []).length, 1, '同一注册对象里两个 id ⇒ 后写的覆盖前写的')
  assert.equal(
    (obj.match(/script:\s*'/g) || []).length,
    1,
    '同一注册对象里两个 script ⇒ 被吞的那道静默消失',
  )
  assert.equal(
    [...runner.matchAll(/script:\s*'check-head-recall-stock\.mjs'/g)].length,
    1,
    '同一脚本被两道门注册 ⇒ 一号两门',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
