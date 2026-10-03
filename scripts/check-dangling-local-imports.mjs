#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门:HEAD 悬空具名导入对账(D 判据)
 *
 * 拦的是同一类事故的两个方向 —— "编译期才看得见、而编译只跑工作区":
 *   ① 用了标识符却没 import(守门 77 B6 管档位出口那一种);
 *   ② import 了一个**目标文件根本不导出**的名字(本门 D1)。
 * 2026-09-24 一天内两类各中一次:前者让真机 release 包启动即崩(ReferenceError: rnRadius),
 * 后者让 main 顶端一处导入从合入起就没定义过(PermissionTierRow,`git log --all -S` 全空),
 * Metro 不做类型检查 ⇒ 打包成功、装机能跑、渲染到那一行才炸;而 `pnpm typecheck` 只看
 * 共享工作区,工作区里那个文件恰好是**更旧的基线**,两边都不红。
 *
 * D4「影子 .js」(2026-09-29 补,起因是一次约 2.5 小时的生产 API 崩溃循环):
 *   本仓的 ESM 约定是「源文件写 `.ts`,说明符写 `.js`」(`import { x } from '../services/foo.js'`
 *   指的就是 `foo.ts`)。一旦**同名且已入库**的 `foo.js` 出现在它旁边,字面路径就赢了那次
 *   解析:`.ts` 被整份遮蔽,而 `.js` 里的 TS 语法(`new Map<string, number>`)被当 JavaScript
 *   解析 ⇒ 启动即 SyntaxError。报错原文只说 "does not provide an export named …",
 *   它把排查方向**主动指错**(去查导出,而真凶是另一个文件),所以这一型既不自愈也极难归因。
 *   两条判红(现库内 0 处 ⇒ 零容忍,与 D1/D2 同一条已清零的存量口径):
 *     · 主判据:入库的 `X.js` 被**至少一条**写成 `./…/X.js` 的说明符字面命中,且同 stem 的
 *       `X.ts`/`X.tsx` 也在库 —— 这一对就是陷阱本身:人读到的是"那个 .ts",运行时拿到的是"那个 .js";
 *     · 次判据:被这样命中的 `X.js` **自身含 TS 专有语法**。走这条约定的 `.js` 十有八九是
 *       "穿了马甲的 TS",而它根本加载不了。探针刻意**窄**并成对(见 TS_SYNTAX_PROBES 上方说明):
 *       假阳的代价不是"多一次误报",是此后每一次提交都被逼 `--no-verify`、连带废掉链上其余门。
 *   只报数、不判红:同名的 `.js`+`.ts` 对而**没人**经 `.js` 说明符指向它 —— 那是死重量而不是陷阱,
 *   判红等于惩罚尚未被踩的坑;静默不报又会让"影子"这一形状在账面上消失,所以逐条报名(`--all`)。
 *   取材口径与前三维一致:入库面用**同一轮的跟踪路径集**(不是 `hasPath` 那个"跟踪 ∪ 磁盘"的并集)
 *   —— 本仓 src 下常年有**未入库**的编译残留 `X.js`,拿磁盘并集判会把别人机器上的产物
 *   记成本仓债务(那正是"滞后的旧草稿被记成债务"那一型)。
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
 *   node scripts/check-dangling-local-imports.mjs --all          # 额外逐条列出 D4 的"只报数"同名对
 *   node scripts/check-dangling-local-imports.mjs --rev <提交/树> [--anchor <提交>]
 *     # 审任意面(对象空间落地的涉事判据出口,G-815985):锚点缺省=被审提交的首个父提交;
 *     # 树对象没有父提交,不给 --anchor 即无法判定(exit 2)。`SELF_SKIP` 在这一档不吃。
 *   node scripts/check-dangling-local-imports.mjs --self-test     # 逻辑自检(正反成对)
 * 紧急跳过:HUSKY_SKIP_DANGLING_IMPORTS=1 git commit ...
 */
import { existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
// git 派生与 `cat-file --batch` 取材一律走共用层 scripts/lib/face-reader.mjs(绝对路径 git、
// safe.directory、显式 stdio、批量读)。本门不再自带那份 `git()` / `catBatch()` —— 五处易错点
// (裸 'git'、stdio[0]='ignore'、逐文件派生、junction 下的仓库根比较、maxBuffer)只该存在一处。
import { catBatch, gitRaw } from './lib/face-reader.mjs'
// D4 的 TS 语法探针必须看**代码面**(注释与字符串整段清空):否则一份把这一型**解释**成散文的
// 注释(`// 别写成 interface Foo {`)就会被判成"这文件是穿了马甲的 TS"。本仓被这类"门读自己的
// 解释文字"咬过多次(守门 70/131/135),而遮噪器只许有一台 —— 用 lib/code-mask 那份等长实现,
// 行号不漂(D4 要报出命中行)。
import { maskCommentsStringsAndRegex } from './lib/code-mask.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const SELF_SKIP = 'HUSKY_SKIP_DANGLING_IMPORTS'
const EXT = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']
/** 带 `?raw` / `?url` 后缀的导入(Vite/测试里读源码文本):查询串在 resolveSpec 里剥掉,
 *  剩下的路径仍须存在 —— 首版把 6 处 `?raw` 全误判成 D2。 */
const SRC_RE = /\.(ts|tsx|js|jsx|mjs|cjs)$/
const SKIP_DIR = /(^|\/)(node_modules|dist|\.next|\.expo|build|android|ios|coverage)\//
/** 夹具树:里面的源码是**故意写坏**的样例(benchmark 任务),不参与任何真实对账 */
const FIXTURE_ROOT = /^(benchmarks|testdata|fixtures)\//
const GIT_TIMEOUT = 120000

// ── 内容取材:HEAD blob / 索引 blob / 工作区,三种口径共用一条批量读取通道 ──────────────
/** 层的 catBatch 把 maxBuffer 钉死在 64MB(lib/face-reader.mjs 的 GIT_MAX_BUFFER),而本门全量一次
 *  要读**全部**跟踪源文件(HEAD 内容实测约 85MB)⇒ 单次 batch 必然 ENOBUFS,且它会被层折成"取不到
 *  内容"而不是"缓冲不够"。层当前**没有**给 catBatch 开 maxBuffer / 分片预算的口子(已在交付报告
 *  登记为缺失原语),故这里按 blob 体积分片喂**同一个** catBatch —— 仍是"一次读一批",不是逐文件派生。
 *  体积来自一次 `ls-tree -r -l -z HEAD`(NUL 分帧,中文/空格路径不被打断);索引面取不到体积,
 *  而那一面只喂"本次暂存的少数文件",单片远不到预算。 */
const CAT_BUDGET = 40 << 20

function headBlobSizes() {
  const sizes = new Map()
  for (const row of gitRaw(['ls-tree', '-r', '-l', '--full-name', '-z', 'HEAD'], ROOT, {
    timeout: GIT_TIMEOUT,
  }).split('\0')) {
    if (!row) continue
    const tab = row.indexOf('\t')
    if (tab < 0) continue
    const size = Number(row.slice(0, tab).split(/\s+/)[3])
    if (Number.isFinite(size)) sizes.set(row.slice(tab + 1), size)
  }
  return sizes
}

/** 一次(或按预算的几次)`cat-file --batch` 读完一批 rev → Map<"<rev>:<path>", text|null> */
function catBatchBudgeted(revs, sizes) {
  const out = new Map()
  let part = []
  let used = 0
  const flush = () => {
    if (!part.length) return
    for (const [rev, text] of catBatch(ROOT, part)) out.set(rev, text)
    part = []
    used = 0
  }
  for (const rev of revs) {
    const size = (sizes && sizes.get(rev.slice(rev.indexOf(':') + 1))) || 0
    if (part.length && used + size > CAT_BUDGET) flush()
    part.push(rev)
    used += size
  }
  flush()
  return out
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
    ? gitRaw(['ls-files', '-z'], ROOT, { timeout: GIT_TIMEOUT }).split('\0').filter(Boolean)
    : gitRaw(['ls-tree', '-r', '--name-only', rev, '-z'], ROOT, { timeout: GIT_TIMEOUT })
        .split('\0')
        .filter(Boolean)
}

// ── 任意提交/树的取材(G-815985 `--rev`):对象空间落地在 commit-tree 之前 ─────────────
// 对 onTree 那棵树跑涉事判据。树没有引用,不能"造一枚提交去审" —— 造了再拒会给守门 30a
// 留 unreachable 地雷(判据注释见 object-space-land.mjs 的 onTree),故这里按 blob 取正文:
// `ls-tree -r -l` 一次拿 <path → blob,size>,再按 blob oid 批量取(`<tree>:<path>` 不解析)。
function revKindOf(rev) {
  try {
    const t = gitRaw(['cat-file', '-t', rev], ROOT, { timeout: GIT_TIMEOUT }).trim()
    return t === 'commit' || t === 'tree' ? t : null
  } catch {
    return null
  }
}

/** 某提交/树的 <path → {blob,size}>(一次 `ls-tree -r -l`)。commit 与 tree 通吃。 */
export function treeBlobTable(rev) {
  const table = new Map()
  for (const row of gitRaw(['ls-tree', '-r', '-l', '--full-name', '-z', rev], ROOT, {
    timeout: GIT_TIMEOUT,
  }).split('\0')) {
    if (!row) continue
    const tab = row.indexOf('\t')
    if (tab < 0) continue
    const meta = row.slice(0, tab).split(/\s+/)
    const size = Number(meta[3])
    table.set(row.slice(tab + 1), {
      blob: meta[2] ?? '',
      size: Number.isFinite(size) ? size : 0,
    })
  }
  return table
}

/** 单一面的完整审计(被审面 + 棘轮锚点面共用):rev 提交/树 → {files, byFile, aliasUnparsed, shadow}。
 *  存在性面只取被审树自身(不看磁盘:磁盘是另一个面,主流程那条"索引 vs HEAD"教训见 treePaths 头注)。
 *  别名表按同面取(tsconfig 不在源文件枚举里,须另开一批 —— 主流程同位置有同一条注释,两处同形)。 */
export function auditOneFace(rev) {
  const table = treeBlobTable(rev)
  const files = [...table.keys()].filter(
    (p) => SRC_RE.test(p) && !SKIP_DIR.test(p) && !FIXTURE_ROOT.test(p),
  )
  const tsPaths = [...table.keys()].filter((p) => TSCONFIG_RE.test(p) && !SKIP_DIR.test(p))
  let read
  if (revKindOf(rev) === 'tree') {
    const oids = [...table.values()].map((v) => v.blob).filter(Boolean)
    const got = oids.length ? catBatch(ROOT, oids) : new Map()
    const cache = new Map()
    read = (p) => {
      if (cache.has(p)) return cache.get(p)
      const cell = table.get(p)
      const v = cell ? (got.get(cell.blob) ?? null) : null
      cache.set(p, v)
      return v
    }
  } else {
    const want = [...new Set([...files, ...tsPaths])]
    const sizes = new Map([...table.entries()].map(([p, v]) => [`${rev}:${p}`, v.size]))
    const map = catBatchBudgeted(
      want.map((p) => `${rev}:${p}`),
      sizes,
    )
    const cache = new Map()
    read = (p) => {
      if (cache.has(p)) return cache.get(p)
      const v = map.get(`${rev}:${p}`)
      cache.set(p, v === undefined ? null : v)
      return cache.get(p)
    }
  }
  const tracked = new Set(table.keys())
  const hasPath = (p) => tracked.has(p)
  const alias = buildAliasIndex((p) => read(p) ?? null, tsPaths)
  const jsSites = []
  const byFile = auditTree(read, files, hasPath, alias.index, jsSites)
  const shadow = auditShadowJs(read, jsSites, new Set(files))
  mergeShadow(byFile, shadow)
  return { files, byFile, aliasUnparsed: alias.unparsed, aliasSeen: alias.seen, shadow }
}

const NON_CODE_EXT =
  /\.(css|scss|less|svg|png|jpe?g|gif|webp|ico|woff2?|ttf|eot|mp3|mp4|md|html|txt|glb|hdr|json|map)$/i

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
  if (
    !/\.(ts|tsx|js|jsx|mjs|cjs|json|css|scss|less|svg|png|jpe?g|gif|webp|ico|woff2?|ttf|eot|mp3|mp4|md|html|txt)$/i.test(
      last,
    )
  )
    out.push(...EXT.map((e) => rel + e))
  out.push(...EXT.map((e) => `${rel}/index${e}`))
  return out
}

