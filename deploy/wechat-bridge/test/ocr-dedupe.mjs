// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// OCR 帧去重：同一行每轮识别都会差字，不能因此把旧消息重复入库。
import { strict as assert } from 'node:assert'
import { __test__ } from '../drivers/ocr-readonly.mjs'

const {
  sameMessage,
  diffMessageBlocks,
  parseFrame,
  splitSenderLabel,
  isGroupTitle,
  stableChatKey,
  parseMomentPages,
} = __test__

assert.equal(sameMessage('KiLink真扌佥收〕文本发送', 'iLink真机验收】文本发送成功'), true)
assert.equal(sameMessage('test.txt', 'test.txt'), true)
assert.equal(sameMessage('今天吃什么', '明天开会'), false)

const previous = [
  { text: 'KiLink真扌佥收〕文本发送', bottom: 240 },
  { text: 'test.txt', bottom: 540 },
]
const sameFrame = [
  { text: 'iLink真机验收】文本发送成功', bottom: 242 },
  { text: 'test.txt', bottom: 541 },
]
assert.deepEqual(diffMessageBlocks(previous, sameFrame, false), [])

const appended = [...sameFrame, { text: '收到，马上处理', bottom: 620 }]
const fresh = diffMessageBlocks(previous, appended, false)
assert.deepEqual(
  fresh.map((item) => item.text),
  ['收到，马上处理'],
)

const repeated = [
  { text: '好的', bottom: 200 },
  { text: '好的', bottom: 260 },
]
assert.deepEqual(
  diffMessageBlocks([{ text: '好的', bottom: 200 }], repeated, false).map((item) => item.text),
  ['好的'],
)

assert.deepEqual(diffMessageBlocks(previous, sameFrame, true), [])

// 单栏聊天：标题在 x≈0.11w，气泡从 x≈0.12w 起；旧解析器从 0.28w 起裁会把整段消息丢掉。
const singleColumn = parseFrame({
  width: 1240,
  height: 1120,
  lines: [
    { text: '微信ClawBot', x: 140, y: 72, w: 122, h: 22 },
    { text: '【iLink真机验收】文本发送成功', x: 156, y: 254, w: 359, h: 22 },
    { text: 'test.txt', x: 152, y: 548, w: 69, h: 14 },
    { text: '收到', x: 579, y: 839, w: 40, h: 19 },
  ],
})
assert.equal(singleColumn.chatTitle, '微信ClawBot')
assert.deepEqual(
  singleColumn.messages.map((item) => item.text),
  ['【iLink真机验收】文本发送成功', 'test.txt', '收到'],
)

// 内置浏览器页签：标题「O×」在右侧 0.6w，网页正文不能被当成会话消息。
const browserPane = parseFrame({
  width: 1240,
  height: 1120,
  lines: [
    { text: 'O×', x: 1012, y: 71, w: 61, h: 26 },
    { text: '服务通知入口怎么设置', x: 751, y: 77, w: 162, h: 17 },
    { text: '微信「服务通知」在哪里打开（2026）', x: 743, y: 390, w: 407, h: 28 },
  ],
})
assert.equal(browserPane.chatTitle, null)

// 宽窗列表+聊天：正常 OCR 漏掉深色标题，2 倍行补标题；列表行不能被当成消息。
const wideWithScaledHeader = parseFrame({
  width: 1240,
  height: 1120,
  lines: [
    { text: 'Grok', x: 664, y: 128, w: 208, h: 73 },
    { text: 'fGClawBot\n那就去做啊', x: 188, y: 144, w: 124, h: 20 },
    { text: 'test.txt', x: 520, y: 302, w: 69, h: 14 },
  ],
  linesScaled: [
    { text: '微信ClawBot', x: 496, y: 72, w: 122, h: 22 },
    { text: 'test.txt', x: 520, y: 302, w: 69, h: 14 },
  ],
})
assert.equal(wideWithScaledHeader.chatTitle, '微信ClawBot')
assert.deepEqual(
  wideWithScaledHeader.messages.map((item) => item.text),
  ['test.txt'],
)

