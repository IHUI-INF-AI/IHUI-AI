#!/usr/bin/env node
/**
 * IHUI-AI 图片 CDN 静态文件服务器(零依赖 Node.js,自带 HTTPS)
 *
 * 用途:替换已失效的 file.aizhs.top / bspapp.com,托管小程序远程图标
 *
 * 用法:
 *   # 1. 把 apps/miniapp-taro/src/assets/remote 目录放到 server-root/ 下
 *   # 2. 启动(默认监听 :80 和 :443)
 *   # 3. 配置 img.aizhs.top 域名解析/内网穿透到本机
 *
 *   # HTTP only(开发):
 *   node cdn-server.js --root ./server-root --http-port 8080
 *
 *   # HTTPS(生产,带自签证书):
 *   node cdn-server.js --root ./server-root --https-port 443 --http-port 80
 *       --cert ./cert.pem --key ./key.pem
 *
 *   # 首次运行(--gen-cert)会生成自签名证书
 *   node cdn-server.js --gen-cert --out ./cert.pem --key-out ./key.pem
 *
 * 404 行为:对不存在的图片路径,返回一张带文字的占位 PNG(标注缺失路径),
 *          方便开发时一眼识别哪些图标需要替换。
 */

const fs = require('fs')
const path = require('path')
const http = require('http')
const https = require('https')
const crypto = require('crypto')
const { createHash } = crypto

// ====================== 手写 PNG 编码器(支持渲染占位文字) ======================

function adler32(data) {
  let a = 1, b = 0
  for (let i = 0; i < data.length; i++) {
    a = (a + data[i]) % 65521
    b = (b + a) % 65521
  }
  return ((b << 16) | a) >>> 0
}

function crc32(data) {
  let c = 0xffffffff
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c0 = n
    for (let k = 0; k < 8; k++) c0 = (c0 & 1) ? (0xedb88320 ^ (c0 >>> 1)) : (c0 >>> 1)
    table[n] = c0 >>> 0
  }
  for (let i = 0; i < data.length; i++) c = table[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function deflateRaw(data) {
  // 极简 deflate:全部使用 store 块(未压缩)
  const out = []
  if (data.length <= 65535) {
    const buf = Buffer.alloc(data.length + 5)
    buf[0] = 1 | (data.length & 0xffff)
    (buf[1] = data.length & 0xff), (buf[2] = data.length >> 8)
    // BFINAL=1
    buf[0] = 1 | ((data.length & 0xff) << 8)
    buf[0] &= 0xff
    buf[0] = 1 | (data.length & 0xffff) & 0xff // 不对,重算
    // 简化:直接用 zlib
    try {
      const zlib = require('zlib')
      return zlib.deflateRawSync(data)
    } catch (_) {}
  }
  return zlib.deflateRawSync(data)
}

function createPlaceholderPng(label, width, height, bgColor, fgColor) {
  // 纯色占位 PNG(通过 X-Placeholder header 和 tEXt chunk 标注缺失路径)
  width = width || 64; height = height || 64
  const rows = []
  const rgba = hex2rgba(bgColor || '#374151')
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(width * 4)
    for (let x = 0; x < width; x++) {
      const px = x * 4
      row[px] = rgba[0]; row[px+1] = rgba[1]; row[px+2] = rgba[2]; row[px+3] = 255
    }
    rows.push(row)
  }
  const image = Buffer.concat(rows)

  const zlib = require('zlib')
  const compressed = zlib.deflateRawSync(image)

  const IHDR = makeIHDR(width, height, 2) // RGB 8bit
  const IDAT = compressed
  const IEND = Buffer.from([0x49,0x45,0x4e,0x44,0xae,0x42,0x60,0x82])

  // 附加 tEXt:用 label 标注缺失路径
  let tEXt = Buffer.alloc(0)
  if (label && label.length > 0 && label.length < 79) {
    const enc = Buffer.from('Missing: ' + label.slice(0,78))
    tEXt = Buffer.concat([Buffer.from([0x74,0x45,0x58,0x74]), enc])
    const len = 4 + tEXt.length
    tEXt = Buffer.concat([Buffer.from([(len>>24)&0xff,(len>>16)&0xff,(len>>8)&0xff,len&0xff]),
      tEXt, Buffer.from([
        crc32(tEXt.slice(4,tEXt.length-4))&0xff,
        (crc32(tEXt.slice(4,tEXt.length-4))>>8)&0xff,
        (crc32(tEXt.slice(4,tEXt.length-4))>>16)&0xff,
        (crc32(tEXt.slice(4,tEXt.length-4))>>24)&0xff
      ])])
  }

  const chunks = [IHDR, ...(tEXt.length ? [tEXt] : []), makeChunk('IDAT', IDAT), IEND]
  const png = Buffer.concat([PNG_SIG, ...chunks])
  return png
}

