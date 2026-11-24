// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/tests/check-exemption-expiry-g666.test.mjs
/**
 * G-666 镜像测试:守门 108(check-exemption-expiry)的 E5 —— 新增 lint 抑制
 * (eslint/disable 与 @ts/ignore 两族拼写)必须**同行**带 `until <日期>` 豁免,
 * 锚点 = max(基线 suppressionUndatedCounts, HEAD 现测)。
 *
 * 票面验收 = 棘轮四向 + 阳性对照:
 *   ① 存量不动 → 绿(按文件 HEAD 自身套棘轮,现测存量不红,只盯新增);
 *   ② 新增一条不带同行 until → 红(阳性对照:从 scanFile 真扫产物判出,报错点名文件);
 *   ③ 新增一条但同行带 until → 绿(出口是真的,不是判据没跑);
 *   ④ 存量减少 → 绿且锚点棘轮只下调,后续回加按低锚点判红。
 *
 * 纪律(与 check-exemption-expiry.test.mjs 同族):
 *  - 不复制判据实现,直接 import 源脚本 __test__;CLI 入口受 isDirectRun 守护,import 零副作用。
 *  - 端到端取证在 mkScratch 临时 git 仓里做并显式 --root,绝不扫真仓(守门 70 教训)。
 *  - 本文件不在 SELF_EXEMPT_RE 自豁免名单内 ⇒ 源码里不得出现抑制形态的**连续字面量**
 *    (否则真门会把本文件记成"新增无到期豁免的抑制",E5 棘轮反过来咬测试自己),
 *    夹具一律按片段拼装,prose 一律用"抑制 / 豁免"指代。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as gate } from '../check-exemption-expiry.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = resolve(HERE, '..', 'check-exemption-expiry.mjs')

// 抑制形态字面量按片段拼装(理由见文件头"自扫"说明)。
const ED = ['eslint', 'disable'].join('-')
const EDNL = `${ED}-next-line`
const TSI = ['@ts', 'ignore'].join('-')

const TODAY = '2026-09-25'
const BASE = { grandfatherUntil: '2099-01-01', undatedCounts: {} }
const K = (file, kind) => `${file}::${kind}`

/** 夹具:三条抑制,全部无同行 until ⇒ 全部进 E5 观测面(存量面 = 2+1)。 */
const F_UNDATED = `x // ${EDNL} no-console\ny // ${ED} no-console -- 先压住\nz // ${TSI}\n`
/** 夹具:在 ① 之上多一条无 until 的同族抑制(② 红的观测面)。 */
const F_GROWN = `${F_UNDATED}w // ${ED} no-console -- 又压一处\n`
/** 夹具:多出的那条**同行带 until** ⇒ 有到期豁免,不进观测面(③ 的观测面)。 */
const F_DATED_EXIT = `${F_UNDATED}w // ${ED} no-console -- 等清理 until 2099-12-31\n`
/** 夹具:只留一条(④ 存量减少面)。末行真豁免同时是 CLI 反假绿闸的入场券。 */
const F_REDUCED = `x // ${EDNL} no-console\n// border-ink-exempt: 反假绿闸需要一条真豁免 until 2099-12-31\n`
/** 夹具:在减少面上回加一条(④ 回加面,只含被棘轮盯住的那一族)。 */
const F_READD = `x // ${EDNL} no-console\nw // ${ED} no-console -- 回加一条\n`

/** 构造面跑 analyze:观测一律从 scanFile 真扫出来(阳性对照:不喂手拼计数表)。 */
const runE5 = (text, { headSup, supBase, file = 'g.ts' } = {}) => {
  const got = gate.scanFile(file, text)
  return {
    got,
    res: gate.analyze({
      entries: [],
      suppressionsByFile: { [file]: got.suppressions },
      suppressionUndatedByFile: { [file]: got.suppressionUndated },
      baseline: supBase ? { ...BASE, suppressionUndatedCounts: supBase } : BASE,
      today: TODAY,
      headSuppressionCounts: headSup,
    }),
  }
}

test('G0 __test__ 导出锚点齐全(缺锚点即判据漂移)', () => {
  for (const key of [
    'scanFile',
    'analyze',
    'mergeBaseline',
    'suppressionUndatedCountsOf',
    'resolveSuppressionAnchor',
    'BASELINE_REL',
  ])
    assert.ok(key in gate, `__test__ 缺键 ${key}`)
})

