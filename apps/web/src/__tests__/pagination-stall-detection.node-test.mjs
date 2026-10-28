// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 票 G-816010 的验收入口:
//   node --test apps/web/src/__tests__/pagination-stall-detection.node-test.mjs
//
// ## 文件名与票面命令不同,理由是被量出来的,不是审美
//
// 票面点名的落点是 `pagination-stall-detection.test.mjs`。实测(2026-10-07,apps/web 装的
// vitest = 4.1.10):`apps/web/vitest.config.ts` 的 `test` 块**没有** `include` 覆盖,于是收集面
// 走 vitest 自带默认 include(住在 dist 的 defaults 分块里,不在本文写它的路径 —— 那文件名带
// 构建哈希,升级即漂)。默认形状是「双星号 斜杠 星点左花括号 test 竖线 spec 右花括号 点
// 问号左括号 c 竖线 m 右括号 方括号 j t 竖线 s 竖线 x 可选括号 可选括号」—— 就是
// `?c|m + js|jsx|ts|tsx` 那一族,它**匹配** `.test.mjs`(注释里不逐字写出这条 glob:那个片段
// 自带块注释闭合序列,写进 `/* */` 会让本文件在语法层就炸 —— 已实测过一次,报错行号指到注释中段)。
// 阳性对照做过了:临时放一份 `apps/web/src/__tests__/zzprobe-collection.test.mjs`,
// `vitest list --filesOnly` 把它列进收集面(输出第一行原样是那个路径)。而 vitest 不认识
// `node:test` 的用例登记,收进去就报 `No test suite found in file`(vitest 的 cli-api 分块里
// 就是这句话)⇒ `pnpm --filter @ihui/web test` 与 CI 的 `pnpm turbo run test` 一起红。
// 出路沿 `packages/shared` 当天为同一型冲突定下的命名(`src/chat/__tests__/
// projection-watermark.node-test.mjs`,头注写得很清楚):把 `.test.` 中间那个点换成连字符,
// 于是 vitest 不收、`node --test` 照跑。往 `exclude` 里加一条不是出路(那只治本包配置,
// 而 `apps/web/tests` 与 `src` 两棵收集树都在默认 glob 里,下一个同名落点又会中招)。
//
// 判据只住在 `../lib/pagination-stall.ts` 一份(§22c:测试不得抄第二份判据)——
// 本文件不重算游标比对、不重实现首行复核,只把一次翻页喂给生产入口并断言它给出的判决。
//
// 成对是硬要求:每条"必拒"都配一条"不得误拒"。只留前者,这道判据就可能只是把功能改坏了 ——
// 票面原话"静默成功=死循环或永久缺页"的反面是"乱报错=每次翻之都报错",两头都要有锁。
import test from 'node:test'
import assert from 'node:assert/strict'

import {
  CURSOR_ADVANCE_OUTCOMES,
  judgePageAdvance,
  PAGE_ADVANCE_REASONS,
  WINDOW_FRONT_OUTCOMES,
} from '../lib/pagination-stall.ts'

/** 造一批行,只为了验"丢弃了多少行"这一维能不能报出来。 */
function rows(count) {
  return Array.from({ length: count }, (_, i) => ({ id: `m${i}` }))
}

/** 首屏之后拿着游标往上翻的正常一页:请求带 C1,响应给 C2,权威首行两次都是 f0。 */
function normalOlderPage() {
  return {
    requestCursor: 'C1',
    responseCursor: 'C2',
    responseHasMore: true,
    rows: rows(50),
    windowFront: { before: 'f0', after: 'f0', fromAuthority: true },
  }
}

// ── 验收 ①:游标未推进 ⇒ 必须停止 + 可重试失败(静默成功=死循环或永久缺页) ─────────
test('① 响应游标与请求游标相同 ⇒ stalled / retryable / 停止补拉,三件同时成立', () => {
  const r = judgePageAdvance({
    requestCursor: 'C1',
    responseCursor: 'C1',
    responseHasMore: true,
    rows: rows(50),
    windowFront: { before: 'f0', after: 'f0', fromAuthority: true },
  })
  assert.equal(r.cursor, 'stalled')
  assert.equal(
    r.retryable,
    true,
    '卡住必须是"可重试失败";为 false 时消费方会把它当"成功且没有更多",于是永久缺页',
  )
  assert.equal(r.stopPaging, true, '还带着同一个游标继续拉就是 replay')
  assert.equal(r.discardBatch, true, '本次没有前进信息,收下它与 replay 不可区分')
  assert.equal(r.discardedRowCount, 50, '丢弃要报数,不得静默')
  assert.ok(r.reasons.includes('cursor-unchanged'), '结论必须带出处')
})

test('① 反向对照:正常翻页(C1 → C2)不得被①这条判据误伤', () => {
  const r = judgePageAdvance(normalOlderPage())
  assert.equal(r.cursor, 'advanced')
  assert.equal(r.retryable, false)
  assert.equal(r.stopPaging, false)
  assert.equal(r.discardBatch, false)
  assert.equal(r.discardedRowCount, null, '没丢弃就不该编一个 0 出来冒充"报了数"')
  assert.ok(r.reasons.includes('cursor-advanced'))
})

