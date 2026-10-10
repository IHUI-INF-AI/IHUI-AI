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
 *   node scripts/run-evidence.mjs <证据文件> [--timeout=<毫秒|45000ms|180s|2m>] [--label=说明] [--cwd=绝对路径] -- <命令> [参数...]
 *   node scripts/run-evidence.mjs --verify <证据文件> [--expect-cwd=绝对路径]
 *   node scripts/run-evidence.mjs --self-test
 *   ⚠️ `--timeout` 的**默认单位是毫秒**;裸数字小于 2000 会被当成用法错误直接拒绝
 *      (它几乎总是"把毫秒当秒" —— 见 parseTimeoutMs 的注释),要写短时长请带后缀(`250ms`)。
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
/* eslint-disable no-console -- 本工具是 CLI 取证包装器,结论必须走 console(与 check-*.mjs 同形)。
   注:该文件此前经**对象空间落地**入库,那条通道不跑 lint-staged,所以这一族 console 警告
   在 HEAD 里安静地存在了一整天 —— 见 AGENTS.md §12「造好没装车」同族的落地侧版本。 */
import { spawn, spawnSync } from 'node:child_process'
import {
  closeSync,
  existsSync,
  fstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  rmSync,
  writeSync,
} from 'node:fs'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const RC_MARK = '#EVIDENCE-RC='
const KILLED_MARK = '#EVIDENCE-KILLED'
const CWD_MARK = '#EVIDENCE-CWD='
const DEFAULT_TIMEOUT_MS = 1_800_000
/**
 * 裸数字(不带单位后缀)允许的最小毫秒数。低于它一律判用法错误 —— 2 秒以内的取证上限
 * 在现实里没有合法用途(真要有,写 `250ms` 就是明确意图,那条通道照常放行)。
 */
const BARE_TIMEOUT_MIN_MS = 2000

/**
 * 证据文件落点:相对路径一律按**仓库根**解释,且拒绝逃逸仓库根。
 * 为什么加这一层(2026-09-27 由我自己的一次调用撞出来):旧写法直接 `resolve(ROOT, f)`,
 * 于是在 `apps/miniapp-taro/` 下传 `../../.ihui-agent/tmp/x.txt` 会被算成
 * `<盘根>\.ihui-agent\...` —— 一次手滑就把取证文件写到盘根(§15/§28 明令禁止的落点,
 * 而守门 26 会把它算成父目录污染)。绝对路径不在此限(临时物落点由调用方按 §15b/§26 负责),
 * 但最终落点会打进输出,让"写到哪儿了"当场可见,而不是事后靠 ENOENT 反推。
 */
