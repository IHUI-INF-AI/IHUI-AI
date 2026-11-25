// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 朋友圈归档测试：同一动态重复抓取只增加 seenCount，不重复落条目；
 * OCR 标点/空白差异按归一化判重；读回按 lastSeenAt 倒序并支持 limit。
 */

import assert from 'node:assert/strict'
import { readFile, rm } from 'node:fs/promises'
import { appendMomentArchive, readMomentArchive } from '../moments-archive.mjs'

const FILE = process.env.BRIDGE_TEST_ARCHIVE_FILE ?? '.bridge-test-archive.jsonl'
await rm(FILE, { force: true })

const first = await appendMomentArchive(
  [
    { id: 'm1', authorName: '张三', content: '今天下雪了', source: 'ocr', page: 1 },
    {
      id: 'm2',
      authorName: '李四',
      content: '周末聚餐',
      source: 'ocr',
      page: 1,
      mediaLocalDir: 'C:\\caches\\temp\\wechat-db-media\\m2',
      mediaDownloaded: true,
    },
  ],
  FILE,
)
assert.deepEqual(first, { added: 2, updated: 0, total: 2 })

const firstRead = await readMomentArchive(FILE, 10)
const m2 = firstRead.moments.find((item) => item.id === 'm2')
assert.equal(m2?.mediaLocalDir, 'C:\\caches\\temp\\wechat-db-media\\m2')
assert.equal(m2?.mediaDownloaded, true)

const repeated = await appendMomentArchive(
  [
    { id: 'm1', authorName: '张三', content: ' 今天下雪了。', source: 'ocr', page: 2 },
    { id: 'm3', authorName: '朋友圈好友', content: '周末聚餐', source: 'ocr', page: 2 },
  ],
  FILE,
)
assert.equal(repeated.total, 2)
assert.equal(repeated.added, 0)
assert.equal(repeated.updated, 2)

const archive = await readMomentArchive(FILE, 1)
assert.equal(archive.total, 2)
assert.equal(archive.moments.length, 1)
assert.equal(archive.moments[0].seenCount >= 2, true)

await appendMomentArchive(
  [{ id: 'm2', authorName: '李四', content: '周末聚餐', source: 'ocr', page: 3, mediaUrls: [] }],
  FILE,
)
const raw = await readFile(FILE, 'utf8')
assert.equal(raw.trim().split('\n').length, 2)
assert.equal(JSON.parse(raw.trim().split('\n')[0]).content.includes('今天下雪了'), true)

await rm(FILE, { force: true })
console.log('[moments-archive] 去重、重复计数、归一化判重、读取上限、JSONL 落盘 1 组通过')
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
