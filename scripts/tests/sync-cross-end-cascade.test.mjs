// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 跨端级联编排器的镜像测试(§22c:全部 import 源出口 __test__,本文件零复算判据)。
//
// 钉死五件事:
//   A1 器物在位锁:STAGES 每段脚本真实存在(§0.8 出路必须真跑得通;S8 同一出口,这里再成对锁一次);
//   A2 判序不变量:derive < land < declare/converge/create/convert < rebuild < verify(倒序=下游拿中间态);
//   A3 写盘闸门:缺省档任何 write 段都不得被放行(一键级联的"默认只读"是机主安全底线);
//   A4 三态分离:red(验尺 rc≠0)与 failed(器物败)与 unjudged(起不动)互不并桶(§0.3);
//   A5 摘要如实:多行 JSON 的收尾 "}" 不得被当结论读数(2026-11-01 实测失真型,回归锁);
//   A10 --only=<stageId> 对全部段严格只跑指定段(选择器失效型回归锁;段数从 STAGES 派生,不写死);
//   A11 未知 stageId / 空 --only 当场 exit 2 并列出可用 id(不静默空跑);
//   A12 第 16 段段注门号 = 237(与实际守门一致,防"文档写 131"再腐化)。
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { __test__ as C } from '../sync-cross-end-cascade.mjs'

const SCRIPTS = join(import.meta.dirname, '..')

test('A1 器物在位锁:每段脚本都在 scripts/ 下真实存在', () => {
  for (const s of C.STAGES) {
    assert.ok(existsSync(join(SCRIPTS, s.script)), `${s.name} 指向的 ${s.script} 不在位`)
  }
})

test('A2 判序不变量:派生最先、校验压轴、重建排在校验前', () => {
  const kinds = C.STAGES.map((s) => s.kind)
  assert.equal(kinds[0], 'derive')
  assert.ok(kinds.indexOf('land') > kinds.indexOf('derive'))
  assert.ok(kinds.indexOf('rebuild') > kinds.lastIndexOf('land'))
  assert.ok(kinds.indexOf('rebuild') < kinds.indexOf('verify'))
  assert.equal(kinds.at(-1), 'verify')
  // 三端落档内部也要 web→RN→小程序(与 guardian 主轮次同序)
  const lands = C.STAGES.filter((s) => s.kind === 'land').map((s) => s.name)
  assert.deepEqual(lands, ['land-web', 'land-rn', 'land-miniapp'])
})

test('A3 写盘闸门:缺省档不放行任何写段;--apply 才放行;--skip 点名必跳', () => {
  const dry = C.parseArgs([])
  const applied = C.parseArgs(['--apply'])
  for (const s of C.STAGES) {
    const d = C.stageDisposition(s, dry)
    if (s.write) assert.equal(d?.state, 'skipped', `${s.name} 缺省档被放行 = 越权写盘`)
    else assert.equal(d, null, `${s.name} 只读段不得被缺省跳过`)
    assert.equal(C.stageDisposition(s, applied), null)
  }
  const sk = C.parseArgs(['--apply', '--skip=land-rn'])
  assert.equal(
    C.stageDisposition(
      C.STAGES.find((x) => x.name === 'land-rn'),
      sk,
    ).state,
    'skipped',
  )
})

test('A4 三态分离并互斥:done/red/failed/unjudged/skipped 不并桶', () => {
  const V = { kind: 'verify', redOnFail: true }
  const W = { kind: 'land' }
  assert.equal(C.classifyStage(V, { ran: true, rc: 0, spawnable: true }), 'done')
  assert.equal(C.classifyStage(V, { ran: true, rc: 1, spawnable: true }), 'red')
  assert.equal(C.classifyStage(W, { ran: true, rc: 1, spawnable: true }), 'failed')
  assert.equal(C.classifyStage(W, { ran: true, rc: null, spawnable: false }), 'unjudged')
  assert.equal(C.classifyStage(W, { ran: false, rc: null, spawnable: false }), 'skipped')
})

test('A5 摘要如实:多行 JSON 不读成"}";判据行优先;空输出不冒充', () => {
  assert.equal(C.summarize(''), '无输出')
  const jsonish = ['{"face":"head"', '"state":"clean"', '  "applied": 0', '}']
  assert.match(C.summarize(jsonish.join('\n')), /clean/, 'JSON 段必须收成判据读数,不能再落 "}"')
  assert.doesNotMatch(
    C.summarize(jsonish.join('\n')),
    /^\}$/,
    '收尾花括号当结论 = 2026-11-01 实测失真型',
  )
  assert.match(C.summarize('noise line\n结论:LAND-TIERS state=applied files=99'), /state=applied/)
})

test('A6 退出码判序:red 优先于 unjudged,"没判过"不得冒充 0', () => {
  assert.equal(C.chainExit(['done', 'skipped']), 0)
  assert.equal(C.chainExit(['done', 'unjudged']), 2)
  assert.equal(C.chainExit(['unjudged', 'failed']), 1)
  assert.equal(C.chainExit(['red', 'unjudged']), 1)
})

