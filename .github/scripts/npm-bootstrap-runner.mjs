// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// npm 首发引导 runner 脚本(在 GitHub Actions ubuntu 上由 playwright 驱动):
//   action=signup         注册 npm 账号(随机密码) → RSA 加密凭据 → artifact
//   action=verify_token   打开邮箱验证链接(secret) → 登录 → 建 Classic Automation token → 加密 → artifact
//   action=publish        build:npm → 用 secret token 发布 ihui-cli@x.y.z
//   action=org_create     网页登录后创建 npm organization `ihui`(双证据判定,详见 runOrgCreate 头注)
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
// console.error 也要镜像:否则抛错信息永远进不了远端日志(run 39246377653 实证,
// BOOTSTRAP-ERROR 之外的真栈只能靠它看见)
console.error = (...a) => {
  try {
    __logBuf.push('[ERR] ' + a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '))
    if (__logBuf.length > 500) __logBuf.splice(0, __logBuf.length - 500)
  } catch {}
  process.stderr.write(a.map((x) => (typeof x === 'string' ? x : String(x))).join(' ') + '\n')
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

// 逐字段多路兜底 + 拟人逐字符输入(fillSignup / runOrgCreate 共用,唯一实现)
async function typeIntoFirst(page, sels, value, label) {
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
  await typeIntoFirst(page, emailSel, EMAIL, 'email')
  await typeIntoFirst(page, userSel, USERNAME, 'username')
  await typeIntoFirst(page, passSel, PASSWORD, 'password')
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
      else if (ACTION === 'org_create') await runOrgCreate(page, n)
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

// ---------- 网页登录共用件(唯一实现;trusted_publisher / org_create 共用,§0.6 不抄第二份) ----------
// npm 已禁用 API 换 token ⇒ 账号级操作(登记 Trusted Publisher、建 org)只能走网页。
// 负责:过 CF 盾 → 填表提交 → 邮箱 OTP(NPM_OTP_CODE) → 回读诊断。
// 三类硬失败直接抛出(fail fast,不假装往前走,调用方据此停机等人):
//   'npm login rejected: …' / 'npm login requires email OTP — …' / 'OTP verification failed — …'
// 其余异常(如登录表单不出现=可能已登录)吞掉并正常返回,由调用方目标页的 /sign in/ 检查兜底。
async function npmWebLogin(page, attempt) {
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
    if (/npm login rejected|requires email OTP|OTP verification failed/.test(e.message)) throw e
    console.log('TP-LOGIN-SKIP ' + String(e.message).slice(0, 100))
  }
  return true
}

// ---------- action=trusted_publisher ----------
// 在 npm 网页给 ihui-cli 登记 GitHub Trusted Publisher(Workflow OIDC),registry API 无此端点。
// npm 发布页:https://www.npmjs.com/package/ihui-cli/access
async function runTrustedPublisher(page, attempt) {
  // 1) 网页登录(复用共用件 npmWebLogin;行为注记:OTP 缺失现在直接抛错停机,
  //    旧行为是吞掉后到 access 页才报 'access page requires login' —— 终态同为失败,报错更准)
  await npmWebLogin(page, attempt)

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
  // ★ 不要用 CDP setDeviceMetricsOverride 提 DPR:它与真实窗口尺寸不一致,
  // 会把 reCAPTCHA 挑战浮层的定位打乱 —— 实测挑战被塞进 40px 的微型 iframe 里,
  // DOM 有格子但屏幕上根本看不见(run 39247901744 实证)。截图清晰度改在本机裁切放大解决。
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
  // 用「截图回传 → rc-clicks.json 指令(多模态识别后推送)→ runner 点击 → VERIFY」闭环。
  // ★ 通过挑战后原 Submit 点击不会自动重放:必须再点一次 Submit(实测 run 39241408771)。
  let rcSolved = false
  let submittedOk = false
  for (let k = 0; k < 3; k++) {
    console.log(`SP-SUBMIT k=${k}`)
    // 先过「我不是机器人」+ 九宫格(拿到 token),再点提交 —— 这是人类真实顺序,
    // 反过来先点提交只会被 HubSpot 拦下并提示未验证(run 39245072174 实证)。
    rcSolved = await handleRecaptchaChallenge(page, attempt * 10 + k)
    console.log('RC_SOLVED=' + rcSolved)
    await sleep(1500)
    const sbtn = hf.locator('button[type="submit"], input[type="submit"], .hs-button').first()
    let clicked = false
    try {
      await sbtn.click({ timeout: 12000 })
      clicked = true
      console.log('SP-SUBMIT-CLICKED')
    } catch (e) {
      console.log('SP-SUBMIT-CLICK-FAIL ' + String(e.message).slice(0, 50))
    }
    if (!clicked) {
      try {
        await sbtn.evaluate((el) => el.click())
        console.log('SP-SUBMIT-JS-CLICK')
      } catch (e) {
        console.log('SP-SUBMIT-JS-FAIL ' + String(e.message).slice(0, 50))
      }
    }
    await sleep(9000)
    try {
      const pp = `${SHOT_DIR}/sp-postsubmit-${k}.png`
      await page.screenshot({ path: pp, fullPage: false })
      await pushRepoFileRetry(`.github/sp-postsubmit-${k}.png`, fs.readFileSync(pp).toString('base64'), `sp postsubmit ${k}`)
      console.log(`SP-POSTSHOT k=${k} pushed`)
    } catch (e) {
      console.log(`SP-POSTSHOT-FAIL ${String(e.message).slice(0, 60)}`)
    }
    // 提交触发不可见 reCAPTCHA,给 45 秒等挑战弹出
    const rc2 = await handleRecaptchaChallenge(page, attempt * 10 + k + 500, 45000)
    console.log('RC_SOLVED_AFTER_SUBMIT=' + rc2)
    if (rc2) {
      // ★ token 已就位:等 HubSpot 回调自动提交。此刻再点 Submit 只会让 reCAPTCHA
      // 重新 execute、再弹一个新挑战,形成死循环(run 39256922894 实证)。
      for (let w = 0; w < 12; w++) {
        await sleep(3000)
        const t = ((await hf.locator('body').textContent().catch(() => '')) || '').replace(/\s+/g, ' ')
        if (!/Project Name/i.test(t) || /thank|submitted|received/i.test(t)) {
          submittedOk = true
          break
        }
      }
      console.log('SP-AUTOSUBMIT-WAIT ok=' + submittedOk)
    }
    if (submittedOk) break
    await sleep(3000)
    try {
      const pp = `${SHOT_DIR}/sp-after-submit-${k}.png`
      await page.screenshot({ path: pp, fullPage: false })
      await pushRepoFileRetry(`.github/sp-after-submit-${k}.png`, fs.readFileSync(pp).toString('base64'), `sp after submit ${k}`)
      console.log(`SP-AFTERSHOT k=${k} pushed`)
    } catch (e) {
      console.log(`SP-AFTERSHOT-FAIL ${String(e.message).slice(0, 60)}`)
    }
    const after = ((await hf.locator('body').textContent().catch(() => '')) || '').replace(/\s+/g, ' ')
    console.log('SP_AFTER=' + after.slice(0, 300))
    if (!/Project Name/i.test(after) || /thank|submitted|received/i.test(after)) {
      submittedOk = true
      break
    }
  }
  if (!submittedOk) {
    throw new Error(
      `signpath form still present after ${3} submit cycles (rcSolved=${rcSolved}) — see sp-after-submit-*.png`
    )
  }
  console.log('SIGNPATH-SUBMITTED')
  // 清理 rc-live 临时文件(截图 + 指令);范围收窄,避免收尾拖太久
  for (let r = 0; r < 3; r++) {
    await deleteRepoFile(`.github/rc-shot-${r}.png`)
    await deleteRepoFile(`.github/rc-grid-${r}.png`)
    await deleteRepoFile(`.github/rc-next-${r}.png`)
    await deleteRepoFile(`.github/rc-frame-${r}.html`)
    for (let s = 1; s < 10; s++) {
      await deleteRepoFile(`.github/rc-shot-${r}-${s}.png`)
      await deleteRepoFile(`.github/rc-grid-${r}-${s}.png`)
    }
  }
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

// reCAPTCHA 图像挑战闭环:截图推 rc-live → 轮询指令 → 在 bframe DOM 内点 tile → 提交 → 多轮
// 指令文件(rc-live 分支):.github/rc-clicks.json
//   {"round":N,"step":S,"tiles":[序号...],"verify":true|false}
//     round  = 第几次挑战(换题才 +1)
//     step   = 同一次挑战内的第几屏(动态挑战点完一格该格立刻换新图,必须重新截图再判)
//     tiles  = 要点的格子(1 起,行优先)
//     verify = true → 点完即提交;false/缺省 → 点完再截一屏,等 step+1 的指令
//   ★ 不用像素坐标:同一站点会在 3x3/4x4 之间切换,固定坐标必然点错格(实证)。
//   ★ 动态挑战(题面含 "once there are none left")必须多屏循环,一次性点完再提交必然失败(实证)。
// 兼容旧格式 {"clicks":[{x,y}]}。
async function handleRecaptchaChallenge(page, attempt, waitMs = 0) {
  const findB = () => page.frames().find((f) => /recaptcha.*bframe/.test(f.url()))
  // ★ 判「已通过」的唯一可靠信号:#g-recaptcha-response 里拿到 token。
  //   ★ 实测坑:挑战通过后 bframe 元素仍留在 DOM 里(隐藏、内容不刷新),
  //   只看 frame 是否存在会把「已通过」误判成「挑战还在」,于是死等指令并再点一次
  //   Verify,反而重新触发新挑战(run 39241408771 实证)。
  let lastTokLen = -1
  const isSolved = async () => {
    try {
      const v = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll('#g-recaptcha-response, textarea[name="g-recaptcha-response"]'))
        return els.map((e) => String(e.value || '')).sort((a, b) => b.length - a.length)[0] || ''
      })
      lastTokLen = v.length
      return v.length > 20
    } catch {
      lastTokLen = -1
      return false
    }
  }
  // 「我不是机器人」复选框:bframe 可能已存在但隐藏(图像挑战尚未展开),
  // 此时必须点 anchor 才会弹九宫格。旧代码只在 bframe 完全不存在时才点,
  // 结果表单反复提示未验证而九宫格永不出现(run 39245072174 实证)。
  const ensureAnchor = async () => {
    const anchor = page.frames().find((f) => /recaptcha.*anchor/.test(f.url()))
    if (!anchor) return false
    // HubSpot 用的是不可见 reCAPTCHA:anchor 存在但不可见、aria-checked 为 null,
    // 硬点只会白等超时,所以先判可见性(run 39245845548 实证)。
    let vis = false
    let st = null
    try {
      vis = await anchor.locator('#recaptcha-anchor').isVisible({ timeout: 3000 })
      if (vis) st = await anchor.locator('#recaptcha-anchor').getAttribute('aria-checked', { timeout: 3000 })
    } catch {}
    console.log(`RC-ANCHOR visible=${vis} state=${JSON.stringify(st)}`)
    if (!vis || st === 'true') return vis && st === 'true'
    try {
      await anchor.locator('#recaptcha-anchor').click({ timeout: 6000, force: true })
      await sleep(4000)
      return true
    } catch (e) {
      console.log(`RC-ANCHOR-CLICK-FAIL ${String(e.message).slice(0, 60)}`)
      return false
    }
  }
  // 挑战区是否真的可见。★ 不要用 .rc-imageselect:该元素并不存在(实测 isVisible 恒 false,
  // 明明九宫格就在屏上却被判「无挑战」,run 39247238263 白等 45s)。用格子计数 + VERIFY 按钮判。
  const challengeVisible = async (bframe) => {
    try {
      if (!bframe) return false
      const n = await bframe
        .locator('.rc-imageselect-table-33 td.rc-imageselect-tile, .rc-imageselect-table-44 td.rc-imageselect-tile')
        .count()
      if (n > 0) return true
      return await bframe.locator('#recaptcha-verify-button').first().isVisible({ timeout: 1500 })
    } catch {
      return false
    }
  }
  // 挑战区整图截图(裁剪到表格 + 提示语,放大后判断更准)
  const shotGrid = async (name) => {
    try {
      const box = await page.evaluate(() => {
        const fs = Array.from(document.querySelectorAll('iframe')).filter((x) => /bframe/.test(x.src || ''))
        let best = null
        for (const f of fs) {
          const r = f.getBoundingClientRect()
          if (!best || r.width * r.height > best.w * best.h) best = { x: r.x, y: r.y, w: r.width, h: r.height }
        }
        if (!best) return null
        return { x: Math.max(0, best.x) | 0, y: Math.max(0, best.y) | 0, width: best.w | 0, height: best.h | 0 }
      })
      if (!box || box.width < 200 || box.height < 200) {
        console.log(`RC-GRID-SKIP box=${JSON.stringify(box)}`)
        return false
      }
      const p = `${SHOT_DIR}/${name}.png`
      await page.screenshot({ path: p, clip: box })
      const ok = await pushRepoFileRetry(`.github/${name}.png`, fs.readFileSync(p).toString('base64'), `rc ${name}`)
      console.log(`RC-GRID-PUSHED ${name} ${box.width}x${box.height} ok=${ok}`)
      return ok
    } catch (e) {
      console.log(`RC-GRID-FAIL ${String(e.message).slice(0, 70)}`)
      return false
    }
  }
  const readInstr = async () => {
    try {
      const r = await fetch(
        `https://api.github.com/repos/IHUI-INF-AI/IHUI-AI/contents/.github/rc-clicks.json?ref=rc-live&t=${Date.now()}`,
        {
          cache: 'no-store',
          headers: {
            Authorization: `token ${process.env.GH_TOKEN}`,
            Accept: 'application/vnd.github+json',
          },
          signal: AbortSignal.timeout(15000),
        }
      )
      if (!r.ok) return { status: r.status, j: null }
      const j0 = await r.json()
      const txt = Buffer.from(j0.content || '', 'base64').toString('utf8')
      return { status: 200, j: JSON.parse(txt) }
    } catch (e) {
      return { status: -1, j: null, err: String(e.message).slice(0, 60) }
    }
  }
  const waitInstr = async (round, step) => {
    for (let i = 0; i < 100; i++) {
      await sleep(6000)
      const { status, j, err } = await readInstr()
      if (j && j.round === round && (j.step ?? 0) === step && (Array.isArray(j.tiles) || Array.isArray(j.clicks))) {
        return j
      }
      if (i % 6 === 0) console.log(`RC-WAIT round=${round} step=${step} i=${i} status=${status}${err ? ' ' + err : ''}`)
    }
    return null
  }
  // 宿主页(HubSpot)的 CSS 会把 bframe 拉成 1262x150 的条带,挑战内容被裁掉看不见
  // (DOM 完整、9 格都在,但屏幕上空白)。截图/点击前强制把挑战框摆到可见位置。
  const forceBox = async () => {
    try {
      const info = await page.evaluate(() => {
        const fs = Array.from(document.querySelectorAll('iframe')).filter((x) => /bframe/.test(x.src || ''))
        const out = []
        for (const f of fs) {
          // ★ 不能 reparent(移动 iframe 会重载其浏览上下文,挑战会被重置)。
          // 沿祖先链修:display/visibility/opacity/overflow + 抬 z-index(静态定位要给 relative,
          // 否则 z-index 不生效,内容仍被页面盖住)。
          let el = f
          let depth = 0
          while (el && el !== document.documentElement && depth < 25) {
            const cs = getComputedStyle(el)
            if (cs.display === 'none') el.style.setProperty('display', 'block', 'important')
            if (cs.visibility === 'hidden') el.style.setProperty('visibility', 'visible', 'important')
            if (parseFloat(cs.opacity) === 0) el.style.setProperty('opacity', '1', 'important')
            if (cs.overflow === 'hidden') el.style.setProperty('overflow', 'visible', 'important')
            if (cs.position === 'static') el.style.setProperty('position', 'relative', 'important')
            el.style.setProperty('z-index', String(2147483600 - depth), 'important')
            if (el === f) {
              const s = f.style
              s.setProperty('width', '420px', 'important')
              s.setProperty('height', '600px', 'important')
              s.setProperty('top', '8px', 'important')
              s.setProperty('left', '8px', 'important')
              s.setProperty('position', 'fixed', 'important')
              s.setProperty('border', '0', 'important')
            }
            el = el.parentElement
            depth++
          }
          const r = f.getBoundingClientRect()
          out.push(`${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)}x${Math.round(r.height)},depth=${depth}`)
        }
        return out
      })
      console.log('RC-FORCEBOX ' + JSON.stringify(info))
      return info.length > 0
    } catch (e) {
      console.log('RC-FORCEBOX-FAIL ' + String(e.message).slice(0, 60))
      return false
    }
  }
  const shotPush = async (name) => {
    const p = `${SHOT_DIR}/${name}.png`
    await page.screenshot({ path: p, fullPage: false })
    const ok = await pushRepoFileRetry(`.github/${name}.png`, fs.readFileSync(p).toString('base64'), `rc ${name}`)
    console.log(`RC-SHOT-PUSHED ${name} ok=${ok}`)
    return ok
  }
  const clickVerify = async (bframe) => {
    const verify = bframe.locator('#recaptcha-verify-button').first()
    const label = ((await verify.textContent({ timeout: 5000 }).catch(() => '')) || '').trim()
    console.log(`RC-VERIFY-BTN label=${JSON.stringify(label)}`)
    for (let t = 0; t < 3; t++) {
      try {
        await verify.click({ timeout: 8000, force: true })
        return true
      } catch (e) {
        console.log(`RC-VERIFY-CLICK-RETRY t=${t} ${String(e.message).slice(0, 70)}`)
        await sleep(1500)
      }
    }
    try {
      await verify.evaluate((el) => el.click())
      console.log('RC-VERIFY-JS-CLICK')
      return true
    } catch (e) {
      console.log(`RC-VERIFY-JS-FAIL ${String(e.message).slice(0, 70)}`)
      return false
    }
  }

  // 不可见 reCAPTCHA 的挑战是**提交后异步弹出**的,必须给等待窗口,
  // 否则 0 秒判「没挑战」直接返回,表单原地不动(run 39245072174 实证)。
  if (waitMs > 0) {
    const n = Math.ceil(waitMs / 3000)
    for (let i = 0; i < n; i++) {
      if (await isSolved()) {
        console.log(`RC-TOKEN-EARLY tokLen=${lastTokLen} i=${i}`)
        return true
      }
      const bb = findB()
      if (bb && (await challengeVisible(bb))) {
        console.log(`RC-CHALLENGE-APPEARED i=${i}`)
        break
      }
      if (i % 4 === 0) console.log(`RC-WAIT-APPEAR i=${i}`)
      await sleep(3000)
    }
  }
  // 先过「我不是机器人」复选框;有 token 就直接返回,避免空转
  if (await isSolved()) {
    console.log(`RC-ALREADY-SOLVED tokLen=${lastTokLen}`)
    return true
  }
  await ensureAnchor()
  const b0 = findB()
  console.log(
    `RC-STATE bframe=${b0 ? 'yes' : 'no'} visible=${await challengeVisible(b0)} frames=${page.frames().length} url=${page.url().slice(0, 100)}`
  )

  for (let round = 0; round < 6; round++) {
    let step = 0
    let submitted = false
    while (step < 12) {
      const bframe = findB()
      if (await isSolved()) {
        console.log(`RC-SOLVED round=${round} step=${step} (token present)`)
        return true
      }
      if (!bframe || !(await challengeVisible(bframe))) {
        console.log(`RC-NO-CHALLENGE round=${round} step=${step} bframe=${bframe ? 'yes' : 'no'}`)
        return true
      }
      let rows = 0
      let cols = 0
      let prompt = ''
      try {
        prompt = (
          (await bframe.locator('.rc-imageselect-desc, .rc-imageselect-desc-no-canonical').first().textContent({ timeout: 5000 })) || ''
        )
          .replace(/\s+/g, ' ')
          .trim()
        if ((await bframe.locator('.rc-imageselect-table-44 td.rc-imageselect-tile').count()) > 0) {
          rows = 4
          cols = 4
        } else if ((await bframe.locator('.rc-imageselect-table-33 td.rc-imageselect-tile').count()) > 0) {
          rows = 3
          cols = 3
        }
      } catch {}
      const dynamic = /none left/i.test(prompt)
      console.log(
        `RC-CHALLENGE round=${round} step=${step} rows=${rows} cols=${cols} dynamic=${dynamic} prompt=${JSON.stringify(prompt.slice(0, 80))}`
      )
      if (step === 0) {
        try {
          const fhtml = ((await bframe.locator('body').innerHTML({ timeout: 6000 })) || '').slice(0, 20000)
          await pushRepoFileRetry(
            `.github/rc-frame-${round}.html`,
            Buffer.from(fhtml, 'utf8').toString('base64'),
            `rc frame dump ${round}`
          )
        } catch {}
      }
      await forceBox()
      await sleep(800)
      await shotPush(step === 0 ? `rc-shot-${round}` : `rc-shot-${round}-${step}`)
      // 裁剪放大版(只含挑战区),辨识度远高于整页缩略图
      await shotGrid(step === 0 ? `rc-grid-${round}` : `rc-grid-${round}-${step}`)
      const instr = await waitInstr(round, step)
      if (!instr) throw new Error(`rc instruction timeout round=${round} step=${step}`)
      console.log(`RC-INSTRUCT round=${round} step=${step} ${JSON.stringify(instr)}`)
      const wantVerify = instr.verify === true
      if (Array.isArray(instr.tiles) && rows > 0) {
        await forceBox()
        await sleep(500)
        for (const n of instr.tiles) {
          const idx = Number(n) - 1
          if (!Number.isFinite(idx) || idx < 0 || idx >= rows * cols) {
            console.log(`RC-TILE-SKIP bad index ${n}`)
            continue
          }
          const tile = bframe
            .locator('.rc-imageselect-table-44 td.rc-imageselect-tile, .rc-imageselect-table-33 td.rc-imageselect-tile')
            .nth(idx)
          await tile.click({ timeout: 12000, force: true })
          await sleep(500 + Math.random() * 600)
        }
        console.log(`RC-TILES-CLICKED round=${round} step=${step} n=${instr.tiles.length}`)
        // 动态挑战:点完该格立刻换新图,必须等图稳定后再截下一屏
        if (dynamic) await sleep(2600)
      } else if (Array.isArray(instr.clicks)) {
        for (const c of instr.clicks) {
          await page.mouse.move(c.x, c.y, { steps: 10 })
          await sleep(250 + Math.random() * 600)
          await page.mouse.click(c.x, c.y)
          await sleep(350 + Math.random() * 500)
        }
        console.log(`RC-COORD-CLICKED round=${round} step=${step} n=${instr.clicks.length}`)
        if (dynamic) await sleep(2600)
      }
      await sleep(600)
      if (!wantVerify) {
        step++
        continue
      }
      await forceBox()
      await clickVerify(bframe)
      await sleep(9000)
      await shot(page, `rc-after-verify-${round}`)
      if (await isSolved()) {
        console.log(`RC-PASSED round=${round} step=${step} (token) url=${page.url().slice(0, 100)}`)
        return true
      }
      if (!findB() || !(await challengeVisible(findB()))) {
        console.log(`RC-PASSED round=${round} step=${step} (challenge gone) url=${page.url().slice(0, 100)}`)
        return true
      }
      submitted = true
      break
    }
    if (!submitted) {
      // 该轮 step 用尽仍未提交,兜底提交一次
      const bframe = findB()
      if (bframe) await clickVerify(bframe)
      await sleep(8000)
      if ((await isSolved()) || !findB() || !(await challengeVisible(findB()))) {
        console.log(`RC-PASSED round=${round} (forced verify)`)
        return true
      }
    }
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

// ---------- action=org_create ----------
// 建 npm organization `ihui`(使 @ihui-ai/sdk 等 scoped 包可发布)。
// org 只有网页入口 https://www.npmjs.com/org/create ⇒ 复用 npmWebLogin 登录后填表。
// 成功判定用两步独立证据,绝不靠猜:
//   (a) 网页落地文案/URL(/org/ihui 或 created 类文案);
//   (b) 注册面变化:probeOrg() 三端点从"全部缺失"变为任一存在。
// 两块证据都立不住 ⇒ 抛 ORGCREATE-UNDETERMINED(run 红),绝不冒报"建好了"(§0.3)。
async function probeOrg() {
  const get = async (url) => {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(15000) })
      const txt = ((await r.text()) || '').replace(/\s+/g, ' ').slice(0, 160)
      return { status: r.status, body: txt }
    } catch (e) {
      return { status: -1, body: 'fetch-error: ' + String(e.message).slice(0, 60) }
    }
  }
  const v1 = await get('https://registry.npmjs.org/-/v1/org/ihui')
  const dash = await get('https://registry.npmjs.org/-/org/ihui')
  const web = await get('https://www.npmjs.com/org/ihui')
  return { v1, dash, web }
}
// 存在性判据:registry 两端点任一非 404,或 www 组织页 200 且不是 Not Found 壳
const orgPresent = (p) =>
  p.v1.status !== 404 || p.dash.status !== 404 || (p.web.status === 200 && !/page not found|not found/i.test(p.web.body))

