// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门 `check-write-owner-predicate.mjs` 的 §22c 镜像测试(G-815920)。
//
// 为什么这里既有行为对照也有源码形状锁:本门判的是"维护性写的归属条件/CAS/回报计数"——
// 一个**没有任何编译期症状**的缺陷族(typecheck、lint、单测、build 全都照常绿)。而它失效的
// 三种形态也全是安静的:注册块被并发会话按旧副本写回(门在、判据对、无人调度)、取材面退回
// 滞后的共享工作树(同一份 HEAD 代码在恒红与假绿之间来回跳)、上游一跳那条新判据写完却没接进
// scan 链(函数在、自检过、提交链上一路绿灯 —— 守门 70/76/81/102/145 反复记过的那一型)。
//
// 判据实现**只从 __test__ 取**(§22c 第一条红线:测试里再抄一份判据,它就从防线变成缺陷的掩体)。
// 例数一律以 `node --test` 末行现读为准,本文不钉数字。
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'

import { __test__ as gate } from '../check-write-owner-predicate.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const RUNNER = join(REPO, 'scripts', 'guardian-runner.mjs')
const SRC = join(REPO, 'scripts', 'check-write-owner-predicate.mjs')
const SCRIPT = 'check-write-owner-predicate.mjs'
const GIT_BIN = resolveGitBin() || 'git'