test('① 服务端声明还有更多却不给可继续的游标(null)⇒ 同样是 stalled,不是"链走完了"', () => {
  // 我方真形:共享层 deriveHistoryBoundary 在 hasMore=true 时把 nextCursor 原样递出,
  // 若那一页本身没有可继续的落点,产出就是 hasOlder:true 配 olderCursor:null ——
  // 消费方 loadOlder 的 `if (!cursor) return` 随即静默停在半途(永久缺页,零日志)。
  const r = judgePageAdvance({
    requestCursor: 'C1',
    responseCursor: null,
    responseHasMore: true,
    rows: rows(3),
  })
  assert.equal(r.cursor, 'stalled')
  assert.equal(r.retryable, true)
  assert.ok(r.reasons.includes('cursor-missing-while-has-more'))
})

test('① 反向对照:hasMore 为 false 的空游标是合法终点,不得判成失败', () => {
  const r = judgePageAdvance({
    requestCursor: 'C1',
    responseCursor: null,
    responseHasMore: false,
    rows: rows(7),
    windowFront: { before: 'f0', after: 'f0', fromAuthority: true },
  })
  assert.equal(r.cursor, 'chain-exhausted')
  assert.equal(r.retryable, false, '翻到底不是错误;报一次错就是"乱报错"那一面')
  assert.equal(r.discardBatch, false)
  assert.equal(r.stopPaging, true, '链走完了仍然不该再发一次')
})

// ── 验收 ②:窗口首行已不在权威侧 ⇒ 整批丢弃,并且**报数**(不静默) ──────────────────
test('② 权威重读的首行两次不一致 ⇒ 整批丢弃并报出行数', () => {
  const r = judgePageAdvance({
    ...normalOlderPage(),
    windowFront: { before: 'f0', after: 'g7', fromAuthority: true },
  })
  assert.equal(r.frontCheck, 'moved')
  assert.equal(r.discardBatch, true, '把已移除的历史行拼回去就是复活它')
  assert.equal(r.discardedRowCount, 50, '票面要求"丢弃且报数",计数缺席就是静默')
  assert.ok(r.reasons.includes('front-moved'))
})

test('② 两维互不顶账:游标推进了但首行已移动 ⇒ 照样整批丢弃', () => {
  // 判序的意义:如果游标推进就短路放过首行维,那"行集被权威侧动过、而游标恰好也换了"这一格
  // 永远不会红 —— 而这正是上游那条注释点名的复活形态。
  const r = judgePageAdvance({
    requestCursor: 'C1',
    responseCursor: 'C2',
    responseHasMore: true,
    rows: rows(20),
    windowFront: { before: 'f0', after: null, fromAuthority: true },
  })
  assert.equal(r.cursor, 'advanced')
  assert.equal(r.frontCheck, 'moved')
  assert.equal(r.discardBatch, true)
  assert.equal(r.discardedRowCount, 20)
})

test('② 反向对照:首行两次一致 ⇒ 不得判 moved、不得丢弃', () => {
  const r = judgePageAdvance(normalOlderPage())
  assert.equal(r.frontCheck, 'intact')
  assert.equal(r.discardBatch, false)
  assert.ok(r.reasons.includes('front-intact'))
})

test('② 两次都读到"窗口是空的"是一致结论,不是"没读到"', () => {
  const r = judgePageAdvance({
    requestCursor: 'C1',
    responseCursor: 'C2',
    rows: rows(4),
    windowFront: { before: null, after: null, fromAuthority: true },
  })
  assert.equal(r.frontCheck, 'intact', 'null==null 是权威侧两次都说"没有首行",不是缺证据')
  assert.equal(r.discardBatch, false)
})

test('② 拿不出权威重读证据 ⇒ 落 undetermined 并报名,绝不默认"首行没动"', () => {
  // 我方现状就是这一格:分页读路径没有第二条权威重读通道。判据不许把"没看清"写成"没问题"。
  const r = judgePageAdvance(normalOlderPage2())
  assert.equal(r.frontCheck, 'undetermined')
  assert.ok(r.reasons.includes('front-not-reread'))
  assert.equal(r.discardBatch, false, '未判定不是丢弃的理由')
  assert.equal(
    r.cursor,
    'advanced',
    '游标维与首行维各自给结论:首行没证据不能连带把游标也写成未判定',
  )
})

/** 与 normalOlderPage 同形但故意不带 windowFront —— 专门喂"没有权威证据"那一臂。 */
function normalOlderPage2() {
  return {
    requestCursor: 'C1',
    responseCursor: 'C2',
    responseHasMore: true,
    rows: rows(50),
  }
}

