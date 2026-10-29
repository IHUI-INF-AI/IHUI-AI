// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * outbound-route-registrations.mjs — 「对侧到底注册了哪些路径」的唯一实现(Fastify + FastAPI 两套形态)。
 *
 * 从 outbound-route-facts 里再拆出来只为守住守门 11e 的单文件行数上限;两层的分工是:
 * facts = 词法与判据(遮噪/扫描/推导/匹配),本层 = **挂载图**(入口 → 前缀拼接 → 完整路径集合)。
 * 与 facts 一样:不读任何被审内容,输入是 `Map<relPath, text>`,由守门侧按判定面喂进来。
 *
 * O87g 第①步(2026-10-26):提取式从「只认 `server.get('/x')` 与 `.route({url})` 两形态」扩到
 * **helper 注册形态**(工厂调用点 + 模板/矩阵/裸标识符实参 + 模板前缀子树)。判据本体一律 import
 * `route-registration-extract.mjs` 的导出实现(AGENTS §0.6 单一真相源 —— 「什么算工厂」「模板怎么展开」
 * 全仓只许一份),本层只补「把它接进本层挂载图语义」这一段 glue。**只增不减**:既有产出(含通配 `*`
 * 与文件级前缀并集那些粗口径)一条不动,新读到的只 union 进来;读不到的形态逐条点名进 `unresolved`
 * (§0.3 没判不许写成判过),绝不静默当成「该路由不存在」。把判据换成精确挂载图是第②步的事,不在本层。
 */

import { dirname } from 'node:path'
import {
  countOf,
  FASTAPI_ENTRY,
  FASTIFY_ENTRY,
  INSTANCE,
  VERBS,
  escapeRe,
  joinPrefix,
  lineOf,
  maskComments,
  normSegs,
  normalizePosix,
} from './outbound-route-facts.mjs'
import {
  MODULE_FN,
  analyzeTsFile as analyzeGraphTsFile,
  collectFactoryNames,
  describeFactory,
  expandTemplatePath,
  extraPrefix,
  extractMatrixArrays,
  extractPathConsts,
  findMatrixLoops,
  instantiateFactoryReg,
  parsePathArg,
  pickExisting as pickGraphExisting,
  scanFactoryCalls,
  splitTopLevelArgs,
} from './route-registration-extract.mjs'

/** 本层认得的实例接收者集合(与 `TS_ROUTE_RE` 的 `INSTANCE` 同源,不另列清单) */
const OUTBOUND_INSTANCE = new Set(INSTANCE.split('|'))

/* ----------------------------- 注册面:Fastify ----------------------------- */

export const TS_ROUTE_RE = new RegExp(
  `\\b(?:${INSTANCE})\\.(?:${VERBS.join('|')})\\s*(?:<[^()]{0,200}>)?\\s*\\(\\s*['"\`](/[^'"\`]*)['"\`]`,
  'g',
)
export const TS_ROUTE_OBJ_RE = /\.route\s*\(\s*\{([\s\S]{0,300}?)\}\s*\)/g
export const TS_REGISTER_RE = new RegExp(`\\b(?:${INSTANCE})\\.register\\s*\\(`, 'g')
/**
 * 只吃**一条** import 语句:子句里不得再出现 `from`,否则一条非相对 import(如 `from 'fastify'`)
 * 会把后面的相对 import 一起吞掉 —— 实测 server.ts 就是这样让整棵 Fastify 挂载图走不动的。
 */
export const TS_IMPORT_RE = /\bimport\s+((?:(?!\bfrom\b)[\s\S])*?)\s+from\s*['"](\.[^'"]*)['"]/g

