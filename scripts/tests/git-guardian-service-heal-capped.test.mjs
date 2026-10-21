// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 回归锁:服务自愈的**终态**必须到人(2026-10-21 实测事故型)。
 *
 * 文件名里的 capped 是这两个入口里的第一个;本档现覆盖**两个**只能交人的终态,它们共用
 * `alertTerminalHeld` 一件器物(§0.6 只有一份实现),所以也就共用这一份取证。
 *
 * 现场一:IHUI-API 因 Fastify 重复路由声明在 boot 期抛错,崩溃循环 126 次、8802 从未监听、
 * 登录全量 500 持续 45 分钟,而**一封信都没有**。派发侧只认 `restarted*` / `restart-failed`,
 * 而窗口上限(`maxRestartsPerWindow: 2`)用完后那台落进 `window-capped` —— 两集都不是,
 * 从此只往守护日志写一行"请人看"。**越是不重启能解决的故障越安静。**
 * 现场二:IHUI-OLLAMA `STATE=STOPPED`、Application 指向一个不存在的 exe、11434 无应答。
 * 它落在自愈白名单之外,而排除台账对这一族的原话是"只喊人" —— 可"只喊人"从来没有生产者,
 * 门 153 只是提交链上的 warn。更要紧的是那两行排除写成 `a / b / c` 的伪名:任何按服务名的
 * 查表**结构上永远命中不了**,8 台服务在台账里"看着有豁免",实际无人豁免、也无人喊人。
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
 *  ⑥ 新增那一格不许吃掉旧那一格:重启后仍无应答 ⇒ 原「服务自愈动作」身份逐字不变;
 *  ⑦ 名单外真坏了 ⇒ 独立身份一封,且与封顶**不并桶**(一型恢复不许压掉另一型);健康的不立行、
 *    豁免到期与未登记两档都必须响 —— 方向恒为**多喊一次**,绝不是多静音一次(§0.10);
 *  ⑧ 本档自己的 teardown 必须在位(C11):`after(…rmScratch…)` 那一行在本次落地的那枚提交里
 *    **整行不见了而 6 条用例照样全绿** —— 少一个收尾钩子不会让任何断言变红,这一型天生安静;
 *  ⑨ 第三种终态"连续六小时量不到"的门槛**方向与前两种相反**(C12~C14):单轮未判定必须闭嘴
 *    (§0.3 把"没判"当坏了 = 让一把量不到的尺子获得发信权),但 indefinite 的失明必须喊,
 *    且**不寄的那一轮也要留痕**(返回里 `blind` 与 `blindMailed` 两个数分开)——
 *    只报"寄没寄"会把"有事但没到门槛"读成"没事",又回到同一个假绿。
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
  const off = (state) => actions.filter((a) => a.kind === 'not-in-list' && a.ackState === state).length
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
      offlistAnswering: 0,
      offlistUndetermined: 0,
      offlistUnregistered: off('unregistered'),
      offlistAckExpired: off('expired'),
    },
    actions,
    results,
  })
}

const CAP = { name: 'IHUI-DEMO', kind: 'window-capped', why: '本 60 分钟窗口已动作 2/2 台 ⇒ 防重启风暴,本轮不动' }
const HEALTHY = { name: 'IHUI-DEMO', kind: 'answering', why: '应答正常:127.0.0.1:8802 有应答' }
/** 名单外真坏了(动作器给的形状:kind + ackState + 带三档出路措辞的 why)。 */
const offDown = (name, ackState, extra = '') => ({
  name,
  kind: 'not-in-list',
  ackState,
  why: `down:STATE=STOPPED ⇒ 白名单外不自动重启,${extra}`,
})

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
    offlistFile: path.join(scratch, `${tag}.offlist-first.json`),
    blindFile: path.join(scratch, `${tag}.blind-first.json`),
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

