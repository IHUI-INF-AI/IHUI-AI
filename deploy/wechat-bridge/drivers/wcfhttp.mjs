// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * wcfhttp 驱动：把 IHUI 桥契约翻译成 WeChatFerry HTTP（wcfhttp）接口。
 *
 * wcfhttp 默认 http://127.0.0.1:9999；不同版本路径可能有差异，
 * 可用 WCFHTTP_PATHS JSON 覆盖，例如：
 *   WCFHTTP_PATHS={"sendText":"/api/SendText"}
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'

const BASE = (process.env.WCFHTTP_BASE_URL ?? 'http://127.0.0.1:9999').replace(/\/+$/, '')
const MEDIA_DIR = process.env.BRIDGE_MEDIA_DIR ?? join(process.cwd(), '.bridge-media')
const PATHS = {
  status: '/api/GetSelfInfo',
  getContacts: '/api/GetContacts',
  sendText: '/api/SendText',
  sendImage: '/api/SendImage',
  sendFile: '/api/SendFile',
  delContact: '/api/DelContact',
  createRoom: '/api/CreateRoom',
  addRoomMembers: '/api/AddRoomMembers',
  delRoomMembers: '/api/DelRoomMembers',
  renameRoom: '/api/RenameRoom',
  ...safeJson(process.env.WCFHTTP_PATHS),
}

function safeJson(text) {
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return {}
  }
}

async function call(path, { method = 'POST', body } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`wcfhttp HTTP ${response.status}: ${text.slice(0, 200)}`)
  if (!text.trim()) return {}
  try {
    const parsed = JSON.parse(text)
    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.code !== undefined &&
      Number(parsed.code) !== 0
    ) {
      throw new Error(parsed.message ?? `wcfhttp code=${String(parsed.code)}`)
    }
    return parsed
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('wcfhttp code=')) throw e
    return { raw: text }
  }
}

function randomName(prefix, url, fileName) {
  const fromName = typeof fileName === 'string' && fileName ? fileName : ''
  const ext = extname(fromName || new URL(url).pathname) || '.bin'
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`
}

async function download(url, fileName) {
  await mkdir(MEDIA_DIR, { recursive: true })
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) })
  if (!response.ok) throw new Error(`媒体下载失败 HTTP ${response.status}`)
  const buffer = Buffer.from(await response.arrayBuffer())
  const path = join(MEDIA_DIR, randomName('media', url, fileName))
  await writeFile(path, buffer)
  return path
}

function listOf(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  if (Array.isArray(payload?.list)) return payload.list
  if (Array.isArray(payload?.contacts)) return payload.contacts
  return []
}

function contactOf(item) {
  if (!item || typeof item !== 'object') return null
  const wxid = item.wxid ?? item.userName ?? item.user_name ?? item.id
  if (typeof wxid !== 'string' || !wxid) return null
  return {
    wxid,
    nickname: item.nickname ?? item.name ?? item.nickName ?? '',
    remark: item.remark ?? item.remarkName ?? '',
    tags: Array.isArray(item.tags) ? item.tags : [],
  }
}

export function createDriver() {
  return {
    async status() {
      try {
        const payload = await call(PATHS.status, { method: 'GET' })
        const data = payload?.data ?? payload
        return { online: true, selfWxid: data?.wxid ?? data?.userName ?? null, mode: 'wcfhttp' }
      } catch (e) {
        return { online: false, error: e instanceof Error ? e.message : 'wcfhttp 不可达' }
      }
    },

    async send(payload) {
      const target = payload.target
      if (!target) throw new Error('缺少 target')
      if (payload.type === 'text' || payload.type === 'link' || payload.type === 'card') {
        const msg = payload.text ?? payload.content
        if (!msg) throw new Error('缺少文本')
        const aters = Array.isArray(payload.mentions) ? payload.mentions.join(',') : ''
        const result = await call(PATHS.sendText, {
          body: { msg, receiver: target, aters },
        })
        return { messageId: result?.data?.id ?? result?.id ?? `wcf-${Date.now()}` }
      }
      const url = payload.url
      if (!url) throw new Error('缺少媒体 url')
      const localPath = await download(url, payload.fileName)
      const path = payload.type === 'image' ? PATHS.sendImage : PATHS.sendFile
      const result = await call(path, { body: { path: localPath, receiver: target } })
      return { messageId: result?.data?.id ?? result?.id ?? `wcf-${Date.now()}` }
    },

    async action(action, payload) {
      if (action === 'contact.sync') {
        const result = await call(PATHS.getContacts, { method: 'GET' })
        return { data: { contacts: listOf(result).map(contactOf).filter(Boolean) } }
      }
      if (action === 'contact.delete') {
        await call(PATHS.delContact, { body: { wxid: payload.memberId } })
        return { data: { deleted: payload.memberId ?? null } }
      }
      if (action === 'group.create') {
        const result = await call(PATHS.createRoom, {
          body: { memberIds: payload.memberIds ?? [] },
        })
        const data = result?.data ?? {}
        return {
          data: {
            ...data,
            chatId: data.chatId ?? data.roomId ?? data.roomid ?? data.id ?? null,
          },
        }
      }
      if (action === 'group.invite') {
        await call(PATHS.addRoomMembers, {
          body: { roomId: payload.chatId, wxids: payload.memberIds ?? [] },
        })
        return { data: { chatId: payload.chatId ?? null } }
      }
      if (action === 'group.kick') {
        await call(PATHS.delRoomMembers, {
          body: { roomId: payload.chatId, wxids: payload.memberIds ?? [] },
        })
        return { data: { chatId: payload.chatId ?? null } }
      }
      if (action === 'group.rename') {
        await call(PATHS.renameRoom, {
          body: { roomId: payload.chatId, name: payload.title ?? '' },
        })
        return { data: { chatId: payload.chatId ?? null, title: payload.title ?? '' } }
      }
      if (action === 'group.announce') {
        await call(PATHS.sendText, {
          body: { msg: payload.text ?? '', receiver: payload.chatId, aters: 'notify@all' },
        })
        return { data: { chatId: payload.chatId ?? null } }
      }
      return { status: 'unsupported', reason: `wcfhttp 驱动不支持 ${action}` }
    },

    async typing() {},
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