test('A7 旗标闸:两面旗同给/未知旗标/--only 打错字 一律 usageError(当场拒绝,不静默空跑)', () => {
  assert.match(C.parseArgs(['--apply', '--dry-run']).usageError, /互斥/)
  assert.match(C.parseArgs(['--wat']).usageError, /未知旗标/)
  assert.match(C.parseArgs(['--only=nope']).usageError, /未知令牌/)
  assert.equal(C.parseArgs(['--only=verify']).usageError, null)
})

test('A8 一键入口在位自证:根 package.json 必须真挂着 sync:cross-end 两条(§0.9 接线不得只写在文档里)', () => {
  let pkg = null
  try {
    pkg = JSON.parse(readFileSync(join(SCRIPTS, '..', 'package.json'), 'utf8'))
  } catch {
    assert.fail('package.json 读不到/坏了 ⇒ 在位性未判定,不得记绿(§0.3)')
  }
  assert.equal(pkg.scripts?.['sync:cross-end'], 'node scripts/sync-cross-end-cascade.mjs')
  assert.equal(
    pkg.scripts?.['sync:cross-end:apply'],
    'node scripts/sync-cross-end-cascade.mjs --apply',
  )
})

test('A9 css-tokens 写腿:--apply 档实派 argv 恰为 ["--write"],且排在所有派生腿之前(2026-11-01 断链格)', () => {
  const stage = C.STAGES.find((s) => s.name === 'verify-css-tokens')
  assert.ok(stage, 'verify-css-tokens 登记条不存在')
  assert.equal(stage.script, 'sync-css-tokens.mjs')
  assert.equal(stage.write, true, '未标 write:true ⇒ --apply 档不会追加写旗,升级未落地')
  // 断言参数数组本身(stageArgv = runStage 消费的唯一装配出口),不是登记册散文
  const argv = C.stageArgv(stage, C.parseArgs(['--apply']))
  assert.deepEqual(argv, ['--write'])
  assert.ok(
    !argv.includes('--check'),
    '--check 与 --write 同给会被器物互斥闸 exit 2,装配层不得拼出',
  )
  // 顺序:tokens.css 受管块生成必须在拿它当源的下游腿之前(倒序 = 下游派生旧面)
  const idx = C.STAGES.indexOf(stage)
  for (const dep of ['derive-tokens', 'land-web', 'land-rn', 'land-miniapp']) {
    const j = C.STAGES.findIndex((s) => s.name === dep)
    assert.ok(j > idx, `${dep} 排在 css-tokens 生成腿之前 = 拿到旧 tokens.css 派生(中间态)`)
  }
})

test('A10 --only=<stageId> 对全部段严格只跑指定段;段类选择不扩成全量', () => {
  // 段数不写死:写死过一次(20)而实际 21,自检与镜像测试双双先炸,炸的形态与"选择器失效"同形。
  // 改为下限守卫 + 全量遍历,新增段天然被覆盖,误删段会撞下限。
  assert.ok(C.STAGES.length >= 20, `段数坍缩到 ${C.STAGES.length} ⇒ 链条被误删`)
  for (const s of C.STAGES) {
    const sel = C.selectStages(C.STAGES, C.parseArgs([`--only=${s.name}`]))
    assert.deepEqual(
      sel.map((x) => x.name),
      [s.name],
      `--only=${s.name} 未恰好命中该段(选择器失效型)`,
    )
  }
  const land = C.selectStages(C.STAGES, C.parseArgs(['--only=land']))
  assert.equal(land.length, 3)
  assert.ok(land.every((s) => s.kind === 'land'))
})

test('A11 未知 stageId / 空 --only 一律 usageError 并列出可用 id,不静默空跑', () => {
  const bad = C.parseArgs(['--only=reconcile']).usageError
  assert.match(bad, /未知令牌/)
  assert.match(bad, /可用 stageId=/)
  assert.match(bad, /portal-converge/, '报错必须给出真实段 id 清单,不能只报段类')
  assert.match(C.parseArgs(['--only=']).usageError, /没有段 id/)
  assert.match(C.parseArgs(['--only=']).usageError, /可用 stageId=/)
  assert.equal(C.parseArgs(['--only=verify-ui-parity']).usageError, null)
})

test('A13 判红理由:stdout 空时落到 stderr,不得用"无输出"盖掉真红因', () => {
  // 门 285 现读即此型(结论打 stderr、stdout 空):旧式 summarize(out) || errText 恒短路。
  assert.match(C.redReason('', '❌ 映射表体检失败 3 处'), /映射表体检失败 3 处/)
  assert.match(C.redReason('', ''), /未写 stdout/)
  assert.match(C.redReason('结论:state=clean', 'noise'), /state=clean/)
})

test('A12 覆盖段段注门号与实际守门一致(237,不是 131)', () => {
  const s = C.STAGES.find((x) => x.name === 'verify-screen-coverage')
  assert.ok(s, 'verify-screen-coverage 登记条不存在')
  assert.match(s.desc, /门 237/)
  assert.doesNotMatch(s.desc, /门 131/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
