// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠‌‌‌‍‍‌‌‍‍‌‌‌‌‍‍‌‌‌‌‍‍‌‌‌‍‍‌‌‌‍‍‌‌‍‍‌⁠

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

/** 派生子进程的三个入口(与 Node child_process 的命名对齐)。 */
const CALLS = ['execFileSync', 'spawnSync', 'execSync', 'exec', 'spawn']

/**
 * 参数区里出现这些 ⇒ 该调用**消费 stdin**,`stdio[0]` 必须是 `pipe` 或 fd,给 `ignore` 会丢内容。
 *
 * 判据只认"确证"形态,不做推测:宁可放过(报 0)也不误伤 ——
 * 漏报一个调用的代价是一次人工判断,误伤一个的代价是**静默丢内容**。
 */
const EATS_STDIN = [
  /\binput\s*:/,
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

/** 从参数区文本判"是否消费 stdin"。 */
function eatsStdin(inner) {
  return EATS_STDIN.some((re) => re.test(inner))
}

/**
 * 该调用的 options 里 stdio 当前是什么形态;没写则返回 null。
 *
 * 判据只认**键本身存在** + 取其值的**首个字面量**;值是三元/变量/函数调用时(`stdio: opts.quiet ? [...] : [...]`)
 * 返回 `{ expr }` 形态 —— 那一律按"已写 stdio"处理(键在就说明作者处理过),
 * 由 `classify` 的 `ok` 收口。**否则会把上批已修的 `opts.quiet ? A : B` 形态整片误报成 missing。**
 */
function stdioOf(inner) {
  const m = inner.match(/\bstdio\s*:/)
  if (!m) return null
  const after = inner.slice(m.index + m[0].length).trimStart()
  const lit = after.match(/^(\[[^\]]*\]|'[^']*'|"[^"]*")/)
  // 键在、但值不是字面量(变量/三元/函数返回)⇒ 记为 'expr'
  return lit ? lit[1] : 'expr'
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

/** 逐个调用点扫描一段源码,返回 [{ 偏移, 函数名, 参数区, 是否吃stdin, stdio形态 }]。 */
export function scanCalls(src) {
  const mask = maskInert(src)
  const imported = importedCallNames(src)
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
      out.push({
        at,
        fn,
        inner,
        eats: eatsStdin(inner) || writesStdinAfter(src, end, inner),
        stdio: stdioOf(inner),
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
  ['--batch ⇒ skip-eats-stdin', "const a = spawnSync('g', ['cat-file','--batch'], { s: 1 })", 'skip-eats-stdin'],
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
      if (v.verdict === 'missing') missing.push(row)
      else if (v.verdict === 'pipe-both') pipeBoth.push(row)
      else if (v.verdict === 'undetermined') readFail++
      else skipped.push({ ...row, why: v.verdict })
    }
  }

  if (readFail > 0) say(`⚠️ ${readFail} 处未判定(取材失败或源被截断)—— **未判定 ≠ 通过**`)

  if (showAll && !asJson && skipped.length > 0) {
    say(`── 已放行 ${skipped.length} 处(供审计)──`)
    const byWhy = {}
    for (const s of skipped) (byWhy[s.why] = byWhy[s.why] || []).push(s)
    for (const [why, list] of Object.entries(byWhy)) {
      say(`  【${why}】${list.length} 处`)
      list.slice(0, 6).forEach((s) => say(`     ${s.file}:${s.line} ${s.fn}()`))
      if (list.length > 6) say(`     …另 ${list.length - 6} 处`)
    }
  }

  if (missing.length === 0 && pipeBoth.length === 0) {
    say(`✅ 无缺口(放行 ${skipped.length} 处:${'吃 stdin'} / ${'判据要求 pipe'})`)
    process.exit(0)
  }

  // --json:全量清单(供派单/批量修),一条不缺 —— 打印态只列前 N 条是给人看的,
  // 派单要的是**完整集合**,否则下一个人只能拿到前 25 条就以为"就这些"。
  if (argv.includes('--json')) {
    console.log(JSON.stringify({ face, candidates: cands.length, missing, pipeBoth, skippedCount: skipped.length, readFail }, null, 1))
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
