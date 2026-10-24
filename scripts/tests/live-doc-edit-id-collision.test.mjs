// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 镜像测试:scripts/live-doc-edit.mjs 的「同号不同题」落地闸(§22c —— 判据从源脚本 __test__ 出口拿,
// 本文件禁止再抄一份"什么算撞号")。
//
// 立案现场(2026-10-22):一席走正牌入口 {{NEXT_ID:G}} 连登三票,拿到 G-924 / G-926 / G-929,
// 落地后复算发现**每个号都已有别席的既存题**(那些行标着〔登记@2026-10-21〕;号在活文档里反复进出,
// 取号那一刻确实空闲、落地那一刻已被占)。既有两道闸都看不见这一型:
//   · F1 复合主键 = 编号 + 标题前缀逐字等值 ⇒ 同号不同题主键不同,不命中;
//   · 守门 194 同题多号 ⇒ 反方向,也不命中。
// ⇒ 结果:两席按同一个号领同一张票,派单面虚高,这正是"打架重复做"的机器成因。
//
// ⚠ 本闸的成组口径**不是本器自算的**,而是台账层 F9 那一把尺(`auditPlan().f9Declared` 声明位档
//   + `narrowF9Face` 的全已勾降档),与合并落地闸 / `plan-tasks.mjs --gate` 同一个面。
//   所以下面 C5 / C5b / C6 三条钉的都是"与那把尺一致",不是本器自己的偏好:
//   第一版在本器按 `r.key` 当编号自算分组,把 F1 的夹具(同号同题)也判成本闸射程,当场抢在 F1
//   前面把 DU-7 的装车证明顶掉(症状:rc 仍为 1,但拒绝理由点错名)。

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ } from '../live-doc-edit.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))

const OPEN = (id, title) => `- [ ] ${id} **${title}** 正文`
const DONE = (id, title) => `- [x] ✅(2026-10-22) ${id} **${title}** 正文`
const doc = (...lines) => lines.join('\n')

