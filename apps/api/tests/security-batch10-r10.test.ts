// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 安全强化第 10 批 R10 回归锁（2026-10-31）。
 *
 * 本批修的是"第三轮侦察"新发现的三枚真实漏洞 + 一枚纵深防御：
 *
 *  R10-1【P0 账号接管】`POST /oauth/jwt/token` 完全未验签即签发任意用户令牌。
 *        该端点把 assertion 当"base64 里有个 sub"来读：不验签名、不校验 iss/aud/alg，
 *        `client_secret` 还是 optional（不传就跳过比对）。而 `POST /oauth/register` 是
 *        匿名可用的 DCR ⇒ 任何人注册一个 app、提交
 *        `a.<b64url({"sub":"<victim>"})>.c` 就能换到受害者（含管理员）的 access+refresh。
 *        根因是本仓 `oauth_apps` 表**没有公钥/JWKS 字段**（packages/database/src/schema/
 *        oauth.ts），没有验签材料，RFC 7523 语义无法实现 ⇒ 唯一正确处置是下线该端点。
 *
 *  R10-2【P0 同源 XSS】`GET /api/ai-feed/image-proxy` 免鉴权透传 `image/svg+xml`。
 *        此前只判 `^image/`；SVG 内 <script> 在顶层导航时以 api 域同源执行。
 *
 *  R10-3【P1 未受限上传】`POST /chunked-upload/merge` 合并产物零内容校验。
 *        `fileMd5` 可选 ⇒ 不声明就完全不看内容，任意二进制进 `uploads/public`。
 *
 *  R10-4【P2 纵深】文档资产抽取把 `image/svg+xml` 落成 `.svg` 进公开目录。
 *
 * 判据纪律：MIME / 魔数 / 词表判据一律 import 生产实现，本文件不复制任何一份
 * （AGENTS.md §0.6）；源码级断言只钉"接线是否还在"，不重写行为逻辑。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { isAllowedProxyImageMime } from '../src/services/ai-feed-service.js'
import { validateUploadHead, validateUploadFile } from '../src/utils/file-type-validator.js'
import { UPLOAD_SESSION_STATUS, UPLOAD_SESSION_TERMINAL_STATUSES } from '@ihui/database'

