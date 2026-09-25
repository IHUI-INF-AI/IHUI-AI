#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 守门:「策略/契约的声明必须有非测试消费者」对账(2026-09-26 立,第八批 8F/8A 取证落地票)
//
// 在修什么(本仓最高频失效型:"造好没装车"):
//   1. `apps/cli/src/sessions/state-store.ts` 的 `DEFAULT_MAX_AGE_MS`(7 天会话保留策略)与
//      `pruneOldSessions()` —— 实测全仓零非测试调用方,一条"已声明、从未执行"的保留策略;
//   2. `packages/types/src/tool-contract.ts` 的 `ToolResultBudgetContract` 与契约谓词
//      (`mayWriteWorkspace`/`touchesExternalWorld`)—— 非测试面零 importer(注释提及不算)。
//   这类声明在类型系统、typecheck、lint 里全都不红:写下来 = 看起来存在,执行 = 无人保证。
//   本门把「声明 ↔ 消费者」变成机器事实:**策略/契约一类的声明必须有非测试消费者**。
//
// 判据形态(按本仓实际取,宁窄不误报;判不出的只报数不判红):
//   C1 策略常量:顶层 const/let/var 名含 MAX_AGE / MAXAGE / TTL / RETENTION 族(大写-下划线形态,
//      故 camelCase 的 `artifactRetentionDays` 不误纳;非导出的模块私有常量也立案 ——
//      "已声明、从未执行"最常见就是这种);
//   C2 名字含 `BudgetContract` 的任何顶层声明;
//   C3 `packages/types/src` 里 `export interface|type *Contract(s)`;
//   C4 `packages/types/src` 里 `export function (may|should|must|can|touches|requires)[A-Z]…` 谓词;
//   C5 任意扫描根里 `export function (prune|cleanup|purge|expire|sweep)[A-Z_]…` 清理函数
//      (8F A8F-6:"每个保留策略必须有可指认的触发消费者")。
//
// "接线"的算法(与守门 64/115 同族的收口点):
//   - 消费者 = **生产面文件**(扫描根 apps/*/src + packages/*/src;测试面整面排除:
//     `**/tests?/**`、`**/__tests__/**`、`*.test.*`、`*.spec.*`、`**/e2e/**` —— "组件自带测试
//     会让孤儿全绿"是登记在案的失效型;scripts/ 是工具层,按名扫字符串不算 runtime 消费者);
//   - 引用必须**成链**:消费者要有指向声明方模块的 import 绑定(specifier 能对上声明文件的
//     基名/父目录/所属 `@ihui/<pkg>` 包名),且导入名(或其别名)在 import 语句之外被真的用到;
//     **注释与字符串里的提及一律不算**(本仓"看起来有、其实没装车"最高频形态就是注释提及);
//     文件自己还声明同名符号 ⇒ 不算消费别人的(同名不同物,如 apps/api 也有自己的 listSessions);
//     `export { X } from` 纯 re-export 不算消费者(barrel 不消费)。
//   - **传递闭包**:同文件内"甲的声明体引用了乙"记一条甲→乙边;甲被生产面消费 ⇒ 乙也算被消费。
//     这是保留策略的真实形状:常量喂给 prune 函数、prune 挂在写生命周期点、写入口被命令面 import。
//     没有闭包,"给签名默认值接一处调用"的正常修法会被误判红;有了闭包,它仍拦得住
//     "整条链没有任何外部入口"的死声明 —— 两条变异对照(--self-test M1/M2)分别禁用
//     no-closure 与 no-external-refs 一支,已接线夹具必须从绿退回红,否则那条分支是恒真摆设。
//
// 判据不会恒红(本仓反复付学费换来的一条):存量走**棘轮**,锚点 = 该文件在 HEAD 自身的
// 未接线数 —— 只拦"这次改动把未接线加回来了",不追仓库既有债。与改动无关的 blocking 红
// 只会逼人 `--no-verify`,连带废掉全部守门。
//
// 三种取材口径(同 70/77/83/98/101/103/112/113):
//   缺省(全量)判 HEAD blob(报存量清单,不判红;`--strict` 才按"存在未接线"判红,供 CI 问责);
//   `--staged` 判索引 blob(被审内容判索引、锚点判 HEAD,两面各判一次再逐文件比对);
//   `--worktree` 仅人工逃生舱;`--staged` 与 `--worktree` 同给 ⇒ 判死;
//   任一候选文件内容取不到 ⇒ exit 2「无法判定」(既不冒红也绝不记绿);
//   判定面枚举到 0 个扫描根源文件 ⇒ 判死(空扫不记绿)。
//
// 已知限制(如实登记,不以豁免遮):
//   - specifier 兼容判定只认"文件基名 / 直接父目录 / @ihui/<pkg>"三种链形,更深的 barrel 跳数
//     不追(失误方向是把"已接线"错判成"未接线",由棘轮与全量档只报数兜住);
//   - 类型可达 ≠ 运行时供给:接口字段把某契约类型引到位,闭包会判"已接线"。
//     "工具字面量到底有没有供 contract(含 resultBudget)"由守门 111 按同族判据管,两门互补。
//
// 手动:
//   node scripts/check-declared-policy-has-consumer.mjs                # 全量(HEAD)报存量
//   node scripts/check-declared-policy-has-consumer.mjs --staged       # 提交链(索引 vs HEAD 锚点)
//   node scripts/check-declared-policy-has-consumer.mjs --strict       # 存量问责档(CI)
//   node scripts/check-declared-policy-has-consumer.mjs --self-test    # 判据自检(零副作用)
// 紧急跳过:HUSKY_SKIP_DECLARED_POLICY_CONSUMER=1

