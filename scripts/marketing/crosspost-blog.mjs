#!/usr/bin/env node
// crosspost-blog.mjs — 一键交叉发布博客到 dev.to / Medium / Substack
//
// 用途:把 IHUI-AI 文档 / 博客 内容自动发布到多个平台
//
// 用法:
//   node scripts/marketing/crosspost-blog.mjs --platform devto --article <id>
//   node scripts/marketing/crosspost-blog.mjs --platform medium --article <id>
//   node scripts/marketing/crosspost-blog.mjs --platform all --article <id>
//   node scripts/marketing/crosspost-blog.mjs --dry-run
//
// 前置条件:
//   1. DEV_TO_API_TOKEN(dev.to API token,Settings → Extensions → DEV Community API)
//   2. MEDIUM_INTEGRATION_TOKEN(Medium 集成 token,Settings → Integration tokens)
//   3. SUBSTACK_PUBLISH_TOKEN(自部署 Substack 才有 API,官方 Substack 无 API,
//      需手动复制 Markdown 到 Substack 编辑器)
//
// 平台支持:
//   - dev.to:✅ 完整 API 支持
//   - Medium:✅ Integration Token API(官方支持)
//   - Substack:⚠️ 无官方 API,只能生成可粘贴的 Markdown 片段

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { resolve, dirname, basename, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '../..')

// ==================== 参数 ====================
const args = process.argv.slice(2)
let platform = null
let articleId = null
let dryRun = false
let help = false

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--platform' && args[i + 1]) platform = args[i + 1]
  if (args[i] === '--article' && args[i + 1]) articleId = args[i + 1]
  if (args[i] === '--dry-run') dryRun = true
  if (args[i] === '--help' || args[i] === '-h') help = true
}

if (help) {
  console.log(`
一键交叉发布博客脚本

用法:
  node scripts/marketing/crosspost-blog.mjs [options]

选项:
  --platform <p>    目标平台: devto / medium / substack / all
  --article <id>    文章 ID 或文件名(默认列出所有待发布)
  --dry-run         仅生成待发布内容,不发请求
  -h, --help        显示帮助

环境变量:
  DEV_TO_API_TOKEN       dev.to API token
  MEDIUM_INTEGRATION_TOKEN Medium Integration Token
  SUBSTACK_PUBLISH_TOKEN  (Substack 无官方 API,本脚本只生成可粘贴片段)

示例:
  # 列出所有待发布文章
  node scripts/marketing/crosspost-blog.mjs

  # 发布 dev.to
  node scripts/marketing/crosspost-blog.mjs --platform devto --article 01-8-ends

  # 全部平台
  node scripts/marketing/crosspost-blog.mjs --platform all --article 01-8-ends
`)
  process.exit(0)
}

// ==================== 文章清单 ====================
const ARTICLE_DIRS = [
  resolve(PROJECT_ROOT, 'docs/blog'),
  resolve(PROJECT_ROOT, '.trae-cn/tmp/marketing-2026-07-28'),
]

const PLATFORM_META = {
  devto: {
    api: 'https://dev.to/api',
    tokenEnv: 'DEV_TO_API_TOKEN',
    title: 'dev.to',
    limit: 80, // title 字符限制
    tags: ['ai', 'opensource', 'typescript', 'langgraph', 'mcp'],
  },
  medium: {
    api: 'https://api.medium.com/v1',
    tokenEnv: 'MEDIUM_INTEGRATION_TOKEN',
    title: 'Medium',
    limit: 100,
    tags: ['ai', 'open-source', 'programming', 'startup', 'technology'],
  },
  substack: {
    api: null, // 无 API
    title: 'Substack',
    limit: 200,
    tags: [],
  },
}

function listArticles() {
  const articles = []
  for (const dir of ARTICLE_DIRS) {
    if (!existsSync(dir)) continue
    const files = readdirSync(dir)
    for (const f of files) {
      if (f.endsWith('.md') && !f.includes('README') && !f.includes('index')) {
        articles.push({
          path: resolve(dir, f),
          id: basename(f, extname(f)),
          name: f,
        })
      }
    }
  }
  return articles
}

