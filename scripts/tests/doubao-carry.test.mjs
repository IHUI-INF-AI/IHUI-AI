// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { createRequire } from 'node:module'
import {
  exportArchive,
  getThread,
  listConversations,
  readArchiveIndex,
  readDoubaoCookie,
} from '../lib/doubao-carry.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const require = createRequire(import.meta.url)

const COOKIE = 'sessionid=abc123; sid_tt=def456'

/** 可注入 fetch 的 mock:按 pathname 派发,记下每次调用的 url/body/headers */
function mockFetch(routes) {
  const calls = []
  const impl = async (url, init = {}) => {
    const u = new URL(String(url))
    const body = init.body ? JSON.parse(init.body) : null
    calls.push({ url: u, pathname: u.pathname, method: init.method ?? 'GET', body, headers: init.headers ?? {} })
    const handler = routes[u.pathname]
    if (!handler) throw new Error(`未 mock 的端点: ${u.pathname}`)
    const payload = typeof handler === 'function' ? handler({ url: u, body, init }) : handler
    return {
      ok: true,
      status: 200,
      json: async () => payload,
      text: async () => JSON.stringify(payload),
    }
  }
  impl.calls = calls
  return impl
}

/** conversation/list 单页响应(2026-11-11 真票实证:thread/list 恒空,真数据在 conversation/list,
 *  响应 data 顶层 {thread_list,has_more,next_index},与旧 thread/list 同构) */
function threadPage(ids, { hasMore = false, nextIndex } = {}) {
  return {
    code: 0,
    data: {
      thread_list: ids.map((id, i) => ({
        conversation: {
          conversation_id: id,
          name: `会话-${id}`,
          conversation_type: 3,
          create_time: 1700000000 + i,
          update_time: 1700000100 + i,
        },
        thread_id_str: `t-${id}`,
        thread_source: 0,
      })),
      has_more: hasMore,
      next_index: nextIndex,
    },
  }
}

function threadGetPayload(messages) {
  return { code: 0, data: { messages, has_more: false } }
}

const msg = (id, over = {}) => ({
  message_id: id,
  sender_id: over.user_type === 2 ? 'bot' : '10001',
  user_type: 1,
  content_type: 1,
  content: `正文-${id}`,
  create_time: 1700000000,
  index_in_conv: 0,
  status: 0,
  ...over,
})

test('① 正常翻页:3 页 → 会话数正确,maxPages 生效', async () => {
  const pages = {
    0: threadPage(['c1'], { hasMore: true, nextIndex: 1 }),
    1: threadPage(['c2'], { hasMore: true, nextIndex: 2 }),
    2: threadPage(['c3'], { hasMore: false }),
  }
  const fetchImpl = mockFetch({
    '/samantha/conversation/list': ({ body }) => pages[body.index],
  })
  const r = await listConversations({ cookieHeader: COOKIE, fetchImpl })
  assert.equal(r.code, 'ok')
  assert.equal(r.pages, 3)
  assert.equal(r.total, 3)
  assert.deepEqual(
    r.conversations.map((c) => c.conversationId),
    ['c1', 'c2', 'c3'],
  )
  assert.equal(r.conversations[0].name, '会话-c1')
  assert.equal(r.conversations[0].threadId, 't-c1')
  // 公共参数进 query、Agw-Js-Conv 进 header、cookie 进 header
  const first = fetchImpl.calls[0]
  assert.equal(first.url.searchParams.get('samantha_web'), '1')
  assert.equal(first.headers['Agw-Js-Conv'], 'str')
  assert.equal(first.headers.Cookie, COOKIE)
  assert.deepEqual(first.body, { index: 0, batch_size: 20 })

  // maxPages 硬上限:同样的 3 页,上限 2 ⇒ 只翻 2 页
  const limited = await listConversations({ cookieHeader: COOKIE, fetchImpl, maxPages: 2 })
  assert.equal(limited.pages, 2)
  assert.equal(limited.total, 2)
})

