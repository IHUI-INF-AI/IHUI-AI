#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 纯判据模块,--self-test 出口需要打印结论 */
/**
 * push-attempt-triage.mjs — 把「一趟 `git push` 的结果」分诊成可执行结论的纯函数
 *
 * 立因(2026-09-26,`deploy/win/deploy-loop.log` + `.workbuddy/git-push-guard-async.log` 实测):
 *   `scripts/git-push-guard.mjs` 的"首次 push 失败"分支把**任何** exit 1 当成"pre-push hook 阻塞",
 *   随后按 §12「hook 失败因其他 agent 代码 → --no-verify」再推一趟。而
 *   `! [rejected] main -> main (non-fast-forward)` 是**远端拒收**,与质量门毫无关系:
 *   本机是多会话并发仓,分叉是常态 ⇒ 每次分叉都必然走一次跳门推送,
 *   §5b「⚡ 推送异步化」里"pre-push 质量门不降级"这句在这一型下从来没成立。
 *   第二个错叠在上面:重试输出是 `Everything up-to-date`(什么都没推)时,报告仍打
 *   `✅ push 成功 + 验证通过` ⇒ 收尾核验(git-push-converge / AGENTS §20 的交付证据)拿到一张
 *   不该有的合格证。
 *
 * 为什么住在 `scripts/lib/` 而不是 `git-push-guard.mjs` 里 export:
 *   该文件顶层**就是** CLI 主体(没有 §22d 的 `isDirectRun` 守卫 —— 它的 950 行全是顶层语句,
 *   补那道守卫等于重写整个文件)。测试若 `import` 它,就会在测试进程里真跑一趟推送。
 *   本仓对此型已有既定出口:`merge-live-doc.mjs` 的相似度判据就是因为同一原因被抽成
 *   `lib/live-doc-similarity.mjs`(AGENTS §22c 末条记的"测试只能把脚本 spawn 起来验"那一格)。
 *   ⇒ 判据在这里,装车在 guard 里,两侧都由 `scripts/tests/git-push-guard.test.mjs` 钉住
 *      (含一条"分诊函数被摘线/不调用"的反向锁 —— 本仓最高频失效型:函数在、判据过、主流程没用它)。
 *
 * 判据取向(本仓惯例:**宁窄不误**):认不出的一律落 `other`,而 `other` 的行为与改动前
 *   逐字相同(marker 重试 + --no-verify 兜底)。新增分类只会**减少**跳门,绝不因为
 *   "分类不确定"把一次真钩子失败洗成不跳门,也绝不反过来。
 *   (2026-09-27 补:`credentials-unavailable` 是唯一的**不减少跳门**的新增档 —— 它的
 *   allow* 与 other 完全相同,只换取"分类名 + 出路文案"更准;当时的 --no-verify 重试
 *   对凭据断点无害也无用,行为不变是为了不动 §5b push-gate 链,出路文案负责教人对因。)
 *
 * 2026-09-28 补第三档(`remote-ref-race`)的立因 —— 同一型误判当天实测两次(05:23Z / 06:2xZ):
 *   管理员凭据直推被 GitHub **放行**时,远端会先打一句信息行
 *     `remote: Bypassed rule violations for refs/heads/main:`
 *     `remote: - Required status check "CI / lint-typecheck-test (push)" is expected.`
 *   这是"旁路成功"的通知,不是拒绝;真正把这一趟打死的是它下面那句
 *     ` ! [remote rejected] main -> main (cannot lock ref 'refs/heads/main': is at <A> but expected <B>)`
 *   —— 含义是**别的会话在同一秒推了**(远端 ref 前移 ⇒ CAS 失败),与分支保护无关。
 *   旧判序里 `Required status check` 先命中,于是给用户/agent 的出路写成"改 GitHub 设置 / 走 PR,
 *   别跑收敛器"——方向完全反了(正解是先取网络真值再重推一次;第二次实测窗口内直推即成功)。
 *   ⇒ **竞态必须排在策略之前**:两档的出路是相反的,合并或错序就等于把人引到死路上。
 */
import { pathToFileURL } from 'node:url'

/** 分类封闭集(镜像测试按它逐条造输入,不得出现集合外的 kind)。 */
export const PUSH_TRIAGE_KINDS = Object.freeze([
  'pushed-ok',
  'up-to-date',
  'remote-ref-race',
  'protected-branch',
  'non-fast-forward',
  'secret-scan-blocked',
  'credentials-unavailable',
  'hook-failed',
  'other',
])

/** 唯一指向性出路(§5b「🔄 主动收敛」规定的入口;本模块不跑它,只报出来)。 */
export const CONVERGE_COMMAND = 'node scripts/git-sync-converge.mjs'

/**
 * 竞态档的**第一步**出路:先取网络真值,再判几何关系 —— 两半的结论指向两条相反的出路,
 * 所以出路必须写成"先问这个问题",而不是直接叫人跑收敛器(那是祖先不成立时才对的动作)。
 * 2026-09-28 实测:第一次被误判挡住没跑这两步,第二次在同一窗口直推成功。
 */
