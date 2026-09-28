// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * §22c 镜像测试 —— 判据本体在 `scripts/lib/push-attempt-triage.mjs`,本文件**只 import 它**,
 * 不在这里重写任何正则或判序(两处算同一件事必漂移;AGENTS §22c:镜像测试只复读实现就是复读机)。
 *
 * 本票(2026-09-28)钉的三件事:
 *   ① 判序:远端 ref 竞态(`cannot lock ref` / `stale info`)必须先于 `Required status check`
 *      / `protected branch` 命中 —— 管理员旁路成功时 GitHub 照打那两行**信息**,而这一趟的
 *      死因是别的会话同秒推了(实测 05:23Z 与 06:2xZ 两次都被旧判序报成"分支保护")。
 *   ② 两档不合并:策略拒收(GH006)与竞态(cannot lock ref)的出路**相反**;真分叉
 *      (non-fast-forward)那一档的语义与出路一字未动。
 *   ③ 读数诚实:`git-push-converge.mjs` 的每一条依赖 push-state 的结论都必须报名
 *      "这条记录关于哪枚提交 / 距今多久 / 算不算当下量的",记录与当前 HEAD 无关时
 *      写成"历史残留/未现推",不得冒充本次故障。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'
// 唯一入口:源脚本的 __test__ 导出(§22c 第 2 步)。禁止在这里复制判据。
import { __test__ as T } from '../lib/push-attempt-triage.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const LIB_SRC = readFileSync(join(here, '..', 'lib', 'push-attempt-triage.mjs'), 'utf8')
const CONVERGE_SRC = readFileSync(join(here, '..', 'git-push-converge.mjs'), 'utf8')
const CONVERGE_PATH = join(here, '..', 'git-push-converge.mjs')
const SELF_SRC = readFileSync(fileURLToPath(import.meta.url), 'utf8')

const SHA_A = 'a'.repeat(40)
const SHA_B = 'b'.repeat(40)
const HOUR = 3600_000

// ── 三条**成对反证**的夹具(逐字取自 2026-09-28 的真回显形态;自造文本只会让锁跟着判据一起漂) ──
/** (a) 旁路通知 + `cannot lock ref` ⇒ 竞态。带不带 Required status check 那行都判竞态。 */
const RACE = [
  'remote: Bypassed rule violations for refs/heads/main:        ',
  'remote: ',
  'remote: - Required status check "CI / lint-typecheck-test (push)" is expected.        ',
  'To https://github.com/IHUI-INF-AI/IHUI-AI.git',
  " ! [remote rejected]       main -> main (cannot lock ref 'refs/heads/main': is at 6b8cd0f6aa11 but expected c12612dc9f02)",
  "error: failed to push some refs to 'https://github.com/IHUI-INF-AI/IHUI-AI.git'",
].join('\n')
/** (a′) 同一型但没有状态检查那行(纯旁路通知 + 锁失败)。 */
const RACE_NO_CHECK = [
  'remote: Bypassed rule violations for refs/heads/main:        ',
  " ! [remote rejected]       main -> main (cannot lock ref 'refs/heads/main': is at 6b8cd0f6aa11 but expected c12612dc9f02)",
].join('\n')
/** (a″) `stale info` —— 竞态的另一形态(--force-with-lease / 过期 tracking ref)。 */
const RACE_STALE_INFO =
  'To https://github.com/x/y.git\n ! [rejected]        main -> main (stale info)\nerror: failed to push some refs'
/** (b) 纯策略拒收 ⇒ 策略档。 */
const POLICY = [
  'remote: error: GH006: Protected branch update failed for refs/heads/main.        ',
  'remote: ',
  'remote: - Required status check "CI / lint-typecheck-test (pull_request)" is expected.        ',
  ' ! [remote rejected]       main -> main (protected branch hook declined)',
].join('\n')
/** (c) 真分叉 ⇒ 既有 non-fast-forward 档(语义与出路一字未动)。 */
const DIVERGE = [
  'To https://github.com/x/y.git',
  ' ! [rejected]        main -> main (non-fast-forward)',
  "error: failed to push some refs to 'https://github.com/x/y.git'",
  'hint: Updates were rejected because the tip of your current branch is behind',
].join('\n')

