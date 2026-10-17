// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-mjs-syntax.mjs —— 被审面全部 .mjs 的**纯语法**对账(2026-10-16 立,事故型 436864e6e9)。
 *
 * 立因(实测,非假设):`scripts/lib/post-merge-ledger-sync.mjs` 被提交 436864e6e9 带进一根孤立的
 * `/`(编辑器把块注释起头 `/**` 劈成单行 `/`),`node --check` 当场 SyntaxError,而它活着落过了
 * 后面一枚提交约半小时 —— 全链没有任何一层报出来:
 *   ① check-staged-typecheck / check-head-typecheck 按 TS 报错形态(`文件(行,列): error TS…`)过滤,
 *      `.mjs` 语法死不成形;
 *   ② `--self-test` 只有门体自己被跑时才会 import 到它;
 *   ③ 镜像测试面(run-script-tests)不在提交链注册表里。
 * ⇒ 语法层对 `.mjs` 整族失明,这道门补的就是这一格。上线复验:机主给的
 * `git grep -l -E '^/$' HEAD -- '*.mjs'` 确实 0 命中,但那把尺子量不到全部语法死型,
 * 本门解析器现读出存量 1 枚(见"定级"段)——这正是"数字一律现读、以真判据为准"(§0.1)。
 *
 * 判据(三档退出码,§0.3):
 *   0 = 被审面可解析;或与 HEAD 面相比零新增且存量已登记报数(见下方"定级")。
 *   1 = 判出**本次带进来的**不可解析文件(`--staged` 差值棘轮新增臂 / 全量档 `--strict` 问责存量);
 *   2 = 未判定 —— 面取不到 / 清单枚举为 0 / 解析子进程崩或超时或回数对不上 / 两面旗同给。
 * 判通过必须建立在"每一枚候选都被子进程看过"之上:child 回数 ≠ 送数 ⇒ 未判定,绝不记绿。
 *
 * 定级(上线当刻复验改写,不是设计稿里的"应为 0"):HEAD 面存量实测 **1 枚** ——
 * `apps/miniapp-taro/scripts/gen-line-icons.mjs:51`(枚 7946bca904 摘豁免标记时把 `const EXEMPT = '…'`
 * 的字符串尾劈掉,`node --check` 同点复现;机主给的 `^/$` grep 抓不到这一型,正说明要的是解析器不是 grep)。
 * 按 §12e:判历史存量的红与任何提交内容无关,唯一结局是逼人 --no-verify 废掉全部守门 ⇒
 * 全量档对存量**只报数**(exit 0 + ⚠️ 点名),`--strict` 才问责;真正的判红臂 = `--staged`
 * 差值棘轮(索引 blob 不可解析 ∧ HEAD blob 可解析/无此文件 ⇒ 本次带进来 ⇒ exit 1)。
 * 存量清偿(该文件修好)后全量档自然读成零新增零存量,无需改判据。
 *
 * 取材面纪律(守门 118):全量档判 **HEAD blob**(清单 = `ls-tree -r HEAD`,内容 = 同轮
 * `cat-file --batch` 批量预取)、`--staged` 判**索引 blob**(清单 = `ls-files --cached`,
 * 内容 = `:<path>`)、`--worktree` 仅人工逃生舱;两面旗同给 ⇒ exit 2;取不到不回落另一个面。
 * 清单与内容同面同轮;批量取材一律走 scripts/lib/face-reader.mjs(catBatch/gitRaw),
 * 禁止逐文件各开一次 git(守门 80 fork 风暴),禁止 readdirSync 当清单。
 *
 * **"只解析、绝不执行"怎么保证**:`--experimental-vm-modules` 子进程内对每枚 blob 文本做
 * `new vm.SourceTextModule(source)` —— 构造只做 parse/compile,`link`/`evaluate` 一律不调用,
 * import 说明符不参与求值,被检文件的顶层代码一行都不跑(self-test 用"顶层写哨兵文件"的夹具
 * 反证:编译通过且哨兵必不存在)。批量子进程**一次派生吃完全部文件**;子进程 windowsHide +
 * 显式 stdio + timeout(§12g),stdin 走 face-reader 的 EBUSY 兜底通道(spawnViaTempStdinFile)。
 * 行号定位只对**判红的那几枚**补跑一次 `node --check`(临时副本落 .ihui-agent/tmp,用完即删),
 * 存量正常路径为 0 枚 ⇒ 提交链上不产生 fork 风暴。
 *
 * 差值棘轮(§12e):`--staged` 档下,不可解析文件先问 HEAD 面 —— 索引 blob 与 HEAD blob 逐字相同
 * 或 HEAD 版本本就不可解析 ⇒ 存量,只报数;HEAD 没有该文件或 HEAD 版本可解析 ⇒ 本次带进来的,判红。
 * 全量档(HEAD 面)无"本次"概念,判出即红(上线前置 = 存量归零,已复验)。
 *
 * 自检:`node scripts/check-mjs-syntax.mjs --self-test`
 * 镜像测试:`node --test scripts/tests/check-mjs-syntax.test.mjs`(判据 import 本文件 __test__,§22c)
 * 应急跳过(注册条体现值以 scripts/guardian-runner.mjs 为准):HUSKY_SKIP_MJS_SYNTAX=1
 */

