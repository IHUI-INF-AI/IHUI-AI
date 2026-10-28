// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * IP 白名单生效链的**覆盖率断言** —— 它的价值不在今天这条绿，而在将来有人新加一条
 * 登录腿却没挂闸门时它会响。默认判据是"没登记就红"，不是"没登记就放过"。
 *
 * 取材面 = 工作树源码文本（本仓测试对源码文本的一贯口径，不连库）。
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const API_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..') // apps/api
const ROUTES_DIR = join(API_ROOT, 'src', 'routes')

/** 会产出"可用于访问平台"的令牌的签发出口；新增原语必须同批登记到这里。 */
const ISSUANCE_IDENTIFIERS = [
  'buildTokenPair',
  'issueTokenPair',
  'signAccessToken',
  'signRefreshToken',
  'signM2MAccessToken',
  'signIdToken',
] as const

/** 闸门调用点；新增登录腿只有两种结局：挂上它，或进下面的豁免清单并写明理由。 */
const GUARD_CALL = 'gateLoginIpWhitelist('

export type IssuanceSite = {
  file: string
  /** 稳定身份 = 所在路由路径或所在具名函数（不靠行号，行号一次 append 就挪位） */
  anchor: string
  line: number
  identifier: string
  guarded: boolean
}

/** 遮掉注释与 import —— 注释里提到 buildTokenPair 不算一个签发点。 */
function codeLines(source: string): (string | null)[] {
  const raw = source.split(/\r?\n/)
  let inBlockComment = false
  let inImport = false
  return raw.map((line) => {
    const trimmed = line.trim()
    if (inBlockComment) {
      if (trimmed.includes('*/')) inBlockComment = false
      return null
    }
    if (inImport) {
      if (/\bfrom\s+['"]/.test(trimmed)) inImport = false
      return null
    }
    if (trimmed.startsWith('/*')) {
      if (!trimmed.includes('*/')) inBlockComment = true
      return null
    }
    if (/^import\b/.test(trimmed)) {
      if (!/\bfrom\s+['"]/.test(trimmed)) inImport = true
      return null
    }
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return null
    return line
  })
}

function collectTsFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    if (name === '__tests__' || name === 'node_modules') continue
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) out.push(...collectTsFiles(full))
    else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) out.push(full)
  }
  return out
}

const ROUTE_ANCHOR = /\b(?:server|fastify|app)\.(post|get|put|delete|patch|route)\s*\(/
const FN_ANCHOR = /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)/

/** 往上找最近的锚点：路由路径字面量优先，其次是具名函数（签发常在 helper 里）。 */
function findAnchor(lines: (string | null)[], from: number): { label: string; at: number } {
  for (let i = from; i >= 0; i--) {
    const line = lines[i]
    if (line === null) continue
    const route = ROUTE_ANCHOR.exec(line)
    if (route) {
      const method = route[1]!.toUpperCase()
      const sameLine = /['"`](\/[^'"`]+)['"`]/.exec(line.slice(route.index))
      let path = sameLine?.[1]
      if (!path) {
        for (let j = i + 1; j <= i + 4 && j < lines.length; j++) {
          const next = lines[j]
          if (next === null) continue
          const m = /^\s*['"`](\/[^'"`]+)['"`]/.exec(next)
          if (m) {
            path = m[1]
            break
          }
          if (ROUTE_ANCHOR.test(next)) break
        }
      }
      return { label: `${method} ${path ?? '(anonymous)'}`, at: i }
    }
    const fn = FN_ANCHOR.exec(line)
    if (fn) return { label: `fn:${fn[1]}`, at: i }
  }
  return { label: 'fn:<file-top>', at: 0 }
}

export function collectIssuanceSites(source: string, relFile: string): IssuanceSite[] {
  const lines = codeLines(source)
  const sites: IssuanceSite[] = []
  lines.forEach((line, index) => {
    if (line === null) return
    // 函数声明自身不是签发点（`async function buildTokenPair(` 是定义）
    if (/^\s*(?:export\s+)?(?:async\s+)?function\s+/.test(line)) return
    for (const identifier of ISSUANCE_IDENTIFIERS) {
      if (!new RegExp(`\\b${identifier}\\s*\\(`).test(line)) continue
      const { label, at } = findAnchor(lines, index)
      const guarded = lines
        .slice(at + 1, index)
        .some((mid) => mid !== null && mid.includes(GUARD_CALL))
      sites.push({ file: relFile, anchor: label, line: index + 1, identifier, guarded })
    }
  })
  return sites
}

