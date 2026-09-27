// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 锁 B —— api-client 的 401 出口:**两条分支各自都要有"重试仍 401 ⇒ 通知"这一格**。
 *
 * 立因(真机量出来的):设备上会话已死,能力上报每 60s 拿一次 401,而用户永远进不了登录页。
 * 成因在 `packages/api-client/src/client.ts` 的 `fetchApi` —— 整块 401 处理挂在
 * `!authRetried` 上,于是"续期拿到了新 token → 重试仍 401"这一格**被整个跳过**,连通知都不发。
 * 而它恰恰是最不可恢复的那种 401(新凭据也被服务端拒了)。`09e5774e4d` 把两条分支(无熔断
 * 循环 / 带熔断路径)各补了一个通知出口。
 *
 * 这一格此前同样无人看守,而且**比锁 A 更容易被一次重构悄悄改回去**:把它改回 `!authRetried`
 * 短路,typecheck / lint / 单测全都不会红(守门 148 的 AP3 只数"notifyUnauthorized 有没有调用点",
 * 看不见调用点在**哪一格的哪一侧**)。
 *
 * 判据按**结构**读,不数全文出现次数:
 *   fetchApi 函数体(括号配平) → 按 `if (!circuitBreaker)` 的**真值分支体**切出「无熔断区」,
 *   其余下的函数体尾部即「带熔断区」 → 区内逐处 `notifyUnauthorized(` 调用,沿**祖先 if 帧链**
 *   找守卫条件。要求:
 *     · 无熔断区 ∃ 调用,其链上有一帧的条件就是 `authRetried`(真值分支,不是 `!authRetried`)
 *     · 带熔断区 ∃ 调用,其链上有一帧测 `401` 且该帧**嵌在** `newToken` 真值分支里
 *       (即"重试之后又量了一次状态")
 *   两个条件是**同一命题在两种代码形态下的样子**,所以各写一条;共用的只有帧链提取那一遍。
 *
 * 阳性对照:`09e5774e4d^:packages/api-client/src/client.ts` 喂同一判据 ⇒ 两区各判红(它当时
 * 每区只有"续期没拿到 token"那一格有通知)。由「计数反证」钉住为什么不许数出现次数:
 * 往那个旧版本里塞一行**注释**写着 notifyUnauthorized(...),全文计数就会追平现值,而结构上一格没多。
 *
 * 取材口径同 70/77/83/98/101/103/118:判**仓库内容** ⇒ HEAD blob;两面(HEAD 与对照)在
 * **同一次 cat-file --batch** 里读满(分开两次取会在并行会话推进的瞬间产出自洽却错位的尺子)。
 * 遮罩只有一份实现:`scripts/lib/code-mask.mjs`(注释与字符串等长抹除,故偏移与行号不变)。
 * 本文件刻意不出现 `execFileSync(` / 按磁盘 `readFileSync` 判被审内容 —— 由最后一条形状锁钉住。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import { catBatch } from '../lib/face-reader.mjs'
import { maskCommentsAndStrings } from '../lib/code-mask.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const CLIENT = 'packages/api-client/src/client.ts'
/** 修好出口的那枚提交;它的父版本就是阳性对照。 */
const FIX_SHA = '09e5774e4d'

// ─────────────────────────────────── 结构原语(括号/花括号配平,跳过串与注释)

const isWs = (c) => c === ' ' || c === '\t' || c === '\n' || c === '\r'

function skipWs(s, i) {
  let j = i
  while (j < s.length && isWs(s[j])) j++
  return j
}

function skipString(s, i) {
  const q = s[i]
  let j = i + 1
  while (j < s.length) {
    if (s[j] === '\\') {
      j += 2
      continue
    }
    if (s[j] === q) return j + 1
    if (s[j] === '\n' && q !== '`') return j
    j++
  }
  return s.length
}

