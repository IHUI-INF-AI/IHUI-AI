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
const AUTO_SHOW = process.env.OCR_AUTO_SHOW === '1'
const BACKGROUND = process.env.OCR_BACKGROUND !== '0'
/** 朋友圈遍历默认后台只读；显式要求自动点导航时才还原微信窗口。 */
const MOMENTS_AUTO_SHOW = process.env.OCR_MOMENTS_AUTO_SHOW === '1'
const EMIT_EXISTING = process.env.OCR_EMIT_EXISTING === '1'

let previousBlocks = []
let previousSize = { width: 0, height: 0 }
let previousChatTitle = null
let baselineDone = false
let counter = 0
/** 一旦某一帧识别出群昵称，就记住这个会话是群；避免昵称行被 OCR 漏掉时把群消息降级成私聊。 */
const groupChats = new Set()

function runScript(mode, options = {}) {
  const imagePath = options.imagePath ?? FRAME
  const jsonPath = options.jsonPath ?? RESULT
  const args = [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    SCRIPT,
    '-Mode',
    mode,
    '-ImagePath',
    imagePath,
    '-JsonPath',
    jsonPath,
  ]
  if (options.title) args.push('-Title', options.title)
  if (options.maxPages) args.push('-MaxPages', String(options.maxPages))
  if (mode === 'read') {
    if (BACKGROUND && !AUTO_SHOW) args.push('-Background')
    if (AUTO_SHOW) args.push('-AutoShow')
  } else if (mode === 'moments') {
    // 朋友圈遍历默认后台复用已打开窗口，绝不自己点导航把微信弹到前台。
    if (MOMENTS_AUTO_SHOW) args.push('-AutoShow')
    else args.push('-Background')
  } else if (process.env.OCR_AUTO_SHOW !== '0') {
    // search/switch 是显式动作，仍允许自动还原窗口；普通轮询 read 默认绝不弹窗。
    args.push('-AutoShow')
  }
  return new Promise((resolve, reject) => {
    execFile(
      POWERSHELL,
      args,
      {
        timeout: mode === 'moments' ? 180_000 : mode === 'switch' ? 90_000 : 30_000,
        maxBuffer: 8 * 1024 * 1024,
        windowsHide: true,
      },
      async (error, _stdout, stderr) => {
        try {
          const raw = await readFile(jsonPath, 'utf8')
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
  if (/^(昨天|今天|前天|星期[一二三四五六日天])(\s*\d{1,2}[:：]\d{2})?$/u.test(text)) return true
  if (/^\d{4}[-/年]\d{1,2}[-/月]\d{1,2}/.test(text)) return true
  // 文件气泡的「93B / 1.2MB」是大小，不是消息正文。
  if (/^[\d.]+\s*[KMBG]B?$/i.test(text)) return true
  // 微信时间戳被 OCR 成「。2026一11一2323：20」这种形态，避免当入站正文。
  if (/20\d{2}/.test(text) && /\d{1,2}[：:]\d{2}/.test(text) && text.length <= 30) return true
  return false
}

function chatLeftOf(title, width) {
  const candidate = title ? title.x - width * 0.03 : width * 0.1
  // 4.2 单栏模式标题在 x≈0.11w、消息气泡从 x≈0.12w 起；旧 0.28w 会把整段消息裁掉。
  return Math.max(width * 0.06, candidate)
}

/** 搜索浮层/内置浏览器标题会被 OCR 当成会话名（如「O×」「服务通知入口怎么设置」）。 */
function isPlausibleChatTitle(title) {
  if (!title || title.length > 40) return false
  if (/^[O0０]\s*[×xX✕]/u.test(title)) return false
  if (/搜索|怎么|入口|小程序|网页|相关搜索/u.test(title)) return false
  return true
}

/**
 * 群标题里的成员数标记。微信 4.x 的 OCR 常在「（452）」后多吐一个「@v」，
 * 不能只按右括号结尾判断；尾巴只接受 0-4 个非文字噪点或 @xxx。
 * 人数限制 1-1000，避免把「年度总结(2026)」这类私聊标题误判成群。
 */
function groupMarkerOf(title) {
  const value = String(title || '').trim()
  const marker = value.match(/[（(]\s*(\d{1,4})\s*[）)]/u)
  if (marker && marker.index !== undefined) {
    const tail = value.slice(marker.index + marker[0].length)
    const count = Number(marker[1])
    const tailLooksLikeNoise =
      !tail || /^[^\p{L}\p{N}]{0,4}$/u.test(tail) || /^@[A-Za-z0-9]{1,4}$/u.test(tail)
    if (tailLooksLikeNoise && count >= 1 && count <= 1000) {
      return { start: marker.index, end: marker.index + marker[0].length + tail.length }
    }
  }
  const people = value.match(/>\s*(\d{1,4})\s*人\s*$/u)
  if (people && people.index !== undefined) {
    const count = Number(people[1])
    if (count >= 1 && count <= 1000) return { start: people.index, end: value.length }
  }
  return null
}

/** 群标题常见「项目群 (23)」「客户群(108)」；只把末尾计数当辅助证据，不单靠它。 */
function isGroupTitle(title) {
  return groupMarkerOf(title) !== null
}

/** 群昵称行的文本特征：短、无句读、不是消息占位符。 */
function isLikelySenderName(text) {
  const value = text.trim()
  if (!value || value.length > 24 || value.includes('\n')) return false
  if (/[。！？!?，,：:；;、]/u.test(value)) return false
  if (/[《》]/u.test(value)) return false
  if (/^\d{1,2}[:：]\d{2}/u.test(value)) return false
  if (
    /^(图片|视频|语音|文件|链接|转账|红包|位置|名片|小程序|聊天记录|动画表情|表情)$/u.test(value)
  ) {
    return false
  }
  return true
}

/**
 * 群聊里发送人昵称在气泡上方，字号比正文小、颜色更浅。
 * OCR 行高是字号的最稳信号；PowerShell 额外采样的 contrast 作为第二证据。
 */
function splitSenderLabel(block, width) {
  const lines = block.lines
  if (!lines || lines.length < 2) return null
  const first = lines[0]
  const second = lines[1]
  if (!isLikelySenderName(first.text)) return null
  const gap = second.y - (first.y + first.h)
  // 群昵称与气泡之间常有一行行距；4.x OCR 实测可到 26px，仍不能把私聊多行正文误拆。
  if (gap < -2 || gap > 30) return null
  const smallerFont = first.h > 0 && second.h > 0 && first.h <= Math.max(10, second.h * 0.85)
  const lowerContrast =
    typeof first.contrast === 'number' &&
    typeof second.contrast === 'number' &&
    first.contrast > 0 &&
    second.contrast > 0 &&
    first.contrast <= second.contrast * 0.78
  if (!smallerFont && !lowerContrast) return null
  if (first.w > width * 0.34) return null
  const text = lines
    .slice(1)
    .map((line) => line.text)
    .join('\n')
    .trim()
  if (!text) return null
  return { senderName: first.text, text }
}

/**
 * 从 OCR 行里解析当前会话。
 * 版面依据：顶部标题在右上；会话列表在左侧；消息区在标题下方。
 * 只取左侧气泡（入站），右侧绿色气泡（自己发出）不当作入站。
 * 群聊额外识别气泡上方的小字号昵称，并把昵称从正文中剥离。
 */
function parseFrame(payload) {
  const width = Number(payload.width) || 0
  const height = Number(payload.height) || 0
  if (!width || !height || !Array.isArray(payload.lines)) {
    return { chatTitle: null, messages: [], isGroup: false }
  }
  const lines = payload.lines
    .filter((line) => line && typeof line.text === 'string')
    .map((line) => ({
      text: line.text.trim(),
      x: Number(line.x) || 0,
      y: Number(line.y) || 0,
      w: Number(line.w) || 0,
      h: Number(line.h) || 0,
      contrast: Number.isFinite(Number(line.contrast)) ? Number(line.contrast) : -1,
    }))
    .filter((line) => !isNoise(line.text))
    .sort((a, b) => a.y - b.y || a.x - b.x)

  const findHeader = (source) =>
    source.find(
      (line) =>
        line.y < height * 0.09 &&
        line.x > width * 0.06 &&
        line.x < width * 0.55 &&
        isPlausibleChatTitle(line.text) &&
        !isNoise(line.text),
    )
  const scaledLines = Array.isArray(payload.linesScaled)
    ? payload.linesScaled
        .map((line) => ({
          text: String(line.text ?? ''),
          x: Number(line.x) || 0,
          y: Number(line.y) || 0,
          w: Number(line.w) || 0,
          h: Number(line.h) || 0,
          contrast: Number.isFinite(Number(line.contrast)) ? Number(line.contrast) : -1,
        }))
        .filter((line) => !isNoise(line.text))
        .sort((a, b) => a.y - b.y || a.x - b.x)
    : []
  const header = findHeader(lines) ?? findHeader(scaledLines)
  const rawTitle = header?.text ?? null
  const chatTitle = isPlausibleChatTitle(rawTitle) ? rawTitle : null
  const chatLeft = chatLeftOf(header, width)
  const top = header ? header.y + Math.max(24, header.h * 1.2) : height * 0.18
  const bottom = height * 0.82

  const inPaneOf = (source) => {
    const inPane = source.filter(
      (line) => line.y >= top && line.y < bottom && line.x >= chatLeft + 4,
    )
    // 单栏聊天内容最宽到 0.48w；右侧 0.48w 以外可能是自己发出的气泡、图片或内置浏览器/搜索浮层。
    return inPane.filter((line) => line.x <= width * 0.48)
  }

  const parseBody = (source) => {
    const inbound = inPaneOf(source)
    const blocks = []
    for (const line of inbound) {
      const last = blocks.at(-1)
      if (last && Math.abs(line.x - last.x) < width * 0.08 && line.y - last.bottom <= 28) {
        last.lines.push(line)
        last.text += `\n${line.text}`
        last.bottom = Math.max(last.bottom, line.y + line.h)
        continue
      }
      blocks.push({
        text: line.text,
        x: line.x,
        bottom: line.y + line.h,
        lines: [line],
      })
    }
    let foundSender = false
    const messages = blocks
      .map((block) => {
        const split = splitSenderLabel(block, width)
        if (!split) return { text: block.text, senderName: null, bottom: block.bottom }
        foundSender = true
        return { text: split.text, senderName: split.senderName, bottom: block.bottom }
      })
      .filter((message) => message.text.length > 0)
    return { messages, foundSender }
  }

  const normal = parseBody(lines)
  const scaled = scaledLines.length > 0 ? parseBody(scaledLines) : null
  const groupTitle = isGroupTitle(chatTitle)
  const scaledPreferred =
    groupTitle && scaled !== null && scaled.messages.some((message) => message.senderName !== null)
  const chosen = scaledPreferred ? scaled : normal
  return {
    width,
    height,
    chatTitle,
    messages: chosen.messages,
    isGroup: groupTitle || normal.foundSender || chosen.foundSender,
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

/** 群标题可能带成员数「项目群 (23)」；计数会变，会话/成员 id 必须用去掉计数的稳定键。 */
function stableChatKey(title) {
  const value = String(title || 'unknown').trim()
  const marker = groupMarkerOf(value)
  if (!marker) return value
  const stripped = (value.slice(0, marker.start) + value.slice(marker.end)).trim()
  return stripped || value
}

function chatIdOf(title) {
  const hash = createHash('sha256').update(stableChatKey(title)).digest('hex').slice(0, 12)
  return `ocr:${hash}`
}

/** 群内发送人没有 wxid 可读，只能把「群标题 + 昵称」哈希成稳定本地成员 id。 */
function memberIdOf(chatTitle, senderName) {
  if (!senderName) return 'ocr:member:unknown'
  const hash = createHash('sha256')
    .update(`${stableChatKey(chatTitle)}\u0000${senderName}`)
    .digest('hex')
    .slice(0, 12)
  return `ocr:member:${hash}`
}

/** 朋友圈里的时间/互动文案，不能混进正文。 */
function isMomentMeta(text) {
  return (
    /^(\d+\s*[小尐]?[盯彐]?[分钅]?[钟中]?前|\d+\s*[小尐][时寸]前|刚刚|昨天|今天|前天)$/u.test(
      text,
    ) ||
    /^\d{1,2}[．.月]\d{1,2}(日)?$/u.test(text) ||
    /^\d+\s*[小尐][盯彐]?[分钅]?[钟中]?前[频号。，,]/u.test(text) ||
    (/[Mm]anga/u.test(text) && text.length <= 24) ||
    /^(下[一g6刁]?条|评论|赞|点赞|全文|收起|广告|朋友圈|朋友仅展示|查看更多)[>＞]?$/u.test(text)
  )
}

/** 广告卡片里的浏览器 UI 行（「首页」「访问」「b00…browse」）不是动态正文。 */
function isMomentCardLine(text) {
  if (/^首页/u.test(text)) return true
  if (/^\d+\s*[^。\n]{0,6}前/u.test(text) && text.length <= 40) return true
  if (/^(无[谩]?计|毫无[谩]?计|一年[狂]|查看更多|下[一g6刁]?条)/u.test(text)) return true
  if (/[a-z0-9]{3,}[.,]?[a-z0-9]*\.(com|cn|net|top|io)/iu.test(text) && text.length <= 80) {
    return true
  }
  return /(?:browse|volume|your)/iu.test(text) && text.length <= 24
}

/** 朋友圈作者名末尾常被 OCR 粘上手机号；手机号不是昵称的一部分。 */
function stripMomentAuthorPhone(text) {
  return String(text || '')
    .replace(/\s*[（(]?\s*1[3-9]\d{9}\s*[）)]?\s*$/u, '')
    .trim()
}

/** 跨页重复动态：OCR 会多/少字，整段 sameMessage 不够时，用两行以上重合判断同一动态。 */
function isSameMomentContent(left, right) {
  if (sameMessage(left, right)) return true
  const a = String(left || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length >= 4)
  const b = String(right || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length >= 4)
  if (a.length < 1 || b.length < 1) return false
  // 截断页只抓到标题一行时，和完整正文的首行模糊比对；同一动态不能拆成两条。
  if (a.length === 1 && b.length >= 2 && sameMessage(a[0], b[0])) return true
  if (b.length === 1 && a.length >= 2 && sameMessage(a[0], b[0])) return true
  if (a.length < 2 || b.length < 2) return false
  let matched = 0
  for (const line of a) {
    if (b.some((other) => sameMessage(line, other))) matched += 1
    if (matched >= 2) return true
  }
  return false
}

/**
 * 朋友圈窗口是列表流：同一条动态的正文行间距小，不同动态之间有明显留白。
 * 按留白切块，首行小字号短文本视为作者；只返回真实 OCR 到的文字，不猜图片/点赞数。
 */
function parseMomentPages(payload) {
  const pages = Array.isArray(payload?.pages) ? payload.pages : []
  const moments = []
  const seen = new Set()
  const embedded = payload?.embedded === true
  for (const [index, page] of pages.entries()) {
    if (!page || !Array.isArray(page.lines)) continue
    const width = Number(page.width) || 0
    const height = Number(page.height) || 0
    const minX = embedded ? width * 0.18 : width * 0.1
    const lines = page.lines
      .filter((line) => line && typeof line.text === 'string')
      .map((line) => ({
        text: line.text.trim(),
        x: Number(line.x) || 0,
        y: Number(line.y) || 0,
        w: Number(line.w) || 0,
        h: Number(line.h) || 0,
      }))
      .filter(
        (line) =>
          line.text &&
          !isNoise(line.text) &&
          !isMomentMeta(line.text) &&
          !isMomentCardLine(line.text) &&
          line.x >= minX &&
          line.x <= width * 0.92 &&
          line.y >= height * 0.05 &&
          line.h <= height * 0.12,
      )
      .sort((a, b) => a.y - b.y || a.x - b.x)
    const contentWidth = Math.max(...lines.map((line) => line.x + line.w), width * 0.1)
    const blocks = []
    for (const line of lines) {
      const last = blocks.at(-1)
      if (last && Math.abs(line.x - last.x) < width * 0.18 && line.y - last.bottom <= 26) {
        last.lines.push(line)
        last.bottom = Math.max(last.bottom, line.y + line.h)
        continue
      }
      blocks.push({ lines: [line], x: line.x, bottom: line.y + line.h })
    }
    for (const [blockIndex, block] of blocks.entries()) {
      if (embedded && block.lines[0].x > contentWidth * 0.62) continue
      // 4.2 内嵌朋友圈顶部封面文案字号明显更大（「人生规划/职业转型」），
      // 不能被当成三条正文；动态流里的作者/正文不会用这么大的字号。
      if (
        embedded &&
        block.lines[0].y < height * 0.28 &&
        block.lines.some((line) => line.h >= Math.max(18, height * 0.025))
      ) {
        continue
      }
      // 左栏会混进「发现/视频号/小程序」等导航文字；动态流里的短动态仍保留。
      if (embedded && block.lines.length === 1 && block.lines[0].y < height * 0.55) continue
      const first = block.lines[0]
      const second = block.lines[1]
      const authorCandidate = stripMomentAuthorPhone(first.text)
      const nextBlock = blocks[blockIndex + 1]
      // 顶部封面后的作者行和正文之间可能隔着图片/空白，成为两个块；
      // 单行作者紧邻下一段多行正文时跳过作者行，避免单独生成一条「作者名」动态。
      if (
        embedded &&
        block.lines.length === 1 &&
        first.h <= 16 &&
        isLikelySenderName(authorCandidate) &&
        nextBlock &&
        nextBlock.lines.length >= 2 &&
        Math.abs(nextBlock.x - block.x) < width * 0.18 &&
        nextBlock.lines[0].y - first.y <= height * 0.3
      ) {
        continue
      }
      let authorName = ''
      if (
        second &&
        isLikelySenderName(authorCandidate) &&
        first.h > 0 &&
        second.h > 0 &&
        first.h <= second.h * 0.95
      ) {
        authorName = authorCandidate
      }
      const content = block.lines
        .slice(authorName ? 1 : 0)
        .map((line) => line.text)
        .join('\n')
        .trim()
      // 动态内嵌的小截图会把「开店」这类单字/短词 OCR 出来，字号明显小于正文；
      // 只过滤内嵌页里单行、小字号、极短的伪块，正常一行短动态仍保留。
      if (embedded && block.lines.length === 1 && first.h <= 16 && content.length <= 8) continue
      // 作者名被截断在页底、只剩「名字+手机号」时，下一行正文不在本页，不能算一条动态。
      if (embedded && block.lines.length === 1 && first.h <= 16 && /1[3-9]\d{9}$/u.test(content)) {
        continue
      }
      // OCR 把「55 分钟前」和旁边图片水印粘成一行时，开头仍是数字+分，长度也短。
      if (embedded && /^\d+\s*[彐]?分/u.test(content) && content.length <= 24) continue
      // 以时间开头的卡片页脚（如「1小盯前频号。孟健隔裎」）不是动态正文。
      if (embedded && /^\d+\s*[小尐][盯彐]?[分钅]?[钟中]?前(?:频|号|。|，|,|$)/u.test(content)) {
        continue
      }
      if (embedded && /(?:Manga|manga)/u.test(content) && content.length <= 24) continue
      if (embedded && /^\d{4}$/u.test(content)) continue
      if (embedded && /^\s*[，,]\d{1,2}\s*[，,．.]\d{1,2}/u.test(content)) continue
      if (
        embedded &&
        block.lines.length === 1 &&
        first.h >= 16 &&
        first.y > height * 0.75 &&
        content.length <= 8
      ) {
        continue
      }
      if (content.length < 2) continue
      const id = `ocr-moment-${createHash('sha256')
        .update(`${authorName}\u0000${content}`)
        .digest('hex')
        .slice(0, 16)}`
      if (seen.has(id)) continue
      const duplicate = moments.find(
        (item) =>
          isSameMomentContent(item.content, content) ||
          (Boolean(authorName) && sameMessage(item.content, authorName)) ||
          (item.authorName !== '朋友圈好友' && sameMessage(item.authorName, content)),
      )
      if (duplicate) {
        // 同一动态先抓到标题、后抓到全文时保留全文，不能反过来把正文丢掉。
        if (content.length > duplicate.content.length + 4) {
          duplicate.content = content
          duplicate.authorName = authorName || duplicate.authorName
          duplicate.id = `ocr-moment-${createHash('sha256')
            .update(`${duplicate.authorName}\u0000${content}`)
            .digest('hex')
            .slice(0, 16)}`
        }
        continue
      }
      seen.add(id)
      moments.push({
        id,
        authorId: null,
        authorName: authorName || '朋友圈好友',
        content,
        mediaUrls: [],
        createdAt: null,
        source: 'ocr',
        page: Number(page.page) || index + 1,
      })
    }
  }
  return {
    moments,
    pages: pages.length,
    embedded,
    partial: pages.length > 0 && pages.length >= (Number(payload?.maxPages) || 3),
  }
}

function toEvent(chatTitle, text, options = {}) {
  counter += 1
  const chatId = chatIdOf(chatTitle)
  const isGroup = options.isGroup === true
  const senderName = isGroup ? options.senderName || '未知群成员' : chatTitle || '当前会话'
  return {
    id: `ocr-${Date.now()}-${counter}`,
    chatId,
    sender: isGroup ? memberIdOf(chatTitle, options.senderName ?? '') : chatId,
    senderName,
    type: 'text',
    content: text,
    timestamp: Date.now(),
    chatTitle,
    isGroup,
    chatType: isGroup ? 'group' : 'private',
  }
}

export const __test__ = {
  normalizeText,
  sameMessage,
  diffMessageBlocks,
  parseFrame,
  splitSenderLabel,
  isGroupTitle,
  stableChatKey,
  parseMomentPages,
}

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
      const chatChanged =
        previousChatTitle !== null &&
        stableChatKey(previousChatTitle) !== stableChatKey(parsed.chatTitle)
      if (parsed.isGroup) groupChats.add(stableChatKey(parsed.chatTitle))
      const isGroupChat = parsed.isGroup === true || groupChats.has(stableChatKey(parsed.chatTitle))
      const current = parsed.messages.map((message) => ({
        text: message.text,
        bottom: message.bottom,
        senderName: message.senderName,
      }))
      if (!baselineDone || chatChanged) {
        baselineDone = true
        previousBlocks = current
        previousSize = { width: parsed.width ?? 0, height: parsed.height ?? 0 }
        previousChatTitle = parsed.chatTitle
        if (!EMIT_EXISTING) return []
        return current.map((message) =>
          toEvent(parsed.chatTitle, message.text, {
            isGroup: isGroupChat,
            senderName: message.senderName,
          }),
        )
      }
      const fresh = diffMessageBlocks(previousBlocks, current, sizeChanged)
      previousBlocks = current
      previousSize = { width: parsed.width ?? 0, height: parsed.height ?? 0 }
      previousChatTitle = parsed.chatTitle
      return fresh.map((message) =>
        toEvent(parsed.chatTitle, message.text, {
          isGroup: isGroupChat,
          senderName: message.senderName,
        }),
      )
    },

    async action(action, payload = {}) {
      if (action === 'moment.fetch') {
        const maxPages = Math.min(Math.max(Number(payload.maxPages ?? 3) || 3, 1), 30)
        const resultPath = join(MEDIA_DIR, 'wechat-moments.json')
        const imagePath = join(MEDIA_DIR, 'wechat-moments.png')
        try {
          const frame = await runScript('moments', {
            maxPages,
            imagePath,
            jsonPath: resultPath,
          })
          if (frame.ok !== true) {
            return {
              status: 'failed',
              reason: typeof frame.reason === 'string' ? frame.reason : '朋友圈遍历失败',
              data: { title: '朋友圈' },
            }
          }
          const parsed = parseMomentPages({ ...frame, maxPages })
          return {
            status: 'accepted',
            data: {
              paging: 'driver',
              source: 'ocr',
              pages: parsed.pages,
              moments: parsed.moments,
              embedded: parsed.embedded,
              partial: frame.partial === true || parsed.partial,
              reason:
                typeof frame.reason === 'string' && frame.reason
                  ? frame.reason
                  : parsed.moments.length > 0
                    ? 'OCR 只读取朋友圈窗口可见页；图片、点赞、评论可能缺失'
                    : '朋友圈窗口已打开，但没有识别到正文；可能是图片动态或 OCR 未命中',
            },
          }
        } catch (e) {
          return {
            status: 'failed',
            reason: e instanceof Error ? e.message : '朋友圈遍历失败',
          }
        }
      }
      if (action !== 'chat.switch') {
        return { status: 'unsupported', reason: `OCR 只读驱动不支持动作 ${action}` }
      }
      const title = typeof payload.title === 'string' ? payload.title.trim() : ''
      if (!title) {
        return { status: 'failed', reason: 'chat.switch 需要 title' }
      }
      const resultPath = join(MEDIA_DIR, 'wechat-switch.json')
      const imagePath = join(MEDIA_DIR, 'wechat-switch.png')
      try {
        const frame = await runScript('switch', { title, imagePath, jsonPath: resultPath })
        if (frame.ok !== true || frame.opened !== true) {
          return {
            status: 'failed',
            reason: typeof frame.reason === 'string' ? frame.reason : '未能切换到目标会话',
            data: { title, opened: frame.opened === true },
          }
        }
        // 切换后必须重建基线：否则新会话里的历史消息会被当成新入站消息重复入库。
        baselineDone = false
        previousBlocks = []
        previousChatTitle = null
        return {
          status: 'accepted',
          data: {
            title,
            opened: true,
            method: typeof frame.method === 'string' ? frame.method : 'search',
          },
        }
      } catch (e) {
        return {
          status: 'failed',
          reason: e instanceof Error ? e.message : '切换会话失败',
        }
      }
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
