#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

// =============================================================================
// deploy/tests/svc-pg-readiness.test.mjs — G-208 第三格(run-api.ps1 的 PG readiness 前置)取证
// =============================================================================
// 立票依据(PROJECT_PLAN「G-208」的「仍未落的第三格」):机器重启后 PostgreSQL 服务已进入
// RUNNING 但仍在崩溃恢复,API 在**路由注册期**执行建表会抛
// `PostgresError: the database system is starting up` 而死,而 nssm 只看子进程在不在 ⇒
// 报 RUNNING、端口从未 listen。服务顺序防不住这一型(实测 IHUI-API 的 DEPENDENCIES 本来为空)。
//
// 没有谁会发现?改动全住在 .ps1 里 —— typecheck / lint / vitest / 其余守门对它零覆盖,而
// `deploy/prod-bundle/svc/` 整目录被 .gitignore 忽略(§5e 说的那片"盲区")。所以判据只能
// 把真实现场跑出来。本测试因此分两层,缺一层都不算证据:
//   A 行为层 —— svc-pg-readiness-harness.ps1 用 AST 把 run-api.ps1 里三个函数的**原文**抽进
//     它自己的会话真定义、真调用(造临时 .env 与真/假 pg_isready),结论吐成 JSON 交这里断言。
//     为什么不在 JS 里重写判据再测:那是 §22c 说的"镜像测试只复读实现",测的是自己的副本。
//   B 结构层 —— auditScript(text) 是纯函数,判"这几条不可让的性质还在不在"(有界、超时仍启动、
//     降级必喊、端口不写死、默认不是关)。它由 B2 的六条变异对照证明有牙 —— 拿不到红就等于
//     这条判据可能在空转,而"永远绿的断言比没有断言更坏"(本仓实录)。
//
// 安全边界:探测只打 127.0.0.1:1(loopback 上一个必然被拒的端口,不是任何数据库端口),
// 全程不启停服务、不连生产库、临时物只落 .ihui-agent/tmp/。
//
// 跑法:node --test deploy/tests/svc-pg-readiness.test.mjs
// 接线现状(如实登记,不冒充已装):与 deploy/tests 其余自检同族,**未**接进 guardian-runner /
// check:all —— 那张注册表不在本票的受影响文件清单内。所以"全量审计 0 红"不覆盖本判据,
// 要问责必须手动跑这一条。
// =============================================================================
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const PWSH = 'C:\\Program Files\\PowerShell\\7\\pwsh.exe'
const SCRATCH_ROOT = join(REPO, '.ihui-agent', 'tmp', 'svc-pg-readiness')
const RUN_API = 'deploy/scripts/prod-bundle/svc/run-api.ps1'
const HARNESS = join(HERE, 'svc-pg-readiness-harness.ps1')

const read = (rel) => readFileSync(join(REPO, rel), 'utf8')

/**
 * B 层:结构判据。纯函数 —— 输入脚本文本,不碰磁盘也不碰 pwsh,所以变异对照可以用构造输入跑。
 * @returns {string[]} 问题清单;空数组 = 全部性质在位
 */