export const RACE_RECHECK_COMMAND =
  'git ls-remote origin refs/heads/main && git merge-base --is-ancestor <远端tip> HEAD'

/** 什么都没推的两种回显(远端 tip 已含本次要推的内容)。 */
export const UP_TO_DATE_RE = /everything up-to-date|\[up to date\]/i

/**
 * 服务器侧 push protection 拒收。特征串逐字沿用 guard 原先内联的那一条
 * (2026-09-24 实测:整条 main 被"计划正文里引用的占位串"卡死时,报错原文只有
 * `repository rule violations`)—— 抽到这里后 guard 与分诊共用一份,禁止再抄第二份。
 */
export const SECRET_SCAN_RE =
  /repository rule violations|secret-scanning|Secret scanning|push declined due to/i

/**
 * 远端 ref **竞态**(git 自己的 CAS 锁失败:远端 ref 在这一趟期间前移了)。
 * 特征串逐字取自 2026-09-28 两次实测的 git 原话:
 *   ` ! [remote rejected] main -> main (cannot lock ref 'refs/heads/main': is at <A> but expected <B>)`
 *   ` ! [rejected] main -> main (stale info)`
 * 两串说的是同一件事:**本地拿到的远端值已经过期**,与"谁的质量门""谁的仓库设置"都无关。
 * `stale info` 此前挂在 NON_FAST_FORWARD_RE 里(2026-09-28 移出):它是竞态而不是分叉 ——
 * 判成分叉会让人去跑收敛器(3 轮 × 全量门 ≈ 15 分钟),而正解只是"重取真值再推一次"。
 * ⚠ 判序上必须**先于** PROTECTED_BRANCH_RE:管理员旁路成功时 GitHub 照打
 *   `Bypassed rule violations` + `Required status check … is expected` 两行信息,
 *   而拒收原因是 cannot lock ref —— 按策略档判就会给出完全相反的出路(本次修复的全部理由)。
 */
export const REMOTE_REF_RACE_RE = /cannot lock ref|stale info/i

/**
 * GitHub 的**旁路通知**(不是拒绝):受保护分支被 admin/凭据有权者推过去时打这一行。
 * 本模块只用它来留证与造夹具(§22c:夹具必须用被审面的真实原文),真正的分档由
 * REMOTE_REF_RACE_RE / PROTECTED_BRANCH_RE 决定 —— 看到这一行就把推送判成失败,
 * 与"看到 Required status check 就判策略拒收"是同一条错误。
 */
export const RULE_BYPASS_NOTICE_RE = /bypassed rule violations/i

/**
 * 远端**分支保护策略**拒收(2026-09-27 17:1x 起本机实测,成因不是并发也不是质量门):
 *   `remote: error: GH006: Protected branch update failed for refs/heads.main.`
 *   `remote: - Required status check "CI / lint-typecheck-test (pull_request)" is expected.`
 *   `! [remote rejected]       main -> main (protected branch hook declined)`
 * ⚠ 这一档**必须排在 non-fast-forward 之前**:同一份回显里带着 `[remote rejected]`,
 *   而 `NON_FAST_FORWARD_RE` 认这个特征 ⇒ 旧分诊把它报成"并发分叉",
 *   于是每个会话照着出路去跑 `git-sync-converge.mjs`(实测 3 轮 × 每轮全量门,约 15 分钟白跑),
 *   而收敛器**结构上修不了一个仓库设置**。分诊错一档的代价不是措辞,是把人引到一条死路上反复跑。
 * ⚠ 但它**又必须排在 remote-ref-race 之后**(2026-09-28):旁路成功的通知里同样出现
 *   `Required status check`,而那一趟真正的死因是 ref 锁竞态 ⇒ 两档不得互相顶结论。
 * 判据只用服务器侧的原话特征(GH006 / protected branch / Required status check),
 * 不含 `[remote rejected]` —— 那一串在真分叉与钩子失败里都会出现,拿它当分支保护证据就是又一轮误标。
 */
export const PROTECTED_BRANCH_RE =
  /GH006|protected branch update failed|protected branch hook declined|Required status check|branch is protected|rulesets?\b.*prevent/i

/**
 * 远端拒收 non-fast-forward。git 的真实形态有两处:短横线式 `* [rejected]` 摘要行
 * 与 `hint: Updates were rejected because ...`;`fetch first` 是 GitLab/GitHub 侧常见回显。
 * 刻意不含 `error: failed to push some refs` —— 钩子失败时 git 打的是同一句,拿它当
 * 分叉证据就是把跳门换了个理由。
 * 2026-09-28:`stale info` 已移出本式,归 remote-ref-race 档(那是"CAS 没抢到",
 * 不是"两边各走各的");其余四个特征一字未动 ⇒ 既有 non-fast-forward 语义完整保留。
 */
