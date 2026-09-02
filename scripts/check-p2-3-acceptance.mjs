// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan)
// P2-3 真机验收 — 服务端编排链路一键验证脚本
//
// 作用:不依赖 GUI(扩展/桌面端)加载,用脚本模拟一个「桌面端」完成
//   login → ws-ticket → WS 连接 → capability 上报 → execute 推送 → result 回传
// 全程闭环,验证 P2-3 服务端编排链路(含 2026-09-02 ws-ticket 脱敏修复)真实可用。
//
// 用法:
//   node scripts/check-p2-3-acceptance.mjs            # 默认 admin/admin123
//   ACCOUNT=test@aizhs.top PASSWORD=Test@123456 node scripts/check-p2-3-acceptance.mjs
//   node scripts/check-p2-3-acceptance.mjs <account> <password>
//
// 注意:本脚本验证的是「api + ws 编排层」。真实 GUI(扩展/桌面端)只需实现
//   与脚本相同的 capability 上报 + WS 监听 + result 回传闭环即可,已在
//   apps/extension/lib/agent-control-bridge.ts 与 apps/desktop/src-tauri/src/lib.rs 落地。

const BASE = process.env.API_BASE ?? 'http://localhost:8802'
const ACCOUNT = process.argv[2] ?? process.env.ACCOUNT ?? 'admin'
const PASSWORD = process.argv[3] ?? process.env.PASSWORD ?? 'admin123'

const log = (...a) => console.log(...a)
const step = (n, msg) => log(`\n[${n}] ${msg}`)

function decodeJwtSub(token) {
  try {
    const p = token.split('.')[1]
    const json = JSON.parse(Buffer.from(p, 'base64url').toString('utf-8'))
    return json.sub ?? json.userId ?? json.id ?? null
  } catch {
    return null
  }
}

async function post(path, { token, body }) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = { _raw: text }
  }
  return { status: res.status, json }
}

// 原生 WebSocket(EventTarget) 兼容封装:支持 addEventListener 与 .on 两种形态
function openWs(url) {
  const ws = new WebSocket(url)
  return new Promise((resolve, reject) => {
    let done = false
    const onOpen = () => {
      if (done) return
      done = true
      resolve(ws)
    }
    const onErr = (e) => {
      if (done) return
      done = true
      reject(new Error(e?.message ?? 'WS 连接错误'))
    }
    const timer = setTimeout(() => onErr(new Error('WS 连接超时 5s')), 5000)
    const clear = () => clearTimeout(timer)
    if (typeof ws.addEventListener === 'function') {
      ws.addEventListener('open', () => {
        clear()
        onOpen()
      })
      ws.addEventListener('error', (e) => {
        clear()
        onErr(e)
      })
    } else {
      ws.on('open', () => {
        clear()
        onOpen()
      })
      ws.on('error', (e) => {
        clear()
        onErr(e)
      })
    }
  })
}

function onWsMessage(ws, handler) {
  if (typeof ws.addEventListener === 'function') {
    ws.addEventListener('message', (e) => {
      const data = typeof e.data === 'string' ? e.data : Buffer.from(e.data).toString()
      handler(data)
    })
  } else {
    ws.on('message', (data) => handler(data.toString()))
  }
}

const results = []
const verdict = (name, ok, detail) => {
  results.push({ name, ok, detail })
  log(`   ${ok ? '✅ PASS' : '❌ FAIL'} — ${name}: ${detail}`)
}

