#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 一次性取证工具:从 Electron asar 里按路径读文件、列清单、正则捞内容。全程只读,不写竞品目录。
// 用法:
//   node asar-read.mjs <app.asar> --list [路径正则]
//   node asar-read.mjs <app.asar> --get /package.json
//   node asar-read.mjs <app.asar> --grep <内容正则> [--files-only]
// 头格式(与 asar 官方一致):前 8 字节是 pickle 前言,第 4..7 字节给 header 块大小;
// header JSON 起于偏移 16(其前有 pickle 长度/标志位),数据区起于 8 + headerSize。
import fs from 'node:fs'
import path from 'node:path'

const [,, ASAR, MODE, ...REST] = process.argv
if (!ASAR || !MODE) {
  console.error('用法: asar-read.mjs <asar> --list [re] | --get <path> | --grep <re>')
  process.exit(2)
}

const fd = fs.openSync(ASAR, 'r')
const pre = Buffer.alloc(8)
fs.readSync(fd, pre, 0, 8, 0)
const headerSize = pre.readUInt32LE(4)
const hb = Buffer.alloc(headerSize)
fs.readSync(fd, hb, 0, headerSize, 8)
const strLen = hb.readUInt32LE(0)
const tree = JSON.parse(hb.subarray(8, 8 + strLen).toString('utf8').replace(/\0+$/, ''))
const DATA_START = 8 + headerSize

function flatten(node, prefix, acc) {
  for (const [k, v] of Object.entries(node.files || {})) {
    const fp = prefix + '/' + k
    if (v && v.files) flatten(v, fp, acc)
    else if (v && v.size != null) acc.push({ path: fp, size: Number(v.size), offset: Number(v.offset), unpacked: !!v.unpacked })
  }
  return acc
}
const all = flatten(tree, '', [])

function readEntry(f) {
  if (f.unpacked) {
    const p = path.join(path.dirname(ASAR), path.basename(ASAR, '.asar') + '.unpacked', f.path)
    return fs.readFileSync(p)
  }
  const buf = Buffer.alloc(f.size)
  fs.readSync(fd, buf, 0, f.size, DATA_START + f.offset)
  return buf
}

if (MODE === '--list') {
  const re = REST[0] ? new RegExp(REST[0], 'i') : null
  const hit = all.filter((f) => !re || re.test(f.path))
  const lim = Number(process.env.ASAR_LIMIT || 400)
  for (const f of hit.slice(0, lim)) console.log(`${(f.size / 1024).toFixed(0)}K\t${f.unpacked ? 'U' : ' '}\t${f.path}`)
  console.log(`# 命中 ${hit.length} / 总 ${all.length} (打印前 ${Math.min(lim, hit.length)})`)
} else if (MODE === '--get') {
  const f = all.find((x) => x.path === REST[0])
  if (!f) { console.error(`# 不在清单里: ${REST[0]}`); process.exit(1) }
  process.stdout.write(readEntry(f))
} else if (MODE === '--grep') {
  const re = new RegExp(REST[0], 'g')
  const max = Number(process.env.ASAR_MAX || 80)
  const cands = all.filter((f) => f.size > 0 && f.size < 120 * 1024 * 1024 && /\.(js|cjs|mjs|json|css|html|properties|yaml|yml|md)$/i.test(f.path))
  let printed = 0
  for (const f of cands) {
    let buf
    try { buf = readEntry(f) } catch { continue }
    const text = buf.toString('utf8')
    // 文本型判据:控制字符比例过高就跳过(二进制/minified wasm 等)
    let ctl = 0
    for (let i = 0; i < Math.min(buf.length, 4096); i++) if (buf[i] < 9) ctl++
    if (ctl > 40) continue
    const hits = text.match(re)
    if (!hits || !hits.length) continue
    const uniq = [...new Set(hits)].slice(0, 12)
    console.log(`\n[${uniq.length}/${hits.length}] ${f.path}`)
    if (process.env.ASAR_FILES_ONLY !== '1') for (const u of uniq) console.log('   ', u.slice(0, 160))
    if (++printed >= max) { console.log(`# 达到 ${max} 文件上限,停`); break }
  }
  console.log(`\n# 扫了 ${cands.length} 个文本型条目,命中 ${printed} 个文件`)
} else {
  console.error('未知模式 ' + MODE)
  process.exit(2)
}
fs.closeSync(fd)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