// ══════════════════════════════════════════════════════════════════════
// 出口齐备性:测试 import 的是源脚本的那一份实现,不是副本
// ══════════════════════════════════════════════════════════════════════

test('T1 §22c 出口在位:__test__ 必须真的导出被使用的判据(摘线不得被读成已装车)', () => {
  for (const name of ['triagePushAttempt', 'describeVerdict', 'pushStateProvenance']) {
    assert.equal(typeof T[name], 'function', `__test__.${name} 不是函数 ⇒ 出口漂了`)
  }
  for (const name of [
    'REMOTE_REF_RACE_RE',
    'RULE_BYPASS_NOTICE_RE',
    'PROTECTED_BRANCH_RE',
    'NON_FAST_FORWARD_RE',
    'SECRET_SCAN_RE',
    'UP_TO_DATE_RE',
    'CREDENTIALS_UNAVAILABLE_RE',
    'HOOK_TRACE_RE',
  ]) {
    assert.ok(T[name] instanceof RegExp, `__test__.${name} 必须是 RegExp`)
  }
  assert.ok(Array.isArray(T.PUSH_TRIAGE_KINDS), 'PUSH_TRIAGE_KINDS 必须是数组')
  // 源面锁:__test__ 对象必须真的 export 出来(否则哪天被删,本文件会退化成 import 具名符号
  // 或干脆自己抄一份 —— 那正是 §22c 要防的两份真相)
  assert.match(LIB_SRC, /export const __test__ = \{/, 'lib 里 __test__ 导出块不见了')
  assert.match(LIB_SRC, /\n  pushStateProvenance,/, '__test__ 里没有 pushStateProvenance')
  assert.match(LIB_SRC, /\n  REMOTE_REF_RACE_RE,/, '__test__ 里没有 REMOTE_REF_RACE_RE')
  // 反向锁:本测试文件不得自带一份分诊正则(判据只有一份)
  assert.doesNotMatch(
    SELF_SRC,
    /const\s+\w*RE\s*=\s*\/(?:.*cannot lock ref|.*GH006)/i,
    '测试里复制了判据正则 ⇒ 两份真相,判据漂移时本文件会跟着一起绿',
  )
})

test('T2 名单:remote-ref-race 已进封闭集,且每个成员都有命中它的输入(死表即红)', () => {
  assert.ok(
    T.PUSH_TRIAGE_KINDS.includes('remote-ref-race'),
    '新档没进 PUSH_TRIAGE_KINDS ⇒ 下游按封闭集校验的读取方会把它当未知 kind',
  )
  const fixtures = {
    'pushed-ok': { status: 0, stdout: '   1111111..2222222  main -> main' },
    'up-to-date': { status: 0, stdout: 'Everything up-to-date', remoteEqualsLocal: true },
    'remote-ref-race': { status: 1, stderr: RACE },
    'protected-branch': { status: 1, stderr: POLICY },
    'non-fast-forward': { status: 1, stderr: DIVERGE },
    'secret-scan-blocked': {
      status: 1,
      stderr: ' ! [remote rejected] main (push declined due to repository rule violations)',
    },
    'credentials-unavailable': {
      status: 128,
      stderr:
        "error: failed to execute prompt script (exit code 1)\nfatal: could not read Username for 'https://github.com': No such file or directory",
    },
    'hook-failed': { status: 1, stderr: '🚫 1 道 blocking 门失败 —— 本轮已跑完全部 152 项' },
    other: {
      status: 1,
      stderr: 'fatal: unable to access https://example.com: Could not resolve host',
    },
  }
  for (const kind of T.PUSH_TRIAGE_KINDS) {
    const fx = fixtures[kind]
    assert.ok(fx, `名单成员 ${kind} 没有正向夹具(名单可以是张死表而门一路报绿)`)
    assert.equal(T.triagePushAttempt(fx).kind, kind, `${kind} 的夹具必须真命中该档`)
  }
})

// ══════════════════════════════════════════════════════════════════════
// 任务要求的成对反证:(a) 竞态 (b) 策略 (c) 分叉 —— 任一退化即红
// ══════════════════════════════════════════════════════════════════════

test('T3 成对反证(a):Bypassed rule violations + cannot lock ref ⇒ **竞态**,不是分支保护', () => {
  const v = T.triagePushAttempt({ status: 1, stderr: RACE })
  assert.equal(v.kind, 'remote-ref-race', `实得 ${v.kind}(旧判序在这里会报 protected-branch)`)
  // 同一型但没带状态检查那行,也必须是竞态(判据靠 CAS 原话,不靠"有没有那行")
  assert.equal(T.triagePushAttempt({ status: 1, stderr: RACE_NO_CHECK }).kind, 'remote-ref-race')
  // stale info 是竞态的另一形态(此前挂在 non-fast-forward 里)
  assert.equal(T.triagePushAttempt({ status: 1, stderr: RACE_STALE_INFO }).kind, 'remote-ref-race')
  // 旁路通知本身**不是**拒绝证据:它命中 RULE_BYPASS_NOTICE_RE,不命中策略档
  assert.ok(T.RULE_BYPASS_NOTICE_RE.test('remote: Bypassed rule violations for refs/heads/main:'))
  assert.doesNotMatch(POLICY, /Bypassed rule violations/i, '夹具串台:策略夹具不该含旁路通知')
})

test('T4 成对反证(b):GH006 protected branch hook declined ⇒ **策略**,不得被竞态吃掉', () => {
  const v = T.triagePushAttempt({ status: 1, stderr: POLICY })
  assert.equal(v.kind, 'protected-branch')
  assert.ok(!T.REMOTE_REF_RACE_RE.test(POLICY), '策略回显里不该出现竞态特征,否则两档并成一档')
  assert.notEqual(
    v.nextCommand,
    T.CONVERGE_COMMAND,
    '策略拒收的出路不是收敛器(收敛器修不了仓库设置)',
  )
  assert.equal(v.allowNoVerifyRetry, false)
  assert.equal(v.terminalStatus, 'failed')
})

test('T5 成对反证(c):! [rejected] … (non-fast-forward) ⇒ **仍**判分叉,出路仍指向收敛器', () => {
  const v = T.triagePushAttempt({ status: 1, stderr: DIVERGE })
  assert.equal(v.kind, 'non-fast-forward')
  assert.equal(v.nextCommand, T.CONVERGE_COMMAND, '既有 non-fast-forward 档的出路一个字不得改')
  assert.equal(v.terminalStatus, 'diverged')
  assert.equal(v.allowNoVerifyRetry, false)
})

test('T6 两档不得合并:三档的 kind / 出路 / 终态两两不同,且判序=竞态 > 策略 > 分叉', () => {
  const race = T.triagePushAttempt({ status: 1, stderr: RACE })
  const policy = T.triagePushAttempt({ status: 1, stderr: POLICY })
  const diverge = T.triagePushAttempt({ status: 1, stderr: DIVERGE })
  const kinds = new Set([race.kind, policy.kind, diverge.kind])
  assert.equal(kinds.size, 3, `三档被合并了:${[...kinds].join(',')}`)
  const cmds = new Set([race.nextCommand, policy.nextCommand, diverge.nextCommand])
  assert.equal(cmds.size, 3, `三档出路被合并了:${[...cmds].join(' | ')}`)
  // 判序:三型同现 ⇒ 竞态先命中(git 自己的 CAS 原话最具体)
  assert.equal(
    T.triagePushAttempt({ status: 1, stderr: `${DIVERGE}\n${POLICY}\n${RACE}` }).kind,
    'remote-ref-race',
  )
  // 判序:策略 + 分叉(无竞态特征)⇒ 仍是策略(既有那一条锁不得被本票放松)
  assert.equal(
    T.triagePushAttempt({ status: 1, stderr: `${DIVERGE}\n${POLICY}` }).kind,
    'protected-branch',
  )
  // 竞态档绝不产生跳门计划,也绝不冒充 diverged 终态
  assert.equal(race.allowHookRetry, false)
  assert.equal(race.allowNoVerifyRetry, false)
  assert.equal(race.terminalStatus, 'failed', '通道没坏 ⇒ 落 failed 让下一次 guard 重试')
  assert.notEqual(race.nextCommand, T.CONVERGE_COMMAND)
  assert.equal(race.nextCommand, T.RACE_RECHECK_COMMAND)
})

test('T7 竞态出路必须**两条分支都给**:祖先成立⇒重推 / 不成立⇒收敛器(否则又是指向死路)', () => {
  const v = T.triagePushAttempt({ status: 1, stderr: RACE })
  assert.match(v.nextCommand, /git ls-remote origin refs\/heads\/main/)
  assert.match(v.nextCommand, /merge-base --is-ancestor/)
  assert.match(v.why, /本地祖先[\s\S]*重推即可/, 'why 必须写出"远端 tip 是本地祖先 ⇒ 直接重推即可"')
  assert.match(
    v.why,
    /祖先不成立[\s\S]*git-sync-converge\.mjs/,
    'why 必须给出祖先不成立时的唯一出口',
  )
  assert.match(v.why, /不是分支保护|这\*\*不是\*\*分支保护/, 'why 必须点名"别按策略档去改仓库设置"')
  assert.match(T.describeVerdict(v), /出路: /, 'describeVerdict 必须把出路带到人面前')
})

test('T8 形状锁:stale info 已移出 non-fast-forward,而策略档没被顺手放宽(修红≠削判据)', () => {
  assert.doesNotMatch(
    T.NON_FAST_FORWARD_RE.source,
    /stale info/,
    'stale info 仍挂在分叉档 ⇒ 竞态会被报成"去收敛"(与本次修复方向相反)',
  )
  assert.match(T.REMOTE_REF_RACE_RE.source, /cannot lock ref/)
  assert.match(T.REMOTE_REF_RACE_RE.source, /stale info/)
  // 反向:策略档的三条特征一条都没被删(删掉任何一条都是"为了让本次不误判而放宽")
  for (const feature of ['GH006', 'protected branch hook declined', 'Required status check']) {
    assert.ok(
      T.PROTECTED_BRANCH_RE.test(feature),
      `策略档不再命中 ${feature} ⇒ 判据被削,误判只会换个方向继续存在`,
    )
  }
  // 分叉档的四个原特征仍在(既有语义"一字未动"是可核验的,不是口头承诺)
  for (const feature of [
    '(non-fast-forward)',
    'fetch first',
    'Updates were rejected',
    '[rejected]',
  ]) {
    assert.ok(T.NON_FAST_FORWARD_RE.test(feature), `分叉档丢了特征 ${feature}`)
  }
})

// ══════════════════════════════════════════════════════════════════════
// ③ 读数诚实:pushStateProvenance 判据 + converge 装车
// ══════════════════════════════════════════════════════════════════════

test('T9 provenance:五态分明,历史残留不得冒充当下结论(未判定也不得记成通过)', () => {
  const now = 1_800_000_000_000
  const current = T.pushStateProvenance({
    pushState: { status: 'failed', headSha: SHA_A, ts: now - 30_000 },
    localHead: SHA_A,
    now,
  })
  assert.equal(current.state, 'current')
  assert.equal(current.isCurrent, true)
  assert.match(current.text, /当下量的/)

  const foreign = T.pushStateProvenance({
    pushState: { status: 'failed', headSha: SHA_B, ts: now - 4 * HOUR },
    localHead: SHA_A,
    now,
  })
  assert.equal(foreign.state, 'stale-record')
  assert.equal(foreign.isCurrent, false, '记录关于别的提交 ⇒ 必须落非当下')
  assert.equal(foreign.sameHead, false)
  assert.match(foreign.text, /另一枚提交/)
  assert.match(foreign.text, /历史残留\/未现推/)
  assert.equal(foreign.label, '历史残留/未现推')
  assert.doesNotMatch(foreign.text, /当下量的/, 'stale 的文案里不得混进"当下"字样')

  const aged = T.pushStateProvenance({
    pushState: { status: 'done', headSha: SHA_A, ts: now - 6 * 60_000 },
    localHead: SHA_A,
    now,
  })
  assert.equal(aged.state, 'stale-record', '同一枚但超出窗口 ⇒ 也不算当下量的')

  const absent = T.pushStateProvenance({ pushState: null, localHead: SHA_A, now })
  assert.equal(absent.state, 'absent')
  assert.equal(absent.isCurrent, false)

  const malformed = T.pushStateProvenance({
    pushState: { status: 'failed', headSha: SHA_A, ts: undefined },
    localHead: SHA_A,
    now,
  })
  assert.equal(malformed.state, 'malformed', 'ts 取不到 ⇒ 未判定,不得猜成 current 或 stale')
  assert.match(malformed.text, /未判定/)

  // 年龄量级:小时档必须有(只给 s/min 会把隔夜残留读成刚发生)
  assert.equal(foreign.ageText, '4h')
  assert.equal(
    T.pushStateProvenance({
      pushState: { status: 'failed', headSha: SHA_B, ts: now - 90_000 },
      localHead: SHA_A,
      now,
    }).ageText,
    '2min',
  )
  // 缩写比较也要认(git 输出常是 7/11 位短 sha)
  assert.equal(
    T.pushStateProvenance({
      pushState: { status: 'failed', headSha: SHA_A, ts: now - 1000 },
      localHead: SHA_A.slice(0, 11),
      now,
    }).state,
    'current',
  )
  // localHead 取不到 ⇒ 不得凭空判 current(宁判 stale-record 并报名)
  assert.equal(
    T.pushStateProvenance({
      pushState: { status: 'failed', headSha: SHA_A, ts: now - 1000 },
      localHead: '',
      now,
    }).state,
    'stale-record',
  )
})

test('T10 装车锁:converge 必须真的用 lib 的那一份出处判据,且每条依赖 push-state 的结论都报名', () => {
  // 判据在、没人调用 = 没有(守门 64/70/81/115 同族)
  assert.match(
    CONVERGE_SRC,
    /from '\.\/lib\/push-attempt-triage\.mjs'/,
    'converge 未引用分诊/出处模块 ⇒ 判据失明',
  )
  assert.match(
    CONVERGE_SRC,
    /import \{ pushStateProvenance \}/,
    'converge 未 import pushStateProvenance',
  )
  assert.ok(
    CONVERGE_SRC.includes('pushStateProvenance({'),
    'converge 里没有 pushStateProvenance( 调用 ⇒ 新读数出处判据没装车',
  )
  // PUSH_FAILED 两处(origin 委托失败 / 镜像直推失败)都必须挂"依据出处"行
  const failedSites = [...CONVERGE_SRC.matchAll(/status: 'PUSH_FAILED'/g)]
  assert.equal(failedSites.length, 2, `PUSH_FAILED 结论点应为 2 处(实得 ${failedSites.length})`)
  for (const m of failedSites) {
    const window = CONVERGE_SRC.slice(m.index, m.index + 1800)
    assert.match(
      window,
      /noteEvidence\(/,
      '一处 PUSH_FAILED 没有挂依据出处 ⇒ 读数仍分不清当下/历史',
    )
    assert.match(
      window,
      /本次现推输出末行|未取到输出\(未判定\)/,
      'PUSH_FAILED 必须报本次现推的输出',
    )
  }
  // SKIP / DIVERGED / PUSHING 也各有出处行(这三条同样会被读成"当下故障")
  for (const marker of ["status: 'BEHIND'", "status: 'DIVERGED'", "status: 'PUSHING'"]) {
    const i = CONVERGE_SRC.indexOf(marker)
    assert.ok(i > -1, `converge 少了 ${marker} 这一支(判据被改写?)`)
    assert.match(CONVERGE_SRC.slice(i, i + 900), /noteEvidence\(/, `${marker} 未挂依据出处`)
  }
  // 定性只在 lib 判一次:converge 不得再自己比 headSha / 自己算年龄
  assert.doesNotMatch(
    CONVERGE_SRC,
    /Date\.now\(\)\s*-\s*pushState\.ts|pushState\.headSha\s*===\s*localHead/,
    'converge 里出现第二份"是否同一枚提交/是否过期"的算法 ⇒ 两处必漂移',
  )
  // 措辞单源:converge 不得自带"历史残留"文案(那是 lib 的 text/label 产出的)
  const codeFace = CONVERGE_SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  assert.doesNotMatch(codeFace, /历史残留/, 'converge 自己写了定性文案 ⇒ 与 lib 的措辞成两份真相')
  // 强制同步档不得被本次改写弄丢(丢了 guard 会秒回 exit 0 ⇒ 把"什么都没推"报成 PUSHED)
  assert.match(CONVERGE_SRC, /GUARD_ASYNC: '0'/, 'GUARD_ASYNC=0 被摘掉 ⇒ PUSHED 这一行会造假')
  assert.match(CONVERGE_SRC, /汇总出处:/, '末行必须再报一次读数出处(多仓时逐行注脚会被截掉)')
})

// ══════════════════════════════════════════════════════════════════════
// 端到端:真跑 converge —— 历史读数**必须**被喊成"历史残留/未现推"
// 阳性对照用临时仓(file:// origin),不触碰本仓 git 状态与真远端。
// ══════════════════════════════════════════════════════════════════════

function shGit(args, cwd) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
    timeout: 120_000,
  })
}

