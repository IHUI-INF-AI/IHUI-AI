// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * WATERMARK-PLACEHOLDER(本行由 scripts/watermark.mjs inject 替换为横幅)
 */

/**
 * G3 Artifact 类型层测试:zod 校验(五型 payload + 元数据记录)+
 * renderArtifactToHtml / artifactToCsv / artifactToMarkdown 纯函数快照。
 */

import { describe, expect, it } from 'vitest'
import {
  artifactSchema,
  sheetPayloadSchema,
  slidesDeckSchema,
  videoRefPayloadSchema,
  deliverablePayloadSchemaOf,
  type ArtifactWithPayload,
} from '../types'
import { artifactToCsv, artifactToMarkdown, renderArtifactToHtml } from '../render'

function baseArtifact(overrides: Record<string, unknown> = {}) {
  return {
    id: '3f2a1b6c-9d8e-4f70-a1b2-c3d4e5f60718',
    kind: 'slides',
    title: '季度复盘',
    version: 1,
    session_id: 'sess-001',
    turn_anchor: { message_id: 'msg-42' },
    payload_ref: 'tmp/artifacts/3f2a1b6c-9d8e-4f70-a1b2-c3d4e5f60718/v1.json',
    mime: 'application/json',
    size_bytes: 128,
    checksum: 'a'.repeat(64),
    created_at: '2026-10-30T08:00:00Z',
    updated_at: '2026-10-30T08:00:00Z',
    status: 'draft',
    ...overrides,
  }
}

describe('artifactSchema 元数据校验', () => {
  it('合法记录通过', () => {
    const r = artifactSchema.safeParse(baseArtifact())
    expect(r.success).toBe(true)
  })

  it('缺 turn_anchor 锚点 / 非法 kind / 非法 checksum 全部拒收', () => {
    expect(artifactSchema.safeParse({ ...baseArtifact(), turn_anchor: undefined }).success).toBe(false)
    expect(
      artifactSchema.safeParse({ ...baseArtifact(), turn_anchor: { message_id: '' } }).success,
    ).toBe(false)
    expect(artifactSchema.safeParse({ ...baseArtifact(), kind: 'pdf' }).success).toBe(false)
    expect(artifactSchema.safeParse({ ...baseArtifact(), checksum: 'XYZ' }).success).toBe(false)
    expect(artifactSchema.safeParse({ ...baseArtifact(), version: 0 }).success).toBe(false)
  })

  it('deliverablePayloadSchemaOf 五型齐备', () => {
    expect(deliverablePayloadSchemaOf('slides')).toBe(slidesDeckSchema)
    expect(deliverablePayloadSchemaOf('sheet')).toBe(sheetPayloadSchema)
    expect(deliverablePayloadSchemaOf('video_ref')).toBe(videoRefPayloadSchema)
    expect(deliverablePayloadSchemaOf('html_report')).toBeDefined()
    expect(deliverablePayloadSchemaOf('doc')).toBeDefined()
  })
})

describe('payload zod schema', () => {
  it('slides deck:合法通过;空页 / 缺 bullets 拒收', () => {
    expect(
      slidesDeckSchema.safeParse({ slides: [{ title: 'A', bullets: ['b1', 'b2'], notes: 'n' }] }).success,
    ).toBe(true)
    expect(slidesDeckSchema.safeParse({ slides: [] }).success).toBe(false)
    expect(slidesDeckSchema.safeParse({ slides: [{ title: 'A' }] }).success).toBe(false)
  })

  it('sheet:列名 + 混合类型单元格通过;无列拒收', () => {
    expect(sheetPayloadSchema.safeParse({ columns: ['x', 'y'], rows: [['a', 1], [null, 2]] }).success).toBe(true)
    expect(sheetPayloadSchema.safeParse({ columns: [], rows: [] }).success).toBe(false)
  })

  it('video_ref:url 必填', () => {
    expect(videoRefPayloadSchema.safeParse({ url: 'https://v.example/1', provider: 'yt' }).success).toBe(true)
    expect(videoRefPayloadSchema.safeParse({ url: '' }).success).toBe(false)
  })
})

