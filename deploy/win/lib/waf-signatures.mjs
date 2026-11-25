// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 入口载荷级 WAF 判据(2026-11-24 立)。
 *
 * 为什么必须补这一层:router 原有三道闸(回源鉴权 / 限流 / 慢速收口)都只看
 * 「谁在发、发多快」,不看「发了什么」。一个带正确回源密钥的请求(或任何直连
 * 探测)里塞 `union select` / `<script>` / `../../` 都能直达上游 —— 应用层 Zod
 * 只能挡住"字段类型不对",挡不住"字段内容就是攻击载荷",而扫描器根本不读文档。
 *
 * 为什么只扫 URL 与请求头、不扫 body:
 *   router 是**流式管道**(req.pipe(upReq)),把 body 读进内存才能扫,等于给入口
 *   加一个"先收全量再转发"的缓冲层 —— 大文件上传与流式响应会被它拖死,而且
 *   Content-Length 未声明时根本读不完。body 侧的攻击面由应用层校验 + 参数化查询
 *   承担,这里只拦"到达路由就能判死"的那一半(扫描器/探测/注入尝试几乎全在 URL 里)。
 *
 * 误报控制(这一层最容易被写成"上线即封正常用户"):
 *   · 只对**高置信组合**判 block(`union\s+select` 而不是单独 `select`);
 *   · 普通中文/英文搜索词(`?q=select 查询`)不命中;
 *   · 路径穿越只认编码前后的 `../` 与 `..%2f`,不认文件名里的点;
 *   · 扫描器 UA、敏感路径探测、恶意方法属高置信,直接 block。
 * 判据纯函数、零 IO:可被 node:test 逐条钉住,改规则只改这一处。
 */

import { decodeChain } from './normalize-input.mjs'

export const WAF_POLICY = Object.freeze({
  version: 2,
  /** 超长 URL 本身就是一种攻击面(日志放大/解析耗尽),超过即按 high 处理。 */
  maxUrlLength: 4096,
  /** 只扫 URL 前这么多字符,避免对超长串做正则。 */
  scanSlice: 2048,
  /** 体判定面只看这么多字符(读取上限另由 body-sniff 的 limitBytes 管,这里是判定面)。 */
  bodyScanSlice: 8192,
})

/**
 * 规则表。`target: 'url'` 扫 request-target,`'ua'` 只扫 User-Agent,`'method'` 看请求方法。
 * severity: critical/high ⇒ enforce 档拦截;medium ⇒ 只记录(给观察期用)。
 */
