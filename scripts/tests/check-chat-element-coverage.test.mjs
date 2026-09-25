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

const {
  parsePlanned,
  checkAnchors,
  checkEvents,
  checkBaseline,
  checkAnchorPersistence,
  stripCodeComments,
  runChecks,
  pickSource,
} = src

const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
/** 台账本体(单一事实源):测试直接读它,不再抄第二份数字 */
const LEDGER = JSON.parse(readFileSync(join(ROOT_DIR, 'scripts', 'data', 'chat-flow-elements.json'), 'utf8'))

const PLAN_SOURCE = {
  taskLinePattern: '^- \\[([ x])\\]\\s*(?:✅[^*]*)?\\*\\*(D[0-9]+)',
  gapIdPattern: 'G-[0-9]{2,3}',
}
const PLAN_TWO_TASKS = '- [ ] **D90 示例元素(G-140)**:x\n- [x] ✅(2026-09-20)**D27 交付审查(G-29)**:y\n'

function baseData(overrides = {}) {
  return {
    planSource: PLAN_SOURCE,
    entryCountBaseline: 1,
    anchorCountBaseline: { total: 1, perElement: { ok: 1 } },
    implemented: [],
    ...overrides,
  }
}

test('__test__ 导出键齐全(§22c 锚点:改源函数签名必须同步本文件)', () => {
  for (const key of [
    'parsePlanned',
    'checkAnchors',
    'checkEvents',
    'checkBaseline',
    'checkAnchorPersistence',
    'stripCodeComments',
    'runChecks',
  ]) {
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
  const r = checkAnchors([{ id: 'bad', anchors: [{ file: 'nope/nothere-zzz.tsx' }] }])
  assert.equal(r.violations.length, 1)
  assert.equal(r.violations[0].kind, 'anchor-missing-file')
})

test('① 期望元素无渲染位:锚点关键标识漂移必红', () => {
  const r = checkAnchors([{ id: 'bad', anchors: [{ file: 'package.json', mustMatch: 'ZZZ_不存在的标识' }] }])
  assert.equal(r.violations.length, 1)
  assert.equal(r.violations[0].kind, 'anchor-missing-marker')
})

test('① 正常锚点必绿', () => {
  const r = checkAnchors([{ id: 'ok', anchors: [{ file: 'package.json', mustMatch: '"name"' }] }])
  assert.equal(r.violations.length, 0)
})

// ─── 判据④ 锚点存续性(2026-09-25 补) ───────────────────────────────────
// entryCountBaseline 只数条目数不数锚点数,所以"把那 5 行锚点从 JSON 里删掉"此前无人看守。

test('④a 条目内锚点被删 ⇒ 必红并点名缺口(条目级与总数级双覆盖,不是二选一)', () => {
  const r = checkAnchorPersistence([{ id: 'ok', anchors: [] }], { total: 1, perElement: { ok: 1 } })
  assert.deepEqual(
    r.violations.map((v) => v.kind).sort(),
    ['anchor-count-regression', 'anchor-total-regression'],
  )
  assert.match(r.violations.find((v) => v.kind === 'anchor-count-regression').detail, /少 1 条/)
})

test('④a2 只删别处的锚点(本条目持平)也必须被总数级判据抓到', () => {
  // perElement 里没有 other 的额度 ⇒ 条目级看不见,只能靠 total;这条证明"两层都要在"
  const r = checkAnchorPersistence(
    [
      { id: 'ok', anchors: [{ file: 'package.json', mustMatch: '"name"' }] },
      { id: 'other', anchors: [] },
    ],
    { total: 2, perElement: { ok: 1 } },
  )
  assert.deepEqual(r.violations.map((v) => v.kind), ['anchor-total-regression'])
})

test('④b 合法搬端:锚点从一端搬到同条目另一端(总数不变)⇒ 必绿', () => {
  // 真实形态:queue-item-interactions 的一条从 web 搬到 extension,条目内计数不变
  const r = checkAnchorPersistence(
    [{ id: 'ok', anchors: [{ file: 'apps/extension/lib/ext-queue-ops.ts', mustMatch: 'extQueueInteractionAllowed' }] }],
    { total: 1, perElement: { ok: 1 } },
  )
  assert.deepEqual(r.violations, [])
})

test('④c 增长一律放行(只挡倒退,不抬基线不拦人)', () => {
  const anchors = Array.from({ length: 5 }, () => ({ file: 'package.json', mustMatch: '"name"' }))
  const r = checkAnchorPersistence([{ id: 'ok', anchors }], { total: 1, perElement: { ok: 1 } })
  assert.deepEqual(r.violations, [])
})

test('④d 台账缺 anchorCountBaseline ⇒ 判红(整文件按旧基线回写的指纹)', () => {
  for (const bad of [undefined, null, {}, { total: 1 }, { perElement: {} }, { total: 'x', perElement: {} }]) {
    const r = checkAnchorPersistence([{ id: 'ok', anchors: [{ file: 'package.json' }] }], bad)
    assert.equal(r.violations.length, 1, `形态 ${JSON.stringify(bad)} 应判 anchor-baseline-missing`)
    assert.equal(r.violations[0].kind, 'anchor-baseline-missing')
  }
})

test('④e 总数倒退(条目键对不上时的兜底)必红 + 错位基线键只提示', () => {
  const r = checkAnchorPersistence([{ id: 'new-el', anchors: [] }], { total: 9, perElement: { gone_el: 3 } })
  assert.ok(r.violations.some((v) => v.kind === 'anchor-total-regression'))
  assert.deepEqual(r.danglingBaseline, ['gone_el'])
})

// ─── 判据⑤ 剥注释后再匹配(2026-09-25 补) ───────────────────────────────

test('⑤a 阳性对照(真语料):宿主只在 // 注释里留该词 ⇒ 剥注释后必红', () => {
  // 真实缺陷:task-status-bar.tsx 第 152 行的 describeToolActivity 只活在一句说明注释里
  const r = checkAnchors(
    [{ id: 'any-id-not-in-baseline', anchors: [{ file: 'apps/web/src/components/ai/task-status-bar.tsx', mustMatch: 'describeToolActivity' }] }],
    undefined,
    { commentOnlyBaseline: [] },
  )
  assert.equal(r.violations.length, 1)
  assert.equal(r.violations[0].kind, 'anchor-commented-out')
})

test('⑤b 同一处已登记为存量 ⇒ 只报数不判红(恒红门 = 逼人 --no-verify)', () => {
  const entry = {
    id: 'tool-row-bilingual-tense-wording',
    file: 'apps/web/src/components/ai/task-status-bar.tsx',
    mustMatch: 'describeToolActivity',
  }
  const r = checkAnchors(
    [{ id: entry.id, anchors: [{ file: entry.file, mustMatch: entry.mustMatch }] }],
    undefined,
    { commentOnlyBaseline: [entry] },
  )
  assert.deepEqual(r.violations, [])
  assert.equal(r.notices.filter((n) => n.kind === 'anchor-commented-out-known').length, 1)
  // 反向对照:存量若已清偿/登记错位,必须被 cleared 计数显形(不得静默)
  const stale = checkAnchors([{ id: 'x', anchors: [] }], undefined, { commentOnlyBaseline: [entry] })
  assert.equal(stale.notices.filter((n) => n.kind === 'anchor-commented-out-cleared').length, 1)
})

test('⑤c 存量清单必须覆盖台账里登记的每一项(防"登记了却没接上")', () => {
  const data = LEDGER
  const entries = data.commentOnlyAnchorBaseline?.entries ?? []
  assert.ok(entries.length > 0, '台账必须带 commentOnlyAnchorBaseline.entries')
  const implementedById = new Map(data.implemented.map((e) => [e.id, e]))
  for (const e of entries) {
    const el = implementedById.get(e.id)
    assert.ok(el, `存量登记项的 id ${e.id} 在 implemented 里找不到 ⇒ 登记错位会让存量永不命中、当场恒红`)
    assert.ok(
      (el.anchors ?? []).some((a) => a.file === e.file && a.mustMatch === e.mustMatch),
      `存量登记项 ${e.id} 与条目锚点对不上(file/mustMatch 拼错即静默失效)`,
    )
  }
})

test('⑤d 剥注释:串内注释符不当起点 / 正则 / 模板串 / Python 三引号', () => {
  const cases = [
    ["const u = 'https://x.example/a' ;", 'ts', ["'https://x.example/a'"], []],
    ['const u = "http://a/*b*/c" ;', 'ts', ['"http://a/*b*/c"'], []],
    ['const re = /https?:\\/\\//g ;', 'ts', ['/https?:\\/\\//g'], []],
    ['const s = `模板里 // 与 /* 都不算注释` ;', 'ts', ['`模板里 // 与 /* 都不算注释`'], []],
    ["import QueueBar from '../components/QueueBar'\n", 'tsx', ["import QueueBar from '../components/QueueBar'"], []],
    ["const a = 1\n// import Q from 'q'\nconst b = 2\n", 'ts', ['const a = 1', 'const b = 2'], ["import Q from 'q'"]],
    ['a /* 块\n注释 */ b\nconst KEEP = 1\n', 'ts', ['const KEEP = 1'], ['块', '注释']],
    ['const x = <T>{/* import Q */}1</T>\n', 'tsx', ['1'], ['import Q']],
    ['const s = a # b ;\n', 'ts', ['# b'], []],
    ['# 说明 import Q\nx = 1\n', 'py', ['x = 1'], ['import Q']],
    ['"""\n# 不是注释 import Q\n"""\nx = 1\n', 'py', ['# 不是注释 import Q', 'x = 1'], []],
  ]
  for (const [input, ext, kept, gone] of cases) {
    const r = stripCodeComments(input, ext)
    assert.ok(r.trusted, `应可信收尾: ${input}`)
    for (const s of kept) assert.ok(r.text.includes(s), `该留的没留(${JSON.stringify(s)}) ← ${JSON.stringify(input)}`)
    for (const s of gone) assert.ok(!r.text.includes(s), `该剥的没剥(${JSON.stringify(s)}) ← ${JSON.stringify(input)}`)
  }
})

test('⑤e 未闭合块注释 ⇒ trusted:false(调用方回退原文,绝不假红)', () => {
  const r = stripCodeComments('const bad = 1 /* 没关\nconst KEEP = 1\n', 'ts')
  assert.equal(r.trusted, false)
  assert.ok(r.reason.includes('块注释'))
})

test('⑤f 判据⑤不得让原本红的变绿(单调性)', () => {
  // 原文就找不到 ⇒ 仍是 anchor-missing-marker,不是 anchor-commented-out,也不会因剥注释而消失
  const r = checkAnchors([{ id: 'ok', anchors: [{ file: 'package.json', mustMatch: 'ZZZ_不存在' }] }])
  assert.deepEqual(r.violations.map((v) => v.kind), ['anchor-missing-marker'])
})

test('⑤g 锚定文件剥注释不可信时如实计数(不静默)', () => {
  const r = checkAnchors(
    [{ id: 'ok', anchors: [{ file: 'apps/web/src/components/ai/task-status-bar.tsx', mustMatch: 'describeToolActivity' }] }],
    undefined,
    { commentOnlyBaseline: [] },
  )
  // 真语料是可信收尾 ⇒ undetermined 应为 0;非 0 说明状态机在该文件上失效
  assert.equal(r.undetermined, 0)
})

// ─── 既有的 ②/③ 与集成 ──────────────────────────────────────────────────

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

test('runChecks 集成:五类违规各必红', () => {
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
  assert.ok(red3.violations.some((v) => v.kind === 'inventory-regression'), '③条目倒退 应红')
  const red4 = runChecks({
    data: baseData({
      anchorCountBaseline: { total: 99, perElement: { ok: 99 } },
      implemented: [{ id: 'ok', anchors: [{ file: 'package.json' }] }],
    }),
    planText: PLAN_TWO_TASKS,
    contractPy: '',
    contractTs: '',
  })
  assert.ok(red4.violations.some((v) => v.kind === 'anchor-count-regression'), '④锚点倒退 应红')
  const red5 = runChecks({
    data: baseData({
      implemented: [
        { id: 'ok', anchors: [{ file: 'apps/web/src/components/ai/task-status-bar.tsx', mustMatch: 'describeToolActivity' }] },
      ],
    }),
    planText: PLAN_TWO_TASKS,
    contractPy: '',
    contractTs: '',
  })
  assert.ok(red5.violations.some((v) => v.kind === 'anchor-commented-out'), '⑤注释式摘线 应红')
})

test('台账自身:anchorCountBaseline 必须与实现的锚点数逐条目等值', () => {
  const per = LEDGER.anchorCountBaseline?.perElement
  assert.ok(per && typeof per === 'object', '台账缺 anchorCountBaseline.perElement')
  for (const el of LEDGER.implemented) {
    assert.equal(per[el.id], (el.anchors ?? []).length, `${el.id}:登记的锚点额度与实现不等值(抬额度须与加锚点同 PR)`)
  }
  const sum = LEDGER.implemented.reduce((s, el) => s + (el.anchors ?? []).length, 0)
  assert.equal(LEDGER.anchorCountBaseline.total, sum, 'total 必须等于全清单锚点总数')
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

// ─── 内容来源:判仓库内容,不判共享工作区快照(2026-09-24 补) ───────────
//
// 起因:本会话只改守门脚本,[57] 却报 5 处 anchor-missing-marker —— 全部来自别人**未提交**的
// 重写(HEAD 里锚点全在,工作树里全被删)。按磁盘读等于"谁的工作区脏,全仓提交一起红",
// 恒红的唯一结局是 --no-verify,把真正防回归的判据一起关掉。

test('pickSource:已暂存判索引 / 仅工作树脏判 HEAD / 干净判磁盘', () => {
  assert.equal(pickSource({ staged: true, worktreeDirty: true }), 'index')
  assert.equal(pickSource({ staged: true, worktreeDirty: false }), 'index')
  assert.equal(pickSource({ staged: false, worktreeDirty: true }), 'head')
  assert.equal(pickSource({ staged: false, worktreeDirty: false }), 'disk')
})

test('装车证明:锚点判据必须经 contentAt 取内容,不得回到按磁盘读的老路', () => {
  const srcText = readFileSync(join(ROOT_DIR, 'scripts', 'check-chat-element-coverage.mjs'), 'utf8')
  assert.match(srcText, /const text = contentAt\(anchor\.file, repoRoot\)/, 'checkAnchors 必须经 contentAt 取锚定文件内容')
  assert.doesNotMatch(srcText, /readFileSync\(abs, 'utf8'\)\.includes\(anchor\.mustMatch\)/, '不得再用裸 readFileSync 判锚点(共享工作区快照不可作为仓库事实)')
  // runner 里本门必须仍是 blocking —— 换成"看不见"绝不是修好
  const runner = readFileSync(join(ROOT_DIR, 'scripts', 'guardian-runner.mjs'), 'utf8')
  const block = runner.slice(runner.indexOf("id: '57'"), runner.indexOf("id: '57'") + 400)
  assert.match(block, /script: 'check-chat-element-coverage\.mjs'/)
  assert.match(block, /mode: 'blocking'/)
})

// ─── 装车证明:两条新判据必须真被调用,且不得退回旧的宽松形态(2026-09-25 补) ───

test('装车证明④:runChecks 必须调用 checkAnchorPersistence 并传台账基线', () => {
  const srcText = readFileSync(join(ROOT_DIR, 'scripts', 'check-chat-element-coverage.mjs'), 'utf8')
  assert.match(
    srcText,
    /checkAnchorPersistence\(data\.implemented, data\.anchorCountBaseline\)/,
    '存续性判据必须接进 runChecks(判据存在而永不调用 = 没有)',
  )
  assert.match(srcText, /persistenceRes\.violations/, '存续性违规必须汇进 violations 出口')
})

test('装车证明⑤:匹配面必须是剥注释后的文本,且不得用"注释里也算"的宽松出口', () => {
  const srcText = readFileSync(join(ROOT_DIR, 'scripts', 'check-chat-element-coverage.mjs'), 'utf8')
  assert.match(srcText, /stripCodeComments\(text, extOf\(anchor\.file\)\)/, '锚点必须经剥注释后再匹配')
  assert.match(srcText, /codeSurface\.includes\(anchor\.mustMatch\)/, '判据必须读剥注释后的文本')
  // 反向回归锁:写门时自己踩到的缺陷 —— 键若按 anchor.id 拼(锚点对象上没有 id),
  // 存量清单永不命中,3 处登记会当场把本门钉成恒红门。
  assert.doesNotMatch(srcText, /const k = keyOf\(anchor\)/, '存量键必须带元素 id,不得用 anchor.id(anchor 上无该字段)')
  // 不可信时必须回退原文,而不是"跳过判据"
  assert.match(srcText, /if \(!trusted\) \{[\s\S]{0,200}undetermined \+= 1/, '剥注释不可信须计未判定并回退')
})

test('台账自身两张基线必须齐备(整文件被旧基线回写时,本条与 ④d 同时红)', () => {
  assert.equal(typeof LEDGER.anchorCountBaseline?.total, 'number')
  assert.ok(Array.isArray(LEDGER.commentOnlyAnchorBaseline?.entries))
  assert.ok(LEDGER.implemented.length > 0)
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
