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
export function probeOnce({ host = '127.0.0.1', port = 8801, path = '/api/.env', headers = {}, timeoutMs = 5000 } = {}) {
  if (!/^(?:127\.0\.0\.1|::1|localhost)$/.test(host)) return Promise.resolve({ skipped: true, reason: '非回环目标,拒绝探测' })
  return new Promise((resolve) => {
    const req = request({ host, port, path, method: 'GET', headers, timeout: timeoutMs }, (res) => {
      res.resume()
      resolve({
        status: res.statusCode,
        evidence: res.headers['x-ihui-evidence'] ?? null,
        verdict: res.headers['x-ihui-notice'] ?? null,
      })
    })
    req.on('timeout', () => {
      req.destroy()
      resolve({ error: 'timeout' })
    })
    req.on('error', (err) => resolve({ error: String(err?.code ?? err) }))
    req.end()
  })
}

async function main() {
  const root = process.cwd()
  const stateDir = join(root, '.ihui-agent', 'state')
  const jsonOut = process.argv.includes('--json')

  const ruleset = runRuleset()

  let online = { skipped: true, reason: '未提供 IHUI_EDGE_SECRET(env / .env / nssm 三处都没读到)' }
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
  }

  const out = { generatedAt: new Date().toISOString(), ruleset, online }
  mkdirSync(stateDir, { recursive: true })
  writeFileSync(join(stateDir, 'redteam-selftest.json'), `${JSON.stringify(out, null, 2)}\n`, 'utf8')

  if (jsonOut) {
    console.log(JSON.stringify(out, null, 2))
  } else {
    console.log(`规则回归: ${ruleset.passed}/${ruleset.total} 通过${ruleset.ok ? '' : ' ✗'}`)
    for (const f of ruleset.failed) console.log(`  失败 ${f.name}: 期望 ${f.expectRule ?? 'allow'} 实得 ${f.got}(${f.rules.join(',') || '无命中'})`)
    console.log(`在线探针: ${online.skipped ? `跳过(${online.reason})` : online.pass ? `通过 · ${online.evidence} · 密钥来源 ${online.secretSource}` : `未通过 · ${online.why}`}`)
  }
  process.exit(ruleset.ok ? 0 : 1)
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}`) main()

export const __test__ = { BLOCK_CASES, SAFE_CASES, runRuleset, probeOnce }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
