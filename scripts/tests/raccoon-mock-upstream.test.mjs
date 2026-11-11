// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 本地模拟上游测试(2026-11-11 立)。
 *
 * 这条测试回答一个问题:**没有真实手机号时,整条链路能不能被验证到位?**
 * 答案只在 mock 层面成立 —— 服务端是本地替身,码也由替身签发,所以注册/新手任务/
 * 签到领取/流水全部可真跑、可回归;真站的身份验证控制(短信码)不在可模拟范围内,也不应模拟。
 *
 * 断言口径一律对齐线上实测形状(字段名逐字对照),任何形状漂移都会在这里红。
 */
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { createMockUpstream, POINTS, NEW_USER_TASK_KEYS } from '../raccoon-mock-upstream.mjs'
import { encryptCredential } from '../lib/raccoon-crypto.mjs'

const OPEN = []
after(async () => {
  await Promise.all(OPEN.map((m) => m.close()))
})

async function boot(opts = {}) {
  const m = await createMockUpstream({ port: 0, quiet: true, ...opts })
  OPEN.push(m)
  return m
}

const api = (m, p) => `${m.base}${p}`

async function get(m, p, token) {
  const res = await fetch(api(m, p), {
    headers: token ? { authorization: `Bearer ${token}`, accept: 'application/json' } : { accept: 'application/json' },
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}

async function post(m, p, body, token) {
  const res = await fetch(api(m, p), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body ?? {}),
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}

/** 发码:phone 走真实加密口径 */
const sendSms = (m, phone) => post(m, '/api/web/auth/v1/send_sms', { nation_code: '86', phone: encryptCredential(phone) })

/** 注册 */
const register = (m, phone, code, extra = {}) =>
  post(m, '/api/web/auth/v1/register', {
    nation_code: '86',
    phone: encryptCredential(phone),
    password: encryptCredential('Mock-Pass-1!'),
    code,
    ...extra,
  })

test('预置主号:注册礼包 3000 已到账,balance 字段对齐线上(无邀请字段)', async () => {
  const m = await boot()
  const seed = m.seeds[0]
  assert.equal(seed.phone, '13100000000')

  const bal = await get(m, '/api/web/points/v1/balance', seed.token)
  assert.equal(bal.status, 200)
  assert.equal(bal.body.code, 0)
  assert.equal(bal.body.data.available_points, POINTS.REGISTER_PACK)
  assert.equal(bal.body.data.reward_points, POINTS.REGISTER_PACK)
  assert.equal(bal.body.data.daily_points, 0)
  assert.equal(typeof bal.body.data.owner_id, 'number', 'owner_id 应为数字(adapter 真站口径)')

  const tasks = await get(m, '/api/web/points/v1/tasks', seed.token)
  const states = Object.fromEntries(tasks.body.data.new_user_task_states.map((s) => [s.key, s.status]))
  assert.deepEqual(Object.keys(states), [...NEW_USER_TASK_KEYS])
  assert.equal(states.register_pack, 'completed')
  assert.equal(states.desktop_login, 'unfinished')
})

test('发码:明文 phone 按真站措辞拒绝,加密 phone 才放行并回显 mock_code', async () => {
  const m = await boot({ code: '445566' })
  const plain = await post(m, '/api/web/auth/v1/send_sms', { nation_code: '86', phone: '13100000000' })
  assert.equal(plain.status, 400)
  assert.equal(plain.body.code, 100003)
  assert.match(String(plain.body.details), /param phone encrypted error/)

  const enc = await sendSms(m, '13100000000')
  assert.equal(enc.status, 200)
  assert.equal(enc.body.code, 0)
  assert.equal(enc.body.data.mock_code, '445566', 'mock 必须把码回显出来,否则无法自动化')
  assert.equal(enc.body.data.mock, true, '必须自报是 mock,不能冒充真站')
})

test('注册:码错 → 100007 且不建账号;码对 → 建号并可读 user_info', async () => {
  const m = await boot({ code: '112233' })
  await sendSms(m, '13100000001')

  const bad = await register(m, '13100000001', '000000')
  assert.equal(bad.status, 400)
  assert.equal(bad.body.code, 100007)
  assert.equal(bad.body.message, 'sms_code_verify_error')
  assert.equal(m.state.byPhone.has('13100000001'), false, '码错不得建账号')

  const good = await register(m, '13100000001', '112233')
  assert.equal(good.status, 200)
  assert.equal(good.body.code, 0)
  // 令牌必须是 JWT 三段形状:引擎侧按此形状先淘汰非法令牌,非 JWT 会直接判 SessionDead
  assert.equal(good.body.data.access_token.split('.').length, 3, `令牌应为三段 JWT: ${good.body.data.access_token}`)
  assert.equal(m.state.byPhone.get('13100000001').uid, good.body.data.id)

  const ui = await get(m, '/api/web/auth/v1/user_info', good.body.data.access_token)
  assert.equal(ui.body.data.phone, '13100000001', 'user_info 的 phone 应是全号(与线上实证一致)')
  assert.equal(ui.body.data.registration_attribution.registration_source, 'web')
})

test('短信码一次性且绑号:同码换号不可复用', async () => {
  const m = await boot({ code: '778899' })
  await sendSms(m, '13100000002')
  const first = await register(m, '13100000002', '778899')
  assert.equal(first.status, 200)

  // 码已消费;新号没发过码 ⇒ 同码也不认
  const second = await register(m, '13100000003', '778899')
  assert.equal(second.status, 400)
  assert.equal(second.body.code, 100007)
  assert.equal(m.state.byPhone.has('13100000003'), false)
})

test('重复注册:同号二次注册被拒(mock 约定码 100009,已标注未实证)', async () => {
  const m = await boot({ code: '121212' })
  await sendSms(m, '13100000004')
  const a = await register(m, '13100000004', '121212')
  assert.equal(a.status, 200)
  await sendSms(m, '13100000004')
  const b = await register(m, '13100000004', '121212')
  assert.equal(b.status, 400)
  assert.equal(b.body.code, 100009)
  assert.equal(b.body.message, 'phone_registered')
})

test('注册回显:user_info 返回手机号全号,registration_attribution 缺省为 web', async () => {
  const m = await boot({ code: '334455' })
  await sendSms(m, '13100000005')
  const reg = await register(m, '13100000005', '334455')
  assert.equal(reg.status, 200)

  const ui = await get(m, '/api/web/auth/v1/user_info', reg.body.data.access_token)
  assert.equal(ui.body.data.phone, '13100000005', 'user_info 的 phone 应是全号(与线上实证一致)')
  assert.equal(ui.body.data.registration_attribution.registration_source, 'web')
  assert.equal(ui.body.data.registration_attribution.invite_code, undefined, '无邀请时归属里不得出现邀请码')
})

test('桌面端发放:一次调用发一次性 3000 + 每日 300,popup 报最大一笔,二次调用 granted=false', async () => {
  const m = await boot()
  const seed = m.seeds[0]
  const base = seed.points.available

  const first = await post(m, '/api/web/desktop/v1/login/points/grant', {}, seed.token)
  assert.equal(first.status, 200)
  assert.equal(first.body.data.granted, true)
  assert.equal(first.body.data.popup.source, 'desktop_login')
  assert.equal(first.body.data.popup.points, POINTS.DESKTOP_ONCE)
  assert.equal(typeof first.body.data.popup.display_name, 'string')

  const bal = await get(m, '/api/web/points/v1/balance', seed.token)
  assert.equal(bal.body.data.available_points, base + POINTS.DESKTOP_ONCE + POINTS.DAILY, '一次性 + 每日应同次到账')
  assert.equal(bal.body.data.daily_points, POINTS.DAILY)

  const bills = await get(m, '/api/web/points/v2/bills?page=1&page_size=10', seed.token)
  const types = bills.body.data.items.map((b) => b.biz_type)
  assert.ok(types.includes('desktop_login'), `缺 desktop_login 流水: ${types}`)
  assert.ok(types.includes('daily_grant'), `缺 daily_grant 流水: ${types}`)

  const second = await post(m, '/api/web/desktop/v1/login/points/grant', {}, seed.token)
  assert.equal(second.body.data.granted, false, '重复调用是幂等,不是失败')
  assert.equal(second.body.data.popup, null)

  const tasks = await get(m, '/api/web/points/v1/tasks', seed.token)
  const states = Object.fromEntries(tasks.body.data.new_user_task_states.map((s) => [s.key, s.status]))
  assert.equal(states.desktop_login, 'completed')
})

test('移动端发放:一次性 3000,并与桌面端任务态互不覆盖', async () => {
  const m = await boot()
  const seed = m.seeds[0]
  const before = seed.points.available

  const r = await post(m, '/api/web/mobile/v1/login/points/grant', {}, seed.token)
  assert.equal(r.body.data.granted, true)
  assert.equal(r.body.data.popup.source, 'mobile_login')
  assert.equal(r.body.data.popup.points, POINTS.MOBILE_ONCE)

  const bal = await get(m, '/api/web/points/v1/balance', seed.token)
  assert.equal(bal.body.data.available_points, before + POINTS.MOBILE_ONCE)

  const again = await post(m, '/api/web/mobile/v1/login/points/grant', {}, seed.token)
  assert.equal(again.body.data.granted, false)

  const tasks = await get(m, '/api/web/points/v1/tasks', seed.token)
  const states = Object.fromEntries(tasks.body.data.new_user_task_states.map((s) => [s.key, s.status]))
  assert.equal(states.mobile_login, 'completed')
  assert.equal(states.desktop_login, 'unfinished', '移动端领取不得把桌面端任务标完成')
})

test('流水分页:page/page_size 生效且按时间倒序', async () => {
  const m = await boot()
  const seed = m.seeds[0]
  await post(m, '/api/web/desktop/v1/login/points/grant', {}, seed.token)

  const p1 = await get(m, '/api/web/points/v2/bills?page=1&page_size=2', seed.token)
  assert.equal(p1.body.data.items.length, 2)
  assert.equal(p1.body.data.page, 1)
  assert.equal(p1.body.data.page_size, 2)
  assert.equal(p1.body.data.total, 3, '注册礼包 + 桌面 + 每日')

  const p2 = await get(m, '/api/web/points/v2/bills?page=2&page_size=2', seed.token)
  assert.equal(p2.body.data.items.length, 1)
  const newer = new Date(p1.body.data.items[0].created_at).getTime()
  const older = new Date(p2.body.data.items[0].created_at).getTime()
  assert.ok(newer >= older, '第一页应比第二页新')
})

test('模型目录与对话:OpenAI 兼容非流式 + SSE 流式', async () => {
  const m = await boot()
  const seed = m.seeds[0]
  const cat = await get(m, '/api/web/llm/v2/model_catalog', seed.token)
  assert.equal(cat.body.code, 0)
  assert.ok(Array.isArray(cat.body.data.models))
  assert.ok(cat.body.data.models.some((x) => x.id === 'SenseNova-6.8-Flash'))

  const chat = await post(m, '/api/web/llm/v2/chat/completions', { model: 'SenseNova-6.8-Flash', messages: [{ role: 'user', content: 'hi' }] }, seed.token)
  assert.equal(chat.body.code, 0)
  assert.equal(chat.body.data.choices[0].message.role, 'assistant')
  assert.ok(chat.body.data.usage.total_tokens > 0)

  const res = await fetch(api(m, '/api/web/llm/v2/chat/completions'), {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${seed.token}` },
    body: JSON.stringify({ model: 'm', stream: true, messages: [] }),
  })
  const text = await res.text()
  assert.match(text, /^data: /m)
  assert.match(text, /\[DONE\]/)
  assert.match(String(res.headers.get('content-type')), /event-stream/)
})

test('无令牌访问业务面一律 401(不泄露任何数据)', async () => {
  const m = await boot()
  for (const p of ['/api/web/points/v1/balance', '/api/web/points/v1/tasks', '/api/web/auth/v1/user_info']) {
    const r = await get(m, p)
    assert.equal(r.status, 401, `${p} 应 401`)
    assert.equal(r.body.code, 401)
  }
})

test('只监听 127.0.0.1(测试替身不得暴露到局域网)', async () => {
  const m = await boot()
  const addr = m.server.address()
  assert.equal(addr.address, '127.0.0.1')
  assert.ok(m.base.startsWith('http://127.0.0.1:'))
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