function setIdentity(dir) {
  for (const [k, v] of [
    ['user.email', 't@e.co'],
    ['user.name', 't'],
    ['commit.gpgsign', 'false'],
  ])
    shGit(['config', '--local', k, v], dir)
}

// ── 2026-09-28 补:验证段的"等值"在并发下会把成功的推送报成失败 ──
// 真实现场:guard 打出 `8dbacd2322..61f6fdc9d0  main -> main`(推成功了),随后 `git rev-parse HEAD`
// 读到别的会话刚落的 commit ⇒ 等值读 false ⇒ 账面"push 报告成功但验证失败" + push-state=failed。
test('T12 并发推送:等值假而祖先测真 ⇒ 终态 done,且依据必须报名是祖先测', () => {
  const v = T.triagePushAttempt({
    status: 0,
    stdout: 'Everything up-to-date',
    remoteEqualsLocal: false,
    pushedShaContainedInRemote: true,
  })
  assert.equal(v.kind, 'up-to-date')
  assert.equal(v.terminalStatus, 'done', '我推的那枚已被远端包含 ⇒ 不得落 failed')
  assert.match(v.why, /祖先测/, '措辞必须说清是哪把尺子给的合格证(等值并不成立)')
})

test('T13 反向(两向):等值假 + 祖先测假 / 两把都未判定 ⇒ 仍 failed,不得凭 up-to-date 回显发合格证', () => {
  const bothFalse = T.triagePushAttempt({
    status: 0,
    stdout: 'Everything up-to-date',
    remoteEqualsLocal: false,
    pushedShaContainedInRemote: false,
  })
  assert.equal(bothFalse.terminalStatus, 'failed', '两把尺子都不成立 ⇒ 未判定不等于成功')
  const bothNull = T.triagePushAttempt({
    status: 0,
    stdout: 'Everything up-to-date',
    remoteEqualsLocal: null,
    pushedShaContainedInRemote: null,
  })
  assert.equal(bothNull.terminalStatus, 'failed', '两把尺子都没拿到 ⇒ 同样不得记成推送成功')
})