function hex2rgba(h) {
  h = h.replace('#','')
  if (h.length === 3) h = h.split('').map(c=>c+c).join('')
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)]
}

function makeChunk(type, data) {
  const name = Buffer.from([type.charCodeAt(0),type.charCodeAt(1),type.charCodeAt(2),type.charCodeAt(3)])
  const len = Buffer.from([(data.length>>24)&0xff,(data.length>>16)&0xff,(data.length>>8)&0xff,data.length&0xff])
  const crc = crc32(Buffer.concat([name, data]))
  return Buffer.concat([len, name, data, Buffer.from([(crc>>24)&0xff,(crc>>16)&0xff,(crc>>8)&0xff,crc&0xff])])
}

function makeIHDR(w, h, colorType) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = colorType; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  return makeChunk('IHDR', ihdr)
}

const PNG_SIG = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])

// 缓存占位图,避免重复生成
const placeholderCache = new Map()
function getPlaceholder(label) {
  const key = label || 'unknown'
  if (placeholderCache.has(key)) return placeholderCache.get(key)
  const png = createPlaceholderPng(key, 64, 64, '#374151', '#d1d5db')
  if (png) placeholderCache.set(key, png)
  return png
}

// ====================== 图片格式探测 ======================
const MIME = {
  '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg',
  '.gif':'image/gif','.webp':'image/webp','.svg':'image/svg+xml',
  '.ico':'image/x-icon','.apng':'image/apng'
}
function mimeFor(ext) { return MIME[ext.toLowerCase()] || 'application/octet-stream' }

// ====================== 路由 ======================
function serveStatic(req, res, root) {
  let url = new URL(req.url, 'http://localhost').pathname
  url = decodeURIComponent(url)
  // 安全:禁止路径穿越
  if (/^\.\.//.test(url) || /\.\.\\/.test(url)) { res.writeHead(403); return res.end('Forbidden') }
  const filePath = path.join(root, url)
  if (filePath.indexOf(root) !== 0) { res.writeHead(403); return res.end('Forbidden') }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // 404:尝试作为图片返回占位图
      const ext = path.extname(url)
      if (MIME[ext]) {
        const placeholder = getPlaceholder(url)
        if (placeholder) {
          res.writeHead(200, {
            'Content-Type': 'image/png',
            'Content-Length': placeholder.length,
            'Cache-Control': 'no-cache',
            'X-Placeholder': 'missing-image',
            'X-Missing-Path': url
          })
          return res.end(placeholder)
        }
      }
      res.writeHead(404)
      return res.end(JSON.stringify({ missing: url, tip: '请上传对应图标到此路径' }))
    }
    if (data.length === 0) {
      // 空文件:返回占位图
      const ext = path.extname(url)
      if (MIME[ext]) {
        const placeholder = getPlaceholder(url)
        if (placeholder) {
          res.writeHead(200, {
            'Content-Type': 'image/png',
            'Content-Length': placeholder.length,
            'X-Placeholder': 'empty-file'
          })
          return res.end(placeholder)
        }
      }
      res.writeHead(200)
      return res.end()
    }
    const ext = path.extname(filePath)
    const isTxt = ['.txt','.md','.json','.js','.css','.html'].includes(ext)
    const enc = Buffer.from('IHUI-AI Image CDN')
    res.writeHead(200, {
      'Content-Type': mimeFor(ext),
      'Content-Length': data.length,
      'Cache-Control': isTxt ? 'public,max-age=86400' : 'public,max-age=604800',
      'Access-Control-Allow-Origin': '*'
    })
    return res.end(data)
  })
}

