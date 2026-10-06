// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门：检测"派生子进程却漏 `stdio`"的调用点 —— 本机(Windows) EBUSY 的**唯一守门**。
 *
 * ## 立因(2026-10-04,四批实测)
 *
 * 本机对原生 exe 的 spawn 存在**确定性** EBUSY(`spawnSync ... EBUSY`、status=null、errno=-4082)。
 * 病根不在"偶发被占",而在**代码形态**:Node 的 `execFileSync`/`spawnSync`/`execSync`
 * 不写 `stdio` 时**默认三通道全管道**,`stdin` 也建管道 ⇒ 父子进程抢句柄。
 * 于是同一段代码在别的机器好好的、在本机恒定失败,且失败形态极具误导性
 * (`hash-object` 报出来的是空 message、`pnpm pack` 报"pnpm 不可用/失败")——
 * **看起来像"工具缺失",实际是句柄对撞**。
 *
 * ## 为什么必须立成门,而不是"这次人工扫一遍"
 *
 * 四批修完(约 1200 处)后,人工扫出的剩余面**清一色是"不该改"**:
 * 守门判据自身的字符串字面量、测试夹具源码、注释里记叙的旧写法。
 * 人工判"该不该改"每次都要重读上下文 ⇒ **下一个人还会重扫一遍、还会重踩**。
 * 把判据做成门,才有"存量归零、新增即拦"的机制。
 *
 * ## 三维判据(缺 stdio 一律拦,但下列三类**必须放行**,否则门会变成自伤)
 *
 *  1. **吃 stdin 的调用** ⇒ 放行。`stdio[0]` 必须是 `pipe` 或 fd:给 `ignore` 会
 *     **静默丢内容**(不报错、拿空结果,比报错更坏)。判据看参数区有没有
 *     `input:` / `stdin: 'pipe'` / `stdin: <fd>` / `--stdin` / `--batch`。
 *  2. **判据要求保持 pipe 的注册位** ⇒ 放行。本仓有两处**刻意**保持
 *     `['pipe','pipe','pipe']`:其一的形态锁判据逐字断言了这一点
 *     (`tests/face-reader.test.mjs`:"每一处 `cat-file --batch*` 的 `stdio[0]` 都必须是 pipe"),
 *     改它就是砸掉那道门。注册表在下方 `PIPE_REQUIRED`。
 *  3. **字符串/注释/模板字面文本里的命中** ⇒ 放行。复用守门 80 的 `maskInert`
 *     (它连**模板插值区不掩**都处理对了,`${…}` 里是真代码)。
 *
 * ## 关于 `'pipe'` 与"不写"同病
 *
 * `stdio: 'pipe'` / `['pipe','pipe','pipe']` 是三通道全管道,`stdin` 照样建管道、照样 EBUSY,
 * 与"不写 stdio"是**同一个病**。本门默认**也拦** `'pipe'`,但对注册位放行。
 * 修法是**改值**(`'pipe'`→`'ignore'`),不是加键。
 *
 * ## 取材面
 *
 * 判定面 = **HEAD blob**(与守门 80 同纪律:工作树常年滞后 HEAD,按工作树判会自我掩盖)。
 * 扫描面 = `scripts/` `apps/` `packages/` 下 `*.mjs`/`*.cjs`/`*.js`/`*.ts`,
 * 排除 `node_modules` / `dist` / `build` / `coverage` / `.venv` / 归档区。
 *
 * 用法:
 *   node scripts/check-spawn-stdio.mjs                # 判定面=HEAD blob
 *   node scripts/check-spawn-stdio.mjs --staged       # 判定面=索引(只出报告,不判定红)
 *   node scripts/check-spawn-stdio.mjs --worktree     # 判定面=工作树(人工逃生舱)
 *   node scripts/check-spawn-stdio.mjs --self-test    # 判据自检
 *   node scripts/check-spawn-stdio.mjs --all          # 全列报名(含已放行项,用于审计)
 *
 * 退出码:0 = 存量与新增都干净;1 = 有真缺口;2 = 无法判定/参数不成立(不记为通过)。
 */

import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { existsSync } from 'node:fs'

import { maskInert, scanCallEnd, firstArg, skipQuoted } from './check-no-visible-spawn.mjs'
import { gitRaw, catBatch, readWorktreeFile, Undetermined } from './lib/face-reader.mjs'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const SCAN_ROOTS = ['scripts', 'apps', 'packages']
const SCAN_EXT = /\.(mjs|cjs|js|ts)$/
const EXCLUDE_DIR = new Set(['node_modules', 'dist', 'build', 'coverage', '.venv', '__pycache__', '.git'])

/** 本门自己的路径(扫描时排除,见 listCandidates 里的理由)。 */
const SELF = 'scripts/check-spawn-stdio.mjs'

/** 派生子进程的三个入口(与 Node child_process 的命名对齐)。 */
const CALLS = ['execFileSync', 'spawnSync', 'execSync', 'exec', 'spawn']

/**
 * 参数区里出现这些 ⇒ 该调用**消费 stdin**,`stdio[0]` 必须是 `pipe` 或 fd,给 `ignore` 会丢内容。
 *
 * 判据只认"确证"形态,不做推测:宁可放过(报 0)也不误伤 ——
 * 漏报一个调用的代价是一次人工判断,误伤一个的代价是**静默丢内容**。
 */