/** TS 单文件解析:路由字面量 + 挂载边(register / 直调) + 相对 import 目标 */
export function analyzeTsFile(rel, srcRaw) {
  const src = maskComments(srcRaw, 'ts')
  const dir = dirname(rel)
  const routes = []
  const edges = []
  const opaque = new Set()
  const imports = new Map()
  /** 本层读不到的 register 形态登记位置,由走图侧逐条点名(未判定 ≠ 不存在) */
  const inlineSubtrees = []
  const templatePrefixSkipped = []
  let m
  while ((m = TS_IMPORT_RE.exec(src)) !== null) {
    const clause = m[1]
    const target = normalizePosix(`${dir}/${m[2].replace(/\.jsx?$/, '')}`)
    const named = /\{([^}]*)\}/.exec(clause)
    if (named) {
      for (const raw of named[1].split(',')) {
        const parts = raw.trim().split(/\s+as\s+/)
        const local = (parts[1] || parts[0] || '').trim().replace(/^type\s+/, '')
        if (local) imports.set(local, target)
      }
    }
    const head = clause.trim().replace(/^type\s+/, '')
    if (!head.startsWith('{') && !head.startsWith('*')) {
      const def = /^([A-Za-z_$][\w$]*)/.exec(head)
      if (def) imports.set(def[1], target)
    }
  }
  while ((m = TS_ROUTE_RE.exec(src)) !== null) routes.push({ path: m[1], line: lineOf(src, m.index) })
  while ((m = TS_ROUTE_OBJ_RE.exec(src)) !== null) {
    const u = /url\s*:\s*['"]([^'"]*)['"]/.exec(m[1])
    if (u) routes.push({ path: u[1], line: lineOf(src, m.index) })
  }
  TS_REGISTER_RE.lastIndex = 0
  while ((m = TS_REGISTER_RE.exec(src)) !== null) {
    const args = readArgs(src, m.index + m[0].length - 1)
    const pre = /prefix\s*:\s*['"`]([^'"`]*)['"`]/.exec(args)
    if (/^\s*(?:async\s*)?\(/.test(args)) {
      // 内联箭头子树:里面的路由挂在别名实例上,本层不追 ⇒ 有前缀就记不透明,不猜
      if (pre) opaque.add(pre[1])
      // 先前这一支 `continue` 得悄无声息(§0.3:没判不能写成判过)。现登记位置,由走图侧逐条点名。
      inlineSubtrees.push({ at: m.index, prefix: pre ? pre[1] : '' })
      continue
    }
    const sym = /^\s*(?:await\s+)?([A-Za-z_$][\w$]*)/.exec(args)
    const tpl = /prefix\s*:\s*`([^`]*)`/.exec(args)
    if (tpl && !tpl[1].includes('${')) {
      // 反引号但**无插值** = 定值前缀。旧式一律把它当「模板前缀」整棵子树丢掉(既不读也不报名),
      // 现按字面前缀走正常边 —— 纯增量,不影响任何既有产出。
      if (sym) edges.push({ symbol: sym[1], prefix: tpl[1] })
      continue
    }
    if (/prefix\s*:\s*[`{]/.test(args)) {
      opaque.add('/__template_prefix__')
      const at = m.index + m[0].length - 1
      if (sym && tpl) {
        // 票面点名的第二族「模板前缀子树」:前缀由 `${…}` 拼出 ⇒ 先前缀解不出、子树整棵隐身。
        // 现按同文件字符串常量 / 矩阵展开解前缀(解得出 ⇒ 成真边;解不出 ⇒ 不透明出口原样保留)。
        edges.push({ symbol: sym[1], prefix: '', prefixTemplate: tpl[1], at })
      } else {
        templatePrefixSkipped.push({ at: m.index, detail: tpl ? tpl[1] : 'prefix: {…}(表达式拼出的前缀)' })
      }
      continue
    }
    if (!sym) continue
    edges.push({ symbol: sym[1], prefix: pre ? pre[1] : '' })
  }
  const direct = new RegExp(`(?:^|[;\\n])\\s*([A-Za-z_$][\\w$]*)\\s*\\(\\s*(?:${INSTANCE})\\s*\\)`, 'g')
  while ((m = direct.exec(src)) !== null) {
    if (['if', 'for', 'while', 'switch', 'catch', 'return'].includes(m[1])) continue
    edges.push({ symbol: m[1], prefix: '' })
  }
  return { routes, edges, imports, opaque, dir, src, inlineSubtrees, templatePrefixSkipped }
}

/** 从 `(` 的下标起做括号配平,返回实参文本 */
export function readArgs(src, openIdx) {
  let depth = 0
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === '(') depth += 1
    else if (src[i] === ')') {
      depth -= 1
      if (depth === 0) return src.slice(openIdx + 1, i)
    }
  }
  return src.slice(openIdx + 1)
}

/**
 * 沿 Fastify 挂载图从入口走一遍。解析不到目标(第三方插件 / 动态符号 / 文件不在面上)
 * ⇒ 带前缀的记不透明(命中它算未判定),无前缀的进 unresolved 清单打印。
 *
 * O87g 第①步新增的两层都挂在**这个循环里**,且都是 union:
 *  - `analyzeHelperForms`:工厂(helper)调用点、模板/矩阵/裸标识符实参 ⇒ 往 `paths` 补具体路径;
 *  - 模板前缀边(`edge.prefixTemplate`):前缀按同文件常量/矩阵展开 ⇒ 解得出才成真边,解不出照旧不透明。
 */
export function buildFastifyRegistrations(files) {
  const paths = new Set()
  const opaque = new Set()
  const unresolved = []
  const undeterminedForms = []
  /** helper 层读到的每条 ⇒ 来源(文件 + 形态)。"报数必须报名"的机器出口 */
  const helperProvenance = new Map()
  const byFile = new Map()
  for (const [rel, src] of files) if (rel.endsWith('.ts')) byFile.set(rel, analyzeTsFile(rel, src))
  const graphInfos = buildGraphInfos(files)
  const factoryNames = collectFactoryNames(graphInfos)
  const defCache = new Map()
  const formsCache = new Map()
  /** 模板前缀的展开上下文用**本层自己那份遮噪面**(与 `edge.at` 同面同轮,不跨面取下标) */
  const tplCtxCache = new Map()
  const templateCtx = (rel, src) => {
    if (!tplCtxCache.has(rel))
      tplCtxCache.set(rel, {
        src,
        pathConsts: extractPathConsts(src),
        loops: findMatrixLoops(src, extractMatrixArrays(src)),
      })
    return tplCtxCache.get(rel)
  }
  const blindReported = new Set()
  /** 该边把符号挂进目标文件时,能不能定出目标函数(定不出 = 前缀归因不可证,helper 层不产出) */
  const attriEmpty = (targetRel, symbol) => mountedFunctionNames(graphInfos.get(targetRel), symbol).size === 0
  /** 未判定点名出口(去重后同进 `unresolved`,门侧现成打印面);§0.3:没判不许写成判过 */
  const nameBlind = (key, detail) => {
    if (blindReported.has(key)) return
    blindReported.add(key)
    undeterminedForms.push(detail)
  }
  const queue = [[FASTIFY_ENTRY, '', null, false]]
  const seen = new Set()
  let guard = 0
  while (queue.length && guard++ < 20000) {
    const [rel, prefix, mountedSymbol, coarse] = queue.shift()
    /**
     * 节点键必须带上「本节点挂的是哪个符号」(O87g 第①步补格@2026-10-26):同文件本地插件函数
     * (`registerCourseAuditRoutes(server)` / `server.register(localFn, {prefix})` 两型,实测
     * edu-extended/system-extended/zhs-organization/service-catalog/automations/
     * user-agent-free-times 六档 17 条 unresolved 全是这一型)到达时若撞上「同文件同前缀但挂载符号
     * 不同」的旧节点,旧键会整节点跳过 ⇒ 该函数体内的 helper 注册形态永远产不出(归因窄口径
     * `candFns` 只认旧挂载符号)。键加一维 = 纯增访问面,⊇ 既有产出零变化(由 --self-test 的
     * T0 构造面锁钉住)。
     */
    const key = `${rel}@@${prefix}@@${mountedSymbol || ''}`
    if (seen.has(key)) continue
    seen.add(key)
    const info = byFile.get(rel)
    if (!info) {
      unresolved.push(`${rel} 不在面上(挂载目标缺失)`)
      continue
    }
    for (const r of info.routes) {
      const full = joinPrefix(prefix, r.path)
      if (/\$\{[^}]*\}$/.test(r.path)) opaque.add(full.replace(/\$\{[^}]*\}.*$/, ''))
      paths.add(normSegs(full).join('/'))
    }
    /* helper 注册形态(工厂 / 模板 / 裸标识符):只往 paths 里加,既有产出一条不动 */
    const gInfo = graphInfos.get(rel)
    if (gInfo) {
      let forms = formsCache.get(rel)
      if (!forms) {
        forms = analyzeHelperForms(gInfo, graphInfos, factoryNames, defCache)
        formsCache.set(rel, forms)
      }
      /** 归因窄口径:能定出「本节点挂的是哪个函数」就只收它体内的 helper 产出(见 mountedFunctionNames 头注) */
      const candFns = mountedFunctionNames(gInfo, mountedSymbol)
      if (coarse) {
        // 「这条边挂的符号在目标文件里解不出函数」的节点 = 前缀归因不可证(实测 ai-vendors.ts 的
        // `export { adminAiVendorRoutes }` barrel 那一型:整条子树被并到 /api/admin/ai 下)。
        // 既有通配条目照旧保留(那是本层的历史粗口径,收紧属第②步);helper 层**不在这种节点上产出**,
        // 否则等于把一条粗通配拆成上百条"看起来确切"的在册路径 = 本票点名的假绿放大器。
        nameBlind(
          `${rel}#coarse`,
          `${rel}: 仅以「前缀归因不可证」的边到达(挂载符号在本文件解不出函数,如 barrel re-export)` +
            ` ⇒ helper 注册形态不在该节点产出(未判定,不当成不存在);该节点下的 helper 子树共 ${forms.values.length} 条候选被搁置`,
        )
      } else
        for (const item of forms.values) {
          if (candFns.size && item.fn !== MODULE_FN && !candFns.has(item.fn)) continue
          // 拼接规则与本层既有产出一致:节点前缀 ⊕ 别名链 ⊕ 实参解出的 localPath(本层不做「绝对路径不叠加」
          // 那套收紧 —— 收紧必然改动既有条目,属第②步)
          const full = joinPrefix(joinPrefix(prefix, item.chain), item.local)
          if (!full || full === '/') continue
          const norm = normSegs(full).join('/')
          paths.add(norm)
          // 逐条可点名(票面第③步的前置:报数必须报名)。只登记 helper 层新增的,不覆盖既有来源。
          if (!helperProvenance.has(norm)) helperProvenance.set(norm, { file: rel, via: item.via })
        }
      for (const line of forms.undetermined) {
        if (undeterminedForms.includes(line)) continue
        undeterminedForms.push(line)
      }
      for (const b of forms.blindSpots) nameBlind(b.key, b.detail)
    }
    /* 本层遮噪面上登记的「整棵读不到」形态 ⇒ 逐条点名(先前这两支都是 `continue` 一声不响) */
    for (const s of info.inlineSubtrees)
      nameBlind(
        `${rel}#inline#${s.at}`,
        `${rel}: register(async (别名实例) => …) 内联子树${s.prefix ? `(前缀 ${s.prefix})` : '(无前缀)'}` +
          ' 本层不追进去 ⇒ 未判定(有前缀者同时记不透明前缀),不得当成「该路由不存在」',
      )
    for (const s of info.templatePrefixSkipped)
      nameBlind(
        `${rel}#tpl-prefix#${s.at}`,
        `${rel}: register(…, { prefix: ${s.detail} }) 前缀静态不可解 ⇒ 该子树整棵未判定`,
      )
    for (const o of info.opaque) opaque.add(o)
    for (const edge of info.edges) {
      let edgePrefixes = [edge.prefix]
      if (edge.prefixTemplate) {
        const ex = expandTemplatePath(edge.prefixTemplate, { ...templateCtx(rel, info.src), idx: edge.at })
        if (!ex.ok) {
          unresolved.push(`${rel}: register(${edge.symbol}) 的模板前缀 \`${edge.prefixTemplate}\` 解不出 —— ${ex.reason} ⇒ 该子树未判定`)
          continue
        }
        edgePrefixes = ex.values
      }
      for (const ep of edgePrefixes) {
        /**
         * 目标解析:先取本层自己那份静态 import,取不到再问**同源的图形层**那份(它认
         * `const { default: X } = await import('./p.js')` 这种动态导入边 —— 实测
         * `apps/api/src/routes/admin-missing-routes.ts` 整族 30+ 个子路由就是这么挂的,
         * 本层先前解不到目标 ⇒ 那些文件里的 `registerCrud(server, '/x', …)` 调用点整片读不到)。
         * 这是**纯增边**可达性,不删任何既有边 ⇒ ⊇ 由 superset 判据实测钉住。
         */
        const target = info.imports.get(edge.symbol) ?? (gInfo ? gInfo.imports.get(edge.symbol) : undefined)
        if (target) {
          const found = pickExisting(byFile, [`${target}.ts`, `${target}/index.ts`])
          if (found) {
            queue.push([found, joinPrefix(prefix, ep), edge.symbol, coarse || attriEmpty(found, edge.symbol)])
            continue
          }
          if (ep) opaque.add(joinPrefix(prefix, ep))
          unresolved.push(`${rel}: register(${edge.symbol}) → ${target} 不在面上`)
          continue
        }
        /**
         * **同文件本地插件函数**(O87g 先决补格@2026-10-26):边符号既不是 import 也不是动态导入
         * 目标,却是本文件里真存在的函数(`registerCourseAuditRoutes(server)` 直调型 /
         * `server.register(zhsOrganizationRoutes)` 具名型,后者的定义是 `const X: FastifyPluginAsync =
         * async (server) => {…}` 同文件箭头函数)⇒ 它是图上一条**真实的自环边**,先前一律落
         * 「解析不到文件」unresolved ⇒ 该函数子树的前缀不累加、helper 注册形态整片读不到。
         * 判据仍只有图形层那一份(`gInfo.fnByName`,来自 route-registration-extract 的 analyzeTsFile,
         * §0.6 不在此复算);命中才成边,不命中照旧走后面的文件名兜底。纯增:解得出前这些边
         * 只产 unresolved 行,解得出后这些行消失、路径按累积前缀产出 —— 既有产出条目一条不减
         * (真面实测 lost=0/added=0,170→153 条 unresolved 报名)。
         * **带前缀的具名同文件注册不在此解**:`server.register(localFn, { prefix })` 那一型是
         * 守门 127 自检 F4/F4b 钉住的既有裁决面(前缀记不透明、子树不得被洗成确信),改它得动
         * 门文件本体 ⇒ 本席不越界,留给「换精确挂载图」第②步与门 127 同批收口。
         * (真仓六档 17 条该型 unresolved 现读**全部不带前缀**,窄口径已全覆盖。)
         */
        if (ep === '' && gInfo && gInfo.fnByName.has(edge.symbol)) {
          queue.push([rel, prefix, edge.symbol, coarse])
          continue
        }
        const localFile = pickExisting(byFile, [`${normalizePosix(`${info.dir}/${edge.symbol}`)}.ts`])
        if (localFile) {
          queue.push([localFile, joinPrefix(prefix, ep), edge.symbol, coarse || attriEmpty(localFile, edge.symbol)])
          continue
        }
        if (ep) opaque.add(joinPrefix(prefix, ep))
        else unresolved.push(`${rel}: register(${edge.symbol}) 解析不到文件(第三方插件或动态符号)`)
      }
    }
  }
  unresolved.push(...undeterminedForms)
  return {
    paths,
    opaque,
    unresolved,
    filesAnalyzed: byFile.size,
    undetermined: undeterminedForms,
    helperProvenance,
    factories: factoryNames,
  }
}

export function pickExisting(map, candidates) {
  for (const c of candidates) if (map.has(c)) return c
  return null
}

/* ---------------- helper 注册形态:工厂调用点 / 模板 / 裸标识符 ---------------- */

/**
 * 一次建图:工厂识别、模板/矩阵展开、实参形态解析这三套判据的**唯一实现**在
 * `route-registration-extract.mjs`(AGENTS §0.6:同类判据两份必然漂移),本层只做接进
 * 「本层文件级挂载图语义」的 glue,不复制第二份判据。
 * `.d.ts` 不进射程(声明文件里的 `server.get` 是接口示例,不是注册)。
 */
export function buildGraphInfos(files) {
  const out = new Map()
  for (const [rel, src] of files) {
    if (!rel.endsWith('.ts') || rel.endsWith('.d.ts')) continue
    out.set(rel, analyzeGraphTsFile(rel, src))
  }
  return out
}

/** 同文件 `const NAME = '/x'` 定值取用(glue:取值仍由 pathConsts / expandTemplatePath 那一份判据决定) */
function constStringBinding(src, name) {
  if (!name || !/^[A-Za-z_$][\w$]*$/.test(name)) return undefined
  const m = new RegExp(`(?:const|let|var)\\s+${escapeRe(name)}\\s*(?::[^=]+)?=\\s*['"\`]([^'"\`]*)['"\`]`).exec(src)
  return m ? m[1] : undefined
}

/**
 * 已解析的路径实参 ⇒ 具体值数组。三条合法出路:字面量 / 同文件字符串常量 / 模板串(矩阵列 or 常量)。
 * 解不出返回 `{ ok:false, kind, reason }` —— 调用方必须点名,不得静默丢(§0.3)。
 */
export function bindParsedPathArg(arg, ctx) {
  if (!arg) return { ok: false, kind: 'opaque-path', reason: '没有路径实参' }
  if (arg.kind === 'literal') return { ok: true, values: [arg.value] }
  if (arg.kind === 'bare') {
    const v = ctx.pathConsts?.get(arg.expr) ?? constStringBinding(ctx.src, arg.expr)
    if (typeof v === 'string' && v !== '') return { ok: true, values: [v] }
    return { ok: false, kind: 'identifier-path', reason: `路径实参是标识符 ${arg.expr},本文件解不到定值` }
  }
  if (arg.kind === 'template') {
    const ex = expandTemplatePath(arg.value, {
      src: ctx.src,
      idx: ctx.idx,
      pathConsts: ctx.pathConsts,
      loops: ctx.loops,
    })
    if (ex.ok) return { ok: true, values: ex.values }
    return { ok: false, kind: 'template-path', reason: `模板 \`${arg.value}\` 静态不可解 —— ${ex.reason}` }
  }
  return { ok: false, kind: 'opaque-path', reason: `路径实参不可静态解析:${arg.expr}` }
}

/** 实参**文本**(工厂调用点那种)⇒ 同一份判据;两个口子共用 bindParsedPathArg,不写两份 */
export function bindPathArgText(argText, ctx) {
  return bindParsedPathArg(parsePathArg(argText), ctx)
}

/** 调用点符号 ⇒ 工厂定义(本文件函数优先,其次 import 目标文件)。识别判据仍是 `describeFactory`,本层只定位文件 */
export function findFactoryDef(graphInfos, info, symbol, cache) {
  const key = `${info.rel}#${symbol}`
  if (cache && cache.has(key)) return cache.get(key)
  const tryFile = (file) => {
    const t = graphInfos.get(file)
    if (!t) return null
    const d = describeFactory(t, symbol)
    if (!d) return null
    return { ...d, defFile: file, pathArgIndex: d.params.indexOf(d.paramName) }
  }
  let found = tryFile(info.rel)
  if (!found) {
    const imported = info.imports.get(symbol)
    if (imported) {
      const target = pickGraphExisting(graphInfos, [`${imported}.ts`, `${imported}/index.ts`])
      if (target) found = tryFile(target)
    }
  }
  if (cache) cache.set(key, found ?? null)
  return found
}

/**
 * 挂载符号 ⇒ 目标文件里的候选函数名集合(helper 层的**归因窄口径**)。
 * 本层的路由通道按「文件级前缀并集」走(收紧它 = 减条目 = 违反 ⊇,留第②步);helper 层新读到的
 * 条目没有理由继承这份粗:同文件两个插件函数挂在两个前缀下时,把只在 A 里发生的工厂调用也配到
 * B 的前缀上,就是本票点名的「造出结构上不存在的注册」。所以这里能定函数就定,定不出返回**空集**
 * (= 不收窄,退回旧口径,宁多不少 —— 方向是"少读"而不是"读错")。
 */
export function mountedFunctionNames(targetInfo, symbol) {
  if (!targetInfo || !symbol) return new Set()
  if (targetInfo.fnByName.has(symbol)) return new Set([symbol])
  // barrel re-export(`export { X } from './p.js'`):定义根本不在本文件,把本文件当"挂着 X"的文件
  // 去产 helper 条目 = 前缀归因不可证(实测 ai-vendors.ts 那一型会把整棵 openai-compat 子树
  // 挂到 /api/admin/ai 下 ⇒ 160 条结构上不存在的"在册"路径)。交空集 = 不收窄也不产出。
  if (targetInfo.reexports && targetInfo.reexports.has(symbol)) return new Set()
  if (targetInfo.fnByName.has('(default)')) return new Set(['(default)'])
  const cands = targetInfo.fns.filter((f) => f.name !== '(default)').map((f) => f.name)
  return cands.length === 1 ? new Set(cands) : new Set()
}

/**
 * 一个文件里「helper 注册形态」的全部可读产出。**返回值与节点前缀无关**(只到 localPath 一级),
 * 走图侧按累积前缀拼接,因此同一文件被多次访问时结果可缓存复用。
 *
 * @returns {{values:Array<{fn:string,chain:string,local:string,via:string}>,undetermined:Array<string>,blindSpots:Array<{key:string,detail:string}>}}
 */
export function analyzeHelperForms(info, graphInfos, factoryNames, defCache) {
  const values = []
  const undetermined = []
  const blindSpots = []
  const ctx = { src: info.src, pathConsts: info.pathConsts, loops: info.loops }
  /** 工厂实现体里的路径是**形参**,只有调用点才代入得出来;在定义文件节点上展开 = 臆造 ⇒ 整族跳过 */
  const localFactoryFns = new Set()
  for (const f of info.fns) if (describeFactory(info, f.name)) localFactoryFns.add(f.name)

  /* ① 动词注册实参细化。本层旧式只吃 `server.get('/x')` 字面量:模板串一律被 normSegs 洗成通配
     `*`(具体厂商/常量值读不到),裸标识符与空串注册(`server.post('', h)` = 挂在节点前缀本身)
     则整条隐身。这里只**补**具体值,旧通配由既有 routes 通道继续产出 ⇒ 精确集只增不减。 */
  const aliasReceivers = new Map()
  for (const r of info.regs) {
    if (!OUTBOUND_INSTANCE.has(r.recv)) {
      // 别名实例(`child`/`s`/`sub`/`authed`…)的子树本层**不读**:本层按「文件级前缀并集」归因,
      // 读进来会把不属于它的节点前缀配上去 = 造出结构上不存在的注册(= 本票要消灭的假绿)。
      aliasReceivers.set(r.recv, (aliasReceivers.get(r.recv) || 0) + 1)
      continue
    }
    if (localFactoryFns.has(r.fn)) continue
    const alreadyRead = r.arg.kind === 'literal' && r.arg.value !== '' && !r.arg.value.includes('${')
    if (alreadyRead) continue
    const bound = bindParsedPathArg(r.arg, { ...ctx, idx: r.idx })
    if (!bound.ok) {
      undetermined.push(
        `${info.rel}:${r.line} ${r.recv}.${r.method.toLowerCase()}(${r.arg.expr || r.arg.value}) 路径实参不可解 ⇒ 未判定 —— ${bound.reason}`,
      )
      continue
    }
    const chain = extraPrefix(info, r.fn, r.recv)
    for (const v of bound.values) {
      if (v !== '' && !v.startsWith('/')) continue
      values.push({ fn: r.fn, chain, local: v, via: `arg:${r.arg.kind}` })
    }
  }
  for (const [recv, n] of aliasReceivers)
    blindSpots.push({
      key: `${info.rel}#alias#${recv}`,
      detail:
        `${info.rel}: 别名实例 '${recv}' 上 ${n} 处注册本层读不到(内联子树 + 文件级前缀归因会配错前缀)` +
        ' ⇒ 未判定,不判红;也不得当成「该路由不存在」',
    })

  /* ② 工厂(helper)注册调用点:名字由实现体推导(collectFactoryNames),路径由实参解析。 */
  for (const call of scanFactoryCalls(info, factoryNames)) {
    if (call.fn === call.name) continue // 工厂定义体内的自引用
    const factory = findFactoryDef(graphInfos, info, call.name, defCache)
    if (!factory) {
      undetermined.push(`${info.rel}:${call.line} ${call.name}(...) 解不到工厂定义 ⇒ 未判定(工厂面按实现体推导,不写死名单)`)
      continue
    }
    const args = splitTopLevelArgs(call.argsText)
    const recvMatch = /^[A-Za-z_$][\w$]*$/.exec((args[0] || '').trim())
    if (!recvMatch || !OUTBOUND_INSTANCE.has(recvMatch[0])) {
      undetermined.push(
        `${info.rel}:${call.line} ${call.name}(...) 的实例实参是 ${args[0] || '(空)'},不在本层认得的实例集合内 ⇒ 未判定`,
      )
      continue
    }
    const bound = bindPathArgText(args[factory.pathArgIndex] || '', { ...ctx, idx: call.idx })
    if (!bound.ok) {
      undetermined.push(`${info.rel}:${call.line} ${call.name}(...) 的路径实参不可解 ⇒ 未判定 —— ${bound.reason}`)
      continue
    }
    const chain = extraPrefix(info, call.fn, recvMatch[0])
    for (const basePath of bound.values) {
      for (const reg of factory.regs) {
        const inst = instantiateFactoryReg(reg, factory.paramName, basePath)
        if (!inst.ok) {
          undetermined.push(
            `${info.rel}:${call.line} ${call.name} 工厂内 ${reg.method}(${reg.arg.expr}) 代入 '${basePath}' 失败 ⇒ 未判定 —— ${inst.reason}`,
          )
          continue
        }
        if (inst.value !== '' && !inst.value.startsWith('/')) continue
        // 工厂体内的实参形态只有三种:裸路径形参 / `${形参}` 模板 / 与形参无关的字面量。
        // 第三种(字面量)挂在**传入实例的前缀**下,不再叠加调用点的 basePath —— 与 gate8 同一判据
        // (instantiateFactoryReg 已在代入时把 basePath 拼进该当位置),本层不另立一套拼接规则。
        values.push({ fn: call.fn, chain, local: inst.value, via: `factory:${factory.defFile}` })
      }
    }
  }

  /* ③ 整棵子树读不到的形态由走图侧按 `analyzeTsFile` 的登记点名(那是本层自己的遮噪面,不在这儿的输入里) */
  return { values, undetermined, blindSpots }
}

/* ----------------------------- 注册面:FastAPI ----------------------------- */

export const PY_DECO_RE = new RegExp(`@([\\w.]+)\\.(?:${VERBS.join('|')}|websocket)\\s*\\(\\s*['"]([^'"]*)['"]`, 'g')
export const PY_APIROUTER_RE = /([A-Za-z_]\w*)\s*=\s*APIRouter\(([^)]*)\)/g
export const PY_INCLUDE_RE = /\.include_router\(\s*([\w.]+)([^)]*)\)/g
export const PY_MOUNT_RE = /\.mount\(\s*([^,)]+)/g
/** 单行 `from X import …`;续行由下面的循环显式接(不在正则里跨行,否则函数体内的局部 import 会被后文吃掉) */
export const PY_FROM_RE = /^[ \t]*from\s+(\.+[\w.]*|[\w.]+)\s+import\s+(.*)$/

