// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D198「复制为图片」的两条落盘链路(2026-09-30 立):
// - svgElementToPngBlob:mermaid 渲染成功的 <svg> → 克隆定尺寸 → 序列化 → Image → canvas → PNG Blob;
// - codeTextToPngBlob:代码块文本逐行 canvas 绘制(单色等宽,超宽行按字符折行)。
// 两者只产出 Blob,剪贴板写入(ClipboardItem)由调用方完成 —— jsdom/happy-dom 无该 API,
// 分层后单测可各自 mock,互不牵连。不引入 html2canvas/dom-to-image 等第三方(票面零命中即基线)。

interface SvgToPngOptions {
  /** 画布底色:mermaid 输出透明背景,不填底色时深色聊天背景上会发黑 */
  background?: string
  /** 放大倍率,默认 2x 保证清晰度 */
  scale?: number
}

/** 量取 svg 的显示尺寸;测量全不可用时兜底 300×150(与浏览器默认替换元素尺寸一致) */
function measureSvg(svg: SVGSVGElement): { width: number; height: number } {
  const rect = typeof svg.getBoundingClientRect === 'function' ? svg.getBoundingClientRect() : null
  const width = Math.round(svg.clientWidth || rect?.width || 300)
  const height = Math.round(svg.clientHeight || rect?.height || 150)
  return { width: Math.max(1, width), height: Math.max(1, height) }
}

export async function svgElementToPngBlob(
  svg: SVGSVGElement,
  options: SvgToPngOptions = {},
): Promise<Blob> {
  const { background = '#ffffff', scale = 2 } = options
  const { width, height } = measureSvg(svg)

  // 克隆并落定像素尺寸:svg 原件是 width=100% + max-width 样式,直接序列化进 Image
  // 会因百分比宽度得到不确定的内在尺寸;同时去掉 style,避免 max-width 把绘制压扁。
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))
  clone.removeAttribute('style')

  const serialized = new XMLSerializer().serializeToString(clone)
  const url = URL.createObjectURL(new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('copy-as-image: svg 加载失败'))
      img.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = width * scale
    canvas.height = height * scale
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('copy-as-image: canvas 2d 上下文不可用')
    ctx.fillStyle = background
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return await canvasToPngBlob(canvas)
  } finally {
    URL.revokeObjectURL(url)
  }
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('copy-as-image: canvas.toBlob 返回空'))
    }, 'image/png')
  })
}

export interface CodeToPngOptions {
  /** 深色主题底色/前景色(与 markdown-stream 代码块 zinc 色阶对齐) */
  dark?: boolean
}

const CODE_FONT_SIZE = 14
const CODE_LINE_HEIGHT = 20
const CODE_PADDING = 16
const CODE_MAX_IMAGE_WIDTH = 1200
const CODE_MIN_IMAGE_WIDTH = 160
const MONO_FONT_STACK =
  'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace'
const CODE_BG_LIGHT = '#f4f4f5' // zinc-100
const CODE_BG_DARK = '#09090b' // zinc-950
const CODE_FG_LIGHT = '#18181b' // zinc-900
const CODE_FG_DARK = '#f4f4f5' // zinc-100

export async function codeTextToPngBlob(
  code: string,
  options: CodeToPngOptions = {},
): Promise<Blob> {
  const { dark = false } = options
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('copy-as-image: canvas 2d 上下文不可用')

  const font = `${CODE_FONT_SIZE}px ${MONO_FONT_STACK}`
  ctx.font = font
  const probe = ctx.measureText('M')
  const charWidth = probe?.width || CODE_FONT_SIZE * 0.6
  // 超宽行按字符折行(等宽字体字符等宽,切片即对齐),图片宽度封顶防 canvas 超限
  const maxCharsPerLine = Math.max(
    1,
    Math.floor((CODE_MAX_IMAGE_WIDTH - CODE_PADDING * 2) / charWidth),
  )
  const lines = code.split('\n')
  const folded: string[] = []
  for (const line of lines) {
    if (line.length <= maxCharsPerLine) {
      folded.push(line)
      continue
    }
    for (let i = 0; i < line.length; i += maxCharsPerLine) {
      folded.push(line.slice(i, i + maxCharsPerLine))
    }
  }

  const longest = folded.reduce((max, line) => Math.max(max, ctx.measureText(line).width), 0)
  const width = Math.ceil(
    Math.min(Math.max(longest + CODE_PADDING * 2, CODE_MIN_IMAGE_WIDTH), CODE_MAX_IMAGE_WIDTH),
  )
  const height = folded.length * CODE_LINE_HEIGHT + CODE_PADDING * 2
  // 注意:重设 canvas 尺寸会重置 2d 上下文状态,字体必须在置尺寸之后重新赋值
  canvas.width = width
  canvas.height = height
  ctx.font = font
  ctx.fillStyle = dark ? CODE_BG_DARK : CODE_BG_LIGHT
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = dark ? CODE_FG_DARK : CODE_FG_LIGHT
  ctx.textBaseline = 'top'
  folded.forEach((line, i) => {
    ctx.fillText(line, CODE_PADDING, CODE_PADDING + i * CODE_LINE_HEIGHT)
  })
  return await canvasToPngBlob(canvas)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
