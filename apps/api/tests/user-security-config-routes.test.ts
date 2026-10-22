// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const AUTH_USER_ID = '11111111-1111-4111-8111-111111111111'
const VICTIM_USER_ID = '22222222-2222-4222-8222-222222222222'

const q = vi.hoisted(() => ({
  checkAuth: vi.fn(),
  findUserPreferences: vi.fn(),
  upsertUserPreference: vi.fn(),
  deleteUserPreference: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({ checkAuth: q.checkAuth }))
vi.mock('../src/db/user-preferences-queries.js', () => ({
  // group 词表按同一取值交出:路由若抄别的字面量,store 里就找不到行 ⇒ 当场可见
  USER_PREFERENCE_GROUPS: { security: 'security' },
  findUserPreferences: q.findUserPreferences,
  upsertUserPreference: q.upsertUserPreference,
  deleteUserPreference: q.deleteUserPreference,
}))

import { userSecurityConfigRoutes } from '../src/routes/user/security-config-routes.js'

let app: FastifyInstance

/** 一张按 (userId, group, key) 寻址的假偏好表 —— 写面真的改它,读面真的从它取。 */
type Store = Map<string, string>
let store: Store
const rowKey = (userId: string, group: string, key: string) => `${userId}|${group}|${key}`

beforeAll(async () => {
  app = Fastify()
  await app.register(userSecurityConfigRoutes, { prefix: '/api' })
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  vi.clearAllMocks()
  store = new Map()
  q.checkAuth.mockImplementation(async (request: { userId?: string }) => {
    request.userId = AUTH_USER_ID
    return true
  })
  q.findUserPreferences.mockImplementation(async (userId: string, group?: string) => {
    const list: { id: string; key: string; value: string | null }[] = []
    for (const [k, v] of store) {
      const [u, g, key] = k.split('|')
      if (u === userId && (!group || g === group)) list.push({ id: k, key, value: v })
    }
    return { list, total: list.length }
  })
  q.upsertUserPreference.mockImplementation(
    async (userId: string, group: string, key: string, value: string | null) => {
      store.set(rowKey(userId, group, key), value ?? '')
      return { id: rowKey(userId, group, key), userId, group, key, value }
    },
  )
  q.deleteUserPreference.mockImplementation((userId: string, group: string, key: string) => {
    store.delete(rowKey(userId, group, key))
    return true
  })
})

const putIp = (ip: string) =>
  app.inject({ method: 'POST', url: '/api/user/ip-whitelist', payload: { ip } })
const getIps = () => app.inject({ method: 'GET', url: '/api/user/ip-whitelist' })

describe('GET/POST/DELETE /api/user/ip-whitelist', () => {
  it('未配置时 GET 回空数组(不是 null,web 侧 setIps(res.data) 直接当数组用)', async () => {
    const res = await getIps()
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual([])
  })

  it('写入后读回同一份;重复提交同一 IP 不产生第二份(幂等追加)', async () => {
    expect((await putIp('203.0.113.9')).json().data).toEqual(['203.0.113.9'])
    expect((await putIp('203.0.113.9')).json().data).toEqual(['203.0.113.9'])
    expect((await putIp('2001:db8::1')).json().data).toEqual(['203.0.113.9', '2001:db8::1'])
    expect((await getIps()).json().data).toEqual(['203.0.113.9', '2001:db8::1'])
    // 自救锚点行随每次写面刷新(ipWhitelistTrustedIp),这里只盯列表行本身
    expect([...store.keys()].filter((k) => k.endsWith('|ipWhitelist'))).toEqual([
      rowKey(AUTH_USER_ID, 'security', 'ipWhitelist'),
    ])
  })

  it('DELETE 摘一条;摘到空时删行而不是留 "[]"', async () => {
    await putIp('203.0.113.9')
    await putIp('198.51.100.7')
    const one = await app.inject({
      method: 'DELETE',
      url: `/api/user/ip-whitelist?ip=${encodeURIComponent('203.0.113.9')}`,
    })
    expect(one.statusCode).toBe(200)
    expect(one.json().data).toEqual(['198.51.100.7'])
    const last = await app.inject({
      method: 'DELETE',
      url: `/api/user/ip-whitelist?ip=${encodeURIComponent('198.51.100.7')}`,
    })
    expect(last.json().data).toEqual([])
    // 列表行被删,自救锚点行留守(清空白名单的那台 IP 仍是自救出口)
    expect(store.has(rowKey(AUTH_USER_ID, 'security', 'ipWhitelist'))).toBe(false)
    expect(store.get(rowKey(AUTH_USER_ID, 'security', 'ipWhitelistTrustedIp'))).toBe('127.0.0.1')
    expect(q.deleteUserPreference).toHaveBeenCalledWith(AUTH_USER_ID, 'security', 'ipWhitelist')
  })

  it('CIDR 段当场 400,且不落库(存进没人执行的语法比拒收更坏)', async () => {
    const res = await putIp('10.0.0.0/24')
    expect(res.statusCode).toBe(400)
    expect(q.upsertUserPreference).not.toHaveBeenCalled()
    expect(store.size).toBe(0)
  })

  it('缺 ip / 空串 / 自报多余字段 ⇒ 400 且零写入(strictObject 不静默摘除)', async () => {
    for (const payload of [
      {},
      { ip: '' },
      { ip: 'not-an-ip' },
      { ip: '203.0.113.9', userId: VICTIM_USER_ID },
    ]) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/user/ip-whitelist',
        payload,
      })
      expect(res.statusCode, JSON.stringify(payload)).toBe(400)
    }
    expect(q.upsertUserPreference).not.toHaveBeenCalled()
    expect((await getIps()).json().data).toEqual([])
  })

  it('GET 混入 ?userId= ⇒ 400 且一次查询都不发;正向对照用钩子注入的主体', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/user/ip-whitelist?userId=${VICTIM_USER_ID}`,
    })
    expect(res.statusCode).toBe(400)
    expect(q.findUserPreferences).not.toHaveBeenCalled()
    const ok = await getIps()
    expect(ok.statusCode).toBe(200)
    expect(q.findUserPreferences).toHaveBeenCalledWith(AUTH_USER_ID, 'security')
    expect(q.findUserPreferences).not.toHaveBeenCalledWith(VICTIM_USER_ID, 'security')
  })

  it('DELETE 不带 ip ⇒ 400 且零写零删', async () => {
    await putIp('203.0.113.9')
    q.upsertUserPreference.mockClear()
    const res = await app.inject({ method: 'DELETE', url: '/api/user/ip-whitelist' })
    expect(res.statusCode).toBe(400)
    expect(q.upsertUserPreference).not.toHaveBeenCalled()
    expect(q.deleteUserPreference).not.toHaveBeenCalled()
  })

  it('无凭据 ⇒ 401 且零查询(五面全要)', async () => {
    q.checkAuth.mockImplementation(
      async (
        _request: unknown,
        reply: { status: (n: number) => { send: (b: unknown) => unknown } },
      ) => {
        reply.status(401).send({ code: 401, message: '请先登录', data: null })
        return false
      },
    )
    for (const req of [
      { method: 'GET' as const, url: '/api/user/ip-whitelist' },
      { method: 'POST' as const, url: '/api/user/ip-whitelist', payload: { ip: '203.0.113.9' } },
      { method: 'DELETE' as const, url: '/api/user/ip-whitelist?ip=203.0.113.9' },
      { method: 'GET' as const, url: '/api/agent/security-config' },
      {
        method: 'PUT' as const,
        url: '/api/agent/security-config',
        payload: { input_scan_enabled: false },
      },
    ]) {
      const res = await app.inject(req)
      expect(res.statusCode, req.url).toBe(401)
    }
    expect(q.findUserPreferences).not.toHaveBeenCalled()
    expect(q.upsertUserPreference).not.toHaveBeenCalled()
  })
})

describe('GET/PUT /api/agent/security-config', () => {
  it('缺行回默认,与 web 页 useState 初值逐字段同形', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/agent/security-config' })
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toEqual({
      prompt_guard_enabled: true,
      prompt_guard_policy: 'flag',
      exec_policy_mode: 'enforce',
      input_scan_enabled: true,
      pipeline_record_enabled: false,
    })
  })

  it("单键 PUT 落库后 GET 读回同值;布尔按 '1'/'0' 口径存", async () => {
    for (const payload of [
      { prompt_guard_policy: 'refuse' },
      { exec_policy_mode: 'audit' },
      { pipeline_record_enabled: true },
      { prompt_guard_enabled: false },
    ]) {
      const put = await app.inject({ method: 'PUT', url: '/api/agent/security-config', payload })
      expect(put.statusCode).toBe(200)
      expect(put.json().data).toEqual(payload)
    }
    expect(
      store.get(rowKey(AUTH_USER_ID, 'security', 'agentSecurity.pipeline_record_enabled')),
    ).toBe('1')
    expect(store.get(rowKey(AUTH_USER_ID, 'security', 'agentSecurity.prompt_guard_enabled'))).toBe(
      '0',
    )
    const res = await app.inject({ method: 'GET', url: '/api/agent/security-config' })
    expect(res.json().data).toEqual({
      prompt_guard_enabled: false,
      prompt_guard_policy: 'refuse',
      exec_policy_mode: 'audit',
      input_scan_enabled: true,
      pipeline_record_enabled: true,
    })
  })

  it('未知键 / 空对象 / 越界枚举 ⇒ 400 且零写入', async () => {
    for (const payload of [
      {},
      { notARealKey: true },
      { userId: VICTIM_USER_ID },
      { prompt_guard_policy: 'nuke' },
      { exec_policy_mode: 'enforce', extra: 1 },
      { prompt_guard_enabled: 'yes' },
    ]) {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/agent/security-config',
        payload,
      })
      expect(res.statusCode, JSON.stringify(payload)).toBe(400)
    }
    expect(q.upsertUserPreference).not.toHaveBeenCalled()
    expect(store.size).toBe(0)
  })

  it('库里存了个坏枚举 ⇒ 读回落默认,不把 500 甩给前端', async () => {
    store.set(rowKey(AUTH_USER_ID, 'security', 'agentSecurity.exec_policy_mode'), 'teleport')
    const res = await app.inject({ method: 'GET', url: '/api/agent/security-config' })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.exec_policy_mode).toBe('enforce')
  })
})

describe('注册即装车 + 调用点契约对账(造好没接线是本仓最高频失效型)', () => {
  const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  }).trim()
  const INDEX_PATH = 'apps/api/src/routes/index.ts'
  const ROUTE_PATH = 'apps/api/src/routes/user/security-config-routes.ts'

  const judge = (src: string) =>
    /import\s*\{\s*userSecurityConfigRoutes\s*\}\s*from\s*'\.\/user\/security-config-routes\.js'/u.test(
      src,
    ) &&
    /server\.register\(\s*userSecurityConfigRoutes\s*,\s*\{\s*prefix:\s*'\/api'\s*\}\s*\)/u.test(
      src,
    )

  const readWorktree = (rel: string) => readFileSync(join(repoRoot, rel), 'utf8')

  it('routes/index.ts 必须 import 且以 prefix /api 注册 userSecurityConfigRoutes', () => {
    expect(judge(readWorktree(INDEX_PATH))).toBe(true)
  })

  it('双向对照:同一判据喂工作树必 true;两面同形时喂 HEAD 也必 true,分叉时喂 HEAD 必 false', () => {
    const worktreeSrc = readWorktree(INDEX_PATH)
    const headSrc = execFileSync('git', ['-C', repoRoot, 'show', `HEAD:${INDEX_PATH}`], {
      encoding: 'utf8',
      maxBuffer: 1 << 26,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    if (headSrc === worktreeSrc) expect(judge(headSrc)).toBe(true)
    else expect(judge(headSrc)).toBe(false)
    expect(judge(worktreeSrc)).toBe(true)
    // 取材面自证:HEAD 面确实装着上一枚已落地的同类注册(不是空串糊出来的 false)
    expect(
      /server\.register\(\s*userSecurityRoutes\s*,\s*\{\s*prefix:\s*'\/api'\s*\}\s*\)/u.test(
        headSrc,
      ),
    ).toBe(true)
  })

  it('路由内字面量 + 注册 prefix 合成后逐字等于 web 两个调用点(漂移即红)', () => {
    const routeSrc = readWorktree(ROUTE_PATH)
    const inner = new Set([
      ...[...routeSrc.matchAll(/server\.(get|post|put|delete)\(\s*'([^']*)'/gu)].map(
        (m) => `/api${m[2]}`,
      ),
    ])
    expect(inner).toEqual(new Set(['/api/user/ip-whitelist', '/api/agent/security-config']))
    // 调用点:IpWhitelist.tsx 的三条 + agent-security 页的 GET/PUT(fetchApi 把 /x 归一成 /api/x)
    const callers = [
      [
        readWorktree('apps/web/src/components/settings/IpWhitelist.tsx'),
        /'\/api\/user\/ip-whitelist'/u,
      ],
      [
        readWorktree('apps/web/app/(main)/settings/agent-security/page.tsx'),
        /fetchApi<AgentSecurityConfig>\('\/agent\/security-config'\)/u,
      ],
      [
        readWorktree('apps/web/app/(main)/settings/agent-security/page.tsx'),
        /fetchApi\('\/agent\/security-config',\s*\{\s*method:\s*'PUT'/u,
      ],
    ] as const
    for (const [src, re] of callers) expect(re.test(src), re.source).toBe(true)
    for (const p of ['/api/user/ip-whitelist', '/api/agent/security-config']) {
      expect(inner.has(p), `${p} 未在册`).toBe(true)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
