// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//
// 微信 4.x 只读 UIA 驱动：不注入、不读内存、不改微信文件。
// 依赖 tools/wechat-uia.ps1 遍历朋友圈 UIA 控件树，把结构化帧写到 -OutFile。
// 解析保持保守：只认帧里真实出现的文字与数量，不折算时间戳、不编造点赞/图片链接。

import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const SCRIPT = process.env.BRIDGE_UIA_SCRIPT ?? join(ROOT, '..', 'tools', 'wechat-uia.ps1')
const POWERSHELL =
  process.env.BRIDGE_OCR_POWERSHELL ??
  'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
const UIA_DIR = process.env.BRIDGE_UIA_DIR ?? join(process.cwd(), '.bridge-uia')
const RESULT = join(UIA_DIR, 'wechat-uia-moments.json')
/** 不碰微信的强制失败开关：仅用于验证桥到 OCR 的回退路径；调用时读取，便于测试切换。 */
function forceFail() {
  return process.env.BRIDGE_UIA_FORCE_FAIL === '1'
}

const STOP_REASONS = new Set([
  'occluded',
  'scroll-stalled',
  'page-limit',
  'no-more-data',
  'error',
  'no-content',
])

/** 时间行：只保留界面原文，不做相对时间到时间戳的换算。 */
const TIME_PATTERNS = [
  /^\d+\s*分钟前/u,
  /^\d+\s*小时前/u,
  /^刚刚$/u,
  /^(昨天|今天|前天)/u,
  /^星期[一二三四五六日天]/u,
  /^\d{1,2}月\d{1,2}日/u,
  /^\d{1,2}[:：]\d{2}/u,
  /^\d{4}[-/年]\d{1,2}[-/月]\d{1,2}/u,
]

function textOfLine(value) {
  if (typeof value === 'string') return value.trim()
  if (value && typeof value === 'object' && typeof value.text === 'string') return value.text.trim()
  return ''
}

