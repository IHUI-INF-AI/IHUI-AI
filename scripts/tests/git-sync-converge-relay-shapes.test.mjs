// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试(§22c):git-sync-converge 转述层对 union-converge **顶格结论行**的逐型不吞保证。
//
// 立项实据(2026-11-06,本窗实测):转述器旧版只认「❌ 落地闸不过 N 处:」一型顶格 ❌ 与摘要
// 「需人工 N」计数;union-converge 其余的顶格结论行(旁路删除硬门、内容级防丢闸、CAS 失败、
// 用法错/闸未判定/旗标取值错族、落地后判据复跑、UNDETERMINED 未判定)整行被吃掉,counts 回落
// `?? 0` ⇒ 外层只剩「落地闸不过 0 处 / 需人工 0 项 / exit=1」,红不报名(§0.3 反面 + §5e-1)。
//
// 判据对象 = "每一种顶格结论行都必须原样带出并计入分型计数"。形态清单与全部正则一律 import
// 源脚本出口(UNION_VERDICT_SHAPES / UNION_HEADLINE_FALLBACK_RE / unionShapeLabelOf),
// 本文件不复制任何判据正则(§22c);夹具只放**逐字取自 union-converge 打印点模板**的样本行(数据)。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  extractUnionVerdict,
  describeUnionRelay,
  unionExitMark,
  UNION_VERDICT_SHAPES,
  UNION_HEADLINE_FALLBACK_RE,
  unionShapeLabelOf,
} from '../git-sync-converge.mjs'

const UNION_SRC = readFileSync(new URL('../union-converge.mjs', import.meta.url), 'utf8')

// 样本行逐字对照 union-converge 的打印点(2026-11-06 现读;file:line 清单见 UNION_VERDICT_SHAPES 头注)。
const FIXTURES = [
  {
    id: 'landing-gate',
    lines: [
      '[union-converge] APPLY base=abc12345678 ours=def45678901 theirs=ghi78901234 / 取对侧 0 路径 / 活文档整份取对侧 0 / 两侧同改三方归并 0 / 需人工 0 / 对侧删除不传播 0 / 删除随合并传播 0 / 影子 .js 随合并删掉 0 / 影子 .js 未恢复 0 / 活文档行 union',
      '❌ 落地闸不过 2 处:',
      '   · PROJECT_PLAN.md 归并放大任务状态分叉:F1 同主键两态并存(组) 各侧最多 100,归并结果 147',
      '   · AGENTS.md F9 归并新增撞号组(组):「H-1」',
    ],
    detail: true,
    number: 2,
  },
  {
    id: 'bypass-delete-gate',
    lines: [
      '❌ 旁路删除硬门拒绝落地 1 处(apps/**、packages/** 必须"0 引用 + 删除意图台账"):',
      '  · apps/api/src/routes/x.ts —— 仍有引用:2 处;删除意图台账:无',
    ],
    detail: true,
    number: 1,
  },
  {
    id: 'content-loss-gate',
    lines: [
      '❌ 内容级防丢闸拒绝落地:1 个路径少带内容(逐条点名)',
      '  · packages/i18n/locales/en.json —— 对侧缺失键 1:"a.b"',
    ],
    detail: true,
    number: 1,
  },
  { id: 'flag-gate-undetermined', lines: ['❌ 闸未判定:judgeFlags 拿不到已登记旗标清单 ⇒ 不记通过'] },
  { id: 'usage-error', lines: ['❌ 用法错:--nope 不在已登记旗标清单里 ⇒ 需要定向说明'] },
  {
    id: 'flag-value-error',
    lines: ['❌ --theirs 需要一个提交规格 —— 紧邻的 token 实得:null(不得静默退回默认)'],
  },
  { id: 'resolve-arg-error', lines: ['❌ --resolve 需要 <path>=<内容文件>,得到的是:AGENTS.md'] },
  {
    id: 'declaration-doc-error',
    lines: [
      '❌ --supersede 需要 <path>=<声明档 JSON>,得到的是:README.md',
      '❌ --fold-keep 声明档不是 JSON(x.json=y.json):Unexpected end of JSON input',
      '❌ --declare-side-loss 声明档第 1 项没有 dropped(被取代行的逐字字面)⇒ 拒绝执行',
      '❌ --accept-state-growth 需要 <维>=<理由>,得到的是:F11',
    ],
    count: 4,
  },
  {
    id: 'cas-fail',
    lines: [
      '❌ CAS 失败(HEAD 被他人推进)⇒ 本轮作废,重跑即可;产物 0123456789a 已按 §22 备份为 lost-commit/x',
    ],
  },
  {
    id: 'post-landing-red',
    lines: [
      '❌ 落地后受影响判据复跑判红(blocking 2 臂)⇒ 本枚合并已在 HEAD 0123456789a(不回滚),但拒绝报绿静默;修复后请就地再落一次更正提交',
    ],
  },
  {
    id: 'post-landing-unjudged',
    lines: [
      '❌ 落地后受影响判据复跑有臂无法判定(1 臂)⇒ 未判定不等于通过;本枚合并已在 HEAD 0123456789a(不回滚),请人工复跑点名臂',
    ],
  },
  { id: 'undeclared', lines: ['[union-converge] UNDETERMINED 未判定:FETCH_HEAD 不在本机'] },
]

