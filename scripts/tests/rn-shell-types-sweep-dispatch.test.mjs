// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * RN 壳承载页编译期契约腿(`sweepRnShellTypes`)的镜像测试。
 *
 * 立因:`gen-rn-shell-types.mjs`(2026-10-26 立)把小程序端 `@rn-shells/*` / `@ihui/rn-app/*`
 * 两类别名说明符派生成一份 `.d.ts`,但 2026-11-05 机械对账级联 15 个写盘段在守护两条执行体里的
 * 真实调用点,只这一格零命中 —— 「工具在、判据在、没人调度」那一型。上游不动时小程序那屏在
 * `tsc` 眼里仍是 TS2307(any),而门 251 C9 判的是"手改派生件",对"根本没人重算"是盲区。
 *
 * 钉死六件事:
 *   T1 契约落后并写回 ⇒ 绿行点名「说明符/declare 块/未判定/已写回」读数;
 *   T2 契约与源一致 ⇒ ok=true 且读数仍要打(不打就分不清"跑了且没活"与"没跑");
 *   T3 结论行取不到 ⇒ 记未判定、ok=false,绝不折成"契约已同步"(§0.3);
 *   T3b 子进程被超时掐死 ⇒ 点名 signal,不与"跑完但没打结论"并桶;
 *   T4 节流窗口内不派生第二次,过窗必须放行;
 *   T5 装车锁 ⇒ 定义在 HEAD 面、调用同时挂在 main 健康轮次与 daemon tick 两处、且挨着同族腿派、
 *      节流可 env 覆盖;
 *   C1 契约锁 ⇒ 调度器解析的结论行格式,必须真能在该器现读输出里匹配到(不手抄形状),
 *      并钉住"取材面 = HEAD"这条口径(与本仓另一处生产者 upgrade-miniapp-shell-pages 同 argv)。
 */
import { strict as assert } from 'node:assert'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import test from 'node:test'

import { sweepRnShellTypes } from '../git-guardian.mjs'
import { mkScratch } from '../lib/scratch-dir.mjs'

const REPO = resolve(import.meta.dirname, '..', '..')
const GENERATOR = resolve(import.meta.dirname, '..', 'gen-rn-shell-types.mjs')
const STDIO = ['ignore', 'pipe', 'pipe']

/** T5 判的是"这一腿到底装车没有"⇒ 必须读 HEAD 面(盘上副本可能滞后,§0.4 同面同轮)。 */
const headSrc = (rel) =>
  execFileSync('git', ['show', `HEAD:${rel}`], {
    cwd: REPO,
    encoding: 'utf8',
    maxBuffer: 1 << 26,
    windowsHide: true,
    stdio: STDIO,
  })

const fixture = () => ({ tickFile: join(mkScratch('rn-shell-types-'), 'tick.json') })
const logsOf = () => {
  const logs = []
  return { logs, logger: (m) => logs.push(m) }
}
const runnerOf =
  (stdout, extra = {}) =>
  () => ({ status: 0, stdout, stderr: '', ...extra })

const STALE_LINE =
  '[gen-rn-shell-types] 面=head 覆盖面说明符 207 个 / declare 块 207 段 / 未判定 0 条 / 派生件落后(待写回)\n' +
  '[gen-rn-shell-types] ✅ 已写回 apps/miniapp-taro/types/rn-shells.generated.d.ts(8123 字节,含水印注入)\n'
const SYNCED_LINE =
  '[gen-rn-shell-types] 面=head 覆盖面说明符 206 个 / declare 块 206 段 / 未判定 0 条 / 派生件与源一致\n'

test('T1 契约落后且写回 ⇒ 绿行点名读数', () => {
  const { logs, logger } = logsOf()
  const r = sweepRnShellTypes({ ...fixture(), logger, runner: runnerOf(STALE_LINE) })
  assert.equal(r.ran, true)
  assert.equal(r.ok, true)
  assert.equal(r.state, 'stale')
  assert.equal(r.wrote, 1, '写了盘必须量得到(写了却没登记 ⇒ 悬挂在工作树,正是本腿要治的那一型)')
  assert.equal(r.modules, 207)
  assert.equal(r.blocks, 207)
  const line = logs.find((l) => /RN 壳契约/.test(l))
  assert.ok(line, '必须留一行读数')
  assert.match(line, /说明符 207/)
  assert.match(line, /落后→本轮已写回/)
  assert.doesNotMatch(line, /⚠️/)
})

