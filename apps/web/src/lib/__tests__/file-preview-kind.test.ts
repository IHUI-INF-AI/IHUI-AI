// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import { needsFileViewer, previewExtOf, previewKindOf } from '@/lib/file-preview-kind'

describe('file-preview-kind', () => {
  it('判型覆盖上传白名单全档:图片/视频/音频/pdf/office/表格/3D/文本各归其位', () => {
    expect(previewKindOf('png')).toBe('image')
    expect(previewKindOf('jpeg')).toBe('image')
    expect(previewKindOf('webp')).toBe('image')
    expect(previewKindOf('mp4')).toBe('video')
    expect(previewKindOf('mov')).toBe('video')
    expect(previewKindOf('mp3')).toBe('audio')
    expect(previewKindOf('m4a')).toBe('audio')
    expect(previewKindOf('pdf')).toBe('pdf')
    expect(previewKindOf('docx')).toBe('office')
    expect(previewKindOf('xlsx')).toBe('office')
    expect(previewKindOf('pptx')).toBe('office')
    expect(previewKindOf('odt')).toBe('office')
    expect(previewKindOf('rtf')).toBe('office')
    expect(previewKindOf('epub')).toBe('office')
    expect(previewKindOf('csv')).toBe('delimited')
    expect(previewKindOf('tsv')).toBe('delimited')
    expect(previewKindOf('glb')).toBe('three')
    expect(previewKindOf('md')).toBe('text')
    expect(previewKindOf('json')).toBe('text')
    expect(previewKindOf('html')).toBe('text')
    expect(previewKindOf('ts')).toBe('text')
  })

  it('未知档/归档一律落 download(由渲染器给"不支持预览 + 下载",不猜', () => {
    expect(previewKindOf('zip')).toBe('download')
    expect(previewKindOf('bin')).toBe('download')
    expect(previewKindOf('')).toBe('download')
  })

  it('大小写与前导点不影响判型', () => {
    expect(previewKindOf('.PDF')).toBe('pdf')
    expect(previewKindOf('DOCX')).toBe('office')
    expect(previewKindOf('.Csv')).toBe('delimited')
  })

  it('previewExtOf 去 query/hash,取最后一个点后的后缀', () => {
    expect(previewExtOf('https://x.test/a/b/c.PDF?v=1#p2')).toBe('pdf')
    expect(previewExtOf('blob:https://x.test/1234-5678')).toBe('')
    expect(previewExtOf('/files/report.2026.csv')).toBe('csv')
    expect(previewExtOf('/files/no-ext')).toBe('')
  })

  it('needsFileViewer:媒体/文档/表格/3D/zip 走查看器,文本与无后缀仍进编辑器', () => {
    expect(needsFileViewer('png')).toBe(true)
    expect(needsFileViewer('.PDF')).toBe(true)
    expect(needsFileViewer('docx')).toBe(true)
    expect(needsFileViewer('csv')).toBe(true)
    expect(needsFileViewer('glb')).toBe(true)
    expect(needsFileViewer('zip')).toBe(true)
    expect(needsFileViewer('md')).toBe(false)
    expect(needsFileViewer('ts')).toBe(false)
    expect(needsFileViewer('')).toBe(false)
    expect(needsFileViewer('bin')).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
