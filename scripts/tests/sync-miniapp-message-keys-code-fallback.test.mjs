// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console */
/**
 * tests/sync-miniapp-message-keys-code-fallback.test.mjs —— code-fallback 面镜像测试
 * (§22c:判据只 import 生产 __test__,零复制;覆盖票面六项:
 *  ①嵌套引号/括号兜底串取对 ②注释里的假兜底不算命中(遮注释前后计数变化的反向对照)
 *  ③已存在键跳过并计数 ④取值取不到 ⇒ unresolvable 逐枚点名不折 0
 *  ⑤写盘前后逐叶子键守恒(只许多目标键) ⑥四语队列如实报数)
 */
import assert from 'node:assert/strict'

import { __test__ as X } from '../sync-miniapp-message-keys.mjs'

let n = 0
const ok = (name, fn) => {
  fn()
  n++
  console.log(`  ✓ ${name}`)
}

// —— 测试侧的取材替身(不复制判据:只把"盘面/包面"喂给生产裁决器)——
const pack = {
  'miniapp-taro/zh-CN': {},
  'miniapp-taro/zh-TW': {},
  'miniapp-taro/en': {},
  'miniapp-taro/ja': {},
  'miniapp-taro/ko': {},
  'shared/zh-CN': {},
  'shared/zh-TW': {},
  'shared/en': {},
  'shared/ja': {},
  'shared/ko': {},
  'mobile-rn/zh-CN': {},
  'web/zh-CN': {},
}
const readFrom = (p) => (packName, lang) => p[`${packName}/${lang}`] ?? null
const itemsOf = (map) => Object.entries(map).map(([rel, text]) => ({ rel, text }))

// ═════ 票面① 嵌套引号/括号的兜底串必须取对 ═════
ok('①兜底串含嵌套双引号/括号/转义:逐字节取对,且首参逐字对账', () => {
  const text = [
    "const tt = useTt()",
    `const a = tt('k.q1', '他说"好(行)"')`,
    `const b = tt('k.q2', 'it\\'s (ok) \\\\ and \\n next')`,
    `const c = tt('k.q3', '多行(嵌套(t(...)))逗号,不算分裂')`,
  ].join('\n')
  const { hits, unresolvable } = X.extractCodeFallbackHits(text)
  assert.deepEqual(unresolvable.map((u) => u.key), [], `不该有取值失败:${JSON.stringify(unresolvable)}`)
  const by = Object.fromEntries(hits.map((h) => [h.key, h.fb]))
  assert.equal(by['k.q1'], '他说"好(行)"')
  assert.equal(by['k.q2'], "it's (ok) \\ and \n next")
  assert.equal(by['k.q3'], '多行(嵌套(t(...)))逗号,不算分裂')
  assert.equal(hits.length, 3)
})

// ═════ 票面② 注释里的假兜底不算命中(遮注释前后计数变化的反向对照) ═════
ok('②注释/字符串里的 tt(x,假兜底) 不算命中:遮蔽前后计数对比钉住,命中只剩代码位', () => {
  const text = [
    "const tt = useTt()",
    "const real = tt('k.one', '真命中')",
    "// const fake = tt('k.two', '假兜底')",
    "/* const fake2 = tt('k.three', '假兜底2') */",
    "const inString = 'tt(\"k.four\", \"假兜底3\")'",
  ].join('\n')
  // 反向对照钉法:同一文本去掉注释前后各跑一遍生产尺 ⇒ 命中数必须从 4 掉到 1(计数变化本身就是钉子)
  const withComments = X.extractCodeFallbackHits(text)
  const withoutComments = X.extractCodeFallbackHits(
    [
      "const tt = useTt()",
      "const real = tt('k.one', '真命中')",
      "const fake = tt('k.two', '假兜底')",
      "const fake2 = tt('k.three', '假兜底2')",
      "const fake3 = tt('k.four', '假兜底3')",
    ].join('\n'),
  )
  assert.equal(withoutComments.hits.length, 4, '未遮时 4 枚全进射程(对照组)')
  assert.equal(withComments.hits.length, 1, '遮注释/字符串后只剩代码位那枚')
  assert.equal(withComments.hits[0].key, 'k.one')
  assert.equal(withComments.hits[0].fb, '真命中')
  assert.deepEqual(withComments.unresolvable, [], '注释里的假兜底连 unresolvable 都不算(根本没进射程)')
})