// 群聊：气泡上方多一行小字号昵称。昵称必须从正文剥离，并给不同成员不同 sender。
const groupFrame = parseFrame({
  width: 1240,
  height: 1120,
  lines: [
    { text: '项目群 (23)', x: 140, y: 72, w: 150, h: 22 },
    { text: '张三', x: 156, y: 250, w: 40, h: 12, contrast: 52 },
    { text: '明天十点开会', x: 156, y: 270, w: 150, h: 20, contrast: 118 },
    { text: '李四', x: 156, y: 360, w: 40, h: 12, contrast: 48 },
    { text: '收到', x: 156, y: 380, w: 60, h: 20, contrast: 120 },
  ],
})
assert.equal(groupFrame.isGroup, true)
assert.equal(groupFrame.chatTitle, '项目群 (23)')
assert.deepEqual(
  groupFrame.messages.map((item) => ({ text: item.text, senderName: item.senderName })),
  [
    { text: '明天十点开会', senderName: '张三' },
    { text: '收到', senderName: '李四' },
  ],
)

// 正常 OCR 漏掉浅色群昵称时，2 倍放大的 linesScaled 只用来补发送人。
const scaledSenderFrame = parseFrame({
  width: 1240,
  height: 1120,
  lines: [
    { text: '项目群 (23)', x: 140, y: 72, w: 150, h: 22 },
    { text: '明天十点开会', x: 156, y: 270, w: 150, h: 20 },
  ],
  linesScaled: [
    { text: '项目群 (23)', x: 140, y: 72, w: 150, h: 22 },
    { text: '张三', x: 156, y: 244, w: 40, h: 17, contrast: 52 },
    { text: '明天十点开会', x: 156, y: 270, w: 150, h: 20, contrast: 118 },
  ],
})
assert.equal(scaledSenderFrame.isGroup, true)
assert.deepEqual(
  scaledSenderFrame.messages.map((item) => ({ text: item.text, senderName: item.senderName })),
  [{ text: '明天十点开会', senderName: '张三' }],
)

// 私聊多行正文：字号相同、对比度相同，不能把第一行当发送人。
const privateMultiline = parseFrame({
  width: 1240,
  height: 1120,
  lines: [
    { text: '微信ClawBot', x: 140, y: 72, w: 122, h: 22 },
    { text: '你好', x: 156, y: 250, w: 40, h: 20, contrast: 120 },
    { text: '在吗', x: 156, y: 275, w: 40, h: 20, contrast: 120 },
  ],
})
assert.equal(privateMultiline.isGroup, false)
assert.deepEqual(
  privateMultiline.messages.map((item) => item.text),
  ['你好\n在吗'],
)

// 字号相同但昵称明显更浅时，仍能靠 contrast 拆出来（深色/浅色主题都成立）。
const contrastOnly = parseFrame({
  width: 1240,
  height: 1120,
  lines: [
    { text: '客户群', x: 140, y: 72, w: 100, h: 22 },
    { text: '王五', x: 156, y: 250, w: 40, h: 20, contrast: 45 },
    { text: '方案已发', x: 156, y: 272, w: 100, h: 20, contrast: 125 },
  ],
})
assert.equal(contrastOnly.isGroup, true)
assert.equal(contrastOnly.messages[0].senderName, '王五')

assert.equal(isGroupTitle('项目群 (23)'), true)
assert.equal(isGroupTitle('吃喝玩乐特价票（452）@v'), true)
assert.equal(isGroupTitle('年度总结(2026)'), false)
assert.equal(isGroupTitle('普通私聊'), false)
assert.equal(stableChatKey('项目群 (23)'), '项目群')
assert.equal(stableChatKey('项目群 (24)'), '项目群')
assert.equal(stableChatKey('吃喝玩乐特价票（452）@v'), '吃喝玩乐特价票')
assert.equal(stableChatKey('普通私聊'), '普通私聊')
assert.equal(
  splitSenderLabel(
    {
      lines: [
        { text: '张三：', x: 156, y: 250, w: 50, h: 12, contrast: 50 },
        { text: '带标点的不是昵称', x: 156, y: 270, w: 150, h: 20, contrast: 120 },
      ],
    },
    1240,
  ),
  null,
)