/** 仓库根由本文件位置推导（三层：tests → api → apps → 根），不用 cwd。 */
const ROOT = new URL('../../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const read = (...rel: string[]) => readFileSync(resolve(ROOT, ...rel), 'utf8')

// ---------------------------------------------------------------------------
// R10-1 OAuth jwt-bearer 下线
// ---------------------------------------------------------------------------
describe('R10-1 /oauth/jwt/token 不再用未验签 assertion 签发令牌', () => {
  const src = read('apps', 'api', 'src', 'routes', 'auth-extended.ts')

  /** 取出 `/oauth/jwt/token` 这个 handler 的源码段（到下一个 server.post/get 为止）。 */
  function handlerSource(): string {
    const start = src.indexOf("server.post('/oauth/jwt/token'")
    expect(start, '找不到 /oauth/jwt/token 路由（被删或改名，需同步本测试）').toBeGreaterThan(-1)
    const rest = src.slice(start + 10)
    const nextRoute = rest.search(/\n\s*server\.(post|get|put|delete|patch)\(/)
    return nextRoute === -1 ? rest : rest.slice(0, nextRoute)
  }

  it('handler 内不得出现令牌签发（buildTokenPair 是唯一签发口）', () => {
    expect(handlerSource()).not.toContain('buildTokenPair')
  })

  it('handler 内不得解码未验签的 assertion payload', () => {
    const body = handlerSource()
    // 曾用 `Buffer.from(parts[1]!, 'base64url')` 取 sub —— 无签名校验的 sub 不可信
    expect(body).not.toContain("Buffer.from(parts[1]")
    expect(body).not.toContain('payloadJson')
  })

  it('handler 必须显式回 501（能力缺失，而非 404 迷雾）', () => {
    const body = handlerSource()
    expect(body).toContain('501')
    expect(body).toContain('jwt-bearer 授权未启用')
  })

  it('被拒时必须留审计（取证谁还在试），但 detail 不得包含攻击者自选的 sub', () => {
    const body = handlerSource()
    expect(body).toContain('createAuditLog')
    expect(body).toContain("status: 'blocked'")
    // 审计里不能出现 userId: —— 未验签的 sub 不是"某人"，写进去会污染取证
    expect(body).not.toContain('userId:')
  })

  it('下线理由必须写在代码里（表无公钥字段 ⇒ 无法验签），防后来者"顺手补回"', () => {
    expect(src).toContain('jwt_bearer_unsupported_no_client_jwks')
    expect(src).toMatch(/oauth_apps[\s\S]{0,200}公钥|公钥[\s\S]{0,200}oauth_apps/)
  })
})

// ---------------------------------------------------------------------------
// R10-2 image-proxy 拒绝 SVG
// ---------------------------------------------------------------------------
describe('R10-2 图片代理 MIME 白名单只放位图', () => {
  it('SVG 被拒（同源 XSS 的载体）', () => {
    expect(isAllowedProxyImageMime('image/svg+xml')).toBe(false)
    expect(isAllowedProxyImageMime('image/svg+xml; charset=utf-8')).toBe(false)
    expect(isAllowedProxyImageMime('IMAGE/SVG+XML')).toBe(false)
  })

  it('其它可承载脚本/文档的类型也被拒', () => {
    for (const t of [
      'text/html',
      'application/xhtml+xml',
      'text/xml',
      'application/xml',
      'image/x-icon-script',
      '',
    ]) {
      expect(isAllowedProxyImageMime(t), t).toBe(false)
    }
  })

  it('位图放行，且带 charset / 大小写变体同样放行（不误伤正常图床）', () => {
    for (const t of [
      'image/png',
      'image/jpeg',
      'image/gif',
      'image/webp',
      'image/avif',
      'image/bmp',
      'image/x-icon',
      'IMAGE/PNG',
      'image/jpeg; charset=binary',
    ]) {
      expect(isAllowedProxyImageMime(t), t).toBe(true)
    }
  })

  it('路由层补了 CSP sandbox + nosniff（第二道，防白名单将来被放宽）', () => {
    const route = read('apps', 'api', 'src', 'routes', 'ai-feed.ts')
    const start = route.indexOf("server.get('/image-proxy'")
    expect(start).toBeGreaterThan(-1)
    const body = route.slice(start, start + 1600)
    expect(body).toContain("Content-Security-Policy")
    expect(body).toContain('sandbox')
    expect(body).toContain('X-Content-Type-Options')
    expect(body).toContain('nosniff')
  })
})

// ---------------------------------------------------------------------------
// R10-3 分片合并内容类型闸
// ---------------------------------------------------------------------------
describe('R10-3 分片合并产物必须过内容类型闸', () => {
  const PNG_HEAD = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
  const EXE_HEAD = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]) // MZ

  it('合法 PNG 通过（正向对照，证明闸不是恒拒）', () => {
    const v = validateUploadHead(PNG_HEAD, 'photo.png', 'image/png')
    expect(v.ok).toBe(true)
    if (v.ok) expect(v.mimeType).toBe('image/png')
  })

  it('改名成 .png 的可执行文件被拒（魔数不符）', () => {
    const v = validateUploadHead(EXE_HEAD, 'photo.png', 'image/png')
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.reason).toContain('magic number')
  })

  it('扩展名不在白名单即拒（任意二进制无法借分片通道落盘）', () => {
    for (const name of ['payload.exe', 'payload.sh', 'payload.html', 'payload.svg', 'noext']) {
      const v = validateUploadHead(EXE_HEAD, name, '')
      expect(v.ok, name).toBe(false)
    }
  })

  it('MIME 与扩展名不一致即拒', () => {
    const v = validateUploadHead(PNG_HEAD, 'photo.png', 'application/octet-stream')
    expect(v.ok).toBe(false)
    if (!v.ok) expect(v.reason).toContain('不匹配')
  })

  it('未声明 MIME 时跳过一致性判但**仍验魔数**（大文件客户端常不发 Content-Type）', () => {
    expect(validateUploadHead(PNG_HEAD, 'photo.png', '').ok).toBe(true)
    const bad = validateUploadHead(EXE_HEAD, 'photo.png', '')
    expect(bad.ok).toBe(false)
  })

  it('无固定魔数的纯文本类型放行（txt/csv 不误伤）', () => {
    expect(validateUploadHead(Buffer.from('a,b,c\n1,2,3\n'), 'data.csv', 'text/csv').ok).toBe(true)
  })

  it('validateUploadFile 与 validateUploadHead 判据同源（前者只多一层大小闸）', () => {
    // 同输入同结论：头部判据一致
    expect(validateUploadFile(PNG_HEAD, 'a.png', 'image/png').ok).toBe(
      validateUploadHead(PNG_HEAD, 'a.png', 'image/png').ok,
    )
    expect(validateUploadFile(EXE_HEAD, 'a.png', 'image/png').ok).toBe(false)
    // 后者不看大小：超过 MAX_UPLOAD_SIZE 的头部片段照样只按内容判
    const bigHead = Buffer.concat([PNG_HEAD, Buffer.alloc(64)])
    expect(validateUploadHead(bigHead, 'a.png', 'image/png').ok).toBe(true)
  })

  it('merge 路由已接线：内容闸在 checksum 之后、chunks 清理之前', () => {
    const route = read('apps', 'api', 'src', 'routes', 'chunked-upload.ts')
    const mergeStart = route.indexOf("server.post('/chunked-upload/merge'")
    expect(mergeStart).toBeGreaterThan(-1)
    const body = route.slice(mergeStart)

    const checksumAt = body.indexOf('digestMatches(session.fileMd5')
    const contentAt = body.indexOf('validateUploadHead(')
    const cleanupAt = body.indexOf('rmSync(chunkDir')
    expect(checksumAt).toBeGreaterThan(-1)
    expect(contentAt).toBeGreaterThan(checksumAt)
    expect(cleanupAt).toBeGreaterThan(contentAt)

    // 拒绝时必须清理已合并文件 + 置终态，绝不"记条日志继续交付"
    expect(body).toContain('STATUS_CONTENT_REJECTED')
    expect(body).toContain('415')
  })

  it('content_rejected 是终态（不会被 reaper 当可回收误删取证行）', () => {
    expect(Object.values(UPLOAD_SESSION_STATUS)).toContain(
      UPLOAD_SESSION_STATUS.contentRejected,
    )
    expect(UPLOAD_SESSION_TERMINAL_STATUSES).toContain(UPLOAD_SESSION_STATUS.contentRejected)
  })
})

// ---------------------------------------------------------------------------
// R10-4 文档资产不落 .svg
// ---------------------------------------------------------------------------
describe('R10-4 文档资产抽取不再把 SVG 落成 .svg 进公开目录', () => {
  it('MEDIA_EXTENSIONS 中 image/svg+xml 不映射为 .svg', () => {
    const src = read('apps', 'api', 'src', 'services', 'markdown-converter-service.ts')
    const start = src.indexOf('const MEDIA_EXTENSIONS')
    expect(start).toBeGreaterThan(-1)
    const block = src.slice(start, src.indexOf('}', start))
    expect(block).not.toContain("'image/svg+xml': '.svg'")
    expect(block).toContain("'image/svg+xml': '.img'")
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
