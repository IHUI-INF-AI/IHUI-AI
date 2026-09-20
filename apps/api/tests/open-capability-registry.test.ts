// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * O6 能力开放登记表单测(纯函数,不碰 DB / Redis / HTTP)。
 *
 * 锁四件事:
 * 1. 登记表里每条 scope 都在能力目录里、且目录此刻仍允许机器凭据(漂移即红);
 * 2. platform / thirdPartyEligible=false 的 scope 挡得住 —— 编译期与运行期各一道;
 * 3. 匹配是**默认拒绝**:表外路径、方法不符、/v1 协议面一律拿不到条目;
 * 4. 派生给 `requireCapabilityRules` 的规则表按字面量长度降序,
 *    写操作端点不会被关闭后的只读 scope 吃掉。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  CAPABILITY_CATALOG,
  effectiveDataClass,
  getCapability,
  isM2MAllowed,
  type ApiKeyPermission,
} from '@ihui/types'
import {
  assertScopeOpenable,
  findOpenCapability,
  openCapabilityEntries,
  openCapabilityRules,
  type OpenableCapabilityScope,
} from '../src/config/open-capability-registry.js'

// tests/ → apps/api/ → 仓库根
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

describe('open-capability-registry 与能力目录的一致性', () => {
  const entries = openCapabilityEntries()

  it('登记表非空,且条目主键唯一', () => {
    expect(entries.length).toBeGreaterThan(0)
    const keys = entries.map((e) => e.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('每条 scope 都在能力目录内、dataClass 与目录派生一致、且此刻仍允许机器凭据', () => {
    for (const entry of entries) {
      const catalog = getCapability(entry.scope)
      expect(catalog, `scope ${entry.scope} 未登记`).toBeDefined()
      expect(entry.capability).toBe(catalog)
      expect(entry.dataClass).toBe(effectiveDataClass(catalog!))
      expect(entry.dataClass).not.toBe('platform')
      expect(catalog!.thirdPartyEligible).toBe(true)
      expect(isM2MAllowed(entry.scope)).toBe(true)
    }
  })

  it('只登记 /api/* 业务面(/v1 协议面归各路由就地闸口)', () => {
    for (const entry of entries) {
      expect(entry.paths.length).toBeGreaterThan(0)
      for (const path of entry.paths) expect(path.startsWith('/api/')).toBe(true)
    }
  })
})

describe('open-capability-registry 拒绝不可开放的 scope', () => {
  const forbidden = CAPABILITY_CATALOG.filter((e) => !isM2MAllowed(e.scope))

  it('目录里确实存在不可对机器开放的 scope(否则本测试失去意义)', () => {
    expect(forbidden.length).toBeGreaterThan(0)
  })

  it('凡 isM2MAllowed=false 的 scope,运行期登记一律抛错', () => {
    for (const entry of forbidden) {
      expect(
        () => assertScopeOpenable(entry.scope as ApiKeyPermission, 'probe'),
        `${entry.scope}(dataClass=${entry.dataClass}) 不该能登记`,
      ).toThrow(/不可对机器凭据开放|thirdPartyEligible=false|isM2MAllowed=false/)
    }
  })

  it('登记表里没有任何 platform / 不可第三方开放的 scope', () => {
    const scopes = openCapabilityEntries().map((e) => e.scope)
    const leaked = scopes.filter((s) => !isM2MAllowed(s))
    expect(leaked).toEqual([])
  })

  it('编译期护栏:platform scope 不属于 OpenableCapabilityScope 字面量联合', () => {
    // @ts-expect-error publish:operate 属 platform,不在可开放闭包的字面量联合内
    const blocked: OpenableCapabilityScope = 'publish:operate'
    void blocked
  })
})

describe('findOpenCapability 默认拒绝', () => {
  it('登记表内条目命中', () => {
    expect(findOpenCapability('GET', '/api/v1/tools/list')?.scope).toBe('tools:read')
    expect(findOpenCapability('GET', '/api/skills')?.scope).toBe('skills:read')
    expect(findOpenCapability('POST', '/api/v1/codebase/search')?.scope).toBe('codebase:read')
    expect(findOpenCapability('DELETE', '/api/v1/codebase/repo/7/files')?.scope).toBe(
      'codebase:write',
    )
  })

  it('query 串与大小写不影响匹配(调用方已剥 query,此处只验方法大小写)', () => {
    expect(findOpenCapability('get', '/api/v1/tools/list')?.scope).toBe('tools:read')
  })

  it('方法不符即拒绝(表里只开了 GET)', () => {
    expect(findOpenCapability('DELETE', '/api/v1/tools/list')).toBeUndefined()
    expect(findOpenCapability('POST', '/api/skills')).toBeUndefined()
  })

  it('表外 /api 路由一律拿不到条目 —— 携带 API Key 也不会被放行', () => {
    for (const path of [
      '/api/users/me',
      '/api/admin/users',
      '/api/chat/completions',
      '/api/wallet/balance',
      '/api/v1/tools',
      '/api/v1/customer_service_x/ticket/9',
    ]) {
      expect(findOpenCapability('GET', path), `${path} 不该在登记表里`).toBeUndefined()
    }
  })

  it('同路径换方法即拒(表里只开了 GET,方法不因枚举而放宽)', () => {
    // tools / content / customer_service 三个只读族都是 GET-only
    expect(findOpenCapability('POST', '/api/v1/tools/list')?.scope).toBeUndefined()
    expect(findOpenCapability('DELETE', '/api/v1/customer_service/ticket/9')).toBeUndefined()
    expect(findOpenCapability('DELETE', '/api/v1/customer_service/ticket/9/replies')).toBeUndefined()
    expect(findOpenCapability('DELETE', '/api/skills')).toBeUndefined()
  })

  it('写条目与同族只读条目各按精确/参数化路径命中(通配已废弃,不存在吞并问题)', () => {
    expect(findOpenCapability('GET', '/api/v1/customer_service/ticket/t-1/close')?.scope).toBe(
      'messages:write',
    )
    expect(findOpenCapability('GET', '/api/v1/customer_service/ticket')?.scope).toBe(
      'messages:read',
    )
    // 未登记的同族路径(如复数 tickets,现实无此注册点)不再被前缀继承放行
    expect(findOpenCapability('GET', '/api/v1/customer_service/tickets')).toBeUndefined()
  })

  it('/v1 协议面不经本表(避免与 capability-guard 就地闸口抢判定)', () => {
    expect(findOpenCapability('POST', '/v1/chat/completions')).toBeUndefined()
  })

  it('close 是写操作,单独成条命中 messages:write(只读族逐条枚举,不会覆盖 close 路径)', () => {
    const hit = findOpenCapability('GET', '/api/v1/customer_service/ticket/42/close')
    expect(hit?.scope).toBe('messages:write')
    expect(hit?.key).toBe('v1-customer-service-close')
    // 同族的其它路径仍归只读 scope
    expect(findOpenCapability('GET', '/api/v1/customer_service/ticket/42')?.scope).toBe(
      'messages:read',
    )
  })
})

describe('openCapabilityRules 派生规则表', () => {
  it('未登记的条目主键立即抛错(登记表与路由代码漂移挡在启动期)', () => {
    expect(() =>
      openCapabilityRules('v1-tools-directory' as never, 'does-not-exist' as never),
    ).toThrow(/未登记的开放条目/)
  })

  it('规则表首个命中项与 findOpenCapability 给出同一个 scope(两处判定不错位)', () => {
    const rules = openCapabilityRules(
      'v1-customer-service-read',
      'v1-customer-service-close',
      'codebase-search',
      'codebase-write',
    )
    const probe = (method: string, path: string): string | undefined => {
      const upper = method.toUpperCase()
      return rules.find(
        (r) => (!r.methods || r.methods.includes(upper)) && r.pattern.test(path),
      )?.scope
    }
    for (const [method, path] of [
      ['GET', '/api/v1/customer_service/ticket/42/close'],
      ['GET', '/api/v1/customer_service/ticket/42/replies'],
      ['GET', '/api/v1/customer_service/messages/read'],
      ['DELETE', '/api/v1/codebase/repo/7/files'],
      ['POST', '/api/v1/codebase/index'],
      ['GET', '/api/v1/codebase/stats'],
    ] as const) {
      const registry = findOpenCapability(method, path)
      expect(registry, `${method} ${path} 应命中登记表`).toBeDefined()
      expect(probe(method, path), `${method} ${path}`).toBe(registry?.scope)
    }
    // 写端点必须落在 messages:write(精确/参数化路径逐条命中,无通配兜底)
    expect(probe('GET', '/api/v1/customer_service/ticket/42/close')).toBe('messages:write')
    // 两处判定对未登记前缀一致拒绝
    expect(probe('GET', '/api/v1/widgets/anything')).toBeUndefined()
    expect(findOpenCapability('GET', '/api/v1/widgets/anything')).toBeUndefined()
  })

  it('规则表能被 requireCapabilityRules 语义直接消费(scope 均已在目录登记)', () => {
    for (const rule of openCapabilityRules('codebase-search', 'codebase-write')) {
      expect(isM2MAllowed(rule.scope)).toBe(true)
      expect(rule.pattern).toBeInstanceOf(RegExp)
    }
  })
})

describe('遗留 /api/v1 桩的收口形态(源码级契约,防 declareCapability 回潮)', () => {
  const STUB_FILES: Array<[string, string]> = [
    ['apps/api/src/routes/other/v1-tools-routes.ts', 'v1-tools-directory'],
    ['apps/api/src/routes/other/v1-content-routes.ts', 'v1-content-catalog'],
    ['apps/api/src/routes/other/v1-customer-service-routes.ts', 'v1-customer-service-read'],
  ]

  for (const [rel, key] of STUB_FILES) {
    it(`${rel.split('/').pop()} 用 requireOpenCapability + 登记表规则,不再 declareCapability`, () => {
      const source = readFileSync(resolve(REPO_ROOT, rel), 'utf8')
      expect(source).toContain('requireOpenCapability(')
      expect(source).toContain('requireCapabilityRules(')
      expect(source).toContain(`openCapabilityRules('${key}'`)
      expect(source).not.toContain('declareCapability(')
    })
  }
})
