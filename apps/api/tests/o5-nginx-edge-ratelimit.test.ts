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
/** 2026-09-28 新增:ai-service 对外能力面(站点壳 = http 级壳 + server 级白名单片段)。 */
const AISVC_SHELL = resolve(REPO_ROOT, 'deploy/nginx/conf.d/public-ai-service.conf')
const AISVC_FRAGMENT = resolve(
  REPO_ROOT,
  'deploy/nginx/conf.d/public-ai-service.locations.fragment',
)

/**
 * 2026-09-29 G-462 新增:ai-service **宽面**(非精确前缀代理)的申报清单 —— 两片 nginx 配置
 * 共用的一本账(不是 docker 单独一本、站点单独一本)。它申报的是"整段路径前缀代理到 ai-service"
 * 这类 location,与白名单片段是两种东西:白名单里每条都带 `@public-exposure: open …` 注解、
 * 只许 `location =` 精确形态(判据 ⑪⑫ + scripts/check-public-exposure-list.mjs 的 X1/X3/X5);
 * 而那条注解若落在非精确 location 上会被 X5 判成"兜底正则型"直接红,所以宽面**不能**靠它申报。
 */
const BROAD_LEDGER_REL = 'deploy/nginx/public-broad-surface.list'
const BROAD_LEDGER = resolve(REPO_ROOT, BROAD_LEDGER_REL)
const BROAD_ENTRY_PREFIX = '@broad-surface:'
/** file/location/upstream 三键是**连接键**,取值受严格字符集约束(与 @public-exposure 同一条规矩)。 */
const BROAD_STRICT_FIELDS = ['file', 'location', 'upstream'] as const
/** reason/consumers/exit 三项是有内容的正文,空壳与占位都不算申报。 */
const BROAD_PROSE_FIELDS = ['reason', 'consumers', 'exit'] as const
const BROAD_STRICT_VALUE_RE = /^[\w:./-]+$/
const BROAD_PLACEHOLDER_RE = /[<>]|TBD|TODO|待填|待定/i
/**
 * ai-service 上游标识:提到模块级,免得"哪些 location 算 ai-service 面"存在第二份实现
 * (两处写同一件事必漂移,是本仓记过最多次的失效型)。字面量与
 * scripts/check-public-exposure-list.mjs 的 AI_SERVICE_UPSTREAM_RE 同形。
 */
const AI_SERVICE_UPSTREAM_RE =
  /proxy_pass\s+http:\/\/(?:ihui_ai_service_public|ai-service)(?![\w.-])/

/** 精确匹配形态(`location = /一条/精确/路径`)—— 白名单判据管的正是这一族。 */
function isExactLocationArgs(args: string): boolean {
  return /^=\s+\S+$/.test(args)
}

/** 归一 location 参数,供与清单里的 `location=` 取值对齐(内层多空格不应当成两条不同的面)。 */
function normLocationArgs(args: string): string {
  return args.replace(/\s+/g, ' ').trim()
}

/**
 * 解析申报行。**刻意不做"坏行静默丢弃"**:解析出 fields 就交出去,由 audit 逐条判红 ——
 * 把"读不懂"写成"没有申报",等于让一台瞎掉的尺子报绿。
 * 头注里的格式示例行以 `#` 起头,天然不匹配本前缀(不靠字符集侥幸)。
 */
function parseBroadSurfaceEntries(ledgerText: string): Array<Record<string, string>> {
  const out: Array<Record<string, string>> = []
  for (const line of ledgerText.split(/\r?\n/)) {
    const t = line.trim()
    if (!t.startsWith(BROAD_ENTRY_PREFIX)) continue
    const fields: Record<string, string> = {}
    for (const seg of t.slice(BROAD_ENTRY_PREFIX.length).split(';;')) {
      const eq = seg.indexOf('=')
      if (eq <= 0) continue
      const k = seg.slice(0, eq).trim()
      const v = seg.slice(eq + 1).trim()
      if (k && v) fields[k] = v
    }
    out.push(fields)
  }
  return out
}

