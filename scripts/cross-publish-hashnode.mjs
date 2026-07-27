#!/usr/bin/env node
/**
 * Hashnode 交叉发布脚本
 *
 * 把 docs/blog/*.md 自动发布到 Hashnode publication,带 canonicalUrl 回指 ihui.ai。
 * 通过 GraphQL API 调用 publishPost mutation。
 *
 * 用法:
 *   node scripts/cross-publish-hashnode.mjs --dry-run                              # 预览所有文章 GraphQL 变量(不发布)
 *   node scripts/cross-publish-hashnode.mjs --file 11-mcp-protocol-implementation-guide.md --dry-run
 *   HASHNODE_TOKEN=xxx HASHNODE_PUBLICATION_ID=xxx node scripts/cross-publish-hashnode.mjs
 *   HASHNODE_TOKEN=xxx HASHNODE_PUBLICATION_ID=xxx node scripts/cross-publish-hashnode.mjs --interval 300
 *
 * API 文档: https://apidocs.hashnode.com/
 * Token 获取: https://hashnode.com/settings/developer
 * publicationId: 先在 hashnode.com 创建 publication,Publication Dashboard → Domain 可见 ID
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
const HASHNODE_API = 'https://api.hashnode.com/graphql'
const SITE_URL = process.env.SITE_URL || 'https://ihui.ai'
const GITHUB_URL = 'https://github.com/IHUI-INF-AI/IHUI-AI'
const TOKEN = process.env.HASHNODE_TOKEN
const PUBLICATION_ID = process.env.HASHNODE_PUBLICATION_ID

// ---------- 参数解析 ----------
const argv = process.argv.slice(2)
function argValue(name) {
  const i = argv.indexOf(name)
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null
}
const DRY_RUN = argv.includes('--dry-run')
const FILE_FILTER = argValue('--file')
const INTERVAL_SEC = parseInt(argValue('--interval') || '5', 10)

// ---------- 1. frontmatter 解析 ----------
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

// ---------- 2. 文件名 → slug ----------
function fileToSlug(filename) {
  return filename.replace(/^\d+-/, '').replace(/\.md$/, '')
}

// ---------- 3. tag → Hashnode {slug, name} ----------
// Hashnode tag slug 必须小写 ASCII,最多 5 个。
function toHashnodeTags(tags) {
  if (!Array.isArray(tags)) return []
  const seen = new Set()
  const out = []
  for (const t of tags) {
    const name = String(t).trim()
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    if (!slug || slug.length === 0 || slug.length > 50) continue
    if (seen.has(slug)) continue
    seen.add(slug)
    // name 用清洗后的英文(去中文),保证 UI 友好
    const cleanName = name.replace(/[^\x20-\x7E]/g, '').trim() || slug
    out.push({ slug, name: cleanName })
    if (out.length === 5) break
  }
  return out
}

// ---------- 4. footer ----------
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

// ---------- 6. GraphQL mutation ----------
const PUBLISH_POST_MUTATION = `#graphql
  mutation PublishPost($input: PublishPostInput!) {
    publishPost(input: $input) {
      post {
        id
        slug
        url
      }
    }
  }
`

// ---------- 7. 构造单篇 GraphQL 变量 ----------
function buildVariables(file) {
  const raw = readFileSync(join(BLOG_DIR, file), 'utf-8')
  const { data, content } = parseFrontmatter(raw)
  const slug = fileToSlug(file)
  const title = data.title || slug
  const subtitle = data.description || ''
  const tags = toHashnodeTags(data.tags || [])
  const canonicalUrl = `${SITE_URL}/blog/${slug}`
  const contentMarkdown = content.trim() + buildFooter(slug)
  return {
    input: {
      title,
      subtitle,
      publicationId: PUBLICATION_ID || '<HASHNODE_PUBLICATION_ID>',
      contentMarkdown,
      tags,
      canonicalUrl,
    },
  }
}

// ---------- 8. 发布单篇 ----------
async function publishOne(file) {
  const variables = buildVariables(file)
  const input = variables.input
  console.log('─'.repeat(64))
  console.log(`📄 ${file}`)
  console.log(`   title:        ${input.title}`)
  console.log(`   tags:         [${input.tags.map((t) => `${t.slug}`).join(', ')}]`)
  console.log(`   canonicalUrl: ${input.canonicalUrl}`)
  console.log(`   publication:  ${input.publicationId}`)
  console.log(`   body:         ${input.contentMarkdown.length} chars`)

  if (DRY_RUN) {
    const preview = {
      ...variables,
      input: { ...input, contentMarkdown: `[${input.contentMarkdown.length} chars]` },
    }
    console.log('   GraphQL variables:')
    console.log(JSON.stringify(preview, null, 2))
    return { ok: true, dryRun: true }
  }

  if (!TOKEN) {
    console.error('   ❌ 缺少 HASHNODE_TOKEN 环境变量(获取: https://hashnode.com/settings/developer)')
    return { ok: false, err: 'no-token' }
  }
  if (!PUBLICATION_ID) {
    console.error('   ❌ 缺少 HASHNODE_PUBLICATION_ID 环境变量(在 hashnode.com 创建 publication 后获取)')
    return { ok: false, err: 'no-publication-id' }
  }

  try {
    const res = await fetch(HASHNODE_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: TOKEN,
      },
      body: JSON.stringify({ query: PUBLISH_POST_MUTATION, variables }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok || body?.errors) {
      const errMsg = body?.errors ? JSON.stringify(body.errors) : `HTTP ${res.status}`
      console.error(`   ❌ ${errMsg}`)
      return { ok: false, err: errMsg }
    }
    const post = body?.data?.publishPost?.post
    const url = post?.url || (post ? `https://hashnode.com/post/${post.id}` : '(unknown)')
    console.log(`   ✅ 已发布: ${url}`)
    return { ok: true, url }
  } catch (e) {
    console.error(`   ❌ 网络错误: ${e.message}`)
    return { ok: false, err: e.message }
  }
}

// ---------- 9. 主流程 ----------
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

  console.log('═'.repeat(64))
  console.log(`📦 Hashnode 交叉发布${DRY_RUN ? ' (DRY-RUN 预览)' : ''}`)
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
