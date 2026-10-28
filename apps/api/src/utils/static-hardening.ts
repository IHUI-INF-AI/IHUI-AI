// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 传输层兜底加固(2026-10-28 安全审计)。
 *
 * 这里放两件"必须能单独测"的事,而不是继续内联在 server.ts 的装配代码里 ——
 * 内联时只能靠静态 grep 证明"代码写了",证明不了"行为对"。
 *
 * 1. `wildcardContentTypeParser`:未注册 Content-Type 的兜底解析。
 * 2. `UPLOADS_CSP` + `isUploadsStaticPath`:/uploads 静态目录的 CSP 与 nosniff。
 */
import type { FastifyReply, FastifyRequest } from 'fastify'

/**
 * 未注册 Content-Type 的兜底解析器。
 *
 * 旧实现把任何未知 Content-Type 的请求体换成 `Buffer.alloc(0)` **静默吞掉**。后果
 * 不是漏洞而是"静默丢数据":第三方 webhook 用 `text/plain` / `text/xml` 推过来
 * (微信支付 v2 就是 XML),body 被吞成空、handler 按空处理、照样回 200 ⇒ 发送方
 * 以为送达,实际什么都没发生,且没有任何日志。
 *
 * 现在的口径:
 *  - body 为空(含无 body 的 POST 与空串)⇒ 仍按空 body 放行。RN App 的"无 body
 *    写操作"依赖这条,不能动。
 *  - body 非空 ⇒ 显式 415,让调用方立刻看见"你用的 Content-Type 我们不认"。
 *    要支持某种格式,正确做法是在路由侧注册精确解析器,不是在通配里猜。
 */
export function wildcardContentTypeParser(
  _req: FastifyRequest,
  body: Buffer,
  done: (err: Error | null, result?: unknown) => void,
): void {
  const buf = Buffer.isBuffer(body) ? body : Buffer.alloc(0)
  if (buf.length > 0) {
    done(
      Object.assign(new Error('Unsupported Media Type: 未注册的 Content-Type'), {
        statusCode: 415,
      }),
    )
    return
  }
  done(null, Buffer.alloc(0))
}

/**
 * `/uploads/*` 静态文件的 CSP。
 *
 * 上传白名单已排除 svg/html,但 PDF 仍可在浏览器里被直接打开(PDF 阅读器有沙箱,
 * 历史上存在绕过)。`sandbox` 把这类文档放进空源沙箱:脚本、表单、同源访问一律禁掉;
 * 图片不受影响(图片不执行文档语义)。
 *
 * 刻意**不**在 helmet 里全局开 CSP:API 响应绝大多数是 JSON,而唯一的 HTML 面 /docs
 * 由 swagger-ui 自带 `staticCSP`,helmet 的 onSend 会把它覆盖成 `default-src 'none'`
 * ⇒ 文档页白屏。
 */
export const UPLOADS_CSP =
  "default-src 'none'; img-src 'self'; style-src 'none'; script-src 'none'; sandbox"

/** 请求是否落在 /uploads 静态目录(查询串不影响判定)。 */
export function isUploadsStaticPath(url: string | undefined): boolean {
  if (!url) return false
  const path = url.split('?')[0] ?? ''
  return path.startsWith('/uploads/')
}

/** 给 /uploads 响应补 CSP 与 nosniff;非 /uploads 请求原样返回 false(表示未改动)。 */
export function applyUploadsStaticHardening(
  request: Pick<FastifyRequest, 'url'>,
  reply: Pick<FastifyReply, 'header'>,
): boolean {
  if (!isUploadsStaticPath(request.url)) return false
  reply.header('Content-Security-Policy', UPLOADS_CSP)
  reply.header('X-Content-Type-Options', 'nosniff')
  return true
}
