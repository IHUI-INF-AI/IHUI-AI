// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve, join, relative } from 'node:path'
import Fastify from 'fastify'
import {
  GLOBAL_JSON_BODY_LIMIT,
  MEDIA_BASE64_BODY_LIMIT,
  MEDIA_FILE_UPLOAD_BODY_LIMIT,
  FILE_UPLOAD_BODY_LIMIT,
  SMALL_IMAGE_UPLOAD_BODY_LIMIT,
} from '../src/config/body-limits.js'

const SRC = resolve(__dirname, '../src')
const SERVER_TS = resolve(SRC, 'server.ts')
const ROUTES = resolve(SRC, 'routes')

/**
 * DDoS P2 收敛回归(2026-10-28)。
 *
 * 背景:全局请求体上限从 10MiB 收到 2MiB,把普通 JSON 接口的内存耗尽面压小。
 * 代价是:凡"请求体天然携带二进制媒体"的路由(multipart 上传 / base64 图片音频 /
 * 协议透传),若不给显式 bodyLimit,就会被全局值静默 413 —— 那不是安全,是功能坏死,
 * 而且症状是"上传失败/导入失败",极难归因。
 *
 * 本测试因此有三层:
 *   1) 常量单一真相源:全局值与各媒体上限都来自 config/body-limits.ts,server.ts 只能引用;
 *   2) 全量静态守卫:扫 routes 下所有 POST/PUT/PATCH,凡命中"媒体路由"判据却无显式
 *      bodyLimit 即红 —— 新增路由漏设会被这里拦住,不靠人记;
 *   3) 行为验证:极简 Fastify 镜像机制,证明 JSON >2MiB 确实 413、显式放开的路由确实能收大 body。
 */

// ───────────────────────── 媒体路由判据(守卫的唯一实现) ─────────────────────────

/** 内联二进制字段名:名称本身即说明承载二进制 */
const INLINE_BINARY =
  /^\s*(imageBase64|image_base64|audioBase64|audio_base64|input_audio|init_image|initImage|mask_image|maskImage|mask|maskUrl|filePayload|b64_json|base64|first_frame|firstFrame)\s*[?]?\s*:/
/** 媒体 URL 型字段名:可能被塞 data URI(仅媒体面判定,理由见 MEDIA_FACE) */
const MEDIA_URL =
  /^\s*(image|images|imageUrl|image_url|audio|audioUrl|audio_url|video|videoUrl|video_url|reference_audio|referenceImage|sourceImage)\s*[?]?\s*:/
/** 透传形态:messages: z.array(z.unknown()) —— 元素结构未知,可含 base64 图 */
const PASSTHROUGH_MSG = /messages\s*:\s*z\s*\.array\(\s*z\s*\.unknown\(\s*\)/
/** 真读 multipart 的调用 */
const MULTIPART = /\.parts\(\)|\.file\(\)/

/**
 * 媒体面文件(③ 媒体 URL 型判定的适用范围)。
 *
 * 为什么按模块收而不按字段名一刀切:CRUD 资源里的 imageUrl 设计上是"上传后拿到的
 * URL"(schema 多为 z.string().max(512)),真塞 data URI 属客户端滥用 —— 对它不放宽,
 * 失效方向是"多要一次"(413),符合 AGENTS.md §0.10;而对 AI 转发路由不放宽则是功能
 * 坏死(vision-analysis.tsx 把用户照片转 data URI 直传 /ai/dashscope/multimodal
 * 就是现成代码路径)。两者代价不对称,所以边界划在模块上。
 */
const MEDIA_FACE = [
  /^ai-vendors\//,
  /^ai-audio\.ts$/,
  /^ai-image-edit\.ts$/,
  /^ai-frontend-routes\.ts$/,
  /^files\.ts$/,
  /^engine-voice\.ts$/,
  /^v1-multimodal\.ts$/,
  /^v1-protocol-completeness\.ts$/,
  /^v1-realtime\.ts$/,
  /^v1-midjourney\.ts$/,
  /^chat-models\.ts$/,
  /^coze(-ecosystem)?\.ts$/,
  /^edu-canteen\.ts$/,
  /^tasks\.ts$/,
  /^remote-extended\.ts$/,
  /^tencent-hunyuan-3d\.ts$/,
]

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === '__tests__' || e.name === 'node_modules') continue
      walk(p, out)
    } else if (e.name.endsWith('.ts') && !e.name.endsWith('.test.ts')) {
      out.push(p)
    }
  }
  return out
}

