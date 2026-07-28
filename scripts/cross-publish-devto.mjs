#!/usr/bin/env node
/**
 * dev.to 交叉发布脚本
 *
 * 把 docs/blog/*.md 自动发布到 dev.to,带 canonical_url 回指 aizhs.top,
 * 避免搜索引擎重复内容惩罚,同时给原博客导流。
 *
 * 用法:
 *   node scripts/cross-publish-devto.mjs --dry-run                              # 预览所有文章 payload(不发布)
 *   node scripts/cross-publish-devto.mjs --file 11-mcp-protocol-implementation-guide.md --dry-run
 *   DEV_TO_API_KEY=xxx node scripts/cross-publish-devto.mjs                     # 实际发布(默认草稿)
 *   DEV_TO_API_KEY=xxx node scripts/cross-publish-devto.mjs --publish           # 直接发布(慎用)
 *   DEV_TO_API_KEY=xxx node scripts/cross-publish-devto.mjs --interval 300      # 每篇间隔 300s(发布模式推荐)
 *
 * API 文档: https://developers.forkbin.com/
 * API key 获取: https://dev.to/settings/extensions
 *
 * 退出码: 0=成功(或 dry-run); 1=配置错误/部分或全部发布失败。
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT = resolve(__dirname, '..')

const BLOG_DIR = join(ROOT, 'docs', 'blog')
const DEV_TO_API = 'https://dev.to/api/articles'
const SITE_URL = process.env.SITE_URL || 'https://aizhs.top'
const GITHUB_URL = 'https://github.com/IHUI-INF-AI/IHUI-AI'
const API_KEY = process.env.DEV_TO_API_KEY

// ---------- 参数解析 ----------
const argv = process.argv.slice(2)
function argValue(name) {
  const i = argv.indexOf(name)
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null
}
const DRY_RUN = argv.includes('--dry-run')
const PUBLISH = argv.includes('--publish')
const FILE_FILTER = argValue('--file')
const INTERVAL_SEC = parseInt(argValue('--interval') || '5', 10)

// ---------- 1. frontmatter 解析(与 apps/web/src/lib/blog.ts 同款) ----------
function parseFrontmatter(raw) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(raw)
  if (!match || !match[1] || !match[2]) return { data: {}, content: raw }
  const data = {}
  for (const line of match[1].split(/\r?\n/)) {
    const m = /^([a-zA-Z_-]+):\s*(.*)$/.exec(line)
    if (!m || !m[1] || m[2] === undefined) continue
    const key = m[1]
    const val = m[2].trim()
    if (val.startsWith('[') && val.endsWith(']')) {
      data[key] = val
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean)
    } else {
      data[key] = val.replace(/^["']|["']$/g, '')
    }
  }
  return { data, content: match[2] }
}

// ---------- 2. 文件名 → slug(去前缀编号 + .md) ----------
function fileToSlug(filename) {
  return filename.replace(/^\d+-/, '').replace(/\.md$/, '')
}

// ---------- 3. tag 转换:去中文/特殊字符,小写,最多 4 个,每个 < 30 字符 ----------
function toDevToTags(tags) {
  if (!Array.isArray(tags)) return []
  const seen = new Set()
  const out = []
  for (const t of tags) {
    const clean = String(t).toLowerCase().replace(/[^a-z0-9]/g, '')
    if (clean.length === 0 || clean.length >= 30) continue
    if (seen.has(clean)) continue
    seen.add(clean)
    out.push(clean)
    if (out.length === 4) break
  }
  return out
}

// ---------- 4. footer(英文,带 GitHub 链接) ----------
function buildFooter(slug) {
  return (
    `\n\n---\n\n` +
    `*This article was originally published on the ` +
    `[IHUI AI Blog](${SITE_URL}/blog/${slug}). ` +
    `Follow us on [GitHub](${GITHUB_URL}) for more AI engineering content.*\n`
  )
}

// ---------- 5. 列出 blog 文件 ----------
function listBlogFiles() {
  if (!existsSync(BLOG_DIR)) return []
  return readdirSync(BLOG_DIR).filter((f) => f.endsWith('.md')).sort()
}

function matchFile(files, filter) {
  // 支持完整文件名 / 不带 .md / 纯编号前缀 / slug
  return files.filter((f) => {
    if (f === filter) return true
    const slug = fileToSlug(f)
    if (slug === filter) return true
    if (slug === filter.replace(/\.md$/, '')) return true
    const numPrefix = /^(\d+)-/.exec(f)
    if (numPrefix && numPrefix[1] === filter) return true
    return false
  })
}

// ---------- 6. 构造单篇 payload ----------
function buildArticlePayload(file) {
  const raw = readFileSync(join(BLOG_DIR, file), 'utf-8')
  const { data, content } = parseFrontmatter(raw)
  const slug = fileToSlug(file)
  const title = data.title || slug
  const description = data.description || ''
  const tags = toDevToTags(data.tags || [])
  const canonicalUrl = `${SITE_URL}/blog/${slug}`
  const body = content.trim() + buildFooter(slug)
  return {
    article: {
      title,
      published: PUBLISH,
      body_markdown: body,
      tags,
      description,
      canonical_url: canonicalUrl,
    },
  }
}

// ---------- 7. 发布单篇 ----------
async function publishOne(file) {
  const payload = buildArticlePayload(file)
  const art = payload.article
  console.log('─'.repeat(64))
  console.log(`📄 ${file}`)
  console.log(`   title:     ${art.title}`)
  console.log(`   tags:      [${art.tags.join(', ')}]`)
  console.log(`   canonical: ${art.canonical_url}`)
  console.log(`   published: ${art.published}`)
  console.log(`   body:      ${art.body_markdown.length} chars`)

  if (DRY_RUN) {
    const preview = {
      ...payload,
      article: { ...art, body_markdown: `[${art.body_markdown.length} chars]` },
    }
    console.log('   Payload:')
    console.log(JSON.stringify(preview, null, 2))
    return { ok: true, dryRun: true }
  }

  if (!API_KEY) {
    console.error('   ❌ 缺少 DEV_TO_API_KEY 环境变量(获取: https://dev.to/settings/extensions)')
    return { ok: false, err: 'no-api-key' }
  }

  try {
    const res = await fetch(DEV_TO_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'api-key': API_KEY,
      },
      body: JSON.stringify(payload),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      console.error(`   ❌ HTTP ${res.status}: ${JSON.stringify(body)}`)
      return { ok: false, err: `HTTP ${res.status}` }
    }
    const url = body?.url || `https://dev.to/${body?.username || 'me'}/${body?.slug || ''}`
    console.log(`   ✅ 已创建${PUBLISH ? '(已发布)' : '(草稿)'}: ${url}`)
    return { ok: true, url }
  } catch (e) {
    console.error(`   ❌ 网络错误: ${e.message}`)
    return { ok: false, err: e.message }
  }
}

// ---------- 8. 主流程 ----------
async function main() {
  const files = listBlogFiles()
  if (files.length === 0) {
    console.error(`❌ 找不到 blog 目录或为空: ${BLOG_DIR}`)
    process.exit(1)
  }

  const targets = FILE_FILTER ? matchFile(files, FILE_FILTER) : files
  if (targets.length === 0) {
    console.error(`❌ --file 未匹配到任何文件: ${FILE_FILTER}`)
    console.error('   可用文件:')
    files.forEach((f) => console.error(`     - ${f}`))
    process.exit(1)
  }

  const modeLabel = DRY_RUN ? 'DRY-RUN 预览' : PUBLISH ? '直接发布' : '草稿模式'
  console.log('═'.repeat(64))
  console.log(`📦 dev.to 交叉发布 — ${modeLabel}`)
  console.log(`   目标: ${targets.length} 篇`)
  if (!DRY_RUN) console.log(`   间隔: ${INTERVAL_SEC}s/篇(反垃圾 politeness)`)
  console.log('═'.repeat(64))

  const results = []
  for (let i = 0; i < targets.length; i++) {
    const r = await publishOne(targets[i])
    results.push({ file: targets[i], ...r })
    if (!DRY_RUN && i < targets.length - 1) {
      await new Promise((r) => setTimeout(r, Math.max(0, INTERVAL_SEC) * 1000))
    }
  }

  console.log('═'.repeat(64))
  const ok = results.filter((r) => r.ok).length
  const fail = results.length - ok
  console.log(`✅ 成功 ${ok} / 失败 ${fail}`)
  if (fail > 0) process.exit(1)
}

main().catch((e) => {
  console.error('[FATAL]', e)
  process.exit(1)
})