test('② cookie 过期(code:710012001)⇒ 明确报错,不返回空数组冒绿', async () => {
  const fetchImpl = mockFetch({
    '/samantha/conversation/list': {
      code: 710012001,
      msg: '登录已过期，请重新登录',
      message: 'login invalid',
    },
  })
  const r = await listConversations({ cookieHeader: COOKIE, fetchImpl })
  assert.equal(r.code, 'cookie-expired')
  assert.notEqual(r.code, 'ok')
  assert.equal(r.conversations.length, 0)
  assert.match(r.message, /登录已过期/)
})

test('②b 无 cookie ⇒ code=cookie-missing(不发请求)', async () => {
  const fetchImpl = mockFetch({})
  const r = await listConversations({ fetchImpl })
  assert.equal(r.code, 'cookie-missing')
  assert.equal(fetchImpl.calls.length, 0)
})

test('③ has_more 恒 true 且 index 不前进 ⇒ 防死循环生效(只翻 1 页)', async () => {
  let calls = 0
  const fetchImpl = mockFetch({
    '/samantha/conversation/list': () => {
      calls += 1
      return threadPage([`c${calls}`], { hasMore: true, nextIndex: 0 }) // 游标永远 0
    },
  })
  const r = await listConversations({ cookieHeader: COOKIE, fetchImpl, maxPages: 50 })
  assert.equal(r.code, 'ok')
  assert.equal(r.pages, 1)
  assert.equal(calls, 1)
  assert.equal(r.total, 1)
})

test('③b has_more 恒 true 但 next_index 缺失 ⇒ 同样只翻 1 页', async () => {
  const fetchImpl = mockFetch({
    '/samantha/conversation/list': () => threadPage(['c1'], { hasMore: true }),
  })
  const r = await listConversations({ cookieHeader: COOKIE, fetchImpl, maxPages: 50 })
  assert.equal(r.pages, 1)
})

test('③c 新版 threadFeed 形状(has_more/next_cursor/thread_list 收在 data.threads)同样能翻', async () => {
  const fetchImpl = mockFetch({
    '/samantha/conversation/list': ({ body }) => ({
      code: 0,
      data: {
        threads: {
          thread_list: [{ conversation: { conversation_id: `n${body.index}`, name: '新' } }],
          has_more: body.index < 1,
          next_cursor: body.index + 1,
        },
      },
    }),
  })
  const r = await listConversations({ cookieHeader: COOKIE, fetchImpl })
  assert.equal(r.code, 'ok')
  assert.equal(r.pages, 2)
  assert.deepEqual(
    r.conversations.map((c) => c.conversationId),
    ['n0', 'n1'],
  )
})

test('④ getThread:按真实字段名(sender_id/user_type/content/content_type/create_time/index_in_conv)解析', async () => {
  const fetchImpl = mockFetch({
    '/samantha/thread/get': threadGetPayload([
      msg('m1', { index_in_conv: 0, create_time: 1700000001 }),
      msg('m2', { user_type: 2, index_in_conv: 1, create_time: 1700000002 }),
      msg('m3', { user_type: 3, index_in_conv: 2, content: '系统提示' }),
    ]),
  })
  const r = await getThread({ cookieHeader: COOKIE, conversationId: 'c1', fetchImpl })
  assert.equal(r.code, 'ok')
  assert.equal(r.source, 'thread/get')
  assert.deepEqual(
    r.messages.map((m) => [m.messageId, m.role, m.content, m.index]),
    [
      ['m1', 'user', '正文-m1', 0],
      ['m2', 'assistant', '正文-m2', 1],
      ['m3', 'system', '系统提示', 2],
    ],
  )
  const call = fetchImpl.calls[0]
  assert.equal(call.method, 'GET')
  assert.equal(call.url.pathname, '/samantha/thread/get')
  assert.equal(call.url.searchParams.get('collection_id'), 'c1')
  assert.equal(call.headers.Cookie, COOKIE)
})