test('T1b 落后但未写回 ⇒ 读数分得开(不能把"拒写/失败"读成"已同步")', () => {
  const { logs, logger } = logsOf()
  const r = sweepRnShellTypes({
    ...fixture(),
    logger,
    runner: runnerOf(STALE_LINE.replace(/✅ 已写回[^\n]*\n/, '')),
  })
  assert.equal(r.state, 'stale')
  assert.equal(r.wrote, 0)
  assert.match(
    logs.find((l) => /RN 壳契约/.test(l)),
    /落后→本轮未写回/,
  )
})

test('T1c 未判定条数 >0 ⇒ 读数点名枚数(上游壳自身有问题,本腿只报不裁)', () => {
  const { logger, logs } = logsOf()
  const r = sweepRnShellTypes({
    ...fixture(),
    logger,
    runner: runnerOf(
      '[gen-rn-shell-types] 面=head 覆盖面说明符 9 个 / declare 块 8 段 / 未判定 1 条 / 派生件落后(待写回)\n',
    ),
  })
  assert.equal(r.undetermined, 1)
  assert.match(
    logs.find((l) => /RN 壳契约/.test(l)),
    /未判定 1/,
  )
})

test('T2 契约与源一致 ⇒ ok 且仍打读数(区分"没活"与"没跑")', () => {
  const { logs, logger } = logsOf()
  const r = sweepRnShellTypes({ ...fixture(), logger, runner: runnerOf(SYNCED_LINE) })
  assert.equal(r.ok, true)
  assert.equal(r.state, 'in-sync')
  assert.equal(r.wrote, 0)
  assert.match(
    logs.find((l) => /RN 壳契约/.test(l)),
    /与源一致/,
  )
})

test('T3 结论行取不到 ⇒ 未判定,不折成"契约已同步"(§0.3)', () => {
  const { logs, logger } = logsOf()
  const r = sweepRnShellTypes({ ...fixture(), logger, runner: runnerOf('') })
  assert.equal(r.ran, true)
  assert.equal(r.ok, false)
  assert.equal(r.state, 'undetermined')
  assert.match(
    logs.find((l) => /RN 壳契约/.test(l)),
    /未判定/,
  )
})

test('T3b 子进程被超时掐死 ⇒ 点名 signal 而不是"结论解析不出"', () => {
  const { logs, logger } = logsOf()
  const r = sweepRnShellTypes({
    ...fixture(),
    logger,
    runner: () => ({ status: null, signal: 'SIGTERM', stdout: '', stderr: '' }),
  })
  assert.equal(r.ok, false)
  assert.match(
    logs.find((l) => /RN 壳契约/.test(l)),
    /SIGTERM/,
  )
})

test('T4 节流窗口内不派生第二次,过窗放行', () => {
  const f = fixture()
  let calls = 0
  const counting = () => {
    calls += 1
    return { status: 0, stdout: SYNCED_LINE, stderr: '' }
  }
  sweepRnShellTypes({ ...f, logger: () => {}, runner: counting, now: 1_000_000 })
  sweepRnShellTypes({ ...f, logger: () => {}, runner: counting, now: 1_000_000 + 60_000 })
  assert.equal(calls, 1, '30 分钟节流:一小时内第二次调用不得真派生')
  sweepRnShellTypes({ ...f, logger: () => {}, runner: counting, now: 1_000_000 + 31 * 60_000 })
  assert.equal(calls, 2, '过窗必须放行 —— 节流写死不动就等于这条腿停摆')
})

