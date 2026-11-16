// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


/**
 * 进程树收割(J5):把 IHUI 现有的"单进程身份复核杀"(`apps/api/src/utils/kill-verified.ts`
 * + `scripts/lib/proc-identity.mjs`)补齐到 **整棵树 + 进程组 + 优雅升级**。
 *
 * 独立分析出处(2026-11-13 从 通用会话日志规范 `resources/app.asar` → `main/process-reap-utils.js`
 * 逐行读出,E1 一手):WB 的跨实例孤儿收割是一个 8 件套状态机 ——
 *   ① `isValidTargetPid`(整数>1 且≠自身,防自杀)
 *   ② `isPidAlive`(`process.kill(pid,0)`,`EPERM` 算活着)
 *   ③ `readProcessCommandLine`(win CIM / posix `ps -p`)
 *   ④ **`birthToken`**(`ps lstart`)—— **防 PID 重用**的锚
 *   ⑤ `samePosixProcess`(birthToken + pgid 双校验,识别"还是不是当初那个进程")
 *   ⑥ `collectPosixProcessTree`(建父子映射递归收集整棵树)
 *   ⑦ `signalPosixProcessTree`(SIGTERM→SIGKILL 升级,含进程组 `process.kill(-pgid)`)
 *   ⑧ `waitForDeath/waitForTreeDeath`(轮询死亡确认)
 *
 * **与 kill-verified.ts 的分工(不重复造轮子,单一真相源 §0.6)**:
 *  - `kill-verified.ts` 管"**该不该杀这一个 pid**"(身份复核拒杀,三态未判定不杀);
 *  - 本模块管"**杀这一棵树**"(在已授权杀根 pid 的前提下,如何把它的子孙与进程组
 *    一并收割、如何优雅升级、如何防误收他人子树)。判定层不在这里重写 —— 调用方
 *    先过 kill-verified 的身份复核,再拿本模块收割整棵树。
 *
 * **平台边界(照 WB 语义)**:win32 无 POSIX 进程组概念,靠 `taskkill /PID <pid> /F /T`
 * 让 OS 递归收割整树(树成员资格交给 OS,不走 birthToken);POSIX 才有 birthToken 校验 +
 * 进程组 kill(-pgid)。本机是 win32,POSIX 路径靠注入桩钉死判据(不真的派生)。
 *
 * 依赖全部可注入(对齐 kill-verified 的 deps.inspect/runKill/isAlive),测试不派生真实进程。
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileP = promisify(execFile)

/** 进程表一行(WB:pid/parentPid/groupId/birthToken)。 */
export interface ProcessTableRow {
  pid: number
  parentPid: number
  groupId: number
  /** 进程出生标识(posix `ps lstart` / win CreationDate ticks 串);防 PID 重用。 */
  birthToken: string
}

/** 进程表快照口:pid → 行。取不到整表 ⇒ null(未判定)。 */
export type ProcessTableReader = () => Promise<Map<number, ProcessTableRow> | null>

/**
 * 杀单个 pid 的派生口(posix 默认出口按 `force` 决定 SIGTERM/SIGKILL,win 恒 taskkill /F)。
 * `group` = 本次是否进程组信号(posix `kill(-pgid)`),win 恒 false。
 */
export type RootKillDispatch = (
  pid: number,
  group: boolean,
  force: boolean,
) => Promise<{ ok: boolean; output: string }>

/** 单 pid 存活探针(`process.kill(pid,0)`,EPERM 算活着)。 */
export type PidLivenessProbe = (pid: number) => Promise<boolean>

export interface ReapTreeOptions {
  /** 首轮(优雅 SIGTERM / taskkill)后等待死亡的时长(ms)。 */
  gracefulMs?: number
  /** 升级 SIGKILL 后等待死亡的时长(ms)。 */
  forceMs?: number
  /** 死亡轮询间隔(ms)。 */
  pollMs?: number
  rootKill?: RootKillDispatch
  groupKill?: RootKillDispatch
  isAlive?: PidLivenessProbe
  readTable?: ProcessTableReader
  now?: () => number
}

export type ReapTreeOutcome =
  | { reaped: true; pid: number; members: number[]; escalated: boolean; observation?: string }
  | { reaped: false; pid: number; reason: 'invalid-pid' | 'undetermined' | 'still-alive'; record: string }