function linesOf(item) {
  if (Array.isArray(item?.lines)) {
    const lines = item.lines.map(textOfLine).filter(Boolean)
    if (lines.length > 0) return lines
  }
  const name = typeof item?.name === 'string' ? item.name : ''
  return name
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function isTimeLine(text) {
  return TIME_PATTERNS.some((pattern) => pattern.test(text))
}

/** 图片数量：只认明确的「包含 N 张图片」/「N 张图片」计数行，不从其他文字猜数量。 */
function imageCountOf(text) {
  const withInclude = /包含\s*(\d+)\s*张图片/u.exec(text)
  const match = withInclude ?? /(\d+)\s*张图片/u.exec(text)
  if (!match) return null
  const count = Number(match[1])
  return Number.isFinite(count) && count >= 0 ? count : null
}

/** 作者首行必须非时间行、非图片行、非评论标记，长度合理且不含换行。 */
function isPlausibleAuthor(text) {
  if (!text || text.length > 24 || text.includes('\n')) return false
  if (isTimeLine(text)) return false
  if (imageCountOf(text) !== null) return false
  if (/^评论/u.test(text)) return false
  return true
}

function childText(child) {
  const name = textOfLine(child?.name)
  const childLines = Array.isArray(child?.lines)
    ? child.lines.map(textOfLine).filter(Boolean)
    : []
  if (name) return name
  return childLines.join('\n').trim()
}

/** 非动态噪声文案：空白封面节点、「余下 N 条」、「下一条动态」、评论区标题本身。 */
function isNoiseText(text) {
  return (
    /^下一条动态/u.test(text) || /^余下\s*\d+\s*条/u.test(text) || /^评论区\s*$/u.test(text)
  )
}

const NOISE_ROLES = new Set(['cover', 'noise', 'next', 'remaining', 'separator', 'marker'])
const BODY_ROLES = new Set(['moment', 'body', 'content'])
const AUTHOR_ROLES = new Set(['author', 'name', 'user'])
const MEDIA_ROLES = new Set(['media', 'image'])
const TIME_ROLES = new Set(['time', 'date'])
const COMMENT_ROLES = new Set(['comment', 'comment-item'])

function childRole(child) {
  return String(child?.role ?? '').trim().toLowerCase()
}

/** 子控件槽位：有 role 优先按 role 判；没有 role 再按 className 文案规则兜底。 */
function classifyChild(child) {
  const role = childRole(child)
  if (role) {
    if (NOISE_ROLES.has(role)) return 'noise'
    if (BODY_ROLES.has(role)) return 'body'
    if (AUTHOR_ROLES.has(role)) return 'author'
    if (MEDIA_ROLES.has(role)) return 'media'
    if (TIME_ROLES.has(role)) return 'time'
    if (COMMENT_ROLES.has(role)) return 'comment'
  }
  const cls = String(child?.className ?? '')
  if (/comment|评论/i.test(cls)) return 'comment'
  if (/media|图片/i.test(cls)) return 'media'
  if (/time|时间|日期/i.test(cls)) return 'time'
  if (/user|name|昵称/i.test(cls)) return 'author'
  if (/body|正文|content/i.test(cls)) return 'body'
  return 'other'
}

/** 评论区节点：role=marker、comment-section 类名或文案「评论区」本身；其下子树才是评论。 */
function isCommentSection(child) {
  const cls = String(child?.className ?? '')
  return childRole(child) === 'marker' || /comment-section/i.test(cls) || childText(child) === '评论区'
}

/** 评论只取评论区子树内的条目原文；正文、「余下0条」「下一条动态」绝不当评论。 */
function commentTextsOf(item) {
  const texts = []
  const push = (text) => {
    if (text && !texts.includes(text)) texts.push(text)
  }
  const walk = (nodes, inSection) => {
    for (const node of nodes ?? []) {
      if (!node || typeof node !== 'object') continue
      if (isCommentSection(node)) {
        walk(node.children ?? [], true)
        continue
      }
      const slot = classifyChild(node)
      const text = childText(node)
      if (isNoiseText(text)) continue
      if (slot === 'comment') {
        push(text)
        continue
      }
      walk(node.children ?? [], inSection)
    }
  }
  walk(item?.children ?? [], false)
  return texts
}

/** 跨页稳定 id：author|content|timeText|imageCount 的 sha256 前 12 位。 */
function momentIdOf(author, content, timeText, imageCount) {
  const key = [author, content, timeText, String(imageCount ?? 0)].join('|')
  return createHash('sha256').update(key).digest('hex').slice(0, 12)
}

/**
 * 单条动态的字段可得性派生。UIA 只读控件文本：
 * media 只有图片数量、没有二进制或链接；likes 界面没有点赞控件可读；
 * comments 仅在真实读到评论条目时为 true；authorIdentity 昵称无法映射 wxid。
 */
function deriveUiaMomentFields(commentTexts) {
  const comments = Array.isArray(commentTexts) && commentTexts.length > 0
  const missing = ['只有图片数量，没有二进制或链接', '界面没有点赞控件可读', '昵称无法映射 wxid']
  if (!comments) missing.push('评论区未读到条目')
  return {
    media: false,
    likes: false,
    comments,
    authorIdentity: false,
    reason: missing.join('；'),
  }
}

/** 从一组行里抽时间行/图片计数行/作者首行，剩余行拼正文；已拿到的槽位不覆盖。 */
function extractFromLines(lines, slots) {
  const metaLines = new Set()
  let { author, timeText, imageCount } = slots
  for (const line of lines) {
    const count = imageCountOf(line)
    if (count !== null) {
      imageCount ??= count
      metaLines.add(line)
      continue
    }
    if (isTimeLine(line)) {
      if (!timeText) timeText = line
      metaLines.add(line)
    }
  }
  if (!author) {
    const candidate = lines.find((line) => !metaLines.has(line)) ?? ''
    if (isPlausibleAuthor(candidate)) author = candidate
  }
  const rest = lines.filter((line) => !metaLines.has(line) && !(author && line === author))
  return { author, timeText, imageCount, content: rest.join('\n').trim() }
}

/** 把一帧 items[] 解析成动态列表；封面/噪声节点与脏输入逐条跳过，不让单条坏数据拖垮整帧。 */
function parseMoments(frame) {
  const items = Array.isArray(frame?.items) ? frame.items : []
  const moments = []
  const seen = new Set()
  for (const [index, rawItem] of items.entries()) {
    if (!rawItem || typeof rawItem !== 'object') continue
    if (NOISE_ROLES.has(childRole(rawItem))) continue
    const lines = linesOf(rawItem)
    const children = Array.isArray(rawItem.children) ? rawItem.children : []
    let author = ''
    let timeText = ''
    let imageCount = null
    const bodyParts = []
    const otherParts = []
    const commentTexts = commentTextsOf(rawItem)
    const commentSet = new Set(commentTexts)
    for (const child of children) {
      if (!child || typeof child !== 'object') continue
      const slot = classifyChild(child)
      const text = childText(child)
      if (slot === 'noise' || isNoiseText(text)) continue
      if (slot === 'comment') continue
      if (slot === 'media') {
        const count = imageCountOf(text)
        if (count !== null) imageCount ??= count
        continue
      }
      if (slot === 'time') {
        if (text && !timeText) timeText = text
        continue
      }
      if (slot === 'author') {
        if (!author && text && isPlausibleAuthor(text)) author = text
        continue
      }
      if (slot === 'body') {
        if (text) bodyParts.push(text)
        continue
      }
      if (text) otherParts.push(text)
    }
    // 子控件缺槽位时，从 item 行兜底认时间行/图片计数行；已拿到的槽位不覆盖。
    for (const line of lines) {
      const count = imageCountOf(line)
      if (count !== null) {
        imageCount ??= count
        continue
      }
      if (isTimeLine(line) && !timeText) timeText = line
    }
    const sourceRaw = bodyParts.length > 0 ? bodyParts : otherParts.length > 0 ? otherParts : lines
    const sourceLines = sourceRaw
      .join('\n')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    const candidateLines = sourceLines.filter((line) => !commentSet.has(line) && !isNoiseText(line))
    const extracted = extractFromLines(candidateLines, { author, timeText, imageCount })
    author = extracted.author
    timeText = extracted.timeText
    imageCount = extracted.imageCount
    const content = extracted.content
    if (!content && commentTexts.length === 0 && (imageCount ?? 0) === 0) continue
    const id = momentIdOf(author, content, timeText, imageCount)
    if (seen.has(id)) continue
    seen.add(id)
    const fields = deriveUiaMomentFields(commentTexts)
    moments.push({
      id,
      authorId: null,
      authorName: author,
      content,
      mediaUrls: [],
      createdAt: null,
      source: 'uia',
      page: Number(rawItem.page) || index + 1,
      authorResolved: false,
      comments: fields.comments,
      timeText,
      imageCount,
      commentTexts,
    })
  }
  return moments
}

function deriveStopReason({ frameStopReason, pages, maxPages, momentCount }) {
  if (frameStopReason && STOP_REASONS.has(frameStopReason)) return frameStopReason
  const limit = Number(maxPages) || 3
  if (Number.isFinite(pages) && pages >= limit) return 'page-limit'
  if (pages > 0 && (momentCount ?? 0) === 0) return 'no-content'
  return 'no-more-data'
}

function runScript(maxPages) {
  const args = [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    SCRIPT,
    '-Mode',
    'moments',
    '-MaxPages',
    String(maxPages),
    '-OutFile',
    RESULT,
  ]
  return new Promise((resolve, reject) => {
    execFile(
      POWERSHELL,
      args,
      { timeout: 180_000, maxBuffer: 8 * 1024 * 1024, windowsHide: true },
      async (error, _stdout, stderr) => {
        try {
          await mkdir(dirname(RESULT), { recursive: true })
          const raw = await readFile(RESULT, 'utf8')
          const parsed = JSON.parse(raw)
          if (!parsed || typeof parsed !== 'object') throw new Error('UIA 返回非对象')
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

export const __test__ = {
  textOfLine,
  linesOf,
  isTimeLine,
  imageCountOf,
  isPlausibleAuthor,
  isNoiseText,
  classifyChild,
  commentTextsOf,
  extractFromLines,
  momentIdOf,
  deriveUiaMomentFields,
  parseMoments,
  deriveStopReason,
}

export async function createDriver() {
  return {
    async status() {
      return {
        online: true,
        selfWxid: 'uia:weixin',
        mode: 'uia-readonly',
        reason: '只读朋友圈控件树，不轮询会话、不发送',
      }
    },

    async action(action, payload = {}) {
      if (action !== 'moment.fetch') {
        return { status: 'unsupported', reason: `UIA 只读驱动不支持动作 ${action}` }
      }
      const maxPages = Math.min(Math.max(Number(payload.maxPages ?? 3) || 3, 1), 30)
      if (forceFail()) {
        return {
          status: 'failed',
          reason: 'BRIDGE_UIA_FORCE_FAIL=1 强制失败，用于验证回退路径',
          stopReason: 'error',
          data: { forced: true, stopReason: 'error' },
        }
      }
      let frame
      try {
        frame = await runScript(maxPages)
      } catch (e) {
        return {
          status: 'failed',
          reason: e instanceof Error ? e.message : '朋友圈 UIA 遍历失败',
          stopReason: 'error',
          data: { stopReason: 'error' },
        }
      }
      if (frame.ok !== true) {
        return {
          status: 'failed',
          reason: typeof frame.reason === 'string' ? frame.reason : '朋友圈 UIA 遍历失败',
          stopReason: STOP_REASONS.has(frame.stopReason) ? frame.stopReason : 'error',
          data: { stopReason: STOP_REASONS.has(frame.stopReason) ? frame.stopReason : 'error' },
        }
      }
      const moments = parseMoments(frame)
      const pages = Array.isArray(frame.pages) ? frame.pages.length : Number(frame.pages) || 0
      const stopReason = deriveStopReason({
        frameStopReason: frame.stopReason,
        pages,
        maxPages,
        momentCount: moments.length,
      })
      const limitReached = frame.limitReached === true || stopReason === 'page-limit'
      const occludedBy =
        typeof frame.occludedBy === 'string' && frame.occludedBy ? frame.occludedBy : null
      return {
        status: 'accepted',
        data: {
          paging: 'driver',
          source: 'uia',
          pages,
          moments,
          partial: stopReason === 'page-limit',
          stopReason,
          limitReached,
          occludedBy,
          reason:
            typeof frame.reason === 'string' && frame.reason
              ? frame.reason
              : 'UIA 只读控件文本：只有图片数量，没有二进制或链接；界面没有点赞控件可读；昵称无法映射 wxid',
        },
      }
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