const body = (fixture, extra = []) => [...extra, ...fixture.lines].join('\n')
const marked = (b, code) => `${b}${unionExitMark(code)}`
const expectCount = (fixture) => fixture.count ?? 1

test('S0 形态清单成套:表 id 集 == 夹具 id 集,且每一条都是可用正则(摘一行/加一型不登记都会翻红)', () => {
  const tableIds = UNION_VERDICT_SHAPES.map((s) => s.id).sort()
  const fixtureIds = FIXTURES.map((f) => f.id).sort()
  assert.deepEqual(tableIds, fixtureIds, '形态表与逐型夹具必须同集(§0.6 一张表两边对账)')
  for (const s of UNION_VERDICT_SHAPES) {
    assert.ok(s.re instanceof RegExp, `${s.id} 的 re 必须是正则`)
    assert.equal(typeof s.id, 'string')
  }
})

for (const fixture of FIXTURES) {
  test(`S1 正证·${fixture.id}:该型顶格结论行必须逐字带出并计入分型计数`, () => {
    const v = extractUnionVerdict(marked(body(fixture), 1))
    for (const line of fixture.lines) {
      assert.ok(v.lines.includes(line), `结论行没被逐字带出:${line}`)
    }
    assert.equal(v.shapeCounts[fixture.id], expectCount(fixture), '分型计数必须落在自己的型上')
    assert.equal(v.hits.none, false, '明明有顶格结论却报 none ⇒ 就是本窗踩过的吞行')
    if (fixture.detail) {
      const detailLine = fixture.lines.find((l) => /^[ \t]+\S/.test(l))
      assert.ok(detailLine && v.lines.includes(detailLine), 'detail 型的缩进点名行必须随行带出')
    }
    if (fixture.id === 'landing-gate') {
      assert.equal(v.gateCount, fixture.number)
      assert.equal(v.needHumanCount, 0, '摘要行「需人工 0」的读数不得被分型表顶掉')
    }
  })

  test(`S2 变异臂·${fixture.id}:从表里摘掉这一型 ⇒ 行仍被兜底网带出(只降级不许吞)`, () => {
    const stripped = UNION_VERDICT_SHAPES.filter((s) => s.id !== fixture.id)
    const v = extractUnionVerdict(marked(body(fixture), 1), { shapes: stripped })
    for (const line of fixture.lines.filter((l) => !/^[ \t]+\S/.test(l))) {
      assert.ok(v.lines.includes(line), `摘掉表行后兜底网仍必须带出:${line}(静默吞=本票的病)`)
    }
    assert.equal(v.shapeCounts[fixture.id], undefined, '摘掉的型不得再有自己的分型计数(正证必须靠它翻红)')
    assert.ok(
      Object.keys(v.shapeCounts).some((k) => k.startsWith('other:')),
      '摘掉的型必须落入 other:<型名> 桶并计数(分型可见)',
    )
    assert.equal(v.hits.none, false)
  })

  test(`S3 转述措辞·${fixture.id}:counts/headline 必须点出这一型,不许只剩 0/0`, () => {
    const relay = describeUnionRelay({ text: marked(body(fixture), 1), exitCode: 1 })
    assert.equal(relay.verdict.shapeCounts[fixture.id], expectCount(fixture))
    if (relay.kind === 'undetermined') {
      assert.ok(
        ['undeclared', 'flag-gate-undetermined'].includes(fixture.id),
        `只有未判定族才许走这支:${fixture.id}`,
      )
      assert.ok(relay.block.includes(fixture.lines[0]), '未判定支也必须把它的顶格行带进 block')
      assert.ok(relay.headline.startsWith('未判定:'), `headline 实得:${relay.headline}`)
      assert.doesNotMatch(relay.headline, /亦判需人工|判需人工/, '没资格判不得读成人工裁决')
      return
    }
    if (fixture.id === 'landing-gate') {
      assert.equal(relay.hasVerdict, true)
      assert.equal(relay.topRedOnly, false, '落地闸不过仍走原判需人工措辞(既有锁 R4)')
      assert.match(relay.counts, /落地闸不过 2 处/)
      assert.match(relay.counts, /需人工 0 项/)
      return
    }
    assert.equal(relay.hasVerdict, true)
    assert.ok(relay.counts.includes(`顶格结论`), `counts 必须报分型段:${relay.counts}`)
    assert.ok(relay.counts.includes(`${fixture.id}×${expectCount(fixture)}`), `分型必须点名本型:${relay.counts}`)
    assert.match(relay.counts, /exit=1/)
    if (relay.kind === 'need-human') {
      assert.equal(relay.topRedOnly, true, '只有顶格 ❌ 报红时不得沿用"判需人工"措辞')
      assert.ok(relay.headline.startsWith('union 顶格判红'), `headline 实得:${relay.headline}`)
      assert.doesNotMatch(relay.headline, /亦判需人工/)
    }
  })
}