test('④b thread/get 无消息 ⇒ 退 IM 网关 /im/chain/single(请求体逐字对齐客户端)', async () => {
  const fetchImpl = mockFetch({
    '/samantha/thread/get': { code: 0, data: {} },
    '/im/chain/single': {
      status_code: 0,
      status_desc: '',
      downlink_body: {
        pull_singe_chain_downlink_body: {
          messages: [msg('m9', { user_type: 2, index_in_conv: 3, content: '网关正文' })],
          has_more: false,
        },
      },
    },
  })
  const r = await getThread({ cookieHeader: COOKIE, conversationId: 'c9', fetchImpl })
  assert.equal(r.code, 'ok')
  assert.equal(r.source, 'im/chain')
  assert.equal(r.messages.length, 1)
  assert.equal(r.messages[0].role, 'assistant')
  assert.equal(r.messages[0].content, '网关正文')

  const im = fetchImpl.calls.find((c) => c.pathname === '/im/chain/single')
  assert.equal(im.method, 'POST')
  assert.equal(im.body.cmd, 3100)
  assert.equal(im.body.channel, 2)
  const up = im.body.uplink_body.pull_singe_chain_uplink_body
  assert.equal(up.conversation_id, 'c9')
  assert.equal(up.conversation_type, 3)
  assert.equal(up.direction, 1)
  // 2026-11-11 客户端真实抓包:anchor 从 MAX_SAFE_INTEGER 起步(direction=1 OLDER),
  // filter 不带 bot_id,必带 option.lazy_load_strategy=0 —— 三者任一偏差即 712017020 序列化错误
  assert.equal(up.anchor_index, 9007199254740991)
  assert.deepEqual(up.filter, { index_list: [] })
  assert.deepEqual(up.option, { lazy_load_strategy: 0 })
})

test('④b-2 thread/get 报错(710010702)⇒ 不短路,落 IM 网关照常拿到消息', async () => {
  const fetchImpl = mockFetch({
    '/samantha/thread/get': { code: 710010702, msg: '系统错误', error: { code: 710010702, message: '系统错误' } },
    '/im/chain/single': {
      status_code: 0,
      downlink_body: {
        pull_singe_chain_downlink_body: {
          messages: [
            { message_id: 'm1', sender_id: 'u1', user_type: 1, content_type: 1, content: '{"text":"1+1等于几"}', index_in_conv: '1', create_time: '1794319000', status: 0 },
            { message_id: 'm2', sender_id: 'bot', user_type: 2, content_type: 1, content: '[{"block_type":10000,"block_id":"b1","content":{"text_block":{"text":"1+1=2"}}},{"block_type":10101,"content":{}}]', index_in_conv: '2', create_time: '1794319064', status: 0 },
          ],
          has_more: false,
        },
      },
    },
  })
  const r = await getThread({ cookieHeader: COOKIE, conversationId: 'c7', fetchImpl })
  assert.equal(r.code, 'ok')
  assert.equal(r.source, 'im/chain')
  assert.equal(r.messages.length, 2)
  // content 是 JSON 字符串 ⇒ 归一化抽 text
  assert.equal(r.messages[0].content, '1+1等于几')
  assert.equal(r.messages[0].role, 'user')
  assert.equal(r.messages[1].content, '1+1=2')
  assert.equal(r.messages[1].role, 'assistant')
  assert.match(r.warning ?? '', /thread\/get 不可用/)
})

test('④b-3 thread/get 与 IM 网关双腿全断 ⇒ 报错不冒绿,登录过期优先', async () => {
  const fetchImpl = mockFetch({
    '/samantha/thread/get': { code: 710010702, msg: '系统错误' },
    '/im/chain/single': { status_code: 710012001, status_desc: '登录已过期，请重新登录' },
  })
  const r = await getThread({ cookieHeader: COOKIE, conversationId: 'c8', fetchImpl })
  assert.equal(r.code, 'cookie-expired')
  assert.equal(r.messages.length, 0)
  assert.match(r.message, /thread\/get/)
  assert.match(r.message, /im\/chain/)
})

test('④c getThread 拿不到消息且网关报登录过期 ⇒ 明确带 code,不静默', async () => {
  const fetchImpl = mockFetch({
    '/samantha/thread/get': { code: 0, data: {} },
    '/im/chain/single': { status_code: 710012001, status_desc: '登录已过期' },
  })
  const r = await getThread({ cookieHeader: COOKIE, conversationId: 'c1', fetchImpl })
  assert.equal(r.code, 'ok')
  assert.equal(r.messages.length, 0)
  assert.match(r.warning, /cookie-expired/)
})