/**
 * 非 (a) 类签发点的具名豁免清单 —— 逐条必须带理由，缺理由直接判红。
 * class 语义：
 *   refresh     已持有 refresh token 的轮转/续期（产品语义明确不碰，否则换网即被踢）
 *   third-party 给第三方客户端发令牌：请求侧是客户端而非账号属主的登录代理，
 *               且入口本身要求一个已登录会话先完成授权/确认
 *   primitive   签发原语/聚合器自身，守卫挂在它的调用方
 */
const EXEMPTIONS: { file: string; anchor: string; class: string; reason: string }[] = [
  {
    file: 'src/routes/auth.ts',
    anchor: 'fn:buildTokenPair',
    class: 'primitive',
    reason: 'auth.ts 私有签发聚合器（内部调 issueTokenPair），闸门挂在 6 条 (a) 类调用方',
  },
  {
    file: 'src/routes/auth.ts',
    anchor: 'POST /refresh',
    class: 'refresh',
    reason: '轮转既有 family：签发前已 verifyRefreshToken + 查库确认未吊销，不是新登录会话',
  },
  {
    file: 'src/routes/auth-extended.ts',
    anchor: 'fn:buildTokenPair',
    class: 'primitive',
    reason: '导出给 oauth-tokens.ts 复用的签发原语，闸门按调用方分类登记',
  },
  {
    file: 'src/routes/auth-extended.ts',
    anchor: 'fn:rotateRefreshTokenFlow',
    class: 'refresh',
    reason: 'device/web/pkce/token-exchange 四条 refresh 腿的共同轮转出口',
  },
  {
    file: 'src/routes/auth-extended.ts',
    anchor: 'fn:mintClientCredentialsToken',
    class: 'third-party',
    reason: 'client_credentials M2M：主体是应用归属人，不签发会话凭据也不带 refresh token',
  },
  {
    file: 'src/routes/auth-extended.ts',
    anchor: 'POST /auth/oauth/token',
    class: 'third-party',
    reason: '授权码换令牌：请求侧是第三方客户端，授权发生在已登录会话里，来源 IP 属客户端',
  },
  {
    file: 'src/routes/auth-extended.ts',
    anchor: 'POST /oauth/device/token',
    class: 'third-party',
    reason: 'RFC 8628 设备码轮询侧是发起流程的设备；账号归属由已登录会话的确认腿绑定',
  },
  {
    file: 'src/routes/auth-extended.ts',
    anchor: 'POST /oauth/web/token',
    class: 'third-party',
    reason: '同 /auth/oauth/token：授权码消费腿，非账号属主的登录代理',
  },
  {
    file: 'src/routes/auth-extended.ts',
    anchor: 'POST /oauth/pkce/token',
    class: 'third-party',
    reason: '公开客户端 PKCE 授权码腿，前置是已登录会话签发的 code + code_verifier',
  },
  {
    file: 'src/routes/auth-extended.ts',
    anchor: 'POST /oauth/jwt/token',
    class: 'third-party',
    reason: 'private_key_jwt 客户端断言腿，主体来自客户端自签 assertion，不经用户凭据校验',
  },
  {
    file: 'src/routes/auth-extended.ts',
    anchor: 'POST /oauth/access_token',
    class: 'third-party',
    reason: '/auth/oauth/token 的多路径兼容别名，同一条授权码腿',
  },
  {
    file: 'src/routes/auth-extended.ts',
    anchor: 'POST /oauth/token/exchange',
    class: 'third-party',
    reason: 'authorization_code 分支与 /oauth/access_token 同形（refresh 分支复用轮转出口）',
  },
  {
    file: 'src/routes/auth-sso.ts',
    anchor: 'fn:buildTokenPair',
    class: 'primitive',
    reason: 'SSO 本地签发聚合器（内部调 issueTokenPair），闸门挂在 /sso/exchange 调用方',
  },
  {
    file: 'src/routes/auth-sso.ts',
    anchor: 'POST /sso/refresh',
    class: 'refresh',
    reason: '轮换既有 refresh token，不产生新会话',
  },
  {
    file: 'src/routes/auth-passkey.ts',
    anchor: 'fn:buildTokenPair',
    class: 'primitive',
    reason: 'passkey 副本签发原语，闸门挂在 verify 腿的调用方',
  },
  {
    file: 'src/routes/oauth-tokens.ts',
    anchor: 'fn:handleAuthorizationCodeGrant',
    class: 'third-party',
    reason: '根级 RFC 8414 AS 的授权码腿，请求侧是第三方客户端',
  },
  {
    file: 'src/routes/oauth-tokens.ts',
    anchor: 'fn:handleRefreshTokenGrant',
    class: 'refresh',
    reason: '原子占位轮转，重用即全族撤销 —— 与"新登录"无关',
  },
  {
    file: 'src/routes/mfa.ts',
    anchor: 'POST /recovery',
    class: 'refresh',
    reason: '恢复码腿在 checkAuth 之后：沿用当前 family 补发 access token，无 refresh、无 cookie',
  },
  {
    file: 'src/routes/v1-shared.ts',
    anchor: 'fn:mintInternalJwt',
    class: 'refresh',
    reason: 'API Key → 内部 JWT 的服务内换算，调用方已持 API Key 通过鉴权，不建立新会话',
  },
  {
    file: 'src/routes/oauth-authorization-server.ts',
    anchor: 'fn:issueIdToken',
    class: 'third-party',
    reason: 'OIDC id_token 面向 RP，不是本平台的会话凭据；授权面已过用户侧的授权页',
  },
]