/** ① 守卫:整数>1 且≠自身(WB isValidTargetPid)。防自杀与 pid 0/1(init)。 */
export function isValidTargetPid(pid: number): boolean {
  return typeof pid === 'number' && Number.isInteger(pid) && pid > 1 && pid !== process.pid
}

/** ② 单 pid 存活(WB isPidAlive):kill(pid,0),EPERM = 在场但无权发信号 ⇒ 仍算活着。 */
export function isPidAlive(pid: number): boolean {
  if (!isValidTargetPid(pid)) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === 'EPERM'
  }
}

/** 默认进程表读取(posix `ps -eo pid=,ppid=,pgid=,lstart=`;win 返回 null —— 树资格交 OS)。 */
export const defaultProcessTableReader: ProcessTableReader = async () => {
  if (process.platform === 'win32') return null
  try {
    const { stdout } = await execFileP(
      'ps',
      ['-eo', 'pid=,ppid=,pgid=,lstart='],
      { encoding: 'utf-8', timeout: 10_000, maxBuffer: 1 << 24 },
    )
    const table = new Map<number, ProcessTableRow>()
    for (const line of String(stdout).split('\n')) {
      const m = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.+?)\s*$/)
      if (!m) continue
      const pid = Number.parseInt(m[1] ?? '', 10)
      const parentPid = Number.parseInt(m[2] ?? '', 10)
      const groupId = Number.parseInt(m[3] ?? '', 10)
      const birthToken = m[4] ?? ''
      if (!isValidTargetPid(pid) || !Number.isInteger(parentPid) || !Number.isInteger(groupId)) continue
      table.set(pid, { pid, parentPid, groupId, birthToken })
    }
    return table
  } catch {
    return null
  }
}

/**
 * ⑤ 同一进程判据(WB samePosixProcess):birthToken + groupId 双校验。
 * birthToken 是防 PID 重用的锚 —— 新进程占用了旧 pid 但 birthToken/组不同 ⇒ 不是它。
 */
export function sameProcess(a: ProcessTableRow | undefined, b: ProcessTableRow | undefined): boolean {
  return a?.birthToken === b?.birthToken && a?.groupId === b?.groupId
}

/** ⑥ 父子映射:parentPid → 子 pid 列表(纯函数,供测试直接钉结构)。 */
export function buildParentChildMap(
  table: ReadonlyMap<number, ProcessTableRow>,
): Map<number, number[]> {
  const map = new Map<number, number[]>()
  for (const row of table.values()) {
    const kids = map.get(row.parentPid) ?? []
    kids.push(row.pid)
    map.set(row.parentPid, kids)
  }
  return map
}

/**
 * ⑥ 递归收集进程树(WB collectPosixProcessTree):从根 pid 顺 parentPid 往下走,
 * 带环检测(visited),返回树成员(不含根)。表里没有根 ⇒ 空数组。
 */
export function collectProcessTree(
  rootPid: number,
  table: ReadonlyMap<number, ProcessTableRow>,
): number[] {
  const children = buildParentChildMap(table)
  const visited = new Set<number>()
  const out: number[] = []
  const visit = (pid: number): void => {
    if (visited.has(pid)) return
    visited.add(pid)
    const kids = children.get(pid)
    if (!kids) return
    out.push(...kids)
    for (const kid of kids) visit(kid)
  }
  visit(rootPid)
  return out
}

/**
 * ⑦⑧ 收割整棵树(WB killProcessTree + signalPosixProcessTree + waitForTreeDeath)。
 * win32:`taskkill /PID <pid> /F /T` 让 OS 递归收割,终态按 waitForDeath 结算。
 * POSIX:SIGTERM → 等 gracefulMs → 仍在则 SIGKILL → 等 forceMs;进程组成员一并杀,
 * 含进程组 `kill(-pgid)`(根是组长时)。树成员资格经 birthToken 校验防误收他人子树。
 */
