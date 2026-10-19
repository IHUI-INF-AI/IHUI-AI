// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// npm 首发引导 runner 脚本(在 GitHub Actions ubuntu 上由 playwright 驱动):
//   action=signup         注册 npm 账号(随机密码) → RSA 加密凭据 → artifact
//   action=verify_token   打开邮箱验证链接(secret) → 登录 → 建 Classic Automation token → 加密 → artifact
//   action=publish        build:npm → 用 secret token 发布 ihui-cli@x.y.z
// 加密:RSA-OAEP(SHA256) 包 AES-256-GCM,公钥来自 secret PUBKEY_PEM(只有李总持私钥)。
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import net from 'node:net'
import crypto from 'node:crypto'
import fs from 'node:fs'

const ACTION = process.env.ACTION
const PUBKEY_PEM = process.env.PUBKEY_PEM
const EMAIL = process.env.NPM_EMAIL
const USERNAME = process.env.NPM_USERNAME
const PASSWORD = process.env.NPM_PASSWORD // signup 时为空则生成;verify 时从 secret
const VERIFY_URL = process.env.NPM_VERIFY_URL
// trusted_publisher:网页登录凭据(npm 已禁用 API 换 token,Trusted Publisher 只能在网页登记)
const WEB_USERNAME = process.env.NPM_WEB_USERNAME
const WEB_PASSWORD = process.env.NPM_WEB_PASSWORD
// signpath:申请联系邮箱(SignPath 审核沟通都走 email)
const SIGNPATH_EMAIL = process.env.SIGNPATH_EMAIL
const SHOT_DIR = 'shots'
fs.mkdirSync(SHOT_DIR, { recursive: true })

// ---------- 远端日志镜像 ----------
// 背景:GitHub Actions 的 job 日志只有 run 结束后才可读,run 进行中无法观测(artifact 同理)。
// 做法:把 console 输出节流推到 rc-live 分支 .github/rc-log.txt,外部可随时读取,准实时看到卡在哪一步。
const __logBuf = []
const __origLog = console.log.bind(console)
console.log = (...a) => {
  __origLog(...a)
  try {
    __logBuf.push(a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '))
    if (__logBuf.length > 500) __logBuf.splice(0, __logBuf.length - 500)
  } catch {}
}
let __logTimer = null
function startRemoteLog() {
  if (__logTimer) return
  __logTimer = setInterval(() => {
    flushRemoteLog().catch(() => {})
  }, 12000)
  if (__logTimer.unref) __logTimer.unref()
}
async function flushRemoteLog() {
  const body = `${new Date().toISOString()} pid=${process.pid}\n${__logBuf.slice(-250).join('\n')}`
  await pushRepoFile('.github/rc-log.txt', Buffer.from(body, 'utf8').toString('base64'), 'rc log heartbeat')
}
function encryptPayload(obj) {
  const aesKey = crypto.randomBytes(32)
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv)
  const data = Buffer.concat([cipher.update(JSON.stringify(obj), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  const encKey = crypto.publicEncrypt(
    { key: PUBKEY_PEM, padding: crypto.constants.RSA_PKCS1_OAEP_SHA256 },
    aesKey
  )
  return Buffer.concat([
    Buffer.from([0x01]),
    Buffer.from([encKey.length >> 8, encKey.length & 0xff]),
    encKey,
    iv,
    tag,
    data,
  ])
}

function saveSecretArtifact(name, obj) {
  const blob = encryptPayload(obj)
  fs.writeFileSync(`shots/${name}.bin`, blob)
  console.log(`::add-mask::${obj.password || ''}`)
  console.log(`::add-mask::${obj.token || ''}`)
  console.log(`SECRET-ARTIFACT shots/${name}.bin (encrypted, ${blob.length} bytes)`)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitPastCloudflare(page, maxMs = 600000) {
  const t0 = Date.now()
  let clicked = 0
  let lastClickAt = 0
  while (Date.now() - t0 < maxMs) {
    const title = await page.title().catch(() => '')
    let body = ''
    try {
      body = (await page.textContent('body', { timeout: 5000 })) || ''
    } catch {}
    const combined = title + ' ' + body
    if (!/just a moment|请稍候|performing security|verifying you are human|attention required|正在进行安全验证|checking your browser/i.test(combined))
      return true
    // 1) 自动验证中(spinner)—— 只等,绝不点击(点击会重置挑战)。
    //    必须同时识别中英文文案:CF 按出口 IP 语言返回中文页("正在进行安全验证"),
    //    旧版只匹配英文 "verifying you are human",导致中文 spinner 被误判为 idle 而每 6s 重点。
    const verifying = /verifying you are human|may take a few seconds|正在验证您|正在验证/i.test(combined)
    let spinnerEl = false
    try {
      spinnerEl = await page
        .locator('.ctp-spinner, [class*="spinner" i], [class*="Spinner"]')
        .first()
        .isVisible({ timeout: 800 })
    } catch {}
    if (verifying || spinnerEl) {
      await sleep(5000)
      continue
    }
    // 2) 只有确认 idle 才点击,且两次点击间隔 >= 60s;点完长等 15s 让 CF 后台验证完成
    const now = Date.now()
    if (now - lastClickAt < 60000) {
      await sleep(2000)
      continue
    }
    let didClick = false
    for (const sel of [
      'label.ctp-checkbox-label',
      '#challenge-stage label',
      '#challenge-form label',
      'input[type="checkbox"]:not([hidden])',
    ]) {
      try {
        const loc = page.locator(sel).first()
        if (await loc.isVisible({ timeout: 500 })) {
          await loc.click({ timeout: 2000, force: true })
          didClick = true
          clicked++
          console.log(`CF-CLICK main sel=${sel} round=${clicked}`)
          break
        }
      } catch {}
    }
    if (!didClick && clicked < 6) {
      for (const fr of page.frames()) {
        if (fr.url().includes('challenges.cloudflare')) {
          try {
            const loc = fr.locator('.ctp-checkbox-label').first()
            if (await loc.isVisible({ timeout: 500 })) {
              await loc.click({ timeout: 2000, force: true })
              didClick = true
              clicked++
              console.log(`CF-CLICK frame round=${clicked}`)
              break
            }
          } catch {}
        }
      }
    }
    if (didClick) {
      lastClickAt = now
      await sleep(15000)
    } else {
      // 无控件可点:等 CF 的 JS 挑战自动完成(真 Chrome + webdriver=false 时通常几秒内放行)
      await sleep(6000)
    }
  }
  return false
}

// 真 Chrome 优先:官方安装的 google-chrome 的 userAgentData.brands 含 "Google Chrome",
// 而 Playwright/Chrome-for-Testing 的 chromium 只有 Chromium 品牌 —— CF 一测即识破。
// 配合 --disable-blink-features=AutomationControlled,navigator.webdriver 原生为 false,
// 无需任何 JS 补丁(JS 补丁会被 Function.prototype.toString / 自有属性检测识破)。
// Playwright 只作为 connectOverCDP 的客户端复用现有 API,失败再回退自家 chromium。
function findRealChrome() {
  const cands = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/opt/google/chrome/chrome',
    '/usr/local/bin/google-chrome',
  ]
  for (const p of cands) if (fs.existsSync(p)) return p
  return null
}

function waitPort(port, timeoutMs) {
  const t0 = Date.now()
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const sock = net.connect(port, '127.0.0.1')
      sock.on('connect', () => {
        sock.destroy()
        resolve()
      })
      sock.on('error', () => {
        sock.destroy()
        if (Date.now() - t0 > timeoutMs) reject(new Error('chrome devtools port timeout'))
        else setTimeout(tryOnce, 500)
      })
    }
    tryOnce()
  })
}

