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
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
// 唯一入口:源脚本的 __test__ 导出(§22c 第 2 步)。禁止在这里复制判据。
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
  assert.match(E.egressFallbackPlan({ ...base, attempt: 1 }).why, /不得连环换腿/)
})

test('③a 第一趟走的是代理 ⇒ 兜底只往直连换,不叠加别的', () => {
  const r = E.egressFallbackPlan({ ...base })
  assert.equal(r.apply, true, r.why)
  assert.equal(r.useDirectArgs, true, '代理趟失败应换到直连腿(摘代理),不是再套一层代理')
})

/**
 * 对称格(2026-10-26 当天实测逼出来的):`--no-proxy` 显式走直连后,**只剩代理腿可用**那一刻
 * 必须换回去。不兜这一格 = "我明明有腿却判无法判定远端位置",收敛器整轮白跑
 * (当天 09:20 直连腿 `Failed to connect to github.com:443` 就是这么把 rc 打成 2 的)。
 */
test('③a2 第一趟走的是直连 ⇒ 换回代理腿,且方向标必须反过来', () => {
  const r = E.egressFallbackPlan({
    ...base,
    alreadyDirect: true,
    usedDirect: true,
    errText:
      "fatal: unable to access 'https://github.com/x/y.git/': Failed to connect to github.com:443 after 21061 ms: Could not connect to server",
  })
  assert.equal(r.apply, true, r.why)
  assert.equal(r.useDirectArgs, false, '直连趟失败必须换回代理腿(不能把摘代理参数再套一次)')
  assert.match(r.why, /换回代理腿重跑一次/)
})

test('③a3 直连趟失败而仓内没配代理 ⇒ 确实没腿可换,判失败不硬造第二趟', () => {
  const r = E.egressFallbackPlan({
    ...base,
    proxyUrl: '',
    alreadyDirect: true,
    usedDirect: true,
  })
  assert.equal(r.apply, false)
  assert.match(r.why, /没有另一条腿可换/)
})