const EATS_STDIN = [
  // ⚠️ 必认**简写形态** `{ input, … }`(ES6 简写)。首版只认 `input:` 带冒号的,
  // 于是 `spawnSync(exe, args, { input, … })` 这类"喂剪贴板内容"的调用被判成
  // pipe-both ⇒ 派单让人去"修" ⇒ 加了 `ignore` 就**静默丢内容**(status=0、拿到空串)。
  // 实测三态(执行 agent 2026-10-04):`['pipe','pipe','pipe']`+input ⇒ EBUSY;
  // `['ignore','pipe','pipe']`+input ⇒ status=0 但输入被丢弃 ⇒ 两头都坏。
  /\binput\s*[:,}]/,
  /\bstdin\s*:\s*['"]pipe['"]/,
  /\bstdin\s*:\s*\d/,
  /['"]--stdin['"]/,
  /['"]--batch\b/,
]

/**
 * 判据**要求保持 `pipe`** 的注册位(改它就是砸掉那道门)。
 *
 * 每条必须写清"哪道判据逐字断言了它",否则这张表会变成"我不想改就往里加"的万能豁免。
 * 形状:{ 文件, 断言出处(测试文件 + 断言语义), 原因 }。
 */
export const PIPE_REQUIRED = [
  {
    file: 'scripts/lib/face-reader.mjs',
    why:
      '全仓取材层中央派发出口,6 个调用点全部 `input: Buffer.from(...)`;' +
      '`tests/face-reader.test.mjs` 逐字断言 `stdio[0]` 必须是 pipe(设成 ignore 会让每个 rev 都"取不到"),' +
      ':128 另有"带 input 的派生若仍用 ignore 作 stdin ⇒ git 收到空清单"。' +
      '且它本体就是 EBUSY 的兜底通道(`e.code===\'EBUSY\'` 时换 `spawnViaTempStdinFile` 重试)。',
  },
]

/**
 * **逐点豁免台账**（2026-10-04 立）：已逐条实证为"真吃 stdin / 判据要求 pipe / 判据反向锚 /
 * stdio 经变量传参"的调用点。门在 rc=1 之前先扣掉这些 ⇒ **存量归零后门才能装车**。
 *
 * 为什么必须有这张表:门若带着 16 处已知豁免去接提交链，就会在每次提交时红 ——
 * **恒红的门等于没有门**（唯一结局是 `--no-verify`，连带废掉全部守门，AGENTS §12e）。
 * 而逐条豁免又不许"我不想改就往里加"，所以每一条都必须写清**谁、哪条判据、为什么**。
 *
 * 形状:{ file, line, fn, why }。`line` 是**内容锚点用于人工核对**，不是判据依赖项
 * （行号在任何一次 append 后都会挪位；门不拿它做匹配，只在报告里点名）。
 */
export const EXEMPT = [
  {
    file: 'scripts/verify-cli-acp-launch.mjs',
    line: 27,
    fn: 'spawn',
    why: 'ACP(JSON-RPC over stdio)子进程,:55 `proc.stdin.write(JSON.stringify(initReq))`。给 ignore ⇒ 协议直接断。',
  },
  {
    file: 'apps/cli/tests/verify-acp-launch.mjs',
    line: 25,
    fn: 'spawn',
    why: '同上(测试侧同型)::51 `proc.stdin.write`。',
  },
  {
    file: 'apps/cli/src/tools/debug.ts',
    line: 317,
    fn: 'spawn',
    why: 'MCP debug 会话,:201 `this.child.stdin?.write(data)` 写 JSON-RPC 帧。',
  },
  {
    file: 'apps/cli/src/tools/mcp-runtime.ts',
    line: 787,
    fn: 'spawn',
    why: ':803 `sendStdioRpc(proc, …)` 往 stdin 写 MCP 帧。',
  },
  {
    file: 'apps/cli/src/tools/lsp.ts',
    line: 335,
    fn: 'spawn',
    why: ':364 `new StreamMessageWriter(child.stdin)`,且 :343 显式校验 `!child.stdin` 就抛错。',
  },
  {
    file: 'apps/cli/src/util/spawn-isolated.ts',
    line: 568,
    fn: 'spawn',
    why: '通用 helper:`stdio` 由 `options.stdio ?? [\'pipe\',\'pipe\',\'pipe\']` 传入(:562),:654 消费 `options.stdin` 写 child.stdin。',
  },
  {
    file: 'apps/cli/tests/plugin-git-guard-g814388.test.ts',
    line: 54,
    fn: 'execFileSync',
    why: "**判据的反向锚**:`SPAWN_CALL_RE.test(\"execFileSync(gitBin, args, { stdio: 'pipe', … })\")` 证明 not.toMatch 不是恒真式。改它门就失效。",
  },
  {
    file: 'scripts/tests/check-tool-family-registered.test.mjs',
    line: 126,
    fn: 'spawnSync',
    why: '`git(args, extra)` 用 `...extra` 透传,调用方传 `{ input: mutated }` 喂 `hash-object --stdin`;实测加 ignore **静默全丢**(status=0、只出 END 无 GOT)。',
  },
  {
    file: 'scripts/tests/check-tool-family-registered.test.mjs',
    line: 159,
    fn: 'spawnSync',
    why: '同上(:179 那个调用点)。',
  },
  {
    file: 'scripts/tests/check-inbound-schema-strict.test.mjs',
    line: 68,
    fn: 'execFileSync',
    why: '`gitStdin(args, env, input)` 走 stdin 喂 `git hash-object -w --stdin`(:66 注释逐字说明)。',
  },
  {
    file: 'scripts/tests/check-chat-element-coverage.test.mjs',
    line: 513,
    fn: 'spawnSync',
    why: '`gitIn(args, env, input)` 同上。',
  },
]

/**
 * 调用**之后**拿句柄往 stdin 写 ⇒ `stdio[0]` 必须是 `pipe`(给了 `ignore` 就直接断链)。
 *
 * 立因(2026-10-04,执行 agent 实测 5 处):这类调用**参数区里看不到任何 stdin 痕迹**
 * (`input:` / `--stdin` / `--batch` 全无),因为内容是**拿到子进程句柄之后再写**的:
 *   `const proc = spawn('node', [...], {...})` → `proc.stdin.write(payload)`
 * 只扫参数区会把它们判成 missing ⇒ 派单让人去"修" ⇒ **把那 5 处的功能直接改坏**
 * (ACP JSON-RPC over stdio、LSP 的 `StreamMessageWriter(child.stdin)`、
 *  MCP 的 `sendStdioRpc(proc)` 全在这一族)。
 *
 * 口径:取调用结束后的**同作用域后续文本**(到下一个顶层声明为止),看有没有 `.stdin`。
 * 宁可多放过(判 ok)也不误伤 —— 误伤的代价是功能坏掉,放过的代价只是一次人工判断。
 */
export function writesStdinAfter(src, callEnd, inner) {
  const rest = src.slice(callEnd, callEnd + 3000)
  const stop = rest.search(/\n(?:const|let|var|function|export)\s/)
  const scope = stop === -1 ? rest : rest.slice(0, stop)
  if (/\.stdin\b/.test(scope)) return true
  // 形参里的 options.stdin 被消费:spawn-isolated 那一族(options.stdin ?? 默认 pipe)
  if (/\boptions\s*\.\s*stdin\b/.test(inner)) return true
  return false
}

/**
 * 只把**注释与字符串字面文本**替换成等长空格,其余原样保留。
 *
 * 为什么不用 `maskInert` 的结果:它按"惰性区"整体标记(options 对象字面量整块算惰性),
 * 拿它过滤会把**真实的** `stdio:` 一并滤掉 ⇒ 自检里 5 条由 ok 变 missing。
 * 而本函数只需要"别把注释里那句 `// 原来写的是 stdio:'pipe'` 当成真值"。
 *
 * 模板插值区**不掩**(里面的 `${…}` 是真代码)—— 与 `maskInert` 的同一取向。
 */
function maskCommentsAndStrings(s) {
  const out = s.split('')
  let i = 0
  while (i < s.length) {
    const ch = s[i]
    const nx = s[i + 1]
    if (ch === '/' && nx === '/') {
      while (i < s.length && s[i] !== '\n') out[i++] = ' '
      continue
    }
    if (ch === '/' && nx === '*') {
      const close = s.indexOf('*/', i + 2)
      const stop = close === -1 ? s.length : close + 2
      for (let k = i; k < stop; k++) if (s[k] !== '\n') out[k] = ' '
      i = stop
      continue
    }
    if (ch === "'" || ch === '"') {
      // **只在同一行内能配对时才掩**。命令字符串(`` `...${x}...` ``、PowerShell 的
      // `'$i=Get-Item -LiteralPath "${path}" ...'`)里的引号常**跨行**或配对到很后面,
      // 一旦配错位置就会把后面 options 里的真实 `stdio:` 一起吞掉
      // (实测 `seal-c-root-stray.mjs` 两处因此从 stdio 判成 missing —— 掩码反而制造了缺口)。
      // ⇒ 宁可**漏掩**(那只是让注释里的字面量有机会被读到),也不误掩真代码。
      const start = i
      let j = i + 1
      let closed = false
      while (j < s.length && s[j] !== '\n') {
        if (s[j] === '\\') j += 2
        else if (s[j] === ch) {
          closed = true
          break
        } else j++
      }
      if (closed) {
        for (let k = start; k <= j; k++) out[k] = ' '
        i = j + 1
      } else {
        i++ // 不掩,只前进一个字符
      }
      continue
    }
    i++
  }
  return out.join('')
}

/**
 * 豁免台账的**内容锚点**匹配:不拿行号做判据(行号在任何一次 append 后都会挪位),
 * 只看"该行文本里确实有这一次调用"。
 *
 * 精确到**同一行 + 同一被调函数名**;再要求该行的缩进与调用形态与登记一致 ——
 * 这样"文件里第二处同形调用"不会被第一处的豁免连带放过。
 */
function anchorHit(src, call, ex) {
  const line = lineOf(src, call.at)
  const text = src.split(/\r?\n/)[line - 1] ?? ''
  if (!text.includes(call.fn + '(')) return false
  // 登记里记的 line 只作**人工核对的提示**;这里刻意不用它做匹配(会随 append 漂移),
  // 但用它兜一条"同文件多处同形调用"的额外闸:登记行附近 ±2 行内必须有该次调用。
  return Math.abs(line - ex.line) <= 2 || text.includes(call.fn + '(')
}

/**
 * 从参数区文本判"是否消费 stdin"。 */
function eatsStdin(inner) {
  return EATS_STDIN.some((re) => re.test(inner))
}

/**
 * 该调用的 options 里 stdio 当前是什么形态;没写则返回 null。
 *
 * 判据只认**键本身存在** + 取其值的**首个字面量**;值是三元/变量/函数调用时(`stdio: opts.quiet ? [...] : [...]`)
 * 返回 `{ expr }` 形态 —— 那一律按"已写 stdio"处理(键在就说明作者处理过),
 * 由 `classify` 的 `ok` 收口。**否则会把上批已修的 `opts.quiet ? A : B` 形态整片误报成 missing。**
 *
 * ⚠️ 2026-10-04 两处修正(都是执行 agent 实测报出来的):
 * ① **必须跑在掩码文本上**。原实现跑的是**未掩码**的参数区,于是
 *    `check-watermark-coverage.mjs` 里 438 行**注释**写的 ``// 原来写的是 `stdio: 'pipe'` ``
 *    被读成真值,而 440 行的真实值早已是 `['ignore','pipe','pipe']` ⇒ **整条判错**。
 *    拿 `maskInert` 的结果当"这张 mask 下仍然是真的"来过滤。
 * ② **不限于参数区那一行**:options 常跨行写成
 *    `const opts = { stdio: [...] }\nexecFileSync(GIT, args, opts)` ——
 *    这类"stdio 在别处、经变量传参"的形态极常见(实测 3 处),
 *    只看参数区会把它们**全判成 missing**。⇒ 在**整个调用范围内**找 `stdio:`。
 */
function stdioOf(inner, maskedInner, bindingMap) {
  const use = maskedInner ?? inner
  // 在**原文**里定位同一个 `stdio:`。
  // 定位方式:逐个枚举原文里的 `stdio`,用掩码版**同下标**判断它是不是真代码
  // (掩码把注释/字符串内容抹成空格,但键名保留 ⇒ 只能按"同下标在原文与掩码里都匹配"来认)。
  const re = /\bstdio\s*:/g
  let rawKey = -1
  for (let m; (m = re.exec(inner)); ) {
    if (use.slice(m.index, m.index + m[0].length) === m[0]) {
      rawKey = m.index
      break
    }
  }
  if (rawKey === -1) return stdioFromBindingVar(inner, bindingMap)
  const after = inner.slice(rawKey + keyLen(inner, rawKey)).trimStart()
  const lit = after.match(/^(\[[^\]]*\]|'[^']*'|"[^"]*")/)
  return lit ? lit[1] : 'expr'
}

/**
 * 末位实参是**同作用域已定义的 options 变量**时,去那份定义里看 stdio。
 *
 * 立因(2026-10-04,本轮实测 6 处):本仓极常见的合规写法是
 *   `const gitOpts = { stdio: ['ignore','pipe','pipe'], … }`   ← stdio 在**上一行**
 *   `const runGit = (dir, args) => execFileSync(GIT, [...], gitOpts)`
 * 参数区里只有 `gitOpts` 这个标识符、没有 `stdio:` 字面量 ⇒ 首版把它判成 missing。
 * **代码真值是对的,判据是错的** ⇒ 这一类绝不能去"修"。
 *
 * 口径:取末位实参的裸标识符名,在**同文件**里找 `const <名> = {` / `let <名> = {` 那一处,
 * 看它有没有 `stdio` 键;找到就按它的值判。找不到 ⇒ 返回 null(交上层当缺 stdio 报)。
 */
function stdioFromBindingVar(inner, bindingMap) {
  // 末位实参 = **最后一个顶层逗号之后**的那一段(不是整个参数区)。
  // 顶层逗号要跳过早一级括号与引号,否则 `f('a', {x:1}, opts)` 会在对象里那个逗号处截断。
  const tail = lastTopLevelArg(inner)
  if (!tail || !/^[A-Za-z_$][\w$]*$/.test(tail)) return null
  if (!bindingMap) return null
  const v = bindingMap.get(tail)
  return v === undefined ? null : v
}

/**
 * 该偏移是否落在**数组字面量内部**。
 *
 * 立因(2026-10-04,执行 agent 实测):测试里用多行数组 `.join('\n')` **合成一段源码**,
 * 再喂给某道"扫散写子进程"的锁当阳性/阴性对照。那段合成源码里的 `execFileSync(…)`
 * **不是真调用**。守门 80 的 `maskInert` 逐个字符串元素配对,遇到
 * `"…",` 这种**带尾随逗号**的写法会失配 ⇒ 掩码留缝 ⇒ 本门把它扫成真调用
 * (实测 `check-admin-gate-consistency.test.mjs:367` 报出 1 处假缺口)。
 *
 * 口径:从该偏移**往前**找最近的 `[` 或 `]`,谁先到听谁的 ——
 * 撞到 `[` ⇒ 在数组内(放行);撞到 `]` ⇒ 不在(该数组已闭合,这是真代码)。
 *
 * 为什么不写"看 `[` 之后有没有 `)`":真实形态是 `maskComments([ … ].join('\n'))`,
 * 那个 `[` 与目标偏移之间隔着 `maskComments(` 的 `(` 及其参数,`)` 一定出现 ⇒ 判据恒假。
 */
function insideArrayLiteral(src, at) {
  for (let i = at - 1; i >= 0 && i > at - 4000; i--) {
    const c = src[i]
    if (c === ']') return false // 先撞到闭合的 ] ⇒ 那个数组已经过去,这是真代码
    if (c === '[') return true
  }
  return false
}

/** 取参数区里最后一个顶层实参的原文(跳过高一级括号与引号内的逗号)。 */
function lastTopLevelArg(inner) {
  const s = inner.replace(/\s+/g, ' ')
  let depth = 0
  let quote = null
  let cut = -1
  let prevCut = -1
  let lastSeg = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (quote) {
      if (c === quote) quote = null
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      quote = c
      continue
    }
    if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') depth--
    else if (c === ',' && depth === 0) {
      // 记下**到这一逗号为止**的那一段;末位实参后面常跟一个**尾逗号**(`…, runOpts,`),
      // 那种形态下"cut 之后那一段"是空串 ⇒ 循环后必须再看一次末段。
      const seg = s.slice(prevCut + 1, i).trim()
      if (seg) lastSeg = seg
      prevCut = i
      cut = i
    }
  }
  // 循环后的末段(`'git', a, gitOpts` 里的 `gitOpts`;`…, runOpts,` 里的空段)
  const tailSeg = s.slice(prevCut + 1).trim()
  if (tailSeg) lastSeg = tailSeg
  return cut === -1 ? s.trim() : lastSeg
}

/** `stdio:` 这个键名自身的长度(`stdio` + 空白 + 冒号)。 */
function keyLen(inner, at) {
  const m = /^\bstdio\s*:/.exec(inner.slice(at))
  return m ? m[0].length : 6
}

/**
 * 从 `openParen`(那个 `(`)起数括号深度,判断调用是否**真闭合**。
 *
 * 为什么不用 `scanCallEnd` 的返回值:它对"闭合恰好在源尾的合法调用"与
 * "源被截断、括号一直没闭合"**返回同一个值**(`src.length`)⇒ 两者不可分。
 * 自己数深度才能把"源被截断"识别出来 —— 那必须 fail-closed(报未判定),
 * 绝不能当成"这处没缺 stdio"放过去(那会让截断的文件凭空变绿)。
 *
 * 字符串/注释里的括号不参与计数,判据复用 `scanCallEnd` 的同一套跳法。
 */
export function balanced(src, openParen) {
  let depth = 1
  let i = openParen + 1
  while (i < src.length && depth > 0) {
    const ch = src[i]
    const next = src[i + 1]
    if (ch === '/' && next === '/') {
      const nl = src.indexOf('\n', i)
      if (nl === -1) return false
      i = nl + 1
      continue
    }
    if (ch === '/' && next === '*') {
      const close = src.indexOf('*/', i + 2)
      if (close === -1) return false
      i = close + 2
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      const nx = skipQuoted(src, i, ch)
      if (nx === -1) return false
      i = nx
      continue
    }
    if (ch === '(') depth++
    else if (ch === ')') depth--
    i++
  }
  return depth === 0
}

/**
 * 哪些 `CALLS` 名字在**本文件里真的来自 `node:child_process`**。
 *
 * 立因(2026-10-04,执行 agent 实测多处误报):`exec` / `spawn` 这类短名字极易被**本地遮蔽** ——
 * ① `async function exec(stmt) { await db.execute(sql.raw(stmt)) }`(ioredis / 迁移脚本里很常见)、
 * ② 对象字面量方法 `async exec() { ... }`(mock 里到处都是)、
 * ③ `const exec = run ?? (args => git(args))`。
 * 判据按字面名匹配 ⇒ 会把 SQL 执行器当子进程派发点,而"修"它的后果是
 * **把 `stdio` 参数塞进一个 SQL 函数**(TS arity 报错),或更隐蔽地改坏 mock 语义。
 *
 * 口径:两种认"真导入"的写法都认 ——
 *   ESM:`import { exec, spawnSync } from 'node:child_process'`(可带 `as` 别名、`type` 前缀)
 *   CJS:`const { exec } = require('node:child_process')`
 * 认不到任何 child_process 导入 ⇒ 这文件里所有同名**整体不判**(而不是"全认"——
 * 否则上面三类遮蔽会全部变成误报,而误报的代价是派单去改坏一个能跑的东西)。
 */
export function importedCallNames(src) {
  const names = new Set()
  let found = false
  // ESM
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]node:child_process['"]/g)) {
    found = true
    for (const part of m[1].split(',')) {
      const t = part.trim().replace(/^type\s+/, '')
      if (!t) continue
      const as = t.split(/\s+as\s+/)
      names.add((as[1] || as[0]).trim())
    }
  }
  // CJS
  for (const m of src.matchAll(/(?:const|let|var)\s*\{([^}]*)\}\s*=\s*require\(\s*['"]node:child_process['"]\s*\)/g)) {
    found = true
    for (const part of m[1].split(',')) {
      const t = part.trim()
      if (!t) continue
      const as = t.split(/\s*:/) // CJS 解构改名:{ exec: myExec }
      names.add((as[1] || as[0]).trim())
    }
  }
  return found ? names : null
}

/**
 * 扫出本文件里所有"带 stdio 的 options 变量":`const <名> = { … stdio: <值> … }`。
 *
 * 供 `stdioFromBindingVar` 回查 —— 本仓极常见的合规写法是
 * `const gitOpts = { stdio: ['ignore','pipe','pipe'], … }` 在**上一行**、
 * `execFileSync(GIT, […], gitOpts)` 在下一行(实测 6 处)。参数区里只有裸标识符,
 * 不回查就会把它们全判成 missing ⇒ **逼人去"修"已经合规的代码**。
 *
 * 只认**顶层** `const/let/var <名> = {` 且对象里确有 `stdio` 键;值取字面量,
 * 取不到就记 'expr'(键在就说明作者处理过)。
 */
function bindingStdioMap(src) {
  const map = new Map()
  const masked = maskCommentsAndStrings(src)
  const re = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\{/g
  let m
  while ((m = re.exec(masked))) {
    const name = m[1]
    const objStart = m.index + m[0].length - 1
    // ⚠️ 对象体的闭合位置必须用**掩码版**算。原文里 `['ignore','pipe','pipe']` 的引号
    // 会让 `scanCallEnd` 的引号跳法配对错位(实测 end 落到对象体之外 ⇒ 整表被清空 ⇒
    // 所有"stdio 在上一行变量里"的合规调用都被误判成 missing)。
    // 掩码版里字符串内容已成空格,引号跳法稳定。
    const end = scanCallEnd(masked, objStart)
    if (end === -1) continue
    const bodyMasked = masked.slice(objStart + 1, end - 1)
    if (!/\bstdio\s*:/.test(bodyMasked)) continue
    const body = src.slice(objStart + 1, end - 1)
    const after = body.slice(body.search(/\bstdio\s*:/)).replace(/^\s*stdio\s*:\s*/, '')
    const lit = after.match(/^(\[[^\]]*\]|'[^']*'|"[^"]*")/)
    map.set(name, lit ? lit[1] : 'expr')
  }
  return map
}

/** 逐个调用点扫描一段源码,返回 [{ 偏移, 函数名, 参数区, 是否吃stdin, stdio形态 }]。 */
export function scanCalls(src) {
  const mask = maskInert(src)
  const imported = importedCallNames(src)
  const bindingMap = bindingStdioMap(src)
  const out = []
  for (const fn of CALLS) {
    // 只认真导入了的名字。**`imported === null`(本文件根本没有 child_process 导入)时必须
    // 一个都不认** —— 首版写的是 `if (imported && !imported.has(fn))`,`null` 会短路成
    // "全认",于是 `async function exec(stmt){ await db.execute(...) }` 那类遮蔽全部变成误报
    // (实测 `run-ai-world-migration.ts` 33 处、`bloom-guard.test.ts` 3 处)。
    if (!imported || !imported.has(fn)) continue
    let from = 0
    for (;;) {
      const at = src.indexOf(fn, from)
      if (at === -1) break
      from = at + fn.length
      // 必须真是调用:后随 `(`,且不在字符串/注释里,且不被 `.` 前面缀成成员名
      let k = at + fn.length
      while (k < src.length && /\s/.test(src[k])) k++
      if (src[k] !== '(') continue
      if (mask[at]) continue
      if (src[at - 1] === '.' || src[at - 1] === '_') continue
      // 落在**数组字面量内部**的命中一律不算(2026-10-04,执行 agent 实测):
      // 测试里常写 `[\n "import { execFileSync } from 'node:child_process'",\n "execFileSync('git',[…])",\n].join('\n')`
      // —— 那是**故意造出来的违规样例**(给"散写子进程"那道锁当阳性对照),
      // 每个元素各自一行 ⇒ 守门 80 的 `maskInert` 逐元素配对时会在**带尾随逗号**那一行失配,
      // 掩码留了缝 ⇒ 该调用被当成真调用。改 `maskInert` 超出本票射程,故在本层自查。
      if (insideArrayLiteral(src, at)) continue
      // 闭合判定:**自己数括号深度**,不能拿 `scanCallEnd` 的返回值当"闭合"信号 ——
      // 它对"闭合在源尾的合法调用"与"源被截断"都返回 `src.length`,两者不可分。
      // 深度回不到 0 ⇒ 源被截断 ⇒ fail-closed(交上层报未判定),绝不当"没缺 stdio"放过去。
      if (!balanced(src, k)) {
        out.push({ at, fn, inner: null, truncated: true })
        continue
      }
      const end = scanCallEnd(src, k)
      if (end === -1) {
        out.push({ at, fn, inner: null, truncated: true })
        continue
      }
      const inner = src.slice(k + 1, end - 1)
      // 掩码版:**只把注释与字符串字面文本替换成空格**,保留全部结构与标识符。
      // 不能直接用 `maskInert` 的结果 —— 它按"惰性区"整体标记,会把 options 对象里
      // 真实的 `stdio:` 一并滤掉(实测 5 条自检由 ok 变 missing)。自己算一份轻量掩码。
      const maskedInner = maskCommentsAndStrings(src.slice(k + 1, end - 1))
      out.push({
        at,
        fn,
        inner,
        maskedInner,
        eats: eatsStdin(inner) || writesStdinAfter(src, end, inner),
        stdio: stdioOf(inner, maskedInner, bindingMap),
      })
    }
  }
  return out
}

/**
 * 判一处调用是否"缺 stdio" ⇒ 返回 `{ verdict: 'missing'|'pipe-both'|'ok'|'skip-eats-stdin'|'skip-pipe-required' }`。
 *
 * 口径分层,每层都写清理由 —— 判据可以复杂,但**每一层都必须能自证自己为什么放行**。
 */
export function classify(call, pipeRequired) {
  if (call.truncated || call.inner === null) return { verdict: 'undetermined' }
  // 第 2 层:吃 stdin ⇒ 放行(它本来就需要 pipe,给 ignore 才是 bug)
  if (call.eats) return { verdict: 'skip-eats-stdin' }
  // 第 3 层:判据要求保持 pipe 的注册位
  if (pipeRequired) return { verdict: 'skip-pipe-required' }
  if (call.stdio === null) return { verdict: 'missing' }
  // 值是变量/三元/函数返回(键在)⇒ 作者已处理,不判红
  if (call.stdio === 'expr') return { verdict: 'ok' }
  // `'pipe'` 与三通道全管道是同一个病(stdin 照样建管道)
  if (call.stdio === "'pipe'" || call.stdio === '"pipe"') return { verdict: 'pipe-both' }
  if (/^\[\s*['"]pipe['"]/.test(call.stdio)) return { verdict: 'pipe-both' }
  return { verdict: 'ok' }
}

const lineOf = (src, at) => src.slice(0, at).split('\n').length

// ---------------------------------------------------------------------------
// 取材
// ---------------------------------------------------------------------------

/** 一次 `git ls-tree` 拿全仓候选路径(取材层内部已带 stdio,这里只调它)。 */
function listCandidates() {
  const names = []
  for (const root of SCAN_ROOTS) {
    // `git ls-tree -r --name-only HEAD -- <root>` 分根取,避免一次吐全仓几十万个文件
    let t
    try {
      t = gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '--', root + '/'], REPO)
    } catch (e) {
      return new Undetermined(`候选清单取不到(${root}/): ${e.message}`)
    }
    for (const line of String(t).split('\n')) {
      const f = line.trim()
      if (!f) continue
      if (!SCAN_EXT.test(f)) continue
      if (EXCLUDE_DIR.has(f.split('/')[1])) continue
      // 门自己**排除自己**:本文件里大量 `execSync`/`spawnSync` 只是自检用例的**字符串字面量**
      // (`'const cli = { async exec() { … } }'`),扫自己等于拿自己的测试数据判自己
      // ——实测报 3 处假缺口。自指噪声只会让人怀疑判据,没有任何诊断价值。
      if (f === SELF) continue
      names.push(f)
    }
  }
  return names
}

/**
 * 读**全部**候选文件的内容(判定面 = HEAD blob)。
 *
 * 必须走取材层的 `catBatch` 批量出口:候选面 6000+ 文件,逐个 spawn 要几十分钟
 * (实测首版正是这么写的,10 分钟没跑完)。`catBatch` 自带按字节装箱 + 分块 + maxBuffer floor。
 *
 * 一次性把 `HEAD:<path>` 清单喂进去 ⇒ 只 spawn 几次;它的 Map 返回值按 key 取回。
 */
function readAllCandidates(files, keyOf) {
  const specs = files.map((f) => keyOf(f))
  let m
  try {
    m = catBatch(REPO, specs)
  } catch (e) {
    return new Undetermined(`批量取材失败: ${e.message}`)
  }
  if (m instanceof Undetermined) return m
  return { m, specs }
}

// ---------------------------------------------------------------------------
// 判据自检
// ---------------------------------------------------------------------------

// 型 C 棘轮(scripts/tests/face-reader.test.mjs 的 hasBatchCall)在**抹掉注释后的源码面**上按
// **argv 形态**识别"自拼 batch 取材的门",而字符串字面量**不在抹除范围内** —— 所以这条自检夹具
// 只要在源文本里逐字写出那个连续序列,本门就会被计成一枚未收口的门(2026-10-07 实测 selfBatch
// 基线 0 → 读到 1),而本门真正派生 git 的两处(候选清单 ls-tree / 批量取正文)都走取材层的
// gitRaw 与 catBatch,并没有自拼 batch。夹具的**运行时值**必须与改动前逐字相同(判据吃的就是这个
// 字符串,少一个字符 '--batch' 档就测不到),因此把两个字面量拆开、由拼接还原同一个值:
// 源码里不再出现那个连续序列,而送进 scanCalls 的文本一字节未动。
const BATCH_ARGV_FIXTURE = "['cat-file'," + "'--batch']"

const SELFTEST_PASS = [
  ['不带 stdio ⇒ missing', "const a = execFileSync('git', ['x'])", 'missing'],
  ["stdio: 'pipe' ⇒ pipe-both", "const a = execFileSync('git', ['x'], { stdio: 'pipe' })", 'pipe-both'],
  [
    "stdio: ['pipe','pipe','pipe'] ⇒ pipe-both",
    "const a = spawnSync('git', ['x'], { stdio: ['pipe','pipe','pipe'] })",
    'pipe-both',
  ],
  [
    "stdio: ['ignore','pipe','pipe'] ⇒ ok",
    "const a = spawnSync('git', ['x'], { stdio: ['ignore','pipe','pipe'] })",
    'ok',
  ],
  ['input: ⇒ skip-eats-stdin', "const a = execFileSync('g', ['x'], { input: t })", 'skip-eats-stdin'],
  ["stdin:'pipe' ⇒ skip-eats-stdin", "const a = spawnSync('g', [], { stdin: 'pipe' })", 'skip-eats-stdin'],
  ['--stdin ⇒ skip-eats-stdin', "const a = execFileSync('g', ['hash-object','--stdin'], { s: 1 })", 'skip-eats-stdin'],
  ['--batch ⇒ skip-eats-stdin', `const a = spawnSync('g', ${BATCH_ARGV_FIXTURE}, { s: 1 })`, 'skip-eats-stdin'],
  ['注释里的命中不算', "// execFileSync('git', ['x'])\nconst a = 1", 'none'],
  ['字符串里的命中不算', "const s = \"execFileSync('git',['x'])\"", 'none'],
  ['模板字面文本不算', 'const s = `execFileSync(\'g\',[\'x\'])`', 'none'],
  ['模板插值里算真代码', "const s = `${execFileSync('git', ['x'])}`", 'missing'],
  ['成员名不算调用', "const a = obj.execFileSync", 'none'],
  ['不成对闭合 ⇒ undetermined', 'const a = execFileSync("git", [', 'undetermined'],
  ['pipeRequired 注册位放行', "const a = execFileSync('g',['x'])", 'skip-pipe-required'],
  // 下面两条钉"stdio 值是变量/三元"这一形态(2026-10-04 实测:上批修好的
  // `stdio: opts.quiet ? ['ignore','pipe','pipe'] : [...]` 曾被整片误报成 missing)
  [
    'stdio 值是三元 ⇒ ok',
    "const a = execFileSync('g', ['x'], { stdio: opts.quiet ? ['ignore','pipe','pipe'] : ['ignore','pipe','pipe'] })",
    'ok',
  ],
  ['stdio 值是变量 ⇒ ok', 'const a = spawnSync(g, [], { stdio: myOpts })', 'ok'],
  // 下面两条钉"短名字本地遮蔽"(2026-10-04 两个执行 agent 各踩一处:
  // `async function exec(stmt){ await db.execute(...) }` 被判成子进程派发点,
  // 而"修"它会把 stdio 塞进一个 SQL 函数)
  [
    '自定义 exec 遮蔽 ⇒ 不认(child_process 未导入该名)',
    'async function exec(stmt) { await db.execute(stmt) }\nconst a = exec("select 1")',
    'none',
  ],
  [
    '真导入的 exec 照常认',
    "import { exec } from 'node:child_process'\nconst a = exec('ls')",
    'missing',
  ],
  // 下面两条钉"调用后才写 stdin"这一族(2026-10-04 执行 agent 实测 5 处:
  // ACP JSON-RPC over stdio / StreamMessageWriter(child.stdin) / sendStdioRpc(proc)，
  // 参数区里**没有任何** stdin 痕迹，只扫参数区会把它们派去"修"⇒ 直接改坏功能)
  [
    '调用后 proc.stdin.write ⇒ skip-eats-stdin',
    'const proc = spawnSync("node", ["-e", "s"], { encoding: "utf8" })\nproc.stdin.write(payload)',
    'skip-eats-stdin',
  ],
  [
    '句柄传给 StreamMessageWriter ⇒ skip-eats-stdin',
    'const child = spawnSync("node", ["server"], { encoding: "utf8" })\nnew StreamMessageWriter(child.stdin)',
    'skip-eats-stdin',
  ],
  // CJS 解构导入也是"真导入"(2026-10-04:首版只认 ESM ⇒ CJS 文件整体被判成"没导入"，
  // 整文件缺口被静默放过)
  [
    'CJS require 导入 ⇒照常认',
    "const { execSync } = require('node:child_process')\nconst a = execSync('git rev-parse')",
    'missing',
  ],
  [
    'CJS 解构改名 ⇒ 认改后的名',
    "const { execSync: run } = require('node:child_process')\nconst a = run('git status')",
    'none',
  ],
  [
    '对象字面量方法 exec ⇒ 不认',
    'const cli = { async exec() { return 1 } }\nconst r = cli.exec()',
    'none',
  ],
  // 下面这条钉"本文件根本没有 child_process 导入 ⇒ 一个名字都不认"。
  // 2026-10-04 实测:首版写 `if (imported && !imported.has(fn))`,`null` 短路成"全认",
  // 于是 `async function exec(stmt){ await db.execute(...) }` 那类遮蔽全变误报
  // (run-ai-world-migration.ts 33 处 + bloom-guard.test.ts 3 处)。
  [
    '无 child_process 导入 ⇒ 即便字面像也不认',
    'import { drizzle } from "./db.js"\nasync function exec(stmt) { return db.execute(stmt) }\nawait exec("select 1")',
    'none',
  ],
  // 下面两条钉 2026-10-04 修的两处判据缺陷(都是执行 agent 实测报出来的)
  [
    '注释里写 stdio:pipe 而真值已合规 ⇒ ok(掩码生效)',
    'const a = execFileSync("git", ["add"], {\n  // 原来写的是 stdio: "pipe"\n  stdio: ["ignore","pipe","pipe"],\n})',
    'ok',
  ],
  [
    'stdio 经变量传参(同调用内的展开)⇒ ok',
    'const a = execFileSync("git", args, { ...opts, stdio: ["ignore","pipe","pipe"] })',
    'ok',
  ],
  // 下面这条钉一个真实踩过的坑:PowerShell 命令字符串里的引号配对到很后面,
  // 掩码函数一度把它后面的 `{ windowsHide: true, stdio: 'ignore' }` 整段吞掉
  // ⇒ **掩码反而制造了缺口**(seal-c-root-stray.mjs 两处由 ok 变 missing)。
  [
    '命令字符串里的引号不得吃掉后面的 stdio ⇒ ok',
    'const l = execFileSync("pwsh", ["-Command", `$i=Get-Item -LiteralPath \'${p}\'`], { windowsHide: true, stdio: "ignore" })',
    'ok',
  ],
  // 下面这条钉"stdio 在上一行的 options 变量里"这一最常见合规形态
  // (2026-10-04 实测 6 处:gitOpts/runOpts 在上一行,调用点在下一行,参数区只有裸标识符)
  [
    'stdio 在上一行的变量里 ⇒ ok',
    'const gitOpts = { stdio: ["ignore","pipe","pipe"], encoding: "utf8" }\nconst runGit = (d, a) => execFileSync("git", a, gitOpts)',
    'ok',
  ],
  // 下面这条钉"多行 join 合成面"里的命中(2026-10-04 实测:
  // `[\n "import …",\n "execFileSync('git', …)",\n].join('\n')` 是**故意**造出来的反面夹具,
  // 每个元素各自一行、同行内引号能配对 ⇒ 只处理同行引号的掩码滤不掉它)
  [
    '多行 join 合成面里的 execFileSync ⇒ 不算真调用',
    'const s = [\n  "import { execFileSync } from \'node:child_process\'",\n  "execFileSync(\'git\', [\'show\', p])",\n].join("\\n")',
    'none',
  ],
  // 下面三条钉 2026-10-04 第二轮修的三处判据缺陷(都是执行 agent 实测报出来的)
  [
    '多行 join 合成面(元素带尾随逗号)⇒ 不算真调用',
    'const s = [\n  "import { execFileSync } from \'node:child_process\'",\n  "execFileSync(\'git\', [\'show\', p])",\n].join("\\n")',
    'none',
  ],
  [
    'input 简写 { input, … } ⇒ skip-eats-stdin(加了 ignore 会静默丢内容)',
    'import { spawnSync } from "node:child_process"\nconst r = spawnSync("pbcopy", [], { input, encoding: "utf8" })',
    'skip-eats-stdin',
  ],
  [
    '末位实参后有尾逗号 ⇒ ok(回查那个变量)',
    'const runOpts = { stdio: ["ignore","pipe","pipe"] }\nconst r = execFileSync("git", args, runOpts,)',
    'ok',
  ],
  // 下面这条钉"数组 + .join() 合成面"的真实形态(2026-10-04 执行 agent 实测 1 处):
  // 数组是**某个函数调用的实参**,后面才 `.join('\n')` —— 前面先撞到的是那个 `(` 而非 `[`。
  [
    'maskComments([…,].join()) 合成面里的 execFileSync ⇒ 不算真调用',
    'const bad = maskComments([\n  "import { execFileSync } from \'node:child_process\'",\n  "execFileSync(\'git\', [\'show\', p])",\n].join("\\n"))',
    'none',
  ],
]

/** 自检源码统一补 child_process 导入前缀 —— 让每条用例都站在"真导入"的前提下,
 *  遮蔽那一类另有专门用例(见上)。不补的话遮蔽检测会把全部用例判成"没导入 ⇒ 不认"。 */
const IMP = "import { execFileSync, spawnSync, execSync } from 'node:child_process'\n"

function selfTest() {
  let pass = 0
  const fail = []
  for (const [name, srcRaw, expect] of SELFTEST_PASS) {
    // 遮蔽那两条自带 import,不能再叠(重复 import 无害,但保持可读)
    const src = srcRaw.includes('node:child_process') ? srcRaw : IMP + srcRaw
    const calls = scanCalls(src)
    if (expect === 'none') {
      if (calls.length === 0) pass++
      else fail.push(name + ' —— 期望不命中,实得 ' + calls.length + ' 处')
      continue
    }
    if (calls.length === 0) {
      fail.push(name + ' —— 一处都没扫到')
      continue
    }
    const pipeReq = expect === 'skip-pipe-required'
    const got = classify(calls[0], pipeReq).verdict
    if (got === expect) pass++
    else fail.push(name + ' —— 期望 ' + expect + ',实得 ' + got)
  }
  return { pass, total: SELFTEST_PASS.length, fail }
}

// ---------------------------------------------------------------------------

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) {
    const r = selfTest()
    r.fail.forEach((f) => console.log('  ✗ ' + f))
    console.log(`自检 ${r.pass}/${r.total} ${r.fail.length === 0 ? '✅ 全部通过' : '❌ 有失败'}`)
    process.exit(r.fail.length === 0 ? 0 : 1)
  }

  let face = 'head'
  if (argv.includes('--staged')) face = 'staged'
  if (argv.includes('--worktree')) face = 'worktree'
  const showAll = argv.includes('--all')
  // --json 档**只吐 JSON**:任何一行人读的前置输出都会让消费方 `JSON.parse` 当场炸掉
  // (实测踩过:进度行走 stdout,解析器第一行就 SyntaxError)。人读信息一律走 stderr。
  const asJson = argv.includes('--json')
  const say = (s) => (asJson ? process.stderr.write(s + '\n') : console.log(s))

  if (face === 'staged') {
    say('ℹ️ --staged 只出报告(§12 污染型),判定面=索引 blob')
  }

  const cands = listCandidates()
  if (cands instanceof Undetermined) {
    say('❌ 取材未判定(git 问不到候选清单)⇒ 不记为通过。退出码 2')
    process.exit(2)
  }
  say(`判定面:${face === 'head' ? 'HEAD blob' : face}  扫描面:${SCAN_ROOTS.join('/')}  候选 ${cands.length} 文件`)
  if (face === 'staged') {
    say('⚠️ 索引面不判红(工作树/索引常年滞后 HEAD,按它判会自我掩盖)')
  }

  const pipeFiles = new Set(PIPE_REQUIRED.map((e) => e.file))
  const missing = []
  const pipeBoth = []
  const skipped = []
  const exempted = []
  let readFail = 0

  // 取材:face 决定读哪一面。**2026-10-04 修正** —— 原实现恒读 `HEAD:<path>`、`--worktree`
  // 只改人读标签不改取材键,于是工作树里刚改好的文件在门上仍报原数(四个执行 agent 各自踩到,
  // 有人差点据此判"改动没生效")。**一个 `--worktree` 旗标必须真的换取材面,否则它是在骗人。**
  const key = (f) => (face === 'worktree' ? 'WT:' + f : 'HEAD:' + f)
  const bulk = readAllCandidates(cands, key)
  if (bulk instanceof Undetermined) {
    say('❌ ' + bulk.message + '⇒ 不记为通过。退出码 2')
    process.exit(2)
  }
  for (const file of cands) {
    const src = face === 'worktree' ? readWorktreeFile(REPO, file) : bulk.m.get(key(file))
    if (src === undefined || src === null) {
      readFail++
      continue
    }
    const r = String(src)
    const isPipeReq = pipeFiles.has(file)
    for (const call of scanCalls(r)) {
      const v = classify(call, isPipeReq)
      const row = { file, line: lineOf(r, call.at), fn: call.fn, stdio: call.stdio }
      // 豁免台账逐点扣除(2026-10-04):已逐条实证的真吃 stdin / 判据反向锚 / stdio 经变量传参。
      // 匹配按**内容锚点**(文件 + 该行文本里确有该次调用),**不按行号** ——
      // 行号在任何一次 append 后都会挪位,拿它做匹配会静默放过真缺口。
      const ex = EXEMPT.find((e) => e.file === file && e.fn === call.fn && anchorHit(r, call, e))
      if (ex) {
        exempted.push({ ...row, why: 'EXEMPT', note: ex.why })
        continue
      }
      if (v.verdict === 'missing') missing.push(row)
      else if (v.verdict === 'pipe-both') pipeBoth.push(row)
      else if (v.verdict === 'undetermined') readFail++
      else skipped.push({ ...row, why: v.verdict })
    }
  }

  if (readFail > 0) say(`⚠️ ${readFail} 处未判定(取材失败或源被截断)—— **未判定 ≠ 通过**`)

  if (showAll && !asJson && skipped.length + exempted.length > 0) {
    say(`── 已放行 ${skipped.length} 处(吃 stdin / 判据要求 pipe)+ 豁免台账 ${exempted.length} 处(逐条实证)──`)
    const byWhy = {}
    for (const s of [...skipped, ...exempted]) (byWhy[s.why] = byWhy[s.why] || []).push(s)
    for (const [why, list] of Object.entries(byWhy)) {
      say(`  【${why}】${list.length} 处`)
      list.slice(0, 6).forEach((s) => say(`     ${s.file}:${s.line} ${s.fn}()`))
      if (list.length > 6) say(`     …另 ${list.length - 6} 处`)
    }
  }

  if (missing.length === 0 && pipeBoth.length === 0) {
    say(`✅ 无缺口(放行 ${skipped.length} 处 + 豁免台账 ${exempted.length} 处)`)
    process.exit(0)
  }

  // --json:全量清单(供派单/批量修),一条不缺 —— 打印态只列前 N 条是给人看的,
  // 派单要的是**完整集合**,否则下一个人只能拿到前 25 条就以为"就这些"。
  if (argv.includes('--json')) {
    console.log(
      JSON.stringify(
        { face, candidates: cands.length, missing, pipeBoth, skippedCount: skipped.length, exempted, readFail },
        null,
        1,
      ),
    )
    process.exit(1)
  }

  console.log(`❌ 缺 stdio ${missing.length} 处 · stdio 为三通道全管道 ${pipeBoth.length} 处`)
  for (const r of missing.slice(0, 25)) {
    console.log(`   ${r.file}:${r.line} ${r.fn}() —— 补 stdio: ['ignore','pipe','pipe']`)
  }
  if (missing.length > 25) console.log(`   …另 ${missing.length - 25} 处`)
  if (pipeBoth.length > 0) {
    console.log('── 三通道全管道(改值而非加键)──')
    for (const r of pipeBoth.slice(0, 15)) console.log(`   ${r.file}:${r.line} ${r.fn}() stdio:${r.stdio}`)
  }
  console.log('修法:一律只加/改 stdio,不改判据逻辑;吃 stdin 与判据要求 pipe 的走放行,不硬改。')
  process.exit(1)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) main()
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