import { spawnSync, execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  Undetermined,
  catBatch,
  gitRaw,
  readWorktreeFile,
  selectFace,
  spawnViaTempStdinFile,
} from './lib/face-reader.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const TMP_DIR = join(ROOT, '.ihui-agent', 'tmp', 'check-mjs-syntax')
const CHILD_TIMEOUT = 240_000
const LOCATE_TIMEOUT = 30_000

/**
 * 批量解析子进程的源码(ESM,经 `--input-type=module -e` 直喂,不落盘)。
 * stdin = JSON 数组 `[{p,s}]`;stdout = JSON 数组 `[{p,ok,msg?}]`,或 `{"__fatal__":原因}`。
 * 只 compile 不 evaluate —— 这是本门"不许执行被检文件"的实现点,改动前先看 self-test T5。
 */
const CHILD_SRC = [
  "import vm from 'node:vm'",
  "const chunks = []",
  'for await (const c of process.stdin) chunks.push(c)',
  'let files',
  'try { files = JSON.parse(Buffer.concat(chunks).toString("utf8")) } catch (e) {',
  '  process.stdout.write(JSON.stringify({ __fatal__: "stdin-not-json:" + e.message }))',
  '  process.exit(0)',
  '}',
  'if (typeof vm.SourceTextModule !== "function") {',
  '  process.stdout.write(JSON.stringify({ __fatal__: "no-SourceTextModule (need --experimental-vm-modules)" }))',
  '  process.exit(0)',
  '}',
  'const out = []',
  'for (const f of files) {',
  '  try {',
  '    new vm.SourceTextModule(f.s)',
  '    out.push({ p: f.p, ok: true })',
  '  } catch (e) {',
  '    out.push({ p: f.p, ok: false, msg: String((e && e.message) || e).split("\\n")[0] })',
  '  }',
  '}',
  'process.stdout.write(JSON.stringify(out))',
].join('\n')

/** 各面的内容规格(与清单同面同轮;规格串直接喂 catBatch)。 */
function specOf(face, p) {
  return face === 'head' ? `HEAD:${p}` : face === 'staged' ? `:${p}` : p
}

/** 纯函数:面清单(NUL 分隔的 ls-tree/ls-files 输出)→ 仅 .mjs 的路径数组。 */
function filterMjsPaths(nulListText) {
  return String(nulListText)
    .split('\0')
    .map((s) => s.trim())
    .filter((s) => s !== '' && s.endsWith('.mjs'))
    .sort()
}

/** 纯函数:清单枚举为 0 ⇒ 判死(§0.3:枚举到 0 个候选不记绿)。 */
function assertCandidates(paths, face) {
  if (!Array.isArray(paths) || paths.length === 0) {
    throw new Undetermined(`判定面(${face})枚举到的 .mjs 为 0 枚 —— 清单本身可疑,不判"没问题"`)
  }
  return paths
}