/** Python 单文件解析:装饰器 + APIRouter 前缀 + include_router 边 + mount + import 目标 */
export function analyzePyFile(rel, srcRaw) {
  const src = maskComments(srcRaw, 'py')
  const dir = dirname(rel)
  const decos = {}
  const routerPrefixes = {}
  const includes = []
  const mounts = []
  const imports = new Map()
  let m
  while ((m = PY_DECO_RE.exec(src)) !== null) {
    const v = m[1].split('.').pop()
    ;(decos[v] ||= []).push({ path: m[2], line: lineOf(src, m.index) })
  }
  while ((m = PY_APIROUTER_RE.exec(src)) !== null) {
    const pre = /prefix\s*=\s*['"]([^'"]*)['"]/.exec(m[2])
    routerPrefixes[m[1]] = pre ? pre[1] : ''
  }
  while ((m = PY_INCLUDE_RE.exec(src)) !== null) {
    const pre = /prefix\s*=\s*['"]([^'"]*)['"]/.exec(m[2] || '')
    const parent = /([\w.]+)\.include_router/.exec(m[0])
    includes.push({ parent: parent ? parent[1].split('.').pop() : 'app', child: m[1], prefix: pre ? pre[1] : '' })
  }
  while ((m = PY_MOUNT_RE.exec(src)) !== null) {
    const arg = m[1].trim()
    if (/^['"]/.test(arg)) mounts.push({ prefix: arg.replace(/^['"]|['"]$/g, '') })
    else {
      // app.mount(prefix, …) 的 prefix 常是**形参**,其默认值又指着一个常量名:
      // def mount_to_app(app, prefix: str = MCP_EXPORT_PREFIX) + MCP_EXPORT_PREFIX = "/api/mcp/export"
      // 只解字面量那一支会让 mcp_export 这类子应用整条隐身(F7 之前的真实缺口)。
      const lit = new RegExp(
        `${escapeRe(arg)}\\s*(?::\\s*[\\w[\\]|None]+)?\\s*=\\s*['"]([^'"]*)['"]`,
      ).exec(src)
      if (lit) {
        mounts.push({ prefix: lit[1] })
        continue
      }
      const nameRef = new RegExp(
        `${escapeRe(arg)}\\s*(?::\\s*[\\w[\\]|None]+)?\\s*=\\s*([A-Za-z_][\\w.]*)\\s*[,)]`,
      ).exec(src)
      if (nameRef) {
        const constLit = new RegExp(`\\b${escapeRe(nameRef[1])}\\s*(?::[^=]+)?=\\s*['"]([^'"]*)['"]`).exec(src)
        if (constLit) {
          mounts.push({ prefix: constLit[1] })
          continue
        }
      }
      mounts.push({ prefix: `/__unresolved_mount__:${arg}` })
    }
  }
  // from X import (a, b as c) —— 逐行取语句 + 显式续行(括号未闭合 / 反斜杠 / 尾逗号)才接下一行。
  // 用"看到下一个关键字为止"的整段正则会**越过**函数体内的局部 import(main.py 的
  // `from app.routers import news as news_router` 就在函数里,后面紧跟 app.include_router(…),
  // 于是清单被吃进后续语句、别名键带上换行 ⇒ 挂载图断在这一条上(news/goal_verification 实测解析不到)。
  const srcLines = src.split('\n')
  for (let k = 0; k < srcLines.length; k++) {
    const fm = PY_FROM_RE.exec(srcLines[k])
    if (!fm) continue
    const pkg = fm[1]
    let clause = fm[2]
    let j = k
    // 只在「括号未闭合 / 反斜杠续行 / 逗号结尾且没进括号」时接下一行 —— 其余一行就是一整条语句
    for (;;) {
      const opens = countOf(clause, /\(/g)
      const closes = countOf(clause, /\)/g)
      const cont =
        opens > closes || /\\\s*$/.test(clause) || (opens === 0 && /,\s*$/.test(clause.trim()))
      if (!cont || j + 1 >= srcLines.length) break
      j += 1
      clause = `${clause.replace(/\\\s*$/, '')} ${srcLines[j].trim()}`
    }
    const names = clause
      .replace(/[()\[\]]/g, '')
      .split(',')
      .map((s) => s.trim().split('#')[0].trim())
      .filter(Boolean)
    const pkgPath = pyPkgPath(dir, pkg)
    if (!pkgPath) continue
    for (const raw of names) {
      const parts = raw.split(/\s+as\s+/)
      const orig = (parts[0] || '').trim()
      const local = (parts[1] || parts[0] || '').trim()
      if (!orig || orig === '*' || !local || !/^[\w.]+$/.test(local)) continue
      // 「包里的子模块」与「模块里的对象」在文本上同形,只能等到有盘面时再判 ⇒ 存**候选**列表
      imports.set(local, {
        candidates: [
          { file: `${pkgPath}.py`, attr: orig === 'router' ? 'router' : orig },
          { file: normalizePosix(`${pkgPath}/${orig}.py`), attr: 'router' },
        ],
      })
    }
  }
  return { decos, routerPrefixes, includes, mounts, imports, dir }
}

