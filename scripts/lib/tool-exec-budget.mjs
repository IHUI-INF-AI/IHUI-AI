// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

//
// 工具执行预算的**判据层**(纯函数:不碰 git、不碰磁盘、不读环境变量)。
//
// 为什么单独一层:`scripts/check-tool-exec-budget.mjs` 只负责"判哪个面"(HEAD / 索引 / 工作树),
// 而"什么叫合规"必须与它分开 —— 否则镜像测试只能靠真仓瞬时状态取证(守门 103 的原文教训:
// 证明取材面这类行为只能用纯函数 + 构造面)。本层每个出口都吃字符串、回结构,全部可构造。
//
// 单一真相源在 `apps/cli/src/tools/index.ts`(常量表 + 解析器 + 应用点)。本层**不抄第二份数字**:
// 门判的上下限一律由 parseExecBudgetConstants() 从被审内容里现读,读不到即交"无法判定"。

/** 机制所在文件(唯一出口 + 唯一应用点 + 常量表) */
export const MECHANISM_FILE = 'apps/cli/src/tools/index.ts'
/** 取消下发必须接进去的嵌套 loop 调用方 */
export const SUBAGENT_FILE = 'apps/cli/src/tools/subagent.ts'
/** 父级 signal 注入 ctx 的那一处构造点(本票文件清单外 ⇒ 只按棘轮点名,绝不判红) */
export const PARENT_CTX_FILE = 'apps/cli/src/commands/agent.ts'
/** 声明与"第二份自建墙钟"的扫描面 */
export const SCAN_DIR = 'apps/cli/src/tools'
/** 禁止新造的豁免命名(那会蹭守门 108 的"到期豁免账",而本档是结构性定性) */
export const FORBIDDEN_EXEMPT_MARKER = 'budget-exempt'

/** 命中一个正则的**代码行**(1-based);注释与串内的出现一律不算。 */
export function codeLineHits(src, pattern) {
  const masked = maskCodeLines(src)
  const hits = []
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g')
  masked.forEach((line, i) => {
    re.lastIndex = 0
    if (re.test(line)) hits.push(i + 1)
  })
  return hits
}

/**
 * 命中一个正则的原始行号(1-based)。
 *
 * 与 codeLineHits 的分工是**刻意的**:maskCodeLines 会把字符串**内容**换成空格,
 * 所以凡判据要看引号里的字面量(如 `removeEventListener('abort'`)就必须按原始行判 ——
 * 判在剥皮后的行上等于判据永远不命中(守门 112 在同一件事上栽过:"豁免标记必须按原始行判")。
 */
export function rawLineHits(src, pattern) {
  const hits = []
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g')
  String(src)
    .split(/\r?\n/)
    .forEach((line, i) => {
      re.lastIndex = 0
      if (re.test(line)) hits.push(i + 1)
    })
  return hits
}

/**
 * 把源码逐行"去注释 + 去字符串内容",返回与原文**行号一一对应**的行数组。
 *
 * 取向与守门 70/112 一致:判据永远只看代码面 —— 注释里的示例、报错文案里的字面量都不是债务
 * (本仓被这类假阳咬过:守门 112 的镜像测试抓到"报错文案里的 `tokens / contextLimit` 被判成违规")。
 * 模板字符串**故意不剥**,因为 `${}` 里可以真放代码。
 */
export function maskCodeLines(src) {
  const out = []
  let inBlock = false
  for (const rawLine of String(src).split(/\r?\n/)) {
    let line = ''
    for (let k = 0; k < rawLine.length; k++) {
      const c = rawLine[k]
      if (c === "'" || c === '"') {
        const quote = c
        let j = k + 1
        while (j < rawLine.length && rawLine[j] !== quote) {
          if (rawLine[j] === '\\') j += 1
          j += 1
        }
        line += quote + ' '.repeat(Math.max(0, j - k - 1)) + (j < rawLine.length ? quote : '')
        k = j
        continue
      }
      line += c
    }
    let cur = ''
    let i = 0
    while (i < line.length) {
      if (inBlock) {
        const end = line.indexOf('*/', i)
        if (end < 0) i = line.length
        else {
          inBlock = false
          i = end + 2
        }
        continue
      }
      if (line.startsWith('/*', i)) {
        inBlock = true
        i += 2
        continue
      }
      if (line.startsWith('//', i)) break
      cur += line[i]
      i += 1
    }
    out.push(cur)
  }
  return out
}

