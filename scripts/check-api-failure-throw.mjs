// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 同型 throw 对账:凡"`if (!X.success) throw new Error(X.error)`"都必须走具名出口
// `apiFailureToError(X)`,否则 ApiResult 失败分支带的 `status` / `errorCode` / `retryAfter`
// 就被丢掉 —— 而 `toUserFriendlyMessage` 的判序是 **errorCode → HTTP status → 文案正则**,
// 前两档一丢,401 的 "Invalid or expired token" 只能落到参数类正则
// `/invalid|missing|required|must be|expected/i` 上,用户看到「提交的信息有误,请检查后重试」。
//
// 为什么这一型值得立门(真机实测,不是假想):进 App「广场」tab 一进来就弹那句
// (PROJECT_PLAN「广场 tab 一进即弹」条)。它把"去重新登录"引导成"回去改表单" ——
// 不是措辞偏好,是**修复方向被指错**。
//
// 口径同 70/77/83/91/98/101/103/118/131:全量判 **HEAD blob**、`--staged` 判**索引 blob**、
// `--worktree` 仅人工逃生舱;两面旗同给 ⇒ exit 2;取不到内容 ⇒ exit 2「无法判定」(不冒红也不记绿)。
// 棘轮锚点 = **该文件在 HEAD 自身的存量数**(与 77/83/98/102/131 同族):立项实测存量 212 处,
// 当场判红就是一台与任何提交都无关的恒红门,唯一结局是逼人绕过钩子、连带废掉全部守门(§12e)。
//
// 判据面一律先剥注释与字符串(共用 `scripts/lib/code-mask.mjs`,不在此另写一份 ——
// 门 131 今天刚被"自己写的说明文字"判成违规,而两处实现必漂移是这仓记过最多次的失败型)。
//
// 已知限制(如实登记,不等于"没有违规"):
//   1. **只判 throw 这一侧**。catch 里写 `showFloat(e.message)` / `setError(String(e))` 的,
//      即使 throw 换了出口也仍然把身份丢了 —— 那是本门刻意不判的第二半(判它噪声极大,
//      且修法要按屏定),迁移时必须逐处读 catch 路径。
//   2. 变量名必须**逐字相同**才认(`!res.success` → `res.error`);把 ApiResult 先解构成
//      `const { error } = res` 再抛,本门看不见。宁漏不误报。
//   3. 只认 `.error` 字段。`throw new Error(res.message)` 形态不在射程内(ApiResult 失败分支
//      的字段就叫 error,写 message 的多半不是它,纳进来必产假阳)。
//
// 用法:node scripts/check-api-failure-throw.mjs [--staged|--worktree|--json|--self-test|--files a b]
// 紧急跳过:HUSKY_SKIP_API_FAILURE_THROW=1

import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { catBatch, gitRaw, readWorktreeFile, selectFace } from './lib/face-reader.mjs'
import { maskCommentsAndStrings } from './lib/code-mask.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const GIT_TIMEOUT = 120000

/** 唯一出口所在文件 —— 出口被摘线时本门必须喊"判据没有出路",而不是继续报数 */
const HELPER_FILE = 'packages/shared/src/utils/error-messages.ts'
const HELPER_NAME = 'apiFailureToError'
/** 行内豁免必须带原因(裸标记不放行 —— 守门 102/131 同一条收紧) */
const EXEMPT = /api-error-exempt:\s*\S/
const SCAN_ROOTS = ['apps/', 'packages/']
const SCAN_EXT = /\.(tsx|ts|jsx|js)$/
/** 测试面与夹具不算"用户会看到的文案",且它们常故意抛裸 Error */
const TEST_NOISE = /(^|\/)(tests?|__tests__|e2e|__mocks__)(\/|$)|\.(test|spec)\.[tj]sx?$/
/** 自豁免:本门自己的源码里全是判据字面量 */
const SELF_EXEMPT = ['scripts/check-api-failure-throw.mjs', 'scripts/tests/check-api-failure-throw.test.mjs']

