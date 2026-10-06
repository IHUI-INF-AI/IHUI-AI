// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `scripts/check-agent-status-vocabulary-parity.mjs` 的 §22c 镜像测试(D6/G3,2026-09-27)。
 *
 * 为什么必须存在:本门判的是"同一批成员集合在两侧是否逐字等值",而它的测试若自己再写
 * 一份解析规则或一份成员清单,就成了"用另一把尺子量同一件事"—— 源门漂移时测试照样绿
 * (§22c 的原始动因:镜像只复读实现就是复读机)。所以本文件**只 import 生产实现**,
 * 成员清单一律用门自己导出的夹具,一条解析规则都不重写。
 *
 * 跑法:`node --test scripts/tests/check-agent-status-vocabulary-parity.test.mjs`
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { __test__ as gate } from '../check-agent-status-vocabulary-parity.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SRC_NAME = 'check-agent-status-vocabulary-parity.mjs'
const TEST_NAME = 'check-agent-status-vocabulary-parity.test.mjs'

const gitShow = (refPath) => {
  try {
    return execFileSync('git', ['-c', 'safe.directory=*', '-C', ROOT, 'show', refPath], {
      // 2026-10-04:不吃的子进程必须给 stdio,否则本机报 spawnSync EBUSY
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
      timeout: 120_000,
    })
  } catch {
    return null
  }
}

/** 两侧真输入(工作树面 —— 单一真相源常量与本门是同一枚提交落地的,HEAD 面在落地前必然读不到)。 */
function realContents() {
  return {
    [gate.FILES.tsTypes]: readFileSync(join(ROOT, gate.FILES.tsTypes), 'utf8'),
    [gate.FILES.pyScheduler]: readFileSync(join(ROOT, gate.FILES.pyScheduler), 'utf8'),
    // SV4(D145①)三份输入:广告面 / 注册表 / persona 投影
    [gate.SV4_FILES.pyMcp]: readFileSync(join(ROOT, gate.SV4_FILES.pyMcp), 'utf8'),
    [gate.SV4_FILES.pyOrchestrator]: readFileSync(
      join(ROOT, gate.SV4_FILES.pyOrchestrator),
      'utf8',
    ),
    [gate.SV4_FILES.tsPersonas]: readFileSync(join(ROOT, gate.SV4_FILES.tsPersonas), 'utf8'),
  }
}

function decideWith(over, candidates = []) {
  return gate.decide({ ...realContents(), candidates, ...over })
}

test('T1 测试不得有第二份真相:只 import 生产实现,且不得自带成员清单字面量', () => {
  const src = readFileSync(join(ROOT, 'scripts', 'tests', TEST_NAME), 'utf8')
  assert.match(src, /from '\.\.\/check-agent-status-vocabulary-parity\.mjs'/, '没 import 生产实现')
  // 反向锁:测试文件里出现任一六态成员字面量 ⇒ 它在自己判自己(判据的输入表被复制了一份)
  assert.doesNotMatch(
    src,
    /['"]triage['"]|['"]in_progress['"]|['"]blocked['"]/,
    '测试里写了成员字面量 ⇒ 第二份真相,源门漂移时本测试会跟着一起绿',
  )
})

test('T2 真仓两侧现读:成员集合逐字等值、状态机表自洽、SV3 候选看得见', () => {
  const r = decideWith({}, [{ path: 'compliant.tsx', src: gate.FIXTURE_COPY_OK }])
  assert.ok(r.tables, `判据输入读不出表(未判定即失明):${JSON.stringify(r.undetermined)}`)
  assert.deepEqual(r.undetermined, [], '既有输入被判不出 ⇒ 不得把"没判"当成通过')
  const sv12 = r.violations.filter((v) => !v.startsWith('SV3'))
  assert.deepEqual(sv12, [], `跨语言/自洽维度分叉:${JSON.stringify(sv12)}`)
  // "扫到 0"必须先怀疑尺子:两侧任何一张输入表读出 0 条,tables 的对应计数也必须 >0
  assert.ok(r.tables.count > 0 && r.tables.pyTableCount > 0 && r.tables.pyLiteralCount > 0)
  assert.equal(r.tables.pyTableCount, r.tables.count)
  assert.equal(r.tables.pyLiteralCount, r.tables.count)
  assert.equal(r.tables.transitionsCount, r.tables.count)
})

