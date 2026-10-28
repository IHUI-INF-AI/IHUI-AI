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
 * 棘轮锚点 = **该文件在 HEAD 面自身的缺失数**,所以本机这一处存量只报数、新增才红
 * (存量当场判红就是一台与提交者无关的恒红门,唯一结局是逼人 --no-verify,§12e)。
 *
 * 手动:`node scripts/check-python-import-landed.mjs [--staged|--worktree|--json|--strict|--self-test]`
 * **定级(2026-10-05 接线当轮)**:**已接提交链,blocking**,应急跳过变量 `HUSKY_SKIP_PYTHON_IMPORT_LANDED`
 * (名字与 runner 注册条目逐字同形 —— 写了没人读的变量就是假逃生舱,守门 172 判的那一型)。
 * 接线的三条前置都已满足:① §22c 镜像 6 例在位(含临时仓端到端"注入必红 / 补齐必绿"双向锁);
 * ② HEAD 面存量已由「该文件 HEAD 自身缺失数」棘轮兜住 —— 补上"命名空间包(PEP 420)"与"遮 Python 字符串内部"
 * 两维判据后,当轮现读存量 9 → **1**(那 1 处是 hook_engine 里 `try: import … except ImportError: 降级并记日志`
 * 的**已声明可选依赖**,属正当写法,只报数不判红,所以接线不新增任何恒红面);
 * ③ 注册条目与门体、镜像、文档点名**同枚入库**(守门 89 的 R2/R4 与 README 表格门那一课:
 * 指向不存在脚本的注册 = 干净检出上整批门被打断)。
 */
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
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
 * 每个面取 .py 清单的 git 参数 —— **单一出处**,加面必须在这里加一行。
 * `staged` 与 `indexUniverse` 是**两个刻意不同**的行:前者是"本次改动的子集",后者是"索引面全集"。
 * 把它们合成一行就是 G-1058652 那个假红的成因(在位性判据被喂了子集),所以这里分列并各自带理由注释。
 */
const FACE_PY_ARGS = {
  head: ['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', PY_ROOT],
  // 本次改动集:只用来决定"本轮扫谁"(问责范围),**不得**拿去判在位性。
  staged: ['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR', '--', PY_ROOT],
  // 在位性全集:`--cached` 只认索引面。混入 `--others` 会把未暂存文件读成已入库 ⇒ 反向假绿。
  indexUniverse: ['ls-files', '--cached', '-z', '--', PY_ROOT],
  // worktree 档的清单本身就是全集(已跟踪 + 未跟踪),加 `--exclude-standard` 排掉忽略项。
  worktree: ['ls-files', '--cached', '--others', '--exclude-standard', '--', PY_ROOT],
}

