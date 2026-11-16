// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 豆包「网页登录加号」执行端(2026-11-17 立)。
 *
 * 立因:豆包上游账号信息接口只回掩码(`+86 157******40`,四端实测),而用户加号时
 * 本来就会在登录页亲手输入**完整手机号**。与其事后再让用户单独提供一次,不如把
 * 登录页交回真实浏览器:用户填手机号 + 收验证码,本脚本从页面输入框/CDP 网络请求里
 * 读到全号,同时抓取登录后的整包 cookies,直接落号池(全号命名,无需二次补号)。
 *
 * 实现:不装 Playwright(项目现有 web e2e 依赖未落地浏览器),直接驱动本机
 * Edge/Chrome 的 CDP:
 *   启动独立 user-data-dir(不碰用户日常浏览器)
 *   → /json/new 打开 https://www.doubao.com/chat/(未登录会自动进登录页)
 *   → 每 1s 轮询: 输入框全号 / send_code 请求体全号 / cookies 是否出现 sessionid
 *   → 登录完成后 Network.getAllCookies 抓 .doubao.com 整包
 *   → 写临时 payload,复用 scripts/relay-account-pool.mjs 同一条导入通路
 *     (全号命名 + 永久保活 + 自动签到 + 自动推生产)
 *   → 关浏览器、删临时 payload 与临时 profile。
 *
 * 用法:
 *   node scripts/doubao-web-login.mjs                 # 归属取 ~/.wb-switch/pool-owner
 *   node scripts/doubao-web-login.mjs --owner <id>    # 显式归属
 *   node scripts/doubao-web-login.mjs --no-sync-prod  # 只落本地(调试)
 *   node scripts/doubao-web-login.mjs --timeout 600   # 等登录最长秒数(默认 600)
 *
 * 退出码:0 入池成功 / 1 未捕获到手机号或登录态 / 2 环境未判定(没浏览器/端口失败)。
 */
import { spawn, spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const DOUBAO_HOME = 'https://www.doubao.com/login'

const BROWSER_CANDIDATES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  path.join(process.env.LOCALAPPDATA ?? '', 'Google\\Chrome\\Application\\chrome.exe'),
]

const FULL_PHONE_RE = /(?<!\d)(?:\+?86|0086)?(1[3-9]\d{9})(?!\d)/

export function extractFullPhone(text) {
  if (typeof text !== 'string') return ''
  // 先把被空格/连字符/括号拆开的号码拼回去,再按数字边界取号:
  // `mobile=157 5432 0340` / `+86 157-5432-0340` 都要命中,而
  // `device_id=1976300013104096` 这类长数字绝不能截出 11 位假号。
  const normalized = text.replace(/(?<=\d)[\s()\-]+(?=\d)/g, '')
  const m = FULL_PHONE_RE.exec(normalized)
  return m ? m[1] : ''
}

/** 从登录页输入框/CDP 请求体里提取全号(与 relay-account-format 同形判据) */
export function pickPhoneFromValues(values) {
  for (const v of Array.isArray(values) ? values : []) {
    const p = extractFullPhone(String(v ?? ''))
    if (p) return p
  }
  return ''
}

