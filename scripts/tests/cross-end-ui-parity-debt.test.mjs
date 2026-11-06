// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:判据一律 import 源脚本的 `__test__`,本文件零复算。
 *
 * 台账这种工具最容易的失效不是算错,而是**静默算少**(维度没进总数、消失的族被当成清零),
 * 那会让人安心地继续分叉 —— 所以每条臂都盯着"少算"这一侧。
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as L } from '../cross-end-ui-parity-debt.mjs'

const { debtOf, langMismatch, buildRows, diffAgainst, uncoveredDimensions, waiverState } = L
const HERE = dirname(fileURLToPath(import.meta.url))

const fam = (name, o = {}) => ({
  name,
  diffCount: o.geometry ?? 0,
  radiusCount: o.radiusFile ?? 0,
  elementRadiusCount: o.radiusElement ?? 0,
  radius: { onlyMiniapp: [], onlyRn: [] },
  elementRadius: { mismatched: [], onlyMiniapp: [], onlyRn: [], ambiguous: [] },
  lang: { miniapp: o.mini ?? 'className', rn: o.rn ?? 'className' },
})

describe('debtOf:四个维度都必须进总数', () => {
  it('T1 逐维相加,不漏维', () => {
    assert.equal(
      debtOf(fam('X', { geometry: 16, radiusFile: 3, mini: 'className', rn: 'stylesheet' })),
      20,
    )
  })

  it('T2 取用形态分叉单独也计 1(13 族里 10 族是 className vs stylesheet —— 这一维归零等于抹掉最大成因)', () => {
    assert.equal(debtOf(fam('X', { mini: 'className', rn: 'stylesheet' })), 1)
    assert.equal(debtOf(fam('X', { mini: 'className', rn: 'className' })), 0)
  })

  it('T3 形态读不出来 ⇒ 既不冒充分叉也不冒充相同(未判定不得记成任何一色)', () => {
    assert.equal(langMismatch({ lang: { miniapp: undefined, rn: 'stylesheet' } }), 0)
    assert.equal(langMismatch({}), 0)
  })
})

describe('buildRows:排序与投影', () => {
  it('T4 按欠债降序、同债按族名(读数必须可复现,不得随 Map 顺序漂)', () => {
    const rows = buildRows({
      findings: [fam('B', { geometry: 2 }), fam('A', { geometry: 9 }), fam('C', { geometry: 2 })],
    })
    assert.deepEqual(
      rows.map((r) => r.name),
      ['A', 'B', 'C'],
    )
  })

  it('T5 空 findings ⇒ 空表(不得读成"零欠债"的合格证)', () => {
    assert.deepEqual(buildRows({ findings: [] }), [])
    assert.deepEqual(buildRows({}), [])
  })
})

describe('diffAgainst:涨跌与"消失"分得开', () => {
  const snap = (list) => ({ recordedAt: 'x', families: list })

  it('T6 涨/降/持平各归各桶', () => {
    const d = diffAgainst(
      [
        { name: 'Up', debt: 5 },
        { name: 'Down', debt: 1 },
        { name: 'Same', debt: 2 },
      ],
      snap([
        { name: 'Up', debt: 2 },
        { name: 'Down', debt: 4 },
        { name: 'Same', debt: 2 },
      ]),
    )
    assert.deepEqual(
      d.up.map((x) => [x.name, x.delta]),
      [['Up', 3]],
    )
    assert.deepEqual(
      d.down.map((x) => [x.name, x.delta]),
      [['Down', -3]],
    )
    assert.deepEqual(
      d.same.map((x) => x.name),
      ['Same'],
    )
  })

  it('T7 快照里有、这次读不到 ⇒ 记 vanished,不当"清零"(配对没了不等于债还了)', () => {
    const d = diffAgainst([{ name: 'Still', debt: 1 }], snap([{ name: 'Gone', debt: 7 }]))
    assert.deepEqual(d.vanished, [{ name: 'Gone', was: 7 }])
    assert.ok(!d.down.some((x) => x.name === 'Gone'))
  })

  it('T8 新出现的配对算进"涨"(它带着全新欠债进来)', () => {
    const d = diffAgainst([{ name: 'New', debt: 6 }], snap([{ name: 'Old', debt: 1 }]))
    assert.deepEqual(d.up, [{ name: 'New', from: null, to: 6, delta: 6 }])
  })

  it('T9 没有基线 ⇒ 一律不判(基线为 null,调用方据此落"未判定")', () => {
    assert.equal(diffAgainst([{ name: 'A', debt: 3 }], null).baseline, null)
  })
})

