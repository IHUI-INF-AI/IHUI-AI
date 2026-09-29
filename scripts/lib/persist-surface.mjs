// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「存储面」解析器 —— 回答**唯一一个问题**:一个 zustand `persist` 选项里的 `partialize`
 * 实际往存储里写哪些键?
 *
 * 为什么要有这一份,而不是让守门直接 `src.matchAll(/Pick<…>/g)`:
 *  2026-09-29 实测(G-601)。上一版语义判据把**整份文件**里出现的每一个
 *  `Pick<AuthStoreState<TUser>, '…'>` 都算成"落盘键集",于是
 *  `selectIsAuthenticated(state: Pick<AuthStoreState<TUser>, 'token'>)` —— 一处**读侧**
 *  选择器的形参类型 —— 被读成"把 token 写进存储",门对着一份根本不落盘 token 的实现
 *  恒红。它挂在 `scripts/lib/pre-commit-hook.js` 的批外 blocking 步上,于是这台机每次提交
 *  都合法地走 `--no-verify`,链上全部守门对每次提交作废(AGENTS §12f 那一型)。
 *
 * ⇒ 判据必须把「键集」绑到**被返回的那一份值**上,而不是"这行出现过 token 字样"。
 * 三条取材,全部按语法形状,不锚定任何具体字符串:
 *   ① 返回值的类型标注上的 `Pick<State, 'a' | 'b'>` 联合(箭头返回标注 / 变量声明标注 / `as` 断言)
 *   ② 返回的对象字面量的**顶层**键
 *   ③ `...omit(state, 'a', 'b')` 的排除清单 —— 已知 token 档被逐个排除即证明其不落盘
 * 判不准的形状(动态键 `[k]:`、变量间接、展开自别处、非 omit 的整态展开)一律落
 * **未判定**并逐条点名,**不得记为通过**(本仓最高频失效型就是"把没判写成判过了")。
 *
 * 只被守门 `scripts/check-cross-store-parity.mjs` 与它的镜像测试引用 ⇒ 一份实现,零漂移(§3)。
 */
import { maskComments } from './code-mask.mjs'

/** token 材料的键名特征:含 `token`(accessToken / refreshToken / id_token / …)即算。 */
export const TOKEN_KEY_RE = /token/i

/** 状态接口名:标注里的 `Pick<该名字<…>, …>` 才是本解析器认的键集声明。 */
const DEFAULT_STATE_TYPE = 'AuthStoreState'

const isSpace = (c) => c === ' ' || c === '\t' || c === '\n' || c === '\r'

/**
 * 从 `from` 起读一段**值表达式**:到深度 0 的 `,` / `;` 为止,或遇到与外层不配对的 `)` `]` `}` 为止。
 * 输入必须是遮掉注释后的文本(否则注释里的逗号/括号会把区间切断)。
 *
 * 必须同时数尖括号 `<>`:TS 的返回类型标注长在箭头**之前**,而标注里的联合分隔符就是逗号 ——
 * `partialize: (s): Pick<AuthStoreState<TUser>, 'user' | 'accessToken'> => (…)`,只数圆括号的话
 * 值表达式会在 `<TUser>` 后那个逗号上被截断,判据于是**看不见 accessToken**(漏报比误报更贵)。
 * 反过来数多了也不怕:未闭合的 `<`(极端写法里的比较运算)只会让读取越过本属性,后续解析不出对象
 * 时按**未判定**点名,不会静默给出"键集里没有 token"的结论。
 */
function readValueExpr(text, from) {
  let i = from
  while (i < text.length && isSpace(text[i])) i += 1
  const begin = i
  let depth = 0
  let angle = 0
  for (; i < text.length; i += 1) {
    const c = text[i]
    if (c === '(' || c === '{' || c === '[') depth += 1
    else if (c === ')' || c === '}' || c === ']') {
      if (depth === 0 && angle === 0) break // 外层容器结束 ⇒ 值表达式到此为止
      if (depth > 0) depth -= 1
    } else if (c === '<') angle += 1
    else if (c === '>' && angle > 0) angle -= 1
    else if (depth === 0 && angle === 0 && (c === ',' || c === ';')) break
  }
  return text.slice(begin, i)
}