/** 包/模块 ⇒ 仓内 posix 路径(不含扩展名);解不出的包名(第三方)返回 null */
export function pyPkgPath(dir, pkg) {
  if (!pkg) return null
  if (pkg.startsWith('.')) {
    const lead = (pkg.match(/^\.+/) || [''])[0].length - 1
    const parts = pkg.replace(/^\.+/, '').split('.').filter(Boolean)
    let base = normalizePosix(dir)
    for (let i = 0; i < lead; i++) base = normalizePosix(`${base}/..`)
    return parts.length ? normalizePosix(`${base}/${parts.join('/')}`) : normalizePosix(base)
  }
  const segs = pkg.split('.').filter(Boolean)
  if (segs[0] !== 'app') return null
  return normalizePosix(`apps/ai-service/${segs.join('/')}`)
}

export function resolvePyChild(info, child, byFile) {
  const parts = String(child).split('.')
  const imp = info.imports.get(parts[0])
  if (parts.length === 1) {
    if (info.decos[parts[0]] || info.routerPrefixes[parts[0]]) return { file: null, attr: parts[0] }
    if (!imp) return null
    const hit = imp.candidates.find((c) => byFile.has(c.file))
    return hit ? { file: hit.file, attr: hit.attr } : null
  }
  if (!imp) return null
  const attr = parts[parts.length - 1]
  const hit = imp.candidates.find((c) => byFile.has(c.file))
  return hit ? { file: hit.file, attr } : null
}

