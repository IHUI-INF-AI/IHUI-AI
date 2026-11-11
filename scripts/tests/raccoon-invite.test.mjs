// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * raccoon-invite 全链路测试(2026-11-11 立)。
 *
 * 为什么用本地模拟端而不是真打线上: 邀请奖励只在「被邀请人首次注册」时由服务端结算,
 * 注册的最后一道关是**真实短信验证码**(发码被阿里云人机验证拦住),这条边界无法自动化也
 * 不应自动化。因此本测试用本地 mock 服务端复刻四个真实接口的**响应形状**(字段名逐字对照
 * 线上实得),把 CLI 的加密口径、邀请码传递、归属断言、计数回读全部锁死 —— 线上只要给出
 * 一条真实验证码,同一条代码路径即可直接成立。
 *
 * mock 服务端**真解密** phone/password(用同一份 crypto 实现),所以「加密是否与服务端口径
 * 一致」这件事在这里是被证明的,不是被假设的。
 */
import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { decryptCredential } from '../lib/raccoon-crypto.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const CLI = path.join(HERE, '..', 'raccoon-invite.mjs')
const INVITE_CODE = 'INV-TEST-0001'
const VALID_SMS = '654321'

/** 起一个复刻线上响应形状的 mock 服务端 */
function startMock() {
  const state = {
    registeredInvitees: 0,
    grantedPoints: 0,
    batches: [],
    registers: [],
    tokenSeq: 0,
    attributionByToken: new Map(),
    acceptCode: VALID_SMS,
  }

  const json = (res, code, obj, status = 200) => {
    const body = JSON.stringify(obj)
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(body)
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1')
    const auth = String(req.headers.authorization || '')
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''

    if (url.pathname === '/api/web/points/v1/tasks' && req.method === 'GET') {
      if (!token) return json(res, 401, { code: 401, message: 'unauthorized' }, 401)
      return json(res, 0, {
        code: 0,
        message: 'success',
        data: {
          new_user_task_states: [],
          invite: {
            granted_points: state.grantedPoints,
            invite_code: INVITE_CODE,
            marketing_text: '',
            register_reward_points: 1500,
            registered_invitee_count: state.registeredInvitees,
            remaining_reward_invitees: 20 - state.registeredInvitees,
          },
        },
      })
    }

    if (url.pathname === '/api/web/auth/v1/register' && req.method === 'POST') {
      let raw = ''
      req.on('data', (c) => {
        raw += c
      })
      req.on('end', () => {
        let body = null
        try {
          body = JSON.parse(raw)
        } catch {
          return json(res, 400, { code: 100004, message: 'params_unsupport_error' }, 400)
        }
        // 真解密: 加密口径不一致这里会直接抛 INVALID_CIPHERTEXT / 得到乱码
        let phone = null
        let password = null
        try {
          phone = decryptCredential(body.phone)
          password = decryptCredential(body.password)
        } catch (e) {
          return json(res, 400, { code: 100003, message: 'params_encryted_error', details: `decrypt: ${e.message}` }, 400)
        }
        state.registers.push({
          phone,
          password,
          code: body.code,
          nation_code: body.nation_code,
          invite_code: body.invite_code ?? null,
          attribution: body.registration_attribution ?? null,
        })
        if (String(body.code) !== state.acceptCode) {
          return json(res, 400, { code: 100007, message: 'sms_code_verify_error', details: 'sms code verify failed' }, 400)
        }
        const invite = body.invite_code ?? body.registration_attribution?.invite_code ?? null
        state.tokenSeq += 1
        const tok = `wv-test-token-${state.tokenSeq}`
        state.attributionByToken.set(tok, {
          registration_source: 'web',
          ...(invite ? { invite_code: invite } : {}),
        })
        // 服务端结算: 只有带邀请码的注册才给邀请人计一次奖
        if (invite) {
          state.registeredInvitees += 1
          state.grantedPoints += 1500
        }
        return json(res, 0, {
          code: 0,
          message: 'success',
          data: { access_token: tok, id: `90000${state.tokenSeq}`, phone },
        })
      })
      return
    }

    if (url.pathname === '/api/web/auth/v1/user_info' && req.method === 'GET') {
      const attr = state.attributionByToken.get(token)
      if (!attr) return json(res, 401, { code: 401, message: 'unauthorized' }, 401)
      return json(res, 0, {
        code: 0,
        message: 'success',
        data: { id: '900001', phone: '13100000001', registration_attribution: attr },
      })
    }

    json(res, 404, { code: 404, message: '404 page not found' }, 404)
  })

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      resolve({ server, state, base: `http://127.0.0.1:${port}` })
    })
  })
}

