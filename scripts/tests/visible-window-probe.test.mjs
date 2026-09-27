// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// Mirror test for scripts/visible-window-probe.mjs (§22c pattern).

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'

// 形状锁一律跑在**遮罩后的代码面**(注释与字符串已抹)。不遮的话"文档里写了一句 windowsHide"
// 就能替一条缺失的代码判据背书 —— 变异自证时就是这么被蒙过去的。遮罩只留 lib/code-mask 这一份。
import { maskCommentsAndStrings } from '../lib/code-mask.mjs'

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'visible-window-probe.mjs')
const rawSource = () => readFileSync(SRC, 'utf8')
/** 代码面:等长遮罩(行号不变),注释与字符串内容不可见。 */
const codeFace = () => maskCommentsAndStrings(rawSource())
const mod = await import(pathToFileURL(SRC).href)
const { __test__, MAX_WATCH_MS } = mod
const {
  buildPowerShellScript,
  splitJsonLines,
  checkSchema,
  buildProcMap,
  deriveChain,
  classifyWindow,
  resolvePwsh,
  summarize,
  parseArgs,
  main,
  renderText,
  WINDOW_FIELDS,
  PROC_FIELDS,
} = __test__

const schemaLine = (over = {}) =>
  JSON.stringify({
    kind: 'schema',
    fields: WINDOW_FIELDS,
    procFields: PROC_FIELDS,
    pwsh: '7.6.4',
    host: 'TESTBOX',
    intervalMs: 15,
    durationMs: 0,
    minArea: 0,
    ...over,
  })
const sampleLine = ({ t = 1, snapshot = 'ok', w = [], p = [] } = {}) => JSON.stringify({ kind: 'sample', t, snapshot, w, p })
const win = (hwnd, pid, cls, title = '', wpx = 800, hpx = 600) => [hwnd, pid, wpx, hpx, 0, 0, 0, cls, title]
const proc = (pid, ppid, name) => [pid, ppid, name]

/** 假执行体:把给定行当 PowerShell stdout 交回(零派生、零副作用)。 */
const fakeRun = (lines, { ok = true, why = null, stderr = '' } = {}) => async () => ({
  ok,
  stdout: lines.join('\n'),
  why,
  stderr,
})
const runMain = async (lines, opts = []) =>
  main({
    argv: opts,
    deps: {
      platform: 'win32',
      log: () => {},
      resolvePwsh: () => ({ path: 'C:/fake/pwsh.exe', why: null }),
      runPwsh: fakeRun(lines),
    },
  })

test('T1 import 本模块不得触发任何派生(§22d 入口守卫)', async () => {
  const t0 = Date.now()
  await import(pathToFileURL(SRC).href + '?again=1')
  assert.ok(Date.now() - t0 < 1500, 'import 变慢 ⇒ 顶层又在派生 PowerShell')
  const src = readFileSync(SRC, 'utf8')
  assert.ok(rawSource().includes('pathToFileURL(process.argv[1]).href'), '§22d 守卫的比较式不见了 ⇒ import 就可能派生 PowerShell')
  assert.ok(rawSource().includes('if (isDirectRun) {'), '§22d 守卫块不见了')
  assert.ok(src.indexOf('if (isDirectRun) {') > 0 && src.slice(src.indexOf('if (isDirectRun) {')).includes('main()'), '守卫块里没有 main() ⇒ 命令行档是空的')
  assert.ok(src.indexOf('async function main') < src.indexOf('if (isDirectRun)'), '派生必须住在 main() 里(import 时不执行)')
})

