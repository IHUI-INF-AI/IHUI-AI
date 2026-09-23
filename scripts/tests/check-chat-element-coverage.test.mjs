// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c:直接 import 源脚本导出的 __test__,不维护任何“镜像常量”,杜绝源/测两份真相漂移。
// §22d:源脚本的 main() 受 isDirectRun 守护,被 import 时不得有任何副作用。
// D51:三类违规(①期望元素无渲染位 ②事件契约有帧但无消费点 ③前端监听但后端不发)各有正反用例;
// V3种子数据文件 scripts/data/chat-element-coverage.json 由本文件做 schema 自检,清单变更不同步即红。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as src } from '../check-chat-element-coverage.mjs'

const { parsePlanned, checkAnchors, checkEvents, checkBaseline, runChecks } = src

const PLAN_SOURCE = {
  taskLinePattern: '^- \\[([ x])\\]\\s*(?:✅[^*]*)?\\*\\*(D[0-9]+)',
  gapIdPattern: 'G-[0-9]{2,3}',
}
const PLAN_TWO_TASKS = '- [ ] **D90 示例元素(G-140)**:x\n- [x] ✅(2026-09-20)**D27 交付审查(G-29)**:y\n'

function baseData(overrides = {}) {
  return {
    planSource: PLAN_SOURCE,
    entryCountBaseline: 1,
    implemented: [],
    ...overrides,
  }
}

test('__test__ 导出键齐全(§22c 锚点:改源函数签名必须同步本文件)', () => {
  for (const key of ['parsePlanned', 'checkAnchors', 'checkEvents', 'checkBaseline', 'runChecks']) {
    assert.ok(key in src, `__test__ 缺少导出键 ${key}`)
  }
})

test('parsePlanned:两种任务行形态都识别并提取 G-ID', () => {
  const planned = parsePlanned(PLAN_TWO_TASKS, PLAN_SOURCE.taskLinePattern, PLAN_SOURCE.gapIdPattern)
  assert.equal(planned.length, 2)
  assert.equal(planned[0].done, false)
  assert.equal(planned[1].done, true)
  const gaps = new Set(planned.flatMap((p) => p.gaps))
  assert.deepEqual([...gaps].sort(), ['G-140', 'G-29'])
})

test('① 期望元素无渲染位:锚点文件不见必红', () => {
  const vs = checkAnchors([{ id: 'bad', anchors: [{ file: 'nope/nothere-zzz.tsx' }] }])
  assert.equal(vs.length, 1)
  assert.equal(vs[0].kind, 'anchor-missing-file')
})

test('① 期望元素无渲染位:锚点关键标识漂移必红', () => {
  const vs = checkAnchors([{ id: 'bad', anchors: [{ file: 'package.json', mustMatch: 'ZZZ_不存在的标识' }] }])
  assert.equal(vs.length, 1)
  assert.equal(vs[0].kind, 'anchor-missing-marker')
})

test('① 正常锚点必绿', () => {
  const vs = checkAnchors([{ id: 'ok', anchors: [{ file: 'package.json', mustMatch: '"name"' }] }])
  assert.equal(vs.length, 0)
})

test('③ 前端监听但后端不发必红(shared 有、sse_contract.py 无)', () => {
  const vs = checkEvents(
    [{ id: 'ev', anchors: [], events: ['frontend_only_event_zzz'] }],
    'EVENTS = ["other"]',
    'export const E = ["frontend_only_event_zzz"]',
  )
  assert.equal(vs.length, 1)
  assert.equal(vs[0].kind, 'event-contract-drift')
})

test('② 事件契约有帧但无消费点必红(ai-service 有、shared 无)', () => {
  const vs = checkEvents(
    [{ id: 'ev', anchors: [], events: ['backend_only_event_zzz'] }],
    'EVENTS = ["backend_only_event_zzz"]',
    'export const E = ["other"]',
  )
  assert.equal(vs.length, 1)
  assert.equal(vs[0].kind, 'event-contract-drift')
})

