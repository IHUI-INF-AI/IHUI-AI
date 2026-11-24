// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * safe-commit 失败分诊的形状锁(2026-10-26 立;当天本机实测打穿旧判据)。
 *
 * 立因:`isGitLockFailure` 写的是 `status === 128 || GIT_LOCK_MISS.test(out)` ——
 * **任何** 128 都被读成"索引锁争用"。当天两次命中:
 *  ① 本会话身份下 `git config --get user.email` 取不到(rc=1)⇒ `Author identity unknown` + 128
 *     ⇒ 整条守门链(本机实测 9~15 分钟/轮)被同一确定性失败重跑 10 轮,约 100 分钟白烧,
 *     最后照样落不了地;
 *  ② 出网代理腿死(`unable to access … Recv failure`)同一族。
 * 本锁只钉**形状**(判据本体住在 safe-commit.mjs,这里不复制判定实现,§22c):
 * 任何一格被改回旧形态即红。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// 判据本体一律 import 生产模块(§22c:测试里复制一份判据就是第二份真相)。
// 2026-10-29:补 commit-msg 阶段复跑那一档的成对夹具(见文件末三节)。
import { __test__ as ATTR } from '../lib/commit-gate-attribution.mjs'
import { mkScratch, rmScratch } from '../lib/scratch-dir.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(here, '..', 'safe-commit.mjs'), 'utf8')
/** 真钩子文本 —— 解析面必须与生产同一份,否则"钩子新加一道检查而夹具看不见"会静默漂移 */
const commitMsgHook = readFileSync(join(here, '..', '..', '.husky', 'commit-msg'), 'utf8')

test('① 裸 128 不得再算锁争用', () => {
  assert.doesNotMatch(
    src,
    /isGitLockFailure\s*=\s*\(status,\s*out\)\s*=>\s*status\s*===\s*128\s*\|\|/,
    '旧形态(任何 128 都是锁)回潮:会把署名缺失/网络断当成锁并重跑 10 轮全量门',
  )
  assert.match(
    src,
    /isGitLockFailure\s*=\s*\(status,\s*out\)\s*=>\s*status\s*===\s*128\s*&&\s*GIT_LOCK_MISS\.test\(out\)/,
    '新形态(128 ∧ 锁特征)不在位',
  )
})

