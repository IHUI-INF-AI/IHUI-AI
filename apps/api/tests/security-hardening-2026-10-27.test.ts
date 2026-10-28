// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 2026-10-27 安全加固轮的**回归锁**。
 *
 * 这一轮的漏洞有个共同形态:鉴权/归属判定"从来没写过",而不是"写错了"。这种缺口
 * 不会被类型检查发现,也不会有旧测试变红 —— 只会在下一次重构里悄悄长回来。
 * 所以这里做两件事:
 *   ① 行为断言:模型列表脱敏(唯一可直接单测的纯函数面);
 *   ② 接线锁:逐个钉住"这道闸必须存在"的语义令牌(不钉缩进/不钉行号,允许重排)。
 * 若某条闸被有意替换成别的实现,请同步改这里的令牌 —— 而不是删掉断言。
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { ModelManager } from '../src/services/clawdbot/models.js'

function src(rel: string): string {
  return readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), 'utf-8')
}

describe('ModelManager.listPublic —— 上游密钥不得明文出网', () => {
  it('list() 保留明文供服务内部调用,listPublic() 只留末 4 位指纹', () => {
    const mm = new ModelManager()
    mm.register({
      id: 'm1',
      name: 'M1',
      provider: 'openai',
      apiKey: 'sk-abcdefghijklmnop1234',
      maxTokens: 4096,
      temperature: 0.7,
      capabilities: ['chat'],
      enabled: true,
    })
    expect(mm.list()[0]?.apiKey).toBe('sk-abcdefghijklmnop1234')

    const pub = mm.listPublic()[0]
    expect(pub?.hasApiKey).toBe(true)
    expect(pub?.apiKey).toBe('****1234')
    expect(JSON.stringify(pub)).not.toContain('abcdefghijklmnop')
  })

  it('未配置密钥时不出 apiKey 字段', () => {
    const mm = new ModelManager()
    mm.register({
      id: 'm2',
      name: 'M2',
      provider: 'openai',
      maxTokens: 4096,
      temperature: 0.7,
      capabilities: ['chat'],
      enabled: true,
    })
    const pub = mm.listPublic()[0]
    expect(pub?.hasApiKey).toBe(false)
    expect(pub && 'apiKey' in pub).toBe(false)
  })
})

describe('接线锁 —— 本轮加固的每一道闸都必须在位', () => {
  it('课程审核路由整插件 requireAdmin(原为匿名 CRUD)', () => {
    const s = src('routes/edu-extended.ts')
    const plugin = s.slice(s.indexOf('const eduExtendedRoutes'))
    expect(plugin).toContain("addHook('preHandler', requireAdmin)")
  })

  it('coze-oauth 整插件 requireAdmin + base_url 官方域名白名单', () => {
    const s = src('routes/coze-oauth.ts')
    expect(s).toContain("server.addHook('preHandler', requireAdmin)")
    expect(s).toContain('baseUrlField')
    expect(s).toContain('COZE_BASE_URL_HOSTS')
  })

  it('/crew/models 需登录且走脱敏视图', () => {
    const s = src('routes/crew.ts')
    const at = s.indexOf("server.get('/models'")
    expect(at).toBeGreaterThan(-1)
    const block = s.slice(at, at + 400)
    expect(block).toContain('requireAuth')
    expect(block).toContain('listPublic()')
  })

  it('clawdbot 模型列表走脱敏视图', () => {
    expect(src('routes/clawdbot.ts')).toContain('listPublic()')
  })

  it('legacy OSS:删除要管理员 + fileId 形态白名单,base64 走 safeFetch', () => {
    const s = src('routes/legacy-oss.ts')
    expect(s).toContain('[authenticate, requireAdmin]')
    expect(s).toContain('SAFE_FILE_ID')
    expect(s).toContain('safeFetch')
  })

  it('租户路由:每个跨租户读写在查库前都过 guardTenantAccess', () => {
    const s = src('routes/tenant.ts')
    // 8 个跨租户端点里,除 POST /(创建)与 DELETE /:id(已有 owner 判定)外都要过闸
    expect(s.match(/guardTenantAccess\(request, reply, id/g)?.length ?? 0).toBeGreaterThanOrEqual(6)
    expect(s).toContain('isSystemAdmin(request, { includeInternalChannel: false })')
  })

  it('直播订阅以令牌主体为准,不再信任 body/query 的 userId', () => {
    const s = src('routes/legacy-live.ts')
    expect(s).toContain('const principal = request.userId')
    expect(s).not.toContain('userId: body.userId')
    expect(s).not.toContain('subscriptions.userId, userId')
  })

  it('证书签发/吊销要管理员', () => {
    const s = src('routes/user/resources-routes.ts')
    expect(s.match(/preHandler: \[requireAdmin\]/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
  })

  it('T-BOX 回调 fail-closed(密钥未配即 503)', () => {
    const s = src('routes/tbox.ts')
    // 只看"真代码行":注释里提到旧写法不算
    expect(s).not.toMatch(/^\s*if \(secret\) \{/m)
    expect(s.match(/^\s*if \(!secret\) \{/gm)?.length ?? 0).toBe(2)
  })

  it('文档内容:DB 分支只认单段 slug 且只放 published', () => {
    const s = src('routes/feature-center.ts')
    expect(s).toContain('if (normalized === dbSlug)')
    expect(s).toContain("hit.status === 'published'")
  })

  it('公开排行榜不再下发邀请码', () => {
    const s = src('routes/miniapp-compat-routes.ts')
    const at = s.indexOf("server.get('/ranking'")
    expect(at).toBeGreaterThan(-1)
    expect(s.slice(at, at + 700)).not.toContain('inviteCode')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