test('S4 双摘除对照:表与兜底网同时失效才可能吞行 ⇒ 证明"逐型不吞"是结构性的', () => {
  const fixture = FIXTURES.find((f) => f.id === 'bypass-delete-gate')
  const never = /(?!)/
  const swallowed = extractUnionVerdict(marked(body(fixture), 1), {
    shapes: UNION_VERDICT_SHAPES.filter((s) => s.id !== 'bypass-delete-gate'),
    headlineFallback: never,
  })
  assert.equal(swallowed.hits.none, true, '本窗踩过的旧现实:表外 + 网失效 ⇒ 只剩 0/0(此臂只许在双摘时出现)')
  const singleArmOff = extractUnionVerdict(marked(body(fixture), 1), { headlineFallback: never })
  assert.equal(
    singleArmOff.shapeCounts['bypass-delete-gate'],
    1,
    '默认表在位时:摘掉兜底网也仍由表带出(两条腿各自成立)',
  )
})

test('S5 表外新形态:未登记的顶格 ❌ 必须被兜底网接住并记 other:<型名>', () => {
  const line = '❌ 未来新增的一型判红 3 处:'
  const v = extractUnionVerdict(marked(`${line}\n  · 条目甲\n  · 条目乙`, 1))
  assert.ok(v.lines.includes(line), '新形态最坏只降级成 other,不许被吞')
  assert.equal(v.shapeCounts[`other:${unionShapeLabelOf(line)}`], 1)
  assert.ok(v.lines.includes('  · 条目甲'), '以冒号收尾的顶格新形态同样必须接住其缩进条目段')
  const relay = describeUnionRelay({ text: marked(line, 1), exitCode: 1 })
  assert.equal(relay.hasVerdict, true)
  assert.ok(relay.counts.includes(`other:${unionShapeLabelOf(line)}×1`), `counts 实得:${relay.counts}`)
})

