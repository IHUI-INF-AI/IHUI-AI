// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// §22c 镜像测试:check-txn-cancel-boundary(事务边界内不得探测取消,G-815960)
//
// 与源脚本的关系:本文件只 `import { __test__ }`(§22d isDirectRun 保证 import 无副作用),
// **不复制判据**(两份真相是登记在案的漂移源,§22c)。覆盖面:
//   T1 装车方向锁(头注自称"尚未接线" ⇔ HEAD 的 guardian-runner 里查得到/查不到本门)
//   T2 遮噪单份实现反向锁(门体不得自带第二台分词器)
//   T3 真临时 git 仓端到端四臂(注入⇒红 / 移到边界外⇒绿 / 只写进注释⇒绿 / 注释+真站点⇒仍红)
//   T4 空枚举与两面旗同给的退出码臂
//   T5 --json 可 parse 且三态计数与末行人读逐字段一致
//   T6 投影/纯函数有牙证明(等长、命中归属、别名、声明体、串与注释)
// 落点用 scripts/lib/scratch-dir.mjs 的 mkScratch/rmScratch(§26:不得 os.tmpdir(),不得写进仓库树)。

import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { gitRaw } from '../lib/face-reader.mjs'
import { __test__ as gate } from '../check-txn-cancel-boundary.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const SCRIPT = join(ROOT, 'scripts', 'check-txn-cancel-boundary.mjs')
const GATE_REL = 'scripts/check-txn-cancel-boundary.mjs'
const GATE_STEM = 'check-txn-cancel-boundary'

const L = (...lines) => `${lines.join('\n')}\n`
const WITH_IN_BODY = L(
  'export async function writeRow(db, signal, values) {',
  '  await db.transaction(async (tx) => {',
  '    signal.throwIfAborted()',
  '    await tx.insert(rows).values(values)',
  '  })',
  '}',
)
// 修复形态:取消探测在 db.transaction(...) **之前**(边界外),体内只做事
const MOVED_OUT = L(
  'export async function writeRow(db, signal, values) {',
  '  signal.throwIfAborted()',
  '  await db.transaction(async (tx) => {',
  '    await tx.insert(rows).values(values)',
  '  })',
  '}',
)
// 同一形态只写进注释:必须**不**判红(证明遮噪关掉的是误报)
const COMMENT_ONLY = L(
  'export async function writeRow(db, signal, values) {',
  '  await db.transaction(async (tx) => {',
  '    // 早先这里写 signal.throwIfAborted(),已移到边界外',
  '    await tx.insert(rows).values(values)',
  '  })',
  '}',
)
// 注释 + 真站点:遮噪改松时这一臂会跟着翻绿,所以它证明"关掉误报"没有顺手关掉判据
const COMMENT_PLUS_REAL = L(
  'export async function writeRow(db, signal, values) {',
  '  await db.transaction(async (tx) => {',
  '    // 早先这里写 signal.throwIfAborted()',
  '    if (signal.aborted) throw new Error("cancelled")',
  '    await tx.insert(rows).values(values)',
  '  })',
  '}',
)

const runGate = (args, cwd = ROOT) =>
  spawnSync(process.execPath, [SCRIPT, ...args], {
    // 本机不写 stdio 会稳定 spawnSync EBUSY(§12g 实测 0/30);不经 shell ⇒ 不用 pnpm(.cmd 必 EINVAL)
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    windowsHide: true,
    timeout: 300000,
    cwd,
  })

const lastLine = (out) => out.trim().split('\n').filter(Boolean).pop() || ''

