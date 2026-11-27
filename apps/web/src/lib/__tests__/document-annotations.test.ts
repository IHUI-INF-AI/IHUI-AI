// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { describe, expect, it } from 'vitest'

import {
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
  })
})
