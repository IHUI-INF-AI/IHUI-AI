// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { describe, expect, it } from 'vitest'

import {
  buildAiAllHandoffSummary,
  toPreviewAnnotationPin,
  type DocumentAnnotationRecord,
  type PreviewAnnotationPin,
} from '../document-annotations'

function record(overrides: Partial<DocumentAnnotationRecord> = {}): DocumentAnnotationRecord {
  return {
    id: 'a1',
    documentId: 'file:developer/demo.pdf',
    parentId: null,
    author: '系统管理员',
    body: '核对版本日期',
    label: 'PDF 第 1 页',
    anchorKind: 'pdf',
    anchor: { kind: 'pdf', page: 1 },
    excerpt: '版本日期：2026 年 11 月 23 日',
    status: 'open',
    createdAt: '2026-11-27T04:00:00.000Z',
    updatedAt: '2026-11-27T04:00:00.000Z',
    ...overrides,
  }
}

describe('buildAiAllHandoffSummary', () => {
  it('只打包 AI 根结论，保留每条坐标与正文', () => {
    const summary = buildAiAllHandoffSummary(
      [
        record({
          id: 'ai-1',
          author: 'AI 预审官',
          body: '缺少算法备案号',
          label: '文档第 7 段',
          anchorKind: 'docx',
          anchor: { kind: 'docx', paragraph: 7 },
          origin: 'ai',
        }),
        record({
          id: 'human-1',
          body: '人工意见',
          origin: 'human',
        }),
        record({
          id: 'ai-reply',
          parentId: 'ai-1',
          author: 'AI 预审官',
          body: '补充回复',
          origin: 'ai',
        }),
        record({
          id: 'ai-2',
          author: 'AI 预审官',
          body: '预算口径不一致',
          label: '预算明细 · A1:D4',
          anchorKind: 'xlsx',
          anchor: { kind: 'xlsx', sheet: '预算明细', range: 'A1:D4' },
          origin: 'ai',
        }),
      ],
      'AI生成内容合规整改办理包-智汇AI',
    )

    expect(summary).not.toBeNull()
    expect(summary?.count).toBe(2)
    expect(summary?.note).toBe('全部 AI 预审结论 2 条')
    expect(summary?.text).toContain('AI 全文预审，共 2 条')
    expect(summary?.text).toContain('[文档第 7 段] 缺少算法备案号')
    expect(summary?.text).toContain('[预算明细 · A1:D4] 预算口径不一致')
    expect(summary?.text).not.toContain('人工意见')
    expect(summary?.text).not.toContain('补充回复')
    expect(summary?.anchor).toMatchObject({ kind: 'docx', paragraph: 7 })
  })

  it('没有 AI 根结论时返回 null，不构造空交接', () => {
    expect(buildAiAllHandoffSummary([record()], '文档')).toBeNull()
  })

  it('保留首条锚点的页/元素定位，供输入框引用 chip 使用', () => {
    const summary = buildAiAllHandoffSummary(
      [
        record({
          id: 'ai-pptx',
          body: '标题缺少版本号',
          label: '第 2 张 · 标题 1',
          anchorKind: 'pptx',
          anchor: { kind: 'pptx', slide: 2, element: '标题 1' },
          excerpt: '合规整改方案',
          origin: 'ai',
        }),
      ],
      '演示文稿',
    )
    expect(summary).toMatchObject({
      slide: 2,
      element: '标题 1',
      excerpt: '合规整改方案',
    })
  })
})

describe('toPreviewAnnotationPin', () => {
  it('PDF 锚点映射为页级 pin,并保留摘要/状态', () => {
    const pin = toPreviewAnnotationPin(record())
    expect(pin).toMatchObject<Partial<PreviewAnnotationPin>>({
      id: 'a1',
      kind: 'pdf',
      page: 1,
      label: 'PDF 第 1 页',
      excerpt: '版本日期：2026 年 11 月 23 日',
      status: 'open',
    })
  })

  it('PPTX 锚点映射到 slide + element,便于按 shape 命中', () => {
    const pin = toPreviewAnnotationPin(
      record({
        label: '第 2 张 · 标题 1',
        anchorKind: 'pptx',
        anchor: { kind: 'pptx', slide: 2, element: '标题 1' },
        excerpt: null,
      }),
    )
    expect(pin).toMatchObject<Partial<PreviewAnnotationPin>>({
      kind: 'pptx',
      slide: 2,
      element: '标题 1',
      label: '第 2 张 · 标题 1',
      status: 'open',
    })
  })

  it('回复不生成页内 pin,坏锚点也不猜位置', () => {
    expect(toPreviewAnnotationPin(record({ parentId: 'root' }))).toBeNull()
    expect(toPreviewAnnotationPin(record({ anchor: { kind: 'pdf' } }))).toBeNull()
    expect(
      toPreviewAnnotationPin(record({ anchor: { kind: 'pptx', slide: 0, element: '标题 1' } })),
    ).toBeNull()
    expect(toPreviewAnnotationPin(record({ anchor: { kind: 'docx', page: 1 } }))).toBeNull()
    expect(
      toPreviewAnnotationPin(record({ anchor: { kind: 'xlsx', sheet: '表A', range: '' } })),
    ).toBeNull()
  })

  it('DOCX 段落锚映射为段落 pin,不把页码当段落', () => {
    const pin = toPreviewAnnotationPin(
      record({
        label: '文档第 3 段',
        anchorKind: 'docx',
        anchor: { kind: 'docx', paragraph: 3 },
        excerpt: '甲方应在 2026 年 12 月前完成整改。',
      }),
    )
    expect(pin).toMatchObject<Partial<PreviewAnnotationPin>>({
      kind: 'docx',
      paragraph: 3,
      label: '文档第 3 段',
      excerpt: '甲方应在 2026 年 12 月前完成整改。',
      status: 'open',
    })
  })

  it('XLSX sheet + range 映射为单元格 pin', () => {
    const pin = toPreviewAnnotationPin(
      record({
        label: '进度表 · A2:C9',
        anchorKind: 'xlsx',
        anchor: { kind: 'xlsx', sheet: '进度表', range: 'A2:C9' },
        excerpt: null,
      }),
    )
    expect(pin).toMatchObject<Partial<PreviewAnnotationPin>>({
      kind: 'xlsx',
      sheet: '进度表',
      range: 'A2:C9',
      label: '进度表 · A2:C9',
      status: 'open',
    })
  })
})
