// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * POST /admin/relay/accounts/import — 导入形状闸门契约测试(2026-10-27 立)。
 *
 * 背景:路由 Zod 曾硬性要求每个账号有顶层 `token`,而 12 平台里 10 个平台的原生
 * 提取器载荷(codex 的 tokens.access_token / opencode 的 auth.key / minimax 的
 * accessToken / zcode 的 oauth:bigmodel:access_token / loomy·doubao 的 value /
 * codearts 的 securitytoken+AK+SK)在路由层就被挡掉 ⇒ Web 拖拽导入全线不可用,
 * 只有 trae/workbuddy 的 `{token}` 能过;而 CLI 直调 importAccounts 不过 Zod ⇒
 * CLI 能导、Web 不能导,两套口径割裂。
 *
 * 本文件锁住修复后的口径:
 * - 12 平台代表性原生形状都能过路由层并进入 service(形状判据下沉到 service 层);
 * - 垃圾形状(空对象 / 无任何认得键 / 平台名不认识)被拒且错误可读;
 * - 老 `{token}` 形状仍通;
 * - 单批 500 上限仍生效;
 * - 零凭据回显(响应面绝不出现 token 值)。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify, { type FastifyInstance, type InjectOptions } from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const hoisted = vi.hoisted(() => ({
  /** 路由编排面只关心"有没有把载荷原样交给 service",落库语义由 service 单测锁 */
  importAccounts: vi.fn(async (_providerCode: string, accounts: unknown[]) => ({
    providerCode: 'trae',
    total: accounts.length,
    imported: accounts.length,
    updated: 0,
    skipped: 0,
    failed: 0,
    items: accounts.map((_acc, index) => ({
      index,
      name: `#${index + 1}`,
      uid: null,
      status: 'imported',
      reason: null,
    })),
  })),
}))

vi.mock('../../plugins/require-permission.js', () => ({
  requireAdmin: async () => {},
}))
vi.mock('../../db/index.js', () => ({
  db: {
    update: () => ({
      set: () => ({ where: async () => [] }),
    }),
  },
  dbRead: {
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => [] }),
      }),
    }),
  },
}))
vi.mock('@ihui/database', () => ({
  aiRelayAccountPool: new Proxy(
    {},
    { get: (_t, prop) => ({ __col: typeof prop === 'string' ? prop : String(prop) }) },
  ),
}))
vi.mock('@ihui/types', () => ({
  PROVIDER_HEALTH_STATUSES: ['healthy', 'degraded', 'down', 'unknown'],
  CHAT_SYNC_EVENT_NAMES: {
    MESSAGE_CREATED: 'message:created',
    MESSAGE_PATCHED: 'message:patched',
    MESSAGE_TERMINAL: 'message:terminal',
  },
}))
vi.mock('../../utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('../../services/relay-account-pool-service.js', () => ({
  importAccounts: hoisted.importAccounts,
  decryptAccountCredentials: vi.fn(() => ({
    token: 'tok-1',
    refreshToken: 'ref-1',
    cookies: [],
    secrets: {},
  })),
  // 路由新增的手机号补全端点(2026-10-28)从同一模块取这两个导出;mock 少一个导出
  // 会让整套件 collection 失败(vitest 对 mock 工厂返回值做导出存在性校验)。
  completeAccountPhone: vi.fn(async () => ({
    code: 'ok',
    message: null,
    id: 'row-1',
    oldName: null,
    name: null,
    changed: false,
    checkinSync: { pushed: 0, pending: false, error: null },
  })),
  matchPhoneCandidates: vi.fn(async () => ({
    scannedMasked: 0,
    matched: [],
    ambiguous: [],
    unmatched: [],
    rejected: [],
  })),
}))
vi.mock('../../services/relay-account-pool-scheduler.js', () => ({
  sweepAccountPool: vi.fn(async () => ({})),
}))
vi.mock('../../services/relay-account-usage.js', () => ({
  getAccountUsage: vi.fn(async () => ({})),
  getAccountUsageSummaries: vi.fn(async () => new Map()),
  purgeAccountUsage: vi.fn(async () => 0),
}))
vi.mock('../../services/relay-upstream-adapters.js', () => ({
  getRelayAdapter: vi.fn(() => null),
}))
vi.mock('../../services/relay-proxy-pool.js', () => ({
  listProxies: vi.fn(async () => ({})),
  createProxy: vi.fn(async () => ({})),
  updateProxy: vi.fn(async () => ({})),
  deleteProxy: vi.fn(async () => ({})),
  markProxyChecked: vi.fn(async () => ({})),
  encryptAccountProxyUrl: (u: string | null) => u,
  resolveAccountProxyUrl: (u: string | null) => u,
  maskAccountProxyUrl: () => null,
}))
vi.mock('../../services/relay-model-catalog.js', () => ({
  listModelCatalog: vi.fn(async () => ({})),
  createModelCatalog: vi.fn(async () => ({})),
  deleteModelCatalog: vi.fn(async () => ({})),
}))
vi.mock('../../services/relay-account-pool-checkin-sync.js', () => ({
  checkinPlatformFor: () => null,
  buildPoolSyncAccount: vi.fn((src: unknown) => src),
  pushPoolSync: vi.fn(async () => ({
    ok: true,
    pushed: 0,
    skipped: 0,
    failed: 0,
    failedIds: [],
    error: null,
  })),
  pushPoolState: vi.fn(async () => ({ ok: true, error: null })),
  markCheckinSyncPending: vi.fn(async () => {}),
  clearCheckinSyncPending: vi.fn(async () => {}),
  extractCosy: vi.fn(() => null),
  pemFromSecrets: vi.fn(() => null),
  fetchPoolStatus: vi.fn(async () => ({ ok: true, found: false })),
  postPoolRun: vi.fn(async () => ({ ok: true, httpStatus: 200, record: null, error: null })),
  listCheckinSyncPending: vi.fn(async () => []),
  retryPendingCheckinSyncs: vi.fn(async () => ({})),
  parseCheckinSyncMeta: vi.fn(() => ({})),
}))