const THROW_RE = /throw\s+(?:new\s+Error\s*\(|Error\s*\()\s*([A-Za-z_$][\w$]*)\.error\b/
const guardRe = (id) => new RegExp(`!\\s*${id.replace(/\$/g, '\\$')}\\.success\\b`)
/** 向前找 guard 的窗口:6 行足够覆盖 `if (!res.success) {` 换行写法,再大就会跨函数误配 */
const GUARD_LOOKBACK = 6

/**
 * T1:找"带 success 卫兵的裸 throw X.error"。
 * 返回 { hits, exempted } —— exempted 只报数不判红,免得豁免变成静默。
 */
export function findBareApiThrows(text) {
  const hits = []
  const exempted = []
  if (typeof text !== 'string') return { hits, exempted, unreadable: true }
  const raw = text.split('\n')
  const code = maskCommentsAndStrings(text).split('\n')
  for (let i = 0; i < raw.length; i++) {
    const line = code[i] ?? ''
    const m = THROW_RE.exec(line)
    if (!m) continue
    const id = m[1]
    // 已经走具名出口的,不判(出口调用行本身不含 `new Error(X.error)`,这条是给迁移者留的余地:
    // 允许 `throw new Error(prepareFailure(res))` 这类自定义包装 —— 那不含 X.error 也不判)
    let guarded = false
    for (let j = Math.max(0, i - GUARD_LOOKBACK); j <= i; j++) {
      if (guardRe(id).test(code[j] ?? '')) {
        guarded = true
        break
      }
    }
    if (!guarded) continue
    const rawLine = raw[i]
    const prev = i > 0 ? raw[i - 1] : ''
    if (EXEMPT.test(rawLine) || (prev.trim() && /^\s*(?:\/\/|\/\*|\*)/.test(prev) && EXEMPT.test(prev))) {
      exempted.push({ line: i + 1, text: rawLine.trim().slice(0, 120) })
      continue
    }
    hits.push({ line: i + 1, id, text: rawLine.trim().slice(0, 120), cls: classifyThrowConsumer(code, i) })
  }
  return { hits, exempted, unreadable: false }
}

/**
 * T2:这个裸 throw 抛出去之后,**有没有人读它**。
 *
 * 为什么要把这件事做成机器判据:958 这个数原先只告诉你"有多少处",不告诉你"清完有多少可见收益"。
 * 实测抽样里大量站点落在 `catch { … }`(不绑形参、错误被整块丢弃、toast 写的是固定文案)——
 * 那类站点改成 `apiFailureToError(res)` **当天零可见变化,只是多一条 import**;而真正会让
 * "401 冒充『提交的信息有误』"再现的,是 `catch (e)` 后把 e 喂给 toUserFriendlyMessage / showToast 的那些。
 * 没有这一分型,后续清账只能按文件顺序盲扫,把工数花在零收益的改动上(§"别把验证甩给用户"同族:
 * 先量对尺子,再决定动哪里)。
 *
 * 四态(绝不静默合并):
 *  - consumed    :最近的 catch 绑了形参且形参在 catch 体内被引用 ⇒ 迁移改变用户看到的话术,优先清偿
 *  - discarded   :`catch {`(未绑形参)或绑了却从不引用 ⇒ 迁移当天零可见变化
 *  - escaping    :命中行之后在离开本块之前找不到 catch ⇒ 由上层消费,**本门看不见上层,如实单列不猜**
 *  - undetermined:catch 体超出括号配平窗口(>400 行)⇒ 判不出,只报数
 */
const CATCH_RE = /^\s*\}\s*catch\s*(?:\(\s*([A-Za-z_$][\w$]*)\s*(?::[^)]*)?\)\s*)?\{/
/** 命中行之后最多看这么多行找 catch;再长就跨函数了 */
const CATCH_LOOKAHEAD = 60
/** catch 体括号配平的上限行数 */
const CATCH_BODY_LIMIT = 400

/** 从 catch 行起做括号配平取函数体;超上限返回 null(= 判不出,不猜)。 */
function balancedBody(codeLines, catchIdx) {
  let depth = 0
  let started = false
  const out = []
  for (let j = catchIdx; j < Math.min(codeLines.length, catchIdx + CATCH_BODY_LIMIT); j++) {
    const l = codeLines[j] ?? ''
    out.push(l)
    // catch 行形如 `} catch (e) {`:开头那个 `}` 属**上一层**的收尾,先跳到本层的 `{` 才开始配平。
    // 首版没跳它,`}` 把 depth 打成 -1、随后的 `{` 又回到 0,于是"体"只含 catch 那一行自身,
    // consumed 永远判不出来(自检当场抓到 —— 判据失效的表现是安静地全报 discarded)。
    const from = started ? 0 : l.indexOf('{')
    if (!started && from < 0) continue
    for (let k = from; k < l.length; k++) {
      const ch = l[k]
      if (ch === '{') {
        depth++
        started = true
      } else if (ch === '}') depth--
    }
    if (started && depth <= 0) return out.join('\n')
  }
  return null
}

export function classifyThrowConsumer(codeLines, hitIdx) {
  const line = codeLines[hitIdx] ?? ''
  const baseIndent = (line.match(/^[^\S\n]*/) || [''])[0].length
  let catchIdx = -1
  let param = null
  for (let j = hitIdx + 1; j < Math.min(codeLines.length, hitIdx + 1 + CATCH_LOOKAHEAD); j++) {
    const l = codeLines[j] ?? ''
    if (!l.trim()) continue
    const m = CATCH_RE.exec(l)
    if (m) {
      catchIdx = j
      param = m[1] ?? null
      break
    }
    // 已经退到比命中行更浅的缩进、又不是纯收尾符号 ⇒ 离开本 try 所在块了
    const ind = (l.match(/^[^\S\n]*/) || [''])[0].length
    if (ind < baseIndent && !/^\s*[})\];,]*$/.test(l)) break
  }
  if (catchIdx < 0) return 'escaping'
  if (!param) return 'discarded'
  const body = balancedBody(codeLines, catchIdx)
  if (body === null) return 'undetermined'
  const useRe = new RegExp(`\\b${param.replace(/[$]/g, '\\$')}\\b`)
  return useRe.test(body.slice(body.indexOf('{') + 1)) ? 'consumed' : 'discarded'
}

