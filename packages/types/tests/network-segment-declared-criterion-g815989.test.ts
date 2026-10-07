// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * G-815989 成文判据(机器可判,非仅注释):敏感路由前缀的网络分段声明。
 *
 * 【默认档(拍板①:维持保守默认)】未显式声明网络分段(`config.network`)的路由,
 * 按**公网可达**处理 —— 这是成文语义,不是 bug:
 *   - `apps/api/src/plugins/network-segment.ts` 的 preHandler 对没有 `config.network`
 *     的路由直接放行(`if (!networkConfig) return`),`allowInternal/allowExternal`
 *     缺省为 `?? true`;
 *   - 判据把这条默认档钉在源码上:谁把它静默改成 deny-by-default(把自己关在门外),
 *     或静默改成"无声明也强制分段",这里必须先红。
 *
 * 【声明面(拍板②:敏感前缀必须显式声明)】`server.ts` 的 onRoute 钩子按前缀显式注入:
 *   - `/api/admin` 族:`network.allowExternal:false` + mTLS(强制内网);
 *   - `SENSITIVE_BUSINESS_PREFIXES`(auth/users/wallet/...):`allowExternal:true`
 *     (允许公网,但启用分段,strict 模式拒 unknown IP);
 *   - `PUBLIC_PREFIXES`:显式声明为公网可达,不注入。
 *   判据:注册**前缀**的路径段落在敏感清单(admin / internal / report / export)内的,
 *   必须被上述声明面覆盖 —— 现读 **0 未声明**。分段判定与 onRoute 钩子同口径
 *   (路径段精确匹配;`/api/admin-saas` 是独立前缀族,段名不是 `admin`,钩子本就不管它)。
 *
 * 【绝对路径存量(判据的清单化残留)】不经 prefix 注册、以绝对路径字面量注册的敏感路由,
 * 现存恰有一条未声明:`/api/internal/user-broadcast/mcp-status`(D154,由
 * `checkInternalServiceToken` 验票防护,网络分段声明属残留待补 —— 修复需改 apps/api,
 * 另票处理)。判据把**存量清单**钉死:多一条未声明的绝对路径敏感路由 ⇒ 红;
 * 这条补了声明 ⇒ 清单须同步收缩 ⇒ 也红(强制过人),不许静默漂移。
 *
 * 【已知的扫描边界】只认 `server.<method>(` 注册位与注册前缀字面量;`server.route({ url })`
 * 形态现存全为相对路径,若未来引入绝对 /api 路径须并入本判据;测试文件(__tests__/*.test.ts)
 * 不在扫描面。
 */
const REPO = resolve(__dirname, '../../..')
const API_SRC = join(REPO, 'apps/api/src')

const SENSITIVE_SEGMENTS = new Set(['admin', 'internal', 'report', 'export'])
const KNOWN_UNDECLARED_ABSOLUTE = ['/api/internal/user-broadcast/mcp-status']

function readSrc(rel: string): string {
  return readFileSync(join(API_SRC, rel), 'utf8')
}

function extractListEntries(src: string, listName: string): string[] {
  const block = src.match(new RegExp(`const ${listName} = \\[([\\s\\S]*?)\\]`))
  if (!block) return []
  return [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
}

function segmentsOf(url: string): string[] {
  return url.split('/').filter(Boolean).map((s) => s.toLowerCase())
}

function isSensitive(url: string): boolean {
  return segmentsOf(url).some((s) => SENSITIVE_SEGMENTS.has(s))
}

/** 与 server.ts onRoute 钩子同口径的"已显式声明"判定(admin 分支 + 两份注入清单)。 */
function isDeclared(url: string, publicPrefixes: string[], sensitivePrefixes: string[]): boolean {
  if (url === '/api/admin' || url.startsWith('/api/admin/')) return true
  const lists = [...publicPrefixes, ...sensitivePrefixes]
  return lists.some((p) => url.startsWith(p) || p.startsWith(url))
}

function walkRouteFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === '.ihui-agent') continue
      out.push(...walkRouteFiles(full))
    } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
      out.push(full)
    }
  }
  return out
}

