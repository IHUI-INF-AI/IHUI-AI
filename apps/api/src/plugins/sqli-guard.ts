// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * SQL 注入运行时检测插件(P0-4 安全加固)。
 *
 * preHandler 阶段扫描 request.body / request.query / request.params 的所有字符串值,
 * 判据 = **字符门**(半角 `'` `"` `;` 任一)**∧ SQL 结构签名**(见 SQLI_STRUCTURE_PATTERNS)。
 *
 * 命中策略:
 * - 400 拒绝 + 通用消息(不泄露检测规则细节)
 * - 告警日志:ip / userId / requestId / 命中值(截断)
 * - IP 信誉扣分:调用 ip-reputation.recordBadEvent
 *
 * 跳过场景:
 * - 健康检查 / 监控路径(/api/health, /api/metrics, /business-metrics)
 * - 文件上传(multipart,已由 upload-scanner 处理)
 * - 路由级关闭:routeOptions.config.sqliGuard = { enabled: false }
 *
 * 设计为防御纵深:xss-protection(onRequest)先做 HTML 实体编码,本插件(preHandler)
 * 再做 SQL 注入检测,两层独立工作互不依赖。
 *
 * ── 2026-09-24 判据重写:关键字侧「子串」→「词边界 + 结构签名」────────────────
 * 旧实现把关键字侧委托给 security-service.ts 的 InputValidator.checkSqlInjection,
 * 那里是 `value.toUpperCase().includes('OR')` 这种**子串**匹配。于是任何含 ASCII 分号
 * 的正常文案,只要出现 CORE / BRAND / ANDROID / RESTORE / SETTINGS / ASSET / COMMAND
 * 这类内嵌 OR|AND|SET 子串的单词,就会被判成注入(生产实测:POST /api/mail/send 正文
 * 含 `;` 与 `IHUI-CORE` → 400「请求包含不合法字符」)。
 *
 * 现在关键字侧一律要求词边界(`\b`)且**必须带 SQL 结构上下文**(布尔比较、堆叠语句、
 * UNION…SELECT、危险函数调用、系统目录),字符侧 `' " ;` 与 AI 端点强特征一字未放宽。
 *
 * 刻意**不**给非 AI 路径补 `--` 注释符特征:纯文本邮件签名分隔符就是裸 `-- `(RFC 3676),
 * 加了等于把正常邮件判成注入 —— 这与 SQLI_STRONG_PATTERN_AI 摘掉 `--\s` 是同一个理由。
 * 该形态的防护仍由「字符门 ∧ 结构签名」与 AI 路径强特征共同承担,与旧实现覆盖面一致。
 */

import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import type { Redis } from 'ioredis'
import { logger } from '../utils/logger.js'
import { getIpReputationService } from '../services/ip-reputation.js'

export interface SqliGuardRouteConfig {
  /** 是否启用本插件,默认 true */
  enabled?: boolean
}

declare module 'fastify' {
  interface FastifyContextConfig {
    sqliGuard?: SqliGuardRouteConfig
  }
}

/** 健康检查 / 监控路径白名单(不检测 SQL 注入)。 */
const SKIP_PATHS = new Set(['/api/health', '/api/metrics', '/business-metrics'])

/**
 * P2 修复(2026-08-06):AI 内容端点白名单。
 *
 * 背景:全局关键字检测(SELECT/UNION/OR 等)对 AI 类端点是误杀源——
 * 用户 prompt 是自由文本,天然可能包含 "select/union/or/where" 等词,配合引号/分号
 * 即命中 InputValidator.checkSqlInjection,导致正常 AI 请求被 400 拒绝。
 *
 * 方案:命中以下路径前缀的请求跳过关键字检测,但仍做强特征检测
 * (SQL 注释符 `--`/`/*`/`#`,以及分号后的堆叠查询 `; SELECT ...`)。
 * 这些端点接收的是交给 LLM 的自由文本而非 SQL,关键字本身无注入能力;
 * 真正危险的注释符/堆叠语句特征仍会被拦截。路径按前缀匹配(小写)。
 */
