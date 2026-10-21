// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 回归锁:服务自愈的**终态**必须到人(2026-10-21 实测事故型)。
 *
 * 现场:IHUI-API 因 Fastify 重复路由声明在 boot 期抛错,崩溃循环 126 次、8802 从未监听、
 * 登录全量 500 持续 45 分钟,而**一封信都没有**。派发侧只认 `restarted*` / `restart-failed`,
 * 而窗口上限(`maxRestartsPerWindow: 2`)用完后那台落进 `window-capped` —— 两集都不是,
 * 从此只往守护日志写一行"请人看"。**越是不重启能解决的故障越安静。**
 *
 * 本档锁的每一格都有成对反证(§"修复必须带变异自证"):
 *  ① 封顶 ⇒ 恰好一封,身份带服务名集合与持续档;
 *  ② 不封顶 ⇒ 零封,且**起点状态件被摘掉**(终态必须会清,否则下次真崩被算成"已拖很久");
 *  ③ 取的是 `actions` 不是 `results` —— 动作器把逐台决策写在 actions,results 里只有真动过手的
 *    三档。照上面两个过滤器抄 `results` 会**恒为空**:一把永远不响的铃,比原来更坏。这一臂就是
 *    那把假铃的正例(results 里挂着 window-capped、actions 里没有 ⇒ 必须不响);
 *  ④ 同一批封顶越拖越响:6h → 24h 跨档 ⇒ 身份变 ⇒ 不会被 4h 窗压成静音;
 *  ⑤ 每一轮都必须**真的跑过**(`r.ran === true`)—— 被节律戳挡掉的一轮返回的是同一个"零封信",
 *    和"判过且没问题"在读数上完全同形。这一条不是补充,是第一版当场假绿换来的(C3 那次);
 *  ⑥ 新增那一格不许吃掉旧那一格:重启后仍无应答 ⇒ 原「服务自愈动作」身份逐字不变。
 *
 * 判据一律 import 源脚本的 `healUnresponsiveServices`,本档不复制第二份(§22c)。
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { after, test } from 'node:test'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { healUnresponsiveServices } from '../git-guardian.mjs'

const T0 = Date.parse('2026-10-21T09:00:00.000Z')
const scratch = mkScratch('service-heal-capped')

/** 造一份动作器 `--json --apply` 的 stdout(形状与真机一致,字段不自己发明)。 */
function report({ actions, results = [] }) {
  const act = (kind) => actions.filter((a) => a.kind === kind).length
  return JSON.stringify({
    at: new Date(T0).toISOString(),
    apply: true,
    counts: {
      checked: actions.length,
      answering: act('answering'),
      planned: act('planned'),
      restarted: results.filter((r) => String(r.kind).startsWith('restarted')).length,
      failed: act('restart-failed'),
      watch: act('watch'),
      cooldown: act('cooldown'),
      capped: act('window-capped'),
      undetermined: act('undetermined'),
      offlist: act('not-in-list'),
    },
    actions,
    results,
  })
}

const CAP = { name: 'IHUI-DEMO', kind: 'window-capped', why: '本 60 分钟窗口已动作 2/2 台 ⇒ 防重启风暴,本轮不动' }
const HEALTHY = { name: 'IHUI-DEMO', kind: 'answering', why: '应答正常:127.0.0.1:8802 有应答' }

/**
 * 跑一轮派发,收 notify/logger,零真派生(runner 由夹具给)。
 *
 * `tag` 给每条用例**各自的**节律戳与起点状态件 —— 这不是排版洁癖:写第一版时所有用例共用一份
 * tick 文件,C2 把时钟推到 T0+60s 之后,C3/C4/C5 那几轮全部被 `publicProbeDue` 判"未到节流窗口"
 * 直接 return,**零封信**。于是"这一型根本不会响"和"这一轮压根没判"在读数上完全同形 ——
 * C3 当场假绿。按 §0.3,下面那条 `r.ran` 断言就是拆这两型的:没跑的一轮绝不当成判过。
 */
function run(tag, now, stdout) {
  const mails = []
  const logs = []
  const r = healUnresponsiveServices({
    now,
    intervalMs: 0, // 每轮都必须判,不受守护自身节律影响
    tickFile: path.join(scratch, `${tag}.tick.iso`),
    cappedFile: path.join(scratch, `${tag}.capped-first.json`),
    logger: (line) => logs.push(String(line)),
    notify: (name, detail, opts) => {
      mails.push({ name, detail, opts })
      return { sent: true }
    },
    runner: () => ({ status: 0, stdout, stderr: '' }),
  })
  assert.equal(r.ran, true, `${tag}@${new Date(now).toISOString()}:本轮**没跑**(被节流/动作器不在位)⇒ "0 封信"是"没判",不是"判过且没问题"\n日志:${logs.join(' | ')}`)
  return { mails, logs, r }
}