/**
 * 现读"宽面":四个被审面里每一个**代理到 ai-service 的非精确 location**。
 *
 * 走 `stripStructural` 之后才取 location ⇒ 注释里写的 `proxy_pass http://ai-service…` 造不出
 * 一条假宽口(否则本判据会被自己的说明文字判红,与守门 131 那型同)。
 * `location @name` 排除:named location 不可由 URI 直达,不是对外面。
 */
function findBroadSurfaces(
  faces: Array<{ file: string; text: string }>,
): Array<{ file: string; args: string }> {
  const out: Array<{ file: string; args: string }> = []
  for (const f of faces) {
    for (const l of collectLocations(stripStructural(f.text))) {
      if (!AI_SERVICE_UPSTREAM_RE.test(l.body)) continue
      if (isExactLocationArgs(l.args)) continue
      if (l.args.startsWith('@')) continue
      out.push({ file: f.file, args: normLocationArgs(l.args) })
    }
  }
  return out
}

/**
 * 纯判据:宽面 ⇄ 申报 两侧闭合。返回红项清单,空数组 = 一致。
 *
 * 写成纯函数是为了让"有牙证明"能用**构造面**做,而不是去改真实文件
 * (改真实文件取证 = 在同一枚提交里留下半成品,而且共享工作区里那是在动别人的现场)。
 *   B1 有宽面而未申报 ⇒ 红(票面要的"未申报的宽面必红");
 *   B2 申报落不到真实宽面 ⇒ 红(清单腐烂比没有清单更糟:它替后来人做出"这条已被想过"的判断);
 *   B3 申报字段不齐 / 连接键取值不合法 / 正文是空壳或占位 ⇒ 红。
 */
function auditBroadSurfaces(
  faces: Array<{ file: string; text: string }>,
  ledgerText: string,
): string[] {
  const reds: string[] = []
  const entries = parseBroadSurfaceEntries(ledgerText)
  const entryKey = (f: string, a: string) => `${f}|${a}`
  const seen = new Set<string>()

  for (const [i, e] of entries.entries()) {
    const tag = `申报第 ${i + 1} 行`
    const missing = [...BROAD_STRICT_FIELDS, ...BROAD_PROSE_FIELDS].filter((k) => !e[k])
    if (missing.length > 0) {
      reds.push(`${tag} 字段不齐,缺:${missing.join(', ')}`)
      continue
    }
    for (const k of BROAD_STRICT_FIELDS) {
      if (!BROAD_STRICT_VALUE_RE.test(e[k] ?? ''))
        reds.push(`${tag} 的 ${k}=${e[k]} 不是合法取值(只许 [\\w:./-],尖括号占位不许留在实盘)`)
    }
    for (const k of BROAD_PROSE_FIELDS) {
      const v = (e[k] ?? '').trim()
      if (v.length < 8) reds.push(`${tag} 的 ${k} 正文过短 ⇒ 申报不是一句空话`)
      if (BROAD_PLACEHOLDER_RE.test(v)) reds.push(`${tag} 的 ${k} 仍是占位/待办措辞`)
    }
    const key = entryKey(e['file'] ?? '', normLocationArgs(e['location'] ?? ''))
    if (seen.has(key)) reds.push(`${tag} 与前一行重复申报:${key}`)
    seen.add(key)
  }

  const observed = findBroadSurfaces(faces)
  for (const b of observed) {
    if (!seen.has(entryKey(b.file, b.args)))
      reds.push(`B1 ${b.file} 的 location ${b.args} 整片代理到 ai-service 而未申报(未申报的宽面)`)
  }
  for (const [i, e] of entries.entries()) {
    const key = entryKey(e['file'] ?? '', normLocationArgs(e['location'] ?? ''))
    if (!observed.some((b) => entryKey(b.file, b.args) === key))
      reds.push(
        `B2 申报第 ${i + 1} 行(${key})落不到真实宽面 ⇒ 清单腐烂(或它申报的是精确项,精确项归 @public-exposure 那本账)`,
      )
  }
  return reds
}