export const NON_FAST_FORWARD_RE =
  /non-fast-forward|fetch first|updates were rejected|\[rejected\]|\[remote rejected\]/i

/**
 * 凭据**不可得**(≠凭据失效 —— 根本没拿到,而不是拿到了被拒)。特征串逐字取自
 * `.workbuddy/git-push-guard-async.log` 的真实回显(2026-09-27 实测 60 条同型):
 *   · `could not read Username|Password for '<url>'` —— 所有 helper 都没交出凭据、
 *     git 回落交互提示后失败(有无 tty / GIT_TERMINAL_PROMPT 取值决定尾串形态);
 *   · `failed to execute prompt script` —— 提示脚本本身跑不动(同一断点的另一形态)。
 * 成因形态:失败发起进程的身份(典型 = LocalSystem 服务派生的 worker)读不到
 * Administrator 的 wincred 库与家目录 store。
 */
export const CREDENTIALS_UNAVAILABLE_RE =
  /could not read (?:Username|Password) for|failed to execute prompt script/i

/**
 * 钩子痕迹:只有能**从输出里解析到**守门批的失败汇总或钩子脚本自身的报错,才算 hook-failed。
 * 每条模式串都逐字取自真实产出者(`.husky/pre-push` 与 `scripts/guardian-runner.mjs`):
 *   · `道 blocking 门失败` / `单独复现:node scripts/` ← guardian-runner 末尾失败清单(:3873/:3877)
 *   · `push 门校验失败` / `push 门被中断`            ← .husky/pre-push(:95/:101)
 *   · `守门脚本批量检查汇总`                        ← printSummary(:3746)
 *   · `Cannot find module`                          ← 钩子脚本被动过的现场(§12e/守门 78 那一型)
 * 刻意**不**匹配 `error: failed to push some refs`(与分叉同形,见上)。
 */
export const HOOK_TRACE_RE =
  /道 blocking 门失败|push 门校验失败|push 门被中断|守门脚本批量检查汇总|单独复现:node scripts\/|Cannot find module|pre-push hook/i

/**
 * 一趟 push 的分诊结果。
 * @typedef {Object} PushAttemptVerdict
 * @property {typeof PUSH_TRIAGE_KINDS[number]} kind      分类
 * @property {boolean}        failed            该趟是否非零退出
 * @property {boolean}        pushedNothing     什么都没推(up-to-date)
 * @property {boolean}        allowHookRetry    是否允许"带 hook 重试"(exit 75 中断链)
 * @property {boolean}        allowNoVerifyRetry是否允许 --no-verify 兜底
 * @property {'done'|'failed'|'diverged'|null} terminalStatus push-state 该写的终态(null=继续流程)
 * @property {string|null}    nextCommand       指向性出路
 * @property {string}         why               一句话依据(报告里原样打印,便于复核分诊对不对)
 */

function verdict(v) {
  return {
    kind: 'other',
    failed: true,
    pushedNothing: false,
    allowHookRetry: true,
    allowNoVerifyRetry: true,
    terminalStatus: null,
    nextCommand: null,
    why: '输出里没有可辨认的失败特征 ⇒ 判 other(保持改动前行为)',
    ...v,
  }
}

/**
 * 分诊一趟 push。
 * @param {{status?: number|null, stdout?: string|nil, stderr?: string|nil,
 *          remoteEqualsLocal?: boolean|null,
 *          pushedShaContainedInRemote?: boolean|null}} attempt push 的原始结果 +
 *   (仅 up-to-date 档用到)验证段的两个证据:
 *   - remoteEqualsLocal:此刻 local HEAD 与远端 tip 是否**逐字相等**;
 *   - pushedShaContainedInRemote:**本次要推的那枚 sha** 是否已被远端 tip 包含(祖先测)。
 *   两者任一为 null = 没验到,按"未判定"处理 —— 未判定**不等于**成功。
 *
 * 为什么要第二条:多会话共享同一个 gitdir,`git rev-parse HEAD` 在推送与验证之间会被别人
 * 的 commit 推进,于是"等值"这一把尺子在**推送完全成功**的一趟上也能读出 false(实测把
 * `8dbacd2322..61f6fdc9d0 main -> main` 报成"push 报告成功但验证失败")。等值问的是
 * "此刻两台是否同一枚",而本判据要问的是"我推的东西到没到"—— 后者只有祖先测答得上。
 * @returns {PushAttemptVerdict}
 */