async function launch() {
  const headed = process.env.UNDER_XVFB === '1'
  const bin = findRealChrome()
  if (bin) {
    try {
      fs.rmSync('/tmp/chrome-npmboot', { recursive: true, force: true })
      const args = [
        '--remote-debugging-port=9222',
        '--no-sandbox',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-infobars',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1280,860',
        '--user-data-dir=/tmp/chrome-npmboot',
        'about:blank',
      ]
      if (!headed) args.push('--headless=new')
      spawn(bin, args, { stdio: 'ignore' })
      await waitPort(9222, 25000)
      const browser = await chromium.connectOverCDP('http://127.0.0.1:9222')
      const ctx = browser.contexts()[0] || (await browser.newContext())
      const page = ctx.pages()[0] || (await ctx.newPage())
      console.log(`LAUNCH via real Chrome: ${bin} (webdriver native=false, brands include "Google Chrome")`)
      return { browser, ctx, page }
    } catch (e) {
      console.log(`real-chrome launch failed, fallback to playwright chromium: ${e.message}`)
    }
  }
  const browser = await chromium.launch({
    headless: !headed,
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
  })
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 860 },
    locale: 'en-US',
    timezoneId: 'Asia/Shanghai',
  })
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
  })
  const page = await ctx.newPage()
  console.log('LAUNCH via playwright chromium (fallback)')
  return { browser, ctx, page }
}

async function shot(page, name) {
  try {
    await page.screenshot({ path: `${SHOT_DIR}/${name}.png`, fullPage: false })
  } catch {}
}

