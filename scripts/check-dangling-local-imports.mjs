#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门:HEAD 悬空具名导入对账(D 判据)
 *
 * 拦的是同一类事故的两个方向 —— "编译期才看得见、而编译只跑工作区":
 *   ① 用了标识符却没 import(守门 77 B6 管档位出口那一种);
 *   ② import 了一个**目标文件根本不导出**的名字(本门)。
 * 2026-09-24 一天内两类各中一次:前者让真机 release 包启动即崩(ReferenceError: rnRadius),
 * 后者让 main 顶端一处导入从合入起就没定义过(PermissionTierRow,`git log --all -S` 全空),
 * Metro 不做类型检查 ⇒ 打包成功、装机能跑、渲染到那一行才炸;而 `pnpm typecheck` 只看
 * 共享工作区,工作区里那个文件恰好是**更旧的基线**,两边都不红。
 *
 * 判据口径(与 77/83/90 同取向):
 *   - 缺省(全量审计)判 **HEAD blob**,不判工作区 —— 滞后的旧草稿不得记成本仓债务;
 *   - `--staged` 判索引 blob,棘轮锚点是**该文件 HEAD 版本自身的违规数**,只拦"这次把悬空
 *     导入加回来了",不拦仓库既有债;
 *   - 宁漏不误报:`export *` 一律把目标标为不可枚举并放过,解析不到的语句一律不判。
 *
 * 用法:
 *   node scripts/check-dangling-local-imports.mjs                 # 全量(判 HEAD)
 *   node scripts/check-dangling-local-imports.mjs --staged        # pre-commit(判索引,锚 HEAD)
 *   node scripts/check-dangling-local-imports.mjs --files a b     # 按文件自验(判工作区)
 *   node scripts/check-dangling-local-imports.mjs --self-test     # 逻辑自检(正反成对)
 * 紧急跳过:HUSKY_SKIP_DANGLING_IMPORTS=1 git commit ...
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GIT = 'C:/Program Files/Git/cmd/git.exe'
const SELF_SKIP = 'HUSKY_SKIP_DANGLING_IMPORTS'
const EXT = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']
/** 带 `?raw` / `?url` 后缀的导入(Vite/测试里读源码文本):查询串在 resolveSpec 里剥掉,
 *  剩下的路径仍须存在 —— 首版把 6 处 `?raw` 全误判成 D2。 */
const SRC_RE = /\.(ts|tsx|js|jsx|mjs|cjs)$/
const SKIP_DIR = /(^|\/)(node_modules|dist|\.next|\.expo|build|android|ios|coverage)\//
/** 夹具树:里面的源码是**故意写坏**的样例(benchmark 任务),不参与任何真实对账 */
const FIXTURE_ROOT = /^(benchmarks|testdata|fixtures)\//
const GIT_TIMEOUT = 120000

const gitOpts = { encoding: 'utf8', windowsHide: true, maxBuffer: 512 << 20, timeout: GIT_TIMEOUT }
const git = (args) => execFileSync(GIT, ['-c', 'safe.directory=*', '-C', ROOT, ...args], gitOpts)

// ── 内容取材:HEAD blob / 索引 blob / 工作区,三种口径共用一条批量读取通道 ──────────────
/** 一次 `cat-file --batch` 读完一批对象,避免 N 次派生(git 写锁与进程风暴都在这里省掉)。
 *  返回 Map<"<rev>:<path>", text|null>(missing / 非 blob 一律 null,不抛异常) */
function catBatch(revs) {
  const out = execFileSync(GIT, ['-c', 'safe.directory=*', '-C', ROOT, 'cat-file', '--batch'], {
    cwd: ROOT,
    windowsHide: true,
    maxBuffer: 512 << 20,
    timeout: GIT_TIMEOUT,
    input: Buffer.from(revs.join('\n') + '\n', 'utf8'),
  })
  const map = new Map()
  let pos = 0
  for (let i = 0; i < revs.length; i++) {
    const nl = out.indexOf(0x0a, pos)
    if (nl < 0) {
      map.set(revs[i], null)
      continue
    }
    const header = out.subarray(pos, nl).toString('utf8')
    pos = nl + 1
    const m = /^([0-9a-f]{40}) blob (\d+)$/.exec(header)
    if (!m) {
      map.set(revs[i], null) // "<rev>:<path> missing" 之类
      continue
    }
    map.set(revs[i], out.subarray(pos, pos + Number(m[2])).toString('utf8'))
    pos += Number(m[2]) + 1
  }
  return map
}

