// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import assert from 'node:assert/strict'
import test from 'node:test'
import zlib from 'node:zlib'

import { buildStoreZip, run, zipPathFor } from '../doubao-build-import.mjs'

/** 最小独立 store-ZIP 读回：从 local header 取文件名与数据，验 CRC（不复用写出器的中央目录逻辑）。 */
function readBack(zip) {
  assert.equal(zip.readUInt32LE(0), 0x04034b50, 'local header 签名')
  const nameLen = zip.readUInt16LE(26)
  const extraLen = zip.readUInt16LE(28)
  const name = zip.subarray(30, 30 + nameLen).toString('utf8')
  const crc = zip.readUInt32LE(14)
  const compSize = zip.readUInt32LE(18)
  const rawSize = zip.readUInt32LE(22)
  assert.equal(zip.readUInt16LE(8), 0, 'store 模式(compression=0)')
  const dataStart = 30 + nameLen + extraLen
  const data = zip.subarray(dataStart, dataStart + compSize)
  assert.equal(rawSize, compSize, 'store 下压缩前后等长')
  assert.equal(zlib.crc32(data) >>> 0, crc, 'CRC32 自洽')
  // EOCD 位于尾部 22 字节
  const eocd = zip.subarray(zip.length - 22)
  assert.equal(eocd.readUInt32LE(0), 0x06054b50, 'EOCD 签名')
  assert.equal(eocd.readUInt16LE(8), 1, 'EOCD entry 数')
  assert.equal(eocd.readUInt32LE(12) + eocd.readUInt32LE(16) + 22, zip.length, '中央目录偏移自洽')
  return { name, data }
}

test('① zipPathFor：.json → 同名 .zip（大小写兼容、无后缀补 .zip）', () => {
  assert.equal(zipPathFor('a/conversations.json'), 'a/conversations.zip')
  assert.equal(zipPathFor('a/C.JSON'), 'a/C.zip')
  assert.equal(zipPathFor('a/noext'), 'a/noext.zip')
})

test('② buildStoreZip：单文件 ZIP 结构合法、CRC 自洽、内容原样读回', () => {
  const json = Buffer.from('[{"title":"测试"}]\n', 'utf8')
  const zip = buildStoreZip([{ name: 'conversations.json', data: json }])
  const back = readBack(zip)
  assert.equal(back.name, 'conversations.json')
  assert.deepEqual(back.data, json)
})

test('③ buildStoreZip：多文件与中文文件名不损坏', () => {
  const a = Buffer.from('aaa', 'utf8')
  const b = Buffer.from('对话数据', 'utf8')
  const zip = buildStoreZip([
    { name: 'conversations.json', data: a },
    { name: '说明.txt', data: b },
  ])
  assert.equal(zip.readUInt32LE(0), 0x04034b50)
  const eocd = zip.subarray(zip.length - 22)
  assert.equal(eocd.readUInt16LE(10), 2, 'EOCD 记录 2 个条目')
  const text = zip.toString('utf8')
  assert.ok(text.includes('说明.txt') || zip.includes(Buffer.from('说明.txt', 'utf8')))
})

test('④ run --apply 同时写裸 JSON 与 ZIP，summary 报双路径', () => {
  const mem = {}
  const fsImpl = {
    readFileSync: (p) => {
      const k = String(p).replace(/\\/g, '/')
      if (!(k in mem)) throw new Error(`ENOENT ${k}`)
      return mem[k]
    },
    writeFileSync: (p, d) => {
      mem[p] = d
    },
    mkdirSync: () => {},
  }
  const archive = 'C:/archive'
  mem[`${archive}/index.json`] = JSON.stringify({
    conversations: [{ conversationId: 'c1', name: '会话', file: 'c1.json' }],
  })
  mem[`${archive}/c1.json`] = JSON.stringify({
    conversationId: 'c1',
    name: '会话',
    messages: [{ role: 'user', content: '问', index: 1 }],
  })
  const r = run(['--archive', archive, '--out', 'C:/out/conversations.json', '--apply'], { fs: fsImpl })
  assert.equal(r.code, 'ok')
  assert.equal(r.applied, true)
  assert.equal(r.conversations, 1)
  assert.equal(r.zipFile, 'C:/out/conversations.zip')
  const jsonBuf = mem['C:/out/conversations.json']
  const zipBuf = mem['C:/out/conversations.zip']
  assert.ok(jsonBuf && zipBuf, '两份文件都写了')
  const back = readBack(zipBuf)
  assert.equal(back.name, 'conversations.json')
  assert.deepEqual(back.data, jsonBuf, 'ZIP 内 JSON 与裸 JSON 逐字节一致')
})

test('⑤ run 干跑不写任何文件', () => {
  const mem = {}
  const fsImpl = {
    readFileSync: (p) => mem[String(p).replace(/\\/g, '/')],
    writeFileSync: (p, d) => {
      mem[p] = d
    },
    mkdirSync: () => {},
  }
  mem['C:/a/index.json'] = JSON.stringify({ conversations: [] })
  const r = run(['--archive', 'C:/a', '--out', 'C:/o/c.json'], { fs: fsImpl })
  assert.equal(r.code, 'ok')
  assert.equal(r.applied, false)
  assert.equal(Object.keys(mem).filter((k) => k.startsWith('C:/o')).length, 0)
})