/**
 * 只支持整数 / `+ - * / ( )` / 下划线分隔的极小求值器。
 *
 * 为什么不用 eval / new Function:判据层跑在提交链上,拿源码片段去执行任何东西,等于把
 * "谁能写常量"变成"谁能执行门"。约 30 行换确定性,值。
 * @returns {number|null} 解析不了返回 null(交调用方计"判不出",绝不猜)
 */
export function evalNumericExpr(text) {
  const s = String(text).replace(/_/g, '').trim()
  if (s === '' || !/^[0-9+\-*/().\s]+$/.test(s)) return null
  let pos = 0
  const skipSpace = () => {
    while (s[pos] === ' ' || s[pos] === '\t') pos += 1
  }
  const parseFactor = () => {
    skipSpace()
    if (s[pos] === '(') {
      pos += 1
      const v = parseSum()
      if (v === null || s[pos] !== ')') return null
      pos += 1
      return v
    }
    if (s[pos] === '-') {
      pos += 1
      const v = parseFactor()
      return v === null ? null : -v
    }
    const m = /^\d+(?:\.\d+)?/.exec(s.slice(pos))
    if (!m) return null
    pos += m[0].length
    return Number(m[0])
  }
  const parseProduct = () => {
    let left = parseFactor()
    if (left === null) return null
    for (;;) {
      skipSpace()
      const op = s[pos]
      if (op !== '*' && op !== '/') return left
      pos += 1
      const right = parseFactor()
      if (right === null) return null
      if (op === '*') left *= right
      else {
        if (right === 0) return null
        left /= right
      }
    }
  }
  const parseSum = () => {
    let left = parseProduct()
    if (left === null) return null
    for (;;) {
      skipSpace()
      const op = s[pos]
      if (op !== '+' && op !== '-') return left
      pos += 1
      const right = parseProduct()
      if (right === null) return null
      left = op === '+' ? left + right : left - right
    }
  }
  const value = parseSum()
  if (value === null || pos !== s.length || !Number.isFinite(value)) return null
  return value
}

/** 同文件内的 `const NAME = <数值表达式>` 映射,用来解 `{ ms: SOME_CONST }` 这种声明。 */
export function collectNumericConsts(src) {
  const map = new Map()
  const re = /(?:^|\s)(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::\s*[A-Za-z_$][\w$<>|\s]*)?\s*=\s*([^\n;]+)/
  for (const line of String(src).split(/\r?\n/)) {
    const m = re.exec(line)
    if (!m) continue
    const v = evalNumericExpr(m[2])
    if (v !== null) map.set(m[1], v)
  }
  return map
}

/**
 * 解析档位常量表。不抄第二份数字,读不到就交回 null 由调用方判"无法判定"。
 * @returns {{defaultMs:number|null,maxMs:number|null,graceMs:number|null}}
 */
export function parseExecBudgetConstants(src) {
  const grab = (name) => {
    const m = new RegExp(`export const ${name}\\s*=\\s*([^\\n;]+)`).exec(String(src))
    return m ? evalNumericExpr(m[1]) : null
  }
  return {
    defaultMs: grab('TOOL_EXEC_BUDGET_DEFAULT_MS'),
    maxMs: grab('TOOL_EXEC_BUDGET_MAX_MS'),
    graceMs: grab('TOOL_EXEC_BUDGET_SETTLE_GRACE_MS'),
  }
}

/** 从 `execBudget:` 命中行往后取配平的 `{...}` 块(最多 40 行,越界即判不出)。 */
function extractObjectBlock(rawSrc, lineIdx1) {
  const lines = String(rawSrc).split(/\r?\n/)
  let depth = 0
  let started = false
  const picked = []
  const stop = Math.min(lines.length, lineIdx1 - 1 + 40)
  for (let i = lineIdx1 - 1; i < stop; i++) {
    const line = i === lineIdx1 - 1 ? lines[i].slice(lines[i].indexOf('execBudget:')) : lines[i]
    picked.push(line)
    for (const c of line) {
      if (c === '{') {
        depth += 1
        started = true
      } else if (c === '}') depth -= 1
    }
    if (started && depth <= 0) return picked.join('\n')
  }
  return picked.join('\n')
}

