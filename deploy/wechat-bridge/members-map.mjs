// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 群成员昵称 → 本地成员 id 映射。
 * 不伪造 wxid：只在已有联系人/群成员快照里按「会话标题 + 昵称」唯一命中时回填 memberId；
 * 未命中、昵称歧义或昵称为空时回退稳定本地哈希，与 OCR 既有行为保持兼容。
 * 映射文件默认 .bridge-members.json，可用 BRIDGE_MEMBER_MAP 覆盖路径。
 */

import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
export const MEMBER_MAP_FILE =
  process.env.BRIDGE_MEMBER_MAP?.trim() || join(ROOT, '.bridge-members.json')

const LOCAL_HASH_PREFIX = 'ocr:member:'

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[\s\u3000]/g, '')
    .replace(/[【】\[\]〔〕〖〗·•，,。.：:；;！!？?、]/g, '')
}

/** 群标题可能带成员数「项目群 (23)」；会话/成员 id 必须用去掉计数的稳定键。 */
function stableChatKey(title) {
  const value = String(title || 'unknown').trim()
  const marker = value.match(/[（(]\s*(\d{1,4})\s*[）)]/u)
  if (!marker) return value
  const tail = value.slice(marker.index + marker[0].length)
  const count = Number(marker[1])
  const tailNoise =
    !tail || /^[^\p{L}\p{N}]{0,4}$/u.test(tail) || /^@[A-Za-z0-9]{1,4}$/u.test(tail)
  if (tailNoise && count >= 1 && count <= 1000) {
    return (value.slice(0, marker.index) + tail).trim() || value
  }
  return value
}

/** 未命中映射时的稳定本地哈希，格式与 OCR 旧版 memberIdOf 完全一致。 */
export function localMemberId(chatTitle, nickname) {
  if (!String(nickname || '').trim()) return `${LOCAL_HASH_PREFIX}unknown`
  const hash = createHash('sha256')
    .update(`${stableChatKey(chatTitle)}\u0000${nickname}`)
    .digest('hex')
    .slice(0, 12)
  return `${LOCAL_HASH_PREFIX}${hash}`
}

export function normalizeMemberEntry(raw) {
  if (!raw || typeof raw !== 'object') return null
  const nickname = String(raw.nickname ?? '').trim()
  const memberId = String(raw.memberId ?? '').trim()
  if (!nickname || !memberId) return null
  const source = raw.source === 'contact' ? 'contact' : 'group-member'
  const chatTitle = String(raw.chatTitle ?? '').trim()
  return { chatTitle: chatTitle || null, nickname, memberId, source }
}

export function normalizeMemberMap(map) {
  const list = Array.isArray(map?.members) ? map.members : []
  const members = list.map(normalizeMemberEntry).filter(Boolean)
  return { members }
}

export async function loadMemberMap(filePath = MEMBER_MAP_FILE) {
  if (!existsSync(filePath)) return { members: [] }
  try {
    const raw = await readFile(filePath, 'utf8')
    if (!raw.trim()) return { members: [] }
    return normalizeMemberMap(JSON.parse(raw))
  } catch {
    // 映射文件损坏不能拖垮桥；按空映射启动，下次写入时再重建。
    return { members: [] }
  }
}

function entryKey(entry) {
  return `${entry.source}\u0000${entry.chatTitle ?? ''}\u0000${normalizeText(entry.nickname)}`
}

/** 合并映射：同键（source + 会话 + 昵称）以后来的为准，其余条目保留。 */
export function mergeMemberMap(current, incoming) {
  const byKey = new Map()
  for (const entry of normalizeMemberMap(current).members) byKey.set(entryKey(entry), entry)
  for (const entry of normalizeMemberMap(incoming).members) byKey.set(entryKey(entry), entry)
  return { members: [...byKey.values()] }
}

export async function saveMemberMap(map, filePath = MEMBER_MAP_FILE) {
  const normalized = normalizeMemberMap(map)
  await mkdir(dirname(filePath), { recursive: true })
  const tmpPath = `${filePath}.tmp-${process.pid}`
  await writeFile(tmpPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8')
  await rename(tmpPath, filePath)
  return normalized
}

/**
 * 解析群内发送人。
 * 唯一命中 → 返回真实 memberId 与来源；昵称重复（歧义）、未命中或昵称为空 → 回退本地哈希。
 * contact 来源按昵称全局匹配；group-member 来源按会话标题 + 昵称匹配。
 */
export function resolveMember(map, chatTitle, nickname) {
  const name = String(nickname ?? '').trim()
  if (!name) {
    return {
      memberId: localMemberId(chatTitle, ''),
      resolved: false,
      source: 'local',
      senderName: '未知群成员',
    }
  }
  const members = normalizeMemberMap(map).members
  const chatKey = stableChatKey(chatTitle)
  const matches = members.filter((entry) => {
    if (normalizeText(entry.nickname) !== normalizeText(name)) return false
    if (entry.source === 'contact') return true
    if (!entry.chatTitle) return true
    return stableChatKey(entry.chatTitle) === chatKey
  })
  const distinctIds = new Set(matches.map((entry) => entry.memberId))
  if (matches.length >= 1 && distinctIds.size === 1) {
    const hit = matches[0]
    return { memberId: hit.memberId, resolved: true, source: hit.source, senderName: name }
  }
  return {
    memberId: localMemberId(chatTitle, name),
    resolved: false,
    source: 'local',
    senderName: name,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