import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { Undetermined, assertRepoRoot, catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
/** ROOT 由脚本自身位置推导(§15,不得写死盘符) */
const ROOT = resolve(HERE, '..')

export const SELF_SKIP = 'HUSKY_SKIP_DECLARED_POLICY_CONSUMER'
const GIT_TIMEOUT = 120000
export const FACE_NAME = { head: 'HEAD blob', staged: '索引 blob', worktree: '工作树(逃生舱)' }

/** 声明候选与消费者共用的扫描根:各端/各包的 src 面。scripts/ 是工具层,刻意不入面。 */
const SCAN_ROOT_RE = /^(?:apps|packages)\/[^/]+\/src\//
const SRC_EXT_RE = /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/
/** 测试面:消费判定与候选判定整面排除 */
const TEST_FACE_RE = /(?:^|\/)(?:tests?|__tests__|spec|e2e)\/|\.test\.[^/]+$|\.spec\.[^/]+$/

export function inScanRoot(p) {
  return SCAN_ROOT_RE.test(p) && SRC_EXT_RE.test(p) && !TEST_FACE_RE.test(p)
}

// ==================== 候选声明的形态(C1~C5,宁窄不误报)====================

/** C1 策略常量:大写-下划线族的 MAX_AGE / MAXAGE / TTL / RETENTION */
export function isPolicyConstName(name) {
  return /(?:^|_)(?:MAX_AGE|MAXAGE|TTL|RETENTION)(?:_|$)/.test(name)
}
/** C2 名字含 BudgetContract 的任何顶层声明 */
export function isBudgetContractName(name) {
  return name.includes('BudgetContract')
}
/** C3 packages/types 里以 Contract/Contracts 结尾的导出类型 */
export function isContractTypeName(name, rel, exported) {
  return exported && rel.startsWith('packages/types/src/') && /Contracts?$/.test(name)
}
/** C4 packages/types 里情态动词开头的导出谓词函数 */
export function isPredicateFnName(name, rel, exported) {
  return (
    exported &&
    rel.startsWith('packages/types/src/') &&
    /^(?:may|should|must|can|touches|requires)[A-Z]/.test(name)
  )
}
/** C5 任意扫描根里清理族导出函数(prune/cleanup/purge/expire/sweep 前缀 + 紧跟大写/下划线/结尾) */
export function isCleanupFnName(name, exported) {
  return exported && /^(?:prune|cleanup|purge|expire|sweep)(?:[A-Z_]|$)/.test(name)
}

export function candidateKinds(name, rel, exported) {
  const kinds = []
  if (isPolicyConstName(name)) kinds.push(exported ? 'policy-const' : 'policy-const-module-private')
  if (isBudgetContractName(name)) kinds.push('budget-contract')
  if (isContractTypeName(name, rel, exported)) kinds.push('contract-type')
  if (isPredicateFnName(name, rel, exported)) kinds.push('predicate-fn')
  if (isCleanupFnName(name, exported)) kinds.push('cleanup-fn')
  return kinds
}

// ==================== 遮噪(两层,方向不同,不可混用 —— 同守门 118 的告诫)====================

/**
 * 第一层:遮注释、遮**模板串内容**,但保留 ' / " 字符串内容 —— import specifier 本身就是
 * 字符串,这一层还要从里面取路径。模板整段遮掉:模块说明符在语法上不可能是模板,
 * "从模板里长出 import 语句"必是伪引用,必须让它不可见(方向:只会少判引用,
 * 而本门最怕的恰是"错判已接线"的假绿)。
 */
export function maskCommentsKeepStrings(text) {
  const out = text.split('')
  const blank = (a, b) => {
    for (let i = Math.max(0, a); i < b && i < out.length; i++) if (out[i] !== '\n') out[i] = ' '
  }
  let i = 0
  while (i < text.length) {
    const c = text[i]
    const d = text[i + 1]
    if (c === '/' && d === '/') {
      let j = i
      while (j < text.length && text[j] !== '\n') j++
      blank(i, j)
      i = j
      continue
    }
    if (c === '/' && d === '*') {
      let j = i + 2
      while (j < text.length && !(text[j] === '*' && text[j + 1] === '/')) j++
      const close = j < text.length ? j + 2 : text.length
      blank(i, close)
      i = close
      continue
    }
    if (c === '"' || c === "'") {
      let j = i + 1
      while (j < text.length && text[j] !== c && text[j] !== '\n') {
        if (text[j] === '\\') j++
        j++
      }
      i = Math.min(j + 1, text.length)
      continue
    }
    if (c === '`') {
      let j = i + 1
      let depth = 0
      while (j < text.length) {
        if (text[j] === '\\') {
          j += 2
          continue
        }
        if (text[j] === '$' && text[j + 1] === '{') {
          depth++
          j += 2
          continue
        }
        if (text[j] === '}' && depth > 0) {
          depth--
          j++
          continue
        }
        if (depth === 0 && text[j] === '`') break
        if (text[j] !== '\n') out[j] = ' '
        j++
      }
      i = Math.min(j + 1, text.length)
      continue
    }
    i++
  }
  return out.join('')
}

/** 第二层:遮掉字符串/模板**内容**(保留引号与行结构)。用于标识符取用统计与行级声明扫描。 */
export function blankStringContents(text) {
  const out = text.split('')
  const blank = (a, b) => {
    for (let i = Math.max(0, a); i < b && i < out.length; i++) if (out[i] !== '\n') out[i] = ' '
  }
  let i = 0
  while (i < text.length) {
    const c = text[i]
    if (c === '"' || c === "'") {
      let j = i + 1
      while (j < text.length && text[j] !== c && text[j] !== '\n') {
        if (text[j] === '\\') j++
        j++
      }
      blank(i + 1, Math.min(j, text.length))
      i = Math.min(j + 1, text.length)
      continue
    }
    if (c === '`') {
      let j = i + 1
      let depth = 0
      while (j < text.length) {
        if (text[j] === '\\') {
          j += 2
          continue
        }
        if (text[j] === '$' && text[j + 1] === '{') {
          depth++
          j += 2
          continue
        }
        if (text[j] === '}' && depth > 0) {
          depth--
          j++
          continue
        }
        if (depth === 0) {
          if (text[j] === '`') break
          if (text[j] !== '\n') out[j] = ' '
        }
        j++
      }
      i = Math.min(j + 1, text.length)
      continue
    }
    i++
  }
  return out.join('')
}

// ==================== 单文件解析(声明 / import 绑定 / 同文件引用边)====================

// 子句不得跨 `import`/`export`/`;`:旧写法 `[\s\S]*?` 会从一条语句"爬"到下一条的 from,
// 把中间的顶层声明整段遮蔽成 clause 区 —— 调试 C2 夹具时实测到(Tool 接口行被吞,
// 消费者判 0)。遮蔽区一旦吞掉声明行,方向是"漏候选"(漏报),但更糟的是它也会吞掉
// import 绑定本身让已接线被误判未接线 —— 两种错向都不可接受,故子句封死在单条语句内。
const CLAUSE_RE = /(?:^|[\s;}])(import|export)\s+((?:(?!import\b)(?!export\b)[^;])*?)\s*from\s*['"]([^'"]+)['"]/g
const TOP_DECL_RES = [
  /^(?:export\s+)?(?:default\s+)?(?:declare\s+)?(?:abstract\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)/,
  /^(?:export\s+)?(?:declare\s+)?(?:const|let|var)\s+([A-Za-z0-9_$]+)/,
  /^(?:export\s+)?(?:declare\s+)?class\s+([A-Za-z0-9_$]+)/,
  /^(?:export\s+)?(?:declare\s+)?(?:interface|type|enum)\s+([A-Za-z0-9_$]+)/,
]
const IDENT_RE = /[A-Za-z0-9_$]+/g

