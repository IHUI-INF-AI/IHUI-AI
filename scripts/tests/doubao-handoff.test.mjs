// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 豆包交接单单测:纯字符串 + 临时目录,零网络、零 cookie。
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  buildHandoffFile,
  pickHandoffConversation,
  renderHandoff,
} from '../lib/doubao-handoff.mjs'

function scratch() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'doubao-handoff-'))
}

test('① 渲染:保留最近 N 条、角色中文化、截断有明示', () => {
  const body = {
    conversationId: 'c1',
    name: '长会话',
    exportedAt: '2026-11-24T00:00:00.000Z',
    messages: Array.from({ length: 8 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `第 ${i + 1} 条 ` + 'x'.repeat(i === 7 ? 500 : 10),
      index: i,
    })),
  }
  const r = renderHandoff({ index: { conversations: [{ file: 'c1.json', name: '长会话' }] }, body, maxMessages: 4, maxMessageChars: 100 })
  assert.equal(r.ok, true)
  assert.equal(r.totalMessages, 8)
  assert.equal(r.messages, 4)
  assert.equal(r.truncated, true)
  assert.match(r.markdown, /第 5 条/)
  assert.match(r.markdown, /\*\*用户\*\*/)
  assert.match(r.markdown, /\*\*助手\*\*/)
  assert.match(r.markdown, /已截断/)
  assert.match(r.markdown, /不是新号的原生历史/)
  assert.match(r.markdown, /不要重新总结/)
})

test('② 渲染:全空消息 ⇒ no-messages,不产出空单', () => {
  const r = renderHandoff({ body: { messages: [{ role: 'user', content: '   ' }] } })
  assert.equal(r.ok, false)
  assert.equal(r.code, 'no-messages')
  assert.equal(r.markdown, '')
})

test('③ 选会话:显式 id 优先;否则取 index 第一条带正文的', () => {
  const index = {
    conversations: [
      { conversationId: 'c1', file: 'c1.json', messages: 2 },
      { conversationId: 'c2', file: 'c2.json', messages: 5 },
      { conversationId: 'c3', file: null, messages: 0 },
    ],
  }
  const explicit = pickHandoffConversation(index, 'c2')
  assert.equal(explicit.ok, true)
  assert.equal(explicit.entry.conversationId, 'c2')
  const latest = pickHandoffConversation(index)
  assert.equal(latest.ok, true)
  assert.equal(latest.entry.conversationId, 'c1')
  assert.equal(pickHandoffConversation(index, 'nope').code, 'conversation-not-found')
  assert.equal(pickHandoffConversation({ conversations: [] }).code, 'no-usable-conversation')
})

test('④ 落盘:index+正文存在 ⇒ 写出 handoff.md;缺会话 ⇒ 不写', () => {
  const dir = scratch()
  try {
    const archive = path.join(dir, 'archive')
    fs.mkdirSync(archive, { recursive: true })
    const index = {
      generatedAt: '2026-11-24T00:00:00.000Z',
      conversations: [{ conversationId: 'c1', name: '会话一', file: 'c1.json', messages: 2 }],
    }
    fs.writeFileSync(path.join(archive, 'index.json'), JSON.stringify(index))
    fs.writeFileSync(
      path.join(archive, 'c1.json'),
      JSON.stringify({
        conversationId: 'c1',
        name: '会话一',
        exportedAt: '2026-11-24T00:00:00.000Z',
        messages: [
          { role: 'user', content: '把报告改成三段' },
          { role: 'assistant', content: '已改好,结论前置。' },
        ],
      }),
    )
    const r = buildHandoffFile({ archiveDir: archive })
    assert.equal(r.ok, true)
    assert.equal(r.file, path.join(archive, 'handoff.md'))
    assert.equal(r.messages, 2)
    const text = fs.readFileSync(r.file, 'utf8')
    assert.match(text, /把报告改成三段/)
    assert.ok(text.includes(`归档目录：${archive}`), '交接单点名归档目录')
    assert.match(text, /归档会话数：1/)
    const missing = buildHandoffFile({ archiveDir: archive, conversationId: 'nope' })
    assert.equal(missing.ok, false)
    assert.equal(missing.code, 'conversation-not-found')
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