test('C7 名单外真坏了 ⇒ 恰好一封,身份独立于封顶那一型,出路点名"补登记/摘服务"', () => {
  const { mails } = run('C7', T0, report({ actions: [HEALTHY, offDown('IHUI-OLLAMA', 'acked', '已登记排除(2027-01-01 前回看):B 档 provider')] }))
  assert.equal(mails.length, 1, `名单外故障应当恰好一封,现读 ${mails.length} 封`)
  const m = mails[0]
  assert.match(m.name, /不得自动重启/, '标题必须说清"重启它不是本层的授权动作"')
  assert.equal(m.opts.severity, 'critical')
  assert.match(m.opts.dedupKey, /^service-offlist-down;svcs=IHUI-OLLAMA;held=lt6h$/, `身份形状坏了:${m.opts.dedupKey}`)
  assert.match(m.detail, /service-auto-restart\.json/, '正文必须指到那张台账,否则收信人不知道该在哪儿改')
  assert.match(m.detail, /已登记排除/, '动作器给的三档措辞必须原样透传(派发侧不得自己重算台账形态)')
  assert.doesNotMatch(m.opts.dedupKey, /\d{2,}/, '身份里不许出现原始计数/时刻(型③、§5e-3、门 224)')
})

test('C8 名单外**健康**不立行 ⇒ 派发侧零封(把"没事"与"坏了"分开的下半边)', () => {
  const { mails } = run('C8', T0, report({ actions: [HEALTHY, { name: 'ihui-loki', kind: 'answering', why: '应答正常' }] }))
  assert.equal(mails.length, 0, '健康服务进发信集 = 天天轰炸')
})

test('C9 两型同时坏 ⇒ 两封各带各的身份(并桶会让一型恢复压掉另一型)', () => {
  const { mails } = run('C9', T0, report({ actions: [CAP, offDown('IHUI-RSSHUB', 'unregistered', '既无服务条目也无排除条目 ⇒ 这台没人决定过,请补登记')] }))
  assert.equal(mails.length, 2, `封顶与名单外是两件事,必须两封,现读 ${mails.length} 封`)
  const kinds = mails.map((m) => String(m.opts.dedupKey).split(';')[0]).sort().join('+')
  assert.equal(kinds, 'service-heal-capped+service-offlist-down', `身份被并桶:${kinds}`)
  const off = mails.find((m) => m.opts.dedupKey.startsWith('service-offlist-down'))
  assert.match(off.detail, /没人决定过/, '未登记那一档的出路必须是补登记,不是"按登记的处置"')
})

test('C10 豁免到期与未登记都必须响(方向是多喊一次,绝不是多静音一次 §0.10)', () => {
  const expired = run('C10a', T0, report({ actions: [offDown('IHUI-MONITOR', 'expired', '排除台账复核日已过(2026-01-01)⇒ 请重新裁定')] }))
  const unreg = run('C10b', T0, report({ actions: [offDown('IHUI-NEW-SVC', 'unregistered', '这台没人决定过,请补登记')] }))
  assert.equal(expired.mails.length, 1, '复核日已过的排除条目不得继续当豁免用')
  assert.equal(unreg.mails.length, 1, '压根没登记的新服务必须响(RSSHub 静默停 3 天那一型)')
  assert.match(expired.mails[0].detail, /复核日已过/)
  assert.match(unreg.mails[0].detail, /请补登记/)
})

/**
 * C11 收尾钩子必须真的挂在文件里 —— 这一条是被"一行代码静默消失"逼出来的:
 * 本档的 `after(() => rmScratch(scratch))` 在落地那枚提交里**整行不见了**,而 6 条用例照样全绿
 * (没有任何一条断言它存在)。夹具目录靠 mkScratch 的进程退出回收兜住,所以后果是"盘上多一份
 * 目录"而不是"用例红" —— 也就是说,**这一型的失效天生是安静的**。加这条锁,并且它自己就是
 * "判据要能在真跑它的那一刻才成立"的形状:摘掉 after 那一行,本档立刻翻红。
 */