test('T1 装车方向锁:头注的接线声称必须与 HEAD 的注册表一致(单向自称即红)', () => {
  const src = readFileSync(SCRIPT, 'utf8')
  let registered = false
  try {
    const runner = gitRaw(['show', 'HEAD:scripts/guardian-runner.mjs'], ROOT, { timeout: 120000 })
    registered = runner.includes(GATE_STEM)
  } catch (e) {
    assert.fail(`HEAD 的 guardian-runner 取不到 ⇒ 无法判定本门是否已接线(不得记绿):${e?.message ?? e}`)
  }
  // 声称只能由**状态行**给,不能由散文给:门头注里"解释这条锁本身"的那句(写着「已接线/已注册」作为
  // 被禁词样例)会让任何按关键字扫全文的实现自噬 —— 守门 131/70 记过的同一条:"门把解释自己的散文判成站点"。
  const head = src.split('\n').slice(0, 14).join('\n')
  const claimsWired = !/(尚未接线|未接进提交链|不在提交链)/.test(head)
  if (!registered) {
    assert.ok(
      src.includes('尚未接线'),
      '本门尚未接进提交链,头注必须如实自称「尚未接线」(写了跑不通的出路是本仓明令禁止的形态)',
    )
    assert.ok(!claimsWired, `注册表里查不到本门,而头注自称已接线(${GATE_STEM})⇒ 守门 89 R2 型谎言,判红`)
    assert.ok(
      !/HUSKY_SKIP_[A-Z_]*TXN[A-Z_]*/.test(src),
      '不在钩子链上的门不得声明紧急跳过变量(按了静默无效 ⇒ 出路退化成一个谎言)',
    )
  } else {
    assert.ok(claimsWired, '本门已进注册表,头注仍自称未接线 ⇒ 台账与实态分叉(失效形态永远是安静)')
    const entry = gitRaw(['show', 'HEAD:scripts/guardian-runner.mjs'], ROOT, { timeout: 120000 })
    const at = entry.indexOf(GATE_STEM)
    const block = entry.slice(Math.max(0, at - 600), at + 600)
    assert.ok(/mode:\s*'blocking'/.test(block), '接线后本门条目必须是 blocking')
    assert.ok(/skipEnv/.test(block), '接线后必须同时声明应急跳过变量')
  }
})