/**
 * 解析一个源文件(注释见文件头"接线算法"):
 *  - decls:   顶层声明 [{name, exported, line(0 基)}]
 *  - imports: import 绑定 [{imported, local, spec}];`export … from` 是转出不是消费,
 *             收进 reExports(只为把它从取用面遮掉,永不作消费者证据);
 *  - uses:    在 import/export-from 语句区域之外出现过的标识符集合;
 *  - edges:   同文件引用边 host→ref(某顶层声明的"行域"里出现的其他顶层声明名;自引用不成边)。
 *            接口成员行(`budget: XxxContract`)天然落在宿主接口的行域里 ⇒ 类型引用与函数
 *            调用同形处理,不再单写一套。
 */
export function parseFile(rel, text) {
  const noComments = maskCommentsKeepStrings(text)
  const imports = []
  const reExports = []
  const masked = noComments.split('')
  CLAUSE_RE.lastIndex = 0
  let m
  while ((m = CLAUSE_RE.exec(noComments))) {
    const kind = m[1]
    const clause = m[2]
    const spec = m[3]
    const blankTo = m.index + m[0].length
    for (let k = m.index; k < blankTo && k < masked.length; k++) if (masked[k] !== '\n') masked[k] = ' '
    const braces = /\{([^}]*)\}/.exec(clause)
    const target = kind === 'export' ? reExports : imports
    if (braces) {
      for (const raw of braces[1].split(',')) {
        const piece = raw.trim().replace(/^type\s+/, '')
        if (!piece || piece === 'default') continue
        const asM = /^([A-Za-z0-9_$]+)\s+as\s+([A-Za-z0-9_$]+)$/.exec(piece)
        if (asM) target.push({ imported: asM[1], local: asM[2], spec })
        else if (/^[A-Za-z0-9_$]+$/.test(piece)) target.push({ imported: piece, local: piece, spec })
      }
    } else if (kind === 'import' && /^[A-Za-z0-9_$]+$/.test(clause.trim())) {
      imports.push({ imported: 'default', local: clause.trim(), spec })
    }
  }
  const code = blankStringContents(masked.join(''))
  const lines = code.split('\n')
  const decls = []
  for (let li = 0; li < lines.length; li++) {
    for (const re of TOP_DECL_RES) {
      const dm = re.exec(lines[li])
      if (dm) {
        decls.push({ name: dm[1], exported: /^\s*export\s/.test(lines[li]), line: li })
        break
      }
    }
  }
  const declNames = new Set(decls.map((d) => d.name))
  const uses = new Set()
  const edges = new Map()
  for (const d of decls) edges.set(d.name, new Set())
  for (let li = 0; li < lines.length; li++) {
    let host = null
    for (const d of decls) {
      if (d.line <= li) host = d.name
      else break
    }
    if (!host) continue
    IDENT_RE.lastIndex = 0
    let t
    while ((t = IDENT_RE.exec(lines[li]))) {
      const name = t[0]
      uses.add(name)
      if (declNames.has(name) && name !== host) edges.get(host).add(name)
    }
  }
  return { rel, decls, declNames, imports, reExports, uses, edges }
}

