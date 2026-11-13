// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-444 回归锁:GitHub PR/Issue 端点不得用平台 PAT 代理任意 owner/repo。
 *
 * 缺陷(见 docs/tickets/2026-11/findings-api.md#F-444):
 *   任意登录用户 PUT /github/prs/:number/merge {owner,repo} 即用平台 PAT 合并任意仓库。
 *   根因:GitHubClient.loadTokenForUser 在用户未存个人令牌时回落 process.env.GITHUB_TOKEN,
 *   而 hasTokenForUser 只判非空 ⇒ env 配了平台令牌时对所有人恒 true,
 *   7 个接收调用方 owner/repo 的端点全部变成"平台身份代理读写他人仓库"。
 *
 * 修复:GitHubClient 增加只读本人令牌的 loadOwnTokenForUser / hasOwnTokenForUser
 *   (绝不回落 env);上述端点 requireAuth 之后统一过 403 闸,其余端点(status/detect/
 *   token/device-*)不受影响。
 *
 * 本锁为源码接线锁(与仓库 f-524/f-162/f-368 同型)。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(here, '..', '..', '..')
const routesSrc = readFileSync(resolve(REPO_ROOT, 'apps/api/src/routes/workspace-ai.ts'), 'utf8')
const serviceSrc = readFileSync(
  resolve(REPO_ROOT, 'apps/api/src/services/workspace-ai-service.ts'),
  'utf8',
)

/** 截取某条路由注册点到下一条路由注册点之间的 handler 段。 */
function handlerSegment(src: string, marker: string): string {
  const start = src.indexOf(marker)
  expect(start).toBeGreaterThan(-1)
  const next = src.indexOf('\n  server.', start + marker.length)
  return src.slice(start, next > -1 ? next : undefined)
}

const GATED_ROUTES = [
  "server.post('/github/prs', async",
  "server.get('/github/prs', async",
  "server.get('/github/prs/:number', async",
  "server.post('/github/prs/:number/comments', async",
  "server.post('/github/prs/:number/reviewers', async",
  "server.put('/github/prs/:number/merge', async",
  "server.get('/github/issues', async",
] as const

describe('F-444:任意 owner/repo 端点必须绑定调用者本人 GitHub 令牌', () => {
  it('接线锁:GitHubClient 提供只读本人令牌的 loadOwnTokenForUser', () => {
    expect(serviceSrc).toMatch(/async loadOwnTokenForUser\(userId: string\): Promise<string>/)
  })

  it('缺陷锁:loadOwnTokenForUser 方法体内不得回落 process.env.GITHUB_TOKEN', () => {
    const start = serviceSrc.indexOf('async loadOwnTokenForUser(')
    const end = serviceSrc.indexOf('async hasOwnTokenForUser(', start)
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    const body = serviceSrc.slice(start, end)
    expect(body).not.toMatch(/process\.env\.GITHUB_TOKEN/)
    // 必须仍从 user_preferences 读并解密,否则等于永假闸门
    expect(body).toMatch(/findUserPreferences/)
    expect(body).toMatch(/decryptField/)
  })

  it('接线锁:hasOwnTokenForUser 只基于本人令牌判断', () => {
    const start = serviceSrc.indexOf('async hasOwnTokenForUser(')
    expect(start).toBeGreaterThan(-1)
    const body = serviceSrc.slice(start, start + 200)
    expect(body).toMatch(/loadOwnTokenForUser\(userId\)/)
    expect(body).not.toMatch(/loadTokenForUser\(userId\)/)
  })

  it.each(GATED_ROUTES)('缺陷锁:%s 的 handler 段内有本人令牌 403 闸', (marker) => {
    const seg = handlerSegment(routesSrc, marker)
    expect(seg).toMatch(/hasOwnTokenForUser\(request\.userId\)/)
    expect(seg).toMatch(/\.status\(403\)/)
    expect(seg).toMatch(/error\(403, '此接口需要先配置个人 GitHub 令牌/)
    // 闸门只应出现一次(handler 内统一一道闸)
    expect(seg.match(/hasOwnTokenForUser/g)?.length).toBe(1)
  })

  it('对照锁:/github/status 不接收任意 owner/repo,闸门不得误伤', () => {
    const seg = handlerSegment(routesSrc, "server.post('/github/status', async")
    expect(seg).not.toMatch(/hasOwnTokenForUser/)
  })
})