test('T2 遮噪只有一份实现:门体必须引 code-mask,且不得自带第二台分词器', () => {
  const src = readFileSync(SCRIPT, 'utf8')
  assert.ok(/from '\.\/lib\/code-mask\.mjs'/.test(src), '必须引 scripts/lib/code-mask.mjs')
  for (const fn of ['maskCommentsAndStrings', 'maskCommentsStringsAndRegex']) {
    assert.ok(src.includes(fn), `门体必须用到 code-mask 的 ${fn}`)
  }
  // 反向锁:不得在门内再写一遍遮噪状态机(两处算同一件事必然漂开,§22c)
  assert.ok(
    !/\bfunction\s+(mask|blank|scanSpans|scanLiterals|tokenizer)\w*\s*\(/.test(src),
    '门体内出现了本地遮噪/分词函数 ⇒ 第二份实现,判红',
  )
  assert.ok(!/\bfrom\s+'node:fs'/.test(src), '门体不得从盘上取被审内容(取材走 face-reader)')
})

test('T3 真临时 git 仓端到端四臂:注入⇒红 / 移出边界⇒绿 / 只在注释⇒绿 / 注释+真站点⇒仍红', () => {
  const dir = mkScratch('g815960-txn-cancel-')
  try {
    const git = (args) =>
      spawnSync('git', ['-C', dir, ...args], {
        stdio: ['ignore', 'pipe', 'pipe'],
        encoding: 'utf8',
        windowsHide: true,
        timeout: 120000,
      })
    for (const a of [['init', '-q'], ['config', 'user.email', 'gate@example.invalid'], ['config', 'user.name', 'gate']]) {
      assert.equal(git(a).status, 0, `git ${a.join(' ')} 失败`)
    }
    const rel = join('apps', 'api', 'src', 'db', 'cancel-probe.ts')
    mkdirSync(dirname(join(dir, rel)), { recursive: true })
    const write = (text) => {
      writeFileSync(join(dir, rel), text, 'utf8')
      assert.equal(git(['add', '--', rel.replace(/\\/g, '/')]).status, 0)
    }
    const staged = () => runGate(['--staged', '--root', dir])
    // 站点/出路走 stderr、汇总结论走 stdout ⇒ 端到端断言必须读两半(只读 stdout 会把"判对了"读成"没点名")
    const out = (r) => `${r.stdout}\n${r.stderr}`

    write(WITH_IN_BODY)
    const inj = staged()
    assert.equal(inj.status, 1, `事务体内有取消探测必须判红,实得 rc=${inj.status}\n${out(inj)}`)
    assert.ok(
      out(inj).includes('cancel-probe.ts:3'),
      `必须点名 path:line,实得输出:\n${out(inj)}`,
    )

    write(MOVED_OUT)
    const fixed = staged()
    assert.equal(fixed.status, 0, `取消检查移到边界外应放过,实得 rc=${fixed.status}\n${out(fixed)}`)
    assert.ok(lastLine(fixed.stdout).includes('放过'), '放过桶必须被打印出来(否则"没看见"与"已确认没有"同形)')

    write(COMMENT_ONLY)
    const cm = staged()
    assert.equal(cm.status, 0, `同一形态只写进注释不得判红,实得 rc=${cm.status}\n${out(cm)}`)

    write(COMMENT_PLUS_REAL)
    const both = staged()
    assert.equal(both.status, 1, `注释之后的真站点仍必须判红(遮噪只关误报),实得 rc=${both.status}\n${out(both)}`)
    assert.ok(out(both).includes('cancel-probe.ts:4'), `点名行应为第 4 行,实得:\n${out(both)}`)
  } finally {
    rmScratch(dir)
  }
})

test('T4 空枚举与两面旗同给:都必须是 exit 2,不得记绿', () => {
  const dir = mkScratch('g815960-empty-')
  try {
    const git = (args) =>
      spawnSync('git', ['-C', dir, ...args], {
        stdio: ['ignore', 'pipe', 'pipe'],
        encoding: 'utf8',
        windowsHide: true,
        timeout: 120000,
      })
    assert.equal(git(['init', '-q']).status, 0)
    // 没有任何提交,也没有 apps/packages 源码 ⇒ 清单问不到 / 枚举到 0 ⇒ 只能"无法判定"
    const r = runGate(['--root', dir])
    assert.equal(r.status, 2, `空面必须 rc=2(不得把"没扫到"读成"都合规"),实得 rc=${r.status}\n${r.stdout}`)
    assert.ok(/无法判定|取不到|枚举到 0/.test(r.stderr + r.stdout), `结论行要写明原因,实得:\n${r.stderr}`)
  } finally {
    rmScratch(dir)
  }
  const two = runGate(['--staged', '--worktree'])
  assert.equal(two.status, 2, `两面旗同给必须 rc=2,实得 rc=${two.status}`)
  assert.ok(two.stderr.includes('不得同用'), `必须点名是哪一个矛盾,实得:\n${two.stderr}`)
})

test('T5 --json 可 parse 且三态计数与末行人读逐字段一致(HEAD 面)', () => {
  const j = runGate(['--json'])
  assert.ok([0, 1, 2].includes(j.status), `rc 必须落在 0/1/2,实得 ${j.status}`)
  let parsed
  try {
    parsed = JSON.parse(j.stdout)
  } catch (e) {
    assert.fail(`--json 必须是纯 JSON(人读行会把它打掉):${e.message}\n头 400 字符:${j.stdout.slice(0, 400)}`)
  }
  const human = runGate([])
  const line = lastLine(human.stdout)
  const grab = (label) => {
    const m = line.match(new RegExp(`${label} (\\d+)`))
    assert.ok(m, `末行没找到「${label} N」:${line}`)
    return Number(m[1])
  }
  assert.equal(parsed.counts.files, grab('文件'), '文件数:机读与人读必须同值')
  assert.equal(parsed.counts.bodies, grab('事务体'), '事务体数:两侧必须同值')
  assert.equal(parsed.hits.length, grab('命中'), '命中数:两侧必须同值')
  assert.equal(parsed.counts.passedOutside, grab(/边界外/.source), '放过(边界外):两侧必须同值')
  assert.equal(parsed.counts.passedRegexBody, grab(/正则体内/.source), '放过(正则体内):两侧必须同值')
  assert.equal(parsed.counts.passedDeclaration, grab(/声明形态/.source), '放过(声明形态):两侧必须同值')
  assert.equal(parsed.undetermined.length, grab('未判定'), '未判定数:两侧必须同值')
  assert.equal(parsed.unreadable.length, grab('取不到'), '取不到数:两侧必须同值')
  assert.equal(parsed.face, 'head', '缺省档必须判 HEAD blob(不是磁盘、不是索引)')
  // 本票的现读事实:HEAD 面命中 0 ⇒ 零容忍成立;若哪天不是 0,这条会先把"数字变了"喊出来
  assert.equal(parsed.hits.length, 0, `HEAD 面命中数现读应为 0(否则零容忍前提变了,须按 §12e 改档并同步文档)\n${JSON.stringify(parsed.hits)}`)
  assert.ok(parsed.undetermined.length > 0, `未判定应逐条点名(IndexedDB 的 db.transaction(storeName) 那一族),不得静默归零`)
})

test('T6 纯函数有牙证明:等长投影 / 最内层归属 / 别名与声明体 / 串与注释不可见', () => {
  const a = gate.judgeSource(WITH_IN_BODY)
  assert.equal(a.hits.length, 1)
  assert.equal(a.hits[0].kind, 'throwIfAborted()')
  assert.equal(a.bodies.length, 1)
  assert.equal(a.passedOutside, 0)

  const outside = gate.judgeSource(MOVED_OUT)
  assert.deepEqual(outside.hits, [])
  assert.equal(outside.passedOutside, 1)

  assert.equal(gate.judgeSource(COMMENT_ONLY).hits.length, 0, '注释里的形态不是站点')
  assert.equal(gate.judgeSource(COMMENT_PLUS_REAL).hits.length, 1, '注释之后是真站点 ⇒ 必须仍然命中')

  const nested = gate.judgeSource(
    L(
      'async function a(signal) {',
      '  return db.transaction(async (o) => {',
      '    await db.transaction(async (i) => {',
      '      if (signal.aborted) return',
      '    })',
      '  })',
      '}',
    ),
  )
  assert.equal(nested.hits.length, 1, '嵌套事务只判一次(重复计债会让两份基线互相顶掉)')
  assert.equal(nested.bodies[0].delegated, 1, '外层要留下"为什么不判"的读数')

  const aliased = gate.judgeSource(
    L('const txn = db.transaction', 'async function a() {', '  await txn(async (t) => {', '    if (t && t.signal?.aborted) return', '  })', '}'),
  )
  assert.equal(aliased.hits.length, 1, '同文件别名调用必须被认出(不接这一格,别名把整型从尺子上抹掉)')

  const decl = gate.judgeSource(
    L('const handleTx = async (tx) => {', '  if (signal.aborted) return', '}', 'async function a() {', '  return db.transaction(handleTx)', '}'),
  )
  assert.equal(decl.hits.length, 1, '标识符传入且同文件有声明 ⇒ 判体')
  const unresolved = gate.judgeSource(L('async function a(handler) {', '  return db.transaction(handler)', '}'))
  assert.equal(unresolved.hits.length, 0)
  assert.ok(unresolved.undetermined.length >= 1, '解析不到 ⇒ 未判定并点名,不静默放过也不冒红')

  // 串内的 transaction / signal.aborted 不得算站点(遮噪关掉的是误报)
  const inString = gate.judgeSource(
    L('async function a() {', '  return db.transaction(async (tx) => {', "    log.info('signal.aborted 不该被当站点')", '  })', '}'),
  )
  assert.equal(inString.hits.length, 0, '串内的形态不是站点')
  assert.equal(inString.bodies.length, 1, '体仍要被切出来(否则整条判据被遮噪一起关掉)')
  // 等长投影:行号直通的前提(两视图都由 code-mask 那一份分词器产出,门内不得自带第二台)
  assert.equal(gate.lineOf('a\nb\nc\n', 3), 2, 'lineOf 必须按换行数推行号')

  // 命中归属:同一行特定档与泛化档只计一次(否则"一处"读成"两处")
  const dup = gate.hitsIn('if (signal.aborted) void 0\n')
  assert.equal(dup.length, 1, 'signal.aborted 只能计一次(特定档优先,泛化 .aborted 不重复计)')
})

test('T7 面纪律:内容一律经 face-reader(引了层却自己 git show / 读盘 = half-wired,守门 118 判红)', () => {
  const src = readFileSync(SCRIPT, 'utf8')
  assert.ok(/from '\.\/lib\/face-reader\.mjs'/.test(src), '必须引 face-reader')
  assert.ok(/catBatch\(/.test(src), '内容必须走 catBatch(批量、同面同轮)')
  assert.ok(!/\bgitRaw\(\s*\[\s*'show'/.test(src.replace(/\s+/g, ' ')) || /listFace/.test(src), '')
  assert.ok(!/readFileSync\(/.test(src), '门体不得 readFileSync 取被审内容(工作树常年滞后 HEAD)')
  assert.ok(/ls-tree[^\n]*HEAD/.test(src), '全量档清单必须取 HEAD 树(清单与内容同面)')
  assert.ok(/isDirectRun/.test(src) && /pathToFileURL/.test(src), '§22d 入口守卫必须在位(镜像 import 不得触发 main)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