// ==================== specifier 兼容判定(引用必须指向声明方那一条模块链)====================

function basenameNoExt(p) {
  const seg = p.split('/').pop() || ''
  return seg.replace(/\.[^.]+$/, '')
}
function parentDir(p) {
  const segs = p.split('/')
  return segs.length >= 2 ? segs[segs.length - 2] : ''
}

/**
 * 消费者 G 的 import specifier 能否"来自"声明文件 F:
 *  - F 在 packages/<pkg>/ 下且 spec 是 `@ihui/<pkg>`(或其子路径);
 *  - spec 含 F 的文件基名(state-store / tool-contract);
 *  - F 的直接父目录名(≠src/app)以路径段形态出现在 spec 里(`../sessions/index.js` 这类 barrel)。
 * 判不出 ⇒ 不兼容。失误方向是把"已接线"错判成"未接线"(更严),由棘轮锚点与全量档只报数
 * 兜住 —— 绝不反向:让注释/伪链当消费者,才是本门要拦的那一型。
 */
export function specCompat(spec, declFile) {
  if (!spec) return false
  const pkg = /^packages\/([^/]+)\//.exec(declFile)
  if (pkg && (spec === `@ihui/${pkg[1]}` || spec.startsWith(`@ihui/${pkg[1]}/`))) return true
  if (spec.includes(basenameNoExt(declFile))) return true
  const pd = parentDir(declFile)
  if (pd && pd !== 'src' && pd !== 'app') {
    const esc = pd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (new RegExp(`(?:^|[/.])${esc}/`).test(spec)) return true
  }
  return false
}

// ==================== 聚合判定(judge = 纯函数;自检与镜像测试都构造输入)====================

/**
 * @param files Map<rel, text|null> —— 同一判定面的全部扫描根源文件(清单与内容同面同轮)
 * @param opts { face?, mutate: null|'no-external-refs'|'no-closure' } —— mutate 是**变异对照
 *   专用**通道:各禁用一支判据,已接线夹具必须退回未接线,证明两支判据都不是恒真摆设。
 */
export function judge(files, opts = {}) {
  const mutate = opts.mutate || null
  const parsed = new Map()
  const undetermined = []
  let scanned = 0
  for (const [rel, text] of files) {
    if (!inScanRoot(rel)) continue
    scanned++
    if (typeof text !== 'string') {
      undetermined.push(`${rel}: ${FACE_NAME[opts.face] || '判定面'} 取不到内容`)
      continue
    }
    parsed.set(rel, parseFile(rel, text))
  }
  if (scanned === 0) {
    return {
      scanned: 0,
      candidates: [],
      unwired: [],
      perFile: {},
      byKind: {},
      undetermined: ['判定面枚举到 0 个扫描根源文件 —— 空扫不记绿'],
    }
  }

  // 1) 候选声明
  const candidates = []
  const candidateFiles = new Set()
  for (const p of parsed.values()) {
    for (const d of p.decls) {
      const kinds = candidateKinds(d.name, p.rel, d.exported)
      if (!kinds.length) continue
      candidates.push({ file: p.rel, name: d.name, line: d.line + 1, kinds })
      candidateFiles.add(p.rel)
    }
  }

  // 2) 只对"候选文件里的顶层名"建消费者反向表(候选名 ∪ 中间名)
  const relevantNames = new Set()
  for (const f of candidateFiles) for (const d of parsed.get(f).decls) relevantNames.add(d.name)
  const bindingsOf = new Map() // name → [{file, local, spec}]
  for (const p of parsed.values()) {
    for (const b of p.imports) {
      if (!relevantNames.has(b.imported)) continue
      if (!bindingsOf.has(b.imported)) bindingsOf.set(b.imported, [])
      bindingsOf.get(b.imported).push({ file: p.rel, local: b.local, spec: b.spec })
    }
  }
  const declaringFilesOf = new Map() // name → [声明它的文件]
  for (const p of parsed.values()) {
    for (const d of p.decls) {
      if (!relevantNames.has(d.name)) continue
      if (!declaringFilesOf.has(d.name)) declaringFilesOf.set(d.name, [])
      declaringFilesOf.get(d.name).push(p.rel)
    }
  }

  // 3) 种子:有生产面消费者的 (name, file)
  const connected = new Set() // `name\u0000file`
  if (mutate !== 'no-external-refs') {
    for (const [name, declFiles] of declaringFilesOf) {
      const bindings = bindingsOf.get(name) || []
      if (!bindings.length) continue
      for (const F of declFiles) {
        let hit = false
        for (const b of bindings) {
          if (b.file === F) continue
          const G = parsed.get(b.file)
          if (!G) continue
          if (G.declNames.has(name)) continue // 同名自声明不是消费别人的
          if (!specCompat(b.spec, F)) continue
          if (G.uses.has(name) || (b.local !== name && G.uses.has(b.local))) {
            hit = true
            break
          }
        }
        if (hit) connected.add(`${name}\u0000${F}`)
      }
    }
  }

  // 4) 传递闭包:被消费的宿主,其声明体引用到的同文件符号也算被消费(反复扩张到不动点)
  if (mutate !== 'no-closure') {
    let grew = true
    while (grew) {
      grew = false
      for (const f of candidateFiles) {
        const p = parsed.get(f)
        if (!p) continue
        for (const [host, refs] of p.edges) {
          if (!connected.has(`${host}\u0000${f}`)) continue
          for (const r of refs) {
            const k = `${r}\u0000${f}`
            if (!connected.has(k)) {
              connected.add(k)
              grew = true
            }
          }
        }
      }
    }
  }

  const unwired = candidates.filter((c) => !connected.has(`${c.name}\u0000${c.file}`))
  const perFile = {}
  const byKind = {}
  for (const u of unwired) {
    perFile[u.file] = (perFile[u.file] || 0) + 1
    for (const k of u.kinds) byKind[k] = (byKind[k] || 0) + 1
  }
  return { scanned: parsed.size, candidates, unwired, perFile, byKind, undetermined }
}

