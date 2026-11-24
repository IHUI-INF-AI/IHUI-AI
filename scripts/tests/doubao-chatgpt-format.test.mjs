// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// 占位：水印头由 scripts/lib/doubao-carry.mjs 逐字节拼接（见落盘步骤）
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildConversationsJson,
  toChatGptConversation,
  toUnixSeconds,
  validateConversationsJson,
} from '../lib/doubao-chatgpt-format.mjs'

test('① 逐条消息映射：用户/助手各一条，不压缩成单条文本', () => {
  const conv = toChatGptConversation({
    name: '续聊测试',
    createTime: 1763900000000,
    updateTime: 1763900060000,
    messages: [
      { role: 'user', content: '第一条', createTime: 1763900000000, index: 1 },
      { role: 'assistant', content: '第二条', createTime: 1763900030000, index: 2 },
      { role: 'user', content: '第三条', createTime: 1763900060000, index: 3 },
    ],
  })
  assert.equal(conv.title, '续聊测试')
  assert.equal(Object.keys(conv.mapping).length, 4) // root + 3 条
  assert.equal(conv.current_node, 'n3')
  assert.deepEqual(conv.mapping.n1.message.author, { role: 'user' })
  assert.deepEqual(conv.mapping.n2.message.author, { role: 'assistant' })
  assert.deepEqual(conv.mapping.n1.message.content.parts, ['第一条'])
  assert.deepEqual(conv.mapping.n2.message.content.parts, ['第二条'])
  assert.deepEqual(conv.mapping.n3.message.content.parts, ['第三条'])
  assert.equal(conv.mapping[''].message, null)
  assert.equal(conv.mapping[''].parent, null)
  assert.deepEqual(conv.mapping[''].children, ['n1'])
  assert.equal(conv.mapping.n1.parent, '')
  assert.equal(conv.mapping.n2.parent, 'n1')
  assert.deepEqual(conv.mapping.n3.children, [])
  assert.equal(conv.create_time, 1763900000)
  assert.equal(conv.update_time, 1763900060)
})

test('② 时间单位兼容：秒原样、毫秒除千、非数归零', () => {
  assert.equal(toUnixSeconds(1763900000), 1763900000)
  assert.equal(toUnixSeconds(1763900000000), 1763900000)
  assert.equal(toUnixSeconds('1763900000'), 1763900000)
  assert.equal(toUnixSeconds(0), 0)
  assert.equal(toUnixSeconds('abc'), 0)
})

test('③ 空消息过滤 + 顺序按 index 还原（不依赖接口返回顺序）', () => {
  const conv = toChatGptConversation({
    messages: [
      { role: 'assistant', content: '后', index: 2, createTime: 20 },
      { role: 'user', content: '', index: 0, createTime: 10 }, // 空 ⇒ 过滤
      { role: 'user', content: '先', index: 1, createTime: 15 },
    ],
  })
  assert.equal(Object.keys(conv.mapping).length, 3) // root + 2 条
  assert.deepEqual(conv.mapping.n1.message.content.parts, ['先'])
  assert.deepEqual(conv.mapping.n2.message.content.parts, ['后'])
  assert.deepEqual(conv.mapping.n1.message.author, { role: 'user' })
})

test('④ 整仓转换：跳过无消息会话，保留有效会话', () => {
  const index = {
    conversations: [
      { conversationId: 'c1', name: '有效' },
      { conversationId: 'c2', name: '空归档' },
    ],
  }
  const bodies = {
    c1: { conversationId: 'c1', name: '有效', messages: [{ role: 'user', content: 'hi', index: 1 }] },
    c2: { conversationId: 'c2', name: '空归档', messages: [] },
  }
  const r = buildConversationsJson(index, (e) => bodies[e.conversationId] ?? null)
  assert.equal(r.conversations.length, 1)
  assert.equal(r.conversations[0].title, '有效')
  assert.deepEqual(r.skipped, [{ conversationId: 'c2', reason: 'no-messages' }])
  assert.deepEqual(validateConversationsJson(r.conversations), { ok: true, count: 1 })
})

test('⑤ 校验器能抓坏结构（非数组/无 mapping/坏 current_node/环）', () => {
  assert.equal(validateConversationsJson('x').code, 'not-array')
  assert.equal(validateConversationsJson([{}]).code, 'no-mapping')
  assert.equal(
    validateConversationsJson([{ mapping: { '': { message: null, parent: null, children: [] } }, current_node: 'missing' }]).code,
    'bad-current-node',
  )
  const cyc = {
    mapping: { a: { parent: 'b', message: {} }, b: { parent: 'a', message: {} } },
    current_node: 'a',
  }
  assert.equal(validateConversationsJson([cyc]).code, 'cycle')
})

test('⑥ 无头命名兜底：会话名为空不产生空标题', () => {
  const conv = toChatGptConversation({ name: '   ', messages: [{ role: 'user', content: 'x', index: 1 }] })
  assert.equal(conv.title, '未命名会话')
})
