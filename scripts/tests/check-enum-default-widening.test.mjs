// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试:scripts/check-enum-default-widening.mjs(G-816027)。
 *
 * 判据一律 **import 源文件**(§22c:镜像只复读实现就是复读机,自己再抄一份判据则是第二把尺子):
 * 本文件不实现任何"是不是宽档"的结论,只做三件事 ——
 *  ① 用门体自己的推导器证明集合确实被推出来了(正控:摘掉推导就红);
 *  ② 用**逐字来自 HEAD** 的真站点做夹具,证明门看得见它(§22c 要求至少一条真仓夹具);
 *  ③ 锁取材面纪律 / 三态不并桶 / warn 定级 / --json 可解析这些"对外形状"。
 * 成对锁的方向都各给正反两例:放宽判据与弄瞎判据都必须当场有一条不绿。
 *
 * 注:本门**未注册进 guardian-runner**(注册与记账由主会话单做,并行改注册表会互相覆盖注册块),
 * 所以这里不写"装车证明"那类锁,只在 T9 写了一条**条件锁**:若已注册,mode 必须是 warn。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { gitBinary } from '../lib/face-reader.mjs'
import { __test__ as gate } from '../check-enum-default-widening.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const GATE = join(REPO, 'scripts', 'check-enum-default-widening.mjs')
const TS_REGISTRY = gate.TS_REGISTRY
const PY_REGISTRY = gate.PY_REGISTRY
const REAL_SITE = gate.REAL_SITE_FILE

