// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import { __test__ as gen } from '../gen-knip-taro-entries.mjs'

const { parseTaroPages, buildEntries, currentBlock, renderBlock } = gen

const CONFIG = `export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/user/index',
    // 'pages/legacy/commented-out', // 注释掉的不得计入
  ],
  subPackages: [
    {
      root: 'pkg-ai',
      pages: ['ai/chat', 'dev-space'],
    },
    {
      root: 'pkg-user',
      pages: ['fans/index'],
    },
  ],
})
`

describe('gen-knip-taro-entries: app.config.ts → knip entry', () => {
  it('主包 pages 与 subPackages 的 root 前缀都要被解析出来', () => {
    const pages = parseTaroPages(CONFIG)
    assert.deepEqual(pages, [
      'pages/index/index',
      'pages/user/index',
      'pkg-ai/ai/chat',
      'pkg-ai/dev-space',
      'pkg-user/fans/index',
    ])
  })

  it('行注释里的路径不得计入(否则会凭空生成 entry)', () => {
    assert.equal(parseTaroPages(CONFIG).includes('pages/legacy/commented-out'), false)
  })

  it('找不到 pages 数组 ⇒ 返回 null(调用方据此 exit 2 未判定,不回落空清单)', () => {
    assert.equal(parseTaroPages('export default {}'), null)
  })

  it('buildEntries:真实存在的页面才进 entry,解析不到的逐条记进 unresolved', () => {
    // 夹具混一真一假:真页面必须被解析成 entry(证明解析规则没退化成"只认 app.tsx"),
    // 假页面必须进 unresolved(证明取不到文件时不会凭空造 entry)
    const built = buildEntries(`export default {
  pages: ['pages/index/index', '__no_such_page__/x'],
}`)
    assert.ok(built, 'buildEntries 应给出结论')
    assert.ok(built.entries.includes('src/app.tsx'))
    assert.ok(built.entries.includes('src/pages/index/index.tsx'))
    assert.deepEqual(built.unresolved, ['__no_such_page__/x'])
  })

  it('renderBlock/currentBlock 成对:渲染出来的块必须能被原样读回', () => {
    const block = renderBlock(['src/app.tsx', 'src/pages/index/index.tsx'])
    const text = `{\n  "workspaces": {\n${block}\n  }\n}\n`
    assert.equal(currentBlock(text), block)
    assert.match(block, /BEGIN:knip-taro-entries/)
    assert.match(block, /END:knip-taro-entries/)
  })

  it('受管块缺失时 currentBlock 返回 null(不得静默当成"已同步")', () => {
    assert.equal(currentBlock('{"workspaces":{}}'), null)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
