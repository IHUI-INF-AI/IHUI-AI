/**
 * 生成 tabBar 图标 PNG 文件
 * 小程序 tabBar 图标要求:PNG 格式,建议 81x81px(2x 比例对应 40.5pt 设计稿)
 * 4 个 tab:首页 / 课程 / 直播 / 我的
 * 每个 tab 两个图标:普通(灰色 #999999) + 选中(品牌色 #07c160)
 *
 * 图形使用纯像素绘制(无外部依赖),保持每个 tab 视觉可区分。
 */
import { writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import zlib from 'zlib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(__dirname, '..', 'src', 'assets', 'tabbar')

const SIZE = 81
const COLOR_NORMAL = [153, 153, 153, 255] // #999999
const COLOR_ACTIVE = [7, 193, 96, 255] // #07c160

/** 简易 PNG 编码器(RGBA) */
function encodePNG(width, height, pixels) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0
    pixels.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  const compressed = zlib.deflateSync(raw)
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

function crc32(buf) {
  let table = crc32.table
  if (!table) {
    table = crc32.table = []
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      table[n] = c >>> 0
    }
  }
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

/** 创建空白画布(全透明) */
function makeCanvas() {
  return Buffer.alloc(SIZE * SIZE * 4)
}

/** 设置像素 */
function setPx(buf, x, y, [r, g, b, a]) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) return
  const idx = (y * SIZE + x) * 4
  buf[idx] = r
  buf[idx + 1] = g
  buf[idx + 2] = b
  buf[idx + 3] = a
}

/** 画实心圆 */
function fillCircle(buf, cx, cy, r, color) {
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r * r) setPx(buf, Math.round(cx + x), Math.round(cy + y), color)
    }
  }
}

/** 画圆环 */
function strokeCircle(buf, cx, cy, rOuter, rInner, color) {
  for (let y = -rOuter; y <= rOuter; y++) {
    for (let x = -rOuter; x <= rOuter; x++) {
      const d2 = x * x + y * y
      if (d2 <= rOuter * rOuter && d2 >= rInner * rInner)
        setPx(buf, Math.round(cx + x), Math.round(cy + y), color)
    }
  }
}

/** 画水平线 */
function hLine(buf, y, x0, x1, color) {
  for (let x = x0; x <= x1; x++) setPx(buf, x, y, color)
}

/** 画垂直线 */
function vLine(buf, x, y0, y1, color) {
  for (let y = y0; y <= y1; y++) setPx(buf, x, y, color)
}

/** 画矩形(实心) */
function fillRect(buf, x0, y0, w, h, color) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) setPx(buf, x, y, color)
  }
}

/** 画矩形(空心) */
function strokeRect(buf, x0, y0, w, h, thickness, color) {
  for (let t = 0; t < thickness; t++) {
    hLine(buf, y0 + t, x0, x0 + w - 1, color)
    hLine(buf, y0 + h - 1 - t, x0, x0 + w - 1, color)
    vLine(buf, x0 + t, y0, y0 + h - 1, color)
    vLine(buf, x0 + w - 1 - t, y0, y0 + h - 1, color)
  }
}

/** 画三角形(实心) */
function fillTriangle(buf, p0, p1, p2, color) {
  const minX = Math.max(0, Math.floor(Math.min(p0[0], p1[0], p2[0])))
  const maxX = Math.min(SIZE - 1, Math.ceil(Math.max(p0[0], p1[0], p2[0])))
  const minY = Math.max(0, Math.floor(Math.min(p0[1], p1[1], p2[1])))
  const maxY = Math.min(SIZE - 1, Math.ceil(Math.max(p0[1], p1[1], p2[1])))
  const sign = (a, b, c) => (a[0] - c[0]) * (b[1] - c[1]) - (b[0] - c[0]) * (a[1] - c[1])
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const p = [x + 0.5, y + 0.5]
      const d1 = sign(p, p0, p1)
      const d2 = sign(p, p1, p2)
      const d3 = sign(p, p2, p0)
      const hasNeg = d1 < 0 || d2 < 0 || d3 < 0
      const hasPos = d1 > 0 || d2 > 0 || d3 > 0
      if (!(hasNeg && hasPos)) setPx(buf, x, y, color)
    }
  }
}

/* ===== 各 tab 图形绘制 ===== */

/** 首页:屋顶+方块(房子) */
function drawHome(color) {
  const buf = makeCanvas()
  // 屋顶三角形
  fillTriangle(buf, [40, 12], [10, 36], [70, 36], color)
  // 主体
  strokeRect(buf, 16, 36, 48, 36, 2, color)
  // 门
  fillRect(buf, 34, 52, 12, 20, color)
  return buf
}

/** 课程:书本(打开的书) */
function drawCourse(color) {
  const buf = makeCanvas()
  // 左页
  fillRect(buf, 12, 22, 27, 38, color)
  // 右页
  fillRect(buf, 42, 22, 27, 38, color)
  // 中缝
  fillRect(buf, 39, 22, 3, 38, [255, 255, 255, 255])
  // 书脊横线
  hLine(buf, 32, 14, 38, [255, 255, 255, 255])
  hLine(buf, 40, 14, 38, [255, 255, 255, 255])
  hLine(buf, 48, 14, 38, [255, 255, 255, 255])
  hLine(buf, 32, 44, 67, [255, 255, 255, 255])
  hLine(buf, 40, 44, 67, [255, 255, 255, 255])
  hLine(buf, 48, 44, 67, [255, 255, 255, 255])
  return buf
}

/** 直播:摄像头+三角播放 */
function drawLive(color) {
  const buf = makeCanvas()
  // 摄像头外框
  strokeRect(buf, 12, 24, 42, 36, 3, color)
  // 三角播放
  fillTriangle(buf, [60, 30], [60, 54], [74, 42], color)
  return buf
}

/** 我的:人头像(头+肩) */
function drawUser(color) {
  const buf = makeCanvas()
  // 头
  fillCircle(buf, 40, 28, 12, color)
  // 肩/身体
  fillTriangle(buf, [16, 70], [64, 70], [40, 46], color)
  return buf
}

const tabs = [
  { key: 'home', draw: drawHome },
  { key: 'course', draw: drawCourse },
  { key: 'live', draw: drawLive },
  { key: 'user', draw: drawUser },
]

let total = 0
for (const tab of tabs) {
  const normalPng = encodePNG(SIZE, SIZE, tab.draw(COLOR_NORMAL))
  const activePng = encodePNG(SIZE, SIZE, tab.draw(COLOR_ACTIVE))
  writeFileSync(resolve(outDir, `${tab.key}.png`), normalPng)
  writeFileSync(resolve(outDir, `${tab.key}-active.png`), activePng)
  console.log(`Generated: ${tab.key}.png (${normalPng.length}B), ${tab.key}-active.png (${activePng.length}B)`)
  total += normalPng.length + activePng.length
}
console.log(`All tabBar icons generated. Total: ${total} bytes (~${(total / 1024).toFixed(1)}KB)`)
