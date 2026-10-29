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
import { readFileSync, writeFileSync } from 'node:fs'
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
  assert.equal(viaArgv.length, 2, `走 commitArgv 的发令点应恰为 2(首次 + 跳门重试),实得 ${viaArgv.length}`)
  // 定义体里那一次 commitArgs(skipHooks) 不算发令点:发令点必须只写 commitArgv
  const bare = [...src.matchAll(/commitArgs\((?:false|true)\)/g)]
  assert.equal(bare.length, 0, '存在绕过 commitArgv 直接 commitArgs 的发令点 ⇒ 身份会漏')
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
  assert.equal(style.blocking, false, '带 `|| true` 的那条是 warn 档;判 blocking 等于替钩子改语义')
  // 阴性:注释里出现的路径不是"钩子调用",拿它去复跑就是造一个没人跑过的检查
  assert.deepEqual(ATTR.parseCommitMsgStageChecks('# node scripts/foo.mjs\n'), [])
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

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
