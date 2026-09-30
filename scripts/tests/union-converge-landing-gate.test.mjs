// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试 · 守门 130 的 F9/F9b 两维在**收敛落地闸**上的装车证明(立项票 G-606 C 段)。
//
// 这一档要钉死的不是"判据函数算得对不对"(那是 `--self-test` 13 条与
// `scripts/tests/union-converge.test.mjs` 的事),而是**它到底有没有被装上**。
// 2026-09-28 那一次半成品的形状是:判据函数写全了、`--self-test` 全绿、报告也写了,
// 而调用点落在 `for (const p of mergedClean)` 里 —— 那个循环开头就是
// `if (LIVE_DOCS.includes(p)) continue`,而根台账 `PROJECT_PLAN.md` 正是 LIVE_DOCS 之一,
// 于是**这条判据在收敛落地路径上生效次数为 0**。并集策略("每行重数取 max")本身就是
// 状态副本与撞号的产地,而 commit-tree 不跑 pre-commit ⇒ 门不存在,分叉就这么进了主线。
// 本仓最高频的失效型就是"造好没装车"(守门 70/76/81/105/115 同族),所以这里的用例
// 一律走 `plan()` 真跑一次归并,**摘掉调用点即翻红**;反向对照同时钉住"合法收敛不得被误红"
// —— 否则这条锁的唯一结局就是把每一次收敛都堵成人工选边,那比没有门更贵。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { __test__ as U } from '../union-converge.mjs'

const GIT = 'C:/Program Files/Git/cmd/git.exe'
const HERE = dirname(fileURLToPath(import.meta.url))

/**
 * 三方夹具:共同基底 + 两个兄弟提交(各自动台账),返回 `plan()` 需要的两侧 sha。
 *
 * `core.autocrlf=false` 必须先钉死:本机默认 true,行尾会被换掉 ⇒ 逐字节断言测的就不再是判据。
 * 末尾必须 `checkout -q main`:上一支 `checkout HEAD~1` 会把 HEAD 留在 detached 的对侧,
 * 那时 `resolveTargets` 报"已同步",用例就变成在测夹具而不是测产品(同 union-converge.test.mjs 的教训)。
 */
function ledgerRepo(baseText, oursText, theirsText) {
  const dir = mkScratch('union-landgate-')
  const run = (...a) =>
    execFileSync(GIT, ['-c', 'safe.directory=*', '-c', 'core.quotepath=false', ...a], {
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
    }).trim()
  run('init', '-q', '-b', 'main')
  run('config', 'user.email', 't@t')
  run('config', 'user.name', 't')
  run('config', 'core.autocrlf', 'false')
  writeFileSync(join(dir, 'PROJECT_PLAN.md'), baseText, 'utf8')
  run('add', '-A')
  run('commit', '-qm', 'base')
  writeFileSync(join(dir, 'PROJECT_PLAN.md'), oursText, 'utf8')
  run('add', '-A')
  run('commit', '-qm', 'ours')
  const ours = run('rev-parse', 'HEAD')
  run('checkout', '-q', 'HEAD~1')
  writeFileSync(join(dir, 'PROJECT_PLAN.md'), theirsText, 'utf8')
  run('add', '-A')
  run('commit', '-qm', 'theirs')
  const theirs = run('rev-parse', 'HEAD')
  run('update-ref', 'refs/heads/main', ours)
  run('checkout', '-q', 'main')
  return { dir, run, ours, theirs }
}

const HEAD_TEXT = '# 台账'
const ROW = (s) => `${s}\n`
const LEDGER_BASE = `${HEAD_TEXT}\n\n`

// ── ① F9(撞号组)维:归并把两条不同议题拼到同一编号下 ⇒ 落地闸必须点名 ──────────
// 两侧**各自都不撞**(每侧只有一行 G-710),撞号是并集造出来的 —— 这正是"取号器并发让号失败"
// 的形状(G-417/G-606 真仓就是它)。判据若没装车,这枚新撞号就随合并提交进主线,而合并提交
// 不跑 pre-commit ⇒ 下一次有人碰台账才在 blocking 门上炸出来,并且组数已经翻倍。
const F9_A = ROW('- [ ] **G-710 门33的provider名单该由谁供给**:本侧登记的议题。')
const F9_B = ROW('- [ ] **G-710 归档器写盘前不加闸**:对侧登记的另一件完全不同的事。')