/** 读被审面一律走 HEAD blob(与门体同面),读磁盘会把并行会话的半编辑态当成"仓库现状"。 */
function faceShow(rel) {
  return execFileSync(gitBinary(), ['-c', 'safe.directory=*', 'show', `HEAD:${rel}`], {
    cwd: REPO,
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 1 << 26,
    windowsHide: true,
    // 不吃的子进程也必须显式给 stdio,否则本机报 spawnSync EBUSY(同 face-reader 记的那次)
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

function runCli(args) {
  const out = execFileSync(process.execPath, [GATE, ...args], {
    cwd: REPO,
    encoding: 'utf8',
    timeout: 300_000,
    maxBuffer: 1 << 26,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return out
}

function rcOf(args) {
  try {
    const out = execFileSync(process.execPath, [GATE, ...args], {
      cwd: REPO,
      encoding: 'utf8',
      timeout: 300_000,
      maxBuffer: 1 << 26,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { rc: 0, out }
  } catch (e) {
    return { rc: e.status ?? -1, out: String(e.stdout ?? '') + String(e.stderr ?? '') }
  }
}

/**
 * 门体自己推导出的档名宇宙(HEAD 面),所有断言都建立在它之上 —— 不在测试里抄第二份档名清单。
 * 取材面与门体同形:**量具面(MEASURE_FILES)整族按 HEAD blob 读**,读磁盘会把并行会话的
 * 半编辑态当成"仓库现状"(G-816027 收尾把轴的定义点扩到 7 个文件之后,这条更重要了:
 * 少读一个文件在门里表现为"那条轴没有宽严序",而这是一句听起来完全正当的放过理由)。
 */
function universe() {
  const sources = {}
  for (const rel of gate.MEASURE_FILES) sources[rel] = faceShow(rel)
  return gate.deriveUniverse(sources)
}

/** 按 id 取门体推出来的一条轴(测试不自己拼词表)。 */
function axisOf(u, id) {
  const a = (u.axes ?? []).find((x) => x.id === id)
  assert.ok(a, `门体没有推出轴 ${id}(axes=${JSON.stringify((u.axes ?? []).map((x) => x.id))})`)
  return a
}

/** 一条轴的"最宽/最窄"两端由门体的 rank 给,不在测试里写死档名。 */
function endsOf(axis) {
  assert.ok(axis.rank && axis.rank.size, `轴 ${axis.id} 没有现读序源,取不出两端`)
  const e = [...axis.rank.entries()]
  const max = Math.max(...e.map(([, v]) => v))
  const min = Math.min(...e.map(([, v]) => v))
  return {
    widest: e.filter(([, v]) => v === max).map(([k]) => k),
    narrowest: e.filter(([, v]) => v === min).map(([k]) => k),
  }
}

test('T1 正控:宽档集合必须由两侧注册表现读推导得出,且宽窄不交叠', () => {
  const u = universe()
  assert.equal(u.ok, true, `集合推导失败:${u.reason}`)
  assert.ok(u.wide.size > 0, '宽档集合为空 ⇒ 本门对"落宽档"整型失明(正控必须响)')
  assert.ok(u.narrow.size > 0, '窄档集合为空 ⇒ 推导只出了一半')
  for (const v of u.wide) assert.ok(!u.narrow.has(v), `${v} 同时被判成宽档与窄档`)
  for (const id of u.ids)
    assert.ok(u.wide.has(id) || u.narrow.has(id), `规范档 ${id} 既不在宽档也不在窄档里`)
})

test('T2 成对判据:default 返回推导出的宽档必红,抛错/返回非宽档必绿(档名取自集合)', () => {
  const u = universe()
  const WIDE = [...u.wide][0]
  const NARROW = [...u.narrow][0]
  const sw = (body) =>
    `function f(permissionMode){\n  switch (permissionMode) {\n    case 'plan': return 'ask';\n    default: ${body}\n  }\n}`
  const red = gate.scanSource('a.ts', sw(`return '${WIDE}';`), u).filter((c) => c.kind === 'red')
  assert.equal(
    red.length,
    1,
    `default 返回宽档 '${WIDE}' 必须判红,实得 ${JSON.stringify(gate.scanSource('a.ts', sw(`return '${WIDE}';`), u))}`,
  )
  assert.ok(
    gate
      .scanSource('a.ts', sw('throw new Error("unknown permissionMode");'), u)
      .every((c) => c.kind === 'green'),
    'default 显式抛错必须是绿的',
  )
  assert.ok(
    gate.scanSource('a.ts', sw(`return '${NARROW}';`), u).every((c) => c.kind === 'green'),
    `default 返回非免批档 '${NARROW}' 必须是绿的`,
  )
})

test('T3 Python 侧三条语法锚点必须一起认(漏一条 = 该语言整型隐身,守门 117 那一课)', () => {
  const u = universe()
  const WIDE = [...u.wide][0]
  const cases = {
    'case _': `def resolve(permission_mode: object) -> str:\n    match permission_mode:\n        case "plan":\n            return "ask"\n        case _:\n            return "${WIDE}"\n`,
    '.get(k, 档)': `def pick(cfg):\n    return cfg.get("permission_mode", "${WIDE}")\n`,
    'or 档': `def pick(permission_mode):\n    mode = permission_mode or "${WIDE}"\n    return mode\n`,
  }
  for (const [name, src] of Object.entries(cases)) {
    const red = gate.scanSource('a.py', src, u).filter((c) => c.kind === 'red')
    assert.equal(
      red.length,
      1,
      `Python ${name} 形态必须命中,实得 ${JSON.stringify(gate.scanSource('a.py', src, u))}`,
    )
  }
})

test('T4 真仓逐字夹具(§22c):HEAD 的点名站点必须入候选,且按判据落未判定', () => {
  const u = universe()
  const face = faceShow(REAL_SITE)
  const line = face.split('\n').find((l) => l.includes("tool?.dangerLevel ?? 'read'"))
  assert.ok(
    line,
    `HEAD:${REAL_SITE} 里找不到票面点名的站点 ⇒ 票面前提与门体读数已经不同形,必须回票`,
  )
  const hits = gate.scanSource(REAL_SITE, line, u)
  assert.equal(hits.length, 1, `真站点必须入候选(逐字夹具实得 ${JSON.stringify(hits)})`)
  // G-816027 收尾后的判据:词表**已经**现读到(agent-runtime.ts + api_client.py + permission-guard.ts
  // 三处 DangerLevel 声明同集合),缺的是这一轴的**声明型宽严序源**。所以这一处仍必须是未判定 ——
  // 但原因必须点名到具体的轴,不得再是"不在任何词表内"那张万能 catch-all(那等于把扩面写成装饰)。
  // 也不得被顺手判成放过:"取窄档 ⇒ 消费方给免批"那一型要读 permissions.ts 的矩阵才判得出(另计票)。
  assert.equal(hits[0].kind, 'undetermined', JSON.stringify(hits[0]))
  assert.match(hits[0].why, /DangerLevel/, `未判定必须点名到轴:${hits[0].why}`)
  assert.ok(
    !/不在被审面可推导的任何档词表内/.test(hits[0].why),
    `词表已现读却仍报"任何词表都不含它" ⇒ 推导面没扩到(原因:${hits[0].why})`,
  )
})

test('T5 遮噪方向锁:同一形态写进注释/字符串必须一条不计(门不得判自己的散文)', () => {
  const u = universe()
  const WIDE = [...u.wide][0]
  const code = `function f(permissionMode){\n  switch (permissionMode) {\n    default: return '${WIDE}';\n  }\n}`
  assert.equal(gate.scanSource('a.ts', code, u).filter((c) => c.kind === 'red').length, 1)
  const commented = `// ${code.replace(/\n/g, '\n// ')}\nconst x = 1;`
  assert.equal(gate.scanSource('a.ts', commented, u).length, 0, 'TS 注释里的形态不得入候选')
  const blocked = `const doc = "${code.replace(/\n/g, ' ')}";\nexport { doc };`
  assert.equal(gate.scanSource('a.ts', blocked, u).length, 0, 'TS 字符串里的形态不得入候选')
  const pyCommented = `# ${`cfg.get("permission_mode", "${WIDE}")`}\n`
  assert.equal(gate.scanSource('a.py', pyCommented, u).length, 0, 'Python # 注释里的形态不得入候选')
})

test('T6 集合推不出 ⇒ 一律未判定(三态不并桶:既不冒红也绝不记绿)', () => {
  // 把 TS 注册表换成残缺文本:成员表读不出 ⇒ 推导必须失败,而不是"以为没有宽档"。
  const u = gate.deriveUniverse({
    [TS_REGISTRY]: 'export const NOTHING = []\n',
    [PY_REGISTRY]: faceShow(PY_REGISTRY),
  })
  assert.equal(u.ok, false, '残缺注册表竟被当成推导成功 ⇒ 推导器会把环境故障写成业务结论')
  assert.ok(u.reason, '推导失败必须带原因')
  const found = gate.scanSource(
    'a.ts',
    `switch (permissionMode) {\n  default: return 'acceptEdits';\n}\n`,
    u,
  )
  assert.ok(found.length > 0, '判不出时也要留下候选,不能整段静默')
  assert.ok(
    found.every((c) => c.kind === 'undetermined'),
    JSON.stringify(found),
  )
  assert.equal(found.filter((c) => c.kind === 'red').length, 0, '推导失败时不得判红')
})

test('T7 取材面与遮罩的形状锁:走 face-reader、禁自派生 git show、禁 cwd 定根、遮罩只引一份', () => {
  const src = readFileSync(GATE, 'utf8')
  assert.match(src, /from '\.\/lib\/face-reader\.mjs'/)
  assert.match(src, /catBatch\(/, '内容必须经层读取(清单与正文同面同轮)')
  assert.match(src, /gitRaw\(/, '枚举必须走层的 gitRaw(绝对 git 路径,不依赖 PATH)')
  assert.ok(!/execFileSync\([^)]*'show'/.test(src), '禁止自派生 git show 取被审内容')
  assert.ok(!/process\.cwd\(\)/.test(src), '禁止用 process.cwd() 定仓库根')
  assert.match(src, /from '\.\/lib\/code-mask\.mjs'/)
  assert.ok(
    !/function maskComments|function blankByMask|const MASK_RE =|function stripComments/.test(src),
    '门内不得留第二个遮罩器(两处实现必漂移是本仓记过最多次的失效型)',
  )
  assert.match(src, /selectFace\(/, '面旗必须走层的 selectFace(两面旗同给判死)')
})

test('T8 对外形状:--json 可 JSON.parse、两面旗同给 exit 2、warn 面判红不改退出码', () => {
  const both = rcOf(['--staged', '--worktree'])
  assert.equal(both.rc, 2, `--staged 与 --worktree 同给必须判死,实得 RC=${both.rc}`)
  assert.match(both.out, /不得同用|互斥/)
  const parsed = JSON.parse(runCli(['--json']))
  assert.ok(Array.isArray(parsed.files), '--json 必须有 files')
  for (const k of ['red', 'green', 'undetermined'])
    assert.ok(Array.isArray(parsed[k]), `--json 缺三态字段 ${k}(三态不并桶是对外契约)`)
  assert.equal(parsed.counts.red, parsed.red.length)
  assert.equal(parsed.counts.green, parsed.green.length)
  assert.equal(parsed.counts.undetermined, parsed.undetermined.length)
  assert.equal(parsed.universe.ok, true, JSON.stringify(parsed.universe.reason))
})

/**
 * T9 — 定级锁(warn)。G-816027 收尾把退出码算式收成一个导出的纯函数 `exitCodeFor`
 * (它必须能被构造面钉住 —— 旧写法把 if 链散在 main 里,"有未判定⇒2"这一格只能在真仓恰好
 * 没有判红时才验得到,而今天真仓有判红,那条性质就变成"验不了")。
 * 因此本锁三件事:① main 必须**委托**给它(不得留第二份算式);② 三态成对(判红 warn⇒0 /
 * strict⇒1、无判红+有未判定 strict⇒2、两者皆无⇒0);③ 已装车时 mode 必须是 warn。
 */
test('T9 定级锁:退出码只有一份算法且 warn 面判红不改退出码;有未判定而无判红时 strict 必拒出合格证', () => {
  const src = readFileSync(GATE, 'utf8')
  assert.match(
    src,
    /return exitCodeFor\(\{ strict, redCount: d\.red\.length, undeterminedCount: d\.undetermined\.length \}\)/,
    'main 必须委托给 exitCodeFor(算式两抄必漂移)',
  )
  assert.doesNotMatch(
    src,
    /if \(strict && d\.undetermined\.length > 0\) return 2/,
    'main 里不得再留第二份退出码算式',
  )
  const { exitCodeFor } = gate
  assert.equal(
    exitCodeFor({ strict: false, redCount: 3, undeterminedCount: 0 }),
    0,
    'warn 面判红不得改退出码 —— 恒红门的唯一结局是逼人 --no-verify,连带全部守门作废(§12e)',
  )
  assert.equal(
    exitCodeFor({ strict: true, redCount: 3, undeterminedCount: 0 }),
    1,
    '问责面判红必须 1',
  )
  assert.equal(
    exitCodeFor({ strict: true, redCount: 0, undeterminedCount: 4 }),
    2,
    '有未判定而无判红时 strict 必须 2:拒绝出具合格证是特性,不是缺陷',
  )
  assert.equal(exitCodeFor({ strict: true, redCount: 0, undeterminedCount: 0 }), 0)
  // 端到端:默认面此刻(真仓有判红)必须仍是 0 —— 这一条不钉数字,只钉"warn 定级还在"。
  const def = rcOf([])
  assert.equal(def.rc, 0, `默认面不得因判红而不为 0(warn 定级被改了):RC=${def.rc}\n${def.out}`)
  let runner = ''
  try {
    runner = faceShow('scripts/guardian-runner.mjs')
  } catch {
    runner = ''
  }
  const i = runner.indexOf("script: 'check-enum-default-widening.mjs'")
  if (i >= 0)
    assert.match(
      runner.slice(Math.max(0, i - 400), i + 700),
      /mode:\s*'warn'/,
      '本门现读存量非 0 之前只能是 warn(升 blocking 的前置条件是 HEAD 面现读 0)',
    )
})

test('T10 自检必须端到端有牙:成对用例全绿(条数不写死,以"0 失败"为准),且真仓对照读数被报出', () => {
  const out = runCli(['--self-test'])
  assert.match(out, /自检 \d+ 通过 \/ 0 失败/, `自检有失败:${out}`)
  assert.match(out, /自检真仓对照:HEAD 面 扫 \d+ 文件/)
  assert.match(out, /未判定 \d+/)
})

/**
 * T11 — G-816027 定性 (b) 的对外形状锁。
 * 夹具逐字取自 HEAD(`stopReasonToExitCode` 的 `default: return 1`),不在测试里抄第二份判据:
 *  · 该处必须被读成"放过"(数字退出码不在任何由字符串档名推导出的集合里);
 *  · 同一次 --json 读数里,票面点名的 dangerLevel 站点**必须仍是未判定** ——
 *    这条是防"为了把未判定归零顺手把邻格也洗绿"的反向锁(本仓最常见的失效型)。
 */
test('T11 定性(b):退出码兜底移到放过,而票面点名的 dangerLevel 站点仍留未判定', () => {
  const u = universe()
  const face = faceShow(REAL_SITE)
  const body = face.slice(
    face.indexOf('export function stopReasonToExitCode'),
    face.indexOf('export function stopReasonToExitCode') + 900,
  )
  assert.ok(
    body.includes('default:'),
    `HEAD:${REAL_SITE} 里找不到 stopReasonToExitCode 的 default 支 ⇒ 票面前提与门体读数已不同形`,
  )
  const hits = gate.scanSource(REAL_SITE, body, u).filter((c) => c.form === 'switch-default')
  assert.equal(hits.length, 1, `switch-default 必须恰入一条候选,实得 ${JSON.stringify(hits)}`)
  assert.equal(hits[0].kind, 'green', `数字兜底(退出码)应判放过,实得 ${JSON.stringify(hits[0])}`)
  assert.match(hits[0].why, /数字字面量/, '放过必须带理由,不得静默')

  const parsed = JSON.parse(runCli(['--json']))
  const stillUnd = parsed.undetermined.filter(
    (c) => c.expr === "'read'" && c.form === 'js-fallback',
  )
  assert.equal(
    stillUnd.length,
    1,
    `dangerLevel 站点必须留在未判定(不得被邻格一起洗绿):${JSON.stringify(parsed.undetermined)}`,
  )
  // 判红数量**不钉数字**:钉 0 会在这一维被推全之后变成"禁止合规",钉任何常数都会腐烂。
  // 钉的是形状 —— 每一条判红都必须点名它踩在哪条轴的现读序源上(否则就是凭空造红)。
  for (const r of parsed.red)
    assert.match(
      r.why,
      /最宽档|免审批/,
      `判红必须带现读序源,不得出现无来源的红:${JSON.stringify(r)}`,
    )
  assert.equal(
    parsed.counts.candidates,
    parsed.red.length + parsed.green.length + parsed.undetermined.length,
    '三态必须恰好分完候选(不并桶也不凭空增删)',
  )
})

/**
 * T13 — **两轴不得并成一张表**(G-816027 收尾的正面证明,由门体自己的 rank 给档名)。
 * 'all'/'none' 同时是工具轴与审批轴的档,而两轴里它们是**相反两极**(工具轴 'all'=全开最宽,
 * 审批轴 'none'=免审批最宽)。并表 ⇒ 同一个字面量在一处冒红、在另一处静默放过,且没人看得出来
 * 用的是哪一轴的序。这里要求:同一字面量在有序的那条轴上有结论、在无序的那条轴上**必须没有**结论。
 */
test('T13 两轴不并表:同一字面量在工具轴有结论、在审批轴必须没有结论(并表即一视同仁)', () => {
  const u = universe()
  const tool = axisOf(u, 'tool')
  const approval = axisOf(u, 'approval')
  assert.ok(tool.rank, `工具轴必须从 _TOOLS_SEVERITY 现读出序源:${tool.problem}`)
  assert.ok(
    !approval.rank && !approval.wide,
    '审批轴在被审面上没有声明型序源 ⇒ 一旦它有结论就是跨轴借了序(本判据明令禁止)',
  )
  const shared = [...tool.tiers].filter((v) => approval.tiers.has(v))
  assert.ok(
    shared.length,
    '夹具前提:两轴确有同名字面量(否则这条锁没有对象,应改为点名缺口而不是假装有牙)',
  )
  const { widest } = endsOf(tool)
  const pick = shared.find((v) => widest.includes(v)) ?? shared[0]
  const onTool = gate.scanSource(
    'a.ts',
    `function f(toolClass){\n  switch (toolClass) {\n    default: return '${pick}';\n  }\n}`,
    u,
  )
  const onApproval = gate.scanSource(
    'a.ts',
    `function f(approvalClass){\n  switch (approvalClass) {\n    default: return '${pick}';\n  }\n}`,
    u,
  )
  assert.equal(onTool.length, 1, JSON.stringify(onTool))
  assert.equal(onApproval.length, 1, JSON.stringify(onApproval))
  assert.notEqual(
    onTool[0].kind,
    'undetermined',
    `字面量 '${pick}' 在有序轴上必须有结论(工具轴),实得 ${JSON.stringify(onTool[0])}`,
  )
  assert.equal(
    onApproval[0].kind,
    'undetermined',
    `同一个 '${pick}' 在审批轴上必须判不出(借序即并表),实得 ${JSON.stringify(onApproval[0])}`,
  )
})

/**
 * T14 — 整型序表的**书写形态**锁。本轮真实踩过:第一版 intMap 按行匹配,而
 * `_TOOLS_SEVERITY: dict[str,int] = {"none": 0, "readonly": 1, "all": 2}` 是**写成一行**的 ——
 * 读不出来不报错,表现为"该轴没有宽严序",于是所有落在它上面的兜底都变成一句听起来很正当的
 * 未判定(而投影到它的聊天轴也跟着一起失明)。⇒ 判据"读不到"必须比"读错"更难发现的那种,
 * 只能由形状锁钉住,不能靠现读数字(现读只会看到"未判定变多了",看不出是尺子瞎了)。
 */
test('T14 序源取材:整型序表写成一行与写成多行都必须读得出(否则"读不到"伪装成"该轴无序")', () => {
  const oneLine = 'A: dict[str, int] = {"none": 0, "readonly": 1, "all": 2}\n'
  const manyLines = 'A: dict[str, int] = {\n    "none": 0,\n    "readonly": 1,\n    "all": 2,\n}\n'
  for (const [name, src] of [
    ['一行', oneLine],
    ['多行', manyLines],
  ]) {
    const rows = gate.intMap(src, 'A')
    assert.ok(
      rows && rows.length === 3,
      `${name}书写的整型序表必须读出 3 条,实得 ${JSON.stringify(rows)}`,
    )
    assert.deepEqual(
      Object.fromEntries(rows.map((r) => [r.key, r.value])),
      { none: 0, readonly: 1, all: 2 },
      `${name}书写的序值必须逐对正确`,
    )
  }
  // 真仓那一行也必须真读得出(不抄档名:只问"门体自己有没有把工具轴推出序")
  const tool = axisOf(universe(), 'tool')
  assert.ok(tool.rank && tool.rank.size > 0, `HEAD 面工具轴必须有现读序源:${tool.problem}`)
})

/**
 * T15 — 量具面纪律:轴的定义点是**尺子**,不能因为"本次暂存集里没有它"就取不到;
 * 但它们也**不得**因此被当成被扫面(纯类型文件里的无关三元/兜底不是本门立项的那一型)。
 * 两条同时成立才叫"扩面而不越面"。
 */
test('T15 量具面进同一批读取、但不进扫描清单(扩推导面 ≠ 扩被扫面)', () => {
  const src = readFileSync(GATE, 'utf8')
  assert.match(
    src,
    /\[\.\.\.files, \.\.\.REGISTRY_FILES, \.\.\.MEASURE_FILES\]/,
    '量具面必须与清单同批读取(取不到要报名,不能静默当成"该轴无序")',
  )
  for (const rel of gate.MEASURE_FILES)
    assert.ok(
      !gate.SCAN_TARGETS.includes(rel) ||
        rel === gate.TS_REGISTRY ||
        rel === gate.PY_REGISTRY ||
        rel.startsWith('apps/cli/src/subagents'),
      `量具文件 ${rel} 不该同时是被扫描目标(会把无关文件的兜底扫进本型)`,
    )
  const scanned = gate.SCAN_TARGETS.filter((p) => gate.MEASURE_FILES.includes(p))
  assert.deepEqual(
    scanned.sort(),
    [gate.PY_REGISTRY, gate.TS_REGISTRY].sort(),
    '只有两侧注册表既是量具又被扫(它们本来就在票面射程里)',
  )
})

/**
 * T12 — G-816027 补的"缺席才生效"三道锚(解构默认值 / JS 形参默认值 / Python def 形参默认值)。
 * 方向锁两头都给:宽档写进这三个语法位必须咬红;同形的正当写法(逐字取自 HEAD 的真样本)
 * 与"无条件写死"的关键字实参必须一条不收 —— 后者是另一判据的地盘,收进来就是假红。
 */
test('T12 形态②b:三道默认值锚对宽档有牙,对同形正当写法与关键字实参不得误伤', () => {
  const u = universe()
  const WIDE = [...u.wide][0]
  const shapes = {
    'JS 形参默认值': [
      'a.ts',
      `function f(permissionMode = '${WIDE}') {\n  return permissionMode\n}`,
    ],
    'JS 箭头形参默认值': [
      'a.ts',
      `const g = (a, permissionMode = '${WIDE}') => a + permissionMode`,
    ],
    'JS 解构默认值': ['a.ts', `const { permissionMode = '${WIDE}' } = ctx`],
    'Python def 形参默认值': [
      'a.py',
      `def resolve(permission_mode="${WIDE}"):\n    return permission_mode\n`,
    ],
  }
  for (const [name, [file, src]] of Object.entries(shapes)) {
    const found = gate.scanSource(file, src, u)
    assert.equal(
      found.filter((c) => c.kind === 'red').length,
      1,
      `${name} 落宽档 '${WIDE}' 必须判红,实得 ${JSON.stringify(found)}`,
    )
    assert.equal(found.length, 1, `${name} 一条形态不得计两次,实得 ${JSON.stringify(found)}`)
  }
  // 正当样本:全仓该写法只有这几处,兜底值都不是枚举档(逐字取自 HEAD,不手抄)
  const legitBrowser = faceShow('apps/cli/src/tools/browser.ts')
  const hostLine = legitBrowser.split('\n').find((l) => l.includes("host = '127.0.0.1'"))
  assert.ok(hostLine, 'HEAD 的 browser.ts 里找不到 host 默认值那行 ⇒ 成对锁的夹具已与真仓脱节')
  assert.equal(
    gate.scanSource('apps/cli/src/tools/browser.ts', hostLine, u).length,
    0,
    `形参默认值写死非档名值不得入候选:${hostLine}`,
  )
  const legitMemory = faceShow('apps/cli/src/memory/index.ts')
  const catLine = legitMemory.split('\n').find((l) => l.includes("= '通用'"))
  if (catLine)
    assert.equal(
      gate.scanSource('apps/cli/src/memory/index.ts', catLine, u).length,
      0,
      `解构/形参默认值写死中文展示名不得入候选:${catLine}`,
    )
  // 关键字实参是"无条件写死",不属"缺席即取档" ⇒ 留在门外(否则与别的判据重复记账)
  const kwArg = gate.scanSource(
    'a.py',
    `def build():\n    return dict(permission_mode="${WIDE}")\n`,
    u,
  )
  assert.equal(kwArg.length, 0, `Python 关键字实参不得被本锚收进:${JSON.stringify(kwArg)}`)
  // 遮噪方向对新锚同样成立(写进注释/串里一条不计)
  assert.equal(
    gate.scanSource('a.ts', `// const { permissionMode = '${WIDE}' } = ctx\nconst y = 1`, u).length,
    0,
    '注释里的解构默认值不得入候选',
  )
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
