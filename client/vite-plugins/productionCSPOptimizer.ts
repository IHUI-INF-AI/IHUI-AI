/**
 * productionCSPOptimizer - 生产构建时清理 CSP meta 标签中冗余的 dev 主机名
 *
 * 行为：
 *   1. 仅在生产构建（context.server 为空）时生效
 *   2. 从 <meta http-equiv="Content-Security-Policy"> 的 content 中移除
 *      http://localhost:* / 127.0.0.1:* / ws://localhost:* 等开发专用地址
 *   3. 压缩多余空白，避免连续分号
 *
 * 为什么需要：index.html 内联了多份带 media 属性的 PWA theme-color，build 时
 *            Vite 不会自动剥离 localhost/127.0.0.1，必须在 transformIndexHtml 阶段处理。
 */
export function productionCSPOptimizer() {
  return {
    name: 'production-csp-optimizer',
    transformIndexHtml(html: string, context: any) {
      // dev server 不优化（context.server 存在时直接返回原 HTML）
      if (context.server) {
        return html
      }

      // 匹配 CSP meta 标签（http-equiv 形式）
      const cspRegex =
        /<meta\s+http-equiv=["']Content-Security-Policy["'][\s\S]*?content=["']([\s\S]*?)["']\s*\/?>/i
      const match = html.match(cspRegex)

      if (!match || !match[1]) {
        return html
      }

      let cspContent = match[1]
      const originalTag = match[0]

      // 压缩多余空白
      cspContent = cspContent.replace(/\s+/g, ' ').trim()

      // 移除开发主机名：http(s)://localhost(:port)? / 127.0.0.1(:port)?
      cspContent = cspContent.replace(/\s*https?:\/\/(localhost|127\.0\.0\.1)(:\*|:\d+)?/gi, '')
      // 移除 ws(s)://localhost(:port)? / 127.0.0.1(:port)?
      cspContent = cspContent.replace(/\s*(ws|wss):\/\/(localhost|127\.0\.0\.1)(:\*|:\d+)?/gi, '')
      // 移除裸 localhost(:port)? / 127.0.0.1(:port)?
      cspContent = cspContent.replace(/\s*(localhost|127\.0\.0\.1)(:\*|:\d+)?/gi, '')

      // 整理分号
      cspContent = cspContent.replace(/\s+/g, ' ').replace(/;\s*;/g, ';').trim()
      cspContent = cspContent.replace(/\s*;\s*/g, '; ').replace(/;\s*$/, '')

      const newTag = `<meta http-equiv="Content-Security-Policy" content="${cspContent}">`
      return html.replace(originalTag, newTag)
    },
  }
}
