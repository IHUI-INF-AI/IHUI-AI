// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `POST /api/rules/auto-generate` 的链路契约(2026-09-25 立项票)。
 *
 * 立项事实(四处断,逐处实测过):
 *  ① web 发 `body: {}` 而本端 schema 要 `userId` ⇒ 请求在 api 层就 400,从未出进程;
 *  ② 本端转发发的是驼峰 `{ userId }` 而上游 `AutoGenerateBody` 要 `user_id` ⇒ 422;
 *  ③ `RulesService.request()` 只带 `Content-Type`,从不带 `Authorization`,
 *     而 `/api/rules` 不在 ai-service 的 `PUBLIC_PATHS` ⇒ 401 被 catch 收成"降级返回空",
 *     现象是"生成不出草稿"而不是"报错";
 *  ④ 形状三方各一套:引擎 `[{pattern, draft_rule:{…}, confidence}]` / 本端 DTO 写
 *     `{drafts:[{draftRule:…}]}`(连 `draft_rule` 都是驼峰的错声明)/ web 读 `res.candidates`。
 * 这里钉的是修完后的四条契约 —— 每条都对应一处真实断法,不是"能编译"。
 *
 * 测试隔离(AGENTS.md §5):`fetch` 全程被 stub,**不发任何真实网络**,不碰生产 PG/Redis。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { rulesService } from '../src/services/rules-service.js'

const CALLER_TOKEN = 'Bearer caller-token-should-be-forwarded'
const SUBJECT = '11111111-2222-3333-4444-555555555555'

interface Captured {
  url: string
  init: RequestInit
}

let calls: Captured[] = []

function stubFetch(handler: () => { ok: boolean; status?: number; body?: unknown }) {
  globalThis.fetch = vi.fn(async (url: unknown, init: RequestInit = {}) => {
    calls.push({ url: String(url), init })
    const r = handler()
    return {
      ok: r.ok,
      status: r.status ?? 200,
      json: async () => r.body,
      text: async () => JSON.stringify(r.body ?? ''),
    }
  }) as unknown as typeof fetch
}

/** 上游真实形状(rules_engine.auto_generate_rules 逐字返回,router 原样塞进 data) */
const UPSTREAM_DRAFTS = [
  {
    pattern: '每次改样式都要求同步另一端',
    confidence: 0.82,
    draft_rule: {
      name: '跨端样式同源',
      description: '基于模式「每次改样式都要求同步另一端」自动生成',
      content: '改样式必须同步 web 与 miniapp',
      scope: 'global',
    },
  },
]

beforeEach(() => {
  calls = []
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('autoGenerateRules —— 出站点契约', () => {
  it('① 转发调用方令牌:Authorization 头逐字等于路由交下来的值', async () => {
    stubFetch(() => ({ ok: true, body: { code: 0, message: 'success', data: UPSTREAM_DRAFTS } }))
    await rulesService.autoGenerateRules(SUBJECT, CALLER_TOKEN)

    expect(calls).toHaveLength(1)
    const headers = calls[0]!.init.headers as Record<string, string>
    expect(headers['Authorization']).toBe(CALLER_TOKEN)
  })

  it('② 请求体用上游字段名 user_id,且不含任何驼峰身份键', async () => {
    stubFetch(() => ({ ok: true, body: { code: 0, message: 'success', data: UPSTREAM_DRAFTS } }))
    await rulesService.autoGenerateRules(SUBJECT, CALLER_TOKEN)

    const sent = JSON.parse(String(calls[0]!.init.body)) as Record<string, unknown>
    expect(sent).toEqual({ user_id: SUBJECT })
    expect(sent).not.toHaveProperty('userId')
  })

  it('③ 出口形状摊平成 candidates(与 web 消费的字段名一致)', async () => {
    stubFetch(() => ({ ok: true, body: { code: 0, message: 'success', data: UPSTREAM_DRAFTS } }))
    const out = await rulesService.autoGenerateRules(SUBJECT, CALLER_TOKEN)

    expect(out.degraded).toBeFalsy()
    expect(out.candidates).toHaveLength(1)
    expect(out.candidates[0]).toMatchObject({
      pattern: '每次改样式都要求同步另一端',
      confidence: 0.82,
      name: '跨端样式同源',
      content: '改样式必须同步 web 与 miniapp',
      scope: 'global',
      matchType: 'always',
    })
  })

  it('④ 上游不可达 → 降级为空 candidates 且不抛错(保留既有语义,字段名跟着换)', async () => {
    stubFetch(() => ({ ok: false, status: 401, body: { detail: 'Authentication required' } }))
    const out = await rulesService.autoGenerateRules(SUBJECT, undefined)

    expect(out).toEqual({ candidates: [], degraded: true })
    expect('drafts' in out).toBe(false)
  })

  it('⑤ 上游给了缺字段的垃圾条目时整条丢弃,不造出半个假候选', async () => {
    stubFetch(() => ({
      ok: true,
      body: {
        code: 0,
        message: 'success',
        data: [
          ...UPSTREAM_DRAFTS,
          { pattern: 'x', confidence: 0.9, draft_rule: { description: '没有 name 与 content' } },
          null,
        ],
      },
    }))
    const out = await rulesService.autoGenerateRules(SUBJECT, CALLER_TOKEN)
    expect(out.candidates.map((c) => c.name)).toEqual(['跨端样式同源'])
  })

  it('⑥ 不带令牌时不得凭空造一个 Authorization 头(否则把"缺身份"伪装成"有身份")', async () => {
    stubFetch(() => ({ ok: true, body: { code: 0, message: 'success', data: UPSTREAM_DRAFTS } }))
    await rulesService.autoGenerateRules(SUBJECT)
    const headers = (calls[0]!.init.headers ?? {}) as Record<string, string>
    expect('Authorization' in headers).toBe(false)
  })
})

describe('路由接线(装车证明:判据得落在真跑的入口上)', () => {
  const routeSrc = readFileSync(resolve(import.meta.dirname, '../src/routes/rules.ts'), 'utf8')
  const serviceSrc = readFileSync(
    resolve(import.meta.dirname, '../src/services/rules-service.ts'),
    'utf8',
  )
  const handler = routeSrc.slice(
    routeSrc.indexOf("server.post('/rules/auto-generate'"),
    routeSrc.indexOf("server.post('/rules/resolve-conflicts'"),
  )

  it('⑦ handler 身份取 request.userId,并把 request.headers.authorization 传下去', () => {
    expect(handler).toContain('rulesService.autoGenerateRules(')
    expect(handler).toContain('request.userId')
    expect(handler).toContain('request.headers.authorization')
  })

  it('⑧ 请求体不得再有身份键 schema(回到旧写法即红)', () => {
    expect(handler).not.toMatch(/ruleAutoGenerateSchema/)
    expect(routeSrc).not.toMatch(/ruleAutoGenerateSchema\s*=\s*z\.object/)
  })

  it('⑨ service 侧不得再回退到驼峰 body 或 drafts/candidates 之外的形状', () => {
    expect(serviceSrc).not.toMatch(/JSON\.stringify\(\{ userId \}\)/)
    expect(serviceSrc).toMatch(/candidates: RuleCandidateDto\[\]/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