async function fillSignup(page) {
  // npm 注册表单字段选择器多路兜底;用逐字符 typing(拟人),不用 fill 直写
  const emailSel = ['input[name="email"]', 'input#email', 'input[type="email"]']
  const userSel = ['input[name="username"]', 'input#username', 'input[autocomplete="username"]']
  const passSel = ['input[name="password"]', 'input#password', 'input[type="password"]']
  async function typeFirst(sels, value, label) {
    for (const s of sels) {
      const loc = page.locator(s).first()
      try {
        if (await loc.isVisible({ timeout: 3000 })) {
          await loc.click({ timeout: 3000 })
          await page.keyboard.type(value, { delay: 90 + Math.floor(Math.random() * 60) })
          console.log(`TYPED ${label} via ${s}`)
          return true
        }
      } catch {}
    }
    throw new Error(
      `field not found: ${label} | url=${page.url()} | body=${(((await page.textContent('body').catch(() => '')) || '').replace(/\s+/g, ' ').slice(0, 200))}`
    )
  }
  await typeFirst(emailSel, EMAIL, 'email')
  await typeFirst(userSel, USERNAME, 'username')
  await typeFirst(passSel, PASSWORD, 'password')
  await shot(page, 'signup-filled')
  // Turnstile 可能在提交前就要求通过
  await waitPastCloudflare(page, 60000)
  const submit = page
    .locator('button[type="submit"], button:has-text("Create an account"), button:has-text("创建账户")')
    .first()
  await submit.click({ timeout: 15000 })
  console.log('SUBMITTED')
}

async function main() {
  startRemoteLog()
  console.log(`RUN-START action=${ACTION} node=${process.version}`)
  if (ACTION === 'publish') {
    console.log('publish handled by workflow steps')
    return
  }
  const attempts = Number(process.env.BOOT_ATTEMPTS || (ACTION === 'signup' ? 3 : 1))
  let lastErr = null
  for (let n = 1; n <= attempts; n++) {
    console.log(`=== ATTEMPT ${n}/${attempts} ===`)
    const { browser, page } = await launch()
    try {
      if (ACTION === 'signup') await runSignup(page, n)
      else if (ACTION === 'trusted_publisher') await runTrustedPublisher(page, n)
      else if (ACTION === 'signpath') await runSignPath(page, n)
      else await runVerifyToken(page)
      lastErr = null
      await browser.close()
      break
    } catch (e) {
      await shot(page, `error-attempt-${n}`)
      console.error(`ATTEMPT-${n}-ERROR`, e.message)
      lastErr = e
      await browser.close()
      await sleep(10000)
    }
  }
  if (lastErr) {
    console.error('BOOTSTRAP-ERROR', lastErr.message)
    console.log('BOOTSTRAP-ERROR-STACK ' + String(lastErr.stack || '').slice(0, 1200))
    await flushRemoteLog().catch(() => {})
    process.exit(1)
  }
  await flushRemoteLog().catch(() => {})
}

async function runSignup(page, attempt) {
  await page.goto('https://www.npmjs.com/signup', { waitUntil: 'domcontentloaded', timeout: 60000 })
  const ok = await waitPastCloudflare(page)
  await shot(page, `signup-page-${attempt}`)
  if (!ok) throw new Error('cloudflare challenge unresolved')
  // 诊断:npm /signup 实测会被重定向到 GitHub(Actions runner 的 IP 属 GitHub ASN,
  // npm/GitHub 对自家数据中心 IP 的浏览器活动直接封锁或强制 OAuth)。打印真实 URL 与正文,
  // 一次 run 定位,避免再靠截图猜。
  let diag = ''
  try {
    diag = ((await page.textContent('body')) || '').replace(/\s+/g, ' ').slice(0, 400)
  } catch {}
  console.log(`SIGNUP-URL=${page.url()}`)
  console.log(`SIGNUP-TITLE=${await page.title()}`)
  console.log(`SIGNUP-BODY=${diag}`)
  await fillSignup(page)
  let outcome = 'unknown'
  for (let i = 0; i < 20; i++) {
    await sleep(3000)
    const body = (await page.textContent('body').catch(() => '')) || ''
    const url = page.url()
    await shot(page, `signup-wait-${attempt}-${i}`)
    if (/verify your email|验证邮箱|check your email|welcome/i.test(body)) {
      outcome = 'created-verify-email'
      break
    }
    if (/already taken|already exists|已被使用/i.test(body)) {
      outcome = 'username-taken'
      break
    }
    if (/captcha|robot|not a robot/i.test(body)) {
      outcome = 'captcha-blocked'
      break
    }
    if (!/signup/.test(url)) {
      outcome = 'redirected:' + url
      break
    }
  }
  await shot(page, `signup-final-${attempt}`)
  console.log('SIGNUP_OUTCOME=' + outcome)
  if (outcome === 'username-taken') {
    console.log('::warning::用户名被占,换 USERNAME 重跑')
    return
  }
  if (!/created|redirected/.test(outcome)) throw new Error('signup outcome: ' + outcome)
  saveSecretArtifact('npm-credentials', { username: USERNAME, email: EMAIL, password: PASSWORD })
}