/** 有 .max(小值) 或 .url() 的 URL 形态不算"无界字符串" */
function isUnboundedString(line: string): boolean {
  if (/\.url\(/.test(line)) return false
  const maxM = line.match(/\.max\(\s*(\d+)\s*\)/)
  if (maxM && Number(maxM[1]) < 100_000) return false
  return true
}

/** 收集文件里所有 `const X = z.object({…})` 的定义块 */
function collectSchemas(text: string): Map<string, string> {
  const lines = text.split('\n')
  const map = new Map<string, string>()
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    const m = line.match(/const\s+([A-Za-z_$][\w$]*)\s*=\s*z\s*\.object\(\{/)
    if (!m) continue
    let depth = 0
    const buf: string[] = []
    for (let j = i; j < lines.length; j++) {
      const l = lines[j] ?? ''
      buf.push(l)
      for (const ch of l) {
        if (ch === '{') depth++
        else if (ch === '}') depth--
      }
      if (depth === 0 && j > i) break
    }
    const name = m[1]
    if (name && !map.has(name)) map.set(name, buf.join('\n'))
  }
  return map
}

function classifySchema(block: string | undefined, mediaFace: boolean): 'inline-binary' | 'media-url' | null {
  if (!block) return null
  const lines = block.split('\n')
  if (lines.some((l) => INLINE_BINARY.test(l))) return 'inline-binary'
  if (PASSTHROUGH_MSG.test(block)) return mediaFace ? 'media-url' : null
  if (mediaFace && lines.some((l) => MEDIA_URL.test(l) && isUnboundedString(l))) return 'media-url'
  return null
}

/** 取 route 注册的 options 区文本(多行注册到 { … } 闭合;单行注册只取该行) */
function optionsOf(lines: string[], start: number): string {
  let depth = 0
  let started = false
  const acc: string[] = []
  for (let i = start; i < Math.min(start + 80, lines.length); i++) {
    const l = lines[i] ?? ''
    acc.push(l)
    for (const ch of l) {
      if (ch === '{' || ch === '(') {
        depth++
        started = true
      } else if (ch === '}' || ch === ')') depth--
    }
    if (started && depth <= 0) break
  }
  return acc.join('\n')
}

interface Missing {
  file: string
  line: number
  route: string
  kind: string
}

/** 扫描全仓 routes,返回"媒体路由但缺显式 bodyLimit"的清单 */
function scanMissingBodyLimits(): Missing[] {
  const files = walk(ROUTES)
  // 全局 schema 表(跨文件:proxy-llm 的 multimodalBody 等定义在 _shared.ts)
  const schemas = new Map<string, string>()
  const texts = new Map<string, string>()
  for (const f of files) {
    const t = readFileSync(f, 'utf-8')
    texts.set(f, t)
    for (const [k, v] of collectSchemas(t)) if (!schemas.has(k)) schemas.set(k, v)
  }

  const out: Missing[] = []
  for (const [f, text] of texts) {
    const short = relative(ROUTES, f).replace(/\\/g, '/')
    const mediaFace = MEDIA_FACE.some((re) => re.test(short))
    const lines = text.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? ''
      if (!/server\.(post|put|patch)\(/.test(line)) continue
      if (/^\s*(\/\/|\*)/.test(line)) continue

      const opts = optionsOf(lines, i)
      if (/bodyLimit/.test(opts)) continue // 已有显式上限

      const nameM = opts.match(/'([^']*)'/)
      const routePath = nameM?.[1] ?? '(动态路径)'

      // handler 范围(到下一个 route 注册为止,上限 300 行)
      let hEnd = Math.min(i + 300, lines.length)
      for (let j = i + 1; j < hEnd; j++) {
        if (/server\.(get|post|put|patch|delete|route)\(/.test(lines[j] ?? '')) {
          hEnd = j
          break
        }
      }
      const handler = lines.slice(i, hEnd).join('\n')
      const isMultipart = MULTIPART.test(handler)

      let schemaName: string | null = null
      const refA = opts.match(/body:\s*([A-Za-z_$][\w$]*)/)?.[1]
      if (refA && schemas.has(refA)) schemaName = refA
      if (!schemaName) {
        const refB = handler.match(/([A-Za-z_$][\w$]*)\s*\.(?:safeParse|parse)\(\s*request\.body/)?.[1]
        if (refB) schemaName = refB
      }

      const kind = isMultipart
        ? 'multipart'
        : classifySchema(schemaName ? schemas.get(schemaName) : undefined, mediaFace)
      if (!kind) continue

      out.push({ file: short, line: i + 1, route: routePath, kind })
    }
  }
  return out
}

// ───────────────────────── 1. 常量单一真相源 ─────────────────────────

describe('DDoS P2 — 请求体上限常量单一真相源', () => {
  const serverSrc = readFileSync(SERVER_TS, 'utf-8')

  it('server.ts 全局值必须引用常量(不得就地写字面量,也不得回潮到 10MiB)', () => {
    expect(serverSrc).toContain('bodyLimit: GLOBAL_JSON_BODY_LIMIT,')
    expect(serverSrc).not.toContain('bodyLimit: 1048576 * 10,')
    expect(serverSrc).not.toContain('bodyLimit: 2 * 1024 * 1024,')
  })

  it('常量取值符合设计:全局 2MiB,媒体类上限均大于全局', () => {
    expect(GLOBAL_JSON_BODY_LIMIT).toBe(2 * 1024 * 1024)
    expect(MEDIA_BASE64_BODY_LIMIT).toBe(34 * 1024 * 1024)
    expect(MEDIA_FILE_UPLOAD_BODY_LIMIT).toBe(26 * 1024 * 1024)
    expect(FILE_UPLOAD_BODY_LIMIT).toBe(100 * 1024 * 1024 + 1024 * 1024)
    expect(SMALL_IMAGE_UPLOAD_BODY_LIMIT).toBe(3 * 1024 * 1024)
    for (const v of [
      MEDIA_BASE64_BODY_LIMIT,
      MEDIA_FILE_UPLOAD_BODY_LIMIT,
      FILE_UPLOAD_BODY_LIMIT,
      SMALL_IMAGE_UPLOAD_BODY_LIMIT,
    ]) {
      expect(v).toBeGreaterThan(GLOBAL_JSON_BODY_LIMIT)
    }
  })
})

// ───────────────────────── 2. 全量静态守卫(防新增遗漏) ─────────────────────────

describe('DDoS P2 — 媒体路由 bodyLimit 全覆盖', () => {
  it('凡请求体可能携带二进制媒体的路由都必须显式声明 bodyLimit', () => {
    const missing = scanMissingBodyLimits()
    const detail = missing
      .map((m) => `  ${m.file}:${m.line}  ${m.route}  [${m.kind}]`)
      .join('\n')
    expect(
      missing,
      missing.length === 0
        ? ''
        : `以下路由会因全局 ${GLOBAL_JSON_BODY_LIMIT / 1024 / 1024}MiB 被静默 413,` +
            `请从 src/config/body-limits.ts 取常量显式放开:\n${detail}`,
    ).toEqual([])
  })
})

// ───────────────────────── 3. 行为验证 ─────────────────────────

describe('DDoS P2 — bodyLimit 行为', () => {
  it('默认 JSON 路由 >2MiB 被 413,≤2MiB 放行;显式放开的路由可收远超全局的 body', async () => {
    const app = Fastify({ bodyLimit: GLOBAL_JSON_BODY_LIMIT })
    app.post('/default', async (req) => ({ len: JSON.stringify(req.body).length }))
    // 镜像"媒体路由显式放开"的形态(远大于全局)
    app.post('/media', { bodyLimit: MEDIA_BASE64_BODY_LIMIT }, async (req) => ({
      len: JSON.stringify(req.body).length,
    }))
    await app.ready()

    const ok = await app.inject({
      method: 'POST',
      url: '/default',
      payload: { x: 'a'.repeat(1 * 1024 * 1024) },
    })
    expect(ok.statusCode).toBe(200)

    const tooBig = await app.inject({
      method: 'POST',
      url: '/default',
      payload: { x: 'a'.repeat(3 * 1024 * 1024) },
    })
    expect(tooBig.statusCode).toBe(413)

    // 媒体路由:10MiB(远超 2MiB 全局、未越 34MiB 自身)必须放行 —— 证明上传不被误伤
    const mediaOk = await app.inject({
      method: 'POST',
      url: '/media',
      payload: { x: 'a'.repeat(10 * 1024 * 1024) },
    })
    expect(mediaOk.statusCode).toBe(200)

    await app.close()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
