// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { API_LOGS_NETWORK } from '../src/routes/admin-monitoring-routes.js'

/**
 * 公网放行是一条**安全面**改动,必须成对钉住:开了 allowExternal 的那一行,同插件必须仍然装
 * requireAdmin preHandler。server.ts 的 onRoute 对 /api/admin/* 默认注入 allowExternal:false,
 * 所以"页面在公网打开却取不到数"的形态只会以 403 红字出现(2026-10-28 装机版桌面端「操作日志」页实测)。
 */

const SRC = fileURLToPath(new URL('../src/routes/admin-monitoring-routes.ts', import.meta.url))

/** 判"某条 GET 路由有没有带网络例外 config" */
export function routeCarriesExemption(src: string, routePath: string, configName: string): boolean {
  const esc = routePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`server\\.get\\(\\s*'${esc}'\\s*,\\s*\\{\\s*config:\\s*${configName}\\b`).test(
    src,
  )
}

describe('/api/admin/api-logs 公网可达例外(成对锁:放行必带鉴权)', () => {
  const src = readFileSync(SRC, 'utf8')

  it('例外常量真的是 allowExternal: true —— 判据取模块导出,不在测试里重抄一份', () => {
    expect(API_LOGS_NETWORK.network.allowExternal).toBe(true)
  })

  it('/api-logs 这一条路由确实带上了该例外', () => {
    expect(routeCarriesExemption(src, '/api-logs', 'API_LOGS_NETWORK')).toBe(true)
  })

  it('同插件仍装 requireAdmin preHandler(没有鉴权就不许放行)', () => {
    const pluginBody = src.slice(src.indexOf('export const adminMonitoringRoutes'))
    expect(pluginBody.includes("server.addHook('preHandler', requireAdmin)")).toBe(true)
  })

  it('反向对照:不带 config 的同一条路由必须判不出来(证明上一例不是恒真)', () => {
    const naked = src.replace(
      `server.get('/api-logs', { config: API_LOGS_NETWORK }`,
      `server.get('/api-logs', async`,
    )
    expect(naked).not.toBe(src)
    expect(routeCarriesExemption(naked, '/api-logs', 'API_LOGS_NETWORK')).toBe(false)
  })

  it('只放行这一条:同文件其余 GET 不得顺手带上 allowExternal', () => {
    const exempted = [
      ...src.matchAll(/server\.get\('([^']+)',\s*\{\s*config:\s*API_LOGS_NETWORK/g),
    ].map((m) => m[1])
    expect(exempted).toEqual(['/api-logs'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