async function runOrgCreate(page, attempt) {
  const before = await probeOrg()
  console.log('ORG_PROBE_BEFORE=' + JSON.stringify(before))
  if (orgPresent(before)) {
    console.log('ORG-ALREADY-EXISTS — 证据(b):本轮动手前注册面已非缺失,无需创建')
    console.log('ORG-CREATE-OK pre-existing=true')
    return
  }
  // 1) 登录:OTP 缺失/验证失败/密码被拒都是硬阻塞,必须抛错停机等人(绝不改密码/接管邮箱)
  try {
    await npmWebLogin(page, attempt)
  } catch (e) {
    throw new Error('ORG-CREATE-BLOCKED-AT-LOGIN: ' + String(e.message).slice(0, 160))
  }
  // 2) 打开建 org 页
  await page.goto('https://www.npmjs.com/org/create', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await waitPastCloudflare(page)
  await sleep(4000)
  await shot(page, `oc-page-${attempt}`)
  const bodyText = async () => (((await page.textContent('body').catch(() => '')) || '').replace(/\s+/g, ' '))
  console.log('OC_URL=' + page.url())
  console.log('OC_BODY_HEAD=' + (await bodyText()).slice(0, 300))
  if (/\/login/.test(page.url())) {
    throw new Error('org create redirected to login — session not authenticated; see shots/oc-page-*.png')
  }
  // 3) 填 org 名称(逐字符拟人输入,同 fillSignup 口径)
  await typeIntoFirst(
    page,
    ['input[name="name"]', 'input#name', 'form input[type="text"]', 'main input[type="text"]'],
    'ihui',
    'org-name'
  )
  await shot(page, 'oc-name-filled')
  // 4) 选免费计划:先把全部可点控件文本 dump 成取证,再按文案命中 Free/Open source;
  //    找不到不瞎猜(npm 建 org 默认档历史上即免费,OC_PLAN_CLICKED 会如实记 (none))
  const ctrlMeta = []
  try {
    const els = page.locator('button, [role="radio"], input[type="radio"], label')
    const n = await els.count()
    for (let i = 0; i < Math.min(n, 40); i++) {
      const el = els.nth(i)
      const t = ((await el.textContent({ timeout: 1200 }).catch(() => '')) || '').replace(/\s+/g, ' ').trim().slice(0, 70)
      const v = await el.getAttribute('value').catch(() => null)
      if (t || v) ctrlMeta.push({ i, t, v })
    }
  } catch {}
  console.log('OC_CONTROLS=' + JSON.stringify(ctrlMeta))
  let planClicked = '(none)'
  for (const sel of [
    'button:has-text("Free")',
    '[role="radio"]:has-text("Free")',
    'label:has-text("Free")',
    'button:has-text("Open source")',
    'label:has-text("Open source")',
    'input[value="free"]',
  ]) {
    const loc = page.locator(sel).first()
    if (await loc.isVisible({ timeout: 1200 }).catch(() => false)) {
      await loc.click({ timeout: 5000 }).catch(() => {})
      planClicked = sel
      break
    }
  }
  console.log('OC_PLAN_CLICKED=' + planClicked)
  await shot(page, 'oc-plan-selected')
  // 5) 提交
  let submitted = false
  for (const sel of [
    'button:has-text("Create Organization")',
    'button:has-text("Create organization")',
    'form button[type="submit"]',
    'button[type="submit"]',
  ]) {
    const loc = page.locator(sel).first()
    if (await loc.isVisible({ timeout: 1500 }).catch(() => false)) {
      await loc.click({ timeout: 10000 })
      console.log('OC_SUBMIT=' + sel)
      submitted = true
      break
    }
  }
  if (!submitted) {
    await page.screenshot({ path: `${SHOT_DIR}/oc-no-submit-btn-full.png`, fullPage: true })
    throw new Error('org create submit button not found — see shots/oc-no-submit-btn-full.png + OC_CONTROLS')
  }
  // 6) 双证据回读:网页文案轮询 + 每轮同步探注册面(注册面变化即定案,不必等文案)
  let webVerdict = 'unknown'
  let errSnip = ''
  let probe = before
  for (let i = 0; i < 12; i++) {
    await sleep(5000)
    const b = await bodyText()
    await shot(page, `oc-wait-${i}`)
    console.log(`OC_WAIT_${i} url=${page.url()} body=${b.slice(0, 220)}`)
    if (/has been created|successfully created|organization.{0,40}created|created.{0,40}organization/i.test(b) || /\/org\/ihui(\?|$|\/)/i.test(page.url())) {
      webVerdict = 'created'
    } else if (/already taken|already exists|not available|is not valid|Invalid|must be|failed|denied|wrong/i.test(b) && /\/org\/create/i.test(page.url())) {
      // 错误判据仅在仍停留创建页时成立(成功会离开 /org/create),避免把表单帮助文案里的
      // "must/invalid" 误判成 rejected;错误取证只取首句,不改判方向
      webVerdict = 'rejected'
      const m = b.match(/[^.]{0,160}(already taken|already exists|not available|is not valid|Invalid|must be|failed|denied|wrong)[^.]{0,120}/i)
      errSnip = (m ? m[0] : b.slice(0, 240)).trim()
    }
    probe = await probeOrg()
    console.log(`OC_PROBE_${i}=${JSON.stringify(probe)}`)
    if (webVerdict === 'created' || orgPresent(probe) || webVerdict === 'rejected') break
  }
  await shot(page, 'oc-final')
  await page.screenshot({ path: `${SHOT_DIR}/oc-final-full.png`, fullPage: true })
  console.log('ORG_PROBE_AFTER=' + JSON.stringify(probe))
  console.log(`OC_WEB_VERDICT=${webVerdict} OC_ERR=${JSON.stringify(errSnip.slice(0, 240))}`)
  const registryOk = orgPresent(probe)
  if (registryOk && (webVerdict === 'created' || webVerdict === 'unknown')) {
    console.log(`ORG-CREATE-OK evidence-registry=true evidence-web=${webVerdict}`)
    return
  }
  if (webVerdict === 'rejected' || errSnip) {
    throw new Error(`org create rejected on page: ${JSON.stringify(errSnip.slice(0, 240))} — registry still missing, see shots/oc-final.png`)
  }
  throw new Error(
    `ORGCREATE-UNDETERMINED: web=${webVerdict} registry_after v1=${probe.v1.status} dash=${probe.dash.status} web=${probe.web.status} — 未判定,不得当"建好了",查 artifacts + rc-live 日志`
  )
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
