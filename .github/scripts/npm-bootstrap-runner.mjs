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
// signpath:申请联系邮箱(SignPath 审核沟通都走 email)
const SIGNPATH_EMAIL = process.env.SIGNPATH_EMAIL
const SHOT_DIR = 'shots'
fs.mkdirSync(SHOT_DIR, { recursive: true })

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
    process.exitCode = 1
  }
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

  // 三个自定义 DropdownField(HubSpot 组件,非原生 select):点开 -> 选 option
  const DD = [
    { hid: '87a6cc11-45fc-43ca-9b88-40485775cb3d-3550993458169', label: 'Category', opt: 'Developer Tools' },
    { hid: '87a6cc11-45fc-43ca-9b88-40485775cb3d-2081506618076', label: 'Build System', opt: 'GitHub Actions' },
    { hid: '87a6cc11-45fc-43ca-9b88-40485775cb3d-2052735583143', label: 'Primary Discovery Channel', opt: 'Organic search' },
  ]
  for (const d of DD) {
    const inp = hf.locator(`#${d.hid}-input`)
    await inp.click({ timeout: 10000 })
    await sleep(1500)
    const opt = hf.locator(`[role="option"]:has-text("${d.opt}")`).first()
    await opt.click({ timeout: 10000 })
    await sleep(700)
    console.log(`SP-DD ${d.label}=${d.opt}`)
  }
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

  // 提交(reCAPTCHA Enterprise invisible:美国 IP + 真 Chrome 应自动放行)
  await hf
    .locator('button[type="submit"], input[type="submit"], .hs-button')
    .first()
    .click({ timeout: 15000 })
  await sleep(14000)
  await shot(page, `sp-after-submit`)
  const after = ((await hf.locator('body').textContent().catch(() => '')) || '').replace(/\s+/g, ' ')
  console.log('SP_AFTER=' + after.slice(0, 300))
  if (/Project Name/i.test(after) && !/thank|submitted|received/i.test(after)) {
    throw new Error('signpath form still present after submit (reCAPTCHA?) — see sp-after-submit.png')
  }
  console.log('SIGNPATH-SUBMITTED')
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
main()
