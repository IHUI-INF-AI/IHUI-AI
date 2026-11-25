// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 诊断需要 stdout */
/**
 * 红队自测(2026-11-24 立)。
 *
 * 为什么要有:规则写了不等于拦得住。「WAF 有 25 条规则」和「这 25 条真能拦住 25 种攻击」
 * 是两件事 —— 只有拿已知载荷打一遍才知道。同时必须反向测「不误伤」:
 * 正常中文搜索词、正常路径不能被封,否则防线会把自己的用户打掉。
 *
 * 两段:
 *   ① 规则自测(离线,必跑):直接调 WAF 纯函数,分「该拦的」与「不该拦的」两组逐条断言。
 *      这一步不需要网络、不影响生产,是最可靠的回归。
 *   ② 在线探针(可选):对 127.0.0.1:8801 真发一次。**只打回环**,目标非回环一律拒绝执行。
 *      router 前置有 edge guard(enforce),拿不到共享密钥时请求会先被它 403 ——
 *      那种情况下在线探针记为 skipped,不冒充「WAF 通过」。
 */
import { request } from 'node:http'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { inspectRequest } from '../../deploy/win/lib/waf-signatures.mjs'
import { resolveEdgeSecret } from './lib/edge-secret.mjs'

/** 必拦用例:每条都对应一条真实规则族。 */
export const BLOCK_CASES = Object.freeze([
  { name: 'sqli-union', req: { url: '/?q=1%20union%20select%201' }, expectRule: 'sqli-union-select' },
  { name: 'sqli-time', req: { url: "/?id=1'and(sleep(5))" }, expectRule: 'sqli-time' },
  { name: 'xss-script', req: { url: '/?x=%3Cscript%3Ealert(1)%3C/script%3E' }, expectRule: 'xss-script' },
  { name: 'path-traversal', req: { url: '/../../etc/passwd' }, expectRule: 'path-traversal' },
  { name: 'sensitive-file', req: { url: '/api/.env' }, expectRule: 'path-sensitive' },
  { name: 'cmd-injection', req: { url: '/?cmd=;%20cat%20/etc/passwd' }, expectRule: 'cmd-injection' },
  { name: 'ssrf-metadata', req: { url: '/?url=http://169.254.169.254/latest/meta-data' }, expectRule: 'ssrf-metadata' },
  { name: 'ssti', req: { url: '/?t=%7B%7Bconfig%7D%7D' }, expectRule: 'ssti' },
  { name: 'scanner-ua', req: { url: '/api/health', headers: { 'user-agent': 'sqlmap/1.7.2#stable' } }, expectRule: 'scanner-ua' },
  { name: 'method-trace', req: { method: 'TRACE', url: '/' }, expectRule: 'method-trace' },
  // 后台探测是 medium 档:只记录不拦(真拦会误伤一堆找后台的搜索引擎爬虫),断言它「命中且只观察」
  { name: 'admin-scan', req: { url: '/wp-login.php' }, expectRule: 'path-admin-scan', expectAction: 'observe' },
])

/** 不该拦用例:误伤是防线的另一种失败。 */
export const SAFE_CASES = Object.freeze([
  { name: 'health', req: { url: '/api/health' } },
  { name: '中文搜索词', req: { url: '/?q=%E6%9F%A1%E8%AF%84%E6%B5%81%E7%A8%8B' } },
  { name: '英文单词 select', req: { url: '/?tab=select-a-plan' } },
  { name: '正常文章路径', req: { url: '/docs/guide/security-notes' } },
  { name: '正常 UA', req: { url: '/', headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0' } } },
])

/** 纯规则回归:返回逐条结果与总判定。 */
export function runRuleset({ blockCases = BLOCK_CASES, safeCases = SAFE_CASES } = {}) {
  const results = []
  for (const c of blockCases) {
    const v = inspectRequest({ method: c.req.method ?? 'GET', url: c.req.url, headers: c.req.headers ?? {} })
    const hit = v.hits.some((h) => h.id === c.expectRule)
    const expectAction = c.expectAction ?? 'block'
    results.push({ name: c.name, group: 'block', pass: v.action === expectAction && hit, got: v.action, rules: v.hits.map((h) => h.id), expectRule: c.expectRule, expectAction })
  }
  for (const c of safeCases) {
    const v = inspectRequest({ method: c.req.method ?? 'GET', url: c.req.url, headers: c.req.headers ?? {} })
    results.push({ name: c.name, group: 'safe', pass: v.action === 'allow', got: v.action, rules: v.hits.map((h) => h.id) })
  }
  const failed = results.filter((r) => !r.pass)
  return { results, total: results.length, passed: results.length - failed.length, failed, ok: failed.length === 0 }
}

/**
 * 在线探针:只允许回环目标。返回 `{skipped, reason}` / `{status, evidence}` / `{error}`。
 *
 * 为什么必须带 evidence:只看 403 会**假通过** —— 回源鉴权(user-agent 或 secret 不对)
 * 拦下也是 403,但那个 403 不带证据编号。只有 WAF 给的 403 才带 `x-ihui-evidence`,
 * 那才是"这条载荷真被规则拦了"。判"通过"要两个条件同时成立。
 */
export function probeOnce({ host = '127.0.0.1', port = 8801, path = '/api/.env', method = 'GET', headers = {}, body = null, timeoutMs = 5000 } = {}) {
  if (!/^(?:127\.0\.0\.1|::1|localhost)$/.test(host)) return Promise.resolve({ skipped: true, reason: '非回环目标,拒绝探测' })
  return new Promise((resolve) => {
    const req = request({ host, port, path, method, headers, timeout: timeoutMs }, (res) => {
      let bytes = 0
      res.on('data', (c) => { bytes += c.length })
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          evidence: res.headers['x-ihui-evidence'] ?? null,
          verdict: res.headers['x-ihui-notice'] ?? null,
          bytes,
        })
      })
      res.resume()
    })
    req.on('timeout', () => {
      req.destroy()
      resolve({ error: 'timeout' })
    })
    req.on('error', (err) => resolve({ error: String(err?.code ?? err) }))
    if (body != null) req.write(body)
    req.end()
  })
}