test('② 确定性致命因有专档,且不退 --no-verify', () => {
  assert.match(src, /const GIT_DETERMINISTIC_FATAL\s*=/, '确定性致命因表不见了')
  assert.match(src, /GIT_DETERMINISTIC_FATAL\.test\(out\)/, '分支没真的判它')
  const at = src.indexOf('GIT_DETERMINISTIC_FATAL.test(out))')
  const end = src.indexOf('process.exit(1)', at)
  assert.ok(at > 0 && end > at, '命中后必须当场退出(不得继续烧下一轮全量门,也不得落入跳门归因链)')
  const body = src.slice(at, end)
  assert.doesNotMatch(body, /--no-verify/, '确定性致命因那一档绝不许跳门')
  assert.doesNotMatch(body, /sleep\(/, '那一档绝不许"睡 3 秒再赌一次"')
  assert.doesNotMatch(body, /break/, '那一档不得 break 回主环(break 会被下游归因升级成 --no-verify)')
  assert.match(body, /hookFailed = false/, '必须明写"没有门被跳过",否则事后账面上像跳了门')
})

test('③ 身份来自唯一出口,不在端内抄第二份', () => {
  assert.match(src, /import \{ REPO_GIT_IDENTITY_ARGS \} from '\.\/lib\/bypass-git\.mjs'/)
  assert.doesNotMatch(src, /user\.name=[^'"]*社区|user\.email=[^'"]*@/m, '端内出现了硬编码署名')
  // 探针方向:问不到 ⇒ 当作"有身份"(绝不代人署名)
  assert.match(src, /catch \{\s*return true \/\/ 问不到/, '探针失效方向被改:问不到却补署名 = 伪造作者')
})

test('③a 两个发令点都走 commitArgv(裸 commitArgs 发令会漏身份)', () => {
  assert.match(src, /const commitArgv = \(skipHooks, extraCfg = \[\]\) =>/, '拼装出口不见了')
  const viaArgv = [...src.matchAll(/commitArgv\((?:false|true)/g)].map((m) => m.index)
  assert.equal(
    viaArgv.length,
    2,
    `走 commitArgv 的发令点应恰为 2(带钩子发令体 + 显式逃生口),实得 ${viaArgv.length}`,
  )
  // 定义体里那一次 commitArgs(skipHooks) 不算发令点:发令点必须只写 commitArgv
  const bare = [...src.matchAll(/commitArgs\((?:false|true)\)/g)]
  assert.equal(bare.length, 0, '存在绕过 commitArgv 直接 commitArgs 的发令点 ⇒ 身份会漏')
})

test('③c not-ours 不再自动跳门:带钩子发令点在重试环里,skipHooks=true 只在 else 分支', () => {
  // 2026-11-02(事故 5c8aec3653):归因 not-ours ⇒ 旧实现无条件追加 --no-verify ⇒ 假绿。
  // 形状锁:①重试环比"逃生口"判定先出现;②skipHooks=true 的发令只在 else 分支
  // (既有 env-blocked/undetermined-red 路径 + not-ours 显式逃生口),not-ours 默认进不去。
  const hatchGate = src.indexOf("process.env.IHUI_SAFE_COMMIT_ALLOW_SKIP_HOOKS === '1'")
  assert.ok(hatchGate > 0, '显式逃生口判据不见了 ⇒ 默认路径可能又静默跳门')
  const retryLoop = src.indexOf('for (let retry = 1; retry <= HOOK_RETRIES; retry++)')
  assert.ok(retryLoop > 0 && retryLoop < src.indexOf('commitArgv(true)'), '退避重试环不见了/排在跳门之后')
  assert.match(
    src.slice(retryLoop, src.indexOf('commitArgv(true)')),
    /launchCommitWithHooks\(\)/,
    '重试环必须发带钩子的普通提交(launchCommitWithHooks),不许另拼一份 argv',
  )
  const elseAt = src.indexOf('} else {', retryLoop)
  assert.ok(elseAt > retryLoop, 'not-ours 重试段之后应接 else(既有路径 + 显式逃生口)')
  assert.ok(
    src.indexOf('commitArgv(true)') > elseAt,
    '--no-verify 发令必须落在 else 分支里(只有显式逃生口能到)',
  )
  assert.doesNotMatch(
    src.slice(retryLoop, elseAt),
    /commitArgv\(true\)/,
    'not-ours 重试段里出现 skipHooks=true 发令 ⇒ 又回到自动跳门',
  )
})

test('④ 身份注入排在 git 子命令之前(git 语法要求 -c 前置)', () => {
  assert.match(src, /\[\.\.\.extraCfg,\s*\.\.\.IDENTITY_CFG_ARGS,\s*\.\.\.commitArgs\(skipHooks\)\]/)
})

// ── ⑤–⑨ commit-msg 阶段复跑(2026-10-29 立)────────────────────────────────────────
// 事故形态(留痕 ts=2026-10-28T17:09:31.397Z):三端改动 + message scope 写成 analytics,
// `.husky/commit-msg` 的 scope 一致性检查判 R3 并 exit 1;而归因层只复跑 pre-commit 批
// (31 道全绿)⇒ 落 not-ours ⇒ `--no-verify` 把一道**判得完全正确**的门跳掉。
// 失效方向反了(§0.10):本该"多要一次定向说明",实际是"多放一次跳门"。
// 三节成对:正例(必须 ours)/ 反例(全绿仍走既有 not-ours)/ 变异自证(摘掉复跑即翻红)。
const SCOPE_SCRIPT = 'check-commit-scope-consistency.mjs'
/** 事故决策时的归因结论(取证来自自跑批,台账里那一枚就是这一形) */
const INCIDENT_VERDICT = {
  kind: 'not-ours',
  ranFullBatch: true,
  failed: [],
  batchSelfRun: true,
  selfRunOk: true,
  blockerBeforeBatch: null,
  detail: [
    '门级结论取自 safe-commit 自跑的那一轮 guardian-runner --staged(exit 0),不是钩子内那一轮',
  ],
  reason: 'safe-commit 自跑守门批:总检查数 31、blocking 失败 0 ⇒ 红不在守门批',
}
/** 事故里那道门自己打出来的原文(逐字取自 hook-logs/commit-msg-scope.log) */
const SCOPE_RED = [
  '',
  '❌ Commit 污染特征签名检测触发 (blocking)',
  '规则 R3: 3 个 apps 子目录 [miniapp-taro, mobile-rn, web] + scope="analytics" 不在其中 (疑似跨端污染)',
  'Commit message: fix(analytics): 恢复被旧基线写回的末屏停留结算',
  '紧急跳过(不推荐): HUSKY_SKIP_SCOPE_CHECK=1 git commit ...',
].join('\n')

test('⑤ 检查清单从 .husky/commit-msg 现读,blocking 按 `|| true` 分流(不另建清单)', () => {
  const checks = ATTR.parseCommitMsgStageChecks(commitMsgHook)
  const scope = checks.find((c) => c.script === SCOPE_SCRIPT)
  const style = checks.find((c) => c.script === 'check-style-verification.mjs')
  assert.ok(scope, '解析不出 scope 一致性检查 ⇒ 复跑面比钩子窄,正例永远复现不了')
  assert.equal(scope.blocking, true, '末行 `exit $_scope_rc` 的那条必须判 blocking')
  assert.ok(style, '解析不出样式验证检查')
  // 2026-11-04 钩子自己改了语义(头注原话「三态化:去掉 || true,失败/未判定均阻断(exit 1/2)」)
  // ⇒ 现读为 blocking。本行钉的是**今天这份真钩子**的形态,不是把 warn 档判据改硬:判据仍在 lib,
  // warn 分支的覆盖由下面那条合成钩子承担 —— 拿真钩子钉 warn 等于钉一件已经不存在的事。
  assert.equal(style.blocking, true, '样式门现为 blocking(钩子已去掉 `|| true`);它红了必须能定责')
  // 阴性:注释里出现的路径不是"钩子调用",拿它去复跑就是造一个没人跑过的检查
  assert.deepEqual(ATTR.parseCommitMsgStageChecks('# node scripts/foo.mjs\n'), [])
  // warn 档判据本体仍在(钩子哪天把 `|| true` 加回来就得认它)
  const warnFixture = ATTR.parseCommitMsgStageChecks(
    'node scripts/a-gate.mjs "$1" || true\nnode scripts/b-gate.mjs "$1"\nexit $?\n',
  )
  assert.deepEqual(
    warnFixture.map((c) => `${c.script}=${c.blocking ? 'blocking' : 'warn'}`),
    ['a-gate.mjs=warn', 'b-gate.mjs=blocking'],
    '`|| true` 分流判据漂移:warn 档被读成 blocking 等于替钩子加戏,反之等于漏判',
  )
})

test('⑥ 正例:commit-msg 阶段的红以同一退出码复现 ⇒ ours,不得 --no-verify', () => {
  const v = ATTR.decideWithCommitMsgStage({
    verdict: INCIDENT_VERDICT,
    hookText: commitMsgHook,
    runCheck: (script) =>
      script === SCOPE_SCRIPT
        ? { ran: true, status: 1, output: SCOPE_RED, why: null }
        : { ran: true, status: 0, output: '', why: null },
  })
  assert.equal(v.kind, 'mine', '同一退出码复现却仍判 not-ours ⇒ --no-verify 会再跳掉这道门')
  assert.equal(v.commitMsgStage.state, 'red')
  assert.match(v.reason, /check-commit-scope-consistency\.mjs/, '结论必须点名是哪个脚本')
  assert.match(v.reason, /禁止 --no-verify/)
  // "原样回显":脚本自己点名的那一行必须出现在明细里,只写"有红"等于让人去翻日志
  assert.ok(v.detail.join('\n').includes('规则 R3'), '明细没回显脚本点名的内容')
  assert.match(ATTR.verdictLine(v), /^❌/)
  // 接线:mine 出口(exit 1)必须排在 --no-verify 重试之前
  const mineAt = src.indexOf("if (verdict.kind === 'mine') {")
  const mineExit = src.indexOf('process.exit(1)', mineAt)
  assert.ok(mineAt > 0 && mineExit > mineAt, 'mine 出口不见了')
  assert.ok(
    mineExit < src.indexOf('commitArgv(true)'),
    'mine 的 exit 1 排到了跳门重试之后 ⇒ 红仍会被 --no-verify 落地',
  )
  // 接线上限:便宜的 commit-msg 复跑必须排在数分钟的自跑批之前(否则每次都要白烧一轮全量)
  assert.ok(
    src.indexOf('decideWithCommitMsgStage({') < src.indexOf('decideWithSelfRunBatch({'),
    'commit-msg 复跑排到了自跑守门批之后 ⇒ 正例要多烧一轮全量批才拿到同一结论',
  )
})

test('⑦ 反例:commit-msg 阶段全绿 ⇒ 既有 not-ours 路径原样保留(别把这档搞死)', () => {
  const v = ATTR.decideWithCommitMsgStage({
    verdict: INCIDENT_VERDICT,
    hookText: commitMsgHook,
    runCheck: () => ({ ran: true, status: 0, output: '', why: null }),
  })
  assert.equal(v.kind, 'not-ours', '全绿却把 non-ours 改成别的档 ⇒ 合法跳门被堵死(§12e 型伤害)')
  assert.equal(v.commitMsgStage.state, 'green')
  assert.equal(v.ranFullBatch, true, '既有字段不得被本层改写')
  assert.equal(v.reason, INCIDENT_VERDICT.reason, '既有归因措辞不得被本层重写')
  assert.ok(
    v.detail.some((l) => /commit-msg 阶段复跑为绿/.test(l)),
    '绿也要留读数 —— 否则事后账面上看不出这一阶段被复跑过',
  )
})

test('⑧ 取不到输入 ⇒ 未判定(绝不猜成 not-ours),且 safe-commit 必须 exit 2', () => {
  const cases = [
    ['钩子读不到', { hookText: null, hookWhy: 'EACCES' }],
    ['解析出 0 条', { hookText: '# 这个钩子什么也没调用\n' }],
    ['复跑出口缺失', { hookText: commitMsgHook, runCheck: null }],
    [
      'blocking 检查跑不动',
      {
        hookText: commitMsgHook,
        runCheck: () => ({ ran: false, status: null, output: '', why: 'spawn EBUSY' }),
      },
    ],
  ]
  for (const [name, args] of cases) {
    const v = ATTR.decideWithCommitMsgStage({ verdict: INCIDENT_VERDICT, ...args })
    assert.equal(v.kind, 'undetermined-red', `${name} 必须落未判定,实得 ${v.kind}`)
    assert.equal(v.commitMsgStage.state, 'undetermined', `${name} 未判定档没标出来`)
    assert.equal(v.undeterminedName, ATTR.COMMIT_MSG_UNDETERMINED_NAME)
  }
  // 接线:未判定那一档必须当场 exit 2,且那一段里不许出现跳门
  const at = src.indexOf("verdict.commitMsgStage?.state === 'undetermined'")
  assert.ok(at > 0, '未判定档在 safe-commit 里没有落点 ⇒ 取不到输入会被静默当成 not-ours')
  const exitAt = src.indexOf('process.exit(2)', at)
  assert.ok(exitAt > at, '未判定档没有 exit 2')
  assert.doesNotMatch(src.slice(at, exitAt), /--no-verify/, '未判定档里出现了跳门出口')
})

test('⑨ 变异自证:摘掉「commit-msg 阶段复跑」那几行 ⇒ ⑥ 的正例翻红', async () => {
  const libPath = join(here, '..', 'lib', 'commit-gate-attribution.mjs')
  const original = readFileSync(libPath, 'utf8')
  // 变异锚点 = 真正把复跑结果接进判据的那一行;锚点漂了本节就失效,必须同步改锚点而不是删本节
  const anchor = 'const results = rerunCommitMsgChecks(checks, runCheck)'
  assert.ok(original.includes(anchor), '变异锚点漂了(复跑调用改了形状)')
  const dir = mkScratch('attr-commit-msg-mutation-')
  try {
    const file = join(dir, 'mutated-attribution.mjs')
    writeFileSync(file, original.replace(anchor, 'const results = []'), 'utf8')
    const mutated = await import(pathToFileURL(file).href)
    const v = mutated.decideWithCommitMsgStage({
      verdict: INCIDENT_VERDICT,
      hookText: commitMsgHook,
      runCheck: () => ({ ran: true, status: 1, output: SCOPE_RED, why: null }),
    })
    assert.notEqual(
      v.kind,
      'mine',
      '摘掉复跑后仍判 mine ⇒ ⑥ 断言的不是"复跑那几行"在起作用,这一档等于没钉',
    )
    // 对照:同一夹具在**未变异**的模块上必须判 mine(否则本节只是自说自话)
    const live = ATTR.decideWithCommitMsgStage({
      verdict: INCIDENT_VERDICT,
      hookText: commitMsgHook,
      runCheck: () => ({ ran: true, status: 1, output: SCOPE_RED, why: null }),
    })
    assert.equal(live.kind, 'mine')
  } finally {
    rmScratch(dir)
  }
})
// ── ⑩–⑫ commit-msg 阶段复跑**读哪一面索引**(2026-11-05 立,§12e 恒红门)────────────
// 事故形态(2026-11-05 19:09:59 实测,`.ihui-agent/state/hook-logs/commit-msg-scope.log` 末两行):
//   `==== … :: scripts/check-commit-scope-consistency.mjs .git/COMMIT_EDITMSG ====`
//   `⏭  commit scope 一致性检查(4 文件, 无 scope, 1 端, 通过)`
// safe-commit 的 Step 3h 把本枚提交交给 `GIT_INDEX_FILE=<私有索引>`(= 生效索引 ∖ 外来件),
// 钩子因此**只在私有索引那一面**看到 4 条声明路径。而归因层的复跑用 `env: process.env`
// (父进程没有那枚指针)⇒ 落到**共享索引**那一面(当时挂着 129 条外来件,含 packages/i18n/messages/ 族)
// ⇒ R2 复现"红" ⇒ 定责本枚 ⇒ 拒绝提交并回滚,两枚已建好的 commit 变孤儿。
// 这正是 AGENTS §12e 定义的恒红门:一道与本次提交内容无关的红。
//
// 修法取**甲案**(复跑必须读钩子当时看到的那一面),不取乙案(解析 hook-logs 里那行结论):
// 那本日志与 `.git/COMMIT_EDITMSG` 同属**共享可变态**(多会话随时改写),①里已经为同一型错误
// 拒绝过一次;把归因建在别人会写的行上 = 造第二份输入面,红了不知道是谁的、绿了也不知道。
//
// 三节成对:⑩ 纯判据四态 / ⑪ 真 git + 真 scope 门的行为对照(私有面绿、共享面红) / ⑫ 装车形状锁。
const FACE = ATTR.COMMIT_MSG_FACE
const SCOPE_GATE = join(here, '..', 'check-commit-scope-consistency.mjs')
/** 声明集:4 枚 web 文件;外来件:5 枚 packages/i18n/messages/ —— 与实测那枚的领域分布同型 */
const DECLARED = ['apps/web/a.tsx', 'apps/web/b.tsx', 'apps/web/c.tsx', 'apps/web/d.tsx']
const FOREIGN = [
  'packages/i18n/messages/en.json',
  'packages/i18n/messages/ja.json',
  'packages/i18n/messages/ko.json',
  'packages/i18n/messages/zh-cn.json',
  'packages/i18n/messages/zh-tw.json',
]

function fixtureGit(dir, args, env = {}) {
  const r = spawnSync('git', ['-c', 'safe.directory=*', '-C', dir, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...env },
  })
  assert.equal(r.status, 0, `git ${args.join(' ')} 失败:\n${r.stdout}\n${r.stderr}`)
  return String(r.stdout ?? '')
}

test('⑩ 索引面判据四态:私有面在位且仍是那一面⇒用它;面变了/取不到⇒未判定;本无私有面⇒同共享面', () => {
  const D = ['apps/web/a.tsx', 'apps/web/b.tsx', 'apps/web/c.tsx', 'apps/web/d.tsx']
  const IDX = 'D:/DevEnv/Temp/fixture/index'
  // 甲案正例:钩子拿到私有索引,且该面的暂存集逐条等于声明集 ⇒ 复跑必须落在这一面
  const ok = ATTR.decideCommitMsgStageIndexFace({
    hookIndexFile: IDX,
    indexExists: true,
    stagedFiles: D,
    declaredFiles: D,
  })
  assert.equal(ok.use, FACE.PRIVATE, `私有面在位却没用 ⇒ ${JSON.stringify(ok)}`)
  assert.equal(ok.indexFile, IDX, '必须把**那一面**的路径交回调用方,不能只说"用私有面"')
  assert.equal(ok.why, null)
  // 反例①:本枚没有私有索引(共享索引里没有外来件)⇒ 钩子读的就是默认索引,
  // 复跑原样继承 process.env 即**同一面** —— 这一档不是"回落到共享索引"。
  const noPrivate = ATTR.decideCommitMsgStageIndexFace({
    hookIndexFile: null,
    indexExists: null,
    stagedFiles: null,
    declaredFiles: D,
  })
  assert.equal(noPrivate.use, FACE.DEFAULT)
  assert.equal(
    ATTR.decideCommitMsgStageIndexFace({ hookIndexFile: '   ', declaredFiles: D }).use,
    FACE.DEFAULT,
    '空白指针不得被读成"有一面私有索引"⇒ 未判定空转',
  )
  // 未判定档:输入取不到 / 面已不是钩子当时那一面 —— 一律未判定,**绝不回落共享索引**
  const cases = [
    ['私有索引不在位', { indexExists: false }],
    ['存在性取不到', { indexExists: null }],
    ['暂存面取不到', { indexExists: true, stagedFiles: null }],
    ['暂存面形状坏', { indexExists: true, stagedFiles: 'not-an-array' }],
    ['声明集取不到', { indexExists: true, stagedFiles: D, declaredFiles: null }],
    ['这一面已不含声明集', { indexExists: true, stagedFiles: D.slice(0, 3), declaredFiles: D }],
    [
      '这一面多出来自共享索引的外来件',
      { indexExists: true, stagedFiles: [...D, FOREIGN[0]], declaredFiles: D },
    ],
  ]
  for (const [name, args] of cases) {
    const v = ATTR.decideCommitMsgStageIndexFace({
      hookIndexFile: IDX,
      indexExists: true,
      stagedFiles: D,
      declaredFiles: D,
      ...args,
    })
    assert.equal(v.use, FACE.UNDETERMINED, `${name} 必须落未判定,实得 ${v.use}`)
    assert.ok(String(v.why || '').length > 0, `${name} 未判定必须点名原因(§0.3)`)
    assert.ok(v.why.includes(IDX), `${name} 原因必须点名是哪一面:${v.why}`)
  }
  // 反斜杠形态不得被当成"另一面"(Windows 实测:git 输出正斜杠、声明集可能带反斜杠)
  assert.equal(
    ATTR.decideCommitMsgStageIndexFace({
      hookIndexFile: IDX,
      indexExists: true,
      stagedFiles: D.map((p) => p.replace(/\//g, '\\')),
      declaredFiles: D,
    }).use,
    FACE.PRIVATE,
    '同一面的两种路径写法被判成"面变了"⇒ 每次复跑都落未判定,恒堵门(§12e 反型)',
  )
  // 未判定必须一路传到归因结论:runCheck 给 ran:false ⇒ kind=undetermined-red,且不是 not-ours
  const v = ATTR.decideWithCommitMsgStage({
    verdict: INCIDENT_VERDICT,
    hookText: commitMsgHook,
    runCheck: () => ({
      ran: false,
      status: null,
      output: '',
      why: '复跑索引面未判定:私有索引不在位',
    }),
  })
  assert.equal(v.kind, 'undetermined-red', '索引面取不到却被写成"与本次无关"= 把没判当判过(§0.3)')
  assert.equal(v.undeterminedName, ATTR.COMMIT_MSG_UNDETERMINED_NAME)
})

test('⑪ 端到端(真 git + 真 scope 门):判据选到的那一面复跑必须绿;共享索引面确实红(假红来源)', () => {
  const dir = mkScratch('commit-msg-face-')
  try {
    const repo = join(dir, 'repo')
    mkdirSync(repo, { recursive: true })
    fixtureGit(repo, ['init', '-q'])
    fixtureGit(repo, ['config', 'user.name', 'fixture'])
    fixtureGit(repo, ['config', 'user.email', 'fixture@example.invalid'])
    for (const f of [...DECLARED, ...FOREIGN]) {
      const abs = join(repo, ...f.split('/'))
      mkdirSync(dirname(abs), { recursive: true })
      writeFileSync(abs, `${f} base\n`, 'utf8')
    }
    fixtureGit(repo, ['add', '-A'])
    fixtureGit(repo, ['commit', '-qm', 'chore: fixture base'])

    // 共享索引:本枚声明集 + 别人挂着的外来件(实测那枚 = 129 条,这里取其领域签名)
    for (const f of [...DECLARED, ...FOREIGN]) {
      writeFileSync(join(repo, ...f.split('/')), `${f} staged\n`, 'utf8')
    }
    fixtureGit(repo, ['add', '--', ...DECLARED, ...FOREIGN])
    assert.deepEqual(
      fixtureGit(repo, ['diff', '--cached', '--name-only', '--no-renames']).trim().split(/\r?\n/),
      [...DECLARED, ...FOREIGN].sort(),
      '夹具前提不成立:共享索引面应当同时含声明集与外来件',
    )

    // 私有索引(Step 3h 同款三步:拷生效索引 → 在拷贝上把外来件退回 HEAD → 用指针发令)
    const privateIdx = join(dir, 'private-index')
    copyFileSync(join(repo, '.git', 'index'), privateIdx)
    fixtureGit(repo, ['reset', '-q', '--', ...FOREIGN], { GIT_INDEX_FILE: privateIdx })
    const privateFace = fixtureGit(repo, ['diff', '--cached', '--name-only', '--no-renames'], {
      GIT_INDEX_FILE: privateIdx,
    })
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
    assert.deepEqual(privateFace, DECLARED, '私有索引自证:暂存面必须恰等于声明集')

    const msgFile = join(dir, 'msg.txt')
    writeFileSync(msgFile, 'fix(web): fixture 措辞对账\n', 'utf8')
    const runGate = (env) => {
      const e = { ...process.env }
      delete e.GIT_INDEX_FILE
      if (env) e.GIT_INDEX_FILE = env
      const r = spawnSync(process.execPath, [SCOPE_GATE, msgFile], {
        cwd: repo,
        env: e,
        encoding: 'utf8',
        windowsHide: true,
        timeout: 120000,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      return { status: r.status, out: `${r.stdout || ''}${r.stderr || ''}` }
    }

    // 缺陷的**来源面**:共享索引(含 5 枚 i18n)上复跑同一道门 ⇒ R2 判红。
    // 这一行同时是本节的敏感性证明:换成错面,下面的正例断言必然翻红。
    const wrongFace = runGate(null)
    assert.equal(wrongFace.status, 1, `错面(共享索引)本就该红,夹具失效了:\n${wrongFace.out}`)
    assert.match(wrongFace.out, /R2/, wrongFace.out)

    // 钩子当时看到的面 ⇒ 绿(实测日志原文「4 文件 … 通过」)
    const hookFace = runGate(privateIdx)
    assert.equal(hookFace.status, 0, `钩子那一轮的面必须复现绿:\n${hookFace.out}`)

    // 归因层拿判据自己选面(判据 import 源模块,测试不复制实现 §22c),选出来的面复跑必须绿
    const decided = ATTR.decideCommitMsgStageIndexFace({
      hookIndexFile: privateIdx,
      indexExists: existsSync(privateIdx),
      stagedFiles: privateFace,
      declaredFiles: DECLARED,
    })
    assert.equal(decided.use, FACE.PRIVATE, `判据没选到私有面 ⇒ ${JSON.stringify(decided)}`)
    const attributed = runGate(decided.indexFile)
    assert.equal(
      attributed.status,
      0,
      `按判据选出的面复跑仍红 ⇒ 归因会把钩子里根本没发生的红定责给本枚(§12e 恒红门):\n${attributed.out}`,
    )

    // 正例接线面:把这一面喂给 commit-msg 阶段判据,整条归因必须落绿并保持 not-ours
    const v = ATTR.decideWithCommitMsgStage({
      verdict: INCIDENT_VERDICT,
      hookText: commitMsgHook,
      runCheck: () => ({
        ran: true,
        status: attributed.status,
        output: attributed.out,
        why: null,
      }),
    })
    assert.equal(v.kind, 'not-ours', '钩子面复跑为绿却被判成 mine ⇒ 又是一次"多拦一次"')
    assert.equal(v.commitMsgStage.state, 'green')
  } finally {
    rmScratch(dir, { bestEffort: true })
  }
})

test('⑫ 装车形状锁:复跑派生的 env 必须由索引面判据给出,未判定⇒ran:false,且不得改读钩子日志', () => {
  const at = src.indexOf('const runCommitMsgCheck = (script) =>')
  assert.ok(at > 0, 'runCommitMsgCheck 不见了 ⇒ commit-msg 阶段复跑没有落点(守门 89 R1/R2 同型)')
  const body = src.slice(at, src.indexOf('\n  }\n', at) + 4)
  assert.match(
    body,
    /ensureCommitMsgFace\(\)/,
    '派生前没问索引面判据 ⇒ 又回到"默认拿共享索引"那一型(2026-11-05 事故)',
  )
  assert.match(body, /env:\s*faceEnv/, '复跑派生的 env 必须逐字来自索引面判据,不得另拼一份')
  assert.match(
    body,
    /COMMIT_MSG_FACE\.UNDETERMINED[\s\S]{0,240}ran:\s*false/,
    '索引面未判定必须落 ran:false(由 lib 折算成未判定),不得继续派生',
  )
  // 乙案的通道必须堵死:钩子日志是共享可变态,别人的提交随时改写它(见本节头注)
  assert.doesNotMatch(body, /hook-logs/, '复跑改读钩子日志 ⇒ 用别人写的结论行给自己定责')
  // 判据必须真被 import(抄一份进 safe-commit 就是第二份真相,§0.6/§22c)
  assert.match(
    src,
    /import\s*\{[^}]*decideCommitMsgStageIndexFace[^}]*\}\s*from\s*'\.\/lib\/commit-gate-attribution\.mjs'/s,
    '索引面判据没从 lib import ⇒ 判据住两份,改一处静默失联',
  )
  // 判据的输入必须来自**本枚**交给钩子的那枚私有索引(Step 3h 的 commitIndexFile)
  const faceAt = src.indexOf('const ensureCommitMsgFace = () =>')
  assert.ok(faceAt > 0, '索引面取值出口不见了')
  const faceBody = src.slice(faceAt, src.indexOf('\n  }\n', faceAt) + 4)
  assert.match(faceBody, /commitIndexFile/, '没把 Step 3h 的私有索引当输入 ⇒ 判据永远看到共享面')
  assert.match(
    faceBody,
    /readStagedInIndexFile/,
    '面变了没有输入可比 ⇒ 只能猜,猜就是"把没判写成判过"',
  )
  assert.doesNotMatch(
    faceBody,
    /delete\s+e\.GIT_INDEX_FILE/,
    '这一档绝不许剥掉指针(剥掉即回落共享面)',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
