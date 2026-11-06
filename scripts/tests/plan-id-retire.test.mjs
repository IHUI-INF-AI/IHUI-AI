// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「近期已结清号」避让面的镜像锁(2026-11-06 立,根因由台账席实测给出)。
 *
 * 钉三件事,每件都有成对反例:
 *  ① 结清的号必须进避让(否则完成即删 ⇒ 洞被当空闲复发:实测 RP-67 当日被复用,同号跨题);
 *  ② 避让面**不得**把正文/标题里的散文引用算成实占(实测 naive 版把 G 族顶成池满 0 余量,
 *     那比原缺陷更坏:登记入口整体发不出号);
 *  ③ 两源都读不到 ⇒ 未判定,调用方拒发号,绝不"默默按没占发"。
 * §22c:判据 import 源模块,本文件零复算。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  collectRetiredIds,
  retiredDeclaredNumbersFromRows,
  retiredNumbersFromTitles,
  scanFamilyIds,
  RETIRE_LEDGER_REL,
  RETIRE_WINDOW_DAYS,
  RETIRE_TITLE_RE,
} from '../lib/plan-id-face.mjs'
import { loadRetiredIdSets } from '../lib/plan-id-retire-io.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const num = (m, f) => [...(m?.get?.(f) ?? [])].sort((a, b) => a - b)

test('① 摘除台账:rowBefore 的声明位算实占', () => {
  const rows = [
    '- [x]（2026-11-05/甲） RP-67 两枚 lib 在飞判据只有悬空副本一份',
    '- [x] RP-1 老票已结清',
  ]
  const m = retiredDeclaredNumbersFromRows(rows, ['RP'])
  assert.deepEqual(num(m, 'RP'), [1, 67])
})

test('② 反向锁:行内**引用别票**不得被算成实占(G 族池满的真凶)', () => {
  const row =
    '- [x] G-160 (2026-10-21) 与 G-929 同型票;另见 G-815985 / G-14 的口径,归档件里还有 G-35'
  const m = retiredDeclaredNumbersFromRows([row], ['G'])
  assert.deepEqual(
    num(m, 'G'),
    [160],
    '整行全扫会把 929/815985/14/35 都标成已占 ⇒ naive 版实测把 G 族 1..99 顶满、可发余量 0',
  )
  // 同一行交给"全文件扫描"那把尺确实会命中多号 ⇒ 两把尺分工不同,不得互换
  const scan = scanFamilyIds(row, 'G')
  assert.ok(
    scan && scan.size > 1,
    `扫描尺应当命中正文引用号(它是占用面另一维的口径),实得 ${scan?.size}`,
  )
})

test('③ 提交标题源:只认结清类标题,不认散文标题', () => {
  const titles = [
    'test(land): 落地器夹具的缺省正文过形状档',
    'chore(plan): 结清 RP-67(实现枚 b7aa56e7f6)',
    'fix(gates): 悬空导入门两格 —— tree 档取材集合对齐 commit 档',
    'docs(plan): 摘除已结清行 G-929',
  ]
  const r = retiredNumbersFromTitles(titles, ['RP', 'G'])
  assert.equal(r.keptCount, 2, '两条结清/摘除类标题才入集')
  assert.deepEqual(num(r.numbers, 'RP'), [67])
  assert.deepEqual(num(r.numbers, 'G'), [929])
  assert.ok(
    RETIRE_TITLE_RE.test('结清批次 10 行') && !RETIRE_TITLE_RE.test('fix(gates): 取材集合对齐'),
  )
})

test('④ 三态与并集:两源齐=ok / 单源=partial / 两源皆不可读=undetermined 且零避让', () => {
  const ledger =
    JSON.stringify({
      at: new Date().toISOString(),
      kind: 'closed-row-reclose-open-form',
      rowBefore: '- [x] RP-67 旧题',
    }) + '\n'
  const ok = collectRetiredIds({
    families: ['RP'],
    readText: () => ledger,
    recentCommitTitles: () => ['chore(plan): 结清 RP-70'],
  })
  assert.equal(ok.state, 'ok')
  assert.deepEqual(
    num(ok.byFamily, 'RP').sort((a, b) => a - b),
    [67],
    '第一源可读时第二源**不参与并集**(实测:标题整片扫把 G 族避让集顶到 98 ⇒ 池满 0 余量,由覆盖面自证 ⑦ 拦下)',
  )
  assert.match(
    String(ok.perSource.gitLog.role),
    /^shadow/,
    `降级态必须有机读字段可断言:${JSON.stringify(ok.perSource.gitLog)}`,
  )
  const partial = collectRetiredIds({
    families: ['RP'],
    readText: () => null,
    recentCommitTitles: () => ['结清 RP-70'],
  })
  assert.equal(partial.state, 'partial', '只剩一源必须点出来:这一轮避让面比齐全时窄')
  assert.deepEqual(num(partial.byFamily, 'RP'), [70])
  const unj = collectRetiredIds({
    families: ['RP'],
    readText: () => null,
    recentCommitTitles: () => null,
  })
  assert.equal(unj.state, 'undetermined')
  assert.deepEqual(
    num(unj.byFamily, 'RP'),
    [],
    '未判定档必须给空集,由调用方据此拒发号(不得当"没占"发)',
  )
  assert.match(unj.why, /不得填洞|拒发号/)
  const boom = collectRetiredIds({
    families: ['RP'],
    readText: () => {
      throw new Error('EPERM')
    },
    recentCommitTitles: () => {
      throw new Error('git down')
    },
  })
  assert.equal(boom.state, 'undetermined', '读史抛错同样是未判定,不是崩溃也不是零避让放行')
})

