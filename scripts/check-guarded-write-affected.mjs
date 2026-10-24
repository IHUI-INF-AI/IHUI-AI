#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * 守门:守卫式写入的成败必须被读回来 + 资金回调不得用 SUCCESS 吞掉处理失败(2026-10-25 立)。
 *
 * 接线状态(如实,守门 89 会读这段):**已接 pre-commit** —— 注册条目在
 * scripts/guardian-runner.mjs(id 以 runner 现值为准,blocking,
 * skipEnv = HUSKY_SKIP_GUARDED_WRITE_AFFECTED,stagedTriggers = apps/api/src/)。
 *
 * —— 立因(两条都是这一枚实测出来的,不是推演)——
 * ① `apps/api/src/routes/points-mall-user.ts` 的兑换:库存扣减写成
 *    `await db.update(...).set({stock: stock-1, sold: sold+1}).where(and(eq(id), gt(stock,0)))`
 *    —— 守卫 `stock>0` 写对了,但**既不 .returning() 也不接返回值**。于是"这一笔到底扣没扣上"
 *    在代码里根本读不出来:并发把库存抢空时这条 UPDATE 匹配 0 行、静默 no-op,而积分已扣、
 *    订单已插、HTTP 200 已发 ⇒ 超卖不退款,且 sold 也不涨(账实不符)。
 *    同族第二处:`miniapp-compat-routes.ts` 买课扣余额连守卫都没有(读副本→JS 判定→裸 UPDATE),
 *    并发双击可把余额打成负数。
 * ② `apps/api/src/routes/payment-extended.ts` 的提现回调:catch 分支注释写着
 *    "即使出错也返回 SUCCESS,防止微信重复回调",于是**技术失败也回 SUCCESS** ⇒ 微信不再重投,
 *    流水永久停在 pending/processing、`frozen_quantity` 永不释放;而全仓 jobs/services/workers
 *    对 withdrawalFlows 零引用,没有任何对账兜底会来补这一步(现读)。
 *    防重复回调这件事本来由它自己上面那句 status 守卫(只认 0/1)负责,不需要用 SUCCESS 去换 ——
 *    本仓 payment-gateway.ts:729 早已给出正确口径 `reply.code(500).send({code:'FAIL',
 *    message:'副作用处理失败,待重试'})`,这一处是同一仓内的口径异类。
 *
 * —— 判据条数(现读:G1/G2/G3/G4/G5 五条;G3/G4/G5 的条文写在各判据函数头上)——
 * G1 守卫式写入丢弃结果:db|tx|trx 发起的 .update()/.delete() 链,`.where(...)` 里带**数值守卫**
 *    (gt/gte/lt/lte 或 sql 里的 >/</>=/<= 比较),链上**没有 .returning(...)**,且整条语句的
 *    返回值没有被绑定成变量(没有 `const x = await ...`)⇒ 判红。
 *    为什么"没有 .returning"就足够定罪而不必去追 rowCount:drizzle 的 await 结果形态在本仓
 *    两种驱动下不一致,判"有没有被读回来"要造第二把尺子;而"既不 returning 又不接返回值"
 *    是结构上唯一稳的写法 —— 要么取回影响行,要么取回 rowCount,二者必居其一。
 * G2 资金回调吞掉失败:路由路径含 notify/callback/webhook 的处理器里,catch 分支回
 *    `code:'SUCCESS'` / 复用成功信封 ⇒ 判红(失败必须让上游重投,或显式进台账)。
 *
 * —— 档位与取材 ——
 * 取材面纪律(§0.4):全量档判 HEAD blob、`--staged` 判索引 blob、`--worktree` 仅人工逃生舱;
 * 两面旗同给 ⇒ exit 2;取不到 ⇒ 未判定(§0.3),不记绿也不冒红;枚举 0 个候选 ⇒ 判死。
 * G1/G3 的档位:差值棘轮(锚点 = 该文件在锚点面自身的存量)。**2026-10-25 本枚实测现读存量为 0**
 * (G1 由 points-mall 兑换归零;G3 三处 userMargins 释放/退回冻结补齐 gte(frozen,amount) +
 *  .returning() 后归零),所以在当前账面上等价于零容忍;仍保留棘轮形态而非硬编码 0,是因为
 *  一旦有人 --no-verify 把旧形态塞回来,门应当只拦增量、而不是变成一台与本次内容无关的恒红门(§12e)。
 * G2 同口径:回 FAIL 让上游重投是本仓 payment-gateway 既有写法,现读存量 0。
 *
 * 用法:node scripts/check-guarded-write-affected.mjs [--staged|--worktree] [--json] [--self-test]
 * 退出码:0 无判红 / 1 判红 / 2 未判定(含"锚点取不到")
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { findWriteChains, findFunctionBodies, maskText, closeParen, closeBrace } from './lib/batch-write-lexer.mjs'
import { maskComments } from './lib/code-mask.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SCOPE = 'apps/api/src'

