// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//
// 微信 4.x 只读 OCR 驱动：不注入、不读内存、不改微信文件。
// 依赖 tools/wechat-ocr.ps1 用 Windows 自带中文 OCR 读取当前会话。
// 只产出「当前打开会话」的入站文本；发送与群动作暂不支持。

import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const SCRIPT = process.env.BRIDGE_OCR_SCRIPT ?? join(ROOT, '..', 'tools', 'wechat-ocr.ps1')
const POWERSHELL =
  process.env.BRIDGE_OCR_POWERSHELL ??
  'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
const MEDIA_DIR = process.env.BRIDGE_MEDIA_DIR ?? join(process.cwd(), '.bridge-ocr')
const FRAME = join(MEDIA_DIR, 'wechat-frame.png')
const RESULT = join(MEDIA_DIR, 'wechat-frame.json')
const AUTO_SHOW = process.env.OCR_AUTO_SHOW !== '0'
const EMIT_EXISTING = process.env.OCR_EMIT_EXISTING === '1'

let previousBlocks = []
let previousSize = { width: 0, height: 0 }
let previousChatTitle = null
let baselineDone = false
let counter = 0

function runScript(mode) {
  const args = [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    SCRIPT,
    '-Mode',
    mode,
    '-ImagePath',
    FRAME,
    '-JsonPath',
    RESULT,
  ]
  if (AUTO_SHOW) args.push('-AutoShow')
  return new Promise((resolve, reject) => {
    execFile(
      POWERSHELL,
      args,
      { timeout: 30_000, maxBuffer: 8 * 1024 * 1024, windowsHide: true },
      async (error, _stdout, stderr) => {
        try {
          const raw = await readFile(RESULT, 'utf8')
          const parsed = JSON.parse(raw)
          if (!parsed || typeof parsed !== 'object') throw new Error('OCR 返回非对象')
          if (!error) return resolve(parsed)
          if (parsed.reason) return resolve(parsed)
          reject(new Error(stderr?.trim() || error.message))
        } catch (e) {
          if (error) return reject(new Error(stderr?.trim() || error.message))
          reject(e instanceof Error ? e : new Error(String(e)))
        }
      },
    )
  })
}

function isNoise(text) {
  if (!text) return true
  if (text.length <= 1) return true
  if (/^\d{1,2}[:：]\d{2}$/.test(text)) return true
  if (/^(昨天|今天|前天|星期[一二三四五六日天])/.test(text) && text.length <= 8) return true
  if (/^\d{4}[-/年]\d{1,2}[-/月]\d{1,2}/.test(text)) return true
  // 文件气泡的「93B / 1.2MB」是大小，不是消息正文。
  if (/^[\d.]+\s*[KMBG]B?$/i.test(text)) return true
  // 微信时间戳被 OCR 成「。2026一11一2323：20」这种形态，避免当入站正文。
  if (/20\d{2}/.test(text) && /\d{1,2}[：:]\d{2}/.test(text) && text.length <= 30) return true
  return false
}

function chatLeftOf(title, width) {
  const candidate = title ? title.x - width * 0.03 : width * 0.35
  return Math.max(width * 0.28, candidate)
}

/**
 * 从 OCR 行里解析当前会话。
 * 版面依据：顶部标题在右上；会话列表在左侧；消息区在标题下方。
 * 只取左侧气泡（入站），右侧绿色气泡（自己发出）不当作入站。
 */
function parseFrame(payload) {
  const width = Number(payload.width) || 0
  const height = Number(payload.height) || 0
  if (!width || !height || !Array.isArray(payload.lines)) {
    return { chatTitle: null, messages: [] }
  }
  const lines = payload.lines
    .filter((line) => line && typeof line.text === 'string')
    .map((line) => ({
      text: line.text.trim(),
      x: Number(line.x) || 0,
      y: Number(line.y) || 0,
      w: Number(line.w) || 0,
      h: Number(line.h) || 0,
    }))
    .filter((line) => !isNoise(line.text))
    .sort((a, b) => a.y - b.y || a.x - b.x)

  const header = lines.find(
    (line) => line.y < height * 0.16 && line.x > width * 0.25 && !isNoise(line.text),
  )
  const chatTitle = header?.text ?? null
  const chatLeft = chatLeftOf(header, width)
  const top = header ? header.y + Math.max(24, header.h * 1.2) : height * 0.18
  const bottom = height * 0.82

  const inPane = lines.filter((line) => line.y >= top && line.y < bottom && line.x >= chatLeft + 4)
  const inbound = inPane.filter((line) => line.x <= width * 0.74)

  const blocks = []
  for (const line of inbound) {
    const last = blocks.at(-1)
    if (last && Math.abs(line.x - last.x) < width * 0.08 && line.y - last.bottom <= 28) {
      last.text += `\n${line.text}`
      last.bottom = Math.max(last.bottom, line.y + line.h)
      continue
    }
    blocks.push({ text: line.text, x: line.x, bottom: line.y + line.h })
  }
  return {
    width,
    height,
    chatTitle,
    messages: blocks.filter((block) => block.text.length > 0),
  }
}

