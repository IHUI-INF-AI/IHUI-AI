// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:判据 import 源脚本的 __test__,本文件不复制第二份。
// 锁四件事:① 装车证明(runner 有 id 230,blocking + skipEnv 成套,无撞号);
// ② R4 点名义务(AGENTS.md 点名门体 + 跳过变量);③ 判据本体走生产实现(正反成对);
// ④ 真仓 CLI 三档(全量/索引面读通 + 两面旗同给 exit 2)+ 自检真跑通。

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as gate } from '../check-auth-cookie-domain-scope.mjs'
import { idsOfRegistry } from '../check-gate-wiring.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const SCRIPT = join(ROOT, 'scripts', 'check-auth-cookie-domain-scope.mjs')
const stdio = ['ignore', 'pipe', 'pipe']

const run = (args = []) =>
  spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
    timeout: 300_000,
    stdio,
  })

const authOk = [
  "function requestRawHost(request: FastifyReply['request']): string | undefined {",
  '  return request.hostname || request.headers.host',
  '}',
  'export function resolveCookieDomain(rawHost: string | undefined): string | undefined {',
  '  return host === domain ? COOKIE_DOMAIN : undefined',
  '}',
  'export function setAuthCookies(reply: FastifyReply, payload: AuthCookiesPayload): void {',
  '  const domain = resolveCookieDomain(requestRawHost(reply.request))',
  '  reply.setCookie(AUTH_TOKEN_COOKIE, payload.accessToken, { ...(domain ? { domain } : {}) })',
  '}',
  'export function clearAuthCookies(reply: FastifyReply): void {',
  '  const domain = resolveCookieDomain(requestRawHost(reply.request))',
  '  reply.setCookie(AUTH_TOKEN_COOKIE, "", { ...(domain ? { domain } : {}) })',
  '}',
].join('\n')

test('装车证明:runner 有 id 230 条目,blocking + skipEnv 成套,且注册表无撞号(门 89 R5 同源)', () => {
  const text = readFileSync(join(ROOT, 'scripts', 'guardian-runner.mjs'), 'utf8')
  const i = text.indexOf("'check-auth-cookie-domain-scope.mjs'")
  assert.ok(i > -1, '门体未插进提交链注册表')
  const block = text.slice(Math.max(0, i - 600), i + 1400)
  assert.match(block, /mode:\s*'blocking'/, '须为 blocking')
  assert.match(
    block,
    /skipEnv:\s*'HUSKY_SKIP_AUTH_COOKIE_DOMAIN_SCOPE'/,
    'blocking 门必须成套带 skipEnv',
  )
  assert.ok(
    !/stagedTriggers:\s*\[\s*\]/.test(block),
    '禁止空 stagedTriggers 数组(归一层当场抛错,R8 同型)',
  )
  const ids = idsOfRegistry(text).map(String)
  assert.equal(ids.filter((v) => v === '230').length, 1, 'id 230 应恰好登记一枚')
  const dupes = ids.filter((v, k) => ids.indexOf(v) !== k)
  assert.deepEqual(dupes, [], `注册表撞号(门 89 R5 会拦):${dupes.join(',')}`)
})

test('R4 点名义务:AGENTS.md 通篇点名本门(门体 + 跳过变量),且体积仍在 96KB 预算内', () => {
  const agents = readFileSync(join(ROOT, 'AGENTS.md'), 'utf8')
  assert.match(agents, /check-auth-cookie-domain-scope\.mjs/, 'AGENTS.md 未点名本门')
  assert.match(agents, /HUSKY_SKIP_AUTH_COOKIE_DOMAIN_SCOPE/, '点名行须带跳过变量')
  const bytes = Buffer.byteLength(agents, 'utf8')
  assert.ok(bytes <= 96_000, `AGENTS.md ${bytes} 字节超预算 96,000(门 207 会红)`)
})

test('判据本体 import 生产实现(§22c 反复制):三族判据正反成对,摘牙即翻红', () => {
  const ok = gate.judgeCookieDomainFiles([
    { path: gate.SINGLE_SOURCE, content: authOk },
    { path: 'apps/api/src/plugins/csrf.ts', content: 'reply.setCookie("sid", t, { path: "/" })' },
  ])
  assert.deepEqual(ok.violations, [])
  const v1 = gate.judgeCookieDomainFiles([
    { path: gate.SINGLE_SOURCE, content: authOk },
    {
      path: 'apps/api/src/plugins/csrf.ts',
      content: 'reply.setCookie("sid", t, { domain: "evil.com" })',
    },
  ])
  assert.equal(v1.violations.length, 1)
  assert.equal(v1.violations[0].rule, 'V1-域外写手')
  const v2 = gate.judgeCookieDomainFiles([
    { path: gate.SINGLE_SOURCE, content: authOk.replace('request.hostname || ', '') },
  ])
  assert.equal(v2.violations[0].rule, 'V2-判据拆毁')
  const v3 = gate.judgeCookieDomainFiles([
    {
      path: gate.SINGLE_SOURCE,
      content: authOk + '\nreply.setCookie("x", v, { domain: COOKIE_DOMAIN })',
    },
  ])
  assert.equal(v3.violations[0].rule, 'V3-回归形状')
  // 注释与字符串里的形状不得误咬(遮罩纪律)
  const quiet = gate.judgeCookieDomainFiles([
    {
      path: gate.SINGLE_SOURCE,
      content: authOk + '\n// 历史:domain: COOKIE_DOMAIN\nconst d = "domain: COOKIE_DOMAIN"',
    },
  ])
  assert.deepEqual(quiet.violations, [])
  // 取不到内容 ⇒ undetermined,不冒充判绿
  const und = gate.judgeCookieDomainFiles([{ path: gate.SINGLE_SOURCE, content: null }])
  assert.equal(und.undetermined.length, 1)
})

test('形状锁:单源文件与判据常量指的都是磁盘上真在位的那一份', () => {
  assert.ok(readFileSync(join(ROOT, gate.SINGLE_SOURCE), 'utf8').includes('resolveCookieDomain'))
  assert.equal(gate.SKIP_ENV, 'HUSKY_SKIP_AUTH_COOKIE_DOMAIN_SCOPE')
  assert.ok(gate.MIN_RESOLVER_REFS >= 3, '定义 + 下发 + 摘除三个点必须同判据')
})

test('真仓正控:全量档与 --staged 都读通且扫描面是百枚级(不是枚举 0 的假绿)', () => {
  const full = run([])
  assert.equal(full.status, 0, `全量档应 0,实得 ${full.status}:\n${full.stdout}\n${full.stderr}`)
  assert.match(full.stdout, /面=head/)
  const staged = run(['--staged'])
  assert.equal(staged.status, 0, `索引面应 0,实得:\n${staged.stdout}\n${staged.stderr}`)
  assert.match(full.stdout, /扫描 \d{3,} 文件/, '扫描面应为百枚级,枚举到 0 = 假绿')
})

test('真仓反控:两面旗同给 ⇒ exit 2 未判定(不回落任一面)', () => {
  const both = run(['--staged', '--worktree'])
  assert.equal(both.status, 2, both.stdout + both.stderr)
  assert.match(both.stdout + both.stderr, /不得同用/)
})

test('自检本体真跑通(交付前置):--self-test 全过且点名例数', () => {
  const st = run(['--self-test'])
  assert.equal(st.status, 0, `${st.stdout}\n${st.stderr}`)
  assert.match(st.stdout, /自检 \d+\/\d+ 例全过/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