test('T5 装车锁:定义在 HEAD 面、两处执行体都挂、挨同族腿派、节拍可 env 覆盖', () => {
  const src = headSrc('scripts/git-guardian.mjs')
  assert.match(src, /export function sweepRnShellTypes\(/, '函数必须已定义')
  const mainCall = /if \(!CHECK_ONLY\) sweepRnShellTypes\(\)/
  const daemonCall = /\n\s+sweepRnShellTypes\(\)/
  assert.match(src, mainCall, 'main 健康轮次里必须有调用')
  assert.match(src, daemonCall, 'daemon tick 里必须有调用')
  assert.equal(
    (src.match(/sweepRnShellTypes\(\)/g) || []).length,
    2,
    '两处执行体各一处:多于两处说明有人另开挂点,少一处说明只在半条链上',
  )
  // 邻接判据(两端各被提及不算接线):main 轮里必须排在造页腿之后 —— 契约按 HEAD 面重算,
  // 排在造页之前等于每轮都慢一页。
  const mine = src.search(mainCall)
  const pages = src.search(/if \(!CHECK_ONLY\) sweepCrossEndShellPages\(\)/)
  assert.ok(mine >= 0 && pages >= 0)
  assert.ok(mine > pages, '契约腿必须排在造页腿之后派')
  assert.ok(src.slice(pages, mine).length < 400, '新腿必须挨着同族腿派 —— 两端各被提及不算接线')
  assert.match(src, /IHUI_RN_SHELL_TYPES_INTERVAL_MS/, '值守压节拍要能不改码做到')
})

test('T6 被量着锁:节流戳必须落在 A8 黑腿探测器的候选集里且登记表有条目可归属', () => {
  // A8(check-autonomy-leg-health)的覆盖面自证 = 盘上所有 `*-dispatch-last.json`,
  // 戳名不在这个形态里 ⇒ 这一腿"挂了没人量"永远不出现在 dark/unregistered 读数上。
  // 本仓 74 枚跨端族旧戳就是这种形态(它们不在 A8 射程)—— 新腿不得再复刻这一格。
  const src = headSrc('scripts/git-guardian.mjs')
  const tick = /tickFile = join\(dirname\(LOG\), '([^']+)'\)/.exec(
    src.slice(src.search(/export function sweepRnShellTypes\(/)),
  )
  assert.ok(tick, '本腿必须自带节流戳默认值(与同族腿同形态)')
  assert.match(
    tick[1],
    /-dispatch-last\.json$/,
    `节流戳名必须匹配 A8 候选集 glob,现读=${tick[1]} —— 改回 -last.json 即脱量`,
  )
  const reg = JSON.parse(headSrc('scripts/data/autonomy-leg-liveness.json'))
  const leg = (reg.legs || []).find((l) => l.stamp === tick[1])
  assert.ok(leg, `A8 登记表里没有这枚戳 ⇒ 会被判 unregistered(黑)—— 补条目不是删断言`)
  assert.equal(
    leg.nominalIntervalMs,
    30 * 60 * 1000,
    '名义节律必须与守护默认值逐字同值(两处不同形 = 容忍窗算错,黑腿判据本身失信)',
  )
  assert.equal(
    leg.envVar,
    'IHUI_RN_SHELL_TYPES_INTERVAL_MS',
    '条目要点名覆盖它的 env,压节拍不用改码',
  )
  assert.ok(
    Number.isFinite(Date.parse(String(leg.verifiedAt))),
    'verifiedAt 缺失/不可解析 ⇒ 条目算未复确认',
  )
})

test('C1 契约锁:调度器解析的结论行必须真能在该器现读输出里匹配到', () => {
  const out = execFileSync(process.execPath, [GENERATOR, '--check'], {
    cwd: REPO,
    encoding: 'utf8',
    maxBuffer: 1 << 26,
    windowsHide: true,
    timeout: 5 * 60 * 1000,
    stdio: STDIO,
  })
  // 与调度器体内那把正则逐字同形(改一边必须改另一边,否则本例红)
  const m =
    /面=(\w+) 覆盖面说明符 (\d+) 个 \/ declare 块 (\d+) 段 \/ 未判定 (\d+) 条 \/ 派生件(落后|与源一致)/.exec(
      out,
    )
  assert.ok(m, `该器现读输出里取不到结论行形态,头部=${out.slice(0, 200)}`)
  assert.equal(m[1], 'head', '--check 档必须自 HEAD 面取数(与本腿 argv 同一口径)')
  const genSrc = readFileSync(GENERATOR, 'utf8')
  assert.match(genSrc, /覆盖面说明符 /, '结论行由器物自己打,不是测试编的')
  // 取材面口径:另一处生产者(手写页升级器落地后重算)用的是同一串 argv ⇒ 两处不得分叉
  const producer = readFileSync(
    resolve(import.meta.dirname, '..', 'upgrade-miniapp-shell-pages.mjs'),
    'utf8',
  )
  assert.match(
    producer,
    /'gen-rn-shell-types\.mjs'\),\s*'--head',\s*'--write'/,
    '升级器那处仍是 --head --write;它若改了,本腿必须同改(同一契约两个生产者)',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