export function triagePushAttempt({
  status = null,
  stdout = '',
  stderr = '',
  remoteEqualsLocal = null,
  pushedShaContainedInRemote = null,
} = {}) {
  const text = `${stdout ?? ''}\n${stderr ?? ''}`
  const failed = status !== 0

  // ── 成功侧 ──
  if (!failed) {
    if (UP_TO_DATE_RE.test(text)) {
      // 「什么都没推」与「推成了」必须分档:要有**一份**能证明"本地那枚已在远端"的证据才配得上 done ——
      // 等值(两台同一枚)或祖先测(远端 tip 已包含它)任一成立即可,两者都没拿到就是未判定。
      const contained = pushedShaContainedInRemote === true
      const verified = contained || remoteEqualsLocal === true
      return verdict({
        kind: 'up-to-date',
        failed: false,
        pushedNothing: true,
        allowHookRetry: false,
        allowNoVerifyRetry: false,
        terminalStatus: verified ? 'done' : 'failed',
        why: verified
          ? `本次未推送任何东西:远端 tip 已包含本地(或已由并发推送落地),依据=${
              contained ? '祖先测(我推的那枚已在远端)' : '验证 local==remote'
            }`
          : `本次未推送任何东西(远端回显 Everything up-to-date),而验证${
              remoteEqualsLocal === null && pushedShaContainedInRemote === null
                ? '两把尺子都没拿到(未判定)'
                : '既不等值、祖先测也不成立'
            } ⇒ 不得记成推送成功`,
      })
    }
    return verdict({
      kind: 'pushed-ok',
      failed: false,
      allowHookRetry: false,
      allowNoVerifyRetry: false,
      why: '退出码 0 且非 up-to-date ⇒ 按原流程走验证段',
    })
  }

  // ── 失败侧(顺序即优先级:secret-scan 的 `[rejected]` 形态与分叉同形,必须先判) ──
  // 2026-09-28 的判序更正:**竞态在最前**。理由不是偏好而是"谁说的话更具体":
  //   `cannot lock ref` / `stale info` 是 git 自己对远端 ref 做 CAS 时打的原话,
  //   服务器侧的规则拒收(GH006 / push protection)结构上不会产出这一串;
  //   而反过来,旁路成功的信息行里**必然**出现 `Required status check` ——
  //   把竞态放在策略之后,就等于让每一趟"别人刚推过"的失败都被报成"去改仓库设置"。
  if (REMOTE_REF_RACE_RE.test(text)) {
    return verdict({
      kind: 'remote-ref-race',
      // 与质量门无关:再跑一趟 270s 的门、或 --no-verify 关掉门,都改变不了"远端已前移"
      allowHookRetry: false,
      allowNoVerifyRetry: false,
      // 落 failed(不是 diverged):通道本身是通的,下一步动作是"重取真值再推一次",
      // 而 diverged 会被下游读成"必须收敛、别再推"(check-push-sync 的 diverged 档就是照这个措辞写的)。
      terminalStatus: 'failed',
      nextCommand: RACE_RECHECK_COMMAND,
      why:
        '远端 ref **竞态**(git 原话 cannot lock ref / stale info)⇒ 别的会话在这一秒已推进 refs/heads/' +
        'main,本次 CAS 没抢到。这**不是**分支保护拒收:同一段回显里的 `Bypassed rule violations` + ' +
        '`Required status check … is expected` 是**旁路成功的通知**,不是拒绝 —— 按策略档判会把出路写成' +
        '"改仓库设置 / 走 PR",方向完全反了。出路两步(先问,别先动设置):' +
        `① ${RACE_RECHECK_COMMAND} —— 远端 tip 是本地祖先 ⇒ 本地什么都没丢,直接重推即可(不要动仓库设置、不要跑收敛器);` +
        `② 祖先不成立 ⇒ 才是真分叉,走 ${CONVERGE_COMMAND}`,
    })
  }
  if (SECRET_SCAN_RE.test(text)) {
    return verdict({
      kind: 'secret-scan-blocked',
      // --no-verify 只跳本地钩子,绕不开服务器侧 push protection ⇒ 重试那一趟必然白跑
      allowHookRetry: false,
      allowNoVerifyRetry: false,
      terminalStatus: 'failed',
      why: '远端 push protection 拒收(输出含 repository rule violations / push declined 形态)',
    })
  }
  if (PROTECTED_BRANCH_RE.test(text)) {
    return verdict({
      kind: 'protected-branch',
      // 本地钩子跳不跳都改变不了服务器侧的策略 ⇒ 重试那一趟(含 --no-verify)必然白跑
      allowHookRetry: false,
      allowNoVerifyRetry: false,
      terminalStatus: 'failed',
      // 出路**刻意不指向收敛器**:收敛器修的是"远端已推进",而这里远端根本没动。
      // 先自证不是分叉(本地已含远端 tip),再交机主在仓库侧决定(放开直推 / 或改走 PR)。
      nextCommand:
        'git ls-remote origin refs/heads/main && git merge-base --is-ancestor <远端SHA> HEAD',
      why:
        '远端**分支保护策略**拒收(GH006 / protected branch hook declined / Required status check expected)' +
        ' ⇒ 这不是并发分叉,也不是质量门:本地已包含远端 tip 时快进推送依然被策略挡下。' +
        '收敛器、--no-verify、重试都修不了它,出路只有仓库设置侧(允许直推 / 放宽必需状态检查)或改走 PR —— 属机主职权',
    })
  }
  if (NON_FAST_FORWARD_RE.test(text)) {
    return verdict({
      kind: 'non-fast-forward',
      allowHookRetry: false,
      allowNoVerifyRetry: false,
      terminalStatus: 'diverged',
      nextCommand: CONVERGE_COMMAND,
      why: '远端拒收 non-fast-forward(与质量门无关的并发分叉)',
    })
  }
  if (CREDENTIALS_UNAVAILABLE_RE.test(text)) {
    // 处置动作与出路写在 guard 的失败分支文案里(本判据只负责认出这一型并给问责入口)。
    // ⚠️ allow* 一律沿用 verdict() 默认(与 other 相同)—— 本次修复**只**改分类与出路,
    //    不改重试策略与退出码(§5b push-gate 链依赖 other 档的既有行为逐字不变)。
    return verdict({
      kind: 'credentials-unavailable',
      nextCommand: 'node scripts/check-credential-health.mjs',
      why:
        'git 原话回显 could not read Username/Password / failed to execute prompt script ⇒ ' +
        '发起进程的身份下**没有任何凭据 helper 交出值**(与"凭据已失效被远端拒绝"不同,是未取得)',
    })
  }
  if (UP_TO_DATE_RE.test(text)) {
    // 非零退出却回显"什么都没推":两态矛盾 ⇒ 如实判 up-to-date,但 terminalStatus 走"未判定"分支
    return verdict({
      kind: 'up-to-date',
      pushedNothing: true,
      allowHookRetry: false,
      allowNoVerifyRetry: false,
      terminalStatus: remoteEqualsLocal === true ? 'done' : 'failed',
      why: `退出码 ${status} 非零却回显 up-to-date ⇒ 两态矛盾,按验证结果落终态,不报成功`,
    })
  }
  if (HOOK_TRACE_RE.test(text)) {
    return verdict({
      kind: 'hook-failed',
      why: '输出里解析到守门批/钩子痕迹 ⇒ 走原有"带 hook 重试 → --no-verify 兜底"链(§5b ⑤ 不动)',
    })
  }
  return verdict({
    why: `退出码 ${status} 且无可辨认特征(网络/凭据/分支保护等)⇒ 保持改动前行为`,
  })
}