/** 找箭头函数在**本段文本深度 0** 上的 `=>`;找不到返回 -1(说明 partialize 是个引用而非内联箭头)。 */
function findTopLevelArrow(text) {
  let depth = 0
  let angle = 0
  for (let i = 0; i < text.length - 1; i += 1) {
    const c = text[i]
    if (c === '(' || c === '{' || c === '[') depth += 1
    else if (c === ')' || c === '}' || c === ']') {
      if (depth > 0) depth -= 1
    } else if (c === '<') angle += 1
    else if (c === '>' && angle > 0) angle -= 1
    else if (depth === 0 && angle === 0 && c === '=' && text[i + 1] === '>') return i
  }
  return -1
}

/** 取箭头形参里的第一个标识符(= 整态参数的名字,用于判 `=> s` / `...s` 这类整态落盘)。 */
function paramIdentOf(paramsText) {
  const m = paramsText.match(/^\s*(?:\(\s*)?([A-Za-z_$][\w$]*)/)
  return m ? m[1] : null
}

/**
 * 解析对象字面量体的**顶层**成员。
 * 返回 `{ keys, computed, spreads }`:
 *  - keys:显式键名(含简写 `foo,` 与方法名 `foo()`)
 *  - computed:动态键 `[k]: …` 的原文 ⇒ 未判定
 *  - spreads:`...` 后面的源表达式 ⇒ 逐个归类
 */
function parseObjectBody(body) {
  const keys = []
  const computed = []
  const spreads = []
  let depth = 0
  let start = 0
  const cut = (end) => {
    const entry = body.slice(start, end).trim()
    if (!entry) return
    if (entry.startsWith('...')) {
      spreads.push(entry.slice(3).trim())
      return
    }
    const cm = entry.match(/^\[([\s\S]*?)\]\s*:/)
    if (cm) {
      computed.push(cm[1].trim())
      return
    }
    const km = entry.match(/^(?:get\s+|set\s+|async\s+)?(['"]?)([A-Za-z_$][\w$]*)\1\s*[:(]/)
    if (km) keys.push(km[2])
    else if (/^[A-Za-z_$][\w$]*$/.test(entry)) keys.push(entry) // 简写 `{ user }`
  }
  for (let i = 0; i < body.length; i += 1) {
    const c = body[i]
    if (c === '(' || c === '{' || c === '[') depth += 1
    else if (c === ')' || c === '}' || c === ']') depth -= 1
    else if (depth === 0 && c === ',') {
      cut(i)
      start = i + 1
    }
  }
  cut(body.length)
  return { keys, computed, spreads }
}

/** 取字面量体:文本以 `{` 开头时返回其配对内部,否则 null。 */
function objectBody(text) {
  const t = text.trim()
  const wrapped = /^\(\s*\{[\s\S]*\}\s*\)$/.test(t)
    ? t.replace(/^\(\s*\{/, '{').replace(/\}\s*\)$/, '}')
    : t
  if (!wrapped.startsWith('{')) return null
  let depth = 0
  for (let i = 0; i < wrapped.length; i += 1) {
    const c = wrapped[i]
    if (c === '{') depth += 1
    else if (c === '}') {
      depth -= 1
      if (depth === 0) return wrapped.slice(1, i)
    }
  }
  return null
}

/**
 * 从一段**类型标注/断言文本**里取 `Pick<StateType<…>, 'a' | 'b'>` 的键联合。
 * 用尖括号配平取实参,不用 `[^>]*` —— 后者遇到 `Pick<AuthStoreState<TUser>, …>` 会停在
 * 内层的 `>` 上(那正是把整态 Pick 读成空、或把读侧 Pick 混进来的成因)。
 * 键位写成 `keyof …` 之类非字面量时 ⇒ 判不出,由调用方计未判定。
 */
export function pickKeyUnion(typeText, stateTypeName = DEFAULT_STATE_TYPE) {
  const out = { keys: [], keyofUsed: false, found: false }
  if (typeof typeText !== 'string' || typeText.length === 0) return out
  let from = 0
  for (;;) {
    const at = typeText.indexOf('Pick<', from)
    if (at < 0) break
    let depth = 0
    let end = -1
    for (let i = at + 4; i < typeText.length; i += 1) {
      const c = typeText[i]
      if (c === '<') depth += 1
      else if (c === '>') {
        depth -= 1
        if (depth === 0) {
          end = i
          break
        }
      }
    }
    if (end < 0) break
    const inner = typeText.slice(at + 5, end)
    // 顶层逗号切两个实参(内层 `<…>` 不算)
    let d = 0
    const parts = []
    let start = 0
    for (let i = 0; i < inner.length; i += 1) {
      const c = inner[i]
      if (c === '<') d += 1
      else if (c === '>') d -= 1
      else if (d === 0 && c === ',') {
        parts.push(inner.slice(start, i))
        start = i + 1
      }
    }
    parts.push(inner.slice(start))
    from = end + 1
    const base = (parts[0] || '').trim().replace(/<[\s\S]*$/, '')
    if (base !== stateTypeName) continue
    out.found = true
    const keyPart = parts[1] || ''
    const literals = [...keyPart.matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1])
    if (literals.length > 0) out.keys.push(...literals)
    if (/\bkeyof\b/.test(keyPart)) out.keyofUsed = true
  }
  return out
}

/**
 * 取状态类型自己声明的成员键(用来判"整态落盘"到底意味着什么)。
 * 按**花括号配平**取,而不是 `\n\}` 收尾 —— 单行 `interface X { a: T; token: string }` 用行锚定
 * 正则整块读不到,而读不到成员清单的后果是"整态落盘"被判成判不出(放行),那比误报更贵。
 *
 * 成员分隔符两型都必须认:本仓真实接口是**换行分隔**(`user: TUser | null` 一行一个),
 * 而夹具/紧凑写法常用 `;`。只数 `;` 的版本会把整张接口读成"只有第一个成员",
 * 后果不是报错而是**静默少判**:token 档读不到 ⇒ 整态落盘判不出 ⇒ 门对着真违规报绿。
 * 嵌套对象/泛型参数里的 `name:` 不算成员(先把深度 >0 的字符抹平)。
 */
export function interfaceMemberKeys(maskedText, stateTypeName = DEFAULT_STATE_TYPE) {
  const esc = stateTypeName.replace(/[$]/g, '\\$&')
  const at = maskedText.search(new RegExp(`(?:interface|type)\\s+${esc}\\b`))
  if (at < 0) return []
  const open = maskedText.indexOf('{', at)
  if (open < 0) return []
  let depth = 0
  let close = -1
  for (let i = open; i < maskedText.length; i += 1) {
    const c = maskedText[i]
    if (c === '{') depth += 1
    else if (c === '}') {
      depth -= 1
      if (depth === 0) {
        close = i
        break
      }
    }
  }
  if (close < 0) return []
  const body = maskedText.slice(open + 1, close)
  // 只留顶层字符:嵌套容器(对象类型 / 泛型实参 / 函数签名)整块抹平,换行留着当分隔符
  let flat = ''
  let d = 0
  let a = 0
  for (const c of body) {
    if (c === '{' || c === '[' || c === '(') {
      d += 1
      flat += ' '
      continue
    }
    if (c === '}' || c === ']' || c === ')') {
      if (d > 0) d -= 1
      flat += ' '
      continue
    }
    if (c === '<') {
      a += 1
      flat += ' '
      continue
    }
    if (c === '>') {
      if (a > 0) a -= 1
      flat += ' '
      continue
    }
    flat += d === 0 && a === 0 ? c : c === '\n' ? '\n' : ' '
  }
  const keys = []
  for (const seg of flat.split(/[\n;]+/)) {
    const m = seg.match(/^\s*(?:readonly\s+)?([A-Za-z_$][\w$]*)\s*\??\s*:/)
    if (m && !keys.includes(m[1])) keys.push(m[1])
  }
  return keys
}

/** 收集一段文本里所有"顶层 return"的表达式(块体内,深度 0)。 */
function returnsInBlock(blockBody) {
  const out = []
  let depth = 0
  for (let i = 0; i < blockBody.length - 6; i += 1) {
    const c = blockBody[i]
    if (c === '(' || c === '{' || c === '[') depth += 1
    else if (c === ')' || c === '}' || c === ']') depth -= 1
    else if (
      depth === 0 &&
      c === 'r' &&
      /\breturn\b/.test(blockBody.slice(i, i + 7)) &&
      (i === 0 || /[^A-Za-z0-9_$]/.test(blockBody[i - 1]))
    ) {
      const v = readValueExpr(blockBody, i + 6)
      if (v.trim()) out.push(v.trim())
      i += 6
    }
  }
  return out
}

/** 在区内找 `const|let|var <id> [:标注] = <值>`;找不到返回 null。 */
function findDeclaration(scopeText, id) {
  const esc = id.replace(/[$]/g, '\\$&')
  const re = new RegExp(`(?:^|[^\\w$])(?:const|let|var)\\s+${esc}\\b`, '')
  const m = scopeText.match(re)
  if (!m) return null
  const at = (m.index ?? 0) + m[0].length
  const eq = scopeText.indexOf('=', at)
  if (eq < 0) return null
  return { annotation: scopeText.slice(at, eq), value: readValueExpr(scopeText, eq + 1) }
}

/**
 * 主入口。返回:
 * ```
 * { hasPartialize, returnedForm, persistedKeys, pickKeys, literalKeys, stateTokenKeys,
 *   persistedTokenKeys, omitExcludedTokenKeys, undetermined:[{ reason, snippet }], notes:[] }
 * ```
 * `persistedTokenKeys` 非空 ⇒ **判红**;`undetermined` 非空 ⇒ 只能报"未判定",不得记绿。
 */
export function analyzePersistSurface(src, opts = {}) {
  const stateType = opts.stateType || DEFAULT_STATE_TYPE
  const masked = maskComments(typeof src === 'string' ? src : '')
  const res = {
    hasPartialize: /\bpartialize\s*:/.test(masked),
    returnedForm: null,
    persistedKeys: [],
    pickKeys: [],
    literalKeys: [],
    stateTokenKeys: [],
    persistedTokenKeys: [],
    omitExcludedTokenKeys: [],
    undetermined: [],
    notes: [],
  }

  // 状态接口自己声明的 token 档(用来判"整态落盘"到底意味着什么)
  for (const k of interfaceMemberKeys(masked, stateType)) {
    if (TOKEN_KEY_RE.test(k)) res.stateTokenKeys.push(k)
  }
  if (!res.hasPartialize) return res

  const seenKeys = new Set()
  const addKey = (k) => {
    if (typeof k === 'string' && k && !seenKeys.has(k)) {
      seenKeys.add(k)
      res.persistedKeys.push(k)
    }
  }

  for (const m of masked.matchAll(/\bpartialize\s*:/g)) {
    const value = readValueExpr(masked, m.index + m[0].length)
    if (!value.trim()) {
      res.undetermined.push({ reason: 'partialize 取不到值表达式', snippet: 'partialize:' })
      continue
    }
    const arrowAt = findTopLevelArrow(value)
    let returned = []
    let paramIdent = null
    if (arrowAt < 0) {
      // `partialize: userPartialize` / `partialize: pick(...)` ⇒ 键集住在别处
      res.returnedForm = res.returnedForm || 'reference'
      res.undetermined.push({
        reason: 'partialize 是对别处函数/表达式的引用,键集不在本处可枚举',
        snippet: value.trim().slice(0, 60),
      })
      continue
    }
    const paramsText = value.slice(0, arrowAt)
    const bodyText = value.slice(arrowAt + 2).trim()
    paramIdent = paramIdentOf(paramsText)
    if (bodyText.startsWith('{')) {
      const inner = objectBody(bodyText)
      res.returnedForm = res.returnedForm || 'block'
      if (inner === null) {
        res.undetermined.push({
          reason: 'partialize 块体括号配不平',
          snippet: bodyText.trim().slice(0, 60),
        })
        continue
      }
      returned = returnsInBlock(inner)
      if (returned.length === 0) {
        res.undetermined.push({
          reason: 'partialize 块体内没有 return ⇒ 落盘键集判不出',
          snippet: 'partialize: (…) => {…}',
        })
        continue
      }
    } else {
      res.returnedForm = res.returnedForm || 'expression'
      returned = [bodyText.trim()]
      if (objectBody(bodyText) === null && /^\(/.test(bodyText.trim())) {
        res.undetermined.push({
          reason: 'partialize 表达式体解析不出对象',
          snippet: bodyText.trim().slice(0, 60),
        })
        continue
      }
    }

    for (const exprText of returned) {
      // ① Pick 标注:变量声明标注 / `as Pick<…>` / 箭头返回类型标注
      const asCast = exprText.match(/\bas\s+([\s\S]+)$/)
      const declId = exprText.match(/^([A-Za-z_$][\w$]*)$/)?.[1] ?? null
      let decl = null
      if (declId) {
        // 返回一个整态参数 ⇒ 全部状态键落盘
        if (paramIdent && declId === paramIdent) {
          if (res.stateTokenKeys.length > 0) {
            for (const k of res.stateTokenKeys) addKey(k)
            res.notes.push(
              `partialize 直接返回形参 ${declId}(整态)⇒ 已知 token 档 ${res.stateTokenKeys.join(', ')} 全部落盘`,
            )
          } else {
            res.undetermined.push({
              reason: `partialize 返回整态 ${declId},而状态接口里取不到任何成员清单`,
              snippet: exprText.trim().slice(0, 40),
            })
          }
          continue
        }
        decl = findDeclaration(masked, declId)
        if (!decl) {
          res.undetermined.push({
            reason: `返回值 ${declId} 的声明在本文件取不到 ⇒ 键集判不出`,
            snippet: exprText.trim().slice(0, 40),
          })
          continue
        }
      }
      const annotationTexts = []
      if (asCast) annotationTexts.push(asCast[1])
      if (decl?.annotation) annotationTexts.push(decl.annotation)
      // 箭头自身的返回标注:`(s): Pick<…> => ({…})` ⇒ 落在 paramsText 与 body 之间
      const ownAnn = paramsText.match(/\)\s*:\s*([\s\S]+)$/)
      if (ownAnn) annotationTexts.push(ownAnn[1])
      // 刻意不把"表达式原文"也当标注扫:嵌套成员上的 `as Pick<…,'token'>` 不是落盘键集,
      // 扫它会原样重犯 G-601 那一型(读侧标注被当成写侧键集)。

      const picked = []
      let keyofUsed = false
      for (const t of annotationTexts) {
        const p = pickKeyUnion(t, stateType)
        if (p.keys.length) picked.push(...p.keys)
        if (p.keyofUsed) keyofUsed = true
      }
      if (keyofUsed)
        res.undetermined.push({
          reason: 'Pick 的键位写成 keyof …(非字面量联合)⇒ 键集判不出',
          snippet: 'Pick<State, keyof …>',
        })
      for (const k of picked) {
        if (!res.pickKeys.includes(k)) res.pickKeys.push(k)
        addKey(k)
      }

      // ② 对象字面量顶层键
      const literalSource = decl ? decl.value : exprText
      const lit = objectBody(literalSource)
      if (lit !== null) {
        const { keys, computed, spreads } = parseObjectBody(lit)
        for (const k of keys) {
          if (!res.literalKeys.includes(k)) res.literalKeys.push(k)
          addKey(k)
        }
        for (const c of computed)
          res.undetermined.push({
            reason: '动态计算键 `[k]:` ⇒ 落盘键集枚举不全',
            snippet: `[${c}]:`,
          })
        for (const sp of spreads) {
          const omitM = sp.match(/^omit\s*\(([\s\S]*)\)$/)
          if (omitM) {
            const omitted = [...omitM[1].matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1])
            if (omitted.length === 0) {
              res.undetermined.push({
                reason: '...omit(...) 的排除清单不是字面量 ⇒ 判不出 token 是否被排除',
                snippet: sp.slice(0, 60),
              })
              continue
            }
            const stillIn = res.stateTokenKeys.filter((k) => !omitted.includes(k))
            if (stillIn.length > 0) {
              for (const k of stillIn) addKey(k)
              res.notes.push(`...omit(...) 没排除 ${stillIn.join(', ')} ⇒ 视为落盘`)
            } else {
              for (const k of res.stateTokenKeys)
                if (!res.omitExcludedTokenKeys.includes(k)) res.omitExcludedTokenKeys.push(k)
            }
            continue
          }
          if (paramIdent && sp === paramIdent) {
            if (res.stateTokenKeys.length > 0) {
              for (const k of res.stateTokenKeys) addKey(k)
              res.notes.push(
                `...${sp}(整态展开)⇒ 已知 token 档 ${res.stateTokenKeys.join(', ')} 全部落盘`,
              )
            } else {
              res.undetermined.push({
                reason: `...${sp} 是整态展开而状态接口取不到成员清单`,
                snippet: sp.slice(0, 40),
              })
            }
            continue
          }
          // 成员展开(`...state.user`)/ 调用展开(`...partial`):不引入状态层键,但键集仍不闭合
          res.undetermined.push({
            reason: `展开自别处(...${sp.slice(0, 30)})⇒ 顶层键集枚举不全`,
            snippet: `...${sp.slice(0, 40)}`,
          })
        }
      } else if (!picked.length) {
        res.undetermined.push({
          reason: '返回值既不是对象字面量也没有 Pick 标注 ⇒ 落盘键集判不出',
          snippet: exprText.trim().slice(0, 60),
        })
      }
    }
  }

  res.persistedTokenKeys = res.persistedKeys.filter((k) => TOKEN_KEY_RE.test(k))
  return res
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
