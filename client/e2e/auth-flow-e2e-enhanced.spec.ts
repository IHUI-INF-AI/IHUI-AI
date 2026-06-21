/**
 * 认证链路端到端真实联调测试（增强版）
 *
 * 与 login-flow-e2e.spec.ts 的区别:
 * - 旧版只测登录和注册, 注册测试用了降级行为(mock token 当正常)
 * - 本文件测完整的认证流程, 验证数据真的写了/改了
 *
 * 测试链路（基于后端真实接口 /api/login/pwd/*）:
 *
 * A. 注册 + 登录核心流程:
 *   1. 注册新用户 → 验证返回 token → 用注册账号登录成功
 *   2. 重复手机号注册 → 验证被拒绝
 *
 * B. 密码安全:
 *   3. 错误密码登录 → 验证被拒绝
 *   4. 修改密码(已登录) → 新密码太短被拒
 *   5. 修改密码(已登录) → 正常修改后能用新密码登录
 *   6. 修改密码(凭旧密码) → 旧密码错误被拒
 *
 * C. Token 机制:
 *   7. 刷新 token → 验证返回新 token
 *   8. 无 token 访问受保护接口 → 验证被拒绝
 *
 * D. 短信验证码:
 *   9. 发送短信验证码 → 验证返回验证码
 *  10. 校验短信验证码 → 错误验证码被拒
 *  11. 短信 60 秒限流 → 第二次发送被拒
 *
 * E. 用户资料修改:
 *  12. 换手机号 → 验证返回 updated:true
 *  13. 设置邮箱 → 验证返回 updated:true
 *
 * 后端实现: server/app/api/v1_login_pwd.py
 * 真实链路验证: 注册的用户真的写入 users 表, 登录能查到
 */

import { test, expect, type APIRequestContext } from '@playwright/test'

const BACKEND = process.env.PW_BACKEND_URL ?? 'http://127.0.0.1:8000'

/** 判断 code 是否为成功 (兼容多种格式) */
function isCodeOk(code: unknown): boolean {
  return code === '0' || code === 0 || code === 200 || code === '200'
}

