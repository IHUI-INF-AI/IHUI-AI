// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 权限档存值迁移 · 第①步(写侧)契约 —— 零真实 DB。
 *
 * 钉住三件事(缺一即第②步幂等回填的前提不成立):
 * 1. **写入落规范档 camel**:`workspace_permissions.mode` 与新写入的
 *    `user_preferences.defaultPermissionMode` 只允许出现 PERMISSION_MODES(5 值 camel);
 * 2. **出参仍是 wire kebab**:REST 契约逐字不变(packages/api-client 的
 *    `WorkspacePermission.mode` = kebab 4 值),入参两种拼写都收;
 * 3. **混合态可读**:库里同时存在遗留 kebab 行与新 camel 行时,读路径归一出同一个 wire
 *    —— 这是回填前后都能正常服务的安全网。
 *
 * `upsertPermission` 桩刻意**照 `.returning()` 的语义把写入值原样回吐**,
 * 于是"响应里是 kebab"只有在"写进去的就是 camel"时才可能通过 —— 两侧一次性钉死。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify'
import {
  PERMISSION_MODES,
  PERMISSION_MODE_WIRE,
  PERMISSION_MODE_WIRE_VALUES,
  type PermissionModeId,
  type PermissionModeWire,
} from '@ihui/types/permission-mode'

const {
  upsertPermission,
  getPermission,
  listPermissionsByUser,
  appendAuditLog,
  clearUserRules,
  createRulesBulk,
  findUserPreferences,
  upsertUserPreference,
  storedPrefs,
} = vi.hoisted(() => ({
  upsertPermission: vi.fn(),
  getPermission: vi.fn(),
  listPermissionsByUser: vi.fn(),
  appendAuditLog: vi.fn(),
  clearUserRules: vi.fn(),
  createRulesBulk: vi.fn(),
  findUserPreferences: vi.fn(),
  upsertUserPreference: vi.fn(),
  storedPrefs: { value: null as string | null },
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: async (request: FastifyRequest) => {
    request.userId = 'user-1'
  },
}))

vi.mock('../src/services/workspace-ai-service.js', () => ({
  permissionManager: {
    listWorkspacePending: vi.fn(() => []),
    resolveWorkspace: vi.fn(() => true),
  },
}))

vi.mock('../src/db/workspace-permission-queries.js', () => ({
  getPermission,
  listPermissionsByUser,
  upsertPermission,
  deletePermission: vi.fn(),
  listRules: vi.fn(async () => []),
  createRule: vi.fn(),
  updateRule: vi.fn(),
  deleteRule: vi.fn(),
  createRulesBulk,
  clearUserRules,
  appendAuditLog,
  listAuditLogs: vi.fn(async () => []),
}))

vi.mock('../src/db/user-preferences-queries.js', () => ({
  findUserPreferences: vi.fn(async () => ({
    list:
      storedPrefs.value === null
        ? []
        : [{ key: 'defaultPermissionMode', value: storedPrefs.value }],
  })),
  upsertUserPreference: vi.fn(
    async (_userId: string, _group: string, _key: string, value: string) => {
      storedPrefs.value = value
    },
  ),
}))

import { workspacePermissionRoutes } from '../src/routes/workspace-permissions.js'

/** 与 Postgres `.returning()` 同形:写入什么 mode,回读就是什么 mode(不做任何拼写加工)。 */
function rowFrom(data: {
  userId: string
  workspacePath: string
  name: string
  techStack?: string
  mode: string
}) {
  const now = new Date('2026-09-23T00:00:00.000Z')
  return {
    id: 'perm-1',
    userId: data.userId,
    workspacePath: data.workspacePath,
    name: data.name,
    techStack: data.techStack ?? null,
    mode: data.mode,
    lastAccessedAt: now,
    createdAt: now,
    updatedAt: now,
  }
}

const WIRE_TO_ID = Object.fromEntries(
  Object.entries(PERMISSION_MODE_WIRE).map(([id, wire]) => [wire, id]),
) as Record<PermissionModeWire, PermissionModeId>

let app: FastifyInstance

beforeEach(async () => {
  vi.clearAllMocks()
  storedPrefs.value = null
  upsertPermission.mockImplementation(async (data: Parameters<typeof rowFrom>[0]) => rowFrom(data))
  getPermission.mockResolvedValue(undefined)
  listPermissionsByUser.mockResolvedValue([])
  app = Fastify()
  await app.register(workspacePermissionRoutes, { prefix: '/api/workspace' })
  await app.ready()
})