// ---------- action=trusted_publisher ----------
// 在 npm 网页给 ihui-cli 登记 GitHub Trusted Publisher(Workflow OIDC),registry API 无此端点。
// npm 发布页:https://www.npmjs.com/package/ihui-cli/access
async function runTrustedPublisher(page, attempt) {
  // 0) 网络监听:抓登录 POST 的真实响应(无 UI 错误时唯一的真相来源)
  const netLog = []
  const onResp = (r) => {
    try {
      if (r.request().method() !== 'GET') netLog.push(`${r.status()} ${r.request().method()} ${r.url().slice(0, 120)}`)
    } catch {}
  }
  page.on('response', onResp)
  // 1) 网页登录(CF 挑战已被真 Chrome 方案突破)
  await page.goto('https://www.npmjs.com/login', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await waitPastCloudflare(page)
  await sleep(3000)
  await shot(page, `tp-login-${attempt}`)
  try {
    const uSels = ['input[name="username"]', 'input#login_name', 'input[type="text"]']
    let filledU = false
    for (const s of uSels) {
      const loc = page.locator(s).first()
      if (await loc.isVisible({ timeout: 2000 }).catch(() => false)) {
        await loc.click({ timeout: 3000 })
        await page.keyboard.type(WEB_USERNAME, { delay: 60 })
        filledU = true
        break
      }
    }
    if (!filledU) throw new Error('username field not visible (可能已登录)')
    const p = page.locator('input[type="password"]').first()
    await p.click({ timeout: 5000 })
    await page.keyboard.type(WEB_PASSWORD, { delay: 60 })
    await shot(page, `tp-login-filled`)
    // 提交按钮必须限定在登录表单内(全局 :has-text("Sign in") 会误点页头导航元素,表单被重置)
    const submitSel = [
      'form button[type="submit"]',
      'form button:has-text("Sign in")',
      'main button[type="submit"]',
      'button[type="submit"]',
    ]
    let clicked = false
    for (const s of submitSel) {
      const loc = page.locator(s).first()
      if (await loc.isVisible({ timeout: 2500 }).catch(() => false)) {
        await loc.click({ timeout: 10000 })
        clicked = true
        console.log('TP_LOGIN_SUBMIT=' + s)
        break
      }
    }
    if (!clicked) throw new Error('login submit button not found')
    await sleep(12000) // 给登录 POST 留足响应时间
    console.log('TP_NET_LOG=' + JSON.stringify(netLog.slice(-12)))
    await waitPastCloudflare(page, 120000)
    await sleep(6000)
    await shot(page, `tp-login-after`)
    await page.screenshot({ path: `${SHOT_DIR}/tp-login-after-full.png`, fullPage: true })
    console.log('TP_LOGIN_URL=' + page.url())
    // 登录后诊断:错误提示文本 + Turnstile iframe 检测
    const lbody = ((await page.textContent('body').catch(() => '')) || '').replace(/\s+/g, ' ')
    const errMatch = lbody.match(
      /(incorrect[^.]{0,80}|too many[^.]{0,80}|wrong[^.]{0,80}|failed[^.]{0,80}|invalid[^.]{0,80}|locked[^.]{0,80}|verify[^.]{0,80})/i
    )
    console.log('TP_LOGIN_ERR=' + (errMatch ? errMatch[0] : '(none)'))
    const tsFrames = page.frames().filter((f) => /challenges\.cloudflare\.com|turnstile/i.test(f.url())).length
    console.log('TP_TURNSTILE_FRAMES=' + tsFrames)
    // email-otp:npm 对新设备登录强制邮箱 OTP(发到账号邮箱),NPM_OTP_CODE 由李总读邮件提供
    if (/\/login\/email-otp/.test(page.url())) {
      const otp = process.env.NPM_OTP_CODE || ''
      if (!otp) throw new Error('npm login requires email OTP — need NPM_OTP_CODE (sent to account email)')
      console.log('TP_OTP_REQUIRED=true')
      const otpInput = page
        .locator('input[inputmode="numeric"], input[autocomplete="one-time-code"], input[name*="otp" i], input[type="text"]')
        .first()
      await otpInput.waitFor({ state: 'visible', timeout: 20000 })
      await otpInput.click({ timeout: 5000 })
      await page.keyboard.type(otp, { delay: 80 })
      await shot(page, `tp-otp-filled`)
      const otpSubmit = page.locator('form button[type="submit"], button[type="submit"]').first()
      await otpSubmit.click({ timeout: 10000 })
      await sleep(10000)
      await shot(page, `tp-otp-after`)
      console.log('TP_AFTER_OTP_URL=' + page.url())
      console.log('TP_NET_LOG2=' + JSON.stringify(netLog.slice(-6)))
      if (/\/login/.test(page.url())) throw new Error('OTP verification failed — see tp-otp-after.png')
      console.log('TP-LOGIN-OK')
    }
    // 表单区 DOM dump(错误 DOM 常在 form 内,textContent 拿不到样式隐藏节点)
    try {
      const formHtml = await page.locator('form').first().evaluate((el) => el.innerHTML.replace(/\s+/g, ' ').slice(0, 600))
      console.log('TP_FORM_HTML=' + formHtml)
    } catch {}
    if (/\/login/.test(page.url()) && errMatch) {
      throw new Error('npm login rejected: ' + errMatch[0])
    }
  } catch (e) {
    if (/npm login rejected/.test(e.message)) throw e
    console.log('TP-LOGIN-SKIP ' + String(e.message).slice(0, 100))
  }

  // 2) 包 publishing access 页
  await page.goto('https://www.npmjs.com/package/ihui-cli/access', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  })
  await waitPastCloudflare(page)
  await sleep(4000)
  await shot(page, `tp-access-page`)
  const accBody = (await page.textContent('body').catch(() => '')) || ''
  console.log('TP_ACCESS_SNIPPET=' + accBody.replace(/\s+/g, ' ').slice(0, 260))
  if (/sign in/i.test(accBody.slice(0, 400))) throw new Error('access page requires login — see tp-access-page.png')

  // 3) 打开 Add a trusted publisher
  const addBtn = page
    .locator(
      'button:has-text("Add a trusted publisher"), a:has-text("Add a trusted publisher"), button:has-text("Add trusted publisher"), button:has-text("Add Publisher")'
    )
    .first()
  await addBtn.click({ timeout: 20000 })
  await sleep(2500)
  await shot(page, `tp-form-open`)

  // 4) 打印表单所有输入框元数据(诊断)并按顺序填:owner / repo / workflow / environment
  const inputs = page.locator(
    '[role="dialog"] input, dialog input, .modal input, form input[type="text"], input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])'
  )
  const cnt = await inputs.count()
  const meta = []
  for (let i = 0; i < Math.min(cnt, 10); i++) {
    const el = inputs.nth(i)
    meta.push({
      i,
      name: await el.getAttribute('name').catch(() => null),
      ph: await el.getAttribute('placeholder').catch(() => null),
      type: await el.getAttribute('type').catch(() => null),
      vis: await el.isVisible().catch(() => false),
    })
  }
  console.log('TP_FORM_INPUTS=' + JSON.stringify(meta))
  const vals = ['IHUI-INF-AI', 'IHUI-AI', 'release-cli.yml', '']
  let filled = 0
  for (let i = 0; i < cnt && filled < 3; i++) {
    const el = inputs.nth(i)
    if (!(await el.isVisible().catch(() => false))) continue
    const type = ((await el.getAttribute('type').catch(() => 'text')) || 'text').toLowerCase()
    if (type === 'hidden' || type === 'checkbox' || type === 'radio' || type === 'submit') continue
    await el.click({ timeout: 3000 })
    await page.keyboard.type(vals[filled], { delay: 40 })
    filled++
  }
  console.log('TP_FILLED=' + filled)
  await shot(page, `tp-form-filled`)
  if (filled < 3) throw new Error(`trusted publisher form: only ${filled}/3 fields filled — see tp-form-open.png`)

  // 5) 提交并验证
  const saveBtn = page
    .locator('button:has-text("Add publisher"), button:has-text("Add Publisher"), button:has-text("Add"), button:has-text("Save")')
    .last()
  await saveBtn.click({ timeout: 10000 })
  await sleep(6000)
  await shot(page, `tp-after-save`)
  const after = (await page.textContent('body').catch(() => '')) || ''
  console.log('TP_AFTER_SNIPPET=' + after.replace(/\s+/g, ' ').slice(0, 260))
  if (!/IHUI-INF-AI|release-cli\.yml/i.test(after)) {
    throw new Error('trusted publisher save not confirmed — see tp-after-save.png')
  }
  console.log('TRUSTED-PUBLISHER-OK')
}

