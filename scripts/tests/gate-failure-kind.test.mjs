// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/lib/gate-failure-kind.mjs` 的镜像测试(§22c:测试直接 import 源函数,不复制判据)。
 *
 * 为什么值得单独一票:2026-09-29 我在干净检出里跑整批守门,读到"17 道 blocking 门失败",
 * 逐道在有依赖的主仓复跑却全部 rc=0 —— 单跑一道看到的是一行
 * `Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'opencc-js' …`。
 * runner 把"跑不起来"和"判红"记成同一件事,我就差点把一次 import 失败登记成"10 道语言包缺陷"。
 *
 * 五条硬约束各有正反例(缺一即判据无牙):
 *  - 崩溃 ⇒ crash,**但仍算失败**(不得把没跑成的门洗成通过);
 *  - 门自己打印的 `❌ 发现 N 处违规` ⇒ 必须还是 red(不得借"分流"给判据开后门);
 *  - 中断族(75 / 128+N / 只有 signal)⇒ interrupt,与 G-611 的传播语义同形;
 *  - 被兜底弄死(error.code = ETIMEDOUT / ENOBUFS)⇒ crash(未判定),**且这两型绝不被传播成
 *    exit 75**(后果与判红同档:仍计 failed、批量仍非零退出)。2026-10-24 立:执行器当时只把
 *    status/signal/stderr 交给这把尺子,兜底 Error 两个都是 null ⇒ 落 `判据判红(exit null)`,
 *    门 30c check-stale-copy.mjs 被 300010ms 看门狗 SIGKILL、零输出即此型实测。
 *    最危险的失效方向是"把真红洗成未判定"(逃逸口),故 F2/F3 与 F1 同票成对。
 *  - 门自己按 §0.3 交付的 exit 2 + 自称「未判定」⇒ 独成 undetermined 档(2026-10-27 立),
 *    **两个条件缺一不可**:只凭退出码放行会把刻意用 exit 2 顶红的尺子洗绿;F9 四条反向牙钉死。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

// 夹具唯一落点(AGENTS §26):不写 os.tmpdir()。
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

import { __test__ as gateFail } from '../lib/gate-failure-kind.mjs'
// 后果不变量的另一半住这把尺子里(§22c:直接 import 源实现,测试不复制判据)。
import { shouldPropagateAsInterrupt } from '../lib/signal-exit.mjs'

const REAL_CRASH_STDERR =
  "Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'opencc-js' imported from G:\\IHUI-AI-wt-crash\\scripts\\scan-i18n-zh-residue.mjs\n" +
  '    at Object.getPackageJSONURL (node:internal/modules/package_json_reader:301:9)\n' +
  '    at moduleResolve (node:internal/modules/esm/resolve:768:8)\n' +
  '\n' +
  'Node.js v24.19.0\n'

const GATE_VERDICT_STDERR =
  '❌ 发现 3 处 ko.json 中文残留:\n  - aiChat.toast.orgSaved: "已保存"\n用法: node scripts/scan-i18n-zh-residue.mjs <locale>\n'

test('C1 真仓崩溃文本 ⇒ crash,且 reason 点名指纹(不是"通过")', () => {
  const d = gateFail.decideGateOutcome({ status: 1, signal: null, stderr: REAL_CRASH_STDERR })
  assert.equal(d.kind, 'crash')
  assert.match(d.reason, /ERR_MODULE_NOT_FOUND/)
})

test('C2 门自己打印的判红 ⇒ 必须仍是 red(借分流开后门就是关掉一把尺子)', () => {
  const d = gateFail.decideGateOutcome({ status: 1, signal: null, stderr: GATE_VERDICT_STDERR })
  assert.equal(d.kind, 'red')
  assert.doesNotMatch(GATE_VERDICT_STDERR, gateFail.CRASH_MARKERS[0])
})

