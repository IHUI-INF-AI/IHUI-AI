// @ihui-seat S-HELPRC 2026-11-01

/**
 * 票 L33582 / RP-79 残余:同族三个旁路器物的 `--help` 退出码口径(**裁决 + 钉子**)。
 *
 * 裁决口径(与 POSIX/GNU 惯例一致,不是"谁先写谁算"):
 *   · `--help` / `-h` = 用户**主动**要帮助 = 成功请求 ⇒ 打印用法 + **rc=0**;
 *   · 未知旗标 / 缺必填参数 / 互斥参数 = **用法错** ⇒ 打印用法 + 点名该旗标 + **rc=2**。
 * 票面原文「未知旗标 ⇒ 用法错 exit 2」说的是**未知旗标**,不是 `--help`;上一轮把它读成
 * "`--help` 也要 rc=2" 是误读,本文件按裁决钉死。
 *
 * 本文件钉三件事(spawn 真实子进程,不看 import 面):
 *   ① 三器 `--help` 与 `-h` ⇒ rc=0 **且**真打印了用法(不是空跑一次就算过);
 *   ② 三器 `--definitely-not-a-flag` ⇒ rc=2(且点名该旗标 —— object-space-land 这一格见 ②-b 的 todo);
 *   ③ **零副作用**:跑 ①② 前后 `git status --porcelain` 与 `git rev-parse HEAD` 必须逐字相同。
 *
 * 为什么 ③ 才是本文件存在的核心理由:这三个器都会动**索引层/refs**
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
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')

/** 未知旗标夹具:故意长得不像任何已登记旗,免得哪天某器真加了同名旗把这条钉成假绿。 */
const UNKNOWN_FLAG = '--definitely-not-a-flag'

/**
 * 三器清单。`namesUnknownFlag` = 该器的未知旗出口是否**点名实得 token**:
 *   · git-sync-converge / union-converge:点名(判据在 ② 里直接咬);
 *   · object-space-land:env 驱动、不解析位置参数,未知 token 由 parseArgs 的"缺清单"出口 exit 2,
 *     **不点名**。本席按"只改 --help 那一处"的红线没扩权 ⇒ ②-b 登记为 todo(残留,不是绿灯)。
 */
const DEVICES = [
  { name: 'git-sync-converge', script: 'scripts/git-sync-converge.mjs', namesUnknownFlag: true },
  { name: 'union-converge', script: 'scripts/union-converge.mjs', namesUnknownFlag: true },
  { name: 'object-space-land', script: 'scripts/object-space-land.mjs', namesUnknownFlag: false },
]

/**
 * 派生一枚 node 子进程。
 * `stdio` 显式给 `['ignore','pipe','pipe']`(默认不写 = 三通道全管道 = Windows 上 EBUSY 族,
 * 见 `.ihui-agent` 记过的 spawn EBUSY 配方);返回值要消费 ⇒ 不能用裸 `'ignore'`。
 * 环境里剥掉全部 `LAND_*`:万一调用方 shell 里带着 `LAND_PATHS`,object-space-land 的
 * "未知旗标"路径就有可能真去落地 —— 本测试的前提是零副作用,这条剥离是前提的一部分。
 */
function runNode(script, args) {
  const env = {}
  for (const [k, v] of Object.entries(process.env)) {
    if (!k.startsWith('LAND_')) env[k] = v
  }
  const r = spawnSync(process.execPath, [join(REPO_ROOT, script), ...args], {
    cwd: REPO_ROOT,
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
function snapshotRepoState() {
  const porcelain = spawnSync('git', ['--no-optional-locks', '-c', 'core.quotePath=false', 'status', '--porcelain'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    timeout: 120_000,
  })
  const head = spawnSync('git', ['--no-optional-locks', 'rev-parse', 'HEAD'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    timeout: 120_000,
  })
  // 取不到就是"未判定":不许把空串当成"干净"从而让 ③ 假绿。
  assert.equal(porcelain.status, 0, `git status --porcelain 取不到(rc=${porcelain.status}):${porcelain.stderr}`)
  assert.equal(head.status, 0, `git rev-parse HEAD 取不到(rc=${head.status}):${head.stderr}`)
  const headSha = head.stdout.trim()
  assert.match(headSha, /^[0-9a-f]{40}$/, `HEAD 形态不对:${JSON.stringify(headSha)}`)
  return { porcelain: porcelain.stdout, head: headSha }
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
      // 不只退出码:真的打印了用法。三器实际输出都用「用法」起头(不统一的话这一条就该改成逐器字面量)。
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

test('③ 零副作用:help/未知旗标两条路径跑完,git status --porcelain 与 HEAD 逐字不变', () => {
  // 这两条路径**必须**在任何动索引/refs 的动作之前退出。它们若有副作用,口径怎么写都是空话。
  const before = snapshotRepoState()
  for (const d of DEVICES) {
    for (const flag of ['--help', '-h', UNKNOWN_FLAG]) {
      const r = runNode(d.script, [flag])
      assertRan(d, r)
    }
  }
  const after = snapshotRepoState()
  assert.equal(after.head, before.head, `HEAD 被 --help 或未知旗标路径推进了(${before.head} → ${after.head})`)
  assert.equal(
    after.porcelain,
    before.porcelain,
    `工作树/索引脏面被 --help 或未知旗标路径改了(说明器在有副作用的动作之后才退出):\n--- before ---\n${before.porcelain}\n--- after ---\n${after.porcelain}`,
  )
})