test('G1 scanFile 把抑制账劈两半:同行带 until 的算有到期豁免,不进 E5 观测面(总账照旧计)', () => {
  const got = gate.scanFile('g.ts', F_UNDATED)
  assert.deepEqual(got.suppressionUndated, { [ED]: 2, 'ts-ignore': 1 }, '无 until 的抑制进观测面')
  assert.deepEqual(got.suppressions, { [ED]: 2, 'ts-ignore': 1 }, '总账与观测面同轮同面')
  const exit = gate.scanFile('g.ts', F_DATED_EXIT)
  assert.deepEqual(
    exit.suppressionUndated,
    { [ED]: 2, 'ts-ignore': 1 },
    '同行带 until 的新增抑制不算无到期豁免(出口必须是真的)',
  )
  assert.equal(exit.suppressions[ED], 3, '总账照旧计,不得因为劈账丢数')
  // 观测/锚点两侧走同一个函数(两侧口径错位 = 假红/假绿的教科书来源)
  assert.deepEqual(gate.suppressionUndatedCountsOf({ 'g.ts': got.suppressionUndated }), {
    [K('g.ts', ED)]: 2,
    [K('g.ts', 'ts-ignore')]: 1,
  })
})

test('G2 E5 棘轮四向(票面验收格,观测全从 scanFile 真扫产物来)', () => {
  const stock = { [K('g.ts', ED)]: 2, [K('g.ts', 'ts-ignore')]: 1 }
  // ① 存量不动 → 绿:锚点 = HEAD 现测兜住现测存量 —— "按文件 HEAD 自身套棘轮,不得当场判红"。
  assert.deepEqual(runE5(F_UNDATED, { headSup: stock }).res.red, [], '存量在 HEAD 锚点内 ⇒ 不红')
  //   基线还是空账(该文件刚上线、基线没这字段)时同样不得当场判红:取大含 HEAD 现测。
  assert.deepEqual(runE5(F_UNDATED, { headSup: stock, supBase: {} }).res.red, [])
  // ② 新增一条不带同行 until → 红(阳性对照):恰好只红多出的那一笔,并点名文件与 kind。
  const hit = runE5(F_GROWN, { headSup: stock }).res
  assert.equal(hit.red.length, 1, `应恰好一条 E5:${JSON.stringify(hit.red)}`)
  assert.equal(hit.red[0].code, 'E5')
  assert.equal(hit.red[0].file, 'g.ts', '必须点名文件')
  assert.equal(hit.red[0].family, ED, '必须点名抑制族(kind)')
  assert.match(hit.red[0].msg, /until YYYY-MM-DD/)
  // ③ 新增一条但同行带 until → 绿:同位置不带 until 就是 ② 的红,绿只能来自豁免出口。
  assert.deepEqual(runE5(F_DATED_EXIT, { headSup: stock }).res.red, [])
  // ④ 存量减少 → 绿(现测数如实报出;S1"可下调"属第一类豁免账,E5 抑制账无 S1),且锚点棘轮只下调;后续回加按低锚点判红。
  const less = runE5(F_REDUCED, { headSup: stock, supBase: { [K('g.ts', ED)]: 2 } }).res
  assert.deepEqual(less.red, [], '存量减少不得判红')
  assert.equal(less.totals.suppressUndatedTotal, 1, '减少后的现测数必须如实报出,不得静默归零')
  const merged = gate.mergeBaseline(
    { undatedCounts: {}, suppressionUndatedCounts: { [K('g.ts', ED)]: 2 } },
    { undatedCounts: {}, suppressionUndatedCounts: { [K('g.ts', ED)]: 1 } },
  )
  assert.equal(merged.next.suppressionUndatedCounts[K('g.ts', ED)], 1, '锚点棘轮只下调')
  const reAdd = runE5(F_READD, {
    headSup: { [K('g.ts', ED)]: 1 },
    supBase: { [K('g.ts', ED)]: 1 },
  }).res
  assert.equal(reAdd.red[0]?.code, 'E5', '回加必须按低锚点判红,不得被历史高位兜回')
  assert.equal(reAdd.red[0]?.family, ED)
})

test('G3 锚点缺失 ⇒ E5 整维退回只报数并喊出(S5),不得拿 0 当锚点恒红存量', () => {
  const { res } = runE5(F_UNDATED, {})
  assert.deepEqual(res.red, [], '锚点缺失档判红 = 上线恒红存量,必须退回只报数')
  assert.ok(res.soft.some((s) => s.code === 'S5'), '锚点缺失必须喊出,不得静默装绿')
  assert.equal(res.totals.suppressUndatedTotal, 3, '观测面总数如实报出')
  // 面=head 自比:锚点 = 观测 ⇒ E5 结构上不响(全量档的"不得当场判红"由锚点定义保证)。
  assert.deepEqual(
    gate.resolveSuppressionAnchor({
      face: 'head',
      undatedByFile: { 'g.ts': gate.scanFile('g.ts', F_UNDATED).suppressionUndated },
    }),
    { [K('g.ts', ED)]: 2, [K('g.ts', 'ts-ignore')]: 1 },
  )
  // HEAD 取不到 ⇒ null(调用方退回只报数,不得拿 0 当锚点)。
  assert.equal(
    gate.resolveSuppressionAnchor({ face: 'index', undatedByFile: {}, headUndatedByFile: null }),
    null,
  )
})