/**
 * 在线全量:把 BLOCK_CASES 里能当 URL 打的那几条逐条真发一次。
 *
 * 为什么这件事值得真打:纯规则回归只能证明「判据函数判对了」。
 * 从「判据判对」到「攻击者真的收到 403 且拿到编号」之间还有整条链路 ——
 * 归一化、header 取值、判定点位置、denyWithNotice 的编号生成、边缘守卫是否先把它拦掉。
 * 中间任何一环断了,纯函数都还是绿的。
 *
 * 这一步**不接 autoban**、只在人跑 --full 时执行:每次真打都会往证据链里加条目,
 * 定时跑等于自己给自己灌噪声、把真攻击淹没。
 */
export function onlineCasesOf(blockCases = BLOCK_CASES) {
  const out = []
  for (const c of blockCases) {
    if (!c.req.url || !c.req.url.startsWith('/')) continue
    out.push({
      name: c.name,
      path: c.req.url,
      method: c.req.method ?? 'GET',
      headers: c.req.headers ?? {},
      /* observe 档(admin-scan)设计上就不拦,请求会继续走到上游 —— 上游没有该路径就是 404。
         这里要断言的是「没被判成 block」,不是「上游一定回 200」。 */
      expectObserve: c.expectAction === 'observe',
      expectStatus: c.expectAction === 'observe' ? null : 403,
      expectEvidence: c.expectAction !== 'observe',
    })
  }
  return out
}

/** body 扫描在线三例:证明「请求体里的攻击」在真实链路上也被拦。
 *  载荷必须与 BODY_RULES 的正则逐字对齐,否则测的是「规则没命中」而不是「链路断了」:
 *  sqli-union-select-body 要求 union/select/**from** 三段齐全(缺 from 不命中)。 */
export const ONLINE_BODY_CASES = Object.freeze([
  { name: 'body-sqli', contentType: 'application/json', body: '{"q":"1 union select 1 from users"}' },
  { name: 'body-xss', contentType: 'application/json', body: '{"c":"<script>alert(1)</script>"}' },
  { name: 'body-cmd', contentType: 'application/json', body: '{"x":"; cat /etc/passwd"}' },
])

