// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门:检测"派生控制台程序却漏 windowsHide"的 node 调用点。
// 根因:Node v24 child_process 的 windowsHide 默认 false;无控制台父进程(GUI agent 宿主 /
// detached worker / 计划任务)派生 git、cmd、pnpm 等控制台程序时,Windows 必新分配可见控制台
// → 用户桌面闪黑窗。本守门把"必须显式写 windowsHide"变成机制,而不是靠人记。
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { extname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

// 保守白名单:只有能**肯定**是控制台程序的首参才判违规 —— 宁漏报不误报,避免阻塞他人提交。
// 2026-09-24 补齐三类此前盲区(均为 Windows 控制台子系统程序,漏 windowsHide 同样弹窗):
//   · Node 工具链 tsx / turbo / vite(注意 npx 本已在表内,无需新增)
//   · Python / 设备侧 uvicorn / adb
//   · Windows 脚本宿主与主机 cscript / wscript / conhost(cscript 即 .vbs 的无窗执行入口)
export const CONSOLE_LITERALS = [
  'git','node','npm','npx','pnpm','pnpx','yarn','bun','deno','cmd','pwsh','powershell',
  'taskkill','schtasks','reg','where','netstat','tasklist','ffmpeg','ffprobe','taro',
  'next','tsc','tsx','eslint','prettier','python','python3','pip','pip3','uv','uvicorn','mypy',
  'gradle','cargo','go','make','turbo','vite','adb','cscript','wscript','conhost',
]
const CONSOLE_SET = new Set(CONSOLE_LITERALS)
// 首参为这些标识符时,其值几乎必然是控制台可执行文件路径
const CONSOLE_IDENT = /^(GIT_BIN|GIT_PATH|NODE_BIN|NPM_EXEC|npmExec|gitBin|gitExe|gitPath|nodeBin|pythonBin|PYTHON_BIN)$/
const FN_RE = /\b(execSync|execFileSync|spawnSync|spawn|execFile|exec|fork)\s*\(/g
const SOURCE_EXT = new Set(['.mjs', '.cjs', '.js', '.ts', '.tsx'])
const TEST_PATH = /(\.test\.|\.spec\.|[\\/]tests?[\\/]|[\\/]e2e[\\/]|[\\/]bench[\\/])/
const SKIP_DIR = /[\\/](node_modules|dist|build|\.next|\.turbo|coverage|android|ios)[\\/]/

// 自我豁免(仅本文件):self-test 样例区里的 src 字段是**故意构造**的判据字符串,不是真实派生点。
// 全量扫描若把样例当生产违规,这道门在 CI / 全量审计场景恒红。豁免严格限定为本脚本自身
// (SELF_EXEMPT_FILE),且必须成对标记齐全;任何其他文件写同样标记一律无效 —— 判据不因此变松,
// 真实代码里 spawn('git', ...) 漏 windowsHide 仍被 BLOCK(见 tests 的注入对照用例)。
const SELF_EXEMPT_FILE = /(^|[\\/])check-no-visible-spawn\.mjs$/
export const SELFTEST_BEGIN = '// ihui:selftest-samples:start'
export const SELFTEST_END = '// ihui:selftest-samples:end'

/** 把成对 self-test 标记之间的行清空(保留行数以维持行号)。标记缺失/不成对则不豁免(宁红不漏)。 */
export function stripSelfTestRegions(src) {
  const lines = src.split('\n')
  const starts = []
  const ends = []
  lines.forEach((l, i) => {
    const t = l.trim()
    if (t === SELFTEST_BEGIN) starts.push(i)
    else if (t === SELFTEST_END) ends.push(i)
  })
  if (starts.length !== 1 || ends.length !== 1 || ends[0] <= starts[0]) return src
  return lines.map((l, i) => (i > starts[0] && i < ends[0] ? '' : l)).join('\n')
}

/** 跳过以 quote 起手的字符串字面量(含转义与模板插值),返回结束下标。 */
export function skipQuoted(src, start, quote) {
  let i = start + 1
  while (i < src.length) {
    const ch = src[i]
    if (ch === '\\') {
      i += 2
      continue
    }
    if (ch === quote) return i + 1
    if (quote === '`' && ch === '$' && src[i + 1] === '{') {
      let d = 1
      i += 2
      while (i < src.length && d > 0) {
        if (src[i] === '{') d++
        else if (src[i] === '}') d--
        i++
      }
      continue
    }
    i++
  }
  return i
}

/** 从 `(` 起做括号配平,返回该调用结束下标(右括号之后)。跳过字符串与注释内的括号。 */
export function scanCallEnd(src, openParen) {
  let depth = 1
  let i = openParen + 1
  while (i < src.length && depth > 0) {
    const ch = src[i]
    const next = src[i + 1]
    if (ch === '/' && next === '/') {
      const nl = src.indexOf('\n', i)
      i = nl === -1 ? src.length : nl + 1
      continue
    }
    if (ch === '/' && next === '*') {
      const close = src.indexOf('*/', i + 2)
      i = close === -1 ? src.length : close + 2
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      i = skipQuoted(src, i, ch)
      continue
    }
    if (ch === '(') depth++
    else if (ch === ')') depth--
    i++
  }
  return i
}

/** 取调用的首参文本(顶层逗号之前),用于判定派生目标。入参为括号**内部**内容。 */
export function firstArg(inner) {
  let depth = 0
  let i = 0
  while (i < inner.length) {
    const ch = inner[i]
    if (ch === '"' || ch === "'" || ch === '`') {
      i = skipQuoted(inner, i, ch)
      continue
    }
    if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}') depth--
    else if (ch === ',' && depth === 0) break
    i++
  }
  return inner.slice(0, i).trim()
}

/** 取可执行文件名:去路径、转小写、去可执行扩展名。
 *  必须一并去 .cmd/.bat/.com —— Windows 上 npm 系 CLI(tsc / eslint / tsx / vite / turbo …)
 *  落地的其实是 node_modules/.bin/*.cmd shim,绝对路径形态以 .cmd 结尾;只去 .exe 会查表 miss
 *  (与 scripts/ensure-silent-tasks.mjs 的 exeNameOf 同类坑,那里已按 .exe|.cmd|.bat|.com 剥)。 */
const EXE_EXT_RE = /\.(exe|cmd|bat|com)$/
export function exeName(s) {
  return s.split(/[\\/]/).pop().toLowerCase().replace(EXE_EXT_RE, '')
}

/** 一个 .bat/.cmd 本身就是控制台载体(只能经 cmd.exe 跑),与文件名是否在白名单无关。
 *  只认"无空格的首个 token",避免 `'git commit -m "add build.bat"'` 被误判成派生批处理。 */
export function isBatchToken(token) {
  return /\.(bat|cmd)$/.test(token.toLowerCase())
}

/** 字面量首参的候选可执行名,三种取法并列(白名单/批处理判定后才算命中,故不会扩大误报面):
 *  1) 整串 —— 形如 'git' 的裸程序名;2) 空格首段 —— 'git status' / 'C:\\a\\git.exe status';
 *  3) 已知扩展名截断 —— 未加引号的含空格绝对路径 + 参数('C:\\Program Files\\nodejs\\node.exe -v')。 */
export function exeCandidates(raw) {
  const out = [raw, raw.split(/\s+/)[0] ?? '']
  const extMatch = raw.match(/^.*?\.(exe|cmd|bat|com)\b/i)
  if (extMatch) out.push(extMatch[0])
  return out.filter(Boolean)
}

/** 首参是否明确指向会新分配控制台的程序。 */
export function isConsoleTarget(argText) {
  if (!argText) return false
  const lit = argText.match(/^(?:(['"])((?:[^\\]|\\.)*?)\1|`([^`]*)`)$/)
  if (lit) {
    const raw = (lit[2] ?? lit[3] ?? '').replace(/\$\{[^}]*\}/g, 'x').trim()
    if (!raw) return false
    const firstToken = raw.split(/\s+/)[0] ?? ''
    return (
      isBatchToken(firstToken) ||
      exeCandidates(raw).some((c) => CONSOLE_SET.has(exeName(c)))
    )
  }
  if (argText.includes('process.execPath')) return true
  return CONSOLE_IDENT.test(argText)
}

/** 扫描单个源文件,返回违规项数组。 */
export function scanSource(src, file) {
  if (SELF_EXEMPT_FILE.test(file)) src = stripSelfTestRegions(src) // 仅本脚本 self-test 样例区豁免
  const violations = []
  FN_RE.lastIndex = 0 // 模块级正则跨文件必须重置,否则漏扫/串档
  let m
  while ((m = FN_RE.exec(src)) !== null) {
    const openParen = m.index + m[0].length - 1
    const lineStart = src.lastIndexOf('\n', m.index) + 1
    if (/^\s*(\/\/|\*|#)/.test(src.slice(lineStart, m.index))) continue // 注释行
    const end = scanCallEnd(src, openParen)
    const callText = src.slice(m.index, end)
    if (/\bwindowsHide\b/.test(callText)) {
      // 外层已声明:不跳过整段,让内层嵌套调用继续被扫描(否则会漏报)
      FN_RE.lastIndex = m.index + m[0].length
      continue
    }
    // 外层违规:整段按一处上报,避免同一行嵌套重复计数制造噪音
    FN_RE.lastIndex = end
    const inner = callText.slice(openParen - m.index + 1, -1)
    if (!isConsoleTarget(firstArg(inner))) continue
    violations.push({
      file,
      line: src.slice(0, m.index).split('\n').length,
      fn: m[1],
      snippet: callText.replace(/\s+/g, ' ').slice(0, 100),
    })
  }
  return violations
}

function gitLines(args) {
  return execFileSync('git', ['-c', 'safe.directory=*', ...args], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    windowsHide: true,
  })
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** 文件是否进入扫描范围(扩展名 / 跳过目录 / 声明文件 / 真实存在)。
 *  导出给镜像测试复用,避免测试里再抄一份判据常量(§22c 镜像漂移)。 */
export function passesFilter(f) {
  return SOURCE_EXT.has(extname(f).toLowerCase()) && !SKIP_DIR.test(f) && !f.endsWith('.d.ts') && existsSync(resolve(f))
}

/** 待扫文件清单。
 *  全量模式必须并上"未被 .gitignore 忽略的未跟踪文件" —— 只跑 git ls-files 时,
 *  新建但还没 git add 的脚本(如 scripts/ensure-silent-tasks.mjs 曾长期如此)完全不在视野内。
 *  --exclude-standard 不能省:不带它时本仓库 git ls-files --others 会返回 30 万+ 被忽略文件。
 *  --staged 模式不并:未跟踪文件本就不属于本次提交,把别人的半成品拉进来会造成误阻塞。 */
export function listCandidates(staged) {
  const files = staged
    ? gitLines(['diff', '--cached', '--name-only', '--diff-filter=ACM'])
    : [...gitLines(['ls-files']), ...gitLines(['ls-files', '--others', '--exclude-standard'])]
  return [...new Set(files)].filter(passesFilter)
}

function selfTest() {
  // ihui:selftest-samples:start
  // 下面每条 src 是故意构造的判据样例(有的带 windowsHide 应通过、有的不带应被抓住)。
  // 本区间被 scanSource 的 SELF_EXEMPT_FILE 自我豁免覆盖,全量扫描不再把样例当生产违规。
  const cases = [
    { name: 'execSync git 缺参 → 违规', src: `execSync('git status', { encoding: 'utf8' })`, want: 1 },
    { name: 'execSync git 带参 → 通过', src: `execSync('git status', { encoding: 'utf8', windowsHide: true })`, want: 0 },
    { name: 'spawnSync git 无 options → 违规', src: `spawnSync('git', ['rev-parse', 'HEAD'])`, want: 1 },
    { name: 'spawn git 带参 → 通过', src: `spawn('git', args, { stdio: 'inherit', windowsHide: true })`, want: 0 },
    { name: 'process.execPath → 违规', src: `spawnSync(process.execPath, [x], { encoding: 'utf8' })`, want: 1 },
    { name: 'GIT_BIN 标识符 → 违规', src: `spawnSync(GIT_BIN, args, { encoding: 'utf8' })`, want: 1 },
    { name: '非控制台程序 → 忽略', src: `spawnSync('open', ['http://x'])`, want: 0 },
    { name: '未知变量 → 忽略(宁漏不误报)', src: `spawnSync(someHelper, ['a'], { encoding: 'utf8' })`, want: 0 },
    { name: '注释行 → 忽略', src: `// execSync('git status', { encoding: 'utf8' })`, want: 0 },
    { name: '模板串 git push → 违规', src: 'execSync(`git push origin ${b}`, { stdio: "pipe" })', want: 1 },
    {
      name: 'options 含嵌套括号仍正确',
      src: `execFileSync('git', ['log', '--format=%s(demo)'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })`,
      want: 1,
    },
    { name: '跨行 options 带参 → 通过', src: `execFileSync('git', ['log'], {\n  encoding: 'utf8',\n  windowsHide: true,\n})`, want: 0 },
    {
      name: '外层违规时嵌套按一处报',
      src: `execFileSync('git', ['show', execSync('git x', { encoding: 'utf8' })], { encoding: 'utf8' })`,
      want: 1,
    },
    {
      name: '外层干净但内层漏参 → 仍抓到',
      src: `execFileSync('git', ['show', execSync('git x', { encoding: 'utf8' })], { windowsHide: true })`,
      want: 1,
    },
    // --- 2026-09-24 盲区 1:新入表控制台程序(tsx/turbo/vite/uvicorn/adb/cscript/wscript/conhost) ---
    { name: 'tsx 漏参 → 违规', src: `spawnSync('tsx', ['watch src/index.ts'])`, want: 1 },
    { name: 'turbo 漏参 → 违规', src: `execFileSync('turbo', ['build', '--filter=web'], { encoding: 'utf8' })`, want: 1 },
    { name: 'vite + uvicorn 漏参 → 各违规', src: `spawn('vite', ['--port','3000'])\nspawn('uvicorn', ['app.main:app'])`, want: 2 },
    { name: 'adb / cscript / wscript / conhost 漏参 → 各违规', src: `execSync('adb devices')\nexecSync('cscript //nologo x.vbs')\nexecSync('wscript x.vbs')\nspawnSync('conhost', ['--', 'git', 'status'])`, want: 4 },
    { name: '新入表程序带 windowsHide → 通过', src: `spawn('tsx', args, { stdio: 'inherit', windowsHide: true })`, want: 0 },
    // --- 盲区 3(同类坑):.cmd shim 绝对路径 / 含空格未加引号路径 / .bat 派生 ---
    { name: 'node_modules/.bin/pnpm.cmd 绝对路径漏参 → 违规', src: `execFileSync('D:/IHUI-AI/node_modules/.bin/pnpm.cmd', ['build'], { encoding: 'utf8' })`, want: 1 },
    { name: '含空格未加引号绝对路径 + 参数 → 违规', src: `execSync('C:\\\\Program Files\\\\nodejs\\\\node.exe -e "x"', { encoding: 'utf8' })`, want: 1 },
    { name: '反斜杠 .cmd 绝对路径带参 → 违规', src: `spawnSync('C:\\\\repo\\\\tsx.cmd', ['x'])`, want: 1 },
    { name: '派生 .bat 脚本(必开控制台)→ 违规', src: `spawnSync('scripts/build.bat', ['-Release'])`, want: 1 },
    { name: '派生 .bat 已带 windowsHide → 通过', src: `spawnSync('scripts/build.bat', ['-Release'], { windowsHide: true })`, want: 0 },
    { name: '.bat 只出现在参数里 → 不误判(宁漏不误报)', src: `spawnSync(helper, ['build.bat'])\nspawnSync('notepad', ['notes.txt'])`, want: 0 },
    // --- 盲区 2:未跟踪文件纳入扫描(判据在 listCandidates,详见 tests 镜像用例) ---
  ]
  // ihui:selftest-samples:end
  let bad = 0
  for (const c of cases) {
    const got = scanSource(c.src, 'selftest.js').length
    const ok = got === c.want
    if (!ok) bad++
    console.log(`${ok ? '✅' : '❌'} ${c.name} (期望 ${c.want} 实得 ${got})`)
  }
  console.log(bad === 0 ? `\nself-test 全通过(${cases.length} 例)` : `\nself-test 失败 ${bad}/${cases.length} 例`)
  return bad === 0
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) process.exit(selfTest() ? 0 : 1)
  const staged = argv.includes('--staged')
  const files = listCandidates(staged)
  const prod = []
  const test = []
  for (const f of files) {
    const found = scanSource(readFileSync(resolve(f), 'utf8'), f)
    if (found.length) (TEST_PATH.test(f) ? test : prod).push(...found)
  }
  const mode = staged ? '--staged' : '全量'
  if (prod.length) {
    console.log(`❌ [check-no-visible-spawn ${mode}] 生产代码 ${prod.length} 处「派生控制台程序但漏 windowsHide」:`)
    for (const v of prod.slice(0, 40)) console.log(`   ${v.file}:${v.line}  ${v.snippet}`)
    if (prod.length > 40) console.log(`   ... 其余 ${prod.length - 40} 处`)
    console.log('   修复:在该调用 options 里加 `windowsHide: true`(无 options 则补 `{ windowsHide: true }`)。')
  }
  if (test.length) {
    console.log(
      `⚠️  [check-no-visible-spawn ${mode}] 测试代码 ${test.length} 处(warn-only:测试由终端 runner 派生,子进程继承已有控制台,不新分配窗口)`,
    )
  }
  if (!prod.length) console.log(`✅ [check-no-visible-spawn ${mode}] 扫描 ${files.length} 文件,生产代码 0 违规`)
  process.exit(prod.length ? 1 : 0)
}

export const __test__ = {
  scanSource,
  scanCallEnd,
  skipQuoted,
  firstArg,
  isConsoleTarget,
  listCandidates,
  CONSOLE_LITERALS,
  stripSelfTestRegions,
  SELFTEST_BEGIN,
  SELFTEST_END,
  exeName,
  isBatchToken,
  exeCandidates,
  passesFilter,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
