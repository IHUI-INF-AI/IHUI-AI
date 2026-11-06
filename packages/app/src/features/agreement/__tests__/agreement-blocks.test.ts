// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import { htmlToBlocks, htmlToParagraphs } from '../agreement-type'

describe('htmlToBlocks · 文档结构语义', () => {
  it('保留 h1/h2 层级,不再把标题压成纯段落', () => {
    const blocks = htmlToBlocks(
      '<h1>一、总则</h1><p>正文第一段。</p><h2>1.1 适用范围</h2><p>正文第二段。</p>',
    )
    expect(blocks).toEqual([
      { type: 'heading', level: 1, text: '一、总则' },
      { type: 'paragraph', text: '正文第一段。' },
      { type: 'heading', level: 2, text: '1.1 适用范围' },
      { type: 'paragraph', text: '正文第二段。' },
    ])
  })

  it('h3-h6 收敛到 level 3,仍保留标题节点', () => {
    expect(htmlToBlocks('<h3>小节</h3><h6>深层</h6>')).toEqual([
      { type: 'heading', level: 3, text: '小节' },
      { type: 'heading', level: 3, text: '深层' },
    ])
  })

  it('无序列表逐项产出 listItem,保留项目符号语义', () => {
    expect(htmlToBlocks('<ul><li>账号标识</li><li>会话内容</li></ul>')).toEqual([
      { type: 'listItem', ordered: false, index: 0, text: '账号标识' },
      { type: 'listItem', ordered: false, index: 0, text: '会话内容' },
    ])
  })

  it('有序列表按 1 起递增序号', () => {
    expect(htmlToBlocks('<ol><li>甲</li><li>乙</li><li>丙</li></ol>')).toEqual([
      { type: 'listItem', ordered: true, index: 1, text: '甲' },
      { type: 'listItem', ordered: true, index: 2, text: '乙' },
      { type: 'listItem', ordered: true, index: 3, text: '丙' },
    ])
  })

  it('br 分段、实体解码与行内标签剥离与旧口径一致', () => {
    const blocks = htmlToBlocks(
      '<p>A&amp;B<br/>第二行&nbsp;<strong>加粗</strong>&#39;引号&#39;</p>',
    )
    expect(blocks).toEqual([
      { type: 'paragraph', text: 'A&B' },
      { type: 'paragraph', text: "第二行 加粗'引号'" },
    ])
  })

  it('纯文本仍按单段落输出,无标题/列表时与 htmlToParagraphs 文本一致', () => {
    const html = '第一段。\n第二段。'
    expect(htmlToBlocks(html)).toEqual([
      { type: 'paragraph', text: '第一段。' },
      { type: 'paragraph', text: '第二段。' },
    ])
    expect(htmlToBlocks(html).map((b) => ('text' in b ? b.text : ''))).toEqual(
      htmlToParagraphs(html),
    )
  })

  it('列表项内嵌段落不会被降级成普通段落', () => {
    expect(htmlToBlocks('<ul><li><p>带段落符号</p></li></ul>')).toEqual([
      { type: 'listItem', ordered: false, index: 0, text: '带段落符号' },
    ])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