test('⑤ exportArchive:每个会话一个 json + index.json,totalMessages = 各会话之和', async () => {
  const dir = mkScratch('doubao-export-')
  try {
    const fetchImpl = mockFetch({
      '/samantha/conversation/list': ({ body }) =>
        body.index === 0
          ? threadPage(['c1', 'c2'], { hasMore: false })
          : threadPage([], { hasMore: false }),
      '/samantha/thread/get': ({ url }) => {
        const id = url.searchParams.get('collection_id')
        return id === 'c1'
          ? threadGetPayload([msg('a1', { index_in_conv: 0 }), msg('a2', { user_type: 2, index_in_conv: 1 })])
          : threadGetPayload([msg('b1', { index_in_conv: 0 }), msg('b2', { user_type: 2, index_in_conv: 1 }), msg('b3', { index_in_conv: 2 })])
      },
    })
    const r = await exportArchive({ cookieHeader: COOKIE, outDir: dir, fetchImpl })
    assert.equal(r.code, 'ok')
    assert.equal(r.exported, 2)
    assert.equal(r.failed, 0)
    assert.equal(r.totalMessages, 5)

    const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'))
    assert.equal(index.count, 2)
    assert.equal(index.totalMessages, 5)
    assert.equal(index.conversations.length, 2)
    const sum = index.conversations.reduce((n, c) => n + c.messages, 0)
    assert.equal(sum, 5)
    for (const c of index.conversations) {
      assert.ok(fs.existsSync(path.join(dir, c.file)))
      const body = JSON.parse(fs.readFileSync(path.join(dir, c.file), 'utf8'))
      assert.equal(body.conversationId, c.conversationId)
      assert.equal(body.messages.length, c.messages)
    }
  } finally {
    rmScratch(dir)
  }
})

test('⑥ readArchiveIndex 能读回(含归档缺失/坏档两态)', () => {
  const dir = mkScratch('doubao-index-')
  try {
    assert.equal(readArchiveIndex(dir).code, 'archive-missing')
    fs.writeFileSync(
      path.join(dir, 'index.json'),
      JSON.stringify({ generatedAt: 'x', count: 1, totalMessages: 2, conversations: [{ conversationId: 'c1', messages: 2, file: 'a.json' }] }),
      'utf8',
    )
    const idx = readArchiveIndex(dir)
    assert.equal(idx.code, 'ok')
    assert.equal(idx.count, 1)
    assert.equal(idx.totalMessages, 2)
    assert.equal(idx.conversations[0].conversationId, 'c1')
    assert.equal(readArchiveIndex('').code, 'bad-arg')
  } finally {
    rmScratch(dir)
  }
})

test('⑦ cookie 文件不存在 ⇒ code=cookie-missing', async () => {
  const dir = mkScratch('doubao-cookie-')
  try {
    const r = await readDoubaoCookie({ profileDir: path.join(dir, 'Default') })
    assert.equal(r.code, 'cookie-missing')
    assert.equal(r.cookieHeader, null)
    assert.equal(r.count, 0)
  } finally {
    rmScratch(dir)
  }
})

/** 造一个最小 Cookies 库(只建本模块读的那几列) */
function makeCookiesDb(profileDir, rows) {
  const { DatabaseSync } = require('node:sqlite')
  fs.mkdirSync(path.join(profileDir, 'Network'), { recursive: true })
  const db = new DatabaseSync(path.join(profileDir, 'Network', 'Cookies'))
  db.exec(
    'CREATE TABLE cookies (host_key TEXT, name TEXT, value TEXT, encrypted_value BLOB, creation_utc INTEGER)',
  )
  const ins = db.prepare(
    'INSERT INTO cookies (host_key, name, value, encrypted_value, creation_utc) VALUES (?, ?, ?, ?, ?)',
  )
  rows.forEach((r, i) => ins.run(r.host, r.name, r.value ?? '', r.blob ?? null, i))
  db.close()
}