const AI_CONTENT_PREFIXES = [
  '/api/llm/',
  '/api/ai/',
  '/api/chat/',
  '/api/langchain/',
  '/api/ai-ext/',
  '/api/ai-feed/',
  '/api/ai-education/',
  '/api/ai-video-compose/',
  '/api/ai-vendors/',
  '/api/workspace-ai/',
  '/api/workspace/ai/',
  '/v1/',
  // 2026-08-10:访问埋点,body 是用户浏览的 URL 文本(可能含 -- / ; 等字符),
  // 仅写 visit_logs 一条记录,无 SQL 拼接风险,按自由文本处理
  '/api/visit-tracking/',
  // 2026-08-10:行为埋点,body 含自由文本(label/关键词),按自由文本处理
  '/api/analytics/track',
]

/**
 * 强 SQL 注入特征(非 AI 路径完整检测):
 * - `--`(后跟空白/行尾,PostgreSQL 注释;`--` 后跟数字如 `1--2` 是减法,非注释)
 * - 斜杠星号 ... 星号斜杠(PostgreSQL 块注释)
 * - 分号后的堆叠查询语句(; SELECT/UNION/... )
 *
 * 2026-08-06 P2 修复(生产故障):移除 `#` 单字符特征。
 * PostgreSQL 中 `#` 不是注释符(MySQL/MariaDB 才用),且 `#1`/`#tag`/`C#` 等
 * 在用户正常文本中出现频率极高,导致 AI 对话内容被误杀(线上用户消息
 * "[Advisor consultation #1]" 被 400 拦截 → 前端无限重连)。堆叠查询正则
 * 与关键字检测已足够覆盖真实注入,`#` 对 PG 无威胁。
 */
const SQLI_STRONG_PATTERN =
  /(--\s|--$|\/\*[\s\S]*?\*\/)|;\s*(select|union|insert|update|delete|drop|alter|create|exec|truncate)\b/im

/**
 * AI 内容路径强特征(2026-08-06 生产故障修复):去掉 `--\s`/`--$`。
 * 根因:Markdown 表格分隔行 `| --- |` 含 "-- " 被误判为 PG 注释 →
 * 历史消息里只要有表格,之后任何对话(携带完整历史)都被 400 拦截 → 前端无限重连
 * (实测:AI 回复架构表格后,用户发"架构怎么优化"连续 4 次被拦)。
 * AI 端点内容交给 LLM 不拼 SQL,仅保留块注释与分号堆叠查询两个真正危险特征。
 *
 * 2026-09-03 修复(agent 通道误杀):裸块注释 `/**\/` 分支误杀 glob 通配符
 * `src\/**\/*.ts`(其中 `/**\/*` 的前 4 字符恰好构成 `/**\/`),导致 CLI agent 的
 * tool schema / system prompt(38KB)整请求被 400 拒绝 → agent 0 completion 静默失败。
 * 块注释检测改为仅匹配真实 SQL 注释混淆形态:
 * 1. 注释体内含 SQL 关键词(`/* select *\/`、`/*!12345select*\/`)
 * 2. 空注释紧邻 SQL 关键词(`/**\/UNION/**\/SELECT`)
 * 3. 字母间的空注释分隔符(`SEL/**\/ECT` 关键词拆分混淆)
 * glob 通配符 `**\/`(两侧是路径字符/星号)不再命中。
 */
const SQLI_KEYWORDS = 'select|union|insert|update|delete|drop|alter|create|exec|truncate'
// 关键词边界用 lookbehind/lookahead 而非 \b:`\b` 在数字与字母之间不成立,
// `/*!12345select*/` 版本注释混淆会漏检;`(?<![a-z])` 同时避免 created/dropped 误报。
const SQLI_STRONG_PATTERN_AI = new RegExp(
  '\\/\\*[\\s\\S]{0,120}?(?<![a-z])(?:' +
    SQLI_KEYWORDS +
    ')(?![a-z])[\\s\\S]{0,120}?\\*\\/' +
    '|\\/\\*\\*\\/\\s*(?:' +
    SQLI_KEYWORDS +
    ')(?![a-z])' +
    '|[a-z0-9]\\/\\*\\*\\/[a-z0-9]' +
    '|;\\s*(?:' +
    SQLI_KEYWORDS +
    ')(?![a-z])',
  'im',
)

