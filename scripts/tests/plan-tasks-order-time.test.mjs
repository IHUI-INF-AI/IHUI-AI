// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * plan-tasks-order-time.test.mjs —— 派单面 `--order=late|early` 时间排序档的镜像测试(§22c,2026-10-23 立)。
 *
 * 立因:机主令「计划文档要按时间排序,以后做任务也要有先后顺序、要按时间去做」。顺序要成为**口径**
 * 就必须住在派单入口里而不是住在一份会腐烂的文件排版里 —— 台账现读 29034 行 / 611 个标题,主体是
 * 批次编年史(§1 明令机械拆散同一任务的 ①②③ 子项族是净损失),且多会话并发 append + 行级 union
 * 归并会把一次全文件移动的行锚点配对大面积打散(本仓「改锚点的行会被报成丢行」记过多次)。
 *
 * 分工:
 *  · P1–P6 纯函数面:两种 mode 反向、无锚点恒末尾、行数守恒、同锚点回退行号、非法 mode 当场抛、
 *    锚点表缺失全落 unanchored。
 *  · G1–G3 旗标面:少值 / 错值 / **被下一枚旗标吃掉** 三种都必须记成用法错(G-322 那一族的正解),
 *    等号与空格两种写法都要收到,不带该旗标必须 null 且零用法错(默认档一字不动)。
 *  · E1–E3 端到端:临时仓 + 伪作者日期 + **真 CLI 派生** —— 判据绿不等于有人问它(§0.9)。
 *    E3 是控制测量:同一份仓不带 --order 必须给出默认行号序,否则"按时间排"可能压根没改变任何东西。
 *  · S1–S3 源码锁:档必须真接线、锚点必须共享同一次 blame、本层不得出现第二份锚点实现。
 *
 * 判据本体不在这里重写:锚点全部由生产入口 `headAges` 给出,排序全部经 `orderRowsByTime` 裁定。
 *
 * §5c 溯源水印:本文件受 `scripts/watermark.mjs` 管理。
 */
import assert from 'node:assert/strict'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { orderRowsByTime, parseArgs } from '../plan-tasks.mjs'
import { mkScratch } from '../lib/scratch-dir.mjs'
import { gitBinary } from '../lib/face-reader.mjs'

const ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..')
const CLI = path.join(ROOT, 'scripts', 'plan-tasks.mjs')

const tOld = Date.UTC(2026, 8, 1)
const tMid = Date.UTC(2026, 9, 1)
const tNew = Date.UTC(2026, 9, 20)

// 夹具:行内**一个日期都不写** ⇒ 锚点只能来自 blame。这样"日期散文"这一维不会替排序作证
// (写了日期,测出来的就可能是 latestDateMsInRow 而不是我声称在测的那把尺子)。
const rows4 = [
  { line: 10, raw: '- [ ] 最陈旧的一张' },
  { line: 20, raw: '- [ ] 中间那张' },
  { line: 30, raw: '- [ ] 最近动过的这张' },
  { line: 40, raw: '- [ ] 量不到锚点的这张' },
]
const ages4 = new Map([
  [10, { anchorTs: tOld }],
  [20, { anchorTs: tMid }],
  [30, { anchorTs: tNew }],
  [40, { anchorTs: null }],
])
const linesOf = (r) => r.rows.map((x) => x.line).join(',')

test('P1 late = 最近的在最前,无锚点排末尾', () => {
  assert.equal(linesOf(orderRowsByTime(rows4, ages4, 'late')), '30,20,10,40')
})

test('P2 early = 最陈旧在最前,无锚点**仍**排末尾', () => {
  assert.equal(linesOf(orderRowsByTime(rows4, ages4, 'early')), '10,20,30,40')
})

test('P3 阳性对照:两种 mode 必须给出不同顺序(相同即锚点没参与排序,上面两条空过)', () => {
  assert.notEqual(
    linesOf(orderRowsByTime(rows4, ages4, 'late')),
    linesOf(orderRowsByTime(rows4, ages4, 'early')),
  )
})

test('P4 反向锁:量不到锚点的行在两种 mode 下都不得占据头部', () => {
  for (const mode of ['late', 'early']) {
    const got = orderRowsByTime(rows4, ages4, mode)
    assert.notEqual(got.rows[0].line, 40, `${mode}:拿"没量到"冒充排序端点就是 §0.3 禁止的那一型`)
    assert.equal(got.unanchored.length, 1)
    assert.equal(got.anchoredCount, 3)
  }
})

test('P5 行数守恒:排序档不得静默少一票(丢行=把票从派单面上摘掉)', () => {
  for (const mode of ['late', 'early'])
    assert.equal(orderRowsByTime(rows4, ages4, mode).rows.length, rows4.length)
})