export const WAF_RULES = Object.freeze([
  // ── SQL 注入 ──────────────────────────────────────────────
  { id: 'sqli-union-select', severity: 'critical', target: 'url', re: /\bunion\b[\s\S]{0,24}\bselect\b/i, desc: 'SQLi: union select' },
  { id: 'sqli-boolean', severity: 'high', target: 'url', re: /(?:'|%27)\s*(?:or|and)\s+(?:1\s*=\s*1|'1'='1'|true)/i, desc: 'SQLi: 布尔盲注' },
  { id: 'sqli-time', severity: 'critical', target: 'url', re: /\b(?:sleep|benchmark|pg_sleep)\s*\(\s*\d+/i, desc: 'SQLi: 时间盲注' },
  { id: 'sqli-meta', severity: 'high', target: 'url', re: /\b(?:information_schema|extractvalue|updatexml|load_file)\b/i, desc: 'SQLi: 元数据/文件读取' },
  { id: 'sqli-stacked', severity: 'high', target: 'url', re: /;\s*(?:drop|truncate|delete|insert\s+into|update)\b/i, desc: 'SQLi: 堆叠语句' },

  // ── XSS ──────────────────────────────────────────────────
  { id: 'xss-script', severity: 'critical', target: 'url', re: /<\s*script\b|%3c\s*script/i, desc: 'XSS: script 标签' },
  { id: 'xss-handler', severity: 'high', target: 'url', re: /\bon(?:error|load|click|mouseover|focus)\s*=\s*['"]?/i, desc: 'XSS: 事件处理器' },
  { id: 'xss-scheme', severity: 'high', target: 'url', re: /\bjavascript\s*:\s*/i, desc: 'XSS: javascript: 伪协议' },
  { id: 'xss-document', severity: 'high', target: 'url', re: /\bdocument\s*\.\s*(?:cookie|domain|location)\b/i, desc: 'XSS: document 敏感对象' },

  // ── 路径穿越 / 任意文件读取 ───────────────────────────────
  { id: 'path-traversal', severity: 'critical', target: 'url', re: /(?:\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\/)/i, desc: '路径穿越' },
  { id: 'path-sensitive', severity: 'high', target: 'url', re: /\/(?:\.env(?:\.|$)|\.git\/(?:config|HEAD)|\.svn\/|web\.config|id_rsa|\.aws\/credentials)/i, desc: '敏感文件探测' },
  { id: 'path-admin-scan', severity: 'medium', target: 'url', re: /\/(?:wp-admin|wp-login\.php|phpmyadmin|adminer\.php|actuator\/env|manager\/html)/i, desc: '常见后台探测' },

  // ── 命令注入 / 模板注入 ──────────────────────────────────
  { id: 'cmd-injection', severity: 'critical', target: 'url', re: /(?:;|\||`)\s*(?:cat|curl|wget|whoami|id|uname|nc|bash|sh)\b|\$\(\s*(?:id|whoami|cat)\b/i, desc: '命令注入' },
  { id: 'ssti', severity: 'high', target: 'url', re: /\{\{\s*(?:config|self|__class__|__mro__)|#\{\s*\d+\s*\*\s*\d+|\$\{\s*\d+\s*\*\s*\d+/i, desc: '模板注入' },

  // ── SSRF / XXE / 反序列化 ────────────────────────────────
  { id: 'ssrf-metadata', severity: 'critical', target: 'url', re: /(?:169\.254\.169\.254|metadata\.google\.internal|100\.100\.100\.200|file:\/\/)/i, desc: 'SSRF: 云元数据/文件协议' },
  { id: 'xxe-doctype', severity: 'high', target: 'url', re: /<!doctype[^>]*\[|<!entity\b/i, desc: 'XXE: 外部实体' },
  { id: 'java-deser', severity: 'high', target: 'url', re: /\brO0AB[A-Za-z0-9+/=]{8,}/, desc: 'Java 反序列化载荷' },

  // ── 协议层异常 ────────────────────────────────────────────
  { id: 'crlf-injection', severity: 'high', target: 'url', re: /%0d%0a|\r\n/i, desc: 'CRLF 注入' },
  { id: 'method-trace', severity: 'high', target: 'method', re: /^(?:TRACE|TRACK|CONNECT)$/i, desc: '恶意/探测方法' },

  // ── 扫描器 / 自动化工具 ──────────────────────────────────
  {
    id: 'scanner-ua',
    severity: 'high',
    target: 'ua',
    re: /(?:sqlmap|nikto|nmap|masscan|zgrab|nuclei|xray|acunetix|awvs|nessus|openvas|dirbuster|gobuster|wfuzz|ffuf|hydra|metasploit)/i,
    desc: '已知扫描器 UA',
  },
])

/**
 * 体规则(2026-11-25 立):第二次补齐,专扫 POST/PUT/PATCH 的请求体。
 *
 * 为什么单独一张表而不并进 WAF_RULES:误伤成本完全不同。
 * URL 里的 `select` 多是搜索词,可以只要求 `union\s+select` 就拦;
 * body 里的 `select` 多是业务字段名(JSON 里遍地都是),同样强度会立刻把正常提交打死。
 * 所以这里每条都额外要求**攻击语法完整**:
 *   · union 必须带 from —— `{"q":"union select"}` 是查询内容,`union select ... from` 才是注入;
 *   · script 必须带执行调用 —— `<script src=...>` 是正常富文本,`<script>alert(1)` 才是 XSS;
 *   · 穿越必须两层以上 —— 单层 `../` 是常见相对路径。
 * 宁可少拦一条,也不能让一个正常表单被 403。失效方向恒为"少扫"。
 */
export const BODY_RULES = Object.freeze([
  { id: 'sqli-union-select-body', severity: 'critical', target: 'body', re: /\bunion\b[\s\S]{0,32}\bselect\b[\s\S]{0,128}\bfrom\b/i, desc: 'SQLi(体): union select … from' },
  { id: 'sqli-time-body', severity: 'critical', target: 'body', re: /\b(?:sleep|benchmark|pg_sleep)\s*\(\s*\d+\s*\)/i, desc: 'SQLi(体): 时间盲注函数' },
  {
    id: 'xss-script-exec-body',
    severity: 'critical',
    target: 'body',
    re: /<\s*script[^>]*>[\s\S]{0,160}\b(?:alert|confirm|prompt|eval|fetch|document\s*\.\s*cookie)\b/i,
    desc: 'XSS(体): script 内含执行调用',
  },
  { id: 'path-traversal-body', severity: 'high', target: 'body', re: /(?:\.\.\/){2,}|(?:\.\.\\){2,}|(?:%2e%2e(?:%2f|%5c)){2,}/i, desc: '路径穿越(体): 两层以上' },
  { id: 'cmd-injection-body', severity: 'critical', target: 'body', re: /(?:;|\|)\s*(?:cat|curl|wget|nc|bash|sh|powershell|whoami)\s+\S/i, desc: '命令注入(体)' },
  { id: 'jndi-injection-body', severity: 'critical', target: 'body', re: /\$\{jndi\s*:\s*(?:ldap|rmi|dns|http|iiop)/i, desc: 'Log4Shell: ${jndi:' },
  { id: 'ssti-body', severity: 'high', target: 'body', re: /\{\{\s*(?:config|self|__class__|__mro__|lipsum)\b|__class__\s*\.\s*__mro__/i, desc: '模板注入(体)' },
  { id: 'php-deser-body', severity: 'high', target: 'body', re: /O:\d+:"[A-Za-z_\\][A-Za-z0-9_\\]*":\d+:\{/, desc: 'PHP 反序列化(体)' },
  {
    id: 'webshell-eval-body',
    severity: 'critical',
    target: 'body',
    re: /(?:eval|assert|system|passthru|shell_exec|popen)\s*\(\s*(?:base64_decode|gzinflate|str_rot13|gZcompress|\$_)/i,
    desc: 'webshell 载荷(体)',
  },
])

/**
 * 判定前先把载荷收敛到定值(2026-11-25 改):多轮解码 + 实体/反斜杠转义/全角折叠,
 * 单一真相源 = `normalize-input.mjs`。**只用于判定**,转发与路由仍看原串。
 * 改回单轮 `decodeURIComponent` = 重新打开 `%2527%2520union%2520select` 这条绕过面。
 */
export function normalizeScanTarget(url) {
  return decodeChain(url, { slice: WAF_POLICY.scanSlice }).text
}

function headerValue(headers, name) {
  const v = headers?.[name]
  return Array.isArray(v) ? v.join(',') : typeof v === 'string' ? v : ''
}

/**
 * 检查一条请求。返回命中的规则清单与建议动作。
 * `action`: 'block'(有 critical/high 命中) | 'observe'(只有 medium) | 'allow'。
 *
 * `body` 是**已经完整读出来的文本**(流处理由 `body-sniff.mjs` 负责)。
 * 本函数保持纯函数:不在里面碰流,单测才能直接喂字符串。传 `null` = 没嗅到体,等同于不扫。
 */
export function inspectRequest({ method = 'GET', url = '', headers = {}, body = null } = {}) {
  const target = normalizeScanTarget(url)
  const ua = headerValue(headers, 'user-agent').slice(0, 512)
  const hits = []

  if (String(url).length > WAF_POLICY.maxUrlLength) {
    hits.push({ id: 'url-too-long', severity: 'high', desc: `URL 长度 ${String(url).length} 超过 ${WAF_POLICY.maxUrlLength}` })
  }

  for (const rule of WAF_RULES) {
    let subject = ''
    if (rule.target === 'url') subject = target
    else if (rule.target === 'ua') subject = ua
    else if (rule.target === 'method') subject = String(method).toUpperCase()
    if (!subject) continue
    if (rule.re.test(subject)) hits.push({ id: rule.id, severity: rule.severity, desc: rule.desc })
  }

  // 体判定:与 URL 走同一条归一化链(表单体里的 `%27` 同样能套娃),只是判定面更宽。
  // 体规则的遍历只允许在 `inspectBody` 一处发生 —— 流式滚动扫描(大体)也要走它,
  // 第二份实现必然漂移(§0.6),而漂移的后果是"两条路径判出两个结果"。
  for (const h of inspectBody(body)) hits.push(h)

  const blocking = hits.filter((h) => h.severity === 'critical' || h.severity === 'high')
  const action = blocking.length ? 'block' : hits.length ? 'observe' : 'allow'
  return { action, hits, blocking }
}

/**
 * 只判请求体的单一出口(2026-11-25 立)。
 *
 * 两条路径共用它:
 *   · `inspectRequest` 对已整段读到的体做一次性判定;
 *   · `createRollingScanner`(body-sniff.mjs)对大体做流式滚动判定 —— 那里每次只喂一小段,
 *     但仍然走这里,规则集与归一化链不会出现第二份。
 */
export function inspectBody(body) {
  if (typeof body !== 'string' || !body.length) return []
  const target = decodeChain(body, { slice: WAF_POLICY.bodyScanSlice }).text
  const hits = []
  for (const rule of BODY_RULES) {
    if (rule.re.test(target)) hits.push({ id: rule.id, severity: rule.severity, desc: rule.desc })
  }
  return hits
}

/** 档位解析:非法值回落 enforce(失效方向 = 保持有防护,绝不因配错变 off)。 */
export function resolveWafMode(raw) {
  const v = String(raw ?? '').trim().toLowerCase()
  if (v === 'off' || v === 'observe' || v === 'enforce') return v
  return 'enforce'
}

/** 给人看的一行摘要(日志用,不含原始载荷,避免把攻击串写回日志再被二次利用)。 */
export function summarizeHits(hits) {
  return (hits ?? []).map((h) => h.id).join(',')
}

export const __test__ = { normalizeScanTarget, inspectRequest, inspectBody, resolveWafMode, summarizeHits, BODY_RULES }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