test('⑦b 明文 value 直接取,cookieHeader 拼装正确(同域外的不带)', async () => {
  const dir = mkScratch('doubao-cookie-plain-')
  try {
    const profile = path.join(dir, 'Default')
    makeCookiesDb(profile, [
      { host: '.doubao.com', name: 'sessionid', value: 'abc' },
      { host: '.doubao.com', name: 'sid_tt', value: 'def' },
      { host: '.example.com', name: 'other', value: 'nope' },
    ])
    const r = await readDoubaoCookie({ profileDir: profile })
    assert.equal(r.code, 'ok')
    assert.equal(r.count, 2)
    assert.equal(r.cookieHeader, 'sessionid=abc; sid_tt=def')
  } finally {
    rmScratch(dir)
  }
})

test('⑦c v20(app-bound)⇒ code=cookie-app-bound,不静默 NULL', async () => {
  const dir = mkScratch('doubao-cookie-v20-')
  try {
    const profile = path.join(dir, 'Default')
    const blob = Buffer.concat([Buffer.from('v20', 'ascii'), Buffer.alloc(40, 7)])
    makeCookiesDb(profile, [{ host: '.doubao.com', name: 'sessionid', value: '', blob }])
    const r = await readDoubaoCookie({ profileDir: profile })
    assert.equal(r.code, 'cookie-app-bound')
    assert.equal(r.cookieHeader, null)
    assert.equal(r.count, 0)
    assert.match(r.message, /app-bound/)
  } finally {
    rmScratch(dir)
  }
})

// =============================================================================
// ⑧ 回放腿(--replay:旧对话 → 新号新会话,2026-11-10)
// =============================================================================
import {
  buildReplayText,
  pickNewConversationId,
  replayArchive,
  replayConversation,
  replayFingerprint,
} from '../lib/doubao-carry.mjs'

const SSE_OK = 'data: {"event_data":{"conversation":{"conversation_id":"7421112222333"},"section_id":"s1"}}\n\ndata: {"event_data":{"message":{"content":"收到"}}}\n\n'

/** 一个真实形状的归档目录(index.json + 两个会话 json) */
function makeArchive(dir) {
  const c1 = { conversationId: '111', name: '需求讨论', createTime: 1700000000, messages: [
    { messageId: 'm1', role: 'user', content: '帮我设计登录页' },
    { messageId: 'm2', role: 'assistant', content: '好的,方案如下…' },
  ] }
  const c2 = { conversationId: '222', name: '排期', createTime: 1700000100, messages: [
    { messageId: 'm3', role: 'user', content: '周三上线' },
  ] }
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'conv-0-111.json'), `${JSON.stringify(c1, null, 2)}\n`)
  fs.writeFileSync(path.join(dir, 'conv-1-222.json'), `${JSON.stringify(c2, null, 2)}\n`)
  fs.writeFileSync(path.join(dir, 'index.json'), `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    count: 2,
    totalMessages: 3,
    conversations: [
      { conversationId: '111', name: '需求讨论', file: 'conv-0-111.json', messages: 2 },
      { conversationId: '222', name: '排期', file: 'conv-1-222.json', messages: 1 },
    ],
  }, null, 2)}\n`)
  return { c1, c2 }
}

test('⑧a buildReplayText:只收 user/assistant 非空消息,带头尾标', () => {
  const t = buildReplayText({ name: '需求讨论' }, [
    { role: 'user', content: '帮我设计登录页' },
    { role: 'system', content: 'should-skip' },
    { role: 'assistant', content: '' },
    { role: 'assistant', content: '好的,方案如下…' },
  ])
  assert.match(t, /【对话迁移】/)
  assert.match(t, /会话名:需求讨论/)
  assert.match(t, /用户:帮我设计登录页/)
  assert.match(t, /AI:好的,方案如下…/)
  assert.ok(!t.includes('should-skip'))
  assert.match(t, /--- 原始对话结束 ---/)
})