function listFacePaths(face) {
  if (face === 'head')
    return gitRaw(['ls-tree', '-r', '--name-only', 'HEAD', '-z'], ROOT, { timeout: GIT_TIMEOUT })
      .split('\0')
      .filter(Boolean)
  if (face === 'staged')
    return gitRaw(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], ROOT, {
      timeout: GIT_TIMEOUT,
    })
      .split('\0')
      .filter(Boolean)
  return gitRaw(['ls-files', '-z'], ROOT, { timeout: GIT_TIMEOUT }).split('\0').filter(Boolean)
}

function inScope(p) {
  if (!SCAN_EXT.test(p)) return false
  if (!SCAN_ROOTS.some((d) => p.startsWith(d))) return false
  if (TEST_NOISE.test(p)) return false
  if (SELF_EXEMPT.some((s) => p === s)) return false
  return true
}

function readFace(paths, face) {
  const map = new Map()
  if (!paths.length) return map
  if (face === 'worktree') {
    for (const p of paths) map.set(p, readWorktreeFile(ROOT, p))
    return map
  }
  const rev = face === 'staged' ? '' : 'HEAD'
  const specs = paths.map((p) => `${rev}:${p}`)
  const got = catBatch(ROOT, specs, { maxBuffer: 1 << 29, timeout: GIT_TIMEOUT })
  for (let i = 0; i < paths.length; i++) map.set(paths[i], got.get(specs[i]) ?? null)
  return map
}

/** 纯函数:给定出口文件正文,判它是否真的导出了那个出口。拆出来是为了让镜像测试能拿构造面证明
 *  —— 用正则去比"本门源码里有没有某个字符串"是形状锁,证明不了判定行为(本仓记过:形状锁
 *  只能比归一化文本,而判定行为必须用输入输出对)。 */
export function detectHelper(text) {
  if (typeof text !== 'string') return 'undetermined'
  return new RegExp(`export\\s+function\\s+${HELPER_NAME}\\b`).test(text) ? 'ok' : 'missing'
}

/** 具名出口必须在被审面上真的导出 —— 出口没了,门就成了无出口的墙 */
function helperInFace(face) {
  return detectHelper(readFace([HELPER_FILE], face).get(HELPER_FILE))
}

/**
 * 暂存档的"无射程内文件 ⇒ 回退全量"判定,单独抽成纯函数:回退那一路只能用真仓的暂存集端到端验,
 * 而**不该回退**的三种情形(有射程内文件 / 显式 --files / 本来就是全量档)只能靠构造面证明 ——
 * 否则这条判据被顺手改成"无条件回退"时,门就在暂存档永久失明而账面什么都看不出来。
 */