test('C3 中断三形态归 interrupt,与退出码语义一致(G-611)', () => {
  assert.equal(gateFail.decideGateOutcome({ status: 75, stderr: '' }).kind, 'interrupt')
  assert.equal(gateFail.decideGateOutcome({ status: 143, stderr: '' }).kind, 'interrupt')
  assert.equal(gateFail.decideGateOutcome({ status: null, signal: 'SIGTERM', stderr: '' }).kind, 'interrupt')
  // 反例:信号死时即使 stderr 里有崩溃指纹也仍归 interrupt(不得让崩溃抢走中断的传播语义)
  assert.equal(
    gateFail.decideGateOutcome({ status: null, signal: 'SIGKILL', stderr: REAL_CRASH_STDERR }).kind,
    'interrupt',
  )
})

test('C4 通过态与"红但无 stderr"两种边界都不误判成崩溃', () => {
  assert.equal(gateFail.decideGateOutcome({ status: 0, stderr: REAL_CRASH_STDERR }).kind, 'pass')
  assert.equal(gateFail.decideGateOutcome({ status: 1, stderr: '' }).kind, 'red')
  assert.equal(gateFail.decideGateOutcome({ status: 1 }).kind, 'red')
  assert.equal(gateFail.decideGateOutcome(undefined).kind, 'red')
})

test('C5 处置动作必须真给出来(光说"未判定"不写怎么清偿 = 下一条又会误读)', () => {
  const line = gateFail.crashAdvisory(3)
  assert.match(line, /3 道/)
  assert.match(line, /pnpm install/)
  assert.match(line, /--filter/, '必须写明**不带 --filter**(§12e 的剪枝坑)')
})

