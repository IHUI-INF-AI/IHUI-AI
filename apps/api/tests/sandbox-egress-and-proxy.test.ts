// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 沙箱出网面与集成代理的收敛(2026-11-01 安全强化)。
 *
 * 钉三类真实缺陷:
 *  1. `git` 在二进制白名单里,却既不在 NETWORK_COMMANDS 也不在文件工具集
 *     ⇒ 受限沙箱内 `git clone http://169.254.169.254/…` 绕过整套 ssrf-guard
 *       (子进程自己发 DNS/TCP,守卫拦不到),并把远端内容写到未检的参数路径;
 *  2. 集成代理 `new URL(request.path, base)` 在 path 是绝对 URL 时**丢掉 base**
 *     ⇒ 调用方自由挑主机端口,且 applyAuth 之后该集成的 apiKey/Authorization 随行外泄;
 *  3. `timeoutMs` 客户端自报且无上下界(NaN/负数 = 永不超时)。
 * 反向牙都在:摘掉收敛(把子命令表清空 / 不判绝对 URL / 用 `raw ?? 60000`)本文件即红。
 */
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/utils/ssrf-guard.js', () => ({
  // 纯字面判据的同形替身:本文件测的是"主机怎么定",不是 DNS 解析本身
  isPrivateOrReservedIp: (h: string) =>
    /^(10\.|127\.|169\.254\.|192\.168\.|0\.)/.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h),
}))

const { findGitEgressToken, clampSandboxTimeout } = await import(
  '../src/services/workspace-ai-service.js'
)
const { IntegrationManager, isBlockedIntegrationHost } = await import(
  '../src/services/clawdbot/integrations.js'
)

describe('git 出网判据(网络闸的输入)', () => {
  it('逐 token 判据:藏在旗标值后面的外连形态同样被拦(本轮用例实测出的绕过)', () => {
    // 按"首个非旗标操作数"取会被 `git -C <dir> clone <url>` 绕开 —— 那条判据已被本用例证伪
    expect(findGitEgressToken(['git', 'clone', 'http://169.254.169.254/'])).toBe('clone')
    expect(findGitEgressToken(['git', '-C', '/tmp/x', 'clone', 'http://evil/'])).toBe('clone')
    expect(findGitEgressToken(['git', '-c', 'a=b', 'ls-remote', 'http://127.0.0.1:8830'])).toBe(
      'ls-remote',
    )
    expect(findGitEgressToken(['git', 'config', '--global', 'url."http://x".insteadOf'])).toContain(
      '://',
    )
    expect(findGitEgressToken(['git', 'fetch', 'origin'])).toBe('fetch')
  })

  it('正向对照:纯本地 git 操作不被误拦(收权不许顺手砍掉正常能力)', () => {
    expect(findGitEgressToken(['git', 'status'])).toBeNull()
    expect(findGitEgressToken(['git', 'log', '--oneline'])).toBeNull()
    expect(findGitEgressToken(['git', 'diff', 'HEAD~1'])).toBeNull()
    expect(findGitEgressToken(['git', 'apply', 'patch.txt'])).toBeNull()
    expect(findGitEgressToken(['git', 'add', 'clone-notes.md'])).toBeNull()
  })

  it('源码侧闸真实存在,且 git 也被纳入路径参数检查(回潮即红)', () => {
    const src = readFileSync('src/services/workspace-ai-service.ts', 'utf-8')
    expect(src).toContain('findGitEgressToken(tokens)')
    expect(src).toContain("binary === 'git' && this.isNetworkRestricted(mode)")
    const fileToolBlock = src.slice(
      src.indexOf('SANDBOX_FILE_TOOL_BINARIES'),
      src.indexOf('SANDBOX_BINARY_WHITELIST'),
    )
    expect(fileToolBlock).toContain("'git'")
  })

  it('grep 走的是仓内同一份嵌套量词判据(不另造尺子)', () => {
    const src = readFileSync('src/services/workspace-ai-service.ts', 'utf-8')
    const guard = src.indexOf('hasNestedQuantifier(params.pattern)')
    const build = src.indexOf('new RegExp(params.pattern')
    expect(guard, 'ReDoS 闸被摘掉了').toBeGreaterThan(0)
    expect(build).toBeGreaterThan(guard)
    expect(src).toContain("import { hasNestedQuantifier } from './rules-service.js'")
  })
})

