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

/** 门体自己推导出的档名宇宙(HEAD 面),所有断言都建立在它之上 —— 不在测试里抄第二份档名清单。 */
function universe() {
  return gate.deriveUniverse(faceShow(TS_REGISTRY), faceShow(PY_REGISTRY))
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
  assert.equal(red.length, 1, `default 返回宽档 '${WIDE}' 必须判红,实得 ${JSON.stringify(gate.scanSource('a.ts', sw(`return '${WIDE}';`), u))}`)
  assert.ok(
    gate.scanSource('a.ts', sw('throw new Error("unknown permissionMode");'), u).every((c) => c.kind === 'green'),
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
    assert.equal(red.length, 1, `Python ${name} 形态必须命中,实得 ${JSON.stringify(gate.scanSource('a.py', src, u))}`)
  }
})

test('T4 真仓逐字夹具(§22c):HEAD 的点名站点必须入候选,且按判据落未判定', () => {
  const u = universe()
  const face = faceShow(REAL_SITE)
  const line = face
    .split('\n')
    .find((l) => l.includes("tool?.dangerLevel ?? 'read'"))
  assert.ok(line, `HEAD:${REAL_SITE} 里找不到票面点名的站点 ⇒ 票面前提与门体读数已经不同形,必须回票`)
  const hits = gate.scanSource(REAL_SITE, line, u)
  assert.equal(hits.length, 1, `真站点必须入候选(逐字夹具实得 ${JSON.stringify(hits)})`)
  // 判据是集合成员关系:'read' 属 dangerLevel 词表,其声明处不在射程 ⇒ 只能报"判不出",
  // 既不得凭空判红(判据写歪),也绝不静默放过(把没判写成判过了)。
  assert.equal(hits[0].kind, 'undetermined', JSON.stringify(hits[0]))
  assert.match(hits[0].why, /不在被审面可推导的任何档词表内/, '未判定必须点名原因')
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
  const u = gate.deriveUniverse('export const NOTHING = []\n', faceShow(PY_REGISTRY))
  assert.equal(u.ok, false, '残缺注册表竟被当成推导成功 ⇒ 推导器会把环境故障写成业务结论')
  assert.ok(u.reason, '推导失败必须带原因')
  const found = gate.scanSource('a.ts', `switch (permissionMode) {\n  default: return 'acceptEdits';\n}\n`, u)
  assert.ok(found.length > 0, '判不出时也要留下候选,不能整段静默')
  assert.ok(found.every((c) => c.kind === 'undetermined'), JSON.stringify(found))
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

test('T9 定级锁:默认面是 warn(判红不拦提交),且注册时必须是 warn(若主会话已装车)', () => {
  const src = readFileSync(GATE, 'utf8')
  assert.match(
    src,
    /if \(d\.red\.length > 0\) return strict \? 1 : 0/,
    '默认面判红不得改退出码 —— 恒红门的唯一结局是逼人 --no-verify,连带全部守门作废(§12e)',
  )
  assert.match(src, /if \(strict && d\.undetermined\.length > 0\) return 2/)
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

test('T10 自检必须端到端有牙:23 条成对全绿,且真仓对照读数被报出', () => {
  const out = runCli(['--self-test'])
  assert.match(out, /自检 \d+ 通过 \/ 0 失败/, `自检有失败:${out}`)
  assert.match(out, /自检真仓对照:HEAD 面 扫 \d+ 文件/)
  assert.match(out, /未判定 \d+/)
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