/** 说明符的**字面**目标(仓库内相对路径,不猜扩展名);空说明符 / 跑出仓库外 ⇒ null。
 *  与 resolveCands 的分工:那一条问"TS 会把它解析成谁",这一条问"按字面写在盘上的是谁"。
 *  D4 要的是后者 —— 运行时(Node ESM / Metro / 打包器)命中字面 `./x.js` 时,`.ts` 根本没机会。
 *  它同时是 resolveSpec 的前半段(两处各写一遍必在查询串剥除、`..` 越界判定上漂开)。 */
export function literalSpecTarget(fromPath, rawSpec) {
  const spec = rawSpec.split('?')[0] // `./x.ts?raw`(Vite 原文导入)等查询后缀
  if (!spec) return null
  const base = resolve(ROOT, dirname(fromPath), spec).replace(/\\/g, '/')
  const rel = base.slice(ROOT.length + 1).replace(/\\/g, '/')
  if (rel.startsWith('..')) return null
  return rel
}

function resolveSpec(fromPath, rawSpec) {
  const rel = literalSpecTarget(fromPath, rawSpec)
  return rel === null ? [] : resolveCands(rel)
}

// ── 解析:导入语句 ────────────────────────────────────────────────────────────────────
/** 只认**行首**的 import / `export { … } from` / `export * from` 语句:
 *  prettier 下真实导入恒在 0 列,而 JSDoc 示例、被注释掉的旧导入都在缩进或 `*`/`//` 之后。
 *  `export` 那一路额外要求紧跟 `{`/`*`/`type {` —— 否则 `export const k = 1` 这类普通导出行
 *  会顺着续行把后面的注释示例拼成一条"导入语句"(自检抓到过的真实假红形态)。 */
/** 数一行的花括号净深度,**先剥掉字符串字面量**(否则 `['"`]` 这类正则/字符串里的括号会算错) */
/** 剥单/双引号字符串 —— **一份实现两处用**(braceDepth 的括号净深度、parseImports 的模板奇偶),
 *  各写一份必漂移;本仓写过多次"两处算同一件事必须共用一份实现"。 */
const QUOTE_SPAN_RE = /'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g

function braceDepth(line) {
  const s = line.replace(QUOTE_SPAN_RE, '""').replace(/`(?:\\.|[^`\\])*`/g, '""')
  return (s.match(/\{/g) || []).length - (s.match(/\}/g) || []).length
}

/**
 * 逐行标出"处于模板字符串内部"的行 —— 用来认出夹具/生成器里拼出来的 import。
 *
 * 为什么不是"数反引号奇偶":实测两处都会把奇偶拨错,而拨错的后果是**假红**(把别人的
 * --self-test 夹具当真导入判悬空):
 *   ① 反引号写在引号串里 —— `if (c === '"' || c === "'" || c === '`')`(门 119 有 5 行)
 *   ② 反引号写在正则字面量里 —— `/^(?:'|"|`)(light|dark)(?:'|"|`)$/`(门 91:403 一行,
 *      直接把后面 500 多行的奇偶整体反档,G-177 暴露的那处"悬空导入"就是这么来的)
 * 所以这里做一次带状态的词法走查:字符串 / 模板 / 行注释 / 块注释 / 正则字面量各自进出。
 * 认不出来的形态一律按"不在模板内"处理 —— 宁可多判一条(逼人复看),绝不静默放过。
 */
