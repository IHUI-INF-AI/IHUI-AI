// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 夹具(2026-11-08):门判据面 stock/delta + "存量红只报数"不降级。
//
// 立因:stock 门降级一旦方向写错,就等于把 41/57/204/70b 关掉;所以正反例必须是**真实门 id +
// 真实红项路径**——同型问题落在判据面内必须阻断,落在面外才允许只报数 rc=0。
// 运行:node --test scripts/tests/gate-face-stock.test.mjs
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildStockLedgerEntry,
  decideStockOutcome,
  gateFace,
  isRefsFace,
  refsTouched,
  stockFacePaths,
} from '../lib/gate-face-registry.mjs'
import { triggersTouch } from '../lib/guardian-triggers.mjs'

const CHECKS = {
  41: { id: '41', label: '单主线守门', script: 'check-single-branch.mjs', stagedTriggers: ['**/*'] },
  57: { id: '57', label: '对话流元素覆盖', script: 'check-chat-element-coverage.mjs', stagedTriggers: ['**/*'] },
  204: {
    id: '204',
    label: '错误归因单源',
    script: 'check-error-attribution-single-source.mjs',
    stagedTriggers: ['**/*'],
  },
  '70b': { id: '70b', label: 'i18n 死 key', script: 'scan-dead-i18n-keys.mjs', stagedTriggers: ['**/*'] },
  1: { id: '1', label: '普通 delta 门', script: 'check-delta.mjs', stagedTriggers: ['apps/'] },
}

const touchedBy = (check, path) => triggersTouch([path], stockFacePaths(check))
const decide = (o) => decideStockOutcome({ face: 'stock', explicitFull: false, kind: 'red', ...o })

test('分类:41/30b 是 refs 面;57/204/70b 是 stock;普通门默认 delta', () => {
  for (const id of ['41', '57', '204', '70b']) assert.equal(gateFace(CHECKS[id]), 'stock', id)
  assert.equal(gateFace(CHECKS[1]), 'delta')
  assert.equal(isRefsFace(CHECKS[41]), true)
  assert.equal(isRefsFace(CHECKS[57]), false)
})

test('同型问题 57:改 miniapp 聊天流文件 ⇒ 判据面内 ⇒ 阻断', () => {
  const staged = 'apps/miniapp-taro/src/pkg-ai/ai/ChatMessageItem.tsx'
  assert.equal(touchedBy(CHECKS[57], staged), true)
  assert.equal(decide({ touched: true }), 'block')
})

test('同型问题 204:apps/cli 新增 .message.includes ⇒ 判据面内 ⇒ 阻断', () => {
  const staged = 'apps/cli/src/commands/ai-skills.ts'
  assert.equal(touchedBy(CHECKS[204], staged), true)
  assert.equal(decide({ touched: true }), 'block')
})

test('同型问题 70b:改 i18n 消息文件 ⇒ 判据面内 ⇒ 阻断', () => {
  const staged = 'packages/i18n/messages/zh-CN.json'
  assert.equal(touchedBy(CHECKS['70b'], staged), true)
  assert.equal(decide({ touched: true }), 'block')
})

test('不触及三面(只改 scripts/lib)⇒ 只报数 advisory(rc 不受影响)', () => {
  const staged = 'scripts/lib/face-reader.mjs'
  for (const id of ['57', '204', '70b']) assert.equal(touchedBy(CHECKS[id], staged), false, id)
  assert.equal(decide({ touched: false }), 'advisory')
})

test('显式 full / CI / 无 --staged:stock 门恒阻断(降级被关掉)', () => {
  assert.equal(decide({ touched: false, explicitFull: true }), 'block')
})

test('未判定/崩溃不降级(未判定 ≠ 通过)', () => {
  for (const kind of ['undetermined', 'crash', 'interrupt']) {
    assert.equal(decideStockOutcome({ face: 'stock', touched: false, explicitFull: false, kind }), 'block', kind)
  }
})

test('delta 门永不受存量降级影响', () => {
  assert.equal(decideStockOutcome({ face: 'delta', touched: false, explicitFull: false, kind: 'red' }), 'block')
})

test('41 refs 面:新建/重指旁支 ⇒ 阻断;只移动当前分支 ⇒ 不阻断', () => {
  const base = { 'refs/heads/main': 'aaa' }
  assert.equal(refsTouched({ 'refs/heads/main': 'bbb' }, base, 'main'), false, '当前分支移动不算')
  assert.equal(refsTouched({ ...base, 'refs/heads/fix-x': 'ccc' }, base, 'main'), true, '新建旁支算触及')
  assert.equal(refsTouched({ ...base, 'refs/heads/fix-x': 'ddd' }, { ...base, 'refs/heads/fix-x': 'ccc' }, 'main'), true, '重指旁支算触及')
  assert.equal(refsTouched({ ...base, 'refs/heads/fix-x': 'ccc' }, { ...base, 'refs/heads/fix-x': 'ccc' }, 'main'), false, '没动不算')
  assert.equal(decide({ touched: true }), 'block')
  assert.equal(decide({ touched: false }), 'advisory')
})

test('41 refs 面:快进前进不算重指,回退/改指向才算(且不注入后代尺 ⇒ 保守算触及)', () => {
  const base = { 'refs/heads/main': 'old' }
  const cur = { 'refs/heads/main': 'new' }
  // 快进:main 被推着往前走 —— 每次 push 之后所有工作区都会看到,不能算"本笔重指"。
  assert.equal(refsTouched(cur, base, 'other', (o, n) => o === 'old' && n === 'new'), false)
  // 回退/改指向:不是快进 ⇒ 触及。
  assert.equal(refsTouched(cur, base, 'other', () => false), true)
  // 不注入后代尺 ⇒ 失效方向是阻断。
  assert.equal(refsTouched(cur, base, 'other'), true)
  // 删除 ref ⇒ 触及(没有后代关系可比)。
  assert.equal(refsTouched({}, base, 'other', () => true), true)
})

test('存量台账:一行含门 id/读数/项目清单/HEAD/暂存面,且可按行累加', () => {
  const e1 = buildStockLedgerEntry({
    at: '2026-11-08T00:00:00.000Z',
    head: 'd4e1621806',
    check: CHECKS['70b'],
    touched: false,
    rc: 1,
    items: ['examResult.correct', 'examResult.wrongQuestions'],
    stagedCount: 4,
    stagedSample: ['scripts/lib/face-reader.mjs'],
    explicitFull: false,
  })
  const e2 = buildStockLedgerEntry({ check: CHECKS[57], touched: false, rc: 1, items: ['锚点缺失 x2'] })
  assert.equal(e1.gateId, '70b')
  assert.equal(e1.face, 'stock')
  assert.equal(e1.redCount, 2)
  assert.deepEqual(e1.items, ['examResult.correct', 'examResult.wrongQuestions'])
  assert.equal(e1.head, 'd4e1621806')
  assert.equal(e1.stagedCount, 4)
  // 台账是可追加的 JSONL:逐行序列化再读回,两条互不覆盖。
  const jsonl = [e1, e2].map((e) => JSON.stringify(e)).join('\n') + '\n'
  const back = jsonl
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l))
  assert.equal(back.length, 2)
  assert.equal(back[0].gateId, '70b')
  assert.equal(back[1].gateId, '57')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