test('G4 端到端:临时索引上四向全咬合 —— 新增无 until 必红点名文件,带 until 绿,棘轮降后回加按低位红', () => {
  const dir = mkScratch('exemption-g666-')
  const git = (args) =>
    execFileSync('git', ['-c', 'safe.directory=*', '-C', dir, ...args], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 60000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  const runJSON = (args) => {
    const r = spawnSync(process.execPath, [SCRIPT, '--root', dir, '--json', ...args], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
      maxBuffer: 64 << 20,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { status: r.status, out: JSON.parse(r.stdout || '{}'), err: `${r.stderr}` }
  }
  try {
    git(['init', '-q'])
    git(['config', 'user.email', 't@test.invalid'])
    git(['config', 'user.name', 't'])
    git(['config', 'commit.gpgsign', 'false'])
    mkdirSync(join(dir, 'scripts'), { recursive: true })
    // 基线:第二类账 seeded 2(存量账)。基线文件保持**未跟踪** ⇒ staged/head 两面都取不到它,
    // 不会把基线自己的键当成新抑制(真仓里该文件由 HEAD 锚点自洽兜住)。
    writeFileSync(
      join(dir, gate.BASELINE_REL),
      `${JSON.stringify(
        {
          grandfatherUntil: '2099-01-01',
          undatedCounts: {},
          suppressionUndatedCounts: { [`a.ts::${ED}`]: 2 },
        },
        null,
        2,
      )}\n`,
    )
    const V_STOCK = `x // ${EDNL} no-console\ny // ${ED} no-console -- 先压住\n// border-ink-exempt: 夹具 until 2099-12-31\n`
    const V_NEW = `${V_STOCK}w // ${ED} no-console -- 又压一处\n`
    const V_EXIT = `${V_STOCK}w // ${ED} no-console -- 等清理 until 2099-12-31\n`
    const V_LESS = `x // ${EDNL} no-console\n// border-ink-exempt: 夹具 until 2099-12-31\n`
    const put = (text) => writeFileSync(join(dir, 'a.ts'), text)
    put(V_STOCK)
    git(['add', 'a.ts'])
    git(['commit', '-q', '-m', 'fixture: 存量 2'])
    // ① 存量不动 → 绿(锚点 = HEAD 现测兜底:按文件 HEAD 自身套棘轮,存量不当场判红)
    const clean = runJSON(['--staged'])
    assert.equal(clean.status, 0, `存量不动不得判红:${JSON.stringify(clean.out.red)}${clean.err}`)
    // ② 新增一条无 until → 红(阳性对照,E5 点名 kind@file)
    put(V_NEW)
    git(['add', 'a.ts'])
    const hit = runJSON(['--staged'])
    assert.equal(hit.status, 1, `新增无到期豁免的抑制必须判红:${hit.err}`)
    const e5 = (hit.out.red || []).find((v) => v.code === 'E5')
    assert.ok(e5, `E5 必须在红清单里:${JSON.stringify(hit.out.red)}`)
    assert.equal(e5.file, 'a.ts', '报错必须点名文件')
    assert.equal(e5.family, ED, '报错必须点名抑制族')
    assert.match(e5.msg, /多出的 1 处/, '恰好只红新增的那一笔')
    // ③ 新增一条但同行带 until → 绿
    put(V_EXIT)
    git(['add', 'a.ts'])
    const exit = runJSON(['--staged'])
    assert.equal(exit.status, 0, `带同行 until 是合法出口:${JSON.stringify(exit.out.red)}${exit.err}`)
    // ④ 存量减少 → 绿(现测数如实报出);提交后 --update-baseline 棘轮下调;回加按低锚点判红。
    put(V_LESS)
    git(['add', 'a.ts'])
    const less = runJSON(['--staged'])
    assert.equal(less.status, 0, `存量减少不得判红:${JSON.stringify(less.out.red)}${less.err}`)
    assert.equal(
      less.out.suppressUndatedTotal,
      1,
      `减少后的现测数必须如实报出:${JSON.stringify(less.out)}`,
    )
    git(['commit', '-q', '-m', 'fixture: 销账到 1'])
    const upd = spawnSync(process.execPath, [SCRIPT, '--root', dir, '--update-baseline', '--staged'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    assert.equal(upd.status, 0, `${upd.stdout}${upd.stderr}`)
    const bl = JSON.parse(readFileSync(join(dir, gate.BASELINE_REL), 'utf8'))
    assert.equal(bl.suppressionUndatedCounts[`a.ts::${ED}`], 1, '锚点棘轮必须下降(只下调)')
    put(V_NEW)
    git(['add', 'a.ts'])
    const reAdd = runJSON(['--staged'])
    assert.equal(reAdd.status, 1, `回加必须按低锚点判红(历史高位救不回):${reAdd.err}`)
    assert.ok(
      (reAdd.out.red || []).some((v) => v.code === 'E5' && v.family === ED && v.file === 'a.ts'),
      `回加的 E5 必须点名 kind@file:${JSON.stringify(reAdd.out.red)}`,
    )
  } finally {
    rmScratch(dir)
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