describe('uncoveredDimensions:门加维必须喊出来', () => {
  it('T10 门多吐一个维度 ⇒ 点名,不得静默把 total 当全量', () => {
    const json = {
      findings: [
        { name: 'X', diffCount: 1, radiusCount: 0, elementRadiusCount: 0, lang: {}, brandNew: 3 },
      ],
    }
    assert.ok(uncoveredDimensions(json).includes('brandNew'))
  })

  it('T11 已知维度不误报(否则每行都喊,等于没人听)', () => {
    assert.deepEqual(uncoveredDimensions({ findings: [fam('X')] }), [])
  })
})

describe('waiverState:已裁决 ≠ 待修,但"验过才免"且会到期(§0.7)', () => {
  const today = '2026-10-23'
  const w = (o) => ({ X: o })

  it('W1 有原因 + 未过期 ⇒ 已裁决,不得计进待修', () => {
    const s = waiverState('X', w({ reason: '一端多元素', until: '2027-03-27' }), today)
    assert.equal(s.waived, true)
    assert.equal(s.until, '2027-03-27')
  })

  it('W2 豁免到期 ⇒ 自动回到待修(不是"登记过就永远免")', () => {
    const s = waiverState('X', w({ reason: '一端多元素', until: '2026-10-22' }), today)
    assert.equal(s.waived, false)
    assert.equal(s.expired, true)
  })

  it('W3 没有终态的豁免不算豁免(无期限豁免是本仓记过最多次的死角)', () => {
    const s = waiverState('X', w({ reason: '一端多元素' }), today)
    assert.equal(s.waived, false)
    assert.equal(s.noExpiry, true)
  })

  it('W4 没登记、或登记了空原因 ⇒ 一律未裁决', () => {
    assert.equal(waiverState('X', {}, today).waived, false)
    assert.equal(waiverState('X', w({ reason: '   ', until: '2027-03-27' }), today).waived, false)
  })

  it('W5 buildRows 把豁免投影进每一行,待修/已裁决两个数分得开', () => {
    const json = {
      findings: [fam('Waived', { geometry: 9 }), fam('Open', { geometry: 4 })],
    }
    const waivers = {
      Waived: { reason: '机制差异', until: '2027-03-27' },
      Open: { reason: '机制差异', until: '2020-01-01' },
    }
    const rows = buildRows(json, waivers, today)
    const by = Object.fromEntries(rows.map((r) => [r.name, r]))
    assert.equal(by.Waived.waived, true)
    assert.equal(by.Open.waived, false)
    assert.equal(by.Open.waiverExpired, true)
    const total = rows.reduce((acc, r) => acc + r.debt, 0)
    const waivedTotal = rows.filter((r) => r.waived).reduce((acc, r) => acc + r.debt, 0)
    assert.equal(total, 13)
    assert.equal(total - waivedTotal, 4)
  })
})

