/**
 * 用户资料链路端到端真实联调测试（增强版）
 *
 * 与 v1-user-vip.spec.ts / v1-sys-user.spec.ts 的区别:
 * - 旧版只测 "查" (列表/详情), 不测 "改" (修改/删除/设置身份)
 * - 本文件测完整的用户资料 CRUD 流转, 验证数据真的写了/改了/删了
 *
 * 测试链路（基于后端真实接口 /users/*）:
 *
 * A. 用户详情查询:
 *   1. 注册用户 → 查询用户详情 → 验证字段真的写了 (uuid/nickname/status)
 *   2. 查询不存在的用户 → 验证返回 data:null
 *
 * B. 用户列表查询:
 *   3. 用户列表包含刚注册的用户 → 验证 total 增加
 *   4. 按昵称搜索 → 验证能搜到刚注册的用户
 *
 * C. 用户资料修改:
 *   5. 修改昵称 → 再查 → 验证昵称真的改了
 *   6. 修改状态 → 再查 → 验证状态真的改了
 *
 * D. VIP 信息查询:
 *   7. 查询用户 VIP 信息 → 验证返回非VIP默认值
 *
 * E. 用户身份设置:
 *   8. 设置用户身份为贵族 → 验证返回 identity:1
 *   9. 设置身份后再查 → 验证 isVip 真的变了
 *  10. 设置身份时带 token_quantity → 验证余额真的增加
 *
 * F. 平台用户列表:
 *  11. 查询平台用户列表 → 验证返回 records 数组
 *
 * G. 用户删除:
 *  12. 删除用户 → 验证返回 deleted:1
 *  13. 删除后再查 → 验证 status 变成 -1 (软删除)
 *
 * 后端实现: server/app/api/v1_users.py
 * 真实链路验证: 注册的用户真的写入 users 表, 修改/删除真的生效
 */

import { test, expect, type APIRequestContext } from '@playwright/test'

const BACKEND = process.env.PW_BACKEND_URL ?? 'http://127.0.0.1:8000'

/** 判断 code 是否为成功 (兼容多种格式) */
function isCodeOk(code: unknown): boolean {
  return code === '0' || code === 0 || code === 200 || code === '200'
}

/** 判断是否被 WAF 限流 */
function isWafBlocked(status: number, body: any): boolean {
  return status === 403 || body?.blocked_by === 'rate_limit' || body?.error === 'rate_limited'
}

/** 生成随机手机号 (13开头 + 9位随机数, 避免冲突) */
function randomPhone(): string {
  const suffix = Math.floor(Math.random() * 900000000 + 100000000)
  return `13${suffix}`
}

