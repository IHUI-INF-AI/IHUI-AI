#!/usr/bin/env node
/**
 * Reddit 交叉发布脚本
 *
 * 把项目推广帖发布到 Reddit 子版块,通过 OAuth2 API 提交 self post。
 *
 * 用法:
 *   node scripts/cross-publish-reddit.mjs --dry-run                    # 预览 payload(不发布)
 *   REDDIT_CLIENT_ID=xxx REDDIT_CLIENT_SECRET=xxx REDDIT_USERNAME=xxx REDDIT_PASSWORD=xxx \
 *     node scripts/cross-publish-reddit.mjs                            # 实际发布
 *   ... --subreddit programming                                        # 指定 subreddit
 *   ... --title "..." --content-file path                              # 自定义标题/内容
 *
 * API 文档: https://www.reddit.com/dev/api/
 * App 注册: https://www.reddit.com/prefs/apps (创建 script 类型 app,
 *           redirect uri 填 http://localhost)
 *
 * 退出码: 0=成功(或 dry-run); 1=配置错误/发布失败。
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')

const REDDIT_TOKEN_API = 'https://www.reddit.com/api/v1/access_token'
const REDDIT_SUBMIT_API = 'https://oauth.reddit.com/api/submit'

const CLIENT_ID = process.env.REDDIT_CLIENT_ID
const CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET
const USERNAME = process.env.REDDIT_USERNAME
const PASSWORD = process.env.REDDIT_PASSWORD

const DEFAULT_DRAFT_PATH = join(ROOT, '.trae-cn', 'tmp', 'reddit-post.md')

// ---------- 参数解析 ----------
const argv = process.argv.slice(2)
function argValue(name) {
  const i = argv.indexOf(name)
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null
}
const DRY_RUN = argv.includes('--dry-run')
const SUBREDDIT = argValue('--subreddit') || 'programming'
const CUSTOM_TITLE = argValue('--title')
const CUSTOM_CONTENT_FILE = argValue('--content-file')

// ---------- 从草稿 md 提取标题和正文 ----------
function parseDraft(path) {
  if (!existsSync(path)) return null
  const raw = readFileSync(path, 'utf-8')
  // ## Title 下的第一行非空文本作为 title(到下一个空行/分隔符)
  const titleMatch = /##\s+Title\s*\n+([^\n>][^\n]*)/.exec(raw)
  // ## Body 下的内容(到下一个 ## 或文件末尾,允许包含 --- 分隔符)
  const bodyMatch = /##\s+Body\s*\n+([\s\S]+?)(?=\n##\s|$)/.exec(raw)
  let title = titleMatch ? titleMatch[1].trim() : ''
  let body = bodyMatch ? bodyMatch[1].trim() : ''
  // 如果 body 末尾混入下一节 meta(以 > 开头),截断
  body = body.split(/\n>.*$/)[0].trim()
  // 清理 markdown 注释占位
  body = body.replace(/\[截图占位[^\]]*\]/g, '').trim()
  return { title, body }
}

function buildPayload() {
  let title, body
  if (CUSTOM_TITLE) {
    title = CUSTOM_TITLE
    body = CUSTOM_CONTENT_FILE && existsSync(CUSTOM_CONTENT_FILE)
      ? readFileSync(CUSTOM_CONTENT_FILE, 'utf-8')
      : ''
  } else {
    const draft = parseDraft(DEFAULT_DRAFT_PATH)
    if (!draft) {
      console.error(`❌ 找不到草稿: ${DEFAULT_DRAFT_PATH}`)
      process.exit(1)
    }
    title = draft.title
    body = draft.body
  }

  // Reddit 标题 < 300 字符
  if (title.length > 300) title = title.substring(0, 297) + '...'

  return {
    title,
    body,
    subreddit: SUBREDDIT,
  }
}

// ---------- 获取 access token ----------
async function getAccessToken() {
  console.log('─'.repeat(64))
  console.log('🔑 获取 access token...')
  const basicAuth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
  const res = await fetch(REDDIT_TOKEN_API, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': `IHUI-AI/0.2.0 by /u/${USERNAME}`,
    },
    body: new URLSearchParams({
      grant_type: 'password',
      username: USERNAME,
      password: PASSWORD,
    }).toString(),
  })
  const result = await res.json().catch(() => ({}))
  if (!res.ok || !result.access_token) {
    console.error(`❌ 获取 token 失败 HTTP ${res.status}: ${JSON.stringify(result)}`)
    console.error('   常见错误:')
    console.error('   - 401: client_id/secret 错误,或账号密码错误')
    console.error('   - 400: 需要在 reddit.com/prefs/apps 创建 script 类型 app')
    console.error('   - 账号需要 email 验证 + 足够 karma 才能发帖')
    process.exit(1)
  }
  console.log(`✅ token 获取成功 (scope: ${result.scope || 'default'})`)
  return result.access_token
}

// ---------- 提交 self post ----------
async function submitPost(accessToken, payload) {
  console.log('─'.repeat(64))
  console.log('📤 提交 self post...')
  const res = await fetch(REDDIT_SUBMIT_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': `IHUI-AI/0.2.0 by /u/${USERNAME}`,
    },
    body: new URLSearchParams({
      kind: 'self',
      sr: `r/${payload.subreddit}`,
      title: payload.title,
      text: payload.body,
      api_type: 'json',
    }).toString(),
  })
  const result = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error(`❌ HTTP ${res.status}: ${JSON.stringify(result)}`)
    return null
  }
  // Reddit 返回结构: {"json":{"errors":[],"data":{"url":...,"id":...}}}
  const data = result?.json?.data
  if (result?.json?.errors?.length > 0) {
    console.error(`❌ Reddit 返回错误: ${JSON.stringify(result.json.errors)}`)
    return null
  }
  if (data?.url) return data.url
  // 有时候返回的是 id,需要拼接
  if (data?.id) return `https://www.reddit.com/r/${payload.subreddit}/comments/${data.id}/`
  return null
}

// ---------- 主流程 ----------
async function main() {
  const payload = buildPayload()
  console.log('═'.repeat(64))
  console.log(`📦 Reddit 发布 — ${DRY_RUN ? 'DRY-RUN 预览' : '实际发布'}`)
  console.log('═'.repeat(64))
  console.log(`📄 标题:      ${payload.title}`)
  console.log(`📍 subreddit: r/${payload.subreddit}`)
  console.log(`📝 正文:      ${payload.body.length} chars`)
  console.log('─'.repeat(64))

  if (DRY_RUN) {
    console.log('Payload:')
    console.log(JSON.stringify({
      kind: 'self',
      sr: `r/${payload.subreddit}`,
      title: payload.title,
      text: `[${payload.body.length} chars]`,
    }, null, 2))
    return
  }

  // 检查环境变量
  const missing = []
  if (!CLIENT_ID) missing.push('REDDIT_CLIENT_ID')
  if (!CLIENT_SECRET) missing.push('REDDIT_CLIENT_SECRET')
  if (!USERNAME) missing.push('REDDIT_USERNAME')
  if (!PASSWORD) missing.push('REDDIT_PASSWORD')
  if (missing.length > 0) {
    console.error(`❌ 缺少环境变量: ${missing.join(', ')}`)
    console.error('   注册 app: https://www.reddit.com/prefs/apps (script 类型)')
    process.exit(1)
  }

  const token = await getAccessToken()
  const url = await submitPost(token, payload)
  if (url) {
    console.log('─'.repeat(64))
    console.log(`✅ 已发布: ${url}`)
  } else {
    console.error('❌ 发布失败')
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(`❌ 未捕获异常: ${e.message}`)
  process.exit(1)
})