test('⑧a-2 buildReplayText:图片/语音消息(ct=20/101 JSON)替换为占位标记', () => {
  const img = JSON.stringify({ entities: [{ entity_type: 2, entity_content: { image: { key: 'k' } } }, { entity_type: 2, entity_content: { image: { key: 'k2' } } }] })
  const audio = JSON.stringify({ record_id: '1', status: 5 })
  const t = buildReplayText({ name: '含图会话' }, [
    { role: 'user', content: img },
    { role: 'assistant', content: audio },
    { role: 'user', content: '看这张图' },
  ])
  assert.match(t, /用户:\[发送了图片、图片\]/)
  assert.match(t, /AI:\[语音转写\]/)
  assert.match(t, /用户:看这张图/)
  assert.ok(!t.includes('entity_content'))
})

test('⑧a-3 buildReplayText:超大会话安全阀截断,总长不超上限且头尾保留', () => {
  const big = Array.from({ length: 4000 }, (_, i) => ({
    role: i % 2 ? 'assistant' : 'user',
    content: `第${i}条消息内容 padding-${'-'.repeat(80)}`,
  }))
  const t = buildReplayText({ name: '大会话' }, big)
  assert.ok(t.length <= 200_000 + 200, `len=${t.length}`)
  assert.match(t, /【\.\.\.中间省略 \d+ 条消息,完整记录见原归档\.\.\.】/)
  assert.match(t, /第0条消息内容/) // 头部保留
  assert.match(t, /第3999条消息内容/) // 尾部保留
})

test('⑧b replayFingerprint:同会话稳定,消息/时间变化即换指纹', () => {
  const conv = { conversationId: '111', createTime: 1 }
  const a = replayFingerprint(conv, [{ messageId: 'x' }, { messageId: 'y' }])
  assert.equal(a, replayFingerprint(conv, [{ messageId: 'x' }, { messageId: 'y' }]))
  assert.notEqual(a, replayFingerprint(conv, [{ messageId: 'x' }]))
  assert.notEqual(a, replayFingerprint({ ...conv, createTime: 2 }, [{ messageId: 'x' }, { messageId: 'y' }]))
})

test('⑧c pickNewConversationId:字符串/数字两种 SSE 形状都认', () => {
  assert.equal(pickNewConversationId(SSE_OK), '7421112222333')
  assert.equal(pickNewConversationId('data: {"conversation_id": 7421112222333}'), '7421112222333')
  assert.equal(pickNewConversationId('data: {}'), '')
})

test('⑧d replayConversation:POST /chat/completion content_block 信封,抽回新会话 id', async () => {
  const calls = []
  const impl = (url, init) => {
    const u = new URL(String(url))
    const body = init.body ? JSON.parse(init.body) : null
    calls.push({ pathname: u.pathname, search: u.searchParams, body, headers: init.headers })
    return Promise.resolve({ ok: true, status: 200, text: async () => SSE_OK, json: async () => ({}) })
  }
  const r = await replayConversation({
    cookieHeader: COOKIE,
    conv: { name: '需求讨论' },
    messages: [{ role: 'user', content: '帮我设计登录页' }],
    fetchImpl: impl,
  })
  assert.equal(r.code, 'ok', `code=${r.code} message=${r.message ?? ''}`)
  assert.equal(r.newConversationId, '7421112222333')
  assert.equal(calls.length, 1)
  // 2026-11-11 真机实证:路径 /chat/completion(单数、无 /samantha 前缀)
  assert.equal(calls[0].pathname, '/chat/completion')
  // query 必须带 device_id(缺了 710022004 风控)
  assert.ok(calls[0].search.get('device_id'), 'device_id 必须在 query 上')
  assert.equal(calls[0].search.get('pkg_type'), 'release_version')
  // 信封:content_block 结构,client_meta.conversation_id 为空 + need_create_conversation ⇒ 服务端新建
  assert.equal(calls[0].body.client_meta.conversation_id, '')
  assert.equal(calls[0].body.option.need_create_conversation, true)
  const block = calls[0].body.messages[0].content_block[0]
  assert.equal(block.block_type, 10000)
  assert.ok(block.content.text_block.text.includes('【对话迁移】'))
})