/**
 * 负面清单:这些 scope 一律**不得**出现在任何 nginx 对外白名单里。
 * 它不是"当前没放"的快照,而是判据:② 该只内网的四项 + ③ 判不准的一项,逐条写死。
 * 理由住在 deploy/nginx/conf.d/public-ai-service.locations.fragment 的头注(一份正文),
 * 这里只钉"放开即红"。
 */
const NEVER_PUBLIC_SCOPES = [
  'sandbox:run',
  'browser:operate',
  'computer:operate',
  'connectors:write',
  'connectors:read',
] as const

/** 注解行格式:`# @public-exposure: open capability=… method=… path=… upstream=…` */
const EXPOSURE_ANNOTATION_RE = /#\s*@public-exposure:\s*open\b([^\n]*)$/gm

/** 注解合法取值形态:scope 含 `:`,path 含 `/`,方法是大写字母 —— **不含** `<`/`>`/空格。 */
const ANNOTATION_VALUE_RE = /^[\w:./-]+$/
const ANNOTATION_FIELDS = ['capability', 'method', 'path', 'upstream'] as const

function parseAnnotations(text: string): Array<Record<string, string>> {
  const out: Array<Record<string, string>> = []
  for (const m of text.matchAll(EXPOSURE_ANNOTATION_RE)) {
    const fields: Record<string, string> = {}
    for (const kv of (m[1] ?? '').matchAll(/(\w+)=(\S+)/g)) {
      if (kv[1] && kv[2]) fields[kv[1]] = kv[2]
    }
    // 四键齐备且取值是**真值**才算一条申报。判据必须认得出"格式说明行":
    // 片段头注里逐字写着 `capability=<目录 scope>` 这类示例,第一版就是被它顶出了
    // 一条假开放项 ⇒ 对账判据把文档当申报,报出来的红没人能修。
    const valid = ANNOTATION_FIELDS.every((f) => ANNOTATION_VALUE_RE.test(fields[f] ?? ''))
    if (valid) out.push(fields)
  }
  return out
}

/**
 * 取某个 location 在**原始文本**里的正文(注解行住在注释里,而 `Parsed.code` 已把注释
 * 剥掉 ⇒ 判注解必须回到原文)。
 *
 * 收块判据用"缩进":从 `location <args> {` 那行起,遇到与 `location` 关键字同缩进的
 * 单独 `}` 即止。不用括号配平是因为本仓的 429 应答体是含 `{}` 的单引号 JSON,
 * 按括号数会把后面的 location 一起吃进来 —— 那正好让"缺注解"判不出来。
 */
function rawLocationSlice(raw: string, args: string): string {
  const lines = raw.split(/\r?\n/)
  const needle = `location ${args} {`
  const from = lines.findIndex((l) => l.trim() === needle)
  if (from < 0) return ''
  const indent = /^(\s*)/.exec(lines[from] ?? '')?.[1]?.length ?? 0
  const out: string[] = []
  for (let i = from + 1; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (line.trim() === '}' && (/^(\s*)/.exec(line)?.[1]?.length ?? 0) <= indent) break
    out.push(line)
  }
  return out.join('\n')
}

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
      if (buf.trim() === '')
        issues.push(`${file}:${startLine}: 块头为空({ 前没有 location/upstream 等指令)`)
      buf = ''
      startLine = line
      continue
    }
    if (ch === '}') {
      if (buf.trim() !== '')
        issues.push(`${file}:${startLine}: 指令缺少 ; 收尾 → ${buf.trim().slice(0, 60)}`)
      buf = ''
      startLine = line
      continue
    }
    buf += ch
  }
  if (buf.trim() !== '')
    issues.push(`${file}:${startLine}: 文件结尾仍有未闭合指令 → ${buf.trim().slice(0, 60)}`)
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
    found.push({
      args: (m[1] ?? '').trim(),
      body: structural.slice(openIdx + 1, i - 1),
      start: m.index,
    })
  }
  return found
}