export function templateInteriorLines(text) {
  const inside = []
  let inTpl = false
  let inLine = null
  let inBlock = false
  let inRegex = false
  let prevSig = ''
  const lines = String(text ?? '').split('\n')
  const REGEX_OK = new Set(['=', '(', ',', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>'])
  for (let i = 0; i < lines.length; i++) {
    inside.push(inTpl)
    const line = lines[i]
    inLine = null // 行注释只在本行内有效
    for (let j = 0; j < line.length; j++) {
      const c = line[j]
      if (inBlock) {
        if (c === '*' && line[j + 1] === '/') {
          inBlock = false
          j++
        }
        continue
      }
      if (inLine) continue
      if (inRegex) {
        if (c === '\\') j++
        else if (c === '[') {
          while (j < line.length && line[j] !== ']' && line[j] !== '\\') j++
        } else if (c === '/' && line[j - 1] !== '\\') inRegex = false
        continue
      }
      if (inTpl) {
        if (c === '\\') j++
        else if (c === '`') inTpl = false
        continue
      }
      if (c === '/' && line[j + 1] === '/') {
        inLine = true
        break
      }
      if (c === '/' && line[j + 1] === '*') {
        inBlock = true
        j++
        continue
      }
      if (c === "'" || c === '"') {
        const q = c
        j++
        while (j < line.length && line[j] !== q) {
          if (line[j] === '\\') j++
          j++
        }
        prevSig = q
        continue
      }
      if (c === '`') {
        inTpl = true
        prevSig = c
        continue
      }
      if (c === '/' && (prevSig === '' || REGEX_OK.has(prevSig))) {
        inRegex = true
        continue
      }
      if (!/\s/.test(c)) prevSig = c
    }
  }
  return inside
}

export function parseImports(text) {
  const out = []
  const lines = text.split('\n')
  const inTemplate = templateInteriorLines(text)
  for (let i = 0; i < lines.length; i++) {
    const first = lines[i]
    if (inTemplate[i]) continue // 生成器/夹具里拼出来的 import 文本不是真导入
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
    // 相对路径恒发;别名(`@/…`)也发 —— 由 auditFile 决定它是否落在某份 tsconfig paths 的射程里。
    // 旧写法在这里就把非相对 spec 全部丢掉 ⇒ 别名指向不存在的模块**结构上不可能被发现**
    // (2026-09-25 生产构建被这一格卡住:HEAD 里 import 了一个从未写过的 store,154 道门全绿)。
    if (!spec.startsWith('./') && !spec.startsWith('../') && !spec.includes('/')) continue
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

/** tsconfig 的 `compilerOptions.paths` ⇒ 前缀映射表。
 *  只认**尾随 `*` 的键与值**(`"@/*": ["./src/*"]`),精确键(`"@plugins-data"`)不参与 ——
 *  那一型要的是"别名→具体文件"的完整 resolver,不在本判据射程。
 *  解析失败 ⇒ 返回 null,调用方计入"判不出",绝不猜成"没有别名"。 */
export function aliasEntries(tsRel, tsText) {
  if (typeof tsText !== 'string') return null
  let parsed
  try {
    parsed = JSON.parse(stripJsonc(tsText))
  } catch {
    return null
  }
  return aliasFromParsed(tsRel, parsed)
}

/**
 * 剥 jsonc 注释与尾随逗号 —— **必须是字符级扫描,不能是正则**。
 * 第一版用"斜杠星 … 星斜杠"的正则剥块注释,而 tsconfig 里必然有 include 列表,里面是
 * 双星号 + 斜杠 + 星号 + `.ts` 这种 glob:那串里就同时含着这两个两字符序列 ——
 * 于是**整段 JSON 被当作注释吃掉**,解析失败 ⇒ 别名表为空 ⇒ D3 变成一条
 * "永远不报"的判据,而输出照写"悬空 0 处"。这一型缺陷的共同点是:失效与合规长得一模一样。
 * (本注释刻意不把那两个序列原样写出来 —— 它会把这个块注释提前关掉,`node --check` 当场炸,
 *  而那正是本函数要修的那个 bug 的自画像。第一次提交就炸在这里,别指望下一次。)
 */
function stripJsonc(text) {
  let out = ''
  let i = 0
  let inStr = false
  let quote = ''
  while (i < text.length) {
    const c = text[i]
    if (inStr) {
      out += c
      if (c === '\\' && i + 1 < text.length) {
        out += text[i + 1]
        i += 2
        continue
      }
      if (c === quote) inStr = false
      i++
      continue
    }
    if (c === '"' || c === "'") {
      inStr = true
      quote = c
      out += c
      i++
      continue
    }
    if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++
      continue
    }
    if (c === '/' && text[i + 1] === '*') {
      i += 2
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++
      i += 2
      continue
    }
    out += c
    i++
  }
  return out.replace(/,(\s*[}\]])/g, '$1')
}

/** 从已解析的 tsconfig 对象里取出前缀映射(与 stripJsonc 分成两个函数,便于单测各自成立)。 */
function aliasFromParsed(tsRel, parsed) {
  const paths = parsed && parsed.compilerOptions && parsed.compilerOptions.paths
  if (!paths || typeof paths !== 'object') return []
  const base = tsRel.includes('/') ? tsRel.slice(0, tsRel.lastIndexOf('/')) : ''
  const out = []
  for (const [key, vals] of Object.entries(paths)) {
    if (!key.endsWith('*') || !Array.isArray(vals) || typeof vals[0] !== 'string') continue
    if (!vals[0].endsWith('*')) continue
    const dir = join(base, vals[0].slice(0, -1)).replace(/\\/g, '/').replace(/\/+$/, '')
    if (!dir || dir === '.' || dir.startsWith('..')) continue // 跑出仓库外的映射:判不了,不猜
    out.push({ prefix: key.slice(0, -1), dir })
  }
  return out
}

/** 一个文件应当用哪一份别名表:取**目录最深**的那份 tsconfig(端内 tsconfig 覆盖根 tsconfig)。 */
function aliasesFor(relPath, aliasIndex) {
  let best = null
  let bestDepth = -1
  for (const [dir, entries] of aliasIndex) {
    if (relPath.startsWith(`${dir}/`) && dir.split('/').length > bestDepth) {
      best = entries
      bestDepth = dir.split('/').length
    }
  }
  return best
}

/** 别名 spec ⇒ 仓库内相对路径(未判存在性)。不匹配任何前缀 ⇒ null(= 本判据不参与)。 */
export function resolveAliasSpec(relPath, rawSpec, aliasIndex) {
  const spec = rawSpec.split('?')[0]
  if (!spec || spec.startsWith('./') || spec.startsWith('../') || spec.startsWith('/')) return null
  const entries = aliasesFor(relPath, aliasIndex)
  if (!entries || !entries.length) return null
  const hit = entries
    .filter((e) => spec.startsWith(e.prefix) && e.prefix.length > 0)
    .sort((a, b) => b.prefix.length - a.prefix.length)[0]
  if (!hit) return null
  const rest = spec.slice(hit.prefix.length)
  if (!rest || rest.startsWith('/')) return null // `@/` 裸写法与尾斜杠形态:交给人工,不猜文件名
  return `${hit.dir}/${rest}`
}

/** 一个文件的违规清单。
 *  readFile(path) → 文本 | null;**只对源码建批量读取通道**,资源/JSON 走 hasPath(全量跟踪
 *  路径集合)判存在性 —— 否则会把 `./logo.svg` 这类合法资源导入误判成"D2 解析不到"。
 *  `aliasIndex`(Map<pkgDir, entries[]>)为 null/空 ⇒ 别名导入一律不参与(与旧行为逐字相同)。
 *  `jsSink`(可选)非空时顺手递出本文件的 `.js` 字面说明符落点,供 D4 在同一次解析里配对使用 ——
 *  刻意不另开一遍全树解析(两遍解析必给两个"谁 import 了谁"的口径,而 D1/D4 判的是同一批语句)。 */
export function auditFile(relPath, readFile, hasPath, aliasIndex, jsSink) {
  const exists = hasPath || ((p) => readFile(p) !== null && readFile(p) !== undefined)
  const text = readFile(relPath)
  if (text === null || text === undefined) return []
  const bad = []
  for (const imp of parseImports(text)) {
    const isRel = imp.spec.startsWith('./') || imp.spec.startsWith('../')
    const aliasRel =
      !isRel && aliasIndex && aliasIndex.size ? resolveAliasSpec(relPath, imp.spec, aliasIndex) : null
    /**
     * 只有"仓内相对路径"与"某份 tsconfig paths 真能接住的别名"进判据。
     * 裸包名 / `node:` 内建 / 未映射的 `@scoped/…` 一律放过 —— 第一版我把所有含 `/` 的
     * spec 都放进来,结果 `node:assert/strict` 被当成相对路径解析,一次跑出数百处假红:
     * **判据扩大射程时,必须同时给出"这一格不判"的出口**,否则新射程就是新的恒红源。
     */
    if (!isRel && !aliasRel) continue
    if (jsSink) {
      // D4 的取材点是**字面**路径,不是 resolveCands 的结果 —— 后者已经替读者把 `./x.js` 改写成了
      // `x.ts`,而本判据要问的恰恰是"运行时按字面命中了谁"。
      const lit = isRel ? literalSpecTarget(relPath, imp.spec) : aliasRel
      if (lit && JS_SPEC_RE.test(lit))
        jsSink.push({ target: lit, by: relPath, line: imp.line, spec: imp.spec })
    }
    const cands = aliasRel
      ? resolveCands(aliasRel)
      : (() => {
          const r = resolveSpec(relPath, imp.spec)
          return r === null ? [] : r
        })()
    let target = null
    for (const c of cands) {
      if (exists(c)) {
        target = c
        break
      }
    }
    if (!target) {
      const viaAlias = !!aliasRel
      bad.push({
        line: imp.line,
        rule: viaAlias ? 'D3' : 'D2',
        raw: imp.spec,
        hint: viaAlias
          ? `别名导入解析不到任何文件(tsconfig paths 指向 ${aliasRel}.* 不存在)—— 模块被引用但从未写下`
          : '相对导入解析不到任何文件(路径已改/文件已删/大小写不符)',
      })
      continue
    }
    if (NON_CODE_EXT.test(target)) continue // 资源模块:只核存在性,没有导出名单可对
    const { names, opaque } = parseExports(readFile(target) ?? '')
    if (opaque) continue
    for (const n of imp.named) {
      if (n.imported === 'default') {
        if (!names.has('default'))
          bad.push({
            line: imp.line,
            rule: 'D1',
            raw: `default ← ${imp.spec}`,
            hint: '目标文件没有 export default',
          })
        continue
      }
      if (!names.has(n.imported))
        bad.push({
          line: imp.line,
          rule: 'D1',
          raw: `${n.imported} ← ${imp.spec}`,
          hint: `目标文件未导出 ${n.imported};该符号在 HEAD 上根本不存在,Metro 不查类型 ⇒ 打包能过、渲染到它才崩`,
        })
    }
    if (imp.defaultImport && !names.has('default'))
      bad.push({
        line: imp.line,
        rule: 'D1',
        raw: `default ← ${imp.spec}`,
        hint: '默认导入但目标无 export default',
      })
  }
  return bad
}

// ── D4:影子 .js ────────────────────────────────────────────────────────────────────
/** 只有以 `.js` 结尾的说明符参与 D4 —— 那是本仓"写 `.js` 实指 `.ts`"这一约定的**唯一**形态。
 *  `.jsx`/`.mjs`/`.cjs` 不参与:Node 对它们是字面解析,不存在"读者以为是别的文件"这一歧义。 */
const JS_SPEC_RE = /\.js$/
/** 歧义同伴:TS 的 `./x.js` 会被解析器改写成 `x.ts` / `x.tsx` / `x.d.ts`,所以只有前两档构成
 *  遮蔽对。`.d.ts` **刻意不算**同伴 —— 那是已发布包 `x.js` + `x.d.ts` 的正常形态,不是陷阱;
 *  本仓就有现成的两处在证明这条边界有牙:`packages/design-tokens/src/radius.js` 与 `geometry.js`
 *  都是"JS 实现 + `.d.ts` 声明"的单源模块(被 TS 侧按 `.js` 说明符消费),把它们算成同伴
 *  就是把 2 处真合规判成红 —— 而假阳的代价从来不是"多一次误报",是各会话开始绕钩子。 */
const SHADOW_PARTNERS = ['.ts', '.tsx']

/** 模块说明符行(`import { A as B } from` / `export { A as B }`)—— 这些行里 `as` 是**合法的**
 *  JavaScript 重命名,而 `as const` / `as Foo<T>` 才是 TS 断言。探针族里除了 `import|export type`
 *  之外都不在这类行上跑,免得把"给邻居改个名"读成"这文件是穿了马甲的 TS"。
 *  用反向排除而不是正向匹配:`export interface Foo {` 以 `export` 开头却**不是**说明符行,
 *  把它当说明符行会让 interface 探针在最常见的写法上失明。 */
const MODULE_CLAUSE_LINE_RE =
  /^\s*(?:import|export)\b(?!\s+(?:default\s+)?(?:interface|enum|type|abstract|declare|const|let|var|function|class)\b)/

/** 每一条都必须"在合法 JavaScript 里不可能出现"。方向刻意是**漏报优于误报**:
 *  少一条探针只是这一型少一个入口(主判据的同名对还在那儿),多一条宽探针则会把
 *  `f(a, b)` 旁边的正常代码判红,而恒红门的唯一结局是各会话绕过钩子、连带废掉链上其余门。
 *  第 3 位 `moduleSafe` = 在 `import`/`export` 说明符行上仍要跑的那一条。 */
const TS_SYNTAX_PROBES = [
  ['import/export type', /(?<![\w$.])(?:import|export)\s+type\b/, true],
  ['interface 声明', /(?<![\w$.])interface\s+[A-Za-z_$][\w$]*\b/, false],
  ['enum 声明', /(?<![\w$.])enum\s+[A-Za-z_$][\w$]*\s*\{/, false],
  ['implements 子句', /(?<![\w$.])implements\s+[A-Za-z_$]/, false],
  ['satisfies 表达式', /(?<![\w$.])satisfies\s+[A-Za-z_$]/, false],
  ['变量类型标注', /(?<![\w$.])(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*:(?!:)/, false],
  ['形参类型标注', /\(\s*[A-Za-z_$][\w$]*\s*\??\s*:/, false],
  ['泛型实参(new X<…>)', /(?<![\w$.])new\s+[A-Za-z_$][\w$.]*\s*</, false],
  ['泛型形参约束(<T extends …>)', /<[A-Za-z_$][\w$]*\s+extends\s/, false],
  ['类型别名', /(?<![\w$.])type\s+[A-Za-z_$][\w$]*\s*(?:<[^<>\n]*>\s*)?=(?!=)/, false],
  ['as 断言', /(?<![\w$.])as\s+(?:const\b|unknown\b|never\b|readonly\s|[A-Z][\w$]*\s*<|\[)/, false],
]

/** 一段代码里的 TS 专有语法命中清单(逐行,`{line, marker}`)。
 *  输入是**遮噪后**的面,所以命中一定落在代码上;等长遮罩保证行号与原文件一致。
 *  刻意没有"返回类型标注"(`): Ret {`)那一条 —— `c ? (a) : b => {}` 是合法 JS 而会被它咬到,
 *  代价是把一份正常代码判红;带返回类型的函数在本仓必然同时带形参标注或泛型,不靠这一条也抓得到。 */
export function probeTypeScriptSyntax(text) {
  if (typeof text !== 'string') return []
  const face = maskCommentsStringsAndRegex(text)
  const out = []
  const lines = face.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const moduleClause = MODULE_CLAUSE_LINE_RE.test(line)
    for (const [marker, re, moduleSafe] of TS_SYNTAX_PROBES) {
      if (moduleClause && !moduleSafe) continue
      if (!re.test(line)) continue
      out.push({ line: i + 1, marker })
      break // 一行只记一条:命中清单是用来解释"凭什么判红"的,不是用来计数的
    }
  }
  return out
}

/** D4 的树级判据。`sites` 是 `auditFile` 在同一次遍历里递出来的 `.js` 字面说明符落点
 *  (`{target, by, line, spec}`),`trackedSrc` 是**同一取材面**上过滤过的跟踪源文件集。
 *  返回 `{ byShadow: Map<.js 路径, 违规[]>, deadPairs, undetermined, targeted }`。 */
export function auditShadowJs(readFile, sites, trackedSrc) {
  const byTarget = new Map()
  for (const s of sites || []) {
    // 只看**入库**的 .js:磁盘上的编译残留是别人机器上的产物,不是本仓债务(见头注口径条)
    if (!trackedSrc.has(s.target) || SKIP_DIR.test(s.target) || FIXTURE_ROOT.test(s.target)) continue
    if (!byTarget.has(s.target)) byTarget.set(s.target, [])
    byTarget.get(s.target).push(s)
  }
  const byShadow = new Map()
  const undetermined = []
  for (const [jsPath, hits] of byTarget) {
    const stem = jsPath.replace(/\.js$/, '')
    const partners = SHADOW_PARTNERS.filter((e) => trackedSrc.has(stem + e))
    const text = readFile(jsPath)
    const probe = typeof text === 'string' ? probeTypeScriptSyntax(text) : null
    if (probe === null && !partners.length) {
      // 内容取不到又没有同名同伴 ⇒ 两条判据都落空。这一格必须报名,不能被"没进 byShadow"洗成通过。
      undetermined.push({ file: jsPath, why: '被 .js 说明符字面命中,但内容在本面取不到 ⇒ TS 语法维未判' })
      continue
    }
    if (!partners.length && !probe.length) continue // 普通 JS 模块走这条路:合规,不判
    const where = hits.map((h) => `${h.by}:${h.line}`).join(', ')
    const why = []
    if (partners.length)
      why.push(`同 stem 的 ${partners.map((e) => stem + e).join(' / ')} 也在库 ⇒ .ts 被字面 .js 遮蔽`)
    if (probe.length) why.push(`自身含 TS 专有语法:${probe[0].marker}(第 ${probe[0].line} 行)`)
    if (probe === null) why.push('自身内容在本面取不到 ⇒ 只按同名对判')
    byShadow.set(jsPath, [
      {
        line: probe && probe.length ? probe[0].line : 1,
        rule: 'D4',
        raw: `${jsPath} ← ${hits.length} 处 '.js' 说明符`,
        hint:
          why.join(';') +
          ` —— 说明符按本仓约定指的是 .ts,而运行时按字面命中 .js(消费方:${where})` +
          ';修法:删掉/改名那个 .js(把内容留在 .ts 里),别去改说明符',
      },
    ])
  }
  // 只报数:同名对在库、却没人经 `.js` 说明符指向 —— 死重量而不是陷阱,判红就是惩罚尚未被踩的坑
  const deadPairs = []
  for (const p of trackedSrc) {
    if (!JS_SPEC_RE.test(p) || byTarget.has(p) || SKIP_DIR.test(p) || FIXTURE_ROOT.test(p)) continue
    const stem = p.replace(/\.js$/, '')
    if (SHADOW_PARTNERS.some((e) => trackedSrc.has(stem + e))) deadPairs.push(p)
  }
  deadPairs.sort()
  // "只报数"也必须报名(本仓的口径:计数可以不当判据,但不能替人做出"这一格没人看"的判断) ——
  //  targets 是"被 '.js' 说明符字面命中的入库 .js"全集,含合规的那些。
  const targets = [...byTarget.keys()].sort()
  /**
   * `scanned` = 这一维**真正看过**的 `.js` 说明符字面落点数(去重,在"是否入库"那道过滤**之前**)。
   *
   * 为什么必须与 `targeted` 分成两个数(票面 G-815915 反假绿①"扫到 0 个候选判死不记绿"的落点):
   * `targeted` 只数**入库**的 `.js`,而本仓 ESM 约定是"源文件写 `.ts`、说明符写 `.js` ⇒ 绝大多数
   * `.js` 落点指向的根本不是入库 `.js`,而是同 stem 的 `.ts`"。2026-10-03 现读 HEAD:落点 1768 个,
   * 其中指向入库 `.js` 的只有 8 个。**所以 `targeted === 0` 是本仓的常态而不是尺子失效** ——
   * 票面自己写下的"现读覆盖面为 0"说的正是这一格。把判死挂在 `targeted` 上,会把"扫过且干净"
   * 判成"没看",即在票面描述的那个状态下直接造成恒红门(§12e:唯一结局是人人跳钩子)。
   * 挂在 `scanned` 上才是票面要的那一格:**一个 `.js` 说明符落点都没扫到** ⇒ 采集通道本身断了
   * (解析器退化成不认 `.js`、或取材面取空),此时"判红候选 0 个"是空话,必须判死不记绿。
   */
  const scanned = new Set(
    (sites || [])
      .filter((s) => JS_SPEC_RE.test(s.target) && !SKIP_DIR.test(s.target) && !FIXTURE_ROOT.test(s.target))
      .map((s) => s.target),
  ).size
  return { byShadow, deadPairs, undetermined, targets, targeted: byTarget.size, scanned }
}

/**
 * D4 的采集通道是否**失明**:扫到 0 个 `.js` 说明符字面落点 ⇒ 这一维没看过任何东西,
 * 此时报告里那句"判红候选 0 个"不成立(与"扫过且干净"逐字同形 —— 本门头注与别名表那段
 * 记的就是这一型:判据失效的样子和"没有问题"完全一样)。故这一格必须判死不记绿。
 *
 * 方向刻意是**只认采集口径、不认 `targeted`**:见 auditShadowJs 里 `scanned` 那段注释 ——
 * `targeted === 0` 在本仓是常态(1768 个落点里 8 个指向入库 `.js`),拿它判死就是恒红门。
 * 单独抽成导出函数,是为了让 CLI 与镜像测试共用**同一份**判据(§22c:两处各写一遍必漂移)。
 */
export function d4ChannelBlind(shadow) {
  return !shadow || !(Number(shadow.scanned) > 0)
}

/** 把 D4 的按文件违规并进取违规表(与 D1/D2/D3 同表 ⇒ 棘轮锚点、打印、退出码三条只有一套语义)。 */
export function mergeShadow(byFile, shadow) {
  for (const [f, list] of shadow.byShadow) {
    const cur = byFile.get(f) || []
    byFile.set(f, cur.concat(list))
  }
  return byFile
}

/** 两批 `.js` 说明符落点的合并:本次被改动的那些**消费方**在基准面上的记录要整批换掉,
 *  否则同一处消费方会在两个面上各记一次(计数虚高 ⇒ 把无关提交顶过它自己的锚点)。 */
export function mergeSites(baseSites, pendingSites, pendingSet) {
  return baseSites.filter((s) => !pendingSet.has(s.by)).concat(pendingSites || [])
}

/**
 * D3 的**待偿台账**(与守门 13c 的 LOST_ANCHOR_LEDGER 同一条设计:登记必须会过期)。
 * 全量口径对 D1/D2 仍是零容忍(2026-09-24 已清零);D3 是新射程,立项当天 HEAD 上就有
 * 一处真实违规 —— 那是 G-195 登记的"消费者已入库、被调用方从未写下",它让生产构建死。
 * 把它写成红等于把一台与别人的半成品相关的门钉成恒红(§12e 那一型:唯一结局是各会话
 * 跳门、约 154 道守门同时作废);所以这里**只登记不定免**:它仍被打印、仍被计数,
 * 只是不进退出码。**G-195 修好后必须删掉这一行**,否则它替人做出"还欠着"的判断。
 *
 * 现值为空:那一行点名的 `@/stores/conversation-org` 已于 2026-09-26 由 G-203 补齐
 * (web store 在 `d848dfb92` 进 HEAD,共享层那份规则同日跟上),台账行当场删除。
 * **再登记任何一行的前提**:它是别人正在推进的半成品、且本票无法正当代裁 —— 登记时必须
 * 连同 G 编号与"为什么现在不修"一起写在这里;空口登记不成立,修好了不删也不成立。
 */
export const KNOWN_ALIAS_LEDGER = []

/** tsconfig / jsconfig 的形状:本门只读它的 `compilerOptions.paths`,不解释 extends。 */
const TSCONFIG_RE = /(^|\/)(tsconfig[\w.-]*\.json|jsconfig\.json)$/

/**
 * 建别名表:`tsconfig.json` 们在**同一个取材面**上读(清单与内容不许分两面,见 77/101 同型教训)。
 * 解析不出来的文件 ⇒ 跳过并计入 `unparsed`,由调用方如实报数(绝不把"读不懂"当成"没有别名")。
 */
export function buildAliasIndex(readFile, paths) {
  const index = new Map()
  let unparsed = 0
  for (const p of paths) {
    if (!TSCONFIG_RE.test(p)) continue
    const text = readFile(p)
    if (text === null || text === undefined) continue
    const entries = aliasEntries(p, text)
    if (entries === null) {
      unparsed++
      continue
    }
    const dir = p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : ''
    if (!entries.length) continue
    index.set(dir, entries)
  }
  return { index, unparsed, seen: paths.filter((p) => TSCONFIG_RE.test(p)).length }
}

/** 按文件聚合(`jsSink` 见 auditFile:同一遍解析顺手收 D4 的落点) */
export function auditTree(readFile, files, hasPath, aliasIndex, jsSink) {
  const byFile = new Map()
  for (const f of files) {
    const v = auditFile(f, readFile, hasPath, aliasIndex, jsSink)
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

// `--rev <提交/树> [--anchor <提交>]`:审任意面(对象空间落地的涉事判据出口,G-815985)。
// 棘轮锚点 = 锚点提交自身的每文件违规数(与 --staged 同构,不是 0 —— 否则存量整片报红,
// 即恒红门,§12e);树没有父提交,不给 --anchor 即无法判定。`--rev` 与 `--staged`/`--files`
// 同给 ⇒ 用法错 exit 2。`SELF_SKIP` 在这一档不吃:调用方点名要结论,跳过等于没审
// (与 check:all bulk 里的默认跳过是两回事,静默跳过会把"没审"写成"审过")。
async function revMain(rev, anchorOpt, conflicts) {
  if (!rev || rev.startsWith('--')) {
    console.log(
      '❌ 无法判定:缺 --rev 取值(node scripts/check-dangling-local-imports.mjs --rev <提交/树> [--anchor <提交>])',
    )
    process.exit(2)
  }
  if (conflicts.isStaged || conflicts.filesMode) {
    console.log('❌ 用法错:--rev 不与 --staged/--files 同用(面只能有一个)')
    process.exit(2)
  }
  const kind = revKindOf(rev)
  if (!kind) {
    console.log(`❌ 无法判定:rev 解析不到 ${rev}(对象库里没有,先 fetch 再审)`)
    process.exit(2)
  }
  let anchor = anchorOpt && !anchorOpt.startsWith('--') ? anchorOpt : null
  if (!anchor) {
    if (kind !== 'commit') {
      console.log('❌ 无法判定:树对象没有父提交可当锚点,请显式 --anchor <提交>')
      process.exit(2)
    }
    try {
      anchor = gitRaw(['rev-parse', `${rev}^`], ROOT, { timeout: GIT_TIMEOUT }).trim()
    } catch {
      anchor = null // 根提交:锚点空 ⇒ 新增即报
    }
  } else if (revKindOf(anchor) !== 'commit') {
    console.log(`❌ 无法判定:anchor 须是提交 ${anchor}`)
    process.exit(2)
  }
  let face
  const anchorCounts = new Map()
  try {
    face = auditOneFace(rev)
    if (anchor) {
      const a = auditOneFace(anchor)
      for (const [f, list] of a.byFile) anchorCounts.set(f, list.length)
    }
  } catch (e) {
    console.log(`❌ 无法判定:取材失败(${e && e.message ? e.message : e})`)
    process.exit(2)
  }
  if (!face.files.length) {
    console.log(`❌ 无法判定:${rev} 面上枚举到 0 个源文件 —— 尺子失效不记绿`)
    process.exit(2)
  }
  const { fresh, tolerated } = splitFresh(face.byFile, (f) => anchorCounts.get(f) ?? 0)
  const total = [...face.byFile.values()].reduce((s, v) => s + v.length, 0)
  // D3 台账与主流程共用同一份 KNOWN_ALIAS_LEDGER(不另立第二份,两处实现必漂移)。
  const isLedgered = (file, v) => v.rule === 'D3' && KNOWN_ALIAS_LEDGER.includes(`${file}|${v.raw}`)
  const freshNonLedger = fresh
    .map(({ file, list, tol }) => ({ file, list: list.filter((v) => !isLedgered(file, v)), tol }))
    .filter((x) => x.list.length)
  console.log(`[dangling-imports] 内容口径:--rev ${rev}(${kind}面,锚点=${anchor ?? '空(根提交)'})`)
  console.log(
    `[dangling-imports] 别名表:同面 tsconfig 现读 / 解析失败 ${face.aliasUnparsed} 份(那一格的别名判据未生效)`,
  )
  console.log(
    `[dangling-imports] 扫描 ${face.files.length} 文件 | 悬空 ${total} 处(锚点容忍 ${tolerated} / 新增 ${freshNonLedger.length} 文件)`,
  )
  for (const { file, list, tol } of fresh) {
    console.log(`   ${file}(锚点 ${tol} 处 → 本次 ${list.length} 处)`)
    for (const v of list) console.log(`      :${v.line} [${v.rule}] ${v.raw}  → ${v.hint}`)
  }
  if (!freshNonLedger.length) {
    console.log('✅ 无新增(相对锚点;台账 D3 只报数不计红)')
    return
  }
  console.log(`❌ 新增 ${freshNonLedger.length} 个文件有悬空(相对锚点 ${anchor ?? '空'}),拒绝`)
  process.exit(1)
}

// ── CLI ───────────────────────────────────────────────────────────────────────────────
async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()
  const ri = argv.indexOf('--rev')
  const REV = ri >= 0 ? argv[ri + 1] : null
  const an = argv.indexOf('--anchor')
  const ANCHOR_OPT = an >= 0 ? argv[an + 1] : null
  const isStaged = argv.includes('--staged')
  const SHOW_ALL = argv.includes('--all')
  const fi = argv.indexOf('--files')
  const FILES_MODE = fi >= 0 ? argv.slice(fi + 1).filter((a) => !a.startsWith('--')) : null
  if (REV) return revMain(REV, ANCHOR_OPT, { isStaged, filesMode: FILES_MODE })
  if (process.env[SELF_SKIP] === '1') {
    console.log(`⏭️  已跳过(${SELF_SKIP}=1):悬空具名导入对账未执行`)
    return
  }

  const headFiles = trackedSourceFiles('HEAD')
  /** 枚举到 0 个源文件 = 尺子失效,不是"仓库干净"。全量口径对 D1..D4 都是零容忍,
   *  所以"什么都不判"绝不能顺着这条通道被读成通过(本仓反复记过的那一型)。 */
  if (!headFiles.length) {
    console.log('❌ 无法判定:HEAD 上枚举到 0 个跟踪源文件(ls-tree 返回空?)—— 本门未做任何对账')
    process.exit(2)
  }
  const headSizes = headBlobSizes()
  const mkRead = (rev, files) => {
    const map = catBatchBudgeted(
      files.map((p) => `${rev}:${p}`),
      rev === 'HEAD' ? headSizes : null,
    )
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
  /**
   * 别名表必须**单独开一次取材**:上面的 `readHead` 是按 `headFiles`(只有源文件)建的批量读,
   * 拿它读 `tsconfig.json` 恒返回 null ⇒ 别名表为空 ⇒ D3 变成一条"永远不报"的判据,
   * 而输出照样写"悬空 0 处"。这就是本仓反复记过的那一型:**判据失效的样子和"没有问题"完全一样**。
   * (第一次自跑就是在真 HEAD 上报 0,而 D20 那处 `@/stores/conversation-org` 明明还在。)
   */
  const TS_PATHS = treePaths('HEAD').filter((p) => TSCONFIG_RE.test(p) && !SKIP_DIR.test(p))
  const readTsHead = mkRead('HEAD', TS_PATHS)
  const aliasHead = buildAliasIndex(readTsHead, TS_PATHS)
  const ALIAS_UNPARSED = aliasHead.unparsed
  /** D4 的锚点面与消费方清单**恒取全量 HEAD**,不随 `--files` 收窄:那一面只递出声明清单里的
   *  `.js` 落点时,"把某个 .js 加回来而消费方一行没动"这一型(正是本次生产事故的形状)
   *  会在自验模式下静默 —— 漏的那一格恰好是本判据立项的唯一理由。 */
  const jsSitesHead = []
  const byHead = auditTree(readHead, headFiles, hasPath, aliasHead.index, jsSitesHead)
  const shadowHead = auditShadowJs(readHead, jsSitesHead, new Set(headFiles))
  mergeShadow(byHead, shadowHead)
  const headCountOf = (p) => (byHead.get(p) || []).length

  let byPending
  let shadowPending = shadowHead
  let stagedCount = 0
  let contentMode = 'HEAD 内容'
  if (isStaged) {
    contentMode = '索引内容(锚点=该文件 HEAD 自身)'
    const staged = gitRaw(['diff', '--cached', '--name-only', '--diff-filter=ACMR'], ROOT, {
      timeout: GIT_TIMEOUT,
    })
      .split('\n')
      .filter((p) => SRC_RE.test(p) && !SKIP_DIR.test(p) && !FIXTURE_ROOT.test(p))
    stagedCount = staged.length
    const readIdx = mkRead('', staged)
    // 暂存面里若有人改了 tsconfig paths,别名表必须跟着这一面走 —— 别名一改,一批合法导入
    // 立刻变悬空,而"改了映射的那枚提交"恰恰是本门最该审的那一枚。
    const tsIdx = treePaths('').filter((p) => TSCONFIG_RE.test(p) && !SKIP_DIR.test(p))
    const readTsIdx = mkRead('', tsIdx)
    const anyTs = (p) => readTsIdx(p) ?? readTsHead(p)
    const aliasStaged = buildAliasIndex(anyTs, tsIdx.length ? tsIdx : TS_PATHS)
    const readPending = (p) => (staged.includes(p) ? readIdx(p) : readHead(p))
    const jsSitesStaged = []
    byPending = auditTree(readPending, staged, hasPath, aliasStaged.index, jsSitesStaged)
    // D4 在暂存档上要跑**整面**(索引内容 ⊕ 其余 HEAD 内容)而不是只跑暂存清单:新加的
    // 影子 `.js` 常常不在这枚提交里被 import,而"它被 import"这一事实本身就来自未改动的那些消费方。
    shadowPending = auditShadowJs(
      readPending,
      mergeSites(jsSitesHead, jsSitesStaged, new Set(staged)),
      new Set(trackedSourceFiles('')),
    )
    mergeShadow(byPending, shadowPending)
  } else if (FILES_MODE) {
    contentMode = `工作区内容(--files ${FILES_MODE.length} 个,仅供自验,不作结论)`
    const wread = (p) => {
      try {
        return readFileSync(join(ROOT, p), 'utf8')
      } catch {
        return null
      }
    }
    const jsSitesFiles = []
    byPending = auditTree(wread, FILES_MODE, (p) => wread(p) !== null, aliasHead.index, jsSitesFiles)
    shadowPending = auditShadowJs(
      wread,
      mergeSites(jsSitesHead, jsSitesFiles, new Set(FILES_MODE)),
      new Set([...trackedSourceFiles(''), ...headFiles, ...FILES_MODE]),
    )
    mergeShadow(byPending, shadowPending)
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
  // 别名表规模必须打印:没有它,"悬空 0 处"和"D3 根本没上岗"长得一模一样(本门第一次自跑就是这样)。
  const ai = isStaged ? byPending && aliasHead : aliasHead
  console.log(
    `[dangling-imports] 别名表:${TS_PATHS.length} 份 tsconfig / 生效映射 ${ai ? ai.index.size : 0} 个包目录` +
      (ALIAS_UNPARSED ? ` / 解析失败 ${ALIAS_UNPARSED} 份(那一格的别名判据未生效)` : ''),
  )
  console.log(
    `[dangling-imports] 扫描 ${isStaged ? `${stagedCount} 个暂存源文件(锚点面 ${scanSet.length})` : `${scanSet.length} 文件`} | 悬空 ${total} 处(HEAD 存量容忍 ${tolerated} / 新增 ${fresh.length} 文件)`,
  )
  /** D4 的三个计数与上面那行同屏:"影子 0 处"和"这一遍根本没扫到任何 `.js` 说明符"在只印总
   *  行数的报告里长得一模一样 —— 上面别名表那段注释记的就是这条教训,新维度不得重犯。 */
  console.log(
    `[dangling-imports] D4 影子 .js:扫到的 '.js' 说明符落点 ${shadowPending.scanned} 个` +
      ` | 其中指向入库 .js ${shadowPending.targeted} 个` +
      ` | 判红候选 ${shadowPending.byShadow.size} 个` +
      ` | 只报数(同名对无人指向)${shadowPending.deadPairs.length} 个` +
      (shadowPending.undetermined.length ? ` | 未判定 ${shadowPending.undetermined.length} 个` : ''),
  )
  /**
   * 票面 G-815915 反假绿①「扫到 0 个候选判死不记绿」。
   *
   * 为什么这一格必须 exit 2 而不是打个警告继续:本门头注与别名表那段注释记的都是同一型 ——
   * **判据失效的样子和"没有问题"完全一样**。若采集通道断了(解析器某天不再递出 `.js` 落点),
   * 报告照样会写"判红候选 0 个",读起来就是一把干净的尺子,而它其实一眼都没看。
   * 判据挂在 `scanned`(**采集口径**)而不是 `targeted`:见 auditShadowJs 里 `scanned` 的注释,
   * 本仓 1768 个 `.js` 落点里只有 8 个指向入库 `.js` ⇒ `targeted === 0` 是常态而非失效。
   *
   * 口径与既有的"枚举到 0 个跟踪源文件 ⇒ exit 2"逐字同型(那一行在 main() 开头),两处并存:
   * 那一条兜住"源文件清单取空",这一条兜住"D4 落点采集断链"。`--rev` 面不适用(任意历史树
   * 本来就可能一个 `.js` 说明符都没有),故只在默认全量档与 --staged/--files 档生效。
   */
  if (d4ChannelBlind(shadowPending)) {
    console.log(
      '❌ 无法判定:D4 扫到 0 个 ".js" 说明符字面落点(采集通道断链)—— 这一维没看过任何东西,"判红候选 0 个"不作数',
    )
    process.exit(2)
  }
  for (const u of shadowPending.undetermined) console.log(`   ⚠️ D4 未判定 ${u.file}:${u.why}`)
  if (SHOW_ALL && shadowPending.targets.length)
    console.log(
      `   D4 被字面命中的入库 .js 全集(${shadowPending.targets.length} 个,含合规的那些 —— 名单决定这一维到底看了谁):\n` +
        shadowPending.targets.map((p) => `     ${p}`).join('\n'),
    )
  if (SHOW_ALL && shadowPending.deadPairs.length)
    console.log(
      `   D4 只报数的同名 .js + .ts/.tsx 对(共 ${shadowPending.deadPairs.length} 个,无人经 '.js' 说明符指向 ⇒ 死重量而非陷阱;逐个复核后另计一批):` +
        shadowPending.deadPairs
          .slice(0, 50)
          .map((p) => `\n     ${p}`)
          .join(''),
    )
  //  **全量审计零容忍**(2026-09-24 存量清零后钉死):HEAD 普查必须为 0。
  //    为什么不放在 `--staged`:那会因别人未入库的回归拦住无关提交(= 逼人绕过,连带废掉全部守门);
  //    全量模式只跑在 check:all / CI,正适合当"合并把已修好的悬空导入带回来"的哨兵。
  //    唯一例外是 `KNOWN_ALIAS_LEDGER`(D3 是新射程,立项当天 HEAD 上就有一处真违规,已登记 G-195):
  //    它照样被打印、照样被计数,只是不进退出码 —— 与改动无关的恒红门只会逼人绕过钩子。
  const d3All = []
  for (const [f, list] of byPending)
    for (const v of list) if (v.rule === 'D3') d3All.push({ ...v, file: f, key: `${f}|${v.raw}` })
  const d3Ledgered = d3All.filter((v) => KNOWN_ALIAS_LEDGER.includes(v.key))
  if (d3Ledgered.length)
    console.log(
      `ℹ️ D3 有 ${d3Ledgered.length} 处已在待偿台账(不计入退出码,修好后必须删台账行):` +
        d3Ledgered.map((v) => `\n   ${v.file}:${v.line} ${v.raw}`).join(''),
    )
  if (!isStaged && !FILES_MODE && total - d3Ledgered.length > 0) {
    console.log(`❌ 全量口径为零容忍:HEAD 上仍有 ${total} 处悬空具名导入 / 影子 .js(存量已于 2026-09-24 清零,D4 立门当天现读为 0)`)
    for (const [f, list] of byPending)
      for (const v of list) console.log(`   ${f}:${v.line} [${v.rule}] ${v.raw}  → ${v.hint}`)
    console.log('   单独复现:node scripts/check-dangling-local-imports.mjs')
    console.log(`   紧急跳过:${SELF_SKIP}=1(仅对 check:all/CI 有意义,提交链走 --staged)`)
    process.exit(1)
  }
  if (!fresh.length) {
    console.log('✅ 无新增(悬空具名导入 / 影子 .js)' + (total ? `(存量 ${total} 处如实报数,见下)` : ''))
    for (const [f, list] of byPending)
      for (const v of list) console.log(`   · 存量 ${f}:${v.line} [${v.rule}] ${v.raw}`)
    return
  }
  console.log(`❌ 新增 ${fresh.length} 个文件有解析不到的具名导入,或成了遮蔽同 stem .ts 的影子 .js:`)
  for (const { file, list, tol } of fresh) {
    console.log(`   ${file}(HEAD 自身 ${tol} 处 → 本次 ${list.length} 处)`)
    for (const v of list) console.log(`      :${v.line} [${v.rule}] ${v.raw}  → ${v.hint}`)
  }
  console.log(
    `   单独复现:node scripts/check-dangling-local-imports.mjs --files ${fresh.map((f) => f.file).join(' ')}`,
  )
  console.log(`   紧急跳过:${SELF_SKIP}=1 git commit ...(会连同把悬空导入留在 main 上,勿滥用)`)
  process.exit(1)
}

// ── 自检:正反成对 ─────────────────────────────────────────────────────────────────────
function selfTest() {
  const cases = [
    {
      name: 'D1 导入不存在的导出必拦',
      files: {
        'a/i.tsx': "import { Ghost } from './b'\n<Ghost />",
        'a/b.tsx': 'export function Real() { return null }',
      },
      red: 1,
    },
    {
      name: 'D1 导出确实存在必须放行(与上条成对)',
      files: {
        'a/i.tsx': "import { Real } from './b'\n<Real />",
        'a/b.tsx': 'export function Real() { return null }',
      },
      red: 0,
    },
    {
      name: 'D1 多行 import 里的悬空项要看得见',
      files: {
        'a/i.ts': "import {\n  Real,\n  Ghost,\n} from './b'\nexport const x = [Real, Ghost]",
        'a/b.ts': 'export const Real = 1',
      },
      red: 1,
    },
    {
      name: 'D1 export { A as B } 的对外名是 B',
      files: {
        'a/i.ts': "import { B } from './b'\nexport const x = B",
        'a/b.ts': 'const A = 1\nexport { A as B }',
      },
      red: 0,
    },
    {
      name: 'D1 export { B as C } 时导入 B 不算合规',
      files: {
        'a/i.ts': "import { B } from './b'\nexport const x = B",
        'a/b.ts': 'const B = 1\nexport { B as C }',
      },
      red: 1,
    },
    { name: 'D2 路径解析不到必拦', files: { 'a/i.ts': "import { x } from './nope'" }, red: 1 },
    {
      name: '缩进/注释里的示例 import 一律不判(防假红第一道)',
      files: {
        'a/i.ts':
          "export const k = 1\n//   import { Ghost } from './b'\n/** import { Ghost2 } from './b' */",
      },
      red: 0,
    },
    {
      name: 'export * 的目标不可枚举,必须放过',
      files: {
        'a/i.ts': "import { Anything } from './b'",
        'a/b.ts': "export * from './c'",
        'a/c.ts': 'export const Anything = 1',
      },
      red: 0,
    },
    {
      name: '非相对路径(@/、包名)不参与判定',
      files: {
        'a/i.ts': "import { Ghost } from '@/components/ghost'\nimport { View } from 'react-native'",
      },
      red: 0,
    },
    {
      name: 'type 导入同样要真存在(TS2305 也是编译期事故)',
      files: {
        'a/i.ts': "import type { Ghost } from './b'\nexport const x: Ghost = 1",
        'a/b.ts': 'export type Real = 1',
      },
      red: 1,
    },
    {
      name: 'side-effect 导入无具名项',
      files: { 'a/i.ts': "import './b'", 'a/b.ts': 'export const Real = 1' },
      red: 0,
    },
    {
      name: "TS 风格 './b.js' 指向 b.ts 必须解析得到(首版误判上百处 D2)",
      files: { 'a/i.ts': "import { Real } from './b.js'", 'a/b.ts': 'export const Real = 1' },
      red: 0,
    },
    {
      name: '资源导入只核存在性,不核导出名单',
      files: {
        'a/i.ts': "import logo from './logo.svg'\nexport const L = logo",
        'a/logo.svg': '<svg />',
      },
      red: 0,
    },
    {
      name: '资源路径真缺失仍要报 D2(与上条成对)',
      files: { 'a/i.ts': "import logo from './gone.svg'" },
      red: 1,
    },
    {
      name: 'export type { A } 转导出也算导出',
      files: {
        'a/i.ts': "import { A } from './b'\nexport const x: A = 1",
        'a/b.ts': "import type { A } from './c'\nexport type { A }",
        'a/c.ts': 'export type A = number',
      },
      red: 0,
    },
    {
      name: '解构导出 export const { X } = factory 必须算导出(7 处假红的成因)',
      files: {
        'a/i.ts': "import { useAuthStore } from './store'",
        'a/store.ts': 'const factory = {}\nexport const { useAuthStore } = factory',
      },
      red: 0,
    },
    {
      name: '模板字符串里拼出来的 import 不判(生成器夹具)',
      files: {
        'a/gen.mjs': 'export const SRC = 1',
        'a/g.mjs': "const tpl = `\nimport { Ghost } from './nope'\n`\nexport const t = tpl",
      },
      red: 0,
    },
    {
      // G-177 的形态:字符字面量里的反引号先拨错奇偶,后面的模板夹具就被当成真代码。
      // 这一条与上一条的区别只在"文件里多了几行 `c === '`'` 状判引号种类的正常代码"。
      name: '字符字面量里的反引号不得拨错模板奇偶(门自身夹具的假红成因)',
      files: {
        'a/gen.mjs': 'export const SRC = 1',
        'a/g.mjs':
          "function q(c) {\n  if (c === '\"' || c === \"'\" || c === '`') return c\n  return null\n}\nconst tpl = `\nimport { Ghost } from './nope'\n`\nexport const t = tpl",
      },
      red: 0,
    },
    {
      // G-177 的真实成因(比上一条更狠):反引号出现在**正则字面量**里 ——
      // 实测 scripts/check-theme-prop-wiring.mjs:403 一行 `/^(?:'|"|`)(light|dark)…$/`
      // 就把该文件后面 500 多行的模板奇偶整体反档,让 :917 的夹具 import 被判悬空。
      name: '正则字面量里的反引号不得拨错模板区间(真仓 G-177 的那一行形态)',
      files: {
        'a/gen.mjs': 'export const SRC = 1',
        'a/g.mjs':
          "const lit = /^(?:'|\"|`)(light|dark)(?:'|\"|`)$/.exec(inner)\nconst FIX = `\nimport { Ghost } from './nope'\n`\nexport const t = FIX",
      },
      red: 0,
    },
    {
      // 反向对照:同样含反引号字符字面量的文件里,列 0 的真悬空 import 必须仍然红 —— 否则
      // "认出模板区间"就退化成了万能放行口。
      name: '反向对照:同样含反引号字符字面量的文件里,列 0 的真悬空 import 必须仍判红',
      files: {
        'a/g.mjs':
          "function q(c) {\n  if (c === '\"' || c === \"'\" || c === '`') return c\n  return null\n}\nimport { Ghost } from './nope'\nexport const k = q\nexport const SRC = 1",
      },
      red: 1,
    },
    {
      name: '本地转导出 export { X } 不得把下一条 export-from 拼进来(web e2e fixtures 假红的成因)',
      files: {
        'a/i.ts':
          "import { test as baseTest } from '@playwright/test'\nexport { baseTest }\nexport {\n  A,\n} from './b'",
        'a/b.ts': 'export const A = 1',
      },
      red: 0,
    },
    {
      name: '导出名单里夹块注释(本仓 types.ts 满屏都是)不得吃掉注释后那个名字',
      files: {
        'a/b/i.ts': "import { LiveStatus } from '../../types'",
        'types.ts':
          "export type {\n  TFunction,\n  /** 批次 12:直播列表 */\n  LiveStatus,\n} from '@ihui/types'",
      },
      red: 0,
    },
    // ── D3:别名指向不存在的模块(G-195 那一型的结构性补口)────────────────
    {
      name: 'D3 别名导入解析不到文件必拦(@/stores/x 从未写下 ⇒ 生产构建死,而旧射程看不见)',
      files: {
        'apps/web/tsconfig.json': '{"compilerOptions":{"paths":{"@/*":["./src/*"]}}}',
        'apps/web/src/i.ts': "import { A } from '@/stores/conversation-org'\nexport const B = A",
      },
      red: 1,
    },
    {
      name: 'D3 反向对照:别名指向真实存在的文件必须放行(不得把 @/ 一律当悬空)',
      files: {
        'apps/web/tsconfig.json': '{"compilerOptions":{"paths":{"@/*":["./src/*"]}}}',
        'apps/web/src/i.ts': "import { A } from '@/stores/ok'\nexport const B = A",
        'apps/web/src/stores/ok.ts': 'export const A = 1',
      },
      red: 0,
    },
    {
      name: 'D3 边界:没有映射的裸包名 / node: 内建 / @scope 包一律不判(第一版在这里造出数百处假红)',
      files: {
        'apps/web/tsconfig.json': '{"compilerOptions":{"paths":{"@/*":["./src/*"]}}}',
        'apps/web/src/i.ts':
          "import assert from 'node:assert/strict'\nimport fs from 'node:fs'\nimport { x } from '@ihui/shared'\nimport P from '@pnpm/error'\nexport const B = [assert, fs, x, P]",
      },
      red: 0,
    },
    {
      name: 'D3 精确键(无尾随 *)不参与存在性判定 —— 认它就要完整 resolver,不猜',
      files: {
        'apps/web/tsconfig.json':
          '{"compilerOptions":{"paths":{"@plugins-data":["./app/plugins/data"]}}}',
        'apps/web/src/i.ts': "import { A } from '@plugins-data'\nexport const B = A",
      },
      red: 0,
    },
    {
      name: 'D3 带注释的 tsconfig 仍要能解析(jsonc,不是 JSON)',
      files: {
        'apps/web/tsconfig.json':
          '{\n  // paths 决定 @/ 落在哪儿\n  "compilerOptions": { "paths": { "@/*": ["./src/*"] } }\n}',
        'apps/web/src/i.ts': "import { A } from '@/nope'\nexport const B = A",
      },
      red: 1,
    },
    {
      // 这一例是**本门自己踩出来的**那条:include 里的 glob 同时含着块注释的两个分隔序列,
      // 用正则剥注释会把整段 JSON 吞掉 ⇒ 别名表空 ⇒ D3 一路"0 处"。真 tsconfig 逐字形态。
      name: 'D3 真 tsconfig 形态(include 里是 glob 列表)必须仍解析得出映射(正则剥注释的翻车现场)',
      files: {
        'apps/web/tsconfig.json':
          '{\n  "extends": "../../tsconfig.base.json",\n  "compilerOptions": { "paths": { "@/*": ["./src/*"] } },\n  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],\n  "exclude": ["node_modules", ".next*", "e2e"]\n}',
        'apps/web/src/i.ts': "import { A } from '@/stores/never-written'\nexport const B = A",
      },
      red: 1,
    },
    // ── D4:影子 .js(2026-09-29 立,起因是一次约 2.5 小时的生产 API 崩溃循环)──────────
    {
      name: 'D4 主判据:入库 X.js 被 .js 说明符字面命中、同 stem X.ts 也在库 ⇒ 必拦(正例)',
      files: {
        's/x.ts': 'export const Real = 1',
        // 内容故意写成**普通 JS**:主判据不需要"它是穿了马甲的 TS",同名对本身就已经是陷阱。
        's/x.js': 'const Real = 1\nexport { Real }',
        's/i.ts': "import { Real } from './x.js'\nexport const Y = Real",
      },
      red: 0,
      d4: 1,
      scanned: 1,
      blind: false,
    },
    {
      // 票面点名的反例那一侧,不可省:`.ts` 编译出同名 `.js` 是 TS 项目的常态,**不是缺陷**。
      // 判红它 ⇒ 门在每一个正常仓库上恒红,而恒红门的唯一结局是各会话绕过钩子(§12e)。
      // 这一例与上一条只差"有没有人经 '.js' 说明符指向它",判据必须分得开。
      name: 'D4 反向对照:`.ts` 真在、只是同名 `.js` 也在,无人经 .js 指向 ⇒ 不得误判(只报数)',
      files: {
        'c/x.ts': 'export const Real = 1',
        'c/x.js': 'const Real = 1\nexport { Real }',
        'c/i.ts': "import { Real } from './x'\nexport const Y = Real",
      },
      red: 0,
      d4: 0,
      dead: 1,
      scanned: 0,
      blind: true,
    },
    {
      // 与上一条成对,把"判死"那一档也钉住:这一族(无人写 `.js` 说明符的仓)落点真的是 0,
      // 门在那一档必须**判死不记绿** —— 否则"这一维没看过任何东西"会被读成"扫过且干净"。
      // 注意这与本仓真仓形态不同:真仓落点 1768 / 指向入库 8,所以真仓不会走到判死那一档。
      name: 'D4 反假绿①:全仓没有一条 .js 说明符 ⇒ 扫到 0 个落点必须判死不记绿(不记绿的那一档)',
      files: { 'a/i.ts': "import { Real } from './b'\nexport const Y = Real", 'a/b.ts': 'export const Real = 1' },
      red: 0,
      d4: 0,
      scanned: 0,
      blind: true,
    },
    {
      // 反假绿①的**反向对照**(防恒红):落点扫到 N 个、但指向入库 .js 的是 0 个 —— 这正是票面
      // 自己写的「现读覆盖面为 0」那一格,也是本仓 1768 个落点里 1760 个的形态。
      // 判死若挂到 `targeted` 上,这一例就会翻红并把门变成恒红门。
      name: 'D4 反假绿①反向对照:落点>0 而"指向入库 .js"=0 ⇒ 不得判死(否则本仓常态被判红)',
      files: {
        'n/x.ts': 'export const Real = 1',
        'n/i.ts': "import { Real } from './x.js'\nexport const Y = Real",
      },
      red: 0,
      d4: 0,
      scanned: 1,
      blind: false,
    },
    {
      name: "D4 反向对照:同一对文件里没人写 '.js' 说明符 ⇒ 只报数,不判红(与上条成对)",
      files: {
        's/x.ts': 'export const Real = 1',
        's/x.js': 'const Real = 1\nexport { Real }',
        's/i.ts': "import { Real } from './x'\nexport const Y = Real",
      },
      red: 0,
      d4: 0,
      dead: 1,
    },
    {
      name: 'D4 反向对照:`x.js` + `x.d.ts` 是已发布包的正常形态,不是遮蔽对(同名的两回事)',
      files: {
        'p/x.d.ts': 'export declare const Real: number',
        'p/x.js': 'export const Real = 1',
        'p/i.ts': "import { Real } from './x.js'\nexport const Y = Real",
      },
      red: 0,
      d4: 0,
    },
    {
      name: 'D4 次判据:没有同名 .ts,但被这样命中的 .js 自身是穿了马甲的 TS ⇒ 必拦(生产事故原形)',
      files: {
        'q/i.ts': "import { acquire } from './svc.js'\nexport const Y = acquire",
        'q/svc.js':
          'const counters = new Map<string, number>()\nexport function acquire(userId: string): number {\n  return 1\n}\n',
      },
      red: 0,
      d4: 1,
    },
    {
      name: 'D4 次判据反向对照:合法普通 JS 模块(解构/可选链/模板/正则/三元/比较/new)一律不得判红',
      files: {
        'r/i.ts': "import { helper } from './plain.js'\nexport const Y = helper",
        'r/plain.js': [
          'const base = 1',
          'export function helper(a, b) {',
          '  const merged = { ...a, b }',
          '  const name = a?.label ?? `n${base + b}`',
          '  const hit = /^(foo|bar)$/.test(name)',
          '  const small = a < b && b < c',
          '  const timed = new Date() < new Date(0)',
          '  for (let i = 0; i < 3; i++) if (i > 1) return i',
          '  return hit ? (merged) : (timed ? small : name)',
          '}',
          'class Thing extends Object { m(x = { k: 1 }) { return x } }',
          'const label = "interface Foo { a: number }"',
          'export { Thing as Cls }',
        ].join('\n'),
      },
      red: 0,
      d4: 0,
    },
    {
      name: 'D4 注释/字符串里写出的该形态一律不计(门不得读自己的解释文字 —— 与次判据正例成对)',
      files: {
        'u/i.ts': "import { acquire } from './svc.js'\nexport const Y = acquire",
        'u/svc.js': [
          '// 别在这里写 new Map<string, number>() —— 那正是把生产 API 打崩的形状。',
          '// interface Foo { a: number } 只是注释,不是代码。',
          'const note = "export function acquire(userId: string): number {}"',
          'export function acquire(id) {',
          '  return id',
          '}',
        ].join('\n'),
      },
      red: 0,
      d4: 0,
    },
    {
      name: 'D4 只报数那一族:同名 .js + .ts 对在库、无人经 .js 指向 ⇒ 判红 0 处、deadPairs 点名 1 个',
      files: {
        'v/x.ts': 'export const Real = 1',
        'v/x.js': 'const Real = 1\nexport { Real }',
      },
      red: 0,
      d4: 0,
      dead: 1,
    },
    {
      name: 'D4 内容取不到又无同名同伴 ⇒ 落"未判定"点名,既不冒红也不记为通过',
      files: {
        'w/i.ts': "import { Real } from './x.js'\nexport const Y = Real",
        'w/x.js': 'export const Real = 1',
      },
      // 目标读不出内容时两条判据各自如实表态:D1 报"导出名单取不到 ⇒ 悬空",D4 报"语法维未判",
      // 谁都不许把这一格洗成通过(把没判写成判过了,是本仓最高频的失效型)。
      noRead: ['w/x.js'],
      red: 1,
      d4: 0,
      undet: 1,
    },
    {
      name: "D4 别名映射到 `.js` 也算字面命中(同一约定的另一条入口,漏掉就等于给 @/ 留了暗格)",
      files: {
        'apps/web/tsconfig.json': '{"compilerOptions":{"paths":{"@/*":["./src/*"]}}}',
        'apps/web/src/x.ts': 'export const A = 1',
        'apps/web/src/x.js': 'export const A = 1',
        'apps/web/src/i.ts': "import { A } from '@/x.js'\nexport const B = A",
      },
      red: 0,
      d4: 1,
    },
  ]
  let fail = 0
  for (const c of cases) {
    const noRead = new Set(c.noRead || [])
    const read = (p) => (p in c.files && !noRead.has(p) ? c.files[p] : null)
    const has = (p) => p in c.files
    // 别名表由**同一份生产实现**建,不在自检里抄一份(§22c:抄出去的判据只会与实现漂移)
    const { index } = buildAliasIndex(read, Object.keys(c.files))
    const sites = []
    const n = Object.keys(c.files).reduce((s, p) => s + auditFile(p, read, has, index, sites).length, 0)
    // D4 与 D1/D2/D3 走**同一对参数**:消费方清单由上面那一遍解析顺手递出(不再抄一遍解析器)
    const shadow = auditShadowJs(read, sites, new Set(Object.keys(c.files)))
    const d4 = shadow.byShadow.size
    const dead = shadow.deadPairs.length
    const undet = shadow.undetermined.length
    // 票面 G-815915 反假绿①:每一条自带 `scanned` 期望(不写 = 不参与这一维的判定)。
    // 写这一列的理由与写 `red`/`d4` 同形 —— 判死口径挑错(挂到 `targeted` 上)时,只有
    // 逐例点名才看得出来,否则"门在真仓上恰好没触发"会把它洗成通过。
    const blind = d4ChannelBlind(shadow)
    const okScan = c.scanned === undefined || shadow.scanned === c.scanned
    const okBlind = c.blind === undefined || blind === c.blind
    const ok =
      n === c.red &&
      d4 === (c.d4 ?? 0) &&
      dead === (c.dead ?? 0) &&
      undet === (c.undet ?? 0) &&
      okScan &&
      okBlind &&
      [...shadow.byShadow.values()].flat().every((v) => v.rule === 'D4')
    if (!ok) fail++
    console.log(
      `${ok ? '✅' : '❌'} ${c.name} (悬空 ${n} 处/期望 ${c.red};影子 ${d4} 处/期望 ${c.d4 ?? 0};只报数 ${dead}/期望 ${c.dead ?? 0};未判定 ${undet}/期望 ${c.undet ?? 0};落点 ${shadow.scanned}/期望 ${c.scanned ?? '不限'};判死 ${blind}/期望 ${c.blind ?? '不限'})`,
    )
  }
  {
    // G-815985 `--rev` 面的 kind 判定三态(commit/tree/解析不到)。
    const treeSha = gitRaw(['rev-parse', 'HEAD^{tree}'], ROOT, { timeout: GIT_TIMEOUT }).trim()
    const ok =
      revKindOf('HEAD') === 'commit' &&
      revKindOf(treeSha) === 'tree' &&
      revKindOf('deadbeefdeadbeefdeadbeefdeadbeefdeadbeef') === null
    if (!ok) fail++
    console.log(`${ok ? '✅' : '❌'} --rev 面判定:HEAD=commit / HEAD树=tree / 假sha=null`)
  }
  {
    // G-815985 `--rev` 阳性对照(真历史,不是夹具):f3857e05cd 修掉 input-status-slot 引用的
    // 两个从未写下的导出 ⇒ 以修后为锚审修前,必须恰好点名那 1 文件 2 处 D1。
    // 变异对照:锚点取反(审修后以修后为锚)⇒ 新增 0 —— 锚点方向错了,尺子必须安静,而不是反咬。
    const broken = auditOneFace('f3857e05cd^')
    const fixed = auditOneFace('f3857e05cd')
    const cnt = (by) => {
      const m = new Map()
      for (const [f, l] of by) m.set(f, l.length)
      return m
    }
    const fixedCnt = cnt(fixed.byFile)
    const { fresh } = splitFresh(broken.byFile, (f) => fixedCnt.get(f) ?? 0)
    const hit = fresh.find((x) => x.file.endsWith('input-status-slot.tsx'))
    const { fresh: freshRev } = splitFresh(fixed.byFile, (f) => fixedCnt.get(f) ?? 0)
    const ok =
      fresh.length === 1 &&
      !!hit &&
      hit.list.length === 2 &&
      hit.list.every((v) => v.rule === 'D1') &&
      freshRev.length === 0
    if (!ok) fail++
    console.log(
      `${ok ? '✅' : '❌'} --rev 阳性对照:修前 vs 修后锚点恰好新增 input-status-slot.tsx 2 处 D1;修后 vs 修后锚点新增 0`,
    )
  }
  {
    // G-815985 `--rev` 的 CLI 形状(派生自身):假 rev 与面冲突必须 exit 2(无法判定,不是"没违规");
    // SELF_SKIP 在 --rev 档不吃(调用方点名要结论,跳过等于没审)。
    const gate = fileURLToPath(import.meta.url)
    const run = (args, env) => {
      try {
        const out = execFileSync(process.execPath, [gate, ...args], {
          encoding: 'utf8',
          windowsHide: true,
          timeout: 180000,
          env: env ?? process.env,
          stdio: ['ignore', 'pipe', 'pipe'],
        })
        return { rc: 0, out: String(out) }
      } catch (e) {
        return { rc: e.status ?? 9, out: String((e.stdout ?? '') + (e.stderr ?? '')) }
      }
    }
    const bad = run(['--rev', 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef'])
    const conflict = run(['--rev', 'HEAD', '--staged'])
    const skipped = run(['--rev', 'HEAD'], { ...process.env, [SELF_SKIP]: '1' })
    const ok =
      bad.rc === 2 &&
      conflict.rc === 2 &&
      skipped.rc === 0 &&
      skipped.out.includes('内容口径:--rev') &&
      !skipped.out.includes('已跳过')
    if (!ok) fail++
    console.log(
      `${ok ? '✅' : '❌'} --rev CLI 形状:假rev exit 2 / 面冲突 exit 2 / SELF_SKIP 下仍审计且 exit 0`,
    )
  }
  {
    // 纯函数侧:映射形态与"读不懂 ≠ 没有别名"的三态
    const okShape =
      JSON.stringify(aliasEntries('apps/web/tsconfig.json', '{"compilerOptions":{"paths":{"@/*":["./src/*"]}}}')) ===
      JSON.stringify([{ prefix: '@/', dir: 'apps/web/src' }])
    const okNoPaths = JSON.stringify(aliasEntries('a/tsconfig.json', '{"compilerOptions":{}}')) === '[]'
    const badIsNotSilent = aliasEntries('a/tsconfig.json', '{"compilerOptions": {"paths": ') === null
    const unparsedCounted = buildAliasIndex((p) => (p === 'a/tsconfig.json' ? '{ oops' : null), [
      'a/tsconfig.json',
    ]).unparsed === 1
    const ok = okShape && okNoPaths && badIsNotSilent && unparsedCounted
    if (!ok) fail++
    console.log(
      `${ok ? '✅' : '❌'} aliasEntries 三态:有映射建表 / 无 paths 返回 [] / 解析失败返回 null 且被计入 unparsed`,
    )
  }
  {
    // TS 语法探针的**逐条**成对证明。为什么光有上面那几条端到端用例不够:端到端只说"这一族判红/
    // 不判红",而某一条探针被顺手放宽(例如 `): Type {` 那一档)时,只有构造面能点名是哪条。
    const TS_SAMPLES = [
      ['interface 声明', 'export interface Foo {\n  a: number\n}'],
      ['enum 声明', 'export enum E { A, B }'],
      ['implements 子句', 'class A implements B {}'],
      ['satisfies 表达式', 'const cfg = { a: 1 } satisfies B'],
      ['变量类型标注', 'const n: number = 1'],
      ['形参类型标注', 'export function f(a: string, b?: number) {}'],
      ['泛型实参(new X<…>)', 'const m = new Map<string, number>()'],
      ['泛型形参约束', 'function g<T extends object>(x: T) { return x }'],
      ['类型别名', 'type Kind = 1 | 2'],
      ['as 断言', 'const v = data as const'],
      ['import type', "import type { A } from './b'"],
    ]
    const MIS_SAMPLES = [
      // 这一条刻意取 `as readonly`:若没有"说明符行不跑 as 探针"那一档,它就会被读成 TS 断言
      ['模块重命名不是断言', 'export { a as readonly }'],
      ['普通重命名', 'export { a as B }'],
      ['比较不是泛型实参', 'const ok = new Date() < new Date(0)'],
      ['for 头不是形参标注', 'for (let i = 0; i < n; i++) {}'],
      ['三元带括号不是返回类型', 'const z = c ? (a) : b'],
      ['箭头默认参是对象', 'const fn = (x = { k: 1 }) => x'],
      ['对象字面量里的冒号', 'const o = { type: Foo, a: 1 }'],
      ['解构形参', '({ a, b }) => a + b'],
      ['spread 与可选链', 'const y = { ...x, z: x?.w ?? 1 }'],
    ]
    const missed = TS_SAMPLES.filter(([, t]) => probeTypeScriptSyntax(t).length === 0).map(([n]) => n)
    const falseHit = MIS_SAMPLES.filter(([, t]) => probeTypeScriptSyntax(t).length > 0).map(([n]) => n)
    // 同一个形状只写在注释 / 字符串里时必须一律不命中(门读自己的解释文字 = 本仓最高频失效型)
    const prose = probeTypeScriptSyntax(
      '// export interface Foo { a: number }\nconst note = "const n: number = 1; new Map<string, number>()"\n/* type Kind = 1 | 2 */\nexport const ok = 1',
    )
    const ok = !missed.length && !falseHit.length && prose.length === 0
    if (!ok) fail++
    console.log(
      `${ok ? '✅' : '❌'} TS 探针成对:${TS_SAMPLES.length} 条真形态全部命中 / ${MIS_SAMPLES.length} 条合法 JS 全部不命中 / 注释与字符串里的该形态不计(实得漏判 ${missed.length}、假阳 ${falseHit.length}、散文命中 ${prose.length})`,
    )
  }
  // 真仓对照:HEAD 上这一类的真实存量必须是**已知且有限**的,判据不得凭空放大
  const real = trackedSourceFiles('HEAD')
  const trackedAll = new Set(treePaths('HEAD'))
  const readHead = catBatchBudgeted(
    real.map((p) => `HEAD:${p}`),
    headBlobSizes(),
  )
  const cache = new Map()
  const read = (p) => {
    if (cache.has(p)) return cache.get(p)
    const v = readHead.get(`HEAD:${p}`) ?? null
    cache.set(p, v)
    return v
  }
  // 别名表必须一起喂进来:不带它,"真仓 HEAD 实测 0 处"这句话只证明了 D1/D2 干净,
  //  而 D3 根本没上岗 —— 报告读起来像"全都查过了",这正是本门最反对的那种绿。
  const tsPaths = treePaths('HEAD').filter((p) => TSCONFIG_RE.test(p) && !SKIP_DIR.test(p))
  const tsBlobs = catBatch(
    ROOT,
    tsPaths.map((p) => `HEAD:${p}`),
    { timeout: GIT_TIMEOUT },
  )
  const aliasReal = buildAliasIndex((p) => tsBlobs.get(`HEAD:${p}`) ?? null, tsPaths)
  const jsSitesReal = []
  const found = auditTree(
    read,
    real,
    (p) => trackedAll.has(p) || existsSync(join(ROOT, p)),
    aliasReal.index,
    jsSitesReal,
  )
  // D4 走的是**同一遍解析**递出来的落点,取同伴/读 .js 内容也都在这一个面上 —— 清单与内容分两面
  //  正是守门 77/101/118 记过的那类"自洽却错位"的尺子。
  const shadowReal = auditShadowJs(read, jsSitesReal, new Set(real))
  mergeShadow(found, shadowReal)
  const total = [...found.values()].reduce((s, v) => s + v.length, 0)
  const d3n = [...found.values()].flat().filter((v) => v.rule === 'D3').length
  const d4n = [...found.values()].flat().filter((v) => v.rule === 'D4').length
  console.log(
    `\n📎 真仓 HEAD 实测:${real.length} 个跟踪源文件,悬空+影子 ${total} 处(其中 D3 ${d3n} 处、D4 ${d4n} 处;别名表 ${aliasReal.index.size} 个包目录、${aliasReal.unparsed} 份解析失败)`,
  )
  console.log(
    `📎 D4 现读:被 '.js' 说明符字面命中的入库 .js ${shadowReal.targeted} 个 | 判红候选 ${shadowReal.byShadow.size} 个 | 只报数(同名对无人指向)${shadowReal.deadPairs.length} 个 | 未判定 ${shadowReal.undetermined.length} 个`,
  )
  for (const u of shadowReal.undetermined) console.log(`   ⚠️ D4 未判定 ${u.file}:${u.why}`)
  if (shadowReal.deadPairs.length)
    console.log(`   D4 只报数的同名对:${shadowReal.deadPairs.slice(0, 20).join(', ')}${shadowReal.deadPairs.length > 20 ? ' …' : ''}`)
  for (const [f, list] of found)
    for (const v of list) console.log(`   ${f}:${v.line} [${v.rule}] ${v.raw}`)
  // 与主判据**共用同一份表**:台账内的 D3(G-195)只报数不计红。两处各写一遍必然漂移,
  // 而漂移的表现是"自检与审计给出两个结论"—— 本仓为这句话付过很多次学费。
  const d3RealAll = [...found.entries()].flatMap(([f, list]) =>
    list.filter((v) => v.rule === 'D3').map((v) => `${f}|${v.raw}`),
  )
  const d3RealLedgered = d3RealAll.filter((k) => KNOWN_ALIAS_LEDGER.includes(k)).length
  const d3RealUnledgered = d3RealAll.filter((k) => !KNOWN_ALIAS_LEDGER.includes(k))
  if (d3RealUnledgered.length)
    console.log(`❗ 未登记的 D3(这些会让 --staged 判红):${d3RealUnledgered.join(', ')}`)
  if (total - d3RealLedgered > 0) {
    console.log(
      `❌ 存量已清零后本门零容忍 —— HEAD 上仍有 ${total} 处,说明有回归(多半是合并把已修好的导出又吞了)`,
    )
    process.exit(1)
  }
  if (fail) {
    console.log(`❌ ${fail} 例失败`)
    process.exit(1)
  }
  console.log(`\n全部 ${cases.length + 2} 例通过(含真仓 HEAD 实测与探针成对例)`)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