/**
 * FastAPI 挂载图:节点 = (文件, router 变量, 累积前缀),入口 = main.py 的 `app`。
 * 另跑一遍全文件收 `app.mount(...)` —— 子 ASGI 应用的路径结构上不可见 ⇒ 记不透明前缀,不判红(F6)。
 */
export function buildFastApiRegistrations(files) {
  const paths = new Set()
  const opaque = new Set()
  const unresolved = []
  const byFile = new Map()
  for (const [rel, src] of files) if (rel.endsWith('.py')) byFile.set(rel, analyzePyFile(rel, src))
  for (const [, info] of byFile) for (const mp of info.mounts) opaque.add(mp.prefix)
  const queue = [[FASTAPI_ENTRY, 'app', '']]
  const seen = new Set()
  let guard = 0
  while (queue.length && guard++ < 20000) {
    const [rel, varName, prefix] = queue.shift()
    const key = `${rel}@@${varName}@@${prefix}`
    if (seen.has(key)) continue
    seen.add(key)
    const info = byFile.get(rel)
    if (!info) {
      unresolved.push(`${rel} 不在面上`)
      continue
    }
    for (const v of varName === '*' ? Object.keys(info.decos) : [varName]) {
      const base = joinPrefix(prefix, info.routerPrefixes[v] || '')
      for (const d of info.decos[v] || []) {
        if (/\{[^}]*:path\}/.test(d.path)) opaque.add(joinPrefix(base, d.path.split('{')[0]))
        paths.add(normSegs(joinPrefix(base, d.path)).join('/'))
      }
    }
    for (const e of info.includes) {
      const child = resolvePyChild(info, e.child, byFile)
      if (!child) {
        if (e.prefix) opaque.add(e.prefix)
        else unresolved.push(`${rel}: include_router(${e.child}) 解析不到文件`)
        continue
      }
      queue.push([child.file || rel, child.attr || '*', joinPrefix(prefix, e.prefix || '')])
    }
  }
  return { paths, opaque, unresolved, filesAnalyzed: byFile.size }
}