test('T2 形状锁:唯一派生点必须 windowsHide + timeout + maxBuffer + stdio,且不带 shell', () => {
  // 判据面 = 遮罩后的代码面:注释里写一万句 windowsHide 都不算装车(变异自证时正是这样被蒙过去的)。
  const code = codeFace()
  // 一律用「字面 includes / 无反斜杠的正则」:反斜杠经工具链多层传递会被吃掉,而吃掉后
  // 正则仍在但恒不匹配 —— 那是"永远绿的断言",比没有断言更糟(本轮就被咬过一次)。
  assert.ok(code.includes('windowsHide: true'), '派生 PowerShell 漏 windowsHide ⇒ 探针自己弹窗(最高级的自伤)')
  assert.ok(code.includes('timeout: timeoutMs'), '无 timeout ⇒ 挂起无界(守门 80 那一型)')
  assert.ok(code.includes('maxBuffer: MAX_BUFFER_BYTES'), '无 maxBuffer ⇒ 长采样撑爆默认 1MB 缓冲后静默丢输出')
  assert.ok(code.includes('stdio: ['), 'stdio 不显式接住,stderr 会泄进工具输出、读者会把它当结论')
  // 三个槽位的**值**是字符串,遮罩面看不见 ⇒ 这一条只能在原文上钉。
  assert.ok(rawSource().includes("stdio: ['ignore', 'pipe', 'pipe']"), '槽位顺序错一个就等于把 stderr 又丢回控制台')
  assert.ok(!code.includes('shell: true'), '带 shell 会经 cmd 派生,CREATE_NO_WINDOW 失效')
  assert.ok(!code.includes("execSync") && !code.includes("spawnSync"), '同步派生没有超时就是挂起;本工具只该有一处异步 execFile')
  assert.equal(code.split('execFile(').length - 1, 1, '派生点必须只有一处(两处必漂移);按调用形态计数,import 语句不算')
})

test('T3 形状锁:不落任何临时件、不递归文件系统(§26 junction 穿透 / §15b 落点)', () => {
  const code = codeFace()
  assert.doesNotMatch(code, /mkdtempSync/, '裸 mkdtempSync 会落回 os.tmpdir()(§26 实测它仍钉在 C 盘)')
  assert.doesNotMatch(code, /tmpdir()/, '出现"取临时目录"这个动作 ⇒ 说明有人开始往临时目录写东西')
  assert.doesNotMatch(code, /readdirSync|rmSync|unlinkSync|writeFileSync|mkdirSync/, '只读探针:不得写盘、不得递归枚举(junction 穿透清空事故同族)')
  assert.doesNotMatch(rawSource(), /from 'node:os'/, '模块说明符是字符串、遮罩面看不见 ⇒ 这条只能在原文上锁')
})