// ==================== 解析 Markdown 文章 ====================
function parseArticle(filePath) {
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')

  // 提取 title(# Title)
  let title = ''
  let inFrontmatter = false
  let bodyStart = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (i === 0 && line.trim() === '---') {
      inFrontmatter = true
      continue
    }
    if (inFrontmatter) {
      if (line.trim() === '---') {
        inFrontmatter = false
        bodyStart = i + 1
      }
      continue
    }
    if (line.startsWith('# ')) {
      title = line.slice(2).trim()
      bodyStart = i + 1
      break
    }
  }

  // 提取 frontmatter tags
  const tags = []
  if (bodyStart > 0) {
    const fm = content.split('---')[1] || ''
    const tagRe = /tags:\s*\[(.*?)\]/
    const tagMatch = fm.match(tagRe)
    if (tagMatch) {
      tagMatch[1]
        .split(',')
        .map((t) => t.trim().replace(/['"]/g, ''))
        .forEach((t) => t && tags.push(t))
    }
  }

  return { title, content, tags, body: lines.slice(bodyStart).join('\n') }
}

// ==================== 发布到 dev.to ====================
async function publishToDevTo(article) {
  const token = process.env.DEV_TO_API_TOKEN
  if (!token && !dryRun) {
    console.error('[FAIL] DEV_TO_API_TOKEN 未设置')
    console.error('       1. 登录 https://dev.to')
    console.error('       2. Settings → Extensions → DEV Community API → Generate')
    process.exit(1)
  }

  const meta = PLATFORM_META.devto
  const title = article.title.length > meta.limit ? article.title.slice(0, meta.limit - 3) + '...' : article.title
  const tags = article.tags.length > 0 ? article.tags.slice(0, 4) : meta.tags

  console.log(`[INFO] 发布到 dev.to: ${title}`)
  console.log(`       标签: ${tags.join(', ')}`)

  if (dryRun) {
    console.log('[DRY-RUN] 跳过实际 API 调用')
    return
  }

  const payload = {
    article: {
      title,
      body_markdown: article.body,
      published: false, // 草稿,不直接发布
      tags: tags.slice(0, 4), // dev.to 限制 4 个
    },
  }

  const res = await fetch(`${meta.api}/articles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': token,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error(`[FAIL] dev.to 发布失败: HTTP ${res.status}`)
    console.error(err.slice(0, 500))
    process.exit(1)
  }

  const result = await res.json()
  console.log(`[OK] dev.to 草稿创建: https://dev.to/dashboard`)
  console.log(`     ID: ${result.id}`)
  return result
}

// ==================== 发布到 Medium ====================
async function publishToMedium(article) {
  const token = process.env.MEDIUM_INTEGRATION_TOKEN
  if (!token && !dryRun) {
    console.error('[FAIL] MEDIUM_INTEGRATION_TOKEN 未设置')
    console.error('       1. 登录 https://medium.com')
    console.error('       2. Settings → Integration tokens → Generate')
    process.exit(1)
  }

  const meta = PLATFORM_META.medium
  console.log(`[INFO] 发布到 Medium: ${article.title}`)

  if (dryRun) {
    console.log('[DRY-RUN] 跳过实际 API 调用')
    return
  }

  // 1. 获取 user ID
  const userRes = await fetch(`${meta.api}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const user = await userRes.json()
  const userId = user.data?.id
  if (!userId) {
    console.error('[FAIL] 无法获取 Medium user ID,token 可能无效')
    process.exit(1)
  }

  // 2. 创建 post
  const payload = {
    title: article.title,
    contentFormat: 'markdown',
    content: article.body,
    tags: meta.tags,
    publishStatus: 'draft',
  }

  const res = await fetch(`${meta.api}/users/${userId}/posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error(`[FAIL] Medium 发布失败: HTTP ${res.status}`)
    console.error(err.slice(0, 500))
    process.exit(1)
  }

  const result = await res.json()
  console.log(`[OK] Medium 草稿创建: ${result.data?.url || '(URL 稍后可见)'}`)
  return result
}

// ==================== 生成 Substack 草稿 ====================
function generateSubstackDraft(article) {
  const draftDir = resolve(PROJECT_ROOT, '.trae-cn/tmp/marketing-2026-07-28/substack-drafts')
  if (!existsSync(draftDir)) mkdirSync(draftDir, { recursive: true })

  const draftPath = resolve(draftDir, `${article.id || 'draft'}-substack.md`)
  const draftContent = `# Substack 草稿 — ${article.title}

> ⚠️ Substack 无官方 API,需手动复制到 https://ihui-ai.substack.com/publish

## Subject(邮件标题)
[IHUI-AI Weekly] ${article.title}

## Preheader(预览文本,80 字符内)
Real engineering, not hype. 8 platforms, 176 LLMs, 1 codebase.

---

## 正文(直接粘贴)

${article.body}

---

## 标签(Substack 最多 5 个)
${(article.tags.length > 0 ? article.tags : PLATFORM_META.devto.tags).slice(0, 5).join(', ')}

## 发布后行动
- [ ] 在 https://ihui-ai.substack.com/publish 粘贴
- [ ] 预览确认
- [ ] 设定发送时间(推荐周二 9:00 AM ET)
- [ ] 推文 + 微博同步
`

  if (dryRun) {
    console.log(`[DRY-RUN] Substack 草稿将生成: ${draftPath}`)
    return
  }

  writeFileSync(draftPath, draftContent, 'utf-8')
  console.log(`[OK] Substack 草稿生成: ${draftPath}`)
}

// ==================== 主流程 ====================
async function main() {
  console.log('============================================================')
  console.log('  交叉发布脚本 — IHUI-AI 博客')
  console.log('============================================================')
  console.log(`  平台: ${platform || '(未指定)'}`)
  console.log(`  文章: ${articleId || '(未指定)'}`)
  console.log(`  模式: ${dryRun ? 'DRY-RUN' : '实际发布'}`)
  console.log()

  if (!platform) {
    console.log('[INFO] 可用文章:')
    const articles = listArticles()
    for (const a of articles.slice(0, 20)) {
      console.log(`         - ${a.name}`)
    }
    console.log()
    console.log('[INFO] 用法: --platform devto|medium|substack|all --article <id>')
    process.exit(0)
  }

  if (!articleId) {
    console.error('[FAIL] --article <id> 必填')
    process.exit(1)
  }

  // 定位文章
  const articles = await listArticles()
  const article = articles.find((a) => a.id === articleId || a.name === `${articleId}.md`)
  if (!article) {
    console.error(`[FAIL] 找不到文章: ${articleId}`)
    console.error('       可用:')
    for (const a of articles.slice(0, 10)) console.error(`         - ${a.name}`)
    process.exit(1)
  }

  console.log(`[INFO] 找到文章: ${article.path}`)
  const parsed = parseArticle(article.path)
  console.log(`       标题: ${parsed.title}`)
  console.log(`       长度: ${parsed.body.length} 字符`)
  console.log(`       标签: ${parsed.tags.join(', ')}`)
  console.log()

  if (platform === 'devto' || platform === 'all') {
    await publishToDevTo(parsed)
    console.log()
  }

  if (platform === 'medium' || platform === 'all') {
    await publishToMedium(parsed)
    console.log()
  }

  if (platform === 'substack' || platform === 'all') {
    generateSubstackDraft(parsed)
    console.log()
  }

  console.log('============================================================')
  console.log('  ✅ 完成!')
  console.log('============================================================')
  console.log('  下一步:')
  console.log('  1. 登录 dev.to / Medium 确认草稿')
  console.log('  2. Substack 草稿:复制 .trae-cn/tmp/marketing-2026-07-28/substack-drafts/')
  console.log('  3. 推文 + 微博 + GitHub Discussions 同步')
  console.log('============================================================')
}

main().catch((e) => {
  console.error('[FATAL]', e)
  process.exit(1)
})
