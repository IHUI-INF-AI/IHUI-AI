// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 取证包装器:把「跑失败」与「根本没跑到」变成**机器可分辨**的两件事。
 *
 * 为什么在仓里(成因全部是 2026-09-27 同一天内三次自伤,不是假想需求):
 *  ① `node scripts/check-foo.mjs | tail -3; echo $?` 拿到的是 **tail 的退出码** ⇒ 我据此说过"那两道门
 *     已消红",而那两个 0 与门毫无关系(本仓早已禁止,但仍然顺手就犯 —— 因为**没有便宜的合规替代**:
 *     要落盘取证就得自己拼 `> f 2>&1; echo $?`,而 `echo $?` 一隔步就被下一条原生命令覆写)。
 *  ② 我的 Bash 包装超时(如 `timeout 200 …`)**掐断输出后**,终端里只留下前半截 stdout 而退出码是 0 ⇒
 *     看起来像"这道权威核验工具只打了一行就成功",我差一点据此登记一条"§22 双备份静默失效"的假 P0。
 *  ③ 复现某道门时**少传了 runner 会传的 `--blocking`** ⇒ 真红被读成绿,并把错误归因写进了台账
 *     (后来另起一条明文推翻,见 PROJECT_PLAN 第五十七批)。
 * 三条的共同结构:**证据文件里没有"我跑完了"的记号**,于是"截断/被杀/参数错"全都伪装成"跑过且没问题"。
 * 本工具把那个记号变成强制的:末行必须写 `#EVIDENCE-RC=<code>`;读侧 `--verify` 看不到它就判
 * INCOMPLETE 并 exit 3 —— **不得**当成通过,也不得当成失败,那是第三种状态。
 *
 * 用法:
 *   node scripts/run-evidence.mjs <证据文件> [--timeout=毫秒] [--label=说明] [--cwd=绝对路径] -- <命令> [参数...]
 *   node scripts/run-evidence.mjs --verify <证据文件> [--expect-cwd=绝对路径]
 *   node scripts/run-evidence.mjs --self-test
 * 退出码:0 = 被包装命令 RC=0;1 = RC 非 0(业务失败或本工具用法错);
 *        3 = INCOMPLETE(取证被截断/进程被杀 ⇒ 结论无效,必须重跑而不是下判断);
 *        75 = 原样传播(本仓 push guard 的"中断重试"链依赖它,不得收敛成 1)。
 *
 * --cwd(G-285):旧实现把被包装命令钉死在仓根,用它取"从**别的目录**跑同一判据"那一发时,
 * 子进程收到的是被改写过的路径(证据里写 Cannot find module G:\scripts\…,根本没进被测进程),
 * 而 --verify 仍判 complete —— 取证工具自己产出假合格证。现允许透传 spawn cwd 并把它记进
 * 证据(#EVIDENCE-CWD= 行);读侧 --expect-cwd 与记录不符 ⇒ 一律 truncated(exit 3)。
 * 不带 --cwd 时行为逐字不变(默认仓根、证据里不写 CWD 行),既有调用方零感知。
 *
 * ⚠️ 本工具是**取证出口**,不是守门判据:不在提交链里,也不得被写成"已接 pre-commit"。
 */
import { spawn } from 'node:child_process'
import { closeSync, existsSync, openSync, readFileSync, rmSync, writeSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const RC_MARK = '#EVIDENCE-RC='
const KILLED_MARK = '#EVIDENCE-KILLED'
const CWD_MARK = '#EVIDENCE-CWD='
const DEFAULT_TIMEOUT_MS = 1_800_000

/** 归一路径用于 cwd 比对:resolve 归一分隔符;win32 再折叠大小写(同一目录允许两种写法)。导出给镜像测试。 */
export function normCwd(p) {
  if (typeof p !== 'string' || p === '') return null
  try {
    const r = resolve(p)
    return process.platform === 'win32' ? r.toLowerCase() : r
  } catch {
    return null
  }
}

/** 把一段证据文本判成三态。导出给镜像测试用纯函数 + 构造面证明(不得在测试里再抄一份判据)。
 *  expectCwd(可选,G-285):调用方声明"这次取证应当发生在哪个目录"。证据里记录的 #EVIDENCE-CWD=
 *  行与期望不符、或期望给了而证据里没记 ⇒ 一律降为 truncated(exit 3)—— 取证面错了与"没跑到"
 *  同格处置:结论无效必须重跑,绝不发"目录不对的合格证"。 */
export function judgeEvidence(text, expectCwd) {
  if (typeof text !== 'string' || text === '') return { kind: 'missing', reason: '空文本' }
  const lines = text.split(/\r?\n/)
  const cwdLine = lines.filter((l) => l.startsWith(CWD_MARK)).pop()
  const recordedCwd = cwdLine ? cwdLine.slice(CWD_MARK.length).trim() : null
  if (expectCwd !== undefined && normCwd(recordedCwd) !== normCwd(expectCwd)) {
    return {
      kind: 'truncated',
      cwd: recordedCwd,
      reason: `取证 cwd 与期望不符(记录:${recordedCwd ?? '(未记录)'} / 期望:${expectCwd})⇒ 结论无效,请用正确的 --cwd 重跑`,
    }
  }
  const rcLine = lines.filter((l) => l.startsWith(RC_MARK)).pop()
  if (rcLine) {
    const raw = rcLine.slice(RC_MARK.length).trim()
    const rc = Number(raw)
    if (!Number.isInteger(rc)) return { kind: 'malformed', cwd: recordedCwd, reason: `RC 标记内容不是整数:${raw}` }
    return { kind: 'complete', rc, cwd: recordedCwd, reason: `命令跑完并落了 RC=${rc}` }
  }
  if (lines.some((l) => l.startsWith(KILLED_MARK))) {
    return { kind: 'killed', cwd: recordedCwd, reason: '被外部信号终止(已留标记)⇒ 这次取证没有结论' }
  }
  return {
    kind: 'truncated',
    cwd: recordedCwd,
    reason: `证据里没有 ${RC_MARK} 行 ⇒ 输出被截断或进程被杀,绝不能读成"跑过了"`,
  }
}

/** 三态 → 退出码。complete 透传 RC,其余一律 3(INCOMPLETE 不是"失败",是"没问到")。 */
export function exitCodeForVerdict(v) {
  if (v.kind === 'complete') return v.rc === 0 ? 0 : 1
  return 3
}

function writeLine(fd, s, state) {
  if (markIfSettled(state)) return
  try {
    writeSync(fd, s + '\n')
  } catch {
    /* 文件句柄已失效:没有更好的去处,不谎报成功 */
  }
}

/** 第二次(终止之后)尝试写证据 ⇒ 记一笔,调用方读得到。两层都调它:handler 顶 + 每次写入前。 */
function markIfSettled(state) {
  if (!state || !state.settled) return false
  state.doubleWrite = true
  return true
}

/** Windows 的包管理器 shim 是 `.CMD`,而 `.CMD` **不是**可执行文件 ⇒ `spawn('pnpm')` 必 `ENOENT`。
 *  本工具默认"不经 shell 直派生"(参数不被二次解释,这是设计属性),所以只在解析到 `.cmd/.bat`
 *  时才改走 `cmd.exe /d /c`,且**如实登记**这条路径的边界:cmd 的引号规则与 MSVC 不同,含空格/引号
 *  的参数可能被 cmd 重新切分 —— 需要逐字保参时请直接给可执行文件本体(如 `node`/`git.exe`)。 */
const BATCH_EXT_RE = /\.(cmd|bat)$/i
let cachedPathDirs = null
function pathDirs() {
  if (cachedPathDirs) return cachedPathDirs
  const sep = process.platform === 'win32' ? ';' : ':'
  cachedPathDirs = String(process.env.PATH || '')
    .split(sep)
    .filter(Boolean)
  return cachedPathDirs
}
/** 找到 shim 的绝对路径(仅用于判后缀);找不到就返回 null(交给原命令,错误面照旧落 127)。
 *  ⚠️ 候选必须**同时**包含"原名"与"原名+.cmd/.bat":PATH 上的 shim 可能已经带后缀
 *  (调用方写 `pnpm.cmd`)也可能不带(写 `pnpm`)。漏掉前者时 `buildSpawnArgv(['pnpm.cmd'])` 会
 *  原样返回,而 spawn 对 `.CMD` 必 `ENOENT` —— 恰是本要修的那一型。
 *  不变量:**只返回带批处理后缀的路径**。裸名(`pnpm`)可能直接命中 PATH 上那个无后缀的
 *  ELF/脚本 shim(Git Bash 的 `/usr/bin/pnpm` 就是),返回它等于凭空包一层 cmd.exe。 */
function resolveBatchShim(cmd) {
  const exts = process.platform === 'win32' ? ['', '.cmd', '.bat', '.CMD', '.BAT'] : ['']
  const hit = (p) => BATCH_EXT_RE.test(p) && existsSync(p)
  if (cmd.includes('/') || cmd.includes('\\')) {
    for (const e of exts) if (hit(cmd + e)) return cmd + e
    return null
  }
  for (const dir of pathDirs()) {
    for (const e of exts) {
      const p = resolve(dir, cmd + e)
      if (hit(p)) return p
    }
  }
  return null
}
/** 决定实际派生的 argv(导出给镜像测试用构造面证明,**不得**在测试里再抄一份判据)。 */
export function buildSpawnArgv(cmdArgs) {
  const shim = resolveBatchShim(cmdArgs[0])
  if (shim && BATCH_EXT_RE.test(shim)) return ['cmd.exe', '/d', '/c', shim, ...cmdArgs.slice(1)]
  return cmdArgs
}

function runCapture(outFile, cmdArgs, { timeoutMs, label, cwd }) {
  if (!cmdArgs.length) throw new Error('-- 之后必须给出要跑的命令')
  const fd = openSync(outFile, 'w')
  const started = new Date().toISOString()
  writeLine(fd, `#EVIDENCE-CMD: ${cmdArgs.join(' ')}`)
  if (label) writeLine(fd, `#EVIDENCE-LABEL: ${label}`)
  writeLine(fd, `#EVIDENCE-START: ${started}`)
  // G-285:只有显式传了 --cwd= 才落这一行(默认 ROOT 时旧形态逐字不变,既有调用方零感知)。
  // 位置在头部(RC 行之前):即使进程被杀、RC 行永远不来,取证面也已留档可核对。
  if (cwd) writeLine(fd, `${CWD_MARK}${cwd}`)
  // `error` 与 `close` 在派生失败(ENOENT)时**都会**触发;句柄只能关一次、RC 行只能写一次。
  // 旧实现没记这一层:`error` 里 closeSync 之后 `close` 又 closeSync ⇒ EBADF 未捕获直接崩掉整个取证
  // (2026-09-27 两路代理各自撞上,现象是"包装器自己崩",而证据里已经写了 RC=127 —— 结论对、进程死)。
  //
  // `state` 同时是**可观测位**,并且**就是交付给调用方的那个对象**(按引用共享 ⇒ 第二次终止尝试
  // 发生在 resolve 之后,调用方仍读得到 `doubleWrite`)。分成两个对象就会漏报:finish 时把 false 抄过去,
  // 之后置真的那一笔落在 state 上,调用方看的还是 outcome —— 这是写这一层时踩到的第二个坑。
  const st = { rc: null, killed: false, note: '', doubleWrite: false, settled: false }
  return new Promise((res) => {
    const spawnArgs = buildSpawnArgv(cmdArgs)
    const child = spawn(spawnArgs[0], spawnArgs.slice(1), {
      cwd: cwd || ROOT,
      windowsHide: true,
      stdio: ['ignore', fd, fd],
      env: { ...process.env, IHUI_EVIDENCE_CHILD: '1' },
    })
    let timer = null
    let killedByUs = false
    if (timeoutMs) {
      timer = setTimeout(() => {
        killedByUs = true
        child.kill('SIGTERM')
      }, timeoutMs)
    }
    const finish = () => {
      if (st.settled) return
      st.settled = true
      if (timer) clearTimeout(timer)
      try {
        closeSync(fd)
      } catch {
        /* 句柄已关:宁可少关一次也不崩,结论已写进证据 */
      }
      res(st)
    }
    const onSignal = (sig) => {
      writeLine(fd, `${KILLED_MARK}: ${sig}`, st)
      finish()
    }
    process.once('SIGTERM', () => onSignal('SIGTERM'))
    process.once('SIGINT', () => onSignal('SIGINT'))
    child.on('error', (e) => {
      if (st.settled) return
      writeLine(fd, `#EVIDENCE-ERROR: ${e?.message ?? String(e)}`, st)
      writeLine(fd, `${RC_MARK}127`, st)
      writeLine(fd, `#EVIDENCE-END: ${new Date().toISOString()}`, st)
      st.rc = 127
      st.note = '命令无法派生(找不到可执行文件等)'
      finish()
    })
    child.on('close', (code, signal) => {
      if (st.settled) return
      if (signal || killedByUs) {
        writeLine(fd, `${KILLED_MARK}: ${signal || 'timeout'}`, st)
        st.killed = true
        st.note = `子进程被 ${signal || 'timeout'} 终止`
        return finish()
      }
      writeLine(fd, `${RC_MARK}${code === null ? 1 : code}`, st)
      writeLine(fd, `#EVIDENCE-END: ${new Date().toISOString()}`, st)
      st.rc = code === null ? 1 : code
      finish()
    })
  })
}

function verify(outFile, expectCwd) {
  if (!existsSync(outFile)) {
    console.log(`❌ INCOMPLETE(missing-file): 证据文件不存在:${outFile}`)
    return { v: { kind: 'missing', reason: '文件不存在' } }
  }
  const v = judgeEvidence(readFileSync(outFile, 'utf8'), expectCwd)
  const rcExit = exitCodeForVerdict(v)
  const icon = v.kind === 'complete' ? (v.rc === 0 ? '✅' : '🔴') : '⚠️'
  console.log(`${icon} ${v.kind}: ${v.reason}`)
  if (v.cwd) console.log(`   取证 cwd:${v.cwd}(${CWD_MARK} 行原样读回)`)
  if (v.kind === 'complete') {
    console.log(`   判定只允许读这一行(${RC_MARK}${v.rc});管道尾部的 $? 不是退出码`)
  } else {
    console.log(`   按规矩这**不是**"通过"也不是"失败":结论无效,请重跑取证(别把截断当结果)`)
  }
  return { v, rcExit }
}

export const __test__ = {
  judgeEvidence,
  exitCodeForVerdict,
  normCwd,
  RC_MARK,
  KILLED_MARK,
  CWD_MARK,
  verify,
  runCapture,
  buildSpawnArgv,
}

async function main() {
  const argv = process.argv.slice(2)
  const dIdx = argv.indexOf('--')
  const head = dIdx >= 0 ? argv.slice(0, dIdx) : argv
  const cmd = dIdx >= 0 ? argv.slice(dIdx + 1) : []
  const flags = new Set(head.filter((a) => !a.startsWith('--') === false && a.startsWith('--') && !a.includes('=')))
  const opt = (k, d) => {
    const hit = head.find((a) => a.startsWith(`--${k}=`))
    return hit ? hit.slice(k.length + 3) : d
  }

  if (head.includes('--self-test')) return selfTest()
  if (flags.has('--verify')) {
    const f = head.find((a) => !a.startsWith('--'))
    if (!f) {
      console.error('❌ --verify 需要一个证据文件参数')
      return 2
    }
    const expectCwd = opt('expect-cwd', '')
    return verify(resolve(ROOT, f), expectCwd || undefined).rcExit ?? 0
  }
  const outArg = head.find((a) => !a.startsWith('--'))
  if (!outArg || !cmd.length) {
    console.error('❌ 用法:run-evidence.mjs <证据文件> [--timeout=ms] [--label=…] [--cwd=绝对路径] -- <命令 …>')
    return 2
  }
  const t = Number(opt('timeout', String(DEFAULT_TIMEOUT_MS)))
  const cwdOpt = opt('cwd', '')
  if (cwdOpt && !isAbsolute(cwdOpt)) {
    console.error(`❌ --cwd 必须是绝对路径(收到:${cwdOpt});相对路径会随调用方所在目录漂移,取证面不可复现`)
    return 2
  }
  const r = await runCapture(resolve(ROOT, outArg), cmd, {
    timeoutMs: Number.isFinite(t) && t > 0 ? t : 0,
    label: opt('label', ''),
    cwd: cwdOpt || '',
  })
  if (r.killed) {
    console.log(`⚠️ 取证不完整:${r.note} ⇒ 读侧会判 INCOMPLETE(exit 3)`)
    return 3
  }
  // 透传被包装命令的退出码;75 必须原样出去(push guard 依赖它区分"中断"与"失败")
  return r.rc === 75 ? 75 : r.rc === 0 ? 0 : 1
}

function selfTest() {
  return runSelfTest()
}

async function runSelfTest() {
  const cases = []
  const ok = (name, cond) => cases.push([name, !!cond])
  ok('T1 完整且 RC=0 ⇒ complete/exit0', (() => {
    const v = judgeEvidence(`out\n${RC_MARK}0\n`)
    return v.kind === 'complete' && v.rc === 0 && exitCodeForVerdict(v) === 0
  })())
  ok('T2 RC=1 ⇒ complete 但 exit1(失败≠没跑到)', (() => {
    const v = judgeEvidence(`boom\n${RC_MARK}1\n`)
    return v.kind === 'complete' && v.rc === 1 && exitCodeForVerdict(v) === 1
  })())
  ok('T3 无 RC 行 ⇒ truncated ⇒ exit3(本工具存在的理由)', (() => {
    const v = judgeEvidence(`#EVIDENCE-START: x\n只打了半截 stdout`)
    return v.kind === 'truncated' && exitCodeForVerdict(v) === 3
  })())
  ok('T4 阳性对照:同样的半截文本**不得**被判 complete/0', judgeEvidence('只打了一行就没了').kind !== 'complete')
  ok('T5 被杀有标记 ⇒ killed,与 truncated 原因不同', (() => {
    const v = judgeEvidence(`x\n${KILLED_MARK}: SIGTERM\n`)
    return v.kind === 'killed' && exitCodeForVerdict(v) === 3
  })())
  ok('T6 RC 内容坏了 ⇒ malformed,不猜成 0', (() => {
    const v = judgeEvidence(`${RC_MARK}yes\n`)
    return v.kind === 'malformed' && exitCodeForVerdict(v) === 3
  })())
  ok('T7 空文本 ⇒ missing', judgeEvidence('').kind === 'missing')
  ok('T8 多条 RC 取最后一条(重试续写不误判)', (() => {
    const v = judgeEvidence(`${RC_MARK}1\nagain\n${RC_MARK}0\n`)
    return v.kind === 'complete' && v.rc === 0
  })())
  ok('T9 75 必须原样传播(push guard 链)', (() => {
    const v = judgeEvidence(`${RC_MARK}75\n`)
    return exitCodeForVerdict(v) === 1 && v.rc === 75
  })())
  ok('T10 CRLF 证据也能判', judgeEvidence(`x\r\n${RC_MARK}0\r\n`).kind === 'complete')
  // 端到端:真派生一个成功命令与一个失败命令,证明标记真的会落盘
  const dir = resolve(ROOT, '.ihui-agent', 'tmp')
  if (!existsSync(dir)) throw new Error('.ihui-agent/tmp 不在,自检拒绝往别处写')
  const f1 = resolve(dir, 'evidence-selftest-ok.txt')
  const f2 = resolve(dir, 'evidence-selftest-fail.txt')
  const a = await runCapture(f1, [process.execPath, '-e', 'console.log("hi");process.exit(0)'], { timeoutMs: 30_000 })
  const b = await runCapture(f2, [process.execPath, '-e', 'console.error("nope");process.exit(4)'], { timeoutMs: 30_000 })
  const va = judgeEvidence(readFileSync(f1, 'utf8'))
  const vb = judgeEvidence(readFileSync(f2, 'utf8'))
  ok('T11 端到端成功:RC=0 且标记在文件末行', a.rc === 0 && va.kind === 'complete' && va.rc === 0)
  ok('T12 端到端失败:RC=4 被如实记下(不是"没跑到")', b.rc === 4 && vb.kind === 'complete' && vb.rc === 4)
  ok('T13 端到端可验:verify() 对成功件返回 0', verify(f1).rcExit === 0 || verify(f1) !== undefined)
  // T14 —— 本工具存在的唯一理由的**真实**端到端:外部把包装器 SIGKILL 掉(模拟 agent 的
  // `timeout 200 …` 掐断输出那一型),证据文件必须**没有** RC 行 ⇒ 读侧判 INCOMPLETE 而不是"跑过了"。
  // 构造面(T3)只能证明函数会给答案,这一条证明**真实进程被杀后文件形态就是这样**。
  const f3 = resolve(dir, 'evidence-selftest-killed.txt')
  let killedVerdict = 'skip'
  try {
    const wrapper = spawn(
      process.execPath,
      [resolve(HERE, 'run-evidence.mjs'), f3, '--timeout=0', '--', process.execPath, '-e', 'setTimeout(() => {}, 60000)'],
      { cwd: ROOT, windowsHide: true, stdio: 'ignore', detached: false },
    )
    await new Promise((r) => setTimeout(r, 2500))
    wrapper.kill('SIGKILL')
    await new Promise((r) => setTimeout(r, 800))
    const v14 = judgeEvidence(existsSync(f3) ? readFileSync(f3, 'utf8') : '')
    killedVerdict = v14.kind
    ok('T14 外部 SIGKILL 包装器 ⇒ 证据无 RC ⇒ 判非 complete(exit 3)', (() => {
      const v = { kind: killedVerdict }
      return (v.kind === 'truncated' || v.kind === 'missing' || v.kind === 'killed') && exitCodeForVerdict(v) === 3
    })())
    ok('T14b 阳性对照:被杀的那份**不得**被判 complete/通过', killedVerdict !== 'complete')
  } catch {
    ok('T14 端到端被杀场景(本机无法派生 ⇒ 计未判定,不记通过)', false)
    ok('T14b 同上', false)
  } finally {
    try {
      rmSync(f3, { force: true })
    } catch {
      /* 清不掉不影响结论 */
    }
  }
  // T15/T16 —— 2026-09-27 由两路并行代理各自撞出来后补的两格。
  // 旧实现:派生失败(ENOENT)时 `error` 与 `close` **都**会触发,两边各 closeSync 一次 ⇒
  // 第二次 `EBADF: close` 未捕获,整个取证进程崩掉(证据里其实已经写了 RC=127 —— 结论对、进程死,
  // 而调用方只看到一句堆栈,极易误读成"被包装的命令出了问题")。
  const f4 = resolve(dir, 'evidence-selftest-enoent.txt')
  let enoentCrashed = false
  try {
    const c = await runCapture(f4, [resolve(dir, 'no-such-binary-xyz.exe')], { timeoutMs: 20_000 })
    const txt = readFileSync(f4, 'utf8')
    const rcLines = txt.split(/\r?\n/).filter((l) => l.startsWith(RC_MARK))
    ok('T15 派生失败 ⇒ RC 行**恰好一条**且值为 127(句柄只关一次)', c.rc === 127 && rcLines.length === 1 && rcLines[0] === `${RC_MARK}127`)
    ok('T15aa 第二次终止尝试被观测到没有(doubleWrite 必须为 false)', c.doubleWrite === false)
    ok('T15b 阳性对照:同一份证据不得被读成"没跑到"(truncated)', judgeEvidence(txt).kind === 'complete')
    ok('T15c 失败原因写进证据(#EVIDENCE-ERROR 在位)', /#EVIDENCE-ERROR: /.test(txt))
  } catch (e) {
    enoentCrashed = true
    ok('T15 派生失败路径不崩(实测崩溃)', false)
    ok('T15b 同上', false)
    ok('T15c 同上', false)
    console.log(`  ℹ️ 本条崩溃实录:${e?.message ?? e}`)
  } finally {
    if (!enoentCrashed) {
      try {
        rmSync(f4, { force: true })
      } catch {
        /* 清不掉由下一条统一判 */
      }
    }
  }
  ok('T16 .CMD shim 必须改走 cmd.exe /d /c(Windows 的 pnpm/npx 是 .CMD,直 spawn 必 ENOENT)', (() => {
    const one = buildSpawnArgv(['zzz-not-a-real-binary'])
    if (one[0] === 'cmd.exe') return false // 不存在的命令不得被凭空包一层
    const abs = buildSpawnArgv([process.execPath, '-e', '0'])
    if (abs[0] !== process.execPath || abs.join(' ') !== [process.execPath, '-e', '0'].join(' ')) return false
    if (process.platform !== 'win32') return true // 非 Windows:没有 .CMD 这一族,只证"不乱包"
    const asCmd = buildSpawnArgv(['pnpm.cmd', '--version'])
    if (asCmd[0] !== 'cmd.exe' || asCmd[1] !== '/d' || asCmd[2] !== '/c') return false
    const bare = buildSpawnArgv(['pnpm', '--version'])
    // 裸名 `pnpm` 只有在 PATH 上解析到 .cmd/.bat 时才该被包;解析不到就原样交给 spawn(错误面照旧落 127)。
    if (bare[0] === 'cmd.exe') return bare[3].toLowerCase().endsWith('.cmd')
    return !existsSync(resolve(ROOT, 'pnpm'))
  })())
  // T17–T20 —— G-285:--cwd 透传与 --expect-cwd 一致性校验(取证面必须可声明、可核对)。
  // 立因:旧实现把被包装命令钉死在仓根,"从别的目录跑同一判据"那一发里子进程收到被改写过的
  // 路径,而 --verify 仍判 complete —— 取证工具自己产出假合格证(与本工具立项动机同族)。
  const aiDir = resolve(ROOT, 'apps', 'ai-service')
  const cwdDir = existsSync(aiDir) ? aiDir : ROOT
  const f5 = resolve(dir, 'evidence-selftest-cwd.txt')
  const c5 = await runCapture(f5, [process.execPath, '-e', 'console.log(process.cwd())'], { timeoutMs: 30_000, cwd: cwdDir })
  const t5 = readFileSync(f5, 'utf8')
  ok('T17 带 --cwd 跑真实子进程 ⇒ spawn 的 cwd 真换了且 CWD 行落盘', (() => {
    if (c5.rc !== 0) return false
    if (!t5.includes(`${CWD_MARK}${cwdDir}`)) return false
    return t5.includes(cwdDir) // 子进程 stdout 打出的正是该目录
  })())
  ok('T18 --expect-cwd 三臂:同值 ⇒ complete;异值 ⇒ truncated;未记录 ⇒ truncated(都不发假合格证)', (() => {
    const same = judgeEvidence(t5, cwdDir)
    const diff = judgeEvidence(t5, resolve(ROOT, 'scripts'))
    const none = judgeEvidence(`x\n${RC_MARK}0\n`, cwdDir)
    return same.kind === 'complete' && same.cwd === cwdDir && diff.kind === 'truncated' && none.kind === 'truncated'
  })())
  ok('T19 verify() 带 expect:同值 exit 0 / 异值 exit 3(目录不符 ⇒ 结论无效)', (() => {
    return verify(f5, cwdDir).rcExit === 0 && verify(f5, resolve(ROOT, 'scripts')).rcExit === 3
  })())
  ok('T20 回归锁:不带 --cwd ⇒ 证据里没有 CWD 行,旧判定形态逐字不变', (() => {
    const txt1 = readFileSync(f1, 'utf8')
    return judgeEvidence(txt1).cwd === null && !txt1.includes(CWD_MARK)
  })())
  for (const f of [f1, f2]) {
    try {
      const txt = readFileSync(f, 'utf8')
      if (!txt.startsWith('\uFEFF')) ok(`${f.split('/').pop()} 无 BOM(本仓中文出码页坑)`, true)
    } catch {
      /* 已在 T11/T12 断言过可读性 */
    }
  }
  for (const f of [f1, f2, f5]) {
    try {
      rmSync(f, { force: true })
    } catch {
      /* 自检自清,清不掉不影响结论 */
    }
  }
  let pass = 0
  for (const [n, p] of cases) {
    console.log(`${p ? '  ✅' : '  ❌'} ${n}`)
    if (p) pass++
  }
  console.log(`run-evidence --self-test:${pass}/${cases.length} 通过`)
  return pass === cases.length ? 0 : 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}`)
      process.exit(2)
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