export function shouldRetreatToHead({ face, hasOnlyFiles, stagedInScopeCount }) {
  return face === 'staged' && !hasOnlyFiles && stagedInScopeCount === 0
}

export function analyze(face, onlyFiles = null) {
  // **暂存档在"本次没有射程内文件"时回退全量,而不是判"无法判定"**:一次只改文档/语言包的
  // 提交,其暂存集里结构上不会有 .ts —— 若把这当成空扫判死,本门就会替**每一次**无关提交
  // 挡路(实测 ffdb860744 即此型),而恒红/恒挡的唯一结局是各会话走应急跳门、连带全部守门作废
  // (§12e)。口径同门 70「暂存集为空时回退全量防"空暂存恒绿"」与门 101「--staged 恒全量」。
  let effFace = face
  let retreatReason = null
  if (
    shouldRetreatToHead({
      face,
      hasOnlyFiles: onlyFiles !== null,
      stagedInScopeCount: face === 'staged' ? listFacePaths('staged').filter(inScope).length : -1,
    })
  ) {
    effFace = 'head'
    retreatReason = '本次暂存集里没有本门射程内的文件(.ts/.tsx/.js/.jsx) ⇒ 回退 HEAD 全量面'
  }
  const all = onlyFiles ?? listFacePaths(effFace)

  const files = all.filter(inScope)
  const contents = readFace(files, effFace)

  const unreadable = []
  const red = []
  const exempted = []
  const classes = { consumed: 0, discarded: 0, escaping: 0, undetermined: 0 }
  let total = 0
  for (const f of files) {
    const text = contents.get(f)
    if (typeof text !== 'string') {
      unreadable.push(f)
      continue
    }
    const { hits, exempted: ex } = findBareApiThrows(text)
    total += hits.length
    for (const h of hits) classes[h.cls] = (classes[h.cls] ?? 0) + 1
    exempted.push(...ex.map((e) => ({ file: f, ...e })))
    if (!hits.length) continue
    if (effFace === 'staged') {
      // 暂存档:只拦"这次改动新出现的" —— 锚点取该文件 HEAD 自身存量
      const headText = readFace([f], 'head').get(f)
      const cap = typeof headText === 'string' ? findBareApiThrows(headText).hits.length : 0
      if (hits.length > cap) red.push({ file: f, n: hits.length, cap, sites: hits.slice(0, 3) })
      continue
    }
    if (effFace === 'worktree') {
      const headText = readFace([f], 'head').get(f)
      const cap = typeof headText === 'string' ? findBareApiThrows(headText).hits.length : 0
      if (hits.length > cap) red.push({ file: f, n: hits.length, cap, sites: hits.slice(0, 3) })
    }
  }
  const helper = helperInFace(effFace)
  const emptyScan = files.length === 0
  let exit = 0
  if (unreadable.length || emptyScan || helper === 'undetermined') exit = 2
  else if (red.length || helper === 'missing') exit = 1
  return {
    face: effFace,
    retreatReason,

    scannedFiles: files.length,
    total,
    classes,
    red,
    exempted,
    unreadable,
    emptyScan,
    helper,
    exit,
  }
}

/* ------------------------------- 自检 ------------------------------- */

const FIXTURES = {
  // 命中:卫兵与 throw 同变量
  bare: `async function load() {
  const res = await getList()
  if (!res.success) throw new Error(res.error)
  return res.data
}`,
  // 命中:大括号换行写法
  bareBlock: `  if (!res.success) {
    throw new Error(res.error)
  }`,
  // 放过:已走具名出口
  fixed: `  if (!res.success) throw apiFailureToError(res)`,
  // 放过:没有 success 卫兵(不是 ApiResult 失败分支)
  noGuard: `  if (bad) throw new Error(cfg.error)`,
  // 放过:写在注释里的示例(判据面先剥注释)
  inComment: `  // 旧写法: if (!res.success) throw new Error(res.error)
  doSomething()`,
  // 放过:带原因的行内豁免
  exempt: `  if (!res.success) throw new Error(res.error) // api-error-exempt: 本处刻意只取文案,身份已在上一行落日志`,
  // 不放过:裸标记没原因
  bareMarker: `  if (!res.success) throw new Error(res.error) // api-error-exempt:`,
  // 分型用:catch 绑了形参且真去读它 ⇒ 迁移会改变用户看到的话术
  consumed: `async function submit() {
  try {
    const res = await save()
    if (!res.success) throw new Error(res.error)
    return res.data
  } catch (e: unknown) {
    showToast('error', toUserFriendlyMessage(e))
  }
}`,
  // 分型用:`catch {` 不绑形参 ⇒ 错误整块丢掉,迁移当天零可见变化
  discarded: `async function load() {
  try {
    const res = await getList()
    if (!res.success) throw new Error(res.error)
  } catch {
    setList([])
  }
}`,
  // 分型用:绑了形参但体内从不引用 ⇒ 同属被丢弃(不能因为"绑了"就当有收益)
  boundButUnused: `async function load() {
  try {
    const res = await getList()
    if (!res.success) throw new Error(res.error)
  } catch (e) {
    setList([])
  }
}`,
  // 分型用:命中行之后到离开本块都没有 catch ⇒ 外抛,上层消费,本门看不见上层
  escaping: `export async function fetchThing() {
  const res = await getList()
  if (!res.success) throw new Error(res.error)
  return res.data
}`,
}