// ═════ 票面④ 取值取不到 ⇒ unresolvable 逐枚点名,不折 0 ═════
ok('④第二参非字面量/括号不配平/空兜底 ⇒ 逐枚点名,枚数=点名数(不静默归零)', () => {
  const text = [
    "const tt = useTt()",
    "const a = tt('u.bare', someVar)",
    'const b = tt(\'u.tpl\', `前缀${x}后缀`)',
    "const c = tt('u.empty', '   ')",
    "const d = tt('u.unbal', 'x'",
  ].join('\n')
  const { hits, unresolvable } = X.extractCodeFallbackHits(text)
  assert.equal(hits.length, 0)
  const keys = unresolvable.map((u) => u.key).sort()
  assert.deepEqual(keys, ['u.bare', 'u.empty', 'u.tpl', 'u.unbal'])
  assert.ok(unresolvable.every((u) => typeof u.why === 'string' && u.why.length > 0))
  assert.equal(unresolvable.length, 4, '点名枚数必须等于失败枚数(不折 0)')
})

// ═════ 票面③ 已存在键跳过并计数(计划面 + 写盘面两层) ═════
ok('③zh 已存在的键:计划面不动词,写盘面 skipped 计数且文本逐字不变', () => {
  const p = structuredClone(pack)
  p['miniapp-taro/zh-CN'] = { k: { one: '盘面已有(不是兜底串)' } }
  const plan = X.planCodeFallback({
    items: itemsOf({ 'a.ts': "const tt = useTt(); tt('k.one', '兜底串')" }),
    readPack: readFrom(p),
  })
  assert.deepEqual(plan.moves, [], '只补空:zh 已在面上绝不产覆盖计划')
  assert.equal(plan.translateQueue.length, 1)
  assert.deepEqual(plan.translateQueue[0].missingLangs.sort(), ['en', 'ja', 'ko', 'zh-TW'])
  // 写盘层:即使误投 move,insertLeafPath 也必须 skipped 且一字不改
  const text = `{\n  "k": {\n    "one": "盘面已有"\n  }\n}\n`
  const r = X.insertLeafPath(text, 'k.one', '兜底串')
  assert.equal(r.ok, true)
  assert.equal(r.skipped, true)
  assert.equal(r.text, text)
})

// ═════ 票面⑥ 四语队列如实报数(本器只落 zh,绝不代拟翻译) ═════
ok('⑥队列报数:新落键 ×4 语 + 历史已落而四语仍缺的键,逐枚点名 missingLangs;moves 只有 zh-CN', () => {
  const p = structuredClone(pack)
  p['miniapp-taro/zh-CN'] = { legacy: { kept: '旧兜底已落' } } // 历史轮落的 zh,四语仍缺
  const plan = X.planCodeFallback({
    items: itemsOf({
      'a.ts': "const tt = useTt(); tt('fresh.key', '新鲜兜底'); tt('legacy.kept', '旧兜底串')",
    }),
    readPack: readFrom(p),
  })
  assert.equal(plan.moves.length, 1)
  assert.deepEqual(
    plan.moves.map((m) => `${m.lang}:${m.key}`),
    ['zh-CN:fresh.key'],
    '本型只能产出 zh-CN 值(来自代码兜底串)',
  )
  assert.equal(plan.moves[0].value, '新鲜兜底')
  const q = Object.fromEntries(plan.translateQueue.map((x) => [x.key, x]))
  assert.deepEqual(q['fresh.key'].missingLangs.sort(), ['en', 'ja', 'ko', 'zh-TW'])
  assert.equal(q['fresh.key'].status, 'after-landing')
  assert.deepEqual(q['legacy.kept'].missingLangs.sort(), ['en', 'ja', 'ko', 'zh-TW'])
  assert.equal(q['legacy.kept'].status, 'zh-already-present')
  assert.equal(plan.translateQueue.length, 2, '两枚都必须被数到(不折 0)')
  assert.deepEqual(plan.fbConflict, [])
})

ok('⑥反向:基准侧 zh 有真译文 ⇒ 归 baselineHas 桶点名,不落兜底串、不排队列(不抢 --key 道)', () => {
  const p = structuredClone(pack)
  p['mobile-rn/zh-CN'] = { rn: { key: 'RN 真译文' } }
  const plan = X.planCodeFallback({
    items: itemsOf({ 'a.ts': "tt('rn.key', '代码兜底')" }),
    readPack: readFrom(p),
  })
  assert.deepEqual(plan.moves, [])
  assert.deepEqual(plan.translateQueue, [])
  assert.deepEqual(plan.baselineHas.map((b) => `${b.key}←${b.from}`), ['rn.key←mobile-rn/zh-CN'])
})