// ---------- action=signpath ----------
// SignPath Foundation 免费代码签名申请(HubSpot 表单嵌 signpath.org/apply 的 iframe)。
// reCAPTCHA Enterprise 验证端点在 www.google.com,本机(中国 IP)不可达 —— runner(美国)可完成。
async function runSignPath(page, attempt) {
  await page.goto('https://signpath.org/apply', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await sleep(7000)
  let hf = null
  for (const fr of page.frames()) if (/hsforms\.net/.test(fr.url())) hf = fr
  if (!hf) {
    await sleep(7000)
    for (const fr of page.frames()) if (/hsforms\.net/.test(fr.url())) hf = fr
  }
  if (!hf) throw new Error('hubspot iframe not found — see sp-page.png')
  await shot(page, `sp-page-${attempt}`)

  const F = {
    '2-198696014/name': 'IHUI AI',
    '2-198696014/repository_url': 'https://github.com/IHUI-INF-AI/IHUI-AI',
    '2-198696014/homepage_url': 'https://aizhs.top',
    '2-198696014/download_url': 'https://github.com/IHUI-INF-AI/IHUI-AI/releases',
    '2-198696014/tagline':
      'Open-source AI coding agent platform: CLI, web console and AI service, distributed as signed native binaries.',
    '2-198696014/description':
      'IHUI AI is an open-source AI coding agent platform (Apache-2.0). It ships a Node.js Single-Executable-Application CLI ("ihui-cli") published as native binaries for 6 platforms, a Next.js web console, a Fastify API and an AI service, with PostgreSQL/Redis backing. Releases are built and published by GitHub Actions; binaries are currently distributed unsigned, and we want Authenticode signing via SignPath Foundation so Windows users no longer hit SmartScreen warnings.',
    '2-198696014/reputation':
      'Public GitHub repository under the IHUI-INF-AI organisation with full source, issue tracker and CI history. Released artifacts: GitHub Releases (six platform binaries + SHA256SUMS), GHCR container image ghcr.io/ihui-inf-ai/ai-cli, and npm package "ihui-cli" (already live on the registry). Project site https://aizhs.top is the maintainer-operated production deployment.',
    '2-198696014/discovery_source': 'Web search',
    '0-1/firstname': 'Chunchuan',
    '0-1/lastname': 'Li',
    '0-1/email': SIGNPATH_EMAIL || '502319984@qq.com',
    '0-1/company': 'IHUI AI',
  }
  for (const [name, val] of Object.entries(F)) {
    const loc = hf.locator(`[name="${name}"]`).first()
    await loc.waitFor({ state: 'visible', timeout: 20000 })
    await loc.click({ timeout: 5000 })
    await loc.fill(val)
    console.log('SP-FILLED ' + name + ' len=' + val.length)
  }

  // HubSpot 新版 hsfc- 组件(SP_FORM_HTML 实证):dropdown 非原生 select,是 hsfc-DropdownField
  // (label 文本定位字段容器 → combobox/button 点开 → role=option/li 选择)。
  const DD = [
    ['Category', 'Developer Tools'],
    ['Build System', 'GitHub Actions'],
    ['Primary Discovery Channel', 'Organic search'],
  ]
  for (const [label, opt] of DD) {
    try {
      const field = hf
        .locator(`.hsfc-DropdownField:has(label:has-text("${label}")), [class*="Dropdown"]:has(label:has-text("${label}"))`)
        .first()
      await field.waitFor({ state: 'visible', timeout: 8000 })
      const combo = field.locator('[role="combobox"], button').first()
      await combo.click({ timeout: 8000 })
      await sleep(1000)
      const option = hf.locator(`[role="option"]:has-text("${opt}"), li:has-text("${opt}")`).first()
      await option.click({ timeout: 8000 })
      await sleep(600)
      console.log(`SP-DD ${label}=${opt}`)
    } catch (e) {
      console.log(`SP-DD-fail ${label}=${opt} ${String(e.message).slice(0, 70)}`)
    }
  }
  // 诊断:dump 第一个 dropdown 容器结构(供精准修复)
  try {
    const ddHtml = await hf
      .locator('.hsfc-DropdownField, [class*="Dropdown"]')
      .first()
      .evaluate((el) => el.outerHTML.replace(/\s+/g, ' ').slice(0, 1500))
      .catch(() => '(no dropdown container found)')
    console.log('SP_DD_HTML=' + ddHtml)
  } catch {}
  await shot(page, `sp-dd-done`)

  // 法务勾选(subscription_type_2099806800 实测 required)
  for (const n of ['LEGAL_CONSENT.subscription_type_2099806800', 'LEGAL_CONSENT.processing']) {
    const c = hf.locator(`[name="${n}"]`).first()
    try {
      if (!(await c.isChecked())) await c.check({ timeout: 5000 })
    } catch {
      await c.click({ timeout: 5000 }).catch(() => {})
    }
  }
  await shot(page, `sp-filled`)

  // 提交。SignPath 表单带 reCAPTCHA v2:bot 检测会弹图像挑战(九宫格选图),
  // 用「截图回传 → rc-clicks.json 指令(坐标由李总侧多模态识别后推送)→ runner 点击 → VERIFY」闭环。
  await hf
    .locator('button[type="submit"], input[type="submit"], .hs-button')
    .first()
    .click({ timeout: 15000 })
  await sleep(8000)
  const rcSolved = await handleRecaptchaChallenge(page, attempt)
  console.log('RC_SOLVED=' + rcSolved)
  await shot(page, `sp-after-submit`)
  const after = ((await hf.locator('body').textContent().catch(() => '')) || '').replace(/\s+/g, ' ')
  console.log('SP_AFTER=' + after.slice(0, 300))
  if (/Project Name/i.test(after) && !/thank|submitted|received/i.test(after)) {
    if (rcSolved) throw new Error('signpath form still present after RC solved — see sp-after-submit.png')
    throw new Error('signpath form still present after submit (reCAPTCHA?) — see sp-after-submit.png')
  }
  console.log('SIGNPATH-SUBMITTED')
  // 清理 rc-live 临时文件(截图 + 指令)
  for (let r = 0; r < 4; r++) await deleteRepoFile(`.github/rc-shot-${r}.png`)
  await deleteRepoFile('.github/rc-clicks.json')
  console.log('RC-FILES-CLEANED')
}

// 推送截图到 rc-live 专用分支(供李总侧实时 raw 读取识别;不污染 main)
async function pushRepoFile(path, contentB64, message) {
  const repo = 'IHUI-INF-AI/IHUI-AI'
  const token = process.env.GH_TOKEN
  const branch = 'rc-live'
  let sha
  try {
    const r0 = await fetch(`https://api.github.com/repos/${repo}/contents/${encodeURI(path)}?ref=${branch}`, {
      headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json' },
    })
    if (r0.ok) sha = (await r0.json()).sha
  } catch {}
  const r = await fetch(`https://api.github.com/repos/${repo}/contents/${encodeURI(path)}`, {
    method: 'PUT',
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, content: contentB64, branch, sha }),
  })
  if (!r.ok) throw new Error('push rc file failed: ' + r.status + ' ' + (await r.text()).slice(0, 150))
}
// 带重试的推送:Contents API 偶发 409/422(并发建文件),重试即过。
async function pushRepoFileRetry(path, contentB64, message, tries = 3) {
  let last = ''
  for (let i = 0; i < tries; i++) {
    try {
      await pushRepoFile(path, contentB64, message)
      return true
    } catch (e) {
      last = String(e.message || e)
      await sleep(1200 + i * 1500)
    }
  }
  console.log(`PUSH-RETRY-GIVEUP ${path} ${last.slice(0, 120)}`)
  return false
}

