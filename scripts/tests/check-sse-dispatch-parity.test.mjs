// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门 90(check-sse-dispatch-parity.mjs)的 §22c 镜像测试(PROJECT_PLAN D107 ① 装车票)。
// 覆盖四件事,缺一即本票不成立:
//   ① 判据本身有效(注入违规必红)—— 且**不靠改真台账文件**做注入,用真数据 + 抽走一个命中;
//   ② 真仓当前结论为绿(台账与 HEAD 实测逐字对得上);
//   ③ **装车证明**:guardian-runner 里确实注册了这道门、且编号在本仓唯一(§22c「造好没装车」教训);
//   ④ 取材基准是 HEAD 而不是工作树 —— 这是本票补的那处结构缺陷,回归会把它悄悄改回去。

import { execFileSync } from 'node:child_process'
import { copyFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  collectHitMap,
  collectSurfaceMap,
  evaluateDispatchParity,
  extractCallbackNames,
  pickBasis,
  readFrameSource,
  resolveFrameCallbacks,
} from '../check-sse-dispatch-parity.mjs'
import { resolveGitBin } from '../lib/gitdir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const RUNNER = join(REPO, 'scripts', 'guardian-runner.mjs')
const LEDGER = join(REPO, 'scripts', 'data', 'sse-dispatch-coverage.json')
const GIT_BIN = resolveGitBin() || 'git'

/** 用临时索引跑 git —— 绝不动共享工作区的主索引(多会话同用一个 .git) */
function gitRun(args, env) {
  return execFileSync(GIT_BIN, ['-c', 'safe.directory=*', '-C', REPO, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
    timeout: 120000,
    env,
  })
}

/** 主索引的真实路径(.git 可能是指针文件,故问 git 自己而不是拼字符串) */
function resolveGitIndex() {
  const gitdir = gitRun(['rev-parse', '--absolute-git-dir']).trim()
  return join(gitdir, 'index')
}

const realData = () => JSON.parse(readFileSync(LEDGER, 'utf8'))

test('① 出口齐备(§22c 锚点)', () => {
  for (const fn of [
    extractCallbackNames,
    resolveFrameCallbacks,
    evaluateDispatchParity,
    collectHitMap,
    collectSurfaceMap,
    readFrameSource,
  ]) {
    assert.equal(typeof fn, 'function', '存在未导出的核心函数')
  }
})

test('② 真仓:HEAD 实测与台账精确一致(判据在真数据上为绿)', () => {
  const data = realData()
  const { source, error } = readFrameSource()
  assert.equal(error, null, `帧清单取材失败:${error}`)
  const known = extractCallbackNames(source)
  const callbacks = resolveFrameCallbacks(source, data.toolCallbacks)
  assert.ok(callbacks.length >= 20, `帧清单只有 ${callbacks.length} 个,提取疑似失效`)
  const hit = collectHitMap(data, callbacks)
  const result = evaluateDispatchParity({ hit, callbacks, known, data })
  assert.deepEqual(result.errors, [], '真仓判定不应有红项')
  assert.deepEqual(result.warnings, [], '真仓不应留 baseline 待上调的警告(增长后必须同票上调)')
  assert.equal(result.ok, true)
})

/**
 * 归因图与命中图**同源**证明:两张图共用同一次 grep,所以"某端已覆盖 N 帧"
 * 必须严格等于"该端各命中文件的并集"。若哪天有人把归因改成另跑一遍(或加了过滤),
 * 这条会红 —— 那正是"矩阵说已接、归因说没人接"这类分歧的探测器。
 */
test('②b 归因图并集 === 命中图(两图不得各自为政)', () => {
  const data = realData()
  const { source, error } = readFrameSource()
  assert.equal(error, null)
  const callbacks = resolveFrameCallbacks(source, data.toolCallbacks)
  const hit = collectHitMap(data, callbacks)
  const surfaces = collectSurfaceMap(data, callbacks)
  assert.deepEqual(
    Object.keys(surfaces).sort(),
    Object.keys(hit).sort(),
    '归因图的端集合与命中图不一致',
  )
  for (const ep of Object.keys(hit)) {
    const union = new Set()
    for (const set of surfaces[ep].values()) for (const cb of set) union.add(cb)
    assert.deepEqual(
      [...union].sort(),
      [...hit[ep]].sort(),
      `端 ${ep} 的并集与命中集合不同(归因漏计或多计)`,
    )
    for (const [file, set] of surfaces[ep]) {
      assert.ok(
        (data.endpoints[ep] ?? []).some((d) => file.startsWith(`${d}/`)),
        `文件 ${file} 不落在端 ${ep} 的任一声明目录内`,
      )
      assert.ok(set.size > 0, `文件 ${file} 出现在归因表里却零帧,属空条目`)
    }
  }
})

