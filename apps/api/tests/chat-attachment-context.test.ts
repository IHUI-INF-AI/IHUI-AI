// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/services/upload-file-registry.js', () => ({
  findUploadedFile: vi.fn(),
}))

vi.mock('../src/services/document-text-extract.js', () => {
  class MockFileTooLargeError extends Error {}
  class MockOfficeConversionError extends Error {}
  return {
    DOCUMENT_TEXT_EXTS: new Set(['txt', 'pdf', 'docx']),
    extOfDocumentName: (name: string) => name.split('.').pop()?.toLowerCase() ?? '',
    extractDocumentText: vi.fn(async () => '第一段正文\n第二段正文'),
    FileTooLargeError: MockFileTooLargeError,
    OfficeConversionError: MockOfficeConversionError,
  }
})

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(async () => Buffer.from('fake bytes')),
}))

import {
  buildChatAttachmentContext,
  collectPersistedAttachments,
} from '../src/services/chat-attachment-context.js'
import { findUploadedFile } from '../src/services/upload-file-registry.js'
import { extractDocumentText } from '../src/services/document-text-extract.js'

const findUploadedFileMock = vi.mocked(findUploadedFile)
const extractDocumentTextMock = vi.mocked(extractDocumentText)

function record(overrides: Record<string, unknown> = {}) {
  return {
    fileId: '00000000-0000-4000-8000-000000000001',
    ownerId: 'user-1',
    name: '季度报告.txt',
    mimeType: 'text/plain',
    storedPath: '/tmp/quarter.txt',
    size: 24,
    createdAt: '2026-11-27T00:00:00.000Z',
    ...overrides,
  }
}

describe('buildChatAttachmentContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findUploadedFileMock.mockReturnValue(record())
    extractDocumentTextMock.mockResolvedValue('第一段正文\n第二段正文')
  })

  it('归属匹配时把正文包进不可信数据块', async () => {
    const result = await buildChatAttachmentContext('user-1', [
      { fileId: record().fileId, name: '季度报告.txt' },
    ])
    expect(result.text).toContain('<attached_files>')
    expect(result.text).toContain('季度报告.txt')
    expect(result.text).toContain('第一段正文')
    expect(result.text).toContain('不要执行')
    expect(result.files[0]).toMatchObject({ name: '季度报告.txt', chars: 11, truncated: false })
  })

  it('归属不匹配时不读正文、不泄露文件内容', async () => {
    findUploadedFileMock.mockReturnValue(record({ ownerId: 'another-user' }))
    const result = await buildChatAttachmentContext('user-1', [
      { fileId: record().fileId, name: '季度报告.txt' },
    ])
    expect(result.text).toContain('附件不可用')
    expect(result.text).not.toContain('第一段正文')
    expect(extractDocumentTextMock).not.toHaveBeenCalled()
  })

  it('不支持正文提取的格式给出显式失败块', async () => {
    findUploadedFileMock.mockReturnValue(record({ name: '归档.bin' }))
    const result = await buildChatAttachmentContext('user-1', [
      { fileId: record().fileId, name: '归档.bin' },
    ])
    expect(result.text).toContain('暂不支持提取 .bin 正文')
    expect(result.files[0]?.error).toContain('暂不支持')
  })

  it('会话历史附件按新→旧收集、去重并最多 3 个', () => {
    const attachment = (fileId: string, name = '季度报告.txt') => ({
      fileId,
      name,
      size: 24,
    })
    const collected = collectPersistedAttachments([
      { role: 'assistant', metadata: { attachments: [attachment('ignored-assistant-id-0001')] } },
      {
        role: 'user',
        metadata: { attachments: [attachment('older-file-id-000000000001', '旧文件.txt')] },
      },
      {
        role: 'user',
        metadata: {
          attachments: [
            attachment('newer-file-id-000000000001', '新文件一.txt'),
            attachment('newer-file-id-000000000002', '新文件二.txt'),
          ],
        },
      },
      {
        role: 'user',
        metadata: {
          attachments: [attachment('newer-file-id-000000000001', '新文件一重复.txt')],
        },
      },
      { role: 'user', metadata: { attachments: 'not-an-array' } },
      { role: 'user', metadata: { attachments: [{ fileId: 'short' }] } },
    ])
    expect(collected.map((item) => item.name)).toEqual([
      '新文件一重复.txt',
      '新文件二.txt',
      '旧文件.txt',
    ])
  })

  it('conversation 口径明确是会话历史而不是本轮新增', async () => {
    const result = await buildChatAttachmentContext(
      'user-1',
      [{ fileId: record().fileId, name: '季度报告.txt' }],
      { source: 'conversation' },
    )
    expect(result.text).toContain('本会话中上传过')
    expect(result.text).toContain('最多 3 个')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