// 朋友圈 OCR：按动态留白切块，过滤时间/互动文案；同一页重复出现只保留一条。
const momentPage = {
  page: 1,
  width: 1240,
  height: 1120,
  lines: [
    { text: '朋友圈', x: 610, y: 28, w: 80, h: 22 },
    { text: '张三', x: 200, y: 100, w: 40, h: 18 },
    { text: '今天下雪了', x: 200, y: 125, w: 120, h: 20 },
    { text: '2小时前', x: 200, y: 155, w: 60, h: 14 },
    { text: '李四', x: 200, y: 230, w: 40, h: 18 },
    { text: '周末聚餐', x: 200, y: 255, w: 100, h: 20 },
    { text: '赞', x: 1050, y: 290, w: 30, h: 14 },
  ],
}
const parsedMoments = parseMomentPages({
  pages: [momentPage, momentPage],
  maxPages: 3,
})
assert.equal(parsedMoments.moments.length, 2)
assert.deepEqual(
  parsedMoments.moments.map((item) => ({ authorName: item.authorName, content: item.content })),
  [
    { authorName: '张三', content: '今天下雪了' },
    { authorName: '李四', content: '周末聚餐' },
  ],
)

// 微信 4.2 朋友圈是主窗内嵌页：左栏「发现/视频号/小程序」和顶部封面文字不能当成动态，
// 只有右侧多行正文块才算；这一页来自真实 OCR 坐标缩放。
const embeddedMomentPage = {
  page: 1,
  width: 1687,
  height: 1120,
  lines: [
    { text: '发现', x: 145, y: 87, w: 49, h: 25 },
    { text: '朋友圈', x: 194, y: 171, w: 73, h: 25 },
    { text: '视频号', x: 194, y: 255, w: 74, h: 25 },
    { text: '小程序', x: 194, y: 507, w: 74, h: 25 },
    { text: '人生规划', x: 738, y: 85, w: 243, h: 46 },
    { text: '职业转型', x: 737, y: 135, w: 178, h: 47 },
    { text: 'AI智汇教育｜创始人｜李总', x: 1164, y: 550, w: 313, h: 31 },
    { text: '益田创客~富贵竹', x: 676, y: 678, w: 195, h: 24 },
    { text: '益田物业创客大厦物业服务中心2026年11月24日工作日报', x: 675, y: 719, w: 630, h: 25 },
    { text: '1.工程维修', x: 677, y: 753, w: 117, h: 25 },
    { text: '公共区域电路维护，', x: 675, y: 786, w: 204, h: 25 },
    { text: '接当日报修并及时处理。', x: 675, y: 819, w: 253, h: 25 },
    { text: '开店', x: 589, y: 548, w: 30, h: 14 },
    { text: '11分钅中前', x: 578, y: 887, w: 73, h: 17 },
    { text: '55分钅牛苣《MangaMlS', x: 380, y: 950, w: 117, h: 13 },
    { text: '缸到一', x: 896, y: 944, w: 544, h: 176 },
  ],
}
const embeddedMoments = parseMomentPages({
  pages: [embeddedMomentPage],
  maxPages: 1,
  embedded: true,
})
assert.equal(embeddedMoments.embedded, true)
assert.equal(embeddedMoments.moments.length, 1)
assert.equal(embeddedMoments.moments[0].content.includes('益田物业'), true)