/**
 * 棘轮 + 退出码聚合(纯函数;自检/镜像测试靠构造输入证明有牙)。
 * 优先级:无法判定(2)> 判红(1)> 通过(0)。
 *  - mode 'staged':某文件索引面未接线数 > 其 HEAD 面自身未接线数 ⇒ 红(新增即拦,存量不追);
 *  - mode 'full':只报数;`strict` 档把"存在任何未接线"记红(CI 问责面,提交链不用它)。
 */
export function decide({ stagedCounts = {}, headCounts = {}, mode = 'full', undetermined = [], strict = false }) {
  if (undetermined.length) return { exit: 2, reds: [], undetermined, mode }
  const reds = []
  const files = new Set([...Object.keys(stagedCounts), ...Object.keys(headCounts)])
  for (const f of [...files].sort()) {
    const now = stagedCounts[f] || 0
    if (mode === 'staged') {
      const anchor = headCounts[f] || 0
      if (now > anchor) reds.push({ file: f, now, anchor })
    } else if (strict && now > 0) {
      reds.push({ file: f, now, anchor: 0 })
    }
  }
  return { exit: reds.length ? 1 : 0, reds, undetermined, mode }
}

export function listFace(root, face) {
  if (face === 'head')
    return gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '-z'], root, { timeout: GIT_TIMEOUT }).split('\0').filter(Boolean)
  return gitRaw(['ls-files', '-z'], root, { timeout: GIT_TIMEOUT }).split('\0').filter(Boolean)
}

/** 一次 `cat-file --batch` 预取整个面;worktree 面逐盘读(仅逃生舱)。 */
export function readFace(root, face, paths) {
  const map = new Map()
  if (!paths.length) return map
  if (face === 'worktree') {
    for (const p of paths) map.set(p, readWorktreeFile(root, p))
    return map
  }
  const rev = face === 'staged' ? '' : 'HEAD'
  const specs = paths.map((p) => `${rev}:${p}`)
  const got = catBatch(root, specs, { maxBuffer: 1 << 29, timeout: GIT_TIMEOUT })
  for (let i = 0; i < paths.length; i++) map.set(paths[i], got.get(specs[i]) ?? null)
  return map
}

export function analyze(root, face, opts = {}) {
  let effFace = face
  let fellBack = false
  if (face === 'staged') {
    const changed = gitRaw(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], root, { timeout: GIT_TIMEOUT })
      .split('\0')
      .filter(Boolean)
      .filter(inScanRoot)
    if (changed.length === 0) {
      effFace = 'head'
      fellBack = true
    }
  }
  const sources = listFace(root, effFace).filter(inScanRoot)
  if (sources.length === 0)
    throw new Undetermined(`${FACE_NAME[effFace]} 面枚举到 0 个扫描根源文件(apps|packages/*/src 源码) —— 空扫不记绿`)
  const judged = judge(readFace(root, effFace, sources), { face: effFace })
  let headJudged = null
  if (effFace === 'staged') {
    const headSources = listFace(root, 'head').filter(inScanRoot)
    if (headSources.length === 0) throw new Undetermined('HEAD 面枚举到 0 个扫描根源文件 ⇒ 棘轮锚点无从取得(不记绿)')
    headJudged = judge(readFace(root, 'head', headSources), { face: 'head' })
  }
  const mode = effFace === 'staged' ? 'staged' : 'full'
  const decision = decide({
    stagedCounts: judged.perFile,
    headCounts: headJudged ? headJudged.perFile : judged.perFile,
    mode,
    undetermined: [...judged.undetermined, ...(headJudged ? headJudged.undetermined : [])],
    strict: !!opts.strict,
  })
  return { ...decision, judged, face: effFace, fellBack }
}