test('C6 装车:runner 必须真调这把尺子,并把崩溃单独成档(判函数体,不判相邻文本窗口)', () => {
  const here = resolve(fileURLToPath(import.meta.url), '../../..')
  // 2026-10-16 执行段外置:applyGateResult(调尺子的地方)逐字搬到 scripts/lib/guardian-executor.mjs,
  // 本锁跟着落点走;链路改为 runner → executor → 本 lib(同目录 import),运行时仍是同一份实现。
  const src = readFileSync(resolve(here, 'scripts/lib/guardian-executor.mjs'), 'utf-8')
  const runner = readFileSync(resolve(here, 'scripts/guardian-runner.mjs'), 'utf-8')
  assert.match(runner, /from '\.\/lib\/guardian-executor\.mjs'/, 'runner 没接执行器外置层(链断 = 双份实现)')
  assert.match(src, /from '\.\/gate-failure-kind\.mjs'/, '执行器没引这把尺子')
  assert.match(src, /decideGateOutcome\(\{/, '引了却没调用 = 提交链上一路绿灯')
  assert.match(src, /crashedGates\.push\(/, '崩溃没被单独成档')
  assert.match(src, /crashAdvisory\(/, '汇总里没给处置动作')
  // 方向锁:崩溃那一支不得把门塞进 failedGates(那才是"判红"名单)
  const from = src.indexOf("if (kind.kind === 'crash')")
  const to = src.indexOf('failedGates.push(', from)
  assert.ok(from > 0 && to > from, '取不到崩溃分支或它后面没有判红支(结构变了?)')
  assert.doesNotMatch(src.slice(from, to), /failedGates\.push\(/, '崩溃被塞进判红名单 = 分流白做')
  // 后果不变量:failed++ 必须在两个子支**之前**,不得演变成"未判定 ⇒ 放行"
  assert.match(
    src,
    /if \(check\.mode === 'blocking'\) \{\s*\n\s*failed\+\+/,
    '失败计数被挪进某一子支 ⇒ 未判定可能不被计失败',
  )
})

test('C7 stderr 必须仍被吐回上游(改 pipe 之后,"子门的话看得见"靠的是这段代码)', () => {
  const here = resolve(fileURLToPath(import.meta.url), '../../..')
  // 2026-10-16 执行段外置:这段捕获/回吐在 applyGateResult 里,随执行段搬到 executor lib。
  const src = readFileSync(resolve(here, 'scripts/lib/guardian-executor.mjs'), 'utf-8')
  assert.match(
    src,
    /process\.stderr\.write\(gateStderr\)/,
    '没有把捕获到的 stderr 原样写回 ⇒ 判据输出被静默吞掉(比误报更难查)',
  )
  assert.match(src, /stdio: \['ignore', 'inherit', 'pipe'\]/, 'stdio 形态变了要同时回头看那句 write')
})

test('C8 端到端:真派生一个 import 失败的子进程,走与 runner 同一套捕获 ⇒ crash', () => {
  // 不是构造字符串:字符串可以是抄来的,真子进程不能骗人。
  // stdio 形态与 runner 逐字一致,否则这条证明不了 runner 的行为。
  const dir = mkScratch('gfk-e2e-')
  try {
    const crashy = resolve(dir, 'crashy.mjs')
    writeFileSync(crashy, "import 'no-such-package-xyz-8f2b1c'\n", 'utf-8')
    const r = spawnSync(process.execPath, [crashy], {
      windowsHide: true,
      stdio: ['ignore', 'inherit', 'pipe'],
      maxBuffer: 20 * 1024 * 1024,
      encoding: 'utf-8',
    })
    assert.notEqual(r.status, 0, '子进程应非零退出')
    const d = gateFail.decideGateOutcome({
      status: r.status ?? null,
      signal: r.signal ?? null,
      stderr: r.stderr ?? '',
    })
    assert.equal(d.kind, 'crash', `真崩溃被读成了 ${d.kind};stderr=${String(r.stderr).slice(0, 160)}`)
    assert.match(d.reason, /ERR_MODULE_NOT_FOUND/)

    // 同一套捕获下,exit 1 但**不崩溃**的子进程必须仍判 red(不得把判红也分流掉)
    const red = resolve(dir, 'red.mjs')
    writeFileSync(red, "console.error('❌ 发现 2 处违规'); process.exit(1)\n", 'utf-8')
    const r2 = spawnSync(process.execPath, [red], {
      windowsHide: true,
      stdio: ['ignore', 'inherit', 'pipe'],
      encoding: 'utf-8',
    })
    assert.equal(
      gateFail.decideGateOutcome({
        status: r2.status ?? null,
        signal: r2.signal ?? null,
        stderr: r2.stderr ?? '',
      }).kind,
      'red',
      '判据自己打印的红被分流成别的档 = 借修 bug 关掉一把尺子',
    )
  } finally {
    rmScratch(dir)
  }
})

// ─── F 族(2026-10-24):被兜底弄死的 ⇒ 未判定,不是判红 ─────────────────────────
// 立因实测:门 30c check-stale-copy.mjs 被并行档 300010ms 看门狗 SIGKILL、零输出,
// 而 applyGateResult 只把 status/signal/stderr 交给这把尺子(没传 error.code)⇒
// status=null、signal=null ⇒ 一路落到最后一行 `判据判红(exit null)`,进了 failedGates(判红名单),
// 汇总既无 crashedGates 也无未判定段。违反 §0.3「"没判"绝不写成"判过"」。
// 这一族最容易走偏的方向是**反过来的**:把真红洗成"未判定"当逃逸口 ⇒ F2 与 F1 成对。
const TIMEOUT_REASON = gateFail.FALLBACK_KILL_CODES.ETIMEDOUT
const CAP_REASON = gateFail.FALLBACK_KILL_CODES.ENOBUFS

test('F1 反向牙①:兜底超时(signal/status 皆无、只有 code)⇒ crash,不得是 red', () => {
  for (const code of ['ETIMEDOUT', 'ENOBUFS']) {
    const d = gateFail.decideGateOutcome({ status: null, signal: null, code, stderr: '' })
    assert.notEqual(d.kind, 'red', `${code} 被读成判红 = 把"没判"写成"这道门发现了缺陷"(§0.3)`)
    assert.notEqual(d.kind, 'pass', `${code} 更不可能算通过`)
    assert.equal(d.kind, 'crash', `${code} 必须归已有的 crash(未判定)档,不新造第四种结局`)
  }
  // 两型 reason 必须可区分、且点名机制(不能都写"跑不起来"了事)
  const t = gateFail.decideGateOutcome({ status: null, signal: null, code: 'ETIMEDOUT', stderr: '' })
  const c = gateFail.decideGateOutcome({ status: null, signal: null, code: 'ENOBUFS', stderr: '' })
  assert.match(t.reason, /超时看门狗/)
  assert.match(c.reason, /20MB 上限/)
  assert.notEqual(t.reason, c.reason)
})

test('F2 反向牙②:真判红必须仍是 red —— 不许被这次改动洗成未判定(最危险的失效方向)', () => {
  // ① 无 code 的正常判红(并行/串行两条路都长这样)
  assert.equal(gateFail.decideGateOutcome({ status: 1, signal: null, code: null, stderr: '' }).kind, 'red')
  // ② 门自己打印了违规清单 ⇒ 仍 red(与 C2 同向,这里补上"带 code 键但取不到"的形态)
  assert.equal(
    gateFail.decideGateOutcome({ status: 1, signal: null, stderr: GATE_VERDICT_STDERR }).kind,
    'red',
  )
  // ③ 只认具名兜底码:其它 error.code(如 EACCES/EPERM)不得被顺路归进"未判定"当逃逸口
  for (const code of ['EACCES', 'EPERM', 'ERR_MODULE_NOT_FOUND', '', 'ETIMEDOUTX']) {
    assert.equal(
      gateFail.decideGateOutcome({ status: 1, signal: null, code, stderr: '' }).kind,
      'red',
      `未知 code=${JSON.stringify(code)} 被归成未判定 = 给任意失败开了逃口`,
    )
  }
  // ④ 判据 exit 2(取不到输入那一族由门自己打印)照旧 red,不被兜底抢走
  assert.equal(gateFail.decideGateOutcome({ status: 2, code: 'EAGAIN', stderr: '' }).kind, 'red')
})

test('F3 兜底码排在"退出码 0 ⇒ pass"之前:输出被截断/进程被杀时不得算通过', () => {
  // 并行档 ENOBUFS 的真实形态:job.status 是真实退出码(可能是 0),error 只多一个 code
  assert.equal(gateFail.decideGateOutcome({ status: 0, signal: null, code: 'ENOBUFS' }).kind, 'crash')
  assert.equal(gateFail.decideGateOutcome({ status: 0, signal: null, code: 'ETIMEDOUT' }).kind, 'crash')
  // 对照:没有兜底介入时 exit 0 仍算通过(摘掉 code 即翻回 pass ⇒ 这条断言有牙)
  assert.equal(gateFail.decideGateOutcome({ status: 0, signal: null }).kind, 'pass')
  // 兜底码也排在崩溃指纹之前:reason 说"超时"而不是"跑不起来:SyntaxError"(两类成因不混)
  assert.match(
    gateFail.decideGateOutcome({ status: null, code: 'ETIMEDOUT', stderr: REAL_CRASH_STDERR }).reason,
    /超时看门狗/,
  )
})

test('F4 端到端:真派生一个"超时被杀"和一个"输出超限"的子进程 ⇒ 都是 crash', () => {
  // 不是构造字符串:字符串可以抄,真子进程不能骗人(与 C8 同理)。
  // Node 自己在这两条路上给出的 error.code 正是执行器合成的那两个同名码 ⇒ 同一把尺子读同一条支。
  const slow = spawnSync(process.execPath, ['-e', 'setTimeout(() => {}, 5000)'], {
    timeout: 300,
    windowsHide: true,
    stdio: ['ignore', 'ignore', 'pipe'],
    encoding: 'utf-8',
  })
  assert.equal(slow.error?.code, 'ETIMEDOUT', `夹具没造出超时码:${String(slow.error)}`)
  const dt = gateFail.decideGateOutcome({
    status: slow.status ?? null,
    signal: slow.signal ?? null,
    code: slow.error?.code ?? null,
    stderr: slow.stderr ?? '',
  })
  assert.equal(dt.kind, 'crash', `真超时被读成 ${dt.kind}(${dt.reason})`)

  const noisy = spawnSync(process.execPath, ['-e', 'console.log("x".repeat(2_000_000))'], {
    maxBuffer: 1024,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf-8',
  })
  assert.equal(noisy.error?.code, 'ENOBUFS', `夹具没造出超限码:${String(noisy.error)}`)
  const dc = gateFail.decideGateOutcome({
    status: noisy.status ?? null,
    signal: noisy.signal ?? null,
    code: noisy.error?.code ?? null,
    stderr: noisy.stderr ?? '',
  })
  assert.equal(dc.kind, 'crash', `真输出超限被读成 ${dc.kind}(${dc.reason})`)
})

test('F5 后果不变量:兜底码不被传播成 exit 75,且执行器真的把 code 传进这把尺子', () => {
  // "未判定"不得演变成"跳过/重试放行":shouldPropagateAsInterrupt 对这两个 code 必须为 false
  // (它只看 status/signal —— 2026-10-24 现测:false/false)。若哪天有人扩它,这条先响。
  for (const code of ['ETIMEDOUT', 'ENOBUFS']) {
    const e = new Error('守门脚本超时未退出')
    e.code = code
    assert.equal(
      shouldPropagateAsInterrupt(e),
      false,
      `${code} 被扩进中断传播 ⇒ 兜底会变成 75 重试,那就改了后果而不只是改了归因`,
    )
  }
  const here = resolve(fileURLToPath(import.meta.url), '../../..')
  const src = readFileSync(resolve(here, 'scripts/lib/guardian-executor.mjs'), 'utf-8')
  const from = src.indexOf('decideGateOutcome({')
  const to = src.indexOf('})', from)
  assert.ok(from > 0 && to > from, '取不到 decideGateOutcome 调用处(结构变了?)')
  assert.match(
    src.slice(from, to),
    /code: e\?\.code \?\? null/,
    '调用处没传 code ⇒ 兜底弄死仍被读成判红(本次改动的主罪状,回归即红)',
  )
  // 逐条打印的清偿动作必须出自单源,不得再写死"先跑全量 pnpm install"
  assert.match(src, /crashNextStep\(kind\.reason\)/, '崩溃逐条文案没走措辞单源')
  assert.match(src, /crashAdvisory\(crashedGates\.length,\s*crashedGates\.map/, '汇总没分型报数')
  assert.doesNotMatch(
    src.slice(src.indexOf("if (kind.kind === 'crash')"), src.indexOf('} else {', src.indexOf("if (kind.kind === 'crash')"))),
    /先跑全量 pnpm install/,
    'crash 支里又写死了装依赖出路 ⇒ 对超时/超限型是跑不通的出路(§0.8)',
  )
})

test('F6 措辞单源:crashNextStep 三型各异,反查只认清单原文', () => {
  const timeoutStep = gateFail.crashNextStep(TIMEOUT_REASON)
  const capStep = gateFail.crashNextStep(CAP_REASON)
  const depStep = gateFail.crashNextStep('跑不起来:ERR_MODULE_NOT_FOUND')
  assert.match(timeoutStep, /GUARDIAN_GATE_TIMEOUT_MS/)
  assert.match(timeoutStep, /不要/, '必须显式禁止"调大旋钮消红"(§12e)')
  assert.match(capStep, /20MB/)
  assert.match(depStep, /pnpm install/)
  // 〔2026-10-29 立〕依赖型这一支必须连**串行化**一起给:本仓多会话共写一棵树,过去只写"跑全量 install",
  // 每个看见缺依赖的会话各开一枚 ⇒ 并发互踩把 node_modules 掏成空目录(实测各端全丢、根层 48 包空)。
  // 给出的出路本身成了故障源 ⇒ 现在必须点名取锁与禁并发,且"不许提装依赖"那一侧的反例照旧成立。
  assert.match(depStep, /deploy-lock|build 锁/, '依赖型必须点名先取 build 锁(并发 install 会互踩)')
  assert.match(depStep, /并发/, '依赖型必须显式禁止并发安装')
  assert.equal(gateFail.fallbackCodeOfReason(TIMEOUT_REASON), 'ETIMEDOUT')
  assert.equal(gateFail.fallbackCodeOfReason(CAP_REASON), 'ENOBUFS')
  assert.equal(gateFail.fallbackCodeOfReason('随便一句人话'), null, '反查不得靠"看着像"')
  assert.equal(gateFail.fallbackCodeOfReason(undefined), null)
})

test('F7 汇总分型报数:兜底型不会被劝去装依赖,依赖型仍给出唯一出路', () => {
  const mixed = gateFail.crashAdvisory(2, [TIMEOUT_REASON, '跑不起来:SyntaxError: x'])
  assert.match(mixed, /2 道/)
  assert.match(mixed, /被兜底弄死型 1 道/)
  assert.match(mixed, /缺依赖型 1 道/)
  assert.match(mixed, /--filter/, '依赖型必须写明**不带 --filter**(§12e 的剪枝坑)')
  assert.match(mixed, /build 锁|deploy-lock/, '依赖型必须点名先取锁(并发安装会互踩)')
  assert.match(mixed, /禁止并发安装/, '并发禁令必须出现在汇总里,不能只写在逐条档')
  const onlyFallback = gateFail.crashAdvisory(1, [CAP_REASON])
  assert.match(onlyFallback, /1 道/)
  assert.doesNotMatch(onlyFallback, /pnpm install/, '对超限截断喊装依赖 = 跑不通的出路(§0.8)')
  // 不传 reasons(旧调用形态)必须退化成"全按依赖型说",不能报出 0 道依赖型却不给任何出路
  const legacy = gateFail.crashAdvisory(3)
  assert.match(legacy, /缺依赖型 3 道/)
  assert.match(legacy, /pnpm install/)
})

test('F8 末行后果锁:crash 一支必须自己把批量顶成非零(2026-10-25 实测它曾不成立)', () => {
  // 立因(不是假想,是量出来的):`IHUI_GATE_FAST=1 GUARDIAN_GATE_TIMEOUT_MS=1 node scripts/guardian-runner.mjs --staged`
  // ⇒ 汇总打印"111 道门跑不起来(未判定)",而**批量 exit 0** —— 末尾只有判红支会 exit(1),
  // crash 支只 failed++。于是"改归因"当场演变成"改后果"(还顺带让 push-gate 那侧按 failed 判通过)。
  // 本次把兜底码接进 crash 档后,这一格的射程变大(门 30c 那型不再进判红名单,拦不住),故同批补牙。
  // 这里用结构锁(整批再跑一遍要几分钟,不适合钉在提交链上);现读 RC 的取证见交付报告与 F8 反例。
  const here = resolve(fileURLToPath(import.meta.url), '../../..')
  const src = readFileSync(resolve(here, 'scripts/lib/guardian-executor.mjs'), 'utf-8')
  const attest = src.indexOf('attestGateBatchRun(true)')
  const crashPrint = src.indexOf('if (crashedGates.length > 0) {', attest)
  const failedPrint = src.indexOf('if (failedGates.length > 0) {', crashPrint)
  const stopHint = src.indexOf('GUARDIAN_STOP_ON_FIRST=1)', failedPrint)
  const failedExit = src.indexOf('process.exit(1)', stopHint)
  const cacheWrite = src.indexOf('writePushGateCache(', failedPrint)
  assert.ok(
    attest > 0 && crashPrint > attest && failedPrint > crashPrint && stopHint > failedPrint && cacheWrite > stopHint,
    '汇总三段结构变了?(先查 attest/crash-print/failed-print/cache 的次序)',
  )
  // 正向牙:判红支仍 exit(1)(不得被这次补牙反向削掉)
  assert.ok(
    failedExit > stopHint && failedExit - stopHint < 160,
    '判红支的 exit(1) 不见了或挪了地方 = 真红也放行(反向牙:摘掉它这条必须红)',
  )
  // 反向牙:**判红支之后**必须另有一道 crash 兜底出口 —— 排在两段点名之后,两份名单都能打印完;
  // 排在缓存写入之前,免得"没结论"这一轮被写进 push-gate 缓存当成通过。
  const crashGuard = src.indexOf('if (crashedGates.length > 0) {', failedExit)
  assert.ok(
    crashGuard > failedExit && crashGuard < cacheWrite,
    '未判定没有独立的非零出口(或出口位置不对)⇒ "没判"被读成"通过"(§0.3),本次改动即此型回归',
  )
  assert.match(
    src.slice(crashGuard, cacheWrite),
    /process\.exit\(1\)/,
    'crash 兜底支只剩打印没有退出 ⇒ 汇总喊"不清偿不放行"却照样 exit 0',
  )
  // 措辞锁:这条出口的文案必须明说"未判定不等于通过",免得后人把它当普通告警删掉
  assert.match(src.slice(crashGuard, cacheWrite), /未判定/, '兜底出口的文案没点名"未判定"')
})

test('F9 §0.3 未判定独成一档:exit 2 + 门自称未判定 ⇒ undetermined,且四条反向牙不许被削', () => {
  // 正例:门按 §0.3 交付(取不到输入)⇒ 独成第五档,不并进 red/failedGates
  const und = gateFail.decideGateOutcome({
    status: gateFail.UNDETERMINED_EXIT_CODE,
    signal: null,
    stderr: '[check-x] ⚠️ 未判定:HEAD 面取不到(git show 失败)',
  })
  assert.equal(
    und.kind,
    'undetermined',
    '门自称未判定却被并进判红 ⇒ 与本次提交无关的红会逼人 --no-verify、连带废掉全部守门(§12e/§12f)',
  )
  assert.match(und.reason, /未判定/)
  // 反向牙①:只给 exit 2 而门没自称未判定 ⇒ 仍判红(本仓有刻意用 exit 2 顶红的尺子)
  assert.equal(
    gateFail.decideGateOutcome({ status: 2, signal: null, stderr: GATE_VERDICT_STDERR }).kind,
    'red',
    '仅凭退出码 2 放行 = 逃逸口:刻意用 exit 2 顶红的判据会被洗成未判定',
  )
  // 反向牙②:自称未判定却是 exit 1 ⇒ 仍是 red(那是门体口径错,不许记成未判定)
  assert.equal(gateFail.decideGateOutcome({ status: 1, signal: null, stderr: '未判定' }).kind, 'red')
  // 反向牙③:有信号且无码 ⇒ interrupt 优先(信号不是门自己交付的结论)
  assert.equal(
    gateFail.decideGateOutcome({ status: null, signal: 'SIGKILL', stderr: '未判定' }).kind,
    'interrupt',
  )
  // 反向牙③b:exit 2 与 signal 同给属于异常组合 ⇒ detectUndetermined 显式拒绝信号 ⇒ 落 red
  assert.equal(
    gateFail.decideGateOutcome({ status: 2, signal: 'SIGKILL', stderr: '未判定' }).kind,
    'red',
  )
  // 反向牙④:崩溃指纹排在未判定之前 ⇒ 同时出现按"跑不起来"处理(更严那档)
  assert.equal(
    gateFail.decideGateOutcome({
      status: 2,
      signal: null,
      stderr: "Error [ERR_MODULE_NOT_FOUND]: Cannot find module 'x'\n未判定",
    }).kind,
    'crash',
  )
  // 纯函数面:detectUndetermined 返回命中那句话(点名用),判不了时返回 null 而不是布尔
  assert.match(
    gateFail.detectUndetermined({ status: 2, signal: null, stderr: '无法判定:面为空' }),
    /无法判定/,
  )
  assert.equal(gateFail.detectUndetermined({ status: 0, signal: null, stderr: '未判定' }), null)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
