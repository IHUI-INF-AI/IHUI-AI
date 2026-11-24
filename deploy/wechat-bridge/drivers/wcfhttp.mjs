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
  getRoomMembers: '/api/GetRoomMembers',
  dbs: '/dbs',
  querySql: '/sql',
  pyq: '/pyq',
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

async function call(path, { method = 'POST', body, query } = {}) {
  const search = query ? `?${new URLSearchParams(query).toString()}` : ''
  const response = await fetch(`${BASE}${path}${search}`, {
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

function isMissingRoute(error) {
  return error instanceof Error && /wcfhttp HTTP (404|405)/.test(error.message)
}

/**
 * 同时兼容两种 wcfhttp：
 * - PascalCase /api/xxx（内置默认）
 * - yuxiaoli/wcf-http 的 /text、/contacts、/chatroom-member
 * 只有 404/405 才换下一个候选；业务错误直接抛出，避免把失败伪装成成功。
 */
async function callFallback(requests, options = {}) {
  let lastError = null
  for (const request of requests) {
    try {
      return await call(request.path, {
        method: request.method ?? options.method ?? 'POST',
        body: request.body ?? options.body,
        query: request.query ?? options.query,
      })
    } catch (e) {
      if (!isMissingRoute(e)) throw e
      lastError = e
    }
  }
  throw lastError ?? new Error('wcfhttp 没有可用接口')
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
  if (Array.isArray(payload?.data?.contacts)) return payload.data.contacts
  if (Array.isArray(payload?.data?.friends)) return payload.data.friends
  if (Array.isArray(payload?.data?.members)) return payload.data.members
  if (Array.isArray(payload?.data?.list)) return payload.data.list
  if (Array.isArray(payload?.data?.items)) return payload.data.items
  return []
}

/** 文本发送同时兼容 /api/SendText 与 /text。 */
function sendTextRequest(body) {
  return callFallback(
    [
      { path: PATHS.sendText, body },
      { path: '/text', body },
    ],
    { method: 'POST' },
  )
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

/**
 * wcfhttp 不同实现的群成员返回形状差异很大：
 * - [{wxid,nickname,role}] / {members:[...]}
 * - {wxid1:'昵称1', wxid2:'昵称2'}（WeChatFerry get_chatroom_members 原始形状）
 * 统一归一成数组，由 IHUI 侧写库。
 */
function memberMapOf(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return []
  return Object.entries(value)
    .filter(([wxid, nickname]) => typeof wxid === 'string' && wxid && typeof nickname === 'string')
    .map(([wxid, nickname]) => ({ wxid, nickname }))
}

function memberListOf(payload) {
  if (Array.isArray(payload)) return payload
  const list =
    payload?.members ??
    payload?.memberList ??
    payload?.member_list ??
    payload?.list ??
    payload?.items
  if (Array.isArray(list)) return list
  if (list && typeof list === 'object') return memberMapOf(list)
  if (payload && typeof payload === 'object') {
    const metadataKeys = ['code', 'message', 'msg', 'chatId', 'roomId', 'roomid', 'data']
    if (metadataKeys.some((key) => key in payload)) return []
    return memberMapOf(payload)
  }
  return []
}

function memberOf(item) {
  if (!item || typeof item !== 'object') return null
  const wxid = item.wxid ?? item.userName ?? item.user_name ?? item.memberId ?? item.id
  if (typeof wxid !== 'string' || !wxid) return null
  const role =
    typeof item.role === 'string' && item.role
      ? item.role
      : item.isOwner === true
        ? 'owner'
        : item.isAdmin === true
          ? 'admin'
          : 'member'
  return {
    wxid,
    nickname: item.nickname ?? item.name ?? item.nickName ?? item.displayName ?? '',
    role,
  }
}

/** yuxiaoli/wcf-http 的 /dbs 返回 [{dbName}] / [{name}] / ['MSG0.db']。 */
function dbNamesOf(payload) {
  const list = payload?.data?.dbs ?? payload?.dbs ?? payload?.data ?? payload
  if (!Array.isArray(list)) return []
  return list
    .map((item) =>
      typeof item === 'string'
        ? item
        : typeof item?.dbName === 'string'
          ? item.dbName
          : typeof item?.name === 'string'
            ? item.name
            : '',
    )
    .filter(Boolean)
}

function tableNamesOf(payload) {
  const list = payload?.data?.tables ?? payload?.tables ?? payload?.data ?? []
  if (!Array.isArray(list)) return []
  return list
    .map((item) =>
      typeof item === 'string'
        ? item
        : typeof item?.name === 'string'
          ? item.name
          : typeof item?.tableName === 'string'
            ? item.tableName
            : '',
    )
    .filter(Boolean)
}

async function sqlRows(db, sql) {
  const result = await call(PATHS.querySql, { body: { db, sql } })
  const data = result?.data ?? result
  const rows = data?.bs64 ?? data?.rows ?? data?.messages ?? []
  if (Array.isArray(rows)) return rows
  if (rows && typeof rows === 'object') return [rows]
  return []
}

async function findHistoryDb() {
  if (process.env.WCFHTTP_HISTORY_DB) return process.env.WCFHTTP_HISTORY_DB
  try {
    const payload = await call(PATHS.dbs, { method: 'GET' })
    const names = dbNamesOf(payload)
    const candidate =
      names.find((name) => /msg|message/i.test(name)) ?? names.find((name) => /micro/i.test(name))
    if (candidate) return candidate
  } catch {
    // /dbs 不可用时继续按常见库名探测
  }
  for (const candidate of ['MSG0.db', 'MSG1.db', 'MicroMsg.db']) {
    try {
      const tables = tableNamesOf(
        await call(`/${encodeURIComponent(candidate)}/tables`, { method: 'GET' }),
      )
      if (tables.some((name) => /^MSG$/i.test(name))) return candidate
    } catch {
      // 继续探测下一个
    }
  }
  return 'MSG0.db'
}

async function findMessageTable(db) {
  try {
    const tables = tableNamesOf(await call(`/${encodeURIComponent(db)}/tables`, { method: 'GET' }))
    return (
      tables.find((name) => /^MSG$/i.test(name)) ??
      tables.find((name) => /msg/i.test(name)) ??
      'MSG'
    )
  } catch {
    return 'MSG'
  }
}

/** 从 BytesExtra 的 base64 字节里尽力提取群成员 wxid（不保证所有版本都带）。 */
function groupSenderOf(bytesExtra, chatId, selfWxid) {
  if (typeof bytesExtra !== 'string' || !bytesExtra) return null
  let text = ''
  try {
    text = Buffer.from(bytesExtra, 'base64').toString('latin1')
  } catch {
    return null
  }
  const ids = [...text.matchAll(/wxid_[A-Za-z0-9_-]{3,}/g)].map((match) => match[0])
  return ids.find((id) => id !== chatId && id !== selfWxid) ?? null
}

function historyKindOf(type) {
  const value = Number(type)
  if (value === 1) return 'text'
  if (value === 3 || value === 47) return 'image'
  if (value === 34) return 'voice'
  if (value === 43) return 'video'
  if (value === 49) return 'link'
  if (value === 42 || value === 48) return 'card'
  if (value === 10000 || value === 10002) return 'system'
  return 'other'
}

function historyContentOf(row, kind) {
  const raw = row.StrContent ?? row.strContent ?? row.content
  if (kind === 'text' || kind === 'system') return typeof raw === 'string' ? raw : ''
  if (typeof raw === 'string' && raw.trim() && kind === 'link') return raw
  if (kind === 'image') return '[图片]'
  if (kind === 'voice') return '[语音]'
  if (kind === 'video') return '[视频]'
  if (kind === 'card') return '[卡片]'
  return '[其他消息]'
}

function historyRowOf(row, chatId, selfWxid) {
  const type = row.Type ?? row.type ?? row.msgType ?? row.msg_type ?? 0
  const kind = historyKindOf(type)
  const isSender = Number(row.IsSender ?? row.isSender ?? 0) === 1
  const platformMessageId =
    `${row.MsgSvrID ?? row.msgSvrID ?? row.msgSvrId ?? row.localId ?? row.localID ?? ''}`.trim()
  const senderId = isSender
    ? selfWxid
    : groupSenderOf(row.BytesExtra ?? row.bytesExtra, chatId, selfWxid)
  const sentAt = Number(row.CreateTime ?? row.createTime ?? row.create_time ?? row.ts ?? 0)
  return {
    platformChatId: chatId,
    platformMessageId: platformMessageId || undefined,
    conversationKind: chatId.endsWith('@chatroom') ? 'group' : 'private',
    direction: isSender ? 'outbound' : 'inbound',
    kind,
    senderId: senderId || undefined,
    senderName: undefined,
    content: historyContentOf(row, kind),
    sentAt: Number.isFinite(sentAt) && sentAt > 0 ? sentAt : undefined,
  }
}

export function createDriver() {
  return {
    async status() {
      try {
        const payload = await callFallback(
          [
            { path: PATHS.status, method: 'GET' },
            { path: '/wxid', method: 'GET' },
            { path: '/login', method: 'GET' },
          ],
          { method: 'GET' },
        )
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
        const result = await sendTextRequest({ msg, receiver: target, aters })
        return { messageId: result?.data?.id ?? result?.id ?? `wcf-${Date.now()}` }
      }
      const url = payload.url
      if (!url) throw new Error('缺少媒体 url')
      const localPath = await download(url, payload.fileName)
      const pathList =
        payload.type === 'image'
          ? [
              { path: PATHS.sendImage, body: { path: localPath, receiver: target } },
              { path: '/image', body: { path: localPath, receiver: target } },
            ]
          : [
              { path: PATHS.sendFile, body: { path: localPath, receiver: target } },
              { path: '/file', body: { path: localPath, receiver: target } },
            ]
      const result = await callFallback(pathList, { method: 'POST' })
      return { messageId: result?.data?.id ?? result?.id ?? `wcf-${Date.now()}` }
    },

    async action(action, payload) {
      if (action === 'contact.sync') {
        const result = await callFallback(
          [
            { path: PATHS.getContacts, method: 'GET' },
            { path: '/contacts', method: 'GET' },
          ],
          { method: 'GET' },
        )
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
        const memberIds = payload.memberIds ?? []
        await callFallback([
          { path: PATHS.addRoomMembers, body: { roomId: payload.chatId, wxids: memberIds } },
          {
            path: '/cr-members',
            body: { roomid: payload.chatId, wxids: memberIds.join(',') },
          },
        ])
        return { data: { chatId: payload.chatId ?? null } }
      }
      if (action === 'group.kick') {
        const memberIds = payload.memberIds ?? []
        await callFallback([
          { path: PATHS.delRoomMembers, body: { roomId: payload.chatId, wxids: memberIds } },
          {
            path: '/chatroom-member',
            method: 'DELETE',
            body: { roomid: payload.chatId, wxids: memberIds.join(',') },
          },
        ])
        return { data: { chatId: payload.chatId ?? null } }
      }
      if (action === 'group.rename') {
        await call(PATHS.renameRoom, {
          body: { roomId: payload.chatId, name: payload.title ?? '' },
        })
        return { data: { chatId: payload.chatId ?? null, title: payload.title ?? '' } }
      }
      if (action === 'group.announce') {
        await sendTextRequest({
          msg: payload.text ?? '',
          receiver: payload.chatId,
          aters: 'notify@all',
        })
        return { data: { chatId: payload.chatId ?? null } }
      }
      if (action === 'group.members') {
        const roomId = payload.chatId ?? payload.roomId ?? payload.roomid
        if (!roomId) return { status: 'failed', reason: 'group.members 缺少 chatId' }
        const result = await callFallback([
          {
            path: PATHS.getRoomMembers,
            body: { roomid: roomId, roomId, chatId: roomId },
          },
          { path: '/chatroom-member', method: 'GET', query: { roomid: roomId } },
        ])
        const data = result?.data ?? result
        const members = memberListOf(data).map(memberOf).filter(Boolean)
        return { data: { members } }
      }
      if (action === 'history.fetch') {
        const limit = Math.min(Math.max(Number(payload.limit ?? 500) || 500, 1), 2_000)
        const chatId = typeof payload.chatId === 'string' ? payload.chatId : ''
        let selfWxid = null
        try {
          const status = await callFallback(
            [
              { path: PATHS.status, method: 'GET' },
              { path: '/wxid', method: 'GET' },
              { path: '/login', method: 'GET' },
            ],
            { method: 'GET' },
          )
          const data = status?.data ?? status
          selfWxid = data?.wxid ?? data?.userName ?? null
        } catch {
          // 取不到自己 wxid 时仍然可以导入，只是出站消息的 senderId 为空
        }
        const db = await findHistoryDb()
        const table = await findMessageTable(db)
        if (!/^[A-Za-z0-9_]+$/.test(table)) {
          return { status: 'failed', reason: `非法消息表名：${table}` }
        }
        const escapedChatId = chatId.replace(/'/g, "''")
        const where = chatId ? ` WHERE StrTalker = '${escapedChatId}'` : ''
        const defaultSql = `SELECT * FROM ${table}${where} ORDER BY CreateTime DESC LIMIT ${limit}`
        const sql = (process.env.WCFHTTP_HISTORY_SQL || defaultSql).replace(
          /\{\{limit\}\}/g,
          String(limit),
        )
        const rows = await sqlRows(db, sql)
        const messages = rows
          .map((row) => {
            const rowChatId =
              `${row.StrTalker ?? row.strTalker ?? row.str_talker ?? row.talker ?? chatId ?? ''}`.trim()
            return rowChatId ? historyRowOf(row, rowChatId, selfWxid) : null
          })
          .filter((row) => row && row.platformChatId)
        return { data: { messages, db, table, count: messages.length } }
      }
      if (action === 'moment.fetch') {
        const id = Number(payload.id ?? 0) || 0
        try {
          const result = await call(PATHS.pyq, { method: 'GET', query: { id } })
          const status = Number(result?.status ?? result?.data?.status ?? 1)
          if (status !== 1) {
            return {
              status: 'failed',
              reason: result?.message ?? `wcfhttp /pyq 返回 status=${String(status)}`,
            }
          }
          // 朋友圈正文由 /pyq 触发的 type=0 回调送回桥；这里只负责翻页触发，不伪造内容。
          return {
            data: {
              refresh: true,
              requiresCallback: true,
              source: 'wcfhttp',
              id,
            },
          }
        } catch (e) {
          if (isMissingRoute(e)) {
            return { status: 'unsupported', reason: '当前 wcfhttp 没有 /pyq 接口' }
          }
          throw e
        }
      }
      return { status: 'unsupported', reason: `wcfhttp 驱动不支持 ${action}` }
    },

    async typing() {},
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