// 真实深层翻页会遇到作者名粘手机号、时间 OCR 变体、广告卡片浏览器 UI；
// 这些都不能变成动态，但单行真实短动态和普通广告正文必须保留。
const deepMomentPage = {
  page: 4,
  width: 953,
  height: 635,
  lines: [
    { text: '发现', x: 84, y: 51, w: 28, h: 12 },
    { text: '朋友圈', x: 112, y: 99, w: 42, h: 13 },
    { text: 'A芒果冫卜云力产啊升13082494914', x: 380, y: 302, w: 198, h: 12 },
    {
      text: '回层一楼。独辽化。风景优姜。送面积大。公摊/」、性价比超高',
      x: 381,
      y: 325,
      w: 419,
      h: 14,
    },
    { text: '1刁《前MangaMlS', x: 381, y: 426, w: 110, h: 13 },
    { text: '下g条>', x: 392, y: 478, w: 41, h: 12 },
    { text: '11．24', x: 520, y: 403, w: 44, h: 15 },
    { text: '1小盯前', x: 381, y: 443, w: 42, h: 11 },
    { text: '多拍照0多记录自己', x: 380, y: 579, w: 136, h: 13 },
    { text: '1小盯前频号。孟健隔裎', x: 381, y: 356, w: 153, h: 11 },
    { text: '初高中英语一小时150一300', x: 380, y: 516, w: 167, h: 13 },
    { text: '1988', x: 381, y: 541, w: 32, h: 11 },
    { text: '其很多人在泪求飕站的设计。你去看看市场就知道了', x: 384, y: 429, w: 335, h: 13 },
    { text: '首页', x: 440, y: 569, w: 40, h: 19 },
    { text: '无谩计', x: 503, y: 570, w: 60, h: 17 },
    { text: '一年狂揽灬。访问', x: 410, y: 595, w: 183, h: 20 },
    { text: 'b00引VOlume—35+', x: 501, y: 476, w: 102, h: 9 },
    { text: 'enyinyourbrowSe', x: 494, y: 494, w: 113, h: 10 },
    { text: 'Your渊', x: 560, y: 510, w: 34, h: 9 },
  ],
}
const deepMoments = parseMomentPages({ pages: [deepMomentPage], maxPages: 10, embedded: true })
assert.deepEqual(
  deepMoments.moments.map((item) => ({ authorName: item.authorName, content: item.content })),
  [
    {
      authorName: 'A芒果冫卜云力产啊升',
      content: '回层一楼。独辽化。风景优姜。送面积大。公摊/」、性价比超高',
    },
    { authorName: '朋友圈好友', content: '其很多人在泪求飕站的设计。你去看看市场就知道了' },
    { authorName: '朋友圈好友', content: '初高中英语一小时150一300\n1988' },
    { authorName: '朋友圈好友', content: '多拍照0多记录自己' },
  ],
)

// 滚动边界会把同一动态拆成「标题一行」和「完整正文」两页；首行模糊相同必须合并。
const splitTitlePages = [
  {
    page: 1,
    width: 953,
    height: 635,
    lines: [
      { text: '〔俗人六哥〕Ai企业获客盈利糸统', x: 380, y: 200, w: 260, h: 18 },
      { text: '最慪的不是你不字。而是比你优秀的丿下在亻蒯的补误！', x: 380, y: 230, w: 340, h: 13 },
    ],
  },
  {
    page: 2,
    width: 953,
    height: 635,
    lines: [{ text: '〔俗人六哥]Ai企业获客盈利系统', x: 380, y: 500, w: 240, h: 18 }],
  },
]
const splitTitleMoments = parseMomentPages({
  pages: splitTitlePages,
  maxPages: 20,
  embedded: true,
})
assert.equal(splitTitleMoments.moments.length, 1)
assert.equal(splitTitleMoments.moments[0].content.includes('最慪的不是你不字'), true)

console.log(
  '[ocr-dedupe] OCR 变体去重、追加消息、重复短句、窗口缩放、单栏解析、浏览器页签拒绝、2倍补标题、群昵称拆分、2倍补群昵称、私聊多行不误拆、contrast 兜底、朋友圈切块、内嵌朋友圈过滤、深层朋友圈噪声、标题全文合并 15 组通过',
)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