test('P6 确定性:同锚点回退行号升序;打乱输入两次调用必须同序', () => {
  const tie = orderRowsByTime(
    [
      { line: 7, raw: '- [ ] 同刻 B' },
      { line: 5, raw: '- [ ] 同刻 A' },
    ],
    new Map([
      [5, { anchorTs: tMid }],
      [7, { anchorTs: tMid }],
    ]),
    'late',
  )
  assert.equal(linesOf(tie), '5,7')
  const shuffled = orderRowsByTime([...rows4].reverse(), ages4, 'late')
  assert.equal(linesOf(shuffled), '30,20,10,40')
})

test('P7 非法 mode 当场抛,不静默挑一种顺序', () => {
  assert.throws(() => orderRowsByTime(rows4, ages4, 'newest-first'))
})

test('P8 锚点表取不到 ⇒ 全部行落 unanchored(由调用方大声报名"未判定")', () => {
  const got = orderRowsByTime(rows4, null, 'late')
  assert.equal(got.rows.length, rows4.length)
  assert.equal(got.unanchored.length, rows4.length)
  assert.equal(got.anchoredCount, 0)
})

test('G1 --order 少值 / 错值 / 被下一枚旗标吃掉,三种都必须记成用法错', () => {
  for (const argv of [['--open', '--order'], ['--open', '--order=bogus'], ['--open', '--order', '--gate']]) {
    const o = parseArgs(argv)
    assert.equal(o.flagIssues.length, 1, `${argv.join(' ')} 必须产生一条用法错,实测 ${o.flagIssues.length}`)
  }
})

test('G2 等号与空格两种写法都收到;不带旗标必须 null 且零用法错', () => {
  assert.equal(parseArgs(['--open', '--order=late']).order, 'late')
  assert.equal(parseArgs(['--open', '--order', 'early']).order, 'early')
  const bare = parseArgs(['--open', '--dispatchable', '--exclude-inflight'])
  assert.equal(bare.order, null)
  assert.equal(bare.flagIssues.length, 0, '默认档不得因新旗标多出一条用法错')
})