/** 数值守卫的列名限定见下方 QTY_COL(不收窄会把单调推进/范围删除误判成违规)。 */

/**
 * 结果有没有被接住:回看接收者(db|tx|trx)前面的 token。
 * 链常在下一行起(`const rows = await db` / `.update(...)`),所以按"行"取前缀必然落空 ——
 * 这里把空白折平,只看接收者之前那一小段是什么。
 */
const TAKEN_RE =
  /(?:(?:const|let|var)\s+[\w$]+(?:\s*:\s*[^=;]+)?\s*=|(?:return|throw)|[({,]|=>|\?)\s*(?:await\s+)?(?:db|tx|trx)$/

export function isResultTaken(code, chainStart) {
  const tail = code
    .slice(Math.max(0, chainStart - 240), chainStart)
    .replace(/\s+/g, ' ')
    .trimEnd()
    .toLowerCase()
  return TAKEN_RE.test(tail)
}

/**
 * 额度/库存类列名(G1/G3 的射程限定)。
 * 为什么要限定:守卫式写入有两种**合法**用途 —— ① 单调推进(`lt(lastMessageAt, x)`:0 行说明
 * 已有更新值,本就该 no-op)② 范围删除(`gt(createdAt, y)`:守卫就是选择条件)。
 * 本判据问的是第三种:**把某个额度扣下去**,此时"扣没扣上"必须被读回来,否则 0 行会被
 * 当成成功(实测即积分照扣、订单照插、库存没扣 = 超卖不退款)。
 */
const QTY_COL =
  String.raw`(?:stock|sold|balance|points|quantity|amount|quota|remaining|usedTimes|freeTimes|used_times|free_times|frozenQuantity|frozen_quantity|tokenQuantity|token_quantity|count)`
const RELATIVE_RE = new RegExp(
  'sql\\s*`[^\\n]*?\\b(?:' + QTY_COL + ')\\b[^\\n]*?[-+]\\s*(?:[\\w$]+|\\$\\{|\\d)',
)
const GUARD_QTY_RE = new RegExp(String.raw`(?:gt|gte|lt|lte|sql)\s*[\(\`][^\n]{0,120}?\b(?:${QTY_COL})\b`, 'i')

export function isQuantityRelative(setText) {
  return /[-+]\s/.test(setText) || /[-+]\d/.test(setText) ? RELATIVE_RE.test(setText) : false
}

/** G1 的守卫维:where 里对额度列做了比较(而非只做主键等值)。 */
export function guardsQuantityColumn(whereText) {
  if (!whereText) return false
  return GUARD_QTY_RE.test(whereText)
}

/**
 * G4:额度列被**绝对值回写**(set 里赋的是一个 JS 变量,而不是数据库侧表达式)。
 * 这是结构性丢更新:那个值来自先前的一次读(实测还读的是副本),读写之间任何并发变动都被抹掉。
 * 成因样本(本枚修掉):miniapp 兼容层"支付历史"把 `Math.max(0, 副本余额 - 数额)` 直接
 * `.set({ tokenQuantity: balanceAfter })` 回写 ⇒ 既丢并发,又在余额不足时把用户全部余额
 * 静默清零、照样记一笔全额流水、照样回 200。
 * 排除面:`set({ balanceAfter: x })` 这种**流水快照列**不算(它记的是那一笔之后的余额,
 * 不是可变额度本身)—— 靠 QTY_COL 的整词边界把 balanceAfter 挡在外面。
 */
const ABS_WRITE_RE = new RegExp(
  '[{,]\\s*(?:' +
    QTY_COL +
    ')\\s*:\\s*(?!sql\\s*`)(?![\\d"-])([A-Za-z_$][\\w$]*)\\s*[,}]',
)

export function findAbsoluteQuantityWriteback(code, bodies = findFunctionBodies(code)) {
  const out = []
  const locked = []
  for (const chain of findWriteChains(code)) {
    if (chain.names.indexOf('set') < 0) continue
    if (!ABS_WRITE_RE.test(chain.setText)) continue
    if (chain.opaque) continue
    // 豁免(机器现验,不是行内标记):本链所在的任一外层函数体内存在 `FOR UPDATE` 行锁读
    // ⇒ 绝对值回写安全(锁住了并发窗口,写回的值不会覆盖别人已提交的变动)。查不到锁才定罪。
    const hasLock = bodies
      .filter((b) => chain.start >= b.start && chain.start < b.end)
      .some((b) => /\.for\s*\(\s*['"]update['"]\s*\)/.test(code.slice(b.start, b.end)))
    if (hasLock) {
      locked.push({ start: chain.start, setText: chain.setText.replace(/\s+/g, ' ').slice(0, 90) })
      continue
    }
    out.push({ start: chain.start, setText: chain.setText.replace(/\s+/g, ' ').slice(0, 90) })
  }
  return { hits: out, lockedSafe: locked }
}

/**
 * G5(2026-10-25 立):计数字段的"读出来 ±1 再把绝对值写回"。
 *
 * 为什么 G4 管不到它:G4 的键表是**额度列**(tokenQuantity/balance/stock/points…),
 * 而 likeCount/viewCount/replyCount/retryCount 这些"计数列"当时没收 —— 于是同一型缺陷
 * (事务外读一行 → JS 里 +1 → 写绝对值)在社交与设备链路上一路漏过:两个并发请求各自读到 N、
 * 各自写 N+1 ⇒ **吞掉一次计数**;`remote-device` 的重试更 consequential:上限判定只住在
 * 事务外的 if 里,并发两个请求都通过 ⇒ **绕过 maxRetries 白送一次设备重发**。
 *
 * 判据形态(刻意精确到不误伤):
 *  · 只判 `.set({ <计数键>: <表达式> })` 且表达式是 **JS 算术**(含 `+ 1`/`- 1`/`Math.max(`/`Math.min(`)
 *    或以标识符参与运算 —— 正解形态恒为库侧模板 `sql\`${t.col} + 1\``,即 set 值以 `sql\`` 开头 ⇒ 放过;
 *  · 键名按 `…Count` / 计数语义表匹配,普通业务字段不收(避免误伤 `price`/`total` 这类合法绝对赋值);
 *  · 与 G4 共用"锁内 FOR UPDATE 机器豁免"——事务里先 `for('update')` 读再回写是正解,不收。
 */
export const COUNTER_KEY_RE =
  /\b(likeCount|dislikeCount|collectCount|commentCount|replyCount|viewCount|readCount|shareCount|favoriteCount|accessCount|invokeCount|usageCount|clickCount|downloadCount|playCount|retryCount|attemptCount|runCount|installCount|followerCount|followingCount|memberCount|postCount|reportCount|scoreCount|aiRounds|roundCount)\b\s*:/g

/** 这个 set 值是不是"JS 侧算出来的绝对值"(而不是库侧表达式)。 */
export function isJsArithmetic(valueText) {
  const v = valueText.trim()
  if (v.startsWith('sql') || v.startsWith('db.') || /^(?:\$\{|\d+$)/.test(v)) return false
  if (/(?:^|[^\w.$)])\+\s*[\w.]+|(?:^|[^\w.$)])-\s*[\w.]+|Math\.(?:max|min)\(/.test(v)) return true
  return /\b[\w.]+\s*[+\-]\s*\d/.test(v)
}

export function findAbsoluteCounterWriteback(code, bodies = findFunctionBodies(code)) {
  const out = []
  const locked = []
  for (const chain of findWriteChains(code)) {
    if (chain.names.indexOf('set') < 0) continue
    if (chain.opaque) continue
    const inner = chain.setText.replace(/^[^{]*\{/, '').replace(/\}\s*$/, '')
    let hit = null
    for (const km of inner.matchAll(COUNTER_KEY_RE)) {
      const after = inner.slice((km.index ?? 0) + km[0].length)
      const value = after.slice(0, topValueEnd(after))
      if (isJsArithmetic(value)) hit = { key: km[1], value: value.trim().slice(0, 70) }
    }
    if (!hit) continue
    const hasLock = bodies
      .filter((b) => chain.start >= b.start && chain.start < b.end)
      .some((b) => /\.for\s*\(\s*['"]update['"]\s*\)/.test(code.slice(b.start, b.end)))
    if (hasLock) {
      locked.push({ start: chain.start, key: hit.key, value: hit.value })
      continue
    }
    out.push({ start: chain.start, key: hit.key, value: hit.value })
  }
  return { hits: out, lockedSafe: locked }
}

/** 取一个值表达式的结束位置:顶层逗号(括号/方括号/花括号/反引号内的逗号不算)。 */
function topValueEnd(text) {
  let depth = 0
  let inTemplate = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '`') inTemplate = !inTemplate
    if (inTemplate) continue
    if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') depth--
    else if (c === ',' && depth === 0) return i
  }
  return text.length
}

/**
 * G1:额度扣减型守卫写入,却没把影响行读回来。
 */
export function findDiscardedGuardedWrites(code) {
  const out = []
  for (const chain of findWriteChains(code)) {
    if (chain.names.indexOf('where') < 0) continue
    if (chain.names.indexOf('set') < 0) continue
    if (!isQuantityRelative(chain.setText)) continue
    if (!guardsQuantityColumn(chain.whereText)) continue
    if (chain.hasReturning) continue
    if (chain.opaque) continue // 分不清就不判(§0.3),不拿"看着像"定罪
    if (isResultTaken(code, chain.start)) continue
    out.push({ start: chain.start, whereText: chain.whereText.slice(0, 90), whereFull: chain.whereText })
  }
  return out
}

/**
 * G3:对额度做相对扣减(set 里 `col - N`)却**完全没有守卫条件** ⇒ 并发可把余额打成负数。
 * (实测第二型:miniapp 兼容层买课先从读副本取余额、在 JS 里判够不够,再写
 * `balance = balance - price` 不带 `balance >= price` 守卫 ⇒ 双击即负余额。)
 */
export function findUnguardedDecrement(code) {
  const out = []
  for (const chain of findWriteChains(code)) {
    if (chain.names.indexOf('set') < 0) continue
    if (!RELATIVE_RE.test(chain.setText)) continue
    if (!/-\s*(?:[\w$]+|\$\{|\d)/.test(chain.setText)) continue // 只问扣减方向
    if (chain.names.indexOf('where') < 0) continue // 无 where 的全表写另有判据(门 134/30a)
    if (guardsQuantityColumn(chain.whereText)) continue
    if (chain.opaque) continue
    out.push({ start: chain.start, whereText: chain.whereText.slice(0, 90), whereFull: chain.whereText })
  }
  return out
}

/** G2:回调处理器在 catch 里回 SUCCESS。 */
export function findCallbackSwallowingFailure(code) {
  const out = []
  const routeRe =
    /\.(?:post|get|put|patch|delete)\s*\(\s*['"`]([^'"`]*(?:notify|callback|webhook|回调)[^'"`]*)['"`]/gi
  for (const m of code.matchAll(routeRe)) {
    const open = code.indexOf('(', m.index)
    if (open < 0) continue
    // 必须按括号配平取**整条注册调用的实参面**:路径与 handler 之间常有 config 对象
    // (schema / preHandler / rateLimit),拿"路径之后的第一个 {"当 handler 体就会取到那个对象,
    // 于是判据对自己声称修的那一格永久失明 —— 本门第一版实测踩过(HEAD 面对提现回调零命中)。
    const end = closeParen(code, open)
    if (end < 0) continue
    const body = code.slice(open, end)
    const catchRe = /\bcatch\s*(?:\(\s*[\w$]*\s*\))?\s*\{/g
    let cm
    while ((cm = catchRe.exec(body)) !== null) {
      const blockStart = open + cm.index + cm[0].length - 1
      const blockEnd = closeBrace(code, blockStart)
      if (blockEnd < 0) continue
      const seg = code.slice(blockStart, blockEnd)
      // 只认服务商 ack 字面量 {code:'SUCCESS'}:这一族的语义是"上游按我的应答决定要不要重投",
      // 回 SUCCESS 就等于放弃重投。浏览器型 OAuth 回调走 redirect、不发这种 ack,不属本判据 ——
      // 把它们卷进来只会制造没人敢修的噪声(§12e 同型)。
      if (/code:\s*['"]SUCCESS['"]/.test(seg)) out.push({ start: m.index, route: m[1] })
    }
  }
  return out
}

/**
 * 报表坐标:遮蔽面的下标不能直接映射回原文 —— maskComments 是**删字符**而非等长抹平
 * (实测把 565 行的额度写报成 482 行)。错坐标比没坐标更贵,所以改用 where 原文当锚在**原文**里定位;
 * 锚找不到 ⇒ 如实写"未定位",不猜一个行号给人跟着改错地方。
 */
export function locateLine(src, needle, from = 0) {
  if (!needle) return -1
  const flat = needle.replace(/\s+/g, ' ').trim()
  const firstWord = flat.split(' ')[0]
  if (!firstWord) return -1
  let searchFrom = from
  for (let guard = 0; guard < 400 && searchFrom < src.length; guard++) {
    const at = src.indexOf(firstWord, searchFrom)
    if (at < 0) return -1
    const window = src.slice(at, at + flat.length + 400).replace(/\s+/g, ' ')
    if (window.includes(flat)) return { line: src.slice(0, at).split('\n').length, at }
    searchFrom = at + firstWord.length
  }
  return -1
}

/**
 * 报表游标:同一文件里两处 where 写法逐字相同时(实测 payment-extended 的两处余额释放),
 * 每次都找第一次出现 ⇒ 两条报同一个行号,跟着改会改错那一处。链本身是按出现顺序返回的,
 * 所以游标单调前进即可把坐标分对。定位不到 ⇒ 如实写"未定位",不猜。
 */
export function makeLocator(src) {
  let cursor = 0
  return (needle) => {
    const hit = locateLine(src, needle, cursor)
    if (hit === -1) return '未定位(锚不在原文)'
    cursor = hit.at + 1
    return hit.line
  }
}

function git(args, opts = {}) {
  const stdio = opts.input === undefined ? ['ignore', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe']
  return spawnSync('git', args, { cwd: ROOT, encoding: 'utf8', windowsHide: true, stdio, timeout: 60_000 })
}

function faceFiles(face) {
  const args =
    face === 'head'
      ? ['ls-tree', '-r', '--name-only', 'HEAD', '--', SCOPE]
      : face === 'staged'
        ? ['ls-files', '-s', '--', SCOPE]
        : ['ls-files', '--', SCOPE]
  const r = git(args)
  if (r.status !== 0) return { err: `${args[0]} 失败: ${r.stderr.trim()}` }
  return {
    files: r.stdout
      .split('\n')
      .filter(Boolean)
      .map((l) => (face === 'staged' ? l.split('\t').slice(1).join('\t') : l))
      .filter((f) => f.endsWith('.ts')),
  }
}

/** 取某一面/某一修订上的文件内容;取不到返回 null(交调用方落「未判定」)。 */
function readRev(rev, file) {
  if (rev === null) {
    const p = path.join(ROOT, file)
    return existsSync(p) ? readFileSync(p, 'utf8') : null
  }
  const r = git(['show', `${rev}:${file}`])
  return r.status === 0 ? r.stdout : null
}

const FACE_REV = { head: 'HEAD', staged: ':', worktree: null }

/** 按面取原文 + 遮罩:额度链判据(G1/G3)要认得 sql`` 模板正文,只抹注释;G2 同理。 */
function auditText(src) {
  const masked = maskText(src, { blankStrings: true })
  const kept = maskComments(src)
  return {
    leaks: masked.leaks,
    g1: kept,
    g3: kept,
    g2: kept,
  }
}

/** 档位:全量档(HEAD 面)的锚点是 HEAD^;索引面与工作树面的锚点是 HEAD。 */
function anchorRev() {
  return process.argv.includes('--staged') || process.argv.includes('--worktree') ? 'HEAD' : 'HEAD^'
}

export function selfTest() {
  const cases = []
  const ok = (name, cond) => cases.push({ name, pass: Boolean(cond) })

  const bad = `      await db
        .update(products)
        .set({ stock: sql\`\${products.stock} - 1\` })
        .where(and(eq(products.id, id), gt(products.stock, 0)))
`
  const goodReturning = `      const rows = await db
        .update(products)
        .set({ stock: sql\`\${products.stock} - 1\` })
        .where(and(eq(products.id, id), gt(products.stock, 0)))
        .returning({ id: products.id })
`
  const goodNoGuard = `      await db
        .update(products)
        .set({ status: 'off' })
        .where(eq(products.id, id))
`
  const goodBound = `      const res = await db
        .update(accounts)
        .set({ balance: sql\`balance - 1\` })
        .where(and(eq(accounts.id, id), gte(accounts.balance, 1)))
`
  const goodReturnStmt = `      return db
        .update(products)
        .set({ stock: 0 })
        .where(and(eq(products.id, id), gt(products.stock, 0)))
`
  ok('G1 抓到"扣额度却不读回影响行"', findDiscardedGuardedWrites(bad).length === 1)
  ok('G1 放过 .returning() 写法', findDiscardedGuardedWrites(goodReturning).length === 0)
  ok('G1 放过非额度的普通更新', findDiscardedGuardedWrites(goodNoGuard).length === 0)
  ok('G1 放过把结果接成变量(自行读 rowCount)', findDiscardedGuardedWrites(goodBound).length === 0)
  ok('G1 放过整条交给 return 的写法', findDiscardedGuardedWrites(goodReturnStmt).length === 0)
  // 两型合法守卫必须不被误判(单调推进 / 范围删除):这是本判据收窄的根据
  const monotonic = `      await tx
        .update(conversations)
        .set({ lastMessageAt: row.createdAt })
        .where(and(eq(conversations.id, cid), lt(conversations.lastMessageAt, row.createdAt)))
`
  const rangeDelete = `      await tx
        .delete(messages)
        .where(and(eq(messages.conversationId, cid), gt(messages.createdAt, target.createdAt)))
`
  ok('G1 放过单调推进(0 行本就是正解)', findDiscardedGuardedWrites(monotonic).length === 0)
  ok('G1 放过范围删除(守卫是选择条件不是额度)', findDiscardedGuardedWrites(rangeDelete).length === 0)
  // G3:相对扣减却完全没有额度守卫 —— 并发可把余额打成负数(实测买课那型)
  const g3Bad = `      await db
        .update(accounts)
        .set({ balance: sql\`\${accounts.balance} - price\`, updatedAt: now })
        .where(eq(accounts.userId, uid))
`
  const g3Guarded = `      await db
        .update(accounts)
        .set({ balance: sql\`\${accounts.balance} - price\`, updatedAt: now })
        .where(and(eq(accounts.userId, uid), gte(accounts.balance, price)))
        .returning({ id: accounts.id })
`
  ok('G3 抓到"无守卫的余额扣减"', findUnguardedDecrement(g3Bad).length === 1)
  ok('G3 放过带余额守卫的扣减', findUnguardedDecrement(g3Guarded).length === 0)
  ok('额度列判定本身有牙', guardsQuantityColumn('gt(products.stock, 0)') && !guardsQuantityColumn('eq(a.id, 1)'))
  // G4 成对锁:同样写绝对值,锁外判红、锁内(同函数有 FOR UPDATE)给机器豁免 ——
  // 豁免必须现验,不是行内标记;而 sql 侧自增与流水快照列都不该被判。
  const absNoLock = [
    '      const nb = cur + amount',
    '      await db.update(margins).set({ tokenQuantity: nb, updatedAt: new Date() }).where(eq(margins.userId, uid))',
  ].join('\n')
  const absLocked = [
    "    await db.transaction(async (tx) => {",
    "      const [lk] = await tx.select().from(margins).where(eq(margins.id, 1)).for('update')",
    '      const nb = lk.tokenQuantity + amount',
    '      await tx.update(margins).set({ tokenQuantity: nb, updatedAt: new Date() }).where(eq(margins.userId, uid))',
    '    })',
  ].join('\n')
  ok('G4 抓到无锁的绝对值回写', findAbsoluteQuantityWriteback(absNoLock).hits.length === 1)
  ok('G4 对锁内回写给机器豁免(计入 lockedSafe)', (() => {
    const r = findAbsoluteQuantityWriteback(absLocked)
    return r.hits.length === 0 && r.lockedSafe.length >= 1
  })())
  // 反向锁:找不到任何函数体 ⇒ 无法证明有锁 ⇒ 保守判红(豁免只能"验过才免",不能默认成立)
  ok('G4 无函数体可证锁时不豁免', findAbsoluteQuantityWriteback('const [lk] = await tx.select().from(m).for("update")\nawait tx.update(m).set({ tokenQuantity: nb }).where(eq(m.id, 1))').hits.length === 1)
  ok('G4 不判 sql 侧自增', findAbsoluteQuantityWriteback('await db.update(m).set({ tokenQuantity: sql`x + 1` }).where(eq(m.id, 1))').hits.length === 0)
  ok('G4 不判流水快照列 balanceAfter', findAbsoluteQuantityWriteback('await db.update(f).set({ balanceAfter: x }).where(eq(f.id, 1))').hits.length === 0)
  // G5:计数列的读改写(2026-10-25 立,存量 7 处实测于 community/business-card/remote-device/memory)
  ok(
    'G5 抓到计数字段的 JS 侧 +1 回写',
    findAbsoluteCounterWriteback('await db.update(p).set({ likeCount: post.likeCount + 1, updatedAt: new Date() }).where(eq(p.id, 1))').hits
      .length === 1
  )
  ok(
    'G5 放过库侧自增(正解形态)',
    findAbsoluteCounterWriteback('await db.update(p).set({ likeCount: sql`${p.likeCount} + 1`, updatedAt: new Date() }).where(eq(p.id, 1))').hits
      .length === 0
  )
  ok(
    'G5 抓到 Math.max 包起来的钳制回写(钳制不解决丢失更新)',
    findAbsoluteCounterWriteback('await db.update(p).set({ likeCount: Math.max(0, post.likeCount - 1) }).where(eq(p.id, 1))').hits.length === 1
  )
  ok(
    'G5 与 G4 同规:锁内 FOR UPDATE 给机器豁免',
    (() => {
      const src = 'async function f(tx) { const [r] = await tx.select().from(p).for("update"); await tx.update(p).set({ viewCount: r.viewCount + 1 }).where(eq(p.id, 1)) }'
      const rr = findAbsoluteCounterWriteback(src)
      return rr.hits.length === 0 && rr.lockedSafe.length === 1
    })()
  )
  ok(
    'G5 不收非计数键(price 的合法绝对赋值)',
    findAbsoluteCounterWriteback('await db.update(c).set({ price: nextPrice }).where(eq(c.id, 1))').hits.length === 0
  )

  const cbBad = `  server.post('/withdrawal/notify', async (request, reply) => {
    try { await handle() } catch (e) {
      request.log.error(e)
      return reply.send({ code: 'SUCCESS', message: 'OK' })
    }
  })`
  const cbGood = `  server.post('/withdrawal/notify', async (request, reply) => {
    try { await handle() } catch (e) {
      return reply.code(500).send({ code: 'FAIL', message: '副作用处理失败,待重试' })
    }
  })`
  ok('G2 抓到 catch 里回 SUCCESS', findCallbackSwallowingFailure(cbBad).length === 1)
  ok('G2 放过回 FAIL 让上游重投', findCallbackSwallowingFailure(cbGood).length === 0)
  // 覆盖面反向锁(本门第一版的真盲区):路径与 handler 之间夹 config 对象时,
  // "路径后第一个 {"取到的是那个对象,catch 落在射程外 ⇒ 判据对已修的缺陷静默失明。
  const cbConfig = `  server.post(
    '/payments/withdrawal/notify',
    { schema: { body: z.object({ a: z.string() }) }, preHandler: [verifySign] },
    async (request, reply) => {
      try { await handle() } catch (e) {
        return reply.send({ code: 'SUCCESS', message: 'OK' })
      }
    },
  )`
  ok('G2 打过"路径与 handler 之间夹 config 对象"这一格', findCallbackSwallowingFailure(cbConfig).length === 1)
  ok(
    'G2 对带 config 对象的 FAIL 档不误报',
    findCallbackSwallowingFailure(cbConfig.replace("code: 'SUCCESS'", "code: 'FAIL'")).length === 0,
  )
  // 坐标锁(实测踩过):遮蔽面删注释字符 ⇒ 遮蔽下标映射回原文会整体偏几十行,
  // 报出"看着像行号的错数"比不报更贵 —— 定位必须以原文里的 where 原文为锚。
  const withComments =
    `// 说明一\n// 说明二\n// 说明三\n// 说明四\n` +
    `      await db\n        .update(products)\n        .set({ stock: sql\`\${products.stock} - 1\` })\n        .where(and(eq(products.id, id), gt(products.stock, 0)))\n`
  const hit = findDiscardedGuardedWrites(withComments)[0]
  ok('遮蔽面上确有命中', Boolean(hit))
  ok('报表行号必须落在守卫子句那一行(第 8 行)', locateLine(withComments, hit.whereFull)?.line === 8)
  ok('锚找不到时不猜行号', locateLine(withComments, 'and(eq(never.exists.col, 1))') === -1)
  // 同形锚的成对锁:两处逐字相同的 where(实测 payment-extended 的两处余额释放),
  // 不带游标会都报第一次出现 ⇒ 两条指同一个位置,跟着改会改错那一处。
  const dup = withComments + withComments.replace(/products\.id, id/g, 'products.id, id')
  const locate = makeLocator(dup)
  const l1 = locate('and(eq(products.id, id), gt(products.stock, 0))')
  const l2 = locate('and(eq(products.id, id), gt(products.stock, 0))')
  ok('同形锚的两次命中必须给出两个不同行号', typeof l1 === 'number' && typeof l2 === 'number' && l2 > l1)
  ok('词法层复用同一台(未回抄分词器)', typeof findWriteChains === 'function' && typeof maskText === 'function')

  let rc = 0
  for (const c of cases) {
    console.log(`${c.pass ? '✅' : '❌'} ${c.name}`)
    if (!c.pass) rc = 1
  }
  console.log(`self-test ${cases.filter((c) => c.pass).length}/${cases.length}`)
  return rc
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()
  const faceFlags = ['--staged', '--worktree'].filter((f) => argv.includes(f))
  if (faceFlags.length > 1) {
    console.error('❌ 两面旗同给(§0.4)⇒ 未判定')
    return 2
  }
  const face = faceFlags[0] === '--staged' ? 'staged' : faceFlags[0] === '--worktree' ? 'worktree' : 'head'
  const listed = faceFiles(face)
  if (listed.err) {
    console.error(`❌ 被审面(${face})清单取不到:${listed.err} ⇒ 未判定`)
    return 2
  }
  if (listed.files.length === 0) {
    console.error(`❌ 被审面(${face})在 ${SCOPE} 枚举到 0 个候选 ⇒ 判死,不记绿`)
    return 2
  }

  const findings = []
  const stock = []
  const undetermined = []
  let unreadable = 0
  const aRev = anchorRev()
  for (const file of listed.files) {
    const src = readRev(FACE_REV[face], file)
    if (src === null) {
      unreadable++
      continue
    }
    const { leaks, g1, g2, g3 } = auditText(src)
    // 每个维度各用自己的单调游标(混用会让靠前的锚报成未定位)
    const locate1 = makeLocator(src)
    const locate3 = makeLocator(src)
    const locate2 = makeLocator(src)
    const locate4 = makeLocator(src)
    // 词法机没走干净 ⇒ 本文件的判据是瞎的:落「未判定」逐条点名,既不记绿也不冒红(§0.3)。
    // 拿"扫不出违规"当通过,正是守门 134 头注点名的"从字符串里 harvest 假用量"那一族的反面。
    if (leaks.length) {
      undetermined.push({ file, reason: `词法状态机残留 ${leaks.length} 处(判据失明,不代为判定)` })
      continue
    }
    const curG1 = findDiscardedGuardedWrites(g1)
    const curG3 = findUnguardedDecrement(g3)
    const g4 = findAbsoluteQuantityWriteback(g1)
    const curG5 = findAbsoluteCounterWriteback(g1).hits
    const curG2 = findCallbackSwallowingFailure(g2)
    const curG4 = g4.hits
    if (!curG1.length && !curG2.length && !curG3.length && !curG4.length && !curG5.length) continue
    const aSrc = readRev(aRev, file)
    if (aSrc === null) {
      // 锚点面无此文件 = 本枚新建的文件 ⇒ 存量按 0 计,当前违规全算新增
      for (const h of curG1) findings.push({ dim: 'G1', file, line: locate1(h.whereFull), where: h.whereText })
      for (const h of curG3) findings.push({ dim: 'G3', file, line: locate3(h.whereFull), where: h.whereText })
      for (const h of curG4) findings.push({ dim: 'G4', file, line: locate4(h.setText), where: h.setText })
      for (const h of curG5) findings.push({ dim: 'G5', file, line: locate4(h.value), where: `${h.key}: ${h.value}` })
      for (const h of curG2) findings.push({ dim: 'G2', file, line: locate2(h.route), route: h.route })
      continue
    }
    const a = auditText(aSrc)
    const anchorCount = a.leaks.length
      ? null
      : findDiscardedGuardedWrites(a.g1).length +
        findUnguardedDecrement(a.g3).length +
        findAbsoluteQuantityWriteback(a.g1).hits.length +
        findAbsoluteCounterWriteback(a.g1).hits.length +
        findCallbackSwallowingFailure(a.g2).length
    if (anchorCount === null) {
      undetermined.push({ file, reason: `锚点面(${aRev})词法残留,无法算存量` })
      continue
    }
    const all = [
      ...curG1.map((h) => ({ dim: 'G1', file, line: locate1(h.whereFull), where: h.whereText })),
      ...curG3.map((h) => ({ dim: 'G3', file, line: locate3(h.whereFull), where: h.whereText })),
      ...curG4.map((h) => ({ dim: 'G4', file, line: locate4(h.setText), where: h.setText })),
      ...curG5.map((h) => ({ dim: 'G5', file, line: locate4(h.value), where: `${h.key}: ${h.value}` })),
      ...curG2.map((h) => ({ dim: 'G2', file, line: locate2(h.route), route: h.route })),
    ]
    // 差值棘轮(§0.5/§12e):锚点 = 该文件在锚点面自身的违规数;只拦"本枚把数加上去"。
    if (all.length > anchorCount) for (const f of all) findings.push(f)
    else for (const f of all) stock.push({ ...f, anchor: anchorCount })
  }

  const label = { head: 'HEAD blob', staged: '索引 blob', worktree: '工作树(人工逃生舱)' }[face]
  console.log(`[guarded-write] 面=${label} 候选 ${listed.files.length} / 取材失败 ${unreadable}`)
  for (const f of findings) console.log(`  ❌ ${f.dim} ${f.file}:${f.line}  ${f.where ?? f.route ?? ''}`)
  if (stock.length) {
    console.log(`  ⚠ 存量(只报数,§12e 不逼跳门)${stock.length} 处:`)
    for (const s of stock) console.log(`     ${s.dim} ${s.file}:${s.line}  ${s.where ?? s.route ?? ''}`)
  }
  if (argv.includes('--json'))
    console.log(JSON.stringify({ face, findings, stock, undetermined, unreadable }))
  if (unreadable > 0 || undetermined.length) {
    for (const u of undetermined) console.error(`  ❓ ${u.file} 未判定:${u.reason}`)
    console.error(`❌ 取材失败 ${unreadable} / 未判定 ${undetermined.length} ⇒ 不出具合格证`)
    return 2
  }
  if (findings.length) {
    console.error(
      `❌ 判红 ${findings.length} 处。出口:G1 给守卫式写入加 .returning(...) 并据空集回绝(或把结果接成变量自行读 rowCount);` +
        `G2 失败回 {code:'FAIL'} 让上游重投(与本仓 payment-gateway 同口径),或把该笔显式进对账台账。`,
    )
    return 1
  }
  console.log(`✅ 无判红(存量 ${stock.length} 处只报数;G1/G2 均无新增)`)
  return 0
}

const isDirectRun =
  process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href
if (isDirectRun) {
  main()
    .then((rc) => process.exit(rc))
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}

export const __test__ = {
  findDiscardedGuardedWrites,
  findUnguardedDecrement,
  findAbsoluteQuantityWriteback,
  findAbsoluteCounterWriteback,
  findCallbackSwallowingFailure,
  guardsQuantityColumn,
  isQuantityRelative,
  locateLine,
  makeLocator,
  SCOPE,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