export async function probeAll({ host = '127.0.0.1', port = 8801, secret, timeoutMs = 8000, bodyCases = ONLINE_BODY_CASES } = {}) {
  const rows = []
  for (const c of onlineCasesOf()) {
    const headers = { ...c.headers, 'x-ihui-edge-secret': secret }
    if (!headers['user-agent']) headers['user-agent'] = 'ihui-selftest'
    const r = await probeOnce({ host, port, path: c.path, method: c.method, headers, timeoutMs })
    let pass
    let why
    if (c.expectObserve) {
      /* observe 档:只要不是 403(不被 block),也不出错,就算通过。上游回 404/200 都正常。 */
      pass = !r.error && r.status !== 403
      why = r.error ?? (r.status === 403 ? 'observe 档却返回 403(被误判成 block)' : `未拦,上游回 ${r.status}`)
    } else {
      const statusOk = r.status === c.expectStatus
      const evidenceOk = c.expectEvidence ? Boolean(r.evidence) : true
      pass = !r.error && statusOk && evidenceOk
      why = r.error ?? (statusOk ? (evidenceOk ? 'ok' : '无证据编号') : `期望 ${c.expectStatus} 实得 ${r.status}`)
    }
    rows.push({ group: 'url', name: c.name, path: c.path, status: r.status ?? null, evidence: r.evidence ?? null, error: r.error ?? null, pass, why })
  }
  for (const c of bodyCases) {
    const headers = { 'x-ihui-edge-secret': secret, 'user-agent': 'ihui-selftest', 'content-type': c.contentType, 'content-length': String(Buffer.byteLength(c.body)) }
    const r = await probeOnce({ host, port, path: '/api/health', method: 'POST', headers, body: c.body, timeoutMs })
    const pass = !r.error && r.status === 403 && Boolean(r.evidence)
    rows.push({ group: 'body', name: c.name, path: '/api/health', status: r.status ?? null, evidence: r.evidence ?? null, error: r.error ?? null, pass, why: r.error ?? (r.status === 403 ? (r.evidence ? 'ok' : '403 无编号(可能是 CSRF 而非 WAF)') : `期望 403 实得 ${r.status}`) })
  }
  return { rows, total: rows.length, passed: rows.filter((r) => r.pass).length, ok: rows.every((r) => r.pass) }
}

async function main() {
  const root = process.cwd()
  const stateDir = join(root, '.ihui-agent', 'state')
  const jsonOut = process.argv.includes('--json')
  const full = process.argv.includes('--full')

  const ruleset = runRuleset()

  let online = { skipped: true, reason: '未提供 IHUI_EDGE_SECRET(env / .env / nssm 三处都没读到)' }
  let fullResult = null
  const sec = resolveEdgeSecret()
  if (sec.value) {
    const r = await probeOnce({ path: '/api/.env', headers: { 'x-ihui-edge-secret': sec.value, 'user-agent': 'ihui-selftest' } })
    if (r.skipped) {
      online = r
    } else {
      const blocked = r.status === 403 && Boolean(r.evidence)
      online = {
        status: r.status,
        evidence: r.evidence ?? null,
        secretSource: sec.source,
        error: r.error ?? null,
        pass: blocked,
        why: r.error
          ? `探测出错 ${r.error}`
          : r.status !== 403
            ? `状态 ${r.status},期望 403`
            : r.evidence
              ? 'WAF 403 且带证据编号'
              : '403 但没有证据编号 —— 可能是回源鉴权拦的,不是 WAF,不算通过',
      }
    }
    if (full && !r.skipped) {
      fullResult = await probeAll({ secret: sec.value })
    }
  } else if (full) {
    fullResult = { skipped: true, reason: online.reason }
  }

  const out = { generatedAt: new Date().toISOString(), ruleset, online, full: fullResult }
  mkdirSync(stateDir, { recursive: true })
  writeFileSync(join(stateDir, full ? 'redteam-full.json' : 'redteam-selftest.json'), `${JSON.stringify(out, null, 2)}\n`, 'utf8')

  if (jsonOut) {
    console.log(JSON.stringify(out, null, 2))
  } else {
    console.log(`规则回归: ${ruleset.passed}/${ruleset.total} 通过${ruleset.ok ? '' : ' ✗'}`)
    for (const f of ruleset.failed) console.log(`  失败 ${f.name}: 期望 ${f.expectRule ?? 'allow'} 实得 ${f.got}(${f.rules.join(',') || '无命中'})`)
    console.log(`在线探针: ${online.skipped ? `跳过(${online.reason})` : online.pass ? `通过 · ${online.evidence} · 密钥来源 ${online.secretSource}` : `未通过 · ${online.why}`}`)
    if (fullResult) {
      if (fullResult.skipped) {
        console.log(`全量回归: 跳过(${fullResult.reason})`)
      } else {
        console.log(`全量回归: ${fullResult.passed}/${fullResult.total} 通过${fullResult.ok ? '' : ' ✗'}`)
        for (const row of fullResult.rows.filter((x) => !x.pass)) console.log(`  失败 [${row.group}] ${row.name} ${row.path} → ${row.why}`)
      }
    }
  }
  const allOk = ruleset.ok && (fullResult ? fullResult.skipped ? false : fullResult.ok : true)
  process.exit(allOk ? 0 : 1)
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}`) main()

export const __test__ = { BLOCK_CASES, SAFE_CASES, runRuleset, probeOnce, onlineCasesOf, probeAll, ONLINE_BODY_CASES }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
