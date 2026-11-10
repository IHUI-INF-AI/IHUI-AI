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

/** thread/list 单页响应(形状逐字对齐 4213.js:196068 的 {thread_list,has_more,next_index}) */
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
    '/samantha/thread/list': ({ body }) => pages[body.index],
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
    '/samantha/thread/list': {
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
    '/samantha/thread/list': () => {
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
    '/samantha/thread/list': () => threadPage(['c1'], { hasMore: true }),
  })
  const r = await listConversations({ cookieHeader: COOKIE, fetchImpl, maxPages: 50 })
  assert.equal(r.pages, 1)
})

test('③c 新版 threadFeed 形状(has_more/next_cursor/thread_list 收在 data.threads)同样能翻', async () => {
  const fetchImpl = mockFetch({
    '/samantha/thread/list': ({ body }) => ({
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
  assert.equal(up.anchor_index, 0)
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
      '/samantha/thread/list': ({ body }) =>
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
