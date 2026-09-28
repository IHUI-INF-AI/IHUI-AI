// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-611(2026-09-29 票)—— 信号退出码 128+N:此前**只有消费侧、没有产出侧**。
//
// 病灶现读(票面原文的两处消费侧):
//   - scripts/check-typecheck.mjs:454 按 130/137/141/143/3221225786 把 typecheck 子进程的
//     close 码分成"被杀 ≠ 结论"⇒ exit 75(临时失败)⇒ guardian-runner 原样传播 ⇒
//     .husky/pre-push:91-97 写可重试标记。本仓为这条付过一次代价(实测 39 次
//     exit 3221225786 被误打印成"全量 typecheck 失败",随后 guard 按"他人代码失败"
//     --no-verify 绕门重推)。
//   - 但我方作为被派生的一方(typecheck-full / check-typecheck / apps/api)从不产出这套码:
//     POSIX 上信号杀 = 默认动作"死于信号",父侧只拿到 {status:null, signal:'SIGTERM'},
//     集合判据对这一格**结构上失明**,于是一次 kill 被计成"结论失败"。今天能读到码的
//     那一格,全靠 Windows CTRL_C(3221225786)的自然产出与 shell 中转的 128+N。
//
// 本模块把两侧收进同一把尺子,三条规矩(各由 scripts/tests/signal-exit.test.mjs 钉死):
//   1) **集合只有一份**:INTERRUPT_EXIT_CODES 住本文件;消费侧一律 import,任何地方再写出
//      `new Set([130, ...` 字面量 = 镜像形状锁判红(两处实现必漂移,本仓记过最多次)。
//   2) **产出侧产出的,消费侧必须认得**:DEFAULT_PRODUCED_SIGNALS 的每个码都落在
//      INTERRUPT_EXIT_CODES 里(逐条机判,不是散文)。
//   3) **读不到码也判"被杀"**:status:null + signal(没装产出侧的子进程、或不可捕获的
//      SIGKILL)同样归中断 —— 把"没判"写成"结论失败"正是本票的根型;但**不得**反过来
//      把有结论的失败(如 exit 2)洗成中断,kind 为 verdict 时原码照传。
//
// 平台边界(如实登记,不是出路):
//   - Windows 的 TerminateProcess / taskkill /F **不可捕获**,任何进程都产不出码 —— 与装
//     本模块之前一致;装了的增益在于"可捕获的那一半"(CTRL_C/SIGINT/SIGTERM)现在必有码。
//   - spawnSync/execSync 阻塞期间 libuv 排队信号、监听器在阻塞返回后才跑;组杀(进程组
//     一起收到信号)时子进程同死,阻塞随即返回,码产出不迟。定向单杀一个阻塞中的同步
//     包装器会拖到其子进程自然结束 —— 改前是直接死(连码都没有),两者都不是好结局,
//     真正该避免的是"杀一个正在同步派生的包装器"这种操作本身。
export const SIGNAL_EXIT_OFFSET = 128

/** 0xC000013A —— Windows 下 CTRL_C 终止进程组时进程的真实 NTSTATUS 退出码(消费侧集合成员)。 */
export const WINDOWS_CTRL_C_EXIT_CODE = 3221225786

/** sysexits EX_TEMPFAIL —— 本仓全链(check-typecheck → guardian-runner → pre-push)表达"临时失败/可重试"的统一码。 */
export const TEMPFAIL_EXIT_CODE = 75

/**
 * POSIX 信号编号表(128+N 的 N)。SIGKILL(9)/SIGSEGV(11) 等**不可捕获**,
 * 产出侧给不出 137 —— 集合里的 137 来自 shell/容器运行时对信号死的中转产出,
 * 消费侧认它是"被杀"仍然成立;产出侧默认清单因此不含它们(规矩 2)。
 */
