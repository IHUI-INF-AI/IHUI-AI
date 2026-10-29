#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Python 侧「import 的目标包到底入库了没有」对账(2026-10-05 立,G-1058602 第②段)。
 *
 * 立因是当轮现读的仓库级破口:HEAD 里 3 个**已跟踪**文件(app/core/capability_matrix.py、
 * app/services/mcp_server.py、app/services/tool_input_scanner.py)import `app.services.sandbox`,
 * 而 `git ls-tree HEAD -- apps/ai-service/app/services/sandbox` = **0 个文件** —— 盘上那 5 个模块
 * 是别人未跟踪的在飞件。后果:本机进程照常跑(磁盘掩盖了它),而**任何新检出与 CI 一 import 就
 * ModuleNotFoundError**。当时全链零判据:守门 98 只判 JS/TS 本地 import;99/168 只判「暂存删除」与
 * 「合并复活」——本型从未入库过,两条都看不见;mypy/typecheck/pytest 都在有盘的机器上跑,对
 * "树里缺文件"天然免疫。
 *
 * 判据(窄口径,宁漏不误报):只看**本仓模块** —— 绝对导入以 `app.` 开头,或 `from .x import` 这类
 * 包内相对导入。其余(fastapi / sqlalchemy / 标准库 / 第三方)一律算「非本仓,不判」并计数:
 * 给第三方建包表必然腐烂(§4 对 RN_ONLY_BRAND_KEYS 记过同型)。模块算在位 = 面上存在
 * `<路径>.py` 或 `<路径>/__init__.py`。
 *
 * 三态绝不并桶:**缺失**(新增判红)/ **放过**(非本仓根,只计数)/ **未判定**(动态 importlib、
 * 相对导入逃出被审根、内容取不到 ⇒ 逐条点名;`--strict` 下有未判定或存量即 rc=2,拒绝出合格证)。
 * 棘轮基线另立一档(票 G-1058652):"该文件在 HEAD 上没有自身锚点"是**新增文件的定义后果**,
 * 不是判据失明 ⇒ 报名但**不落未判定**,否则同一条 import 会同时挂"缺失"与"未判定"两个互斥结论。
 * 刻意**不判**的一格(如实登记,别以为这里有尺子):`from app.a.b import Name` 的**符号**是否真被导出
 * —— 那是 Python 版的守门 98 D1,需要符号表;本门只判"模块在不在被审面上"。
 *
 * **"本轮扫谁"与"在位性按哪张面判"是两个集合,不许合并**(票 G-1058652 的病根):
 * `--staged` 档前者是 `diff --cached` 的**改动子集**,后者必须按**索引面全集**
 * (`ls-files --cached`)。合并的后果是"被 import 的目标本次没改动"被读成"不在面上",
 * 而它实测在 HEAD 上 ⇒ 一个新 .py 只要 import 既有模块就被 blocking 门挡下(假红)。
 * 另:`--staged` 下"新增但没 git add"的 .py **单独报名不判红**(它不在索引面上,不是"本次没有 Python")。
 *
 * 口径同 70/77/83/98/101/103/118:全量判 **HEAD blob**、`--staged` 判**索引 blob**(清单与内容同面同轮)、
 * `--worktree` 仅人工、两面旗同给 exit 2、取不到**不回落**另一个面、枚举到 0 个 .py **判死不记绿**;
 * 棘轮锚点 = **该文件在锚点面自身的缺失数**,所以本机这一处存量只报数、新增才红
 * (存量当场判红就是一台与提交者无关的恒红门,唯一结局是逼人 --no-verify,§12e)。
 *
 * ── 2026-10-29 补的两格(票面:"被 import 的模块根本没入库,而全链零判据")────────────────
 * **D-P1 全量档的锚点必须是父提交面,不是被审面自身。**
 *   改前的实现是 `a = read(file)`(同一张面上的同一份正文)⇒ `cap` 恒等于 `mine.length` ⇒
 *   `mine.length > cap` 结构上永不成立 ⇒ **全量档一行红都判不出来**,只可能报存量。
 *   这不是理论:旁路落地器(union-converge / object-space-land 走 commit-tree + CAS,**不跑钩子**)
 *   落地后由 `scripts/lib/land-gate-rerun.mjs` 复跑受影响登记门,而它复跑的是**注册条目的 args = []
 *   ⇒ 正是这一档全量**。现跑实证(2026-10-29 临时仓复现,夹具见镜像测试 T8):一枚"收编在飞件"式
 *   落地把 `from app.core.never_landed import W` 送进 HEAD 之后,本门报
 *   `新增判红 0 处 · 存量 1 处` 并 **rc=0** —— 落地通道唯一的那一臂就这么把缺陷盖成"存量"。
 *   改后:全量档锚点 = `HEAD^`(缺省可被 `--anchor` 覆写),即"本次带进来的才算新增",与 §0.5 的
 *   棘轮定义逐字对齐;锚点面**整张取不到**(浅克隆 / 初始提交)⇒ 基线按 0 计并逐条大声报名
 *   (**方向取最严**,与 G-1058652 的"新增文件没有自身基线"同档 —— 降成存量档等于把"取不到输入"
 *   判成通过,§0.3 禁止;当场 exit 2 又会让浅克隆环境把整道门永久悬成未判定)。**被审面**取不到仍是
 *   exit 2 未判定。`--staged` 档锚点仍是 HEAD(提交者视角的"本次"),一字未改。
 *   锚点面的**在位性全集也换成锚点面自己的 .py 集**:旧实现拿被审面全集去数锚点面的缺失,于是
 *   "本次删掉了承载模块、导入方一行没动"被读成 cap=1 ⇒ 不红 —— 删除方向同样是瞎的,同批修掉。
 * **D-P2 「本仓模块」按被审面的事实判,不再按写死的 `app.` 前缀判。**
 *   旧口径 `parts[0] !== 'app' ⇒ 非本仓,放过` 把 HEAD 面上真实存在的本仓顶层包整片放行
 *   (现读 15 处:`from scripts.audit_principal_consumed import …`、`from bench.run_bench import …`、
 *   `from tests.… import …`),并把整个 `packages/sdk/python`(27 枚 .py,`[tool.setuptools.packages.find]
 *   include = ["ihui_ai*"]`)排除在射程外。改后根集 = 内置 `apps/ai-service/app`(保留为**下限**,
 *   只加不减,免得改判据把已判过的格子放掉)∪ **被审面上真的存在的 `pyproject.toml` 所声明的包根**
 *   (hatch `[tool.hatch.build.targets.wheel] packages` / setuptools `packages` 与 `packages.find.include`),
 *   外加"该根下含 .py 的直接子目录"这一条面上事实;三样都不命中的才算外部/标准库 ⇒ 放过并计数。
 *   pyproject 命中了段名但数组解析不出来 ⇒ 该根**报名**(`unparsed`),不静默当"没有本仓包"。
 *   现读存量:D-P2 新增覆盖面里坏 import **0 处**(临时探针三轮实测,HEAD 面 1580 枚 .py 全扫);
 *   唯一存量仍是 `hook_engine.py:1182 from ..services.email_service import send_email`(try/except ImportError
 *   的已声明可选依赖,盘上与 HEAD 面皆无 email_service.py)⇒ 仍走棘轮只报数,不放宽判据。
 *
 * ── `--rev` 档(与守门 98 的 G-815985 / G-929 契约逐字同形,供旁路落地器在 commit-tree 之前问一次)──
 *   `--rev <提交|树> [--anchor <提交|树>] [--root <仓根>]`;锚点缺省 = 被审提交的首个父提交;
 *   树对象没有父提交 ⇒ 不给 `--anchor` 即无法判定(exit 2)。`--rev` 与 `--staged`/`--worktree`
 *   同给 = 两个判定面互斥 ⇒ exit 2。`--root` 给了坏值 ⇒ exit 2,**不静默回落到自推导**。
 *
 * 手动:`node scripts/check-python-import-landed.mjs [--staged|--worktree|--rev <r> [--anchor <r>] [--root <dir>]|--json|--strict|--self-test]`
 * **定级(2026-10-05 接线当轮)**:**已接提交链,blocking**,应急跳过变量 `HUSKY_SKIP_PYTHON_IMPORT_LANDED`
 * (名字与 runner 注册条目逐字同形 —— 写了没人读的变量就是假逃生舱,守门 172 判的那一型)。
 * 接线的三条前置都已满足:① §22c 镜像 6 例在位(含临时仓端到端"注入必红 / 补齐必绿"双向锁);
 * ② HEAD 面存量已由「该文件 HEAD 自身缺失数」棘轮兜住 —— 补上"命名空间包(PEP 420)"与"遮 Python 字符串内部"
 * 两维判据后,当轮现读存量 9 → **1**(那 1 处是 hook_engine 里 `try: import … except ImportError: 降级并记日志`
 * 的**已声明可选依赖**,属正当写法,只报数不判红,所以接线不新增任何恒红面);
 * ③ 注册条目与门体、镜像、文档点名**同枚入库**(守门 89 的 R2/R4 与 README 表格门那一课:
 * 指向不存在脚本的注册 = 干净检出上整批门被打断)。
 */
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  assertRepoRoot,
  catBatch,
  gitRaw,
  readWorktreeFile,
  selectFace,
} from './lib/face-reader.mjs'
// CLI 取值走共享出口(G-322):手解 argv[i+1] 的三支坏值(被下一旗标顶值 / 漏值 / 空串)都会静默
// 退回默认面,而那面恰好是"看起来判过了"的假绿来源。守门 98 的 `--root` 契约同用这一出口。
import { requireFlagValue } from './lib/flag-value.mjs'

