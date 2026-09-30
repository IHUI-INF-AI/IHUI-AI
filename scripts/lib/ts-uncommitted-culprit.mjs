// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 未提交改动归因:把「工作区全量 tsc 报的错」拆成"谁弄坏的"。
//
// 为什么需要它(2026-09-24 立):push 门(pre-push)与提交门(pre-commit #16)跑的都是
// **工作区**的 tsc,而工作区常年混着并行会话的半编辑态。既有降级判据只按**报错文件**是否
// 落在本次范围内定性 —— 于是这一类必然误伤:
//   packages/ui-react/src/index.ts(在 HEAD 里完好、且在本次推送范围内)报
//   TS2614: Module '"./components/Upload"' has no exported member 'UploadLabels'
// 而真正被删掉 `export interface UploadLabels` 的是**别人未提交**的 Upload.tsx。
// 报错文件在范围内 ⇒ 不降级 ⇒ 门恒红,唯一结局是逼所有人 --no-verify(约 130 道门作废)。
// 实测代价:§22 要求的 lost-commit tag 远端备份被这一条拦掉,积压 206 枚。
//
// 本模块只做**归因**,不做任何取舍;两个方向的门各自决定"归因成立后怎么办":
//   - check-typecheck.mjs(push 门):in-scope 报错的**每一条**都能归因到"脏且不在范围内"
//     的被引用模块 ⇒ 降级放行(推的是提交,不是工作区)。
//   - check-staged-typecheck.mjs(提交门):反向用 —— staged 文件正是别人报错的肇事者时,
//     该错误**算在本任务头上**(堵掉"删掉一个公共导出而全仓没人红"的洞)。
// 所以判据必须单一真相源,两条门各自 import 本文件,不得各抄一份。
//
// 保守边界(宁可不归因,绝不错放):
//   1. 只认**相对**说明符(`./x`、`../x`);包名说明符(@ihui/x、lucide-react)解析到
//      node_modules / tsconfig paths,拿工作区脏清单比对会产出假归因。
//   2. 只对**模块解析类**错误码生效(见 MODULE_BREAK_CODES),语法错/类型不匹配一类
//      与本判据无关,一律不归因。
//   3. 肇事文件必须**同时**满足:在 HEAD 与工作区之间有差异(别人未提交)∧ 不在本次
//      范围(不是我们自己改的)。任一不成立 ⇒ 不归因。

/** 只有这些码是"引用不到 / 对方没导出"这一族,即错误落在**被引用模块**身上 */
export const MODULE_BREAK_CODES = new Set([
  'TS2303', // 循环推断(常由被引用类型消失引发)
  'TS2305', // Module has no exported member
  'TS2306', // not a module
  'TS2307', // Cannot find module
  'TS2310', // used in a type it extends (类型消失)
  'TS2614', // Module has no exported member X, did you mean default import
  'TS2688', // Cannot find type definition file
  'TS2724', // Module has no exported member named X, but does have ...
  'TS2732', // no default export(反向:默认导出被删)
  'TS2792', // Cannot find module(模块解析模式)
])

/** 源文件扩展名:模块说明符不带扩展名,比对时按这些形态试 */
export const SOURCE_EXTS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']

/** 统一斜杠(Windows tsc 会输出反斜杠绝对路径) */
export function norm(p) {
  return String(p).replace(/\\/g, '/')
}

/**
 * 双向后缀匹配:tsc 输出 package 相对路径(src/index.ts),范围清单是 repo 相对路径
 * (packages/ui-react/src/index.ts);mypy/绝对路径则反向。语义与 check-typecheck.mjs
 * 原 isPathInStaged 逐字一致 —— 抽到此处后两边共用同一把尺子。
 */
export function pathInList(file, list) {
  const f = norm(file)
  return (list || []).some((raw) => {
    const s = norm(raw)
    return s === f || s.endsWith('/' + f) || f.endsWith('/' + s)
  })
}

/** 从一条 tsc 错误消息里取出所有**相对**模块说明符(引号可单可双,TS 两种都印) */
export function citedRelativeSpecs(message) {
  const specs = new Set()
  const re = /['"]((?:\.\.?\/)[^'"\n]+)['"]/g
  let m
  while ((m = re.exec(String(message))) !== null) specs.add(norm(m[1]))
  return [...specs]
}

/**
 * 逐行解析 tsc 错误 → { file, code, message, specs }。
 * 不锚定行首:pnpm -r 会加 `packages/ui-react typecheck: ` 前缀,原 extractErrorFiles
 * 也因此用"扩展名 + (行,列):"双锚定。括号路径(app/(main)/x.tsx)必须完整捕获,
 * 否则本该命中的文件匹配不上 → 不安全方向(见 check-typecheck.mjs 样例12 的教训)。
 */