test('⑧d-2 replayConversation:SSE 流里 STREAM_ERROR 710022004 ⇒ code=rate-limited 不冒绿', async () => {
  const impl = async () => ({
    ok: true,
    status: 200,
    text: async () => 'id: 0\nevent: STREAM_ERROR\ndata: {"error_code":710022004,"error_msg":"rate limited"}\n\n',
    json: async () => ({}),
  })
  const r = await replayConversation({ cookieHeader: COOKIE, conv: {}, messages: [], fetchImpl: impl })
  assert.equal(r.code, 'rate-limited')
  assert.equal(r.newConversationId, '')
  assert.match(r.message, /710022004/)
})

test('⑧e replayConversation:登录过期(710012001)⇒ code=login-invalid 不冒绿', async () => {
  const impl = async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ code: 710012001, msg: '登录已过期，请重新登录' }),
    json: async () => ({}),
  })
  const r = await replayConversation({ cookieHeader: COOKIE, conv: {}, messages: [], fetchImpl: impl })
  assert.equal(r.code, 'login-invalid')
  assert.equal(r.newConversationId, '')
})

test('⑧f replayArchive 干跑:列出将回放什么,零发送、零写盘', async () => {
  const dir = mkScratch('doubao-replay-dry-')
  try {
    makeArchive(dir)
    let sent = 0
    const impl = async () => {
      sent += 1
      throw new Error('干跑不得发网络请求')
    }
    const r = await replayArchive({ cookieHeader: COOKIE, archiveDir: dir, fetchImpl: impl, apply: false })
    assert.equal(r.code, 'ok')
    assert.equal(r.total, 2)
    assert.equal(r.replayed, 0)
    assert.equal(sent, 0)
    assert.ok(!fs.existsSync(path.join(dir, 'replay-log.json')), '干跑不写 replay-log')
  } finally {
    rmScratch(dir)
  }
})

test('⑧g replayArchive --apply:逐会话发送,指纹写 replay-log;复跑全跳过', async () => {
  const dir = mkScratch('doubao-replay-apply-')
  try {
    makeArchive(dir)
    let sends = 0
    const impl = async () => {
      sends += 1
      return { ok: true, status: 200, text: async () => SSE_OK, json: async () => ({}) }
    }
    const r1 = await replayArchive({ cookieHeader: COOKIE, archiveDir: dir, fetchImpl: impl, apply: true })
    assert.equal(r1.code, 'ok')
    assert.equal(r1.replayed, 2)
    assert.equal(r1.skipped, 0)
    assert.equal(sends, 2)
    const log = JSON.parse(fs.readFileSync(r1.logFile, 'utf8'))
    assert.equal(Object.keys(log.entries).length, 2)
    // 复跑:指纹命中 ⇒ 全跳过,零发送
    const r2 = await replayArchive({ cookieHeader: COOKIE, archiveDir: dir, fetchImpl: impl, apply: true })
    assert.equal(r2.replayed, 0)
    assert.equal(r2.skipped, 2)
    assert.equal(sends, 2, '复跑零新增发送')
  } finally {
    rmScratch(dir)
  }
})

test('⑧h replayArchive --limit:只回放前 n 个', async () => {
  const dir = mkScratch('doubao-replay-limit-')
  try {
    makeArchive(dir)
    const seen = []
    const impl = async () => {
      seen.push(1)
      return { ok: true, status: 200, text: async () => SSE_OK, json: async () => ({}) }
    }
    const r = await replayArchive({ cookieHeader: COOKIE, archiveDir: dir, fetchImpl: impl, apply: true, limit: 1 })
    assert.equal(r.total, 1)
    assert.equal(r.replayed, 1)
    assert.equal(seen.length, 1)
  } finally {
    rmScratch(dir)
  }
})

test('⑨ 缺 cookie 时 replayArchive 明确 cookie-missing,不静默空过', async () => {
  const dir = mkScratch('doubao-replay-nocookie-')
  try {
    makeArchive(dir)
    const r = await replayArchive({ cookieHeader: '', archiveDir: dir, apply: true })
    assert.equal(r.code, 'cookie-missing')
    assert.equal(r.replayed, 0)
    assert.match(r.message, /新号/)
  } finally {
    rmScratch(dir)
  }
})