test('② 丢弃但没有行信息 ⇒ 数量报 null 并点名 row-count-unknown,不编 0', () => {
  const r = judgePageAdvance({
    requestCursor: 'C1',
    responseCursor: 'C1',
    responseHasMore: true,
    windowFront: { before: 'f0', after: 'f0', fromAuthority: true },
  })
  assert.equal(r.discardBatch, true)
  assert.equal(r.discardedRowCount, null, '0 会被读成"丢了 0 行 = 什么都没丢"')
  assert.ok(r.reasons.includes('row-count-unknown'))
})

// ── 验收 ③:正常翻页不得误判(反向锁;并覆盖"无法判"这一第三态) ──────────────────
test('③ 正常翻页的完整形态:不报失败、不丢弃、不停止补拉、不欠报名', () => {
  const r = judgePageAdvance(normalOlderPage())
  assert.equal(r.cursor, 'advanced')
  assert.equal(r.frontCheck, 'intact')
  assert.equal(r.retryable, false)
  assert.equal(r.discardBatch, false)
  assert.equal(r.stopPaging, false)
  assert.deepEqual(r.reasons, ['cursor-advanced', 'front-intact'], '正常路径的出处必须恰好两条')
})

test('③ 响应根本没有游标这一项(字段缺席)⇒ undetermined 并报名,不当作推进也不当作失败', () => {
  const r = judgePageAdvance({
    requestCursor: 'C1',
    responseHasMore: true,
    rows: rows(10),
    windowFront: { before: 'f0', after: 'f0', fromAuthority: true },
  })
  assert.equal(r.cursor, 'undetermined')
  assert.ok(r.reasons.includes('no-cursor-conclusion'))
  assert.equal(r.retryable, false, '没看清不是失败;判成失败就是拿空白维去弹用户的错')
  assert.equal(r.stopPaging, true, '但也不能带着同一个游标继续发 —— 那是 replay')
  assert.equal(r.discardBatch, false)
})

test('③ 显式 undefined 与字段缺席同判(调用方从 JSON 里摊出来的就是 undefined)', () => {
  const r = judgePageAdvance({
    requestCursor: 'C1',
    responseCursor: undefined,
    rows: rows(1),
  })
  assert.equal(r.cursor, 'undetermined')
  assert.ok(r.reasons.includes('no-cursor-conclusion'))
})

test('③ 首屏(未带游标)⇒ 推进维无从判,如实落 undetermined 而不是"正常推进"', () => {
  const r = judgePageAdvance({
    requestCursor: null,
    responseCursor: 'C1',
    responseHasMore: true,
    rows: rows(50),
    windowFront: { before: null, after: 'f0', fromAuthority: true },
  })
  assert.equal(r.cursor, 'undetermined', '没有基准可比时,任何"推进了"的结论都是猜出来的')
  assert.ok(r.reasons.includes('no-request-cursor'))
  assert.equal(r.retryable, false)
  assert.equal(r.frontCheck, 'moved', '权威侧从"空窗口"变成有首行,确实动了行')
})

test('③ 反向锁的第二面:hasMore 缺席时,null 游标仍按"链走完"而不是"卡住"', () => {
  // 缺席 = 服务端没声明,不能顺手读成 true —— 读成 true 会把每次正常收尾判成失败。
  const r = judgePageAdvance({
    requestCursor: 'C1',
    responseCursor: null,
    rows: rows(0),
    windowFront: { before: 'f0', after: 'f0', fromAuthority: true },
  })
  assert.equal(r.cursor, 'chain-exhausted')
  assert.equal(r.retryable, false)
})

// ── 闭集与形状:判据不得说它自己都不认识的话 ────────────────────────────────────
test('结论闭集与理由闭集各自在位,且判据产出的每一项都出自闭集', () => {
  const samples = [
    normalOlderPage(),
    { requestCursor: 'C1', responseCursor: 'C1' },
    { requestCursor: 'C1', responseCursor: null, responseHasMore: true },
    { requestCursor: null, responseCursor: 'C1' },
    { requestCursor: 'C1', windowFront: { before: 'a', after: 'b', fromAuthority: true } },
  ]
  for (const s of samples) {
    const r = judgePageAdvance(s)
    assert.ok(CURSOR_ADVANCE_OUTCOMES.includes(r.cursor), `游标结论越界:${r.cursor}`)
    assert.ok(WINDOW_FRONT_OUTCOMES.includes(r.frontCheck), `首行结论越界:${r.frontCheck}`)
    assert.ok(r.reasons.length > 0, '任何结论都必须带出处,空 reasons 等于没判')
    for (const reason of r.reasons) {
      assert.ok(PAGE_ADVANCE_REASONS.includes(reason), `理由不在闭集:${reason}`)
    }
  }
})

test('纯函数:同一份输入两次判定逐字同形,且不碰输入对象', () => {
  const input = Object.freeze({
    ...normalOlderPage(),
    windowFront: Object.freeze({ before: 'f0', after: 'f0', fromAuthority: true }),
  })
  assert.deepEqual(judgePageAdvance(input), judgePageAdvance(input))
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
