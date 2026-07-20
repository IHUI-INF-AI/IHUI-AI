/**
 * 邮箱注册端到端连通测试
 *
 * 测试目标:
 * 1. SMTP 通道:配置 mock SMTP 后,sendVerificationEmail 实际投递邮件到 mock 服务器
 * 2. 验证码邮件内容正确(包含 6 位验证码 + 场景化标题)
 * 3. 3 个场景(register/login/reset)全部测试
 * 4. 国内/国外邮箱智能路由验证(未配置 Resend/腾讯云 SES 时,降级到 SMTP)
 *
 * 运行方式:
 *   cd g:\IHUI-AI\apps\api
 *   npx tsx tests/email-e2e-test.ts
 *
 * 前置条件:
 *   1. mock SMTP 服务器已启动:node apps/api/mock-smtp.mjs
 *   2. .env 已配置 SMTP_ENABLED=true, SMTP_HOST=127.0.0.1, SMTP_PORT=1025
 */

import { config as dotenvConfig } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
// 显式加载项目根目录 .env(脚本在 apps/api/tests/,根目录在 ../../)
const __dirname = dirname(fileURLToPath(import.meta.url))
dotenvConfig({ path: resolve(__dirname, '..', '..', '..', '.env') })

// 兜底必填 env(本测试不连数据库/Redis,但 zod schema 会校验存在性)
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
process.env.REDIS_URL ??= 'redis://localhost:6379'

import { readFileSync, existsSync } from 'node:fs'

// 动态 import:确保 .env 加载后再加载 config(否则 zod schema 会因缺 DATABASE_URL/JWT_SECRET 失败)
const { sendVerificationEmail, sendEmail, isDomesticEmail, resolveProvider } = await import(
  '../src/services/email-service.js'
)
const { config } = await import('../src/config/index.js')

const MAILS_FILE = resolve(__dirname, '..', '..', '..', '.trae-cn', 'tmp', 'mock-smtp-mails.jsonl')

function readMails(): any[] {
  if (!existsSync(MAILS_FILE)) return []
  const content = readFileSync(MAILS_FILE, 'utf8').trim()
  if (!content) return []
  return content.split('\n').map((line) => JSON.parse(line))
}

function extractCode(text: string): string | null {
  // 从邮件正文提取 6 位验证码
  const match = text.match(/\b(\d{6})\b/)
  return match ? match[1] : null
}