export const SIGNAL_EXIT_NUMBERS = Object.freeze({
  SIGHUP: 1,
  SIGINT: 2,
  SIGQUIT: 3,
  SIGILL: 4,
  SIGTRAP: 5,
  SIGABRT: 6,
  SIGBUS: 7,
  SIGFPE: 8,
  SIGKILL: 9,
  SIGUSR1: 10,
  SIGSEGV: 11,
  SIGUSR2: 12,
  SIGPIPE: 13,
  SIGALRM: 14,
  SIGTERM: 15,
})

/**
 * 消费侧集合 —— 逐字取自 scripts/check-typecheck.mjs:454 的原字面量,一位不加减。
 * 扩键属全链语义决策(它会改变"哪些失败被判可重试"),不得顺手加。
 */
export const INTERRUPT_EXIT_CODES = Object.freeze(
  new Set([130, 137, 141, 143, WINDOWS_CTRL_C_EXIT_CODE]),
)

/**
 * 产出侧默认可捕获清单。只收"可捕获 ∧ 码落在消费侧集合"的信号(规矩 2 的定义域):
 * SIGINT→130 / SIGTERM→143 / SIGPIPE→141 / SIGBREAK→3221225786(Windows Ctrl+Break)。
 * 任何新增必须同笔满足该不变量,由镜像测试 T3 机判。
 */
export const DEFAULT_PRODUCED_SIGNALS = Object.freeze(['SIGINT', 'SIGTERM', 'SIGPIPE', 'SIGBREAK'])

/** 信号名 → 应产出的退出码;不在表内(不可捕获或无名)返回 null,由调用方决定兜底,绝不猜。 */
export function exitCodeForSignal(signal) {
  if (signal === 'SIGBREAK') return WINDOWS_CTRL_C_EXIT_CODE
  const n = SIGNAL_EXIT_NUMBERS[signal]
  return n === undefined ? null : SIGNAL_EXIT_OFFSET + n
}

/** 码是否属于"被信号杀死"族(消费侧唯一判据;非整数一律 false,不拿 truthy 冒充)。 */
export function isInterruptExitCode(code) {
  return Number.isInteger(code) && INTERRUPT_EXIT_CODES.has(code)
}

/**
 * 父侧分类的唯一出口:把一次子进程结局分成四态。
 * 优先级:timedOut > pass(exit 0) > interrupt(码在集合内 ∨ 无码但有信号) > verdict。
 * timedOut 压过一切是刻意保留的 check-typecheck 旧语义(超时分支不走 75 重试,
 * 见其 close 注释:重试等于把一次挂死变成两次挂死)。
 * 返回 { kind, exitCode, reason } —— reason 是给日志的话,不是判据。
 */
export function classifySpawnOutcome(input = {}) {
  const { status = null, signal = null, timedOut = false } = input
  if (timedOut) {
    return { kind: 'timeout', exitCode: 1, reason: '本方计时器到期并已终止子进程(非结论)' }
  }
  if (status === 0) {
    return { kind: 'pass', exitCode: 0, reason: 'exit 0' }
  }
  if (isInterruptExitCode(status)) {
    return { kind: 'interrupt', exitCode: TEMPFAIL_EXIT_CODE, reason: `exit ${status}(信号族码,被杀 ≠ 结论)` }
  }
  if ((status === null || status === undefined) && signal) {
    return {
      kind: 'interrupt',
      exitCode: TEMPFAIL_EXIT_CODE,
      reason: `signal=${String(signal)}(子进程未产出退出码,按"被杀"归)`,
    }
  }
  return { kind: 'verdict', exitCode: status ?? 1, reason: `exit ${status ?? '取不到'}` }
}

/**
 * execSync/spawnSync 抛错对象的判读:error.status/error.signal 就挂在该对象上。
 * 三种形态都归"中断":① 子门自己的 75(既有语义,逐字保留)② 信号族码(G-611 新增
 * —— 被派生方装了产出侧才有这一格)③ 无码但有信号(没装产出侧/不可捕获,规矩 3)。
 * "有结论的失败"(status 为非族非零码)返回 false,不得被本函数洗成中断。
 */
