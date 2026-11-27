// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync } from 'fastify'
import { extname } from 'node:path'
import { FILE_UPLOAD_BODY_LIMIT } from '../config/body-limits.js'
import { requireAuth } from '../plugins/require-permission.js'
import {
  convertOfficeToPdf,
  OFFICE_CONVERT_MAX_BYTES,
  OfficeConversionError,
} from '../services/office-converter.js'
import { error } from '../utils/response.js'

const CONVERTIBLE_EXTS = new Set([
  'doc',
  'docx',
  'ppt',
  'pptx',
  'xls',
  'xlsx',
  'odt',
  'odp',
  'ods',
  'rtf',
  'txt',
])

function statusOf(code: OfficeConversionError['code']): number {
  switch (code) {
    case 'unsupported':
      return 415
    case 'too-large':
      return 413
    case 'unavailable':
      return 503
    case 'timeout':
      return 504
    default:
      return 500
  }
}

/**
 * 旧版 Office / OpenDocument 的 PDF 预览转换面。
 *
 * 客户端上传的是已经取到手的字节(文档中心/项目文件/IDE/聊天附件都走同一套
 * UniversalFilePreview),服务端不按路径读盘,避免把“用户可控路径”重新引入。
 */
export const officePreviewRoutes: FastifyPluginAsync = async (server) => {
  server.post(
    '/preview',
    { preHandler: requireAuth, bodyLimit: FILE_UPLOAD_BODY_LIMIT },
    async (request, reply) => {
      let file
      try {
        // 单文件先按 50MB 截断,避免 100MB 全读进内存后才在转换器里被拒。
        file = await request.file({ limits: { fileSize: OFFICE_CONVERT_MAX_BYTES } })
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        request.log.warn({ err }, '[office-preview] 读取上传文件失败')
        if (status === 413) {
          return reply.status(413).send(error(413, '文件超过 50MB 上限'))
        }
        return reply.status(400).send(error(400, '无法读取上传文件'))
      }

      if (!file) {
        return reply.status(400).send(error(400, '缺少文件字段'))
      }

      const name = file.filename || 'document.docx'
      const ext = extname(name).slice(1).toLowerCase()
      if (!CONVERTIBLE_EXTS.has(ext)) {
        // 拒稿也要把流排空,否则大文件在 keep-alive 连接上可能留下未消费的 body。
        file.file.resume()
        return reply.status(415).send(error(415, `不支持的转换格式:${ext || '未知'}`))
      }

      let buffer: Buffer
      try {
        buffer = await file.toBuffer()
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 413) {
          return reply.status(413).send(error(413, '文件超过 50MB 上限'))
        }
        return reply.status(400).send(error(400, '无法读取上传文件'))
      }

      const startedAt = Date.now()
      try {
        const pdf = await convertOfficeToPdf(buffer, name)
        request.log.info(
          {
            userId: request.userId,
            ext,
            bytes: buffer.length,
            pdfBytes: pdf.length,
            ms: Date.now() - startedAt,
          },
          '[office-preview] converted',
        )
        return reply
          .header('Content-Type', 'application/pdf')
          .header('Content-Disposition', 'inline; filename="preview.pdf"')
          .header('Cache-Control', 'private, max-age=3600')
          .header('X-Content-Type-Options', 'nosniff')
          .send(pdf)
      } catch (err) {
        if (err instanceof OfficeConversionError) {
          const status = statusOf(err.code)
          request.log.warn(
            { userId: request.userId, ext, code: err.code, ms: Date.now() - startedAt },
            '[office-preview] conversion failed',
          )
          return reply
            .status(status)
            .send(error(status, err.message, `OFFICE_CONVERT_${err.code.toUpperCase()}`))
        }
        request.log.error({ err, ext }, '[office-preview] unexpected failure')
        return reply.status(500).send(error(500, '文档转换失败,请稍后重试'))
      }
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
