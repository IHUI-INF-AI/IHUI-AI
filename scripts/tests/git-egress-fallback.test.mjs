// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试 —— 代理腿退化判据本体在 `scripts/lib/face-reader.mjs`,本文件**只 import 它的
// `__test__` 出口**,不在这里重写动词表/正则/判序(两处算同一件事必漂移)。
//
// 本票(2026-10-26)钉死四格,退化任意一格即红:
//   ① 兜底只发生在"网络动词 ∧ 配了代理 ∧ 退出码 128 ∧ 传输形态回显"四条件同时成立时 ——
//      少一条就返回 apply:false(每条各有一例反证)。
//   ② **服务器裁决绝不被兜**:`(non-fast-forward)` / `protected branch` / `cannot lock ref`
//      这些回显必须落 apply:false,否则本器物就把 push-attempt-triage 的判序洗成"换个腿再试"。
//   ③ 只多跑一次(attempt>0 ⇒ false),且兜底注入的是**空值** `-c http.proxy=`(非空就不是摘代理)。
//   ④ 接线锁(§0.9 造好没装车=没有):判据与两个常数必须真被 `gitRaw` 消费,摘线即红。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as E } from '../lib/face-reader.mjs'

const here = dirname(fileURLToPath(import.meta.url))

/** 本机 2026-10-26 15:xx 实测原文(成组对照 20/20 同型),逐字取自 `git ls-remote origin`。 */
const REAL_TRANSPORT_STDERR =
  "fatal: unable to access 'https://github.com/IHUI-INF-AI/IHUI-AI.git/': Recv failure: Connection was aborted"

const PROXY = 'http://127.0.0.1:7897'

const base = { verb: 'ls-remote', errText: REAL_TRANSPORT_STDERR, status: 128, proxyUrl: PROXY }

test('① 四条件齐备 ⇒ 兜底(本机实测原文)', () => {
  const r = E.egressFallbackPlan(base)
  assert.equal(r.apply, true, r.why)
  assert.match(r.why, /摘代理直连重跑一次/)
})

test('①a 反证·本地动词不补第二趟(cat-file)', () => {
  assert.equal(E.egressFallbackPlan({ ...base, verb: 'cat-file' }).apply, false)
  assert.equal(E.egressFallbackPlan({ ...base, verb: 'rev-parse' }).apply, false)
})

test('①b 反证·没配代理就没有可摘的腿', () => {
  assert.equal(E.egressFallbackPlan({ ...base, proxyUrl: '' }).apply, false)
})

test('①c 反证·退出码不是 128 就不是 git 网络层形态', () => {
  for (const status of [1, 0, null, undefined, 129]) {
    assert.equal(E.egressFallbackPlan({ ...base, status }).apply, false, `status=${status}`)
  }
})

test('①d 反证·回显不是传输形态就不兜(交既有分档)', () => {
  for (const errText of [
    'fatal: Needed a single revision',
    'error: code 128 while executing git',
    'remote: error: 404 Not Found',
  ]) {
    assert.equal(E.egressFallbackPlan({ ...base, errText }).apply, false, errText)
  }
})

test('② 服务器裁决三型一律不兜(否则等于把 triage 判序洗掉)', () => {
  const serverVerdicts = {
    'non-fast-forward':
      " ! [rejected]        main -> main (non-fast-forward)\nerror: failed to push some refs",
    'protected-branch':
      'remote: error: GH006: Protected branch update failed for refs/heads/main.\n ! [remote rejected] main -> main (protected branch hook declined)',
    'remote-ref-race': " ! [remote rejected] main -> main (cannot lock ref 'refs/heads/main')",
    'credentials-unavailable': "fatal: could not read Username for 'https://github.com'",
  }
  for (const [name, errText] of Object.entries(serverVerdicts)) {
    const r = E.egressFallbackPlan({ ...base, verb: 'push', errText })
    assert.equal(r.apply, false, `${name} 被兜底吃掉了:${r.why}`)
  }
})

test('③ 兜底只多跑一次', () => {
  assert.equal(E.egressFallbackPlan({ ...base, attempt: 1 }).apply, false)
  assert.match(E.egressFallbackPlan({ ...base, attempt: 1 }).why, /不得连环重试/)
})

test('③a 已带摘代理配置的趟不叠加', () => {
  assert.equal(E.egressFallbackPlan({ ...base, alreadyDirect: true }).apply, false)
})