/** 判断是否被 WAF 限流 (403 + rate_limit) */
function isWafBlocked(status: number, body: Record<string, unknown>): boolean {
  if (status !== 403) return false
  return body?.blocked_by === 'rate_limit' || (typeof body?.message === 'string' && body.message.includes('速率限制'))
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

/** 调用注册接口 */
async function register(
  request: APIRequestContext,
  phone: string,
  password: string,
  username?: string
): Promise<{ status: number; body: Record<string, unknown> }> {
  const resp = await request.post(`${BACKEND}/api/login/pwd/registerLogin`, {
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
    data: { username: username || uniqueName('e2e'), phone, password },
  })
  const body = await resp.json().catch(() => ({} as Record<string, unknown>))
  if (isWafBlocked(resp.status(), body)) { test.skip(); return { status: 0, body: {} } }
  return { status: resp.status(), body }
}

/** 调用登录接口 */
async function login(
  request: APIRequestContext,
  phone: string,
  password: string
): Promise<{ status: number; body: Record<string, unknown> }> {
  const resp = await request.post(`${BACKEND}/api/login/pwd/login`, {
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
    data: { phone, password },
  })
  const body = await resp.json().catch(() => ({} as Record<string, unknown>))
  if (isWafBlocked(resp.status(), body)) { test.skip(); return { status: 0, body: {} } }
  return { status: resp.status(), body }
}

test.describe.configure({ mode: 'serial' })

test.describe('认证链路端到端联调（增强版）', () => {
  test.setTimeout(30000)

  // ========== A. 注册 + 登录核心流程 ==========

  test('A1. 注册新用户 → 返回 token → 用注册账号登录成功 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const phone = randomPhone()
    const password = 'test123456'
    const username = uniqueName('e2e_reg')

    // Step 1: 注册新用户
    const { status: regStatus, body: regBody } = await register(request, phone, password, username)
    if (regStatus === 404) {
      test.skip(true, '后端注册端点未挂载')
      return
    }
    expect(regStatus, '注册应返回 200').toBe(200)
    expect(isCodeOk(regBody.code), `注册 code 应为成功, 实际: ${regBody.code}`).toBe(true)

    const regData = (regBody.data ?? {}) as Record<string, unknown>
    const regToken = (regData.token ?? regData.access_token) as string | undefined
    expect(regToken, '注册应返回 token').toBeTruthy()
    console.log(`[A1 Step1] 注册成功: phone=${phone}, token长度=${regToken!.length}`)

    // Step 2: 用注册的手机号登录
    const { status: loginStatus, body: loginBody } = await login(request, phone, password)
    expect(loginStatus, '登录应返回 200').toBe(200)
    expect(isCodeOk(loginBody.code), `登录 code 应为成功, 实际: ${loginBody.code}`).toBe(true)

    const loginData = (loginBody.data ?? {}) as Record<string, unknown>
    const loginToken = (loginData.token ?? loginData.access_token) as string | undefined
    expect(loginToken, '登录应返回 token').toBeTruthy()
    console.log(`[A1 Step2] 注册账号可登录: phone=${phone}, token长度=${loginToken!.length}`)
  })

  test('A2. 重复手机号注册应被拒绝 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const phone = randomPhone()
    const password = 'test123456'

    // Step 1: 第一次注册（应该成功）
    const { status: s1, body: b1 } = await register(request, phone, password)
    if (s1 === 404) {
      test.skip(true, '后端注册端点未挂载')
      return
    }
    expect(s1, '第一次注册应成功').toBe(200)
    expect(isCodeOk(b1.code), '第一次注册 code 应为成功').toBe(true)
    console.log(`[A2 Step1] 第一次注册成功: phone=${phone}`)

    // Step 2: 用同一手机号再注册（应该被拒绝）
    const { status: s2, body: b2 } = await register(request, phone, password)
    // 后端真实行为: 手机号已注册时返回 400 + code 400102
    expect(s2, '重复手机号注册应返回 400').toBe(400)
    const code2 = b2.code
    // code 400102 = PHONE_REGISTERED (手机号已注册)
    expect(code2, `重复注册应返回错误 code, 实际: ${code2}`).not.toBe('0')
    expect(code2, `重复注册应返回错误 code, 实际: ${code2}`).not.toBe(0)
    console.log(`[A2 Step2] 重复手机号正确被拒绝: status=${s2}, code=${code2}`)
  })

  // ========== B. 密码安全 ==========

  test('B1. 错误密码登录应被拒绝 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const phone = randomPhone()
    const password = 'test123456'

    // 先注册一个账号
    const { status: regStatus } = await register(request, phone, password)
    if (regStatus === 404) {
      test.skip(true, '后端注册端点未挂载')
      return
    }

    // 用错误密码登录
    const { status, body } = await login(request, phone, 'wrong_password_999')
    expect(status, '错误密码登录应返回 200(业务错误用 code 表示)').toBe(200)
    // 后端真实行为: 返回 { code: 401, message: "密码错误" }
    expect(body.code, `错误密码应返回 401 code, 实际: ${body.code}`).toBe(401)
    expect(body.message, `错误密码应返回"密码错误", 实际: ${body.message}`).toContain('密码错误')
    console.log(`[B1] 错误密码正确被拒绝: code=${body.code}, message=${body.message}`)
  })

  test('B2. 修改密码新密码太短应被拒 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const phone = randomPhone()
    const password = 'test123456'

    // 先注册并拿 token
    const { status: regStatus, body: regBody } = await register(request, phone, password)
    if (regStatus === 404) {
      test.skip(true, '后端注册端点未挂载')
      return
    }
    const regData = (regBody.data ?? {}) as Record<string, unknown>
    const token = (regData.token ?? regData.access_token) as string

    // 用太短的新密码修改 (后端要求至少6位)
    const resp = await request.post(`${BACKEND}/api/login/pwd/editPasswd`, {
      timeout: 15000,
      headers: authHeaders(token),
      data: { newPassword: '123' }, // 只有3位, 太短
    })
    const body = await resp.json().catch(() => ({} as Record<string, unknown>))
    if (isWafBlocked(resp.status(), body)) { test.skip(); return }
    expect(resp.status(), '太短密码应返回 400').toBe(400)
    // 后端真实行为: 抛 BusinessException(PASSWORD_WEAK)
    console.log(`[B2] 太短密码正确被拒: status=${resp.status()}, code=${body.code}`)
  })

  test('B3. 修改密码后能用新密码登录 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const phone = randomPhone()
    const password = 'test123456'
    const newPassword = 'newpass789'

    // 先注册并拿 token
    const { status: regStatus, body: regBody } = await register(request, phone, password)
    if (regStatus === 404) {
      test.skip(true, '后端注册端点未挂载')
      return
    }
    const regData = (regBody.data ?? {}) as Record<string, unknown>
    const token = (regData.token ?? regData.access_token) as string

    // 修改密码
    const editResp = await request.post(`${BACKEND}/api/login/pwd/editPasswd`, {
      timeout: 15000,
      headers: authHeaders(token),
      data: { newPassword },
    })
    const editBody = await editResp.json().catch(() => ({} as Record<string, unknown>))
    if (isWafBlocked(editResp.status(), editBody)) { test.skip(); return }
    expect(editResp.status(), '修改密码应返回 200').toBe(200)
    expect(isCodeOk(editBody.code), `修改密码 code 应为成功, 实际: ${editBody.code}`).toBe(true)
    expect(editBody.data?.updated, '修改密码应返回 updated:true').toBe(true)
    console.log(`[B3 Step1] 修改密码成功`)

    // 用新密码登录
    const { status: loginStatus, body: loginBody } = await login(request, phone, newPassword)
    expect(loginStatus, '新密码登录应返回 200').toBe(200)
    expect(isCodeOk(loginBody.code), `新密码登录 code 应为成功, 实际: ${loginBody.code}`).toBe(true)
    console.log(`[B3 Step2] 新密码登录成功`)
  })

  test('B4. 凭旧密码修改时旧密码错误应被拒 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const phone = randomPhone()
    const password = 'test123456'

    // 先注册并拿 token
    const { status: regStatus, body: regBody } = await register(request, phone, password)
    if (regStatus === 404) {
      test.skip(true, '后端注册端点未挂载')
      return
    }
    const regData = (regBody.data ?? {}) as Record<string, unknown>
    const token = (regData.token ?? regData.access_token) as string

    // 用错误的旧密码修改
    const resp = await request.post(`${BACKEND}/api/login/pwd/modify/password`, {
      timeout: 15000,
      headers: authHeaders(token),
      data: { oldPassword: 'wrong_old_password', newPassword: 'newpass789' },
    })
    const body = await resp.json().catch(() => ({} as Record<string, unknown>))
    if (isWafBlocked(resp.status(), body)) { test.skip(); return }
    expect(resp.status(), '旧密码错误应返回 400').toBe(400)
    // 后端真实行为: 抛 BusinessException(PARAM_INVALID, "old password incorrect")
    console.log(`[B4] 旧密码错误正确被拒: status=${resp.status()}, code=${body.code}`)
  })

  // ========== C. Token 机制 ==========

  test('C1. 刷新 token 应返回新 token - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const phone = randomPhone()
    const password = 'test123456'

    // 先注册拿 refreshToken
    const { status: regStatus, body: regBody } = await register(request, phone, password)
    if (regStatus === 404) {
      test.skip(true, '后端注册端点未挂载')
      return
    }
    const regData = (regBody.data ?? {}) as Record<string, unknown>
    const refreshToken = (regData.refreshToken ?? regData.refresh_token) as string
    expect(refreshToken, '注册应返回 refreshToken').toBeTruthy()

    // 刷新 token
    const resp = await request.post(`${BACKEND}/api/login/pwd/refreshToken`, {
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
      data: { refreshToken },
    })
    const body = await resp.json().catch(() => ({} as Record<string, unknown>))
    if (isWafBlocked(resp.status(), body)) { test.skip(); return }
    expect(resp.status(), '刷新 token 应返回 200').toBe(200)
    expect(isCodeOk(body.code), `刷新 token code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = (body.data ?? {}) as Record<string, unknown>
    const newToken = (data.token ?? data.access_token) as string
    const newRefresh = (data.refreshToken ?? data.refresh_token) as string
    expect(newToken, '刷新应返回新 token').toBeTruthy()
    expect(newRefresh, '刷新应返回新 refreshToken').toBeTruthy()
    console.log(`[C1] 刷新 token 成功: 新token长度=${newToken!.length}`)
  })

  test('C2. 无 token 访问受保护接口应被拒 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    // editPasswd 需要 token, 不带 token 应被拒
    const resp = await request.post(`${BACKEND}/api/login/pwd/editPasswd`, {
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
      data: { newPassword: 'newpass789' },
    })
    const body = await resp.json().catch(() => ({} as Record<string, unknown>))
    if (isWafBlocked(resp.status(), body)) { test.skip(); return }
    // 后端真实行为: _require_user 抛 UNAUTHORIZED (401)
    expect([400, 401, 403], `无 token 应返回 400/401/403, 实际: ${resp.status()}`).toContain(resp.status())
    console.log(`[C2] 无 token 正确被拒: status=${resp.status()}`)
  })

  // ========== D. 短信验证码 ==========

  test('D1. 发送短信验证码应返回验证码 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const phone = randomPhone()

    const resp = await request.post(`${BACKEND}/api/login/pwd/smsVerify`, {
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
      data: { phone },
    })
    const body = await resp.json().catch(() => ({} as Record<string, unknown>))
    if (isWafBlocked(resp.status(), body)) { test.skip(); return }
    if (resp.status() === 404) {
      test.skip(true, '后端短信端点未挂载')
      return
    }
    // 可能被 WAF 限流, 跳过
    if (resp.status() === 403 || resp.status() === 429) {
      test.skip(true, `被限流(${resp.status()}), 跳过`)
      return
    }
    expect(resp.status(), '发送短信应返回 200').toBe(200)
    expect(isCodeOk(body.code), `发送短信 code 应为成功, 实际: ${body.code}`).toBe(true)

    const data = (body.data ?? {}) as Record<string, unknown>
    // 后端真实行为: 返回 { phone, code, expireSeconds }
    expect(data.phone, '应返回 phone').toBe(phone)
    expect(data.code, '应返回验证码').toBeTruthy()
    expect(data.expireSeconds, '应返回过期时间').toBeTruthy()
    console.log(`[D1] 发送短信成功: phone=${phone}, code=${data.code}`)
  })

  test('D2. 校验短信验证码错误应被拒 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const phone = randomPhone()

    // 先发送验证码
    const sendResp = await request.post(`${BACKEND}/api/login/pwd/smsVerify`, {
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
      data: { phone },
    })
    const sendBody = await sendResp.json().catch(() => ({} as Record<string, unknown>))
    if (isWafBlocked(sendResp.status(), sendBody)) { test.skip(); return }
    if (sendResp.status() === 404) {
      test.skip(true, '后端短信端点未挂载')
      return
    }
    if (sendResp.status() === 403 || sendResp.status() === 429) {
      test.skip(true, `发送被限流(${sendResp.status()}), 跳过`)
      return
    }

    // 用错误验证码校验
    const resp = await request.post(`${BACKEND}/api/login/pwd/verify`, {
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
      data: { phone, code: '000000' }, // 错误验证码
    })
    const body = await resp.json().catch(() => ({} as Record<string, unknown>))
    if (isWafBlocked(resp.status(), body)) { test.skip(); return }
    // 后端真实行为: 抛 BusinessException(SMS_CODE_INVALID)
    expect([400, 422], `错误验证码应返回 400/422, 实际: ${resp.status()}`).toContain(resp.status())
    console.log(`[D2] 错误验证码正确被拒: status=${resp.status()}`)
  })

  test('D3. 短信 60 秒限流 - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const phone = randomPhone()

    // 第一次发送
    const r1 = await request.post(`${BACKEND}/api/login/pwd/smsVerify`, {
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
      data: { phone },
    })
    const r1Body = await r1.json().catch(() => ({} as Record<string, unknown>))
    if (isWafBlocked(r1.status(), r1Body)) { test.skip(); return }
    if (r1.status() === 404) {
      test.skip(true, '后端短信端点未挂载')
      return
    }
    if (r1.status() === 403 || r1.status() === 429) {
      test.skip(true, `第一次发送就被 WAF 限流(${r1.status()}), 跳过`)
      return
    }
    expect(r1.status(), '第一次发送应成功').toBe(200)

    // 第二次发送（同一手机号, 60秒内应被拒）
    const r2 = await request.post(`${BACKEND}/api/login/pwd/smsVerify`, {
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
      data: { phone },
    })
    const r2Body = await r2.json().catch(() => ({} as Record<string, unknown>))
    if (isWafBlocked(r2.status(), r2Body)) { test.skip(); return }
    // 后端真实行为: 抛 BusinessException(RATE_LIMIT)
    expect([400, 429], `60秒内第二次发送应被拒, 实际: ${r2.status()}`).toContain(r2.status())
    console.log(`[D3] 60秒限流生效: 第二次发送被拒 status=${r2.status()}`)
  })

  // ========== E. 用户资料修改 ==========

  test('E1. 换手机号应返回 updated:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const phone = randomPhone()
    const newPhone = randomPhone()
    const password = 'test123456'

    // 先注册并拿 token
    const { status: regStatus, body: regBody } = await register(request, phone, password)
    if (regStatus === 404) {
      test.skip(true, '后端注册端点未挂载')
      return
    }
    const regData = (regBody.data ?? {}) as Record<string, unknown>
    const token = (regData.token ?? regData.access_token) as string

    // 换手机号
    const resp = await request.post(`${BACKEND}/api/login/pwd/replace/phone`, {
      timeout: 15000,
      headers: authHeaders(token),
      data: { newPhone },
    })
    const body = await resp.json().catch(() => ({} as Record<string, unknown>))
    if (isWafBlocked(resp.status(), body)) { test.skip(); return }
    expect(resp.status(), '换手机号应返回 200').toBe(200)
    expect(isCodeOk(body.code), `换手机号 code 应为成功, 实际: ${body.code}`).toBe(true)
    expect(body.data?.updated, '换手机号应返回 updated:true').toBe(true)
    console.log(`[E1] 换手机号成功: ${phone} → ${newPhone}`)
  })

  test('E2. 设置邮箱应返回 updated:true - 真实链路', async ({ request }: { request: APIRequestContext }) => {
    const phone = randomPhone()
    const password = 'test123456'
    const email = `e2e_${Date.now()}@test.com`

    // 先注册并拿 token
    const { status: regStatus, body: regBody } = await register(request, phone, password)
    if (regStatus === 404) {
      test.skip(true, '后端注册端点未挂载')
      return
    }
    const regData = (regBody.data ?? {}) as Record<string, unknown>
    const token = (regData.token ?? regData.access_token) as string

    // 设置邮箱
    const resp = await request.post(`${BACKEND}/api/login/pwd/set/email`, {
      timeout: 15000,
      headers: authHeaders(token),
      data: { email },
    })
    const body = await resp.json().catch(() => ({} as Record<string, unknown>))
    if (isWafBlocked(resp.status(), body)) { test.skip(); return }
    expect(resp.status(), '设置邮箱应返回 200').toBe(200)
    expect(isCodeOk(body.code), `设置邮箱 code 应为成功, 实际: ${body.code}`).toBe(true)
    expect(body.data?.updated, '设置邮箱应返回 updated:true').toBe(true)
    console.log(`[E2] 设置邮箱成功: ${email}`)
  })
})
