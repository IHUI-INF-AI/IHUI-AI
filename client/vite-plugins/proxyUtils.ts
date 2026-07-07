/**
 * Vite Proxy 工具函数 (2026-07-07 重构)
 *
 * 从 vite.config.ts 中提取的重复 proxy error handler 逻辑.
 * 原配置中 40+ 条代理规则每条都内联相同的 error handler, 现统一调用此函数.
 */

/**
 * 创建标准 proxy error handler.
 *
 * 用法:
 *   '/api/': {
 *     target: BACKEND_TARGET,
 *     changeOrigin: true,
 *     configure: createProxyErrorHandler('api'),
 *   }
 *
 * @param name 代理名称, 用于日志标识 (如 'api', 'ws', 'coze')
 * @returns configure 回调函数
 */
export function createProxyErrorHandler(name: string) {
  return (proxy: { on: (event: string, handler: (...args: unknown[]) => void) => void }) => {
    proxy.on('error', (err: unknown, req?: { url?: string }) => {
      const url = (req as { url?: string })?.url ?? ''
      const msg = err instanceof Error ? err.message : String(err)
      // 仅在 debug 模式输出, 避免后端重启时刷屏
      if (process.env.VITE_PROXY_DEBUG) {
        console.log(`[proxy:${name}] ${url} -> ${msg}`)
      }
    })
  }
}

/**
 * 创建标准代理配置对象 (target + changeOrigin + error handler).
 * 进一步简化: 无需手动写 target/changeOrigin/configure 三行.
 *
 * 用法:
 *   '/api/': createProxyEntry(BACKEND_TARGET, 'api'),
 *   '/community/': createProxyEntry(BACKEND_TARGET, 'community', {
 *     rewrite: (path) => path.replace(/^\/community\//, '/api/v1/circle/')
 *   }),
 */
export function createProxyEntry(
  target: string,
  name: string,
  extra?: Record<string, unknown>
): Record<string, unknown> {
  return {
    target,
    changeOrigin: true,
    configure: createProxyErrorHandler(name),
    ...extra,
  }
}