test('③b 注入形态必须是空值 argv(-c http.proxy=)', () => {
  assert.deepEqual([...E.GIT_EGRESS_DIRECT_ARGS], ['-c', 'http.proxy=', '-c', 'https.proxy='])
  // 形状锁:值一旦写成非空,就不是"摘掉代理"而是"换个代理",本器语义整体走形
  for (const a of E.GIT_EGRESS_DIRECT_ARGS) {
    if (a.includes('proxy=')) assert.equal(a.split('=')[1], '', a)
  }
})

test('③c 网络动词集逐格点名(漏一个就少一格兜底)', () => {
  for (const v of ['fetch', 'push', 'ls-remote', 'pull', 'clone', 'fetch-pack', 'archive']) {
    assert.ok(E.GIT_EGRESS_NETWORK_VERBS.includes(v), `动词表缺 ${v}`)
  }
  for (const v of ['cat-file', 'rev-parse', 'show', 'config', 'status']) {
    assert.ok(!E.GIT_EGRESS_NETWORK_VERBS.includes(v), `本地动词 ${v} 不得入表`)
  }
})

test('③d 实测补因:直连腿自己也会断,且断法是 "Connection was reset"(不能只认 aborted)', () => {
  // 当天 09:43 实测:摘掉代理直连回 `fatal: unable to access …: Recv failure: Connection was reset`
  // ⇒ 两腿都不通时判据仍要认得这一型(留痕要写"两条腿都不通",不得冒充"没配代理所以失败")
  const RESET =
    "fatal: unable to access 'https://github.com/x/y.git/': Recv failure: Connection was reset"
  assert.ok(E.GIT_EGRESS_TRANSPORT_RE.test(RESET), 'Connection was reset 未被认成传输形态')
  const r = E.egressFallbackPlan({
    verb: 'ls-remote',
    errText: RESET,
    status: 128,
    proxyUrl: PROXY,
  })
  assert.equal(r.apply, true, r.why)
  // 成对反证:`not a git repository`(确定性,重试修不了)与 `HTTP 403`(凭据/权限)都不得兜
  assert.equal(
    E.egressFallbackPlan({
      verb: 'fetch',
      errText: "fatal: not a git repository: '/nope/.git'",
      status: 128,
      proxyUrl: PROXY,
    }).apply,
    false,
    '"not a git repository" 被兜底 = 拿重试赌仓根本不存在',
  )
  assert.equal(
    E.egressFallbackPlan({
      verb: 'push',
      errText: 'The requested URL returned error: 403',
      status: 128,
      proxyUrl: PROXY,
    }).apply,
    false,
    'HTTP 403 属权限/凭据档,不得换腿再试',
  )
})

test('③d 实测补因:直连腿自己也会断,断法是 "Connection was reset"(不能只认 aborted)', () => {
  // 当天 09:43 实测:摘掉代理直连回 `Recv failure: Connection was reset` ⇒ 两腿都不通时
  // 判据仍要认得这一型;而 "not a git repository"(确定性)与 HTTP 403(权限/凭据)绝不许兜。
  const RESET = "fatal: unable to access 'https://github.com/x/y.git/': Recv failure: Connection was reset"
  assert.ok(E.GIT_EGRESS_TRANSPORT_RE.test(RESET), 'Connection was reset 未被认成传输形态')
  assert.equal(E.egressFallbackPlan({ verb: 'ls-remote', errText: RESET, status: 128, proxyUrl: PROXY }).apply, true)
  assert.equal(
    E.egressFallbackPlan({ verb: 'fetch', errText: 'fatal: not a git repository: /nope/.git', status: 128, proxyUrl: PROXY }).apply,
    false,
    '"not a git repository" 被兜底 = 拿重试赌仓根本不存在',
  )
  assert.equal(
    E.egressFallbackPlan({ verb: 'push', errText: 'The requested URL returned error: 403', status: 128, proxyUrl: PROXY }).apply,
    false,
    'HTTP 403 属权限/凭据档,不得换腿再试',
  )
})

