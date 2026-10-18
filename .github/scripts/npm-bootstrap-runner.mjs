// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// npm 首发引导 runner 脚本(在 GitHub Actions ubuntu 上由 playwright 驱动):
//   action=signup         注册 npm 账号(随机密码) → RSA 加密凭据 → artifact
//   action=verify_token   打开邮箱验证链接(secret) → 登录 → 建 Classic Automation token → 加密 → artifact
//   action=publish        build:npm → 用 secret token 发布 ihui-cli@x.y.z
// 加密:RSA-OAEP(SHA256) 包 AES-256-GCM,公钥来自 secret PUBKEY_PEM(只有李总持私钥)。
import { chromium } from 'playwright'
import crypto from 'node:crypto'
import fs from 'node:fs'

const ACTION = process.env.ACTION
const PUBKEY_PEM = process.env.PUBKEY_PEM
const EMAIL = process.env.NPM_EMAIL
const USERNAME = process.env.NPM_USERNAME
const PASSWORD = process.env.NPM_PASSWORD // signup 时为空则生成;verify 时从 secret
const VERIFY_URL = process.env.NPM_VERIFY_URL
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

async function waitPastCloudflare(page, maxMs = 150000) {
  const t0 = Date.now()
  let clicked = 0
  while (Date.now() - t0 < maxMs) {
    const title = await page.title().catch(() => '')
    if (!/just a moment|请稍候|performing security|attention required/i.test(title)) return true
    // 1) iframe 内选择器点击(Turnstile 自绘控件,勾选框是 label 不是 input)
    for (const fr of page.frames()) {
      if (fr.url().includes('challenges.cloudflare')) {
        for (const sel of ['.ctp-checkbox-label', 'label.ctp-checkbox-label', '#challenge-stage', 'body']) {
          try {
            const loc = fr.locator(sel).first()
            if (await loc.isVisible({ timeout: 800 })) {
              const box = await loc.boundingBox()
              if (box && clicked < 12) {
                // iframe 内坐标 → 页面坐标由 playwright 处理(frame.click 语义)
                await fr.locator(sel).first().click({ timeout: 2000, force: true })
                clicked++
                console.log(`CF-CLICK frame sel=${sel} round=${clicked}`)
                break
              }
            }
          } catch {}
        }
      }
    }
    // 2) 页面级坐标兜底(截实证:勾选框在视口 ~16.5%,39.2% 处)
    if (clicked < 12) {
      const vp = page.viewportSize()
      const cx = Math.round(vp.width * 0.165)
      const cy = Math.round(vp.height * 0.392)
      try {
        await page.mouse.move(cx - 10, cy - 6)
        await page.mouse.click(cx, cy)
        clicked++
        console.log(`CF-CLICK viewport(${cx},${cy}) round=${clicked}`)
      } catch {}
    }
    await sleep(5000)
  }
  return false
}

async function launch() {
  const headed = process.env.UNDER_XVFB === '1'
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
  return { browser, ctx, page }
}

async function shot(page, name) {
  try {
    await page.screenshot({ path: `${SHOT_DIR}/${name}.png`, fullPage: false })
  } catch {}
}

async function fillSignup(page) {
  // npm 注册表单字段选择器多路兜底
  const emailSel = ['input[name="email"]', 'input#email', 'input[type="email"]']
  const userSel = ['input[name="username"]', 'input#username', 'input[autocomplete="username"]']
  const passSel = ['input[name="password"]', 'input#password', 'input[type="password"]']
  async function fillFirst(sels, value, label) {
    for (const s of sels) {
      const loc = page.locator(s).first()
      try {
        if (await loc.isVisible({ timeout: 3000 })) {
          await loc.fill(value)
          console.log(`FILLED ${label} via ${s}`)
          return true
        }
      } catch {}
    }
    throw new Error(`field not found: ${label}`)
  }
  await fillFirst(emailSel, EMAIL, 'email')
  await fillFirst(userSel, USERNAME, 'username')
  await fillFirst(passSel, PASSWORD, 'password')
  await shot(page, 'signup-filled')
  // Turnstile 可能在提交前就要求通过
  await waitPastCloudflare(page, 30000)
  const submit = page
    .locator('button[type="submit"], button:has-text("Create an account"), button:has-text("创建账户")')
    .first()
  await submit.click({ timeout: 15000 })
  console.log('SUBMITTED')
}