/** 生成唯一用户名 */
function uniqueName(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`
}

/** 带认证的 headers */
function authHeaders(token: string): Record<string, string> {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

/** 注册新用户并返回 { token, uuid } */
async function registerUser(
  request: APIRequestContext,
  nickname?: string
): Promise<{ token: string; uuid: string } | null> {
  const phone = randomPhone()
  const password = 'test123456'
  const username = nickname || uniqueName('e2e_user')

  const resp = await request.post(`${BACKEND}/api/login/pwd/registerLogin`, {
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
    data: { username, phone, password },
  })
  const body = await resp.json().catch(() => ({}))
  if (isWafBlocked(resp.status(), body)) { test.skip(); return null }
  if (resp.status() !== 200) return null

  if (!isCodeOk(body.code)) return null

  const data = (body.data ?? {}) as Record<string, unknown>
  const token = (data.token ?? data.access_token) as string
  if (!token) return null

  // 从 JWT token 解析 user_uuid
  const parts = token.split('.')
  if (parts.length < 2) return null
  const payload = parts[1] + '='.repeat(4 - (parts[1].length % 4))
  let uuid = ''
  try {
    const payloadData = JSON.parse(Buffer.from(payload, 'base64').toString('utf-8'))
    uuid = payloadData.sub || ''
  } catch {
    return null
  }
  if (!uuid) return null

  return { token, uuid }
}

test.describe.configure({ mode: 'serial' })

test.describe('用户资料链路端到端联调（增强版）', () => {
  test.setTimeout(30000)

  // ========== A. 用户详情查询 ==========

  test('A1. 注册用户 → 查询用户详情 → 验证字段真的写了 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const user = await registerUser(request, uniqueName('e2e_detail'))
    if (!user) {
      test.skip(true, '注册失败, 跳过')
      return
    }
    console.log(`[A1] 注册成功: uuid=${user.uuid}`)

    // 查询用户详情
    const resp = await request.get(`${BACKEND}/users/${user.uuid}`, {
      timeout: 15000,
      headers: authHeaders(user.token),
    })
    const body = await resp.json().catch(() => ({}))
    if (isWafBlocked(resp.status(), body)) { test.skip(); return }
    expect(resp.status(), '查询用户详情应返回 200').toBe(200)
    expect(isCodeOk(body.code), `查询 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data, '应返回用户数据').toBeTruthy()
    expect(data.uuid, 'uuid 应匹配').toBe(user.uuid)
    expect(data.nickname, 'nickname 应存在').toBeDefined()
    expect(data.status, 'status 应为 1 (正常)').toBe(1)
    expect(data.isVip, '新用户 isVip 应为 0').toBe(0)
    expect(data.tokenQuantity, '新用户 tokenQuantity 应为 0').toBe(0)
    console.log(`[A1] 查询成功: nickname=${data.nickname}, status=${data.status}`)
  })

  test('A2. 查询不存在的用户应返回 data:null - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const resp = await request.get(`${BACKEND}/users/nonexistent-uuid-12345678`, {
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
    })
    const body = await resp.json().catch(() => ({}))
    if (isWafBlocked(resp.status(), body)) { test.skip(); return }
    expect(resp.status(), '查询应返回 200').toBe(200)
    // 后端真实行为: 用户不存在时返回 { code: 200, data: null }
    expect(body.data, '不存在的用户应返回 null').toBeNull()
    console.log(`[A2] 不存在用户正确返回 null`)
  })

  // ========== B. 用户列表查询 ==========

  test('B1. 用户列表包含刚注册的用户 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const user = await registerUser(request, uniqueName('e2e_list'))
    if (!user) {
      test.skip(true, '注册失败, 跳过')
      return
    }

    const resp = await request.get(`${BACKEND}/users/list?page_num=1&page_size=20`, {
      timeout: 15000,
      headers: authHeaders(user.token),
    })
    const body = await resp.json().catch(() => ({}))
    if (isWafBlocked(resp.status(), body)) { test.skip(); return }
    expect(resp.status(), '用户列表应返回 200').toBe(200)
    expect(body.code, `列表 code 应为 200, 实际: ${body.code}`).toBe(200)

    const data = body.data
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(data.total, '应返回 total').toBeGreaterThan(0)

    // 验证列表包含刚注册的用户
    const found = data.records.find((u: { uuid: string }) => u.uuid === user.uuid)
    expect(found, '列表应包含刚注册的用户').toBeTruthy()
    console.log(`[B1] 列表包含新用户: total=${data.total}`)
  })

  test('B2. 按昵称搜索能搜到刚注册的用户 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const searchPrefix = `e2e_search_${Date.now()}`
    const user = await registerUser(request, searchPrefix)
    if (!user) {
      test.skip(true, '注册失败, 跳过')
      return
    }

    const resp = await request.get(`${BACKEND}/users/list?nickname=${encodeURIComponent(searchPrefix)}&page_num=1&page_size=20`, {
      timeout: 15000,
      headers: authHeaders(user.token),
    })
    const body = await resp.json().catch(() => ({}))
    if (isWafBlocked(resp.status(), body)) { test.skip(); return }
    expect(resp.status(), '搜索应返回 200').toBe(200)
    expect(body.code, `搜索 code 应为 200, 实际: ${body.code}`).toBe(200)

    const data = body.data
    expect(data.records.length, '搜索结果应至少有1条').toBeGreaterThan(0)
    const found = data.records.find((u: { uuid: string }) => u.uuid === user.uuid)
    expect(found, '搜索结果应包含目标用户').toBeTruthy()
    console.log(`[B2] 搜索成功: 找到 ${data.records.length} 条`)
  })

  // ========== C. 用户资料修改 ==========

  test('C1. 修改昵称后再查验证真的改了 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const user = await registerUser(request, uniqueName('e2e_before'))
    if (!user) {
      test.skip(true, '注册失败, 跳过')
      return
    }

    const newNickname = `e2e_after_${Date.now()}`

    // 修改昵称
    const updateResp = await request.put(`${BACKEND}/users`, {
      timeout: 15000,
      headers: authHeaders(user.token),
      data: { uuid: user.uuid, nickname: newNickname },
    })
    const updateBody = await updateResp.json().catch(() => ({}))
    if (isWafBlocked(updateResp.status(), updateBody)) { test.skip(); return }
    expect(updateResp.status(), '修改应返回 200').toBe(200)
    expect(isCodeOk(updateBody.code), `修改 code 应为成功, 实际: ${updateBody.code}`).toBe(true)
    console.log(`[C1 Step1] 修改昵称成功`)

    // 再查验证
    const getResp = await request.get(`${BACKEND}/users/${user.uuid}`, {
      timeout: 15000,
      headers: authHeaders(user.token),
    })
    const getBody = await getResp.json().catch(() => ({}))
    if (isWafBlocked(getResp.status(), getBody)) { test.skip(); return }
    expect(getResp.status(), '查询应返回 200').toBe(200)
    expect(getBody.data.nickname, `昵称应改为 ${newNickname}, 实际: ${getBody.data.nickname}`).toBe(newNickname)
    console.log(`[C1 Step2] 验证成功: 昵称真的改成 ${newNickname}`)
  })

  test('C2. 修改状态后再查验证真的改了 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const user = await registerUser(request, uniqueName('e2e_status'))
    if (!user) {
      test.skip(true, '注册失败, 跳过')
      return
    }

    // 修改状态为 0 (停用)
    const updateResp = await request.put(`${BACKEND}/users`, {
      timeout: 15000,
      headers: authHeaders(user.token),
      data: { uuid: user.uuid, status: 0 },
    })
    const updateBody = await updateResp.json().catch(() => ({}))
    if (isWafBlocked(updateResp.status(), updateBody)) { test.skip(); return }
    expect(updateResp.status(), '修改应返回 200').toBe(200)
    expect(isCodeOk(updateBody.code), `修改 code 应为成功, 实际: ${updateBody.code}`).toBe(true)

    // 再查验证
    const getResp = await request.get(`${BACKEND}/users/${user.uuid}`, {
      timeout: 15000,
      headers: authHeaders(user.token),
    })
    const getBody = await getResp.json().catch(() => ({}))
    if (isWafBlocked(getResp.status(), getBody)) { test.skip(); return }
    expect(getResp.status(), '查询应返回 200').toBe(200)
    expect(getBody.data.status, `状态应改为 0, 实际: ${getBody.data.status}`).toBe(0)
    console.log(`[C2] 验证成功: 状态真的改成 0`)
  })

  // ========== D. VIP 信息查询 ==========

  test('D1. 查询用户 VIP 信息返回非VIP默认值 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const user = await registerUser(request, uniqueName('e2e_vip'))
    if (!user) {
      test.skip(true, '注册失败, 跳过')
      return
    }

    const resp = await request.get(`${BACKEND}/users/vipInfo/${user.uuid}`, {
      timeout: 15000,
      headers: authHeaders(user.token),
    })
    const body = await resp.json().catch(() => ({}))
    if (isWafBlocked(resp.status(), body)) { test.skip(); return }
    expect(resp.status(), 'VIP 信息查询应返回 200').toBe(200)
    expect(isCodeOk(body.code), `VIP 查询 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.uuid, 'uuid 应匹配').toBe(user.uuid)
    expect(data.isVip, '新用户 isVip 应为 0').toBe(0)
    expect(data.vipLevel, '新用户 vipLevel 应为 null').toBeNull()
    expect(data.vipLevelName, '新用户 vipLevelName 应为 "非VIP"').toBe('非VIP')
    expect(data.vipStatus, '新用户 vipStatus 应为 0').toBe(0)
    console.log(`[D1] VIP 信息查询成功: vipLevelName=${data.vipLevelName}`)
  })

  // ========== E. 用户身份设置 ==========

  test('E1. 设置用户身份为贵族返回 identity:1 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const user = await registerUser(request, uniqueName('e2e_identity'))
    if (!user) {
      test.skip(true, '注册失败, 跳过')
      return
    }

    const resp = await request.post(`${BACKEND}/users/set/user/identity`, {
      timeout: 15000,
      headers: authHeaders(user.token),
      data: { uuid: user.uuid, type: '1', token_quantity: '0' },
    })
    const body = await resp.json().catch(() => ({}))
    if (isWafBlocked(resp.status(), body)) { test.skip(); return }
    expect(resp.status(), '设置身份应返回 200').toBe(200)
    expect(isCodeOk(body.code), `设置身份 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = body.data
    expect(data.uuid, '返回 uuid 应匹配').toBe(user.uuid)
    expect(data.identity, '返回 identity 应为 1 (贵族)').toBe(1)
    console.log(`[E1] 设置身份成功: identity=${data.identity}`)
  })

  test('E2. 设置身份后再查验证 isVip 真的变了 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const user = await registerUser(request, uniqueName('e2e_identity_check'))
    if (!user) {
      test.skip(true, '注册失败, 跳过')
      return
    }

    // 设置身份为贵族 (type=1)
    const setResp = await request.post(`${BACKEND}/users/set/user/identity`, {
      timeout: 15000,
      headers: authHeaders(user.token),
      data: { uuid: user.uuid, type: '1', token_quantity: '0' },
    })
    const setBody = await setResp.json().catch(() => ({}))
    if (isWafBlocked(setResp.status(), setBody)) { test.skip(); return }
    expect(setResp.status(), '设置身份应返回 200').toBe(200)

    // 再查验证 isVip 变了
    const getResp = await request.get(`${BACKEND}/users/${user.uuid}`, {
      timeout: 15000,
      headers: authHeaders(user.token),
    })
    const getBody = await getResp.json().catch(() => ({}))
    if (isWafBlocked(getResp.status(), getBody)) { test.skip(); return }
    expect(getResp.status(), '查询应返回 200').toBe(200)
    expect(getBody.data.isVip, `设置身份后 isVip 应为 1, 实际: ${getBody.data.isVip}`).toBe(1)
    console.log(`[E2] 验证成功: isVip 真的变成 1`)
  })

  test('E3. 设置身份带 token_quantity 验证余额真的增加 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const user = await registerUser(request, uniqueName('e2e_token'))
    if (!user) {
      test.skip(true, '注册失败, 跳过')
      return
    }

    // 设置身份并增加 100 token
    const setResp = await request.post(`${BACKEND}/users/set/user/identity`, {
      timeout: 15000,
      headers: authHeaders(user.token),
      data: { uuid: user.uuid, type: '1', token_quantity: '100' },
    })
    const setBody = await setResp.json().catch(() => ({}))
    if (isWafBlocked(setResp.status(), setBody)) { test.skip(); return }
    expect(setResp.status(), '设置身份应返回 200').toBe(200)
    expect(setBody.data.tokenQuantity, '返回 tokenQuantity 应为 100').toBe(100)

    // 再查验证余额真的增加了
    const getResp = await request.get(`${BACKEND}/users/${user.uuid}`, {
      timeout: 15000,
      headers: authHeaders(user.token),
    })
    const getBody = await getResp.json().catch(() => ({}))
    if (isWafBlocked(getResp.status(), getBody)) { test.skip(); return }
    expect(getResp.status(), '查询应返回 200').toBe(200)
    expect(getBody.data.tokenQuantity, `余额应为 100, 实际: ${getBody.data.tokenQuantity}`).toBe(100)
    console.log(`[E3] 验证成功: 余额真的变成 100`)
  })

  // ========== F. 平台用户列表 ==========

  test('F1. 查询平台用户列表返回 records 数组 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const user = await registerUser(request, uniqueName('e2e_platform'))
    if (!user) {
      test.skip(true, '注册失败, 跳过')
      return
    }

    const resp = await request.get(`${BACKEND}/users/platform/list`, {
      timeout: 15000,
      headers: authHeaders(user.token),
    })
    const body = await resp.json().catch(() => ({}))
    if (isWafBlocked(resp.status(), body)) { test.skip(); return }
    expect(resp.status(), '平台用户列表应返回 200').toBe(200)
    expect(body.code, `列表 code 应为 200, 实际: ${body.code}`).toBe(200)

    const data = body.data
    expect(data.records, '应返回 records 数组').toBeDefined()
    expect(Array.isArray(data.records), 'records 应为数组').toBe(true)
    expect(data.total, '应返回 total').toBeGreaterThanOrEqual(0)
    console.log(`[F1] 平台用户列表: total=${data.total}`)
  })

  // ========== G. 用户删除 ==========

  test('G1. 删除用户返回 deleted:1 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const user = await registerUser(request, uniqueName('e2e_delete'))
    if (!user) {
      test.skip(true, '注册失败, 跳过')
      return
    }

    const resp = await request.delete(`${BACKEND}/users/${user.uuid}`, {
      timeout: 15000,
      headers: authHeaders(user.token),
    })
    const body = await resp.json().catch(() => ({}))
    if (isWafBlocked(resp.status(), body)) { test.skip(); return }
    expect(resp.status(), '删除应返回 200').toBe(200)
    expect(isCodeOk(body.code), `删除 code 应为成功, 实际: ${body.code}`).toBe(true)
    expect(body.data.deleted, '删除应返回 deleted:1').toBe(1)
    console.log(`[G1] 删除成功: deleted=${body.data.deleted}`)
  })

  test('G2. 删除后再查验证 status 变成 -1 (软删除) - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const user = await registerUser(request, uniqueName('e2e_soft_delete'))
    if (!user) {
      test.skip(true, '注册失败, 跳过')
      return
    }

    // 删除用户
    const delResp = await request.delete(`${BACKEND}/users/${user.uuid}`, {
      timeout: 15000,
      headers: authHeaders(user.token),
    })
    const delBody = await delResp.json().catch(() => ({}))
    if (isWafBlocked(delResp.status(), delBody)) { test.skip(); return }
    expect(delResp.status(), '删除应返回 200').toBe(200)

    // 再查验证 status 变成 -1
    const getResp = await request.get(`${BACKEND}/users/${user.uuid}`, {
      timeout: 15000,
      headers: authHeaders(user.token),
    })
    const getBody = await getResp.json().catch(() => ({}))
    if (isWafBlocked(getResp.status(), getBody)) { test.skip(); return }
    expect(getResp.status(), '删除后查询应返回 200').toBe(200)
    expect(getBody.data, '删除后应仍能查到(软删除)').toBeTruthy()
    expect(getBody.data.status, `删除后 status 应为 -1, 实际: ${getBody.data.status}`).toBe(-1)
    console.log(`[G2] 验证成功: 软删除生效, status=${getBody.data.status}`)
  })
})
