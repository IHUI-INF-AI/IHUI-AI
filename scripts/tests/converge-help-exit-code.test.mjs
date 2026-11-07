// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @ihui-seat S-HELPRC 2026-11-01

/**
 * 票 L33582 / RP-79 残余:同族四个旁路器物的 `--help` 退出码口径(**裁决 + 钉子**)。
 *
 * 裁决口径(与 POSIX/GNU 惯例一致,不是"谁先写谁算"):
 *   · `--help` / `-h` = 用户**主动**要帮助 = 成功请求 ⇒ 打印用法 + **rc=0**;
 *   · 未知旗标 / 缺必填参数 / 互斥参数 = **用法错** ⇒ 打印用法 + 点名该旗标 + **rc=2**。
 * 票面原文「未知旗标 ⇒ 用法错 exit 2」说的是**未知旗标**,不是 `--help`;上一轮把它读成
 * "`--help` 也要 rc=2" 是误读,本文件按裁决钉死。
 *
 * 本文件钉三件事(spawn 真实子进程,不看 import 面):
 *   ① 本批器物 `--help` 与 `-h` ⇒ rc=0 **且**真打印了用法(不是空跑一次就算过);
 *   ② 本批器物 `--definitely-not-a-flag` ⇒ rc=2(且点名该旗标 —— object-space-land 这一格见 ②-b 的 todo);
 *   ③ **零副作用**:夹具仓三面(HEAD/索引/工作区)与真仓 HEAD 在 help/未知旗路径跑完后逐字
 *      不变(真仓工作树脏面不作断言,理由见 ③ 用例头注 —— 多席共写工作树,§12e)。
 *
 * 为什么 ③ 才是本文件存在的核心理由:本批器物都会动**索引层/refs**
 * (`git-sync-converge` 2026-10-30 就踩过"未知旗被静默忽略 ⇒ 按默认档真跑收敛 ⇒ 崩前留 16 项
 * index≠HEAD 中间态")。所以 `--help` / 未知旗标必须在**任何有副作用的动作之前**退出 ——
 * 口径对不对是纸面问题,退得早不早是会不会伤仓的问题。
 * 因此本测试**只**走这两条"必须无副作用"的路径,**绝不去跑任何器的默认动作**。
 *
 * 反向例(变异实测,手工做,步骤写在这里以免下次重推):
 *   ① 把 `scripts/object-space-land.mjs` 里 `--help` 分支的 `process.exit(0)` 改成 `process.exit(2)`
 *      ⇒ 本文件「① -h/--help ⇒ rc=0」对 object-space-land 变红;
 *   ② 把 `scripts/git-sync-converge.mjs` 未知旗闸里的 `process.exit(2)` 改成 `process.exit(0)`
 *      ⇒ 本文件「② 未知旗标 ⇒ rc=2」对 git-sync-converge 变红。
 *   改完必须还原(本文件不自动做变异:那要写被审文件,过期即污染)。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')

/** 未知旗标夹具:故意长得不像任何已登记旗,免得哪天某器真加了同名旗把这条钉成假绿。 */
const UNKNOWN_FLAG = '--definitely-not-a-flag'

/**
 * 本批器物清单。`namesUnknownFlag` = 该器的未知旗出口是否**点名实得 token**:
 *   · git-sync-converge / union-converge:点名(判据在 ② 里直接咬);
 *   · object-space-land:env 驱动、不解析位置参数,未知 token 由 parseArgs 的"缺清单"出口 exit 2,
 *     **不点名**。本席按"只改 --help 那一处"的红线没扩权 ⇒ ②-b 登记为 todo(残留,不是绿灯)。
 */
const DEVICES = [
  { name: 'git-sync-converge', script: 'scripts/git-sync-converge.mjs', namesUnknownFlag: true },
  { name: 'union-converge', script: 'scripts/union-converge.mjs', namesUnknownFlag: true },
  { name: 'object-space-land', script: 'scripts/object-space-land.mjs', namesUnknownFlag: false },
  // RP-68(2026-11-06):本器默认档会推 origin,未知旗被静默忽略的代价是"手滑 = 真推一次"。
  // 收进同一份清单 ⇒ ①② 的退出码/点名与 ③ 的零副作用(夹具 HEAD/索引/工作区逐字不变)一并钉住。
  { name: 'git-push-converge', script: 'scripts/git-push-converge.mjs', namesUnknownFlag: true },
]