test('T4 真机阳性对照:探针必须看得见此刻开着的窗口(不接受恒 0)', async () => {
  const stdout = execFileSync(process.execPath, [SRC, '--snapshot', '--json', '--no-wmi'], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 300_000, // 探针内部宽限 180s + 启动;满载机器上别让测试自己的超时抢跑
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const m = JSON.parse(stdout) // --json 必须可 parse(端到端,不是只测内部函数)
  assert.equal(m.verdict, 'measured', `真机结论:未判定 —— ${JSON.stringify(m.undetermined)}`)
  assert.ok(m.frames > 0, '一个 sample 帧都没有 ⇒ 采样通道坏了,不得当成"没有窗口"')
  assert.ok(m.procRecords > 50, `进程快照只拿到 ${m.procRecords} 条 ⇒ 归属维度不可信`)
  if ((m.distinctWindows ?? 0) === 0 && !process.env.IHUI_VWM_ALLOW_EMPTY_DESKTOP) {
    // 两句话都得说清:这不是"仓库没窗口",而是判据可能坏了 —— 想让它过必须显式声明无交互桌面。
    assert.fail(
      '本机报 0 个可见顶层窗口:要么探针看不见桌面(判据坏了 —— 本条存在的全部理由),' +
        '要么这是无交互桌面的 CI(须显式设 IHUI_VWM_ALLOW_EMPTY_DESKTOP=1 声明,不得默认放过)',
    )
  }
  assert.ok(m.result.windows.length > 0)
  for (const w of m.result.windows.slice(0, 5)) assert.ok(typeof w.class === 'string' && w.pid > 0, '样本必须逐条有名有 pid,不能只有合计')
})

test('T5 三档 CLI 形态的取参:snapshot 默认 / watch 带秒表 / 非法与超限如实归一并报出来', () => {
  const a = parseArgs([])
  assert.equal(a.mode, null, '不给档 ⇒ 交给 main 落默认 snapshot(main 里 mode==="snapshot")')
  assert.equal(parseArgs(['--snapshot']).mode, 'snapshot')
  assert.equal(parseArgs(['--watch', '5000']).watchMs, 5000)
  assert.equal(parseArgs(['--watch']).watchMs, 120_000, '默认档要覆盖一次守门链(几十秒~几分钟)')
  assert.equal(parseArgs(['--watch', 'abc']).watchMs, 120_000, '非法数字不得静默变 NaN/0')
  assert.equal(parseArgs(['--interval', '15']).intervalMs, 15)
  assert.equal(parseArgs(['--min-px', '200']).minArea, 200)
  assert.equal(parseArgs(['--json']).json, true)
  assert.equal(parseArgs(['--no-wmi']).wmi, false)
})

test('T6 --watch 超上限必须截断并说出口,不得静默少采样', async () => {
  const { exitCode, meta } = await runMain([schemaLine(), sampleLine()], ['--watch', String(MAX_WATCH_MS + 999999)])
  assert.equal(exitCode, 0)
  assert.equal(meta.durationMs, MAX_WATCH_MS)
  assert.match(meta.clamped, /已截到/, '截断不报出来就等于悄悄少看了一段')
})

test('T7 量不到 ⇒ 未判定:PowerShell 不在位时不得报"0 个窗口"', async () => {
  const { exitCode, meta } = await main({
    argv: ['--snapshot'],
    deps: {
      platform: 'linux',
      log: () => {},
      runPwsh: async () => assert.fail('非 win32 不该派生'),
      resolvePwsh: () => ({ path: null, why: '本平台为 linux,可见窗口是 Windows 概念 ⇒ 未判定(不是"没有窗口")' }),
    },
  })
  assert.equal(exitCode, 2)
  assert.equal(meta.verdict, 'undetermined')
  assert.match(meta.undetermined.join('\n'), /不是"没有窗口"/)
  assert.equal(meta.result, undefined, '未判定时不得产出一份看起来像结论的计数对象')
})

test('T8 量不到 ⇒ 未判定:PowerShell 派生失败(WMI 失败现场同法注入)', async () => {
  const res = await main({
    argv: ['--snapshot'],
    deps: {
      platform: 'win32',
      log: () => {},
      resolvePwsh: () => ({ path: 'C:/fake/pwsh.exe', why: null }),
      runPwsh: async () => ({ ok: false, stdout: '', why: 'PowerShell 未跑完(timeout(已达 180000ms,已终止本工具自己的探针子进程)):Command failed', stderr: '' }),
    },
  })
  assert.equal(res.exitCode, 2)
  assert.match(res.meta.undetermined.join('\n'), /timeout/)
})

test('T9 WMI 不可达只该让"交叉对账"这一维未判定,窗口计数照旧有效', async () => {
  const { exitCode, meta } = await runMain([
    schemaLine(),
    sampleLine({ w: [win(10, 5, 'ConsoleWindowClass', 'x')] }),
    JSON.stringify({ kind: 'wmi-error', why: 'CimException: 拒绝访问' }),
  ])
  assert.equal(exitCode, 0, 'WMI 那一维取不到不该把整次测量判死')
  assert.equal(meta.wmi.status, 'undetermined')
  assert.match(meta.wmi.why, /拒绝访问/)
  assert.equal(meta.distinctWindows, 1)
})

test('T10 schema 缺失/字段漂移 ⇒ 未判定,绝不按猜测计数', () => {
  assert.match(checkSchema(undefined).why, /schema 首行/)
  const drifted = JSON.parse(schemaLine({ fields: ['hwnd', 'pid', 'w', 'h', 'x', 'y', 'exStyles', 'class'] }))
  assert.match(checkSchema(drifted).why, /fields 与本工具预期不等/)
  assert.equal(checkSchema(JSON.parse(schemaLine())).ok, true)
})

test('T11 采样中途抛错 ⇒ 半程样本不得当全程结论', async () => {
  const { exitCode, meta } = await runMain([
    schemaLine(),
    sampleLine({ w: [win(10, 5, 'Chrome_WidgetWin_1', 'ok')] }),
    JSON.stringify({ kind: 'win-error', why: 'EntryPointNotFoundException: EnumWindows' }),
  ])
  assert.equal(exitCode, 2)
  assert.match(meta.undetermined.join('\n'), /中止/)
  assert.equal(meta.distinctWindows, 1, '已量到的帧仍然报出来 —— 未判定的是"覆盖完整"这件事,不是抹掉数据')
})

test('T12 零帧 ⇒ 未判定(不得读成"0 个窗口");零窗口 + 有帧 才是"确实是 0"', async () => {
  const noFrames = await runMain([schemaLine()])
  assert.equal(noFrames.exitCode, 2)
  assert.match(noFrames.meta.undetermined.join('\n'), /一个 sample 都没产出/)

  const realZero = await runMain([schemaLine(), sampleLine({ w: [] })])
  assert.equal(realZero.exitCode, 0)
  assert.equal(realZero.meta.distinctWindows, 0)
  assert.match(renderText(realZero.meta), /确认为 0/)
})

test('T13 进程快照全失败 ⇒ 父链未判定但窗口计数有效,归属窗口逐条点名', async () => {
  const { exitCode, meta } = await runMain([
    schemaLine(),
    sampleLine({ snapshot: 'error', w: [win(10, 5, 'ConsoleWindowClass', '闪窗')] }),
    sampleLine({ snapshot: 'empty', w: [win(11, 6, 'ConsoleWindowClass', '闪窗2')] }),
  ])
  assert.equal(exitCode, 0, '窗口维度量到了就不该整次判死')
  assert.match(meta.undetermined.join('\n'), /归属维度未判定/)
  assert.equal(meta.distinctWindows, 2)
  assert.equal(meta.result.attributionUndetermined.length, 2, '拿不到进程信息的窗口必须逐条列名,不得静默进任何归属表')
})

test('T14 阳性对照:真形态必须被聚合出来(判据有牙,不是恒 0)', async () => {
  const { meta } = await runMain([
    schemaLine(),
    sampleLine({
      t: 1,
      w: [win(101, 42, 'ConsoleWindowClass', 'C:\\Windows\\system32\\cmd.exe'), win(102, 7, 'Chrome_WidgetWin_1', '编辑器')],
      p: [proc(42, 3, 'cmd.exe'), proc(3, 4, 'conhost.exe'), proc(7, 4, 'Qoder CN.exe'), proc(4, 0, 'System'), proc(0, 0, '[System Process]')],
    }),
    sampleLine({ t: 2, w: [win(101, 42, 'ConsoleWindowClass', 'C:\\Windows\\system32\\cmd.exe')] }),
  ])
  assert.equal(meta.frames, 2)
  assert.equal(meta.distinctWindows, 2)
  assert.equal(meta.sightings, 3)
  assert.equal(meta.consoleForm, 1, '控制台形态没被认出来 ⇒ 门对本仓立项那一型全盲')
  assert.ok(classifyWindow({ class: 'CASCADIA_HOSTING_WINDOW_CLASS' }))
  const cmd = meta.result.windows.find((r) => r.image === 'cmd.exe')
  assert.equal(cmd.seenIn, 2, '目击次数没累加')
  assert.equal(cmd.chainKind, 'ok')
  assert.deepEqual(
    cmd.chain.map((c) => c.name),
    ['cmd.exe', 'conhost.exe', 'System', '[System Process]'],
  )
  assert.deepEqual(
    meta.result.perImage.map((b) => [b.image, b.windows]),
    [
      ['cmd.exe', 1],
      ['Qoder CN.exe', 1],
    ],
  )
  assert.ok(renderText(meta).includes('cmd.exe'), '人读面必须逐条列出实扫样本')
})

test('T15 父链三态:到根 / 断开 / 起点未知 / 成环,各态都不得被折成"已归属"', () => {
  const mk = (rows) => buildProcMap([{ kind: 'sample', p: rows }]).map
  const ok = mk([[5, 4, 'cmd.exe'], [4, 0, 'System'], [0, 0, '[System Process]']])
  assert.equal(deriveChain(5, ok).kind, 'ok')
  const broken = mk([[5, 9, 'cmd.exe']])
  const b = deriveChain(5, broken)
  assert.equal(b.kind, 'broken')
  assert.match(b.chain[b.chain.length - 1].name, /不在快照里:pid 9/, '断点必须报名(带 pid),不得写成"到根"')
  assert.equal(deriveChain(77, broken).kind, 'unknown')
  const cyc = mk([[5, 6, 'a.exe'], [6, 5, 'b.exe']])
  assert.equal(deriveChain(5, cyc).kind, 'cycle')
})

test('T16 中文标题不得被码页吃掉(§26 GBK 那一族的反向锁)', () => {
  const line = sampleLine({ w: [win(1, 2, 'App', '智汇AI · 设置 — 弹窗复现')] })
  const bytes = Buffer.from(line, 'utf8')
  const { parsed, bad } = splitJsonLines(bytes.toString('utf8'))
  assert.equal(bad.length, 0)
  assert.equal(parsed[0].w[0][8], '智汇AI · 设置 — 弹窗复现')
})

test('T17 PowerShell 脚本的数字插值只接受整数(注入面必须不存在)', () => {
  const s = buildPowerShellScript({ intervalMs: 15, durationMs: 2000, minArea: 0, procSnapshotMs: 15, wantWmi: false })
  assert.match(s, /\$durationMs = 2000/)
  assert.match(s, /\$wantWmi = \$false/)
  const dirty = buildPowerShellScript({ intervalMs: '15; Remove-Item x', durationMs: -3, minArea: null, procSnapshotMs: 20, wantWmi: true })
  // 归一到 0(不是"顺手猜一个 15"):非法值必须落成一个不会拼进任何语句的中性数。
  assert.match(dirty, /\$intervalMs = 0\b/)
  assert.match(dirty, /\$durationMs = 0\b/)
  assert.doesNotMatch(dirty, /Remove-Item/, '字符串原样进脚本 ⇒ 拼出来的执行体不再只由整数决定')
  assert.match(s, /CreateToolhelp32Snapshot/)
})

test('T18 形态不符的行只报数,不进任何结论', () => {
  const s = summarize({
    parsed: [
      { kind: 'sample', t: 1, snapshot: 'ok', w: [[1, 2, 3], [4, 5, 6, 7, 8, 9, 10, 'Cls', 'ok'], win(11, 12, 'X')], p: [proc(12, 4, 'p.exe'), proc(4, 0, 'System')] },
    ],
    procMap: buildProcMap([{ kind: 'sample', p: [proc(12, 4, 'p.exe'), proc(4, 0, 'System')] }]).map,
    schemaOk: true,
  })
  assert.equal(s.malformedWindows, 1)
  assert.equal(s.distinctWindows, 2)
})

test("T19 真 resolvePwsh:非 win32 必须判未判定,不得拿 Windows 候选路径凑数", () => {
  const off = resolvePwsh({ platform: "darwin", exists: () => true })
  assert.equal(off.path, null, "非 Windows 却给了执行体路径 ⇒ 下面就会去派生一个不可能成功的探针")
  assert.match(off.why, /未判定/)
  const none = resolvePwsh({ platform: "win32", exists: () => false })
  assert.equal(none.path, null)
  assert.match(none.why, /候选全部不在位/)
  const on = resolvePwsh({ platform: "win32", exists: (p) => String(p).includes("pwsh") })
  assert.match(String(on.path), /pwsh[.]exe$/)
})

test('T20 未知开关必须被拒绝并判未判定,不得静默掉进默认档', async () => {
  assert.deepEqual(parseArgs(['--watch', '5000']).unknown, [], '被 next() 吃掉的数值不得被误报成未知参数')
  assert.deepEqual(parseArgs(['--snaspot']).unknown, ['--snaspot'])
  const { exitCode, meta } = await main({
    argv: ['--snaspot', '--json'],
    deps: {
      platform: 'win32',
      log: () => {},
      resolvePwsh: () => ({ path: 'C:/fake/pwsh.exe', why: null }),
      runPwsh: async () => assert.fail('未知参数却仍然派生了探针 ⇒ 拒收形同虚设'),
    },
  })
  assert.equal(exitCode, 2)
  assert.equal(meta.verdict, 'undetermined')
  assert.match(meta.undetermined.join('\n'), /--snaspot/, '拒绝理由必须点名是哪个参数,不得只报"参数错误"')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
