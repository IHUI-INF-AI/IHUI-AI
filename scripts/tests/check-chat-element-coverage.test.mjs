// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c:直接 import 源脚本导出的 __test__,不维护任何“镜像常量”,杜绝源/测两份真相漂移。
// §22d:源脚本的 main() 受 isDirectRun 守护,被 import 时不得有任何副作用。
// D51:三类违规(①期望元素无渲染位 ②事件契约有帧但无消费点 ③前端监听但后端不发)各有正反用例;
// V3种子数据文件 scripts/data/chat-element-coverage.json 由本文件做 schema 自检,清单变更不同步即红。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

// 2026-10-16 新增的补偿维第二来源是**具名导出**(源脚本已 export function ledgerCorpus),
// 测试照旧直接 import 生产判据,不在本文件抄第二份形状判定(§22c / 守门 191)。
import { __test__ as src, ledgerCorpus } from '../check-chat-element-coverage.mjs'

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

/**
 * 退役留痕 ledger 在审面上的**路径**不在本文件抄第二份(§22c/§0.6 单一真相源):它是生产函数
 * `ledgerCorpus` 的缺省 `source` 参数,所以拿一次真调的返回值剥掉 `#gapIds` 尾巴就是唯一真相。
 */
const LEDGER_REL = ledgerCorpus(JSON.stringify({ gapIds: ['G-0'] })).archives[0].path.replace(/#gapIds$/, '')

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
  // 真实缺陷:task-status-bar.tsx 第 152 行的 describeToolActivity 只活在一句说明注释里。
  // 该串自 2026-09-25 起已不再是台账锚点(锚点改指代码面的 describeMcpToolActivity),但**宿主那句注释仍在**,
  // 所以本例是一条自足的真语料阳性对照,不依赖 commentOnlyAnchorBaseline 里还挂着登记。
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

test('⑤c 存量清单必须与台账自洽(空=已清偿必须为真;非空必须逐项接得上)', () => {
  const data = LEDGER
  const entries = data.commentOnlyAnchorBaseline?.entries ?? []
  assert.ok(Array.isArray(entries), '台账必须带 commentOnlyAnchorBaseline.entries 数组')
  // 2026-09-25:三处存量已按「重指向代码面真实标识」清偿,清单现为空数组。
  // 因此原来的 entries.length > 0 不得再要(要它就是在逼人已删的登记回来),换成一条**两个方向都牙**的对账:
  //   · 清单为空却仍有注释式摘线锚点 ⇒ violations 里的 anchor-commented-out 必红("用删登记来清账"当场失败)
  //   · 清单里有项已不再命中(登记错位或已清偿未移除)⇒ cleared 计数必显形,不得静默
  const r = checkAnchors(data.implemented, undefined, { commentOnlyBaseline: entries })
  assert.deepEqual(
    r.violations.filter((v) => v.kind === 'anchor-commented-out'),
    [],
    '台账里仍有锚点只活在注释里 ⇒ 要么补登记(只报数)、要么把 mustMatch 改指代码面标识(不得删宿主注释)',
  )
  assert.deepEqual(
    r.notices.filter((n) => n.kind === 'anchor-commented-out-cleared').map((n) => n.detail),
    [],
    '存量清单有项与任何锚点对不上 ⇒ 已清偿须同 PR 移除登记,拼错则是基线失效(会让另一处恒红)',
  )
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

// ═══ 审面(2026-09-28 立):清单条目数 = 台账 ⊕ **同面**归档件 ═══════════════════
//
// 起因(不是假想):自动归档档改成"完成即归档"后,完成的 D 行被搬进
// `.ihui-agent/archive/PROJECT_PLAN_*.md`;本门只数台账正文,于是"搬走"被读成"撤销"
// —— 当天实测 entryCount 103(基线)→ 74 判红,而台账行数一行未减、元素一个未删。
// 这组用例钉的是**判据有牙**:归档件带着那一行 ⇒ 不判红;两侧都没有 ⇒ 仍判红。
// 基线(chat-flow-elements.json 的 entryCountBaseline)不是本票的可调项 —— 下面所有断言
// 都在构造面上改**内容**,不改阈值。

const { mergeGapIds, gapIdsOfText, archiveFaceFor, readArchiveCorpus, ARCHIVE_FILE_RE } = src

const PS = LEDGER.planSource
const ARCH_LINE = '- [x] ✅(2026-09-27)**D77 被搬走的元素(G-151)**:归档件里的原文\n'
const PLAN_LINE = '- [ ] **D90 示例元素(G-140)**:台账正文里的行\n'

test('审面纯判据:归档件补回 ⇒ 计入;两侧都无 ⇒ 不计;两侧各一份 ⇒ 不双计', () => {
  const only = mergeGapIds({ planText: PLAN_LINE, archives: [], planSource: PS })
  assert.deepEqual([...only.gapIds], ['G-140'])
  assert.equal(only.fromPlan, 1)
  assert.deepEqual(only.archivedOnly, [])

  const recovered = mergeGapIds({
    planText: '',
    archives: [{ path: '.ihui-agent/archive/PROJECT_PLAN_2026-09-28.md', text: ARCH_LINE }],
    planSource: PS,
  })
  assert.deepEqual([...recovered.gapIds], ['G-151'], '台账一行没有而归档件带着 ⇒ 审面必须仍数到它')
  assert.deepEqual(recovered.archivedOnly, ['G-151'], '"只在归档件里"必须单独报名,不得混进台账计数')

  const dup = mergeGapIds({
    planText: PLAN_LINE + ARCH_LINE,
    archives: [{ path: '.ihui-agent/archive/PROJECT_PLAN_x.md', text: ARCH_LINE }],
    planSource: PS,
  })
  assert.deepEqual([...dup.gapIds].sort(), ['G-140', 'G-151'], '同一 G-ID 两侧各一份只算一条(双计=刷额度)')
  assert.deepEqual(dup.archivedOnly, [], '台账里已有的那条不得被算成"归档件补回"')
  assert.equal(gapIdsOfText('# 没有任务行的散文\nG-999 提一句\n', PS).size, 0, '非任务行里的 G-ID 不得被计入(判据仍是 taskLinePattern)')
})

test('归档面的选择:磁盘面从来不是归档凭据(G-183),worktree 也必须落回 HEAD 树', () => {
  assert.equal(archiveFaceFor('staged'), 'staged')
  assert.equal(archiveFaceFor('head'), 'head')
  assert.equal(archiveFaceFor('worktree'), 'head')
})

test('形状锁:归档面取材必须走 face-reader,不得回到 readdirSync / 按磁盘读', () => {
  const srcText = readFileSync(join(ROOT_DIR, 'scripts', 'check-chat-element-coverage.mjs'), 'utf8')
  assert.match(srcText, /from '\.\/lib\/face-reader\.mjs'/, '必须引 face-reader(散写 git 读内容 = 本仓判据漂移的源头)')
  assert.match(srcText, /catBatch\(root, specs/, '归档件内容必须一次 catBatch 批量读满(逐文件开 git = 守门 80 的 fork 风暴)')
  assert.doesNotMatch(srcText, /readdirSync\(/, '归档清单不得用 readdirSync —— 本机未入库的副本不构成凭据')
  assert.doesNotMatch(srcText, /readFileSync\(join\(root[^)]*archive/, '不得按磁盘读归档目录当被审内容')
  // 两面旗同给 / 枚举到 0 / blob 取不到 三格都必须有出口,少一格就是"把没判写成判过了"
  assert.match(srcText, /selectFace\(\{/, '必须经 selectFace 选面(两面旗同给 ⇒ 判死)')
  assert.match(srcText, /corpus\.enumerated === 0/, '枚举到 0 个归档候选必须判死,不得记绿')
  assert.match(srcText, /corpus\.error/, '归档面取材失败必须显式未判定,不得静默')
  assert.match(srcText, /res\.archiveMissing\.length > 0[\s\S]{0,120}return 2/, 'blob 取不到 ⇒ 拒绝出具合格证')
})

// 归档补偿维自 2026-10-16 起有**两个来源**:面上归档件(source='face')与面上 0 份时顶上的
// 退役留痕 ledger(source='retirement-ledger')。本条把**两档都锁死**:
//   · 枚举到 0 一律红 —— 这是本品自己的防盗线(谁把两个来源都摘了必须喊响),绝不放行;
//   · source 只可能是这两值之一,其余('none'/'ledger-broken'/'error')一律红;
//   · 两档各自的形状断言分开写:face 档读到的必须都是 PROJECT_PLAN_*.md,
//     ledger 档条目必须自述 ledger 且 gapIds > 0(空编号早在 ledgerCorpus 就 error 掉了)。
function assertCorpusOnFace(face, label) {
  const res = readArchiveCorpus(face, ROOT_DIR)
  assert.equal(res.error, null, `${label}取材失败(未判定不得当通过):${res.error}`)
  assert.ok(
    res.enumerated > 0,
    `${label}归档件与退役 ledger 双双枚举到 0(source=${res.source})⇒ 无法判定 —— 空扫不是"没有归档"`,
  )
  assert.equal(res.archives.length, res.enumerated - res.missing.length, '枚举数必须 = 读到 + 点名缺的,不得静默少一份')
  assert.ok(
    res.source === 'face' || res.source === 'retirement-ledger',
    `${label}凭据来源只可能是面档或退役 ledger,实得 ${res.source}`,
  )
  if (res.source === 'face') {
    assert.ok(
      res.archives.every((a) => !a.ledger && ARCHIVE_FILE_RE.test(a.path)),
      '面档来源读到的必须都是 PROJECT_PLAN_*.md 形状(别的归档件不参与本判据)',
    )
  } else {
    assert.ok(
      res.archives.every((a) => a.ledger === true && a.gapIds > 0 && typeof a.text === 'string' && a.text.trim()),
      'ledger 来源条目必须带 ledger:true 与非空编号集合,且正文就是那批编号',
    )
    assert.ok(
      res.archives.every((a) => ARCHIVE_FILE_RE.test(a.path) === false),
      'ledger 条目不得伪装成 PROJECT_PLAN_*.md 形状(两源必须可分辨)',
    )
  }
  return res
}

test('真仓取材:HEAD 面上的补偿凭据必须真被枚举到(空扫 = 尺子失效,不是"没有归档")', () => {
  assertCorpusOnFace('head', 'HEAD 树面:')
})

test('真仓取材(索引面):同一把尺子在 --staged 档也必须枚举到 >0,不许有一档失明', () => {
  assertCorpusOnFace('staged', '索引面:')
})

// ═══ 2026-10-16 新语义①:归档补偿维的第二来源(退役留痕 ledger)═══════════════════
//
// 门体只在**面上归档件为 0** 时才去同一面取 ledger;面上有归档件 ⇒ 一律用归档件。
// 三态纪律(§0.3):取到 ⇒ 顶上;缺文件 ⇒ absent(交调用方判死);形状坏 ⇒ error(点名,绝不静默当"没有那份")。

test('ledgerCorpus 四态成对:正常 / 缺文件 / 坏 JSON / gapIds 形状不对,每种只有一条出路', () => {
  const good = ledgerCorpus(JSON.stringify({ gapIds: ['G-10', 'G-11', 'G-12'], sourceCommit: 'a'.repeat(40) }), 'ledger.json')
  assert.equal(good.error, null, `正常 ledger 不该报错:${good.error}`)
  assert.equal(good.absent, false)
  assert.equal(good.archives.length, 1, '一份 ledger 只合成一条归档面条目')
  assert.equal(good.archives[0].gapIds, 3, 'gapIds 必须逐条数出来,不得只报"有一份"')
  assert.equal(good.archives[0].ledger, true, '条目必须自述 ledger(这是 mode 切换的唯一凭据形状)')
  assert.match(good.archives[0].path, /^ledger\.json#gapIds$/, 'path 必须点名来源与字段,便于人工复核')
  assert.equal(good.archives[0].text, 'G-10\nG-11\nG-12', '正文 = 编号换行拼接')
  assert.equal(good.archives[0].sourceCommit, 'a'.repeat(40))

  for (const [miss, label] of [['', '空文本'], ['   \n  ', '纯空白']]) {
    const r = ledgerCorpus(miss, 'ledger.json')
    assert.equal(r.absent, true, `${label} 必须判 absent(缺文件 ≠ 形状坏)`)
    assert.equal(r.error, null, `${label} 不得冒充 error`)
    assert.deepEqual(r.archives, [])
  }

  const broken = ledgerCorpus('{ 这不是 JSON }', 'ledger.json')
  assert.equal(broken.absent, false, '形状坏绝不能读成"没有那份"')
  assert.ok(broken.error, '坏 JSON 必须 error 点名')
  assert.match(broken.error, /不是合法 JSON/, `error 必须说清坏在哪:${broken.error}`)
  assert.match(broken.error, /ledger\.json/, 'error 必须点名是哪份文件')
  assert.deepEqual(broken.archives, [])

  for (const bad of ['{"gapIds":[]}', '{"gapIds":null}', '{"gapIds":"G-1"}', '{}', '{"gapIds":[1,2]}', '[]']) {
    const r = ledgerCorpus(bad, 'ledger.json')
    assert.equal(r.absent, false, `${bad} 是形状问题,不是缺文件`)
    assert.ok(r.error && /gapIds/.test(r.error), `${bad} 必须 error 且点名 gapIds,实得:${r.error}`)
    assert.deepEqual(r.archives, [])
  }
})

// ═══ 2026-10-16 新语义②:判据③ 的射程按**凭据形状**切换(绝对式 / 拆半式)═══════════
//
// 拆半档只把"台账派生那一半"降级成 note;代码侧被删仍判红;任一输入取不到 ⇒ 回落绝对式。
// 所有档位用**同一组数字**构造,只有 mode/输入变 ⇒ 测的是射程,不是阈值。

const items = (n) => Array.from({ length: n }, (_, i) => ({ id: `e${i}` }))
const LEDGER_PARTS = { implemented: items(40), gapCount: 5, elementCountBaseline: 40, mode: 'retirement-ledger' }
const reds = (out) => out.filter((v) => v.kind === 'inventory-regression')
const notesOf = (out) => out.filter((v) => v.kind === 'inventory-shortfall-note')

test('checkBaseline① face 档沿用绝对式:文案逐字未动(证明绝对式没被这轮改射程动过)', () => {
  const out = checkBaseline(60, 103, '(夹具说明)')
  assert.equal(out.length, 1)
  assert.equal(out[0].kind, 'inventory-regression')
  assert.equal(out[0].id, '(inventory)')
  assert.match(
    out[0].detail,
    /^清单条目 60 < 基线 103\(夹具说明\) —— 删任务行或删已实现元素必须同 PR 说明理由并调基线;基线不为变绿而下调,本判据的\*\*阈值\*\*不是本票的可调项$/,
  )
  // 持平/上涨一律不判红(绝对式本身没被改成"只报数")
  assert.deepEqual(checkBaseline(103, 103, '', { mode: 'face' }), [])
  assert.deepEqual(checkBaseline(104, 103, '', { mode: 'face' }), [])
})

test('checkBaseline② 拆半档:代码侧够而台账派生不足 ⇒ 只出 note,violations 为 0', () => {
  const out = checkBaseline(45, 103, '(夹具说明)', LEDGER_PARTS)
  assert.equal(reds(out).length, 0, `同一组数字在 face 档是红,拆半档必须放行台账派生那一半:${JSON.stringify(out)}`)
  const ns = notesOf(out)
  assert.equal(ns.length, 1)
  assert.equal(ns[0].id, '(inventory-plan-derive)')
  assert.match(ns[0].detail, /台账派生编号 5 < 额度 63/, `note 必须把两个数都报出来:${ns[0].detail}`)
  assert.match(ns[0].detail, /不判红/, 'note 自己必须说明这是存量、不判红')
  assert.equal(out.length, ns.length, '拆半档这一支不得混进任何判红种类')
})

test('checkBaseline③ 拆半档仍拦代码侧:entryCount − gapCount < elementCountBaseline ⇒ 必红并点出两个数', () => {
  const out = checkBaseline(45, 103, '', { ...LEDGER_PARTS, implemented: items(35), gapCount: 10 })
  const rs = reds(out)
  assert.equal(rs.length, 1, `删已实现元素(代码侧 35 < 额度 40)必须被抓:${JSON.stringify(out)}`)
  assert.match(rs[0].detail, /代码侧条目 35 < 额度 40/)
  assert.match(rs[0].detail, /entryCount 45/)
  assert.match(rs[0].detail, /台账派生 10/)
  assert.equal(rs[0].id, '(inventory)')
  // 同时台账派生那一半照旧只报数(note 与红并存,互不遮蔽)
  assert.equal(notesOf(out).length, 1)
  // 正向对照:代码侧正好持平 ⇒ 只剩 note
  const ok = checkBaseline(45, 103, '', { ...LEDGER_PARTS, implemented: items(40), gapCount: 5 })
  assert.equal(reds(ok).length, 0, '代码侧持平不得误伤')
})

test('checkBaseline④ 拆半档任一输入取不到 ⇒ 回落绝对式判红(宁多拦一次,绝不静默放行)', () => {
  for (const [label, parts] of [
    ['缺 elementCountBaseline', { implemented: items(40), gapCount: 5, mode: 'retirement-ledger' }],
    ['缺 implemented', { gapCount: 5, elementCountBaseline: 40, mode: 'retirement-ledger' }],
    ['缺 gapCount', { implemented: items(40), elementCountBaseline: 40, mode: 'retirement-ledger' }],
    ['elementCountBaseline 非数', { implemented: items(40), gapCount: 5, elementCountBaseline: '四十', mode: 'retirement-ledger' }],
    ['implemented 非数组', { implemented: 40, gapCount: 5, elementCountBaseline: 40, mode: 'retirement-ledger' }],
    ['parts 整个缺省', undefined],
  ]) {
    const out = checkBaseline(45, 103, '', parts)
    assert.equal(reds(out).length, 1, `${label} ⇒ 必须落回绝对式判红,实得 ${JSON.stringify(out)}`)
    assert.match(reds(out)[0].detail, /^清单条目 45 < 基线 103/, `${label} 回落的必须是绝对式那句原话`)
    assert.equal(notesOf(out).length, 0, '回落档不得同时产 note')
  }
  // 正向对照:三样输入齐备时同一组数字走拆半(证明上面不是无脑判红)
  assert.equal(reds(checkBaseline(45, 103, '', LEDGER_PARTS)).length, 0)
})

test('checkBaseline⑤ 变异对照:只有 mode 变、数字一律不动 ⇒ 射程真的由凭据形状驱动', () => {
  for (const mode of [undefined, null, '', 'face', 'FACE', 'ledger', 'retirement-ledger-x', 0, true]) {
    const out = checkBaseline(45, 103, '', { ...LEDGER_PARTS, mode })
    assert.equal(reds(out).length, 1, `mode=${JSON.stringify(mode)} 必须走绝对式(拆半档只认 'retirement-ledger' 这一个值)`)
    assert.equal(notesOf(out).length, 0, `mode=${JSON.stringify(mode)} 不得产 note`)
  }
  const halved = checkBaseline(45, 103, '', { ...LEDGER_PARTS, mode: 'retirement-ledger' })
  assert.equal(reds(halved).length, 0)
  assert.equal(notesOf(halved).length, 1)
})

test('runChecks 集成:凭据形状是 ledger ⇒ note 进 inventoryNotes、绝不混进 violations', () => {
  const data = baseData({
    entryCountBaseline: 4,
    elementCountBaseline: 1,
    implemented: [{ id: 'ok', anchors: [{ file: 'package.json' }], events: [] }],
  })
  const res = runChecks({
    data,
    planText: '',
    contractPy: '',
    contractTs: '',
    archives: [{ path: `${LEDGER_REL}#gapIds`, text: 'G-1\nG-2\nG-3', ledger: true, gapIds: 3 }],
  })
  assert.equal(res.inventoryNotes.length, 1, `拆半档必须把缺口放进 inventoryNotes:${JSON.stringify(res.violations)}`)
  assert.equal(res.inventoryNotes[0].kind, 'inventory-shortfall-note')
  assert.deepEqual(res.violations, [], 'note 不参与退出码:违规出口必须一条不剩')
  // 反证:同一批输入换成面档形状的凭据 ⇒ mode 切回 face ⇒ 绝对式回来 ⇒ 必红、且不再产 note
  const face = runChecks({
    data,
    planText: '',
    contractPy: '',
    contractTs: '',
    archives: [{ path: '.ihui-agent/archive/PROJECT_PLAN_shape.md', text: 'G-1\nG-2\nG-3' }],
  })
  assert.equal(face.inventoryNotes.length, 0)
  assert.equal(face.violations.filter((v) => v.kind === 'inventory-regression').length, 1)
})

test('装车锁(2026-10-16 新语义):ledger 兜底 / 两源皆空仍 enumerated:0 / 判死 / note 真打印', () => {
  const srcText = readFileSync(join(ROOT_DIR, 'scripts', 'check-chat-element-coverage.mjs'), 'utf8')
  assert.equal(typeof ledgerCorpus, 'function', '源脚本必须把 ledgerCorpus 作为具名导出交出来(测试只 import,不复制)')
  // ① 面上 0 份 ⇒ 同一面取 ledger,绝不回落磁盘
  assert.match(srcText, /if \(files\.length === 0\) \{/, '面上没有归档件时必须显式走兜底分支')
  assert.match(srcText, /const l = ledgerCorpus\(got\.get\(specs\[0\]\)/, 'ledger 内容必须经 catBatch 从被审面取(磁盘副本不构成凭据)')
  assert.doesNotMatch(srcText, /ledgerCorpus\((readFileSync|existsSync)/, '不得按磁盘读 ledger 当被审内容')
  assert.match(srcText, /source: 'retirement-ledger'/, '取到 ledger ⇒ 来源必须显式报名')
  assert.match(srcText, /source: 'ledger-broken'/, '形状坏必须单独一档,不得静默当"没有那份"')
  // ② 两源皆空仍必须 enumerated:0(退役 ≠ 看不见)
  assert.match(srcText, /if \(l\.absent\)[\s\S]{0,200}enumerated: 0[\s\S]{0,120}source: 'none'/, '两源皆空必须照旧交调用方判死')
  assert.match(srcText, /if \(l\.error\)[\s\S]{0,200}enumerated: 0/, 'ledger 形状坏也不得冒计一份凭据')
  assert.match(srcText, /if \(corpus\.enumerated === 0\)[\s\S]{0,900}\n\s*return 2/, 'main 里枚举到 0 仍 return 2')
  // ③ 射程只由凭据形状决定,且取不到数就回落绝对式
  assert.match(srcText, /if \(mode === 'face'\) return absolute\(\)/, 'face 档必须原样沿用绝对式')
  assert.match(srcText, /if \(els === null \|\| gapCount === null \|\| elementFloor === null\) return absolute\(\)/, '输入取不到必须回落绝对式')
  assert.match(srcText, /mode: archives\.length > 0 && archives\.every\(\(a\) => a\.ledger === true\) \? 'retirement-ledger' : 'face'/, 'mode 必须由凭据形状推出,不是文案开关')
  assert.match(srcText, /const codeSide = entryCount - gapCount/, '拆半档必须真算代码侧')
  // ④ note 必须被打印出去(静默的绿与恒红门同样是本仓记过最多次的坑)
  assert.match(srcText, /res\.inventoryNotes[\s\S]{0,400}console\.error\(/, 'inventoryNotes 必须打印')
  assert.match(srcText, /for \(const n of res\.inventoryNotes \?\? \[\]\) console\.error\(/, '逐条打印,不得只报计数')
  assert.match(srcText, /inventoryNotes\.filter|baselineRes\.filter\(\(v\) => v\.kind === 'inventory-shortfall-note'\)/, 'note 与判红必须在源头就分桶')
})

// ─── 端到面(私有索引注入):证明"审面"这条判据真的有牙 ─────────────────────────
//
// 只在构造面上动**内容**(台账去掉全部 D 行 + 归档件带/不带同一批原文),基线一个字没改。
// 全程只写私有索引(`GIT_INDEX_FILE` 指向 scratch)与 scratch 里的临时 blob,**不碰任何被跟踪文件**。

const GIT = process.env.GIT_BIN || (process.platform === 'win32' ? 'C:/Program Files/Git/bin/git.exe' : 'git')

function gitIn(args, env, input) {
  const r = spawnSync(GIT, ['-c', 'safe.directory=*', '-C', ROOT_DIR, ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    env,
    input,
    windowsHide: true,
    timeout: 120_000,
    maxBuffer: 64 << 20,
  })
  if (r.status !== 0) throw new Error(`git ${args[0]} 失败: ${(r.stderr || r.error?.message || '').split('\n')[0]}`)
  return r.stdout
}

/**
 * @param {{planText:string|null, archiveText:string|null, dropRealArchives:boolean,
 *          dropLedger?:boolean, ledgerText?:string|null}} spec
 * @returns {{rc:number, out:string}}
 */
function runStagedWithPrivateIndex(spec) {
  const dir = mkScratch('g57-e2e')
  const idx = join(dir, 'idx')
  const env = { ...process.env, GIT_INDEX_FILE: idx }
  try {
    gitIn(['read-tree', 'HEAD'], env)
    const realArchives = gitIn(['ls-files', '--', '.ihui-agent/archive'], env)
      .split('\n')
      .filter((p) => ARCHIVE_FILE_RE.test(p))
    if (spec.dropRealArchives) {
      for (const p of realArchives) gitIn(['update-index', '--force-remove', p], env)
    }
    // 补偿维的第二来源(2026-10-16):面上归档件为 0 时由退役 ledger 顶上。
    // 想测"两个来源都空 ⇒ 判死"必须把**它也从私有索引里摘掉**,否则测的只是"还没提交"。
    if (spec.dropLedger) gitIn(['update-index', '--force-remove', LEDGER_REL], env)
    if (spec.planText !== null) {
      const f = join(dir, 'plan.md')
      writeFileSync(f, spec.planText, 'utf8')
      const sha = gitIn(['hash-object', '-w', f], env).trim()
      gitIn(['update-index', '--add', '--cacheinfo', `100644,${sha},PROJECT_PLAN.md`], env)
    }
    if (spec.archiveText !== null) {
      const f = join(dir, 'arch.md')
      writeFileSync(f, spec.archiveText, 'utf8')
      const sha = gitIn(['hash-object', '-w', f], env).trim()
      gitIn(
        ['update-index', '--add', '--cacheinfo', `100644,${sha},.ihui-agent/archive/PROJECT_PLAN_E2E-injected.md`],
        env,
      )
    }
    if (typeof spec.ledgerText === 'string') {
      const f = join(dir, 'ledger.json')
      writeFileSync(f, spec.ledgerText, 'utf8')
      const sha = gitIn(['hash-object', '-w', f], env).trim()
      gitIn(['update-index', '--add', '--cacheinfo', `100644,${sha},${LEDGER_REL}`], env)
    }
    // 2026-10-04：不吃的子进程必须给 stdio，否则本机报 spawnSync EBUSY
    const r = spawnSync(process.execPath, [join(ROOT_DIR, 'scripts', 'check-chat-element-coverage.mjs'), '--staged'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      env,
      cwd: ROOT_DIR,
      windowsHide: true,
      timeout: 300_000,
      maxBuffer: 64 << 20,
    })
    return { rc: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` }
  } finally {
    rmScratch(dir)
  }
}

// 两臂要的"整批 D 行"必须按**构造**保证,不能拿台账当下面孔赌数量。
// 起因(2026-10-16 现读):HEAD 台账面上只剩 **12** 行 D 族行,而两臂钉的是 `>= 20` ⇒ 同一次跑里
// 端到端①/② 双双红在夹具断言,而门体与另外 37 条用例全绿 —— 红的是尺子的前提,不是判据。
// 让台账变瘦的正是本门要容忍的那台机器(归档阈值 0 起,完成的 D 行被持续搬进归档件),所以
// "台账里还剩几行 D"是一条**只会往下走**的曲线:把 20 改成 10 只是把恒红往后推一格,顺带把
// "批量够不够"这条充分性判据本身废掉。故阈值一位不降,改为构造:
// 真实 D 行照旧全量取(仍用真语料,台账一行都不留),不足下限时补造样行 —— 每条带**互不相同**
// 的 `G-<n>`,并用源脚本自己的 `gapIdsOfText`(§22c,不复制判据)复核"这批真贡献了 ≥下限个编号",
// 造样因此不可能退化成空转装饰。台账面归零后两臂照样成立。
//
// 2026-10-16 门体把判据③ 的射程改成**按凭据形状切换**后,这个下限换了算法而不是被调低:
// 注入归档件 ⇒ 面上有 PROJECT_PLAN_*.md ⇒ `source='face'` ⇒ mode='face' ⇒ **绝对式原样生效**
// (`entryCount < entryCountBaseline` 判红)。夹具把台账 D 行清空成 0 条贡献,于是全部额度必须由
// 那一份注入的归档件补回 ⇒ 下限 = entryCountBaseline − implemented.length(当次实测 103 − 40 = 63)。
// 两个数都从台账现读,不写死:额度或已实现元素一变,下限跟着走,构造仍然自证。
const GAP_FLOOR = LEDGER.entryCountBaseline - LEDGER.implemented.length
const MOVED_MIN = Math.max(20, GAP_FLOOR)

function buildMovedBatch() {
  const headPlan = gitIn(['show', 'HEAD:PROJECT_PLAN.md'], { ...process.env, GIT_INDEX_FILE: undefined })
  const re = new RegExp(PS.taskLinePattern, 'mu')
  const kept = []
  const moved = []
  for (const l of headPlan.split('\n')) (re.test(l) ? moved : kept).push(l)
  const ledgerRows = moved.length
  for (let n = 0; n <= 200; n += 1) {
    const ids = gapIdsOfText(moved.join('\n'), PS)
    if (moved.length >= MOVED_MIN && ids.size >= MOVED_MIN) {
      return { kept, moved, ledgerRows, ids: ids.size }
    }
    moved.push(
      `- [x] ✅(2026-10-16/g57-e2e 造样)**D${8800 + n} 端到端批量下限造样行(G-${800 + n})**:只活在归档面,不落台账`,
    )
  }
  throw new Error(`造样 200 行仍补不满下限(批量 ${MOVED_MIN} / 编号 ${MOVED_MIN})—— 检查 gapIdPattern 还认不认这批行`)
}

test('夹具自证:批量下限由构造保证,与台账面上剩几行无关', () => {
  // 下限算式的两个输入必须同源:拆半档用的额度也是 implemented.length,两处一旦分叉,
  // 夹具算出的 MOVED_MIN 就不再是门体真用的那道线。
  assert.equal(LEDGER.elementCountBaseline, LEDGER.implemented.length, '台账的 elementCountBaseline 必须等于 implemented 条数(拆半档额度同源)')
  assert.ok(GAP_FLOOR > 0, `额度算出 ${GAP_FLOOR} ≤ 0 ⇒ 台账数据自相矛盾(entryCountBaseline ${LEDGER.entryCountBaseline} / implemented ${LEDGER.implemented.length})`)
  const b = buildMovedBatch()
  assert.ok(b.moved.length >= MOVED_MIN, `批量 ${b.moved.length} < 下限 ${MOVED_MIN}`)
  assert.ok(b.ids >= MOVED_MIN, `这批行只贡献 ${b.ids} 个编号 ⇒ 造样是空转装饰,不是批量`)
  assert.match(b.moved.join('\n'), /g57-e2e 造样/, '台账面瘦到需要造样时,造样行必须真在批量里')
})

test('端到端①(牙):台账里整批 D 行消失、同字逐字出现在同面归档件 ⇒ --staged 不判红', () => {
  const { kept, moved } = buildMovedBatch()
  const a = runStagedWithPrivateIndex({
    planText: kept.join('\n'),
    archiveText: `# 已归档(E2E 注入,内容 = 从台账搬走的原文逐字)\n\n${moved.join('\n')}\n`,
    // 保留真实归档件:台账清空后 rc=0 只能由"归档面确实带着那一行"换来(基线 = 额度条 G-ID
    // + implemented 个已实现元素,而本夹具让台账贡献 0 条),不靠夹具自己凑数。
    dropRealArchives: false,
  })
  assert.equal(a.rc, 0, `搬走不得算撤销,实得 rc=${a.rc}\n${a.out}`)
  assert.match(a.out, /planned 任务 0 行/, `夹具必须真把台账的 D 行清空:\n${a.out}`)
  assert.match(a.out, /归档件补回 [1-9]/, `必须报出"归档件补回"的条数,实得:\n${a.out}`)
  assert.doesNotMatch(a.out, /inventory-regression/, `不得判红:\n${a.out}`)
  // 射程锁:面上有归档件 ⇒ 必须走绝对式('face'),而不是拿拆半档的 note 当后门把这一臂糊过去。
  // (note 只在 source='retirement-ledger' 时才可能产生,所以这里"没有 note"就是"mode=face"的证据。)
  assert.doesNotMatch(a.out, /inventory-shortfall-note/, `注入归档件后 mode 必须切回 face 绝对式,实得:\n${a.out}`)
  assert.doesNotMatch(a.out, /本维改用入库退役 ledger/, '面档凭据在场时 ledger 不得抢来源(见端到端④)')
  // 反向锁:补偿凭据在本仓必须真存在(两源任一),否则本门日常就只是"判死"而非"判过"
  const corpus = readArchiveCorpus('staged', ROOT_DIR)
  assert.ok(
    corpus.enumerated > 0 && (corpus.source === 'face' || corpus.source === 'retirement-ledger'),
    `本仓审面必须带着补偿凭据(归档件或退役 ledger),实得 enumerated=${corpus.enumerated} source=${corpus.source}`,
  )
})

test('端到端②(反向对照):台账与归档件**两侧都没有**那批行 ⇒ --staged 仍判红并点名', () => {
  const { kept, moved } = buildMovedBatch()
  const b = runStagedWithPrivateIndex({
    planText: kept.join('\n'),
    archiveText: '# 已归档(E2E 注入,里面一行任务行都没有)\n\n普通散文,不含 D 族行。\n',
    dropRealArchives: true,
    // 补偿来源整批摘掉(面档被注入的散文件替掉、ledger 也从私有索引摘走)⇒
    // 这一臂测的是"摘掉补偿来源仍能测出红",牙必须留在这里。
    dropLedger: true,
  })
  assert.equal(b.rc, 1, `两侧都无必须判红,实得 rc=${b.rc}\n${b.out}`)
  assert.match(b.out, /inventory-regression/, `必须点名条目倒退:\n${b.out}`)
  assert.doesNotMatch(b.out, /inventory-shortfall-note/, '判红那一档不得同时把缺口降级成 note')
  assert.ok(moved.length >= MOVED_MIN, `夹具不成立:造样后批量仍只有 ${moved.length} 行`)
})

test('端到端③(判死):归档件与退役 ledger **两个来源都空** ⇒ exit 2「无法判定」,不得记绿', () => {
  const c = runStagedWithPrivateIndex({
    planText: null,
    archiveText: null,
    dropRealArchives: true,
    dropLedger: true,
  })
  assert.equal(c.rc, 2, `空枚举必须判死,实得 rc=${c.rc}\n${c.out}`)
  assert.match(c.out, /枚举到 0 份/, `必须点名是"枚举失效"而不是"没有违规":\n${c.out}`)
  assert.match(c.out, /两个来源都空/, '退役 ledger 也在同一句里点名,否则"archive 搬家"会被读成唯一病因')
})

// 来源优先级:ledger 只是"归档件整批退出"时的顶班凭据,**不得顶掉面上的真凭据**。
// 两臂都在私有索引里造出 ledger(内容 = HEAD 面 ledger blob 原文,不经它就无法证明"它在场"),
// 一臂再加一份面上归档件 ⇒ 必须读归档件(source='face')、不打印 ledger 那一行。
test('端到端④(来源优先级锁):面上同时有归档件与退役 ledger ⇒ 必须用归档件,ledger 不得顶掉真凭据', () => {
  const { kept, moved } = buildMovedBatch()
  // 不按工作区磁盘读 ledger:共享工作树下他席随时可删该盘副本(2026-10-19 实测 ` D` 在飞,
  // HEAD/索引面 blob 完好而盘上 0 字节 ⇒ 本臂曾因此 ENOENT)。磁盘快照不可作为仓库事实,
  // 与本文件 407/697 行两条形状锁同纪律;取被审的 HEAD 面 blob——夹具私有索引的基面
  // 正是 read-tree HEAD,同面同轮。取不到 ⇒ gitIn 当场 throw 点名,不静默换夹具(§0.3)。
  const ledgerText = gitIn(['show', `HEAD:${LEDGER_REL}`], process.env)
  assert.ok(ledgerText.trim(), `${LEDGER_REL} 取不到或为空 ⇒ 本臂的凭据无从构造(取不到就明说,不静默换夹具)`)
  const both = runStagedWithPrivateIndex({
    planText: kept.join('\n'),
    archiveText: `# 已归档(E2E 注入,与 ledger 同面并存)\n\n${moved.join('\n')}\n`,
    dropRealArchives: true,
    ledgerText,
  })
  assert.doesNotMatch(both.out, /本维改用入库退役 ledger/, `ledger 在场也不得抢来源:\n${both.out}`)
  assert.match(both.out, /归档件补回 [1-9]/, `来源必须是面档归档件(补回数只有它给得出):\n${both.out}`)
  assert.doesNotMatch(both.out, /inventory-shortfall-note/, '面档在场 ⇒ mode 必须是 face 绝对式')
  assert.equal(both.rc, 0, `面档凭据足够时不得判红,实得 rc=${both.rc}\n${both.out}`)
  // 正向对照(同面只留 ledger):来源切到 ledger,那一行必须打印出来 —— 证明上一条 doesNotMatch 有牙
  const only = runStagedWithPrivateIndex({
    planText: kept.join('\n'),
    archiveText: null,
    dropRealArchives: true,
    ledgerText,
  })
  assert.match(only.out, /本维改用入库退役 ledger/, `只剩 ledger 时必须报名:\n${only.out}`)
  assert.match(only.out, /归档件补回 0/, 'ledger 正文是裸编号,不得被当成"面档补回"混计')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