function unwiredNamesByFile(judged) {
  const m = new Map()
  for (const u of judged.unwired) {
    if (!m.has(u.file)) m.set(u.file, [])
    m.get(u.file).push(u.name)
  }
  return m
}

export function main(argv) {
  const ri = argv.indexOf('--root')
  const root = ri >= 0 && argv[ri + 1] ? resolve(argv[ri + 1]) : ROOT
  assertRepoRoot(root, '本门')
  const { face, error } = selectFace({ staged: argv.includes('--staged'), worktree: argv.includes('--worktree'), def: 'head' })
  if (error) {
    console.error(`❌ 无法判定: ${error}`)
    return 2
  }
  let out
  try {
    out = analyze(root, face, { strict: argv.includes('--strict') })
  } catch (e) {
    const msg = e instanceof Undetermined ? e.message : e?.message ?? String(e)
    console.error(`❌ 无法判定(exit 2): ${msg}`)
    if (!(e instanceof Undetermined)) console.error(e?.stack ?? '')
    return 2
  }
  const { judged } = out
  const namesOf = unwiredNamesByFile(judged)
  if (argv.includes('--json')) {
    console.log(JSON.stringify({ face: out.face, fellBack: out.fellBack, exit: out.exit, mode: out.mode, scanned: judged.scanned, candidates: judged.candidates.length, unwired: judged.unwired, reds: out.reds, undetermined: out.undetermined }, null, 2))
    return out.exit
  }
  if (out.reds.length) {
    console.error(`❌ 检出 ${out.reds.length} 个文件的「策略/契约声明无生产消费者」较 HEAD 增加(面=${FACE_NAME[out.face]},锚点=HEAD 自身未接线数):`)
    for (const r of out.reds)
      console.error(`   ${r.file}  未接线 ${r.now} > 锚点 ${r.anchor} ⇒ 新增 ${r.now - r.anchor} 处: ${(namesOf.get(r.file) || []).join(', ')}`)
    console.error('   出路(二选一,不得留投机代码):① 把该策略/契约挂到真实生命周期点上(读时触发或写前触发,像 state-store 的 pruneOnWrite 那样),让消费者在**非测试生产面**能指认;② 若结构上无处可挂,删掉这条声明并在 PR 说明。禁止为消红去改锚点或给门加豁免。')
  }
  if (out.undetermined.length) {
    console.error(`⚠️  未判定 ${out.undetermined.length} 项(计入 exit 2,不计为通过):`)
    for (const u of out.undetermined.slice(0, 20)) console.error(`   · ${u}`)
  }
  if (out.fellBack) console.log('ℹ️  --staged 暂存集在扫描面内为空 ⇒ 退回全量(HEAD),防"空暂存恒绿"')
  if (out.mode === 'full' && !out.reds.length) {
    console.log(`ℹ️ 存量未接线 ${judged.unwired.length} 处 / ${namesOf.size} 个文件(面=${FACE_NAME[out.face]},只报数不判红;按形态:${Object.entries(judged.byKind).map(([k, v]) => `${k}=${v}`).join(' / ') || '无'})`)
    let i = 0
    for (const [f, names] of namesOf) {
      if (i++ >= 40) {
        console.log(`   ……其余 ${namesOf.size - 40} 个文件略(--json 看全量)`)
        break
      }
      console.log(`   · ${f} × ${names.length}: ${names.slice(0, 6).join(', ')}${names.length > 6 ? ' …' : ''}`)
    }
  }
  const verdict = out.exit === 0 ? '✅ 通过' : out.exit === 2 ? '❌ 无法判定(exit 2)' : '❌ 判红(exit 1)'
  console.log(`${verdict}(面=${FACE_NAME[out.face]} 扫描 ${judged.scanned} 文件 / 候选声明 ${judged.candidates.length} / 未接线 ${judged.unwired.length} / 判红文件 ${out.reds.length} / 未判定 ${out.undetermined.length})`)
  return out.exit
}

// ==================== 判据自检(纯函数 + 构造面,零副作用、不碰仓库)====================

const SS_UNWIRED = [
  'const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;',
  'function ensureStateDir(): void {}',
  'export function saveSession(id: string): void { ensureStateDir(); }',
  'export function pruneOldSessions(maxAgeMs: number = DEFAULT_MAX_AGE_MS): number { return maxAgeMs; }',
  '',
].join('\n')
/** 已接线形态:常量→prune→pruneOnWrite→saveSession,saveSession 被命令面 import 且取用 */
const SS_WIRED = [
  'const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;',
  'function pruneOnWrite(): void { pruneOldSessions(); }',
  'export function saveSession(id: string): void { pruneOnWrite(); }',
  'export function pruneOldSessions(maxAgeMs: number = DEFAULT_MAX_AGE_MS): number { return maxAgeMs; }',
  '',
].join('\n')
const REPL_CONSUMER = [
  "import { saveSession as persist } from '../sessions/state-store.js';",
  'export function loop(): void { persist("x"); }',
  '',
].join('\n')
const TC_SRC = [
  'export interface ResultBudgetContract { bytes: number }',
  'export interface ShapeContract { kind: string }',
  'export interface MountContract { contract?: ShapeContract; budget?: ResultBudgetContract }',
  'export function mayTouchThing(x: unknown): boolean { return !!x }',
  '',
].join('\n')
const TOOL_CONSUMER = [
  "import type { MountContract } from '@ihui/types';",
  'export interface Tool extends MountContract {}',
  '',
].join('\n')