test('③a4 服务器裁决即便是直连趟也不许换腿(方向对称不等于放宽判据)', () => {
  const r = E.egressFallbackPlan({
    ...base,
    verb: 'push',
    alreadyDirect: true,
    usedDirect: true,
    errText: 'remote: error: GH006: Protected branch update failed for refs/heads/main.',
  })
  assert.equal(r.apply, false, r.why)
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

test('③e 显式绕过通道:IHUI_GIT_NO_PROXY=1 ⇒ isForceDirect 为真,失败后换回的腿必须是代理', () => {
  const prev = process.env.IHUI_GIT_NO_PROXY
  try {
    delete process.env.IHUI_GIT_NO_PROXY
    assert.equal(E.isForceDirect(), false, '没设 env 时不得凭空直连')
    process.env.IHUI_GIT_NO_PROXY = '1'
    assert.equal(E.isForceDirect(), true, '设了 IHUI_GIT_NO_PROXY=1 却读不到 ⇒ --no-proxy 是空旗标')
    // 第一趟已按绕过走过直连 ⇒ 兜底只能往回换(有代理才换),且 attempt>0 时绝不三度换腿
    const r = E.egressFallbackPlan({
      verb: 'push',
      errText: REAL_TRANSPORT_STDERR,
      status: 128,
      proxyUrl: PROXY,
      alreadyDirect: true,
      usedDirect: true,
    })
    assert.equal(r.apply, true, r.why)
    assert.equal(r.useDirectArgs, false, '把摘代理参数再套一次等于原地重试,修不了任何东西')
    assert.equal(
      E.egressFallbackPlan({
        verb: 'push',
        errText: REAL_TRANSPORT_STDERR,
        status: 128,
        proxyUrl: PROXY,
        alreadyDirect: true,
        usedDirect: true,
        attempt: 1,
      }).apply,
      false,
      '换腿只多跑一次 ⇒ 两腿都失败就如实上报',
    )
  } finally {
    if (prev === undefined) delete process.env.IHUI_GIT_NO_PROXY
    else process.env.IHUI_GIT_NO_PROXY = prev
  }
})

test('③f 通道接线锁:converge 的 --no-proxy 必须落到 env,face-reader 第一趟就用上', () => {
  const conv = readFileSync(join(here, '..', 'git-sync-converge.mjs'), 'utf8')
  assert.match(
    conv,
    /argv\.includes\('--no-proxy'\)[\s\S]{0,260}process\.env\.IHUI_GIT_NO_PROXY = '1'/,
    '--no-proxy 只报名不置 env ⇒ 空旗标(AGENTS §0.8:文档里的出路必须真跑得通)',
  )
  const src = readFileSync(join(here, '..', 'lib', 'face-reader.mjs'), 'utf8')
  assert.match(
    src,
    /const forceDirect = Boolean\(opts\.forceDirect\) \|\| isForceDirect\(\)/,
    'gitRaw 没读绕过旗标',
  )
  assert.match(
    src,
    /return runOnce\(forceDirect \? GIT_EGRESS_DIRECT_ARGS : \[\]\)/,
    '第一趟没用上绕过参数(旗标只置变量不改派生)⇒ --no-proxy 是空旗标',
  )
  assert.match(
    src,
    /usedDirect: firstTriedDirect/,
    '没把"第一趟走的哪条腿"交给判据 ⇒ 直连趟失败会再摘一次代理(原地重试)',
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
  // 两个方向都要由 plan.useDirectArgs 决定(写死任一方向 = 只兜一条腿的偏判)
  assert.match(
    body,
    /runOnce\(plan\.useDirectArgs \? GIT_EGRESS_DIRECT_ARGS : \[\]\)/,
    'gitRaw 的换腿方向不是由判据给的 ⇒ 对称格是假的',
  )
  assert.match(
    body,
    /firstTriedDirect = forceDirect \|\| args\.includes\('http\.proxy='\)/,
    '没把"第一趟走的哪条腿"传进判据 ⇒ 直连趟失败会被再摘一次代理',
  )
  assert.match(body, /return runOnce\(forceDirect \? GIT_EGRESS_DIRECT_ARGS : \[\]\)/, '绕过旗标没作用到第一趟')
  assert.match(body, /err\.egressPlan = plan/, '兜底为什么没生效必须随异常带出来,不许静默')
  // 两腿都不通也必须留痕(显式绕过时 plan.apply=false,不写就又把失效做成了安静)
  assert.match(
    body,
    /else if \(firstTriedDirect && GIT_EGRESS_TRANSPORT_RE\.test\(gitErrText\(e\)\)\)[\s\S]{0,220}noteEgressDegradation/,
    '显式绕过又没腿可换时不留痕 = §12f 那个"失效表现为安静"的老坑',
  )
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

/**
 * ⑤ 退化留痕账本自身必须会老化(§0.7 同纪律:只增不减的账本迟早没人看),
 *   且"被裁条数"只能写进账本自己 —— 共享层往 stdout/stderr 打一行,就会混进几百把尺子的逐字基线比对。
 */
test('⑤ 留痕老化:超窗裁、窗内留、认不出时刻的一律保留', () => {
  const now = Date.parse('2026-10-26T12:00:00.000Z')
  const fresh = `2026-10-26T09:00:00.000Z\tverb=push\tfallback=recovered\n`
  const stale31 = `2026-09-25T09:00:00.000Z\tverb=fetch\tfallback=both-failed\n`
  const stale29 = `2026-09-27T09:00:00.000Z\tverb=fetch\tfallback=both-failed\n`
  const noTs = `没有时刻的一行(取证时手敲的)\n`
  const r = E.pruneEgressLedger(`${stale31}${stale29}${fresh}${noTs}`, { nowMs: now })
  assert.equal(r.dropped, 1, '只该裁超 30 天那一条(29 天窗内)')
  assert.ok(r.text.includes('verb=fetch\tboth') === false)
  assert.ok(r.text.includes('fallback=both-failed') === false || !r.text.includes(stale31.trim()))
  assert.ok(r.text.includes('verb=push'), '窗内行不得被裁')
  assert.ok(r.text.includes(noTs.trim()), '解析不出时刻的行必须保留(多留 > 静默删证据)')
  assert.equal(E.EGRESS_LEDGER_KEEP_DAYS, 30, '存活期常量被人改了要报名')
})

test('⑤a 老化写法:报数进账本,不打进 stdout/stderr', () => {
  const src = readFileSync(join(here, '..', 'lib', 'face-reader.mjs'), 'utf8')
  const at = src.indexOf('const pruned = pruneEgressLedger(raw)')
  assert.ok(at > 0, '写入器没真的调老化判据(造好没装车)')
  const body = src.slice(at, src.indexOf('return file', at))
  assert.match(body, /cad=prune/, '被裁条数必须写进账本自己')
  assert.doesNotMatch(body, /console\.(log|error|warn)\(/, '共享层打印会污染几百把尺子的基线比对')
  assert.doesNotMatch(body, /process\.stdout|process\.stderr/, '同上:不得直接写标准流')
})

test('⑤b 老化只在真裁了的时候才写(空裁不得改文件、不得追加 marker)', () => {
  const now = Date.parse('2026-10-26T12:00:00.000Z')
  const r = E.pruneEgressLedger(
    '2026-10-26T09:00:00.000Z\tverb=push\tfallback=recovered\n',
    { nowMs: now },
  )
  assert.equal(r.dropped, 0)
  assert.equal(r.kept, 1)
})

/**
 * ⑤c 端到端:老化**随写入触发**(不另立调度器 —— 本仓教训:关键自愈别挂到会自己消失的东西上)。
 * 健康期账本本来就不长 ⇒ 不老化不是缺陷;真发生退化时,超窗行必须当场被裁并留下报数 marker。
 * 写盘落点用 mkScratch(§15b),不碰真账本。
 */
test('⑤c 写入器真会老化并留 marker(端到端,不只看纯函数)', () => {
  const root = mkScratch('egress-ledger-e2e')
  try {
    const stateDir = join(root, '.ihui-agent', 'state')
    mkdirSync(stateDir, { recursive: true })
    const file = join(stateDir, 'git-egress-degradation.log')
    const old = `${new Date(Date.now() - 31 * 86400_000).toISOString()}\tverb=fetch\tfallback=both-failed\t依据=夹具\n`
    writeFileSync(file, old, 'utf8')
    const wrote = E.noteEgressDegradation({
      root,
      verb: 'push',
      plan: { why: '夹具:配了代理且回显是传输形态 ⇒ 摘代理直连重跑一次' },
      ok: false,
    })
    assert.ok(wrote, '写入器返回 null ⇒ 留痕根本没落地')
    const after = readFileSync(file, 'utf8')
    assert.ok(!after.includes('依据=夹具\nverb') && !after.includes(old.trim()), '超窗 31 天的旧行必须被裁掉')
    assert.match(after, /verb=push\tfallback=both-failed/, '本次留痕必须写下')
    assert.match(after, /cad=prune\tdropped=1\tkept=1\tkeepDays=\d+/, '被裁条数必须报进账本自己(静默丢行=账本看着一直完整)')
  } finally {
    rmScratch(root)
  }
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

