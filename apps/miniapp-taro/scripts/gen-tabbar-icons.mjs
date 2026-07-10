/**
 * 生成 tabBar 图标 PNG 文件
 * 小程序 tabBar 图标要求：PNG 格式，建议 81x81px
 * 5 个 tab：首页、课程、直播、AI、我的
 * 每个 tab 两个图标：普通(灰色) + 选中(蓝色)
 */
import { writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import zlib from 'zlib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(__dirname, '..', 'src', 'assets', 'tabbar')

const SIZE = 81
const COLOR_NORMAL = [153, 153, 153]   // #999999
const COLOR_ACTIVE = [0, 122, 255]     // #007aff

/** 生成简单 PNG（纯色圆形图标） */
function createPNG(size, color) {
  const pixels = Buffer.alloc(size * size * 4)
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 4
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx
      const dy = y - cy
      const dist = Math.sqrt(dx * dx + dy * dy)
      const idx = (y * size + x) * 4
      if (dist <= r) {
        pixels[idx] = color[0]
        pixels[idx + 1] = color[1]
        pixels[idx + 2] = color[2]
        pixels[idx + 3] = 255
      } else {
        pixels[idx + 3] = 0
      }
    }
  }
  return encodePNG(size, size, pixels)
}

/** 简易 PNG 编码器（RGBA） */
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
    chunk('IEND', Buffer.alloc(0))
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
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      }
      table[n] = c >>> 0
    }
  }
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

const tabs = ['home', 'course', 'live', 'ai', 'user']

for (const tab of tabs) {
  const normalPng = createPNG(SIZE, COLOR_NORMAL)
  const activePng = createPNG(SIZE, COLOR_ACTIVE)
  writeFileSync(resolve(outDir, `${tab}.png`), normalPng)
  writeFileSync(resolve(outDir, `${tab}-active.png`), activePng)
  console.log(`Generated: ${tab}.png, ${tab}-active.png`)
}

console.log('All tabBar icons generated.')