// 删除 rc-live 上的临时文件(Contents API DELETE)
async function deleteRepoFile(path) {
  const repo = 'IHUI-INF-AI/IHUI-AI'
  const token = process.env.GH_TOKEN
  const branch = 'rc-live'
  try {
    const r0 = await fetch(`https://api.github.com/repos/${repo}/contents/${encodeURI(path)}?ref=${branch}`, {
      headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json' },
    })
    if (!r0.ok) return
    const sha = (await r0.json()).sha
    await fetch(`https://api.github.com/repos/${repo}/contents/${encodeURI(path)}`, {
      method: 'DELETE',
      headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `cleanup ${path}`, sha, branch }),
    })
  } catch {}
}

// reCAPTCHA 图像挑战闭环:截图推 rc-live → 轮询 rc-clicks.json 坐标 → 人类化点击 → VERIFY → 多轮
// 指令文件(rc-live 分支):.github/rc-clicks.json = {"round":N,"clicks":[{"x":px,"y":px},...]} (viewport 坐标)
async function handleRecaptchaChallenge(page, attempt) {
  const INSTR_URL = 'https://raw.githubusercontent.com/IHUI-INF-AI/IHUI-AI/rc-live/.github/rc-clicks.json'
  const findB = () => page.frames().find((f) => /recaptcha.*bframe/.test(f.url()))
  // 注意:刚提交时可能只有「我不是机器人」复选框(anchor frame),图像挑战尚未展开。
  // 必须先点复选框,再等 bframe 出现,否则会误判成 RC-NO-CHALLENGE。
  let b0 = findB()
  if (!b0) {
    const anchor = page.frames().find((f) => /recaptcha.*anchor/.test(f.url()))
    if (anchor) {
      console.log('RC-ANCHOR-CLICK')
      await anchor.locator('#recaptcha-anchor').click({ timeout: 15000 }).catch(() => {})
      await sleep(6000)
      b0 = findB()
    }
  }
  console.log(
    `RC-STATE bframe=${b0 ? 'yes' : 'no'} frames=${page.frames().length} url=${page.url().slice(0, 100)}`
  )
  for (let round = 0; round < 4; round++) {
    const bframe = findB()
    if (!bframe) {
      console.log(`RC-NO-CHALLENGE round=${round}`)
      return true
    }
    console.log(`RC-CHALLENGE round=${round} frame=${bframe.url().slice(0, 90)}`)
    const shotPath = `${SHOT_DIR}/rc-challenge-${round}.png`
    await page.screenshot({ path: shotPath, fullPage: false })
    // 实时推送截图到 rc-live(李总侧多模态识别用)
    const b64 = fs.readFileSync(shotPath).toString('base64')
    const pushed = await pushRepoFileRetry(`.github/rc-shot-${round}.png`, b64, `rc challenge round ${round}`)
    console.log(`RC-SHOT-PUSHED round=${round} ok=${pushed}`)
    // 等待指令文件(最多 8 分钟轮询;每次 fetch 都带超时,避免 TCP 挂死拖住整轮)
    let clicks = null
    for (let i = 0; i < 24; i++) {
      await sleep(15000)
      try {
        const r = await fetch(INSTR_URL + '?t=' + Date.now(), {
          cache: 'no-store',
          signal: AbortSignal.timeout(15000),
        })
        if (r.ok) {
          const j = await r.json()
          if (j.round === round && Array.isArray(j.clicks)) {
            clicks = j.clicks
            break
          }
        }
        if (i % 4 === 0) console.log(`RC-WAIT round=${round} i=${i} status=${r.status}`)
      } catch (e) {
        console.log(`RC-WAIT-ERR round=${round} i=${i} ${String(e.message).slice(0, 60)}`)
      }
    }
    if (!clicks) throw new Error(`rc instruction timeout round=${round} — see rc-challenge-${round}.png`)
    console.log(`RC-INSTRUCT round=${round} clicks=${JSON.stringify(clicks)}`)
    // 人类化点击:随机轨迹 + 随机间隔
    for (const c of clicks) {
      await page.mouse.move(c.x, c.y, { steps: 10 })
      await sleep(250 + Math.random() * 600)
      await page.mouse.click(c.x, c.y)
      await sleep(350 + Math.random() * 500)
    }
    // 点 VERIFY
    const verify = bframe
      .locator('#recaptcha-verify-button, button:has-text("Verify")')
      .first()
    await verify.click({ timeout: 12000 })
    await sleep(9000)
    await shot(page, `rc-after-verify-${round}`)
    // VERIFY 后可能直接过(表单提交)或弹下一轮
    const still = findB()
    if (!still) {
      console.log(`RC-PASSED round=${round} frames=${page.frames().length} url=${page.url().slice(0, 100)}`)
      return true
    }
    // 仍然在:把当前挑战画面也推上去,便于定位(限定/换题/超时提示都长这样)
    const rp = `${SHOT_DIR}/rc-next-${round}.png`
    await shot(page, `rc-next-${round}`)
    await pushRepoFileRetry(
      `.github/rc-next-${round}.png`,
      fs.readFileSync(rp).toString('base64'),
      `rc next round ${round}`
    )
    console.log(`RC-NEXT-ROUND round=${round}`)
  }
  return false
}