test('⑤ 窗口与时刻:超窗不进集,时刻读不到留在集内(宁多避让)', () => {
  const mk = (at, rb) => JSON.stringify({ at, kind: 'stale-closed-sweep', rowBefore: rb })
  const old = mk(
    new Date(Date.now() - (RETIRE_WINDOW_DAYS + 5) * 86400000).toISOString(),
    '- [x] RP-88 很旧',
  )
  const noAt = mk(undefined, '- [x] RP-89 无时刻')
  const f = collectRetiredIds({
    families: ['RP'],
    readText: () => old + '\n' + noAt,
    recentCommitTitles: () => [],
  })
  const got = num(f.byFamily, 'RP')
  assert.ok(!got.includes(88), '超出 §1 的 90 天留痕窗口 ⇒ 不再避让(窗口不是拍出来的)')
  assert.ok(got.includes(89), '时刻取不到 ⇒ 留在集内:少避让才是错的方向')
  // (整本账坏行的三态归 ④ 管:那里已经钉过"第一源全坏 + 第二源可读 ⇒ partial")
})

test('⑥ 形状锁:两个发号出口都必须真吃这把尺(造好没装车 = 没有,§0.9)', () => {
  const taker = readFileSync(join(ROOT, 'scripts/next-plan-id.mjs'), 'utf8')
  const emitter = readFileSync(join(ROOT, 'scripts/live-doc-edit.mjs'), 'utf8')
  assert.match(taker, /loadRetiredIdSets\(\{ root: ROOT, families: \[FAMILY\] \}\)/)
  assert.match(
    taker,
    /id-retire-face-undetermined|state === 'undetermined'[\s\S]{0,400}process\.exit\(2\)/,
    '第二出口未判定 ⇒ 拒发号',
  )
  assert.match(emitter, /retiredLoader: \(fams\) => loadRetiredIdSets\(/)
  assert.match(emitter, /id-retire-face-undetermined/, '第一出口未判定 ⇒ 拒发号')
  assert.match(emitter, /if \(retiredSet && retiredSet\.size\) usedNums\.push/)
  // 台账席给的两个号必须在同一把尺下可核:装载器对真实仓现读能读到 RP-67(本缺陷现场)
  const live = loadRetiredIdSets({ root: ROOT, families: ['RP'] })
  assert.equal(live.state, 'ok', `避让面应可读:present=${JSON.stringify(live.perSource)}`)
  assert.ok(live.byFamily.get('RP').has(67), '真实仓现读必须仍然避让 RP-67(当日被复用的那一枚)')
  assert.ok(
    live.byFamily.get('RP').has(66) || live.byFamily.get('RP').has(68),
    '同批结清的邻号也应覆盖',
  )
  assert.match(RETIRE_LEDGER_REL, /plan-row-drop\.jsonl$/, '第一源就是既有摘除台账,不新增台账面')
})

test('⑦ 覆盖面自证:避让后仍不得把任何一族顶成池满(现读全族)', () => {
  const fams = ['O', 'G', 'RP', 'Y', 'B', 'D']
  const txt = readFileSync(join(ROOT, 'PROJECT_PLAN.md'), 'utf8')
  const face = loadRetiredIdSets({ root: ROOT, families: fams })
  for (const f of fams) {
    const live = [
      ...new Set(
        [...String(txt).matchAll(new RegExp('\\b' + f + '-?(\\d+)\\b', 'g'))].map((m) =>
          Number(m[1]),
        ),
      ),
    ].filter((n) => n >= 1 && n <= 99)
    const ret = [...(face.byFamily.get(f) ?? [])].filter((n) => n >= 1 && n <= 99)
    const free = [...Array(99).keys()]
      .map((i) => i + 1)
      .filter((n) => !new Set([...live, ...ret]).has(n))
    assert.ok(
      free.length > 0,
      `${f} 族避让后可发余量为 0(避让=${ret.length} 在册=${live.length})⇒ 登记入口会发不出号;这是比"复用旧号"更坏的故障`,
    )
    assert.ok(
      free.length >= 3,
      `${f} 族余量只剩 ${free.length} 枚,过窄(避让=${ret.length})⇒ 需要复核取数口径`,
    )
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
