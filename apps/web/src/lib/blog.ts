import * as fs from 'node:fs'
import * as path from 'node:path'

/** blog 文章元数据(从 markdown frontmatter 解析) */
export interface BlogPostMeta {
  slug: string
  title: string
  date: string
  tags: string[]
  category: string
  description: string
  /** 估算阅读时长(分钟) */
  readMinutes: number
  /** 文件字符数(用于排序/筛选) */
  charCount: number
}

/** blog 文章完整内容 */
export interface BlogPost extends BlogPostMeta {
  content: string
}

/** docs/blog 目录绝对路径(从 apps/web 向上 2 级到项目根目录) */
const BLOG_DIR = path.resolve(process.cwd(), '..', '..', 'docs', 'blog')

/** 解析 markdown frontmatter(简单 key: value / key: [...] 格式,够用) */
function parseFrontmatter(raw: string): { data: Record<string, string | string[]>; content: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(raw)
  if (!match || !match[1] || !match[2]) return { data: {}, content: raw }

  const data: Record<string, string | string[]> = {}
  for (const line of match[1].split(/\r?\n/)) {
    const m = /^([a-zA-Z_-]+):\s*(.*)$/.exec(line)
    if (!m || !m[1] || m[2] === undefined) continue
    const key = m[1]
    const raw = m[2].trim()
    if (raw.startsWith('[') && raw.endsWith(']')) {
      data[key] = raw
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean)
    } else {
      data[key] = raw.replace(/^["']|["']$/g, '')
    }
  }
  return { data, content: match[2] }
}

/** 文件名 → slug(去前缀编号 + .md) */
function fileToSlug(filename: string): string {
  return filename
    .replace(/^\d+-/, '')
    .replace(/\.md$/, '')
}

/** 估算阅读时长(中文按 350 字/分钟,英文按 200 词/分钟,取大者) */
function estimateReadMinutes(content: string): number {
  const cjkChars = (content.match(/[\u4e00-\u9fff]/g) ?? []).length
  const englishWords = (content.match(/[A-Za-z]+/g) ?? []).length
  const minutes = Math.max(cjkChars / 350, englishWords / 200)
  return Math.max(1, Math.round(minutes))
}

/** 列出所有 blog 文章(按日期降序) */
export function listBlogPosts(): BlogPostMeta[] {
  if (!fs.existsSync(BLOG_DIR)) return []
  const files = fs
    .readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith('.md'))
  const posts: BlogPostMeta[] = files.map((file) => {
    const raw = fs.readFileSync(path.join(BLOG_DIR, file), 'utf-8')
    const { data, content } = parseFrontmatter(raw)
    return {
      slug: fileToSlug(file),
      title: (data.title as string) ?? fileToSlug(file),
      date: (data.date as string) ?? '1970-01-01',
      tags: (data.tags as string[]) ?? [],
      category: (data.category as string) ?? '未分类',
      description: (data.description as string) ?? '',
      readMinutes: estimateReadMinutes(content),
      charCount: content.length,
    }
  })
  return posts.sort((a, b) => (a.date < b.date ? 1 : -1))
}

/** 读取单篇文章(完整 markdown 正文) */
export function getBlogPost(slug: string): BlogPost | null {
  if (!fs.existsSync(BLOG_DIR)) return null
  const file = fs
    .readdirSync(BLOG_DIR)
    .find((f) => f.endsWith('.md') && fileToSlug(f) === slug)
  if (!file) return null
  const raw = fs.readFileSync(path.join(BLOG_DIR, file), 'utf-8')
  const { data, content } = parseFrontmatter(raw)
  return {
    slug,
    title: (data.title as string) ?? slug,
    date: (data.date as string) ?? '1970-01-01',
    tags: (data.tags as string[]) ?? [],
    category: (data.category as string) ?? '未分类',
    description: (data.description as string) ?? '',
    readMinutes: estimateReadMinutes(content),
    charCount: content.length,
    content,
  }
}

/** 所有分类(去重) */
export function listBlogCategories(): string[] {
  const set = new Set<string>()
  for (const p of listBlogPosts()) set.add(p.category)
  return Array.from(set)
}