/* ----------------------------- --self-test ----------------------------- */

/**
 * 合成夹具自证(不读磁盘、不碰 git —— 取材面纪律 §0.4 与本层「输入是 Map」一致)。
 * 成对夹具纪律:每条**正向断言**都配一条「摘掉对应识别式必然翻红」的反向牙 ——
 *  T1/T2/T3 钉住 helper 工厂族与同文件本地函数边(识别式被摘 ⇒ 该路径消失 ⇒ 红);
 *  T4 钉住「不越界」(别名实例子树被误读进来 ⇒ 红);
 *  T0 是 ⊇ 构造面锁(旧通道产出被新逻辑挤掉 ⇒ 红)。
 */
export function runSelfTest() {
  const results = []
  const ok = (name, cond, extra = '') => results.push({ name, pass: !!cond, extra })
  const m = (entries) => new Map(entries)
  const ENTRY = FASTIFY_ENTRY
  const FACTORY = [
    'export function registerCrud(server, basePath, table, opts) {',
    '  server.get(basePath, async () => ([]))',
    '  server.get(`${basePath}/:id`, async () => ({}))',
    '  server.post(basePath, async () => ({}))',
    '  server.delete(`${basePath}/:id`, async () => ({}))',
    '}',
    '',
  ].join('\n')

  /* T0 ⊇ 构造面锁:helper 层接入后,旧字面通道读到的条目一条不许丢 */
  {
    const reg = buildFastifyRegistrations(
      m([
        [ENTRY, "import { r } from './routes/t0.js'\nserver.register(r, { prefix: '/api' })\n"],
        ['apps/api/src/routes/t0.ts', "import { registerCrud } from './_shared.js'\nexport const r = async (server) => {\n  server.get('/lit', async () => ({}))\n  registerCrud(server, '/things', t, {})\n}\n"],
        ['apps/api/src/routes/_shared.ts', FACTORY],
      ]),
    )
    ok('T0 ⊇ 锁:旧字面注册不因 helper 层而丢', reg.paths.has('api/lit') && reg.paths.has('api/things') && reg.paths.has('api/things/*'))
  }

  /* T1 registerCrud 族(票面点名):工厂调用点按实参代入,方法集与 :id 腿来自实现体 */
  {
    const reg = buildFastifyRegistrations(
      m([
        [ENTRY, "import { r } from './routes/t1.js'\nserver.register(r, { prefix: '/api/admin' })\n"],
        ['apps/api/src/routes/t1.ts', "import { registerCrud } from './_shared.js'\nexport const r = async (server) => {\n  registerCrud(server, '/courses', lessons, {})\n}\n"],
        ['apps/api/src/routes/_shared.ts', FACTORY],
      ]),
    )
    ok(
      'T1 registerCrud 族:basePath 与 `${basePath}/:id` 两腿都按调用点前缀产出',
      reg.paths.has('api/admin/courses') && reg.paths.has('api/admin/courses/*') && !reg.paths.has('api/courses'),
    )
    ok('T1b 注释里的 registerCrud 调用不算注册(遮噪在位)', !buildFastifyRegistrations(
      m([
        [ENTRY, "import { r } from './routes/t1c.js'\nserver.register(r, { prefix: '/api' })\n"],
        ['apps/api/src/routes/t1c.ts', "import { registerCrud } from './_shared.js'\nexport const r = async (server) => {\n  // registerCrud(server, '/fake', t, {})\n}\n"],
        ['apps/api/src/routes/_shared.ts', FACTORY],
      ]),
    ).paths.has('api/fake'))
  }

  /* T2 同文件本地插件函数·直调型(`auditRoutes(server)`):本席补格,摘掉识别式 ⇒ api/audit* 消失 ⇒ 翻红 */
  {
    const reg = buildFastifyRegistrations(
      m([
        [ENTRY, "import { r } from './routes/t2.js'\nserver.register(r, { prefix: '/api' })\n"],
        [
          'apps/api/src/routes/t2.ts',
          "import { registerCrud } from './_shared.js'\nexport const r = async (server) => {\n  registerAudit(server)\n}\nfunction registerAudit(server) {\n  registerCrud(server, '/audit', audits, {})\n}\n",
        ],
        ['apps/api/src/routes/_shared.ts', FACTORY],
      ]),
    )
    ok(
      'T2 同文件本地函数直调 ⇒ 其体内工厂调用按累积前缀产出',
      reg.paths.has('api/audit') && reg.paths.has('api/audit/*'),
    )
    ok(
      'T2b 该型不再落「解析不到文件」(旧 unresolved 出口必须已让位给真边)',
      !reg.unresolved.some((l) => /register\(registerAudit\) 解析不到文件/.test(l)),
    )
  }

  /* T3 同文件本地插件函数·具名 register 型(`server.register(localFn)` 裸边,真仓六档现读全是这一型) */
  {
    const reg = buildFastifyRegistrations(
      m([
        [ENTRY, "import { r } from './routes/t3.js'\nserver.register(r, { prefix: '/api' })\n"],
        [
          'apps/api/src/routes/t3.ts',
          "import { registerCrud } from './_shared.js'\nconst orgRoutes = async (server) => {\n  registerCrud(server, '/orgs', orgs, {})\n}\nexport const r = async (server) => {\n  server.register(orgRoutes)\n}\n",
        ],
        ['apps/api/src/routes/_shared.ts', FACTORY],
      ]),
    )
    ok('T3 同文件本地函数经具名裸 register ⇒ 节点按累积前缀走到,体内工厂产出', reg.paths.has('api/orgs') && reg.paths.has('api/orgs/*'))
  }

  /* T3b 边界锁:带前缀的同文件具名注册**不得**被子树洗成确信(守门 127 F4/F4b 既有裁决面不得被本席挪动) */
  {
    const reg = buildFastifyRegistrations(
      m([[ENTRY, 'const crudRoutes = async (app) => {\n  app.get("/crud/:id", async () => ({}))\n}\nserver.register(crudRoutes, { prefix: \'/api/v1\' })\n']]),
    )
    ok(
      'T3b 带前缀同文件具名注册仍记不透明、子树不产出(反向牙)',
      [...reg.opaque].includes('/api/v1') && !reg.paths.has('api/v1/crud/*'),
    )
  }

  /* T4 反向牙:别名实例子树**不得**被读成在册(越界即红,与镜像 H8 同判据) */
  {
    const reg = buildFastifyRegistrations(
      m([[ENTRY, "server.register(async (child) => {\n  child.get('/deep/x', async () => ({}))\n}, { prefix: '/api/exam' })\n"]]),
    )
    ok(
      'T4 反向牙:内联别名实例子树不产出、只点名',
      !reg.paths.has('api/exam/deep/x') && [...reg.opaque].includes('/api/exam') && reg.unresolved.some((l) => /内联子树/.test(l)),
    )
  }

  /* T5 FastAPI 侧不受本次扩展波及(挂载图仍走通) */
  {
    const py = buildFastApiRegistrations(
      m([
        ['apps/ai-service/app/main.py', "from app.routers import hooks\napp.include_router(hooks.router, prefix='/api')\n"],
        ['apps/ai-service/app/routers/hooks.py', "router = APIRouter(prefix='/hooks')\n\n@router.post('/ping')\nasync def p():\n    pass\n"],
      ]),
    )
    ok('T5 FastAPI 挂载图未受波及', py.paths.has('api/hooks/ping'))
  }

  return results
}

export function mainSelfTest() {
  const results = runSelfTest()
  let fails = 0
  for (const r of results) {
    if (!r.pass) fails += 1
    console.log(`${r.pass ? '✅' : '❌'} ${r.name}`)
  }
  console.log(`SELF-TEST ${results.length - fails}/${results.length} 例通过`)
  if (fails) {
    console.log('❌ 存在未过例(摘掉识别式即翻红 —— 成对夹具)')
    return 1
  }
  console.log('SELF-TEST RESULT=green')
  return 0
}

import { pathToFileURL } from 'node:url'

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun && process.argv.includes('--self-test')) {
  process.exitCode = mainSelfTest()
}

export const __test__ = {
  analyzeTsFile,
  analyzePyFile,
  buildFastifyRegistrations,
  buildFastApiRegistrations,
  buildGraphInfos,
  analyzeHelperForms,
  mountedFunctionNames,
  runSelfTest,
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