export function shouldPropagateAsInterrupt(err) {
  if (!err || typeof err !== 'object') return false
  const { status, signal } = err
  if (status === TEMPFAIL_EXIT_CODE) return true
  if (isInterruptExitCode(status)) return true
  return (status === null || status === undefined) && Boolean(signal)
}

/** shouldPropagateAsInterrupt 成立时的"怎么中断的"一句话(报告用;不参与判定)。 */
export function interruptReason(err) {
  if (!err || typeof err !== 'object') return 'unknown'
  const { status, signal } = err
  if (status === TEMPFAIL_EXIT_CODE) return 'exit 75 临时失败'
  if (isInterruptExitCode(status)) return `exit ${status}(信号族码)`
  if ((status === null || status === undefined) && signal) return `signal=${String(signal)}(无码信号死)`
  return 'unknown'
}

/**
 * 产出侧唯一出口:被派生的脚本在顶部调用它,被可捕获信号杀死时**产出 128+N** 而非
 * 无声死亡。行为契约:
 *   - 首信号:打一行"产出信号退出码"的话(控制台已断则吞,绝不挡住退出)→ 跑可选
 *     onSignal(清场,异常同样吞并点名)→ exitFn(exitCodeForSignal(sig) ?? 1)。
 *   - 再入闩:处理已开始后同进程内第二下不再重跑(真信号在 exit 落地前到不了这里,
 *     闩是给不可捕获路径与测试面留的保险)。
 *   - 平台不可绑定的信号名(Windows 上某些 POSIX 信号)如实降级报一行,不冒充"已产出"。
 * 返回 { installed, handle, dispose } —— dispose 供测试与"临时接管"场景回收监听器。
 * 注意:装了就**抑制了 Node 的默认动作**;默认动作在 POSIX 上也只是"死于信号且不产出
 * 码"(正是本票要治的),在 Windows 上则是 CTRL_C 自然产出 3221225786(130 与它都在
 * 消费侧集合里,归因不变)。
 */
export function installSignalExit(options = {}) {
  const { label = 'node', onSignal = null } = options
  const signals = options.signals ?? DEFAULT_PRODUCED_SIGNALS
  const exitFn = options.exitFn ?? ((code) => process.exit(code))
  const entries = []
  let fired = null

  const handle = (signal) => {
    if (fired !== null) return
    fired = signal
    const code = exitCodeForSignal(signal)
    try {
      console.error(
        `[${label}] 收到 ${signal}:产出信号退出码 ${code === null ? '1(未映射,不猜 128+N)' : code}(被杀不是结论)`,
      )
    } catch {
      /* stdout/stderr 已断:退出码比这句话重要 */
    }
    if (typeof onSignal === 'function') {
      try {
        onSignal(signal)
      } catch (e) {
        try {
          console.error(`[${label}] onSignal 失败(不影响退出码): ${e && e.message ? e.message : String(e)}`)
        } catch {
          /* 同上 */
        }
      }
    }
    exitFn(code === null ? 1 : code)
  }

  for (const sig of signals) {
    const listener = () => handle(sig)
    try {
      process.on(sig, listener)
      entries.push({ sig, listener })
    } catch (e) {
      try {
        console.error(
          `[${label}] 无法监听 ${sig}(${e && e.code ? e.code : String(e)}):该平台不会投递此信号,产出侧这一格为空`,
        )
      } catch {
        /* 忽略报告失败 */
      }
    }
  }

  return {
    installed: entries.map((en) => en.sig),
    handle,
    dispose() {
      for (const { sig, listener } of entries) {
        try {
          process.removeListener(sig, listener)
        } catch {
          /* 已经没了就当清理完成 */
        }
      }
      entries.length = 0
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