export function auditScript(text) {
  const problems = []
  const need = (cond, msg) => {
    if (!cond) problems.push(msg)
  }
  // 1) 三个函数在位(被改名/摘掉时行为层也会红,但那层只在装了 pwsh 的机器上跑得动)
  for (const fn of ['Resolve-IhuiPgIsReady', 'Get-IhuiApiDbEndpoint', 'Wait-IhuiPostgresReady']) {
    need(new RegExp(`function\\s+${fn}\\b`).test(text), `缺少 function ${fn} —— 前置被摘线或改名`)
  }
  // 2) 就绪判据必须是 pg_isready,不得回退成"端口开着"
  //    (G-208 的失效形态正是"服务在、端口在、库还在恢复")
  need(/pg_isready/i.test(text), '判据里找不到 pg_isready —— 换成探 TCP 端口就等于没修')
  need(
    !/Test-NetConnection|System\.Net\.Sockets\.TcpClient/i.test(text),
    '用 TCP 连通性当就绪判据:恢复期的 postmaster 照常监听端口,连上≠可用',
  )
  // 3) 必须有上界,且上界是参数而不是散在各处的字面量
  need(/\[int\]\$LimitSeconds/.test(text), '轮询函数缺 LimitSeconds 参数 —— 没有入参就没有可核对的上界')
  need(/\$deadline\s*=/.test(text), '没算截止时间')
  need(/while\s*\(.*\$deadline.*\)/.test(text), '循环没按截止时间收口 —— 无界等待会把一次库故障换成服务永久不启动')
  // 4) 每轮探测自己也要有界(否则"最多等 N 秒"能被一次探测吞成分钟级)
  need(/PGCONNECT_TIMEOUT/.test(text), '没设 PGCONNECT_TIMEOUT:单次探测可挂到 TCP 层默认超时')
  // 5) 装配段:超时与三条降级分支都必须继续启动,且每一支都得喊出**那一支的理由**
  const at = text.lastIndexOf('$pgExe = Resolve-IhuiPgIsReady')
  need(at > 0, '找不到装配段 —— 无法判断超时后到底还启不启动 API')
  const tail = text.slice(at)
  need(!/\bexit\s|\bthrow\b/.test(tail), '前置里出现 exit/throw:等不到就不启动 = 把库故障升级成服务永久不启动')
  for (const why of ['显式关闭', '找不到 pg_isready', '读不到', '超时:']) {
    const printed = tail
      .split('\n')
      .some((l) => /^\s*Write-Host/.test(l) && (l.includes(why) || l.includes(why.replace(':', ''))))
    need(printed, `降级出口"${why}"没有配套的 Write-Host —— 静默的降级看起来和"前置生效了"一模一样`)
  }
  // 6) host/端口不得写死:必须来自 apps/api/.env 的 DATABASE_URL(与 API 连的同一处)
  const guardRegion = text.slice(0, text.lastIndexOf('& "D:\\DevEnv\\runtimes\\node\\node.exe"'))
  need(
    !/(?:'-p'\s*,\s*'\d{4,}'|['"]5432['"]|['"]8810['"])/.test(guardRegion),
    '就绪段里写死了端口 —— 探针与应用连的可能不是同一处,前置就成了假绿灯',
  )
  // 7) 默认必须"开着";调小/关掉只能由 env 显式表达
  const def = text.match(/^\$PgWaitSeconds\s*=\s*(\d+)/m)
  need(!!def, '找不到默认上界的赋值')
  if (def) {
    need(Number(def[1]) > 0, `默认上界是 ${def[1]} —— 默认关等于没有前置(与"禁止新增默认关 env"同型)`)
    need(
      Number(def[1]) < 180,
      `默认上界 ${def[1]}s 不小于 API 自身 listen 的 180s 上界 —— 两道界会叠成"正在启动"的挂死态`,
    )
  }
  need(/IHUI_API_PG_WAIT_SECONDS/.test(text), '没有可调上界的出口(运维只能改文件)')
  return problems
}

/**
 * A 层:派生 pwsh 跑夹具。一次跑完所有现场(每例各起一次 pwsh 会把取证拖到分钟级)。
 * 拿不到结论一律返回 { skipped }——调用方必须 t.skip 喊出来,绝不记绿。
 */
function runHarness(scriptRel) {
  if (!existsSync(PWSH)) {
    return { skipped: '未判定:本机没有 C:\\Program Files\\PowerShell\\7\\pwsh.exe,行为层没跑' }
  }
  mkdirSync(SCRATCH_ROOT, { recursive: true })
  const scratch = join(SCRATCH_ROOT, `run-${Date.now()}-${process.pid}`)
  const r = spawnSync(
    PWSH,
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', HARNESS, '-Scratch', scratch, '-Script', join(REPO, scriptRel)],
    { encoding: 'utf8', timeout: 180_000, windowsHide: true, maxBuffer: 32 * 1024 * 1024 },
  )
  try {
    rmSync(scratch, { recursive: true, force: true })
  } catch {}
  if (r.error) return { skipped: `未判定:pwsh 派生失败(${r.error.message})` }
  const m = /@@JSON([\s\S]*?)@@/.exec(r.stdout || '')
  if (!m) {
    return {
      skipped: `未判定:夹具没吐结论(exit ${r.status})\n${(r.stderr || r.stdout || '').slice(0, 600)}`,
      exitStatus: r.status,
    }
  }
  try {
    return { json: JSON.parse(m[1]) }
  } catch (e) {
    return { skipped: `未判定:夹具输出不是合法 JSON(${e.message})` }
  }
}

// ── B 层:结构判据 ───────────────────────────────────────────────────────────
test('B1 真仓 run-api.ps1:全部不可让的性质在位', () => {
  const problems = auditScript(read(RUN_API))
  if (problems.length) throw new Error(`就绪前置不成立:\n  - ${problems.join('\n  - ')}`)
})

test('B2 六条变异各自必须让判据翻红(证明 B1 不是恒绿)', () => {
  const src = read(RUN_API)
  const mutants = [
    ['无界等待', (s) => s.replace(/while\s*\(.*\$deadline.*\)/, 'while ($true)')],
    ['超时就不启动', (s) => s.replace('if (-not $ready) {', 'if (-not $ready) {\n        exit 1')],
    ['改回探 TCP 端口', (s) => s.replace('& $Exe @probeArgs 2>&1', 'Test-NetConnection -ComputerName $H')],
    ['降级不喊话', (s) => s.replace(/Write-Host "\[IHUI-API\] ⚠ 降级:找不到 pg_isready[^\n]*\n/, '')],
    ['端口写死', (s) => s.replace(/\$probeArgs \+= @\('-p', \$P\)/, "$probeArgs += @('-p', '8810')")],
    ['默认关掉前置', (s) => s.replace(/^\$PgWaitSeconds = \d+/m, '$PgWaitSeconds = 0')],
  ]
  const broken = []
  const before = auditScript(src).length
  for (const [name, mutate] of mutants) {
    const mutated = mutate(src)
    if (mutated === src) {
      broken.push(`${name}:变异没改成任何字节 —— 这条对照本身已失效(判据形状漂了)`)
      continue
    }
    const after = auditScript(mutated).length
    if (after <= before) broken.push(`${name}:改后问题数 ${after} 未超过改前 ${before} —— 判据对该型失明`)
  }
  if (broken.length) throw new Error(broken.join('\n  '))
})

test('B3 前置只住在 run-api 侧(判据=包装器起的进程会在注册期碰库),且不得长出第二份实现', () => {
  // run-web:next build/start + 把 /api 反代给 8802,不直连 PostgreSQL。
  // run-ai:它的启动期建表在 apps/ai-service/app/main.py 的 lifespan 里已被 try/except 包住,
  //   恢复窗口内不会打死进程 ⇒ 不满足"能阻止 bind"这一条,刻意不加。
  // 这里只钉一件结构性的事:别把这份轮询复制成第二份真相(§两处算同一件事必漂移)。
  for (const rel of ['deploy/scripts/prod-bundle/svc/run-web.ps1', 'deploy/scripts/prod-bundle/svc/run-ai.ps1']) {
    const t = read(rel)
    if (/function\s+(Resolve-IhuiPgIsReady|Get-IhuiApiDbEndpoint|Wait-IhuiPostgresReady)/.test(t)) {
      throw new Error(`${rel} 里出现了第二份就绪轮询实现 —— 要扩面就先抽成一份共用实现,不要复制`)
    }
  }
})

// ── A 层:真定义、真调用 ─────────────────────────────────────────────────────
test('A1 DSN 解析 / pg_isready 选址 / 三条轮询出口(跑的是 run-api.ps1 的原文实现)', (t) => {
  const { skipped, json } = runHarness(RUN_API)
  if (skipped) return t.skip(skipped)
  const e = json.endpoint
  // host:port 必须来自 DATABASE_URL,而不是同一份临时 .env 里那行 DB_PORT=9999(第二份配置)
  if (e.normal.host !== '10.9.8.7' || e.normal.port !== '6543') {
    throw new Error(`DSN 解析错:${JSON.stringify(e.normal)}`)
  }
  if (e.normalLeaksPassword || e.atInPasswordLeaks) {
    throw new Error('返回值里出现了口令 —— 它会随 Write-Host 落进 nssm 日志(§5d/§5e)')
  }
  if (e.quotedNoPort.host !== 'db.internal' || e.quotedNoPort.port !== '') {
    throw new Error(`带引号 / 无端口形态解析错:${JSON.stringify(e.quotedNoPort)}`)
  }
  if (e.atInPassword.host !== '192.0.2.9' || e.atInPassword.port !== '6000') {
    throw new Error(`口令含 @ 时切错段:${JSON.stringify(e.atInPassword)}`)
  }
  if (e.noUserinfo.host !== 'localhost' || e.noUserinfo.port !== '5432') {
    throw new Error(`无 userinfo 形态解析错:${JSON.stringify(e.noUserinfo)}`)
  }
  if (e.ipv6.host !== '::1' || e.ipv6.port !== '5433') throw new Error(`IPv6 形态解析错:${JSON.stringify(e.ipv6)}`)
  for (const k of ['noKeyIsNull', 'missingFileIsNull', 'garbageIsNull', 'socketIsNull']) {
    if (e[k] !== true) throw new Error(`${k} 应判"读不出端点"(交调用方走降级出口),实得 ${e[k]}`)
  }
  // 选址:装了就必须找得到;多版本并存时必须挑最高的那份(本机实测 17 与 18 并存 → 应挑 18)
  if (!json.resolver.found) {
    throw new Error(`Resolve-IhuiPgIsReady 返回空,但夹具枚举到了 ${json.resolver.highest} —— 解析器漏了这台机的装法`)
  }
  if (!json.resolver.exists) throw new Error(`返回的路径不存在:${json.resolver.path}`)
  if (!json.resolver.fromPath && json.resolver.highest && !json.resolver.picksHighest) {
    throw new Error(`多版本并存时没挑最高的:实得 ${json.resolver.path},应为 ${json.resolver.highest}`)
  }
  // 三条出口:立刻就绪 / 恢复中(退出码 1)后转就绪 / 一直不就绪
  if (json.immediateReady.result !== true) throw new Error('首轮即就绪却没返回真 —— 成功分支断了')
  if (json.rejectThenReady.result !== true) {
    throw new Error(
      `退出码 1(崩溃恢复中的常态)被当成了致命错误(实得 ${json.rejectThenReady.result}) —— ` +
        '这正是本票要治的那一型,判据却复刻了它',
    )
  }
  if (json.boundedTimeout.result !== false) throw new Error('4 秒上界内一直拒绝却返回了真')
  // "有界"是本票唯一新增的能力,必须量出来,而不是只看代码里写了个 deadline
  const bounded = [['boundedTimeout', json.boundedTimeout, 4], ['realBinaryBounded', json.realBinaryBounded, 6]]
  for (const [name, c, limit] of bounded) {
    if (!c) throw new Error(`${name} 没跑(假/真 pg_isready 的有界对照缺一)`)
    // 越过上界的余量 = 至多一次进行中的探测(PGCONNECT_TIMEOUT=3s),再多就是没界
    if (c.elapsed > limit + 4) {
      throw new Error(`${name} 越过上界:limit=${limit}s 实得 ${c.elapsed}s`)
    }
  }
})

test('A2 夹具按名字取实现:函数被改名后它必须交不出结论', (t) => {
  mkdirSync(SCRATCH_ROOT, { recursive: true })
  const rel = '.ihui-agent/tmp/svc-pg-readiness/mutant-run-api.ps1'
  const bad = join(REPO, rel)
  writeFileSync(bad, read(RUN_API).replace('function Wait-IhuiPostgresReady {', 'function RenamedAway {'), 'utf8')
  try {
    const { skipped, json } = runHarness(rel)
    if (skipped && !json) return // 夹具当场报错 = 它真的在按名字取实现
    throw new Error(`被改名的函数仍让夹具出了结论 —— A1 测的就不是 run-api.ps1 的实现:\n${JSON.stringify(json)}`)
  } finally {
    rmSync(bad, { force: true })
  }
})

// ── 影子副本:等值判定交给门 104,这里不抄第二份判据 ──────────────────────────
test('S1 与 deploy/prod-bundle/svc/ 运行副本的等值由门 104 判;缺副本计未判定而不是冒红', async (t) => {
  const { __test__ } = await import('file:///' + join(REPO, 'scripts', 'check-prod-bundle-shadow.mjs').replace(/\\/g, '/'))
  const pair = __test__.PAIRS.find((p) => p.tracked === RUN_API)
  if (!pair) {
    throw new Error(
      `${RUN_API} 不在门 104 登记表里 —— 改了入库源而没人对账运行副本,正是 §5e 说的那片盲区`,
    )
  }
  if (!existsSync(join(REPO, pair.runner))) {
    return t.skip(
      `未判定:${pair.runner} 不在本机(deploy/prod-bundle/ 整目录被 .gitignore 忽略 ⇒ 只有部署机上才有对账对象)。` +
        '部署机上必须重跑 node scripts/check-prod-bundle-shadow.mjs —— 这一型若在那里出现,说明线上仍是改前的旧版。',
    )
  }
  const res = __test__.audit(REPO, [pair])
  if (res.unverifiable > 0) throw new Error(`问不到 git ⇒ 不记绿:\n${res.lines.join('\n')}`)
  if (!res.ok) throw new Error(`影子漂移:生产跑的不是入库源\n${res.lines.join('\n')}`)
})