test('C11 本档的收尾钩子必须真在位(静默丢行的一型:测试全绿而 teardown 没了)', () => {
  const src = readFileSync(new URL(import.meta.url), 'utf8')
  assert.match(src, /^after\(\(\) => rmScratch\(scratch\)\)\s*$/m, 'after(…rmScratch…) 这一行不在了 ⇒ 用例仍会全绿,而夹具目录没人回收')
})

/**
 * C12~C14 同族第三种:**量不到**。这一格的门槛与前面两格方向相反 ——
 * 一轮未判定**不许**寄信(§0.3:把"没判"当坏了 = 让一把量不到的尺子获得发信权),
 * 但连续 6 小时量不到必须寄,因为它报的不是"服务坏了"而是"**看守层瞎了**"。
 * 三条互相成对:C12 单轮不寄但**留痕**、C13 到 6h 寄且跨档、C14 恢复后摘起点。
 */
const BLIND = { name: 'IHUI-API', kind: 'undetermined', why: '未判定:门的应答维没结论 ⇒ 不记故障也不清零' }

test('C12 单轮量不到 ⇒ 零封,但起点必须已经落账、日志必须报名(不寄 ≠ 不留痕)', () => {
  const { mails, logs, r } = run('C12', T0, report({ actions: [HEALTHY, BLIND] }))
  assert.equal(mails.length, 0, '一轮未判定就寄信 = 把"没判"读成"坏了"(§0.3)')
  assert.equal(r.blind, 1, '返回必须报"量不到 1 台" —— 只报寄没寄会把"有事但没到门槛"读成"没事"')
  assert.equal(r.blindMailed, 0)
  assert.match(logs.join('\n'), /未到人门槛 360 分钟 ⇒ 本轮只报名,不寄信/, '日志必须写明"为什么这轮没寄"(这条只许来自逐轮报名那行,不许由收尾汇总行顶替)')
  assert.ok(existsSync(path.join(scratch, 'C12.capped-first.json')) === false, '封顶状态件不该被这一格写')
  const off = JSON.parse(readFileSync(path.join(scratch, 'C12.blind-first.json'), 'utf8'))
  assert.equal(off.firstMs, T0, '6 小时的分母必须从**第一次量不到**那刻起算')
})

test('C13 连续量不到跨过 6h ⇒ 恰好一封,且报的是"看守层瞎了"而不是"服务坏了"', () => {
  run('C13', T0, report({ actions: [BLIND] }))
  const { mails } = run('C13', T0 + 7 * 3_600_000, report({ actions: [BLIND] }))
  assert.equal(mails.length, 1, '6 小时之后还不响 = indefinite 的失明永远没人知道')
  const m = mails[0]
  assert.match(m.name, /量不到/, `标题必须点名这是看守层的事故:${m.name}`)
  assert.match(m.name, /看守层/, '标题必须说清"坏的是这把尺子"')
  assert.doesNotMatch(m.name, /服务坏了|启动即崩/, '不得把它写成服务故障 —— 本层根本没判出它是好是坏')
  assert.match(m.opts.dedupKey, /^service-heal-blind;svcs=IHUI-API;held=6-24h$/, `身份形状坏了:${m.opts.dedupKey}`)
  assert.match(m.detail, /没有判定这几台的好坏/, '正文必须先声明"这不是判定,是量不到"')
  assert.match(m.detail, /check-service-binary-paths\.mjs --json/, '出路必须指到那把尺子本身')
})

test('C14 重新量到 ⇒ 零封且起点被摘(否则下次真失明第一封就冒充"已经六小时")', () => {
  run('C14', T0, report({ actions: [BLIND] }))
  assert.ok(existsSync(path.join(scratch, 'C14.blind-first.json')), '前置不成立:量不到那轮没落起点')
  const { mails } = run('C14', T0 + 30 * 60_000, report({ actions: [HEALTHY] }))
  assert.equal(mails.length, 0)
  assert.equal(existsSync(path.join(scratch, 'C14.blind-first.json')), false, '起点没摘掉 ⇒ 下一次失明第一封就到 6-24h 档')
})

after(() => rmScratch(scratch))
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