function runSelfTest() {
  let okAll = true
  const ok = (name, pass) => {
    console.log(`${pass ? '✅' : '❌'} ${name}`)
    if (!pass) okAll = false
  }
  ok('T1 命中:卫兵 + 裸 throw res.error', findBareApiThrows(FIXTURES.bare).hits.length === 1)
  ok('T1 命中:大括号换行写法同样要判(否则迁移者一格式化就隐身)', findBareApiThrows(FIXTURES.bareBlock).hits.length === 1)
  ok('T1 放过:已走 apiFailureToError', findBareApiThrows(FIXTURES.fixed).hits.length === 0)
  ok('T1 放过:没有 .success 卫兵的不算这一型', findBareApiThrows(FIXTURES.noGuard).hits.length === 0)
  ok('T1 放过:注释里的该形态不得计入(门 131 刚被这一型咬过)', findBareApiThrows(FIXTURES.inComment).hits.length === 0)
  ok('豁免:带原因才放行,且计入 exempted 只报数', (() => {
    const r = findBareApiThrows(FIXTURES.exempt)
    return r.hits.length === 0 && r.exempted.length === 1
  })())
  ok('裸标记(冒号后无原因)不得放行', findBareApiThrows(FIXTURES.bareMarker).hits.length === 1)
  const cls = (name) => findBareApiThrows(FIXTURES[name]).hits[0]?.cls
  ok('T2 分型:catch 绑形参且读它 ⇒ consumed', cls('consumed') === 'consumed')
  ok('T2 分型:catch 不绑形参 ⇒ discarded(迁移零可见变化,别为它加 import)', cls('discarded') === 'discarded')
  ok('T2 分型:绑了形参却从不引用 ⇒ 同样 discarded(不能因"绑了"就当有收益)', cls('boundButUnused') === 'discarded')
  ok('T2 分型:到离开本块都没有 catch ⇒ escaping(上层消费,本门不猜)', cls('escaping') === 'escaping')
  // 反向对照:discarded 与 consumed 必须**不同判**,否则分型只是把三态压成一态的装饰
  ok('T2 反向对照:consumed 与 discarded 不得同判', cls('consumed') !== cls('discarded'))
  // 阳性对照:拿真仓 HEAD 喂判据,它必须点名已知存量(看不见存量 = 判据对该形态全盲)
  const head = analyze('head')
  ok(`真仓 HEAD 阳性对照:必须看得见存量(实得 ${head.total} 处 / ${head.red.length ? '有' : '无'}红)`, head.total > 100)
  ok('HEAD 全量档不得因存量判红(锚点是该文件自身,当场判红就是恒红门)', head.exit !== 1)
  ok(
    '测试面/夹具不进射程,而生产路由仍进(否则迁移者被自己的测试拦住,或门根本看不见案发现场)',
    !inScope('apps/api/tests/x.test.ts') &&
      !inScope('apps/web/e2e/y.ts') &&
      !inScope('apps/api/src/__tests__/z.ts') &&
      inScope('apps/api/src/routes/a.ts'),
  )
  // 回退判定的构造面四例:端到端那一例只能靠真仓暂存集,这里锁"不该回退"的三种情形
  ok('暂存档 + 无 --files + 射程内 0 个 ⇒ 回退全量(否则无关提交被替它判"无法判定")',
    shouldRetreatToHead({ face: 'staged', hasOnlyFiles: false, stagedInScopeCount: 0 }))
  ok('暂存档里有一个射程内文件 ⇒ 绝不回退(回退就等于把本次改动放过去)',
    !shouldRetreatToHead({ face: 'staged', hasOnlyFiles: false, stagedInScopeCount: 1 }))
  ok('显式 --files 通道 ⇒ 不回退(自检与人工定位都靠它指向指定面)',
    !shouldRetreatToHead({ face: 'staged', hasOnlyFiles: true, stagedInScopeCount: 0 }))
  ok('全量档不存在"回退"一说(0 个候选仍是判死,不是改判成别的面)',
    !shouldRetreatToHead({ face: 'head', hasOnlyFiles: false, stagedInScopeCount: -1 }))
  console.log(okAll ? '--self-test: 全部通过' : '--self-test: 有失败')
  process.exitCode = okAll ? 0 : 1
}