function gitAt(args, opts = {}) {
  return execFileSync(GIT_BIN, ['-c', 'safe.directory=*', ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 180000,
    maxBuffer: 1 << 28,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
    ...opts,
  })
}
/** 存在性问法:git 报错就是"没有",不当成测试故障(execFileSync 对失败是抛,不是返回码)。 */
function gitOk(args) {
  try {
    gitAt(args)
    return true
  } catch {
    return false
  }
}
function runGate(args, opts = {}) {
  return execFileSync(process.execPath, [join(REPO, 'scripts', SCRIPT), ...args], {
    cwd: REPO,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
    windowsHide: true,
    timeout: 300000,
    // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
    stdio: ['ignore', 'pipe', 'pipe'],
    ...opts,
  })
}
/** 跑一次并拿回 {code, out}(git 式失败不抛,判据要看退出码)。 */
function runGateRaw(args) {
  try {
    const out = runGate(args)
    return { code: 0, out }
  } catch (e) {
    return { code: e.status ?? -1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` }
  }
}

const SRC_TEXT = readFileSync(SRC, 'utf8')

/**
 * 从注册表里按**大括号配对**取出本门那一条注册项(与守门 136/139 同法)。
 * 刻意不取"脚本名前后各 N 字符"当条目范围 —— 那会跨进邻门:别人有 blocking 就算我有。
 */
function findOwnEntry(src) {
  const at = src.indexOf(`'${SCRIPT}'`)
  if (at < 0) return null
  let start = src.lastIndexOf('{', at)
  let d = 0
  let end = -1
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') d++
    else if (src[i] === '}' && --d === 0) {
      end = i
      break
    }
  }
  if (end < 0) return null
  const block = src.slice(start, end + 1)
  const m = /^\s*id:\s*['"]([^'"]+)['"]/.exec(block.split('\n').find((l) => /^\s*id:\s*['"]/.test(l)) || '')
  return { block, id: m ? m[1] : null, entryStart: start, entryEnd: end }
}

/* ----------------------------- ① 装车前置对照 ----------------------------- */

test('T1 装车证明:runner 里真有本门那条注册,且 blocking + skipEnv + stagedTriggers 成套', () => {
  const src = readFileSync(RUNNER, 'utf8')
  const e = findOwnEntry(src)
  // ↓ 本条在主会话把注册块落进 guardian-runner 之前**应当是红的**(任务书禁止实现票自己改注册表)。
  // 它红着不代表门坏了,只代表"门存在、判据对、无人调度"—— 那正是本仓最高频的"造好没装车"。
  // T2 负责证明"红是因为真没注册",而不是提取器坏了(否则本条会退化成一台恒红的尺子)。
  assert.ok(
    e,
    `${SCRIPT} 不在 runner 注册表里 ⇒ 本门零调度器(接线由主会话做;在接线落地之前这一条就是应该红)`,
  )
  assert.ok(e.id, '取号必须落在带 id 的注册块里')
  assert.match(e.block, /mode:\s*'blocking'/, '提交链档必须是 blocking(差值棘轮只拦新增,不会恒红)')
  assert.ok(
    e.block.includes(`'${gate.SELF_SKIP}'`),
    `缺应急出口 = 出事时只能改判据;文档不得写跑不通的出路(建议名 ${gate.SELF_SKIP})`,
  )
  for (const d of gate.SCAN_DIRS)
    assert.ok(e.block.includes(d), `stagedTriggers 必须覆盖射程 ${d}(漏挂等于没有这道门)`)
  const occurrences = src
    .split('\n')
    .filter((l) => /^\s*id:\s*['"]/.test(l))
    .filter((l) => l.includes(`'${e.id}'`))
  assert.equal(occurrences.length, 1, `编号 ${e.id} 在 runner 里出现 ${occurrences.length} 次(应恰好 1)`)
})

test('T2 提取器有牙:合成一条注册必须被取到;warn 档必须被本组判据拒掉', () => {
  const synth = [
    `  {`,
    `    id: '999',`,
    `    label: '维护性写归属条件对账',`,
    `    script: '${SCRIPT}',`,
    `    mode: 'blocking',`,
    `    skipEnv: '${gate.SELF_SKIP}',`,
    `    stagedTriggers: ['apps/api/src/db/', 'apps/api/src/routes/'],`,
    `  },`,
  ].join('\n')
  const e = findOwnEntry(`const checks = [\n${synth}\n]\n`)
  assert.ok(e, '取条方式必须能在一条正常注册项上工作(否则 T1 的"找不到"分不清是没注册还是没看见)')
  assert.equal(e.id, '999')
  // 反例:warn 档不成套 —— T1 的那几条判据必须拒掉它(证明 T1 不是恒真)
  const warnBlock = synth.replace(`mode: 'blocking'`, `mode: 'warn'`)
  assert.doesNotMatch(findOwnEntry(warnBlock).block, /mode:\s*'blocking'/)
})

/* ----------------------------- ② 取材面形状锁 ----------------------------- */

test('T3 取材面纪律:内容必须走 face-reader 的 catBatch,不得自派生 git show / 按磁盘读被审内容', () => {
  assert.ok(
    /from '\.\/lib\/face-reader\.mjs'/.test(SRC_TEXT),
    '必须引 scripts/lib/face-reader.mjs(守门 118:引了层却自己取内容 = 半接线)',
  )
  assert.ok(/catBatch\(/.test(SRC_TEXT), '正文必须由层的读取入口 catBatch( 取')
  assert.ok(/readWorktreeFile\(/.test(SRC_TEXT), 'worktree 逃生舱也必须走层(不得直接 fs)')
  assert.ok(!/gitRaw\(\[[^\]]*['"]show['"]/.test(SRC_TEXT), '不得散写 `git show` 取被审内容(那是第二台取材器)')
  assert.ok(!/readFileSync\(\s*(join|resolve)\(\s*ROOT/.test(SRC_TEXT), '不得按磁盘 readFileSync(join(ROOT…)) 判内容')
  // 枚举与内容必须同面同轮:两个面各只有一处取材入口,且 listCandidates/readCandidates 成对存在
  assert.ok(/export function listCandidates/.test(SRC_TEXT) && /export function readCandidates/.test(SRC_TEXT))
  assert.ok(
    /selectFace\(\{/.test(SRC_TEXT),
    '面旗必须由层的 selectFace 判(两面旗同给 ⇒ exit 2 这一条不得在门里重写)',
  )
})

test('T4 面旗矛盾判死:--staged 与 --worktree 同给必须 exit 2,不得任选一面', () => {
  const r = runGateRaw(['--staged', '--worktree'])
  assert.equal(r.code, 2, `两面旗同给应 exit 2,实得 ${r.code}`)
  assert.match(r.out, /无法判定|不得同用/, '必须喊出"无法判定",既不冒红也不记绿')
})

test('T5 上游一跳必须真接在生产链上(函数在而无人调 = 提交链上一路绿灯)', () => {
  const calls = SRC_TEXT.split('\n').filter((l) => /runHopPass\(/.test(l) && !/export function runHopPass/.test(l))
  assert.ok(calls.length >= 2, `runHopPass 必须既被定义又被调用(现见调用行 ${calls.length} 条:生产 scanOne + 夹具通道)`)
  assert.ok(
    /hopVerdict\(\{/.test(SRC_TEXT),
    'hopVerdict 必须由 runHopPass 调用,不得只是导出着等人手跑(守门 102 GA5/GA6 同型锁)',
  )
  assert.ok(
    /listEvidenceCandidates\(root, which\)/.test(SRC_TEXT),
    '证据面必须与站点面**同一档同一次**取(which 一致),否则尺子的基准与内容分叉',
  )
})

test('T6 import 解析不得有第二份:说明符候选与具名绑定表必须引门 134', () => {
  assert.ok(
    /moduleSpecCandidates/.test(SRC_TEXT) && /parseImportBindings/.test(SRC_TEXT),
    '票面 ② 的"沿 import 解析"必须复用门 134 那两份实现',
  )
  assert.ok(
    /from '\.\/check-batch-write-count-honesty\.mjs'/.test(SRC_TEXT),
    '两者必须同一条 import 说明符引自门 134',
  )
  assert.ok(
    !/function moduleSpecCandidates|function parseImportBindings/.test(SRC_TEXT),
    '本门内不得再抄一份解析实现(两处算同一件事必漂移)',
  )
  assert.ok(
    !/function maskCommentsAndStrings|function maskedSpans|function scanSpans/.test(SRC_TEXT),
    '遮罩只有一份实现(lib/code-mask.mjs),门里不得留第二份状态机',
  )
})

test('T7 归属连接器只有一份:judgeOwner 与上游一跳必须共用 connectToPreQuery', () => {
  const guardTest = SRC_TEXT.split('\n').filter((l) => /OWNER_GUARD_RE\.test\(/.test(l))
  assert.equal(guardTest.length, 1, `属主比较的取材只允许在连接器里出现一次,实得 ${guardTest.length} 次`)
  assert.ok(/connectToPreQuery\(\{/.test(SRC_TEXT), '体内判定必须调连接器(而不是各写一遍)')
  const calls = SRC_TEXT.split('\n').filter((l) => /connectToPreQuery\(\{/.test(l))
  assert.ok(calls.length >= 2, `连接器必须被**两处**调用(体内档 + 一跳档),否则一跳是死代码:实得 ${calls.length}`)
})

/* ----------------------------- ③ 三态成对(含逐字取自真仓的输入) ----------------------------- */

test('T8 阳性对照(输入逐字取自真仓 HEAD):把预查询删掉后本尺必须点名该站点', () => {
  assert.ok(gitOk(['-C', REPO, 'cat-file', '-e', 'HEAD:apps/api/src/db/chat-queries.ts']), '真仓文件必须在 HEAD 面上')
  const head = gitAt(['-C', REPO, 'show', 'HEAD:apps/api/src/db/chat-queries.ts'])
  const lines = head.split('\n')
  const s = lines.findIndex((l) => /export async function updateConversationTitle\(/.test(l))
  assert.ok(s >= 0, '票面点名的 :212-221 那一型必须还在 HEAD 面上(搬家了要同步改本例,不许退化成夹具)')
  let e = -1
  let d = 0
  let opened = false
  for (let i = s; i < lines.length; i++) {
    for (const c of lines[i]) {
      if (c === '{') {
        d++
        opened = true
      } else if (c === '}') d--
    }
    // 必须"先开过口再回到 0"才算函数体结束 —— 否则签名那几行(深度恒 0)在第二行就把片段截断了
    if (opened && d === 0) {
      e = i
      break
    }
  }
  assert.ok(e > s, '片段必须能闭合到函数体结尾(取不到说明真仓那一型搬家了,要同步改本例)')
  const verbatim = lines.slice(s, e + 1).join('\n')
  assert.match(verbatim, /\.select\(\{ userId: chatConversations\.userId \}/, '夹具必须真含那条预查询')
  const real = gate.scanFileText('apps/api/src/db/chat-queries.ts', verbatim).sites
  assert.equal(real[0].o1, 'pre-scoped', `真仓那一型不得判红(反向对照),实得 ${real[0].o1} · ${real[0].why}`)
  // 阳性对照:同一份**逐字文本**里删掉预查询 ⇒ 必须点名
  const cut = verbatim
    .replace(/const owned = await db[\s\S]*?\.limit\(1\)\s*\n/, '')
    .replace(/const row = owned\[0\]\s*\n[\s\S]*?return undefined\s*\n/, '')
  assert.notEqual(cut, verbatim, '剥预查询的夹具没生效(本例就失去意义)')
  const after = gate.scanFileText('apps/api/src/db/chat-queries.ts', cut).sites
  assert.equal(after[0].o1, 'missing', `删掉唯一那份属主证据后必须判红,实得 ${after[0].o1}`)
  assert.ok(verbatim !== cut, '对照两侧必须确有差异(不是只换了空白)')
})

test('T9 反向对照(真仓 business-card 那种"先查 owned 再删")必须不判红', () => {
  const head = gitAt(['-C', REPO, 'show', 'HEAD:apps/api/src/routes/other/business-card-routes.ts'])
  const lines = head.split('\n')
  const s = lines.findIndex((l) => /server\.delete\('\/business-card\/:id'/.test(l))
  assert.ok(s >= 0, '票面点名的反向对照站点必须还在')
  // 取到 `.returning(` 那行为止并补回箭头的闭合 —— 截在 `logAction({` 里会让花括号永不闭合,
  // 于是"解析不出所属函数体"落 undetermined,那测的是夹具的刀口而不是判据。
  const e = lines.findIndex((l, i) => i > s && /\.returning\(\{ id: businessCards\.id \}\)/.test(l))
  assert.ok(e > s, '片段必须能取到那条 .returning( 收尾')
  const seg = lines.slice(s, e + 1).join('\n') + '\n  })'
  assert.match(seg, /existing\.userId !== request\.userId/, '片段必须真含那次属主比较')
  const sites = gate.scanFileText('apps/api/src/routes/other/business-card-routes.ts', seg).sites
  assert.equal(sites[0].o1, 'pre-scoped', `正确写法被本尺判红 = 逼人给正确写法加噪音,实得 ${sites[0].o1}`)
})

test('T10 三态各就位且互不并桶(构造面,判据从 __test__ 取)', () => {
  const f = gate.FIXTURES
  const one = (t) => gate.judgeFixture(t)[0]
  assert.equal(one(f.sqlScoped).o1, 'sql-scoped')
  assert.equal(one(f.missingBatch).o1, 'missing')
  assert.equal(one(f.rawSqlPositional).o1, 'undetermined')
  assert.equal(one(f.whereSpread).o1, 'undetermined')
  // 名单里每一个归属列都必须真能命中(守门 120:名单可以是张死表而门一路报绿)
  for (const col of gate.OWNER_COLUMNS) assert.equal(one(gate.rosterFixture(col)).o1, 'sql-scoped', `${col} 命中不了`)
  // 注释/字符串里的归属条件不得算证据(两档遮噪方向不同,混用即失明或误伤)
  assert.equal(one(f.ownerInCommentOnly).o1, 'missing')
  assert.equal(one(f.ownerInStringOnly).o1, 'missing')
})

test('T11 上游一跳四组成对(放行条件是全量调用点,不是任一处)', () => {
  const HP = gate.BUNDLE_FIXTURES.helperFile
  const B = gate.BUNDLE_FIXTURES
  const site = (r) => r.perFile.find((x) => x.file === HP).sites[0]
  const scoped = gate.scanBundleWithHop([[HP, B.helper], ['apps/api/src/routes/a.ts', B.scopedCaller(HP)]])
  assert.equal(site(scoped).o1, 'pre-scoped')
  assert.equal(site(scoped).viaHop, true)
  assert.equal(scoped.counts.preScopedByHop, 1, '一跳放行必须另档计数,与体内证据分家')
  const bare = gate.scanBundleWithHop([[HP, B.helper], ['apps/api/src/routes/b.ts', B.unscopedCaller(HP)]])
  assert.equal(site(bare).o1, 'missing', '调用方没有属主预查询 ⇒ 不许读成有证据')
  const partial = gate.scanBundleWithHop([
    [HP, B.helper],
    ['apps/api/src/routes/c.ts', B.scopedCaller(HP)],
    ['apps/api/src/routes/d.ts', B.unscopedCaller(HP)],
  ])
  assert.equal(site(partial).o1, 'missing', '一带一无 ⇒ 仍 missing(一个守法调用方不给整条 SQL 发合格证)')
  assert.equal(site(partial).hop.calls, 2)
  const none = gate.scanBundleWithHop([[HP, B.helper]])
  assert.equal(site(none).o1, 'undetermined', '找不到调用点 ⇒ 判不了,不是"确信没有")')
})

test('T12 O2 永不判红(与守门 134 的分工锁:两道门互指同一格 = 两份基线互相顶掉)', () => {
  const r = gate.scanFileText('o2.ts', gate.O2_FIXTURES.fromRequest)
  const t = gate.tally([r])
  assert.equal(t.counts.o2FromRequest, 1)
  assert.equal(t.counts.missing, 0)
  for (const face of ['head', 'staged'])
    for (const strict of [false, true])
      assert.equal(
        gate.decide({ face, strict, missing: 0, undetermined: 0, ratcheted: 0 }),
        0,
        `O2 读到 from-request 不得抬起退出码(${face}/${strict})`,
      )
})

test('T13 棘轮与退出码:提交链档必须有牙,全量档必须只报数,未判定不得吞掉通过', () => {
  assert.equal(gate.decide({ face: 'head', strict: false, missing: 865, undetermined: 52, ratcheted: 9 }), 0)
  assert.equal(gate.decide({ face: 'staged', strict: false, missing: 865, undetermined: 52, ratcheted: 0 }), 0)
  assert.equal(gate.decide({ face: 'staged', strict: false, missing: 865, undetermined: 52, ratcheted: 1 }), 1)
  assert.equal(gate.decide({ face: 'head', strict: true, missing: 0, undetermined: 1, ratcheted: 0 }), 2)
  const cur = [{ file: 'a', sites: [{ o1: 'missing', line: 1 }, { o1: 'missing', line: 2 }] }]
  assert.equal(gate.ratchet(cur, new Map([['a', [{ o1: 'missing' }]]])).length, 1, '只点名超出额度的那一处')
  assert.equal(gate.ratchet(cur, new Map([['a', [{ o1: 'missing' }, { o1: 'missing' }]]])).length, 0)
  // 净零逃逸防线:把一处 missing 改写成 sql-scoped 不得让另一处 missing 顶掉名额
  const mixed = [{ file: 'a', sites: [{ o1: 'missing' }, { o1: 'sql-scoped' }] }]
  assert.equal(gate.ratchet(mixed, new Map([['a', [{ o1: 'missing' }]]])).length, 0)
})

/* ----------------------------- 端到端:临时 git 仓 ----------------------------- */

test('T14 端到端(私有索引/真 git 面):一跳在 CLI 上真生效,新增敞口在 --staged 上真判红', () => {
  const dir = mkScratch('wop-e2e')
  try {
    mkdirSync(join(dir, 'apps/api/src/db'), { recursive: true })
    mkdirSync(join(dir, 'apps/api/src/routes'), { recursive: true })
    writeFileSync(join(dir, 'package.json'), '{"name":"scratch-wop"}\n')
    const HP = 'apps/api/src/db/hop-helper.ts'
    writeFileSync(join(dir, HP), gate.BUNDLE_FIXTURES.helper)
    writeFileSync(
      join(dir, 'apps/api/src/routes/hop-a.ts'),
      gate.BUNDLE_FIXTURES.scopedCaller(HP),
    )
    gitAt(['-C', dir, 'init', '-q'])
    gitAt(['-C', dir, 'add', '-A'])
    gitAt(['-C', dir, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'fixture'])
    const json = JSON.parse(runGate(['--root', dir, '--json']))
    assert.ok(json.counts.preScopedByHop >= 1, `一跳必须在 CLI 上真生效,实得 ${json.counts.preScopedByHop}`)
    assert.equal(json.exit, 0, '全量档非 strict 必须只报数')
    // 新增一处敞口(匿名箭头里的无条件按 id 删)⇒ 提交链档必须判红
    writeFileSync(
      join(dir, 'apps/api/src/routes/hop-new.ts'),
      `server.delete('/z/:id', async (request) => {\n  const id = request.params.id\n  await db.delete(chatConversations).where(eq(chatConversations.id, id))\n})\n`,
    )
    gitAt(['-C', dir, 'add', '--', 'apps/api/src/routes/hop-new.ts'])
    const after = runGateRaw(['--root', dir, '--staged'])
    assert.equal(after.code, 1, `超出该文件 HEAD 自身存量的新增必须拦(实得 ${after.code})`)
    assert.match(after.out, /棘轮|新增/)
    // 反向对照:把这一处从索引撤掉 ⇒ 同一个面必须回 0(证明上一条红不是恒红)
    gitAt(['-C', dir, 'rm', '--cached', '-q', '--', 'apps/api/src/routes/hop-new.ts'])
    const back = runGateRaw(['--root', dir, '--staged'])
    assert.equal(back.code, 0, `撤掉新增后仍红 = 恒红门(实得 ${back.code})`)
  } finally {
    rmScratch(dir)
  }
})

test('T15 真仓 HEAD 面必须现读得到站点(看不见存量不算通过;数字一律现读不写死)', () => {
  const json = JSON.parse(runGate(['--json']))
  assert.ok(json.counts.sites > 500, `真仓 HEAD 面站点数应当是几百上千量级,实得 ${json.counts.sites}`)
  assert.ok(json.counts.sqlScoped > 0, '阳性对照:真仓必须至少判出一档 sql-scoped')
  assert.ok(json.counts.files > 100 && json.hop.evidenceFiles > json.counts.files)
  assert.equal(json.exit, 0, '全量档非 strict 恒 0(存量未逐条定性前挂 blocking = 恒红门)')
  // 未判定必须**报数且报名**,不得静默并进通过
  const reasons = json.undeterminedReasons.reduce((a, [, n]) => a + n, 0)
  assert.equal(reasons, json.counts.undetermined, 'undetermined 的原因分布必须覆盖每一个未判定站点')
})

test('T16 自豁免与射程:本门源码与镜像测试不得被自己判红', () => {
  assert.ok(gate.SELF_EXEMPT.includes('scripts/check-write-owner-predicate.mjs'))
  assert.ok(gate.SELF_EXEMPT.includes('scripts/tests/check-write-owner-predicate.test.mjs'))
  const listed = gate.listCandidates(REPO, 'head')
  assert.ok(!listed.some((p) => /check-write-owner-predicate/.test(p)), '自豁免必须真在枚举处生效')
  assert.equal(gate.SCAN_DIRS.length, 2, '射程与门 134 同面(两把尺子的读数才可比)')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* ----------------------------- O1c CAS 维度(票面 ① 的后半) ----------------------------- */

test('T17 CAS 维度已装车、三态不并桶、且永不抬起退出码', () => {
  // 装车:定义之外必须有调用点(函数在而没人调 = 提交链上一路绿灯,守门 70/76/81/102 同型)
  const calls = SRC_TEXT.split('\n').filter((l) => /judgeCas\(\{/.test(l))
  assert.ok(calls.length >= 1, 'judgeCas 必须由 scanFileText 调用,否则 CAS 那一格零判据')
  // 三态各就位(输入取自门自己的夹具,夹具的原文又取自真仓/上游)
  const one = (t) => gate.judgeFixture(t)[0]
  const present = one(`export async function f(u: string, id: string) {
  return db.update(chatConversations).set({ title: 'x' }).where(and(eq(chatConversations.userId, u), eq(chatConversations.title, old))).returning()
}`)
  assert.equal(present.cas, 'cas-present')
  const absent = one(gate.FIXTURES.realPreSelectThenWrite)
  assert.equal(absent.cas, 'cas-absent', '票面点名的那一型必须被点名成"归属齐、CAS 缺"')
  assert.equal(absent.o1, 'pre-scoped', '而 O1 仍认它合法(两维互不顶)')
  const na = one(gate.FIXTURES.sqlScoped)
  assert.equal(na.cas, 'not-applicable', 'DELETE 没有被改列 ⇒ 不是 cas-absent,也不是判不了')
  // 判据不进退出码:decide 的实现里不得出现 cas 这一维(与 O2 同一条分工锁)
  const at = SRC_TEXT.indexOf('export function decide(')
  const decideSrc = SRC_TEXT.slice(at, SRC_TEXT.indexOf('\n}', at))
  assert.ok(decideSrc.length > 40, '取不到 decide 的实现,本条锁就没了意义')
  assert.ok(!/cas/i.test(decideSrc), 'CAS 一旦进 decide 就是拿只报数的那一维去判红(与门 134 互指同一格)')
})