/** PUT /permissions:返回 [落库值, 出参值] */
async function putWorkspaceMode(mode: string) {
  const res = await app.inject({
    method: 'PUT',
    url: '/api/workspace/permissions',
    payload: { workspacePath: 'D:/demo', name: 'demo', mode },
  })
  const lastWrite = upsertPermission.mock.calls.at(-1)?.[0] as { mode: string } | undefined
  return {
    status: res.statusCode,
    stored: lastWrite?.mode,
    body: res.json(),
  }
}

/** PUT /permission-default:返回 [落库值, 出参值] */
async function putDefaultMode(mode: string) {
  const res = await app.inject({
    method: 'PUT',
    url: '/api/workspace/permission-default',
    payload: { mode },
  })
  return {
    status: res.statusCode,
    stored: storedPrefs.value,
    body: res.json(),
  }
}

describe('① 写侧翻正:kebab 入参 → 落库 camel,出参仍 kebab', () => {
  for (const wire of PERMISSION_MODE_WIRE_VALUES) {
    it(`PUT /permissions mode=${wire} → 存 ${WIRE_TO_ID[wire]} / 吐 ${wire}`, async () => {
      const { status, stored, body } = await putWorkspaceMode(wire)
      expect(status).toBe(200)
      expect(stored).toBe(WIRE_TO_ID[wire])
      expect(body.data.permission.mode).toBe(wire)
    })
  }
})

describe('② 幂等:camel 入参与 kebab 入参结果逐字相同', () => {
  for (const id of PERMISSION_MODES) {
    const wire = PERMISSION_MODE_WIRE[id]
    it.skipIf(!wire)(`PUT /permissions mode=${id} 与 mode=${wire} 同结果`, async () => {
      const camel = await putWorkspaceMode(id)
      const kebab = await putWorkspaceMode(wire!)
      expect(camel.status).toBe(200)
      expect(camel.stored).toBe(id)
      expect(camel.stored).toBe(kebab.stored)
      expect(camel.body.data.permission.mode).toBe(wire!)
      expect(camel.body.data.permission.mode).toBe(kebab.body.data.permission.mode)
    })
  }

  it('PUT /permission-default 两种拼写都落 camel、都吐 kebab', async () => {
    const kebab = await putDefaultMode('bypass-permissions')
    const camel = await putDefaultMode('bypassPermissions')
    expect(kebab.stored).toBe('bypassPermissions')
    expect(kebab.body.data.mode).toBe('bypass-permissions')
    expect(camel.stored).toBe('bypassPermissions')
    expect(camel.body.data.mode).toBe('bypass-permissions')
  })
})

describe('③ manual 与未知值仍拒(不因接受 camel 而漏放行)', () => {
  it('PUT /permissions mode=manual → 400 且不写库', async () => {
    const { status, stored } = await putWorkspaceMode('manual')
    expect(status).toBe(400)
    expect(stored).toBeUndefined()
  })

  it('PUT /permission-default mode=manual → 400 且不写 preference', async () => {
    const { status, stored } = await putDefaultMode('manual')
    expect(status).toBe(400)
    expect(stored).toBeNull()
  })

  it.each(['no-such-mode', 'ACCEPT-EDITS', '', 'read_only'])('未知拼写 %o → 400', async (mode) => {
    expect((await putWorkspaceMode(mode)).status).toBe(400)
    expect(upsertPermission).not.toHaveBeenCalled()
    expect((await putDefaultMode(mode)).status).toBe(400)
  })
})