import relayAccountPoolRoutes from '../admin/relay-account-pool.js'

let app: FastifyInstance

/** 12 平台代表性原生形状(键位单源在 relay-account-format.RELAY_IMPORT_CREDENTIAL_SLOTS) */
const NATIVE_SHAPES: Array<{ providerCode: string; account: Record<string, unknown> }> = [
  { providerCode: 'trae', account: { token: 'trae-native-token' } },
  { providerCode: 'workbuddy', account: { token: 'wb-native-token' } },
  {
    providerCode: 'codearts',
    account: { securitytoken: 'sts-native', accessKey: 'ak-native', secretKey: 'sk-native' },
  },
  { providerCode: 'qoder', account: { token: 'dt-native-opaque' } },
  { providerCode: 'codex', account: { tokens: { access_token: 'codex-native' } } },
  { providerCode: 'opencode', account: { auth: { type: 'api', key: 'opencode-native' } } },
  { providerCode: 'minimax', account: { accessToken: 'minimax-native' } },
  { providerCode: 'zcode', account: { 'oauth:bigmodel:access_token': 'zcode-native' } },
  { providerCode: 'loomy', account: { source: 's', key: 'k', host: 'h', value: 'loomy-native' } },
  { providerCode: 'doubao', account: { source: 's', key: 'k', host: 'h', value: 'doubao-native' } },
  { providerCode: 'lingma', account: { token: 'lingma-native' } },
  // GrokBot:本机凭证是 sandSealedFile 密封串 —— 形状认得(能过路由层),导不进去由 service 点名
  {
    providerCode: 'grokbot',
    account: { credential: { sandSealedFile: 1, data: 'sealed-native' } },
  },
]

beforeEach(async () => {
  hoisted.importAccounts.mockClear()
  app = Fastify()
  app.register(relayAccountPoolRoutes, { prefix: '/api' })
  await app.ready()
})

async function postImport(payload: InjectOptions['payload']) {
  return await app.inject({
    method: 'POST',
    url: '/api/admin/relay/accounts/import',
    payload,
  })
}