test('②③ 双端齐备必绿', () => {
  const vs = checkEvents(
    [{ id: 'ev', anchors: [], events: ['usage'] }],
    'EVENTS = ["usage"]',
    'export const E = ["usage"]',
  )
  assert.equal(vs.length, 0)
})

test('③ 清单条目倒退必红、持平必绿', () => {
  assert.equal(checkBaseline(5, 999).length, 1)
  assert.equal(checkBaseline(5, 999)[0].kind, 'inventory-regression')
  assert.equal(checkBaseline(999, 999).length, 0)
  assert.equal(checkBaseline(1000, 999).length, 0)
})

test('runChecks 集成:正常态必绿', () => {
  const res = runChecks({
    data: baseData({ implemented: [{ id: 'ok', anchors: [{ file: 'package.json' }] }] }),
    planText: PLAN_TWO_TASKS,
    contractPy: '',
    contractTs: '',
  })
  assert.equal(res.violations.length, 0)
  assert.equal(res.plannedTasks, 2)
  assert.equal(res.gapIds, 2)
})

test('runChecks 集成:三类违规各必红', () => {
  const red1 = runChecks({
    data: baseData({ implemented: [{ id: 'bad', anchors: [{ file: 'nope/nothere-zzz.tsx' }] }] }),
    planText: PLAN_TWO_TASKS,
    contractPy: '',
    contractTs: '',
  })
  assert.ok(red1.violations.some((v) => v.kind.startsWith('anchor-missing')), '① 应红')
  const red2 = runChecks({
    data: baseData({ implemented: [{ id: 'ev', anchors: [], events: ['ghost_event_zzz'] }] }),
    planText: PLAN_TWO_TASKS,
    contractPy: '',
    contractTs: '',
  })
  assert.ok(red2.violations.some((v) => v.kind === 'event-contract-drift'), '②/③ 应红')
  const red3 = runChecks({
    data: baseData({ entryCountBaseline: 999 }),
    planText: PLAN_TWO_TASKS,
    contractPy: '',
    contractTs: '',
  })
  assert.ok(red3.violations.some((v) => v.kind === 'inventory-regression'), '③倒退 应红')
})

test('V3种子数据文件 schema 自检(字段齐全+无重复id)', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
  const data = JSON.parse(readFileSync(join(root, 'scripts', 'data', 'chat-element-coverage.json'), 'utf8'))
  assert.ok(Array.isArray(data.elements) && data.elements.length > 0)
  const ids = new Set()
  for (const el of data.elements) {
    for (const k of ['id', 'name', 'evidence', 'events', 'render', 'crossEnd', 'status']) {
      assert.ok(k in el, `${el.id ?? '(无id)'} 缺字段 ${k}`)
    }
    assert.ok(/^E[1-5](\+E[1-5])*$/.test(el.evidence), `${el.id} 证据级别非法`)
    assert.ok(Array.isArray(el.events), `${el.id} events 必须为数组`)
    assert.ok(!ids.has(el.id), `重复 id ${el.id}`)
    ids.add(el.id)
  }
  assert.equal(data.inventoryCount, data.elements.length, 'inventoryCount 必须等于 elements 条数')
})

test('G-70 反向清单:两项都在且标我方在前(禁止当差距补齐)', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
  const data = JSON.parse(readFileSync(join(root, 'scripts', 'data', 'chat-element-coverage.json'), 'utf8'))
  assert.ok(Array.isArray(data.negativeList) && data.negativeList.length >= 2)
  const notes = data.negativeList.map((n) => `${n.gapId ?? ''} ${n.note ?? ''}`).join('\n')
  assert.ok(notes.includes('G-70'), '反向清单必须含 G-70')
  assert.ok(notes.includes('[n]'), '须含行内 [n] 编号引用项')
  assert.ok(notes.includes('分享'), '须含会话分享项')
  assert.ok(notes.includes('我方在前'), '须明确标“我方在前”')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