/** 纯函数:child stdout → 结果数组;任何"没看完"的形状都抛 Undetermined,不回落。 */
function parseChildOutput(stdout, expectCount) {
  let data
  try {
    data = JSON.parse(String(stdout))
  } catch (e) {
    throw new Undetermined(`解析子进程 stdout 不是合法 JSON(前 120 字:${String(stdout).slice(0, 120)}): ${e.message}`)
  }
  if (data && !Array.isArray(data) && typeof data.__fatal__ === 'string') {
    throw new Undetermined(`解析子进程自报致命: ${data.__fatal__}`)
  }
  if (!Array.isArray(data)) throw new Undetermined('解析子进程 stdout 不是数组 ⇒ 未判定')
  if (data.length !== expectCount) {
    throw new Undetermined(`解析子进程回数 ${data.length} ≠ 送数 ${expectCount} ⇒ 没看完,不是"都没问题"`)
  }
  return data
}

/**
 * 一次派生吃完全部文件。stdio 显式三 pipe(§12g;丢了 stdout 又去读 ⇒ 结论恒 null,门 199 同型);
 * 大 stdin 载荷(真仓实测 1333 枚 / ~31MB)在 EBUSY 病窗走 spawnViaTempStdinFile 的 fd 通道重试一次。
 * 任何派生层故障(ENOENT/超时/信号/非零退出)⇒ Undetermined,绝不折成"语法都过"。
 */
function runParseBatch(files, opts = {}) {
  const execPath = opts.execPath || process.execPath
  const root = opts.root || ROOT
  const spawnOpts = {
    cwd: root,
    input: Buffer.from(JSON.stringify(files.map((f) => ({ p: f.p, s: f.s }))), 'utf8'),
    encoding: 'utf8',
    windowsHide: true,
    timeout: opts.timeout ?? CHILD_TIMEOUT,
    maxBuffer: 64 << 20,
    stdio: ['pipe', 'pipe', 'pipe'],
  }
  const args = ['--experimental-vm-modules', '--input-type=module', '-e', CHILD_SRC]
  const spawn = opts.spawn || spawnSync
  let r = spawn(execPath, args, spawnOpts)
  if (r && r.error && r.error.code === 'EBUSY') {
    r = spawnViaTempStdinFile(execPath, args, spawnOpts)
  }
  if (!r) throw new Undetermined('解析子进程无返回 ⇒ 未判定')
  if (r.error) throw new Undetermined(`解析子进程派生失败(${r.error.code || r.error.message})`)
  if (r.signal) throw new Undetermined(`解析子进程被信号终止(${String(r.signal)})——可能是超时`)
  if (r.status !== 0) {
    throw new Undetermined(
      `解析子进程退出码 ${r.status}:${String(r.stderr || '').split('\n')[0] || '(无 stderr)'}`,
    )
  }
  return parseChildOutput(r.stdout, files.length).map((x) => ({
    p: x.p,
    ok: x.ok === true,
    msg: typeof x.msg === 'string' ? x.msg : '',
  }))
}

/** 面清单 + 同轮批量内容。返回 [{p, s}];任何一枚取不到 ⇒ Undetermined 点名路径。 */
function collectFaceFiles(root, face) {
  let paths
  if (face === 'head') {
    paths = filterMjsPaths(gitRaw(['ls-tree', '-r', '--name-only', '-z', 'HEAD'], root, { timeout: 120_000 }))
  } else {
    paths = filterMjsPaths(gitRaw(['ls-files', '--cached', '-z'], root, { timeout: 120_000 }))
  }
  assertCandidates(paths, face)
  if (face === 'worktree') {
    const out = []
    const missing = []
    for (const p of paths) {
      const t = readWorktreeFile(root, p)
      if (t === null) missing.push(p)
      else out.push({ p, s: t })
    }
    if (missing.length) throw new Undetermined(`worktree 面 ${missing.length} 枚读不到(如 ${missing[0]})——不回落另一个面`)
    return out
  }
  const map = catBatch(root, paths.map((p) => specOf(face, p)))
  const missing = paths.filter((p) => map.get(specOf(face, p)) === null || map.get(specOf(face, p)) === undefined)
  if (missing.length) {
    throw new Undetermined(
      `${face} 面 ${missing.length}/${paths.length} 枚 blob 取不到(如 ${missing[0]})⇒ 未判定,绝不按"剩下的"记绿`,
    )
  }
  return paths.map((p) => ({ p, s: map.get(specOf(face, p)) }))
}