test('T14 向后兼容:只给等值(旧调用方形态)时结论一字不动', () => {
  assert.equal(
    T.triagePushAttempt({ status: 0, stdout: 'Everything up-to-date', remoteEqualsLocal: true })
      .terminalStatus,
    'done',
  )
  assert.equal(
    T.triagePushAttempt({ status: 0, stdout: 'Everything up-to-date', remoteEqualsLocal: false })
      .terminalStatus,
    'failed',
  )
})

test('T11 e2e:converge 在"本地落后 + 一条四小时前的他人读数"下报 SKIP,并把读数喊成历史残留/未现推', () => {
  const origin = mkScratch('ihui-conv-origin-')
  const work = mkScratch('ihui-conv-work-')
  const peer = mkScratch('ihui-conv-peer-')
  try {
    shGit(['init', '--bare', '-b', 'main', origin])
    const originUrl = origin.replace(/\\/g, '/')
    shGit(['init', '-b', 'main', work])
    setIdentity(work)
    writeFileSync(join(work, 'README.md'), '# init\n')
    shGit(['add', 'README.md'], work)
    shGit(['commit', '-m', 'init'], work)
    shGit(['remote', 'add', 'origin', originUrl], work)
    shGit(['push', '-u', 'origin', 'main'], work)

    // 「另一个会话」推进远端 ⇒ 本侧落后 ⇒ converge 走 SKIP 支(只读,不产生任何写)
    shGit(['clone', originUrl, peer], process.cwd())
    setIdentity(peer)
    writeFileSync(join(peer, 'PEER.md'), 'peer\n')
    shGit(['add', 'PEER.md'], peer)
    shGit(['commit', '-m', 'peer commit'], peer)
    shGit(['push', 'origin', 'main'], peer)
    const foreignSha = shGit(['rev-parse', 'HEAD'], peer).trim()
    assert.notEqual(foreignSha, shGit(['rev-parse', 'HEAD'], work).trim(), '夹具没造成落后')

    // 一条**关于别的提交、四小时前**的 push-state(正是本票登记的那种失真现场)
    mkdirSync(join(work, '.workbuddy'), { recursive: true })
    writeFileSync(
      join(work, '.workbuddy', 'push-state.json'),
      JSON.stringify({
        status: 'failed',
        headSha: foreignSha,
        ts: Date.now() - 4 * HOUR,
        pid: 999999,
        reason: '上一枚提交的旧失败',
      }),
    )

    const r = spawnSync(process.execPath, [CONVERGE_PATH, '--remotes=origin'], {
      cwd: work,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: 180_000,
      maxBuffer: 64 * 1024 * 1024,
    })
    const out = `${r.stdout || ''}\n${r.stderr || ''}`
    assert.match(out, /⏭️\s+SKIP/, `应走 SKIP 支:${out}`)
    assert.match(out, /依据出处:/, '结论行下面必须有依据出处行')
    assert.match(out, /历史残留\/未现推/, '四小时前、且关于别的提交 ⇒ 必须喊历史残留')
    // 读数**本身**不得被定性成当下量的(lib 的 current 文案是"… = **当下量的**");
    // 同一行的 ls-remote 旁证写"当下量的"是另一件事(那是真·现读),不该被这条锁误伤。
    assert.doesNotMatch(
      out,
      /push-state 读数:[^\n]*=\s*\*\*当下量的\*\*/,
      '那条记录与当前 HEAD 无关,却被打成了当下依据 ⇒ 失真复活',
    )
    assert.match(out, /距今 4h/, '年龄必须带小时档')
    assert.match(out, /汇总出处:/, '末行必须再报一次出处')
    assert.equal(r.status, 0, `本地落后不判失败,应 exit 0。实得 ${r.status}\n${out}`)
  } finally {
    for (const d of [peer, work, origin]) {
      try {
        rmScratch(d)
      } catch {
        /* 清理失败不影响结论,已在用例内断言完毕 */
      }
    }
  }
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