function groupKey(site: IssuanceSite): string {
  return `${site.file} :: ${site.anchor}`
}

function findOffenders(sites: IssuanceSite[], exemptions = EXEMPTIONS): string[] {
  const groups = new Map<string, IssuanceSite[]>()
  for (const site of sites) {
    const list = groups.get(groupKey(site)) ?? []
    list.push(site)
    groups.set(groupKey(site), list)
  }
  const offenders: string[] = []
  for (const [key, list] of groups) {
    const guarded = list.filter((s) => s.guarded).length
    if (guarded === list.length) continue
    const exemption = exemptions.find((e) => `${e.file} :: ${e.anchor}` === key)
    if (!exemption) {
      const unguarded = list.filter((s) => !s.guarded)
      offenders.push(
        `${key} —— ${unguarded.length}/${list.length} 个签发点前面够不到 ${GUARD_CALL}` +
          `（${unguarded.map((s) => `${s.identifier}@${s.line}`).join(', ')}）`,
      )
      continue
    }
    if (exemption.reason.trim().length < 8) {
      offenders.push(`${key} —— 豁免条目没有可用理由`)
      continue
    }
    if (guarded > 0) offenders.push(`${key} —— 既登记豁免又有闸门，分类自相矛盾`)
  }
  return offenders
}

function collectAllSites(): IssuanceSite[] {
  return collectTsFiles(ROUTES_DIR).flatMap((full) => {
    const rel = relative(API_ROOT, full).split(sep).join('/')
    return collectIssuanceSites(readFileSync(full, 'utf8'), rel)
  })
}

describe('IP 白名单生效链 —— 签发点覆盖率', () => {
  const sites = collectAllSites()

  it('枚举不为空转（扫到 0 个签发点说明取材面或标识符表坏了，不是"全过"）', () => {
    expect(sites.length).toBeGreaterThan(20)
    // 空表语义与自救 IP 都属于 (a) 类腿，登录腿数量必须量得到
    expect(sites.filter((s) => s.guarded).length).toBeGreaterThanOrEqual(18)
  })

  it('每个签发点要么挂了闸门，要么在具名豁免清单里带理由登记', () => {
    expect(findOffenders(sites)).toEqual([])
  })

  it('豁免清单不得腐烂：每条都得还在命中被审面', () => {
    const present = new Set(sites.map(groupKey))
    const rotten = EXEMPTIONS.filter((e) => !present.has(`${e.file} :: ${e.anchor}`))
    expect(rotten.map((e) => `${e.file} :: ${e.anchor}`)).toEqual([])
  })

  it('阳性对照：新登录腿没挂闸门 ⇒ 断言转红；挂上 ⇒ 转绿（证明它不是恒真也不是恒红）', () => {
    const bare = `
export const routes = async (server: any) => {
  server.post('/auth/login/new-leg', async (request, reply) => {
    const user = await findUserByPhone(phone)
    const tokens = await buildTokenPair(user, reply)
    return reply.send(success(tokens))
  })
}
`
    const bareSites = collectIssuanceSites(bare, 'src/routes/auth-extended.ts')
    expect(bareSites.length).toBe(1)
    expect(findOffenders(bareSites)).toHaveLength(1)
    expect(findOffenders(bareSites)[0]).toContain('POST /auth/login/new-leg')

    const guarded = bare.replace(
      'const tokens = await buildTokenPair',
      'const gate = await gateLoginIpWhitelist(request, reply, user.id)\n    if (!gate.allowed) return gate.reply\n    const tokens = await buildTokenPair',
    )
    expect(findOffenders(collectIssuanceSites(guarded, 'src/routes/auth-extended.ts'))).toEqual([])

    // 豁免清单本身不给这条新腿开后门：正则兜底放行在这里不存在
    expect(EXEMPTIONS.some((e) => e.anchor.includes('new-leg'))).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
