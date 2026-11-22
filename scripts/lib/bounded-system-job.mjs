// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 有截止窗的系统级调用包装。
 * 作业由调用方注入，本模块不调用 schtasks、nssm、Appx 或 powershell。
 * 截止时间没量到，或窗口内没有跑完，都是未判定：既不是成功，也不是失败。
 * 未判定和非零退出带回调用方给的手工命令；没给则该字段为 null。
 */

function positiveInteger(value) {
  return Number.isInteger(value) && value > 0
}

function finiteNonNegative(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function manualCommandOf(value) {
  return typeof value === 'string' ? value : null
}

/**
 * 纯判定。不读时钟、不发系统调用。
 * 顺序：截止时间 → 是否已开始 → 是否在窗内跑完 → 退出码是否量到 → 零/非零。
 */
export function judgeBoundedJob(input) {
  const src = input !== null && typeof input === 'object' ? input : {}
  const manualCommand = manualCommandOf(src.manualCommand)
  const deadlineMs = src.deadlineMs ?? null

  if (!positiveInteger(deadlineMs)) {
    return { verdict: 'unjudged', reason: 'deadline-unmeasured', manualCommand }
  }
  if (src.started !== true) {
    return { verdict: 'unjudged', reason: 'not-started', manualCommand }
  }
  if (src.finished !== true || !finiteNonNegative(src.elapsedMs) || src.elapsedMs >= deadlineMs) {
    return { verdict: 'unjudged', reason: 'deadline-exceeded', manualCommand }
  }
  if (!Number.isInteger(src.exitCode)) {
    return { verdict: 'unjudged', reason: 'exit-unmeasured', manualCommand }
  }
  if (src.exitCode === 0) {
    return { verdict: 'ok', reason: 'exited', manualCommand: null }
  }
  return { verdict: 'breach', reason: 'nonzero', exitCode: src.exitCode, manualCommand }
}

/**
 * 在调用方给的截止时间上赛跑。截止时间没量到就直接未判定，不拿默认毫秒数顶上。
 * 超时交给 judge，不记成退出码 0。start 抛错记 start-threw，不记成成功。
 */
export async function runBoundedJob(start, opts) {
  const options = opts !== null && typeof opts === 'object' ? opts : {}
  const deadlineMs = options.deadlineMs ?? null
  const manualCommand = manualCommandOf(options.manualCommand)

  if (!positiveInteger(deadlineMs)) {
    return judgeBoundedJob({
      started: false,
      finished: false,
      exitCode: null,
      deadlineMs,
      elapsedMs: null,
      manualCommand,
    })
  }

  const startedAt = Date.now()
  let timer
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ kind: 'timeout' }), deadlineMs)
  })
  const job = Promise.resolve()
    .then(() => start())
    .then(
      (result) => ({ kind: 'done', result }),
      () => ({ kind: 'threw' }),
    )

  let winner
  try {
    winner = await Promise.race([job, timeout])
  } finally {
    clearTimeout(timer)
  }

  if (winner.kind === 'threw') {
    return { verdict: 'unjudged', reason: 'start-threw', manualCommand }
  }

  const elapsedMs = Date.now() - startedAt
  if (winner.kind === 'timeout') {
    return judgeBoundedJob({
      started: true,
      finished: false,
      exitCode: null,
      deadlineMs,
      elapsedMs,
      manualCommand,
    })
  }

  const result = winner.result
  const exitCode =
    result !== null && typeof result === 'object' && !Array.isArray(result) ? result.exitCode : null
  return judgeBoundedJob({
    started: true,
    finished: true,
    exitCode: exitCode ?? null,
    deadlineMs,
    elapsedMs,
    manualCommand,
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