/** i 指向 `(` ⇒ 配对 `)` 下标(跳过 `{…}` 与字符串)。 */
function matchParen(s, i) {
  let depth = 0
  for (let j = i; j < s.length; j++) {
    const c = s[j]
    if (c === "'" || c === '"' || c === '`') {
      j = skipString(s, j) - 1
      continue
    }
    if (c === '{') {
      const end = matchBrace(s, j)
      if (end >= 0) j = end
      continue
    }
    if (c === '(') depth++
    else if (c === ')' && --depth === 0) return j
  }
  return -1
}

/** i 指向 `{` ⇒ 配对 `}` 下标(跳过串与嵌套花括号)。 */
function matchBrace(s, i) {
  let depth = 0
  for (let j = i; j < s.length; j++) {
    const c = s[j]
    if (c === "'" || c === '"' || c === '`') {
      j = skipString(s, j) - 1
      continue
    }
    if (c === '{') depth++
    else if (c === '}' && --depth === 0) return j
  }
  return -1
}
/**
 * [from,to) 内所有 `if (…) { … }` 的**真值分支体**区间。
 * 只登记块体(单语句 `if (x) return` 不登记)—— 本锁认的两种写法都是块;
 * 若将来有人把它改成单语句,表现为"该格找不到" ⇒ 红,而不是静默通过。
 */
