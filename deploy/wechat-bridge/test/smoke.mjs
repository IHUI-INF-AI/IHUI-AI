// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 外部桥契约冒烟：mock 驱动起服务，验 /status /ingest /messages /send /action。
 */

import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PORT = 18848
const BASE = `http://127.0.0.1:${PORT}`
const SECRET = 'bridge-test-secret'
const BASE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')
const QUEUE_FILE = process.env.BRIDGE_TEST_QUEUE_FILE ?? join(BASE_DIR, '.bridge-test-queue.jsonl')
const MOMENTS_FILE = process.env.BRIDGE_TEST_MOMENTS_FILE ?? join(BASE_DIR, '.bridge-test-moments.jsonl')
const ARCHIVE_FILE = process.env.BRIDGE_TEST_ARCHIVE_FILE ?? join(BASE_DIR, '.bridge-test-archive.jsonl')
rmSync(QUEUE_FILE, { force: true })
rmSync(MOMENTS_FILE, { force: true })
rmSync(ARCHIVE_FILE, { force: true })

const child = spawn(process.execPath, ['server.mjs'], {
  cwd: join(dirname(fileURLToPath(import.meta.url)), '..'),
  env: {
    ...process.env,
    BRIDGE_DRIVER: 'mock',
    BRIDGE_PORT: String(PORT),
    BRIDGE_SECRET: SECRET,
    BRIDGE_QUEUE_FILE: QUEUE_FILE,
    BRIDGE_MOMENTS_FILE: MOMENTS_FILE,
    BRIDGE_MOMENT_ARCHIVE: ARCHIVE_FILE,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})

child.stderr.on('data', (chunk) => process.stderr.write(chunk))

async function waitReady() {
  for (let i = 0; i < 50; i += 1) {
    try {
      const res = await fetch(`${BASE}/status`, {
        headers: { Authorization: `Bearer ${SECRET}` },
      })
      if (res.ok) return
    } catch {
      // 继续等
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('桥未在 5s 内就绪')
}

async function api(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SECRET}`,
    },
    body: JSON.stringify(body),
  })
  return res.json()
}

try {
  await waitReady()

  const status = await (
    await fetch(`${BASE}/status`, { headers: { Authorization: `Bearer ${SECRET}` } })
  ).json()
  if (status.ok !== true || status.driver !== 'mock') throw new Error('status 契约不符')

  const ingest = await api('/ingest', {
    messages: [{ id: 'm1', chatId: 'wxid_a', sender: 'wxid_a', type: 'text', content: '你好' }],
  })
  if (ingest.ingested !== 1) throw new Error('ingest 失败')

  const incoming = await (
    await fetch(`${BASE}/messages?since=0&limit=10`, {
      headers: { Authorization: `Bearer ${SECRET}` },
    })
  ).json()
  if (incoming.messages?.length !== 1) throw new Error('messages 未取到入站')
  if (incoming.nextCursor !== String(incoming.messages[0].seq)) throw new Error('nextCursor 不符')
  if (incoming.seq !== incoming.messages[0].seq) throw new Error('messages 未回当前 seq')

  const formBody = new URLSearchParams({
    type: '1',
    fromwx: 'room-1@chatroom',
    gidfromwx: 'wxid_b',
    msg: '表单入站',
  })
  const formIngest = await (
    await fetch(`${BASE}/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${SECRET}`,
      },
      body: formBody.toString(),
    })
  ).json()
  if (formIngest.ingested !== 1) throw new Error('form-urlencoded ingest 失败')

  const send = await api('/send', { target: 'wxid_a', type: 'text', text: 'hi' })
  if (!send.ok || !send.messageId) throw new Error('send 失败')

  const sync = await api('/action', { action: 'contact.sync' })
  if (!sync.ok || sync.data?.contacts?.length !== 2) throw new Error('contact.sync 失败')

  const group = await api('/action', {
    action: 'group.create',
    memberIds: ['wxid_a'],
  })
  if (!group.ok || typeof group.data?.chatId !== 'string')
    throw new Error('group.create 未回 chatId')
  if (!group.data.chatId.endsWith('@chatroom')) throw new Error('group.create 的 chatId 形态不符')

  const members = await api('/action', { action: 'group.members', chatId: 'mock@chatroom' })
  if (!members.ok || members.data?.members?.length !== 3) throw new Error('group.members 失败')

  const history = await api('/action', {
    action: 'history.fetch',
    chatId: 'wxid_mock_alice',
    limit: 10,
  })
  if (!history.ok || history.data?.messages?.length !== 2) throw new Error('history.fetch 失败')
  if (history.data.messages[0]?.platformChatId !== 'wxid_mock_alice')
    throw new Error('history.fetch 会话 id 不符')

  const momentIngest = await api('/ingest', {
    type: 0,
    id: 'sns-1',
    xml: '<timeline><snsId>501</snsId><nickname><![CDATA[Mock 好友]]></nickname><content><![CDATA[朋友圈正文]]></content></timeline>',
  })
  if (momentIngest.ingested !== 0 || momentIngest.moments !== 1)
    throw new Error('type=0 朋友圈未与聊天队列分离')
  const momentFeed = await (
    await fetch(`${BASE}/moments?since=0&limit=10`, {
      headers: { Authorization: `Bearer ${SECRET}` },
    })
  ).json()
  if (momentFeed.moments?.length !== 1) throw new Error('moments 未取到朋友圈')
  if (momentFeed.moments[0]?.content !== '朋友圈正文') throw new Error('朋友圈正文不符')

  const momentFetch = await api('/action', { action: 'moment.fetch', maxPages: 2 })
  if (!momentFetch.ok || momentFetch.data?.fetched !== 2) throw new Error('moment.fetch 失败')
  if (momentFetch.data.moments?.[0]?.id !== 'mock-moment-1')
    throw new Error('moment.fetch 返回内容不符')
  if (momentFetch.data.archive?.total !== 2) throw new Error('moment.fetch 未写入归档')

  const archive = await (
    await fetch(`${BASE}/moments/archive?limit=10`, {
      headers: { Authorization: `Bearer ${SECRET}` },
    })
  ).json()
  if (!archive.ok || archive.total !== 2 || archive.moments?.length !== 2)
    throw new Error('朋友圈归档读取失败')

  const unsupported = await api('/action', { action: 'unknown.action' })
  if (unsupported.status !== 'unsupported') throw new Error('未知动作未返回 unsupported')

  process.stdout.write(`[smoke] 桥契约通过 driver=mock queued=${String(status.queued)}\n`)
} finally {
  child.kill('SIGTERM')
  await once(child, 'exit').catch(() => {})
  rmSync(QUEUE_FILE, { force: true })
  rmSync(MOMENTS_FILE, { force: true })
  rmSync(ARCHIVE_FILE, { force: true })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
