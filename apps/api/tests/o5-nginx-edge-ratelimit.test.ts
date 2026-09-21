// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * O5 第 1 项 —— nginx 边缘限流的**静态自检**(不是 `nginx -t`)。
 *
 * 为什么在 vitest 里做:本机无 docker、无 nginx 可执行文件,`nginx -t` 跑不了;
 * 而本子任务允许新增的文件只有迁移与 tests/,所以把"最小配置解析检查"落成测试,
 * 由 CI 每次跑一遍。它**不能**替代 nginx -t(不校验指令语义、变量存在性、模块是否编译),
 * 只守住最容易出事的结构与引用关系:
 *   ① 括号配对、指令以 ; 或 { 收尾(手写配置最常见的低级错误);
 *   ② limit_req 引用的 zone 必须在同一次加载里被 limit_req_zone 定义过(否则 nginx 启动即失败);
 *   ③ 定义了却没人引用的 zone(死配置,本次治理的起因)一律不允许回升;
 *   ④ 开放面 /v1/ 与 /v1beta/ 必须真的带 limit_req,且 burst + nodelay 齐备;
 *   ⑤ 超限必须返回 429 且带 Retry-After(error_page 429 → named location);
 *   ⑥ 长连接不被限流打断的护栏:流式/WS location 的 proxy_buffering off 与
 *      300s/3600s 长超时不得被改动掉;
 *   ⑦ 微信支付回调 location 上不许出现 limit_req(该文件自己的硬性禁令);
 *   ⑧ 蓝绿 sed 切换依赖的 blue_api/green_api 字面量必须还在;
 *   ⑨ 三个文件共存的 zone 名不重复(同被放进一个 conf.d 时 duplicate 会让 nginx -t 直接失败)。
 *
 * 放置说明:被测对象是 deploy/nginx 与 deploy/docker 的配置,不是 apps/api 的代码;
 * 之所以写在 apps/api/tests/ 下,是因为本批次只允许在该目录新建文件。
 */

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const BLUE_GREEN = resolve(REPO_ROOT, 'deploy/nginx/nginx-blue-green.conf')
const RATE_LIMIT = resolve(REPO_ROOT, 'deploy/nginx/conf.d/rate-limit.conf')
const DOCKER_WEB = resolve(REPO_ROOT, 'deploy/docker/nginx.web.conf')

interface Parsed {
  /** 去掉注释与引号内容后的"结构文本"(用于括号/指令检查) */
  code: string
  /** 原始文本 */
  raw: string
  /** 顶层块:location 参数 → 该 location 的原始正文 */
  locations: Array<{ args: string; body: string; start: number }>
  /** limit_req_zone 定义的 zone 名 */
  zones: string[]
  /** limit_req 引用的 zone 名 */
  used: string[]
}

/**
 * 剥掉注释与引号字面量,只留结构。
 * 引号内一律丢弃(替换成空串边界 ''),这样字符串里的 ; { } # 不会干扰结构判定
 * —— 例如 @rate_limited 里那段 JSON 错误体自带 {} 和逗号。
 */
function stripStructural(text: string): string {
  let out = ''
  let inSingle = false
  let inDouble = false
  let inComment = false
  for (const ch of text) {
    if (inComment) {
      if (ch === '\n') {
        inComment = false
        out += '\n'
      }
      continue
    }
    if (inSingle) {
      if (ch === "'") inSingle = false
      continue
    }
    if (inDouble) {
      if (ch === '"') inDouble = false
      continue
    }
    if (ch === '#') {
      inComment = true
      continue
    }
    if (ch === "'") {
      inSingle = true
      out += "''"
      continue
    }
    if (ch === '"') {
      inDouble = true
      out += '""'
      continue
    }
    out += ch
  }
  if (inSingle || inDouble) throw new Error('引号未闭合')
  return out
}

/**
 * 结构检查(替代 nginx -t 的第一层):把结构流按 ; { } 切成语句,
 * 要求 ① 每条指令都有内容且以 ; 收尾,② `}` 前不得有缺分号的指令,
 * ③ 文件结尾不得残留未闭合指令,④ 空语句(`;;` / `{};` 之类)一律报错。
 * 天然容忍跨行指令(gzip_types 就是跨了 5 行)。
 */
function findStructuralIssues(code: string, file: string): string[] {
  const issues: string[] = []
  let buf = ''
  let startLine = 1
  let line = 1
  for (const ch of code) {
    if (ch === '\n') {
      line++
      buf += ' '
      continue
    }
    if (ch === ';') {
      if (buf.trim() === '') issues.push(`${file}:${startLine}: 空语句(; 前没有指令)`)
      buf = ''
      startLine = line
      continue
    }
    if (ch === '{') {
      if (buf.trim() === '') issues.push(`${file}:${startLine}: 块头为空({ 前没有 location/upstream 等指令)`)
      buf = ''
      startLine = line
      continue
    }
    if (ch === '}') {
      if (buf.trim() !== '') issues.push(`${file}:${startLine}: 指令缺少 ; 收尾 → ${buf.trim().slice(0, 60)}`)
      buf = ''
      startLine = line
      continue
    }
    buf += ch
  }
  if (buf.trim() !== '') issues.push(`${file}:${startLine}: 文件结尾仍有未闭合指令 → ${buf.trim().slice(0, 60)}`)
  return issues
}

/** 找 `location <args> {` 到配对 `}` 的正文(取结构文本,断言只关心指令本身)。 */
function collectLocations(structural: string): Parsed['locations'] {
  const found: Parsed['locations'] = []
  const re = /location\s+([^\{;]*?)\s*\{/g
  let m: RegExpExecArray | null
  while ((m = re.exec(structural)) !== null) {
    const openIdx = m.index + m[0].length - 1
    let depth = 1
    let i = openIdx + 1
    for (; i < structural.length && depth > 0; i++) {
      const c = structural[i]
      if (c === '{') depth++
      else if (c === '}') depth--
    }
    if (depth !== 0) {
      throw new Error(`location "${m[1]}" 的括号未闭合`)
    }
    // 正文按结构文本切,再回到原始文本取同一区间(指令断言用不到注释内容)
    found.push({ args: (m[1] ?? '').trim(), body: structural.slice(openIdx + 1, i - 1), start: m.index })
  }
  return found
}

function parseFile(path: string): Parsed {
  const raw = readFileSync(path, 'utf8')
  const code = stripStructural(raw)
  const zones = [...code.matchAll(/limit_req_zone\s+[^\s]+\s+zone=([^:\s]+):/g)].map((m) => m[1] ?? '')
  const used = [...code.matchAll(/limit_req\s+zone=([^\s;]+)[^;]*/g)].map((m) => m[1] ?? '')
  return { code, raw, locations: collectLocations(code), zones, used }
}

function findLocation(parsed: Parsed, match: (args: string) => boolean): string | undefined {
  return parsed.locations.find((l) => match(l.args))?.body
}

describe('O5 nginx 边缘限流静态自检(替代跑不了的 nginx -t)', () => {
  const bg = parseFile(BLUE_GREEN)
  const rl = parseFile(RATE_LIMIT)
  const dk = parseFile(DOCKER_WEB)

  it('① 结构:括号配平、每条指令以 ; / { / } 收尾', () => {
    for (const [name, parsed] of [
      ['nginx-blue-green.conf', bg],
      ['conf.d/rate-limit.conf', rl],
      ['docker/nginx.web.conf', dk],
    ] as const) {
      const opens = (parsed.code.match(/\{/g) ?? []).length
      const closes = (parsed.code.match(/\}/g) ?? []).length
      expect(opens, `${name}: { 与 } 数量不等`).toBe(closes)
      expect(findStructuralIssues(parsed.code, name)).toEqual([])
    }
  })

  it('② limit_req 引用的 zone 全部有定义(蓝绿站点 = blue-green + conf.d 合载)', () => {
    expect(bg.zones, 'zone 统一定义在 conf.d/rate-limit.conf,蓝绿文件里不该再定义').toEqual([])
    const defined = new Set(rl.zones)
    const undefinedRefs = [...new Set(bg.used)].filter((z) => !defined.has(z))
    expect(undefinedRefs, `nginx-blue-green.conf 引用了未定义的 zone:${undefinedRefs.join(',')}`).toEqual([])
  })

  it('③ 没有"定义了却没人引用"的死配置 zone(rate-limit.conf 曾经的病)', () => {
    const referenced = new Set([...bg.used, ...dk.used])
    const dead = rl.zones.filter((z) => !referenced.has(z))
    expect(dead, `conf.d/rate-limit.conf 里无人引用的 zone:${dead.join(',')}`).toEqual([])
    // docker 文件同理(自带 zone,自己用)
    const dkReferenced = new Set(dk.used)
    expect(dk.zones.filter((z) => !dkReferenced.has(z))).toEqual([])
    // 6 条 zone 的清单本身即验收面:改名 / 漏挂都会在这里被抓
    expect([...rl.zones].sort()).toEqual(
      ['api_zone', 'gateway_anon_zone', 'gateway_key_zone', 'login_zone', 'static_zone', 'ws_handshake_zone'].sort(),
    )
  })

  it('④ 开放面 /v1/ 与 /v1beta/ 都接了独立 limit_req,且带 burst + nodelay', () => {
    for (const prefix of ['/v1/', '/v1beta/']) {
      const body = findLocation(bg, (a) => a === prefix)
      expect(body, `缺少 location ${prefix}`).toBeTruthy()
      const reqs = [...(body ?? '').matchAll(/limit_req\s+zone=([^\s;]+)([^;]*);/g)]
      expect(reqs.length, `${prefix} 没有 limit_req`).toBeGreaterThanOrEqual(1)
      // 开放面要求"按 key/IP 双维度":一个 location 至少引用两条 zone
      expect(reqs.length, `${prefix} 应同时限已鉴权(key)与未鉴权(ip)`).toBeGreaterThanOrEqual(2)
      for (const r of reqs) {
        expect(r[2], `${prefix} 的 limit_req 缺 burst`).toContain('burst=')
        expect(r[2], `${prefix} 的 limit_req 缺 nodelay`).toContain('nodelay')
      }
    }
    // 网关 zone 用 API Key 作 key(Authorization / X-Api-Key),未带 key 时回落到 IP
    expect(rl.raw).toContain('limit_req_zone $http_authorization$http_x_api_key zone=gateway_key_zone')
    expect(rl.raw).toMatch(/map \$http_authorization\$http_x_api_key \$gateway_anon_key/)
    expect(rl.raw).toContain('limit_req_zone $gateway_anon_key zone=gateway_anon_zone')
  })

  it('⑤ 超限返回 429 且带 Retry-After', () => {
    expect(rl.raw).toContain('limit_req_status 429')
    expect(dk.raw).toContain('limit_req_status 429')
    for (const [name, parsed] of [
      ['nginx-blue-green.conf', bg],
      ['docker/nginx.web.conf', dk],
    ] as const) {
      expect(parsed.raw, `${name} 缺 error_page 429`).toMatch(/error_page\s+429\s*=\s*@\w+/)
      const target = /error_page\s+429\s*=\s*@(\w+)/.exec(parsed.raw)?.[1]
      expect(target, `${name} 的 error_page 未指向 named location`).toBeTruthy()
      const body = findLocation(parsed, (a) => a === `@${target}`)
      expect(body, `${name} 缺少 location @${target}`).toBeTruthy()
      // location 正文取的是结构文本:引号字面量已被剥成 '' / ""
      expect(body).toMatch(/add_header Retry-After "" always/)
      expect(body).toMatch(/return 429/)
    }
  })

  it('⑥ 长连接/流式护栏:限流不许顺手把 proxy_buffering off 与长超时改掉', () => {
    const v1 = findLocation(bg, (a) => a === '/v1/') ?? ''
    expect(v1).toContain('proxy_buffering off')
    expect(v1).toContain('proxy_read_timeout    300s')
    const beta = findLocation(bg, (a) => a === '/v1beta/') ?? ''
    expect(beta).toContain('proxy_buffering off')
    expect(beta).toContain('proxy_read_timeout    300s')
    const ws = findLocation(bg, (a) => a === '/ws') ?? ''
    expect(ws).toContain('proxy_read_timeout    3600s')
    expect(ws).toContain('proxy_http_version 1.1')
    expect(ws).toContain('$http_upgrade')
    // WS 只允许握手级限流(单条 IP 维度 zone),不许把 key 维度 zone 挂上去误伤长连接复用
    const wsReqs = [...ws.matchAll(/limit_req\s+zone=([^\s;]+)/g)].map((m) => m[1] ?? '')
    expect(wsReqs).toEqual(['ws_handshake_zone'])
    // 流式 location 的 limit_req 只能出现在握手/请求入口,不得引入 limit_conn 之类连接数闸
    // (连接数闸会直接掐断已建立的长连接)。用结构文本判,避免被注释里的同名说明误伤。
    expect(bg.code).not.toMatch(/limit_conn /)
    expect(dk.code).not.toMatch(/limit_conn /)
  })

  it('⑦ 微信支付回调 location 上不得有任何 limit_req(文件内既有禁令)', () => {
    const notify = bg.locations.filter((l) => l.args.includes('payments'))
    expect(notify.length).toBeGreaterThan(0)
    for (const l of notify) {
      expect(l.body, '微信回调 location 上出现 limit_req').not.toMatch(/limit_req\s/)
    }
  })

  it('⑧ 蓝绿切换 sed 依赖仍完整(新增的 login location 也必须走 blue_api)', () => {
    expect(bg.raw).toMatch(/proxy_pass http:\/\/blue_api;/)
    expect(bg.raw).toMatch(/proxy_pass http:\/\/blue_web;/)
    const login = findLocation(bg, (a) => a.includes('/api/auth/login'))
    expect(login, '缺少 /api/auth/login 独立 location(login_zone 无人引用)').toBeTruthy()
    expect(login).toContain('proxy_pass http://blue_api')
    expect(login).toContain('limit_req zone=login_zone')
  })

  it('⑨ 三个文件的 zone 名互不重复(同放一个 conf.d 会 duplicate 报错)', () => {
    const all = [...rl.zones, ...dk.zones]
    expect(new Set(all).size, `重复的 zone:${all.join(',')}`).toBe(all.length)
    // docker 文件自带一套 docker_ 前缀 zone,不依赖 deploy/nginx/conf.d
    for (const z of dk.zones) expect(z).toMatch(/^docker_/)
    for (const z of [...dk.used]) expect(z).toMatch(/^docker_/)
  })

  it('⑩ human-facing /api/ 与静态 location 也真的引用了 zone(不让 api_zone/static_zone 继续空转)', () => {
    const api = findLocation(bg, (a) => a === '/api/') ?? ''
    expect(api).toContain('limit_req zone=api_zone')
    const stat = findLocation(bg, (a) => a === '/_next/static/') ?? ''
    expect(stat).toContain('limit_req zone=static_zone')
    const dkApi = findLocation(dk, (a) => a === '/api/') ?? ''
    expect(dkApi).toContain('limit_req zone=docker_api_zone')
    const dkAi = findLocation(dk, (a) => a === '/ai-service/') ?? ''
    expect(dkAi).toContain('limit_req zone=docker_ai_service_zone')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