/* ------------------------------- CLI ------------------------------- */

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return runSelfTest()
  const picked = selectFace({
    staged: argv.includes('--staged'),
    worktree: argv.includes('--worktree'),
    def: 'head',
  })
  if (picked.error) {
    console.error(`❌ ${picked.error}`)
    process.exitCode = 2
    return
  }
  const fi = argv.indexOf('--files')
  const only = fi >= 0 ? argv.slice(fi + 1).filter((a) => !a.startsWith('--')) : null
  const r = analyze(picked.face, only && only.length ? only : null)
  if (argv.includes('--json')) {
    console.log(JSON.stringify(r, null, 2))
    process.exitCode = r.exit
    return
  }
  console.log(
    `[api-failure-throw] 面:${r.face} · 出口 ${HELPER_NAME}:${r.helper} · 扫描 ${r.scannedFiles} 文件 · 同型 throw ${r.total} 处`,
  )
  if (r.retreatReason) console.log(`↩️ ${r.retreatReason}(不是"没判",判的是 HEAD 全量面)`)
  if (r.helper === 'missing')
    console.log(`❌ 具名出口不在被审面上(${HELPER_FILE} 未导出 ${HELPER_NAME})—— 判据没有出路,先补出口`)
  if (r.exempted.length)
    console.log(`⚠️ 带 api-error-exempt 豁免 ${r.exempted.length} 处(只报数,到期由守门 108 追)`)
  if (r.unreadable.length)
    console.log(`❌ 无法判定:${r.unreadable.length} 个候选文件在本面取不到内容,首个:${r.unreadable[0]}`)
  if (r.emptyScan) console.log('❌ 本面枚举到 0 个候选文件 —— 判"无法判定",绝不记绿')
  if (r.red.length) {
    console.log(`❌ 新增(超出该文件 HEAD 自身存量)${r.red.length} 个文件:`)
    for (const x of r.red.slice(0, 12))
      console.log(`   - ${x.file}: ${x.n} 处(HEAD 存量 ${x.cap})  例:${x.sites[0]?.text ?? ''}`)
    console.log(`   出口:改 throw ${HELPER_NAME}(res);确属有意则写 api-error-exempt: <原因>`)
  } else if (r.exit === 0) {
    console.log(`✅ 无新增。存量 ${r.total} 处按"该文件 HEAD 自身存量"棘轮只报数(清偿进度看这一行,别引用文档旧数)`)
  }
  console.log(
    `分型(清偿优先级按这一行走,不看文件顺序):被消费 ${r.classes.consumed} / 被丢弃 ${r.classes.discarded} / 外抛(上层消费,本门看不见上层)${r.classes.escaping} / 判不出 ${r.classes.undetermined}`,
  )
  console.log(
    '  ⚠️ 「被丢弃」那一批改成具名出口**当天零可见变化**(catch 不绑形参,toast 是固定文案)—— 别为它加 import;要真收口得先让那类 catch 用上错误身份。',
  )
  console.log(`提示:本门射程 = apps/ 与 packages/ 的 .ts/.tsx/.js/.jsx,不含测试面`)
  process.exitCode = r.exit
}

export const __test__ = {
  findBareApiThrows,
  detectHelper,
  analyze,
  inScope,
  classifyThrowConsumer,
  HELPER_FILE,
  HELPER_NAME,
  EXEMPT,
  FIXTURES,
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  try {
    main()
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