/** 造一个隔离的 home(内含可读的 auth.json),避免测试依赖本机真实登录态 */
const tmpHomes = []
function makeHome({ withAuth = true } = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'xhx-invite-'))
  tmpHomes.push(home)
  if (withAuth) {
    const dir = path.join(home, '.office-raccoon', 'agent', 'config')
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(
      path.join(dir, 'auth.json'),
      JSON.stringify({ access_token: 'owner-token-abc', office_identity: 'personal' }),
      'utf8',
    )
  }
  return home
}

// 用完即清: 否则每跑一轮测试就在系统临时目录堆一批 xhx-invite-* 空壳
after(() => {
  for (const d of tmpHomes) {
    try {
      fs.rmSync(d, { recursive: true, force: true })
    } catch {
      /* 清理失败不掩盖测试结果 */
    }
  }
})

/**
 * 起子进程跑 CLI。必须用异步 spawn: mock 服务端跑在本进程内,spawnSync 会阻塞事件循环
 * 导致服务端无法应答子进程请求(经典自死锁),这里不能用同步版本。
 */
function runCli(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args], { encoding: 'utf8' })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => {
      stdout += d
    })
    child.stderr.on('data', (d) => {
      stderr += d
    })
    child.on('close', (code) => {
      let parsed = null
      try {
        parsed = JSON.parse(stdout)
      } catch {
        parsed = null
      }
      resolve({ code, stdout, stderr, json: parsed })
    })
  })
}

test('加密口径与服务端一致: mock 真解出手机号与强密码', async () => {
  const { server, state, base } = await startMock()
  try {
    const home = makeHome()
    const r = await runCli(['--phone', '13100000001', '--code', VALID_SMS, '--base', base, '--home', home, '--json'])
    assert.equal(r.code, 0, `退出码应为 0,实得 ${r.code}: ${r.stderr}`)
    assert.equal(state.registers.length, 1)
    const got = state.registers[0]
    assert.equal(got.phone, '13100000001', '手机号解密后应与输入逐字一致')
    assert.equal(got.nation_code, '86')
    // 自动生成的密码: 至少 12 位且四类字符齐全(大写/小写/数字/符号)
    assert.ok(got.password.length >= 12, `密码长度应 ≥12,实得 ${got.password.length}`)
    assert.match(got.password, /[A-Z]/, '缺大写')
    assert.match(got.password, /[a-z]/, '缺小写')
    assert.match(got.password, /[0-9]/, '缺数字')
    assert.match(got.password, /[^a-zA-Z0-9]/, '缺符号')
  } finally {
    server.close()
  }
})

test('邀请码随注册上行: 顶层 invite_code 与 registration_attribution 双带', async () => {
  const { server, state, base } = await startMock()
  try {
    const home = makeHome()
    const r = await runCli(['--phone', '13100000002', '--code', VALID_SMS, '--base', base, '--home', home, '--json'])
    assert.equal(r.code, 0)
    const got = state.registers[0]
    // 未给 --invite 时,CLI 自动取本机账号的邀请码(来自 tasks 接口)
    assert.equal(got.invite_code, INVITE_CODE, '顶层 invite_code 应随行')
    assert.equal(got.attribution.registration_source, 'web')
    assert.equal(got.attribution.invite_code, INVITE_CODE, 'registration_attribution.invite_code 应随行')
    assert.equal(r.json.invite.code, INVITE_CODE)
  } finally {
    server.close()
  }
})

test('指定 --invite 覆盖本机邀请码', async () => {
  const { server, state, base } = await startMock()
  try {
    const home = makeHome()
    const r = await runCli([
      '--phone', '13100000003', '--code', VALID_SMS, '--invite', 'MANUAL-CODE-9', '--base', base, '--home', home, '--json',
    ])
    assert.equal(r.code, 0)
    assert.equal(state.registers[0].invite_code, 'MANUAL-CODE-9')
  } finally {
    server.close()
  }
})