test('T3 阳性对照(输入逐字取自真实文件):从 Python 对齐表删掉一档必点名该档', () => {
  const py = realContents()[gate.FILES.pyScheduler]
  // 受害档位由被审面自己给出(测试不得自带成员字面量 —— 见 T1 的反向锁)
  const members = gate.decide(realContents()).tables.members
  const lineOf = (m) => `\n    "${m}",`
  const victim = members.find((m) => py.includes(lineOf(m)))
  assert.ok(victim, '真实文件里找不到可删除的对齐表行 ⇒ 锚点形态已变,本对照空转')
  const injected = py.replace(lineOf(victim), '\n')
  assert.notEqual(injected, py, '注入未命中 ⇒ 这条对照在空转(必须改锚点,不许删测试)')
  const r = decideWith({ [gate.FILES.pyScheduler]: injected })
  const hit = r.violations.filter((v) => v.startsWith('SV1'))
  assert.ok(hit.length >= 1, `删一档必须红 SV1:${JSON.stringify(r.violations)}`)
  assert.ok(
    hit.some((v) => v.includes(victim)),
    `结论行必须点名被删的那一档(${victim}):${JSON.stringify(hit)}`,
  )
})

test('T4 反向对照(与 T3 成对):不动两侧 ⇒ SV1 一条都不红', () => {
  const r = decideWith({})
  assert.deepEqual(
    r.violations.filter((v) => v.startsWith('SV1')),
    [],
    JSON.stringify(r.violations),
  )
})

test('T5 输入取不到 ⇒ 未判定、零违规、tables=null(不把工具故障算成仓库违规)', () => {
  const r = gate.decide({ [gate.FILES.tsTypes]: '', [gate.FILES.pyScheduler]: 'x' })
  assert.equal(r.tables, null)
  assert.equal(r.violations.length, 0)
  assert.match(String(r.undetermined[0]), /取不到|无法判定/)
})

test('T6 声明被改名/换成运行时表达式 ⇒ 未判定(绝不带着半张表去比对)', () => {
  const py = realContents()[gate.FILES.pyScheduler]
  const renamed = py.replace(
    'KANBAN_TASK_STATUSES: tuple[str, ...] = (',
    'KANBAN_STATES: tuple[str, ...] = (',
  )
  assert.notEqual(renamed, py, '注入未命中')
  const r = decideWith({ [gate.FILES.pyScheduler]: renamed })
  assert.equal(r.tables, null)
  assert.match(JSON.stringify(r.undetermined), /解析不到声明/)
})

test('T7 装车成套性:头注声明必须与 runner 现读一致;已注册则必须成套', () => {
  // 两边都取 **HEAD 面**:本用例判的是"提交链上装没装车"这个事实,不是工作树此刻长什么样。
  // 混面(HEAD 的 runner 配工作树的头注)会在别人改了一半、还没提交时假红 —— 共享工作树下必踩。
  const headGate = gitShow(`HEAD:scripts/${SRC_NAME}`)
  assert.ok(headGate, `HEAD 面取不到 scripts/${SRC_NAME} ⇒ 本用例空转`)
  const runner = gitShow('HEAD:scripts/guardian-runner.mjs')
  const SCRIPT_RE = new RegExp(`script: '${SRC_NAME.replace(/\./g, '\\.')}'`)
  const registered = !!runner && SCRIPT_RE.test(runner)

  // ⚠️ 原未注册分支是 assert.doesNotMatch(head, /已接 pre-commit|CI 必跑|第 \d+ 项/)。
  //   普查报它"字面量略宽、可收紧"只说对了一半 —— 真病是**锚错了对象**:
  //   ① 它只认"pre-commit / CI 必跑 / 第 N 项"三种**旧措辞**;本门头注早已改写成
  //      【接线状态:已接入】,于是"注册条被摘、头注仍自称已接入"它算没命中 ⇒ 照样绿(静默假绿)。
  //   ② `第 \d+ 项` 锚的是 runner 里的门序号,随门数单调增长(会漂的字面量,与
  //      migration T5 的 `/可比对 30\d/` 同族);`CI 必跑` 则是本门从未有过的形态。
  //   ③ 它只钉"不得自称已接"这一个方向 ⇒ 头注删了接线声明、或 runner 注册了而头注仍
  //      写"未接入",两处反向漂移都无人喊红。
  // ⇒ 改成结构判据:头注用**唯一**的【接线状态:…】标记声明接线事实,本用例按 runner 现读
  //    做**双向**对账。措辞不再进断言 ⇒ 头注日后怎么改写都不会假红/假绿。
  const claim = headGate.match(/【接线状态:([^】]+)】/)
  assert.ok(claim, '头注缺【接线状态:…】标记 ⇒ 接线声明无处可读,本用例已空转')
  assert.equal(
    claim[1] === '已接入',
    registered,
    `头注声明「接线状态:${claim[1]}」与 runner 现读不一致(registered=${registered})`,
  )
  if (!registered) return

  const at = runner.search(SCRIPT_RE)
  assert.ok(at >= 0, 'runner 注册块缺 script 字段(仅路径字符串不构成装车)')
  // ⚠️ 原来取 `at ± 900` 的**窗口**判 mode/skipEnv,实测无牙:窗口跨进邻门,邻门的
  // `mode:'blocking'` 替本门交差(把本门自己翻成 warn 后断言仍绿)。改按**注册块边界**取本门那条。
  const start = runner.lastIndexOf('\n  {', at)
  const next = runner.indexOf('\n    script:', at + 10)
  const entry = runner.slice(start < 0 ? at : start, next > 0 ? next : runner.length)
  assert.match(entry, /mode:\s*'blocking'/)
  assert.match(
    entry,
    new RegExp(`skipEnv:\\s*'${gate.SELF_SKIP}'`),
    '应急跳过名必须与门自己声明的同一个',
  )
})

