// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 内部服务端点边缘封禁(2026-10-31 安全强化第 14 批)。
 *
 * 病灶(现读实测,不是推断):本机前门是 EdgeOne/Cloudflared → Next(8801) →
 * rewrites → Fastify(8802),而 next.config.ts 的 `/api/:path*` 是通配 rewrite。
 * 于是 `/api/internal/*`(号池凭据回写、用户池 upsert/delete、MCP 状态广播、
 * 工具调用台账摄入)从公网结构上可达,防线只剩单一 X-Internal-Secret。
 * 实测证据:经 8801 打 `/api/internal/relay/user-pool/upsert` 拿到的是
 * `{"code":403,"message":"CSRF 令牌缺失或无效"}` —— 应用层网络分段没触发,
 * 而 `/api/csrf-token` 是公开端点(200),对直接发 HTTP 的工具不构成防线。
 *
 * 本用例锁三层:
 *  - `/api/internal/*` 与 `/ai-service/internal/*` 一律 403(带任何 cookie/头都不放行);
 *  - **同前缀但不带斜杠的兄弟路径也拦**(`/api/internal`),避免"少一个斜杠就绕" ;
 *  - 相邻的公共面不受影响(`/api/health`、`/api/internality-check` 这类不同族路径)。
 *
 * 第二层(应用层)在 apps/api:network-segment 的 `denyProxied`,
 * 见 apps/api/tests/network-segment-deny-proxied.test.ts。
 */
import type { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const verifyAccessTokenEdge = vi.hoisted(() => vi.fn<(token: string) => Promise<unknown>>())

vi.mock('@/lib/auth-utils', () => ({ verifyAccessTokenEdge }))

import { proxy } from '../../proxy'

/** proxy 只读 cookie、host 头、nextUrl;用最小桩(与 proxy-guard.test.ts 同款理由)。 */
function request(path: string, cookies: Record<string, string> = {}): NextRequest {
  const url = new URL(`https://aizhs.top${path}`)
  return {
    headers: new Headers({ host: 'aizhs.top' }),
    nextUrl: Object.assign(url, { clone: () => new URL(url.href) }),
    cookies: {
      get: (name: string) => (cookies[name] !== undefined ? { value: cookies[name] } : undefined),
    },
  } as unknown as NextRequest
}

beforeEach(() => {
  verifyAccessTokenEdge.mockReset()
  verifyAccessTokenEdge.mockResolvedValue({ sub: 'u1' })
})

describe('内部端点边缘封禁(第 14 批)', () => {
  it.each([
    '/api/internal/relay/user-pool/upsert',
    '/api/internal/relay/user-pool/delete',
    '/api/internal/relay/account-pool/credential',
    '/api/internal/user-broadcast/mcp-status',
    '/api/internal/tool-ledger/invocation',
    '/api/internal',
  ])('%s ⇒ 403', async (path) => {
    const res = (await proxy(request(path))) as Response
    expect(res.status).toBe(403)
  })

  it.each(['/ai-service/internal/checkin', '/ai-service/internal', '/ai-service/internal/'])(
    '%s ⇒ 403',
    async (path) => {
      const res = (await proxy(request(path))) as Response
      expect(res.status).toBe(403)
    },
  )

  it('携带有效 access cookie 也不放行(封禁与登录态无关)', async () => {
    const res = (await proxy(
      request('/api/internal/tool-ledger/invocation', { auth_token: 'valid' }),
    )) as Response
    expect(res.status).toBe(403)
  })

  it('不同族的相邻路径不受影响(/api/health 放行)', async () => {
    const res = (await proxy(request('/api/health'))) as Response
    expect(res.status).not.toBe(403)
  })

  it('名称相近但不是内部族(/api/internal-audit/x)不受影响 —— 判据是族前缀不是子串', async () => {
    const res = (await proxy(request('/api/internal-audit/x'))) as Response
    expect(res.status).not.toBe(403)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