// ── 非 AI 路径判据(2026-09-24 重写:关键字子串 → 词边界 + 结构签名)────────────
//
// 字符门:与旧 InputValidator.checkSqlInjection 逐字符相同 —— 半角单引号 / 双引号 / 分号。
// 刻意不扩到全角 `＇ ＂ ；`(旧实现同样不认),放宽字符侧不是本次修复的目标。
const SQLI_CHAR_GATE = /['";]/

/**
 * `delete from the list` / `insert into your account` 这类是正常的英文说明文案,
 * 而真载荷紧跟的是表名(`delete from users`),故对这两个双词结构加限定词负向断言。
 */
const SQLI_PROSE_OBJECTS = 'the|your|this|that|these|those|our|all|any|one|it'

/**
 * SQL 结构签名:必须同时具备词边界与"注入才有的结构上下文"。
 * 每条都独立可解释,任一命中(且过字符门)即判注入。
 */
const SQLI_STRUCTURE_PATTERNS: readonly RegExp[] = [
  // 布尔/比较式:' OR 1=1 / 'and'a'='a' / AND 2>1 / or 1 like 1 / or/*x*/1=1
  /\b(?:or|and|xor)\b[\s(]*(?:\/\*[\s\S]{0,64}\*\/[\s(]*)?(?:\bnot\b[\s(]*)?['"()\w.]+\s*(?:=|<>|!=|>=|<=|[<>]|\blike\b|\bregexp\b)/i,
  // 布尔 + 常量 + 注释收尾:' OR 1 -- / or 1#
  /\b(?:or|and|xor)\b[\s(]*(?:\/\*[\s\S]{0,64}\*\/[\s(]*)?\d+[\s(]*(?:--|#|\/\*)/i,
  // WHERE 谓词:' where 1=1 / where id like 'x'
  /\bwhere\b[\s(]{1,8}\b[\w."']{1,32}\b\s*(?:=|<>|!=|>=|<=|[<>]|\blike\b|\bis\b\s+null)/i,
  // UNION ... SELECT(含 union all、union/**/select 注释混淆)
  /\bunion\b[\s\S]{0,48}?\bselect\b/i,
  // DDL + 对象名(不含 user/role/group,否则 "create user accounts" 这类文案被误杀)
  /\b(?:drop|alter|truncate|create|rename)\b[\s(]{1,8}\b(?:table|database|schema|view|index|trigger|function|procedure|extension)\b/i,
  // 堆叠 DML:insert into <表> / delete from <表> / update <表> set …
  new RegExp(`\\binsert\\b[\\s(]{1,8}\\binto\\b[\\s(]{1,8}(?!(?:${SQLI_PROSE_OBJECTS})\\b)`, 'i'),
  new RegExp(`\\bdelete\\b[\\s(]{1,8}\\bfrom\\b[\\s(]{1,8}(?!(?:${SQLI_PROSE_OBJECTS})\\b)`, 'i'),
  /\bupdate\b[\s(]{1,8}[\w."`[\]]{1,64}\b[\s(]{1,8}set\s/i,
  // SELECT 列表形态:select * from / select a,b / select x where / select distinct e from
  // (要求 select 后第一个词就是载荷或列表项,"please select your plan from the list" 不误杀)
  /\bselect\b[\s(]{1,10}(?:(?:distinct|all|top[\s(]{1,8}\d+)\b[\s(]{1,8})?[*@`'"\w.[\]]{1,64}\s*(?:,|\bfrom\b|\bwhere\b|\bbegin\b|\(|--|;)/i,
  // 时间盲注 / 危险函数:必须带调用括号 —— 裸单词 sleep 属正常文案("I need sleep;")
  /\b(?:sleep|benchmark|pg_sleep\w*|dbms_pipe\.receive_message|utl_inaddr\.get_host_name|load_file|openrowset)\s*\(/i,
  // 存储过程 / 文件读写 / 变量声明 / 提权
  /\bwaitfor\s+delay\b|\bxp_[a-z0-9_]+\b|\binto\s+(?:out|load|dump)file\b|\bexec(?:ute)?\s*\(|\bdeclare\s*@\w|\bset\s+@\w|\bselect\s+@@\w+|\bgrant\s+all\b/i,
  // 系统目录 / 元数据表
  /\binformation_schema\b|\bpg_catalog\b|\bpg_(?:shadow|user)\b|\bsqlite_master\b|\bsqlite_temp_master\b|\bmysql\.user\b|\bsys(?:objects|databases)\b/i,
]

/**
 * 单值判据:字符门 ∧ 结构签名(大小写不敏感,与旧实现的 toUpperCase 比对等价)。
 * export 只为可测性(sqli-guard.test.ts),不额外对外提供 HTTP 面。
 */
export function detectSqlInjectionPattern(value: string): boolean {
  if (!SQLI_CHAR_GATE.test(value)) return false
  return SQLI_STRUCTURE_PATTERNS.some((pattern) => pattern.test(value))
}

/** 递归扫描对象/数组中的字符串值,检测强 SQL 注入特征(供豁免路径使用)。 */
function detectStrongSqli(data: unknown, pattern: RegExp = SQLI_STRONG_PATTERN): string | null {
  if (typeof data === 'string') {
    return pattern.test(data) ? data.slice(0, 200) : null
  }
  if (Array.isArray(data)) {
    for (const item of data) {
      const hit = detectStrongSqli(item, pattern)
      if (hit) return hit
    }
    return null
  }
  if (data && typeof data === 'object') {
    for (const v of Object.values(data as Record<string, unknown>)) {
      const hit = detectStrongSqli(v, pattern)
      if (hit) return hit
    }
  }
  return null
}

/** 递归扫描对象/数组中的字符串值,返回首个命中 SQL 注入的值(截断 200 字符),未命中返回 null。 */
function detectSqlInjection(data: unknown): string | null {
  if (typeof data === 'string') {
    return detectSqlInjectionPattern(data) ? data.slice(0, 200) : null
  }
  if (Array.isArray(data)) {
    for (const item of data) {
      const hit = detectSqlInjection(item)
      if (hit) return hit
    }
    return null
  }
  if (data && typeof data === 'object') {
    for (const v of Object.values(data as Record<string, unknown>)) {
      const hit = detectSqlInjection(v)
      if (hit) return hit
    }
  }
  return null
}

const sqliGuardPlugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  const redis: Redis | null = (server as unknown as { redis?: Redis }).redis ?? null
  const ipRep = getIpReputationService(redis)

  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // 路由级开关
    const cfg = request.routeOptions.config?.sqliGuard
    if (cfg?.enabled === false) return

    // 健康检查 / 监控路径跳过
    const path = (request.url.split('?')[0] ?? request.url).toLowerCase()
    if (SKIP_PATHS.has(path)) return

    // 文件上传跳过(已由 upload-scanner 处理)
    if (typeof request.isMultipart === 'function' && request.isMultipart()) return

    // P2 修复(2026-08-06):AI 内容端点跳过关键字检测,仅做强特征检测,
    // 避免用户 prompt 含 "select/union" 等词被误杀。
    // 2026-08-06 二次修复:AI 路径强特征用 SQLI_STRONG_PATTERN_AI(不含 --\s),
    // 否则 Markdown 表格分隔行 "| --- |" 被误判 PG 注释 → 历史含表格的对话全被 400 拦。
    const isAiContentPath = AI_CONTENT_PREFIXES.some((prefix) => path.startsWith(prefix))
    const hit = isAiContentPath
      ? (detectStrongSqli(request.body, SQLI_STRONG_PATTERN_AI) ??
        detectStrongSqli(request.query, SQLI_STRONG_PATTERN_AI) ??
        detectStrongSqli(request.params, SQLI_STRONG_PATTERN_AI))
      : (detectSqlInjection(request.body) ??
        detectSqlInjection(request.query) ??
        detectSqlInjection(request.params))

    if (!hit) return

    const ip = request.ip
    const userId = request.userId
    const requestId = request.id

    logger.warn('sqli-guard: SQL injection pattern detected, blocking request', {
      ip,
      userId,
      requestId,
      path,
      matchedValue: hit,
    })

    // IP 信誉扣分(异步,不阻塞响应)
    ipRep.recordBadEvent(ip, 'sqli-detected').catch(() => {})

    // 通用消息,不泄露检测规则细节
    reply.status(400).send({ code: 400, message: '请求包含不合法字符' })
  })
}

export default fp(sqliGuardPlugin, {
  name: 'sqli-guard-plugin',
  fastify: '5.x',
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