test('④ 接线锁:gitRaw 必须真的消费这套判据(摘线即红)', () => {
  const src = readFileSync(join(here, '..', 'lib', 'face-reader.mjs'), 'utf8')
  const start = src.indexOf('export function gitRaw(')
  assert.ok(start >= 0, 'gitRaw 不见了')
  const nextExport = src.indexOf('\nexport ', start + 1)
  const body = src.slice(start, nextExport === -1 ? src.length : nextExport)
  assert.match(body, /egressFallbackPlan\(\{/, 'gitRaw 没调用判据(函数在而无人用 = §0.9 那一型)')
  assert.match(body, /proxyConfiguredFor\(root\)/, 'gitRaw 没现读代理配置 ⇒ 判据永远拿不到输入')
  assert.match(body, /runOnce\(GIT_EGRESS_DIRECT_ARGS\)/, 'gitRaw 没真的用摘代理参数重跑')
  assert.match(body, /err\.egressPlan = plan/, '兜底为什么没生效必须随异常带出来,不许静默')
  // 判序锁:兜底块必须在抛 Undetermined **之前**(抛完再兜就是死代码)
  assert.ok(
    body.indexOf('if (plan.apply)') < body.indexOf('new Undetermined('),
    '兜底分支写在抛错之后 = 永远跑不到',
  )
})

test('④a 传输特征串必须命中本机实测原文,且不命中服务器用语', () => {
  assert.ok(E.GIT_EGRESS_TRANSPORT_RE.test(REAL_TRANSPORT_STDERR))
  assert.ok(E.GIT_EGRESS_TRANSPORT_RE.test('Failed to connect to 127.0.0.1 port 7897'))
  assert.ok(!E.GIT_EGRESS_TRANSPORT_RE.test('(non-fast-forward)'))
  assert.ok(!E.GIT_EGRESS_TRANSPORT_RE.test('protected branch hook declined'))
})

test('④b 镜像测试没复制判据(§22c:两处算同一件事必漂移)', () => {
  const own = readFileSync(join(here, 'git-egress-fallback.test.mjs'), 'utf8')
  // 本文件不得自行声明一份动词表/正则/兜底参数(只许 import 源)
  assert.doesNotMatch(own, /const\s+GIT_EGRESS_NETWORK_VERBS\s*=/)
  assert.doesNotMatch(own, /const\s+GIT_EGRESS_TRANSPORT_RE\s*=/)
  assert.doesNotMatch(own, /const\s+GIT_EGRESS_DIRECT_ARGS\s*=/)
})

test('④c 接线锁:git-push-guard 两处网络腿都必须问同一把尺子(摘线即红)', () => {
  const src = readFileSync(join(here, '..', 'git-push-guard.mjs'), 'utf8')
  // ① 只 import 判据,不在这里再写一份动词表/正则(§0.6 单一真相源)
  assert.match(src, /import \{[^}]*egressFallbackPlan[^}]*\} from '\.\/lib\/face-reader\.mjs'/s)
  assert.doesNotMatch(
    src,
    /^const\s+GIT_EGRESS_TRANSPORT_RE\s*=/m,
    'guard 里出现了第二份传输形态正则 = 两处算同一件事',
  )
  // ② ls-remote 那一腿(run 助手)与 push 那一腿(pushOnce)都得接上:当天实测卡死的是前者
  const runSite = src.slice(src.indexOf('function run(cmd'), src.indexOf('function getArg('))
  assert.match(runSite, /egressRetryFor\(\{/, 'run() 没接兜底 ⇒ 远端位置量不到,整条推送链哑掉')
  assert.match(runSite, /return run\(withDirectArgs\(cmd\)/, 'run() 兜底没真的换参数重跑')
  assert.match(runSite, /alreadyRetried: Boolean\(opts\.egressRetried\)/, '兜底次数没随 opts 传下去 ⇒ 会连环重试')
  const pushSite = src.slice(src.indexOf('function pushOnce('), src.indexOf('/** 对一趟 push 的结果做分诊'))
  assert.match(pushSite, /GIT_EGRESS_DIRECT_ARGS, \.\.\.args/, 'pushOnce 兜底没真的摘代理重推')
  assert.match(pushSite, /if \(r\.status !== 0 && !egressRetried\)/, 'pushOnce 缺"只多跑一次"闸门')
  // ③ 取根用脚本自身位置,不碰 cwd、不碰尚未赋值的 repoRoot(§15 / TDZ)
  assert.match(src, /const EGRESS_ROOT = resolve\(import\.meta\.dirname, '\.\.'\)/)
  assert.doesNotMatch(src, /proxyConfiguredFor\(repoRoot\)/, '拿未赋值的 repoRoot 取代理配置会踩 TDZ')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