let passCount = 0
let failCount = 0

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ ${message}`)
    passCount++
  } else {
    console.log(`  ❌ ${message}`)
    failCount++
  }
}

async function main() {
  console.log('=== 邮箱注册端到端连通测试 ===\n')
  console.log(`配置:MAIL_PROVIDER=${config.MAIL_PROVIDER}, SMTP=${config.SMTP_HOST}:${config.SMTP_PORT} (enabled=${config.SMTP_ENABLED})`)
  console.log(`      RESEND_API_KEY=${config.RESEND_API_KEY ? '已配置' : '未配置(国外邮箱将降级 SMTP)'}`)
  console.log(`      TENCENT_SES_SECRET_ID=${config.TENCENT_SES_SECRET_ID ? '已配置' : '未配置(国内邮箱将降级 SMTP)'}\n`)

  // 测试 1:SMTP 通道基础投递
  console.log('--- 测试 1:SMTP 通道基础投递 ---')
  const testEmail1 = 'test1@example.com'
  const result1 = await sendEmail({
    to: testEmail1,
    subject: '【测试】基础投递',
    html: '<p>这是一封测试邮件</p>',
    text: '这是一封测试邮件',
  })
  assert(result1.sent === true, `sendEmail 应成功投递(实际:provider=${result1.provider}, sent=${result1.sent})`)
  assert(result1.provider === 'smtp', `应使用 SMTP 通道(实际:${result1.provider})`)

  await new Promise((r) => setTimeout(r, 500)) // 等 mock SMTP 写入
  const mails1 = readMails()
  assert(mails1.length >= 1, `mock SMTP 应收到至少 1 封邮件(实际:${mails1.length} 封)`)
  if (mails1.length > 0) {
    const m = mails1[mails1.length - 1]
    assert(m.to.includes(testEmail1), `收件人应包含 ${testEmail1}(实际:${m.to})`)
    assert(m.subject.includes('基础投递'), `主题应匹配(实际:${m.subject})`)
  }

  // 测试 2:register 场景验证码
  console.log('\n--- 测试 2:register 场景验证码邮件 ---')
  const testEmail2 = 'register-test@gmail.com'
  const code2 = '123456'
  const result2 = await sendVerificationEmail(testEmail2, code2, 'register', 'Alice')
  assert(result2.sent === true, `register 验证码邮件应发送成功(实际:${result2.sent})`)

  await new Promise((r) => setTimeout(r, 500))
  const mails2 = readMails()
  const registerMail = mails2.find((m) => m.subject.includes('注册验证码'))
  assert(!!registerMail, '应找到主题含"注册验证码"的邮件')
  if (registerMail) {
    assert(registerMail.to.includes(testEmail2), `收件人应匹配(实际:${registerMail.to})`)
    assert(registerMail.text.includes(code2), `邮件正文应包含验证码 ${code2}`)
    assert(registerMail.text.includes('Alice') || registerMail.html.includes('Alice'), '邮件应包含昵称 Alice')
    const extractedCode = extractCode(registerMail.text)
    assert(extractedCode === code2, `从邮件提取的验证码应匹配(实际:${extractedCode})`)
  }

  // 测试 3:login 场景验证码
  console.log('\n--- 测试 3:login 场景验证码邮件 ---')
  const testEmail3 = 'login-test@163.com' // 国内邮箱
  const code3 = '654321'
  const result3 = await sendVerificationEmail(testEmail3, code3, 'login')
  assert(result3.sent === true, `login 验证码邮件应发送成功(实际:${result3.sent})`)

  await new Promise((r) => setTimeout(r, 500))
  const mails3 = readMails()
  const loginMail = mails3.find((m) => m.subject.includes('登录验证码') && m.to.includes(testEmail3))
  assert(!!loginMail, '应找到主题含"登录验证码"且收件人匹配的邮件')
  if (loginMail) {
    assert(loginMail.text.includes(code3), `邮件正文应包含验证码 ${code3}`)
  }

  // 测试 4:reset 场景验证码
  console.log('\n--- 测试 4:reset 场景验证码邮件 ---')
  const testEmail4 = 'reset-test@qq.com' // 国内邮箱
  const code4 = '999888'
  const result4 = await sendVerificationEmail(testEmail4, code4, 'reset')
  assert(result4.sent === true, `reset 验证码邮件应发送成功(实际:${result4.sent})`)

  await new Promise((r) => setTimeout(r, 500))
  const mails4 = readMails()
  const resetMail = mails4.find((m) => m.subject.includes('重置密码') && m.to.includes(testEmail4))
  assert(!!resetMail, '应找到主题含"重置密码"且收件人匹配的邮件')
  if (resetMail) {
    assert(resetMail.text.includes(code4), `邮件正文应包含验证码 ${code4}`)
  }

  // 测试 5:智能路由(isDomesticEmail + resolveProvider)
  console.log('\n--- 测试 5:智能路由验证 ---')
  assert(isDomesticEmail('test@qq.com') === true, 'qq.com 应识别为国内邮箱')
  assert(isDomesticEmail('test@163.com') === true, '163.com 应识别为国内邮箱')
  assert(isDomesticEmail('test@gmail.com') === false, 'gmail.com 应识别为国外邮箱')
  assert(isDomesticEmail('test@outlook.com') === false, 'outlook.com 应识别为国外邮箱')

  // 当前未配置 Resend/腾讯云 SES,所有邮箱应降级到 SMTP
  const providerQq = resolveProvider('test@qq.com')
  const providerGmail = resolveProvider('test@gmail.com')
  assert(providerQq === 'smtp', `qq.com 未配置腾讯云 SES 时应降级 SMTP(实际:${providerQq})`)
  assert(providerGmail === 'smtp', `gmail.com 未配置 Resend 时应降级 SMTP(实际:${providerGmail})`)

  // 测试 6:邮件总数统计
  console.log('\n--- 测试 6:邮件总数统计 ---')
  const allMails = readMails()
  console.log(`  📧 mock SMTP 共收到 ${allMails.length} 封邮件`)
  assert(allMails.length >= 4, `应至少收到 4 封邮件(基础+register+login+reset,实际:${allMails.length} 封)`)

  // 汇总
  console.log('\n=== 测试汇总 ===')
  console.log(`✅ 通过:${passCount}`)
  console.log(`❌ 失败:${failCount}`)
  console.log(`📧 mock SMTP 累计邮件:${readMails().length} 封`)

  if (failCount > 0) {
    console.log('\n❌ 端到端测试失败')
    process.exit(1)
  } else {
    console.log('\n✅ 端到端测试全部通过,邮箱注册 SMTP 通道连通正常')
    process.exit(0)
  }
}

main().catch((err) => {
  console.error('测试脚本异常:', err)
  process.exit(1)
})