function trackedSourceFiles(rev) {
  return treePaths(rev).filter((p) => SRC_RE.test(p) && !SKIP_DIR.test(p) && !FIXTURE_ROOT.test(p))
}

/** 某个 revision 的**全量**路径集(存在性面)。
 *  必须与内容取材同一个 rev:首版存在性取 `git ls-files`(索引)、内容取 `HEAD:`(树),
 *  而并行会话正在 `git rm` 一批文件 ⇒ 索引里没有、HEAD 里有 ⇒ 那批合法导入被整片假报 D2
 *  (实测 11 处)。判 HEAD 的门,存在性也只能按 HEAD 树判。 */
function treePaths(rev) {
  return rev === '' || rev === 'INDEX'
    ? git(['ls-files', '-z']).split('\0').filter(Boolean)
    : git(['ls-tree', '-r', '--name-only', rev, '-z']).split('\0').filter(Boolean)
}

const NON_CODE_EXT = /\.(css|scss|less|svg|png|jpe?g|gif|webp|ico|woff2?|ttf|eot|mp3|mp4|md|html|txt|glb|hdr|json|map)$/i

function resolveCands(rel) {
  if (NON_CODE_EXT.test(rel)) return [rel] // 资源:只看存在性,不参与导出对账
  const noJs = rel.replace(/\.(js|jsx|mjs|cjs)$/, '')
  const out = []
  if (/\.(js|jsx|mjs|cjs)$/.test(rel) && noJs) {
    // TS 风格写法 `./radius.js`:tsc 的解析顺序是 **先 `radius.ts` / `radius.d.ts`,再 `radius.js`**。
    //   本仓 src 下同时留着同名 `.js` 编译残留(api/web 有多处),按字面 `.js` 先命中就会读到
    //   陈旧产物 ⇒ 假红。故 TS/声明候选必须排在字面 `.js` 之前。
    out.push(`${noJs}.ts`, `${noJs}.tsx`, `${noJs}.d.ts`, `${noJs}/index.ts`, `${noJs}/index.tsx`)
  }
  // 只有 spec 自带**已知扩展名**时才把字面路径列为候选。`./components/login-form` 这种
  //  无扩展名写法若先命中"同名目录",existsSync 会为真 ⇒ 把目录当模块读 ⇒ 内容 null ⇒
  //  该文件全部具名导入假红(ui-react 17 处即此因);目录必须只经 `目录/index.*` 解析。
  const last = rel.split('/').pop()
  if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(last)) out.push(rel)
  // 补扩展名的判据是"**不是已知扩展名**",不是"不含点":本仓有一批合法的中缀点文件名
  //  —— `Selecter.taro`(→ Selecter.taro.tsx)、`admin-tenants.types`、`redirects.config`、
  //  `desktop-feed.generated`。按"含点即有扩展名"处理会让这四类全部假报 D2(实测 12 处)。
  if (!/\.(ts|tsx|js|jsx|mjs|cjs|json|css|scss|less|svg|png|jpe?g|gif|webp|ico|woff2?|ttf|eot|mp3|mp4|md|html|txt)$/i.test(last))
    out.push(...EXT.map((e) => rel + e))
  out.push(...EXT.map((e) => `${rel}/index${e}`))
  return out
}

function resolveSpec(fromPath, rawSpec) {
  const spec = rawSpec.split('?')[0] // `./x.ts?raw`(Vite 原文导入)等查询后缀
  if (!spec) return []
  const base = resolve(ROOT, dirname(fromPath), spec).replace(/\\/g, '/')
  const rel = base.slice(ROOT.length + 1).replace(/\\/g, '/')
  if (rel.startsWith('..')) return null
  return resolveCands(rel)
}

// ── 解析:导入语句 ────────────────────────────────────────────────────────────────────
/** 只认**行首**的 import / `export { … } from` / `export * from` 语句:
 *  prettier 下真实导入恒在 0 列,而 JSDoc 示例、被注释掉的旧导入都在缩进或 `*`/`//` 之后。
 *  `export` 那一路额外要求紧跟 `{`/`*`/`type {` —— 否则 `export const k = 1` 这类普通导出行
 *  会顺着续行把后面的注释示例拼成一条"导入语句"(自检抓到过的真实假红形态)。 */