/**
 * 把分诊结果落成人话(报告与日志共用一份措辞,避免两处各写各的)。
 * @param {PushAttemptVerdict} v
 * @returns {string}
 */
export function describeVerdict(v) {
  const parts = [`分诊=${v.kind}`, v.why]
  if (v.nextCommand) parts.push(`出路: ${v.nextCommand}`)
  return parts.join(' — ')
}

/** push-state 读数被视为"当下量的"的窗口(与 guard 的 PUSH_STATE_STALE_MS 同值,5min)。 */
export const PUSH_STATE_FRESH_MS = 5 * 60 * 1000

/** 年龄串:小时档必须有(s/min 两个量级会把"四小时前的残留"印成"213min",
 *  读的人看不出那是隔夜的东西)。**不**与 check-push-sync 的 ageText 共用:那一处是
 *  门禁放行文案(只看是否 <5min,量级用不到小时),本处是**读数出处**陈述,消费面不同;
 *  两处若哪天要合并,先合的是判据而不是文案。 */
function ageTextAbs(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '未知时长'
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.round(s / 60)}min`
  const h = Math.floor(s / 3600)
  const m = Math.round((s % 3600) / 60)
  return m > 0 ? `${h}h${m}min` : `${h}h`
}

/** SHA 归一比较(记录里存的是全 sha,调用方手里的可能是缩写;大小写不敏感)。 */
function sameSha(a, b) {
  const norm = (x) => (typeof x === 'string' ? x.trim().toLowerCase() : '')
  const la = norm(a)
  const lb = norm(b)
  if (!la || !lb) return false
  if (la === lb) return true
  const shorter = la.length <= lb.length ? la : lb
  const longer = la.length <= lb.length ? lb : la
  return shorter.length >= 7 && longer.startsWith(shorter)
}

/**
 * 一条 `.workbuddy/push-state.json` 读数**相对当前 HEAD** 的出处判定 —— 纯函数,零副作用。
 *
 * 立因(2026-09-28):`git-push-converge.mjs` 报 `PUSH_FAILED` / `SKIP` / `DIVERGED` 时,
 * 依据的是状态文件里**几小时前**的那条记录(`headSha` 还停在更早的提交),而它自己
 * 那一刻并没有现推。账面读起来却像"当下量的故障"—— 与 AGENTS 反复登记的"把没判写成
 * 判过了""历史读数冒充本次结论"是同一条失真。本出口把三件事一次说清:
 *   ① 记录**关于哪枚提交**(headSha 是否等于当前 HEAD);
 *   ② **多旧**(带小时档);
 *   ③ 由此得到的定性:当下依据 / 历史残留(未现推) / 无读数 / 形状不可判。
 * 措辞由 `text` 单点产出,调用方**不得**再自己拼一份(两处算同一件事必漂移)。
 *
 * @param {{pushState?: {status?: string, headSha?: string, ts?: number}|null,
 *          localHead?: string, now?: number, freshMs?: number}}
 * @returns {{state:'current'|'stale-record'|'absent'|'malformed', isCurrent:boolean,
 *            label:string, sameHead:boolean, status:string, headSha:string,
 *            ageMs:number|null, ageText:string, text:string}}
 */
export function pushStateProvenance({
  pushState = null,
  localHead = '',
  now = Date.now(),
  freshMs = PUSH_STATE_FRESH_MS,
} = {}) {
  const short = (s) => (typeof s === 'string' ? s.trim().slice(0, 7) : '')
  if (!pushState || typeof pushState !== 'object') {
    return {
      state: 'absent',
      isCurrent: false,
      label: '无读数',
      sameHead: false,
      status: '无',
      headSha: '',
      ageMs: null,
      ageText: '未知时长',
      text: 'push-state 读数:无(文件缺失或不可 parse)⇒ 本行结论不以任何历史推送为据',
    }
  }
  const status = typeof pushState.status === 'string' ? pushState.status : '(未知值)'
  const headSha = typeof pushState.headSha === 'string' ? pushState.headSha : ''
  if (typeof pushState.ts !== 'number' || !Number.isFinite(pushState.ts)) {
    return {
      state: 'malformed',
      isCurrent: false,
      label: '未判定(ts 不是数)',
      sameHead: false,
      status,
      headSha,
      ageMs: null,
      ageText: '未知时长',
      text:
        `push-state 读数:status=${status} headSha=${short(headSha) || '(无)'} 但 ts 不是数 ⇒ ` +
        '年龄无从算,**未判定**(不得据此行确认本次推送状态)',
    }
  }
  const ageMs = Math.max(0, now - pushState.ts)
  const age = ageTextAbs(ageMs)
  const isSame = sameSha(headSha, localHead)
  const fresh = ageMs < freshMs
  const base = `push-state 读数:status=${status} headSha=${short(headSha) || '(无)'} 距今 ${age}(当前 HEAD ${short(localHead) || '(未取到)'})`
  if (isSame && fresh) {
    return {
      state: 'current',
      isCurrent: true,
      label: '当下量的',
      sameHead: true,
      status,
      headSha,
      ageMs,
      ageText: age,
      text: `${base} ⇒ headSha == 当前 HEAD 且在 ${Math.round(freshMs / 60000)}min 窗口内 = **当下量的**`,
    }
  }
  const reason = !isSame
    ? `该记录关于**另一枚提交**(${short(headSha) || '(空)'}),与当前 HEAD 无关`
    : `同一枚提交但读数已 ${age},超出 ${Math.round(freshMs / 60000)}min 窗口`
  return {
    state: 'stale-record',
    isCurrent: false,
    // 定性只在这里产一次:调用方按 `isCurrent` / `label` 分支即可,**不得**自己再比一次
    // headSha 或 age(两处算同一件事必漂移,本仓记过多次)。
    label: '历史残留/未现推',
    sameHead: isSame,
    status,
    headSha,
    ageMs,
    ageText: age,
    text: `${base} ⇒ ${reason} = **历史残留/未现推**,不得读成当下故障`,
  }
}

// ─── --self-test(零副作用;例数以末行现测为准,不写死防漂移) ───
// §22d:根判据必须经 pathToFileURL 归一 —— Windows 反斜杠路径直接拼 `file:///`
// 永远不等于 import.meta.url,那样 CLI 永不触发、自检静默失效。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun && process.argv.includes('--self-test')) {
  const NFF =
    "To https://github.com/x/y.git\n ! [rejected]        main -> main (non-fast-forward)\nerror: failed to push some refs to 'https://github.com/x/y.git'\nhint: Updates were rejected because the tip of your current branch is behind"
  // ── 2026-09-28 三型夹具:文本逐字取自被审面的真实回显(§22c:自造文本只会让锁跟着判据一起漂) ──
  /** (a) 旁路通知 + ref 锁竞态 ⇒ **必须**判竞态(带不带 Required status check 那行都判竞态)。 */
  const BYPASS_ONLY = [
    'remote: Bypassed rule violations for refs/heads/main:        ',
    'remote: ',
    'To https://github.com/IHUI-INF-AI/IHUI-AI.git',
    " ! [remote rejected]       main -> main (cannot lock ref 'refs/heads/main': is at 6b8cd0f6aa1 but expected c12612dc9f0)",
    "error: failed to push some refs to 'https://github.com/IHUI-INF-AI/IHUI-AI.git'",
  ].join('\n')
  /** (a2) 真实完整回显:旁路通知 + `Required status check` + cannot lock ref ⇒ 仍是竞态,不是策略。 */
  const BYPASS_WITH_CHECK = [
    'remote: Bypassed rule violations for refs/heads/main:        ',
    'remote: ',
    'remote: - Required status check "CI / lint-typecheck-test (push)" is expected.        ',
    'To https://github.com/IHUI-INF-AI/IHUI-AI.git',
    " ! [remote rejected]       main -> main (cannot lock ref 'refs/heads/main': is at 6b8cd0f6aa1 but expected c12612dc9f0)",
    "error: failed to push some refs to 'https://github.com/IHUI-INF-AI/IHUI-AI.git'",
  ].join('\n')
  /** (b) 纯策略拒收(GH006)⇒ 必须仍判策略,不得被竞态档吃掉。 */
  const GH006 = [
    'remote: error: GH006: Protected branch update failed for refs/heads/main.        ',
    'remote: ',
    'remote: - Required status check "CI / lint-typecheck-test (pull_request)" is expected.        ',
    ' ! [remote rejected]       main -> main (protected branch hook declined)',
  ].join('\n')
  /** 竞态的另一形态:--force-with-lease / 过期 tracking ref 打的是 stale info。 */
  const STALE_INFO =
    'To https://github.com/x/y.git\n ! [rejected]        main -> main (stale info)\nerror: failed to push some refs'
  /** [名称, 实际值, 期望值] —— 期望值逐条写死,免得判据自己给自己发合格证。 */
  const cases = [
    [
      'kind: non-fast-forward',
      triagePushAttempt({ status: 1, stderr: NFF }).kind,
      'non-fast-forward',
    ],
    [
      'non-FF 不得计划 --no-verify',
      triagePushAttempt({ status: 1, stderr: NFF }).allowNoVerifyRetry,
      false,
    ],
    [
      'non-FF 出路点名 converge',
      triagePushAttempt({ status: 1, stderr: NFF }).nextCommand,
      CONVERGE_COMMAND,
    ],
    [
      'kind: hook-failed',
      triagePushAttempt({ status: 1, stderr: '🚫 1 道 blocking 门失败 —— 本轮已跑完全部 152 项' })
        .kind,
      'hook-failed',
    ],
    [
      'secret-scan 不得被并进 hook-failed',
      triagePushAttempt({
        status: 1,
        stderr: '! [remote rejected] main (push declined due to repository rule violations)',
      }).kind,
      'secret-scan-blocked',
    ],
    [
      'up-to-date + 验证相等 → done',
      triagePushAttempt({ status: 0, stdout: 'Everything up-to-date', remoteEqualsLocal: true })
        .terminalStatus,
      'done',
    ],
    [
      'up-to-date + 验证不等 → failed(不记成功)',
      triagePushAttempt({ status: 0, stdout: 'Everything up-to-date', remoteEqualsLocal: false })
        .terminalStatus,
      'failed',
    ],
    [
      'other(网络类)保持原行为:仍允许 --no-verify 兜底',
      triagePushAttempt({ status: 1, stderr: 'fatal: unable to access' }).allowNoVerifyRetry,
      true,
    ],
    [
      'kind: pushed-ok',
      triagePushAttempt({ status: 0, stdout: '   a1b2c3d..e4f5a6b  main -> main' }).kind,
      'pushed-ok',
    ],
    [
      'kind: credentials-unavailable(真实 worker 回显)',
      triagePushAttempt({
        status: 128,
        stderr:
          "bash: line 1: /dev/tty: No such device or address\nerror: failed to execute prompt script (exit code 1)\nfatal: could not read Username for 'https://github.com': No such file or directory",
      }).kind,
      'credentials-unavailable',
    ],
    [
      'credentials-unavailable 不改重试策略(与 other 同旗)',
      triagePushAttempt({ status: 128, stderr: "fatal: could not read Username for 'x'" })
        .allowNoVerifyRetry,
      true,
    ],
    [
      '成对反向:另一型 exit 128(网络断)仍落 other',
      triagePushAttempt({
        status: 128,
        stderr:
          'fatal: unable to access https://github.com/: Failed to connect to 127.0.0.1 port 7897',
      }).kind,
      'other',
    ],
    // ── 2026-09-28:竞态 / 策略 / 分叉 三档的成对反证(任务要求的 (a)(b)(c) 三条,退化一条即红) ──
    [
      '(a) 旁路通知 + cannot lock ref ⇒ 竞态',
      triagePushAttempt({ status: 1, stderr: BYPASS_ONLY }).kind,
      'remote-ref-race',
    ],
    [
      '(a2) 旁路通知 + Required status check + cannot lock ref ⇒ **仍**竞态(判序先于策略)',
      triagePushAttempt({ status: 1, stderr: BYPASS_WITH_CHECK }).kind,
      'remote-ref-race',
    ],
    [
      '(b) GH006 protected branch hook declined ⇒ 策略',
      triagePushAttempt({ status: 1, stderr: GH006 }).kind,
      'protected-branch',
    ],
    [
      '(c) (non-fast-forward) ⇒ 分叉(既有语义一字未动)',
      triagePushAttempt({ status: 1, stderr: NFF }).kind,
      'non-fast-forward',
    ],
    [
      '(d) (stale info) ⇒ 竞态,不再被当成叉',
      triagePushAttempt({ status: 1, stderr: STALE_INFO }).kind,
      'remote-ref-race',
    ],
    [
      '竞态出路=先取网络真值,不得径指收敛器',
      triagePushAttempt({ status: 1, stderr: BYPASS_WITH_CHECK }).nextCommand,
      RACE_RECHECK_COMMAND,
    ],
    [
      '竞态 why 必须同时给出两条分支(祖先成立⇒重推 / 不成立⇒收敛)',
      /merge-base[\s\S]*git-sync-converge\.mjs/.test(
        triagePushAttempt({ status: 1, stderr: BYPASS_WITH_CHECK }).why,
      ),
      true,
    ],
    [
      '竞态不得计划 --no-verify',
      triagePushAttempt({ status: 1, stderr: BYPASS_WITH_CHECK }).allowNoVerifyRetry,
      false,
    ],
    [
      '竞态落 failed(通道没坏),不冒充 diverged',
      triagePushAttempt({ status: 1, stderr: BYPASS_WITH_CHECK }).terminalStatus,
      'failed',
    ],
    [
      '成对反向:真策略那趟的出路仍不得指向收敛器',
      triagePushAttempt({ status: 1, stderr: GH006 }).nextCommand === CONVERGE_COMMAND,
      false,
    ],
    // ── 2026-09-28:push-state 读数出处(历史残留不得冒充当下结论) ──
    [
      'provenance:headSha==当前 HEAD 且新鲜 ⇒ current',
      pushStateProvenance({
        pushState: { status: 'failed', headSha: 'a'.repeat(40), ts: 1_000_000 },
        localHead: 'a'.repeat(40),
        now: 1_000_000 + 30_000,
      }).state,
      'current',
    ],
    [
      'provenance:headSha 是别的提交 ⇒ stale-record 且点名"历史残留"',
      pushStateProvenance({
        pushState: { status: 'failed', headSha: 'b'.repeat(40), ts: 1_000_000 },
        localHead: 'a'.repeat(40),
        now: 1_000_000 + 4 * 3600_000,
      }).state,
      'stale-record',
    ],
    [
      'provenance:年龄要有小时档(4h 不得被印成 240min)',
      pushStateProvenance({
        pushState: { status: 'failed', headSha: 'b'.repeat(40), ts: 1_000_000 },
        localHead: 'a'.repeat(40),
        now: 1_000_000 + 4 * 3600_000,
      }).ageText,
      '4h',
    ],
    [
      'provenance:同一枚但读数过期 ⇒ 仍是 stale-record',
      pushStateProvenance({
        pushState: { status: 'done', headSha: 'a'.repeat(40), ts: 1_000_000 },
        localHead: 'a'.repeat(40),
        now: 1_000_000 + 6 * 60_000,
      }).state,
      'stale-record',
    ],
    [
      'provenance:无读数 ⇒ absent(不猜)',
      pushStateProvenance({ pushState: null, localHead: 'a'.repeat(40) }).state,
      'absent',
    ],
    [
      'provenance:ts 不是数 ⇒ malformed/未判定,不得冒充 current',
      pushStateProvenance({
        pushState: { status: 'failed', headSha: 'a'.repeat(40), ts: 'x' },
        localHead: 'a'.repeat(40),
      }).state,
      'malformed',
    ],
  ]
  let bad = 0
  for (const [name, got, want] of cases) {
    const ok = got === want
    console.log(`${ok ? '✅' : '❌'} ${name} → ${String(got)}${ok ? '' : `(期望 ${String(want)})`}`)
    if (!ok) bad++
  }
  console.log(`自检 ${cases.length - bad}/${cases.length} 通过`)
  process.exit(bad === 0 ? 0 : 1)
}

/**
 * §22c:暴露给镜像测试的核心判据(`scripts/tests/push-attempt-triage.test.mjs` 直接 import
 * 这一份,**不得**在测试里再抄一份正则/判序 —— 两处算同一件事必漂移)。
 * 命名导出与这里指向**同一批函数对象**,不是副本。
 */
export const __test__ = {
  triagePushAttempt,
  describeVerdict,
  pushStateProvenance,
  PUSH_TRIAGE_KINDS,
  CONVERGE_COMMAND,
  RACE_RECHECK_COMMAND,
  UP_TO_DATE_RE,
  SECRET_SCAN_RE,
  PROTECTED_BRANCH_RE,
  REMOTE_REF_RACE_RE,
  RULE_BYPASS_NOTICE_RE,
  NON_FAST_FORWARD_RE,
  CREDENTIALS_UNAVAILABLE_RE,
  HOOK_TRACE_RE,
  PUSH_STATE_FRESH_MS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