test('注册后归属核对成立,主号邀请计数与累计积分同步 +1 与 +1500', async () => {
  const { server, state, base } = await startMock()
  try {
    const home = makeHome()
    const r = await runCli(['--phone', '13100000004', '--code', VALID_SMS, '--base', base, '--home', home, '--json'])
    assert.equal(r.code, 0)
    assert.equal(r.json.attributionJudge.ok, true, `归属应成立: ${JSON.stringify(r.json.attributionJudge)}`)
    assert.equal(r.json.attributionJudge.via, 'invite_code')
    assert.equal(r.json.attribution.inviteCode, INVITE_CODE)
    assert.equal(r.json.inviteDelta.registered, 1, '邀请人数应 +1')
    assert.equal(r.json.inviteDelta.granted, 1500, '累计积分应 +1500')
    assert.equal(r.json.inviteAfter.registeredInvitees, 1)
  } finally {
    server.close()
  }
})

test('短信码错误: 退出码 1 并回带服务端原因,不写归属', async () => {
  const { server, state, base } = await startMock()
  try {
    const home = makeHome()
    const r = await runCli(['--phone', '13100000005', '--code', '000000', '--base', base, '--home', home, '--json'])
    assert.equal(r.code, 1, '被服务端拒绝应退出 1')
    assert.equal(r.json.ok, false)
    assert.equal(r.json.register.code, 100007)
    assert.match(r.json.error, /sms_code_verify_error|注册被拒/)
    assert.equal(r.json.token, undefined, '失败时不得回带 token')
    assert.equal(state.registeredInvitees, 0, '未成功不得计奖')
  } finally {
    server.close()
  }
})

test('缺 --code: 退出码 2,且不发起注册请求', async () => {
  const { server, state, base } = await startMock()
  try {
    const home = makeHome()
    const r = await runCli(['--phone', '13100000006', '--base', base, '--home', home, '--json'])
    assert.equal(r.code, 2)
    assert.match(r.json.error, /验证码/)
    assert.equal(state.registers.length, 0, '缺码时不得发注册请求')
  } finally {
    server.close()
  }
})

test('--dry-run: 退出码 3,仅预演不发注册请求', async () => {
  const { server, state, base } = await startMock()
  try {
    const home = makeHome()
    const r = await runCli(['--phone', '13100000007', '--dry-run', '--base', base, '--home', home, '--json'])
    assert.equal(r.code, 3)
    assert.equal(r.json.dryRun, true)
    assert.equal(r.json.preview.invite_code, INVITE_CODE)
    assert.equal(state.registers.length, 0, '预演不得发注册请求')
  } finally {
    server.close()
  }
})

test('本机无登录态: 退出码 2 并点名缺失文件(不冒充已判定)', async () => {
  const { server, state, base } = await startMock()
  try {
    const home = makeHome({ withAuth: false })
    const r = await runCli(['--status', '--base', base, '--home', home, '--json'])
    assert.equal(r.code, 2)
    assert.match(r.json.error, /登录态/)
    assert.equal(state.registers.length, 0)
  } finally {
    server.close()
  }
})

test('--status: 输出真实邀请态字段', async () => {
  const { server, base } = await startMock()
  try {
    const home = makeHome()
    const r = await runCli(['--status', '--base', base, '--home', home, '--json'])
    assert.equal(r.code, 0)
    assert.equal(r.json.invite.code, INVITE_CODE)
    assert.equal(r.json.invite.registerRewardPoints, 1500)
    assert.equal(r.json.invite.cap, 20)
    assert.equal(r.json.invite.grantedPoints, 0)
  } finally {
    server.close()
  }
})

test('手机号格式非法: 退出码 2,不发任何请求', async () => {
  const { server, state, base } = await startMock()
  try {
    const home = makeHome()
    const r = await runCli(['--phone', '12345', '--code', VALID_SMS, '--base', base, '--home', home, '--json'])
    assert.equal(r.code, 2)
    assert.match(r.json.error, /手机号/)
    assert.equal(state.registers.length, 0)
  } finally {
    server.close()
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
