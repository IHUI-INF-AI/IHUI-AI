/**
 * forceNumericHostBanner - dev server 启动时把 localhost 强制替换为 127.0.0.1
 *
 * 原因：开发环境用 127.0.0.1 比 localhost 更稳定（避免某些代理/DNS 解析问题）
 * 影响范围：仅修改 server.printUrls 输出的 URL 显示，不影响实际服务。
 */
import type { ViteDevServer } from 'vite'

export function forceNumericHostBanner() {
  return {
    name: 'force-numeric-host-banner',
    configureServer(server: ViteDevServer) {
      const original = server.printUrls.bind(server)
      server.printUrls = () => {
        try {
          const port = server.config.server?.port || 8888
          const protocol = server.config.server?.https ? 'https' : 'http'
          const local = `${protocol}://127.0.0.1:${port}/`
          const network = (server.resolvedUrls?.network || []).map(u =>
            u.replace('localhost', '127.0.0.1')
          )
          server.resolvedUrls = {
            local: [local],
            network: network.length ? network : [local],
            open: [local],
          } as any
        } catch {
          // ignore: resolvedUrls 字段在不同 Vite 版本中可能为 undefined, 静默使用默认行为
        }
        original()
      }
    },
  }
}
