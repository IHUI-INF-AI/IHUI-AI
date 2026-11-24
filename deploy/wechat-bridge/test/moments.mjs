// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 朋友圈 type=0 回调解析：只做真实字段提取，不编造点赞/评论/图片。
import { strict as assert } from 'node:assert'
import { isMomentMessage, parseMomentMessage, mergeMoments, nextMomentCursor } from '../moments.mjs'

const timelineXml = `
<timeline>
  <id>123456789</id>
  <snsId>987654321</snsId>
  <createTime>1760000000</createTime>
  <username>wxid_friend_1</username>
  <nickname><![CDATA[张三]]></nickname>
  <content><![CDATA[今天在长春看到的第一场雪，顺手拍了两张。]]></content>
  <mediaList>
    <media>
      <url><![CDATA[https://mmbiz.qpic.cn/demo-1.jpg]]></url>
    </media>
    <media>
      <url><![CDATA[https://mmbiz.qpic.cn/demo-2.jpg]]></url>
    </media>
  </mediaList>
</timeline>`

const raw = { type: 0, id: '123456789', ts: 1760000000, xml: timelineXml, content: '' }
assert.equal(isMomentMessage(raw), true)
assert.equal(isMomentMessage({ type: 1, content: '普通聊天' }), false)
assert.equal(isMomentMessage({ type: 0, content: '' }), false)

const parsed = parseMomentMessage(raw)
assert.equal(parsed.authorName, '张三')
assert.equal(parsed.authorId, 'wxid_friend_1')
assert.equal(parsed.content, '今天在长春看到的第一场雪，顺手拍了两张。')
assert.equal(parsed.createdAt, 1760000000)
assert.equal(parsed.cursor, 987654321)
assert.deepEqual(parsed.mediaUrls, [
  'https://mmbiz.qpic.cn/demo-1.jpg',
  'https://mmbiz.qpic.cn/demo-2.jpg',
])

// 没有 snsId 时用回调 id；没有作者时保留真实 sender，不编造昵称。
const fallback = parseMomentMessage({
  type: 0,
  id: '42',
  sender: 'wxid_friend_2',
  content: '只有正文',
  xml: '<timeline><content><![CDATA[只有正文]]></content></timeline>',
})
assert.equal(fallback.id, '42')
assert.equal(fallback.authorName, 'wxid_friend_2')
assert.equal(fallback.cursor, 42)

const merged = mergeMoments([parsed], [parsed, fallback])
assert.equal(merged.length, 2)
assert.equal(nextMomentCursor([{ cursor: 9 }, { cursor: 4 }, { cursor: 7 }]), 4)

console.log('[moments] type=0 识别、XML 解析、去重、下一页游标 4 组通过')
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