test('③ 注入违规:抽走一个端的一个命中必须判红(红因是"静默丢弃")', () => {
  const data = realData()
  const { source } = readFrameSource()
  const known = extractCallbackNames(source)
  const callbacks = resolveFrameCallbacks(source, data.toolCallbacks)
  const hit = collectHitMap(data, callbacks)
  // 从 cli 端拿走它确实命中的第一帧 ⇒ 该帧变成"实测未命中且未登记",即本门要抓的原始形态
  const cliHit = [...hit['cli']]
  assert.ok(cliHit.length > 0, 'cli 端零命中,注入样本无从取')
  const removed = cliHit.sort()[0]
  hit['cli'] = new Set(cliHit.filter((c) => c !== removed))
  const result = evaluateDispatchParity({ hit, callbacks, known, data })
  assert.equal(result.ok, false, `抽走 ${removed} 后仍判绿 ⇒ 判据空转`)
  assert.ok(
    result.errors.some((e) => e.includes('静默丢弃') && e.includes(removed)),
    `红项未点名被抽走的帧 ${removed}`,
  )
})

test('④ 注入违规:baseline 抬高 1 必须判红(ratchet 真的咬住)', () => {
  const data = realData()
  const { source } = readFrameSource()
  const known = extractCallbackNames(source)
  const callbacks = resolveFrameCallbacks(source, data.toolCallbacks)
  const hit = collectHitMap(data, callbacks)
  const bumped = { ...data, baseline: { ...data.baseline, web: data.baseline.web + 1 } }
  const result = evaluateDispatchParity({ hit, callbacks, known, data: bumped })
  assert.equal(result.ok, false, 'baseline 抬高一格仍判绿 ⇒ ratchet 未生效')
  assert.ok(result.errors.some((e) => e.includes('低于 baseline')))
})