describe('④ 双向不越界:落库值 ⊆ 规范 5 值,出参值 ⊆ wire 4 值', () => {
  it('全拼写矩阵(规范档 × wire × 历史别名)扫一遍,两个集合都干净', async () => {
    const aliases = ['auto', 'accept-all', 'read-only', 'plan-only']
    const inputs = [...PERMISSION_MODES, ...PERMISSION_MODE_WIRE_VALUES, ...aliases]
    const storedSet = new Set<string>()
    const outputSet = new Set<string>()
    for (const input of inputs) {
      const r = await putWorkspaceMode(input)
      if (r.status !== 200) continue
      storedSet.add(String(r.stored))
      outputSet.add(String(r.body.data.permission.mode))
    }
    expect(storedSet.size).toBeGreaterThan(0)
    for (const v of storedSet) expect(PERMISSION_MODES).toContain(v)
    for (const v of outputSet) expect(PERMISSION_MODE_WIRE_VALUES).toContain(v)
    // manual 无落库语义:既不该进库,也不该出现在响应里
    expect(storedSet.has('manual')).toBe(false)
    expect(outputSet.has('manual')).toBe(false)
    // 4 个可落库档全覆盖(漏一档 = 该档仍按旧拼写写库)
    expect([...storedSet].sort()).toEqual(
      [...PERMISSION_MODES.filter((m) => m !== 'manual')].sort(),
    )
  })

  it('审计流水 reason 也吐 wire,不把 camel 泄进给人看的字段', async () => {
    await putWorkspaceMode('acceptEdits')
    expect(appendAuditLog).toHaveBeenCalledTimes(1)
    expect(appendAuditLog.mock.calls[0]?.[0]).toMatchObject({ reason: 'mode set to accept-edits' })
  })

  it('initializeDefaults 判定改走规范档后行为不变(两种拼写都建预置模板)', async () => {
    for (const mode of ['accept-edits', 'acceptEdits']) {
      clearUserRules.mockClear()
      createRulesBulk.mockClear()
      const res = await app.inject({
        method: 'PUT',
        url: '/api/workspace/permissions',
        payload: { workspacePath: 'D:/demo', name: 'demo', mode, initializeDefaults: true },
      })
      expect(res.statusCode).toBe(200)
      expect(clearUserRules).toHaveBeenCalledTimes(1)
      expect(createRulesBulk).toHaveBeenCalledTimes(1)
    }
    // 非 acceptEdits 档不得触发预置模板
    clearUserRules.mockClear()
    createRulesBulk.mockClear()
    await putWorkspaceMode('plan')
    expect(clearUserRules).not.toHaveBeenCalled()
    expect(createRulesBulk).not.toHaveBeenCalled()
  })
})

describe('⑤ 混合态(遗留 kebab 行 + 新 camel 行)读路径都认、出参统一 kebab', () => {
  const legacyKebab = {
    ...rowFrom({ userId: 'user-1', workspacePath: 'D:/old', name: 'old', mode: 'accept-edits' }),
    id: 'perm-old',
  }
  const freshCamel = {
    ...rowFrom({ userId: 'user-1', workspacePath: 'D:/new', name: 'new', mode: 'acceptEdits' }),
    id: 'perm-new',
  }

  it('GET /permissions 同档两种拼写 → 出参同一个 wire', async () => {
    listPermissionsByUser.mockResolvedValue([legacyKebab, freshCamel])
    const res = await app.inject({ method: 'GET', url: '/api/workspace/permissions' })
    const modes = res.json().data.permissions.map((p: { mode: string }) => p.mode)
    expect(modes).toEqual(['accept-edits', 'accept-edits'])
    for (const m of modes) expect(PERMISSION_MODE_WIRE_VALUES).toContain(m)
  })

  it('GET /permission 读遗留 kebab 行与新 camel 行都给 wire', async () => {
    for (const row of [legacyKebab, freshCamel]) {
      getPermission.mockResolvedValue(row)
      const res = await app.inject({
        method: 'GET',
        url: '/api/workspace/permission?workspacePath=D:/x',
      })
      expect(res.json().data.permission.mode).toBe('accept-edits')
    }
  })

  it('GET /permission-default 遗留 kebab 值与新 camel 值都给 wire', async () => {
    for (const value of ['bypass-permissions', 'bypassPermissions']) {
      storedPrefs.value = value
      const res = await app.inject({ method: 'GET', url: '/api/workspace/permission-default' })
      expect(res.json().data.mode).toBe('bypass-permissions')
    }
  })

  it('未配置 → mode=null;库里是认不出的脏值 → 不静默降级成 default', async () => {
    getPermission.mockResolvedValue({
      ...legacyKebab,
      mode: 'totally-unknown-mode',
    })
    const dirty = await app.inject({
      method: 'GET',
      url: '/api/workspace/permission?workspacePath=D:/x',
    })
    expect(dirty.json().data.permission.mode).toBe('totally-unknown-mode')

    storedPrefs.value = 'totally-unknown-mode'
    const dirtyDefault = await app.inject({
      method: 'GET',
      url: '/api/workspace/permission-default',
    })
    expect(dirtyDefault.json().data.mode).toBeNull()

    storedPrefs.value = null
    const unset = await app.inject({ method: 'GET', url: '/api/workspace/permission-default' })
    expect(unset.json().data.mode).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