/** 数一行的花括号净深度,**先剥掉字符串字面量**(否则 `['"`]` 这类正则/字符串里的括号会算错) */
function braceDepth(line) {
  const s = line.replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/g, '""')
  return (s.match(/\{/g) || []).length - (s.match(/\}/g) || []).length
}

export function parseImports(text) {
  const out = []
  const lines = text.split('\n')
  let tickParity = 0 // 累计未闭合的反引号数:奇数 = 正处于模板字符串内部
  for (let i = 0; i < lines.length; i++) {
    const first = lines[i]
    const openTick = tickParity % 2 === 1
    tickParity += (first.match(/(?<!\\)`/g) || []).length
    if (openTick) continue // 生成器/夹具里拼出来的 import 文本不是真导入
    if (/^\s*(\/\/|\*|\/\*)/.test(first)) continue
    const isImport = /^import\b/.test(first)
    const isReexport = /^export\s+(?:type\s*)?[\{*]/.test(first)
    if (!isImport && !isReexport) continue
    let stmt = first
    let j = i
    // 续行判据是**括号闭合且读到 from**,不是"读到 from 为止"。
    //   首版只找 from,于是 `export { baseTest, baseExpect }`(本地转导出,无 from)会把
    //   紧随其后的 `export {\n …\n} from '../../../e2e/fixtures'` 拼成一条语句,再把
    //   从第一个 { 到最后一个 } 的整段当成"从那个模块导入"⇒ 把合法写法报成 D1 悬空。
    let depth = braceDepth(first)
    while (!(depth === 0 && /from\s*['"][^'"]+['"]\s*;?\s*$/.test(stmt))) {
      if (depth === 0) {
        stmt = '' // 括号已闭合却没有 from ⇒ 本条不是导入语句(纯本地导出)
        break
      }
      j++
      if (j - i > 30 || j >= lines.length || /^\s*(\/\/|\*|\/\*)/.test(lines[j])) {
        stmt = ''
        break
      }
      stmt += '\n' + lines[j]
      depth += braceDepth(lines[j])
    }
    if (!stmt) continue
    const fm = /from\s*['"]([^'"]+)['"]/.exec(stmt)
    if (!fm) continue
    const spec = fm[1]
    if (!spec.startsWith('./') && !spec.startsWith('../')) continue // 只判仓内相对路径
    const braces = /\{([\s\S]*)\}/.exec(stmt)
    const named = braces
      ? braces[1]
          .split(',')
          .map((s) => s.replace(/\/\*[\s\S]*?\*\//g, '').trim())
          .filter(Boolean)
          .map((s) => {
            const parts = s.split(/\s+as\s+/)
            const orig = parts[0].replace(/^type\s+/, '').trim()
            return { imported: orig, local: (parts[1] || parts[0]).trim() }
          })
          .filter((x) => /^[A-Za-z_$][\w$]*$/.test(x.imported))
      : []
    const def = /^import\s+([A-Za-z_$][\w$]*)\s*(?:,|$)/.exec(stmt.split('\n')[0])
    out.push({ line: i + 1, spec, named, defaultImport: !!def })
  }
  return out
}

// ── 解析:导出口径 ────────────────────────────────────────────────────────────────────
/** 名单清洗:块注释只在**名单内部**剥(导出/导入的花括号里不可能出现正则字面量,
 *  所以这里剥块注释是安全的;全局剥会吞掉正则字面量里的 `/*` 片段,已证会毁掉半文件)。
 *  不剥的话"注释紧跟一个名字"会让注释和名字粘成同一个条目 ⇒ 漏识别 ⇒ 假红
 *  (本仓 packages/app/src/types.ts 的 389 项名单里就夹了 12 条这种分组注释)。 */
function listNames(body) {
  return body
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split(',')
    .map((s) => s.replace(/^\s*type\s+/, '').trim())
    .filter((s) => /^[A-Za-z_$][\w$]*(?:\s+as\s+[A-Za-z_$][\w$]*)?$/.test(s))
    .map((s) => (s.includes(' as ') ? s.split(/\s+as\s+/)[1] : s))
}

export function parseExports(text) {
  const names = new Set()
  let opaque = false
  // **只剥行注释,不剥块注释**:本仓大量正则字面量里含 `/*`、`['"`]` 这类片段,
  //   `/\*[\s\S]*?\*/` 会从字面量中间一路吞到下一条 `*/`,把真实导出整段抹掉
  //   (首版把 40KB 的 _i18n-scan-helpers.mjs 剥成 18KB ⇒ 6 处假红)。
  //   代价是"被块注释掉的 export"会被当成已导出 —— 那是**漏报**方向,按本门"宁漏不误报"取。
  const src = text.replace(/^\s*\/\/.*$/gm, '')
  if (/export\s*\*\s*(?:as\s+[A-Za-z_$][\w$]*)?\s*from/.test(src)) opaque = true
  if (/export\s+default\b/.test(src)) names.add('default')
  for (const m of src.matchAll(
    /export\s+(?:declare\s+)?(?:async\s+)?(?:abstract\s+)?(function\*?|class|const|let|var|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g,
  ))
    names.add(m[2])
  // 解构导出:`export const { useAuthStore, useThemeStore } = rnAuthStore`(mobile-rn 有 7 处
  //   消费者,首版把它看成"导出了一个名叫 `{` 的东西"⇒ 7 处假红)
  for (const m of src.matchAll(/export\s+(?:const|let|var)\s*[\{\[]([^}\]]*)[\}\]]\s*=/g)) {
    for (const id of listNames(m[1])) names.add(id)
  }
  // `export type { A, B }`(先 import 再集中转导出的写法在本仓很常见)与 `export { A, B }`
  for (const m of src.matchAll(/export\s+type\s*\{([^}]*)\}(?:\s*from\s*['"][^'"]*['"])?\s*;?/g))
    for (const n of listNames(m[1])) names.add(n)
  for (const m of src.matchAll(/export\s*\{([^}]*)\}(?:\s*from\s*['"][^'"]*['"])?\s*;?/g))
    for (const n of listNames(m[1])) names.add(n)
  return { names, opaque }
}

/** 一个文件的违规清单。
 *  readFile(path) → 文本 | null;**只对源码建批量读取通道**,资源/JSON 走 hasPath(全量跟踪
 *  路径集合)判存在性 —— 否则会把 `./logo.svg` 这类合法资源导入误判成"D2 解析不到"。 */
export function auditFile(relPath, readFile, hasPath) {
  const exists = hasPath || ((p) => readFile(p) !== null && readFile(p) !== undefined)
  const text = readFile(relPath)
  if (text === null || text === undefined) return []
  const bad = []
  for (const imp of parseImports(text)) {
    const cands = resolveSpec(relPath, imp.spec)
    let target = null
    for (const c of cands) {
      if (exists(c)) {
        target = c
        break
      }
    }
    if (!target) {
      bad.push({ line: imp.line, rule: 'D2', raw: imp.spec, hint: '相对导入解析不到任何文件(路径已改/文件已删/大小写不符)' })
      continue
    }
    if (NON_CODE_EXT.test(target)) continue // 资源模块:只核存在性,没有导出名单可对
    const { names, opaque } = parseExports(readFile(target) ?? '')
    if (opaque) continue
    for (const n of imp.named) {
      if (n.imported === 'default') {
        if (!names.has('default')) bad.push({ line: imp.line, rule: 'D1', raw: `default ← ${imp.spec}`, hint: '目标文件没有 export default' })
        continue
      }
      if (!names.has(n.imported))
        bad.push({ line: imp.line, rule: 'D1', raw: `${n.imported} ← ${imp.spec}`, hint: `目标文件未导出 ${n.imported};该符号在 HEAD 上根本不存在,Metro 不查类型 ⇒ 打包能过、渲染到它才崩` })
    }
    if (imp.defaultImport && !names.has('default'))
      bad.push({ line: imp.line, rule: 'D1', raw: `default ← ${imp.spec}`, hint: '默认导入但目标无 export default' })
  }
  return bad
}

/** 按文件聚合 */
export function auditTree(readFile, files, hasPath) {
  const byFile = new Map()
  for (const f of files) {
    const v = auditFile(f, readFile, hasPath)
    if (v.length) byFile.set(f, v)
  }
  return byFile
}

export function splitFresh(byFile, tolOf) {
  const fresh = []
  let tolerated = 0
  for (const [file, list] of byFile) {
    const tol = tolOf(file)
    if (list.length > tol) fresh.push({ file, list, tol })
    else tolerated += list.length
  }
  return { fresh, tolerated }
}

// ── CLI ───────────────────────────────────────────────────────────────────────────────
async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()
  const isStaged = argv.includes('--staged')
  const fi = argv.indexOf('--files')
  const FILES_MODE = fi >= 0 ? argv.slice(fi + 1).filter((a) => !a.startsWith('--')) : null
  if (process.env[SELF_SKIP] === '1') {
    console.log(`⏭️  已跳过(${SELF_SKIP}=1):悬空具名导入对账未执行`)
    return
  }

  const headFiles = trackedSourceFiles('HEAD')
  const mkRead = (rev, files) => {
    const map = catBatch(files.map((p) => `${rev}:${p}`))
    const cache = new Map()
    const missing = new Set()
    return (p) => {
      if (cache.has(p)) return cache.get(p)
      const key = `${rev}:${p}`
      if (!map.has(key) && !missing.has(key)) missing.add(key)
      const v = map.get(key)
      cache.set(p, v === undefined ? null : v)
      return cache.get(p)
    }
  }

  const readHead = mkRead('HEAD', headFiles)
  // 存在性面 = 跟踪路径 ∪ 磁盘路径。生成物(`*.generated.ts` / `*.config.*` 一类)按设计
  //   不入 git,只按跟踪集判会把它们全报成 D2 —— 本门管的是"标识符悬空",不是入库卫生。
  const trackedAll = new Set(treePaths('HEAD'))
  const hasPath = (p) => trackedAll.has(p) || existsSync(join(ROOT, p))
  const scanSet = FILES_MODE ? FILES_MODE.filter((p) => readHead(p) !== null) : headFiles
  const byHead = auditTree(readHead, scanSet, hasPath)
  const headCountOf = (p) => (byHead.get(p) || []).length

  let byPending
  let stagedCount = 0
  let contentMode = 'HEAD 内容'
  if (isStaged) {
    contentMode = '索引内容(锚点=该文件 HEAD 自身)'
    const staged = git(['diff', '--cached', '--name-only', '--diff-filter=ACMR'])
      .split('\n')
      .filter((p) => SRC_RE.test(p) && !SKIP_DIR.test(p) && !FIXTURE_ROOT.test(p))
    stagedCount = staged.length
    const readIdx = mkRead('', staged)
    byPending = auditTree((p) => (staged.includes(p) ? readIdx(p) : readHead(p)), staged, hasPath)
  } else if (FILES_MODE) {
    contentMode = `工作区内容(--files ${FILES_MODE.length} 个,仅供自验,不作结论)`
    const wread = (p) => {
      try {
        return readFileSync(join(ROOT, p), 'utf8')
      } catch {
        return null
      }
    }
    byPending = auditTree(wread, FILES_MODE, (p) => wread(p) !== null)
  } else {
    byPending = byHead
  }

  //  棘轮锚点**恒为该文件 HEAD 自身的违规数**(与守门 77 同取向)。全量审计时 pending 就是
  //  HEAD,新增必为 0 —— 若这里写 `() => 0`,存量会被整片报成"新增"(首跑误报 300+ 文件、
  //  并 exit 1),等于把一道防悬空的门变成"永远红"的门,而恒红的唯一结局是 --no-verify。
  const tolOf = headCountOf
  const { fresh, tolerated } = splitFresh(byPending, tolOf)
  const total = [...byPending.values()].reduce((s, v) => s + v.length, 0)
  console.log(`[dangling-imports] 内容口径:${contentMode}`)
  console.log(
    `[dangling-imports] 扫描 ${isStaged ? `${stagedCount} 个暂存源文件(锚点面 ${scanSet.length})` : `${scanSet.length} 文件`} | 悬空 ${total} 处(HEAD 存量容忍 ${tolerated} / 新增 ${fresh.length} 文件)`,
  )
  //  **全量审计零容忍**(2026-09-24 存量清零后钉死):HEAD 普查必须为 0。
  //    为什么不放在 `--staged`:那会因别人未入库的回归拦住无关提交(= 逼人绕过,连带废掉全部守门);
  //    全量模式只跑在 check:all / CI,正适合当"合并把已修好的悬空导入带回来"的哨兵。
  if (!isStaged && !FILES_MODE && total > 0) {
    console.log(`❌ 全量口径为零容忍:HEAD 上仍有 ${total} 处悬空具名导入(存量已于 2026-09-24 清零)`)
    for (const [f, list] of byPending) for (const v of list) console.log(`   ${f}:${v.line} [${v.rule}] ${v.raw}  → ${v.hint}`)
    console.log('   单独复现:node scripts/check-dangling-local-imports.mjs')
    console.log(`   紧急跳过:${SELF_SKIP}=1(仅对 check:all/CI 有意义,提交链走 --staged)`)
    process.exit(1)
  }
  if (!fresh.length) {
    console.log('✅ 无新增悬空具名导入' + (total ? `(存量 ${total} 处如实报数,见下)` : ''))
    for (const [f, list] of byPending) for (const v of list) console.log(`   · 存量 ${f}:${v.line} [${v.rule}] ${v.raw}`)
    return
  }
  console.log(`❌ 新增 ${fresh.length} 个文件存在解析不到的具名导入:`)
  for (const { file, list, tol } of fresh) {
    console.log(`   ${file}(HEAD 自身 ${tol} 处 → 本次 ${list.length} 处)`)
    for (const v of list) console.log(`      :${v.line} [${v.rule}] ${v.raw}  → ${v.hint}`)
  }
  console.log(`   单独复现:node scripts/check-dangling-local-imports.mjs --files ${fresh.map((f) => f.file).join(' ')}`)
  console.log(`   紧急跳过:${SELF_SKIP}=1 git commit ...(会连同把悬空导入留在 main 上,勿滥用)`)
  process.exit(1)
}