/** 把一条 import 解析成"仓内路径候选"。kind:'abs' 本仓绝对导入 / 'rel' 包内相对 / 'other' 非本仓 / 'escape' 判不出 */
export function parseImport(line, fileRel) {
  const star = STAR_RE.test(line)
  const m = IMPORT_RE.exec(line)
  if (!m) return { kind: 'none' }
  const mod = (m[1] ?? m[2] ?? '').trim()
  if (!mod) return { kind: 'none' }
  if (mod.startsWith('.')) {
    const dots = /^\.+/.exec(mod)[0].length
    const tail = mod.slice(dots)
    // 文件的**所在目录**就是它的包目录(多剥一层会把同级导入算到父目录 —— 自检 P4/P5 钉这条)。
    let dir = dirname(norm(fileRel))
    for (let i = 1; i < dots; i++) {
      dir = dirname(dir)
      // 逃出被审根 ⇒ 这一条判不出,只能报名:不猜路径,也不判红。
      if (dir === '.' || dir === '' || dir === 'apps' || dir === PY_ROOT)
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
  if (parts[0] !== PKG) return { kind: 'other', mod, star }
  // 绝对导入保留 app 段:被审根是 apps/ai-service,包名 app 正是它下面的一层目录。
  // 早先在这里 slice(1) 把 app 剥掉 ⇒ 拼出 apps/ai-service/core/config 这种不存在的路径,
  // 于 HEAD 上凭空造出 2762 处"缺失"—— 一个判据把自己写成恒红机器,靠的正是这种 off-by-one。
  return { kind: 'abs', base: PY_ROOT, parts, star }
}

/** 模块在文件集合里是否存在:`.py` / 包目录的 `__init__.py` / **命名空间包**(PEP 420:目录里有 .py 但没 __init__.py 也合法)。 */
export function modulePresent(set, cand, dirs = null) {
  return (
    set.has(`${cand}.py`) ||
    set.has(`${cand}/__init__.py`) ||
    (dirs !== null && dirs.has(cand))
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

/** 判一个文件 ⇒ 缺失 / 未判定 / 非本仓计数 / 本仓检查数。 */
export function scanFile(rel, src, faceFiles) {
  // 传 Set 或数组都接得住(镜像测试与 main 各自方便);内部只建一次,不逐条 import 重建。
  const faceSet = faceFiles instanceof Set ? faceFiles : new Set(faceFiles)
  // 命名空间包(目录里有 .py 而无 __init__.py)在 Python 3 合法 ⇒ 预先把每个文件的所有祖先目录收进来。
  const dirs = new Set()
  for (const k of faceSet) {
    let d = dirname(norm(k))
    while (d && d !== '.' && d !== '/') {
      dirs.add(d)
      d = dirname(d)
    }
  }
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
    const p = parseImport(raw, rel)
    if (p.kind === 'none') continue
    if (p.kind === 'escape') {
      undetermined.push(
        `${rel}:${i + 1} 相对导入逃出被审根(${raw.trim().slice(0, 60)})⇒ 判不出`,
      )
      continue
    }
    if (p.kind === 'other') {
      foreign++
      continue
    }
    const cand = [p.base, ...p.parts].filter(Boolean).join('/')
    checked++
    if (!modulePresent(faceSet, cand, dirs))
      missing.push({ file: rel, line: i + 1, mod: cand, star: !!p.star })
  }
  return { missing, undetermined, foreign, checked }
}

/** 面上所有 .py(清单面 = 内容面 = 同一轮)。 */
export function facePySet({ face, git = (a, r, o = {}) => gitRaw(a, r, o), root = ROOT }) {
  const out = git(FACE_PY_ARGS[face], root, { timeout: GIT_TIMEOUT_MS, maxBuffer: 1 << 26 })
  const list = face === 'worktree' ? String(out).split('\n') : String(out).split('\0')
  return [...new Set(list.map((s) => norm(s.trim())).filter((f) => f.endsWith('.py')))]
}

/**
 * 「这个模块在不在**被审面**上」要在**候选面全集**上判,而"本轮扫哪几个文件"只看**本轮改动集**。
 *
 * 为什么必须拆成两个集合(G-1058652 的病根就在这里,不是措辞问题):
 *   `--staged` 档的清单是 `git diff --cached --diff-filter=ACMR` = **本次改动的 .py 子集**,
 *   而"被 import 的目标在不在面上"问的是**索引面全集**。早先两者是同一个数组,于是
 *   一条 `from app.core.context_compaction import …` 落在**新增文件**里时,只要
 *   `context_compaction.py` 本次**没被改动**,它就不在那个子集里 ⇒ 在位性判据判它"不在面上",
 *     而它**实测在 HEAD 上**(三重证实:`cat-file -e HEAD:` 三条全成功)。
 *   ⇒ 假红,且是 blocking 档 ⇒ 任何人加任何一个新 .py 都会被挡。
 *   同一形态在 HEAD 档看不见,因为 HEAD 档的清单恰好就是全集(`ls-tree -r HEAD`),
 *   两个集合相等时塌缩看不出来 —— **只在一侧相等时暴露,这正是它长期假绿的原因**。
 *
 * 取全集的两条纪律:① `--staged` 的全集必须带 `--cached`(索引面,不是工作树面 ——
 *   混入未暂存文件会把"还没提交的东西"读成"已入库",反向造出假绿);
 *   ② `worktree` 档的清单本来就是全集(`--cached --others`),不需另取。
 */
function faceUniversePy({ face, git = (a, r, o = {}) => gitRaw(a, r, o), root = ROOT }) {
  // staged 档要索引面全集;head/worktree 两档的 facePySet 已是全集(见上条 ②)。
  if (face !== 'staged') return facePySet({ face, git, root })
  const out = git(FACE_PY_ARGS.indexUniverse, root, { timeout: GIT_TIMEOUT_MS, maxBuffer: 1 << 26 })
  return [...new Set(String(out).split('\0').map((s) => norm(s.trim())).filter((f) => f.endsWith('.py')))]
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
      const src = 'def f():\n    """用例文本:\n\n    from app.ghostmod import guard\n    """\n    return 1\n'
      return s1(src).missing.length === 0
    })(),
  )
  t(
    'P12b 同一形态写在真代码里必须命中(遮字符串关掉的是误报,不是判据)',
    (() => {
      return s1('from app.ghostmod import guard\n').missing.length === 1
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
  const git = (a, r, o = {}) => gitRaw(a, r ?? ROOT, o)
  let files
  try {
    files = facePySet({ face, git })
  } catch (e) {
    console.error(`❌ 无法判定:清单取不到(${String(e?.message ?? e).split('\n')[0]})`)
    return 2
  }
  // 「新增但没 git add」必须**单独说一句**,不能和「本次没有 .py」并成一句(G-1058652)。
  // 早先的回退文案写死"本次没有 apps/ai-service 的 .py",而实况常常是"**有**,只是没进索引"——
  // 这两件事对提交者的含义完全相反(前者:你确实没写 Python;后者:你写的那份**不会随本次提交入库**,
  // 干净检出里根本没有它)。混成一句话 ⇒ 漏 git add 这条真实风险被读成"本次无 Python 改动"。
  // 只**报名不判红**:漏暂存是"还没提交",不是"提交了坏东西";且共享工作树里常年有别人在飞的
  // 未跟踪 .py(现读 12 个),判红就是一台与提交者无关的恒红门 ⇒ 逼人 --no-verify,链上全门作废(§12e)。
  if (face === 'staged') {
    try {
      const unstaged = String(
        git(['ls-files', '--others', '--exclude-standard', '-z', '--', PY_ROOT], ROOT, {
          timeout: GIT_TIMEOUT_MS,
          maxBuffer: 1 << 26,
        }),
      )
        .split('\0')
        .map((s) => norm(s.trim()))
        .filter((f) => f.endsWith('.py'))
      if (unstaged.length)
        console.log(
          `[py-import-landed] ℹ 报名(不判红):工作树另有 ${unstaged.length} 个 apps/ai-service 的 .py **未 git add** ⇒ 不在索引面,不会随本次提交入库,本门看不见它们。若本该提交,先 git add 再跑本门。`,
        )
    } catch {
      // 这一句是纯报名,取不到不该把主判据拖死(上面的清单与在位性全集已各自独立取过)。
    }
  }
  // --staged 在"本次没有 ai-service 的 .py"时**回退全量并喊出来**,不得判死:
  // 文档/脚本/前端类提交结构上不带 Python 文件,判它空扫就是替每一次无关提交挡路;恒挡的唯一结局是逼人 --no-verify
  // 连带链上全部守门作废(§12e;门 135/46 同一课)。回退只作用于清单,内容仍按回退后的那一张面取。
  if (files.length === 0 && face === 'staged') {
    console.log(
      '[py-import-landed] --staged:索引面上没有 apps/ai-service 的 .py 改动 ⇒ 回退 HEAD 全量(只报存量,不判"无法判定")。',
    )
    face = 'head'
    try {
      files = facePySet({ face, git })
    } catch (e) {
      console.error(`❌ 无法判定:回退清单取不到(${String(e?.message ?? e).split(String.fromCharCode(10))[0]})`)
      return 2
    }
  }
  if (files.length === 0) {
    console.error(`❌ 枚举到 0 个 .py(判定面=${face})⇒ 判据失明,不记通过`)
    return 2
  }
  const specOf = (p) => (face === 'staged' ? `:${p}` : `HEAD:${p}`)
  let map = null
  try {
    if (face !== 'worktree')
      map = catBatch(ROOT, files.map(specOf), { timeout: GIT_TIMEOUT_MS, maxBuffer: 1 << 28 })
  } catch (e) {
    console.error(`❌ 无法判定:内容取不到(${String(e?.message ?? e).split('\n')[0]})`)
    return 2
  }
  const read = (p) =>
    face === 'worktree' ? readWorktreeFile(ROOT, p) : (map.get(specOf(p)) ?? null)
  // 在位性全集与本轮改动集**必须分开取**(G-1058652):`files` 是"本轮扫谁",`universe` 才是
  // "被 import 的目标在不在面上"。staged 档两者不相等 —— 早先拿 `files` 判在位性,
  // 于是"目标模块本次没改动"就被读成"不在被审面上",而它实测在 HEAD 上。
  let universe
  try {
    universe = face === 'head' ? files : faceUniversePy({ face, git })
  } catch (e) {
    console.error(`❌ 无法判定:在位性全集取不到(${String(e?.message ?? e).split('\n')[0]})`)
    return 2
  }
  if (universe.length === 0) {
    console.error(`❌ 在位性全集枚举到 0 个 .py(判定面=${face})⇒ 判据失明,不记通过`)
    return 2
  }
  const missing = []
  const undetermined = []
  let foreign = 0
  let scanned = 0
  for (const f of files) {
    const src = read(f)
    if (src === null) {
      undetermined.push(`${f}(内容取不到,不回退另一个面)`)
      continue
    }
    scanned++
    const r = scanFile(f, src, universe)
    missing.push(...r.missing)
    undetermined.push(...r.undetermined)
    foreign += r.foreign
  }
  // 棘轮锚点:涉事文件在 HEAD 面自身的缺失数。锚点**读不出来** ⇒ 按 0 计并大声报名(方向取最严)。
  const involved = [...new Set(missing.map((m) => m.file))]
  let ancMap = new Map()
  // 锚点面整批读不出来 = **真的判不出**(工具/编码/超时),归未判定。
  const anchorUnreadable = []
  if (involved.length) {
    try {
      ancMap =
        face === 'head'
          ? map
          : catBatch(
              ROOT,
              involved.map((p) => `HEAD:${p}`),
              { timeout: GIT_TIMEOUT_MS, maxBuffer: 1 << 28 },
            )
    } catch (e) {
      anchorUnreadable.push(`锚点面整批取不到:${String(e?.message ?? e).split('\n')[0]}`)
    }
  }
  const violations = []
  const stock = []
  // 「本文件在 HEAD 上没有自身锚点」单独一档,**既不进未判定也不进缺失**(G-1058652 第②段)。
  // 为什么必须再拆一层:它是**新增文件的定义后果**,不是判据失明 —— 新增文件必然没有 HEAD 自身版本,
  // 于是 cap=0、本文件里的缺失全是新增,**判据一步没松、方向取最严**。
  // 早先它被塞进"未判定",于是同一条 import 在同一站点同时挂「缺失(判红)」与「未判定」两个**互斥**结论,
  // 读者会把一条完全确定的结论读成"这条判据自己也没底"。这里仍然**大声报名**(只换档位,不吞声),
  // `--strict` 也仍然因它 exit 2(不比改前更松)。
  const anchorNotes = []
  for (const file of involved) {
    const mine = missing.filter((m) => m.file === file)
    const a = face === 'head' ? read(file) : (ancMap.get(`HEAD:${file}`) ?? null)
    let cap = 0
    if (a === null || a === undefined) {
      anchorNotes.push(
        `${file}(HEAD 上无自身锚点 ⇒ 棘轮基线按 0 计;这是新增文件的定义后果,不是判据失明)`,
      )
    } else cap = scanFile(file, a, universe).missing.length
    if (mine.length > cap) violations.push(...mine)
    else if (mine.length) stock.push({ file, count: mine.length, cap })
  }
  const und = [...undetermined, ...anchorUnreadable]
  // 在位性全集的名字要说出来 —— 判红结论的指向全靠它。含糊说"被审面"会让读者以为
  // "本轮改动集"就是"面",于是一个其实在 HEAD 上的模块被读成"没入库"(G-1058652 的假红读法)。
  const universeName =
    face === 'staged'
      ? '索引面全集(已入库的全部 .py)'
      : face === 'worktree'
        ? '工作树面全集'
        : 'HEAD 面全集'
  if (argv.includes('--json')) {
    console.log(
      JSON.stringify(
        {
          face,
          universe: universeName,
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
      `[py-import-landed] 判定面=${face === 'worktree' ? '工作树(仅人工)' : face}:扫 ${scanned} 个 .py(在位性按${universeName}判)· 非本仓放过 ${foreign} 条 · 新增判红 ${violations.length} 处 · 存量 ${stock.reduce((a, b) => a + b.count, 0)} 处 · 未判定 ${und.length}`,
    )
    for (const v of violations)
      console.error(
        `  ❌ ${v.file}:${v.line} import ${v.mod} —— 该模块在${universeName}上找不到(干净检出必 ModuleNotFoundError)`,
      )
    for (const s of stock)
      console.log(`  · 存量(该文件 HEAD 自身 ${s.cap} 处,本轮不问责):${s.file} ×${s.count}`)
    for (const u of und) console.log(`  ℹ 未判定:${u}`)
    // 棘轮基线**单列一档**:它不是"判不出",缺了它读者会把上面那条确定的判红读成可疑(G-1058652)。
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
  facePySet,
  faceUniversePy,
  PY_ROOT,
  PKG,
  selfTest,
}
// 由 watermark.mjs inject 复位隐写行
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