test('T8 取材面纪律:被审内容必须走 face-reader 的 catBatch,不得散写 git show / 磁盘读', () => {
  const src = readFileSync(join(ROOT, 'scripts', SRC_NAME), 'utf8')
  assert.match(src, /from '\.\/lib\/face-reader\.mjs'/)
  assert.match(src, /catBatch\(/, '没有真调用层的读取入口 ⇒ 门 118 判半接线')
  assert.doesNotMatch(src, /['"]show['"]\s*,/, '散写 git show 取被审内容 = 第二份取材实现')
  assert.doesNotMatch(src, /readFileSync\(\s*join\(\s*ROOT/, '按磁盘读被审内容 = 恒红/假绿来回跳')
  assert.match(src, /from '\.\/lib\/code-mask\.mjs'/, '遮罩必须用唯一实现,不得留第二份')
})

test('T9 SV3 在真语料上有牙:未引用 canonical 的抄本必被点名,引用了的不点名', () => {
  // 成员集合取自**夹具自己**:夹具用合成档位,与真仓六态无交集,拿真仓集合去量夹具
  // 会得到"看不见任何成员"的假绿(本用例第一轮就是这么绿的)。
  const fx = gate.decide({
    [gate.FILES.tsTypes]: gate.FIXTURE_TS,
    [gate.FILES.pyScheduler]: gate.FIXTURE_PY,
  })
  assert.ok(fx.tables, '夹具本身必须读得出表')
  const members = new Set(fx.tables.members)
  assert.equal(members.size, 4)
  const bad = gate.judgeCopy(null, gate.FIXTURE_COPY_BAD, members)
  const good = gate.judgeCopy(null, gate.FIXTURE_COPY_OK, members)
  const comment = gate.judgeCopy(null, gate.FIXTURE_COPY_COMMENT, members)
  assert.equal(bad.violation, true, '新写一份成员清单不判红 = 本门对自己立项那一型全盲')
  assert.equal(good.candidate, false, '引用同一份的列序推导不得算第二份')
  assert.equal(comment.violation, false, '注释里的成员散文不得算第二份')
  assert.ok(
    comment.commentOnly && comment.commentOnly.length > 0,
    '但必须如实报"仅注释提到",不得静默',
  )
})

test('T10 三态不得并桶:候选取不到内容 ⇒ 未判定,且不得同时产出该文件的红', () => {
  const r = decideWith({}, [{ path: 'unreadable.tsx', src: null }])
  assert.match(JSON.stringify(r.undetermined), /取不到内容:unreadable\.tsx/)
  assert.equal(
    r.violations.filter((v) => v.includes('unreadable.tsx')).length,
    0,
    '把"没看清"写成"有问题"与写成"没问题"同罪',
  )
})

// ============================ SV4(D145①)============================

const sv4Fx = (over = {}) =>
  gate.decide({
    ...realContents(),
    [gate.SV4_FILES.pyMcp]: gate.FIXTURE_MCP_DYNAMIC,
    [gate.SV4_FILES.pyOrchestrator]: gate.FIXTURE_ORCH,
    [gate.SV4_FILES.tsPersonas]: gate.FIXTURE_PERSONAS_OK,
    candidates: [],
    ...over,
  })

test('T11 SV4 反向对照(夹具级,"清单腐烂"判据有牙):硬编码幽灵名单必红且逐名点名;动态拼接必绿', () => {
  const ok = sv4Fx()
  assert.equal(
    ok.violations.filter((v) => v.startsWith('SV4')).length,
    0,
    `注册表现读拼接被自己判红(判据过宽):${JSON.stringify(ok.violations)}`,
  )
  const ghost = sv4Fx({ [gate.SV4_FILES.pyMcp]: gate.FIXTURE_MCP_GHOST })
  for (const n of ['ghost-one', 'ghost-two', 'ghost-three'])
    assert.ok(
      ghost.violations.some((v) => v.startsWith('SV4') && v.includes(n)),
      `幽灵名 ${n} 未被点名 ⇒ 反向对照空转`,
    )
})

test('T12 SV4 真仓现读:三份输入解析成功、注册表读得出(≥10 档)、persona 全落注册表', () => {
  const j = gate.sv4Judge({
    mcp: realContents()[gate.SV4_FILES.pyMcp],
    orchestrator: realContents()[gate.SV4_FILES.pyOrchestrator],
    personas: realContents()[gate.SV4_FILES.tsPersonas],
  })
  assert.deepEqual(j.undetermined, [], `真仓输入被判不出 ⇒ 门对已入库形态失明:${j.undetermined}`)
  assert.ok(j.registryCount >= 10, `注册表解析到 ${j.registryCount} 档(<10 ⇒ 解析面与票面取证脱节)`)
  assert.deepEqual(j.bad.advertised, [], '广告面存在注册表解析不到的名字(模型照说明书调用必失败)')
  assert.deepEqual(j.bad.persona, [], 'persona 存在注册表没有的名字')
})

test('T13 棘轮形状锁(§12e 防恒红):--staged 档必须拿 HEAD 面 SV4 当锚点,锚点不可用则不豁免', () => {
  const src = readFileSync(join(ROOT, 'scripts', SRC_NAME), 'utf8')
  assert.match(
    src,
    /readContents\(root, 'head', Object\.values\(SV4_FILES\)\)/,
    'SV4 的 HEAD 锚点取材被摘 ⇒ 修复未入库窗口里每次提交被存量红逼跳门(§12e)',
  )
  assert.match(src, /SV4 棘轮本轮未生效/, '锚点失效方向被改成"静默豁免" ⇒ 多放跳门,禁止')
  assert.ok(
    src.includes('广告名在注册表解析不到|persona 名不属于注册表'),
    'SV4 棘轮的 token 正则被摘/文案漂移而锚没跟着改 ⇒ 存量豁免会静默失灵',
  )
  // 评审修复轮 1①:SV4③ 的 token 也必须在同一条棘轮里,否则"第二广告面漏修"会在
  // 修复未入库的窗口里把每次提交钉红(恒红门),而豁免清单又不得另立一份。
  assert.ok(
    src.includes('^SV4③ 产出面未接同一份广告出口:([a-z0-9_]+)'),
    'SV4③ 没进那条棘轮的 token 正则 ⇒ 存量红逼跳门(§12e);且 [_] 必须在字符类里(函数名带下划线)',
  )
  assert.ok(
    src.includes('...j4.bad.advertised, ...j4.bad.persona, ...j4.bad.expansion'),
    'HEAD 锚点没算 SV4③ 的 token ⇒ 同一份豁免只覆盖了一半',
  )
})

/**
 * SV4 判据的纯函数通道(candidates=空数组会被 SV3 判死并令 tables=null,
 * 所以要看 tables 只能直接问 sv4Judge —— 三态不并桶,也别把"没判"读成"判过")。
 */
const sv4Only = (mcp, personas = gate.FIXTURE_PERSONAS_OK) =>
  gate.sv4Judge({ mcp, orchestrator: gate.FIXTURE_ORCH, personas })

test('T14 SV4③ 有牙(评审 Important:运行期展开那一格):反查面交回 import 期快照必红并点名该函数', () => {
  const snap = sv4Only(gate.FIXTURE_MCP_DEFER_SNAPSHOT)
  assert.deepEqual(
    snap.bad.expansion,
    ['get_full_tool_schema'],
    `反查面把快照原样交给模型却不判红 ⇒ 本门对立项那一型全盲:${JSON.stringify(snap.violations)}`,
  )
  assert.ok(
    snap.violations.some((v) => v.startsWith('SV4③') && v.includes('get_full_tool_schema')),
    '结论行必须点名是哪一条产出面',
  )
  // 端到端(判据真挂在 decide 上,不是只挂在纯函数上 —— 守门 102 GA5/GA6 同型)
  const viaDecide = sv4Fx({ [gate.SV4_FILES.pyMcp]: gate.FIXTURE_MCP_DEFER_SNAPSHOT })
  assert.ok(
    viaDecide.violations.some((v) => v.startsWith('SV4③')),
    'SV4③ 挂上了纯函数却没进 decide ⇒ 提交链上一路绿灯',
  )
  // 成对:两条面都引用同一份出口 ⇒ 一条都不许红(判据过宽会把合规实现钉死)
  const live = sv4Only(gate.FIXTURE_MCP_DYNAMIC)
  assert.deepEqual(
    live.violations.filter((v) => v.startsWith('SV4③')),
    [],
    `合规的两面接线被自己判红:${JSON.stringify(live.violations)}`,
  )
  assert.deepEqual(live.expansion.checked, ['list_tools', 'get_full_tool_schema'])
})

test('T15 遮罩纪律双向成对(评审 Minor②):注释里的 marker 不判红,同一形态写进字符串必判红', () => {
  const commented = sv4Only(gate.FIXTURE_MCP_GHOST_IN_COMMENT)
  assert.deepEqual(
    commented.bad.advertised,
    [],
    '注释里的名单被当广告面 ⇒ 门在判自己的散文(后人只能删说明),禁止',
  )
  assert.equal(commented.advertisedLiteralCount, 0)
  const ghost = sv4Only(gate.FIXTURE_MCP_GHOST)
  assert.ok(
    ghost.bad.advertised.length >= 3,
    '同一提取式对**字符串字面量**里的名单必须命中 —— 否则上面的"绿"只是门瞎了',
  )
  // TS 面同一条纪律:注释里的 persona 键不得被枚举
  const commentedPersona = sv4Only(
    gate.FIXTURE_MCP_DYNAMIC,
    gate.FIXTURE_PERSONAS_COMMENTED,
  )
  assert.deepEqual(commentedPersona.bad.persona, [])
  assert.equal(commentedPersona.personaCount, 1)
})

test('T16 遮罩只许一份实现 + SV4 判定面必须真走遮罩(源码锁)', () => {
  const src = readFileSync(join(ROOT, 'scripts', SRC_NAME), 'utf8')
  assert.match(
    src,
    /from '\.\/lib\/code-mask\.mjs'/,
    '判定面没引唯一遮罩实现 ⇒ 各门自带词法器必漂移(守门 118/131 同型)',
  )
  assert.match(
    src,
    /import \{[^}]*maskedSpans[^}]*\} from '\.\/lib\/code-mask\.mjs'/,
    'Python 注释面的字符串区间必须取自 maskedSpans(同一台分词器),不得自己再走一遍引号',
  )
  assert.match(src, /maskComments\(/, 'persona(TS)面必须走 maskComments')
  // 判定面真的用了遮罩面:不得再拿原文喂广告名/persona 键提取
  assert.doesNotMatch(
    src,
    /advertisedNamesInMcp\((?:mcp|rawMcp)\)/,
    'SV4① 又回到"原文判注释"⇒ 门会判自己的散文',
  )
  assert.doesNotMatch(
    src,
    /personaKeys\((?:personas|rawPers)\)/,
    'SV4② 又回到原文判注释 ⇒ 同上',
  )
  assert.match(src, /advertisedNamesInMcp\(mcpFace\)/)
  assert.match(src, /personaKeys\(personaFace\)/)
  // 反向锁:本门不得自带第二台引号状态机(词法只有一份)
  assert.doesNotMatch(
    src,
    /function readStringSpan|while \(j < .*? !== q\)/,
    '出现第二台字符串分词器 ⇒ 与 lib/code-mask 必然漂移',
  )
})

test('T17 展开对账的接线与锚点成套(摘一面即半盲,复现本票漏修形态)', () => {
  const src = readFileSync(join(ROOT, 'scripts', SRC_NAME), 'utf8')
  assert.match(src, /sv4ExpansionJudge\(mcpFace\)/, 'SV4③ 判据写了但没人调 ⇒ 一路绿灯的尺子')
  const surfaces = gate.SV4_EXPANSION.surfaces.map((s) => s.fn)
  assert.ok(
    surfaces.includes('list_tools') && surfaces.includes('get_full_tool_schema'),
    `产出面清单必须**同时**含清单面与反查面:${JSON.stringify(surfaces)} —— 只列一面就等于没列`,
  )
  // 面清单与出口锚点必须指向被审面真实存在的那两个函数(改名 ⇒ 未判定,不静默放过)
  const j = gate.sv4ExpansionJudge(gate.FIXTURE_MCP_DYNAMIC.replace(/def get_full_tool_schema/g, 'def renamed_reader'))
  assert.ok(
    j.notes.length > 0 || j.undetermined.length > 0 || j.violations.length > 0,
    '把反查面改名后必须喊出来(note/未判定/红三者之一),不得读成"这一维已过"',
  )
})

test('T19 注释 arm 用**真仓内容**跑(不只夹具):同一份 marker 写进注释 ⇒ 不判红,写进字符串 ⇒ 判红', () => {
  // 取材用 HEAD blob(稳定内容,不依赖共享工作树此刻有什么在飞)。
  const head = gitShow(`HEAD:${gate.SV4_FILES.pyMcp}`)
  assert.ok(head && head.length > 1000, `HEAD 面取不到 ${gate.SV4_FILES.pyMcp} ⇒ 本 arm 空转`)
  const ghostA = 'zzz-arm-comment-a'
  const ghostB = 'zzz-arm-comment-b'
  const markerLine = `可用 agent 名称:${ghostA}(甲)、${ghostB}(乙)。`
  const asComment = `${head}\n# 说明性文字,不是广告面:${markerLine}\n`
  const asString = `${head}\n_LEGACY_NOTE = "${markerLine}"\n`
  const jComment = gate.sv4Judge({
    mcp: asComment,
    orchestrator: realContents()[gate.SV4_FILES.pyOrchestrator],
    personas: realContents()[gate.SV4_FILES.tsPersonas],
  })
  const jString = gate.sv4Judge({
    mcp: asString,
    orchestrator: realContents()[gate.SV4_FILES.pyOrchestrator],
    personas: realContents()[gate.SV4_FILES.tsPersonas],
  })
  assert.ok(
    !jComment.bad.advertised.includes(ghostA) && !jComment.bad.advertised.includes(ghostB),
    '注释里的名单被当广告面 ⇒ 门在判自己的散文(评审 Minor② 要修的就是这一格)',
  )
  assert.ok(
    jString.bad.advertised.includes(ghostA) && jString.bad.advertised.includes(ghostB),
    '同一行挪进字符串却不判红 ⇒ 上面的"绿"只是把判据遮瞎了',
  )
})

test('T18 SV4③ 只认调用形态:docstring 写足出口名字而体内不接 ⇒ 必红(提到≠接线)', () => {
  // 这一条不是设计出来的,是**真机变异**逼出来的:把 mcp_server.py 的展开摘掉跑本维,
  // 旧判据(体内 includes 名字)全绿,因为 docstring 里逐字写着那个名字。
  const j = sv4Only(gate.FIXTURE_MCP_DEFER_DOCSTRING_ONLY)
  assert.ok(
    j.bad.expansion.includes('get_full_tool_schema'),
    `退回"名字被提到就算接线"⇒ 摘掉展开后门对真仓形态全盲:${JSON.stringify(j.violations)}`,
  )
  const src = readFileSync(join(ROOT, 'scripts', SRC_NAME), 'utf8')
  assert.doesNotMatch(src, /mentionsExit/, '判据不得回到 body.includes(出口名)那种提及式写法')
  assert.match(src, /exitCall\.test\(body\)/, '调用形态判据被摘 ⇒ SV4③ 对本票立项那一型失明')
  // 成对:合规夹具(体内真有调用)不得被这条判据误伤
  assert.deepEqual(sv4Only(gate.FIXTURE_MCP_DYNAMIC).bad.expansion, [])
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
