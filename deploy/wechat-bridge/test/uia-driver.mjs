// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// UIA 只读驱动回归：保守解析（图片数/时间原文/作者/评论边界）、id 跨页稳定、字段派生、
// 强制失败回退判定；不触碰微信真机。
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDriver, __test__ as uia } from '../drivers/uia-readonly.mjs'
import { __test__ as bridge } from '../server.mjs'

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'uia-moments-sample.json')
const frame = JSON.parse(await readFile(FIXTURE, 'utf8'))

const moments = uia.parseMoments(frame)

// 三条有效动态：作者-only 的空正文条目被跳过；脏输入不抛错。
assert.equal(moments.length, 3, 'fixture 应解析出 3 条有效动态')

const withComments = moments[0]
assert.equal(withComments.authorName, '示例用户甲')
assert.equal(withComments.content, '周末去郊外露营，晒一晒新近整理的装备清单。')
assert.equal(withComments.timeText, '昨天 18:24')
assert.equal(withComments.imageCount, 3)
assert.deepEqual(withComments.commentTexts, [
  '示例用户乙：这套帐篷看着很结实。',
  '示例用户丙：求装备清单链接。',
])
assert.equal(withComments.comments, true)
assert.equal(withComments.authorResolved, false)
assert.equal(withComments.authorId, null)
assert.deepEqual(withComments.mediaUrls, [])
assert.equal(withComments.createdAt, null)
assert.equal(withComments.source, 'uia')

const plain = moments[1]
assert.equal(plain.authorName, '示例用户丁')
assert.equal(plain.content, '随手记一段日常感悟，不配图也不标时间。')
assert.equal(plain.timeText, '')
assert.equal(plain.imageCount, null)
assert.deepEqual(plain.commentTexts, [])
assert.equal(plain.comments, false)

const dirty = moments[2]
assert.equal(dirty.authorName, '脏数据正文第一行')
assert.equal(dirty.content, '脏数据正文第二行')
assert.equal(dirty.timeText, '11月24日 09:30')
assert.equal(dirty.imageCount, 5)
assert.deepEqual(dirty.commentTexts, ['嵌套行评论'])
assert.equal(dirty.comments, true)

// 噪声节点边界：封面空节点、「余下0条」「下一条动态」「评论区」标题、点赞按钮
// 既不能变成正文，也不能混进评论；整项 marker/cover 节点直接跳过。
const NOISE = ['余下0条', '下一条动态', '评论区', '赞']
for (const moment of moments) {
  for (const marker of NOISE) {
    assert.equal(moment.content.includes(marker), false, `正文混入噪声：${marker}`)
    assert.equal(
      moment.commentTexts.some((text) => text.includes(marker)),
      false,
      `评论混入噪声：${marker}`,
    )
  }
}
assert.equal(uia.isNoiseText('余下0条'), true)
assert.equal(uia.isNoiseText('下一条动态'), true)
assert.equal(uia.isNoiseText('评论区'), true)
assert.equal(uia.classifyChild({ className: 'mmui::TimelineCommentCell' }), 'comment')

// id 稳定：同一帧解析两次 id 一致；12 位十六进制；任一槽位变化 id 随之变化。
const again = uia.parseMoments(frame)
assert.deepEqual(moments.map((m) => m.id), again.map((m) => m.id))
for (const moment of moments) {
  assert.match(moment.id, /^[0-9a-f]{12}$/)
}
const idBase = uia.momentIdOf('张三', '正文', '5分钟前', 3)
assert.equal(idBase, uia.momentIdOf('张三', '正文', '5分钟前', 3))
assert.notEqual(idBase, uia.momentIdOf('张三', '正文改了', '5分钟前', 3))
assert.notEqual(idBase, uia.momentIdOf('李四', '正文', '5分钟前', 3))

// 跨页重复动态按稳定 id 去重。
const duplicated = uia.parseMoments({ items: [frame.items[0], frame.items[0]] })
assert.equal(duplicated.length, 1)

// 字段派生：有评论才 comments=true；media/likes/authorIdentity 恒 false，reason 写明缺失边界。
const fieldsWithComments = uia.deriveUiaMomentFields(['评论内容'])
assert.equal(fieldsWithComments.media, false)
assert.equal(fieldsWithComments.likes, false)
assert.equal(fieldsWithComments.comments, true)
assert.equal(fieldsWithComments.authorIdentity, false)
assert.match(fieldsWithComments.reason, /只有图片数量，没有二进制或链接/)
assert.match(fieldsWithComments.reason, /界面没有点赞控件可读/)
assert.match(fieldsWithComments.reason, /昵称无法映射 wxid/)

const fieldsNoComments = uia.deriveUiaMomentFields([])
assert.equal(fieldsNoComments.comments, false)
assert.match(fieldsNoComments.reason, /评论区未读到条目/)

// 停止语义沿用既有回退推导：满页 page-limit；有页无正文 no-content；其余 no-more-data。
assert.equal(uia.deriveStopReason({ pages: 3, maxPages: 3, momentCount: 5 }), 'page-limit')
assert.equal(uia.deriveStopReason({ pages: 2, maxPages: 3, momentCount: 0 }), 'no-content')
assert.equal(uia.deriveStopReason({ pages: 2, maxPages: 3, momentCount: 5 }), 'no-more-data')
assert.equal(
  uia.deriveStopReason({ frameStopReason: 'occluded', pages: 2, maxPages: 3, momentCount: 5 }),
  'occluded',
)

// 回退失败判定：抛错包成 failed、ok=false、0 条且 stopReason=error 都算失败；正常成功不算。
assert.equal(bridge.isUiaFailure({ status: 'failed', reason: '脚本超时' }), true)
assert.equal(
  bridge.isUiaFailure({ status: 'accepted', data: { moments: [], stopReason: 'error' } }),
  true,
)
assert.equal(bridge.isUiaFailure(null), true)
assert.equal(
  bridge.isUiaFailure({ status: 'accepted', data: { moments: [{ id: 'm1' }] } }),
  false,
)
assert.equal(
  bridge.isUiaFailure({ status: 'accepted', data: { moments: [], stopReason: 'no-more-data' } }),
  false,
)

// FORCE_FAIL=1 时驱动不碰微信，直接返回 failed，供桥走 OCR 回退路径。
process.env.BRIDGE_UIA_FORCE_FAIL = '1'
const forcedDriver = await createDriver()
const forced = await forcedDriver.action('moment.fetch', { maxPages: 3 })
assert.equal(forced.status, 'failed')
assert.equal(forced.stopReason, 'error')
assert.equal(forced.data.forced, true)
delete process.env.BRIDGE_UIA_FORCE_FAIL

console.log(
  '[uia-driver] 图片计数/时间原文/作者解析/评论边界/空正文跳过/脏输入/id 稳定与去重/字段派生/停止语义/回退失败判定/强制失败 10 组通过',
)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