/**
 * 纯函数:`--staged` 差值棘轮分桶(§12e)。headLookup: Map<p, {indexText, headText, headOk}>。
 * headText=null ⇒ 本次带进来(fresh);索引与 HEAD 逐字相同 或 HEAD 版本本就不可解析 ⇒ 存量(stock);
 * HEAD 版本可解析而索引版本不可解析 ⇒ fresh。headOk=null(没判得动)保守归 fresh ——
 * 失效方向是多拦一次,绝不是多放一次。
 */
function classifyStaged(failed, headLookup) {
  const stock = []
  const fresh = []
  for (const f of failed) {
    const h = headLookup.get(f.p)
    if (!h || h.headText === null || h.headText === undefined) fresh.push(f)
    else if (h.headText === h.indexText) stock.push(f)
    else if (h.headOk === false) stock.push(f)
    else fresh.push(f)
  }
  return { stock, fresh }
}

/**
 * 行号定位:对判红的那几枚,把被审面内容落 .ihui-agent/tmp 临时副本跑一次 `node --check`。
 * 只取 `路径:LINE` 首行与 `SyntaxError:` 首行;取不到行号如实写 null(不影响判红本身)。
 */
function locateSyntaxError(checkOutput) {
  const text = String(checkOutput || '')
  const line = /:(\d+)\s*$/m.exec(text.split('\n')[0] || '')
  const msg = /^SyntaxError: (.*)$/m.exec(text)
  return { line: line ? Number(line[1]) : null, msg: msg ? msg[1] : '' }
}