ok('⑥同键两处兜底串不等 ⇒ fbConflict 点名、该键整枚不进计划(拒绝择一)', () => {
  const plan = X.planCodeFallback({
    items: itemsOf({
      'a.ts': "tt('dupe.k', '说法一')",
      'b.ts': "tt('dupe.k', '说法二')",
    }),
    readPack: readFrom(pack),
  })
  assert.equal(plan.fbConflict.length, 1)
  assert.equal(plan.fbConflict[0].key, 'dupe.k')
  assert.deepEqual(plan.moves, [], '冲突未裁决前一枚也不搬')
})

ok('⑥五语运行面齐全 ⇒ resolved,与本型无关(不产队列也不产计划)', () => {
  const p = structuredClone(pack)
  for (const key of Object.keys(p)) p[key] = { full: { key: 'x' } }
  const plan = X.planCodeFallback({
    items: itemsOf({ 'a.ts': "tt('full.key', '兜底')" }),
    readPack: readFrom(p),
  })
  assert.deepEqual(plan.resolved, ['full.key'])
  assert.deepEqual(plan.moves, [])
  assert.deepEqual(plan.translateQueue, [])
})

// ═════ 票面⑤ 写盘前后逐叶子键守恒(只许多目标键) ═════
const leavesOf = (obj, pre = '', out = []) => {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const key = pre ? `${pre}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) leavesOf(v, key, out)
    else out.push(key)
  }
  return out.sort()
}
ok('⑤落盘守恒:原叶逐键在、值逐字不动、目标键新增、深度3 走嵌套块、二次运行幂等', () => {
  const beforeText = `{
  "plaza": {
    "index": {
      "menu": "已有菜单"
    },
    "other": "标量占位"
  },
  "solo": {
    "keep": "别的命名空间"
  }
}
`
  const mkIo = (text) => {
    const state = { text, writes: 0 }
    return {
      state,
      io: {
        gate: { blocked: () => null },
        read: () => state.text,
        write: (_rel, t) => {
          state.writes++
          state.text = t
        },
        hash: () => 'a'.repeat(40),
        append: () => ({ appended: 1, deduped: 0, rejected: [] }),
      },
    }
  }
  const moves = [
    { key: 'plaza.index.loadFail', value: '加载失败' },
    { key: 'plaza.tab.title', value: '标签页' }, // 中段缺失 ⇒ 整段 graft
    { key: 'fresh.ns.leaf.deep', value: '全新命名空间' }, // 顶层缺失
    { key: 'solo.keep', value: '不许覆盖' }, // 已存在 ⇒ skipped
  ]
  const { state, io } = mkIo(beforeText)
  const res = X.landCodeFallback({ moves, io })
  assert.equal(res.state, 'landed')
  assert.deepEqual(res.landed.sort(), ['fresh.ns.leaf.deep', 'plaza.index.loadFail', 'plaza.tab.title'])
  assert.deepEqual(res.skipped, ['solo.keep'], '已存在键跳过并计数')
  assert.equal(state.writes, 1)
  const beforeLeaves = leavesOf(JSON.parse(beforeText))
  const after = JSON.parse(state.text)
  const afterLeaves = leavesOf(after)
  for (const l of beforeLeaves) assert.ok(afterLeaves.includes(l), `原叶丢失:${l}`)
  assert.deepEqual(
    afterLeaves.filter((l) => !beforeLeaves.includes(l)).sort(),
    ['fresh.ns.leaf.deep', 'plaza.index.loadFail', 'plaza.tab.title'],
    '只许多目标键',
  )
  assert.equal(after.plaza.other, '标量占位', '标量兄弟值逐字不动')
  assert.equal(after.solo.keep, '别的命名空间', '已有键一字未改')
  assert.equal(after.plaza.index.loadFail, '加载失败')
  assert.equal(after.plaza.tab.title, '标签页')
  assert.equal(after.fresh.ns.leaf.deep, '全新命名空间')
  // 幂等第二遍:盘面已有 ⇒ 全 skipped、零写
  const again = X.landCodeFallback({ moves, io })
  assert.equal(again.landed.length, 0)
  assert.equal(again.skipped.length, 4, '3 枚本轮已落 + solo.keep 一直在 = 4 枚全 skipped')
  assert.equal(state.writes, 1, '二次运行不得再写盘')
  assert.equal(again.state, 'noop')
})

ok('⑤脏面让路:归属闸 blocked ⇒ held,一个字节都不写', () => {
  const wrote = []
  const res = X.landCodeFallback({
    moves: [{ key: 'k.a', value: 'v' }],
    io: {
      gate: { blocked: () => '他席在飞:apps 有未提交改动' },
      read: () => {
        throw new Error('held 档不该读面')
      },
      write: (rel) => wrote.push(rel),
      hash: () => null,
      append: () => {
        throw new Error('held 档不该申报账本')
      },
    },
  })
  assert.equal(res.state, 'held')
  assert.equal(res.held.length, 1)
  assert.deepEqual(wrote, [], 'held ⇒ 零写')
})

ok('⑤任一叶失败 ⇒ 整文件拒写(全有或全无,与默认面同一失效方向)', () => {
  const text = `{\n  "scalar": "我是标量不是块"\n}\n`
  const state = { text, writes: 0 }
  const io = {
    gate: { blocked: () => null },
    read: () => state.text,
    write: (_r, t) => {
      state.writes++
      state.text = t
    },
    hash: () => 'b'.repeat(40),
    append: () => ({ appended: 1, deduped: 0, rejected: [] }),
  }
  const res = X.landCodeFallback({
    moves: [
      { key: 'ok.key', value: '这枚能落' },
      { key: 'scalar.deeper', value: '这枚撞标量' },
    ],
    io,
  })
  assert.equal(res.state, 'refused')
  assert.equal(state.writes, 0, '部分失败 ⇒ 整文件不写(不许写出半套)')
  assert.ok(res.failed.some((f) => f.includes('scalar.deeper')))
})

// ═════ 面分派与常量形状锁 ═════
ok('parseFaceArg:缺省=pack、合法值、未知值拒绝、多值互斥', () => {
  assert.deepEqual(X.parseFaceArg([]), { face: 'pack', error: null })
  assert.deepEqual(X.parseFaceArg(['--face=pack']), { face: 'pack', error: null })
  assert.equal(X.parseFaceArg(['--face=code-fallback']).face, 'code-fallback')
  assert.match(X.parseFaceArg(['--face=nosuch']).error, /不在册/)
  assert.match(X.parseFaceArg(['--face=pack', '--face=code-fallback']).error, /多个不同值/)
  assert.deepEqual([...X.FACES], ['pack', 'code-fallback'])
})

ok('形状锁:结论行令牌齐备 + 腿名独立(不共用默认腿 ⇒ 不污染默认道的 awaiting-landing 判定)', () => {
  const line = X.buildCodeFallbackVerdictLine({
    landing: 2,
    planned: 2,
    held: 0,
    written: 1,
    ledgerState: 'ok',
    translateQueue: 8,
    unresolvable: 0,
    fbConflict: 0,
    baselineHas: 1,
    outOfScope: 0,
  })
  for (const tok of ['结论 landing=', 'held=', 'ledger=', 'leg=', '待队列='])
    assert.ok(line.includes(tok), `结论行缺 ${tok}`)
  assert.ok(line.includes(`leg=${X.CROSS_END_LEG_CODE_FALLBACK}`))
  assert.ok(line.includes('待队列=8'))
  assert.equal(X.CROSS_END_LEG_CODE_FALLBACK, 'miniapp-code-fallback')
  assert.notEqual(X.CROSS_END_LEG_CODE_FALLBACK, X.CROSS_END_LEG, '两腿必须不同名(账本按腿名隔离)')
  assert.deepEqual([...X.CODE_FALLBACK_SCAN_TARGETS], ['apps/miniapp-taro/src'])
  assert.deepEqual([...X.RUNTIME_PACKS], ['miniapp-taro', 'shared'])
})

ok('清单入口:--key 给定时只处理点名键(与默认面同一把 parseKeyArgs),射程外只报数不点名', () => {
  const plan = X.planCodeFallback({
    items: itemsOf({
      'a.ts': "tt('in.scope', '范围内')\ntt('out.unres', v)\ntt('out.scope2', '范围外兜底')",
    }),
    readPack: readFrom(pack),
    onlyKeys: new Set(X.parseKeyArgs(['--key', 'in.scope']).items.flatMap((k) => k.keys.map((kk) => `${k.ns}.${kk}`))),
  })
  assert.deepEqual(plan.moves.map((m) => m.key), ['in.scope'])
  assert.deepEqual(plan.unresolvable, [], '未点名的取值失败不进点名集(不冒红别人的行)')
  assert.equal(plan.outOfScope, 1, '但必须如实报数,不折 0')
})

console.log(`\n✅ sync-miniapp-message-keys code-fallback 面镜像测试 ${n} 例通过`)
export const runSelfTest = () => 0
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