test('⑤ 取材基准是提交树,不是工作树(pre-commit 须切暂存区,否则同票推进被自己卡死)', () => {
  const src = readFileSync(join(REPO, 'scripts', 'check-sse-dispatch-parity.mjs'), 'utf8')
  // 命中侧与清单侧同一修订;清单那份 blob 正文自 2026-09-26 起**必须**经共用取材层的读取入口
  // (`catBatch`)取 —— 原先是自己 `git(['show', spec])`,那正是守门 118 的 `loose-git` 档。
  assert.match(src, /batch\(ROOT,\s*\[spec\]/u, '帧清单未经 face-reader 的读取入口取正文')
  // 2026-09-26 锁形放宽:import 花括号里除 catBatch 外还进了 readWorktreeFile/selectFace
  // (--worktree 人工档与四态面选择的唯一出口)。判据不变 —— **catBatch 必须从层里来**,
  // 只从"恰好一个名字"放宽成"名单含 catBatch",半接线照样红。
  assert.match(
    src,
    /import\s*\{[^}]*\bcatBatch\b[^}]*\}\s*from\s*['"]\.\/lib\/face-reader\.mjs['"]/u,
    '未从 scripts/lib/face-reader.mjs import catBatch(半接线:引了层却自己读)',
  )
  assert.ok(
    !/git\(\['show',\s*spec\]\)/u.test(src),
    '帧清单又改回自己派生 `git show` 读正文 —— 应经共用取材层(守门 118 的 loose-git 档)',
  )
  assert.match(src, /basis === 'index' \? '' : 'HEAD'/u, "帧清单未支持 'index' 修订")
  assert.match(
    src,
    /'grep',\s*'--cached',\s*'-o',\s*'-E',\s*alt/u,
    '暂存区口径的 --cached 未放在模式串之前',
  )
  // 2026-09-26 锁形更新:旧的 `argv.includes('--staged') ? 'index' : 'head'` 单项式表达式被
  // pickBasis 四态取代 —— 单项式正是"未知开关静默落 head"的载体(--worktree 被吞不响)。
  // 意图不变(--staged 必须切暂存区),只把"必须从表达式"换成"必须从唯一出口"。
  assert.match(
    src,
    /const \{ basis, error: basisError \} = pickBasis\(argv\)/u,
    "main 未经 pickBasis 选面 —— 不得退回 '? index : head' 单项式(它会静默吞 --worktree)",
  )
  assert.match(
    src,
    /staged: argv\.includes\('--staged'\)/u,
    'pickBasis 未把 --staged 映射到索引面 ⇒ pre-commit 模式不切暂存区',
  )
  assert.ok(
    !/readFileSync\(\s*API_CLIENT_FILE/u.test(src),
    '帧清单又改回读工作树的 client.ts —— 命中侧读提交树、清单侧读工作树会让未提交的新帧把五端一起判红',
  )
})

test('⑤b 暂存区口径实跑:budget 一族的端内接线 + 台账一起进临时索引必须判绿(代码与台账同票)', () => {
  // 清单 = 本族"端内注册层"改动的全集。**少列一个端不会让本例假绿** —— 该端按 HEAD 的
  // 旧命中数进入临时索引,低于台账 baseline 即判红,失效方式是响的。
  // 再有端接入 budget 时把它加进来(以及 --staged 的 baseline 同票上调)。
  //
  // 取材基准一律 **HEAD blob**,不是工作树(2026-09-25 实测改的):原写法 `git add -- <码文件>`
  // 把并行会话的在途编辑一起收进临时索引 —— 当天 `apps/cli/src/commands/agent.ts` 正被别人的
  // 终端流票改着(工作树已注册 terminalDelta,而 HEAD 没有),于是本例替他人红了一次,
  // 而"missing 声明了其实已注册的帧"这条红与本票要证的同票不变量毫无关系。台账本身仍取
  // 工作树,因为那正是"待提交的那一半"。
  const LEDGER_PATH = 'scripts/data/sse-dispatch-coverage.json'
  const TICKET_FILES = [
    LEDGER_PATH,
    'packages/shared/src/chat/budget-note.ts',
    'packages/shared/src/chat/index.ts',
    'apps/cli/src/commands/task-status-line.ts',
    'apps/cli/src/commands/agent.ts',
    'apps/cli/src/commands/repl.ts',
    'apps/mobile-rn/src/utils/budget-note.ts',
    'apps/mobile-rn/src/screens/AiAssistantN8nScreen.tsx',
  ]
  const tmpIndex = join(tmpdir(), `ihui-sse-idx-${process.pid}-${Date.now()}`)
  copyFileSync(resolveGitIndex(), tmpIndex)
  const env = { ...process.env, GIT_INDEX_FILE: tmpIndex }
  try {
    for (const p of TICKET_FILES) {
      if (p === LEDGER_PATH) {
        gitRun(['add', '--', p], env)
        continue
      }
      const blob = gitRun(['rev-parse', `HEAD:${p}`], env).trim()
      assert.ok(/^[0-9a-f]{40}$/.test(blob), `HEAD:${p} 解析不出 blob,本例夹具失效`)
      gitRun(['update-index', '--add', '--cacheinfo', `100644,${blob},${p}`], env)
    }
    const out = execFileSync(
      process.execPath,
      [join(REPO, 'scripts', 'check-sse-dispatch-parity.mjs'), '--staged'],
      { encoding: 'utf8', windowsHide: true, timeout: 120000, env },
    )
    assert.match(out, /守门通过/u, `暂存区口径未判绿:${out}`)
  } finally {
    rmSync(tmpIndex, { force: true })
  }
})

test('⑥ 台账卫生:groups 里不得留无人引用的分组(登记项不得变墓志铭)', () => {
  const data = realData()
  const referenced = new Set(Object.values(data.missing ?? {}).flatMap((m) => Object.values(m)))
  const orphan = Object.keys(data.groups ?? {}).filter((g) => !referenced.has(g))
  assert.deepEqual(
    orphan,
    [],
    `分组 ${orphan.join(', ')} 已无端引用,应删除(留着就是在替已实现的功能喊 WONTFIX)`,
  )
})

/**
 * ⑩ 台账的**判定面**:索引 ≠ 磁盘时必须按索引出结论。
 *
 * 立因:本门 2026-09-26 之前把台账从磁盘读(readFileSync),而命中侧与帧清单走 git 修订。
 * 于是并发会话对 `scripts/data/sse-dispatch-coverage.json` 的未暂存改动**不必碰任何被审代码**
 * 就能改写在飞提交的结论 —— 别人误删一行 missing 就能把一条真敞目洗成"已登记",
 * 别人补一行又能把我的正常推进判成"登记项掩盖真相"。守门 93 R6 把这条写成过判据
 * ("登记表与用量必须同面"),本例是它在门 90 上的对应锁。
 *
 * 两臂都是**条件式**的,不赌仓库此刻的内容:
 *  A 臂 索引放"人为回退的台账"(把 onTerminalDelta 塞回 miniapp-taro 的 missing 并把 baseline
 *      降一格),磁盘保持修好的那份 ⇒ --staged 必须红并点名 onTerminalDelta。
 *      **旧实现(readFileSync 磁盘)在这一臂会判绿**,所以这条不是恒真式。
 *  B 臂 索引放与 HEAD 代码一致的台账 ⇒ --staged 必须绿(证明 A 臂的红来自面,不是"永远红")。
 */
test('⑩ 台账判定面:索引与磁盘不一致时按索引出结论(旧磁盘读法会在 A 臂假绿)', () => {
  const LEDGER_PATH = 'scripts/data/sse-dispatch-coverage.json'
  const good = realData()
  // 自足地构造"回退版"台账:不依赖 HEAD 此刻装的是哪一份,免得本例随仓库推进失去意义。
  const regressed = {
    ...good,
    baseline: { ...good.baseline, 'miniapp-taro': good.baseline['miniapp-taro'] - 1 },
    missing: {
      ...good.missing,
      'miniapp-taro': { ...good.missing['miniapp-taro'], onTerminalDelta: 'no-terminal-delta-ui' },
    },
  }
  if (good.baseline['miniapp-taro'] <= 0) throw new Error('夹具前提不成立:baseline 已为 0,无法回退')
  if (
    !good.missing['miniapp-taro'] ||
    Object.hasOwn(good.missing['miniapp-taro'], 'onTerminalDelta')
  ) {
    throw new Error(
      '夹具前提不成立:磁盘台账里 miniapp-taro 仍挂着 onTerminalDelta,本例需要修好的那份',
    )
  }

  const tmpIndex = join(tmpdir(), `ihui-sse-face-${process.pid}-${Date.now()}`)
  copyFileSync(resolveGitIndex(), tmpIndex)
  const env = { ...process.env, GIT_INDEX_FILE: tmpIndex }
  const putLedgerInIndex = (obj) =>
    execFileSync(
      GIT_BIN,
      [
        '-c',
        'safe.directory=*',
        '-c',
        'core.quotepath=false',
        '-C',
        REPO,
        'hash-object',
        '-w',
        '--stdin',
      ],
      {
        encoding: 'utf8',
        input: JSON.stringify(obj, null, 2) + '\n',
        windowsHide: true,
        timeout: 120000,
        env,
      },
    ).trim()

  const runStaged = () => {
    try {
      const out = execFileSync(
        process.execPath,
        [join(REPO, 'scripts', 'check-sse-dispatch-parity.mjs'), '--staged'],
        { encoding: 'utf8', windowsHide: true, timeout: 180000, env, maxBuffer: 32 * 1024 * 1024 },
      )
      return { code: 0, out }
    } catch (e) {
      return { code: e.status, out: String(e.stdout ?? '') + String(e.stderr ?? '') }
    }
  }

  const diskBefore = readFileSync(join(REPO, LEDGER_PATH), 'utf8')
  try {
    // A 臂
    const shaA = putLedgerInIndex(regressed)
    gitRun(['update-index', '--add', '--cacheinfo', `100644,${shaA},${LEDGER_PATH}`], env)
    const a = runStaged()
    assert.equal(
      a.code,
      1,
      `A 臂(索引=回退台账、磁盘=修好的)必须判红,实得 exit=${a.code}:\n${a.out}`,
    )
    assert.match(
      a.out,
      /其实已注册的帧:.*onTerminalDelta/u,
      `A 臂必须点名 onTerminalDelta(证明读的是索引那份):\n${a.out}`,
    )

    // B 臂
    const shaB = putLedgerInIndex(good)
    gitRun(['update-index', '--add', '--cacheinfo', `100644,${shaB},${LEDGER_PATH}`], env)
    const b = runStaged()
    assert.equal(b.code, 0, `B 臂(索引=与代码一致)必须判绿,否则 A 臂的红只是"永远红":\n${b.out}`)

    // 反向对照:磁盘那份从头到尾没被动过 —— 两臂结论不同只能来自索引。
    assert.equal(readFileSync(join(REPO, LEDGER_PATH), 'utf8'), diskBefore, '本例不得改磁盘台账')
  } finally {
    rmSync(tmpIndex, { force: true })
  }
})

/**
 * ⑪ 形状锁:台账不得再回磁盘读。
 * 与 ⑤ 同族(那条锁的是帧清单),但判据反过来:守门 118 的 `half-wired` 档专门抓
 * "引了取材层、内容却仍由自己 `git show` / 磁盘 readFileSync 取" —— 本门 2026-09-26
 * 收口台账前正是这一档的实例,而它当时被 118 判成 `face`(因为帧清单那条走对了)。
 * ⇒ **一道按文件整体分类的门,看不见同一个文件里另一处错面**。这条锁替它看见。
 */
test('⑪ 形状锁:台账必须经 face-reader 读取入口取,不得再 readFileSync 磁盘', () => {
  const src = readFileSync(join(REPO, 'scripts', 'check-sse-dispatch-parity.mjs'), 'utf8')
  // 形状锁的对象是**代码形态**,所以先剥掉整行注释:本文件多处注释在描述"曾经的错法"
  // (例如 `? '' : 'HEAD:'` 这个被修掉的写法),不剥就会让门替一条已被推翻的写法背书 ——
  // 而描述性注释恰恰是最容易被写成原样的地方(守门 57⑤「注释式摘线」同族:匹配面必须是
  // 剥注释后的代码面)。只剥**整行**注释,不动行内字符串,免得把判据自己剥没。
  const code = src
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\/?\*)/.test(l))
    .join('\n')
  assert.match(code, /export function readLedger/u, 'readLedger 不在位(台账取材被摘线)')
  assert.match(code, /readLedger\(basis\)/u, 'main 未用当次判定面调用 readLedger')
  assert.match(code, /catBatch\(ROOT,\s*\[spec\]/u, 'readLedger 未经 face-reader 的读取入口取正文')
  assert.match(
    code,
    /const spec = `\$\{basis === 'index' \? '' : 'HEAD'\}:\$\{DATA_PATH\}`/u,
    '台账规格组装漂移(index 面必须产出 `:path`)',
  )
  // 反向锁:冒号必须在三元**外面**。写成 `? '' : 'HEAD:'` 时 index 面产出的是裸路径,
  // `cat-file --batch` 按对象名解析它并回 missing —— 于是暂存区口径永远"读不到台账",
  // 门报 exit 2 看起来像仓库坏了。本枚改动第一版就是这个写法,由 --self-test 的
  // "实际发出的规格逐字为 :path / HEAD:path" 那条抓出(只看 error/结果断言的夹具会一路放行)。
  assert.ok(
    !/\? '' : 'HEAD:'\}/u.test(code),
    '台账规格把冒号并进了三元,index 面会退化成裸路径 ⇒ git 报 missing ⇒ 暂存区永远读不到',
  )
  assert.ok(
    !/readFileSync\(\s*DATA_FILE/u.test(code),
    '台账又改回读磁盘 —— 并发会话不必碰被审代码就能改写在飞提交的结论(守门 93 R6 同型)',
  )
  assert.ok(
    !/function readData\(/u.test(code),
    'readData(磁盘版)又回来了;台账取材唯一出口是 readLedger',
  )
})

/**
 * 从 runner 反查本门注册块 —— **不硬写编号**。
 * 硬写 id 的断言在并发重排号时会二选一失效:要么把在位的门判成"没装车",
 * 要么更糟 —— 悄悄通过(编号被人挪走而块还在)。今天本仓就为此撞了三次号(85→90→91→92)。
 */
function findOwnBlock(runnerSrc) {
  const blocks = [...runnerSrc.matchAll(/^ {2}\{[\s\S]*?^ {2}\},/gmu)]
  const own = blocks.find((m) => /script:\s*'check-sse-dispatch-parity\.mjs'/u.test(m[0]))
  return own ? own[0] : null
}

test('⑦ 装车证明:runner 里有本门注册块且为 blocking(编号从文件反查)', () => {
  const runner = readFileSync(RUNNER, 'utf8')
  const block = findOwnBlock(runner)
  assert.ok(
    block,
    '未找到 check-sse-dispatch-parity.mjs 的注册块 —— 脚本存在但没接上守门链等于没有闸',
  )
  assert.match(block, /mode:\s*'blocking'/u)
  assert.match(block, /skipEnv:\s*'HUSKY_SKIP_SSE_DISPATCH_PARITY'/u)
  assert.match(
    block,
    /stagedTriggers:/u,
    '缺 stagedTriggers ⇒ 每次提交全量跑,拖慢提交链会逼人 --no-verify',
  )
})

test('⑧ 编号唯一:本门所用的 id 在 runner 中必须恰好出现一次(并发抢号教训)', () => {
  const runner = readFileSync(RUNNER, 'utf8')
  const block = findOwnBlock(runner)
  assert.ok(block, '找不到本门注册块')
  const ownId = (block.match(/id:\s*'([^']+)'/u) || [])[1]
  assert.ok(ownId, '本门注册块里没有 id 字段')
  const ids = [...runner.matchAll(/^\s{4}id:\s*'([^']+)'/gmu)].map((m) => m[1])
  assert.ok(ids.length > 80, `只解析到 ${ids.length} 个 id,缩进锚点疑似失效`)
  const hits = ids.filter((x) => x === ownId).length
  assert.equal(
    hits,
    1,
    `id ${ownId} 出现 ${hits} 次 —— 同 id 两道门会串 skipEnv 与失败归属,后来者必须改号`,
  )
})

test('⑨ --self-test 入口可用且全绿', () => {
  const out = execFileSync(
    process.execPath,
    [join(REPO, 'scripts', 'check-sse-dispatch-parity.mjs'), '--self-test'],
    {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 120000,
    },
  )
  assert.match(out, /\[self-test\] (\d+)\/\1 通过/u, '自测未全绿')
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * ⑫ 面旗的 CLI 级四态(2026-09-26 --worktree 补档的装车证明)。
 * 立因:`basis = argv.includes('--staged') ? 'index' : 'head'` 把 `--worktree` **静默吞掉**
 * —— 未知开关不改面也不判死,和"面旗被接受"完全是两回事(守门 118 点名的正是这种安静)。
 * 现要求:默认自称 HEAD 面;--staged 自称索引面;--worktree 真换成工作树档;
 * 两面旗同给必须 exit 2。判据本身一条没动,只锁"面旗与结论行的对应关系"。
 */
test('⑫ 面旗 CLI 四态:--worktree 真换面、两面旗同给判死、末行必须自称所读的面', () => {
  const run = (args) => {
    try {
      const out = execFileSync(
        process.execPath,
        [join(REPO, 'scripts', 'check-sse-dispatch-parity.mjs'), ...args],
        {
          encoding: 'utf8',
          windowsHide: true,
          timeout: 180000,
          maxBuffer: 32 * 1024 * 1024,
        },
      )
      return { code: 0, out }
    } catch (e) {
      return { code: e.status, out: String(e.stdout ?? '') + String(e.stderr ?? '') }
    }
  }
  // 默认:HEAD 面(结论行必须自称 HEAD,而不是不提面)
  const d = run([])
  assert.notEqual(d.code, 2, `默认面不得 exit 2(那是取材失败):\n${d.out}`)
  assert.match(d.out, /判定面:HEAD blob/u, '默认面末行必须自称 HEAD blob')
  // --staged:索引面
  const s = run(['--staged'])
  assert.notEqual(s.code, 2, `--staged 不得 exit 2:\n${s.out}`)
  assert.match(s.out, /判定面:索引 blob/u, '--staged 末行必须自称索引 blob')
  // --worktree:磁盘人工档(2026-09-26 新增;exit 允许 0/1,判据照跑,唯独不许静默按 head)
  const w = run(['--worktree'])
  assert.notEqual(w.code, 2, `--worktree 不得 exit 2:\n${w.out}`)
  assert.match(w.out, /判定面:工作树/u, '--worktree 竟未换面(静默吞旗回归)')
  // 两面旗同给:判死
  const c = run(['--staged', '--worktree'])
  assert.equal(c.code, 2, `两面旗同给必须 exit 2,实得 ${c.code}:\n${c.out}`)
  assert.match(c.out, /互斥/u, '判死必须带原因')
  // 纯函数侧与 CLI 侧必须同形(两处各写一遍必然漂移 —— 本仓最高频失效型)
  assert.equal(pickBasis([]).basis, 'head')
  assert.equal(pickBasis(['--staged']).basis, 'index')
  assert.equal(pickBasis(['--worktree']).basis, 'worktree')
  assert.equal(pickBasis(['--staged', '--worktree']).basis, null)
})