async function main() {
  const { browser, page } = await launch()
  try {
    if (ACTION === 'signup') {
      await page.goto('https://www.npmjs.com/signup', { waitUntil: 'domcontentloaded', timeout: 60000 })
      const ok = await waitPastCloudflare(page)
      await shot(page, 'signup-page')
      if (!ok) throw new Error('cloudflare challenge unresolved')
      await fillSignup(page)
      // 等结果:成功 → 出现 "verify"/"welcome"/跳转;失败 → 表单报错
      let outcome = 'unknown'
      for (let i = 0; i < 20; i++) {
        await sleep(3000)
        const body = (await page.textContent('body').catch(() => '')) || ''
        const url = page.url()
        await shot(page, `signup-wait-${i}`)
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
      await shot(page, 'signup-final')
      console.log('SIGNUP_OUTCOME=' + outcome)
      if (outcome === 'username-taken') {
        console.log('::warning::用户名被占,换 USERNAME 重跑')
      } else {
        saveSecretArtifact('npm-credentials', { username: USERNAME, email: EMAIL, password: PASSWORD })
      }
      if (!/created|redirected/.test(outcome) && outcome !== 'username-taken') {
        throw new Error('signup outcome: ' + outcome)
      }
    } else if (ACTION === 'verify_token') {
      // 1) 邮箱验证链接
      await page.goto(VERIFY_URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await waitPastCloudflare(page)
      await sleep(4000)
      await shot(page, 'verify-page')
      const vbody = (await page.textContent('body').catch(() => '')) || ''
      console.log('VERIFY_BODY=' + vbody.replace(/\s+/g, ' ').slice(0, 200))
      // 2) 登录(验证链接若未自动登录)
      if (!/logged in|欢迎|Welcome/i.test(vbody)) {
        await page.goto('https://www.npmjs.com/login', { waitUntil: 'domcontentloaded', timeout: 60000 })
        await waitPastCloudflare(page)
        await page.locator('input#login_name, input[name="username"], input[type="text"]').first()
          .fill(USERNAME)
        await page.locator('input[type="password"]').first().fill(PASSWORD)
        await shot(page, 'login-filled')
        await page.locator('button[type="submit"], button:has-text("Sign in")').first().click({ timeout: 15000 })
        await waitPastCloudflare(page, 40000)
        await sleep(5000)
        await shot(page, 'login-after')
        console.log('LOGIN_URL=' + page.url())
      }
      // 3) 建 Classic Automation token(不过期)
      const user = USERNAME
      await page.goto(`https://www.npmjs.com/settings/${user}/tokens`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      })
      await waitPastCloudflare(page)
      await sleep(4000)
      await shot(page, 'tokens-page')
      // Generate New Token → Classic Token → Automation
      const genBtn = page.locator('button:has-text("Generate New Token"), a:has-text("Generate New Token")').first()
      await genBtn.click({ timeout: 20000 })
      await sleep(2000)
      await shot(page, 'token-type-choice')
      const classic = page.locator('button:has-text("Classic Token"), a:has-text("Classic Token")').first()
      if (await classic.isVisible().catch(() => false)) {
        await classic.click({ timeout: 10000 })
        await sleep(2000)
      }
      const auto = page.locator('button:has-text("Automation"), input[value="automation"], label:has-text("Automation")').first()
      try {
        await auto.click({ timeout: 8000 })
        await shot(page, 'token-automation-selected')
      } catch {}
      await page.locator('button:has-text("Generate Token")').first().click({ timeout: 15000 })
      await sleep(4000)
      await shot(page, 'token-generated')
      // token 文本在 <code> 或 input
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
      if (!/^npm_/.test(token)) {
        throw new Error('token not captured — see shots/token-generated.png')
      }
      saveSecretArtifact('npm-token', { username: USERNAME, token })
    } else if (ACTION === 'publish') {
      // 由 workflow 的 run 步骤处理,此分支不进 playwright
      console.log('publish handled by workflow steps')
    } else {
      throw new Error('unknown ACTION ' + ACTION)
    }
  } catch (e) {
    await shot(page, 'error-final')
    console.error('BOOTSTRAP-ERROR', e.message)
    process.exitCode = 1
  } finally {
    await browser.close()
  }
}

main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