export function buildDoubaoPayload({ phone, cookies }) {
  const normalized = (Array.isArray(cookies) ? cookies : [])
    .filter((c) => c && typeof c.name === 'string' && typeof c.value === 'string')
    .filter((c) => !c.domain || String(c.domain).toLowerCase().endsWith('doubao.com'))
    .map((c) => {
      const host = typeof c.domain === 'string' && c.domain ? c.domain : '.doubao.com'
      let name = c.name
      // CDP 里站点前缀形如 __Host- / __Secure- 的名字保持原样;其余直接落 name
      if (!name) name = ''
      return { source: 'cookies', key: name, host, name, value: c.value }
    })
    .filter((c) => c.name && c.value)
  const uidTt = normalized.find((c) => c.name === 'uid_tt' || c.name === 'uid_tt_ss')
  const primary =
    ['sessionid', 'sessionid_ss', 'sid_tt', 'uid_tt', 'ttwid', 'odin_tt']
      .map((n) => normalized.find((c) => c.name === n))
      .find(Boolean) ?? normalized[0]
  const uid = uidTt
    ? `auto:${crypto
        .createHash('sha256')
        .update(`doubao:uid:${String(uidTt.value).trim()}`)
        .digest('hex')
        .slice(0, 32)}`
    : `auto:${crypto
        .createHash('sha256')
        .update(JSON.stringify(normalized.map((c) => `${c.host}|${c.name}`)))
        .digest('hex')
        .slice(0, 32)}`
  return {
    providerCode: 'doubao',
    accounts: [
      {
        name: phone,
        phone,
        token: primary?.value ?? '',
        uid,
        cookies: normalized,
        enabled: true,
        keepAliveForever: true,
      },
    ],
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.unref()
    srv.on('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port
      srv.close(() => resolve(port))
    })
  })
}