test('装车证明①:归并新增撞号组必须被落地闸点名 —— 摘掉调用点(planStateRegressions)本条即翻红', () => {
  const { dir, ours, theirs } = ledgerRepo(LEDGER_BASE, LEDGER_BASE + F9_A, LEDGER_BASE + F9_B)
  try {
    const p = U.plan(ours, theirs, dir)
    // 夹具自证:两侧确实都不撞(否则这条测的是存量而不是归并造的债)
    for (const [name, sha] of [['本侧', ours], ['对侧', theirs]]) {
      const side = execFileSync(GIT, ['-c', 'safe.directory=*', 'show', `${sha}:PROJECT_PLAN.md`], {
        cwd: dir,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 120000,
      })
      assert.equal(
        (side.match(/G-710/g) ?? []).length,
        1,
        `${name}面必须只有一行 G-710,实测 ${JSON.stringify(side)}`,
      )
    }
    const hits = p.bad.filter((b) => b.includes('归并放大任务状态分叉'))
    assert.ok(
      hits.length > 0,
      '落地闸一条状态分叉都没报 ⇒ 判据没挂在 LIVE_DOCS 归并之路上(写了个函数没人调)',
    )
    assert.ok(
      hits.some((b) => b.includes('F9 归并新增撞号组') && b.includes('G-710')),
      `新增撞号必须逐组点名到编号,实测 ${JSON.stringify(hits)}`,
    )
    assert.ok(
      hits.some((b) => b.startsWith('PROJECT_PLAN.md ')),
      `必须点名到路径(否则报告答不出是哪份文档放大分叉),实测 ${JSON.stringify(hits)}`,
    )
  } finally {
    rmScratch(dir)
  }
})

// ── ② F1(计数档)维:同一枚主键两侧各写一种状态 ⇒ 并集把两态都留下 ───────────
// 这一条钉的是**调用点本身**(F1 在我这几笔之前就写在判据里,却从未在这条路上生效过)。
// 只测 F9/F9b 是不够的:那等于只证明"新加的两行代码有人调",而不证明整条判据链在门上。
const F1_OPEN = ROW('- [ ] **G-711 部署环ff竞态**:说明。')
const F1_DONE = ROW('- [x] ✅(2026-09-28) **G-711 部署环ff竞态**:说明。')

test('装车证明②:归并把同主键的两个状态并成一叉 ⇒ 计数档 F1 也必须在落地闸上点名(整条判据链的装车)', () => {
  const { dir, ours, theirs } = ledgerRepo(LEDGER_BASE, LEDGER_BASE + F1_OPEN, LEDGER_BASE + F1_DONE)
  try {
    const p = U.plan(ours, theirs, dir)
    const hits = p.bad.filter((b) => b.includes('归并放大任务状态分叉'))
    assert.ok(
      hits.some((b) => b.includes('F1 同主键两态并存')),
      `F1 必须由落地闸点名,实测 ${JSON.stringify(p.bad.slice(0, 4))}`,
    )
    assert.ok(
      hits.some((b) => b.includes('各侧最多 0')),
      `必须说清"是归并造的"而不是"两侧本来就叉",实测 ${JSON.stringify(hits)}`,
    )
  } finally {
    rmScratch(dir)
  }
})

// ── ③ 反向对照(比正例更重要):合法收敛一条都不许报 ────────────────────────
// 没有这一条,①② 就可能是"bad 非空"的空断言;而落地闸只要爱红,唯一出路就是人工选边
// —— 那正是本工具立项要消灭的动作(AGENTS §12e 同一条:恒红的门等于没有门)。
test('反向对照:两侧各新增不同编号的登记行 ⇒ 归并必须一条状态分叉都不报(合法收敛不得被误红)', () => {
  const { dir, ours, theirs } = ledgerRepo(
    LEDGER_BASE,
    LEDGER_BASE + ROW('- [ ] **G-712 甲议题**:本侧的。'),
    LEDGER_BASE + ROW('- [ ] **G-713 乙议题**:对侧的。'),
  )
  try {
    const p = U.plan(ours, theirs, dir)
    assert.deepEqual(
      p.bad.filter((b) => b.includes('归并放大任务状态分叉')),
      [],
      `合法收敛不得被判红,实测 ${JSON.stringify(p.bad)}`,
    )
    assert.deepEqual(p.bad, [], `整条落地闸都应放行,实测 ${JSON.stringify(p.bad.slice(0, 3))}`)
    const merged = execFileSync(GIT, ['-c', 'safe.directory=*', 'show', `${p.tree}:PROJECT_PLAN.md`], {
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
    })
    assert.ok(merged.includes('G-712') && merged.includes('G-713'), '两行都必须活着(工具的存在理由)')
  } finally {
    rmScratch(dir)
  }
})