describe('在册快照与源脚本口径一致', () => {  const snapshot = () =>
    JSON.parse(readFileSync(resolve(HERE, '../cross-end-ui-parity-debt.json'), 'utf8'))

  it('T12 快照声明的 dimensions 与源脚本 DIMENSIONS 同集(改维必须同批改档)', () => {
    const src = readFileSync(resolve(HERE, '../cross-end-ui-parity-debt.mjs'), 'utf8')
    const declared = /const DIMENSIONS = \[([\s\S]*?)\]/.exec(src)?.[1] ?? ''
    const keys = [...declared.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort()
    assert.deepEqual([...snapshot().dimensions].sort(), keys)
  })

  it('T13 快照 total == 各族 debt 之和(自证,不靠写档那一步的口头保证)', () => {
    const s = snapshot()
    assert.equal(
      s.families.reduce((acc, f) => acc + f.debt, 0),
      s.total,
    )
  })

  it('T19 轴二在册:webRn 段自洽(families 之和 == total、dimensions 取自门、schema 已升 3)', () => {
    const s = snapshot()
    assert.ok(s.schema >= 3, '并轴后 schema 必须 ≥3,否则 --check 分不清"没这段"与"这段是空的"')
    assert.ok(Array.isArray(s.webRn?.families), '在册快照缺 webRn.families')
    assert.equal(
      s.webRn.families.reduce((acc, f) => acc + f.debt, 0),
      s.webRn.total,
    )
    assert.ok(Array.isArray(s.webRn.dimensions), '轴二维清单必须由门声明并留在快照里')
    assert.equal(s.webRn.state, 'judged', '把未判定的那一轮写进基线 = 永远洗成持平')
    for (const f of s.webRn.families) assert.equal(f.adjudicated, 'unknown')
  })

  it('T20 加轴不得顺手刷平另一轴:写了 axis1PreservedFrom 就必须真的留着轴一读数', () => {
    const s = snapshot()
    if (!s.axis1PreservedFrom) return
    assert.ok(s.families.length > 0 && typeof s.total === 'number', '声明"保留轴一"却把轴一读数写空了')
    assert.equal(s.recordedAt, s.axis1PreservedFrom, '轴一保留时 recordedAt 必须仍是轴一那次的时刻')
  })
})

describe('在册快照的格式面:生成物的规范形态归全仓唯一的格式化器', () => {
  const ROOT_DIR = resolve(HERE, '..', '..')
  const PRETTIER_BIN = resolve(ROOT_DIR, 'node_modules', 'prettier', 'bin', 'prettier.cjs')
  const SNAP = resolve(HERE, '../cross-end-ui-parity-debt.json')

  /** prettier --check 的三态:0=合式 / 1=有不合格式 / 其他=它自己坏了(不得当成"合式") */
  function prettierClean(text) {
    try {
      execFileSync(
        process.execPath,
        [PRETTIER_BIN, '--stdin-filepath', 'scripts/cross-end-ui-parity-debt.json', '--check'],
        {
          cwd: ROOT_DIR,
          input: text,
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
          timeout: 120_000,
        },
      )
      return true
    } catch (e) {
      if (e?.status === 1) return false
      throw new Error(`prettier 自身异常(status=${e?.status})⇒ 不判绿也不判红:${String(e?.message ?? e).slice(0, 120)}`)
    }
  }

  it('T21 快照在格式化器眼里必须合式(--record 写档后自动补跑,否则碰它的人撞格式差值棘轮)', () => {
    assert.ok(existsSync(PRETTIER_BIN), 'prettier 不在位 ⇒ 本用例的前提出问题(环境缺格式化器)')
    const text = readFileSync(SNAP, 'utf8')
    assert.ok(prettierClean(text), '在册快照不合式:--record 的 formatSnapshot 腿没生效')
    // 阳性对照:把短数组拆成多行(正是 stringify 的原生形态)⇒ 同一把尺子必须判成不合式
    const expanded = text.replace(
      /"dimensions": \[("[^\]]+)\]/,
      (_m, inner) => `"dimensions": [\n    ${inner.split(', ').join(',\n    ')}\n  ]`,
    )
    assert.notEqual(expanded, text, '阳性对照没改动任何字节 ⇒ 这条断言是空的')
    assert.equal(prettierClean(expanded), false, '拆行形态被判成合式 ⇒ 这把尺子看不见格式,上面那条绿不算数')
  })
})

describe('「门判红」与「门跑不动」必须是两条口径(2026-10-25 立)', () => {
  const { parseGateOutput } = L
  const goodJson = JSON.stringify({ face: 'head', findings: [{ name: 'X', diffCount: 1 }] })

  it('T14 门 rc=1 且 stdout 完好 ⇒ 照常出账(旧形态在这里抛,台账因此恒瞎)', () => {
    const j = parseGateOutput(goodJson, 1)
    assert.equal(j.findings.length, 1)
  })

  it('T15 真·跑不动仍要落未判定:rc=0 但 stdout 空 ⇒ 抛', () => {
    assert.throws(() => parseGateOutput('', 0), /未判定/)
  })

  it('T16 rc 取不到(超时被杀/ENOENT)但 stdout 有 JSON ⇒ 仍出账(stdout 是唯一凭据)', () => {
    assert.equal(parseGateOutput(goodJson, null).face, 'head')
  })

  it('T17 阳性对照:垃圾输出带 rc=1 也照样抛,且消息点名 stdout 字节数(不许把坏读成红)', () => {
    assert.throws(() => parseGateOutput('boom without brace', 1), /stdout 18 字节/)
  })

  it('T18 接线形状锁:readGateJson 必须接住非零退出并把 e.stdout 交给 parseGateOutput', () => {
    const src = readFileSync(resolve(HERE, '../cross-end-ui-parity-debt.mjs'), 'utf8').replace(/\s+/g, ' ')
    const at = src.indexOf('function readGateJson()')
    assert.ok(at >= 0, 'readGateJson 不在了')
    // 取函数体那一段(邻接会被合法注释插断,所以按结构取段再判锚点成套,不拿"紧挨着"当凭据)
    const body = src.slice(at, at + 900)
    for (const anchor of ['catch (e)', 'e.stdout', 'parseGateOutput(out, rc)', 'gateRc = rc']) {
      assert.ok(body.includes(anchor), `readGateJson 里缺锚点 ${anchor} ⇒ 可能已改回裸 execFileSync(门一红台账就瞎)`)
    }
  })
})

/**
 * 轴二 web↔RN(2026-11-06 并入)。这一轴的失效形态和轴一不同:**把"门没判"读成"两端已对齐"**。
 * 所以每条臂都盯着"这一轮到底判没判"和"不许自己重算几何"这两侧。
 */
const DIMS = ['widthHeight', 'padding', 'spacing', 'radius', 'fontSize']
const dimCell = (o = {}) => ({
  webOnly: o.webOnly ?? [],
  rnOnly: o.rnOnly ?? [],
  status: o.status ?? 'same',
})
const wrFam = (name, o = {}) => ({
  name,
  web: o.web ?? `apps/web/app/${name}/page.tsx`,
  rn: o.rn ?? `apps/mobile-rn/src/screens/${name}Screen.tsx`,
  evidence: o.evidence ?? `${name}:1`,
  webEvidence: null,
  judgedDims: o.judgedDims ?? 5,
  diffCount: o.diffCount ?? 0,
  dims: Object.fromEntries(
    DIMS.map((d) => [
      d,
      dimCell(
        typeof o[d] === 'object'
          ? o[d]
          : { webOnly: Array.from({ length: o[d] ?? 0 }, (_, i) => `w${d}${i}`), status: (o[d] ?? 0) ? 'diff' : 'same' },
      ),
    ]),
  ),
})
const wrJson = (detail, o = {}) => ({
  webRn: {
    pairCount: o.pairCount ?? detail.length,
    judgedPairs: o.judgedPairs ?? detail.length,
    findings: detail.length,
    unregistered: o.unregistered ?? detail.length,
    dimensions: o.dimensions ?? DIMS,
    dimCoverage: o.dimCoverage ?? Object.fromEntries(DIMS.map((d) => [d, detail.length])),
    oneSided: o.oneSided ?? [],
    undetermined: o.undetermined ?? [],
    detail,
    pending: o.pending ?? [],
    blocked: o.blocked ?? null,
    allowedDiff: o.allowedDiff ?? { matched: 0, shrunk: 0, expired: 0, over: 0, invalid: 0, unregistered: detail.length },
  },
})

const { buildWebRnRows, webRnAxis, uncoveredWebRnKeys, checkVerdict } = L

describe('轴二 buildWebRnRows:只消费门的 diffCount,一个几何量都不重算', () => {
  it('WR1 debt 逐字等于门的 diffCount,且五维明细投影之和与它自洽(阳性对照:数对得上)', () => {
    const rows = buildWebRnRows(wrJson([wrFam('A', { diffCount: 7, padding: 3, spacing: 2, radius: 2 })]))
    assert.equal(rows[0].debt, 7)
    const sum = DIMS.reduce((s, d) => s + (rows[0].per[d] ?? 0), 0)
    assert.equal(sum, 7, `五维投影 ${sum} 必须等于门给的 diffCount,否则消费的是两份数`)
  })

  it('WR2 一侧无读数(one-sided)不冒充分叉:该维计数照实投影,debt 仍只取门的 diffCount', () => {
    const rows = buildWebRnRows(
      wrJson([wrFam('B', { diffCount: 1, padding: { webOnly: ['p-4'], rnOnly: [], status: 'one-sided' }, radius: 1 })]),
    )
    assert.equal(rows[0].debt, 1, 'one-sided 那维门没计进 diffCount ⇒ 台账不得自己加回来')
    assert.equal(rows[0].status.padding, 'one-sided')
    assert.equal(rows[0].per.padding, 1)
    // 守恒只在"两侧都有读数"的那几维上成立(one-sided/no-data 是数据缺口,门没计进总数)
    const judgedSum = DIMS.reduce(
      (s, d) => s + (rows[0].status[d] === 'one-sided' ? 0 : (rows[0].per[d] ?? 0)),
      0,
    )
    assert.equal(judgedSum, rows[0].debt, '去掉 one-sided 维后逐维之和必须等于 debt(比对器也算错过这一格)')
  })

  it('WR3 逐对裁决态恒为 unknown:门只给聚合 allowedDiff,拿它去猜某一对"已豁免"就是造豁免', () => {
    const rows = buildWebRnRows(
      wrJson([wrFam('C', { diffCount: 4 })], { allowedDiff: { matched: 1, shrunk: 0, over: 0, expired: 0, invalid: 0, unregistered: 0 } }),
    )
    assert.equal(rows[0].adjudicated, 'unknown')
  })

  it('WR4 按欠债降序、同债按名;空 detail ⇒ 空表(不是"已对齐"的合格证)', () => {
    const rows = buildWebRnRows(wrJson([wrFam('B', { diffCount: 2 }), wrFam('A', { diffCount: 9 }), wrFam('C', { diffCount: 2 })]))
    assert.deepEqual(rows.map((r) => r.name), ['A', 'B', 'C'])
    assert.deepEqual(buildWebRnRows({}), [])
    assert.deepEqual(buildWebRnRows(wrJson([])), [])
  })

  it('WR5 门加维度(五维变六维)⇒ 新维自动进投影,台账不写死维数', () => {
    const six = [...DIMS, 'lineHeight']
    // 门的 diffCount 按"含新维"给数:padding 3 + radius 1 + lineHeight 1 = 5
    const f = wrFam('D', { diffCount: 5, padding: 3, radius: 1 })
    f.dims.lineHeight = dimCell({ webOnly: ['lh-6'], status: 'diff' })
    const rows = buildWebRnRows(wrJson([f], { dimensions: six }))
    assert.equal(rows[0].per.lineHeight, 1, '新维必须被投影(写死 DIMS.length 就会把它丢掉)')
    const sum = six.reduce((s, d) => s + (rows[0].per[d] ?? 0), 0)
    assert.equal(sum, 5, '六维投影之和必须等于门的 diffCount ⇒ 维数由门声明,不由本台账')
  })

  it('WR6 形状锁:buildWebRnRows 函数体内不得出现任何几何重算入口(§0.6 单一真相源)', () => {
    const src = readFileSync(resolve(HERE, '../cross-end-ui-parity-debt.mjs'), 'utf8').replace(/\s+/g, ' ')
    const at = src.indexOf('function buildWebRnRows(json)')
    assert.ok(at >= 0, 'buildWebRnRows 不在了')
    const body = src.slice(at, at + 1200)
    for (const banned of ['readGeometry', 'setDiff', 'radiusSetOf', 'function debtOf'])
      assert.ok(!body.includes(banned), `轴二里出现了 ${banned} ⇒ 第二把尺子`)
    assert.ok(body.includes('f.diffCount'), '轴二的 debt 必须逐字取门的 diffCount')
  })
})

describe('轴二 webRnAxis:判没判由门自述,三态不得并桶(§0.3)', () => {
  it('WR7 门没吐 webRn 段 ⇒ absent(口径变了,不猜也不记绿)', () => {
    const a = webRnAxis({})
    assert.equal(a.state, 'absent')
    assert.match(a.why, /没有 webRn 段/)
  })

  it('WR8 整腿取不到输入(blocked)⇒ unjudged,并把门给的原因原样带出', () => {
    const a = webRnAxis(wrJson([], { blocked: 'head 取不到 apps/web/app 清单' }))
    assert.equal(a.state, 'unjudged')
    assert.equal(a.why, 'head 取不到 apps/web/app 清单')
  })

  it('WR9 pairCount=0 ⇒ unjudged:一条配对都没配上 ≠ 两端已对齐(枚举到 0 判死不记绿)', () => {
    const a = webRnAxis(wrJson([], { pairCount: 0 }))
    assert.equal(a.state, 'unjudged')
    assert.match(a.why, /pairCount=0/)
  })

  it('WR10 pairCount 读不到 ⇒ unjudged(不是 0 冒充"没有");有配对且有差 ⇒ judged(阳性对照)', () => {
    const j = wrJson([wrFam('A', { diffCount: 1 })])
    delete j.webRn.pairCount
    assert.equal(webRnAxis(j).state, 'unjudged')
    assert.equal(webRnAxis(wrJson([wrFam('A', { diffCount: 1 })])).state, 'judged')
  })

  it('WR11 未消费的键必须点名;已消费的不得天天喊(否则等于没人听)', () => {
    const j = wrJson([wrFam('A', { diffCount: 1 })])
    assert.deepEqual(uncoveredWebRnKeys(j), [])
    j.webRn.brandNewAxis = 7
    assert.ok(uncoveredWebRnKeys(j).includes('brandNewAxis'))
  })
})

describe('轴二 --check 裁决:没基线的那一轴不许贡献"涨",也不许贡献绿', () => {
  const judged = { webRnState: 'judged', webRnWhy: null }

  it('WR12 两轴都有基线且无涨 ⇒ 0', () => {
    assert.equal(checkVerdict({ ...judged, miniappUp: [], webRnUp: [], webRnLedger: 'present' }).code, 0)
  })

  it('WR13 轴二判得出但快照没有该段 ⇒ 2(不是 0:那一轴从没被比过)', () => {
    const v = checkVerdict({ ...judged, miniappUp: [], webRnUp: [], webRnLedger: 'not-in-ledger' })
    assert.equal(v.code, 2)
    assert.match(v.why, /--record/)
  })

  it('WR14 快照的轴二段坏了(缺 families)⇒ 2,不拿坏档当基线', () => {
    assert.equal(
      checkVerdict({ ...judged, webRnLedger: 'broken' }).code,
      2,
    )
  })

  it('WR15 轴二未判定 ⇒ 2(门判不了的事,台账不冒充判过)', () => {
    for (const st of ['absent', 'unjudged'])
      assert.equal(
        checkVerdict({ webRnState: st, webRnWhy: '门说的原因', webRnLedger: 'present' }).code,
        2,
      )
  })

  it('WR16 任一轴真涨 ⇒ 1(红优先于未判定,红了必须能拦住人)', () => {
    assert.equal(
      checkVerdict({ ...judged, miniappUp: [{ name: 'X' }], webRnLedger: 'present' }).code,
      1,
    )
    assert.equal(
      checkVerdict({ ...judged, webRnUp: [{ name: 'Y' }], webRnLedger: 'present' }).code,
      1,
    )
    // 轴二未在册时,它的 up 不参与判红 —— 没有前值的"涨"是自证循环
    assert.equal(
      checkVerdict({ ...judged, webRnUp: [{ name: 'Y' }], webRnLedger: 'not-in-ledger' }).code,
      2,
    )
  })
})