describe('G-815989 / 默认档语义钉子(未显式声明 ⇒ 公网可达,维持保守默认)', () => {
  const plugin = readSrc('plugins/network-segment.ts')

  it('preHandler 对没有 config.network 的路由直接放行(未声明 ⇒ 不强制分段)', () => {
    expect(plugin).toContain('if (!networkConfig) return')
  })

  it('allowInternal / allowExternal 缺省档保持 ?? true(不得静默改 deny-by-default)', () => {
    expect(plugin).toContain('networkConfig.allowInternal ?? true')
    expect(plugin).toContain('networkConfig.allowExternal ?? true')
  })
})

describe('G-815989 / 显式声明面钉子(server.ts onRoute 注入)', () => {
  const serverTs = readSrc('server.ts')

  it('admin 分支存在:强制内网(allowExternal:false)+ mTLS', () => {
    expect(serverTs).toContain('network: existingConfig.network ?? { allowExternal: false }')
    expect(serverTs).toMatch(/mtls:\s*existingConfig\.mtls \?\? \{ required:/)
  })

  it('两份注入清单可解析且非空', () => {
    expect(extractListEntries(serverTs, 'PUBLIC_PREFIXES').length).toBeGreaterThan(0)
    expect(extractListEntries(serverTs, 'SENSITIVE_BUSINESS_PREFIXES').length).toBeGreaterThan(0)
  })
})

describe('G-815989 / 前缀级判据:敏感前缀必须落在声明面(现读 0 未声明)', () => {
  it('所有注册前缀中,路径段命中敏感清单的都必须已显式声明', () => {
    const serverTs = readSrc('server.ts')
    const routesIndex = readSrc('routes/index.ts')
    const publicPrefixes = extractListEntries(serverTs, 'PUBLIC_PREFIXES')
    const sensitivePrefixes = extractListEntries(serverTs, 'SENSITIVE_BUSINESS_PREFIXES')

    const prefixes = [...serverTs.matchAll(/\{\s*prefix:\s*'([^']+)'/g), ...routesIndex.matchAll(/\{\s*prefix:\s*'([^']+)'/g)].map(
      (m) => m[1],
    )
    expect(prefixes.length, '注册前缀字面量解析不能为空').toBeGreaterThan(0)

    const undeclared = prefixes.filter((p) => isSensitive(p) && !isDeclared(p, publicPrefixes, sensitivePrefixes))
    expect(
      undeclared,
      `敏感前缀未显式声明网络分段(判据:落在 admin/internal/report/export 清单的前缀,` +
        `须被 onRoute admin 分支 / SENSITIVE_BUSINESS_PREFIXES / PUBLIC_PREFIXES 覆盖):${undeclared.join(', ')}`,
    ).toEqual([])
  })
})

describe('G-815989 / 绝对路径级判据:未声明的敏感绝对路径必须逐条在案', () => {
  it('现存未声明绝对路径敏感路由 = 已知存量清单(多一条/少一条都判红)', () => {
    const serverTs = readSrc('server.ts')
    const publicPrefixes = extractListEntries(serverTs, 'PUBLIC_PREFIXES')
    const sensitivePrefixes = extractListEntries(serverTs, 'SENSITIVE_BUSINESS_PREFIXES')

    const found: string[] = []
    for (const file of walkRouteFiles(join(API_SRC, 'routes'))) {
      const src = readFileSync(file, 'utf8')
      // 只认 server.<method>( 注册位的绝对路径字面量(现网 server.route({ url }) 全为相对路径)。
      for (const m of src.matchAll(/server\.(?:get|post|put|delete|patch|options|head|all)\s*\(\s*'([^']+)'/g)) {
        const url = m[1]
        if (url.startsWith('/api/') && isSensitive(url) && !isDeclared(url, publicPrefixes, sensitivePrefixes)) {
          found.push(url)
        }
      }
    }

    const known = [...KNOWN_UNDECLARED_ABSOLUTE].sort()
    const actual = [...new Set(found)].sort()
    expect(
      actual,
      '与已知存量清单不符:多出的=新敏感路由忘了声明(补 config.network 或过人来登记);' +
        `少的=存量已补声明(请同步收缩 KNOWN_UNDECLARED_ABSOLUTE)。发现:${actual.join(', ')}`,
    ).toEqual(known)
  })
})