describe('沙箱执行超时归一', () => {
  it.each([
    [undefined, 60000],
    [Number.NaN, 60000],
    [Infinity, 60000],
    [-5, 1000],
    [0, 1000],
    [8000, 8000],
    [99_999_999, 120000],
  ])('timeoutMs=%s ⇒ %s', (raw, expected) => {
    expect(clampSandboxTimeout(raw)).toBe(expected)
  })
})

describe('集成代理不得让 path 改写落点主机(凭据随行外泄面)', () => {
  const fetchSpy = vi.spyOn(globalThis, 'fetch')

  afterEach(() => {
    fetchSpy.mockReset()
  })

  function managerWith(baseUrl?: string) {
    const m = new IntegrationManager()
    m.register({ id: 'acme', name: 'acme', enabled: true, baseUrl } as never)
    return m
  }

  function okFetch() {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
      headers: { forEach: () => {} },
    } as never)
  }

  it('已登记 base 时,绝对 URL 形态的 path 直接拒绝,一次外连都不发', async () => {
    okFetch()
    const m = managerWith('https://partner.example')
    await expect(
      m.call({
        integrationId: 'acme',
        method: 'GET',
        path: 'http://169.254.169.254/latest/meta-data',
      } as never),
    ).rejects.toThrow(/相对片段/)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('协议相对 `//host` 同样拒(它同样会换掉 base 的 host)', async () => {
    okFetch()
    const m = managerWith('https://partner.example')
    await expect(
      m.call({ integrationId: 'acme', method: 'GET', path: '//evil.example/x' } as never),
    ).rejects.toThrow(/相对片段/)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('正向对照:相对片段仍按登记的 base 落点,且关闭重定向跟随', async () => {
    okFetch()
    const m = managerWith('https://partner.example')
    const out = await m.call({ integrationId: 'acme', method: 'GET', path: 'v1/ping' } as never)
    expect(out.status).toBe(200)
    const calledUrl = String(fetchSpy.mock.calls[0]![0])
    expect(new URL(calledUrl).origin).toBe('https://partner.example')
    const init = fetchSpy.mock.calls[0]![1] as { redirect?: string }
    expect(init.redirect, '重定向会把已判定的落点换成内网').toBe('error')
  })

  it('自由 URL 型集成:公网落点可用(不砍在用能力)', async () => {
    okFetch()
    const m = managerWith(undefined)
    const out = await m.call({
      integrationId: 'acme',
      method: 'GET',
      path: 'https://other.example/x',
    } as never)
    expect(out.status).toBe(200)
    expect(String(fetchSpy.mock.calls[0]![0])).toBe('https://other.example/x')
  })

  it('自由 URL 型集成不得指向内网/元数据/非 http(s)', async () => {
    okFetch()
    const m = managerWith(undefined)
    for (const path of [
      'http://169.254.169.254/latest/meta-data/',
      'http://127.0.0.1:8830/admin',
      'http://localhost:8802/api/users',
      'file:///etc/passwd',
      'http://metadata.google.internal/x',
    ]) {
      await expect(m.call({ integrationId: 'acme', method: 'GET', path } as never)).rejects.toThrow()
    }
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('isBlockedIntegrationHost:尾点与大小写都不给绕过余地', () => {
    expect(isBlockedIntegrationHost('LOCALHOST')).toBe(true)
    expect(isBlockedIntegrationHost('localhost.')).toBe(true)
    expect(isBlockedIntegrationHost('169.254.169.254')).toBe(true)
    expect(isBlockedIntegrationHost('intranet.internal')).toBe(true)
    expect(isBlockedIntegrationHost('')).toBe(true)
    expect(isBlockedIntegrationHost('api.partner.example')).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
