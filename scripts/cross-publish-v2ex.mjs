#!/usr/bin/env node
/**
 * V2EX 交叉发布脚本
 *
 * 把项目推广帖发布到 V2EX,通过 access token 调用 REST API。
 *
 * 用法:
 *   node scripts/cross-publish-v2ex.mjs --dry-run                     # 预览 payload(不发布)
 *   V2EX_TOKEN=xxx node scripts/cross-publish-v2ex.mjs                # 实际发布
 *   V2EX_TOKEN=xxx node scripts/cross-publish-v2ex.mjs --node programmer   # 指定节点
 *   V2EX_TOKEN=xxx node scripts/cross-publish-v2ex.mjs --title "..." --content "..."  # 自定义标题/内容
 *
 * API 文档: https://www.v2ex.com/help/api
 * Token 获取: https://www.v2ex.com/settings/tokens (需绑定手机号)
 *
 * 退出码: 0=成功(或 dry-run); 1=配置错误/发布失败。
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')

const V2EX_API = 'https://www.v2ex.com/api/topics/create.json'
const TOKEN = process.env.V2EX_TOKEN

// ---------- 默认推广帖(可被 --title/--content 覆盖) ----------
const DEFAULT_DRAFT_PATH = join(ROOT, '.trae-cn', 'tmp', 'v2ex-post.md')

// ---------- 参数解析 ----------
const argv = process.argv.slice(2)
function argValue(name) {
  const i = argv.indexOf(name)
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null
}
const DRY_RUN = argv.includes('--dry-run')
const NODE_NAME = argValue('--node') || 'programmer' // 默认程序员节点
const CUSTOM_TITLE = argValue('--title')
const CUSTOM_CONTENT_FILE = argValue('--content-file')

// ---------- 从草稿 md 提取标题和正文 ----------
function parseDraft(path) {
  if (!existsSync(path)) return null
  const raw = readFileSync(path, 'utf-8')
  // 提取 ## 标题 下的第一行作为 title
  const titleMatch = /^##\s+标题\s*\n\s*\n(.+?)$/m.exec(raw)
  // 提取 ## 正文 下的内容作为 body
  const bodyMatch = /^##\s+正文\s*\n\s*\n([\s\S]+?)(?=\n---\n|\n##\s)/m.exec(raw)
  let title = titleMatch ? titleMatch[1].trim() : 'IHUI AI — 8 端全栈 AI 操作系统'
  let body = bodyMatch ? bodyMatch[1].trim() : ''
  // 清理 markdown 注释占位
  body = body.replace(/\[截图占位[^\]]*\]/g, '').trim()
  return { title, body }
}

// ---------- 构造 payload ----------
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
      console.error('   可用 --title "..." --content-file path 自定义,或先创建草稿')
      process.exit(1)
    }
    title = draft.title
    body = draft.body
  }

  // V2EX 标题 < 100 字符
  if (title.length > 100) title = title.substring(0, 97) + '...'

  // V2EX 正文限制较松,但建议 < 20000 字符
  if (body.length > 20000) body = body.substring(0, 19997) + '...'

  return {
    title,
    content: body,
    node_name: NODE_NAME,
  }
}

// ---------- 发布 ----------
async function publish() {
  const payload = buildPayload()
  console.log('═'.repeat(64))
  console.log(`📦 V2EX 发布 — ${DRY_RUN ? 'DRY-RUN 预览' : '实际发布'}`)
  console.log('═'.repeat(64))
  console.log(`📄 标题:  ${payload.title}`)
  console.log(`📍 节点:  ${payload.node_name}`)
  console.log(`📝 正文:  ${payload.content.length} chars`)
  console.log('─'.repeat(64))

  if (DRY_RUN) {
    console.log('Payload:')
    console.log(JSON.stringify({ ...payload, content: `[${payload.content.length} chars]` }, null, 2))
    return
  }

  if (!TOKEN) {
    console.error('❌ 缺少 V2EX_TOKEN 环境变量')
    console.error('   获取: https://www.v2ex.com/settings/tokens (需绑定手机号)')
    process.exit(1)
  }

  try {
    const res = await fetch(V2EX_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Bearer ${TOKEN}`,
      },
      body: new URLSearchParams(payload).toString(),
    })
    const result = await res.json().catch(() => ({}))
    if (!res.ok) {
      console.error(`❌ HTTP ${res.status}: ${JSON.stringify(result)}`)
      console.error('   常见错误:')
      console.error('   - 403: token 无效/权限不足/节点限制发帖')
      console.error('   - 429: 节流(每天发帖数限制)')
      console.error('   - 400: 标题/内容格式错误,或 node_name 不存在')
      process.exit(1)
    }
    const topicId = result.id || result.topic_id
    const url = topicId ? `https://www.v2ex.com/t/${topicId}` : '(未知 URL,请到 V2EX 个人主页查看)'
    console.log(`✅ 已发布: ${url}`)
    console.log(`   返回: ${JSON.stringify(result).substring(0, 200)}`)
  } catch (e) {
    console.error(`❌ 网络错误: ${e.message}`)
    process.exit(1)
  }
}

publish()