async function runVerifyToken(page) {
  await page.goto(VERIFY_URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await waitPastCloudflare(page)
  await sleep(4000)
  await shot(page, 'verify-page')
  const vbody = (await page.textContent('body').catch(() => '')) || ''
  console.log('VERIFY_BODY=' + vbody.replace(/\s+/g, ' ').slice(0, 200))
  if (!/logged in|欢迎|Welcome/i.test(vbody)) {
    await page.goto('https://www.npmjs.com/login', { waitUntil: 'domcontentloaded', timeout: 60000 })
    await waitPastCloudflare(page)
    await page.locator('input#login_name, input[name="username"], input[type="text"]').first().fill(USERNAME)
    await page.locator('input[type="password"]').first().fill(PASSWORD)
    await shot(page, 'login-filled')
    await page.locator('button[type="submit"], button:has-text("Sign in")').first().click({ timeout: 15000 })
    await waitPastCloudflare(page, 60000)
    await sleep(5000)
    await shot(page, 'login-after')
    console.log('LOGIN_URL=' + page.url())
  }
  const user = USERNAME
  await page.goto(`https://www.npmjs.com/settings/${user}/tokens`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  })
  await waitPastCloudflare(page)
  await sleep(4000)
  await shot(page, 'tokens-page')
  const genBtn = page.locator('button:has-text("Generate New Token"), a:has-text("Generate New Token")').first()
  await genBtn.click({ timeout: 20000 })
  await sleep(2000)
  await shot(page, 'token-type-choice')
  const classic = page.locator('button:has-text("Classic Token"), a:has-text("Classic Token")').first()
  if (await classic.isVisible().catch(() => false)) {
    await classic.click({ timeout: 10000 })
    await sleep(2000)
  }
  const auto = page
    .locator('button:has-text("Automation"), input[value="automation"], label:has-text("Automation")')
    .first()
  try {
    await auto.click({ timeout: 8000 })
    await shot(page, 'token-automation-selected')
  } catch {}
  await page.locator('button:has-text("Generate Token")').first().click({ timeout: 15000 })
  await sleep(4000)
  await shot(page, 'token-generated')
  let token = ''
  const codeEl = page.locator('code, input[readonly], .token-value').first()
  try {
    token = (await codeEl.textContent({ timeout: 8000 })) || ''
    token = token.trim()
    if (!/^npm_/.test(token)) {
      const val = await page
        .locator('input[value^="npm_"]')
        .first()
        .getAttribute('value', { timeout: 5000 })
        .catch(() => '')
      if (val) token = val
    }
  } catch {}
  console.log('TOKEN_PREFIX=' + (token ? token.slice(0, 4) : 'EMPTY'))
  if (!/^npm_/.test(token)) throw new Error('token not captured — see shots/token-generated.png')
  saveSecretArtifact('npm-token', { username: USERNAME, token })
}
// 顶层兜底:任何未捕获异常都必须落远端日志并硬退出,否则 xvfb-run 会挂死到 job 超时。
process.on('unhandledRejection', (e) => {
  console.log('UNHANDLED-REJECTION ' + String((e && e.stack) || e).slice(0, 1200))
  flushRemoteLog().finally(() => process.exit(1))
})
process.on('uncaughtException', (e) => {
  console.log('UNCAUGHT-EXCEPTION ' + String((e && e.stack) || e).slice(0, 1200))
  flushRemoteLog().finally(() => process.exit(1))
})
main().catch((e) => {
  console.log('MAIN-THROW ' + String((e && e.stack) || e).slice(0, 1200))
  flushRemoteLog().finally(() => process.exit(1))
})