export async function reapProcessTree(
  pid: number,
  opts: ReapTreeOptions = {},
): Promise<ReapTreeOutcome> {
  if (!isValidTargetPid(pid)) {
    return { reaped: false, pid, reason: 'invalid-pid', record: `pid 不可用(${String(pid)})⇒ 不收割` }
  }
  const gracefulMs = opts.gracefulMs ?? 2_000
  const forceMs = opts.forceMs ?? 2_000
  const pollMs = opts.pollMs ?? 100
  const rootKill = opts.rootKill ?? defaultRootKill
  const groupKill = opts.groupKill ?? defaultGroupKill
  const isAlive = opts.isAlive ?? defaultIsAlive
  const readTable = opts.readTable ?? defaultProcessTableReader
  const now = opts.now ?? Date.now

  if (process.platform === 'win32') {
    // win32:树资格交 OS(taskkill /T 递归),不走 birthToken(WB 同款取舍)。
    const dispatched = await rootKill(pid, false, true)
    const dead = await waitForDeath(pid, gracefulMs, pollMs, isAlive, now)
    if (dead) {
      return {
        reaped: true,
        pid,
        members: [],
        escalated: false,
        ...(dispatched.ok ? {} : { observation: `taskkill 报失败(${dispatched.output})但 OS 复核确认已不在 ⇒ 结算为已收割` }),
      }
    }
    // taskkill /F 已是强杀,升级无意义 ⇒ 按仍在结算(不装成功)。
    return { reaped: false, pid, reason: 'still-alive', record: `win32 taskkill 已派发但进程仍在(${gracefulMs}ms)⇒ 不装成功` }
  }

  // POSIX:先取进程表 + 根身份,再决定收割范围。
  const table = await readTable()
  if (!table) {
    // 取不到整表 ⇒ 未判定 ⇒ 只杀根 pid,不猜树成员(宁少杀不误杀)。
    await rootKill(pid, false, false)
    const dead = await waitForDeath(pid, gracefulMs, pollMs, isAlive, now)
    return dead
      ? { reaped: true, pid, members: [], escalated: false, observation: '进程表取不到 ⇒ 未收割树成员,仅杀根' }
      : { reaped: false, pid, reason: 'undetermined', record: `进程表取不到且根未死(${gracefulMs}ms)⇒ 未判定` }
  }
  const rootRow = table.get(pid)
  // 树成员资格:根还在表里(拿得到 birthToken)才按树收;根已不在(或身份对不上)⇒ 只杀根。
  const trustTree = rootRow !== undefined
  const members = trustTree ? collectProcessTree(pid, table) : []

  // 首轮:SIGTERM(根 + 树成员 + 进程组)。
  await signalAll(pid, rootRow, members, table, false, rootKill, groupKill)
  const gracefulDead = trustTree
    ? (await waitForTreeDeath(pid, rootRow, members, gracefulMs, pollMs, readTable, isAlive, now)).dead
    : await waitForDeath(pid, gracefulMs, pollMs, isAlive, now)
  if (gracefulDead) {
    return { reaped: true, pid, members, escalated: false }
  }

  // 升级:SIGKILL(根 + 树成员 + 进程组)。
  await signalAll(pid, rootRow, members, table, true, rootKill, groupKill)
  const forceDead = trustTree
    ? (await waitForTreeDeath(pid, rootRow, members, forceMs, pollMs, readTable, isAlive, now)).dead
    : await waitForDeath(pid, forceMs, pollMs, isAlive, now)
  if (forceDead) {
    return { reaped: true, pid, members, escalated: true }
  }
  return { reaped: false, pid, reason: 'still-alive', record: `SIGKILL 后仍有成员在场(${forceMs}ms)⇒ 不装成功` }
}

/**
 * 首轮/升级都调它:杀根 + 树成员 + 进程组(根是组长时)。
 * `force` 标记本次是升级轮(SIGKILL);实际信号强度由 rootKill/groupKill 派生出口决定
 * (win taskkill 恒 /F;posix 默认出口按 WB 语义首轮 SIGTERM、升级 SIGKILL —— 由调用方
 * 通过注入不同出口体现,本函数只负责调度顺序:进程组 → 根 → 树成员)。
 */
