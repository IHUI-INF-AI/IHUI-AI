// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 朋友圈停止语义回归：30 页实机 fixture 不能退化成失败/1 页；几种停法回退推导各自独立。
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { __test__ } from '../drivers/ocr-readonly.mjs'

const { parseMomentPages, deriveStopReason } = __test__

const FIXTURE = 'C:\\caches\\temp\\bridge-30-result.json'
const fixture = JSON.parse(await readFile(FIXTURE, 'utf8'))
const data = fixture.data

assert.equal(data.pages, 30, 'fixture pages 必须是 30')
assert.equal(data.moments.length, 26, 'fixture moments 必须是 26')
for (const moment of data.moments) {
  assert.ok(typeof moment.id === 'string' && moment.id.length > 0, '每条动态都要有 id')
  assert.ok(
    typeof moment.content === 'string' && moment.content.length > 0,
    '每条动态都要有 content',
  )
}

// 30/30 是抓满上限（page-limit），limitReached=true，不能写成失败。
assert.equal(
  deriveStopReason({ pages: data.pages, maxPages: 30, momentCount: data.moments.length }),
  'page-limit',
)

// 回退推导：抓到页但没有正文 → no-content；没抓满且有正文 → no-more-data。
assert.equal(deriveStopReason({ pages: 2, maxPages: 3, momentCount: 0 }), 'no-content')
assert.equal(deriveStopReason({ pages: 2, maxPages: 3, momentCount: 5 }), 'no-more-data')

// 帧直接给出的合法 stopReason 原样沿用：遮挡 / 滚轮停滞 / 错误。
assert.equal(
  deriveStopReason({ frameStopReason: 'occluded', pages: 2, maxPages: 3, momentCount: 5 }),
  'occluded',
)
assert.equal(
  deriveStopReason({ frameStopReason: 'scroll-stalled', pages: 2, maxPages: 3, momentCount: 5 }),
  'scroll-stalled',
)
assert.equal(
  deriveStopReason({ frameStopReason: 'error', pages: 0, maxPages: 3, momentCount: 0 }),
  'error',
)
// 非法值忽略，走回退推导。
assert.equal(
  deriveStopReason({ frameStopReason: 'bogus', pages: 3, maxPages: 3, momentCount: 26 }),
  'page-limit',
)

// parseMomentPages 自身推导：满页 → page-limit；空正文页 → no-content。
const full = parseMomentPages({ pages: [{ lines: [] }, { lines: [] }, { lines: [] }], maxPages: 3 })
assert.equal(full.stopReason, 'page-limit')
assert.equal(full.limitReached, true)
const empty = parseMomentPages({ pages: [{ lines: [] }], maxPages: 3 })
assert.equal(empty.stopReason, 'no-content')

console.log('[moments-stop-reason] 30 页 fixture 回归、停法回退推导、帧语义沿用 8 组通过')
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