/** 原始 JSON 串投递(要造出带 __proto__ 自有属性的载荷时用:对象字面量那写法会被当原型设置器) */
async function postImportRaw(json: string) {
  return await app.inject({
    method: 'POST',
    url: '/api/admin/relay/accounts/import',
    payload: json,
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /admin/relay/accounts/import — 12 平台原生形状过路由层', () => {
  it.each(NATIVE_SHAPES)(
    '$providerCode 原生形状不被 Zod 挡住,原样交给 service',
    async ({ providerCode, account }) => {
      const res = await postImport({ providerCode, accounts: [account] })
      expect(res.statusCode).toBe(200)
      expect(hoisted.importAccounts).toHaveBeenCalledTimes(1)
      const [calledProvider, calledAccounts] = hoisted.importAccounts.mock.calls[0]!
      expect(calledProvider).toBe(providerCode)
      // 原生字段一个都不能被路由裁掉(tokens/auth/accessToken 这类全靠透传给 service)
      expect(calledAccounts[0]).toEqual(account)
    },
  )

  it('老 {token} 形状仍通(trae/workbuddy 存量账号不受影响)', async () => {
    const res = await postImport({
      providerCode: 'trae',
      accounts: [{ name: '存量号', token: 'legacy-token', refreshToken: 'legacy-rt' }],
    })
    expect(res.statusCode).toBe(200)
    expect(hoisted.importAccounts).toHaveBeenCalledTimes(1)
  })

  it('外来别名形状(access_token)仍通 —— 归一在 service 层,路由不越权改写载荷', async () => {
    const res = await postImport({
      providerCode: 'workbuddy',
      accounts: [{ access_token: 'foreign-token', nickname: '某人的号' }],
    })
    expect(res.statusCode).toBe(200)
    expect(hoisted.importAccounts).toHaveBeenCalledTimes(1)
  })

  it('混合批次:认得出的条目照常进 service(认不出的由 service 逐条拒,好条目不连坐)', async () => {
    const res = await postImport({
      providerCode: 'codex',
      accounts: [{ tokens: { access_token: 'codex-native' } }, { foo: 'bar' }],
    })
    expect(res.statusCode).toBe(200)
    expect(hoisted.importAccounts).toHaveBeenCalledTimes(1)
    expect(hoisted.importAccounts.mock.calls[0]![1]).toHaveLength(2)
  })
})

describe('POST /admin/relay/accounts/import — 垃圾形状被拒且错误可读', () => {
  it('空对象条目 → 400 且说清是空对象', async () => {
    const res = await postImport({ providerCode: 'trae', accounts: [{}] })
    expect(res.statusCode).toBe(400)
    expect(res.json().message).toContain('空对象')
    expect(hoisted.importAccounts).not.toHaveBeenCalled()
  })

  it('无任何认得键 → 400 整批拒绝并逐条点名缺哪个键', async () => {
    const res = await postImport({
      providerCode: 'codex',
      accounts: [{ foo: 'bar' }, { baz: 1 }],
    })
    expect(res.statusCode).toBe(400)
    const message = res.json().message as string
    expect(message).toContain('导入被拒')
    expect(message).toContain('tokens.access_token')
    expect(message).toContain('#1')
    expect(message).toContain('#2')
    expect(hoisted.importAccounts).not.toHaveBeenCalled()
  })

  it('平台名不认识 → 400「不支持的平台」', async () => {
    const res = await postImport({ providerCode: 'not-a-platform', accounts: [{ token: 't' }] })
    expect(res.statusCode).toBe(400)
    expect(res.json().message).toContain('不支持的平台')
    expect(hoisted.importAccounts).not.toHaveBeenCalled()
  })

  it('形状与平台不匹配(codex 载荷拖进 trae)→ 400 并点名缺哪个键', async () => {
    const res = await postImport({
      providerCode: 'trae',
      accounts: [{ tokens: { access_token: 'codex-native' } }],
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().message).toContain('token')
    expect(hoisted.importAccounts).not.toHaveBeenCalled()
  })

  it('字段名非法(原型链键 constructor)→ 400,不进 service', async () => {
    const res = await postImport({
      providerCode: 'trae',
      accounts: [{ token: 't', constructor: { polluted: true } }],
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().message).toContain('字段名非法')
    expect(hoisted.importAccounts).not.toHaveBeenCalled()
  })

  it('字段名非法(__proto__)→ 400(JSON 解析层就先拦下,路由闸门是第二道)', async () => {
    const res = await postImportRaw(
      '{"providerCode":"trae","accounts":[{"token":"t","__proto__":{"polluted":true}}]}',
    )
    expect(res.statusCode).toBe(400)
    expect(hoisted.importAccounts).not.toHaveBeenCalled()
  })

  it('字段数超上限 → 400,不进 service', async () => {
    const acc: Record<string, unknown> = { token: 't' }
    for (let i = 0; i < 80; i++) acc[`k${i}`] = 'v'
    const res = await postImport({ providerCode: 'trae', accounts: [acc] })
    expect(res.statusCode).toBe(400)
    expect(res.json().message).toContain('字段数超上限')
    expect(hoisted.importAccounts).not.toHaveBeenCalled()
  })

  it('accounts 里塞非对象(字符串)→ 400,不进 service', async () => {
    const res = await postImport({ providerCode: 'trae', accounts: ['not-an-object'] })
    expect(res.statusCode).toBe(400)
    expect(hoisted.importAccounts).not.toHaveBeenCalled()
  })

  it('accounts 为空 → 400,不进 service', async () => {
    const res = await postImport({ providerCode: 'trae', accounts: [] })
    expect(res.statusCode).toBe(400)
    expect(hoisted.importAccounts).not.toHaveBeenCalled()
  })
})

describe('POST /admin/relay/accounts/import — 批量上限与零凭据回显', () => {
  it('单批 500 条放行', async () => {
    const accounts = Array.from({ length: 500 }, (_, i) => ({ token: `t-${i}` }))
    const res = await postImport({ providerCode: 'trae', accounts })
    expect(res.statusCode).toBe(200)
    expect(hoisted.importAccounts.mock.calls[0]![1]).toHaveLength(500)
  })

  it('单批 501 条 → 400(上限仍在)', async () => {
    const accounts = Array.from({ length: 501 }, (_, i) => ({ token: `t-${i}` }))
    const res = await postImport({ providerCode: 'trae', accounts })
    expect(res.statusCode).toBe(400)
    expect(hoisted.importAccounts).not.toHaveBeenCalled()
  })

  it('零凭据回显:被拒载荷的凭据值一个字符都不回显', async () => {
    const res = await postImport({
      providerCode: 'trae',
      accounts: [{ tokens: { access_token: 'SUPER-SECRET-VALUE' } }],
    })
    expect(res.statusCode).toBe(400)
    expect(res.body).not.toContain('SUPER-SECRET-VALUE')
  })

  it('零凭据回显:放行路径的响应面也不含凭据值', async () => {
    const res = await postImport({
      providerCode: 'codex',
      accounts: [{ tokens: { access_token: 'SUPER-SECRET-VALUE' } }],
    })
    expect(res.statusCode).toBe(200)
    expect(res.body).not.toContain('SUPER-SECRET-VALUE')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