// ── 端到端:临时仓 + 伪作者日期 + 真 CLI ──
function withRepo(fn) {
  const dir = mkScratch('plan-order')
  const git = (...args) =>
    spawnSync(
      gitBinary(),
      ['-c', 'safe.directory=*', '-c', 'user.email=t@t', '-c', 'user.name=t', '-C', dir, ...args],
      // 本机派生 git 必须显式 stdio,否则稳定报 spawnSync EBUSY(§12g)
      { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', windowsHide: true, timeout: 120000 },
    )
  const gitAt = (when, ...args) =>
    spawnSync(
      gitBinary(),
      ['-c', 'safe.directory=*', '-c', 'user.email=t@t', '-c', 'user.name=t', '-C', dir, ...args],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
        encoding: 'utf8',
        windowsHide: true,
        timeout: 120000,
        env: { ...process.env, GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when },
      },
    )
  const put = (body) => writeFileSync(path.join(dir, 'PROJECT_PLAN.md'), body, 'utf8')
  const run = (args) =>
    spawnSync(process.execPath, [CLI, '--root', dir, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
    })
  // 只取"出单清单"那一段的行号序列(汇总头注里也有数字,混进来会把头注当票)
  const orderOf = (out) => {
    const body = out.split('\n').filter((l) => /^\s{2}L\d+\s{2}/.test(l))
    return body.map((l) => Number(l.trim().slice(1).match(/^\d+/)[0])).join(',')
  }
  try {
    fn({ dir, git, gitAt, put, run, orderOf })
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const PLAN_TWO = '# 计划\n- [ ] 甲票 无人做\n- [ ] 乙票 无人做\n'
const PLAN_TWO_TOUCHED = '# 计划\n- [ ] 甲票 无人做\n- [ ] 乙票 无人做 —— 20 天后有人补了一句进展\n'

test('E1 late 档必须把"最近被动过"那张排在前面(真 CLI + 伪作者日期)', () => {
  withRepo(({ git, gitAt, put, run, orderOf }) => {
    assert.equal(git('init', '-q', '.').status, 0)
    put(PLAN_TWO)
    assert.equal(gitAt('2026-09-01T00:00:00', 'add', '-A', '--', 'PROJECT_PLAN.md').status, 0)
    assert.equal(gitAt('2026-09-01T00:00:00', 'commit', '-q', '-m', 'base').status, 0)
    // 只动乙 ⇒ 乙的 blame 锚点变新,甲停在 9-01
    put(PLAN_TWO_TOUCHED)
    assert.equal(gitAt('2026-10-20T00:00:00', 'add', '-A', '--', 'PROJECT_PLAN.md').status, 0)
    assert.equal(gitAt('2026-10-20T00:00:00', 'commit', '-q', '-m', 'touch-yi').status, 0)
    const r = run(['--open', '--order=late'])
    assert.equal(r.status, 0, `CLI 不该红:${r.stdout}\n${r.stderr}`)
    assert.match(r.stdout, /时间排序档 --order=late/, '排序档必须自己报名,否则读的人看不出这是时间单')
    assert.equal(orderOf(r.stdout), '3,2', `乙(L3)必须在甲(L2)前,实测 ${orderOf(r.stdout)}`)
  })
})

test('E2 控制测量:同一份仓不带 --order 必须按行号出(证明 E1 的顺序是排序档给的)', () => {
  withRepo(({ git, gitAt, put, run, orderOf }) => {
    assert.equal(git('init', '-q', '.').status, 0)
    put(PLAN_TWO)
    assert.equal(gitAt('2026-09-01T00:00:00', 'add', '-A', '--', 'PROJECT_PLAN.md').status, 0)
    assert.equal(gitAt('2026-09-01T00:00:00', 'commit', '-q', '-m', 'base').status, 0)
    put(PLAN_TWO_TOUCHED)
    assert.equal(gitAt('2026-10-20T00:00:00', 'add', '-A', '--', 'PROJECT_PLAN.md').status, 0)
    assert.equal(gitAt('2026-10-20T00:00:00', 'commit', '-q', '-m', 'touch-yi').status, 0)
    const r = run(['--open'])
    assert.equal(r.status, 0, r.stdout + r.stderr)
    assert.doesNotMatch(r.stdout, /时间排序档/, '默认档不许自称按时间排过')
    assert.equal(orderOf(r.stdout), '2,3', `默认必须是行号序,实测 ${orderOf(r.stdout)}`)
  })
})

test('E3 索引面没有历史可问 ⇒ 必须大声"未判定"并按默认行号出,绝不冒充时间序', () => {
  withRepo(({ git, gitAt, put, run, orderOf }) => {
    assert.equal(git('init', '-q', '.').status, 0)
    put(PLAN_TWO)
    assert.equal(gitAt('2026-09-01T00:00:00', 'add', '-A', '--', 'PROJECT_PLAN.md').status, 0)
    assert.equal(gitAt('2026-09-01T00:00:00', 'commit', '-q', '-m', 'base').status, 0)
    // 只暂存不提交:索引面上的新行结构上没有历史可 blame
    put(PLAN_TWO_TOUCHED)
    assert.equal(gitAt('2026-10-20T00:00:00', 'add', '-A', '--', 'PROJECT_PLAN.md').status, 0)
    const r = run(['--staged', '--open', '--order=late'])
    assert.equal(r.status, 0, r.stdout + r.stderr)
    assert.match(
      r.stdout,
      /--order=late \*\*未判定\*\*/,
      `锚点取不到必须点名未判定,实测:\n${r.stdout.slice(0, 400)}`,
    )
    assert.doesNotMatch(r.stdout, /时间排序档 --order=late:锚点/, '未判定时不许同时报"已按此刻排序"')
    assert.equal(orderOf(r.stdout), '2,3')
  })
})

test('S1 源码锁:--open 档必须真调用 orderRowsByTime(造好没装车=没有,§0.9)', () => {
  const src = readFileSync(CLI, 'utf8')
  assert.match(
    src,
    /const or = orderRowsByTime\(rowsOut, a\.ageByLine, o\.order\)/,
    '派单出口必须真调排序,否则 --order 是一枚无人吃的旗标',
  )
  assert.match(src, /listRows\(rowsOut, o\.face, ageFaceForOrder\)/, '排序结果必须交给出单面')
})

test('S2 源码锁:锚点必须共享同一次 blame(第二次派生会让到期读数与出单顺序来自不同瞬间)', () => {
  const src = readFileSync(CLI, 'utf8')
  const calls = src.match(/headAges\(/g) ?? []
  assert.equal(calls.length, 1, `headAges 在本文件只许调用一次,实测 ${calls.length}`)
  assert.match(src, /a\.ageByLine = byLine/, 'enrichStale 必须把全量锚点留给排序档')
})

test('S3 源码锁:本层不得出现第二份锚点实现(blame 字面量只能在 lib/plan-line-age.mjs)', () => {
  const src = readFileSync(CLI, 'utf8')
  for (const marker of ['--line-porcelain', 'author-time', 'blameLineTimes'])
    assert.ok(!src.includes(marker), `本文件出现 ${marker} = 抄了第二份年龄判据(§0.6/§22c)`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