export function resolveEvidencePath(f, root = ROOT) {
  const abs = isAbsolute(f)
  const p = abs ? f : resolve(root, f)
  if (!abs) {
    const rel = relative(root, p)
    if (rel === '' || rel.startsWith('..' + sep) || isAbsolute(rel)) {
      throw new Error(
        `证据文件路径逃出了仓库根:${JSON.stringify(f)} → ${p}` +
          `(相对路径按仓库根解释;要写到仓库外请传绝对路径,并自行确认那是 §15b/§26 批准的落点)`,
      )
    }
  }
  return p
}

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
    if (!Number.isInteger(rc))
      return { kind: 'malformed', cwd: recordedCwd, reason: `RC 标记内容不是整数:${raw}` }
    return { kind: 'complete', rc, cwd: recordedCwd, reason: `命令跑完并落了 RC=${rc}` }
  }
  if (lines.some((l) => l.startsWith(KILLED_MARK))) {
    return {
      kind: 'killed',
      cwd: recordedCwd,
      reason: '被外部信号终止(已留标记)⇒ 这次取证没有结论',
    }
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

/** 单位后缀 → 倍数。只在这一处出现一次;调用方**不得**再抄一份换算。 */
const TIMEOUT_UNIT_MULT = { ms: 1, s: 1000, m: 60_000 }
/** `<数字>[<单位>]` 的**唯一**形状判据(下划线可当千位分隔;后缀大小写不敏感)。 */
const TIMEOUT_VALUE_RE = /^(\d[\d_]*\d|\d)(ms|s|m)?$/i

/**
 * `--timeout` 的解析 + 单位陷阱防线。返回 `{ ms }`(0 = 不设上限)或 `{ error }`
 * (error 就是要打给用户的那句话,**只许这一份文案**)。
 *
 * 为什么必须有这道拒绝(2026-09-29 本机实录,不是假想需求):本旗标的单位是**毫秒**,
 * 而当天主会话按直觉连传 `--timeout=180`、`--timeout=300`、`--timeout=560`,以为是秒。
 * 实际效果是包装器在 **180 毫秒 / 300 毫秒**后就把子进程 SIGTERM,于是:
 *  · `git fetch` 被报成"零输出、被杀" ⇒ 据此判成"git 网络卡死",差点写成一张生产故障票;
 *  · `node scripts/check-plan-line-loss.mjs` 也"超时",而同一条命令直接跑 **2 秒**就 rc=0。
 * 真正的杀伤在第二层:产出的证据文件与"命令真的挂死"**逐字同形**(有 `#EVIDENCE-KILLED`、
 * 没有 `#EVIDENCE-RC=`),读侧判 `killed` / exit 3 —— 判据本身是对的,但它把"我用错了单位"
 * 伪装成了"世界坏了"。本仓反复登记过"失效表现为安静"那一族,这一型是它的近亲:
 * **工具没有拒绝一个必然写错的入参,反而忠实地产出一份误导性的证据。**
 *
 * 三条判据(各有成对用例,见 --self-test T23–T25 与镜像 T17–T18):
 *  ① 裸数字 0 < n < 2000 ⇒ 用法错误(exit 2),消息点名单位并给出两种正确写法;
 *  ② **带显式后缀**的小值一律放行(`250ms` 是明确意图,拦它就是把工具用成障碍);
 *  ③ `0` 仍然合法且语义不变(= 不设上限;自检 T14 依赖它)。
 * 形状判不出的(`abc`、`-5`、空串、`30_` 这类)一律**判死**,不得回落到默认值 ——
 * 静默采用 1_800_000 等于把"没听懂"伪装成"听懂了"。
 */
export function parseTimeoutMs(raw) {
  const text = String(raw ?? '').trim()
  const m = TIMEOUT_VALUE_RE.exec(text)
  if (!m) {
    return {
      error:
        `--timeout 的值看不懂:${JSON.stringify(text)}。允许 300000 / 45000ms / 180s / 2m` +
        `(下划线可当千位分隔,后缀大小写不敏感;0 = 不设上限)`,
    }
  }
  const n = Number(m[1].replace(/_/g, ''))
  const unit = (m[2] ?? '').toLowerCase()
  if (!Number.isFinite(n)) {
    return { error: `--timeout 的值不是有限数字:${JSON.stringify(text)}` }
  }
  if (unit === '' && n > 0 && n < BARE_TIMEOUT_MIN_MS) {
    return {
      error:
        `--timeout 的单位是**毫秒**;你给的 ${n} 会被当成 ${n} 毫秒(${n / 1000} 秒),那不是你要的意思。` +
        `请写 --timeout=${n * 1000} 或 --timeout=${n}s。`,
    }
  }
  const ms = n * (TIMEOUT_UNIT_MULT[unit] ?? 1)
  return { ms: ms > 0 ? ms : 0 }
}

function writeLine(fd, s, state) {
  if (markIfSettled(state)) return
  // **标记必须独占一行**(2026-09-29 实测的假"截断"):被包装的命令常常不以换行收尾
  // (最典型是 `cat <一个末尾没有换行的文件>`),旧写法直接把 `#EVIDENCE-RC=0` 接在那半行后面 ⇒
  // 读侧按"行首"找标记找不到 ⇒ 一次**完整**的取证被判成 truncated。
  // 方向是"少发合格证"(安全侧),但代价是证据作废、逼人重跑,而重跑那次若真被截断就永远分不清。
  // 判据:文件非空且最后一个字节不是 `\n`(含只落 `\r` 的 CRLF 半截)⇒ 先补一个换行。
  if (state?.outFile) ensureLineStart(fd, state.outFile)
  try {
    writeSync(fd, s + '\n')
  } catch {
    /* 文件句柄已失效:没有更好的去处,不谎报成功 */
  }
}

/** 只在"要写的是标记行"时用:量最后一个字节,不是换行就先补一个换行。 */
function ensureLineStart(fd, outFile) {
  try {
    const size = fstatSync(fd).size
    if (size === 0) return
    const rfd = openSync(outFile, 'r')
    try {
      const buf = Buffer.alloc(1)
      readSync(rfd, buf, 0, 1, size - 1)
      if (buf[0] !== 0x0a) writeSync(fd, '\n')
    } finally {
      closeSync(rfd)
    }
  } catch {
    /* 量不到就照旧写:这一层是加固,不是判据,不得因为它失败而把已跑完的取证作废 */
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
  // 证据落点常在共享临时目录里,会被别的会话或清理层连带删掉;目录缺失时 openSync 抛
  // ENOENT,这一次取证就成了"包装器自己产出的没跑到"—— 先建父目录再开句柄。
  mkdirSync(dirname(outFile), { recursive: true })
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
  const st = { rc: null, killed: false, note: '', doubleWrite: false, settled: false, outFile }
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
        // 判定语义一字未动(killed ⇒ exit 3),只把**生效上限的毫秒数**写进文案:
        // 2026-09-29 那次误诊的全部代价,就出在这行只说"被 SIGTERM 终止"而不说"上限是 300ms"
        // —— 读到"被杀"的人只会去查世界,不会去查自己传的那个数。
        st.note = killedByUs
          ? `子进程被**本工具自己的计时器**终止(生效上限 ${timeoutMs}ms)` +
            (timeoutMs < BARE_TIMEOUT_MIN_MS
              ? ` —— 上限不足 2 秒,极可能是把毫秒当成了秒;要 300 秒请写 --timeout=300s`
              : '')
          : `子进程被外部信号 ${signal} 终止`
        return finish()
      }
      writeLine(fd, `${RC_MARK}${code === null ? 1 : code}`, st)
      writeLine(fd, `#EVIDENCE-END: ${new Date().toISOString()}`, st)
      st.rc = code === null ? 1 : code
      finish()
    })
  })
}