async function main() {
  log(`P2-3 服务端编排验收  BASE=${BASE}  ACCOUNT=${ACCOUNT}`)

  // 1) 登录
  step(1, '登录 /api/auth/login')
  const login = await post('/api/auth/login', { body: { account: ACCOUNT, password: PASSWORD } })
  if (login.status !== 200 || !login.json?.data?.accessToken) {
    verdict('login', false, `HTTP ${login.status} ${JSON.stringify(login.json).slice(0, 200)}`)
    if (login.json?.data?.twoFactorRequired) {
      log('   ⚠️ 该账号启用了 2FA,本脚本未实现二次校验,请换用未启用 2FA 的账号或手动完成。')
    }
    return finish()
  }
  const accessToken = login.json.data.accessToken
  const userId = decodeJwtSub(accessToken)
  verdict('login', true, `accessToken 已签发, userId=${userId}`)

  // 2) ws-ticket 换取(核心修复点)
  step(2, '换取 WS 票据 /ws/ticket(验证脱敏修复)')
  const ticket = await post('/ws/ticket', { token: accessToken, body: {} })
  const wsToken = ticket.json?.data?.wsToken
  if (ticket.status !== 200 || !wsToken) {
    verdict('ws-ticket', false, `HTTP ${ticket.status} ${JSON.stringify(ticket.json).slice(0, 200)}`)
    return finish()
  }
  // 关键断言:wsToken 不得被 response-sanitizer 遮蔽为 '***'
  const masked = wsToken === '***' || wsToken.includes('*')
  verdict(
    'ws-ticket',
    !masked,
    masked
      ? `wsToken 被脱敏为 "${wsToken}" — 2026-09-02 修复未生效!`
      : `wsToken 明文返回(长度 ${wsToken.length}), 脱敏修复生效`,
  )
  if (masked) return finish()

  // 3) 建立 WS 连接(模拟桌面端)
  step(3, '建立 WS 连接 /ws/notifications?token=<wsToken>')
  const wsUrl = `${BASE.replace('http', 'ws')}/ws/notifications?token=${encodeURIComponent(wsToken)}`
  let ws
  try {
    ws = await openWs(wsUrl)
    verdict('ws-connect', true, 'WS 已 open, 等待 agent.action 推送')
  } catch (e) {
    verdict('ws-connect', false, String(e?.message ?? e))
    return finish()
  }

  // 4) 上报桌面端能力(模拟桌面端启动)
  step(4, '上报能力 /api/agent-control/capability (endpoint=desktop)')
  const cap = await post('/api/agent-control/capability', {
    token: accessToken,
    body: {
      endpoint: 'desktop',
      instanceId: `acceptance-${Date.now()}`,
      computerActions: ['keyboard_type', 'mouse_click', 'screenshot_screen', 'mouse_scroll'],
      version: 'acceptance/1.0',
      reportedAt: new Date().toISOString(),
    },
  })
  if (cap.status !== 200 || !cap.json?.data?.registered) {
    verdict('capability', false, `HTTP ${cap.status} ${JSON.stringify(cap.json).slice(0, 200)}`)
    ws.close()
    return finish()
  }
  verdict('capability', true, '桌面端已注册, 可接收 computer 类指令')

  // 5) 驱动 execute 并自动回传 result(完整闭环)
  step(5, '驱动 /api/agent-control/execute → WS 推送 → /result 回传')
  const requestId = `accept-${Date.now()}`
  let resultPosted = false
  const execAck = { value: null }

  onWsMessage(ws, (raw) => {
    let msg
    try {
      msg = JSON.parse(raw)
    } catch {
      return
    }
    // 服务端 pushNotification 始终包 {type:'notification', data: payload}
    // (多实例经 Redis pub/sub / 单实例直推一致),需解包到内层 agent.action
    if (msg?.type === 'notification' && msg?.data) {
      msg = msg.data
    }
    if (msg?.type === 'agent.action' && msg?.request?.requestId === requestId) {
      log('   ← 收到 agent.action 推送, 回传 result')
      post('/api/agent-control/result', {
        token: accessToken,
        body: {
          requestId,
          success: true,
          executedBy: 'desktop',
          durationMs: 12,
          data: { ok: true, echoed: msg.request.params?.text },
        },
      }).then(() => {
        resultPosted = true
      })
    }
  })

  const exec = await post('/api/agent-control/execute', {
    token: accessToken,
    body: {
      requestId,
      category: 'computer',
      action: 'keyboard_type',
      params: { text: 'P2-3 acceptance' },
      userId,
      timeout: 10000,
    },
  })
  execAck.value = exec
  const ok = exec.status === 200 && exec.json?.data?.success === true
  verdict(
    'execute-roundtrip',
    ok,
    ok
      ? `execute 成功返回 (executedBy=${exec.json?.data?.executedBy}, errorCode=${exec.json?.data?.errorCode ?? 'none'})`
      : `HTTP ${exec.status} ${JSON.stringify(exec.json).slice(0, 240)}`,
  )

  await new Promise((r) => setTimeout(r, 300))
  verdict('result-received', resultPosted, resultPosted ? 'result 已回传, pending Promise 已 resolve' : 'result 未回传')

  ws.close()
  finish()
}

function finish() {
  const passed = results.filter((r) => r.ok).length
  const total = results.length
  log(`\n===== P2-3 服务端编排验收: ${passed}/${total} 通过 =====`)
  const allPass = passed === total
  if (allPass) {
    log('结论:编排链路(server→ws→endpoint→result)全绿。仅剩「真实 GUI 客户端加载」一步:')
    log('  A. 浏览器扩展:chrome://extensions → 开发者模式 → 加载已解压 → 选 apps/extension/.output/chrome-mv3')
    log('  B. 桌面端:pnpm --filter @ihui/desktop dev(需先腾出 8801)')
    log('  登录同一账号后,真实 computer_*/browser_* 指令即可走通,闭环完成。')
  } else {
    log('结论:编排链路存在失败项,需先修复后再做 GUI 验收。')
  }
  process.exit(allPass ? 0 : 1)
}

main().catch((e) => {
  log('脚本异常:', e)
  process.exit(2)
})
