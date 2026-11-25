// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 字段可得性派生回归：只认真实动态上出现过的标记，缺失即不可得，不补造点赞/评论/图片。
import assert from 'node:assert/strict'
import { __test__ } from '../server.mjs'

const { deriveMomentFields } = __test__

// 全空：四项都不可得，reason 逐项点出缺失字段。
const empty = deriveMomentFields([])
assert.equal(empty.media, false)
assert.equal(empty.likes, false)
assert.equal(empty.comments, false)
assert.equal(empty.authorIdentity, false)
assert.match(empty.reason ?? '', /图片/)
assert.match(empty.reason ?? '', /点赞/)
assert.match(empty.reason ?? '', /评论/)
assert.match(empty.reason ?? '', /作者身份/)

// 有媒体：任一动态 mediaUrls 非空即 media 可得；点赞/评论/作者身份仍不可得。
const withMedia = deriveMomentFields([
  { id: 'm1', content: '一张图', mediaUrls: ['https://cdn.example.com/a.jpg'], authorResolved: false },
])
assert.equal(withMedia.media, true)
assert.equal(withMedia.likes, false)
assert.equal(withMedia.comments, false)
assert.equal(withMedia.authorIdentity, false)
assert.doesNotMatch(withMedia.reason ?? '', /图片/)
assert.match(withMedia.reason ?? '', /点赞/)
assert.match(withMedia.reason ?? '', /作者身份/)

// 有作者身份：任一 authorResolved === true 即 authorIdentity 可得。
const withAuthor = deriveMomentFields([
  { id: 'm2', content: '已解析联系人', mediaUrls: [], authorResolved: true },
])
assert.equal(withAuthor.authorIdentity, true)
assert.equal(withAuthor.media, false)
assert.match(withAuthor.reason ?? '', /图片/)
assert.doesNotMatch(withAuthor.reason ?? '', /作者身份/)

// 四项齐全：reason 为 null，不再拼缺失说明。
const complete = deriveMomentFields([
  {
    id: 'm3',
    content: '完整一条',
    mediaUrls: ['https://cdn.example.com/b.png'],
    likes: true,
    comments: true,
    authorResolved: true,
  },
])
assert.equal(complete.media, true)
assert.equal(complete.likes, true)
assert.equal(complete.comments, true)
assert.equal(complete.authorIdentity, true)
assert.equal(complete.reason, null)

// 媒体 URL 全为空白串时不算可得；缺失/非数组形态不抛错。
const blankMedia = deriveMomentFields([{ id: 'm4', content: '空白图链', mediaUrls: ['', '   '] }])
assert.equal(blankMedia.media, false)
const malformed = deriveMomentFields(null)
assert.equal(malformed.media, false)
assert.equal(malformed.authorIdentity, false)

console.log('[moment-fields] 全空/有媒体/有作者身份/四项齐全/空白与脏输入 6 组通过')
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