async function httpJson(url, opts) {
  const res = await fetch(url, opts)
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`)
  return res.json()
}

class Cdp {
  constructor(ws) {
    this.ws = ws
    this.nextId = 0
    this.pending = new Map()
    this.listeners = new Map()
    ws.addEventListener('message', (ev) => {
      let msg
      try {
        msg = JSON.parse(ev.data)
      } catch {
        return
      }
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        if (msg.error)
          reject(new Error(`${msg.error.message ?? 'CDP error'} (${msg.method ?? ''})`))
        else resolve(msg.result)
        return
      }
      if (msg.method && this.listeners.has(msg.method)) {
        for (const fn of this.listeners.get(msg.method)) fn(msg.params)
      }
    })
  }

  static async connect(wsUrl) {
    const ws = new WebSocket(wsUrl)
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true })
      ws.addEventListener('error', () => reject(new Error(`CDP 连接失败: ${wsUrl}`)), {
        once: true,
      })
    })
    return new Cdp(ws)
  }

  send(method, params = {}) {
    const id = ++this.nextId
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, new Set())
    this.listeners.get(method).add(fn)
  }

  close() {
    try {
      this.ws.close()
    } catch {
      /* ignore */
    }
  }
}

function resolveBrowserExe() {
  for (const p of BROWSER_CANDIDATES) {
    if (p && fs.existsSync(p)) return p
  }
  return ''
}

function parseArgs(argv) {
  const opts = {
    owner: '',
    syncProd: true,
    timeoutSec: 600,
    port: 0,
    keepProfile: false,
    browser: '',
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--owner') opts.owner = (argv[++i] ?? '').trim()
    else if (a === '--no-sync-prod') opts.syncProd = false
    else if (a === '--timeout') opts.timeoutSec = Math.max(10, Number(argv[++i]) || 600)
    else if (a === '--port') opts.port = Number(argv[++i]) || 0
    else if (a === '--keep-profile') opts.keepProfile = true
    else if (a === '--browser') opts.browser = (argv[++i] ?? '').trim()
    else if (a === '--help' || a === '-h') return { help: true }
    else return { error: `未知参数: ${a}` }
  }
  return { opts }
}

function printHelp() {
  process.stdout.write(
    [
      '豆包网页登录加号(真实浏览器里填手机号 + 收验证码,自动读全号并入池)',
      '',
      '  node scripts/doubao-web-login.mjs [--owner <users.id>] [--no-sync-prod] [--timeout 600]',
      '',
      '  不加 --owner 时取本机 ~/.wb-switch/pool-owner;默认自动同步生产。',
      '  登录完成后脚本会自动读取全号与 cookies,复用号池同一条导入通路。',
      '',
    ].join('\n'),
  )
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2))
  if (parsed.help) {
    printHelp()
    return 0
  }
  if (parsed.error) {
    process.stderr.write(`❌ ${parsed.error}\n`)
    return 2
  }
  const opts = parsed.opts
  const exe = opts.browser || resolveBrowserExe()
  if (!exe) {
    process.stderr.write('❌ 未找到 Edge/Chrome(可用 --browser <exe> 指定)\n')
    return 2
  }
  const port = opts.port || (await freePort())
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const profileDir = path.join(ROOT, '.ihui-agent', 'tmp', `doubao-web-login-${stamp}`)
  fs.mkdirSync(profileDir, { recursive: true })

  process.stdout.write(`🌐 浏览器: ${exe}\n`)
  process.stdout.write('   已打开独立登录窗口;请点「手机号登录」,填完整手机号并接收验证码。\n')
  process.stdout.write('   登录成功后会自动读取全号与整包 cookies 并入池,无需再单独提供手机号。\n')

  const child = spawn(
    exe,
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-sync',
      '--disable-extensions',
      '--window-size=1200,900',
      'about:blank',
    ],
    { stdio: 'ignore', windowsHide: false },
  )

  let cdp = null
  let browserCdp = null
  let imported = false
  try {
    // 等调试端口就绪
    let version = null
    const deadline = Date.now() + 20_000
    while (Date.now() < deadline) {
      try {
        version = await httpJson(`http://127.0.0.1:${port}/json/version`)
        break
      } catch {
        await sleep(300)
      }
    }
    if (!version) {
      process.stderr.write('❌ 浏览器调试端口未就绪(环境未判定)\n')
      return 2
    }
    // 打开豆包;未登录会自动跳登录页
    let page
    try {
      page = await httpJson(
        `http://127.0.0.1:${port}/json/new?${encodeURIComponent(DOUBAO_HOME)}`,
        { method: 'PUT' },
      )
    } catch {
      page = await httpJson(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(DOUBAO_HOME)}`)
    }
    if (!page?.webSocketDebuggerUrl) {
      process.stderr.write('❌ 无法创建登录标签页(环境未判定)\n')
      return 2
    }
    cdp = await Cdp.connect(page.webSocketDebuggerUrl)
    browserCdp = version.webSocketDebuggerUrl
      ? await Cdp.connect(version.webSocketDebuggerUrl)
      : null
    await cdp.send('Network.enable')
    await cdp.send('Runtime.enable')

    let phone = ''
    const rememberPhone = (v) => {
      if (phone) return
      const p = extractFullPhone(String(v ?? ''))
      if (p) {
        phone = p
        process.stdout.write(`📱 已读取完整手机号: ${p.slice(0, 3)}******${p.slice(-2)}\n`)
      }
    }
    cdp.on('Network.requestWillBeSent', (params) => {
      const req = params?.request
      if (!req) return
      if (!/doubao\.com|byteoversea|passport/i.test(String(req.url ?? ''))) return
      if (req.postData) rememberPhone(req.postData)
    })

    const started = Date.now()
    let lastReport = 0
    let reportedPage = false
    while (Date.now() - started < opts.timeoutSec * 1000) {
      let state = { phone: '', url: '', text: '' }
      try {
        const r = await cdp.send('Runtime.evaluate', {
          expression: `(() => {
            const vals = [...document.querySelectorAll('input')].map(i => i.value || '');
            return JSON.stringify({ vals, url: location.href, text: (document.body && document.body.innerText || '').slice(0, 200) });
          })()`,
          returnByValue: true,
        })
        state = JSON.parse(r?.result?.value ?? '{}')
      } catch {
        /* 页面导航中,下一轮再试 */
      }
      if (!reportedPage && state.url && state.url !== 'about:blank') {
        reportedPage = true
        process.stdout.write(
          `📄 页面已加载: ${state.url} | 输入框=${(state.vals ?? []).length}` +
            (state.text ? ` | ${String(state.text).replace(/\s+/g, ' ').slice(0, 60)}` : '') +
            '\n',
        )
      }
      rememberPhone(pickPhoneFromValues(state.vals))
      const cookies = await cdp
        .send('Network.getAllCookies')
        .then((r) => r?.cookies ?? [])
        .catch(() => [])
      const doubaoCookie = cookies.filter((c) => String(c.domain ?? '').includes('doubao.com'))
      const hasSession = doubaoCookie.some((c) => c.name === 'sessionid' && c.value)
      const hasUid = doubaoCookie.some((c) => c.name === 'uid_tt' && c.value)
      const onLogin = /login|passport/i.test(String(state.url ?? ''))
      if (Date.now() - lastReport > 10_000) {
        lastReport = Date.now()
        process.stdout.write(
          `… 等待登录(${Math.round((Date.now() - started) / 1000)}s)` +
            `${phone ? ' 手机号已读到' : ''}${hasSession ? ' 会话已出现' : ''}\n`,
        )
      }
      if (phone && hasSession && hasUid && !onLogin) {
        await sleep(1500)
        const finalCookies = await cdp
          .send('Network.getAllCookies')
          .then((r) => r?.cookies ?? [])
          .catch(() => [])
        const payload = buildDoubaoPayload({
          phone,
          cookies: finalCookies.filter((c) => String(c.domain ?? '').includes('doubao.com')),
        })
        if (!payload.accounts[0].cookies.some((c) => c.name === 'sessionid')) {
          process.stderr.write('❌ 登录态未落 cookies(sessionid 缺失)⇒ 未判定,请重试\n')
          return 1
        }
        const payloadFile = path.join(profileDir, 'payload.json')
        fs.writeFileSync(payloadFile, JSON.stringify(payload))
        const args = ['scripts/relay-account-pool.mjs', '--file', payloadFile]
        if (opts.owner) args.push('--owner', opts.owner)
        if (!opts.syncProd) args.push('--no-sync-prod')
        process.stdout.write('⬆️ 登录完成,开始入池(全号命名/永久保活/自动签到/自动推生产)…\n')
        const r = spawnSync(process.execPath, args, {
          cwd: ROOT,
          stdio: 'inherit',
          windowsHide: true,
        })
        imported = r.status === 0
        if (!imported) {
          process.stderr.write(`❌ 入池失败(exit ${r.status ?? 'unknown'})\n`)
          return 1
        }
        process.stdout.write('✅ 已完成:该豆包号已入 admin 号池并同步生产。\n')
        break
      }
      await sleep(1000)
    }
    if (!imported) {
      process.stderr.write(
        `❌ 等待超时(${opts.timeoutSec}s):未同时捕获到完整手机号与登录态。` +
          '请确认是在打开的窗口里用手机号+验证码登录(不是扫码),然后重试。\n',
      )
      return 1
    }
    return 0
  } finally {
    try {
      if (browserCdp) await browserCdp.send('Browser.close').catch(() => {})
    } catch {
      /* ignore */
    }
    cdp?.close()
    browserCdp?.close()
    try {
      child.kill()
    } catch {
      /* ignore */
    }
    // Edge 是多进程:主进程退了,渲染/utility 子进程还可能短暂持有 profile 文件句柄,
    // 直接 rm 会 EPERM。先整棵树收掉,再重试删除;仍删不掉只告警,不把成功入池判成失败。
    try {
      if (child.pid) {
        spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
          windowsHide: true,
          stdio: 'ignore',
        })
      }
    } catch {
      /* ignore */
    }
    await sleep(2000)
    if (!opts.keepProfile) {
      let removed = false
      for (let i = 0; i < 6 && !removed; i++) {
        try {
          fs.rmSync(profileDir, { recursive: true, force: true })
          removed = !fs.existsSync(profileDir)
        } catch {
          await sleep(1000)
        }
      }
      if (!removed) {
        process.stdout.write(
          `ℹ️ 临时 profile 将在浏览器退出后自动清理失败,可手动删除: ${profileDir}\n`,
        )
      }
    } else {
      process.stdout.write(`ℹ️ 已保留临时 profile: ${profileDir}\n`)
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      process.stderr.write(`❌ ${e instanceof Error ? e.message : String(e)}\n`)
      process.exit(1)
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
