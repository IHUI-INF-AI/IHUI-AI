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
 */
import { pathToFileURL } from 'node:url'

/** 分类封闭集(镜像测试按它逐条造输入,不得出现集合外的 kind)。 */
export const PUSH_TRIAGE_KINDS = Object.freeze([
  'pushed-ok',
  'up-to-date',
  'non-fast-forward',
  'secret-scan-blocked',
  'hook-failed',
  'other',
])

/** 唯一指向性出路(§5b「🔄 主动收敛」规定的入口;本模块不跑它,只报出来)。 */
export const CONVERGE_COMMAND = 'node scripts/git-sync-converge.mjs'

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
 * 远端拒收 non-fast-forward。git 的真实形态有两处:短横线式 `* [rejected]` 摘要行
 * 与 `hint: Updates were rejected because ...`;`fetch first` 是 GitLab/GitHub 侧常见回显。
 * 刻意不含 `error: failed to push some refs` —— 钩子失败时 git 打的是同一句,拿它当
 * 分叉证据就是把跳门换了个理由。
 */
export const NON_FAST_FORWARD_RE =
  /non-fast-forward|fetch first|updates were rejected|\[rejected\]|\[remote rejected\]|stale info/i

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
 *          remoteEqualsLocal?: boolean|null}} attempt push 的原始结果 +
 *   (仅 up-to-date 档用到)验证段的 local/remote 是否确实相等;null = 没验到,按"未判定"处理
 *   —— 未判定**不等于**成功。
 * @returns {PushAttemptVerdict}
 */
export function triagePushAttempt({
  status = null,
  stdout = '',
  stderr = '',
  remoteEqualsLocal = null,
} = {}) {
  const text = `${stdout ?? ''}\n${stderr ?? ''}`
  const failed = status !== 0

  // ── 成功侧 ──
  if (!failed) {
    if (UP_TO_DATE_RE.test(text)) {
      // 「什么都没推」与「推成了」必须分档:只有验证确实 local==remote 才配得上 done。
      const verified = remoteEqualsLocal === true
      return verdict({
        kind: 'up-to-date',
        failed: false,
        pushedNothing: true,
        allowHookRetry: false,
        allowNoVerifyRetry: false,
        terminalStatus: verified ? 'done' : 'failed',
        why: verified
          ? '本次未推送任何东西:远端 tip 已包含本地(或已由并发推送落地),且验证 local==remote'
          : `本次未推送任何东西(远端回显 Everything up-to-date),而验证${
              remoteEqualsLocal === null ? '取不到(未判定)' : 'local!=remote'
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

// ─── --self-test(零副作用;例数以末行现测为准,不写死防漂移) ───
// §22d:根判据必须经 pathToFileURL 归一 —— Windows 反斜杠路径直接拼 `file:///`
// 永远不等于 import.meta.url,那样 CLI 永不触发、自检静默失效。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun && process.argv.includes('--self-test')) {
  const NFF =
    "To https://github.com/x/y.git\n ! [rejected]        main -> main (non-fast-forward)\nerror: failed to push some refs to 'https://github.com/x/y.git'\nhint: Updates were rejected because the tip of your current branch is behind"
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