export function parseErrorRecords(output) {
  const recs = []
  const re =
    /([^\s]+?\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs))\((\d+),(\d+)\):\s*error\s+(TS\d+)\s*:\s*([^\n]*)/g
  let m
  const text = norm(String(output || ''))
  while ((m = re.exec(text)) !== null) {
    const message = m[5]
    recs.push({
      file: m[1],
      code: m[4],
      message,
      specs: MODULE_BREAK_CODES.has(m[4]) ? citedRelativeSpecs(message) : [],
    })
  }
  return recs
}

/**
 * 把说明符解析成"不带扩展名的基准路径"(与报错文件同一坐标系:package 相对或 repo 相对
 * 皆可,后续靠后缀匹配)。`./components/Upload` @ `src/index.ts` → `src/components/Upload`;
 * `../utils/x` @ `app/foo/bar.ts` → `app/foo/../utils/x` 归一为 `app/utils/x`。
 */
export function resolveSpecToBase(errFile, spec) {
  const dir = norm(errFile).includes('/') ? norm(errFile).split('/').slice(0, -1).join('/') : ''
  const joined = dir ? `${dir}/${norm(spec)}` : norm(spec)
  const out = []
  for (const seg of joined.split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') {
      if (out.length && out[out.length - 1] !== '..') out.pop()
      else out.push('..')
      continue
    }
    out.push(seg)
  }
  return out.join('/')
}

/**
 * 基准路径是否命中候选清单里的某个源文件:同名文件 + 目录的 index 形态都算。
 * 命中返回该候选路径(供上层打印证据),否则 null。
 */
export function baseHitsList(base, list) {
  const b = norm(base).replace(/^\.\//, '')
  for (const raw of list || []) {
    const p = norm(raw)
    const ext = SOURCE_EXTS.find((e) => p.endsWith(e))
    if (!ext) continue
    const stripped = p.slice(0, -ext.length)
    if (stripped === b || stripped.endsWith('/' + b)) return p
    // 目录型模块:`./x` 也可能指向 x/index.tsx —— stripped 已去掉扩展名,故这里比对 '/index'
    if (stripped.endsWith('/index')) {
      const asDir = stripped.slice(0, -'/index'.length)
      if (asDir === b || asDir.endsWith('/' + b)) return p
    }
  }
  return null
}

/**
 * 归因主函数:把 records 拆成"能归因到他人未提交改动"与"不能"。
 *
 * @param {object} o
 * @param {Array<{file:string,code:string,message:string,specs:string[]}>} o.records  parseErrorRecords 的产物
 * @param {string[]} o.scopeFiles  本次范围(提交门传 staged 清单,push 门传 push-scope)
 * @param {string[]} o.dirtyFiles  HEAD↔工作区有差异的跟踪文件(未提交改动)
 * @returns {{ byFile:Map<string,Array>, excused:Map<string,string[]>, unexcused:string[], allExcused:boolean, anyError:boolean }}
 *   excused:报错文件 → 该文件每条错误各自找到的肇事路径(全部命中才算);
 *   unexcused:至少有一条错误归因不掉的报错文件(维持阻塞的那些)。
 */
export function attributeModuleBreakage({ records, scopeFiles, dirtyFiles }) {
  const dirtyNotInScope = (dirtyFiles || []).filter((d) => !pathInList(d, scopeFiles || []))
  const byFile = new Map()
  for (const r of records || []) {
    if (!byFile.has(r.file)) byFile.set(r.file, [])
    byFile.get(r.file).push(r)
  }
  const excused = new Map()
  const unexcused = []
  for (const [file, recs] of byFile.entries()) {
    const culprits = []
    let allAttributable = true
    for (const r of recs) {
      let hit = null
      if (MODULE_BREAK_CODES.has(r.code)) {
        for (const spec of r.specs) {
          const base = resolveSpecToBase(file, spec)
          const cand = baseHitsList(base, dirtyNotInScope)
          if (cand) {
            hit = cand
            break
          }
        }
      }
      if (!hit) {
        allAttributable = false
        break
      }
      culprits.push(hit)
    }
    if (allAttributable && culprits.length > 0) excused.set(file, [...new Set(culprits)])
    else unexcused.push(file)
  }
  return {
    byFile,
    excused,
    unexcused,
    allExcused: byFile.size > 0 && unexcused.length === 0,
    anyError: byFile.size > 0,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