test('C1 封顶终态到人:恰好一封,身份含服务名集合 + 持续档,标题点名"启动即崩"', () => {
  const { mails, logs } = run('C1', T0, report({ actions: [HEALTHY, CAP] }))
  assert.equal(mails.length, 1, `封顶应当恰好一封,现读 ${mails.length} 封`)
  assert.match(logs.join('\n'), /封顶 1/, '守护日志那一面也必须报封顶数(发信被关时,它是唯一留痕)')
  const m = mails[0]
  assert.match(m.name, /重启预算用完/, '标题必须说清"重启这一维已被排除"')
  assert.match(m.name, /IHUI-DEMO/, '身份与标题必须点名是哪一台')
  assert.equal(m.opts.severity, 'critical', 'boot 崩 ≠ 一次抖动,不得按 warning 寄')
  assert.match(m.opts.dedupKey, /^service-heal-capped;svcs=IHUI-DEMO;held=lt6h$/, `身份形状坏了:${m.opts.dedupKey}`)
  assert.match(m.detail, /重启.*这一维已被排除|问题在进程自己起不来/, '正文必须给结论,不只报数')
  assert.match(m.detail, /nssm restart/, '正文必须带可执行下一步(§5e-1:红了收信人能做什么)')
  assert.doesNotMatch(m.opts.dedupKey, /\d{2,}/, '身份里不许出现原始计数/时刻(型③、§5e-3、门 224)')
})

test('C2 不封顶即零封,且起点状态件必须被摘掉(终态要会清)', () => {
  run('C2', T0, report({ actions: [CAP] })) // 先起一段封顶,把状态件造出来
  assert.ok(existsSync(path.join(scratch, 'C2.capped-first.json')), '前置不成立:封顶轮没写起点状态件 ⇒ 下面那条"被摘掉"从未被测到')
  const { mails } = run('C2', T0 + 60_000, report({ actions: [HEALTHY] }))
  assert.equal(mails.length, 0, '恢复应答还寄"预算用完" = 假警报')
  assert.equal(existsSync(path.join(scratch, 'C2.capped-first.json')), false, '封顶解除后起点仍留在盘上 ⇒ 下次真崩第一次就被算成"已经拖了很久"')
})

test('C3 取的是 actions 不是 results:results 里挂封顶必须**不响**(假铃反例)', () => {
  const { mails } = run('C3', T0, report({ actions: [HEALTHY], results: [{ ...CAP, kind: 'window-capped' }] }))
  assert.equal(mails.length, 0, '判据读的是 results ⇒ 这一型在真机上永远不会响(动作器只把决策写进 actions)')
})

test('C4 同一批封顶越拖越响:跨 6h 档即换身份,不被窗口压成静音', () => {
  const first = run('C4', T0, report({ actions: [CAP] }))
  const later = run('C4', T0 + 7 * 3_600_000, report({ actions: [CAP] }))
  assert.equal(first.mails.length, 1, '首封必须响(否则下面两条形同虚设)')
  assert.equal(later.mails.length, 1, '跨档那封也必须响')
  assert.match(first.mails[0].opts.dedupKey, /held=lt6h$/, `首封档位读错:${first.mails[0].opts.dedupKey}`)
  assert.match(later.mails[0].opts.dedupKey, /held=6-24h$/, `7 小时后仍是短档:${later.mails[0].opts.dedupKey}`)
  assert.notEqual(later.mails[0].opts.dedupKey, first.mails[0].opts.dedupKey, '跨档不换身份 = 越拖越静(与"抑制必须有终态"相反的方向)')
  assert.match(later.mails[0].detail, /已钉为这一段的最初时刻/, '起点必须是**最初**那一次,不是本轮时刻')
  const pinned = JSON.parse(readFileSync(path.join(scratch, 'C4.capped-first.json'), 'utf8'))
  assert.equal(pinned.firstMs, T0, `起点被后一轮覆盖:${pinned.firstMs} ≠ ${T0} ⇒ 持续时长永远归零`)
})

test('C5 多台封顶只算一封(身份取有序集合,台数进正文不进身份)', () => {
  const { mails } = run('C5', T0, report({ actions: [CAP, { ...CAP, name: 'IHUI-WEB' }] }))
  assert.equal(mails.length, 1, '每轮一封,不因台数而分裂成两封')
  assert.match(mails[0].opts.dedupKey, /svcs=IHUI-DEMO \/ IHUI-WEB/, '两台都要进身份,否则换一台崩的没人知道')
  assert.doesNotMatch(mails[0].name, /\d{2,}/, '标题里不许带原始计数(同族:元运维巡检 34 封/5 天即此型)')
})

test('C6 原有那格没被我加的这一格挤掉:重启过但仍不应答 ⇒ "服务自愈动作"照旧响一封', () => {
  const { mails } = run(
    'C6',
    T0,
    report({
      actions: [{ name: 'IHUI-DEMO', kind: 'restart', why: 'silent 连续 2 轮' }],
      results: [{ name: 'IHUI-DEMO', kind: 'restarted-unverified', why: 'silent:端口未起' }],
    }),
  )
  assert.equal(mails.length, 1, '重启无应答必须仍进旧那封信(新增封顶分支不得吃掉它)')
  assert.equal(mails[0].name, '服务自愈动作', `旧身份被改写:${mails[0].name}`)
  assert.match(mails[0].opts.dedupKey, /^service-heal;svcs=IHUI-DEMO;acted=1;failed=0$/, `旧身份形状坏了:${mails[0].opts.dedupKey}`)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