/**
 * 派生一枚 node 子进程。
 * `stdio` 显式给 `['ignore','pipe','pipe']`(默认不写 = 三通道全管道 = Windows 上 EBUSY 族,
 * 见 `.ihui-agent` 记过的 spawn EBUSY 配方);返回值要消费 ⇒ 不能用裸 `'ignore'`。
 * 环境里剥掉全部 `LAND_*`:万一调用方 shell 里带着 `LAND_PATHS`,object-space-land 的
 * "未知旗标"路径就有可能真去落地 —— 本测试的前提是零副作用,这条剥离是前提的一部分。
 */
function runNode(script, args, cwd = REPO_ROOT) {
  const env = {}
  for (const [k, v] of Object.entries(process.env)) {
    if (!k.startsWith('LAND_')) env[k] = v
  }
  const r = spawnSync(process.execPath, [join(REPO_ROOT, script), ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    timeout: 120_000,
    env,
  })
  const stdout = r.stdout ?? ''
  const stderr = r.stderr ?? ''
  return { rc: r.status, signal: r.signal, error: r.error, stdout, stderr, out: `${stdout}${stderr}` }
}

/** 只读取证:`--no-optional-locks` 免得为了测"零副作用"自己先去抢一次 index.lock(他席在飞)。 */
function gitIn(cwd, args) {
  return spawnSync('git', ['--no-optional-locks', ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    timeout: 120_000,
  })
}

/** 真仓 HEAD 快照(与别席无关的不变量;取不到 ⇒ 直接抛,§0.3 未判定不得冒充"干净")。 */
function snapshotHead() {
  const head = gitIn(REPO_ROOT, ['rev-parse', 'HEAD'])
  assert.equal(head.status, 0, `git rev-parse HEAD 取不到(rc=${head.status}):${head.stderr}`)
  const headSha = String(head.stdout).trim()
  assert.match(headSha, /^[0-9a-f]{40}$/, `HEAD 形态不对:${JSON.stringify(headSha)}`)
  return headSha
}

/** 夹具仓三面快照:HEAD、索引逐条(mode/blob/stage)、工作区+未跟踪面。 */
function fixtureFaces(dir) {
  const gitMust = (args) => {
    const r = gitIn(dir, args)
    assert.equal(r.status, 0, `夹具 git ${args.join(' ')} 失败(rc=${r.status}):${r.stderr}`)
    return String(r.stdout)
  }
  return {
    head: gitMust(['rev-parse', 'HEAD']),
    index: gitMust(['ls-files', '-s']),
    porcelain: gitMust(['status', '--porcelain']),
  }
}

/** 断言子进程真的跑起来了(rc=null 多半是 spawn 失败/超时,不是被测器的口径)。 */
function assertRan(d, r) {
  assert.equal(r.error, undefined, `${d.name}: spawn 失败 ${r.error?.message ?? ''}`)
  assert.equal(r.signal, null, `${d.name}: 被子进程信号打断(${r.signal})`)
  assert.equal(typeof r.rc, 'number', `${d.name}: 没拿到退出码`)
}

for (const d of DEVICES) {
  test(`① ${d.name}: --help / -h 打印用法且 rc=0(用户主动要帮助 = 成功请求)`, () => {
    for (const flag of ['--help', '-h']) {
      const r = runNode(d.script, [flag])
      assertRan(d, r)
      assert.equal(r.rc, 0, `${d.name} ${flag} 应 rc=0(用法打印),实得 rc=${r.rc}\n--- out ---\n${r.out.slice(0, 800)}`)
      // 不只退出码:真的打印了用法。本批器物实际输出都用「用法」起头(不统一的话这一条就该改成逐器字面量)。
      assert.match(r.out, /用法/, `${d.name} ${flag} 退出码对了但没打印用法:\n${r.out.slice(0, 800)}`)
      // 用法面至少给出形态与退出口径,不是敷衍一行。
      assert.ok(
        r.out.trim().split('\n').filter((l) => l.trim()).length >= 3,
        `${d.name} ${flag} 的用法少于 3 行,视为没给用法:\n${r.out.slice(0, 800)}`,
      )
      assert.equal(r.stderr, '', `${d.name} ${flag} 是成功请求,不该往 stderr 写东西:${r.stderr.slice(0, 400)}`)
    }
  })

  test(`② ${d.name}: --definitely-not-a-flag ⇒ rc=2(用法错,不得静默落进默认档)`, () => {
    const r = runNode(d.script, [UNKNOWN_FLAG])
    assertRan(d, r)
    assert.equal(r.rc, 2, `${d.name} 未知旗标应 rc=2,实得 rc=${r.rc}\n--- out ---\n${r.out.slice(0, 800)}`)
    if (d.namesUnknownFlag) {
      assert.ok(
        r.out.includes(UNKNOWN_FLAG),
        `${d.name} 未知旗标出口必须点名实得 token ${UNKNOWN_FLAG},实得:\n${r.out.slice(0, 800)}`,
      )
    }
  })
}

