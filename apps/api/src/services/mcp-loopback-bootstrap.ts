// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * L08 回环 host 的启动接线(2026-11-26)。
 *
 * 服务本体在 `mcp-loopback-host.ts`;本文件只回答"谁在什么时候把它拉起来":
 *  - 默认**不启动**(`IHUI_MCP_LOOPBACK` 未开 ⇒ 返回 null),不给现网平白多一个监听面;
 *  - 开启后注册 `/mcp/ping` 自检路由,并在调用方注入 Fastify `inject` 时把
 *    `mcp-extended` 的 15 条业务路由全部注册进 Host(带 per-route token);
 *  - 端口由内核分配并只绑 127.0.0.1,日志里打出实际 `127.0.0.1:<port>`;
 *  - 返回句柄供 shutdown 收口(先注销路由再 close,在飞请求按 L08 语义 abort)。
 *
 * 业务实现仍只有 `routes/mcp-extended.ts` 一份,Host 只做传输面与 token 闸。
 */

import type { FastifyBaseLogger } from 'fastify'

import type { McpBusinessInject, RegisteredMcpBusinessRoute } from './mcp-business-routes.js'
import { registerMcpBusinessRoutes } from './mcp-business-routes.js'
import { MCP_LOOPBACK_HOST, McpLoopbackHost } from './mcp-loopback-host.js'

export interface McpLoopbackHandle {
  host: McpLoopbackHost
  port: number
  address: string
  /** 业务路由 token;未注入 Fastify inject 时为空。 */
  businessRoutes: RegisteredMcpBusinessRoute[]
}

const truthy = (v: string | undefined): boolean => v === '1' || v?.toLowerCase() === 'true'

export function isMcpLoopbackEnabled(env: Record<string, string | undefined>): boolean {
  return truthy(env.IHUI_MCP_LOOPBACK)
}

export async function startMcpLoopbackBootstrap(
  env: Record<string, string | undefined>,
  logger: Pick<FastifyBaseLogger, 'info' | 'warn'>,
  inject?: McpBusinessInject,
): Promise<McpLoopbackHandle | null> {
  if (!isMcpLoopbackEnabled(env)) return null
  const host = new McpLoopbackHost()
  const pingToken = host.register('/mcp/ping', ({ res }) => {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ ok: true, service: 'ihui-api', route: 'mcp/ping' }))
  })
  const businessRoutes = inject ? registerMcpBusinessRoutes(host, inject) : []
  try {
    const { port, address } = await host.start()
    if (address !== MCP_LOOPBACK_HOST) {
      throw new Error(`MCP 回环 host 绑定地址异常: ${address}`)
    }
    logger.info(
      {
        address,
        port,
        pingTokenRegistered: Boolean(pingToken),
        businessRouteCount: businessRoutes.reduce(
          (total, route) => total + route.methods.length,
          0,
        ),
      },
      'MCP 回环 host 已启动(仅 127.0.0.1,per-route token;业务路由已接入)',
    )
    return { host, port, address, businessRoutes }
  } catch (err) {
    await host.stop()
    logger.warn({ err }, 'MCP 回环 host 启动失败,已回滚(不影响主服务)')
    return null
  }
}

export async function stopMcpLoopbackBootstrap(handle: McpLoopbackHandle | null): Promise<void> {
  if (!handle) return
  await handle.host.stop()
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