// ── ④ 存量不得钉红:基准面/两侧本来就带的畸形号,归并没有制造它 ─────────────
// 逐字取自真仓 HEAD 面的真实畸形行(现读,不得自造)。这一条同时是"判据吃的是**并集结果 vs 三侧**"
// 的证明:基底那一份必须被喂进 sides,否则每一次收敛都会把别人的历史债算成本次放大。
const REAL_MALFORMED_ROW = (() => {
  const txt = execFileSync(GIT, ['-c', 'safe.directory=*', 'show', 'HEAD:PROJECT_PLAN.md'], {
    cwd: join(HERE, '..', '..'),
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
    maxBuffer: 1 << 28,
  })
  const hit = txt
    .split(/\r?\n/)
    .find((l) => l.includes('G-G-431 同型未普查的一格'))
  assert.ok(
    hit !== undefined,
    '真仓 HEAD 面取不到那行畸形号 ⇒ 样本已被清偿或搬走,本条须重新现读采集,不得改成自造夹具',
  )
  assert.ok(/^- \[.\] G-G-431 /.test(hit), `该行必须逐字保持畸形形态(族名两次),实测 ${hit.slice(0, 40)}`)
  return `${hit}\n`
})()

test('存量对照:基底里就带着的真实畸形行,归并带回时不得判红(否则每次收敛都红)', () => {
  const { dir, ours, theirs } = ledgerRepo(
    LEDGER_BASE + REAL_MALFORMED_ROW,
    LEDGER_BASE + REAL_MALFORMED_ROW + ROW('- [ ] **G-714 本侧新增**:一句话。'),
    LEDGER_BASE + REAL_MALFORMED_ROW + ROW('- [ ] **G-715 对侧新增**:一句话。'),
  )
  try {
    const p = U.plan(ours, theirs, dir)
    assert.deepEqual(
      p.bad.filter((b) => b.includes('F9b')),
      [],
      `存量畸形号不得算归并新增,实测 ${JSON.stringify(p.bad.filter((b) => b.includes('F9b')))}`,
    )
    const merged = execFileSync(GIT, ['-c', 'safe.directory=*', 'show', `${p.tree}:PROJECT_PLAN.md`], {
      cwd: dir,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
    })
    assert.ok(
      merged.includes('G-G-431'),
      '放过存量不等于吃掉存量:那一行必须仍在合并树里(零丢失承诺)',
    )
  } finally {
    rmScratch(dir)
  }
})

// ── ⑤ 形状锁(与 ①② 互补,不依赖数据):调用点必须在 LIVE_DOCS 那条路上 ──────
// ①② 是行为锁:摘线即红。但"把判据挪回 mergedClean"这一步在真仓不一定每次都撞得上数据
// (union-converge.mjs:1113 记过一次"数据相关的崩溃,行为用例天然测不到"),所以源码序这里也钉。
test('形状锁:状态分叉判据必须挂在 1) 活文档归并之路上,不得只存在于 2) 的 mergedClean 循环', () => {
  const src = readFileSync(join(HERE, '..', 'union-converge.mjs'), 'utf8')
  const liveLoop = src.indexOf('for (const p of LIVE_DOCS)')
  const step2 = src.indexOf('const mergedClean = []')
  assert.ok(liveLoop >= 0 && step2 > liveLoop, '夹具失效:LIVE_DOCS 循环或第二步起点没找到')
  const step1 = src.slice(liveLoop, step2)
  assert.match(
    step1,
    /planStateRegressions\(mergedText/,
    '第一步(活文档)里没有 planStateRegressions 调用 ⇒ 根台账的落地闸是空的(§22c「造好没装车」)',
  )
  assert.match(
    step1,
    /if \(p\.endsWith\('PROJECT_PLAN\.md'\)\)/,
    '调用点必须只对台账开判据(别的活文档没有任务行,判了就是假红源)',
  )
  assert.match(
    step1,
    /const sides = \[bt, a, b\]/,
    '判据必须吃**三方**(基底 + 两侧)做存量对照,只吃两侧会把基底的历史债算成归并新增',
  )
  const decl = src.indexOf('const violations = []')
  const firstPush = liveLoop + step1.indexOf('violations.push(')
  assert.ok(
    decl >= 0 && decl < firstPush,
    `violations 的声明必须先于第一次 push(2026-09-28 那次 TDZ 把全部会话的收敛卡死),实测 decl=${decl} firstPush=${firstPush}`,
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