// ── 自检:正反成对 ─────────────────────────────────────────────────────────────────────
function selfTest() {
  const cases = [
    { name: 'D1 导入不存在的导出必拦', files: { 'a/i.tsx': "import { Ghost } from './b'\n<Ghost />", 'a/b.tsx': 'export function Real() { return null }' }, red: 1 },
    { name: 'D1 导出确实存在必须放行(与上条成对)', files: { 'a/i.tsx': "import { Real } from './b'\n<Real />", 'a/b.tsx': 'export function Real() { return null }' }, red: 0 },
    { name: 'D1 多行 import 里的悬空项要看得见', files: { 'a/i.ts': "import {\n  Real,\n  Ghost,\n} from './b'\nexport const x = [Real, Ghost]", 'a/b.ts': 'export const Real = 1' }, red: 1 },
    { name: 'D1 export { A as B } 的对外名是 B', files: { 'a/i.ts': "import { B } from './b'\nexport const x = B", 'a/b.ts': 'const A = 1\nexport { A as B }' }, red: 0 },
    { name: 'D1 export { B as C } 时导入 B 不算合规', files: { 'a/i.ts': "import { B } from './b'\nexport const x = B", 'a/b.ts': 'const B = 1\nexport { B as C }' }, red: 1 },
    { name: 'D2 路径解析不到必拦', files: { 'a/i.ts': "import { x } from './nope'" }, red: 1 },
    { name: '缩进/注释里的示例 import 一律不判(防假红第一道)', files: { 'a/i.ts': 'export const k = 1\n//   import { Ghost } from \'./b\'\n/** import { Ghost2 } from \'./b\' */' }, red: 0 },
    { name: 'export * 的目标不可枚举,必须放过', files: { 'a/i.ts': "import { Anything } from './b'", 'a/b.ts': "export * from './c'", 'a/c.ts': 'export const Anything = 1' }, red: 0 },
    { name: '非相对路径(@/、包名)不参与判定', files: { 'a/i.ts': "import { Ghost } from '@/components/ghost'\nimport { View } from 'react-native'" }, red: 0 },
    { name: 'type 导入同样要真存在(TS2305 也是编译期事故)', files: { 'a/i.ts': "import type { Ghost } from './b'\nexport const x: Ghost = 1", 'a/b.ts': 'export type Real = 1' }, red: 1 },
    { name: 'side-effect 导入无具名项', files: { 'a/i.ts': "import './b'", 'a/b.ts': 'export const Real = 1' }, red: 0 },
    { name: "TS 风格 './b.js' 指向 b.ts 必须解析得到(首版误判上百处 D2)", files: { 'a/i.ts': "import { Real } from './b.js'", 'a/b.ts': 'export const Real = 1' }, red: 0 },
    { name: '资源导入只核存在性,不核导出名单', files: { 'a/i.ts': "import logo from './logo.svg'\nexport const L = logo", 'a/logo.svg': '<svg />' }, red: 0 },
    { name: '资源路径真缺失仍要报 D2(与上条成对)', files: { 'a/i.ts': "import logo from './gone.svg'" }, red: 1 },
    { name: 'export type { A } 转导出也算导出', files: { 'a/i.ts': "import { A } from './b'\nexport const x: A = 1", 'a/b.ts': "import type { A } from './c'\nexport type { A }", 'a/c.ts': 'export type A = number' }, red: 0 },
    { name: '解构导出 export const { X } = factory 必须算导出(7 处假红的成因)', files: { 'a/i.ts': "import { useAuthStore } from './store'", 'a/store.ts': 'const factory = {}\nexport const { useAuthStore } = factory' }, red: 0 },
    { name: '模板字符串里拼出来的 import 不判(生成器夹具)', files: { 'a/gen.mjs': 'export const SRC = 1', 'a/g.mjs': "const tpl = `\nimport { Ghost } from './nope'\n`\nexport const t = tpl" }, red: 0 },
    {
      name: '本地转导出 export { X } 不得把下一条 export-from 拼进来(web e2e fixtures 假红的成因)',
      files: {
        'a/i.ts': "import { test as baseTest } from '@playwright/test'\nexport { baseTest }\nexport {\n  A,\n} from './b'",
        'a/b.ts': 'export const A = 1',
      },
      red: 0,
    },
    {
      name: '导出名单里夹块注释(本仓 types.ts 满屏都是)不得吃掉注释后那个名字',
      files: {
        'a/b/i.ts': "import { LiveStatus } from '../../types'",
        'types.ts': "export type {\n  TFunction,\n  /** 批次 12:直播列表 */\n  LiveStatus,\n} from '@ihui/types'",
      },
      red: 0,
    },
  ]
  let fail = 0
  for (const c of cases) {
    const read = (p) => (p in c.files ? c.files[p] : null)
    const has = (p) => p in c.files
    const n = Object.keys(c.files).reduce((s, p) => s + auditFile(p, read, has).length, 0)
    const ok = n === c.red
    if (!ok) fail++
    console.log(`${ok ? '✅' : '❌'} ${c.name} (${n} 处,期望 ${c.red})`)
  }
  // 真仓对照:HEAD 上这一类的真实存量必须是**已知且有限**的,判据不得凭空放大
  const real = trackedSourceFiles('HEAD')
  const trackedAll = new Set(treePaths('HEAD'))
  const readHead = catBatch(real.map((p) => `HEAD:${p}`))
  const cache = new Map()
  const read = (p) => {
    if (cache.has(p)) return cache.get(p)
    const v = readHead.get(`HEAD:${p}`) ?? null
    cache.set(p, v)
    return v
  }
  const found = auditTree(read, real, (p) => trackedAll.has(p) || existsSync(join(ROOT, p)))
  const total = [...found.values()].reduce((s, v) => s + v.length, 0)
  console.log(`\n📎 真仓 HEAD 实测:${real.length} 个跟踪源文件,悬空 ${total} 处`)
  for (const [f, list] of found) for (const v of list) console.log(`   ${f}:${v.line} [${v.rule}] ${v.raw}`)
  if (total > 0) {
    console.log(`❌ 存量已清零后本门零容忍 —— HEAD 上仍有 ${total} 处,说明有回归(多半是合并把已修好的导出又吞了)`)
    process.exit(1)
  }
  if (fail) {
    console.log(`❌ ${fail} 例失败`)
    process.exit(1)
  }
  console.log(`\n全部 ${cases.length + 1} 例通过(含真仓 HEAD 实测)`)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
