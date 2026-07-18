/**
 * 聊天对话气泡绘制工具。
 *
 * 在底图底部叠加对话气泡(user 右对齐蓝色,assistant 左对齐灰色),
 * 用于生成带对话上下文的封面图。基于 sharp + SVG 叠加实现。
 */
import sharp from 'sharp'
import { readFile } from 'node:fs/promises'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface DrawChatImageOptions {
  backgroundImage: string | Buffer
  messages: ChatMessage[]
  /** 输出宽度,默认沿用底图宽度 */
  outputWidth?: number
}

const PADDING = 24
const BUBBLE_MAX_WIDTH_RATIO = 0.7
const BUBBLE_PAD_X = 16
const BUBBLE_PAD_Y = 12
const LINE_HEIGHT = 24
const FONT_SIZE = 18
const USER_COLOR = '#007AFF'
const USER_TEXT = '#FFFFFF'
const ASSISTANT_COLOR = '#E9E9EB'
const ASSISTANT_TEXT = '#000000'

/** 计算字符串显示宽度(中文/日/韩占 2 单位,其余占 1) */
function textUnits(text: string): number {
  let u = 0
  for (const ch of text) {
    u += /[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/.test(ch) ? 2 : 1
  }
  return u
}

/** 按显示宽度换行 */
function wrapText(text: string, maxUnits: number): string[] {
  const lines: string[] = []
  let current = ''
  let units = 0
  for (const ch of text) {
    const u = /[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/.test(ch) ? 2 : 1
    if (units + u > maxUnits && current) {
      lines.push(current)
      current = ch
      units = u
    } else {
      current += ch
      units += u
    }
  }
  if (current) lines.push(current)
  return lines
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

interface BubbleLayout {
  x: number
  y: number
  width: number
  height: number
  lines: string[]
  role: 'user' | 'assistant'
}

function buildBubbleSvg(width: number, height: number, layouts: BubbleLayout[]): string {
  const bubbles = layouts
    .map((b) => {
      const fill = b.role === 'user' ? USER_COLOR : ASSISTANT_COLOR
      const textColor = b.role === 'user' ? USER_TEXT : ASSISTANT_TEXT
      const texts = b.lines
        .map((line, i) => {
          const y = b.y + BUBBLE_PAD_Y + (i + 1) * LINE_HEIGHT - 6
          return `<text x="${b.x + BUBBLE_PAD_X}" y="${y}" font-size="${FONT_SIZE}" font-family="sans-serif" fill="${textColor}">${escapeXml(line)}</text>`
        })
        .join('')
      return `<rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" rx="12" ry="12" fill="${fill}"/>${texts}`
    })
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${bubbles}</svg>`
}

export async function drawChatImage(opts: DrawChatImageOptions): Promise<Buffer> {
  const { backgroundImage, messages, outputWidth } = opts
  const bgSource =
    typeof backgroundImage === 'string' ? await readFile(backgroundImage) : backgroundImage

  const meta = await sharp(bgSource).metadata()
  const originalWidth = meta.width ?? 1080
  const originalHeight = meta.height ?? Math.round((originalWidth * 9) / 16)
  const width = outputWidth ?? originalWidth
  const baseHeight = Math.round((originalHeight * width) / originalWidth)

  if (messages.length === 0) {
    return sharp(bgSource).resize({ width }).png().toBuffer()
  }

  // 计算气泡布局:从底图下方开始向下排列
  const bubbleMaxUnits = Math.floor(
    ((width - PADDING * 2) * BUBBLE_MAX_WIDTH_RATIO - BUBBLE_PAD_X * 2) / (FONT_SIZE / 2),
  )
  const layouts: BubbleLayout[] = []
  let cursorY = baseHeight + PADDING
  for (const msg of messages) {
    const lines = wrapText(msg.content, bubbleMaxUnits)
    const maxLineUnits = lines.length > 0 ? Math.max(...lines.map(textUnits)) : 0
    const bubbleW = Math.min(
      width * BUBBLE_MAX_WIDTH_RATIO,
      maxLineUnits * (FONT_SIZE / 2) + BUBBLE_PAD_X * 2,
    )
    const bubbleH = lines.length * LINE_HEIGHT + BUBBLE_PAD_Y * 2
    const x = msg.role === 'user' ? width - PADDING - bubbleW : PADDING
    layouts.push({ x, y: cursorY, width: bubbleW, height: bubbleH, lines, role: msg.role })
    cursorY += bubbleH + PADDING / 2
  }
  const overlayHeight = cursorY
  const extendBottom = Math.max(0, overlayHeight - baseHeight)
  const svg = buildBubbleSvg(width, overlayHeight, layouts)

  // 扩展底图画布并在新增区域叠加气泡 SVG
  return sharp(bgSource)
    .resize({ width })
    .extend({
      top: 0,
      bottom: extendBottom,
      left: 0,
      right: 0,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer()
}