// `--root <dir>` = **被审仓根**(与守门 98 的 G-929 契约同形:旁路落地器换仓通道 LAND_ROOT 指别的仓时,
// 缺省按脚本位置推导会在本仓里问一枚只有目标仓才有的树 ⇒ 未判定 ⇒ 落地器误拒)。
// 坏值(给了旗标没给值)与目录不存在都在 main 里 exit 2,**不静默回落到自推导**。
const ROOT_FLAG = requireFlagValue(process.argv.slice(2), '--root', { noun: '被审仓根目录' })
const ROOT = ROOT_FLAG.value
  ? resolve(ROOT_FLAG.value)
  : resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GIT_TIMEOUT_MS = 180_000
/** 被审根:ai-service 的 Python 包根。加端必须同批改本常量与本注释,否则出现"扫到了但没判"的静默失明。 */
export const PY_ROOT = 'apps/ai-service'
export const PKG = 'app'

const IMPORT_RE =
  /^[ \t]*(?:from[ \t]+([.\w]+)[ \t]+import|import[ \t]+([.\w]+)(?:[ \t]+as[ \t]\w+)?[ \t]*$)/
const STAR_RE = /^[ \t]*from[ \t]+[.\w]+[ \t]+import[ \t]*\*[ \t]*$/
const DYN_RE = /\bimportlib\s*\.\s*(?:import_module|__import__)\s*\(/

const norm = (p) => String(p).replace(/\\/g, '/')

/**
 * 整仓 .py 清单的唯一取法 = 下面的 `openFace()`(2026-10-29 收口)。
 * 这里**不再保留**旧的 `FACE_PY_ARGS` / `facePySet` / `faceUniversePy` 三份"按 PY_ROOT 限子树"的清单:
 * 同一件事留两份实现必然漂移(§0.6),而 D-P2 之后"面"的定义已经换成"整仓清单 + 声明根划射程",
 * 旧那三份既不再被调用、又会诱导后来人继续沿用"子树清单"这条会漏判的通路。
 */

/** 内置根:门 2026-10-05 立项时的硬口径。D-P2 之后它是**下限**——面上声明的根只往里加、不减,
 *  否则"改判据"会把已经判过的格子悄悄放掉(§12f:判据失效的表现永远是安静)。 */
export const BUILTIN_ROOT_PACKAGES = Object.freeze([
  { root: PY_ROOT, packages: [PKG], source: 'builtin' },
])

/** 教学/夹具树:里面的 .py 是**故意写坏**的样例(与 ruff `bench/fixtures/** = [F821]`、守门 98 的
 *  FIXTURE_ROOT 同一条边界),不做导入方;它们仍留在**在位性全集**里(被别人指到时算"在")。 */
const FIXTURE_PY = /(^|\/)(benchmarks|fixtures|testdata|node_modules|\.venv|venv|dist)\//

/**
 * 从被审面上的 `pyproject.toml` 正文解析「这个目录是某个 Python 分发包的根,顶层可导入包名是 …」。
 * 只认仓里**真的在用**的三条声明形态(hatch wheel targets / setuptools packages / setuptools packages.find),
 * 外加"该目录含 .py 的直接子目录"这一条面上事实(buildFaceCtx 里补)。
 * 认不出段名 ⇒ null(这不是一个分发包根);认出段名但数组解析不出 ⇒ `unparsed:true` **报名**,
 * 不静默当"没有本仓包"(§0.3:没判绝不写成判过)。
 */
export function parsePyprojectPackages(relPath, text) {
  const src = String(text ?? '')
  if (!src.trim()) return null
  const root = dirname(norm(relPath)).replace(/\\/g, '/')
  const packages = new Set()
  let unparsed = false
  let sawToolSection = false
  let section = ''
  for (const line of src.split(/\r?\n/)) {
    const h = /^\s*\[([^\]]+)\]\s*(?:#.*)?$/.exec(line)
    if (h) {
      section = h[1].trim()
      if (/^tool\.(hatch\.build\.targets\.wheel|setuptools)(\.packages\.find)?$/i.test(section))
        sawToolSection = true
      continue
    }
    const kv = /^\s*([A-Za-z_][\w-]*)\s*=\s*(.+?)\s*(?:#.*)?$/.exec(line)
    if (!kv) continue
    const [, key, rawVal] = kv
    const items = /^\[([\s\S]*)\]$/.exec(rawVal)
    const strings = items
      ? [...items[1].matchAll(/["']([^"']+)["']/g)].map((m) => m[1])
      : [...rawVal.matchAll(/["']([^"']+)["']/g)].map((m) => m[1])
    if (section === 'tool.hatch.build.targets.wheel' && key === 'packages') {
      // `packages = ["app"]` / `["src/foo"]` ⇒ 顶层名取最后一段
      for (const s of strings) {
        const seg = s.replace(/\\/g, '/').split('/').filter(Boolean).pop()
        if (seg) packages.add(seg)
      }
    } else if (section === 'tool.setuptools' && key === 'packages') {
      for (const s of strings) {
        const seg = s.split('.').filter(Boolean)[0]
        if (seg) packages.add(seg)
      }
    } else if (section === 'tool.setuptools.packages.find' && key === 'include') {
      for (const s of strings) {
        const seg = s.replace(/\\/g, '/').split('/').pop().replace(/\*.*$/, '').replace(/\.+$/, '')
        if (seg) packages.add(seg)
      }
      if (!strings.length) unparsed = true
    }
  }
  if (!sawToolSection) return null
  if (!packages.size) unparsed = true
  return { root, packages: [...packages], unparsed, source: relPath }
}

/** 该根下「直接子目录里含 .py」= 面上事实的顶层可导入名(PEP 420 命名空间包也算,与 modulePresent 同口径)。 */
export function topsUnderRoot(pyPaths, root) {
  const out = new Set()
  const pre = `${root === '.' ? '' : root}/`
  for (const p of pyPaths) {
    if (root !== '.' && !(p === root || p.startsWith(pre))) continue
    const rest = root === '.' ? p : p.slice(pre.length)
    const segs = rest.split('/')
    if (segs.length >= 2 && segs[0]) out.add(segs[0])
  }
  return out
}

/**
 * 一张面的分类上下文:`byTop` = 顶层名 → 候选根集合,`roots` = 根清单(决定谁是导入方 + 相对导入的逃逸边界)。
 * 判定"本仓 vs 外部"只用两个事实:① 被审面上的 pyproject 声明了这个顶层包(哪怕整族没入库,也**必须**判);
 * ② 该根下这个顶层名字真的存在(目录含 .py)。两条都不命中才算外部/标准库 ⇒ 放过并计数。
 */
export function buildFaceCtx({ pyPaths, rootSpecs }) {
  const roots = []
  const byTop = new Map()
  const unparsed = []
  const add = (root, top) => {
    if (!byTop.has(top)) byTop.set(top, new Set())
    byTop.get(top).add(root)
  }
  for (const spec of rootSpecs ?? []) {
    if (!spec || !spec.root) continue
    if (!roots.some((r) => r.root === spec.root)) roots.push(spec)
    for (const top of spec.packages ?? []) add(spec.root, top)
    for (const top of topsUnderRoot(pyPaths ?? [], spec.root)) add(spec.root, top)
    if (spec.unparsed)
      unparsed.push(`${spec.source}(认出包声明段名但顶层名解析不出 ⇒ 只认面上目录事实)`)
  }
  return {
    roots,
    unparsed,
    byTop: new Map([...byTop].map(([k, v]) => [k, [...v]])),
    rootDirs: roots.map((r) => r.root),
  }
}

/** 兼容旧调用(mirror T3 / 自检 P 系列)的缺省上下文 = 内置根,行为与 D-P2 之前逐字相同。 */
export const LEGACY_CTX = buildFaceCtx({ pyPaths: [], rootSpecs: BUILTIN_ROOT_PACKAGES })

const underAnyRoot = (dir, roots) =>
  dir === '.' || dir === ''
    ? false
    : roots.some((r) => r === '.' || dir === r || dir.startsWith(`${r}/`))

/** 把一条 import 解析成"仓内路径候选"。kind:'abs' 本仓绝对导入 / 'rel' 包内相对 / 'other' 非本仓 / 'escape' 判不出 */
export function parseImport(line, fileRel, ctx = LEGACY_CTX) {
  const star = STAR_RE.test(line)
  const m = IMPORT_RE.exec(line)
  if (!m) return { kind: 'none' }
  const mod = (m[1] ?? m[2] ?? '').trim()
  if (!mod) return { kind: 'none' }
  const roots = ctx?.rootDirs?.length ? ctx.rootDirs : LEGACY_CTX.rootDirs
  if (mod.startsWith('.')) {
    const dots = /^\.+/.exec(mod)[0].length
    const tail = mod.slice(dots)
    // 文件的**所在目录**就是它的包目录(多剥一层会把同级导入算到父目录 —— 自检 P4/P5 钉这条)。
    let dir = dirname(norm(fileRel))
    for (let i = 1; i < dots; i++) {
      dir = dirname(dir)
      // 逃出被审根 ⇒ 这一条判不出,只能报名:不猜路径,也不判红。
      if (
        dir === '.' ||
        dir === '' ||
        dir === 'apps' ||
        dir === PY_ROOT ||
        !underAnyRoot(dir, roots)
      )
        return { kind: 'escape', mod }
    }
    return {
      kind: 'rel',
      base: dir === '.' ? '' : dir,
      parts: tail ? tail.split('.').filter(Boolean) : [],
      star,
    }
  }
  const parts = mod.split('.').filter(Boolean)
  const bases = (ctx ?? LEGACY_CTX).byTop.get(parts[0])
  if (!bases || !bases.length) return { kind: 'other', mod, star }
  // 绝对导入保留首段(包名正是根下面那一层目录):早先在这里 slice(1) 把 app 剥掉 ⇒ 拼出
  // apps/ai-service/core/config 这种不存在的路径,于 HEAD 上凭空造出 2762 处"缺失"——
  // 一个判据把自己写成恒红机器,靠的正是这种 off-by-one。
  return { kind: 'abs', base: bases[0], bases, parts, star }
}

/** 模块在文件集合里是否存在:`.py` / 包目录的 `__init__.py` / **命名空间包**(PEP 420:目录里有 .py 但没 __init__.py 也合法)。 */
export function modulePresent(set, cand, dirs = null) {
  return (
    set.has(`${cand}.py`) || set.has(`${cand}/__init__.py`) || (dirs !== null && dirs.has(cand))
  )
}

/**
 * 把 Python 源码里的**字符串内部**遮成空格(行号与长度不变)。
 * 为什么必须做:测试文件普遍把"示例代码"写在 docstring / 三引号里(本仓的越权用例夹具就是这么写的),
 * 那些行逐字看就是 `from app.ghost import guard`。不遮字符串,这道门就会把**自己的测试**判成仓库违规,
 * 而假阳的代价不是"多一行报告",是让人去修没坏的东西、并把判据口径说歪成"问题很多"。
 * 只遮内部、保留引号本身 —— 引号是语法边界,抹掉会让下一行的状态机误判。
 */
export function maskPythonStrings(src) {
  const s = String(src)
  const out = s.split('')
  let i = 0
  const n = s.length
  while (i < n) {
    const c = s[i]
    if (c === '#') {
      while (i < n && s[i] !== '\n') i++
      continue
    }
    if (c === '"' || c === "'") {
      const triple = s.slice(i, i + 3) === c.repeat(3)
      const q = triple ? c.repeat(3) : c
      // f-string 的 {} 插值里可能是真代码,但拆词法代价大于收益 ⇒ 整段照遮,宁可漏不误报。
      let j = i + q.length
      while (j < n) {
        if (s[j] === '\\') {
          j += 2
          continue
        }
        if (!triple && s[j] === '\n') break // 单引号串不跨行(跨行是语法错,不该由本门判)
        if (s.slice(j, j + q.length) === q) {
          j += q.length
          break
        }
        if (out[j] !== '\n') out[j] = ' '
        j++
      }
      i = j
      continue
    }
    i++
  }
  return out.join('')
}

/**
 * 把一份 .py 清单收成"在位性索引":路径集 + 全部祖先目录集(命名空间包 PEP 420 也算在位)。
 * 一张面只建一次,逐文件复用 —— 旧实现每个文件都重算一遍祖先目录集(1500 个文件 × 全集),
 * 加了锚点面之后是两份,不收成索引就是白烧一倍。
 */
export function buildFaceIndex(faceFiles) {
  const set = faceFiles instanceof Set ? faceFiles : new Set(faceFiles ?? [])
  const dirs = new Set()
  for (const k of set) {
    let d = dirname(norm(k))
    while (d && d !== '.' && d !== '/') {
      dirs.add(d)
      d = dirname(d)
    }
  }
  return { set, dirs }
}

const asIndex = (faceFiles) =>
  faceFiles && faceFiles.set instanceof Set && faceFiles.dirs instanceof Set
    ? faceFiles
    : buildFaceIndex(faceFiles)

/** 判一个文件 ⇒ 缺失 / 未判定 / 非本仓计数 / 本仓检查数。 */
export function scanFile(rel, src, faceFiles, ctx = LEGACY_CTX) {
  const { set: faceSet, dirs } = asIndex(faceFiles)
  const missing = []
  const undetermined = []
  let foreign = 0
  let checked = 0
  // 判据面 = **遮掉字符串内部**的那一份(行号/长度不变);注释另按行首 `#` 跳。
  const maskedLines = maskPythonStrings(src).split('\n')
  const rawLines = String(src).split('\n')
  // 动态导入结构上看不见目标 ⇒ 逐处点名成"未判定"。少了这一维就是"没判"被读成"判过了"。
  rawLines.forEach((l, i) => {
    const t = l.trimStart()
    if (t.startsWith('#')) return
    if (DYN_RE.test(maskedLines[i] ?? ''))
      undetermined.push(`${rel}:${i + 1} 动态导入 ⇒ 本门不判其目标在位性`)
  })
  for (let i = 0; i < maskedLines.length; i++) {
    const raw = maskedLines[i] ?? ''
    if (raw.trimStart().startsWith('#')) continue
    const p = parseImport(raw, rel, ctx)
    if (p.kind === 'none') continue
    if (p.kind === 'escape') {
      undetermined.push(`${rel}:${i + 1} 相对导入逃出被审根(${raw.trim().slice(0, 60)})⇒ 判不出`)
      continue
    }
    if (p.kind === 'other') {
      foreign++
      continue
    }
    // D-P2:同一个顶层名可能在**多个根**下(如仓根 scripts/ 与 apps/ai-service/scripts/)。
    // 任一候选在位即算在位(取最宽的一条,防假红);一条都不在位才判缺失 —— 静默放过才是真危险。
    const cands = (p.bases ? p.bases : [p.base]).map((b) =>
      [b, ...p.parts].filter(Boolean).join('/'),
    )
    checked++
    if (!cands.some((cand) => modulePresent(faceSet, cand, dirs)))
      missing.push({ file: rel, line: i + 1, mod: cands[0], cands, star: !!p.star })
  }
  return { missing, undetermined, foreign, checked }
}

/**
 * 「这个模块在不在**被审面**上」要在**候选面全集**上判,而"本轮扫哪几个文件"只看**本轮改动集**。
 * 这两条纪律(票 G-1058652)现在由 `openFace()`(全集)+ main 里的 `scoped(diff --cached …)`(问责范围)
 * 分别承担;旧那两份"按 PY_ROOT 限子树"的清单取法已删 —— 同一件事留两份实现必然漂移(§0.6)。
 */

// ── 面取材包(D-P1:被审面与锚点面走同一条通道,两面各自建自己的在位性全集)────────────
/** 整仓清单的 git 参数(不带 pathspec —— 在位性全集不再限 PY_ROOT)。 */
const FACE_ALL_ARGS = {
  head: ['ls-tree', '-r', '--name-only', '-z', 'HEAD'],
  staged: ['ls-files', '--cached', '-z'],
  worktree: ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
}
const revAllArgs = (rev) => ['ls-tree', '-r', '--name-only', '-z', rev]
const splitZ = (out) => [
  ...new Set(
    String(out)
      .split('\0')
      .map((s) => norm(s.trim()))
      .filter(Boolean),
  ),
]

/**
 * 被审引用是提交还是树?取不到 ⇒ null(由调用方落"未判定",不猜)。
 * 走 `rev-parse --verify <rev>^{commit|tree}` 而**不是** `cat-file -t`:后者是"读对象"的动词形态,
 * 会被守门 118 的散写探针算成"自己派生 git 取内容"(它守的是"内容取哪个面",而这里只问对象类型);
 * rev-parse 属于提交图/枚举类调用,层里的口径把它算作 no-content(见 face-reader 的 GIT_ENUM_ONLY_CALL_RE)。
 */
export function revKindOf(rev, root = ROOT, git = (a, r, o = {}) => gitRaw(a, r, o)) {
  const ok = (spec) => {
    try {
      return (
        String(
          git(['rev-parse', '--verify', '--quiet', spec], root, { timeout: GIT_TIMEOUT_MS }) ?? '',
        ).trim() !== ''
      )
    } catch {
      return false
    }
  }
  if (ok(`${rev}^{commit}`)) return 'commit'
  if (ok(`${rev}^{tree}`)) return 'tree'
  return null
}

/**
 * 打开一张面:一次整仓清单 → .py 全集 + pyproject 声明 → 分类上下文 → 导入方正文。
 * **清单与内容同面同轮**(§0.4):所有 readMany 走的都是同一张面(rev 引用或索引/工作树),
 * 任何一格取不到都由调用方折成"未判定",绝不回落另一张面。
 */
export function openFace({
  face = 'head',
  rev = null,
  root = ROOT,
  git = (a, r, o = {}) => gitRaw(a, r, o),
  cat = (r, revs, o = {}) => catBatch(r, revs, o),
} = {}) {
  const args = rev ? revAllArgs(rev) : FACE_ALL_ARGS[face]
  if (!args) throw new Error(`未知判定面 ${String(face)}`)
  const all = splitZ(git(args, root, { timeout: GIT_TIMEOUT_MS, maxBuffer: 1 << 26 }))
  const allSet = new Set(all)
  const pyAll = all.filter((p) => p.endsWith('.py'))
  const pjPaths = all.filter((p) => p.endsWith('pyproject.toml'))
  const specOf = (p) =>
    rev ? `${rev}:${p}` : face === 'staged' ? `:${p}` : face === 'head' ? `HEAD:${p}` : null
  const readMany = (paths) => {
    const want = [...new Set(paths)].filter((p) => allSet.has(p))
    if (face === 'worktree' && !rev) {
      const out = new Map()
      for (const p of want) out.set(p, readWorktreeFile(root, p))
      return out
    }
    return cat(root, want.map(specOf), { timeout: GIT_TIMEOUT_MS, maxBuffer: 1 << 28 })
  }
  const textOf = (map, p) => {
    const v = face === 'worktree' && !rev ? map.get(p) : map.get(specOf(p))
    return v === undefined ? null : v
  }
  // 声明根:被审面上的 pyproject 事实 + 内置下限(BUILTIN_ROOT_PACKAGES,只加不减)。
  const rootSpecs = [...BUILTIN_ROOT_PACKAGES]
  const unparsed = []
  const unreadable = []
  if (pjPaths.length) {
    const m = readMany(pjPaths)
    for (const p of pjPaths) {
      const text = textOf(m, p)
      if (text === null) {
        unreadable.push(p)
        continue
      }
      const parsed = parsePyprojectPackages(p, text)
      if (!parsed) continue
      if (parsed.unparsed) unparsed.push(p)
      if (parsed.packages.length || !parsed.unparsed)
        rootSpecs.push({
          root: parsed.root,
          packages: parsed.packages,
          source: p,
          unparsed: parsed.unparsed,
        })
    }
  }
  const ctx = buildFaceCtx({ pyPaths: pyAll, rootSpecs })
  // 仓根('.')作为声明根时前缀是空串 —— 写成 `./` 会让这一族文件**永远进不了射程**而账面自称"扫过了"。
  const inScope = (p) => ctx.rootDirs.some((r) => p.startsWith(r === '.' ? '' : `${r}/`))
  return {
    face,
    rev,
    all,
    pyAll,
    index: buildFaceIndex(pyAll),
    ctx,
    unparsed,
    unreadable,
    inScope,
    readMany,
    textOf,
    specOf,
    label: rev ? `${rev}(${revKindOf(rev, root, git)} 对象面)` : face,
  }
}

/**
 * D-P1 的核心一行:各档的**棘轮锚点面**。
 *   全量档 = `HEAD^`(缺省档正是旁路落地复跑/CI/check:all 走的那一档 —— 锚点若取被审面自身,
 *            `cap` 恒等于本轮缺失数,结构上一行红都判不出来,见头注 D-P1 的现跑实证);
 *   `--rev` 档 = 被审提交的首个父提交(与守门 98 的 G-815985 契约同形,可被 `--anchor` 覆写);
 *   `--staged` / `--worktree` = `HEAD`(提交者视角的"本次");
 *   `stockOnly`(staged 空档回退成全量存量审计那一支)= null ⇒ 同面自比,**只报存量**,
 *            因为那一档的口径本来就是"与本次提交无关,不得挡路"(镜像 T5 的契约)。
 * 镜像测试 T8 的"摘掉即翻绿"就是把下面这行的 `'HEAD^'` 换回 `'HEAD'` 再跑同一枚落地夹具。
 */
export function anchorRevFor({ face, rev = null, anchorOpt = null, stockOnly = false }) {
  if (stockOnly) return null
  if (anchorOpt) return anchorOpt
  if (rev) return `${rev}^`
  if (face === 'head') return 'HEAD^'
  return 'HEAD'
}

function selfTest() {
  let pass = 0
  let fail = 0
  const t = (name, cond, extra = '') => {
    if (typeof cond === 'function') {
      fail++
      console.log(`❌ ${name} —— cond 是函数 ⇒ 断言从未求值(应写成 (() => {...})())`)
      return
    }
    if (cond) {
      pass++
      console.log(`✅ ${name}`)
    } else {
      fail++
      console.log(`❌ ${name}${extra ? ` —— ${extra}` : ''}`)
    }
  }
  const A = 'apps/ai-service/app/services/mcp_server.py'
  const set = new Set([A, 'apps/ai-service/app/core/x.py'])
  const s1 = (src, files = set, rel = A) => scanFile(rel, src, [...files])
  t(
    'P1 绝对导入指向未入库的包 ⇒ 缺失(本票立项那一型)',
    s1('from app.services.sandbox import Engine\n').missing.length === 1,
  )
  t('P2 指向已入库模块 ⇒ 放过', s1('from app.services.mcp_server import X\n').missing.length === 0)
  t(
    'P3 第三方/标准库不判也不报未判定(建表必然腐烂)',
    (() => {
      const r = s1('from fastapi import APIRouter\nimport os\n')
      return r.missing.length === 0 && r.undetermined.length === 0 && r.foreign === 2
    })(),
  )
  t(
    'P4 相对导入按当前包解析(同级 ⇒ services/)',
    (() => {
      const r = s1('from .sandbox import Engine\n')
      return r.missing.length === 1 && r.missing[0].mod === 'apps/ai-service/app/services/sandbox'
    })(),
  )
  t(
    'P5 同级已入库的相对导入不误伤',
    (() => {
      const files = new Set([A, 'apps/ai-service/app/services/models.py'])
      return s1('from .models import M\n', files).missing.length === 0
    })(),
  )
  t(
    'P6 逃出被审根的相对导入 ⇒ 未判定(不猜也不判红)',
    (() => {
      const r = s1('from ....outside import Y\n', set, 'apps/ai-service/app/core/x.py')
      return r.missing.length === 0 && r.undetermined.some((u) => /逃出被审根/.test(u))
    })(),
  )
  t('P7 注释里的 import 不判', s1('# from app.services.sandbox import E\n').missing.length === 0)
  t(
    'P8 from x import * 的模块仍要求能定位',
    (() => {
      const r = s1('from app.services.sandbox import *\n')
      return r.missing.length === 1 && r.missing[0].star === true
    })(),
  )
  t(
    'P9 __init__.py 视为包在位',
    (() => {
      const files = new Set([A, 'apps/ai-service/app/services/sandbox/__init__.py'])
      return s1('from app.services.sandbox import Engine\n', files).missing.length === 0
    })(),
  )
  t(
    'P10 动态 import 必须报名,不得静默算通过',
    (() => {
      const r = s1('import importlib\nm = importlib.import_module("app.services.sandbox")\n')
      return r.undetermined.some((u) => /动态导入/.test(u))
    })(),
  )
  t(
    'P11 命名空间包(目录有 .py 而无 __init__.py)在 Python 3 合法 ⇒ 不得判缺失',
    (() => {
      const files = new Set([A, 'apps/ai-service/app/middleware/llm_metrics.py'])
      return s1('from app.middleware import llm_metrics\n', files).missing.length === 0
    })(),
  )
  t(
    'P12 写在 docstring / 三引号里的示例 import 不判(否则门把自己的测试当仓库违规)',
    (() => {
      const src =
        'def f():\n    """用例文本:\n\n    from app.ghostmod import guard\n    """\n    return 1\n'
      return s1(src).missing.length === 0
    })(),
  )
  t(
    'P12b 同一形态写在真代码里必须命中(遮字符串关掉的是误报,不是判据)',
    (() => {
      return s1('from app.ghostmod import guard\n').missing.length === 1
    })(),
  )
  // ── D-P2「本仓 vs 外部」按被审面事实判 ────────────────────────────────────────
  const SDK = 'packages/sdk/python/ihui_ai/client.py'
  const sdkFiles = [A, 'apps/ai-service/app/core/x.py', SDK, 'packages/sdk/python/ihui_ai/base.py']
  const sdkCtx = buildFaceCtx({
    pyPaths: sdkFiles,
    rootSpecs: [
      ...BUILTIN_ROOT_PACKAGES,
      {
        root: 'packages/sdk/python',
        packages: ['ihui_ai'],
        source: 'packages/sdk/python/pyproject.toml',
      },
    ],
  })
  const s2 = (src, rel, files = sdkFiles) => scanFile(rel, src, buildFaceIndex(files), sdkCtx)
  t(
    'P13 被审面声明的第二分发包(SETUPTOOLS find)里的绝对导入 ⇒ 缺失要判(新增覆盖面)',
    s2('from ihui_ai.ghost import X\n', SDK).missing.length === 1,
  )
  t(
    'P14 同一形态在旧口径(写死 app. 前缀)下被静默放过 —— 反向锁:这条测的就是新维真的在咬',
    scanFile(SDK, 'from ihui_ai.ghost import X\n', sdkFiles).missing.length === 0,
  )
  t(
    'P15 面上事实(根下真有该顶层目录)也算本仓:scripts. 前缀的绝对导入要判',
    (() => {
      const files = [...sdkFiles, 'apps/ai-service/scripts/ok.py']
      const ctx = buildFaceCtx({ pyPaths: files, rootSpecs: [...BUILTIN_ROOT_PACKAGES] })
      return (
        scanFile(A, 'from scripts.ghost_tool import X\n', buildFaceIndex(files), ctx).missing
          .length === 1
      )
    })(),
  )
  t(
    'P16 同一顶层名落在多个根下:任一候选在位即算在位(取最宽,防假红)',
    (() => {
      const files = [...sdkFiles, 'apps/ai-service/scripts/ok.py']
      const ctx = buildFaceCtx({
        pyPaths: files,
        rootSpecs: [
          ...BUILTIN_ROOT_PACKAGES,
          { root: '.', packages: [], source: 'builtin-implicit' },
        ],
      })
      return (
        scanFile(A, 'from scripts.ok import X\n', buildFaceIndex(files), ctx).missing.length === 0
      )
    })(),
  )
  t(
    'P17 标准库/第三方即便与仓内目录同名也不误伤:声明之外的顶层名一律放过',
    s2('import json\nfrom httpx import Client\n', SDK).foreign === 2 &&
      s2('import json\nfrom httpx import Client\n', SDK).missing.length === 0,
  )
  t(
    'P18 pyproject 三条声明形态各解析出顶层包名;认不出数组 ⇒ unparsed 报名(不静默当"没有本仓包")',
    (() => {
      const h = parsePyprojectPackages(
        'apps/ai-service/pyproject.toml',
        '[tool.hatch.build.targets.wheel]\npackages = ["app"]\n',
      )
      const f = parsePyprojectPackages(
        'packages/sdk/python/pyproject.toml',
        '[tool.setuptools.packages.find]\nwhere = ["."]\ninclude = ["ihui_ai*"]\n',
      )
      const p = parsePyprojectPackages(
        'x/pyproject.toml',
        '[tool.setuptools]\npackages = ["a", "a.b"]\n',
      )
      const bad = parsePyprojectPackages(
        'y/pyproject.toml',
        '[tool.setuptools]\npackages = not-an-array\n',
      )
      const none = parsePyprojectPackages('z/pyproject.toml', '[project]\nname = "z"\n')
      return (
        h.root === 'apps/ai-service' &&
        h.packages.join('|') === 'app' &&
        f.packages.join('|') === 'ihui_ai' &&
        p.packages.join('|') === 'a' &&
        bad.unparsed === true &&
        none === null
      )
    })(),
  )
  t(
    'P19 相对导入逃出**第二个**根也落未判定(逃逸边界跟着根集走,不是只认 PY_ROOT)',
    (() => {
      const r = s2('from ....outside import Y\n', 'packages/sdk/python/ihui_ai/modules/x.py')
      return r.missing.length === 0 && r.undetermined.some((u) => /逃出被审根/.test(u))
    })(),
  )
  t(
    'P20 锚点面分派:全量=父提交 / --rev=被审提交首父 / staged=HEAD / 回退存量档=null',
    (() => {
      return (
        anchorRevFor({ face: 'head' }) === 'HEAD^' &&
        anchorRevFor({ face: 'head', rev: 'abc123' }) === 'abc123^' &&
        anchorRevFor({ face: 'head', rev: 'abc123', anchorOpt: 'def456' }) === 'def456' &&
        anchorRevFor({ face: 'staged' }) === 'HEAD' &&
        anchorRevFor({ face: 'worktree' }) === 'HEAD' &&
        anchorRevFor({ face: 'head', stockOnly: true }) === null
      )
    })(),
  )
  return { pass, fail }
}

function main(argv) {
  if (argv.includes('--self-test')) {
    const { pass, fail } = selfTest()
    console.log(`\n[py-import-landed] 自检 ${pass} 通过 / ${fail} 失败`)
    return fail > 0 ? 1 : 0
  }
  // ── 旗标:取值一律走共享出口,坏值当场未判定,绝不静默退回默认面(G-322 / §0.4)──
  const revFlag = requireFlagValue(argv, '--rev', { noun: '被审提交或树对象' })
  const anchorFlag = requireFlagValue(argv, '--anchor', { noun: '棘轮锚点引用' })
  for (const f of [ROOT_FLAG, revFlag, anchorFlag]) {
    if (f.error) {
      console.error(`❌ 用法错 ⇒ 未判定:${f.error}`)
      return 2
    }
  }
  const first = (e) => String(e?.message ?? e).split(String.fromCharCode(10))[0]
  if (ROOT_FLAG.present) {
    if (!existsSync(ROOT)) {
      console.error(
        `❌ 无法判定:--root 实得 ${JSON.stringify(ROOT_FLAG.value)} 的目录不存在 ⇒ 不静默回落到脚本位置自推导`,
      )
      return 2
    }
    try {
      assertRepoRoot(ROOT, '--root 指定的被审仓根')
    } catch (e) {
      console.error(`❌ 无法判定:${first(e)}`)
      return 2
    }
  }
  const sel = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  if (sel.error) {
    console.error(`❌ ${sel.error}`)
    return 2
  }
  let face = sel.face
  const rev = revFlag.value ?? null
  const git = (a, r, o = {}) => gitRaw(a, r ?? ROOT, o)
  if (rev && face !== 'head') {
    console.error(
      '❌ --rev 与 --staged/--worktree 不得同用:判定面只能有一个(取哪一面都会让另一面成为假绿)',
    )
    return 2
  }
  if (rev) {
    const kind = revKindOf(rev, ROOT, git)
    if (!kind) {
      console.error(
        `❌ 无法判定:--rev ${rev} 既不是提交也不是树对象 ⇒ 被审面取不到(不记绿也不冒红)`,
      )
      return 2
    }
    if (kind === 'tree' && !anchorFlag.value) {
      console.error(
        `❌ 无法判定:--rev ${rev} 是树对象,没有父提交可当棘轮锚点 ⇒ 必须显式给 --anchor <提交>(与守门 98 的 --rev 契约同形)`,
      )
      return 2
    }
  }

  let audited
  try {
    audited = openFace({ face, rev, root: ROOT, git })
  } catch (e) {
    console.error(`❌ 无法判定:清单取不到(${first(e)})`)
    return 2
  }
  /** 射程 = 落在某个声明根下的 .py;教学/夹具树(FIXTURE_PY)是**故意写坏**的样例,不当仓库违规。 */
  const scoped = (list) =>
    list.filter((p) => p.endsWith('.py') && !FIXTURE_PY.test(p) && audited.inScope(p))
  if (audited.pyAll.length === 0) {
    console.error(`❌ 枚举到 0 个 .py(判定面=${audited.label})⇒ 判据失明,不记通过`)
    return 2
  }
  // 问责范围:staged 档只看本次改动集(G-1058652:它**不得**被拿去判在位性),其余档 = 面上全部射程内 .py。
  let importers
  let stockOnly = false
  if (face === 'staged' && !rev) {
    try {
      importers = scoped(
        splitZ(
          git(['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR'], ROOT, {
            timeout: GIT_TIMEOUT_MS,
            maxBuffer: 1 << 26,
          }),
        ),
      )
    } catch (e) {
      console.error(`❌ 无法判定:本次改动集清单取不到(${first(e)})`)
      return 2
    }
    // 「新增但没 git add」必须**单独说一句**,不能和「本次没有 .py」并成一句(G-1058652)。
    // 只报名不判红:漏暂存是"还没提交",不是"提交了坏东西";共享工作树里常年有别人在飞的未跟踪 .py,
    // 判红就是一台与提交者无关的恒红门 ⇒ 逼人 --no-verify,链上全门作废(§12e)。
    try {
      const unstaged = scoped(
        splitZ(
          git(['ls-files', '--others', '--exclude-standard', '-z'], ROOT, {
            timeout: GIT_TIMEOUT_MS,
            maxBuffer: 1 << 26,
          }),
        ),
      )
      if (unstaged.length)
        console.log(
          `[py-import-landed] ℹ 报名(不判红):工作树另有 ${unstaged.length} 个射程内的 .py **未 git add** ⇒ 不在索引面,不会随本次提交入库,本门看不见它们。若本该提交,先 git add 再跑本门。`,
        )
    } catch {
      // 这一句是纯报名,取不到不该把主判据拖死(清单与在位性全集已各自独立取过)。
    }
    // --staged 在"本次没有射程内的 .py"时**回退全量并喊出来**,不得判死:文档/前端类提交结构上不带
    // Python 文件,判它空扫就是替每一次无关提交挡路(§12e)。回退档的锚点=被审面自身 ⇒ **只报存量**。
    if (importers.length === 0) {
      console.log(
        '[py-import-landed] --staged:索引面上没有射程内的 .py 改动 ⇒ 回退 HEAD 全量(只报存量,不判"无法判定")。',
      )
      face = 'head'
      stockOnly = true
      try {
        audited = openFace({ face, rev: null, root: ROOT, git })
      } catch (e) {
        console.error(`❌ 无法判定:回退清单取不到(${first(e)})`)
        return 2
      }
      importers = scoped(audited.pyAll)
    }
  } else {
    importers = scoped(audited.pyAll)
  }
  if (importers.length === 0) {
    console.error(`❌ 枚举到 0 个 .py(判定面=${audited.label})⇒ 判据失明,不记通过`)
    return 2
  }
  let contents
  try {
    contents = audited.readMany(importers)
  } catch (e) {
    console.error(`❌ 无法判定:内容取不到(${first(e)})`)
    return 2
  }
  const missing = []
  const undetermined = []
  let foreign = 0
  let scanned = 0
  for (const f of importers) {
    const src = audited.textOf(contents, f)
    if (src === null) {
      undetermined.push(`${f}(内容取不到,不回退另一个面)`)
      continue
    }
    scanned++
    const r = scanFile(f, src, audited.index, audited.ctx)
    missing.push(...r.missing)
    undetermined.push(...r.undetermined)
    foreign += r.foreign
  }
  // 一枚正文都没读到 ⇒ "扫过了"是假的:判据失明,不记通过也不冒红(§0.3)。
  if (scanned === 0) {
    console.error(
      `❌ 无法判定:射程内 ${importers.length} 个 .py 的正文一个都取不到(判定面=${audited.label})`,
    )
    return 2
  }
  // D-P2 的输入完备性:pyproject 认出段名却解析不出顶层包名 / 正文取不到 ⇒ 逐条落**未判定**并计数,
  // 绝不静默当成"这一族没有本仓包"(那正是"没判"被读成"判过了")。
  for (const u of audited.unparsed)
    undetermined.push(`${u}:声明根解析不出顶层包名 ⇒ 该根只按面上目录事实判,可能少判`)
  for (const u of audited.unreadable)
    undetermined.push(`${u}:被审面上取不到正文 ⇒ 该分发包根的声明未参与判定`)

  // ── D-P1:棘轮锚点面(全量档 = 父提交;--rev = 被审提交首父;staged/worktree = HEAD)──────
  // 锚点面**整张取不到** ⇒ 按 0 计并大声报名(方向取最严,与 G-1058652 的"新增文件没有自身基线"同档),
  // 不 exit 2 也不静默降成存量档:exit 2 会让浅克隆环境把整道门变成永久未判定,而降成存量档等于
  // "取不到输入 ⇒ 判通过"(§0.3 禁止的方向)。被审面取不到仍是 exit 2(上面已判死)。
  const anchorRev = anchorRevFor({ face, rev, anchorOpt: anchorFlag.value, stockOnly })
  let anchor = null
  const anchorBlind = []
  if (anchorRev) {
    try {
      anchor = openFace({ rev: anchorRev, root: ROOT, git })
    } catch (e) {
      anchorBlind.push(`锚点面 ${anchorRev} 整张取不到(${first(e)})⇒ 棘轮基线按 0 计(方向取最严)`)
    }
  }
  const involved = [...new Set(missing.map((m) => m.file))]
  let anchorContents = new Map()
  if (anchor && involved.length) {
    try {
      anchorContents = anchor.readMany(involved)
    } catch (e) {
      anchor = null
      anchorBlind.push(
        `锚点面 ${anchorRev} 的涉事正文取不到(${first(e)})⇒ 棘轮基线按 0 计(方向取最严)`,
      )
    }
  }
  const violations = []
  const stock = []
  // 「本文件在锚点面上不存在」单独一档,**既不进未判定也不进缺失**(G-1058652 第②段):
  // 它是新增文件的**定义后果**,cap=0、方向取最严,判据一步没松。
  const anchorNotes = [...anchorBlind]
  for (const file of involved) {
    const mine = missing.filter((m) => m.file === file)
    let cap = 0
    if (!anchor) {
      if (stockOnly)
        cap = mine.length // 存量档(staged 空改动回退):同面自比 ⇒ 只报存量
      else
        anchorNotes.push(
          `${file}(锚点面 ${anchorRev} 上无自身基线 ⇒ 棘轮基线按 0 计;新增文件的定义后果,不是判据失明)`,
        )
    } else {
      const a = anchor.textOf(anchorContents, file)
      if (a === null || a === undefined) {
        anchorNotes.push(
          `${file}(${anchorRev} 面上无此文件 ⇒ 棘轮基线按 0 计;这是新增文件的定义后果,不是判据失明)`,
        )
      } else {
        // 锚点面的缺失数必须按**锚点面自己的全集**数(G-1058652 的镜像方向):旧实现拿被审面全集去数锚点,
        // 于是"本次删掉了承载模块、导入方一行没动"被读成 cap=mine ⇒ 删除方向同样是瞎的。
        cap = scanFile(file, a, anchor.index, anchor.ctx).missing.length
      }
    }
    if (mine.length > cap) violations.push(...mine)
    else if (mine.length) stock.push({ file, count: mine.length, cap })
  }
  const und = undetermined
  // 在位性全集与锚点面的名字都要说出来 —— 判红结论的指向全靠它(含糊说"被审面"会把"本轮改动集"
  // 读成"面",于是一个其实在 HEAD 上的模块被读成"没入库",G-1058652 的假红读法)。
  const universeName = rev
    ? `${rev} 对象面全集(整仓 .py)`
    : face === 'staged'
      ? '索引面全集(整仓已入库 .py)'
      : face === 'worktree'
        ? '工作树面全集'
        : 'HEAD 面全集'
  const anchorName = anchor
    ? anchorRev
    : stockOnly
      ? '被审面自身(存量档:只报存量,不判新增)'
      : `${anchorRev}(整张取不到 ⇒ 棘轮基线按 0 计,方向取最严)`
  if (argv.includes('--json')) {
    console.log(
      JSON.stringify(
        {
          face,
          rev,
          universe: universeName,
          anchorFace: anchorName,
          roots: audited.ctx.rootDirs,
          scanned,
          foreign,
          violations,
          stock,
          undetermined: und,
          anchorBaseline: anchorNotes,
        },
        null,
        2,
      ),
    )
  } else {
    console.log(
      `[py-import-landed] 判定面=${face === 'worktree' ? '工作树(仅人工)' : face}${rev ? `(rev=${rev})` : ''}:扫 ${scanned} 个 .py(在位性按${universeName}判·声明根 ${audited.ctx.rootDirs.join(',')})· 棘轮锚点=${anchorName} · 非本仓放过 ${foreign} 条 · 新增判红 ${violations.length} 处 · 存量 ${stock.reduce((a, b) => a + b.count, 0)} 处 · 未判定 ${und.length}`,
    )
    for (const v of violations)
      console.error(
        `  ❌ ${v.file}:${v.line} import ${v.mod} —— 该模块在${universeName}上找不到(干净检出必 ModuleNotFoundError)`,
      )
    for (const s of stock)
      console.log(
        `  · 存量(该文件在 ${anchorName} 上 ${s.cap} 处,本轮不问责):${s.file} ×${s.count}`,
      )
    for (const u of und) console.log(`  ℹ 未判定:${u}`)
    for (const a of anchorNotes) console.log(`  ⚙ 棘轮基线:${a}`)
    if (!violations.length) console.log('✅ 无"import 一个从未入库的模块"的新增。')
    else
      console.log(
        '  出路只有一条:把被 import 的包与实现**同一枚提交**入库(注册与脚本同枚那一课),或去掉这条 import。不得为过门改判据。',
      )
  }
  if (violations.length) return 1
  // --strict 仍因棘轮基线缺项而 exit 2(与改前同,不比改前松):新增文件没有自身基线这件事必须被看见。
  if (argv.includes('--strict') && (und.length > 0 || stock.length > 0 || anchorNotes.length > 0))
    return 2
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exit(main(process.argv.slice(2)))
  } catch (e) {
    console.error(`❌ ${String(e?.message ?? e)}`)
    process.exit(2)
  }
}

export const __test__ = {
  parseImport,
  scanFile,
  modulePresent,
  maskPythonStrings,
  buildFaceIndex,
  buildFaceCtx,
  parsePyprojectPackages,
  topsUnderRoot,
  openFace,
  anchorRevFor,
  revKindOf,
  BUILTIN_ROOT_PACKAGES,
  PY_ROOT,
  PKG,
  selfTest,
}
// 由 watermark.mjs inject 复位隐写行
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