test('形状锁:判据从源脚本出口拿,且成组口径必须委托 F9(禁止第四把尺)', () => {
  assert.equal(typeof __test__.judgeNewIdCollisions, 'function')
  const src = readFileSync(join(HERE, '..', 'live-doc-edit.mjs'), 'utf8')
  const at = src.indexOf('export function judgeNewIdCollisions')
  assert.ok(at > 0, '判据必须住在源脚本里(测试里写一份必漂移)')
  const body = src.slice(at, src.indexOf('\n}\n', at))
  assert.match(body, /narrowF9Face\(auditPlan\(/, '必须吃 F9 的判定面(与合并落地闸/--gate 同面)')
  // 阳性对照:第一版留下的自算形状 —— 一旦出现就是"本器一套、门一套"重新分叉
  assert.doesNotMatch(body, /openRowsByKey/, '不得在本器里自造分组(那是第二把"什么算撞号")')
  const call = src.indexOf('judgeNewIdCollisions({')
  assert.ok(call > 0, 'main 里必须真的调用本闸(函数在而无人调 = 提交链上一路绿灯)')
  const blob = src.indexOf('writeBlob(nextLines')
  assert.ok(
    blob > call,
    '闸必须在 writeBlob 之前:内容一旦 commit,再 exit 1 就是把已入库谎报成没落地',
  )
})

test('C1 真撞车必拦:落地面里同一号挂着两个不同标题,而底稿没有这一组', () => {
  const r = __test__.judgeNewIdCollisions({
    baseText: doc(OPEN('G-900810', 'lint-staged 雷区仍有 84 枚')),
    nextText: doc(
      OPEN('G-900810', 'lint-staged 雷区仍有 84 枚'),
      OPEN('G-900810', '生产 web 的部署承载者没查清'),
    ),
  })
  assert.equal(r.undetermined, false)
  assert.equal(r.blocked.length, 1)
  assert.equal(r.blocked[0].key, 'G-900810')
  assert.equal(r.blocked[0].titleCount, 2)
  assert.equal(r.preexisting.length, 0, '底稿里这一组不存在 ⇒ 账必须记在本次')
})

test('C2 就地改写不误拦:同一条行换了内容,号没变', () => {
  const r = __test__.judgeNewIdCollisions({
    baseText: doc(OPEN('G-900811', '某票标题')),
    nextText: doc(`${OPEN('G-900811', '某票标题')} 〔补充现状〕`),
  })
  assert.equal(r.blocked.length, 0, '§1 建议的修法不得被判成违规')
})

test('C3 让号不误拦:旧号行删掉、同题在新号上出现一次', () => {
  const r = __test__.judgeNewIdCollisions({
    baseText: doc(OPEN('G-900812', '需要让号的事')),
    nextText: doc(OPEN('G-900813', '需要让号的事')),
  })
  assert.equal(r.blocked.length, 0)
})

test('C4 存量只报数不拦:撞号在底稿里已在、本次没再加', () => {
  const t = doc(OPEN('G-900814', '甲题的完整标题'), OPEN('G-900814', '乙题的完整标题'))
  const r = __test__.judgeNewIdCollisions({ baseText: t, nextText: t })
  assert.equal(r.blocked.length, 0, '拿别人留下的账钉红每一次落地 = 逼人绕开本器(§12e)')
  assert.equal(r.preexisting.length, 1)
})

test('C5 口径对账(与 F9 一致,不是本器偏好):同号一未勾一已勾仍算一组', () => {
  const t = doc(OPEN('G-900815', '待办题的完整标题'), DONE('G-900815', '另一道已结清的题'))
  const r = __test__.judgeNewIdCollisions({ baseText: t, nextText: t })
  assert.equal(r.preexisting.length, 1, 'F9 只在"组内全已勾"时降档;混一未勾就仍是一组')
  assert.equal(r.blocked.length, 0)
})

test('C5b 全已勾组降档只报数(F9 定级 2026-10-06 那一档必须一起继承)', () => {
  const t = doc(DONE('G-900816', '已结清的第一题'), DONE('G-900816', '已结清的第二题'))
  const r = __test__.judgeNewIdCollisions({ baseText: t, nextText: t })
  assert.equal(r.blocked.length, 0)
  assert.equal(r.preexisting.length, 0, '降档组不进判定面 ⇒ 本闸也不该把它念成存量')
})

test('C6 让界给 F1:同号同题(尾注不同)不成组,本闸不得抢在 F1 前面点错名', () => {
  // 夹具逐字取自 live-doc-edit.test.mjs 的 DU-7 第一臂:两行共享第一个分界符之前的题面 ⇒
  // 复合主键逐字等值 ⇒ 那是"同一件事被抄了两遍"(F1 射程),不是"一号两题"。
  const base = '- [ ] G-900700 端到端题面. 同一件事只该有一行当前状态'
  const dup = '- [ ] G-900700 端到端题面. 被第二席又抄了一份'
  const r = __test__.judgeNewIdCollisions({ baseText: doc(base), nextText: doc(base, dup) })
  assert.equal(r.blocked.length, 0, '本闸若在这一型上开火,拒绝理由就点错名(F1 的账记到撞号头上)')
})

test('C7 输入不成文本一律未判定:不许把"没读到内容"读成"没有撞号"', () => {
  for (const bad of [
    {},
    { baseText: '', nextText: '' },
    { baseText: null, nextText: doc() },
    { nextText: 42 },
  ]) {
    const r = __test__.judgeNewIdCollisions(bad)
    assert.equal(r.undetermined, true, `输入 ${JSON.stringify(bad)} ⇒ 必须未判定`)
    assert.equal(r.blocked.length, 0)
    assert.equal(r.preexisting.length, 0)
  }
})

test('C8 真仓面自证:底稿取 HEAD 的 PROJECT_PLAN 时,本闸读出的是存量而不是新增', () => {
  // 这一条防的是"夹具里永远 blocked=0、真面上一落地就全红"那一型(判据与取材面脱节)。
  const text = execFileSync(
    resolveGitBin() || 'git',
    ['-c', 'safe.directory=*', 'show', 'HEAD:PROJECT_PLAN.md'],
    { encoding: 'utf8', maxBuffer: 64 << 20, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  const r = __test__.judgeNewIdCollisions({ baseText: text, nextText: text })
  assert.equal(r.undetermined, false)
  assert.ok(text.includes('- [ ]'), '取材面必须是真台账(取到空文本时这一条会把假绿一起钉住)')
  assert.equal(r.blocked.length, 0, '同一份文本自己跟自己比 ⇒ 一组都不能算本次新增(否则棘轮无锚)')
  // 原断言 preexisting>=1 钉的是"HEAD 台账现读有存量撞号"这一事实前提;2026-10-23 清号提交
  // 485a183354(清偿 PROJECT_PLAN 重复登记存量)已把账面归零 ⇒ 前提过期,降为 >=0(只报数档
  // 在真面可跑通即可)。本条的不变量是"真面可读(undetermined=false)+ 自比不冒新增(blocked=0)";
  // "存量撞号被识别且不拦"这一判据行为由 C4 在夹具面钉住,不依赖台账是否恰好带伤。
  assert.equal(r.undetermined, false, '真面取材必须判得动(取不到内容不得读成"没有撞号")')
  assert.ok(r.preexisting.length >= 0, '存量档在 HEAD 真面跑通:现读 0 枚 = 台账已清,只报数不冒红')
})

// ── G313-U 族:出路①"批次内禁手填号"与期末对账的纯函数臂(2026-10-23 立,票面 G-313)──
// §22c:判据一律从 `__test__` 出口拿(resolveIdTokens / judgeLandedIdRecheck / manualIdDemandOf),
// 本文件不得再抄一份"什么算声明位编号/什么算撞号"。
const denseBase = (...extra) =>
  doc(...['G-1', 'G-2', 'G-3', 'G-4', 'G-5'].map((id) => OPEN(id, `既存${id}`)), ...extra)

test('G313-U1 批内手填号撞本批令牌窗口 ⇒ 改判池内下一枚空闲(两路取号互斥共池)', () => {
  const lines = [OPEN('{{NEXT_ID:G}}', '令牌行'), OPEN('G-6', '手填撞窗口')]
  const r = __test__.resolveIdTokens(lines, denseBase(), null, { manualCheck: true })
  assert.equal(r.ok, true, JSON.stringify(r.reason ?? ''))
  assert.equal(r.assigned, 'G-6', '令牌取池内空闲首枚(基准 max=5 ⇒ 首枚=6)')
  assert.equal(r.manualRewrites.length, 1, '手填 G-6 撞令牌窗口 ⇒ 必改判')
  assert.equal(r.manualRewrites[0].key, 'G-6')
  assert.equal(r.manualRewrites[0].to, 'G-7', '改判从令牌窗后续取,不得与令牌同号')
  assert.ok(r.lines[0].includes('G-6') && r.lines[1].includes('G-7'), '替换必须落到行上')
  assert.equal(r.manualKept.length, 0)
})

test('G313-U2 成对反例:不撞的手填号逐字保留,令牌照常取号', () => {
  const lines = [OPEN('{{NEXT_ID:G}}', '令牌行'), OPEN('G-9', '空闲手填号')]
  const r = __test__.resolveIdTokens(lines, denseBase(), null, { manualCheck: true })
  assert.equal(r.ok, true)
  assert.equal(r.assigned, 'G-6')
  assert.equal(r.manualRewrites.length, 0, 'G-9 不在窗口也不在令牌取号面 ⇒ 不得开火')
  assert.equal(r.lines[1], lines[1], '保留行必须逐字同形')
  assert.equal(r.manualKept.length, 1)
  assert.equal(r.manualKept[0].key, 'G-9')
})

test('G313-U3 本地底稿声明位已用的手填号不改判:拒绝面归 F9/登记闸(不得被偷换成自动放行)', () => {
  const lines = [OPEN('G-5', '别的题')]
  const r = __test__.resolveIdTokens(lines, doc(OPEN('G-5', '既存事')), null, {
    manualCheck: true,
  })
  assert.equal(r.ok, true)
  assert.ok(!r.assigned, '纯手填且不撞窗口 ⇒ 不建池、不发号(免池短路)')
  assert.equal(r.manualRewrites.length, 0, '改判不得接管 F9/登记闸的射程(IC-E2E/DU-7 同一型)')
  assert.equal(r.lines[0], lines[0], '行逐字保留,由下游写前闸判红交人工裁归属')
})

test('G313-U4 远端已用号的手填行 ⇒ 改判(这一面对既有写前闸不可见,G-454 教训)', () => {
  const remote = { max: { G: 10 }, ids: { G: ['G-8'] } }
  const lines = [OPEN('G-8', '手填撞远端')]
  const r = __test__.resolveIdTokens(lines, denseBase(), remote, { manualCheck: true })
  assert.equal(r.ok, true)
  assert.equal(r.manualRewrites.length, 1)
  assert.equal(r.manualRewrites[0].to, 'G-6', '空闲清单已扣远端已用号(8 不在池)⇒ 取 6')
  assert.ok(r.lines[0].includes('G-6'))
})

test('G313-U5 归档/正文引用面的号(扫描命中而声明位未用)⇒ 改判,且改判目标跳过保留手填号', () => {
  const lines = [OPEN('G-6', '撞归档引用面'), OPEN('G-7', '保留号')]
  const r = __test__.resolveIdTokens(lines, denseBase('归档占位:参见 G-6 旧事'), null, {
    manualCheck: true,
  })
  assert.equal(r.ok, true)
  assert.ok(!r.assigned, '本批无令牌')
  assert.equal(r.manualRewrites.length, 1)
  assert.equal(r.manualRewrites[0].key, 'G-6')
  assert.equal(r.manualRewrites[0].to, 'G-8', '6 被扫描面扣掉、7 是保留手填号 ⇒ 改判必须跳到 8')
  assert.equal(r.manualKept.length, 1)
  assert.equal(r.manualKept[0].key, 'G-7')
  assert.equal(r.lines[1], lines[1], '保留行逐字同形')
})

test('G313-U6 期末对账:同一号既挂本次行又挂他人行 ⇒ 检出;自比零撞;面取不到 ⇒ 未判定', () => {
  const ours = OPEN('G-6', '令牌行')
  const other = OPEN('G-6', '他人晚并入的题')
  const hit = __test__.judgeLandedIdRecheck({
    landedText: doc(ours, other),
    ourLines: [ours],
    families: ['G'],
  })
  assert.equal(hit.undetermined, false)
  assert.equal(hit.collisions.length, 1)
  assert.equal(hit.collisions[0].id, 'G-6')
  assert.match(hit.collisions[0].otherLine, /他人晚并入/, '撞号必须交出他人那一行做点名')
  const clean = __test__.judgeLandedIdRecheck({
    landedText: doc(ours, OPEN('G-7', '无关行')),
    ourLines: [ours],
    families: ['G'],
  })
  assert.equal(clean.collisions.length, 0, '自比不得报撞(与 C8 同一纪律)')
  for (const bad of [{}, { landedText: '' }, { landedText: 42 }]) {
    const und = __test__.judgeLandedIdRecheck(bad)
    assert.equal(und.undetermined, true, `${JSON.stringify(bad)} ⇒ 必须未判定`)
    assert.equal(und.collisions.length, 0, '未判定不得冒撞')
  }
})

test('G313-U7 manualIdDemandOf 射程:只吃不带令牌的非租约开起行,引述/租约/完成行不进', () => {
  const got = __test__.manualIdDemandOf([
    OPEN('G-6', '手填登记'),
    '- [ ] {{NEXT_ID:G}} **令牌行** 正文',
    '- [x] ✅(2026-10-23) G-7 **已结清** 正文',
    '段落里引述 G-8 不算登记行',
  ])
  assert.equal(got.length, 1)
  assert.equal(got[0].key, 'G-6')
  assert.equal(got[0].family, 'G')
  assert.equal(got[0].num, 6)
})

// ── P2/P3 族(2026-10-25 修,来源 .ihui-agent/tmp/seat-plan/REPORT.md)──────────────────────
// §22c:判据仍从 `__test__` 拿;下列"旧口径"臂只**复现缺陷形态**(把全量 effBlock 当 ourLines /
// 让全局正则跨行复用),不是第二份判据 —— 用来钉"新口径与旧口径在这一点上必须分叉"。

test('G313-U8 期末对账射程:保留的手填号(manualKept)不得被自动让号', () => {
  const tokLine = OPEN('G-6', '令牌行')
  const keptLine = OPEN('G-9', '人工保留号')
  const otherSame = OPEN('G-9', '他人晚并入的同号题')
  const lines = [tokLine, keptLine]
  const manualKept = [{ key: 'G-9', family: 'G', line: 1 }]
  const scope = __test__.landedRecheckScope(lines, manualKept)
  assert.deepEqual(scope.ourLines, [tokLine], 'ourLines 只含非保留行')
  assert.equal(scope.kept.has(1), true, '保留行下标必须交出(让号循环复用同一个集)')
  const landedText = doc(tokLine, keptLine, otherSame)
  // 旧口径(全量 effBlock):保留行把 G-9 记成"本次行",与同键他人行组成撞号 ⇒ 会被自动让号。
  const oldFace = __test__.judgeLandedIdRecheck({ landedText, ourLines: lines, families: ['G'] })
  assert.equal(oldFace.collisions.length, 1, '缺陷形态复现:G-9 被当成本次行(F9/登记闸的拒绝面被偷换)')
  assert.equal(oldFace.collisions[0].id, 'G-9')
  // 新口径:保留行不在射程 ⇒ 不得报撞,手填号原样留给人工裁归属 / 带原因放行。
  const newFace = __test__.judgeLandedIdRecheck({
    landedText,
    ourLines: scope.ourLines,
    families: ['G'],
  })
  assert.equal(newFace.collisions.length, 0, '保留的手填号不得被期末对账自动让号(头注承诺)')
  // 成对正控:非保留行(令牌产出)该撞还得撞 —— 射程收窄不得把真撞车一起放过。
  const hit = __test__.judgeLandedIdRecheck({
    landedText: doc(tokLine, OPEN('G-6', '他人同号题')),
    ourLines: scope.ourLines,
    families: ['G'],
  })
  assert.equal(hit.collisions.length, 1, '令牌产出撞他人行仍须检出')
  // 边界:manualKept 为空/坏形状 ⇒ 全量放行,行为与改动前逐字同形。
  assert.deepEqual(__test__.landedRecheckScope(lines, []).ourLines, lines)
  assert.deepEqual(__test__.landedRecheckScope(lines, [{ line: 'x' }, null]).ourLines, lines)
  // 源码锁:main 必须用该出口,且让号循环跳过保留行(函数在而 main 不接线 = 没修)。
  const src = readFileSync(join(HERE, '..', 'live-doc-edit.mjs'), 'utf8')
  assert.match(src, /landedRecheckScope\(effBlock, manualKept\)/)
  assert.match(src, /scope\.kept\.has\(/)
})

test('G313-U9 manualIdDemandOf 连续行:第一行命中令牌后,第二行仍须被识别为令牌行', () => {
  const lines = [
    '- [ ] G-901 第一件事. 正文 {{NEXT_ID:G}}',
    '- [ ] G-902 第二件事. 正文 {{NEXT_ID:G}}',
    '- [ ] G-903 第三件事. 手填号',
  ]
  const got = __test__.manualIdDemandOf(lines)
  assert.deepEqual(
    got.map((g) => g.key),
    ['G-903'],
    '前两行都带令牌 ⇒ 都不是手填行;旧实现从上一行匹配末尾继续 test,第二行会被漏认并误判成手填 G-902',
  )
  assert.equal(got[0].line, 2)
  // 成对正控:没有令牌的连续手填行照旧逐行认(射程不得不当收窄)。
  const both = __test__.manualIdDemandOf([OPEN('G-8', '手填甲'), OPEN('G-9', '手填乙')])
  assert.deepEqual(both.map((g) => g.key), ['G-8', 'G-9'])
  // 反向对照:全局正则的泄漏形态在旧口径下确实存在(用同一份 ID_TOKEN_RE 复现一次),
  // 证明本用例的夹具真能打到那一型,而不是"碰巧绿"。
  const re = /\{\{NEXT_ID:([A-Za-z]+)\}\}/g
  assert.equal(re.test(lines[0]), true)
  assert.equal(re.test(lines[1]), false, '全局 lastIndex 未复位 ⇒ 第二行同位置的令牌被漏认(旧实现根因)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