function locateLine(execPath, relPath, source) {
  try {
    mkdirSync(TMP_DIR, { recursive: true })
    const safe = relPath.replace(/[^a-zA-Z0-9._-]/g, '_')
    const tmp = join(TMP_DIR, `probe-${process.pid}-${Date.now()}-${safe}.mjs`)
    writeFileSync(tmp, source, 'utf8')
    try {
      execFileSync(execPath, ['--check', tmp], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: LOCATE_TIMEOUT,
        maxBuffer: 8 << 20,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      return { line: null, msg: '(node --check 反而通过:与批量档结论矛盾,以批量档为准)' }
    } catch (e) {
      return locateSyntaxError(`${String(e.stderr || '')}\n${String(e.stdout || '')}`)
    } finally {
      try {
        rmSync(tmp, { force: true })
      } catch {}
    }
  } catch {
    return { line: null, msg: '(定位通道不可用,行号未取得)' }
  }
}

/**
 * 纯函数:退出码裁决(三档)。新增臂判红优先;全量档存量只在 `--strict` 下问责 ——
 * 与提交内容无关的红是 §12e 禁的恒红门,上线当刻存量非零(实测 1 枚)所以默认只报数。
 */
function decideStatus({ face, freshCount, stockCount, strict }) {
  if (freshCount > 0) return 1
  if (face === 'head' && strict && stockCount > 0) return 1
  return 0
}

/** 全链执行:返回 {status:0|1|2, lines:string[]}。任何未判定都不冒红也不记绿。 */
function runAudit({ root = ROOT, face, execPath = process.execPath, json = false, strict = false } = {}) {
  const lines = []
  try {
    const files = collectFaceFiles(root, face)
    const results = runParseBatch(files, { root, execPath })
    const failed = results.filter((r) => !r.ok)
    let stock = []
    let fresh = failed
    if (face === 'staged' && failed.length > 0) {
      const headSpecs = failed.map((f) => `HEAD:${f.p}`)
      const headMap = catBatch(root, headSpecs)
      const lookup = new Map()
      const needParse = []
      for (const f of failed) {
        const headText = headMap.get(`HEAD:${f.p}`) ?? null
        const indexText = files.find((x) => x.p === f.p)?.s ?? null
        if (headText !== null && headText !== indexText) needParse.push({ p: f.p, s: headText })
        lookup.set(f.p, { indexText, headText, headOk: undefined })
      }
      if (needParse.length > 0) {
        const headResults = runParseBatch(needParse, { root, execPath })
        for (const hr of headResults) {
          const ent = lookup.get(hr.p)
          if (ent) ent.headOk = hr.ok
        }
      }
      const split = classifyStaged(failed, lookup)
      stock = split.stock
      fresh = split.fresh
    } else if (face === 'head' && !strict) {
      // 全量档且未开 --strict:存量只报数(§12e),判红臂住在 --staged 差值棘轮里。
      stock = failed
      fresh = []
    }
    const verdict = []
    for (const f of fresh) {
      const src = files.find((x) => x.p === f.p)?.s ?? ''
      const loc = locateLine(execPath, f.p, src)
      verdict.push({ p: f.p, line: loc.line, msg: f.msg || loc.msg })
    }
    if (json) {
      return {
        status: decideStatus({ face, freshCount: verdict.length, stockCount: stock.length, strict }),
        lines: [JSON.stringify({ face, scanned: files.length, fresh: verdict, stock: stock.map((s) => ({ p: s.p, msg: s.msg })) })],
      }
    }
    for (const v of verdict) {
      lines.push(`  ❌ ${v.p}${v.line === null ? '' : `:${v.line}`} — ${v.msg || '(错误首行未取到)'}`)
    }
    for (const s of stock) {
      lines.push(`  ⚠️ 存量 ${s.p} — ${s.msg || ''}(HEAD 面本就不可解析,只报数不问责,§12e;清偿归该文件持有人)`)
    }
    const status = decideStatus({ face, freshCount: verdict.length, stockCount: stock.length, strict })
    if (status === 1) {
      lines.push(
        `❌ .mjs 语法对账(${face} 面,扫 ${files.length} 枚):判出 ${verdict.length} 枚不可解析${strict && face === 'head' ? '(--strict 问责存量)' : ''}(存量另计 ${stock.length} 枚)—— 修法:对点名文件跑 node --check 看行,禁止改判据消红`,
      )
      return { status, lines }
    }
    if (stock.length) {
      lines.push(`⚠️ .mjs 语法对账(${face} 面,扫 ${files.length} 枚):新增不可解析 0 枚;存量 ${stock.length} 枚只报数(升全量问责 = --strict)`)
      return { status: 0, lines }
    }
    lines.push(`✅ .mjs 语法对账(${face} 面):${files.length} 枚逐一经 vm.SourceTextModule 编译通过(只解析未执行),存量 0 枚`)
    return { status: 0, lines }
  } catch (e) {
    if (e instanceof Undetermined) {
      lines.push(`⚪ 未判定:${e.message}(不记绿也不冒红;取到输入后重跑本命令)`)
      return { status: 2, lines }
    }
    lines.push(`⚪ 未判定:门体自身异常(${String(e && e.message ? e.message : e)})`)
    return { status: 2, lines }
  }
}

// ───────────────────────── self-test(成对用例;失败方向 = 点名 + exit 1)─────────────────────────

function selfTest() {
  const cases = []
  const t = (name, fn) => cases.push({ name, fn })
  const scratch = { dir: null }

  t('T1 正控:可解析模块不报', () => {
    const out = parseChildOutput('[{"p":"a.mjs","ok":true},{"p":"b.mjs","ok":false,"msg":"boom"}]', 2)
    if (out[0].ok !== true || out[1].ok !== false || out[1].msg !== 'boom') throw new Error('结果分类错位')
  })
  t('T2 反控:回数≠送数 ⇒ 未判定(没看完≠都没问题)', () => {
    let threw = false
    try {
      parseChildOutput('[{"p":"a.mjs","ok":true}]', 2)
    } catch (e) {
      threw = e instanceof Undetermined && /回数 1 ≠ 送数 2/.test(e.message)
    }
    if (!threw) throw new Error('截断未被判成未判定')
  })
  t('T3 反控:child 自报 __fatal__ ⇒ 未判定', () => {
    let threw = false
    try {
      parseChildOutput('{"__fatal__":"no-SourceTextModule"}', 1)
    } catch (e) {
      threw = e instanceof Undetermined && /自报致命/.test(e.message)
    }
    if (!threw) throw new Error('__fatal__ 未被判成未判定')
  })
  t('T4 行号定位:node --check 真形状 → 行 2 + 错误首行(事故原形)', () => {
    const sample = 'D:\\x\\probe-1-bad.mjs:2\n/\n^\n\nSyntaxError: Invalid regular expression: missing /\n    at checkSyntax\n'
    const r = locateSyntaxError(sample)
    if (r.line !== 2) throw new Error(`行号应取 2,实得 ${r.line}`)
    if (r.msg !== 'Invalid regular expression: missing /') throw new Error(`错误首行错位:${r.msg}`)
  })
  t('T5 真子进程:批量只 compile 不执行(哨兵夹具反证)且坏文件必报 msg', () => {
    const { mkScratch, rmScratch } = requireScratch()
    scratch.dir = mkScratch('mjs-syntax-sentinel')
    const sent = join(scratch.dir, 'SENTINEL.txt')
    const files = [
      { p: 'ok.mjs', s: 'export const a = 1;\n' },
      { p: 'bad.mjs', s: 'export const a = 1;\n/\n' },
      { p: 'sentinel.mjs', s: `import { writeFileSync } from 'node:fs';\nwriteFileSync(${JSON.stringify(sent)}, 'ran');\n` },
    ]
    const res = runParseBatch(files, { root: ROOT })
    const byP = new Map(res.map((x) => [x.p, x]))
    if (byP.get('ok.mjs').ok !== true) throw new Error('可解析文件被误报')
    if (byP.get('bad.mjs').ok !== false || !/missing \//.test(byP.get('bad.mjs').msg)) {
      throw new Error(`事故原形未被判出:${JSON.stringify(byP.get('bad.mjs'))}`)
    }
    if (byP.get('sentinel.mjs').ok !== true) throw new Error('哨兵夹具应可解析')
    if (existsSync(sent)) throw new Error('哨兵文件存在 ⇒ 子进程执行了顶层代码,判据作废')
    rmScratch(scratch.dir)
    scratch.dir = null
  })
  t('T6 两面旗同给 ⇒ exit 2 未判定(不回落任一面)', () => {
    const sel = selectFace({ staged: true, worktree: true })
    if (!sel.error) throw new Error('selectFace 未拦两面同给')
  })
  t('T7 取不到面 ⇒ 未判定(非 git 目录实派生)', () => {
    const { mkScratch, rmScratch } = requireScratch()
    const dir = mkScratch('mjs-syntax-nogit')
    try {
      let threw = false
      try {
        collectFaceFiles(dir, 'head')
      } catch (e) {
        threw = e instanceof Undetermined
      }
      if (!threw) throw new Error('非仓库面未被判成未判定')
      rmScratch(dir)
    } catch (e) {
      try {
        rmScratch(dir)
      } catch {}
      throw e
    }
  })
  t('T8 清单枚举为 0 ⇒ 判死不记绿', () => {
    let threw = false
    try {
      assertCandidates(filterMjsPaths('readme.md\0foo.txt\0'), 'head')
    } catch (e) {
      threw = e instanceof Undetermined && /0 枚/.test(e.message)
    }
    if (!threw) throw new Error('0 候选被放过')
  })
  t('T9 差值棘轮三桶(存量/新增/保守),同 stock 判据 import 不自造', () => {
    const mk = (p, indexText, headText, headOk) => [p, { indexText, headText, headOk }]
    const lookup = new Map([
      mk('same.mjs', 'BAD', 'BAD', undefined),
      mk('headbroken.mjs', 'BAD', 'OTHER', false),
      mk('fresh.mjs', 'BAD', 'GOOD', true),
      mk('notinhead.mjs', 'BAD', null, undefined),
    ])
    const failed = [1, 2, 3, 4].map((i) => ({ p: ['same.mjs', 'headbroken.mjs', 'fresh.mjs', 'notinhead.mjs'][i - 1], ok: false, msg: 'x' }))
    const r = classifyStaged(failed, lookup)
    if (r.stock.map((s) => s.p).sort().join(',') !== 'headbroken.mjs,same.mjs') throw new Error(`存量桶错位:${JSON.stringify(r.stock)}`)
    if (r.fresh.map((s) => s.p).sort().join(',') !== 'fresh.mjs,notinhead.mjs') throw new Error(`新增桶错位:${JSON.stringify(r.fresh)}`)
  })
  t('T10 headLookup 缺条目(保守)归新增桶,绝不因查不到而放绿', () => {
    const r = classifyStaged([{ p: 'ghost.mjs', ok: false, msg: 'x' }], new Map())
    if (r.fresh.length !== 1) throw new Error('缺条目未保守归新增')
  })
  t('T11 三档退出码裁决(新增臂红优先/存量只在 --strict 头档红/其余不记红)', () => {
    const d = decideStatus({ face: 'head', freshCount: 1, stockCount: 1, strict: false })
    const h1 = decideStatus({ face: 'head', freshCount: 0, stockCount: 1, strict: false })
    const h2 = decideStatus({ face: 'head', freshCount: 0, stockCount: 1, strict: true })
    const s1 = decideStatus({ face: 'staged', freshCount: 1, stockCount: 0, strict: false })
    const s0 = decideStatus({ face: 'staged', freshCount: 0, stockCount: 0, strict: false })
    const w0 = decideStatus({ face: 'worktree', freshCount: 0, stockCount: 1, strict: false })
    if (!(d === 1 && h1 === 0 && h2 === 1 && s1 === 1 && s0 === 0 && w0 === 0)) {
      throw new Error(`退出码裁决错位:head+new=${d} head+stock=${h1} head+strict=${h2} staged+new=${s1} staged-clean=${s0} wt+stock=${w0}`)
    }
  })

  let pass = 0
  const fails = []
  for (const c of cases) {
    try {
      c.fn()
      pass++
      console.log(`  ✅ ${c.name}`)
    } catch (e) {
      fails.push(c.name)
      console.log(`  ❌ ${c.name}:${e && e.message ? e.message : e}`)
    } finally {
      if (scratch.dir) {
        try {
          requireScratch().rmScratch(scratch.dir)
        } catch {}
      }
    }
  }
  const tail = fails.length
    ? `❌ 自检 ${pass}/${cases.length} 过,${fails.length} 败:${fails.join(' | ')}`
    : `✅ 自检 ${pass}/${cases.length} 例全过(含正反控与哨兵反证)`
  console.log(tail)
  process.exit(fails.length ? 1 : 0)
}

// scratch-dir 只在 self-test 用,延迟 import(生产判据路径不依赖夹具层)
function requireScratch() {
   
  return scratchModule
}
let scratchModule = null

export const __test__ = {
  CHILD_SRC,
  parseChildOutput,
  runParseBatch,
  locateSyntaxError,
  locateLine,
  classifyStaged,
  decideStatus,
  filterMjsPaths,
  assertCandidates,
  collectFaceFiles,
  specOf,
  runAudit,
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) {
    scratchModule = await import('./lib/scratch-dir.mjs')
    selfTest()
    return
  }
  const sel = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree'), def: 'head' })
  if (sel.error) {
    console.log(`⚪ 未判定:${sel.error}`)
    process.exit(2)
  }
  if (argv.some((a) => a === '--help' || a === '-h')) {
    console.log('用法: node scripts/check-mjs-syntax.mjs [--staged|--worktree|--strict|--self-test|--json]')
    return
  }
  const r = runAudit({ face: sel.face, json: argv.includes('--json'), strict: argv.includes('--strict') })
  for (const l of r.lines) console.log(l)
  process.exit(r.status)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
