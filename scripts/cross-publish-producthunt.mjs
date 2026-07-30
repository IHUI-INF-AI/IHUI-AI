#!/usr/bin/env node
/**
 * ProductHunt 发布脚本
 *
 * 通过 GraphQL API 把项目作为产品发布到 ProductHunt。
 * 注意:ProductHunt 每天只能发布一个产品,且需要提前预约 launch day。
 *
 * 用法:
 *   node scripts/cross-publish-producthunt.mjs --dry-run              # 预览 payload(不发布)
 *   PRODUCTHUNT_TOKEN=xxx node scripts/cross-publish-producthunt.mjs  # 实际发布
 *   ... --name "..." --tagline "..." --url "..."                     # 自定义字段
 *
 * API 文档: https://api.producthunt.com/v2/docs
 * Token 获取: https://api.producthunt.com/v2/oauth/applications (创建 app,获取 access token)
 *
 * 退出码: 0=成功(或 dry-run); 1=配置错误/发布失败。
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')

const PH_API = 'https://api.producthunt.com/v2/api/graphql'
const TOKEN = process.env.PRODUCTHUNT_TOKEN

const DEFAULT_DRAFT_PATH = join(ROOT, '.trae-cn', 'tmp', 'producthunt-launch.md')

// ---------- 参数解析 ----------
const argv = process.argv.slice(2)
function argValue(name) {
  const i = argv.indexOf(name)
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null
}
const DRY_RUN = argv.includes('--dry-run')
const CUSTOM_NAME = argValue('--name')
const CUSTOM_TAGLINE = argValue('--tagline')
const CUSTOM_URL = argValue('--url')

// ---------- 从草稿 md 提取字段 ----------
function parseDraft(path) {
  if (!existsSync(path)) return null
  const raw = readFileSync(path, 'utf-8')
  // 提取 Submission Fields 表格中的字段
  const nameMatch = /\|\s*\*\*Name\*\*\s*\|\s*([^|]+)\|/i.exec(raw)
  const taglineMatch = /\|\s*\*\*Tagline\*\*\s*\|\s*([^|]+)\|/i.exec(raw)
  const urlMatch = /\|\s*\*\*URL\*\*\s*\|\s*([^|]+)\|/i.exec(raw)
  const demoUrlMatch = /\|\s*\*\*Demo URL\*\*\s*\|\s*([^|]+)\|/i.exec(raw)
  const topicsMatch = /\|\s*\*\*Topics\*\*\s*\|\s*([^|]+)\|/i.exec(raw)
  // 提取 Description (Description 行)
  const descMatch = /\|\s*\*\*Description\*\*\s*\|\s*([^|]+)\|/i.exec(raw)
  return {
    name: nameMatch ? nameMatch[1].trim() : '',
    tagline: taglineMatch ? taglineMatch[1].trim() : '',
    url: urlMatch ? urlMatch[1].trim() : '',
    demoUrl: demoUrlMatch ? demoUrlMatch[1].trim() : '',
    topics: topicsMatch ? topicsMatch[1].split(',').map((s) => s.trim()).filter(Boolean) : [],
    description: descMatch ? descMatch[1].trim() : '',
  }
}

function buildPayload() {
  const draft = parseDraft(DEFAULT_DRAFT_PATH)
  if (!draft) {
    console.error(`❌ 找不到草稿: ${DEFAULT_DRAFT_PATH}`)
    process.exit(1)
  }
  const name = CUSTOM_NAME || draft.name
  const tagline = CUSTOM_TAGLINE || draft.tagline
  const url = CUSTOM_URL || draft.url || draft.demoUrl || 'https://github.com/IHUI-INF-AI/IHUI-AI'

  if (!name || !tagline || !url) {
    console.error('❌ 缺少必填字段: name / tagline / url')
    process.exit(1)
  }
  // ProductHunt 限制:tagline < 60 字符
  const taglineFinal = tagline.length > 60 ? tagline.substring(0, 57) + '...' : tagline

  return {
    name,
    tagline: taglineFinal,
    url,
    topics: draft.topics.length > 0 ? draft.topics : ['DeveloperTools', 'ArtificialIntelligence', 'Productivity'],
  }
}

// ---------- GraphQL mutation ----------
const MUTATION = `
mutation CreatePost($name: String!, $tagline: String!, $url: String!, $topics: [TopicEnum!]!) {
  postCreate(input: { name: $name, tagline: $tagline, url: $url, topics: $topics }) {
    success
    post {
      id
      url
      name
      tagline
    }
    error {
      message
      code
    }
  }
}
`

async function main() {
  const payload = buildPayload()
  console.log('═'.repeat(64))
  console.log(`📦 ProductHunt 发布 — ${DRY_RUN ? 'DRY-RUN 预览' : '实际发布'}`)
  console.log('═'.repeat(64))
  console.log(`📄 Name:     ${payload.name}`)
  console.log(`✏️  Tagline:  ${payload.tagline} (${payload.tagline.length} chars)`)
  console.log(`🔗 URL:      ${payload.url}`)
  console.log(`🏷  Topics:  [${payload.topics.join(', ')}]`)
  console.log('─'.repeat(64))

  if (DRY_RUN) {
    console.log('GraphQL Variables:')
    console.log(JSON.stringify(payload, null, 2))
    return
  }

  if (!TOKEN) {
    console.error('❌ 缺少 PRODUCTHUNT_TOKEN 环境变量')
    console.error('   获取: https://api.producthunt.com/v2/oauth/applications')
    console.error('   创建 application,在 OAuth 页面生成 access token (没有过期时间的)')
    process.exit(1)
  }

  try {
    const res = await fetch(PH_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TOKEN}`,
        'User-Agent': 'IHUI-AI-cross-publish/0.2.0',
      },
      body: JSON.stringify({
        query: MUTATION,
        variables: payload,
      }),
    })
    const result = await res.json().catch(() => ({}))
    if (!res.ok) {
      console.error(`❌ HTTP ${res.status}: ${JSON.stringify(result)}`)
      console.error('   常见错误:')
      console.error('   - 401: token 无效/过期')
      console.error('   - 422: 字段格式错误 (tagline > 60 字符,或 URL 无效)')
      console.error('   - "Daily limit": ProductHunt 每天只能发一个产品')
      process.exit(1)
    }
    const data = result?.data?.postCreate
    if (data?.error) {
      console.error(`❌ ProductHunt 返回错误: ${data.error.message} (${data.error.code})`)
      console.error('   - "TOO_LATE_TO_SCHEDULE": 需要提前 7 天预约 launch day')
      console.error('   - "PRODUCT_ALREADY_EXISTS": 该 URL 已发布过产品')
      process.exit(1)
    }
    if (data?.success && data?.post) {
      console.log(`✅ 已发布: ${data.post.url}`)
      console.log(`   Post ID: ${data.post.id}`)
    } else {
      console.error(`❌ 发布失败: ${JSON.stringify(result)}`)
      process.exit(1)
    }
  } catch (e) {
    console.error(`❌ 网络错误: ${e.message}`)
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(`❌ 未捕获异常: ${e.message}`)
  process.exit(1)
})