function parseFile(path: string): Parsed {
  const raw = readFileSync(path, 'utf8')
  const code = stripStructural(raw)
  const zones = [...code.matchAll(/limit_req_zone\s+[^\s]+\s+zone=([^:\s]+):/g)].map(
    (m) => m[1] ?? '',
  )
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
  const shell = parseFile(AISVC_SHELL)
  const frag = parseFile(AISVC_FRAGMENT)

  /** 代理到 ai-service 的 location(两种壳的上游标识不同,列在一处以免判据有第二份)。 */
  function aiServiceLocations(parsed: Parsed) {
    return parsed.locations.filter((l) => AI_SERVICE_UPSTREAM_RE.test(l.body))
  }

  it('① 结构:括号配平、每条指令以 ; / { / } 收尾', () => {
    for (const [name, parsed] of [
      ['nginx-blue-green.conf', bg],
      ['conf.d/rate-limit.conf', rl],
      ['docker/nginx.web.conf', dk],
      ['conf.d/public-ai-service.conf', shell],
      ['conf.d/public-ai-service.locations.fragment', frag],
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
    expect(
      undefinedRefs,
      `nginx-blue-green.conf 引用了未定义的 zone:${undefinedRefs.join(',')}`,
    ).toEqual([])
  })

  it('③ 没有"定义了却没人引用"的死配置 zone(rate-limit.conf 曾经的病)', () => {
    const referenced = new Set([...bg.used, ...dk.used, ...frag.used])
    const dead = rl.zones.filter((z) => !referenced.has(z))
    expect(dead, `conf.d/rate-limit.conf 里无人引用的 zone:${dead.join(',')}`).toEqual([])
    // docker 文件同理(自带 zone,自己用)
    const dkReferenced = new Set(dk.used)
    expect(dk.zones.filter((z) => !dkReferenced.has(z))).toEqual([])
    // 6 条主站 zone 的清单本身即验收面:改名 / 漏挂都会在这里被抓
    // (ai-service 对外面的两条 zone 住在 public-ai-service.conf,不并进这份清单 ——
    //  两批配置各有自己的失败面,混成一个数组会让"主站漏放限流文件"这一型判据变钝。)
    expect([...rl.zones].sort()).toEqual(
      [
        'api_zone',
        'gateway_anon_zone',
        'gateway_key_zone',
        'login_zone',
        'static_zone',
        'ws_handshake_zone',
      ].sort(),
    )
    // ai-service 对外面:壳定义、片段引用,**跨文件**必须闭合(片段被挪走 = zone 变死配置,
    // 而 nginx 对找不到的 include 是启动即失败,所以这条只在配置面判得出)。
    expect([...shell.zones].sort()).toEqual(['aisvc_anon_zone', 'aisvc_open_zone'])
    const shellDead = shell.zones.filter((z) => !referenced.has(z))
    expect(shellDead, `public-ai-service.conf 里无人引用的 zone:${shellDead.join(',')}`).toEqual([])
    const fragUndefined = [...new Set(frag.used)].filter((z) => !shell.zones.includes(z))
    expect(fragUndefined, `白名单片段引用了未定义的 zone:${fragUndefined.join(',')}`).toEqual([])
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
    expect(rl.raw).toContain(
      'limit_req_zone $http_authorization$http_x_api_key zone=gateway_key_zone',
    )
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

  it('⑨ 各文件的 zone 名互不重复(同放一个 conf.d 会 duplicate 报错)', () => {
    const all = [...rl.zones, ...dk.zones, ...shell.zones]
    expect(new Set(all).size, `重复的 zone:${all.join(',')}`).toBe(all.length)
    // docker 文件自带一套 docker_ 前缀 zone,不依赖 deploy/nginx/conf.d
    for (const z of dk.zones) expect(z).toMatch(/^docker_/)
    for (const z of [...dk.used]) expect(z).toMatch(/^docker_/)
    // map 的**结果变量名**同样吃"同 http 上下文重名即启动失败"这条规则
    // (`"x" is already used`)—— 只盯 zone 会漏掉它,而它一旦撞名炸的是整台 nginx。
    const siteMaps = [...shell.code.matchAll(/^\s*map\s+\S+\s+\$(\w+)\s*\{/gm)].map(
      (m) => m[1] ?? '',
    )
    const mainMaps = [...rl.code.matchAll(/^\s*map\s+\S+\s+\$(\w+)\s*\{/gm)].map((m) => m[1] ?? '')
    const dockerMaps = [...dk.code.matchAll(/^\s*map\s+\S+\s+\$(\w+)\s*\{/gm)].map(
      (m) => m[1] ?? '',
    )
    expect(siteMaps, '站点壳应自带一条未带凭据流量的 map').toEqual(['aisvc_anon_key'])
    expect(
      mainMaps,
      '主站限流文件的 map 结果变量名不得漂走(gateway_anon_zone 的 key 就是它)',
    ).toEqual(['gateway_anon_key'])
    expect(dockerMaps).toEqual(['docker_aisvc_anon_key'])
    for (const v of dockerMaps) expect(v).toMatch(/^docker_/)
    expect(new Set([...siteMaps, ...dockerMaps, ...mainMaps]).size).toBe(3)
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

  it('⑪ ai-service 白名单只许精确匹配,且每条都剥内网身份头、都带可对账注解', () => {
    const siteOpen = aiServiceLocations(frag)
    const dockerOpen = aiServiceLocations(dk).filter((l) => l.args.startsWith('= '))
    expect(
      siteOpen.length + dockerOpen.length,
      '两侧一处开放项都没有 = 判据失明,不是通过',
    ).toBeGreaterThan(1)
    for (const [l, parsed] of [
      ...siteOpen.map((x) => [x, frag] as const),
      ...dockerOpen.map((x) => [x, dk] as const),
    ]) {
      // 精确匹配是唯一允许的形态:兜底正则 / `^~` 前缀会把**静态子路由**一起放行。
      // 本仓实测过后果:`^/api/agents/[^/]+$` 让 /agents/health 游客可达,而依赖
      // request.userId 的 handler 对游客不是 401 而是 500(AGENTS §5)。
      expect(l.args, `白名单出现非精确匹配形态:${l.args}`).toMatch(/^=\s+\/\S+$/)
      // 身份只能来自凭据本身:内网签发头必须剥掉(它等于冒名通道),机器 key 也剥
      // (ai-service 见 ihui_/X-Api-Key 一律 401,剥掉只为让"为何被拒"只有一种答案)。
      expect(l.body, `${l.args} 未剥 X-IHUI-Principal`).toMatch(
        /proxy_set_header\s+X-IHUI-Principal\s+""/,
      )
      expect(l.body, `${l.args} 未剥 X-Api-Key`).toMatch(/proxy_set_header\s+X-Api-Key\s+""/)
      // 注解是 scripts/check-public-exposure-list.mjs 的输入:没注解的 location 对它隐形,
      // 而"隐形"正是本仓最贵的失效型 ⇒ 在配置面先拦住。
      const rawBody = rawLocationSlice(parsed.raw, l.args)
      expect(rawBody, `${l.args} 缺 @public-exposure 注解行`).toMatch(/@public-exposure:\s*open\b/)
      expect(rawBody, `${l.args} 注解缺 upstream=(两侧对账的键)`).toMatch(/upstream=\/\S+/)
    }
    // 负面清单:② 该只内网 / ③ 判不准的 scope 一律不得被写进白名单
    const declared = [...parseAnnotations(frag.raw), ...parseAnnotations(dk.raw)].map(
      (a) => a.capability ?? '',
    )
    for (const scope of NEVER_PUBLIC_SCOPES) {
      expect(declared, `负面清单里的 ${scope} 被放开了`).not.toContain(scope)
    }
  })

  it('⑫ 两侧开放集对账(按 capability+method+upstream,不按各壳自己的公网路径)', () => {
    const key = (a: Record<string, string>) => `${a.capability}|${a.method}|${a.upstream}`
    const site = parseAnnotations(frag.raw).map(key).sort()
    const docker = parseAnnotations(dk.raw).map(key).sort()
    expect(site.length, '站点片段一处都没放开 = 判据失明').toBeGreaterThan(0)
    expect(
      docker,
      `docker 侧与站点侧开放集不一致\n  站点:${site.join(', ')}\n  docker:${docker.join(', ')}`,
    ).toEqual(site)
    // 现读的放开项恰为 ① 类那一条;多一条就要先回答"它凭什么进来"。
    expect(site).toEqual(['mcp:connect|POST|/api/mcp'])
  })

  it('⑬ 默认档:主站 443 逐字不含 ai-service 上游,独立壳自己默认拒绝', () => {
    // 蓝绿那份 443 站点由别的会话持有、本票不碰 ⇒ "未列入白名单的一切保持零公网暴露"
    // 不是靠"我记得没加",而是靠"那个文件里没有 ai-service 目标"这条可判事实。
    for (const l of bg.locations) {
      expect(
        l.body,
        `主站 443 出现了指向 ai-service 的 location(${l.args})—— 对外面必须走片段 + 独立壳`,
      ).not.toMatch(/proxy_pass\s+http:\/\/(?:ihui_ai_service_public|ai-service)(?![\w.-])/)
    }
    expect(bg.raw).not.toMatch(/public-ai-service/)
    // 独立壳除白名单片段外只有 404 与 429 两个出口。
    const shellOnly = shell.locations.filter((l) => !frag.locations.some((f) => f.args === l.args))
    const catchAll = shellOnly.find((l) => l.args === '/')
    expect(catchAll, '独立壳缺 `location /` 默认拒绝').toBeTruthy()
    expect(catchAll?.body).toMatch(/return 404/)
    for (const l of shellOnly.filter((l) => l.args !== '/' && !l.args.startsWith('@'))) {
      expect.fail(`独立壳里有未申报的 location:${l.args}`)
    }
    // 限流闸不许"顺手省掉":每条**本票新增的精确白名单** location 必须同时引用
    // 会话档与未带凭据档。docker 侧那条 `location /ai-service/`(整棵子树,2026-07-24 A 套壳)
    // 刻意不在这里判 —— 它早于本票、收窄属其持有人决策,把它一并判红就是替别人背债的恒红门。
    // (2026-09-29 G-462:那一族改由判据 ⑮ 管,且 ⑮ 只判"有没有申报",不判它的限流档与剥头 ——
    //  所以 ⑬ 与 ⑮ 不矛盾:同一个 location,一条判限流齐不齐(不碰它),一条判申报闭不闭合。)
    for (const l of aiServiceLocations(frag)) {
      const reqs = [...l.body.matchAll(/limit_req\s+zone=([^\s;]+)/g)].map((m) => m[1] ?? '')
      expect(reqs.sort(), `${l.args} 的两段闸不齐`).toEqual(['aisvc_anon_zone', 'aisvc_open_zone'])
    }
    for (const l of aiServiceLocations(dk).filter((x) => x.args.startsWith('= '))) {
      const reqs = [...l.body.matchAll(/limit_req\s+zone=([^\s;]+)/g)].map((m) => m[1] ?? '')
      expect(reqs.sort(), `${l.args} 的两段闸不齐`).toEqual([
        'docker_aisvc_anon_zone',
        'docker_aisvc_open_zone',
      ])
    }
  })

  it('⑭ 片段名字必须不被 http 级自动读入,且壳真的 include 了它', () => {
    // nginx.conf 在 **http 上下文** `include /etc/nginx/conf.d/*.conf`,而白名单片段是
    // server 级内容 ⇒ 一旦起成 *.conf,它会被当 http 级配置读入,`nginx -t` 直接失败。
    // "名字以 .fragment 结尾"是它能在两处被 include 的唯一前提,本条盯的就是这个前提。
    expect(AISVC_FRAGMENT.endsWith('.fragment'), '片段名须以 .fragment 结尾').toBe(true)
    expect(shell.raw).toContain('include /etc/nginx/conf.d/public-ai-service.locations.fragment;')
    // 回退一行必须真在文件里写着(把片段挪走 ⇒ 壳的 include 取不到文件 ⇒ nginx 启动即失败,
    // 不允许"壳还在、白名单没了"的静默中间态)。
    expect(frag.raw).toMatch(/mv \/etc\/nginx\/conf\.d\/public-ai-service\.locations\.fragment\b/)
    // 超限形态与主站同口径:429 + Retry-After + X-RateLimit-Layer: edge
    expect(shell.raw).toContain('limit_req_status 429')
    expect(shell.raw).toMatch(/error_page\s+429\s*=\s*@\w+/)
    const target = /error_page\s+429\s*=\s*@(\w+)/.exec(shell.raw)?.[1]
    const body = findLocation(shell, (a) => a === `@${target}`)
    expect(body, '独立壳缺 named location').toBeTruthy()
    expect(body).toMatch(/add_header Retry-After "" always/)
    expect(body).toMatch(/return 429/)
  })

  it('⑮ ai-service 宽面逐条申报对账(未申报的宽面判红;清单腐烂同样判红)', () => {
    const faces = [
      { file: 'deploy/docker/nginx.web.conf', text: dk.raw },
      { file: 'deploy/nginx/conf.d/public-ai-service.conf', text: shell.raw },
      { file: 'deploy/nginx/conf.d/public-ai-service.locations.fragment', text: frag.raw },
      { file: 'deploy/nginx/nginx-blue-green.conf', text: bg.raw },
    ]
    let ledger: string
    try {
      ledger = readFileSync(BROAD_LEDGER, 'utf8')
    } catch {
      return expect.fail(
        `宽面申报清单取不到:${BROAD_LEDGER_REL} —— 申报机制被摘线不等于零宽面,这一格必须喊红`,
      )
    }
    // 反向锁(判据失明的对照):四个面里至少读得到一条 ai-service 代理 location。
    // 读不到 ⇒ 不是"宽面已清完",而是取材/解析坏了或配置搬了家 —— 那正是"把没判写成判过了"。
    const anyAiProxy = faces.reduce(
      (n, f) =>
        n +
        collectLocations(stripStructural(f.text)).filter((l) => AI_SERVICE_UPSTREAM_RE.test(l.body))
          .length,
      0,
    )
    expect(
      anyAiProxy,
      '四个面都读不到任何 ai-service 代理 location = 判据失明,不是通过',
    ).toBeGreaterThan(0)

    // 真仓现读:两侧闭合 ⇒ 存量已申报的两条宽面不会把本判据变成人人跳门的恒红门。
    expect(auditBroadSurfaces(faces, ledger), '宽面 ⇄ 申报 不闭合').toEqual([])

    // ── 有牙证明:以下全部走**构造面**,不碰真实文件也不碰共享工作区 ──────────
    const WIDE_FACE =
      'server {\n  location /ai-service/ {\n    proxy_pass http://ai-service:8803/;\n  }\n}\n'
    const OK_ENTRY =
      '@broad-surface: file=deploy/x.conf;;location=/ai-service/;;upstream=ai-service:8803' +
      ';;reason=整棵子树按前缀转出,精确形态接不住多段握手路径;;consumers=部署自检 curl :8801/ai-service/health 两处调用点' +
      ';;exit=调用点改指精确项且六项能力逐条给出对外结论之后'
    const faces1 = [{ file: 'deploy/x.conf', text: WIDE_FACE }]

    // ⑴ 未申报的宽面 ⇒ 必红(本判据存在的全部理由)
    const undeclared = auditBroadSurfaces(faces1, '')
    expect(undeclared.length, '未申报的宽面没被判红 ⇒ 判据无牙').toBeGreaterThan(0)
    expect(undeclared.join('\n')).toContain('未申报的宽面')

    // ⑵ 同一条宽面申报齐备 ⇒ 不红(否则"申报"这条路本身走不通,只能去削判据)
    expect(auditBroadSurfaces(faces1, OK_ENTRY), '已申报的宽面仍被判红').toEqual([])

    // ⑶ 精确项归 @public-exposure 那本账:把它塞进宽面清单 ⇒ 清单腐烂判红
    const EXACT_FACE =
      'server {\n  location = /api/mcp {\n    proxy_pass http://ai-service:8803/api/mcp;\n  }\n}\n'
    const stale = auditBroadSurfaces([{ file: 'deploy/x.conf', text: EXACT_FACE }], OK_ENTRY)
    expect(stale.join('\n'), '精确项被当成宽面申报 ⇒ 应判清单腐烂').toContain('B2')

    // ⑷ 空壳/占位申报不算申报(否则一张写满 `<一句正文>` 的表就能把 B1 洗成绿)
    const PLACEHOLDER_ENTRY = OK_ENTRY.replace(
      'reason=整棵子树按前缀转出,精确形态接不住多段握手路径',
      'reason=<一句正文>',
    )
    expect(
      auditBroadSurfaces(faces1, PLACEHOLDER_ENTRY).join('\n'),
      '占位正文的申报被放过了',
    ).toContain('占位')

    // ⑸ 坏连接键(路径写歪带空格之外的字符)判红,不静默丢行
    const BADKEY_ENTRY = OK_ENTRY.replace('location=/ai-service/', 'location=/ai service/')
    expect(
      auditBroadSurfaces(faces1, BADKEY_ENTRY).join('\n'),
      '非法 location 取值被放过了',
    ).toContain('不是合法取值')

    // ⑹ 注释里的 proxy_pass 造不出一条宽面(本判据不得被自己的说明文字判红)
    const COMMENT_ONLY =
      'server {\n  location /api/ {\n    # proxy_pass http://ai-service:8803/;\n    return 404;\n  }\n}\n'
    expect(
      findBroadSurfaces([{ file: 'deploy/x.conf', text: COMMENT_ONLY }]),
      '注释形态被读成了真宽面',
    ).toEqual([])

    // ⑺ 清单头注里的格式示例行不得被读成一条申报(该型在 check-public-exposure-list 里咬过前人)
    expect(
      parseBroadSurfaceEntries('# @broad-surface: file=<仓库相对路径>;;location=<参数>').length,
      '格式示例行被读成申报',
    ).toBe(0)
    expect(
      parseBroadSurfaceEntries(ledger).length,
      '真清单的申报条数与现读不符 ⇒ 有人静默加了坏行,逐条看 B3',
    ).toBeGreaterThan(0)

    // ⑻ 两片同责(AGENTS §5"改一处必须同步另一处"在这一格的可判形态):把宽面加到
    //    **站点侧**而不是 docker 侧,同样必须申报,且站点侧的上游写法(ihui_ai_service_public)
    //    与 docker 侧(ai-service)同视 —— 否则"只申报 docker 那一片"就是这一票自己的洞。
    const SITE_WIDE =
      'server {\n  location /ai-service/ {\n    proxy_pass http://ihui_ai_service_public:8443/;\n  }\n}\n'
    expect(
      auditBroadSurfaces([{ file: 'deploy/nginx/conf.d/site.conf', text: SITE_WIDE }], ledger).join(
        '\n',
      ),
      '站点侧新增宽面没被判红 ⇒ 判据只看得见申报过的那一片',
    ).toContain('未申报的宽面')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