function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[\s\u3000]/g, '')
    .replace(/[【】\[\]〔〕〖〗·•，,。.：:；;！!？?]/g, '')
}

function levenshtein(a, b) {
  const memo = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))
  for (let i = 0; i <= a.length; i += 1) memo[i][0] = i
  for (let j = 0; j <= b.length; j += 1) memo[0][j] = j
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      memo[i][j] = Math.min(memo[i - 1][j] + 1, memo[i][j - 1] + 1, memo[i - 1][j - 1] + cost)
    }
  }
  return memo[a.length][b.length]
}

/**
 * OCR 同一行每次识别都可能差一两个字（"iLink" ↔ "KiLink"、"成功"时有时无）。
 * 用编辑距离近似判同，避免每轮把旧消息当新消息重复入库；位置再兜一层，
 * 相同文本出现在不同位置（真的连发两条"好的"）仍算两条。
 */
function sameMessage(a, b) {
  const left = normalizeText(a)
  const right = normalizeText(b)
  if (!left || !right) return false
  if (left === right) return true
  const max = Math.max(left.length, right.length)
  return 1 - levenshtein(left, right) / max >= 0.62
}

function diffMessageBlocks(previous, current, sizeChanged) {
  const used = new Set()
  const fresh = []
  for (const message of current) {
    const matched = previous.findIndex(
      (old, index) =>
        !used.has(index) &&
        sameMessage(old.text, message.text) &&
        (sizeChanged || Math.abs(old.bottom - message.bottom) <= 28),
    )
    if (matched >= 0) used.add(matched)
    else fresh.push(message)
  }
  return fresh
}

function chatIdOf(title) {
  const hash = createHash('sha256')
    .update(title || 'unknown')
    .digest('hex')
    .slice(0, 12)
  return `ocr:${hash}`
}

function toEvent(chatTitle, text) {
  counter += 1
  const chatId = chatIdOf(chatTitle)
  return {
    id: `ocr-${Date.now()}-${counter}`,
    chatId,
    sender: chatId,
    senderName: chatTitle || '当前会话',
    type: 'text',
    content: text,
    timestamp: Date.now(),
    chatTitle,
  }
}

export const __test__ = { normalizeText, sameMessage, diffMessageBlocks, parseFrame }

export function createDriver() {
  return {
    async status() {
      try {
        const info = await runScript('status')
        return {
          online: info.ok === true,
          selfWxid: 'ocr:weixin',
          mode: 'ocr-readonly',
          window: info.hwnd ?? null,
          visible: info.visible === true,
          reason: info.reason ?? undefined,
        }
      } catch (e) {
        return {
          online: false,
          selfWxid: 'ocr:weixin',
          mode: 'ocr-readonly',
          reason: e instanceof Error ? e.message : 'OCR 状态读取失败',
        }
      }
    },

    async poll() {
      const frame = await runScript('read')
      if (frame.ok !== true) return []
      const parsed = parseFrame(frame)
      if (!parsed.chatTitle || parsed.messages.length === 0) {
        previousBlocks = []
        previousSize = { width: parsed.width ?? 0, height: parsed.height ?? 0 }
        previousChatTitle = null
        baselineDone = false
        return []
      }
      const sizeChanged =
        previousSize.width > 0 &&
        (Math.abs((parsed.width ?? 0) - previousSize.width) > 8 ||
          Math.abs((parsed.height ?? 0) - previousSize.height) > 8)
      const chatChanged = previousChatTitle !== null && previousChatTitle !== parsed.chatTitle
      const current = parsed.messages.map((message) => ({
        text: message.text,
        bottom: message.bottom,
      }))
      if (!baselineDone || chatChanged) {
        baselineDone = true
        previousBlocks = current
        previousSize = { width: parsed.width ?? 0, height: parsed.height ?? 0 }
        previousChatTitle = parsed.chatTitle
        if (!EMIT_EXISTING) return []
        return current.map((message) => toEvent(parsed.chatTitle, message.text))
      }
      const fresh = diffMessageBlocks(previousBlocks, current, sizeChanged)
      previousBlocks = current
      previousSize = { width: parsed.width ?? 0, height: parsed.height ?? 0 }
      previousChatTitle = parsed.chatTitle
      return fresh.map((message) => toEvent(parsed.chatTitle, message.text))
    },

    async action(action) {
      return { status: 'unsupported', reason: `OCR 只读驱动不支持动作 ${action}` }
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