function collectIfFrames(code, from, to) {
  const frames = []
  const re = /\bif\s*\(/g
  re.lastIndex = from
  let m
  while ((m = re.exec(code)) !== null && m.index < to) {
    const open = code.indexOf('(', m.index)
    const close = open < 0 ? -1 : matchParen(code, open)
    if (close < 0) continue
    const cond = code
      .slice(open + 1, close)
      .replace(/\s+/g, ' ')
      .trim()
    const braceAt = skipWs(code, close + 1)
    if (code[braceAt] !== '{') continue
    const bodyEnd = matchBrace(code, braceAt)
    if (bodyEnd < 0) continue
    frames.push({ cond, start: braceAt + 1, end: bodyEnd })
    re.lastIndex = braceAt + 1
  }
  return frames
}

const callSites = (code, from, to, name) => {
  const re = new RegExp(`\\b${name}\\s*\\(`, 'g')
  re.lastIndex = Math.max(0, from)
  const out = []
  let m
  while ((m = re.exec(code)) !== null && m.index < to) out.push(m.index)
  return out
}

const truthyFlag = (cond, flag) =>
  !cond.startsWith('!') && new RegExp(`^${flag}(?:\\s*===?\\s*true)?$`).test(cond)
const is401Test = (cond) => /===\s*401/.test(cond)

/** 调用点的祖先 if 帧(外 → 内)。 */
function chainOf(frames, idx) {
  return frames
    .filter((f) => f.start <= idx && idx < f.end)
    .sort((a, b) => a.start - b.start || b.end - a.end)
}

// ─────────────────────────────────── 判据

const CELLS = {
  noBreaker: '无熔断循环:「重试仍 401 ⇒ 通知」',
  breaker: '带熔断路径:「重试仍 401 ⇒ 通知」',
}

/**
 * @param {string} source client.ts 全文
 * @returns {{status:'ok'|'undetermined', why:string[], cells:Record<string,boolean>, seen:object}}
 */
export function analyzeUnauthorizedExits(source) {
  const code = maskCommentsAndStrings(typeof source === 'string' ? source : '')
  const out = {
    status: 'undetermined',
    why: [],
    cells: { noBreaker: false, breaker: false },
    seen: { bodyFound: false, regions: false, calls: {}, frames: {} },
  }
  const decl = /export\s+async\s+function\s+fetchApi\b/.exec(code)
  if (!decl) {
    out.why.push('找不到 `export async function fetchApi` ⇒ 出口换了宿主,判据看不见(不记绿)')
    return out
  }
  const pOpen = code.indexOf('(', decl.index)
  const pClose = pOpen < 0 ? -1 : matchParen(code, pOpen)
  // 参数表右括号之后是返回类型标注。函数体的 `{` = 泛型角度深度归零后遇到的第一个 `{`;
  // 若将来返回类型里真写了大括号(内联对象类型),这里会取错起点 —— 随后 `!circuitBreaker`
  // 区找不到 ⇒ 判「无法判定」并点名,不会误记绿(失效方向必须是"多要一次人工核对")。
  let bodyOpen = -1
  if (pClose >= 0) {
    let angle = 0
    for (let i = pClose + 1; i < code.length; i++) {
      const c = code[i]
      if (c === '<') angle++
      else if (c === '>') angle--
      else if (c === '{' && angle === 0) {
        bodyOpen = i
        break
      }
    }
  }
  if (bodyOpen < 0) {
    out.why.push('fetchApi 的函数体大括号起点解析失败(返回类型里出现大括号等新形态)')
    return out
  }
  const bodyClose = matchBrace(code, bodyOpen)
  if (bodyClose < 0) {
    out.why.push('fetchApi 函数体括号配平失败')
    return out
  }
  out.seen.bodyFound = true
  const from = bodyOpen + 1
  const to = bodyClose

  const frames = collectIfFrames(code, from, to)
  const nb = frames.find((f) => /!\s*circuitBreaker\b/.test(f.cond))
  if (!nb || nb.end >= to - 1) {
    out.why.push(
      '找不到 `if (!circuitBreaker)` 区(或其后没有带熔断分支)⇒ 两条分支的形状已改,判据需同步',
    )
    return out
  }
  out.seen.regions = true
  const regions = { noBreaker: { from: nb.start, to: nb.end }, breaker: { from: nb.end + 1, to } }
  const inRegion = (r, idx) => idx >= r.from && idx < r.to
  const regionFrames = (r) => frames.filter((f) => inRegion(r, f.start) && f.end <= r.to)

  for (const [key, r] of Object.entries(regions)) {
    const calls = callSites(code, r.from, r.to, 'notifyUnauthorized')
    const rf = regionFrames(r)
    out.seen.calls[key] = calls.length
    out.seen.frames[key] = rf.length
    if (calls.length === 0) {
      out.why.push(`${CELLS[key]} 所在区一条通知都没有(整块 401 处理可能被删)⇒ 判红`)
      continue
    }
    let hit = false
    for (const idx of calls) {
      const chain = chainOf(rf, idx)
      if (key === 'noBreaker') {
        if (chain.some((f) => truthyFlag(f.cond, 'authRetried'))) hit = true
      } else {
        const tFrame = chain.find((f) => truthyFlag(f.cond, 'newToken'))
        if (tFrame && chain.some((f) => is401Test(f.cond) && f.start > tFrame.start)) hit = true
      }
      if (hit) break
    }
    out.cells[key] = hit
    if (!hit) {
      const missing =
        key === 'noBreaker'
          ? '没有 `if (authRetried)` 真值分支(把它改回 `!authRetried` 短路 = 会话死了不发通知,2026-09-27 真机事故原样)'
          : '没有「newToken 真值分支里再测一次 401」的嵌套(重试结果不再量状态 = 同一格静默)'
      out.why.push(
        `${CELLS[key]} 这一格找不到 —— 区内 ${calls.length} 处 notifyUnauthorized 的守卫链里${missing}`,
      )
    }
  }
  out.status = 'ok'
  return out
}

const failuresOf = (a) =>
  a.status === 'undetermined' ? [`无法判定:${a.why.join(' / ')}`] : a.why.slice()

// ─────────────────────────────────── 用例

// 两面在**同一次** cat-file --batch 里读满:分开取会在并行会话推进的瞬间产出自洽却错位的尺子。
const HEAD_SPEC = `HEAD:${CLIENT}`
const CONTROL_SPEC = `${FIX_SHA}^:${CLIENT}`
const BLOBS = catBatch(ROOT, [HEAD_SPEC, CONTROL_SPEC], { maxBuffer: 64 << 20 })
const HEAD_SRC = BLOBS.get(HEAD_SPEC)
const CONTROL_SRC = BLOBS.get(CONTROL_SPEC)

test('取材两面必须都在被审面上拿到(拿不到就是无法判定,不得继续判颜色)', () => {
  assert.ok(typeof HEAD_SRC === 'string' && HEAD_SRC.length > 0, `HEAD 面取不到 ${CLIENT}`)
  assert.ok(
    typeof CONTROL_SRC === 'string' && CONTROL_SRC.length > 0,
    `${FIX_SHA}^ 面取不到 ${CLIENT} ⇒ 阳性对照失效(该提交不在被审历史里?)`,
  )
})

test('HEAD:两条 401 分支各有一格「重试仍 401 ⇒ 通知」,且判据真的看见了结构', () => {
  const a = analyzeUnauthorizedExits(HEAD_SRC)
  assert.equal(a.status, 'ok', a.why.join(' / '))
  assert.equal(a.cells.noBreaker, true, a.why.join(' / '))
  assert.equal(a.cells.breaker, true, a.why.join(' / '))
  // 空扫不算通过:两区都必须真数到调用点与 if 帧
  assert.ok(
    a.seen.calls.noBreaker >= 2,
    `无熔断区只数到 ${a.seen.calls.noBreaker} 处调用 ⇒ 判据失明`,
  )
  assert.ok(a.seen.calls.breaker >= 2, `带熔断区只数到 ${a.seen.calls.breaker} 处调用 ⇒ 判据失明`)
  assert.ok(
    a.seen.frames.noBreaker > 0 && a.seen.frames.breaker > 0,
    '任一区一帧 if 都没解析出来 ⇒ 判据失明',
  )
})

test(`阳性对照:${FIX_SHA}^ 喂同一判据 ⇒ 两区各判红`, () => {
  const a = analyzeUnauthorizedExits(CONTROL_SRC)
  const fails = failuresOf(a)
  console.info(`[锁 B 阳性对照 ${FIX_SHA}^] ${a.status} / 未通过格数 = ${fails.length}`)
  for (const f of fails) console.info(`  ✗ ${f}`)
  assert.equal(a.status, 'ok', '旧版本仍应能解析出两条分支;解析失败说明对照读错了面')
  assert.equal(a.cells.noBreaker, false, '旧版无熔断区本该没有这一格,判绿=尺子坏了')
  assert.equal(a.cells.breaker, false, '旧版带熔断区本该没有这一格,判绿=尺子坏了')
  assert.equal(fails.length, 2, `应当恰好红两格,实际:\n${fails.join('\n')}`)
  assert.match(fails.join('\n'), /无熔断循环/)
  assert.match(fails.join('\n'), /带熔断路径/)
})

/** 删除**整行**匹配的第 n 处(行内容逐字等值,不做子串匹配 —— 12 空格那处是 14 空格那处的子串)。 */
function dropLine(src, line, nth = 0) {
  const lines = src.split('\n')
  const hits = lines.map((l, i) => (l === line ? i : -1)).filter((i) => i >= 0)
  assert.ok(hits.length > nth, `构造锚点未命中(找到 ${hits.length} 处,要第 ${nth + 1} 处):${line}`)
  lines.splice(hits[nth], 1)
  return lines.join('\n')
}

test('构造对照:两格各自独立 —— 删一处通知只红对应那一格', () => {
  // 无熔断区:`if (authRetried)` 真值分支里的那一处(与"续期没拿到 token"那一处同缩进,取第 1 处)
  const nb = dropLine(
    HEAD_SRC,
    '              notifyUnauthorized(normalizedUrl, restOptions.method)',
    0,
  )
  const aNb = analyzeUnauthorizedExits(nb)
  assert.equal(aNb.status, 'ok', aNb.why.join(' / '))
  assert.equal(aNb.cells.noBreaker, false, '删掉 authRetried 分支里的通知后仍判绿 ⇒ 本判据无牙')
  assert.equal(aNb.cells.breaker, true, '不该连带把另一格也判红(两格各自独立成立)')

  // 带熔断路径:重试之后"再判一次 401"里的那一处(12 空格,全文件唯一)
  const br = dropLine(
    HEAD_SRC,
    '            notifyUnauthorized(normalizedUrl, restOptions.method)',
    0,
  )
  const aBr = analyzeUnauthorizedExits(br)
  assert.equal(aBr.status, 'ok', aBr.why.join(' / '))
  assert.equal(aBr.cells.breaker, false, '删掉熔断路径重试后的通知后仍判绿 ⇒ 本判据无牙')
  assert.equal(aBr.cells.noBreaker, true, '不该连带把另一格也判红')
})

test('计数反证:往旧版本补几行**注释**里的调用点 ⇒ 全文计数追平现值而结构一格没多', () => {
  const count = (s) => (s.match(/\bnotifyUnauthorized\s*\(/g) ?? []).length
  const anchor = 'function notifyUnauthorized(url: string, method: string | undefined): void {'
  assert.ok(CONTROL_SRC.includes(anchor), '构造锚点未命中 ⇒ 本例失效')
  const gap = count(HEAD_SRC) - count(CONTROL_SRC)
  assert.ok(gap > 0, `现值与对照的全文计数差为 ${gap} ⇒ 本例的"追平"无从构造,换更硬的对照再来`)
  const padding = Array.from(
    { length: gap },
    () => '// notifyUnauthorized(normalizedUrl, restOptions.method)',
  ).join('\n')
  const noisy = CONTROL_SRC.replace(anchor, `${padding}\n${anchor}`)
  assert.equal(count(noisy), count(HEAD_SRC), '计数式判据在这一份输入上看到的就是现值的数字')
  const a = analyzeUnauthorizedExits(noisy)
  assert.equal(a.status, 'ok')
  assert.equal(a.cells.noBreaker, false, '注释里的调用点被算成了格 ⇒ 遮罩没生效,门会给自己发合格证')
  assert.equal(a.cells.breaker, false, '同上')
})

test('失明对照:fetchApi 不在了 / 整块 401 处理被删 ⇒ 不得记为通过', () => {
  const a = analyzeUnauthorizedExits('export const fetchApi = null\n')
  assert.equal(a.status, 'undetermined')
  assert.match(a.why.join('\n'), /不记绿/)

  // 把两区里的 notifyUnauthorized 调用全部抹掉(保留函数与其它代码)
  const stripped = HEAD_SRC.split('notifyUnauthorized(normalizedUrl, restOptions.method)').join(
    'void 0',
  )
  const b = analyzeUnauthorizedExits(stripped)
  assert.equal(b.status, 'ok', '结构仍在,只是格子里没调用了')
  assert.ok(b.why.length >= 2, `一条通知都不剩却只喊 ${b.why.length} 句 ⇒ 报不满账`)
  assert.equal(b.cells.noBreaker, false)
  assert.equal(b.cells.breaker, false)
})

test('形状锁:本文件的被审内容必须走 face-reader 的读取入口,遮罩不得留本地副本', () => {
  const src = readFileSync(resolve(HERE, 'session-expiry-structure-lock.test.mjs'), 'utf8')
  // 正向锁判**原文**(import 说明符就是字符串,连字符串一起抹会直接失明);
  // 反向锁判**遮罩面**(本文件头注里就写着 `execFileSync(` 这类字样,按原文反查等于自己咬自己 ——
  // 守门 131/150 同一课:说明性文字也会带执行性字符)。两处取材不同是刻意的,不是笔误。
  assert.match(
    src,
    /from '\.\.\/lib\/face-reader\.mjs'/,
    '被审内容必须由 catBatch 取(自派生 git 会被守门 118 判半接线)',
  )
  assert.match(src, /catBatch\(/, 'import 了层却没用它的读取入口 = 半接线')
  assert.match(
    src,
    /from '\.\.\/lib\/code-mask\.mjs'/,
    '遮罩实现只有一份(守门 131/135 同一条反向锁)',
  )
  const code = maskCommentsAndStrings(src)
  assert.doesNotMatch(code, /execFileSync\(|spawnSync\(/, '不得在本文件里自派生 git 读被审内容')
  assert.doesNotMatch(
    code,
    /readFileSync\([^)]*ROOT/,
    '不得按磁盘工作树读被审内容(工作树常年滞后 HEAD)',
  )
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
