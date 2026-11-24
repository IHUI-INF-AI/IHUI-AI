// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-611(2026-09-29)—— 信号退出码 128+N 的**产出侧**(apps/api 这一头)。
 *
 * 票面病灶:index.ts 原以 `process.once('SIGTERM'/'SIGINT')` 注册停机 —— once 的注释写着
 * "二次信号走默认强制退出",但默认动作的死法是**不产出任何退出码**。本仓消费侧
 * (scripts/check-typecheck.mjs → scripts/lib/signal-exit.mjs 的 130/137/141/143/
 * 3221225786 族)已经在按这套码区分"被杀 ≠ 结论",而我方作为被派生/被监管的一方
 * 从不产出它:监管面(nssm/docker/编排器)读到的只有"进程没了",没有"被哪个信号杀的"。
 *
 * 本模块把"once 的强制退出"换成**带闩的 on**:
 *   - 第一下信号:照常走有序停机(shutdown 自身仍有 shuttingDown 守卫,双注册也不会重跑);
 *   - 第二下(含以后)信号:不再交给 Node 默认动作,而是立即 `exit(128+N)` ——
 *     同样是强杀,但现在**有码**(SIGTERM→143 / SIGINT→130)。
 * 方向纪律:装了 on 之后监听器常驻,第二下若只落进 shutdown 的 no-op 守卫,进程会
 * **永远不退出**(once 换 on 最常犯的回归);所以闩的第二支必须显式 exit,这是本模块
 * 存在的理由,由测试逐臂钉住。
 *
 * 表与 scripts/lib/signal-exit.mjs 的 SIGNAL_EXIT_NUMBERS 同族 —— 两处算同一件事
 * (本仓"两处实现必漂移"记过太多次),对账尺在 scripts/tests/signal-exit.test.mjs
 * (它逐键解析本文件的表与 JS 侧比对);新增信号必须两侧同笔并过那条测试。
 */

/** 128+N 的偏移(shell/容器运行时对信号死的中转约定)。 */
export const SIGNAL_EXIT_OFFSET = 128

/**
 * POSIX 信号编号表。只列**可映射**的信号;SIGKILL/SIGSEGV 等不可捕获,产出侧给不出码,
 * 但运行时/shell 会把信号死中转成这些码,消费侧照样认(见 scripts 侧集合注释)。
 */
export const SIGNAL_EXIT_NUMBERS: Readonly<Record<string, number>> = Object.freeze({
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

/** 信号名 → 应产出的退出码;表里没有返回 null(绝不猜一个数冒充 128+N)。 */
export function forceExitCodeForSignal(signal: string): number | null {
  const n = SIGNAL_EXIT_NUMBERS[signal]
  return n === undefined ? null : SIGNAL_EXIT_OFFSET + n
}

export interface ShutdownSignalDeps {
  /** 有序停机(与 index.ts 的 shutdown 同一入口;由首信号触发一次)。 */
  shutdown: (signal: string) => void | Promise<void>
  /** 注入退出动作:生产面 process.exit,测试面 spy。 */
  exit: (code: number) => void
  /** 日志出口(可选)。不得因日志断链挡住退出 —— 实现里全部 try 包裹。 */
  warn?: (message: string, fields?: Record<string, unknown>) => void
}

/**
 * 返回给 process.on 用的处理器(每进程一个闩实例;SIGTERM/SIGINT 共享同一实例 ——
 * "第二下"跨信号类型成立,不按类型分计数)。
 * 第一下:调 shutdown(同步抛出与 reject 都收进 warn,不冒成 unhandledRejection ——
 * index.ts 顶层的 unhandledRejection 处理器只记日志不退出,漏进去就是"存活不 exit"假死)。
 * 第二下起:forceExitCodeForSignal(signal) ?? 1,立即交给 deps.exit。
 */
export function createShutdownSignalHandler(deps: ShutdownSignalDeps): (signal: string) => void {
  let received = 0
  return (signal: string) => {
    received += 1
    if (received === 1) {
      try {
        const p = deps.shutdown(signal)
        if (p && typeof p.catch === 'function') {
          p.catch((e: unknown) => {
            try {
              deps.warn?.('有序停机自身失败(不重发,等自然退出或后续信号)', { signal, err: e })
            } catch {
              /* 日志断链不改变结论 */
            }
          })
        }
      } catch (e: unknown) {
        try {
          deps.warn?.('有序停机同步失败(不重发,等自然退出或后续信号)', { signal, err: e })
        } catch {
          /* 同上 */
        }
      }
      return
    }
    const code = forceExitCodeForSignal(signal)
    try {
      deps.warn?.('收到第二次信号:有序停机未完成,直接产出信号退出码(被杀要有码,不得落无码默认死法)', {
        signal,
        exitCode: code ?? 1,
      })
    } catch {
      /* 强杀优先于这句话 */
    }
    deps.exit(code === null ? 1 : code)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