function selfTest() {
  let ran = 0
  let fail = 0
  const eq = (label, got, want) => {
    ran++
    const g = JSON.stringify(got)
    const w = JSON.stringify(want)
    if (g !== w) {
      fail++
      console.log(`  ❌ ${label}\n      got  ${g}\n      want ${w}`)
    } else console.log(`  ✅ ${label}`)
  }
  const uNames = (res) => res.unwired.map((u) => u.name).sort()

  // ① 正向证明 A:真未接线夹具必红(第八批实测:"名单有、从不命中"是门自己的失明形态)
  const rOff = judge(new Map([['apps/cli/src/sessions/state-store.ts', SS_UNWIRED]]))
  eq('W1 未接线夹具 ⇒ pruneOldSessions + DEFAULT_MAX_AGE_MS 双红', uNames(rOff), ['DEFAULT_MAX_AGE_MS', 'pruneOldSessions'])
  // ② 正向证明 B:已接线夹具必绿(闭包链 saveSession→pruneOnWrite→prune→const)
  const rOn = judge(new Map([['apps/cli/src/sessions/state-store.ts', SS_WIRED], ['apps/cli/src/commands/repl.ts', REPL_CONSUMER]]))
  eq('W2 已接线夹具(写生命周期点 + 生产 importer)⇒ 0 未接线', rOn.unwired.length, 0)
  // ③ 变异对照 M1:关掉传递闭包 ⇒ W2 夹具必退回红(证明闭包一支有牙)
  eq('M1 mutate=no-closure ⇒ 已接线夹具仍判 2 处未接线(闭包不是摆设)', uNames(judge(new Map([['apps/cli/src/sessions/state-store.ts', SS_WIRED], ['apps/cli/src/commands/repl.ts', REPL_CONSUMER]]), { mutate: 'no-closure' })), ['DEFAULT_MAX_AGE_MS', 'pruneOldSessions'])
  // ④ 变异对照 M2:关掉外部消费整支 ⇒ 全链失去种子,必红(证明外部引用一支有牙)
  eq('M2 mutate=no-external-refs ⇒ 已接线夹具仍判未接线(外部消费不是摆设)', judge(new Map([['apps/cli/src/sessions/state-store.ts', SS_WIRED], ['apps/cli/src/commands/repl.ts', REPL_CONSUMER]]), { mutate: 'no-external-refs' }).unwired.length, 2)
  // ⑤ 测试面排除
  eq('T1 唯一消费者在 tests/ ⇒ 整面排除,仍判未接线', uNames(judge(new Map([['apps/cli/src/sessions/state-store.ts', SS_UNWIRED], ['apps/cli/tests/s.test.ts', REPL_CONSUMER]]))), ['DEFAULT_MAX_AGE_MS', 'pruneOldSessions'])
  // ⑥ 只 import 不取用 ⇒ 不算消费者
  eq('T2 import 了却从未取用 ⇒ 不算消费者', judge(new Map([['apps/cli/src/sessions/state-store.ts', SS_UNWIRED], ['apps/cli/src/commands/repl.ts', REPL_CONSUMER.replace('persist("x")', '1')]])).unwired.length, 2)
  // ⑦ 注释提及不算消费者(本仓最高频失效型)
  eq('T3 取用只写在注释里 ⇒ 遮噪后不可见,不算消费者', judge(new Map([['apps/cli/src/sessions/state-store.ts', SS_UNWIRED], ['apps/cli/src/commands/repl.ts', REPL_CONSUMER.replace('persist("x")', '// persist("x") 曾经接线')]])).unwired.length, 2)
  // ⑧ 纯 re-export 不算消费者
  eq('T4 barrel 只 `export { saveSession } from …` ⇒ barrel 不消费', judge(new Map([['apps/cli/src/sessions/state-store.ts', SS_UNWIRED], ['apps/cli/src/sessions/index.ts', "export { saveSession } from './state-store.js';\nexport { saveSession } from './state-store.js'\n"]])).unwired.length, 2)
  // ⑨ specifier 链不符 ⇒ 不算消费者(宁严不假绿)
  eq('T5 import 的 specifier 与声明模块无链可寻 ⇒ 不认', judge(new Map([['apps/cli/src/sessions/state-store.ts', SS_UNWIRED], ['apps/cli/src/commands/repl.ts', REPL_CONSUMER.replace('../sessions/state-store.js', '../other/store.js')]])).unwired.length, 2)
  // ⑩ 契约面:MountContract 被 tools 面取用 ⇒ 类型闭包接线;谓词无消费者 ⇒ 单点红
  const rC = judge(new Map([['packages/types/src/tool-contract.ts', TC_SRC], ['apps/cli/src/tools/index.ts', TOOL_CONSUMER]]))
  eq('C1 契约类型经 Mount 闭包接线、谓词 mayTouchThing 零消费者 ⇒ 只剩它红', uNames(rC), ['mayTouchThing'])
  const rC2 = judge(new Map([['packages/types/src/tool-contract.ts', TC_SRC], ['apps/cli/src/tools/index.ts', TOOL_CONSUMER + "import { mayTouchThing } from '@ihui/types';\nexport function gate(x: unknown): boolean { return mayTouchThing(x) }\n"]]))
  eq('C2 谓词补上生产消费者 ⇒ 0 未接线', rC2.unwired.length, 0)
  // ⑪ 形态收录边界:非导出清理函数 / camelCase 保留量 / scripts 层不立案
  eq('K1 非导出的 pruneZombie 与 artifactRetentionDays 都不是候选', judge(new Map([['apps/x/src/y.ts', 'function pruneZombie(): void {}\nconst artifactRetentionDays = 7\nexport function useIt(): void {}\n']])).unwired.length, 0)
  eq('K2 大写族命中:CACHE_TTL_MS 是候选(policy-const)', judge(new Map([['apps/api/src/z.ts', 'export const CACHE_TTL_MS = 100\n']])).unwired.map((u) => u.kinds[0]), ['policy-const'])
  eq('K3 scripts/ 与测试路径都不入扫描面', [inScanRoot('scripts/check-x.mjs'), inScanRoot('apps/web/src/a.tsx'), inScanRoot('apps/cli/tests/a.test.ts'), inScanRoot('packages/types/src/tool-contract.ts')], [false, true, false, true])
  // ⑫ specCompat 的三种链形
  eq('S1 @ihui/<pkg> 对 packages/<pkg>/src/** 兼容;父目录段/基名兼容;无关路径不兼容', [specCompat('@ihui/types', 'packages/types/src/tool-contract.ts'), specCompat('../sessions/index.js', 'apps/cli/src/sessions/state-store.ts'), specCompat('../other/store.js', 'apps/cli/src/sessions/state-store.ts')], [true, true, false])
  // ⑬ 棘轮四向(staged vs HEAD 锚点)
  eq('R1 staged 2 > 锚点 1 ⇒ 红(新增即拦)', decide({ stagedCounts: { 'f.ts': 2 }, headCounts: { 'f.ts': 1 }, mode: 'staged' }).exit, 1)
  eq('R2 齐平 ⇒ 绿(存量不追)', decide({ stagedCounts: { 'f.ts': 1 }, headCounts: { 'f.ts': 1 }, mode: 'staged' }).exit, 0)
  eq('R3 减到 0 ⇒ 绿(只减不增)', decide({ stagedCounts: {}, headCounts: { 'f.ts': 3 }, mode: 'staged' }).exit, 0)
  eq('R4 新文件带未接线(锚点缺省=0)⇒ 红', decide({ stagedCounts: { 'g.ts': 1 }, headCounts: {}, mode: 'staged' }).exit, 1)
  // ⑭ 空扫与未判定:判据失明不得表现为"通过"
  eq('E1 空扫(0 个扫描根源文件)⇒ undetermined ⇒ decide exit 2(空扫不记绿)', (() => {
    const r = judge(new Map([['README.md', 'x'], ['scripts/foo.mjs', 'x']]))
    return decide({ stagedCounts: r.perFile, mode: 'full', undetermined: r.undetermined }).exit
  })(), 2)
  eq('E2 全量档默认不判存量红(防恒红);--strict 才问责', [decide({ stagedCounts: { 'f.ts': 2 }, mode: 'full' }).exit, decide({ stagedCounts: { 'f.ts': 2 }, mode: 'full', strict: true }).exit], [0, 1])
  // ⑮ 遮噪两层的反向对照:模板里不得长出 import
  eq('N1 模板串内的伪 import 不被认成消费者', judge(new Map([['apps/cli/src/sessions/state-store.ts', SS_UNWIRED], ['apps/cli/src/commands/repl.ts', 'export function loop(): string { return "x"; }\nconst noise = `${saveSession}`;\n']])).unwired.length, 2)

  console.log(fail ? `\n❌ 自检 ${fail}/${ran} 例失败` : `\n全部 ${ran} 例通过(正向证明双夹具 + 双变异对照 + 测试面/re-export/注释/specifier 四排除 + 契约闭包 + 棘轮四向 + 空扫判死)`)
  process.exit(fail ? 1 : 0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) {
    selfTest()
  } else if (process.env[SELF_SKIP] === '1' && !argv.includes('--force')) {
    console.log(`⏭️  已跳过(${SELF_SKIP}=1):策略/契约消费者对账门未执行`)
    process.exit(0)
  } else {
    try {
      process.exit(main(argv))
    } catch (e) {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    }
  }
}

export const __test__ = {
  inScanRoot,
  isPolicyConstName,
  isBudgetContractName,
  candidateKinds,
  maskCommentsKeepStrings,
  blankStringContents,
  parseFile,
  specCompat,
  judge,
  decide,
  listFace,
  readFace,
  analyze,
  SELF_SKIP,
  FACE_NAME,
  FIXTURES: { SS_UNWIRED, SS_WIRED, REPL_CONSUMER, TC_SRC, TOOL_CONSUMER },
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