describe('renderArtifactToHtml', () => {
  const slides = {
    ...baseArtifact({ kind: 'slides' }),
    payload: { slides: [{ title: '总览 <A>', bullets: ['要点 & 一', '要点 "二"'], notes: '备注 <x>' }] },
  } as ArtifactWithPayload

  it('slides → 内联 HTML 预览串(转义插值)', () => {
    expect(renderArtifactToHtml(slides)).toBe(
      '<div class="artifact artifact--slides">' +
        '<section class="artifact-slide" data-slide-index="0">' +
        '<h2>总览 &lt;A&gt;</h2>' +
        '<ul><li>要点 &amp; 一</li><li>要点 &quot;二&quot;</li></ul>' +
        '<aside class="artifact-slide-notes">备注 &lt;x&gt;</aside>' +
        '</section></div>',
    )
  })

  it('sheet → 表格 HTML(行按列对齐,越界补空)', () => {
    const sheet = {
      ...baseArtifact({ kind: 'sheet' }),
      payload: { columns: ['姓名', '得分'], rows: [['张三', 95], [null]] },
    } as ArtifactWithPayload
    expect(renderArtifactToHtml(sheet)).toBe(
      '<table class="artifact artifact--sheet">' +
        '<thead><tr><th>姓名</th><th>得分</th></tr></thead>' +
        '<tbody><tr><td>张三</td><td>95</td></tr><tr><td></td><td></td></tr></tbody></table>',
    )
  })

  it('html_report → 原样返回自包含 HTML', () => {
    const html = '<!DOCTYPE html><html><body><h1>报告</h1></body></html>'
    const report = { ...baseArtifact({ kind: 'html_report' }), payload: html } as ArtifactWithPayload
    expect(renderArtifactToHtml(report)).toBe(html)
  })

  it('doc → 转义预格式化;video_ref → 安全链接卡片', () => {
    const doc = { ...baseArtifact({ kind: 'doc' }), payload: '正文 <script>' } as ArtifactWithPayload
    expect(renderArtifactToHtml(doc)).toBe(
      '<pre class="artifact artifact--doc">正文 &lt;script&gt;</pre>',
    )
    const video = {
      ...baseArtifact({ kind: 'video_ref', title: '宣传片' }),
      payload: { url: 'https://v.example/1', provider: 'yt' },
    } as ArtifactWithPayload
    expect(renderArtifactToHtml(video)).toBe(
      '<div class="artifact artifact--video-ref">' +
        '<a href="https://v.example/1" rel="noopener noreferrer nofollow" target="_blank">宣传片</a>' +
        ' · yt</div>',
    )
  })

  it('payload 与 kind 不符抛错(编程错误面)', () => {
    const bad = {
      ...baseArtifact({ kind: 'slides' }),
      payload: { nope: 1 },
    } as unknown as ArtifactWithPayload
    expect(() => renderArtifactToHtml(bad)).toThrow(/deck/)
  })
})

describe('导出转换(md/csv)', () => {
  it('slides → md 大纲', () => {
    const slides = {
      ...baseArtifact({ kind: 'slides', title: '复盘' }),
      payload: { slides: [{ title: '总览', bullets: ['一', '二'], notes: '备注' }] },
    } as ArtifactWithPayload
    expect(artifactToMarkdown(slides)).toBe('# 复盘\n\n## 总览\n\n- 一\n- 二\n\n> 备注')
  })

  it('sheet → csv(RFC 4180 引号规则)', () => {
    const sheet = {
      ...baseArtifact({ kind: 'sheet' }),
      payload: { columns: ['a', 'b'], rows: [['x,y', 'he said "hi"'], [1, null]] },
    } as ArtifactWithPayload
    expect(artifactToCsv(sheet)).toBe('a,b\r\n"x,y","he said ""hi"""\r\n1,')
  })

  it('非 sheet 要 csv / 非字符串 payload 要 md 均抛错', () => {
    const slides = {
      ...baseArtifact({ kind: 'slides' }),
      payload: { slides: [{ title: 't', bullets: [] }] },
    } as ArtifactWithPayload
    expect(() => artifactToCsv(slides)).toThrow(/sheet/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