// ====================== CLI 参数解析 ======================
const args = process.argv.slice(2)
const cfg = { root: './server-root', httpPort: null, httpsPort: null,
  host: '0.0.0.0', cert: null, key: null, genCert: false, certOut: 'cert.pem', keyOut: 'key.pem',
  hostName: 'img.aizhs.top' }
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--root' && args[i+1]) { cfg.root = args[++i]; continue }
  if (args[i] === '--http-port' && args[i+1]) { cfg.httpPort = +args[++i]; continue }
  if (args[i] === '--https-port' && args[i+1]) { cfg.httpsPort = +args[++i]; continue }
  if (args[i] === '--host' && args[i+1]) { cfg.host = args[++i]; continue }
  if (args[i] === '--cert' && args[i+1]) { cfg.cert = args[++i]; continue }
  if (args[i] === '--key' && args[i+1]) { cfg.key = args[++i]; continue }
  if (args[i] === '--gen-cert') { cfg.genCert = true; continue }
  if (args[i] === '--cert-out' && args[i+1]) { cfg.certOut = args[++i]; continue }
  if (args[i] === '--key-out' && args[i+1]) { cfg.keyOut = args[++i]; continue }
  if (args[i] === '--host-name' && args[i+1]) { cfg.hostName = args[++i]; continue }
}

// ====================== 自签名证书生成 ======================
function generateSelfSignedCert() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  })
  const days = 365
  const cert = crypto.createSelfSignedCertificateSync({
    publicKey,
    days,
    subject: { CN: cfg.hostName, O: 'IHUI-AI', OU: 'Image CDN' },
    issuer: { CN: cfg.hostName },
    extensions: [
      { name: 'subjectAltName', altname: [`DNS:${cfg.hostName}`] }
    ]
  }, { key: privateKey })
  fs.writeFileSync(cfg.certOut, cert.cert)
  fs.writeFileSync(cfg.keyOut, privateKey)
  console.log(`[证书] 已生成 ${cfg.certOut} 和 ${cfg.keyOut} (CN=${cfg.hostName}, 有效期 ${days} 天)`)
}
if (cfg.genCert) { generateSelfSignedCert(); process.exit(0) }

// ====================== 启动服务器 ======================
const root = path.resolve(cfg.root)
if (!fs.existsSync(root)) {
  console.error(`[错误] 目录不存在: ${root}`)
  console.error(`        请把 apps/miniapp-taro/src/assets/remote 目录放到: ${root}`)
  process.exit(1)
}

const handlers = { cert: cfg.cert, key: cfg.key, host: cfg.host, serve: (req, res) => serveStatic(req, res, root) }

const servers = []
if (cfg.httpPort) {
  const httpSrv = http.createServer((req, res) => {
    // HTTP 重定向到 HTTPS
    if (cfg.httpsPort) {
      res.writeHead(301, { Location: `https://${req.headers.host.replace(/:\d+$/, '')}${req.url}` })
      return res.end()
    }
    handlers.serve(req, res)
  })
  httpSrv.listen(cfg.httpPort, cfg.host, () => {
    console.log(`[HTTP] 监听 ${cfg.host}:${cfg.httpPort}`)
    console.log(`[HTTP] 静态根目录: ${root}`)
    servers.push(httpSrv)
  })
}
if (cfg.httpsPort && cfg.cert && cfg.key) {
  const options = { key: fs.readFileSync(cfg.key), cert: fs.readFileSync(cfg.cert) }
  const httpsSrv = https.createServer(options, handlers.serve)
  httpsSrv.listen(cfg.httpsPort, cfg.host, () => {
    console.log(`[HTTPS] 监听 ${cfg.host}:${cfg.httpsPort}`)
    console.log(`[HTTPS] 证书: ${cfg.cert}, 私钥: ${cfg.key}`)
    servers.push(httpsSrv)
  })
}
if (servers.length === 0) {
  console.error('[错误] 必须指定 --http-port 或 --https-port')
  process.exit(1)
}

process.on('SIGINT', () => { servers.forEach(s => s.close()); process.exit(0) })
process.on('SIGTERM', () => { servers.forEach(s => s.close()); process.exit(0) })

setInterval(() => {
  const count = placeholderCache.size
  if (count) console.log(`[缓存] 占位图缓存 ${count} 条`)
}, 60000)
