// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// OCR 帧去重：同一行每轮识别都会差字，不能因此把旧消息重复入库。
import { strict as assert } from 'node:assert'
import { __test__ } from '../drivers/ocr-readonly.mjs'

const { sameMessage, diffMessageBlocks, parseFrame } = __test__

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

console.log(
  '[ocr-dedupe] OCR 变体去重、追加消息、重复短句、窗口缩放、单栏解析、浏览器页签拒绝、2倍补标题 7 组通过',
)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