function verify(outFile, expectCwd, quiet) {
  if (!existsSync(outFile)) {
    if (!quiet) console.log(`❌ INCOMPLETE(missing-file): 证据文件不存在:${outFile}`)
    const v = { kind: 'missing', reason: '文件不存在' }
    // 这一支以前只 return { v } 不带 rcExit,而调用方写的是 `.rcExit ?? 0` ⇒ 一份**根本不存在**的
    // 证据以 exit 0 收工,正是本工具立身要防的"把没跑到读成跑到"。现在两支都走同一把尺子。
    return { v, rcExit: exitCodeForVerdict(v) }
  }
  const v = judgeEvidence(readFileSync(outFile, 'utf8'), expectCwd)
  const rcExit = exitCodeForVerdict(v)
  if (quiet) return { v, rcExit }
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

/** 本工具自己认识的**带值**开关 —— 一律只认 `--k=v` 形态。 */
export const VALUE_FLAGS = ['cwd', 'timeout', 'label', 'expect-cwd']
/** 本工具认识的**布尔**开关。 */
export const BOOLEAN_FLAGS = ['verify', 'self-test']

export const __test__ = {
  judgeEvidence,
  exitCodeForVerdict,
  normCwd,
  parseTimeoutMs,
  RC_MARK,
  KILLED_MARK,
  CWD_MARK,
  verify,
  runCapture,
  buildSpawnArgv,
  validateHead,
  VALUE_FLAGS,
  BOOLEAN_FLAGS,
}

const USAGE_LINE =
  'run-evidence.mjs <证据文件> [--timeout=毫秒|45000ms|180s|2m] [--label=…] [--cwd=绝对路径] -- <命令 …>;读侧 --verify <证据文件> [--expect-cwd=绝对路径]'

/**
 * 判 `--` 之前那段参数的形态,返回人类可读的错误列表(空数组 = 合法)。
 *
 * 为什么这是判据而不是洁癖:`opt()` 只解析 `--k=v`,于是
 * `--cwd G:/x`(空格形式)会被**静默忽略** —— 被包装的判据跑在仓根,而证据里连
 * `#EVIDENCE-CWD=` 行都不写,`--verify` 照样判 complete。实测代价:一次"在 apps/web
 * 跑两个测试文件"的取证收成了 38 个文件(19 个失败全是 `.ihui-agent/tmp/**` 里的仓内副本),
 * 差点把副本的失败登记成端内缺陷。工具把自己的失败伪装成"跑过了",比不跑更贵。
 * 位置参数多出一个也在这里点名:那通常就是被吞掉的 flag 值。
 */
export function validateHead(head) {
  const errors = []
  for (const a of head) {
    if (!a.startsWith('--')) continue
    const eq = a.indexOf('=')
    const name = eq < 0 ? a.slice(2) : a.slice(2, eq)
    if (eq < 0) {
      if (VALUE_FLAGS.includes(name))
        errors.push(
          `--${name} 必须写成 --${name}=<值>;空格形式会被静默忽略并改用默认值 ⇒ 取证面不是你要问的那一面`,
        )
      else if (!BOOLEAN_FLAGS.includes(name))
        errors.push(
          `不认识开关 --${name}(带值开关:${VALUE_FLAGS.join('/')};布尔开关:${BOOLEAN_FLAGS.join('/')})`,
        )
    } else if (!VALUE_FLAGS.includes(name)) {
      errors.push(`不认识开关 --${name}=(本工具没有这个选项)`)
    }
  }
  const positionals = head.filter((a) => !a.startsWith('--'))
  if (positionals.length > 1)
    errors.push(
      `参数里多出 ${positionals.length - 1} 个位置参数(${positionals.slice(1).join(', ')})⇒ 像是某个 --flag 的值被空格形式吞掉了`,
    )
  return errors
}

async function main() {
  const argv = process.argv.slice(2)
  const dIdx = argv.indexOf('--')
  const head = dIdx >= 0 ? argv.slice(0, dIdx) : argv
  const cmd = dIdx >= 0 ? argv.slice(dIdx + 1) : []
  // 先判参数形态,再动手:一个被静默忽略的 `--cwd` 会让整份证据落在错误的目录上,
  // 而证据里连"CWD 没记录"这条痕迹都没有 ⇒ 判据从"没跑到"退化成"跑过且没问题"。
  const headErrors = validateHead(head)
  if (headErrors.length) {
    for (const e of headErrors) console.error(`❌ ${e}`)
    console.error(`   用法:${USAGE_LINE}`)
    return 2
  }
  const flags = new Set(
    head.filter((a) => !a.startsWith('--') === false && a.startsWith('--') && !a.includes('=')),
  )
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
    let fp
    try {
      fp = resolveEvidencePath(f)
    } catch (e) {
      console.error(`❌ ${e.message}`)
      return 2
    }
    // 退出码一律由那**一把**尺子算,不读 verify() 带回的 rcExit,也不写 `?? 0` ——
    // "读不到就 0"会把任何一种新增未设 rcExit 的分支伪装成"取证完成且成功"。
    if (expectCwd) return exitCodeForVerdict(verify(fp, expectCwd).v)
    return exitCodeForVerdict(verify(fp).v)
  }
  const outArg = head.find((a) => !a.startsWith('--'))
  if (!outArg || !cmd.length) {
    console.error(
      '❌ 用法:run-evidence.mjs <证据文件> [--timeout=毫秒|45000ms|180s|2m] [--label=…] [--cwd=绝对路径] -- <命令 …>',
    )
    return 2
  }
  const t = parseTimeoutMs(opt('timeout', String(DEFAULT_TIMEOUT_MS)))
  if (t.error) {
    console.error(`❌ ${t.error}`)
    return 2
  }
  const cwdOpt = opt('cwd', '')
  if (cwdOpt && !isAbsolute(cwdOpt)) {
    console.error(
      `❌ --cwd 必须是绝对路径(收到:${cwdOpt});相对路径会随调用方所在目录漂移,取证面不可复现`,
    )
    return 2
  }
  let outPath
  try {
    outPath = resolveEvidencePath(outArg)
  } catch (e) {
    console.error(`❌ ${e.message}`)
    return 2
  }
  const r = await runCapture(outPath, cmd, {
    timeoutMs: t.ms,
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
  ok(
    'T1 完整且 RC=0 ⇒ complete/exit0',
    (() => {
      const v = judgeEvidence(`out\n${RC_MARK}0\n`)
      return v.kind === 'complete' && v.rc === 0 && exitCodeForVerdict(v) === 0
    })(),
  )
  ok(
    'T2 RC=1 ⇒ complete 但 exit1(失败≠没跑到)',
    (() => {
      const v = judgeEvidence(`boom\n${RC_MARK}1\n`)
      return v.kind === 'complete' && v.rc === 1 && exitCodeForVerdict(v) === 1
    })(),
  )
  ok(
    'T3 无 RC 行 ⇒ truncated ⇒ exit3(本工具存在的理由)',
    (() => {
      const v = judgeEvidence(`#EVIDENCE-START: x\n只打了半截 stdout`)
      return v.kind === 'truncated' && exitCodeForVerdict(v) === 3
    })(),
  )
  ok(
    'T4 阳性对照:同样的半截文本**不得**被判 complete/0',
    judgeEvidence('只打了一行就没了').kind !== 'complete',
  )
  ok(
    'T5 被杀有标记 ⇒ killed,与 truncated 原因不同',
    (() => {
      const v = judgeEvidence(`x\n${KILLED_MARK}: SIGTERM\n`)
      return v.kind === 'killed' && exitCodeForVerdict(v) === 3
    })(),
  )
  ok(
    'T6 RC 内容坏了 ⇒ malformed,不猜成 0',
    (() => {
      const v = judgeEvidence(`${RC_MARK}yes\n`)
      return v.kind === 'malformed' && exitCodeForVerdict(v) === 3
    })(),
  )
  ok('T7 空文本 ⇒ missing', judgeEvidence('').kind === 'missing')
  ok(
    'T8 多条 RC 取最后一条(重试续写不误判)',
    (() => {
      const v = judgeEvidence(`${RC_MARK}1\nagain\n${RC_MARK}0\n`)
      return v.kind === 'complete' && v.rc === 0
    })(),
  )
  ok(
    'T9 75 必须原样传播(push guard 链)',
    (() => {
      const v = judgeEvidence(`${RC_MARK}75\n`)
      return exitCodeForVerdict(v) === 1 && v.rc === 75
    })(),
  )
  ok('T10 CRLF 证据也能判', judgeEvidence(`x\r\n${RC_MARK}0\r\n`).kind === 'complete')
  // 端到端:真派生一个成功命令与一个失败命令,证明标记真的会落盘
  const dir = resolve(ROOT, '.ihui-agent', 'tmp')
  if (!existsSync(dir)) throw new Error('.ihui-agent/tmp 不在,自检拒绝往别处写')
  const f1 = resolve(dir, 'evidence-selftest-ok.txt')
  const f2 = resolve(dir, 'evidence-selftest-fail.txt')
  const a = await runCapture(f1, [process.execPath, '-e', 'console.log("hi");process.exit(0)'], {
    timeoutMs: 30_000,
  })
  const b = await runCapture(
    f2,
    [process.execPath, '-e', 'console.error("nope");process.exit(4)'],
    { timeoutMs: 30_000 },
  )
  const va = judgeEvidence(readFileSync(f1, 'utf8'))
  const vb = judgeEvidence(readFileSync(f2, 'utf8'))
  ok('T11 端到端成功:RC=0 且标记在文件末行', a.rc === 0 && va.kind === 'complete' && va.rc === 0)
  ok(
    'T12 端到端失败:RC=4 被如实记下(不是"没跑到")',
    b.rc === 4 && vb.kind === 'complete' && vb.rc === 4,
  )
  // T13 旧写法是 `verify(f1).rcExit === 0 || verify(f1) !== undefined` —— 第二个析取支**恒真**
  // (函数任何返回都是对象),所以这条断言从写下起就没判过任何东西,而它正是本行要防的那一型。
  ok('T13 端到端可验:verify() 对成功件返回 rcExit=0', verify(f1).rcExit === 0)
  // T13b 是本票补的根因对照:**不存在**的证据必须落 INCOMPLETE(3),不得被 `?? 0` 读成通过。
  // 正向:missing ⇒ verify().rcExit === 3 且调用方口径 exitCodeForVerdict(...v) === 3;
  // 反向:同一路径若真存在且 RC=0 ⇒ 必须 0(证明红的是"没有证据",不是"verify 永远 3")。
  ok(
    'T13b 证据文件不存在 ⇒ INCOMPLETE 且退出码 3(不是 0)',
    (() => {
      const ghost = resolve(dir, 'evidence-selftest-does-not-exist.md')
      if (existsSync(ghost)) rmSync(ghost)
      const m = verify(ghost, undefined, true)
      return m.v.kind === 'missing' && m.rcExit === 3 && exitCodeForVerdict(m.v) === 3
    })(),
  )
  // T14 —— 本工具存在的唯一理由的**真实**端到端:外部把包装器 SIGKILL 掉(模拟 agent 的
  // `timeout 200 …` 掐断输出那一型),证据文件必须**没有** RC 行 ⇒ 读侧判 INCOMPLETE 而不是"跑过了"。
  // 构造面(T3)只能证明函数会给答案,这一条证明**真实进程被杀后文件形态就是这样**。
  const f3 = resolve(dir, 'evidence-selftest-killed.txt')
  let killedVerdict = 'skip'
  try {
    const wrapper = spawn(
      process.execPath,
      [
        resolve(HERE, 'run-evidence.mjs'),
        f3,
        '--timeout=0',
        '--',
        process.execPath,
        '-e',
        'setTimeout(() => {}, 60000)',
      ],
      { cwd: ROOT, windowsHide: true, stdio: 'ignore', detached: false },
    )
    await new Promise((r) => setTimeout(r, 2500))
    wrapper.kill('SIGKILL')
    await new Promise((r) => setTimeout(r, 800))
    const v14 = judgeEvidence(existsSync(f3) ? readFileSync(f3, 'utf8') : '')
    killedVerdict = v14.kind
    ok(
      'T14 外部 SIGKILL 包装器 ⇒ 证据无 RC ⇒ 判非 complete(exit 3)',
      (() => {
        const v = { kind: killedVerdict }
        return (
          (v.kind === 'truncated' || v.kind === 'missing' || v.kind === 'killed') &&
          exitCodeForVerdict(v) === 3
        )
      })(),
    )
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
    ok(
      'T15 派生失败 ⇒ RC 行**恰好一条**且值为 127(句柄只关一次)',
      c.rc === 127 && rcLines.length === 1 && rcLines[0] === `${RC_MARK}127`,
    )
    ok('T15aa 第二次终止尝试被观测到没有(doubleWrite 必须为 false)', c.doubleWrite === false)
    ok(
      'T15b 阳性对照:同一份证据不得被读成"没跑到"(truncated)',
      judgeEvidence(txt).kind === 'complete',
    )
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
  ok(
    'T16 .CMD shim 必须改走 cmd.exe /d /c(Windows 的 pnpm/npx 是 .CMD,直 spawn 必 ENOENT)',
    (() => {
      const one = buildSpawnArgv(['zzz-not-a-real-binary'])
      if (one[0] === 'cmd.exe') return false // 不存在的命令不得被凭空包一层
      const abs = buildSpawnArgv([process.execPath, '-e', '0'])
      if (abs[0] !== process.execPath || abs.join(' ') !== [process.execPath, '-e', '0'].join(' '))
        return false
      if (process.platform !== 'win32') return true // 非 Windows:没有 .CMD 这一族,只证"不乱包"
      const asCmd = buildSpawnArgv(['pnpm.cmd', '--version'])
      if (asCmd[0] !== 'cmd.exe' || asCmd[1] !== '/d' || asCmd[2] !== '/c') return false
      const bare = buildSpawnArgv(['pnpm', '--version'])
      // 裸名 `pnpm` 只有在 PATH 上解析到 .cmd/.bat 时才该被包;解析不到就原样交给 spawn(错误面照旧落 127)。
      if (bare[0] === 'cmd.exe') return bare[3].toLowerCase().endsWith('.cmd')
      return !existsSync(resolve(ROOT, 'pnpm'))
    })(),
  )
  // T17–T20 —— G-285:--cwd 透传与 --expect-cwd 一致性校验(取证面必须可声明、可核对)。
  // 立因:旧实现把被包装命令钉死在仓根,"从别的目录跑同一判据"那一发里子进程收到被改写过的
  // 路径,而 --verify 仍判 complete —— 取证工具自己产出假合格证(与本工具立项动机同族)。
  const aiDir = resolve(ROOT, 'apps', 'ai-service')
  const cwdDir = existsSync(aiDir) ? aiDir : ROOT
  const f5 = resolve(dir, 'evidence-selftest-cwd.txt')
  const c5 = await runCapture(f5, [process.execPath, '-e', 'console.log(process.cwd())'], {
    timeoutMs: 30_000,
    cwd: cwdDir,
  })
  const t5 = readFileSync(f5, 'utf8')
  ok(
    'T17 带 --cwd 跑真实子进程 ⇒ spawn 的 cwd 真换了且 CWD 行落盘',
    (() => {
      if (c5.rc !== 0) return false
      if (!t5.includes(`${CWD_MARK}${cwdDir}`)) return false
      return t5.includes(cwdDir) // 子进程 stdout 打出的正是该目录
    })(),
  )
  ok(
    'T18 --expect-cwd 三臂:同值 ⇒ complete;异值 ⇒ truncated;未记录 ⇒ truncated(都不发假合格证)',
    (() => {
      const same = judgeEvidence(t5, cwdDir)
      const diff = judgeEvidence(t5, resolve(ROOT, 'scripts'))
      const none = judgeEvidence(`x\n${RC_MARK}0\n`, cwdDir)
      return (
        same.kind === 'complete' &&
        same.cwd === cwdDir &&
        diff.kind === 'truncated' &&
        none.kind === 'truncated'
      )
    })(),
  )
  ok(
    'T19 verify() 带 expect:同值 exit 0 / 异值 exit 3(目录不符 ⇒ 结论无效)',
    (() => {
      return verify(f5, cwdDir).rcExit === 0 && verify(f5, resolve(ROOT, 'scripts')).rcExit === 3
    })(),
  )
  ok(
    'T20 回归锁:不带 --cwd ⇒ 证据里没有 CWD 行,旧判定形态逐字不变',
    (() => {
      const txt1 = readFileSync(f1, 'utf8')
      return judgeEvidence(txt1).cwd === null && !txt1.includes(CWD_MARK)
    })(),
  )
  // T21 —— 证据落点的父目录不存在(共享 tmp 会被别的会话或清理层连带删掉)。
  // 旧实现在这里 `openSync` 抛 ENOENT:这一次取证压根没开始,而"包装器自己让结论取不到"
  // 与本工具要防的那一型(把没跑到写成跑过)在账面上长得一样 —— 先建目录再开句柄。
  const f21 = resolve(dir, 'no-such-dir-nested', 'evidence-selftest-mkdir.txt')
  const c21 = await runCapture(f21, [process.execPath, '-e', 'console.log(\"mkdir-ok\")'], {
    timeoutMs: 30_000,
  })
  ok(
    'T21 父目录不存在 ⇒ 自动建目录并完整落 RC(不得以 ENOENT 告终)',
    (() => {
      if (c21.rc !== 0) return false
      const txt = readFileSync(f21, 'utf8')
      return txt.includes('mkdir-ok') && txt.includes(`${RC_MARK}0`)
    })(),
  )
  // T22 —— 被包装的命令**不以换行收尾**时,标记必须仍独占一行(2026-09-29 实测的假"截断":
  //   `cat <一个末尾没有换行的文件>` 把 `#EVIDENCE-RC=0` 黏在同一行尾巴上 ⇒ 读侧按行首找标记找不到
  //   ⇒ 一次**完整**的取证被判成 truncated 并要求重跑)。四臂各守一个方向:
  //   ① 真实产物必须判 complete 且 RC 行独占一行(这条在修复前必红 —— 它是本格的阳性对照);
  //   ② 粘连形态(`x#EVIDENCE-RC=0`)判据**不得**认(反向锁:不许为了让①绿就把判据放宽成"含 RC 即通过",
  //      那等于把"半截输出恰好含这几个字符"的发假合格证重新打开);
  //   ③ 子进程正文逐字留在证据里(加固只允许在标记**前**补一个换行,不得改写别的字节);
  //   ④ 幂等:末尾本来就有换行的旧产物不得多出空行(否则每一条旧证据的形状都被改了,读侧的差分作废)。
  const f22 = resolve(dir, 'evidence-selftest-noeol.txt')
  const c22 = await runCapture(
    f22,
    [process.execPath, '-e', 'process.stdout.write(\"no-trailing-eol\")'],
    { timeoutMs: 30_000 },
  )
  const t22 = existsSync(f22) ? readFileSync(f22, 'utf8') : ''
  ok(
    'T22 输出末尾无换行 ⇒ RC 仍独占一行且判 complete(修复前必红)',
    (() => {
      if (c22.rc !== 0) return false
      const rcLines = t22.split(/\r?\n/).filter((l) => l.startsWith(RC_MARK))
      return (
        rcLines.length === 1 &&
        rcLines[0] === `${RC_MARK}0` &&
        judgeEvidence(t22).kind === 'complete'
      )
    })(),
  )
  ok(
    'T22b 反向锁:标记与正文黏同一行 ⇒ 判据不得认(不许放宽①来凑)',
    judgeEvidence(`out${RC_MARK}0\n`).kind !== 'complete',
  )
  ok('T22c 子进程正文逐字留在证据里(只允许在标记前补换行)', t22.includes('no-trailing-eol'))
  ok(
    'T22d 幂等:末尾本来有换行的旧形态不得多出空行',
    (() => {
      const txt = existsSync(f1) ? readFileSync(f1, 'utf8') : ''
      return txt !== '' && !/\n\n#EVIDENCE-RC=/.test(txt)
    })(),
  )
  // T23–T25 —— 2026-09-29 的**单位陷阱**(本机当天实录:`--timeout=180/300/560` 被当秒传 ⇒
  //   包装器在 180 毫秒就 SIGTERM,产出的证据与"命令真挂死"逐字同形,于是把"我用错单位"
  //   诊断成"git 网络卡死",差一点写成一张生产故障票)。判据住在 parseTimeoutMs,三条各钉一维:
  //   ① 换算表 + 边界(构造面,成对含"后缀小值必须放行");
  //   ② CLI 层真拒绝:exit 2、消息点名毫秒、且**一个字节都不写**(拒绝必须发生在打开句柄之前,
  //      否则"拒绝了"仍然留下一份空证据,读侧照样判 incomplete —— 与逃逸路径那一格同判);
  //   ③ 被自家计时器杀掉时,输出必须带**生效毫秒数**(只说"被 SIGTERM"会让下一个人去查世界,
  //      而不是查自己传的那个数)。
  const TOOL_PATH = resolve(HERE, 'run-evidence.mjs')
  ok(
    'T23 --timeout 单位表:后缀换算 / 裸小值判用法错 / 0=不设上限 / 坏形态不猜默认值',
    (() => {
      const eq = (raw, ms) => {
        const r = parseTimeoutMs(raw)
        return !r.error && r.ms === ms
      }
      const bad = (raw, ...mustInclude) => {
        const r = parseTimeoutMs(raw)
        return !!r.error && mustInclude.every((s) => r.error.includes(s))
      }
      return (
        eq('180s', 180_000) &&
        eq('2m', 120_000) &&
        eq('45000ms', 45_000) &&
        eq('45000MS', 45_000) &&
        eq('30_000', 30_000) &&
        eq('2000', 2000) &&
        eq('250ms', 250) &&
        eq('0', 0) &&
        bad('300', '毫秒', '--timeout=300000', '--timeout=300s') &&
        bad('1999', '毫秒') &&
        bad('560', '毫秒') &&
        bad('abc', '看不懂') &&
        bad('-5', '看不懂') &&
        bad('', '看不懂') &&
        bad('30_', '看不懂') &&
        bad('1e3', '看不懂')
      )
    })(),
  )
  const f24 = resolve(dir, 'evidence-selftest-badtimeout.txt')
  rmSync(f24, { force: true })
  const r24 = spawnSync(
    process.execPath,
    [TOOL_PATH, f24, '--timeout=300', '--', process.execPath, '-e', 'console.log(1)'],
    // 2026-10-04：不吃的子进程必须给 stdio，否则本机报 spawnSync EBUSY
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: ROOT,
      windowsHide: true,
      encoding: 'utf8',
      timeout: 60_000,
    },
  )
  const o24 = `${r24?.stdout ?? ''}${r24?.stderr ?? ''}`
  ok(
    'T24 CLI:裸 --timeout=300 ⇒ exit 2 且消息点名毫秒,证据一个字节都不写',
    r24?.status === 2 && /毫秒/.test(o24) && !existsSync(f24),
  )
  const f25 = resolve(dir, 'evidence-selftest-250ms.txt')
  const r25 = spawnSync(
    process.execPath,
    [
      TOOL_PATH,
      f25,
      '--timeout=250ms',
      '--',
      process.execPath,
      '-e',
      'setTimeout(() => {}, 30000)',
    ],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: ROOT,
      windowsHide: true,
      encoding: 'utf8',
      timeout: 60_000,
    },
  )
  const o25 = `${r25?.stdout ?? ''}${r25?.stderr ?? ''}`
  const t25 = existsSync(f25) ? readFileSync(f25, 'utf8') : ''
  ok(
    'T25 CLI:带后缀的 --timeout=250ms 必须**放行**(不被用法错拦),真被自家计时器杀时 rc=3 且输出带生效毫秒数(判定语义未改:仍是 killed、仍无 RC 行)',
    r25?.status === 3 &&
      /250ms/.test(o25) &&
      judgeEvidence(t25).kind === 'killed' &&
      !t25.includes(RC_MARK),
  )
  for (const f of [f1, f2]) {
    try {
      const txt = readFileSync(f, 'utf8')
      if (!txt.startsWith('\uFEFF')) ok(`${f.split('/').pop()} 无 BOM(本仓中文出码页坑)`, true)
    } catch {
      /* 已在 T11/T12 断言过可读性 */
    }
  }
  for (const f of [f1, f2, f5, f21, f22, f24, f25]) {
    try {
      rmSync(f, { force: true })
    } catch {
      /* 自检自清,清不掉不影响结论 */
    }
  }
  ok(
    'V1 空格形式 --cwd 必须报错(它会被 opt() 静默忽略 ⇒ 证据落在仓根)',
    (() => {
      const e = validateHead(['ev.txt', '--cwd', 'G:/x'])
      return (
        e.length === 2 &&
        e.some((x) => x.includes('--cwd 必须写成')) &&
        e.some((x) => x.includes('多出 1 个位置参数'))
      )
    })(),
  )
  ok('V2 等值形态 --cwd=… 零错', (() => validateHead(['ev.txt', '--cwd=G:/x']).length === 0)())
  ok(
    'V3 未知带值开关报错(不得静默掉进默认分支)',
    (() => {
      const e = validateHead(['ev.txt', '--workig=1'])
      return e.length === 1 && e[0].includes('不认识开关')
    })(),
  )
  ok(
    'V4 布尔开关不被误报为未知(--verify / --self-test)',
    (() =>
      validateHead(['--verify', 'ev.txt']).length === 0 &&
      validateHead(['--self-test']).length === 0)(),
  )
  ok(
    'V5 多出的位置参数点名(那是被吞掉的 flag 值的形状)',
    (() => {
      const e = validateHead(['ev.txt', 'G:/x'])
      return e.length === 1 && e[0].includes('G:/x')
    })(),
  )
  ok(
    'V6 `--` 之后的开关不在射程内(那是被包装命令自己的参数)',
    (() => validateHead(['ev.txt', '--timeout=1000']).length === 0)(),
  )
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