// 动态措辞单点:渲染文本由 lib 构造(见 lib/flag-value.mjs 的 `… 需要一个…`),打印点本身只有
// `❌ ${expr}` ⇒ 形态表按渲染后的形状认领,此处按**位点白名单**核对新增/消失,防止第四种顶格腿溜进无声区。
const PURE_DYNAMIC_HEADLINE_ALLOWLIST = ['❌ ${theirsFlag.error}', '❌ ${baseFlag.error}']

test('S6 装车漂移锁:union-converge 每一个静态顶格 ❌/UNDETERMINED 打印点都必须被形态表认领(§0.6)', () => {
  const sites = []
  const reLog = /console\.log\(\s*(`[^`]*`|'[^']*')/g
  let m
  while ((m = reLog.exec(UNION_SRC))) {
    const text = m[1].slice(1, -1)
    // 只认**顶格**:模板首字符就是 ❌(渲染后列 0)。缩进的 ❌ 行(needHuman 条目、
    // `  ❌ 落地回写失败:` 等)按其归属段处理,不在本锁射程(头注已列)。
    if (!text.startsWith('❌')) continue
    sites.push({ lineNo: UNION_SRC.slice(0, m.index).split('\n').length, text })
  }
  const reUndetermined = /console\.log\(\s*(`[^`]*`|'[^']*')/g
  while ((m = reUndetermined.exec(UNION_SRC))) {
    const text = m[1].slice(1, -1)
    if (text.includes('[union-converge]') && text.includes('UNDETERMINED')) {
      sites.push({ lineNo: UNION_SRC.slice(0, m.index).split('\n').length, text })
    }
  }
  assert.ok(sites.length >= 17, `打印点现读必须非零(枚举到 0 判死不记绿,§0.3):${sites.length}`)
  const uncovered = []
  const dynSeen = []
  for (const site of sites) {
    const s1 = site.text.replace(/\$\{[^}]*\}/g, '1')
    const s2 = site.text.replace(/\$\{[^}]*\}/g, '--flag')
    const dedicated = UNION_VERDICT_SHAPES.some((s) => s.re.test(s1) || s.re.test(s2))
    if (dedicated) continue
    if (PURE_DYNAMIC_HEADLINE_ALLOWLIST.includes(site.text.trim())) {
      dynSeen.push(site.text.trim())
      assert.ok(
        UNION_HEADLINE_FALLBACK_RE.test(s1) && UNION_HEADLINE_FALLBACK_RE.test(s2),
        `动态位点必须至少被兜底网接住:${site.text}`,
      )
      continue
    }
    uncovered.push(`${site.lineNo}: ${site.text.slice(0, 60)}`)
  }
  assert.deepEqual(
    dynSeen.sort(),
    [...PURE_DYNAMIC_HEADLINE_ALLOWLIST].sort(),
    '纯动态顶格 ❌ 位点的白名单必须逐字节对账(新增/消失都要重新登记,不许静默换形)',
  )
  assert.deepEqual(uncovered, [], `新增静态顶格结论打印点而 UNION_VERDICT_SHAPES 未登记 ⇒ 红:\n${uncovered.join('\n')}`)
})

test('S7 装车锁:转述层两个调用点都按 topRedOnly 分岔措辞,短语实现仍只有一份', () => {
  const SELF_SRC = readFileSync(new URL('../git-sync-converge.mjs', import.meta.url), 'utf8')
  assert.equal(
    (SELF_SRC.match(/顶格判红\(非人工裁决/g) ?? []).length >= 2,
    true,
    '两个调用点都必须走分型措辞,否则判据在而无人调度(守门 89 R4 同型)',
  )
  assert.equal(
    (SELF_SRC.match(/export function extractUnionVerdict/g) ?? []).length,
    1,
    '转述取行只许一份实现(§0.6)',
  )
  assert.equal(
    (SELF_SRC.match(/export const UNION_VERDICT_SHAPES/g) ?? []).length,
    1,
    '形态清单全仓只许这一份(§22c:第二份必然漂移)',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