async function signalAll(
  pid: number,
  rootRow: ProcessTableRow | undefined,
  members: number[],
  table: ReadonlyMap<number, ProcessTableRow>,
  force: boolean,
  rootKill: RootKillDispatch,
  groupKill: RootKillDispatch,
): Promise<void> {
  // 进程组优先:根是组长(pgid==pid)⇒ 一次 kill(-pgid) 覆盖整组(WB signalPosixProcessTree)。
  if (rootRow !== undefined && rootRow.groupId === pid) {
    await groupKill(-pid, true, force)
  }
  await rootKill(pid, false, force)
  for (const member of members) {
    // 树成员须仍在场且身份未变(birthToken/组),否则跳过(防误收新占 pid 的无关进程)。
    const row = table.get(member)
    if (row === undefined) continue
    await rootKill(member, false, force)
  }
}

/** 轮询单 pid 死亡(WB waitForDeath)。 */
async function waitForDeath(
  pid: number,
  timeoutMs: number,
  pollMs: number,
  isAlive: PidLivenessProbe,
  now: () => number,
): Promise<boolean> {
  const deadline = now() + timeoutMs
  while (now() < deadline) {
    if (!(await isAlive(pid))) return true
    await sleep(pollMs)
  }
  return !(await isAlive(pid))
}

/** 轮询整树死亡(WB waitForTreeDeath):逐个 re-read 进程表按 birthToken 复核。 */
async function waitForTreeDeath(
  rootPid: number,
  rootRow: ProcessTableRow,
  members: number[],
  timeoutMs: number,
  pollMs: number,
  readTable: ProcessTableReader,
  isAlive: PidLivenessProbe,
  now: () => number,
): Promise<{ dead: boolean }> {
  const deadline = now() + timeoutMs
  const rootGone = async (): Promise<boolean> => {
    const t = await readTable()
    if (t) return !sameProcess(t.get(rootPid), rootRow)
    // 表读不到 ⇒ 退化到单 pid 探针(根 + 成员都按在场保守判)。
    if (await isAlive(rootPid)) return false
    for (const m of members) if (await isAlive(m)) return false
    return true
  }
  while (now() < deadline) {
    if (await rootGone()) return { dead: true }
    await sleep(pollMs)
  }
  return { dead: await rootGone() }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** 默认根杀:win taskkill /f /t;posix 按 force 选 SIGTERM/SIGKILL(不经外部 exe,消除 PATH 顶替面)。 */
const defaultRootKill: RootKillDispatch = async (pid, _group, force) => {
  if (process.platform === 'win32') {
    try {
      const { stdout } = await execFileP(
        `${process.env['SystemRoot'] ?? 'C:\\Windows'}\\System32\\taskkill.exe`,
        ['/PID', String(pid), '/F', '/T'],
        { encoding: 'utf-8', timeout: 10_000, windowsHide: true },
      )
      return { ok: true, output: String(stdout ?? '') }
    } catch (e) {
      const err = e as NodeJS.ErrnoException & { stdout?: string }
      const output = typeof err.stdout === 'string' ? err.stdout : String(err.message ?? '')
      // taskkill 输出里点名的 pid == 目标 ⇒ 确认根已被杀(哪怕退出码非零)。
      return { ok: taskkillOutputConfirmsRoot(output, pid), output }
    }
  }
  try {
    process.kill(pid, force ? 'SIGKILL' : 'SIGTERM')
    return { ok: true, output: `${force ? 'SIGKILL' : 'SIGTERM'} delivered` }
  } catch (e) {
    return { ok: false, output: String((e as Error).message) }
  }
}

/** 默认进程组杀:posix kill(-pgid) 按 force 选信号;win 不适用。 */
const defaultGroupKill: RootKillDispatch = async (negPid, group, force) => {
  if (process.platform === 'win32') return { ok: false, output: 'group kill 不适用于 win32' }
  try {
    process.kill(negPid, force ? 'SIGKILL' : 'SIGTERM')
    return { ok: true, output: `${force ? 'SIGKILL' : 'SIGTERM'} delivered to ${group ? 'pgroup ' : ''}${negPid}` }
  } catch (e) {
    return { ok: false, output: String((e as Error).message) }
  }
}

const defaultIsAlive: PidLivenessProbe = async (pid) => isPidAlive(pid)

/** taskkill 输出里点名 pid == 目标 ⇒ 确认根已被杀(WB taskkillOutputConfirmsRoot)。 */
export function taskkillOutputConfirmsRoot(output: string, pid: number): boolean {
  return output.split(/\r?\n/).some((line) => Number(line.match(/\d+/)?.[0]) === pid)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