/**
 * 逐条解析 `execBudget` 声明。
 *
 * 三条硬判据(每条都对应一种"看起来合规其实失效"的形态):
 * 1. `ms` 形态必须 > 0 且 ≤ 常量表现值 maxMs —— 越过封顶的声明会被解析器静默改写,
 *    即"声明与执行不一致",必须在提交链上喊出来;
 * 2. `notInterruptible` 形态**必须带非空 reason**,且 reason 不得由注释残骸冒充
 *    (守门 102 的实录:裸标记后紧跟注释闭合符,曾被读成"带了原因" ⇒ 整行免检);
 * 3. 两形态都不成立 ⇒ 判红。"解析不出来就当没有"是本仓最高频的失效型。
 *
 * @param {number|null} [capMs] 封顶档。**由调用方从机制文件同面解析后传入** —— 声明住在各工具文件里,
 *        而常量表只有一份(在 tools/index.ts);各文件内回退到自己的解析结果仅供自检用。
 * @returns {Array<{line:number, form:string, msValue:number|null, problems:Array<{code:string,text:string}>, undetermined:boolean}>}
 */
export function parseExecBudgetDeclarations(src, capMs) {
  const consts = collectNumericConsts(src)
  const cap = capMs === undefined ? parseExecBudgetConstants(src).maxMs : capMs
  const masked = maskCodeLines(src)
  const items = []
  masked.forEach((line, i) => {
    if (!line.includes('execBudget:')) return
    // 跳过接口字段声明 `execBudget?: ToolExecBudget`(那是**类型位**,不是使用位)。
    // 今天它因中间多了个 `?` 而天然不匹配 'execBudget:',但判据不得依赖这种巧合 ——
    // 字段名一改(例如换成 execBudgetMs?)这条判据就会把类型声明当成违规声明。
    if (/\bexecBudget\s*\?:/.test(line)) return
    const lineNo = i + 1
    const block = extractObjectBlock(src, lineNo)
    const problems = []
    const hasNone = /\bnotInterruptible\s*:\s*true\b/.test(block)
    const msM = /\bms\s*:\s*([^,}\n]+)/.exec(block)
    if (hasNone && msM) {
      problems.push({ code: 'both-forms', text: '同一声明里既有 ms 又有 notInterruptible(两档互斥)' })
    }
    if (hasNone) {
      const rM = /\breason\s*:\s*(['"])((?:[^'"\\]|\\.)*)\1/.exec(block)
      if (!rM) {
        problems.push({ code: 'reason-missing', text: 'notInterruptible 缺 reason:结构性声明必须自带理由' })
      } else if (rM[2].replace(/[\s*/_#-]/g, '') === '') {
        problems.push({ code: 'reason-hollow', text: `reason 是空壳/注释残骸:${JSON.stringify(rM[2])}` })
      }
      items.push({ line: lineNo, form: 'none', msValue: null, problems, undetermined: false })
      return
    }
    if (msM) {
      const raw = msM[1].trim()
      const direct = evalNumericExpr(raw)
      const viaConst = consts.get(raw)
      const msValue = direct !== null ? direct : viaConst === undefined ? null : viaConst
      if (msValue === null) {
        // 解析不出数值 ⇒ 不猜、不判红(宁漏不误伤),但必须如实计数,绝不静默成"没有这条声明"
        items.push({ line: lineNo, form: 'ms', msValue: null, problems, undetermined: true })
        return
      }
      if (!(msValue > 0))
        problems.push({ code: 'ms-nonpositive', text: `ms=${msValue} 必须为正(0 绝不允许被当成"立刻超时")` })
      if (cap !== null && msValue > cap)
        problems.push({ code: 'ms-over-cap', text: `ms=${msValue} 越过 TOOL_EXEC_BUDGET_MAX_MS=${cap}` })
      items.push({ line: lineNo, form: 'ms', msValue, problems, undetermined: false })
      return
    }
    problems.push({ code: 'unknown-form', text: '既无 ms 也无 notInterruptible:true ⇒ 非法声明形态' })
    items.push({ line: lineNo, form: 'unknown', msValue: null, problems, undetermined: false })
  })
  return items
}

/** 取某个代码锚点所在 `{...}` 块的原文(花括号配平,不是行窗口 —— 行窗口会被"下面另一个函数"骗过)。 */
export function sliceBraceBlock(src, anchorRe, maxLines = 400) {
  const masked = maskCodeLines(src)
  const all = String(src).split(/\r?\n/)
  for (let i = 0; i < masked.length && i < all.length; i++) {
    if (!anchorRe.test(masked[i])) continue
    let depth = 0
    let started = false
    const picked = []
    for (let j = i; j < Math.min(all.length, i + maxLines); j++) {
      picked.push(all[j])
      for (const c of all[j]) {
        if (c === '{') {
          depth += 1
          started = true
        } else if (c === '}') depth -= 1
      }
      if (started && depth <= 0) return picked.join('\n')
    }
    return picked.join('\n')
  }
  return null
}

/**
 * S1:机制在位判据(只吃 index.ts 的内容)。
 * 每一条都对应"删掉它本票就失效"的具体一行 ⇒ 判据必须覆盖门自己产出的形态。
 */
export function findMechanismGaps(indexSrc) {
  const gaps = []
  const src = typeof indexSrc === 'string' ? indexSrc : ''
  const push = (id, why) => gaps.push({ id, why })

  if (!src) {
    push('S0-mechanism-file', '判定面取不到 tools/index.ts 内容')
    return gaps
  }
  const consts = parseExecBudgetConstants(src)
  if (consts.defaultMs === null) push('S1f-default', '常量 TOOL_EXEC_BUDGET_DEFAULT_MS 不在位')
  if (consts.maxMs === null) push('S1f-max', '常量 TOOL_EXEC_BUDGET_MAX_MS 不在位')
  if (consts.graceMs === null) push('S1f-grace', '常量 TOOL_EXEC_BUDGET_SETTLE_GRACE_MS 不在位')
  if (consts.defaultMs !== null && consts.maxMs !== null && consts.defaultMs > consts.maxMs) {
    push('S1f-default-above-max', `默认档 ${consts.defaultMs} 高于封顶 ${consts.maxMs} ⇒ 默认值永远被自己改掉`)
  }
  if (!/interface\s+ToolContext\s*\{[\s\S]{0,3000}?\bsignal\s*\??\s*:\s*AbortSignal/.test(src)) {
    push('S1a', 'ToolContext 里没有 signal: AbortSignal ⇒ 取消下发无通道')
  }
  if (!/export function resolveToolExecBudgetMs\s*\(/.test(src)) {
    push('S1b', '唯一解析出口 resolveToolExecBudgetMs 不见了')
  }
  if (codeLineHits(src, /Math\.min\([^)\n]*TOOL_EXEC_BUDGET_MAX_MS/).length === 0) {
    push('S1b-cap', '解析器里没有 Math.min(…, TOOL_EXEC_BUDGET_MAX_MS) ⇒ 任何覆盖都能越界')
  }
  if (!/export function linkAbortSignal\s*\(/.test(src)) {
    push('S1c', 'linkAbortSignal 不见了')
  } else if (rawLineHits(src, /removeEventListener\s*\(\s*['"]abort['"]/).length === 0) {
    push('S1c-unlink', 'linkAbortSignal 没返回真正的解绑 ⇒ 长会话每枚工具调用留下一个永不释放的监听器')
  }
  const applyPoints = codeLineHits(src, /\bexecuteWithinExecBudget\s*\(/).length
  // 其中一处是函数自身所在行(export async function 的名字也在代码行上),所以 ≥2 才算"真被调用"
  if (applyPoints < 2) {
    push('S1d', `executeWithinExecBudget 在代码位上只出现 ${applyPoints} 次(自身定义 1 + 调用 ≥1)⇒ 机制没装车`)
  }
  // "有调用"还不够:本仓工具执行有**两条分支**(hub 分派 / 本地 retry),只接一条等于另一半
  // 仍在无界路径上,所以逐分支各自点名 —— 这一条是被自己的变异对照逼出来的:
  // 第一版 S1d 只数出现次数,把 retry 那一处调用删掉后仍然判绿。
  const retryBody = sliceBraceBlock(src, /export async function executeWithRetry\s*\(/)
  if (!retryBody || !/\bexecuteWithinExecBudget\s*\(/.test(retryBody)) {
    push('S1d-retry', 'executeWithRetry 体内没有 executeWithinExecBudget 调用 ⇒ 本地工具仍走无界路径')
  }
  const hubBody = sliceBraceBlock(src, /if \(hubEnabled && hubResolver\)/)
  if (!hubBody || !/\bexecuteWithinExecBudget\s*\(/.test(hubBody)) {
    push('S1d-hub', 'hubEnabled 分支未走 executeWithinExecBudget ⇒ 特性开关成了绕过墙钟的第二条执行路径')
  }
  return gaps
}

/** S1e:取消信号是否真接进了子 loop。 */
export function findSubagentGaps(subagentSrc) {
  if (typeof subagentSrc !== 'string' || !subagentSrc) {
    return [{ id: 'S0-subagent-file', why: '判定面取不到 tools/subagent.ts 内容' }]
  }
  const block = /runToolLoop\s*\(\s*\{[\s\S]{0,800}?\}\s*\)/.exec(subagentSrc)
  if (!block || !/\bsignal\s*:/.test(block[0])) {
    return [{ id: 'S1e', why: 'subagent.ts 的 runToolLoop({...}) 未传 signal ⇒ 取消进不了子 loop' }]
  }
  return []
}

/** 第二份自建墙钟:同一文件代码位上 Promise.race 与 setTimeout 同时在(排除唯一出口自身)。 */
export function findSecondWatchdogs(rel, src) {
  if (rel === MECHANISM_FILE) return false
  if (typeof src !== 'string') return false
  const masked = maskCodeLines(src).join('\n')
  return /Promise\.race\s*\(/.test(masked) && /setTimeout\s*\(/.test(masked)
}

/** 禁用命名:不得新造 `budget-exempt` 一类豁免通道(注释里写也不行 —— 那正是通道被"预备好"的形态)。 */
export function findForbiddenExemptMarkers(src) {
  const hits = []
  String(src)
    .split(/\r?\n/)
    .forEach((line, i) => {
      if (line.includes(FORBIDDEN_EXEMPT_MARKER)) hits.push(i + 1)
    })
  return hits
}

/** 父级注入点在位情况(棘轮点名用,不判红:该文件不在本票清单内,当场判红就是与改动无关的恒红门)。 */
export function countMissingParentSignal(src) {
  if (typeof src !== 'string' || src === '') return null
  const starts = codeLineHits(src, /const\s+ctx\s*:\s*ToolContext\s*=\s*\{/)
  const lines = src.split(/\r?\n/)
  let missing = 0
  for (const lineNo of starts) {
    const block = lines.slice(lineNo - 1, lineNo + 30).join('\n')
    if (!/\bsignal\s*:/.test(block)) missing += 1
  }
  return missing
}

/**
 * 单文件合规结论(纯函数,可构造)。
 *
 * 分级是刻意的:
 * - `hard` = 摘线/非法声明/禁用命名 ⇒ 零容忍(它们与"存量债"无关:机制不在就是不在)
 * - `ratchet` = 第二份自建墙钟 ⇒ 按"该文件在 HEAD 自身的违规数"锚定,只拦"这次把它加回来了"
 *   (§守门 77/83/98 同一条理由:与本次改动无关的红只会逼人 --no-verify,连带废掉全部守门)
 * - `undetermined` = 声明解析不出数值 ⇒ 既不判红也绝不记为"合规",如实计数
 *
 * @param {number|null} [capMs] 见 parseExecBudgetDeclarations —— 封顶由机制文件同面供给
 * @returns {{hard:Array<{id:string,why:string,line?:number}>, ratchet:number, undetermined:number, declarations:number}}
 */
export function auditFile(rel, src, capMs) {
  const hard = []
  let ratchet = 0
  let undetermined = 0
  let declarations = 0
  if (typeof src !== 'string') {
    return { hard: [{ id: 'S0-read', why: `${rel} 在判定面取不到内容` }], ratchet, undetermined, declarations }
  }
  if (rel === MECHANISM_FILE) hard.push(...findMechanismGaps(src))
  if (rel === SUBAGENT_FILE) hard.push(...findSubagentGaps(src))
  for (const line of findForbiddenExemptMarkers(src)) {
    hard.push({ id: 'X-forbidden-marker', why: `出现禁用命名 ${FORBIDDEN_EXEMPT_MARKER}(豁免通道不得新造)`, line })
  }
  if (rel.startsWith(SCAN_DIR)) {
    for (const decl of parseExecBudgetDeclarations(src, capMs)) {
      declarations += 1
      if (decl.undetermined) {
        undetermined += 1
        continue
      }
      for (const p of decl.problems) hard.push({ id: `B1-${p.code}`, why: p.text, line: decl.line })
    }
    if (findSecondWatchdogs(rel, src)) ratchet += 1
  }
  return { hard, ratchet, undetermined, declarations }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