test('②-b object-space-land: 未知旗标出口应点名该旗标(本席登记为残留,未判定)', { todo: 'S-HELPRC 按「只改 --help 那一处」的红线未扩权:env 驱动的 parseArgs 缺清单出口 exit 2 但不点名 token。要修需另票(联网到它的 env 契约,不能顺手在 help 分支里夹带)。' }, () => {
  const d = DEVICES.find((x) => x.name === 'object-space-land')
  const r = runNode(d.script, [UNKNOWN_FLAG])
  assertRan(d, r)
  assert.equal(r.rc, 2)
  assert.ok(r.out.includes(UNKNOWN_FLAG), `未点名 ${UNKNOWN_FLAG},实得:\n${r.out.slice(0, 800)}`)
})

test('④ git-push-converge: 已登记旗标清单 ⊆ 实际消费点(§0.6 单一真相源,漏一枚即误杀推送腿)', () => {
  const src = readFileSync(join(REPO_ROOT, 'scripts', 'git-push-converge.mjs'), 'utf8')
  const arrayOf = (name) => {
    const m = src.match(new RegExp(`const ${name} = Object\\.freeze\\(\\[([^\\]]*)\\]\\)`))
    assert.ok(m, `源码里找不到 ${name} ⇒ 白名单没装车`)
    return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
  }
  const declared = [...arrayOf('KNOWN_BOOLEAN_FLAGS'), ...arrayOf('KNOWN_VALUE_FLAGS')].sort()
  // 消费点三族(与 lib/union-converge-flags.mjs 的 scanFlagConsumption 同取向,只认本器实际写法):
  const consumed = new Set(['--help', '-h']) // CLI_ARGS.includes 那一族
  for (const m of src.matchAll(/getArg\(\s*'([a-z][a-z0-9-]*)'/g)) consumed.add(`--${m[1]}`)
  for (const m of src.matchAll(/hasFlag\(\s*'([a-z][a-z0-9-]*)'/g)) consumed.add(`--${m[1]}`)
  for (const m of src.matchAll(/startsWith\(\s*'(--[a-z][a-z0-9-]*)='/g)) consumed.add(m[1])
  assert.ok(consumed.size >= 7, `消费点只扫到 ${consumed.size} 枚 ⇒ 扫描器失明,不得拿空集冒充齐备(§0.3)`)
  assert.deepEqual(
    declared,
    [...consumed].sort(),
    '白名单与消费点不齐 ⇒ 多一项=死清单,少一项=合法旗被判未知(会把推送腿冻住,§0.10)',
  )
})

test('③ 零副作用:help/未知旗路径跑完,夹具仓三面(HEAD/索引/工作区)逐字不变;真仓 HEAD 只许"证明与本器无关"的前移', () => {
  // 这两条路径**必须**在任何动索引/refs 的动作之前退出。它们若有副作用,口径怎么写都是空话。
  //
  // 真仓的**索引/工作区脏面不作断言**(2026-11-05 由一次实测失败逼出改写):这是多席共写的共享
  // 工作树,别席每几分钟就 add/commit 一次 —— 本用例原形态在 ~90 秒窗口里把别席对
  // PROJECT_PLAN.md/README.* 的写入读成"器副作用",恒红(§12e:与本次提交内容无关的红,
  // 唯一结局是逼人 --no-verify 连带废掉全部守门)。同族先例 scripts/tests/union-converge-arg-guard.test.mjs
  // 用例⑨/⑩ 早按同一口径收口过。
  // 真仓 HEAD 这一维同日二次实测:12 次 spawn 的 ~30 秒窗口里 guardian 兜底落地腿推进了 HEAD ——
  // 拿别席的提交当"器动了 refs"同样是恒红。所以本维改成**可归因**的形态:
  //   · 硬判:夹具仓三面逐字不变(夹具是全新隔离仓,任何多余写出/索引变化只能来自被测器;
  //     cwd 设为夹具同时兜住"按 cwd 相对写文件"那一历史形态:`writeFileSync('--staged')`);
  //   · 硬判:每一次 help/-h/未知旗 spawn 都必须拿到**预期退出码**(0/0/2)且输出里没有收敛动作
  //     特征行(`第 x/y 轮`)—— 旁路器唯一会动真仓 refs 的通道就是开跑收敛,它做不到"一声不出
  //     还把 refs 推进了还恰好退出码全对";
  //   · 硬判:真仓 HEAD 若变了,旧值必须是新值的**祖先**(纯前移 = 别席快进/落地),倒退或横跳
  //     (rebase/reset 形态的 ref 改写)即红 —— 器没有能力"只前移且不产任何输出"地推进 main。
  const EXPECTED_RC = { '--help': 0, '-h': 0, [UNKNOWN_FLAG]: 2 }
  const realHeadBefore = snapshotHead()
  const dir = mkScratch('help-rc-zero-side-effect')
  try {
    const g = (args) => {
      const r = gitIn(dir, args)
      assert.equal(r.status, 0, `夹具 git ${args.join(' ')} 失败(rc=${r.status}):${r.stderr}`)
    }
    g(['init', '-q', '-b', 'main'])
    g(['config', 'user.email', 'help-rc@example.invalid'])
    g(['config', 'user.name', 'help-rc-guard'])
    writeFileSync(join(dir, 'a.txt'), 'seed\n', 'utf8')
    g(['add', '-A'])
    g(['commit', '-q', '-m', 'seed'])
    const before = fixtureFaces(dir)

    for (const d of DEVICES) {
      for (const flag of ['--help', '-h', UNKNOWN_FLAG]) {
        const r = runNode(d.script, [flag], dir)
        assertRan(d, r)
        assert.equal(
          r.rc,
          EXPECTED_RC[flag],
          `${d.name} ${flag}: 归因前提(退出码必须与 ①② 同口径),实得 ${r.rc}`,
        )
        assert.doesNotMatch(
          r.out,
          /第 \d\/\d 轮/,
          `${d.name} ${flag} 打出了收敛轮次特征行 ⇒ 闸没拦住,副作用归因成立`,
        )
      }
    }
    const after = fixtureFaces(dir)
    assert.equal(after.head, before.head, '夹具仓 HEAD 被 --help 或未知旗标路径推进了')
    assert.equal(
      after.index,
      before.index,
      `夹具仓索引被改了(器在有副作用的动作之后才退出):\n--- before ---\n${before.index}\n--- after ---\n${after.index}`,
    )
    assert.equal(
      after.porcelain,
      before.porcelain,
      `夹具仓工作区/未跟踪面被改了(哪怕一枚按 cwd 写出的文件都逃不掉):\n--- before ---\n${before.porcelain}\n--- after ---\n${after.porcelain}`,
    )
    const realHeadAfter = snapshotHead()
    if (realHeadAfter !== realHeadBefore) {
      const anc = gitIn(REPO_ROOT, ['merge-base', '--is-ancestor', realHeadBefore, realHeadAfter])
      assert.equal(
        anc.status,
        0,
        `真仓 HEAD 被 --help 或未知旗标路径改成了非祖先形态(${realHeadBefore.slice(0, 11)} → ` +
          `${realHeadAfter.slice(0, 11)} 不是快进前移)—— 旁路器物动了 refs,正是本票钉死的失效型`,
      )
      const cnt = gitIn(REPO_ROOT, ['rev-list', '--count', `${realHeadBefore}..${realHeadAfter}`])
      console.log(
        `ℹ 真仓 HEAD 在窗口内被别席前移 ${String(cnt.stdout).trim()} 枚(旧→新为祖先关系,` +
          '且 12 次 spawn 退出码全对、零动作特征行、夹具三面逐字不变 ⇒ 不归因于本批器物)',
      )
    }
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
