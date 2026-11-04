// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * gates-progress-format.mjs — 逐门进度日志的行格式单源(2026-11-04 立)
 *
 * 立因(实测,不是推断):`.ihui-agent/state/hook-logs/gates-progress.log` 旧行只有
 * `[ISO] status id elapsedms script`,**没有** `--staged` 旗标、没有 stderr 摘要、没有运行分界。
 * 同一天混着全量跑 / pre-commit 快档 / push 门,红名单对账时无法从落盘数据定案某一行属于哪个口径,
 * 只能靠时间窗去凑;门 44 在全量口径按设计恒 exit 0 却出现在红名单,就是口径不可辨的直接反例。
 *
 * 本次只**追加**字段,既有字段顺序一字不改(现成解析器按前缀取列,不许失效):
 *
 *   [ISO] status id elapsedms script scope=<full|staged|push> runId=<pid-启动ms> stderr=<单行摘要>
 *
 * 三条口径:
 *   - `scope` 只认**本次 runner 是否传 `--staged` / `--push-gate`**;不从 `IHUI_GATE_SCOPE` 猜
 *     —— 后者在不传 `--staged` 时根本不生效(它管的是门集裁剪,不是运行口径);
 *   - `stderr` 取门 stderr 前 200 字符压成单行:换行 → ` ⏎ `,制表符 → 空格,控制字符删除;
 *     无 stderr 写 `-`;
 *   - `runId` 取 `<pid>-<启动ms>`,每次 runner 启动生成一次,同一次运行的行因此可聚类。
 *
 * 兼容性:解析器允许旧行缺这三个字段,旧行一律标 `scope: 'unlabeled'`,
 * **绝不许**把"没标注"读成 `full`(没标注 ≠ 全量口径)。
 */

const MAX_STDERR_CHARS = 200

/**
 * 本次 runner 的运行口径。优先级:`--push-gate` > `--staged` > 全量。
 * 两面旗同给时 push 优先 —— push 门集与 pre-commit 门集是两套注册面,按更窄的那套标注。
 *
 * @param {{passStaged?: boolean, pushGate?: boolean}} flags
 * @returns {'full'|'staged'|'push'}
 */
export function resolveGateProgressScope({ passStaged = false, pushGate = false } = {}) {
  if (pushGate) return 'push'
  if (passStaged) return 'staged'
  return 'full'
}

/**
 * 一次 runner 启动的短 id(`<pid>-<启动ms>`)。模块求值即进程启动,
 * 因此同一进程内所有行拿到同一个值 —— 这正是"同一次运行的行能聚类"要的全部。
 *
 * @param {number} [pid]
 * @param {number} [startedMs]
 * @returns {string}
 */
export function buildGateRunId(pid = process.pid, startedMs = Date.now()) {
  return `${pid}-${startedMs}`
}

/**
 * 把门 stderr 压成单行摘要。
 *
 * 顺序:先去换行(先 `\r\n` 再单 `\r`/`\n`,避免 CRLF 被拆成两个 ` ⏎ `),
 * 再把制表符换成空格,再删掉其余控制字符,最后按**字符**(不是 UTF-16 码元)截前 200。
 *
 * @param {unknown} raw
 * @param {number} [limit]
 * @returns {string} 无内容时返回 `-`
 */
export function summarizeGateStderr(raw, limit = MAX_STDERR_CHARS) {
  if (raw === undefined || raw === null) return '-'
  let s = String(raw)
  if (s.length === 0) return '-'
  s = s.replace(/\r\n|\r|\n/g, ' ⏎ ')
  s = s.replace(/\t/g, ' ')
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  s = s.trim()
  if (s.length === 0) return '-'
  return [...s].slice(0, Math.max(0, limit)).join('') || '-'
}

/**
 * 生成一行进度日志。前 5 个字段(ISO / status / id / 耗时 / 脚本)的拼法与旧版逐字一致,
 * 三个新字段只追加在行尾,顺序固定为 `scope` → `runId` → `stderr`。
 *
 * @param {object} row
 * @param {Date|number|string} [row.at]
 * @param {'pass'|'fail'|'error'} row.status
 * @param {string|number} row.id
 * @param {number} row.elapsedMs
 * @param {string} [row.script]
 * @param {'full'|'staged'|'push'} [row.scope]
 * @param {string} [row.runId]
 * @param {unknown} [row.stderr]
 * @returns {string}
 */
export function formatGateProgressLine({
  at = new Date(),
  status,
  id,
  elapsedMs,
  script = '',
  scope = 'full',
  runId = '-',
  stderr,
} = {}) {
  const iso = at instanceof Date ? at.toISOString() : new Date(at).toISOString()
  const head = `[${iso}] ${String(status).padEnd(5)} ${String(id).padEnd(8)} ${String(elapsedMs).padStart(6)}ms ${script || ''}`
  return `${head} scope=${scope} runId=${runId} stderr=${summarizeGateStderr(stderr)}`
}

/**
 * 解析一行进度日志(旧行 / 新行都认)。
 *
 * @param {string} line
 * @returns {null | {
 *   at: string, status: string, id: string, elapsedMs: number, script: string,
 *   scope: 'full'|'staged'|'push'|'unlabeled', runId: string|null, stderr: string|null,
 *   labeled: boolean,
 * }}
 */
export function parseGateProgressLine(line) {
  const text = String(line ?? '').replace(/\r?\n$/, '')
  const head = text.match(/^\[([^\]]+)\]\s+(pass|fail|error)\s+(\S+)\s+(\d+)ms(?: (.*))?$/)
  if (!head) return null
  const [, at, status, id, elapsed, tailRaw = ''] = head
  // 新字段从行尾切:stderr 是最后一段且允许含空格,所以只认"尾部全匹配"。
  const labeled = tailRaw.match(/\s+scope=(full|staged|push)\s+runId=(\S+)\s+stderr=([\s\S]*)$/)
  if (!labeled) {
    return {
      at,
      status,
      id,
      elapsedMs: Number(elapsed),
      script: tailRaw.trim(),
      scope: 'unlabeled',
      runId: null,
      stderr: null,
      labeled: false,
    }
  }
  return {
    at,
    status,
    id,
    elapsedMs: Number(elapsed),
    script: tailRaw.slice(0, labeled.index).trim(),
    scope: labeled[1],
    runId: labeled[2],
    stderr: labeled[3],
    labeled: true,
  }
}

export const __testing = { MAX_STDERR_CHARS }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
